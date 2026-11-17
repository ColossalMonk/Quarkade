# Unbolted — Store and portal listing kit

Everything needed to fill in each portal's submission form and the app store listings. Art is in
`press/` (made with `?press=1` on the dev server; see `src/dev/press.ts`).

> **Name check (2026-11-14):**
> - **Already taken:** "Screw Ball" (2024) is on CrazyGames, so the catalog's working title "Screwball Workshop" was dropped.
> - **Exact name:** no game called just "Unbolted" turned up on CrazyGames, Poki, itch.io, Steam or the App Store.
> - **Close names:**
>   - App Store: "Unbolt: Nuts and Bolts Puzzle" and "Unbolt Them All"
>   - itch.io and Cinevva: small games called "Unbolt"
> - **Trademark:** no search done (USPTO and EUIPO weren't checked).
>
> **Decision (2026-11-14): "Unbolted"** (your choice). On app stores, use a subtitle such as **"Unbolted: Swing Screw Puzzle"** to tell it apart. Search the trademark registries before the app-store launch.
>
> If it ever needs renaming, update:
> - `src/data/strings.ts` → `title`
> - `index.html` → `<title>`
> - `src/dev/press.ts` → `TITLE`, then re-run the press render
> - `capacitor.config.json` → `appName`
> - `android/app/src/main/res/values/strings.xml`

## Short description (≤ 80 characters)
Unscrew, swing, drop: a screw puzzle where the plates really swing.

## Long description
Unbolted is a screw-sorting puzzle with a swing. Tap a bolt to unscrew it, and it flies into the toolbox of its colour. When a plate is down to its last bolt, it swings and hangs from it, uncovering the bolts it was hiding, or covering new ones. Leave the right bolt and the plate swings out of your way.

- **Plan the swing.** Every plate hangs exactly where its weight takes it, so you can plan which bolt to leave.
- **Stay tidy.** Two toolboxes are open at a time and the next one is shown. Bolts with no box wait in a small tray. Fill the tray and you're jammed! Stars reward putting bolts straight into their box.
- **Restore 40 gadgets.** Every toolbox you close tightens a bolt on a gadget: a go-kart, a robot pal, a cuckoo clock, a submarine, a rocket. Finished gadgets come to life on your workshop shelf.
- **Decorate five workshops:** Garage, Toy Shop, Clockmaker, Shipyard and Space Hangar. Each finished gadget brings a Decor Crate: pick the lamp, poster, rug or radio you like.
- **3,000+ checked levels,** plus endless ones after that. Every level is built to be solvable.
- **New twists as you go:** hinge pins, rusty bolts, glass plates, padlocks, chains and long bolts.
- **Four handy power-ups:** Extra Slot, Oil Can, Drill and Magnet.
- **A Daily Teardown** that's the same for everyone, with a streak and a calendar.
- **Make it yours:** screwdrivers, plate finishes (painted steel, copper, plywood, candy acrylic) and pegboards.
- **Relaxing:** no timers, satisfying ratchet clicks and calm music.
- **Accessible:** colour-blind symbols. Available in 10 languages.

## How to play (portals ask for this)
Tap a bolt to unscrew it. It goes into the toolbox of its colour, or waits in the tray if no box of that colour is open. A full toolbox closes and the next one slides in. A plate held by one bolt swings and hangs from it; a plate with no bolts drops away. Bolts under a plate can't be reached. Clear every bolt to finish the level. If the tray fills up, you're jammed: undo, add an Extra Slot or restart. Z undoes, Q/W/E/R use power-ups.

## Tags and keywords
puzzle, screw, screw puzzle, nuts and bolts, unscrew, bolt, sort, colour sort, workshop, gadget, satisfying, casual, relaxing, brain, logic, hypercasual, mobile

**App store keywords:** screw puzzle, nuts and bolts, unscrew, screw jam, bolt sort, satisfying, workshop

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
| **Google Play / App Store** | Icon 512 (Play) / 1024 (Apple). Phone screenshots, feature graphic 1024×500 (Play) | `icon-1024-notext.png`, `screenshot-*-1080x1920.png` (default, colour-blind, Night Shift pegboard with copper plates). Feature graphic: crop from `cover-1920x1080.png` |

The press art has no HUD. Store screenshots with the real UI should be taken on a phone or emulator.

## Portal submission checklist
- [ ] Build: `node forge/tools/build-all.ts 01-hypercasual/hc03-unbolted`. The zips are in `dist/zips/`.
- [ ] **CrazyGames:** upload `hc03-unbolted-crazygames.zip`. Tick **"Progress Save"** so the SDK data module (cloud save) is on. Basic Launch first.
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
  | `unbolted_remove_ads` | non-consumable | Interstitials off; rewarded ads stay |
  | `unbolted_starter_pack` | non-consumable | 2,000 coins + 3 of each power-up |
  | `unbolted_coins_small` / `_medium` / `_large` | consumable | 1,000 / 3,000 / 8,000 coins |
  | `unbolted_powerup_bundle` | consumable | 5 Extra Slots + 3 Oil Cans + 2 Drills + 2 Magnets |
  | `unbolted_cosmetics_all` | non-consumable | Every screwdriver, plate finish and pegboard |

- **AdMob setup:**
  - Replace the test App ID in `android/app/src/main/AndroidManifest.xml`.
  - Build with `VITE_ADMOB_INTERSTITIAL` and `VITE_ADMOB_REWARDED` set to your ad unit IDs. Without them, Google's test units are used.
- **Privacy policy URL:** your hosted `legal/privacy.html`.
