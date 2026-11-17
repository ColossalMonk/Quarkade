// Dev-only press mode (?press=1): renders store art and portal thumbnails to PNG files in
// hc04-snug-bento/press/ through the dev server's /__save endpoint. Never part of a production build.
//
// Every shot shows the same staged moment: a bento box packed except for one piece, which hovers
// just above its gap with a soft green glow, plus the recipe card and the title.

import { BentoView } from "../view/bento.ts";
import { newBoard, placePiece } from "../logic/rules.ts";
import { generateLevel } from "../logic/generator.ts";
import { RecipeProgress } from "../game/recipe.ts";
import { drawRecipe } from "../view/draw.ts";

interface Shot {
  name: string;
  w: number;
  h: number;
  title: boolean;
  style?: { box: string; floor: string; lacquer: boolean; tie: string; mat: { kind: number; a: string; b: string } };
}

const PINE = { box: "#c9935a", floor: "#f3e1c0", lacquer: false, tie: "#e8443a", mat: { kind: 0, a: "#d9c08a", b: "#b89a62" } };
const LACQUER = { box: "#b8262a", floor: "#2a1a1a", lacquer: true, tie: "#f5c518", mat: { kind: 2, a: "#8a5a37", b: "#6b4428" } };

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
  { name: "screenshot-lacquer-1080x1920", w: 1080, h: 1920, title: false, style: LACQUER },
  { name: "screenshot-gingham-1080x1920", w: 1080, h: 1920, title: false, style: { ...PINE, tie: "#3f7fd0", mat: { kind: 1, a: "#ffffff", b: "#f0a8a8" } } },
];

/** The game title on the art. Change it here if the game is renamed. */
const TITLE = "Snug Bento";

async function save(name: string, canvas: HTMLCanvasElement): Promise<void> {
  const base64 = canvas.toDataURL("image/png").split(",")[1];
  const res = await fetch(`/__save?path=press/${name}.png`, { method: "POST", body: JSON.stringify({ base64 }) });
  console.log(await res.text());
}

export async function runPress(): Promise<string[]> {
  await document.fonts.load('800 120px "Baloo 2"');
  const glCanvas = document.createElement("canvas");
  glCanvas.style.cssText = "position:fixed;left:0;top:0;opacity:0;pointer-events:none";
  document.body.append(glCanvas);
  const view = new BentoView(glCanvas);
  view.renderer.setPixelRatio(1);
  // A colourful mid-size box: level 140 (hot/cold and soft foods available).
  const def = generateLevel(140).def;
  const recipe = new RecipeProgress(0);
  const foods = recipe.mapFoods(def.pieces, 140);
  // The hovering piece: the biggest one.
  let hover = 0;
  def.pieces.forEach((p, i) => p.c.length > def.pieces[hover].c.length && (hover = i));
  const filled = recipe.recipe.parts.map((p, i) => (i < 2 ? p.need : Math.floor(p.need / 2)));
  const saved: string[] = [];

  for (const shot of SHOTS) {
    const comp = document.createElement("canvas");
    comp.width = shot.w;
    comp.height = shot.h;
    const g = comp.getContext("2d")!;
    const aspect = shot.w / shot.h;
    const icon = shot.name.startsWith("icon");
    glCanvas.style.width = `${shot.w}px`;
    glCanvas.style.height = `${shot.h}px`;
    view.resize(shot.w, shot.h);
    const b = newBoard(def);
    def.sol.forEach((pl, i) => i !== hover && placePiece(b, i, pl, false));
    view.build(b, foods);
    view.applyStyle(shot.style ?? PINE);
    // Leave room for the title and the recipe card.
    const top = shot.title ? (aspect >= 1.2 ? 0.08 : aspect <= 0.83 ? 0.17 : 0.24) : icon ? 0.04 : 0.05;
    const bottom = aspect <= 0.83 ? 0.26 : 0.06;
    view.setSafeArea(shot.h * top, shot.h * bottom);
    // Landscape: the box sits right of centre, leaving room on the left for the title and card.
    if (aspect >= 1.2) view.frameBox(def.w * 1.25, 0.8, 1.8, 0.6);
    else view.frameBox(0.9, 0.9, 2.2, 0.9);
    view.hover(hover, def.sol[hover], 0.8);
    for (let k = 0; k < 20; k++) view.render(0.05);
    view.hover(hover, def.sol[hover], 0.8);
    view.render(0.016);
    g.drawImage(view.renderer.domElement, 0, 0, shot.w, shot.h);

    // Recipe card.
    if (!icon) {
      const cw = aspect >= 1.2 ? shot.w * 0.28 : shot.w * (aspect <= 0.83 ? 0.5 : 0.34);
      const ch = cw * 0.75;
      const cx = aspect >= 1.2 ? shot.w * 0.06 : aspect <= 0.83 ? (shot.w - cw) / 2 : shot.w * 0.62;
      const cy = aspect >= 1.2 ? shot.h * (shot.title ? 0.4 : 0.28) : aspect <= 0.83 ? shot.h - ch - shot.h * 0.025 : shot.h * 0.03;
      if (aspect >= 1.2 || shot.title || aspect <= 0.83) {
        const card = document.createElement("canvas");
        card.width = Math.round(cw);
        card.height = Math.round(ch);
        Object.defineProperty(card, "getBoundingClientRect", { value: () => ({ width: cw / Math.min(2, devicePixelRatio || 1), height: ch / Math.min(2, devicePixelRatio || 1) }) });
        drawRecipe(card, recipe.recipe, filled);
        g.save();
        g.shadowColor = "rgba(60,35,15,0.35)";
        g.shadowBlur = cw * 0.06;
        g.shadowOffsetY = cw * 0.02;
        g.drawImage(card, cx, cy, cw, ch);
        g.restore();
      }
    }

    // Title.
    if (shot.title) {
      const tx = aspect >= 1.2 ? shot.w * 0.18 : aspect <= 0.83 ? shot.w / 2 : shot.w * 0.3;
      const ty = aspect >= 1.2 ? shot.h * 0.2 : shot.h * (aspect <= 0.83 ? 0.09 : 0.11);
      const maxW = aspect >= 1.2 ? shot.w * 0.3 : aspect <= 0.83 ? shot.w * 0.86 : shot.w * 0.56;
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
      g.strokeStyle = "#5a2e18";
      g.strokeText(TITLE, tx, ty);
      const grad = g.createLinearGradient(0, ty - size / 2, 0, ty + size / 2);
      grad.addColorStop(0, "#fff1d6");
      grad.addColorStop(1, "#f5c26a");
      g.fillStyle = grad;
      g.fillText(TITLE, tx, ty);
    }
    await save(shot.name, comp);
    saved.push(shot.name);
  }
  glCanvas.remove();
  return saved;
}
