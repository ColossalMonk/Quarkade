import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { devSave } from "../../forge/tools/vite-dev-save.ts";

// Build one platform at a time: VITE_PLATFORM=crazygames node ../../node_modules/vite/bin/vite.js build
// (or use forge/tools/build-all.ts to build every platform).
const platform = process.env.VITE_PLATFORM ?? "local";
const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: "./",
  plugins: [devSave(root)],
  build: {
    outDir: `dist/${platform}`,
    emptyOutDir: true,
    target: "es2020",
    assetsInlineLimit: 4096,
    chunkSizeWarningLimit: 900,
  },
  worker: { format: "es" },
  server: { port: 5194, strictPort: true },
  preview: { port: 5195, strictPort: true },
});
