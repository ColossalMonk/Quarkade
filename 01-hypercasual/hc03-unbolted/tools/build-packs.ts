// Builds Unbolted's levels.
//   node tools/build-packs.ts tutorial      -> src/data/levels-tutorial.json (levels 1-20)
//   node tools/build-packs.ts packs 6       -> public/packs/pack-0..5.json (500 levels each, from 21)
//   node tools/build-packs.ts packs 1 3     -> only pack-3
// Every level is checked twice: the sensible player (par) and the full-information solver.

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Rng, seedOf } from "../../../forge/src/core/rng.ts";
import type { LevelDef, PlateRow, BoltRow, PinRow } from "../src/logic/rules.ts";
import { isWon, newBoard, tap } from "../src/logic/rules.ts";
import { solve } from "../src/logic/solver.ts";
import { GENERATOR_VERSION, generateLevel, makeLevel, sensiblePlay } from "../src/logic/generator.ts";
import type { GenParams } from "../src/logic/generator.ts";
import { FIRST_PACK_LEVEL, PACK_SIZE } from "../src/logic/packs.ts";
import { toRow } from "../src/game/levels-row.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const P = (shape: number, x: number, y: number, rot = 0, layer = 0): PlateRow => [shape, x, y, rot, layer, 0, -1];
const B = (plate: number, hole: number, colour: number): BoltRow => [plate, hole, colour, 0, -1, -1];

/** Hand-made opening levels (DESIGN.md §4 Tutorial). */
function handMade(n: number, plates: PlateRow[], bolts: BoltRow[], boxes: number[], pins: PinRow[] = []): LevelDef {
  const k = Math.max(...boxes) + 1;
  const def: LevelDef = { n, plates, bolts, pins, chains: [], boxes, k, tray: 5, par: 0, d: 0, tag: "tutorial" };
  return def;
}

const HAND: Record<number, () => LevelDef> = {
  // 1: one plate, three red bolts, a red box.
  1: () => handMade(1, [P(4, 1, 4)], [B(0, 0, 0), B(0, 1, 0), B(0, 3, 0)], [0]),
  // 2: two plates, two colours, two boxes.
  2: () => handMade(2, [P(4, 0, 3), P(4, 3, 5)], [B(0, 0, 0), B(0, 3, 1), B(0, 4, 0), B(1, 1, 1), B(1, 2, 0), B(1, 5, 1)], [0, 1]),
  // 3: a bar on top covers the middle bolt of the plate below.
  3: () => handMade(3, [P(5, 1, 2, 0, 0), P(1, 1, 3, 0, 1)], [B(0, 0, 0), B(0, 1, 0), B(0, 2, 0), B(0, 4, 1), B(1, 0, 1), B(1, 2, 1)], [1, 0]),
  // 4: the swing. A vertical bar covers a bolt; take its top bolt out and it swings clear.
  4: () =>
    handMade(
      4,
      [P(4, 1, 4, 0, 0), P(1, 2, 3, 1, 1), P(0, 1, 1, 0, 0)],
      [B(1, 2, 0), B(1, 0, 0), B(0, 2, 0), B(0, 4, 1), B(0, 0, 1), B(0, 1, 1), B(2, 0, 2), B(2, 1, 2), B(0, 3, 2)],
      [1, 0, 2],
    ),
};

/** Generator settings for the rest of the tutorial: small, with each new idea alone. */
function tutorialParams(n: number): GenParams {
  const t = (n - 5) / 15;
  const p: GenParams = {
    plates: Math.round(3 + t * 3),
    layers: n < 8 ? 2 : 3,
    bolts: Math.round((9 + t * 9) / 3) * 3,
    colours: n < 9 ? 3 : 4,
    mismatch: n === 6 || n === 7 ? 0.35 : 0.15 + t * 0.15,
    tray: 5,
    rusty: n === 15 ? 2 : n > 15 ? 1 : 0,
    hinges: n === 12 ? 1 : n > 12 && n % 2 ? 1 : 0,
    glass: 0,
    locks: 0,
    chains: 0,
    longs: 0,
  };
  if (n === 10) Object.assign(p, { plates: 6, layers: 3, bolts: 18, colours: 4, mismatch: 0.4 });
  return p;
}

function buildTutorial(): LevelDef[] {
  const out: LevelDef[] = [];
  for (let n = 1; n <= 20; n++) {
    let def: LevelDef;
    if (HAND[n]) {
      def = HAND[n]();
      const human = sensiblePlay(def);
      if (!human.won) throw new Error(`hand-made level ${n} is not solvable by a sensible player`);
      def.par = human.detours;
    } else {
      const rng = new Rng(seedOf(n, "tutorial", GENERATOR_VERSION));
      const pool: LevelDef[] = [];
      for (let a = 0; a < 300 && pool.length < 12; a++) {
        const built = makeLevel(n, n === 10 ? "tricky" : "tutorial", tutorialParams(n), rng);
        if (!built) continue;
        // Early levels: no tray needed by a sensible player (6-7 teach the tray, so they need some).
        const want = n === 6 || n === 7 ? [1, 2] : n < 10 ? [0, 0] : [0, 2];
        if (built.def.par < want[0] || built.def.par > want[1]) continue;
        if (n === 12 && !built.def.pins.length) continue;
        if (n === 15 && !built.def.bolts.some((b) => b[3] & 1)) continue;
        pool.push(built.def);
      }
      if (!pool.length) throw new Error(`tutorial level ${n}: no candidate`);
      pool.sort((x, y) => x.d - y.d);
      def = n === 10 ? pool[pool.length - 1] : pool[Math.floor(pool.length * 0.3)];
    }
    def.n = n;
    def.tag = n === 10 ? "tricky" : "tutorial";
    const res = solve(newBoard(def), { maxNodes: 60000 });
    if (!res.solved) throw new Error(`tutorial level ${n}: solver failed`);
    out.push(def);
    console.log(`L${n}: plates ${def.plates.length} bolts ${def.bolts.length} k ${def.k} par ${def.par} opt ${res.detours} pins ${def.pins.length} rusty ${def.bolts.filter((b) => b[3] & 1).length}`);
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
    // Round trip through the stored row, then check it really plays to the end.
    const back: LevelDef = JSON.parse(JSON.stringify(lvl.def));
    const human = sensiblePlay(back);
    let ok = human.won;
    if (!ok) {
      const res = solve(newBoard(back), { maxNodes: 120000 });
      if (res.solved) {
        const b = newBoard(back);
        for (const m of res.moves) tap(b, m);
        ok = isWon(b);
      }
    }
    if (!ok) throw new Error(`level ${n} failed re-check`);
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
