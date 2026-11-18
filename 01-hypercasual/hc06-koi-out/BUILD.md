# hc06 · Koi Out — Build notes

## Run it
The preview entry is `koi-out` in `D:\personal-dev\.claude\launch.json` (port 5200). From `Quarkade/`:

```bash
node node_modules/vite/bin/vite.js 01-hypercasual/hc06-koi-out --port 5200
```

**Dev-only switches** (stripped from production builds):

| Switch | Effect |
|---|---|
| `?fresh=1` | Wipe the save (on every load, so progress doesn't stick while it's in the URL) |
| `?level=N`, `?coins=N` | Jump ahead |
| `?gen=1` | Generate every level live |
| `?def=…` | Play a level passed in as encoded JSON |
| `?press=1` | Render the store and portal art into `press/` (`src/dev/press.ts`) |
| `/editor.html` | Level editor: edit a pond as JSON, see it drawn, step through the stored order, check and rate it, play it, save it to `levels-edit/` |
| `window.__koi` | Test hooks: `tap(i)`, `solve()`, `power(id)`, `net(i)`, `undo()`, `startLevel(n)`, `showJournal()`, `drain()`, `shot(name, w, h)` |

## Checks

```bash
node 01-hypercasual/hc06-koi-out/tools/selftest.ts
```

```bash
node 01-hypercasual/hc06-koi-out/tools/curve.ts 1 600 23
```

```bash
node 01-hypercasual/hc06-koi-out/tools/simulate.ts 400
```

```bash
node forge/tools/build-all.ts 01-hypercasual/hc06-koi-out
```

| Tool | What it does |
|---|---|
| `selftest.ts` | Rules on tiny ponds (fry and long koi swimming out, blocking, a koi's own body, lily pads, reeds, frogs, currents, whirlpools, hearts, Net, Bread), the solver, and the generator (stored orders free every koi with no heart lost, intro levels bring their twist, the Daily, determinism) |
| `curve.ts` | Prints pond size, koi, cells covered, long-koi share, koi free at the start, waiting depth, look-alikes, D and twists across a range |
| `simulate.ts` | Coins and journal pacing over the real levels for 3 player types |
| `build-packs.ts` | Tutorial (`tutorial`) and packs (`packs 1 <index>`; run the six as parallel jobs) |

## Levels
| Levels | Source |
|---|---|
| 1–3 | Hand-made in `tools/build-packs.ts`: three free fry; one fry blocking another; a chain of three |
| 4–20 | Generated with the tutorial band (2-cell koi from 4, lily pads at 12, 3-cell koi from 16) |
| 21–3020 | `public/packs/pack-0..5.json` (generator `koi-v1`), every stored order replayed before writing, about 0.38 MB per pack |
| 3021+ | Generated in the Web Worker |
| Daily Pond | `generateDaily(UTC date)` in the worker |

**How a level is made (solvable by construction, `logic/generator.ts`):**
1. **Twists first:** lily pads, frogs (with counts), currents, whirlpool cells, and runs of reeds along the bank.
2. **Cut the pond into koi:** leave a few cells as open water, then grow snake paths (1 to the band's longest, mostly straight with bends), growing from either end when one end is boxed in.
3. **Peel:** again and again, find the koi that could swim out now (trying either end as its head, or all four ways for fry), pick one, fix its head that way, and take it out.
   - With the band's "waiting" bias, the pick is the koi whose way out runs through the most cells of koi already taken out, so at the start it has to wait for them.
   - Long koi go early, before they're boxed in.
   - Whirlpool fry get the start direction that turns into their way out after the koi before them leave.
   - If nothing can leave, the longest koi left is split in two, and peeling carries on.
4. **The peel order is the stored solution.** It's replayed with the real rules (twists included) before a level is accepted, and with whirlpools the solver also checks a full order exists.
5. **Rate:** koi, cells, long-koi share, koi free at the start, waiting depth (the longest chain of koi waiting on each other) and look-alikes.

**Solver** (`logic/solver.ts`): freeing a koi never blocks another, so without whirlpools any free koi is a safe next tap. Whirlpools can strand a fry facing a wall, so the solver searches (depth-first, with memo) for a full order. It powers Hint, which prefers the stored order.

## Status: v1.0 (built 2026-11-19)

**Done:**
- **Rules** (`logic/rules.ts`):
  - koi lie along cell paths with the head first, and swim straight out from the head
  - currents turn them; lily pads, frogs (until their count), reeds and other koi block
  - a koi's own body only blocks where it hasn't swum clear yet
  - whirlpool fry turn a quarter each time another koi leaves
  - hearts, the Net and Bread
- **Hearts:** 3 per level, shown in the HUD with Lotus hearts on top.
  - Out of hearts: a rewarded +1 heart (2 per level, outside the normal ad cap), a Lotus from the inventory, or try again.
  - Undo puts koi back but never hearts.
- **Power-ups:**
  - ✨ Glow: free koi shine
  - 🪷 Lotus: +1 heart
  - 🥅 Net: lifts any koi out; caps the level at ★★
  - 🍞 Bread: tap a koi, then tap the way it should face; caps the level at ★★
  - Bought with coins or a rewarded ad.
- **Stars:** by hearts kept, with Lotus hearts as a cushion.
- **View** (`view/pond.ts`, `view/materials.ts`):
  - **Water:** a shader with depth, caustics, dapples, a faint grid and ripple rings. The bank is stones and grass, with reeds on closed stretches.
  - **Koi:** ribbon meshes along their smoothed cell paths, with the head, tail taper, fins and eyes measured in real distance (so long koi keep round heads). Shown in 48 variety patterns (kohaku, sanke, showa, tancho, asagi, utsuri, ginrin, solid and metallic), with a shadow on the water.
  - **Movement:** the tail wiggles at rest. Koi swim out along their bodies and their way out, leaving ripples; a blocked koi swims up to the blocker, bumps (💢) and swims back. The Net lifts a koi out.
  - **Props:** lily pads, frogs with their count, whirlpools and current arrows.
- **Input:** one tap; taps on other koi keep working while one swims. Z undoes and Q/W/E/R use power-ups.
- **The Koi Journal and the journey:**
  - 6 regions × 8 varieties (`data/varieties.ts`), opened by stars (0 / 60 / 150 / 250 / 360 / 480).
  - Every freed koi is a sighting; a level's koi are drawn from the current page's unfinished varieties.
  - A finished page gives the region's pond theme and moves the koi up the river on the journey map.
- **Shop:** pond themes, ripple trails and lily pad styles. **Daily Pond:** streak, calendar, share text.
- **Coach:** level tips, unlock cards, the hand on level 1 (the koi to free next) and on each twist's intro level. How to play is in Settings and on the title screen.
- **App hooks:** `game/app-extras.ts` (7 `koi_*` products and the reminder).
- **Translations:** 10 languages (EN plus es, pt, fr, de, it, ru, tr, id, ja in `src/data/i18n/`), checked for missing keys and placeholders.
- **Level editor** (`/editor.html`): JSON with the real pond view, Step solution, Check + rate (the stored order, the solver, koi free at the start, look-alikes, twists), Play and Save.
- **Press art** (`?press=1`): 12 images in `press/` (covers, portrait, square, landscape, the icon, and 3 store screenshots in the Garden Pond, Moonlit Lake and Bamboo Stream themes), each with a long koi part-way out of a crowded pond.
- **Phone app:** Capacitor project in `android/` (`com.quarkade.koiout`), icon in `resources/icon.png`. See `APP.md`.
- **Store kit:** `STORE.md` (listing, name check, assets per platform, checklist, product IDs) and `legal/privacy.html` (fill in the brackets).

**Economy** (checked with `simulate.ts` over 400 levels):
- 21–28 coins a level, so a power-up every 4–14 levels.
- A journal page takes about 10 levels (5–20).
- Regions are reached around levels 20–40, 56–108, 89–172, 130–241 and 166–323, depending on how many stars the player collects.

**Builds:** all 8 web targets and the app are within budget: 0.70 MB initial (0.72 MB app), 0.60 MB zips. No dev hooks in production.

**Checked in the browser** (390 × 760):
- Level 1 for a new player: the tip and the hand on the koi to free.
- A Tricky level played in its stored order to "Not a bump!", with all 32 koi counted as sightings.
- A blocked tap: the koi bumps and swims back, and a heart is lost.
- Level 106 with long bent koi, a whirlpool fry, a frog and a current.
- The Net, three bumps to the out-of-hearts screen, a Lotus heart, Bread, and the journey and journal screen.
- Level 300 (a Dragon Gate, 58 koi) loads from the shipped pack and plays to the win.

**Polish made while finishing v1.0:**
- Asagi-type koi have fine diamond scales (they read as bricks before), and reeds are thin tufts along the water instead of flat green patches.

## Left after v1.0
- **A playtest of the difficulty and the economy** by real players (`simulate.ts` has a first pass).
- **Portal videos** (CrazyGames asks for 15–20 s clips) and **store screenshots with the real UI**, taken on a phone or emulator.
- **Compile the Android app** in Android Studio (this machine has no JDK or Android SDK).

## Differences from DESIGN.md
- **The generator cuts the pond into koi and peels them** (see Levels), instead of adding koi one at a time in reverse. Adding them one at a time left ponds only about 60% full; peeling fills about 85%.
- **More koi start free than planned:** about a quarter to a third (the design said 1–3). Difficulty comes more from waiting depth (5–14 koi in a chain), pond size and twists.
- **Long koi are 20–45% of the koi**, not every koi past level 30: splitting stuck koi during peeling leaves more short ones.
- **48 varieties** (6 × 8), not 40 plus rare ones; the Dragon Gate page holds the rare ones.
- **Whirlpools only turn fry**, so a long koi's head can never be turned back into its own body.
- **Bread** asks for a tap on the koi, then a tap on the side it should face.
