# hc01 · Knotwork — Build notes

**Status: v1.0, complete.** Everything in DESIGN.md is built. What's left are steps only you can do (accounts, uploads, store consoles, a real phone) and the name decision; see "Your steps" at the end.

## Run it
The preview entry is `knotwork` in `D:\personal-dev\.claude\launch.json` (port 5190). From `Quarkade/`:

```bash
node node_modules/vite/bin/vite.js 01-hypercasual/hc01-knotwork --port 5190
```

**Dev-only switches** (stripped from production builds):

| Switch | Effect |
|---|---|
| `?fresh=1` | Wipe the save |
| `?level=N`, `?coins=N` | Jump ahead |
| `?gen=1` | Generate every level live |
| `?press=1` | Render store art into `press/` |
| `?def=…` | Play a level from the editor |
| `/editor.html` | The level editor |
| `window.__knot` | Test hooks |

## Checks

```bash
node 01-hypercasual/hc01-knotwork/tools/selftest.ts
```

```bash
node 01-hypercasual/hc01-knotwork/tools/simulate.ts 400
```

```bash
node forge/tools/build-all.ts 01-hypercasual/hc01-knotwork
```

| Tool | What it does |
|---|---|
| `selftest.ts` | Rules (twisted, knots, moth), solver, generator intros (45/61/80), Daily Swatch |
| `simulate.ts` | Economy and pacing over 400 levels for 3 player types, using the real packs |
| `build-all.ts` | Builds 8 targets, checks the size budget, zips each for upload into `dist/zips/`, and writes Playgama's `playgama-bridge-config.json` |
| `build-all.ts … app` | Builds the phone-app web bundle (see APP.md) |

## Levels
| Levels | Source |
|---|---|
| 1–20 | `src/data/levels-tutorial.json`, from `node tools/build-packs.ts tutorial` |
| 21–3020 | `public/packs/pack-0..5.json` (generator `knot-v2`, with twisted loops, knots and moths), from `node tools/build-packs.ts packs 6`. Takes about 1 hour; every level is solved twice |
| 3021+ | Generated at runtime in the Web Worker |
| Daily Swatch | `generateDaily(UTC date)` in the worker |

## What's in v1.0

**Puzzle**
- Locked needles, hidden loops, needles of size 3/4/5, the Basket.
- **Twisted loops** (45+), **knots** (61+), **moths** (80, then every 25th level).
- Solver, generator and difficulty curve.
- Tags: Breather, Tricky, Moth, Masterpiece.

**Power-ups and help**
- Spare Needle, Lantern, Snip, Yarn Swift: bought with coins or a rewarded ad, within the caps.
- Undo, hint, restart.
- Easier version after 3 restarts. Free hint after 2 restarts, or after 1 for struggling players (based on recent moves vs par).
- **Pre-level boost:** before Tricky and Masterpiece levels, watch an ad to start with a Spare Needle.

**Quilts and albums**
- 8×8 quilts across **5 albums, 40 pictures**.
- Albums open by total stars (0 / 60 / 150 / 250 / 360).
- **Album complete** gives a needle skin.
- **Encore** quilts after every open picture is done.

**Cosmetics shop** (opens after level 20; tap the coin counter, or use Settings / the side panel)

| Category | Items |
|---|---|
| Yarn styles | Chunky, Mohair, Cotton, Metallic, Rainbow |
| Needles | Oak, plus 5 album-reward skins, plus Steel and Crystal from the shop |
| Boards | Oak, Felt, Picnic, Starry |

**Daily Swatch** (after level 20)
- Streak, best streak, calendar quilt.
- 7-day bonus.
- One rewarded retry a day.
- Share text.

**Accessibility, sound and language**
- **Colour-blind mode:** 12 symbols knitted into the yarn, plus symbols on basket loops.
- **Music** generated in code (forge `Music`), with a toggle.
- **10 languages** (en, es, pt, fr, de, it, ru, tr, id, ja) with a picker in Settings. The platform's language is used first.

**Layout**
- Phone portrait with 1–3 rows of needles.
- **Wide screens** get a side panel with the quilt and Daily/Shop buttons.
- The camera keeps the board clear of the measured HUD bars.
- A compact HUD for short landscape windows.

**Portals** (driver details in `forge/README.md`)
- All 7 drivers updated to each portal's docs as of 2026-11-12.
- Rewarded buttons follow Poki's rule: 🎬 icon, not green, next to a plain button.
- Arrow, space and wheel keys never scroll the host page.
- YouTube build: no visibility API and no `navigator.language`.

**Phone app** (see APP.md)
- Capacitor 8 project in `android/`.
- AdMob with Google's consent form (UMP) and Apple's tracking prompt (ATT).
- In-app purchases (7 products), the daily reminder, Preferences saves, Haptics.

**Store kit** (see STORE.md)
- Listing text and the assets each portal asks for, rendered in `press/` (12 images).
- Privacy policy template in `legal/privacy.html`.

**Economy** (tuned with `simulate.ts`)
- About 25–34 coins per level, so a power-up costs 6–8 levels of coins.
- Quilts take 10–12 levels.

**Visual checks done:**
- Press renders at full resolution: covers, portrait, square, colour-blind and moth shots.
- Wide layout at 1280×720.

**Cheat protection (2026-11-14):**
- Dev switches (`?level=`, `?coins=`, `?fresh=`, `?def=`, `?gen=`, `?press=`), the test hooks and the editor exist only on the dev server. Production builds were checked to contain none of them, and the address is ignored.
- Saves use forge's tamper check: edited saves are ignored. If one copy was edited, the other is used; if both were, the game starts fresh. This was tested in the production build.
- Old-format saves on the dev servers are discarded once (the games are unreleased, so no players are affected).

## Differences from DESIGN.md
- **Undo can't reverse a power-up.** Using a power-up clears the undo history.
- **No easier next level after a failure.** Levels are fixed in packs. This is replaced by the free hint (sooner for struggling players) and the easier version.
- **Quilt chapters** follow the generator's 12-level chapter slope. "Finishing Stitch" shows when a level will complete the quilt.
- **Big quilt colours knit several cells per needle,** so a quilt takes 10–12 levels.
- **The moth doesn't destroy yarn.** When its counter runs out, a panel offers a free undo, shooing the moth (ad or 100 coins), or a restart.
- **Knot intro is level 61.** Knots tie same-colour loops only. Twisted loops come in pairs.
- **The Daily Swatch opens after level 20.**
- **Coin rewards are lower** than the first draft of §4 (base 6, +3 per star, +1 per 40 levels up to +8, Masterpiece +100), after simulation. All values are in `src/data/economy.ts`.
- **Filler colours** (not in the quilt picture) give 1 coin instead of 2.

## Your steps (can't be done from here)
1. **Name: keep "Knotwork"** (decided 2026-11-12). On app stores, use a subtitle such as "Knotwork: Yarn Sort Quilt" to tell it apart from "Knotwork Puzzle: Loop Lines", and search the trademark registries before the app-store launch.
2. **Portal accounts and IDs:**
   - `VITE_GD_GAME_ID`, `VITE_GM_GAME_ID`
   - CrazyGames "Progress Save" tick
   - YouTube Developer Portal ads
   - GameDistribution rewarded switch
3. **Upload the zips** from `dist/zips/` and run each portal's own QA tool.
4. **Record the CrazyGames videos** (15–20 s, 16:9 and 2:3).
5. **Phone app:**
   - install Android Studio, then build and run on a low-end phone
   - set your AdMob App ID and ad units
   - create the 7 products
   - host the privacy policy
6. **Playtest with real players,** then retune `economy.ts` and the difficulty weights with real data.
