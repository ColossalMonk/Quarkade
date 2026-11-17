// Gadget progress (DESIGN.md §4): which bolt colours a level uses, and how closed toolboxes tighten
// the current gadget's parts. Works like Knotwork's quilt and Density's tower: level colours are
// drawn from the parts still unfinished, so every level moves the gadget forward.

import { Rng, seedOf } from "../../../../forge/src/core/rng.ts";
import { GADGETS, ROOMS, gadgetsOfRoom } from "../data/gadgets.ts";
import type { Gadget } from "../data/gadgets.ts";
import { BOLT_COLOURS } from "../data/palette.ts";
import { ROOM_STARS } from "../data/cosmetics.ts";

export function roomOpen(i: number, totalStars: number): boolean {
  return totalStars >= (ROOM_STARS[i] ?? Infinity);
}

/** Next gadget: first unfinished one in an open room, else an Encore of a finished one. */
export function nextGadget(finished: string[], totalStars: number, encores: number): { index: number; encore: boolean } {
  for (let i = 0; i < GADGETS.length; i++) {
    const g = GADGETS[i];
    if (roomOpen(g.room, totalStars) && !finished.includes(g.id)) return { index: i, encore: false };
  }
  const done = GADGETS.map((g, i) => ({ g, i })).filter(({ g }) => finished.includes(g.id));
  if (!done.length) return { index: 0, encore: false };
  return { index: done[encores % done.length].i, encore: true };
}

/** Rooms whose 8 gadgets are all finished. */
export function roomsWithAllGadgets(finished: string[]): string[] {
  return ROOMS.filter((_, r) => gadgetsOfRoom(r).every((g) => finished.includes(g.id))).map((r) => r.id);
}

export class GadgetProgress {
  index: number;
  /** Bolts tightened in each part (same order as gadget.parts). */
  filled: number[];
  encore: boolean;

  constructor(index: number, filled: number[] = [], encore = false) {
    this.index = index;
    this.filled = this.gadget.parts.map((_, i) => filled[i] ?? 0);
    this.encore = encore;
  }

  get gadget(): Gadget {
    return GADGETS[this.index % GADGETS.length];
  }

  get total(): number {
    return this.gadget.parts.reduce((a, p) => a + p.need, 0);
  }

  get done(): number {
    return this.gadget.parts.reduce((a, p, i) => a + Math.min(p.need, this.filled[i]), 0);
  }

  get complete(): boolean {
    return this.done >= this.total;
  }

  /** Bolts still needed in a palette colour. */
  remaining(colour: number): number {
    return this.gadget.parts.reduce((a, p, i) => a + (p.c === colour ? Math.max(0, p.need - this.filled[i]) : 0), 0);
  }

  /**
   * A palette colour for each of the level's k colour slots: the gadget's colours with the most
   * bolts left first, then other colours. Deterministic per level.
   */
  mapColours(k: number, levelNumber: number): number[] {
    const rng = new Rng(seedOf(levelNumber, this.index, "colours"));
    const wanted = [...new Set(this.gadget.parts.map((p) => p.c))].filter((c) => this.remaining(c) > 0).sort((a, b) => this.remaining(b) - this.remaining(a));
    const others = rng.shuffle(BOLT_COLOURS.map((_, i) => i).filter((c) => !wanted.includes(c)));
    const pool = [...wanted, ...others];
    // Shuffle slot order so slot 0 isn't always the gadget's main colour.
    return rng.shuffle(pool.slice(0, k));
  }

  /** True if this level can finish the gadget ("Final Bolt" label). */
  canFinishWith(boxColours: number[]): boolean {
    const count = new Map<number, number>();
    for (const c of boxColours) count.set(c, (count.get(c) ?? 0) + 1);
    let left = 0;
    for (const c of new Set(this.gadget.parts.map((p) => p.c))) {
      const r = this.remaining(c);
      if (r > (count.get(c) ?? 0)) return false;
      left += r;
    }
    return left > 0;
  }

  /** A closed toolbox of `colour` tightens one bolt. Returns the part index, or -1 if not needed. */
  tighten(colour: number): number {
    const i = this.gadget.parts.findIndex((p, j) => p.c === colour && this.filled[j] < p.need);
    if (i < 0) return -1;
    this.filled[i]++;
    return i;
  }

  /**
   * Catch-up at the end of a level: one unfinished part whose colour wasn't in the level gets a
   * bolt, so gadgets don't stall on a colour the generator rarely picks. Returns the part.
   */
  topUp(levelColours: number[]): number {
    const i = this.gadget.parts.findIndex((p, j) => !levelColours.includes(p.c) && this.filled[j] < p.need);
    if (i < 0) return -1;
    this.filled[i]++;
    return i;
  }

  serialize(): { index: number; filled: number[]; encore: boolean } {
    return { index: this.index, filled: this.filled.slice(), encore: this.encore };
  }
}
