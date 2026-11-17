// Weighted A* solver for Density. Ignores murky-ness (true colours), so par is the target for a
// player who reads the board well. Used for par, hints, and checking every level is solvable.

import type { Move } from "./rules.ts";
import { fitAmount, insertUnits, isSealedStack, runOf } from "./rules.ts";

export interface SolveInput {
  stacks: number[][];
  caps: number[];
  classes: number[];
  L: number;
  /** Seals needed before each flask opens (0 = open). */
  corks?: number[];
  pipette?: number[];
}

export interface SolveResult {
  solved: boolean;
  moves: Move[];
  nodes: number;
}

interface Node {
  stacks: number[][];
  pipette: number[];
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
    const top = a[0];
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
    return top;
  }
  get size(): number {
    return this.items.length;
  }
}

function breaks(s: number[]): number {
  let r = 0;
  for (let j = 1; j < s.length; j++) if (s[j] !== s[j - 1]) r++;
  return r;
}

/** Lower bound: every run above the bottom one has to leave its flask; fragments must merge. */
export function heuristic(stacks: number[][], pipette: number[], L: number): number {
  let hRuns = 0;
  const frags = new Map<number, number>();
  for (const s of stacks) {
    if (!s.length || isSealedStack(s, L)) continue;
    hRuns += breaks(s);
    for (let j = 0; j < s.length; j++) if (j === 0 || s[j] !== s[j - 1]) frags.set(s[j], (frags.get(s[j]) ?? 0) + 1);
  }
  for (const u of pipette) frags.set(u, (frags.get(u) ?? 0) + 1);
  let hFrag = 0;
  for (const r of frags.values()) hFrag += r - 1;
  return Math.max(hRuns + pipette.length, hFrag);
}

function sealedCount(stacks: number[][], L: number): number {
  let n = 0;
  for (const s of stacks) if (isSealedStack(s, L)) n++;
  return n;
}

function keyOf(stacks: number[][], caps: number[], corks: number[], pipette: number[], L: number): string {
  const parts: string[] = [];
  for (let i = 0; i < stacks.length; i++) {
    if (isSealedStack(stacks[i], L)) continue;
    parts.push(`${caps[i]}:${corks[i]}:${stacks[i].join(",")}`);
  }
  parts.sort();
  return parts.join("|") + "#" + pipette.join(",");
}

export function solve(input: SolveInput, opts: { weight?: number; maxNodes?: number } = {}): SolveResult {
  const weight = opts.weight ?? 1.5;
  const maxNodes = opts.maxNodes ?? 200000;
  const { caps, classes, L } = input;
  const corks = input.corks ?? caps.map(() => 0);
  const start: Node = { stacks: input.stacks.map((s) => s.slice()), pipette: (input.pipette ?? []).slice(), g: 0, f: 0, parent: null, move: null };
  start.f = weight * heuristic(start.stacks, start.pipette, L);
  const open = new Heap();
  open.push(start);
  const best = new Map<string, number>([[keyOf(start.stacks, caps, corks, start.pipette, L), 0]]);
  let nodes = 0;
  while (open.size) {
    const node = open.pop()!;
    const st = node.stacks;
    const sealed = sealedCount(st, L);
    if (sealed >= classes.length && !node.pipette.length) {
      const moves: Move[] = [];
      for (let n: Node | null = node; n && n.move; n = n.parent) moves.push(n.move);
      moves.reverse();
      return { solved: true, moves, nodes };
    }
    if (++nodes > maxNodes) break;
    const usable = st.map((s, i) => !isSealedStack(s, L) && sealed >= corks[i]);
    const seenEmpty = new Set<number>();
    const emptyOk = st.map((s, i) => {
      if (s.length || !usable[i] || seenEmpty.has(caps[i])) return false;
      seenEmpty.add(caps[i]);
      return true;
    });
    const push = (stacks: number[][], pipette: number[], move: Move) => {
      const g = node.g + 1;
      const key = keyOf(stacks, caps, corks, pipette, L);
      const prev = best.get(key);
      if (prev !== undefined && prev <= g) return;
      best.set(key, g);
      open.push({ stacks, pipette, g, f: g + weight * heuristic(stacks, pipette, L), parent: node, move });
    };
    if (node.pipette.length) {
      const u = node.pipette[0];
      for (let t = 0; t < st.length; t++) {
        if (!usable[t] || (!st[t].length && !emptyOk[t])) continue;
        if (!fitAmount(st[t], caps[t], u, 1, classes)) continue;
        const nt = st[t].slice();
        insertUnits(nt, u, 1, classes);
        push(st.map((s, i) => (i === t ? nt : s)), node.pipette.slice(1), { kind: "drop", to: t });
      }
    }
    for (let f = 0; f < st.length; f++) {
      const fs = st[f];
      if (!usable[f] || !fs.length) continue;
      const slot = fs[fs.length - 1];
      const run = runOf(fs);
      const uniform = run === fs.length;
      for (let t = 0; t < st.length; t++) {
        if (t === f || !usable[t]) continue;
        if (!st[t].length) {
          if (!emptyOk[t]) continue;
          if (uniform && caps[t] <= caps[f]) continue;
        }
        const amount = fitAmount(st[t], caps[t], slot, run, classes);
        if (!amount) continue;
        const nf = fs.slice(0, fs.length - amount);
        const nt = st[t].slice();
        insertUnits(nt, slot, amount, classes);
        push(st.map((s, i) => (i === f ? nf : i === t ? nt : s)), node.pipette, { kind: "pour", from: f, to: t });
      }
    }
  }
  return { solved: false, moves: [], nodes };
}
