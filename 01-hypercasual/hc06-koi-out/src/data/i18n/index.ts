// All translations. English lives in ../strings.ts; t() falls back to English for any gap.

import { registerStrings } from "../../../../../forge/src/core/i18n.ts";
import { ES } from "./es.ts";
import { PT } from "./pt.ts";
import { FR } from "./fr.ts";
import { DE } from "./de.ts";
import { RU } from "./ru.ts";
import { TR } from "./tr.ts";
import { IT } from "./it.ts";
import { ID } from "./id.ts";
import { JA } from "./ja.ts";

/** [code, name in its own language] for the settings picker. */
export const LANGUAGES: Array<[string, string]> = [
  ["en", "English"],
  ["es", "Español"],
  ["pt", "Português"],
  ["fr", "Français"],
  ["de", "Deutsch"],
  ["it", "Italiano"],
  ["ru", "Русский"],
  ["tr", "Türkçe"],
  ["id", "Bahasa Indonesia"],
  ["ja", "日本語"],
];

export function registerTranslations(): void {
  registerStrings("es", ES);
  registerStrings("pt", PT);
  registerStrings("fr", FR);
  registerStrings("de", DE);
  registerStrings("ru", RU);
  registerStrings("tr", TR);
  registerStrings("it", IT);
  registerStrings("id", ID);
  registerStrings("ja", JA);
}
