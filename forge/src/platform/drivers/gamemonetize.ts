// GameMonetize SDK. Needs VITE_GM_GAME_ID at build time. Their SDK documents interstitials
// (showBanner) but not rewarded ads, so rewarded buttons are hidden on this platform until
// that is confirmed. Verify against their current docs before release.

import type { DriverHooks, PlatformDriver } from "../types.ts";
import { env, loadScript } from "../load-script.ts";
import { createLocalStorage } from "../../core/save.ts";

interface GmSdk {
  showBanner(): void;
}

export function createGameMonetizeDriver(): PlatformDriver {
  let hooks: DriverHooks | null = null;
  let adDone: (() => void) | null = null;
  let adStarted = false;
  const sdk = () => (window as unknown as { sdk?: GmSdk }).sdk;

  return {
    name: "gamemonetize",
    supportsRewarded: false,
    async init(h) {
      hooks = h;
      (window as unknown as Record<string, unknown>)["SDK_OPTIONS"] = {
        gameId: env("VITE_GM_GAME_ID"),
        onEvent(event: { name: string }) {
          if (event.name === "SDK_GAME_PAUSE") {
            adStarted = true;
            hooks?.pause();
          }
          if (event.name === "SDK_GAME_START") {
            hooks?.resume();
            adDone?.();
            adDone = null;
          }
        },
      };
      await loadScript("https://api.gamemonetize.com/sdk.js");
    },
    loadingProgress() {},
    loadingDone() {},
    firstFrame() {},
    gameplayStart() {},
    gameplayStop() {},
    interstitial() {
      return new Promise<void>((resolve) => {
        const s = sdk();
        if (!s) return resolve();
        adDone = resolve;
        adStarted = false;
        const giveUp = () => {
          if (adDone === resolve) {
            adDone = null;
            hooks?.resume();
            resolve();
          }
        };
        // No fill: if no SDK_GAME_PAUSE arrives within 3 s, carry on.
        setTimeout(() => !adStarted && giveUp(), 3000);
        // Safety net: never leave the game paused if the SDK never says it's done.
        setTimeout(giveUp, 45000);
        s.showBanner();
      });
    },
    async rewarded() {
      return false;
    },
    happyTime() {},
    storage: createLocalStorage(),
    language: () => undefined,
  };
}
