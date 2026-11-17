// Web Worker: hints and Restack (solving from the current board), levels past the packs, and the
// Daily Restock.

import type { Board } from "./rules.ts";
import { hintMove } from "./solver.ts";
import { restack } from "./restack.ts";
import { generateLevel, generateDaily } from "./generator.ts";

interface Req {
  id: number;
  type: "hint" | "restack" | "generate" | "daily";
  payload: unknown;
}

self.onmessage = (e: MessageEvent<Req>) => {
  const { id, type, payload } = e.data;
  const post = (msg: unknown) => (self as unknown as Worker).postMessage(msg);
  try {
    if (type === "hint") post({ id, ok: true, result: hintMove(payload as Board) });
    else if (type === "restack") post({ id, ok: true, result: restack(payload as Board) });
    else if (type === "generate") post({ id, ok: true, result: generateLevel(payload as number, { candidates: 3 }).def });
    else if (type === "daily") post({ id, ok: true, result: generateDaily(payload as string, { candidates: 4 }).def });
  } catch (err) {
    post({ id, ok: false, error: String(err) });
  }
};
