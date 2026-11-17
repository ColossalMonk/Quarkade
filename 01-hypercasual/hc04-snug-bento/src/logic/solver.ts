// Tiling solver (DESIGN.md §5): fills the box from the current board. It always works on the first
// empty cell (reading order) and tries every unplaced piece and orientation whose first cell lands
// there, which is the classic fast method for polyomino packing. Interchangeable pieces are used in
// index order, so each tiling is counted once. Hot/cold is checked as pieces go in, sauce at the end.

import type { Board, Cell, Placement } from "./rules.ts";
import { EMPTY, TEMP_COLD, TEMP_HOT, cloneBoard, distinctRotations, hasWall, pieceKeys } from "./rules.ts";

export interface SolveResult {
  /** Solutions found (stops at maxSolutions). */
  count: number;
  /** Search steps used. */
  nodes: number;
  /** The first solution: a placement for every piece (already-placed ones included), or null. */
  first: Placement[] | null;
  exhausted: boolean;
}

interface Option {
  s: number;
  r: number;
  /** Cells relative to the shape's first cell (reading order). */
  rel: Cell[];
  /** Offset from the first cell back to the shape's origin. */
  ox: number;
  oy: number;
}

export function solve(start: Board, opts: { maxSolutions?: number; maxNodes?: number } = {}): SolveResult {
  const maxSolutions = opts.maxSolutions ?? 1;
  const maxNodes = opts.maxNodes ?? 200000;
  const b = cloneBoard(start);
  const { w, h } = b.def;
  const n = b.pieces.length;
  const keys = pieceKeys(b.pieces);
  const options: Option[][] = b.pieces.map((p) => {
    const out: Option[] = [];
    const add = (cells: Cell[], s: number) => {
      for (const [r, rc] of distinctRotations(cells)) {
        const [fx, fy] = rc[0];
        out.push({ s, r, rel: rc.map(([x, y]) => [x - fx, y - fy] as Cell), ox: -fx, oy: -fy });
      }
    };
    add(p.c, 0);
    if (p.s) add(p.s, 1);
    return out;
  });
  const used = b.at.map((a) => a !== null);
  const sol: Array<Placement | null> = b.at.map((a) => (a ? { ...a } : null));
  const res: SolveResult = { count: 0, nodes: 0, first: null, exhausted: false };
  const owner = b.owner;

  const fits = (i: number, o: Option, cx: number, cy: number): number[] | null => {
    const cells: number[] = [];
    for (const [dx, dy] of o.rel) {
      const x = cx + dx;
      const y = cy + dy;
      if (x < 0 || y < 0 || x >= w || y >= h) return null;
      const c = y * w + x;
      if (owner[c] !== EMPTY) return null;
      cells.push(c);
    }
    for (const a of cells) for (const nb of [a + 1, a + w]) if (cells.includes(nb) && hasWall(b.def, a, nb)) return null;
    // Hot next to cold is never allowed.
    const t = b.pieces[i].t;
    if (t === TEMP_HOT || t === TEMP_COLD) {
      const other = t === TEMP_HOT ? TEMP_COLD : TEMP_HOT;
      for (const c of cells) {
        const x = c % w;
        const nbs = [x > 0 ? c - 1 : -1, x < w - 1 ? c + 1 : -1, c - w, c + w];
        for (const nb of nbs) {
          if (nb < 0 || nb >= owner.length) continue;
          const o2 = owner[nb];
          if (o2 >= 0 && b.pieces[o2].t === other) return null;
        }
      }
    }
    return cells;
  };

  const sauceOk = (): boolean => {
    for (let i = 0; i < n; i++) {
      const tgt = b.pieces[i].sauce;
      if (tgt === undefined) continue;
      let ok = false;
      for (let c = 0; c < owner.length && !ok; c++) {
        if (owner[c] !== i) continue;
        const x = c % w;
        for (const nb of [x > 0 ? c - 1 : -1, x < w - 1 ? c + 1 : -1, c - w, c + w]) if (nb >= 0 && nb < owner.length && owner[nb] === tgt) ok = true;
      }
      if (!ok) return false;
    }
    return true;
  };

  const rec = (from: number): boolean => {
    if (++res.nodes > maxNodes) {
      res.exhausted = true;
      return true;
    }
    let e = from;
    while (e < owner.length && owner[e] !== EMPTY) e++;
    if (e >= owner.length) {
      if (sauceOk()) {
        res.count++;
        if (!res.first) res.first = sol.map((p) => ({ ...p! }));
        if (res.count >= maxSolutions) return true;
      }
      return false;
    }
    const ex = e % w;
    const ey = Math.floor(e / w);
    for (let i = 0; i < n; i++) {
      if (used[i]) continue;
      // Interchangeable pieces go in index order.
      let skip = false;
      for (let j = 0; j < i; j++) if (!used[j] && keys[j] === keys[i]) skip = true;
      if (skip) continue;
      for (const o of options[i]) {
        const cells = fits(i, o, ex, ey);
        if (!cells) continue;
        for (const c of cells) owner[c] = i;
        used[i] = true;
        sol[i] = { s: o.s, r: o.r, x: ex + o.ox, y: ey + o.oy };
        const stop = rec(e + 1);
        for (const c of cells) owner[c] = EMPTY;
        used[i] = false;
        sol[i] = null;
        if (stop) return true;
      }
    }
    return false;
  };
  rec(0);
  return res;
}

/** Can the current board still be finished? */
export function solvable(b: Board, maxNodes = 200000): boolean {
  const r = solve(b, { maxSolutions: 1, maxNodes });
  return r.count > 0;
}
