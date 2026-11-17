// Every tunable number for prices, rewards and ad limits (DESIGN.md §3-4). Starts from the values
// the first four games were tuned to; re-tune with tools/simulate.ts once the packs exist.

export type PowerUpId = "brake" | "basket" | "restack" | "assistant";

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
  { id: "brake", icon: "✋", unlockLevel: 8, price: 100, adsPerLevel: 1, capsStars: false, key: "q" },
  { id: "basket", icon: "🧺", unlockLevel: 15, price: 150, adsPerLevel: 1, capsStars: false, key: "w" },
  { id: "restack", icon: "🔀", unlockLevel: 25, price: 200, adsPerLevel: 1, capsStars: true, key: "e" },
  { id: "assistant", icon: "🧑‍💼", unlockLevel: 40, price: 300, adsPerLevel: 1, adsPerDay: 5, capsStars: true, key: "r" },
];

/** Moves the stand stays still after Brake. */
export const BRAKE_MOVES = 5;

export const ECONOMY = {
  hint: { price: 80, adsPerLevel: 3, freePerDay: 1 },
  freeOnUnlock: 3,
  rewardedPerLevel: 3,
  rewardedPerDay: 20,
  interstitial: { firstLevel: 6, everyLevels: 3, minGapSec: 90 },
  coins: { base: 6, perStar: 3, difficultyEvery: 40, difficultyMax: 8, firstTryBonus: 0.25, trickyMultiplier: 2, grandBonus: 100 },
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
  if (tag === "grand") coins += c.grandBonus;
  return coins;
}

/** The ★★ limit: par + 3, or par + 15% on long levels. */
export function twoStarLimit(par: number): number {
  return par + Math.max(3, Math.round(par * 0.15));
}

/** Stars (DESIGN.md §4): ★★★ at par or better, ★★ up to twoStarLimit, ★ for finishing. */
export function starsFor(moves: number, par: number, capped: boolean): number {
  let s = moves <= par ? 3 : moves <= twoStarLimit(par) ? 2 : 1;
  if (capped) s = Math.min(2, s);
  return s;
}
