// Loads a portal SDK script tag once.

const loaded = new Map<string, Promise<void>>();

export function loadScript(src: string, timeoutMs = 10000): Promise<void> {
  const existing = loaded.get(src);
  if (existing) return existing;
  const p = new Promise<void>((resolve, reject) => {
    const el = document.createElement("script");
    el.src = src;
    el.async = true;
    const timer = setTimeout(() => reject(new Error(`timeout loading ${src}`)), timeoutMs);
    el.onload = () => {
      clearTimeout(timer);
      resolve();
    };
    el.onerror = () => {
      clearTimeout(timer);
      reject(new Error(`failed to load ${src}`));
    };
    document.head.appendChild(el);
  });
  loaded.set(src, p);
  return p;
}

/** Reads a build-time value such as VITE_GD_GAME_ID. */
export function env(name: string): string {
  const all = (import.meta as unknown as { env?: Record<string, string> }).env ?? {};
  return all[name] ?? "";
}
