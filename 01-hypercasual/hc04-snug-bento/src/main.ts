// Snug Bento: game controller. Rules + bento view + forge UI shell + coach + platform (ads, saves).

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
import type { Board, Cell, LevelDef, Placement } from "./logic/rules.ts";
import { TEMP_COLD, TEMP_HOT, canPlace, cloneBoard, isFull, isWon, newBoard, placePiece, placedCells, removePiece, rotatePiece, squishPiece, violations } from "./logic/rules.ts";
import { solve } from "./logic/solver.ts";
import { INTRO } from "./logic/generator.ts";
import { getDaily, getLevel, solveInWorker } from "./game/levels.ts";
import { RecipeProgress, completedMenus, menuOpen, nextRecipe } from "./game/recipe.ts";
import { defaultSave, SAVE_VERSION } from "./game/save.ts";
import type { SaveData } from "./game/save.ts";
import { ECONOMY, POWER_UPS, levelCoins, starsFor } from "./data/economy.ts";
import type { PowerUpId } from "./data/economy.ts";
import { COSMETICS, DEFAULT_EQUIPPED, cosmetic, menuReward } from "./data/cosmetics.ts";
import type { CosmeticSlot } from "./data/cosmetics.ts";
import { FOODS } from "./data/foods.ts";
import { MENUS, MENU_STARS, RECIPES } from "./data/recipes.ts";
import { EN } from "./data/strings.ts";
import { LANGUAGES, registerTranslations } from "./data/i18n/index.ts";
import { BentoView } from "./view/bento.ts";
import { drawMenuBoard, drawRecipe } from "./view/draw.ts";
import { Sfx, CAFE_SONG } from "./view/sfx.ts";

type ItemId = PowerUpId | "hint";
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const DAILY_POWER_UPS: PowerUpId[] = ["peek"];
/** App build only (purchases, reminder); null on the web. */
let appExtras: typeof import("./game/app-extras.ts") | null = null;

// ---------------------------------------------------------------- state

const platform = new Platform();
const sfx = new Sfx();
const music = new Music(sfx.synth, CAFE_SONG);
let inModal = false;
const ui = new Ui({ modalRoot: $("modal-root"), toast: $("toast"), fxLayer: $("fx-layer") });
ui.onModalChange = (open) => (inModal = open);
/** Onboarding: queued tips, power-up unlock cards, the pointing hand (forge coach). */
const coach = new Coach(ui, { root: $("app"), blocked: () => inModal });
let save!: SaveSlot<SaveData>;
let recipe!: RecipeProgress;
let view!: BentoView;
let def!: LevelDef;
let board!: Board;
let foods: number[] = [];
let history: Board[] = [];
let mode: "play" | "knife" = "play";
let busy = false;
let started = false;
let playMode: "levels" | "daily" = "levels";
let devDef: LevelDef | null = null;
let lastTouched = -1;

interface LevelState {
  capped: boolean;
  easier: boolean;
  freeHint: boolean;
  touched: boolean;
  finishing: boolean;
  /** Pieces the Chopsticks placed (they stay put). */
  locked: Set<number>;
  /** Par grows by one for each Knife cut. */
  par: number;
  ruleTold: boolean;
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
  $("moves").textContent = t("placements", { m: board.placements });
  $("par").textContent = t("par", { p: lvl.par });
  const stars = lvl.easier ? 1 : starsFor(Math.max(board.placements, board.at.filter(Boolean).length), lvl.par, lvl.capped);
  [...$("live-stars").children].forEach((el, i) => el.classList.toggle("off", i >= stars));
  $("undo-count").textContent = history.length ? "" : "";
  $("btn-hint").hidden = playMode === "daily" || def.n < 10;
  const freeHints = (lvl.freeHint ? 1 : 0) + (d().day.freeHintUsed ? 0 : 1);
  $("hint-count").textContent = freeHints ? String(freeHints) : "";
  $("btn-daily").classList.toggle("done", !!d().daily.results[utcDayKey()]);
  $("side-daily").textContent = `🍱 ${t("dailyShort")}`;
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
  // Screen-reader labels on the icon buttons follow the language too.
  for (const [elId, key] of [["btn-menu", "settings"], ["btn-daily", "daily"], ["btn-undo", "undo"], ["btn-hint", "hint"], ["btn-restart", "restart"], ["mini-recipe-btn", "cafe"], ["side-recipe-btn", "cafe"]]) {
    document.getElementById(elId)?.setAttribute("aria-label", t(key));
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

function redrawRecipe(): void {
  drawRecipe($<HTMLCanvasElement>("mini-recipe"), recipe.recipe, recipe.filled, { compact: true });
  if (document.body.classList.contains("wide")) {
    drawRecipe($<HTMLCanvasElement>("side-recipe"), recipe.recipe, recipe.filled);
    $("side-title").textContent = recipe.recipe.name;
    $("side-sub").textContent = `${t(`menu_${MENUS[recipe.recipe.menu].id}`)}${recipe.encore ? ` · ${t("encore")}` : ""} · ${t("recipeProgress", { done: recipe.done, total: recipe.total })}`;
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
  const icon = item === "hint" ? "💡" : puInfo(item).icon;
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
      if (item !== "hint") d().inv[item] += 1;
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
  return { capped: false, easier, freeHint, touched: false, finishing, locked: new Set(), par: def.par, ruleTold: false };
}

async function startLevel(n: number, opts: { easier?: boolean; override?: LevelDef } = {}): Promise<void> {
  busy = true;
  rollDay();
  playMode = "levels";
  def = opts.override ? { ...opts.override, n } : await getLevel(n);
  board = newBoard(def);
  history = [];
  mode = "play";
  lastTouched = -1;
  platform.levelStart();
  foods = recipe.mapFoods(board.pieces, n);
  lvl = freshLevelState(!!opts.easier, (restarts.get(n) ?? 0) >= (isStruggling() ? 1 : 2), recipe.canFinishWith(foods));
  if (lvl.easier) placeFromSolution(biggestPiece());
  view.build(board, foods);
  view.hideLid();
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
  redrawRecipe();
  if (started && (def.tag === "tricky" || def.tag === "masterpiece") && !lvl.easier && firstTry) await offerBoost();
}

function biggestPiece(): number {
  let best = 0;
  board.pieces.forEach((p, i) => {
    if (!board.at[i] && p.c.length > board.pieces[best].c.length) best = i;
  });
  return best;
}

/** Put a piece where the level's own solution has it (easier version, boost). */
function placeFromSolution(i: number): void {
  const pl = def.sol[i];
  if (pl && placePiece(board, i, pl, false)) lvl.locked.add(i);
}

/** Level 1: the hand points at a tray piece, then (while dragging) at its spot in the box. */
function firstMovePoint(): { x: number; y: number } | null {
  if (busy || playMode !== "levels" || def.n !== 1) return null;
  const i = board.at.findIndex((a) => !a);
  if (i < 0) return null;
  if (press?.moved) {
    const [cx, cy] = placedCells(board.pieces[press.i], def.sol[press.i])[0];
    return view.cellClient(cx, cy);
  }
  return view.pieceClient(i);
}

/** Where the hand points while an intro level's tip is up: the new thing. */
function introPoint(n: number): (() => { x: number; y: number } | null) | undefined {
  const pieceWhere = (ok: (i: number) => boolean) => () => {
    if (busy || def.n !== n) return null;
    const i = board.pieces.findIndex((p, j) => ok(j));
    return i < 0 ? null : view.pieceClient(i);
  };
  if (n === 3) return pieceWhere((i) => !board.at[i]);
  if (n === INTRO.garnish)
    return () => {
      const c = def.mask.indexOf("g");
      return busy || def.n !== n || c < 0 ? null : view.cellClient(c % def.w, Math.floor(c / def.w));
    };
  if (n === INTRO.soft) return pieceWhere((i) => !!board.pieces[i].s);
  if (n === INTRO.hotCold) return pieceWhere((i) => board.pieces[i].t === TEMP_HOT);
  if (n === INTRO.sauce) return pieceWhere((i) => board.pieces[i].sauce !== undefined);
  return undefined;
}

/** "How to play": the basics and twists met so far (from the level tips) and unlocked power-ups. */
function showHelp(): Promise<void> {
  const level = Math.max(d().level, playMode === "levels" ? def.n : 1);
  // Tips 8, 25 and 40 only restate a power-up; the power-up section covers those.
  const tips = tipsUpTo(EN, level, 10, [8, 25, 40]);
  return showHowToPlay(ui, [
    { title: t("htpBasics"), items: tips.basics.map((text) => ({ icon: "🍱", text })) },
    { title: t("htpPowerUps"), items: POWER_UPS.filter((p) => level >= p.unlockLevel || d().gifted[p.id]).map((p) => ({ icon: p.icon, title: t(`pu_${p.id}`), text: t(`pu_${p.id}_desc`) })) },
    { title: t("htpTwists"), items: tips.twists.map((text) => ({ icon: "✨", text })) },
  ]);
}

async function offerBoost(): Promise<void> {
  if (!canWatchAd("boost")) return;
  let boost = false;
  await ui.openModal((box, close) => {
    box.innerHTML = `<div class="big-icon">🥢</div><h2>${t("boostTitle")}</h2>`;
    box.append(para(t("boostBody")));
    box.append(button(`🎬 ${t("boostYes")}`, "ad", async () => (await watchAd("boost")) && ((boost = true), close())));
    box.append(button(t("boostNo"), "plain", close));
  });
  if (boost) {
    placeFromSolution(biggestPiece());
    view.refresh(board);
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

// ---------------------------------------------------------------- input: drag, tap, hold

interface Press {
  i: number;
  x0: number;
  y0: number;
  t0: number;
  moved: boolean;
  touch: boolean;
  wasOn: Placement | null;
  snap: { x: number; y: number } | null;
  ok: boolean;
}
let press: Press | null = null;

function onPointerDown(e: PointerEvent): void {
  unlockAudio();
  if (busy || inModal) return;
  const i = view.pick(e.clientX, e.clientY);
  if (i < 0) return;
  markTouched();
  if (mode === "knife") return void onKnife(i);
  if (lvl.locked.has(i)) return void (sfx.nope(), haptic("error"));
  lastTouched = i;
  press = { i, x0: e.clientX, y0: e.clientY, t0: performance.now(), moved: false, touch: e.pointerType !== "mouse", wasOn: board.at[i] ? { ...board.at[i]! } : null, snap: null, ok: false };
  try {
    $("board").setPointerCapture(e.pointerId);
  } catch {
    /* some hosts refuse capture; dragging still works */
  }
}

function onPointerMove(e: PointerEvent): void {
  if (!press) return;
  if (!press.moved) {
    if (Math.hypot(e.clientX - press.x0, e.clientY - press.y0) < 9) return;
    press.moved = true;
    history.push(cloneBoard(board));
    if (press.wasOn) {
      removePiece(board, press.i);
      view.refresh(board);
    }
    view.startDrag(press.i, press.x0, press.y0);
    sfx.lift();
  }
  const i = press.i;
  const snap = view.dragTo(i, e.clientX, e.clientY, press.touch ? 1.1 : 0);
  const pl: Placement = { s: board.shape[i], r: board.rot[i], x: snap.x, y: snap.y };
  const ok = canPlace(board, i, pl);
  // Show the ghost while the piece is over the box.
  const over = snap.x > -3 && snap.y > -3 && snap.x < def.w + 1 && snap.y < def.h + 1;
  view.showGhost(over ? { ...pl, i } : null, ok);
  if (ok && (!press.snap || press.snap.x !== snap.x || press.snap.y !== snap.y)) haptic("tick");
  press.snap = snap;
  press.ok = ok;
}

function onPointerUp(): void {
  const p = press;
  press = null;
  if (!p) return;
  const i = p.i;
  if (!p.moved) {
    // A tap: soft foods change shape (hold to turn); others turn.
    const held = performance.now() - p.t0 > 450;
    const before = cloneBoard(board);
    const changed = board.pieces[i].s && !held ? squishPiece(board, i) : rotatePiece(board, i);
    if (changed) {
      history.push(before);
      if (board.pieces[i].s && !held) sfx.squish();
      else sfx.tok();
      view.refresh(board);
      afterChange();
    } else {
      sfx.nope();
      haptic("error");
    }
    return;
  }
  view.endDrag(i);
  if (p.ok && p.snap) {
    placePiece(board, i, { s: board.shape[i], r: board.rot[i], x: p.snap.x, y: p.snap.y });
    coach.stopPointing();
    view.refresh(board);
    view.pop(i);
    sfx.pat(board.pieces[i].c.length);
    if (board.pieces[i].t === TEMP_HOT) sfx.sizzle();
    if (board.pieces[i].t === TEMP_COLD) sfx.chime();
    haptic("medium");
    afterChange();
  } else {
    // Back to the tray (it was already lifted out of the box).
    if (p.snap && p.wasOn === null && !p.ok) {
      const overBox = p.snap.x >= -1 && p.snap.y >= -1 && p.snap.x <= def.w && p.snap.y <= def.h;
      if (overBox) {
        sfx.nope();
        haptic("error");
      }
    }
    // Nothing changed if it came from the tray and went back.
    if (!p.wasOn) history.pop();
    view.refresh(board);
    renderHud();
  }
}

/** After any change: the food rules, the HUD, and the win check. */
function afterChange(): void {
  const v = violations(board);
  view.setBad([...v.hotCold.flat(), ...v.sauce]);
  if (isFull(board) && (v.hotCold.length || v.sauce.length) && !lvl.ruleTold) {
    lvl.ruleTold = true;
    toast(v.hotCold.length ? t("hotCold") : t("sauceAlone"), 3200);
  }
  renderHud();
  if (isWon(board)) void (playMode === "daily" ? winDaily() : winLevel());
}

// ---------------------------------------------------------------- undo / restart / hint

async function onUndo(): Promise<void> {
  if (busy || inModal) return;
  if (!history.length) return void sfx.bonk();
  // Undo never takes back the move count: stars measure placing each piece once.
  const placements = board.placements;
  board = history.pop()!;
  board.placements = placements;
  view.refresh(board);
  sfx.tok();
  afterChange();
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

/** A completion of the current board (worker), or null. */
async function completion(): Promise<Placement[] | null> {
  const res = await solveInWorker(board);
  return res.count > 0 ? res.first : null;
}

/** The tray piece to help with: the one last touched, else the biggest. */
function helpPiece(): number {
  if (lastTouched >= 0 && !board.at[lastTouched]) return lastTouched;
  return biggestPiece();
}

/** Peek / Hint: show one piece's spot for a few seconds. Returns false if the board can't be finished. */
async function showSpot(): Promise<boolean> {
  busy = true;
  try {
    const sol = await completion();
    if (!sol) {
      toast(t("stuckHelp"), 3600);
      return false;
    }
    const i = helpPiece();
    view.showGhost({ ...sol[i], i }, true);
    coach.pointAt(() => view.pieceClient(i));
    setTimeout(() => {
      view.showGhost(null, false);
      coach.stopPointing();
    }, 3200);
    return true;
  } finally {
    busy = false;
  }
}

async function onHint(): Promise<void> {
  if (busy || inModal || playMode === "daily") return;
  if (lvl.freeHint) lvl.freeHint = false;
  else if (!d().day.freeHintUsed) d().day.freeHintUsed = true;
  else if (!(await acquire("hint"))) return;
  save.touch();
  renderHud();
  await showSpot();
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
  if (board.at.every(Boolean)) return;
  if (d().inv[id] <= 0 && !(await acquire(id))) return;
  markTouched();
  if (id === "peek") {
    if (await showSpot()) consume(id);
  } else if (id === "chop") {
    busy = true;
    const sol = await completion();
    busy = false;
    if (!sol) return void toast(t("stuckHelp"), 3600);
    const i = helpPiece();
    history.push(cloneBoard(board));
    if (placePiece(board, i, sol[i], false)) {
      lvl.locked.add(i);
      consume(id);
      sfx.chop();
      view.refresh(board);
      view.pop(i);
      afterChange();
    }
  } else if (id === "knife") {
    mode = "knife";
    toast(t("knifePrompt"), 4000);
  } else if (id === "tidy") {
    onTidy();
  }
  renderHud();
}

function consume(id: PowerUpId): void {
  d().inv[id] = Math.max(0, d().inv[id] - 1);
  if (puInfo(id).capsStars) lvl.capped = true;
  save.touch();
}

/** Tidy Up: send back pieces until the board can be finished again. */
function onTidy(): void {
  const can = (b: Board) => solve(b, { maxNodes: 60000 }).count > 0;
  if (can(board)) return void toast(t("allGood"));
  history.push(cloneBoard(board));
  const placed = () => board.at.map((a, i) => (a && !lvl.locked.has(i) ? i : -1)).filter((i) => i >= 0);
  for (let guard = 0; guard < 20 && !can(board); guard++) {
    const one = placed().find((i) => {
      const trial = cloneBoard(board);
      removePiece(trial, i);
      return can(trial);
    });
    if (one !== undefined) removePiece(board, one);
    else {
      // No single piece fixes it: send back the ones not where the level's solution has them.
      for (const i of placed()) {
        const s = def.sol[i];
        const a = board.at[i]!;
        if (!s || s.x !== a.x || s.y !== a.y || s.r !== a.r || s.s !== a.s) removePiece(board, i);
      }
    }
  }
  consume("tidy");
  sfx.power();
  view.refresh(board);
  afterChange();
}

/** Knife: cut a piece into two connected halves that still leave the box solvable. */
function onKnife(i: number): void {
  mode = "play";
  const p = board.pieces[i];
  if (p.c.length < 2 || p.s || lvl.locked.has(i) || board.pieces.some((q) => q.sauce === i)) {
    sfx.nope();
    toast(t("knifeNo"));
    renderHud();
    return;
  }
  const cells = p.c;
  const key = (c: Cell) => `${c[0]},${c[1]}`;
  const connected = (part: Cell[]) => {
    if (!part.length) return false;
    const set = new Set(part.map(key));
    const seen = new Set([key(part[0])]);
    const stack = [part[0]];
    while (stack.length) {
      const [x, y] = stack.pop()!;
      for (const n of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as Cell[]) if (set.has(key(n)) && !seen.has(key(n))) (seen.add(key(n)), stack.push(n));
    }
    return seen.size === part.length;
  };
  // Every split into two connected halves, most balanced first.
  const splits: Array<[Cell[], Cell[]]> = [];
  for (let mask = 1; mask < (1 << cells.length) - 1; mask++) {
    const a = cells.filter((_, k) => mask & (1 << k));
    const b = cells.filter((_, k) => !(mask & (1 << k)));
    if (a.length > b.length || (a.length === b.length && mask > (1 << cells.length) - 1 - mask)) continue;
    if (connected(a) && connected(b)) splits.push([a, b]);
  }
  splits.sort((x, y) => Math.abs(x[0].length - x[1].length) - Math.abs(y[0].length - y[1].length));
  const before = cloneBoard(board);
  for (const [a, b] of splits) {
    const trial = cloneBoard(board);
    removePiece(trial, i);
    trial.pieces[i] = { ...p, c: a };
    trial.pieces.push({ c: b, t: p.t });
    trial.at.push(null);
    trial.shape.push(0);
    trial.rot.push(0);
    if (solve(trial, { maxNodes: 60000 }).count > 0) {
      history.push(before);
      board = trial;
      foods.push(foods[i]);
      lvl.par++;
      consume("knife");
      sfx.chop();
      haptic("heavy");
      view.setFoods(foods);
      view.refresh(board);
      afterChange();
      return;
    }
  }
  sfx.nope();
  toast(t("knifeNo"));
  renderHud();
}

// ---------------------------------------------------------------- win

function recordSkill(ratio: number): void {
  d().skill.push(Math.round(ratio * 100) / 100);
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
  const stars = lvl.easier ? 1 : starsFor(board.placements, lvl.par, lvl.capped);
  const perfect = !lvl.easier && board.placements <= lvl.par;
  sfx.lid();
  await view.closeLid();
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
  // Every packed food ticks the recipe; one catch-up tick for a food the level didn't have.
  const ids = foods.map((f) => FOODS[f].id);
  let filler = 0;
  for (const id of ids) if (recipe.tick(id) < 0) filler++;
  recipe.topUp(ids);
  d().coins += filler * ECONOMY.coins.fillerBonus;
  d().recipe = recipe.serialize();
  const recipeDone = recipe.complete;
  const dish = recipe.recipe;
  let reward: PowerUpId | null = null;
  if (recipeDone) {
    if (recipe.encore) d().encores++;
    else if (!d().finished.includes(dish.id)) d().finished.push(dish.id);
    const unlocked = POWER_UPS.filter((p) => n >= p.unlockLevel).map((p) => p.id);
    reward = unlocked.length ? unlocked[Math.floor(Math.random() * unlocked.length)] : "peek";
    d().inv[reward]++;
  }
  recordSkill((board.placements + 1) / (lvl.par + 1));
  save.touch();
  await save.flush();
  restarts.delete(n);
  if ((stars === 3 && firstTry) || recipeDone) platform.happyTime();
  if (recipeDone) sfx.recipe();
  else sfx.win();
  haptic(recipeDone ? "celebrate" : "success");
  let doubled = false;
  await ui.openModal((box, close) => {
    box.innerHTML = `<h2>${recipeDone ? t("recipeComplete") : perfect ? t("perfectBox") : t("levelComplete")}</h2>`;
    box.append(starsRow(stars));
    const rc = document.createElement("canvas");
    rc.className = "recipe-big";
    box.append(rc);
    requestAnimationFrame(() => drawRecipe(rc, dish, recipeDone ? "full" : recipe.filled));
    if (recipeDone) box.append(para(`${dish.icon} ${dish.name} · +1 ${t(`pu_${reward}`)}`));
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
  if (interstitialDue(ECONOMY.interstitial, n, d().levelsSinceAd, { noAds: d().noAds, justRewarded: doubled, celebration: recipeDone })) {
    sfx.synth.setHostSuspended(true);
    const shown = await platform.interstitial(ECONOMY.interstitial.minGapSec);
    sfx.synth.setHostSuspended(false);
    if (shown) d().levelsSinceAd = 0;
  }
  if (recipeDone) {
    for (const id of completedMenus(d().finished)) {
      if (d().menusDone.includes(id)) continue;
      d().menusDone.push(id);
      await showMenuComplete(id);
    }
    const before = dish.menu;
    const next = nextRecipe(d().finished, d().totalStars, d().encores);
    recipe = new RecipeProgress(next.index, [], next.encore);
    d().recipe = recipe.serialize();
    if (!next.encore && recipe.recipe.menu !== before) setTimeout(() => toast(t("menuUnlocked", { name: t(`menu_${MENUS[recipe.recipe.menu].id}`) }), 4000), 600);
  }
  save.touch();
  busy = false;
  await startLevel(n + 1);
}

function showMenuComplete(menuId: string): Promise<void> {
  const skin = menuReward(menuId);
  if (skin && !d().cosmetics.owned.includes(skin.id)) d().cosmetics.owned.push(skin.id);
  save.touch();
  platform.happyTime();
  sfx.recipe();
  const mi = MENUS.findIndex((m) => m.id === menuId);
  return ui.openModal((box, close) => {
    box.innerHTML = `<div class="big-icon">🏆</div><h2>${t("menuComplete")}</h2>`;
    const c = document.createElement("canvas");
    c.className = "menu-board";
    box.append(c);
    requestAnimationFrame(() => drawMenuBoard(c, mi, d().finished, null, t(`menu_${menuId}`)));
    if (skin) {
      const sw = document.createElement("div");
      sw.className = "skin-reward";
      sw.innerHTML = `<span class="swatch" style="background:${skin.swatch}"></span><b>${t("rewardSkin", { name: t(skin.id) })}</b>`;
      box.append(sw, button(t("equip"), "green", () => (equip(skin.id), close())));
    }
    box.append(button(`${t("next")} ▸`, "", close));
  });
}

// ---------------------------------------------------------------- café

function showCafe(menuIdx = recipe.recipe.menu): Promise<void> {
  return ui.openModal(
    (box, close) => {
      const draw = () => {
        box.innerHTML = `<h2>${t("cafe")}</h2>`;
        const rc = document.createElement("canvas");
        rc.className = "recipe-big";
        box.append(rc, para(`${recipe.recipe.name} · ${t("recipeProgress", { done: recipe.done, total: recipe.total })}`));
        requestAnimationFrame(() => drawRecipe(rc, recipe.recipe, recipe.filled));
        const tabs = document.createElement("div");
        tabs.className = "menu-tabs";
        MENUS.forEach((m, i) => {
          const open = menuOpen(i, d().totalStars);
          const b = document.createElement("button");
          b.textContent = open ? t(`menu_${m.id}`) : `🔒 ${MENU_STARS[i]}★`;
          b.disabled = !open;
          b.classList.toggle("on", i === menuIdx);
          b.addEventListener("click", () => {
            menuIdx = i;
            draw();
          });
          tabs.append(b);
        });
        box.append(tabs);
        const c = document.createElement("canvas");
        c.className = "menu-board";
        box.append(c);
        requestAnimationFrame(() => drawMenuBoard(c, menuIdx, d().finished, recipe.encore ? null : recipe.recipe.id, t(`menu_${MENUS[menuIdx].id}`)));
        box.append(para(t("totalStars", { n: d().totalStars })), button(t("close"), "plain", close));
      };
      draw();
    },
    { dismissable: true },
  );
}

// ---------------------------------------------------------------- cosmetics & shop

function applyCosmetics(): void {
  const c = d().cosmetics;
  const bx = cosmetic(c.box).box ?? cosmetic(DEFAULT_EQUIPPED.box).box!;
  const wr = cosmetic(c.wrap).wrap ?? cosmetic(DEFAULT_EQUIPPED.wrap).wrap!;
  const mt = cosmetic(c.mat).mat ?? cosmetic(DEFAULT_EQUIPPED.mat).mat!;
  view.applyStyle({ box: bx.wood, floor: bx.floor, lacquer: bx.lacquer, tie: wr.tie, mat: { kind: mt.kind, a: mt.a, b: mt.b } });
  document.body.style.background = mt.bg;
  document.body.dataset.mat = mt.dark ? "dark" : "light";
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
    { id: "box", label: t("shopBox") },
    { id: "wrap", label: t("shopWrap") },
    { id: "mat", label: t("shopMat") },
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
    albumLabel: (id) => t(`menu_${id}`),
    extraTab: ex
      ? {
          id: "store",
          label: t("storeTab"),
          render: (box, grid) => {
            for (const p of ex.PRODUCTS) {
              const info = ex.productInfo(p.id);
              const card = document.createElement("div");
              card.className = "shop-card";
              card.innerHTML = `<span class="swatch" style="background:radial-gradient(circle,#ffd29a,#d9502e)"></span><span class="name">${t(p.id)}</span>`;
              const owned = (p.id === "bento_remove_ads" && d().noAds) || (!p.consumable && info?.owned);
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
    case "bento_remove_ads":
      d().noAds = true;
      break;
    case "bento_starter_pack":
      d().coins += 2000;
      for (const k of Object.keys(inv) as PowerUpId[]) inv[k] += 3;
      break;
    case "bento_coins_small":
      d().coins += 1000;
      break;
    case "bento_coins_medium":
      d().coins += 3000;
      break;
    case "bento_coins_large":
      d().coins += 8000;
      break;
    case "bento_powerup_bundle":
      inv.peek += 5;
      inv.chop += 3;
      inv.knife += 2;
      inv.tidy += 2;
      break;
    case "bento_cosmetics_all":
      for (const c of COSMETICS) if (!d().cosmetics.owned.includes(c.id)) d().cosmetics.owned.push(c.id);
      break;
  }
  save.touch();
  sfx.coin();
  if (busy || !started) return;
  renderHud();
}

// ---------------------------------------------------------------- Daily Bento

async function startDaily(): Promise<void> {
  busy = true;
  rollDay();
  const day = utcDayKey();
  toast(t("loadingDaily"), 1500);
  def = await getDaily(day);
  playMode = "daily";
  board = newBoard(def);
  history = [];
  mode = "play";
  // Foods from a recipe picked by the date (nothing is ticked off in the Daily).
  const r = new RecipeProgress(new Rng(seedOf(day, "daily-recipe")).int(0, RECIPES.length - 1));
  foods = r.mapFoods(board.pieces, 0);
  lvl = freshLevelState(false, false, false);
  view.build(board, foods);
  view.hideLid();
  coach.clear();
  busy = false;
  renderHud();
}

function dailyColour(day: string): string {
  return FOODS[new Rng(seedOf(day, "calendar")).int(0, FOODS.length - 1)].colors[0];
}

function drawBentoIcon(g: CanvasRenderingContext2D, x: number, y: number, s: number, hex: string): void {
  g.fillStyle = "#c9935a";
  g.beginPath();
  g.roundRect(x + 1, y + 1, s - 2, s - 2, s * 0.2);
  g.fill();
  g.fillStyle = hex;
  g.beginPath();
  g.roundRect(x + s * 0.2, y + s * 0.2, s * 0.6, s * 0.6, s * 0.15);
  g.fill();
}

async function showDailyCard(justWon = false): Promise<void> {
  const next = await forgeDailyCard(ui, {
    icon: "🍱",
    state: d().daily,
    level: d().level,
    unlockAfter: ECONOMY.dailyLevel,
    inDaily: playMode === "daily",
    justWon,
    rewardedAvailable: platform.rewardedAvailable,
    shareText: (day, r) => dailyShareText("Snug Bento", "🍱", day, r, currentStreak(d().daily, day)),
    colourOfDay: dailyColour,
    patch: drawBentoIcon,
    watchAd: () => watchAd("double"),
    onRetryUsed: () => save.touch(),
  });
  if (next === "play") await startDaily();
  else if (next === "back") await startLevel(d().level);
}

async function winDaily(): Promise<void> {
  busy = true;
  platform.gameplayStop();
  sfx.lid();
  await view.closeLid();
  const day = utcDayKey();
  const stars = starsFor(board.placements, lvl.par, false);
  if (recordDailyWin(d().daily, day, { moves: board.placements, par: lvl.par, stars })) {
    const coins = 40 + 10 * stars;
    d().coins += coins;
    setTimeout(() => toast(`+${coins} 🪙`), 300);
    if (d().daily.streak % ECONOMY.streakBonusEvery === 0) {
      d().inv.tidy++;
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
      button(`☕ ${t("cafe")}`, "plain", () => (close(), void showCafe())),
      button(`❓ ${t("howToPlay")}`, "plain", () => (close(), void showHelp())),
      button(t("resetProgress"), "plain", async () => {
        if (!confirm(t("resetConfirm"))) return;
        await save.reset();
        recipe = new RecipeProgress(0);
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
    const rc = document.createElement("canvas");
    rc.className = "recipe-big";
    rc.style.maxWidth = "220px";
    el.append(rc);
    const leave = () => {
      unlockAudio();
      el.remove();
      inModal = ui.modalOpen;
      resolve();
    };
    el.append(button(n > 1 ? t("continueLevel", { n }) : t("play"), "", leave));
    el.append(button(`🍱 ${t("daily")}${d().daily.results[utcDayKey()] ? " ✓" : ""}`, "plain", () => (leave(), void showDailyCard())));
    el.append(button(`❓ ${t("howToPlay")}`, "plain", () => (leave(), void showHelp())));
    $("modal-root").append(el);
    inModal = true;
    requestAnimationFrame(() => drawRecipe(rc, recipe.recipe, recipe.filled));
  });
}

// ---------------------------------------------------------------- input wiring

function bindInput(): void {
  const canvas = $<HTMLCanvasElement>("board");
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);
  canvas.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    const i = view.pick(e.clientX, e.clientY);
    if (i >= 0 && !busy && !inModal && !lvl.locked.has(i)) {
      const before = cloneBoard(board);
      if (rotatePiece(board, i)) {
        history.push(before);
        sfx.tok();
        view.refresh(board);
        afterChange();
      }
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
  $("mini-recipe-btn").addEventListener("click", () => !inModal && void showCafe());
  $("side-recipe-btn").addEventListener("click", () => !inModal && void showCafe());
  window.addEventListener("wheel", (e) => e.preventDefault(), { passive: false });
  window.addEventListener("keydown", (e) => {
    if ([" ", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "PageUp", "PageDown"].includes(e.key) && !(e.target instanceof HTMLSelectElement)) e.preventDefault();
    unlockAudio();
    if (inModal || e.repeat) return;
    const k = e.key.toLowerCase();
    if (k === "z") return void onUndo();
    if (k === "r" && press) return;
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
  save = new SaveSlot<SaveData>(platform.storage, { key: "snug-bento", version: SAVE_VERSION, defaults: defaultSave });
  await save.load();
  platform.loadingProgress(0.4);
  if (import.meta.env.DEV) {
    const q = new URLSearchParams(location.search);
    if (q.get("fresh")) await save.reset();
    if (q.get("level")) d().level = Number(q.get("level"));
    if (q.get("coins")) d().coins = Number(q.get("coins"));
    if (q.get("def")) devDef = JSON.parse(atob(q.get("def")!)) as LevelDef;
    (window as unknown as Record<string, unknown>).__snug = {
      get board() { return board; },
      get def() { return def; },
      get view() { return view; },
      get recipe() { return recipe; },
      get busy() { return busy; },
      get foods() { return foods; },
      save,
      platform,
      startLevel,
      /** Dev: place piece i where the level's solution has it (as if dropped there). */
      solvePiece: (i: number) => {
        if (placePiece(board, i, def.sol[i])) {
          view.refresh(board);
          afterChange();
        }
      },
      /** Dev: drop piece i at a placement (counts as a move). */
      place: (i: number, pl: Placement) => {
        history.push(cloneBoard(board));
        const ok = placePiece(board, i, pl);
        view.refresh(board);
        afterChange();
        return ok;
      },
      tapPiece: (i: number) => {
        rotatePiece(board, i);
        view.refresh(board);
      },
      power: (id: PowerUpId) => onPowerUp(id),
      knife: (i: number) => onKnife(i),
      undo: () => onUndo(),
      showCafe,
      drain: () => view.tweens.finishAll(),
      shot: async (name: string, w = 1080, h = 1920) => {
        const canvas = view.renderer.domElement;
        const prev = { w: canvas.clientWidth, h: canvas.clientHeight, dpr: view.renderer.getPixelRatio() };
        view.renderer.setPixelRatio(1);
        view.resize(w, h);
        view.setSafeArea(h * 0.06, h * 0.06);
        view.tweens.finishAll();
        for (let k = 0; k < 30; k++) view.render(0.05);
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
    await appExtras.initStore(grantProduct).catch((err) => console.warn("[snug-bento] store unavailable", err));
  }
  sfx.synth.setMuted(!d().settings.sound);
  setHapticsEnabled(d().settings.haptics);
  music.setEnabled(d().settings.music);
  recipe = new RecipeProgress(d().recipe.index, d().recipe.filled, d().recipe.encore);
  view = new BentoView($<HTMLCanvasElement>("board"));
  applyCosmetics();
  const resize = () => {
    const wide = window.innerWidth >= 760 && window.innerWidth / window.innerHeight > 1.15;
    document.body.classList.toggle("wide", wide);
    const canvas = $<HTMLCanvasElement>("board");
    view.resize(canvas.clientWidth, canvas.clientHeight);
    const cr = canvas.getBoundingClientRect();
    view.setSafeArea(Math.max(0, $("hud-sub").getBoundingClientRect().bottom - cr.top + 6), Math.max(0, cr.bottom - $("hud-bottom").getBoundingClientRect().top + 6));
    redrawRecipe();
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
  $("loading").innerHTML = `<p style="padding:20px;text-align:center">Something went wrong loading Snug Bento.<br>${String(err)}</p>`;
});
