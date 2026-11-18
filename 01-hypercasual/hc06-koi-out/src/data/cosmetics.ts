// Cosmetics (DESIGN.md §4 Shop): pond themes (one per region, plus two for coins), ripple trails and
// lily pad styles.

import { REGIONS } from "./varieties.ts";

export type CosmeticSlot = "theme" | "trail" | "pads";

export interface Cosmetic {
  id: string;
  slot: CosmeticSlot;
  price: number;
  /** Region whose journal page gives this item (not sold). */
  album?: string;
  swatch: string;
  theme?: { deep: string; shallow: string; stone: string; grass: string; bg: string; dark?: boolean };
  trail?: string;
  pink?: boolean;
}

const bg = (a: string, b: string) => `radial-gradient(ellipse at 50% 35%, ${a} 0%, ${b} 100%)`;

export const COSMETICS: Cosmetic[] = [
  ...REGIONS.map((r, i) => ({
    id: `theme_${r.id}`,
    slot: "theme" as const,
    price: 0,
    album: r.id,
    swatch: `linear-gradient(135deg,${r.shallow},${r.deep})`,
    theme: { deep: r.deep, shallow: r.shallow, stone: r.stone, grass: r.grass, bg: bg(r.grass, r.stone), dark: i === 4 },
  })),
  { id: "theme_autumn", slot: "theme", price: 600, swatch: "linear-gradient(135deg,#d9822e,#7a3a1a)", theme: { deep: "#2a4a4a", shallow: "#6a8a6a", stone: "#8a7a6a", grass: "#c87a3a", bg: bg("#d9a05a", "#8a5a3a") } },
  { id: "theme_snow", slot: "theme", price: 900, swatch: "linear-gradient(135deg,#ffffff,#9fc0d8)", theme: { deep: "#2a5a7a", shallow: "#8ab8d0", stone: "#b8c0c8", grass: "#eef4f8", bg: bg("#ffffff", "#cfe0ea") } },
  { id: "trail_plain", slot: "trail", price: 0, swatch: "radial-gradient(circle,#fff 0 30%,#bfe3ff 31%)", trail: "💧" },
  { id: "trail_petals", slot: "trail", price: 250, swatch: "radial-gradient(circle,#f8c0d8 0 40%,#fff 41%)", trail: "🌸" },
  { id: "trail_bubbles", slot: "trail", price: 350, swatch: "radial-gradient(circle,#dff4ff 0 40%,#7ac0e8 41%)", trail: "🫧" },
  { id: "trail_sparkles", slot: "trail", price: 500, swatch: "radial-gradient(circle,#fff6a0 0 40%,#f2c14e 41%)", trail: "✨" },
  { id: "pads_green", slot: "pads", price: 0, swatch: "radial-gradient(circle,#5fae4a,#3f8a3a)", pink: false },
  { id: "pads_lotus", slot: "pads", price: 300, swatch: "radial-gradient(circle,#f2a0c0 0 35%,#3f8a3a 36%)", pink: true },
];

export const DEFAULT_EQUIPPED: Record<CosmeticSlot, string> = { theme: "theme_garden", trail: "trail_plain", pads: "pads_green" };

export function cosmetic(id: string): Cosmetic {
  return COSMETICS.find((c) => c.id === id) ?? COSMETICS[0];
}

export function regionReward(regionId: string): Cosmetic | undefined {
  return COSMETICS.find((c) => c.album === regionId);
}
