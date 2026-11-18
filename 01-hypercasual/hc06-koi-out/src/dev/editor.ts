// Dev-only level editor (/editor.html on the dev server): edit a pond as JSON, see it drawn by the
// real pond view, step through the stored escape order, check and rate it with the rules and the
// solver, play it in the game (?def=...), and save it to levels-edit/ through the dev server.

import type { Board, LevelDef } from "../logic/rules.ts";
import { freeKoi, isWon, newBoard, step, tapKoi, trace } from "../logic/rules.ts";
import { solveOrder } from "../logic/solver.ts";
import { dirFrom, generateLevel } from "../logic/generator.ts";
import { PondView } from "../view/pond.ts";
import { getLevel } from "../game/levels.ts";
import { JournalProgress } from "../game/journal.ts";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const out = $("out");
const json = $<HTMLTextAreaElement>("json");
const view = new PondView($<HTMLCanvasElement>("board"));
view.setSafeArea(40, 20);
let board: Board | null = null;
let stepAt = 0;

function fit(): void {
  const c = $<HTMLCanvasElement>("board");
  view.resize(c.clientWidth, c.clientHeight);
}

function pretty(def: LevelDef): string {
  const { koi, ...rest } = def;
  const head = Object.entries(rest).map(([k, v]) => `  "${k}": ${JSON.stringify(v)}`);
  return `{\n${head.join(",\n")},\n  "koi": [\n${koi.map((k) => `    ${JSON.stringify(k)}`).join(",\n")}\n  ]\n}`;
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
  $("status").textContent = `step ${stepAt}/${board.def.sol.length} · ${board.out.filter((o) => !o).length} koi left · hearts ${board.hearts}${isWon(board) ? " · CLEAR" : ""}`;
}

function show(def: LevelDef): void {
  try {
    board = newBoard(def);
    stepAt = 0;
    view.build(board, new JournalProgress(0).mapVarieties(def.koi.length, def.n));
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
  const N = def.w * def.h;
  const used = new Map<number, number>();
  const blocked = new Set([...(def.pads ?? []), ...(def.frogs ?? []).map(([c]) => c), ...(def.currents ?? []).map(([c]) => c)]);
  def.koi.forEach((k, i) => {
    if (!k.c.length) errs.push(`koi ${i}: no cells`);
    k.c.forEach((c, j) => {
      if (c < 0 || c >= N) errs.push(`koi ${i}: cell ${c} is off the pond`);
      if (used.has(c)) errs.push(`koi ${i}: cell ${c} is also koi ${used.get(c)}`);
      if (blocked.has(c)) errs.push(`koi ${i}: cell ${c} has a pad, frog or current`);
      used.set(c, i);
      if (j > 0 && ![0, 1, 2, 3].some((d) => step(def, k.c[j - 1], d as 0) === c)) errs.push(`koi ${i}: cells ${k.c[j - 1]} and ${c} aren't next to each other`);
    });
    if (k.c.length > 1 && dirFrom(def, k.c[1], k.c[0]) !== k.d) errs.push(`koi ${i}: d should be ${dirFrom(def, k.c[1], k.c[0])} (away from its body)`);
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
  load(def, `Level ${n}: ${def.tag}, ${def.w}×${def.h} pond, ${def.koi.length} koi, D ${def.d}`);
});

$("gen").addEventListener("click", () => {
  const n = Number($<HTMLInputElement>("n").value);
  const g = generateLevel(n);
  load(g.def, `Generated level ${n}: ${g.def.w}×${g.def.h}, ${g.metrics.koi} koi, ${g.metrics.freeAtStart} free at the start, depth ${g.metrics.depth}, D ${g.def.d}`);
});

$("step").addEventListener("click", async () => {
  if (!board || stepAt >= board.def.sol.length) return;
  const i = board.def.sol[stepAt];
  const res = tapKoi(board, i);
  stepAt++;
  if (!res) return;
  if (res.ok) await view.swimOut(i, res);
  else {
    out.textContent = `Stored step ${stepAt}: koi ${i} is blocked here.`;
    await view.bump(i, res);
  }
  view.reaim(board);
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
  const solOk = def.sol.length === def.koi.length && def.sol.every((i) => tapKoi(b, i)?.ok) && isWon(b);
  const t0 = performance.now();
  const res = solveOrder(newBoard(def), 50000);
  const ms = Math.round(performance.now() - t0);
  const start = newBoard(def);
  const free = freeKoi(start);
  const look = def.koi.filter((_, i) => !free.includes(i) && trace(start, i).ray.length >= 2).length;
  out.textContent = [
    `${def.w}×${def.h} pond · ${def.koi.length} koi (${def.koi.filter((k) => k.c.length >= 3).length} long)`,
    `stored order: ${solOk ? "frees every koi ✓" : def.sol.length ? "does NOT work" : "none"}`,
    `solver: ${res.order ? "found an order" : "no order found"} (${res.nodes} nodes, ${ms} ms)`,
    `free at the start: ${free.length} · look-alikes: ${look}`,
    `twists: ${[def.pads?.length ? "lily pads" : "", def.reeds?.length ? "reeds" : "", def.whirls?.length ? "whirlpools" : "", def.frogs?.length ? "frogs" : "", def.currents?.length ? "currents" : ""].filter(Boolean).join(", ") || "none"}`,
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
  const name = prompt("File name (without .json)", "pond") ?? "";
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
void getLevel(45).then((d) => load(d, "Level 45 loaded. Edit the JSON, or load another level."));
