// Pack row format, shared by the game and the pack builder.

import type { LevelDef, LevelTag } from "../logic/rules.ts";

/** Pack rows: [plates, bolts, pins, chains, boxes, k, tray, par, d, tag] */
export type PackRow = [LevelDef["plates"], LevelDef["bolts"], LevelDef["pins"], LevelDef["chains"], number[], number, number, number, number, string];

export function fromRow(n: number, r: PackRow): LevelDef {
  return {
    n,
    plates: r[0].map((p) => [...p] as LevelDef["plates"][number]),
    bolts: r[1].map((b) => [...b] as LevelDef["bolts"][number]),
    pins: r[2].map((p) => [...p] as LevelDef["pins"][number]),
    chains: r[3].map((c) => [...c] as LevelDef["chains"][number]),
    boxes: r[4].slice(),
    k: r[5],
    tray: r[6],
    par: r[7],
    d: r[8],
    tag: r[9] as LevelTag,
  };
}

export function toRow(d: LevelDef): PackRow {
  return [d.plates, d.bolts, d.pins, d.chains, d.boxes, d.k, d.tray, d.par, d.d, d.tag];
}
