// Unbolted level generator, difficulty score and curve (DESIGN.md §5).
// Solvable by construction: lay out plates, walk a valid removal order with the real rules, give
// bolts their colours along that order, then build the box queue from it. The same code runs
// offline (tools/build-packs.ts) and in the game's worker past the packs.

import { Rng, seedOf } from "../../../../forge/src/core/rng.ts";
import { SHAPES, shapeInfo, toWorld, plateSdf } from "./shapes.ts";
import type { BoltRow, ChainRow, LevelDef, LevelTag, PinRow, PlateRow } from "./rules.ts";
import { BOARD_H, BOARD_W, BOX_SIZE, basePose, cloneBoard, isCovered, isFree, legalMoves, newBoard, routeFor, settle, tap, isWon } from "./rules.ts";
import { solve } from "./solver.ts";

export const GENERATOR_VERSION = "unb-v1";

/** Where each special first appears, alone, in an easier level with a tip. */
export const INTRO = { hinge: 12, rusty: 15, glass: 31, padlock: 45, chain: 61, long: 91 };

// ---------- rhythm ----------

export function tagFor(n: number): LevelTag {
  if (n <= 20) return "tutorial";
  if (n >= 150 && n % 50 === 0) return "masterpiece";
  if (n % 10 === 0) return "tricky";
  if (n % 5 === 0) return "breather";
  return "normal";
}

/** Gadget chapters are about 10 levels: easy start, climbing. -0.2..+0.1 */
function chapterSlope(n: number): number {
  return -0.2 + (((n - 21) % 10) / 9) * 0.3;
}

// ---------- bands ----------

export interface Band {
  plates: [number, number];
  layers: [number, number];
  bolts: [number, number];
  colours: [number, number];
  mismatch: [number, number];
  rusty: number;
  hinges: number;
  glass: number;
  locks: number;
  chains: number;
  longs: number;
}

export function bandFor(n: number): Band {
  const on = (key: keyof typeof INTRO, v: number) => (n >= INTRO[key] ? v : 0);
  if (n <= 20) return { plates: [3, 5], layers: [2, 3], bolts: [9, 15], colours: [3, 4], mismatch: [0.1, 0.25], rusty: on("rusty", 1), hinges: on("hinge", 1), glass: 0, locks: 0, chains: 0, longs: 0 };
  if (n <= 44) return { plates: [5, 7], layers: [2, 4], bolts: [18, 27], colours: [4, 6], mismatch: [0.3, 0.5], rusty: on("rusty", 2), hinges: 1, glass: on("glass", 1), locks: 0, chains: 0, longs: 0 };
  if (n <= 89) return { plates: [6, 8], layers: [3, 4], bolts: [24, 33], colours: [5, 6], mismatch: [0.35, 0.6], rusty: 3, hinges: 1, glass: 1, locks: 1, chains: on("chain", 1), longs: 0 };
  if (n <= 200) return { plates: [7, 10], layers: [3, 5], bolts: [27, 39], colours: [5, 7], mismatch: [0.4, 0.65], rusty: 4, hinges: 2, glass: 2, locks: 2, chains: 1, longs: on("long", 1) };
  if (n <= 400) return { plates: [8, 11], layers: [4, 6], bolts: [30, 42], colours: [6, 8], mismatch: [0.45, 0.7], rusty: 4, hinges: 2, glass: 2, locks: 2, chains: 1, longs: 1 };
  return { plates: [7, 12], layers: [3, 6], bolts: [27, 45], colours: [5, 8], mismatch: [0.4, 0.7], rusty: 4, hinges: 2, glass: 2, locks: 2, chains: 1, longs: 1 };
}

function bandProgress(n: number): number {
  const edges = [1, 21, 45, 90, 201, 401, 1000];
  for (let i = 0; i < edges.length - 1; i++) if (n < edges[i + 1]) return (n - edges[i]) / (edges[i + 1] - edges[i]);
  return 0.5;
}

const lerp = (r: [number, number], t: number) => r[0] + (r[1] - r[0]) * t;

// ---------- metrics ----------

export interface Metrics {
  bolts: number;
  layers: number;
  coveredShare: number;
  swingTraps: number;
  mismatch: number;
  tray: number;
  specials: number;
  deadEndRate: number;
  par: number;
  /** Full-information minimum detours (for reports), -1 if not computed. */
  optimal?: number;
}

export function difficultyScore(m: Metrics): number {
  return (
    0.25 * m.bolts +
    1.2 * m.layers +
    4.0 * m.coveredShare +
    1.5 * m.swingTraps +
    1.0 * m.mismatch +
    2.5 * (5 - m.tray) +
    1.0 * m.specials +
    6.0 * m.deadEndRate +
    0.6 * m.par
  );
}

export function deadEndRate(def: LevelDef, rng: Rng, playouts = 30): number {
  let stuck = 0;
  for (let p = 0; p < playouts; p++) {
    const b = newBoard(def);
    for (let step = 0; step < 200; step++) {
      if (isWon(b)) break;
      const moves = legalMoves(b);
      if (!moves.length) {
        stuck++;
        break;
      }
      tap(b, rng.pick(moves));
    }
  }
  return stuck / playouts;
}

// ---------- parameters ----------

export interface GenParams {
  plates: number;
  layers: number;
  bolts: number;
  colours: number;
  mismatch: number;
  tray: number;
  rusty: number;
  hinges: number;
  glass: number;
  locks: number;
  chains: number;
  longs: number;
}

export function paramsFor(n: number, rng: Rng): GenParams {
  const band = bandFor(n);
  const tag = tagFor(n);
  const t = Math.max(0, Math.min(1, bandProgress(n) + (rng.next() - 0.5) * 0.4));
  const tune = tag === "breather" ? -0.25 : tag === "tricky" ? 0.2 : tag === "masterpiece" ? 0.35 : 0;
  const tt = Math.max(0, Math.min(1, t + tune));
  const p: GenParams = {
    plates: Math.round(lerp(band.plates, tt)),
    layers: Math.round(lerp(band.layers, tt)),
    bolts: Math.round(lerp(band.bolts, tt) / 3) * 3,
    colours: Math.round(lerp(band.colours, tt)),
    mismatch: lerp(band.mismatch, tt),
    tray: (tag === "tricky" && n >= 60) || (tag === "masterpiece" && rng.chance(0.5)) || (tag === "normal" && n >= 250 && rng.chance(0.3)) ? 4 : 5,
    rusty: rng.int(0, band.rusty),
    hinges: rng.int(0, band.hinges),
    glass: rng.int(0, band.glass),
    locks: rng.int(0, band.locks),
    chains: rng.int(0, band.chains),
    longs: rng.int(0, band.longs),
  };
  if (tag === "breather") {
    p.locks = Math.min(p.locks, 1);
    p.chains = 0;
  }
  // Introductions: the new thing on its own, in an easier level.
  const intro = (Object.entries(INTRO) as Array<[keyof typeof INTRO, number]>).find(([, lv]) => lv === n)?.[0];
  if (intro) {
    Object.assign(p, { plates: 5, layers: 3, bolts: 15, colours: 4, mismatch: 0.15, tray: 5, rusty: 0, hinges: 0, glass: 0, locks: 0, chains: 0, longs: 0 });
    if (intro === "hinge") p.hinges = 1;
    if (intro === "rusty") p.rusty = 3;
    if (intro === "glass") p.glass = 2;
    if (intro === "padlock") p.locks = 1;
    if (intro === "chain") p.chains = 1;
    if (intro === "long") p.longs = 1;
  }
  return p;
}

// ---------- layout ----------

interface Layout {
  plates: PlateRow[];
  bolts: BoltRow[];
  pins: PinRow[];
  chains: ChainRow[];
}

/** Shape weights: bars and boxes are the staples, odd shapes for variety. */
const SHAPE_WEIGHTS = [3, 4, 2, 3, 3, 1.5, 2, 1.5, 1.5, 1, 1, 1.5];

function pickShape(rng: Rng): number {
  const total = SHAPE_WEIGHTS.reduce((a, b) => a + b, 0);
  let r = rng.next() * total;
  for (let i = 0; i < SHAPE_WEIGHTS.length; i++) if ((r -= SHAPE_WEIGHTS[i]) < 0) return i;
  return 0;
}

function holeWorld(row: PlateRow, h: number): [number, number] {
  const [lx, ly] = SHAPES[row[0]].holes[h];
  const w = toWorld(basePose(row), lx, ly);
  return [Math.round(w[0]), Math.round(w[1])];
}

function inBoard(row: PlateRow): boolean {
  const s = SHAPES[row[0]];
  for (let h = 0; h < s.holes.length; h++) {
    const [x, y] = holeWorld(row, h);
    if (x < 0 || x > BOARD_W - 1 || y < 0 || y > BOARD_H - 1) return false;
  }
  return true;
}

/** Does plate `a` overlap plate `b` (sampled)? */
function overlaps(a: PlateRow, b: PlateRow): boolean {
  const pa = basePose(a);
  const pb = basePose(b);
  for (const [lx, ly] of shapeInfo(a[0]).samples) {
    const [wx, wy] = toWorld(pa, lx, ly);
    if (plateSdf(b[0], pb, wx, wy) < -0.05) return true;
  }
  return false;
}

/** World points of a plate's holes (rounded to the grid). */
function holePoints(row: PlateRow): Array<[number, number]> {
  return SHAPES[row[0]].holes.map((_, h) => holeWorld(row, h));
}

export function makeLayout(p: GenParams, rng: Rng): Layout | null {
  // Plates go down bottom layer first, and each plate gets its bolts as soon as it is placed,
  // so upper plates can be aimed at bolts below them. That is what makes the layers matter.
  const plates: PlateRow[] = [];
  const bolts: BoltRow[] = [];
  const pins: PinRow[] = [];
  const used = new Set<string>(); // grid points taken by a fixing
  const holesFree: number[][] = [];
  const perLayer: number[] = [];
  for (let i = 0; i < p.plates; i++) perLayer.push(Math.min(p.layers - 1, Math.floor((i * p.layers) / p.plates)));
  let boltsLeft = p.bolts;
  for (let i = 0; i < p.plates; i++) {
    const layer = perLayer[i];
    const platesLeft = p.plates - i;
    const want = Math.max(1, Math.round(boltsLeft / platesLeft + (rng.next() - 0.5)));
    let best: { row: PlateRow; score: number } | null = null;
    for (let attempt = 0; attempt < 90; attempt++) {
      const row: PlateRow = [pickShape(rng), rng.int(0, BOARD_W - 1), rng.int(0, BOARD_H - 1), rng.int(0, 3), layer, 0, -1];
      if (!inBoard(row)) continue;
      if (plates.some((q) => q[4] === layer && overlaps(row, q))) continue;
      const free = holePoints(row).filter((w) => !used.has(w.join(","))).length;
      if (free < Math.min(want, SHAPES[row[0]].holes.length)) continue;
      // How many existing bolts would this plate cover?
      const pose = basePose(row);
      let covers = 0;
      for (const b of bolts) {
        const [bx, by] = holeWorld(plates[b[0]], b[1]);
        if (plateSdf(row[0], pose, bx, by) < 0.15) covers++;
      }
      // Aim for 1-4 covered bolts on upper layers, with a little randomness.
      const target = layer === 0 ? 0 : 3.5 + layer * 0.9;
      const score = -Math.abs(covers - target) + rng.next() * 0.8 + (layer > 0 && covers === 0 ? -3 : 0);
      if (!best || score > best.score) best = { row, score };
    }
    if (!best) continue;
    const row = best.row;
    const pi = plates.length;
    plates.push(row);
    const free = SHAPES[row[0]].holes.map((_, h) => h);
    holesFree.push(free);
    // A hinge pin on some plates, then the bolts.
    if (pins.length < p.hinges && free.length >= 3 && rng.chance(0.5)) {
      const h = rng.pick(free.filter((x) => !used.has(holeWorld(row, x).join(","))));
      if (h !== undefined) {
        pins.push([pi, h]);
        used.add(holeWorld(row, h).join(","));
        holesFree[pi] = holesFree[pi].filter((x) => x !== h);
      }
    }
    const count = Math.min(want, 4, holesFree[pi].length);
    let placed = 0;
    for (const h of rng.shuffle(holesFree[pi].slice())) {
      if (placed >= count) break;
      const k = holeWorld(row, h).join(",");
      if (used.has(k)) continue;
      used.add(k);
      bolts.push([pi, h, 0, 0, -1, -1]);
      holesFree[pi] = holesFree[pi].filter((x) => x !== h);
      placed++;
    }
    if (!placed) {
      plates.pop();
      holesFree.pop();
      continue;
    }
    boltsLeft -= placed;
  }
  if (plates.length < Math.max(2, p.plates - 2)) return null;

  // Long bolts: a free hole on a lower plate right under an existing bolt of a higher plate.
  for (let l = 0; l < p.longs; l++) {
    const cands: Array<[number, number, number]> = [];
    bolts.forEach((b, bi) => {
      if (b[4] >= 0) return;
      const at = holeWorld(plates[b[0]], b[1]);
      plates.forEach((row, pj) => {
        if (pj === b[0] || row[4] >= plates[b[0]][4]) return;
        for (const h of holesFree[pj]) {
          const w = holeWorld(row, h);
          if (w[0] === at[0] && w[1] === at[1]) cands.push([bi, pj, h]);
        }
      });
    });
    if (!cands.length) break;
    const [bi, pj, h] = rng.pick(cands);
    bolts[bi][4] = pj;
    bolts[bi][5] = h;
    holesFree[pj] = holesFree[pj].filter((x) => x !== h);
  }

  // Total bolts must fill whole boxes.
  while (bolts.length % BOX_SIZE !== 0) {
    const removable = bolts.map((b, i) => i).filter((i) => bolts[i][4] < 0 && bolts.filter((b) => b[0] === bolts[i][0]).length > 1);
    if (!removable.length) return null;
    bolts.splice(rng.pick(removable), 1);
  }

  // Chains: two plates on different layers with free holes close together.
  const chains: ChainRow[] = [];
  for (let c = 0; c < p.chains; c++) {
    const cands: ChainRow[] = [];
    for (let a = 0; a < plates.length; a++) {
      for (let b2 = 0; b2 < plates.length; b2++) {
        if (a === b2 || plates[a][4] <= plates[b2][4]) continue;
        if (chains.some((ch) => ch.includes(a) || ch.includes(b2))) continue;
        for (const ha of holesFree[a]) {
          for (const hb of holesFree[b2]) {
            const wa = holeWorld(plates[a], ha);
            const wb = holeWorld(plates[b2], hb);
            const d = Math.hypot(wa[0] - wb[0], wa[1] - wb[1]);
            if (d >= 1 && d <= 2.3) cands.push([a, ha, b2, hb]);
          }
        }
      }
    }
    if (!cands.length) break;
    const ch = rng.pick(cands);
    chains.push(ch);
    holesFree[ch[0]] = holesFree[ch[0]].filter((x) => x !== ch[1]);
    holesFree[ch[2]] = holesFree[ch[2]].filter((x) => x !== ch[3]);
  }

  // Glass: on upper plates, where seeing through matters.
  const upper = rng.shuffle(plates.map((_, i) => i).filter((i) => plates[i][4] > 0));
  for (let g = 0; g < p.glass && g < upper.length; g++) plates[upper[g]][5] |= 1;

  return { plates, bolts, pins, chains };
}

// ---------- walk + colours ----------

interface Built {
  def: LevelDef;
  metrics: Metrics;
}

/** Walk a valid removal order (geometry only: no colours, boxes or locks yet). */
function walk(lay: Layout, rng: Rng): { order: number[]; traps: number; coveredAtStart: number } | null {
  const def: LevelDef = { n: 0, plates: lay.plates, bolts: lay.bolts, pins: lay.pins, chains: lay.chains, boxes: [], k: 1, tray: 99, par: 0, d: 0, tag: "normal" };
  const b = newBoard(def);
  const coveredAtStart = lay.bolts.filter((_, i) => isCovered(b, i)).length;
  const order: number[] = [];
  let traps = 0;
  for (let step = 0; step < lay.bolts.length; step++) {
    const free = b.boltOn.map((_, i) => i).filter((i) => isFree(b, i));
    if (!free.length) return null;
    // Prefer bolts on the highest plates a little, like a player would.
    const i = rng.pick(free);
    const wasFree = new Set(free);
    b.boltOn[i] = false;
    b.removed++;
    const st = settle(b);
    if (st.swung.length) {
      const nowCovered = [...wasFree].filter((j) => j !== i && b.boltOn[j] && isCovered(b, j));
      if (nowCovered.length) traps++;
    }
    order.push(i);
  }
  return { order, traps, coveredAtStart };
}

/** Simulate an order with given colours and queue: detours, tray peak, and when each colour first closed. */
function replay(def: LevelDef, order: number[]): { ok: boolean; detours: number; firstClose: number[] } {
  const b = newBoard(def);
  const firstClose = new Array(def.k).fill(Infinity);
  for (let s = 0; s < order.length; s++) {
    const r = tap(b, order[s]);
    if (!r) return { ok: false, detours: 0, firstClose };
    for (const c of r.closes) if (firstClose[c.colour] === Infinity) firstClose[c.colour] = s;
  }
  return { ok: isWon(b), detours: b.detours, firstClose };
}

/**
 * Plan which box each bolt goes to, following the removal order: mostly into an open box, but with
 * probability `mismatch` into a box a little further down the queue (so it waits in the tray),
 * keeping the tray below its limit. Returns the box id (queue index) of every bolt.
 */
function planBoxes(order: number[], nBolts: number, B: number, mismatch: number, trayCap: number, rng: Rng): number[] | null {
  const boxOf = new Array(nBolts).fill(-1);
  const left = new Array(B).fill(BOX_SIZE); // unassigned places per box
  const fill = new Array(B).fill(0); // bolts physically in each box
  const open = [0, B > 1 ? 1 : -1];
  let next = Math.min(2, B);
  const tray: number[] = [];
  const limit = trayCap - 1;
  for (const bolt of order) {
    const futures: number[] = [];
    for (let f = next; f < Math.min(B, next + 3); f++) if (left[f] > 0) futures.push(f);
    const room = open.filter((o) => o >= 0 && left[o] > 0);
    let target: number;
    if (futures.length && tray.length < limit && (rng.chance(mismatch) || !room.length)) target = rng.pick(futures);
    else if (room.length) target = room.sort((a, b) => fill[b] - fill[a])[0];
    else if (futures.length && tray.length < trayCap) target = futures[0];
    else return null;
    boxOf[bolt] = target;
    left[target]--;
    if (open.includes(target)) fill[target]++;
    else tray.push(target);
    for (let guard = 0; guard < 20; guard++) {
      const si = open.findIndex((o) => o >= 0 && fill[o] >= BOX_SIZE);
      if (si < 0) break;
      const nb = next < B ? next++ : -1;
      open[si] = nb;
      if (nb >= 0) {
        for (let t = tray.length - 1; t >= 0; t--) {
          if (tray[t] === nb) {
            tray.splice(t, 1);
            fill[nb]++;
          }
        }
      }
    }
  }
  return left.every((x) => x === 0) ? boxOf : null;
}

/** Colour for each box: every colour used, and neighbours in the queue differ where possible. */
function colourBoxes(B: number, k: number, rng: Rng): number[] {
  const out: number[] = [];
  const unused = new Set(Array.from({ length: k }, (_, c) => c));
  for (let j = 0; j < B; j++) {
    const remaining = B - j;
    let pool = remaining <= unused.size ? [...unused] : Array.from({ length: k }, (_, c) => c);
    const avoid = pool.filter((c) => c !== out[j - 1] && c !== out[j - 2]);
    if (avoid.length) pool = avoid;
    const c = rng.pick(pool);
    out.push(c);
    unused.delete(c);
  }
  return out;
}

/**
 * A sensible player who only sees what's visible: into a box when possible (preferring taps that
 * uncover the most), otherwise into the tray, preferring the next box's colour and colours already
 * waiting. Its detours set par, so ★★★ means "as tidy as a careful human", not a mind-reader.
 */
export function sensiblePlay(def: LevelDef): { won: boolean; detours: number } {
  const b = newBoard(def);
  for (let guard = 0; guard < def.bolts.length + 5; guard++) {
    if (isWon(b)) return { won: true, detours: b.detours };
    const moves = legalMoves(b);
    if (!moves.length) return { won: false, detours: b.detours };
    const freeNow = moves.length;
    let best = -1;
    let bestScore = -Infinity;
    const nextColour = b.next < def.boxes.length ? def.boxes[b.next] : -1;
    for (const m of moves) {
      const colour = def.bolts[m][2];
      const direct = (routeFor(b, colour) ?? -1) >= 0;
      const c = cloneBoard(b);
      tap(c, m);
      const opened = legalMoves(c).length - (freeNow - 1);
      let score = (direct ? 100 : 0) + opened * 2;
      if (!direct) score += (colour === nextColour ? 6 : 0) + (b.tray.includes(colour) ? 3 : 0);
      if (score > bestScore) {
        bestScore = score;
        best = m;
      }
    }
    tap(b, best);
  }
  return { won: isWon(b), detours: b.detours };
}

export function makeLevel(n: number, tag: LevelTag, p: GenParams, rng: Rng): Built | null {
  const lay = makeLayout(p, rng);
  if (!lay) return null;
  const w = walk(lay, rng);
  if (!w) return null;
  const N = lay.bolts.length;
  if (N < 6) return null;
  const B = N / BOX_SIZE;
  const k = Math.max(2, Math.min(p.colours, B));
  const boxOf = planBoxes(w.order, N, B, p.mismatch, p.tray, rng);
  if (!boxOf) return null;
  const boxColours = colourBoxes(B, k, rng);
  const def: LevelDef = { n, plates: lay.plates, bolts: lay.bolts, pins: lay.pins, chains: lay.chains, boxes: boxColours, k, tray: p.tray, par: 0, d: 0, tag };
  def.bolts.forEach((row, i) => (row[2] = boxColours[boxOf[i]]));
  const res = replay(def, w.order);
  if (!res.ok) return null;
  // Giveaway check: a box filled by three bolts that are all free at the start.
  const start = newBoard(def);
  const freeStart = new Set(def.bolts.map((_, i) => i).filter((i) => isFree(start, i)));
  for (let c = 0; c < k; c++) {
    const freeOfC = [...freeStart].filter((i) => def.bolts[i][2] === c).length;
    if (freeOfC >= 6 && N >= 15) return null;
  }

  // Padlocks: a plate whose first bolt comes out after some box closed; lock it to that colour.
  for (let l = 0; l < p.locks; l++) {
    const firstOut = new Map<number, number>();
    w.order.forEach((bi, s) => {
      const pl = def.bolts[bi][0];
      if (!firstOut.has(pl)) firstOut.set(pl, s);
    });
    const cands: Array<[number, number]> = [];
    for (const [pl, s] of firstOut) {
      if (def.plates[pl][6] >= 0) continue;
      for (let c = 0; c < k; c++) if (res.firstClose[c] < s) cands.push([pl, c]);
    }
    if (!cands.length) break;
    const [pl, c] = rng.pick(cands);
    def.plates[pl][6] = c;
  }
  // Rusty bolts: on plates with more than one bolt, so removing a neighbour reveals them.
  const rustCands = rng.shuffle(def.bolts.map((_, i) => i).filter((i) => def.bolts.filter((b) => b[0] === def.bolts[i][0]).length > 1));
  for (let r = 0; r < p.rusty && r < rustCands.length; r++) def.bolts[rustCands[r]][3] |= 1;

  const final = replay(def, w.order);
  if (!final.ok) return null;
  const rusty = def.bolts.filter((b) => b[3] & 1).length;
  const human = sensiblePlay(def);
  const par = (human.won ? human.detours : final.detours) + Math.floor(rusty / 4);
  def.par = par;
  const specials =
    0.3 * lay.pins.length +
    Math.min(2, 0.2 * rusty) +
    0.3 * def.plates.filter((q) => q[5] & 1).length +
    1.0 * def.plates.filter((q) => q[6] >= 0).length +
    0.8 * lay.chains.length +
    0.5 * def.bolts.filter((b) => b[4] >= 0).length;
  const metrics: Metrics = {
    bolts: N,
    layers: new Set(def.plates.map((q) => q[4])).size,
    coveredShare: w.coveredAtStart / N,
    swingTraps: w.traps,
    mismatch: final.detours / B,
    tray: p.tray,
    specials,
    deadEndRate: deadEndRate(def, rng, 16),
    par,
  };
  def.d = Math.round(difficultyScore(metrics) * 100) / 100;
  return { def, metrics };
}

/**
 * Final check on the chosen level: the full-information solver must solve it. Par stays with the
 * sensible player (the solver sees bolts under plates, which players can't).
 */
export function refinePar(built: Built, maxNodes = 40000): Built {
  const res = solve(newBoard(built.def), { maxNodes, bound: built.def.par });
  built.metrics.optimal = res.solved ? res.detours : -1;
  return built;
}

function percentileFor(n: number, tag: LevelTag): number {
  if (Object.values(INTRO).includes(n)) return 0.1;
  if (tag === "breather") return 0.1;
  if (tag === "tricky") return 0.85;
  if (tag === "masterpiece") return 0.95;
  if (tag === "tutorial") return 0.3;
  return Math.max(0.05, Math.min(0.95, (n >= 60 ? 0.65 : 0.5) + chapterSlope(n)));
}

function pickFrom(rated: Built[], p: number): Built {
  rated.sort((a, b) => a.def.d - b.def.d);
  return rated[Math.min(rated.length - 1, Math.round(p * (rated.length - 1)))];
}

export function generateLevel(n: number, opts: { candidates?: number; maxNodes?: number } = {}): Built {
  const tag = tagFor(n);
  const rng = new Rng(seedOf(n, GENERATOR_VERSION));
  const want = opts.candidates ?? 4;
  const rated: Built[] = [];
  for (let attempts = 0; rated.length < want && attempts < want * 15; attempts++) {
    const built = makeLevel(n, tag, paramsFor(n, rng), rng);
    if (built) rated.push(built);
  }
  while (!rated.length) {
    const built = makeLevel(n, tag, { plates: 4, layers: 2, bolts: 12, colours: 3, mismatch: 0.1, tray: 5, rusty: 0, hinges: 0, glass: 0, locks: 0, chains: 0, longs: 0 }, rng);
    if (built) rated.push(built);
  }
  return refinePar(pickFrom(rated, percentileFor(n, tag)), opts.maxNodes);
}

/** Daily Teardown: one mid-curve puzzle per UTC day, the same for everyone. No padlocks or long bolts. */
export function generateDaily(dayKey: string, opts: { candidates?: number; maxNodes?: number } = {}): Built {
  const rng = new Rng(seedOf(dayKey, "unb-daily"));
  const want = opts.candidates ?? 6;
  const rated: Built[] = [];
  for (let attempts = 0; rated.length < want && attempts < want * 15; attempts++) {
    const p = paramsFor(120, rng);
    p.locks = 0;
    p.longs = 0;
    p.tray = 5;
    const built = makeLevel(0, "daily", p, rng);
    if (built) rated.push(built);
  }
  return refinePar(pickFrom(rated, 0.6), opts.maxNodes);
}
