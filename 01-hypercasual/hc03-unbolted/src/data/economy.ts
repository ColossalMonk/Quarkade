// Every tunable number for prices, rewards and ad limits (DESIGN.md §3-4). Starts from the values
// Knotwork and Density were tuned to; re-tune with tools/simulate.ts once the packs exist.

export type PowerUpId = "slot" | "oil" | "drill" | "magnet";

export interface PowerUpInfo {
  id: PowerUpId;
  icon: string;
  unlockLevel: number;
  price: number;
  adsPerLevel: number;
  adsPerDay?: number;
  capsStars: boolean;
  key: string;
}

export const POWER_UPS: PowerUpInfo[] = [
  { id: "slot", icon: "➕", unlockLevel: 8, price: 150, adsPerLevel: 1, capsStars: false, key: "q" },
  { id: "oil", icon: "🛢️", unlockLevel: 15, price: 120, adsPerLevel: 1, capsStars: false, key: "w" },
  { id: "drill", icon: "🔨", unlockLevel: 25, price: 200, adsPerLevel: 1, capsStars: true, key: "e" },
  { id: "magnet", icon: "🧲", unlockLevel: 40, price: 350, adsPerLevel: 1, adsPerDay: 5, capsStars: true, key: "r" },
];

export const ECONOMY = {
  freeUndosPerLevel: 2,
  undoPack: { amount: 5, price: 60, adsPerLevel: 2 },
  hint: { price: 80, adsPerLevel: 3, freePerDay: 1 },
  freeOnUnlock: 3,
  /** Extra Slot can be used at most this many times per level. */
  maxExtraSlots: 2,
  rewardedPerLevel: 3,
  rewardedPerDay: 20,
  interstitial: { firstLevel: 6, everyLevels: 3, minGapSec: 90 },
  coins: { base: 6, perStar: 3, difficultyEvery: 40, difficultyMax: 8, firstTryBonus: 0.25, trickyMultiplier: 2, masterpieceBonus: 100, fillerBonus: 1 },
  startCoins: 100,
  streakBonusEvery: 7,
  shopLevel: 20,
  dailyLevel: 20,
  /** Coins to restyle a decor spot with a style you don't own yet. */
  decorPrice: 250,
};

export function levelCoins(n: number, stars: number, firstTry: boolean, tag: string): number {
  const c = ECONOMY.coins;
  let coins = c.base + c.perStar * stars + Math.min(c.difficultyMax, Math.floor(n / c.difficultyEvery));
  if (firstTry) coins = Math.round(coins * (1 + c.firstTryBonus));
  if (tag === "tricky") coins *= c.trickyMultiplier;
  if (tag === "masterpiece") coins += c.masterpieceBonus;
  return coins;
}

/** Tidiness stars (DESIGN.md §4): ★★★ at par detours or fewer, ★★ up to par + 2 (or par × 1.5). */
export function starsFor(detours: number, par: number, capped: boolean): number {
  const two = Math.max(par + 2, Math.ceil(par * 1.5));
  let s = detours <= par ? 3 : detours <= two ? 2 : 1;
  if (capped) s = Math.min(2, s);
  return s;
}
