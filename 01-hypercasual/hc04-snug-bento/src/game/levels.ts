// Level source: tutorial JSON (1-20) -> shipped packs (21+) -> worker generator (past the packs).

import type { Board, LevelDef } from "../logic/rules.ts";
import { fromRow } from "./levels-row.ts";
import type { PackRow } from "./levels-row.ts";

interface PackFile {
  v: string;
  from: number;
  to: number;
  levels: PackRow[];
}
import type { SolveResult } from "../logic/solver.ts";
import { FIRST_PACK_LEVEL, PACK_SIZE, SHIPPED_PACKS, packIndexFor } from "../logic/packs.ts";
import tutorial from "../data/levels-tutorial.json";

const packCache = new Map<number, Promise<PackFile>>();
function loadPack(i: number): Promise<PackFile> {
  let p = packCache.get(i);
  if (!p) {
    p = fetch(`${import.meta.env.BASE_URL}packs/pack-${i}.json`).then((r) => {
      if (!r.ok) throw new Error(`pack ${i}: HTTP ${r.status}`);
      return r.json() as Promise<PackFile>;
    });
    packCache.set(i, p);
    p.catch(() => packCache.delete(i));
  }
  return p;
}

let worker: Worker | null = null;
let nextId = 1;
const waiting = new Map<number, (msg: { ok: boolean; result?: unknown; error?: string }) => void>();
function ask<T>(type: "solve" | "generate" | "daily", payload: unknown): Promise<T> {
  if (!worker) {
    worker = new Worker(new URL("../logic/worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e) => {
      const fn = waiting.get(e.data.id);
      if (fn) {
        waiting.delete(e.data.id);
        fn(e.data);
      }
    };
  }
  const id = nextId++;
  return new Promise<T>((resolve, reject) => {
    waiting.set(id, (msg) => (msg.ok ? resolve(msg.result as T) : reject(new Error(msg.error))));
    worker!.postMessage({ id, type, payload });
  });
}

export function solveInWorker(board: Board): Promise<SolveResult> {
  return ask("solve", board);
}

const copy = (d: LevelDef): LevelDef => JSON.parse(JSON.stringify(d)) as LevelDef;

const dailyCache = new Map<string, Promise<LevelDef>>();
export function getDaily(day: string): Promise<LevelDef> {
  let p = dailyCache.get(day);
  if (!p) {
    p = ask<LevelDef>("daily", day);
    dailyCache.set(day, p);
  }
  return p.then(copy);
}

export async function getLevel(n: number): Promise<LevelDef> {
  const tut = (tutorial as unknown as LevelDef[])[n - 1];
  if (n < FIRST_PACK_LEVEL && tut) return { ...copy(tut), n };
  const pi = packIndexFor(n);
  const forceGen = import.meta.env.DEV && new URLSearchParams(location.search).has("gen");
  if (n >= FIRST_PACK_LEVEL && pi < SHIPPED_PACKS && !forceGen) {
    try {
      const pack = await loadPack(pi);
      if (n - pack.from > PACK_SIZE - 20 && pi + 1 < SHIPPED_PACKS) void loadPack(pi + 1).catch(() => {});
      return fromRow(n, pack.levels[n - pack.from]);
    } catch (err) {
      console.warn("[snug-bento] pack missing, generating instead", err);
    }
  }
  return ask<LevelDef>("generate", n);
}
