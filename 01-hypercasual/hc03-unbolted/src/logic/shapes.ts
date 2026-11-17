// Plate shape kit (DESIGN.md §2, §5). Every plate is a union of rounded primitives with round
// holes cut out, described as a signed distance function (SDF). The same SDF draws the plate in
// the shader and decides, on the CPU, which bolts a plate covers.
//
// Units: one pegboard cell = 1. Holes sit on integer points so bolts land on the board grid.

export type Vec = [number, number];

export type Prim =
  | { k: "cap"; a: Vec; b: Vec; r: number }
  | { k: "box"; c: Vec; h: Vec; r: number }
  | { k: "disc"; c: Vec; r: number }
  | { k: "ring"; c: Vec; R: number; w: number };

export interface Shape {
  id: string;
  prims: Prim[];
  /** Hole centres (local). Bolts, hinge pins and chain anchors go in these. */
  holes: Vec[];
}

export const HOLE_R = 0.2;
export const BOLT_R = 0.3;

const bar = (n: number): Shape => ({
  id: `bar${n + 1}`,
  prims: [{ k: "cap", a: [0, 0], b: [n, 0], r: 0.45 }],
  holes: Array.from({ length: n + 1 }, (_, i) => [i, 0] as Vec),
});

/** The kit. Index = shape id in level data, so only ever append. */
export const SHAPES: Shape[] = [
  bar(1), // 0 bar2
  bar(2), // 1 bar3
  bar(3), // 2 bar4
  { id: "sq", prims: [{ k: "box", c: [0.5, 0.5], h: [0.95, 0.95], r: 0.32 }], holes: [[0, 0], [1, 0], [0, 1], [1, 1]] }, // 3
  {
    id: "rect",
    prims: [{ k: "box", c: [1, 0.5], h: [1.45, 0.95], r: 0.32 }],
    holes: [[0, 0], [2, 0], [0, 1], [2, 1], [1, 0], [1, 1]],
  }, // 4
  {
    id: "big",
    prims: [{ k: "box", c: [1, 1], h: [1.45, 1.45], r: 0.38 }],
    holes: [[0, 0], [2, 0], [0, 2], [2, 2], [1, 1]],
  }, // 5
  {
    id: "L",
    prims: [
      { k: "cap", a: [0, 0], b: [2, 0], r: 0.45 },
      { k: "cap", a: [0, 0], b: [0, 2], r: 0.45 },
    ],
    holes: [[0, 0], [2, 0], [0, 2], [1, 0], [0, 1]],
  }, // 6
  {
    id: "T",
    prims: [
      { k: "cap", a: [0, 0], b: [2, 0], r: 0.45 },
      { k: "cap", a: [1, 0], b: [1, 2], r: 0.45 },
    ],
    holes: [[0, 0], [2, 0], [1, 2], [1, 0], [1, 1]],
  }, // 7
  { id: "disc", prims: [{ k: "disc", c: [0.5, 0.5], r: 1.15 }], holes: [[0, 0], [1, 0], [0, 1], [1, 1]] }, // 8
  {
    id: "plus",
    prims: [
      { k: "cap", a: [1, 0], b: [1, 2], r: 0.45 },
      { k: "cap", a: [0, 1], b: [2, 1], r: 0.45 },
    ],
    holes: [[1, 0], [1, 2], [0, 1], [2, 1], [1, 1]],
  }, // 9
  { id: "ring", prims: [{ k: "ring", c: [1, 1], R: 1, w: 0.42 }], holes: [[0, 1], [2, 1], [1, 0], [1, 2]] }, // 10
  {
    id: "wide",
    prims: [{ k: "box", c: [1.5, 0.5], h: [1.95, 0.95], r: 0.32 }],
    holes: [[0, 0], [3, 0], [0, 1], [3, 1], [1, 0], [2, 1]],
  }, // 11
];

export const SHAPE_INDEX: Record<string, number> = Object.fromEntries(SHAPES.map((s, i) => [s.id, i]));

function primSdf(p: Prim, x: number, y: number): number {
  switch (p.k) {
    case "cap": {
      const bax = p.b[0] - p.a[0];
      const bay = p.b[1] - p.a[1];
      const pax = x - p.a[0];
      const pay = y - p.a[1];
      const t = Math.max(0, Math.min(1, (pax * bax + pay * bay) / (bax * bax + bay * bay || 1)));
      return Math.hypot(pax - bax * t, pay - bay * t) - p.r;
    }
    case "box": {
      const qx = Math.abs(x - p.c[0]) - p.h[0] + p.r;
      const qy = Math.abs(y - p.c[1]) - p.h[1] + p.r;
      return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - p.r;
    }
    case "disc":
      return Math.hypot(x - p.c[0], y - p.c[1]) - p.r;
    case "ring":
      return Math.abs(Math.hypot(x - p.c[0], y - p.c[1]) - p.R) - p.w;
  }
}

/**
 * Signed distance from a local point to the plate (negative inside). Only the holes listed are cut
 * out: a plate is drilled where it has fixings, and solid everywhere else.
 */
export function shapeSdf(s: Shape, x: number, y: number, holes: readonly number[] = NO_HOLES): number {
  let d = Infinity;
  for (const p of s.prims) d = Math.min(d, primSdf(p, x, y));
  for (const i of holes) {
    const h = s.holes[i];
    d = Math.max(d, -(Math.hypot(x - h[0], y - h[1]) - HOLE_R));
  }
  return d;
}

const NO_HOLES: readonly number[] = [];

export interface ShapeInfo {
  /** Local bounds [minX, minY, maxX, maxY]. */
  bounds: [number, number, number, number];
  centroid: Vec;
  area: number;
  /** Interior sample points (local), used for overlap tests. */
  samples: Vec[];
}

function primBounds(p: Prim): [number, number, number, number] {
  switch (p.k) {
    case "cap":
      return [Math.min(p.a[0], p.b[0]) - p.r, Math.min(p.a[1], p.b[1]) - p.r, Math.max(p.a[0], p.b[0]) + p.r, Math.max(p.a[1], p.b[1]) + p.r];
    case "box":
      return [p.c[0] - p.h[0], p.c[1] - p.h[1], p.c[0] + p.h[0], p.c[1] + p.h[1]];
    case "disc":
      return [p.c[0] - p.r, p.c[1] - p.r, p.c[0] + p.r, p.c[1] + p.r];
    case "ring":
      return [p.c[0] - p.R - p.w, p.c[1] - p.R - p.w, p.c[0] + p.R + p.w, p.c[1] + p.R + p.w];
  }
}

const infoCache: ShapeInfo[] = [];

/** Bounds, centre of mass (area minus holes) and sample points, computed once per shape. */
export function shapeInfo(i: number): ShapeInfo {
  const hit = infoCache[i];
  if (hit) return hit;
  const s = SHAPES[i];
  const b: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const p of s.prims) {
    const pb = primBounds(p);
    b[0] = Math.min(b[0], pb[0]);
    b[1] = Math.min(b[1], pb[1]);
    b[2] = Math.max(b[2], pb[2]);
    b[3] = Math.max(b[3], pb[3]);
  }
  // Cell-centred grid that fits the bounds exactly, so symmetric shapes get exact centroids.
  const nx = Math.ceil((b[2] - b[0]) / 0.03);
  const ny = Math.ceil((b[3] - b[1]) / 0.03);
  const dx = (b[2] - b[0]) / nx;
  const dy = (b[3] - b[1]) / ny;
  let sx = 0;
  let sy = 0;
  let n = 0;
  const samples: Vec[] = [];
  for (let iy = 0; iy < ny; iy++) {
    const y = b[1] + (iy + 0.5) * dy;
    for (let ix = 0; ix < nx; ix++) {
      const x = b[0] + (ix + 0.5) * dx;
      if (shapeSdf(s, x, y) < 0) {
        sx += x;
        sy += y;
        n++;
      }
    }
  }
  // Coarser grid of interior points for overlap tests.
  for (let y = b[1] + 0.1; y < b[3]; y += 0.25) for (let x = b[0] + 0.1; x < b[2]; x += 0.25) if (shapeSdf(s, x, y) < -0.05) samples.push([x, y]);
  const info: ShapeInfo = {
    bounds: b,
    centroid: [Math.round((sx / n) * 1e4) / 1e4, Math.round((sy / n) * 1e4) / 1e4],
    area: n * dx * dy,
    samples,
  };
  infoCache[i] = info;
  return info;
}

// ---------------------------------------------------------------- poses

/** A plate's placement: world = (x, y) + R(a) · local. */
export interface Pose {
  x: number;
  y: number;
  a: number;
}

export function toWorld(p: Pose, lx: number, ly: number): Vec {
  const c = Math.cos(p.a);
  const s = Math.sin(p.a);
  return [p.x + c * lx - s * ly, p.y + s * lx + c * ly];
}

export function toLocal(p: Pose, wx: number, wy: number): Vec {
  const c = Math.cos(p.a);
  const s = Math.sin(p.a);
  const dx = wx - p.x;
  const dy = wy - p.y;
  return [c * dx + s * dy, -s * dx + c * dy];
}

/** Signed distance from a world point to a placed plate with the given drilled holes. */
export function plateSdf(shape: number, pose: Pose, wx: number, wy: number, holes?: readonly number[]): number {
  const [lx, ly] = toLocal(pose, wx, wy);
  return shapeSdf(SHAPES[shape], lx, ly, holes);
}

/**
 * Resting pose of a plate hanging from one point: rotate about the pivot until the centre of mass
 * is straight below it. `pivotLocal` is the pivot on the plate, `pivotWorld` where it is held.
 * The angle is chosen nearest to `near` so animations swing the short way.
 */
export function restPose(shape: number, pivotLocal: Vec, pivotWorld: Vec, near: number): Pose {
  const c = shapeInfo(shape).centroid;
  const vx = c[0] - pivotLocal[0];
  const vy = c[1] - pivotLocal[1];
  let a: number;
  if (Math.hypot(vx, vy) < 0.05) a = near; // balanced on its pivot: it stays as it is
  else {
    a = -Math.PI / 2 - Math.atan2(vy, vx);
    while (a - near > Math.PI) a -= 2 * Math.PI;
    while (a - near < -Math.PI) a += 2 * Math.PI;
  }
  const [rx, ry] = toWorld({ x: 0, y: 0, a }, pivotLocal[0], pivotLocal[1]);
  return { x: pivotWorld[0] - rx, y: pivotWorld[1] - ry, a };
}
