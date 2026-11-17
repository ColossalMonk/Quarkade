// Economy and pacing simulation, using the real tutorial and pack levels.
//   node tools/simulate.ts [levels=400]
// Checks: coins earned vs power-up and cosmetic prices, levels per quilt, when albums open
// (stars needed) and whether a player ever runs out of open pictures (Encore).

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Rng } from "../../../forge/src/core/rng.ts";
import { decodeLevel } from "../src/logic/rules.ts";
import type { LevelDef } from "../src/logic/rules.ts";
import { QuiltProgress, nextPicture, albumOpen } from "../src/game/quilt.ts";
import { ALBUMS } from "../src/data/quilts.ts";
import { levelCoins, POWER_UPS, ECONOMY } from "../src/data/economy.ts";
import { COSMETICS, ALBUM_STARS } from "../src/data/cosmetics.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const N = Number(process.argv[2] ?? 400);

function loadLevels(): LevelDef[] {
  const out: LevelDef[] = JSON.parse(readFileSync(join(root, "src/data/levels-tutorial.json"), "utf8"));
  for (let i = 0; existsSync(join(root, `public/packs/pack-${i}.json`)); i++) {
    const p = JSON.parse(readFileSync(join(root, `public/packs/pack-${i}.json`), "utf8"));
    p.levels.forEach((r: [number[], string[], number, number, string], j: number) =>
      out.push({ n: p.from + j, caps: r[0], stacks: r[1], par: r[2], d: r[3], tag: r[4] as LevelDef["tag"], L: p.L }),
    );
  }
  return out;
}

interface Profile {
  name: string;
  stars: [number, number, number]; // chance of 3, 2, 1 stars
  firstTry: number;
  watchesDoubleCoins: number;
}

const PROFILES: Profile[] = [
  { name: "skilled, no ads", stars: [0.7, 0.25, 0.05], firstTry: 0.85, watchesDoubleCoins: 0 },
  { name: "average, some ads", stars: [0.45, 0.4, 0.15], firstTry: 0.65, watchesDoubleCoins: 0.3 },
  { name: "struggling, no ads", stars: [0.15, 0.45, 0.4], firstTry: 0.4, watchesDoubleCoins: 0 },
];

const levels = loadLevels();
console.log(`levels available: ${levels.length}; simulating ${N}\n`);

for (const prof of PROFILES) {
  const rng = new Rng(42);
  let coins = ECONOMY.startCoins;
  let totalStars = 0;
  let quilt = new QuiltProgress(0, "0".repeat(64));
  const finished: string[] = [];
  let encores = 0;
  let levelsThisQuilt = 0;
  const quiltLengths: number[] = [];
  const albumOpenedAt: Record<string, number> = { [ALBUMS[0].id]: 1 };
  let firstEncoreAt = 0;
  const coinsAt: Record<number, number> = {};
  let earned = 0;
  for (let n = 1; n <= N; n++) {
    const def = levels[n - 1];
    const b = decodeLevel(def);
    const yarns = quilt.mapColours(b.k, n);
    for (let slot = 0; slot < b.k; slot++) {
      if (!quilt.knit(yarns[slot], yarns).length) { coins += ECONOMY.coins.fillerBonus; earned += ECONOMY.coins.fillerBonus; }
    }
    levelsThisQuilt++;
    const r = rng.next();
    const stars = r < prof.stars[0] ? 3 : r < prof.stars[0] + prof.stars[1] ? 2 : 1;
    totalStars += stars;
    let c = levelCoins(n, stars, rng.chance(prof.firstTry), def.tag);
    if (rng.chance(prof.watchesDoubleCoins)) c *= 2;
    coins += c;
    earned += c;
    for (let ai = 0; ai < ALBUMS.length; ai++) {
      if (!(ALBUMS[ai].id in albumOpenedAt) && albumOpen(ai, totalStars)) albumOpenedAt[ALBUMS[ai].id] = n;
    }
    if (quilt.complete) {
      quiltLengths.push(levelsThisQuilt);
      levelsThisQuilt = 0;
      if (quilt.encore) encores++;
      else finished.push(quilt.picture.id);
      const next = nextPicture(finished, totalStars, encores);
      if (next.encore && !firstEncoreAt) firstEncoreAt = n;
      quilt = new QuiltProgress(next.index, "0".repeat(64), next.encore);
    }
    if ([20, 50, 100, 200, 300, 400].includes(n)) coinsAt[n] = earned;
  }
  const avgQuilt = quiltLengths.reduce((a, b) => a + b, 0) / Math.max(1, quiltLengths.length);
  console.log(`== ${prof.name} ==`);
  console.log(`  coins earned by level: ${Object.entries(coinsAt).map(([k, v]) => `${k}:${v}`).join("  ")}`);
  console.log(`  avg coins/level: ${(earned / N).toFixed(1)}  -> power-up every ${(POWER_UPS.map((p) => p.price).reduce((a, b) => a + b) / 4 / (earned / N)).toFixed(1)} levels (avg price)`);
  console.log(`  all shop cosmetics (${COSMETICS.reduce((s, c) => s + c.price, 0)} coins) affordable by level ~${Math.round(COSMETICS.reduce((s, c) => s + c.price, 0) / (earned / N))} if saving everything`);
  console.log(`  quilts finished: ${quiltLengths.length} (avg ${avgQuilt.toFixed(1)} levels each, min ${Math.min(...quiltLengths)}, max ${Math.max(...quiltLengths)}), pictures done: ${finished.length}`);
  console.log(`  total stars: ${totalStars}; albums opened at level: ${Object.entries(albumOpenedAt).map(([k, v]) => `${k}@${v}`).join(", ")} (needs ${ALBUM_STARS.join("/")})`);
  console.log(`  first Encore quilt: ${firstEncoreAt ? "level " + firstEncoreAt : "none"}\n`);
}
