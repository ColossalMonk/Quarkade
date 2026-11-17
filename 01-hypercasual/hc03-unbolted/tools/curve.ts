// Difficulty curve sample: node tools/curve.ts [from] [to] [step]
import { generateLevel } from "../src/logic/generator.ts";
const [a = 21, b = 600, st = 23] = process.argv.slice(2).map(Number);
const rows: string[] = [];
let total = 0;
for (let n = a; n <= b; n += st) {
  const t0 = performance.now();
  const g = generateLevel(n);
  const ms = performance.now() - t0;
  total += ms;
  const m = g.metrics;
  rows.push(`${String(n).padStart(4)} ${g.def.tag.padEnd(11)} bolts ${String(m.bolts).padStart(2)} k ${g.def.k} layers ${m.layers} cov ${m.coveredShare.toFixed(2)} traps ${m.swingTraps} dead ${m.deadEndRate.toFixed(2)} par ${String(g.def.par).padStart(2)} opt ${m.optimal} D ${g.def.d.toFixed(1).padStart(5)} ${ms.toFixed(0)}ms`);
}
console.log(rows.join("\n"));
console.log(`avg ${(total / rows.length).toFixed(0)} ms/level`);
