// Cosmetics (DESIGN.md §4 "Progression"): yarn styles, needle skins, board themes.
// Bought with coins in the shop (opens after level 20), or earned by finishing albums.
// Cosmetic only: nothing here changes how a level plays.

export type CosmeticSlot = "yarn" | "needle" | "board";

export interface YarnStyle {
  stitch: number; // depth of the V-stitch pattern (0 = smooth)
  fuzz: number; // fuzzy rim light strength
  metal: number;
  rough: number;
  rainbow: number; // 0..1 rainbow dye along the loop
}

export interface NeedleStyle {
  color: number;
  ball: number;
  metal: number;
  rough: number;
  emissive?: number;
  stripes?: [string, string];
  opacity?: number;
}

export interface BoardStyle {
  kind: "wood" | "felt" | "picnic" | "starry";
  /** Page background behind the board. */
  bg: string;
}

export interface Cosmetic {
  id: string;
  slot: CosmeticSlot;
  /** Coin price; 0 = owned from the start. Album rewards have no price. */
  price: number;
  /** Album id whose completion unlocks this item. */
  album?: string;
  /** CSS background for the shop card swatch. */
  swatch: string;
  yarn?: YarnStyle;
  needle?: NeedleStyle;
  board?: BoardStyle;
}

export const COSMETICS: Cosmetic[] = [
  // Yarn
  { id: "yarn_chunky", slot: "yarn", price: 0, swatch: "repeating-linear-gradient(60deg,#e04a4f 0 8px,#c63e43 8px 12px)", yarn: { stitch: 1, fuzz: 0.38, metal: 0, rough: 0.92, rainbow: 0 } },
  { id: "yarn_mohair", slot: "yarn", price: 300, swatch: "radial-gradient(circle,#f5a3c7,#ef84b5 60%,#fde4ef)", yarn: { stitch: 0.55, fuzz: 0.85, metal: 0, rough: 1, rainbow: 0 } },
  { id: "yarn_cotton", slot: "yarn", price: 300, swatch: "linear-gradient(180deg,#8fd3ee,#62aee8)", yarn: { stitch: 0.25, fuzz: 0.15, metal: 0, rough: 0.7, rainbow: 0 } },
  { id: "yarn_metallic", slot: "yarn", price: 900, swatch: "linear-gradient(135deg,#fff3c4,#f2c14e 40%,#a8781a 70%,#fff3c4)", yarn: { stitch: 0.6, fuzz: 0.12, metal: 0.55, rough: 0.38, rainbow: 0 } },
  { id: "yarn_rainbow", slot: "yarn", price: 1500, swatch: "linear-gradient(90deg,#e04a4f,#f28a2e,#f4c744,#3f9d55,#62aee8,#8b5bc4)", yarn: { stitch: 0.9, fuzz: 0.4, metal: 0, rough: 0.92, rainbow: 1 } },

  // Needles (album rewards first, then shop)
  { id: "needle_wood", slot: "needle", price: 0, swatch: "linear-gradient(90deg,#c48a55,#d9a46a,#b77a47)", needle: { color: 0xd9a46a, ball: 0x9b6438, metal: 0, rough: 0.55 } },
  { id: "needle_bamboo", slot: "needle", price: 0, album: "home", swatch: "repeating-linear-gradient(0deg,#e8d58a 0 14px,#b9a052 14px 16px)", needle: { color: 0xe3cf86, ball: 0x8aa04a, metal: 0, rough: 0.5 } },
  { id: "needle_candy", slot: "needle", price: 0, album: "garden", swatch: "repeating-linear-gradient(45deg,#e04a4f 0 6px,#fff 6px 12px)", needle: { color: 0xffffff, ball: 0xe04a4f, metal: 0, rough: 0.35, stripes: ["#ffffff", "#e04a4f"] } },
  { id: "needle_coral", slot: "needle", price: 0, album: "seaside", swatch: "linear-gradient(180deg,#ff9e8a,#e2725b)", needle: { color: 0xff9480, ball: 0xfff1e0, metal: 0.1, rough: 0.4 } },
  { id: "needle_sugar", slot: "needle", price: 0, album: "sweets", swatch: "linear-gradient(180deg,#ffd6ea,#c9a7ff)", needle: { color: 0xf4c4e6, ball: 0xc9a7ff, metal: 0, rough: 0.2, opacity: 0.8, emissive: 0x3a2040 } },
  { id: "needle_star", slot: "needle", price: 0, album: "night", swatch: "radial-gradient(circle at 30% 30%,#ffe9a0 0 3px,transparent 4px),#26306a", needle: { color: 0x2a3474, ball: 0xffd560, metal: 0.3, rough: 0.35, emissive: 0x12183a } },
  { id: "needle_steel", slot: "needle", price: 500, swatch: "linear-gradient(90deg,#8d96a3,#e6ebf2,#8d96a3)", needle: { color: 0xc9d1dc, ball: 0x7d8794, metal: 0.85, rough: 0.28 } },
  { id: "needle_crystal", slot: "needle", price: 1200, swatch: "linear-gradient(135deg,#e9fbff,#9fe7ff 50%,#e9fbff)", needle: { color: 0xbff2ff, ball: 0xe9fbff, metal: 0.1, rough: 0.05, opacity: 0.65, emissive: 0x204a5a } },

  // Boards
  { id: "board_oak", slot: "board", price: 0, swatch: "linear-gradient(180deg,#c48a55,#b77a47)", board: { kind: "wood", bg: "radial-gradient(ellipse at 50% 30%, #f7e6cc 0%, #ecd0aa 55%, #d9b286 100%)" } },
  { id: "board_felt", slot: "board", price: 400, swatch: "radial-gradient(circle,#4f9a62,#2f6e42)", board: { kind: "felt", bg: "radial-gradient(ellipse at 50% 30%, #e5efd9 0%, #bcd3ac 55%, #8fae80 100%)" } },
  { id: "board_picnic", slot: "board", price: 600, swatch: "repeating-linear-gradient(0deg,rgba(224,74,79,.75) 0 8px,transparent 8px 16px),repeating-linear-gradient(90deg,rgba(224,74,79,.75) 0 8px,#fff 8px 16px)", board: { kind: "picnic", bg: "radial-gradient(ellipse at 50% 30%, #fdf3e6 0%, #f4d9c4 55%, #e3b89c 100%)" } },
  { id: "board_starry", slot: "board", price: 1000, swatch: "radial-gradient(circle at 25% 30%,#fff 0 1.5px,transparent 2px),radial-gradient(circle at 70% 65%,#ffe9a0 0 2px,transparent 3px),#1f2756", board: { kind: "starry", bg: "radial-gradient(ellipse at 50% 30%, #3b4785 0%, #232b5c 60%, #141938 100%)" } },
];

export const DEFAULT_EQUIPPED: Record<CosmeticSlot, string> = { yarn: "yarn_chunky", needle: "needle_wood", board: "board_oak" };

export function cosmetic(id: string): Cosmetic {
  return COSMETICS.find((c) => c.id === id) ?? COSMETICS.find((c) => c.id === DEFAULT_EQUIPPED.yarn)!;
}

export function albumReward(albumId: string): Cosmetic | undefined {
  return COSMETICS.find((c) => c.album === albumId);
}

/** Total stars needed to open each album (by index). Albums 1-5. */
export const ALBUM_STARS = [0, 60, 150, 250, 360];

/** The shop opens once the player reaches this level. */
export const SHOP_LEVEL = 20;
