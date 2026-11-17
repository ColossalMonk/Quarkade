// Restack (DESIGN.md §4 Power-ups): deal the goods on the open shelves' front rows into a new layout
// that the solver can finish. Back stock, closed shelves and the basket stay as they are.

import type { Board } from "./rules.ts";
import { EMPTY, SPOTS, cloneBoard, isBasket, shelfCount, usable } from "./rules.ts";
import { beamSolve } from "./solver.ts";

export function restack(b: Board, tries = 24): Board | null {
  const S = shelfCount(b.def);
  const open = [...Array(S).keys()].filter((s) => usable(b, s) && !isBasket(b, s));
  const goods: number[] = [];
  for (const s of open) for (let i = 0; i < SPOTS; i++) if (b.front[s * SPOTS + i] !== EMPTY) goods.push(b.front[s * SPOTS + i]);
  if (!goods.length) return null;
  // Shelves with back stock must not end up empty (their stock would slide forward at once).
  const mustFill = open.filter((s) => (b.def.shelves[s].b?.length ?? 0) > b.layer[s]);
  let seed = 1;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let t = 0; t < tries; t++) {
    const pool = goods.slice().sort(() => rand() - 0.5);
    const order = open.slice().sort(() => rand() - 0.5);
    const counts = new Map<number, number>(open.map((s) => [s, 0]));
    // Spread evenly: everyone gets floor(G/n), a few get one more, shelves with stock at least one.
    const per = Math.floor(pool.length / open.length);
    let extra = pool.length - per * open.length;
    for (const s of order) {
      let c = per;
      if (extra > 0 && c < SPOTS) {
        c++;
        extra--;
      }
      counts.set(s, Math.min(SPOTS, c));
    }
    if (mustFill.some((s) => counts.get(s) === 0)) continue;
    const nb = cloneBoard(b);
    for (const s of open) for (let i = 0; i < SPOTS; i++) nb.front[s * SPOTS + i] = EMPTY;
    let k = 0;
    let triple = false;
    for (const s of order) {
      const c = counts.get(s)!;
      for (let i = 0; i < c; i++) nb.front[s * SPOTS + i] = pool[k++];
      if (c === SPOTS && pool[k - 1] === pool[k - 2] && pool[k - 2] === pool[k - 3]) triple = true;
    }
    if (triple || k !== pool.length) continue;
    const sol = beamSolve(cloneBoard(nb), { width: 40 });
    if (sol) return nb;
  }
  return null;
}
