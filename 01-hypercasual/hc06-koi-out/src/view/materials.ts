// Koi Out shaders (DESIGN.md §2): the water + bank quad, and the koi body.

import * as THREE from "three";

export const MAX_RIPPLES = 10;

const NOISE = /* glsl */ `
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
`;

/** Water inside the pond rectangle, stones and grass on the bank, reeds where exits are closed. */
export function createWaterMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uSize: { value: new THREE.Vector2(5, 7) },
      uTime: { value: 0 },
      uDeep: { value: new THREE.Color("#1f5f6b") },
      uShallow: { value: new THREE.Color("#4fa3a5") },
      uStone: { value: new THREE.Color("#9a9488") },
      uGrass: { value: new THREE.Color("#6f9a4a") },
      uReeds: { value: null as THREE.DataTexture | null },
      uRipples: { value: Array.from({ length: MAX_RIPPLES }, () => new THREE.Vector3(0, 0, -99)) },
    },
    vertexShader: /* glsl */ `
      varying vec2 vW;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xy;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec2 uSize;
      uniform float uTime;
      uniform vec3 uDeep, uShallow, uStone, uGrass;
      uniform sampler2D uReeds;
      uniform vec3 uRipples[${MAX_RIPPLES}];
      varying vec2 vW;
      ${NOISE}
      void main() {
        // Pond space: x right, y down, in cells.
        vec2 p = vec2(vW.x, -vW.y);
        vec2 inside = step(vec2(0.0), p) * step(p, uSize);
        float inPond = inside.x * inside.y;
        float edge = min(min(p.x, p.y), min(uSize.x - p.x, uSize.y - p.y));
        vec3 col;
        if (inPond > 0.5) {
          float depth = smoothstep(0.0, 2.2, edge);
          col = mix(uShallow, uDeep, depth);
          // Caustics: two drifting noise layers, bright where they meet.
          float c1 = noise(p * 1.7 + vec2(uTime * 0.18, uTime * 0.11));
          float c2 = noise(p * 2.3 - vec2(uTime * 0.13, -uTime * 0.16));
          float caust = pow(1.0 - abs(c1 - c2), 6.0);
          col += caust * 0.16;
          // Dappled light from the trees above.
          col *= 0.92 + 0.12 * noise(p * 0.6 + uTime * 0.03);
          // A faint cell grid on the pond floor.
          vec2 g = abs(fract(p) - 0.5);
          col *= 1.0 - 0.05 * smoothstep(0.47, 0.5, max(g.x, g.y));
          // Ripples.
          for (int i = 0; i < ${MAX_RIPPLES}; i++) {
            vec3 r = uRipples[i];
            float age = uTime - r.z;
            if (age < 0.0 || age > 1.6) continue;
            float d = length(p - r.xy);
            float ring = smoothstep(0.07, 0.0, abs(d - age * 1.4)) * (1.0 - age / 1.6);
            col += ring * 0.22;
          }
          // Soft shade along the bank.
          col *= 0.75 + 0.25 * smoothstep(0.0, 0.35, edge);
        } else {
          // Bank: rounded stones near the water, grass beyond.
          float away = -min(min(p.x, p.y), min(uSize.x - p.x, uSize.y - p.y));
          vec2 sp = p * 2.2;
          vec2 id = floor(sp);
          vec2 f = fract(sp) - 0.5;
          float r = 0.36 + 0.1 * hash(id);
          float stone = smoothstep(r, r - 0.07, length(f + (vec2(hash(id + 3.1), hash(id + 7.7)) - 0.5) * 0.2));
          vec3 st = uStone * (0.8 + 0.35 * hash(id + 1.3)) * (0.85 + 0.15 * noise(p * 9.0));
          vec3 grass = uGrass * (0.85 + 0.25 * noise(p * 4.0));
          col = mix(grass * 0.85, st, stone * smoothstep(0.75, 0.45, away));
          col = mix(col, grass, smoothstep(0.55, 0.85, away));
          // Reeds on closed stretches of the bank.
          vec2 cell = floor(p) + 1.0;
          float reed = texture2D(uReeds, (cell + 0.5) / (uSize + 2.0)).r;
          if (reed > 0.5 && away < 0.8) {
            // Reed tufts close to the water: thin blades, fading out away from the edge.
            float blade = smoothstep(0.12, 0.0, abs(fract(p.x * 7.0 + noise(p * 4.0) * 0.8 + p.y * 2.0) - 0.5) - 0.32);
            float fade = smoothstep(0.8, 0.2, away);
            col = mix(col, uGrass * vec3(0.7, 0.95, 0.6) * (0.75 + 0.5 * noise(p * 14.0)), blade * fade * 0.9);
          }
        }
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
}

/** The koi body: a ribbon strip with uv (u along the body incl. tail fin, v across -1..1). */
export function createKoiMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    side: THREE.DoubleSide,
    uniforms: {
      uBase: { value: new THREE.Color("#f7f3ec") },
      uSpot: { value: new THREE.Color("#e0352b") },
      uSpot2: { value: new THREE.Color("#1d1d22") },
      uPattern: { value: 1 },
      uSeed: { value: 0 },
      uLen: { value: 3 },
      uFin: { value: 0.2 },
      uBody: { value: 1 },
      uGlow: { value: 0 },
      uAlpha: { value: 1 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uBase, uSpot, uSpot2;
      uniform float uPattern, uSeed, uLen, uFin, uGlow, uAlpha, uBody;
      varying vec2 vUv;
      ${NOISE}
      void main() {
        float u = vUv.x;
        float v = vUv.y;
        if (u < uFin) {
          // Tail fin: soft and see-through, with fin rays.
          float rays = 0.85 + 0.15 * sin(v * 18.0);
          vec3 fin = mix(uBase, vec3(1.0), 0.35) * rays;
          float a = 0.7 * smoothstep(0.0, 0.25, u / uFin) * (1.0 - smoothstep(0.85, 1.0, abs(v)));
          gl_FragColor = vec4(fin, a * uAlpha);
          return;
        }
        float q = (u - uFin) / (1.0 - uFin);
        // Distance from the nose, in cells.
        float dh = (1.0 - q) * uBody;
        vec2 bp = vec2(q * uLen * 1.4, v * 0.9) + uSeed;
        vec3 col = uBase;
        float n1 = noise(bp * 1.1);
        float n2 = noise(bp * 2.6 + 4.2);
        if (uPattern < 0.5) {
          // Solid / metallic: a sheen along the back.
          col = mix(uBase, uSpot, smoothstep(0.5, 0.0, abs(v)) * 0.6);
        } else if (uPattern < 1.5) {
          col = mix(uBase, uSpot, smoothstep(0.48, 0.55, n1));
        } else if (uPattern < 2.5) {
          col = mix(uBase, uSpot, smoothstep(0.5, 0.57, n1));
          col = mix(col, uSpot2, smoothstep(0.72, 0.76, n2) * step(abs(v), 0.8));
        } else if (uPattern < 3.5) {
          col = mix(uBase, uSpot, smoothstep(0.5, 0.56, n1));
          col = mix(col, uSpot2, smoothstep(0.62, 0.68, n2));
        } else if (uPattern < 4.5) {
          // Tancho: one round patch on the head.
          float d = length(vec2((dh - 0.36) * 1.6, v * 0.7));
          col = mix(uBase, uSpot, smoothstep(0.3, 0.24, d));
          col = mix(col, uSpot2, smoothstep(0.66, 0.7, n2) * step(0.7, dh));
        } else if (uPattern < 5.5) {
          // Asagi: net of scales on the back, warm sides.
          // Diamond-shaped scale outlines, soft.
          vec2 sc = vec2(q * uLen * 4.5, v * 2.2);
          vec2 cf = abs(fract(vec2(sc.x + sc.y, sc.x - sc.y) * 0.7) - 0.5);
          float net = smoothstep(0.36, 0.48, max(cf.x, cf.y));
          col = mix(uBase, uSpot2, net * 0.28);
          col = mix(col, uSpot, smoothstep(0.55, 0.9, abs(v)));
        } else if (uPattern < 6.5) {
          col = mix(uBase, uSpot, smoothstep(0.52, 0.58, n1));
        } else {
          // Ginrin: sparkling scales.
          col = mix(uBase, uSpot, smoothstep(0.48, 0.55, n1));
          vec2 sc = fract(vec2(q * uLen * 7.0, v * 3.5)) - 0.5;
          col += uSpot2 * smoothstep(0.18, 0.05, length(sc)) * 0.35;
        }
        // Scales, a darker spine, rounded shading, eyes.
        col *= 0.94 + 0.06 * sin(q * uLen * 22.0) * sin(v * 9.0);
        col *= 1.0 - 0.12 * smoothstep(0.25, 0.0, abs(v)) * smoothstep(0.2, 0.5, q);
        col *= 0.72 + 0.28 * (1.0 - v * v);
        if (dh > 0.1 && dh < 0.21 && abs(abs(v) - 0.55) < 0.15) col = mix(col, vec3(0.05), 0.9);
        // Pectoral fins: see-through edges near the front.
        float pect = exp(-pow((dh - 0.72) / 0.1, 2.0)) * step(0.72, abs(v));
        float alpha = 1.0 - pect * 0.45;
        col = mix(col, vec3(1.0), pect * 0.3);
        col = mix(col, vec3(1.0, 0.95, 0.6), uGlow * (0.35 + 0.35 * step(0.8, abs(v))));
        // Edge outline.
        alpha *= smoothstep(1.0, 0.86, abs(v)) * 0.35 + 0.65;
        col *= 1.0 - 0.25 * smoothstep(0.82, 1.0, abs(v));
        gl_FragColor = vec4(col, alpha * uAlpha);
      }`,
  });
}

export function createShadowMaterial(): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ color: 0x0a2a2a, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide });
}
