// Shaders for food pieces, the bento box and the table mat (DESIGN.md §2). A piece is drawn as a
// soft union of its cells; one fragment shader paints every food from a pattern id and 3 colours.

import * as THREE from "three";

export const MAX_CELLS = 6;
export const PIECE_MARGIN = 0.2;

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
float smin(float a, float b, float k) { float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0); return mix(b, a, h) - k * h * (1.0 - h); }
`;

const FOOD_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform vec2 uCells[${MAX_CELLS}];
uniform float uCount;
uniform vec2 uSize;        // shape bounding box in cells
uniform float uPattern;
uniform vec3 uC1;
uniform vec3 uC2;
uniform vec3 uC3;
uniform float uAlpha;
uniform vec4 uTint;        // ghost tint rgb + amount
uniform float uBad;        // 0..1 red warning glow (hot/cold touching, lonely sauce)
uniform float uTemp;       // 0 none, 1 hot, 2 cold (badge)
uniform float uLift;       // 0..1 while dragged (bigger shadow)
uniform float uSeed;
uniform float uShadow;
${COMMON}
bool member(vec2 c) {
  for (int j = 0; j < ${MAX_CELLS}; j++) {
    if (float(j) >= uCount) break;
    if (distance(uCells[j], c) < 0.1) return true;
  }
  return false;
}
float shape(vec2 p) {
  // Each cell's square reaches halfway into every neighbouring cell of the piece, so shared edges
  // sit deep inside the shape: only the outline gets rounded corners and the seam inset.
  float d = 1e5;
  for (int i = 0; i < ${MAX_CELLS}; i++) {
    if (float(i) >= uCount) break;
    vec2 c = uCells[i];
    float l = member(c + vec2(-1.0, 0.0)) ? 0.5 : 0.0;
    float r = member(c + vec2(1.0, 0.0)) ? 0.5 : 0.0;
    float u = member(c + vec2(0.0, -1.0)) ? 0.5 : 0.0;
    float dn = member(c + vec2(0.0, 1.0)) ? 0.5 : 0.0;
    vec2 lo = c - vec2(l, u);
    vec2 hi = c + 1.0 + vec2(r, dn);
    d = min(d, sdRoundBox(p - (lo + hi) * 0.5, (hi - lo) * 0.5, 0.24));
  }
  return d + 0.055;
}
/** Which cell (for per-cell detail) and the position inside it (0..1). */
vec2 cellUv(vec2 p) { return fract(p); }
void main() {
  vec2 p = vUv * (uSize + 2.0 * ${PIECE_MARGIN.toFixed(2)}) - ${PIECE_MARGIN.toFixed(2)};
  p.y = (uSize.y + 2.0 * ${PIECE_MARGIN.toFixed(2)}) * (1.0 - vUv.y) - ${PIECE_MARGIN.toFixed(2)};
  float d = shape(p);
  float aa = 0.02;
  float inside = 1.0 - smoothstep(-aa, aa, d);
  float sh = (1.0 - smoothstep(-0.05, 0.16 + uLift * 0.12, shape(p - vec2(0.06, 0.1) * (1.0 + uLift * 2.5)))) * 0.3 * uShadow;
  if (inside < 0.01 && sh < 0.01 && uBad < 0.01) discard;
  vec2 cu = cellUv(p);
  vec2 cid = floor(p);
  float n = noise(p * 6.0 + uSeed);
  vec3 col = uC1;
  float a = 1.0;
  if (uPattern < 0.5) {            // rice: grains + a few sesame specks
    // Staggered grains, each a small tilted oval: pale grain on a slightly darker gap.
    vec2 q = p * vec2(7.0, 11.0);
    q.x += mod(floor(q.y), 2.0) * 0.5;
    vec2 gid = floor(q);
    vec2 gf = fract(q) - 0.5;
    float ang = (hash(gid + uSeed) - 0.5) * 1.6;
    gf = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * gf;
    float grain = smoothstep(0.46, 0.34, length(vec2(gf.x * 0.85, gf.y * 1.7)));
    col = mix(uC2, uC1, grain);
    col += grain * smoothstep(0.1, -0.2, gf.y) * 0.03;
    vec2 sp = fract(p * 5.0) - 0.5;
    float sesame = step(0.9, hash(floor(p * 5.0) + uSeed)) * smoothstep(0.09, 0.05, length(vec2(sp.x * 0.7, sp.y * 1.4)));
    col = mix(col, uC3, sesame * 0.7);
  } else if (uPattern < 1.5) {     // rolled omelette: layers + browned edges
    float l = fract(p.x * 2.5 + n * 0.4);
    col = mix(uC1, uC2, smoothstep(0.3, 0.5, l) * (1.0 - smoothstep(0.6, 0.8, l)));
    col = mix(col, uC3, smoothstep(-0.12, 0.0, d) * 0.6);
  } else if (uPattern < 2.5) {     // octopus sausage: diagonal cuts + shine
    float cut = smoothstep(0.86, 0.95, fract((p.x + p.y) * 2.4));
    col = mix(uC1, uC3, cut * 0.8);
    col = mix(col, uC2, smoothstep(0.25, 0.0, length(cu - vec2(0.35, 0.3))) * 0.5);
  } else if (uPattern < 3.5) {     // fried: golden bumps
    float b = noise(p * 5.0 + uSeed) * 0.6 + noise(p * 13.0) * 0.4;
    col = mix(uC3, uC1, smoothstep(0.2, 0.55, b));
    col = mix(col, uC2, smoothstep(0.65, 0.85, b));
  } else if (uPattern < 4.5) {     // broccoli: florets
    float f = noise(p * 8.0 + uSeed);
    col = mix(uC3, uC1, smoothstep(0.25, 0.5, f));
    col = mix(col, uC2, smoothstep(0.6, 0.8, f));
  } else if (uPattern < 5.5) {     // glossy round (tomato, carrot)
    float r = length(cu - 0.5);
    col = mix(uC1, uC1 * 0.75, smoothstep(0.2, 0.5, r));
    col = mix(col, uC2, smoothstep(0.14, 0.0, length(cu - vec2(0.36, 0.32))) * 0.8);
    col = mix(col, uC3, smoothstep(0.08, 0.0, abs(cu.x - 0.5) + abs(cu.y - 0.12) * 1.5));
  } else if (uPattern < 6.5) {     // edamame pods: three beans
    float bean = 0.0;
    for (int k = 0; k < 3; k++) bean = max(bean, smoothstep(0.17, 0.12, length(vec2(cu.x - 0.25 - float(k) * 0.25, (cu.y - 0.5) * 1.3))));
    col = mix(uC3, uC1, 0.6 + 0.4 * bean);
    col = mix(col, uC2, bean * smoothstep(0.1, 0.0, length(cu - vec2(0.3, 0.42))) * 0.6);
  } else if (uPattern < 7.5) {     // salmon: pink with pale fat stripes
    float s = smoothstep(0.82, 0.92, fract(p.y * 1.6 + sin(p.x * 2.0) * 0.25));
    col = mix(uC1, uC2, s * 0.85);
    col = mix(col, uC3, smoothstep(-0.12, 0.0, d) * 0.5);
  } else if (uPattern < 8.5) {     // jelly / mochi: soft and see-through
    col = mix(uC1, uC2, smoothstep(-0.5, -0.1, d));
    col = mix(col, uC3, smoothstep(0.18, 0.0, length(cu - vec2(0.32, 0.28))) * 0.7);
    a = 0.9;
  } else if (uPattern < 9.5) {     // berries / fruit salad: coloured dots
    float h = hash(floor(p * 3.0) + uSeed);
    vec3 bc = h < 0.33 ? uC1 : h < 0.66 ? uC2 : uC3;
    float dot = smoothstep(0.42, 0.32, length(fract(p * 3.0) - 0.5));
    col = mix(uC1 * 0.75, bc, dot);
    col = mix(col, vec3(1.0), smoothstep(0.12, 0.0, length(fract(p * 3.0) - vec2(0.38, 0.35))) * 0.5);
  } else if (uPattern < 10.5) {    // gyoza / dumpling: pleats, crispy base
    float pleat = smoothstep(0.85, 0.95, fract(p.x * 3.0)) * smoothstep(0.55, 0.2, cu.y);
    col = mix(uC1, uC2, n * 0.4);
    col = mix(col, uC3, pleat * 0.6 + smoothstep(0.7, 0.95, cu.y) * 0.5);
  } else if (uPattern < 11.5) {    // onigiri: rice with a nori band
    vec2 q = p * vec2(7.0, 11.0);
    q.x += mod(floor(q.y), 2.0) * 0.5;
    vec2 gf = fract(q) - 0.5;
    float ang = (hash(floor(q) + uSeed) - 0.5) * 1.6;
    gf = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * gf;
    col = mix(uC2, uC1, smoothstep(0.46, 0.34, length(vec2(gf.x * 0.85, gf.y * 1.7))));
    col = mix(col, uC3, smoothstep(0.62, 0.66, cu.y) * (1.0 - smoothstep(0.94, 0.98, cu.y)));
  } else if (uPattern < 12.5) {    // noodles: wavy strands
    float w = fract(p.y * 4.0 + sin(p.x * 6.0 + uSeed) * 0.25);
    col = mix(uC3, uC1, smoothstep(0.1, 0.3, w) * (1.0 - smoothstep(0.7, 0.9, w)));
    col = mix(col, uC2, smoothstep(0.35, 0.5, w) * (1.0 - smoothstep(0.5, 0.65, w)) * 0.6);
  } else if (uPattern < 13.5) {    // maki: nori ring, rice, filling
    float r = length(cu - 0.5);
    col = mix(uC3, uC2, smoothstep(0.17, 0.2, r));
    col = mix(col, uC1, smoothstep(0.36, 0.4, r));
  } else {                         // sauce cup
    float r = length(cu - 0.5);
    col = mix(uC1, uC2, smoothstep(0.2, 0.0, length(cu - vec2(0.4, 0.38))) * 0.6);
    col = mix(col, uC3, smoothstep(0.28, 0.33, r));
  }
  // Rim: a clear darker outline so neighbouring pieces read as separate foods.
  col *= 1.0 - smoothstep(-0.1, -0.01, d) * 0.22;
  col = mix(col, col * 0.55, smoothstep(-0.035, -0.005, d));
  // Temperature badge on the first cell's corner.
  if (uTemp > 0.5) {
    vec2 bp = p - uCells[0] - vec2(0.8, 0.2);
    float bd = length(bp);
    if (bd < 0.17) {
      vec3 bc = uTemp < 1.5 ? vec3(0.95, 0.35, 0.15) : vec3(0.35, 0.7, 0.98);
      col = mix(vec3(1.0), bc, smoothstep(0.17, 0.14, bd));
      float sym = uTemp < 1.5
        ? smoothstep(0.06, 0.04, length(vec2(bp.x, bp.y * 0.7 - 0.01)))
        : max(smoothstep(0.025, 0.0, abs(bp.x)) * step(abs(bp.y), 0.09), smoothstep(0.025, 0.0, abs(bp.y)) * step(abs(bp.x), 0.09));
      col = mix(col, vec3(1.0), sym * step(bd, 0.14));
      inside = max(inside, smoothstep(0.17, 0.15, bd));
    }
  }
  col = mix(col, uTint.rgb, uTint.a);
  float glow = uBad * (1.0 - smoothstep(0.0, 0.14, abs(d + 0.02))) * (0.6 + 0.4 * sin(uSeed * 0.0 + 6.0 * uBad));
  vec4 outc = vec4(0.0, 0.0, 0.0, sh * (1.0 - inside));
  outc = mix(outc, vec4(col, a * uAlpha), inside * uAlpha);
  outc = mix(outc, vec4(0.95, 0.2, 0.15, 0.9), clamp(glow, 0.0, 1.0));
  if (outc.a < 0.01) discard;
  gl_FragColor = outc;
}`;

export function createFoodMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FOOD_FRAG,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uCells: { value: Array.from({ length: MAX_CELLS }, () => new THREE.Vector2()) },
      uCount: { value: 0 },
      uSize: { value: new THREE.Vector2(1, 1) },
      uPattern: { value: 0 },
      uC1: { value: new THREE.Color() },
      uC2: { value: new THREE.Color() },
      uC3: { value: new THREE.Color() },
      uAlpha: { value: 1 },
      uTint: { value: new THREE.Vector4(0, 0, 0, 0) },
      uBad: { value: 0 },
      uTemp: { value: 0 },
      uLift: { value: 0 },
      uSeed: { value: Math.random() * 10 },
      uShadow: { value: 1 },
    },
  });
}

// ---------------------------------------------------------------- the box

const BOX_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D uMask;   // r: box cell, g: garnish
uniform sampler2D uWalls;  // r: divider on the right edge, g: divider on the bottom edge
uniform vec2 uSize;        // w, h in cells
uniform float uMargin;
uniform vec3 uWood;
uniform vec3 uFloor;
uniform float uLacquer;
${COMMON}
float cellIn(vec2 c) {
  if (c.x < 0.0 || c.y < 0.0 || c.x >= uSize.x || c.y >= uSize.y) return 0.0;
  return texture2D(uMask, (c + 0.5) / uSize).r;
}
void main() {
  vec2 full = uSize + 2.0 * uMargin;
  vec2 p = vec2(vUv.x * full.x, (1.0 - vUv.y) * full.y) - uMargin;
  vec2 c = floor(p);
  float here = cellIn(c);
  // Distance to the box interior (from nearby cells), for the walls.
  float d = 1e5;
  for (int dy = -1; dy <= 1; dy++) for (int dx = -1; dx <= 1; dx++) {
    vec2 n = c + vec2(float(dx), float(dy));
    if (cellIn(n) > 0.5) d = min(d, sdRoundBox(p - n - 0.5, vec2(0.5), 0.02));
  }
  vec4 outc = vec4(0.0);
  float wallW = 0.34;
  if (here > 0.5) {
    vec3 fl = uFloor * (0.95 + 0.08 * noise(vec2(p.x * 0.8, p.y * 9.0)));
    vec2 f = fract(p);
    float grid = 1.0 - smoothstep(0.0, 0.03, min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y)));
    fl *= 1.0 - grid * 0.12;
    outc = vec4(fl, 1.0);
    // Garnish: a pickled plum.
    if (texture2D(uMask, (c + 0.5) / uSize).g > 0.5) {
      float r = length(f - 0.5);
      vec3 plum = mix(vec3(0.78, 0.12, 0.2), vec3(0.5, 0.05, 0.1), smoothstep(0.1, 0.38, r) + noise(p * 18.0) * 0.25);
      plum = mix(plum, vec3(1.0, 0.75, 0.8), smoothstep(0.1, 0.0, length(f - vec2(0.38, 0.35))) * 0.6);
      outc.rgb = mix(outc.rgb, plum, smoothstep(0.38, 0.34, r));
    }
    // Grass dividers on this cell's right and bottom edges, and on the left/top neighbours' edges.
    vec2 w = texture2D(uWalls, (c + 0.5) / uSize).rg;
    float wl = c.x > 0.0 ? texture2D(uWalls, (c + vec2(-0.5, 0.5)) / uSize).r : 0.0;
    float wt = c.y > 0.0 ? texture2D(uWalls, (c + vec2(0.5, -0.5)) / uSize).g : 0.0;
    float zig = 0.05 * abs(fract(p.y * 4.0) - 0.5) * 2.0;
    float zig2 = 0.05 * abs(fract(p.x * 4.0) - 0.5) * 2.0;
    float grass = max(max(w.r * step(1.0 - f.x, 0.07 + zig), wl * step(f.x, 0.07 + zig)), max(w.g * step(1.0 - f.y, 0.07 + zig2), wt * step(f.y, 0.07 + zig2)));
    outc.rgb = mix(outc.rgb, vec3(0.25, 0.7, 0.3) * (0.85 + 0.3 * noise(p * 20.0)), grass);
  } else if (d < wallW) {
    // The box wall: wood with a bevel toward the inside.
    float t = d / wallW;
    vec3 wood = uWood * (0.9 + 0.12 * noise(vec2(p.x * 1.2 + p.y * 0.3, p.y * 12.0)));
    if (uLacquer > 0.5) wood = uWood * (0.85 + 0.3 * (1.0 - t));
    wood *= 1.0 - smoothstep(0.75, 1.0, t) * 0.25;
    wood += (1.0 - smoothstep(0.0, 0.2, t)) * 0.12;
    outc = vec4(wood, 1.0 - smoothstep(wallW - 0.03, wallW, d));
  } else if (d < wallW + 0.14) {
    outc = vec4(0.0, 0.0, 0.0, 0.25 * (1.0 - (d - wallW) / 0.14));
  } else discard;
  gl_FragColor = outc;
}`;

export function createBoxMaterial(w: number, h: number, mask: string, walls: number[]): THREE.ShaderMaterial {
  const m = new Uint8Array(w * h * 4);
  const wl = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const ch = mask[i];
    m[i * 4] = ch === "." || ch === "g" ? 255 : 0;
    m[i * 4 + 1] = ch === "g" ? 255 : 0;
    m[i * 4 + 3] = 255;
    wl[i * 4] = walls.includes(i * 2) ? 255 : 0;
    wl[i * 4 + 1] = walls.includes(i * 2 + 1) ? 255 : 0;
    wl[i * 4 + 3] = 255;
  }
  // Texture row r = level row r: the shader looks cells up with v = (row + 0.5) / h.
  const tex = (data: Uint8Array<ArrayBuffer>) => {
    const t = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.flipY = false;
    t.needsUpdate = true;
    return t;
  };
  return new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: BOX_FRAG,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uMask: { value: tex(m) },
      uWalls: { value: tex(wl) },
      uSize: { value: new THREE.Vector2(w, h) },
      uMargin: { value: 0.5 },
      uWood: { value: new THREE.Color("#c9935a") },
      uFloor: { value: new THREE.Color("#f3e1c0") },
      uLacquer: { value: 0 },
    },
  });
}

// ---------------------------------------------------------------- table mat

const MAT_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform vec4 uRect;
uniform vec3 uA;
uniform vec3 uB;
uniform float uKind;   // 0 bamboo, 1 gingham, 2 café counter, 3 starry night
${COMMON}
void main() {
  vec2 w = mix(uRect.xy, uRect.zw, vUv);
  vec3 col = uA;
  if (uKind < 0.5) {
    float s = fract(w.x * 1.6);
    col = mix(uA, uB, smoothstep(0.85, 0.95, s) + smoothstep(0.15, 0.05, s) * 0.5);
    col *= 0.95 + 0.08 * noise(vec2(w.x * 2.0, w.y * 0.6));
    col *= 1.0 - smoothstep(0.96, 1.0, fract(w.y * 0.35)) * 0.15;
  } else if (uKind < 1.5) {
    float gx = step(0.5, fract(w.x * 0.7));
    float gy = step(0.5, fract(w.y * 0.7));
    col = mix(uA, uB, (gx + gy) * 0.5);
  } else if (uKind < 2.5) {
    col = uA * (0.9 + 0.12 * noise(vec2(w.x * 0.6, w.y * 6.0)));
  } else {
    col = uA;
    float star = step(0.985, hash(floor(w * 4.0)));
    col = mix(col, uB, star * smoothstep(0.2, 0.0, length(fract(w * 4.0) - 0.5)));
  }
  gl_FragColor = vec4(col, 1.0);
}`;

export function createMatMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: MAT_FRAG,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uRect: { value: new THREE.Vector4(0, 0, 10, 10) },
      uA: { value: new THREE.Color("#d9c08a") },
      uB: { value: new THREE.Color("#b89a62") },
      uKind: { value: 0 },
    },
  });
}

// ---------------------------------------------------------------- lid

const LID_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform vec2 uSize;
uniform vec3 uWood;
uniform vec3 uTie;
uniform float uAlpha;
${COMMON}
void main() {
  vec2 p = vUv * uSize;
  float d = sdRoundBox(p - uSize * 0.5, uSize * 0.5, 0.35);
  if (d > 0.0) discard;
  vec3 col = uWood * (0.92 + 0.1 * noise(vec2(p.x * 1.2, p.y * 10.0)));
  col += smoothstep(-0.12, 0.0, d) * 0.12;
  float band = smoothstep(0.32, 0.28, abs(p.x - uSize.x * 0.5)) + smoothstep(0.32, 0.28, abs(p.y - uSize.y * 0.5));
  col = mix(col, uTie, clamp(band, 0.0, 1.0));
  float knot = smoothstep(0.55, 0.45, length(p - uSize * 0.5));
  col = mix(col, uTie * 1.15, knot);
  gl_FragColor = vec4(col, uAlpha);
}`;

export function createLidMaterial(w: number, h: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: LID_FRAG,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uSize: { value: new THREE.Vector2(w, h) },
      uWood: { value: new THREE.Color("#b5783f") },
      uTie: { value: new THREE.Color("#e8443a") },
      uAlpha: { value: 1 },
    },
  });
}
