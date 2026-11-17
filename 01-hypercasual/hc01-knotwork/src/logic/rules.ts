// Knotwork rules. Pure functions shared by the game, the solver worker and the pack builder.
//
// A board is a set of needles. Each needle holds loops bottom -> top. A colour is complete
// when L loops that all share that colour sit on one needle with nothing else; the needle then
// locks. The level is won when every colour is complete.
//
// Loop values (numbers, so the solver can hash them cheaply):
//   0..15            plain loop of that colour slot
//   16 + a*16 + b    twisted loop, colours a < b; it counts as either colour
//   | KNOT (512)     this loop is tied to the loop directly above it; they always move together
// Hidden loops are tracked separately (Board.hidden) because the solver ignores them.

export type LevelTag = "normal" | "breather" | "tricky" | "masterpiece" | "tutorial" | "moth" | "daily";

export const KNOT = 512;
export const TWIST_BASE = 16;
export const MOTH_TIMER = 6;
export const BASKET_SIZE = 2;

/** A level as stored in packs. */
export interface LevelDef {
  n: number;
  /** Capacity of each needle. */
  caps: number[];
  /**
   * Each needle bottom -> top: 'a'.. = colour slot, UPPERCASE = hidden,
   * "(ab)" = twisted loop of a and b, "~" after a loop = tied to the loop above it.
   */
  stacks: string[];
  /** Loops per colour. */
  L: number;
  par: number;
  d: number;
  tag: LevelTag;
  /** Moth start: [needle, moves left]. */
  moth?: [number, number];
}

export interface MothState {
  needle: number;
  count: number;
}

export interface Board {
  caps: number[];
  stacks: number[][];
  hidden: boolean[][];
  locked: boolean[];
  basket: number[];
  L: number;
  k: number;
  moth: MothState | null;
}

export type Move =
  | { kind: "move"; from: number; to: number }
  | { kind: "basket"; index: number; to: number };

// ---------------------------------------------------------------- loop values

export function baseOf(v: number): number {
  return v & ~KNOT;
}

export function isTied(v: number): boolean {
  return (v & KNOT) !== 0;
}

export function isTwisted(v: number): boolean {
  return baseOf(v) >= TWIST_BASE;
}

export function makeTwist(a: number, b: number): number {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  return TWIST_BASE + lo * 16 + hi;
}

export function coloursOf(v: number): number[] {
  const b = baseOf(v);
  if (b < TWIST_BASE) return [b];
  const x = b - TWIST_BASE;
  return [x >> 4, x & 15];
}

/** Bitmask of the colours a loop counts as. */
export function maskOf(v: number): number {
  const b = baseOf(v);
  if (b < TWIST_BASE) return 1 << b;
  const x = b - TWIST_BASE;
  return (1 << (x >> 4)) | (1 << (x & 15));
}

function lowestBit(mask: number): number {
  return 31 - Math.clz32(mask & -mask);
}

// ---------------------------------------------------------------- stack helpers (shared with the solver)

/** Loops that move together from the top, and the colours they all share. */
export function runOf(stack: number[], hidden?: boolean[]): { n: number; mask: number } {
  const len = stack.length;
  if (!len) return { n: 0, mask: 0 };
  let mask = maskOf(stack[len - 1]);
  let n = 1;
  for (let j = len - 2; j >= 0; j--) {
    if (hidden?.[j]) break;
    const m = mask & maskOf(stack[j]);
    if (!m) break;
    mask = m;
    n++;
  }
  return { n, mask };
}

/** How many of a run can move into `space` without splitting a knot. */
export function movableAmount(stack: number[], run: number, space: number): number {
  let a = Math.min(run, space);
  while (a > 0 && stack.length - a - 1 >= 0 && isTied(stack[stack.length - a - 1])) a--;
  return a;
}

export function accepts(target: number[], cap: number, mask: number): boolean {
  if (target.length >= cap) return false;
  return target.length === 0 || (maskOf(target[target.length - 1]) & mask) !== 0;
}

/** Colour this needle completes, or -1. */
export function completeColour(stack: number[], L: number): number {
  if (stack.length !== L) return -1;
  let mask = 0xffff;
  for (const v of stack) mask &= maskOf(v);
  return mask ? lowestBit(mask) : -1;
}

export function isCompleteStack(stack: number[], L: number): boolean {
  return completeColour(stack, L) >= 0;
}

/** Remove loop j from a stack, untying the loop below if it was tied to it. */
export function removeAt(stack: number[], j: number): number {
  const [v] = stack.splice(j, 1);
  if (j - 1 >= 0 && isTied(stack[j - 1])) stack[j - 1] = baseOf(stack[j - 1]);
  return baseOf(v);
}

// ---------------------------------------------------------------- moth

/** Where a moth flies: the fullest open needle not in `exclude` (ties: lowest index). */
export function pickMothNeedle(stacks: number[][], L: number, locked: boolean[] | undefined, exclude: number[]): number {
  let best = -1;
  for (let i = 0; i < stacks.length; i++) {
    if (exclude.includes(i) || !stacks[i].length || locked?.[i] || isCompleteStack(stacks[i], L)) continue;
    if (best < 0 || stacks[i].length > stacks[best].length) best = i;
  }
  return best;
}

/** The moth moves away if its needle was used or finished. Returns the new moth (or null if it left). */
export function relocateMoth(moth: MothState, used: number[], stacks: number[][], L: number, locked?: boolean[]): MothState | null {
  const done = locked?.[moth.needle] || isCompleteStack(stacks[moth.needle], L) || !stacks[moth.needle].length;
  if (!used.includes(moth.needle) && !done) return moth;
  let n = pickMothNeedle(stacks, L, locked, [moth.needle, ...used]);
  if (n < 0) n = pickMothNeedle(stacks, L, locked, [moth.needle]);
  return n < 0 ? null : { needle: n, count: MOTH_TIMER };
}

/** After a move: relocate if used, otherwise count down. chewed = the timer ran out. */
export function stepMoth(moth: MothState | null, used: number[], stacks: number[][], L: number, locked?: boolean[]): { moth: MothState | null; chewed: boolean } {
  if (!moth) return { moth: null, chewed: false };
  const moved = relocateMoth(moth, used, stacks, L, locked);
  if (moved !== moth) return { moth: moved, chewed: false };
  const count = moth.count - 1;
  return { moth: { needle: moth.needle, count: Math.max(0, count) }, chewed: count <= 0 };
}

// ---------------------------------------------------------------- encoding

export function parseStack(s: string): { loops: number[]; hidden: boolean[] } {
  const loops: number[] = [];
  const hidden: boolean[] = [];
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "~") {
      loops[loops.length - 1] |= KNOT;
    } else if (ch === "(") {
      const a = s.charCodeAt(i + 1) - 97;
      const b = s.charCodeAt(i + 2) - 97;
      loops.push(makeTwist(a, b));
      hidden.push(false);
      i += 3;
    } else {
      const lower = ch.toLowerCase();
      loops.push(lower.charCodeAt(0) - 97);
      hidden.push(ch !== lower);
    }
  }
  return { loops, hidden };
}

export function encodeStack(loops: number[], hidden?: boolean[]): string {
  let out = "";
  loops.forEach((v, j) => {
    const cs = coloursOf(v);
    if (cs.length === 2) out += `(${String.fromCharCode(97 + cs[0])}${String.fromCharCode(97 + cs[1])})`;
    else {
      const ch = String.fromCharCode(97 + cs[0]);
      out += hidden?.[j] ? ch.toUpperCase() : ch;
    }
    if (isTied(v)) out += "~";
  });
  return out;
}

export function encodeStacks(stacks: number[][], hidden?: boolean[][]): string[] {
  return stacks.map((s, i) => encodeStack(s, hidden?.[i]));
}

export function decodeLevel(def: LevelDef): Board {
  const stacks: number[][] = [];
  const hidden: boolean[][] = [];
  const colours = new Set<number>();
  for (const s of def.stacks) {
    const p = parseStack(s);
    stacks.push(p.loops);
    hidden.push(p.hidden);
    for (const v of p.loops) for (const c of coloursOf(v)) colours.add(c);
  }
  const board: Board = {
    caps: def.caps.slice(),
    stacks,
    hidden,
    locked: stacks.map(() => false),
    basket: [],
    L: def.L,
    k: colours.size,
    moth: def.moth ? { needle: def.moth[0], count: def.moth[1] } : null,
  };
  for (let i = 0; i < stacks.length; i++) revealTop(board, i);
  return board;
}

export function cloneBoard(b: Board): Board {
  return {
    caps: b.caps.slice(),
    stacks: b.stacks.map((s) => s.slice()),
    hidden: b.hidden.map((h) => h.slice()),
    locked: b.locked.slice(),
    basket: b.basket.slice(),
    L: b.L,
    k: b.k,
    moth: b.moth ? { ...b.moth } : null,
  };
}

// ---------------------------------------------------------------- board rules

export function top(stack: number[]): number {
  return stack.length ? stack[stack.length - 1] : -1;
}

/** Number of revealed loops that move together from the top of needle i. */
export function topRun(b: Board, i: number): number {
  const s = b.stacks[i];
  const run = runOf(s, b.hidden[i]);
  // Never offer a lift that can't move as a whole knot.
  return movableAmount(s, run.n, run.n) || 0;
}

function revealTop(b: Board, i: number): void {
  const h = b.hidden[i];
  if (h.length) h[h.length - 1] = false;
}

/** How many loops a move would carry (0 = illegal). */
export function moveAmount(b: Board, m: Move): number {
  if (m.kind === "basket") {
    if (m.index < 0 || m.index >= b.basket.length || b.locked[m.to]) return 0;
    return accepts(b.stacks[m.to], b.caps[m.to], maskOf(b.basket[m.index])) ? 1 : 0;
  }
  const { from, to } = m;
  if (from === to || b.locked[from] || b.locked[to]) return 0;
  const fs = b.stacks[from];
  if (!fs.length) return 0;
  const run = runOf(fs, b.hidden[from]);
  if (!accepts(b.stacks[to], b.caps[to], run.mask)) return 0;
  return movableAmount(fs, run.n, b.caps[to] - b.stacks[to].length);
}

export interface MoveResult {
  moved: number;
  /** Needles that became complete (locked) because of this move. */
  completed: number[];
  /** Colour slots completed by this move. */
  completedColours: number[];
  /** The moth's timer ran out on this move. */
  mothChewed: boolean;
}

function lockFinished(b: Board, needles: number[], res: { completed: number[]; completedColours: number[] }): void {
  for (const i of needles) {
    if (b.locked[i]) continue;
    const c = completeColour(b.stacks[i], b.L);
    if (c >= 0) {
      b.locked[i] = true;
      b.hidden[i] = b.hidden[i].map(() => false);
      res.completed.push(i);
      res.completedColours.push(c);
    }
  }
}

/** Applies a move in place. Returns what happened; moved = 0 if illegal. */
export function applyMove(b: Board, m: Move): MoveResult {
  const amount = moveAmount(b, m);
  const res: MoveResult = { moved: 0, completed: [], completedColours: [], mothChewed: false };
  if (!amount) return res;
  if (m.kind === "basket") {
    const c = b.basket.splice(m.index, 1)[0];
    b.stacks[m.to].push(c);
    b.hidden[m.to].push(false);
  } else {
    const fs = b.stacks[m.from];
    const fh = b.hidden[m.from];
    const moving = fs.splice(fs.length - amount, amount);
    const movingHidden = fh.splice(fh.length - amount, amount);
    b.stacks[m.to].push(...moving);
    b.hidden[m.to].push(...movingHidden);
    revealTop(b, m.from);
  }
  res.moved = amount;
  const used = m.kind === "basket" ? [m.to] : [m.from, m.to];
  lockFinished(b, used, res);
  const step = stepMoth(b.moth, used, b.stacks, b.L, b.locked);
  b.moth = step.moth;
  res.mothChewed = step.chewed;
  return res;
}

export function legalMoves(b: Board): Move[] {
  const out: Move[] = [];
  for (let f = 0; f < b.stacks.length; f++) {
    for (let t = 0; t < b.stacks.length; t++) {
      const m: Move = { kind: "move", from: f, to: t };
      if (moveAmount(b, m)) out.push(m);
    }
  }
  for (let i = 0; i < b.basket.length; i++) {
    for (let t = 0; t < b.stacks.length; t++) {
      const m: Move = { kind: "basket", index: i, to: t };
      if (moveAmount(b, m)) out.push(m);
    }
  }
  return out;
}

export function completedCount(b: Board): number {
  let n = 0;
  for (const l of b.locked) if (l) n++;
  return n;
}

export function isWon(b: Board): boolean {
  return completedCount(b) >= b.k;
}

/** Stuck = not won and no legal move that changes anything. */
export function isStuck(b: Board): boolean {
  if (isWon(b)) return false;
  return legalMoves(b).length === 0;
}

// ---------------------------------------------------------------- power-ups (each mutates the board in place)

export function addSpareNeedle(b: Board, cap = 4): number {
  b.caps.push(cap);
  b.stacks.push([]);
  b.hidden.push([]);
  b.locked.push(false);
  return b.stacks.length - 1;
}

export function revealAll(b: Board): void {
  b.hidden = b.hidden.map((h) => h.map(() => false));
}

/** Snip: cut loop at (needle, index) into the basket. Cuts any knot too. */
export function snip(b: Board, needle: number, index: number): boolean {
  if (b.basket.length >= BASKET_SIZE || b.locked[needle]) return false;
  const s = b.stacks[needle];
  if (index < 0 || index >= s.length) return false;
  b.basket.push(removeAt(s, index));
  b.hidden[needle].splice(index, 1);
  revealTop(b, needle);
  const res = { completed: [] as number[], completedColours: [] as number[] };
  lockFinished(b, [needle], res);
  if (b.moth) b.moth = relocateMoth(b.moth, [needle], b.stacks, b.L, b.locked);
  return true;
}

/** Where the loops of `colour` are: plain ones first, then twisted ones nearest the top. */
export function swiftPicks(b: Board, colour: number): { positions: Array<[number, number]>; basket: number[] } {
  const plain: Array<[number, number]> = [];
  const twisted: Array<[number, number, number]> = [];
  b.stacks.forEach((s, i) => {
    if (b.locked[i]) return;
    s.forEach((v, j) => {
      if (baseOf(v) === colour) plain.push([i, j]);
      else if (isTwisted(v) && coloursOf(v).includes(colour)) twisted.push([i, j, s.length - 1 - j]);
    });
  });
  const basket: number[] = [];
  b.basket.forEach((v, i) => {
    if (baseOf(v) === colour) basket.push(i);
  });
  let have = plain.length + basket.length;
  twisted.sort((x, y) => x[2] - y[2]);
  const positions = plain.slice();
  for (const [i, j] of twisted) {
    if (have >= b.L) break;
    positions.push([i, j]);
    have++;
  }
  b.basket.forEach((v, i) => {
    if (have < b.L && isTwisted(v) && coloursOf(v).includes(colour) && !basket.includes(i)) {
      basket.push(i);
      have++;
    }
  });
  return { positions, basket };
}

/**
 * Yarn Swift: wind the loops of `colour` onto one needle and lock it.
 * Uses an empty needle if there is one, otherwise adds a new needle.
 * Returns the needle index that now holds the colour.
 */
export function yarnSwift(b: Board, colour: number): number {
  const picks = swiftPicks(b, colour);
  const byNeedle = new Map<number, number[]>();
  for (const [i, j] of picks.positions) byNeedle.set(i, [...(byNeedle.get(i) ?? []), j]);
  const gathered: number[] = [];
  for (const [i, js] of byNeedle) {
    js.sort((x, y) => y - x);
    for (const j of js) {
      gathered.push(removeAt(b.stacks[i], j));
      b.hidden[i].splice(j, 1);
    }
    revealTop(b, i);
  }
  for (const bi of [...picks.basket].sort((x, y) => y - x)) gathered.push(b.basket.splice(bi, 1)[0]);
  let target = b.stacks.findIndex((s, i) => !b.locked[i] && s.length === 0 && b.caps[i] >= b.L);
  if (target < 0) target = addSpareNeedle(b, b.L);
  // Show the colour plainly on the finished needle.
  b.stacks[target] = gathered.map(() => colour);
  b.hidden[target] = gathered.map(() => false);
  const res = { completed: [] as number[], completedColours: [] as number[] };
  lockFinished(b, b.stacks.map((_, i) => i), res);
  if (b.moth) b.moth = relocateMoth(b.moth, [target, ...byNeedle.keys()], b.stacks, b.L, b.locked);
  return target;
}

/** Colours still not complete. */
export function openColours(b: Board): number[] {
  const done = new Set<number>();
  b.locked.forEach((l, i) => {
    if (l && b.stacks[i].length) done.add(completeColour(b.stacks[i], b.L));
  });
  const all = new Set<number>();
  for (const s of b.stacks) for (const v of s) for (const c of coloursOf(v)) all.add(c);
  for (const v of b.basket) for (const c of coloursOf(v)) all.add(c);
  return [...all].filter((c) => !done.has(c)).sort((a, c) => a - c);
}
