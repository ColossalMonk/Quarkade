// The glass + liquid shader (DESIGN.md §2). One material per flask; layer data comes in uniforms.
// Each unit is one quarter-ish of the flask; heights animate so pours can grow and shrink smoothly.

import * as THREE from "three";

export const MAX_UNITS = 8;

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform vec4 uUnits[${MAX_UNITS}];   // rgb + weight (negative weight = murky)
uniform float uHeights[${MAX_UNITS}]; // display height of each unit, in units (0..1)
uniform float uSym[${MAX_UNITS}];     // colour-blind symbol id (12 = none)
uniform float uCount;
uniform float uCap;
uniform float uTime;
uniform float uWobble;
uniform float uGlow;
uniform float uSealed;
uniform float uCorked;
uniform float uHint;
uniform float uSymbols;
uniform vec3 uTint;
uniform vec3 uRim;
uniform float uFrost;
uniform float uShape;      // 0 tube, 1 beaker, 2 potion
uniform float uAspect;     // quad height / width
uniform float uUnitV;      // one unit's height in uv
uniform float uBottomV;    // inner bottom in uv

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float sdRoundBox(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }

// Same 12 symbols as forge games' colour-blind mode.
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
}

// Half-width of the inner glass at height v (shapes).
float innerHalfWidth(float v) {
  if (uShape < 0.5) return 0.385;                      // tube
  if (uShape < 1.5) return 0.395 - 0.03 * v;           // beaker: slightly tapered
  float bulb = smoothstep(0.62, 0.40, v);              // potion: round body, narrow neck
  return mix(0.22, 0.4, bulb);
}

vec3 liquidLook(vec3 base, float w, vec2 uv, float yInUnit, float t) {
  vec3 c = base;
  if (w < 0.0) {                                       // murky
    float n = noise(uv * vec2(9.0, 18.0) + t * 0.2);
    return mix(vec3(0.55, 0.53, 0.5), vec3(0.72, 0.7, 0.67), n);
  }
  if (w < 1.5) {                                       // foam: bubbly, bright
    vec2 g = uv * vec2(22.0, 34.0) + vec2(0.0, -t * 0.25);
    vec2 cellId = floor(g);
    vec2 f = fract(g) - 0.5 + (vec2(hash(cellId), hash(cellId + 7.1)) - 0.5) * 0.4;
    float r = 0.18 + 0.2 * hash(cellId + 3.3);
    float ring = smoothstep(r, r - 0.08, length(f)) - smoothstep(r - 0.1, r - 0.16, length(f));
    c = mix(c, vec3(1.0), 0.3 + 0.35 * ring);
  } else if (w < 2.5) {                                // oil: iridescent sheen
    vec3 film = 0.5 + 0.5 * cos(6.2831 * (uv.x * 1.5 + yInUnit * 0.6 + t * 0.05 + vec3(0.0, 0.33, 0.67)));
    c = mix(c, c * 0.6 + film * 0.55, 0.28);
    c += 0.18 * smoothstep(0.08, 0.0, abs(uv.x - 0.36));
  } else if (w < 3.5) {                                // water: clear gradient + micro bubbles
    c *= 0.86 + 0.22 * yInUnit;
    vec2 bg = vec2(uv.x * 26.0, uv.y * 40.0 - t * 1.5);
    vec2 bid = floor(bg);
    float has = step(0.93, hash(bid));
    float bub = has * smoothstep(0.16, 0.06, length(fract(bg) - 0.5));
    c = mix(c, vec3(1.0), bub * 0.45);
  } else if (w < 4.5) {                                // syrup: dark, glossy
    c *= 0.78 + 0.14 * yInUnit;
    c += 0.22 * smoothstep(0.05, 0.0, abs(uv.x - 0.34)) * (0.6 + 0.4 * sin(uv.y * 30.0 + t));
  } else {                                             // mercury: metallic bands
    float band = 0.5 + 0.5 * sin(uv.x * 18.0 + uv.y * 2.0);
    c = mix(c * 0.55, c * 1.35, band);
    c += 0.3 * smoothstep(0.04, 0.0, abs(uv.x - 0.38));
  }
  return c;
}

void main() {
  vec2 uv = vUv;
  // Glass outline in a square-ish space.
  vec2 p = vec2((uv.x - 0.5), (uv.y - 0.5) * uAspect);
  float halfH = 0.5 * uAspect;
  float outer = sdRoundBox(p, vec2(0.46, halfH - 0.01), 0.22);
  if (outer > 0.0) discard;

  float v = (uv.y - uBottomV);                         // height inside, in uv
  float hw = innerHalfWidth(clamp(v / max(0.001, uUnitV * uCap), 0.0, 1.0));
  float insideX = step(abs(uv.x - 0.5), hw);
  vec4 col = vec4(uTint, 0.16 + uFrost * 0.35);        // empty glass

  // Liquid
  float yUnits = v / uUnitV;
  float acc = 0.0;
  float total = 0.0;
  for (int i = 0; i < ${MAX_UNITS}; i++) { if (float(i) < uCount) total += uHeights[i]; }
  float surface = total + sin((uv.x * 3.1416 * 2.0) + uTime * 5.0) * uWobble * 0.12;
  float inner = sdRoundBox(p - vec2(0.0, 0.0), vec2(hw, halfH - 0.05), 0.17);
  if (uCount > 0.5 && insideX > 0.5 && inner < 0.0 && v > -0.03 && yUnits < surface) {
    vec4 unit = uUnits[0];
    float sym = uSym[0];
    float yIn = 0.0;
    float boundary = 1.0;
    for (int i = 0; i < ${MAX_UNITS}; i++) {
      if (float(i) >= uCount) break;
      float h = uHeights[i];
      if (yUnits < acc + h || i == int(uCount) - 1) {
        unit = uUnits[i];
        sym = uSym[i];
        yIn = clamp((yUnits - acc) / max(h, 0.001), 0.0, 1.0);
        // darken thin seams between different liquids
        if (i > 0 && uUnits[i - 1].rgb != unit.rgb) boundary = mix(0.82, 1.0, smoothstep(0.0, 0.05, yUnits - acc));
        break;
      }
      acc += h;
    }
    vec3 c = liquidLook(unit.rgb, unit.a, uv, yIn, uTime) * boundary;
    c *= 0.8 + 0.25 * cos((uv.x - 0.5) / hw * 1.35);  // round shading: looks cylindrical
    // Meniscus: brighter rim at the very top surface
    c += 0.18 * smoothstep(0.06, 0.0, surface - yUnits);
    if (uSymbols > 0.5 && unit.a >= 0.0) {
      vec2 cell = vec2(fract((uv.x - 0.5) / 0.26 + 0.5) - 0.5, (yIn - 0.5) * 0.9);
      float m = symbolMask(sym, cell) * step(abs(uv.x - 0.5), 0.13);
      float lum = dot(c, vec3(0.299, 0.587, 0.114));
      c = mix(c, lum > 0.45 ? c * 0.28 : c * 0.4 + 0.6, m * 0.9);
    }
    col = vec4(c, 0.97);
  }

  // Glass edges and highlights
  float edge = smoothstep(0.035, 0.0, abs(outer + 0.02));
  col.rgb = mix(col.rgb, uRim, edge * 0.7);
  col.a = max(col.a, edge * 0.85);
  float streak = smoothstep(0.03, 0.0, abs(uv.x - 0.24)) * smoothstep(0.1, 0.4, uv.y) * 0.35;
  col.rgb += streak;
  col.a = max(col.a, streak);
  // Cork when sealed or corked
  float corkTop = uBottomV + uUnitV * uCap + 0.02;
  // The cork slides down into the neck as uSealed goes 0 -> 1.
  float corkDrop = (1.0 - clamp(max(uSealed, uCorked), 0.0, 1.0)) * 0.14;
  if ((uSealed > 0.01 || uCorked > 0.5) && uv.y > corkTop + corkDrop && abs(uv.x - 0.5) < 0.24) {
    float n = noise(uv * 60.0);
    col = vec4(mix(vec3(0.62, 0.42, 0.24), vec3(0.75, 0.55, 0.33), n), 1.0);
  }
  // Selection / hint glow around the glass
  float glow = max(uGlow, uHint * (0.5 + 0.5 * sin(uTime * 7.0)));
  col.rgb = mix(col.rgb, vec3(1.0, 0.92, 0.55), glow * smoothstep(0.05, 0.0, abs(outer + 0.01)) * 0.9);
  col.a = max(col.a, glow * smoothstep(0.05, 0.0, abs(outer + 0.01)));
  gl_FragColor = col;
}`;

export function createLiquidMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    uniforms: {
      uUnits: { value: Array.from({ length: MAX_UNITS }, () => new THREE.Vector4()) },
      uHeights: { value: new Array(MAX_UNITS).fill(0) },
      uSym: { value: new Array(MAX_UNITS).fill(12) },
      uCount: { value: 0 },
      uCap: { value: 4 },
      uTime: { value: 0 },
      uWobble: { value: 0 },
      uGlow: { value: 0 },
      uSealed: { value: 0 },
      uCorked: { value: 0 },
      uHint: { value: 0 },
      uSymbols: { value: 0 },
      uTint: { value: new THREE.Color(0xe8f4fb) },
      uRim: { value: new THREE.Color(0xffffff) },
      uFrost: { value: 0 },
      uShape: { value: 0 },
      uAspect: { value: 2 },
      uUnitV: { value: 0.2 },
      uBottomV: { value: 0.05 },
    },
  });
}
