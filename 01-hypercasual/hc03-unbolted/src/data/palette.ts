// Bolt colours (DESIGN.md §2): 12 bright caps, each with a colour-blind symbol. Levels use colour
// slots 0..k-1; the current gadget decides which palette colour each slot gets.

export interface BoltColour {
  id: string;
  name: string;
  hex: string;
  /** Colour-blind symbol (0-11, the same set as the other Quarkade games). */
  symbol: number;
}

export const BOLT_COLOURS: BoltColour[] = [
  { id: "red", name: "Red", hex: "#e8443a", symbol: 0 },
  { id: "blue", name: "Blue", hex: "#2f7fe0", symbol: 1 },
  { id: "yellow", name: "Yellow", hex: "#f5c518", symbol: 2 },
  { id: "green", name: "Green", hex: "#33b25a", symbol: 3 },
  { id: "orange", name: "Orange", hex: "#f58a1f", symbol: 4 },
  { id: "purple", name: "Purple", hex: "#8a4fd8", symbol: 5 },
  { id: "pink", name: "Pink", hex: "#f06aa8", symbol: 6 },
  { id: "teal", name: "Teal", hex: "#14b3b0", symbol: 7 },
  { id: "white", name: "White", hex: "#f4f1ea", symbol: 8 },
  { id: "sky", name: "Sky", hex: "#7cc9f2", symbol: 9 },
  { id: "lime", name: "Lime", hex: "#a5d62b", symbol: 10 },
  { id: "brown", name: "Brown", hex: "#9a5b2e", symbol: 11 },
];

export const RUSTY_HEX = "#8c6b55";
export const PIN_HEX = "#b9c0c8";

/** Plate paint colours for the default "Painted Steel" finish: soft, so the bolts stand out. */
export const PLATE_PAINTS = ["#9fb6cc", "#a9d9c2", "#f1d58f", "#f3b79a", "#c5b6e8", "#9fd4ef", "#e7a9c0", "#c9d38f"];
