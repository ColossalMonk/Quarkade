// Koi Out: game controller. Rules + pond view + forge UI shell + coach + platform (ads, saves).

import "./style.css";
import { Platform } from "../../../forge/src/platform/platform.ts";
import { SaveSlot } from "../../../forge/src/core/save.ts";
import { Loop } from "../../../forge/src/core/loop.ts";
import { haptic, setHapticsEnabled } from "../../../forge/src/core/haptics.ts";
import { registerStrings, detectLanguage, setLanguage, t } from "../../../forge/src/core/i18n.ts";
import { Rng, seedOf, utcDayKey } from "../../../forge/src/core/rng.ts";
import { Music } from "../../../forge/src/core/music.ts";
import { Ui, starsRow, para } from "../../../forge/src/ui/ui.ts";
import { Coach, showHowToPlay, tipsUpTo } from "../../../forge/src/ui/coach.ts";
import { AdBudget, interstitialDue } from "../../../forge/src/ui/ads.ts";
import { buyCard } from "../../../forge/src/ui/buy-card.ts";
import { showDailyCard as forgeDailyCard, recordDailyWin, currentStreak, dailyShareText } from "../../../forge/src/ui/daily.ts";
import { showShop as forgeShowShop } from "../../../forge/src/ui/shop.ts";
import { showSettings as forgeShowSettings } from "../../../forge/src/ui/settings.ts";
import type { Board, Dir, LevelDef } from "./logic/rules.ts";
import { HEARTS, canTurn, cloneBoard, freeKoi, isOutOfHearts, isWon, koiLeft, netKoi, newBoard, tapKoi, turnKoi } from "./logic/rules.ts";
import { INTRO } from "./logic/generator.ts";
import { getDaily, getLevel, hintInWorker } from "./game/levels.ts";
import { JournalProgress, nextPage, regionOpen } from "./game/journal.ts";
import { defaultSave, SAVE_VERSION } from "./game/save.ts";
import type { SaveData } from "./game/save.ts";
import { ECONOMY, POWER_UPS, levelCoins, starsFor } from "./data/economy.ts";
import type { PowerUpId } from "./data/economy.ts";
import { COSMETICS, DEFAULT_EQUIPPED, cosmetic, regionReward } from "./data/cosmetics.ts";
import type { CosmeticSlot } from "./data/cosmetics.ts";
import { REGIONS, REGION_STARS, VARIETIES, varietiesOfRegion } from "./data/varieties.ts";
import { EN } from "./data/strings.ts";
import { LANGUAGES, registerTranslations } from "./data/i18n/index.ts";
import { PondView } from "./view/pond.ts";
import { drawJourney, drawKoi } from "./view/draw.ts";
import { Sfx, GARDEN_SONG } from "./view/sfx.ts";

type ItemId = PowerUpId | "hint";
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const DAILY_POWER_UPS: PowerUpId[] = ["glow"];
/** App build only (purchases, reminder); null on the web. */
let appExtras: typeof import("./game/app-extras.ts") | null = null;

// ---------------------------------------------------------------- state

const platform = new Platform();
const sfx = new Sfx();
const music = new Music(sfx.synth, GARDEN_SONG);
let inModal = false;
const ui = new Ui({ modalRoot: $("modal-root"), toast: $("toast"), fxLayer: $("fx-layer") });
ui.onModalChange = (open) => (inModal = open);
const coach = new Coach(ui, { root: $("app"), blocked: () => inModal });
let save!: SaveSlot<SaveData>;
let journal!: JournalProgress;
let view!: PondView;
let def!: LevelDef;
let board!: Board;
/** Which variety (index into VARIETIES) each koi is. */
let varietyOf: number[] = [];
let history: Board[] = [];
let mode: "play" | "net" | "bread" | "breadDir" = "play";
let breadKoi = -1;
let busy = false;
let started = false;
let playMode: "levels" | "daily" = "levels";
let devDef: LevelDef | null = null;
/** Koi mid-animation (taps on them are ignored). */
const moving = new Set<number>();

interface LevelState {
  capped: boolean;
  easier: boolean;
  freeHint: boolean;
  touched: boolean;
  finishing: boolean;
  /** Extra hearts from Lotus, the boost or the easier version. */
  lotus: number;
  heartAds: number;
  won: boolean;
}
let lvl!: LevelState;
const restarts = new Map<number, number>();

const ads = new AdBudget({
  perLevel: ECONOMY.rewardedPerLevel,
  perDay: ECONOMY.rewardedPerDay,
  item: (id) => {
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

// ---------------------------------------------------------------- HUD

function renderHud(hit = false): void {
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
          : def.tag === "dragon"
            ? t("tag_dragon")
            : def.tag === "breather"
              ? t("tag_breather")
              : "";
  if (def.tag === "breather") tag.classList.add("breather");
  if (lvl.finishing) tag.classList.add("finishing");
  $("coin-count").textContent = String(d().coins);
  $("koi-left").textContent = t("koiLeft", { n: koiLeft(board) });
  // Hearts: the three, plus any Lotus hearts.
  const hearts = $("hearts");
  const total = HEARTS + lvl.lotus;
  hearts.innerHTML = "";
  for (let i = 0; i < total; i++) {
    const el = document.createElement("i");
    el.textContent = i >= HEARTS ? "🪷" : "❤️";
    if (i >= HEARTS) el.className = "lotus";
    if (i >= board.hearts) el.classList.add("off");
    if (hit && i === board.hearts) el.classList.add("hit");
    hearts.append(el);
  }
  $("btn-hint").hidden = playMode === "daily" || def.n < 10;
  const freeHints = (lvl.freeHint ? 1 : 0) + (d().day.freeHintUsed ? 0 : 1);
  $("hint-count").textContent = freeHints ? String(freeHints) : "";
  $("btn-daily").classList.toggle("done", !!d().daily.results[utcDayKey()]);
  $("side-daily").textContent = `🎏 ${t("dailyShort")}`;
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
  for (const [elId, key] of [["btn-menu", "settings"], ["btn-daily", "daily"], ["btn-undo", "undo"], ["btn-hint", "hint"], ["btn-restart", "restart"], ["mini-display-btn", "journal"], ["side-display-btn", "journal"]]) {
    document.getElementById(elId)?.setAttribute("aria-label", t(key));
  }
  for (const b of [...wrap.children] as HTMLButtonElement[]) {
    const id = b.dataset.id as PowerUpId;
    b.setAttribute("aria-label", t(`pu_${id}`));
    const unlocked = isUnlocked(id);
    const badge = b.querySelector("b")!;
    b.classList.toggle("locked", !unlocked);
    b.classList.toggle("active", mode === id || (id === "bread" && mode === "breadDir"));
    badge.className = "";
    if (!unlocked) badge.textContent = "🔒";
    else if (d().inv[id] > 0) badge.textContent = String(d().inv[id]);
    else {
      badge.textContent = "+";
      badge.className = "plus";
    }
  }
}

/** The current journal page: compact (HUD) or full (modals, side panel). */
function journalHtml(jp: JournalProgress, full: boolean): string {
  const region = REGIONS[jp.page];
  const pct = Math.round((100 * jp.done) / jp.total);
  if (!full) return `<span class="ic">${region.icon}</span><span class="bar"><i style="width:${pct}%"></i></span><span class="num">${pct}%</span>`;
  return `<div class="display-full"><div class="head"><span>${region.icon}</span><span>${t(`region_${region.id}`)}</span></div><div class="row"><span class="ic">🎏</span><span class="bar"><i style="width:${pct}%"></i></span><span class="n">${pct}%</span></div></div>`;
}

function redrawJournal(): void {
  $("mini-display-btn").innerHTML = journalHtml(journal, false);
  if (document.body.classList.contains("wide")) {
    $("side-display-btn").innerHTML = journalHtml(journal, true);
    $("side-sub").textContent = `${journal.encore ? `${t("encore")} · ` : ""}${t("journalProgress", { done: journal.done, total: journal.total })}`;
    $("side-stars").textContent = t("totalStars", { n: d().totalStars });
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
  const price = item === "hint" ? ECONOMY.hint.price : puInfo(item).price;
  const ic = item === "hint" ? "💡" : puInfo(item).icon;
  const adOk = canWatchAd(item);
  const granted = await buyCard(ui, {
    icon: ic,
    title: t("buyTitle", { name: t(`pu_${item}`) }),
    desc: t(`pu_${item}_desc`),
    price,
    coins: () => d().coins,
    spend: (n) => (d().coins -= n),
    canWatchAd: adOk,
    limitReached: !adOk && platform.rewardedAvailable && ads.levelCapReached,
    watchAd: () => watchAd(item),
    grant: () => {
      if (item !== "hint") d().inv[item] += 1;
      save.touch();
    },
    onCoinSound: () => sfx.coin(),
  });
  renderHud();
  return granted;
}

// ---------------------------------------------------------------- level flow

function freshLevelState(easier: boolean, freeHint: boolean): LevelState {
  ads.newLevel();
  return { capped: false, easier, freeHint, touched: false, finishing: false, lotus: 0, heartAds: 0, won: false };
}

function setupBoard(level: LevelDef, levelNumber: number, jp: JournalProgress): void {
  def = level;
  board = newBoard(def);
  history = [];
  mode = "play";
  moving.clear();
  varietyOf = jp.mapVarieties(def.koi.length, levelNumber);
}

function addHeart(): void {
  board.hearts++;
  lvl.lotus++;
}

async function startLevel(n: number, opts: { easier?: boolean; override?: LevelDef } = {}): Promise<void> {
  busy = true;
  rollDay();
  playMode = "levels";
  setupBoard(opts.override ? { ...opts.override, n } : await getLevel(n), n, journal);
  platform.levelStart();
  lvl = freshLevelState(!!opts.easier, (restarts.get(n) ?? 0) >= (isStruggling() ? 1 : 2));
  lvl.finishing = canFinishPage();
  if (lvl.easier) addHeart();
  view.build(board, varietyOf);
  busy = false;
  coach.clear();
  for (const pu of POWER_UPS) {
    if (n >= pu.unlockLevel && !d().gifted[pu.id]) {
      d().gifted[pu.id] = true;
      d().inv[pu.id] += ECONOMY.freeOnUnlock;
      save.touch();
      coach.unlock(pu.icon, t(`pu_${pu.id}`), t(`pu_${pu.id}_desc`), ECONOMY.freeOnUnlock, $("powerups").querySelector<HTMLElement>(`[data-id="${pu.id}"]`));
    }
  }
  const firstTry = (restarts.get(n) ?? 0) === 0;
  if (EN[`tip_${n}`] && firstTry) coach.tip(t(`tip_${n}`), { point: introPoint(n) });
  if (n === 1 && firstTry) coach.pointAt(firstMovePoint);
  if (lvl.freeHint && (restarts.get(n) ?? 0) === (isStruggling() ? 1 : 2)) coach.tip(t("freeHint"));
  renderHud();
  redrawJournal();
  if (started && (def.tag === "tricky" || def.tag === "dragon") && !lvl.easier && firstTry) await offerBoost();
}

/** Would freeing every koi in this level finish the journal page? ("Last Sighting".) */
function canFinishPage(): boolean {
  const jp = new JournalProgress(journal.page, journal.filled, journal.encore);
  for (const v of varietyOf) jp.sight(v);
  return jp.complete && !journal.complete;
}

/** Level 1: the hand points at the koi to free next. */
function firstMovePoint(): { x: number; y: number } | null {
  if (busy || playMode !== "levels" || def.n !== 1) return null;
  const next = def.sol.find((i) => !board.out[i]);
  return next === undefined ? null : view.koiClient(next);
}

/** Where the hand points while an intro level's tip is up: the new thing. */
function introPoint(n: number): (() => { x: number; y: number } | null) | undefined {
  const live = (fn: () => { x: number; y: number } | null) => () => (busy || def.n !== n ? null : fn());
  if (n === 2 || n === 3) return live(() => view.koiClient(def.sol.find((i) => !board.out[i]) ?? 0));
  if (n === 4 || n === INTRO.long) return live(() => view.koiClient(Math.max(0, def.koi.findIndex((k, i) => !board.out[i] && k.c.length >= (n === 4 ? 2 : 3)))));
  if (n === INTRO.pads && def.pads?.length) return live(() => view.cellClient(def.pads![0]));
  if (n === INTRO.whirls && def.whirls?.length) return live(() => view.cellClient(def.whirls![0]));
  if (n === INTRO.frogs && def.frogs?.length) return live(() => view.cellClient(def.frogs![0][0]));
  if (n === INTRO.currents && def.currents?.length) return live(() => view.cellClient(def.currents![0][0]));
  if (n === INTRO.reeds && def.reeds?.length) return live(() => view.cellClient(Math.floor(def.reeds![0] / 4)));
  return undefined;
}

function showHelp(): Promise<void> {
  const level = Math.max(d().level, playMode === "levels" ? def.n : 1);
  // Tips 8, 15 and 40 only restate a power-up; the power-up section covers those.
  const tips = tipsUpTo(EN, level, 10, [8, 15, 40]);
  return showHowToPlay(ui, [
    { title: t("htpBasics"), items: tips.basics.map((text) => ({ icon: "🎏", text })) },
    { title: t("htpPowerUps"), items: POWER_UPS.filter((p) => level >= p.unlockLevel || d().gifted[p.id]).map((p) => ({ icon: p.icon, title: t(`pu_${p.id}`), text: t(`pu_${p.id}_desc`) })) },
    { title: t("htpTwists"), items: tips.twists.map((text) => ({ icon: "✨", text })) },
  ]);
}

async function offerBoost(): Promise<void> {
  if (!canWatchAd("boost")) return;
  let boost = false;
  await ui.openModal((box, close) => {
    box.innerHTML = `<div class="big-icon">🪷</div><h2>${t("boostTitle")}</h2>`;
    box.append(para(t("boostBody")));
    box.append(button(`🎬 ${t("boostYes")}`, "ad", async () => (await watchAd("boost")) && ((boost = true), close())));
    box.append(button(t("boostNo"), "plain", close));
  });
  if (boost) {
    addHeart();
    sfx.power();
    renderHud();
  }
}

function markTouched(): void {
  if (!lvl.touched) {
    lvl.touched = true;
    platform.gameplayStart();
  }
}

// ---------------------------------------------------------------- input

function onPondTap(clientX: number, clientY: number): void {
  unlockAudio();
  if (busy || inModal || lvl.won) return;
  if (mode === "breadDir") return onBreadDirection(clientX, clientY);
  const i = view.pick(clientX, clientY);
  if (i < 0 || moving.has(i) || board.out[i]) return;
  markTouched();
  if (mode === "net") return void onNet(i);
  if (mode === "bread") {
    breadKoi = i;
    mode = "breadDir";
    sfx.pick();
    toast(t("breadWhere"), 3000);
    view.glow([i], 30);
    renderHud();
    return;
  }
  tap(i);
}

/** Tap koi i: it swims out, or bumps back and costs a heart. */
function tap(i: number): void {
  const before = cloneBoard(board);
  const res = tapKoi(board, i);
  if (!res) return;
  coach.stopPointing();
  moving.add(i);
  if (res.ok) {
    history.push(before);
    sfx.swish(def.koi[i].c.length);
    haptic("light");
    if (def.whirls) {
      view.reaim(board);
      if (def.koi.some((k, j) => !board.out[j] && k.c.length === 1 && def.whirls!.includes(k.c[0]))) sfx.swirl();
    }
    if (def.frogs?.some(([, n]) => n === board.escaped)) setTimeout(() => sfx.croak(), 250);
    void view.swimOut(i, res).then(() => {
      moving.delete(i);
      sfx.splash();
      afterChange();
    });
    renderHud();
    if (def.n === 1) coach.pointAt(firstMovePoint);
  } else {
    sfx.bonk();
    haptic("error");
    renderHud(true);
    void view.bump(i, res).then(() => {
      moving.delete(i);
      if (isOutOfHearts(board)) void onOutOfHearts();
    });
  }
}

function afterChange(): void {
  renderHud();
  if (isWon(board) && !lvl.won && !moving.size) {
    lvl.won = true;
    sfx.pling();
    view.celebrate();
    setTimeout(() => void (playMode === "daily" ? winDaily() : winLevel()), 500);
  }
}

async function onOutOfHearts(): Promise<void> {
  if (inModal || isWon(board)) return;
  sfx.lose();
  haptic("heavy");
  let action = "retry" as "ad" | "lotus" | "retry";
  await ui.openModal((box, close) => {
    box.innerHTML = `<div class="big-icon">💔</div><h2>${t("outOfHearts")}</h2>`;
    box.append(para(t("outOfHeartsBody")));
    if (platform.rewardedAvailable && lvl.heartAds < ECONOMY.heartAdsPerLevel)
      box.append(
        button(`🎬 ${t("oneMoreHeart")}`, "ad", async () => {
          sfx.synth.setHostSuspended(true);
          const ok = await platform.rewarded();
          sfx.synth.setHostSuspended(false);
          if (ok) {
            lvl.heartAds++;
            action = "ad";
            close();
          } else toast(t("adUnavailable"));
        }),
      );
    if (d().inv.lotus > 0 && isUnlocked("lotus")) box.append(button(`🪷 ${t("pu_lotus")} (${d().inv.lotus})`, "green", () => ((action = "lotus"), close())));
    box.append(button(`⟲ ${t("tryAgain")}`, "plain", () => ((action = "retry"), close())));
  });
  if (action === "ad") {
    board.hearts++;
    lvl.lotus++;
    renderHud();
  } else if (action === "lotus") {
    consume("lotus");
    addHeart();
    sfx.power();
    renderHud();
  } else await onRestart();
}

// ---------------------------------------------------------------- undo / restart / hint

async function onUndo(): Promise<void> {
  if (busy || inModal || moving.size) return;
  if (!history.length) return void sfx.bonk();
  // Undo puts koi back, never hearts.
  const { hearts, heartsLost } = board;
  board = history.pop()!;
  board.hearts = hearts;
  board.heartsLost = heartsLost;
  view.sync(board);
  sfx.pick();
  if (!d().gifted.glow && def.n <= 6) toast(t("undoNoHeart"), 2500);
  renderHud();
}

async function onRestart(): Promise<void> {
  if (busy) return;
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

async function showHint(): Promise<boolean> {
  busy = true;
  let k = -1;
  try {
    k = await hintInWorker(board, def.sol);
  } finally {
    busy = false;
  }
  if (k < 0) {
    toast(t("noHint"), 3600);
    return false;
  }
  view.glow([k], 3);
  coach.pointAt(() => view.koiClient(k));
  setTimeout(() => coach.stopPointing(), 3500);
  return true;
}

async function onHint(): Promise<void> {
  if (busy || inModal || playMode === "daily") return;
  if (lvl.freeHint) lvl.freeHint = false;
  else if (!d().day.freeHintUsed) d().day.freeHintUsed = true;
  else if (!(await acquire("hint"))) return;
  save.touch();
  renderHud();
  await showHint();
}

// ---------------------------------------------------------------- power-ups

async function onPowerUp(id: PowerUpId): Promise<void> {
  if (busy || inModal || lvl.won) return;
  if (!isUnlocked(id)) {
    toast(playMode === "daily" && !DAILY_POWER_UPS.includes(id) ? t("dailyOnlySome") : t("locked_at", { n: puInfo(id).unlockLevel }));
    return;
  }
  if (mode === id || (id === "bread" && mode === "breadDir")) {
    mode = "play";
    view.glow([], 0);
    renderHud();
    return;
  }
  if (d().inv[id] <= 0 && !(await acquire(id))) return;
  markTouched();
  if (id === "glow") {
    view.glow(freeKoi(board), 3);
    consume(id);
    sfx.power();
  } else if (id === "lotus") {
    addHeart();
    consume(id);
    sfx.power();
  } else if (id === "net") {
    mode = "net";
    toast(t("netPrompt"), 3500);
  } else if (id === "bread") {
    mode = "bread";
    toast(t("breadPrompt"), 3500);
  }
  renderHud();
}

async function onNet(i: number): Promise<void> {
  mode = "play";
  history.push(cloneBoard(board));
  netKoi(board, i);
  consume("net");
  sfx.power();
  moving.add(i);
  if (def.whirls) view.reaim(board);
  renderHud();
  await view.lift(i);
  moving.delete(i);
  afterChange();
}

function onBreadDirection(clientX: number, clientY: number): void {
  const k = def.koi[breadKoi];
  const p = view.clientToPond(clientX, clientY);
  const hx = (k.c[0] % def.w) + 0.5;
  const hy = Math.floor(k.c[0] / def.w) + 0.5;
  const dx = p.x - hx;
  const dy = p.y - hy;
  const dir: Dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : dy > 0 ? 2 : 0;
  view.glow([], 0);
  mode = "play";
  if (!canTurn(board, breadKoi, dir)) {
    sfx.bonk();
    toast(t("breadNo"));
    renderHud();
    return;
  }
  history.push(cloneBoard(board));
  turnKoi(board, breadKoi, dir);
  consume("bread");
  sfx.power();
  view.reaim(board);
  renderHud();
}

function consume(id: PowerUpId): void {
  d().inv[id] = Math.max(0, d().inv[id] - 1);
  if (puInfo(id).capsStars) lvl.capped = true;
  save.touch();
}

// ---------------------------------------------------------------- win

function recordSkill(lost: number): void {
  d().skill.push(lost);
  while (d().skill.length > 10) d().skill.shift();
}

function isStruggling(): boolean {
  const s = d().skill;
  return s.length >= 5 && s.reduce((a, b) => a + b, 0) / s.length > 1.5;
}

async function winLevel(): Promise<void> {
  busy = true;
  coach.clear();
  platform.gameplayStop();
  const n = def.n;
  const stars = lvl.easier ? 1 : starsFor(board.heartsLost, lvl.lotus, lvl.capped);
  const perfect = !lvl.easier && board.heartsLost === 0;
  if (perfect) sfx.bell();
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
  for (const v of varietyOf) journal.sight(v);
  d().journal = journal.serialize();
  const pageDone = journal.complete;
  const region = REGIONS[journal.page];
  let reward: PowerUpId | null = null;
  if (pageDone) {
    if (journal.encore) d().encores++;
    else if (!d().pagesDone.includes(region.id)) d().pagesDone.push(region.id);
    const unlocked = POWER_UPS.filter((p) => n >= p.unlockLevel).map((p) => p.id);
    reward = unlocked.length ? unlocked[Math.floor(Math.random() * unlocked.length)] : "glow";
    d().inv[reward]++;
  }
  recordSkill(board.heartsLost);
  save.touch();
  await save.flush();
  restarts.delete(n);
  if ((stars === 3 && firstTry) || pageDone) platform.happyTime();
  if (pageDone) sfx.page();
  else sfx.win();
  haptic(pageDone ? "celebrate" : "success");
  let doubled = false;
  const snap = new JournalProgress(journal.page, journal.filled, journal.encore);
  await ui.openModal((box, close) => {
    box.innerHTML = `<h2>${pageDone ? t("pageComplete") : perfect ? t("perfectLevel") : t("levelComplete")}</h2>`;
    box.append(starsRow(stars));
    const card = document.createElement("div");
    card.innerHTML = journalHtml(snap, true);
    box.append(card);
    if (pageDone) box.append(para(`${region.icon} ${t(`region_${region.id}`)} · +1 ${t(`pu_${reward}`)}`));
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
  if (interstitialDue(ECONOMY.interstitial, n, d().levelsSinceAd, { noAds: d().noAds, justRewarded: doubled, celebration: pageDone })) {
    sfx.synth.setHostSuspended(true);
    const shown = await platform.interstitial(ECONOMY.interstitial.minGapSec);
    sfx.synth.setHostSuspended(false);
    if (shown) d().levelsSinceAd = 0;
  }
  if (pageDone) {
    if (!journal.encore) await showRegionReached(journal.page);
    const next = nextPage(d().pagesDone, d().totalStars, d().encores);
    const before = journal.page;
    journal = new JournalProgress(next.page, [], next.encore);
    d().journal = journal.serialize();
    if (!next.encore && journal.page !== before) setTimeout(() => toast(t("regionUnlocked", { name: t(`region_${REGIONS[journal.page].id}`) }), 4000), 600);
  }
  save.touch();
  busy = false;
  await startLevel(n + 1);
}

function showRegionReached(r: number): Promise<void> {
  const region = REGIONS[r];
  const theme = regionReward(region.id);
  if (theme && !d().cosmetics.owned.includes(theme.id)) d().cosmetics.owned.push(theme.id);
  save.touch();
  platform.happyTime();
  return ui.openModal((box, close) => {
    box.innerHTML = `<div class="big-icon">${region.icon}</div><h2>${t("pageComplete")}</h2>`;
    const c = document.createElement("canvas");
    c.className = "journey";
    box.append(c);
    requestAnimationFrame(() => drawJourney(c, Math.min(REGIONS.length - 1, r + 1), 0, REGIONS.map((x) => t(`region_${x.id}`))));
    if (theme) {
      const sw = document.createElement("div");
      sw.className = "skin-reward";
      sw.innerHTML = `<span class="swatch" style="background:${theme.swatch}"></span><b>${t("rewardTheme", { name: t(theme.id) })}</b>`;
      box.append(sw, button(t("equip"), "green", () => (equip(theme.id), close())));
    }
    box.append(button(`${t("next")} ▸`, "", close));
  });
}

// ---------------------------------------------------------------- journal and journey

function showJournal(page = journal.page): Promise<void> {
  return ui.openModal(
    (box, close) => {
      const draw = () => {
        box.innerHTML = `<h2>${t("journey")}</h2>`;
        const map = document.createElement("canvas");
        map.className = "journey";
        box.append(map);
        const reached = journal.encore ? REGIONS.length - 1 : journal.page;
        requestAnimationFrame(() => drawJourney(map, reached, journal.encore ? 0 : journal.done / journal.total, REGIONS.map((x) => t(`region_${x.id}`))));
        const tabs = document.createElement("div");
        tabs.className = "region-tabs";
        REGIONS.forEach((reg, r) => {
          const open = regionOpen(r, d().totalStars);
          const b = document.createElement("button");
          b.textContent = open ? reg.icon : `🔒 ${REGION_STARS[r]}★`;
          b.title = t(`region_${reg.id}`);
          b.disabled = !open;
          b.classList.toggle("on", r === page);
          b.addEventListener("click", () => {
            page = r;
            draw();
          });
          tabs.append(b);
        });
        box.append(tabs, para(`${t("journal")} · ${t(`region_${REGIONS[page].id}`)}`));
        const grid = document.createElement("div");
        grid.className = "journal-grid";
        const jp = page === journal.page ? journal : new JournalProgress(page, d().pagesDone.includes(REGIONS[page].id) ? varietiesOfRegion(page).map(() => 999) : []);
        varietiesOfRegion(page).forEach((v, i) => {
          const f = Math.min(jp.need, jp.filled[i] ?? 0);
          const card = document.createElement("div");
          card.className = `card${f >= jp.need ? " done" : ""}${f === 0 ? " unseen" : ""}`;
          const c = document.createElement("canvas");
          card.append(c, Object.assign(document.createElement("div"), { textContent: f ? VARIETIES[v].name : "?" }), Object.assign(document.createElement("div"), { className: "n", textContent: t("sightings", { n: f, need: jp.need }) }));
          grid.append(card);
          requestAnimationFrame(() => drawKoi(c, v));
        });
        box.append(grid, para(t("totalStars", { n: d().totalStars })), button(t("close"), "plain", close));
      };
      draw();
    },
    { dismissable: true },
  );
}

// ---------------------------------------------------------------- cosmetics & shop

function applyCosmetics(): void {
  const c = d().cosmetics;
  const th = cosmetic(c.theme).theme ?? cosmetic(DEFAULT_EQUIPPED.theme).theme!;
  const trail = cosmetic(c.trail).trail ?? "💧";
  view.setPinkPads(!!cosmetic(c.pads).pink);
  view.applyStyle({ deep: th.deep, shallow: th.shallow, stone: th.stone, grass: th.grass, trail });
  document.body.style.background = th.bg;
  document.body.dataset.dark = th.dark ? "1" : "0";
  if (board) view.build(board, varietyOf);
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
    { id: "theme", label: t("shopTheme") },
    { id: "trail", label: t("shopTrail") },
    { id: "pads", label: t("shopPads") },
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
    albumLabel: (id) => t(`region_${id}`),
    extraTab: ex
      ? {
          id: "store",
          label: t("storeTab"),
          render: (box, grid) => {
            for (const p of ex.PRODUCTS) {
              const info = ex.productInfo(p.id);
              const card = document.createElement("div");
              card.className = "shop-card";
              card.innerHTML = `<span class="swatch" style="background:radial-gradient(circle,#ffd29a,#d9452e)"></span><span class="name">${t(p.id)}</span>`;
              const owned = (p.id === "koi_remove_ads" && d().noAds) || (!p.consumable && info?.owned);
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
    case "koi_remove_ads":
      d().noAds = true;
      break;
    case "koi_starter_pack":
      d().coins += 2000;
      for (const k of Object.keys(inv) as PowerUpId[]) inv[k] += 3;
      break;
    case "koi_coins_small":
      d().coins += 1000;
      break;
    case "koi_coins_medium":
      d().coins += 3000;
      break;
    case "koi_coins_large":
      d().coins += 8000;
      break;
    case "koi_powerup_bundle":
      inv.glow += 5;
      inv.lotus += 3;
      inv.net += 2;
      inv.bread += 2;
      break;
    case "koi_cosmetics_all":
      for (const c of COSMETICS) if (!c.album && !d().cosmetics.owned.includes(c.id)) d().cosmetics.owned.push(c.id);
      break;
  }
  save.touch();
  sfx.coin();
  if (busy || !started) return;
  renderHud();
}

// ---------------------------------------------------------------- Daily Pond

async function startDaily(): Promise<void> {
  busy = true;
  rollDay();
  const day = utcDayKey();
  toast(t("loadingDaily"), 1500);
  const level = await getDaily(day);
  playMode = "daily";
  // Varieties from a region picked by the date (nothing is ticked off in the Daily).
  setupBoard(level, 0, new JournalProgress(new Rng(seedOf(day, "daily-region")).int(0, REGIONS.length - 1)));
  lvl = freshLevelState(false, false);
  view.build(board, varietyOf);
  coach.clear();
  busy = false;
  renderHud();
}

function dailyColour(day: string): string {
  return VARIETIES[new Rng(seedOf(day, "calendar")).int(0, VARIETIES.length - 1)].colors[1];
}

function drawPondIcon(g: CanvasRenderingContext2D, x: number, y: number, s: number, hex: string): void {
  g.fillStyle = "#4fa3a5";
  g.beginPath();
  g.roundRect(x + 1, y + 1, s - 2, s - 2, s * 0.3);
  g.fill();
  g.fillStyle = hex;
  g.beginPath();
  g.ellipse(x + s / 2, y + s / 2, s * 0.3, s * 0.14, 0.5, 0, Math.PI * 2);
  g.fill();
}

async function showDailyCard(justWon = false): Promise<void> {
  const next = await forgeDailyCard(ui, {
    icon: "🎏",
    state: d().daily,
    level: d().level,
    unlockAfter: ECONOMY.dailyLevel,
    inDaily: playMode === "daily",
    justWon,
    rewardedAvailable: platform.rewardedAvailable,
    shareText: (day, r) => dailyShareText("Koi Out", "🎏", day, r, currentStreak(d().daily, day)),
    colourOfDay: dailyColour,
    patch: drawPondIcon,
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
  const stars = starsFor(board.heartsLost, lvl.lotus, false);
  if (recordDailyWin(d().daily, day, { moves: board.heartsLost, par: def.koi.length, stars })) {
    const coins = 40 + 10 * stars;
    d().coins += coins;
    setTimeout(() => toast(`+${coins} 🪙`), 300);
    if (d().daily.streak % ECONOMY.streakBonusEvery === 0) {
      d().inv.bread++;
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
      ...(ex ? [{ label: t("reminder"), get: () => d().reminder, set: (v: boolean) => ((d().reminder = v), void ex.setDailyReminder(v, t("reminderTitle"), t("reminderBody"))) }] : []),
    ],
    languages: LANGUAGES,
    onLanguage: (code) => {
      d().settings.lang = code;
      setLanguage(code);
      save.touch();
      renderHud();
      redrawJournal();
      showSettings();
    },
    onChange: () => save.touch(),
    extra: (close) => [
      button(`🛍 ${t("shop")}`, "green", () => (close(), showShop())),
      button(`🎏 ${t("journal")}`, "plain", () => (close(), void showJournal())),
      button(`❓ ${t("howToPlay")}`, "plain", () => (close(), void showHelp())),
      button(t("resetProgress"), "plain", async () => {
        if (!confirm(t("resetConfirm"))) return;
        await save.reset();
        journal = new JournalProgress(0);
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
    el.innerHTML = `<h1>${t("title")}</h1><div class="tag">${t("tagline")}</div>${journalHtml(journal, true)}`;
    const leave = () => {
      unlockAudio();
      el.remove();
      inModal = ui.modalOpen;
      resolve();
    };
    el.append(button(n > 1 ? t("continueLevel", { n }) : t("play"), "", leave));
    el.append(button(`🎏 ${t("daily")}${d().daily.results[utcDayKey()] ? " ✓" : ""}`, "plain", () => (leave(), void showDailyCard())));
    el.append(button(`❓ ${t("howToPlay")}`, "plain", () => (leave(), void showHelp())));
    $("modal-root").append(el);
    inModal = true;
  });
}

// ---------------------------------------------------------------- input wiring

function bindInput(): void {
  const canvas = $<HTMLCanvasElement>("board");
  let down: { x: number; y: number } | null = null;
  canvas.addEventListener("pointerdown", (e) => {
    unlockAudio();
    down = { x: e.clientX, y: e.clientY };
  });
  canvas.addEventListener("pointerup", (e) => {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    down = null;
    if (moved < 16) onPondTap(e.clientX, e.clientY);
  });
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  $("btn-undo").addEventListener("click", () => void onUndo());
  $("btn-restart").addEventListener("click", () => !inModal && void onRestart());
  $("btn-hint").addEventListener("click", () => void onHint());
  $("btn-menu").addEventListener("click", showSettings);
  $("btn-daily").addEventListener("click", () => !busy && !inModal && void showDailyCard());
  $("coins").addEventListener("click", () => !busy && !inModal && showShop());
  $("side-shop").addEventListener("click", () => !busy && !inModal && showShop());
  $("side-daily").addEventListener("click", () => !busy && !inModal && void showDailyCard());
  $("mini-display-btn").addEventListener("click", () => !inModal && void showJournal());
  $("side-display-btn").addEventListener("click", () => !inModal && void showJournal());
  window.addEventListener("wheel", (e) => e.preventDefault(), { passive: false });
  window.addEventListener("keydown", (e) => {
    if ([" ", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "PageUp", "PageDown"].includes(e.key) && !(e.target instanceof HTMLSelectElement)) e.preventDefault();
    unlockAudio();
    if (inModal || e.repeat) return;
    const k = e.key.toLowerCase();
    if (k === "z") return void onUndo();
    if (k === "escape") {
      mode = "play";
      return renderHud();
    }
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
  save = new SaveSlot<SaveData>(platform.storage, { key: "koi-out", version: SAVE_VERSION, defaults: defaultSave });
  await save.load();
  platform.loadingProgress(0.4);
  if (import.meta.env.DEV) {
    const q = new URLSearchParams(location.search);
    if (q.get("fresh")) await save.reset();
    if (q.get("level")) d().level = Number(q.get("level"));
    if (q.get("coins")) d().coins = Number(q.get("coins"));
    if (q.get("def")) devDef = JSON.parse(atob(q.get("def")!)) as LevelDef;
    (window as unknown as Record<string, unknown>).__koi = {
      get board() { return board; },
      get def() { return def; },
      get view() { return view; },
      get journal() { return journal; },
      get busy() { return busy; },
      get varietyOf() { return varietyOf; },
      save,
      platform,
      startLevel,
      tap: (i: number) => tap(i),
      /** Dev: free every koi in the stored order. */
      solve: async () => {
        for (const i of def.sol) {
          if (board.out[i]) continue;
          tap(i);
          await new Promise((r) => setTimeout(r, 60));
        }
      },
      power: (id: PowerUpId) => onPowerUp(id),
      net: (i: number) => onNet(i),
      undo: () => onUndo(),
      showJournal,
      drain: () => view.tweens.finishAll(),
      shot: async (name: string, w = 1080, h = 1920) => {
        const canvas = view.renderer.domElement;
        const prev = { w: canvas.clientWidth, h: canvas.clientHeight, dpr: view.renderer.getPixelRatio() };
        view.renderer.setPixelRatio(1);
        view.resize(w, h);
        view.setSafeArea(h * 0.08, h * 0.1);
        view.tweens.finishAll();
        for (let k = 0; k < 10; k++) view.render(0.05);
        const base64 = canvas.toDataURL("image/png").split(",")[1];
        view.renderer.setPixelRatio(prev.dpr);
        view.resize(prev.w, prev.h);
        return (await fetch(`/__save?path=press/${name}.png`, { method: "POST", body: JSON.stringify({ base64 }) })).text();
      },
    };
  }
  if (d().settings.lang) setLanguage(d().settings.lang);
  if (import.meta.env.VITE_PLATFORM === "app") {
    appExtras = await import("./game/app-extras.ts");
    await appExtras.initStore(grantProduct).catch((err) => console.warn("[koi-out] store unavailable", err));
  }
  sfx.synth.setMuted(!d().settings.sound);
  setHapticsEnabled(d().settings.haptics);
  music.setEnabled(d().settings.music);
  journal = new JournalProgress(d().journal.page, d().journal.filled, d().journal.encore);
  view = new PondView($<HTMLCanvasElement>("board"));
  applyCosmetics();
  const resize = () => {
    const wide = window.innerWidth >= 760 && window.innerWidth / window.innerHeight > 1.15;
    document.body.classList.toggle("wide", wide);
    const canvas = $<HTMLCanvasElement>("board");
    view.resize(canvas.clientWidth, canvas.clientHeight);
    const cr = canvas.getBoundingClientRect();
    view.setSafeArea(Math.max(0, $("hud-sub").getBoundingClientRect().bottom - cr.top + 6), Math.max(0, cr.bottom - $("hud-bottom").getBoundingClientRect().top + 8));
    redrawJournal();
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
  $("loading").innerHTML = `<p style="padding:20px;text-align:center">Something went wrong loading Koi Out.<br>${String(err)}</p>`;
});
