# hc05 · Aisle Nine — Build notes

## Run it
The preview entry is `aisle-nine` in `D:\personal-dev\.claude\launch.json` (port 5198). From `Quarkade/`:

```bash
node node_modules/vite/bin/vite.js 01-hypercasual/hc05-aisle-nine --port 5198
```

**Dev-only switches** (stripped from production builds):

| Switch | Effect |
|---|---|
| `?fresh=1` | Wipe the save |
| `?level=N`, `?coins=N` | Jump ahead |
| `?gen=1` | Generate every level live |
| `?def=…` | Play a level passed in as encoded JSON |
| `?press=1` | Render the store and portal art into `press/` (`src/dev/press.ts`) |
| `/editor.html` | Level editor: edit a level as JSON, see it on the stand, step through the stored solution, check and rate it, play it, save it to `levels-edit/` |
| `window.__aisle` | Test hooks: `tap(shelf, spot)`, `move(move)`, `solve()`, `power(id)`, `assistant(kind)`, `undo()`, `startLevel(n)`, `showStreet()`, `drain()`, `shot(name, w, h)` |

## Checks

```bash
node 01-hypercasual/hc05-aisle-nine/tools/selftest.ts
```

```bash
node 01-hypercasual/hc05-aisle-nine/tools/sweep.ts 21 1200 13
```

```bash
node 01-hypercasual/hc05-aisle-nine/tools/curve.ts 21 600 23
```

```bash
node 01-hypercasual/hc05-aisle-nine/tools/simulate.ts 400
```

```bash
node forge/tools/build-all.ts 01-hypercasual/hc05-aisle-nine
```

| Tool | What it does |
|---|---|
| `selftest.ts` | Rules on tiny stands (moves, sales, back stock, a refilled triple selling at once, reach and turning, Brake, boxes, freezer, cabinet, cart, customers, jams), the solver, and the generator (stored solutions win, intro levels bring their twist, the Daily, determinism) |
| `sweep.ts` | Generates a range of levels and replays each stored solution |
| `curve.ts` | Prints stand size, reach, kinds, goods, back stock, free spots, solution length, sensible-play jam rate, D and twists across a range of levels |
| `simulate.ts` | Coins and Main Street pacing over the real levels for 3 player types |
| `build-packs.ts` | Tutorial (`tutorial`) and packs (`packs 1 <index>`; run the six as parallel jobs) |

## Levels
| Levels | Source |
|---|---|
| 1–3 | Hand-made in `tools/build-packs.ts`, on a still stand: tap a good then a shelf, three alike sell, back stock slides forward |
| 4–20 | Generated with the tutorial band (the stand turns from level 4, boxes at 12) |
| 21–3020 | `public/packs/pack-0..5.json` (generator `aisle-v1`), every stored solution replayed before writing |
| 3021+ | Generated in the Web Worker |
| Daily Restock | `generateDaily(UTC date)` in the worker |

**How a level is made (solvable by construction, `logic/generator.ts`):** play **backwards** from an empty stand.
1. **Stand:** units (4–6), shelves per unit (1–3), 2 units in reach, turn direction.
2. **Plan:** the triples of each kind, customers' goods, and the freezer and cabinet shelves (chosen up front).
3. **Reverse steps**, each undoing a forward event, with the stand turning back one step each time:
   - **un-sell:** a triple goes back on an empty (or just-restocked) shelf in reach, and one of its goods moves back to another shelf in reach
   - **un-move:** a good moves between two shelves in reach
   - **un-restock:** a full front row goes back into back stock, or into the restock cart
   - **un-serve:** a customer's good goes back on a shelf
   - Freezers and cabinets are kept off until (in forward time) enough triples, or a triple of the key good, have been sold.
   - The last triple is held for the very end, so the forward game opens with a sale.
4. **The reverse steps, played forwards, are the stored solution.** It's replayed with the real rules (twists included) before a level is accepted. Boxes are added only where a neighbour sells before the box's shelf is needed.
5. **Rejected:** too many turn-only steps (> 20%), or a solution longer than about 3 moves per triple.
6. **Rate:** "sensible play" (a greedy player who sees one move ahead, 6 runs) gives the jam rate. D combines goods, kinds, reach, back stock, free spots, jam rate and twists.

**Par** is the stored solution's length. A beam-search solver (`logic/solver.ts`) powers Hint and Restack; at generation it never found a shorter solution than the backwards play, so it isn't used for par.

## Status: v1.0 (built 2026-11-17)

**Done:**
- **Rules** (`logic/rules.ts`): front rows of 3, back stock, reach and the turn after every move, the turn button, Brake, the basket, boxes, freezers, the glass cabinet and its key good, the restock cart, customers, jams, and the Shop Assistant's sale.
- **Power-ups:** Brake (5 moves still), Basket (2 spots on the counter), Restack (re-deals the open shelves, checked by the solver in the worker) and Shop Assistant (sells a triple from anywhere, back stock included).
  - Bought with coins or a rewarded ad. Restack and the Shop Assistant cap the level at ★★.
- **Stars:** moves (goods moved, customers served and turn presses) against par. ★★ up to par + max(3, 15%). Undo is free and never lowers the move count.
- **View** (`view/stand.ts`, `view/goods3d.ts`):
  - the first Quarkade game with a perspective camera and 3D models: 48 low-poly goods built from three.js primitives, with vertex colours
  - the turning stand (pole, base, crown, shelf units), dimmed back stock or "?" crates, shelves out of reach shaded, shelves that can take the picked-up good glowing
  - cardboard boxes, frosted freezers with a counter, glass cabinets with a padlock, 🔑 tags on the key goods
  - animations: the good flies in an arc, triples pop with the equipped bag and sparkles, back stock slides forward, the stand turns
- **HUD:** the stand map (every unit around the stand, the front arc lit, the turn direction), the Turn button, the basket, the cart queue and the customer's order.
- **Input:** tap a good then a shelf (or the basket or customer); dragging from a good to a shelf works too. Space turns, Z undoes, Q/W/E/R use power-ups.
- **Main Street:** 6 shops × 8 displays (`data/shops.ts`), opened by stars (0 / 60 / 150 / 250 / 360 / 480). Every triple sold ticks a crate on the current display; level goods are drawn from what it still needs. A finished shop gives its store theme.
- **Shop:** stands, awnings, bags and the shop themes. **Daily Restock:** streak, calendar, share text.
- **Coach:** level tips, unlock cards, the hand on level 1 (the good, then its shelf) and on each twist's intro level. How to play is in Settings and on the title screen.
- **App hooks:** `game/app-extras.ts` (7 `aisle_*` products and the reminder).
- **Translations:** 10 languages (EN plus es, pt, fr, de, it, ru, tr, id, ja in `src/data/i18n/`), checked for missing keys and placeholders.
- **Level editor** (`/editor.html`): JSON with the real stand view, Step solution, Check + rate (stored solution, beam search, sensible-play jam rate, twists), Play and Save.
- **Press art** (`?press=1`): 12 images in `press/` (covers, portrait, square, landscape, the icon, and 3 store screenshots in the grocery, sweet shop and bookshop themes). Each shows a good lifted on its way to a shelf holding two of it, with sparkles.
- **Phone app:** Capacitor project in `android/` (`com.quarkade.aislenine`), icon in `resources/icon.png`. See `APP.md`.
- **Store kit:** `STORE.md` (listing, name check, assets per platform, checklist, product IDs) and `legal/privacy.html` (fill in the brackets).

**Economy** (checked with `simulate.ts` over 400 levels):
- 19–28 coins a level, so a power-up every 5–10 levels.
- A display takes about 9.5 levels (5–15).
- New shops start around levels 71, 143, 225, 307 and 384 for a player at par (later for a struggling one).

**Builds:** all 8 web targets and the app are within budget: 0.75 MB initial (0.78 MB app), 0.64 MB zips. No dev hooks in production.

**Checked in the browser** (390 × 760 and desktop):
- Level 1 by taps: both sales and "Perfect shift!" at par 2.
- A turning level with a box played to the win at par, with the display card ticking on the win screen.
- Level 91: the customer and its order, the coach's hand on it.
- Brake held the stand, the basket took a good, the Hint picked up the right good, Restack re-dealt the shelves, the Shop Assistant sold a triple, and the stars capped.
- The wide layout with Main Street in the side panel, and the Main Street screen.
- A move that jams the stand shows the jam screen (Undo, a free Basket, Restart).
- Level 300 (a Grand Opening) loads from the shipped pack and plays to the win at par.

**Polish made while finishing v1.0:**
- Back stock is faded (lighter and smaller, further back) instead of darkened, so it never looks spoiled through an empty front spot.

## Left after v1.0
- **A playtest of the difficulty and the economy** by real players (`simulate.ts` has a first pass).
- **Portal videos** (CrazyGames asks for 15–20 s clips) and **store screenshots with the real UI**, taken on a phone or emulator.
- **Compile the Android app** in Android Studio (this machine has no JDK or Android SDK).

## Differences from DESIGN.md
- **Portrait-friendly stands:** 4–6 units with 2–3 shelves each and 2 units in reach, instead of 3–10 units with 3 in reach. A wide one-row ring was a thin band on a phone screen, and 3 units in reach made the goods about 25 px wide on a 390 px phone. Late levels grow with back stock, kinds and twists, not more units. (`reachFor` still gives 3 for 7+ units, if bigger stands come back for desktop.)
- **Grand Opening** is a 3-shelf stand with up to 4 more triples, not two stands.
- **The key** is a whole triple of goods with 🔑 tags (the first triple of that good sold opens the cabinets).
- **Freezer counters** run 2–6.
- **Displays count crates** (triples), not single goods.
- **The easier version** (after 3 restarts) starts with a Basket instead of one more free spot.
- **The colour-blind setting isn't offered:** goods differ by shape.
