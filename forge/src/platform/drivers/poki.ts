// Poki SDK v2. Docs: https://developers.poki.com/guide/sdk-html5 (checked 2026-11-12).
// Rules: gameplayStart on first input; never the same event twice in a row; nothing during ads;
// pause + mute *before* commercialBreak / rewardedBreak; rewarded buttons not green, with a 🎬
// icon and an equal-or-larger "continue" button beside them (handled in the game UI).

import type { DriverHooks, PlatformDriver } from "../types.ts";
import { loadScript } from "../load-script.ts";
import { createLocalStorage } from "../../core/save.ts";

interface PokiSDKApi {
  init(): Promise<void>;
  gameLoadingFinished(): void;
  gameplayStart(): void;
  gameplayStop(): void;
  commercialBreak(onStart?: () => void): Promise<void>;
  rewardedBreak(onStart?: () => void): Promise<boolean>;
}

export function createPokiDriver(): PlatformDriver {
  let sdk: PokiSDKApi | null = null;
  let hooks: DriverHooks | null = null;
  return {
    name: "poki",
    supportsRewarded: true,
    async init(h) {
      hooks = h;
      await loadScript("https://game-cdn.poki.com/scripts/v2/poki-sdk.js");
      sdk = (window as unknown as { PokiSDK: PokiSDKApi }).PokiSDK;
      try {
        await sdk.init();
      } catch {
        // Ad blockers make init reject; the game must still run.
      }
    },
    loadingProgress() {},
    loadingDone() {
      sdk?.gameLoadingFinished();
    },
    firstFrame() {},
    gameplayStart() {
      sdk?.gameplayStart();
    },
    gameplayStop() {
      sdk?.gameplayStop();
    },
    async interstitial() {
      if (!sdk) return;
      hooks?.pause(); // pause and mute before the break, not only in the callback
      try {
        await sdk.commercialBreak();
      } catch {
        /* ignore */
      }
      hooks?.resume();
    },
    async rewarded() {
      if (!sdk) return false;
      hooks?.pause();
      try {
        return !!(await sdk.rewardedBreak());
      } catch {
        return false;
      } finally {
        hooks?.resume();
      }
    },
    happyTime() {},
    storage: createLocalStorage(), // Poki syncs localStorage to the cloud automatically
    language: () => undefined,
  };
}
