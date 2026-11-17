// Dev-only level editor (/editor.html on the dev server): edit a level as JSON, see it drawn by the
// real bento view (tray, or the stored solution), check it with the solver, play it in the game
// (?def=...), and save it to levels-edit/ through the dev server.

import type { LevelDef } from "../logic/rules.ts";
import { isWon, newBoard, placePiece } from "../logic/rules.ts";
import { solve } from "../logic/solver.ts";
import { generateLevel } from "../logic/generator.ts";
import { BentoView } from "../view/bento.ts";
import { getLevel } from "../game/levels.ts";
import { RecipeProgress } from "../game/recipe.ts";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const out = $("out");
const json = $<HTMLTextAreaElement>("json");
const view = new BentoView($<HTMLCanvasElement>("board"));
view.setSafeArea(12, 12);
let showSolution = false;

function fit(): void {
  const c = $<HTMLCanvasElement>("board");
  view.resize(c.clientWidth, c.clientHeight);
}

function pretty(def: LevelDef): string {
  const rows = (name: string, arr: unknown[]) => `  "${name}": [\n${arr.map((r) => `    ${JSON.stringify(r)}`).join(",\n")}\n  ]`;
  const mask = Array.from({ length: def.h }, (_, y) => def.mask.slice(y * def.w, (y + 1) * def.w));
  return `{\n  "n": ${def.n},\n  "w": ${def.w},\n  "h": ${def.h},\n  "mask": ${JSON.stringify(def.mask)},\n  "_rows": ${JSON.stringify(mask)},\n  "walls": ${JSON.stringify(def.walls)},\n${rows("pieces", def.pieces)},\n${rows("sol", def.sol)},\n  "par": ${def.par},\n  "d": ${def.d},\n  "tag": "${def.tag}"\n}`;
}

function read(): LevelDef | null {
  try {
    const raw = JSON.parse(json.value) as LevelDef & { _rows?: string[] };
    // Rows (easier to edit) win over the flat mask when present.
    if (raw._rows) raw.mask = raw._rows.join("");
    delete raw._rows;
    raw.walls ??= [];
    raw.par = raw.pieces.length;
    return raw;
  } catch (err) {
    out.textContent = `JSON error: ${String(err)}`;
    return null;
  }
}

function show(def: LevelDef): void {
  try {
    const b = newBoard(def);
    if (showSolution) def.sol.forEach((pl, i) => placePiece(b, i, pl, false));
    view.build(b, new RecipeProgress(0).mapFoods(b.pieces, def.n));
    fit();
  } catch (err) {
    out.textContent = `Can't draw: ${String(err)}`;
  }
}

function load(def: LevelDef, note = ""): void {
  json.value = pretty(def);
  show(def);
  out.textContent = note;
}

function validate(def: LevelDef): string[] {
  const errs: string[] = [];
  if (def.mask.length !== def.w * def.h) errs.push(`mask has ${def.mask.length} chars, needs w·h = ${def.w * def.h}`);
  const free = [...def.mask].filter((c) => c === ".").length;
  const cells = def.pieces.reduce((a, p) => a + p.c.length, 0);
  if (free !== cells) errs.push(`box has ${free} free cells but the pieces cover ${cells}`);
  def.pieces.forEach((p, i) => {
    if (p.c.length > 6) errs.push(`piece ${i}: more than 6 cells`);
    if (p.s && p.s.length !== p.c.length) errs.push(`piece ${i}: soft shape has a different size`);
    if (p.sauce !== undefined && (p.c.length !== 1 || !def.pieces[p.sauce])) errs.push(`piece ${i}: a sauce cup must be one cell and name a real piece`);
  });
  return errs;
}

let timer: ReturnType<typeof setTimeout> | null = null;
json.addEventListener("input", () => {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    const def = read();
    if (def) show(def);
  }, 300);
});

$("load").addEventListener("click", async () => {
  const n = Number($<HTMLInputElement>("n").value);
  const def = await getLevel(n);
  load(def, `Level ${n}: ${def.tag}, ${def.w}×${def.h}, ${def.pieces.length} pieces, D ${def.d}`);
});

$("gen").addEventListener("click", () => {
  const n = Number($<HTMLInputElement>("n").value);
  const g = generateLevel(n);
  load(g.def, `Generated level ${n}: ${g.def.tag}, ${g.def.w}×${g.def.h}, ${g.def.pieces.length} pieces, D ${g.def.d}`);
});

$("show").addEventListener("click", () => {
  showSolution = !showSolution;
  $("show").textContent = showSolution ? "Show tray" : "Show solution";
  const def = read();
  if (def) show(def);
});

$("check").addEventListener("click", () => {
  const def = read();
  if (!def) return;
  const errs = validate(def);
  if (errs.length) return void (out.textContent = "Problems:\n" + errs.join("\n"));
  const b = newBoard(def);
  const solOk = def.sol.length === def.pieces.length && def.sol.every((pl, i) => placePiece(b, i, pl)) && isWon(b);
  const t0 = performance.now();
  const res = solve(newBoard(def), { maxSolutions: 200, maxNodes: 300000 });
  const ms = Math.round(performance.now() - t0);
  out.textContent = [
    `${def.w}×${def.h} box · ${def.pieces.length} pieces (par ${def.pieces.length})`,
    `stored solution: ${solOk ? "plays out ✓" : "does NOT play out"}`,
    `solver: ${res.count ? `${res.count}${res.count >= 200 ? "+" : ""} solution(s)` : "no solution"} (${res.nodes} nodes, ${ms} ms${res.exhausted ? ", stopped early" : ""})`,
    `twists: ${[def.mask.includes("g") ? "garnish" : "", def.walls.length ? "dividers" : "", def.mask.includes(" ") ? "odd box" : "", def.pieces.some((p) => p.s) ? "soft" : "", def.pieces.some((p) => p.t) ? "hot/cold" : "", def.pieces.some((p) => p.sauce !== undefined) ? "sauce" : ""].filter(Boolean).join(", ") || "none"}`,
  ].join("\n");
});

$("play").addEventListener("click", () => {
  const def = read();
  if (!def) return;
  const errs = validate(def);
  if (errs.length) return void (out.textContent = "Problems:\n" + errs.join("\n"));
  window.open(`/?def=${encodeURIComponent(btoa(JSON.stringify(def)))}`, "_blank");
});

$("save").addEventListener("click", async () => {
  const name = prompt("File name (without .json)", "level") ?? "";
  if (!/^[\w-]+$/.test(name)) return;
  const def = read();
  if (!def) return;
  const res = await fetch(`/__save?path=levels-edit/${name}.json`, { method: "POST", body: JSON.stringify({ text: JSON.stringify(def, null, 1) }) });
  out.textContent = await res.text();
});

window.addEventListener("resize", fit);
const loop = () => {
  view.render(1 / 60);
  requestAnimationFrame(loop);
};
requestAnimationFrame(loop);
void getLevel(12).then((d) => load(d, "Level 12 loaded. Edit the JSON, or load another level."));
