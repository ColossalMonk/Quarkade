// Aisle Nine level generator, difficulty score and curve (DESIGN.md §5).
//
// Solvable by construction: start from an empty stand and play BACKWARDS. Each reverse step undoes a
// forward event (a sale, a move, a restock from back stock or the cart, a customer served), and the
// stand turns back one step. Played forwards, the reverse steps are the stored solution. Twists
// (boxes, freezers, cabinets) are then placed where the stored solution doesn't need the shelf yet,
// and the whole level is replayed with the real rules to make sure it still wins.

import { Rng, seedOf } from "../../../../forge/src/core/rng.ts";
import type { Board, LevelDef, LevelTag, Move, ShelfDef } from "./rules.ts";
import { EMPTY, SPOTS, applyMove, freeSpot, isWon, neighbours, newBoard, shelfCount, usable } from "./rules.ts";
import { jamRate } from "./solver.ts";

export const GENERATOR_VERSION = "aisle-v1";

/** Where each special first appears, alone, in an easier level with a tip. */
export const INTRO = { turning: 4, boxes: 12, freezer: 25, cabinet: 45, cart: 61, customers: 91, hidden: 120 };

// ---------------------------------------------------------------- rhythm

export function tagFor(n: number): LevelTag {
  if (n <= 20) return "tutorial";
  if (n >= 150 && n % 50 === 0) return "grand";
  if (n % 10 === 0) return "tricky";
  if (n % 5 === 0) return "breather";
  return "normal";
}

function chapterSlope(n: number): number {
  return -0.2 + (((n - 21) % 10) / 9) * 0.3;
}

// ---------------------------------------------------------------- bands

export interface Band {
  units: [number, number];
  rows: [number, number];
  kinds: [number, number];
  /** Free front spots at the start (fewer is harder). */
  free: [number, number];
  layers: [number, number];
  /** Most triples a level may have (keeps levels at 30-60 s). */
  cap: number;
  box: number;
  freezer: number;
  cabinet: number;
  cart: number;
  cust: number;
  hide: number;
}

export function bandFor(n: number): Band {
  const on = (k: keyof typeof INTRO, v: number) => (n >= INTRO[k] ? v : 0);
  // Portrait-friendly stands: few units (about 2 in reach), 2-3 shelves high.
  if (n <= 20) return { units: [4, 5], rows: [1, 2], kinds: [2, 4], free: [6, 5], layers: [0, 1], cap: 6, box: on("boxes", 1), freezer: 0, cabinet: 0, cart: 0, cust: 0, hide: 0 };
  if (n <= 44) return { units: [4, 5], rows: [2, 2], kinds: [4, 5], free: [6, 5], layers: [0, 1], cap: 10, box: 1, freezer: on("freezer", 0.6), cabinet: 0, cart: 0, cust: 0, hide: 0 };
  if (n <= 89) return { units: [4, 6], rows: [2, 3], kinds: [5, 7], free: [6, 4], layers: [1, 1], cap: 13, box: 1, freezer: 0.6, cabinet: on("cabinet", 0.6), cart: on("cart", 0.5), cust: 0, hide: 0 };
  if (n <= 200) return { units: [5, 6], rows: [2, 3], kinds: [6, 8], free: [5, 4], layers: [1, 2], cap: 16, box: 1.5, freezer: 0.7, cabinet: 0.5, cart: 0.5, cust: on("customers", 0.5), hide: on("hidden", 0.4) };
  if (n <= 400) return { units: [5, 6], rows: [2, 3], kinds: [7, 9], free: [5, 3], layers: [1, 2], cap: 18, box: 2, freezer: 0.7, cabinet: 0.5, cart: 0.5, cust: 0.5, hide: 0.5 };
  return { units: [4, 6], rows: [2, 3], kinds: [6, 9], free: [5, 3], layers: [1, 2], cap: 18, box: 2, freezer: 0.7, cabinet: 0.5, cart: 0.5, cust: 0.5, hide: 0.5 };
}

function bandProgress(n: number): number {
  const edges = [1, 21, 45, 90, 201, 401, 1000];
  for (let i = 0; i < edges.length - 1; i++) if (n < edges[i + 1]) return (n - edges[i]) / (edges[i + 1] - edges[i]);
  return 0.5;
}

/** Units in reach: the front arc stays within about ±50° so the side shelves are easy to read. */
export function reachFor(units: number): number {
  return units <= 6 ? 2 : 3;
}

// ---------------------------------------------------------------- parameters

export interface GenParams {
  units: number;
  rows: number;
  turns: boolean;
  kinds: number;
  triples: number;
  /** Free front spots wanted at the start. */
  free: number;
  layers: number;
  box: number;
  freezer: number;
  cabinet: number;
  /** Triples' worth of goods allowed in the restock cart. */
  cart: number;
  cust: number;
  hide: boolean;
  /** An intro level must bring this twist. */
  need?: keyof typeof INTRO;
}

const lerp = (r: [number, number], t: number) => Math.round(r[0] + (r[1] - r[0]) * t);
const count = (rng: Rng, v: number) => Math.floor(v) + (rng.chance(v - Math.floor(v)) ? 1 : 0);

export function paramsFor(n: number, rng: Rng): GenParams {
  const band = bandFor(n);
  const tag = tagFor(n);
  const t = Math.max(0, Math.min(1, bandProgress(n) + (rng.next() - 0.5) * 0.4));
  const tune = tag === "breather" ? -0.3 : tag === "tricky" ? 0.25 : tag === "grand" ? 0.4 : 0;
  const tt = Math.max(0, Math.min(1, t + tune));
  const p: GenParams = {
    units: lerp(band.units, tt),
    rows: lerp(band.rows, Math.min(1, tt * 0.8 + rng.next() * 0.4)),
    turns: n >= INTRO.turning || n === 0,
    kinds: lerp(band.kinds, tt),
    triples: 0,
    free: lerp(band.free, tt),
    layers: lerp(band.layers, tt),
    box: count(rng, band.box),
    freezer: count(rng, band.freezer),
    cabinet: count(rng, band.cabinet),
    cart: rng.chance(band.cart) ? rng.int(2, 3) : 0,
    cust: rng.chance(band.cust) ? rng.int(1, 2) : 0,
    hide: rng.chance(band.hide),
  };
  if (tag === "grand") p.rows = 3;
  // Goods: fill the fronts but for the free spots, plus back stock on about 60% of shelves.
  const S = p.units * p.rows;
  const back = Math.round(S * p.layers * (0.45 + 0.3 * tt));
  p.triples = Math.max(2, Math.min(band.cap + (tag === "grand" ? 4 : 0), Math.round((3 * S - p.free) / 3 + back * 0.95)));
  // Tutorial: a gentle 3 -> 6 triples.
  if (n > 0 && n <= 20) p.triples = 3 + Math.round(tt * 3);
  // Each special's intro level shows it alone.
  for (const [k, lv] of Object.entries(INTRO)) {
    if (n !== lv) continue;
    p.box = k === "boxes" ? 1 : 0;
    p.freezer = k === "freezer" ? 1 : 0;
    p.cabinet = k === "cabinet" ? 1 : 0;
    p.cart = k === "cart" ? 2 : 0;
    p.cust = k === "customers" ? 1 : 0;
    p.hide = k === "hidden";
    p.need = k as keyof typeof INTRO;
  }
  p.kinds = Math.min(p.kinds, p.triples);
  p.cart = Math.min(p.cart, Math.floor(p.triples / 3));
  return p;
}

// ---------------------------------------------------------------- backwards play

interface BState {
  front: number[][];
  layers: number[][][];
  cart: number[];
  cust: number[];
  a: number;
  cartBudget: number;
}

/** A forward step, recorded by kind (spots are resolved when the solution is replayed). */
type Step = { t: 0; f: number; k: number; g: number } | { t: 1 } | { t: 2; f: number; k: number };

const filled = (row: number[]) => row.filter((k) => k !== EMPTY).length;
const allSame = (row: number[]) => row[0] !== EMPTY && row.every((k) => k === row[0]);

function cloneState(st: BState): BState {
  return { front: st.front.map((r) => r.slice()), layers: st.layers.map((l) => l.map((r) => r.slice())), cart: st.cart.slice(), cust: st.cust.slice(), a: st.a, cartBudget: st.cartBudget };
}

/** Undo a restock: the full front row goes back into back stock, or into the cart. */
function pushBack(st: BState, x: number, p: GenParams, rng: Rng): boolean {
  const row = st.front[x];
  const canLayer = st.layers[x].length < p.layers;
  const canCart = st.cartBudget > 0 && st.layers[x].length === 0;
  if (!canLayer && !canCart) return false;
  if (canLayer && (!canCart || rng.chance(0.3))) st.layers[x].unshift(row.slice());
  else {
    st.cart.unshift(...row);
    st.cartBudget--;
  }
  st.front[x] = [EMPTY, EMPTY, EMPTY];
  return true;
}

/** The reverse of a good leaving shelf f (moved, sold elsewhere or served). */
function giveTo(st: BState, f: number, k: number, p: GenParams, rng: Rng): boolean {
  const row = st.front[f];
  const c = filled(row);
  if (c === SPOTS) {
    // f was refilled when it emptied in the forward game.
    if (!pushBack(st, f, p, rng)) return false;
    st.front[f] = [k, EMPTY, EMPTY];
    return true;
  }
  if (c === 0) {
    // f emptied and wasn't refilled: only possible if the cart was empty then.
    if (st.cart.length) return false;
    st.front[f] = [k, EMPTY, EMPTY];
    return true;
  }
  const i = row.indexOf(EMPTY);
  row[i] = k;
  if (filled(row) === SPOTS && allSame(row)) {
    row[i] = EMPTY;
    return false;
  }
  return true;
}

/** Shelves to receive a good, best first: half-full rows, then empty ones, then full ones (a restock). */
function receivers(st: BState, R: number[], rng: Rng): number[] {
  const rank = (s: number) => {
    const c = filled(st.front[s]);
    return c === 1 || c === 2 ? 0 : c === 0 ? 1 : 2;
  };
  return rng.shuffle(R.slice()).sort((a, b) => rank(a) - rank(b));
}

function tryUnsell(st: BState, R: number[], k: number, p: GenParams, rng: Rng): Step | null {
  const gs = rng.shuffle(R.slice()).sort((a, b) => (filled(st.front[a]) === 0 ? 0 : 1) - (filled(st.front[b]) === 0 ? 0 : 1));
  for (const g of gs) {
    const c = filled(st.front[g]);
    if (c !== 0 && c !== SPOTS) continue;
    for (const f of receivers(st, R, rng).filter((x) => x !== g)) {
      const s = cloneState(st);
      if (c === SPOTS) {
        if (!pushBack(s, g, p, rng)) break;
      } else if (s.cart.length || s.layers[g].length) continue;
      s.front[g] = [k, k, EMPTY];
      if (!giveTo(s, f, k, p, rng)) continue;
      Object.assign(st, s);
      return { t: 0, f, k, g };
    }
  }
  return null;
}

function tryUnmove(st: BState, R: number[], p: GenParams, rng: Rng): Step | null {
  const gs = rng.shuffle(R.filter((g) => filled(st.front[g]) > 0));
  for (const g of gs) {
    const spots = rng.shuffle([0, 1, 2].filter((i) => st.front[g][i] !== EMPTY));
    for (const i of spots) {
      const k = st.front[g][i];
      for (const f of receivers(st, R, rng).filter((x) => x !== g)) {
        const s = cloneState(st);
        s.front[g][i] = EMPTY;
        if (filled(s.front[g]) === 0 && s.layers[g].length) continue;
        if (!giveTo(s, f, k, p, rng)) continue;
        Object.assign(st, s);
        return { t: 0, f, k, g };
      }
    }
  }
  return null;
}

function tryUnserve(st: BState, R: number[], k: number, p: GenParams, rng: Rng): Step | null {
  for (const f of receivers(st, R, rng)) {
    const s = cloneState(st);
    if (!giveTo(s, f, k, p, rng)) continue;
    s.cust.unshift(k);
    Object.assign(st, s);
    return { t: 2, f, k };
  }
  return null;
}

// ---------------------------------------------------------------- difficulty

export interface Metrics {
  goods: number;
  kinds: number;
  units: number;
  reach: number;
  layers: number;
  freeSpots: number;
  jam: number;
  specials: number;
}

export function difficultyScore(m: Metrics): number {
  return (
    0.12 * m.goods +
    0.5 * m.kinds +
    2 * (1 - m.reach / m.units) +
    0.8 * m.layers +
    1.5 / Math.max(1, m.freeSpots) +
    4 * m.jam +
    m.specials
  );
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

export function makeLevel(n: number, tag: LevelTag, p: GenParams, rng: Rng, opts: { rate?: boolean } = {}): Built | null {
  const U = p.units;
  const reach = p.turns ? reachFor(U) : U;
  const S = U * p.rows;
  const dir: 1 | -1 = rng.chance(0.5) ? 1 : -1;
  const st: BState = {
    front: Array.from({ length: S }, () => [EMPTY, EMPTY, EMPTY]),
    layers: Array.from({ length: S }, () => []),
    cart: [],
    cust: [],
    a: rng.int(0, U - 1),
    cartBudget: p.cart,
  };
  // Every kind gets at least one triple; the rest are spread at random.
  const plan: number[] = [];
  for (let k = 0; k < p.kinds; k++) plan.push(k);
  for (let i = p.kinds; i < p.triples; i++) plan.push(rng.int(0, p.kinds - 1));
  rng.shuffle(plan);
  const custPlan: number[] = Array.from({ length: p.cust }, () => rng.int(0, p.kinds - 1));
  // Freezers and cabinets are chosen first: backwards play keeps off them until, in forward time,
  // enough triples (or a triple of the key good) have been sold.
  const order = rng.shuffle([...Array(S).keys()]);
  const frz = new Map<number, number>();
  for (let i = 0; i < p.freezer && order.length > 2; i++) frz.set(order.pop()!, rng.int(2, Math.max(2, Math.min(6, Math.floor(p.triples / 2)))));
  const cab = new Set<number>();
  const key = p.cabinet ? plan[rng.int(0, plan.length - 1)] : -1;
  for (let i = 0; i < p.cabinet && order.length > 2; i++) cab.add(order.pop()!);
  const keyLeft = () => plan.filter((k) => k === key).length;
  let scramble = Math.round(p.triples * 0.4) + 2;
  const steps: Step[] = [];
  const mod = (x: number) => ((x % U) + U) % U;
  let stuck = 0;
  // The last triple is kept for the very end of backwards play, so the forward game opens with a
  // sale (an easy first move, and boxes next to it can open early).
  for (let guard = 0; plan.length || custPlan.length; guard++) {
    if (guard > 600) return null;
    const aPrev = p.turns ? mod(st.a - dir) : st.a;
    const R0: number[] = [];
    for (let s = 0; s < S; s++) if (mod(Math.floor(s / p.rows) + aPrev) < reach) R0.push(s);
    /** Shelves open at this forward time, for a step that is (or isn't) the sale of kind k. */
    const open = (sellK: number) => {
      const before = plan.length - (sellK >= 0 ? 1 : 0);
      const keyBefore = keyLeft() - (sellK === key ? 1 : 0);
      return R0.filter((x) => (!frz.has(x) || before >= frz.get(x)!) && (!cab.has(x) || keyBefore >= 1));
    };
    // Pick what to undo: sales while any are left, mixed with moves; customers now and then.
    const opts2: Array<"sell" | "move" | "serve"> = [];
    const holdLast = plan.length === 1 && (scramble > 0 || custPlan.length > 0);
    if (plan.length && !holdLast) opts2.push("sell", "sell", "sell");
    if (custPlan.length) opts2.push("serve");
    opts2.push("move");
    let step: Step | null = null;
    for (const kind of rng.shuffle(opts2)) {
      if (kind === "sell") step = tryUnsell(st, open(plan[plan.length - 1]), plan[plan.length - 1], p, rng);
      else if (kind === "serve") step = tryUnserve(st, open(-1), custPlan[custPlan.length - 1], p, rng);
      else if (st.front.some((r) => filled(r) > 0)) step = tryUnmove(st, open(-1), p, rng);
      if (step) {
        if (kind === "sell") plan.pop();
        else if (kind === "serve") custPlan.pop();
        else if (plan.length <= 1) scramble--;
        break;
      }
    }
    if (!step && holdLast) {
      step = tryUnsell(st, open(plan[0]), plan[0], p, rng);
      if (step) plan.pop();
    }
    if (!step) {
      if (!p.turns || ++stuck > 12) return null;
      step = { t: 1 };
    } else stuck = 0;
    steps.push(step);
    st.a = aPrev;
  }

  // Starting stand.
  const shelves: ShelfDef[] = st.front.map((f, s) => {
    const sh: ShelfDef = { f: f.slice() };
    if (st.layers[s].length) sh.b = st.layers[s].map((l) => l.slice());
    // A freezer or cabinet only counts if it holds goods.
    if (frz.has(s) && filled(f) > 0) sh.frz = frz.get(s);
    if (cab.has(s) && filled(f) > 0) sh.cab = 1;
    return sh;
  });
  // No shelf may start empty while it has back stock, and nothing starts as a triple.
  if (shelves.some((sh) => (filled(sh.f) === 0 && sh.b?.length) || (filled(sh.f) === SPOTS && allSame(sh.f)))) return null;
  const def: LevelDef = {
    n,
    units: U,
    rows: p.rows,
    reach,
    turns: p.turns,
    dir,
    angle: st.a,
    kinds: p.kinds,
    shelves,
    sol: [],
    par: 0,
    d: 0,
    tag,
  };
  // Too many turn-only steps make a level feel like waiting, not sorting.
  const turnSteps = steps.filter((x) => x.t === 1).length;
  if (turnSteps > Math.max(1, steps.length * 0.2)) return null;
  // ...and a long solution for few goods is a wander, not a puzzle.
  if (steps.length > p.triples * 3 + p.cust * 2 + 5) return null;
  if (st.cart.length) def.cart = st.cart;
  if (st.cust.length) def.cust = st.cust;
  if (shelves.some((sh) => sh.cab)) def.key = key;
  if (p.hide) def.hide = 1;

  // Replay forwards to resolve spots and learn when each shelf is first needed.
  const fwd = steps.slice().reverse();
  const firstTouch = new Array(S).fill(Infinity);
  const sellTimes: number[][] = Array.from({ length: S }, () => []);
  const kindFirstSale = new Array(p.kinds).fill(Infinity);
  const salesBefore: number[] = [];
  const b = newBoard(def);
  for (let t = 0; t < fwd.length; t++) {
    const x = fwd[t];
    salesBefore.push(b.sold);
    let m: Move;
    if (x.t === 1) m = [1];
    else {
      const spot = b.front.slice(x.f * SPOTS, x.f * SPOTS + SPOTS).indexOf(x.k);
      if (spot < 0) return null;
      m = x.t === 0 ? [0, x.f, spot, x.g] : [2, x.f, spot];
      firstTouch[x.f] = Math.min(firstTouch[x.f], t);
      if (x.t === 0) firstTouch[x.g] = Math.min(firstTouch[x.g], t);
    }
    const before = b.sold;
    if (!applyMove(b, m)) return null;
    if (b.sold > before && x.t === 0) {
      sellTimes[x.g].push(t);
      kindFirstSale[x.k] = Math.min(kindFirstSale[x.k], t);
    }
    def.sol.push(m);
  }
  if (!isWon(b)) return null;

  // Twists, only where the stored solution doesn't need the shelf yet.
  const taken = new Set<number>();
  const withGoods = (s: number) => filled(shelves[s].f) > 0;
  for (let i = 0; i < p.box; i++) {
    const cands = rng.shuffle([...Array(S).keys()].filter((s) => !taken.has(s) && withGoods(s) && neighbours(def, s).some((nb) => sellTimes[nb].some((t) => t < firstTouch[s]))));
    if (!cands.length) break;
    shelves[cands[0]].box = 1;
    taken.add(cands[0]);
  }
  const present = {
    turning: def.turns,
    boxes: shelves.some((s) => s.box),
    freezer: shelves.some((s) => s.frz),
    cabinet: shelves.some((s) => s.cab),
    cart: !!def.cart,
    customers: !!def.cust,
    hidden: !!def.hide,
  };
  if (p.need && !present[p.need]) return null;
  // Check the whole thing with the real rules, twists included.
  const check = newBoard(def);
  for (const m of def.sol) if (!applyMove(check, m)) return null;
  if (!isWon(check)) return null;

  // Rate.
  const start = newBoard(def);
  let freeSpots = 0;
  for (let s = 0; s < S; s++) if (usable(start, s)) freeSpots += SPOTS - filled(start.front.slice(s * SPOTS, s * SPOTS + SPOTS));
  def.par = def.sol.length;
  const jam = opts.rate === false ? 0.5 : jamRate(start, 6, () => rng.next());
  const goods = st.front.reduce((a, r) => a + filled(r), 0) + st.layers.reduce((a, l) => a + l.length * SPOTS, 0) + st.cart.length;
  const specials =
    0.6 * shelves.filter((s) => s.box).length +
    0.8 * shelves.filter((s) => s.frz).length +
    1.0 * (def.key !== undefined ? 1 : 0) +
    1.0 * (def.cart ? 1 : 0) +
    1.0 * (def.cust?.length ?? 0) +
    (def.hide ? 1 : 0);
  const metrics: Metrics = {
    goods,
    kinds: p.kinds,
    units: U,
    reach,
    layers: Math.max(0, ...st.layers.map((l) => l.length)),
    freeSpots,
    jam,
    specials,
  };
  def.d = Math.round(difficultyScore(metrics) * 100) / 100;
  return { def, metrics };
}

// ---------------------------------------------------------------- picking

function percentileFor(n: number, tag: LevelTag): number {
  if (Object.values(INTRO).includes(n)) return 0.1;
  if (tag === "breather") return 0.1;
  if (tag === "tricky") return 0.85;
  if (tag === "grand") return 0.95;
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
  const want = opts.candidates ?? 5;
  const rated: Built[] = [];
  for (let attempts = 0; rated.length < want && attempts < want * 30; attempts++) {
    const built = makeLevel(n, tag, paramsFor(n, rng), rng);
    if (built) rated.push(built);
  }
  while (!rated.length) {
    const built = makeLevel(n, tag, { units: 5, rows: 1, turns: true, kinds: 3, triples: 4, free: 6, layers: 0, box: 0, freezer: 0, cabinet: 0, cart: 0, cust: 0, hide: false }, rng);
    if (built) rated.push(built);
  }
  return pickFrom(rated, percentileFor(n, tag));
}

/** Daily Restock: one mid-curve stand per UTC day, the same for everyone, with one twist. */
export function generateDaily(dayKey: string, opts: { candidates?: number } = {}): Built {
  const rng = new Rng(seedOf(dayKey, "aisle-daily"));
  const want = opts.candidates ?? 5;
  const rated: Built[] = [];
  for (let attempts = 0; rated.length < want && attempts < want * 30; attempts++) {
    const p = paramsFor(119, rng);
    p.cust = 0;
    p.hide = false;
    p.need = undefined;
    const built = makeLevel(0, "daily", p, rng);
    if (built) rated.push(built);
  }
  while (!rated.length) {
    const built = makeLevel(0, "daily", { units: 6, rows: 1, turns: true, kinds: 5, triples: 8, free: 5, layers: 1, box: 1, freezer: 0, cabinet: 0, cart: 0, cust: 0, hide: false }, rng);
    if (built) rated.push(built);
  }
  return pickFrom(rated, 0.6);
}

/** Used by Restack: deals the goods left on a board into a new start that the generator can solve. */
export function freeSpotsOf(b: Board): number {
  let n = 0;
  for (let s = 0; s < shelfCount(b.def); s++) if (usable(b, s) && freeSpot(b, s) >= 0) n += SPOTS - b.front.slice(s * SPOTS, s * SPOTS + SPOTS).filter((k) => k !== EMPTY).length;
  return n;
}
