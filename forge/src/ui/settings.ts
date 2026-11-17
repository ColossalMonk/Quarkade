// The settings modal shared by every game: on/off rows, a language picker and extra buttons.
// i18n keys: settings, on, off, language, close.

import type { Ui } from "./ui.ts";
import { t, getLanguage } from "../core/i18n.ts";

export interface SettingRow {
  label: string;
  get: () => boolean;
  set: (on: boolean) => void;
}

export interface SettingsOptions {
  rows: SettingRow[];
  languages: Array<[string, string]>;
  onLanguage: (code: string) => void;
  /** Buttons added under the rows (shop, reset...). They get the close function. */
  extra?: (close: () => void) => HTMLElement[];
  onChange?: () => void;
}

export function showSettings(ui: Ui, o: SettingsOptions): Promise<void> {
  return ui.openModal(
    (box, close) => {
      box.innerHTML = `<h2>${t("settings")}</h2>`;
      for (const row of o.rows) {
        const r = document.createElement("div");
        r.className = "setting";
        r.innerHTML = `<span>${row.label}</span>`;
        const b = document.createElement("button");
        const paint = () => {
          b.textContent = row.get() ? t("on") : t("off");
          b.classList.toggle("off", !row.get());
        };
        b.addEventListener("click", () => {
          row.set(!row.get());
          paint();
          o.onChange?.();
        });
        paint();
        r.append(b);
        box.append(r);
      }
      const lr = document.createElement("div");
      lr.className = "setting";
      lr.innerHTML = `<span>${t("language")}</span>`;
      const sel = document.createElement("select");
      for (const [code, name] of o.languages) {
        const opt = document.createElement("option");
        opt.value = code;
        opt.textContent = name;
        sel.append(opt);
      }
      sel.value = getLanguage();
      sel.addEventListener("change", () => {
        close();
        o.onLanguage(sel.value);
      });
      lr.append(sel);
      box.append(lr);
      for (const el of o.extra?.(close) ?? []) box.append(el);
      box.append(ui.button(t("close"), "", close));
    },
    { dismissable: true },
  );
}
