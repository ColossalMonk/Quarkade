// Unbolted: game controller. Rules + workshop view + forge UI shell + platform (ads, saves).

import "./style.css";
import { Platform } from "../../../forge/src/platform/platform.ts";
import { SaveSlot } from "../../../forge/src/core/save.ts";
import { Loop } from "../../../forge/src/core/loop.ts";
import { haptic, setHapticsEnabled } from "../../../forge/src/core/haptics.ts";
import { registerStrings, detectLanguage, setLanguage, t } from "../../../forge/src/core/i18n.ts";
import { Rng, seedOf, utcDayKey } from "../../../forge/src/core/rng.ts";
import { Music } from "../../../forge/src/core/music.ts";
import { Ui, starsRow, para } from "../../../forge/src/ui/ui.ts";
import { AdBudget, interstitialDue } from "../../../forge/src/ui/ads.ts";
import { buyCard } from "../../../forge/src/ui/buy-card.ts";
import { showDailyCard as forgeDailyCard, recordDailyWin, currentStreak, dailyShareText } from "../../../forge/src/ui/daily.ts";
import { showShop as forgeShowShop } from "../../../forge/src/ui/shop.ts";
import { showSettings as forgeShowSettings } from "../../../forge/src/ui/settings.ts";
import type { Board, LevelDef, TapResult } from "./logic/rules.ts";
import { BOX_SIZE, cloneBoard, drill, extraSlot, isCovered, isLocked, isStuck, isWon, magnet, newBoard, oilCan, routeFor, tap } from "./logic/rules.ts";
import { getDaily, getLevel, solveInWorker } from "./game/levels.ts";
import { GadgetProgress, nextGadget, roomOpen, roomsWithAllGadgets } from "./game/gadget.ts";
import { defaultSave, SAVE_VERSION } from "./game/save.ts";
import type { SaveData } from "./game/save.ts";
import { ECONOMY, POWER_UPS, levelCoins, starsFor } from "./data/economy.ts";
import type { PowerUpId } from "./data/economy.ts";
import { COSMETICS, DEFAULT_EQUIPPED, ROOM_STARS, cosmetic, roomReward } from "./data/cosmetics.ts";
import type { CosmeticSlot } from "./data/cosmetics.ts";
import { DECOR_SPOTS, DECOR_STYLES, GADGETS, ROOMS, decorId, gadgetsOfRoom } from "./data/gadgets.ts";
import type { DecorSpot } from "./data/gadgets.ts";
import { BOLT_COLOURS } from "./data/palette.ts";
import { EN } from "./data/strings.ts";
import { LANGUAGES, registerTranslations } from "./data/i18n/index.ts";
import { WorkshopView } from "./view/workshop.ts";
import { drawDecorPreview, drawGadget, drawRoom } from "./view/draw.ts";
import { Sfx, WORKSHOP_SONG } from "./view/sfx.ts";

type ItemId = PowerUpId | "undo" | "hint";
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const SYMBOL_GLYPHS = ["●", "◯", "✚", "✖", "■", "◆", "☰", "┃", "▲", "⁚", "⌃", "□"];
const DAILY_POWER_UPS: PowerUpId[] = ["slot", "oil"];
/** App build only (purchases, reminder); null on the web. */
let appExtras: typeof import("./game/app-extras.ts") | null = null;

// ---------------------------------------------------------------- state

const platform = new Platform();
const sfx = new Sfx();
const music = new Music(sfx.synth, WORKSHOP_SONG);
let inModal = false;
const ui = new Ui({ modalRoot: $("modal-root"), toast: $("toast"), fxLayer: $("fx-layer") });
ui.onModalChange = (open) => (inModal = open);
let save!: SaveSlot<SaveData>;
let gadget!: GadgetProgress;
let view!: WorkshopView;
let def!: LevelDef;
let board!: Board;
let colourMap: number[] = [];
let history: Board[] = [];
let mode: "play" | "drill" | "magnet" = "play";
let busy = false;
let started = false;
let playMode: "levels" | "daily" = "levels";
let devDef: LevelDef | null = null;
/** Bolts flying to the bench: the bench hides their chips until they land. */
let inFlight = 0;

interface LevelState {
  undosFree: number;
  undoCredits: number;
  capped: boolean;
  easier: boolean;
  freeHint: boolean;
  touched: boolean;
  finishing: boolean;
  extraSlots: number;
}
let lvl!: LevelState;
const restarts = new Map<number, number>();
let coverHintShown = 0;

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

// ---------------------------------------------------------------- helpers

const d = () => save.data;
const toast = (m: string, ms?: number) => ui.toast(m, ms);
const button = (label: string, cls: string, fn: () => void, disabled = false) => ui.button(label, cls, fn, disabled);

function rollDay(): void {
  const key = utcDayKey();
  if (d().day.key !== key) {
    d().day = { key, rewarded: 0, byItem: {}, freeHintUsed: false };
    save.touch();
  }
}

function colourOf(slot: number): number {
  return colourMap[slot] ?? slot;
}

function hexOf(slot: number): string {
  return BOLT_COLOURS[colourOf(slot) % BOLT_COLOURS.length].hex;
}

function puInfo(id: PowerUpId) {
  return POWER_UPS.find((p) => p.id === id)!;
}

function isUnlocked(id: PowerUpId): boolean {
  if (playMode === "daily") return DAILY_POWER_UPS.includes(id) && (d().level >= puInfo(id).unlockLevel || d().gifted[id]);
  return def.n >= puInfo(id).unlockLevel || d().gifted[id];
}

function unlockAudio(): void {
  sfx.synth.unlock();
  if (d().settings.music) music.start();
}

/** Short CSS animation that also finishes when the page is hidden (WAAPI can stall there). */
function animateEl(el: HTMLElement, frames: Keyframe[], ms: number): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    const end = () => {
      if (!done) {
        done = true;
        resolve();
      }
    };
    try {
      el.animate(frames, { duration: ms, easing: "ease-out", fill: "forwards" }).finished.then(end, end);
    } catch {
      end();
    }
    setTimeout(end, ms + 80);
  });
}

// ---------------------------------------------------------------- HUD + bench

function renderHud(): void {
  $("lvl-label").textContent = playMode === "daily" ? t("dailyShort") : t("level", { n: def.n });
  const tag = $("lvl-tag");
  tag.className = "";
  tag.textContent =
    playMode === "daily"
      ? utcDayKey()
      : lvl.finishing
        ? t("tag_finishing")
        : def.tag === "tricky"
          ? t("tag_tricky")
          : def.tag === "masterpiece"
            ? t("tag_masterpiece")
            : def.tag === "breather"
              ? t("tag_breather")
              : "";
  if (def.tag === "breather") tag.classList.add("breather");
  if (lvl.finishing) tag.classList.add("finishing");
  $("coin-count").textContent = String(d().coins);
  $("moves").textContent = t("detours", { m: board.detours });
  $("par").textContent = t("par", { p: def.par });
  const stars = lvl.easier ? 1 : starsFor(board.detours, def.par, lvl.capped);
  [...$("live-stars").children].forEach((el, i) => el.classList.toggle("off", i >= stars));
  $("undo-count").textContent = String(lvl.undosFree + lvl.undoCredits || "+");
  $("btn-hint").hidden = playMode === "daily" || def.n < 10;
  const freeHints = (lvl.freeHint ? 1 : 0) + (d().day.freeHintUsed ? 0 : 1);
  $("hint-count").textContent = freeHints ? String(freeHints) : "";
  $("btn-daily").classList.toggle("done", !!d().daily.results[utcDayKey()]);
  $("side-daily").textContent = `🔩 ${t("dailyShort")}`;
  $("side-shop").textContent = `🛍 ${t("shop")}`;
  renderPowerups();
}

function renderPowerups(): void {
  const wrap = $("powerups");
  if (!wrap.childElementCount) {
    for (const pu of POWER_UPS) {
      const b = document.createElement("button");
      b.className = "pu";
      b.dataset.id = pu.id;
      b.innerHTML = `<span class="ic">${pu.icon}</span><b></b>`;
      b.addEventListener("click", () => void onPowerUp(pu.id));
      wrap.append(b);
    }
  }
  for (const b of [...wrap.children] as HTMLButtonElement[]) {
    const id = b.dataset.id as PowerUpId;
    b.setAttribute("aria-label", t(`pu_${id}`));
    const unlocked = isUnlocked(id);
    const badge = b.querySelector("b")!;
    b.classList.toggle("locked", !unlocked);
    b.classList.toggle("active", mode === id);
    badge.className = "";
    if (!unlocked) badge.textContent = "🔒";
    else if (d().inv[id] > 0) badge.textContent = String(d().inv[id]);
    else {
      badge.textContent = "+";
      badge.className = "plus";
    }
  }
}

function chip(slot: number): HTMLElement {
  const c = document.createElement("div");
  c.className = "boltchip";
  c.style.setProperty("--c", hexOf(slot));
  if (d().settings.colorblind) c.textContent = SYMBOL_GLYPHS[BOLT_COLOURS[colourOf(slot) % BOLT_COLOURS.length].symbol];
  return c;
}

/**
 * Draw the toolboxes and the tray from the board. `closing` shows boxes that just filled (full,
 * lid down) before the next box slides in; `hide` leaves the last few chips out while they fly.
 */
function renderBench(closing: Array<{ slot: number; colour: number }> = [], hide: { slot?: number; tray?: boolean } = {}): void {
  const boxes = $("boxes");
  boxes.innerHTML = "";
  board.slots.forEach((s, i) => {
    const el = document.createElement("button");
    el.className = "toolbox";
    el.dataset.slot = String(i);
    const closeInfo = closing.find((c) => c.slot === i);
    const colour = closeInfo ? closeInfo.colour : s ? def.boxes[s.q] : -1;
    const n = closeInfo ? BOX_SIZE : s ? s.n : 0;
    if (colour < 0) el.classList.add("empty-slot");
    else el.style.setProperty("--box", hexOf(colour));
    if (closeInfo) el.classList.add("closed");
    if (mode === "magnet" && colour >= 0 && !closeInfo) el.classList.add("target");
    for (let h = 0; h < BOX_SIZE; h++) {
      const hole = document.createElement("div");
      hole.className = "hole";
      const showN = hide.slot === i ? n - 1 : n;
      if (colour >= 0 && h < showN) hole.append(chip(colour));
      el.append(hole);
    }
    const lid = document.createElement("div");
    lid.className = "lid";
    el.append(lid);
    el.addEventListener("click", () => void onBoxTap(i));
    boxes.append(el);
  });
  const nextEl = document.createElement("div");
  nextEl.id = "next-box";
  if (board.next < def.boxes.length) {
    nextEl.style.setProperty("--box", hexOf(def.boxes[board.next]));
    nextEl.textContent = "next";
  } else nextEl.hidden = true;
  boxes.append(nextEl);
  const tray = $("tray");
  tray.innerHTML = "";
  for (let i = 0; i < board.trayCap; i++) {
    const hole = document.createElement("div");
    hole.className = "hole" + (i >= def.tray ? " extra" : "");
    const showN = hide.tray ? board.tray.length - 1 : board.tray.length;
    if (i < showN) hole.append(chip(board.tray[i]));
    tray.append(hole);
  }
}

function holeClient(slot: number, index: number): { x: number; y: number } {
  const el = slot >= 0 ? $("boxes").querySelector(`.toolbox[data-slot="${slot}"]`)?.children[index] : $("tray").children[index];
  const r = (el ?? $("tray")).getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

function redrawGadget(): void {
  drawGadget($<HTMLCanvasElement>("mini-gadget"), gadget.gadget, gadget.filled);
  if (document.body.classList.contains("wide")) {
    drawGadget($<HTMLCanvasElement>("side-gadget"), gadget.gadget, gadget.filled, { paper: true });
    $("side-title").textContent = gadget.gadget.name;
    $("side-sub").textContent = `${t(`room_${ROOMS[gadget.gadget.room].id}`)}${gadget.encore ? ` · ${t("encore")}` : ""} · ${t("gadgetProgress", { done: gadget.done, total: gadget.total })}`;
    $("side-stars").textContent = t("totalStars", { n: d().totalStars }) + (d().crates ? ` · ${t("crateReady")}` : "");
  }
}

// ---------------------------------------------------------------- ads + buying

function canWatchAd(item: string): boolean {
  return ads.can(item, d().day, platform.rewardedAvailable);
}

async function watchAd(item: string): Promise<boolean> {
  sfx.synth.setHostSuspended(true);
  const ok = await platform.rewarded();
  sfx.synth.setHostSuspended(false);
  if (ok) {
    ads.record(item, d().day);
    save.touch();
  } else toast(t("adUnavailable"));
  return ok;
}

async function acquire(item: ItemId): Promise<boolean> {
  const price = item === "undo" ? ECONOMY.undoPack.price : item === "hint" ? ECONOMY.hint.price : puInfo(item).price;
  const icon = item === "undo" ? "↶" : item === "hint" ? "💡" : puInfo(item).icon;
  const adOk = canWatchAd(item);
  const granted = await buyCard(ui, {
    icon,
    title: t("buyTitle", { name: t(`pu_${item}`) }),
    desc: t(`pu_${item}_desc`),
    price,
    coins: () => d().coins,
    spend: (n) => (d().coins -= n),
    canWatchAd: adOk,
    limitReached: !adOk && platform.rewardedAvailable && ads.levelCapReached,
    watchAd: () => watchAd(item),
    grant: () => {
      if (item === "undo") lvl.undoCredits += ECONOMY.undoPack.amount;
      else if (item !== "hint") d().inv[item] += 1;
      save.touch();
    },
    onCoinSound: () => sfx.coin(),
  });
  renderHud();
  return granted;
}

// ---------------------------------------------------------------- level flow

function freshLevelState(easier: boolean, freeHint: boolean, finishing: boolean): LevelState {
  ads.newLevel();
  return { undosFree: ECONOMY.freeUndosPerLevel, undoCredits: 0, capped: false, easier, freeHint, touched: false, finishing, extraSlots: 0 };
}

function setupBoard(): void {
  board = newBoard(def);
  history = [];
  mode = "play";
  inFlight = 0;
}

async function startLevel(n: number, opts: { easier?: boolean; override?: LevelDef } = {}): Promise<void> {
  busy = true;
  rollDay();
  playMode = "levels";
  def = opts.override ? { ...opts.override, n } : await getLevel(n);
  setupBoard();
  platform.levelStart();
  colourMap = gadget.mapColours(def.k, n);
  lvl = freshLevelState(!!opts.easier, (restarts.get(n) ?? 0) >= (isStruggling() ? 1 : 2), gadget.canFinishWith(def.boxes.map(colourOf)));
  if (lvl.easier) extraSlot(board);
  view.build(board, colourOf);
  busy = false;
  for (const pu of POWER_UPS) {
    if (n >= pu.unlockLevel && !d().gifted[pu.id]) {
      d().gifted[pu.id] = true;
      d().inv[pu.id] += ECONOMY.freeOnUnlock;
      save.touch();
      setTimeout(() => toast(t("unlocked", { name: t(`pu_${pu.id}`), n: ECONOMY.freeOnUnlock }), 4200), 300);
    }
  }
  if (EN[`tip_${n}`] && (restarts.get(n) ?? 0) === 0) setTimeout(() => toast(t(`tip_${n}`), 5200), 700);
  renderHud();
  renderBench();
  redrawGadget();
  if (started && (def.tag === "tricky" || def.tag === "masterpiece") && !lvl.easier && (restarts.get(n) ?? 0) === 0) await offerBoost();
}

async function offerBoost(): Promise<void> {
  if (!isUnlocked("slot") || !canWatchAd("slot")) return;
  let boost = false;
  await ui.openModal((box, close) => {
    box.innerHTML = `<div class="big-icon">➕</div><h2>${t("boostTitle")}</h2>`;
    box.append(para(t("boostBody")));
    box.append(button(`🎬 ${t("boostYes")}`, "ad", async () => (await watchAd("slot")) && ((boost = true), close())));
    box.append(button(t("boostNo"), "plain", close));
  });
  if (boost) {
    extraSlot(board);
    sfx.power();
    renderBench();
    renderHud();
  }
}

function markTouched(): void {
  if (!lvl.touched) {
    lvl.touched = true;
    platform.gameplayStart();
  }
}

async function onBoltTap(i: number): Promise<void> {
  if (busy || inModal) return;
  markTouched();
  view.setHint(-1);
  if (mode === "magnet") return void toast(t("magnetPrompt"));
  if (!board.boltOn[i]) return;
  if (mode === "drill") return void onDrill(i);
  if (isLocked(board, i)) {
    const lockC = board.def.plates.map((p) => p[6]).find((c, p) => c >= 0 && (board.def.bolts[i][0] === p || board.def.bolts[i][4] === p));
    refuse(i, t("padlocked", { colour: BOLT_COLOURS[colourOf(lockC ?? 0) % BOLT_COLOURS.length].name.toLowerCase() }));
    return;
  }
  if (isCovered(board, i)) {
    refuse(i, coverHintShown++ < 2 ? t("covered") : "");
    return;
  }
  if (routeFor(board, def.bolts[i][2]) === null) {
    refuse(i, t("trayFull"));
    void animateEl($("tray"), [{ background: "#8d949c" }, { background: "#c9604a" }, { background: "#8d949c" }], 600);
    return;
  }
  await doTap(i, false);
}

function refuse(i: number, msg: string): void {
  view.shake(i);
  sfx.bonk();
  haptic("error");
  if (msg) toast(msg, 2600);
}

/** Show the screwdriver over a bolt while it unscrews. */
function showDriver(at: { x: number; y: number }, ms: number): void {
  const el = document.createElement("div");
  el.className = "driver";
  el.innerHTML = `<div class="handle"></div><div class="shaft"></div>`;
  el.style.left = `${at.x}px`;
  el.style.top = `${at.y - 120}px`;
  $("fx-layer").append(el);
  void animateEl(
    el,
    [
      { transform: "translateY(-24px) rotate(-12deg)", opacity: 0 },
      { transform: "translateY(0) rotate(0deg)", opacity: 1, offset: 0.25 },
      { transform: "translateY(0) rotate(10deg)", opacity: 1, offset: 0.55 },
      { transform: "translateY(-10px) rotate(-6deg)", opacity: 1, offset: 0.8 },
      { transform: "translateY(-34px) rotate(0deg)", opacity: 0 },
    ],
    ms,
  ).then(() => el.remove());
}

/** Unscrew bolt i (already checked as allowed, or forced by the Drill) and play it out. */
async function doTap(i: number, forced: boolean): Promise<void> {
  busy = true;
  history.push(cloneBoard(board));
  const from = view.boltClient(i);
  const slotsBefore = board.slots.map((s) => (s ? s.n : 0));
  const res = (forced ? drill(board, i) : tap(board, i))!;
  showDriver(from, forced ? 420 : 380);
  if (forced) sfx.drill();
  else sfx.ratchet();
  haptic("tick");
  await view.unscrew(i, false);
  await playOut(res, from, slotsBefore);
}

/** Everything after a bolt comes out: the swing/drop, the flight to its box or the tray, boxes closing. */
async function playOut(res: TapResult, from: { x: number; y: number }, slotsBefore: number[]): Promise<void> {
  const settle = view.settleTo(board, res);
  if (res.swung.length) sfx.creak();
  if (res.dropped.length) setTimeout(() => sfx.clang(), 250);
  if (res.unlocked.length) setTimeout(() => sfx.unlock(), 200);
  if (res.dropped.length) haptic("heavy");
  const to = res.to >= 0 ? holeClient(res.to, slotsBefore[res.to]) : holeClient(-1, res.trayAt);
  const closing = res.closes.map((c) => ({ slot: c.slot, colour: c.colour }));
  // Show the bench as it was, plus nothing new until the chip lands.
  inFlight++;
  if (closing.length) renderBench(closing, { slot: res.to });
  else renderBench([], res.to >= 0 ? { slot: res.to } : { tray: true });
  renderHud();
  const fly = ui.flyChip(hexOf(res.colour), from, to, 0, "bolt-fly").then(() => {
    inFlight--;
    if (res.to >= 0) sfx.tink(slotsBefore[res.to]);
    else sfx.clunk();
  });
  if (!closing.length) {
    busy = false;
    await fly;
    if (!busy) renderBench();
    await settle;
    await checkEnd();
    return;
  }
  await fly;
  renderBench(closing);
  sfx.lid();
  haptic("success");
  await new Promise((r) => setTimeout(r, 360));
  for (const c of res.closes) await onBoxClosed(c.slot, c.colour);
  renderBench();
  for (const c of res.closes) {
    const el = $("boxes").querySelector<HTMLElement>(`.toolbox[data-slot="${c.slot}"]`);
    if (el && c.nextQ >= 0) el.classList.add("pop");
  }
  renderHud();
  busy = false;
  await settle;
  await checkEnd();
}

/** A closed toolbox tightens a bolt on the gadget (or gives a coin if the gadget doesn't need it). */
async function onBoxClosed(slot: number, colour: number): Promise<void> {
  if (playMode !== "levels") return;
  const from = holeClient(slot, 1);
  const part = gadget.tighten(colourOf(colour));
  if (part >= 0) {
    const r = $("mini-gadget").getBoundingClientRect();
    void ui.flyChip(hexOf(colour), from, { x: r.left + r.width / 2, y: r.top + r.height / 2 }, 0, "bolt-fly").then(redrawGadget);
    d().gadget = gadget.serialize();
  } else {
    d().coins += ECONOMY.coins.fillerBonus;
    ui.floatText(`+${ECONOMY.coins.fillerBonus} 🪙`, from.x, from.y);
  }
  save.touch();
}

async function checkEnd(): Promise<void> {
  if (busy || inFlight > 0) return;
  if (isWon(board)) return void (playMode === "daily" ? winDaily() : winLevel());
  if (isStuck(board)) return void showStuck();
}

// ---------------------------------------------------------------- undo / restart / hint

async function onUndo(): Promise<void> {
  if (busy || inModal) return;
  if (!history.length) return void sfx.bonk();
  if (lvl.undosFree > 0) lvl.undosFree--;
  else if (lvl.undoCredits > 0) lvl.undoCredits--;
  else {
    if (!(await acquire("undo"))) return;
    lvl.undoCredits--;
  }
  board = history.pop()!;
  view.build(board, colourOf);
  sfx.ratchet(true);
  renderBench();
  renderHud();
}

async function onRestart(): Promise<void> {
  if (busy || inModal) return;
  platform.gameplayStop();
  if (playMode === "daily") return void (await startDaily());
  platform.levelFail();
  const r = (restarts.get(def.n) ?? 0) + 1;
  restarts.set(def.n, r);
  if (r >= 3) {
    let easier = false;
    await ui.openModal((box, close) => {
      box.innerHTML = `<h2>${t("restart")}</h2>`;
      box.append(button(t("easierVersion"), "green", () => ((easier = true), close())), button(t("restart"), "plain", close));
    });
    await startLevel(def.n, { easier });
  } else await startLevel(def.n, { easier: lvl.easier });
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
    const res = await solveInWorker(board);
    if (!res.solved || !res.moves.length) toast(t("stuckBody"));
    else view.setHint(res.moves[0]);
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
  if (mode === id) {
    mode = "play";
    renderHud();
    renderBench();
    return;
  }
  if (id === "slot" && lvl.extraSlots >= ECONOMY.maxExtraSlots) return void toast(t("maxSlots"));
  if (id === "oil" && !board.revealed.some((r, i) => !r && board.boltOn[i])) return void toast(t("noRust"));
  if (d().inv[id] <= 0 && !(await acquire(id))) return;
  markTouched();
  view.setHint(-1);
  if (id === "slot") {
    consume(id);
    extraSlot(board);
    lvl.extraSlots++;
    history = [];
    sfx.power();
    haptic("medium");
  } else if (id === "oil") {
    consume(id);
    oilCan(board);
    history = [];
    sfx.power();
  } else {
    mode = id;
    toast(t(id === "drill" ? "drillPrompt" : "magnetPrompt"), 4000);
  }
  renderHud();
  renderBench();
  if (id === "slot" || id === "oil") await checkEnd();
}

function consume(id: PowerUpId): void {
  d().inv[id] = Math.max(0, d().inv[id] - 1);
  if (puInfo(id).capsStars) lvl.capped = true;
  save.touch();
}

async function onDrill(i: number): Promise<void> {
  if (routeFor(board, def.bolts[i][2]) === null) return refuse(i, t("trayFull"));
  consume("drill");
  mode = "play";
  await doTap(i, true);
  history = [];
  renderHud();
}

async function onBoxTap(slot: number): Promise<void> {
  if (busy || inModal || mode !== "magnet" || !board.slots[slot]) return;
  consume("magnet");
  mode = "play";
  busy = true;
  sfx.magnet();
  haptic("heavy");
  history.push(cloneBoard(board));
  const results: Array<{ res: TapResult; from: { x: number; y: number }; before: number[] }> = [];
  // Apply one at a time so each flight starts from the bolt's real position.
  for (let k = 0; k < BOX_SIZE; k++) {
    const before = board.slots.map((s) => (s ? s.n : 0));
    const trial = cloneBoard(board);
    const r = magnet(trial, slot);
    if (!r.length) break;
    const from = view.boltClient(r[0].bolt);
    const res = tap(board, r[0].bolt, true)!;
    results.push({ res, from, before });
    if (res.closes.some((c) => c.slot === slot)) break;
  }
  history = [];
  for (const { res, from, before } of results) {
    await view.unscrew(res.bolt, true);
    busy = true;
    await playOut(res, from, before);
  }
  busy = false;
  renderHud();
  renderBench();
  await checkEnd();
}

// ---------------------------------------------------------------- stuck / win

async function showStuck(): Promise<void> {
  platform.gameplayStop();
  let action: (() => Promise<void>) | null = null;
  await ui.openModal((box, close) => {
    box.innerHTML = `<div class="big-icon">🧰</div><h2>${t("stuckTitle")}</h2>`;
    box.append(para(t("stuckBody")));
    const grid = document.createElement("div");
    grid.className = "stuck-grid";
    const pick = (fn: () => Promise<void>) => () => ((action = fn), close());
    grid.append(
      button(`↶ ${t("undo")}`, "plain", pick(onUndo), !history.length),
      button(`➕ ${t("pu_slot")}`, "green", pick(() => onPowerUp("slot")), !isUnlocked("slot") || lvl.extraSlots >= ECONOMY.maxExtraSlots),
      button(`🔨 ${t("pu_drill")}`, "plain", pick(() => onPowerUp("drill")), !isUnlocked("drill")),
      button(`💡 ${t("hint")}`, "plain", pick(onHint), playMode === "daily" || def.n < 10),
    );
    box.append(grid);
    if (canWatchAd("rescue")) {
      box.append(
        button(`🎬 ${t("pu_slot")} + 2 ${t("undo")}`, "ad", async () => {
          if (await watchAd("rescue")) {
            lvl.undoCredits += 2;
            action = async () => {
              extraSlot(board);
              history = [];
              renderBench();
              renderHud();
            };
            close();
          }
        }),
      );
    }
    if (playMode === "levels" && (restarts.get(def.n) ?? 0) >= 2) box.append(button(t("easierVersion"), "plain", pick(() => startLevel(def.n, { easier: true }))));
    box.append(button(`⟲ ${t("restart")}`, "plain", pick(onRestart)));
  });
  if (action) await (action as () => Promise<void>)();
}

function recordSkill(ratio: number): void {
  d().skill.push(Math.round(ratio * 100) / 100);
  while (d().skill.length > 10) d().skill.shift();
}

function isStruggling(): boolean {
  const s = d().skill;
  return s.length >= 5 && s.reduce((a, b) => a + b, 0) / s.length > 1.6;
}

async function winLevel(): Promise<void> {
  busy = true;
  platform.gameplayStop();
  const n = def.n;
  const stars = lvl.easier ? 1 : starsFor(board.detours, def.par, lvl.capped);
  const firstTry = (restarts.get(n) ?? 0) === 0;
  const coins = levelCoins(n, stars, firstTry, def.tag);
  const prev = d().stars[n] ?? 0;
  if (stars > prev) {
    d().stars[n] = stars;
    d().totalStars += stars - prev;
  }
  d().coins += coins;
  d().level = Math.max(d().level, n + 1);
  d().levelsSinceAd++;
  platform.levelComplete();
  await view.cleared();
  // Catch-up bolt for a part whose colour wasn't in this level.
  if (gadget.topUp(def.boxes.map(colourOf)) >= 0) redrawGadget();
  d().gadget = gadget.serialize();
  const gadgetDone = gadget.complete;
  let reward: PowerUpId | null = null;
  const done = gadget.gadget;
  if (gadgetDone) {
    if (gadget.encore) d().encores++;
    else if (!d().finished.includes(done.id)) {
      d().finished.push(done.id);
      d().crates++;
    }
    const unlocked = POWER_UPS.filter((p) => n >= p.unlockLevel).map((p) => p.id);
    reward = unlocked.length ? unlocked[Math.floor(Math.random() * unlocked.length)] : "slot";
    d().inv[reward]++;
  }
  if ((def.tag === "tricky" || def.tag === "masterpiece") && firstTry && board.detours <= def.par) d().inv.slot++;
  recordSkill((board.detours + 1) / (def.par + 1));
  save.touch();
  await save.flush();
  restarts.delete(n);
  if ((stars === 3 && firstTry) || gadgetDone) platform.happyTime();
  if (gadgetDone) sfx.gadget();
  else sfx.win();
  haptic(gadgetDone ? "celebrate" : "success");
  let doubled = false;
  await ui.openModal((box, close) => {
    box.innerHTML = `<h2>${gadgetDone ? t("gadgetComplete") : t("levelComplete")}</h2>`;
    box.append(starsRow(stars));
    const gc = document.createElement("canvas");
    gc.className = gadgetDone ? "gadget-big" : "gadget-mid";
    box.append(gc);
    if (gadgetDone) animateCanvas(gc, (c, tt) => drawGadget(c, done, "full", { t: tt, glow: true }));
    else requestAnimationFrame(() => drawGadget(gc, done, gadget.filled, { paper: true }));
    box.append(para(gadgetDone ? `${done.name} · +1 ${t(`pu_${reward}`)}` : t("gadgetProgress", { done: gadget.done, total: gadget.total })));
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
  if (interstitialDue(ECONOMY.interstitial, n, d().levelsSinceAd, { noAds: d().noAds, justRewarded: doubled, celebration: gadgetDone })) {
    sfx.synth.setHostSuspended(true);
    const shown = await platform.interstitial(ECONOMY.interstitial.minGapSec);
    sfx.synth.setHostSuspended(false);
    if (shown) d().levelsSinceAd = 0;
  }
  if (gadgetDone) {
    if (d().crates > 0) await openCrate(done.room);
    const before = gadget.gadget.room;
    const next = nextGadget(d().finished, d().totalStars, d().encores);
    gadget = new GadgetProgress(next.index, [], next.encore);
    d().gadget = gadget.serialize();
    if (!next.encore && gadget.gadget.room !== before && !d().roomsDone.includes(ROOMS[gadget.gadget.room].id)) {
      setTimeout(() => toast(t("roomUnlocked", { name: t(`room_${ROOMS[gadget.gadget.room].id}`) }), 4000), 600);
    }
  }
  save.touch();
  busy = false;
  await startLevel(n + 1);
}

/** Run a draw function every frame while the canvas is in the page. */
function animateCanvas(c: HTMLCanvasElement, draw: (c: HTMLCanvasElement, t: number) => void): void {
  const t0 = performance.now();
  const step = () => {
    if (!c.isConnected && performance.now() - t0 > 500) return;
    draw(c, (performance.now() - t0) / 1000);
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
  setTimeout(() => draw(c, 0.5), 60);
}

// ---------------------------------------------------------------- decor and rooms

/** The next empty decor spot in a room, or null when all are placed. */
function nextSpot(roomIdx: number): DecorSpot | null {
  const placed = d().decor[ROOMS[roomIdx].id] ?? {};
  return DECOR_SPOTS.find((s) => placed[s] === undefined) ?? null;
}

/** Decor Crate: choose one of two styles for the next empty spot in the gadget's room. */
async function openCrate(roomIdx: number): Promise<void> {
  const spot = nextSpot(roomIdx);
  if (!spot) {
    d().crates = Math.max(0, d().crates - 1);
    return;
  }
  const rng = new Rng(seedOf(d().finished.length, roomIdx, "crate"));
  const unowned = Array.from({ length: DECOR_STYLES }, (_, s) => s).filter((s) => !d().decorOwned.includes(decorId(spot, s)));
  const pool = rng.shuffle(unowned.length >= 2 ? unowned : Array.from({ length: DECOR_STYLES }, (_, s) => s));
  const choices = pool.slice(0, 2);
  let picked = choices[0];
  sfx.power();
  await ui.openModal((box, close) => {
    box.innerHTML = `<div class="big-icon">🎁</div><h2>${t("decorCrate")}</h2>`;
    box.append(para(t("decorCrateBody", { spot: t(`spot_${spot}`) })));
    const wrap = document.createElement("div");
    wrap.className = "decor-choice";
    for (const s of choices) {
      const b = document.createElement("button");
      const c = document.createElement("canvas");
      b.append(c);
      b.addEventListener("click", () => {
        picked = s;
        close();
      });
      wrap.append(b);
      requestAnimationFrame(() => drawDecorPreview(c, spot, s, roomIdx));
    }
    box.append(wrap);
  });
  const rid = ROOMS[roomIdx].id;
  d().decor[rid] = { ...(d().decor[rid] ?? {}), [spot]: picked };
  if (!d().decorOwned.includes(decorId(spot, picked))) d().decorOwned.push(decorId(spot, picked));
  d().crates = Math.max(0, d().crates - 1);
  sfx.coin();
  save.touch();
  await showRoom(roomIdx, spot);
  await checkRoomComplete(roomIdx);
}

async function checkRoomComplete(roomIdx: number): Promise<void> {
  const rid = ROOMS[roomIdx].id;
  if (d().roomsDone.includes(rid)) return;
  if (!roomsWithAllGadgets(d().finished).includes(rid) || nextSpot(roomIdx)) return;
  d().roomsDone.push(rid);
  const skin = roomReward(rid);
  if (skin && !d().cosmetics.owned.includes(skin.id)) d().cosmetics.owned.push(skin.id);
  save.touch();
  platform.happyTime();
  sfx.gadget();
  await ui.openModal((box, close) => {
    box.innerHTML = `<div class="big-icon">🏆</div><h2>${t("roomComplete")}</h2>`;
    box.append(para(t(`room_${rid}`)));
    const c = document.createElement("canvas");
    c.className = "room-big";
    box.append(c);
    animateCanvas(c, (cv, tt) => drawRoom(cv, roomIdx, d().finished, d().decor[rid] ?? {}, { t: tt }));
    if (skin) {
      const sw = document.createElement("div");
      sw.className = "skin-reward";
      sw.innerHTML = `<span class="swatch" style="background:${skin.swatch}"></span><b>${t("rewardSkin", { name: t(skin.id) })}</b>`;
      box.append(sw, button(t("equip"), "green", () => (equip(skin.id), close())));
    }
    box.append(button(`${t("next")} ▸`, "", close));
  });
}

/** The workshop: the current gadget, the room tabs, the room picture, and restyling decor. */
function showRoom(roomIdx = gadget.gadget.room, highlight: DecorSpot | null = null): Promise<void> {
  return ui.openModal(
    (box, close) => {
      const draw = () => {
        box.innerHTML = `<h2>${t("workshop")}</h2>`;
        const tabs = document.createElement("div");
        tabs.className = "room-tabs";
        ROOMS.forEach((r, i) => {
          const open = roomOpen(i, d().totalStars);
          const b = document.createElement("button");
          b.textContent = open ? t(`room_${r.id}`) : `🔒 ${ROOM_STARS[i]}★`;
          b.disabled = !open;
          b.classList.toggle("on", i === roomIdx);
          b.addEventListener("click", () => {
            roomIdx = i;
            highlight = null;
            draw();
          });
          tabs.append(b);
        });
        box.append(tabs);
        const rid = ROOMS[roomIdx].id;
        const c = document.createElement("canvas");
        c.className = "room-big";
        box.append(c);
        animateCanvas(c, (cv, tt) => drawRoom(cv, roomIdx, d().finished, d().decor[rid] ?? {}, { t: tt, highlight, showEmpty: true }));
        const doneCount = gadgetsOfRoom(roomIdx).filter((g) => d().finished.includes(g.id)).length;
        box.append(para(`${doneCount}/8 · ${t("roomOpenSign")}`));
        if (gadget.gadget.room === roomIdx) {
          const gc = document.createElement("canvas");
          gc.className = "gadget-mid";
          box.append(gc, para(`${gadget.gadget.name} · ${t("gadgetProgress", { done: gadget.done, total: gadget.total })}`));
          requestAnimationFrame(() => drawGadget(gc, gadget.gadget, gadget.filled, { paper: true }));
        }
        // Restyle placed decor.
        const placed = d().decor[rid] ?? {};
        const spots = DECOR_SPOTS.filter((s) => placed[s] !== undefined);
        if (spots.length) {
          const list = document.createElement("div");
          list.className = "spot-list";
          for (const s of spots) list.append(button(t(`spot_${s}`), "", () => void restyle(roomIdx, s).then(draw)));
          box.append(list);
        }
        if (d().crates > 0 && nextSpot(roomIdx)) box.append(button(`🎁 ${t("decorCrate")}`, "green", () => (close(), void openCrate(roomIdx))));
        box.append(para(t("totalStars", { n: d().totalStars })), button(t("close"), "plain", close));
      };
      draw();
    },
    { dismissable: true },
  );
}

async function restyle(roomIdx: number, spot: DecorSpot): Promise<void> {
  const rid = ROOMS[roomIdx].id;
  await ui.openModal(
    (box, close) => {
      box.innerHTML = `<h2>${t("decorRestyle", { spot: t(`spot_${spot}`) })}</h2>`;
      const wrap = document.createElement("div");
      wrap.className = "decor-choice";
      for (let s = 0; s < DECOR_STYLES; s++) {
        const owned = d().decorOwned.includes(decorId(spot, s));
        const b = document.createElement("button");
        const c = document.createElement("canvas");
        const lab = document.createElement("div");
        lab.className = "tagline";
        lab.textContent = d().decor[rid]?.[spot] === s ? t("equipped") : owned ? t("decorOwned") : `🪙 ${ECONOMY.decorPrice}`;
        b.append(c, lab);
        b.addEventListener("click", () => {
          if (!owned) {
            if (d().coins < ECONOMY.decorPrice) return void toast(t("buyNone"));
            d().coins -= ECONOMY.decorPrice;
            d().decorOwned.push(decorId(spot, s));
            sfx.coin();
          }
          d().decor[rid] = { ...(d().decor[rid] ?? {}), [spot]: s };
          save.touch();
          renderHud();
          close();
        });
        wrap.append(b);
        requestAnimationFrame(() => drawDecorPreview(c, spot, s, roomIdx));
      }
      box.append(wrap, button(t("close"), "plain", close));
    },
    { dismissable: true },
  );
}

// ---------------------------------------------------------------- cosmetics & shop

function applyCosmetics(): void {
  const c = d().cosmetics;
  const drv = cosmetic(c.driver).driver ?? cosmetic(DEFAULT_EQUIPPED.driver).driver!;
  const fin = cosmetic(c.finish).finish ?? 0;
  const brd = cosmetic(c.board).board ?? cosmetic(DEFAULT_EQUIPPED.board).board!;
  view.applyFinish({ plate: fin, board: brd.kind, boardHex: brd.hex });
  document.body.style.background = brd.bg;
  document.body.dataset.board = c.board.replace("board_", "");
  const root = document.documentElement.style;
  root.setProperty("--handle", drv.handle);
  root.setProperty("--grip", drv.grip);
  root.setProperty("--shaft", drv.shaft);
}

function equip(id: string): void {
  if (!d().cosmetics.owned.includes(id)) return;
  d().cosmetics[cosmetic(id).slot] = id;
  save.touch();
  applyCosmetics();
}

function showShop(): void {
  if (d().level <= ECONOMY.shopLevel) return void toast(t("shopLocked", { n: ECONOMY.shopLevel }));
  const ex = appExtras;
  const tabs: Array<{ id: CosmeticSlot; label: string }> = [
    { id: "driver", label: t("shopDriver") },
    { id: "finish", label: t("shopFinish") },
    { id: "board", label: t("shopBoard") },
  ];
  void forgeShowShop(ui, {
    tabs,
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
    albumLabel: (id) => t(`room_${id}`),
    extraTab: ex
      ? {
          id: "store",
          label: t("storeTab"),
          render: (box, grid) => {
            for (const p of ex.PRODUCTS) {
              const info = ex.productInfo(p.id);
              const card = document.createElement("div");
              card.className = "shop-card";
              card.innerHTML = `<span class="swatch" style="background:radial-gradient(circle,#ffd29a,#e0702a)"></span><span class="name">${t(p.id)}</span>`;
              const owned = (p.id === "unbolted_remove_ads" && d().noAds) || (!p.consumable && info?.owned);
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
    case "unbolted_remove_ads":
      d().noAds = true;
      break;
    case "unbolted_starter_pack":
      d().coins += 2000;
      for (const k of Object.keys(inv) as PowerUpId[]) inv[k] += 3;
      break;
    case "unbolted_coins_small":
      d().coins += 1000;
      break;
    case "unbolted_coins_medium":
      d().coins += 3000;
      break;
    case "unbolted_coins_large":
      d().coins += 8000;
      break;
    case "unbolted_powerup_bundle":
      inv.slot += 5;
      inv.oil += 3;
      inv.drill += 2;
      inv.magnet += 2;
      break;
    case "unbolted_cosmetics_all":
      for (const c of COSMETICS) if (!d().cosmetics.owned.includes(c.id)) d().cosmetics.owned.push(c.id);
      break;
  }
  save.touch();
  sfx.coin();
  if (busy || !started) return;
  renderHud();
}

// ---------------------------------------------------------------- Daily Teardown

async function startDaily(): Promise<void> {
  busy = true;
  rollDay();
  const day = utcDayKey();
  toast(t("loadingDaily"), 1500);
  def = await getDaily(day);
  playMode = "daily";
  setupBoard();
  const rng = new Rng(seedOf(day, "daily-colours"));
  colourMap = rng.shuffle(BOLT_COLOURS.map((_, i) => i)).slice(0, def.k);
  lvl = freshLevelState(false, false, false);
  view.build(board, colourOf);
  busy = false;
  renderHud();
  renderBench();
}

function dailyColour(day: string): string {
  return BOLT_COLOURS[new Rng(seedOf(day, "calendar")).int(0, BOLT_COLOURS.length - 1)].hex;
}

function drawBoltIcon(g: CanvasRenderingContext2D, x: number, y: number, s: number, hex: string): void {
  g.fillStyle = "#c9ced6";
  g.beginPath();
  g.arc(x + s / 2, y + s / 2, s * 0.45, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = hex;
  g.beginPath();
  g.arc(x + s / 2, y + s / 2, s * 0.32, 0, Math.PI * 2);
  g.fill();
}

async function showDailyCard(justWon = false): Promise<void> {
  const next = await forgeDailyCard(ui, {
    icon: "🔩",
    state: d().daily,
    level: d().level,
    unlockAfter: ECONOMY.dailyLevel,
    inDaily: playMode === "daily",
    justWon,
    rewardedAvailable: platform.rewardedAvailable,
    shareText: (day, r) => dailyShareText("Unbolted", "🔩", day, r, currentStreak(d().daily, day)),
    colourOfDay: dailyColour,
    patch: drawBoltIcon,
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
  const stars = starsFor(board.detours, def.par, false);
  if (recordDailyWin(d().daily, day, { moves: board.detours, par: def.par, stars })) {
    const coins = 40 + 10 * stars;
    d().coins += coins;
    setTimeout(() => toast(`+${coins} 🪙`), 300);
    if (d().daily.streak % ECONOMY.streakBonusEvery === 0) {
      d().inv.magnet++;
      setTimeout(() => toast(t("dailyBonus"), 4000), 2200);
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

// ---------------------------------------------------------------- menus

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
      { label: t("colorblind"), get: () => d().settings.colorblind, set: (v) => ((d().settings.colorblind = v), view.setSymbols(v), renderBench()) },
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
      button(`🧰 ${t("workshop")}`, "plain", () => (close(), void showRoom())),
      button(t("resetProgress"), "plain", async () => {
        if (!confirm(t("resetConfirm"))) return;
        await save.reset();
        gadget = new GadgetProgress(0);
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
    const gc = document.createElement("canvas");
    gc.className = "gadget-mid";
    el.append(gc);
    const leave = () => {
      unlockAudio();
      el.remove();
      inModal = ui.modalOpen;
      resolve();
    };
    el.append(button(n > 1 ? t("continueLevel", { n }) : t("play"), "", leave));
    el.append(button(`🔩 ${t("daily")}${d().daily.results[utcDayKey()] ? " ✓" : ""}`, "plain", () => (leave(), void showDailyCard())));
    $("modal-root").append(el);
    inModal = true;
    requestAnimationFrame(() => drawGadget(gc, gadget.gadget, gadget.filled, { paper: true }));
  });
}

// ---------------------------------------------------------------- input

function bindInput(): void {
  const canvas = $<HTMLCanvasElement>("board");
  canvas.addEventListener("pointerdown", (e) => {
    unlockAudio();
    if (busy || inModal) return;
    const i = view.pickBolt(e.clientX, e.clientY);
    if (i >= 0) void onBoltTap(i);
  });
  $("btn-undo").addEventListener("click", () => void onUndo());
  $("btn-restart").addEventListener("click", () => void onRestart());
  $("btn-hint").addEventListener("click", () => void onHint());
  $("btn-menu").addEventListener("click", showSettings);
  $("btn-daily").addEventListener("click", () => !busy && !inModal && void showDailyCard());
  $("coins").addEventListener("click", () => !busy && !inModal && showShop());
  $("side-shop").addEventListener("click", () => !busy && !inModal && showShop());
  $("side-daily").addEventListener("click", () => !busy && !inModal && void showDailyCard());
  $("mini-gadget-btn").addEventListener("click", () => !inModal && void showRoom());
  $("side-gadget-btn").addEventListener("click", () => !inModal && void showRoom());
  window.addEventListener("wheel", (e) => e.preventDefault(), { passive: false });
  window.addEventListener("keydown", (e) => {
    if ([" ", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "PageUp", "PageDown"].includes(e.key) && !(e.target instanceof HTMLSelectElement)) e.preventDefault();
    unlockAudio();
    if (inModal || e.repeat) return;
    const k = e.key.toLowerCase();
    if (k === "z") return void onUndo();
    const pu = POWER_UPS.find((p) => p.key === k);
    if (pu) return void onPowerUp(pu.id);
  });
}

// ---------------------------------------------------------------- boot

async function boot(): Promise<void> {
  registerStrings("en", EN);
  registerTranslations();
  platform.loadingProgress(0.1);
  await platform.init();
  setLanguage(detectLanguage(platform.language(), !platform.hostControlsVisibility));
  save = new SaveSlot<SaveData>(platform.storage, { key: "unbolted", version: SAVE_VERSION, defaults: defaultSave });
  await save.load();
  platform.loadingProgress(0.4);
  if (import.meta.env.DEV) {
    const q = new URLSearchParams(location.search);
    if (q.get("fresh")) await save.reset();
    if (q.get("level")) d().level = Number(q.get("level"));
    if (q.get("coins")) d().coins = Number(q.get("coins"));
    if (q.get("def")) devDef = JSON.parse(atob(q.get("def")!)) as LevelDef;
    (window as unknown as Record<string, unknown>).__unb = {
      get board() { return board; },
      get def() { return def; },
      get view() { return view; },
      get gadget() { return gadget; },
      get busy() { return busy; },
      save,
      platform,
      startLevel,
      tap: (i: number) => onBoltTap(i),
      power: (id: PowerUpId) => onPowerUp(id),
      box: (s: number) => onBoxTap(s),
      undo: () => onUndo(),
      showRoom,
      openCrate,
      /** Dev: finish every running animation now (the pane may be hidden). */
      drain: () => view.tweens.finishAll(),
      /** Dev: save the current board as a PNG (press/<name>.png) at w x h pixels. */
      shot: async (name: string, w = 1080, h = 1920) => {
        const canvas = view.renderer.domElement;
        const prev = { w: canvas.clientWidth, h: canvas.clientHeight, dpr: view.renderer.getPixelRatio() };
        view.renderer.setPixelRatio(1);
        view.resize(w, h);
        view.setSafeArea(h * 0.06, h * 0.06);
        view.tweens.finishAll();
        view.render(0.016);
        const base64 = canvas.toDataURL("image/png").split(",")[1];
        view.renderer.setPixelRatio(prev.dpr);
        view.resize(prev.w, prev.h);
        return (await fetch(`/__save?path=press/${name}.png`, { method: "POST", body: JSON.stringify({ base64 }) })).text();
      },
    };
  }
  if (d().settings.lang) setLanguage(d().settings.lang);
  // Phone app only: purchases and the daily reminder (never part of web builds).
  if (import.meta.env.VITE_PLATFORM === "app") {
    appExtras = await import("./game/app-extras.ts");
    await appExtras.initStore(grantProduct).catch((err) => console.warn("[unbolted] store unavailable", err));
  }
  sfx.synth.setMuted(!d().settings.sound);
  setHapticsEnabled(d().settings.haptics);
  music.setEnabled(d().settings.music);
  gadget = new GadgetProgress(d().gadget.index, d().gadget.filled, d().gadget.encore);
  view = new WorkshopView($<HTMLCanvasElement>("board"));
  view.setSymbols(d().settings.colorblind);
  applyCosmetics();
  const resize = () => {
    const wide = window.innerWidth >= 760 && window.innerWidth / window.innerHeight > 1.15;
    document.body.classList.toggle("wide", wide);
    const canvas = $<HTMLCanvasElement>("board");
    view.resize(canvas.clientWidth, canvas.clientHeight);
    const cr = canvas.getBoundingClientRect();
    view.setSafeArea(Math.max(0, $("hud-sub").getBoundingClientRect().bottom - cr.top + 6), Math.max(0, cr.bottom - $("bench").getBoundingClientRect().top + 6));
    redrawGadget();
  };
  window.addEventListener("resize", resize);
  bindInput();
  const loop = new Loop((dt) => view.render(dt));
  platform.on("pause", () => {
    loop.setPaused(true);
    sfx.synth.setHostSuspended(true);
    void save.flush();
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
  let loaded = false;
  const markLoaded = () => {
    if (loaded) return;
    loaded = true;
    platform.firstFrame();
    platform.loadingDone();
    $("loading").classList.add("done");
  };
  requestAnimationFrame(markLoaded);
  setTimeout(markLoaded, 1500); // a hidden tab never runs requestAnimationFrame
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
  $("loading").innerHTML = `<p style="padding:20px;text-align:center">Something went wrong loading Unbolted.<br>${String(err)}</p>`;
});

void GADGETS;
