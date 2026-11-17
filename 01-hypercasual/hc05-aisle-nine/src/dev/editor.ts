// Dev-only level editor (/editor.html on the dev server): edit a level as JSON, see it on the real
// stand view, step through the stored solution, check and rate it with the rules and the solver,
// play it in the game (?def=...), and save it to levels-edit/ through the dev server.

import type { Board, GameEvent, LevelDef } from "../logic/rules.ts";
import { EMPTY, SPOTS, applyMove, cloneBoard, isWon, kindCounts, newBoard } from "../logic/rules.ts";
import { beamSolve, jamRate } from "../logic/solver.ts";
import { generateLevel } from "../logic/generator.ts";
import { StandView } from "../view/stand.ts";
import { getLevel } from "../game/levels.ts";
import { DisplayProgress } from "../game/displays.ts";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const out = $("out");
const json = $<HTMLTextAreaElement>("json");
const view = new StandView($<HTMLCanvasElement>("board"));
view.setSafeArea(40, 30);
let board: Board | null = null;
let step = 0;

function fit(): void {
  const c = $<HTMLCanvasElement>("board");
  view.resize(c.clientWidth, c.clientHeight);
}

function pretty(def: LevelDef): string {
  const rows = (name: string, arr: unknown[]) => `  "${name}": [\n${arr.map((r) => `    ${JSON.stringify(r)}`).join(",\n")}\n  ]`;
  const { shelves, sol, ...rest } = def;
  const head = Object.entries(rest).map(([k, v]) => `  "${k}": ${JSON.stringify(v)}`);
  return `{\n${head.join(",\n")},\n${rows("shelves", shelves)},\n${rows("sol", sol)}\n}`;
}

function read(): LevelDef | null {
  try {
    const def = JSON.parse(json.value) as LevelDef;
    def.sol ??= [];
    return def;
  } catch (err) {
    out.textContent = `JSON error: ${String(err)}`;
    return null;
  }
}

function status(): void {
  if (!board) return;
  $("status").textContent = `move ${step}/${board.def.sol.length} · sold ${board.sold} · angle ${board.angle}${isWon(board) ? " · WON" : ""}`;
}

function show(def: LevelDef): void {
  try {
    board = newBoard(def);
    step = 0;
    view.build(board, new DisplayProgress(0).mapGoods(kindCounts(board), def.n));
    fit();
    status();
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
  const S = def.units * def.rows;
  if (def.shelves.length !== S) errs.push(`shelves: ${def.shelves.length}, needs units·rows = ${S}`);
  if (def.reach < 1 || def.reach > def.units) errs.push(`reach must be 1..units`);
  def.shelves.forEach((sh, s) => {
    if (sh.f.length !== SPOTS) errs.push(`shelf ${s}: front row needs 3 entries (-1 for empty)`);
    sh.b?.forEach((l, i) => l.length !== SPOTS && errs.push(`shelf ${s}: back layer ${i} needs 3 entries`));
    if (sh.b?.length && sh.f.every((k) => k === EMPTY)) errs.push(`shelf ${s}: empty front row with back stock behind it`);
    if (sh.f.every((k) => k === sh.f[0] && k !== EMPTY)) errs.push(`shelf ${s}: starts as a triple`);
    for (const k of [...sh.f, ...(sh.b ?? []).flat()]) if (k >= def.kinds) errs.push(`shelf ${s}: kind ${k} >= kinds`);
  });
  const counts = kindCounts(newBoard(def));
  for (const k of def.cust ?? []) counts[k]--;
  counts.forEach((c, k) => c % SPOTS !== 0 && errs.push(`kind ${k}: ${c} goods (after customers), not a multiple of 3`));
  if (def.shelves.some((s) => s.cab) && def.key === undefined) errs.push(`cabinet without a key kind`);
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
  load(def, `Level ${n}: ${def.tag}, ${def.units}×${def.rows} stand, reach ${def.reach}, par ${def.par}, D ${def.d}`);
});

$("gen").addEventListener("click", () => {
  const n = Number($<HTMLInputElement>("n").value);
  const g = generateLevel(n);
  load(g.def, `Generated level ${n}: ${g.def.tag}, ${g.def.units}×${g.def.rows} stand, ${g.metrics.goods} goods, par ${g.def.par}, D ${g.def.d}`);
});

$("step").addEventListener("click", async () => {
  if (!board || step >= board.def.sol.length) return;
  const ev: GameEvent[] = [];
  if (!applyMove(board, board.def.sol[step], ev)) {
    out.textContent = `Stored move ${step} is not legal here: ${JSON.stringify(board.def.sol[step])}`;
    return;
  }
  step++;
  await view.play(ev, board);
  status();
});

$("reset").addEventListener("click", () => {
  const def = read();
  if (def) show(def);
});

$("check").addEventListener("click", () => {
  const def = read();
  if (!def) return;
  const errs = validate(def);
  if (errs.length) return void (out.textContent = "Problems:\n" + errs.join("\n"));
  const b = newBoard(def);
  const solOk = def.sol.length > 0 && def.sol.every((m) => applyMove(b, m)) && isWon(b);
  const t0 = performance.now();
  const beam = beamSolve(newBoard(def), { width: 80 });
  const ms = Math.round(performance.now() - t0);
  let seed = 7;
  const jam = jamRate(cloneBoard(newBoard(def)), 8, () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646);
  const goods = kindCounts(newBoard(def)).reduce((a, c) => a + c, 0);
  out.textContent = [
    `${def.units}×${def.rows} stand, reach ${def.reach}${def.turns ? `, turns ${def.dir > 0 ? "right" : "left"}` : ", still"} · ${def.kinds} kinds, ${goods} goods`,
    `stored solution: ${solOk ? `wins in ${def.sol.length} moves ✓` : def.sol.length ? "does NOT win" : "none"}`,
    `beam search: ${beam ? `${beam.length} moves` : "no solution found"} (${ms} ms) · par would be ${Math.min(...[solOk ? def.sol.length : Infinity, beam?.length ?? Infinity])}`,
    `sensible play jams: ${Math.round(jam * 100)}%`,
    `twists: ${[def.shelves.some((s) => s.box) ? "boxes" : "", def.shelves.some((s) => s.frz) ? "freezer" : "", def.key !== undefined ? "cabinet" : "", def.cart ? `cart (${def.cart.length})` : "", def.cust ? `customers (${def.cust.length})` : "", def.hide ? "hidden stock" : ""].filter(Boolean).join(", ") || "none"}`,
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
void getLevel(61).then((d) => load(d, "Level 61 loaded. Edit the JSON, or load another level."));
