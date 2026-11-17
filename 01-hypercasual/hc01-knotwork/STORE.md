# Knotwork — Store and portal listing kit

Everything needed to fill in each portal's submission form and the app store listings. Art is in
`press/` (made with `?press=1` on the dev server; see `src/dev/press.ts`).

> **Name check (2026-11-12):** the name "Knotwork" is already in use:
> - an itch.io browser puzzle by clickmazes (2023)
> - "Knotwork Puzzle: Loop Lines", on the App Store since July 2026
>
> Neither is on Poki or CrazyGames, and no trademark turned up in a quick search (USPTO and EUIPO weren't checked directly).
>
> **Decision (2026-11-12): keep "Knotwork".**
> - On app stores, add a subtitle to tell it apart, e.g. "Knotwork: Yarn Sort Quilt", since another "Knotwork Puzzle" is already listed there.
> - Search the trademark registries before the app-store launch.
>
> If it ever needs renaming, update:
> - `src/data/strings.ts` → `title`
> - `index.html` → `<title>`
> - `src/dev/press.ts` → `TITLE`, then re-run the press render
> - `capacitor.config.json` → `appName`

## Short description (≤ 80 characters)
Sort the yarn, knit the quilt: a cosy colour-sorting puzzle.

## Long description
Knotwork is a cosy colour-sorting puzzle with a crafty twist. Tap a needle to lift its yarn loops and place them on another. Fill a needle with four loops of one colour and it knits a patch into your quilt.

- **Your sorting builds pictures.** Every finished needle stitches into an 8×8 quilt. Complete quilts to fill five albums: Cosy Home, Garden, Seaside, Sweets and Night Sky.
- **3,000+ hand-checked levels,** plus endless ones after that. Every level is verified as solvable.
- **New twists as you go:** hidden loops, two-colour twisted yarn, knotted pairs, and a hungry moth that keeps you moving.
- **Four handy power-ups:** Spare Needle, Lantern, Snip and Yarn Swift.
- **A Daily Swatch** that's the same for everyone, with a streak and a calendar quilt.
- **Make it yours:** yarn styles, needle skins and board themes.
- **Relaxing:** no timers, gentle sounds and calm music.
- **Accessible:** colour-blind symbols. Available in 10 languages.

## How to play (portals ask for this)
Tap a needle to pick up its top loops. Tap another needle to put them down; they can only go onto an empty needle or the same colour. Put four loops of one colour on a needle to finish it. Finish every colour to complete the level. Keys 1–0 pick needles, Z undoes, Q/W/E/R use power-ups.

## Tags and keywords
puzzle, sort, colour sort, yarn, wool, knitting, quilt, casual, relaxing, cozy, brain, logic, hypercasual, mobile

**App store keywords:** yarn sort, wool sort, knit, colour sort puzzle, cozy, relaxing, quilt

## Category
Puzzle (sub-genre: sorting / logic). Content: suitable for everyone, with no violence, chat or gambling.

## Assets by platform

| Platform | What it asks for (from its docs, 2026-11-12) | Files in `press/` |
|---|---|---|
| **CrazyGames** | Covers 1920×1080, 800×1200, 800×800. Plus 15–20 s videos (1080p 16:9 and 2:3, ≤ 50 MB, no sound) | `cover-1920x1080.png`, `portrait-800x1200.png`, `square-1024.png` (scale to 800). **Videos still to record** |
| **Poki** (not this game's route) | Square full-bleed thumbnail ≥ 628×628, **no text**. Plus an animated thumbnail | `icon-1024-notext.png` |
| **GameDistribution** | Not officially published; commonly 512×384, 512×512, 512×340, 1280×720, 1280×550 | `landscape-512x384.png`, `square-512.png`, `cover-1280x720.png`. Crop others from `cover-1920x1080.png` |
| **GamePix** | Icon + cover (sizes not public) | `square-512.png`, `cover-1280x720.png` |
| **GameMonetize** | Not documented; 512×384 is typical | `landscape-512x384.png` |
| **Playgama** | Optional covers, icons, screenshots and video. Description + how-to-play required | Any of the above |
| **YouTube Playables** | Thumbnails in several ratios, **no logos or branding**; exact sizes in the Developer Portal | `cover-1920x1080-notext.png`, `icon-1024-notext.png` |
| **Google Play / App Store** | Icon 512 (Play) / 1024 (Apple). Phone screenshots, feature graphic 1024×500 (Play) | `icon-1024-notext.png`, `screenshot-*-1080x1920.png`. Feature graphic: crop from `cover-1920x1080.png` |

The press art has no HUD. Store screenshots with the real UI should be taken on a phone or emulator.

## Portal submission checklist
- [ ] Decide the final name (see the box above).
- [ ] Build: `node forge/tools/build-all.ts 01-hypercasual/hc01-knotwork`. The zips are in `dist/zips/`.
- [ ] **CrazyGames:** upload `hc01-knotwork-crazygames.zip`. Tick **"Progress Save"** so the SDK data module (cloud save) is on. Basic Launch first.
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
  | `knotwork_remove_ads` | non-consumable | Interstitials off; rewarded ads stay |
  | `knotwork_starter_pack` | non-consumable | 2,000 coins + 3 of each power-up |
  | `knotwork_coins_small` / `_medium` / `_large` | consumable | 1,000 / 3,000 / 8,000 coins |
  | `knotwork_powerup_bundle` | consumable | 5 Spare Needles + 3 Snips + 2 Yarn Swifts |
  | `knotwork_cosmetics_all` | non-consumable | Every yarn, needle and board |

- **AdMob setup:**
  - Replace the test App ID in `android/app/src/main/AndroidManifest.xml`.
  - Build with `VITE_ADMOB_INTERSTITIAL` and `VITE_ADMOB_REWARDED` set to your ad unit IDs. Without them, Google's test units are used.
- **Privacy policy URL:** your hosted `legal/privacy.html`.
