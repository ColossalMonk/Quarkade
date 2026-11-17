// Level source: tutorial JSON (1-20) -> shipped packs (21+) -> worker generator (past the packs).

import type { LevelDef, LevelTag, Move } from "../logic/rules.ts";
import { FIRST_PACK_LEVEL, PACK_SIZE, SHIPPED_PACKS, packIndexFor } from "../logic/packs.ts";
import tutorial from "../data/levels-tutorial.json";

type PackRow = [number[], string[], number, number, string, [number, number]?];
interface PackFile {
  v: string;
  from: number;
  to: number;
  L: number;
  levels: PackRow[];
}

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

// ---- worker ----
let worker: Worker | null = null;
let nextId = 1;
const waiting = new Map<number, (msg: { ok: boolean; result?: unknown; error?: string }) => void>();

function getWorker(): Worker {
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
  return worker;
}

function ask<T>(type: "solve" | "generate" | "daily", payload: unknown): Promise<T> {
  const w = getWorker();
  const id = nextId++;
  return new Promise<T>((resolve, reject) => {
    waiting.set(id, (msg) => (msg.ok ? resolve(msg.result as T) : reject(new Error(msg.error))));
    w.postMessage({ id, type, payload });
  });
}

export function solveInWorker(board: { stacks: number[][]; caps: number[]; L: number; basket: number[]; moth: { needle: number; count: number } | null }): Promise<{ solved: boolean; moves: Move[] }> {
  return ask("solve", board);
}

const dailyCache = new Map<string, Promise<LevelDef>>();

/** The Daily Swatch for a UTC day (generated in the worker, cached for the session). */
export function getDaily(dayKey: string): Promise<LevelDef> {
  let p = dailyCache.get(dayKey);
  if (!p) {
    p = ask<LevelDef>("daily", dayKey);
    dailyCache.set(dayKey, p);
  }
  return p.then((d) => ({ ...d, caps: d.caps.slice(), stacks: d.stacks.slice() }));
}

export async function getLevel(n: number): Promise<LevelDef> {
  if (n < FIRST_PACK_LEVEL) {
    const def = (tutorial as LevelDef[])[n - 1];
    return { ...def, caps: def.caps.slice(), stacks: def.stacks.slice() };
  }
  const pi = packIndexFor(n);
  // Dev: ?gen=1 skips the packs and generates every level live (for testing generator changes).
  const forceGen = import.meta.env.DEV && new URLSearchParams(location.search).has("gen");
  if (pi < SHIPPED_PACKS && !forceGen) {
    try {
      const pack = await loadPack(pi);
      const row = pack.levels[n - pack.from];
      // Warm the next pack as the player nears the end of this one.
      if (n - pack.from > PACK_SIZE - 20 && pi + 1 < SHIPPED_PACKS) void loadPack(pi + 1).catch(() => {});
      const def: LevelDef = { n, caps: row[0].slice(), stacks: row[1].slice(), par: row[2], d: row[3], tag: row[4] as LevelTag, L: pack.L };
      if (row[5]) def.moth = [row[5][0], row[5][1]];
      return def;
    } catch (err) {
      console.warn("[knotwork] pack missing, generating instead", err);
    }
  }
  return ask<LevelDef>("generate", n);
}
