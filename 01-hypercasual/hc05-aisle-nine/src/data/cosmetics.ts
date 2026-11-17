// Cosmetics (DESIGN.md §4 Shop): stand finishes, awnings and shopping bags, plus the store themes
// that opening each Main Street shop gives.

export type CosmeticSlot = "stand" | "awning" | "bag" | "theme";

export interface Cosmetic {
  id: string;
  slot: CosmeticSlot;
  price: number;
  /** Shop whose opening gives this item (not sold). */
  album?: string;
  swatch: string;
  stand?: { wood: string; plank: string };
  awning?: [string, string];
  bag?: string;
  theme?: { bg: string; trim: string; dark?: boolean };
}

const bg = (a: string, b: string, c: string) => `radial-gradient(ellipse at 50% 35%, ${a} 0%, ${b} 62%, ${c} 100%)`;

export const COSMETICS: Cosmetic[] = [
  { id: "stand_pine", slot: "stand", price: 0, swatch: "linear-gradient(90deg,#c9935a,#e0b07a)", stand: { wood: "#c9935a", plank: "#ecd3a8" } },
  { id: "stand_chrome", slot: "stand", price: 300, swatch: "linear-gradient(135deg,#9aa4b0,#e6ebf0)", stand: { wood: "#a9b2bd", plank: "#e9eef3" } },
  { id: "stand_wicker", slot: "stand", price: 500, swatch: "repeating-linear-gradient(45deg,#d9b06a 0 5px,#b8894a 5px 10px)", stand: { wood: "#b8894a", plank: "#e8cf98" } },
  { id: "stand_candy", slot: "stand", price: 700, swatch: "repeating-linear-gradient(135deg,#ff8fb1 0 6px,#fff 6px 12px)", stand: { wood: "#f48fb1", plank: "#fff0f5" } },
  { id: "stand_brass", slot: "stand", price: 900, swatch: "linear-gradient(135deg,#b8862a,#f5d06a)", stand: { wood: "#c8963a", plank: "#3a2a1e" } },

  { id: "awning_red", slot: "awning", price: 0, swatch: "repeating-linear-gradient(90deg,#d9382f 0 10px,#fff 10px 20px)", awning: ["#d9382f", "#fff6ea"] },
  { id: "awning_mint", slot: "awning", price: 250, swatch: "repeating-linear-gradient(90deg,#4bbf9a 0 10px,#fff 10px 20px)", awning: ["#4bbf9a", "#f3fff9"] },
  { id: "awning_navy", slot: "awning", price: 350, swatch: "repeating-linear-gradient(90deg,#2a3f7a 0 10px,#f3e9d8 10px 20px)", awning: ["#2a3f7a", "#f3e9d8"] },
  { id: "awning_polka", slot: "awning", price: 450, swatch: "radial-gradient(circle at 30% 30%,#fff 0 3px,transparent 4px) 0 0/12px 12px,#e0508f", awning: ["#e0508f", "#ffe0ef"] },

  { id: "bag_paper", slot: "bag", price: 0, swatch: "linear-gradient(#d9b98a,#b8946a)", bag: "🛍️" },
  { id: "bag_tote", slot: "bag", price: 200, swatch: "linear-gradient(#f3e9d8,#d8c8a8)", bag: "👜" },
  { id: "bag_gift", slot: "bag", price: 400, swatch: "linear-gradient(135deg,#e0352b,#ffd54a)", bag: "🎁" },
  { id: "bag_basket", slot: "bag", price: 600, swatch: "repeating-linear-gradient(45deg,#d9b06a 0 5px,#b8894a 5px 10px)", bag: "🧺" },

  { id: "theme_grocery", slot: "theme", price: 0, album: "grocery", swatch: "linear-gradient(135deg,#f3e6cf,#4f9a5a)", theme: { bg: bg("#fbf3e3", "#f0dfc0", "#d9bf94"), trim: "#4f9a5a" } },
  { id: "theme_bakery", slot: "theme", price: 0, album: "bakery", swatch: "linear-gradient(135deg,#f7e3d0,#c8743c)", theme: { bg: bg("#fff1e4", "#f2d6bb", "#d8ac84"), trim: "#c8743c" } },
  { id: "theme_toys", slot: "theme", price: 0, album: "toys", swatch: "linear-gradient(135deg,#e3eefc,#3f7fd0)", theme: { bg: bg("#f2f7ff", "#dbe8fa", "#a9c3e6"), trim: "#3f7fd0" } },
  { id: "theme_garden", slot: "theme", price: 0, album: "garden", swatch: "linear-gradient(135deg,#e8f3dc,#5b8c3a)", theme: { bg: bg("#f4fbec", "#e0efcd", "#b4cf93"), trim: "#5b8c3a" } },
  { id: "theme_sweets", slot: "theme", price: 0, album: "sweets", swatch: "linear-gradient(135deg,#fbe3ef,#e0508f)", theme: { bg: bg("#fff4f9", "#f9dceb", "#eab0cd"), trim: "#e0508f" } },
  { id: "theme_books", slot: "theme", price: 0, album: "books", swatch: "linear-gradient(135deg,#efe6da,#7a3b3b)", theme: { bg: bg("#6b5040", "#4e382c", "#33241c"), trim: "#7a3b3b", dark: true } },
];

export const DEFAULT_EQUIPPED: Record<CosmeticSlot, string> = { stand: "stand_pine", awning: "awning_red", bag: "bag_paper", theme: "theme_grocery" };

export function cosmetic(id: string): Cosmetic {
  return COSMETICS.find((c) => c.id === id) ?? COSMETICS[0];
}

export function shopReward(shopId: string): Cosmetic | undefined {
  return COSMETICS.find((c) => c.album === shopId);
}
