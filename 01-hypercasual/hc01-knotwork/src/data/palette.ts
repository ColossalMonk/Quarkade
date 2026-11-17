// The 12 yarn colours. Each has a symbol for colour-blind mode and a letter used in quilt grids.

export interface Yarn {
  key: string; // letter used in quilt pictures
  name: string;
  hex: string;
  symbol: number; // 0..11, drawn by the knit shader in colour-blind mode
}

export const YARNS: Yarn[] = [
  { key: "r", name: "Cherry", hex: "#e04a4f", symbol: 0 },
  { key: "o", name: "Pumpkin", hex: "#f28a2e", symbol: 1 },
  { key: "y", name: "Butter", hex: "#f4c744", symbol: 2 },
  { key: "g", name: "Moss", hex: "#3f9d55", symbol: 3 },
  { key: "t", name: "Teal", hex: "#1aa39c", symbol: 4 },
  { key: "s", name: "Sky", hex: "#62aee8", symbol: 5 },
  { key: "n", name: "Navy", hex: "#304c9a", symbol: 6 },
  { key: "p", name: "Plum", hex: "#8b5bc4", symbol: 7 },
  { key: "k", name: "Rose", hex: "#ef84b5", symbol: 8 },
  { key: "b", name: "Cocoa", hex: "#8a5a3b", symbol: 9 },
  { key: "w", name: "Cream", hex: "#f3ead8", symbol: 10 },
  { key: "c", name: "Charcoal", hex: "#3b3a45", symbol: 11 },
];

export const YARN_BY_KEY: Record<string, number> = Object.fromEntries(YARNS.map((y, i) => [y.key, i]));

/** Grey used for hidden loops. */
export const HIDDEN_HEX = "#9a948c";
