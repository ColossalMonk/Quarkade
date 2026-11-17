// Economy and tower-pacing simulation on the real tutorial + pack levels.
//   node tools/simulate.ts [levels=400]
// Checks: coins earned vs prices, levels per Density Tower, when collections open, Encore start.

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Rng } from "../../../forge/src/core/rng.ts";
import type { LevelDef } from "../src/logic/rules.ts";
import { TowerProgress, nextTower, collectionOpen } from "../src/game/tower.ts";
import { COLLECTIONS } from "../src/data/towers.ts";
import { levelCoins, POWER_UPS, ECONOMY } from "../src/data/economy.ts";
import { COSMETICS } from "../src/data/cosmetics.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const N = Number(process.argv[2] ?? 400);

function loadLevels(): LevelDef[] {
  const out: LevelDef[] = JSON.parse(readFileSync(join(root, "src/data/levels-tutorial.json"), "utf8"));
  for (let i = 0; existsSync(join(root, `public/packs/pack-${i}.json`)); i++) {
    const p = JSON.parse(readFileSync(join(root, `public/packs/pack-${i}.json`), "utf8"));
    p.levels.forEach((r: [number[], string[], number[], number, number, string], j: number) =>
      out.push({ n: p.from + j, caps: r[0], stacks: r[1], classes: r[2], par: r[3], d: r[4], tag: r[5] as LevelDef["tag"], L: p.L }),
    );
  }
  return out;
}

const PROFILES = [
  { name: "skilled, no ads", stars: [0.7, 0.25, 0.05], firstTry: 0.85, doubles: 0 },
  { name: "average, some ads", stars: [0.45, 0.4, 0.15], firstTry: 0.65, doubles: 0.3 },
  { name: "struggling, no ads", stars: [0.15, 0.45, 0.4], firstTry: 0.4, doubles: 0 },
];

const levels = loadLevels();
const n = Math.min(N, levels.length);
console.log(`levels available: ${levels.length}; simulating ${n}\n`);
const avgPrice = POWER_UPS.reduce((s, p) => s + p.price, 0) / POWER_UPS.length;
const cosmeticsTotal = COSMETICS.reduce((s, c) => s + c.price, 0);

for (const prof of PROFILES) {
  const rng = new Rng(42);
  let totalStars = 0;
  let earned = 0;
  let tower = new TowerProgress(0);
  const finished: string[] = [];
  let encores = 0;
  let levelsThisTower = 0;
  const lengths: number[] = [];
  const opened: Record<string, number> = { [COLLECTIONS[0].id]: 1 };
  let firstEncore = 0;
  for (let lv = 1; lv <= n; lv++) {
    const def = levels[lv - 1];
    const liquids = tower.mapLiquids(def.classes, lv);
    for (const l of liquids) if (!tower.pour(l)) earned += ECONOMY.coins.fillerBonus;
    tower.topUp(def.classes);
    levelsThisTower++;
    const r = rng.next();
    const stars = r < prof.stars[0] ? 3 : r < prof.stars[0] + prof.stars[1] ? 2 : 1;
    totalStars += stars;
    let c = levelCoins(lv, stars, rng.chance(prof.firstTry), def.tag);
    if (rng.chance(prof.doubles)) c *= 2;
    earned += c;
    COLLECTIONS.forEach((col, ci) => {
      if (!(col.id in opened) && collectionOpen(ci, totalStars)) opened[col.id] = lv;
    });
    if (tower.complete) {
      lengths.push(levelsThisTower);
      levelsThisTower = 0;
      if (tower.encore) encores++;
      else finished.push(tower.tower.id);
      const next = nextTower(finished, totalStars, encores);
      if (next.encore && !firstEncore) firstEncore = lv;
      tower = new TowerProgress(next.index, [], next.encore);
    }
  }
  const perLevel = earned / n;
  const avgLen = lengths.reduce((a, b) => a + b, 0) / Math.max(1, lengths.length);
  console.log(`== ${prof.name} ==`);
  console.log(`  avg coins/level ${perLevel.toFixed(1)} -> a power-up every ${(avgPrice / perLevel).toFixed(1)} levels; all shop cosmetics (${cosmeticsTotal}) by ~level ${Math.round(cosmeticsTotal / perLevel)} if saving everything`);
  console.log(`  tower lengths: ${lengths.join(",")}`);
  console.log(`  towers finished ${lengths.length} (avg ${avgLen.toFixed(1)} levels, min ${Math.min(...lengths)}, max ${Math.max(...lengths)}); stars ${totalStars}`);
  console.log(`  collections opened at: ${Object.entries(opened).map(([k, v]) => `${k}@${v}`).join(", ")}; first Encore: ${firstEncore || "none"}\n`);
}
