# Density — Store and portal listing kit

Everything needed to fill in each portal's submission form and the app store listings. Art is in
`press/` (made with `?press=1` on the dev server; see `src/dev/press.ts`).

> **Name check (2026-11-13):**
> - No game called just "Density" turned up on CrazyGames, Poki, itch.io, Steam or the App Store.
> - "Density" is a plain dictionary word, so searching for it alone will bury the game. It needs a subtitle everywhere.
> - **Closest competitor:** "Pour Lab: Liquid Sort" (App Store). It uses heavier-sinks-below-lighter as one of six twists. In Density, weight is the core rule.
> - No trademark search was done (USPTO and EUIPO weren't checked).
>
> **Suggested listing name:** "Density: Liquid Sort Lab" (or "Density — Pour & Settle"). Keep "Density" as the in-game title.
>
> **Decision: open.** Keep "Density" with a subtitle, or rename. To rename, update:
> - `src/data/strings.ts` → `title`
> - `index.html` → `<title>`
> - `src/dev/press.ts` → `TITLE`, then re-run the press render
> - `capacitor.config.json` → `appName`
> - `android/app/src/main/res/values/strings.xml`

## Short description (≤ 80 characters)
Pour, settle, sort: a liquid puzzle where heavy sinks and light floats.

## Long description
Density is a liquid-sorting puzzle with real weight. Tap a flask to pick up its top liquid and pour it into another. Heavy liquids sink past lighter ones and settle below them. Fill a flask with four layers of one liquid and it seals with a cork.

- **Five weights, one rule.** Foam floats on oil, oil on water, water on syrup, and syrup on mercury. A pour may only rest on its own colour or on something heavier.
- **Every flask you seal builds a Density Tower.** Fill 40 towers across five collections: Kitchen Science, Rainbow, Ocean, Potion Shop and Space Lab.
- **3,000+ checked levels,** plus endless ones after that. Every level is verified as solvable.
- **New twists as you go:** odd-sized flasks, corked flasks that open as you seal others, murky layers, floating foam and heavy mercury.
- **Four lab tools:** Spare Flask, Lamp, Pipette and Centrifuge.
- **A Daily Brew** that's the same for everyone, with a streak and a calendar.
- **Make it yours:** glassware, lab benches and pour effects.
- **Relaxing:** no timers, gentle sounds and calm music.
- **Accessible:** colour-blind symbols. Available in 10 languages.

## How to play (portals ask for this)
Tap a flask to pick up its top liquid. Tap another flask to pour it in. Heavier liquids sink below lighter ones. A liquid can only come to rest on the same colour or on a heavier liquid. Fill a flask with four layers of one liquid to seal it. Seal every liquid to finish the level. Keys 1–0 pick flasks, Z undoes, Q/W/E/R use the lab tools.

## Tags and keywords
puzzle, sort, water sort, liquid sort, colour sort, pour, density, science, lab, potion, casual, relaxing, brain, logic, hypercasual, mobile

**App store keywords:** liquid sort, water sort, pour puzzle, density, layers, potion, relaxing

## Category
Puzzle (sub-genre: sorting / logic). Content: suitable for everyone, with no violence, chat or gambling.

## Assets by platform

| Platform | What it asks for (from its docs, checked 2026-11-12) | Files in `press/` |
|---|---|---|
| **CrazyGames** | Covers 1920×1080, 800×1200, 800×800. Plus 15–20 s videos (1080p 16:9 and 2:3, ≤ 50 MB, no sound) | `cover-1920x1080.png`, `portrait-800x1200.png`, `square-1024.png` (scale to 800). **Videos still to record** |
| **Poki** (not this game's route) | Square full-bleed thumbnail ≥ 628×628, **no text**. Plus an animated thumbnail | `icon-1024-notext.png` |
| **GameDistribution** | Not officially published; commonly 512×384, 512×512, 512×340, 1280×720, 1280×550 | `landscape-512x384.png`, `square-512.png`, `cover-1280x720.png`. Crop others from `cover-1920x1080.png` |
| **GamePix** | Icon + cover (sizes not public) | `square-512.png`, `cover-1280x720.png` |
| **GameMonetize** | Not documented; 512×384 is typical | `landscape-512x384.png` |
| **Playgama** | Optional covers, icons, screenshots and video. Description + how-to-play required | Any of the above |
| **YouTube Playables** | Thumbnails in several ratios, **no logos or branding**; exact sizes in the Developer Portal | `cover-1920x1080-notext.png`, `icon-1024-notext.png` |
| **Google Play / App Store** | Icon 512 (Play) / 1024 (Apple). Phone screenshots, feature graphic 1024×500 (Play) | `icon-1024-notext.png`, `screenshot-*-1080x1920.png` (default, colour-blind, Space Station bench). Feature graphic: crop from `cover-1920x1080.png` |

The press art has no HUD. Store screenshots with the real UI should be taken on a phone or emulator.

## Portal submission checklist
- [ ] Decide the final name (see the box above).
- [ ] Build: `node forge/tools/build-all.ts 01-hypercasual/hc02-density`. The zips are in `dist/zips/`.
- [ ] **CrazyGames:** upload `hc02-density-crazygames.zip`. Tick **"Progress Save"** so the SDK data module (cloud save) is on. Basic Launch first.
- [ ] **GameDistribution:**
  - set `VITE_GD_GAME_ID` before building
  - switch on rewarded ads in the dashboard
  - watch one full pre-roll from the admin iframe to activate
- [ ] **GameMonetize:** set `VITE_GM_GAME_ID` before building.
- [ ] **Playgama:** `playgama-bridge-config.json` is written into the build automatically. Add your GameDistribution game ID under `platforms.game_distribution` if you distribute through it.
- [ ] **YouTube Playables:** run Google's bundle analyzer on `dist/youtube`, and enable ads in the Developer Portal for the rewarded ads.
- [ ] **GamePix:** test in a 640×480 iframe.
- [ ] Host `legal/privacy.html` (fill in the brackets) and link it wherever a privacy URL is asked for.

## Phone app (Google Play / App Store)
- **Rating:** Everyone (IARC). Target audience: **13+**, so Google's Families ad rules don't apply.
- **Data safety (Play):**
  - **Collected:** device or other IDs, and app interactions. Both are for advertising and analytics by AdMob, and the user can opt out.
  - **Not collected:** personal info.
  - **Not shared** beyond the AdMob SDK.
  - **Encryption:** data is encrypted in transit (HTTPS).
- **In-app products** to create with these exact IDs:

  | Product | Type | Gives |
  |---|---|---|
  | `density_remove_ads` | non-consumable | Interstitials off; rewarded ads stay |
  | `density_starter_pack` | non-consumable | 2,000 coins + 3 of each lab tool |
  | `density_coins_small` / `_medium` / `_large` | consumable | 1,000 / 3,000 / 8,000 coins |
  | `density_powerup_bundle` | consumable | 5 Spare Flasks + 3 Lamps + 2 Pipettes + 2 Centrifuges |
  | `density_cosmetics_all` | non-consumable | Every glass, bench and pour |

- **AdMob setup:**
  - Replace the test App ID in `android/app/src/main/AndroidManifest.xml`.
  - Build with `VITE_ADMOB_INTERSTITIAL` and `VITE_ADMOB_REWARDED` set to your ad unit IDs. Without them, Google's test units are used.
- **Privacy policy URL:** your hosted `legal/privacy.html`.
