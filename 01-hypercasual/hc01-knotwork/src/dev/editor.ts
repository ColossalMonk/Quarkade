// Dev-only level editor (open /editor.html on the dev server). Edit needles as text, see them
// drawn, solve and rate them with the same code as the pack builder, play them in the game
// (?def=...), and save them to levels-edit/ through the dev server.

import type { LevelDef } from "../logic/rules.ts";
import { decodeLevel, coloursOf, isTied, parseStack } from "../logic/rules.ts";
import { solve } from "../logic/solver.ts";
import { deadEndRate, difficultyScore, generateLevel } from "../logic/generator.ts";
import { Rng } from "../../../../forge/src/core/rng.ts";
import { YARNS, HIDDEN_HEX } from "../data/palette.ts";
import tutorial from "../data/levels-tutorial.json";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const out = $("out");

function readDef(): LevelDef {
  const lines = $<HTMLTextAreaElement>("needles").value.split("\n").map((l) => l.trim()).filter(Boolean);
  const caps: number[] = [];
  const stacks: string[] = [];
  for (const line of lines) {
    const [cap, loops = ""] = line.split(":");
    caps.push(Number(cap));
    stacks.push(loops.trim());
  }
  const def: LevelDef = { n: 0, caps, stacks, L: 4, par: 0, d: 0, tag: "normal" };
  const m = $<HTMLInputElement>("moth").value.trim();
  if (m) {
    const [needle, count] = m.split(",").map(Number);
    def.moth = [needle, count || 6];
  }
  return def;
}

function writeDef(def: LevelDef): void {
  $<HTMLTextAreaElement>("needles").value = def.caps.map((c, i) => `${c}:${def.stacks[i]}`).join("\n");
  $<HTMLInputElement>("moth").value = def.moth ? def.moth.join(",") : "";
  draw();
}

function validate(def: LevelDef): string[] {
  const errs: string[] = [];
  const count = new Map<number, number>();
  def.stacks.forEach((s, i) => {
    const p = parseStack(s);
    if (p.loops.length > def.caps[i]) errs.push(`needle ${i}: ${p.loops.length} loops but capacity ${def.caps[i]}`);
    for (const v of p.loops) {
      const cs = coloursOf(v);
      // A twisted loop counts half towards each of its colours.
      for (const c of cs) count.set(c, (count.get(c) ?? 0) + 1 / cs.length);
    }
  });
  for (const [c, n] of count) if (Math.abs(n - def.L) > 1e-9) errs.push(`colour ${String.fromCharCode(97 + c)}: ${n} loops (needs ${def.L})`);
  if (def.moth && (def.moth[0] < 0 || def.moth[0] >= def.caps.length)) errs.push("moth needle out of range");
  return errs;
}

function draw(): void {
  const cv = $<HTMLCanvasElement>("view");
  const g = cv.getContext("2d")!;
  g.clearRect(0, 0, cv.width, cv.height);
  let def: LevelDef;
  try {
    def = readDef();
  } catch {
    return;
  }
  const n = def.caps.length;
  const cols = Math.min(n, 7);
  const rows = Math.ceil(n / cols);
  const cw = cv.width / cols;
  const rh = cv.height / rows;
  def.stacks.forEach((s, i) => {
    const p = parseStack(s);
    const cx = (i % cols) * cw + cw / 2;
    const base = Math.floor(i / cols) * rh + rh - 40;
    g.fillStyle = "#e8c89a";
    g.fillRect(cx - 4, base - (def.caps[i] + 0.6) * 44, 8, (def.caps[i] + 0.6) * 44);
    g.fillStyle = "#fff";
    g.font = "bold 18px system-ui";
    g.textAlign = "center";
    g.fillText(`${i} (cap ${def.caps[i]})`, cx, base + 28);
    if (def.moth && def.moth[0] === i) g.fillText(`🦋 ${def.moth[1]}`, cx, base - (def.caps[i] + 1.2) * 44);
    p.loops.forEach((v, j) => {
      const y = base - j * 44 - 22;
      const cs = coloursOf(v);
      g.fillStyle = p.hidden[j] ? HIDDEN_HEX : YARNS[cs[0] % 12].hex;
      g.beginPath();
      g.ellipse(cx, y, 52, 18, 0, 0, Math.PI * 2);
      g.fill();
      if (cs.length > 1) {
        g.fillStyle = YARNS[cs[1] % 12].hex;
        g.beginPath();
        g.ellipse(cx, y, 52, 18, 0, 0, Math.PI);
        g.fill();
      }
      g.fillStyle = "rgba(0,0,0,.55)";
      g.fillText(p.hidden[j] ? "?" : cs.map((c) => String.fromCharCode(97 + c)).join("/"), cx, y + 6);
      if (isTied(v)) {
        g.fillStyle = "#3b2a1e";
        g.beginPath();
        g.arc(cx + 50, y - 22, 9, 0, Math.PI * 2);
        g.fill();
      }
    });
  });
}

$("needles").addEventListener("input", draw);
$("moth").addEventListener("input", draw);

$("solve").addEventListener("click", () => {
  const def = readDef();
  const errs = validate(def);
  if (errs.length) {
    out.textContent = "Problems:\n" + errs.join("\n");
    return;
  }
  const t0 = performance.now();
  const res = solve(decodeLevel(def), { weight: 1.0, maxNodes: 400000 });
  const ms = Math.round(performance.now() - t0);
  if (!res.solved) {
    out.textContent = `Not solved within the node limit (${res.nodes} nodes, ${ms} ms). Probably unsolvable.`;
    return;
  }
  const board = decodeLevel(def);
  const hidden = board.hidden.flat().filter(Boolean).length;
  const empties = board.stacks.filter((s) => !s.length).length;
  const dead = deadEndRate({ ...def, moth: undefined }, new Rng(1));
  const par = res.moves.length + Math.ceil(hidden / 3);
  const d = difficultyScore({ k: board.k, empties, burial: 0.5, hiddenShare: hidden / (board.k * 4), deadEndRate: dead, par, specials: 0 });
  out.textContent = `Solvable in ${res.moves.length} moves (${res.nodes} nodes, ${ms} ms)\npar: ${par}\ndead-end rate: ${dead.toFixed(2)}\nD (approx.): ${d.toFixed(2)}\n\nsolution:\n${res.moves
    .map((m) => (m.kind === "move" ? `${m.from}→${m.to}` : `basket${m.index}→${m.to}`))
    .join("  ")}`;
});

$("load").addEventListener("click", async () => {
  const n = Number($<HTMLInputElement>("loadN").value);
  if (n <= 20) return writeDef((tutorial as LevelDef[])[n - 1]);
  const pi = Math.floor((n - 21) / 500);
  const pack = await fetch(`/packs/pack-${pi}.json`).then((r) => r.json());
  const row = pack.levels[n - pack.from];
  writeDef({ n, caps: row[0], stacks: row[1], par: row[2], d: row[3], tag: row[4], L: 4, moth: row[5] });
  out.textContent = `Level ${n}: tag ${row[4]}, par ${row[2]}, D ${row[3]}`;
});

$("gen").addEventListener("click", () => {
  const n = Number($<HTMLInputElement>("loadN").value);
  const lvl = generateLevel(n);
  writeDef(lvl.def);
  out.textContent = `Generated level ${n}: tag ${lvl.def.tag}, par ${lvl.def.par}, D ${lvl.def.d}`;
});

$("play").addEventListener("click", () => {
  const def = readDef();
  const errs = validate(def);
  if (errs.length) {
    out.textContent = "Problems:\n" + errs.join("\n");
    return;
  }
  window.open(`/?def=${encodeURIComponent(btoa(JSON.stringify(def)))}`, "_blank");
});

$("save").addEventListener("click", async () => {
  const name = prompt("File name (without .json)", "level") ?? "";
  if (!/^[\w-]+$/.test(name)) return;
  const res = await fetch(`/__save?path=levels-edit/${name}.json`, { method: "POST", body: JSON.stringify({ text: JSON.stringify(readDef(), null, 1) }) });
  out.textContent = await res.text();
});

draw();
