// Pack row format, shared by the game and the pack builder.

import type { LevelDef, LevelTag } from "../logic/rules.ts";

/** Pack rows: [w, h, mask, walls, pieces, sol, par, d, tag] */
export type PackRow = [number, number, string, number[], LevelDef["pieces"], LevelDef["sol"], number, number, string];

export function fromRow(n: number, r: PackRow): LevelDef {
  return JSON.parse(JSON.stringify({ n, w: r[0], h: r[1], mask: r[2], walls: r[3], pieces: r[4], sol: r[5], par: r[6], d: r[7], tag: r[8] as LevelTag })) as LevelDef;
}

export function toRow(d: LevelDef): PackRow {
  return [d.w, d.h, d.mask, d.walls, d.pieces, d.sol, d.par, d.d, d.tag];
}
