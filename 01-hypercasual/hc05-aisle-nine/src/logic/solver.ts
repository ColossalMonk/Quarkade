// Beam-search solver (DESIGN.md §5). It powers par, Hint (the next move from the current board),
// Restack (checking a new arrangement) and the "sensible play" difficulty signal.

import type { Board, Move } from "./rules.ts";
import { EMPTY, SPOTS, applyMove, cloneBoard, goodsLeft, inReach, isJammed, isWon, legalMoves, posOf, shelfCount, stateKey, unitOf, usable } from "./rules.ts";

/** How good a board looks: progress, near-triples (more if in reach or coming round), room to work. */
export function scoreBoard(b: Board): number {
  if (isWon(b)) return 1e9;
  if (isJammed(b)) return -1e6;
  const def = b.def;
  const S = shelfCount(def);
  let score = b.sold * 100 - goodsLeft(b) * 4;
  let free = 0;
  for (let s = 0; s < S; s++) {
    if (!usable(b, s)) continue;
    const row = b.front.slice(s * SPOTS, s * SPOTS + SPOTS).filter((k) => k !== EMPTY);
    free += SPOTS - row.length;
    // Coming round soon (or in reach now) counts more.
    const pos = posOf(b, unitOf(def, s));
    const ahead = def.turns ? (def.dir > 0 ? (def.units - pos) % def.units : (pos - def.reach + 1 + def.units) % def.units) : 0;
    const soon = inReach(b, s) ? 1 : ahead <= 2 ? 0.7 : 0.4;
    if (row.length === 2 && row[0] === row[1]) score += 14 * soon;
    else if (row.length === 2) score -= 3;
    else if (row.length === 3) score -= 6;
    else if (row.length === 1) score += 1;
  }
  if (b.basket) for (let i = 0; i < b.basket; i++) if (b.front[S * SPOTS + i] === EMPTY) free++;
  if (free < 3) score -= (3 - free) * 25;
  score += Math.min(free, 6) * 3;
  return score;
}

export interface BeamOpts {
  width?: number;
  maxDepth?: number;
  /** Random noise added to scores (for "sensible play" runs). */
  noise?: number;
  rand?: () => number;
}

interface Node {
  b: Board;
  parent: Node | null;
  move: Move | null;
}

function pathOf(n: Node): Move[] {
  const out: Move[] = [];
  for (let x: Node | null = n; x && x.move; x = x.parent) out.push(x.move);
  return out.reverse();
}

/** Beam search from the current board. Returns a winning move list, or null. */
export function beamSolve(start: Board, opts: BeamOpts = {}): Move[] | null {
  const width = opts.width ?? 60;
  const maxDepth = opts.maxDepth ?? goodsLeft(start) * 3 + 40;
  const rand = opts.rand ?? Math.random;
  const seen = new Set<string>([stateKey(start)]);
  let frontier: Node[] = [{ b: start, parent: null, move: null }];
  if (isWon(start)) return [];
  for (let depth = 0; depth < maxDepth && frontier.length; depth++) {
    const next: Array<{ n: Node; s: number }> = [];
    for (const node of frontier) {
      for (const m of legalMoves(node.b)) {
        const b = cloneBoard(node.b);
        if (!applyMove(b, m)) continue;
        const key = stateKey(b);
        if (seen.has(key)) continue;
        seen.add(key);
        const child: Node = { b, parent: node, move: m };
        if (isWon(b)) return pathOf(child);
        if (isJammed(b)) continue;
        next.push({ n: child, s: scoreBoard(b) + (opts.noise ? (rand() - 0.5) * opts.noise : 0) });
      }
    }
    next.sort((a, c) => c.s - a.s);
    frontier = next.slice(0, width).map((x) => x.n);
  }
  return null;
}

/** "Sensible play": a greedy player who sees one move ahead. Returns the share of runs that fail. */
export function jamRate(start: Board, runs: number, rand: () => number): number {
  let fails = 0;
  for (let r = 0; r < runs; r++) {
    const b = cloneBoard(start);
    const limit = goodsLeft(b) * 3 + 20;
    let ok = false;
    const seen = new Set<string>();
    for (let step = 0; step < limit; step++) {
      if (isWon(b)) {
        ok = true;
        break;
      }
      let best: Move | null = null;
      let bestS = -Infinity;
      for (const m of legalMoves(b)) {
        const c = cloneBoard(b);
        applyMove(c, m);
        const key = stateKey(c);
        const s = scoreBoard(c) + (rand() - 0.5) * 12 - (seen.has(key) ? 40 : 0);
        if (s > bestS) {
          bestS = s;
          best = m;
        }
      }
      if (!best) break;
      applyMove(b, best);
      seen.add(stateKey(b));
      if (isJammed(b)) break;
    }
    if (!ok && !isWon(b)) fails++;
  }
  return fails / runs;
}

/** The first move of a solution from this board (for Hint), or null if none was found. */
export function hintMove(b: Board, width = 80): Move | null {
  const sol = beamSolve(cloneBoard(b), { width });
  return sol && sol.length ? sol[0] : null;
}
