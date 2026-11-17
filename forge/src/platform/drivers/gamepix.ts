// GamePix SDK v3. Docs: https://partners.gamepix.com/sdk/doc/javascript (checked 2026-11-12).
// Rules: set GamePixConfig = { lifecycle: 'manual' } BEFORE the script loads, otherwise the SDK
// reports loading/start itself and our calls do nothing; pause/resume handlers are mandatory
// (pause must mute, both must tolerate repeats); plain localStorage is synced if the SDK loads
// before any save is read (forge loads the SDK before the game reads its save).

import type { DriverHooks, PlatformDriver } from "../types.ts";
import { loadScript } from "../load-script.ts";
import { createLocalStorage } from "../../core/save.ts";

interface AdResult {
  success: boolean;
  message?: string;
}

interface GamePixApi {
  lifecycle?: { loading(pct: number): void; loaded(): Promise<void> | void; gameStart?(): void };
  ads?: { interstitial(): Promise<AdResult>; reward(): Promise<AdResult> };
  events?: { on(name: "pause" | "resume", fn: () => void): void };
  // Legacy names, still supported.
  loading?(pct: number): void;
  loaded?(): Promise<void> | void;
  interstitialAd?(): Promise<AdResult>;
  rewardAd?(): Promise<AdResult>;
  happyMoment?(type?: string): void;
  pause?: () => void;
  resume?: () => void;
  lang?(): string;
}

export function createGamePixDriver(): PlatformDriver {
  let hooks: DriverHooks | null = null;
  let started = false;
  const gp = () => (window as unknown as { GamePix?: GamePixApi }).GamePix;

  return {
    name: "gamepix",
    supportsRewarded: true,
    async init(h) {
      hooks = h;
      (window as unknown as Record<string, unknown>)["GamePixConfig"] = { lifecycle: "manual" };
      await loadScript("https://integration.gamepix.com/sdk/v3/gamepix.sdk.js");
      const api = gp();
      if (api?.events) {
        api.events.on("pause", () => hooks?.pause());
        api.events.on("resume", () => hooks?.resume());
      } else if (api) {
        api.pause = () => hooks?.pause();
        api.resume = () => hooks?.resume();
      }
    },
    loadingProgress(f) {
      const api = gp();
      const pct = Math.round(f * 100);
      if (api?.lifecycle) api.lifecycle.loading(pct);
      else api?.loading?.(pct);
    },
    loadingDone() {
      const api = gp();
      void (api?.lifecycle ? api.lifecycle.loaded() : api?.loaded?.());
    },
    firstFrame() {},
    gameplayStart() {
      if (started) return;
      started = true;
      gp()?.lifecycle?.gameStart?.();
    },
    gameplayStop() {},
    async interstitial() {
      const api = gp();
      try {
        await (api?.ads ? api.ads.interstitial() : api?.interstitialAd?.());
      } catch {
        /* no fill */
      }
    },
    async rewarded() {
      const api = gp();
      try {
        const res = await (api?.ads ? api.ads.reward() : api?.rewardAd?.());
        return !!res?.success;
      } catch {
        return false;
      }
    },
    happyTime() {
      gp()?.happyMoment?.();
    },
    storage: createLocalStorage(),
    language: () => gp()?.lang?.(),
  };
}
