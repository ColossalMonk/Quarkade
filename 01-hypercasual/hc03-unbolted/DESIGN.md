# hc03 · Unbolted — Design

> Status: **Approved** (2026-11-14). **v1.0 built** (2026-11-17): see `BUILD.md`. Build order: **3rd**. Effort: **M**. Name: **Unbolted** (catalog working title was "Screwball Workshop"; see Decisions made).
> Route: **Open**. CrazyGames first, then Playgama, GameDistribution, GamePix, GameMonetize and YouTube Playables.
> Built on **forge**: portal drivers, tamper-checked saves, ads policy, UI shell (shop, Daily, settings, buy card), press art, editor, zips and the Capacitor app shell. Knotwork and Density proved all of these out.

---

## 1. Concept

**The game in one line:** Take apart gadgets bolt by bolt. Each bolt goes into the toolbox of its colour, and a plate held by just one bolt **swings down on it**, uncovering some bolts and hiding others.

**Thumbnail idea:**
- Close-up of a pegboard workbench with a stack of bright painted metal plates.
- One plate hangs at an angle from its last bolt, mid-swing.
- A screwdriver is twisting out a red bolt, with little spark lines.
- Below, three open toolboxes (red, blue, yellow), the red one with two bolts in it.
- Warm workshop light, no text.

**What it should feel like:**
1. **Clicky and tactile.** A ratchet buzz as each bolt spins out, a clink as it drops into the box, a clang as a plate falls away.
2. **"Ooh, it swings!"** Pulling the second-to-last bolt makes a plate swing and settle. Planning *where* it will hang is the puzzle that other screw games don't have.
3. **Building something.** Every toolbox you close tightens a bolt on a **Gadget** you're restoring: a robot, a cuckoo clock, a go-kart. Finished gadgets fill the shelves of a **workshop you decorate** your way.

**Trend it rides:**
- **Screw puzzles** ("screw jam", "nuts & bolts") have been among the top casual puzzle formats since 2024. Screw Jam (Rollic) and Screwdom lead the category. The format keeps branching out (wool sort is a recent spin-off).
- On CrazyGames there are many screw games, so **it must stand out on sight and in play.**

**How it differs from what already exists:**
- **Swing physics that matters.** In most colour-box screw games, a plate just falls when its last bolt goes. Here a plate held by one bolt (or a hinge) **hangs from it at rest**, which can block bolts below or free them. You choose which bolt to leave so a plate swings out of the way.
- **Deterministic swing.** It looks like physics, but the hanging angle is computed exactly, so every level is guaranteed solvable and the solver can score it. Physics-engine screw games can't promise that.
- **Tidy scoring.** Stars reward putting bolts **straight into their toolbox** instead of parking them in the tray. Most screw games have no skill score at all.
- **A workshop meta:** gadgets that come to life when finished, instead of a plain level counter.

**Length:** a level takes 30–75 s. A session is 6–10 levels (5–10 min). A gadget takes about 10 levels.

---

## 2. Art assets

**Visual approach:** everything is drawn in code, in a 2D orthographic three.js scene, the same way Density's liquids are.

| Element | How it's made |
|---|---|
| **Plates** | One quad per plate with an SDF shape shader: rounded rectangles, bars, L-shapes, discs, rings, triangles, gears. Holes are cut out. Painted-metal look: flat colour, a brushed-metal streak, bevelled edge light, and a soft drop shadow that is larger for higher layers |
| **Bolts** | Instanced quads: hex or cross head with a coloured cap, a highlight, a colour-blind symbol, and a slight spin while unscrewing. Rusty bolts get a noise-textured grey crust |
| **Screwdriver** | A small mesh that pops in over the tapped bolt, twists, then lifts the bolt away (skins change its shape and colour) |
| **Toolboxes** | Flat boxes with a hinged lid (the lid closes with a bounce). Three bolt slots each |
| **Tray** | A strip of 5 magnetic slots under the boxes |
| **Pegboard** | Background shader: a hole grid with a wood or metal tint per theme, plus hanging-tool silhouettes in the margin on wide screens |
| **Special parts** | Hinge pins (grey, unremovable), padlocks (a coloured shackle that pops open), chains (instanced links), glass plates (tinted, see-through) |
| **Particles** | Tiny sparks while unscrewing, dust when a plate falls, confetti and gears when a gadget completes |
| **Gadgets** | Blueprint drawings made of simple shapes, drawn on a 2D canvas, with a bolt dot per slot. A finished gadget plays a short animation (wheels turn, a robot waves) |
| **Workshop rooms** | Flat 2D illustration drawn in code: back wall, window, shelves and workbench per room theme. The 8 decor spot types are shared across rooms, with 3 styles each (24 small drawings), tinted to each room palette |

### Asset list
| Asset | Source | Size |
|---|---|---|
| Plate, bolt, pegboard and glass shaders | Written in GLSL | Code |
| 12 bolt colours with colour-blind symbols | `palette.ts` | Code |
| Plate shape kit (about 20 shapes) | `shapes.ts` (SDF parameters) | Code |
| 40 gadgets: blueprint shapes, bolt slots and colours | `gadgets.ts` (text data) | ~5 KB |
| 5 rooms + 24 decor styles | `rooms.ts` / `decor.ts` (shape data drawn on canvas) | ~30 KB |
| UI kit, icons | forge UI + Kenney (CC0), recoloured workshop orange and steel | ~150 KB |
| Font | Baloo 2 (OFL), already in the repo | ~40 KB |
| Sound and music | WebAudio (forge `Synth`, plus a "workshop" `SongSpec` for `Music`) | Code |

**Sound:**
- ratchet clicks while unscrewing (3–4 fast ticks, rising in pitch)
- a metal "tink" as a bolt lands in a box, and a duller "clunk" in the tray
- a creak as a plate starts to swing, and a clang plus whoosh as a plate drops
- a lid slam when a toolbox closes
- a padlock "click-pop"
- a little machine jingle when a gadget comes to life

**Music:** forge `Music` with a light "workshop" song (plucked bass, woodblock, whistled lead).

**Thumbnails and store art:** `?press=1` renders the hero shot (a swinging plate, the screwdriver and toolboxes) at every portal size, with Density's `press.ts` as the base.

**Size budget:** about 0.8 MB initial download. No textures besides the UI kit.

---

## 3. How ads will work

The same forge policy as Knotwork and Density (`AdBudget`, `interstitialDue`, `buyCard`).

**Interstitial ads:**
- **Shown:** on the level-complete "Next" button.
- **Never shown:**
  - in levels 1–5
  - in the middle of a level
  - after a gadget is completed
  - right after a rewarded ad
- **How often:** every 3+ levels, at least 90 s apart.
- **App "Remove ads":** turns interstitials off.

**Power-ups (coins or one rewarded ad):**

| Item | Coins | One ad gives | Ad limit |
|---|---|---|---|
| ➕ Extra Slot | 150 | 1 | 1 / level |
| 🛢️ Oil Can | 120 | 1 | 1 / level |
| 🔨 Drill | 200 | 1 | 1 / level |
| 🧲 Magnet | 350 | 1 | 1 / level, 5 / day |
| Undo ×5 | 60 | 5 | 2 / level |
| Hint | 80 | 1 | 3 / level |

**Other rewarded ads:**

| Placement | What the player gets |
|---|---|
| **Jammed rescue** (the catalog's "extra toolbox slot") | +1 tray slot and 2 undos, so you keep playing |
| Pre-level boost | Start a Tricky or Masterpiece level with an Extra Slot |
| Double coins | 2× the coins on the win screen |
| Daily retry | Once per day |

**Rules and caps:**
- At most 3 rewarded ads per level and 20 per day.
- Rewarded buttons use 🎬, aren't green, and always sit next to a plain button.

**Free allowance:**
- 2 undos per level
- 3 free uses of each power-up when it unlocks
- 1 random power-up for each finished gadget
- a Magnet for every 7-day streak
- an Extra Slot for winning a Tricky level on the first try

**Portal SDK events:** gameplay start and stop around each level and each modal. A "happy time" when a gadget completes. Mute and pause follow the host. All handled by forge's drivers.

---

## 4. Gameplay and progression

### Controls
- **Tap a bolt** to unscrew it. That's the only action.
- Covered bolts are dimmed and can't be tapped. Tapping one gives a short shake and a "blocked" tick.
- **Desktop:** click. Z undoes, Q/W/E/R use power-ups.

### The rules
1. **The board.** Plates sit on a pegboard in layers, top to bottom. Each plate is held by one or more **bolts**, and each bolt holds one plate (long bolts come later).
2. **What can be tapped.** A bolt is free when no plate on a higher layer covers its head **in that plate's resting position**.
3. **Where a bolt goes.**
   - Two **toolboxes** are open at a time, each a colour, each with room for 3 bolts. More boxes wait in a queue; the next one is shown.
   - A tapped bolt flies into an open box of its colour.
   - If no open box matches, it goes into the **tray** (5 slots).
   - When a box gets its 3rd bolt, it closes and slides away, the next box slides in, and any matching bolts in the tray jump into it.
4. **How plates move (the swing):**
   - **2 or more fixings** (bolts or hinge pins): the plate stays put.
   - **1 fixing:** the plate swings and comes to rest **hanging straight down from it**, with its centre of mass directly below the pivot. That resting position is what covers or uncovers other bolts.
   - **0 fixings:** the plate drops off the board.
5. **The level is won** when every bolt is in a closed box.
6. **Jammed:** a bolt has nowhere to go because the tray is full. The tap is refused, and the Jammed panel offers Undo, Extra Slot (ad or coins), Hint and Restart.

These rules give two kinds of planning:
- **Order of colours.** The box queue is fixed. Bolts that come out "too early" go into the tray, and the tray is small.
- **Order of swings.** Which bolt you leave on a plate decides where it hangs. Leave the left bolt, and the plate swings over the bolts on the right; leave the right one, and it clears them.

### Specials (each introduced alone, with a tip)
| Level | Special | What it does |
|---|---|---|
| 4 | **The swing** | First plate held by 2 bolts. Remove one, and it swings and covers a bolt. Undo, then try the other |
| 12 | **Hinge pins** | Grey pins that never come out. A plate on a hinge swings like a door but never drops |
| 15 | **Rusty bolts** | Crusted grey: you can't see their colour until another bolt on the **same plate** is removed (the plate jolts and the rust flakes off) |
| 30 | **Glass plates** | See-through: you can see the bolts and colours underneath, but they're still blocked |
| 45 | **Padlocked plates** | A padlock in a box colour. The plate's bolts can't be removed until a box of that colour closes |
| 61 | **Chains** | A plate chained to another hangs from the chain when its bolts are gone. It only drops when both plates are free |
| 91 | **Long bolts** | One bolt through two stacked plates. Removing it releases both |

### Power-ups
| Power-up | Unlocks | What it does | Problem it solves | Stars |
|---|---|---|---|---|
| ➕ **Extra Slot** | Level 8 | +1 tray slot for this level (up to 2 per level) | No room | None |
| 🛢️ **Oil Can** | Level 15 | Reveals every rusty bolt's colour | Guessing | None |
| 🔨 **Drill** | Level 25 | Drill out **any one bolt, even a covered one**. It goes to its box or the tray as usual | A key bolt buried under a plate | Caps the level at ★★ |
| 🧲 **Magnet** | Level 40 | Pick an open toolbox: it **pulls bolts of its colour from anywhere** (covered or not) until it's full | A colour scattered under many layers | Caps the level at ★★ |

### Win, stars, coins
In a screw puzzle every bolt is tapped exactly once, so counting taps can't score skill. The score is **tidiness** instead:
- **Detours:** each bolt that went into the tray instead of straight into a box.
- **Par:** the solver's minimum number of detours for the level, plus 1 for every 4 rusty bolts.
- **Stars:**
  - ★★★ at par or better
  - ★★ up to par + 2 (or par × 1.5 if that's higher)
  - ★ for finishing
  - Drill and Magnet cap the level at ★★.
- **HUD:** "Detours 2 · Par 1" in place of moves and par.
- **Coins:** Knotwork's tuned formula.

  | Part | Coins |
  |---|---|
  | Base | 6 |
  | Per star | +3 |
  | Difficulty bonus | +1 per 40 levels, up to +8 |
  | First try | +25% |
  | Tricky level | ×2 |
  | Masterpiece level | +100 |
  | A box in a colour the gadget doesn't need | +1 |

### Progression
- **Gadgets (the main goal).**
  - Each gadget is a blueprint with about 24–30 bolt slots in a few colours, for example "Robot Pal: 8 red, 8 steel, 6 yellow, 6 blue".
  - Every toolbox you close tightens a matching bolt on the blueprint.
  - Level colours are drawn from the gadget's unfilled bolts, the same trick as Knotwork's quilt and Density's towers, with Density's catch-up pour, so a gadget takes about 10 levels.
  - A finished gadget comes to life (wheels spin, the clock chimes, the robot waves) and goes on a shelf in the current **workshop room**.
- **Workshop rooms (decorating).**
  - **5 rooms, each with 8 gadgets:** Garage, Toy Shop, Clockmaker, Shipyard and Space Hangar. Rooms open by total stars (0 / 60 / 150 / 250 / 360).
  - Each room has **8 gadget spots** on its shelves and **8 decor spots**: lamp, rug, poster, radio, plant, stool, window view and sign.
  - **Decor Crate:** every finished gadget gives one. Pick 1 of 2 styles for the next empty decor spot, so every player's room looks a little different.
  - **Restyle:** tap any placed decor to swap it to another style you own, or buy one for coins. Each spot has 3 styles, which gives coins a lasting use.
  - **Where you see it:**
    - the Workshop button opens the room
    - on wide screens it sits in the side panel
    - during play the current room shows softly blurred behind the pegboard, so new decor appears in the game itself
  - **Room complete** (8 gadgets + 8 decor): the room's "OPEN" sign lights up, and you get a **screwdriver skin**.
  - After all 40 gadgets, **Encore** restorations follow, and the rooms stay restyleable.
- **Shop** (after level 20):
  - Screwdrivers: Classic (default), Chrome, Wooden Handle, Neon, Golden, plus workshop rewards
  - Plate finishes: Painted Steel (default), Copper, Plywood, Candy Acrylic
  - Pegboards: Garage, Blueprint, Toy Room, Night Shift
- **Daily Teardown** (after level 20):
  - The same puzzle for everyone each UTC day. Only Extra Slot and Oil Can, no hints.
  - Streak, a calendar of toolboxes, share text ("🔩 Daily Teardown · 0 detours · 🔥 12"), one rewarded retry a day.

### Tutorial (levels 1–20, hand-made)
| Level | Teaches |
|---|---|
| 1 | One plate, 3 red bolts, a red box: "Tap a bolt to unscrew it." The plate drops |
| 2 | Two colours, two boxes |
| 3 | Layers: a top plate covers a bolt, so remove it first |
| 4 | **The swing:** choose which bolt to leave |
| 5 | Undo |
| 6 | The tray: a colour with no box yet goes to the tray, then hops into its box when it arrives |
| 7 | The box queue, and the "next box" preview |
| 8 | Extra Slot unlocks |
| 9 | Stars and detours: "tidy is ★★★" |
| 10 | Tricky! Hint introduced |
| 11 | Using a swing to *clear* bolts |
| 12 | Hinge pins |
| 13–14 | Practice |
| 15 | Rusty bolts + Oil Can |
| 16–19 | Practice |
| 20 | First gadget done; shop and Daily open |

---

## 5. Infinite levels and level progression

### What makes up a level
```
Level = {
  plates:  shape id, position, rotation, layer, glass?, padlock colour?, chain partner?
  fixings: bolts (colour, plate, position, rusty?, long?) and hinge pins (plate, position)
  boxes:   the queue of box colours (each colour appears bolts/3 times)
  tray:    5 (4 on some Tricky levels later on)
  par, D, tag (normal | breather | tricky | masterpiece | tutorial)
}
```
Positions snap to the pegboard grid, so packs stay small and the shapes line up neatly.

### Sources
- **Levels 1–20:** hand-made in `levels-tutorial.json`, using the editor.
- **Levels 21–3020:** six pre-built packs of 500, each level solved twice.
- **Beyond that:** the same generator in the Web Worker.
- **Daily Teardown:** `generateDaily(UTC date)`.

### Generator (solvable by construction, then rated)
1. **Lay out plates** from the shape kit, bottom layer first, overlapping on the grid. The number of layers follows the curve.
2. **Place fixings** in each plate's holes: 1–4 bolts per plate, plus hinge pins, chains, padlocks and long bolts per the curve.
3. **Pick a removal order** with a seeded random walk over the *free* bolts. After each removal, recompute swings and drops with the same rules the game uses. If the walk reaches the end, the order is valid. It also shows which swings matter.
4. **Assign colours along that order.** Group bolts into threes, mostly in order, but with controlled "out of order" picks that will need the tray. Then build the box queue from the groups. Level colours come from the current gadget's unfilled bolts.
5. **Reject** levels that are giveaways: too few covered bolts, or a box filled by three bolts that are free at the start.
6. **Solve** to get par: the minimum number of detours. Search state = remaining bolts (bitmask) + tray contents + queue position + padlock states. Covering is cached per set of remaining fixings on each plate.
7. **Rate** with D, and keep the candidate at the target percentile for this level's rhythm. Same two-phase approach as Density: a quick greedy solve to check and rank, then a careful solve on the pick.

**Swing maths:**
- A plate with one fixing rotates about it until its centroid (shape area minus holes, precomputed per shape) is straight below the pivot.
- Rest angle = `atan2(cx − px, py − cy)` relative to the start pose.
- Coverage tests circle-versus-SDF at the rest pose.
- The animation is a damped spring toward that angle (about 0.4 s). It's purely visual, and taps go by the rest pose immediately.

### How difficulty increases over time
**Eight levers** that start turning at different times:

| # | Lever | Range | What the player feels |
|---|---|---|---|
| 1 | Bolts (colours × 3) | 6 → 45 | More to track |
| 2 | Layers | 1 → 6 | Deeper digging |
| 3 | **Covered share** | 10% → 60% of bolts covered at the start | Less visible, more planning |
| 4 | **Swing traps** | 0 → 4 plates whose "wrong" last bolt covers something you need | The signature puzzle |
| 5 | Queue mismatch | How far the box order is from the easy order | Tray pressure |
| 6 | Tray size | 5 → 4 (Tricky) | Less slack |
| 7 | Specials | Hinges, rusty, glass, padlocks, chains, long bolts | Variety and order constraints |
| 8 | Dead ends | < 5% → 45% of random play gets jammed | How costly carelessness is |

Unlike Density, random play here *does* jam, so the dead-end lever works as intended.

**Difficulty score:**
```
D = 0.25·bolts + 1.2·layers + 4.0·coveredShare + 1.5·swingTraps + 1.0·queueMismatch
    + 2.5·(5 − tray) + 1.0·specials + 6.0·deadEndRate + 0.6·par
specials: hinge 0.3, rusty 0.2 each (max 2), glass 0.3, padlock 1.0, chain 0.8, long bolt 0.5
```

**Target curve:** `D_target(n) = 4 + 14·(1 − e^(−n/180))`. It rises fast early and flattens around level 400. The generator picks a percentile of 8 rated candidates.

**Rhythms:**
- **Gadget chapters** of about 10 levels: easy to start, ending on a "Final Bolt" Tricky.
- Every 5th level is a Breather (−25%), every 10th a Tricky (+30%, ×2 coins), and every 50th after 150 a Masterpiece (a big, showy teardown).

**Timeline:**

| Levels | Bolts | Layers | Covered | Swing traps | New | Dead ends | Par |
|---|---|---|---|---|---|---|---|
| 1–20 | 3–18 | 1–3 | ≤ 30% | 0–1 | swing (4), tray (6), Extra Slot (8), hinges (12), rusty + Oil Can (15) | < 5% | 0–2 |
| 21–44 | 15–24 | 2–4 | 25–40% | 1–2 | Drill (25), glass (30), Magnet (40) | 5–15% | 1–3 |
| 45–89 | 18–30 | 3–4 | 30–45% | 1–3 | padlocks (45), chains (61) | 10–25% | 1–4 |
| 90–200 | 24–36 | 3–5 | 35–55% | 2–3 | long bolts (91), Masterpieces (150), tray 4 on some Tricky levels | 15–35% | 2–5 |
| 201–400 | 27–42 | 4–6 | 40–60% | 2–4 | everything mixed | 25–40% | 2–6 |
| 400+ | 24–45 | 3–6 | 40–60% | 2–4 | **plateau:** variety, not extra difficulty | 25–45% | 2–6 |

**How power-ups fit:**
- Extra Slot arrives with the tray.
- The Oil Can arrives with rusty bolts.
- The Drill arrives before deep layers.
- The Magnet arrives before scattered colours and padlocks.

**Adjusting difficulty when a player struggles** (as Knotwork and Density do):
- A free hint after 2 restarts, or after 1 for struggling players (based on detours versus par).
- An easier version after 3 restarts: the same layout with one fewer layer and an extra tray slot.
- The pre-level boost before Tricky levels.

**Daily seed:** `generateDaily(UTC date)`, a mid-curve level (around D 11) with no padlocks or long bolts, so it's fair for everyone.

---

## 6. As a mobile app

The same Capacitor shell as Knotwork and Density (forge `app` driver and `app-extras`).

| Area | Plan |
|---|---|
| **Wrapper** | Capacitor 8 with AdMob, Google's consent form, Apple's tracking prompt, Preferences saves (tamper-checked) and Haptics |
| **Orientation** | Portrait. The board scales to fit between the HUD and the toolboxes. Bolt heads have a tap target of at least 44 dp, which the generator's grid spacing guarantees |
| **Haptics** | A **ratchet buzz** while unscrewing (3–4 light ticks), a soft tap when a bolt lands, a heavy thunk when a plate drops, a success pattern when a box closes, and a celebration on a finished gadget |
| **Performance** | One quad per plate and instanced bolts: at most about 60 draw items. 60 fps on a 2021 mid-range Android. The solver and generator run in a worker |
| **In-app purchases** | Remove ads, coin packs, power-up bundle, starter pack, all cosmetics (`unbolted_*` IDs) |
| **Notifications** | Opt-in Daily Teardown reminder |
| **Store listing** | Keywords: screw puzzle, nuts and bolts, unscrew, screw jam, satisfying, workshop. Screenshots: the swing moment, toolboxes closing, a gadget coming to life, the Daily Teardown |
| **Compliance** | Rated Everyone, target audience 13+, privacy policy from the template |

---

## Build notes

### Reuse
- **forge:** everything Density used (drivers, `SaveSlot` with its tamper check, Synth/Music, i18n, tweens, the UI shell, `AdBudget`, buy card, shop, Daily, settings, app extras, `build-all`, dev-save).
- **From Density** (worth moving into forge while building this one):
  - level-pack loader
  - worker plumbing
  - the press composer
  - the editor page shell
  - the collection progress pattern: `mapLiquids`/`topUp` becomes a generic "draw level colours from a collection's unfilled slots"
- **New for this game:**
  - `logic/rules.ts`: coverage, swing rest angles, the box queue and tray, specials
  - solver (bitmask search for minimum detours)
  - generator (layout, then a valid removal order, then colours)
  - plate and bolt renderer, swing and drop animation
  - the gadget meta, and the workshop room (shelves, decor spots, crates, restyling)

### Key implementation decisions
- **No physics engine.** Swings are computed exactly (rest pose from the centroid), and drops are cosmetic ballistic tweens. That keeps levels deterministic and solvable, makes undo exact, and keeps the bundle small. It still looks physical: the damped spring overshoots slightly, and falling plates tumble.
- **Coverage uses the rest pose,** even mid-swing, so what you can tap never depends on timing.
- **Each plate's shape is an SDF,** so the same function draws the plate (shader) and tests coverage (CPU).
- **Covered bolts are hidden** under opaque plates (glass plates show them). The editor and hint system use the solver's knowledge, never the player's view.

### Decisions made (2026-11-14)
- **Scoring: tidiness.** Stars come from detours into the tray against the solver's par (§4). No timer.
- **Meta: gadgets and workshop decorating.** Closed boxes restore gadgets. Finished gadgets fill a room's shelves and give Decor Crates for its 8 decor spots, and coins restyle decor (§4 Progression).
- **Name: Unbolted.**
  - **Name check (2026-11-14):** no game is called exactly "Unbolted". Close names:
    - App Store: "Unbolt: Nuts and Bolts Puzzle" and "Unbolt Them All"
    - itch.io and Cinevva: small games called "Unbolt"
  - "Screw Ball" (2024) on CrazyGames is why the working title was dropped.
  - On app stores, use a subtitle such as "Unbolted: Swing Screw Puzzle". Search the trademark registries before the app-store launch.

### Open questions
None.
