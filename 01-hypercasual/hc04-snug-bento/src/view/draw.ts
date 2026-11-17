// 2D canvas drawings: the recipe card (foods with progress) and the café menu board.

import type { Recipe } from "../data/recipes.ts";
import { MENUS, recipesOfMenu } from "../data/recipes.ts";
import { FOODS, FOOD_INDEX } from "../data/foods.ts";

export function fitCanvas(canvas: HTMLCanvasElement): { g: CanvasRenderingContext2D; w: number; h: number } {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const r = canvas.getBoundingClientRect();
  const w = Math.max(16, Math.round((r.width || canvas.width / dpr) * dpr));
  const h = Math.max(16, Math.round((r.height || canvas.height / dpr) * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  const g = canvas.getContext("2d")!;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, w, h);
  return { g, w, h };
}

/** A small food token: a coloured disc in the food's main colour with its emoji. */
function token(g: CanvasRenderingContext2D, food: string, x: number, y: number, r: number, faded: boolean): void {
  const f = FOODS[FOOD_INDEX[food]] ?? FOODS[0];
  g.globalAlpha = faded ? 0.35 : 1;
  g.fillStyle = f.colors[0];
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  g.font = `${r * 1.3}px sans-serif`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(f.icon, x, y + r * 0.08);
  g.globalAlpha = 1;
}

/**
 * The recipe card: its dish, then each food with a progress bar. `compact` draws a small icon
 * version (the HUD button): the dish with a ring showing overall progress.
 */
export function drawRecipe(canvas: HTMLCanvasElement, recipe: Recipe, filled: number[] | "full", opts: { compact?: boolean; title?: string } = {}): void {
  const { g, w, h } = fitCanvas(canvas);
  const full = filled === "full";
  const done = recipe.parts.reduce((a, p, i) => a + (full ? p.need : Math.min(p.need, (filled as number[])[i] ?? 0)), 0);
  const total = recipe.parts.reduce((a, p) => a + p.need, 0);
  const frac = total ? done / total : 0;
  // Card
  g.fillStyle = "#fffaf0";
  g.beginPath();
  g.roundRect(1, 1, w - 2, h - 2, Math.min(w, h) * 0.12);
  g.fill();
  g.strokeStyle = "rgba(90,61,41,0.25)";
  g.lineWidth = Math.max(1, w * 0.01);
  g.stroke();
  if (opts.compact) {
    const cx = w / 2;
    const cy = h / 2;
    const r = Math.min(w, h) * 0.36;
    g.lineWidth = r * 0.22;
    g.strokeStyle = "rgba(90,61,41,0.15)";
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.stroke();
    g.strokeStyle = "#e8603a";
    g.beginPath();
    g.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac);
    g.stroke();
    g.font = `${r * 1.15}px sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(recipe.icon, cx, cy + r * 0.06);
    return;
  }
  const pad = w * 0.06;
  g.fillStyle = "#5a3d29";
  g.font = `800 ${h * 0.085}px "Baloo 2", sans-serif`;
  g.textAlign = "left";
  g.textBaseline = "top";
  g.fillText(`${recipe.icon} ${opts.title ?? recipe.name}`, pad, pad * 0.8);
  const rowH = (h - pad * 2 - h * 0.13) / Math.max(4, recipe.parts.length);
  recipe.parts.forEach((p, i) => {
    const y = pad + h * 0.13 + i * rowH + rowH / 2;
    const f = full ? p.need : Math.min(p.need, (filled as number[])[i] ?? 0);
    const r = rowH * 0.36;
    token(g, p.food, pad + r, y, r, f < p.need && f === 0);
    const bx = pad + r * 2 + pad * 0.6;
    const bw = w - bx - pad - w * 0.18;
    g.fillStyle = "rgba(90,61,41,0.12)";
    g.beginPath();
    g.roundRect(bx, y - r * 0.4, bw, r * 0.8, r * 0.4);
    g.fill();
    g.fillStyle = f >= p.need ? "#3f9d55" : "#e8a03a";
    g.beginPath();
    g.roundRect(bx, y - r * 0.4, Math.max(r * 0.8, (bw * f) / p.need), r * 0.8, r * 0.4);
    g.fill();
    g.fillStyle = "#5a3d29";
    g.font = `700 ${r * 1.1}px "Baloo 2", sans-serif`;
    g.textAlign = "right";
    g.textBaseline = "middle";
    g.fillText(f >= p.need ? "✓" : `${f}/${p.need}`, w - pad, y);
  });
}

/** The café menu board: a chalkboard with the menu's 8 recipes; finished ones in colour. */
export function drawMenuBoard(canvas: HTMLCanvasElement, menuIdx: number, finished: string[], current: string | null, title: string): void {
  const { g, w, h } = fitCanvas(canvas);
  const menu = MENUS[menuIdx];
  g.fillStyle = "#8a5a37";
  g.beginPath();
  g.roundRect(0, 0, w, h, w * 0.04);
  g.fill();
  const m = w * 0.035;
  g.fillStyle = menu.board;
  g.beginPath();
  g.roundRect(m, m, w - 2 * m, h - 2 * m, w * 0.02);
  g.fill();
  g.fillStyle = menu.accent;
  g.font = `800 ${h * 0.09}px "Baloo 2", sans-serif`;
  g.textAlign = "center";
  g.textBaseline = "top";
  g.fillText(title, w / 2, m * 1.6);
  const recipes = recipesOfMenu(menuIdx);
  const cols = 2;
  const top = m * 1.6 + h * 0.13;
  const rowH = (h - top - m * 1.5) / 4;
  recipes.forEach((r, i) => {
    const cx = m * 2 + ((w - 4 * m) / cols) * (i % cols);
    const cy = top + rowH * Math.floor(i / cols) + rowH / 2;
    const own = finished.includes(r.id);
    g.globalAlpha = own ? 1 : 0.32;
    g.font = `${rowH * 0.55}px sans-serif`;
    g.textAlign = "left";
    g.textBaseline = "middle";
    g.fillText(r.icon, cx, cy);
    g.fillStyle = own ? "#f4f1ea" : "#c9ced6";
    g.font = `700 ${rowH * 0.3}px "Baloo 2", sans-serif`;
    g.fillText(own ? r.name : "?", cx + rowH * 0.75, cy);
    g.globalAlpha = 1;
    if (r.id === current) {
      g.strokeStyle = menu.accent;
      g.lineWidth = 2;
      g.setLineDash([5, 4]);
      g.strokeRect(cx - 4, cy - rowH * 0.42, (w - 4 * m) / cols - 6, rowH * 0.84);
      g.setLineDash([]);
    }
  });
}
