// Translations. Each game registers a dictionary per language; t() falls back to English.

type Dict = Record<string, string>;

const dicts: Record<string, Dict> = {};
let lang = "en";

export function registerStrings(language: string, strings: Dict): void {
  dicts[language] = { ...(dicts[language] ?? {}), ...strings };
}

/**
 * Picks the best language from the platform's hint, then the browser. Pass useBrowser = false
 * on hosts that forbid reading navigator.language (YouTube Playables).
 */
export function detectLanguage(preferred?: string, useBrowser = true): string {
  const browser = useBrowser && typeof navigator !== "undefined" ? navigator.languages ?? [navigator.language] : [];
  const candidates = [preferred, ...browser];
  for (const c of candidates) {
    if (!c) continue;
    const short = c.toLowerCase().split("-")[0];
    if (dicts[short]) return short;
  }
  return "en";
}

export function setLanguage(language: string): void {
  lang = dicts[language] ? language : "en";
}

export function getLanguage(): string {
  return lang;
}

/** t("level", { n: 4 }) with "Level {n}" -> "Level 4". */
export function t(key: string, vars?: Record<string, string | number>): string {
  const raw = dicts[lang]?.[key] ?? dicts.en?.[key] ?? key;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}
