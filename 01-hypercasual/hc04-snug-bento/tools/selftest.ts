// Snug Bento self-test: rules on tiny boxes, the solver, the generator, the tutorial.
//   node tools/selftest.ts

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Cell, LevelDef, PieceDef } from "../src/logic/rules.ts";
import { TEMP_COLD, TEMP_HOT, canPlace, isFull, isWon, newBoard, placePiece, placedCells, removePiece, rotatePiece, squishPiece, violations } from "../src/logic/rules.ts";
import { solve } from "../src/logic/solver.ts";
import { generateDaily, generateLevel, INTRO } from "../src/logic/generator.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
let failed = 0;
function check(name: string, ok: boolean, extra = ""): void {
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${extra ? `  ${extra}` : ""}`);
  if (!ok) failed++;
}

const piece = (cells: Cell[], extra: Partial<PieceDef> = {}): PieceDef => ({ c: cells, t: 0, ...extra });
function level(w: number, h: number, mask: string, pieces: PieceDef[], walls: number[] = []): LevelDef {
  return { n: 0, w, h, mask, walls, pieces, sol: [], par: pieces.length, d: 0, tag: "normal" };
}
/** Play the stored solution; true if every piece fits and the box is won. */
function playsOut(def: LevelDef): boolean {
  const b = newBoard(def);
  return def.sol.every((pl, i) => placePiece(b, i, pl)) && isWon(b);
}

// 1. Placing, the box edge, outside cells, garnish and moving a piece.
{
  const def = level(3, 2, "..g...", [piece([[0, 0], [1, 0]]), piece([[0, 0], [1, 0], [2, 0]])]);
  const b = newBoard(def);
  check("piece fits inside the box", canPlace(b, 0, { s: 0, r: 0, x: 0, y: 0 }));
  check("not over garnish", !canPlace(b, 0, { s: 0, r: 0, x: 1, y: 0 }));
  check("not outside the box", !canPlace(b, 1, { s: 0, r: 0, x: 1, y: 1 }));
  placePiece(b, 0, { s: 0, r: 0, x: 0, y: 0 });
  check("not on top of another piece", !canPlace(b, 1, { s: 0, r: 1, x: 0, y: 0 }));
  placePiece(b, 1, { s: 0, r: 0, x: 0, y: 1 });
  check("box full and won", isFull(b) && isWon(b) && b.placements === 2);
  removePiece(b, 0);
  check("removing frees its cells", !isFull(b) && b.at[0] === null);
}

// 2. Rotation: a 1x3 bar fits a 1-wide column only when turned.
{
  const def = level(1, 3, "...", [piece([[0, 0], [1, 0], [2, 0]])]);
  const b = newBoard(def);
  check("unturned bar doesn't fit", !canPlace(b, 0, { s: 0, r: 0, x: 0, y: 0 }));
  check("turned bar fits", canPlace(b, 0, { s: 0, r: 1, x: 0, y: 0 }));
  rotatePiece(b, 0);
  check("tray rotation turns it", b.rot[0] === 1);
}

// 3. Dividers: a piece can't straddle one.
{
  const def = level(2, 1, "..", [piece([[0, 0], [1, 0]])], [0]);
  const b = newBoard(def);
  check("divider blocks a piece across it", !canPlace(b, 0, { s: 0, r: 0, x: 0, y: 0 }));
}

// 4. Soft foods: the second shape.
{
  const def = level(2, 2, "....", [piece([[0, 0], [1, 0], [2, 0]], { s: [[0, 0], [1, 0], [0, 1]] }), piece([[0, 0]])]);
  const b = newBoard(def);
  check("straight shape doesn't fit a 2x2", ![0, 1, 2, 3].some((r) => canPlace(b, 0, { s: 0, r, x: 0, y: 0 })));
  squishPiece(b, 0);
  check("squished shape fits", b.shape[0] === 1 && canPlace(b, 0, { s: 1, r: 0, x: 0, y: 0 }));
  check("solver uses the soft shape", solve(b).count > 0);
}

// 5. Hot and cold can't touch; sauce must touch its food.
{
  const hc = level(3, 1, "...", [piece([[0, 0]], { t: TEMP_HOT }), piece([[0, 0]], { t: TEMP_COLD }), piece([[0, 0]])]);
  const b = newBoard(hc);
  placePiece(b, 0, { s: 0, r: 0, x: 0, y: 0 });
  placePiece(b, 1, { s: 0, r: 0, x: 1, y: 0 });
  placePiece(b, 2, { s: 0, r: 0, x: 2, y: 0 });
  check("hot next to cold is flagged", violations(b).hotCold.length === 1 && !isWon(b));
  const r = solve(newBoard(hc), { maxSolutions: 10 });
  check("solver keeps them apart (2 ways)", r.count === 2, `count ${r.count}`);
  const sc = level(3, 1, "...", [piece([[0, 0], [1, 0]]), piece([[0, 0]], { sauce: 0 })]);
  const b2 = newBoard(sc);
  placePiece(b2, 0, { s: 0, r: 0, x: 1, y: 0 });
  placePiece(b2, 1, { s: 0, r: 0, x: 0, y: 0 });
  check("sauce next to its food is fine", isWon(b2));
}

// 6. Solver counts tilings once, and solves from a half-filled board.
{
  const def = level(2, 2, "....", [piece([[0, 0], [1, 0]]), piece([[0, 0], [1, 0]])]);
  const r = solve(newBoard(def), { maxSolutions: 10 });
  check("2x2 with two dominoes: 2 tilings", r.count === 2, `count ${r.count}`);
  const b = newBoard(def);
  placePiece(b, 0, { s: 0, r: 1, x: 0, y: 0 });
  check("completes from the current board", solve(b).count === 1);
  const stuck = newBoard(level(4, 1, "....", [piece([[0, 0], [1, 0]]), piece([[0, 0], [1, 0]])]));
  placePiece(stuck, 0, { s: 0, r: 0, x: 1, y: 0 });
  check("sees a dead end", solve(stuck).count === 0);
}

// 7. Generator: the stored solution plays out, it is deterministic, intros bring their twist.
{
  for (const n of [21, 45, 61, 91, 150, 320]) {
    const g = generateLevel(n);
    const placed = placedCells(g.def.pieces[0], g.def.sol[0]).length === g.def.pieces[0].c.length;
    check(`level ${n} solution plays out`, playsOut(g.def) && placed, `${g.def.w}x${g.def.h} pieces ${g.def.pieces.length} D ${g.def.d}`);
  }
  check("same seed -> same level", JSON.stringify(generateLevel(33).def) === JSON.stringify(generateLevel(33).def));
  check("12 brings garnish", generateLevel(INTRO.garnish).def.mask.includes("g"));
  check("15 brings a divider", generateLevel(INTRO.dividers).def.walls.length > 0);
  check("25 brings an odd box", generateLevel(INTRO.oddBox).def.mask.includes(" "));
  check("45 brings a soft food", generateLevel(INTRO.soft).def.pieces.some((p) => p.s));
  check("61 brings hot and cold", generateLevel(INTRO.hotCold).def.pieces.some((p) => p.t === TEMP_HOT));
  check("91 brings a sauce cup", generateLevel(INTRO.sauce).def.pieces.some((p) => p.sauce !== undefined));
  const d = generateDaily("2026-11-17");
  check("daily plays out", playsOut(d.def), `pieces ${d.def.pieces.length}`);
}

// 8. Tutorial levels (if present).
{
  const f = join(root, "src/data/levels-tutorial.json");
  if (existsSync(f)) {
    const tut: LevelDef[] = JSON.parse(readFileSync(f, "utf8"));
    tut.forEach((def, i) => check(`tutorial ${i + 1} plays out`, playsOut(def) && solve(newBoard(def)).count > 0, `${def.w}x${def.h} pieces ${def.pieces.length}`));
  }
}

console.log(failed ? `\n${failed} FAILED` : "\nall checks passed");
process.exit(failed ? 1 : 0);
