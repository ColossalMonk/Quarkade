// Build a game for every platform, check the asset budget, and zip each build for upload.
//   node forge/tools/build-all.ts 01-hypercasual/hc01-knotwork            (all platforms)
//   node forge/tools/build-all.ts 01-hypercasual/hc01-knotwork crazygames (one platform)
// Output: <game>/dist/<platform>/ and <game>/dist/zips/<game>-<platform>.zip

import { mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, resolve, dirname, relative, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";
import { zipDir } from "./zip.ts";
import { PLAYGAMA_BRIDGE_CONFIG } from "../src/platform/drivers/playgama.ts";

const ALL = ["crazygames", "playgama", "gamedistribution", "gamepix", "gamemonetize", "youtube", "poki", "local"];

// The budget from Quarkade/README.md.
const BUDGET = { initialBytes: 5 * 1024 * 1024, totalBytes: 50 * 1024 * 1024, files: 500 };

const quarkade = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const [gameArg, ...platformArgs] = process.argv.slice(2);
if (!gameArg) {
  console.log("usage: node forge/tools/build-all.ts <game folder> [platform...]");
  process.exit(1);
}
const gameDir = resolve(quarkade, gameArg);
const slug = basename(gameDir);
const platforms = platformArgs.length ? platformArgs : ALL;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

let failed = false;
const mb = (b: number) => (b / 1024 / 1024).toFixed(2) + " MB";
for (const platform of platforms) {
  process.env.VITE_PLATFORM = platform;
  await build({ root: gameDir, configFile: join(gameDir, "vite.config.ts"), logLevel: "warn" });
  const out = join(gameDir, "dist", platform);
  // Per-platform extras.
  if (platform === "playgama") writeFileSync(join(out, "playgama-bridge-config.json"), JSON.stringify(PLAYGAMA_BRIDGE_CONFIG, null, 2));
  const files = walk(out);
  let total = 0;
  let initial = 0;
  for (const f of files) {
    const size = statSync(f).size;
    total += size;
    // Level packs load lazily; everything else is part of the first download.
    if (!relative(out, f).startsWith("packs")) initial += size;
  }
  const ok = initial <= BUDGET.initialBytes && total <= BUDGET.totalBytes && files.length <= BUDGET.files;
  if (!ok) failed = true;
  let zipInfo = "";
  if (platform !== "local" && platform !== "app") {
    mkdirSync(join(gameDir, "dist", "zips"), { recursive: true });
    const size = zipDir(out, join(gameDir, "dist", "zips", `${slug}-${platform}.zip`));
    zipInfo = `  zip ${mb(size)}`;
  }
  console.log(`${ok ? "ok  " : "OVER"} ${platform.padEnd(16)} initial ${mb(initial).padStart(9)}  total ${mb(total).padStart(9)}  files ${files.length}${zipInfo}`);
}
process.exit(failed ? 1 : 0);
