// Draws a Density Tower on a 2D canvas: the vessel silhouette, and its liquid layers settled by
// weight (heaviest at the bottom), each filled as far as its pours allow.

import type { TowerProgress } from "../game/tower.ts";
import { LIQUIDS } from "../data/liquids.ts";
import { POURS_PER_LAYER } from "../data/towers.ts";
import type { VesselShape } from "../data/towers.ts";

/** Half-width (0..0.5 of the canvas) of the vessel at height y (0 = bottom, 1 = top). */
function profile(shape: VesselShape, y: number): number {
  switch (shape) {
    case "flask":
      return y < 0.62 ? 0.42 - Math.max(0, y - 0.35) * 0.5 : 0.17;
    case "hourglass":
      return 0.2 + 0.22 * Math.abs(Math.cos(y * Math.PI));
    case "potion": {
      const c = (y - 0.33) / 0.33;
      return y < 0.66 ? 0.42 * Math.sqrt(Math.max(0, 1 - c * c * 0.85)) : 0.15;
    }
    case "star":
      return 0.3 + 0.08 * Math.sin(y * Math.PI * 5);
    case "lantern":
      return 0.24 + 0.16 * Math.sin(y * Math.PI);
    default:
      return 0.32;
  }
}

function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = (s: number) => Math.min(255, Math.max(0, Math.round(((n >> s) & 255) * f)));
  return `rgb(${c(16)},${c(8)},${c(0)})`;
}

export function drawTower(canvas: HTMLCanvasElement, tp: TowerProgress, opts: { glow?: boolean } = {}): void {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const r = canvas.getBoundingClientRect();
  const w = Math.max(16, Math.round((r.width || canvas.width / dpr) * dpr));
  const h = Math.max(16, Math.round((r.height || canvas.height / dpr) * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  const g = canvas.getContext("2d")!;
  g.clearRect(0, 0, w, h);
  const shape = tp.tower.shape;
  const top = h * 0.06;
  const bottom = h * 0.95;
  const H = bottom - top;
  const cx = w / 2;
  const steps = 80;
  const path = new Path2D();
  for (let i = 0; i <= steps; i++) {
    const y = i / steps;
    const x = cx + profile(shape, y) * w;
    if (i === 0) path.moveTo(x, bottom - y * H);
    else path.lineTo(x, bottom - y * H);
  }
  for (let i = steps; i >= 0; i--) {
    const y = i / steps;
    path.lineTo(cx - profile(shape, y) * w, bottom - y * H);
  }
  path.closePath();
  // Glass back
  g.fillStyle = "rgba(230,244,252,0.35)";
  g.fill(path);
  // Liquids, heaviest first (bottom).
  const layers = tp.tower.layers
    .map((l, i) => ({ l, pours: tp.pours[i] }))
    .sort((a, b) => LIQUIDS[b.l].weight - LIQUIDS[a.l].weight);
  const slotH = (H * 0.9) / tp.tower.layers.length;
  let y = bottom;
  g.save();
  g.clip(path);
  for (const { l, pours } of layers) {
    const lh = slotH * (pours / POURS_PER_LAYER);
    if (lh <= 0) continue;
    const hex = LIQUIDS[l].hex;
    const grad = g.createLinearGradient(0, y - lh, 0, y);
    grad.addColorStop(0, shade(hex, 1.12));
    grad.addColorStop(1, shade(hex, 0.86));
    g.fillStyle = grad;
    g.fillRect(0, y - lh, w, lh + 0.5);
    g.fillStyle = "rgba(255,255,255,0.18)";
    g.fillRect(0, y - lh, w, Math.max(1, lh * 0.08));
    y -= lh;
  }
  // Glass highlight
  g.fillStyle = "rgba(255,255,255,0.28)";
  g.fillRect(cx - w * 0.2, top + H * 0.1, w * 0.04, H * 0.75);
  g.restore();
  g.lineWidth = Math.max(1.5, w * 0.025);
  g.strokeStyle = opts.glow ? "rgba(255,213,96,0.95)" : "rgba(255,255,255,0.9)";
  g.stroke(path);
}
