// Dev-only press mode (?press=1): renders store art and portal thumbnails to PNG files in
// hc01-knotwork/press/ through the dev server's /__save endpoint. Never part of a production build.
//
// Every shot shows the same staged moment: a colourful board mid-sort (one needle finished in
// gold, a twisted loop, a knot, a lifted run) and a half-knitted quilt with stitches flying to it.

import { BoardView } from "../view/board3d.ts";
import { decodeLevel } from "../logic/rules.ts";
import type { LevelDef } from "../logic/rules.ts";
import { QuiltProgress } from "../game/quilt.ts";
import { drawQuilt, drawPatch } from "../view/quilt-draw.ts";
import { YARNS } from "../data/palette.ts";
import { cosmetic } from "../data/cosmetics.ts";

interface Shot {
  name: string;
  w: number;
  h: number;
  title: boolean;
  symbols?: boolean;
  moth?: boolean;
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
  { name: "screenshot-moth-1080x1920", w: 1080, h: 1920, title: false, moth: true },
];

/** The game title on the art. Change it here if the game is renamed. */
const TITLE = "Knotwork";

const SHOWCASE: LevelDef = {
  n: 0,
  caps: [4, 4, 4, 4, 4, 4, 4, 4],
  stacks: ["aaaa", "bcb(cd)", "ce~ed", "fdf", "egb", "ggg", "", "hhch"],
  L: 4,
  par: 0,
  d: 0,
  tag: "normal",
};
// Slots -> yarns: rose, teal, butter, plum, pumpkin, sky, moss, cherry.
const YARN_OF = [8, 4, 2, 7, 1, 5, 3, 0];

function quiltHalfDone(): QuiltProgress {
  // Cat face, bottom 5 rows knitted.
  return new QuiltProgress(0, "0".repeat(24) + "1".repeat(40));
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
  const view = new BoardView(glCanvas);
  const c = cosmetic("yarn_chunky");
  view.applyCosmetics(c.yarn!, cosmetic("needle_wood").needle!, cosmetic("board_oak").board!);
  view.renderer.setPixelRatio(1);
  const board = decodeLevel(SHOWCASE);
  const quilt = quiltHalfDone();
  const saved: string[] = [];

  for (const shot of SHOTS) {
    const comp = document.createElement("canvas");
    comp.width = shot.w;
    comp.height = shot.h;
    const g = comp.getContext("2d")!;
    const bg = g.createRadialGradient(shot.w * 0.5, shot.h * 0.3, 0, shot.w * 0.5, shot.h * 0.4, Math.max(shot.w, shot.h) * 0.8);
    bg.addColorStop(0, "#f7e6cc");
    bg.addColorStop(0.55, "#ecd0aa");
    bg.addColorStop(1, "#d9b286");
    g.fillStyle = bg;
    g.fillRect(0, 0, shot.w, shot.h);

    const aspect = shot.w / shot.h;
    const icon = shot.name.startsWith("icon");
    // Regions: [x, y, w, h] for the board and the quilt.
    let boardR: [number, number, number, number];
    let quiltR: [number, number, number];
    // Title: [centre x, centre y, max width].
    let titleR: [number, number, number];
    if (aspect >= 1.2) {
      boardR = [shot.w * 0.36, 0, shot.w * 0.64, shot.h];
      const qs = Math.min(shot.w * 0.26, shot.h * 0.5);
      quiltR = [shot.w * 0.18 - qs / 2, shot.h * (shot.title ? 0.6 : 0.5) - qs / 2, qs];
      titleR = [shot.w * 0.18, shot.h * 0.2, shot.w * 0.32];
    } else if (aspect <= 0.83) {
      boardR = [0, shot.h * 0.36, shot.w, shot.h * 0.64];
      const qs = shot.w * 0.42;
      quiltR = [shot.w / 2 - qs / 2, shot.h * (shot.title ? 0.23 : 0.18) - qs / 2, qs];
      titleR = [shot.w / 2, shot.h * 0.065, shot.w * 0.8];
    } else {
      boardR = [0, shot.h * (shot.title ? 0.3 : 0.24), shot.w, shot.h * (shot.title ? 0.7 : 0.76)];
      const qs = shot.w * (icon ? 0.34 : 0.24);
      quiltR = shot.title ? [shot.w * 0.74 - qs / 2, shot.h * 0.2, qs] : [shot.w * 0.5 - qs / 2, shot.h * 0.05, qs];
      titleR = [shot.w * 0.36, shot.h * 0.13, shot.w * 0.62];
    }

    // Board.
    view.resize(Math.round(boardR[2]), Math.round(boardR[3]));
    board.moth = shot.moth ? { needle: 7, count: 2 } : null;
    view.build(board, (s) => YARN_OF[s] ?? s);
    view.setSymbols(!!shot.symbols);
    view.setSafeArea(0, 0);
    view.setLocked(0, true, false);
    view.setLift(5, 3);
    view.tweens.finishAll();
    view.render(0.016);
    g.drawImage(view.renderer.domElement, boardR[0], boardR[1], boardR[2], boardR[3]);

    // Quilt card with a soft shadow.
    const [qx, qy, qs] = quiltR;
    const card = document.createElement("canvas");
    card.width = card.height = Math.round(qs);
    Object.defineProperty(card, "getBoundingClientRect", { value: () => ({ width: qs / 2, height: qs / 2 }) });
    drawQuilt(card, quilt);
    g.save();
    g.shadowColor = "rgba(90,55,25,0.35)";
    g.shadowBlur = qs * 0.08;
    g.shadowOffsetY = qs * 0.03;
    g.fillStyle = "#fff8ec";
    g.beginPath();
    g.roundRect(qx - qs * 0.04, qy - qs * 0.04, qs * 1.08, qs * 1.08, qs * 0.08);
    g.fill();
    g.restore();
    g.drawImage(card, qx, qy, qs, qs);

    // Stitches flying from the board to the quilt.
    const fromX = boardR[0] + boardR[2] * 0.45;
    const fromY = boardR[1] + boardR[3] * 0.35;
    const toX = qx + qs * 0.6;
    const toY = qy + qs * 0.45;
    for (let k = 0; k < 4; k++) {
      const tt = 0.25 + k * 0.18;
      const x = fromX + (toX - fromX) * tt;
      const y = fromY + (toY - fromY) * tt - Math.sin(tt * Math.PI) * qs * 0.25;
      const s = qs * (0.07 + k * 0.012);
      g.save();
      g.translate(x, y);
      g.rotate(tt * 3);
      g.globalAlpha = 0.6 + k * 0.1;
      drawPatch(g, -s / 2, -s / 2, s, YARNS[[1, 10, 1, 8][k]].hex);
      g.restore();
    }

    // Title.
    if (shot.title) {
      const [tx, ty, maxW] = titleR;
      let size = Math.round(Math.min(shot.w, shot.h) * 0.16);
      g.font = `800 ${size}px "Baloo 2", sans-serif`;
      // Shrink until it fits its column.
      while (g.measureText(TITLE).width > maxW && size > 10) {
        size -= 2;
        g.font = `800 ${size}px "Baloo 2", sans-serif`;
      }
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillStyle = "rgba(120,50,30,0.28)";
      g.fillText(TITLE, tx, ty + size * 0.06);
      g.fillStyle = "#e2725b";
      g.fillText(TITLE, tx, ty);
    }
    await save(shot.name, comp);
    saved.push(shot.name);
  }
  glCanvas.remove();
  return saved;
}
