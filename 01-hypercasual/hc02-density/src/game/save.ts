// Density save data.

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
  /** Current Density Tower. */
  tower: { index: number; pours: number[]; encore: boolean };
  finished: string[];
  collectionsDone: string[];
  encores: number;
  day: AdDay & { freeHintUsed: boolean };
  levelsSinceAd: number;
  settings: { sound: boolean; haptics: boolean; music: boolean; colorblind: boolean; lang: string };
  cosmetics: { owned: string[]; glass: string; bench: string; pour: string };
  skill: number[];
  noAds: boolean;
  /** App only: opt-in Daily Brew reminder. */
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
    inv: { spare: 0, lamp: 0, pipette: 0, centrifuge: 0 },
    gifted: { spare: false, lamp: false, pipette: false, centrifuge: false },
    tower: { index: 0, pours: [], encore: false },
    finished: [],
    collectionsDone: [],
    encores: 0,
    day: { key: "", rewarded: 0, byItem: {}, freeHintUsed: false },
    levelsSinceAd: 0,
    settings: { sound: true, haptics: true, music: true, colorblind: false, lang: "" },
    cosmetics: { owned: ["glass_tube", "bench_wood", "pour_plain"], glass: "glass_tube", bench: "bench_wood", pour: "pour_plain" },
    skill: [],
    noAds: false,
    reminder: false,
    daily: emptyDailyState(),
  };
}
