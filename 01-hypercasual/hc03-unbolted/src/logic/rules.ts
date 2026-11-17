// Unbolted rules (DESIGN.md §4): plates in layers held by bolts and hinge pins, an exact swing
// rest pose for plates on one fixing, coverage, the toolbox queue and the tray, and the specials
// (rusty bolts, glass, padlocks, chains, long bolts). Pure data in, pure data out: the game, the
// solver, the generator and the self-test all share this file.

import { BOLT_R, SHAPES, plateSdf, restPose, shapeInfo, toWorld } from "./shapes.ts";
import type { Pose, Vec } from "./shapes.ts";

export type LevelTag = "tutorial" | "normal" | "breather" | "tricky" | "masterpiece" | "daily";

/** [shape, x, y, quarterTurns, layer, flags (1 = glass), lockColour (-1 = none)] */
export type PlateRow = [number, number, number, number, number, number, number];
/** [plate, hole, colour, flags (1 = rusty), plate2 (-1), hole2 (-1)] — plate2/hole2 for long bolts */
export type BoltRow = [number, number, number, number, number, number];
/** [plate, hole] */
export type PinRow = [number, number];
/** [plateA, holeA, plateB, holeB] */
export type ChainRow = [number, number, number, number];

export interface LevelDef {
  n: number;
  plates: PlateRow[];
  bolts: BoltRow[];
  pins: PinRow[];
  chains: ChainRow[];
  /** Box colours in queue order (each box takes 3 bolts). */
  boxes: number[];
  /** Number of colours used (0..k-1). */
  k: number;
  tray: number;
  par: number;
  d: number;
  tag: LevelTag;
  /** Optional tip key shown at the start (tutorial and intro levels). */
  tip?: string;
}

export const BOX_SIZE = 3;
export const OPEN_BOXES = 2;
/** A bolt counts as covered when a higher plate reaches this far over its centre. */
export const COVER = BOLT_R * 0.5;
export const BOARD_W = 6;
export const BOARD_H = 9;

export const FLAG_GLASS = 1;
export const FLAG_RUSTY = 1;

// ---------------------------------------------------------------- geometry cache

interface Geom {
  base: Pose[];
  /** World position of each bolt (bolts never move: they are the pivot when they matter). */
  boltPos: Vec[];
  pinPos: Vec[];
  /** Draw/cover order key per plate: layer, then index. */
  order: number[];
  /** Fixings per plate: bolt indices and pin indices, with the hole on that plate. */
  plateBolts: Array<Array<[number, number]>>;
  platePins: Array<Array<[number, number]>>;
  /** Drilled holes per plate: every hole that holds (or held) a fixing or a chain. */
  drilled: number[][];
  /** Farthest point of each plate from its local origin (quick rejection in isCovered). */
  reach: number[];
  /** Chain partner per plate: [partner, myHole, partnerHole, length] or null. */
  chain: Array<[number, number, number, number] | null>;
}

const geomCache = new WeakMap<LevelDef, Geom>();

export function basePose(row: PlateRow): Pose {
  return { x: row[1], y: row[2], a: (row[3] * Math.PI) / 2 };
}

export function holeLocal(plate: PlateRow, hole: number): Vec {
  return SHAPES[plate[0]].holes[hole];
}

export function geom(def: LevelDef): Geom {
  let g = geomCache.get(def);
  if (g) return g;
  const base = def.plates.map(basePose);
  const at = (p: number, h: number): Vec => {
    const [lx, ly] = holeLocal(def.plates[p], h);
    const w = toWorld(base[p], lx, ly);
    return [Math.round(w[0] * 1e6) / 1e6, Math.round(w[1] * 1e6) / 1e6];
  };
  const plateBolts: Geom["plateBolts"] = def.plates.map(() => []);
  const platePins: Geom["platePins"] = def.plates.map(() => []);
  def.bolts.forEach((b, i) => {
    plateBolts[b[0]].push([i, b[1]]);
    if (b[4] >= 0) plateBolts[b[4]].push([i, b[5]]);
  });
  def.pins.forEach((p, i) => platePins[p[0]].push([i, p[1]]));
  const chain: Geom["chain"] = def.plates.map(() => null);
  for (const [a, ha, b, hb] of def.chains) {
    const pa = at(a, ha);
    const pb = at(b, hb);
    const len = Math.hypot(pa[0] - pb[0], pa[1] - pb[1]) + 0.3;
    chain[a] = [b, ha, hb, len];
    chain[b] = [a, hb, ha, len];
  }
  const drilled: number[][] = def.plates.map(() => []);
  const drill = (p: number, h: number) => {
    if (p >= 0 && !drilled[p].includes(h)) drilled[p].push(h);
  };
  def.bolts.forEach((b) => {
    drill(b[0], b[1]);
    drill(b[4], b[5]);
  });
  def.pins.forEach((p) => drill(p[0], p[1]));
  def.chains.forEach((c) => {
    drill(c[0], c[1]);
    drill(c[2], c[3]);
  });
  g = {
    drilled,
    base,
    boltPos: def.bolts.map((b) => at(b[0], b[1])),
    pinPos: def.pins.map((p) => at(p[0], p[1])),
    order: def.plates.map((p, i) => p[4] * 1000 + i),
    reach: def.plates.map((p) => {
      const [x0, y0, x1, y1] = shapeInfo(p[0]).bounds;
      return Math.max(Math.hypot(x0, y0), Math.hypot(x1, y0), Math.hypot(x0, y1), Math.hypot(x1, y1));
    }),
    plateBolts,
    platePins,
    chain,
  };
  geomCache.set(def, g);
  return g;
}

// ---------------------------------------------------------------- board

export interface Slot {
  /** Queue index of the box in this slot. */
  q: number;
  n: number;
}

export interface Board {
  def: LevelDef;
  boltOn: boolean[];
  plateOn: boolean[];
  pose: Pose[];
  /** Rusty bolts start unrevealed; every other bolt is revealed. */
  revealed: boolean[];
  slots: Array<Slot | null>;
  next: number;
  tray: number[];
  trayCap: number;
  /** Closed boxes per colour (opens padlocks). */
  closed: number[];
  detours: number;
  removed: number;
}

export function newBoard(def: LevelDef): Board {
  const slots: Array<Slot | null> = [];
  for (let s = 0; s < OPEN_BOXES; s++) slots.push(s < def.boxes.length ? { q: s, n: 0 } : null);
  const b: Board = {
    def,
    boltOn: def.bolts.map(() => true),
    plateOn: def.plates.map(() => true),
    pose: geom(def).base.map((p) => ({ ...p })),
    revealed: def.bolts.map((r) => !(r[3] & FLAG_RUSTY)),
    slots,
    next: Math.min(OPEN_BOXES, def.boxes.length),
    tray: [],
    trayCap: def.tray,
    closed: new Array(def.k).fill(0),
    detours: 0,
    removed: 0,
  };
  settle(b);
  return b;
}

export function cloneBoard(b: Board): Board {
  return {
    def: b.def,
    boltOn: b.boltOn.slice(),
    plateOn: b.plateOn.slice(),
    pose: b.pose.map((p) => ({ ...p })),
    revealed: b.revealed.slice(),
    slots: b.slots.map((s) => (s ? { ...s } : null)),
    next: b.next,
    tray: b.tray.slice(),
    trayCap: b.trayCap,
    closed: b.closed.slice(),
    detours: b.detours,
    removed: b.removed,
  };
}

export function boxColour(b: Board, slot: number): number {
  const s = b.slots[slot];
  return s ? b.def.boxes[s.q] : -1;
}

// ---------------------------------------------------------------- poses (the swing)

export interface SettleResult {
  swung: number[];
  dropped: number[];
}

/** Fixings still holding plate p: [world point, local hole] pairs. */
function fixingsOf(b: Board, g: Geom, p: number): Array<[Vec, Vec]> {
  const out: Array<[Vec, Vec]> = [];
  const row = b.def.plates[p];
  for (const [bi, h] of g.plateBolts[p]) if (b.boltOn[bi]) out.push([g.boltPos[bi], holeLocal(row, h)]);
  for (const [pi, h] of g.platePins[p]) out.push([g.pinPos[pi], holeLocal(row, h)]);
  return out;
}

/**
 * Recompute every plate's pose from its fixings (DESIGN.md §4 rule 4):
 * 2+ fixings → base pose; 1 → hangs from it; 0 → hangs from its chain if the partner is held,
 * otherwise drops. Deterministic, so the solver, generator and game always agree.
 */
export function settle(b: Board): SettleResult {
  const g = geom(b.def);
  const res: SettleResult = { swung: [], dropped: [] };
  const before = b.pose.map((p) => p.a);
  const held: boolean[] = b.plateOn.map(() => false);
  for (let p = 0; p < b.def.plates.length; p++) {
    if (!b.plateOn[p]) continue;
    const fx = fixingsOf(b, g, p);
    if (fx.length >= 2) {
      b.pose[p] = { ...g.base[p] };
      held[p] = true;
    } else if (fx.length === 1) {
      b.pose[p] = restPose(b.def.plates[p][0], fx[0][1], fx[0][0], b.pose[p].a);
      held[p] = true;
    }
  }
  for (let p = 0; p < b.def.plates.length; p++) {
    if (!b.plateOn[p] || held[p]) continue;
    const ch = g.chain[p];
    if (ch && b.plateOn[ch[0]] && held[ch[0]]) {
      const [partner, myHole, theirHole, len] = ch;
      const pl = holeLocal(b.def.plates[partner], theirHole);
      const anchor = toWorld(b.pose[partner], pl[0], pl[1]);
      b.pose[p] = restPose(b.def.plates[p][0], holeLocal(b.def.plates[p], myHole), [anchor[0], anchor[1] - len], b.pose[p].a);
    } else {
      b.plateOn[p] = false;
      res.dropped.push(p);
    }
  }
  b.pose.forEach((p, i) => {
    if (b.plateOn[i] && Math.abs(p.a - before[i]) > 1e-6) res.swung.push(i);
  });
  return res;
}

/**
 * What a plate hangs from right now: its single fixing, or its chain anchor. null when it is held
 * by 2+ fixings (or gone). Used by the view to swing plates about the right point.
 */
export function pivotOf(b: Board, p: number): { world: Vec; local: Vec } | null {
  if (!b.plateOn[p]) return null;
  const g = geom(b.def);
  const fx = fixingsOf(b, g, p);
  if (fx.length === 1) return { world: fx[0][0], local: fx[0][1] };
  if (fx.length >= 2) return null;
  const ch = g.chain[p];
  if (!ch) return null;
  const [partner, myHole, theirHole, len] = ch;
  const pl = holeLocal(b.def.plates[partner], theirHole);
  const anchor = toWorld(b.pose[partner], pl[0], pl[1]);
  return { world: [anchor[0], anchor[1] - len], local: holeLocal(b.def.plates[p], myHole) };
}

/** Chain end points in world space (for drawing): [plateA point, plateB point]. */
export function chainEnds(b: Board, c: number): [Vec, Vec] {
  const [a, ha, pb, hb] = b.def.chains[c];
  const la = holeLocal(b.def.plates[a], ha);
  const lb = holeLocal(b.def.plates[pb], hb);
  return [toWorld(b.pose[a], la[0], la[1]), toWorld(b.pose[pb], lb[0], lb[1])];
}

// ---------------------------------------------------------------- coverage, locks, legality

function boltPlates(row: BoltRow): number[] {
  return row[4] >= 0 ? [row[0], row[4]] : [row[0]];
}

/** Is bolt i under a higher plate (in its current pose)? */
export function isCovered(b: Board, i: number): boolean {
  const g = geom(b.def);
  const row = b.def.bolts[i];
  const own = boltPlates(row);
  const key = Math.max(...own.map((p) => g.order[p]));
  const [x, y] = g.boltPos[i];
  for (let q = 0; q < b.def.plates.length; q++) {
    if (!b.plateOn[q] || g.order[q] <= key || own.includes(q)) continue;
    const pq = b.pose[q];
    const reach = g.reach[q] + COVER;
    if ((x - pq.x) * (x - pq.x) + (y - pq.y) * (y - pq.y) > reach * reach) continue;
    if (plateSdf(b.def.plates[q][0], b.pose[q], x, y, g.drilled[q]) < COVER) return true;
  }
  return false;
}

export function isLocked(b: Board, i: number): boolean {
  for (const p of boltPlates(b.def.bolts[i])) {
    const lock = b.def.plates[p][6];
    if (lock >= 0 && b.plateOn[p] && b.closed[lock] === 0) return true;
  }
  return false;
}

export function isPlateLocked(b: Board, p: number): boolean {
  const lock = b.def.plates[p][6];
  return lock >= 0 && b.closed[lock] === 0;
}

export function isFree(b: Board, i: number): boolean {
  return b.boltOn[i] && !isLocked(b, i) && !isCovered(b, i);
}

/** Where a bolt of `colour` would go: an open box slot, -1 for the tray, or null (jammed). */
export function routeFor(b: Board, colour: number): number | null {
  let best = -1;
  let bestN = -1;
  b.slots.forEach((s, i) => {
    if (s && b.def.boxes[s.q] === colour && s.n < BOX_SIZE && s.n > bestN) {
      best = i;
      bestN = s.n;
    }
  });
  if (best >= 0) return best;
  return b.tray.length < b.trayCap ? -1 : null;
}

export function legalMoves(b: Board): number[] {
  const out: number[] = [];
  for (let i = 0; i < b.boltOn.length; i++) if (isFree(b, i) && routeFor(b, b.def.bolts[i][2]) !== null) out.push(i);
  return out;
}

export function isWon(b: Board): boolean {
  return b.removed === b.boltOn.length;
}

export function isStuck(b: Board): boolean {
  return !isWon(b) && legalMoves(b).length === 0;
}

// ---------------------------------------------------------------- moves

export interface BoxClose {
  slot: number;
  colour: number;
  /** The box that slid in (queue index), or -1 when the queue is empty. */
  nextQ: number;
  /** Tray bolts (by colour) that jumped into the new box. */
  pulled: number;
}

export interface TapResult {
  bolt: number;
  colour: number;
  /** Slot it went to, or -1 for the tray. */
  to: number;
  /** Index in the tray it went to (when to = -1). */
  trayAt: number;
  closes: BoxClose[];
  swung: number[];
  dropped: number[];
  revealed: number[];
  unlocked: number[];
}

/**
 * Unscrew bolt i. Returns null if it isn't allowed (covered, locked, or jammed).
 * `force` skips the coverage and padlock checks (Drill and Magnet).
 */
export function tap(b: Board, i: number, force = false): TapResult | null {
  if (!b.boltOn[i]) return null;
  if (!force && (isLocked(b, i) || isCovered(b, i))) return null;
  const colour = b.def.bolts[i][2];
  const to = routeFor(b, colour);
  if (to === null) return null;
  const lockedBefore = b.def.plates.map((_, p) => isPlateLocked(b, p));
  b.boltOn[i] = false;
  b.removed++;
  let trayAt = -1;
  if (to >= 0) b.slots[to]!.n++;
  else {
    trayAt = b.tray.length;
    b.tray.push(colour);
    b.detours++;
  }
  // Rust flakes off the other bolts on the same plate(s).
  const revealed: number[] = [];
  const own = boltPlates(b.def.bolts[i]);
  b.def.bolts.forEach((row, j) => {
    if (b.boltOn[j] && !b.revealed[j] && boltPlates(row).some((p) => own.includes(p))) {
      b.revealed[j] = true;
      revealed.push(j);
    }
  });
  const closes = closeFullBoxes(b);
  const st = settle(b);
  const unlocked = b.def.plates.map((_, p) => p).filter((p) => lockedBefore[p] && !isPlateLocked(b, p));
  return { bolt: i, colour, to, trayAt, closes, swung: st.swung, dropped: st.dropped, revealed, unlocked };
}

/** Close every full box; the next box slides in and matching tray bolts jump into it. */
function closeFullBoxes(b: Board): BoxClose[] {
  const out: BoxClose[] = [];
  for (let guard = 0; guard < 100; guard++) {
    const s = b.slots.findIndex((x) => x && x.n >= BOX_SIZE);
    if (s < 0) break;
    const colour = b.def.boxes[b.slots[s]!.q];
    b.closed[colour]++;
    let nextQ = -1;
    let pulled = 0;
    if (b.next < b.def.boxes.length) {
      nextQ = b.next++;
      b.slots[s] = { q: nextQ, n: 0 };
      const c = b.def.boxes[nextQ];
      for (let t = 0; t < b.tray.length && b.slots[s]!.n < BOX_SIZE; ) {
        if (b.tray[t] === c) {
          b.tray.splice(t, 1);
          b.slots[s]!.n++;
          pulled++;
        } else t++;
      }
    } else b.slots[s] = null;
    out.push({ slot: s, colour, nextQ, pulled });
  }
  return out;
}

// ---------------------------------------------------------------- power-ups

/** ➕ Extra Slot: one more tray slot for this level. */
export function extraSlot(b: Board): void {
  b.trayCap++;
}

/** 🛢️ Oil Can: reveal every rusty bolt. */
export function oilCan(b: Board): number[] {
  const out: number[] = [];
  b.revealed.forEach((r, i) => {
    if (!r && b.boltOn[i]) {
      b.revealed[i] = true;
      out.push(i);
    }
  });
  return out;
}

/** 🔨 Drill: unscrew any bolt, even covered or padlocked. */
export function drill(b: Board, i: number): TapResult | null {
  return tap(b, i, true);
}

/**
 * 🧲 Magnet: fill the box in `slot` with bolts of its colour from anywhere on the board,
 * covered ones first (that's where it helps most).
 */
export function magnet(b: Board, slot: number): TapResult[] {
  const out: TapResult[] = [];
  const s = b.slots[slot];
  if (!s) return out;
  const q = s.q;
  const colour = b.def.boxes[q];
  const g = geom(b.def);
  for (let guard = 0; guard < BOX_SIZE; guard++) {
    const cur = b.slots[slot];
    if (!cur || cur.q !== q || cur.n >= BOX_SIZE) break;
    const cands = b.boltOn
      .map((on, i) => i)
      .filter((i) => b.boltOn[i] && b.def.bolts[i][2] === colour)
      .sort((x, y) => Number(isCovered(b, y)) - Number(isCovered(b, x)) || g.order[b.def.bolts[x][0]] - g.order[b.def.bolts[y][0]] || x - y);
    if (!cands.length) break;
    const r = tap(b, cands[0], true);
    if (!r) break;
    out.push(r);
  }
  return out;
}

/** Bolts whose removal changes no plate (still 2+ fixings on each of its plates). */
export function isQuietRemoval(b: Board, i: number): boolean {
  const g = geom(b.def);
  for (const p of boltPlates(b.def.bolts[i])) {
    let n = g.platePins[p].length;
    for (const [bi] of g.plateBolts[p]) if (b.boltOn[bi] && bi !== i) n++;
    if (n < 2) return false;
  }
  return true;
}

/** A short key for the solver: bolts on, open boxes, tray. Poses follow from the bolts. */
export function stateKey(b: Board): string {
  let bits = "";
  for (let i = 0; i < b.boltOn.length; i += 5) {
    let v = 0;
    for (let j = 0; j < 5 && i + j < b.boltOn.length; j++) if (b.boltOn[i + j]) v |= 1 << j;
    bits += v.toString(32);
  }
  const slots = b.slots.map((s) => (s ? `${s.q}.${s.n}` : "x")).join(",");
  const tray = b.tray.slice().sort((x, y) => x - y).join("");
  return `${bits}|${slots}|${tray}|${b.trayCap}`;
}
