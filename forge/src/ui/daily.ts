// The daily puzzle shared by every game: results by UTC day, streaks, a calendar, the daily card.
// i18n keys: daily, dailyDone, dailyIntro, locked_at, dailyResult, dailyStreak, dailyBestStreak,
// dailyPlay, share, copied, dailyRetry, dailyBack, close.

import type { Ui } from "./ui.ts";
import { para, starsRow } from "./ui.ts";
import { t } from "../core/i18n.ts";
import { utcDayKey } from "../core/rng.ts";

export interface DailyResult {
  moves: number;
  par: number;
  stars: number;
}

export interface DailyState {
  results: Record<string, DailyResult>;
  lastWin: string;
  streak: number;
  bestStreak: number;
  retryDay: string;
}

export function emptyDailyState(): DailyState {
  return { results: {}, lastWin: "", streak: 0, bestStreak: 0, retryDay: "" };
}

export function yesterdayKey(dayKey: string): string {
  const dt = new Date(dayKey + "T00:00:00Z");
  dt.setUTCDate(dt.getUTCDate() - 1);
  return utcDayKey(dt);
}

/** The streak as of `day` (0 if it was broken). */
export function currentStreak(s: DailyState, day: string): number {
  return s.lastWin === day || s.lastWin === yesterdayKey(day) ? s.streak : 0;
}

/** Record a win; keeps the best result of the day. Returns whether it was the first win today. */
export function recordDailyWin(s: DailyState, day: string, r: DailyResult): boolean {
  const prev = s.results[day];
  if (!prev || r.moves < prev.moves) s.results[day] = { ...r, stars: Math.max(r.stars, prev?.stars ?? 0) };
  if (prev) return false;
  s.streak = s.lastWin === yesterdayKey(day) ? s.streak + 1 : 1;
  s.lastWin = day;
  s.bestStreak = Math.max(s.bestStreak, s.streak);
  return true;
}

export type PatchDrawer = (g: CanvasRenderingContext2D, x: number, y: number, size: number, colour: string) => void;

/** This month's calendar: one patch (drawn by the game) for every day the daily was finished. */
export function drawCalendar(canvas: HTMLCanvasElement, s: DailyState, colourOfDay: (day: string) => string, patch: PatchDrawer, accent = "#e2725b"): void {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.round(canvas.getBoundingClientRect().width * dpr) || 280;
  const h = Math.round((w * 6) / 7);
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext("2d")!;
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const first = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cell = w / 7;
  const today = utcDayKey();
  g.fillStyle = "#fbf4e6";
  g.beginPath();
  g.roundRect(0, 0, w, h, w * 0.04);
  g.fill();
  for (let dnum = 1; dnum <= days; dnum++) {
    const idx = first + dnum - 1;
    const x = (idx % 7) * cell;
    const y = Math.floor(idx / 7) * cell;
    const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(dnum).padStart(2, "0")}`;
    const done = !!s.results[key];
    if (done) patch(g, x + 2, y + 2, cell - 4, colourOfDay(key));
    else {
      g.fillStyle = "rgba(120,90,60,0.08)";
      g.fillRect(x + 3, y + 3, cell - 6, cell - 6);
    }
    g.fillStyle = done ? "rgba(255,255,255,0.9)" : "rgba(90,61,41,0.45)";
    g.font = `800 ${Math.round(cell * 0.32)}px "Baloo 2", sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(String(dnum), x + cell / 2, y + cell / 2 + 1);
    if (key === today) {
      g.strokeStyle = accent;
      g.lineWidth = Math.max(2, cell * 0.06);
      g.strokeRect(x + 2, y + 2, cell - 4, cell - 4);
    }
  }
}

export function dailyShareText(game: string, emoji: string, day: string, r: DailyResult, streak: number): string {
  return `${game} ${t("daily")} ${day}\n${"★".repeat(r.stars)}${"☆".repeat(3 - r.stars)} ${r.moves}/${r.par} ${emoji}\n🔥 ${streak}`;
}

export interface DailyCardOptions {
  icon: string;
  state: DailyState;
  /** Player level, and the level after which the daily opens. */
  level: number;
  unlockAfter: number;
  /** True while playing the daily, or right after winning it (shows "Back to levels"). */
  inDaily: boolean;
  justWon?: boolean;
  rewardedAvailable: boolean;
  shareText: (day: string, r: DailyResult) => string;
  colourOfDay: (day: string) => string;
  patch: PatchDrawer;
  watchAd: () => Promise<boolean>;
  onRetryUsed: () => void;
}

/** Shows the daily card. Resolves with what the player chose next. */
export async function showDailyCard(ui: Ui, o: DailyCardOptions): Promise<"play" | "back" | null> {
  const day = utcDayKey();
  const s = o.state;
  let next: "play" | "back" | null = null;
  await ui.openModal(
    (box, close) => {
      const r = s.results[day];
      box.innerHTML = `<div class="big-icon">${o.icon}</div><h2>${r ? t("dailyDone") : t("daily")}</h2>`;
      if (o.level <= o.unlockAfter) {
        box.append(para(`${t("dailyIntro")} ${t("locked_at", { n: o.unlockAfter })}`), ui.button(t("close"), "plain", close));
        return;
      }
      if (r) {
        box.append(starsRow(r.stars, 0.1), para(t("dailyResult", { m: r.moves, p: r.par })));
      } else box.append(para(t("dailyIntro")));
      const streak = document.createElement("div");
      streak.className = "streak";
      streak.textContent = t("dailyStreak", { n: currentStreak(s, day) });
      box.append(streak, para(t("dailyBestStreak", { n: s.bestStreak })));
      const cal = document.createElement("canvas");
      cal.className = "calendar";
      box.append(cal);
      requestAnimationFrame(() => drawCalendar(cal, s, o.colourOfDay, o.patch));
      if (!r) {
        box.append(ui.button(t("dailyPlay"), "", () => ((next = "play"), close())));
      } else {
        box.append(
          ui.button(`${t("share")} 📋`, "green", async () => {
            const text = o.shareText(day, r);
            try {
              await navigator.clipboard.writeText(text);
              ui.toast(t("copied"));
            } catch {
              ui.toast(text, 5000);
            }
          }),
        );
        if (s.retryDay !== day && o.rewardedAvailable) {
          box.append(
            ui.button(`🎬 ${t("dailyRetry")}`, "ad", async () => {
              if (await o.watchAd()) {
                s.retryDay = day;
                o.onRetryUsed();
                next = "play";
                close();
              }
            }),
          );
        }
      }
      if (o.inDaily || o.justWon) box.append(ui.button(t("dailyBack"), "plain", () => ((next = "back"), close())));
      else box.append(ui.button(t("close"), "plain", close));
    },
    { dismissable: !o.justWon },
  );
  return next;
}
