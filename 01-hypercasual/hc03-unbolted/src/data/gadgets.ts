// Gadgets and workshop rooms (DESIGN.md §4 Progression). Each gadget is a blueprint made of parts.
// Every part has a bolt colour and a number of bolts it needs; a closed toolbox of that colour
// tightens one. A part fills in as its bolts go in, and a finished gadget comes to life.
//
// Drawings use a 10 × 10 box (y down). Colours are palette indices (palette.ts).

export type PartKind = "rect" | "round" | "circle" | "ring" | "tri" | "wheel" | "gear" | "bar" | "dome";

export interface Part {
  k: PartKind;
  /** rect/round/bar: x, y, w, h. circle/ring/wheel/gear/dome: cx, cy, r. tri: x1, y1, x2, y2, x3, y3. */
  v: number[];
  c: number;
  need: number;
}

export interface Gadget {
  id: string;
  name: string;
  room: number;
  /** How it comes to life: spin wheels/gears, bob up and down, swing a pendulum, blink lights. */
  anim: "spin" | "bob" | "swing" | "blink";
  parts: Part[];
}

export interface Room {
  id: string;
  wall: string;
  floor: string;
  accent: string;
}

export const ROOMS: Room[] = [
  { id: "garage", wall: "#c9d3dc", floor: "#8b8f96", accent: "#f58a1f" },
  { id: "toyshop", wall: "#ffe3ee", floor: "#d9b48c", accent: "#f06aa8" },
  { id: "clock", wall: "#e9dcc0", floor: "#8a5b37", accent: "#d4af37" },
  { id: "ship", wall: "#d4eef0", floor: "#b9a383", accent: "#14b3b0" },
  { id: "space", wall: "#2b3560", floor: "#1a1f3a", accent: "#8fa2ff" },
];

// Part builders (need is filled in by `finish`).
const R = (x: number, y: number, w: number, h: number, c: number): Part => ({ k: "rect", v: [x, y, w, h], c, need: 0 });
const Rd = (x: number, y: number, w: number, h: number, c: number): Part => ({ k: "round", v: [x, y, w, h], c, need: 0 });
const O = (x: number, y: number, r: number, c: number): Part => ({ k: "circle", v: [x, y, r], c, need: 0 });
const Ring = (x: number, y: number, r: number, c: number): Part => ({ k: "ring", v: [x, y, r], c, need: 0 });
const W = (x: number, y: number, r: number, c: number): Part => ({ k: "wheel", v: [x, y, r], c, need: 0 });
const G = (x: number, y: number, r: number, c: number): Part => ({ k: "gear", v: [x, y, r], c, need: 0 });
const T = (x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, c: number): Part => ({ k: "tri", v: [x1, y1, x2, y2, x3, y3], c, need: 0 });
const Bar = (x: number, y: number, w: number, h: number, c: number): Part => ({ k: "bar", v: [x, y, w, h], c, need: 0 });
const D = (x: number, y: number, r: number, c: number): Part => ({ k: "dome", v: [x, y, r], c, need: 0 });

/** Part sizes, for sharing out a gadget's bolts. */
function partArea(p: Part): number {
  const v = p.v;
  switch (p.k) {
    case "rect":
    case "round":
    case "bar":
      return v[2] * v[3];
    case "tri":
      return Math.abs((v[2] - v[0]) * (v[5] - v[1]) - (v[4] - v[0]) * (v[3] - v[1])) / 2;
    case "dome":
      return (Math.PI * v[2] * v[2]) / 2;
    default:
      return Math.PI * v[2] * v[2];
  }
}

/** Share `total` bolts over the parts by size (at least 3 each). */
function finish(g: Omit<Gadget, "parts"> & { parts: Part[] }, total: number): Gadget {
  const areas = g.parts.map((p) => Math.sqrt(partArea(p)));
  const sum = areas.reduce((a, b) => a + b, 0);
  let left = total;
  g.parts.forEach((p, i) => {
    p.need = Math.max(3, Math.round((areas[i] / sum) * total));
    left -= p.need;
  });
  // Put any rounding difference on the biggest part.
  const big = areas.indexOf(Math.max(...areas));
  g.parts[big].need = Math.max(3, g.parts[big].need + left);
  return g;
}

// 0 red, 1 blue, 2 yellow, 3 green, 4 orange, 5 purple, 6 pink, 7 teal, 8 white, 9 black, 10 lime, 11 brown
const RAW: Array<[string, string, number, Gadget["anim"], Part[]]> = [
  // ---- Garage: vehicles
  ["gokart", "Go-Kart", 0, "spin", [Rd(1.5, 5, 7, 2, 0), Bar(3.5, 3, 0.6, 2.2, 9), O(3.8, 3.2, 0.8, 2), Rd(6.8, 4.2, 1.6, 0.9, 9), W(2.6, 7.6, 1.2, 9), W(7.4, 7.6, 1.2, 9)]],
  ["scooter", "Scooter", 0, "spin", [Bar(2, 6.5, 6, 0.9, 1), Bar(7.2, 2, 0.6, 4.8, 8), Rd(6.4, 1.6, 2.4, 0.6, 9), W(2.4, 7.8, 1, 9), W(7.6, 7.8, 1, 9), O(7.5, 3.2, 0.5, 2)]],
  ["tractor", "Tractor", 0, "spin", [Rd(1.2, 4, 5, 2.6, 3), Rd(4.5, 1.6, 3, 3, 3), R(5, 2, 2, 1.6, 8), Bar(2, 2.4, 0.5, 1.8, 9), W(6.2, 7, 2, 9), W(2.2, 7.6, 1.2, 9), O(1.4, 4.8, 0.4, 2)]],
  ["racer", "Race Car", 0, "spin", [Rd(0.8, 5, 8.4, 1.8, 0), D(5, 5, 1.6, 1), R(0.6, 3.8, 1.4, 1.2, 9), T(8, 5, 9.4, 5.6, 8, 6.4, 2), W(2.4, 7.4, 1.1, 9), W(7.4, 7.4, 1.1, 9)]],
  ["motorbike", "Motorbike", 0, "spin", [Rd(3, 4.6, 4, 1.8, 5), Rd(4, 3.6, 2.2, 1, 9), Bar(7, 2.6, 0.5, 2.6, 8), O(7.4, 3, 0.5, 2), W(2.2, 7.2, 1.5, 9), W(7.8, 7.2, 1.5, 9)]],
  ["truck", "Tow Truck", 0, "spin", [Rd(4.6, 3, 4, 3.6, 4), R(5.2, 3.6, 2.6, 1.4, 8), Rd(0.8, 4.4, 4, 2.2, 4), Bar(0.6, 2, 0.5, 2.6, 9), T(0.6, 2, 2.2, 2, 0.6, 3, 9), W(2.2, 7.4, 1.2, 9), W(7, 7.4, 1.2, 9)]],
  ["bulldozer", "Bulldozer", 0, "spin", [Rd(2.4, 3.6, 4.6, 3, 2), R(3.4, 1.6, 2.4, 2.2, 8), Rd(1.6, 6.4, 6.4, 1.8, 9), T(7.6, 4, 9.6, 5, 7.6, 7.4, 11), O(3, 7.3, 0.6, 2), O(6.6, 7.3, 0.6, 2)]],
  ["camper", "Camper Van", 0, "spin", [Rd(0.8, 3, 8.4, 4, 7), Rd(1, 1.6, 8, 1.6, 8), R(1.6, 3.8, 2, 1.4, 1), R(4.4, 3.8, 2, 1.4, 1), R(7.2, 3.8, 1.4, 2.4, 8), W(2.6, 7.6, 1.1, 9), W(7.2, 7.6, 1.1, 9)]],
  // ---- Toy shop
  ["robot", "Robot Pal", 1, "bob", [Rd(3, 4, 4, 3.6, 0), Rd(3.4, 1.4, 3.2, 2.4, 8), O(4.4, 2.6, 0.4, 1), O(5.6, 2.6, 0.4, 1), Bar(4.8, 0.2, 0.4, 1.2, 9), Bar(1.6, 4.4, 1.2, 2.6, 2), Bar(7.2, 4.4, 1.2, 2.6, 2), Bar(3.6, 7.6, 1, 2, 9), Bar(5.4, 7.6, 1, 2, 9)]],
  ["jackbox", "Jack-in-the-Box", 1, "bob", [R(2.4, 5.4, 5.2, 4, 0), Ring(5, 3.6, 1.4, 2), O(5, 1.6, 1.3, 6), T(3.6, 1, 5, -0.4, 6.4, 1, 1), R(2.2, 5, 5.6, 0.6, 1)]],
  ["top", "Spinning Top", 1, "spin", [T(1.6, 4, 8.4, 4, 5, 9, 5), Rd(2, 3, 6, 1.4, 2), Bar(4.6, 0.6, 0.8, 2.6, 11), O(5, 3.7, 0.5, 6)]],
  ["mouse", "Wind-up Mouse", 1, "spin", [D(5, 6.6, 3.2, 8), O(2.4, 5.6, 0.9, 6), O(7.4, 4.4, 0.6, 9), G(5.4, 3, 1, 2), Bar(8, 5.8, 1.6, 0.4, 6), W(3.6, 7.4, 0.6, 9), W(6.4, 7.4, 0.6, 9)]],
  ["horse", "Rocking Horse", 1, "swing", [Rd(2.4, 3.6, 4.8, 2.2, 11), Rd(6.4, 1.6, 2, 3, 11), T(7, 1.6, 7.6, 0.6, 8, 1.6, 9), Bar(3, 5.6, 0.6, 2.2, 11), Bar(6, 5.6, 0.6, 2.2, 11), Rd(1, 7.6, 8, 0.8, 0), R(3.2, 3.2, 2, 0.6, 1)]],
  ["train", "Toy Train", 1, "spin", [Rd(1, 3.6, 4.6, 3, 1), R(1.2, 1.6, 2.2, 2.2, 0), Bar(4.4, 1.8, 0.8, 1.8, 9), Rd(5.8, 4.4, 3.4, 2.2, 2), W(2, 7.2, 0.9, 9), W(4.4, 7.2, 0.9, 9), W(7.4, 7.2, 0.9, 9)]],
  ["musicbox", "Music Box", 1, "spin", [R(1.6, 4.6, 6.8, 4, 6), Rd(1.4, 3.8, 7.2, 1, 5), O(5, 2.6, 1.2, 8), Bar(4.8, 1.2, 0.4, 1.6, 2), G(8.8, 6.4, 0.9, 2)]],
  ["yoyo", "Yo-Yo Bot", 1, "bob", [O(5, 6, 2.4, 3), Ring(5, 6, 1.4, 10), Bar(4.8, 0.4, 0.4, 3.4, 8), O(5, 1.4, 0.8, 0), D(5, 8.4, 1.2, 9)]],
  // ---- Clockmaker
  ["cuckoo", "Cuckoo Clock", 2, "swing", [Rd(2.4, 2.4, 5.2, 4.6, 11), T(1.6, 2.6, 5, 0, 8.4, 2.6, 11), Ring(5, 4.6, 1.5, 8), O(5, 4.6, 0.3, 9), Bar(4.8, 7, 0.4, 2, 2), O(5, 9.2, 0.7, 2)]],
  ["alarm", "Alarm Clock", 2, "blink", [O(5, 5.2, 3, 0), Ring(5, 5.2, 2.2, 8), D(2.8, 2.6, 1, 2), D(7.2, 2.6, 1, 2), Bar(2.6, 8, 0.6, 1.4, 9), Bar(6.8, 8, 0.6, 1.4, 9)]],
  ["grandfather", "Grandfather Clock", 2, "swing", [Rd(3, 0.6, 4, 3.6, 11), Ring(5, 2.4, 1.3, 2), R(3.4, 4.2, 3.2, 4.4, 11), Bar(4.8, 4.6, 0.4, 2.6, 2), O(5, 7.4, 0.6, 2), R(2.6, 8.6, 4.8, 1, 9)]],
  ["pocketwatch", "Pocket Watch", 2, "blink", [O(5, 5.6, 3.4, 2), Ring(5, 5.6, 2.6, 8), Ring(5, 1.6, 0.9, 2), Bar(4.7, 2.2, 0.6, 0.6, 2), G(5, 5.6, 1, 11)]],
  ["metronome", "Metronome", 2, "swing", [T(2, 9, 8, 9, 5, 0.6, 11), R(3.6, 6, 2.8, 2.2, 8), Bar(4.8, 1.6, 0.4, 5, 9), Rd(4.3, 3, 1.4, 0.8, 2)]],
  ["gramophone", "Gramophone", 2, "spin", [R(1.4, 6, 5.6, 3, 11), O(4.2, 5.6, 2.2, 9), T(5.6, 4.4, 9.4, 0.6, 9.6, 4.8, 2), Bar(6, 3.6, 0.6, 2.4, 2)]],
  ["typewriter", "Typewriter", 2, "blink", [Rd(1, 4.6, 8, 4.2, 9), Rd(1.6, 2.6, 6.8, 2.4, 3), R(2.4, 1.2, 5.2, 1.6, 8), O(3, 6.4, 0.5, 8), O(5, 6.4, 0.5, 8), O(7, 6.4, 0.5, 8)]],
  ["camera", "Box Camera", 2, "blink", [Rd(1.4, 3, 7.2, 5, 9), Ring(5, 5.6, 1.8, 8), O(5, 5.6, 1, 1), R(6.6, 1.8, 1.6, 1.4, 2), O(2.6, 4, 0.5, 0)]],
  // ---- Shipyard
  ["tugboat", "Tugboat", 3, "bob", [T(0.6, 6, 9.4, 6, 8.2, 8.6, 0), R(1.4, 6, 7.4, 2.6, 0), Rd(3, 3.6, 3.6, 2.6, 8), Bar(4.2, 1.2, 1, 2.6, 9), O(4.7, 1, 0.6, 8), O(2, 7.2, 0.6, 2)]],
  ["sailboat", "Sailboat", 3, "bob", [Rd(1, 6.6, 8, 1.8, 1), Bar(4.8, 0.6, 0.4, 6.2, 11), T(5.2, 0.8, 5.2, 6, 8.6, 6, 8), T(4.8, 1.6, 4.8, 6, 1.8, 6, 0)]],
  ["submarine", "Submarine", 3, "bob", [Rd(1, 4, 8, 3.2, 2), Rd(3.8, 2.4, 2.4, 1.8, 2), Bar(5.6, 0.6, 0.4, 2, 9), O(3, 5.6, 0.6, 7), O(5, 5.6, 0.6, 7), O(7, 5.6, 0.6, 7), G(0.8, 5.6, 0.9, 9)]],
  ["lighthouse", "Lighthouse", 3, "blink", [T(2.6, 9.4, 7.4, 9.4, 5, 2.4, 8), R(3.6, 5, 2.8, 1, 0), R(3.9, 7.4, 2.2, 1, 0), Rd(3.6, 1.2, 2.8, 1.4, 2), T(3.2, 1.2, 6.8, 1.2, 5, 0, 0)]],
  ["paddle", "Paddle Steamer", 3, "spin", [Rd(0.8, 5.6, 8.4, 2, 8), R(2, 3.6, 5, 2, 0), Bar(3, 1, 0.8, 2.6, 9), Bar(5.4, 1.4, 0.8, 2.2, 9), W(7.8, 6.6, 1.6, 0)]],
  ["ferry", "Ferry", 3, "bob", [T(0.4, 5, 9.6, 5, 8.6, 8, 1), R(1.2, 5, 7.4, 3, 1), Rd(2, 3, 6.2, 2.2, 8), R(3, 1.6, 3.2, 1.6, 8), Bar(5.6, 0.4, 0.6, 1.4, 2)]],
  ["fishing", "Fishing Boat", 3, "bob", [T(0.6, 6.2, 9.4, 6.2, 8, 8.6, 3), R(1.4, 6.2, 7, 2.4, 3), R(5.6, 3.4, 2.6, 2.8, 8), Bar(3, 1, 0.4, 5.2, 11), Bar(0.6, 1.4, 2.8, 0.3, 11)]],
  ["buoy", "Signal Buoy", 3, "blink", [D(5, 8, 3.4, 0), R(3.4, 4, 3.2, 4, 8), R(3.4, 5.4, 3.2, 1, 0), T(3.6, 4, 6.4, 4, 5, 1.6, 9), O(5, 1.2, 0.8, 2)]],
  // ---- Space hangar
  ["rocket", "Rocket", 4, "bob", [Rd(3.6, 2.4, 2.8, 5.6, 8), T(3.6, 2.6, 6.4, 2.6, 5, 0, 0), O(5, 4, 0.8, 1), T(3.6, 6, 3.6, 8.6, 1.8, 8.6, 0), T(6.4, 6, 6.4, 8.6, 8.2, 8.6, 0), T(4.2, 8, 5.8, 8, 5, 9.8, 4)]],
  ["satellite", "Satellite", 4, "spin", [Rd(3.6, 3.6, 2.8, 2.8, 2), R(0.4, 4.2, 3, 1.6, 1), R(6.6, 4.2, 3, 1.6, 1), D(5, 3.6, 1.4, 8), Bar(4.8, 6.4, 0.4, 1.6, 9)]],
  ["rover", "Moon Rover", 4, "spin", [Rd(1.2, 4, 7.6, 2.4, 8), Rd(2.4, 2.6, 3.4, 1.6, 7), Bar(7, 1.2, 0.4, 2.8, 9), Ring(7.2, 1.2, 0.7, 9), W(2.2, 7.2, 1, 9), W(5, 7.2, 1, 9), W(7.8, 7.2, 1, 9)]],
  ["lander", "Lunar Lander", 4, "bob", [Rd(3, 2.4, 4, 3.2, 2), D(5, 2.4, 1.6, 8), R(2.6, 5.6, 4.8, 1, 9), T(3, 6.6, 1.2, 9.2, 2, 9.2, 9), T(7, 6.6, 8.8, 9.2, 8, 9.2, 9), T(4.2, 6.6, 5.8, 6.6, 5, 8.4, 4)]],
  ["station", "Space Module", 4, "spin", [Rd(2, 3.8, 6, 2.4, 8), O(5, 5, 1, 1), R(0.2, 3, 1.8, 4, 1), R(8, 3, 1.8, 4, 1), G(5, 1.8, 1.1, 2), D(5, 8.6, 1.2, 0)]],
  ["telescope", "Star Telescope", 4, "blink", [Bar(1.4, 3, 7, 1.6, 1), Ring(8.6, 3.8, 1, 2), T(3.2, 9, 6.8, 9, 5, 4.4, 9), O(5, 4.4, 0.6, 8)]],
  ["ufo", "Saucer", 4, "bob", [Rd(0.8, 4.6, 8.4, 1.8, 8), D(5, 4.6, 2.2, 7), O(2.2, 5.5, 0.4, 2), O(5, 5.5, 0.4, 0), O(7.8, 5.5, 0.4, 3), T(3.6, 6.4, 6.4, 6.4, 5, 9.4, 10)]],
  ["astrobot", "Astro-Bot", 4, "bob", [O(5, 2.6, 2, 8), Ring(5, 2.6, 1.3, 1), Rd(3, 4.6, 4, 3.2, 8), R(4, 5.2, 2, 1.4, 0), Bar(1.6, 5, 1.2, 2.4, 8), Bar(7.2, 5, 1.2, 2.4, 8), Bar(3.6, 7.8, 1, 1.8, 9), Bar(5.4, 7.8, 1, 1.8, 9)]],
];

/**
 * Bolts a gadget needs. Tuned with tools/simulate.ts: levels close ~10 boxes but only the gadget's
 * colours count, so ~30-44 bolts makes a gadget take about 10 levels (the first one ~level 20).
 */
function totalFor(index: number): number {
  return 30 + Math.min(14, index);
}

export const GADGETS: Gadget[] = RAW.map(([id, name, room, anim, parts], i) => finish({ id, name, room, anim, parts }, totalFor(i)));

export function gadgetsOfRoom(r: number): Gadget[] {
  return GADGETS.filter((g) => g.room === r);
}

// ---------------------------------------------------------------- decor

export const DECOR_SPOTS = ["lamp", "rug", "poster", "radio", "plant", "stool", "window", "sign"] as const;
export type DecorSpot = (typeof DECOR_SPOTS)[number];
/** Three styles per spot (ids are `${spot}_${style}`). */
export const DECOR_STYLES = 3;

export function decorId(spot: DecorSpot, style: number): string {
  return `${spot}_${style}`;
}
