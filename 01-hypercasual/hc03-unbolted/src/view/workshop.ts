// The workshop view: pegboard, plates (SDF shader), bolts and pins, chains, and the animations
// (unscrew, swing on a damped spring, drop). The board stays the source of truth: after each
// animation the view is in the board's pose, and sync() snaps everything to it.

import * as THREE from "three";
import { Tweens, ease } from "../../../../forge/src/core/tween.ts";
import type { Board, TapResult } from "../logic/rules.ts";
import { BOARD_H, BOARD_W, chainEnds, geom, isPlateLocked, pivotOf } from "../logic/rules.ts";
import { SHAPES, shapeInfo, toWorld } from "../logic/shapes.ts";
import type { Pose, Vec } from "../logic/shapes.ts";
import { BOLT_COLOURS, PIN_HEX, PLATE_PAINTS } from "../data/palette.ts";
import { createBoardMaterial, createBoltMaterial, createPlateMaterial, plateGeometry } from "./materials.ts";

const BOLT_SIZE = 1.05;
const LINKS = 9;

interface PlateV {
  mesh: THREE.Mesh;
  mat: THREE.ShaderMaterial;
  shown: Pose;
  alpha: number;
  lockOpen: number;
  gone: boolean;
}

interface BoltV {
  mesh: THREE.Mesh;
  mat: THREE.ShaderMaterial;
  pos: Vec;
  spin: number;
  lift: number;
  shake: number;
  gone: boolean;
  plates: number[];
}

export interface Finish {
  /** 0 painted steel, 1 copper, 2 plywood, 3 candy acrylic */
  plate: number;
  /** pegboard: 0 wood, 1 blueprint, 2 toy room, 3 night shift */
  board: number;
  boardHex: string;
}

export class WorkshopView {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 100);
  readonly tweens = new Tweens();
  private board: Board | null = null;
  private plates: PlateV[] = [];
  private bolts: BoltV[] = [];
  private pins: THREE.Mesh[] = [];
  private links: THREE.InstancedMesh;
  private bg: THREE.Mesh;
  private bgMat: THREE.ShaderMaterial;
  private colourOf: (slot: number) => number = (s) => s;
  private symbols = false;
  private finish: Finish = { plate: 0, board: 0, boardHex: "#d6b88f" };
  private safe = { top: 96, bottom: 220 };
  private viewW = 10;
  private viewH = 10;
  private time = 0;
  private hint = -1;
  private dummy = new THREE.Object3D();
  /** Plates being animated; render() leaves their shown pose alone. */
  private moving = new Set<number>();

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.setClearColor(0x000000, 0);
    this.camera.position.set(0, 0, 10);
    this.bgMat = createBoardMaterial();
    this.bg = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.bgMat);
    this.bg.renderOrder = -10;
    this.scene.add(this.bg);
    this.links = new THREE.InstancedMesh(new THREE.RingGeometry(0.05, 0.085, 12), new THREE.MeshBasicMaterial({ color: 0x8d949c, transparent: true, depthTest: false }), 4 * LINKS);
    this.links.count = 0;
    this.scene.add(this.links);
  }

  // ---------------------------------------------------------------- layout

  private frame: [number, number, number, number] = [-1.1, -1.4, BOARD_W - 1 + 1.1, BOARD_H - 1 + 1.0];

  /** World rectangle to show: the level's plates with room around them for swings. */
  private rect(): [number, number, number, number] {
    return this.frame;
  }

  private computeFrame(board: Board): void {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    board.def.plates.forEach((row, i) => {
      const [bx0, by0, bx1, by1] = shapeInfo(row[0]).bounds;
      for (const [lx, ly] of [[bx0, by0], [bx1, by0], [bx0, by1], [bx1, by1]]) {
        const [wx, wy] = toWorld(board.pose[i], lx, ly);
        x0 = Math.min(x0, wx);
        x1 = Math.max(x1, wx);
        y0 = Math.min(y0, wy);
        y1 = Math.max(y1, wy);
      }
    });
    // Room for swings (mostly downward), then at least a 5.5 × 7 area, kept on the board.
    x0 -= 0.7;
    x1 += 0.7;
    y0 -= 1.6;
    y1 += 0.6;
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    const w = Math.max(5.5, x1 - x0);
    const h = Math.max(7, y1 - y0);
    this.frame = [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2];
  }

  private fit(): void {
    const [x0, y0, x1, y1] = this.rect();
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
    // The pegboard fills the whole view.
    this.bg.scale.set(halfW * 2, halfH * 2, 1);
    this.bg.position.set(cx, cy, -5);
    this.bgMat.uniforms.uRect.value.set(cx - halfW, cy - halfH, cx + halfW, cy + halfH);
  }

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

  // ---------------------------------------------------------------- build / sync

  build(board: Board, colourOf: (slot: number) => number): void {
    this.tweens.finishAll();
    for (const p of this.plates) {
      this.scene.remove(p.mesh);
      p.mat.dispose();
    }
    for (const b of this.bolts) {
      this.scene.remove(b.mesh);
      b.mat.dispose();
    }
    for (const m of this.pins) {
      this.scene.remove(m);
      (m.material as THREE.Material).dispose();
    }
    this.plates = [];
    this.bolts = [];
    this.pins = [];
    this.moving.clear();
    this.hint = -1;
    this.board = board;
    this.colourOf = colourOf;
    const def = board.def;
    const g = geom(def);
    def.plates.forEach((row, i) => {
      const { geo, bounds } = plateGeometry(row[0]);
      const holes = g.drilled[i].map((h) => SHAPES[row[0]].holes[h] as [number, number]);
      const mat = createPlateMaterial(row[0], bounds, holes);
      mat.uniforms.uColor.value.set(PLATE_PAINTS[(i * 3 + row[4]) % PLATE_PAINTS.length]);
      mat.uniforms.uGlass.value = row[5] & 1 ? 1 : 0;
      if (row[6] >= 0) {
        mat.uniforms.uLock.value.set(...new THREE.Color(this.hex(row[6])).toArray(), 1);
        const c = shapeInfo(row[0]).centroid;
        mat.uniforms.uLockPos.value.set(c[0], c[1]);
      }
      const mesh = new THREE.Mesh(geo, mat);
      mesh.renderOrder = g.order[i] * 2;
      this.scene.add(mesh);
      this.plates.push({ mesh, mat, shown: { ...board.pose[i] }, alpha: 1, lockOpen: 0, gone: !board.plateOn[i] });
    });
    def.bolts.forEach((row, i) => {
      const mat = createBoltMaterial();
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(BOLT_SIZE, BOLT_SIZE), mat);
      const own = row[4] >= 0 ? [row[0], row[4]] : [row[0]];
      mesh.renderOrder = Math.max(...own.map((p) => g.order[p])) * 2 + 1;
      const pos = g.boltPos[i];
      mesh.position.set(pos[0], pos[1], 0);
      this.scene.add(mesh);
      this.bolts.push({ mesh, mat, pos, spin: (i * 0.7) % 1, lift: 0, shake: 0, gone: !board.boltOn[i], plates: own });
    });
    def.pins.forEach((pin, i) => {
      const mat = createBoltMaterial();
      mat.uniforms.uPin.value = 1;
      mat.uniforms.uColor.value.set(PIN_HEX);
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(BOLT_SIZE, BOLT_SIZE), mat);
      mesh.renderOrder = g.order[pin[0]] * 2 + 1;
      const pos = g.pinPos[i];
      mesh.position.set(pos[0], pos[1], 0);
      this.scene.add(mesh);
      this.pins.push(mesh);
    });
    this.applyFinish();
    this.sync(board);
    this.computeFrame(board);
    this.fit();
  }

  private hex(slot: number): string {
    return BOLT_COLOURS[this.colourOf(slot) % BOLT_COLOURS.length].hex;
  }

  /** Snap the display to the board (after animations, undo, power-ups). */
  sync(board: Board): void {
    this.board = board;
    this.moving.clear();
    this.plates.forEach((p, i) => {
      p.shown = { ...board.pose[i] };
      p.gone = !board.plateOn[i];
      p.alpha = p.gone ? 0 : 1;
      p.lockOpen = isPlateLocked(board, i) ? 0 : 1;
    });
    this.bolts.forEach((b, i) => {
      b.gone = !board.boltOn[i];
      b.lift = 0;
      b.shake = 0;
    });
  }

  applyFinish(f?: Finish): void {
    if (f) this.finish = f;
    for (const p of this.plates) p.mat.uniforms.uFinish.value = this.finish.plate;
    this.bgMat.uniforms.uKind.value = this.finish.board;
    this.bgMat.uniforms.uBase.value.set(this.finish.boardHex);
  }

  setSymbols(on: boolean): void {
    this.symbols = on;
  }

  setHint(bolt: number): void {
    this.hint = bolt;
  }

  // ---------------------------------------------------------------- picking

  /** World point under a client (CSS pixel) position. */
  private toWorldPoint(cx: number, cy: number): Vec {
    const r = this.renderer.domElement.getBoundingClientRect();
    const nx = (cx - r.left) / r.width;
    const ny = (cy - r.top) / r.height;
    return [this.camera.left + nx * (this.camera.right - this.camera.left), this.camera.top - ny * (this.camera.top - this.camera.bottom)];
  }

  /** The bolt under a tap (nearest within reach), or -1. */
  pickBolt(cx: number, cy: number): number {
    const [x, y] = this.toWorldPoint(cx, cy);
    let best = -1;
    let bestD = 0.5;
    this.bolts.forEach((b, i) => {
      if (b.gone) return;
      const d = Math.hypot(b.pos[0] - x, b.pos[1] - y);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return best;
  }

  /** Any world point on screen (CSS pixels). */
  worldClient(x: number, y: number): { x: number; y: number } {
    const p = new THREE.Vector3(x, y, 0).project(this.camera);
    const r = this.renderer.domElement.getBoundingClientRect();
    return { x: r.left + ((p.x + 1) / 2) * r.width, y: r.top + ((1 - p.y) / 2) * r.height };
  }

  /** A bolt's position on screen (CSS pixels), for flying chips. */
  boltClient(i: number): { x: number; y: number } {
    const p = new THREE.Vector3(this.bolts[i].pos[0], this.bolts[i].pos[1], 0).project(this.camera);
    const r = this.renderer.domElement.getBoundingClientRect();
    return { x: r.left + ((p.x + 1) / 2) * r.width, y: r.top + ((1 - p.y) / 2) * r.height };
  }

  /** Pixels per world unit (for sizing DOM effects). */
  get unitPx(): number {
    return this.renderer.domElement.clientWidth / (this.camera.right - this.camera.left);
  }

  // ---------------------------------------------------------------- animations

  /** Blocked tap: a quick shake. */
  shake(i: number): void {
    const b = this.bolts[i];
    void this.tweens.to(0.3, (t) => (b.shake = Math.sin(t * Math.PI * 6) * (1 - t) * 0.06), { ease: ease.linear });
  }

  /** Unscrew: spin and lift the bolt, then hide it. Resolves when it's gone (the chip flies next). */
  async unscrew(i: number, fast = false): Promise<void> {
    const b = this.bolts[i];
    const dur = fast ? 0.12 : 0.28;
    const spin0 = b.spin;
    await this.tweens.to(dur, (t) => {
      b.spin = spin0 + t * 2.4;
      b.lift = t;
    }, { ease: ease.inQuad });
    b.gone = true;
  }

  /** Plates swing to the board's new poses and dropped plates fall away. */
  async settleTo(board: Board, res: Pick<TapResult, "swung" | "dropped" | "unlocked">, fast = false): Promise<void> {
    this.board = board;
    const jobs: Array<Promise<void>> = [];
    for (const p of res.swung) jobs.push(this.swing(board, p, fast));
    for (const p of res.dropped) jobs.push(this.drop(p, fast));
    for (const p of res.unlocked) {
      const pv = this.plates[p];
      jobs.push(this.tweens.to(0.45, (t) => (pv.lockOpen = t), { ease: ease.outBack }));
    }
    await Promise.all(jobs);
  }

  private swing(board: Board, p: number, fast: boolean): Promise<void> {
    const pv = this.plates[p];
    const target = board.pose[p];
    const piv = pivotOf(board, p);
    const from = { ...pv.shown };
    this.moving.add(p);
    const dur = fast ? 0.25 : 0.85;
    // Damped swing about the pivot: overshoot a little, then settle.
    let a0 = from.a;
    while (a0 - target.a > Math.PI) a0 -= 2 * Math.PI;
    while (a0 - target.a < -Math.PI) a0 += 2 * Math.PI;
    return this.tweens
      .to(dur, (t) => {
        const k = t * dur;
        const amp = Math.exp(-k * 5.5) * Math.cos(k * 13);
        const a = t >= 1 ? target.a : target.a + (a0 - target.a) * amp;
        if (piv) {
          const [rx, ry] = toWorld({ x: 0, y: 0, a }, piv.local[0], piv.local[1]);
          pv.shown = { x: piv.world[0] - rx, y: piv.world[1] - ry, a };
        } else pv.shown = { x: from.x + (target.x - from.x) * t, y: from.y + (target.y - from.y) * t, a };
      }, { ease: ease.linear })
      .then(() => {
        pv.shown = { ...target };
        this.moving.delete(p);
      });
  }

  private drop(p: number, fast: boolean): Promise<void> {
    const pv = this.plates[p];
    const from = { ...pv.shown };
    const spinDir = p % 2 ? 1 : -1;
    this.moving.add(p);
    const dur = fast ? 0.3 : 0.9;
    return this.tweens
      .to(dur, (t) => {
        pv.shown = { x: from.x + spinDir * t * 0.6, y: from.y - t * t * 9, a: from.a + spinDir * t * 0.9 };
        pv.alpha = 1 - Math.max(0, (t - 0.6) / 0.4);
      }, { ease: ease.linear })
      .then(() => {
        pv.gone = true;
        pv.alpha = 0;
        this.moving.delete(p);
      });
  }

  /** Celebration on a cleared board: all bolts gone, a little bounce of the pegboard. */
  async cleared(): Promise<void> {
    await this.tweens.wait(0.2);
  }

  // ---------------------------------------------------------------- render

  render(dt: number): void {
    this.time += dt;
    this.tweens.update(dt);
    const board = this.board;
    this.plates.forEach((p, i) => {
      p.mesh.visible = !p.gone || this.moving.has(i);
      if (!p.mesh.visible) return;
      if (!this.moving.has(i) && board && board.plateOn[i]) p.shown = { ...board.pose[i] };
      p.mesh.position.set(p.shown.x, p.shown.y, 0);
      p.mesh.rotation.z = p.shown.a;
      const u = p.mat.uniforms;
      u.uAlpha.value = p.alpha;
      // Shadow and light are fixed in world space; convert to the plate's local frame.
      const c = Math.cos(-p.shown.a);
      const s = Math.sin(-p.shown.a);
      const layer = board ? board.def.plates[i][4] : 0;
      const off = 0.06 + layer * 0.025;
      u.uShadow.value.set(c * off - s * -off * 1.4, s * off + c * -off * 1.4);
      u.uLight.value.set(c * -0.6 - s * 0.8, s * -0.6 + c * 0.8);
      if (u.uLock.value.w > 0) {
        u.uLockOpen.value = p.lockOpen;
        u.uLock.value.w = 1 - Math.max(0, p.lockOpen - 0.6) / 0.4;
      }
    });
    this.bolts.forEach((b, i) => {
      b.mesh.visible = !b.gone;
      if (b.gone) return;
      const u = b.mat.uniforms;
      const slot = board ? board.def.bolts[i][2] : 0;
      const col = BOLT_COLOURS[this.colourOf(slot) % BOLT_COLOURS.length];
      u.uColor.value.set(col.hex);
      u.uSymbol.value = this.symbols && board && board.revealed[i] ? col.symbol : -1;
      u.uRust.value = board && !board.revealed[i] ? 1 : 0;
      u.uSpin.value = b.spin * Math.PI * 2;
      u.uLift.value = b.lift;
      u.uGlow.value = this.hint === i ? 0.6 + 0.4 * Math.sin(this.time * 6) : 0;
      const s = 1 + b.lift * 0.35;
      b.mesh.scale.setScalar(s);
      b.mesh.position.set(b.pos[0] + b.shake, b.pos[1] + b.lift * 0.12, 0);
      u.uAlpha.value = 1 - Math.max(0, b.lift - 0.7) / 0.3;
    });
    // Chains: links along the line between the two anchors (sagging a little).
    let k = 0;
    if (board) {
      board.def.chains.forEach((_, c) => {
        const [a, pb] = board.def.chains[c].length ? [board.def.chains[c][0], board.def.chains[c][2]] : [0, 0];
        if (!board.plateOn[a] && !board.plateOn[pb] && !this.moving.has(a) && !this.moving.has(pb)) return;
        const live: Board = { ...board, pose: board.pose.map((q, i) => (this.moving.has(i) || this.plates[i] ? this.plates[i].shown : q)) };
        const [e1, e2] = chainEnds(live, c);
        for (let j = 0; j < LINKS && k < 4 * LINKS; j++) {
          const t = (j + 0.5) / LINKS;
          const sag = Math.sin(t * Math.PI) * 0.15;
          this.dummy.position.set(e1[0] + (e2[0] - e1[0]) * t, e1[1] + (e2[1] - e1[1]) * t - sag, 0);
          this.dummy.rotation.z = j % 2 ? 0 : Math.PI / 2;
          this.dummy.scale.set(1, j % 2 ? 1 : 0.6, 1);
          this.dummy.updateMatrix();
          this.links.setMatrixAt(k++, this.dummy.matrix);
        }
      });
      const top = Math.max(0, ...board.def.chains.map((c) => Math.max(geom(board.def).order[c[0]], geom(board.def).order[c[2]])));
      this.links.renderOrder = top * 2 + 1.5;
    }
    this.links.count = k;
    this.links.instanceMatrix.needsUpdate = true;
    this.renderer.render(this.scene, this.camera);
  }
}
