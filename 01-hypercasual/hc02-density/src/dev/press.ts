// Dev-only press mode (?press=1): renders store art and portal thumbnails to PNG files in
// hc02-density/press/ through the dev server's /__save endpoint. Never part of a production build.
//
// Every shot shows the same staged moment: a bench of layered flasks (one sealed and corked
// in sky water, a lifted rainbow flask, a corked flask, murky units) and a half-poured Density
// Tower with drops flying to it.

import { LabView } from "../view/lab.ts";
import { decodeLevel } from "../logic/rules.ts";
import type { LevelDef } from "../logic/rules.ts";
import { TowerProgress } from "../game/tower.ts";
import { drawTower } from "../view/tower-draw.ts";
import { LIQUIDS } from "../data/liquids.ts";
import { cosmetic } from "../data/cosmetics.ts";

interface Shot {
  name: string;
  w: number;
  h: number;
  title: boolean;
  symbols?: boolean;
  bench?: string;
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
  { name: "screenshot-space-1080x1920", w: 1080, h: 1920, title: false, bench: "bench_space" },
];

/** The game title on the art. Change it here if the game is renamed. */
const TITLE = "Density";

// Slots: a honey(4) b sky(3) c berry(3) d olive oil(2) e milk foam(1) f liquid gold(5) g lagoon(3) h lavender(2)
const SHOWCASE: LevelDef = {
  n: 0,
  caps: [4, 4, 4, 4, 4, 4, 4],
  stacks: ["bbbb", "fabd", "acge", "fcdh", "aghe", "", "fCGe"],
  classes: [4, 3, 3, 2, 1, 5, 3, 2],
  L: 4,
  par: 0,
  d: 0,
  tag: "normal",
  corks: [[5, 2]],
};
const LIQUID_OF = [8, 0, 2, 5, 12, 15, 1, 6];

function towerHalfDone(): TowerProgress {
  const t = new TowerProgress(1);
  // Heavy layers mostly in, light ones still to come.
  const order = t.tower.layers.map((l, i) => ({ i, w: LIQUIDS[l].weight })).sort((a, b) => b.w - a.w);
  order.forEach(({ i }, k) => (t.pours[i] = Math.max(1, 6 - k)));
  return t;
}

async function save(name: string, canvas: HTMLCanvasElement): Promise<void> {
  const base64 = canvas.toDataURL("image/png").split(",")[1];
  const res = await fetch(`/__save?path=press/${name}.png`, { method: "POST", body: JSON.stringify({ base64 }) });
  console.log(await res.text());
}

export async function runPress(): Promise<string[]> {
  await document.fonts.load('800 120px "Baloo 2"');
  const glCanvas = document.createElement("canvas");
  glCanvas.style.cssText = "position:fixed;left:-99999px;top:0";
  document.body.append(glCanvas);
  const view = new LabView(glCanvas);
  view.renderer.setPixelRatio(1);
  const tower = towerHalfDone();
  const saved: string[] = [];

  for (const shot of SHOTS) {
    const comp = document.createElement("canvas");
    comp.width = shot.w;
    comp.height = shot.h;
    const g = comp.getContext("2d")!;
    const space = shot.bench === "bench_space";
    const bg = g.createRadialGradient(shot.w * 0.5, shot.h * 0.3, 0, shot.w * 0.5, shot.h * 0.4, Math.max(shot.w, shot.h) * 0.8);
    if (space) {
      bg.addColorStop(0, "#2b3566");
      bg.addColorStop(0.6, "#161c3d");
      bg.addColorStop(1, "#0b0f24");
    } else {
      bg.addColorStop(0, "#f2f6f8");
      bg.addColorStop(0.6, "#dce6ec");
      bg.addColorStop(1, "#bfcdd6");
    }
    g.fillStyle = bg;
    g.fillRect(0, 0, shot.w, shot.h);

    const aspect = shot.w / shot.h;
    const icon = shot.name.startsWith("icon");
    // Regions: board [x, y, w, h]; tower [x, y, w, h]; title [centre x, centre y, max width].
    let boardR: [number, number, number, number];
    let towerR: [number, number, number, number];
    let titleR: [number, number, number];
    if (aspect >= 1.2) {
      boardR = [shot.w * 0.34, 0, shot.w * 0.66, shot.h];
      const th = shot.h * (shot.title ? 0.58 : 0.72);
      towerR = [shot.w * 0.17 - th * 0.3, shot.h * (shot.title ? 0.36 : 0.14), th * 0.6, th];
      titleR = [shot.w * 0.17, shot.h * 0.18, shot.w * 0.3];
    } else if (aspect <= 0.83) {
      boardR = [shot.w * 0.12, shot.h * 0.4, shot.w * 0.76, shot.h * 0.6];
      const th = shot.h * (shot.title ? 0.25 : 0.3);
      towerR = [shot.w / 2 - th * 0.3, shot.h * (shot.title ? 0.13 : 0.06), th * 0.6, th];
      titleR = [shot.w / 2, shot.h * 0.065, shot.w * 0.8];
    } else if (icon) {
      boardR = [0, shot.h * 0.06, shot.w, shot.h * 0.94];
      towerR = [0, 0, 0, 0];
      titleR = [0, 0, 0];
    } else {
      boardR = [0, shot.h * 0.3, shot.w, shot.h * 0.7];
      const th = shot.h * 0.3;
      towerR = [shot.w * 0.8 - th * 0.3, shot.h * 0.02, th * 0.6, th];
      titleR = [shot.w * 0.35, shot.h * 0.15, shot.w * 0.56];
    }

    // Board: the icon shows only three flasks, big.
    const def: LevelDef = icon ? { ...SHOWCASE, caps: [4, 4, 4], stacks: ["fabd", "bbbb", "fcge"], corks: [] } : SHOWCASE;
    const board = decodeLevel(def);
    board.locked[icon ? 1 : 0] = true;
    view.resize(Math.round(boardR[2]), Math.round(boardR[3]));
    const c = (id: string) => cosmetic(id);
    view.applyCosmetics(c("glass_tube").glass!, c(shot.bench ?? "bench_tile").bench!, c("pour_plain").pour!);
    view.build(board, (s) => LIQUID_OF[s] ?? s);
    view.setSymbols(!!shot.symbols);
    view.setSafeArea(boardR[3] * 0.05, boardR[3] * 0.04);
    view.select(icon ? 0 : 1);
    view.tweens.finishAll();
    for (let k = 0; k < 40; k++) view.render(0.05);
    g.drawImage(view.renderer.domElement, boardR[0], boardR[1], boardR[2], boardR[3]);

    // Tower card with a soft shadow and drops flying into it.
    if (towerR[2] > 0) {
      const [tx, ty, tw, th] = towerR;
      g.save();
      g.shadowColor = "rgba(20,60,90,0.3)";
      g.shadowBlur = tw * 0.12;
      g.shadowOffsetY = tw * 0.04;
      g.fillStyle = space ? "rgba(40,50,95,0.9)" : "rgba(255,255,255,0.7)";
      g.beginPath();
      g.roundRect(tx - tw * 0.12, ty - th * 0.04, tw * 1.24, th * 1.08, tw * 0.14);
      g.fill();
      g.restore();
      const card = document.createElement("canvas");
      card.width = Math.round(tw);
      card.height = Math.round(th);
      Object.defineProperty(card, "getBoundingClientRect", { value: () => ({ width: tw / Math.min(2, devicePixelRatio || 1), height: th / Math.min(2, devicePixelRatio || 1) }) });
      drawTower(card, tower, { glow: true });
      g.drawImage(card, tx, ty, tw, th);

      const fromX = boardR[0] + boardR[2] * (aspect >= 1.2 ? 0.25 : 0.18);
      const fromY = boardR[1] + boardR[3] * 0.3;
      const toX = tx + tw * (aspect <= 0.83 ? 0.1 : 0.5);
      const toY = ty + th * 0.25;
      const dropHex = [LIQUIDS[0].hex, LIQUIDS[0].hex, LIQUIDS[12].hex, LIQUIDS[0].hex];
      for (let k = 0; k < 4; k++) {
        const t = 0.25 + k * 0.17;
        const x = fromX + (toX - fromX) * t;
        const y = fromY + (toY - fromY) * t - Math.sin(t * Math.PI) * tw * 0.4;
        const r = tw * (0.05 + k * 0.008);
        g.save();
        g.globalAlpha = 0.65 + k * 0.1;
        g.fillStyle = dropHex[k];
        g.beginPath();
        g.ellipse(x, y, r, r * 1.25, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = "rgba(255,255,255,0.6)";
        g.beginPath();
        g.ellipse(x - r * 0.3, y - r * 0.35, r * 0.25, r * 0.3, 0, 0, Math.PI * 2);
        g.fill();
        g.restore();
      }
    }

    // Title: each letter a step heavier (darker), like liquids settling.
    if (shot.title) {
      const [tx, ty, maxW] = titleR;
      let size = Math.round(Math.min(shot.w, shot.h) * 0.16);
      g.font = `800 ${size}px "Baloo 2", sans-serif`;
      while (g.measureText(TITLE).width > maxW && size > 10) {
        size -= 2;
        g.font = `800 ${size}px "Baloo 2", sans-serif`;
      }
      g.textAlign = "left";
      g.textBaseline = "middle";
      const total = g.measureText(TITLE).width;
      let x = tx - total / 2;
      const ramp = ["#5fc0ec", "#4aa8e8", "#3f97d6", "#2f8fc0", "#2a7cae", "#23699a", "#1c5784"];
      [...TITLE].forEach((ch, i) => {
        g.fillStyle = "rgba(15,50,80,0.25)";
        g.fillText(ch, x, ty + size * 0.06);
        g.fillStyle = ramp[i % ramp.length];
        g.fillText(ch, x, ty);
        x += g.measureText(ch).width;
      });
    }
    await save(shot.name, comp);
    saved.push(shot.name);
  }
  glCanvas.remove();
  return saved;
}
