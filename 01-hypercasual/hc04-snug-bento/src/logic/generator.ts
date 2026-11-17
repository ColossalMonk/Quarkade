// Snug Bento level generator, difficulty score and curve (DESIGN.md §5).
// Solvable by construction: make a box, cut its cells into food pieces, add the food rules so the
// cut itself obeys them, then hand the pieces over turned at random. The solver rates the result.

import { Rng, seedOf } from "../../../../forge/src/core/rng.ts";
import type { Cell, LevelDef, LevelTag, PieceDef, Placement } from "./rules.ts";
import { TEMP_COLD, TEMP_HOT, TEMP_NONE, newBoard, rotations, shapeKey } from "./rules.ts";
import { solve } from "./solver.ts";

export const GENERATOR_VERSION = "snug-v1";

/** Where each special first appears, alone, in an easier level with a tip. */
export const INTRO = { garnish: 12, dividers: 15, oddBox: 25, soft: 45, hotCold: 61, sauce: 91 };

// ---------- rhythm ----------

export function tagFor(n: number): LevelTag {
  if (n <= 20) return "tutorial";
  if (n >= 150 && n % 50 === 0) return "masterpiece";
  if (n % 10 === 0) return "tricky";
  if (n % 5 === 0) return "breather";
  return "normal";
}

function chapterSlope(n: number): number {
  return -0.2 + (((n - 21) % 10) / 9) * 0.3;
}

// ---------- bands ----------

export interface Band {
  pieces: [number, number];
  maxSize: number;
  garnish: number;
  dividers: number;
  odd: number;
  soft: number;
  hotCold: number;
  sauce: number;
}

export function bandFor(n: number): Band {
  const on = (k: keyof typeof INTRO, v: number) => (n >= INTRO[k] ? v : 0);
  if (n <= 20) return { pieces: [3, 7], maxSize: 4, garnish: on("garnish", 1), dividers: on("dividers", 1), odd: 0, soft: 0, hotCold: 0, sauce: 0 };
  if (n <= 44) return { pieces: [6, 9], maxSize: 5, garnish: 1, dividers: 1, odd: on("oddBox", 0.4), soft: 0, hotCold: 0, sauce: 0 };
  if (n <= 89) return { pieces: [7, 11], maxSize: 5, garnish: 2, dividers: 2, odd: 0.45, soft: on("soft", 1), hotCold: on("hotCold", 0.6), sauce: 0 };
  if (n <= 200) return { pieces: [9, 13], maxSize: 6, garnish: 2, dividers: 2, odd: 0.5, soft: 1, hotCold: 0.6, sauce: on("sauce", 0.5) };
  if (n <= 400) return { pieces: [10, 15], maxSize: 6, garnish: 2, dividers: 3, odd: 0.5, soft: 2, hotCold: 0.7, sauce: 0.6 };
  return { pieces: [8, 16], maxSize: 6, garnish: 2, dividers: 3, odd: 0.5, soft: 2, hotCold: 0.7, sauce: 0.6 };
}

function bandProgress(n: number): number {
  const edges = [1, 21, 45, 90, 201, 401, 1000];
  for (let i = 0; i < edges.length - 1; i++) if (n < edges[i + 1]) return (n - edges[i]) / (edges[i + 1] - edges[i]);
  return 0.5;
}

// ---------- parameters ----------

export interface GenParams {
  pieces: number;
  maxSize: number;
  /** Box shape: "rect", "L", "round", "heart", "tier". */
  box: string;
  garnish: number;
  dividers: number;
  soft: number;
  hotCold: boolean;
  sauce: number;
}

export function paramsFor(n: number, rng: Rng): GenParams {
  const band = bandFor(n);
  const tag = tagFor(n);
  const t = Math.max(0, Math.min(1, bandProgress(n) + (rng.next() - 0.5) * 0.4));
  const tune = tag === "breather" ? -0.3 : tag === "tricky" ? 0.25 : tag === "masterpiece" ? 0.4 : 0;
  const tt = Math.max(0, Math.min(1, t + tune));
  const odd = rng.chance(band.odd);
  const p: GenParams = {
    pieces: Math.round(band.pieces[0] + (band.pieces[1] - band.pieces[0]) * tt),
    maxSize: band.maxSize,
    box: tag === "masterpiece" ? "tier" : odd ? rng.pick(["L", "round", "heart", "tier"]) : "rect",
    garnish: rng.int(0, band.garnish),
    dividers: rng.int(0, band.dividers),
    soft: rng.int(0, band.soft),
    hotCold: rng.chance(band.hotCold),
    sauce: rng.chance(band.sauce) ? 1 : 0,
  };
  if (tag === "breather") {
    p.hotCold = false;
    p.sauce = 0;
  }
  // Introductions: the new thing on its own, in an easier level.
  const intro = (Object.entries(INTRO) as Array<[keyof typeof INTRO, number]>).find(([, lv]) => lv === n)?.[0];
  if (intro) {
    Object.assign(p, { pieces: 6, maxSize: 4, box: "rect", garnish: 0, dividers: 0, soft: 0, hotCold: false, sauce: 0 });
    if (intro === "garnish") p.garnish = 1;
    if (intro === "dividers") p.dividers = 1;
    if (intro === "oddBox") p.box = "L";
    if (intro === "soft") p.soft = 1;
    if (intro === "hotCold") Object.assign(p, { hotCold: true, pieces: 7 });
    if (intro === "sauce") Object.assign(p, { sauce: 1, pieces: 7 });
  }
  return p;
}

// ---------- the box ----------

/** Pick box dimensions for about `cells` cells (portrait-friendly: never wider than tall + 1). */
function boxSize(cells: number, rng: Rng): [number, number] {
  let best: [number, number] = [3, 3];
  let bestScore = Infinity;
  for (let w = 2; w <= 8; w++) {
    for (let h = 2; h <= 9; h++) {
      if (w > h + 1) continue;
      const score = Math.abs(w * h - cells) + Math.abs(h - w * 1.15) * 0.6 + rng.next() * 1.2;
      if (score < bestScore) {
        bestScore = score;
        best = [w, h];
      }
    }
  }
  return best;
}

function makeMask(w: number, h: number, kind: string, rng: Rng): string[] {
  const m: string[] = new Array(w * h).fill(".");
  const off = (x: number, y: number) => (m[y * w + x] = " ");
  if (kind === "L" && w >= 3 && h >= 3) {
    const cw = rng.int(1, Math.max(1, Math.floor(w / 2)));
    const ch = rng.int(1, Math.max(1, Math.floor(h / 2)));
    const right = rng.chance(0.5);
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) off(right ? w - 1 - x : x, y);
  } else if (kind === "round" && w >= 3 && h >= 3) {
    off(0, 0);
    off(w - 1, 0);
    off(0, h - 1);
    off(w - 1, h - 1);
  } else if (kind === "heart" && w >= 4 && h >= 4) {
    // Two bumps on top, a point at the bottom.
    off(Math.floor(w / 2), 0);
    if (w % 2 === 0) off(Math.floor(w / 2) - 1, 0);
    off(0, 0);
    off(w - 1, 0);
    for (let y = h - 1, k = 0; y >= h - Math.ceil(w / 2) + 1 && k < w / 2; y--, k++) {
      for (let x = 0; x <= k; x++) {
        off(x, y);
        off(w - 1 - x, y);
      }
    }
  }
  return m;
}

/** Pick a random divider: a straight wall along a grid line, part or all of the way across. */
function addDivider(w: number, h: number, mask: string[], walls: Set<number>, rng: Rng, full: boolean): void {
  const horizontal = rng.chance(0.5) ? h > 3 : w <= 3;
  if (horizontal) {
    const y = rng.int(1, h - 2);
    const len = full ? w : rng.int(2, Math.max(2, w - 1));
    const x0 = full ? 0 : rng.int(0, w - len);
    for (let x = x0; x < x0 + len; x++) if (mask[y * w + x] !== " " && mask[(y + 1) * w + x] !== " ") walls.add((y * w + x) * 2 + 1);
  } else {
    const x = rng.int(0, w - 2);
    const len = full ? h : rng.int(2, Math.max(2, h - 1));
    const y0 = full ? 0 : rng.int(0, h - len);
    for (let y = y0; y < y0 + len; y++) if (mask[y * w + x] !== " " && mask[y * w + x + 1] !== " ") walls.add((y * w + x) * 2);
  }
}

// ---------- cutting into pieces ----------

function wallBetween(w: number, walls: Set<number>, a: number, b: number): boolean {
  const [lo, hi] = a < b ? [a, b] : [b, a];
  return hi - lo === 1 ? walls.has(lo * 2) : walls.has(lo * 2 + 1);
}

/** Cut the free cells into connected pieces of 1..maxSize cells. */
function partition(w: number, h: number, mask: string[], walls: Set<number>, target: number, maxSize: number, rng: Rng): number[][] {
  const free = new Set<number>();
  mask.forEach((ch, i) => ch === "." && free.add(i));
  const total = free.size;
  const avg = Math.max(1.5, total / target);
  const nb = (c: number) => {
    const x = c % w;
    const out: number[] = [];
    if (x > 0) out.push(c - 1);
    if (x < w - 1) out.push(c + 1);
    if (c - w >= 0) out.push(c - w);
    if (c + w < w * h) out.push(c + w);
    return out.filter((n) => free.has(n) && !wallBetween(w, walls, c, n));
  };
  /** May cell c join this piece? Not if a divider would run between it and any of its cells. */
  const joins = (piece: number[], c: number) => piece.every((p) => !(Math.abs(p - c) === 1 || Math.abs(p - c) === w) || !wallBetween(w, walls, p, c));
  const pieces: number[][] = [];
  while (free.size) {
    // Start where cells are most boxed in, so no lonely cells get stranded.
    let start = -1;
    let fewest = 9;
    for (const c of free) {
      const k = nb(c).length + rng.next() * 0.9;
      if (k < fewest) {
        fewest = k;
        start = c;
      }
    }
    const size = Math.max(1, Math.min(maxSize, Math.round(avg + (rng.next() - 0.5) * 2.6)));
    const piece = [start];
    free.delete(start);
    while (piece.length < size) {
      const frontier = [...new Set(piece.flatMap(nb))].filter((c) => joins(piece, c));
      if (!frontier.length) break;
      const c = rng.pick(frontier);
      piece.push(c);
      free.delete(c);
    }
    pieces.push(piece);
  }
  // Merge most single cells into a neighbour (keep up to two: tomatoes and sauce cups).
  const owner = new Map<number, number>();
  pieces.forEach((pc, i) => pc.forEach((c) => owner.set(c, i)));
  const near = (c: number) => {
    const x = c % w;
    return [x > 0 ? c - 1 : -1, x < w - 1 ? c + 1 : -1, c - w, c + w].filter((n) => n >= 0 && n < w * h && owner.has(n) && !wallBetween(w, walls, c, n));
  };
  let singles = pieces.filter((pc) => pc.length === 1).length;
  for (let i = 0; i < pieces.length && singles > 2; i++) {
    if (pieces[i].length !== 1) continue;
    const c = pieces[i][0];
    const into = near(c).map((n) => owner.get(n)!).filter((j) => j !== i && pieces[j].length < maxSize && joins(pieces[j], c));
    if (!into.length) continue;
    const j = rng.pick(into);
    pieces[j].push(c);
    owner.set(c, j);
    pieces[i] = [];
    singles--;
  }
  return pieces.filter((pc) => pc.length);
}

// ---------- soft shapes ----------

const POLY: Record<number, Cell[][]> = {
  2: [[[0, 0], [1, 0]]],
  3: [
    [[0, 0], [1, 0], [2, 0]],
    [[0, 0], [1, 0], [0, 1]],
  ],
  4: [
    [[0, 0], [1, 0], [2, 0], [3, 0]],
    [[0, 0], [1, 0], [0, 1], [1, 1]],
    [[0, 0], [1, 0], [2, 0], [0, 1]],
    [[0, 0], [1, 0], [2, 0], [1, 1]],
    [[1, 0], [2, 0], [0, 1], [1, 1]],
  ],
};

function classKey(cells: Cell[]): string {
  return rotations(cells).map(shapeKey).sort()[0];
}

// ---------- metrics ----------

export interface Metrics {
  pieces: number;
  cells: number;
  bigShapes: number;
  solutions: number;
  nodes: number;
  specials: number;
}

export function difficultyScore(m: Metrics): number {
  // Fewer solutions = harder: 1 solution scores +4.6, 200 scores 0.
  return 0.6 * m.pieces + 0.04 * m.cells + 1.5 * m.bigShapes + 2 * (2.3 - Math.log10(Math.max(1, m.solutions))) + 2 * Math.log10(1 + m.nodes / 100) + 1.0 * m.specials;
}

export interface Built {
  def: LevelDef;
  metrics: Metrics;
}

export function makeLevel(n: number, tag: LevelTag, p: GenParams, rng: Rng): Built | null {
  const avgSize = Math.min(p.maxSize, 3.4 + (p.maxSize - 4) * 0.3);
  const cellsWanted = Math.round(p.pieces * avgSize) + p.garnish;
  const [w, h] = boxSize(cellsWanted, rng);
  const mask = makeMask(w, h, p.box, rng);
  const walls = new Set<number>();
  if (p.box === "tier" && h >= 4) addDivider(w, h, mask, walls, rng, true);
  for (let d = 0; d < p.dividers; d++) addDivider(w, h, mask, walls, rng, false);
  // Garnish: fixed cells (never on a divider's end, never isolating a cell).
  const freeCells = mask.map((ch, i) => (ch === "." ? i : -1)).filter((i) => i >= 0);
  for (let g = 0; g < p.garnish; g++) mask[rng.pick(freeCells)] = "g";
  const parts = partition(w, h, mask, walls, p.pieces, p.maxSize, rng);
  if (parts.length < 2) return null;
  // A sauce cup needs a one-cell piece: split a leaf cell off a bigger piece if there is none.
  for (let s = 0; s < p.sauce && !parts.some((pc) => pc.length === 1); s++) {
    for (const pc of rng.shuffle(parts.filter((q) => q.length >= 3))) {
      const leaf = pc.find((c) => {
        const rest = pc.filter((x) => x !== c);
        // The rest must stay connected.
        const seen = new Set([rest[0]]);
        const stack = [rest[0]];
        while (stack.length) {
          const a = stack.pop()!;
          for (const b of rest) if (!seen.has(b) && (Math.abs(a - b) === w || (Math.abs(a - b) === 1 && Math.floor(a / w) === Math.floor(b / w)))) {
            seen.add(b);
            stack.push(b);
          }
        }
        return seen.size === rest.length;
      });
      if (leaf === undefined) continue;
      pc.splice(pc.indexOf(leaf), 1);
      parts.push([leaf]);
      break;
    }
  }
  if (Math.abs(parts.length - p.pieces) > 3) return null;

  // Pieces (turned at random for the tray) and the known solution.
  const pieces: PieceDef[] = [];
  const sol: Placement[] = [];
  for (const cells of parts) {
    const abs: Cell[] = cells.map((c) => [c % w, Math.floor(c / w)] as Cell);
    const mx = Math.min(...abs.map((c) => c[0]));
    const my = Math.min(...abs.map((c) => c[1]));
    const r = rng.int(0, 3);
    pieces.push({ c: rotations(abs)[r], t: TEMP_NONE });
    sol.push({ s: 0, r: (4 - r) % 4, x: mx, y: my });
  }
  // Soft foods: a 3- or 4-cell piece also gets a different shape of the same size.
  const softCands = rng.shuffle(pieces.map((_, i) => i).filter((i) => pieces[i].c.length === 3 || pieces[i].c.length === 4));
  for (let s = 0; s < p.soft && s < softCands.length; s++) {
    const pc = pieces[softCands[s]];
    const mine = classKey(pc.c);
    const alts = POLY[pc.c.length].filter((a) => classKey(a) !== mine);
    if (alts.length) pc.s = rng.pick(alts).map((c) => [...c] as Cell);
  }
  // Neighbours in the cut (for hot/cold and sauce).
  const ownerOf = new Map<number, number>();
  parts.forEach((cells, i) => cells.forEach((c) => ownerOf.set(c, i)));
  const adj = parts.map((cells, i) => {
    const out = new Set<number>();
    for (const c of cells) {
      const x = c % w;
      for (const nb of [x > 0 ? c - 1 : -1, x < w - 1 ? c + 1 : -1, c - w, c + w]) {
        const o = ownerOf.get(nb);
        if (o !== undefined && o !== i) out.add(o);
      }
    }
    return out;
  });
  // Sauce: a one-cell piece next to a bigger one.
  for (let s = 0; s < p.sauce; s++) {
    const cands = rng.shuffle(pieces.map((_, i) => i).filter((i) => pieces[i].c.length === 1 && pieces[i].sauce === undefined && !pieces[i].s));
    for (const i of cands) {
      const targets = [...adj[i]].filter((j) => pieces[j].c.length >= 2 && pieces[j].sauce === undefined);
      if (!targets.length) continue;
      pieces[i].sauce = rng.pick(targets);
      break;
    }
  }
  // Hot and cold: never touching in the cut.
  if (p.hotCold) {
    const free = pieces.map((_, i) => i).filter((i) => pieces[i].sauce === undefined && pieces[i].c.length >= 2);
    const hot = rng.shuffle(free.slice()).slice(0, rng.int(1, 3));
    hot.forEach((i) => (pieces[i].t = TEMP_HOT));
    const coldCands = rng.shuffle(free.filter((i) => !hot.includes(i) && !hot.some((hh) => adj[i].has(hh))));
    coldCands.slice(0, rng.int(1, 3)).forEach((i) => (pieces[i].t = TEMP_COLD));
    if (!pieces.some((q) => q.t === TEMP_COLD)) return null;
  }

  const def: LevelDef = { n, w, h, mask: mask.join(""), walls: [...walls].sort((a, b) => a - b), pieces, sol, par: pieces.length, d: 0, tag };
  const res = solve(newBoard(def), { maxSolutions: 200, maxNodes: 80000 });
  if (!res.count) return null;
  const specials =
    0.3 * mask.filter((c) => c === "g").length +
    0.4 * Math.min(3, walls.size / 3) +
    (p.box !== "rect" ? 0.5 : 0) +
    1.0 * pieces.filter((q) => q.s).length +
    1.2 * (pieces.some((q) => q.t === TEMP_HOT) ? 1 : 0) +
    1.0 * pieces.filter((q) => q.sauce !== undefined).length;
  const metrics: Metrics = {
    pieces: pieces.length,
    cells: freeCells.length,
    bigShapes: pieces.filter((q) => q.c.length >= 5).length,
    solutions: res.exhausted ? Math.max(res.count, 200) : res.count,
    nodes: res.nodes,
    specials,
  };
  def.d = Math.round(difficultyScore(metrics) * 100) / 100;
  return { def, metrics };
}

function percentileFor(n: number, tag: LevelTag): number {
  if (Object.values(INTRO).includes(n)) return 0.1;
  if (tag === "breather") return 0.1;
  if (tag === "tricky") return 0.85;
  if (tag === "masterpiece") return 0.95;
  if (tag === "tutorial") return 0.3;
  return Math.max(0.05, Math.min(0.95, (n >= 60 ? 0.6 : 0.5) + chapterSlope(n)));
}

function pickFrom(rated: Built[], p: number): Built {
  rated.sort((a, b) => a.def.d - b.def.d);
  return rated[Math.min(rated.length - 1, Math.round(p * (rated.length - 1)))];
}

export function generateLevel(n: number, opts: { candidates?: number } = {}): Built {
  const tag = tagFor(n);
  const rng = new Rng(seedOf(n, GENERATOR_VERSION));
  const want = opts.candidates ?? 6;
  const rated: Built[] = [];
  for (let attempts = 0; rated.length < want && attempts < want * 20; attempts++) {
    const built = makeLevel(n, tag, paramsFor(n, rng), rng);
    if (built) rated.push(built);
  }
  while (!rated.length) {
    const built = makeLevel(n, tag, { pieces: 5, maxSize: 4, box: "rect", garnish: 0, dividers: 0, soft: 0, hotCold: false, sauce: 0 }, rng);
    if (built) rated.push(built);
  }
  return pickFrom(rated, percentileFor(n, tag));
}

/** Daily Bento: one mid-curve box per UTC day, the same for everyone, with one twist. */
export function generateDaily(dayKey: string, opts: { candidates?: number } = {}): Built {
  const rng = new Rng(seedOf(dayKey, "snug-daily"));
  const want = opts.candidates ?? 6;
  const rated: Built[] = [];
  for (let attempts = 0; rated.length < want && attempts < want * 20; attempts++) {
    const p = paramsFor(120, rng);
    p.soft = 0;
    p.sauce = 0;
    const built = makeLevel(0, "daily", p, rng);
    if (built) rated.push(built);
  }
  return pickFrom(rated, 0.6);
}
