// Level source: tutorial JSON (1-20) -> shipped packs (21+) -> worker generator (past the packs).

import type { LevelDef, LevelTag, Move } from "../logic/rules.ts";
import type { SolveInput } from "../logic/solver.ts";
import { FIRST_PACK_LEVEL, PACK_SIZE, SHIPPED_PACKS, packIndexFor } from "../logic/packs.ts";
import tutorial from "../data/levels-tutorial.json";

type Row = [number[], string[], number[], number, number, string, Array<[number, number]>?];
interface PackFile {
  v: string;
  from: number;
  to: number;
  L: number;
  levels: Row[];
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

export function solveInWorker(input: SolveInput): Promise<{ solved: boolean; moves: Move[] }> {
  return ask("solve", input);
}

const dailyCache = new Map<string, Promise<LevelDef>>();
export function getDaily(day: string): Promise<LevelDef> {
  let p = dailyCache.get(day);
  if (!p) {
    p = ask<LevelDef>("daily", day);
    dailyCache.set(day, p);
  }
  return p.then((d) => ({ ...d, caps: d.caps.slice(), stacks: d.stacks.slice() }));
}

export async function getLevel(n: number): Promise<LevelDef> {
  if (n < FIRST_PACK_LEVEL) {
    const def = (tutorial as LevelDef[])[n - 1];
    return { ...def, caps: def.caps.slice(), stacks: def.stacks.slice(), classes: def.classes.slice() };
  }
  const pi = packIndexFor(n);
  const forceGen = import.meta.env.DEV && new URLSearchParams(location.search).has("gen");
  if (pi < SHIPPED_PACKS && !forceGen) {
    try {
      const pack = await loadPack(pi);
      const r = pack.levels[n - pack.from];
      if (n - pack.from > PACK_SIZE - 20 && pi + 1 < SHIPPED_PACKS) void loadPack(pi + 1).catch(() => {});
      const def: LevelDef = { n, caps: r[0].slice(), stacks: r[1].slice(), classes: r[2].slice(), par: r[3], d: r[4], tag: r[5] as LevelTag, L: pack.L };
      if (r[6]) def.corks = r[6].map(([f, c]) => [f, c] as [number, number]);
      return def;
    } catch (err) {
      console.warn("[density] pack missing, generating instead", err);
    }
  }
  return ask<LevelDef>("generate", n);
}
