// Every tunable number for prices, rewards and ad limits (DESIGN.md §3 and §4).
// Change balance here, not in game code.

export type PowerUpId = "spare" | "lantern" | "snip" | "swift";

export interface PowerUpInfo {
  id: PowerUpId;
  icon: string;
  unlockLevel: number;
  price: number;
  adsPerLevel: number;
  adsPerDay?: number;
  capsStars: boolean;
  key: string; // desktop shortcut
}

export const POWER_UPS: PowerUpInfo[] = [
  { id: "spare", icon: "🪡", unlockLevel: 8, price: 150, adsPerLevel: 1, capsStars: false, key: "q" },
  { id: "lantern", icon: "🏮", unlockLevel: 15, price: 120, adsPerLevel: 1, capsStars: false, key: "w" },
  { id: "snip", icon: "✂️", unlockLevel: 25, price: 200, adsPerLevel: 1, capsStars: true, key: "e" },
  { id: "swift", icon: "🧶", unlockLevel: 40, price: 350, adsPerLevel: 1, adsPerDay: 5, capsStars: true, key: "r" },
];

export const ECONOMY = {
  freeUndosPerLevel: 2,
  undoPack: { amount: 5, price: 60, adsPerLevel: 2 },
  hint: { price: 80, adsPerLevel: 3, freePerDay: 1 },
  freeOnUnlock: 3,
  rewardedPerLevel: 3,
  rewardedPerDay: 20,
  interstitial: { firstLevel: 6, everyLevels: 3, minGapSec: 90 },
  // Tuned with tools/simulate.ts (2026-11-12): an average player earns ~30 coins a level, so a
  // power-up costs ~6-8 levels of coins (the design asks for 5-12) and ads stay the shortcut.
  coins: {
    base: 6,
    perStar: 3,
    difficultyEvery: 40,
    difficultyMax: 8,
    firstTryBonus: 0.25,
    trickyMultiplier: 2,
    masterpieceBonus: 100,
    /** Finishing a colour that isn't in the quilt picture. */
    fillerBonus: 1,
  },
  stars: { threeAtPar: 1, twoAtPar: 1.4 },
  startCoins: 100,
  streakSwiftEvery: 7,
};

export function levelCoins(n: number, stars: number, firstTry: boolean, tag: string): number {
  const c = ECONOMY.coins;
  let coins = c.base + c.perStar * stars + Math.min(c.difficultyMax, Math.floor(n / c.difficultyEvery));
  if (firstTry) coins = Math.round(coins * (1 + c.firstTryBonus));
  if (tag === "tricky") coins *= c.trickyMultiplier;
  if (tag === "masterpiece") coins += c.masterpieceBonus;
  return coins;
}

export function starsFor(moves: number, par: number, capped: boolean): number {
  let s = moves <= par * ECONOMY.stars.threeAtPar ? 3 : moves <= Math.ceil(par * ECONOMY.stars.twoAtPar) ? 2 : 1;
  if (capped) s = Math.min(2, s);
  return s;
}
