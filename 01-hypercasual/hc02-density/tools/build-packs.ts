// Builds Density's levels offline.
//   node tools/build-packs.ts tutorial      -> src/data/levels-tutorial.json (levels 1-20)
//   node tools/build-packs.ts packs 6       -> public/packs/pack-0..5.json (500 levels each, from 21)
//   node tools/build-packs.ts packs 1 3     -> only pack-3
// Every level is solved by the solver before it's saved.

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Rng, seedOf } from "../../../forge/src/core/rng.ts";
import type { LevelDef } from "../src/logic/rules.ts";
import { decodeLevel } from "../src/logic/rules.ts";
import { generateLevel, makeCandidate, rateCandidate, GENERATOR_VERSION } from "../src/logic/generator.ts";
import { PACK_SIZE, FIRST_PACK_LEVEL } from "../src/logic/packs.ts";
import { solve } from "../src/logic/solver.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

interface Spec {
  classes: number[];
  par: [number, number];
  murky?: number;
  pick?: "hardest";
}

// DESIGN.md §4 tutorial: water only, oil at 4, syrup at 7, parking at 9, Tricky at 10, murky at 15.
const TUTORIAL: Array<Spec | "hand"> = [
  "hand", // 1
  { classes: [3, 3, 3], par: [4, 6] }, // 2
  { classes: [3, 3, 3], par: [5, 7] }, // 3  towers
  { classes: [3, 3, 2], par: [5, 8] }, // 4  oil floats
  { classes: [3, 3, 3, 2], par: [6, 9] }, // 5  undo
  { classes: [3, 3, 2, 2], par: [7, 10] }, // 6  stars + par
  { classes: [3, 3, 4], par: [5, 8] }, // 7  syrup sinks
  { classes: [3, 3, 4, 2], par: [7, 11] }, // 8  Spare Flask
  { classes: [3, 4, 4, 3, 2], par: [9, 13] }, // 9  parking under
  { classes: [3, 3, 4, 2, 2], par: [10, 15], pick: "hardest" }, // 10 Tricky + hint
  { classes: [3, 3, 4, 4, 2], par: [10, 14] }, // 11
  { classes: [3, 3, 3, 4, 2], par: [10, 15] }, // 12
  { classes: [3, 3, 4, 4, 2, 2], par: [12, 16] }, // 13
  { classes: [3, 3, 3, 4, 4, 2], par: [12, 17] }, // 14
  { classes: [3, 3, 4, 2, 2], par: [10, 15], murky: 0.1 }, // 15 murky + Lamp
  { classes: [3, 3, 4, 4, 2], par: [11, 16], murky: 0.1 }, // 16
  { classes: [3, 3, 3, 4, 2, 2], par: [12, 17], murky: 0.1 }, // 17
  { classes: [3, 3, 4, 4, 2, 2], par: [12, 18] }, // 18
  { classes: [3, 3, 3, 4, 4, 2], par: [13, 19], murky: 0.12 }, // 19
  { classes: [3, 3, 4, 4, 2, 2], par: [13, 20], murky: 0.12 }, // 20 first tower
];

function buildTutorial(): LevelDef[] {
  const out: LevelDef[] = [];
  TUTORIAL.forEach((spec, i) => {
    const n = i + 1;
    if (spec === "hand") {
      out.push({ n, caps: [4, 4, 4], stacks: ["aabb", "bbaa", ""], classes: [3, 3], L: 4, par: 3, d: 1, tag: "tutorial" });
      return;
    }
    const rng = new Rng(seedOf(n, "dens-tutorial"));
    const pool = [];
    for (let a = 0; a < 400 && pool.length < 24; a++) {
      const cand = makeCandidate({ k: spec.classes.length, empties: 2, capPairs: 0, murky: spec.murky ?? 0, classes: rng.shuffle(spec.classes.slice()), corks: 0 }, rng);
      if (!cand) continue;
      const built = rateCandidate(n, "tutorial", cand, rng);
      if (!built || built.def.par < spec.par[0] || built.def.par > spec.par[1]) continue;
      pool.push(built);
    }
    if (!pool.length) throw new Error(`tutorial level ${n}: no candidate in par range`);
    pool.sort((a, b) => a.def.d - b.def.d);
    const chosen = spec.pick === "hardest" ? pool[pool.length - 1] : pool[0];
    chosen.def.tag = n === 10 ? "tricky" : "tutorial";
    out.push(chosen.def);
    console.log(`L${n}: classes=${chosen.def.classes.join("")} par=${chosen.def.par} D=${chosen.def.d}`);
  });
  return out;
}

type Row = [number[], string[], number[], number, number, string, Array<[number, number]>?];

function buildPack(index: number): void {
  const from = FIRST_PACK_LEVEL + index * PACK_SIZE;
  const to = from + PACK_SIZE - 1;
  const t0 = performance.now();
  const levels: Row[] = [];
  for (let n = from; n <= to; n++) {
    const lvl = generateLevel(n);
    // Re-solve the stored encoding with the same settings (checks the round trip).
    // Same greedy settings that accepted it, then a careful search as a fallback.
    let check = solve(toInput(lvl.def), { weight: 2.5, maxNodes: 40000 });
    if (!check.solved) check = solve(toInput(lvl.def), { weight: 1.4, maxNodes: 300000 });
    if (!check.solved) throw new Error(`level ${n} failed re-check`);
    const d = lvl.def;
    levels.push(d.corks ? [d.caps, d.stacks, d.classes, d.par, d.d, d.tag, d.corks] : [d.caps, d.stacks, d.classes, d.par, d.d, d.tag]);
    if ((n - from + 1) % 50 === 0) console.log(`pack ${index}: ${n - from + 1}/${PACK_SIZE} (${((performance.now() - t0) / 1000).toFixed(0)}s)`);
  }
  const dir = join(root, "public", "packs");
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `pack-${index}.json`);
  writeFileSync(file, JSON.stringify({ v: GENERATOR_VERSION, from, to, L: 4, levels }));
  console.log(`wrote ${file} (${levels.length} levels, ${((performance.now() - t0) / 1000).toFixed(0)}s)`);
}

function toInput(def: LevelDef) {
  const b = decodeLevel(def);
  return { stacks: b.stacks, caps: b.caps, classes: b.classes, L: b.L, corks: b.corks };
}

const [mode, a, b] = process.argv.slice(2);
if (mode === "tutorial") {
  const file = join(root, "src", "data", "levels-tutorial.json");
  writeFileSync(file, JSON.stringify(buildTutorial(), null, 1));
  console.log(`wrote ${file}`);
} else if (mode === "packs") {
  const count = Number(a ?? 1);
  const start = b !== undefined ? Number(b) : 0;
  for (let i = start; i < start + count; i++) buildPack(i);
} else {
  console.log("usage: node tools/build-packs.ts tutorial | packs <count> [startIndex]");
}
