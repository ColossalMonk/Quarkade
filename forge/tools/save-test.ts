// Tests for forge's save slot and its tamper check.
//   node forge/tools/save-test.ts

import { SaveSlot, sealEnvelope, openEnvelope } from "../src/core/save.ts";
import type { PlatformStorage } from "../src/platform/types.ts";

interface Data {
  level: number;
  coins: number;
  name: string;
  settings: { sound: boolean };
}
const defaults = (): Data => ({ level: 1, coins: 100, name: "", settings: { sound: true } });

function memoryStorage(): PlatformStorage & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    async getItem(k) {
      return map.get(k) ?? null;
    },
    async setItem(k, v) {
      map.set(k, v);
    },
  };
}

let failed = 0;
function check(name: string, ok: boolean, extra = ""): void {
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${extra ? `  ${extra}` : ""}`);
  if (!ok) failed++;
}

/** Simulates a player editing the stored payload (decode, change, re-encode) without the checksum. */
function editPayload(raw: string, change: (d: Data) => void): string {
  const env = JSON.parse(raw);
  const data = JSON.parse(Buffer.from(env.p, "base64").toString("utf8"));
  change(data);
  env.p = Buffer.from(JSON.stringify(data), "utf8").toString("base64");
  return JSON.stringify(env);
}

const slot = (st: PlatformStorage, key = "game", version = 2, migrate?: (o: unknown, v: number) => Data) =>
  new SaveSlot<Data>(st, { key, version, defaults, migrate });

// 1. Round trip, including non-ASCII text.
{
  const st = memoryStorage();
  const a = slot(st);
  await a.load();
  a.data.level = 42;
  a.data.coins = 777;
  a.data.name = "日本語 ✓ ñ";
  await a.flush();
  const b = slot(st);
  await b.load();
  check("round trip", b.data.level === 42 && b.data.coins === 777 && b.data.name === "日本語 ✓ ñ" && b.source === "main");
  check("stored encoded, not readable JSON", !st.map.get("game")!.includes("\"level\""));
  check("backup copy written", st.map.get("game~") === st.map.get("game"));
}

// 2. Edited main copy -> backup is used and main is repaired.
{
  const st = memoryStorage();
  const a = slot(st);
  await a.load();
  a.data.level = 12;
  await a.flush();
  st.map.set("game", editPayload(st.map.get("game")!, (d) => ((d.level = 3000), (d.coins = 99999))));
  const b = slot(st);
  await b.load();
  check("edited main ignored, backup used", b.data.level === 12 && b.data.coins === 100 && b.source === "backup", `level ${b.data.level}`);
  check("main repaired from backup", openEnvelope(st.map.get("game")!, "game") !== null);
}

// 3. Both copies edited -> rejected, fresh start, storage cleaned.
{
  const st = memoryStorage();
  const a = slot(st);
  await a.load();
  a.data.level = 12;
  await a.flush();
  for (const k of ["game", "game~"]) st.map.set(k, editPayload(st.map.get(k)!, (d) => (d.level = 3000)));
  const b = slot(st);
  await b.load();
  check("both edited -> rejected, fresh", b.source === "rejected" && b.data.level === 1);
  check("edited copies overwritten", openEnvelope(st.map.get("game")!, "game") !== null && openEnvelope(st.map.get("game~")!, "game") !== null);
}

// 4. Hand-written plain JSON (the old, unprotected format) is rejected.
{
  const st = memoryStorage();
  st.map.set("game", JSON.stringify({ v: 2, data: { level: 3000, coins: 99999 } }));
  const b = slot(st);
  await b.load();
  check("plain JSON save rejected", b.source === "rejected" && b.data.level === 1);
}

// 5. Checksum change only (payload intact) is rejected too.
{
  const st = memoryStorage();
  const env = JSON.parse(sealEnvelope(2, { ...defaults(), level: 9 }, "game"));
  env.s = "abc";
  st.map.set("game", JSON.stringify(env));
  const b = slot(st);
  await b.load();
  check("wrong checksum rejected", b.source === "rejected" && b.data.level === 1);
}

// 6. A save copied from another game (different key) is rejected.
{
  const st = memoryStorage();
  st.map.set("game", sealEnvelope(2, { ...defaults(), level: 500 }, "othergame"));
  const b = slot(st);
  await b.load();
  check("save from another game rejected", b.source === "rejected" && b.data.level === 1);
}

// 7. Garbage text is rejected without throwing.
{
  const st = memoryStorage();
  st.map.set("game", "not json at all {");
  st.map.set("game~", "{\"v\":2,\"p\":\"%%%\",\"s\":\"x\"}");
  const b = slot(st);
  await b.load();
  check("garbage rejected", b.source === "rejected" && b.data.level === 1);
}

// 8. No save at all -> fresh, nothing written.
{
  const st = memoryStorage();
  const b = slot(st);
  await b.load();
  check("no save -> fresh, no write", b.source === "fresh" && st.map.size === 0);
}

// 9. Older version goes through migrate.
{
  const st = memoryStorage();
  st.map.set("game", sealEnvelope(1, { lvl: 33 }, "game"));
  const b = slot(st, "game", 2, (old, v) => ({ ...defaults(), level: v === 1 ? (old as { lvl: number }).lvl : 1 }));
  await b.load();
  check("migrate from v1", b.data.level === 33 && b.source === "main");
}

// 10. New fields get defaults (mergeDefaults still applies).
{
  const st = memoryStorage();
  st.map.set("game", sealEnvelope(2, { level: 7, settings: {} }, "game"));
  const b = slot(st);
  await b.load();
  check("missing fields get defaults", b.data.level === 7 && b.data.coins === 100 && b.data.settings.sound === true);
}

// 11. Reset writes a valid fresh save.
{
  const st = memoryStorage();
  const a = slot(st);
  await a.load();
  a.data.level = 50;
  await a.flush();
  await a.reset();
  const b = slot(st);
  await b.load();
  check("reset", b.data.level === 1 && b.source === "main");
}

// 12. A large save (3,000 level star entries) stays a reasonable size.
{
  const st = memoryStorage();
  const a = new SaveSlot<Record<string, unknown>>(st, { key: "big", version: 1, defaults: () => ({}) });
  await a.load();
  const stars: Record<string, number> = {};
  for (let i = 1; i <= 3000; i++) stars[i] = (i % 3) + 1;
  a.data.stars = stars;
  await a.flush();
  const kb = (st.map.get("big")!.length + st.map.get("big~")!.length) / 1024;
  check("3,000-level save size (both copies)", kb < 200, `${kb.toFixed(0)} KB`);
}

console.log(failed ? `\n${failed} FAILED` : "\nall save checks passed");
process.exit(failed ? 1 : 0);
