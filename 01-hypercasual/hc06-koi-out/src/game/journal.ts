// The Koi Journal and the journey (DESIGN.md §4): which variety each koi in a level is, and how freed
// koi count as sightings on the current page (one region, 8 varieties). The same pattern as quilts,
// gadgets, recipes and displays: a level's koi are drawn from what the page still needs.

import { Rng, seedOf } from "../../../../forge/src/core/rng.ts";
import { REGIONS, REGION_STARS, VARIETIES, sightingsFor, varietiesOfRegion } from "../data/varieties.ts";

export function regionOpen(r: number, totalStars: number): boolean {
  return totalStars >= (REGION_STARS[r] ?? Infinity);
}

/** Next page: the first unfinished region that's open, else an Encore of a finished one. */
export function nextPage(done: string[], totalStars: number, encores: number): { page: number; encore: boolean } {
  for (let r = 0; r < REGIONS.length; r++) if (regionOpen(r, totalStars) && !done.includes(REGIONS[r].id)) return { page: r, encore: false };
  const finished = REGIONS.map((reg, r) => ({ reg, r })).filter(({ reg }) => done.includes(reg.id));
  if (!finished.length) return { page: 0, encore: false };
  return { page: finished[encores % finished.length].r, encore: true };
}

export class JournalProgress {
  page: number;
  /** Sightings per variety on this page (in varietiesOfRegion order). */
  filled: number[];
  encore: boolean;

  constructor(page: number, filled: number[] = [], encore = false) {
    this.page = page;
    this.filled = this.varieties.map((_, i) => filled[i] ?? 0);
    this.encore = encore;
  }

  get varieties(): number[] {
    return varietiesOfRegion(this.page);
  }

  get need(): number {
    return sightingsFor(this.page);
  }

  get total(): number {
    return this.varieties.length * this.need;
  }

  get done(): number {
    return this.filled.reduce((a, f) => a + Math.min(this.need, f), 0);
  }

  get complete(): boolean {
    return this.done >= this.total;
  }

  /** A variety for every koi: mostly this page's unfinished ones (weighted by need), a few older ones. */
  mapVarieties(koiCount: number, levelNumber: number): number[] {
    const rng = new Rng(seedOf(levelNumber, this.page, "koi"));
    const want = this.varieties.map((v, i) => ({ v, left: Math.max(0, this.need - this.filled[i]) })).filter((x) => x.left > 0);
    const older = VARIETIES.map((v, i) => (v.region < this.page ? i : -1)).filter((i) => i >= 0);
    const out: number[] = [];
    for (let k = 0; k < koiCount; k++) {
      if (older.length && rng.chance(0.15)) out.push(rng.pick(older));
      else if (want.length) {
        const total = want.reduce((a, x) => a + x.left, 0);
        let r = rng.next() * total;
        const pick = want.find((x) => (r -= x.left) < 0) ?? want[0];
        out.push(pick.v);
      } else out.push(rng.pick(this.varieties));
    }
    return out;
  }

  /** A freed koi is a sighting. Returns the page slot, or -1 if it isn't needed. */
  sight(variety: number): number {
    const i = this.varieties.indexOf(variety);
    if (i < 0 || this.filled[i] >= this.need) return -1;
    this.filled[i]++;
    return i;
  }

  serialize(): { page: number; filled: number[]; encore: boolean } {
    return { page: this.page, filled: this.filled.slice(), encore: this.encore };
  }
}
