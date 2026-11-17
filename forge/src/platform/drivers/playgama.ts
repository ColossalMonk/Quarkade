// Playgama Bridge v2. Docs: https://wiki.playgama.com/playgama/bridge-sdk (checked 2026-11-12).
// Needs playgama-bridge-config.json next to index.html (forge/tools/build-all.ts writes it).
// Rules: hide rewarded when isRewardedSupported is false; honour pause and audio state events;
// grant rewards on the "rewarded" state whatever order it arrives in relative to "closed";
// game messages are level_* (gameplay_started/stopped don't exist).

import type { DriverHooks, PlatformDriver, PlatformStorage } from "../types.ts";
import { loadScript } from "../load-script.ts";
import { createLocalStorage } from "../../core/save.ts";

interface Bridge {
  initialize(): Promise<void>;
  platform: {
    sendMessage(msg: string): void;
    language?: string;
    isAudioEnabled?: boolean;
    on?(event: string, cb: (value: boolean) => void): void;
  };
  advertisement: {
    showInterstitial(placement?: string): void;
    showRewarded(placement?: string): void;
    isRewardedSupported?: boolean;
    on(event: string, cb: (state: string) => void): void;
  };
  storage: { get(keys: string[]): Promise<unknown[]>; set(keys: string[], values: unknown[]): Promise<void> };
  EVENT_NAME?: Record<string, string>;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function createPlaygamaDriver(): PlatformDriver {
  let bridge: Bridge | null = null;
  let hooks: DriverHooks | null = null;
  let interstitialWaiter: (() => void) | null = null;
  let rewardedWaiter: (() => void) | null = null;
  let rewardEarned = false;
  let inLevel = false;
  let levelPaused = false;
  const fallback = createLocalStorage();

  const storage: PlatformStorage = {
    async getItem(key) {
      if (!bridge) return fallback.getItem(key);
      const [v] = await bridge.storage.get([key]);
      return typeof v === "string" ? v : v == null ? null : JSON.stringify(v);
    },
    async setItem(key, value) {
      if (!bridge) return fallback.setItem(key, value);
      await bridge.storage.set([key], [value]);
    },
  };

  return {
    name: "playgama",
    get supportsRewarded() {
      return bridge?.advertisement.isRewardedSupported ?? false;
    },
    async init(h) {
      hooks = h;
      await loadScript("https://bridge.playgama.com/v2/stable/playgama-bridge.js");
      bridge = (window as unknown as { bridge: Bridge }).bridge;
      await bridge.initialize();
      const ev = bridge.EVENT_NAME ?? {};
      if (bridge.platform.isAudioEnabled !== undefined) h.audio(bridge.platform.isAudioEnabled);
      bridge.platform.on?.(ev.AUDIO_STATE_CHANGED ?? "audio_state_changed", (on) => h.audio(on));
      bridge.platform.on?.(ev.PAUSE_STATE_CHANGED ?? "pause_state_changed", (paused) => (paused ? h.pause() : h.resume()));
      bridge.advertisement.on(ev.INTERSTITIAL_STATE_CHANGED ?? "interstitial_state_changed", (state) => {
        if (state === "opened") hooks?.pause();
        if (state === "closed" || state === "failed") {
          hooks?.resume();
          interstitialWaiter?.();
          interstitialWaiter = null;
        }
      });
      bridge.advertisement.on(ev.REWARDED_STATE_CHANGED ?? "rewarded_state_changed", (state) => {
        if (state === "opened") hooks?.pause();
        if (state === "rewarded") rewardEarned = true;
        if (state === "closed" || state === "failed") {
          hooks?.resume();
          rewardedWaiter?.();
          rewardedWaiter = null;
        }
      });
    },
    loadingProgress() {},
    loadingDone() {},
    firstFrame() {
      bridge?.platform.sendMessage("game_ready");
    },
    levelStart() {
      inLevel = true;
      levelPaused = false;
      bridge?.platform.sendMessage("level_started");
    },
    levelComplete() {
      if (inLevel) bridge?.platform.sendMessage("level_completed");
      inLevel = false;
    },
    levelFail() {
      if (inLevel) bridge?.platform.sendMessage("level_failed");
      inLevel = false;
    },
    gameplayStart() {
      if (inLevel && levelPaused) {
        levelPaused = false;
        bridge?.platform.sendMessage("level_resumed");
      }
    },
    gameplayStop() {
      if (inLevel && !levelPaused) {
        levelPaused = true;
        bridge?.platform.sendMessage("level_paused");
      }
    },
    interstitial() {
      return new Promise<void>((resolve) => {
        if (!bridge) return resolve();
        interstitialWaiter = resolve;
        bridge.advertisement.showInterstitial("level_completed");
      });
    },
    async rewarded() {
      if (!bridge) return false;
      rewardEarned = false;
      await new Promise<void>((resolve) => {
        rewardedWaiter = resolve;
        bridge!.advertisement.showRewarded();
      });
      // "rewarded" may arrive after "closed".
      for (let i = 0; i < 5 && !rewardEarned; i++) await wait(100);
      return rewardEarned;
    },
    happyTime() {},
    storage,
    language: () => bridge?.platform.language,
  };
}

/** Written next to index.html in the Playgama build. Placement id matches showInterstitial above. */
export const PLAYGAMA_BRIDGE_CONFIG = {
  advertisement: {
    minimumDelayBetweenInterstitial: 60,
    interstitial: { placements: [{ id: "level_completed" }] },
  },
};
