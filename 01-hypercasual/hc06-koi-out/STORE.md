# Koi Out — Store and portal listing kit

Everything needed to fill in each portal's submission form and the app store listings. Art is in
`press/` (made with `?press=1` on the dev server; see `src/dev/press.ts`).

> **Name check (2026-11-19):**
> - **Exact name:** no game called "Koi Out" turned up.
> - **Taken or close:**
>   - "Outbound" (a 2026 Steam simulation game), so the catalog's working title was dropped
>   - "Swim Out" (a turn-based pool puzzle game)
>   - "KOI" (an adventure game on Steam), and several "Koi" board and card games
>   - The arrow-escape genre is crowded ("Tap Away", "Arrow Escape" and many more), but no koi version turned up.
> - **Trademark:** no search done (USPTO and EUIPO weren't checked).
>
> **Decision (2026-11-19): "Koi Out"** (your choice). On app stores, use a subtitle such as **"Koi Out: Pond Escape Puzzle"**. Check the name again, and search the trademark registries, before the app-store launch.
>
> If it ever needs renaming, update:
> - `src/data/strings.ts` → `title` (and `title` in the 9 files in `src/data/i18n/`)
> - `index.html` → `<title>`
> - `src/dev/press.ts` → `TITLE`, then re-run the press render
> - `capacitor.config.json` → `appName`
> - `android/app/src/main/res/values/strings.xml`

## Short description (≤ 80 characters)
Tap a koi to set it free, but only if its way out is clear!

## Long description
Koi Out is a calm escape puzzle in a crowded koi pond. Every koi faces a way. Tap one and it swims out head-first, its body following every bend, unless another koi is in its way. Then it bumps its nose, swims back, and you lose a heart. Free them all.

- **Look before you tap.** Find the koi with a clear way out, and the ones that have to wait for others to leave first.
- **Long, winding koi** glide out along their own curves, leaving ripples behind.
- **Pond twists:** lily pads, reed banks, whirlpools that turn little koi, frogs that hop away after a while, and currents that send a swimming koi a new way.
- **Keep the Koi Journal.** Every koi you free is a sighting. Fill pages of beautiful varieties (Kohaku, Showa, Tancho, Asagi, Ogon and more), and follow the koi upstream on a journey from the Garden Pond to the Dragon Gate falls.
- **3,000+ checked ponds,** plus endless ones after that. Every pond has a solution.
- **Four handy power-ups:** Glow, Lotus, Net and Bread.
- **A Daily Pond** that's the same for everyone, with a streak and a calendar.
- **Make it yours:** pond themes, ripple trails and lily pad styles.
- **Relaxing:** no timers, soft water sounds and calm garden music.
- **Available in 10 languages.**

## How to play (portals ask for this)
Tap a koi to make it swim out. It swims straight ahead from its head, and its body follows. If anything is in its way (another koi, a lily pad, a frog, or reeds on the bank), it bumps back and you lose a heart. Free every koi to clear the pond. Keep all three hearts for 3 stars. Z undoes (it puts koi back, not hearts), and Q/W/E/R use the power-ups.

## Tags and keywords
puzzle, koi, fish, pond, arrow puzzle, tap away, escape, logic, zen, relaxing, calm, casual, brain, hypercasual, mobile

**App store keywords:** koi, arrow puzzle, tap away, escape puzzle, pond, zen, relaxing, logic

## Category
Puzzle (sub-genre: logic / tap-away). Content: suitable for everyone, with no violence, chat or gambling.

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
| **Google Play / App Store** | Icon 512 (Play) / 1024 (Apple). Phone screenshots, feature graphic 1024×500 (Play) | `icon-1024-notext.png`, `screenshot-*-1080x1920.png` (Garden Pond, Moonlit Lake, Bamboo Stream). Feature graphic: crop from `cover-1920x1080.png` |

The press art has no HUD. Store screenshots with the real UI should be taken on a phone or emulator.

## Portal submission checklist
- [ ] Build: `node forge/tools/build-all.ts 01-hypercasual/hc06-koi-out`. The zips are in `dist/zips/`.
- [ ] **CrazyGames:** upload `hc06-koi-out-crazygames.zip`. Tick **"Progress Save"** so the SDK data module (cloud save) is on. Basic Launch first.
- [ ] **GameDistribution:**
  - set `VITE_GD_GAME_ID` before building
  - switch on rewarded ads in the dashboard (the out-of-hearts "+1 heart" needs them)
  - watch one full pre-roll from the admin iframe to activate
- [ ] **GameMonetize:** set `VITE_GM_GAME_ID` before building.
- [ ] **Playgama:** `playgama-bridge-config.json` is written into the build automatically. Add your GameDistribution game ID under `platforms.game_distribution` if you distribute through it.
- [ ] **YouTube Playables:** run Google's bundle analyzer on `dist/youtube`, and enable ads in the Developer Portal for the rewarded ads.
- [ ] **GamePix:** test in a 640×480 iframe; check the big ponds are still tappable at that size.
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
  | `koi_remove_ads` | non-consumable | Interstitials off; rewarded ads stay |
  | `koi_starter_pack` | non-consumable | 2,000 coins + 3 of each power-up |
  | `koi_coins_small` / `_medium` / `_large` | consumable | 1,000 / 3,000 / 8,000 coins |
  | `koi_powerup_bundle` | consumable | 5 Glows + 3 Lotuses + 2 Nets + 2 Breads |
  | `koi_cosmetics_all` | non-consumable | Every pond theme, trail and lily pad style sold in the shop |

- **AdMob setup:**
  - Replace the test App ID in `android/app/src/main/AndroidManifest.xml`.
  - Build with `VITE_ADMOB_INTERSTITIAL` and `VITE_ADMOB_REWARDED` set to your ad unit IDs. Without them, Google's test units are used.
- **Privacy policy URL:** your hosted `legal/privacy.html`.
