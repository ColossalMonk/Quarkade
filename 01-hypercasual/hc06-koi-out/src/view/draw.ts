// Canvas drawings for the HUD and modals (DESIGN.md §2): a koi in its variety's colours (journal
// cards), and the journey map (the river from the Garden Pond up to the Dragon Gate).

import { PAT, REGIONS, VARIETIES } from "../data/varieties.ts";

function sizeCanvas(c: HTMLCanvasElement): { g: CanvasRenderingContext2D; w: number; h: number } {
  const r = c.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.max(20, Math.round((r.width || c.width) * dpr));
  const h = Math.max(10, Math.round((r.height || c.height) * dpr));
  c.width = w;
  c.height = h;
  return { g: c.getContext("2d")!, w, h };
}

/** A koi seen from above, facing right, in variety v's pattern. */
export function drawKoi(c: HTMLCanvasElement, v: number): void {
  const { g, w, h } = sizeCanvas(c);
  const k = VARIETIES[v];
  const [base, spot, spot2] = k.colors;
  const cx = w * 0.52;
  const cy = h / 2;
  const L = w * 0.36;
  const R = h * 0.26;
  g.clearRect(0, 0, w, h);
  // Tail fin.
  g.fillStyle = base;
  g.globalAlpha = 0.75;
  g.beginPath();
  g.moveTo(cx - L * 0.85, cy);
  g.lineTo(cx - L * 1.35, cy - R * 1.1);
  g.quadraticCurveTo(cx - L * 1.15, cy, cx - L * 1.35, cy + R * 1.1);
  g.closePath();
  g.fill();
  g.globalAlpha = 1;
  // Body.
  const body = new Path2D();
  body.ellipse(cx, cy, L, R, 0, 0, Math.PI * 2);
  g.save();
  g.clip(body);
  g.fillStyle = base;
  g.fillRect(0, 0, w, h);
  const blob = (x: number, y: number, r: number, col: string) => {
    g.fillStyle = col;
    g.beginPath();
    g.ellipse(x, y, r * 1.3, r, 0, 0, Math.PI * 2);
    g.fill();
  };
  if (k.pattern === PAT.tancho) blob(cx + L * 0.55, cy, R * 0.55, spot);
  else if (k.pattern === PAT.asagi) {
    g.fillStyle = spot;
    g.fillRect(0, cy + R * 0.55, w, h);
    g.fillRect(0, 0, w, cy - R * 0.55);
  } else if (k.pattern !== PAT.solid) {
    blob(cx - L * 0.35, cy - R * 0.2, R * 0.6, spot);
    blob(cx + L * 0.3, cy + R * 0.15, R * 0.55, spot);
    if (k.pattern === PAT.sanke || k.pattern === PAT.showa || k.pattern === PAT.utsuri) {
      blob(cx + L * 0.05, cy - R * 0.45, R * 0.28, spot2);
      blob(cx - L * 0.6, cy + R * 0.4, R * 0.25, spot2);
    }
  } else {
    g.fillStyle = spot;
    g.globalAlpha = 0.5;
    g.fillRect(cx - L, cy - R * 0.25, L * 2, R * 0.5);
    g.globalAlpha = 1;
  }
  g.restore();
  // Eyes.
  g.fillStyle = "#111";
  for (const s of [-1, 1]) {
    g.beginPath();
    g.arc(cx + L * 0.78, cy + s * R * 0.45, R * 0.12, 0, Math.PI * 2);
    g.fill();
  }
}

/**
 * The journey map: a river winding up from the Garden Pond (bottom) to the Dragon Gate (top), with
 * each region's landmark. `reached` regions are lit; `progress` (0-1) places the koi on its way to
 * the next one.
 */
export function drawJourney(c: HTMLCanvasElement, reached: number, progress: number, labels: string[]): void {
  const { g, w, h } = sizeCanvas(c);
  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#cfe6ef");
  sky.addColorStop(1, "#cfe3b8");
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);
  // Hills.
  g.fillStyle = "#a8c98a";
  for (let k = 0; k < 4; k++) {
    g.beginPath();
    g.ellipse(w * (0.15 + k * 0.28), h * (0.95 - k * 0.04), w * 0.35, h * 0.28, 0, 0, Math.PI * 2);
    g.fill();
  }
  // The river: a winding line through six stops.
  const stops = REGIONS.map((_, i) => ({ x: w * (i % 2 === 0 ? 0.3 : 0.7), y: h * (0.9 - i * 0.155) }));
  g.lineCap = "round";
  g.lineJoin = "round";
  const river = (width: number, col: string) => {
    g.strokeStyle = col;
    g.lineWidth = width;
    g.beginPath();
    g.moveTo(stops[0].x, h);
    for (let i = 0; i < stops.length; i++) {
      const p = stops[i];
      const prev = i ? stops[i - 1] : { x: stops[0].x, y: h };
      g.quadraticCurveTo(prev.x, (prev.y + p.y) / 2, p.x, p.y);
    }
    g.lineTo(stops[stops.length - 1].x, 0);
    g.stroke();
  };
  river(w * 0.075, "#5aa6c0");
  river(w * 0.04, "#8fd0e4");
  // Landmarks and names.
  stops.forEach((p, i) => {
    const lit = i <= reached;
    g.globalAlpha = lit ? 1 : 0.45;
    g.fillStyle = lit ? "#fdf8ee" : "#dfe6d8";
    g.beginPath();
    g.arc(p.x, p.y, w * 0.07, 0, Math.PI * 2);
    g.fill();
    g.font = `${Math.round(w * 0.075)}px sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(REGIONS[i].icon, p.x, p.y + w * 0.005);
    g.font = `800 ${Math.round(w * 0.045)}px "Baloo 2", sans-serif`;
    g.fillStyle = "#26453f";
    g.textAlign = i % 2 === 0 ? "left" : "right";
    g.fillText(labels[i], p.x + (i % 2 === 0 ? 1 : -1) * w * 0.1, p.y);
    g.globalAlpha = 1;
  });
  // The koi on its way.
  const a = stops[Math.min(reached, stops.length - 1)];
  const b = stops[Math.min(reached + 1, stops.length - 1)];
  const t = reached >= stops.length - 1 ? 0 : progress;
  const kx = a.x + (b.x - a.x) * t;
  const ky = a.y + (b.y - a.y) * t;
  g.font = `${Math.round(w * 0.08)}px sans-serif`;
  g.textAlign = "center";
  g.fillText("🎏", kx, ky - w * 0.06);
}
