// Prints the generated levels' shape across a range: node tools/curve.ts <from> <to> <step>
import { generateLevel, targetD } from "../src/logic/generator.ts";

const [from, to, step] = process.argv.slice(2).map(Number);
for (let n = from || 4; n <= (to || 200); n += step || 10) {
  const t0 = performance.now();
  const { def, metrics: m } = generateLevel(n);
  const ms = Math.round(performance.now() - t0);
  const tw = [def.shelves.some((s) => s.box) && "box", def.shelves.some((s) => s.frz) && "frz", def.key !== undefined && "cab", def.cart && `cart${def.cart.length}`, def.cust && `cust${def.cust.length}`, def.hide && "hide"].filter(Boolean).join(",");
  console.log(`${String(n).padStart(4)} ${def.tag.padEnd(9)} U${def.units}x${def.rows} r${def.reach} k${def.kinds} goods ${String(m.goods).padStart(2)} L${m.layers} free ${String(m.freeSpots).padStart(2)} sol ${String(def.sol.length).padStart(3)} par ${String(def.par).padStart(3)} jam ${m.jam.toFixed(2)} D ${def.d.toFixed(1).padStart(5)} (target ${targetD(n).toFixed(1)}) ${ms}ms ${tw}`);
}
