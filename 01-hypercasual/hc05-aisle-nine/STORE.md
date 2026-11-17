# Aisle Nine — Store and portal listing kit

Everything needed to fill in each portal's submission form and the app store listings. Art is in
`press/` (made with `?press=1` on the dev server; see `src/dev/press.ts`).

> **Name check (2026-11-17):**
> - **Exact name:** no game called "Aisle Nine" turned up.
> - **Close names:**
>   - "Do not approach Aisle 9" (a tabletop RPG on itch.io)
>   - "Aisle" (1999 interactive fiction), "Cleanup on Aisle 3", "Aisle Survive"
>   - The goods-sort genre is crowded with "Goods Sort" / "Goods Triple Match" titles, but none uses "Aisle".
> - **Trademark:** no search done (USPTO and EUIPO weren't checked).
>
> **Decision (2026-11-17): "Aisle Nine"** (kept from the catalog). On app stores, use a subtitle such as **"Aisle Nine: Goods Sort Puzzle"**. Check the name again, and search the trademark registries, before the app-store launch.
>
> If it ever needs renaming, update:
> - `src/data/strings.ts` → `title` (and `title` in the 9 files in `src/data/i18n/`)
> - `index.html` → `<title>`
> - `src/dev/press.ts` → `TITLE`, then re-run the press render
> - `capacitor.config.json` → `appName`
> - `android/app/src/main/res/values/strings.xml`

## Short description (≤ 80 characters)
Sort the shelves of a turning stand: three alike and they're sold!

## Long description
Aisle Nine is a cosy goods-sorting puzzle with a twist: the shelves turn. Tap a good, then tap a shelf to move it there. Line up three of the same on one shelf and they're sold, and the goods waiting behind slide forward.

- **A stand that turns.** Only the shelves facing you can be used, and the stand turns one step with every move. Plan for the shelf that's coming round, and park a good where you'll need it.
- **No timers.** The stand only turns when you move. Undo is free, and every level has a solution.
- **Shop twists:** cardboard boxes that open when a neighbour sells, a freezer that thaws as you sell, a glass cabinet opened by the goods with the key, a restock cart, and customers who want one thing.
- **Stock Main Street.** Every triple you sell fills a display in one of six shops: Corner Grocery, Bakery, Toy Shop, Garden Centre, Sweet Shop and Bookshop. Fill a shop and it opens, with its own theme for your stand.
- **48 goods** to sort: apples and jam, croissants and cupcakes, rubber ducks and rockets, cactuses and gnomes, lollipops and macarons, globes and hourglasses.
- **3,000+ checked levels,** plus endless ones after that.
- **Four handy power-ups:** Brake, Basket, Restack and Shop Assistant.
- **A Daily Restock** that's the same for everyone, with a streak and a calendar.
- **Make it yours:** stands, awnings and shopping bags.
- **Available in 10 languages.**

## How to play (portals ask for this)
Tap a good, then tap a shelf to move it there (or drag it). Three of the same good on one shelf are sold, and the goods behind slide forward. The stand turns one step after every move, and only the shelves facing you can be used: the map under the stand shows what's coming round. ⟳ (Space) turns the stand without moving a good. Sell every good to finish the level. If every shelf fills up you're jammed: undo, or use a Basket. Z undoes, Q/W/E/R use the power-ups.

## Tags and keywords
puzzle, sort, goods sort, sorting, triple match, match 3, shop, store, shelf, supermarket, organise, organize, satisfying, cosy, cozy, relaxing, casual, brain, logic, hypercasual, mobile

**App store keywords:** goods sort, triple match, sort puzzle, shop, shelf, organize, satisfying, cozy

## Category
Puzzle (sub-genre: sorting / triple match). Content: suitable for everyone, with no violence, chat or gambling.

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
| **Google Play / App Store** | Icon 512 (Play) / 1024 (Apple). Phone screenshots, feature graphic 1024×500 (Play) | `icon-1024-notext.png`, `screenshot-*-1080x1920.png` (grocery, sweet shop, bookshop themes). Feature graphic: crop from `cover-1920x1080.png` |

The press art has no HUD. Store screenshots with the real UI should be taken on a phone or emulator.

## Portal submission checklist
- [ ] Build: `node forge/tools/build-all.ts 01-hypercasual/hc05-aisle-nine`. The zips are in `dist/zips/`.
- [ ] **CrazyGames:** upload `hc05-aisle-nine-crazygames.zip`. Tick **"Progress Save"** so the SDK data module (cloud save) is on. Basic Launch first.
- [ ] **GameDistribution:**
  - set `VITE_GD_GAME_ID` before building
  - switch on rewarded ads in the dashboard
  - watch one full pre-roll from the admin iframe to activate
- [ ] **GameMonetize:** set `VITE_GM_GAME_ID` before building.
- [ ] **Playgama:** `playgama-bridge-config.json` is written into the build automatically. Add your GameDistribution game ID under `platforms.game_distribution` if you distribute through it.
- [ ] **YouTube Playables:** run Google's bundle analyzer on `dist/youtube`, and enable ads in the Developer Portal for the rewarded ads.
- [ ] **GamePix:** test in a 640×480 iframe; check that the stand is readable at that size.
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
  | `aisle_remove_ads` | non-consumable | Interstitials off; rewarded ads stay |
  | `aisle_starter_pack` | non-consumable | 2,000 coins + 3 of each power-up |
  | `aisle_coins_small` / `_medium` / `_large` | consumable | 1,000 / 3,000 / 8,000 coins |
  | `aisle_powerup_bundle` | consumable | 5 Brakes + 3 Baskets + 2 Restacks + 2 Shop Assistants |
  | `aisle_cosmetics_all` | non-consumable | Every stand, awning and bag |

- **AdMob setup:**
  - Replace the test App ID in `android/app/src/main/AndroidManifest.xml`.
  - Build with `VITE_ADMOB_INTERSTITIAL` and `VITE_ADMOB_REWARDED` set to your ad unit IDs. Without them, Google's test units are used.
- **Privacy policy URL:** your hosted `legal/privacy.html`.
