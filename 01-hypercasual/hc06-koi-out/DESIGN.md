# hc06 · Koi Out — Design

> Status: **Approved** (2026-11-19). **v1.0 built** (2026-11-19): see `BUILD.md`. Build order: **6th**. Effort: **M** (the catalog said S; the koi shader, the swimming along bent bodies and the journey map make it M). Name: **Koi Out** (catalog working title "Outbound"; see Decisions made).
>
> Route: **Open**. CrazyGames first, then Playgama, GameDistribution, GamePix, GameMonetize and YouTube Playables.

**Sources for this design:** a 2026-11-19 search of the arrow-escape genre:
- The App Store has dozens of 2026 "Tap Away / Arrow Escape" titles, including one from Easybrain.
- CrazyGames has Arrow Escape: Puzzle (SolvePlay, rated about 9.3) and Arrow Escape (Bravestars, about 8.8), both from 2026.
- Every one of them is plain arrows on a grid. No koi or fish version turned up.

---

## 1. Concept

**The game in one line:** A crowded koi pond. Tap a koi and it swims out head-first, its body following, unless another koi is in the way. Free them all.

**Thumbnail idea:**
- A top-down garden pond, packed with koi of every pattern (red-and-white, gold, black-and-orange), each curled a different way.
- One long koi is mid-escape, gliding out through a gap in the reeds, leaving ripples.
- Lily pads and a lotus flower; soft dappled light; no text.

**What it should feel like:**
1. **"Swish."** The satisfying glide of a koi slipping out along its own curve, with a ripple trail and a splash.
2. **Careful reading.** Every koi faces somewhere. Find the ones with a clear way out. A wrong tap makes the koi bump its nose and costs a heart.
3. **A journey.** Every freed koi joins your Koi Journal, and the koi travel upstream on a map, from a garden pond to the Dragon Gate falls.

**Trend it rides:**
- **Arrow escape / tap-away puzzles**, one of 2026's busiest mobile puzzle genres.
- Calm, pretty "zen" puzzles, and koi as a popular relaxing motif.

**How it differs from what already exists:**
- **Koi instead of arrows.** The same clear rule, but alive: bodies curve, fins flick, and a long koi winds out along its own path.
- **Pond twists** that change the order you need: lily pads, reed banks, whirlpools that turn koi, frogs that hop off after a while, and currents that bend a koi's path.
- **A meta with a story:** the Koi Journal album (40 varieties) and the upstream journey map.

**Length:** a level takes 20–60 s. A session is 8–12 levels (5–10 min). A journal page takes about 10 levels.

---

## 2. Art assets

**Visual approach:** a 2D orthographic three.js scene seen from above, as in Density, Unbolted and Snug Bento. Everything is drawn with shaders on quads.

| Element | How it's made |
|---|---|
| **Koi** | One mesh per koi: a smooth tube along its cell path (a ribbon strip built from the path's centreline, widest behind the head, tapering to the tail), with a fin and tail quad. A koi shader paints the variety's pattern (white base with red patches, gold scales, black-and-orange, and so on), a soft scale texture and a darker back line. The tail wiggles while it waits; the whole body flexes as it swims |
| **Fry (one-cell koi)** | A small round-bodied baby koi with the same shader |
| **Pond** | A water shader: depth gradient, caustic light ripples, drifting light dapples, and ripple rings where koi move. The pond's cell grid is a faint pattern on the floor |
| **Bank** | Stones and grass around the pond edge, drawn by the same shader from the pond's outline (ponds can be odd shapes) |
| **Twists** | Lily pads (with an occasional lotus), reed banks along the edge, whirlpools (a turning swirl), frogs on lily pads (with a count), current arrows on the water |
| **Particles** | Ripple rings, a splash and bubbles when a koi leaves, a little "bonk" star when one is blocked |
| **Journey map** | Drawn on a canvas: a winding river from the Garden Pond to the Dragon Gate, with a dot per level and a landmark per region |
| **Koi Journal** | A grid of variety cards drawn on canvas: the koi in its pattern, its name, and a sighting count |

### Asset list
| Asset | Source | Size |
|---|---|---|
| Koi, water and bank shaders | Written in GLSL | Code |
| 40 koi varieties: pattern parameters and colours | `varieties.ts` (code) | Code |
| 6 regions: name, palette, landmark | `regions.ts` (text data) | ~2 KB |
| UI kit and icons | forge UI plus Kenney (CC0), recoloured in jade, vermilion and cream | ~150 KB |
| Font | Baloo 2 (OFL), already in the repo | ~40 KB |
| Sound and music | WebAudio (forge `Synth`, plus a "garden" `SongSpec` for `Music`) | Code |

**Sound:**
- a soft "swish" as a koi swims, longer for long koi
- a little splash as it leaves the pond
- a "bonk" with a bubble pop when a koi is blocked
- a water-drop pling on the last koi, and a temple bell on a no-heart-lost level
- a frog's croak, a whirlpool's swirl, reeds rustling

**Music:** forge `Music` with a calm garden song (koto-like plucks, soft pad, wind chime).

**Thumbnails and store art:** `?press=1` renders the hero shot (a crowded pond with one long koi gliding out) at every portal size.

**Size budget:** about 0.7 MB initial download.

---

## 3. How ads will work

The same forge policy as the other games (`AdBudget`, `interstitialDue`, `buyCard`).

**Interstitial ads:**
- **Shown:** on the level-complete "Next" button.
- **Never shown:**
  - in levels 1–5
  - in the middle of a level
  - after a journal page is completed
  - right after a rewarded ad
- **How often:** every 3+ levels, at least 90 s apart.
- **App "Remove ads":** turns interstitials off.

**Power-ups (coins or one rewarded ad):**

| Item | Coins | One ad gives | Ad limit |
|---|---|---|---|
| ✨ Glow | 100 | 1 | 1 / level |
| 🪷 Lotus | 150 | 1 | 1 / level |
| 🥅 Net | 200 | 1 | 1 / level |
| 🍞 Bread | 300 | 1 | 1 / level, 5 / day |
| Hint | 80 | 1 | 3 / level |

**Other rewarded ads:**

| Placement | What the player gets |
|---|---|
| Net (the catalog's "remove one tile") | Lifts one koi out of the pond |
| Out of hearts | +1 heart and carry on (up to 2 times a level) |
| Pre-level boost | Start a Tricky or Dragon Gate level with a Lotus (an extra heart) |
| Double coins | 2× the coins on the win screen |
| Daily retry | Once per day |

**Rules and caps:**
- At most 3 rewarded ads per level (the out-of-hearts ad doesn't count towards this) and 20 per day.
- Rewarded buttons use 🎬, aren't green, and always sit next to a plain button.

**Free allowance:**
- 3 free uses of each power-up when it unlocks.
- 1 random power-up for each finished journal page.
- A Bread for every 7-day streak.

**Portal SDK events:** gameplay start and stop around each level and each modal. A "happy time" on a level with no heart lost and when a journal page completes. Mute and pause follow the host.

---

## 4. Gameplay and progression

### Controls
- **Tap a koi** to send it swimming. That's the only input.
- **Desktop:** the mouse works the same way. Z undoes the last escape (it never gives back a lost heart), and Q/W/E/R use power-ups.

### The rules
1. **The pond:** a grid of cells, sometimes an odd shape (bays, islands of stones).
2. **The koi:** each koi lies along a path of cells, with its head at one end facing straight on (away from the cell behind it). Fry are one cell long and face a direction.
3. **Swimming out:** a tapped koi swims forward in a straight line from its head, its body following along its own path, until it leaves the pond.
4. **Blocked:** if anything lies on that straight line before the edge (another koi's body, a lily pad, a reed bank on the edge), the koi swims up to it, bumps its nose and swims back to where it was. **That costs a heart.**
5. **Hearts:** 3 per level. Out of hearts: retry the level, or watch an ad for +1 heart (up to 2 times).
6. **The level is won** when every koi has left the pond.
7. Every level has a solution, which the generator guarantees.

### Specials (each introduced alone, with a tip and the coach's pointing hand)
| Level | Special | What it does |
|---|---|---|
| 12 | **Lily pads** | Fixed lily pads in the pond. They block like a koi and never move |
| 25 | **Reed banks** | Stretches of the pond edge are reeds. A koi can only leave where the bank is open water |
| 30 | **Long koi** | Koi 3–8 cells long, bent along their paths. They swim out head-first and their body follows |
| 45 | **Whirlpools** | A koi lying on a whirlpool turns its head a quarter turn each time another koi leaves the pond |
| 61 | **Frogs** | A frog sits on a lily pad with a count. It blocks until that many koi have left, then hops away |
| 91 | **Currents** | A current arrow on the water bends a swimming koi's path a quarter turn as its head passes over it |

### Power-ups
| Power-up | Unlocks | What it does | Problem it solves | Stars |
|---|---|---|---|---|
| ✨ **Glow** | Level 8 | For 3 s, every koi that can swim out right now glows | "Which one is free?" | None |
| 🪷 **Lotus** | Level 15 | +1 heart for this level | One heart left | None |
| 🥅 **Net** | Level 25 | Tap a koi: it's lifted out of the pond, wherever it is | One stubborn koi | Caps the level at ★★ |
| 🍞 **Bread** | Level 40 | Tap a koi, then a direction: it turns its head to face that way (if the cell ahead of the head is free) | A koi facing the wrong way | Caps the level at ★★ |

### Win, stars, coins
- **Stars by hearts left:** ★★★ with all 3 hearts, ★★ with 2, ★ with 1 (Lotus hearts count on top, so a Lotus can save a ★★★).
- Net and Bread cap the level at ★★.
- **Coins:** the shared formula (base 6, +3 per star, a difficulty bonus, +25% first try, ×2 Tricky, +100 Dragon Gate).

### Progression
- **The journey and the Koi Journal (the main goal):**
  - **Six regions** up the river: **Garden Pond, Temple Pond, Rice Paddies, Bamboo Stream, Moonlit Lake and the Dragon Gate falls**. Each region has its own water colour, bank and landmark (a stone lantern, a red bridge, terraces, bamboo, a moon, the falls).
  - Each region is a **journal page of 8 koi varieties** (Kohaku, Showa, Sanke, Ogon, Asagi, Bekko and so on, 40 in all plus a few rare ones).
  - A level's koi are drawn from the current page's unfinished varieties (the same trick as quilts, gadgets, recipes and displays). Every koi you free is a **sighting**; a variety needs a set number of sightings to be complete in the journal. A page takes about 10 levels.
  - A finished page moves the journey on: the map's river reaches the next region, with a little scene of the koi swimming upstream. The region's **pond theme** (water colour, bank, decoration) becomes yours.
  - Regions open by total stars (0 / 60 / 150 / 250 / 360 / 480). After all six, **Encore** pages follow (rare colour forms).
  - **The journey map** is the level-select view: the river with a dot per level, and the region landmarks.
- **Shop** (after level 20):
  - Pond themes: from the regions, plus Autumn Leaves and Snowy Garden for coins
  - Ripple trails: Plain, Petals, Bubbles, Sparkles
  - Lily pad styles: Green, Pink Lotus, Water Lily, Maple
- **Daily Pond** (after level 20):
  - The same pond for everyone each UTC day. Only Glow, no hints.
  - Streak, a calendar of tiny ponds, share text ("🎏 Daily Pond · ❤️❤️❤️ · 🔥 12"), one rewarded retry a day.

### Tutorial (levels 1–20, hand-made)
Teaching uses forge's coach (tips, the hand on the first move, unlock cards).

| Level | Teaches |
|---|---|
| 1 | Three fry, all free: "Tap a koi to let it swim out" (the hand shows the tap) |
| 2 | One fry blocks another: free the front one first |
| 3 | A wrong tap: the koi bumps back and a heart is lost (shown, with the hearts in the HUD) |
| 4 | Two-cell koi |
| 5 | Undo (it can't give hearts back) |
| 6 | Stars: "keep all your hearts for ★★★" |
| 7 | The Koi Journal: "every koi you free is a sighting" |
| 8 | Glow unlocks |
| 9–11 | Bigger ponds, more fry and short koi |
| 12 | Lily pads |
| 13–14 | Practice |
| 15 | Lotus unlocks |
| 16–19 | Practice; three-cell koi appear |
| 20 | First journal page done; shop and Daily open |

---

## 5. Infinite levels and level progression

### What makes up a level
```
Level = {
  pond:     a cell mask (W × H up to 9 × 13, portrait), reed edges, lily pads, whirlpools, frogs, currents
  koi:      a path of cells per koi (head first), each with a variety slot
  solution: an order in which every koi can leave (kept for Hint and checks)
  D, tag
}
```

### Generator (solvable by construction)
Koi are added **in reverse order of escape**:
1. **Pond:** pick a shape from the band, then reeds, lily pads and the band's twists.
2. **Grow koi one at a time.** Each new koi will be the *last* of those so far to leave, so:
   - its body must not lie on any earlier koi's escape line (they leave before it, and its body would block them)
   - its own escape line can cross earlier koi freely (they're gone by then)
   - it is grown as a random walk from a free cell, with lengths from the band (1 for fry, 3–8 for long koi), and its head faces along the walk's last step
3. **Fill** until the pond reaches the band's density (for example 70–90% of cells), then trim tiny gaps.
4. **The reverse of the adding order is a solution.** The level is replayed with the real rules (twists included) before it's accepted.
5. **Twists that agree with the solution:**
   - lily pads and reeds only where no escape line in the solution crosses them
   - frogs whose count is reached before any koi in the solution needs their cell
   - whirlpools and currents are simulated along the solution, and the koi are placed so the turned or bent lines still lead out
6. **Rate:** count how many koi are free at the start and after each escape (fewer = harder), the longest chain of "this koi waits for that one", and how many koi look free but aren't (their line is blocked far away).

**Solver:** removing a koi never blocks another, so the order only matters for twists (whirlpools, frogs). A simple search over "which free koi next" (with memo) checks levels with twists and powers Hint (a free koi, best first) and Glow.

### How difficulty increases over time
**Seven levers:**

| # | Lever | Range | What the player feels |
|---|---|---|---|
| 1 | Koi | 3 → 60 | More to read |
| 2 | Pond size and shape | 4×4 → 9×13; bays, stone islands | More to scan |
| 3 | Body length | Fry → long bent koi | Lines hidden among bodies |
| 4 | **Free at start** | Many → 1–2 | Fewer obvious taps |
| 5 | **Dependency depth** | Shallow → long chains | Planning, not just spotting |
| 6 | **Look-alikes** | Koi whose head faces a gap but whose line is blocked far away | Careful reading |
| 7 | Specials | Lily pads, reeds, whirlpools, frogs, currents | Variety and order |

**Difficulty score:**
```
D = 0.15·koi + 0.04·cells + 1.2·longShare + 3/(1 + freeAtStart) + 0.6·depth + 0.8·lookAlikes + 1.0·specials
```

**Target curve:** `D_target(n) = 3 + 14·(1 − e^(−n/180))`. It rises fast early and flattens around level 400. The generator picks a percentile of rated candidates.

**Rhythms:**
- **Journal chapters** of about 10 levels: easy to start, ending on a "Last Sighting" Tricky.
- Every 5th level is a Breather, every 10th a Tricky (×2 coins), and every 50th after 150 a **Dragon Gate** (a big crowded pond with the region's rare koi).

**Timeline:**

| Levels | Koi | Pond | Free at start | New |
|---|---|---|---|---|
| 1–20 | 3–14 (fry, 2–3 cells) | up to 6×8 | many | Glow (8), lily pads (12), Lotus (15) |
| 21–44 | 10–18 | 7×9 | 3–5 | reeds (25), Net (25), long koi (30), Bread (40) |
| 45–89 | 14–26 | 8×10 | 2–4 | whirlpools (45), frogs (61) |
| 90–200 | 18–34 | 8×12 | 1–3 | currents (91), Dragon Gates (150) |
| 201–400 | 22–45 | 9×13 | 1–3 | everything mixed |
| 400+ | 20–60 | up to 9×13 | 1–3 | **plateau:** variety, not extra difficulty |

**Adjusting difficulty when a player struggles** (as in the other games):
- A free hint after 2 restarts (after 1 for struggling players).
- An easier version after 3: the same pond with an extra heart and one fewer twist.
- The pre-level boost before Tricky levels.

**Daily seed:** `generateDaily(UTC date)`: a mid-curve pond (about D 10) with one twist, the same for everyone.

---

## 6. As a mobile app

The same Capacitor shell as the other games (forge `app` driver and `app-extras`).

| Area | Plan |
|---|---|
| **Wrapper** | Capacitor 8 with AdMob, Google's consent form, Apple's tracking prompt, Preferences saves (tamper-checked) and Haptics |
| **Orientation** | Portrait. The pond fills the screen between the HUD bars; ponds are taller than wide |
| **Touch** | One tap. The tap target is the whole koi body, with a little extra margin for fry |
| **Haptics** | A soft tick on a tap, a light rumble while a long koi swims out, a bump when one is blocked, and a happy pattern on the last koi |
| **Performance** | One mesh per koi, one water quad. 60 fps on a 2021 mid-range Android with 60 koi |
| **In-app purchases** | Remove ads, coin packs, power-up bundle, starter pack, all cosmetics (`koi_*` IDs) |
| **Notifications** | Opt-in Daily Pond reminder |
| **Store listing** | Keywords: koi, fish, arrow puzzle, tap away, escape puzzle, zen, relaxing, pond. Screenshots: a long koi gliding out, the journey map, the journal, a whirlpool |
| **Compliance** | Rated Everyone, target audience 13+, privacy policy from the template |

---

## Build notes

### Reuse
- **forge:** everything the first five games used: drivers, the tamper-checked `SaveSlot`, Synth/Music, i18n, tweens, the UI shell, `AdBudget`, buy card, shop, Daily, settings, coach, app extras and `build-all`.
- **From the earlier games:**
  - the pack loader and worker, the press composer, the editor shell and the store kit (Snug Bento, Aisle Nine)
  - the collection-progress pattern (quilts → gadgets → recipes → displays → journal pages)
  - the shader-on-quads 2D view (Density, Unbolted, Snug Bento)
- **New for this game:**
  - koi as ribbon meshes along a cell path, and swimming along the path
  - the water shader with ripples
  - hearts (the first Quarkade game with a fail state and an out-of-hearts ad)
  - the reverse-order generator
  - the journey map

### Key implementation decisions
- **Cells, not physics:** a koi is a list of cells; swimming is a position along "the body path, then the straight line out", so blocking and winning are exact.
- **Swimming is a tween of one number** (how far along the path the koi has moved); the ribbon mesh samples the path at that offset every frame, so long koi glide smoothly round their bends.
- **A blocked koi** swims up to the blocker and back on the same tween, so the bump is visible.
- **Undo** puts a koi back but never refunds a heart; stars only count hearts.

### Decisions made (2026-11-19)
- **Theme: a koi pond** (not flat arrows, birds or paper planes).
- **Fail rule: hearts.** A blocked koi bounces back and costs a heart; 3 per level, with an ad for +1 (up to 2 a level).
- **Pieces: fry first, then long bent koi** from level 30.
- **Meta: the Koi Journal album and the journey map,** together (§4 Progression).
- **Name: Koi Out.**
  - **Name check (2026-11-19):** no game called "Koi Out" turned up.
  - **Taken or close:** "Outbound" (a 2026 Steam simulation game, so the catalog title was dropped), "Swim Out" (a turn-based pool puzzle game), "KOI" (an adventure game on Steam), "Koi" (several board and card games).
  - On app stores, use a subtitle such as "Koi Out: Pond Escape Puzzle".
  - Check again before release.

### Open questions
None.
