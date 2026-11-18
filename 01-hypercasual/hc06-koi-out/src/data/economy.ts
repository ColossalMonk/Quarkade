// Every tunable number for prices, rewards and ad limits (DESIGN.md §3-4).

export type PowerUpId = "glow" | "lotus" | "net" | "bread";

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
  { id: "glow", icon: "✨", unlockLevel: 8, price: 100, adsPerLevel: 1, capsStars: false, key: "q" },
  { id: "lotus", icon: "🪷", unlockLevel: 15, price: 150, adsPerLevel: 1, capsStars: false, key: "w" },
  { id: "net", icon: "🥅", unlockLevel: 25, price: 200, adsPerLevel: 1, capsStars: true, key: "e" },
  { id: "bread", icon: "🍞", unlockLevel: 40, price: 300, adsPerLevel: 1, adsPerDay: 5, capsStars: true, key: "r" },
];

export const ECONOMY = {
  hint: { price: 80, adsPerLevel: 3, freePerDay: 1 },
  freeOnUnlock: 3,
  rewardedPerLevel: 3,
  rewardedPerDay: 20,
  /** "+1 heart" ads when out of hearts, per level (not counted in rewardedPerLevel). */
  heartAdsPerLevel: 2,
  interstitial: { firstLevel: 6, everyLevels: 3, minGapSec: 90 },
  coins: { base: 6, perStar: 3, difficultyEvery: 40, difficultyMax: 8, firstTryBonus: 0.25, trickyMultiplier: 2, dragonBonus: 100 },
  startCoins: 100,
  streakBonusEvery: 7,
  shopLevel: 20,
  dailyLevel: 20,
};

export function levelCoins(n: number, stars: number, firstTry: boolean, tag: string): number {
  const c = ECONOMY.coins;
  let coins = c.base + c.perStar * stars + Math.min(c.difficultyMax, Math.floor(n / c.difficultyEvery));
  if (firstTry) coins = Math.round(coins * (1 + c.firstTryBonus));
  if (tag === "tricky") coins *= c.trickyMultiplier;
  if (tag === "dragon") coins += c.dragonBonus;
  return coins;
}

/** Stars by hearts kept (DESIGN.md §4): Lotus hearts are a cushion on top of the three. */
export function starsFor(heartsLost: number, lotus: number, capped: boolean): number {
  const lost = Math.max(0, heartsLost - lotus);
  let s = Math.max(1, 3 - lost);
  if (capped) s = Math.min(2, s);
  return s;
}
