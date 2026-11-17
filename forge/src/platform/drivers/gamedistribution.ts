// GameDistribution HTML5 SDK. Docs: https://github.com/GameDistribution/GD-HTML5/wiki (checked 2026-11-12).
// Needs VITE_GD_GAME_ID at build time and rewarded ads switched on in the GD dashboard.
// Grant rewards only on SDK_REWARDED_WATCH_COMPLETE (it can arrive just after showAd resolves).
// SDK_GAME_PAUSE = pause + mute (background audio is forbidden); SDK_GAME_START = resume.

import type { DriverHooks, PlatformDriver } from "../types.ts";
import { env, loadScript } from "../load-script.ts";
import { createLocalStorage } from "../../core/save.ts";

interface GdSdk {
  showAd(type?: string): Promise<void>;
  preloadAd?(type: string): Promise<void>;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function createGameDistributionDriver(): PlatformDriver {
  let hooks: DriverHooks | null = null;
  let rewardGranted = false;
  let pausedByAd = false;
  const sdk = () => (window as unknown as { gdsdk?: GdSdk }).gdsdk;

  return {
    name: "gamedistribution",
    supportsRewarded: true,
    async init(h) {
      hooks = h;
      (window as unknown as Record<string, unknown>)["GD_OPTIONS"] = {
        gameId: env("VITE_GD_GAME_ID"),
        onEvent(event: { name: string }) {
          switch (event.name) {
            case "SDK_GAME_PAUSE":
              pausedByAd = true;
              hooks?.pause();
              break;
            case "SDK_GAME_START":
              // Also fires once at startup: only resume if an ad paused us.
              if (pausedByAd) {
                pausedByAd = false;
                hooks?.resume();
              }
              break;
            case "SDK_REWARDED_WATCH_COMPLETE":
              rewardGranted = true;
              break;
          }
        },
      };
      await loadScript("https://html5.api.gamedistribution.com/main.min.js");
    },
    loadingProgress() {},
    loadingDone() {},
    firstFrame() {},
    gameplayStart() {},
    gameplayStop() {},
    async interstitial() {
      try {
        await sdk()?.showAd();
      } catch {
        /* no fill */
      }
      if (pausedByAd) {
        pausedByAd = false;
        hooks?.resume();
      }
    },
    async rewarded() {
      const s = sdk();
      if (!s) return false;
      rewardGranted = false;
      try {
        await s.preloadAd?.("rewarded");
        await s.showAd("rewarded");
      } catch {
        /* no fill */
      }
      // The completion event can land a moment after showAd resolves.
      for (let i = 0; i < 10 && !rewardGranted; i++) await wait(100);
      if (pausedByAd) {
        pausedByAd = false;
        hooks?.resume();
      }
      return rewardGranted;
    },
    happyTime() {},
    storage: createLocalStorage(),
    language: () => undefined,
  };
}
