// Koi Out save data (stored through forge's tamper-checked SaveSlot).

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
  /** Current journal page (a region) and its sightings per variety. */
  journal: { page: number; filled: number[]; encore: boolean };
  pagesDone: string[];
  encores: number;
  day: AdDay & { freeHintUsed: boolean };
  levelsSinceAd: number;
  settings: { sound: boolean; haptics: boolean; music: boolean; colorblind: boolean; lang: string };
  cosmetics: { owned: string[]; theme: string; trail: string; pads: string };
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
    inv: { glow: 0, lotus: 0, net: 0, bread: 0 },
    gifted: { glow: false, lotus: false, net: false, bread: false },
    journal: { page: 0, filled: [], encore: false },
    pagesDone: [],
    encores: 0,
    day: { key: "", rewarded: 0, byItem: {}, freeHintUsed: false },
    levelsSinceAd: 0,
    settings: { sound: true, haptics: true, music: true, colorblind: false, lang: "" },
    cosmetics: { owned: ["theme_garden", "trail_plain", "pads_green"], theme: "theme_garden", trail: "trail_plain", pads: "pads_green" },
    skill: [],
    noAds: false,
    reminder: false,
    daily: emptyDailyState(),
  };
}
