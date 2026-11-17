// Quilt progress: which yarn colours a level uses, and which cells each finished needle knits.
// Colours are picked from the quilt's remaining cells, so every level moves the picture forward.

import { Rng, seedOf } from "../../../../forge/src/core/rng.ts";
import { ALL_PICTURES, ALBUMS } from "../data/quilts.ts";
import type { QuiltPicture } from "../data/quilts.ts";
import { ALBUM_STARS } from "../data/cosmetics.ts";

/** Is album `i` open for this many total stars? */
export function albumOpen(i: number, totalStars: number): boolean {
  return totalStars >= (ALBUM_STARS[i] ?? Infinity);
}

/**
 * Which picture to knit next: the first unfinished picture in an open album. If every open
 * picture is done (the next album still needs stars, or all 40 are finished), knit an Encore of
 * a finished picture, cycling through them.
 */
export function nextPicture(finished: string[], totalStars: number, encoresDone: number): { index: number; encore: boolean } {
  for (let i = 0; i < ALL_PICTURES.length; i++) {
    const p = ALL_PICTURES[i];
    if (!albumOpen(p.album, totalStars)) continue;
    if (!finished.includes(p.picture.id)) return { index: i, encore: false };
  }
  const done = ALL_PICTURES.map((p, i) => ({ p, i })).filter(({ p }) => finished.includes(p.picture.id));
  if (!done.length) return { index: 0, encore: false };
  return { index: done[encoresDone % done.length].i, encore: true };
}

/** Albums that have every picture finished. */
export function completedAlbums(finished: string[]): string[] {
  return ALBUMS.filter((a) => a.pictures.every((p) => finished.includes(p.id))).map((a) => a.id);
}
import { YARNS, YARN_BY_KEY } from "../data/palette.ts";

/** About how many cells a level should knit, so a quilt takes ~11-12 levels. */
const CELLS_PER_LEVEL = 5;

export class QuiltProgress {
  picIndex: number;
  cells: boolean[];
  /** Re-knitting a picture that's already finished (no new album progress). */
  encore: boolean;

  constructor(picIndex: number, cells: string, encore = false) {
    this.picIndex = picIndex;
    this.cells = [...cells.padEnd(64, "0")].map((c) => c === "1");
    this.encore = encore;
  }

  get picture(): QuiltPicture {
    return ALL_PICTURES[this.picIndex % ALL_PICTURES.length].picture;
  }

  get albumIndex(): number {
    return ALL_PICTURES[this.picIndex % ALL_PICTURES.length].album;
  }

  /** Yarn index of cell i (row-major, top row first). */
  cellYarn(i: number): number {
    const row = Math.floor(i / 8);
    const col = i % 8;
    return YARN_BY_KEY[this.picture.rows[row][col]] ?? 10;
  }

  get filledCount(): number {
    return this.cells.filter(Boolean).length;
  }

  get complete(): boolean {
    return this.filledCount >= 64;
  }

  remainingByYarn(): Map<number, number> {
    const m = new Map<number, number>();
    for (let i = 0; i < 64; i++) {
      if (this.cells[i]) continue;
      const y = this.cellYarn(i);
      m.set(y, (m.get(y) ?? 0) + 1);
    }
    return m;
  }

  /**
   * Map a level's k colour slots to yarns: quilt colours with the most cells left first,
   * then other yarns as filler. Deterministic for a given level.
   */
  mapColours(k: number, levelNumber: number): number[] {
    const remaining = [...this.remainingByYarn().entries()].sort((a, b) => b[1] - a[1]).map(([y]) => y);
    const chosen = remaining.slice(0, k);
    const rng = new Rng(seedOf(levelNumber, this.picIndex, "colours"));
    const others = rng.shuffle(YARNS.map((_, i) => i).filter((i) => !chosen.includes(i)));
    while (chosen.length < k && others.length) chosen.push(others.shift()!);
    return rng.shuffle(chosen);
  }

  /**
   * True if this level should finish the quilt (UI label "Finishing Stitch"): only a few
   * stitches are left and the level uses every colour still needed.
   */
  canFinishWith(yarns: number[]): boolean {
    const rem = this.remainingByYarn();
    if (rem.size === 0) return false;
    let total = 0;
    for (const [y, count] of rem) {
      if (!yarns.includes(y)) return false;
      total += count;
    }
    return total <= Math.ceil(CELLS_PER_LEVEL * 1.5);
  }

  /**
   * A needle of `yarn` was finished: knit cells of that colour, bottom row first.
   * Dominant colours knit several cells so a quilt keeps pace (~6 cells per level).
   * Returns the knitted cell indices.
   */
  knit(yarn: number, levelYarns: number[]): number[] {
    const rem = this.remainingByYarn();
    const mine = rem.get(yarn) ?? 0;
    if (!mine) return [];
    let pool = 0;
    for (const y of levelYarns) pool += rem.get(y) ?? 0;
    // A level finishing the quilt takes everything left of each of its colours.
    const finishing = this.canFinishWith(levelYarns);
    const count = finishing ? mine : Math.min(mine, Math.max(1, Math.round((CELLS_PER_LEVEL * mine) / Math.max(1, pool))));
    const out: number[] = [];
    for (let row = 7; row >= 0 && out.length < count; row--) {
      for (let col = 0; col < 8 && out.length < count; col++) {
        const i = row * 8 + col;
        if (!this.cells[i] && this.cellYarn(i) === yarn) {
          this.cells[i] = true;
          out.push(i);
        }
      }
    }
    return out;
  }

  serialize(): { pic: number; cells: string; encore: boolean } {
    return { pic: this.picIndex, cells: this.cells.map((c) => (c ? "1" : "0")).join(""), encore: this.encore };
  }
}
