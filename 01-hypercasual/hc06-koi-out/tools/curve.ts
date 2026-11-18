// Prints the generated ponds across a range: node tools/curve.ts <from> <to> <step>
import { generateLevel, targetD } from "../src/logic/generator.ts";

const [from, to, step] = process.argv.slice(2).map(Number);
for (let n = from || 1; n <= (to || 200); n += step || 10) {
  const t0 = performance.now();
  const { def, metrics: m } = generateLevel(n);
  const ms = Math.round(performance.now() - t0);
  const tw = [def.pads && `pads${def.pads.length}`, def.reeds && `reeds${def.reeds.length}`, def.whirls && `whirl${def.whirls.length}`, def.frogs && `frog${def.frogs.length}`, def.currents && `cur${def.currents.length}`].filter(Boolean).join(",");
  const maxLen = Math.max(...def.koi.map((k) => k.c.length));
  console.log(`${String(n).padStart(4)} ${def.tag.padEnd(9)} ${def.w}x${def.h} koi ${String(m.koi).padStart(2)} cells ${String(m.cells).padStart(3)} long ${m.longShare.toFixed(2)} max ${maxLen} free ${String(m.freeAtStart).padStart(2)} depth ${m.depth} look ${m.lookAlikes} D ${def.d.toFixed(1).padStart(5)} (target ${targetD(n).toFixed(1)}) ${ms}ms ${tw}`);
}
