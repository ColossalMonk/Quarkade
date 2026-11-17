// Generates a range of levels and replays each stored solution: node tools/sweep.ts <from> <to> <step>
import { applyMove, isWon, newBoard } from "../src/logic/rules.ts";
import { generateLevel } from "../src/logic/generator.ts";

const [from, to, step] = process.argv.slice(2).map(Number);
let ok = 0;
let bad = 0;
for (let n = from || 21; n <= (to || 600); n += step || 7) {
  const { def } = generateLevel(n);
  const b = newBoard(def);
  if (def.sol.every((m) => applyMove(b, m)) && isWon(b)) ok++;
  else {
    bad++;
    console.log(`level ${n}: stored solution does NOT win`);
  }
}
console.log(`${ok + bad} levels, ${bad} bad`);
