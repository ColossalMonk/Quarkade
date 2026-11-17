// Knotwork: game controller. Wires rules + view + UI + platform (ads, saves) together.

import "./style.css";
import { Platform } from "../../../forge/src/platform/platform.ts";
import { SaveSlot } from "../../../forge/src/core/save.ts";
import { Loop } from "../../../forge/src/core/loop.ts";
import { haptic, setHapticsEnabled } from "../../../forge/src/core/haptics.ts";
import { registerStrings, detectLanguage, setLanguage, getLanguage, t } from "../../../forge/src/core/i18n.ts";
import { LANGUAGES, registerTranslations } from "./data/i18n/index.ts";
import { utcDayKey } from "../../../forge/src/core/rng.ts";
import type { Board, LevelDef, Move } from "./logic/rules.ts";
import {
  decodeLevel,
  cloneBoard,
  applyMove,
  moveAmount,
  topRun,
  isWon,
  isStuck,
  addSpareNeedle,
  revealAll,
  snip,
  yarnSwift,
  BASKET_SIZE,
  completeColour,
  coloursOf,
  swiftPicks,
} from "./logic/rules.ts";
import { getLevel, getDaily, solveInWorker } from "./game/levels.ts";
import { Rng, seedOf } from "../../../forge/src/core/rng.ts";
import { QuiltProgress, albumOpen, completedAlbums, nextPicture } from "./game/quilt.ts";
import { COSMETICS, DEFAULT_EQUIPPED, ALBUM_STARS, SHOP_LEVEL, albumReward, cosmetic } from "./data/cosmetics.ts";
import type { CosmeticSlot } from "./data/cosmetics.ts";
import { Music } from "../../../forge/src/core/music.ts";
import { Ui } from "../../../forge/src/ui/ui.ts";
import { AdBudget } from "../../../forge/src/ui/ads.ts";
import { buyCard } from "../../../forge/src/ui/buy-card.ts";
import { showDailyCard as forgeDailyCard, recordDailyWin, currentStreak, dailyShareText } from "../../../forge/src/ui/daily.ts";
import { showShop as forgeShowShop } from "../../../forge/src/ui/shop.ts";
import { showSettings as forgeShowSettings } from "../../../forge/src/ui/settings.ts";
import { defaultSave, SAVE_VERSION } from "./game/save.ts";
import type { SaveData } from "./game/save.ts";
import { POWER_UPS, ECONOMY, levelCoins, starsFor } from "./data/economy.ts";
import type { PowerUpId } from "./data/economy.ts";
import { YARNS } from "./data/palette.ts";
import { ALL_PICTURES, ALBUMS } from "./data/quilts.ts";
import { EN } from "./data/strings.ts";
import { BoardView } from "./view/board3d.ts";
import { drawQuilt, cellClientPos, drawPatch } from "./view/quilt-draw.ts";
import { Sfx } from "./view/sfx.ts";

type ItemId = PowerUpId | "undo" | "hint";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

// ---------------------------------------------------------------- state

const platform = new Platform();
const sfx = new Sfx();
const music = new Music(sfx.synth);
/** Shapes shown on basket yarn in colour-blind mode, matching the knit shader's symbols. */
const SYMBOL_GLYPHS = ["●", "◯", "✚", "✖", "■", "◆", "☰", "┃", "▲", "⁚", "⌃", "□"];
let save!: SaveSlot<SaveData>;
let quilt!: QuiltProgress;
let view!: BoardView;

let def!: LevelDef;
let board!: Board;
let yarnMap: number[] = [];
let history: Array<{ board: Board; moves: number }> = [];
let moves = 0;
let selected = -1;
let selectedBasket = -1;
let mode: "play" | "snip" | "swift" = "play";
let busy = false;
let inModal = false;
let started = false;
/** Dev only: a level passed in from the editor with ?def=. */
let devDef: LevelDef | null = null;
/** "levels" = the main path; "daily" = today's Daily Swatch. */
let playMode: "levels" | "daily" = "levels";
const DAILY_POWER_UPS: PowerUpId[] = ["spare", "lantern"];
/** App build only (purchases, reminder); null on the web. */
let appExtras: typeof import("./game/app-extras.ts") | null = null;
/** The Daily Swatch opens once the player has finished this level. */
const DAILY_UNLOCK_LEVEL = 20;

interface LevelState {
  undosFree: number;
  undoCredits: number;
  capped: boolean;
  easier: boolean;
  freeHint: boolean;
  touched: boolean;
  finishing: boolean;
}
let lvl!: LevelState;
const restarts = new Map<number, number>();

// ---------------------------------------------------------------- helpers

const d = () => save.data;

function rollDay(): void {
  const key = utcDayKey();
  if (d().day.key !== key) {
    d().day = { key, rewarded: 0, byItem: {}, freeHintUsed: false };
    save.touch();
  }
}

function yarnOf(slot: number): number {
  return yarnMap[slot] ?? slot % YARNS.length;
}

// Shared UI shell from forge (toasts, modals, buttons, flying chips).
const ui = new Ui({ modalRoot: $("modal-root"), toast: $("toast"), fxLayer: $("fx-layer") });
ui.onModalChange = (open) => (inModal = open);
const toast = (msg: string, ms?: number) => ui.toast(msg, ms);
const floatText = (text: string, x: number, y: number) => ui.floatText(text, x, y);
const flyPatch = (hex: string, from: { x: number; y: number }, to: { x: number; y: number }, delay: number) => ui.flyChip(hex, from, to, delay);

function puInfo(id: PowerUpId) {
  return POWER_UPS.find((p) => p.id === id)!;
}

function isUnlocked(id: PowerUpId): boolean {
  if (playMode === "daily") {
    // Daily Swatch: only Spare Needle and Lantern, so scores stay fair.
    return DAILY_POWER_UPS.includes(id) && (d().level >= puInfo(id).unlockLevel || d().gifted[id]);
  }
  return def.n >= puInfo(id).unlockLevel || d().gifted[id];
}

// ---------------------------------------------------------------- HUD

function renderHud(): void {
  $("lvl-label").textContent = playMode === "daily" ? t("dailyShort") : t("level", { n: def.n });
  const tagEl = $("lvl-tag");
  tagEl.className = "";
  let tagText = "";
  if (playMode === "daily") {
    tagText = utcDayKey();
  } else if (def.tag === "moth") {
    tagText = `🦋 ${t("tag_moth")}`;
  } else if (lvl.finishing) {
    tagText = t("tag_finishing");
    tagEl.classList.add("finishing");
  } else if (def.tag === "tricky") tagText = t("tag_tricky");
  else if (def.tag === "masterpiece") tagText = t("tag_masterpiece");
  else if (def.tag === "breather") {
    tagText = t("tag_breather");
    tagEl.classList.add("breather");
  }
  tagEl.textContent = tagText;
  $("coin-count").textContent = String(d().coins);
  $("side-daily").textContent = `🧶 ${t("dailyShort")}`;
  $("side-shop").textContent = `🛍 ${t("shop")}`;
  $("moves").textContent = t("moves", { m: moves });
  $("par").textContent = t("par", { p: def.par });
  const stars = lvl.easier ? 1 : starsFor(Math.max(moves, 1), def.par, lvl.capped);
  [...$("live-stars").children].forEach((el, i) => el.classList.toggle("off", i >= stars));
  $("undo-count").textContent = String(lvl.undosFree + lvl.undoCredits || "+");
  const hintBtn = $("btn-hint");
  hintBtn.hidden = playMode === "daily" || def.n < 10;
  $("btn-daily").classList.toggle("done", !!d().swatch.results[utcDayKey()]);
  const freeHints = (lvl.freeHint ? 1 : 0) + (d().day.freeHintUsed ? 0 : 1);
  $("hint-count").textContent = freeHints ? String(freeHints) : "";
  renderPowerups();
  renderBasket();
}

function renderPowerups(): void {
  const wrap = $("powerups");
  if (!wrap.childElementCount) {
    for (const pu of POWER_UPS) {
      const b = document.createElement("button");
      b.className = "pu";
      b.dataset.id = pu.id;
      b.setAttribute("aria-label", t(`pu_${pu.id}`));
      b.innerHTML = `<span class="ic">${pu.icon}</span><b></b>`;
      b.addEventListener("click", () => void onPowerUp(pu.id));
      wrap.append(b);
    }
  }
  for (const b of [...wrap.children] as HTMLButtonElement[]) {
    const id = b.dataset.id as PowerUpId;
    const unlocked = isUnlocked(id);
    const count = d().inv[id];
    const badge = b.querySelector("b")!;
    b.classList.toggle("locked", !unlocked);
    b.classList.toggle("active", (mode === "snip" && id === "snip") || (mode === "swift" && id === "swift"));
    badge.className = "";
    if (!unlocked) badge.textContent = "🔒";
    else if (count > 0) badge.textContent = String(count);
    else {
      badge.textContent = "+";
      badge.className = "plus";
    }
  }
}

function renderBasket(): void {
  const el = $("basket");
  const show = board.basket.length > 0 || mode === "snip";
  el.hidden = !show;
  if (!show) return;
  el.innerHTML = `<span>${t("basket")}</span>`;
  for (let i = 0; i < BASKET_SIZE; i++) {
    if (i < board.basket.length) {
      const b = document.createElement("button");
      b.className = "yarn" + (selectedBasket === i ? " sel" : "");
      // Twisted loops show both colours; colour-blind mode adds each colour's symbol.
      const cs = coloursOf(board.basket[i]).map((c) => YARNS[yarnOf(c)]);
      b.style.background = cs.length > 1 ? `repeating-linear-gradient(45deg,${cs[0].hex} 0 6px,${cs[1].hex} 6px 12px)` : cs[0].hex;
      if (d().settings.colorblind) b.textContent = cs.map((y) => SYMBOL_GLYPHS[y.symbol]).join("");
      b.addEventListener("click", () => {
        if (busy) return;
        selectedBasket = selectedBasket === i ? -1 : i;
        if (selected >= 0) {
          view.clearLift();
          selected = -1;
        }
        sfx.lift();
        renderBasket();
      });
      el.append(b);
    } else {
      const e = document.createElement("span");
      e.className = "empty";
      el.append(e);
    }
  }
}

function redrawMiniQuilt(highlight: number[] = []): void {
  drawQuilt($<HTMLCanvasElement>("mini-quilt"), quilt, highlight);
  // Wide-screen side panel.
  if (document.body.classList.contains("wide")) {
    drawQuilt($<HTMLCanvasElement>("side-quilt"), quilt, highlight);
    const album = ALBUMS[quilt.albumIndex];
    $("side-title").textContent = quilt.picture.name;
    $("side-sub").textContent = `${t(`album_${album.id}`)}${quilt.encore ? ` · ${t("encore")}` : ""} · ${t("quiltProgress", { done: quilt.filledCount })}`;
    $("side-stars").textContent = t("totalStars", { n: d().totalStars });
  }
}

/** Browsers only allow audio after a tap or key press. */
function unlockAudio(): void {
  sfx.synth.unlock();
  if (d().settings.music) music.start();
}

// ---------------------------------------------------------------- modals

function openModal(build: (box: HTMLElement, close: () => void) => void, opts: { dismissable?: boolean } = {}): Promise<void> {
  return ui.openModal(build, opts);
}

function button(label: string, cls: string, onClick: () => void, disabled = false): HTMLButtonElement {
  return ui.button(label, cls, onClick, disabled);
}

// ---------------------------------------------------------------- ads + buying

/** Rewarded-ad caps (DESIGN.md §3), shared logic from forge. */
const ads = new AdBudget({
  perLevel: ECONOMY.rewardedPerLevel,
  perDay: ECONOMY.rewardedPerDay,
  item: (id) => {
    if (id === "undo") return { perLevel: ECONOMY.undoPack.adsPerLevel };
    if (id === "hint") return { perLevel: ECONOMY.hint.adsPerLevel };
    const pu = POWER_UPS.find((p) => p.id === id);
    return pu ? { perLevel: pu.adsPerLevel, perDay: pu.adsPerDay } : undefined;
  },
});

function canWatchAd(item: ItemId | "rescue"): boolean {
  return ads.can(item, d().day, platform.rewardedAvailable);
}

async function watchAd(item: ItemId | "double" | "rescue"): Promise<boolean> {
  sfx.synth.setHostSuspended(true);
  const ok = await platform.rewarded();
  sfx.synth.setHostSuspended(false);
  if (ok) {
    ads.record(item, d().day);
    save.touch();
  } else {
    toast(t("adUnavailable"));
  }
  return ok;
}

function priceOf(item: ItemId): number {
  if (item === "undo") return ECONOMY.undoPack.price;
  if (item === "hint") return ECONOMY.hint.price;
  return puInfo(item).price;
}

function iconOf(item: ItemId): string {
  if (item === "undo") return "↶";
  if (item === "hint") return "💡";
  return puInfo(item).icon;
}

/** Buy card: watch an ad or pay coins. Resolves true when the item was granted. */
async function acquire(item: ItemId): Promise<boolean> {
  const adOk = canWatchAd(item);
  const granted = await buyCard(ui, {
    icon: iconOf(item),
    title: t("buyTitle", { name: t(`pu_${item}`) }),
    desc: t(`pu_${item}_desc`),
    price: priceOf(item),
    coins: () => d().coins,
    spend: (n) => (d().coins -= n),
    canWatchAd: adOk,
    limitReached: !adOk && platform.rewardedAvailable && ads.levelCapReached,
    watchAd: () => watchAd(item),
    grant: () => {
      if (item === "undo") lvl.undoCredits += ECONOMY.undoPack.amount;
      else if (item !== "hint") d().inv[item] += 1; // a hint is used straight away by the caller
      save.touch();
    },
    onCoinSound: () => sfx.coin(),
  });
  renderHud();
  return granted;
}

// ---------------------------------------------------------------- level flow

async function startLevel(n: number, opts: { easier?: boolean; override?: LevelDef } = {}): Promise<void> {
  busy = true;
  rollDay();
  playMode = "levels";
  def = opts.override ? { ...opts.override, n } : await getLevel(n);
  board = decodeLevel(def);
  platform.levelStart();
  history = [];
  moves = 0;
  selected = -1;
  selectedBasket = -1;
  mode = "play";
  yarnMap = quilt.mapColours(board.k, n);
  ads.newLevel();
  lvl = {
    undosFree: ECONOMY.freeUndosPerLevel,
    undoCredits: 0,
    capped: false,
    easier: !!opts.easier,
    // A free hint after 2 restarts, or after 1 for players who are usually well over par.
    freeHint: (restarts.get(n) ?? 0) >= (isStruggling() ? 1 : 2),
    touched: false,
    finishing: quilt.canFinishWith(yarnMap),
  };
  if (lvl.easier) addSpareNeedle(board);
  view.build(board, yarnOf);
  view.setHint(null);
  busy = false;

  // Power-up gifts when they unlock.
  for (const pu of POWER_UPS) {
    if (n >= pu.unlockLevel && !d().gifted[pu.id]) {
      d().gifted[pu.id] = true;
      d().inv[pu.id] += ECONOMY.freeOnUnlock;
      save.touch();
      setTimeout(() => toast(t("unlocked", { name: t(`pu_${pu.id}`), n: ECONOMY.freeOnUnlock }), 4200), 300);
    }
  }
  const tip = EN[`tip_${n}`] ? t(`tip_${n}`) : "";
  if (tip && (restarts.get(n) ?? 0) === 0) setTimeout(() => toast(tip, 5200), 700);
  if (lvl.freeHint && (restarts.get(n) ?? 0) === (isStruggling() ? 1 : 2)) setTimeout(() => toast(t("freeHint")), 900);
  renderHud();
  redrawMiniQuilt();
  // Offer the boost between levels only, never while the game is still loading (title screen).
  if (started && (def.tag === "tricky" || def.tag === "masterpiece") && !lvl.easier && (restarts.get(n) ?? 0) === 0) await offerBoost();
}

/** Before Tricky and Masterpiece levels: watch an ad to start with a Spare Needle in place. */
async function offerBoost(): Promise<void> {
  if (!isUnlocked("spare") || !canWatchAd("spare")) return;
  let boost = false;
  await openModal((box, close) => {
    box.innerHTML = `<div class="big-icon">🪡</div><h2>${t("boostTitle")}</h2><p>${t("boostBody")}</p>`;
    box.append(
      button(`🎬 ${t("boostYes")}`, "ad", async () => {
        if (await watchAd("spare")) {
          boost = true;
          close();
        }
      }),
    );
    box.append(button(t("boostNo"), "plain", close));
  });
  if (boost) {
    addSpareNeedle(board);
    view.addNeedle(4);
    sfx.power();
    renderHud();
  }
}

function snapshot(): void {
  history.push({ board: cloneBoard(board), moves });
}

function canLift(i: number): boolean {
  return !board.locked[i] && board.stacks[i].length > 0 && topRun(board, i) > 0;
}

function markTouched(): void {
  if (!lvl.touched) {
    lvl.touched = true;
    platform.gameplayStart();
  }
}

async function onNeedleTap(i: number): Promise<void> {
  if (busy || inModal) return;
  markTouched();
  view.setHint(null);

  if (mode === "snip" || mode === "swift") return; // loop taps handled separately

  if (selectedBasket >= 0) {
    const m: Move = { kind: "basket", index: selectedBasket, to: i };
    if (moveAmount(board, m)) {
      selectedBasket = -1;
      await doMove(m);
    } else {
      sfx.bonk();
      haptic("error");
    }
    return;
  }

  if (selected < 0) {
    if (canLift(i)) {
      selected = i;
      view.setLift(i, topRun(board, i));
      sfx.lift();
      haptic("tick");
    } else if (board.stacks[i].length) {
      sfx.bonk();
      haptic("error");
    }
    return;
  }
  if (selected === i) {
    view.clearLift();
    selected = -1;
    sfx.drop(0);
    return;
  }
  const m: Move = { kind: "move", from: selected, to: i };
  if (moveAmount(board, m)) {
    selected = -1;
    await doMove(m);
  } else if (canLift(i)) {
    // Tapping another needle that can't receive: switch the selection to it.
    view.clearLift();
    selected = i;
    view.setLift(i, topRun(board, i));
    sfx.lift();
    haptic("tick");
  } else {
    view.clearLift();
    selected = -1;
    sfx.bonk();
    haptic("error");
  }
}

async function doMove(m: Move): Promise<void> {
  busy = true;
  snapshot();
  const amount = moveAmount(board, m);
  const res = applyMove(board, m);
  moves++;
  let anim: Promise<void>;
  if (m.kind === "move") anim = view.animateMove(m.from, m.to, amount);
  else anim = view.animateFromBasket(m.index, m.to);
  view.syncColours(board);
  view.setMoth(board.moth);
  sfx.drop(amount);
  haptic("medium");
  renderHud();
  await anim;
  for (const needle of res.completed) await onNeedleComplete(needle);
  busy = false;
  if (res.mothChewed && !isWon(board)) return void showMothChewed();
  await checkEnd();
}

async function onNeedleComplete(needle: number): Promise<void> {
  const slot = completeColour(board.stacks[needle], board.L);
  const yarn = yarnOf(slot);
  sfx.knit();
  haptic("success");
  const celebrate = view.celebrate(needle);
  if (playMode === "daily") {
    // The Daily Swatch doesn't knit into the quilt.
    await celebrate;
    renderHud();
    return;
  }
  const cells = quilt.knit(yarn, yarnMap);
  const from = view.needleTopClient(needle);
  const mini = $<HTMLCanvasElement>("mini-quilt");
  if (cells.length) {
    await Promise.all(cells.map((c, k) => flyPatch(YARNS[yarn].hex, from, cellClientPos(mini, c), k * 80)));
    redrawMiniQuilt(cells);
    d().quilt = quilt.serialize();
    save.touch();
  } else {
    // A filler colour (not in the picture): a small coin bonus instead.
    d().coins += ECONOMY.coins.fillerBonus;
    floatText(`+${ECONOMY.coins.fillerBonus} 🪙`, from.x, from.y);
    save.touch();
  }
  await celebrate;
  renderHud();
}

async function checkEnd(): Promise<void> {
  if (isWon(board)) return void (playMode === "daily" ? winDaily() : winLevel());
  if (isStuck(board)) return void showStuck();
}

/** The moth's timer ran out: undo the move, shoo the moth (ad or coins), or restart. */
async function showMothChewed(): Promise<void> {
  platform.gameplayStop();
  sfx.bonk();
  haptic("error");
  let action: (() => Promise<void>) | null = null;
  const shooPrice = 100;
  await openModal((box, close) => {
    box.innerHTML = `<div class="big-icon">🦋</div><h2>${t("mothTitle")}</h2><p>${t("mothBody")}</p>`;
    // Undoing the fatal move is always free.
    box.append(
      button(`↶ ${t("mothUndo")}`, "green", () => {
        action = async () => {
          const h = history.pop();
          if (!h) return;
          board = h.board;
          moves = h.moves;
          view.build(board, yarnOf);
          renderHud();
        };
        close();
      }),
    );
    const shoo = () => {
      action = async () => {
        board.moth = null;
        view.setMoth(null);
        renderHud();
        await checkEnd();
      };
      close();
    };
    box.append(
      button(`🎬 ${t("mothShoo")}`, "ad", async () => {
        if (await watchAd("rescue")) shoo();
      }, !canWatchAd("rescue")),
    );
    box.append(
      button(`🪙 ${shooPrice} · ${t("mothShoo")}`, "plain", () => {
        if (d().coins < shooPrice) return toast(t("buyNone"));
        d().coins -= shooPrice;
        save.touch();
        shoo();
      }, d().coins < shooPrice),
    );
    box.append(button(`⟲ ${t("restart")}`, "plain", () => ((action = onRestart), close())));
  });
  if (action) await (action as () => Promise<void>)();
}

// ---------------------------------------------------------------- undo / restart / hint

async function onUndo(): Promise<void> {
  if (busy || inModal) return;
  if (!history.length) {
    sfx.bonk();
    return;
  }
  if (lvl.undosFree > 0) lvl.undosFree--;
  else if (lvl.undoCredits > 0) lvl.undoCredits--;
  else {
    if (!(await acquire("undo"))) return;
    lvl.undoCredits--;
  }
  const h = history.pop()!;
  board = h.board;
  moves = h.moves;
  selected = -1;
  selectedBasket = -1;
  view.build(board, yarnOf);
  sfx.lift();
  renderHud();
}

async function onRestart(): Promise<void> {
  if (busy || inModal) return;
  if (playMode === "daily") {
    platform.gameplayStop();
    await startDaily();
    return;
  }
  platform.levelFail();
  const r = (restarts.get(def.n) ?? 0) + 1;
  restarts.set(def.n, r);
  platform.gameplayStop();
  if (r >= 3) {
    let easier = false;
    await openModal((box, close) => {
      box.innerHTML = `<h2>${t("restart")}</h2>`;
      box.append(button(t("easierVersion"), "green", () => ((easier = true), close())));
      box.append(button(t("restart"), "plain", close));
    });
    await startLevel(def.n, { easier });
  } else {
    await startLevel(def.n, { easier: lvl.easier });
  }
}

async function onHint(): Promise<void> {
  if (busy || inModal || playMode === "daily") return;
  if (lvl.freeHint) lvl.freeHint = false;
  else if (!d().day.freeHintUsed) d().day.freeHintUsed = true;
  else if (!(await acquire("hint"))) return;
  save.touch();
  renderHud();
  busy = true;
  try {
    const res = await solveInWorker({ stacks: board.stacks, caps: board.caps, L: board.L, basket: board.basket, moth: board.moth });
    const first = res.solved ? res.moves[0] : null;
    if (!first) {
      toast(t("stuckBody"));
    } else if (first.kind === "move") {
      view.setHint([first.from, first.to]);
    } else {
      selectedBasket = first.index;
      view.setHint([first.to, first.to]);
      renderBasket();
    }
  } finally {
    busy = false;
  }
}

// ---------------------------------------------------------------- power-ups

async function onPowerUp(id: PowerUpId): Promise<void> {
  if (busy || inModal) return;
  if (!isUnlocked(id)) {
    toast(playMode === "daily" && !DAILY_POWER_UPS.includes(id) ? t("dailyOnlySome") : t("locked_at", { n: puInfo(id).unlockLevel }));
    return;
  }
  if ((mode === "snip" && id === "snip") || (mode === "swift" && id === "swift")) {
    mode = "play";
    renderHud();
    return;
  }
  if (id === "lantern" && !board.hidden.some((h) => h.some(Boolean))) {
    toast(t("pu_lantern_desc"));
    return;
  }
  if (id === "snip" && board.basket.length >= BASKET_SIZE) {
    toast(t("basket"));
    return;
  }
  if (d().inv[id] <= 0 && !(await acquire(id))) return;
  markTouched();
  view.clearLift();
  selected = -1;
  selectedBasket = -1;
  view.setHint(null);

  if (id === "spare") {
    consume(id);
    addSpareNeedle(board);
    view.addNeedle(4);
    sfx.power();
    haptic("medium");
    history = [];
  } else if (id === "lantern") {
    consume(id);
    revealAll(board);
    view.syncColours(board);
    sfx.power();
    history = [];
  } else if (id === "snip") {
    mode = "snip";
    toast(t("snipPrompt"), 4000);
  } else if (id === "swift") {
    mode = "swift";
    toast(t("swiftPrompt"), 4000);
  }
  renderHud();
  if (id === "spare" || id === "lantern") await checkEnd();
}

function consume(id: PowerUpId): void {
  d().inv[id] = Math.max(0, d().inv[id] - 1);
  if (puInfo(id).capsStars) lvl.capped = true;
  save.touch();
}

async function onLoopTap(clientX: number, clientY: number): Promise<void> {
  const hit = view.pickLoop(clientX, clientY);
  if (!hit || board.locked[hit.needle]) {
    sfx.bonk();
    return;
  }
  busy = true;
  if (mode === "snip") {
    if (snip(board, hit.needle, hit.index)) {
      consume("snip");
      sfx.snip();
      haptic("medium");
      history = [];
      mode = "play";
      renderHud();
      await view.animateSnip(hit.needle, hit.index);
      view.syncColours(board);
      view.setMoth(board.moth);
      if (board.locked[hit.needle]) await onNeedleComplete(hit.needle);
    }
  } else if (mode === "swift") {
    // A twisted loop: wind its first colour.
    const colour = coloursOf(board.stacks[hit.needle][hit.index])[0];
    const picks = swiftPicks(board, colour);
    const lockedBefore = board.locked.slice();
    const target = yarnSwift(board, colour);
    const positions = picks.positions;
    const basketIdx = picks.basket;
    view.setMoth(board.moth);
    consume("swift");
    history = [];
    mode = "play";
    sfx.power();
    haptic("heavy");
    renderHud();
    await view.animateSwift(positions, basketIdx, target, board);
    const newlyLocked = board.locked.map((l, i) => (l && !lockedBefore[i] ? i : -1)).filter((i) => i >= 0);
    for (const nIdx of newlyLocked) await onNeedleComplete(nIdx);
  }
  busy = false;
  renderHud();
  await checkEnd();
}

// ---------------------------------------------------------------- stuck / win

async function showStuck(): Promise<void> {
  platform.gameplayStop();
  let action: (() => Promise<void>) | null = null;
  await openModal((box, close) => {
    box.innerHTML = `<div class="big-icon">🧶</div><h2>${t("stuckTitle")}</h2><p>${t("stuckBody")}</p>`;
    const grid = document.createElement("div");
    grid.className = "stuck-grid";
    const pick = (fn: () => Promise<void>) => () => {
      action = fn;
      close();
    };
    grid.append(button(`↶ ${t("undo")}`, "plain", pick(onUndo), !history.length));
    grid.append(button(`🪡 ${t("pu_spare")}`, "green", pick(() => onPowerUp("spare")), !isUnlocked("spare")));
    grid.append(button(`✂️ ${t("pu_snip")}`, "plain", pick(() => onPowerUp("snip")), !isUnlocked("snip")));
    grid.append(button(`💡 ${t("hint")}`, "plain", pick(onHint), def.n < 10));
    box.append(grid);
    if (platform.rewardedAvailable && canWatchAd("spare")) {
      box.append(
        button(`🎬 ${t("pu_spare")} + 2 ${t("undo")}`, "ad", async () => {
          if (await watchAd("rescue")) {
            lvl.undoCredits += 2;
            action = async () => {
              addSpareNeedle(board);
              view.addNeedle(4);
              history = [];
              renderHud();
            };
            close();
          }
        }),
      );
    }
    if ((restarts.get(def.n) ?? 0) >= 2) box.append(button(t("easierVersion"), "plain", pick(() => startLevel(def.n, { easier: true }))));
    box.append(button(`⟲ ${t("restart")}`, "plain", pick(onRestart)));
  });
  if (action) await (action as () => Promise<void>)();
}

async function winLevel(): Promise<void> {
  busy = true;
  platform.gameplayStop();
  const n = def.n;
  const stars = lvl.easier ? 1 : starsFor(moves, def.par, lvl.capped);
  const firstTry = (restarts.get(n) ?? 0) === 0;
  const coins = levelCoins(n, stars, firstTry, def.tag);
  const prevBest = d().stars[n] ?? 0;
  if (stars > prevBest) {
    d().stars[n] = stars;
    d().totalStars += stars - prevBest;
  }
  d().coins += coins;
  d().level = Math.max(d().level, n + 1);
  d().levelsSinceAd++;
  platform.levelComplete();
  const quiltDone = quilt.complete;
  let reward: PowerUpId | null = null;
  const newAlbums: string[] = [];
  if (quiltDone) {
    if (quilt.encore) d().encores += 1;
    else if (!d().finished.includes(quilt.picture.id)) d().finished.push(quilt.picture.id);
    const unlocked = POWER_UPS.filter((p) => n >= p.unlockLevel).map((p) => p.id);
    reward = unlocked.length ? unlocked[Math.floor(Math.random() * unlocked.length)] : "spare";
    d().inv[reward] += 1;
    // Album complete: its needle skin becomes yours.
    for (const albumId of completedAlbums(d().finished)) {
      if (d().albumsDone.includes(albumId)) continue;
      d().albumsDone.push(albumId);
      newAlbums.push(albumId);
      const skin = albumReward(albumId);
      if (skin && !d().cosmetics.owned.includes(skin.id)) d().cosmetics.owned.push(skin.id);
    }
  }
  if ((def.tag === "tricky" || def.tag === "masterpiece") && firstTry) d().inv.spare += 1;
  recordSkill(moves / Math.max(1, def.par));
  save.touch();
  await save.flush();
  restarts.delete(n);
  if ((stars === 3 && firstTry) || quiltDone) platform.happyTime();
  quiltDone ? sfx.quilt() : sfx.win();
  haptic(quiltDone ? "celebrate" : "success");

  let doubled = false;
  await openModal((box, close) => {
    box.innerHTML = `<h2>${quiltDone ? t("quiltComplete") : t("levelComplete")}</h2>`;
    const st = document.createElement("div");
    st.className = "stars";
    for (let i = 0; i < 3; i++) {
      const s = document.createElement("i");
      s.textContent = "★";
      if (i >= stars) s.className = "off";
      s.style.animationDelay = `${0.15 + i * 0.18}s`;
      st.append(s);
    }
    box.append(st);
    const qc = document.createElement("canvas");
    qc.className = quiltDone ? "quilt-big" : "quilt-mid";
    box.append(qc);
    requestAnimationFrame(() => drawQuilt(qc, quilt));
    const p = document.createElement("p");
    p.textContent = quiltDone ? `${quilt.picture.name} · +1 ${t(`pu_${reward}`)}` : t("quiltProgress", { done: quilt.filledCount });
    box.append(p);
    const cw = document.createElement("div");
    cw.className = "coins-won";
    cw.textContent = `+${coins} 🪙`;
    box.append(cw);
    if (platform.rewardedAvailable) {
      const dbl = button(`🎬 ${t("doubleCoins")}`, "ad", async () => {
        dbl.disabled = true;
        if (await watchAd("double")) {
          d().coins += coins;
          doubled = true;
          cw.textContent = `+${coins * 2} 🪙`;
          sfx.coin();
          save.touch();
        } else dbl.disabled = false;
      });
      box.append(dbl);
    }
    box.append(button(`${t("next")} ▸`, "", close));
  });

  // Interstitial: only at natural breaks, never in the tutorial start, never right after a
  // rewarded ad or a finished quilt (DESIGN.md §3).
  if (
    n >= ECONOMY.interstitial.firstLevel &&
    d().levelsSinceAd >= ECONOMY.interstitial.everyLevels &&
    !quiltDone &&
    !d().noAds &&
    !doubled
  ) {
    sfx.synth.setHostSuspended(true);
    const shown = await platform.interstitial(ECONOMY.interstitial.minGapSec);
    sfx.synth.setHostSuspended(false);
    if (shown) {
      d().levelsSinceAd = 0;
      save.touch();
    }
  }
  for (const albumId of newAlbums) await showAlbumComplete(albumId);
  if (quiltDone) {
    const before = quilt.albumIndex;
    const next = nextPicture(d().finished, d().totalStars, d().encores);
    quilt = new QuiltProgress(next.index, "0".repeat(64), next.encore);
    d().quilt = quilt.serialize();
    save.touch();
    if (!next.encore && quilt.albumIndex !== before) {
      setTimeout(() => toast(t("albumUnlocked", { name: t(`album_${ALBUMS[quilt.albumIndex].id}`) }), 4000), 600);
    }
  }
  busy = false;
  await startLevel(n + 1);
}

/** Remember how close to par the player finishes (last 10 wins), to help when they struggle. */
function recordSkill(ratio: number): void {
  const s = d().skill;
  s.push(Math.round(ratio * 100) / 100);
  while (s.length > 10) s.shift();
}

/** True when the player is usually well over par: hints come sooner. */
function isStruggling(): boolean {
  const s = d().skill;
  if (s.length < 5) return false;
  return s.reduce((a, b) => a + b, 0) / s.length > 1.35;
}

function showAlbumComplete(albumId: string): Promise<void> {
  const skin = albumReward(albumId);
  platform.happyTime();
  sfx.quilt();
  haptic("celebrate");
  return openModal((box, close) => {
    box.innerHTML = `<div class="big-icon">📖</div><h2>${t("albumComplete")}</h2><p>${t(`album_${albumId}`)}</p>`;
    const strip = document.createElement("div");
    strip.className = "album-strip";
    const startIdx = ALL_PICTURES.findIndex((p) => ALBUMS[p.album].id === albumId);
    for (let i = 0; i < 8; i++) {
      const c = document.createElement("canvas");
      strip.append(c);
      requestAnimationFrame(() => drawQuilt(c, new QuiltProgress(startIdx + i, "1".repeat(64))));
    }
    box.append(strip);
    if (skin) {
      const sw = document.createElement("div");
      sw.className = "skin-reward";
      sw.innerHTML = `<span class="swatch" style="background:${skin.swatch}"></span><b>${t("rewardSkin", { name: t(skin.id) })}</b>`;
      box.append(sw);
      box.append(
        button(t("equip"), "green", () => {
          equip(skin.id);
          close();
        }),
      );
    }
    box.append(button(`${t("next")} ▸`, "", close));
  });
}

// ---------------------------------------------------------------- menus

// ---------------------------------------------------------------- cosmetics & shop

function applyCosmetics(): void {
  const c = d().cosmetics;
  const yarn = cosmetic(c.yarn).yarn ?? cosmetic(DEFAULT_EQUIPPED.yarn).yarn!;
  const needle = cosmetic(c.needle).needle ?? cosmetic(DEFAULT_EQUIPPED.needle).needle!;
  const board = cosmetic(c.board).board ?? cosmetic(DEFAULT_EQUIPPED.board).board!;
  view.applyCosmetics(yarn, needle, board);
  document.body.style.background = board.bg;
  document.body.dataset.board = board.kind;
}

function equip(id: string): void {
  const item = cosmetic(id);
  if (!d().cosmetics.owned.includes(id)) return;
  d().cosmetics[item.slot] = id;
  save.touch();
  applyCosmetics();
}

function showShop(): void {
  if (d().level <= SHOP_LEVEL) {
    toast(t("shopLocked", { n: SHOP_LEVEL }));
    return;
  }
  const ex = appExtras;
  void forgeShowShop(ui, {
    tabs: [
      { id: "yarn", label: t("shopYarn") },
      { id: "needle", label: t("shopNeedles") },
      { id: "board", label: t("shopBoard") },
    ],
    items: COSMETICS.map((c) => ({ id: c.id, tab: c.slot, price: c.price, album: c.album, swatch: c.swatch })),
    coins: () => d().coins,
    isOwned: (id) => d().cosmetics.owned.includes(id),
    inUse: (id) => d().cosmetics[cosmetic(id).slot] === id,
    equip,
    buy: (item) => {
      d().coins -= item.price;
      d().cosmetics.owned.push(item.id);
      sfx.coin();
      renderHud();
    },
    albumLabel: (albumId) => t(`album_${albumId}`),
    // App only: real-money products, priced by the store.
    extraTab: ex
      ? {
          id: "store",
          label: t("storeTab"),
          render: (box, grid) => {
            for (const p of ex.PRODUCTS) {
              const info = ex.productInfo(p.id);
              const card = document.createElement("div");
              card.className = "shop-card";
              card.innerHTML = `<span class="swatch" style="background:radial-gradient(circle,#ffe9a0,#f2c14e)"></span><span class="name">${t(p.id)}</span>`;
              const owned = (p.id === "knotwork_remove_ads" && d().noAds) || (!p.consumable && info?.owned);
              card.append(owned ? button(t("owned"), "plain small", () => {}, true) : button(info?.price || "…", "small", () => void ex.buy(p.id), !info));
              grid.append(card);
            }
            box.append(grid, button(t("restorePurchases"), "plain", () => void ex.restore()));
          },
        }
      : undefined,
  });
}

/** App only: what each in-app purchase gives. */
function grantProduct(id: string): void {
  const inv = d().inv;
  switch (id) {
    case "knotwork_remove_ads":
      d().noAds = true;
      break;
    case "knotwork_starter_pack":
      d().coins += 2000;
      for (const k of Object.keys(inv) as PowerUpId[]) inv[k] += 3;
      break;
    case "knotwork_coins_small":
      d().coins += 1000;
      break;
    case "knotwork_coins_medium":
      d().coins += 3000;
      break;
    case "knotwork_coins_large":
      d().coins += 8000;
      break;
    case "knotwork_powerup_bundle":
      inv.spare += 5;
      inv.snip += 3;
      inv.swift += 2;
      break;
    case "knotwork_cosmetics_all":
      for (const c of COSMETICS) if (!d().cosmetics.owned.includes(c.id)) d().cosmetics.owned.push(c.id);
      break;
  }
  save.touch();
  sfx.coin();
  if (busy || !started) return;
  renderHud();
}

// ---------------------------------------------------------------- Daily Swatch


/** Today's Daily Swatch. Colours come from a palette shuffled by date (not the quilt). */
async function startDaily(): Promise<void> {
  busy = true;
  rollDay();
  const day = utcDayKey();
  toast(t("loadingDaily"), 1500);
  def = await getDaily(day);
  playMode = "daily";
  board = decodeLevel(def);
  history = [];
  moves = 0;
  selected = -1;
  selectedBasket = -1;
  mode = "play";
  const rng = new Rng(seedOf(day, "daily-colours"));
  yarnMap = rng.shuffle(YARNS.map((_, i) => i)).slice(0, board.k);
  ads.newLevel();
  lvl = {
    undosFree: ECONOMY.freeUndosPerLevel,
    undoCredits: 0,
    capped: false,
    easier: false,
    freeHint: false,
    touched: false,
    finishing: false,
  };
  view.build(board, yarnOf);
  view.setHint(null);
  busy = false;
  renderHud();
}

function dailyYarn(day: string): string {
  return YARNS[new Rng(seedOf(day, "calendar")).int(0, YARNS.length - 1)].hex;
}

/** Daily card (shared forge UI): today's result, streak, calendar, play / retry / share. */
async function showDailyCard(justWon = false): Promise<void> {
  const next = await forgeDailyCard(ui, {
    icon: "🧶",
    state: d().swatch,
    level: d().level,
    unlockAfter: DAILY_UNLOCK_LEVEL,
    inDaily: playMode === "daily",
    justWon,
    rewardedAvailable: platform.rewardedAvailable,
    shareText: (day, r) => dailyShareText("Knotwork", "🧶", day, r, currentStreak(d().swatch, day)),
    colourOfDay: dailyYarn,
    patch: drawPatch,
    watchAd: () => watchAd("double"),
    onRetryUsed: () => save.touch(),
  });
  if (next === "play") await startDaily();
  else if (next === "back") await startLevel(d().level);
}

async function winDaily(): Promise<void> {
  busy = true;
  platform.gameplayStop();
  const day = utcDayKey();
  const sw = d().swatch;
  const stars = starsFor(moves, def.par, false);
  if (recordDailyWin(sw, day, { moves, par: def.par, stars })) {
    const coins = 40 + 10 * stars;
    d().coins += coins;
    setTimeout(() => toast(`+${coins} 🪙`), 300);
    if (sw.streak % ECONOMY.streakSwiftEvery === 0) {
      d().inv.swift += 1;
      setTimeout(() => toast(t("dailySwiftBonus"), 4000), 2200);
    }
  }
  save.touch();
  await save.flush();
  sfx.win();
  haptic("success");
  if (stars === 3) platform.happyTime();
  busy = false;
  renderHud();
  await showDailyCard(true);
}

function showQuiltModal(): void {
  void openModal(
    (box, close) => {
      const album = ALBUMS[quilt.albumIndex];
      const encore = quilt.encore ? ` · ${t("encore")}` : "";
      box.innerHTML = `<h2>${quilt.picture.name}</h2><p>${t(`album_${album.id}`)}${encore} · ${t("quiltProgress", { done: quilt.filledCount })}</p>`;
      const big = document.createElement("canvas");
      big.className = "quilt-big";
      box.append(big);
      const stars = document.createElement("p");
      stars.textContent = t("totalStars", { n: d().totalStars });
      box.append(stars);
      // Every album: finished pictures, the one in progress, or how many stars it needs.
      ALBUMS.forEach((alb, ai) => {
        const head = document.createElement("div");
        head.className = "album-head";
        const open = albumOpen(ai, d().totalStars);
        const done = alb.pictures.filter((p) => d().finished.includes(p.id)).length;
        head.innerHTML = `<b>${t(`album_${alb.id}`)}</b><span>${open ? `${done}/8` : `🔒 ${t("albumNeedsStars", { n: ALBUM_STARS[ai] })}`}</span>`;
        box.append(head);
        if (!open) return;
        const strip = document.createElement("div");
        strip.className = "album-strip";
        const startIdx = ALL_PICTURES.findIndex((p) => p.album === ai);
        alb.pictures.forEach((pic, i) => {
          if (d().finished.includes(pic.id)) {
            const c = document.createElement("canvas");
            strip.append(c);
            requestAnimationFrame(() => drawQuilt(c, new QuiltProgress(startIdx + i, "1".repeat(64))));
          } else {
            const e = document.createElement("div");
            e.className = "todo";
            e.textContent = startIdx + i === quilt.picIndex && !quilt.encore ? "🧶" : "?";
            strip.append(e);
          }
        });
        box.append(strip);
      });
      box.append(button(t("close"), "plain", close));
      requestAnimationFrame(() => drawQuilt(big, quilt));
    },
    { dismissable: true },
  );
}

function showSettings(): void {
  const ex = appExtras;
  void forgeShowSettings(ui, {
    rows: [
      { label: t("sound"), get: () => d().settings.sound, set: (v) => ((d().settings.sound = v), sfx.synth.setMuted(!v)) },
      { label: t("haptics"), get: () => d().settings.haptics, set: (v) => ((d().settings.haptics = v), setHapticsEnabled(v)) },
      { label: t("music"), get: () => d().settings.music, set: (v) => ((d().settings.music = v), music.setEnabled(v)) },
      ...(ex
        ? [{ label: t("reminder"), get: () => d().reminder, set: (v: boolean) => ((d().reminder = v), void ex.setDailyReminder(v, t("reminderTitle"), t("reminderBody"))) }]
        : []),
      {
        label: t("colorblind"),
        get: () => d().settings.colorblind,
        set: (v) => ((d().settings.colorblind = v), view.setSymbols(v), renderBasket()),
      },
    ],
    languages: LANGUAGES,
    onLanguage: (code) => {
      d().settings.lang = code;
      setLanguage(code);
      save.touch();
      renderHud();
      showSettings();
    },
    onChange: () => save.touch(),
    extra: (close) => [
      button(`🛍 ${t("shop")}`, "green", () => (close(), showShop())),
      button(t("resetProgress"), "plain", async () => {
        if (!confirm(t("resetConfirm"))) return;
        await save.reset();
        quilt = new QuiltProgress(0, "0".repeat(64));
        close();
        await startLevel(1);
      }),
    ],
  });
}

function showTitle(): Promise<void> {
  return new Promise((resolve) => {
    const el = document.createElement("div");
    el.className = "title-screen";
    const n = d().level;
    el.innerHTML = `<h1>${t("title")}</h1><div class="tag">${t("tagline")}</div>`;
    const qc = document.createElement("canvas");
    qc.className = "quilt-mid";
    el.append(qc);
    const leave = () => {
      unlockAudio();
      el.remove();
      inModal = $("modal-root").childElementCount > 0;
      resolve();
    };
    el.append(button(n > 1 ? t("continueLevel", { n }) : t("play"), "", leave));
    const daily = button(`🧶 ${t("daily")}${d().swatch.results[utcDayKey()] ? " ✓" : ""}`, "plain", () => {
      leave();
      void showDailyCard();
    });
    el.append(daily);
    $("modal-root").append(el);
    inModal = true;
    requestAnimationFrame(() => drawQuilt(qc, quilt));
  });
}

// ---------------------------------------------------------------- input

function bindInput(): void {
  const canvas = $<HTMLCanvasElement>("board");
  canvas.addEventListener("pointerdown", (e) => {
    unlockAudio();
    if (busy || inModal) return;
    if (mode === "snip" || mode === "swift") {
      void onLoopTap(e.clientX, e.clientY);
      return;
    }
    const i = view.pickNeedle(e.clientX, e.clientY);
    if (i >= 0) void onNeedleTap(i);
    else if (selected >= 0) {
      view.clearLift();
      selected = -1;
    }
  });
  $("btn-undo").addEventListener("click", () => void onUndo());
  $("btn-restart").addEventListener("click", () => void onRestart());
  $("btn-hint").addEventListener("click", () => void onHint());
  $("btn-menu").addEventListener("click", showSettings);
  $("coins").addEventListener("click", () => !busy && !inModal && showShop());
  $("side-shop").addEventListener("click", () => !busy && !inModal && showShop());
  $("side-daily").addEventListener("click", () => {
    if (!busy && !inModal) void showDailyCard();
  });
  $("side-quilt-btn").addEventListener("click", () => !inModal && showQuiltModal());
  $("btn-daily").addEventListener("click", () => {
    if (!busy && !inModal) void showDailyCard();
  });
  $("mini-quilt-btn").addEventListener("click", showQuiltModal);
  // Portals embed the game in an iframe: keys and the wheel must never scroll their page.
  window.addEventListener("wheel", (e) => e.preventDefault(), { passive: false });
  window.addEventListener("keydown", (e) => {
    if ([" ", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "PageUp", "PageDown"].includes(e.key) && !(e.target instanceof HTMLSelectElement)) e.preventDefault();
    unlockAudio();
    if (inModal || e.repeat) return;
    const k = e.key.toLowerCase();
    if (k === "z") return void onUndo();
    const pu = POWER_UPS.find((p) => p.key === k);
    if (pu) return void onPowerUp(pu.id);
    const num = "1234567890".indexOf(k);
    if (num >= 0 && num < board.stacks.length) void onNeedleTap(num);
  });
}

// ---------------------------------------------------------------- boot

async function boot(): Promise<void> {
  registerStrings("en", EN);
  registerTranslations();
  platform.loadingProgress(0.1);
  await platform.init();
  setLanguage(detectLanguage(platform.language(), !platform.hostControlsVisibility));
  save = new SaveSlot<SaveData>(platform.storage, { key: "knotwork", version: SAVE_VERSION, defaults: defaultSave });
  await save.load();
  platform.loadingProgress(0.4);

  // Dev helpers (stripped from production builds): ?level=N&coins=N&fresh=1
  if (import.meta.env.DEV) {
    const q = new URLSearchParams(location.search);
    if (q.get("fresh")) await save.reset();
    if (q.get("level")) d().level = Number(q.get("level"));
    if (q.get("coins")) d().coins = Number(q.get("coins"));
    // ?def=<base64 JSON> plays a level from the editor (editor.html).
    if (q.get("def")) devDef = JSON.parse(atob(q.get("def")!)) as LevelDef;
    (window as unknown as Record<string, unknown>).__knot = {
      get board() { return board; },
      get def() { return def; },
      get view() { return view; },
      get moves() { return moves; },
      get quilt() { return quilt; },
      save,
      platform,
      startLevel,
      tap: (i: number) => onNeedleTap(i),
      power: (id: PowerUpId) => onPowerUp(id),
      undo: () => onUndo(),
    };
  }

  if (d().settings.lang) setLanguage(d().settings.lang);
  // Phone app only: purchases and the daily reminder (never part of web builds).
  if (import.meta.env.VITE_PLATFORM === "app") {
    appExtras = await import("./game/app-extras.ts");
    await appExtras.initStore(grantProduct).catch((err) => console.warn("[knotwork] store unavailable", err));
  }
  sfx.synth.setMuted(!d().settings.sound);
  setHapticsEnabled(d().settings.haptics);
  music.setEnabled(d().settings.music);
  quilt = new QuiltProgress(d().quilt.pic, d().quilt.cells, !!d().quilt.encore);

  view = new BoardView($<HTMLCanvasElement>("board"), $("fx-layer"));
  view.setSymbols(d().settings.colorblind);
  applyCosmetics();
  const resize = () => {
    // Wide screens (desktop portals) get a side panel with the quilt; phones stay one column.
    const wide = window.innerWidth >= 760 && window.innerWidth / window.innerHeight > 1.15;
    document.body.classList.toggle("wide", wide);
    const canvas = $<HTMLCanvasElement>("board");
    view.resize(canvas.clientWidth, canvas.clientHeight);
    const cr = canvas.getBoundingClientRect();
    const top = $("hud-sub").getBoundingClientRect().bottom - cr.top + 4;
    const bottom = cr.bottom - $("hud-bottom").getBoundingClientRect().top + 4;
    view.setSafeArea(Math.max(0, top), Math.max(0, bottom));
    redrawMiniQuilt();
  };
  window.addEventListener("resize", resize);
  bindInput();

  const loop = new Loop((dt) => view.render(dt));
  platform.on("pause", () => {
    loop.setPaused(true);
    sfx.synth.setHostSuspended(true);
    void save.flush(); // the host may close the game while paused
  });
  platform.on("resume", () => {
    loop.setPaused(false);
    sfx.synth.setHostSuspended(false);
  });
  platform.on("hostAudio", ({ enabled }) => sfx.synth.setMuted(!enabled || !d().settings.sound));

  await startLevel(devDef ? Math.max(21, d().level) : d().level, { override: devDef ?? undefined });
  resize();
  platform.loadingProgress(1);
  loop.start();
  requestAnimationFrame(() => {
    platform.firstFrame();
    platform.loadingDone();
    $("loading").classList.add("done");
  });
  started = true;
  // Dev only: ?press=1 renders store art into press/ (see src/dev/press.ts).
  if (import.meta.env.DEV && new URLSearchParams(location.search).has("press")) {
    const { runPress } = await import("./dev/press.ts");
    const saved = await runPress();
    toast(`press: saved ${saved.length} images`, 8000);
    return;
  }
  await showTitle();
}

void boot().catch((err) => {
  console.error(err);
  $("loading").innerHTML = `<p style="padding:20px;text-align:center">Something went wrong loading Knotwork.<br>${String(err)}</p>`;
});

export { started };
