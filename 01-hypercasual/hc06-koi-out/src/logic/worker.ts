// Web Worker: hints (solving from the current pond), levels past the packs, and the Daily Pond.

import type { Board } from "./rules.ts";
import { hintKoi } from "./solver.ts";
import { generateLevel, generateDaily } from "./generator.ts";

interface Req {
  id: number;
  type: "hint" | "generate" | "daily";
  payload: unknown;
}

self.onmessage = (e: MessageEvent<Req>) => {
  const { id, type, payload } = e.data;
  const post = (msg: unknown) => (self as unknown as Worker).postMessage(msg);
  try {
    if (type === "hint") {
      const { board, prefer } = payload as { board: Board; prefer: number[] };
      post({ id, ok: true, result: hintKoi(board, prefer) });
    } else if (type === "generate") post({ id, ok: true, result: generateLevel(payload as number, { candidates: 3 }).def });
    else if (type === "daily") post({ id, ok: true, result: generateDaily(payload as string, { candidates: 4 }).def });
  } catch (err) {
    post({ id, ok: false, error: String(err) });
  }
};
