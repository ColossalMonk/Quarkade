// Builds Koi Out's levels.
//   node tools/build-packs.ts tutorial      -> src/data/levels-tutorial.json (levels 1-20)
//   node tools/build-packs.ts packs 1 <i>   -> public/packs/pack-<i>.json (500 levels from 21 + 500·i)
// Every level's stored escape order is replayed with the real rules before it's written.

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { KoiDef, LevelDef } from "../src/logic/rules.ts";
import { isWon, newBoard, tapKoi } from "../src/logic/rules.ts";
import { GENERATOR_VERSION, generateLevel } from "../src/logic/generator.ts";
import { FIRST_PACK_LEVEL, PACK_SIZE } from "../src/logic/packs.ts";
import { toRow } from "../src/game/levels-row.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function playsOut(def: LevelDef): boolean {
  const b = newBoard(def);
  for (const i of def.sol) {
    const r = tapKoi(b, i);
    if (!r || !r.ok) return false;
  }
  return isWon(b);
}

const hand = (n: number, w: number, h: number, koi: KoiDef[], sol: number[]): LevelDef => ({ n, w, h, koi, sol, d: 0, tag: "tutorial" });
const c3 = (x: number, y: number) => y * 3 + x;
const c4 = (x: number, y: number) => y * 4 + x;

/** Hand-made opening levels (DESIGN.md §4 Tutorial). */
const HAND: Record<number, () => LevelDef> = {
  // 1: three fry, all free.
  1: () => hand(1, 3, 3, [{ c: [c3(0, 1)], d: 3 }, { c: [c3(1, 0)], d: 0 }, { c: [c3(2, 2)], d: 1 }], [0, 1, 2]),
  // 2: one fry blocks another: free the front one first.
  2: () => hand(2, 3, 3, [{ c: [c3(0, 1)], d: 1 }, { c: [c3(2, 1)], d: 0 }, { c: [c3(1, 2)], d: 2 }], [1, 0, 2]),
  // 3: a chain of three: a wrong tap costs a heart.
  3: () => hand(3, 4, 3, [{ c: [c4(0, 1)], d: 1 }, { c: [c4(2, 1)], d: 2 }, { c: [c4(2, 2)], d: 1 }, { c: [c4(1, 0)], d: 0 }], [2, 1, 0, 3]),
};

function buildTutorial(): LevelDef[] {
  const out: LevelDef[] = [];
  for (let n = 1; n <= 20; n++) {
    const def = HAND[n] ? HAND[n]() : generateLevel(n, { candidates: 8 }).def;
    def.n = n;
    def.tag = n === 10 ? "tricky" : "tutorial";
    if (!playsOut(def)) throw new Error(`tutorial level ${n} does not play out`);
    out.push(def);
    console.log(`L${n}: ${def.w}x${def.h} koi ${def.koi.length} longest ${Math.max(...def.koi.map((k) => k.c.length))} ${def.pads ? "pads" : ""}`);
  }
  return out;
}

function buildPack(index: number): void {
  const from = FIRST_PACK_LEVEL + index * PACK_SIZE;
  const to = from + PACK_SIZE - 1;
  const t0 = performance.now();
  const levels = [];
  for (let n = from; n <= to; n++) {
    const lvl = generateLevel(n);
    const back: LevelDef = JSON.parse(JSON.stringify(lvl.def));
    if (!playsOut(back)) throw new Error(`level ${n} failed re-check`);
    levels.push(toRow(lvl.def));
    if ((n - from) % 50 === 49) console.log(`pack ${index}: ${n - from + 1}/${PACK_SIZE} (${Math.round((performance.now() - t0) / 1000)}s)`);
  }
  const dir = join(root, "public", "packs");
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `pack-${index}.json`);
  writeFileSync(file, JSON.stringify({ v: GENERATOR_VERSION, from, to, levels }));
  console.log(`wrote ${file} (${levels.length} levels, ${Math.round((performance.now() - t0) / 1000)}s)`);
}

const [cmd, count, start] = process.argv.slice(2);
if (cmd === "tutorial") {
  const levels = buildTutorial();
  writeFileSync(join(root, "src", "data", "levels-tutorial.json"), JSON.stringify(levels));
  console.log("wrote src/data/levels-tutorial.json");
} else if (cmd === "packs") {
  const n = Number(count ?? 1);
  const s = Number(start ?? 0);
  for (let i = s; i < s + n; i++) buildPack(i);
} else console.log("usage: node tools/build-packs.ts tutorial | packs <count> <start>");
