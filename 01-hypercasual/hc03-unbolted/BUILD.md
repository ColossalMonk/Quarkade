# hc03 · Unbolted — Build notes

**Status: v1.0, complete.** Everything in DESIGN.md is built. What's left are steps only you can do (accounts, uploads, store consoles, a real phone) and a difficulty playtest; see "Your steps" at the end.

## Run it
The preview entry is `unbolted` in `D:\personal-dev\.claude\launch.json` (port 5194). From `Quarkade/`:

```bash
node node_modules/vite/bin/vite.js 01-hypercasual/hc03-unbolted --port 5194
```

**Dev-only switches** (stripped from production builds):

| Switch | Effect |
|---|---|
| `?fresh=1` | Wipe the save |
| `?level=N`, `?coins=N` | Jump ahead |
| `?gen=1` | Generate every level live |
| `?def=…` | Play a level from the editor |
| `?press=1` | Render store art into `press/` (12 images) |
| `/editor.html` | The level editor: edit a level as JSON with a live preview, check it (par, solver, cover, jam rate), load or generate level N, play it, save it |
| `window.__unb` | Test hooks: `tap(i)`, `power(id)`, `box(slot)`, `undo()`, `startLevel(n)`, `showRoom()`, `openCrate(room)`, `drain()` (finish animations when the pane is hidden), `shot(name, w, h)` (board render to `press/`) |

## Checks

```bash
node 01-hypercasual/hc03-unbolted/tools/selftest.ts
```

```bash
node 01-hypercasual/hc03-unbolted/tools/curve.ts 21 700 23
```

```bash
node forge/tools/build-all.ts 01-hypercasual/hc03-unbolted
```

| Tool | What it does |
|---|---|
| `selftest.ts` | The rules on tiny hand-built boards, plus the solver, generator and tutorial |
| `curve.ts` | Prints bolts, layers, cover, swing traps, dead-end rate, par and D across a range of levels |
| `simulate.ts` | Coins and gadget pacing over the real levels for 3 player types |
| `trial.ts` | Quick generator timing on a few levels |
| `build-packs.ts` | Tutorial (`tutorial`) and packs (`packs 6`, or `packs 1 <index>` for one) |

**What `selftest.ts` covers:**
- the swing: rest angle from the centre of mass
- covering, and a swing clearing it
- boxes, the tray, closing and pulling from the tray
- jams and the Extra Slot
- padlocks, chains, long bolts, rusty bolts
- Drill and Magnet
- the solver
- generator intro levels (hinge 12, padlock 45, chain 61, long bolt 91) and the Daily Teardown
- all 20 tutorial levels

## Levels
| Levels | Source |
|---|---|
| 1–4 | Hand-made in `tools/build-packs.ts`: first tap, two colours, covering, the swing |
| 5–20 | Generated with gentle tutorial settings (the tray at 6–7, hinges at 12, rusty bolts at 15) |
| 21–3020 | `public/packs/pack-0..5.json` (generator `unb-v1`), from `node tools/build-packs.ts packs 1 <index>`, one job per pack in parallel (about 5 minutes on 12 cores). Every level is replayed by the sensible player (or the solver) before it is written |
| 3021+ | Generated in the Web Worker |
| Daily Teardown | `generateDaily(UTC date)` in the worker |

**How a level is made (solvable by construction):**
1. Plates go down bottom layer first. Each upper plate is aimed at bolts already placed below it.
2. Plates are drilled only where they have fixings. That's how they cover bolts underneath.
3. A random but valid removal order is walked with the real rules (swings included).
4. Colours follow that order with a planned tray load: some bolts are given to boxes further down the queue, so they must wait in the tray.
5. Padlocks are set to a colour whose box closes before the plate's first bolt is needed. Then rusty bolts and glass are added.
6. **Par** is the number of detours made by a "sensible player". It only sees visible bolts, takes box moves first, and prefers bolts that uncover the most.
   - The full-information solver, which can see under plates, also has to solve the level. Its count is stored as `optimal` in the reports.
   - ★★★ therefore means "as tidy as a careful human", not a perfect one.

## What's in v1.0

**Done:**
- **Rules** (`logic/rules.ts`):
  - plates in layers
  - an exact swing (a plate hangs with its centre of mass under its single fixing; with none, it drops)
  - covering, using the same signed distance shapes (SDFs) the shader draws
  - 2 open toolboxes with a fixed queue, and a 5-slot tray
  - jams
  - hinge pins, rusty bolts, glass, padlocks, chains, long bolts
- **Power-ups:** Extra Slot (max 2 per level), Oil Can, Drill, Magnet.
  - Bought with coins or a rewarded ad, through forge's buy card and ad budget.
  - Drill and Magnet cap the level at ★★.
- **Solver** (minimum detours, 0-1 search with quiet moves taken straight away) for hints and checks. **Generator** with bands, intro levels, rhythm tags, D score and percentile pick.
- **View** (`view/workshop.ts`):
  - SDF plate shader: painted steel, copper, plywood or candy acrylic, with bevel, shadow, countersunk holes, glass and a padlock that opens
  - bolt shader: hex head, coloured cap, cross slot, rust crust, colour-blind symbol, hint glow
  - pegboard shader
  - chain links
  - the camera frames the level's plates
- **Animations:**
  - the screwdriver twists the bolt out
  - the bolt flies to its box or the tray
  - plates swing on a damped spring about the real pivot, or tumble away
  - the toolbox lid closes and the next box pops in
  - a closed box sends a bolt to the gadget
- **Gadgets:** 40 blueprints in 5 rooms, each about 70–100 bolts.
  - Parts fill in as their colour's boxes close.
  - A catch-up bolt is added each level.
  - A finished gadget comes to life (spinning wheels, bobbing, swinging or blinking).
- **Workshop rooms:** 5 rooms, opened by stars, each with 8 shelf places and 8 decor spots (lamp, rug, poster, radio, plant, stool, window, sign), 3 styles each.
  - A Decor Crate per finished gadget offers a pick of 2 styles.
  - Coins restyle a spot (250).
  - A finished room lights its OPEN sign and gives a screwdriver skin.
- **Shop:** screwdrivers, plate finishes, pegboards (forge shop). **Daily Teardown:** streak, calendar, share text (forge daily card).
- **Settings:** sound, vibration, music ("workshop" song), colour-blind symbols, and **10 languages** (en, es, pt, fr, de, it, ru, tr, id, ja) with a picker.
- **Phone app** (see APP.md): Capacitor 8 project in `android/` (`com.quarkade.unbolted`: portrait, AdMob test App ID, notification and billing permissions), 7 `unbolted_*` products and the Daily Teardown reminder on forge's shared app code.
- **Store kit** (see STORE.md): listing text, name check and subtitle, the assets each portal asks for (12 images in `press/`), product ids, privacy policy template in `legal/privacy.html`.
- **Level editor** (`/editor.html`) and **press art** (`?press=1`).
- **Economy** (checked with `simulate.ts` over 400 levels): 26–36 coins a level, so a power-up every 6–8 levels. A gadget takes about 12 levels (7–18; the first is done around level 15). Rooms open around levels 22–32, 54–84, 92–138 and 134–202.
- **Packs:** 6 × 500 levels (21–3020), on average 30–34 bolts and a par of 2–3 detours per level, up to 15–18 on Masterpieces.
- **Save:** forge's tamper-checked `SaveSlot` (key `unbolted`).

**Checked in the browser:**
- Level editor: load, preview and check. Press art: all 12 renders checked by eye.
- Level 33 played to "Level complete!"; closed boxes tightened gadget bolts.
- Level 4: taking the top bolt swings the bar clear, as designed.
- Extra Slot, Drill (a covered bolt), Magnet (pulled 3 and closed the box), undo.
- A gadget completion led to "Gadget restored!", then a Decor Crate (2 choices), the style placed, and the Workshop room opened.
- A fully finished Garage room, with its lit OPEN sign and all decor.
- Shop purchase; the Daily Teardown built in the worker.
- Phone layout at 375 × 812 and the wide desktop layout.

## Your steps (can't be done from here)
1. **Playtest the difficulty with real players.** Mid levels (60–250) are often gentle: random play rarely jams there. Tough levels (Tricky, Masterpiece, 250+) do get hard. Retune the bands and percentile in `generator.ts`, then rebuild the packs.
2. **Portal accounts and IDs:**
   - `VITE_GD_GAME_ID`, `VITE_GM_GAME_ID`
   - CrazyGames "Progress Save" tick
   - YouTube Developer Portal ads
   - GameDistribution rewarded switch
3. **Upload the zips** from `dist/zips/` and run each portal's own QA tool.
4. **Record the CrazyGames videos** (15–20 s, 16:9 and 2:3). The swing is the moment to show.
5. **Phone app:**
   - install Android Studio, then build and run on a low-end phone
   - set your AdMob App ID and ad units
   - create the 7 products
   - host the privacy policy
6. **Trademark search** for "Unbolted" before the app-store launch.

**Polish ideas (not in the design's must-haves):**
- The design's blurred room behind the pegboard (the pegboard fills the view instead).
- Bolt chips pulled from the tray could fly into the new box (now they just appear).

## Onboarding (forge coach, 2026-11-17)
- **Tips:** level tips wait in a queue and show one at a time on a card. They never appear behind the title screen or a window, and a tap dismisses them.
- **Pointing hand:** on level 1 the hand points at the first move. On each twist's intro level it points at the new thing on the board.
- **Power-up unlocks:** each one gets a card (what it does, 3 free uses), then its button pulses.
- **How to play:** in Settings and on the title screen. It lists the basics and the twists met so far (from the level tips) and the power-ups unlocked so far.

## Differences from DESIGN.md
- **Par comes from a sensible, visible-information player,** not the full-information solver. The solver sees colours under opaque plates, which players can't, so its par would be unfair.
- **Plates are drilled only where they have fixings.** With every hole cut, bolts on the grid showed through empty holes and almost nothing was covered.
- **When a plate swings so an empty hole lands over a lower bolt, that bolt can be seen and tapped through the hole.** This follows from the rule above, and the drawing and the rules agree.
- **The tray is 4 on every Tricky level from 60,** on some Masterpieces, and on 30% of normal levels after 250.
- **Gadgets need 30–44 bolts each** (tuned with `simulate.ts`), since only a gadget's own colours count and a level closes about 10 boxes.
