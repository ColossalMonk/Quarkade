# 01 · Hypercasual catalog

50 games for the open route: CrazyGames first, then Playgama, GameDistribution, GamePix, GameMonetize and YouTube Playables.

All titles are working titles. Before a game is released, check its name on the portals, Google Play and the App Store.

---

## Rules every game follows (so it can become an app later)

1. **Portrait first.** The play area is a centred 9:16 column. On desktop, the menus and progress sit in panels to the left and right. The same build then works as a phone app with no redesign.
2. **One thumb, one action.** Each game uses a single input (tap, hold, drag, swipe, draw or tilt), and the same input works with a mouse and with a finger.
3. **Short levels, a long game.** Each level takes 20–60 seconds, and the progression keeps a session going for 5–10 minutes. The first ~20 levels are designed by hand. After that, a level generator with a difficulty curve provides 100+ levels, which is the amount an app store version needs.
4. **Three reasons to come back:**
   - a daily challenge (a seeded level that's the same for everyone that day)
   - a collection (skins, a gallery, an album)
   - a play streak
5. **Ad slots planned from day one:**
   - Rewarded ads for an extra move, an undo, a revive, skipping a level, or 2× rewards. Each card below names the one that fits that game best.
   - Interstitial ads only between levels.
   - Later, as an app: in-app purchases to remove ads and to buy cosmetic packs.
6. **Works offline, with no server.** Saves go through the template's save layer, so they work with portal cloud saves, local storage, and Capacitor apps.
7. **Haptics built in.** The game calls a haptics function that does nothing on the web and vibrates on phones (Capacitor Haptics).
8. **Safe for any store:**
   - No other company's characters, names, art or music (no IP).
   - Nothing that looks like gambling: no real money, cash-outs or casino styling.
   - Content suitable for children.
9. **Little art needed:** flat shapes or low-poly models, an art kit palette, CC0 asset packs, and effects made with shaders.
10. **Fits the asset budget:** initial download ≤ 5 MB.

### How to read the index

- **Input:** the single action the game uses.
- **View:** 2D games are drawn with an orthographic three.js camera; 3D games use a perspective camera. One engine for everything.
- **Effort:** **S** ≈ 3–4 days, **M** ≈ 5–7 days. Both assume the template already exists.

---

## Index

| ID | Title | Type | Input | View | Effort |
|---|---|---|---|---|---|
| hc01 | Knotwork ✅ v1.0 built | Sort | Tap | 2.5D | M |
| hc02 | Density ✅ v1.0 built | Sort | Tap | 2D | M |
| hc03 | Unbolted ✅ v1.0 built (was "Screwball Workshop") | Sort | Tap | 2D (exact swing, no physics engine) | M |
| hc04 | Snug Bento ✅ v1.0 built (was "Bento Snug") | Sort | Drag | 2D | M |
| hc05 | Aisle Nine | Sort | Tap | 2.5D | M |
| hc06 | Outbound | Escape | Tap | 2D | S |
| hc07 | Harbor Hustle | Escape | Tap | 2.5D | M |
| hc08 | Untwine | Escape | Drag | 2D | S |
| hc09 | Marble Junction | Escape | Tap | 3D | M |
| hc10 | Catnap Shuffle | Escape | Drag | 2D | S |
| hc11 | Shave & Shape | Satisfying | Drag | 3D | M |
| hc12 | Rinse Reveal | Satisfying | Drag | 2D | S |
| hc13 | Latte Pour | Satisfying | Hold | 2D | M |
| hc14 | One Peel | Satisfying | Drag | 3D | M |
| hc15 | Thaw Out | Satisfying | Tap | 2D | S |
| hc16 | Crane Day | Timing | Tap | 2D physics | S |
| hc17 | Yeehaw Loop | Timing | Tap | 2D | S |
| hc18 | Kickflip Kid | Timing | Hold | 2D | S |
| hc19 | Deep Drop | Timing | Tap | 2D | S |
| hc20 | Bounce Post | Timing | Tap | 2D physics | S |
| hc21 | Jelly Bridge | Draw | Draw | 2D physics | M |
| hc22 | Duckling Dash | Draw | Draw | 2D | S |
| hc23 | Prism Pilot | Draw | Drag | 2D | S |
| hc24 | One Stroke | Draw | Draw | 2D | S |
| hc25 | Save the Capy | Draw | Draw | 2D physics | S |
| hc26 | Crease | Spatial | Tap | 3D | M |
| hc27 | Silhouette | Spatial | Drag | 3D | M |
| hc28 | Gulp Kitchen | Spatial | Drag | 3D | M |
| hc29 | Stamp Roll | Spatial | Swipe | 3D | S |
| hc30 | Tilt Tide | Spatial | Tilt | 3D | S |
| hc31 | Snowball Sumo | Arena | Drag | 3D | M |
| hc32 | Coat Clash | Arena | Drag | 3D | M |
| hc33 | Huddle Up | Arena | Drag | 3D | M |
| hc34 | Scrap Magnet | Arena | Drag | 2D | S |
| hc35 | Manja Duel | Arena | Hold | 2D | M |
| hc36 | Terrarium Drop | Merge | Tap | 2D physics | S |
| hc37 | Tip Ledge | Merge | Tap | 3D physics | M |
| hc38 | Slurp Stand | Merge / Idle | Tap | 2D | S |
| hc39 | Peg Garden | Merge | Tap | 2D physics | S |
| hc40 | Pip Merge | Merge | Drag | 2D | S |
| hc41 | Grabby Claw | Reflex | Tap | 3D physics | M |
| hc42 | Chop Beat | Reflex | Tap | 2D | M |
| hc43 | Puffkeep | Reflex | Tap | 2D physics | S |
| hc44 | Cart Wheelie | Reflex | Swipe | 3D | M |
| hc45 | Perfect Parry | Reflex | Tap | 2D | S |
| hc46 | Purr Spot | Cozy | Drag | 2D | S |
| hc47 | Tongue Tied | Cozy | Hold | 2D physics | M |
| hc48 | Peel & Place | Cozy | Drag | 2D | S |
| hc49 | Mashup Menagerie | Cozy | Drag | 2D | S |
| hc50 | Cloud Shepherd | Cozy | Swipe | 2D | S |

Total: 29 S and 21 M.

---

## A · Sort & Organize
*Why now: sorting puzzles have been among the top mobile puzzle formats for years, and portal players know them instantly.*

#### hc01 · Knotwork
Sort yarn loops onto knitting needles by colour. Every full needle knits one patch of a quilt picture.
- **Play:** tap a needle to lift its top loop, then tap another needle to drop it there. A loop can only go on top of the same colour.
- **Progression:** each level adds a patch to the quilt. Finished quilts go into a gallery.
- **Trend:** yarn and wool sorting puzzles, cosy crafts.
- **Look:** flat colours with a knit texture made by a shader. No drawn art.
- **Rewarded ad:** an extra empty needle. **Haptics:** a soft tick when a loop lands.

#### hc02 · Density
Pour liquids between flasks to sort them, but the liquids settle by weight. Oil floats on water and syrup sinks under both, so the order you pour in matters.
- **Play:** tap a source flask, then tap a target flask. The liquids settle into layers by weight.
- **Progression:** new liquids appear over time (honey, mercury-silver, bubbles that rise). Flask skins to unlock.
- **Trend:** water and potion sorting, with a twist people haven't seen.
- **Look:** a liquid shader with wobble and meniscus. Glass is a single material.
- **Rewarded ad:** undo the last pour.

#### hc03 · Unbolted (working title was "Screwball Workshop")
Unscrew bolts in the right order so metal plates swing loose and drop. Each bolt goes into the toolbox of its colour.
- **Play:** tap a bolt to unscrew it. Plates hang and swing on the bolts that are left, using real physics.
- **Progression:** workshop decorations, a collection of screwdriver skins.
- **Trend:** screw-and-bolt puzzles.
- **Look:** flat metal plates, bolts with a little shading, a pegboard background.
- **Rewarded ad:** an extra toolbox slot. **Haptics:** a ratchet buzz while unscrewing.

#### hc04 · Snug Bento (working title was "Bento Snug")
Pack every food piece into the bento box with no gaps. When it all fits, the lid closes with a satisfying click.
- **Play:** drag pieces to place them, tap a piece to rotate it.
- **Progression:** a menu of box shapes, a collection of themed bentos (picnic, festival, space).
- **Trend:** packing and organising videos.
- **Look:** cute flat food shapes, many from CC0 packs. A wooden box texture.
- **Rewarded ad:** reveal where one piece goes.

#### hc05 · Aisle Nine
Match three identical goods on store shelves to clear them. The shelves slowly turn on a carousel, so goods you need come round and drift away.
- **Play:** tap an item to send it to the basket. Three of a kind in the basket clears them.
- **Progression:** stock levels go up, and you unlock new store themes (bakery, toys, garden centre).
- **Trend:** goods sorting and triple-match.
- **Look:** low-poly products from Kenney and Quaternius packs.
- **Rewarded ad:** shuffle the shelves, or an extra basket slot.

---

## B · Escape & Traffic
*Why now: "get everything out" puzzles (car parks, buses, arrows) are a lasting mobile hit, and they're easy to grasp from a thumbnail.*

#### hc06 · Outbound
Every tile is an arrow. Tap one and it slides off the board in its direction, unless another tile is in the way.
- **Play:** tap arrows in the right order. A tile that gets blocked bounces back, and that costs a life.
- **Progression:** board shapes, special tiles (rotating, double-length), arrow skins.
- **Trend:** arrow escape puzzles.
- **Look:** flat tiles and colour only. Very little art.
- **Rewarded ad:** remove one tile. **Haptics:** a bump when a tile is blocked.

#### hc07 · Harbor Hustle
Ferries wait in a crowded harbour. Passengers queue in colour groups at the dock and board the ferry of their colour, but a ferry can only leave once the way is clear.
- **Play:** tap a ferry to send it out. When it reaches the dock, passengers of its colour board it.
- **Progression:** grow your harbour town between levels.
- **Trend:** bus and car-park jam puzzles, moved onto water.
- **Look:** low-poly boats and a water shader.
- **Rewarded ad:** an extra dock slot.

#### hc08 · Untwine
Ropes are pinned to pegs and tangled together. Move pegs until no two ropes cross.
- **Play:** drag pegs. A rope glows when it's clear of all the others.
- **Progression:** themed boards (fishing nets, festival lights, headphone cables), a timed mode.
- **Trend:** tangle and untangle puzzles.
- **Look:** ropes drawn as lines with a shader. Practically no art.
- **Rewarded ad:** a hint that moves one peg.

#### hc09 · Marble Junction
Coloured marbles roll down a track. Flip the switches so each marble lands in the cup of its colour.
- **Play:** tap a junction to flip it. Marbles keep rolling while you play.
- **Progression:** new track pieces (lifts, loops, splitters), marble skins.
- **Trend:** marble run videos, satisfying sounds.
- **Look:** low-poly tracks and glossy marbles.
- **Rewarded ad:** slow time for 10 seconds.

#### hc10 · Catnap Shuffle
Sleeping cats are curled up across the room like long blocks. Slide them so the mouse can sneak out. Bump a cat twice and it wakes up.
- **Play:** drag a cat along its length.
- **Progression:** a collection of cat breeds, room themes.
- **Trend:** cats, plus sliding-block puzzles.
- **Look:** a simple rounded cat shape, recoloured for each breed.
- **Rewarded ad:** calm one cat back to sleep. **Haptics:** a purr when a cat moves.

---

## C · Satisfying & ASMR
*Why now: "oddly satisfying" clips are always in short-video feeds, and thumbnails of them get clicked.*

#### hc11 · Shave & Shape
Carve a bar of soap until it matches the outline. Shavings curl off as you go.
- **Play:** drag to shave. Accuracy is scored against the target shape.
- **Progression:** soap colours, scents (cosmetic) and target shapes.
- **Trend:** soap cutting videos.
- **Look:** a voxel or SDF block made with shaders, with pastel colours.
- **Rewarded ad:** show the guide lines.

#### hc12 · Rinse Reveal
Power-wash grime off an object to uncover a hidden pattern underneath.
- **Play:** drag to spray. A meter fills to 100%.
- **Progression:** objects (bike, statue, garden gnome, car door), nozzle upgrades.
- **Trend:** power-washing videos and games.
- **Look:** a mask shader painted over a flat image. Very little art.
- **Rewarded ad:** a turbo nozzle. **Haptics:** a light hum while spraying.

#### hc13 · Latte Pour
Pour milk into a coffee and steer the stream to make the latte art shown on the card.
- **Play:** hold to pour, drag to steer. Your result is scored against the target.
- **Progression:** a café menu, a collection of cups.
- **Trend:** café and coffee content.
- **Look:** a 2D fluid shader on a flat cup seen from above.
- **Rewarded ad:** a ghost guide for the pour.

#### hc14 · One Peel
Peel a fruit in a single unbroken spiral. If the peel snaps, you start again.
- **Play:** drag around the fruit. Going too fast or too sharply snaps the peel.
- **Progression:** fruit types; longer peels score more.
- **Trend:** satisfying peeling clips.
- **Look:** low-poly fruit, with the peel drawn as a ribbon mesh.
- **Rewarded ad:** a second chance after a snap.

#### hc15 · Thaw Out
Something is frozen inside a block of ice. Chip it free without touching it.
- **Play:** tap to chip. Cracks spread, and hitting the item breaks it.
- **Progression:** a museum of things you've freed.
- **Trend:** dig and excavate videos.
- **Look:** an ice shader with cracks over flat icons.
- **Rewarded ad:** an x-ray view of where the item is.

---

## D · One-tap Timing
*Why now: these work best on a phone and are the easiest to turn into an app.*

#### hc16 · Crane Day
A crane swings a load back and forth. Drop crates to build a tower that the physics keeps wobbly.
- **Play:** tap to drop. A perfect drop snaps neatly into place.
- **Progression:** build a city skyline one tower at a time.
- **Trend:** stacking games.
- **Look:** flat crates, a gradient sky.
- **Rewarded ad:** a revive after the tower falls.

#### hc17 · Yeehaw Loop
Animals run past at a rodeo. Throw your lasso at the right moment to catch them.
- **Play:** tap to throw. Timing and distance decide whether it lands.
- **Progression:** a ranch that fills with what you've caught, plus hat skins.
- **Trend:** the western look is in fashion again.
- **Look:** flat desert scenery, simple animal silhouettes.
- **Rewarded ad:** a wider loop.

#### hc18 · Kickflip Kid
Skate through the city. Hold to crouch and charge, release to ollie over gaps and grind rails.
- **Play:** a single hold-and-release.
- **Progression:** deck skins, new spots.
- **Trend:** skate culture.
- **Look:** a flat city with parallax layers. The skater is built from simple shapes.
- **Rewarded ad:** continue after a bail.

#### hc19 · Deep Drop
Drop a fishing hook deep into the sea and steer it to catch fish on the way back up. The fish fill your aquarium.
- **Play:** drag to steer on the way down and on the way up.
- **Progression:** a fish collection, line upgrades, an aquarium you decorate.
- **Trend:** fishing games plus collecting.
- **Look:** a depth gradient, fish as flat shapes.
- **Rewarded ad:** double the catch.

#### hc20 · Bounce Post
A parcel falls from the sky. Place bounce pads so it bounces its way into the mailbox.
- **Play:** tap to place a pad. Each level gives you a limited number.
- **Progression:** delivery routes, mailbox skins.
- **Trend:** delivery themes, physics puzzles.
- **Look:** flat shapes.
- **Rewarded ad:** an extra pad.

---

## E · Draw & Path
*Why now: drawing to solve a puzzle shows creativity in a single screenshot, and thumbnails of it do well.*

#### hc21 · Jelly Bridge
Draw a bridge so a car can cross a gap. You only have so much ink, and the bridge is made of wobbly jelly.
- **Play:** draw once, then the car drives.
- **Progression:** vehicle skins, longer gaps.
- **Trend:** draw-to-solve puzzles.
- **Look:** a soft-body line shader.
- **Rewarded ad:** more ink.

#### hc22 · Duckling Dash
Draw a route for the mother duck. She has to pick up every duckling and reach the pond without the line crossing itself.
- **Play:** draw a single path.
- **Progression:** pond decorations, rare ducklings to collect.
- **Trend:** ducks are an internet favourite.
- **Look:** round duck shapes on grass.
- **Rewarded ad:** show the start of the route.

#### hc23 · Prism Pilot
Drag mirrors and prisms so a laser beam passes through every crystal.
- **Play:** drag pieces to move them, tap them to rotate.
- **Progression:** colour-mixing beams, new piece types.
- **Trend:** light and laser puzzles.
- **Look:** a glow shader on a dark background. Nearly all of it is made in code.
- **Rewarded ad:** place one piece correctly.

#### hc24 · One Stroke
Trace over every line of a shape in one continuous stroke, without lifting your finger.
- **Play:** draw.
- **Progression:** thousands of generated shapes, picture packs.
- **Trend:** one-line puzzles, which work very well as long-running apps.
- **Look:** lines and dots.
- **Rewarded ad:** show the next segment.

#### hc25 · Save the Capy
Bees swarm out of a hive. Draw a shield that keeps the capybara safe for 10 seconds.
- **Play:** draw once, then physics takes over.
- **Progression:** capybara outfits, new threats (rain, rolling oranges).
- **Trend:** capybaras, and "save the pet" drawing puzzles.
- **Look:** a round capybara built from simple shapes.
- **Rewarded ad:** skip the level.

---

## F · Spatial
*Why now: these show off what three.js does well, and portals have fewer of them than 2D puzzles.*

#### hc26 · Crease
Fold paper flaps in the right order to complete a picture.
- **Play:** tap a flap to fold it.
- **Progression:** picture albums.
- **Trend:** paper crafts.
- **Look:** a paper shader with fold lighting, like the Golden Hour diorama.
- **Rewarded ad:** reveal the first fold.

#### hc27 · Silhouette
Spin an abstract object until the shadow it casts matches the outline on the wall.
- **Play:** drag to rotate.
- **Progression:** themed sets, with harder objects that rotate on two axes.
- **Trend:** shadow art.
- **Look:** shapes assembled in code, with a shadow made by real lighting.
- **Rewarded ad:** lock one axis in the right position.

#### hc28 · Gulp Kitchen
Steer a hole across a kitchen counter and swallow the ingredients in recipe order before time runs out. Swallowing the wrong one costs time.
- **Play:** drag to move the hole.
- **Progression:** recipes you've cooked go into a cookbook.
- **Trend:** "hole" games combined with cooking.
- **Look:** low-poly food from CC0 packs.
- **Rewarded ad:** +10 seconds.

#### hc29 · Stamp Roll
Roll a cube with ink on its faces across the tiles. Each roll stamps the colour of the face that lands down. Recreate the target pattern.
- **Play:** swipe to roll.
- **Progression:** pattern albums.
- **Trend:** rolling-cube puzzles.
- **Look:** a cube and tiles.
- **Rewarded ad:** undo three moves.

#### hc30 · Tilt Tide
Tilt the board to guide every jelly blob into a hole.
- **Play:** tilt the phone in the app, or use the mouse or arrow keys on the web.
- **Progression:** board themes, blob skins.
- **Trend:** tilt mazes, which feel especially good on a phone with motion control.
- **Look:** a wobbly jelly shader.
- **Rewarded ad:** a magnet that pulls one blob into a hole.

---

## G · Mini Arena (single player against bots)
*Why now: ".io"-style arenas still hold players for long sessions on portals. Bots mean no servers are needed.*

#### hc31 · Snowball Sumo
Roll a snowball that grows as it picks up snow, and knock the bots off a melting iceberg.
- **Play:** drag to steer.
- **Progression:** hat skins, new arenas.
- **Look:** low-poly ice.
- **Rewarded ad:** start with a bigger snowball.

#### hc32 · Coat Clash
You have 60 seconds to paint more of the floor than the bots.
- **Play:** drag to steer.
- **Progression:** roller skins, paint colours.
- **Look:** a paint shader that renders the floor into a texture as you go.
- **Rewarded ad:** a double-width roller.

#### hc33 · Huddle Up
Round up wandering penguins into your huddle. A bigger huddle swallows a smaller one.
- **Play:** drag to steer.
- **Progression:** rare penguins to collect.
- **Trend:** penguins and crowd-collecting games.
- **Look:** penguins built from simple shapes, in large numbers.
- **Rewarded ad:** a head start.

#### hc34 · Scrap Magnet
Fly a magnet ship that pulls in floating scrap. Dodge the bots, then bank your haul.
- **Play:** drag to fly.
- **Progression:** ship upgrades.
- **Look:** flat space scenes, with glowing magnet lines.
- **Rewarded ad:** double the haul.

#### hc35 · Manja Duel
Kite fighting. Cross your kite's string over a rival's and pull to cut it free.
- **Play:** hold to pull, release to let out line.
- **Progression:** kite designs, string strength.
- **Trend:** kite festivals (Makar Sankranti, Uttarayan). The theme is fresh and distinctive on the big portals.
- **Look:** flat kites against a rooftop skyline.
- **Rewarded ad:** stronger string.

---

## H · Merge & Idle-lite
*Why now: drop-and-merge games and plinko-builder games are current hits, and "number goes up" progression keeps players around.*

#### hc36 · Terrarium Drop
Drop seeds into a glass jar. Two identical plants merge into a bigger plant. Don't let the jar overflow.
- **Play:** move the drop point, then tap to drop.
- **Progression:** a guide to plant species, jar skins.
- **Trend:** Suika-style drop and merge.
- **Look:** round plant shapes, a glass jar.
- **Rewarded ad:** shake the jar to make room.

#### hc37 · Tip Ledge
A coin-pusher machine that uses tokens and prizes. Push prizes over the edge to collect them.
- **Play:** tap to drop a token.
- **Progression:** a prize collection, different machines.
- **Trend:** coin-pusher clips are very popular.
- **Note:** no real money, no cash-out and no casino styling. It must read as a fairground machine.
- **Look:** low-poly prizes, real physics.
- **Rewarded ad:** a bulldozer push.

#### hc38 · Slurp Stand
Run a ramen stand. Tap to serve customers, upgrade your stations, and earn while you're away.
- **Play:** tap.
- **Progression:** stations, staff, new stalls.
- **Trend:** idle cooking games.
- **Look:** flat bowls and steam made with a shader.
- **Rewarded ad:** double earnings for 2 minutes.

#### hc39 · Peg Garden
Drop seeds through a field of pegs. Upgrade the pegs into flowers that multiply your score.
- **Play:** tap to drop seeds.
- **Progression:** buy pegs and place them where you like.
- **Trend:** plinko and peg-builder games.
- **Note:** the currency is seeds and stars. No money and nothing casino-like.
- **Look:** flat pegs that bloom.
- **Rewarded ad:** a golden seed that scores 5×.

#### hc40 · Pip Merge
Roll dice and place them on a grid. Three dice with the same pips merge into the next number up.
- **Play:** drag a die onto the grid.
- **Progression:** dice skins, grid shapes.
- **Trend:** dice games.
- **Look:** dice and a grid.
- **Rewarded ad:** reroll.

---

## I · Reflex Arcade
*Why now: high-score games are the best fit for daily challenges and streaks.*

#### hc41 · Grabby Claw
A claw machine. Time where the claw drops; physics decides whether it holds on.
- **Play:** tap to move, tap again to drop.
- **Progression:** a shelf of collectible plush toys.
- **Trend:** claw machine videos.
- **Look:** low-poly plush toys, a glass case.
- **Rewarded ad:** a stronger grip.

#### hc42 · Chop Beat
Chop vegetables in time with the beat. Perfect chops build a combo.
- **Play:** tap on the beat.
- **Progression:** dishes and new tracks.
- **Trend:** rhythm games crossed with cooking.
- **Music:** tracks are made in code or come from CC0 sources. No licensed music.
- **Rewarded ad:** forgive one miss.

#### hc43 · Puffkeep
Keep the balloons in the air by tapping them, and keep them away from spikes and birds.
- **Play:** tap.
- **Progression:** balloon skins, more balloons at once.
- **Look:** flat sky and balloons.
- **Rewarded ad:** a revive.

#### hc44 · Cart Wheelie
A runner where you're a shopping cart racing down three lanes. Grab the items on your list in order.
- **Play:** swipe to change lanes.
- **Progression:** cart skins, stores.
- **Trend:** endless runners with a goal in each run.
- **Look:** low-poly store aisles from CC0 packs.
- **Rewarded ad:** continue.

#### hc45 · Perfect Parry
Attacks come at you. Tap at the exact moment each one lands to parry it.
- **Play:** tap.
- **Progression:** opponents, shield skins.
- **Trend:** parry timing from souls-like games.
- **Look:** silhouettes and slow-motion flashes.
- **Rewarded ad:** one free parry.

---

## J · Cozy & Creatures
*Why now: cozy games bring in a different, very loyal audience, and they work well on app stores.*

#### hc46 · Purr Spot
Every cat has a favourite spot to be petted. Find it using warmer/colder feedback.
- **Play:** drag over the cat.
- **Progression:** a collection of cats, a cosy room to decorate.
- **Note:** made for phones, where the purr comes through as haptics.
- **Look:** a round cat shape in different colours.
- **Rewarded ad:** a hint.

#### hc47 · Tongue Tied
A frog swings from lilypad to lilypad and fly to fly using its tongue like a grappling hook.
- **Play:** hold to latch on, release to let go.
- **Progression:** frog species, new swamps.
- **Look:** flat swamp layers.
- **Rewarded ad:** continue.

#### hc48 · Peel & Place
Peel stickers off a sheet and line them up exactly inside the outlines on a journal page.
- **Play:** drag. Precision is scored.
- **Progression:** themed sticker books.
- **Trend:** sticker-book and journaling games.
- **Look:** a flat sticker shader, sticker art from CC0 or in-house shapes.
- **Rewarded ad:** snap one sticker perfectly.

#### hc49 · Mashup Menagerie
Mismatched creature halves fall from the sky. Catch them in a cauldron to brew absurd new creatures for your bestiary.
- **Play:** drag the cauldron.
- **Progression:** a bestiary to complete, with rare combinations.
- **Trend:** absurd meme creatures. Every creature is original; none are copied from memes.
- **Look:** creature halves made of simple shapes that combine in code.
- **Rewarded ad:** a rare-creature magnet.

#### hc50 · Cloud Shepherd
Blow rain clouds over thirsty fields. The crops grow into a farm.
- **Play:** swipe to send gusts of wind.
- **Progression:** crops, a farm that grows over time.
- **Trend:** cozy farming.
- **Look:** a cloud shader, flat fields.
- **Rewarded ad:** a rainstorm.

---

## Build order

**Games are built one at a time in ID order: hc01, hc02, … hc50.** Each game gets a `DESIGN.md`, made from `_DESIGN-TEMPLATE.md`, before it's built.

The waves below are kept only for reference. They are no longer the build order.

**Wave 0 (reference): games that each exercise a different piece of tech:**

| Game | Tech it tests |
|---|---|
| hc12 Rinse Reveal | Shader mask |
| hc06 Outbound | Grid logic and level generator |
| hc36 Terrarium Drop | 2D physics |

**Wave 1: quick and strongly on-trend (10 games).**
hc02 Density, hc04 Bento Snug, hc08 Untwine, hc10 Catnap Shuffle, hc15 Thaw Out, hc22 Duckling Dash, hc25 Save the Capy, hc39 Peg Garden, hc40 Pip Merge, hc46 Purr Spot

**Wave 2: the remaining small games (16 games).**
hc16 Crane Day, hc17 Yeehaw Loop, hc18 Kickflip Kid, hc19 Deep Drop, hc20 Bounce Post, hc23 Prism Pilot, hc24 One Stroke, hc29 Stamp Roll, hc30 Tilt Tide, hc34 Scrap Magnet, hc38 Slurp Stand, hc43 Puffkeep, hc45 Perfect Parry, hc48 Peel & Place, hc49 Mashup Menagerie, hc50 Cloud Shepherd

**Wave 3: medium games (21 games).**
All the M-effort games, starting with the clusters whose games performed best in Waves 0–2.
