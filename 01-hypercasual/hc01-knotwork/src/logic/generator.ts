// Level generator, difficulty score and difficulty curve.
// Same code runs offline (tools/build-packs.ts) and in the game's worker for levels past the packs.

import { Rng, seedOf } from "../../../../forge/src/core/rng.ts";
import type { LevelDef, LevelTag, MothState } from "./rules.ts";
import {
  KNOT,
  MOTH_TIMER,
  applyMove,
  completeColour,
  decodeLevel,
  encodeStacks,
  isTied,
  isTwisted,
  isWon,
  legalMoves,
  makeTwist,
  maskOf,
  pickMothNeedle,
  runOf,
} from "./rules.ts";
import { solve } from "./solver.ts";

export const LOOPS_PER_COLOUR = 4;
export const GENERATOR_VERSION = "knot-v2";

/** Levels where a special first appears, on its own, with a tip. */
export const INTRO = { twisted: 45, knot: 61, moth: 80 };

// ---------- Rhythm ----------

export function tagFor(n: number): LevelTag {
  if (n <= 20) return "tutorial";
  if (n >= 150 && n % 50 === 0) return "masterpiece";
  if (n === INTRO.moth || (n > INTRO.moth && n % 25 === 0)) return "moth";
  if (n % 10 === 0) return "tricky";
  if (n % 5 === 0) return "breather";
  return "normal";
}

/** Quilt chapters are about 12 levels: they open easy and climb. Returns -0.2..+0.1. */
function chapterSlope(n: number): number {
  const pos = (n - 21) % 12; // 0..11
  return -0.2 + (pos / 11) * 0.3;
}

// ---------- Difficulty bands (the timeline in DESIGN.md §5) ----------

export interface Band {
  kMin: number;
  kMax: number;
  /** Chance of only one empty needle (otherwise two). */
  oneEmptyChance: number;
  /** Max number of (3,5) capacity pairs replacing (4,4). */
  capPairsMax: number;
  hiddenMax: number;
  twistMax: number;
  knotMax: number;
}

export function bandFor(n: number): Band {
  if (n <= 44) return { kMin: 5, kMax: 7, oneEmptyChance: 0, capPairsMax: n >= 30 ? 1 : 0, hiddenMax: 0.15, twistMax: 0, knotMax: 0 };
  if (n <= 79) return { kMin: 6, kMax: 8, oneEmptyChance: 0, capPairsMax: 1, hiddenMax: 0.2, twistMax: 1, knotMax: n >= INTRO.knot ? 1 : 0 };
  if (n <= 200) return { kMin: 7, kMax: 9, oneEmptyChance: 0.15, capPairsMax: 2, hiddenMax: 0.3, twistMax: 2, knotMax: 2 };
  if (n <= 400) return { kMin: 8, kMax: 10, oneEmptyChance: 0.3, capPairsMax: 2, hiddenMax: 0.35, twistMax: 2, knotMax: 2 };
  return { kMin: 7, kMax: 11, oneEmptyChance: 0.35, capPairsMax: 2, hiddenMax: 0.4, twistMax: 3, knotMax: 3 };
}

function bandProgress(n: number): number {
  const edges = [21, 45, 80, 201, 401, 1000];
  for (let i = 0; i < edges.length - 1; i++) {
    if (n < edges[i + 1]) return (n - edges[i]) / (edges[i + 1] - edges[i]);
  }
  return 0.5;
}

// ---------- Metrics ----------

export interface Metrics {
  k: number;
  empties: number;
  burial: number;
  hiddenShare: number;
  deadEndRate: number;
  par: number;
  specials: number;
}

/** D from DESIGN.md §5 "Difficulty score". */
export function difficultyScore(m: Metrics): number {
  return (
    0.8 * m.k +
    3.0 * (2 - m.empties) +
    1.5 * m.burial +
    4.0 * m.hiddenShare +
    1.0 * m.specials +
    6.0 * m.deadEndRate +
    0.05 * m.par
  );
}

/** Share of random playouts that end stuck (or chewed by the moth). */
export function deadEndRate(def: LevelDef, rng: Rng, playouts = 120): number {
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
      if (applyMove(b, rng.pick(moves)).mothChewed) {
        stuck++;
        break;
      }
    }
  }
  return stuck / playouts;
}

/** 0 = every colour has a loop on top somewhere, 1 = colours are buried deep. */
function burialOf(stacks: number[][], k: number): number {
  let total = 0;
  for (let c = 0; c < k; c++) {
    let shallowest = Infinity;
    for (const s of stacks) {
      for (let j = s.length - 1; j >= 0; j--) {
        if (maskOf(s[j]) & (1 << c)) {
          shallowest = Math.min(shallowest, s.length - 1 - j);
          break;
        }
      }
    }
    total += Number.isFinite(shallowest) ? shallowest : 0;
  }
  return total / k / (LOOPS_PER_COLOUR - 1);
}

// ---------- Candidate generation ----------

export interface GenParams {
  k: number;
  empties: number;
  capPairs: number;
  hiddenShare: number;
  twistPairs: number;
  knots: number;
  moth: boolean;
}

export interface Candidate {
  caps: number[];
  stacks: number[][];
  hidden: boolean[][];
  moth: MothState | null;
}

/** Fill k needles with k colours x L loops (plus specials); null if the deal is unusable. */
export function makeCandidate(p: GenParams, rng: Rng): Candidate | null {
  const L = LOOPS_PER_COLOUR;
  const caps: number[] = new Array(p.k).fill(L);
  for (let i = 0; i < p.capPairs && i * 2 + 1 < p.k; i++) {
    caps[i * 2] = L - 1;
    caps[i * 2 + 1] = L + 1;
  }
  rng.shuffle(caps);

  // Build "units": single loops, or knotted pairs that must stay together.
  const plain = new Array(p.k).fill(L);
  const colours = rng.shuffle([...Array(p.k).keys()]);
  const units: number[][] = [];
  const pairs = Math.min(p.twistPairs, Math.floor(p.k / 2));
  for (let i = 0; i < pairs; i++) {
    const a = colours[i * 2];
    const b = colours[i * 2 + 1];
    plain[a]--;
    plain[b]--;
    units.push([makeTwist(a, b)], [makeTwist(a, b)]);
  }
  // Knots on colours not used by twisted pairs.
  const knotColours = colours.slice(pairs * 2, pairs * 2 + p.knots);
  for (const c of knotColours) {
    plain[c] -= 2;
    units.push([c | KNOT, c]);
  }
  plain.forEach((count, c) => {
    for (let j = 0; j < count; j++) units.push([c]);
  });
  rng.shuffle(units);

  const stacks: number[][] = [];
  for (let i = 0; i < p.k; i++) {
    const s: number[] = [];
    while (s.length < caps[i]) {
      const room = caps[i] - s.length;
      const u = units.findIndex((unit) => unit.length <= room);
      if (u < 0) return null;
      s.push(...units.splice(u, 1)[0]);
    }
    stacks.push(s);
  }
  if (units.length) return null;
  for (const s of stacks) {
    if (completeColour(s, L) >= 0) return null;
    if (runOf(s).n >= 3) return null; // giveaway: three of a colour already on top
  }
  for (let e = 0; e < p.empties; e++) {
    caps.push(L);
    stacks.push([]);
  }
  // Hidden loops: plain, untied, never the top loop of a needle.
  const hidden = stacks.map((s) => s.map(() => false));
  const spots: Array<[number, number]> = [];
  stacks.forEach((s, i) =>
    s.forEach((v, j) => {
      if (j >= s.length - 1 || isTwisted(v) || isTied(v) || (j > 0 && isTied(s[j - 1]))) return;
      spots.push([i, j]);
    }),
  );
  rng.shuffle(spots);
  const wantHidden = Math.round(p.k * L * p.hiddenShare);
  for (let h = 0; h < wantHidden && h < spots.length; h++) {
    const [i, j] = spots[h];
    hidden[i][j] = true;
  }
  let moth: MothState | null = null;
  if (p.moth) {
    const needle = pickMothNeedle(stacks, L, undefined, []);
    if (needle >= 0) moth = { needle, count: MOTH_TIMER };
  }
  return { caps, stacks, hidden, moth };
}

export interface BuiltLevel {
  def: LevelDef;
  metrics: Metrics;
}

/** Turn a candidate into a rated level, or null if the solver can't solve it. */
export function rateCandidate(n: number, tag: LevelTag, cand: Candidate, rng: Rng, maxNodes = 150000): BuiltLevel | null {
  const L = LOOPS_PER_COLOUR;
  const res = solve({ stacks: cand.stacks, caps: cand.caps, L, basket: [], moth: cand.moth }, { weight: 1.4, maxNodes });
  if (!res.solved) return null;
  let k = 0;
  let twist = false;
  let knot = false;
  for (const s of cand.stacks) {
    for (const v of s) {
      k = Math.max(k, 32 - Math.clz32(maskOf(v)));
      if (isTwisted(v)) twist = true;
      if (isTied(v)) knot = true;
    }
  }
  const hiddenCount = cand.hidden.reduce((m, h) => m + h.filter(Boolean).length, 0);
  // Hidden loops can't join a run until revealed, so allow a little extra.
  const par = res.moves.length + Math.ceil(hiddenCount / 3);
  const def: LevelDef = {
    n,
    caps: cand.caps,
    stacks: encodeStacks(cand.stacks, cand.hidden),
    L,
    par,
    d: 0,
    tag,
  };
  if (cand.moth) def.moth = [cand.moth.needle, cand.moth.count];
  const metrics: Metrics = {
    k,
    empties: cand.stacks.filter((s) => s.length === 0).length,
    burial: burialOf(cand.stacks, k),
    hiddenShare: hiddenCount / (k * L),
    // Random play never shoos a moth, so measure dead ends without it (its weight is in `specials`).
    deadEndRate: deadEndRate({ ...def, moth: undefined }, rng),
    par,
    specials: (twist ? 1 : 0) + (knot ? 1.5 : 0) + (cand.moth ? 2 : 0),
  };
  def.d = Math.round(difficultyScore(metrics) * 100) / 100;
  return { def, metrics };
}

/** Structural parameters for level n (before picking among candidates). */
export function paramsFor(n: number, rng: Rng): GenParams {
  const band = bandFor(n);
  const tag = tagFor(n);
  const prog = bandProgress(n);
  let k = Math.round(band.kMin + (band.kMax - band.kMin) * prog + (rng.next() - 0.5));
  if (tag === "breather") k -= 1;
  if (tag === "tricky") k += 1;
  if (tag === "masterpiece") k += 1;
  k = Math.max(band.kMin - 1, Math.min(band.kMax + (tag === "masterpiece" ? 1 : 0), k));
  let empties = rng.chance(band.oneEmptyChance) ? 1 : 2;
  if (tag === "breather" || tag === "moth") empties = 2;
  if (tag === "masterpiece") empties = rng.chance(0.5) ? 1 : 2;
  const capPairs = band.capPairsMax ? rng.int(0, band.capPairsMax) : 0;
  let hiddenShare = band.hiddenMax * (0.3 + 0.7 * prog) * rng.next();
  let twistPairs = band.twistMax ? rng.int(0, band.twistMax) : 0;
  let knots = band.knotMax ? rng.int(0, band.knotMax) : 0;
  if (tag === "breather") {
    hiddenShare *= 0.4;
    twistPairs = Math.min(twistPairs, 1);
    knots = Math.min(knots, 1);
  }
  // Introductions: the new special on its own, in an easier level.
  if (n === INTRO.twisted) return { k: 6, empties: 2, capPairs: 0, hiddenShare: 0, twistPairs: 1, knots: 0, moth: false };
  if (n === INTRO.knot) return { k: 6, empties: 2, capPairs: 0, hiddenShare: 0, twistPairs: 0, knots: 1, moth: false };
  if (n === INTRO.moth) return { k: 6, empties: 2, capPairs: 0, hiddenShare: 0, twistPairs: 0, knots: 0, moth: true };
  if (n > INTRO.twisted && n < INTRO.knot) knots = 0;
  return { k, empties, capPairs, hiddenShare: Math.round(hiddenShare * 100) / 100, twistPairs, knots, moth: tag === "moth" };
}

/** Which percentile of the candidates (sorted by D) level n should use. */
function percentileFor(n: number, tag: LevelTag): number {
  if (n === INTRO.twisted || n === INTRO.knot || n === INTRO.moth) return 0.1;
  if (tag === "breather") return 0.1;
  if (tag === "tricky") return 0.85;
  if (tag === "masterpiece") return 0.95;
  if (tag === "moth") return 0.4;
  return Math.max(0.05, Math.min(0.95, 0.5 + chapterSlope(n)));
}

function pickFrom(rated: BuiltLevel[], percentile: number): BuiltLevel {
  rated.sort((a, b) => a.def.d - b.def.d);
  return rated[Math.min(rated.length - 1, Math.round(percentile * (rated.length - 1)))];
}

/** Generate level n deterministically. */
export function generateLevel(n: number, opts: { candidates?: number; maxNodes?: number } = {}): BuiltLevel {
  const tag = tagFor(n);
  const rng = new Rng(seedOf(n, GENERATOR_VERSION));
  const want = opts.candidates ?? 8;
  const rated: BuiltLevel[] = [];
  let attempts = 0;
  while (rated.length < want && attempts < want * 12) {
    attempts++;
    const p = paramsFor(n, rng);
    // If hard deals keep failing, relax them.
    if (attempts > want * 6) {
      p.empties = 2;
      p.knots = Math.min(p.knots, 1);
    }
    const cand = makeCandidate(p, rng);
    if (!cand) continue;
    const built = rateCandidate(n, tag, cand, rng, opts.maxNodes);
    if (built) rated.push(built);
  }
  if (!rated.length) {
    // Extremely unlikely: fall back to an easy, always-solvable layout.
    for (;;) {
      const cand = makeCandidate({ k: 5, empties: 2, capPairs: 0, hiddenShare: 0, twistPairs: 0, knots: 0, moth: false }, rng);
      if (!cand) continue;
      const built = rateCandidate(n, tag, cand, rng);
      if (built) return built;
    }
  }
  return pickFrom(rated, percentileFor(n, tag));
}

/** The Daily Swatch: one tricky puzzle per UTC day, the same for everyone. */
export function generateDaily(dayKey: string, opts: { candidates?: number; maxNodes?: number } = {}): BuiltLevel {
  const rng = new Rng(seedOf(dayKey, "knot-daily"));
  const want = opts.candidates ?? 6;
  const rated: BuiltLevel[] = [];
  for (let attempts = 0; rated.length < want && attempts < want * 12; attempts++) {
    const p: GenParams = {
      k: rng.int(7, 8),
      empties: 2,
      capPairs: rng.int(0, 1),
      hiddenShare: 0.12,
      twistPairs: rng.int(0, 1),
      knots: rng.int(0, 1),
      moth: false,
    };
    const cand = makeCandidate(p, rng);
    if (!cand) continue;
    const built = rateCandidate(0, "daily", cand, rng, opts.maxNodes);
    if (built) rated.push(built);
  }
  return pickFrom(rated, 0.7);
}
