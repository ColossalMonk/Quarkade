// Escape-order solver (DESIGN.md §5). Freeing a koi never blocks another, so without whirlpools any
// free koi is a safe next move. Whirlpools turn fry as others leave, which can leave a fry facing a
// wall for good, so the solver searches (depth-first, with memo) for a full escape order.

import type { Board } from "./rules.ts";
import { cloneBoard, freeKoi, isWon, tapKoi } from "./rules.ts";

export interface SolveResult {
  order: number[] | null;
  nodes: number;
}

export function solveOrder(start: Board, maxNodes = 20000, prefer: number[] = []): SolveResult {
  const seen = new Set<string>();
  let nodes = 0;
  const rank = new Map(prefer.map((k, i) => [k, i]));
  const go = (b: Board, path: number[]): number[] | null => {
    if (isWon(b)) return path;
    if (++nodes > maxNodes) return null;
    const key = b.out.map((o) => (o ? 1 : 0)).join("");
    if (seen.has(key)) return null;
    seen.add(key);
    const free = freeKoi(b).sort((a, c) => (rank.get(a) ?? 1e6) - (rank.get(c) ?? 1e6));
    for (const i of free) {
      const nb = cloneBoard(b);
      tapKoi(nb, i);
      const r = go(nb, [...path, i]);
      if (r) return r;
    }
    return null;
  };
  const order = go(cloneBoard(start), []);
  return { order, nodes };
}

/** A koi that's safe to free next (for Hint), or -1 if the pond can't be finished from here. */
export function hintKoi(b: Board, prefer: number[] = []): number {
  const res = solveOrder(b, 20000, prefer);
  return res.order && res.order.length ? res.order[0] : -1;
}
