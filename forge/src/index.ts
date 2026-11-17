// forge: the shared template every Quarkade game is built on.

export { Platform } from "./platform/platform.ts";
export type { PlatformEvents } from "./platform/platform.ts";
export type { PlatformDriver, PlatformName, PlatformStorage } from "./platform/types.ts";
export { SaveSlot, createLocalStorage } from "./core/save.ts";
export { Rng, hashString, seedOf, utcDayKey } from "./core/rng.ts";
export { Tweens, ease, lerp } from "./core/tween.ts";
export type { Ease } from "./core/tween.ts";
export { Synth, midi } from "./core/audio.ts";
export { Music, COSY_SONG } from "./core/music.ts";
export type { SongSpec } from "./core/music.ts";
export { haptic, setHapticsEnabled, setHapticsBackend } from "./core/haptics.ts";
export type { HapticKind } from "./core/haptics.ts";
export { registerStrings, detectLanguage, setLanguage, getLanguage, t } from "./core/i18n.ts";
export { Emitter } from "./core/emitter.ts";
export { Loop } from "./core/loop.ts";
