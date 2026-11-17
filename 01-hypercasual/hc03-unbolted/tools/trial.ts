// Quick generator trial: node tools/trial.ts [levels...]
import { generateLevel } from "../src/logic/generator.ts";
import { newBoard } from "../src/logic/rules.ts";
import { solve } from "../src/logic/solver.ts";
const ns = process.argv.slice(2).map(Number);
for (const n of ns.length ? ns : [21, 30, 45, 61, 91, 150, 300, 600]) {
  const t0 = performance.now();
  const b = generateLevel(n);
  const ms = performance.now() - t0;
  const d = b.def;
  const t1 = performance.now();
  const s = solve(newBoard(d), { maxNodes: 40000 });
  console.log(`L${n} ${d.tag} plates ${d.plates.length} layers ${b.metrics.layers} bolts ${d.bolts.length} k ${d.k} tray ${d.tray} par ${d.par} opt ${b.metrics.optimal} D ${d.d} cov ${b.metrics.coveredShare.toFixed(2)} traps ${b.metrics.swingTraps} dead ${b.metrics.deadEndRate.toFixed(2)} pins ${d.pins.length} chains ${d.chains.length} locks ${d.plates.filter(p=>p[6]>=0).length} | gen ${ms.toFixed(0)}ms | solve ${s.solved ? s.detours : "x"} ${s.nodes}n ${(performance.now()-t1).toFixed(0)}ms`);
}
