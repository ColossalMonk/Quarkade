# hc05 · Aisle Nine — Design

> Status: **Approved** (2026-11-17). **v1.0 built** (2026-11-17): see `BUILD.md`. Build order: **5th**. Effort: **M** (about 7 days: the turning stand, the procedural goods and the backwards generator are the big parts). Name: **Aisle Nine** (catalog title, kept; see Decisions made).
>
> Route: **Open**. CrazyGames first, then Playgama, GameDistribution, GamePix, GameMonetize and YouTube Playables.

**Sources for this design:** a 2026-11-17 search of the goods-sort genre on the App Store and CrazyGames:
- The App Store has dozens of "Goods Sort" and "Goods Triple Match" titles, several in the puzzle top-grossing charts.
- CrazyGames has Goods Triple Match 3D (marked Hot), Shopping Sort (Boombit, rated 9.4) and Supermarket Sort.

---

## 1. Concept

**The game in one line:** Sort goods on the shelves of a turning display stand. Line up three of the same good on one shelf and they're sold, but the stand turns a step with every move, so shelves come round and drift away.

**Thumbnail idea:**
- A round wooden display stand in a cosy corner shop, turning (soft motion lines), packed with colourful goods: jam jars, cereal boxes, juice bottles, apples.
- Three identical jam jars on the front shelf pop with sparkles.
- Warm shop light, a striped awning at the top edge, no text.

**What it should feel like:**
1. **"Sold!"** Three alike click together and pop, and the shelf behind slides forward. It's the restocking and organising feeling of "satisfying restock" videos.
2. **A little planning.** The stand turns one step per move, so you think one or two moves ahead: "that shelf comes back in three moves, so park the jar there now."
3. **A street of your own.** Every good you sell stocks a shop on your high street, and full shops open one by one.

**Trend it rides:**
- **Goods sort and triple match** are one of the biggest mobile puzzle trends of 2024–2026 (Goods Sort, Goods Puzzle, Triple Match 3D and many clones).
- "Satisfying restock" and shop-organising videos.

**How it differs from what already exists:**
- **The turning stand.** In every goods-sort game we found, the shelves stand still. Here only the front of the stand can be reached, and the stand turns one step per move (no timer). Timing your moves to the turn is a new kind of planning, and it gives the game its look.
- **Store twists:** closed cardboard boxes, a freezer, a locked glass cabinet, a restock cart and customers who want one good.
- **Calm, like the other Quarkade games:** no timers, free undo, and every level has a known solution.
- **Main Street meta:** stock and open six shops, instead of a plain level list.

**Length:** a level takes 30–60 s (15–45 moves). A session is 6–10 levels (5–10 min). A shop display takes about 10 levels.

---

## 2. Art assets

**Visual approach:** a 2.5D three.js scene with a perspective camera slightly above the stand. Everything is built in code, from three.js primitives, with flat-shaded low-poly materials. This is the first Quarkade game with real 3D models; the first four drew everything with shaders on flat quads.

| Element | How it's made |
|---|---|
| **Goods** | Low-poly models built from primitives: lathe shapes for bottles, jars and cups; extruded boxes for cartons and cereal; spheres and capsules for fruit, balls and sweets; plus small details (lids, stalks, ribbons). Each good is one merged geometry, drawn with `InstancedMesh`. Labels are drawn on a shared canvas atlas, with no brand names |
| **Display stand** | A cylinder of 3–10 shelf units around a central pole, each unit 1–3 shelves high. A wood, chrome, wicker or candy-striped finish per stand style. It turns with an eased tween and a soft "clack" |
| **Back stock** | Goods in the layers behind a shelf's front row, shown dimmer and smaller. From level 120, some shelves hide them under a "?" |
| **Store twists** | Cardboard box (a lid that folds open), frost overlay and counter (freezer), glass doors with a padlock (cabinet), a restock cart with its queue, a customer with an order bubble |
| **Shop around the stand** | A soft-focus back wall, floor and counter per store theme (grocery, bakery, toy shop, garden centre, sweet shop, bookshop) |
| **Stand map** | A small ring strip under the stand shows every unit's front goods as icons, so you can see what's coming round |
| **Particles** | A sparkle and a "SOLD" coin pop on a triple, and confetti when a level ends |
| **Main Street** | Drawn on a canvas: a row of six shop fronts. Each fills in display by display, and opens with a ribbon and bunting |

### Asset list
| Asset | Source | Size |
|---|---|---|
| 48 goods (6 themes × 8): primitive recipes, colours and a label each | `goods.ts` (code) | Code |
| Stand, twist and shop props | Built in code | Code |
| Label atlas (fruit stickers, simple icons, stripes) | Drawn on a canvas at startup | Code |
| 48 shop displays (6 shops × 8): name and goods needed | `shops.ts` (text data) | ~5 KB |
| UI kit and icons | forge UI plus Kenney (CC0), recoloured in awning red, cream and mint | ~150 KB |
| Font | Baloo 2 (OFL), already in the repo | ~40 KB |
| Sound and music | WebAudio (forge `Synth`, plus a "corner shop" `SongSpec` for `Music`) | Code |
| **Fallback:** Kenney Food Kit (CC0) for bakery and grocery goods, if the primitive versions don't look good enough | Kenney | ~400 KB |

**Sound:**
- a soft "tock" when a good is picked up and set down, with the pitch set by the good's size
- a cash-register "ka-ching" on a triple, rising with a combo of quick triples
- the stand's wooden "clack" as it turns
- cardboard tearing, ice cracking, a padlock click, a trolley rattle
- a gentle "nope" when a shelf is full

**Music:** forge `Music` with a light corner-shop song (ukulele, glockenspiel, soft bass).

**Thumbnails and store art:** `?press=1` renders the hero shot (the turning stand with a triple popping) at every portal size.

**Size budget:** about 0.8 MB initial download (no model files; everything is built in code).

---

## 3. How ads will work

The same forge policy as the other games (`AdBudget`, `interstitialDue`, `buyCard`).

**Interstitial ads:**
- **Shown:** on the level-complete "Next" button.
- **Never shown:**
  - in levels 1–5
  - in the middle of a level
  - after a shop opens
  - right after a rewarded ad
- **How often:** every 3+ levels, at least 90 s apart.
- **App "Remove ads":** turns interstitials off.

**Power-ups (coins or one rewarded ad):**

| Item | Coins | One ad gives | Ad limit |
|---|---|---|---|
| ✋ Brake | 100 | 1 | 1 / level |
| 🧺 Basket | 150 | 1 | 1 / level |
| 🔀 Restack | 200 | 1 | 1 / level |
| 🧑‍💼 Shop Assistant | 300 | 1 | 1 / level, 5 / day |
| Hint | 80 | 1 | 3 / level |

**Other rewarded ads:**

| Placement | What the player gets |
|---|---|
| Restack (the catalog's "shuffle the shelves") | Re-sorts the goods left into a new, solvable arrangement |
| Basket (the catalog's "extra basket slot") | Two spots off the stand for the rest of the level |
| Jammed | When every shelf is full: one free Basket, or Undo |
| Pre-level boost | Start a Tricky or Grand Opening level with the Basket |
| Double coins | 2× the coins on the win screen |
| Daily retry | Once per day |

**Rules and caps:**
- At most 3 rewarded ads per level and 20 per day.
- Rewarded buttons use 🎬, aren't green, and always sit next to a plain button.

**Free allowance:**
- Undo is free and unlimited.
- 3 free uses of each power-up when it unlocks.
- 1 random power-up for each finished shop display.
- A Shop Assistant for every 7-day streak.

**Portal SDK events:** gameplay start and stop around each level and each modal. A "happy time" on a perfect level and when a shop opens. Mute and pause follow the host.

---

## 4. Gameplay and progression

### Controls
- **Tap a good** on a front shelf to pick it up. It lifts and wobbles.
- **Tap a shelf** with a free spot to set it down there. Tapping the same good again puts it back.
- **Drag** works too: drag a good onto a shelf.
- **Turn button** (⟳ under the stand): turns the stand one step without moving a good. It counts as a move.
- **Desktop:** the mouse works the same way. Z undoes, Space turns, and Q/W/E/R use power-ups.

### The rules
1. **The stand:** a ring of shelf units around a pole. Each shelf has a **front row of 3 spots**, and may have **back stock**: layers of up to 3 goods waiting behind.
2. **Reach:** only the shelves facing you (the front arc, usually 3 units) can be used. The side units are visible but out of reach, and the back of the stand is hidden. The stand map shows everything.
3. **A move:** take a good from a front row in reach and set it on any free spot of another front row in reach.
4. **The turn:** after every move, the stand turns **one step** (the direction is shown by arrows on its base). In levels 1–3 it stands still.
5. **Sold:** three of the same good in one front row are sold and disappear.
6. **Restock:** when a front row is empty, the next layer of back stock slides forward.
7. **The level is won** when every good is sold.
8. **Jammed:** if every front row on the whole stand is full and nothing can be sold, you're jammed. You can undo, use a Basket (1 free, or with an ad) or restart. Undo is always free.

### Specials (each introduced alone, with a tip and the coach's pointing hand)
| Level | Special | What it does |
|---|---|---|
| 4 | **The stand turns** | The signature rule: one step per move, and the front arc moves on |
| 12 | **Cardboard boxes** | A shelf is closed by a box. It opens when a neighbouring shelf (above, below or beside it) sells a triple |
| 25 | **Freezer** | A frosted shelf with a counter (3–6). Its goods can't be moved until that many triples have been sold anywhere |
| 45 | **Glass cabinet** | A locked shelf. One good on the stand carries a 🔑 tag; selling its triple opens the cabinet |
| 61 | **Restock cart** | A cart beside the stand holds a queue of goods (shown). Whenever a front row in reach is fully empty with no back stock, the cart fills it with its next 3 goods |
| 91 | **Customers** | A customer at the counter wants one good (an order bubble). Tap that good, then the customer, to hand it over. A level with customers has some goods counted 3k + 1, so serving them is part of the solution |

### Power-ups
| Power-up | Unlocks | What it does | Problem it solves | Stars |
|---|---|---|---|---|
| ✋ **Brake** | Level 8 | Stops the stand turning for the next 5 moves | "The shelf I need is about to leave" | None |
| 🧺 **Basket** | Level 15 | Adds a 2-spot basket on the counter, off the stand. Goods in it stay put while the stand turns | Carrying a good round to where it's needed | None |
| 🔀 **Restack** | Level 25 | Re-sorts all goods left (front and back stock) into a new arrangement that the solver confirms is solvable | A board that has gone wrong | Caps the level at ★★ |
| 🧑‍💼 **Shop Assistant** | Level 40 | Pick a good: the assistant sells one triple of it, from anywhere on the stand, back stock included | A good buried deep | Caps the level at ★★ |

### Win, stars, coins
- **Moves:** every good moved and every press of the turn button. Undo doesn't lower the count (as in Snug Bento: with free undo, a refund would make ★★★ automatic).
- **Par:** the shortest solution the solver finds.
- **Stars:**
  - ★★★ at par or better
  - ★★ up to par + max(3, 15%)
  - ★ for finishing
  - Restack and Shop Assistant cap the level at ★★.
- **Coins:** the shared formula (base 6, +3 per star, a difficulty bonus, +25% first try, ×2 Tricky, +100 Grand Opening).

### Progression
- **Main Street (the main goal):**
  - Six shops: **Corner Grocery, Bakery, Toy Shop, Garden Centre, Sweet Shop and Bookshop**. Each has 8 goods and 8 displays.
  - A display lists goods to sell, for example "Bread Basket: 9 loaves, 6 baguettes, 6 croissants". Every good sold ticks one off the current display.
  - Level goods are drawn from the display's unfinished goods (the same trick as recipes and gadgets), so a display takes about 10 levels. A catch-up tick is added each level.
  - A finished display appears in that shop's window on Main Street.
  - A shop with all 8 displays **opens**: a ribbon-cutting scene, bunting, and its **store theme** (back wall, floor and stand dressing) for your stand.
  - Shops open in order, gated by total stars (0 / 60 / 150 / 250 / 360 / 480). Each new shop adds its 8 goods to the levels. After all 48 displays, **Encore** orders follow.
- **Shop** (after level 20):
  - Stand finishes: Pine (default), Chrome, Wicker, Candy Stripe, Brass
  - Awnings: Red Stripe, Mint, Navy, Polka Dot
  - Shopping bags (the "SOLD" pop): Paper, Tote, Gift Box, Basket
- **Daily Restock** (after level 20):
  - The same stand for everyone each UTC day. Only Brake, no hints.
  - Streak, a calendar of tiny stands, share text ("🛒 Daily Restock · ★★★ · 🔥 12"), one rewarded retry a day.

### Tutorial (levels 1–20, hand-made)
Teaching uses forge's coach (tips, the hand on the first move, unlock cards).

| Level | Teaches |
|---|---|
| 1 | A still stand with 2 shelves and 2 goods: "Tap a good, then tap a shelf" (the hand shows both taps) |
| 2 | Three of a kind sell |
| 3 | Back stock slides forward |
| 4 | **The stand turns** one step per move (arrows, and the stand map) |
| 5 | The turn button, and undo |
| 6 | Stars: "fewer moves, more stars" |
| 7 | Main Street: "every good you sell stocks a shop" |
| 8 | Brake unlocks |
| 9–11 | Bigger stands, 4–5 goods |
| 12 | Cardboard boxes |
| 13–14 | Practice |
| 15 | Basket unlocks |
| 16–19 | Practice |
| 20 | First display done; shop and Daily open |

---

## 5. Infinite levels and level progression

### What makes up a level
```
Level = {
  stand:    units U (3–10), shelves per unit (1–3), reach (front arc), turn direction
  shelves:  front row (3 spots) and back-stock layers per shelf
  twists:   boxes, freezer counters, cabinet + key good, cart queue, customer orders
  solution: the move list from generation (kept for Hint, Restack checks and par)
  par, D, tag
}
```

### Generator (solvable by construction)
Levels are made by **playing backwards from an empty stand**:
1. **Stand:** pick the band's size: units, shelves per unit, reach and twists.
2. **Plan the goods:** pick goods types (from the current display) and how many triples of each.
3. **Play backwards:** each reverse step undoes a forward event:
   - **Un-sell:** put a triple back on an empty front row in reach, then move one of its goods back to another shelf in reach (the move that completed it).
   - **Un-move:** move a good between two front rows in reach.
   - **Un-restock:** push a full front row back into back stock.
   - The stand turns back one step for every reverse move.
   - Twists are placed so the forward story stays true. For example, a box closes over a shelf only before the step in which its neighbour sold a triple.
4. **The reverse sequence, played forwards, is the stored solution.** Every level can be won.
5. **Scramble** with extra reverse moves until the starting stand looks mixed (no front row starts with a triple, and goods are spread out).
6. **Rate:** a forward solver (beam search with state hashing) looks for a shorter solution, which sets **par**. The same solver also plays it "sensibly" (only what's visible, the way a player would; Unbolted used this idea for par). How often sensible play gets jammed is the main difficulty signal.

**Solver:** beam search over states (front rows, back stock, the stand's angle, twist states), with a heuristic that values near-triples in reach and shelves coming round soon. It runs in a Web Worker and powers par, Hint (the next move of a solution from your current board) and Restack (checking a new arrangement is solvable).

### How difficulty increases over time
**Eight levers:**

| # | Lever | Range | What the player feels |
|---|---|---|---|
| 1 | Goods | 6 → 60 | More to sort |
| 2 | Kinds of goods | 2 → 12 | More to keep track of |
| 3 | Stand size vs reach | All in reach → 10 units with 3 in reach | More happens out of reach |
| 4 | Back stock | None → 3 layers | Hidden consequences |
| 5 | **Free spots** | Plenty → 2–3 | Less room to park goods |
| 6 | **Sensible-play jams** | Rare → common | Real planning needed |
| 7 | Look-alikes | Same good in two colours (red and green apples), with symbols in colour-blind mode | Careful reading |
| 8 | Specials | Boxes, freezer, cabinet, cart, customers; hidden back stock (120+) | Variety and constraints |

**Difficulty score:**
```
D = 0.12·goods + 0.5·kinds + 2·(1 − reach/units) + 0.8·layers + 1.5·(1/freeSpots) + 4·jamRate + 1.0·specials
```

**Target curve:** `D_target(n) = 3 + 14·(1 − e^(−n/180))`. It rises fast early and flattens around level 400. The generator picks a percentile of rated candidates.

**Rhythms:**
- **Display chapters** of about 10 levels: easy to start, ending on a "Window Day" Tricky.
- Every 5th level is a Breather, every 10th a Tricky (×2 coins), and every 50th after 150 a **Grand Opening** (a big two-stand level).

**Timeline:**

| Levels | Goods | Stand | Back stock | New |
|---|---|---|---|---|
| 1–20 | 6–18 | 2–5 units, mostly in reach | 0–1 layer | turning (4), Brake (8), boxes (12), Basket (15) |
| 21–44 | 15–27 | 5–6 units, 3 in reach | 1 layer | freezer (25), Restack (25), Shop Assistant (40) |
| 45–89 | 21–36 | 6–8 units | 1–2 layers | cabinet (45), cart (61) |
| 90–200 | 27–45 | 8 units, 2 shelves high | 2 layers | customers (91), hidden back stock (120), Grand Openings (150) |
| 201–400 | 33–54 | 8–10 units | 2–3 layers | everything mixed |
| 400+ | 30–60 | up to 10 units | up to 3 layers | **plateau:** variety, not extra difficulty |

**Adjusting difficulty when a player struggles** (as in the other games):
- A free hint after 2 restarts (after 1 for struggling players).
- An easier version after 3: the same stand with one more free spot and one fewer twist.
- The pre-level boost before Tricky levels.

**Daily seed:** `generateDaily(UTC date)`: a mid-curve stand (about D 10) with one twist, the same for everyone.

---

## 6. As a mobile app

The same Capacitor shell as the other games (forge `app` driver and `app-extras`).

| Area | Plan |
|---|---|
| **Wrapper** | Capacitor 8 with AdMob, Google's consent form, Apple's tracking prompt, Preferences saves (tamper-checked) and Haptics |
| **Orientation** | Portrait. The stand fills the middle, the stand map and the turn button sit under it, and the counter (Basket, customers) at the bottom |
| **Touch** | Tap-tap and drag both work. Tap targets are whole shelves, not single spots. A picked-up good lifts so the finger doesn't hide it |
| **Haptics** | A light tick on pick-up, a soft thud on set-down, a "ka-ching" pulse on a triple, a click as the stand turns, a double pulse when a shelf is full |
| **Performance** | Instanced goods (one draw call per kind of good), flat shading, no shadow maps (a baked blob shadow under each good). 60 fps on a 2021 mid-range Android. The solver runs in a worker |
| **In-app purchases** | Remove ads, coin packs, power-up bundle, starter pack, all cosmetics (`aisle_*` IDs) |
| **Notifications** | Opt-in Daily Restock reminder |
| **Store listing** | Keywords: goods sort, triple match, sort puzzle, shop, shelf, organise, satisfying, cosy. Screenshots: the turning stand, a triple selling, Main Street, the freezer and cabinet |
| **Compliance** | Rated Everyone, target audience 13+, privacy policy from the template |

---

## Build notes

### Reuse
- **forge:** everything the first four games used: drivers, the tamper-checked `SaveSlot`, Synth/Music, i18n, tweens, the UI shell, `AdBudget`, buy card, shop, Daily, settings, coach, app extras and `build-all`.
- **From the earlier games:**
  - the pack loader and worker (Unbolted, Snug Bento)
  - the collection-progress pattern (gadgets → recipes → shop displays)
  - "sensible play" for par and difficulty (Unbolted)
  - the jam handling and tray (Unbolted)
  - the press composer, the editor shell and the store kit
- **New for this game:**
  - the first perspective camera and real 3D models (goods built from primitives, instanced)
  - the turning stand, its reach rules and the stand map
  - the backwards generator and a beam-search solver
  - Main Street

### Key implementation decisions
- **The rules are pure data:** shelves are arrays of good ids, and the stand's angle is an integer step. Rendering only reads the state, so undo, the solver and the generator share one rules module.
- **Turning is part of the move:** a move is (from, to), followed by one step of turn, so undo and replays stay exact.
- **No timer anywhere:** the stand only turns when you move or press the turn button.
- **Goods are told apart by shape first,** then colour. Look-alike pairs get symbols in colour-blind mode.

### Decisions made (2026-11-17)
- **Core rules: shelf sort on a turning stand** (Goods Sort-style shelves, 3 spots per front row, back stock), not the catalog's basket match. The stand turns one step per move.
- **Twists: store twists:** cardboard boxes (12), freezer (25), glass cabinet (45), restock cart (61) and customers (91), as in §4 Specials.
- **Meta: Main Street** (§4 Progression): 6 shops of 8 displays, about 10 levels per display, opened by stars.
- **Name: Aisle Nine** (kept from the catalog).
  - **Name check (2026-11-17):** no game called "Aisle Nine" turned up.
  - **Close names:** the tabletop RPG "Do not approach Aisle 9" (itch.io), "Aisle" (1999 interactive fiction), "Cleanup on Aisle 3", "Aisle Survive".
  - On app stores, use a subtitle such as "Aisle Nine: Goods Sort Puzzle".
  - Check again before release.

### Open questions
None.
