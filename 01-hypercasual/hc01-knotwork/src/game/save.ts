// Knotwork save data (DESIGN.md §6: level number, stars, coins, quilt progress, albums, streak).

import type { PowerUpId } from "../data/economy.ts";
import { ECONOMY } from "../data/economy.ts";

export interface SaveData {
  level: number;
  stars: Record<string, number>;
  totalStars: number;
  coins: number;
  inv: Record<PowerUpId, number>;
  gifted: Record<PowerUpId, boolean>;
  /** Current quilt: index into ALL_PICTURES; encore = re-knitting a finished picture. */
  quilt: { pic: number; cells: string; encore?: boolean };
  finished: string[];
  /** Albums whose completion reward has been given. */
  albumsDone: string[];
  /** Encore quilts finished (cycles through finished pictures). */
  encores: number;
  /** Per-day counters: rewarded ads (overall and per item) and the free daily hint. */
  day: { key: string; rewarded: number; byItem: Record<string, number>; freeHintUsed: boolean };
  levelsSinceAd: number;
  settings: { sound: boolean; haptics: boolean; music: boolean; colorblind: boolean; lang: string };
  cosmetics: { owned: string[]; yarn: string; needle: string; board: string };
  /** moves / par for the last 10 levels won, used to help players who are struggling. */
  skill: number[];
  /** App only: "Remove ads" bought (interstitials off; rewarded ads stay available). */
  noAds: boolean;
  /** App only: opt-in daily reminder. */
  reminder: boolean;
  /** Daily Swatch: results by UTC day, streak, and the day the ad retry was used. */
  swatch: {
    results: Record<string, { moves: number; par: number; stars: number }>;
    lastWin: string;
    streak: number;
    bestStreak: number;
    retryDay: string;
  };
}

export const SAVE_VERSION = 1;

export function defaultSave(): SaveData {
  return {
    level: 1,
    stars: {},
    totalStars: 0,
    coins: ECONOMY.startCoins,
    inv: { spare: 0, lantern: 0, snip: 0, swift: 0 },
    gifted: { spare: false, lantern: false, snip: false, swift: false },
    quilt: { pic: 0, cells: "0".repeat(64) },
    finished: [],
    albumsDone: [],
    encores: 0,
    day: { key: "", rewarded: 0, byItem: {}, freeHintUsed: false },
    levelsSinceAd: 0,
    settings: { sound: true, haptics: true, music: true, colorblind: false, lang: "" },
    cosmetics: { owned: ["yarn_chunky", "needle_wood", "board_oak"], yarn: "yarn_chunky", needle: "needle_wood", board: "board_oak" },
    skill: [],
    noAds: false,
    reminder: false,
    swatch: { results: {}, lastWin: "", streak: 0, bestStreak: 0, retryDay: "" },
  };
}
