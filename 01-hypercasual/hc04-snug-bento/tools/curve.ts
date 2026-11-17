// Difficulty curve sample: node tools/curve.ts [from] [to] [step]
import { generateLevel } from "../src/logic/generator.ts";
const [a = 21, b = 600, st = 23] = process.argv.slice(2).map(Number);
let total = 0;
let count = 0;
for (let n = a; n <= b; n += st) {
  const t0 = performance.now();
  const g = generateLevel(n);
  const ms = performance.now() - t0;
  total += ms;
  count++;
  const m = g.metrics;
  const d = g.def;
  const tw = [d.mask.includes("g") ? "garnish" : "", d.walls.length ? `walls${d.walls.length}` : "", d.mask.includes(" ") ? "odd" : "", d.pieces.some((p) => p.s) ? "soft" : "", d.pieces.some((p) => p.t === 1) ? "hot/cold" : "", d.pieces.some((p) => p.sauce !== undefined) ? "sauce" : ""].filter(Boolean).join(",");
  console.log(`${String(n).padStart(4)} ${d.tag.padEnd(11)} ${d.w}x${d.h} pieces ${String(m.pieces).padStart(2)} big ${m.bigShapes} sols ${String(m.solutions).padStart(2)} nodes ${String(m.nodes).padStart(6)} D ${d.d.toFixed(1).padStart(5)} ${tw} ${ms.toFixed(0)}ms`);
}
console.log(`avg ${(total / count).toFixed(0)} ms/level`);
