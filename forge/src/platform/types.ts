// The contract every portal driver implements. Games never talk to a portal SDK directly;
// they call the Platform facade (platform.ts), which calls one of these drivers.

export interface PlatformStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export type PlatformName =
  | "local"
  | "poki"
  | "crazygames"
  | "gamedistribution"
  | "gamepix"
  | "gamemonetize"
  | "playgama"
  | "youtube"
  | "app";

export interface DriverHooks {
  /** The driver calls these when the host pauses/resumes the game (ads, YouTube pause, etc.). */
  pause: () => void;
  resume: () => void;
  /** The host turned audio on or off (YouTube Playables reports this). */
  audio: (enabled: boolean) => void;
}

export interface PlatformDriver {
  readonly name: PlatformName;
  /** Whether rewarded ads exist on this platform at all. */
  readonly supportsRewarded: boolean;
  init(hooks: DriverHooks): Promise<void>;
  loadingProgress(fraction: number): void;
  loadingDone(): void;
  /** First frame is on screen (YouTube Playables needs this separately from loadingDone). */
  firstFrame(): void;
  gameplayStart(): void;
  gameplayStop(): void;
  /** Show an interstitial. Resolves when it is over or failed; never rejects. */
  interstitial(): Promise<void>;
  /** Show a rewarded ad. Resolves true only if the player earned the reward. */
  rewarded(): Promise<boolean>;
  happyTime(): void;
  storage: PlatformStorage;
  /** Language hint from the host, if any. */
  language(): string | undefined;
  /** Optional level lifecycle (Playgama reports these). */
  levelStart?(): void;
  levelComplete?(): void;
  levelFail?(): void;
  /**
   * Host rules that change how the game behaves. YouTube Playables forbids reading
   * navigator.language and listening to visibilitychange; it pauses the game itself.
   */
  readonly hostControlsVisibility?: boolean;
}
