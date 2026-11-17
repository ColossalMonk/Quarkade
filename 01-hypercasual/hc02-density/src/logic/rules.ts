// Density rules (DESIGN.md §4). Pure functions shared by the game, the solver worker and the
// pack builder.
//
// A level has k liquid "slots" (0..k-1). Each slot has a weight class:
//   1 Foam < 2 Oil < 3 Water < 4 Syrup < 5 Mercury.
// A flask holds units bottom -> top and is always settled by weight (heaviest at the bottom);
// within one weight, units keep the order they arrived in.
//
// Pouring takes the top run (same slot, revealed) of the source. In the target it sinks past every
// lighter unit and rests on the first unit at least as heavy (or the bottom). It may rest only on
// its own colour or on something heavier, never on a different liquid of the same weight.
// A flask holding all L units of one liquid and nothing else is sealed (locked).
// Corked flasks can't be used until `cork` flasks have been sealed.

export type LevelTag = "normal" | "breather" | "tricky" | "masterpiece" | "tutorial" | "daily";

export const PIPETTE_SIZE = 1;

/** A level as stored in packs. */
export interface LevelDef {
  n: number;
  caps: number[];
  /** Each flask bottom -> top: 'a'.. = slot, UPPERCASE = murky. Already settled by weight. */
  stacks: string[];
  /** Weight class (1-5) of each slot. */
  classes: number[];
  L: number;
  par: number;
  d: number;
  tag: LevelTag;
  /** Corked flasks: [flask, seals needed before it opens]. */
  corks?: Array<[number, number]>;
}

export interface Board {
  caps: number[];
  stacks: number[][];
  hidden: boolean[][];
  locked: boolean[];
  /** Seals still needed before each flask uncorks (0 = open). */
  corks: number[];
  sealedCount: number;
  pipette: number[];
  classes: number[];
  L: number;
  k: number;
}

export type Move =
  | { kind: "pour"; from: number; to: number }
  | { kind: "drop"; to: number };

// ---------------------------------------------------------------- shared stack helpers

/** Index where a unit of weight w lands in `stack` (0 = bottom). */
export function landingIndex(stack: number[], w: number, classes: number[]): number {
  for (let j = stack.length - 1; j >= 0; j--) if (classes[stack[j]] >= w) return j + 1;
  return 0;
}

/** May `slot` be poured into `stack` (capacity `cap`)? Returns how many units fit (0 = no). */
export function fitAmount(stack: number[], cap: number, slot: number, run: number, classes: number[]): number {
  const space = cap - stack.length;
  if (space <= 0 || run <= 0) return 0;
  const w = classes[slot];
  const at = landingIndex(stack, w, classes);
  if (at > 0) {
    const below = stack[at - 1];
    if (below !== slot && classes[below] === w) return 0; // same weight, different liquid
  }
  return Math.min(run, space);
}

/** Top run of a stack (same slot from the top; murky units stop the run). */
export function runOf(stack: number[], hidden?: boolean[]): number {
  const n = stack.length;
  if (!n) return 0;
  const s = stack[n - 1];
  let r = 0;
  for (let j = n - 1; j >= 0 && stack[j] === s && !hidden?.[j]; j--) r++;
  return Math.max(1, r);
}

/** Insert `amount` units of `slot` where they land. Mutates and returns the landing index. */
export function insertUnits(stack: number[], slot: number, amount: number, classes: number[], hidden?: boolean[]): number {
  const at = landingIndex(stack, classes[slot], classes);
  stack.splice(at, 0, ...new Array(amount).fill(slot));
  hidden?.splice(at, 0, ...new Array(amount).fill(false));
  return at;
}

export function isSealedStack(stack: number[], L: number): boolean {
  if (stack.length !== L) return false;
  for (let j = 1; j < stack.length; j++) if (stack[j] !== stack[0]) return false;
  return true;
}

/** Settle a dealt flask by weight, keeping deal order within a weight. */
export function settle(stack: number[], classes: number[]): number[] {
  return stack
    .map((s, i) => ({ s, i }))
    .sort((a, b) => classes[b.s] - classes[a.s] || a.i - b.i)
    .map((x) => x.s);
}

// ---------------------------------------------------------------- encoding

export function decodeLevel(def: LevelDef): Board {
  const stacks: number[][] = [];
  const hidden: boolean[][] = [];
  for (const s of def.stacks) {
    stacks.push([...s].map((ch) => ch.toLowerCase().charCodeAt(0) - 97));
    hidden.push([...s].map((ch) => ch !== ch.toLowerCase()));
  }
  const corks = def.caps.map(() => 0);
  for (const [f, c] of def.corks ?? []) corks[f] = c;
  const b: Board = {
    caps: def.caps.slice(),
    stacks,
    hidden,
    locked: stacks.map(() => false),
    corks,
    sealedCount: 0,
    pipette: [],
    classes: def.classes.slice(),
    L: def.L,
    k: def.classes.length,
  };
  for (let i = 0; i < stacks.length; i++) revealTop(b, i);
  return b;
}

export function encodeStacks(stacks: number[][], hidden?: boolean[][]): string[] {
  return stacks.map((s, i) =>
    s
      .map((c, j) => {
        const ch = String.fromCharCode(97 + c);
        return hidden?.[i]?.[j] ? ch.toUpperCase() : ch;
      })
      .join(""),
  );
}

export function cloneBoard(b: Board): Board {
  return {
    caps: b.caps.slice(),
    stacks: b.stacks.map((s) => s.slice()),
    hidden: b.hidden.map((h) => h.slice()),
    locked: b.locked.slice(),
    corks: b.corks.slice(),
    sealedCount: b.sealedCount,
    pipette: b.pipette.slice(),
    classes: b.classes,
    L: b.L,
    k: b.k,
  };
}

// ---------------------------------------------------------------- board rules

function revealTop(b: Board, i: number): void {
  const h = b.hidden[i];
  if (h.length) h[h.length - 1] = false;
}

export function usable(b: Board, i: number): boolean {
  return !b.locked[i] && b.corks[i] <= 0;
}

/** Revealed run that would pour from flask i. */
export function topRun(b: Board, i: number): number {
  if (!usable(b, i) || !b.stacks[i].length) return 0;
  return runOf(b.stacks[i], b.hidden[i]);
}

export function moveAmount(b: Board, m: Move): number {
  if (!usable(b, m.to)) return 0;
  if (m.kind === "drop") {
    if (!b.pipette.length) return 0;
    return fitAmount(b.stacks[m.to], b.caps[m.to], b.pipette[0], 1, b.classes);
  }
  if (m.from === m.to || !usable(b, m.from)) return 0;
  const fs = b.stacks[m.from];
  if (!fs.length) return 0;
  return fitAmount(b.stacks[m.to], b.caps[m.to], fs[fs.length - 1], topRun(b, m.from), b.classes);
}

export interface MoveResult {
  moved: number;
  slot: number;
  /** Where the poured units landed in the target (index from the bottom). */
  landedAt: number;
  sealed: number[];
  sealedSlots: number[];
  uncorked: number[];
}

function sealCheck(b: Board, flasks: number[], res: { sealed: number[]; sealedSlots: number[]; uncorked: number[] }): void {
  for (const i of flasks) {
    if (b.locked[i] || !isSealedStack(b.stacks[i], b.L)) continue;
    b.locked[i] = true;
    b.hidden[i] = b.hidden[i].map(() => false);
    b.sealedCount++;
    res.sealed.push(i);
    res.sealedSlots.push(b.stacks[i][0]);
    b.corks.forEach((c, j) => {
      if (c > 0) {
        b.corks[j] = c - 1;
        if (c - 1 === 0) res.uncorked.push(j);
      }
    });
  }
}

export function applyMove(b: Board, m: Move): MoveResult {
  const amount = moveAmount(b, m);
  const res: MoveResult = { moved: 0, slot: -1, landedAt: -1, sealed: [], sealedSlots: [], uncorked: [] };
  if (!amount) return res;
  let slot: number;
  const touched: number[] = [m.to];
  if (m.kind === "drop") {
    slot = b.pipette.shift()!;
  } else {
    const fs = b.stacks[m.from];
    slot = fs[fs.length - 1];
    fs.splice(fs.length - amount, amount);
    b.hidden[m.from].splice(b.hidden[m.from].length - amount, amount);
    revealTop(b, m.from);
    touched.push(m.from);
  }
  res.landedAt = insertUnits(b.stacks[m.to], slot, amount, b.classes, b.hidden[m.to]);
  res.moved = amount;
  res.slot = slot;
  sealCheck(b, touched, res);
  return res;
}

export function legalMoves(b: Board): Move[] {
  const out: Move[] = [];
  for (let f = 0; f < b.stacks.length; f++) {
    for (let t = 0; t < b.stacks.length; t++) {
      const m: Move = { kind: "pour", from: f, to: t };
      if (moveAmount(b, m)) out.push(m);
    }
  }
  if (b.pipette.length) {
    for (let t = 0; t < b.stacks.length; t++) {
      const m: Move = { kind: "drop", to: t };
      if (moveAmount(b, m)) out.push(m);
    }
  }
  return out;
}

export function isWon(b: Board): boolean {
  return b.sealedCount >= b.k;
}

export function isStuck(b: Board): boolean {
  return !isWon(b) && legalMoves(b).length === 0;
}

// ---------------------------------------------------------------- power-ups

export function addSpareFlask(b: Board, cap = 4): number {
  b.caps.push(cap);
  b.stacks.push([]);
  b.hidden.push([]);
  b.locked.push(false);
  b.corks.push(0);
  return b.stacks.length - 1;
}

export function revealAll(b: Board): void {
  b.hidden = b.hidden.map((h) => h.map(() => false));
}

/** Pipette: draw one unit from any layer of an open flask. */
export function pipette(b: Board, flask: number, index: number): { ok: boolean; sealed: number[]; sealedSlots: number[]; uncorked: number[] } {
  const res = { ok: false, sealed: [] as number[], sealedSlots: [] as number[], uncorked: [] as number[] };
  if (b.pipette.length >= PIPETTE_SIZE || !usable(b, flask)) return res;
  const s = b.stacks[flask];
  if (index < 0 || index >= s.length) return res;
  b.pipette.push(s.splice(index, 1)[0]);
  b.hidden[flask].splice(index, 1);
  revealTop(b, flask);
  res.ok = true;
  sealCheck(b, [flask], res);
  return res;
}

/** Centrifuge: within each weight, group the same liquids together (biggest group first). Reveals the flask. */
export function centrifuge(b: Board, flask: number): { sealed: number[]; sealedSlots: number[]; uncorked: number[] } {
  const res = { sealed: [] as number[], sealedSlots: [] as number[], uncorked: [] as number[] };
  if (!usable(b, flask)) return res;
  const s = b.stacks[flask];
  const out: number[] = [];
  const weights = [...new Set(s.map((u) => b.classes[u]))].sort((a, c) => c - a);
  for (const w of weights) {
    const zone = s.filter((u) => b.classes[u] === w);
    const counts = new Map<number, number>();
    const firstAt = new Map<number, number>();
    zone.forEach((u, i) => {
      counts.set(u, (counts.get(u) ?? 0) + 1);
      if (!firstAt.has(u)) firstAt.set(u, i);
    });
    const order = [...counts.keys()].sort((a, c) => counts.get(c)! - counts.get(a)! || firstAt.get(a)! - firstAt.get(c)!);
    for (const u of order) for (let n = 0; n < counts.get(u)!; n++) out.push(u);
  }
  b.stacks[flask] = out;
  b.hidden[flask] = out.map(() => false);
  sealCheck(b, [flask], res);
  return res;
}
