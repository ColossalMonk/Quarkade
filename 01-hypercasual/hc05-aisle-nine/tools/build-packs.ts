// Builds Aisle Nine's levels.
//   node tools/build-packs.ts tutorial      -> src/data/levels-tutorial.json (levels 1-20)
//   node tools/build-packs.ts packs 1 <i>   -> public/packs/pack-<i>.json (500 levels from 21 + 500·i)
// Every level's stored solution is replayed with the real rules before it's written.

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { LevelDef, Move, ShelfDef } from "../src/logic/rules.ts";
import { EMPTY, applyMove, isWon, newBoard } from "../src/logic/rules.ts";
import { GENERATOR_VERSION, generateLevel } from "../src/logic/generator.ts";
import { FIRST_PACK_LEVEL, PACK_SIZE } from "../src/logic/packs.ts";
import { toRow } from "../src/game/levels-row.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const _ = EMPTY;

function playsOut(def: LevelDef): boolean {
  const b = newBoard(def);
  return def.sol.every((m) => applyMove(b, m)) && isWon(b);
}

const still = (n: number, shelves: ShelfDef[], kinds: number, sol: Move[]): LevelDef => ({
  n, units: shelves.length, rows: 1, reach: shelves.length, turns: false, dir: 1, angle: 0, kinds, shelves, sol, par: sol.length, d: 0, tag: "tutorial",
});

/** Hand-made opening levels (DESIGN.md §4 Tutorial). */
const HAND: Record<number, () => LevelDef> = {
  // 1: tap a good, tap a shelf: two moves, two sales.
  1: () => still(1, [{ f: [0, 0, _] }, { f: [0, 1, _] }, { f: [1, 1, _] }], 2, [[0, 1, 0, 0], [0, 1, 1, 2]]),
  // 2: three alike sell (plan which shelf to fill).
  2: () => still(2, [{ f: [0, 0, 1] }, { f: [1, _, _] }, { f: [1, 0, _] }], 2, [[0, 0, 2, 1], [0, 2, 0, 1], [0, 2, 1, 0]]),
  // 3: back stock slides forward when a shelf empties.
  3: () => still(3, [{ f: [0, _, _], b: [[1, 2, 2]] }, { f: [0, 0, _] }, { f: [1, 1, 2] }], 3, [[0, 0, 0, 1], [0, 0, 0, 1], [0, 2, 2, 0], [0, 1, 0, 2]]),
};

function buildTutorial(): LevelDef[] {
  const out: LevelDef[] = [];
  for (let n = 1; n <= 20; n++) {
    const def = HAND[n] ? HAND[n]() : generateLevel(n, { candidates: 8 }).def;
    def.n = n;
    def.tag = n === 10 ? "tricky" : "tutorial";
    if (!playsOut(def)) throw new Error(`tutorial level ${n} does not play out`);
    out.push(def);
    const goods = def.shelves.reduce((a, s) => a + s.f.filter((k) => k !== _).length + (s.b?.length ?? 0) * 3, 0);
    console.log(`L${n}: U${def.units}x${def.rows} reach ${def.reach} turns ${def.turns} kinds ${def.kinds} goods ${goods} par ${def.par} ${def.shelves.some((s) => s.box) ? "box" : ""}`);
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
