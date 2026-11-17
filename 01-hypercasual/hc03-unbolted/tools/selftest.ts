// Unbolted self-test: rules on tiny hand-built boards, the solver, the generator.
//   node tools/selftest.ts

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { LevelDef, PlateRow, BoltRow } from "../src/logic/rules.ts";
import { drill, extraSlot, isCovered, isFree, isLocked, isStuck, isWon, legalMoves, magnet, newBoard, oilCan, tap } from "../src/logic/rules.ts";
import { toWorld } from "../src/logic/shapes.ts";
import { solve } from "../src/logic/solver.ts";
import { generateLevel, generateDaily, INTRO, sensiblePlay } from "../src/logic/generator.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
let failed = 0;
function check(name: string, ok: boolean, extra = ""): void {
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${extra ? `  ${extra}` : ""}`);
  if (!ok) failed++;
}
const near = (a: number, b: number, eps = 1e-3) => Math.abs(a - b) < eps;

function level(plates: PlateRow[], bolts: BoltRow[], boxes: number[], extra: Partial<LevelDef> = {}): LevelDef {
  const k = Math.max(...boxes, ...bolts.map((b) => b[2])) + 1;
  return { n: 0, plates, bolts, pins: [], chains: [], boxes, k, tray: 5, par: 0, d: 0, tag: "normal", ...extra };
}
const P = (shape: number, x: number, y: number, rot = 0, layer = 0, flags = 0, lock = -1): PlateRow => [shape, x, y, rot, layer, flags, lock];
const B = (plate: number, hole: number, colour: number, flags = 0, p2 = -1, h2 = -1): BoltRow => [plate, hole, colour, flags, p2, h2];

// 1. The swing: a bar3 held at both ends; remove the right bolt and it hangs straight down from the left.
{
  const def = level([P(1, 1, 4)], [B(0, 0, 0), B(0, 2, 0), B(0, 1, 0)], [0]);
  const b = newBoard(def);
  tap(b, 2);
  check("2 bolts left: plate stays", near(b.pose[0].a, 0));
  const r = tap(b, 1)!;
  const end = toWorld(b.pose[0], 2, 0);
  check("1 bolt left: plate swings", r.swung.includes(0));
  check("hangs straight down from the pivot", near(end[0], 1) && near(end[1], 2), `end ${end.map((v) => v.toFixed(2))}`);
  tap(b, 0);
  check("0 bolts: plate drops, level won", !b.plateOn[0] && isWon(b));
}

// 2. Coverage and the swing clearing it: an upper vertical bar covers a lower bolt until it swings away.
{
  const def = level(
    [P(0, 1, 2, 0, 0), P(1, 1, 1, 1, 1)],
    [B(0, 0, 0), B(0, 1, 0), B(1, 0, 1), B(1, 2, 1), B(0, 0, 0, 0)],
    [0, 1],
  );
  // Fix the duplicate: give the lower bar a third bolt? Keep it to 2 lower + 2 upper + filler on a separate plate.
  def.bolts = [B(0, 0, 0), B(0, 1, 0), B(1, 0, 1), B(1, 2, 1)];
  def.plates.push(P(0, 4, 7, 0, 0));
  def.bolts.push(B(2, 0, 0), B(2, 1, 1));
  const b = newBoard(def);
  check("upper plate covers the bolt under its solid middle", isCovered(b, 0));
  check("bolt beside it is free", !isCovered(b, 1));
  check("covered bolt can't be tapped", tap(b, 0) === null);
  tap(b, 3); // upper's top bolt: upper now hangs from (1,1), pointing down
  check("after the swing, the bolt is uncovered", !isCovered(b, 0));
  check("and can be tapped", isFree(b, 0) && tap(b, 0) !== null);
}

// 3. Boxes, tray, closing and pulling from the tray.
{
  // Three single-hole-used bars; colours 0,0,0 then 1 (to tray first), boxes [0, 2, 1].
  const def = level(
    [P(1, 0, 0), P(1, 0, 2), P(1, 0, 4), P(1, 0, 6)],
    [B(0, 0, 1), B(0, 2, 1), B(1, 0, 1), B(1, 2, 0), B(2, 0, 0), B(2, 2, 0), B(3, 0, 2), B(3, 2, 2), B(3, 1, 2)],
    [0, 2, 1],
  );
  const b = newBoard(def);
  const r1 = tap(b, 0)!;
  check("colour with no open box goes to the tray", r1.to === -1 && b.tray.length === 1 && b.detours === 1);
  tap(b, 3);
  tap(b, 4);
  const r2 = tap(b, 5)!;
  check("third bolt closes the box", r2.closes.length === 1 && r2.closes[0].colour === 0);
  check("next box slides in and pulls tray bolts", r2.closes[0].pulled === 1 && b.tray.length === 0 && b.slots[r2.closes[0].slot]!.n === 1);
  // Fill everything.
  for (let guard = 0; guard < 20 && !isWon(b); guard++) tap(b, legalMoves(b)[0]);
  check("level completes with every box closed", isWon(b) && b.slots.every((s) => s === null));
}

// 4. Jam: tray full refuses the tap.
{
  const def = level(
    [P(2, 0, 0), P(2, 0, 2), P(0, 0, 5)],
    [B(0, 0, 1), B(0, 1, 1), B(0, 2, 1), B(0, 3, 0), B(1, 0, 0), B(1, 1, 0), B(1, 2, 2), B(1, 3, 2), B(2, 0, 2)],
    [0, 2, 1],
    { tray: 1 },
  );
  const b = newBoard(def);
  // boxes 0 and 2 open; colour 1 must wait in the tray (cap 1).
  check("first colour-1 bolt goes to the tray", tap(b, 0)!.to === -1);
  check("second is refused (jammed)", tap(b, 1) === null);
  check("Extra Slot makes room", (extraSlot(b), tap(b, 1) !== null));
}

// 5. Padlock: a plate locked to colour 0 opens when a colour-0 box closes.
{
  const def = level(
    [P(1, 0, 0), P(1, 0, 3, 0, 0, 0, 0)],
    [B(0, 0, 0), B(0, 1, 0), B(0, 2, 0), B(1, 0, 1), B(1, 1, 1), B(1, 2, 1)],
    [0, 1],
  );
  const b = newBoard(def);
  check("padlocked bolt is locked", isLocked(b, 3) && tap(b, 3) === null);
  tap(b, 0);
  tap(b, 1);
  const r = tap(b, 2)!;
  check("closing a box of its colour opens it", !isLocked(b, 3) && r.unlocked.includes(1));
}

// 6. Chain: a plate with no bolts hangs from its partner's chain, and drops with it.
{
  const def = level(
    [P(1, 2, 6, 0, 0), P(0, 2, 4, 0, 1)],
    [B(0, 0, 0), B(0, 2, 0), B(1, 0, 0)],
    [0],
    { chains: [[1, 1, 0, 1]] },
  );
  const b = newBoard(def);
  tap(b, 2);
  check("chained plate hangs instead of dropping", b.plateOn[1]);
  tap(b, 0);
  check("still hangs while the partner swings on one bolt", b.plateOn[1] && b.plateOn[0]);
  tap(b, 1);
  check("partner drops, so it drops too", !b.plateOn[0] && !b.plateOn[1] && isWon(b));
}

// 7. Long bolt: holds two plates; removing it frees both.
{
  const def = level(
    [P(0, 1, 1, 0, 0), P(0, 2, 1, 0, 1)],
    [B(0, 0, 0), B(0, 1, 0, 0, 1, 0), B(1, 1, 0)],
    [0],
  );
  const b = newBoard(def);
  tap(b, 2);
  check("long bolt pins the upper plate (hangs from it)", b.plateOn[1]);
  tap(b, 1);
  check("removing the long bolt affects both plates", !b.plateOn[1] && b.plateOn[0]);
}

// 8. Rusty: revealed when another bolt on the same plate comes out; Oil Can reveals all.
{
  const def = level([P(1, 0, 0), P(1, 0, 3)], [B(0, 0, 0), B(0, 1, 0, 1), B(0, 2, 0), B(1, 0, 1, 1), B(1, 1, 1), B(1, 2, 1)], [0, 1]);
  const b = newBoard(def);
  check("rusty starts hidden", !b.revealed[1] && !b.revealed[3]);
  const r = tap(b, 0)!;
  check("neighbour removal reveals it", b.revealed[1] && r.revealed.includes(1) && !b.revealed[3]);
  check("Oil Can reveals the rest", oilCan(b).includes(3) && b.revealed[3]);
}

// 9. Drill and Magnet.
{
  const def = level(
    [P(0, 1, 2, 0, 0), P(1, 1, 1, 1, 1), P(0, 4, 7, 0, 0)],
    [B(0, 0, 0), B(0, 1, 0), B(1, 0, 1), B(1, 2, 1), B(2, 0, 0), B(2, 1, 1)],
    [0, 1],
  );
  const b = newBoard(def);
  check("Drill takes a covered bolt", isCovered(b, 0) && drill(b, 0) !== null && !b.boltOn[0]);
  const b2 = newBoard(def);
  const pulled = magnet(b2, 0);
  check("Magnet fills the box from anywhere", pulled.length === 3 && b2.closed[0] === 1);
}

// 10. Solver: a level where a careless order needs the tray, and the best needs none.
{
  const def = level(
    [P(1, 0, 0), P(1, 0, 2), P(1, 0, 4)],
    [B(0, 0, 0), B(0, 1, 0), B(0, 2, 0), B(1, 0, 1), B(1, 1, 1), B(1, 2, 1), B(2, 0, 2), B(2, 1, 2), B(2, 2, 2)],
    [0, 1, 2],
  );
  const res = solve(newBoard(def));
  check("solver finds 0 detours", res.solved && res.detours === 0);
  const b = newBoard(def);
  for (const m of res.moves) tap(b, m);
  check("solver's moves win", isWon(b));
}

// 11. Generator: solvable, deterministic, specials appear at their intro levels.
{
  for (const n of [21, 45, 61, 91, 150]) {
    const t0 = performance.now();
    const g = generateLevel(n);
    const ms = performance.now() - t0;
    const res = solve(newBoard(g.def), { maxNodes: 60000 });
    const human = sensiblePlay(g.def);
    check(`level ${n} solvable`, res.solved || human.won, `bolts ${g.def.bolts.length} par ${g.def.par} opt ${res.detours} D ${g.def.d} ${ms.toFixed(0)}ms`);
  }
  check("same seed -> same level", JSON.stringify(generateLevel(33).def) === JSON.stringify(generateLevel(33).def));
  check("45 introduces padlocks", generateLevel(INTRO.padlock).def.plates.some((p) => p[6] >= 0));
  check("61 introduces chains", generateLevel(INTRO.chain).def.chains.length > 0);
  check("91 introduces long bolts", generateLevel(INTRO.long).def.bolts.some((b) => b[4] >= 0));
  check("12 introduces hinges", generateLevel(INTRO.hinge).def.pins.length > 0);
  const d = generateDaily("2026-11-14");
  check("daily is solvable and has no padlocks", sensiblePlay(d.def).won && !d.def.plates.some((p) => p[6] >= 0), `bolts ${d.def.bolts.length} par ${d.def.par}`);
}

// 12. Tutorial levels (if present): each solvable, with total bolts matching the boxes.
{
  const f = join(root, "src/data/levels-tutorial.json");
  if (existsSync(f)) {
    const tut: LevelDef[] = JSON.parse(readFileSync(f, "utf8"));
    tut.forEach((def, i) => {
      const okCount = def.bolts.length === def.boxes.length * 3;
      const res = solve(newBoard(def), { maxNodes: 60000 });
      check(`tutorial ${i + 1} solvable`, okCount && res.solved, `bolts ${def.bolts.length} opt ${res.detours} par ${def.par}`);
    });
  }
}

void isStuck;
console.log(failed ? `\n${failed} FAILED` : "\nall checks passed");
process.exit(failed ? 1 : 0);
