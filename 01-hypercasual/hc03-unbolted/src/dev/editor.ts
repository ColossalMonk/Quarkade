// Dev-only level editor (/editor.html on the dev server): edit a level as JSON, see it drawn by the
// real workshop view, check it with the sensible player and the solver, play it in the game
// (?def=...), and save it to levels-edit/ through the dev server.

import type { LevelDef } from "../logic/rules.ts";
import { BOX_SIZE, isCovered, newBoard } from "../logic/rules.ts";
import { solve } from "../logic/solver.ts";
import { deadEndRate, generateLevel, sensiblePlay } from "../logic/generator.ts";
import { Rng } from "../../../../forge/src/core/rng.ts";
import { WorkshopView } from "../view/workshop.ts";
import { getLevel } from "../game/levels.ts";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const out = $("out");
const json = $<HTMLTextAreaElement>("json");
const view = new WorkshopView($<HTMLCanvasElement>("board"));
view.setSafeArea(12, 12);

function fit(): void {
  const c = $<HTMLCanvasElement>("board");
  view.resize(c.clientWidth, c.clientHeight);
}

/** Compact JSON: one row per plate/bolt so it is easy to edit by hand. */
function pretty(def: LevelDef): string {
  const rows = (name: string, arr: unknown[]) => `  "${name}": [\n${arr.map((r) => `    ${JSON.stringify(r)}`).join(",\n")}\n  ]`;
  return `{\n  "n": ${def.n},\n${rows("plates", def.plates)},\n${rows("bolts", def.bolts)},\n  "pins": ${JSON.stringify(def.pins)},\n  "chains": ${JSON.stringify(def.chains)},\n  "boxes": ${JSON.stringify(def.boxes)},\n  "k": ${def.k},\n  "tray": ${def.tray},\n  "par": ${def.par},\n  "d": ${def.d},\n  "tag": "${def.tag}"\n}`;
}

function read(): LevelDef | null {
  try {
    const def = JSON.parse(json.value) as LevelDef;
    def.pins ??= [];
    def.chains ??= [];
    def.k = Math.max(def.k ?? 0, ...def.boxes.map((c) => c + 1), ...def.bolts.map((b) => b[2] + 1));
    return def;
  } catch (err) {
    out.textContent = `JSON error: ${String(err)}`;
    return null;
  }
}

function show(def: LevelDef): void {
  try {
    view.build(newBoard(def), (s) => s);
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
  const counts = new Map<number, number>();
  for (const b of def.bolts) counts.set(b[2], (counts.get(b[2]) ?? 0) + 1);
  const boxCounts = new Map<number, number>();
  for (const c of def.boxes) boxCounts.set(c, (boxCounts.get(c) ?? 0) + BOX_SIZE);
  for (const c of new Set([...counts.keys(), ...boxCounts.keys()])) {
    if ((counts.get(c) ?? 0) !== (boxCounts.get(c) ?? 0)) errs.push(`colour ${c}: ${counts.get(c) ?? 0} bolts but boxes take ${boxCounts.get(c) ?? 0}`);
  }
  def.bolts.forEach((b, i) => {
    if (!def.plates[b[0]]) errs.push(`bolt ${i}: no plate ${b[0]}`);
  });
  return errs;
}

let timer: ReturnType<typeof setTimeout> | null = null;
json.addEventListener("input", () => {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    const def = read();
    if (def) show(def);
  }, 250);
});

$("load").addEventListener("click", async () => {
  const n = Number($<HTMLInputElement>("n").value);
  const def = await getLevel(n);
  load(def, `Level ${n}: ${def.tag}, par ${def.par}, D ${def.d}`);
});

$("gen").addEventListener("click", () => {
  const n = Number($<HTMLInputElement>("n").value);
  const g = generateLevel(n);
  load(g.def, `Generated level ${n}: ${g.def.tag}, par ${g.def.par}, D ${g.def.d}`);
});

$("check").addEventListener("click", () => {
  const def = read();
  if (!def) return;
  const errs = validate(def);
  if (errs.length) return void (out.textContent = "Problems:\n" + errs.join("\n"));
  const b = newBoard(def);
  const covered = def.bolts.filter((_, i) => isCovered(b, i)).length;
  const human = sensiblePlay(def);
  const t0 = performance.now();
  const res = solve(newBoard(def), { maxNodes: 200000 });
  const ms = Math.round(performance.now() - t0);
  const dead = deadEndRate(def, new Rng(1), 40);
  out.textContent = [
    `bolts ${def.bolts.length} · boxes ${def.boxes.length} · colours ${def.k} · tray ${def.tray}`,
    `covered at start: ${covered} (${Math.round((covered / def.bolts.length) * 100)}%)`,
    `sensible player: ${human.won ? `wins with ${human.detours} detours (par)` : "jams"}`,
    `solver: ${res.solved ? `${res.detours} detours (${res.nodes} nodes, ${ms} ms)` : "not solved within the node limit"}`,
    `random play jams: ${Math.round(dead * 100)}%`,
    res.solved ? `\nsolution: ${res.moves.join(" ")}` : "",
  ].join("\n");
});

$("play").addEventListener("click", () => {
  const def = read();
  if (!def) return;
  const errs = validate(def);
  if (errs.length) return void (out.textContent = "Problems:\n" + errs.join("\n"));
  const human = sensiblePlay(def);
  if (human.won) def.par = human.detours;
  window.open(`/?def=${encodeURIComponent(btoa(JSON.stringify(def)))}`, "_blank");
});

$("save").addEventListener("click", async () => {
  const name = prompt("File name (without .json)", "level") ?? "";
  if (!/^[\w-]+$/.test(name)) return;
  const res = await fetch(`/__save?path=levels-edit/${name}.json`, { method: "POST", body: JSON.stringify({ text: json.value }) });
  out.textContent = await res.text();
});

window.addEventListener("resize", fit);
const loop = () => {
  view.render(1 / 60);
  requestAnimationFrame(loop);
};
requestAnimationFrame(loop);
void getLevel(4).then((d) => load(d, "Level 4 loaded. Edit the JSON or load another level."));
