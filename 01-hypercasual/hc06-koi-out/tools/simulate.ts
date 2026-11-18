// Coins and journal pacing over the real levels for 3 player types: node tools/simulate.ts <levels>
// Reads the shipped packs (public/packs) and the tutorial; generates past them.

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { LevelDef } from "../src/logic/rules.ts";
import { generateLevel } from "../src/logic/generator.ts";
import { FIRST_PACK_LEVEL, PACK_SIZE } from "../src/logic/packs.ts";
import { fromRow } from "../src/game/levels-row.ts";
import type { PackRow } from "../src/game/levels-row.ts";
import { JournalProgress, nextPage } from "../src/game/journal.ts";
import { REGIONS, REGION_STARS } from "../src/data/varieties.ts";
import { levelCoins, starsFor } from "../src/data/economy.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const tutorial = JSON.parse(readFileSync(join(root, "src", "data", "levels-tutorial.json"), "utf8")) as LevelDef[];
const packs = new Map<number, PackRow[]>();

function level(n: number): LevelDef {
  if (n < FIRST_PACK_LEVEL) return tutorial[n - 1];
  const pi = Math.floor((n - FIRST_PACK_LEVEL) / PACK_SIZE);
  if (!packs.has(pi)) {
    const f = join(root, "public", "packs", `pack-${pi}.json`);
    packs.set(pi, existsSync(f) ? (JSON.parse(readFileSync(f, "utf8")).levels as PackRow[]) : []);
  }
  const row = packs.get(pi)![n - FIRST_PACK_LEVEL - pi * PACK_SIZE];
  return row ? fromRow(n, row) : generateLevel(n, { candidates: 2 }).def;
}

const total = Number(process.argv[2] ?? 300);
const players = [
  { name: "sharp (no bumps)", lost: () => 0, restartEvery: 0 },
  { name: "casual (a bump now and then)", lost: (n: number) => (n % 3 === 0 ? 1 : 0), restartEvery: 0 },
  { name: "struggling (1-2 bumps, restarts)", lost: (n: number) => 1 + (n % 2), restartEvery: 4 },
];

let koiSum = 0;
for (const pl of players) {
  let coins = 100;
  let stars = 0;
  let journal = new JournalProgress(0);
  const done: string[] = [];
  let encores = 0;
  let started = 1;
  const lengths: number[] = [];
  const reached: string[] = [];
  koiSum = 0;
  for (let n = 1; n <= total; n++) {
    const def = level(n);
    koiSum += def.koi.length;
    const s = starsFor(pl.lost(n), 0, false);
    const firstTry = !(pl.restartEvery && n % pl.restartEvery === 0);
    coins += levelCoins(n, s, firstTry, def.tag);
    stars += s;
    for (const v of journal.mapVarieties(def.koi.length, n)) journal.sight(v);
    if (journal.complete) {
      lengths.push(n - started + 1);
      if (journal.encore) encores++;
      else done.push(REGIONS[journal.page].id);
      const before = journal.page;
      const next = nextPage(done, stars, encores);
      journal = new JournalProgress(next.page, [], next.encore);
      if (journal.page !== before && !next.encore) reached.push(`${REGIONS[journal.page].id}@${n}`);
      started = n + 1;
    }
  }
  const avg = lengths.reduce((a, b) => a + b, 0) / Math.max(1, lengths.length);
  console.log(`\n== ${pl.name} ==`);
  console.log(`  avg coins/level ${((coins - 100) / total).toFixed(1)}; avg koi/level ${(koiSum / total).toFixed(1)}; stars ${stars}`);
  console.log(`  pages finished ${lengths.length} (avg ${avg.toFixed(1)} levels, min ${Math.min(...lengths)}, max ${Math.max(...lengths)})`);
  console.log(`  regions reached: ${reached.join(", ") || "none"} (stars needed ${REGION_STARS.join("/")})`);
}
