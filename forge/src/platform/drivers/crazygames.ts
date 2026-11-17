// CrazyGames SDK v3. Docs: https://docs.crazygames.com/sdk/intro/ (checked 2026-11-12).
// Rules: muteAudio setting must be honoured (it overrides in-game audio); the game must work
// with an ad blocker; tick "Progress Save" at submission so SDK.data is enabled (1 MB limit);
// a midgame requested inside the ~3 min cooldown returns an "adCooldown" error.

import type { DriverHooks, PlatformDriver, PlatformStorage } from "../types.ts";
import { loadScript } from "../load-script.ts";
import { createLocalStorage } from "../../core/save.ts";

interface AdCallbacks {
  adStarted?: () => void;
  adFinished?: () => void;
  adError?: (err: unknown) => void;
}

interface CrazySDK {
  init(): Promise<void>;
  environment?: string;
  game: {
    loadingStart(): void;
    loadingStop(): void;
    gameplayStart(): void;
    gameplayStop(): void;
    happytime(): void;
    settings?: { muteAudio?: boolean };
    addSettingsChangeListener?(fn: (s: { muteAudio?: boolean }) => void): void;
  };
  ad: { requestAd(type: "midgame" | "rewarded", cb: AdCallbacks): void; hasAdblock?(): Promise<boolean> };
  data?: { getItem(key: string): string | null; setItem(key: string, value: string): void };
  user?: { systemInfo?: { countryCode?: string; locale?: string } };
}

export function createCrazyGamesDriver(): PlatformDriver {
  let sdk: CrazySDK | null = null;
  let hooks: DriverHooks | null = null;
  let adblock = false;
  const fallback = createLocalStorage();

  const storage: PlatformStorage = {
    async getItem(key) {
      if (sdk?.data) return sdk.data.getItem(key);
      return fallback.getItem(key);
    },
    async setItem(key, value) {
      if (sdk?.data) sdk.data.setItem(key, value);
      else await fallback.setItem(key, value);
    },
  };

  function ad(type: "midgame" | "rewarded"): Promise<boolean> {
    return new Promise((resolve) => {
      if (!sdk) return resolve(false);
      sdk.ad.requestAd(type, {
        adStarted: () => hooks?.pause(),
        adFinished: () => {
          hooks?.resume();
          resolve(true);
        },
        adError: () => {
          hooks?.resume();
          resolve(false);
        },
      });
    });
  }

  return {
    name: "crazygames",
    get supportsRewarded() {
      return !adblock;
    },
    async init(h) {
      hooks = h;
      await loadScript("https://sdk.crazygames.com/crazygames-sdk-v3.js");
      sdk = (window as unknown as { CrazyGames: { SDK: CrazySDK } }).CrazyGames.SDK;
      await sdk.init();
      sdk.game.loadingStart();
      // The site's mute switch overrides the game's own sound setting.
      const mute = sdk.game.settings?.muteAudio;
      if (mute !== undefined) h.audio(!mute);
      sdk.game.addSettingsChangeListener?.((s) => {
        if (s.muteAudio !== undefined) h.audio(!s.muteAudio);
      });
      try {
        adblock = (await sdk.ad.hasAdblock?.()) ?? false;
      } catch {
        adblock = false;
      }
    },
    loadingProgress() {},
    loadingDone() {
      sdk?.game.loadingStop();
    },
    firstFrame() {},
    gameplayStart() {
      sdk?.game.gameplayStart();
    },
    gameplayStop() {
      sdk?.game.gameplayStop();
    },
    async interstitial() {
      await ad("midgame");
    },
    rewarded() {
      return ad("rewarded");
    },
    happyTime() {
      sdk?.game.happytime();
    },
    storage,
    language: () => sdk?.user?.systemInfo?.locale,
  };
}
