// Density Tower progress (DESIGN.md §4): which liquids a level uses, and how sealed flasks
// pour into the current tower. Works like Knotwork's quilt: level colours are drawn from the
// tower's unfilled layers so every level moves the tower forward.

import { Rng, seedOf } from "../../../../forge/src/core/rng.ts";
import { ALL_TOWERS, COLLECTIONS, POURS_PER_LAYER } from "../data/towers.ts";
import type { Tower } from "../data/towers.ts";
import { LIQUIDS, liquidsOfWeight } from "../data/liquids.ts";
import { COLLECTION_STARS } from "../data/cosmetics.ts";

export function collectionOpen(i: number, totalStars: number): boolean {
  return totalStars >= (COLLECTION_STARS[i] ?? Infinity);
}

/** Next tower: first unfinished in an open collection, else an Encore of a finished one. */
export function nextTower(finished: string[], totalStars: number, encores: number): { index: number; encore: boolean } {
  for (let i = 0; i < ALL_TOWERS.length; i++) {
    const t = ALL_TOWERS[i];
    if (collectionOpen(t.collection, totalStars) && !finished.includes(t.tower.id)) return { index: i, encore: false };
  }
  const done = ALL_TOWERS.map((t, i) => ({ t, i })).filter(({ t }) => finished.includes(t.tower.id));
  if (!done.length) return { index: 0, encore: false };
  return { index: done[encores % done.length].i, encore: true };
}

export function completedCollections(finished: string[]): string[] {
  return COLLECTIONS.filter((c) => c.towers.every((t) => finished.includes(t.id))).map((c) => c.id);
}

export class TowerProgress {
  index: number;
  /** Pours received by each layer (same order as tower.layers). */
  pours: number[];
  encore: boolean;

  constructor(index: number, pours: number[] = [], encore = false) {
    this.index = index;
    this.pours = this.tower.layers.map((_, i) => pours[i] ?? 0);
    this.encore = encore;
  }

  get tower(): Tower {
    return ALL_TOWERS[this.index % ALL_TOWERS.length].tower;
  }

  get collectionIndex(): number {
    return ALL_TOWERS[this.index % ALL_TOWERS.length].collection;
  }

  get total(): number {
    return this.tower.layers.length * POURS_PER_LAYER;
  }

  get done(): number {
    return this.pours.reduce((a, b) => a + b, 0);
  }

  get complete(): boolean {
    return this.done >= this.total;
  }

  remaining(liquid: number): number {
    const i = this.tower.layers.indexOf(liquid);
    return i < 0 ? 0 : POURS_PER_LAYER - this.pours[i];
  }

  /**
   * Choose a liquid for each slot (slots have weight classes): tower liquids of that weight with
   * the most pours left first, then other liquids of that weight. Deterministic per level.
   */
  mapLiquids(classes: number[], levelNumber: number): number[] {
    const rng = new Rng(seedOf(levelNumber, this.index, "liquids"));
    const used = new Set<number>();
    const order = classes.map((w, slot) => ({ w, slot }));
    const out = new Array(classes.length).fill(0);
    for (const { w, slot } of order) {
      const wanted = this.tower.layers
        .filter((l) => LIQUIDS[l].weight === w && !used.has(l) && this.remaining(l) > 0)
        .sort((a, b) => this.remaining(b) - this.remaining(a));
      let pick = wanted[0];
      if (pick === undefined) {
        const others = rng.shuffle(liquidsOfWeight(w).filter((l) => !used.has(l)));
        pick = others[0] ?? liquidsOfWeight(w)[0];
      }
      used.add(pick);
      out[slot] = pick;
    }
    return out;
  }

  /** True if this level can finish the tower ("Final Layer" label). */
  canFinishWith(liquids: number[]): boolean {
    let left = 0;
    for (let i = 0; i < this.tower.layers.length; i++) {
      const need = POURS_PER_LAYER - this.pours[i];
      if (need > 1) return false;
      if (need === 1 && !liquids.includes(this.tower.layers[i])) return false;
      left += need;
    }
    return left > 0;
  }

  /**
   * Catch-up at the end of a level: one unfilled layer whose weight class didn't appear in the level
   * gets a free pour, so towers don't stall on rare liquids (foam, mercury). Returns its liquid.
   */
  topUp(levelClasses: number[]): number | null {
    const present = new Set(levelClasses);
    const i = this.tower.layers.findIndex((l, idx) => !present.has(LIQUIDS[l].weight) && this.pours[idx] < POURS_PER_LAYER);
    if (i < 0) return null;
    this.pours[i]++;
    return this.tower.layers[i];
  }

  /** A sealed flask of `liquid` pours into the tower. Returns true if it counted. */
  pour(liquid: number): boolean {
    const i = this.tower.layers.indexOf(liquid);
    if (i < 0 || this.pours[i] >= POURS_PER_LAYER) return false;
    this.pours[i]++;
    return true;
  }

  serialize(): { index: number; pours: number[]; encore: boolean } {
    return { index: this.index, pours: this.pours.slice(), encore: this.encore };
  }
}
