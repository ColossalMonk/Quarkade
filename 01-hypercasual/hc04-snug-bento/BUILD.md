# hc04 · Snug Bento — Build notes

## Run it
The preview entry is `snug-bento` in `D:\personal-dev\.claude\launch.json` (port 5196). From `Quarkade/`:

```bash
node node_modules/vite/bin/vite.js 01-hypercasual/hc04-snug-bento --port 5196
```

**Dev-only switches** (stripped from production builds):

| Switch | Effect |
|---|---|
| `?fresh=1` | Wipe the save |
| `?level=N`, `?coins=N` | Jump ahead |
| `?gen=1` | Generate every level live |
| `?def=…` | Play a level passed in as encoded JSON |
| `?press=1` | Render the store and portal art into `press/` (`src/dev/press.ts`) |
| `/editor.html` | Level editor: edit a level as JSON, see it drawn, check it with the solver, play it, save it to `levels-edit/` |
| `window.__snug` | Test hooks: `place(i, placement)`, `solvePiece(i)`, `tapPiece(i)`, `power(id)`, `knife(i)`, `undo()`, `startLevel(n)`, `showCafe()`, `drain()`, `shot(name, w, h)` |

## Checks

```bash
node 01-hypercasual/hc04-snug-bento/tools/selftest.ts
```

```bash
node 01-hypercasual/hc04-snug-bento/tools/sweep.ts 21 1200 10
```

```bash
node 01-hypercasual/hc04-snug-bento/tools/curve.ts 21 700 29
```

```bash
node 01-hypercasual/hc04-snug-bento/tools/simulate.ts 400
```

```bash
node forge/tools/build-all.ts 01-hypercasual/hc04-snug-bento
```

| Tool | What it does |
|---|---|
| `selftest.ts` | Rules on tiny boxes (placing, garnish, rotation, dividers, soft shapes, hot/cold, sauce), the solver (counting tilings once, dead ends, solving from a half-filled box), the generator (solutions play out, intro levels bring their twist), and the tutorial |
| `sweep.ts` | Generates a range of levels and replays each stored solution |
| `curve.ts` | Prints box size, pieces, big shapes, solution count, search effort, D and twists across a range of levels |
| `simulate.ts` | Coins and recipe pacing over the real levels for 3 player types |
| `build-packs.ts` | Tutorial (`tutorial`) and packs (`packs 1 <index>`; run the six as parallel jobs) |

## Levels
| Levels | Source |
|---|---|
| 1–3 | Hand-made in `tools/build-packs.ts`: drag, fill every gap, rotate |
| 4–20 | Generated with the gentle tutorial band (garnish at 12, dividers at 15) |
| 21–3020 | `public/packs/pack-0..5.json` (generator `snug-v1`), built and checked: about 12–14 pieces per level, about 0.45 MB per pack. About 10 minutes with one job per pack |
| 3021+ | Generated in the Web Worker |
| Daily Bento | `generateDaily(UTC date)` in the worker |

**How a level is made (solvable by construction):**
1. **Box:** a rectangle or an odd shape (L, round corners, heart, two-tier), plus dividers and garnish.
2. **Cut** the free cells into connected pieces of 1–6 cells.
   - A piece never takes in a cell with a divider between it and a cell already in the piece.
   - Most stray single cells merge into a neighbour; up to two stay, as tomatoes or sauce cups.
3. **Hand the pieces over turned at random.** The cut itself is the stored solution.
4. **Twists that agree with the cut:**
   - Soft foods get a second shape of the same size.
   - Hot and cold pieces are chosen so they never touch in the cut.
   - A sauce cup is a one-cell piece next to its food (split off a bigger piece if needed).
5. **Rate** with the solver: solutions up to 200 and search effort. More pieces, big shapes, fewer solutions and twists make a higher D.

**Solver:** it always fills the first empty cell (reading order) with every unplaced piece and orientation that fits there.
- Interchangeable pieces are used in index order, so each tiling is counted once.
- Hot/cold is checked as pieces go in, sauce cups at the end.
- It works from the current board, so Peek, Hint, Chopsticks and Tidy Up agree with what's on screen.

## Status: v1.0 (built 2026-11-17)

**Done:**
- **Rules** (`logic/rules.ts`):
  - placing inside the box on empty cells, never over garnish or across a divider
  - rotating (also in the box when it still fits) and soft-food shapes
  - hot/cold and sauce checks; the win needs a full box with no rule broken
- **Power-ups:** Peek (shows one piece's spot), Chopsticks (places one and locks it), Knife (cuts a piece into two that still fit; par +1) and Tidy Up (sends back pieces until the box can be finished).
  - Bought with coins or a rewarded ad.
  - Chopsticks, Knife and Tidy Up cap the level at ★★.
  - Peek, Chopsticks and Tidy Up aren't spent when they wouldn't help.
- **Stars:** moves (every placement, re-places included) against par (the number of pieces). Undo is free and unlimited but never lowers the move count.
- **View** (`view/bento.ts`, `view/materials.ts`):
  - one food shader: rice, omelette, octopus sausage, fried foods, broccoli, glossy tomato and carrot, edamame, salmon, jelly and mochi, berries, gyoza, onigiri, noodles, maki and sauce cups, with hot and cold badges
  - a box shader: wood or lacquer walls, floor grid, grass dividers, pickled-plum garnish
  - table mats and the lid with its tie
- **Input:** drag with a snapped ghost (green fits, red doesn't), with a lift above the finger on touch.
  - A tap turns a piece; a tap squishes a soft food and a hold turns it.
  - Right-click turns a piece on desktop.
  - A piece dropped where it doesn't fit goes back to the tray.
- **Win:** the lid slides on and taps shut (a bell on a perfect box). Every packed food ticks the recipe card.
- **Recipes and café:** 40 recipes in 5 menus (opened by stars). The recipe card is in the HUD, and the café shows the card and the menu board. A finished menu gives a box style.
- **Shop:** boxes, lid wraps and table mats. **Daily Bento:** streak, calendar, share text.
- **Coach** (forge): level tips, unlock cards, and the hand on level 1 (it points at the piece, then at its spot while you drag) and on each twist's intro level. How to play is in Settings and on the title screen.
- **App hooks:** `game/app-extras.ts` (7 `bento_*` products and the reminder).
- **Translations:** 10 languages (EN plus es, pt, fr, de, it, ru, tr, id, ja in `src/data/i18n/`), checked for missing keys and placeholders. Screen-reader labels on the icon buttons follow the language.
- **Level editor** (`/editor.html`): JSON with a `_rows` mask, live preview with the real bento view, Show solution, Check + rate (stored solution, solver count and effort, twists), Play and Save.
- **Press art** (`?press=1`): 12 images in `press/` (covers, portrait, square, landscape, the icon, and 3 store screenshots).
- **Phone app:** Capacitor project in `android/` (`com.quarkade.snugbento`), icon in `resources/icon.png`. See `APP.md`.
- **Store kit:** `STORE.md` (listing, name check, assets per platform, checklist, product IDs) and `legal/privacy.html` (fill in the brackets).

**Economy** (checked with `simulate.ts` over 400 levels):
- 20–29 coins a level, so a power-up every 6–9 levels.
- A recipe takes about 11 levels (5–18).
- Menus open around levels 22–32, 54–84, 92–138 and 134–202.
- **Tuning that got there:**
  - Recipes ask for at most 1 sauce cup and 2 of a soft food (rare pieces).
  - Two catch-up ticks per level.
  - No bonus coin for foods a recipe doesn't need (a level has 12+ pieces).

**Builds:** all 8 web targets and the app are within budget: 0.70 MB initial (0.73 MB app), 0.48 MB zips. No dev hooks in production.

**Checked in the browser:**
- A level played by real pointer drags and taps: 9 of 9 pieces snapped exactly where aimed, "Perfect box!" at par, and the lid and recipe ticks worked.
- Peek, Chopsticks, Knife (par 6 → 7), and Tidy Up (correctly not spent when the box could still be finished).
- First launch at 375 × 812: the tip waits for the title screen, and the hand moves from the piece to its exact target cell while dragging.
- Level 300 (a Masterpiece: 7 × 9 box, 17 pieces) loads from the shipped pack, and the pre-level boost offer appears.

**Polish made while finishing v1.0:**
- A level's foods vary more: a food appears at most twice while others fit.
- Rice and onigiri show grains, and every piece has a darker outline, so neighbouring pieces read as separate foods.
- **Fixed:** the box was pushed toward the bigger HUD bar instead of being centred between the bars.

## Left after v1.0
- **A playtest of the difficulty** by real players. Packing levels have many solutions (often 200+), so difficulty rests on piece count, big shapes and the food rules.
- **Portal videos** (CrazyGames asks for 15–20 s clips) and **store screenshots with the real UI**, taken on a phone or emulator.
- **Compile the Android app** in Android Studio (this machine has no JDK or Android SDK).

## Differences from DESIGN.md
- **Moves count every placement, and undo doesn't lower the count.** With free, unlimited undo, a refund would make ★★★ automatic.
- **Hint and Peek do the same thing:** Hint is the free daily one, Peek the power-up.
- **The colour-blind setting isn't offered.** Foods are told apart by pattern, and hot and cold have badges.
