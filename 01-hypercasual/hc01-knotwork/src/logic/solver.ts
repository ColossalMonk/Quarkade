// Weighted A* solver. Works on true colours (ignores hidden-ness), so par is the target for a
// player who reads the board well. Understands twisted loops, knots, the basket and moths.
// Used for par, hints, and checking every level is solvable.

import type { Board, Move, MothState } from "./rules.ts";
import { accepts, baseOf, completeColour, isTwisted, maskOf, movableAmount, runOf, stepMoth } from "./rules.ts";

export interface SolveOptions {
  /** Heuristic weight: 1 = optimal (slow), 1.5 = near-optimal (fast). */
  weight?: number;
  maxNodes?: number;
}

export interface SolveResult {
  solved: boolean;
  moves: Move[];
  nodes: number;
}

interface Node {
  stacks: number[][];
  basket: number[];
  moth: MothState | null;
  g: number;
  f: number;
  parent: Node | null;
  move: Move | null;
}

class Heap {
  items: Node[] = [];
  push(n: Node): void {
    const a = this.items;
    a.push(n);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p].f <= a[i].f) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop(): Node | undefined {
    const a = this.items;
    if (!a.length) return undefined;
    const topNode = a[0];
    const last = a.pop()!;
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l].f < a[m].f) m = l;
        if (r < a.length && a[r].f < a[m].f) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return topNode;
  }
  get size(): number {
    return this.items.length;
  }
}

/** Number of groups that must move separately (breaks where no colour is shared). */
function runCount(s: number[]): number {
  if (!s.length) return 0;
  let r = 1;
  let mask = maskOf(s[0]);
  for (let j = 1; j < s.length; j++) {
    const m = mask & maskOf(s[j]);
    if (m) mask = m;
    else {
      r++;
      mask = maskOf(s[j]);
    }
  }
  return r;
}

/** Lower bound on moves left (twisted loops treated as joining anything they share a colour with). */
export function heuristic(stacks: number[][], basket: number[], L: number): number {
  let hRuns = 0;
  const frags = new Map<number, number>();
  for (const s of stacks) {
    if (!s.length || completeColour(s, L) >= 0) continue;
    hRuns += runCount(s) - 1;
    let prev = -1;
    for (const v of s) {
      if (isTwisted(v)) continue; // transparent for fragment counting
      const c = baseOf(v);
      if (c !== prev) frags.set(c, (frags.get(c) ?? 0) + 1);
      prev = c;
    }
  }
  for (const v of basket) if (!isTwisted(v)) frags.set(baseOf(v), (frags.get(baseOf(v)) ?? 0) + 1);
  let hFrag = 0;
  for (const r of frags.values()) hFrag += r - 1;
  return Math.max(hRuns + basket.length, hFrag);
}

function keyOf(stacks: number[][], caps: number[], basket: number[], moth: MothState | null, L: number): string {
  const parts: string[] = [];
  for (let i = 0; i < stacks.length; i++) {
    const s = stacks[i];
    if (completeColour(s, L) >= 0) continue; // done needles don't matter
    parts.push(caps[i] + ":" + s.join(",") + (moth && moth.needle === i ? "*" + moth.count : ""));
  }
  parts.sort();
  return parts.join("|") + "#" + basket.slice().sort().join(",");
}

function isSolvedPlain(stacks: number[][], basket: number[], L: number): boolean {
  if (basket.length) return false;
  for (const s of stacks) if (s.length && completeColour(s, L) < 0) return false;
  return true;
}

interface Succ {
  stacks: number[][];
  basket: number[];
  moth: MothState | null;
  move: Move;
}

function successors(node: Node, caps: number[], L: number): Succ[] {
  const out: Succ[] = [];
  const st = node.stacks;
  const n = st.length;
  const seenEmptyCap = new Set<number>();
  const emptyTargets: number[] = [];
  for (let t = 0; t < n; t++) {
    if (st[t].length === 0 && !seenEmptyCap.has(caps[t])) {
      seenEmptyCap.add(caps[t]);
      emptyTargets.push(t);
    }
  }
  const done = st.map((s) => completeColour(s, L) >= 0);
  const push = (stacks: number[][], basket: number[], used: number[], move: Move) => {
    const step = stepMoth(node.moth, used, stacks, L);
    if (step.chewed) return; // the moth would eat a loop: not allowed
    out.push({ stacks, basket, moth: step.moth, move });
  };
  // Basket -> needle
  for (let bi = 0; bi < node.basket.length; bi++) {
    const v = node.basket[bi];
    for (let t = 0; t < n; t++) {
      if (done[t]) continue;
      if (st[t].length === 0 && !emptyTargets.includes(t)) continue;
      if (!accepts(st[t], caps[t], maskOf(v))) continue;
      const stacks = st.map((s, i) => (i === t ? [...s, v] : s));
      const basket = node.basket.filter((_, i) => i !== bi);
      push(stacks, basket, [t], { kind: "basket", index: bi, to: t });
    }
  }
  for (let f = 0; f < n; f++) {
    const fs = st[f];
    if (!fs.length || done[f]) continue;
    const run = runOf(fs);
    const uniform = run.n === fs.length;
    for (let t = 0; t < n; t++) {
      if (t === f || done[t]) continue;
      const ts = st[t];
      if (ts.length === 0) {
        if (!emptyTargets.includes(t)) continue;
        // Moving a whole uniform needle into an empty needle of the same size changes nothing
        // (unless a moth is waiting to be shooed off it).
        if (uniform && caps[t] <= caps[f] && !(node.moth && node.moth.needle === f)) continue;
      }
      if (!accepts(ts, caps[t], run.mask)) continue;
      const amount = movableAmount(fs, run.n, caps[t] - ts.length);
      if (!amount) continue;
      const nf = fs.slice(0, fs.length - amount);
      const nt = ts.concat(fs.slice(fs.length - amount));
      const stacks = st.map((s, i) => (i === f ? nf : i === t ? nt : s));
      push(stacks, node.basket, [f, t], { kind: "move", from: f, to: t });
    }
  }
  return out;
}

export function solve(board: Pick<Board, "stacks" | "caps" | "L" | "basket"> & { moth?: MothState | null }, opts: SolveOptions = {}): SolveResult {
  const weight = opts.weight ?? 1.5;
  const maxNodes = opts.maxNodes ?? 200000;
  const L = board.L;
  const caps = board.caps;
  const start: Node = {
    stacks: board.stacks.map((s) => s.slice()),
    basket: board.basket.slice(),
    moth: board.moth ? { ...board.moth } : null,
    g: 0,
    f: 0,
    parent: null,
    move: null,
  };
  start.f = weight * heuristic(start.stacks, start.basket, L);
  const open = new Heap();
  open.push(start);
  const best = new Map<string, number>();
  best.set(keyOf(start.stacks, caps, start.basket, start.moth, L), 0);
  let nodes = 0;
  while (open.size) {
    const node = open.pop()!;
    if (isSolvedPlain(node.stacks, node.basket, L)) {
      const moves: Move[] = [];
      for (let n: Node | null = node; n && n.move; n = n.parent) moves.push(n.move);
      moves.reverse();
      return { solved: true, moves, nodes };
    }
    if (++nodes > maxNodes) break;
    for (const s of successors(node, caps, L)) {
      const g = node.g + 1;
      const key = keyOf(s.stacks, caps, s.basket, s.moth, L);
      const prev = best.get(key);
      if (prev !== undefined && prev <= g) continue;
      best.set(key, g);
      open.push({
        stacks: s.stacks,
        basket: s.basket,
        moth: s.moth,
        g,
        f: g + weight * heuristic(s.stacks, s.basket, L),
        parent: node,
        move: s.move,
      });
    }
  }
  return { solved: false, moves: [], nodes };
}
