// Headless checks for Density's rules, solver and generator.   node tools/selftest.ts

import { decodeLevel, applyMove, moveAmount, isWon, isStuck, legalMoves, addSpareFlask, pipette, centrifuge, settle, encodeStacks } from "../src/logic/rules.ts";
import type { LevelDef } from "../src/logic/rules.ts";
import { solve } from "../src/logic/solver.ts";
import { generateLevel, generateDaily, INTRO } from "../src/logic/generator.ts";

let failures = 0;
function check(name: string, ok: boolean, extra = ""): void {
  if (!ok) failures++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${extra ? "  " + extra : ""}`);
}
const base = (stacks: string[], classes: number[], caps?: number[]): LevelDef => ({
  n: 1,
  caps: caps ?? stacks.map(() => 4),
  stacks,
  classes,
  L: 4,
  par: 0,
  d: 0,
  tag: "tutorial",
});
const enc = (b: { stacks: number[][] }) => encodeStacks(b.stacks).join(" ");

// Level 1: two waters, classic.
{
  const def = base(["aabb", "bbaa", ""], [3, 3]);
  const s = solve(decodeLevel(def), { weight: 1 });
  check("classic two-water level solves in 3", s.solved && s.moves.length === 3, `got ${s.moves.length}`);
}

// Settling keeps heavy at the bottom and deal order within a weight.
check("settle by weight", settle([0, 1, 2, 0], [3, 4, 2]).join("") === "1002", settle([0, 1, 2, 0], [3, 4, 2]).join(""));

// Syrup (b, weight 4) poured into a water flask sinks under the water.
{
  const b = decodeLevel(base(["aa", "bb"], [3, 4]));
  const r = applyMove(b, { kind: "pour", from: 1, to: 0 });
  check("syrup sinks under water", r.moved === 2 && enc(b).startsWith("bbaa") && r.landedAt === 0, enc(b));
}

// Oil (b, weight 2) floats on top of anything.
{
  const b = decodeLevel(base(["ac", "b"], [3, 2, 3]));
  const r = applyMove(b, { kind: "pour", from: 1, to: 0 });
  check("oil floats on top", r.moved === 1 && enc(b).startsWith("acb"), enc(b));
}

// Resting rule: same weight, different colour is refused; own colour or heavier is fine.
{
  const b = decodeLevel(base(["a", "b", "c"], [3, 3, 4]));
  check("water can't rest on another water", moveAmount(b, { kind: "pour", from: 1, to: 0 }) === 0);
  check("water can rest on syrup", moveAmount(b, { kind: "pour", from: 1, to: 2 }) === 1);
  const b2 = decodeLevel(base(["ca", "b"], [3, 3, 4]));
  // a (water) pours onto c (syrup)? Here b is water landing on 'a' (water, different) -> refused.
  check("landing spot is checked, not the top", moveAmount(b2, { kind: "pour", from: 1, to: 0 }) === 0);
}

// Sealing and corks.
{
  const def = base(["aaa", "a", "bbbb", "b"], [3, 4], [4, 4, 4, 4]);
  def.stacks = ["aaa", "a", "bbb", "b"];
  def.corks = [[2, 1]];
  const b = decodeLevel(def);
  check("corked flask can't be used", moveAmount(b, { kind: "pour", from: 3, to: 2 }) === 0);
  const r = applyMove(b, { kind: "pour", from: 1, to: 0 });
  check("sealing uncorks", r.sealed.includes(0) && r.uncorked.includes(2) && b.corks[2] === 0);
  applyMove(b, { kind: "pour", from: 3, to: 2 });
  check("level won", isWon(b));
}

// Power-ups.
{
  const b = decodeLevel(base(["abab", "baba"], [3, 3]));
  check("stuck without room", isStuck(b) && legalMoves(b).length === 0);
  addSpareFlask(b);
  check("spare flask unsticks", !isStuck(b));
  const p = decodeLevel(base(["abab", "baba", ""], [3, 3]));
  check("pipette draws a buried unit", pipette(p, 0, 0).ok && p.pipette[0] === 0 && enc(p).startsWith("bab"));
  check("pipette drop follows the rules", moveAmount(p, { kind: "drop", to: 2 }) === 1);
  const c = decodeLevel(base(["abab"], [3, 3]));
  centrifuge(c, 0);
  check("centrifuge groups colours", enc(c) === "aabb" || enc(c) === "bbaa", enc(c));
}

// Solver uses parking under / over.
{
  const def = base(["acab", "bcac", "cbab", "", ""], [3, 4, 2]);
  const s = solve(decodeLevel({ ...def, stacks: def.stacks.map((x) => encodeStacks([settle([...x].map((ch) => ch.charCodeAt(0) - 97), def.classes)])[0]) }), { weight: 1.2 });
  check("solver handles three weights", s.solved, `${s.moves.length} moves`);
}

// Generator across bands, including the intro levels.
for (const n of [21, 35, INTRO.oddCaps, INTRO.cork, INTRO.foam, 75, INTRO.mercury, 150, 250, 450]) {
  const t0 = performance.now();
  const lvl = generateLevel(n);
  const ms = Math.round(performance.now() - t0);
  const s = solve(decodeLevel(lvl.def), { weight: 1.4, maxNodes: 300000 });
  const cls = [...new Set(lvl.def.classes)].sort().join("");
  check(
    `level ${n} generated + solvable`,
    s.solved,
    `${ms}ms ${lvl.def.tag} k=${lvl.metrics.k} classes=${cls} flasks=${lvl.def.caps.length} caps=${[...new Set(lvl.def.caps)].join("/")} corks=${lvl.def.corks?.length ?? 0} par=${lvl.def.par} D=${lvl.def.d} dead=${lvl.metrics.deadEndRate.toFixed(2)}`,
  );
}
check("31 introduces odd flasks", generateLevel(INTRO.oddCaps).def.caps.some((c) => c !== 4));
check("45 introduces corks", (generateLevel(INTRO.cork).def.corks?.length ?? 0) > 0);
check("61 introduces foam", generateLevel(INTRO.foam).def.classes.includes(1));
check("91 introduces mercury", generateLevel(INTRO.mercury).def.classes.includes(5));
check("same seed -> same level", JSON.stringify(generateLevel(33).def) === JSON.stringify(generateLevel(33).def));
{
  const a = generateDaily("2026-11-12").def;
  check("daily is deterministic", JSON.stringify(a) === JSON.stringify(generateDaily("2026-11-12").def), `par=${a.par} D=${a.d}`);
}

console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
process.exit(failures ? 1 : 0);
