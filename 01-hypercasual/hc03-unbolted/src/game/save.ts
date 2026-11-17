// Unbolted save data (stored through forge's tamper-checked SaveSlot).

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
  /** Current gadget. */
  gadget: { index: number; filled: number[]; encore: boolean };
  finished: string[];
  roomsDone: string[];
  encores: number;
  /** Placed decor: room id -> spot -> style. */
  decor: Record<string, Record<string, number>>;
  /** Decor styles owned (`${spot}_${style}`), usable in any room. */
  decorOwned: string[];
  /** Decor Crates waiting to be opened. */
  crates: number;
  day: AdDay & { freeHintUsed: boolean };
  levelsSinceAd: number;
  settings: { sound: boolean; haptics: boolean; music: boolean; colorblind: boolean; lang: string };
  cosmetics: { owned: string[]; driver: string; finish: string; board: string };
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
    inv: { slot: 0, oil: 0, drill: 0, magnet: 0 },
    gifted: { slot: false, oil: false, drill: false, magnet: false },
    gadget: { index: 0, filled: [], encore: false },
    finished: [],
    roomsDone: [],
    encores: 0,
    decor: {},
    decorOwned: [],
    crates: 0,
    day: { key: "", rewarded: 0, byItem: {}, freeHintUsed: false },
    levelsSinceAd: 0,
    settings: { sound: true, haptics: true, music: true, colorblind: false, lang: "" },
    cosmetics: { owned: ["driver_classic", "finish_steel", "board_garage"], driver: "driver_classic", finish: "finish_steel", board: "board_garage" },
    skill: [],
    noAds: false,
    reminder: false,
    daily: emptyDailyState(),
  };
}
