// Aisle Nine rules (DESIGN.md §4): a ring of shelf units around a pole. Each shelf has a front row
// of 3 spots and may have back stock (layers of 3 that slide forward when the front row is empty).
// Only shelves in the front arc can be used, and the stand turns one step after every move.
//
// Pure data: rendering only reads a Board, so undo, the solver and the generator share this module.

export const SPOTS = 3;
export const EMPTY = -1;
/** The basket (a power-up) is a pseudo-shelf after the real ones, with 2 spots. */
export const BASKET_SPOTS = 2;

export type LevelTag = "tutorial" | "normal" | "breather" | "tricky" | "grand" | "daily" | "custom";

export interface ShelfDef {
  /** Front row: kind index per spot, or -1. */
  f: number[];
  /** Back stock: layers of 3, index 0 slides forward first. */
  b?: number[][];
  /** Closed cardboard box: opens when a neighbouring shelf sells a triple. */
  box?: 1;
  /** Freezer: thaws after this many triples have been sold anywhere. */
  frz?: number;
  /** Glass cabinet: opens when a triple of the key kind is sold. */
  cab?: 1;
}

/** A move: [0, from, spot, to] moves a good; [1] turns the stand; [2, from, spot] serves the customer. */
export type Move = [0, number, number, number] | [1] | [2, number, number];

export interface LevelDef {
  n: number;
  /** Shelf units around the pole. */
  units: number;
  /** Shelves per unit (stacked). */
  rows: number;
  /** Units in reach (the front arc). Equal to units on a still stand. */
  reach: number;
  /** Does the stand turn after each move? (Not in levels 1-3.) */
  turns: boolean;
  /** Turn direction: +1 or -1 positions per step. */
  dir: 1 | -1;
  /** Starting angle (positions turned). */
  angle: number;
  /** Number of kinds of goods; goods are 0..kinds-1. */
  kinds: number;
  /** Shelf index = unit * rows + row (row 0 at the top). */
  shelves: ShelfDef[];
  /** Kind whose sale opens the glass cabinets. */
  key?: number;
  /** Restock cart queue (kinds, in groups of 3). */
  cart?: number[];
  /** Customers' wanted kinds, served in order. */
  cust?: number[];
  /** Back stock is hidden under "?" (from level 120). */
  hide?: 1;
  /** A known solution (from generation). */
  sol: Move[];
  par: number;
  d: number;
  tag: LevelTag;
}

export interface Board {
  def: LevelDef;
  /** Front rows: shelves * 3 spots, then the basket's spots. */
  front: number[];
  /** Next back-stock layer per shelf. */
  layer: number[];
  angle: number;
  boxed: boolean[];
  frozen: number[];
  locked: boolean;
  cartPos: number;
  custPos: number;
  /** Moves left with the stand braked. */
  brake: number;
  /** Basket spots (0 until the power-up is used). */
  basket: number;
  moves: number;
  sold: number;
}

export type GameEvent =
  | { t: "move"; from: number; spot: number; to: number; toSpot: number; kind: number }
  | { t: "serve"; from: number; spot: number; kind: number }
  | { t: "sell"; shelf: number; kind: number }
  | { t: "restock"; shelf: number; src: "layer" | "cart" }
  | { t: "open"; shelf: number }
  | { t: "thaw"; shelf: number }
  | { t: "unlock" }
  | { t: "turn"; by: number };

// ---------------------------------------------------------------- setup

export function shelfCount(def: LevelDef): number {
  return def.units * def.rows;
}

export function newBoard(def: LevelDef): Board {
  const S = shelfCount(def);
  const front: number[] = [];
  for (let s = 0; s < S; s++) for (let i = 0; i < SPOTS; i++) front.push(def.shelves[s]?.f[i] ?? EMPTY);
  for (let i = 0; i < BASKET_SPOTS; i++) front.push(EMPTY);
  return {
    def,
    front,
    layer: new Array(S).fill(0),
    angle: ((def.angle % def.units) + def.units) % def.units,
    boxed: def.shelves.map((s) => !!s.box),
    frozen: def.shelves.map((s) => s.frz ?? 0),
    locked: def.shelves.some((s) => s.cab),
    cartPos: 0,
    custPos: 0,
    brake: 0,
    basket: 0,
    moves: 0,
    sold: 0,
  };
}

export function cloneBoard(b: Board): Board {
  return { ...b, front: b.front.slice(), layer: b.layer.slice(), boxed: b.boxed.slice(), frozen: b.frozen.slice() };
}

// ---------------------------------------------------------------- geometry

export const unitOf = (def: LevelDef, s: number) => Math.floor(s / def.rows);
export const rowOf = (def: LevelDef, s: number) => s % def.rows;

/** Position of a unit around the stand: 0..reach-1 is the front arc, left to right. */
export function posOf(b: Board, unit: number): number {
  const U = b.def.units;
  return (((unit + b.angle) % U) + U) % U;
}

export function isBasket(b: Board, s: number): boolean {
  return s === shelfCount(b.def);
}

export function inReach(b: Board, s: number): boolean {
  if (isBasket(b, s)) return b.basket > 0;
  return posOf(b, unitOf(b.def, s)) < b.def.reach;
}

/** Shelves next to s: above and below in its unit, and the same row in the units beside it. */
export function neighbours(def: LevelDef, s: number): number[] {
  const u = unitOf(def, s);
  const r = rowOf(def, s);
  const out: number[] = [];
  if (r > 0) out.push(s - 1);
  if (r < def.rows - 1) out.push(s + 1);
  const ring = def.turns && def.units > 2;
  for (const du of [-1, 1]) {
    let v = u + du;
    if (ring) v = (v + def.units) % def.units;
    else if (v < 0 || v >= def.units) continue;
    if (v !== u) out.push(v * def.rows + r);
  }
  return [...new Set(out)];
}

/** Cabinets and boxes stay shut and freezers stay frozen: such shelves can't be used at all. */
export function usable(b: Board, s: number): boolean {
  if (isBasket(b, s)) return b.basket > 0;
  if (b.boxed[s] || b.frozen[s] > 0) return false;
  if (b.locked && b.def.shelves[s].cab) return false;
  return true;
}

function capacity(b: Board, s: number): number {
  return isBasket(b, s) ? b.basket : SPOTS;
}

export function frontOf(b: Board, s: number): number[] {
  const n = capacity(b, s);
  return b.front.slice(s * SPOTS, s * SPOTS + n);
}

export function freeSpot(b: Board, s: number): number {
  const n = capacity(b, s);
  for (let i = 0; i < n; i++) if (b.front[s * SPOTS + i] === EMPTY) return i;
  return -1;
}

export function isEmptyFront(b: Board, s: number): boolean {
  for (let i = 0; i < SPOTS; i++) if (b.front[s * SPOTS + i] !== EMPTY) return false;
  return true;
}

function tripleKind(b: Board, s: number): number {
  const k = b.front[s * SPOTS];
  if (k === EMPTY) return EMPTY;
  for (let i = 1; i < SPOTS; i++) if (b.front[s * SPOTS + i] !== k) return EMPTY;
  return k;
}

export function wanted(b: Board): number {
  const c = b.def.cust;
  return c && b.custPos < c.length ? c[b.custPos] : EMPTY;
}

// ---------------------------------------------------------------- moves

export function canTake(b: Board, s: number, spot: number): boolean {
  return inReach(b, s) && usable(b, s) && spot >= 0 && spot < capacity(b, s) && b.front[s * SPOTS + spot] !== EMPTY;
}

export function canMove(b: Board, from: number, spot: number, to: number): boolean {
  return from !== to && canTake(b, from, spot) && inReach(b, to) && usable(b, to) && freeSpot(b, to) >= 0;
}

export function canServe(b: Board, from: number, spot: number): boolean {
  const w = wanted(b);
  return w !== EMPTY && canTake(b, from, spot) && b.front[from * SPOTS + spot] === w;
}

export function legalMoves(b: Board, withTurn = true): Move[] {
  const S = shelfCount(b.def);
  const out: Move[] = [];
  const shelves: number[] = [];
  for (let s = 0; s <= S; s++) if (inReach(b, s) && usable(b, s)) shelves.push(s);
  const targets = shelves.filter((s) => freeSpot(b, s) >= 0);
  const w = wanted(b);
  for (const f of shelves) {
    const seen = new Set<number>();
    for (let i = 0; i < capacity(b, f); i++) {
      const k = b.front[f * SPOTS + i];
      if (k === EMPTY || seen.has(k)) continue;
      seen.add(k);
      for (const t of targets) if (t !== f) out.push([0, f, i, t]);
      if (k === w) out.push([2, f, i]);
    }
  }
  if (withTurn && b.def.turns) out.push([1]);
  return out;
}

/** After a front row empties: back stock first, then the cart. A refill that is a triple sells at once. */
function restock(b: Board, s: number, ev?: GameEvent[]): void {
  while (!isBasket(b, s) && isEmptyFront(b, s)) {
    if (!refill(b, s, ev)) return;
    if (!checkSell(b, s, ev)) return;
  }
}

function refill(b: Board, s: number, ev?: GameEvent[]): boolean {
  const layers = b.def.shelves[s].b;
  let src: number[] | null = null;
  let from: "layer" | "cart" = "layer";
  if (layers && b.layer[s] < layers.length) {
    src = layers[b.layer[s]];
    b.layer[s]++;
  } else if (b.def.cart && b.cartPos < b.def.cart.length) {
    src = b.def.cart.slice(b.cartPos, b.cartPos + SPOTS);
    b.cartPos += SPOTS;
    from = "cart";
  }
  if (!src) return false;
  for (let i = 0; i < SPOTS; i++) b.front[s * SPOTS + i] = src[i] ?? EMPTY;
  ev?.push({ t: "restock", shelf: s, src: from });
  return true;
}

/** Sells a full row of one kind. Restocking is left to the caller (source shelf first, then target). */
function checkSell(b: Board, s: number, ev?: GameEvent[]): boolean {
  if (isBasket(b, s)) return false;
  const k = tripleKind(b, s);
  if (k === EMPTY) return false;
  for (let i = 0; i < SPOTS; i++) b.front[s * SPOTS + i] = EMPTY;
  b.sold++;
  ev?.push({ t: "sell", shelf: s, kind: k });
  for (const nb of neighbours(b.def, s)) {
    if (b.boxed[nb]) {
      b.boxed[nb] = false;
      ev?.push({ t: "open", shelf: nb });
    }
  }
  for (let i = 0; i < b.frozen.length; i++) {
    if (b.frozen[i] > 0) {
      b.frozen[i]--;
      if (b.frozen[i] === 0) ev?.push({ t: "thaw", shelf: i });
    }
  }
  if (b.locked && k === b.def.key) {
    b.locked = false;
    ev?.push({ t: "unlock" });
  }
  return true;
}

function turn(b: Board, forced: boolean, ev?: GameEvent[]): void {
  if (!b.def.turns) return;
  if (b.brake > 0 && !forced) {
    b.brake--;
    return;
  }
  b.angle = (((b.angle + b.def.dir) % b.def.units) + b.def.units) % b.def.units;
  ev?.push({ t: "turn", by: b.def.dir });
}

/** Plays a move. Returns false (and changes nothing) if it isn't legal. */
export function applyMove(b: Board, m: Move, ev?: GameEvent[]): boolean {
  if (m[0] === 1) {
    if (!b.def.turns) return false;
    b.moves++;
    turn(b, true, ev);
    return true;
  }
  if (m[0] === 2) {
    const [, from, spot] = m;
    if (!canServe(b, from, spot)) return false;
    const kind = b.front[from * SPOTS + spot];
    b.front[from * SPOTS + spot] = EMPTY;
    b.custPos++;
    b.moves++;
    ev?.push({ t: "serve", from, spot, kind });
    restock(b, from, ev);
    turn(b, false, ev);
    return true;
  }
  const [, from, spot, to] = m;
  if (!canMove(b, from, spot, to)) return false;
  const kind = b.front[from * SPOTS + spot];
  const toSpot = freeSpot(b, to);
  b.front[from * SPOTS + spot] = EMPTY;
  b.front[to * SPOTS + toSpot] = kind;
  b.moves++;
  ev?.push({ t: "move", from, spot, to, toSpot, kind });
  checkSell(b, to, ev);
  restock(b, from, ev);
  restock(b, to, ev);
  turn(b, false, ev);
  return true;
}

// ---------------------------------------------------------------- state checks

export function goodsLeft(b: Board): number {
  let n = 0;
  for (const k of b.front) if (k !== EMPTY) n++;
  b.def.shelves.forEach((sh, s) => {
    for (let l = b.layer[s]; l < (sh.b?.length ?? 0); l++) n += sh.b![l].filter((k) => k !== EMPTY).length;
  });
  if (b.def.cart) n += b.def.cart.length - b.cartPos;
  return n;
}

export function isWon(b: Board): boolean {
  return goodsLeft(b) === 0 && b.custPos >= (b.def.cust?.length ?? 0);
}

/** Jammed: no usable shelf anywhere on the stand (or the basket) has a free spot. */
export function isJammed(b: Board): boolean {
  if (isWon(b)) return false;
  const S = shelfCount(b.def);
  for (let s = 0; s < S; s++) if (usable(b, s) && freeSpot(b, s) >= 0) return false;
  if (b.basket > 0 && freeSpot(b, S) >= 0) return false;
  // A pending customer can still take a good that's on the stand.
  const w = wanted(b);
  if (w !== EMPTY) for (let s = 0; s < S; s++) if (usable(b, s) && frontOf(b, s).includes(w)) return false;
  return true;
}

/** A canonical key for the solver (spot order inside a front row doesn't matter). */
export function stateKey(b: Board): string {
  const S = shelfCount(b.def);
  const parts: string[] = [];
  for (let s = 0; s <= S; s++) {
    const f = b.front.slice(s * SPOTS, s * SPOTS + SPOTS).filter((k) => k !== EMPTY).sort((x, y) => x - y);
    parts.push(f.join("."));
  }
  return `${parts.join("|")}/${b.layer.join("")}/${b.angle}/${b.boxed.map((x) => (x ? 1 : 0)).join("")}/${b.frozen.join(",")}/${b.locked ? 1 : 0}/${b.cartPos}/${b.custPos}/${b.brake}`;
}

/** Counts of each kind still in play (front, back stock, cart). */
export function kindCounts(b: Board): number[] {
  const out = new Array(b.def.kinds).fill(0);
  for (const k of b.front) if (k !== EMPTY) out[k]++;
  b.def.shelves.forEach((sh, s) => {
    for (let l = b.layer[s]; l < (sh.b?.length ?? 0); l++) for (const k of sh.b![l]) if (k !== EMPTY) out[k]++;
  });
  if (b.def.cart) for (let i = b.cartPos; i < b.def.cart.length; i++) out[b.def.cart[i]]++;
  return out;
}

/**
 * Shop Assistant: sell one triple of kind k from anywhere (open shelves' front rows first, then back
 * stock), without a move. Returns false if there aren't three that can go (customers keep theirs).
 * The level def is copied, since back stock lives in it.
 */
export function assistSell(b: Board, k: number, ev?: GameEvent[]): boolean {
  const S = shelfCount(b.def);
  const custNeed = (b.def.cust ?? []).slice(b.custPos).filter((w) => w === k).length;
  if (kindCounts(b)[k] - custNeed < SPOTS) return false;
  const def: LevelDef = JSON.parse(JSON.stringify(b.def));
  const takes: Array<{ s: number; i: number } | { s: number; l: number; i: number }> = [];
  for (let s = 0; s <= S && takes.length < SPOTS; s++) {
    if (!usable(b, s)) continue;
    for (let i = 0; i < capacity(b, s) && takes.length < SPOTS; i++) if (b.front[s * SPOTS + i] === k) takes.push({ s, i });
  }
  for (let s = 0; s < S && takes.length < SPOTS; s++) {
    if (b.boxed[s]) continue;
    const layers = def.shelves[s].b ?? [];
    for (let l = b.layer[s]; l < layers.length && takes.length < SPOTS; l++)
      for (let i = 0; i < SPOTS && takes.length < SPOTS; i++) if (layers[l][i] === k) takes.push({ s, l, i });
  }
  if (takes.length < SPOTS) return false;
  b.def = def;
  const touched = new Set<number>();
  for (const t of takes) {
    if ("l" in t) def.shelves[t.s].b![t.l][t.i] = EMPTY;
    else b.front[t.s * SPOTS + t.i] = EMPTY;
    touched.add(t.s);
  }
  b.sold++;
  ev?.push({ t: "sell", shelf: -1, kind: k });
  for (let i = 0; i < b.frozen.length; i++) {
    if (b.frozen[i] > 0) {
      b.frozen[i]--;
      if (b.frozen[i] === 0) ev?.push({ t: "thaw", shelf: i });
    }
  }
  if (b.locked && k === b.def.key) {
    b.locked = false;
    ev?.push({ t: "unlock" });
  }
  for (const s of touched) restock(b, s, ev);
  return true;
}
