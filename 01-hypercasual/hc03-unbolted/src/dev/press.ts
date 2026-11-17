// Dev-only press mode (?press=1): renders store art and portal thumbnails to PNG files in
// hc03-unbolted/press/ through the dev server's /__save endpoint. Never part of a production build.
//
// Every shot shows the same staged moment: a busy pegboard with one plate caught mid-swing, the
// screwdriver on a bolt, two toolboxes filling up, and a gadget blueprint half done.

import { WorkshopView } from "../view/workshop.ts";
import { cloneBoard, isFree, legalMoves, newBoard, tap } from "../logic/rules.ts";
import type { Board } from "../logic/rules.ts";
import { generateLevel } from "../logic/generator.ts";
import { drawGadgetAt } from "../view/draw.ts";
import { GADGETS } from "../data/gadgets.ts";
import { BOLT_COLOURS } from "../data/palette.ts";

interface Shot {
  name: string;
  w: number;
  h: number;
  title: boolean;
  symbols?: boolean;
  board?: { kind: number; hex: string };
  finish?: number;
}

/** Sizes cover the common portal and store ratios (16:9, 9:16, 2:3, 1:1, 4:3). */
export const SHOTS: Shot[] = [
  { name: "cover-1920x1080", w: 1920, h: 1080, title: true },
  { name: "cover-1920x1080-notext", w: 1920, h: 1080, title: false },
  { name: "cover-1280x720", w: 1280, h: 720, title: true },
  { name: "portrait-1080x1920", w: 1080, h: 1920, title: true },
  { name: "portrait-800x1200", w: 800, h: 1200, title: true },
  { name: "square-1024", w: 1024, h: 1024, title: true },
  { name: "square-512", w: 512, h: 512, title: true },
  { name: "landscape-512x384", w: 512, h: 384, title: true },
  { name: "icon-1024-notext", w: 1024, h: 1024, title: false },
  { name: "screenshot-1080x1920", w: 1080, h: 1920, title: false },
  { name: "screenshot-colorblind-1080x1920", w: 1080, h: 1920, title: false, symbols: true },
  { name: "screenshot-night-1080x1920", w: 1080, h: 1920, title: false, board: { kind: 3, hex: "#3a405c" }, finish: 1 },
];

/** The game title on the art. Change it here if the game is renamed. */
const TITLE = "Unbolted";
/** Palette colour per level colour slot (bright, varied). */
const COLOURS = [0, 1, 2, 3, 4, 6, 7, 10];

/** A mid-level board with a plate about to swing: returns the board before and the bolt to tap. */
function stage(): { board: Board; swingBolt: number } {
  const def = generateLevel(152).def;
  const b = newBoard(def);
  // Take a few bolts out so the board looks in progress, then find a tap that swings a plate.
  for (let k = 0; k < 6; k++) {
    const m = legalMoves(b);
    if (!m.length) break;
    tap(b, m[(k * 7) % m.length]);
  }
  let swingBolt = -1;
  let best = 0;
  for (let i = 0; i < b.boltOn.length; i++) {
    if (!isFree(b, i)) continue;
    const c = cloneBoard(b);
    const r = tap(c, i);
    if (r && r.swung.length) {
      const area = r.swung.length * 10 + def.plates[r.swung[0]][0];
      if (area > best) {
        best = area;
        swingBolt = i;
      }
    }
  }
  return { board: b, swingBolt };
}

async function save(name: string, canvas: HTMLCanvasElement): Promise<void> {
  const base64 = canvas.toDataURL("image/png").split(",")[1];
  const res = await fetch(`/__save?path=press/${name}.png`, { method: "POST", body: JSON.stringify({ base64 }) });
  console.log(await res.text());
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}

function drawToolbox(g: CanvasRenderingContext2D, x: number, y: number, w: number, hex: string, filled: number): void {
  const h = w * 0.55;
  g.save();
  g.shadowColor = "rgba(60,35,15,0.35)";
  g.shadowBlur = w * 0.12;
  g.shadowOffsetY = w * 0.05;
  g.fillStyle = hex;
  roundRect(g, x, y, w, h, w * 0.12);
  g.fill();
  g.restore();
  g.strokeStyle = "rgba(0,0,0,0.35)";
  g.lineWidth = w * 0.04;
  g.beginPath();
  g.roundRect(x + w * 0.3, y - w * 0.13, w * 0.4, w * 0.16, [w * 0.08, w * 0.08, 0, 0]);
  g.stroke();
  g.fillStyle = "rgba(0,0,0,0.15)";
  g.fillRect(x, y + h * 0.82, w, h * 0.18);
  for (let i = 0; i < 3; i++) {
    const cx = x + w * (0.22 + i * 0.28);
    const cy = y + h * 0.5;
    const r = w * 0.1;
    g.fillStyle = "rgba(0,0,0,0.3)";
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.fill();
    if (i < filled) {
      g.fillStyle = "#c9ced6";
      g.beginPath();
      g.arc(cx, cy, r * 0.95, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = hex;
      g.beginPath();
      g.arc(cx, cy, r * 0.68, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "rgba(255,255,255,0.45)";
      g.beginPath();
      g.arc(cx - r * 0.25, cy - r * 0.25, r * 0.22, 0, Math.PI * 2);
      g.fill();
    }
  }
}

function drawDriver(g: CanvasRenderingContext2D, tipX: number, tipY: number, s: number): void {
  g.save();
  g.translate(tipX, tipY);
  g.rotate(-0.35);
  g.shadowColor = "rgba(40,20,10,0.4)";
  g.shadowBlur = s * 0.3;
  g.shadowOffsetX = s * 0.15;
  g.fillStyle = "#c9ced6";
  g.fillRect(-s * 0.06, -s * 1.6, s * 0.12, s * 1.6);
  g.shadowColor = "transparent";
  const hw = s * 0.36;
  const grad = g.createLinearGradient(-hw / 2, 0, hw / 2, 0);
  grad.addColorStop(0, "#e8443a");
  grad.addColorStop(0.5, "#ff7a6a");
  grad.addColorStop(1, "#b72f27");
  g.fillStyle = grad;
  roundRect(g, -hw / 2, -s * 3.3, hw, s * 1.8, hw * 0.45);
  g.fill();
  g.fillStyle = "rgba(0,0,0,0.18)";
  for (let i = 0; i < 4; i++) g.fillRect(-hw / 2 + hw * (0.15 + i * 0.22), -s * 3.1, hw * 0.07, s * 1.4);
  g.restore();
}

export async function runPress(): Promise<string[]> {
  await document.fonts.load('800 120px "Baloo 2"');
  const glCanvas = document.createElement("canvas");
  glCanvas.style.cssText = "position:fixed;left:0;top:0;opacity:0;pointer-events:none";
  document.body.append(glCanvas);
  const view = new WorkshopView(glCanvas);
  view.renderer.setPixelRatio(1);
  const { board, swingBolt } = stage();
  const gadget = GADGETS[8]; // Robot Pal
  const filled = gadget.parts.map((p, i) => (i < 4 ? p.need : i < 6 ? Math.floor(p.need / 2) : 0));
  const saved: string[] = [];

  for (const shot of SHOTS) {
    const comp = document.createElement("canvas");
    comp.width = shot.w;
    comp.height = shot.h;
    const g = comp.getContext("2d")!;
    const aspect = shot.w / shot.h;
    const icon = shot.name.startsWith("icon");
    // Regions: board [x, y, w, h]; gadget card [x, y, size]; title [cx, cy, maxW]; toolboxes y.
    let boardR: [number, number, number, number];
    let cardR: [number, number, number];
    let titleR: [number, number, number];
    if (aspect >= 1.2) {
      boardR = [shot.w * 0.36, 0, shot.w * 0.64, shot.h];
      const cs = Math.min(shot.w * 0.24, shot.h * 0.42);
      cardR = [shot.w * 0.18 - cs / 2, shot.h * (shot.title ? 0.42 : 0.3), cs];
      titleR = [shot.w * 0.18, shot.h * 0.2, shot.w * 0.32];
    } else if (aspect <= 0.83) {
      boardR = [0, 0, shot.w, shot.h];
      const cs = shot.w * 0.28;
      cardR = [shot.w * 0.68, shot.h * (shot.title ? 0.12 : 0.03), cs];
      titleR = [shot.w * 0.36, shot.h * 0.075, shot.w * 0.62];
    } else {
      boardR = [0, 0, shot.w, shot.h];
      const cs = shot.w * 0.24;
      cardR = icon ? [0, 0, 0] : [shot.w * 0.74, shot.h * (shot.title ? 0.03 : 0.04), cs];
      titleR = [shot.w * 0.36, shot.h * 0.11, shot.w * 0.62];
    }

    // Board (the pegboard fills the region; the region is as big as the canvas where possible).
    glCanvas.style.width = `${boardR[2]}px`;
    glCanvas.style.height = `${boardR[3]}px`;
    view.resize(Math.round(boardR[2]), Math.round(boardR[3]));
    view.applyFinish({ plate: shot.finish ?? 0, board: shot.board?.kind ?? 0, boardHex: shot.board?.hex ?? "#d6b88f" });
    const b = cloneBoard(board);
    view.build(b, (s) => COLOURS[s % COLOURS.length]);
    view.setSymbols(!!shot.symbols);
    const topSafe = aspect >= 1.2 ? 0.04 : icon ? 0.04 : aspect <= 0.83 ? (shot.title ? 0.3 : 0.24) : shot.title ? 0.27 : 0.25;
    view.setSafeArea(boardR[3] * topSafe, boardR[3] * (icon ? 0.04 : aspect <= 0.83 ? 0.15 : 0.2));
    // Catch the swing mid-way.
    if (swingBolt >= 0) {
      const r = tap(b, swingBolt)!;
      void view.unscrew(swingBolt, true);
      view.render(0.2);
      void view.settleTo(b, r);
      view.render(0.07);
    } else view.render(0.016);
    g.drawImage(view.renderer.domElement, boardR[0], boardR[1], boardR[2], boardR[3]);
    // Fill the rest of the canvas with plain pegboard colour behind other regions.
    if (boardR[0] > 0 || boardR[1] > 0) {
      g.save();
      g.globalCompositeOperation = "destination-over";
      const bg = g.createLinearGradient(0, 0, 0, shot.h);
      bg.addColorStop(0, shot.board ? "#4a5175" : "#f1e1c6");
      bg.addColorStop(1, shot.board ? "#191c30" : "#c4a47a");
      g.fillStyle = bg;
      g.fillRect(0, 0, shot.w, shot.h);
      g.restore();
    }

    // Screwdriver on a free bolt near the middle of the board.
    const cr = glCanvas.getBoundingClientRect();
    let pick = -1;
    let bestD = Infinity;
    for (let i = 0; i < b.boltOn.length; i++) {
      if (!b.boltOn[i] || !isFree(b, i)) continue;
      const p = view.boltClient(i);
      const d = Math.hypot(p.x - cr.left - cr.width * 0.45, p.y - cr.top - cr.height * 0.45);
      if (d < bestD) {
        bestD = d;
        pick = i;
      }
    }
    const unit = view.unitPx;
    if (pick >= 0 && !icon) {
      const p = view.boltClient(pick);
      drawDriver(g, boardR[0] + (p.x - cr.left), boardR[1] + (p.y - cr.top), unit * 0.9);
    }

    // Toolboxes along the bottom of the board region.
    if (!icon) {
      const bw = Math.min(boardR[2] * 0.26, unit * 2.4);
      const by = boardR[1] + boardR[3] - bw * 0.85;
      const mid = boardR[0] + boardR[2] / 2;
      drawToolbox(g, mid - bw - bw * 0.08, by, bw, BOLT_COLOURS[COLOURS[0]].hex, 2);
      drawToolbox(g, mid + bw * 0.08, by, bw, BOLT_COLOURS[COLOURS[1]].hex, 1);
    }

    // Gadget blueprint card.
    if (cardR[2] > 0) {
      const [cx, cy, cs] = cardR;
      g.save();
      g.shadowColor = "rgba(40,25,10,0.35)";
      g.shadowBlur = cs * 0.08;
      g.shadowOffsetY = cs * 0.03;
      g.fillStyle = "#fff8ec";
      roundRect(g, cx - cs * 0.05, cy - cs * 0.05, cs * 1.1, cs * 1.1, cs * 0.08);
      g.fill();
      g.restore();
      drawGadgetAt(g, gadget, filled, cx, cy, cs, { paper: true });
    }

    // Title: chunky letters with a bolt for the dot-less "o" feel.
    if (shot.title) {
      const [tx, ty, maxW] = titleR;
      let size = Math.round(Math.min(shot.w, shot.h) * 0.16);
      g.font = `800 ${size}px "Baloo 2", sans-serif`;
      while (g.measureText(TITLE).width > maxW && size > 10) {
        size -= 2;
        g.font = `800 ${size}px "Baloo 2", sans-serif`;
      }
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.lineJoin = "round";
      g.lineWidth = size * 0.16;
      g.strokeStyle = "#3b2a1e";
      g.strokeText(TITLE, tx, ty);
      const grad = g.createLinearGradient(0, ty - size / 2, 0, ty + size / 2);
      grad.addColorStop(0, "#ffb15a");
      grad.addColorStop(1, "#e0702a");
      g.fillStyle = grad;
      g.fillText(TITLE, tx, ty);
      g.fillStyle = "rgba(255,255,255,0.35)";
      g.fillText(TITLE, tx, ty - size * 0.04);
      g.fillStyle = grad;
      g.fillText(TITLE, tx, ty + size * 0.02);
    }
    await save(shot.name, comp);
    saved.push(shot.name);
  }
  glCanvas.remove();
  return saved;
}
