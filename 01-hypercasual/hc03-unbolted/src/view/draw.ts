// 2D canvas drawings: gadget blueprints (parts fill in as their bolts are tightened, finished
// gadgets come to life) and the workshop room (shelves of gadgets, eight decor spots).

import type { DecorSpot, Gadget, Part } from "../data/gadgets.ts";
import { DECOR_SPOTS, ROOMS, gadgetsOfRoom } from "../data/gadgets.ts";
import { BOLT_COLOURS } from "../data/palette.ts";

/** Size a canvas to its CSS box (at device pixel ratio, max 2) and return its context and size. */
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

function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = (s: number) => Math.min(255, Math.max(0, Math.round(((n >> s) & 255) * f)));
  return `rgb(${c(16)},${c(8)},${c(0)})`;
}

function partPath(g: CanvasRenderingContext2D, p: Part, spin = 0): Path2D {
  const v = p.v;
  const path = new Path2D();
  switch (p.k) {
    case "rect":
      path.rect(v[0], v[1], v[2], v[3]);
      break;
    case "round":
      path.roundRect(v[0], v[1], v[2], v[3], Math.min(v[2], v[3]) * 0.3);
      break;
    case "bar":
      path.roundRect(v[0], v[1], v[2], v[3], Math.min(v[2], v[3]) / 2);
      break;
    case "circle":
    case "wheel":
      path.arc(v[0], v[1], v[2], 0, Math.PI * 2);
      break;
    case "ring":
      path.arc(v[0], v[1], v[2], 0, Math.PI * 2);
      path.arc(v[0], v[1], v[2] * 0.62, 0, Math.PI * 2, true);
      break;
    case "dome":
      path.arc(v[0], v[1], v[2], Math.PI, Math.PI * 2);
      path.closePath();
      break;
    case "tri":
      path.moveTo(v[0], v[1]);
      path.lineTo(v[2], v[3]);
      path.lineTo(v[4], v[5]);
      path.closePath();
      break;
    case "gear": {
      const teeth = 8;
      for (let i = 0; i <= teeth * 2; i++) {
        const a = spin + (i / (teeth * 2)) * Math.PI * 2;
        const r = i % 2 ? v[2] : v[2] * 0.78;
        const x = v[0] + Math.cos(a) * r;
        const y = v[1] + Math.sin(a) * r;
        if (i) path.lineTo(x, y);
        else path.moveTo(x, y);
      }
      path.closePath();
      path.arc(v[0], v[1], v[2] * 0.3, 0, Math.PI * 2, true);
      break;
    }
  }
  void g;
  return path;
}

function partBounds(p: Part): [number, number, number, number] {
  const v = p.v;
  if (p.k === "rect" || p.k === "round" || p.k === "bar") return [v[0], v[1], v[0] + v[2], v[1] + v[3]];
  if (p.k === "tri") return [Math.min(v[0], v[2], v[4]), Math.min(v[1], v[3], v[5]), Math.max(v[0], v[2], v[4]), Math.max(v[1], v[3], v[5])];
  if (p.k === "dome") return [v[0] - v[2], v[1] - v[2], v[0] + v[2], v[1]];
  return [v[0] - v[2], v[1] - v[2], v[0] + v[2], v[1] + v[2]];
}

export interface GadgetDrawOpts {
  /** Animation time (s) for finished gadgets; omit for a still picture. */
  t?: number;
  /** Draw the blue blueprint paper behind it. */
  paper?: boolean;
  glow?: boolean;
  /** Colour-blind: draw bolt symbols? (kept simple: not used on tiny icons) */
}

/** Draw a gadget into a box (x, y, size) on an existing context. */
export function drawGadgetAt(g: CanvasRenderingContext2D, gad: Gadget, filled: number[] | "full", x: number, y: number, size: number, opts: GadgetDrawOpts = {}): void {
  const s = size / 10;
  const full = filled === "full";
  const done = full || gad.parts.every((p, i) => (filled as number[])[i] >= p.need);
  const t = opts.t ?? 0;
  g.save();
  g.translate(x, y);
  if (opts.paper) {
    g.fillStyle = "#2f5f9a";
    g.beginPath();
    g.roundRect(0, 0, size, size, size * 0.06);
    g.fill();
    g.strokeStyle = "rgba(255,255,255,0.12)";
    g.lineWidth = 1;
    for (let i = 1; i < 10; i++) {
      g.beginPath();
      g.moveTo(i * s, 0);
      g.lineTo(i * s, size);
      g.moveTo(0, i * s);
      g.lineTo(size, i * s);
      g.stroke();
    }
  }
  g.scale(s, s);
  if (done && opts.t !== undefined) {
    if (gad.anim === "bob") g.translate(0, Math.sin(t * 3) * 0.25);
    if (gad.anim === "swing") {
      g.translate(5, 0.5);
      g.rotate(Math.sin(t * 2.4) * 0.06);
      g.translate(-5, -0.5);
    }
  }
  if (opts.glow) {
    g.shadowColor = "rgba(255,213,96,0.9)";
    g.shadowBlur = 14 / s;
  }
  gad.parts.forEach((p, i) => {
    const frac = full ? 1 : Math.min(1, (filled as number[])[i] / p.need);
    const spin = done && opts.t !== undefined && (gad.anim === "spin" || p.k === "gear") ? t * 2 : 0;
    const path = partPath(g, p, spin);
    const hex = BOLT_COLOURS[p.c].hex;
    if (frac >= 1) {
      let fill = hex;
      if (done && gad.anim === "blink" && opts.t !== undefined && (p.k === "circle" || p.k === "ring")) fill = Math.sin(t * 5 + i) > 0 ? shade(hex, 1.35) : hex;
      g.fillStyle = fill;
      g.fill(path, "evenodd");
      g.strokeStyle = shade(hex, 0.7);
      g.lineWidth = 0.12;
      g.stroke(path);
      if (p.k === "wheel") {
        const [cx, cy, r] = p.v;
        g.fillStyle = "#c9ced6";
        g.beginPath();
        g.arc(cx, cy, r * 0.45, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = "#7d848d";
        g.lineWidth = 0.1;
        for (let k = 0; k < 4; k++) {
          const a = spin + (k * Math.PI) / 2;
          g.beginPath();
          g.moveTo(cx, cy);
          g.lineTo(cx + Math.cos(a) * r * 0.45, cy + Math.sin(a) * r * 0.45);
          g.stroke();
        }
      }
    } else {
      // Unfinished: pale blueprint fill, the tightened share filled from the bottom.
      g.fillStyle = opts.paper ? "rgba(255,255,255,0.1)" : "rgba(47,95,154,0.12)";
      g.fill(path, "evenodd");
      if (frac > 0) {
        const [x0, y0, x1, y1] = partBounds(p);
        g.save();
        g.clip(path, "evenodd");
        g.fillStyle = hex;
        g.fillRect(x0, y1 - (y1 - y0) * frac, x1 - x0, (y1 - y0) * frac);
        g.restore();
      }
      g.setLineDash([0.25, 0.18]);
      g.strokeStyle = opts.paper ? "rgba(255,255,255,0.85)" : "rgba(47,95,154,0.7)";
      g.lineWidth = 0.1;
      g.stroke(path);
      g.setLineDash([]);
    }
  });
  g.restore();
}

export function drawGadget(canvas: HTMLCanvasElement, gad: Gadget, filled: number[] | "full", opts: GadgetDrawOpts = {}): void {
  const { g, w, h } = fitCanvas(canvas);
  const size = Math.min(w, h);
  drawGadgetAt(g, gad, filled, (w - size) / 2, (h - size) / 2, size, opts);
}

// ---------------------------------------------------------------- the workshop room

/** Room layout in a 16 × 10 box. Decor spots and the 8 shelf places. */
const SHELF_SLOTS: Array<[number, number]> = [
  [8.6, 1.2], [10.4, 1.2], [12.2, 1.2], [14.0, 1.2],
  [8.6, 3.6], [10.4, 3.6], [12.2, 3.6], [14.0, 3.6],
];
const SPOT_BOX: Record<DecorSpot, [number, number, number, number]> = {
  window: [0.8, 0.8, 3.4, 2.8],
  poster: [4.8, 1.0, 2.0, 2.6],
  sign: [5.0, 0.15, 3.0, 0.7],
  lamp: [1.0, 5.0, 1.4, 1.8],
  radio: [5.6, 5.4, 1.8, 1.4],
  rug: [5.0, 8.4, 6.0, 1.2],
  plant: [14.2, 6.4, 1.4, 2.6],
  stool: [11.6, 7.0, 1.4, 2.0],
};

function drawDecor(g: CanvasRenderingContext2D, spot: DecorSpot, style: number, roomIdx: number, t: number, lit: boolean): void {
  const [x, y, w, h] = SPOT_BOX[spot];
  const accent = ROOMS[roomIdx].accent;
  g.save();
  g.translate(x, y);
  switch (spot) {
    case "window": {
      g.fillStyle = "#6b4e33";
      g.fillRect(-0.12, -0.12, w + 0.24, h + 0.24);
      const sky = style === 2 ? "#1c2350" : style === 1 ? "#9fd3ef" : "#bfe3f7";
      g.fillStyle = sky;
      g.fillRect(0, 0, w, h);
      if (style === 0) {
        g.fillStyle = "#8a96a8";
        for (let i = 0; i < 6; i++) g.fillRect(0.2 + i * 0.55, h - 0.6 - ((i * 37) % 5) * 0.25, 0.45, 2);
      } else if (style === 1) {
        g.fillStyle = "#6d8f6a";
        g.beginPath();
        g.moveTo(0, h);
        g.lineTo(w * 0.35, h * 0.35);
        g.lineTo(w * 0.6, h * 0.7);
        g.lineTo(w * 0.8, h * 0.45);
        g.lineTo(w, h);
        g.fill();
        g.fillStyle = "#fff";
        g.beginPath();
        g.arc(w * 0.78, h * 0.25, 0.25, 0, Math.PI * 2);
        g.fill();
      } else {
        g.fillStyle = "#fff";
        for (let i = 0; i < 14; i++) g.fillRect(((i * 53) % 31) / 10, ((i * 29) % 25) / 10, 0.06, 0.06);
        g.fillStyle = "#f2e3a0";
        g.beginPath();
        g.arc(w * 0.75, h * 0.3, 0.35, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = "#6b4e33";
      g.fillRect(w / 2 - 0.06, 0, 0.12, h);
      g.fillRect(0, h / 2 - 0.06, w, 0.12);
      break;
    }
    case "poster": {
      const bg = ["#f3e2b8", "#1f2a52", "#ffd6e6"][style];
      g.fillStyle = bg;
      g.fillRect(0, 0, w, h);
      g.strokeStyle = "#6b4e33";
      g.lineWidth = 0.08;
      g.strokeRect(0, 0, w, h);
      g.fillStyle = accent;
      if (style === 0) {
        g.beginPath();
        for (let i = 0; i <= 16; i++) {
          const a = (i / 16) * Math.PI * 2;
          const r = i % 2 ? 0.7 : 0.55;
          g.lineTo(w / 2 + Math.cos(a) * r, h / 2 + Math.sin(a) * r);
        }
        g.fill();
      } else if (style === 1) {
        g.fillStyle = "#e8443a";
        g.beginPath();
        g.moveTo(w / 2, 0.4);
        g.lineTo(w / 2 + 0.35, 1.6);
        g.lineTo(w / 2 - 0.35, 1.6);
        g.fill();
        g.fillStyle = "#f4f1ea";
        g.fillRect(w / 2 - 0.3, 1.1, 0.6, 1);
      } else {
        g.fillStyle = "#33b25a";
        g.fillRect(w / 2 - 0.05, 1.2, 0.1, 1.1);
        g.fillStyle = "#f06aa8";
        for (let i = 0; i < 5; i++) {
          g.beginPath();
          g.arc(w / 2 + Math.cos((i * Math.PI * 2) / 5) * 0.32, 1.1 + Math.sin((i * Math.PI * 2) / 5) * 0.32, 0.22, 0, Math.PI * 2);
          g.fill();
        }
      }
      break;
    }
    case "sign": {
      const glow = lit ? 0.6 + 0.4 * Math.sin(t * 4) : 0;
      g.fillStyle = ["#33363d", "#8a5b37", "#9fb6cc"][style];
      g.beginPath();
      g.roundRect(0, 0, w, h, 0.15);
      g.fill();
      g.font = `bold ${h * 0.62}px sans-serif`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillStyle = lit ? (style === 0 ? `rgba(255,80,140,${0.6 + glow * 0.4})` : "#ffe9a0") : "rgba(255,255,255,0.35)";
      if (lit && style === 0) {
        g.shadowColor = "#ff5a9a";
        g.shadowBlur = 0.4 + glow * 0.6;
      }
      g.fillText("OPEN", w / 2, h / 2 + 0.03);
      break;
    }
    case "lamp": {
      if (style === 0) {
        g.fillStyle = "#33363d";
        g.fillRect(0.6, 1.2, 0.2, 0.6);
        g.fillRect(0.3, 1.7, 0.8, 0.12);
        g.fillStyle = accent;
        g.beginPath();
        g.moveTo(0.1, 1.2);
        g.lineTo(1.3, 1.2);
        g.lineTo(0.95, 0.4);
        g.lineTo(0.45, 0.4);
        g.fill();
      } else if (style === 1) {
        g.fillStyle = "#c9ced6";
        g.fillRect(0.45, 1.5, 0.5, 0.3);
        g.fillStyle = "#8a4fd8";
        g.beginPath();
        g.roundRect(0.45, 0.2, 0.5, 1.3, 0.25);
        g.fill();
        g.fillStyle = "#f58a1f";
        const b = Math.sin(t * 1.5) * 0.3;
        g.beginPath();
        g.arc(0.7, 0.9 + b, 0.13, 0, Math.PI * 2);
        g.arc(0.66, 0.5 - b * 0.6, 0.09, 0, Math.PI * 2);
        g.fill();
      } else {
        g.strokeStyle = "#33363d";
        g.lineWidth = 0.06;
        g.beginPath();
        g.moveTo(0.7, -5);
        g.lineTo(0.7, 0.4);
        g.stroke();
        g.fillStyle = "#f5c518";
        g.beginPath();
        g.arc(0.7, 0.7, 0.45, Math.PI, Math.PI * 2);
        g.fill();
        g.fillStyle = "rgba(255,240,180,0.35)";
        g.beginPath();
        g.moveTo(0.3, 0.7);
        g.lineTo(1.1, 0.7);
        g.lineTo(1.6, 1.8);
        g.lineTo(-0.2, 1.8);
        g.fill();
      }
      break;
    }
    case "radio": {
      g.fillStyle = ["#9a5b2e", "#33363d", "#14b3b0"][style];
      g.beginPath();
      g.roundRect(0, 0.3, w, h - 0.3, 0.2);
      g.fill();
      g.fillStyle = "#f4f1ea";
      g.beginPath();
      g.arc(w * 0.32, h * 0.62, 0.32, 0, Math.PI * 2);
      g.fill();
      if (style === 1) {
        g.beginPath();
        g.arc(w * 0.75, h * 0.62, 0.32, 0, Math.PI * 2);
        g.fill();
      } else {
        g.fillStyle = "#f5c518";
        g.fillRect(w * 0.6, h * 0.45, 0.5, 0.18);
      }
      g.strokeStyle = "#33363d";
      g.lineWidth = 0.05;
      g.beginPath();
      g.moveTo(w * 0.8, 0.3);
      g.lineTo(w * 1.05, -0.4);
      g.stroke();
      break;
    }
    case "rug": {
      g.fillStyle = [accent, "#2f7fe0", "#e8443a"][style];
      g.beginPath();
      if (style === 0) g.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
      else g.roundRect(0, 0, w, h, 0.1);
      g.fill();
      g.fillStyle = "rgba(255,255,255,0.35)";
      if (style === 1) for (let i = 0; i < 5; i++) g.fillRect(0.3 + i * 1.2, 0, 0.4, h);
      if (style === 2) for (let i = 0; i < 10; i++) for (let j = 0; j < 2; j++) if ((i + j) % 2) g.fillRect(i * 0.6, j * 0.6, 0.6, 0.6);
      break;
    }
    case "plant": {
      g.fillStyle = "#c46a3a";
      g.beginPath();
      g.moveTo(0.2, 1.8);
      g.lineTo(1.2, 1.8);
      g.lineTo(1.0, 2.6);
      g.lineTo(0.4, 2.6);
      g.fill();
      g.fillStyle = "#33b25a";
      if (style === 0) {
        g.beginPath();
        g.roundRect(0.5, 0.2, 0.4, 1.6, 0.2);
        g.roundRect(0.15, 0.8, 0.3, 0.6, 0.15);
        g.roundRect(0.95, 0.6, 0.3, 0.7, 0.15);
        g.fill();
      } else if (style === 1) {
        for (let i = 0; i < 6; i++) {
          g.beginPath();
          g.ellipse(0.7 + Math.cos(i) * 0.4, 1.1 - Math.abs(Math.sin(i * 1.7)) * 0.7, 0.45, 0.14, i, 0, Math.PI * 2);
          g.fill();
        }
      } else {
        g.fillRect(0.66, 0.6, 0.08, 1.2);
        g.fillStyle = "#f5c518";
        g.beginPath();
        g.arc(0.7, 0.5, 0.45, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = "#9a5b2e";
        g.beginPath();
        g.arc(0.7, 0.5, 0.2, 0, Math.PI * 2);
        g.fill();
      }
      break;
    }
    case "stool": {
      g.fillStyle = ["#b27a45", "#8d96a3", "#e8443a"][style];
      g.beginPath();
      g.roundRect(0, 0, w, 0.35, 0.12);
      g.fill();
      g.fillStyle = style === 1 ? "#5b636d" : "#7d522b";
      g.fillRect(0.15, 0.35, 0.15, h - 0.35);
      g.fillRect(w - 0.3, 0.35, 0.15, h - 0.35);
      g.fillRect(0.15, h * 0.65, w - 0.3, 0.1);
      break;
    }
  }
  g.restore();
}

export interface RoomDrawOpts {
  t?: number;
  /** Highlight a decor spot (just placed). */
  highlight?: DecorSpot | null;
  /** Show empty decor spots as dashed boxes. */
  showEmpty?: boolean;
}

/**
 * The workshop room: wall, floor, window, shelves with the room's 8 gadgets (finished ones drawn,
 * others as blueprint ghosts), the workbench, and the placed decor.
 */
export function drawRoom(canvas: HTMLCanvasElement, roomIdx: number, finished: string[], decor: Record<string, number>, opts: RoomDrawOpts = {}): void {
  const { g, w, h } = fitCanvas(canvas);
  const room = ROOMS[roomIdx];
  const s = Math.min(w / 16, h / 10);
  const t = opts.t ?? 0;
  g.save();
  g.translate((w - 16 * s) / 2, (h - 10 * s) / 2);
  g.scale(s, s);
  // Wall and floor.
  g.fillStyle = room.wall;
  g.fillRect(0, 0, 16, 7.2);
  g.fillStyle = room.floor;
  g.fillRect(0, 7.2, 16, 2.8);
  g.fillStyle = "rgba(0,0,0,0.12)";
  g.fillRect(0, 7.1, 16, 0.12);
  // Shelves.
  g.fillStyle = "#8a5b37";
  g.fillRect(7.8, 2.85, 7.8, 0.22);
  g.fillRect(7.8, 5.25, 7.8, 0.22);
  const gadgets = gadgetsOfRoom(roomIdx);
  const lit = gadgets.every((gd) => finished.includes(gd.id)) && DECOR_SPOTS.every((sp) => decor[sp] !== undefined);
  gadgets.forEach((gd, i) => {
    const [sx, sy] = SHELF_SLOTS[i];
    const own = finished.includes(gd.id);
    if (own) drawGadgetAt(g, gd, "full", sx - 0.85, sy - 0.15, 1.7, { t: t + i });
    else {
      g.globalAlpha = 0.35;
      drawGadgetAt(g, gd, gd.parts.map(() => 0), sx - 0.85, sy - 0.15, 1.7);
      g.globalAlpha = 1;
    }
  });
  // Workbench.
  g.fillStyle = "#b27a45";
  g.fillRect(0.4, 6.8, 7.4, 0.35);
  g.fillStyle = "#7d522b";
  g.fillRect(0.7, 7.15, 0.3, 1.9);
  g.fillRect(7.2, 7.15, 0.3, 1.9);
  // Decor.
  for (const spot of DECOR_SPOTS) {
    const style = decor[spot];
    if (style !== undefined) drawDecor(g, spot, style, roomIdx, t, lit);
    else if (opts.showEmpty) {
      const [x, y, bw, bh] = SPOT_BOX[spot];
      g.setLineDash([0.15, 0.12]);
      g.strokeStyle = "rgba(0,0,0,0.3)";
      g.lineWidth = 0.06;
      g.strokeRect(x, y, bw, bh);
      g.setLineDash([]);
      g.fillStyle = "rgba(0,0,0,0.3)";
      g.font = `bold 0.5px sans-serif`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText("?", x + bw / 2, y + bh / 2);
    }
    if (opts.highlight === spot) {
      const [x, y, bw, bh] = SPOT_BOX[spot];
      g.strokeStyle = `rgba(255,200,60,${0.6 + 0.4 * Math.sin(t * 6)})`;
      g.lineWidth = 0.12;
      g.strokeRect(x - 0.15, y - 0.15, bw + 0.3, bh + 0.3);
    }
  }
  g.restore();
}

/** A single decor style preview (for the Decor Crate choice and restyle menu). */
export function drawDecorPreview(canvas: HTMLCanvasElement, spot: DecorSpot, style: number, roomIdx: number): void {
  const { g, w, h } = fitCanvas(canvas);
  const [, , bw, bh] = SPOT_BOX[spot];
  const box = Math.max(bw, bh) + 0.6;
  const s = Math.min(w, h) / box;
  g.fillStyle = ROOMS[roomIdx].wall;
  g.fillRect(0, 0, w, h);
  g.save();
  g.translate(w / 2 - (bw * s) / 2, h / 2 - (bh * s) / 2);
  g.scale(s, s);
  const [x, y] = SPOT_BOX[spot];
  g.translate(-x, -y);
  drawDecor(g, spot, style, roomIdx, 0, true);
  g.restore();
}
