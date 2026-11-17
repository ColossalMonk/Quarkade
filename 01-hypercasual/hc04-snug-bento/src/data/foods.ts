// Foods (DESIGN.md §2): what each piece looks like. Levels only store a piece's shape, temperature,
// softness and sauce link; the game picks a matching food at play time (small, medium or large by
// cell count; hot, cold or neither), preferring foods the current recipe still needs.

export type SizeGroup = "small" | "medium" | "large";

/** Shader patterns (food-material.ts). */
export const PAT = { rice: 0, egg: 1, sausage: 2, fried: 3, floret: 4, glossy: 5, pod: 6, salmon: 7, jelly: 8, berries: 9, gyoza: 10, onigiri: 11, noodles: 12, maki: 13, sauce: 14 } as const;

export interface Food {
  id: string;
  size: SizeGroup;
  /** 0 neither, 1 hot, 2 cold. */
  temp: number;
  /** Soft foods (two shapes). */
  soft?: boolean;
  /** Sauce cups. */
  sauce?: boolean;
  pattern: number;
  /** Main, second and accent colours. */
  colors: [string, string, string];
  /** Colour-blind / small-screen icon. */
  icon: string;
  /** For sauce cups: the foods they go with. */
  goesWith?: string[];
}

export const FOODS: Food[] = [
  // Small (1 cell)
  { id: "tomato", size: "small", temp: 0, pattern: PAT.glossy, colors: ["#e8443a", "#ff8a7a", "#3f9d55"], icon: "🍅" },
  { id: "broccoli", size: "small", temp: 0, pattern: PAT.floret, colors: ["#3f9d55", "#7cc96a", "#2f6f3c"], icon: "🥦" },
  { id: "edamame", size: "small", temp: 0, pattern: PAT.pod, colors: ["#8cc63f", "#b8e07a", "#5d8f2a"], icon: "🫛" },
  { id: "meatball", size: "small", temp: 1, pattern: PAT.fried, colors: ["#8a4a2a", "#b8703f", "#5a2e18"], icon: "🧆" },
  { id: "grape", size: "small", temp: 2, pattern: PAT.berries, colors: ["#7a4fc8", "#a882e8", "#4e2f8a"], icon: "🍇" },
  { id: "strawberry", size: "small", temp: 2, pattern: PAT.berries, colors: ["#e8435f", "#ff8aa0", "#3f9d55"], icon: "🍓" },
  // Medium (2-3 cells)
  { id: "tamagoyaki", size: "medium", temp: 0, pattern: PAT.egg, colors: ["#f5cf4a", "#ffe58a", "#d9a92a"], icon: "🥚" },
  { id: "carrot", size: "medium", temp: 0, pattern: PAT.glossy, colors: ["#f58a1f", "#ffb15a", "#3f9d55"], icon: "🥕" },
  { id: "sausage", size: "medium", temp: 1, pattern: PAT.sausage, colors: ["#e85a5a", "#ff9a8a", "#b83a3a"], icon: "🌭" },
  { id: "tempura", size: "medium", temp: 1, pattern: PAT.fried, colors: ["#e8b04a", "#ffd47a", "#e8603a"], icon: "🍤" },
  { id: "jelly", size: "medium", temp: 2, pattern: PAT.jelly, colors: ["#f07aa8", "#ffc2d8", "#ffffff"], icon: "🍮" },
  { id: "kappa", size: "medium", temp: 2, pattern: PAT.maki, colors: ["#2a3a2a", "#f4f1ea", "#7cc96a"], icon: "🥒" },
  // Large (4-6 cells)
  { id: "rice", size: "large", temp: 0, pattern: PAT.rice, colors: ["#f8f6f0", "#e8e2d4", "#2a3a2a"], icon: "🍚" },
  { id: "salmon", size: "large", temp: 0, pattern: PAT.salmon, colors: ["#f5895a", "#ffd2b8", "#e8603a"], icon: "🐟" },
  { id: "noodles", size: "large", temp: 0, pattern: PAT.noodles, colors: ["#f2d48a", "#ffeab8", "#c9a24a"], icon: "🍜" },
  { id: "karaage", size: "large", temp: 1, pattern: PAT.fried, colors: ["#c9822e", "#e8b04a", "#7a4a1e"], icon: "🍗" },
  { id: "gyoza", size: "large", temp: 1, pattern: PAT.gyoza, colors: ["#f2e2c0", "#fff4dc", "#b8703f"], icon: "🥟" },
  { id: "fruitsalad", size: "large", temp: 2, pattern: PAT.berries, colors: ["#f5c518", "#e8435f", "#7cc96a"], icon: "🍓" },
  { id: "sushi", size: "large", temp: 2, pattern: PAT.maki, colors: ["#2a3a2a", "#f4f1ea", "#f5895a"], icon: "🍣" },
  // Soft (two shapes): one per temperature
  { id: "onigiri", size: "medium", temp: 0, soft: true, pattern: PAT.onigiri, colors: ["#f8f6f0", "#e8e2d4", "#1f2a1f"], icon: "🍙" },
  { id: "dumpling", size: "medium", temp: 1, soft: true, pattern: PAT.gyoza, colors: ["#fff4e0", "#ffffff", "#d9b48c"], icon: "🥟" },
  { id: "mochi", size: "medium", temp: 2, soft: true, pattern: PAT.jelly, colors: ["#c9e8b8", "#f4fff0", "#ffffff"], icon: "🍡" },
  // Sauce cups (1 cell)
  { id: "soy", size: "small", temp: 0, sauce: true, pattern: PAT.sauce, colors: ["#4a2a1a", "#7a4a2a", "#e8e2d4"], icon: "🫙", goesWith: ["sushi", "kappa", "gyoza", "dumpling", "salmon", "rice", "onigiri"] },
  { id: "ketchup", size: "small", temp: 0, sauce: true, pattern: PAT.sauce, colors: ["#d8302a", "#ff6a5a", "#e8e2d4"], icon: "🥫", goesWith: ["sausage", "meatball", "karaage", "tempura", "noodles"] },
  { id: "mayo", size: "small", temp: 0, sauce: true, pattern: PAT.sauce, colors: ["#f5e9b8", "#fffbe8", "#e8e2d4"], icon: "🥚", goesWith: ["tamagoyaki", "carrot", "broccoli", "fruitsalad", "jelly", "mochi"] },
];

export const FOOD_INDEX: Record<string, number> = Object.fromEntries(FOODS.map((f, i) => [f.id, i]));

export function sizeGroup(cells: number): SizeGroup {
  return cells <= 1 ? "small" : cells <= 3 ? "medium" : "large";
}

/** Foods a piece could be: same size group and temperature (soft pieces: the soft food of that temperature). */
export function candidatesFor(cells: number, temp: number, soft: boolean, sauce: boolean): number[] {
  return FOODS.map((f, i) => ({ f, i }))
    .filter(({ f }) => {
      if (sauce) return !!f.sauce;
      if (f.sauce) return false;
      if (soft) return !!f.soft && f.temp === temp;
      return !f.soft && f.size === sizeGroup(cells) && f.temp === temp;
    })
    .map(({ i }) => i);
}

/** The sauce that goes with a food (soy, ketchup or mayo). */
export function sauceFor(foodId: string): number {
  const i = FOODS.findIndex((f) => f.sauce && f.goesWith?.includes(foodId));
  return i >= 0 ? i : FOOD_INDEX.soy;
}
