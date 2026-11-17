// Builds Knotwork's levels offline.
//   node tools/build-packs.ts tutorial        -> src/data/levels-tutorial.json (levels 1-20)
//   node tools/build-packs.ts packs 6         -> public/packs/pack-0.json .. pack-5.json (500 levels each, from level 21)
//   node tools/build-packs.ts packs 1 3       -> only pack-3
// Every level is solved by the solver before it is saved.

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

interface TutorialSpec {
  k: number;
  par: [number, number];
  hidden?: number;
  pick?: "easiest" | "hardest";
}

const TUTORIAL: Array<TutorialSpec | "hand"> = [
  "hand", // 1
  { k: 3, par: [4, 6] }, // 2
  { k: 3, par: [5, 7] }, // 3  quilt screen
  { k: 3, par: [6, 8] }, // 4  groups move together
  { k: 4, par: [7, 9] }, // 5  undo
  { k: 4, par: [8, 10] }, // 6  stars + par
  { k: 4, par: [8, 11] }, // 7
  { k: 5, par: [10, 13] }, // 8  Spare Needle
  { k: 5, par: [10, 14] }, // 9
  { k: 5, par: [11, 16], pick: "hardest" }, // 10 Tricky + hint
  { k: 5, par: [12, 15] }, // 11
  { k: 5, par: [12, 16] }, // 12
  { k: 6, par: [13, 17] }, // 13
  { k: 6, par: [14, 18] }, // 14
  { k: 5, par: [12, 16], hidden: 0.1 }, // 15 hidden loops + Lantern
  { k: 5, par: [12, 17], hidden: 0.1 }, // 16
  { k: 6, par: [14, 18], hidden: 0.1 }, // 17
  { k: 6, par: [14, 19] }, // 18
  { k: 6, par: [15, 20], hidden: 0.12 }, // 19
  { k: 6, par: [15, 21], hidden: 0.12 }, // 20 first quilt finishes around here
];

function buildTutorial(): LevelDef[] {
  const out: LevelDef[] = [];
  TUTORIAL.forEach((spec, i) => {
    const n = i + 1;
    if (spec === "hand") {
      out.push({ n, caps: [4, 4, 4], stacks: ["aabb", "bbaa", ""], L: 4, par: 3, d: 1, tag: "tutorial" });
      return;
    }
    const rng = new Rng(seedOf(n, "knot-tutorial"));
    const pool = [];
    for (let attempt = 0; attempt < 400 && pool.length < 24; attempt++) {
      const cand = makeCandidate({ k: spec.k, empties: 2, capPairs: 0, hiddenShare: spec.hidden ?? 0, twistPairs: 0, knots: 0, moth: false }, rng);
      if (!cand) continue;
      const built = rateCandidate(n, "tutorial", cand, rng);
      if (!built) continue;
      if (built.def.par < spec.par[0] || built.def.par > spec.par[1]) continue;
      pool.push(built);
    }
    if (!pool.length) throw new Error(`tutorial level ${n}: no candidate in par range`);
    pool.sort((a, b) => a.metrics.deadEndRate - b.metrics.deadEndRate || a.def.d - b.def.d);
    const chosen = spec.pick === "hardest" ? pool[pool.length - 1] : pool[0];
    chosen.def.tag = n === 10 ? "tricky" : "tutorial";
    out.push(chosen.def);
    console.log(`L${n}: k=${spec.k} par=${chosen.def.par} D=${chosen.def.d} dead=${chosen.metrics.deadEndRate.toFixed(2)}`);
  });
  return out;
}

type PackRow = [number[], string[], number, number, string] | [number[], string[], number, number, string, [number, number]];

function compact(def: LevelDef): PackRow {
  return def.moth ? [def.caps, def.stacks, def.par, def.d, def.tag, def.moth] : [def.caps, def.stacks, def.par, def.d, def.tag];
}

function buildPack(index: number): void {
  const from = FIRST_PACK_LEVEL + index * PACK_SIZE;
  const to = from + PACK_SIZE - 1;
  const t0 = performance.now();
  const levels = [];
  for (let n = from; n <= to; n++) {
    const lvl = generateLevel(n);
    // Belt and braces: re-solve the stored encoding.
    // Same search settings as generation, so this checks the stored encoding round-trips.
    // (A different weight can miss a solution the generator found on hard moth levels.)
    let check = solve(decodeLevel(lvl.def), { weight: 1.4, maxNodes: 150000 });
    if (!check.solved) check = solve(decodeLevel(lvl.def), { weight: 1.0, maxNodes: 400000 });
    if (!check.solved) throw new Error(`level ${n} failed re-check`);
    levels.push(compact(lvl.def));
    if ((n - from + 1) % 50 === 0) {
      const secs = ((performance.now() - t0) / 1000).toFixed(0);
      console.log(`pack ${index}: ${n - from + 1}/${PACK_SIZE} (${secs}s)`);
    }
  }
  const dir = join(root, "public", "packs");
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `pack-${index}.json`);
  writeFileSync(file, JSON.stringify({ v: GENERATOR_VERSION, from, to, L: 4, levels }));
  console.log(`wrote ${file} (${levels.length} levels, ${((performance.now() - t0) / 1000).toFixed(0)}s)`);
}

const [mode, a, b] = process.argv.slice(2);
if (mode === "tutorial") {
  const levels = buildTutorial();
  const file = join(root, "src", "data", "levels-tutorial.json");
  writeFileSync(file, JSON.stringify(levels, null, 1));
  console.log(`wrote ${file}`);
} else if (mode === "packs") {
  const count = Number(a ?? 1);
  const start = b !== undefined ? Number(b) : 0;
  for (let i = start; i < start + count; i++) buildPack(i);
} else {
  console.log("usage: node tools/build-packs.ts tutorial | packs <count> [startIndex]");
}
