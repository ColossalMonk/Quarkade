// Web Worker: hints (solve from the current board) and levels past the shipped packs.
// Keeps the UI smooth while the solver runs.

import { solve } from "./solver.ts";
import { generateLevel, generateDaily } from "./generator.ts";

interface Req {
  id: number;
  type: "solve" | "generate" | "daily";
  payload: unknown;
}

self.onmessage = (e: MessageEvent<Req>) => {
  const { id, type, payload } = e.data;
  try {
    if (type === "solve") {
      const p = payload as { stacks: number[][]; caps: number[]; L: number; basket: number[]; moth: { needle: number; count: number } | null };
      const res = solve(p, { weight: 1.8, maxNodes: 80000 });
      (self as unknown as Worker).postMessage({ id, ok: true, result: res });
    } else if (type === "generate") {
      const n = payload as number;
      const lvl = generateLevel(n, { candidates: 4, maxNodes: 80000 });
      (self as unknown as Worker).postMessage({ id, ok: true, result: lvl.def });
    } else if (type === "daily") {
      const lvl = generateDaily(payload as string);
      (self as unknown as Worker).postMessage({ id, ok: true, result: lvl.def });
    }
  } catch (err) {
    (self as unknown as Worker).postMessage({ id, ok: false, error: String(err) });
  }
};
