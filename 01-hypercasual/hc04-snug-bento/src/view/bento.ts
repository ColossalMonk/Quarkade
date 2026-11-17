// The bento view: table mat, box, food pieces (in the box and in the tray below), the drag ghost,
// the lid, and picking. World units: one box cell = 1, cell (x, y) has its top-left corner at
// world (x, -y). The board is the source of truth; refresh() moves pieces to where it says.

import * as THREE from "three";
import { Tweens, ease } from "../../../../forge/src/core/tween.ts";
import type { Board, Cell, Placement } from "../logic/rules.ts";
import { rotations } from "../logic/rules.ts";
import { FOODS } from "../data/foods.ts";
import { MAX_CELLS, PIECE_MARGIN, createBoxMaterial, createFoodMaterial, createLidMaterial, createMatMaterial } from "./materials.ts";

interface PieceV {
  mesh: THREE.Mesh;
  mat: THREE.ShaderMaterial;
  cells: Cell[];
  bw: number;
  bh: number;
  pos: THREE.Vector2;
  scale: number;
  target: THREE.Vector2;
  targetScale: number;
  dragging: boolean;
  squash: number;
}

export interface Style {
  box: string;
  floor: string;
  lacquer: boolean;
  tie: string;
  mat: { kind: number; a: string; b: string };
}

const TRAY_GAP = 0.45;

export class BentoView {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 100);
  readonly tweens = new Tweens();
  private board: Board | null = null;
  private foods: number[] = [];
  private pieces: PieceV[] = [];
  private box: THREE.Mesh | null = null;
  private lid: THREE.Mesh | null = null;
  private ghost: PieceV | null = null;
  private mat: THREE.Mesh;
  private matMat: THREE.ShaderMaterial;
  private safe = { top: 100, bottom: 96 };
  private viewW = 10;
  private viewH = 10;
  private bad = new Set<number>();
  private time = 0;
  private style: Style = { box: "#c9935a", floor: "#f3e1c0", lacquer: false, tie: "#e8443a", mat: { kind: 0, a: "#d9c08a", b: "#b89a62" } };
  private trayScale = 0.6;
  private content: [number, number, number, number] = [-1, -10, 7, 1];

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.setClearColor(0x000000, 0);
    this.camera.position.set(0, 0, 10);
    this.matMat = createMatMaterial();
    this.mat = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.matMat);
    this.mat.renderOrder = -10;
    this.scene.add(this.mat);
  }

  // ---------------------------------------------------------------- layout

  resize(w: number, h: number): void {
    this.renderer.setSize(w, h, false);
    this.viewW = w;
    this.viewH = h;
    this.fit();
  }

  setSafeArea(top: number, bottom: number): void {
    this.safe = { top, bottom };
    this.fit();
  }

  private fit(): void {
    const [x0, y0, x1, y1] = this.content;
    const cw = this.renderer.domElement.clientWidth || this.viewW || 1;
    const ch = this.renderer.domElement.clientHeight || this.viewH || 1;
    const usableH = Math.max(80, ch - this.safe.top - this.safe.bottom);
    const scale = Math.max((x1 - x0) / cw, (y1 - y0) / usableH);
    const halfW = (cw * scale) / 2;
    const halfH = (ch * scale) / 2;
    const cx = (x0 + x1) / 2;
    const cyPx = this.safe.top + usableH / 2;
    const cy = (y0 + y1) / 2 + (cyPx - ch / 2) * scale;
    this.camera.left = cx - halfW;
    this.camera.right = cx + halfW;
    this.camera.top = cy + halfH;
    this.camera.bottom = cy - halfH;
    this.camera.updateProjectionMatrix();
    this.mat.scale.set(halfW * 2, halfH * 2, 1);
    this.mat.position.set(cx, cy, -5);
    this.matMat.uniforms.uRect.value.set(cx - halfW, cy - halfH, cx + halfW, cy + halfH);
  }

  /** Where tray pieces go (flow rows under the box), and the content bounds for the camera. */
  private layoutTray(): void {
    const b = this.board!;
    const { w, h } = b.def;
    const trayW = Math.max(w, 5.4);
    const x0 = w / 2 - trayW / 2;
    const top = -(h + 1.0);
    const tray = this.pieces.map((p, i) => ({ p, i })).filter(({ i }) => !b.at[i] && !this.pieces[i].dragging);
    // Shrink the tray until it fits in about 4.6 units of height.
    let s = 0.62;
    let rowsH = 0;
    const place = (scale: number, write: boolean) => {
      let x = x0;
      let y = top;
      let rowH = 0;
      for (const { p } of tray) {
        const pw = p.bw * scale;
        if (x > x0 && x + pw > x0 + trayW) {
          x = x0;
          y -= rowH + TRAY_GAP;
          rowH = 0;
        }
        if (write) {
          p.target.set(x, y);
          p.targetScale = scale;
        }
        x += pw + TRAY_GAP;
        rowH = Math.max(rowH, p.bh * scale);
      }
      return top - y + rowH;
    };
    for (; s > 0.36; s -= 0.04) {
      rowsH = place(s, false);
      if (rowsH <= 4.6) break;
    }
    rowsH = place(s, true);
    this.trayScale = s;
    this.content = [Math.min(-0.7, x0 - 0.2), top - Math.max(rowsH, 2.2) - 0.4, Math.max(w + 0.7, x0 + trayW + 0.2), 0.8];
  }

  // ---------------------------------------------------------------- build / refresh

  build(board: Board, foods: number[]): void {
    this.tweens.finishAll();
    for (const p of this.pieces) {
      this.scene.remove(p.mesh);
      p.mat.dispose();
    }
    if (this.box) this.scene.remove(this.box);
    if (this.lid) this.scene.remove(this.lid);
    if (this.ghost) this.scene.remove(this.ghost.mesh);
    this.pieces = [];
    this.bad.clear();
    this.board = board;
    this.foods = foods;
    const { w, h, mask, walls } = board.def;
    const boxMat = createBoxMaterial(w, h, mask, walls);
    const m = 0.5;
    const geo = new THREE.PlaneGeometry(w + 2 * m, h + 2 * m);
    geo.translate(w / 2, -h / 2, 0);
    this.box = new THREE.Mesh(geo, boxMat);
    this.box.renderOrder = 0;
    this.scene.add(this.box);
    const lidMat = createLidMaterial(w + 0.7, h + 0.7);
    const lgeo = new THREE.PlaneGeometry(w + 0.7, h + 0.7);
    lgeo.translate(w / 2, -h / 2, 0);
    this.lid = new THREE.Mesh(lgeo, lidMat);
    this.lid.renderOrder = 200;
    this.lid.visible = false;
    this.scene.add(this.lid);
    board.pieces.forEach((_, i) => this.pieces.push(this.makePiece(i)));
    this.ghost = this.makePiece(0);
    this.ghost.mesh.visible = false;
    this.ghost.mesh.renderOrder = 60;
    this.ghost.mat.uniforms.uShadow.value = 0;
    this.applyStyle();
    this.refresh(board, false);
    this.fit();
  }

  private makePiece(i: number): PieceV {
    const mat = createFoodMaterial();
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    mesh.renderOrder = 10 + i;
    this.scene.add(mesh);
    return { mesh, mat, cells: [], bw: 1, bh: 1, pos: new THREE.Vector2(), scale: 1, target: new THREE.Vector2(), targetScale: 1, dragging: false, squash: 0 };
  }

  /** Set a piece mesh's cells and food look. */
  private setShape(pv: PieceV, cells: Cell[], food: number, temp: number): void {
    pv.cells = cells;
    pv.bw = Math.max(...cells.map((c) => c[0])) + 1;
    pv.bh = Math.max(...cells.map((c) => c[1])) + 1;
    const g = pv.mesh.geometry as THREE.PlaneGeometry;
    g.dispose();
    const geo = new THREE.PlaneGeometry(pv.bw + 2 * PIECE_MARGIN, pv.bh + 2 * PIECE_MARGIN);
    geo.translate(pv.bw / 2, -pv.bh / 2, 0);
    pv.mesh.geometry = geo;
    const u = pv.mat.uniforms;
    for (let k = 0; k < MAX_CELLS; k++) u.uCells.value[k].set(...(cells[k] ?? [0, 0]));
    u.uCount.value = Math.min(MAX_CELLS, cells.length);
    u.uSize.value.set(pv.bw, pv.bh);
    const f = FOODS[food] ?? FOODS[0];
    u.uPattern.value = f.pattern;
    u.uC1.value.set(f.colors[0]);
    u.uC2.value.set(f.colors[1]);
    u.uC3.value.set(f.colors[2]);
    u.uTemp.value = temp;
  }

  private cellsOf(i: number): Cell[] {
    const b = this.board!;
    const p = b.pieces[i];
    const base = b.shape[i] === 1 && p.s ? p.s : p.c;
    return rotations(base)[b.rot[i]];
  }

  /** Move every piece to where the board says (animated unless `animate` is false). */
  refresh(board: Board, animate = true): void {
    this.board = board;
    // The Knife can add pieces.
    while (this.pieces.length < board.pieces.length) {
      const pv = this.makePiece(this.pieces.length);
      this.pieces.push(pv);
    }
    board.pieces.forEach((p, i) => {
      const pv = this.pieces[i];
      this.setShape(pv, this.cellsOf(i), this.foods[i] ?? 0, p.t);
      const at = board.at[i];
      if (at) {
        pv.target.set(at.x, -at.y);
        pv.targetScale = 1;
      }
    });
    this.layoutTray();
    if (!animate) {
      for (const pv of this.pieces) {
        pv.pos.copy(pv.target);
        pv.scale = pv.targetScale;
      }
    }
    this.fit();
  }

  setFoods(foods: number[]): void {
    this.foods = foods;
    if (this.board) this.refresh(this.board, false);
  }

  applyStyle(style?: Style): void {
    if (style) this.style = style;
    const s = this.style;
    if (this.box) {
      const u = (this.box.material as THREE.ShaderMaterial).uniforms;
      u.uWood.value.set(s.box);
      u.uFloor.value.set(s.floor);
      u.uLacquer.value = s.lacquer ? 1 : 0;
    }
    if (this.lid) {
      const u = (this.lid.material as THREE.ShaderMaterial).uniforms;
      u.uWood.value.set(s.box);
      u.uTie.value.set(s.tie);
    }
    this.matMat.uniforms.uKind.value = s.mat.kind;
    this.matMat.uniforms.uA.value.set(s.mat.a);
    this.matMat.uniforms.uB.value.set(s.mat.b);
  }

  /** Pieces breaking a food rule glow red. */
  setBad(pieces: number[]): void {
    this.bad = new Set(pieces);
  }

  // ---------------------------------------------------------------- picking and dragging

  clientToWorld(cx: number, cy: number): THREE.Vector2 {
    const r = this.renderer.domElement.getBoundingClientRect();
    const nx = (cx - r.left) / r.width;
    const ny = (cy - r.top) / r.height;
    return new THREE.Vector2(this.camera.left + nx * (this.camera.right - this.camera.left), this.camera.top - ny * (this.camera.top - this.camera.bottom));
  }

  worldToClient(x: number, y: number): { x: number; y: number } {
    const p = new THREE.Vector3(x, y, 0).project(this.camera);
    const r = this.renderer.domElement.getBoundingClientRect();
    return { x: r.left + ((p.x + 1) / 2) * r.width, y: r.top + ((1 - p.y) / 2) * r.height };
  }

  /** Centre of a piece on screen (for the coach's hand and flying chips). */
  pieceClient(i: number): { x: number; y: number } {
    const pv = this.pieces[i];
    const c = pv.cells[0] ?? [0, 0];
    return this.worldToClient(pv.pos.x + (c[0] + 0.5) * pv.scale, pv.pos.y - (c[1] + 0.5) * pv.scale);
  }

  /** A box cell's centre on screen. */
  cellClient(x: number, y: number): { x: number; y: number } {
    return this.worldToClient(x + 0.5, -y - 0.5);
  }

  /** The piece under a screen point (box first, then tray), or -1. */
  pick(cx: number, cy: number): number {
    const b = this.board;
    if (!b) return -1;
    const wp = this.clientToWorld(cx, cy);
    const bx = Math.floor(wp.x);
    const by = Math.floor(-wp.y);
    if (bx >= 0 && by >= 0 && bx < b.def.w && by < b.def.h) {
      const o = b.owner[by * b.def.w + bx];
      if (o >= 0) return o;
    }
    let best = -1;
    let bestD = 0.75;
    this.pieces.forEach((pv, i) => {
      if (b.at[i] || i >= b.pieces.length) return;
      for (const [x, y] of pv.cells) {
        const ccx = pv.pos.x + (x + 0.5) * pv.scale;
        const ccy = pv.pos.y - (y + 0.5) * pv.scale;
        const d = Math.hypot(wp.x - ccx, wp.y - ccy) / Math.max(0.5, pv.scale);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
    });
    return best;
  }

  private grab = new THREE.Vector2();

  /** Start dragging piece i from a screen point. */
  startDrag(i: number, cx: number, cy: number): void {
    const pv = this.pieces[i];
    const wp = this.clientToWorld(cx, cy);
    // Remember where on the piece it was grabbed, in piece cells.
    this.grab.set((wp.x - pv.pos.x) / pv.scale, (pv.pos.y - wp.y) / pv.scale);
    pv.dragging = true;
    pv.mesh.renderOrder = 100;
  }

  /**
   * Move the dragged piece. `lift` raises it above a finger (in cells). Returns the snapped
   * top-left cell it would land on.
   */
  dragTo(i: number, cx: number, cy: number, lift: number): { x: number; y: number } {
    const pv = this.pieces[i];
    const wp = this.clientToWorld(cx, cy);
    pv.targetScale = 1;
    pv.target.set(wp.x - this.grab.x, wp.y + this.grab.y + lift);
    pv.pos.lerp(pv.target, 0.6);
    return { x: Math.round(pv.target.x), y: Math.round(-pv.target.y) };
  }

  endDrag(i: number): void {
    const pv = this.pieces[i];
    pv.dragging = false;
    pv.mesh.renderOrder = 10 + i;
    this.showGhost(null, false);
  }

  /** The drop preview: the piece's shape at a placement, green if it fits, red if not. */
  showGhost(pl: (Placement & { i: number }) | null, ok: boolean): void {
    const g = this.ghost;
    if (!g) return;
    if (!pl || !this.board) {
      g.mesh.visible = false;
      return;
    }
    const p = this.board.pieces[pl.i];
    const base = pl.s === 1 && p.s ? p.s : p.c;
    this.setShape(g, rotations(base)[pl.r], this.foods[pl.i] ?? 0, 0);
    g.mesh.visible = true;
    g.pos.set(pl.x, -pl.y);
    g.target.copy(g.pos);
    g.scale = 1;
    g.mat.uniforms.uTint.value.set(...(ok ? [0.3, 0.85, 0.4] : [0.95, 0.3, 0.25]), 0.65);
    g.mat.uniforms.uAlpha.value = 0.45;
  }

  /** Press art: frame only the box (no tray), with margins in cells (left, right, top, bottom). */
  frameBox(left = 0.9, right = left, top = 2.5, bottom = 0.9): void {
    if (!this.board) return;
    const { w, h } = this.board.def;
    this.content = [-left, -h - bottom, w + right, top];
    this.fit();
  }

  /** Press art: hold piece i hovering `lift` cells above a placement, with the green ghost below it. */
  hover(i: number, pl: Placement, lift: number): void {
    if (!this.board) return;
    const pv = this.pieces[i];
    const p = this.board.pieces[i];
    const base = pl.s === 1 && p.s ? p.s : p.c;
    this.setShape(pv, rotations(base)[pl.r], this.foods[i] ?? 0, p.t);
    pv.dragging = true;
    pv.pos.set(pl.x + 0.15, -pl.y + lift);
    pv.target.copy(pv.pos);
    pv.scale = 1;
    pv.mesh.renderOrder = 100;
    this.showGhost({ ...pl, i }, true);
  }

  /** A little squash when a piece lands. */
  pop(i: number): void {
    const pv = this.pieces[i];
    void this.tweens.to(0.3, (t) => (pv.squash = Math.sin(t * Math.PI) * (1 - t) * 0.6), { ease: ease.linear });
  }

  /** The lid slides on and taps shut. */
  async closeLid(): Promise<void> {
    const lid = this.lid;
    if (!lid || !this.board) return;
    lid.visible = true;
    const h = this.board.def.h;
    await this.tweens.to(0.55, (t) => lid.position.set(0, (1 - t) * (h + 4), 0), { ease: ease.outCubic });
    await this.tweens.to(0.18, (t) => lid.scale.setScalar(1 + Math.sin(t * Math.PI) * 0.04), { ease: ease.linear });
  }

  hideLid(): void {
    if (this.lid) this.lid.visible = false;
  }

  // ---------------------------------------------------------------- render

  render(dt: number): void {
    this.time += dt;
    this.tweens.update(dt);
    const k = Math.min(1, dt * 16);
    this.pieces.forEach((pv, i) => {
      const live = this.board && i < this.board.pieces.length;
      pv.mesh.visible = !!live;
      if (!live) return;
      if (!pv.dragging) {
        pv.pos.lerp(pv.target, k);
        pv.scale += (pv.targetScale - pv.scale) * k;
      } else pv.scale += (1 - pv.scale) * k;
      const sq = pv.squash;
      pv.mesh.position.set(pv.pos.x, pv.pos.y, 0);
      pv.mesh.scale.set(pv.scale * (1 + sq * 0.12), pv.scale * (1 - sq * 0.1), 1);
      const u = pv.mat.uniforms;
      u.uLift.value = pv.dragging ? 1 : 0;
      u.uBad.value = this.bad.has(i) ? 0.55 + 0.45 * Math.sin(this.time * 7) : 0;
    });
    if (this.ghost?.mesh.visible) {
      this.ghost.mesh.position.set(this.ghost.pos.x, this.ghost.pos.y, 0);
      this.ghost.mesh.scale.setScalar(1);
    }
    this.renderer.render(this.scene, this.camera);
  }
}
