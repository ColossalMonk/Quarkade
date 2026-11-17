// Snug Bento save data (stored through forge's tamper-checked SaveSlot).

import type { PowerUpId } from "../data/economy.ts";
import { ECONOMY } from "../data/economy.ts";
import type { DailyState } from "../../../../forge/src/ui/daily.ts";
import { emptyDailyState } from "../../../../forge/src/ui/daily.ts";
import type { AdDay } from "../../../../forge/src/ui/ads.ts";

export interface SaveData {
  level: number;
  stars: Record<string, number>;
  totalStars: number;
  coins: number;
  inv: Record<PowerUpId, number>;
  gifted: Record<PowerUpId, boolean>;
  /** Current recipe card. */
  recipe: { index: number; filled: number[]; encore: boolean };
  finished: string[];
  menusDone: string[];
  encores: number;
  day: AdDay & { freeHintUsed: boolean };
  levelsSinceAd: number;
  settings: { sound: boolean; haptics: boolean; music: boolean; colorblind: boolean; lang: string };
  cosmetics: { owned: string[]; box: string; wrap: string; mat: string };
  skill: number[];
  noAds: boolean;
  reminder: boolean;
  daily: DailyState;
}

export const SAVE_VERSION = 1;

export function defaultSave(): SaveData {
  return {
    level: 1,
    stars: {},
    totalStars: 0,
    coins: ECONOMY.startCoins,
    inv: { peek: 0, chop: 0, knife: 0, tidy: 0 },
    gifted: { peek: false, chop: false, knife: false, tidy: false },
    recipe: { index: 0, filled: [], encore: false },
    finished: [],
    menusDone: [],
    encores: 0,
    day: { key: "", rewarded: 0, byItem: {}, freeHintUsed: false },
    levelsSinceAd: 0,
    settings: { sound: true, haptics: true, music: true, colorblind: false, lang: "" },
    cosmetics: { owned: ["box_pine", "wrap_ribbon", "mat_bamboo"], box: "box_pine", wrap: "wrap_ribbon", mat: "mat_bamboo" },
    skill: [],
    noAds: false,
    reminder: false,
    daily: emptyDailyState(),
  };
}
