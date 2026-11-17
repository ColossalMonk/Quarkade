// Cosmetics (DESIGN.md §4): glassware, lab benches, pour effects. Coins or collection rewards.

export type CosmeticSlot = "glass" | "bench" | "pour";

export interface GlassStyle {
  /** 0 tube, 1 beaker, 2 potion bottle */
  shape: number;
  tint: string;
  frost: number;
  rim: string;
}
export interface BenchStyle {
  kind: "wood" | "tile" | "wizard" | "space";
  bg: string;
}
export interface PourStyle {
  sparkle: number;
  bubbles: number;
  rainbow: number;
}

export interface Cosmetic {
  id: string;
  slot: CosmeticSlot;
  price: number;
  album?: string;
  swatch: string;
  glass?: GlassStyle;
  bench?: BenchStyle;
  pour?: PourStyle;
}

export const COSMETICS: Cosmetic[] = [
  { id: "glass_tube", slot: "glass", price: 0, swatch: "linear-gradient(90deg,#dfeef7,#ffffff,#cfe3ee)", glass: { shape: 0, tint: "#e8f4fb", frost: 0, rim: "#ffffff" } },
  { id: "glass_beaker", slot: "glass", price: 300, swatch: "linear-gradient(180deg,#e8f6ff,#bfe2f5)", glass: { shape: 1, tint: "#e3f3ff", frost: 0, rim: "#ffffff" } },
  { id: "glass_potion", slot: "glass", price: 600, swatch: "radial-gradient(circle at 50% 60%,#d9c8ff,#9c7fe0)", glass: { shape: 2, tint: "#efe6ff", frost: 0, rim: "#f2e8ff" } },
  { id: "glass_frosted", slot: "glass", price: 900, swatch: "linear-gradient(135deg,#f4f8fb,#d9e4ea)", glass: { shape: 0, tint: "#f2f6f8", frost: 0.6, rim: "#ffffff" } },
  { id: "glass_crystal", slot: "glass", price: 1500, swatch: "linear-gradient(135deg,#ffffff,#b6f0ff,#ffffff)", glass: { shape: 0, tint: "#e8fbff", frost: 0, rim: "#b6f0ff" } },
  { id: "glass_amber", slot: "glass", price: 0, album: "kitchen", swatch: "linear-gradient(180deg,#ffe0a8,#e9a945)", glass: { shape: 1, tint: "#ffe8c0", frost: 0, rim: "#fff1d6" } },
  { id: "glass_rose", slot: "glass", price: 0, album: "rainbow", swatch: "linear-gradient(180deg,#ffd4e4,#f28bb3)", glass: { shape: 0, tint: "#ffe3ee", frost: 0, rim: "#fff0f6" } },
  { id: "glass_sea", slot: "glass", price: 0, album: "ocean", swatch: "linear-gradient(180deg,#c8f2ee,#4bbfb2)", glass: { shape: 2, tint: "#d9f7f3", frost: 0.2, rim: "#eafffb" } },
  { id: "glass_alchemy", slot: "glass", price: 0, album: "potion", swatch: "linear-gradient(180deg,#e2d1ff,#7a4fd0)", glass: { shape: 2, tint: "#ebe0ff", frost: 0, rim: "#d6c2ff" } },
  { id: "glass_cosmic", slot: "glass", price: 0, album: "space", swatch: "radial-gradient(circle at 30% 30%,#fff 0 2px,transparent 3px),linear-gradient(180deg,#5966b8,#232b5c)", glass: { shape: 0, tint: "#dfe3ff", frost: 0, rim: "#c9d0ff" } },

  { id: "bench_wood", slot: "bench", price: 0, swatch: "linear-gradient(180deg,#c48a55,#b77a47)", bench: { kind: "wood", bg: "radial-gradient(ellipse at 50% 30%, #f3ead8 0%, #e1d2b5 55%, #c9b490 100%)" } },
  { id: "bench_tile", slot: "bench", price: 400, swatch: "repeating-linear-gradient(0deg,#e9eef2 0 14px,#cfd8df 14px 16px)", bench: { kind: "tile", bg: "radial-gradient(ellipse at 50% 30%, #f2f6f8 0%, #dce6ec 60%, #bfcdd6 100%)" } },
  { id: "bench_wizard", slot: "bench", price: 700, swatch: "linear-gradient(180deg,#6b4a8a,#3a2650)", bench: { kind: "wizard", bg: "radial-gradient(ellipse at 50% 30%, #5d4580 0%, #3a2856 60%, #22163a 100%)" } },
  { id: "bench_space", slot: "bench", price: 1000, swatch: "radial-gradient(circle at 25% 30%,#fff 0 1.5px,transparent 2px),#1f2756", bench: { kind: "space", bg: "radial-gradient(ellipse at 50% 30%, #3b4785 0%, #232b5c 60%, #141938 100%)" } },

  { id: "pour_plain", slot: "pour", price: 0, swatch: "linear-gradient(180deg,#4aa8e8,#2b7fc0)", pour: { sparkle: 0, bubbles: 0, rainbow: 0 } },
  { id: "pour_sparkle", slot: "pour", price: 500, swatch: "radial-gradient(circle at 40% 40%,#fff 0 3px,transparent 4px),linear-gradient(180deg,#f7d56b,#e7a93a)", pour: { sparkle: 1, bubbles: 0, rainbow: 0 } },
  { id: "pour_bubbles", slot: "pour", price: 500, swatch: "radial-gradient(circle at 30% 60%,#fff8 0 5px,transparent 6px),radial-gradient(circle at 65% 35%,#fff8 0 4px,transparent 5px),#7cc7ea", pour: { sparkle: 0, bubbles: 1, rainbow: 0 } },
  { id: "pour_rainbow", slot: "pour", price: 1200, swatch: "linear-gradient(90deg,#e04a4f,#f28a2e,#f4c744,#3f9d55,#62aee8,#8b5bc4)", pour: { sparkle: 0.5, bubbles: 0, rainbow: 1 } },
];

export const DEFAULT_EQUIPPED: Record<CosmeticSlot, string> = { glass: "glass_tube", bench: "bench_wood", pour: "pour_plain" };

export function cosmetic(id: string): Cosmetic {
  return COSMETICS.find((c) => c.id === id) ?? COSMETICS[0];
}

export function collectionReward(collectionId: string): Cosmetic | undefined {
  return COSMETICS.find((c) => c.album === collectionId);
}

/** Total stars needed to open each collection. */
export const COLLECTION_STARS = [0, 60, 150, 250, 360];
