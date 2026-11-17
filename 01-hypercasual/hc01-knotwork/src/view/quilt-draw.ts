// Draws a quilt onto a 2D canvas: knitted V-stitch patches, puffy edges, running-stitch seams.

import { YARNS } from "../data/palette.ts";
import type { QuiltProgress } from "../game/quilt.ts";

function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.max(0, Math.round(((n >> 16) & 255) * f)));
  const g = Math.min(255, Math.max(0, Math.round(((n >> 8) & 255) * f)));
  const b = Math.min(255, Math.max(0, Math.round((n & 255) * f)));
  return `rgb(${r},${g},${b})`;
}

export function drawPatch(g: CanvasRenderingContext2D, x: number, y: number, s: number, hex: string): void {
  const r = Math.max(1, s * 0.14);
  g.fillStyle = hex;
  g.beginPath();
  g.roundRect(x + 0.5, y + 0.5, s - 1, s - 1, r);
  g.fill();
  // V stitches: columns of chevrons.
  const cols = 3;
  const rows = 4;
  const cw = (s - 2) / cols;
  const rh = (s - 2) / rows;
  g.strokeStyle = shade(hex, 0.78);
  g.lineWidth = Math.max(0.6, s * 0.045);
  for (let c = 0; c < cols; c++) {
    for (let rr = 0; rr < rows; rr++) {
      const cx = x + 1 + cw * (c + 0.5);
      const cy = y + 1 + rh * rr + rh * 0.2;
      g.beginPath();
      g.moveTo(cx - cw * 0.32, cy);
      g.lineTo(cx, cy + rh * 0.6);
      g.lineTo(cx + cw * 0.32, cy);
      g.stroke();
    }
  }
  // Puffy highlight.
  const grad = g.createLinearGradient(x, y, x, y + s);
  grad.addColorStop(0, "rgba(255,255,255,0.22)");
  grad.addColorStop(0.5, "rgba(255,255,255,0)");
  grad.addColorStop(1, "rgba(0,0,0,0.12)");
  g.fillStyle = grad;
  g.beginPath();
  g.roundRect(x + 0.5, y + 0.5, s - 1, s - 1, r);
  g.fill();
}

/** Draw the whole quilt. Unfilled cells show as faint outlines of their colour. */
export function drawQuilt(canvas: HTMLCanvasElement, quilt: QuiltProgress, highlight: number[] = []): void {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const css = canvas.getBoundingClientRect();
  const size = Math.max(16, Math.round(Math.min(css.width, css.height) * dpr)) || canvas.width;
  if (canvas.width !== size) {
    canvas.width = size;
    canvas.height = size;
  }
  const g = canvas.getContext("2d")!;
  g.clearRect(0, 0, size, size);
  const pad = size * 0.04;
  const cell = (size - pad * 2) / 8;
  g.fillStyle = "#fbf4e6";
  g.beginPath();
  g.roundRect(0, 0, size, size, size * 0.06);
  g.fill();
  for (let i = 0; i < 64; i++) {
    const x = pad + (i % 8) * cell;
    const y = pad + Math.floor(i / 8) * cell;
    const hex = YARNS[quilt.cellYarn(i)].hex;
    if (quilt.cells[i]) {
      drawPatch(g, x, y, cell, hex);
      if (highlight.includes(i)) {
        g.strokeStyle = "rgba(255,255,255,0.9)";
        g.lineWidth = Math.max(1, cell * 0.08);
        g.strokeRect(x + 1, y + 1, cell - 2, cell - 2);
      }
    } else {
      g.fillStyle = "rgba(120,90,60,0.07)";
      g.fillRect(x + 1, y + 1, cell - 2, cell - 2);
      g.fillStyle = hex;
      g.globalAlpha = 0.16;
      g.fillRect(x + cell * 0.3, y + cell * 0.3, cell * 0.4, cell * 0.4);
      g.globalAlpha = 1;
    }
  }
  // Running-stitch seams.
  g.strokeStyle = "rgba(255,248,232,0.75)";
  g.lineWidth = Math.max(0.6, cell * 0.05);
  g.setLineDash([cell * 0.18, cell * 0.14]);
  for (let k = 1; k < 8; k++) {
    g.beginPath();
    g.moveTo(pad + k * cell, pad);
    g.lineTo(pad + k * cell, size - pad);
    g.moveTo(pad, pad + k * cell);
    g.lineTo(size - pad, pad + k * cell);
    g.stroke();
  }
  g.setLineDash([]);
}

/** Client-space centre of quilt cell i inside a canvas element. */
export function cellClientPos(canvas: HTMLCanvasElement, i: number): { x: number; y: number } {
  const r = canvas.getBoundingClientRect();
  const pad = r.width * 0.04;
  const cell = (r.width - pad * 2) / 8;
  return { x: r.left + pad + (i % 8 + 0.5) * cell, y: r.top + pad + (Math.floor(i / 8) + 0.5) * cell };
}
