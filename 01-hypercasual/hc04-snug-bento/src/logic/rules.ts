// Snug Bento rules (DESIGN.md §4): a box of cells (with dividers and garnish), food pieces made of
// cells, rotation and soft second shapes, placement, and the food rules (hot and cold can't touch,
// sauce cups must touch their food). Pure data: shared by the game, solver, generator and tests.

export type LevelTag = "tutorial" | "normal" | "breather" | "tricky" | "masterpiece" | "daily";
/** [x, y], y down. */
export type Cell = [number, number];

export const TEMP_NONE = 0;
export const TEMP_HOT = 1;
export const TEMP_COLD = 2;

export interface PieceDef {
  /** Base shape cells. */
  c: Cell[];
  /** Soft foods: the second shape (same cell count). */
  s?: Cell[];
  /** Temperature: 0 none, 1 hot, 2 cold. */
  t: number;
  /** Sauce cup: index of the piece it must touch. */
  sauce?: number;
}

/** Where a piece sits: shape (0 base, 1 soft alternative), rotation (quarter turns), offset. */
export interface Placement {
  s: number;
  r: number;
  x: number;
  y: number;
}

export interface LevelDef {
  n: number;
  w: number;
  h: number;
  /** w*h chars, row by row: "." box cell, " " outside the box, "g" garnish (fixed food). */
  mask: string;
  /** Dividers: cell*2 + 0 for the wall on a cell's right edge, cell*2 + 1 for its bottom edge. */
  walls: number[];
  pieces: PieceDef[];
  /** One known solution (a placement per piece). */
  sol: Placement[];
  par: number;
  d: number;
  tag: LevelTag;
}

// ---------------------------------------------------------------- shapes

const shapeCache = new Map<string, Cell[][]>();

function norm(cells: Cell[]): Cell[] {
  const mx = Math.min(...cells.map((c) => c[0]));
  const my = Math.min(...cells.map((c) => c[1]));
  return cells.map(([x, y]) => [x - mx, y - my] as Cell).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
}

export function shapeKey(cells: Cell[]): string {
  return norm(cells).map((c) => c.join(",")).join(";");
}

/** The four rotations of a shape (normalised, cells in reading order). */
export function rotations(cells: Cell[]): Cell[][] {
  const key = shapeKey(cells);
  const hit = shapeCache.get(key);
  if (hit) return hit;
  const out: Cell[][] = [];
  let cur = norm(cells);
  for (let r = 0; r < 4; r++) {
    out.push(cur);
    cur = norm(cur.map(([x, y]) => [-y, x] as Cell));
  }
  shapeCache.set(key, out);
  return out;
}

/** Distinct rotations only (a square has one), as [rotation index, cells]. */
export function distinctRotations(cells: Cell[]): Array<[number, Cell[]]> {
  const seen = new Set<string>();
  const out: Array<[number, Cell[]]> = [];
  rotations(cells).forEach((c, r) => {
    const k = shapeKey(c);
    if (!seen.has(k)) {
      seen.add(k);
      out.push([r, c]);
    }
  });
  return out;
}

/** Cells of a piece in a placement (board coordinates). */
export function placedCells(p: PieceDef, pl: Placement): Cell[] {
  const base = pl.s === 1 && p.s ? p.s : p.c;
  return rotations(base)[((pl.r % 4) + 4) % 4].map(([x, y]) => [x + pl.x, y + pl.y] as Cell);
}

// ---------------------------------------------------------------- board

export const OUTSIDE = -2;
export const GARNISH = -3;
export const EMPTY = -1;

export interface Board {
  def: LevelDef;
  /** This level's pieces (the Knife can split one, so it is a copy of def.pieces). */
  pieces: PieceDef[];
  /** Per cell: OUTSIDE, GARNISH, EMPTY or the piece index sitting there. */
  owner: number[];
  /** Per piece: where it sits, or null when it is in the tray. */
  at: Array<Placement | null>;
  /** Per piece: shown shape and rotation (in the tray too). */
  shape: number[];
  rot: number[];
  /** Pieces put into the box so far (re-places count). */
  placements: number;
}

export function newBoard(def: LevelDef, rotations0?: number[]): Board {
  const owner = [...def.mask].map((ch) => (ch === "." ? EMPTY : ch === "g" ? GARNISH : OUTSIDE));
  const pieces = def.pieces.map((p) => ({ ...p, c: p.c.map((c) => [...c] as Cell), s: p.s?.map((c) => [...c] as Cell) }));
  return {
    def,
    pieces,
    owner,
    at: pieces.map(() => null),
    shape: pieces.map(() => 0),
    rot: rotations0 ? rotations0.slice() : pieces.map(() => 0),
    placements: 0,
  };
}

export function cloneBoard(b: Board): Board {
  return {
    def: b.def,
    pieces: b.pieces.map((p) => ({ ...p, c: p.c.map((c) => [...c] as Cell), s: p.s?.map((c) => [...c] as Cell) })),
    owner: b.owner.slice(),
    at: b.at.map((a) => (a ? { ...a } : null)),
    shape: b.shape.slice(),
    rot: b.rot.slice(),
    placements: b.placements,
  };
}

export function hasWall(def: LevelDef, a: number, b: number): boolean {
  const w = def.w;
  const [lo, hi] = a < b ? [a, b] : [b, a];
  if (hi - lo === 1 && Math.floor(lo / w) === Math.floor(hi / w)) return def.walls.includes(lo * 2);
  if (hi - lo === w) return def.walls.includes(lo * 2 + 1);
  return false;
}

/** Can piece i go here (inside the box, on empty cells or its own, not across a divider)? */
export function canPlace(b: Board, i: number, pl: Placement): boolean {
  const { w, h } = b.def;
  const cells = placedCells(b.pieces[i], pl);
  const idx: number[] = [];
  for (const [x, y] of cells) {
    if (x < 0 || y < 0 || x >= w || y >= h) return false;
    const c = y * w + x;
    const o = b.owner[c];
    if (o !== EMPTY && o !== i) return false;
    idx.push(c);
  }
  // No divider may run through the piece.
  for (const a of idx) {
    for (const nb of [a + 1, a + w]) if (idx.includes(nb) && hasWall(b.def, a, nb)) return false;
  }
  return true;
}

export function removePiece(b: Board, i: number): void {
  if (!b.at[i]) return;
  for (let c = 0; c < b.owner.length; c++) if (b.owner[c] === i) b.owner[c] = EMPTY;
  b.at[i] = null;
}

/** Put piece i in the box (moving it if it was already there). Returns false if it doesn't fit. */
export function placePiece(b: Board, i: number, pl: Placement, count = true): boolean {
  if (!canPlace(b, i, pl)) return false;
  removePiece(b, i);
  for (const [x, y] of placedCells(b.pieces[i], pl)) b.owner[y * b.def.w + x] = i;
  b.at[i] = { ...pl };
  b.shape[i] = pl.s;
  b.rot[i] = pl.r;
  if (count) b.placements++;
  return true;
}

/** Turn a piece a quarter (in the tray always; in the box only if the turned piece still fits there). */
export function rotatePiece(b: Board, i: number): boolean {
  const at = b.at[i];
  if (!at) {
    b.rot[i] = (b.rot[i] + 1) % 4;
    return true;
  }
  const next = { ...at, r: (at.r + 1) % 4 };
  // Keep the turned piece over the same spot: try small nudges around the old offset.
  for (const [dx, dy] of [[0, 0], [0, -1], [-1, 0], [1, 0], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const pl = { ...next, x: at.x + dx, y: at.y + dy };
    if (canPlace(b, i, pl)) return placePiece(b, i, pl, false);
  }
  return false;
}

/** Soft foods: switch to the other shape (in the tray always; in the box only if it fits). */
export function squishPiece(b: Board, i: number): boolean {
  const p = b.pieces[i];
  if (!p.s) return false;
  const at = b.at[i];
  if (!at) {
    b.shape[i] = 1 - b.shape[i];
    return true;
  }
  for (const r of [at.r, (at.r + 1) % 4, (at.r + 3) % 4, (at.r + 2) % 4]) {
    for (const [dx, dy] of [[0, 0], [0, -1], [-1, 0], [1, 0], [0, 1]]) {
      const pl = { s: 1 - at.s, r, x: at.x + dx, y: at.y + dy };
      if (canPlace(b, i, pl)) return placePiece(b, i, pl, false);
    }
  }
  return false;
}

export function isFull(b: Board): boolean {
  return !b.owner.includes(EMPTY);
}

export interface Violations {
  /** Hot/cold pairs touching: [hot piece, cold piece]. */
  hotCold: Array<[number, number]>;
  /** Placed sauce cups not touching their food (when the food is placed too, or the box is full). */
  sauce: number[];
}

function neighbours(def: LevelDef, c: number): number[] {
  const { w, h } = def;
  const x = c % w;
  const y = Math.floor(c / w);
  const out: number[] = [];
  if (x > 0) out.push(c - 1);
  if (x < w - 1) out.push(c + 1);
  if (y > 0) out.push(c - w);
  if (y < h - 1) out.push(c + w);
  return out;
}

/** Pieces touching piece i along an edge (dividers don't separate food: they are thin). */
export function touching(b: Board, i: number): Set<number> {
  const out = new Set<number>();
  for (let c = 0; c < b.owner.length; c++) {
    if (b.owner[c] !== i) continue;
    for (const nb of neighbours(b.def, c)) {
      const o = b.owner[nb];
      if (o >= 0 && o !== i) out.add(o);
    }
  }
  return out;
}

export function violations(b: Board): Violations {
  const v: Violations = { hotCold: [], sauce: [] };
  b.pieces.forEach((p, i) => {
    if (!b.at[i]) return;
    if (p.t === TEMP_HOT) for (const j of touching(b, i)) if (b.pieces[j].t === TEMP_COLD) v.hotCold.push([i, j]);
    if (p.sauce !== undefined) {
      const target = p.sauce;
      const near = touching(b, i);
      // Only complain once the food is in the box too (or the box is full).
      if (!near.has(target) && (b.at[target] || isFull(b))) v.sauce.push(i);
    }
  });
  return v;
}

export function isWon(b: Board): boolean {
  if (!isFull(b)) return false;
  const v = violations(b);
  return !v.hotCold.length && !v.sauce.length;
}

/** Index of a cell under board coordinates, or -1. */
export function cellAt(def: LevelDef, x: number, y: number): number {
  return x < 0 || y < 0 || x >= def.w || y >= def.h ? -1 : y * def.w + x;
}

/** Pieces that are interchangeable (same shapes, temperature and sauce role): solver symmetry. */
export function pieceKeys(pieces: PieceDef[]): string[] {
  const targets = new Set(pieces.map((p) => p.sauce).filter((s) => s !== undefined));
  return pieces.map((p, i) => {
    const shapes = (s: Cell[]) => distinctRotations(s).map(([, c]) => shapeKey(c)).sort().join("|");
    return `${shapes(p.c)}/${p.s ? shapes(p.s) : ""}/${p.t}/${p.sauce ?? -1}/${targets.has(i) ? i : -1}`;
  });
}
