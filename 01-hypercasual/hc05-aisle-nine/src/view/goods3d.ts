// Low-poly goods built from three.js primitives (DESIGN.md §2). Every good is one merged geometry with
// vertex colours, sitting on y = 0, centred on x/z, about 0.5-0.85 tall and at most 0.8 wide, facing +z.
// Geometries are built once per good and shared by every copy on the stand.

import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { GOODS } from "../data/goods.ts";

type Part = THREE.BufferGeometry;
const C = new THREE.Color();

function paint(g: THREE.BufferGeometry, hex: string): Part {
  const geo = g.index ? g.toNonIndexed() : g;
  geo.deleteAttribute("uv");
  C.set(hex);
  const n = geo.getAttribute("position").count;
  const cols = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    cols[i * 3] = C.r;
    cols[i * 3 + 1] = C.g;
    cols[i * 3 + 2] = C.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(cols, 3));
  return geo;
}

interface At {
  x?: number;
  y?: number;
  z?: number;
  rx?: number;
  ry?: number;
  rz?: number;
  sx?: number;
  sy?: number;
  sz?: number;
}

function place(g: THREE.BufferGeometry, a: At = {}): THREE.BufferGeometry {
  if (a.sx || a.sy || a.sz) g.scale(a.sx ?? 1, a.sy ?? 1, a.sz ?? 1);
  if (a.rx) g.rotateX(a.rx);
  if (a.ry) g.rotateY(a.ry);
  if (a.rz) g.rotateZ(a.rz);
  g.translate(a.x ?? 0, a.y ?? 0, a.z ?? 0);
  return g;
}

const box = (w: number, h: number, d: number, col: string, a: At = {}) => paint(place(new THREE.BoxGeometry(w, h, d), { ...a, y: (a.y ?? 0) + h / 2 }), col);
const cyl = (rt: number, rb: number, h: number, col: string, a: At = {}, seg = 10) => paint(place(new THREE.CylinderGeometry(rt, rb, h, seg), { ...a, y: (a.y ?? 0) + h / 2 }), col);
const sph = (r: number, col: string, a: At = {}, seg = 10) => paint(place(new THREE.SphereGeometry(r, seg, Math.max(6, Math.round(seg * 0.7))), a), col);
const tor = (R: number, r: number, col: string, a: At = {}, arc = Math.PI * 2) => paint(place(new THREE.TorusGeometry(R, r, 6, 14, arc), a), col);
const cone = (r: number, h: number, col: string, a: At = {}, seg = 10) => paint(place(new THREE.ConeGeometry(r, h, seg), { ...a, y: (a.y ?? 0) + h / 2 }), col);
const lathe = (pts: Array<[number, number]>, col: string, a: At = {}, seg = 12) => paint(place(new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg), a), col);

type Builder = (c: [string, string, string]) => Part[];

const B: Record<string, Builder> = {
  apple: ([a, b, c]) => [sph(0.3, a, { y: 0.29, sy: 0.92 }), cyl(0.025, 0.025, 0.12, b, { y: 0.52 }, 5), sph(0.08, c, { x: 0.08, y: 0.6, sz: 0.4, sy: 0.6, rz: -0.6 }, 6)],
  lemon: ([a, b, c]) => [sph(0.24, a, { y: 0.24, sx: 1.35 }), sph(0.06, b, { x: 0.33, y: 0.24 }, 6), sph(0.07, c, { x: -0.12, y: 0.44, sz: 0.4, rz: 0.5 }, 6)],
  carton: ([a, b, c]) => [box(0.42, 0.62, 0.42, a), box(0.43, 0.2, 0.43, b, { y: 0.2 }), paint(place(new THREE.CylinderGeometry(0.0, 0.3, 0.16, 4, 1), { ry: Math.PI / 4, y: 0.7, sz: 0.7 }), c)],
  tallbox: ([a, b, c]) => [box(0.52, 0.82, 0.22, a), box(0.4, 0.3, 0.23, c, { y: 0.32 }), sph(0.09, b, { y: 0.47, z: 0.12, sz: 0.3 }, 8)],
  can: ([a, b, c]) => [cyl(0.24, 0.24, 0.5, a, {}, 14), cyl(0.245, 0.245, 0.2, b, { y: 0.15 }, 14), cyl(0.22, 0.24, 0.04, c, { y: 0.5 }, 14)],
  jar: ([a, b, c]) => [lathe([[0, 0], [0.24, 0], [0.27, 0.08], [0.27, 0.42], [0.22, 0.5], [0, 0.5]], a, {}, 12), cyl(0.23, 0.23, 0.1, c, { y: 0.5 }, 12), box(0.3, 0.16, 0.05, b, { y: 0.17, z: 0.25 })],
  bottle: ([a, b, c]) => [lathe([[0, 0], [0.2, 0], [0.21, 0.42], [0.1, 0.58], [0.08, 0.7], [0, 0.7]], a, {}, 12), cyl(0.085, 0.085, 0.08, b, { y: 0.7 }, 8), box(0.3, 0.16, 0.05, c, { y: 0.16, z: 0.19 })],
  eggbox: ([a, b]) => [box(0.72, 0.18, 0.4, a), ...[-0.22, 0, 0.22].map((x) => sph(0.11, b, { x, y: 0.24, sy: 1.25 }, 8))],
  loaf: ([a, b, c]) => [box(0.72, 0.28, 0.4, a), cyl(0.2, 0.2, 0.72, b, { rz: Math.PI / 2, x: 0.36, y: 0.26 }, 12), box(0.04, 0.05, 0.42, c, { x: -0.15, y: 0.44 }), box(0.04, 0.05, 0.42, c, { x: 0.15, y: 0.44 })].map((g, i) => (i === 1 ? place(g, { y: 0, x: -0.36 }) : g)),
  baguette: ([a, b, c]) => [paint(place(new THREE.CapsuleGeometry(0.11, 0.5, 4, 8), { rz: Math.PI / 2 - 0.25, y: 0.2 }), a), box(0.06, 0.04, 0.2, c, { y: 0.3, x: -0.1, ry: 0.3 }), box(0.06, 0.04, 0.2, c, { y: 0.24, x: 0.12, ry: 0.3 }), sph(0.02, b, { y: 0.1 }, 4)],
  croissant: ([a, b]) => [tor(0.2, 0.11, a, { rx: Math.PI / 2, y: 0.12 }, Math.PI * 1.25), sph(0.13, b, { x: 0, y: 0.13, z: 0.2, sx: 1.2 }, 8)],
  cupcake: ([a, b, c]) => [cyl(0.24, 0.17, 0.26, b, {}, 10), sph(0.25, a, { y: 0.3, sy: 0.75 }, 10), sph(0.07, c, { y: 0.5 }, 6)],
  donut: ([a, b, c]) => [tor(0.22, 0.11, a, { rx: Math.PI / 2 - 0.5, y: 0.26 }), tor(0.22, 0.09, b, { rx: Math.PI / 2 - 0.5, y: 0.29, z: 0.025 }), box(0.08, 0.02, 0.02, c, { x: 0.1, y: 0.42, z: 0.12, rz: 0.4 })],
  cookie: ([a, b]) => [cyl(0.3, 0.3, 0.08, a, { rx: -1.2, y: 0.22 }, 12), ...[[0.1, 0.3], [-0.12, 0.2], [0.02, 0.12]].map(([x, y]) => sph(0.04, b, { x, y: y + 0.06, z: 0.06 }, 5))],
  cake: ([a, b, c]) => [cyl(0.3, 0.3, 0.22, a, {}, 14), cyl(0.305, 0.305, 0.06, b, { y: 0.1 }, 14), cyl(0.3, 0.3, 0.06, b, { y: 0.22 }, 14), sph(0.07, c, { y: 0.32 }, 6)],
  pie: ([a, b, c]) => [cyl(0.32, 0.26, 0.14, a, {}, 14), cyl(0.27, 0.27, 0.03, b, { y: 0.13 }, 14), box(0.5, 0.025, 0.05, c, { y: 0.15 }), box(0.05, 0.025, 0.5, c, { y: 0.15 }), box(0.5, 0.025, 0.05, c, { y: 0.15, z: 0.15 }), box(0.5, 0.025, 0.05, c, { y: 0.15, z: -0.15 })],
  ball: ([a, b, c]) => [sph(0.3, a, { y: 0.3 }, 12), tor(0.3, 0.035, b, { y: 0.3 }), tor(0.3, 0.035, c, { y: 0.3, ry: Math.PI / 2 })],
  duck: ([a, b, c]) => [sph(0.26, a, { y: 0.24, sx: 1.15, sy: 0.85 }), sph(0.16, a, { x: 0.1, y: 0.5 }), cone(0.07, 0.16, b, { rz: -Math.PI / 2, x: 0.3, y: 0.49 }, 6), sph(0.03, c, { x: 0.18, y: 0.56, z: 0.12 }, 5), sph(0.03, c, { x: 0.18, y: 0.56, z: -0.12 }, 5)],
  block: ([a, b, c]) => [box(0.48, 0.48, 0.48, a), box(0.3, 0.3, 0.02, b, { y: 0.09, z: 0.24 }), box(0.3, 0.3, 0.02, c, { y: 0.09, z: -0.24 }), box(0.02, 0.3, 0.3, c, { x: 0.24, y: 0.09 })],
  teddy: ([a, b, c]) => [sph(0.24, a, { y: 0.24, sy: 1.05 }), sph(0.18, a, { y: 0.58 }), sph(0.07, a, { x: -0.14, y: 0.73 }, 6), sph(0.07, a, { x: 0.14, y: 0.73 }, 6), sph(0.08, b, { y: 0.55, z: 0.15, sz: 0.6 }, 6), sph(0.025, c, { x: -0.06, y: 0.63, z: 0.16 }, 4), sph(0.025, c, { x: 0.06, y: 0.63, z: 0.16 }, 4)],
  car: ([a, b, c]) => [box(0.72, 0.18, 0.36, a, { y: 0.08 }), box(0.4, 0.16, 0.32, c, { y: 0.26, x: -0.04 }), ...[[-0.24, 0.17], [0.24, 0.17], [-0.24, -0.17], [0.24, -0.17]].map(([x, z]) => cyl(0.09, 0.09, 0.06, b, { rx: Math.PI / 2, x, y: 0.09, z: z - 0.03 }, 8))],
  top: ([a, b, c]) => [cone(0.28, 0.3, a, { rx: Math.PI, y: 0.3 }, 12), cyl(0.28, 0.28, 0.08, b, { y: 0.3 }, 12), cone(0.18, 0.12, c, { y: 0.38 }, 12), cyl(0.03, 0.03, 0.14, c, { y: 0.48 }, 6)],
  rocket: ([a, b, c]) => [cyl(0.14, 0.16, 0.5, a, { y: 0.08 }, 10), cone(0.14, 0.2, b, { y: 0.58 }, 10), sph(0.06, c, { y: 0.4, z: 0.13, sz: 0.4 }, 8), ...[0, 2.1, 4.2].map((r) => box(0.04, 0.18, 0.16, b, { y: 0.02, x: Math.sin(r) * 0.15, z: Math.cos(r) * 0.15, ry: r }))],
  robot: ([a, b, c]) => [box(0.36, 0.34, 0.28, a), box(0.28, 0.24, 0.24, b, { y: 0.36 }), sph(0.04, c, { x: -0.07, y: 0.49, z: 0.12 }, 6), sph(0.04, c, { x: 0.07, y: 0.49, z: 0.12 }, 6), cyl(0.015, 0.015, 0.12, b, { y: 0.6 }, 4), sph(0.035, c, { y: 0.74 }, 6)],
  plant: ([a, b, c]) => [cyl(0.24, 0.18, 0.28, a, {}, 10), sph(0.24, b, { y: 0.46 }, 8), sph(0.16, c, { x: 0.14, y: 0.6 }, 7), sph(0.16, c, { x: -0.15, y: 0.56 }, 7)],
  cactus: ([a, b, c]) => [cyl(0.22, 0.17, 0.22, a, {}, 10), paint(place(new THREE.CapsuleGeometry(0.12, 0.34, 4, 8), { y: 0.48 }), b), paint(place(new THREE.CapsuleGeometry(0.06, 0.12, 3, 6), { x: 0.15, y: 0.52 }), b), sph(0.06, c, { y: 0.72 }, 6)],
  sunflower: ([a, b, c]) => [cyl(0.2, 0.15, 0.22, a, {}, 10), cyl(0.025, 0.025, 0.36, "#4c8a3a", { y: 0.2 }, 5), cyl(0.22, 0.22, 0.04, b, { rx: Math.PI / 2, y: 0.6 }, 12), cyl(0.11, 0.11, 0.05, c, { rx: Math.PI / 2, y: 0.6, z: 0.01 }, 10)],
  packet: ([a, b, c]) => [box(0.46, 0.62, 0.08, a), box(0.34, 0.26, 0.09, b, { y: 0.2 }), sph(0.08, c, { y: 0.33, z: 0.04, sz: 0.4 }, 8)],
  wateringcan: ([a, b, c]) => [cyl(0.2, 0.22, 0.4, a, {}, 12), cyl(0.03, 0.04, 0.4, b, { rz: -0.9, x: 0.3, y: 0.15 }, 6), tor(0.13, 0.025, b, { y: 0.42, x: -0.05 }, Math.PI), cyl(0.06, 0.03, 0.05, c, { rz: -0.9, x: 0.47, y: 0.42 }, 6)],
  gnome: ([a, b, c]) => [cyl(0.2, 0.24, 0.3, b, {}, 10), sph(0.14, "#f2c9a0", { y: 0.38 }, 8), cone(0.22, 0.38, c, { y: 0.27 }, 10), cone(0.18, 0.36, a, { y: 0.44 }, 10)],
  sack: ([a, b, c]) => [paint(place(new THREE.CapsuleGeometry(0.24, 0.24, 4, 10), { y: 0.36, sz: 0.7 }), a), cyl(0.12, 0.2, 0.12, b, { y: 0.62 }, 8), box(0.24, 0.12, 0.02, c, { y: 0.28, z: 0.17 })],
  birdhouse: ([a, b, c]) => [box(0.4, 0.42, 0.36, a), paint(place(new THREE.CylinderGeometry(0.0, 0.34, 0.22, 4, 1), { ry: Math.PI / 4, y: 0.53 }), b), cyl(0.07, 0.07, 0.02, c, { rx: Math.PI / 2, y: 0.26, z: 0.18 }, 10)],
  lollipop: ([a, b, c]) => [cyl(0.018, 0.018, 0.4, "#ffffff", {}, 5), cyl(0.24, 0.24, 0.07, a, { rx: Math.PI / 2, y: 0.6 }, 14), tor(0.14, 0.03, b, { y: 0.6, z: 0.04 }), tor(0.06, 0.025, c, { y: 0.6, z: 0.045 })],
  candyjar: ([a, b, c]) => [lathe([[0, 0], [0.25, 0], [0.28, 0.1], [0.28, 0.4], [0.18, 0.5], [0, 0.5]], a, {}, 12), ...[[-0.1, 0.12, b], [0.1, 0.14, c], [0, 0.28, c], [-0.1, 0.32, b], [0.11, 0.33, b]].map(([x, y, col]) => sph(0.08, col as string, { x: x as number, y: y as number, z: 0.18 }, 6)), cyl(0.17, 0.17, 0.07, "#e0352b", { y: 0.5 }, 10)],
  bar: ([a, b, c]) => [box(0.6, 0.12, 0.32, a, { rx: -1.1, y: 0.1, z: 0.05 }), box(0.62, 0.13, 0.2, b, { rx: -1.1, y: 0.06, z: 0.13 }), box(0.2, 0.135, 0.06, c, { rx: -1.1, y: 0.07, z: 0.15 })],
  gumball: ([a, b, c]) => [cyl(0.18, 0.22, 0.14, a, {}, 10), sph(0.24, "#e8f4ff", { y: 0.36 }, 12), sph(0.07, b, { x: -0.08, y: 0.3, z: 0.14 }, 6), sph(0.07, c, { x: 0.09, y: 0.38, z: 0.12 }, 6), sph(0.07, a, { x: -0.02, y: 0.46, z: 0.14 }, 6)],
  macaron: ([a, b]) => [cyl(0.26, 0.26, 0.12, a, { rx: -1.2, y: 0.26, z: -0.06 }, 14), cyl(0.24, 0.24, 0.06, b, { rx: -1.2, y: 0.25, z: 0.02 }, 14), cyl(0.26, 0.26, 0.12, a, { rx: -1.2, y: 0.24, z: 0.08 }, 14)],
  candycane: ([a, b]) => [cyl(0.05, 0.05, 0.55, a, { x: -0.08 }, 8), tor(0.12, 0.05, a, { x: 0.04, y: 0.55 }, Math.PI), ...[0.1, 0.25, 0.4].map((y) => cyl(0.055, 0.055, 0.06, b, { x: -0.08, y, rz: 0.3 }, 8))],
  icecream: ([a, b, c]) => [cone(0.17, 0.42, a, { rx: Math.PI, y: 0.42 }, 10), sph(0.19, b, { y: 0.5 }, 10), sph(0.15, c, { y: 0.66 }, 10)],
  pouch: ([a, b, c]) => [paint(place(new THREE.CapsuleGeometry(0.22, 0.2, 4, 10), { y: 0.33, sz: 0.55 }), a), cyl(0.1, 0.18, 0.12, a, { y: 0.56 }, 8), ...[[-0.08, 0.28, b], [0.08, 0.35, c], [0, 0.22, c]].map(([x, y, col]) => sph(0.05, col as string, { x: x as number, y: y as number, z: 0.13, sx: 1.4 }, 6))],
  book: ([a, b, c]) => [box(0.5, 0.68, 0.16, a), box(0.46, 0.64, 0.17, b, { x: 0.03 }), box(0.3, 0.06, 0.005, c, { y: 0.48, z: 0.085 })].map((g, i) => (i === 1 ? place(g, { y: 0.02 }) : g)),
  globe: ([a, b, c]) => [cyl(0.16, 0.2, 0.06, c, {}, 10), cyl(0.02, 0.02, 0.14, c, { y: 0.06 }, 5), sph(0.24, a, { y: 0.44 }, 12), sph(0.12, b, { x: 0.12, y: 0.5, z: 0.12, sz: 0.6 }, 6), sph(0.1, b, { x: -0.1, y: 0.38, z: 0.16, sz: 0.6 }, 6)],
  mug: ([a, b, c]) => [cyl(0.21, 0.19, 0.42, a, {}, 12), tor(0.11, 0.03, a, { x: 0.22, y: 0.22 }, Math.PI * 2), cyl(0.212, 0.212, 0.08, b, { y: 0.18 }, 12), cyl(0.18, 0.18, 0.02, c, { y: 0.41 }, 12)],
  pencils: ([a, b, c]) => [cyl(0.2, 0.2, 0.34, a, {}, 10), ...[[-0.08, -0.04, b], [0.06, 0.05, c], [0.02, -0.08, "#3f7fd0"], [-0.05, 0.08, "#e0352b"]].map(([x, z, col]) => cyl(0.03, 0.03, 0.62, col as string, { x: x as number, z: z as number }, 6))],
  lamp: ([a, b, c]) => [cyl(0.18, 0.2, 0.06, c, {}, 10), cyl(0.025, 0.025, 0.42, c, { y: 0.06 }, 5), cyl(0.12, 0.26, 0.24, a, { y: 0.44 }, 12), sph(0.08, b, { y: 0.48 }, 8)],
  notebook: ([a, b, c]) => [box(0.48, 0.64, 0.08, a), box(0.44, 0.6, 0.085, b, { x: 0.02, y: 0.02 }), ...[0.1, 0.25, 0.4, 0.55].map((y) => tor(0.035, 0.012, c, { x: -0.24, y, ry: Math.PI / 2 }))],
  scroll: ([a, b, c]) => [cyl(0.15, 0.15, 0.6, a, { rz: Math.PI / 2, x: 0.3, y: 0.15 }, 12), cyl(0.155, 0.155, 0.08, b, { rz: Math.PI / 2, x: 0.04, y: 0.15 }, 12), cyl(0.04, 0.04, 0.72, c, { rz: Math.PI / 2, x: 0.36, y: 0.15 }, 6)].map((g) => place(g, { x: -0.3 })),
  hourglass: ([a, b, c]) => [cyl(0.24, 0.24, 0.05, a, {}, 10), cone(0.18, 0.28, c, { rx: Math.PI, y: 0.6 }, 10), cone(0.18, 0.28, c, { y: 0.05 }, 10), cone(0.11, 0.15, b, { y: 0.05 }, 10), cyl(0.24, 0.24, 0.05, a, { y: 0.6 }, 10), ...[-0.2, 0.2].map((x) => cyl(0.02, 0.02, 0.55, a, { x, y: 0.05 }, 5))],
};

const cache = new Map<number, THREE.BufferGeometry>();

/** The shared geometry of good g (an index into GOODS). */
export function goodGeometry(g: number): THREE.BufferGeometry {
  let geo = cache.get(g);
  if (!geo) {
    const good = GOODS[g];
    const parts = (B[good.model] ?? B.block)(good.colors);
    geo = mergeGeometries(parts.map((p) => (p.getAttribute("normal") ? p : (p.computeVertexNormals(), p))), false)!;
    geo.computeBoundingBox();
    // Re-centre on x/z and sit on y = 0.
    const bb = geo.boundingBox!;
    geo.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2);
    // Keep every good inside its spot: at most 0.8 wide and 0.85 tall.
    const size = new THREE.Vector3();
    geo.computeBoundingBox();
    geo.boundingBox!.getSize(size);
    const s = Math.min(1, 0.8 / Math.max(size.x, size.z), 0.85 / size.y);
    if (s < 1) geo.scale(s, s, s);
    geo.computeBoundingBox();
    geo.computeBoundingSphere();
    cache.set(g, geo);
  }
  return geo;
}
