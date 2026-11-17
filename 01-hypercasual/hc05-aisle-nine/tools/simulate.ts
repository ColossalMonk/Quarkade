// Coins and Main Street pacing over the real levels for 3 player types: node tools/simulate.ts <levels>
// Reads the shipped packs (public/packs) and the tutorial; generates past them.

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { LevelDef } from "../src/logic/rules.ts";
import { kindCounts, newBoard } from "../src/logic/rules.ts";
import { generateLevel } from "../src/logic/generator.ts";
import { FIRST_PACK_LEVEL, PACK_SIZE } from "../src/logic/packs.ts";
import { fromRow } from "../src/game/levels-row.ts";
import type { PackRow } from "../src/game/levels-row.ts";
import { DisplayProgress, nextDisplay } from "../src/game/displays.ts";
import { GOODS } from "../src/data/goods.ts";
import { DISPLAYS, SHOP_STARS } from "../src/data/shops.ts";
import { levelCoins, starsFor, twoStarLimit } from "../src/data/economy.ts";

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
  { name: "sharp (par)", extra: 0, restartEvery: 0 },
  { name: "casual (+15%)", extra: 0.15, restartEvery: 0 },
  { name: "struggling (+35%, restarts)", extra: 0.35, restartEvery: 4 },
];

for (const pl of players) {
  let coins = 100;
  let stars = 0;
  let display = new DisplayProgress(0);
  const finished: string[] = [];
  let encores = 0;
  let started = 1;
  const lengths: number[] = [];
  const opened: string[] = [];
  let moves = 0;
  for (let n = 1; n <= total; n++) {
    const def = level(n);
    const b = newBoard(def);
    const counts = kindCounts(b);
    const goodsOf = display.mapGoods(counts, n);
    const m = Math.round(def.par * (1 + pl.extra));
    moves += m;
    const s = starsFor(m, def.par, false);
    const firstTry = !(pl.restartEvery && n % pl.restartEvery === 0);
    coins += levelCoins(n, s, firstTry, def.tag);
    stars += s;
    const ids: string[] = [];
    counts.forEach((c, k) => {
      const id = GOODS[goodsOf[k]].id;
      ids.push(id);
      for (let i = 0; i < Math.floor(c / 3); i++) display.tick(id);
    });
    display.topUp(ids);
    if (display.complete) {
      lengths.push(n - started + 1);
      if (display.encore) encores++;
      else finished.push(display.display.id);
      const before = display.display.shop;
      const next = nextDisplay(finished, stars, encores);
      display = new DisplayProgress(next.index, [], next.encore);
      if (display.display.shop !== before && !next.encore) opened.push(`${display.display.shop}@${n}`);
      started = n + 1;
    }
  }
  const avg = lengths.reduce((a, b) => a + b, 0) / Math.max(1, lengths.length);
  console.log(`\n== ${pl.name} ==`);
  console.log(`  avg coins/level ${((coins - 100) / total).toFixed(1)}; avg moves/level ${(moves / total).toFixed(1)}; ★★ limit example: par 20 -> ${twoStarLimit(20)}`);
  console.log(`  displays finished ${lengths.length} (avg ${avg.toFixed(1)} levels, min ${Math.min(...lengths)}, max ${Math.max(...lengths)}); stars ${stars}`);
  console.log(`  next shop started at: ${opened.join(", ") || "none"} (stars needed ${SHOP_STARS.join("/")}); displays total ${DISPLAYS.length}`);
}
