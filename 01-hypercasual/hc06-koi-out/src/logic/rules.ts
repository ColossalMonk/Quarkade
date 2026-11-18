// Koi Out rules (DESIGN.md §4): a W×H pond of cells. Each koi lies along a path of cells, head first,
// its head facing a direction. Tapped, it swims straight out from its head (its body following)
// unless something is in the way; then it bumps back and a heart is lost.
//
// Pure data: rendering only reads a Board, so undo, the solver and the generator share this module.

export const DX = [0, 1, 0, -1];
export const DY = [-1, 0, 1, 0];
/** Directions: 0 up, 1 right, 2 down, 3 left. */
export type Dir = 0 | 1 | 2 | 3;

export const HEARTS = 3;

export type LevelTag = "tutorial" | "normal" | "breather" | "tricky" | "dragon" | "daily" | "custom";

export interface KoiDef {
  /** Cells, head first. */
  c: number[];
  /** Head direction. For koi of 2+ cells it points away from the second cell. */
  d: Dir;
}

export interface LevelDef {
  n: number;
  w: number;
  h: number;
  /** Lily pads (fixed blockers). */
  pads?: number[];
  /** Closed exits: cell * 4 + dir, for border cells facing out. */
  reeds?: number[];
  /** Frogs: [cell, count]: they block until that many koi have left. */
  frogs?: Array<[number, number]>;
  /** Whirlpools: a fry on one turns a quarter (clockwise) each time another koi leaves. */
  whirls?: number[];
  /** Currents: [cell, dir]: a swimming head that passes over turns to that direction. */
  currents?: Array<[number, Dir]>;
  koi: KoiDef[];
  /** An escape order that works (from generation). */
  sol: number[];
  d: number;
  tag: LevelTag;
}

export interface Board {
  def: LevelDef;
  out: boolean[];
  dir: Dir[];
  /** Koi that have left so far. */
  escaped: number;
  hearts: number;
  heartsLost: number;
  /** Koi lifted out by the Net (they count as escaped). */
  netted: number;
}

export interface SwimResult {
  ok: boolean;
  /** Cells the head passes over, in order (until it leaves, or up to the blocker). */
  ray: number[];
  /** The last direction (after currents). */
  exitDir: Dir;
  /** What blocked it: a cell index, or -1 for a reed bank / a loop. */
  blocker: number;
}

// ---------------------------------------------------------------- setup

export function newBoard(def: LevelDef): Board {
  return {
    def,
    out: def.koi.map(() => false),
    dir: def.koi.map((k) => k.d),
    escaped: 0,
    hearts: HEARTS,
    heartsLost: 0,
    netted: 0,
  };
}

export function cloneBoard(b: Board): Board {
  return { ...b, out: b.out.slice(), dir: b.dir.slice() };
}

export const cellX = (def: LevelDef, c: number) => c % def.w;
export const cellY = (def: LevelDef, c: number) => Math.floor(c / def.w);

/** The cell next to c in direction d, or -1 off the pond. */
export function step(def: LevelDef, c: number, d: Dir): number {
  const x = (c % def.w) + DX[d];
  const y = Math.floor(c / def.w) + DY[d];
  if (x < 0 || y < 0 || x >= def.w || y >= def.h) return -1;
  return y * def.w + x;
}

/** Which koi lies on each cell (-1 for none), for the koi still in the pond. */
export function occupancy(b: Board): Int16Array {
  const occ = new Int16Array(b.def.w * b.def.h).fill(-1);
  b.def.koi.forEach((k, i) => {
    if (!b.out[i]) for (const c of k.c) occ[c] = i;
  });
  return occ;
}

export function frogHere(b: Board, c: number): boolean {
  return !!b.def.frogs?.some(([fc, n]) => fc === c && b.escaped < n);
}

export function padHere(def: LevelDef, c: number): boolean {
  return !!def.pads?.includes(c);
}

function currentAt(def: LevelDef, c: number): Dir | -1 {
  const cur = def.currents?.find(([cc]) => cc === c);
  return cur ? cur[1] : -1;
}

// ---------------------------------------------------------------- swimming

/** Trace koi i's way out: straight from its head, turned by currents, until it leaves or hits something. */
export function trace(b: Board, i: number, occ: Int16Array = occupancy(b)): SwimResult {
  const def = b.def;
  const k = def.koi[i];
  const len = k.c.length;
  let d: Dir = b.dir[i];
  let c = k.c[0];
  const ray: number[] = [];
  const seen = new Set<number>();
  for (let s = 1; s < def.w * def.h * 2; s++) {
    const nx = step(def, c, d);
    if (nx < 0) {
      // Leaving the pond: only through open water, not a reed bank.
      if (def.reeds?.includes(c * 4 + d)) return { ok: false, ray, exitDir: d, blocker: -1 };
      return { ok: true, ray, exitDir: d, blocker: -1 };
    }
    // Its own body is in the way only if it hasn't swum clear of that cell yet.
    const own = k.c.indexOf(nx);
    const other = occ[nx] >= 0 && occ[nx] !== i;
    if (other || padHere(def, nx) || frogHere(b, nx) || (own >= 0 && s <= len - 1 - own)) return { ok: false, ray, exitDir: d, blocker: nx };
    ray.push(nx);
    c = nx;
    const cur = currentAt(def, nx);
    if (cur >= 0) d = cur as Dir;
    const key = c * 4 + d;
    if (seen.has(key)) return { ok: false, ray, exitDir: d, blocker: -1 };
    seen.add(key);
  }
  return { ok: false, ray, exitDir: d, blocker: -1 };
}

export function canEscape(b: Board, i: number, occ?: Int16Array): boolean {
  return !b.out[i] && trace(b, i, occ).ok;
}

/** A koi left: whirlpool fry turn a quarter. */
function afterEscape(b: Board): void {
  b.escaped++;
  const def = b.def;
  if (!def.whirls) return;
  def.koi.forEach((k, j) => {
    if (!b.out[j] && k.c.length === 1 && def.whirls!.includes(k.c[0])) b.dir[j] = ((b.dir[j] + 1) % 4) as Dir;
  });
}

/** Tap koi i. Returns the swim (ok = it left; otherwise a heart was lost). */
export function tapKoi(b: Board, i: number): SwimResult | null {
  if (b.out[i]) return null;
  const res = trace(b, i);
  if (res.ok) {
    b.out[i] = true;
    afterEscape(b);
  } else {
    b.hearts = Math.max(0, b.hearts - 1);
    b.heartsLost++;
  }
  return res;
}

/** Net: lift koi i out wherever it is (counts as leaving). */
export function netKoi(b: Board, i: number): boolean {
  if (b.out[i]) return false;
  b.out[i] = true;
  b.netted++;
  afterEscape(b);
  return true;
}

/** Bread: turn koi i's head to face d (only into a free cell, never back into its own body). */
export function canTurn(b: Board, i: number, d: Dir): boolean {
  if (b.out[i]) return false;
  const k = b.def.koi[i];
  const nx = step(b.def, k.c[0], d);
  if (k.c.length > 1 && nx === k.c[1]) return false;
  if (nx < 0) return true;
  const occ = occupancy(b);
  return occ[nx] < 0 && !padHere(b.def, nx) && !frogHere(b, nx);
}

export function turnKoi(b: Board, i: number, d: Dir): boolean {
  if (!canTurn(b, i, d)) return false;
  b.dir[i] = d;
  return true;
}

export function isWon(b: Board): boolean {
  return b.out.every(Boolean);
}

export function isOutOfHearts(b: Board): boolean {
  return b.hearts <= 0 && !isWon(b);
}

/** Koi that can swim out right now. */
export function freeKoi(b: Board): number[] {
  const occ = occupancy(b);
  const out: number[] = [];
  b.def.koi.forEach((_, i) => {
    if (!b.out[i] && trace(b, i, occ).ok) out.push(i);
  });
  return out;
}

export function koiLeft(b: Board): number {
  return b.out.filter((o) => !o).length;
}
