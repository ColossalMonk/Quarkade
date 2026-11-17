// Builds Snug Bento's levels.
//   node tools/build-packs.ts tutorial      -> src/data/levels-tutorial.json (levels 1-20)
//   node tools/build-packs.ts packs 1 <i>   -> public/packs/pack-<i>.json (500 levels from 21 + 500·i)
// Every level's stored solution is replayed, and the solver confirms it can be finished.

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Cell, LevelDef, PieceDef } from "../src/logic/rules.ts";
import { isWon, newBoard, placePiece } from "../src/logic/rules.ts";
import { solve } from "../src/logic/solver.ts";
import { GENERATOR_VERSION, generateLevel } from "../src/logic/generator.ts";
import { FIRST_PACK_LEVEL, PACK_SIZE } from "../src/logic/packs.ts";
import { toRow } from "../src/game/levels-row.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function playsOut(def: LevelDef): boolean {
  const b = newBoard(def);
  return def.sol.every((pl, i) => placePiece(b, i, pl)) && isWon(b) && solve(newBoard(def)).count > 0;
}

const piece = (c: Cell[]): PieceDef => ({ c, t: 0 });

/** Hand-made opening levels (DESIGN.md §4 Tutorial). */
const HAND: Record<number, () => LevelDef> = {
  // 1: two bars into a 3x2 box.
  1: () => ({ n: 1, w: 3, h: 2, mask: "......", walls: [], pieces: [piece([[0, 0], [1, 0], [2, 0]]), piece([[0, 0], [1, 0], [2, 0]])], sol: [{ s: 0, r: 0, x: 0, y: 0 }, { s: 0, r: 0, x: 0, y: 1 }], par: 2, d: 0, tag: "tutorial" }),
  // 2: three pieces fill a 3x3 box.
  2: () => ({
    n: 2,
    w: 3,
    h: 3,
    mask: ".........",
    walls: [],
    pieces: [piece([[0, 0], [1, 0], [2, 0]]), piece([[0, 0], [1, 0], [0, 1]]), piece([[1, 0], [0, 1], [1, 1]])],
    sol: [{ s: 0, r: 0, x: 0, y: 0 }, { s: 0, r: 0, x: 0, y: 1 }, { s: 0, r: 0, x: 1, y: 1 }],
    par: 3,
    d: 0,
    tag: "tutorial",
  }),
  // 3: a 2-wide box: one bar must be turned to fit.
  3: () => ({
    n: 3,
    w: 2,
    h: 3,
    mask: "......",
    walls: [],
    pieces: [piece([[0, 0], [0, 1], [0, 2]]), piece([[0, 0], [1, 0], [2, 0]])],
    sol: [{ s: 0, r: 0, x: 0, y: 0 }, { s: 0, r: 1, x: 1, y: 0 }],
    par: 2,
    d: 0,
    tag: "tutorial",
  }),
};

function buildTutorial(): LevelDef[] {
  const out: LevelDef[] = [];
  for (let n = 1; n <= 20; n++) {
    const def = HAND[n] ? HAND[n]() : generateLevel(n, { candidates: 8 }).def;
    def.n = n;
    def.tag = n === 10 ? "tricky" : "tutorial";
    def.par = def.pieces.length;
    if (!playsOut(def)) throw new Error(`tutorial level ${n} does not play out`);
    out.push(def);
    console.log(`L${n}: ${def.w}x${def.h} pieces ${def.pieces.length} garnish ${def.mask.includes("g")} walls ${def.walls.length}`);
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
    if ((n - from + 1) % 50 === 0) console.log(`pack ${index}: ${n - from + 1}/${PACK_SIZE} (${((performance.now() - t0) / 1000).toFixed(0)}s)`);
  }
  const dir = join(root, "public", "packs");
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `pack-${index}.json`);
  writeFileSync(file, JSON.stringify({ v: GENERATOR_VERSION, from, to, levels }));
  console.log(`wrote ${file} (${levels.length} levels, ${((performance.now() - t0) / 1000).toFixed(0)}s)`);
}

const [mode, a, b] = process.argv.slice(2);
if (mode === "tutorial") {
  const file = join(root, "src", "data", "levels-tutorial.json");
  writeFileSync(file, JSON.stringify(buildTutorial()));
  console.log(`wrote ${file}`);
} else if (mode === "packs") {
  const count = Number(a ?? 1);
  const start = b !== undefined ? Number(b) : 0;
  for (let i = start; i < start + count; i++) buildPack(i);
} else {
  console.log("usage: node tools/build-packs.ts tutorial | packs <count> [startIndex]");
}
