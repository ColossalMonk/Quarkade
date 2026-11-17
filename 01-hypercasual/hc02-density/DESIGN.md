# hc02 · Density — Design

> Status: **Approved** (2026-11-12). **v1.0 built** (2026-11-13): see `BUILD.md`. Build order: **2nd**. Effort: **M**. The name is checked at release.
> Route: **Open**. CrazyGames first, then Playgama, GameDistribution, GamePix, GameMonetize and YouTube Playables.
> Built on **forge** and on what Knotwork proved out: portal drivers, saves, ads policy, shop, Daily, press art, editor, zips and the app shell.

---

## 1. Concept

**The game in one line:** Sort coloured liquids between flasks, except they obey gravity: oil floats, syrup sinks, and every pour settles into layers by weight.

**Thumbnail idea:** One tall flask showing a perfect "density tower": amber honey at the bottom, then ruby syrup, blue water, golden oil and white foam on top. Above it, a second flask tilts mid-pour, and a ruby stream sinks *through* the blue and gold layers on its way down. Clean glass, soft lab light, no text.

**What it should feel like:**
1. **"Oh, physics!"** Pour honey into a flask of water and watch it slide underneath. Each class of liquid behaves the way your eyes expect.
2. **A calm lab.** Glassy clinks, glugs and bubbles. No timers.
3. **Building something:** each sealed flask pours into a big **Density Tower** that you're layering up, the "7-layer density tower" from science-experiment videos.

**Trend it rides:**
- Water and liquid sort puzzles, among the biggest casual mobile puzzle formats.
- **Density tower / liquid-layering videos,** a long-running viral science and satisfying staple.

**How it differs from what already exists:**
- Classic water sort has one rule: pour onto the same colour. Here **liquids have weight**. A pour sinks past every lighter layer, so you can tuck syrup *under* water to park it, or float oil *over* anything.
- The same colours behave differently depending on their weight class, which creates puzzles plain sorting can't.
- Its own look, names and meta: Density Towers, not quilts.

**Length:** a level takes 30–90 s. A session is 6–10 levels (5–10 min). A Density Tower takes about 10 levels.

---

## 2. Art assets

**Visual approach:** liquids are made almost entirely in code. A 2D orthographic three.js scene: each flask is one quad with a glass shader, and its liquid layers are drawn by a **liquid shader** from per-flask layer data.

| Element | How it's made |
|---|---|
| **Glass** | Shape drawn with an SDF (rounded tube, beaker, potion bottle per skin), with rim highlight, refraction tint and edge darkening |
| **Liquid layers** | One fragment shader reads up to 6 layers (colour, class, height) per flask. It draws a meniscus, a wobble spring after each pour, and a soft boundary between layers |
| **Class looks** | **Foam:** bubbly noise and a bright top. **Oil:** thin-film iridescent sheen and a glossy streak. **Water:** clear with a slight gradient and drifting micro-bubbles. **Syrup:** dark, glossy, slow wobble, thick meniscus. **Mercury:** metallic env-gradient reflection |
| **Pour stream** | A ribbon mesh along a curve from the tilted source lip, with speed streaks |
| **Sinking drops** | Instanced droplet sprites that fall *through* lighter layers. This is the signature moment |
| **Bench** | Background quad with a lab-bench shader (wood or tile) per theme. The flask rack is simple shapes |
| **Density Tower** | A large vessel silhouette (SDF: cylinder, hourglass, round flask, star bottle, lantern…) filled by the same liquid shader |
| **Particles** | Splash dots, seal sparkles, rising bubbles: one soft-dot texture |

### Asset list
| Asset | Source | Size |
|---|---|---|
| Glass, liquid, bench and tower shaders | Written in GLSL | Code |
| 16 liquids (colour + class + look parameters), each with a colour-blind symbol | `liquids.ts` | Code |
| 40 Density Towers: vessel shape + list of layers | `towers.ts` (text data, no drawing) | ~3 KB |
| UI kit, icons | forge UI plus Kenney (CC0), recoloured lab blue and cream | ~150 KB |
| Font | Baloo 2 (OFL), already in the repo | ~40 KB |
| Sound and music | WebAudio (forge `Synth`, `Music` with a new "lab" `SongSpec`) | Code |

**The 16 liquids, by class (light → heavy):**

| Class (weight) | Liquids | Arrives |
|---|---|---|
| **Foam** (1) | Milk Foam (white), Berry Foam (pink) | Level 60 |
| **Oil** (2) | Olive Oil (gold), Lavender Oil (lilac), Mint Oil (pale green) | Level 4 |
| **Water** (3) | Sky Water (blue), Lagoon (teal), Berry Juice (red-pink), Lime Juice (green), Grape Juice (purple) | Level 1 |
| **Syrup** (4) | Honey (amber), Maple (brown), Cherry Syrup (ruby), Chocolate (dark brown) | Level 7 |
| **Mercury** (5) | Quicksilver (silver), Liquid Gold (gold metal) | Level 90 |

**Sound:**
- glug, with pitch rising as the flask fills
- pour hiss
- a heavy "plop" when syrup sinks, an oily "blip" when oil floats
- foam fizz
- a cork "pop" and glass "ting" when a flask seals
- a bubbling arpeggio when a tower completes

**Music:** forge `Music` with a light "lab" song (higher register, marimba-like plucks).

**Thumbnails and store art:** `?press=1` renders the density-tower hero shot at all portal sizes (reuse Knotwork's `press.ts` approach).

**Size budget:** about 0.8 MB initial download. No textures besides the UI kit.

---

## 3. How ads will work

The same forge policy Knotwork uses, checked against each portal's rules.

**Interstitial ads:**
- **Shown:** on the level-complete "Next" button.
- **Never shown:**
  - in levels 1–5
  - in the middle of a level
  - after a tower is completed
  - right after a rewarded ad
- **How often:** every 3+ levels, at least 90 s apart.
- **App "Remove ads":** turns interstitials off.

**Power-ups and tools (coins or one rewarded ad):**

| Item | Coins | One ad gives | Ad limit |
|---|---|---|---|
| 🧪 Spare Flask | 150 | 1 | 1 / level |
| 🔦 Lamp | 120 | 1 | 1 / level |
| 💉 Pipette | 200 | 1 | 1 / level |
| 🌀 Centrifuge | 350 | 1 | 1 / level, 5 / day |
| Undo ×5 | 60 | 5 | 2 / level |
| Hint | 80 | 1 | 3 / level |

**Other rewarded ads:**

| Placement | What the player gets |
|---|---|
| Stuck rescue | Spare Flask + 2 undos |
| Pre-level boost | Start Tricky and Masterpiece levels with a Spare Flask |
| Double coins | 2× the coins on the win screen |
| Daily retry | Once per day |

**Rules and caps:**
- At most 3 rewarded ads per level and 20 per day.
- Rewarded buttons use 🎬, are not green, and always sit next to a plain button (Poki's rule, applied everywhere).

**Free allowance:**
- 2 undos per level
- 3 free uses of each power-up when it unlocks
- 1 random power-up for each finished tower
- a Centrifuge for every 7-day streak
- a Spare Flask for winning a Tricky level on the first try

---

## 4. Gameplay and progression

### Controls
- **Tap a flask** to pick it: it lifts, and its pourable layer glows.
- **Tap another flask** to pour into it: the source tilts over the target and pours.
- Tap the same flask, or empty space, to cancel.
- **Desktop:** click. Keys 1–0 pick flasks, Z undoes, Q/W/E/R use power-ups.

### The rules
1. **Weight classes.** Every liquid is Foam, Oil, Water, Syrup or Mercury, from lightest to heaviest. A flask is always layered by weight: the heaviest class at the bottom, the lightest on top. Within one class, layers stay in the order they arrived.
2. **What pours.** The top layer: the top run of one colour in the flask's lightest class. Murky (hidden) units don't join a run until revealed.
3. **Where it lands.** The poured liquid **sinks past every lighter layer** in the target and comes to rest on the first layer at least as heavy as it, or on the bottom.
4. **What it may rest on:** **its own colour, or anything heavier, but never a different liquid of the same weight.** For example, honey can sink under water and rest on chocolate (heavier), but not on cherry syrup (same weight, different colour).
5. **How much pours.** The whole run, or as much as fits.
6. **Sealing.** A flask holding all 4 units of one liquid and nothing else gets a cork and locks.
7. **The level is won** when every liquid is sealed.
8. **Stuck** means no legal pour. The stuck panel offers Undo, Spare Flask, Pipette, Hint and Restart.

These rules give two tools classic water sort doesn't have:
- **Parking under:** pour a syrup into a flask of water to tuck it away beneath the water.
- **Parking over:** float oil onto any flask that has room.

The puzzle comes from capacity and from same-weight blockers.

### Specials (each introduced alone, with a tip)
| Level | Special | What it does |
|---|---|---|
| 4 | **Oil** | The first light class: always floats |
| 7 | **Syrup** | The first heavy class: always sinks |
| 15 | **Murky layers** | Cloudy units. Their colour shows when they reach the top of their zone |
| 30 | **Odd flasks** | Flasks that hold 3, 5 or 6 instead of 4 |
| 45 | **Corked flasks** | A flask starts corked (no pouring in or out). The cork shows a number and pops after that many other flasks are sealed |
| 60 | **Foam** | The lightest class: floats above oil |
| 90 | **Mercury** | The heaviest class: sinks below syrup |

### Power-ups
| Power-up | Unlocks | What it does | Problem it solves | Stars |
|---|---|---|---|---|
| 🧪 **Spare Flask** | Level 8 | Adds an empty flask (holds 4) for the rest of the level | No room | None |
| 🔦 **Lamp** | Level 15 | Shows every murky layer's colour | Guessing | None |
| 💉 **Pipette** | Level 25 | Draw **1 unit from any layer**, even a buried one. It waits in the pipette (holds 1) until you drop it into a flask, where it settles under the usual rules. Cutting through a layer can also free a corked flask's neighbour | A key unit trapped under same-weight blockers | Caps the level at ★★ |
| 🌀 **Centrifuge** | Level 40 | Pick a flask: it spins and **groups each class's colours together** (within each weight zone, same colours become one run, largest first) | An interleaved mess in one flask | Caps the level at ★★ |

### Win, stars, coins
- **Par** is the solver's solution length, plus 1 for every 3 murky units.
- **Stars:** ★★★ at par or better, ★★ up to par × 1.4, ★ for finishing. Pipette and Centrifuge cap the level at ★★.
- **Coins:** Knotwork's tuned formula.

  | Part | Coins |
  |---|---|
  | Base | 6 |
  | Per star | +3 |
  | Difficulty bonus | +1 per 40 levels, up to +8 |
  | First try | +25% |
  | Tricky level | ×2 |
  | Masterpiece level | +100 |
  | A flask of a colour the tower doesn't need | +1 |

### Progression
- **Density Towers (the main goal).**
  - A tall display vessel with 5–7 layer slots, for example "Rainbow Tower: honey, cherry, lime, sky, olive, foam".
  - Every sealed flask of a liquid the tower needs pours into it. The tower obeys density too, so its layers settle into the classic layered look. A layer is full after 8 pours.
  - Level colours are picked from the tower's unfilled layers (the same trick as Knotwork's quilt), so a tower takes about 10 levels.
  - **5 collections of 8 towers:** Kitchen Science, Rainbow, Ocean, Potion Shop and Space Lab. Collections open by total stars (0 / 60 / 150 / 250 / 360).
  - Finishing a collection gives a **glassware skin**. After all 40 towers, **Encore** towers follow.
- **Shop** (after level 20):
  - Glassware: Lab Tube (default), Beaker, Potion Bottle, Frosted, Crystal, plus album rewards
  - Lab benches: Wooden Bench, White Tile, Wizard Tower, Space Station
  - Pour effects: Plain, Sparkle Stream, Bubble Trail, Rainbow Splash
- **Daily Brew** (after level 20):
  - The same puzzle for everyone each UTC day. Only Spare Flask and Lamp, no hints.
  - Streak, a calendar of bottles, share text, one rewarded retry a day.

### Tutorial (levels 1–20, hand-made)
| Level | Teaches |
|---|---|
| 1 | 2 waters, 3 flasks: "Tap a flask, then tap where to pour" |
| 2 | Sealing a flask |
| 3 | The Density Tower: "sealed flasks fill your tower" |
| 4 | **Oil floats.** Pour oil anywhere |
| 5 | Undo |
| 6 | Stars and par |
| 7 | **Syrup sinks.** Watch it slide under the water |
| 8 | Spare Flask unlocks |
| 9 | Parking syrup under water to make room |
| 10 | Tricky! Hint introduced |
| 11–14 | Three classes mixed |
| 15 | Murky layers + Lamp |
| 16–19 | Practice |
| 20 | First tower done; shop and Daily open |

---

## 5. Infinite levels and level progression

### What makes up a level
```
Level = {
  liquids:   k liquids (2-11), each 4 units, each with a class
  flasks:    k + e flasks (e = empty flasks: 2, later sometimes 1)
  caps:      4, or a mix of 3/5/6 after level 30
  layers:    each flask's units, already settled by weight (heavy -> light), random order within a class
  specials:  murky units, corks [flask, count]
  par, D, tag (normal | breather | tricky | masterpiece | tutorial)
}
```
Pack strings reuse Knotwork's format: a letter per liquid, UPPERCASE = murky, and `#n` after a flask for a cork.

### Sources
- **Levels 1–20:** hand-made in `levels-tutorial.json`.
- **Levels 21–3020:** six pre-built packs of 500, each level solved twice.
- **Beyond that:** the same generator in the Web Worker.
- **Daily Brew:** `generateDaily(UTC date)`.

### Generator
Knotwork's pipeline with Density's rules:
1. Pick liquids from the current tower's unfilled layers, then add others to reach k. Classes follow the curve.
2. Deal the units randomly into k flasks.
3. **Settle each flask by weight,** keeping the deal order within each class (this is the physically consistent start).
4. Reject deals that are already sealed or are giveaways (three of one colour already on top).
5. Add murky units and corks.
6. **Solve** with weighted A\*. The state is each flask's unit list plus cork counters, and moves follow §4. That gives par.
7. Rate D, and keep the candidate at the target percentile for this level's rhythm.

### How difficulty increases over time
**Seven levers** that start turning at different times:

| # | Lever | Range | What the player feels |
|---|---|---|---|
| 1 | Liquids (k) | 2 → 11 | More to track |
| 2 | Room | 2 empty → 1; odd caps 3/5/6 | Less space to park |
| 3 | **Classes in play** | 1 → 5 | New physics, more places to park, but more burying |
| 4 | **Same-weight crowding** | Most liquids sharing one class: 2 → 5 | Classic blocking (same-weight colours can't rest on each other) |
| 5 | Murky | 0 → 35% | Uncertainty, where the Lamp is worth it |
| 6 | Corks | 0 → 2 per level | Flasks you can't use yet: plan an order |
| 7 | Dead ends | < 5% → 40% of random play gets stuck | How costly carelessness is |

**Difficulty score** (from solver stats, the same idea as Knotwork):
```
D = 0.8·k + 3.0·(2 − e) + 1.2·crowding + 4.0·murkyShare + 1.0·specials + 6.0·deadEndRate + 0.05·par
specials: odd caps 0.5, cork 1.5 each, foam/mercury present 0.5 each
```

**Target curve:** `D_target(n) = 4 + 14·(1 − e^(−n/180))`. It rises fast early and flattens around level 400. Like Knotwork, the generator picks a percentile of 8 rated candidates instead of chasing exact D.

**Rhythms:**
- **Tower chapters** of about 10 levels: easy to start, ending on a "Final Layer" Tricky.
- Every 5th level is a Breather (−25%), every 10th a Tricky (+30%, ×2 coins), and every 50th after 150 a Masterpiece.
- After a fail or restart, help comes through hints and the easier version (packs are fixed).

**Timeline:**

| Levels | Liquids | Empty flasks | Classes | Murky | New | Dead ends | Par |
|---|---|---|---|---|---|---|---|
| 1–20 | 2–6 | 2 | 1 → 3 | 0 → 10% | oil (4), syrup (7), Spare Flask (8), murky + Lamp (15) | < 5% | 3–18 |
| 21–44 | 5–7 | 2 | 3 | ≤ 15% | Pipette (25), odd flasks (30), Centrifuge (40) | 5–15% | 15–28 |
| 45–89 | 6–8 | 2 | 3–4 | ≤ 20% | corks (45), foam (60) | 10–20% | 22–34 |
| 90–200 | 7–9 | 2 (1 on Tricky) | 3–5 | ≤ 30% | mercury (90), Masterpieces (150) | 15–30% | 28–42 |
| 201–400 | 8–10 | 1–2 | 4–5 | ≤ 35% | everything mixed | 20–35% | 32–52 |
| 400+ | 7–11 | 1–2 | 3–5 | ≤ 35% | **plateau:** variety, not extra difficulty | 25–40% | 35–58 |

**How power-ups fit:**
- Spare Flask arrives before space gets tight.
- The Lamp arrives with murky layers.
- The Pipette arrives before same-weight crowding.
- The Centrifuge arrives before interleaved four-class flasks.

---

## 6. As a mobile app

The same Capacitor shell Knotwork built.

| Area | Plan |
|---|---|
| **Wrapper** | Capacitor 8 with forge's `app` driver (AdMob + Google's consent form + Apple's tracking prompt, Preferences saves, Haptics) |
| **Orientation** | Portrait. Flasks in 1–3 rows; tap targets are at least 48 dp |
| **Haptics** | A soft "glug" pattern during the pour (light ticks timed with the stream), a heavy thunk when syrup lands, a success pattern on sealing, a celebration on a finished tower |
| **Device motion** (app only, optional) | A gentle tilt makes the liquids slosh (cosmetic, never affects play) |
| **Performance** | One quad per flask, all liquids in one shader. 60 fps on a 2021 mid-range Android. The solver runs in a worker |
| **In-app purchases** | Remove ads, coin packs, power-up bundle, starter pack, all cosmetics (same structure as Knotwork, `density_*` IDs) |
| **Notifications** | Opt-in Daily Brew reminder |
| **Store listing** | Keywords: water sort, liquid sort, color sort puzzle, density, science, satisfying, relaxing. Screenshots: density tower, the syrup-sinking moment, tower collections, Daily Brew |
| **Compliance** | Rated Everyone, target audience 13+, privacy policy (adapt Knotwork's template) |

---

## Build notes

### Reuse from Knotwork and forge
- **forge:** platform drivers, saves, Synth/Music, i18n, tweens, `build-all` (zips, Playgama config), dev-save plugin, Capacitor app driver.
- **From Knotwork, worth moving into forge first** (one-time refactor, which speeds up every later game):
  - modal and button helpers
  - toast
  - power-up bar
  - buy card with coin/ad caps
  - shop modal
  - Daily card, streak and calendar
  - settings (sound, music, vibration, colour-blind, language)
  - pre-level boost
  - interstitial rules
  - press-mode composer
  - editor shell

  Knotwork's `main.ts` is about 1,700 lines, and most of it is game-agnostic.
- **New for Density:**
  - `logic/rules.ts`: weight-aware landing and resting rules, corks
  - solver and generator adapted from Knotwork
  - liquid renderer (shaders + pour animation + sinking droplets)
  - Density Tower meta (replaces the quilt)

### Key implementation decisions
- **Flask state:** each flask is an array of unit ids (bottom → top) kept sorted by class. Inserting a pour is `splice` at the landing index. The solver encodes liquids as small ints, with the class looked up from a table.
- **Liquid shader input:** per flask, up to 6 layers of `vec4(colour.rgb, class)` plus heights, packed into a DataTexture (row = flask), so one material draws every flask.
- **Pour animation:**
  1. The source tilts (rotation about its lip).
  2. The stream ribbon grows.
  3. The target's layers rise.
  4. When the landing point is below lighter layers, droplet particles fall through them, and the landing layer grows from the bottom while the lighter layers lift.
  5. A wobble spring runs on all touched layers.
- **Colour-blind mode:** each liquid's symbol is drawn on its layer in the liquid shader. Classes already differ by texture.

### Decisions made
- **Resting rule:** a poured liquid rests only on **its own colour or anything heavier**, never on a different liquid of the same weight (§4 rule 4). Decided 2026-11-12.
- **Meta: Density Towers** (§4 Progression): 5 collections of 8 towers, about 10 levels each. Decided 2026-11-12.
- **All five weight classes ship at launch:** Water from level 1, Oil (4), Syrup (7), Foam (60), Mercury (90). Decided 2026-11-12.

### Open questions
1. **Name** (decide at release): "Density" is a generic word, so app-store search will be crowded. Alternatives to check at release: "Density Lab", "Pour & Layer", "Siftwell".
