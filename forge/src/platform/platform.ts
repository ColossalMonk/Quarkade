// The one object games use for everything portal-related: loading events, gameplay events,
// ads, saves, pause/mute. The driver is chosen at build time with VITE_PLATFORM, and unused
// drivers are removed from the bundle.

import type { PlatformDriver, PlatformName } from "./types.ts";
import { Emitter } from "../core/emitter.ts";
import { createLocalStorage } from "../core/save.ts";
import { createLocalDriver } from "./drivers/local.ts";
import { createPokiDriver } from "./drivers/poki.ts";
import { createCrazyGamesDriver } from "./drivers/crazygames.ts";
import { createGameDistributionDriver } from "./drivers/gamedistribution.ts";
import { createGamePixDriver } from "./drivers/gamepix.ts";
import { createGameMonetizeDriver } from "./drivers/gamemonetize.ts";
import { createPlaygamaDriver } from "./drivers/playgama.ts";
import { createYouTubeDriver } from "./drivers/youtube.ts";

export type PlatformEvents = {
  /** Pause gameplay and audio (ad running, tab hidden, host paused). */
  pause: { reason: string };
  resume: { reason: string };
  /** Host audio setting changed (YouTube Playables). */
  hostAudio: { enabled: boolean };
};

const PLATFORM = (import.meta.env.VITE_PLATFORM ?? "local") as PlatformName;

function pickDriver(): PlatformDriver {
  // Each comparison is a constant after Vite replaces VITE_PLATFORM, so only one driver ships.
  if (PLATFORM === "poki") return createPokiDriver();
  if (PLATFORM === "crazygames") return createCrazyGamesDriver();
  if (PLATFORM === "gamedistribution") return createGameDistributionDriver();
  if (PLATFORM === "gamepix") return createGamePixDriver();
  if (PLATFORM === "gamemonetize") return createGameMonetizeDriver();
  if (PLATFORM === "playgama") return createPlaygamaDriver();
  if (PLATFORM === "youtube") return createYouTubeDriver();
  return createLocalDriver();
}

/** Used when a portal SDK fails to load (ad blocker, offline): the game still runs, without ads. */
function createOfflineDriver(name: PlatformName): PlatformDriver {
  return {
    name,
    supportsRewarded: false,
    async init() {},
    loadingProgress() {},
    loadingDone() {},
    firstFrame() {},
    gameplayStart() {},
    gameplayStop() {},
    async interstitial() {},
    async rewarded() {
      return false;
    },
    happyTime() {},
    storage: createLocalStorage(),
    language: () => undefined,
  };
}

export class Platform extends Emitter<PlatformEvents> {
  driver: PlatformDriver;
  private adRunning = false;
  private lastAdAt = 0;
  private inGameplay = false;
  private pauseReasons = new Set<string>();

  constructor() {
    super();
    this.driver = pickDriver();
  }

  get name(): PlatformName {
    return this.driver.name;
  }

  get rewardedAvailable(): boolean {
    return this.driver.supportsRewarded;
  }

  get storage() {
    return this.driver.storage;
  }

  async init(): Promise<void> {
    const hooks = {
      pause: () => this.addPause("host"),
      resume: () => this.removePause("host"),
      audio: (enabled: boolean) => this.emit("hostAudio", { enabled }),
    };
    // The phone app driver is loaded on demand so web builds never include Capacitor.
    if (PLATFORM === "app") {
      const { createAppDriver } = await import("./drivers/app.ts");
      this.driver = createAppDriver();
    }
    try {
      await this.driver.init(hooks);
    } catch (err) {
      console.warn(`[forge/platform] ${this.driver.name} SDK unavailable, running without ads`, err);
      this.driver = createOfflineDriver(this.driver.name);
      await this.driver.init(hooks);
    }
    // YouTube Playables forbids the Page Visibility API and pauses the game itself.
    if (!this.driver.hostControlsVisibility) {
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) this.addPause("hidden");
        else this.removePause("hidden");
      });
    }
  }

  /** The host decides pausing and language (YouTube Playables). */
  get hostControlsVisibility(): boolean {
    return !!this.driver.hostControlsVisibility;
  }

  levelStart(): void {
    this.driver.levelStart?.();
  }

  levelComplete(): void {
    this.driver.levelComplete?.();
  }

  levelFail(): void {
    this.driver.levelFail?.();
  }

  private addPause(reason: string): void {
    const wasPaused = this.pauseReasons.size > 0;
    this.pauseReasons.add(reason);
    if (!wasPaused) this.emit("pause", { reason });
  }

  private removePause(reason: string): void {
    if (!this.pauseReasons.delete(reason)) return;
    if (this.pauseReasons.size === 0) this.emit("resume", { reason });
  }

  get paused(): boolean {
    return this.pauseReasons.size > 0;
  }

  loadingProgress(f: number): void {
    this.driver.loadingProgress(f);
  }

  loadingDone(): void {
    this.driver.loadingDone();
  }

  firstFrame(): void {
    this.driver.firstFrame();
  }

  gameplayStart(): void {
    if (this.inGameplay) return;
    this.inGameplay = true;
    this.driver.gameplayStart();
  }

  gameplayStop(): void {
    if (!this.inGameplay) return;
    this.inGameplay = false;
    this.driver.gameplayStop();
  }

  happyTime(): void {
    this.driver.happyTime();
  }

  /** Seconds since any ad finished. */
  get secondsSinceAd(): number {
    return this.lastAdAt === 0 ? Infinity : (performance.now() - this.lastAdAt) / 1000;
  }

  /**
   * Show an interstitial if at least `minGapSec` has passed since the last ad of any kind.
   * Returns whether an ad was attempted. Always stops gameplay first.
   */
  async interstitial(minGapSec = 90): Promise<boolean> {
    if (this.adRunning || this.secondsSinceAd < minGapSec) return false;
    this.gameplayStop();
    this.adRunning = true;
    this.addPause("ad");
    try {
      await this.driver.interstitial();
    } finally {
      this.adRunning = false;
      this.lastAdAt = performance.now();
      this.removePause("ad");
    }
    return true;
  }

  /** Show a rewarded ad. Resolves true only if the reward was earned. */
  async rewarded(): Promise<boolean> {
    if (this.adRunning || !this.driver.supportsRewarded) return false;
    this.gameplayStop();
    this.adRunning = true;
    this.addPause("ad");
    try {
      return await this.driver.rewarded();
    } catch {
      return false;
    } finally {
      this.adRunning = false;
      this.lastAdAt = performance.now();
      this.removePause("ad");
    }
  }

  language(): string | undefined {
    return this.driver.language();
  }
}
