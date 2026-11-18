// The pond view (DESIGN.md §2): water and bank, koi as ribbon meshes that flex along their cell paths
// and swim out along them, lily pads, frogs, whirlpools, currents, picking, and the animations.
// World units: one cell = 1; cell (x, y) has its centre at world (x + 0.5, -(y + 0.5)).

import * as THREE from "three";
import { Tweens, ease } from "../../../../forge/src/core/tween.ts";
import type { Board, Dir, SwimResult } from "../logic/rules.ts";
import { DX, DY, occupancy } from "../logic/rules.ts";
import { VARIETIES } from "../data/varieties.ts";
import { MAX_RIPPLES, createKoiMaterial, createShadowMaterial, createWaterMaterial } from "./materials.ts";

const SEGS = 30;
/** Extra path behind the tail for the tail fin. */
const FIN = 0.32;
/** How much of a cell the body covers past the head and tail centres. */
const OVER = 0.42;

interface KoiV {
  mesh: THREE.Mesh;
  shadow: THREE.Mesh;
  mat: THREE.ShaderMaterial;
  geo: THREE.BufferGeometry;
  /** Path points and cumulative lengths. */
  pts: THREE.Vector2[];
  acc: number[];
  /** Arc position of the tail-fin start at rest. */
  s0: number;
  /** Current offset along the path (swimming). */
  s: number;
  bodyLen: number;
  len: number;
  phase: number;
  gone: boolean;
  swimming: boolean;
  scale: number;
}

export interface PondStyle {
  deep: string;
  shallow: string;
  stone: string;
  grass: string;
  trail: string;
}

function emojiTexture(text: string, opts: { bg?: string; fg?: string } = {}): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  const s = 96;
  c.width = c.height = s;
  const g = c.getContext("2d")!;
  if (opts.bg) {
    g.fillStyle = opts.bg;
    g.beginPath();
    g.arc(s / 2, s / 2, s * 0.46, 0, Math.PI * 2);
    g.fill();
  }
  g.font = `bold ${Math.round(s * 0.6)}px "Baloo 2", system-ui, sans-serif`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillStyle = opts.fg ?? "#000";
  g.fillText(text, s / 2, s / 2 + s * 0.04);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function padTexture(pink: boolean): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle = "#3f8a3a";
  g.beginPath();
  g.moveTo(64, 64);
  g.arc(64, 64, 58, -1.35, 4.5);
  g.closePath();
  g.fill();
  g.strokeStyle = "#5fae4a";
  g.lineWidth = 3;
  for (let a = -1.0; a < 4.3; a += 0.55) {
    g.beginPath();
    g.moveTo(64, 64);
    g.lineTo(64 + Math.cos(a) * 52, 64 + Math.sin(a) * 52);
    g.stroke();
  }
  if (pink) {
    g.fillStyle = "#f2a0c0";
    for (let k = 0; k < 6; k++) {
      g.beginPath();
      g.ellipse(64 + Math.cos(k) * 10, 64 + Math.sin(k) * 10, 14, 7, k, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = "#ffe07a";
    g.beginPath();
    g.arc(64, 64, 7, 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class PondView {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 100);
  readonly tweens = new Tweens();
  private board: Board | null = null;
  private varietyOf: number[] = [];
  private koi: KoiV[] = [];
  private props = new THREE.Group();
  private fx = new THREE.Group();
  private water: THREE.Mesh;
  private waterMat: THREE.ShaderMaterial;
  private safe = { top: 100, bottom: 120 };
  private viewW = 400;
  private viewH = 700;
  private time = 0;
  private ripples: THREE.Vector3[] = [];
  private rippleNext = 0;
  private texCache = new Map<string, THREE.CanvasTexture>();
  private glowUntil = 0;
  private glowSet = new Set<number>();
  private pinkPads = false;
  private frogs: Array<{ cell: number; sprite: THREE.Sprite; badge: THREE.Sprite }> = [];
  private whirls: THREE.Mesh[] = [];
  /** Press art: extra room around the pond, in cells. */
  framePad = { left: 0, right: 0, top: 0, bottom: 0 };
  /** The ripple trail colour (cosmetic). */
  trail = "#ffffff";

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.camera.position.set(0, 0, 10);
    this.waterMat = createWaterMaterial();
    this.ripples = this.waterMat.uniforms.uRipples.value as THREE.Vector3[];
    this.water = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.waterMat);
    this.water.renderOrder = -10;
    this.scene.add(this.water, this.props, this.fx);
  }

  private tex(key: string, make: () => THREE.CanvasTexture): THREE.CanvasTexture {
    let t = this.texCache.get(key);
    if (!t) {
      t = make();
      this.texCache.set(key, t);
    }
    return t;
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
    const def = this.board?.def;
    const W = def?.w ?? 5;
    const H = def?.h ?? 7;
    const m = 0.75;
    const fp = this.framePad;
    const [x0, y0, x1, y1] = [-m - fp.left, -H - m - fp.bottom, W + m + fp.right, m + fp.top];
    const cw = this.viewW;
    const ch = this.viewH;
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
    // The water quad fills the whole view (bank and grass beyond the pond).
    this.water.scale.set(halfW * 2 + 2, halfH * 2 + 2, 1);
    this.water.position.set(cx, cy, -5);
  }

  applyStyle(s: PondStyle): void {
    const u = this.waterMat.uniforms;
    (u.uDeep.value as THREE.Color).set(s.deep);
    (u.uShallow.value as THREE.Color).set(s.shallow);
    (u.uStone.value as THREE.Color).set(s.stone);
    (u.uGrass.value as THREE.Color).set(s.grass);
    this.trail = s.trail;
  }

  setPinkPads(on: boolean): void {
    this.pinkPads = on;
  }

  // ---------------------------------------------------------------- build

  build(b: Board, varietyOf: number[]): void {
    this.board = b;
    this.varietyOf = varietyOf;
    this.tweens.finishAll();
    for (const k of this.koi) {
      k.mesh.removeFromParent();
      k.shadow.removeFromParent();
      k.geo.dispose();
      k.mat.dispose();
    }
    this.koi = [];
    this.props.clear();
    this.fx.clear();
    this.frogs = [];
    this.whirls = [];
    const def = b.def;
    this.waterMat.uniforms.uSize.value.set(def.w, def.h);
    // Reeds: a (w+2)×(h+2) map of bank cells with reeds.
    const data = new Uint8Array((def.w + 2) * (def.h + 2) * 4);
    for (const e of def.reeds ?? []) {
      const c = Math.floor(e / 4);
      const d = e % 4;
      const x = (c % def.w) + DX[d] + 1;
      const y = Math.floor(c / def.w) + DY[d] + 1;
      data[(y * (def.w + 2) + x) * 4] = 255;
    }
    const reedTex = new THREE.DataTexture(data, def.w + 2, def.h + 2, THREE.RGBAFormat);
    reedTex.needsUpdate = true;
    (this.waterMat.uniforms.uReeds.value as THREE.DataTexture | null)?.dispose();
    this.waterMat.uniforms.uReeds.value = reedTex;
    // Lily pads and frogs.
    const padMat = new THREE.MeshBasicMaterial({ map: this.tex(`pad${this.pinkPads}`, () => padTexture(this.pinkPads)), transparent: true });
    for (const c of def.pads ?? []) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 0.92), padMat);
      m.position.set((c % def.w) + 0.5, -(Math.floor(c / def.w) + 0.5), -1);
      m.rotation.z = (c * 2.3) % 6.28;
      this.props.add(m);
    }
    for (const [c, n] of def.frogs ?? []) {
      const pad = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 0.92), padMat);
      const x = (c % def.w) + 0.5;
      const y = -(Math.floor(c / def.w) + 0.5);
      pad.position.set(x, y, -1);
      const frog = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex("frog", () => emojiTexture("🐸")), transparent: true }));
      frog.scale.set(0.75, 0.75, 1);
      frog.position.set(x, y, 2);
      const badge = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex(`n${n}`, () => emojiTexture(String(n), { bg: "#2f6f3a", fg: "#fff" })), transparent: true }));
      badge.scale.set(0.34, 0.34, 1);
      badge.position.set(x + 0.3, y + 0.3, 3);
      this.props.add(pad, frog, badge);
      this.frogs.push({ cell: c, sprite: frog, badge });
      (pad.userData as { frogPad?: number }).frogPad = c;
    }
    // Whirlpools and currents.
    for (const c of def.whirls ?? []) {
      const m = new THREE.Mesh(
        new THREE.CircleGeometry(0.62, 40),
        new THREE.ShaderMaterial({
          transparent: true,
          uniforms: { uTime: { value: 0 } },
          vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
          fragmentShader: `uniform float uTime; varying vec2 vUv;
            void main(){ vec2 p = vUv - 0.5; float r = length(p) * 2.0; float a = atan(p.y, p.x);
              float sw = sin(a * 3.0 + r * 9.0 - uTime * 4.0);
              float al = smoothstep(1.0, 0.55, r) * (0.35 + 0.35 * sw);
              gl_FragColor = vec4(vec3(0.85, 0.95, 1.0), al); }`,
        }),
      );
      m.position.set((c % def.w) + 0.5, -(Math.floor(c / def.w) + 0.5), 1.5);
      m.renderOrder = 5;
      this.props.add(m);
      this.whirls.push(m);
    }
    for (const [c, d] of def.currents ?? []) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex("arrow", () => emojiTexture("➜", { fg: "#e8fbff" })), transparent: true, opacity: 0.8, rotation: -((d - 1) * Math.PI) / 2 }));
      s.scale.set(0.7, 0.7, 1);
      s.position.set((c % def.w) + 0.5, -(Math.floor(c / def.w) + 0.5), -0.4);
      this.props.add(s);
    }
    // Koi.
    def.koi.forEach((_, i) => this.koi.push(this.makeKoi(i)));
    this.fit();
    this.sync(b);
  }

  private center(c: number): THREE.Vector2 {
    const w = this.board!.def.w;
    return new THREE.Vector2((c % w) + 0.5, -(Math.floor(c / w) + 0.5));
  }

  /** The path a koi lies on: tail fin, body (tail to head), then its way out (or as far as it gets). */
  private pathFor(i: number, ray: number[] = [], exitDir?: Dir, extra = 4): { pts: THREE.Vector2[]; s0: number; bodyLen: number } {
    const b = this.board!;
    const k = b.def.koi[i];
    const cells = k.c.slice().reverse(); // tail first
    const centers = cells.map((c) => this.center(c));
    const head = centers[centers.length - 1];
    const hd = b.dir[i];
    const headDir = new THREE.Vector2(DX[hd], -DY[hd]);
    const tailDir = centers.length > 1 ? centers[0].clone().sub(centers[1]).normalize() : headDir.clone().negate();
    const tailEnd = centers[0].clone().addScaledVector(tailDir, OVER + FIN);
    const pts: THREE.Vector2[] = [tailEnd, ...centers];
    for (const c of ray) pts.push(this.center(c));
    // Swim on off the pond.
    const last = pts[pts.length - 1];
    const dir = exitDir !== undefined ? new THREE.Vector2(DX[exitDir], -DY[exitDir]) : headDir;
    if (!ray.length && exitDir === undefined) pts.push(head.clone().addScaledVector(headDir, OVER + 0.2));
    for (let e = 1; e <= extra; e++) pts.push(last.clone().addScaledVector(dir, e));
    // Round the corners (Chaikin, twice), keeping the ends.
    let sm = pts;
    for (let it = 0; it < 2; it++) {
      const out: THREE.Vector2[] = [sm[0]];
      for (let j = 0; j < sm.length - 1; j++) {
        const a = sm[j];
        const c2 = sm[j + 1];
        out.push(a.clone().lerp(c2, 0.25), a.clone().lerp(c2, 0.75));
      }
      out.push(sm[sm.length - 1]);
      sm = out;
    }
    const bodyLen = k.c.length - 1 + OVER * 2;
    return { pts: sm, s0: 0, bodyLen };
  }

  private setPath(kv: KoiV, pts: THREE.Vector2[]): void {
    kv.pts = pts;
    kv.acc = [0];
    for (let j = 1; j < pts.length; j++) kv.acc.push(kv.acc[j - 1] + pts[j].distanceTo(pts[j - 1]));
  }

  /** Point and tangent at arc length a along a koi's path. */
  private at(kv: KoiV, a: number): { p: THREE.Vector2; t: THREE.Vector2 } {
    const { pts, acc } = kv;
    if (a <= 0) {
      const t = pts[1].clone().sub(pts[0]).normalize();
      return { p: pts[0].clone().addScaledVector(t, a), t };
    }
    let j = 1;
    while (j < acc.length - 1 && acc[j] < a) j++;
    const seg = acc[j] - acc[j - 1] || 1e-6;
    const f = Math.min(1, (a - acc[j - 1]) / seg);
    const t = pts[j].clone().sub(pts[j - 1]).normalize();
    return { p: pts[j - 1].clone().lerp(pts[j], f), t };
  }

  private makeKoi(i: number): KoiV {
    const b = this.board!;
    const k = b.def.koi[i];
    const geo = new THREE.BufferGeometry();
    const n = (SEGS + 1) * 2;
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const uv = new Float32Array(n * 2);
    const idx: number[] = [];
    for (let j = 0; j <= SEGS; j++) {
      uv[j * 4] = j / SEGS;
      uv[j * 4 + 1] = -1;
      uv[j * 4 + 2] = j / SEGS;
      uv[j * 4 + 3] = 1;
      if (j < SEGS) {
        const a = j * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    geo.setIndex(idx);
    const mat = createKoiMaterial();
    const v = VARIETIES[this.varietyOf[i] ?? 0];
    mat.uniforms.uBase.value.set(v.colors[0]);
    mat.uniforms.uSpot.value.set(v.colors[1]);
    mat.uniforms.uSpot2.value.set(v.colors[2]);
    mat.uniforms.uPattern.value = v.pattern;
    mat.uniforms.uSeed.value = (i * 7.31) % 50;
    mat.uniforms.uLen.value = Math.max(1, k.c.length);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = 2;
    const shadow = new THREE.Mesh(geo, createShadowMaterial());
    shadow.position.set(0.08, -0.12, -0.2);
    shadow.renderOrder = 1;
    this.scene.add(shadow, mesh);
    const kv: KoiV = { mesh, shadow, mat, geo, pts: [], acc: [], s0: 0, s: 0, bodyLen: 1, len: k.c.length, phase: i * 1.7, gone: false, swimming: false, scale: 1 };
    const path = this.pathFor(i);
    this.setPath(kv, path.pts);
    kv.bodyLen = path.bodyLen;
    mat.uniforms.uFin.value = FIN / (FIN + kv.bodyLen);
    mat.uniforms.uBody.value = kv.bodyLen;
    return kv;
  }

  /** Rebuild every koi's rest pose and visibility from the board (undo, restart, turns). */
  sync(b: Board): void {
    this.board = b;
    this.tweens.finishAll();
    b.def.koi.forEach((_, i) => {
      const kv = this.koi[i];
      if (!kv) return;
      kv.gone = b.out[i];
      kv.mesh.visible = kv.shadow.visible = !kv.gone;
      kv.swimming = false;
      kv.s = 0;
      kv.scale = 1;
      kv.mat.uniforms.uAlpha.value = 1;
      const path = this.pathFor(i);
      this.setPath(kv, path.pts);
    });
    this.syncFrogs(b);
  }

  private syncFrogs(b: Board): void {
    for (const f of this.frogs) {
      const n = b.def.frogs!.find(([c]) => c === f.cell)![1];
      const here = b.escaped < n;
      f.sprite.visible = here;
      f.badge.visible = here;
      if (here) f.badge.material.map = this.tex(`n${n - b.escaped}`, () => emojiTexture(String(n - b.escaped), { bg: "#2f6f3a", fg: "#fff" }));
      this.props.children.forEach((o) => {
        if ((o.userData as { frogPad?: number }).frogPad === f.cell) o.visible = here;
      });
    }
  }

  // ---------------------------------------------------------------- picking

  /** The koi under a client point (with a little margin), or -1. */
  pick(clientX: number, clientY: number): number {
    const b = this.board;
    if (!b) return -1;
    const r = this.renderer.domElement.getBoundingClientRect();
    const x = this.camera.left + ((clientX - r.left) / r.width) * (this.camera.right - this.camera.left);
    const y = this.camera.top - ((clientY - r.top) / r.height) * (this.camera.top - this.camera.bottom);
    const px = x;
    const py = -y;
    const def = b.def;
    const occ = occupancy(b);
    let best = -1;
    let bestD = 0.75;
    const cx = Math.floor(px);
    const cy = Math.floor(py);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const gx = cx + dx;
        const gy = cy + dy;
        if (gx < 0 || gy < 0 || gx >= def.w || gy >= def.h) continue;
        const k = occ[gy * def.w + gx];
        if (k < 0) continue;
        const d = Math.hypot(px - (gx + 0.5), py - (gy + 0.5));
        if (d < bestD) {
          bestD = d;
          best = k;
        }
      }
    }
    return best;
  }

  /** A client point in pond cells (x right, y down). */
  clientToPond(clientX: number, clientY: number): { x: number; y: number } {
    const r = this.renderer.domElement.getBoundingClientRect();
    const x = this.camera.left + ((clientX - r.left) / r.width) * (this.camera.right - this.camera.left);
    const y = this.camera.top - ((clientY - r.top) / r.height) * (this.camera.top - this.camera.bottom);
    return { x, y: -y };
  }

  /** Client point of a cell's centre. */
  cellClient(c: number): { x: number; y: number } | null {
    return this.board ? this.toClient(this.center(c)) : null;
  }

  /** Client point of a koi's head (for the coach's hand). */
  koiClient(i: number): { x: number; y: number } | null {
    const b = this.board;
    if (!b || b.out[i]) return null;
    const p = this.center(b.def.koi[i].c[0]);
    return this.toClient(p);
  }

  private toClient(p: THREE.Vector2): { x: number; y: number } {
    const r = this.renderer.domElement.getBoundingClientRect();
    return {
      x: r.left + ((p.x - this.camera.left) / (this.camera.right - this.camera.left)) * r.width,
      y: r.top + ((this.camera.top - p.y) / (this.camera.top - this.camera.bottom)) * r.height,
    };
  }

  // ---------------------------------------------------------------- animation

  private ripple(p: THREE.Vector2): void {
    const r = this.ripples[this.rippleNext];
    r.set(p.x, -p.y, this.time);
    this.rippleNext = (this.rippleNext + 1) % MAX_RIPPLES;
  }

  /** Koi i swims out along its way (the rules already let it go). */
  async swimOut(i: number, res: SwimResult): Promise<void> {
    const kv = this.koi[i];
    const path = this.pathFor(i, res.ray, res.exitDir, Math.ceil(kv.bodyLen) + 3);
    this.setPath(kv, path.pts);
    kv.swimming = true;
    const dist = res.ray.length + kv.bodyLen + 3;
    let nextRipple = 0;
    await this.tweens.to(
      0.2 + dist / 13,
      (t) => {
        kv.s = t * dist;
        if (kv.s > nextRipple) {
          nextRipple += 1.2;
          this.ripple(this.at(kv, kv.s + FIN + kv.bodyLen).p);
        }
      },
      { ease: ease.inQuad },
    );
    kv.gone = true;
    kv.swimming = false;
    kv.mesh.visible = kv.shadow.visible = false;
    this.syncFrogs(this.board!);
  }

  /** Koi i swims up to what blocks it, bumps its nose and swims back. */
  async bump(i: number, res: SwimResult): Promise<void> {
    const kv = this.koi[i];
    const path = this.pathFor(i, res.ray, res.exitDir, 2);
    this.setPath(kv, path.pts);
    kv.swimming = true;
    const reach = res.ray.length + (res.blocker === -1 ? 0.45 : 0.12);
    await this.tweens.to(0.12 + reach * 0.06, (t) => (kv.s = t * reach), { ease: ease.outQuad });
    const head = this.at(kv, kv.s + FIN + kv.bodyLen).p;
    this.ripple(head);
    this.spark(head, "💢");
    await this.tweens.to(0.25 + reach * 0.05, (t) => (kv.s = (1 - t) * reach), { ease: ease.inOutQuad });
    kv.swimming = false;
    kv.s = 0;
    this.setPath(kv, this.pathFor(i).pts);
  }

  /** Net: koi i is lifted out of the water. */
  async lift(i: number): Promise<void> {
    const kv = this.koi[i];
    this.ripple(this.at(kv, FIN + kv.bodyLen / 2).p);
    await this.tweens.to(0.45, (t) => {
      kv.scale = 1 + t * 0.35;
      kv.mat.uniforms.uAlpha.value = 1 - t;
    });
    kv.gone = true;
    kv.mesh.visible = kv.shadow.visible = false;
    this.syncFrogs(this.board!);
  }

  /** Press art: freeze koi i part-way along its way out (s cells), with ripples behind it. */
  stage(i: number, res: SwimResult, s: number): void {
    const kv = this.koi[i];
    this.setPath(kv, this.pathFor(i, res.ray, res.exitDir, Math.ceil(kv.bodyLen) + 3).pts);
    kv.swimming = true;
    kv.s = s;
    for (let k = 0; k < 3; k++) this.ripples[k].set(0, 0, -99);
    const head = this.at(kv, s + FIN + kv.bodyLen).p;
    const tail = this.at(kv, s + FIN).p;
    this.ripples[0].set(head.x, -head.y, this.time - 0.3);
    this.ripples[1].set(tail.x, -tail.y, this.time - 0.8);
  }

  /** Whirlpool fry and Bread turns: re-aim the head. */
  reaim(b: Board): void {
    this.board = b;
    b.def.koi.forEach((_, i) => {
      const kv = this.koi[i];
      if (kv && !kv.gone && !kv.swimming) this.setPath(kv, this.pathFor(i).pts);
    });
  }

  private spark(p: THREE.Vector2, icon: string): void {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex(icon, () => emojiTexture(icon)), transparent: true, depthTest: false }));
    sp.position.set(p.x, p.y, 5);
    sp.renderOrder = 10;
    this.fx.add(sp);
    void this.tweens
      .to(0.5, (t) => {
        sp.scale.setScalar(0.35 + t * 0.4);
        (sp.material as THREE.SpriteMaterial).opacity = 1 - t;
      })
      .then(() => sp.removeFromParent());
  }

  /** The pond is clear: a burst of ripples and petals. */
  celebrate(): void {
    const def = this.board!.def;
    for (let k = 0; k < MAX_RIPPLES; k++) {
      const p = new THREE.Vector2(Math.random() * def.w, -Math.random() * def.h);
      setTimeout(() => this.ripple(p), k * 90);
    }
    for (let k = 0; k < 8; k++) this.spark(new THREE.Vector2(Math.random() * def.w, -Math.random() * def.h), "🌸");
  }

  /** Glow: koi that can leave now shine for a few seconds. */
  glow(koi: number[], seconds = 3): void {
    this.glowSet = new Set(koi);
    this.glowUntil = this.time + seconds;
  }

  // ---------------------------------------------------------------- frame

  render(dt: number): void {
    this.time += dt;
    this.tweens.update(dt);
    this.waterMat.uniforms.uTime.value = this.time;
    for (const w of this.whirls) (w.material as THREE.ShaderMaterial).uniforms.uTime.value = this.time;
    const glowing = this.time < this.glowUntil;
    this.koi.forEach((kv, i) => {
      if (kv.gone) return;
      kv.mat.uniforms.uGlow.value = glowing && this.glowSet.has(i) ? 0.5 + 0.5 * Math.sin(this.time * 8) : 0;
      this.updateStrip(kv);
    });
    this.renderer.render(this.scene, this.camera);
  }

  private updateStrip(kv: KoiV): void {
    const pos = kv.geo.getAttribute("position") as THREE.BufferAttribute;
    const total = FIN + kv.bodyLen;
    const uf = FIN / total;
    const wig = kv.swimming ? 0.09 : 0.045;
    const speed = kv.swimming ? 11 : 3.2;
    const thin = kv.len === 1 ? 0.85 : 1;
    for (let j = 0; j <= SEGS; j++) {
      const u = j / SEGS;
      const a = kv.s + u * total;
      const { p, t } = this.at(kv, a);
      const nrm = new THREE.Vector2(-t.y, t.x);
      let w: number;
      if (u < uf) {
        const f = u / uf;
        w = 0.07 + 0.27 * Math.pow(1 - f, 1.3);
      } else {
        // Measured in cells from the tail joint (dt) and from the nose (dh), so long koi keep a
        // round head and a short tail taper instead of stretching into a snake.
        const bArc = ((u - uf) / (1 - uf)) * kv.bodyLen;
        const dt = bArc;
        const dh = kv.bodyLen - bArc;
        const taper = Math.min(1, 0.22 + 0.78 * Math.sqrt(Math.min(1, dt / Math.min(0.95, kv.bodyLen * 0.55))));
        const cap = 0.3;
        const head = dh >= cap ? 1 : Math.sqrt(Math.max(0, 1 - Math.pow((cap - dh) / cap, 2)));
        w = 0.31 * taper * head + 0.035 * Math.exp(-Math.pow((dh - 0.9) / 0.45, 2));
        w += 0.085 * Math.exp(-Math.pow((dh - 0.72) / 0.1, 2)) * head;
      }
      w *= thin * kv.scale;
      const side = wig * Math.pow(1 - u, 2) * Math.sin(this.time * speed + kv.phase - u * 6);
      const cx = p.x + nrm.x * side;
      const cy = p.y + nrm.y * side;
      pos.setXYZ(j * 2, cx - nrm.x * w, cy - nrm.y * w, 0);
      pos.setXYZ(j * 2 + 1, cx + nrm.x * w, cy + nrm.y * w, 0);
    }
    pos.needsUpdate = true;
    kv.geo.computeBoundingSphere();
  }
}
