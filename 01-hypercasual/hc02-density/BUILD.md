# hc02 · Density — Build notes

**Status: v1.0, complete.** Everything in DESIGN.md is built. What's left:
- steps only you can do: accounts, uploads, store consoles, a real phone
- the name decision
- a playtest of the difficulty

See "Your steps" at the end.

## Run it
The preview entry is `density` in `D:\personal-dev\.claude\launch.json` (port 5192). From `Quarkade/`:

```bash
node node_modules/vite/bin/vite.js 01-hypercasual/hc02-density --port 5192
```

**Dev-only switches** (stripped from production builds):

| Switch | Effect |
|---|---|
| `?fresh=1` | Wipe the save |
| `?level=N`, `?coins=N` | Jump ahead |
| `?gen=1` | Generate every level live |
| `?press=1` | Render store art into `press/` (12 images) |
| `?def=…` | Play a level from the editor |
| `/editor.html` | The level editor |
| `window.__dens` | Test hooks, including `shot(name, w, h)` for a full-resolution board render |

**Level editor** (`/editor.html`):
- One flask per line as `capacity:units`, bottom to top. `a`, `b`, … are liquid slots; UPPERCASE is murky.
- Set a weight for each slot, and corks as `flask:count`.
- **Settle** sorts each flask by weight.
- **Solve + rate** gives pours, par, dead-end rate, D and the solution.
- Load tutorial or pack level N, or generate level N.
- Play the level in the game, or save it to `levels-edit/`.

## Checks

```bash
node 01-hypercasual/hc02-density/tools/selftest.ts
```

```bash
node 01-hypercasual/hc02-density/tools/simulate.ts 400
```

```bash
node forge/tools/build-all.ts 01-hypercasual/hc02-density
```

| Tool | What it does |
|---|---|
| `selftest.ts` | Weight rules (sinking, floating, resting rule), sealing, corks, the four power-ups, solver, every intro level, Daily Brew |
| `simulate.ts` | Economy and tower pacing over 400 real levels for 3 player types |
| `build-all.ts` | Builds 8 targets, checks the size budget, zips each into `dist/zips/`, writes Playgama's config |
| `build-all.ts … app` | Builds the phone-app web bundle (see APP.md) |

## Levels
| Levels | Source |
|---|---|
| 1–20 | `src/data/levels-tutorial.json`, from `node tools/build-packs.ts tutorial` |
| 21–3020 | `public/packs/pack-0..5.json` (generator `dens-v1`), from `node tools/build-packs.ts packs 6`. Takes about 40 minutes; every level is solved twice |
| 3021+ | Generated at runtime in the Web Worker |
| Daily Brew | `generateDaily(UTC date)` in the worker |

**How the generator solves:**
1. Every candidate gets a quick, greedy solve (weight 2.5, 20k nodes). That's enough to know it's solvable and to rank it.
2. Only the chosen level gets a careful solve (weight 1.4, 120k nodes) to set an accurate par.

This brought high levels from about 5 s to about 0.8 s each.

## What's in v1.0

**Puzzle**
- **Five weight classes.** A pour sinks past lighter layers. It may come to rest only on its own colour or on something heavier.
- Sealing at 4 units, with the cork sliding in after the pour finishes.
- Murky units, odd flasks (3/5) from 31, corks from 45, foam from 61, mercury from 91.
- Solver (weighted A\*, aware of corks and the pipette), generator, and difficulty score and curve.
- Tags: Breather, Tricky, Masterpiece.

**Power-ups and help**
- Spare Flask, Lamp, Pipette, Centrifuge.
  - Bought with coins or a rewarded ad, through forge's buy card and ad budget.
  - 3 free uses on unlock.
  - Pipette and Centrifuge cap the level at ★★.
  - A Centrifuge that wouldn't change anything is refused, so it isn't wasted.
- Undo, hint (worker solver), restart, easier version, stuck panel with the rescue ad.
- **Pre-level boost:** before Tricky levels, start with a Spare Flask.

**Density Towers**
- 40 towers in 5 collections, opened by stars (0 / 60 / 150 / 250 / 360).
- Level liquids are drawn from the tower's unfilled layers, and each sealed flask pours into the tower.
- **Catch-up pour:** at the end of each level, one unfilled layer whose weight wasn't in the level gets a free pour, so rare foam and mercury layers don't stall a tower.
- Tower and collection rewards, Encore towers.

**Look**
- **Liquid shader:**
  - glass with a rounded inside, rim and highlights
  - a look per weight: bubbly foam, iridescent oil, clear water, glossy syrup, metallic mercury, cloudy murky
  - cylindrical shading, wobble, cork, selection and hint glow, colour-blind symbols
- **Animations:** pour (tilt, stream, grow and shrink), droplets that sink through lighter layers, centrifuge spin, pipette drop.

**Shop, Daily, settings**
- **Shop:** glassware, benches, pour effects (forge shop). Opens after level 20.
- **Daily Brew:** streak, calendar, 7-day bonus, share text (forge daily card). Opens after level 20.
- **Settings:**
  - sound, vibration, music (generated "lab" song), colour-blind
  - 10 languages (en, es, pt, fr, de, it, ru, tr, id, ja)
  - the daily reminder (app only)
- **Layout:** phone portrait, a side panel on wide screens, board framing that keeps clear of the HUD.

**Portals:** all 7 drivers through forge, within the size budget.

**Phone app** (see APP.md)
- Capacitor 8 project in `android/` (`com.quarkade.density`): portrait, AdMob test App ID, notification and billing permissions.
- In-app purchases (7 `density_*` products) and the opt-in Daily Brew reminder.
- Both run on forge's new shared `forge/src/app/app-extras.ts`, which Knotwork now uses too.

**Store kit** (see STORE.md)
- Listing text, the name check, and the assets each portal asks for.
- Press art in `press/`: covers, portrait, square, icon, and screenshots (default, colour-blind, Space Station bench).
- Privacy policy template in `legal/privacy.html`.

**Economy** (checked with `simulate.ts` over 400 levels)
- About 24–34 coins per level, so a power-up every 6–8.5 levels.
- A tower takes about 9 levels (7–15).
- Collections open around levels 22–32, 54–84, 92–138 and 134–202, depending on the player.

**Checked in the browser:**
- Level 9 won at par.
- A cork level: the cork refuses pours and pops when flasks seal.
- Spare Flask; Pipette draw and drop (the unit sinks correctly); a no-op Centrifuge refused; win capped at ★★.
- Tower completion, then the next tower.
- Shop purchase and equip; Daily Brew win with a streak; switching to Japanese.
- The seal appears only after the pour animation.
- Editor: load, settle, validate and solve.
- Press renders read back and checked.
- Level 3000 (a Masterpiece, 11 flasks, par 40) loads from `pack-5.json`.

**Final checks (2026-11-14):**
- All 6 packs: `dens-v1`, 500 levels each, levels 21–3020 with no gaps.
  - Each pack has 400 Normal, 50 Breather, about 40 Tricky and 8–10 Masterpiece levels.
  - About 300–330 levels per pack have corks.
- `selftest.ts` passes and `tsc` is clean.
- `build-all.ts`: all 8 targets are within budget (0.68 MB initial). Each portal zip is 0.37 MB. The app bundle is synced into `android/` with all 6 packs.

**Cheat protection (2026-11-14):**
- Dev switches (`?level=`, `?coins=`, `?fresh=`, `?def=`, `?gen=`, `?press=`), the test hooks and the editor exist only on the dev server. Production builds were checked to contain none of them, and the address is ignored.
- Saves use forge's tamper check: edited saves are ignored. If one copy was edited, the other is used; if both were, the game starts fresh. This was tested in the production build.
- Old-format saves on the dev servers are discarded once (the games are unreleased, so no players are affected).

## Differences from DESIGN.md
- **Intro levels:** odd flasks, foam and mercury arrive at 31, 61 and 91 instead of 30, 60 and 90, because those are Tricky levels.
- **Murky units reveal when they reach the top of the flask,** not the top of their weight zone. This is simpler and matches Knotwork.
- **The dead-end lever is effectively always zero.** Under Density's rules some legal pour nearly always exists, so difficulty rests on par, size, corks and murky layers.
- **The Pipette's drawn units are selected automatically** for dropping. Tap the tray to deselect.
- **Catch-up pour** for towers (see above). This wasn't in the design; the simulation showed towers stalling on rare weights without it.

## Your steps (can't be done from here)
1. **Name:** decide between keeping "Density" with a subtitle such as "Density: Liquid Sort Lab", or renaming. STORE.md has the check and the list of files to change.
2. **Playtest the difficulty with real players.** Random play almost never gets stuck, so check that later levels still feel like a challenge. Then retune `economy.ts` and the difficulty weights in `generator.ts`.
3. **Portal accounts and IDs:**
   - `VITE_GD_GAME_ID`, `VITE_GM_GAME_ID`
   - CrazyGames "Progress Save" tick
   - YouTube Developer Portal ads
   - GameDistribution rewarded switch
4. **Upload the zips** from `dist/zips/` and run each portal's own QA tool.
5. **Record the CrazyGames videos** (15–20 s, 16:9 and 2:3).
6. **Phone app:**
   - install Android Studio, then build and run on a low-end phone
   - set your AdMob App ID and ad units
   - create the 7 products
   - host the privacy policy
