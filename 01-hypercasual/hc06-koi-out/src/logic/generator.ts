// Koi Out level generator, difficulty score and curve (DESIGN.md §5).
//
// Solvable by construction: koi are added in their ESCAPE ORDER. Each new koi leaves after all the
// earlier ones, so its own way out may cross them (they've gone), but its body must stay off every
// earlier koi's way out (it's still there when they leave). Twists are set up first and respected
// along the way: lily pads, frogs (gone after their count), reed banks, currents and whirlpool fry
// (turned back by the number of escapes before them). The level is then replayed with the real rules.

import { Rng, seedOf } from "../../../../forge/src/core/rng.ts";
import type { Dir, KoiDef, LevelDef, LevelTag } from "./rules.ts";
import { DX, DY, freeKoi, isWon, newBoard, occupancy, step, tapKoi, trace } from "./rules.ts";
import { solveOrder } from "./solver.ts";

export const GENERATOR_VERSION = "koi-v1";
/** Dev counters (tools/curve.ts). */
export const genStats = { pieces: 0, longPieces: 0, splits: 0 };

/** Where each special first appears, alone, in an easier level with a tip. */
export const INTRO = { pads: 12, reeds: 25, long: 30, whirls: 45, frogs: 61, currents: 91 };

// ---------------------------------------------------------------- rhythm

export function tagFor(n: number): LevelTag {
  if (n <= 20) return "tutorial";
  if (n >= 150 && n % 50 === 0) return "dragon";
  if (n % 10 === 0) return "tricky";
  if (n % 5 === 0) return "breather";
  return "normal";
}

function chapterSlope(n: number): number {
  return -0.2 + (((n - 21) % 10) / 9) * 0.3;
}

// ---------------------------------------------------------------- bands

export interface Band {
  w: [number, number];
  h: [number, number];
  /** Share of cells covered by koi. */
  density: [number, number];
  /** Longest koi. */
  maxLen: [number, number];
  /** Share of koi that are long (3+ cells). */
  long: [number, number];
  /** How strongly new koi are made to wait for earlier ones (0-1). */
  dep: [number, number];
  pads: number;
  reeds: number;
  whirls: number;
  frogs: number;
  currents: number;
}

export function bandFor(n: number): Band {
  const on = (k: keyof typeof INTRO, v: number) => (n >= INTRO[k] ? v : 0);
  if (n <= 20) return { w: [3, 5], h: [4, 7], density: [0.45, 0.65], maxLen: n >= 16 ? [3, 3] : n >= 4 ? [2, 2] : [1, 1], long: [0, n >= 16 ? 0.2 : 0], dep: [0.2, 0.5], pads: on("pads", 1.5), reeds: 0, whirls: 0, frogs: 0, currents: 0 };
  if (n <= 44) return { w: [5, 7], h: [7, 9], density: [0.6, 0.72], maxLen: [3, n >= INTRO.long ? 6 : 3], long: [0.15, n >= INTRO.long ? 0.6 : 0.3], dep: [0.45, 0.65], pads: 2, reeds: on("reeds", 0.25), whirls: 0, frogs: 0, currents: 0 };
  if (n <= 89) return { w: [6, 8], h: [8, 10], density: [0.66, 0.78], maxLen: [5, 7], long: [0.6, 0.75], dep: [0.55, 0.75], pads: 1.6, reeds: 0.25, whirls: on("whirls", 0.7), frogs: on("frogs", 0.6), currents: 0 };
  if (n <= 200) return { w: [7, 8], h: [10, 12], density: [0.7, 0.82], maxLen: [6, 8], long: [0.65, 0.8], dep: [0.6, 0.8], pads: 2, reeds: 0.3, whirls: 0.7, frogs: 0.6, currents: on("currents", 0.7) };
  if (n <= 400) return { w: [7, 9], h: [11, 13], density: [0.74, 0.86], maxLen: [6, 8], long: [0.7, 0.85], dep: [0.65, 0.85], pads: 2.2, reeds: 0.3, whirls: 0.9, frogs: 0.7, currents: 0.8 };
  return { w: [6, 9], h: [9, 13], density: [0.7, 0.86], maxLen: [5, 8], long: [0.65, 0.85], dep: [0.6, 0.85], pads: 2.2, reeds: 0.3, whirls: 0.9, frogs: 0.7, currents: 0.8 };
}

function bandProgress(n: number): number {
  const edges = [1, 21, 45, 90, 201, 401, 1000];
  for (let i = 0; i < edges.length - 1; i++) if (n < edges[i + 1]) return (n - edges[i]) / (edges[i + 1] - edges[i]);
  return 0.5;
}

// ---------------------------------------------------------------- parameters

export interface GenParams {
  w: number;
  h: number;
  density: number;
  maxLen: number;
  long: number;
  dep: number;
  pads: number;
  reeds: number;
  whirls: number;
  frogs: number;
  currents: number;
  /** An intro level must bring this twist. */
  need?: keyof typeof INTRO;
}

const lerp = (r: [number, number], t: number) => r[0] + (r[1] - r[0]) * t;
const count = (rng: Rng, v: number) => Math.floor(v) + (rng.chance(v - Math.floor(v)) ? 1 : 0);

export function paramsFor(n: number, rng: Rng): GenParams {
  const band = bandFor(n);
  const tag = tagFor(n);
  const t = Math.max(0, Math.min(1, bandProgress(n) + (rng.next() - 0.5) * 0.4));
  const tune = tag === "breather" ? -0.3 : tag === "tricky" ? 0.25 : tag === "dragon" ? 0.4 : 0;
  const tt = Math.max(0, Math.min(1, t + tune));
  const p: GenParams = {
    w: Math.round(lerp(band.w, tt)),
    h: Math.round(lerp(band.h, tt)),
    density: lerp(band.density, tt),
    maxLen: Math.round(lerp(band.maxLen, tt)),
    long: lerp(band.long, tt),
    dep: lerp(band.dep, tt),
    pads: count(rng, band.pads),
    reeds: rng.chance(0.65) ? band.reeds : 0,
    whirls: count(rng, band.whirls),
    frogs: count(rng, band.frogs),
    currents: count(rng, band.currents),
  };
  if (tag === "dragon") {
    p.w = Math.max(p.w, 8);
    p.h = Math.max(p.h, 12);
  }
  // Each special's intro level shows it alone (long koi stay once they've arrived).
  for (const [k, lv] of Object.entries(INTRO)) {
    if (n !== lv) continue;
    p.pads = k === "pads" ? 2 : 0;
    p.reeds = k === "reeds" ? 0.3 : 0;
    p.whirls = k === "whirls" ? 2 : 0;
    p.frogs = k === "frogs" ? 2 : 0;
    p.currents = k === "currents" ? 2 : 0;
    if (k === "long") p.long = Math.max(p.long, 0.5);
    p.need = k as keyof typeof INTRO;
  }
  return p;
}

// ---------------------------------------------------------------- difficulty

export interface Metrics {
  koi: number;
  cells: number;
  longShare: number;
  freeAtStart: number;
  depth: number;
  lookAlikes: number;
  specials: number;
}

export function difficultyScore(m: Metrics): number {
  return 0.15 * m.koi + 0.04 * m.cells + 1.2 * m.longShare + 3 / (1 + m.freeAtStart) + 0.6 * m.depth + 0.8 * Math.min(6, m.lookAlikes) + m.specials;
}

/** Target D for level n (DESIGN.md §5). */
export function targetD(n: number): number {
  return 3 + 14 * (1 - Math.exp(-n / 180));
}

export interface Built {
  def: LevelDef;
  metrics: Metrics;
}

// ---------------------------------------------------------------- one level

export function makeLevel(n: number, tag: LevelTag, p: GenParams, rng: Rng): Built | null {
  const { w, h } = p;
  const N = w * h;
  const def: LevelDef = { n, w, h, koi: [], sol: [], d: 0, tag };
  const reserved = new Set<number>();
  const free = () => [...Array(N).keys()].filter((c) => !reserved.has(c));
  // Twists first.
  const interior = (c: number) => c % w > 0 && c % w < w - 1 && Math.floor(c / w) > 0 && Math.floor(c / w) < h - 1;
  if (p.pads) {
    def.pads = rng.shuffle(free().filter(interior)).slice(0, p.pads);
    def.pads.forEach((c) => reserved.add(c));
  }
  if (p.frogs) {
    def.frogs = rng.shuffle(free().filter(interior)).slice(0, p.frogs).map((c) => [c, rng.int(2, 6)] as [number, number]);
    def.frogs.forEach(([c]) => reserved.add(c));
  }
  if (p.currents) {
    def.currents = rng.shuffle(free().filter(interior)).slice(0, p.currents).map((c) => [c, rng.int(0, 3) as Dir] as [number, Dir]);
    def.currents.forEach(([c]) => reserved.add(c));
  }
  const whirlCells = p.whirls ? rng.shuffle(free().filter(interior)).slice(0, p.whirls) : [];
  whirlCells.forEach((c) => reserved.add(c));
  if (whirlCells.length) def.whirls = whirlCells;
  if (p.reeds > 0) {
    const exits: number[] = [];
    for (let x = 0; x < w; x++) exits.push(x * 4 + 0, ((h - 1) * w + x) * 4 + 2);
    for (let y = 0; y < h; y++) exits.push(y * w * 4 + 3, (y * w + w - 1) * 4 + 1);
    // Reeds come in runs along the bank.
    const want = Math.round(exits.length * p.reeds);
    const set = new Set<number>();
    for (let guard = 0; set.size < want && guard < 50; guard++) {
      const start = rng.pick(exits);
      const runLen = rng.int(2, 4);
      const idx = exits.indexOf(start);
      for (let k = 0; k < runLen; k++) set.add(exits[(idx + k * 2) % exits.length]);
    }
    def.reeds = [...set].sort((a, b) => a - b);
  }

  // 1. Cut the open water (less a few holes) into random snake paths.
  const whirlSet = new Set(whirlCells);
  const water = free();
  const holeCount = Math.round(water.length * (1 - p.density));
  const holes = new Set(rng.shuffle(water.filter((c) => !whirlSet.has(c))).slice(0, holeCount));
  const owner = new Int16Array(N).fill(-1);
  const pieces: number[][] = [];
  const open = (c: number) => c >= 0 && owner[c] < 0 && !reserved.has(c) && !holes.has(c);
  for (const c of whirlCells) {
    owner[c] = pieces.length;
    pieces.push([c]);
  }
  for (const start of rng.shuffle(water.slice())) {
    if (!open(start)) continue;
    const long = rng.chance(p.long) && p.maxLen >= 3;
    const len = long ? rng.int(3, p.maxLen) : p.maxLen >= 2 && rng.chance(0.55) ? 2 : 1;
    const walk = [start];
    owner[start] = pieces.length;
    let dir = rng.int(0, 3) as Dir;
    let back: Dir = ((dir + 2) % 4) as Dir;
    for (let k = 1; k < len; k++) {
      // Grow at the head end; if that's boxed in, grow at the tail end instead.
      const opts = ([dir, ((dir + 1) % 4) as Dir, ((dir + 3) % 4) as Dir] as Dir[]).filter((dd) => open(step(def, walk[walk.length - 1], dd)));
      if (opts.length) {
        dir = opts.includes(dir) && rng.chance(0.62) ? dir : rng.pick(opts);
        const nx = step(def, walk[walk.length - 1], dir);
        owner[nx] = pieces.length;
        walk.push(nx);
        continue;
      }
      const bopts = ([back, ((back + 1) % 4) as Dir, ((back + 3) % 4) as Dir] as Dir[]).filter((dd) => open(step(def, walk[0], dd)));
      if (!bopts.length) break;
      back = bopts.includes(back) && rng.chance(0.62) ? back : rng.pick(bopts);
      const nx = step(def, walk[0], back);
      owner[nx] = pieces.length;
      walk.unshift(nx);
    }
    pieces.push(walk);
  }

  genStats.pieces += pieces.length;
  genStats.longPieces += pieces.filter((pc) => pc.length >= 3).length;
  // 2. Peel: repeatedly let out a koi that can leave now (choosing which end is its head), in order.
  const present = new Set(pieces.map((_, i) => i));
  const koi: KoiDef[] = [];
  const occ = new Int16Array(N).fill(-1);
  pieces.forEach((pc, i) => pc.forEach((c) => (occ[c] = i)));
  const vacated = new Uint8Array(N);
  const rayClear = (cells: number[], d: Dir, m: number, self: number): number[] | null => {
    let c = cells[0];
    let dir = d;
    const ray: number[] = [];
    const len = cells.length;
    for (let s2 = 1; s2 < N * 2; s2++) {
      const nx = step(def, c, dir);
      if (nx < 0) return def.reeds?.includes(c * 4 + dir) ? null : ray;
      if (def.pads?.includes(nx)) return null;
      const frog = def.frogs?.find(([fc]) => fc === nx);
      if (frog && m < frog[1]) return null;
      if (occ[nx] >= 0 && occ[nx] !== self) return null;
      const own = cells.indexOf(nx);
      if (own >= 0 && s2 <= len - 1 - own) return null;
      ray.push(nx);
      c = nx;
      const cur = def.currents?.find(([cc]) => cc === nx);
      if (cur) dir = cur[1];
      if (ray.length > N) return null;
    }
    return null;
  };
  for (let guard = 0; present.size && guard < 4000; guard++) {
    const m = koi.length;
    const options: Array<{ i: number; cells: number[]; d: Dir; start: Dir; score: number }> = [];
    /** Cells of koi already let out: a way out through them waits for those koi at the start. */
    const waits = (ray: number[]) => ray.filter((c) => vacated[c]).length;
    for (const i of present) {
      const pc = pieces[i];
      if (pc.length === 1) {
        for (const D of [0, 1, 2, 3] as Dir[]) {
          const ray = rayClear(pc, D, m, i);
          if (ray) options.push({ i, cells: pc, d: D, start: whirlSet.has(pc[0]) ? ((((D - m) % 4) + 4) % 4 as Dir) : D, score: waits(ray) });
        }
      } else {
        for (const cells of [pc.slice().reverse(), pc.slice()]) {
          const d = dirFrom(def, cells[1], cells[0]);
          const ray = rayClear(cells, d, m, i);
          if (ray) options.push({ i, cells, d, start: d, score: waits(ray) + 0.5 + cells.length * 0.8 });
        }
      }
    }
    if (!options.length) {
      // Stuck: split the longest koi still in the pond, and try again.
      const longest = [...present].sort((x, y) => pieces[y].length - pieces[x].length)[0];
      const pc = pieces[longest];
      if (pc.length < 2) return null;
      genStats.splits++;
      // Cut near the middle so both halves stay koi-sized.
      const cut = pc.length >= 4 ? rng.int(2, pc.length - 2) : rng.int(1, pc.length - 1);
      const tail = pc.slice(cut);
      pieces[longest] = pc.slice(0, cut);
      pieces.push(tail);
      for (const c of tail) occ[c] = pieces.length - 1;
      present.add(pieces.length - 1);
      continue;
    }
    // Several koi can leave: with the band's dependency bias, take the one whose way out runs
    // through the most cells of koi already let out (so at the start it has to wait for them).
    const o = rng.chance(p.dep) ? options.reduce((x, y) => (y.score + rng.next() * 0.5 > x.score ? y : x)) : rng.pick(options);
    koi.push({ c: o.cells, d: o.start });
    present.delete(o.i);
    for (const c of pieces[o.i]) {
      occ[c] = -1;
      vacated[c] = 1;
    }
  }
  if (present.size || koi.length < 3) return null;
  const covered = koi.reduce((a2, k) => a2 + k.c.length, 0);
  def.koi = koi;
  def.sol = koi.map((_, i) => i);
  if (def.whirls) def.whirls = def.whirls.filter((c) => koi.some((k) => k.c.length === 1 && k.c[0] === c));
  if (def.whirls && !def.whirls.length) delete def.whirls;

  // Replay with the real rules.
  const b = newBoard(def);
  for (const i of def.sol) {
    const r = tapKoi(b, i);
    if (!r || !r.ok) return null;
  }
  if (!isWon(b)) return null;
  const has = { pads: !!def.pads?.length, reeds: !!def.reeds?.length, long: koi.some((k) => k.c.length >= 3), whirls: !!def.whirls?.length, frogs: !!def.frogs?.length, currents: !!def.currents?.length };
  if (p.need && !has[p.need]) return null;
  // Whirlpools can strand a fry: make sure the greedy "any free koi" player isn't trapped too easily.
  if (def.whirls && !solveOrder(newBoard(def), 20000).order) return null;

  // Rate.
  const start = newBoard(def);
  const occ0 = occupancy(start);
  const freeAtStart = freeKoi(start).length;
  const depth = new Array(koi.length).fill(1);
  let lookAlikes = 0;
  koi.forEach((k, i) => {
    const res = trace(start, i, occ0);
    if (!res.ok && res.ray.length >= 2) lookAlikes++;
  });
  // Dependency depth: koi i waits for every earlier koi whose body lies on its way out at the start.
  for (let i = 0; i < koi.length; i++) {
    const b2 = newBoard(def);
    for (let j = 0; j < i; j++) b2.out[j] = true;
    const r2 = trace(b2, i);
    for (const c of r2.ray) {
      const j = occ0[c];
      if (j >= 0 && j < i) depth[i] = Math.max(depth[i], depth[j] + 1);
    }
  }
  const specials =
    0.3 * (def.pads?.length ?? 0) + (def.reeds?.length ? 0.8 : 0) + 1.0 * (def.whirls?.length ?? 0) + 0.8 * (def.frogs?.length ?? 0) + 0.9 * (def.currents?.length ?? 0);
  const metrics: Metrics = {
    koi: koi.length,
    cells: covered,
    longShare: koi.filter((k) => k.c.length >= 3).length / koi.length,
    freeAtStart,
    depth: Math.max(...depth),
    lookAlikes,
    specials,
  };
  def.d = Math.round(difficultyScore(metrics) * 100) / 100;
  return { def, metrics };
}

export function dirFrom(def: LevelDef, from: number, to: number): Dir {
  const dx = (to % def.w) - (from % def.w);
  const dy = Math.floor(to / def.w) - Math.floor(from / def.w);
  for (let d = 0; d < 4; d++) if (DX[d] === dx && DY[d] === dy) return d as Dir;
  return 0;
}

// ---------------------------------------------------------------- picking

function percentileFor(n: number, tag: LevelTag): number {
  if (Object.values(INTRO).includes(n)) return 0.1;
  if (tag === "breather") return 0.1;
  if (tag === "tricky") return 0.85;
  if (tag === "dragon") return 0.95;
  if (tag === "tutorial") return 0.3;
  return Math.max(0.05, Math.min(0.95, (n >= 60 ? 0.6 : 0.5) + chapterSlope(n)));
}

function pickFrom(rated: Built[], p: number): Built {
  rated.sort((a, b) => a.def.d - b.def.d);
  return rated[Math.min(rated.length - 1, Math.round(p * (rated.length - 1)))];
}

const FALLBACK: GenParams = { w: 5, h: 7, density: 0.5, maxLen: 2, long: 0, dep: 0.3, pads: 0, reeds: 0, whirls: 0, frogs: 0, currents: 0 };

export function generateLevel(n: number, opts: { candidates?: number } = {}): Built {
  const tag = tagFor(n);
  const rng = new Rng(seedOf(n, GENERATOR_VERSION));
  const want = opts.candidates ?? 6;
  const rated: Built[] = [];
  for (let attempts = 0; rated.length < want && attempts < want * 30; attempts++) {
    const built = makeLevel(n, tag, paramsFor(n, rng), rng);
    if (built) rated.push(built);
  }
  while (!rated.length) {
    const built = makeLevel(n, tag, FALLBACK, rng);
    if (built) rated.push(built);
  }
  return pickFrom(rated, percentileFor(n, tag));
}

/** Daily Pond: one mid-curve pond per UTC day, the same for everyone, with one twist. */
export function generateDaily(dayKey: string, opts: { candidates?: number } = {}): Built {
  const rng = new Rng(seedOf(dayKey, "koi-daily"));
  const want = opts.candidates ?? 5;
  const rated: Built[] = [];
  for (let attempts = 0; rated.length < want && attempts < want * 30; attempts++) {
    const p = paramsFor(119, rng);
    p.need = undefined;
    p.currents = 0;
    const built = makeLevel(0, "daily", p, rng);
    if (built) rated.push(built);
  }
  while (!rated.length) {
    const built = makeLevel(0, "daily", FALLBACK, rng);
    if (built) rated.push(built);
  }
  return pickFrom(rated, 0.6);
}
