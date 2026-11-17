// Main Street progress (DESIGN.md §4): which good each kind on the stand becomes, and how sold triples
// tick off the current shop display. The same pattern as quilts, towers, gadgets and recipes: a
// level's goods are drawn from what the display still needs, so every level moves it forward.

import { Rng, seedOf } from "../../../../forge/src/core/rng.ts";
import { GOODS, GOOD_INDEX } from "../data/goods.ts";
import { DISPLAYS, SHOP_STARS } from "../data/shops.ts";
import type { Display } from "../data/shops.ts";

export function shopOpen(i: number, totalStars: number): boolean {
  return totalStars >= (SHOP_STARS[i] ?? Infinity);
}

/** Next display: the first unfinished one in an open shop, else an Encore of a finished one. */
export function nextDisplay(finished: string[], totalStars: number, encores: number): { index: number; encore: boolean } {
  for (let i = 0; i < DISPLAYS.length; i++) {
    const d = DISPLAYS[i];
    if (shopOpen(d.shop, totalStars) && !finished.includes(d.id)) return { index: i, encore: false };
  }
  const done = DISPLAYS.map((d, i) => ({ d, i })).filter(({ d }) => finished.includes(d.id));
  if (!done.length) return { index: 0, encore: false };
  return { index: done[encores % done.length].i, encore: true };
}

/** Shops whose 8 displays are all finished. */
export function openedShops(finished: string[]): number[] {
  const out: number[] = [];
  for (let s = 0; s < 6; s++) if (DISPLAYS.filter((d) => d.shop === s).every((d) => finished.includes(d.id))) out.push(s);
  return out;
}

export class DisplayProgress {
  index: number;
  filled: number[];
  encore: boolean;

  constructor(index: number, filled: number[] = [], encore = false) {
    this.index = index;
    this.filled = this.display.parts.map((_, i) => filled[i] ?? 0);
    this.encore = encore;
  }

  get display(): Display {
    return DISPLAYS[this.index % DISPLAYS.length];
  }

  get total(): number {
    return this.display.parts.reduce((a, p) => a + p.need, 0);
  }

  get done(): number {
    return this.display.parts.reduce((a, p, i) => a + Math.min(p.need, this.filled[i]), 0);
  }

  get complete(): boolean {
    return this.done >= this.total;
  }

  remaining(goodId: string): number {
    return this.display.parts.reduce((a, p, i) => a + (p.good === goodId ? Math.max(0, p.need - this.filled[i]) : 0), 0);
  }

  /**
   * A good for every kind on the stand. The kinds with the most goods get what the display still
   * needs most; the rest come from the shops opened so far (this shop's goods first). Kinds always
   * get different goods.
   */
  mapGoods(kindCounts: number[], levelNumber: number): number[] {
    const rng = new Rng(seedOf(levelNumber, this.index, "goods"));
    const shop = this.display.shop;
    const need = this.display.parts
      .map((p, i) => ({ g: GOOD_INDEX[p.good], left: Math.max(0, p.need - this.filled[i]) }))
      .filter((x) => x.left > 0)
      .sort((a, b) => b.left - a.left)
      .map((x) => x.g);
    const own = rng.shuffle(GOODS.map((g, i) => (g.shop === shop ? i : -1)).filter((i) => i >= 0));
    const older = rng.shuffle(GOODS.map((g, i) => (g.shop < shop ? i : -1)).filter((i) => i >= 0));
    const later = GOODS.map((g, i) => (g.shop > shop ? i : -1)).filter((i) => i >= 0);
    // Mix this shop's goods with older ones (60 / 40) after the wanted ones.
    const mixed: number[] = [];
    while (own.length || older.length) {
      if (own.length && (!older.length || rng.chance(0.6))) mixed.push(own.shift()!);
      else mixed.push(older.shift()!);
    }
    const pool = [...new Set([...need, ...mixed, ...later])];
    const order = kindCounts.map((c, k) => ({ c, k })).sort((a, b) => b.c - a.c);
    const out = new Array<number>(kindCounts.length).fill(0);
    order.forEach(({ k }, i) => (out[k] = pool[i]));
    return out;
  }

  /** True if this level can finish the display ("Window Day" label). */
  canFinishWith(goodsOf: number[], kindCounts: number[]): boolean {
    const crates = new Map<string, number>();
    goodsOf.forEach((g, k) => crates.set(GOODS[g].id, (crates.get(GOODS[g].id) ?? 0) + Math.floor(kindCounts[k] / 3)));
    let left = 0;
    for (const p of this.display.parts) {
      const r = this.remaining(p.good);
      if (r > (crates.get(p.good) ?? 0)) return false;
      left += r;
    }
    return left > 0;
  }

  /** A sold triple ticks one crate off. Returns the display part, or -1 if it isn't needed. */
  tick(goodId: string): number {
    const i = this.display.parts.findIndex((p, j) => p.good === goodId && this.filled[j] < p.need);
    if (i < 0) return -1;
    this.filled[i]++;
    return i;
  }

  /** Catch-up at the end of a level: one tick for each unfinished part whose good wasn't on the stand. */
  topUp(levelGoods: string[], times = 1): number {
    let last = -1;
    for (let k = 0; k < times; k++) {
      const i = this.display.parts.findIndex((p, j) => !levelGoods.includes(p.good) && this.filled[j] < p.need);
      if (i < 0) break;
      this.filled[i]++;
      last = i;
    }
    return last;
  }

  serialize(): { index: number; filled: number[]; encore: boolean } {
    return { index: this.index, filled: this.filled.slice(), encore: this.encore };
  }
}
