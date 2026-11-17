// Materials made in code: knitted yarn, wood grain, felt, picnic cloth, starry board, soft shadows.

import * as THREE from "three";

export interface KnitUniforms {
  uStitch: { value: number };
  uFuzz: { value: number };
  uRainbow: { value: number };
  uSymbols: { value: number };
}

/**
 * Yarn: per-instance colour, V-stitch pattern along the loop, fuzzy rim light.
 * aColor2 (per instance): second colour of twisted yarn, drawn as a spiral (plain loops repeat
 * their own colour). aSymbol (per instance, x = colour 1, y = colour 2): colour-blind symbol id,
 * 12 = none. Uniforms switch yarn styles and symbols on/off.
 */
export function createKnitMaterial(): { material: THREE.MeshStandardMaterial; uniforms: KnitUniforms } {
  const uniforms: KnitUniforms = {
    uStitch: { value: 1 },
    uFuzz: { value: 0.38 },
    uRainbow: { value: 0 },
    uSymbols: { value: 0 },
  };
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.92, metalness: 0 });
  mat.defines = { ...(mat.defines ?? {}), USE_UV: "" };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute vec3 aColor2;\nattribute vec2 aSymbol;\nvarying vec3 vColor2;\nvarying vec2 vSymbol;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvColor2 = aColor2;\nvSymbol = aSymbol;");
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        varying vec3 vColor2;
        varying vec2 vSymbol;
        uniform float uStitch;
        uniform float uFuzz;
        uniform float uRainbow;
        uniform float uSymbols;
        // 12 simple shapes for colour-blind mode, in a cell centred on p = 0.
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
        }`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        float twist = step(0.5, fract(vUv.x * 9.0 + vUv.y));
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuse * vColor2, twist);
        {
          float u = vUv.x;            // around the loop
          float v = vUv.y;            // around the yarn tube
          float stitch = sin((u * 44.0 + abs(v - 0.5) * 5.0) * 6.2831);
          float ply = sin((u * 140.0 - v * 9.0) * 6.2831);
          float shade = 1.0 - uStitch * 0.22 + uStitch * 0.16 * smoothstep(-0.7, 0.9, stitch) + 0.06 * ply;
          diffuseColor.rgb *= shade;
          vec3 rb = 0.72 + 0.28 * cos(6.2831 * (u * 2.0 + vec3(0.0, 0.33, 0.67)));
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * rb * 1.15, uRainbow);
          if (uSymbols > 0.5) {
            float id = mix(vSymbol.x, vSymbol.y, twist);
            vec2 cell = vec2(fract(u * 7.0), fract(v * 2.0)) - 0.5;
            cell.y *= 0.8;
            float m = symbolMask(id, cell);
            float lum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
            vec3 mark = lum > 0.35 ? diffuseColor.rgb * 0.25 : diffuseColor.rgb * 0.4 + 0.6;
            diffuseColor.rgb = mix(diffuseColor.rgb, mark, m * 0.9);
          }
        }`,
      )
      .replace(
        "#include <opaque_fragment>",
        `{
          float rim = 1.0 - abs(dot(normalize(vViewPosition), normal));
          outgoingLight += diffuseColor.rgb * pow(rim, 2.2) * uFuzz;
        }
        #include <opaque_fragment>`,
      );
  };
  return { material: mat, uniforms };
}

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d")!];
}

function toTexture(c: HTMLCanvasElement, repeat = true): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  if (repeat) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

/** Warm wood board texture drawn on a canvas. */
export function createWoodTexture(): THREE.CanvasTexture {
  const [c, g] = canvas(512, 512);
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, "#c48a55");
  grad.addColorStop(1, "#b77a47");
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 512);
  for (let p = 0; p < 4; p++) {
    const y0 = p * 128;
    g.fillStyle = `rgba(${p % 2 ? 90 : 120},${p % 2 ? 55 : 70},30,0.08)`;
    g.fillRect(0, y0, 512, 128);
    g.fillStyle = "rgba(70,40,20,0.35)";
    g.fillRect(0, y0, 512, 2);
    for (let i = 0; i < 26; i++) {
      const yy = y0 + 6 + Math.random() * 116;
      const amp = 2 + Math.random() * 5;
      // A whole number of waves across the texture, so it tiles without a seam.
      const freq = ((1 + Math.floor(Math.random() * 3)) * Math.PI * 2) / 512;
      const ph = Math.random() * 6;
      g.strokeStyle = `rgba(80,45,20,${0.06 + Math.random() * 0.12})`;
      g.lineWidth = 0.6 + Math.random() * 1.4;
      g.beginPath();
      for (let x = 0; x <= 512; x += 8) {
        const y = yy + Math.sin(x * freq + ph) * amp;
        if (x === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
    }
    if (Math.random() < 0.7) {
      const kx = 40 + Math.random() * 432; // away from the edges so knots don't get cut at the seam
      const ky = y0 + 30 + Math.random() * 68;
      for (let r = 14; r > 2; r -= 3) {
        g.strokeStyle = `rgba(80,45,20,${0.1 + (14 - r) * 0.015})`;
        g.beginPath();
        g.ellipse(kx, ky, r * 1.8, r * 0.7, 0, 0, Math.PI * 2);
        g.stroke();
      }
    }
  }
  return toTexture(c);
}

/** Green baize felt. */
export function createFeltTexture(): THREE.CanvasTexture {
  const [c, g] = canvas(256, 256);
  g.fillStyle = "#3f8752";
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 9000; i++) {
    g.fillStyle = Math.random() < 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,30,10,0.07)";
    g.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 2, 1);
  }
  return toTexture(c);
}

/** Red gingham picnic cloth. */
export function createPicnicTexture(): THREE.CanvasTexture {
  const [c, g] = canvas(256, 256);
  g.fillStyle = "#fbf3ea";
  g.fillRect(0, 0, 256, 256);
  const band = 32;
  g.fillStyle = "rgba(214,64,70,0.55)";
  for (let x = 0; x < 256; x += band * 2) g.fillRect(x, 0, band, 256);
  for (let y = 0; y < 256; y += band * 2) g.fillRect(0, y, 256, band);
  g.strokeStyle = "rgba(120,30,30,0.08)";
  for (let i = 0; i < 256; i += 3) {
    g.beginPath();
    g.moveTo(i, 0);
    g.lineTo(i, 256);
    g.stroke();
  }
  return toTexture(c);
}

/** Navy cloth with little stars. */
export function createStarryTexture(): THREE.CanvasTexture {
  const [c, g] = canvas(512, 512);
  g.fillStyle = "#26306a";
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 160; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const r = Math.random() < 0.15 ? 2.6 : 1.2;
    g.fillStyle = Math.random() < 0.3 ? "#ffe9a0" : "rgba(255,255,255,0.85)";
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  return toTexture(c);
}

/** Two-colour diagonal stripes, for candy-cane needles. */
export function createStripeTexture(a: string, b: string): THREE.CanvasTexture {
  const [c, g] = canvas(64, 64);
  g.fillStyle = a;
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = b;
  for (let k = -64; k < 128; k += 32) {
    g.beginPath();
    g.moveTo(k, 0);
    g.lineTo(k + 16, 0);
    g.lineTo(k + 16 + 64, 64);
    g.lineTo(k + 64, 64);
    g.fill();
  }
  const tex = toTexture(c);
  tex.repeat.set(1, 6);
  return tex;
}

/** Radial soft shadow for under needles. */
export function createShadowTexture(): THREE.CanvasTexture {
  const [c, g] = canvas(128, 128);
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  grad.addColorStop(0, "rgba(40,20,5,0.55)");
  grad.addColorStop(0.5, "rgba(40,20,5,0.22)");
  grad.addColorStop(1, "rgba(40,20,5,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return toTexture(c, false);
}
