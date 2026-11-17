// The stand view (DESIGN.md §2): a perspective three.js scene with the turning display stand, its
// shelf units, the goods (front rows and back stock), the twists (boxes, freezers, cabinets, key
// tags), picking, and the move / sell / restock / turn animations. The Board is the source of truth:
// sync() rebuilds what's on the shelves from it, play() animates a move's events first.

import * as THREE from "three";
import { Tweens, ease } from "../../../../forge/src/core/tween.ts";
import type { Board, GameEvent } from "../logic/rules.ts";
import { EMPTY, SPOTS, inReach, isBasket, posOf, shelfCount, unitOf, rowOf, usable } from "../logic/rules.ts";
import { goodGeometry } from "./goods3d.ts";

/** Spot pitch and unit sizes, in world units. */
const PITCH = 0.95;
const UW = SPOTS * PITCH + 0.3;
const RH = 1.08;
/** Goods are drawn a little larger than their spot model (front) and smaller behind. */
const GOOD_SCALE = 1.12;
const BACK_SCALE = 0.82;
const DEPTH = 1.0;
const FRONT_Z = DEPTH / 2 - 0.32;
const BACK_Z = -0.24;

export interface StandStyle {
  wood: string;
  plank: string;
  trim: string;
}

export interface Pick {
  shelf: number;
  spot: number;
}

interface GoodV {
  mesh: THREE.Mesh;
  shelf: number;
  spot: number;
}

function emojiTexture(text: string, opts: { bg?: string; fg?: string; size?: number } = {}): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  const s = opts.size ?? 96;
  c.width = c.height = s;
  const g = c.getContext("2d")!;
  if (opts.bg) {
    g.fillStyle = opts.bg;
    g.beginPath();
    g.arc(s / 2, s / 2, s * 0.46, 0, Math.PI * 2);
    g.fill();
  }
  g.font = `bold ${Math.round(s * 0.62)}px "Baloo 2", system-ui, sans-serif`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillStyle = opts.fg ?? "#000";
  g.fillText(text, s / 2, s / 2 + s * 0.04);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class StandView {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(30, 1, 0.1, 200);
  readonly tweens = new Tweens();
  private board: Board | null = null;
  private goodsOf: number[] = [];
  private stand = new THREE.Group();
  private units: THREE.Group[] = [];
  private planks: THREE.MeshLambertMaterial[] = [];
  private hit: THREE.Mesh[] = [];
  private overlays: THREE.Object3D[][] = [];
  private goods: GoodV[] = [];
  private backGoods: THREE.Object3D[] = [];
  private keyTags: THREE.Sprite[] = [];
  private goodMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  /** Back stock: faded (lighter, washed out) rather than darkened, so it never looks spoiled. */
  private dimMat = new THREE.MeshLambertMaterial({ vertexColors: true, color: 0xa8a8a8, emissive: 0x4a4038 });
  private rot = 0;
  private radius = 2;
  private step = 1;
  private safe = { top: 100, bottom: 160 };
  private viewW = 400;
  private viewH = 700;
  private sel: Pick | null = null;
  private time = 0;
  private texCache = new Map<string, THREE.CanvasTexture>();
  private style: StandStyle = { wood: "#c9935a", plank: "#e9cfa3", trim: "#4f9a5a" };
  private fx = new THREE.Group();

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    const hemi = new THREE.HemisphereLight(0xfff8ee, 0x9a7a5a, 1.6);
    const sun = new THREE.DirectionalLight(0xfff0dc, 1.6);
    sun.position.set(-3, 8, 10);
    this.scene.add(hemi, sun, this.stand, this.fx);
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
    const b = this.board;
    const w = this.viewW;
    const h = this.viewH;
    this.camera.aspect = w / h;
    const usable = Math.max(120, h - this.safe.top - this.safe.bottom);
    // What must be seen: the front arc of the stand (plus a little of the units beside it).
    const rows = b?.def.rows ?? 1;
    const reach = b?.def.reach ?? 3;
    // The units in reach fill the width (measured at their outer front corners), with a little margin.
    let contentW = (b?.def.units ?? 3) * (UW + 0.15);
    if (b?.def.turns) {
      let maxX = 0;
      for (let p = 0; p < reach; p++) {
        const th = (p - (reach - 1) / 2) * this.step;
        for (const cx of [-UW / 2, UW / 2])
          for (const cz of [-DEPTH / 2, DEPTH / 2]) maxX = Math.max(maxX, Math.abs(Math.sin(th) * (this.radius + cz) + Math.cos(th) * cx));
      }
      contentW = 2 * maxX + 0.5;
    }
    const contentH = rows * RH + 0.9;
    const el = 0.13;
    const vfov = (this.camera.fov * Math.PI) / 180;
    const tanV = Math.tan(vfov / 2);
    const distH = contentH / 2 / (tanV * (usable / h));
    const distW = contentW / 2 / (tanV * this.camera.aspect) + 0.2;
    const dist = Math.max(distH, distW) * 1.01;
    const cy = (rows * RH) / 2 + 0.15;
    const front = b?.def.turns ? this.radius : DEPTH / 2;
    const look = new THREE.Vector3(0, cy, front * 0.85);
    this.camera.position.set(0, cy + Math.sin(el) * dist, look.z + Math.cos(el) * dist);
    this.camera.lookAt(look);
    // Shift the picture so the stand sits in the middle of the free area between the HUD bars.
    const dy = this.safe.top + usable / 2 - h / 2;
    this.camera.setViewOffset(w, h, 0, -dy, w, h);
    this.camera.updateProjectionMatrix();
  }

  // ---------------------------------------------------------------- build

  applyStyle(s: StandStyle): void {
    this.style = s;
    if (this.board) this.build(this.board, this.goodsOf);
  }

  /** Builds the stand for a level. goodsOf maps the level's kinds to goods (indices into GOODS). */
  build(b: Board, goodsOf: number[]): void {
    this.board = b;
    this.goodsOf = goodsOf;
    this.tweens.finishAll();
    for (const u of this.units) this.stand.remove(u);
    this.stand.clear();
    this.units = [];
    this.planks = [];
    this.hit = [];
    this.overlays = [];
    const def = b.def;
    const U = def.units;
    this.step = (Math.PI * 2) / U;
    this.radius = def.turns ? UW / 2 / Math.tan(Math.PI / U) + DEPTH / 2 + 0.05 : 0;
    const wood = new THREE.MeshLambertMaterial({ color: this.style.wood });
    const trim = new THREE.MeshLambertMaterial({ color: this.style.trim });
    const height = def.rows * RH + 0.3;
    if (def.turns) {
      // Pole, base and crown.
      const base = new THREE.Mesh(new THREE.CylinderGeometry(this.radius + 0.4, this.radius + 0.55, 0.25, 40), trim);
      base.position.y = -0.2;
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(this.radius + 0.1, this.radius + 0.2, 0.12, 40), trim);
      crown.position.y = height - 0.12;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, height + 0.6, 12), wood);
      pole.position.y = height / 2;
      this.stand.add(base, crown, pole);
    }
    for (let u = 0; u < U; u++) {
      const g = new THREE.Group();
      const phi = def.turns ? u * this.step : 0;
      if (def.turns) {
        g.position.set(Math.sin(phi) * this.radius, 0, Math.cos(phi) * this.radius);
        g.rotation.y = phi;
      } else g.position.set((u - (U - 1) / 2) * (UW + 0.15), 0, 0);
      // Back panel and sides.
      const back = new THREE.Mesh(new THREE.BoxGeometry(UW, height, 0.08), wood);
      back.position.set(0, height / 2 - 0.15, -DEPTH / 2);
      g.add(back);
      // Shallow side walls (back half only) so goods on angled units stay visible.
      for (const sx of [-1, 1]) {
        const side = new THREE.Mesh(new THREE.BoxGeometry(0.08, height, DEPTH * 0.45), wood);
        side.position.set((sx * UW) / 2, height / 2 - 0.15, -DEPTH * 0.275);
        g.add(side);
      }
      for (let r = 0; r < def.rows; r++) {
        const s = u * def.rows + r;
        const y = this.shelfY(r);
        const plankMat = new THREE.MeshLambertMaterial({ color: this.style.plank, emissive: 0x000000 });
        this.planks[s] = plankMat;
        const plank = new THREE.Mesh(new THREE.BoxGeometry(UW - 0.06, 0.08, DEPTH), plankMat);
        plank.position.set(0, y - 0.04, 0);
        const lip = new THREE.Mesh(new THREE.BoxGeometry(UW - 0.06, 0.12, 0.05), trim);
        lip.position.set(0, y - 0.02, DEPTH / 2);
        const hb = new THREE.Mesh(new THREE.BoxGeometry(UW - 0.1, RH - 0.1, DEPTH), new THREE.MeshBasicMaterial({ visible: false }));
        hb.position.set(0, y + RH / 2 - 0.1, 0);
        hb.userData = { shelf: s, spot: -1 };
        g.add(plank, lip, hb);
        this.hit[s] = hb;
        this.overlays[s] = [];
      }
      this.units.push(g);
      this.stand.add(g);
    }
    this.rot = def.turns ? this.targetRot(b.angle) : 0;
    this.stand.rotation.y = this.rot;
    this.sel = null;
    this.fit();
    this.sync(b);
  }

  private shelfY(row: number): number {
    const rows = this.board?.def.rows ?? 1;
    return (rows - 1 - row) * RH;
  }

  private targetRot(angle: number): number {
    const def = this.board!.def;
    return (angle - (def.reach - 1) / 2) * this.step;
  }

  private spotLocal(spot: number, row: number, back = 0): THREE.Vector3 {
    return new THREE.Vector3((spot - 1) * PITCH, this.shelfY(row), back ? BACK_Z - (back - 1) * 0.3 : FRONT_Z);
  }

  // ---------------------------------------------------------------- sync from the board

  /** Rebuild the goods, overlays and reach shading from the board. */
  sync(b: Board): void {
    this.board = b;
    const def = b.def;
    for (const gv of this.goods) gv.mesh.removeFromParent();
    for (const o of this.backGoods) o.removeFromParent();
    for (const t of this.keyTags) t.removeFromParent();
    this.goods = [];
    this.backGoods = [];
    this.keyTags = [];
    const S = shelfCount(def);
    for (let s = 0; s < S; s++) {
      const unit = this.units[unitOf(def, s)];
      const row = rowOf(def, s);
      for (const o of this.overlays[s]) o.removeFromParent();
      this.overlays[s] = [];
      const hiddenByBox = b.boxed[s];
      for (let i = 0; i < SPOTS; i++) {
        const k = b.front[s * SPOTS + i];
        if (k === EMPTY || hiddenByBox) continue;
        const mesh = new THREE.Mesh(goodGeometry(this.goodsOf[k]), this.goodMat);
        mesh.position.copy(this.spotLocal(i, row));
        mesh.scale.setScalar(GOOD_SCALE);
        mesh.userData = { shelf: s, spot: i };
        unit.add(mesh);
        this.goods.push({ mesh, shelf: s, spot: i });
        if (def.key !== undefined && k === def.key && b.locked) {
          const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex("key", () => emojiTexture("🔑", { bg: "#ffd54a" })), depthTest: false }));
          tag.scale.set(0.3, 0.3, 1);
          tag.position.copy(this.spotLocal(i, row)).add(new THREE.Vector3(0.22, 0.85, 0.1));
          tag.renderOrder = 5;
          unit.add(tag);
          this.keyTags.push(tag);
        }
      }
      // Back stock: the next layer, dimmed (or a "?" crate when hidden).
      const layers = def.shelves[s].b;
      if (layers && b.layer[s] < layers.length && !hiddenByBox) {
        const left = layers.length - b.layer[s];
        if (def.hide) {
          const crate = new THREE.Mesh(new THREE.BoxGeometry(UW - 0.4, 0.55, 0.4), new THREE.MeshLambertMaterial({ color: 0xb98a5a }));
          crate.position.set(0, this.shelfY(row) + 0.28, BACK_Z - 0.05);
          const q = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex(`q${left}`, () => emojiTexture(left > 1 ? `?${left}` : "?", { fg: "#5a3a1a" })) }));
          q.scale.set(0.45, 0.45, 1);
          q.position.set(0, this.shelfY(row) + 0.32, BACK_Z + 0.2);
          unit.add(crate, q);
          this.backGoods.push(crate, q);
        } else {
          for (let i = 0; i < SPOTS; i++) {
            const k = layers[b.layer[s]][i];
            if (k === EMPTY) continue;
            const mesh = new THREE.Mesh(goodGeometry(this.goodsOf[k]), this.dimMat);
            mesh.position.copy(this.spotLocal(i, row, 1));
            mesh.scale.setScalar(BACK_SCALE);
            unit.add(mesh);
            this.backGoods.push(mesh);
          }
          if (left > 1) {
            const n = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex(`n${left}`, () => emojiTexture(`+${left - 1}`, { bg: "#5a3a1a", fg: "#fff" })) }));
            n.scale.set(0.28, 0.28, 1);
            n.position.set(UW / 2 - 0.3, this.shelfY(row) + RH - 0.35, BACK_Z);
            unit.add(n);
            this.backGoods.push(n);
          }
        }
      }
      this.addOverlays(b, s, unit, row);
    }
    this.shadeReach();
    if (this.sel) this.select(this.sel);
  }

  private addOverlays(b: Board, s: number, unit: THREE.Group, row: number): void {
    const def = b.def;
    const y = this.shelfY(row);
    const add = (o: THREE.Object3D) => {
      unit.add(o);
      this.overlays[s].push(o);
    };
    if (b.boxed[s]) {
      const crate = new THREE.Mesh(new THREE.BoxGeometry(UW - 0.16, RH - 0.2, DEPTH - 0.1), new THREE.MeshLambertMaterial({ color: 0xc89a62 }));
      crate.position.set(0, y + (RH - 0.2) / 2, 0.02);
      const tape = new THREE.Mesh(new THREE.BoxGeometry(0.35, RH - 0.18, DEPTH - 0.06), new THREE.MeshLambertMaterial({ color: 0xe8d8b0 }));
      tape.position.copy(crate.position);
      const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex("box", () => emojiTexture("📦")) }));
      label.scale.set(0.5, 0.5, 1);
      label.position.set(0, y + RH / 2, DEPTH / 2 + 0.05);
      add(crate);
      add(tape);
      add(label);
    } else if (b.frozen[s] > 0) {
      const ice = new THREE.Mesh(new THREE.BoxGeometry(UW - 0.12, RH - 0.15, DEPTH - 0.05), new THREE.MeshLambertMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.55, depthWrite: false }));
      ice.position.set(0, y + (RH - 0.15) / 2, 0.03);
      ice.renderOrder = 3;
      const n = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex(`f${b.frozen[s]}`, () => emojiTexture(String(b.frozen[s]), { bg: "#3f9fd0", fg: "#fff" })), depthTest: false }));
      n.scale.set(0.42, 0.42, 1);
      n.position.set(0, y + RH - 0.3, DEPTH / 2 + 0.1);
      n.renderOrder = 6;
      add(ice);
      add(n);
    } else if (b.locked && def.shelves[s].cab) {
      const glass = new THREE.Mesh(new THREE.BoxGeometry(UW - 0.1, RH - 0.12, 0.04), new THREE.MeshLambertMaterial({ color: 0xd8f0ff, transparent: true, opacity: 0.35, depthWrite: false }));
      glass.position.set(0, y + (RH - 0.12) / 2, DEPTH / 2 + 0.02);
      glass.renderOrder = 3;
      const lock = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex("lock", () => emojiTexture("🔒", { bg: "#ffd54a" })), depthTest: false }));
      lock.scale.set(0.42, 0.42, 1);
      lock.position.set(0, y + RH / 2, DEPTH / 2 + 0.1);
      lock.renderOrder = 6;
      add(glass);
      add(lock);
    }
  }

  /** Shelves out of reach (or closed) are shaded; shelves that can take the selected good glow. */
  private shadeReach(targets: number[] = []): void {
    const b = this.board!;
    const base = new THREE.Color(this.style.plank);
    for (let s = 0; s < this.planks.length; s++) {
      const m = this.planks[s];
      const live = inReach(b, s) && usable(b, s);
      m.color.copy(base).multiplyScalar(live ? 1 : 0.62);
      m.emissive.set(targets.includes(s) ? 0x2f6f2f : 0x000000);
    }
  }

  setTargets(targets: number[]): void {
    this.shadeReach(targets);
  }

  // ---------------------------------------------------------------- selection

  private meshAt(p: Pick): THREE.Mesh | null {
    return this.goods.find((g) => g.shelf === p.shelf && g.spot === p.spot)?.mesh ?? null;
  }

  select(p: Pick | null): void {
    if (this.sel) {
      const m = this.meshAt(this.sel);
      const row = this.board ? rowOf(this.board.def, this.sel.shelf) : 0;
      if (m) m.position.copy(this.spotLocal(this.sel.spot, row));
    }
    this.sel = p;
  }

  /** Client point of a shelf's middle (for the coach's hand), or null if it isn't on screen. */
  shelfClient(s: number): { x: number; y: number } | null {
    const hb = this.hit[s];
    if (!hb) return null;
    const v = new THREE.Vector3();
    hb.getWorldPosition(v);
    return this.toClient(v);
  }

  goodClient(p: Pick): { x: number; y: number } | null {
    const m = this.meshAt(p);
    if (!m) return null;
    const v = new THREE.Vector3();
    m.getWorldPosition(v);
    v.y += 0.3;
    return this.toClient(v);
  }

  private toClient(v: THREE.Vector3): { x: number; y: number } {
    this.stand.updateMatrixWorld();
    v.project(this.camera);
    const r = this.renderer.domElement.getBoundingClientRect();
    return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
  }

  /** What's under a client point: a good (shelf + spot) or a shelf (spot -1), or null. */
  pick(clientX: number, clientY: number): Pick | null {
    const r = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    this.stand.updateMatrixWorld();
    const goodHit = ray.intersectObjects(this.goods.map((g) => g.mesh), false)[0];
    const shelfHit = ray.intersectObjects(this.hit, false)[0];
    // A good wins unless a shelf is clearly in front of it.
    if (goodHit && (!shelfHit || goodHit.distance <= shelfHit.distance + 0.6)) return { ...(goodHit.object.userData as Pick) };
    if (shelfHit) return { shelf: shelfHit.object.userData.shelf as number, spot: -1 };
    return null;
  }

  // ---------------------------------------------------------------- animation

  private worldOf(p: Pick, back = 0): THREE.Vector3 {
    const def = this.board!.def;
    const unit = this.units[unitOf(def, p.shelf)];
    unit.updateMatrixWorld();
    return unit.localToWorld(this.spotLocal(p.spot, rowOf(def, p.shelf), back));
  }

  /** Animate a move's events, then sync to the board. Basket and customer moves animate in the HUD. */
  async play(events: GameEvent[], after: Board, onEvent?: (ev: GameEvent) => void): Promise<void> {
    const def = after.def;
    const S = shelfCount(def);
    this.sel = null;
    for (const ev of events) {
      onEvent?.(ev);
      if (ev.t === "move") {
        const from = isBasket(after, ev.from) ? null : this.meshAt({ shelf: ev.from, spot: ev.spot });
        if (isBasket(after, ev.to) || ev.from === S) {
          if (from) await this.tweens.to(0.14, (t) => from.scale.setScalar(1 - t), { ease: ease.inQuad });
          continue;
        }
        if (!from) continue;
        // Fly in world space along an arc, then re-parent to the target unit.
        const a = new THREE.Vector3();
        from.getWorldPosition(a);
        const bPos = this.worldOf({ shelf: ev.to, spot: ev.toSpot });
        this.scene.attach(from);
        await this.tweens.to(
          0.24,
          (t) => {
            from.position.lerpVectors(a, bPos, t);
            from.position.y += Math.sin(t * Math.PI) * 0.6;
          },
          { ease: ease.inOutQuad },
        );
        const unit = this.units[unitOf(def, ev.to)];
        unit.attach(from);
        from.userData = { shelf: ev.to, spot: ev.toSpot };
        const gv = this.goods.find((g) => g.mesh === from);
        if (gv) {
          gv.shelf = ev.to;
          gv.spot = ev.toSpot;
        }
      } else if (ev.t === "serve") {
        const m = this.meshAt({ shelf: ev.from, spot: ev.spot });
        if (m) await this.tweens.to(0.16, (t) => m.scale.setScalar(1 - t), { ease: ease.inQuad });
      } else if (ev.t === "sell") {
        // The Shop Assistant sells from anywhere (shelf -1): sparkle at the front of the stand.
        const ms = this.goods.filter((g) => g.shelf === ev.shelf).map((g) => g.mesh);
        const centre = ev.shelf >= 0 ? this.worldOf({ shelf: ev.shelf, spot: 1 }) : new THREE.Vector3(0, 1, this.radius + 0.5);
        this.burst(centre, ev.kind);
        await this.tweens.to(
          0.26,
          (t) => {
            for (const m of ms) {
              const s = t < 0.35 ? 1 + t * 0.6 : (1.21 * (1 - t)) / 0.65;
              m.scale.setScalar(Math.max(0, s) * GOOD_SCALE);
              m.position.y = this.shelfY(rowOf(def, ev.shelf)) + t * 0.25;
            }
          },
          { ease: ease.linear },
        );
        for (const m of ms) m.removeFromParent();
        this.goods = this.goods.filter((g) => !ms.includes(g.mesh));
      } else if (ev.t === "restock") {
        // Sync puts the new row in place; slide it from the back.
        this.sync(after);
        const ms = this.goods.filter((g) => g.shelf === ev.shelf).map((g) => g.mesh);
        await this.tweens.to(0.2, (t) => ms.forEach((m) => (m.position.z = BACK_Z + (FRONT_Z - BACK_Z) * t)), { ease: ease.outCubic });
      } else if (ev.t === "turn") {
        const from = this.rot;
        const to = this.rot + ev.by * this.step;
        this.rot = to;
        await this.tweens.to(0.32, (t) => (this.stand.rotation.y = from + (to - from) * t), { ease: ease.inOutCubic });
      } else if (ev.t === "open" || ev.t === "thaw" || ev.t === "unlock") {
        this.sync(after);
        this.flash(ev.t === "unlock" ? -1 : ev.shelf);
      }
    }
    this.sync(after);
  }

  /** Jump straight to a board (undo, restart). */
  snapTo(b: Board): void {
    this.tweens.finishAll();
    this.rot = this.targetRot(b.angle);
    // Keep the rotation continuous so the next turn tween doesn't spin the long way.
    this.stand.rotation.y = this.rot;
    this.sel = null;
    this.sync(b);
  }

  /** The "SOLD" pop: the equipped shopping bag plus sparkles. */
  bagIcon = "🛍️";

  private burst(at: THREE.Vector3, kind: number): void {
    const bag = this.bagIcon;
    const coin = this.tex(`bag${bag}`, () => emojiTexture(bag));
    const spark = this.tex("spark", () => emojiTexture("✨"));
    for (let i = 0; i < 7; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: i === 0 ? coin : spark, depthTest: false, transparent: true }));
      sp.renderOrder = 10;
      sp.position.copy(at).add(new THREE.Vector3(0, 0.4, 0.3));
      const s0 = i === 0 ? 0.55 : 0.28;
      sp.scale.set(s0, s0, 1);
      this.fx.add(sp);
      const dir = new THREE.Vector3(Math.cos((i / 6) * Math.PI * 2) * 0.9, 0.6 + Math.sin(i * 1.7) * 0.4, 0.2);
      const start = sp.position.clone();
      void this.tweens
        .to(
          i === 0 ? 0.7 : 0.45,
          (t) => {
            if (i === 0) sp.position.set(start.x, start.y + t * 1.1, start.z);
            else sp.position.copy(start).addScaledVector(dir, t);
            (sp.material as THREE.SpriteMaterial).opacity = 1 - t * t;
          },
          { ease: ease.outCubic },
        )
        .then(() => sp.removeFromParent());
    }
    void kind;
  }

  /** Press art: sparkles over a shelf, frozen part-way through their burst. */
  sparkle(s: number): void {
    this.burst(this.worldOf({ shelf: s, spot: 1 }), 0);
    this.tweens.update(0.12);
  }

  private flash(s: number): void {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex("spark", () => emojiTexture("✨")), depthTest: false, transparent: true }));
    sp.renderOrder = 10;
    const at = s >= 0 ? this.worldOf({ shelf: s, spot: 1 }) : new THREE.Vector3(0, 1, this.radius);
    sp.position.copy(at).add(new THREE.Vector3(0, 0.5, 0.3));
    this.fx.add(sp);
    void this.tweens.to(0.5, (t) => {
      sp.scale.setScalar(0.4 + t * 0.9);
      (sp.material as THREE.SpriteMaterial).opacity = 1 - t;
    }).then(() => sp.removeFromParent());
  }

  // ---------------------------------------------------------------- frame

  render(dt: number): void {
    this.time += dt;
    this.tweens.update(dt);
    if (this.sel && this.board) {
      const m = this.meshAt(this.sel);
      if (m) {
        const base = this.spotLocal(this.sel.spot, rowOf(this.board.def, this.sel.shelf));
        m.position.set(base.x, base.y + 0.22 + Math.sin(this.time * 7) * 0.05, base.z + 0.12);
      }
    }
    this.renderer.render(this.scene, this.camera);
  }

  /** Units in order around the stand, by position (for the stand map). */
  unitsByPosition(b: Board): number[] {
    const out = new Array(b.def.units).fill(0);
    for (let u = 0; u < b.def.units; u++) out[posOf(b, u)] = u;
    return out;
  }
}
