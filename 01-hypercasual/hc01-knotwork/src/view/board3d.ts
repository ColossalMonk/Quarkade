// The 3D board: needles, yarn loops, animations and tap picking.
// The view tracks loop identity so moves animate the right loops; the rules module stays pure.

import * as THREE from "three";
import { Tweens, ease } from "../../../../forge/src/core/tween.ts";
import type { Board, MothState } from "../logic/rules.ts";
import { coloursOf, isTied, MOTH_TIMER } from "../logic/rules.ts";
import { YARNS, HIDDEN_HEX } from "../data/palette.ts";
import type { KnitUniforms } from "./materials.ts";
import {
  createFeltTexture,
  createKnitMaterial,
  createPicnicTexture,
  createShadowTexture,
  createStarryTexture,
  createStripeTexture,
  createWoodTexture,
} from "./materials.ts";
import type { BoardStyle, NeedleStyle, YarnStyle } from "../data/cosmetics.ts";

const NO_SYMBOL = 12;

const SPACING = 1.32;
const ROW_GAP = 4.2;
const LOOP_H = 0.29;
const BASE_Y = 0.1;
const MAX_LOOPS = 96;
const PITCH = THREE.MathUtils.degToRad(32);

interface LoopV {
  id: number;
  colour: number; // yarn index, or -1 = hidden
  colour2: number; // second yarn of a twisted loop (= colour for plain loops)
  tied: boolean; // knotted to the loop above it
  pos: THREE.Vector3;
  scale: number;
  spin: number;
  visible: boolean;
}

interface NeedleV {
  group: THREE.Group;
  ball: THREE.Mesh;
  ring: THREE.Mesh;
  shaft: THREE.Mesh;
  x: number;
  z: number;
  cap: number;
  locked: boolean;
  pulse: number;
}

export class BoardView {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(30, 1, 0.1, 200);
  readonly tweens = new Tweens();

  private loopMesh: THREE.InstancedMesh;
  private loops: LoopV[] = [];
  private stacks: number[][] = [];
  private basketIds: number[] = [];
  private needles: NeedleV[] = [];
  private needleRoot = new THREE.Group();
  private boardMesh: THREE.Mesh;
  private shadowTex = createShadowTexture();
  private lifted: { needle: number; count: number } | null = null;
  private hintPair: [number, number] | null = null;
  private time = 0;
  private yarnOfSlot: (slot: number) => number = (s) => s;
  private dummy = new THREE.Object3D();
  private tmpColor = new THREE.Color();
  private lookTarget = new THREE.Vector3();

  private woodMat: THREE.MeshStandardMaterial;
  private ballMat: THREE.MeshStandardMaterial;
  private goldMat: THREE.MeshStandardMaterial;

  private colour2: THREE.InstancedBufferAttribute;
  private symbols: THREE.InstancedBufferAttribute;
  private knitMat: THREE.MeshStandardMaterial;
  private knitUniforms: KnitUniforms;
  private boardTextures = new Map<string, THREE.Texture>();
  /** Screen space kept free for the HUD, in CSS pixels. */
  private safe = { top: 96, bottom: 84, left: 0 };
  private knotMesh: THREE.InstancedMesh;
  private moth: MothState | null = null;
  private mothGroup = new THREE.Group();
  private mothWings: THREE.Mesh[] = [];
  private mothPos = new THREE.Vector3();
  private mothFlying = false;
  private mothBadge: HTMLDivElement | null = null;

  constructor(canvas: HTMLCanvasElement, overlay?: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.setClearColor(0x000000, 0);

    this.scene.add(new THREE.HemisphereLight(0xfff3df, 0x7a5638, 1.25));
    const sun = new THREE.DirectionalLight(0xfff0d8, 1.7);
    sun.position.set(3, 9, 7);
    this.scene.add(sun);
    const fill = new THREE.DirectionalLight(0xd8e6ff, 0.35);
    fill.position.set(-6, 3, -2);
    this.scene.add(fill);

    const wood = createWoodTexture();
    wood.repeat.set(2, 2);
    this.boardTextures.set("wood", wood);
    this.boardMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshStandardMaterial({ map: wood, roughness: 0.75, color: 0xffffff }),
    );
    this.boardMesh.rotation.x = -Math.PI / 2;
    this.scene.add(this.boardMesh);
    this.scene.add(this.needleRoot);

    this.woodMat = new THREE.MeshStandardMaterial({ color: 0xd9a46a, roughness: 0.55 });
    this.ballMat = new THREE.MeshStandardMaterial({ color: 0x9b6438, roughness: 0.45 });
    this.goldMat = new THREE.MeshStandardMaterial({ color: 0xf2c14e, roughness: 0.3, metalness: 0.35, emissive: 0x6b4a00, emissiveIntensity: 0.4 });

    const geo = new THREE.TorusGeometry(0.44, 0.155, 12, 32);
    geo.rotateX(Math.PI / 2);
    geo.scale(1, 0.85, 1);
    this.colour2 = new THREE.InstancedBufferAttribute(new Float32Array(MAX_LOOPS * 3).fill(1), 3);
    geo.setAttribute("aColor2", this.colour2);
    this.symbols = new THREE.InstancedBufferAttribute(new Float32Array(MAX_LOOPS * 2).fill(NO_SYMBOL), 2);
    geo.setAttribute("aSymbol", this.symbols);
    const knit = createKnitMaterial();
    this.knitMat = knit.material;
    this.knitUniforms = knit.uniforms;
    this.loopMesh = new THREE.InstancedMesh(geo, this.knitMat, MAX_LOOPS);
    this.loopMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < MAX_LOOPS; i++) this.loopMesh.setColorAt(i, this.tmpColor.set(0xffffff));
    this.loopMesh.count = 0;
    this.loopMesh.frustumCulled = false;
    this.scene.add(this.loopMesh);

    // Knots: a small bead where two loops are tied together.
    this.knotMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.1, 12, 8), new THREE.MeshStandardMaterial({ roughness: 0.8 }), MAX_LOOPS);
    for (let i = 0; i < MAX_LOOPS; i++) this.knotMesh.setColorAt(i, this.tmpColor.set(0xffffff));
    this.knotMesh.count = 0;
    this.knotMesh.frustumCulled = false;
    this.scene.add(this.knotMesh);

    this.buildMoth();
    if (overlay) {
      this.mothBadge = document.createElement("div");
      this.mothBadge.className = "moth-badge";
      this.mothBadge.hidden = true;
      overlay.append(this.mothBadge);
    }
  }

  // ---------- cosmetics / accessibility / framing ----------

  applyCosmetics(yarn: YarnStyle, needle: NeedleStyle, board: BoardStyle): void {
    this.knitUniforms.uStitch.value = yarn.stitch;
    this.knitUniforms.uFuzz.value = yarn.fuzz;
    this.knitUniforms.uRainbow.value = yarn.rainbow;
    this.knitMat.metalness = yarn.metal;
    this.knitMat.roughness = yarn.rough;

    this.woodMat.color.set(needle.color);
    this.woodMat.metalness = needle.metal;
    this.woodMat.roughness = needle.rough;
    this.woodMat.emissive.set(needle.emissive ?? 0x000000);
    this.woodMat.transparent = (needle.opacity ?? 1) < 1;
    this.woodMat.opacity = needle.opacity ?? 1;
    this.woodMat.map = needle.stripes ? createStripeTexture(needle.stripes[0], needle.stripes[1]) : null;
    this.woodMat.needsUpdate = true;
    this.ballMat.color.set(needle.ball);
    this.ballMat.metalness = needle.metal;
    this.ballMat.roughness = needle.rough;
    this.ballMat.emissive.set(needle.emissive ?? 0x000000);

    let tex = this.boardTextures.get(board.kind);
    if (!tex) {
      tex = board.kind === "felt" ? createFeltTexture() : board.kind === "picnic" ? createPicnicTexture() : createStarryTexture();
      (tex as THREE.CanvasTexture).repeat.set(board.kind === "picnic" ? 6 : 2, board.kind === "picnic" ? 6 : 2);
      this.boardTextures.set(board.kind, tex);
    }
    const bm = this.boardMesh.material as THREE.MeshStandardMaterial;
    bm.map = tex;
    bm.roughness = board.kind === "felt" ? 1 : 0.75;
    bm.needsUpdate = true;
  }

  setSymbols(on: boolean): void {
    this.knitUniforms.uSymbols.value = on ? 1 : 0;
  }

  /** Keep the board clear of HUD bars: pixels at the top, bottom and left (side panel). */
  setSafeArea(top: number, bottom: number, left = 0): void {
    this.safe = { top, bottom, left };
    this.fitCamera();
  }

  private buildMoth(): void {
    const furry = new THREE.MeshStandardMaterial({ color: 0x5e4a38, roughness: 1 });
    const wingMat = new THREE.MeshStandardMaterial({ color: 0xc79a66, roughness: 0.85, side: THREE.DoubleSide, emissive: 0x2a1a08 });
    const spotMat = new THREE.MeshStandardMaterial({ color: 0x3b2a1e, roughness: 0.8 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.24, 4, 8), furry);
    body.rotation.x = Math.PI / 2;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), furry);
    head.position.z = 0.19;
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.quadraticCurveTo(0.42, 0.18, 0.38, -0.12);
    shape.quadraticCurveTo(0.25, -0.3, 0, -0.12);
    const wingGeo = new THREE.ShapeGeometry(shape);
    wingGeo.rotateX(-Math.PI / 2);
    for (const side of [1, -1]) {
      const pivot = new THREE.Group();
      const wing = new THREE.Mesh(wingGeo, wingMat);
      wing.scale.x = side;
      // An eye-spot on each wing so the moth reads at a glance.
      const spot = new THREE.Mesh(new THREE.CircleGeometry(0.06, 14), spotMat);
      spot.rotation.x = -Math.PI / 2;
      spot.position.set(0.22, 0.004, -0.05);
      wing.add(spot);
      pivot.add(wing);
      pivot.position.z = 0.05;
      this.mothGroup.add(pivot);
      this.mothWings.push(wing);
    }
    this.mothGroup.add(body, head);
    this.mothGroup.scale.setScalar(1.8);
    this.mothGroup.visible = false;
    this.scene.add(this.mothGroup);
  }

  private mothRest(needle: number, out = new THREE.Vector3()): THREE.Vector3 {
    const nd = this.needles[needle];
    return out.set(nd.x, this.needleHeight(nd.cap) + 0.42, nd.z);
  }

  /** Show / move / remove the moth. */
  setMoth(moth: MothState | null, animate = true): void {
    const prev = this.moth;
    this.moth = moth ? { ...moth } : null;
    if (!moth || !this.needles[moth.needle]) {
      if (prev && animate) {
        const from = this.mothPos.clone();
        this.mothFlying = true;
        void this.tweens.to(0.6, (t) => this.mothPos.lerpVectors(from, from.clone().add(new THREE.Vector3(3, 4, 2)), t)).then(() => {
          this.mothFlying = false;
          this.mothGroup.visible = false;
        });
      } else this.mothGroup.visible = false;
      return;
    }
    this.mothGroup.visible = true;
    const to = this.mothRest(moth.needle);
    if (prev && prev.needle !== moth.needle && animate) {
      const from = this.mothPos.clone();
      const mid = from.clone().lerp(to, 0.5);
      mid.y += 1.4;
      this.mothFlying = true;
      void this.tweens.to(0.55, (t) => {
        const a = 1 - t;
        this.mothPos.set(a * a * from.x + 2 * a * t * mid.x + t * t * to.x, a * a * from.y + 2 * a * t * mid.y + t * t * to.y, a * a * from.z + 2 * a * t * mid.z + t * t * to.z);
      }, { ease: ease.inOutQuad }).then(() => (this.mothFlying = false));
    } else if (!this.mothFlying) {
      this.mothPos.copy(to);
    }
  }

  // ---------- layout ----------

  /** Narrow (portrait phone) screens use more rows so loops stay big and the height is used. */
  private maxCols(): number {
    const a = this.camera.aspect;
    return a < 0.62 ? 4 : a < 0.9 ? 5 : 7;
  }

  private layoutPositions(caps: number[]): Array<{ x: number; z: number }> {
    const n = caps.length;
    const rows = Math.max(1, Math.ceil(n / this.maxCols()));
    const base = Math.floor(n / rows);
    const extra = n % rows; // back rows take the extra needles
    const out: Array<{ x: number; z: number }> = [];
    let i = 0;
    for (let r = 0; r < rows; r++) {
      const count = base + (r < extra ? 1 : 0);
      for (let col = 0; col < count; col++, i++) {
        const x = (col - (count - 1) / 2) * SPACING;
        const z = (r - (rows - 1) / 2) * ROW_GAP;
        out.push({ x, z });
      }
    }
    return out;
  }

  private layoutKey = "";

  /** Re-place needles and loops (after a resize changes the number of columns). */
  private relayout(): void {
    const pos = this.layoutPositions(this.needles.map((nd) => nd.cap));
    this.needles.forEach((nd, i) => {
      nd.x = pos[i].x;
      nd.z = pos[i].z;
      nd.group.position.set(nd.x, 0, nd.z);
    });
    this.stacks.forEach((st, i) => st.forEach((id, j) => this.loops[id].pos.copy(this.slotPos(i, j))));
    this.lifted = null;
  }

  private needleHeight(cap: number): number {
    return BASE_Y + cap * LOOP_H + 0.55;
  }

  slotPos(needle: number, j: number, out = new THREE.Vector3()): THREE.Vector3 {
    const nd = this.needles[needle];
    return out.set(nd.x, BASE_Y + LOOP_H * (j + 0.5), nd.z);
  }

  private liftPos(needle: number, k: number, out = new THREE.Vector3()): THREE.Vector3 {
    const nd = this.needles[needle];
    return out.set(nd.x, this.needleHeight(nd.cap) + 0.35 + k * LOOP_H, nd.z);
  }

  private makeNeedle(cap: number, x: number, z: number): NeedleV {
    const group = new THREE.Group();
    const h = this.needleHeight(cap);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, h, 10), this.woodMat);
    shaft.position.y = h / 2;
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), this.ballMat);
    ball.position.y = h + 0.05;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.56, 0.08, 24), this.woodMat);
    base.position.y = 0.04;
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.7, 1.7),
      new THREE.MeshBasicMaterial({ map: this.shadowTex, transparent: true, depthWrite: false }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.005;
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.58, 0.04, 8, 40),
      new THREE.MeshBasicMaterial({ color: 0xfff1b8, transparent: true, opacity: 0 }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.1;
    group.add(shadow, base, shaft, ball, ring);
    group.position.set(x, 0, z);
    this.needleRoot.add(group);
    return { group, ball, ring, shaft, x, z, cap, locked: false, pulse: 0 };
  }

  private fitCamera(): void {
    if (!this.needles.length) return;
    const xs = this.needles.map((n) => n.x);
    const zs = this.needles.map((n) => n.z);
    const maxH = Math.max(...this.needles.map((n) => this.needleHeight(n.cap))) + 1.2;
    const minX = Math.min(...xs) - 0.8;
    const maxX = Math.max(...xs) + 0.8;
    const minZ = Math.min(...zs) - 0.7;
    const maxZ = Math.max(...zs) + 0.7;
    const cy = maxH * 0.42;
    this.lookTarget.set(0, cy, (minZ + maxZ) / 2);
    const corners: THREE.Vector3[] = [];
    for (const x of [minX, maxX]) for (const y of [0, maxH]) for (const z of [minZ, maxZ]) corners.push(new THREE.Vector3(x, y, z));
    const dir = new THREE.Vector3(0, Math.sin(PITCH), Math.cos(PITCH));
    // Leave room for the HUD bars (measured by the UI and passed in with setSafeArea).
    const h = Math.max(1, this.renderer.domElement.clientHeight);
    const yMax = Math.min(0.9, 1 - (2 * this.safe.top) / h - 0.03);
    const yMin = Math.max(-0.9, -1 + (2 * this.safe.bottom) / h + 0.03);
    const fits = (d: number) => {
      this.camera.position.copy(this.lookTarget).addScaledVector(dir, d);
      this.camera.lookAt(this.lookTarget);
      this.camera.updateMatrixWorld();
      const v = new THREE.Vector3();
      for (const c of corners) {
        v.copy(c).project(this.camera);
        if (v.x < -0.94 || v.x > 0.94 || v.y < yMin || v.y > yMax) return false;
      }
      return true;
    };
    let lo = 4;
    let hi = 120;
    for (let i = 0; i < 28; i++) {
      const mid = (lo + hi) / 2;
      if (fits(mid)) hi = mid;
      else lo = mid;
    }
    fits(hi);
    // Shift the view so the board's projected centre sits slightly above screen centre.
    const sizeX = maxX - minX + 6;
    const sizeZ = maxZ - minZ + 8;
    this.boardMesh.scale.set(Math.max(14, sizeX * 2), Math.max(12, sizeZ * 2), 1);
    this.boardMesh.position.set(0, 0, (minZ + maxZ) / 2);
  }

  resize(width: number, height: number): void {
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
    const key = `${this.maxCols()}:${this.needles.length}`;
    if (key !== this.layoutKey && this.needles.length) {
      this.layoutKey = key;
      this.tweens.finishAll();
      this.relayout();
    }
    this.fitCamera();
  }

  // ---------- building ----------

  /** Rebuild everything from a board (new level, undo). */
  build(board: Board, yarnOfSlot: (slot: number) => number): void {
    this.yarnOfSlot = yarnOfSlot;
    for (const n of this.needles) this.needleRoot.remove(n.group);
    this.needles = [];
    this.loops = [];
    this.stacks = [];
    this.basketIds = [];
    this.lifted = null;
    this.hintPair = null;
    this.tweens.finishAll();
    const pos = this.layoutPositions(board.caps);
    board.caps.forEach((cap, i) => this.needles.push(this.makeNeedle(cap, pos[i].x, pos[i].z)));
    let id = 0;
    board.stacks.forEach((s, i) => {
      const ids: number[] = [];
      s.forEach((slot, j) => {
        const lv: LoopV = {
          id,
          colour: board.hidden[i][j] ? -1 : this.yarnOfSlot(coloursOf(slot)[0]),
          colour2: -1,
          tied: false,
          pos: this.slotPos(i, j),
          scale: 1,
          spin: Math.random() * Math.PI * 2,
          visible: true,
        };
        this.loops.push(lv);
        ids.push(id++);
      });
      this.stacks.push(ids);
    });
    for (const slot of board.basket) {
      const cs = coloursOf(slot);
      this.loops.push({
        id,
        colour: this.yarnOfSlot(cs[0]),
        colour2: this.yarnOfSlot(cs[cs.length - 1]),
        tied: false,
        pos: new THREE.Vector3(),
        scale: 0,
        spin: 0,
        visible: false,
      });
      this.basketIds.push(id++);
    }
    board.locked.forEach((l, i) => this.setLocked(i, l, false));
    this.layoutKey = `${this.maxCols()}:${this.needles.length}`;
    this.fitCamera();
    this.syncColours(board);
    this.moth = null;
    this.mothFlying = false;
    this.setMoth(board.moth, false);
  }

  /** Recolour loops from the board (hidden reveals, colour mapping). */
  syncColours(board: Board): void {
    board.stacks.forEach((s, i) => {
      s.forEach((v, j) => {
        const id = this.stacks[i]?.[j];
        if (id === undefined) return;
        const lv = this.loops[id];
        const cs = coloursOf(v);
        const hidden = board.hidden[i][j];
        lv.colour = hidden ? -1 : this.yarnOfSlot(cs[0]);
        lv.colour2 = hidden ? -1 : this.yarnOfSlot(cs[cs.length - 1]);
        lv.tied = isTied(v);
      });
    });
    this.loopMesh.count = this.loops.length;
    const arr = this.colour2.array as Float32Array;
    this.loops.forEach((lv, idx) => {
      this.tmpColor.set(lv.colour < 0 ? HIDDEN_HEX : YARNS[lv.colour].hex);
      this.loopMesh.setColorAt(idx, this.tmpColor);
      this.knotMesh.setColorAt(idx, this.tmpColor.multiplyScalar(0.6));
      this.tmpColor.set(lv.colour2 < 0 ? (lv.colour < 0 ? HIDDEN_HEX : YARNS[lv.colour].hex) : YARNS[lv.colour2].hex);
      arr[idx * 3] = this.tmpColor.r;
      arr[idx * 3 + 1] = this.tmpColor.g;
      arr[idx * 3 + 2] = this.tmpColor.b;
      const sym = this.symbols.array as Float32Array;
      sym[idx * 2] = lv.colour < 0 ? NO_SYMBOL : YARNS[lv.colour].symbol;
      sym[idx * 2 + 1] = lv.colour < 0 ? NO_SYMBOL : YARNS[lv.colour2 < 0 ? lv.colour : lv.colour2].symbol;
    });
    this.colour2.needsUpdate = true;
    this.symbols.needsUpdate = true;
    if (this.loopMesh.instanceColor) this.loopMesh.instanceColor.needsUpdate = true;
    if (this.knotMesh.instanceColor) this.knotMesh.instanceColor.needsUpdate = true;
  }

  setLocked(needle: number, locked: boolean, animate = true): void {
    const nd = this.needles[needle];
    if (!nd) return;
    nd.locked = locked;
    nd.ball.material = locked ? this.goldMat : this.ballMat;
    if (locked && animate) nd.pulse = 1;
  }

  // ---------- selection / hint ----------

  setLift(needle: number, count: number): void {
    this.clearLift(false);
    this.lifted = { needle, count };
    const ids = this.stacks[needle].slice(-count);
    ids.forEach((id, k) => {
      const lv = this.loops[id];
      const from = lv.pos.clone();
      const to = this.liftPos(needle, k);
      void this.tweens.to(0.12, (t) => lv.pos.lerpVectors(from, to, t), { ease: ease.outQuad });
    });
  }

  clearLift(animate = true): void {
    if (!this.lifted) return;
    const { needle } = this.lifted;
    this.lifted = null;
    const st = this.stacks[needle];
    st.forEach((id, j) => {
      const lv = this.loops[id];
      const to = this.slotPos(needle, j);
      if (!animate) {
        lv.pos.copy(to);
        return;
      }
      const from = lv.pos.clone();
      void this.tweens.to(0.12, (t) => lv.pos.lerpVectors(from, to, t), { ease: ease.outQuad });
    });
  }

  get liftedNeedle(): number {
    return this.lifted ? this.lifted.needle : -1;
  }

  setHint(pair: [number, number] | null): void {
    this.hintPair = pair;
  }

  // ---------- animations ----------

  /** Move the top `amount` loops from one needle to another with an arc. */
  async animateMove(from: number, to: number, amount: number): Promise<void> {
    this.lifted = null;
    const moving = this.stacks[from].splice(this.stacks[from].length - amount, amount);
    // Top loop travels first and lands lowest of the moved group? No: order is preserved,
    // the loop that was highest ends highest. Move them bottom-first for a tidy cascade.
    const destBase = this.stacks[to].length;
    this.stacks[to].push(...moving);
    const jobs = moving.map((id, k) => {
      const lv = this.loops[id];
      const start = lv.pos.clone();
      const end = this.slotPos(to, destBase + k);
      const peak = Math.max(this.needleHeight(this.needles[from].cap), this.needleHeight(this.needles[to].cap)) + 0.7 + k * LOOP_H;
      const mid = new THREE.Vector3((start.x + end.x) / 2, peak, (start.z + end.z) / 2);
      return this.tweens.to(
        0.26,
        (t) => {
          // Quadratic Bezier through the peak.
          const a = 1 - t;
          lv.pos.set(
            a * a * start.x + 2 * a * t * mid.x + t * t * end.x,
            a * a * start.y + 2 * a * t * mid.y + t * t * end.y,
            a * a * start.z + 2 * a * t * mid.z + t * t * end.z,
          );
          lv.scale = 1 + Math.sin(t * Math.PI) * 0.06;
        },
        { ease: ease.inOutQuad, delay: (moving.length - 1 - k) * 0.035 },
      );
    });
    // Settle the source stack (in case it was lifted).
    this.stacks[from].forEach((id, j) => this.loops[id].pos.copy(this.slotPos(from, j)));
    await Promise.all(jobs);
    // Squash on landing.
    await this.tweens.to(0.09, (t) => {
      for (const id of moving) this.loops[id].scale = 1 - Math.sin(t * Math.PI) * 0.08;
    });
  }

  /** Celebrate a finished needle: loops spin up and settle, ball turns gold. */
  async celebrate(needle: number): Promise<void> {
    this.setLocked(needle, true);
    const ids = this.stacks[needle];
    await this.tweens.to(0.45, (t) => {
      ids.forEach((id, j) => {
        const lv = this.loops[id];
        const base = this.slotPos(needle, j);
        lv.pos.y = base.y + Math.sin(t * Math.PI) * (0.25 + j * 0.06);
        lv.spin += 0.25;
      });
    });
  }

  /** Snip: the loop flies up and out to the basket (shown in the UI). */
  async animateSnip(needle: number, index: number): Promise<void> {
    const [id] = this.stacks[needle].splice(index, 1);
    this.basketIds.push(id);
    const lv = this.loops[id];
    const start = lv.pos.clone();
    const end = start.clone().add(new THREE.Vector3(0, 2.5, 1.5));
    const settle = this.stacks[needle].map((sid, j) => ({ lv: this.loops[sid], from: this.loops[sid].pos.clone(), to: this.slotPos(needle, j) }));
    await this.tweens.to(0.35, (t) => {
      lv.pos.lerpVectors(start, end, t);
      lv.scale = 1 - t;
      for (const s of settle) s.lv.pos.lerpVectors(s.from, s.to, t);
    });
    lv.visible = false;
  }

  /** A basket loop drops onto a needle. */
  async animateFromBasket(index: number, to: number): Promise<void> {
    const [id] = this.basketIds.splice(index, 1);
    const lv = this.loops[id];
    lv.visible = true;
    const end = this.slotPos(to, this.stacks[to].length);
    this.stacks[to].push(id);
    const start = end.clone().add(new THREE.Vector3(0, 2.4, 0));
    await this.tweens.to(0.28, (t) => {
      lv.pos.lerpVectors(start, end, t);
      lv.scale = t;
    }, { ease: ease.outBack });
  }

  /**
   * Yarn Swift. `positions` are the (needle, index) places the colour occupied *before* the
   * swift, `basketIdx` its basket slots; `board` is the board *after* the swift.
   */
  async animateSwift(positions: Array<[number, number]>, basketIdx: number[], target: number, board: Board): Promise<void> {
    // Swift may add a needle.
    while (this.needles.length < board.caps.length) this.addNeedle(board.caps[this.needles.length]);
    const moving: number[] = [];
    const byNeedle = new Map<number, number[]>();
    for (const [n, j] of positions) byNeedle.set(n, [...(byNeedle.get(n) ?? []), j]);
    for (const [n, idxs] of byNeedle) {
      idxs.sort((a, b) => b - a);
      for (const j of idxs) moving.push(...this.stacks[n].splice(j, 1));
    }
    for (const b of [...basketIdx].sort((a, c) => c - a)) {
      const [id] = this.basketIds.splice(b, 1);
      this.loops[id].visible = true;
      this.loops[id].scale = 1;
      this.loops[id].pos.set(0, 3, 2);
      moving.push(id);
    }
    this.stacks[target] = moving;
    const yarn = this.yarnOfSlot(board.stacks[target][0]);
    const jobs = this.stacks[target].map((id, k) => {
      const lv = this.loops[id];
      lv.colour = yarn;
      lv.colour2 = yarn;
      lv.tied = false;
      const start = lv.pos.clone();
      const end = this.slotPos(target, k);
      const mid = new THREE.Vector3((start.x + end.x) / 2, 3.2, (start.z + end.z) / 2);
      return this.tweens.to(0.5, (t) => {
        const a = 1 - t;
        lv.pos.set(a * a * start.x + 2 * a * t * mid.x + t * t * end.x, a * a * start.y + 2 * a * t * mid.y + t * t * end.y, a * a * start.z + 2 * a * t * mid.z + t * t * end.z);
        lv.scale = Math.max(0.01, lv.scale);
        lv.spin += 0.3;
      }, { ease: ease.inOutCubic, delay: k * 0.06 });
    });
    // Everything else settles into place.
    this.stacks.forEach((st, i) => {
      if (i === target) return;
      st.forEach((id, j) => {
        const lv = this.loops[id];
        const from = lv.pos.clone();
        const to = this.slotPos(i, j);
        void this.tweens.to(0.3, (t) => lv.pos.lerpVectors(from, to, t));
      });
    });
    await Promise.all(jobs);
    this.syncColours(board);
    board.locked.forEach((l, i) => {
      if (l && !this.needles[i].locked) this.setLocked(i, true);
    });
  }

  /** Spare Needle: add a needle and re-flow the layout. */
  addNeedle(cap: number): void {
    const caps = [...this.needles.map((n) => n.cap), cap];
    const pos = this.layoutPositions(caps);
    this.needles.push(this.makeNeedle(cap, pos[caps.length - 1].x, pos[caps.length - 1].z));
    this.stacks.push([]);
    this.needles.forEach((nd, i) => {
      const fromX = nd.x;
      const fromZ = nd.z;
      nd.x = pos[i].x;
      nd.z = pos[i].z;
      if (i === this.needles.length - 1) {
        nd.group.scale.setScalar(0.01);
        void this.tweens.to(0.35, (t) => nd.group.scale.setScalar(Math.max(0.01, t)), { ease: ease.outBack });
      } else {
        void this.tweens.to(0.35, (t) => {
          nd.group.position.set(fromX + (nd.x - fromX) * t, 0, fromZ + (nd.z - fromZ) * t);
        });
      }
    });
    // Loops follow their needles.
    this.stacks.forEach((st, i) =>
      st.forEach((id, j) => {
        const lv = this.loops[id];
        const from = lv.pos.clone();
        const to = this.slotPos(i, j);
        void this.tweens.to(0.35, (t) => lv.pos.lerpVectors(from, to, t));
      }),
    );
    this.layoutKey = `${this.maxCols()}:${this.needles.length}`;
    this.fitCamera();
  }

  // ---------- picking & screen positions ----------

  private toClient(v: THREE.Vector3): { x: number; y: number } {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const p = v.clone().project(this.camera);
    return { x: rect.left + ((p.x + 1) / 2) * rect.width, y: rect.top + ((1 - p.y) / 2) * rect.height };
  }

  /** Screen point of a needle's top (for UI effects). */
  needleTopClient(needle: number): { x: number; y: number } {
    const nd = this.needles[needle];
    return this.toClient(new THREE.Vector3(nd.x, this.needleHeight(nd.cap), nd.z));
  }

  /** Which needle is under the pointer. Generous hit areas (min 48 px wide). */
  pickNeedle(clientX: number, clientY: number): number {
    let best = -1;
    let bestDist = Infinity;
    const halfSpacingPx = this.needles.length > 1
      ? Math.abs(this.toClient(new THREE.Vector3(SPACING, 0, 0)).x - this.toClient(new THREE.Vector3(0, 0, 0)).x) / 2
      : 60;
    const halfW = Math.max(24, halfSpacingPx * 0.98);
    this.needles.forEach((nd, i) => {
      const bottom = this.toClient(new THREE.Vector3(nd.x, -0.2, nd.z));
      const topP = this.toClient(new THREE.Vector3(nd.x, this.needleHeight(nd.cap) + 1.4, nd.z));
      const cx = (bottom.x + topP.x) / 2;
      if (Math.abs(clientX - cx) > halfW) return;
      if (clientY < topP.y - 10 || clientY > bottom.y + 18) return;
      const d = Math.abs(clientX - cx);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    return best;
  }

  /** Which loop (needle, index) is under the pointer, for Snip and Yarn Swift. */
  pickLoop(clientX: number, clientY: number): { needle: number; index: number } | null {
    const needle = this.pickNeedle(clientX, clientY);
    if (needle < 0) return null;
    const st = this.stacks[needle];
    if (!st.length) return null;
    let best = 0;
    let bestD = Infinity;
    st.forEach((_, j) => {
      const p = this.toClient(this.slotPos(needle, j));
      const d = Math.abs(p.y - clientY);
      if (d < bestD) {
        bestD = d;
        best = j;
      }
    });
    return { needle, index: best };
  }

  // ---------- frame ----------

  render(dt: number): void {
    this.time += dt;
    this.tweens.update(dt);
    const lift = this.lifted;
    this.loops.forEach((lv, idx) => {
      let y = lv.pos.y;
      if (lift && this.stacks[lift.needle].slice(-lift.count).includes(lv.id) && !this.tweens.busy) {
        y += Math.sin(this.time * 6 + idx) * 0.04;
      }
      this.dummy.position.set(lv.pos.x, y, lv.pos.z);
      this.dummy.rotation.set(0, lv.spin, 0);
      this.dummy.scale.setScalar(lv.visible ? lv.scale : 0);
      this.dummy.updateMatrix();
      this.loopMesh.setMatrixAt(idx, this.dummy.matrix);
      // Knot bead on the front of the pair, between the two tied loops.
      this.dummy.position.set(lv.pos.x + 0.1, y + LOOP_H * 0.5, lv.pos.z + 0.56);
      this.dummy.rotation.set(0, 0, 0);
      const bead = lv.tied && lv.visible ? lv.scale : 0;
      this.dummy.scale.set(bead * 1.9, bead * 1.35, bead * 1.5);
      this.dummy.updateMatrix();
      this.knotMesh.setMatrixAt(idx, this.dummy.matrix);
    });
    this.loopMesh.instanceMatrix.needsUpdate = true;
    this.knotMesh.count = this.loops.length;
    this.knotMesh.instanceMatrix.needsUpdate = true;
    this.renderMoth(dt);
    this.needles.forEach((nd, i) => {
      const ringMat = nd.ring.material as THREE.MeshBasicMaterial;
      let target = 0;
      if (this.hintPair && (this.hintPair[0] === i || this.hintPair[1] === i)) target = 0.55 + 0.4 * Math.sin(this.time * 7);
      if (lift && lift.needle === i) target = 0.8;
      if (nd.pulse > 0) {
        nd.pulse = Math.max(0, nd.pulse - dt * 1.6);
        target = Math.max(target, nd.pulse);
        nd.ball.scale.setScalar(1 + nd.pulse * 0.5);
      }
      ringMat.opacity += (target - ringMat.opacity) * Math.min(1, dt * 14);
      ringMat.color.set(nd.locked ? 0xffd560 : this.hintPair && (this.hintPair[0] === i || this.hintPair[1] === i) ? 0x9fe7ff : 0xfff1b8);
    });
    this.renderer.render(this.scene, this.camera);
  }

  private renderMoth(dt: number): void {
    const m = this.moth;
    const visible = this.mothGroup.visible;
    if (m && this.needles[m.needle] && !this.mothFlying) {
      const rest = this.mothRest(m.needle);
      this.mothPos.lerp(rest, Math.min(1, dt * 10));
    }
    if (visible) {
      const urgent = m ? m.count <= 2 : false;
      const flap = Math.sin(this.time * (this.mothFlying ? 30 : urgent ? 22 : 12));
      this.mothGroup.position.set(this.mothPos.x, this.mothPos.y + Math.sin(this.time * 3) * 0.05, this.mothPos.z);
      this.mothGroup.rotation.y = Math.sin(this.time * 0.9) * 0.4;
      this.mothWings.forEach((w, i) => (w.rotation.z = (i === 0 ? 1 : -1) * (0.25 + flap * 0.55)));
    }
    if (this.mothBadge) {
      const show = visible && !!m && !this.mothFlying;
      this.mothBadge.hidden = !show;
      if (show && m) {
        const p = this.toClient(this.mothPos.clone().add(new THREE.Vector3(0, 0.75, 0)));
        this.mothBadge.style.left = `${p.x}px`;
        this.mothBadge.style.top = `${p.y}px`;
        const text = String(m.count);
        if (this.mothBadge.textContent !== text) this.mothBadge.textContent = text;
        this.mothBadge.classList.toggle("low", m.count <= 2);
        this.mothBadge.classList.toggle("full", m.count === MOTH_TIMER);
      }
    }
  }
}
