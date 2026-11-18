// Dev-only press mode (?press=1): renders store art and portal thumbnails to PNG files in
// hc06-koi-out/press/ through the dev server's /__save endpoint. Never part of a production build.
//
// Every shot shows the same staged moment: a crowded pond with one long koi part-way out, gliding
// through open water with ripples behind it, plus the journal card and the title.

import { PondView } from "../view/pond.ts";
import { newBoard, trace } from "../logic/rules.ts";
import type { LevelDef } from "../logic/rules.ts";
import { generateLevel } from "../logic/generator.ts";
import { JournalProgress } from "../game/journal.ts";
import { REGIONS, VARIETIES } from "../data/varieties.ts";
import { drawKoi } from "../view/draw.ts";

interface Shot {
  name: string;
  w: number;
  h: number;
  title: boolean;
  region?: number;
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
  { name: "screenshot-moon-1080x1920", w: 1080, h: 1920, title: false, region: 4 },
  { name: "screenshot-bamboo-1080x1920", w: 1080, h: 1920, title: false, region: 3 },
];

/** The game title on the art. Change it here if the game is renamed. */
const TITLE = "Koi Out";

async function save(name: string, canvas: HTMLCanvasElement): Promise<void> {
  const base64 = canvas.toDataURL("image/png").split(",")[1];
  const res = await fetch(`/__save?path=press/${name}.png`, { method: "POST", body: JSON.stringify({ base64 }) });
  console.log(await res.text());
}

/** The longest koi that can swim out at the start (the hero of the shot). */
function hero(def: LevelDef): number {
  const b = newBoard(def);
  let best = -1;
  def.koi.forEach((k, i) => {
    if (trace(b, i).ok && (best < 0 || k.c.length > def.koi[best].c.length)) best = i;
  });
  return best;
}

function drawCard(g: CanvasRenderingContext2D, x: number, y: number, w: number, jp: JournalProgress): void {
  const h = w * 0.62;
  g.save();
  g.shadowColor = "rgba(10,40,35,0.35)";
  g.shadowBlur = w * 0.06;
  g.shadowOffsetY = w * 0.02;
  g.fillStyle = "#fdf8ee";
  g.beginPath();
  g.roundRect(x, y, w, h, w * 0.07);
  g.fill();
  g.restore();
  g.fillStyle = "#26453f";
  g.textBaseline = "middle";
  g.font = `800 ${Math.round(w * 0.085)}px "Baloo 2", sans-serif`;
  g.fillText(`${REGIONS[jp.page].icon} Koi Journal`, x + w * 0.07, y + w * 0.1);
  // Four koi from the page, the first two "seen".
  const vs = jp.varieties.slice(0, 4);
  vs.forEach((v, i) => {
    const c = document.createElement("canvas");
    c.width = 200;
    c.height = 100;
    drawKoi(c, v);
    const cx = x + w * 0.05 + (i % 2) * w * 0.46;
    const cy = y + w * 0.17 + Math.floor(i / 2) * w * 0.2;
    g.globalAlpha = i < 3 ? 1 : 0.25;
    g.drawImage(c, cx, cy, w * 0.26, w * 0.13);
    g.globalAlpha = 1;
    g.fillStyle = "#26453f";
    g.font = `800 ${Math.round(w * 0.042)}px "Baloo 2", sans-serif`;
    g.fillText(i < 3 ? VARIETIES[v].name.split(" ")[0] : "?", cx + w * 0.27, cy + w * 0.065);
  });
}

export async function runPress(): Promise<string[]> {
  await document.fonts.load('800 120px "Baloo 2"');
  const glCanvas = document.createElement("canvas");
  glCanvas.style.cssText = "position:fixed;left:0;top:0;opacity:0;pointer-events:none";
  document.body.append(glCanvas);
  const view = new PondView(glCanvas);
  view.renderer.setPixelRatio(1);
  // A crowded pond with long koi and a lily pad or two.
  let def = generateLevel(140).def;
  for (let n = 141; (def.koi.filter((k) => k.c.length >= 4).length < 4 || hero(def) < 0 || def.koi[hero(def)].c.length < 4) && n < 260; n++) def = generateLevel(n).def;
  def = { ...def, frogs: undefined, currents: undefined, whirls: def.whirls };
  const h = hero(def);
  const saved: string[] = [];

  for (const shot of SHOTS) {
    const comp = document.createElement("canvas");
    comp.width = shot.w;
    comp.height = shot.h;
    const g = comp.getContext("2d")!;
    const aspect = shot.w / shot.h;
    const icon = shot.name.startsWith("icon");
    const wide = aspect >= 1.2;
    const tall = aspect <= 0.83;
    const region = REGIONS[shot.region ?? 0];
    glCanvas.style.width = `${shot.w}px`;
    glCanvas.style.height = `${shot.h}px`;
    view.resize(shot.w, shot.h);
    view.applyStyle({ deep: region.deep, shallow: region.shallow, stone: region.stone, grass: region.grass, trail: "💧" });
    // Room for the title and card: on the left in landscape, above and below in portrait.
    view.framePad = wide ? { left: def.w * 1.05, right: 0, top: 0, bottom: 0 } : tall && shot.title ? { left: 0.4, right: 0.4, top: 2.4, bottom: 5.6 } : tall ? { left: 0.4, right: 0.4, top: 0.5, bottom: 5.2 } : shot.title ? { left: 0, right: 0, top: 2.4, bottom: 0 } : { left: 0, right: 0, top: 0, bottom: 0 };
    view.setSafeArea(0, 0);
    const b = newBoard(def);
    const jp = new JournalProgress(shot.region ?? 0);
    view.build(b, jp.mapVarieties(def.koi.length, 7));
    for (let k = 0; k < 8; k++) view.render(0.1);
    if (h >= 0) view.stage(h, trace(newBoard(def), h), def.koi[h].c.length * 0.55);
    view.render(0.016);
    g.drawImage(view.renderer.domElement, 0, 0, shot.w, shot.h);

    if (!icon) {
      const cw = wide ? shot.w * 0.27 : tall ? shot.w * 0.56 : shot.w * 0.36;
      const cx = wide ? shot.w * 0.06 : tall ? (shot.w - cw) / 2 : shot.w * 0.6;
      const cy = wide ? shot.h * (shot.title ? 0.42 : 0.3) : tall ? shot.h - cw * 0.62 - shot.h * 0.035 : shot.h * 0.04;
      if (wide || tall || shot.title) drawCard(g, cx, cy, cw, new JournalProgress(shot.region ?? 0));
    }

    if (shot.title) {
      const tx = wide ? shot.w * 0.195 : tall ? shot.w / 2 : shot.w * 0.29;
      const ty = wide ? shot.h * 0.24 : shot.h * (tall ? 0.085 : 0.11);
      const maxW = wide ? shot.w * 0.3 : tall ? shot.w * 0.8 : shot.w * 0.5;
      let size = Math.round(Math.min(shot.w, shot.h) * 0.17);
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
      grad.addColorStop(1, "#ffb36e");
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
