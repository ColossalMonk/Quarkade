// Rules, solver and generator checks: node tools/selftest.ts
import type { LevelDef } from "../src/logic/rules.ts";
import { HEARTS, canTurn, freeKoi, isOutOfHearts, isWon, netKoi, newBoard, tapKoi, trace, turnKoi } from "../src/logic/rules.ts";
import { solveOrder } from "../src/logic/solver.ts";
import { INTRO, generateDaily, generateLevel } from "../src/logic/generator.ts";

let fails = 0;
function ok(cond: boolean, name: string): void {
  console.log(`${cond ? "ok  " : "FAIL"} ${name}`);
  if (!cond) fails++;
}

const pond = (w: number, h: number, over: Partial<LevelDef>): LevelDef => ({ n: 1, w, h, koi: [], sol: [], d: 0, tag: "custom", ...over });
// Cell index helper for a w-wide pond.
const at = (w: number) => (x: number, y: number) => y * w + x;

// 1. Fry swimming out, and being blocked.
{
  const c = at(3);
  // A fry at (0,1) facing right, blocked by a fry at (2,1) facing up.
  const def = pond(3, 3, { koi: [{ c: [c(0, 1)], d: 1 }, { c: [c(2, 1)], d: 0 }] });
  const b = newBoard(def);
  ok(!trace(b, 0).ok && trace(b, 1).ok, "a fry is blocked by another in its line, the other is free");
  tapKoi(b, 0);
  ok(b.hearts === HEARTS - 1 && !b.out[0], "a blocked koi bumps back and costs a heart");
  tapKoi(b, 1);
  tapKoi(b, 0);
  ok(isWon(b) && b.escaped === 2, "freeing the blocker lets the other out; all out wins");
}

// 2. A long koi swims out head-first; its own body never blocks it.
{
  const c = at(4);
  // An L-shaped koi: head (3,0) facing right, body (2,0),(2,1),(2,2).
  const def = pond(4, 3, { koi: [{ c: [c(3, 0), c(2, 0), c(2, 1), c(2, 2)], d: 1 }, { c: [c(0, 0)], d: 1 }] });
  const b = newBoard(def);
  ok(trace(b, 0).ok, "a long koi at the edge facing out is free");
  ok(!trace(b, 1).ok, "a fry facing into a long koi's body is blocked");
  // A koi whose head turns back across its own body: ray right from (0,1) runs through its own tail.
  const def2 = pond(4, 3, { koi: [{ c: [c(0, 1), c(0, 0), c(1, 0), c(2, 0), c(2, 1), c(3, 1)], d: 2 }] });
  ok(trace(newBoard(def2), 0).ok, "a long koi heading away from its body is free");
}

// 3. Lily pads, reeds, frogs, currents.
{
  const c = at(3);
  const padDef = pond(3, 1, { koi: [{ c: [c(0, 0)], d: 1 }], pads: [c(1, 0)] });
  ok(!trace(newBoard(padDef), 0).ok, "a lily pad blocks");
  const reedDef = pond(3, 1, { koi: [{ c: [c(0, 0)], d: 3 }], reeds: [c(0, 0) * 4 + 3] });
  ok(!trace(newBoard(reedDef), 0).ok, "a reed bank closes the exit");
  const frogDef = pond(3, 2, { koi: [{ c: [c(0, 0)], d: 1 }, { c: [c(0, 1)], d: 3 }], frogs: [[c(1, 0), 1]] });
  const fb = newBoard(frogDef);
  ok(!trace(fb, 0).ok, "a frog blocks until its count");
  tapKoi(fb, 1);
  ok(trace(fb, 0).ok, "after its count of koi have left, the frog hops away");
  const curDef = pond(3, 3, { koi: [{ c: [c(0, 1)], d: 1 }, { c: [c(2, 1)], d: 0 }], currents: [[c(1, 1), 2]] });
  const cb = newBoard(curDef);
  const r = trace(cb, 0);
  ok(r.ok && r.exitDir === 2, "a current turns a swimming koi");
}

// 4. Whirlpools turn fry; the solver avoids the dead end.
{
  const c = at(3);
  // Fry A on a whirlpool at (1,1) facing up; a pad above it; fry B at (0,0) free.
  const def = pond(3, 3, { koi: [{ c: [c(1, 1)], d: 0 }, { c: [c(0, 0)], d: 3 }], whirls: [c(1, 1)], pads: [c(1, 0)] });
  const b = newBoard(def);
  ok(!trace(b, 0).ok, "the whirlpool fry starts facing the pad");
  tapKoi(b, 1);
  ok(b.dir[0] === 1 && trace(b, 0).ok, "another koi leaving turns the whirlpool fry a quarter");
  const sol = solveOrder(newBoard(def));
  ok(!!sol.order && sol.order.length === 2, "the solver finds an order");
}

// 5. Hearts, Net, Bread.
{
  const c = at(3);
  const def = pond(3, 3, { koi: [{ c: [c(0, 1)], d: 1 }, { c: [c(1, 1)], d: 3 }] });
  const b = newBoard(def);
  for (let i = 0; i < HEARTS; i++) tapKoi(b, 0);
  ok(isOutOfHearts(b), "three bumps empty the hearts");
  const b2 = newBoard(def);
  netKoi(b2, 1);
  ok(b2.out[1] && b2.escaped === 1 && freeKoi(b2).includes(0), "the Net lifts a koi out");
  const b3 = newBoard(def);
  ok(!canTurn(b3, 0, 1) && canTurn(b3, 0, 0), "Bread only turns a koi into a free cell");
  turnKoi(b3, 0, 0);
  ok(trace(b3, 0).ok, "a turned koi can swim out its new way");
}

// 6. Generated levels: the stored order wins; intro levels bring their twist.
{
  const has: Record<string, (d: LevelDef) => boolean> = {
    pads: (d) => !!d.pads?.length,
    reeds: (d) => !!d.reeds?.length,
    long: (d) => d.koi.some((k) => k.c.length >= 3),
    whirls: (d) => !!d.whirls?.length,
    frogs: (d) => !!d.frogs?.length,
    currents: (d) => !!d.currents?.length,
  };
  for (const [k, n] of Object.entries(INTRO)) ok(has[k](generateLevel(n).def), `level ${n} introduces ${k}`);
  let bad = 0;
  const levels = [1, 4, 9, 16, 21, 33, 47, 66, 91, 120, 150, 222, 333, 444, 777];
  for (const n of levels) {
    const { def } = generateLevel(n);
    const b = newBoard(def);
    for (const i of def.sol) tapKoi(b, i);
    if (!isWon(b) || b.heartsLost) bad++;
  }
  ok(bad === 0, `${levels.length} generated levels: the stored order frees every koi with no heart lost`);
  const day = generateDaily("2026-11-19").def;
  const db = newBoard(day);
  for (const i of day.sol) tapKoi(db, i);
  ok(isWon(db) && db.heartsLost === 0, "the daily pond plays out");
  ok(JSON.stringify(generateLevel(57).def) === JSON.stringify(generateLevel(57).def), "generation is deterministic");
}

console.log(fails ? `\n${fails} check(s) FAILED` : "\nall checks passed");
process.exit(fails ? 1 : 0);
