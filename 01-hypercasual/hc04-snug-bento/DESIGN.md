# hc04 · Snug Bento — Design

> Status: **Approved** (2026-11-17). **v1.0 built** (2026-11-17): see `BUILD.md`. Build order: **4th**. Effort: **M** (the catalog said S; the solver, drag controls and food shader make it M). Name: **Snug Bento** (catalog working title "Bento Snug"; see Decisions made).
> Route: **Open**. CrazyGames first, then Playgama, GameDistribution, GamePix, GameMonetize and YouTube Playables.
> Built on **forge**:
> - portal drivers and tamper-checked saves
> - the UI shell (shop, Daily, settings, buy card)
> - the coach (tips, unlock cards, pointing hand, How to play)
> - press art, editor, zips and the Capacitor app shell

---

## 1. Concept

**The game in one line:** Drag cute food pieces into a bento box until every gap is filled. When the last piece clicks in, the lid slides shut.

**Thumbnail idea:**
- A top-down wooden bento box, almost full: rice with a pickled plum, a rolled omelette, two octopus sausages, broccoli, a tomato.
- One piece (a karaage chicken L-shape) hovers just above its exact gap, with a soft glow around the gap.
- Chopsticks rest on the side. Warm, cosy light; no text.

**What it should feel like:**
1. **"Snug!"** The click of a piece seating perfectly, a little squish, and the lid closing on a full box. This is the satisfying-packing feeling from organising videos.
2. **Calm.** No timers, no fail state, just fitting things together. Undo is free.
3. **A little café of your own.** Every packed box serves a recipe, and finished recipes fill the menu board of a café you're running.

**Trend it rides:**
- Packing and organising videos (lunchbox packing, "satisfying restock" content).
- **Bento puzzles are a growing niche:** Bento Blocks (Steam, Jan 2026), Bento Stack, Bento Rush and Fill Lunch Box (iOS, 2026), plus the older inbento and Neko Bento.

**How it differs from what already exists:**
- **Food that behaves like food:** the twists come from the food itself.
  - **Soft foods squish:** onigiri and dumplings have two shapes, and a tap switches between them.
  - **Hot and cold must not touch:** keep the jelly away from the fried chicken.
  - **Sauce cups** must sit next to the food they go with.
  - Most bento puzzles are plain polyomino packing.
- **Free and in the browser on the big portals.** The strongest bento puzzles are paid (Steam, inbento) or mobile-only, and no proper one is on CrazyGames or Poki.
- **Tidy scoring:** stars reward placing each piece once (no take-backs), against par = the number of pieces.
- **A café meta** where packed foods fill recipe cards, instead of a plain level list.

**Length:** a level takes 20–60 s. A session is 8–12 levels (5–10 min). A recipe card takes about 10 levels.

---

## 2. Art assets

**Visual approach:** everything is drawn in code in a 2D orthographic three.js scene, as in Density and Unbolted.

| Element | How it's made |
|---|---|
| **Food pieces** | One quad per piece. A food shader draws the piece as a soft rounded union of its cells (an SDF) with a texture per food: rice grains, omelette swirl, broccoli bumps, sausage with octopus legs, glossy karaage, tomato highlight, nori stripe on onigiri, edamame pods, and so on. A soft shadow and a slight squash-and-stretch when it lands |
| **Bento box** | A shader: wood grain or lacquer, rounded walls with a highlight, a faint cell grid inside. Box shapes come from the level's cell mask (rectangles, L-shapes, hearts, two compartments) |
| **Dividers** | Green "baran" grass dividers and fixed garnish (pickled plum, lemon slice) drawn by the same food shader |
| **Lid** | A quad that slides on and taps shut, with a ribbon or furoshiki cloth tie per box style |
| **Tray** | The pieces waiting below the box on a bamboo mat |
| **Particles** | Steam puffs on hot food, a sparkle when a box fills, rice-grain confetti |
| **Café board** | Drawn on a canvas: a chalkboard menu with recipe cards, plus a little café counter that fills up as menus are finished |

### Asset list
| Asset | Source | Size |
|---|---|---|
| Food, box and lid shaders | Written in GLSL | Code |
| 24 foods: shape family, colours and texture parameters, with a colour-blind symbol each | `foods.ts` | Code |
| 40 recipes (5 menus × 8): name and foods needed | `recipes.ts` (text data) | ~4 KB |
| UI kit and icons | forge UI plus Kenney (CC0), recoloured in warm wood, red lacquer and cream | ~150 KB |
| Font | Baloo 2 (OFL), already in the repo | ~40 KB |
| Sound and music | WebAudio (forge `Synth`, plus a "café" `SongSpec` for `Music`) | Code |

**Sound:**
- a soft "pat" when a piece seats, pitched by its size
- a wooden "tok" when a piece is rotated
- a squish for soft foods
- a sizzle when hot food is placed and a tiny chime for cold
- the lid sliding and clicking shut, with a bell on a perfect box
- a gentle "nope" wobble when a piece doesn't fit

**Music:** forge `Music` with a light café song (marimba, soft bass, brushes).

**Thumbnails and store art:** `?press=1` renders the hero shot (an almost-full box with one piece hovering) at every portal size.

**Size budget:** about 0.8 MB initial download.

---

## 3. How ads will work

The same forge policy as the other games (`AdBudget`, `interstitialDue`, `buyCard`).

**Interstitial ads:**
- **Shown:** on the level-complete "Next" button.
- **Never shown:**
  - in levels 1–5
  - in the middle of a level
  - after a recipe is completed
  - right after a rewarded ad
- **How often:** every 3+ levels, at least 90 s apart.
- **App "Remove ads":** turns interstitials off.

**Power-ups (coins or one rewarded ad):**

| Item | Coins | One ad gives | Ad limit |
|---|---|---|---|
| 👀 Peek | 100 | 1 | 1 / level |
| 🥢 Chopsticks | 150 | 1 | 1 / level |
| 🔪 Knife | 200 | 1 | 1 / level |
| 🧹 Tidy Up | 300 | 1 | 1 / level, 5 / day |
| Hint | 80 | 1 | 3 / level |

**Other rewarded ads:**

| Placement | What the player gets |
|---|---|
| Peek (the catalog's "reveal where one piece goes") | Shows one piece's spot |
| Pre-level boost | Start a Tricky or Masterpiece level with one piece already placed |
| Double coins | 2× the coins on the win screen |
| Daily retry | Once per day |

**Rules and caps:**
- At most 3 rewarded ads per level and 20 per day.
- Rewarded buttons use 🎬, aren't green, and always sit next to a plain button.

**Free allowance:**
- Undo is free and unlimited, since there is no fail state.
- 3 free uses of each power-up when it unlocks.
- 1 random power-up for each finished recipe.
- A Tidy Up for every 7-day streak.

**Portal SDK events:** gameplay start and stop around each level and each modal. A "happy time" on a perfect box and when a recipe completes. Mute and pause follow the host.

---

## 4. Gameplay and progression

### Controls
- **Drag a piece** from the tray into the box. It snaps to the grid. A ghost shows where it would land: green when it fits, red when it doesn't. Let go on red and it slides back to the tray.
- **Tap a piece** to rotate it 90°. This works in the tray or in the box, if it still fits after turning.
- **Drag a placed piece** back to the tray or to a new spot. A placed piece that is moved counts as a *re-place*.
- **Desktop:** drag with the mouse. Right-click or R rotates the piece under the pointer. Z undoes; Q/W/E/R use power-ups.

### The rules
1. **The box:** a grid of cells, sometimes not rectangular, sometimes with dividers or fixed garnish.
2. **The pieces:** foods made of 1–6 cells. The pieces exactly fill the box: every level has at least one solution, which the generator guarantees.
3. **Placing:** a piece must sit fully inside the box, on empty cells.
4. **The level is won** when every cell is filled. The lid closes.
5. **There's no fail state.** You can always undo, re-place, or use a power-up.

### Specials (each introduced alone, with a tip and the coach's pointing hand)
| Level | Special | What it does |
|---|---|---|
| 3 | **Rotation** | First piece that only fits when turned |
| 12 | **Garnish** | Fixed pieces already in the box (a pickled plum, a lemon slice) |
| 15 | **Dividers** | Grass dividers that split the box into compartments |
| 25 | **Odd boxes** | L-shaped, heart, round-cornered and two-tier boxes |
| 45 | **Soft foods** | Onigiri, dumplings and mochi have two shapes. A tap switches shape instead of rotating. Hold or long-press rotates |
| 61 | **Hot and cold** | A hot food (karaage, gyoza) may not touch a cold one (jelly, fruit) along an edge. Touching pairs glow red, and the box won't close until they're apart |
| 91 | **Sauce cups** | A small sauce cup must touch its food: soy next to sushi, ketchup next to the sausage |

### Power-ups
| Power-up | Unlocks | What it does | Problem it solves | Stars |
|---|---|---|---|---|
| 👀 **Peek** | Level 8 | For 3 s, shows the outline of where one tray piece goes, in a solution that still works with your current placements | "Where does this go?" | None |
| 🥢 **Chopsticks** | Level 15 | Places one piece in its solution spot and locks it | One stubborn piece | Caps the level at ★★ |
| 🔪 **Knife** | Level 25 | Cut one piece into two along a line you choose. Both halves still fit, since the generator only offers cuts that keep a solution | A big awkward piece | Caps the level at ★★ |
| 🧹 **Tidy Up** | Level 40 | Every placed piece that can't be part of any solution goes back to the tray. The rest stay | "Which of my pieces are wrong?" | Caps the level at ★★ |

### Win, stars, coins
- **Placements:** each time a piece is put in the box, including re-places.
- **Par:** the number of pieces (each placed once). Soft-food shape changes and rotations are free.
- **Stars:**
  - ★★★ at par (no re-places)
  - ★★ up to par + 3
  - ★ for finishing
  - Chopsticks, Knife and Tidy Up cap the level at ★★.
- **Coins:** the shared formula (base 6, +3 per star, a difficulty bonus, +25% first try, ×2 Tricky, +100 Masterpiece).

### Progression
- **Recipes and the café (the main goal):**
  - Each recipe card lists foods to pack, for example "Karaage Bento: 6 karaage, 4 rice, 3 tamagoyaki, 3 broccoli".
  - Every food piece in a finished box ticks off one of that food on the current card.
  - Level foods are drawn from the card's unfinished foods, the same trick as quilts, towers and gadgets, so a card takes about 10 levels. A catch-up tick is added each level.
  - A finished recipe goes on the café's menu board, with a little illustration of the dish.
  - **5 menus of 8 recipes:** Home Cooking, Picnic, Festival, Seaside and Space Station. Menus open by total stars (0 / 60 / 150 / 250 / 360).
  - A finished menu gives a **box style** (lacquer, picnic basket, festival tiers, seashell, rocket tin). After all 40, **Encore** orders follow.
- **Shop** (after level 20):
  - Box styles: Pine (default), Red Lacquer, Black Lacquer, Bamboo, Pastel Tin
  - Lid wraps: Plain, Furoshiki, Ribbon, Sticker Seal
  - Table mats: Bamboo, Gingham, Café Counter, Starry Night
- **Daily Bento** (after level 20):
  - The same box for everyone each UTC day. Only Peek, no hints.
  - Streak, a calendar of tiny bentos, share text ("🍱 Daily Bento · ★★★ · 🔥 12"), one rewarded retry a day.

### Tutorial (levels 1–20, hand-made)
Teaching uses forge's coach (tips, the hand on the first move, unlock cards).

| Level | Teaches |
|---|---|
| 1 | Two pieces, a 2×3 box: "Drag a piece into the box" (the hand shows the drag) |
| 2 | Three pieces: filling every gap |
| 3 | Tap to rotate (one piece fits only when turned) |
| 4 | Dragging a placed piece out again |
| 5 | Undo |
| 6 | Stars: "place each piece once for ★★★" |
| 7 | The recipe card: "packed foods fill your recipe (top right)" |
| 8 | Peek unlocks |
| 9–11 | Bigger boxes, 5–7 pieces |
| 12 | Garnish |
| 13–14 | Practice |
| 15 | Dividers, and Chopsticks unlock |
| 16–19 | Practice |
| 20 | First recipe done; shop and Daily open |

---

## 5. Infinite levels and level progression

### What makes up a level
```
Level = {
  box:     a cell mask (W × H up to 8 × 9), with dividers (edges that pieces can't cross), garnish cells
  pieces:  food id, cell list (normalised), soft-alternate shape (if soft), hot/cold/sauce tags
  solution: one placement per piece (kept for Peek, Chopsticks, Knife and Tidy Up, and for checks)
  par, D, tag
}
```

### Generator (solvable by construction)
1. **Box:** pick a shape from the band (a rectangle or an odd shape), then add garnish cells and divider edges.
2. **Partition** the free cells into pieces with a random flood split: grow regions from seeds to target sizes (1–6), and reject slivers.
   - Pieces never cross dividers.
   - Sizes follow the band. More pieces and bigger, odd shapes mean harder levels.
3. **Assign foods** to pieces by shape family. Long 1×3 or 1×4 pieces become sausages or tamagoyaki, 2×2 squares become rice, L and T shapes become karaage or gyoza, single cells become tomato or broccoli. Foods come from the current recipe.
4. **Twists:**
   - Mark soft pieces and give each a second shape. It must also be in some valid tiling; the solver checks this.
   - Tag hot/cold pieces so that no hot touches cold in the generated tiling.
   - Add sauce cups next to their food.
5. **Shuffle** the pieces into the tray with random rotations.
6. **Rate** with the exact-cover solver (dancing links), which counts solutions up to a cap and measures search effort. Fewer solutions and more backtracking make a harder level.

**Solver:** dancing links over (cell, piece) columns, with every rotation (and the soft shape) as rows. Hot/cold and sauce rules are checked as each piece goes in. Boxes are small (≤ 72 cells, ≤ 16 pieces), so this is fast in a worker. It powers Peek, Chopsticks, Tidy Up and Hint (the first piece of any completion of your current board).

### How difficulty increases over time
**Seven levers:**

| # | Lever | Range | What the player feels |
|---|---|---|---|
| 1 | Pieces | 2 → 16 | More to fit |
| 2 | Box size and shape | 2×3 → 8×9; odd shapes, dividers | Awkward spaces |
| 3 | Piece shapes | Mostly 1–3 cells → many 4–6-cell L, S, T and Z shapes | Rotation thinking |
| 4 | **Solution count** | Many → exactly 1 | No easy shortcuts |
| 5 | **Search effort** | Solver backtracks: few → many | Dead ends to back out of |
| 6 | Look-alike pieces | Several pieces with the same footprint in different foods (only one placement each works under hot/cold or sauce rules) | Careful reading |
| 7 | Specials | Garnish, dividers, soft, hot/cold, sauce | Variety and constraints |

**Difficulty score:**
```
D = 0.6·pieces + 0.04·cells + 1.5·bigShapes + 3·(1/solutions) + 2·log10(1 + searchNodes/100) + 1.0·specials
```

**Target curve:** `D_target(n) = 3 + 14·(1 − e^(−n/180))`. It rises fast early and flattens around level 400. The generator picks a percentile of rated candidates.

**Rhythms:**
- **Recipe chapters** of about 10 levels: easy to start, ending on a "Last Dish" Tricky.
- Every 5th level is a Breather, every 10th a Tricky (×2 coins), and every 50th after 150 a Masterpiece (a big two-tier box).

**Timeline:**

| Levels | Pieces | Box | Solutions | New |
|---|---|---|---|---|
| 1–20 | 2–7 | up to 4×5 | many | rotation (3), Peek (8), garnish (12), dividers (15), Chopsticks (15) |
| 21–44 | 6–9 | 5×6 | 3–20 | odd boxes (25), Knife (25), Tidy Up (40) |
| 45–89 | 7–11 | 6×7 | 2–8 | soft foods (45), hot and cold (61) |
| 90–200 | 9–13 | 7×8 | 1–4 | sauce cups (91), Masterpieces (150) |
| 201–400 | 10–15 | 8×8 | 1–3 | everything mixed |
| 400+ | 8–16 | up to 8×9 | 1–3 | **plateau:** variety, not extra difficulty |

**Adjusting difficulty when a player struggles** (as in the other games):
- A free hint after 2 restarts (after 1 for struggling players).
- An easier version after 3: the same box with one piece pre-placed and one fewer twist.
- The pre-level boost before Tricky levels.

**Daily seed:** `generateDaily(UTC date)`: a mid-curve box (about D 10) with one twist, the same for everyone.

---

## 6. As a mobile app

The same Capacitor shell as the other games (forge `app` driver and `app-extras`).

| Area | Plan |
|---|---|
| **Wrapper** | Capacitor 8 with AdMob, Google's consent form, Apple's tracking prompt, Preferences saves (tamper-checked) and Haptics |
| **Orientation** | Portrait. The box sits in the upper two-thirds and the tray below. A dragged piece lifts above the finger so it isn't hidden |
| **Touch** | Drag with a lift offset. A tap is a press under 200 ms without movement. Long-press rotates soft foods. Snap uses the piece's centre cell |
| **Haptics** | A light tick when a piece snaps over a valid spot, a soft thud when it seats, a double pulse on a refused drop, and a satisfying pattern when the lid closes |
| **Performance** | One quad per piece and one shader. 60 fps on a 2021 mid-range Android. The solver runs in a worker |
| **In-app purchases** | Remove ads, coin packs, power-up bundle, starter pack, all cosmetics (`bento_*` IDs) |
| **Notifications** | Opt-in Daily Bento reminder |
| **Store listing** | Keywords: bento, lunch box, packing puzzle, fit, organise, satisfying, cosy, food puzzle. Screenshots: the last piece hovering, the lid closing, the café menu, hot and cold |
| **Compliance** | Rated Everyone, target audience 13+, privacy policy from the template |

---

## Build notes

### Reuse
- **forge:** everything the first three games used: drivers, the tamper-checked `SaveSlot`, Synth/Music, i18n, tweens, the UI shell, `AdBudget`, buy card, shop, Daily, settings, **coach**, app extras and `build-all`.
- **From the earlier games:** the pack loader and worker (Unbolted), the collection-progress pattern (gadgets → recipe cards), the press composer and the editor shell.
- **New for this game:**
  - `logic/rules.ts`: placement, rotation, soft shapes, hot/cold and sauce checks
  - a dancing-links solver
  - the generator (box, partition, foods)
  - drag-and-drop input (new to the Quarkade games: the first three are tap-only)
  - the food shader
  - the café meta

### Key implementation decisions
- **Cells, not physics:** pieces are cell lists on a grid, so placement and win checks are exact.
- **Drag in screen space, snap in grid space:** the ghost is the snapped placement, and it is green or red from the rules.
- **The solver works from the current board,** not just the start, so Peek, Hint and Tidy Up always agree with what's on screen.
- **Drag needs care on portals and in iframes:** use pointer events with `touch-action: none` on the board, and capture the pointer while dragging.

### Decisions made (2026-11-17)
- **Twists: the food rules.** Box shapes (25), garnish (12) and dividers (15), plus soft foods (45), hot and cold (61) and sauce cups (91), as in §4 Specials.
- **Meta: recipes and the café** (§4 Progression). 5 menus of 8 recipes, about 10 levels per recipe, opened by stars.
- **Name: Snug Bento.**
  - **Name check (2026-11-17):** no game called "Snug Bento" turned up.
  - **Close names:** "Snug" (an unrelated physics packing game on itch.io), and many bento titles: Bento Blocks, Bento Stack, Bento Rush, inbento, Bento Days, Bento Boss.
  - On app stores, use a subtitle such as "Snug Bento: Lunchbox Puzzle".
  - Check again before release.

### Open questions
None.
