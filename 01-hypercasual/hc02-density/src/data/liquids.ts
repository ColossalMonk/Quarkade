// The 16 liquids (DESIGN.md §2). Weight: 1 Foam < 2 Oil < 3 Water < 4 Syrup < 5 Mercury.
// `symbol` is the colour-blind mark (0-11, shared shapes with forge games); `look` picks the
// class shading in the liquid shader.

export interface Liquid {
  id: string;
  name: string;
  hex: string;
  weight: number;
  symbol: number;
}

export const LIQUIDS: Liquid[] = [
  { id: "sky", name: "Sky Water", hex: "#4aa8e8", weight: 3, symbol: 0 },
  { id: "lagoon", name: "Lagoon", hex: "#18a89a", weight: 3, symbol: 1 },
  { id: "berry", name: "Berry Juice", hex: "#e8507a", weight: 3, symbol: 2 },
  { id: "lime", name: "Lime Juice", hex: "#8cc63f", weight: 3, symbol: 3 },
  { id: "grape", name: "Grape Juice", hex: "#8e5bc8", weight: 3, symbol: 4 },
  { id: "olive", name: "Olive Oil", hex: "#e7c03a", weight: 2, symbol: 5 },
  { id: "lavender", name: "Lavender Oil", hex: "#c4a4ff", weight: 2, symbol: 6 },
  { id: "mint", name: "Mint Oil", hex: "#8fe0b8", weight: 2, symbol: 7 },
  { id: "honey", name: "Honey", hex: "#f09a1c", weight: 4, symbol: 8 },
  { id: "maple", name: "Maple", hex: "#9c5a28", weight: 4, symbol: 9 },
  { id: "cherry", name: "Cherry Syrup", hex: "#c0182e", weight: 4, symbol: 10 },
  { id: "choco", name: "Chocolate", hex: "#5a3220", weight: 4, symbol: 11 },
  { id: "milkfoam", name: "Milk Foam", hex: "#f7f2ea", weight: 1, symbol: 0 },
  { id: "berryfoam", name: "Berry Foam", hex: "#f7b6d2", weight: 1, symbol: 2 },
  { id: "quicksilver", name: "Quicksilver", hex: "#c4cad4", weight: 5, symbol: 4 },
  { id: "gold", name: "Liquid Gold", hex: "#d4af37", weight: 5, symbol: 8 },
];

export const LIQUID_BY_ID: Record<string, number> = Object.fromEntries(LIQUIDS.map((l, i) => [l.id, i]));

/** Liquid indices in each weight class. */
export function liquidsOfWeight(w: number): number[] {
  return LIQUIDS.map((l, i) => (l.weight === w ? i : -1)).filter((i) => i >= 0);
}

export const WEIGHT_NAMES: Record<number, string> = { 1: "foam", 2: "oil", 3: "water", 4: "syrup", 5: "mercury" };

/** Murky units are drawn in this colour until revealed. */
export const MURKY_HEX = "#9a958e";
