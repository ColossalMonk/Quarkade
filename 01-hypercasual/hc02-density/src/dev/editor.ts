// Dev-only level editor (/editor.html on the dev server): edit flasks as text, see them drawn,
// settle by weight, solve and rate with the pack builder's code, play in the game (?def=...),
// and save to levels-edit/ through the dev server.

import type { LevelDef } from "../logic/rules.ts";
import { decodeLevel, encodeStacks, settle } from "../logic/rules.ts";
import { solve } from "../logic/solver.ts";
import { deadEndRate, difficultyScore, generateLevel } from "../logic/generator.ts";
import { Rng } from "../../../../forge/src/core/rng.ts";
import { LIQUIDS, MURKY_HEX, liquidsOfWeight } from "../data/liquids.ts";
import tutorial from "../data/levels-tutorial.json";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const out = $("out");

function readDef(): LevelDef {
  const lines = $<HTMLTextAreaElement>("flasks").value.split("\n").map((l) => l.trim()).filter(Boolean);
  const caps: number[] = [];
  const stacks: string[] = [];
  for (const line of lines) {
    const [cap, units = ""] = line.split(":");
    caps.push(Number(cap));
    stacks.push(units.trim());
  }
  const classes = $<HTMLInputElement>("classes").value.split(",").map((x) => Number(x.trim())).filter((x) => x >= 1 && x <= 5);
  const def: LevelDef = { n: 0, caps, stacks, classes, L: 4, par: 0, d: 0, tag: "normal" };
  const corks = $<HTMLInputElement>("corks").value.trim();
  if (corks) def.corks = corks.split(",").map((p) => p.split(":").map((x) => Number(x.trim())) as [number, number]);
  return def;
}

function writeDef(def: LevelDef): void {
  $<HTMLTextAreaElement>("flasks").value = def.caps.map((c, i) => `${c}:${def.stacks[i]}`).join("\n");
  $<HTMLInputElement>("classes").value = def.classes.join(",");
  $<HTMLInputElement>("corks").value = (def.corks ?? []).map(([f, c]) => `${f}:${c}`).join(", ");
  draw();
}

/** A stand-in liquid colour for each slot: the n-th liquid of its weight. */
function slotHex(slot: number, classes: number[]): string {
  const w = classes[slot] ?? 3;
  const sameWeightBefore = classes.slice(0, slot).filter((c) => c === w).length;
  const pool = liquidsOfWeight(w);
  return LIQUIDS[pool[sameWeightBefore % pool.length]].hex;
}

function validate(def: LevelDef): string[] {
  const errs: string[] = [];
  const counts = new Map<number, number>();
  def.stacks.forEach((s, i) => {
    if (s.length > def.caps[i]) errs.push(`flask ${i}: ${s.length} units but capacity ${def.caps[i]}`);
    const b = [...s].map((ch) => ch.toLowerCase().charCodeAt(0) - 97);
    for (const u of b) counts.set(u, (counts.get(u) ?? 0) + 1);
    if (b.join() !== settle(b, def.classes).join()) errs.push(`flask ${i}: not settled by weight (press Settle)`);
  });
  for (let s = 0; s < def.classes.length; s++) if ((counts.get(s) ?? 0) !== def.L) errs.push(`slot ${String.fromCharCode(97 + s)}: ${counts.get(s) ?? 0} units (needs ${def.L})`);
  for (const u of counts.keys()) if (u >= def.classes.length) errs.push(`slot ${String.fromCharCode(97 + u)} has no weight in the weights list`);
  for (const [f] of def.corks ?? []) if (f < 0 || f >= def.caps.length) errs.push(`cork on flask ${f}: no such flask`);
  return errs;
}

function draw(): void {
  const cv = $<HTMLCanvasElement>("view");
  const g = cv.getContext("2d")!;
  g.clearRect(0, 0, cv.width, cv.height);
  const def = readDef();
  const n = def.caps.length;
  const cols = Math.min(n, 8);
  const rows = Math.max(1, Math.ceil(n / cols));
  const cw = cv.width / cols;
  const rh = cv.height / rows;
  const unitH = Math.min(70, (rh - 90) / 6);
  def.stacks.forEach((s, i) => {
    const cx = (i % cols) * cw + cw / 2;
    const base = Math.floor(i / cols) * rh + rh - 46;
    const cap = def.caps[i];
    g.strokeStyle = "rgba(255,255,255,.9)";
    g.lineWidth = 4;
    g.beginPath();
    g.roundRect(cx - 46, base - cap * unitH - 30, 92, cap * unitH + 36, 26);
    g.stroke();
    [...s].forEach((ch, j) => {
      const slot = ch.toLowerCase().charCodeAt(0) - 97;
      const murky = ch !== ch.toLowerCase();
      g.fillStyle = murky ? MURKY_HEX : slotHex(slot, def.classes);
      g.fillRect(cx - 38, base - (j + 1) * unitH, 76, unitH - 2);
      g.fillStyle = "rgba(0,0,0,.6)";
      g.font = "bold 18px system-ui";
      g.textAlign = "center";
      g.fillText(`${murky ? "?" : ch}${def.classes[slot] ?? "?"}`, cx, base - j * unitH - unitH / 2 + 6);
    });
    g.fillStyle = "#2c3d48";
    g.font = "bold 16px system-ui";
    g.textAlign = "center";
    const cork = def.corks?.find(([f]) => f === i);
    g.fillText(`${i} · cap ${cap}${cork ? ` · 🍾${cork[1]}` : ""}`, cx, base + 30);
  });
}

for (const id of ["flasks", "classes", "corks"]) $(id).addEventListener("input", draw);

$("settle").addEventListener("click", () => {
  const def = readDef();
  def.stacks = def.stacks.map((s) => {
    const units = [...s].map((ch) => ({ slot: ch.toLowerCase().charCodeAt(0) - 97, murky: ch !== ch.toLowerCase() }));
    const order = settle(units.map((_, i) => i), units.map((u) => def.classes[u.slot] ?? 3));
    return order.map((i) => (units[i].murky ? String.fromCharCode(65 + units[i].slot) : String.fromCharCode(97 + units[i].slot))).join("");
  });
  writeDef(def);
  out.textContent = "Settled by weight.";
});

$("solve").addEventListener("click", () => {
  const def = readDef();
  const errs = validate(def);
  if (errs.length) return void (out.textContent = "Problems:\n" + errs.join("\n"));
  const b = decodeLevel(def);
  const t0 = performance.now();
  const res = solve({ stacks: b.stacks, caps: b.caps, classes: b.classes, L: b.L, corks: b.corks }, { weight: 1.2, maxNodes: 400000 });
  const ms = Math.round(performance.now() - t0);
  if (!res.solved) return void (out.textContent = `Not solved within the node limit (${res.nodes} nodes, ${ms} ms). Probably unsolvable.`);
  const murky = b.hidden.flat().filter(Boolean).length;
  const par = res.moves.length + Math.ceil(murky / 3);
  const perClass = new Map<number, number>();
  for (const c of def.classes) perClass.set(c, (perClass.get(c) ?? 0) + 1);
  const dead = deadEndRate(def, new Rng(1), 60);
  const d = difficultyScore({ k: def.classes.length, empties: b.stacks.filter((s) => !s.length).length, crowding: Math.max(...perClass.values()), murkyShare: murky / (def.classes.length * 4), specials: 1.5 * (def.corks?.length ?? 0), deadEndRate: dead, par });
  out.textContent = `Solvable in ${res.moves.length} pours (${res.nodes} nodes, ${ms} ms)\npar: ${par}\ndead-end rate: ${dead.toFixed(2)}\nD (approx.): ${d.toFixed(2)}\n\nsolution:\n${res.moves.map((m) => (m.kind === "pour" ? `${m.from}→${m.to}` : `pipette→${m.to}`)).join("  ")}`;
});

$("load").addEventListener("click", async () => {
  const n = Number($<HTMLInputElement>("loadN").value);
  if (n <= 20) return writeDef((tutorial as LevelDef[])[n - 1]);
  const pi = Math.floor((n - 21) / 500);
  const pack = await fetch(`/packs/pack-${pi}.json`).then((r) => r.json());
  const r = pack.levels[n - pack.from];
  writeDef({ n, caps: r[0], stacks: r[1], classes: r[2], par: r[3], d: r[4], tag: r[5], L: 4, corks: r[6] });
  out.textContent = `Level ${n}: ${r[5]}, par ${r[3]}, D ${r[4]}`;
});

$("gen").addEventListener("click", () => {
  const n = Number($<HTMLInputElement>("loadN").value);
  const lvl = generateLevel(n);
  writeDef(lvl.def);
  out.textContent = `Generated level ${n}: ${lvl.def.tag}, par ${lvl.def.par}, D ${lvl.def.d}`;
});

$("play").addEventListener("click", () => {
  const def = readDef();
  const errs = validate(def);
  if (errs.length) return void (out.textContent = "Problems:\n" + errs.join("\n"));
  window.open(`/?def=${encodeURIComponent(btoa(JSON.stringify(def)))}`, "_blank");
});

$("save").addEventListener("click", async () => {
  const name = prompt("File name (without .json)", "level") ?? "";
  if (!/^[\w-]+$/.test(name)) return;
  const res = await fetch(`/__save?path=levels-edit/${name}.json`, { method: "POST", body: JSON.stringify({ text: JSON.stringify(readDef(), null, 1) }) });
  out.textContent = await res.text();
});

// Keep encodeStacks referenced for future "export" features.
void encodeStacks;
draw();
