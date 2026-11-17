// Dev-only press mode (?press=1): renders store art and portal thumbnails to PNG files in
// hc05-aisle-nine/press/ through the dev server's /__save endpoint. Never part of a production build.
//
// Every shot shows the same staged moment: the turning stand, a good lifted on its way to a shelf
// that already holds two of it (with sparkles: it's about to sell), the display card and the title.

import { StandView } from "../view/stand.ts";
import { EMPTY, SPOTS, inReach, kindCounts, newBoard, shelfCount, usable } from "../logic/rules.ts";
import type { Board } from "../logic/rules.ts";
import { generateLevel } from "../logic/generator.ts";
import { DisplayProgress } from "../game/displays.ts";
import { GOODS } from "../data/goods.ts";

interface Shot {
  name: string;
  w: number;
  h: number;
  title: boolean;
  theme?: { bg: [string, string, string]; wood: string; plank: string; trim: string; awning: [string, string] };
}

const GROCERY = { bg: ["#fbf3e3", "#f0dfc0", "#d9bf94"] as [string, string, string], wood: "#c9935a", plank: "#ecd3a8", trim: "#4f9a5a", awning: ["#d9382f", "#fff6ea"] as [string, string] };
const SWEETS = { bg: ["#fff4f9", "#f9dceb", "#eab0cd"] as [string, string, string], wood: "#f48fb1", plank: "#fff0f5", trim: "#e0508f", awning: ["#e0508f", "#ffe0ef"] as [string, string] };
const BOOKS = { bg: ["#6b5040", "#4e382c", "#33241c"] as [string, string, string], wood: "#c8963a", plank: "#3a2a1e", trim: "#7a3b3b", awning: ["#2a3f7a", "#f3e9d8"] as [string, string] };

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
  { name: "screenshot-sweets-1080x1920", w: 1080, h: 1920, title: false, theme: SWEETS },
  { name: "screenshot-books-1080x1920", w: 1080, h: 1920, title: false, theme: BOOKS },
];

/** The game title on the art. Change it here if the game is renamed. */
const TITLE = "Aisle Nine";

async function save(name: string, canvas: HTMLCanvasElement): Promise<void> {
  const base64 = canvas.toDataURL("image/png").split(",")[1];
  const res = await fetch(`/__save?path=press/${name}.png`, { method: "POST", body: JSON.stringify({ base64 }) });
  console.log(await res.text());
}

/** A shelf in reach holding two of a kind with a free spot, and a good of that kind on another shelf. */
function stagedMove(b: Board): { from: number; spot: number; to: number } | null {
  const S = shelfCount(b.def);
  const row = (s: number) => b.front.slice(s * SPOTS, s * SPOTS + SPOTS);
  for (let to = 0; to < S; to++) {
    if (!inReach(b, to) || !usable(b, to)) continue;
    const r = row(to);
    const goods = r.filter((k) => k !== EMPTY);
    if (goods.length !== 2 || goods[0] !== goods[1]) continue;
    for (let from = 0; from < S; from++) {
      if (from === to || !inReach(b, from) || !usable(b, from)) continue;
      const spot = row(from).indexOf(goods[0]);
      if (spot >= 0) return { from, spot, to };
    }
  }
  return null;
}

function drawCard(g: CanvasRenderingContext2D, x: number, y: number, w: number, dp: DisplayProgress, filled: number[]): void {
  const disp = dp.display;
  const rowH = w * 0.15;
  const h = w * 0.2 + rowH * disp.parts.length + w * 0.05;
  g.save();
  g.shadowColor = "rgba(60,35,15,0.3)";
  g.shadowBlur = w * 0.06;
  g.shadowOffsetY = w * 0.02;
  g.fillStyle = "#fff8ec";
  g.beginPath();
  g.roundRect(x, y, w, h, w * 0.07);
  g.fill();
  g.restore();
  g.textBaseline = "middle";
  g.fillStyle = "#4d3626";
  g.font = `800 ${Math.round(w * 0.085)}px "Baloo 2", sans-serif`;
  g.fillText(`${disp.icon} ${disp.name}`, x + w * 0.07, y + w * 0.11);
  disp.parts.forEach((p, i) => {
    const yy = y + w * 0.2 + rowH * i + rowH / 2;
    const good = GOODS.find((q) => q.id === p.good)!;
    g.font = `${Math.round(w * 0.08)}px sans-serif`;
    g.fillText(good.icon, x + w * 0.07, yy);
    const bx = x + w * 0.2;
    const bw = w * 0.52;
    g.fillStyle = "#f6ead4";
    g.beginPath();
    g.roundRect(bx, yy - w * 0.025, bw, w * 0.05, w * 0.025);
    g.fill();
    const f = Math.min(1, filled[i] / p.need);
    g.fillStyle = f >= 1 ? "#3f8f4f" : "#e9a43a";
    g.beginPath();
    g.roundRect(bx, yy - w * 0.025, Math.max(w * 0.05, bw * f), w * 0.05, w * 0.025);
    g.fill();
    g.fillStyle = "#85664d";
    g.font = `800 ${Math.round(w * 0.06)}px "Baloo 2", sans-serif`;
    g.fillText(`${filled[i]}/${p.need}`, x + w * 0.76, yy);
    g.fillStyle = "#4d3626";
  });
}

function drawAwning(g: CanvasRenderingContext2D, w: number, h: number, colors: [string, string]): void {
  const band = Math.max(18, Math.round(Math.min(w, h) * 0.045));
  const stripe = band * 1.5;
  for (let x = 0, i = 0; x < w; x += stripe, i++) {
    g.fillStyle = colors[i % 2];
    g.fillRect(x, 0, stripe, band);
    g.beginPath();
    g.arc(x + stripe / 2, band, stripe / 2, 0, Math.PI);
    g.fill();
  }
}

export async function runPress(): Promise<string[]> {
  await document.fonts.load('800 120px "Baloo 2"');
  const glCanvas = document.createElement("canvas");
  glCanvas.style.cssText = "position:fixed;left:0;top:0;opacity:0;pointer-events:none";
  document.body.append(glCanvas);
  const view = new StandView(glCanvas);
  view.renderer.setPixelRatio(1);
  // A colourful three-shelf stand.
  let def = generateLevel(140).def;
  for (let n = 141; def.rows < 3 && n < 200; n++) def = generateLevel(n).def;
  const display = new DisplayProgress(0);
  const b0 = newBoard(def);
  const goodsOf = display.mapGoods(kindCounts(b0), def.n);
  const move = stagedMove(b0);
  const filled = display.display.parts.map((p, i) => (i === 0 ? p.need : Math.floor(p.need * 0.6)));
  const saved: string[] = [];

  for (const shot of SHOTS) {
    const theme = shot.theme ?? GROCERY;
    const comp = document.createElement("canvas");
    comp.width = shot.w;
    comp.height = shot.h;
    const g = comp.getContext("2d")!;
    const aspect = shot.w / shot.h;
    const icon = shot.name.startsWith("icon");
    const wide = aspect >= 1.2;
    const tall = aspect <= 0.83;
    // Background: the shop wall.
    const bg = g.createRadialGradient(shot.w / 2, shot.h * 0.35, 0, shot.w / 2, shot.h * 0.35, Math.max(shot.w, shot.h) * 0.75);
    bg.addColorStop(0, theme.bg[0]);
    bg.addColorStop(0.62, theme.bg[1]);
    bg.addColorStop(1, theme.bg[2]);
    g.fillStyle = bg;
    g.fillRect(0, 0, shot.w, shot.h);
    // The stand: the right part of landscape art, the middle of portrait and square art.
    const gw = Math.round(wide ? shot.w * 0.58 : shot.w);
    const gh = shot.h;
    const gx = wide ? shot.w - gw - shot.w * 0.02 : 0;
    glCanvas.style.width = `${gw}px`;
    glCanvas.style.height = `${gh}px`;
    view.resize(gw, gh);
    const b = newBoard(def);
    view.applyStyle({ wood: theme.wood, plank: theme.plank, trim: theme.trim });
    view.build(b, goodsOf);
    const top = shot.title ? (wide ? 0.08 : tall ? 0.16 : 0.2) : icon ? 0.04 : 0.06;
    const bottom = tall ? 0.27 : !wide && !icon && shot.title ? 0.04 : 0.04;
    view.setSafeArea(gh * top, gh * bottom);
    if (move) {
      view.select({ shelf: move.from, spot: move.spot });
      view.setTargets([move.to]);
    }
    for (let k = 0; k < 12; k++) view.render(0.05);
    if (move) view.sparkle(move.to);
    view.render(0.016);
    g.drawImage(view.renderer.domElement, gx, 0, gw, gh);
    drawAwning(g, shot.w, shot.h, theme.awning);

    // Display card.
    if (!icon) {
      const cw = wide ? shot.w * 0.27 : tall ? shot.w * 0.56 : shot.w * 0.36;
      const cx = wide ? shot.w * 0.07 : tall ? (shot.w - cw) / 2 : shot.w * 0.6;
      const cardH = cw * 0.2 + cw * 0.15 * display.display.parts.length + cw * 0.05;
      const cy = wide ? shot.h * (shot.title ? 0.42 : 0.3) : tall ? shot.h - cardH - shot.h * 0.03 : shot.h * 0.06;
      if (wide || tall || shot.title) drawCard(g, cx, cy, cw, display, filled);
    }

    // Title.
    if (shot.title) {
      const tx = wide ? shot.w * 0.205 : tall ? shot.w / 2 : shot.w * 0.29;
      const ty = wide ? shot.h * 0.24 : shot.h * (tall ? 0.115 : 0.135);
      const maxW = wide ? shot.w * 0.32 : tall ? shot.w * 0.86 : shot.w * 0.52;
      let size = Math.round(Math.min(shot.w, shot.h) * 0.15);
      g.font = `800 ${size}px "Baloo 2", sans-serif`;
      while (g.measureText(TITLE).width > maxW && size > 10) {
        size -= 2;
        g.font = `800 ${size}px "Baloo 2", sans-serif`;
      }
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.lineJoin = "round";
      g.lineWidth = size * 0.16;
      g.strokeStyle = "#7a1f1a";
      g.strokeText(TITLE, tx, ty);
      const grad = g.createLinearGradient(0, ty - size / 2, 0, ty + size / 2);
      grad.addColorStop(0, "#fff6e6");
      grad.addColorStop(1, "#ffcf6e");
      g.fillStyle = grad;
      g.fillText(TITLE, tx, ty);
      g.textAlign = "left";
    }
    await save(shot.name, comp);
    saved.push(shot.name);
  }
  glCanvas.remove();
  return saved;
}
