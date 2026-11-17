// Density Towers (DESIGN.md §4): 5 collections of 8. Each tower is a vessel shape plus the
// liquids that fill it (the tower settles by weight like any flask). Each layer takes
// POURS_PER_LAYER sealed flasks of that liquid.

import { Rng, seedOf } from "../../../../forge/src/core/rng.ts";
import { LIQUIDS, LIQUID_BY_ID } from "./liquids.ts";

export const POURS_PER_LAYER = 6;

/** Vessel silhouettes drawn by view/tower-draw.ts. */
export type VesselShape = "cylinder" | "flask" | "hourglass" | "potion" | "star" | "lantern";
const SHAPES: VesselShape[] = ["cylinder", "flask", "hourglass", "potion", "star", "lantern"];

export interface Tower {
  id: string;
  name: string;
  shape: VesselShape;
  /** Liquid indices (LIQUIDS) in the tower, any order; drawn settled by weight. */
  layers: number[];
}

export interface Collection {
  id: string;
  name: string;
  towers: Tower[];
}

interface Theme {
  id: string;
  name: string;
  /** Liquids this collection draws from (ids). */
  pool: string[];
  towers: string[];
}

const THEMES: Theme[] = [
  {
    id: "kitchen",
    name: "Kitchen Science",
    pool: ["sky", "berry", "lime", "olive", "mint", "honey", "maple", "choco", "cherry"],
    towers: ["Breakfast Tower", "Juice Bar", "Honey Pot", "Sunday Pancakes", "Fruit Punch", "Syrup Swirl", "Lemonade Stand", "Chef's Special"],
  },
  {
    id: "rainbow",
    name: "Rainbow",
    pool: ["cherry", "honey", "olive", "lime", "sky", "grape", "lavender", "berry", "lagoon"],
    towers: ["Red Sunrise", "Orange Glow", "Lemon Light", "Green Meadow", "Blue Lagoon", "Violet Hour", "Full Spectrum", "Prism"],
  },
  {
    id: "ocean",
    name: "Ocean",
    pool: ["sky", "lagoon", "mint", "lavender", "milkfoam", "berryfoam", "maple", "honey", "olive"],
    towers: ["Tide Pool", "Coral Reef", "Deep Blue", "Sea Foam", "Lighthouse Lamp", "Kelp Forest", "Pearl Diver", "Sunset Sail"],
  },
  {
    id: "potion",
    name: "Potion Shop",
    pool: ["grape", "berry", "lavender", "mint", "cherry", "choco", "berryfoam", "milkfoam", "quicksilver", "gold"],
    towers: ["Love Potion", "Sleep Draught", "Luck Elixir", "Dragon Tonic", "Moon Brew", "Witch's Broth", "Phoenix Oil", "Royal Remedy"],
  },
  {
    id: "space",
    name: "Space Lab",
    pool: ["grape", "sky", "lagoon", "lavender", "milkfoam", "quicksilver", "gold", "cherry", "choco", "olive"],
    towers: ["Nebula", "Comet Tail", "Saturn Rings", "Solar Flare", "Moon Dust", "Starfield", "Black Hole", "Galaxy"],
  },
];

/** Pick 5-7 liquids for a tower: at least 3 weights, no two of the same liquid. */
function layersFor(name: string, pool: string[]): number[] {
  const rng = new Rng(seedOf(name, "tower"));
  for (let attempt = 0; attempt < 50; attempt++) {
    const count = rng.int(5, 7);
    const picks = rng.shuffle(pool.slice()).slice(0, count).map((id) => LIQUID_BY_ID[id]);
    if (new Set(picks.map((i) => LIQUIDS[i].weight)).size >= 3) return picks;
  }
  return pool.slice(0, 5).map((id) => LIQUID_BY_ID[id]);
}

export const COLLECTIONS: Collection[] = THEMES.map((th, ci) => ({
  id: th.id,
  name: th.name,
  towers: th.towers.map((name, ti) => ({
    id: `${th.id}-${ti}`,
    name,
    shape: SHAPES[(ci * 3 + ti) % SHAPES.length],
    layers: layersFor(name, th.pool),
  })),
}));

export const ALL_TOWERS: Array<{ collection: number; index: number; tower: Tower }> = COLLECTIONS.flatMap((c, ci) =>
  c.towers.map((tower, index) => ({ collection: ci, index, tower })),
);
