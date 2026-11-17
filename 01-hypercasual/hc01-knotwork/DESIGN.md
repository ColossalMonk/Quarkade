# hc01 · Knotwork — Design

> Status: **Complete, v1.0** (2026-11-12). Everything below is built; see `BUILD.md` for the differences and your remaining release steps. Build order: **1st**. Effort: **M**.
> Route: **Open**. CrazyGames first, then Playgama, GameDistribution, GamePix, GameMonetize and YouTube Playables.

---

## 1. Concept

**The game in one line:** Sort yarn loops onto knitting needles by colour. Every needle you finish knits a patch into a quilt picture.

**Thumbnail idea:** A cosy wooden board with a row of needles stacked with chunky, colourful yarn loops. One full needle is flying up and knitting into a half-finished pixel quilt of a cat's face behind the board. Warm light, no text.

**What it should feel like:**
1. **A tidy mind.** The calm, step-by-step logic of a sorting puzzle. Never rushed by default.
2. **Soft, tactile yarn.** Chunky knit textures, fluffy rim light, soft *pops* and wooden needle *clicks*.
3. **Making something.** Your sorting literally builds a picture. Finishing a quilt feels like finishing a craft project.

**Trend it rides:** yarn and wool sorting puzzles, inside the wider sorting-puzzle wave (ball sort, water sort), plus cosy crafting and knitting content.

**How it differs from what already exists:**
- **The quilt.** The colours you sort are the stitches of a picture you're completing. Level colours are drawn from the cells of the quilt that are still empty, so every level visibly moves the picture forward.
- **Special loops added over time:** hidden loops, twisted two-colour loops and moths, so it's more than plain colour sorting.
- **Own look and names.** No UI, art or names borrowed from existing yarn games.

**Length:** a level takes 30–90 seconds. A session is 6–10 levels, about 5–10 minutes. A quilt takes about 10–14 levels.

---

## 2. Art assets

**Visual approach:** 2.5D, made almost entirely in code. A three.js **perspective camera with a narrow field of view**, looking down at the board at about 25°, gives a gentle sense of depth without any 3D art.

| Element | How it's made |
|---|---|
| **Yarn loop** | A three.js torus, flattened. A **knit shader** fakes the ribbed stitch bumps with a generated surface pattern, adds a fuzzy rim glow and a little thread noise. One shape is reused for every loop, with only the colour changing |
| **Needle** | A thin cylinder with a ball on top. The material (wood, bamboo, steel, candy) is set by shader settings |
| **Board** | One quad with a wood-grain shader (generated rings plus noise), or a felt shader for other themes |
| **Quilt** | An 8×8 grid of patches. Each patch is a quad with a **stitch shader** (repeating V-shaped stitches), a slightly puffy shape and running-stitch seams |
| **Fluff particles** | A soft dot texture with a gentle drift |
| **Moth** (special) | A tiny flat shape made of 3 triangles and a body, with flapping driven by a shader |
| **Background** | A warm gradient with a soft vignette. Each theme changes the colours |

### Asset list

| Asset | How many | Source | Licence | Size |
|---|---|---|---|---|
| Shaders (knit, wood, felt, stitch, fluff) | 5 | Written by hand in GLSL | Own | Code |
| Yarn palette | 12 colours that stay distinct for colour-blind players, each with a **symbol** (dot, stripe, cross, wave…) for colour-blind mode | Picked using Lospec palettes and a colour-blindness simulator | Own | Code |
| Quilt pictures | 40 at launch, each **8×8 pixels with up to 6 colours**, written as text grids in JSON | Hand-made (8×8 is simple enough to draw as letters in a text file). Simple CC0 1-bit or pixel icons from Kenney packs can serve as references | Own / CC0 | ~100 bytes each |
| UI kit | Buttons, panels, icons | Kenney UI pack, recoloured to warm wood and cream | CC0 | ~150 KB |
| Booster icons | Undo, extra needle, reveal, hint | Kenney icons or simple shapes | CC0 | small |
| Font | 1 rounded display font | Google Fonts (Baloo 2 or Fredoka) | OFL | ~40 KB, subset |

**The 40 quilt pictures, in 5 themed albums of 8:**

| Album | Pictures |
|---|---|
| **Cosy Home** | cat face, teacup, house, heart, candle, cookie, slippers, plant |
| **Garden** | sunflower, mushroom, snail, bee, carrot, tulip, ladybug, watering can |
| **Seaside** | fish, crab, sailboat, shell, whale, lighthouse, anchor, wave |
| **Sweets** | cupcake, ice cream, donut, candy, cherry, lollipop, cake slice, strawberry |
| **Night Sky** | moon, star, owl, rocket, planet, comet, lantern, fox |

**Sound:** all generated with WebAudio, so there are no files to download.

| Sound | How it's made |
|---|---|
| **Loop lift** | A soft filtered-noise *fwip* |
| **Loop drop** | A muffled thump. The pitch varies a little with how many loops are moved |
| **Needle click** | Two short wooden clicks (a band-passed noise burst) |
| **Knitting** | Fast clicks that speed up as a patch forms |
| **Quilt complete** | A warm chord arpeggio |
| **Invalid move** | A gentle low *bonk* |

Music is optional: one cosy CC0 acoustic loop of about 300 KB, set to low volume.

**Thumbnails and store art:** captured in-game from a debug "thumbnail mode" that lays out the board, the knitting needle flying up and the half-finished quilt. Export every portal size from 1920×1080 and 1080×1920 masters.

**Size budget:** about **1.4 MB** initial download, plus about 120 KB per level pack (see §5).

---

## 3. How ads will work

All calls go through the **forge** adapter: `ads.break()`, `ads.rewarded(placement)` and `game.happy()`.

### Interstitial ads
- **Shown:** on the level-complete screen when the player taps **Next**, after the knitting animation.
- **Never shown:**
  - during levels 1–5 (tutorial and first impression)
  - in the middle of a level
  - on restart
  - straight after a rewarded ad
  - straight after a quilt is completed (let the celebration land)
- **How often:** at most one every 3 levels *and* at least 90 seconds apart. Portal rules apply on top.

### Power-ups and tools: pay with coins or watch an ad
Every power-up and tool can be **bought with coins** (the patient way) or **earned by watching a rewarded ad** (the quick way). What each power-up does is in §4.

| Item | Coin price | One ad gives | Ad limit |
|---|---|---|---|
| **Spare Needle** | 150 | 1 | 1 per level |
| **Lantern** | 120 | 1 | 1 per level |
| **Snip** | 200 | 1 | 1 per level |
| **Yarn Swift** | 350 | 1 | 1 per level, 5 per day |
| Undo ×5 | 60 | 5 undos | 2 per level |
| Hint | 80 | 1 | 3 per level |

**How buying works:**
- When a power-up's count is **0**, tapping it opens a small card with two buttons: **▶ Watch ad** and **🪙 150**.
- Overall ad caps: **3 rewarded ads per level** and about **20 per day**. Beyond that, only coins work. This avoids ad fatigue and stays well inside portal ad rules.

**Pricing logic:** a level pays about **25–40 coins** on average (§4), so one power-up costs **5–12 levels' worth of coins**. Coins feel valuable, ads feel like a fair shortcut, and cosmetics give coins a second use.

### Other rewarded ads
| Placement | What the player gets | When it's offered | Limit |
|---|---|---|---|
| **Stuck rescue** | Spare Needle + 2 undos | Stuck panel, when you have no power-ups | Once per level |
| **Pre-level boost** | Start the level with a Spare Needle already placed | Before Tricky and Masterpiece levels | Once per such level |
| **Double coins** | 2× the coins earned | Level-complete screen | Every level |
| **Daily retry** | A second attempt at the Daily Swatch | Daily result screen | Once per day |

### Free power-ups (so ads never feel required)
- **2 free undos** in every level.
- **3 free uses** of each power-up when it first unlocks.
- **1 random power-up** for each finished quilt.
- A **Yarn Swift** every **7 days** of streak.
- **1 Spare Needle** for every Tricky level won on the first try.

### Portal SDK events
| Event | When it fires |
|---|---|
| `gameplayStart` | The first tap in a level |
| `gameplayStop` | Level complete, pause, stuck panel, or an ad starting |
| `happyTime` | Quilt completed, a level 3-starred on the first try, the Daily Swatch beaten |
| Pause and mute | Audio and the game pause when an ad starts or the tab is hidden, and resume afterwards |
| Loading | Report loading progress; signal "loading finished" once the menu and level pack are ready |

### Platform notes
Same as every open-route game. Use the forge driver for each platform. YouTube Playables: the bundle is about 1.6 MB, well under the limits. CrazyGames Basic Launch can run without ads.

---

## 4. Gameplay and progression

### Controls
- **Tap a needle** to lift its top run of loops: all loops of the same colour at the top move together. They hover above the needle.
- **Tap another needle** to drop them there. If they don't all fit, as many as fit go and the rest go back.
- **Tap the same needle again**, or empty space, to put them back.
- **Desktop:** click works the same. Number keys 1–9 and 0 pick needles. Z undoes. Q / W / E / R use the four power-ups.
- No dragging. Tap-tap is quicker, works with one thumb, and makes fewer mistakes on small screens.

### Rules
- A needle holds up to **C** loops (normally 4; from level 30, short needles hold 3 and long ones hold 5).
- Loops can only be dropped on an **empty needle** or on top of **the same colour**.
- A needle filled with **C loops of one colour** is complete. It clicks, knits a patch into the quilt, and becomes a finished **locked** needle.
- **The level is won** when every colour is complete.
- **Stuck:** no legal move would change anything. The stuck panel offers **Undo / Spare Needle / Snip / Hint / Restart**, each showing how many you hold. Any you have none of show the ad and coin buttons instead (§3).

### Special loops (introduced gradually)
| Level | Special | What it does |
|---|---|---|
| 15 | **Hidden loop** | Grey and fuzzy. Its colour shows only when it reaches the top of a needle. |
| 30 | **Short and long needles** | Needles that hold 3 or 5 instead of 4. |
| 45 | **Twisted loop** | Two colours twisted together. It can sit on either of its colours and counts toward completing either one. The skill is deciding where it should go. |
| 60 | **Knot** | Two loops tied together. They always move as a pair, so you need room for both. |
| 80 | **Moth** (only in levels labelled "Moth") | A moth lands on a needle and chews its top loop after 6 moves unless that needle is used. It adds gentle pressure without a timer. |

Each special first appears on its own, in an easy level with a one-line tip, then mixes in with the rest.

### Power-ups
Four power-ups sit in a bar at the bottom of the screen, each showing how many you hold. Every one is themed on a real knitting tool or habit, and each solves a *different* kind of problem, so none of them makes another pointless.

| Power-up | Unlocks | What it does | Problem it solves | Effect on stars |
|---|---|---|---|---|
| 🪡 **Spare Needle** | Level 8 | Adds one empty needle (holds 4) for the rest of the level | Not enough room to sort | None |
| 🏮 **Lantern** | Level 15 | Shows the colour of **every hidden loop** for the rest of the level | Guessing what's hidden | None |
| ✂️ **Snip** | Level 25 | Tap **any** loop, even one buried at the bottom. Scissors cut it out and drop it into a **Basket** next to the board that holds 2 loops. Loops in the Basket can later go onto any needle where they're allowed | One colour you need is buried deep | Caps the level at ★★ |
| 🧶 **Yarn Swift** | Level 40 | Pick a colour. A yarn swift spins and winds **every loop of that colour**, wherever it is, onto one needle and completes it instantly. Needles left empty stay on the board | A tangled endgame, Tricky levels | Caps the level at ★★ |

**How power-ups interact with special loops:**
- **Snip on a knotted loop** cuts the knot as well. It takes the loop you tapped and leaves its partner behind. This is a smart way to use it.
- **Snip** can rescue a loop a moth is about to chew.
- **Yarn Swift** also collects twisted loops that contain the chosen colour.
- **Lantern** has no effect on twisted loops, because they're never hidden.

**Rules:**
- **Unlocking:** the first time a power-up unlocks, a short guided step has you use it once for free. You then get **3 free uses** to keep.
- **Daily Swatch:** only Spare Needle and Lantern can be used, so scores stay fair between players.
- **After any power-up,** the solver re-checks the board in the background, so hints and stuck detection stay correct.

**Why Snip and Swift cap stars:** they skip the puzzle's actual thinking. Capping at ★★ keeps ★★★ meaningful, and it never blocks anyone, because albums unlock by total stars and ★★ is plenty. Spare Needle and Lantern only give room or information, so they're free to use.

### Win, stars, coins
- **Par** = the length of the solver's solution (§5). It's shown as a small number at the top.

  | Stars | Moves |
  |---|---|
  | ★★★ | ≤ par |
  | ★★ | ≤ par × 1.4 |
  | ★ | Level finished |

- **Undos don't count as moves.** Spare Needle and Lantern don't affect stars. Snip and Yarn Swift cap the level at ★★.
- **Coins** for a level:

  | Part | Coins |
  |---|---|
  | Base | 10 |
  | Per star | +5 |
  | Difficulty bonus | +1 for every 20 levels reached, up to +20 |
  | First try | +25% |
  | Tricky level | ×2 |
  | Masterpiece level | +200 |

  Rewards rise with difficulty, so power-ups stay affordable as levels get harder. Power-up prices never change.

### Progression
- **The quilt (the main goal):** one 8×8 quilt picture is being knitted at a time. Every completed needle fills the next empty cell **of that colour** in the quilt. The generator picks each level's colours from the quilt's remaining cells (§5), so every level adds visible stitches. A finished quilt goes into its **album**. Finishing an album of 8 quilts unlocks the next album and a new needle skin.
- **Coins buy cosmetics and some boosters:**

  | Item | Examples | Price |
  |---|---|---|
  | Yarn styles | chunky wool, mohair (fuzzier), cotton (smooth), metallic, rainbow-dyed | 300–1,500 |
  | Needle skins | bamboo, steel, candy-cane, crystal | 300–1,500 |
  | Board themes | oak, felt, picnic cloth, starry | 300–1,500 |
  | Power-ups and tools | Spare Needle, Lantern, Snip, Yarn Swift, undo pack, hint | 60–350 (see §3) |

- **Daily Swatch:** one hard level a day that's the same for everyone. It has its own small quilt square. Keeping a **streak** fills a monthly calendar quilt, which is the reason to come back every day.
- **Albums unlock by total stars**, so nobody gets stuck behind one hard level.

### Tutorial (levels 1–20, hand-made)
| Level | Teaches |
|---|---|
| 1 | 2 colours, 3 needles. "Tap a needle, then tap where to put it." Solved in 3 moves |
| 2 | 3 colours. A full needle is complete and the first patch knits |
| 3 | The quilt screen is introduced: "Your sorting knits this picture" |
| 4 | Groups of the same colour move together |
| 5 | Undo is introduced |
| 6–9 | 4–5 colours, with stars and par explained at level 6. **Spare Needle unlocks at level 8** (guided use, then 3 free) |
| 10 | The first "Tricky" level. Hint introduced, with one free |
| 11–14 | 5–6 colours |
| 15 | Hidden loops introduced, and **Lantern unlocks** alongside them |
| 16–19 | Mixed practice |
| 20 | The first quilt is done (cat face), an album celebration, and the shop opens |

---

## 5. Infinite levels and level progression

### What makes up a level
```
Level = {
  colours:   k colours (3–11), each with C loops
  needles:   k + e needles (e = empty needles: 2 early, sometimes 1 later)
  capacity:  C per needle (4, or a mix of 3/4/5 after level 30)
  stacks:    starting order of the loops on each needle
  specials:  hidden / twisted / knot / moth settings
  par:       solver solution length
  rating:    difficulty score (see below)
  tag:       normal | breather | tricky | moth | masterpiece | finishing-stitch
}
```

### Levels come from two sources
1. **Pre-made level packs (most of the content).** An offline **Node script** (in forge's tools) generates candidate levels, **solves each one** and **rates it**. Each level is stored as a short string of about 40–60 bytes.

   | Pack | Levels | Size |
   |---|---|---|
   | Pack 1 (ships with the game) | 1–500 | ~25 KB gzipped |
   | Each later pack (loaded lazily, 500 levels) | 500 | ~25 KB |

   **3,000 levels ship at launch.** Every one is checked as solvable, and each has a par and a rating.
2. **Generating at runtime (truly endless).** Past the shipped packs, the same generator and solver run in a **Web Worker** using `seed = hash(levelNumber, "knot-v1")`, with a 150 ms time limit. If a candidate isn't solved in time, the next seed is tried. The fallback is one extra empty needle, which almost always makes a level solvable, and the solver still checks it.

### Generator
1. **Pick the colours** from the current quilt's **remaining cells**, weighted by how many are left. Late in a quilt, fill in with other palette colours. This is how levels move the picture forward.
2. **Shuffle the loops** randomly across k needles, without allowing a needle to start already complete or almost complete, and without the same colour 3 deep at the top.
3. **Add specials** according to the current stage of the curve.
4. **Solve** with an **A\*/IDA\*** search. States are stored in a standard form (needle order doesn't matter), and the heuristic counts the colour breaks within needles. The solver returns the solution length (**par**) and stats.
5. **Rate** the level with the difficulty score **D**, defined under "How difficulty increases over time" below.
6. **Accept** the level if its D is within ±10% of `D_target(n)` (after applying the rhythm for that level, such as Breather or Tricky). Otherwise reroll.

### How difficulty increases over time
Difficulty isn't one dial. It comes from **six levers that start turning at different points**, so the game keeps feeling *new*, not just *bigger*. Difficulty never comes from a clock. The only pressure is the moth, and that counts moves, not seconds.

| # | Lever | Range over the game | What the player feels |
|---|---|---|---|
| 1 | **Colours** (k) | 2 → 11 | More to keep track of, longer solutions |
| 2 | **Room to move** | 2 empty needles → 1; needles that hold 3/4/5 instead of all 4 | Fewer places to park loops, so you have to plan ahead |
| 3 | **How deep colours are buried** | Colours sit near the top → buried at the bottom and scattered | More digging before anything can be sorted |
| 4 | **Hidden information** | 0 → 40% of loops hidden | Uncertainty, which is where Lantern earns its keep |
| 5 | **Special rules** | Twisted loops → knots → moths | New *kinds* of thinking, not just more of the same |
| 6 | **Dead ends** | Under 5% → 40% of careless play gets stuck | How much a careless move costs you |

#### Difficulty score
The pack builder works out a score **D** for every candidate level from the solver's results:

```
D = 0.8·k                      // colours
  + 3.0·(2 − e)                // fewer empty needles
  + 1.5·burial                 // 0–1, how far down colours are buried, averaged
  + 4.0·hiddenShare            // 0–0.4
  + 1.0·specialsWeight         // twisted 1, knot 1.5, moth 2, per kind in the level
  + 6.0·deadEndRate            // share of 200 random playouts that get stuck
  + 0.05·par
```

These weights are a starting point. Retune them with real data: the share of first-try clears, power-up use, and quit rates for each level band.

#### The target curve
```
D_target(n) = D_start + (D_cap − D_start) · (1 − e^(−n / 180))
D_start ≈ 4    D_cap ≈ 18
```
It rises quickly early on, while players are learning, then flattens out from about level 400–500.

#### Three rhythms on top of the curve
1. **Each quilt is a chapter of about 12 levels.** It opens easy (−20%), climbs, and ends with a **"Finishing Stitch"** Tricky level (+30%) that knits the last patch. Every quilt is a small story arc.
2. **Fixed beats:**

   | Every… | Level type | Target | Extras |
   |---|---|---|---|
   | 5th level | **Breather** | −25% | — |
   | 10th level | **Tricky** | +30% | ×2 coins |
   | 25th level after level 80 | **Moth** | — | — |
   | 50th level after level 150 | **Masterpiece** | +45% | 200 coins + 1 Yarn Swift; Pre-level boost offered |

3. **Within a session:**
   - After a fail or restart, the next level is −10%.
   - After 2 Tricky wins in one session, the next level is a Breather.
   - This keeps a session from turning into a frustrating streak.

#### Timeline

| Levels | Colours | Empty needles | Capacity | Hidden loops | New this stage | Dead-end rate | Typical par |
|---|---|---|---|---|---|---|---|
| 1–20 | 2–6 | 2 | 4 | 0, then 1–2 loops from level 15 | Spare Needle (8), hidden loops + Lantern (15) | < 5% | 3–20 |
| 21–44 | 5–7 | 2 | 4; 3/5 from level 30 | ≤ 15% | Snip (25), short and long needles (30), Yarn Swift (40) | 5–15% | 18–30 |
| 45–79 | 6–8 | 2 | Mixed | ≤ 20% | Twisted loops (45), knots (60) | 10–20% | 25–35 |
| 80–200 | 7–9 | 2, or 1 on Tricky levels | Mixed | ≤ 30% | Moths (80), Masterpieces (150) | 15–30% | 30–45 |
| 201–400 | 8–10 | 1–2 | Mixed | ≤ 35% | All specials mixed together | 20–35% | 35–55 |
| 400+ | 7–11 | 1–2 | Mixed | ≤ 40% | **Plateau:** variety, not extra difficulty | 25–40% | 40–60 |

**Why it levels off:** past about level 400, "harder" stops feeling like a challenge and starts feeling like frustration. Long-term players stay for:
- quilts and albums
- the Daily Swatch and streak
- Masterpiece levels
- new combinations of special loops

Puzzles never become unfair.

#### How power-ups fit the curve
- Each power-up unlocks **just before** the problem it solves becomes common:
  - Spare Needle comes before rooms get tight.
  - Lantern comes with hidden loops.
  - Snip comes before deep burial.
  - Yarn Swift comes before twisted loops and knots.
- Coin rewards grow with level number (§4), so a player who never watches ads can still afford about one power-up every 6–10 levels at any stage.

### Hand-made levels
Levels **1–20** are hand-made in `levels-tutorial.json` (written with the editor in forge, then checked by the solver).

### Adjusting difficulty when a player struggles
A puzzle layout is fixed, so the game helps instead of changing the level:
- Restart the same level twice → one free hint.
- Restart it three times → offer an "easier version": the same colours plus one extra empty needle. This is a different stored level, and the player still earns ★.
- The player's skill score (based on how close they get to par) shifts where they start in the next difficulty band by ±10%.

### Daily Swatch seed
`seed = hash(UTC date, "knot-daily")`, always rated in the "tricky" band. Everyone gets the same puzzle, and the result can be shared as an emoji grid of moves versus par for social posts.

---

## 6. As a mobile app

| Area | Plan |
|---|---|
| **Wrapper** | Capacitor (Android + iOS), with forge's `app` driver |
| **Orientation** | Portrait only. Up to **2 rows of 6 needles**. Each needle's tap area is at least **48 dp wide**, padded beyond what you can see |
| **Touch** | Tap-tap only. A lifted run bobs gently so its state is obvious |
| **Haptics** | Light tick on lift, medium bump on drop, double tap on an invalid move, a success pattern when a needle completes, a long celebration when a quilt is done |
| **Performance** | Instanced torus meshes, so all loops are a single draw call. Fine on a low-end 2019 Android phone. The solver runs in a worker, so the UI never stalls |
| **App size** | ~8 MB with all level packs included. Fully offline |
| **Ads** | AdMob rewarded ads in the same placements as §3. Interstitials capped the same way. Google UMP consent; App Tracking Transparency on iOS |
| **In-app purchases** | **Coin packs** (small / medium / large), **power-up bundles** (for example 5 Spare Needles + 3 Snips + 2 Yarn Swifts), **remove ads** (interstitials only; rewarded ads still available), **yarn and needle cosmetic packs**, and a one-time **starter pack** (coins + 3 of each power-up). Power-up prices in coins stay the same as on the web. No energy or lives system: never block play |
| **Saves** | Capacitor Preferences with the same save format as the web build: level number, stars, coins, quilt progress, albums, streak. Cloud save later |
| **Notifications** | Opt-in only: one local reminder a day for the Daily Swatch and streak |
| **Store listing** | Keywords: yarn sort, wool sort, knit, colour sort puzzle, cosy, relaxing. Screenshots: board + quilt, album page, special loops, Daily Swatch. A short preview clip of a needle knitting into the quilt |
| **Compliance** | Privacy policy. Rated Everyone; target audience 13+. Colour-blind mode is a store-listing feature as well as an accessibility one |

---

## Build notes

### Key implementation decisions
- **How the game state is stored:** each needle is an array of loop IDs, plus a separate table describing each loop (its colour or twisted colour pair, whether it's hidden, knots). The state also includes the **Basket** (up to 2 loops) and any **Spare Needles** added. Power-ups are **actions on the state**, so undo, the solver and replays all handle them the same way as normal moves. The **same code module** is shared by the game, the solver worker and the offline pack builder.
- **Economy settings:** prices, ad caps, free allowances and coin rewards all live in one `economy.json`, so balance can be tuned without code changes.
- **Solver:** IDA\* that stores visited states by a hash of their standard form. Some moves are always safe (for example, moving loops onto the only matching needle when nothing else is possible), so the solver plays those automatically to search less.
- **Rendering:** one `InstancedMesh` for all loops, one for the needles, and the quilt as a single grid mesh whose cells are updated as patches are added. Animations use short arcs (lift 120 ms, travel 180 ms, settle with a 90 ms squash).
- **Level pack format:** levels are written as text, for example `4|ab,cba,bca,|h:2,7`, then gzipped.
- **Level editor:** a debug page in forge where you paint stacks, run the solver, see par and rating, and save to JSON. Used for levels 1–20 and for tuning.
- **Colour-blind mode:** symbols are drawn onto the loops by the knit shader, so no extra art is needed.

### Decisions made
- **A completed needle locks in place.** It doesn't disappear. Decided 2026-11-12.
- **Quilts are 8×8:** 64 patches, about 12 levels per quilt. Decided 2026-11-12.
- **Moth levels stay** (every 25th level after level 80, counting moves, never a clock). Decided 2026-11-12.

### Open questions
- None. The design is approved and ready to build.
