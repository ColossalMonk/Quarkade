// Web Worker: hints (solve from the current board), levels past the packs, and the Daily Teardown.

import { solve } from "./solver.ts";
import type { Board } from "./rules.ts";
import { generateLevel, generateDaily } from "./generator.ts";

interface Req {
  id: number;
  type: "solve" | "generate" | "daily";
  payload: unknown;
}

self.onmessage = (e: MessageEvent<Req>) => {
  const { id, type, payload } = e.data;
  const post = (msg: unknown) => (self as unknown as Worker).postMessage(msg);
  try {
    if (type === "solve") post({ id, ok: true, result: solve(payload as Board, { maxNodes: 40000 }) });
    else if (type === "generate") post({ id, ok: true, result: generateLevel(payload as number, { candidates: 3 }).def });
    else if (type === "daily") post({ id, ok: true, result: generateDaily(payload as string, { candidates: 4 }).def });
  } catch (err) {
    post({ id, ok: false, error: String(err) });
  }
};
