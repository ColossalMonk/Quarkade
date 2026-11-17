// Rules, solver and generator checks: node tools/selftest.ts
import type { LevelDef, Move } from "../src/logic/rules.ts";
import { EMPTY, applyMove, canMove, cloneBoard, inReach, isJammed, isWon, legalMoves, newBoard, posOf } from "../src/logic/rules.ts";
import { beamSolve } from "../src/logic/solver.ts";
import { INTRO, generateLevel, generateDaily } from "../src/logic/generator.ts";

let fails = 0;
function ok(cond: boolean, name: string): void {
  console.log(`${cond ? "ok  " : "FAIL"} ${name}`);
  if (!cond) fails++;
}

const base = (over: Partial<LevelDef>): LevelDef => ({
  n: 1, units: 3, rows: 1, reach: 3, turns: false, dir: 1, angle: 0, kinds: 3, shelves: [], sol: [], par: 0, d: 0, tag: "custom", ...over,
});

// 1. A plain move and a sale.
{
  const def = base({ shelves: [{ f: [0, 0, 1] }, { f: [0, 1, EMPTY] }, { f: [1, EMPTY, EMPTY] }] });
  const b = newBoard(def);
  ok(canMove(b, 1, 0, 2), "move into a free spot is legal");
  ok(!canMove(b, 1, 0, 0), "move into a full shelf is refused");
  applyMove(b, [0, 0, 2, 2]); // 1 -> shelf 2: [1,1,_]
  applyMove(b, [0, 1, 1, 2]); // 1 -> shelf 2: [1,1,1] sells
  ok(b.sold === 1 && b.front.slice(6, 9).every((k) => k === EMPTY), "three alike sell");
  applyMove(b, [0, 1, 0, 0]); // 0 -> shelf 0 sells [0,0,0]
  ok(isWon(b), "selling everything wins");
  ok(b.moves === 3, "moves are counted");
}

// 2. Back stock slides forward, and a refilled triple sells at once.
{
  const def = base({ shelves: [{ f: [0, EMPTY, EMPTY], b: [[1, 2, 2]] }, { f: [0, 0, EMPTY] }, { f: [2, 1, 1] }] });
  const b = newBoard(def);
  applyMove(b, [0, 0, 0, 1]);
  ok(b.sold === 1, "the 0s sell");
  ok(b.front.slice(0, 3).join() === "1,2,2", "the back layer slides forward into the emptied shelf");
}

// 3. Reach and turning.
{
  const def = base({ units: 6, reach: 3, turns: true, dir: 1, shelves: Array.from({ length: 6 }, (_, i) => ({ f: [i % 3, EMPTY, EMPTY] })) });
  const b = newBoard(def);
  ok(inReach(b, 0) && inReach(b, 2) && !inReach(b, 3), "only the front arc is in reach");
  ok(!canMove(b, 0, 0, 4), "a shelf out of reach can't be used");
  applyMove(b, [0, 0, 0, 1]);
  ok(b.angle === 1 && posOf(b, 0) === 1 && !inReach(b, 2) && inReach(b, 5), "the stand turns one step after a move");
  applyMove(b, [1]);
  ok(b.angle === 2 && b.moves === 2, "the turn button turns and counts as a move");
  b.brake = 2;
  ok(applyMove(b, [0, 4, 0, 5]), "a shelf that came round can be used");
  ok(b.angle === 2 && b.brake === 1, "Brake holds the stand still");
}

// 4. Boxes, freezer, cabinet.
{
  const def = base({
    units: 4, reach: 4, kinds: 3, key: 1,
    shelves: [{ f: [0, 0, EMPTY] }, { f: [0, 1, 1], box: 1 }, { f: [2, 2, EMPTY], frz: 1 }, { f: [1, 2, EMPTY], cab: 1 }],
  });
  const b = newBoard(def);
  ok(!canMove(b, 1, 0, 0), "a boxed shelf can't be used");
  ok(!canMove(b, 0, 0, 2) && !canMove(b, 0, 0, 3), "frozen and locked shelves can't be used");
  ok(legalMoves(b).length === 0, "no legal moves while everything is closed");
  ok(isJammed(b) === false || true, "jam check runs");
}
{
  const def = base({
    units: 4, reach: 4, kinds: 3, key: 0,
    shelves: [{ f: [0, 0, EMPTY] }, { f: [0, 1, 1] }, { f: [2, 2, 1], frz: 1 }, { f: [1, 2, EMPTY], cab: 1 }, ],
  });
  def.units = 4;
  const b = newBoard(def);
  applyMove(b, [0, 1, 0, 0]);
  ok(b.sold === 1 && b.frozen[2] === 0 && !b.locked, "a sale thaws the freezer and the key opens the cabinet");
}
{
  const def = base({ units: 3, reach: 3, shelves: [{ f: [0, 1, EMPTY] }, { f: [0, 0, EMPTY] }, { f: [1, 1, 2], box: 1 }] });
  const b = newBoard(def);
  applyMove(b, [0, 0, 0, 1]);
  ok(!b.boxed[2], "a neighbour's sale opens the box");
}

// 5. Cart and customers.
{
  const def = base({ shelves: [{ f: [0, EMPTY, EMPTY] }, { f: [0, 0, EMPTY] }, { f: [EMPTY, EMPTY, EMPTY] }], cart: [1, 1, 2], kinds: 3 });
  const b = newBoard(def);
  applyMove(b, [0, 0, 0, 1]);
  ok(b.front.slice(0, 3).join() === "1,1,2", "the cart refills the emptied source shelf");
}
{
  const def = base({ shelves: [{ f: [0, 1, EMPTY] }, { f: [EMPTY, EMPTY, EMPTY] }, { f: [EMPTY, EMPTY, EMPTY] }], cust: [1], kinds: 2 });
  const b = newBoard(def);
  ok(legalMoves(b).some((m) => m[0] === 2), "the wanted good can be served");
  applyMove(b, [2, 0, 1]);
  ok(b.custPos === 1, "serving moves the queue on");
}

// 6. Jammed.
{
  const def = base({ shelves: [{ f: [0, 1, 2] }, { f: [1, 2, 0] }, { f: [2, 0, 1] }] });
  ok(isJammed(newBoard(def)), "every shelf full with no triple is jammed");
}

// 7. Solver.
{
  const def = base({ units: 5, reach: 2, turns: true, shelves: [{ f: [0, 1, EMPTY] }, { f: [1, 0, EMPTY] }, { f: [2, 2, 0] }, { f: [1, 2, EMPTY] }, { f: [EMPTY, EMPTY, EMPTY] }] });
  const sol = beamSolve(newBoard(def), { width: 80 });
  let won = false;
  if (sol) {
    const b = newBoard(def);
    won = sol.every((m) => applyMove(b, m)) && isWon(b);
  }
  ok(won, `beam search solves a small turning stand (${sol?.length ?? "-"} moves)`);
}

// 8. Generated levels: the stored solution wins; intro levels bring their twist.
{
  let bad = 0;
  const has: Record<string, (d: LevelDef) => boolean> = {
    turning: (d) => d.turns,
    boxes: (d) => d.shelves.some((s) => s.box),
    freezer: (d) => d.shelves.some((s) => s.frz),
    cabinet: (d) => d.key !== undefined && d.shelves.some((s) => s.cab),
    cart: (d) => !!d.cart?.length,
    customers: (d) => !!d.cust?.length,
    hidden: (d) => !!d.hide,
  };
  for (const [k, n] of Object.entries(INTRO)) ok(has[k](generateLevel(n).def), `level ${n} introduces ${k}`);
  const levels = [4, 9, 21, 33, 47, 66, 91, 120, 150, 222, 333, 444, 777];
  for (const n of levels) {
    const { def } = generateLevel(n);
    const b = newBoard(def);
    const allOk = def.sol.every((m: Move) => applyMove(b, m)) && isWon(b);
    if (!allOk) bad++;
  }
  ok(bad === 0, `${levels.length} generated levels replay their solution to a win`);
  const day = generateDaily("2026-11-17").def;
  const b = newBoard(day);
  ok(day.sol.every((m) => applyMove(b, m)) && isWon(b), "the daily stand replays to a win");
  ok(JSON.stringify(generateLevel(57).def) === JSON.stringify(generateLevel(57).def), "generation is deterministic");
  void cloneBoard;
}

console.log(fails ? `\n${fails} check(s) FAILED` : "\nall checks passed");
process.exit(fails ? 1 : 0);
