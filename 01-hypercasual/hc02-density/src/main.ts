// Density: game controller. Rules + lab view + forge UI shell + platform (ads, saves).

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
import type { Board, LevelDef, Move, MoveResult } from "./logic/rules.ts";
import { addSpareFlask, applyMove, centrifuge, cloneBoard, decodeLevel, isStuck, isWon, moveAmount, pipette, revealAll, topRun, usable } from "./logic/rules.ts";
import { getDaily, getLevel, solveInWorker } from "./game/levels.ts";
import { TowerProgress, collectionOpen, completedCollections, nextTower } from "./game/tower.ts";
import { defaultSave, SAVE_VERSION } from "./game/save.ts";
import type { SaveData } from "./game/save.ts";
import { ECONOMY, POWER_UPS, levelCoins, starsFor } from "./data/economy.ts";
import type { PowerUpId } from "./data/economy.ts";
import { COSMETICS, COLLECTION_STARS, DEFAULT_EQUIPPED, collectionReward, cosmetic } from "./data/cosmetics.ts";
import type { CosmeticSlot } from "./data/cosmetics.ts";
import { LIQUIDS, liquidsOfWeight } from "./data/liquids.ts";
import { ALL_TOWERS, COLLECTIONS } from "./data/towers.ts";
import { EN } from "./data/strings.ts";
import { LANGUAGES, registerTranslations } from "./data/i18n/index.ts";
import { LabView } from "./view/lab.ts";
import { drawTower } from "./view/tower-draw.ts";
import { Sfx, LAB_SONG } from "./view/sfx.ts";

type ItemId = PowerUpId | "undo" | "hint";
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const SYMBOL_GLYPHS = ["●", "◯", "✚", "✖", "■", "◆", "☰", "┃", "▲", "⁚", "⌃", "□"];
const DAILY_POWER_UPS: PowerUpId[] = ["spare", "lamp"];
/** App build only (purchases, reminder); null on the web. */
let appExtras: typeof import("./game/app-extras.ts") | null = null;

// ---------------------------------------------------------------- state

const platform = new Platform();
const sfx = new Sfx();
const music = new Music(sfx.synth, LAB_SONG);
let inModal = false;
const ui = new Ui({ modalRoot: $("modal-root"), toast: $("toast"), fxLayer: $("fx-layer") });
ui.onModalChange = (open) => (inModal = open);
let save!: SaveSlot<SaveData>;
let tower!: TowerProgress;
let view!: LabView;
let def!: LevelDef;
let board!: Board;
let liquidMap: number[] = [];
let history: Array<{ board: Board; moves: number }> = [];
let moves = 0;
let selected = -1;
let pipetteSelected = false;
let mode: "play" | "pipette" | "centrifuge" = "play";
let busy = false;
let started = false;
let playMode: "levels" | "daily" = "levels";
let devDef: LevelDef | null = null;

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

function liquidOf(slot: number): number {
  return liquidMap[slot] ?? liquidsOfWeight(board?.classes[slot] ?? 3)[0];
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
  $("moves").textContent = t("moves", { m: moves });
  $("par").textContent = t("par", { p: def.par });
  const stars = lvl.easier ? 1 : starsFor(Math.max(moves, 1), def.par, lvl.capped);
  [...$("live-stars").children].forEach((el, i) => el.classList.toggle("off", i >= stars));
  $("undo-count").textContent = String(lvl.undosFree + lvl.undoCredits || "+");
  $("btn-hint").hidden = playMode === "daily" || def.n < 10;
  const freeHints = (lvl.freeHint ? 1 : 0) + (d().day.freeHintUsed ? 0 : 1);
  $("hint-count").textContent = freeHints ? String(freeHints) : "";
  $("btn-daily").classList.toggle("done", !!d().daily.results[utcDayKey()]);
  $("side-daily").textContent = `🧪 ${t("dailyShort")}`;
  $("side-shop").textContent = `🛍 ${t("shop")}`;
  renderPowerups();
  renderPipette();
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

function renderPipette(): void {
  const el = $("pipette-tray");
  const show = board.pipette.length > 0 || mode === "pipette";
  el.hidden = !show;
  if (!show) return;
  el.innerHTML = `<span>${t("pipetteLabel")}</span>`;
  if (board.pipette.length) {
    const liq = LIQUIDS[liquidOf(board.pipette[0])];
    const b = document.createElement("button");
    b.className = "yarn" + (pipetteSelected ? " sel" : "");
    b.style.background = liq.hex;
    if (d().settings.colorblind) b.textContent = SYMBOL_GLYPHS[liq.symbol];
    b.addEventListener("click", () => {
      if (busy) return;
      pipetteSelected = !pipetteSelected;
      selected = -1;
      view.select(-1);
      sfx.pick();
      renderPipette();
    });
    el.append(b);
  } else {
    const e = document.createElement("span");
    e.className = "empty";
    el.append(e);
  }
}

function redrawTower(): void {
  drawTower($<HTMLCanvasElement>("mini-tower"), tower);
  if (document.body.classList.contains("wide")) {
    drawTower($<HTMLCanvasElement>("side-tower"), tower);
    $("side-title").textContent = tower.tower.name;
    $("side-sub").textContent = `${t(`col_${COLLECTIONS[tower.collectionIndex].id}`)}${tower.encore ? ` · ${t("encore")}` : ""} · ${t("towerProgress", { done: tower.done, total: tower.total })}`;
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
  return { undosFree: ECONOMY.freeUndosPerLevel, undoCredits: 0, capped: false, easier, freeHint, touched: false, finishing };
}

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
  pipetteSelected = false;
  mode = "play";
  liquidMap = tower.mapLiquids(def.classes, n);
  lvl = freshLevelState(!!opts.easier, (restarts.get(n) ?? 0) >= (isStruggling() ? 1 : 2), tower.canFinishWith(liquidMap));
  if (lvl.easier) addSpareFlask(board);
  view.build(board, liquidOf);
  view.setHint(null);
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
  redrawTower();
  if (started && (def.tag === "tricky" || def.tag === "masterpiece") && !lvl.easier && (restarts.get(n) ?? 0) === 0) await offerBoost();
}

async function offerBoost(): Promise<void> {
  if (!isUnlocked("spare") || !canWatchAd("spare")) return;
  let boost = false;
  await ui.openModal((box, close) => {
    box.innerHTML = `<div class="big-icon">🧪</div><h2>${t("boostTitle")}</h2>`;
    box.append(para(t("boostBody")));
    box.append(button(`🎬 ${t("boostYes")}`, "ad", async () => (await watchAd("spare")) && ((boost = true), close())));
    box.append(button(t("boostNo"), "plain", close));
  });
  if (boost) {
    addSpareFlask(board);
    view.addFlask(4);
    view.sync(board);
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

async function onFlaskTap(i: number): Promise<void> {
  if (busy || inModal) return;
  markTouched();
  view.setHint(null);
  if (mode === "pipette" || mode === "centrifuge") return;
  if (pipetteSelected) {
    const m: Move = { kind: "drop", to: i };
    if (moveAmount(board, m)) {
      pipetteSelected = false;
      await doMove(m);
    } else refuse(i);
    return;
  }
  if (selected < 0) {
    if (topRun(board, i) > 0) {
      selected = i;
      view.select(i);
      sfx.pick();
      haptic("tick");
    } else if (board.stacks[i].length) refuse(i);
    return;
  }
  if (selected === i) {
    selected = -1;
    view.select(-1);
    return;
  }
  const m: Move = { kind: "pour", from: selected, to: i };
  if (moveAmount(board, m)) {
    selected = -1;
    await doMove(m);
  } else if (topRun(board, i) > 0) {
    selected = i;
    view.select(i);
    sfx.pick();
  } else {
    selected = -1;
    view.select(-1);
    refuse(i);
  }
}

/** Explain a refused pour once in a while (the resting rule isn't obvious at first). */
let ruleHintShown = 0;
function refuse(i: number): void {
  sfx.bonk();
  haptic("error");
  if (board.corks[i] > 0) toast(t("corked", { n: board.corks[i] }));
  else if (ruleHintShown++ < 3) toast(t("rule_same_weight"), 3200);
}

async function doMove(m: Move): Promise<void> {
  busy = true;
  history.push({ board: cloneBoard(board), moves });
  const fill = board.stacks[m.to].length;
  const res = applyMove(board, m);
  moves++;
  const sinking = res.landedAt < board.stacks[m.to].length - res.moved;
  sfx.pour(res.moved, fill);
  if (sinking) sfx.plop();
  else if (board.classes[res.slot] <= 2) sfx.blip();
  haptic("medium");
  renderHud();
  if (m.kind === "pour") await view.animatePour(m.from, m.to, res.slot, res.moved, res.landedAt);
  else await view.animateInsert(m.to, res.slot, res.landedAt);
  view.sync(board);
  await onSeals(res);
  busy = false;
  await checkEnd();
}

async function onSeals(res: Pick<MoveResult, "sealed" | "sealedSlots" | "uncorked">): Promise<void> {
  for (let k = 0; k < res.sealed.length; k++) {
    const i = res.sealed[k];
    const liquid = liquidOf(res.sealedSlots[k]);
    sfx.seal();
    haptic("success");
    const bounce = view.celebrate(i);
    if (playMode === "levels") {
      const from = view.flaskTopClient(i);
      if (tower.pour(liquid)) {
        const r = $("mini-tower").getBoundingClientRect();
        await ui.flyChip(LIQUIDS[liquid].hex, from, { x: r.left + r.width / 2, y: r.top + r.height * 0.6 }, 0, "patch-fly drop-fly");
        d().tower = tower.serialize();
        redrawTower();
      } else {
        d().coins += ECONOMY.coins.fillerBonus;
        ui.floatText(`+${ECONOMY.coins.fillerBonus} 🪙`, from.x, from.y);
      }
      save.touch();
    }
    await bounce;
  }
  if (res.uncorked.length) sfx.power();
  renderHud();
}

async function checkEnd(): Promise<void> {
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
  const h = history.pop()!;
  board = h.board;
  moves = h.moves;
  selected = -1;
  pipetteSelected = false;
  view.build(board, liquidOf);
  sfx.pick();
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
    const res = await solveInWorker({ stacks: board.stacks, caps: board.caps, classes: board.classes, L: board.L, corks: board.corks.map((c) => c + board.sealedCount), pipette: board.pipette });
    const first = res.solved ? res.moves[0] : null;
    if (!first) toast(t("stuckBody"));
    else if (first.kind === "pour") view.setHint([first.from, first.to]);
    else {
      pipetteSelected = true;
      view.setHint([first.to, first.to]);
      renderPipette();
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
  if (mode === id) {
    mode = "play";
    renderHud();
    return;
  }
  if (id === "lamp" && !board.hidden.some((h) => h.some(Boolean))) return void toast(t("pu_lamp_desc"));
  if (id === "pipette" && board.pipette.length) return void toast(t("pipetteLabel"));
  if (d().inv[id] <= 0 && !(await acquire(id))) return;
  markTouched();
  selected = -1;
  pipetteSelected = false;
  view.select(-1);
  view.setHint(null);
  if (id === "spare") {
    consume(id);
    addSpareFlask(board);
    view.addFlask(4);
    view.sync(board);
    sfx.power();
    history = [];
  } else if (id === "lamp") {
    consume(id);
    revealAll(board);
    view.sync(board);
    sfx.power();
    history = [];
  } else {
    mode = id;
    toast(t(id === "pipette" ? "pipettePrompt" : "centrifugePrompt"), 4000);
  }
  renderHud();
  if (id === "spare" || id === "lamp") await checkEnd();
}

function consume(id: PowerUpId): void {
  d().inv[id] = Math.max(0, d().inv[id] - 1);
  if (puInfo(id).capsStars) lvl.capped = true;
  save.touch();
}

async function onBoardTapInMode(cx: number, cy: number): Promise<void> {
  busy = true;
  try {
    if (mode === "pipette") {
      const hit = view.pickUnit(cx, cy);
      if (!hit || !usable(board, hit.flask)) return void sfx.bonk();
      const res = pipette(board, hit.flask, hit.index);
      if (!res.ok) return void sfx.bonk();
      consume("pipette");
      history = [];
      mode = "play";
      pipetteSelected = true;
      sfx.pick();
      haptic("medium");
      view.sync(board);
      await onSeals(res);
    } else if (mode === "centrifuge") {
      const i = view.pickFlask(cx, cy);
      if (i < 0 || !usable(board, i) || !board.stacks[i].length) return void sfx.bonk();
      // Don't spend a Centrifuge on a flask it wouldn't change.
      const trial = cloneBoard(board);
      centrifuge(trial, i);
      if (trial.stacks[i].join() === board.stacks[i].join() && !board.hidden[i].some(Boolean)) return void sfx.bonk();
      const res = centrifuge(board, i);
      consume("centrifuge");
      history = [];
      mode = "play";
      sfx.spin();
      haptic("heavy");
      await view.spin(i);
      view.sync(board);
      await onSeals(res);
    }
  } finally {
    busy = false;
    renderHud();
  }
  await checkEnd();
}

// ---------------------------------------------------------------- stuck / win

async function showStuck(): Promise<void> {
  platform.gameplayStop();
  let action: (() => Promise<void>) | null = null;
  await ui.openModal((box, close) => {
    box.innerHTML = `<div class="big-icon">🧪</div><h2>${t("stuckTitle")}</h2>`;
    box.append(para(t("stuckBody")));
    const grid = document.createElement("div");
    grid.className = "stuck-grid";
    const pick = (fn: () => Promise<void>) => () => ((action = fn), close());
    grid.append(
      button(`↶ ${t("undo")}`, "plain", pick(onUndo), !history.length),
      button(`🧪 ${t("pu_spare")}`, "green", pick(() => onPowerUp("spare")), !isUnlocked("spare")),
      button(`💉 ${t("pu_pipette")}`, "plain", pick(() => onPowerUp("pipette")), !isUnlocked("pipette")),
      button(`💡 ${t("hint")}`, "plain", pick(onHint), playMode === "daily" || def.n < 10),
    );
    box.append(grid);
    if (canWatchAd("rescue")) {
      box.append(
        button(`🎬 ${t("pu_spare")} + 2 ${t("undo")}`, "ad", async () => {
          if (await watchAd("rescue")) {
            lvl.undoCredits += 2;
            action = async () => {
              addSpareFlask(board);
              view.addFlask(4);
              view.sync(board);
              history = [];
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
  return s.length >= 5 && s.reduce((a, b) => a + b, 0) / s.length > 1.35;
}

async function winLevel(): Promise<void> {
  busy = true;
  platform.gameplayStop();
  const n = def.n;
  const stars = lvl.easier ? 1 : starsFor(moves, def.par, lvl.capped);
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
  // Catch-up pour for a layer whose weight class wasn't in this level (keeps towers ~7-15 levels).
  if (tower.topUp(def.classes) !== null) redrawTower();
  d().tower = tower.serialize();
  const towerDone = tower.complete;
  let reward: PowerUpId | null = null;
  const newCollections: string[] = [];
  if (towerDone) {
    if (tower.encore) d().encores++;
    else if (!d().finished.includes(tower.tower.id)) d().finished.push(tower.tower.id);
    const unlocked = POWER_UPS.filter((p) => n >= p.unlockLevel).map((p) => p.id);
    reward = unlocked.length ? unlocked[Math.floor(Math.random() * unlocked.length)] : "spare";
    d().inv[reward]++;
    for (const id of completedCollections(d().finished)) {
      if (d().collectionsDone.includes(id)) continue;
      d().collectionsDone.push(id);
      newCollections.push(id);
      const skin = collectionReward(id);
      if (skin && !d().cosmetics.owned.includes(skin.id)) d().cosmetics.owned.push(skin.id);
    }
  }
  if ((def.tag === "tricky" || def.tag === "masterpiece") && firstTry) d().inv.spare++;
  recordSkill(moves / Math.max(1, def.par));
  save.touch();
  await save.flush();
  restarts.delete(n);
  if ((stars === 3 && firstTry) || towerDone) platform.happyTime();
  if (towerDone) sfx.tower();
  else sfx.win();
  haptic(towerDone ? "celebrate" : "success");
  let doubled = false;
  await ui.openModal((box, close) => {
    box.innerHTML = `<h2>${towerDone ? t("towerComplete") : t("levelComplete")}</h2>`;
    box.append(starsRow(stars));
    const tc = document.createElement("canvas");
    tc.className = towerDone ? "tower-big" : "tower-mid";
    box.append(tc);
    requestAnimationFrame(() => drawTower(tc, tower, { glow: towerDone }));
    box.append(para(towerDone ? `${tower.tower.name} · +1 ${t(`pu_${reward}`)}` : t("towerProgress", { done: tower.done, total: tower.total })));
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
  if (interstitialDue(ECONOMY.interstitial, n, d().levelsSinceAd, { noAds: d().noAds, justRewarded: doubled, celebration: towerDone })) {
    sfx.synth.setHostSuspended(true);
    const shown = await platform.interstitial(ECONOMY.interstitial.minGapSec);
    sfx.synth.setHostSuspended(false);
    if (shown) d().levelsSinceAd = 0;
  }
  for (const id of newCollections) await showCollectionComplete(id);
  if (towerDone) {
    const before = tower.collectionIndex;
    const next = nextTower(d().finished, d().totalStars, d().encores);
    tower = new TowerProgress(next.index, [], next.encore);
    d().tower = tower.serialize();
    if (!next.encore && tower.collectionIndex !== before) {
      setTimeout(() => toast(t("collectionUnlocked", { name: t(`col_${COLLECTIONS[tower.collectionIndex].id}`) }), 4000), 600);
    }
  }
  save.touch();
  busy = false;
  await startLevel(n + 1);
}

function showCollectionComplete(id: string): Promise<void> {
  const skin = collectionReward(id);
  platform.happyTime();
  sfx.tower();
  return ui.openModal((box, close) => {
    box.innerHTML = `<div class="big-icon">🏆</div><h2>${t("collectionComplete")}</h2>`;
    box.append(para(t(`col_${id}`)));
    const strip = document.createElement("div");
    strip.className = "tower-strip";
    const start = ALL_TOWERS.findIndex((x) => COLLECTIONS[x.collection].id === id);
    for (let i = 0; i < 8; i++) {
      const c = document.createElement("canvas");
      strip.append(c);
      const full = new TowerProgress(start + i, new Array(8).fill(99));
      requestAnimationFrame(() => drawTower(c, full));
    }
    box.append(strip);
    if (skin) {
      const sw = document.createElement("div");
      sw.className = "skin-reward";
      sw.innerHTML = `<span class="swatch" style="background:${skin.swatch}"></span><b>${t("rewardSkin", { name: t(skin.id) })}</b>`;
      box.append(sw, button(t("equip"), "green", () => (equip(skin.id), close())));
    }
    box.append(button(`${t("next")} ▸`, "", close));
  });
}

// ---------------------------------------------------------------- cosmetics & shop

function applyCosmetics(): void {
  const c = d().cosmetics;
  const glass = cosmetic(c.glass).glass ?? cosmetic(DEFAULT_EQUIPPED.glass).glass!;
  const bench = cosmetic(c.bench).bench ?? cosmetic(DEFAULT_EQUIPPED.bench).bench!;
  const pour = cosmetic(c.pour).pour ?? cosmetic(DEFAULT_EQUIPPED.pour).pour!;
  view.applyCosmetics(glass, bench, pour);
  document.body.style.background = bench.bg;
  document.body.dataset.bench = bench.kind;
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
    { id: "glass", label: t("shopGlass") },
    { id: "bench", label: t("shopBench") },
    { id: "pour", label: t("shopPour") },
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
    albumLabel: (id) => t(`col_${id}`),
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
              card.innerHTML = `<span class="swatch" style="background:radial-gradient(circle,#bfe6fb,#2f8fc0)"></span><span class="name">${t(p.id)}</span>`;
              const owned = (p.id === "density_remove_ads" && d().noAds) || (!p.consumable && info?.owned);
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
    case "density_remove_ads":
      d().noAds = true;
      break;
    case "density_starter_pack":
      d().coins += 2000;
      for (const k of Object.keys(inv) as PowerUpId[]) inv[k] += 3;
      break;
    case "density_coins_small":
      d().coins += 1000;
      break;
    case "density_coins_medium":
      d().coins += 3000;
      break;
    case "density_coins_large":
      d().coins += 8000;
      break;
    case "density_powerup_bundle":
      inv.spare += 5;
      inv.lamp += 3;
      inv.pipette += 2;
      inv.centrifuge += 2;
      break;
    case "density_cosmetics_all":
      for (const c of COSMETICS) if (!d().cosmetics.owned.includes(c.id)) d().cosmetics.owned.push(c.id);
      break;
  }
  save.touch();
  sfx.coin();
  if (busy || !started) return;
  renderHud();
}

// ---------------------------------------------------------------- Daily Brew

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
  pipetteSelected = false;
  mode = "play";
  const rng = new Rng(seedOf(day, "daily-liquids"));
  const used = new Set<number>();
  liquidMap = def.classes.map((w) => {
    const pick = rng.shuffle(liquidsOfWeight(w).filter((l) => !used.has(l)))[0] ?? liquidsOfWeight(w)[0];
    used.add(pick);
    return pick;
  });
  lvl = freshLevelState(false, false, false);
  view.build(board, liquidOf);
  view.setHint(null);
  busy = false;
  renderHud();
}

function dailyColour(day: string): string {
  return LIQUIDS[new Rng(seedOf(day, "calendar")).int(0, LIQUIDS.length - 1)].hex;
}

function drawDrop(g: CanvasRenderingContext2D, x: number, y: number, s: number, hex: string): void {
  g.fillStyle = hex;
  g.beginPath();
  g.roundRect(x + 1, y + 1, s - 2, s - 2, s * 0.3);
  g.fill();
  g.fillStyle = "rgba(255,255,255,0.3)";
  g.fillRect(x + s * 0.2, y + s * 0.15, s * 0.1, s * 0.5);
}

async function showDailyCard(justWon = false): Promise<void> {
  const next = await forgeDailyCard(ui, {
    icon: "🧪",
    state: d().daily,
    level: d().level,
    unlockAfter: ECONOMY.dailyLevel,
    inDaily: playMode === "daily",
    justWon,
    rewardedAvailable: platform.rewardedAvailable,
    shareText: (day, r) => dailyShareText("Density", "🧪", day, r, currentStreak(d().daily, day)),
    colourOfDay: dailyColour,
    patch: drawDrop,
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
  const stars = starsFor(moves, def.par, false);
  if (recordDailyWin(d().daily, day, { moves, par: def.par, stars })) {
    const coins = 40 + 10 * stars;
    d().coins += coins;
    setTimeout(() => toast(`+${coins} 🪙`), 300);
    if (d().daily.streak % ECONOMY.streakBonusEvery === 0) {
      d().inv.centrifuge++;
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

function showTowerModal(): void {
  void ui.openModal(
    (box, close) => {
      box.innerHTML = `<h2>${tower.tower.name}</h2>`;
      box.append(para(`${t(`col_${COLLECTIONS[tower.collectionIndex].id}`)}${tower.encore ? ` · ${t("encore")}` : ""} · ${t("towerProgress", { done: tower.done, total: tower.total })}`));
      const big = document.createElement("canvas");
      big.className = "tower-big";
      box.append(big, para(t("totalStars", { n: d().totalStars })));
      COLLECTIONS.forEach((col, ci) => {
        const head = document.createElement("div");
        head.className = "album-head";
        const open = collectionOpen(ci, d().totalStars);
        const done = col.towers.filter((tw) => d().finished.includes(tw.id)).length;
        head.innerHTML = `<b>${t(`col_${col.id}`)}</b><span>${open ? `${done}/8` : `🔒 ${t("collectionNeedsStars", { n: COLLECTION_STARS[ci] })}`}</span>`;
        box.append(head);
        if (!open) return;
        const strip = document.createElement("div");
        strip.className = "tower-strip";
        const start = ALL_TOWERS.findIndex((x) => x.collection === ci);
        col.towers.forEach((tw, i) => {
          if (d().finished.includes(tw.id)) {
            const c = document.createElement("canvas");
            strip.append(c);
            const full = new TowerProgress(start + i, new Array(8).fill(99));
            requestAnimationFrame(() => drawTower(c, full));
          } else {
            const e = document.createElement("div");
            e.className = "todo";
            e.textContent = start + i === tower.index && !tower.encore ? "🧪" : "?";
            strip.append(e);
          }
        });
        box.append(strip);
      });
      box.append(button(t("close"), "plain", close));
      requestAnimationFrame(() => drawTower(big, tower));
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
      { label: t("colorblind"), get: () => d().settings.colorblind, set: (v) => ((d().settings.colorblind = v), view.setSymbols(v), renderPipette()) },
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
        tower = new TowerProgress(0);
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
    const tc = document.createElement("canvas");
    tc.className = "tower-mid";
    el.append(tc);
    const leave = () => {
      unlockAudio();
      el.remove();
      inModal = ui.modalOpen;
      resolve();
    };
    el.append(button(n > 1 ? t("continueLevel", { n }) : t("play"), "", leave));
    el.append(button(`🧪 ${t("daily")}${d().daily.results[utcDayKey()] ? " ✓" : ""}`, "plain", () => (leave(), void showDailyCard())));
    $("modal-root").append(el);
    inModal = true;
    requestAnimationFrame(() => drawTower(tc, tower));
  });
}

// ---------------------------------------------------------------- input

function bindInput(): void {
  const canvas = $<HTMLCanvasElement>("board");
  canvas.addEventListener("pointerdown", (e) => {
    unlockAudio();
    if (busy || inModal) return;
    if (mode !== "play") return void onBoardTapInMode(e.clientX, e.clientY);
    const i = view.pickFlask(e.clientX, e.clientY);
    if (i >= 0) void onFlaskTap(i);
    else if (selected >= 0) {
      selected = -1;
      view.select(-1);
    }
  });
  $("btn-undo").addEventListener("click", () => void onUndo());
  $("btn-restart").addEventListener("click", () => void onRestart());
  $("btn-hint").addEventListener("click", () => void onHint());
  $("btn-menu").addEventListener("click", showSettings);
  $("btn-daily").addEventListener("click", () => !busy && !inModal && void showDailyCard());
  $("coins").addEventListener("click", () => !busy && !inModal && showShop());
  $("side-shop").addEventListener("click", () => !busy && !inModal && showShop());
  $("side-daily").addEventListener("click", () => !busy && !inModal && void showDailyCard());
  $("mini-tower-btn").addEventListener("click", () => !inModal && showTowerModal());
  $("side-tower-btn").addEventListener("click", () => !inModal && showTowerModal());
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
    if (num >= 0 && num < board.stacks.length) void onFlaskTap(num);
  });
}

// ---------------------------------------------------------------- boot

async function boot(): Promise<void> {
  registerStrings("en", EN);
  registerTranslations();
  platform.loadingProgress(0.1);
  await platform.init();
  setLanguage(detectLanguage(platform.language(), !platform.hostControlsVisibility));
  save = new SaveSlot<SaveData>(platform.storage, { key: "density", version: SAVE_VERSION, defaults: defaultSave });
  await save.load();
  platform.loadingProgress(0.4);
  if (import.meta.env.DEV) {
    const q = new URLSearchParams(location.search);
    if (q.get("fresh")) await save.reset();
    if (q.get("level")) d().level = Number(q.get("level"));
    if (q.get("coins")) d().coins = Number(q.get("coins"));
    if (q.get("def")) devDef = JSON.parse(atob(q.get("def")!)) as LevelDef;
    (window as unknown as Record<string, unknown>).__dens = {
      get board() { return board; },
      get def() { return def; },
      get view() { return view; },
      get moves() { return moves; },
      get tower() { return tower; },
      save,
      platform,
      startLevel,
      tap: (i: number) => onFlaskTap(i),
      power: (id: PowerUpId) => onPowerUp(id),
      undo: () => onUndo(),
      /** Dev: save the current board as a PNG (press/<name>.png) at w x h pixels. */
      shot: async (name: string, w = 1080, h = 1920) => {
        const canvas = view.renderer.domElement;
        const prev = { w: canvas.clientWidth, h: canvas.clientHeight, dpr: view.renderer.getPixelRatio() };
        view.renderer.setPixelRatio(1);
        view.resize(w, h);
        view.setSafeArea(h * 0.08, h * 0.08);
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
    await appExtras.initStore(grantProduct).catch((err) => console.warn("[density] store unavailable", err));
  }
  sfx.synth.setMuted(!d().settings.sound);
  setHapticsEnabled(d().settings.haptics);
  music.setEnabled(d().settings.music);
  tower = new TowerProgress(d().tower.index, d().tower.pours, d().tower.encore);
  view = new LabView($<HTMLCanvasElement>("board"), $("fx-layer"));
  view.setSymbols(d().settings.colorblind);
  applyCosmetics();
  const resize = () => {
    const wide = window.innerWidth >= 760 && window.innerWidth / window.innerHeight > 1.15;
    document.body.classList.toggle("wide", wide);
    const canvas = $<HTMLCanvasElement>("board");
    view.resize(canvas.clientWidth, canvas.clientHeight);
    const cr = canvas.getBoundingClientRect();
    view.setSafeArea(Math.max(0, $("hud-sub").getBoundingClientRect().bottom - cr.top + 6), Math.max(0, cr.bottom - $("hud-bottom").getBoundingClientRect().top + 6));
    redrawTower();
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
  $("loading").innerHTML = `<p style="padding:20px;text-align:center">Something went wrong loading Density.<br>${String(err)}</p>`;
});
