// Every tunable number for prices, rewards and ad limits (DESIGN.md §3-4). Starts from the values
// Knotwork and Density were tuned to; re-tune with tools/simulate.ts once the packs exist.

export type PowerUpId = "peek" | "chop" | "knife" | "tidy";

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
  { id: "peek", icon: "👀", unlockLevel: 8, price: 100, adsPerLevel: 1, capsStars: false, key: "q" },
  { id: "chop", icon: "🥢", unlockLevel: 15, price: 150, adsPerLevel: 1, capsStars: true, key: "w" },
  { id: "knife", icon: "🔪", unlockLevel: 25, price: 200, adsPerLevel: 1, capsStars: true, key: "e" },
  { id: "tidy", icon: "🧹", unlockLevel: 40, price: 300, adsPerLevel: 1, adsPerDay: 5, capsStars: true, key: "r" },
];

export const ECONOMY = {
  freeUndosPerLevel: 2,
  undoPack: { amount: 5, price: 60, adsPerLevel: 2 },
  hint: { price: 80, adsPerLevel: 3, freePerDay: 1 },
  freeOnUnlock: 3,
  rewardedPerLevel: 3,
  rewardedPerDay: 20,
  interstitial: { firstLevel: 6, everyLevels: 3, minGapSec: 90 },
  coins: { base: 6, perStar: 3, difficultyEvery: 40, difficultyMax: 8, firstTryBonus: 0.25, trickyMultiplier: 2, masterpieceBonus: 100, fillerBonus: 0 },
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
  if (tag === "masterpiece") coins += c.masterpieceBonus;
  return coins;
}

/** Stars (DESIGN.md §4): ★★★ placing each piece once (par), ★★ up to par + 3. */
export function starsFor(placements: number, par: number, capped: boolean): number {
  const two = par + 3;
  let s = placements <= par ? 3 : placements <= two ? 2 : 1;
  if (capped) s = Math.min(2, s);
  return s;
}
