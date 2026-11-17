// Cosmetics (DESIGN.md §4 Shop): box styles, lid wraps and table mats. Each finished café menu
// gives a box style.

export type CosmeticSlot = "box" | "wrap" | "mat";

export interface Cosmetic {
  id: string;
  slot: CosmeticSlot;
  price: number;
  /** Menu whose completion gives this item (not sold). */
  album?: string;
  swatch: string;
  box?: { wood: string; floor: string; lacquer: boolean };
  wrap?: { tie: string };
  mat?: { kind: number; a: string; b: string; bg: string; dark?: boolean };
}

export const COSMETICS: Cosmetic[] = [
  { id: "box_pine", slot: "box", price: 0, swatch: "linear-gradient(90deg,#c9935a,#e0b07a)", box: { wood: "#c9935a", floor: "#f3e1c0", lacquer: false } },
  { id: "box_red", slot: "box", price: 300, swatch: "linear-gradient(135deg,#b8262a,#e8443a)", box: { wood: "#b8262a", floor: "#2a1a1a", lacquer: true } },
  { id: "box_black", slot: "box", price: 500, swatch: "linear-gradient(135deg,#1f1f24,#3a3a44)", box: { wood: "#26262c", floor: "#b8262a", lacquer: true } },
  { id: "box_bamboo", slot: "box", price: 700, swatch: "repeating-linear-gradient(90deg,#c8b56a 0 6px,#a8954a 6px 8px)", box: { wood: "#bfa85e", floor: "#efe6c4", lacquer: false } },
  { id: "box_tin", slot: "box", price: 900, swatch: "linear-gradient(135deg,#9fd4ef,#f3b7c9)", box: { wood: "#9fc8e8", floor: "#fff4f8", lacquer: true } },
  { id: "box_home", slot: "box", price: 0, album: "home", swatch: "linear-gradient(135deg,#8a5a37,#c9935a)", box: { wood: "#8a5a37", floor: "#f6e8cf", lacquer: false } },
  { id: "box_basket", slot: "box", price: 0, album: "picnic", swatch: "repeating-linear-gradient(45deg,#d9b06a 0 5px,#b8894a 5px 10px)", box: { wood: "#c99a52", floor: "#fff3e0", lacquer: false } },
  { id: "box_festival", slot: "box", price: 0, album: "festival", swatch: "linear-gradient(135deg,#e8443a,#f5c518)", box: { wood: "#d83a2a", floor: "#2a1e18", lacquer: true } },
  { id: "box_shell", slot: "box", price: 0, album: "seaside", swatch: "linear-gradient(135deg,#ffe0d0,#f7b6a0)", box: { wood: "#f2c2ad", floor: "#fff8f0", lacquer: true } },
  { id: "box_rocket", slot: "box", price: 0, album: "space", swatch: "linear-gradient(135deg,#c9ced6,#5966b8)", box: { wood: "#a8b0c0", floor: "#1e2238", lacquer: true } },

  { id: "wrap_ribbon", slot: "wrap", price: 0, swatch: "#e8443a", wrap: { tie: "#e8443a" } },
  { id: "wrap_furoshiki", slot: "wrap", price: 250, swatch: "radial-gradient(circle at 30% 30%,#fff 0 2px,transparent 3px),#3f7fd0", wrap: { tie: "#3f7fd0" } },
  { id: "wrap_sticker", slot: "wrap", price: 350, swatch: "#f5c518", wrap: { tie: "#f5c518" } },
  { id: "wrap_mint", slot: "wrap", price: 450, swatch: "#4bbf9a", wrap: { tie: "#4bbf9a" } },

  { id: "mat_bamboo", slot: "mat", price: 0, swatch: "repeating-linear-gradient(90deg,#d9c08a 0 8px,#b89a62 8px 10px)", mat: { kind: 0, a: "#d9c08a", b: "#b89a62", bg: "radial-gradient(ellipse at 50% 30%, #f3e6c8 0%, #e2c896 60%, #c9a86a 100%)" } },
  { id: "mat_gingham", slot: "mat", price: 400, swatch: "repeating-linear-gradient(0deg,#f4c2c2 0 6px,#fff 6px 12px)", mat: { kind: 1, a: "#ffffff", b: "#f0a8a8", bg: "radial-gradient(ellipse at 50% 30%, #fff4f4 0%, #f6dede 60%, #e8bcbc 100%)" } },
  { id: "mat_cafe", slot: "mat", price: 600, swatch: "linear-gradient(180deg,#8a5a37,#6b4428)", mat: { kind: 2, a: "#8a5a37", b: "#6b4428", bg: "radial-gradient(ellipse at 50% 30%, #a8764c 0%, #7d5233 60%, #5a3a24 100%)", dark: true } },
  { id: "mat_starry", slot: "mat", price: 1000, swatch: "radial-gradient(circle at 25% 30%,#fff 0 1.5px,transparent 2px),#1f2756", mat: { kind: 3, a: "#1f2756", b: "#fff7d0", bg: "radial-gradient(ellipse at 50% 30%, #3b4785 0%, #232b5c 60%, #141938 100%)", dark: true } },
];

export const DEFAULT_EQUIPPED: Record<CosmeticSlot, string> = { box: "box_pine", wrap: "wrap_ribbon", mat: "mat_bamboo" };

export function cosmetic(id: string): Cosmetic {
  return COSMETICS.find((c) => c.id === id) ?? COSMETICS[0];
}

export function menuReward(menuId: string): Cosmetic | undefined {
  return COSMETICS.find((c) => c.album === menuId);
}
