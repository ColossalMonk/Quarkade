// Coach: the shared onboarding layer for every Quarkade game.
//
// - Tips wait in a queue and show one at a time on a small card (never over the title screen or a
//   modal, never overwriting each other). Tap a card to dismiss it early.
// - Power-up unlocks get a card: icon, name, what it does, free uses; then its button pulses.
// - A pointing hand can follow a screen point (the first move, a new twist).
// - "How to play" is a modal the games fill from text they already have (tips and power-ups).
//
// Text is translated here for the 10 Quarkade languages; a game may override any key.

import { registerStrings, t } from "../core/i18n.ts";
import type { Ui } from "./ui.ts";

const STRINGS: Record<string, Record<string, string>> = {
  en: { gotIt: "Got it", newPowerUp: "New power-up!", freeUses: "You get {n} free to start.", howToPlay: "How to play", htpBasics: "The basics", htpPowerUps: "Power-ups", htpTwists: "Twists", htpMore: "More power-ups and twists unlock as you play." },
  es: { gotIt: "Entendido", newPowerUp: "¡Nuevo potenciador!", freeUses: "Empiezas con {n} gratis.", howToPlay: "Cómo jugar", htpBasics: "Lo básico", htpPowerUps: "Potenciadores", htpTwists: "Novedades", htpMore: "Desbloquearás más potenciadores y novedades jugando." },
  pt: { gotIt: "Entendi", newPowerUp: "Novo power-up!", freeUses: "Você começa com {n} grátis.", howToPlay: "Como jogar", htpBasics: "O básico", htpPowerUps: "Power-ups", htpTwists: "Novidades", htpMore: "Mais power-ups e novidades são liberados conforme você joga." },
  fr: { gotIt: "Compris", newPowerUp: "Nouveau bonus !", freeUses: "Tu en as {n} gratuits pour commencer.", howToPlay: "Comment jouer", htpBasics: "Les bases", htpPowerUps: "Bonus", htpTwists: "Nouveautés", htpMore: "D'autres bonus et nouveautés se débloquent en jouant." },
  de: { gotIt: "Verstanden", newPowerUp: "Neues Power-up!", freeUses: "Du bekommst {n} gratis zum Start.", howToPlay: "So wird gespielt", htpBasics: "Die Grundlagen", htpPowerUps: "Power-ups", htpTwists: "Neuheiten", htpMore: "Weitere Power-ups und Neuheiten schaltest du beim Spielen frei." },
  it: { gotIt: "Capito", newPowerUp: "Nuovo potenziamento!", freeUses: "Ne hai {n} gratis per iniziare.", howToPlay: "Come si gioca", htpBasics: "Le basi", htpPowerUps: "Potenziamenti", htpTwists: "Novità", htpMore: "Altri potenziamenti e novità si sbloccano giocando." },
  ru: { gotIt: "Понятно", newPowerUp: "Новый бонус!", freeUses: "Для начала у тебя {n} бесплатно.", howToPlay: "Как играть", htpBasics: "Основы", htpPowerUps: "Бонусы", htpTwists: "Новинки", htpMore: "Новые бонусы и новинки открываются по ходу игры." },
  tr: { gotIt: "Anladım", newPowerUp: "Yeni güçlendirici!", freeUses: "Başlangıç için {n} tane bedava.", howToPlay: "Nasıl oynanır", htpBasics: "Temel kurallar", htpPowerUps: "Güçlendiriciler", htpTwists: "Yenilikler", htpMore: "Oynadıkça yeni güçlendiriciler ve yenilikler açılır." },
  id: { gotIt: "Mengerti", newPowerUp: "Power-up baru!", freeUses: "Kamu dapat {n} gratis untuk mulai.", howToPlay: "Cara bermain", htpBasics: "Dasar-dasar", htpPowerUps: "Power-up", htpTwists: "Hal baru", htpMore: "Power-up dan hal baru lainnya terbuka seiring kamu bermain." },
  ja: { gotIt: "OK", newPowerUp: "新しいパワーアップ！", freeUses: "最初に{n}回分を無料でもらえます。", howToPlay: "遊び方", htpBasics: "基本", htpPowerUps: "パワーアップ", htpTwists: "新しい仕掛け", htpMore: "プレイを進めるとパワーアップや仕掛けが増えていきます。" },
};
for (const [lang, dict] of Object.entries(STRINGS)) registerStrings(lang, dict);

/** The translated text, for tests and for games that want to check coverage. */
export const COACH_STRINGS = STRINGS;

export type Point = { x: number; y: number };

interface TipItem {
  kind: "tip";
  text: string;
  icon: string;
  ms: number;
  point?: () => Point | null;
}
interface UnlockItem {
  kind: "unlock";
  icon: string;
  name: string;
  desc: string;
  free: number;
  button?: HTMLElement | null;
}
type Item = TipItem | UnlockItem;

export interface CoachOptions {
  /** Where the tip card lives (the game's #app). */
  root: HTMLElement;
  /** Extra "not now" check: title screen up, an animation running... */
  blocked?: () => boolean;
  /** Called when a card appears (a sound, for example). */
  onShow?: () => void;
}

export class Coach {
  private readonly ui: Ui;
  private readonly opts: CoachOptions;
  private queue: Item[] = [];
  private card: HTMLDivElement;
  private hand: HTMLDivElement;
  private showing: TipItem | null = null;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;
  private pointFn: (() => Point | null) | null = null;
  private unlockOpen = false;

  constructor(ui: Ui, opts: CoachOptions) {
    this.ui = ui;
    this.opts = opts;
    this.card = document.createElement("div");
    this.card.className = "coach-card";
    this.card.setAttribute("role", "status");
    this.card.addEventListener("click", () => this.dismiss());
    opts.root.append(this.card);
    this.hand = document.createElement("div");
    this.hand.className = "coach-hand";
    this.hand.textContent = "👆";
    this.hand.hidden = true;
    // On the page itself (not inside fx-layer's stacking) so it sits above the tip card.
    document.body.append(this.hand);
    setInterval(() => this.tick(), 120);
  }

  private get blocked(): boolean {
    return this.ui.modalOpen || this.unlockOpen || (this.opts.blocked?.() ?? false);
  }

  /** Queue a tip. `point` (optional) shows the hand on that spot while the tip is up. */
  tip(text: string, opts: { icon?: string; ms?: number; point?: () => Point | null } = {}): void {
    if (!text || this.queue.some((q) => q.kind === "tip" && q.text === text) || this.showing?.text === text) return;
    this.queue.push({ kind: "tip", text, icon: opts.icon ?? "💡", ms: opts.ms ?? Math.min(9000, 4200 + text.length * 45), point: opts.point });
  }

  /** Queue a power-up unlock card; `button` pulses after it is closed. */
  unlock(icon: string, name: string, desc: string, free: number, button?: HTMLElement | null): void {
    this.queue.push({ kind: "unlock", icon, name, desc, free, button });
  }

  /** Drop queued tips and the hand (a new level is starting). Unlock cards stay queued. */
  clear(): void {
    this.queue = this.queue.filter((q) => q.kind === "unlock");
    this.dismiss();
    this.stopPointing();
  }

  /** Point the hand at a spot until stopPointing() (or the next pointAt). */
  pointAt(fn: () => Point | null): void {
    this.pointFn = fn;
  }

  stopPointing(): void {
    this.pointFn = null;
    this.hand.hidden = true;
  }

  /** Hide the current tip now. */
  dismiss(): void {
    if (this.hideTimer) clearTimeout(this.hideTimer);
    this.hideTimer = null;
    if (this.showing?.point && this.pointFn === this.showing.point) this.stopPointing();
    this.showing = null;
    this.card.classList.remove("show");
    this.opts.root.classList.remove("coach-on");
  }

  private tick(): void {
    // The hand follows its target, and hides while something covers the board.
    const p = this.pointFn && !this.blocked ? this.pointFn() : null;
    if (p) {
      this.hand.hidden = false;
      this.hand.style.left = `${p.x}px`;
      this.hand.style.top = `${p.y}px`;
    } else this.hand.hidden = true;
    // Keep the card off whatever the hand points at: move it to the low spot when they overlap.
    if (this.showing && p) {
      const r = this.card.getBoundingClientRect();
      const over = p.y > r.top - 30 && p.y < r.bottom + 50;
      if (over && !this.card.classList.contains("low")) this.card.classList.add("low");
    }
    if (this.showing || this.blocked || !this.queue.length) return;
    const item = this.queue.shift()!;
    if (item.kind === "unlock") void this.showUnlock(item);
    else this.showTip(item);
  }

  private showTip(item: TipItem): void {
    this.showing = item;
    this.card.innerHTML = "";
    const ic = document.createElement("span");
    ic.className = "coach-icon";
    ic.textContent = item.icon;
    const tx = document.createElement("span");
    tx.className = "coach-text";
    tx.textContent = item.text;
    const ok = document.createElement("span");
    ok.className = "coach-ok";
    ok.textContent = "✓";
    this.card.append(ic, tx, ok);
    this.card.classList.remove("low");
    this.card.classList.add("show");
    this.opts.root.classList.add("coach-on");
    if (item.point) this.pointAt(item.point);
    this.opts.onShow?.();
    this.hideTimer = setTimeout(() => this.dismiss(), item.ms);
  }

  private async showUnlock(item: UnlockItem): Promise<void> {
    this.unlockOpen = true;
    this.opts.onShow?.();
    await this.ui.openModal((box, close) => {
      box.classList.add("coach-unlock");
      box.innerHTML = `<div class="coach-badge">${t("newPowerUp")}</div><div class="big-icon">${item.icon}</div><h2></h2>`;
      box.querySelector("h2")!.textContent = item.name;
      const p = document.createElement("p");
      p.textContent = item.desc;
      const f = document.createElement("p");
      f.className = "coach-free";
      f.textContent = t("freeUses", { n: item.free });
      box.append(p, f, this.ui.button(t("gotIt"), "", close));
    });
    this.unlockOpen = false;
    if (item.button) {
      item.button.classList.add("coach-pulse");
      setTimeout(() => item.button?.classList.remove("coach-pulse"), 4200);
    }
  }
}

// ---------------------------------------------------------------- How to play

export interface HowToItem {
  icon: string;
  title?: string;
  text: string;
}

export interface HowToSection {
  title: string;
  items: HowToItem[];
}

/** The "How to play" page: the basics, unlocked power-ups and the twists met so far. */
export function showHowToPlay(ui: Ui, sections: HowToSection[], footnote = t("htpMore")): Promise<void> {
  return ui.openModal(
    (box, close) => {
      box.classList.add("htp");
      const h = document.createElement("h2");
      h.textContent = t("howToPlay");
      box.append(h);
      for (const s of sections) {
        if (!s.items.length) continue;
        const head = document.createElement("h3");
        head.textContent = s.title;
        box.append(head);
        const list = document.createElement("div");
        list.className = "htp-list";
        for (const it of s.items) {
          const row = document.createElement("div");
          row.className = "htp-row";
          const ic = document.createElement("span");
          ic.className = "htp-icon";
          ic.textContent = it.icon;
          const body = document.createElement("div");
          if (it.title) {
            const b = document.createElement("b");
            b.textContent = it.title;
            body.append(b);
          }
          const p = document.createElement("span");
          p.textContent = it.text;
          body.append(p);
          row.append(ic, body);
          list.append(row);
        }
        box.append(list);
      }
      if (footnote) {
        const f = document.createElement("p");
        f.className = "htp-foot";
        f.textContent = footnote;
        box.append(f);
      }
      box.append(ui.button(t("close"), "plain", close));
    },
    { dismissable: true },
  );
}

/**
 * Tips from a game's strings, grouped for "How to play": `tip_N` keys up to the player's level.
 * Levels at or below `basicsUpTo` are basics; later ones are twists (power-up tips are left out:
 * the power-up section explains those).
 */
export function tipsUpTo(en: Record<string, string>, level: number, basicsUpTo: number, skip: number[] = []): { basics: string[]; twists: string[] } {
  const keys = Object.keys(en)
    .filter((k) => /^tip_\d+$/.test(k))
    .map((k) => Number(k.slice(4)))
    .filter((n) => n <= level && !skip.includes(n))
    .sort((a, b) => a - b);
  return {
    basics: keys.filter((n) => n <= basicsUpTo).map((n) => t(`tip_${n}`)),
    twists: keys.filter((n) => n > basicsUpTo).map((n) => t(`tip_${n}`)),
  };
}
