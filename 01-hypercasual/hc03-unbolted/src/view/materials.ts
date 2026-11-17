// Shaders for plates, bolts and the pegboard (DESIGN.md §2). Plates are drawn from the same SDF the
// rules use for coverage: each shape gets its own small GLSL distance function, generated from the
// shape kit, so what you see covering a bolt is exactly what blocks it.

import * as THREE from "three";
import { HOLE_R, SHAPES, shapeInfo } from "../logic/shapes.ts";
import type { Prim } from "../logic/shapes.ts";

export const MAX_HOLES = 6;
export const PLATE_MARGIN = 0.45;

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const COMMON = /* glsl */ `
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float sdRoundBox(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
float sdCapsule(vec2 p, vec2 a, vec2 b, float r) { vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h) - r; }
// The 12 colour-blind symbols shared by the Quarkade games (p in about -0.3..0.3).
float symbolMask(float id, vec2 p) {
  float ax = abs(p.x), ay = abs(p.y);
  if (id < 0.5) return step(length(p), 0.17);
  if (id < 1.5) return step(abs(length(p) - 0.2), 0.055);
  if (id < 2.5) return max(step(ax, 0.06) * step(ay, 0.24), step(ay, 0.06) * step(ax, 0.24));
  if (id < 3.5) { vec2 r = vec2(p.x + p.y, p.x - p.y) * 0.7071; return max(step(abs(r.x), 0.06) * step(abs(r.y), 0.24), step(abs(r.y), 0.06) * step(abs(r.x), 0.24)); }
  if (id < 4.5) return step(max(ax, ay), 0.16);
  if (id < 5.5) return step(ax + ay, 0.23);
  if (id < 6.5) return step(abs(ay - 0.11), 0.045) * step(ax, 0.24);
  if (id < 7.5) return step(ax, 0.07) * step(ay, 0.26);
  if (id < 8.5) return step(-0.17, p.y) * step(ax, (0.2 - p.y) * 0.6) * step(p.y, 0.2);
  if (id < 9.5) return max(step(length(p - vec2(0.12, 0.0)), 0.085), step(length(p + vec2(0.12, 0.0)), 0.085));
  if (id < 10.5) return step(abs(p.y + 0.06 - ax * 0.9), 0.06) * step(ax, 0.24);
  if (id < 11.5) { float m = max(ax, ay); return step(m, 0.19) * step(0.11, m); }
  return 0.0;
}`;

function primGlsl(p: Prim): string {
  const v = (x: number) => x.toFixed(4);
  switch (p.k) {
    case "cap":
      return `sdCapsule(p, vec2(${v(p.a[0])}, ${v(p.a[1])}), vec2(${v(p.b[0])}, ${v(p.b[1])}), ${v(p.r)})`;
    case "box":
      return `sdRoundBox(p - vec2(${v(p.c[0])}, ${v(p.c[1])}), vec2(${v(p.h[0])}, ${v(p.h[1])}), ${v(p.r)})`;
    case "disc":
      return `(length(p - vec2(${v(p.c[0])}, ${v(p.c[1])})) - ${v(p.r)})`;
    case "ring":
      return `(abs(length(p - vec2(${v(p.c[0])}, ${v(p.c[1])})) - ${v(p.R)}) - ${v(p.w)})`;
  }
}

function plateFrag(shape: number): string {
  const s = SHAPES[shape];
  const body = s.prims.map((p) => `d = min(d, ${primGlsl(p)});`).join("\n  ");
  return /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform vec4 uBounds;      // local min.xy, max.xy of the quad
uniform vec2 uHoles[${MAX_HOLES}];
uniform float uHoleCount;
uniform vec3 uColor;
uniform float uFinish;     // 0 painted steel, 1 copper, 2 plywood, 3 candy acrylic
uniform float uGlass;
uniform float uAlpha;
uniform vec2 uShadow;      // shadow offset in local units
uniform vec2 uLight;       // light direction in local units
uniform vec4 uLock;        // padlock colour rgb, amount (0 none .. 1 closed; fades as it opens)
uniform vec2 uLockPos;
uniform float uLockOpen;   // 0 closed .. 1 shackle up
uniform float uSeed;
${COMMON}
float body(vec2 p) {
  float d = 1e5;
  ${body}
  return d;
}
float sdf(vec2 p) {
  float d = body(p);
  for (int i = 0; i < ${MAX_HOLES}; i++) {
    if (float(i) >= uHoleCount) break;
    d = max(d, -(length(p - uHoles[i]) - ${HOLE_R.toFixed(3)}));
  }
  return d;
}
void main() {
  vec2 p = mix(uBounds.xy, uBounds.zw, vUv);
  float d = sdf(p);
  float aa = 0.012;
  // Soft drop shadow (outside the plate).
  float ds = body(p - uShadow);
  float shadow = (1.0 - smoothstep(-0.05, 0.12, ds)) * 0.28 * uAlpha;
  float inside = 1.0 - smoothstep(-aa, aa, d);
  if (inside < 0.01 && shadow < 0.01) discard;
  // Normal from the SDF, for the bevel.
  vec2 e = vec2(0.01, 0.0);
  vec2 n = normalize(vec2(sdf(p + e.xy) - sdf(p - e.xy), sdf(p + e.yx) - sdf(p - e.yx)) + 1e-5);
  float edge = 1.0 - smoothstep(0.0, 0.09, -d);
  float lit = dot(-n, normalize(uLight));
  vec3 col = uColor;
  if (uFinish < 0.5) {
    // Painted steel: soft gradient and faint brushed streaks.
    col *= 0.92 + 0.12 * (p.y - uBounds.y) / max(0.01, uBounds.w - uBounds.y);
    col += (noise(vec2(p.x * 40.0, p.y * 1.5 + uSeed)) - 0.5) * 0.05;
  } else if (uFinish < 1.5) {
    col = mix(vec3(0.72, 0.42, 0.24), vec3(0.95, 0.62, 0.38), noise(vec2(p.x * 3.0 + uSeed, p.y * 0.6)));
    col += (noise(vec2(p.x * 60.0, p.y * 2.0)) - 0.5) * 0.08;
  } else if (uFinish < 2.5) {
    float grain = noise(vec2(p.x * 2.0 + uSeed, p.y * 18.0)) * 0.6 + noise(vec2(p.x * 7.0, p.y * 60.0)) * 0.4;
    col = mix(vec3(0.78, 0.6, 0.4), vec3(0.9, 0.74, 0.52), grain);
  } else {
    col = mix(uColor, vec3(1.0), 0.15) * 1.08;
  }
  col += edge * lit * 0.22;
  col -= edge * 0.06;
  // Countersunk ring around each drilled hole.
  for (int i = 0; i < ${MAX_HOLES}; i++) {
    if (float(i) >= uHoleCount) break;
    float r = length(p - uHoles[i]);
    col *= 1.0 - 0.18 * (1.0 - smoothstep(${HOLE_R.toFixed(3)}, ${(HOLE_R + 0.09).toFixed(3)}, r));
  }
  // Padlock.
  if (uLock.a > 0.01) {
    vec2 q = p - uLockPos;
    float bodyL = sdRoundBox(q + vec2(0.0, 0.06), vec2(0.17, 0.13), 0.04);
    vec2 sq = q - vec2(0.0, 0.1 + uLockOpen * 0.08);
    float shackle = abs(length(sq) - 0.1) - 0.032;
    shackle = max(shackle, -sq.y + 0.0 * uLockOpen);
    float m = 1.0 - smoothstep(-0.01, 0.01, min(bodyL, shackle));
    vec3 lc = mix(vec3(0.75, 0.75, 0.78), uLock.rgb, step(bodyL, 0.0));
    float key = step(length(q + vec2(0.0, 0.07)), 0.035);
    lc = mix(lc, vec3(0.15), key * step(bodyL, 0.0));
    col = mix(col, lc, m * uLock.a);
  }
  float alpha = inside * uAlpha;
  if (uGlass > 0.5) {
    alpha *= 0.3 + edge * 0.55;
    col = mix(vec3(0.8, 0.93, 1.0), vec3(1.0), edge * 0.6);
    shadow *= 0.4;
  }
  // Composite: the plate over its own shadow (black).
  float sa = shadow * (1.0 - inside);
  float a = alpha + sa * (1.0 - alpha);
  gl_FragColor = vec4(col * alpha / max(a, 1e-4), a);
}`;
}

export function plateGeometry(shape: number): { geo: THREE.PlaneGeometry; bounds: THREE.Vector4 } {
  const [x0, y0, x1, y1] = shapeInfo(shape).bounds;
  const b = new THREE.Vector4(x0 - PLATE_MARGIN, y0 - PLATE_MARGIN, x1 + PLATE_MARGIN, y1 + PLATE_MARGIN);
  const geo = new THREE.PlaneGeometry(b.z - b.x, b.w - b.y);
  geo.translate((b.x + b.z) / 2, (b.y + b.w) / 2, 0);
  return { geo, bounds: b };
}

export function createPlateMaterial(shape: number, bounds: THREE.Vector4, holes: Array<[number, number]>): THREE.ShaderMaterial {
  const hv = Array.from({ length: MAX_HOLES }, (_, i) => new THREE.Vector2(...(holes[i] ?? [0, 0])));
  return new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: plateFrag(shape),
    transparent: true,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uBounds: { value: bounds },
      uHoles: { value: hv },
      uHoleCount: { value: Math.min(MAX_HOLES, holes.length) },
      uColor: { value: new THREE.Color("#9fb6cc") },
      uFinish: { value: 0 },
      uGlass: { value: 0 },
      uAlpha: { value: 1 },
      uShadow: { value: new THREE.Vector2(0.08, -0.12) },
      uLight: { value: new THREE.Vector2(-0.6, 0.8) },
      uLock: { value: new THREE.Vector4(0, 0, 0, 0) },
      uLockPos: { value: new THREE.Vector2() },
      uLockOpen: { value: 0 },
      uSeed: { value: Math.random() * 10 },
    },
  });
}

// ---------------------------------------------------------------- bolts

const BOLT_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform vec3 uColor;
uniform float uSpin;
uniform float uRust;     // 1 = rusty and unrevealed
uniform float uPin;      // 1 = hinge pin (no slot, grey dome)
uniform float uSymbol;   // -1 none
uniform float uGlow;     // hint glow
uniform float uAlpha;
uniform float uLift;     // 0..1 while unscrewing
${COMMON}
float sdHex(vec2 p, float r) {
  const vec3 k = vec3(-0.866025404, 0.5, 0.577350269);
  p = abs(p);
  p -= 2.0 * min(dot(k.xy, p), 0.0) * k.xy;
  p -= vec2(clamp(p.x, -k.z * r, k.z * r), r);
  return length(p) * sign(p.y);
}
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
void main() {
  vec2 p = (vUv - 0.5) * 1.0;          // quad is 1 unit: p in -0.5..0.5
  float r = length(p);
  // Shadow (grows as the bolt lifts).
  float sh = 1.0 - smoothstep(0.2, 0.36 + uLift * 0.08, length(p - vec2(0.05, -0.07) * (1.0 + uLift * 1.5)));
  vec4 outc = vec4(0.0, 0.0, 0.0, sh * 0.35 * uAlpha);
  // Hint glow ring.
  float glow = uGlow * (1.0 - smoothstep(0.3, 0.46, r)) * smoothstep(0.24, 0.3, r);
  outc = mix(outc, vec4(1.0, 0.85, 0.3, 0.9 * uAlpha), glow);
  vec2 hp = rot(uSpin) * p;
  float hex = uPin > 0.5 ? r - 0.24 : sdHex(hp, 0.25);
  if (hex < 0.0) {
    vec3 metal = mix(vec3(0.62, 0.65, 0.7), vec3(0.92, 0.94, 0.97), 0.5 + 0.5 * dot(normalize(p + 1e-4), vec2(-0.6, 0.8)) * smoothstep(0.1, 0.25, r));
    vec3 col = metal;
    if (uPin < 0.5) {
      float cap = r - 0.17;
      if (cap < 0.0) {
        vec3 c = uColor * (0.9 + 0.25 * (0.5 - (p.y + 0.17) / 0.34 * 0.5));
        c += (1.0 - smoothstep(0.0, 0.07, length(p - vec2(-0.06, 0.07)))) * 0.35;
        // Cross slot.
        float slot = min(max(abs(hp.x) - 0.11, abs(hp.y) - 0.025), max(abs(hp.y) - 0.11, abs(hp.x) - 0.025));
        c = mix(c * 0.45, c, smoothstep(0.0, 0.01, slot));
        if (uSymbol >= 0.0) c = mix(c, vec3(1.0), symbolMask(uSymbol, p * 0.75 * 1.6) * 0.85);
        col = c;
      }
      if (uRust > 0.5) {
        float n = noise(p * 22.0) * 0.6 + noise(p * 60.0) * 0.4;
        col = mix(vec3(0.42, 0.3, 0.22), vec3(0.65, 0.45, 0.3), n);
        col = mix(col, vec3(0.75, 0.55, 0.38), step(0.72, n) * 0.6);
      }
    } else {
      col = mix(vec3(0.55, 0.58, 0.63), vec3(0.88, 0.9, 0.93), 1.0 - r / 0.24);
    }
    col *= 1.0 - 0.25 * smoothstep(-0.03, 0.0, hex);
    float a = (1.0 - smoothstep(-0.01, 0.005, hex)) * uAlpha;
    outc = mix(outc, vec4(col, uAlpha), a);
  }
  if (outc.a < 0.01) discard;
  gl_FragColor = outc;
}`;

export function createBoltMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: BOLT_FRAG,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uColor: { value: new THREE.Color("#e8443a") },
      uSpin: { value: 0 },
      uRust: { value: 0 },
      uPin: { value: 0 },
      uSymbol: { value: -1 },
      uGlow: { value: 0 },
      uAlpha: { value: 1 },
      uLift: { value: 0 },
    },
  });
}

// ---------------------------------------------------------------- pegboard

const BOARD_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform vec4 uRect;      // world min.xy, max.xy
uniform vec3 uBase;
uniform float uKind;     // 0 wood, 1 blueprint, 2 toy, 3 night
${COMMON}
void main() {
  vec2 w = mix(uRect.xy, uRect.zw, vUv);
  vec3 col = uBase;
  if (uKind < 0.5) col *= 0.93 + 0.1 * noise(vec2(w.x * 0.6, w.y * 7.0)) + 0.04 * noise(w * 25.0);
  else if (uKind < 1.5) {
    vec2 g = abs(fract(w * 2.0) - 0.5);
    col = mix(col, vec3(0.75, 0.86, 1.0), (1.0 - smoothstep(0.0, 0.02, min(g.x, g.y))) * 0.25);
  } else if (uKind < 2.5) col *= 0.95 + 0.05 * step(0.5, fract((w.x + w.y) * 0.5));
  else col *= 0.9 + 0.1 * noise(w * 3.0);
  // Pegboard holes on the half grid (between bolt positions).
  vec2 h = fract(w + 0.5) - 0.5;
  float hole = 1.0 - smoothstep(0.06, 0.08, length(h));
  col = mix(col, col * 0.45, hole);
  col = mix(col, col * 1.15, (1.0 - smoothstep(0.08, 0.11, length(h - vec2(0.02, -0.02)))) * (1.0 - hole) * 0.3);
  gl_FragColor = vec4(col, 1.0);
}`;

export function createBoardMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: BOARD_FRAG,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uRect: { value: new THREE.Vector4(-1, -1, 7, 10) },
      uBase: { value: new THREE.Color("#d6b88f") },
      uKind: { value: 0 },
    },
  });
}
