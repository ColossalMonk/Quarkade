// Versioned save data, written through the platform's storage (portal cloud save where
// available, otherwise localStorage). Writes are debounced so frequent changes stay cheap.
//
// Tamper check: the data is stored encoded (base64 of the JSON) with a salted checksum, and a
// second copy is kept under `<key>~`. On load, a copy whose checksum doesn't match is ignored:
// an edited save falls back to the other copy, and if neither is valid the game starts fresh.
// This stops casual edits in the browser's developer tools. It is not real security: the salt
// ships inside the game, so a determined player can still forge a save. Don't rely on it for
// anything that matters (leaderboards, real-money items) without a server check.

import type { PlatformStorage } from "../platform/types.ts";

export interface SaveOptions<T> {
  key: string;
  version: number;
  defaults: () => T;
  /** Upgrade older save data to the current version. */
  migrate?: (old: unknown, fromVersion: number) => T;
  debounceMs?: number;
}

/** What is stored: version, encoded payload, checksum. */
interface Envelope {
  v: number;
  p: string;
  s: string;
}

/** Where the loaded save came from. */
export type SaveSource = "main" | "backup" | "fresh" | "rejected";

const SALT = "qk-forge-1:7f3a9c2e";
const BACKUP_SUFFIX = "~";

export class SaveSlot<T extends object> {
  data: T;
  /** Set by load(): "rejected" means a save existed but failed the tamper check. */
  source: SaveSource = "fresh";
  private readonly opts: SaveOptions<T>;
  private storage: PlatformStorage;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(storage: PlatformStorage, opts: SaveOptions<T>) {
    this.storage = storage;
    this.opts = opts;
    this.data = opts.defaults();
  }

  async load(): Promise<T> {
    this.data = this.opts.defaults();
    this.source = "fresh";
    let sawSave = false;
    for (const [key, source] of [
      [this.opts.key, "main"],
      [this.opts.key + BACKUP_SUFFIX, "backup"],
    ] as const) {
      let raw: string | null = null;
      try {
        raw = await this.storage.getItem(key);
      } catch (err) {
        console.warn("[forge/save] could not read", key, err);
      }
      if (!raw) continue;
      sawSave = true;
      const opened = openEnvelope(raw, this.opts.key);
      if (!opened) {
        console.warn(`[forge/save] ${source} save failed the tamper check; ignoring it`);
        continue;
      }
      try {
        if (opened.v === this.opts.version) this.data = mergeDefaults(this.opts.defaults(), opened.data as Partial<T>);
        else if (this.opts.migrate) this.data = this.opts.migrate(opened.data, opened.v);
        else continue;
        this.source = source;
        // Repair a damaged main copy from the backup straight away.
        if (source === "backup") await this.flush();
        return this.data;
      } catch (err) {
        console.warn("[forge/save] could not use", source, "save", err);
      }
    }
    if (sawSave) {
      this.source = "rejected";
      await this.flush(); // overwrite the edited copies with a clean, valid save
    }
    return this.data;
  }

  /** Mark the data as changed; it is written after a short delay. */
  touch(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), this.opts.debounceMs ?? 400);
  }

  async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    const raw = sealEnvelope(this.opts.version, this.data, this.opts.key);
    // Both copies are written together, so drivers that save one blob can merge them into one upload.
    const results = await Promise.allSettled([
      this.storage.setItem(this.opts.key, raw),
      this.storage.setItem(this.opts.key + BACKUP_SUFFIX, raw),
    ]);
    for (const r of results) if (r.status === "rejected") console.warn("[forge/save] could not write save", r.reason);
  }

  async reset(): Promise<void> {
    this.data = this.opts.defaults();
    await this.flush();
  }
}

// ---------------------------------------------------------------- encoding and checksum

/** cyrb53: a fast 53-bit string hash. Good at catching edits; not cryptographic. */
export function cyrb53(str: string, seed = 0): number {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

function checksum(v: number, payload: string, key: string): string {
  return cyrb53(`${SALT}|${key}|${v}|${payload}`, 0x5a17).toString(36);
}

function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

function fromBase64(b64: string): string {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

/** Encode save data with its checksum. `key` ties the save to one game. */
export function sealEnvelope(version: number, data: unknown, key: string): string {
  const p = toBase64(JSON.stringify(data));
  const env: Envelope = { v: version, p, s: checksum(version, p, key) };
  return JSON.stringify(env);
}

/** Decode a stored save; null if it is malformed or fails the checksum. */
export function openEnvelope(raw: string, key: string): { v: number; data: unknown } | null {
  try {
    const env = JSON.parse(raw) as Partial<Envelope>;
    if (typeof env.v !== "number" || typeof env.p !== "string" || typeof env.s !== "string") return null;
    if (checksum(env.v, env.p, key) !== env.s) return null;
    return { v: env.v, data: JSON.parse(fromBase64(env.p)) };
  } catch {
    return null;
  }
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Saved data over defaults. Nested plain objects (e.g. settings) are merged one level deep, so
 * fields added in a game update get their defaults instead of disappearing from older saves.
 */
export function mergeDefaults<T extends object>(defaults: T, saved: Partial<T>): T {
  const out: Record<string, unknown> = { ...(defaults as Record<string, unknown>) };
  for (const [k, v] of Object.entries(saved ?? {})) {
    const def = (defaults as Record<string, unknown>)[k];
    out[k] = isPlainObject(def) && isPlainObject(v) && Object.keys(def).length ? { ...def, ...v } : v;
  }
  return out as T;
}

/** localStorage with an in-memory fallback (private mode, blocked storage). */
export function createLocalStorage(prefix = "quarkade:"): PlatformStorage {
  const memory = new Map<string, string>();
  return {
    async getItem(key) {
      try {
        return window.localStorage.getItem(prefix + key);
      } catch {
        return memory.get(key) ?? null;
      }
    },
    async setItem(key, value) {
      try {
        window.localStorage.setItem(prefix + key, value);
      } catch {
        memory.set(key, value);
      }
    },
  };
}
