// Pack row format, shared by the game and the pack builder: the level without its number.

import type { LevelDef } from "../logic/rules.ts";

export type PackRow = Omit<LevelDef, "n">;

export function fromRow(n: number, r: PackRow): LevelDef {
  return JSON.parse(JSON.stringify({ n, ...r })) as LevelDef;
}

export function toRow(d: LevelDef): PackRow {
  const { n, ...rest } = d;
  void n;
  return rest;
}
