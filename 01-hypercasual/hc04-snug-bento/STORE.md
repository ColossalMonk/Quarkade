# Snug Bento — Store and portal listing kit

Everything needed to fill in each portal's submission form and the app store listings. Art is in
`press/` (made with `?press=1` on the dev server; see `src/dev/press.ts`).

> **Name check (2026-11-17):**
> - **Exact name:** no game called "Snug Bento" turned up.
> - **Close names:**
>   - "Snug": an unrelated physics packing game on itch.io
>   - many bento titles: Bento Blocks, Bento Stack, Bento Rush, inbento, Bento Days, Bento Boss
> - **Trademark:** no search done (USPTO and EUIPO weren't checked).
>
> **Decision (2026-11-17): "Snug Bento"** (your choice). On app stores, use a subtitle such as **"Snug Bento: Lunchbox Puzzle"** to tell it apart. Check the name again, and search the trademark registries, before the app-store launch.
>
> If it ever needs renaming, update:
> - `src/data/strings.ts` → `title` (and `title` in the 9 files in `src/data/i18n/`)
> - `index.html` → `<title>`
> - `src/dev/press.ts` → `TITLE`, then re-run the press render
> - `capacitor.config.json` → `appName`
> - `android/app/src/main/res/values/strings.xml`

## Short description (≤ 80 characters)
Pack every gap and close the lid: a cosy lunchbox puzzle with tasty rules.

## Long description
Snug Bento is a cosy packing puzzle. Drag the foods into the lunchbox, turn them to fit, and fill every gap. When the box is snug, the lid slides on and taps shut.

- **Pack it snug.** Every piece has a place, and every level is built to be solvable. Place each piece once for a perfect box and three stars.
- **Food rules that change the puzzle:** soft foods (onigiri, mochi, jelly) squish into a second shape, hot and cold foods mustn't touch, sauce cups sit next to their food, and grass dividers and pickled plums get in the way.
- **Odd boxes:** L-shapes, round corners, hearts and two-tier boxes.
- **Cook 40 recipes.** Every food you pack ticks your recipe card. Finished recipes fill the café's five menus, and each finished menu brings a new lunchbox.
- **3,000+ checked levels,** plus endless ones after that.
- **Four handy power-ups:** Peek, Chopsticks, Knife and Tidy Up.
- **A Daily Bento** that's the same for everyone, with a streak and a calendar.
- **Make it yours:** lacquered, bamboo and tin boxes, lid wraps and table mats.
- **Relaxing:** no timers, free undo, soft sounds and calm café music.
- **Available in 10 languages.**

## How to play (portals ask for this)
Drag a food into the box; it snaps into place where it fits. Tap a piece to turn it (right-click on desktop). Tap a soft food to squish it into its other shape, and hold it to turn it. Fill every gap in the box to close the lid. Some boxes have rules: hot (🔥) and cold (❄) foods mustn't touch, and a sauce cup must touch its food. Undo is free (Z). Q/W/E/R use the power-ups.

## Tags and keywords
puzzle, packing puzzle, bento, lunchbox, food, cooking, tetris-like, polyomino, blocks, fit, cosy, cozy, relaxing, satisfying, brain, logic, casual, hypercasual, mobile

**App store keywords:** bento, lunchbox, packing puzzle, block puzzle, food puzzle, cozy, relaxing

## Category
Puzzle (sub-genre: packing / logic). Content: suitable for everyone, with no violence, chat or gambling.

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
| **Google Play / App Store** | Icon 512 (Play) / 1024 (Apple). Phone screenshots, feature graphic 1024×500 (Play) | `icon-1024-notext.png`, `screenshot-*-1080x1920.png` (pine box, red lacquer box, gingham mat). Feature graphic: crop from `cover-1920x1080.png` |

The press art has no HUD. Store screenshots with the real UI should be taken on a phone or emulator.

## Portal submission checklist
- [ ] Build: `node forge/tools/build-all.ts 01-hypercasual/hc04-snug-bento`. The zips are in `dist/zips/`.
- [ ] **CrazyGames:** upload `hc04-snug-bento-crazygames.zip`. Tick **"Progress Save"** so the SDK data module (cloud save) is on. Basic Launch first.
- [ ] **GameDistribution:**
  - set `VITE_GD_GAME_ID` before building
  - switch on rewarded ads in the dashboard
  - watch one full pre-roll from the admin iframe to activate
- [ ] **GameMonetize:** set `VITE_GM_GAME_ID` before building.
- [ ] **Playgama:** `playgama-bridge-config.json` is written into the build automatically. Add your GameDistribution game ID under `platforms.game_distribution` if you distribute through it.
- [ ] **YouTube Playables:** run Google's bundle analyzer on `dist/youtube`, and enable ads in the Developer Portal for the rewarded ads.
- [ ] **GamePix:** test in a 640×480 iframe; check that dragging works inside it.
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
  | `bento_remove_ads` | non-consumable | Interstitials off; rewarded ads stay |
  | `bento_starter_pack` | non-consumable | 2,000 coins + 3 of each power-up |
  | `bento_coins_small` / `_medium` / `_large` | consumable | 1,000 / 3,000 / 8,000 coins |
  | `bento_powerup_bundle` | consumable | 5 Peeks + 3 Chopsticks + 2 Knives + 2 Tidy Ups |
  | `bento_cosmetics_all` | non-consumable | Every box, lid wrap and table mat |

- **AdMob setup:**
  - Replace the test App ID in `android/app/src/main/AndroidManifest.xml`.
  - Build with `VITE_ADMOB_INTERSTITIAL` and `VITE_ADMOB_REWARDED` set to your ad unit IDs. Without them, Google's test units are used.
- **Privacy policy URL:** your hosted `legal/privacy.html`.
