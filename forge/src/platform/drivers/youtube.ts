// YouTube Playables SDK. Docs: https://developers.google.com/youtube/gaming/playables (checked 2026-11-12).
// Rules: firstFrameReady() then gameReady(); after onPause stop ALL work; don't use the Page
// Visibility API or navigator.language (use getLanguage()); YouTube's mute overrides the game's;
// saveData only after loadData succeeded, under 3 MiB; ads must be enabled in the Developer Portal.

import type { DriverHooks, PlatformDriver, PlatformStorage } from "../types.ts";
import { loadScript } from "../load-script.ts";

interface YtGame {
  game: {
    firstFrameReady(): void;
    gameReady(): void;
    saveData(data: string): Promise<void>;
    loadData(): Promise<string>;
  };
  system: {
    onPause(cb: () => void): void;
    onResume(cb: () => void): void;
    isAudioEnabled(): boolean;
    onAudioEnabledChange(cb: (enabled: boolean) => void): void;
    getLanguage?(): Promise<string>;
  };
  ads?: { requestInterstitialAd?(): Promise<void>; requestRewardedAd?(rewardId: string): Promise<boolean> };
}

export function createYouTubeDriver(): PlatformDriver {
  let yt: YtGame | null = null;
  let blob: Record<string, string> = {};
  let loaded = false; // saveData is refused until loadData has succeeded
  let lang: string | undefined;

  // Playables stores one string per game, so every key lives inside a single JSON blob.
  // Writes made in the same tick (a save and its backup copy) share one saveData upload.
  let pending: Promise<void> | null = null;
  const storage: PlatformStorage = {
    async getItem(key) {
      return blob[key] ?? null;
    },
    async setItem(key, value) {
      blob[key] = value;
      if (!loaded) return;
      if (!pending) {
        pending = Promise.resolve().then(() => {
          pending = null;
          return yt?.game.saveData(JSON.stringify(blob));
        });
      }
      await pending;
    },
  };

  return {
    name: "youtube",
    hostControlsVisibility: true,
    get supportsRewarded() {
      return typeof yt?.ads?.requestRewardedAd === "function";
    },
    async init(hooks: DriverHooks) {
      await loadScript("https://www.youtube.com/game_api/v1");
      yt = (window as unknown as { ytgame: YtGame }).ytgame;
      yt.system.onPause(() => {
        hooks.pause();
        if (loaded) void yt?.game.saveData(JSON.stringify(blob)).catch(() => {});
      });
      yt.system.onResume(() => hooks.resume());
      hooks.audio(yt.system.isAudioEnabled());
      yt.system.onAudioEnabledChange((on) => hooks.audio(on));
      try {
        const raw = await yt.game.loadData();
        blob = raw ? (JSON.parse(raw) as Record<string, string>) : {};
        loaded = true;
      } catch {
        // Don't overwrite a save we couldn't read; play on without saving this session.
        blob = {};
        loaded = false;
      }
      try {
        lang = await yt.system.getLanguage?.();
      } catch {
        lang = undefined;
      }
    },
    loadingProgress() {},
    loadingDone() {
      yt?.game.gameReady();
    },
    firstFrame() {
      yt?.game.firstFrameReady();
    },
    gameplayStart() {},
    gameplayStop() {},
    async interstitial() {
      try {
        await yt?.ads?.requestInterstitialAd?.();
      } catch {
        /* not available */
      }
    },
    async rewarded() {
      try {
        return (await yt?.ads?.requestRewardedAd?.("reward")) ?? false;
      } catch {
        return false;
      }
    },
    happyTime() {},
    storage,
    language: () => lang ?? "en",
  };
}
