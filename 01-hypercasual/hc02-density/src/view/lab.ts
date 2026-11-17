// The lab view: a rack of flasks drawn by the liquid shader, with pour animations, sinking drops,
// cork badges and tap picking. Display units (with animated heights) mirror the board; after each
// animation the view resyncs from the board, which stays the source of truth.

import * as THREE from "three";
import { Tweens, ease } from "../../../../forge/src/core/tween.ts";
import type { Board } from "../logic/rules.ts";
import { LIQUIDS, MURKY_HEX } from "../data/liquids.ts";
import type { BenchStyle, GlassStyle, PourStyle } from "../data/cosmetics.ts";
import { MAX_UNITS, createLiquidMaterial } from "./liquid-material.ts";

const UNIT_H = 0.5;
const FLASK_W = 0.84;
const SPACING = 1.24;
const NECK = 0.5;
const BOTTOM = 0.12;

interface DispUnit {
  slot: number;
  hidden: boolean;
  h: number;
}

interface FlaskV {
  mesh: THREE.Mesh;
  mat: THREE.ShaderMaterial;
  home: THREE.Vector3;
  cap: number;
  units: DispUnit[];
  lift: number;
  wobble: number;
  hint: number;
  badge: HTMLDivElement | null;
  /** Shown state, updated by sync() after animations (not live from the board). */
  isSealed: boolean;
  /** Cork animation 0 -> 1. */
  sealed: number;
  corks: number;
}

export class LabView {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 100);
  readonly tweens = new Tweens();
  private flasks: FlaskV[] = [];
  private liquidOf: (slot: number) => number = (s) => s;
  private time = 0;
  private selected = -1;
  /** Flasks being animated (render leaves their position alone). */
  private moving = new Set<number>();
  private symbols = false;
  private glass: GlassStyle = { shape: 0, tint: "#e8f4fb", frost: 0, rim: "#ffffff" };
  private pour: PourStyle = { sparkle: 0, bubbles: 0, rainbow: 0 };
  private safe = { top: 96, bottom: 84 };
  private overlay: HTMLElement | null;
  private stream: THREE.Mesh;
  private drops: THREE.InstancedMesh;
  private dropState: Array<{ x: number; y: number; vy: number; end: number; life: number; color: THREE.Color }> = [];
  private bench: THREE.Mesh;
  private viewW = 10;
  private viewH = 10;
  private layoutKey = "";
  private tmp = new THREE.Color();
  private dummy = new THREE.Object3D();

  constructor(canvas: HTMLCanvasElement, overlay?: HTMLElement) {
    this.overlay = overlay ?? null;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.setClearColor(0x000000, 0);
    this.camera.position.set(0, 0, 10);
    // A soft shelf under the flasks.
    this.bench = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x8a5a36, transparent: true, opacity: 0.18 }));
    this.scene.add(this.bench);
    this.stream = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95 }));
    this.stream.visible = false;
    this.stream.renderOrder = 5;
    this.scene.add(this.stream);
    this.drops = new THREE.InstancedMesh(new THREE.CircleGeometry(0.06, 10), new THREE.MeshBasicMaterial({ transparent: true }), 64);
    for (let i = 0; i < 64; i++) this.drops.setColorAt(i, this.tmp.set(0xffffff));
    this.drops.count = 0;
    this.drops.renderOrder = 6;
    this.scene.add(this.drops);
  }

  // ---------------------------------------------------------------- layout

  private maxCols(): number {
    const a = this.viewW / this.viewH;
    return a < 0.62 ? 4 : a < 0.9 ? 5 : 8;
  }

  private flaskH(cap: number): number {
    return BOTTOM + cap * UNIT_H + NECK;
  }

  private layout(caps: number[]): THREE.Vector3[] {
    const n = caps.length;
    const rows = Math.max(1, Math.ceil(n / this.maxCols()));
    const base = Math.floor(n / rows);
    const extra = n % rows;
    const rowH = Math.max(...caps.map((c) => this.flaskH(c))) + 0.7;
    const out: THREE.Vector3[] = [];
    for (let r = 0; r < rows; r++) {
      const count = base + (r < extra ? 1 : 0);
      for (let c = 0; c < count; c++) {
        out.push(new THREE.Vector3((c - (count - 1) / 2) * SPACING, ((rows - 1) / 2 - r) * rowH, 0));
      }
    }
    return out;
  }

  /** Fit all flasks between the HUD bars. */
  private fit(): void {
    if (!this.flasks.length) return;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const f of this.flasks) {
      const h = this.flaskH(f.cap);
      minX = Math.min(minX, f.home.x - FLASK_W / 2);
      maxX = Math.max(maxX, f.home.x + FLASK_W / 2);
      minY = Math.min(minY, f.home.y - h / 2);
      maxY = Math.max(maxY, f.home.y + h / 2 + 0.5); // room to lift
    }
    const cw = this.renderer.domElement.clientWidth || 1;
    const ch = this.renderer.domElement.clientHeight || 1;
    const usableH = Math.max(50, ch - this.safe.top - this.safe.bottom);
    const worldW = (maxX - minX) * 1.12;
    const worldH = (maxY - minY) * 1.08;
    // Scale = world units per pixel.
    const scale = Math.max(worldW / cw, worldH / usableH);
    const halfW = (cw * scale) / 2;
    const halfH = (ch * scale) / 2;
    const cx = (minX + maxX) / 2;
    // Centre the board in the space between the HUD bars.
    const cyPx = this.safe.top + usableH / 2;
    const cy = (minY + maxY) / 2 + (cyPx - ch / 2) * scale;
    this.camera.left = cx - halfW;
    this.camera.right = cx + halfW;
    this.camera.top = cy + halfH;
    this.camera.bottom = cy - halfH;
    this.camera.updateProjectionMatrix();
    this.bench.scale.set(maxX - minX + 1.2, 0.35, 1);
    this.bench.position.set(cx, minY - 0.05, -1);
  }

  resize(w: number, h: number): void {
    this.renderer.setSize(w, h, false);
    this.viewW = w;
    this.viewH = h;
    const key = `${this.maxCols()}:${this.flasks.length}`;
    if (key !== this.layoutKey && this.flasks.length) {
      this.layoutKey = key;
      const pos = this.layout(this.flasks.map((f) => f.cap));
      this.flasks.forEach((f, i) => {
        f.home.copy(pos[i]);
        f.mesh.position.copy(pos[i]);
      });
    }
    this.fit();
  }

  setSafeArea(top: number, bottom: number): void {
    this.safe = { top, bottom };
    this.fit();
  }

  // ---------------------------------------------------------------- build / sync

  private makeFlask(cap: number, at: THREE.Vector3): FlaskV {
    const h = this.flaskH(cap);
    const mat = createLiquidMaterial();
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(FLASK_W, h), mat);
    mesh.position.copy(at);
    mesh.renderOrder = 2;
    this.scene.add(mesh);
    mat.uniforms.uCap.value = cap;
    mat.uniforms.uAspect.value = h / FLASK_W;
    mat.uniforms.uUnitV.value = UNIT_H / h;
    mat.uniforms.uBottomV.value = BOTTOM / h;
    let badge: HTMLDivElement | null = null;
    if (this.overlay) {
      badge = document.createElement("div");
      badge.className = "cork-badge";
      badge.hidden = true;
      this.overlay.append(badge);
    }
    return { mesh, mat, home: at.clone(), cap, units: [], lift: 0, wobble: 0, hint: 0, badge, isSealed: false, sealed: 0, corks: 0 };
  }

  build(board: Board, liquidOf: (slot: number) => number): void {
    this.liquidOf = liquidOf;
    for (const f of this.flasks) {
      this.scene.remove(f.mesh);
      f.mat.dispose();
      f.badge?.remove();
    }
    this.tweens.finishAll();
    this.flasks = [];
    this.selected = -1;
    const pos = this.layout(board.caps);
    board.caps.forEach((cap, i) => this.flasks.push(this.makeFlask(cap, pos[i])));
    this.layoutKey = `${this.maxCols()}:${this.flasks.length}`;
    this.sync(board, false);
    this.applyGlass();
    this.fit();
  }

  /** Make the display match the board exactly (after animations, undo, power-ups). */
  sync(board: Board, animate = true): void {
    while (this.flasks.length < board.caps.length) this.addFlask(board.caps[this.flasks.length]);
    board.stacks.forEach((s, i) => {
      const f = this.flasks[i];
      f.units = s.map((slot, j) => ({ slot, hidden: board.hidden[i][j], h: 1 }));
      f.corks = board.corks[i];
      // Seal state only changes here, after the pour has finished: the cork then slides in.
      if (board.locked[i] && !f.isSealed) {
        f.isSealed = true;
        if (animate) void this.tweens.to(0.35, (t) => (f.sealed = t), { ease: ease.outBack });
        else f.sealed = 1;
      } else if (!board.locked[i] && f.isSealed) {
        f.isSealed = false;
        f.sealed = 0;
      }
    });
    this.board = board;
  }

  private board: Board | null = null;

  addFlask(cap: number): void {
    const caps = [...this.flasks.map((f) => f.cap), cap];
    const pos = this.layout(caps);
    const f = this.makeFlask(cap, pos[caps.length - 1]);
    f.mesh.scale.setScalar(0.01);
    this.flasks.push(f);
    void this.tweens.to(0.35, (t) => f.mesh.scale.setScalar(Math.max(0.01, t)), { ease: ease.outBack });
    this.flasks.forEach((fl, i) => {
      const from = fl.home.clone();
      fl.home.copy(pos[i]);
      if (fl !== f) void this.tweens.to(0.35, (t) => fl.mesh.position.lerpVectors(from, pos[i], t));
    });
    this.layoutKey = `${this.maxCols()}:${this.flasks.length}`;
    this.applyGlass();
    this.fit();
  }

  // ---------------------------------------------------------------- cosmetics / accessibility

  applyCosmetics(glass: GlassStyle, bench: BenchStyle, pour: PourStyle): void {
    this.glass = glass;
    this.pour = pour;
    (this.bench.material as THREE.MeshBasicMaterial).color.set(bench.kind === "space" || bench.kind === "wizard" ? 0x0b0f24 : bench.kind === "tile" ? 0x8696a3 : 0x8a5a36);
    this.applyGlass();
  }

  private applyGlass(): void {
    for (const f of this.flasks) {
      f.mat.uniforms.uTint.value.set(this.glass.tint);
      f.mat.uniforms.uRim.value.set(this.glass.rim);
      f.mat.uniforms.uFrost.value = this.glass.frost;
      f.mat.uniforms.uShape.value = this.glass.shape;
    }
  }

  setSymbols(on: boolean): void {
    this.symbols = on;
  }

  // ---------------------------------------------------------------- selection

  select(i: number): void {
    this.selected = i;
  }

  setHint(pair: [number, number] | null): void {
    this.flasks.forEach((f, i) => (f.hint = pair && (pair[0] === i || pair[1] === i) ? 1 : 0));
  }

  // ---------------------------------------------------------------- animations

  /** Pour `amount` units of `slot` from one flask into another, landing at `landedAt`. */
  async animatePour(from: number, to: number, slot: number, amount: number, landedAt: number): Promise<void> {
    const src = this.flasks[from];
    const dst = this.flasks[to];
    this.selected = -1;
    this.moving.add(from);
    const liquid = LIQUIDS[this.liquidOf(slot)];
    const dstH = this.flaskH(dst.cap);
    const side = dst.home.x >= src.home.x ? 1 : -1;
    const pourPos = new THREE.Vector3(dst.home.x - side * 0.62, dst.home.y + dstH / 2 + 0.55, 1);
    const startPos = src.mesh.position.clone();
    // 1. Lift and tilt over the target.
    await this.tweens.to(0.22, (t) => {
      src.mesh.position.lerpVectors(startPos, pourPos, t);
      src.mesh.rotation.z = -side * 1.15 * t;
    }, { ease: ease.inOutQuad });
    // 2. Stream + units move.
    const lip = pourPos.clone().add(new THREE.Vector3(side * 0.42, 0.25, 0));
    const surfaceY = dst.home.y - dstH / 2 + BOTTOM + dst.units.length * UNIT_H;
    this.stream.visible = true;
    (this.stream.material as THREE.MeshBasicMaterial).color.set(liquid.hex);
    const streamTop = lip.y;
    const removed = src.units.slice(-amount);
    const inserted: DispUnit[] = [];
    for (let k = 0; k < amount; k++) inserted.push({ slot, hidden: false, h: 0 });
    dst.units.splice(landedAt, 0, ...inserted);
    const sinking = landedAt < dst.units.length - amount;
    const landY = dst.home.y - dstH / 2 + BOTTOM + (landedAt + amount * 0.5) * UNIT_H;
    if (sinking) this.spawnDrops(dst.home.x, surfaceY, landY, liquid.hex, amount * 6);
    const dur = 0.32 + amount * 0.08;
    await this.tweens.to(dur, (t) => {
      for (const u of removed) u.h = 1 - t;
      for (const u of inserted) u.h = t;
      const bottomY = surfaceY + 0.05;
      this.stream.position.set(lip.x, (streamTop + bottomY) / 2, 1.5);
      this.stream.scale.set(0.09 + 0.04 * Math.sin(this.time * 30), Math.max(0.01, streamTop - bottomY), 1);
    }, { ease: ease.linear });
    this.stream.visible = false;
    src.units.splice(src.units.length - amount, amount);
    dst.wobble = 1;
    // 3. Back home.
    await this.tweens.to(0.2, (t) => {
      src.mesh.position.lerpVectors(pourPos, src.home, t);
      src.mesh.rotation.z = -side * 1.15 * (1 - t);
    }, { ease: ease.inOutQuad });
    src.mesh.rotation.z = 0;
    this.moving.delete(from);
  }

  private spawnDrops(x: number, fromY: number, toY: number, hex: string, n: number): void {
    const c = new THREE.Color(hex);
    for (let i = 0; i < n; i++) {
      this.dropState.push({ x: x + (Math.random() - 0.5) * 0.4, y: fromY + Math.random() * 0.3, vy: -(0.6 + Math.random() * 0.8), end: toY, life: 1, color: c });
    }
  }

  /** A unit dropped from the pipette grows in place (sinking through lighter layers if needed). */
  async animateInsert(to: number, slot: number, landedAt: number): Promise<void> {
    const dst = this.flasks[to];
    const unit: DispUnit = { slot, hidden: false, h: 0 };
    dst.units.splice(landedAt, 0, unit);
    const h = this.flaskH(dst.cap);
    if (landedAt < dst.units.length - 1) {
      const top = dst.home.y - h / 2 + BOTTOM + dst.units.length * UNIT_H;
      this.spawnDrops(dst.home.x, top, dst.home.y - h / 2 + BOTTOM + (landedAt + 0.5) * UNIT_H, LIQUIDS[this.liquidOf(slot)].hex, 6);
    }
    await this.tweens.to(0.3, (t) => (unit.h = t));
    dst.wobble = 1;
  }

  /** Centrifuge spin. */
  async spin(i: number): Promise<void> {
    const f = this.flasks[i];
    this.moving.add(i);
    await this.tweens.to(0.7, (t) => {
      f.mesh.rotation.z = t * Math.PI * 4;
      f.mesh.position.set(f.home.x, f.home.y + Math.sin(t * Math.PI) * 0.4, 0);
    }, { ease: ease.inOutCubic });
    f.mesh.rotation.z = 0;
    this.moving.delete(i);
  }

  /** Celebrate a sealed flask: a bounce. */
  async celebrate(i: number): Promise<void> {
    const f = this.flasks[i];
    await this.tweens.to(0.4, (t) => {
      f.mesh.scale.setScalar(1 + Math.sin(t * Math.PI) * 0.08);
    });
    f.mesh.scale.setScalar(1);
  }

  // ---------------------------------------------------------------- picking & screen positions

  private toClient(x: number, y: number): { x: number; y: number } {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const v = new THREE.Vector3(x, y, 0).project(this.camera);
    return { x: rect.left + ((v.x + 1) / 2) * rect.width, y: rect.top + ((1 - v.y) / 2) * rect.height };
  }

  flaskTopClient(i: number): { x: number; y: number } {
    const f = this.flasks[i];
    return this.toClient(f.home.x, f.home.y + this.flaskH(f.cap) / 2);
  }

  /** Flask under the pointer (generous hit boxes). */
  pickFlask(cx: number, cy: number): number {
    let best = -1;
    let bestD = Infinity;
    this.flasks.forEach((f, i) => {
      const h = this.flaskH(f.cap);
      const a = this.toClient(f.home.x - SPACING / 2, f.home.y + h / 2 + 0.4);
      const b = this.toClient(f.home.x + SPACING / 2, f.home.y - h / 2 - 0.2);
      if (cx < a.x || cx > b.x || cy < a.y || cy > b.y) return;
      const d = Math.abs(cx - (a.x + b.x) / 2);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return best;
  }

  /** Flask and unit index under the pointer (for the Pipette). */
  pickUnit(cx: number, cy: number): { flask: number; index: number } | null {
    const flask = this.pickFlask(cx, cy);
    if (flask < 0) return null;
    const f = this.flasks[flask];
    if (!f.units.length) return null;
    const h = this.flaskH(f.cap);
    let best = 0;
    let bestD = Infinity;
    f.units.forEach((_, j) => {
      const p = this.toClient(f.home.x, f.home.y - h / 2 + BOTTOM + (j + 0.5) * UNIT_H);
      const dd = Math.abs(p.y - cy);
      if (dd < bestD) {
        bestD = dd;
        best = j;
      }
    });
    return { flask, index: best };
  }

  // ---------------------------------------------------------------- frame

  render(dt: number): void {
    this.time += dt;
    this.tweens.update(dt);
    const board = this.board;
    this.flasks.forEach((f, i) => {
      const u = f.mat.uniforms;
      const targetLift = this.selected === i ? 0.3 : 0;
      f.lift += (targetLift - f.lift) * Math.min(1, dt * 14);
      if (!this.moving.has(i)) f.mesh.position.set(f.home.x, f.home.y + f.lift, 0);
      f.wobble = Math.max(0, f.wobble - dt * 1.5);
      u.uTime.value = this.time;
      u.uWobble.value = f.wobble * Math.sin(this.time * 9);
      u.uGlow.value = this.selected === i ? 0.9 : 0;
      u.uHint.value = f.hint;
      u.uSymbols.value = this.symbols ? 1 : 0;
      u.uSealed.value = f.sealed;
      u.uCorked.value = f.corks > 0 ? 1 : 0;
      const n = Math.min(MAX_UNITS, f.units.length);
      u.uCount.value = n;
      for (let j = 0; j < MAX_UNITS; j++) {
        const unit = f.units[j];
        const vec = u.uUnits.value[j] as THREE.Vector4;
        if (!unit) {
          u.uHeights.value[j] = 0;
          continue;
        }
        const liq = LIQUIDS[this.liquidOf(unit.slot)];
        this.tmp.set(unit.hidden ? MURKY_HEX : liq.hex);
        vec.set(this.tmp.r, this.tmp.g, this.tmp.b, unit.hidden ? -1 : liq.weight);
        u.uHeights.value[j] = unit.h;
        u.uSym.value[j] = unit.hidden ? 12 : liq.symbol;
      }
      // Cork badge
      if (f.badge) {
        const corks = f.corks;
        f.badge.hidden = corks <= 0;
        if (corks > 0) {
          const p = this.flaskTopClient(i);
          f.badge.style.left = `${p.x}px`;
          f.badge.style.top = `${p.y}px`;
          f.badge.textContent = `🍾 ${corks}`;
        }
      }
    });
    // Sinking drops
    let k = 0;
    this.dropState = this.dropState.filter((d) => {
      d.vy -= dt * 2.5;
      d.y += d.vy * dt;
      if (d.y <= d.end) d.life -= dt * 4;
      return d.life > 0;
    });
    for (const d of this.dropState) {
      if (k >= 64) break;
      this.dummy.position.set(d.x, Math.max(d.y, d.end), 2);
      this.dummy.scale.setScalar(Math.max(0.01, d.life));
      this.dummy.updateMatrix();
      this.drops.setMatrixAt(k, this.dummy.matrix);
      this.drops.setColorAt(k, d.color);
      k++;
    }
    this.drops.count = k;
    this.drops.instanceMatrix.needsUpdate = true;
    if (this.drops.instanceColor) this.drops.instanceColor.needsUpdate = true;
    if (this.pour.sparkle && this.stream.visible) (this.stream.material as THREE.MeshBasicMaterial).opacity = 0.75 + 0.25 * Math.sin(this.time * 40);
    this.renderer.render(this.scene, this.camera);
  }
}
