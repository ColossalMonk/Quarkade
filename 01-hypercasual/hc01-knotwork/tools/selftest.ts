// Headless checks for Knotwork's rules, solver and generator.
// Run: node tools/selftest.ts   (Node 23.6+ runs TypeScript directly)

import {
  decodeLevel,
  applyMove,
  isWon,
  isStuck,
  snip,
  yarnSwift,
  addSpareNeedle,
  legalMoves,
  encodeStack,
  parseStack,
  topRun,
  moveAmount,
} from "../src/logic/rules.ts";
import type { LevelDef } from "../src/logic/rules.ts";
import { solve } from "../src/logic/solver.ts";
import { generateLevel, generateDaily } from "../src/logic/generator.ts";

let failures = 0;
function check(name: string, ok: boolean, extra = ""): void {
  if (!ok) failures++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${extra ? "  " + extra : ""}`);
}

// Level 1 from the design: 2 colours, 3 needles, solved in 3 moves.
const l1: LevelDef = { n: 1, caps: [4, 4, 4], stacks: ["aabb", "bbaa", ""], L: 4, par: 3, d: 0, tag: "tutorial" };
{
  const b = decodeLevel(l1);
  applyMove(b, { kind: "move", from: 1, to: 2 }); // aa -> empty
  applyMove(b, { kind: "move", from: 0, to: 1 }); // bb onto bb -> complete
  check("needle completes and locks", b.locked[1] === true);
  applyMove(b, { kind: "move", from: 2, to: 0 }); // aa onto aa -> complete
  check("level 1 solvable in 3 moves", isWon(b));
  const s = solve(decodeLevel(l1), { weight: 1 });
  check("solver finds 3-move solution", s.solved && s.moves.length === 3, `got ${s.moves.length}`);
}

// Groups move together, capped by space.
{
  const b = decodeLevel({ ...l1, stacks: ["abbb", "ab", "a"], caps: [4, 4, 4] });
  const r = applyMove(b, { kind: "move", from: 0, to: 1 });
  check("run of 3 moves only 2 (space)", r.moved === 2, `moved ${r.moved}`);
}

// Hidden loops don't join runs until revealed.
{
  const b = decodeLevel({ ...l1, stacks: ["aBb", "b", ""], caps: [4, 4, 4] });
  const r = applyMove(b, { kind: "move", from: 0, to: 2 });
  check("hidden loop stays behind", r.moved === 1 && b.hidden[0][1] === false, `moved ${r.moved}`);
}

// Stuck detection.
{
  const b = decodeLevel({ ...l1, stacks: ["abab", "baba"], caps: [4, 4] });
  check("stuck when no moves", isStuck(b) && legalMoves(b).length === 0);
  addSpareNeedle(b);
  check("spare needle unsticks", !isStuck(b));
}

// Snip + basket.
{
  const b = decodeLevel({ ...l1, stacks: ["baaa", "bbba", ""], caps: [4, 4, 4] });
  check("snip bottom loop", snip(b, 0, 0) && b.basket.length === 1 && b.stacks[0].length === 3);
  const r = applyMove(b, { kind: "move", from: 1, to: 2 });
  check("move after snip", r.moved === 1);
}

// Yarn Swift completes a colour wherever its loops are.
{
  const b = decodeLevel({ ...l1, stacks: ["abab", "baba", ""], caps: [4, 4, 4] });
  const target = yarnSwift(b, 0);
  check(
    "swift winds colour a onto the empty needle and locks it",
    target === 2 && b.locked[2] && b.stacks[2].join("") === "0000" && !isWon(b),
    JSON.stringify(b.stacks),
  );
}

// ---- v0.2 specials ----

// Encoding round trip: twisted, knot, hidden.
{
  const s = "a(ab)~(ab)Bc~c";
  check("stack encoding round-trips", encodeStack(parseStack(s).loops, parseStack(s).hidden) === s, encodeStack(parseStack(s).loops, parseStack(s).hidden));
}

// Twisted loops sit on either colour and complete either colour.
{
  const b = decodeLevel({ ...l1, caps: [4, 4, 4, 4], stacks: ["aaa(ab)", "bbb(ab)", "", ""], L: 4 });
  const r = applyMove(b, { kind: "move", from: 0, to: 2 }); // aaa(ab) is one run of 4 -> empty needle
  check("twisted joins a run of its colour", r.moved === 4 && b.locked[2], `moved ${r.moved}`);
  // a and b: 3 plain loops each + two twisted (ab) loops; one twisted must go to each colour.
  const s2 = solve(decodeLevel({ ...l1, caps: [4, 4, 4, 4, 4], stacks: ["a(ab)b", "b(ab)a", "ab", "", ""], L: 4 }), { weight: 1 });
  check("solver handles twisted loops", s2.solved, `moves ${s2.moves.length}`);
}

// Knots: move together, never split.
{
  const b = decodeLevel({ ...l1, caps: [4, 4, 4], stacks: ["ba~a", "aab", "b"], L: 4 });
  check("knotted pair lifts as 2", topRun(b, 0) === 2, `run ${topRun(b, 0)}`);
  check("knot can't squeeze into 1 space", moveAmount(b, { kind: "move", from: 0, to: 1 }) === 0);
  const b2 = decodeLevel({ ...l1, caps: [4, 4, 4], stacks: ["ba~a", "aa", ""], L: 4 });
  const r = applyMove(b2, { kind: "move", from: 0, to: 1 });
  check("knot moves as a pair and completes", r.moved === 2 && b2.locked[1], encodeStack(b2.stacks[1]));
  const b3 = decodeLevel({ ...l1, caps: [4, 4, 4], stacks: ["ba~a", "", ""], L: 4 });
  snip(b3, 0, 1);
  check("snip cuts the knot", encodeStack(b3.stacks[0]) === "ba" && b3.basket.length === 1, encodeStack(b3.stacks[0]));
}

// Moth: counts down, flies when its needle is used, chews at zero.
{
  const b = decodeLevel({ ...l1, caps: [4, 4, 4, 4], stacks: ["abab", "baba", "", ""], L: 4, moth: [0, 2] });
  let r = applyMove(b, { kind: "move", from: 1, to: 2 });
  check("moth counts down", b.moth?.needle === 0 && b.moth.count === 1 && !r.mothChewed);
  r = applyMove(b, { kind: "move", from: 0, to: 3 });
  check("moth flies when its needle is used", b.moth?.needle !== 0 && b.moth?.count === 6, JSON.stringify(b.moth));
  const b2 = decodeLevel({ ...l1, caps: [4, 4, 4, 4], stacks: ["abab", "baba", "", ""], L: 4, moth: [0, 1] });
  r = applyMove(b2, { kind: "move", from: 1, to: 2 });
  check("moth chews when the timer runs out", r.mothChewed);
  const s = solve(decodeLevel({ ...l1, caps: [4, 4, 4, 4], stacks: ["abab", "baba", "", ""], L: 4, moth: [0, 2] }), { weight: 1 });
  check("solver respects the moth", s.solved, `moves ${s.moves.length}`);
}

// Generator across bands (45 = twisted intro, 61 = knot intro, 80 = moth intro).
for (const n of [21, 30, 45, 61, 80, 100, 150, 250, 450]) {
  const t0 = performance.now();
  const lvl = generateLevel(n);
  const ms = Math.round(performance.now() - t0);
  const s = solve(decodeLevel(lvl.def), { weight: 1.4 });
  const st = lvl.def.stacks.join("");
  check(
    `level ${n} generated + solvable`,
    s.solved,
    `${ms}ms tag=${lvl.def.tag} k=${lvl.metrics.k} needles=${lvl.def.caps.length} par=${lvl.def.par} D=${lvl.def.d} dead=${lvl.metrics.deadEndRate.toFixed(2)} twist=${(st.match(/\(/g) ?? []).length} knots=${(st.match(/~/g) ?? []).length} moth=${lvl.def.moth ? "yes" : "no"}`,
  );
}
check("level 45 introduces twisted loops", generateLevel(45).def.stacks.join("").includes("("));
check("level 61 introduces knots", generateLevel(61).def.stacks.join("").includes("~"));
check("level 80 introduces the moth", !!generateLevel(80).def.moth);

// Daily Swatch: same day -> same puzzle, different day -> different puzzle.
{
  const t0 = performance.now();
  const a = generateDaily("2026-11-12").def;
  const ms = Math.round(performance.now() - t0);
  const b = generateDaily("2026-11-12").def;
  const c = generateDaily("2026-11-13").def;
  check("daily is the same for everyone that day", JSON.stringify(a) === JSON.stringify(b), `${ms}ms par=${a.par} D=${a.d}`);
  check("daily changes each day", JSON.stringify(a.stacks) !== JSON.stringify(c.stacks));
}

// Determinism.
check("same seed -> same level", JSON.stringify(generateLevel(33).def) === JSON.stringify(generateLevel(33).def));

console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
process.exit(failures ? 1 : 0);
