// Vite dev-server plugin: lets dev-only pages save files into the game folder, for example
// store art rendered by a press page, or levels made in the level editor.
//   POST /__save?path=press/cover-1920x1080.png   body: { "base64": "..." } or { "text": "..." }
// Only in `vite serve`, only under the allowed folders, never in a production build.

import type { Plugin } from "vite";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, normalize, sep } from "node:path";

export function devSave(root: string, allowed: string[] = ["press", "levels-edit"]): Plugin {
  return {
    name: "quarkade-dev-save",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/__save", (req, res) => {
        const url = new URL(req.url ?? "", "http://localhost");
        const rel = normalize(url.searchParams.get("path") ?? "");
        const ok = req.method === "POST" && /^[\w\-./\\]+$/.test(rel) && !rel.includes("..") && allowed.some((a) => rel.startsWith(a + sep) || rel.startsWith(a + "/"));
        if (!ok) {
          res.statusCode = 400;
          res.end("bad path");
          return;
        }
        const chunks: Buffer[] = [];
        req.on("data", (c: Buffer) => chunks.push(c));
        req.on("end", () => {
          try {
            const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as { base64?: string; text?: string };
            const file = join(root, rel);
            mkdirSync(dirname(file), { recursive: true });
            if (body.base64 !== undefined) writeFileSync(file, Buffer.from(body.base64, "base64"));
            else writeFileSync(file, body.text ?? "", "utf8");
            res.end("saved " + rel);
          } catch (err) {
            res.statusCode = 500;
            res.end(String(err));
          }
        });
      });
    },
  };
}
