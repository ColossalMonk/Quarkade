// Minimum-detour solver (DESIGN.md §4 "Win, stars, coins"; §5 step 6).
//
// Every bolt is tapped exactly once, so the only cost is a detour: a bolt that goes into the tray.
// 0-1 breadth-first search over board states (cost 0 = into a box, 1 = into the tray).
// "Quiet" box moves, which change no plate and cost nothing, are taken straight away instead of
// branched on. That keeps the search small without losing optimality in practice.

import type { Board } from "./rules.ts";
import { cloneBoard, isQuietRemoval, isWon, legalMoves, routeFor, stateKey, tap } from "./rules.ts";

export interface SolveResult {
  solved: boolean;
  /** Minimum detours found (exact unless the node budget ran out). */
  detours: number;
  /** Bolt taps in order. */
  moves: number[];
  nodes: number;
  exhausted: boolean;
}

interface Node {
  board: Board;
  cost: number;
  moves: number[];
}

/** Take every quiet, free, into-a-box move (cost 0, no swing). Returns the taps made. */
function takeQuiet(b: Board): number[] {
  const taken: number[] = [];
  for (let guard = 0; guard < 500; guard++) {
    const m = legalMoves(b).find((i) => routeFor(b, b.def.bolts[i][2])! >= 0 && isQuietRemoval(b, i));
    if (m === undefined) break;
    tap(b, m);
    taken.push(m);
  }
  return taken;
}

export function solve(start: Board, opts: { maxNodes?: number; bound?: number } = {}): SolveResult {
  const maxNodes = opts.maxNodes ?? 60000;
  const root = cloneBoard(start);
  const rootMoves = takeQuiet(root);
  const best = new Map<string, number>();
  const deque: Node[] = [{ board: root, cost: 0, moves: rootMoves }];
  let head = 0;
  let nodes = 0;
  // Deque as an array with a head pointer: cost-0 children go to the front via a second list.
  const front: Node[] = [];
  const pop = (): Node | undefined => (front.length ? front.pop() : head < deque.length ? deque[head++] : undefined);
  for (;;) {
    const node = pop();
    if (!node) break;
    const key = stateKey(node.board);
    const seen = best.get(key);
    if (seen !== undefined && seen <= node.cost) continue;
    best.set(key, node.cost);
    if (isWon(node.board)) return { solved: true, detours: node.cost, moves: node.moves, nodes, exhausted: false };
    if (opts.bound !== undefined && node.cost > opts.bound) continue;
    if (++nodes > maxNodes) return { solved: false, detours: -1, moves: [], nodes, exhausted: true };
    for (const m of legalMoves(node.board)) {
      const child = cloneBoard(node.board);
      const r = tap(child, m)!;
      const quiet = takeQuiet(child);
      const cost = node.cost + (r.to < 0 ? 1 : 0);
      const ck = stateKey(child);
      const cs = best.get(ck);
      if (cs !== undefined && cs <= cost) continue;
      const next: Node = { board: child, cost, moves: [...node.moves, m, ...quiet] };
      if (cost === node.cost) front.push(next);
      else deque.push(next);
    }
  }
  return { solved: false, detours: -1, moves: [], nodes, exhausted: false };
}
