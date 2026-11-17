// Density level generator, difficulty score and curve (DESIGN.md §5).
// The same code runs offline (tools/build-packs.ts) and in the game's worker past the packs.

import { Rng, seedOf } from "../../../../forge/src/core/rng.ts";
import type { LevelDef, LevelTag } from "./rules.ts";
import { applyMove, decodeLevel, encodeStacks, isSealedStack, isWon, legalMoves, runOf, settle } from "./rules.ts";
import { solve } from "./solver.ts";

export const UNITS = 4;
export const GENERATOR_VERSION = "dens-v1";

/** How many liquids exist in each weight class (liquids.ts): foam 2, oil 3, water 5, syrup 4, mercury 2. */
export const CLASS_SIZE: Record<number, number> = { 1: 2, 2: 3, 3: 5, 4: 4, 5: 2 };

/** Where each special first appears, alone, in an easier (non-Tricky) level with a tip. */
export const INTRO = { oddCaps: 31, cork: 45, foam: 61, mercury: 91 };

// ---------- rhythm ----------

export function tagFor(n: number): LevelTag {
  if (n <= 20) return "tutorial";
  if (n >= 150 && n % 50 === 0) return "masterpiece";
  if (n % 10 === 0) return "tricky";
  if (n % 5 === 0) return "breather";
  return "normal";
}

/** Tower chapters are about 10 levels: easy start, climbing. -0.2..+0.1 */
function chapterSlope(n: number): number {
  return -0.2 + (((n - 21) % 10) / 9) * 0.3;
}

// ---------- bands ----------

export interface Band {
  kMin: number;
  kMax: number;
  oneEmptyChance: number;
  capPairsMax: number;
  murkyMax: number;
  classesMin: number;
  classesMax: number;
  corksMax: number;
}

export function bandFor(n: number): Band {
  if (n <= 44) return { kMin: 5, kMax: 7, oneEmptyChance: 0, capPairsMax: n >= INTRO.oddCaps ? 1 : 0, murkyMax: 0.15, classesMin: 3, classesMax: 3, corksMax: 0 };
  if (n <= 89) return { kMin: 6, kMax: 8, oneEmptyChance: 0, capPairsMax: 1, murkyMax: 0.2, classesMin: 3, classesMax: 4, corksMax: 1 };
  if (n <= 200) return { kMin: 7, kMax: 9, oneEmptyChance: 0.15, capPairsMax: 2, murkyMax: 0.3, classesMin: 3, classesMax: 5, corksMax: 2 };
  if (n <= 400) return { kMin: 8, kMax: 10, oneEmptyChance: 0.3, capPairsMax: 2, murkyMax: 0.35, classesMin: 4, classesMax: 5, corksMax: 2 };
  return { kMin: 7, kMax: 11, oneEmptyChance: 0.35, capPairsMax: 2, murkyMax: 0.35, classesMin: 3, classesMax: 5, corksMax: 2 };
}

function bandProgress(n: number): number {
  const edges = [21, 45, 90, 201, 401, 1000];
  for (let i = 0; i < edges.length - 1; i++) if (n < edges[i + 1]) return (n - edges[i]) / (edges[i + 1] - edges[i]);
  return 0.5;
}

/** Weight classes available at level n. */
export function classesAvailable(n: number): number[] {
  const c = [2, 3, 4];
  if (n >= INTRO.foam) c.unshift(1);
  if (n >= INTRO.mercury) c.push(5);
  return c;
}

// ---------- metrics ----------

export interface Metrics {
  k: number;
  empties: number;
  crowding: number;
  murkyShare: number;
  specials: number;
  deadEndRate: number;
  par: number;
}

export function difficultyScore(m: Metrics): number {
  return 0.8 * m.k + 3.0 * (2 - m.empties) + 1.2 * m.crowding + 4.0 * m.murkyShare + 1.0 * m.specials + 6.0 * m.deadEndRate + 0.05 * m.par;
}

export function deadEndRate(def: LevelDef, rng: Rng, playouts = 30): number {
  let stuck = 0;
  for (let p = 0; p < playouts; p++) {
    const b = decodeLevel(def);
    for (let step = 0; step < 300; step++) {
      if (isWon(b)) break;
      const moves = legalMoves(b);
      if (!moves.length) {
        stuck++;
        break;
      }
      applyMove(b, rng.pick(moves));
    }
  }
  return stuck / playouts;
}

// ---------- candidates ----------

export interface GenParams {
  k: number;
  empties: number;
  capPairs: number;
  murky: number;
  /** Weight class of each slot. */
  classes: number[];
  corks: number;
}

/** Spread k slots over `count` classes chosen from `available` (within each class's liquid count). */
export function pickClasses(k: number, count: number, available: number[], rng: Rng, mustInclude?: number): number[] {
  let pool = rng.shuffle(available.slice());
  if (mustInclude !== undefined) pool = [mustInclude, ...pool.filter((c) => c !== mustInclude)];
  if (!pool.slice(0, count).includes(3) && count < pool.length && rng.chance(0.85)) {
    // Water is the backbone of most levels.
    pool = [3, ...pool.filter((c) => c !== 3)];
  }
  const chosen = pool.slice(0, Math.min(count, pool.length));
  const counts = new Map<number, number>(chosen.map((c) => [c, 1]));
  let left = k - chosen.length;
  let guard = 0;
  while (left > 0 && guard++ < 200) {
    const c = rng.pick(chosen);
    if ((counts.get(c) ?? 0) < CLASS_SIZE[c]) {
      counts.set(c, counts.get(c)! + 1);
      left--;
    }
  }
  const out: number[] = [];
  for (const [c, n] of counts) for (let i = 0; i < n; i++) out.push(c);
  return rng.shuffle(out);
}

export interface Candidate {
  caps: number[];
  stacks: number[][];
  hidden: boolean[][];
  classes: number[];
  corks: Array<[number, number]>;
}

export function makeCandidate(p: GenParams, rng: Rng): Candidate | null {
  const k = p.classes.length;
  const caps: number[] = new Array(k).fill(UNITS);
  for (let i = 0; i < p.capPairs && i * 2 + 1 < k; i++) {
    caps[i * 2] = UNITS - 1;
    caps[i * 2 + 1] = UNITS + 1;
  }
  rng.shuffle(caps);
  const pool: number[] = [];
  for (let s = 0; s < k; s++) for (let j = 0; j < UNITS; j++) pool.push(s);
  rng.shuffle(pool);
  const stacks: number[][] = [];
  let at = 0;
  for (let i = 0; i < k; i++) {
    stacks.push(settle(pool.slice(at, at + caps[i]), p.classes));
    at += caps[i];
  }
  for (const s of stacks) {
    if (isSealedStack(s, UNITS)) return null;
    if (runOf(s) >= 3) return null;
  }
  for (let e = 0; e < p.empties; e++) {
    caps.push(UNITS);
    stacks.push([]);
  }
  const hidden = stacks.map((s) => s.map(() => false));
  const spots: Array<[number, number]> = [];
  stacks.forEach((s, i) => s.forEach((_, j) => j < s.length - 1 && spots.push([i, j])));
  rng.shuffle(spots);
  const want = Math.round(k * UNITS * p.murky);
  for (let h = 0; h < want && h < spots.length; h++) hidden[spots[h][0]][spots[h][1]] = true;
  const corks: Array<[number, number]> = [];
  const filled = rng.shuffle(stacks.map((s, i) => i).filter((i) => stacks[i].length));
  for (let c = 0; c < p.corks && c < filled.length; c++) corks.push([filled[c], rng.int(1, 2)]);
  return { caps, stacks, hidden, classes: p.classes, corks };
}

export interface BuiltLevel {
  def: LevelDef;
  metrics: Metrics;
}

/**
 * Rate a candidate with a quick, greedy solve (weight 2.5, small node budget): enough to know it is
 * solvable and to rank it. The chosen level then gets an accurate par from refinePar().
 */
export function rateCandidate(n: number, tag: LevelTag, cand: Candidate, rng: Rng, maxNodes = 20000, weight = 2.5): BuiltLevel | null {
  const corkArr = cand.caps.map(() => 0);
  for (const [f, c] of cand.corks) corkArr[f] = c;
  const res = solve({ stacks: cand.stacks, caps: cand.caps, classes: cand.classes, L: UNITS, corks: corkArr }, { weight, maxNodes });
  if (!res.solved) return null;
  const k = cand.classes.length;
  const murky = cand.hidden.reduce((m, h) => m + h.filter(Boolean).length, 0);
  const par = res.moves.length + Math.ceil(murky / 3);
  const def: LevelDef = { n, caps: cand.caps, stacks: encodeStacks(cand.stacks, cand.hidden), classes: cand.classes, L: UNITS, par, d: 0, tag };
  if (cand.corks.length) def.corks = cand.corks;
  const perClass = new Map<number, number>();
  for (const c of cand.classes) perClass.set(c, (perClass.get(c) ?? 0) + 1);
  const crowding = Math.max(...perClass.values());
  const odd = cand.caps.some((c) => c !== UNITS);
  const metrics: Metrics = {
    k,
    empties: cand.stacks.filter((s) => !s.length).length,
    crowding,
    murkyShare: murky / (k * UNITS),
    specials: (odd ? 0.5 : 0) + 1.5 * cand.corks.length + (perClass.has(1) ? 0.5 : 0) + (perClass.has(5) ? 0.5 : 0),
    deadEndRate: deadEndRate(def, rng),
    par,
  };
  def.d = Math.round(difficultyScore(metrics) * 100) / 100;
  return { def, metrics };
}

export function paramsFor(n: number, rng: Rng): GenParams {
  const band = bandFor(n);
  const tag = tagFor(n);
  const prog = bandProgress(n);
  let k = Math.round(band.kMin + (band.kMax - band.kMin) * prog + (rng.next() - 0.5));
  if (tag === "breather") k -= 1;
  if (tag === "tricky" || tag === "masterpiece") k += 1;
  k = Math.max(band.kMin - 1, Math.min(band.kMax + (tag === "masterpiece" ? 1 : 0), k));
  let empties = rng.chance(band.oneEmptyChance) ? 1 : 2;
  if (tag === "breather") empties = 2;
  if (tag === "masterpiece") empties = rng.chance(0.5) ? 1 : 2;
  const capPairs = band.capPairsMax ? rng.int(0, band.capPairsMax) : 0;
  let murky = band.murkyMax * (0.3 + 0.7 * prog) * rng.next();
  if (tag === "breather") murky *= 0.4;
  const avail = classesAvailable(n);
  const classCount = Math.min(avail.length, rng.int(band.classesMin, band.classesMax));
  let corks = band.corksMax ? rng.int(0, band.corksMax) : 0;
  if (tag === "breather") corks = Math.min(corks, 1);
  // Introductions: the new thing on its own, in an easier level.
  if (n === INTRO.oddCaps) return { k: 6, empties: 2, capPairs: 1, murky: 0, classes: pickClasses(6, 3, [2, 3, 4], rng), corks: 0 };
  if (n === INTRO.cork) return { k: 6, empties: 2, capPairs: 0, murky: 0, classes: pickClasses(6, 3, [2, 3, 4], rng), corks: 1 };
  if (n === INTRO.foam) return { k: 6, empties: 2, capPairs: 0, murky: 0, classes: pickClasses(6, 3, [1, 3, 4], rng, 1), corks: 0 };
  if (n === INTRO.mercury) return { k: 6, empties: 2, capPairs: 0, murky: 0, classes: pickClasses(6, 3, [2, 3, 5], rng, 5), corks: 0 };
  return { k, empties, capPairs, murky: Math.round(murky * 100) / 100, classes: pickClasses(k, classCount, avail, rng), corks };
}

/** A careful solve for the chosen level only: tighter par (and D), when it finds a shorter route. */
export function refinePar(built: BuiltLevel, maxNodes = 120000): BuiltLevel {
  const b = decodeLevel(built.def);
  const res = solve({ stacks: b.stacks, caps: b.caps, classes: b.classes, L: b.L, corks: b.corks }, { weight: 1.4, maxNodes });
  const murky = b.hidden.reduce((m, h) => m + h.filter(Boolean).length, 0);
  if (res.solved) {
    const par = res.moves.length + Math.ceil(murky / 3);
    if (par < built.def.par) {
      built.metrics.par = par;
      built.def.par = par;
      built.def.d = Math.round(difficultyScore(built.metrics) * 100) / 100;
    }
  }
  return built;
}

function percentileFor(n: number, tag: LevelTag): number {
  if (Object.values(INTRO).includes(n)) return 0.1;
  if (tag === "breather") return 0.1;
  if (tag === "tricky") return 0.85;
  if (tag === "masterpiece") return 0.95;
  return Math.max(0.05, Math.min(0.95, 0.5 + chapterSlope(n)));
}

function pickFrom(rated: BuiltLevel[], p: number): BuiltLevel {
  rated.sort((a, b) => a.def.d - b.def.d);
  return rated[Math.min(rated.length - 1, Math.round(p * (rated.length - 1)))];
}

export function generateLevel(n: number, opts: { candidates?: number; maxNodes?: number } = {}): BuiltLevel {
  const tag = tagFor(n);
  const rng = new Rng(seedOf(n, GENERATOR_VERSION));
  const want = opts.candidates ?? 5;
  const rated: BuiltLevel[] = [];
  for (let attempts = 0; rated.length < want && attempts < want * 12; attempts++) {
    const p = paramsFor(n, rng);
    if (attempts > want * 6) {
      p.empties = 2;
      p.corks = 0;
    }
    const cand = makeCandidate(p, rng);
    if (!cand) continue;
    const built = rateCandidate(n, tag, cand, rng, opts.maxNodes);
    if (built) rated.push(built);
  }
  if (!rated.length) {
    for (;;) {
      const cand = makeCandidate({ k: 5, empties: 2, capPairs: 0, murky: 0, classes: pickClasses(5, 2, [3, 4], rng), corks: 0 }, rng);
      if (!cand) continue;
      const built = rateCandidate(n, tag, cand, rng);
      if (built) return refinePar(built);
    }
  }
  return refinePar(pickFrom(rated, percentileFor(n, tag)));
}

/** Daily Brew: one tricky puzzle per UTC day, the same for everyone. */
export function generateDaily(dayKey: string, opts: { candidates?: number; maxNodes?: number } = {}): BuiltLevel {
  const rng = new Rng(seedOf(dayKey, "dens-daily"));
  const want = opts.candidates ?? 6;
  const rated: BuiltLevel[] = [];
  for (let attempts = 0; rated.length < want && attempts < want * 12; attempts++) {
    const k = rng.int(7, 8);
    const cand = makeCandidate({ k, empties: 2, capPairs: rng.int(0, 1), murky: 0.12, classes: pickClasses(k, rng.int(3, 4), [1, 2, 3, 4, 5], rng), corks: rng.int(0, 1) }, rng);
    if (!cand) continue;
    const built = rateCandidate(0, "daily", cand, rng, opts.maxNodes);
    if (built) rated.push(built);
  }
  return refinePar(pickFrom(rated, 0.7));
}
