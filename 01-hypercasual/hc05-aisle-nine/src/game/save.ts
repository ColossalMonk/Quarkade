// Aisle Nine save data (stored through forge's tamper-checked SaveSlot).

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
  /** Current shop display. */
  display: { index: number; filled: number[]; encore: boolean };
  finished: string[];
  shopsOpened: string[];
  encores: number;
  day: AdDay & { freeHintUsed: boolean };
  levelsSinceAd: number;
  settings: { sound: boolean; haptics: boolean; music: boolean; colorblind: boolean; lang: string };
  cosmetics: { owned: string[]; stand: string; awning: string; bag: string; theme: string };
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
    inv: { brake: 0, basket: 0, restack: 0, assistant: 0 },
    gifted: { brake: false, basket: false, restack: false, assistant: false },
    display: { index: 0, filled: [], encore: false },
    finished: [],
    shopsOpened: [],
    encores: 0,
    day: { key: "", rewarded: 0, byItem: {}, freeHintUsed: false },
    levelsSinceAd: 0,
    settings: { sound: true, haptics: true, music: true, colorblind: false, lang: "" },
    cosmetics: { owned: ["stand_pine", "awning_red", "bag_paper", "theme_grocery"], stand: "stand_pine", awning: "awning_red", bag: "bag_paper", theme: "theme_grocery" },
    skill: [],
    noAds: false,
    reminder: false,
    daily: emptyDailyState(),
  };
}
