// Sweep: generate many levels and replay each stored solution. node tools/sweep.ts [from] [to] [step]
import { generateLevel } from "../src/logic/generator.ts";
import { isWon, newBoard, placePiece } from "../src/logic/rules.ts";
const [a = 21, b = 1200, st = 10] = process.argv.slice(2).map(Number);
let bad = 0;
let count = 0;
for (let n = a; n <= b; n += st) {
  const def = generateLevel(n).def;
  const brd = newBoard(def);
  const ok = def.sol.every((pl, i) => placePiece(brd, i, pl)) && isWon(brd);
  count++;
  if (!ok) {
    bad++;
    console.log(`level ${n}: solution does not play out`);
  }
}
console.log(`${count} levels, ${bad} bad`);
process.exit(bad ? 1 : 0);
