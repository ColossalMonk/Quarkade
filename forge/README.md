# forge

The shared template every Quarkade game is built on. Games import from `forge/src/...` with relative paths, so the Node tools can import the same code.

## What's in it

| Module | Does |
|---|---|
| `platform/platform.ts` | The one object games use for portals: loading, gameplay start/stop, level start/complete/fail, interstitial and rewarded ads, happy time, saves, pause/mute, host audio and language. Picks a driver at build time from `VITE_PLATFORM`; only that driver ships. If a portal SDK fails to load, the game runs without ads |
| `platform/drivers/*` | `local` (dev: fake ad cards), `poki`, `crazygames`, `gamedistribution`, `gamepix`, `gamemonetize`, `playgama`, `youtube`, and `app` (Capacitor: AdMob + UMP/ATT, Preferences, Haptics; loaded with a dynamic import, so web builds never include it) |
| `core/save.ts` | Versioned, debounced save slots through the platform's storage. Nested settings merge with defaults, so new fields survive updates. **Tamper check:** the data is stored encoded with a salted checksum, plus a backup copy under `<key>~`. An edited copy is ignored and repaired from the other; if both are edited, the game starts fresh. This stops casual edits only (the salt ships in the game), so anything that matters, such as leaderboards, needs a server check |
| `core/rng.ts` | Seeded randomness (`Rng`, `seedOf`, `utcDayKey`) |
| `core/tween.ts` | Tweens and easings |
| `core/audio.ts` | WebAudio synth: noise bursts, tones, arpeggios |
| `core/music.ts` | Generated background music (pad, bass, pentatonic melody). `COSY_SONG` is the default; games can pass their own `SongSpec` |
| `core/haptics.ts` | Vibration on the web (only after the user has interacted); swappable backend for the app |
| `core/i18n.ts` | String tables and language detection (can skip `navigator.language` for YouTube) |
| `core/loop.ts` | rAF loop with clamped delta time |
| `ui/ui.ts` | Shared UI shell: toasts, floating text, flying chips, modals, buttons, star rows (`Ui`, `starsRow`, `para`) |
| `ui/ads.ts` | `AdBudget`: rewarded-ad caps per level/day, overall and per item. `interstitialDue`: the shared interstitial rule |
| `ui/buy-card.ts` | "Watch an ad or pay coins" card for power-ups and tools |
| `ui/daily.ts` | Daily puzzle: results, streaks, calendar, share text, and the daily card |
| `ui/shop.ts` | Cosmetics shop with tabs, album/collection rewards, and an optional extra tab (the app's real-money store) |
| `ui/settings.ts` | Settings modal: on/off rows, language picker, extra buttons |
| `ui/ui.css` | Shared styles for all of the above. Games define the colour variables listed at the top |
| `app/app-extras.ts` | Phone app only: `makeAppExtras(products, reminderId)` gives in-app purchases (cordova-plugin-purchase) and the opt-in daily reminder (Local Notifications). Each game wraps it in its own `src/game/app-extras.ts` and imports that only when `VITE_PLATFORM === "app"` |
| `tools/build-all.ts` | Builds a game for every platform, checks the asset budget, zips each build into `dist/zips/`, and writes per-platform extras such as Playgama's config |
| `tools/zip.ts` | Dependency-free zip writer with forward-slash paths |
| `tools/save-test.ts` | Tests for the save slot and tamper check: `node forge/tools/save-test.ts` |
| `tools/vite-dev-save.ts` | Dev-server plugin: dev pages can save files (press art, editor levels) into allowed folders |

## Shared UI text keys

The `ui/` modules read their text from forge i18n, so every game registers these keys:

| Used by | Keys |
|---|---|
| Common | `close`, `watchAd`, `buyNone`, `limitReached` |
| Settings | `settings`, `on`, `off`, `language` |
| Shop | `shop`, `equip`, `equipped`, `albumReward`, plus one key per item id |
| Daily | `daily`, `dailyDone`, `dailyIntro`, `locked_at`, `dailyResult`, `dailyStreak`, `dailyBestStreak`, `dailyPlay`, `share`, `copied`, `dailyRetry`, `dailyBack` |

Knotwork and Density both run on this shell.

## Building

```bash
node forge/tools/build-all.ts 01-hypercasual/hc01-knotwork
```

```bash
node forge/tools/build-all.ts 01-hypercasual/hc01-knotwork crazygames
```

```bash
node forge/tools/build-all.ts 01-hypercasual/hc01-knotwork app
```

The first builds every portal, the second one portal, and the third the phone-app web bundle.

Build-time IDs:
- `VITE_GD_GAME_ID` (GameDistribution)
- `VITE_GM_GAME_ID` (GameMonetize)
- `VITE_ADMOB_INTERSTITIAL` and `VITE_ADMOB_REWARDED` (app; Google's test units are used if they're missing)

## Driver notes (checked against each portal's docs, 2026-11-12)

| Driver | Key rules followed |
|---|---|
| Poki | Pause and mute **before** `commercialBreak`/`rewardedBreak`. Rewarded buttons: 🎬, not green, next to a plain button. `gameplayStart` on first input |
| CrazyGames | `muteAudio` setting and listener honoured. Rewarded hidden when an ad blocker is detected. `SDK.data` cloud save needs "Progress Save" ticked at submission |
| GameDistribution | Reward only on `SDK_REWARDED_WATCH_COMPLETE` (waits up to 1 s after `showAd`). Ignores the startup `SDK_GAME_START` |
| GamePix | `GamePixConfig = { lifecycle: 'manual' }` before loading. `lifecycle.*`, `ads.*`, `events.on('pause'/'resume')` |
| GameMonetize | Interstitial only (no rewarded documented). Gives up after 3 s without `SDK_GAME_PAUSE` |
| Playgama | Bridge **v2**. `level_*` messages. `isRewardedSupported`. Pause/audio events. Array storage API. Config file written by the build |
| YouTube Playables | `firstFrameReady`/`gameReady`. `requestRewardedAd`. No saves if `loadData` failed. Saves on pause. No visibility API or `navigator.language` |

**Still needed before release:** run each portal's own QA or inspector tool on the uploaded build. That can't be done from here.
