// Aisle Nine: game controller. Rules + stand view + forge UI shell + coach + platform (ads, saves).

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
import type { Board, GameEvent, LevelDef, Move } from "./logic/rules.ts";
import { BASKET_SPOTS, EMPTY, SPOTS, applyMove, assistSell, canMove, canServe, canTake, cloneBoard, freeSpot, inReach, isJammed, isWon, kindCounts, newBoard, shelfCount, usable, wanted } from "./logic/rules.ts";
import { INTRO } from "./logic/generator.ts";
import { getDaily, getLevel, hintInWorker, restackInWorker } from "./game/levels.ts";
import { DisplayProgress, nextDisplay, openedShops, shopOpen } from "./game/displays.ts";
import { defaultSave, SAVE_VERSION } from "./game/save.ts";
import type { SaveData } from "./game/save.ts";
import { BRAKE_MOVES, ECONOMY, POWER_UPS, levelCoins, starsFor } from "./data/economy.ts";
import type { PowerUpId } from "./data/economy.ts";
import { COSMETICS, DEFAULT_EQUIPPED, cosmetic, shopReward } from "./data/cosmetics.ts";
import type { CosmeticSlot } from "./data/cosmetics.ts";
import { GOODS, SHOPS } from "./data/goods.ts";
import { DISPLAYS, SHOP_STARS } from "./data/shops.ts";
import type { Display } from "./data/shops.ts";
import { EN } from "./data/strings.ts";
import { LANGUAGES, registerTranslations } from "./data/i18n/index.ts";
import { StandView } from "./view/stand.ts";
import type { Pick } from "./view/stand.ts";
import { Sfx, SHOP_SONG } from "./view/sfx.ts";

type ItemId = PowerUpId | "hint";
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const DAILY_POWER_UPS: PowerUpId[] = ["brake"];
/** App build only (purchases, reminder); null on the web. */
let appExtras: typeof import("./game/app-extras.ts") | null = null;

// ---------------------------------------------------------------- state

const platform = new Platform();
const sfx = new Sfx();
const music = new Music(sfx.synth, SHOP_SONG);
let inModal = false;
const ui = new Ui({ modalRoot: $("modal-root"), toast: $("toast"), fxLayer: $("fx-layer") });
ui.onModalChange = (open) => (inModal = open);
/** Onboarding: queued tips, power-up unlock cards, the pointing hand (forge coach). */
const coach = new Coach(ui, { root: $("app"), blocked: () => inModal });
let save!: SaveSlot<SaveData>;
let display!: DisplayProgress;
let view!: StandView;
let def!: LevelDef;
let board!: Board;
/** Which good (index into GOODS) each kind on the stand is. */
let goodsOf: number[] = [];
let history: Board[] = [];
let sel: Pick | null = null;
let mode: "play" | "assistant" = "play";
let busy = false;
let started = false;
let playMode: "levels" | "daily" = "levels";
let devDef: LevelDef | null = null;

interface LevelState {
  capped: boolean;
  easier: boolean;
  freeHint: boolean;
  touched: boolean;
  finishing: boolean;
  freeBasket: boolean;
  combo: number;
  /** Goods per kind at the start (for display ticks). */
  counts: number[];
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
const icon = (k: number) => (k === EMPTY ? "" : GOODS[goodsOf[k]].icon);
const S = () => shelfCount(def);

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
          : def.tag === "grand"
            ? t("tag_grand")
            : def.tag === "breather"
              ? t("tag_breather")
              : "";
  if (def.tag === "breather") tag.classList.add("breather");
  if (lvl.finishing) tag.classList.add("finishing");
  $("coin-count").textContent = String(d().coins);
  $("moves").textContent = t("moves", { m: board.moves });
  $("par").textContent = t("par", { p: def.par });
  const stars = lvl.easier ? 1 : starsFor(board.moves, def.par, lvl.capped);
  [...$("live-stars").children].forEach((el, i) => el.classList.toggle("off", i >= stars));
  $("brake-left").textContent = board.brake > 0 ? `✋${board.brake}` : "";
  $("btn-hint").hidden = playMode === "daily" || def.n < 10;
  $("btn-turn").hidden = !def.turns;
  const freeHints = (lvl.freeHint ? 1 : 0) + (d().day.freeHintUsed ? 0 : 1);
  $("hint-count").textContent = freeHints ? String(freeHints) : "";
  $("btn-daily").classList.toggle("done", !!d().daily.results[utcDayKey()]);
  $("side-daily").textContent = `🛒 ${t("dailyShort")}`;
  $("side-shop").textContent = `🛍 ${t("shop")}`;
  renderPowerups();
  renderCounter();
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
  for (const [elId, key] of [["btn-menu", "settings"], ["btn-daily", "daily"], ["btn-undo", "undo"], ["btn-turn", "turn"], ["btn-hint", "hint"], ["btn-restart", "restart"], ["mini-display-btn", "street"], ["side-display-btn", "street"]]) {
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

/** The stand map, the basket, the restock cart and the customer. */
function renderCounter(): void {
  // Stand map: every unit around the stand, in order, with the front arc centred and lit.
  const map = $("stand-map");
  map.innerHTML = "";
  map.hidden = !def.turns;
  if (def.turns) {
    const U = def.units;
    const byPos = view.unitsByPosition(board);
    const offset = -Math.floor((U - def.reach) / 2);
    const arrow = (ch: string) => {
      const a = document.createElement("span");
      a.className = "arrow";
      a.textContent = ch;
      return a;
    };
    if (def.dir < 0) map.append(arrow("◀"));
    for (let k = 0; k < U; k++) {
      const pos = (((k + offset) % U) + U) % U;
      const u = byPos[pos];
      const cell = document.createElement("div");
      cell.className = `u${pos < def.reach ? " on" : ""}`;
      for (let r = 0; r < def.rows; r++) {
        const s = u * def.rows + r;
        const row = document.createElement("div");
        row.className = "r";
        if (board.boxed[s]) row.textContent = "📦";
        else if (board.frozen[s] > 0) row.textContent = `❄️${board.frozen[s]}`;
        else if (board.locked && def.shelves[s].cab) row.textContent = "🔒";
        else for (let i = 0; i < SPOTS; i++) row.append(Object.assign(document.createElement("span"), { textContent: icon(board.front[s * SPOTS + i]) || "·" }));
        cell.append(row);
      }
      map.append(cell);
    }
    if (def.dir > 0) map.append(arrow("▶"));
  }
  // Basket.
  const basket = $("basket");
  basket.hidden = board.basket <= 0;
  basket.innerHTML = "";
  basket.classList.toggle("target", !!sel && sel.shelf !== S());
  for (let i = 0; i < board.basket; i++) {
    const k = board.front[S() * SPOTS + i];
    const b = document.createElement("button");
    b.textContent = icon(k);
    b.classList.toggle("full", k !== EMPTY);
    b.classList.toggle("sel", !!sel && sel.shelf === S() && sel.spot === i);
    b.addEventListener("click", () => onTap(k !== EMPTY ? { shelf: S(), spot: i } : { shelf: S(), spot: -1 }));
    basket.append(b);
  }
  // Customer.
  const cust = $("customer");
  const w = wanted(board);
  cust.hidden = w === EMPTY;
  cust.querySelector(".want")!.textContent = icon(w);
  cust.classList.toggle("target", !!sel && w !== EMPTY && pickKind(sel) === w);
  // Cart.
  const cart = $("cart");
  const left = def.cart ? def.cart.length - board.cartPos : 0;
  cart.hidden = left <= 0;
  if (left > 0) {
    const next = def.cart!.slice(board.cartPos, board.cartPos + SPOTS).map(icon).join("");
    $("cart-items").innerHTML = `${next}${left > SPOTS ? `<span class="more">+${left - SPOTS}</span>` : ""}`;
  }
}

function pickKind(p: Pick): number {
  return p.spot >= 0 ? board.front[p.shelf * SPOTS + p.spot] : EMPTY;
}

/** The current display as a card: compact (HUD) or full (modals, side panel). */
function displayHtml(dp: { display: Display; filled: number[] }, full: boolean): string {
  const disp = dp.display;
  const done = disp.parts.reduce((a, p, i) => a + Math.min(p.need, dp.filled[i]), 0);
  const total = disp.parts.reduce((a, p) => a + p.need, 0);
  if (!full) return `<span class="ic">${disp.icon}</span><span class="bar"><i style="width:${Math.round((100 * done) / total)}%"></i></span><span class="num">${done}/${total}</span>`;
  const rows = disp.parts
    .map((p, i) => {
      const g = GOODS.find((x) => x.id === p.good)!;
      const f = Math.min(p.need, dp.filled[i]);
      return `<div class="row${f >= p.need ? " done" : ""}"><span class="ic">${g.icon}</span><span class="bar"><i style="width:${Math.round((100 * f) / p.need)}%"></i></span><span class="n">${f}/${p.need}</span></div>`;
    })
    .join("");
  return `<div class="display-full"><div class="head"><span>${disp.icon}</span><span>${disp.name}</span></div>${rows}</div>`;
}

function redrawDisplay(): void {
  $("mini-display-btn").innerHTML = displayHtml(display, false);
  if (document.body.classList.contains("wide")) {
    $("side-display-btn").innerHTML = displayHtml(display, true);
    $("side-sub").textContent = `${t(`shop_${SHOPS[display.display.shop].id}`)}${display.encore ? ` · ${t("encore")}` : ""} · ${t("displayProgress", { done: display.done, total: display.total })}`;
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
  const counts = kindCounts(board);
  return { capped: false, easier, freeHint, touched: false, finishing: false, freeBasket: true, combo: 0, counts };
}

function setupBoard(level: LevelDef, levelNumber: number): void {
  def = level;
  board = newBoard(def);
  history = [];
  sel = null;
  mode = "play";
  const counts = kindCounts(board);
  // Customers' extra goods count too.
  for (const k of def.cust ?? []) counts[k] += 0;
  goodsOf = display.mapGoods(counts, levelNumber);
}

async function startLevel(n: number, opts: { easier?: boolean; override?: LevelDef } = {}): Promise<void> {
  busy = true;
  rollDay();
  playMode = "levels";
  setupBoard(opts.override ? { ...opts.override, n } : await getLevel(n), n);
  platform.levelStart();
  lvl = freshLevelState(!!opts.easier, (restarts.get(n) ?? 0) >= (isStruggling() ? 1 : 2));
  lvl.finishing = display.canFinishWith(goodsOf, lvl.counts);
  // Easier version: a basket from the start.
  if (lvl.easier) board.basket = BASKET_SPOTS;
  view.build(board, goodsOf);
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
  redrawDisplay();
  if (started && (def.tag === "tricky" || def.tag === "grand") && !lvl.easier && firstTry) await offerBoost();
}

/** Level 1: the hand points at the first move's good, then at the shelf it goes to. */
function firstMovePoint(): { x: number; y: number } | null {
  if (busy || playMode !== "levels" || def.n !== 1 || board.moves > 0) return null;
  const m = def.sol[0];
  if (m[0] !== 0) return null;
  return sel ? view.shelfClient(m[3]) : view.goodClient({ shelf: m[1], spot: m[2] });
}

/** Where the hand points while an intro level's tip is up: the new thing. */
function introPoint(n: number): (() => { x: number; y: number } | null) | undefined {
  const shelfWhere = (ok: (s: number) => boolean) => () => {
    if (busy || def.n !== n) return null;
    for (let s = 0; s < S(); s++) if (ok(s) && inReach(board, s)) return view.shelfClient(s);
    return null;
  };
  const el = (id: string) => () => {
    if (busy || def.n !== n) return null;
    const r = $(id).getBoundingClientRect();
    return r.width ? { x: r.left + r.width / 2, y: r.top } : null;
  };
  if (n === INTRO.turning || n === 5) return el(n === 5 ? "btn-turn" : "stand-map");
  if (n === INTRO.boxes) return shelfWhere((s) => board.boxed[s]);
  if (n === INTRO.freezer) return shelfWhere((s) => board.frozen[s] > 0);
  if (n === INTRO.cabinet) return shelfWhere((s) => !!def.shelves[s].cab && board.locked);
  if (n === INTRO.cart) return el("cart");
  if (n === INTRO.customers) return el("customer");
  return undefined;
}

/** "How to play": the basics and twists met so far (from the level tips) and unlocked power-ups. */
function showHelp(): Promise<void> {
  const level = Math.max(d().level, playMode === "levels" ? def.n : 1);
  // Tips 8, 15 and 40 only restate a power-up; the power-up section covers those.
  const tips = tipsUpTo(EN, level, 10, [8, 15, 40]);
  return showHowToPlay(ui, [
    { title: t("htpBasics"), items: tips.basics.map((text) => ({ icon: "🛒", text })) },
    { title: t("htpPowerUps"), items: POWER_UPS.filter((p) => level >= p.unlockLevel || d().gifted[p.id]).map((p) => ({ icon: p.icon, title: t(`pu_${p.id}`), text: t(`pu_${p.id}_desc`) })) },
    { title: t("htpTwists"), items: tips.twists.map((text) => ({ icon: "✨", text })) },
  ]);
}

async function offerBoost(): Promise<void> {
  if (!canWatchAd("boost")) return;
  let boost = false;
  await ui.openModal((box, close) => {
    box.innerHTML = `<div class="big-icon">🧺</div><h2>${t("boostTitle")}</h2>`;
    box.append(para(t("boostBody")));
    box.append(button(`🎬 ${t("boostYes")}`, "ad", async () => (await watchAd("boost")) && ((boost = true), close())));
    box.append(button(t("boostNo"), "plain", close));
  });
  if (boost) {
    board.basket = BASKET_SPOTS;
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

// ---------------------------------------------------------------- input: tap a good, tap a shelf

function select(p: Pick | null): void {
  sel = p;
  view.select(p && p.shelf !== S() ? p : null);
  const targets: number[] = [];
  if (p) for (let s = 0; s < S(); s++) if (s !== p.shelf && inReach(board, s) && usable(board, s) && freeSpot(board, s) >= 0) targets.push(s);
  view.setTargets(targets);
  renderCounter();
}

/** Why a shelf can't be used right now (for the toast), or "" if it can. */
function whyNot(s: number): string {
  if (s === S()) return "";
  if (board.boxed[s]) return t("closedBox");
  if (board.frozen[s] > 0) return t("frozenShelf", { n: board.frozen[s] });
  if (board.locked && def.shelves[s].cab) return t("lockedCabinet");
  if (!inReach(board, s)) return t("outOfReach");
  return "";
}

function refuse(msg: string): void {
  sfx.nope();
  haptic("error");
  if (msg) toast(msg, 2600);
}

function onTap(p: Pick | null): void {
  unlockAudio();
  if (busy || inModal || !p) return;
  markTouched();
  if (mode === "assistant") {
    if (p.spot < 0) return;
    return void onAssistant(pickKind(p));
  }
  if (p.spot >= 0) {
    if (sel && sel.shelf === p.shelf && sel.spot === p.spot) return select(null);
    if (sel && sel.shelf !== p.shelf) return void tryMove(p.shelf);
    if (!canTake(board, p.shelf, p.spot)) return refuse(whyNot(p.shelf));
    sfx.pick();
    haptic("tick");
    select(p);
    return;
  }
  // A shelf (or an empty basket spot).
  if (!sel) {
    const why = whyNot(p.shelf);
    if (why) toast(why, 2600);
    return;
  }
  void tryMove(p.shelf);
}

async function tryMove(to: number): Promise<void> {
  if (!sel) return;
  if (!canMove(board, sel.shelf, sel.spot, to)) {
    const why = whyNot(to) || (freeSpot(board, to) < 0 ? t("shelfFull") : "");
    select(null);
    return refuse(why);
  }
  await play([0, sel.shelf, sel.spot, to]);
}

async function onServe(): Promise<void> {
  if (busy || inModal || !sel) return;
  if (!canServe(board, sel.shelf, sel.spot)) return refuse(t("customerWants"));
  await play([2, sel.shelf, sel.spot]);
}

/** Play a move: rules first, then the view animates the events with their sounds. */
async function play(m: Move): Promise<void> {
  history.push(cloneBoard(board));
  const events: GameEvent[] = [];
  if (!applyMove(board, m, events)) {
    history.pop();
    return;
  }
  coach.stopPointing();
  select(null);
  busy = true;
  await view.play(events, board, onEvent);
  busy = false;
  afterChange();
}

function onEvent(ev: GameEvent): void {
  if (ev.t === "move") {
    sfx.place();
    haptic("light");
  } else if (ev.t === "sell") {
    sfx.sell(lvl.combo++);
    haptic("medium");
  } else if (ev.t === "restock") sfx.restock();
  else if (ev.t === "turn") sfx.turn();
  else if (ev.t === "open") sfx.tear();
  else if (ev.t === "thaw") sfx.thaw();
  else if (ev.t === "unlock") sfx.unlock();
  else if (ev.t === "serve") sfx.serve();
  if (ev.t === "move" || ev.t === "serve") {
    // A combo is sales on consecutive moves.
    const last = history[history.length - 1];
    if (last && board.sold === last.sold) lvl.combo = 0;
  }
}

/** After any change: the HUD, the win check and the jam check. */
function afterChange(): void {
  renderHud();
  if (isWon(board)) return void (playMode === "daily" ? winDaily() : winLevel());
  if (isJammed(board)) void onJammed();
  if (def.n === 1 && playMode === "levels" && board.moves === 0) coach.pointAt(firstMovePoint);
}

async function onJammed(): Promise<void> {
  sfx.bonk();
  haptic("error");
  await ui.openModal((box, close) => {
    box.innerHTML = `<div class="big-icon">🧺</div><h2>${t("jammed")}</h2>`;
    box.append(para(t("jammedBody")));
    box.append(button(`↶ ${t("undo")}`, "", () => (close(), void onUndo())));
    if (board.basket <= 0 && isUnlocked("basket"))
      box.append(
        button(`🧺 ${lvl.freeBasket ? t("useBasketFree") : t("useBasket")}`, "green", async () => {
          if (lvl.freeBasket) lvl.freeBasket = false;
          else if (d().inv.basket <= 0 && !(await acquire("basket"))) return;
          else consume("basket");
          board.basket = BASKET_SPOTS;
          sfx.power();
          close();
          renderHud();
        }),
      );
    box.append(button(`⟲ ${t("restart")}`, "plain", () => (close(), void onRestart())));
  });
}

// ---------------------------------------------------------------- undo / turn / restart / hint

async function onUndo(): Promise<void> {
  if (busy || inModal) return;
  if (!history.length) return void sfx.bonk();
  // Undo never takes back the move count: stars measure the moves you made.
  const moves = board.moves;
  board = history.pop()!;
  board.moves = moves;
  select(null);
  view.snapTo(board);
  sfx.pick();
  renderHud();
}

async function onTurn(): Promise<void> {
  if (busy || inModal || !def.turns) return;
  markTouched();
  await play([1]);
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

/** Hint: pick up the good of a solution's next move and point at where it goes. */
async function showHint(): Promise<boolean> {
  busy = true;
  let m: Move | null = null;
  try {
    m = await hintInWorker(board);
  } finally {
    busy = false;
  }
  if (!m) {
    toast(t("noHint"), 3600);
    return false;
  }
  if (m[0] === 1) {
    coach.pointAt(() => {
      const r = $("btn-turn").getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top };
    });
  } else {
    select({ shelf: m[1], spot: m[2] });
    const target = m[0] === 0 ? m[3] : -1;
    coach.pointAt(() => {
      if (target >= 0 && target !== S()) return view.shelfClient(target);
      const r = $(m![0] === 2 ? "customer" : "basket").getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top };
    });
  }
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
  if (id === "basket" && board.basket > 0) return void toast(t("pu_basket_desc"));
  if (id === "brake" && !def.turns) return void toast(t("pu_brake_desc"));
  if (d().inv[id] <= 0 && !(await acquire(id))) return;
  markTouched();
  select(null);
  if (id === "brake") {
    history.push(cloneBoard(board));
    board.brake = BRAKE_MOVES;
    consume(id);
    sfx.power();
  } else if (id === "basket") {
    history.push(cloneBoard(board));
    board.basket = BASKET_SPOTS;
    consume(id);
    sfx.power();
  } else if (id === "restack") {
    busy = true;
    const nb = await restackInWorker(board).finally(() => (busy = false));
    if (!nb) return void toast(t("noHint"), 3600);
    history.push(cloneBoard(board));
    nb.moves = board.moves;
    board = nb;
    consume(id);
    sfx.power();
    view.snapTo(board);
  } else if (id === "assistant") {
    mode = "assistant";
    toast(t("assistantPrompt"), 4000);
  }
  renderHud();
}

async function onAssistant(kind: number): Promise<void> {
  mode = "play";
  if (kind === EMPTY) return renderHud();
  const before = cloneBoard(board);
  const events: GameEvent[] = [];
  if (!assistSell(board, kind, events)) {
    refuse(t("assistantNo"));
    return renderHud();
  }
  history.push(before);
  consume("assistant");
  sfx.power();
  busy = true;
  await view.play(events, board, onEvent);
  busy = false;
  afterChange();
}

function consume(id: PowerUpId): void {
  d().inv[id] = Math.max(0, d().inv[id] - 1);
  if (puInfo(id).capsStars) lvl.capped = true;
  save.touch();
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

/** Every triple sold ticks a crate on the display; one catch-up tick for a part not on the stand. */
function tickDisplay(): void {
  const ids: string[] = [];
  lvl.counts.forEach((c, k) => {
    const id = GOODS[goodsOf[k]].id;
    ids.push(id);
    for (let i = 0; i < Math.floor(c / SPOTS); i++) display.tick(id);
  });
  display.topUp(ids);
}

async function winLevel(): Promise<void> {
  busy = true;
  coach.clear();
  platform.gameplayStop();
  const n = def.n;
  const stars = lvl.easier ? 1 : starsFor(board.moves, def.par, lvl.capped);
  const perfect = !lvl.easier && board.moves <= def.par;
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
  tickDisplay();
  d().display = display.serialize();
  const displayDone = display.complete;
  const disp = display.display;
  let reward: PowerUpId | null = null;
  if (displayDone) {
    if (display.encore) d().encores++;
    else if (!d().finished.includes(disp.id)) d().finished.push(disp.id);
    const unlocked = POWER_UPS.filter((p) => n >= p.unlockLevel).map((p) => p.id);
    reward = unlocked.length ? unlocked[Math.floor(Math.random() * unlocked.length)] : "brake";
    d().inv[reward]++;
  }
  recordSkill((board.moves + 1) / (def.par + 1));
  save.touch();
  await save.flush();
  restarts.delete(n);
  if ((stars === 3 && firstTry) || displayDone) platform.happyTime();
  if (displayDone) sfx.display();
  else sfx.win();
  haptic(displayDone ? "celebrate" : "success");
  let doubled = false;
  const snap = { display: disp, filled: displayDone ? disp.parts.map((p) => p.need) : display.filled.slice() };
  await ui.openModal((box, close) => {
    box.innerHTML = `<h2>${displayDone ? t("displayComplete") : perfect ? t("perfectLevel") : t("levelComplete")}</h2>`;
    box.append(starsRow(stars));
    const card = document.createElement("div");
    card.innerHTML = displayHtml(snap, true);
    box.append(card);
    if (displayDone) box.append(para(`${disp.icon} ${disp.name} · +1 ${t(`pu_${reward}`)}`));
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
  if (interstitialDue(ECONOMY.interstitial, n, d().levelsSinceAd, { noAds: d().noAds, justRewarded: doubled, celebration: displayDone })) {
    sfx.synth.setHostSuspended(true);
    const shown = await platform.interstitial(ECONOMY.interstitial.minGapSec);
    sfx.synth.setHostSuspended(false);
    if (shown) d().levelsSinceAd = 0;
  }
  if (displayDone) {
    for (const s of openedShops(d().finished)) {
      const id = SHOPS[s].id;
      if (d().shopsOpened.includes(id)) continue;
      d().shopsOpened.push(id);
      await showShopOpened(s);
    }
    const before = disp.shop;
    const next = nextDisplay(d().finished, d().totalStars, d().encores);
    display = new DisplayProgress(next.index, [], next.encore);
    d().display = display.serialize();
    if (!next.encore && display.display.shop !== before) setTimeout(() => toast(t("shopUnlocked", { name: t(`shop_${SHOPS[display.display.shop].id}`) }), 4000), 600);
  }
  save.touch();
  busy = false;
  await startLevel(n + 1);
}

function showShopOpened(s: number): Promise<void> {
  const shop = SHOPS[s];
  const theme = shopReward(shop.id);
  if (theme && !d().cosmetics.owned.includes(theme.id)) d().cosmetics.owned.push(theme.id);
  save.touch();
  platform.happyTime();
  sfx.display();
  return ui.openModal((box, close) => {
    box.innerHTML = `<div class="big-icon">${shop.icon}</div><h2>${t("shopOpened")}</h2>`;
    box.append(para(t(`shop_${shop.id}`)));
    if (theme) {
      const sw = document.createElement("div");
      sw.className = "skin-reward";
      sw.innerHTML = `<span class="swatch" style="background:${theme.swatch}"></span><b>${t("rewardTheme", { name: t(theme.id) })}</b>`;
      box.append(sw, button(t("equip"), "green", () => (equip(theme.id), close())));
    }
    box.append(button(`${t("next")} ▸`, "", close));
  });
}

// ---------------------------------------------------------------- Main Street

function showStreet(): Promise<void> {
  return ui.openModal(
    (box, close) => {
      box.innerHTML = `<h2>${t("street")}</h2>`;
      const card = document.createElement("div");
      card.innerHTML = displayHtml(display, true);
      box.append(card, para(`${t("displayProgress", { done: display.done, total: display.total })}`));
      const street = document.createElement("div");
      street.className = "street";
      SHOPS.forEach((shop, s) => {
        const open = shopOpen(s, d().totalStars);
        const ds = DISPLAYS.filter((x) => x.shop === s);
        const done = ds.filter((x) => d().finished.includes(x.id)).length;
        const f = document.createElement("div");
        f.className = `front${open ? "" : " locked"}${d().shopsOpened.includes(shop.id) ? " open" : ""}${display.display.shop === s && !display.encore ? " now" : ""}`;
        f.style.setProperty("--a", shop.awning[0]);
        f.style.setProperty("--b", shop.awning[1]);
        f.innerHTML = `<span class="ic">${open ? shop.icon : "🔒"}</span>${t(`shop_${shop.id}`)}<br><span class="n">${open ? `${done}/8` : t("shopNeedsStars", { n: SHOP_STARS[s] })}</span>`;
        const win = document.createElement("div");
        win.className = "windows";
        win.innerHTML = ds.map((x) => `<span class="${d().finished.includes(x.id) ? "done" : ""}">${d().finished.includes(x.id) ? x.icon : ""}</span>`).join("");
        f.append(win);
        street.append(f);
      });
      box.append(street, para(t("totalStars", { n: d().totalStars })), button(t("close"), "plain", close));
    },
    { dismissable: true },
  );
}

// ---------------------------------------------------------------- cosmetics & shop

function applyCosmetics(): void {
  const c = d().cosmetics;
  const st = cosmetic(c.stand).stand ?? cosmetic(DEFAULT_EQUIPPED.stand).stand!;
  const aw = cosmetic(c.awning).awning ?? cosmetic(DEFAULT_EQUIPPED.awning).awning!;
  const bag = cosmetic(c.bag).bag ?? "🛍️";
  const th = cosmetic(c.theme).theme ?? cosmetic(DEFAULT_EQUIPPED.theme).theme!;
  view.bagIcon = bag;
  view.applyStyle({ wood: st.wood, plank: st.plank, trim: th.trim });
  document.body.style.background = th.bg;
  document.body.dataset.dark = th.dark ? "1" : "0";
  const root = document.documentElement.style;
  root.setProperty("--awning-a", aw[0]);
  root.setProperty("--awning-b", aw[1]);
  root.setProperty("--trim", th.trim);
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
    { id: "stand", label: t("shopStand") },
    { id: "awning", label: t("shopAwning") },
    { id: "bag", label: t("shopBag") },
    { id: "theme", label: t("shopTheme") },
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
    albumLabel: (id) => t(`shop_${id}`),
    extraTab: ex
      ? {
          id: "store",
          label: t("storeTab"),
          render: (box, grid) => {
            for (const p of ex.PRODUCTS) {
              const info = ex.productInfo(p.id);
              const card = document.createElement("div");
              card.className = "shop-card";
              card.innerHTML = `<span class="swatch" style="background:radial-gradient(circle,#ffd29a,#d9382f)"></span><span class="name">${t(p.id)}</span>`;
              const owned = (p.id === "aisle_remove_ads" && d().noAds) || (!p.consumable && info?.owned);
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
    case "aisle_remove_ads":
      d().noAds = true;
      break;
    case "aisle_starter_pack":
      d().coins += 2000;
      for (const k of Object.keys(inv) as PowerUpId[]) inv[k] += 3;
      break;
    case "aisle_coins_small":
      d().coins += 1000;
      break;
    case "aisle_coins_medium":
      d().coins += 3000;
      break;
    case "aisle_coins_large":
      d().coins += 8000;
      break;
    case "aisle_powerup_bundle":
      inv.brake += 5;
      inv.basket += 3;
      inv.restack += 2;
      inv.assistant += 2;
      break;
    case "aisle_cosmetics_all":
      for (const c of COSMETICS) if (!c.album && !d().cosmetics.owned.includes(c.id)) d().cosmetics.owned.push(c.id);
      break;
  }
  save.touch();
  sfx.coin();
  if (busy || !started) return;
  renderHud();
}

// ---------------------------------------------------------------- Daily Restock

async function startDaily(): Promise<void> {
  busy = true;
  rollDay();
  const day = utcDayKey();
  toast(t("loadingDaily"), 1500);
  const level = await getDaily(day);
  playMode = "daily";
  // Goods from a display picked by the date (nothing is ticked off in the Daily).
  const keep = display;
  display = new DisplayProgress(new Rng(seedOf(day, "daily-display")).int(0, DISPLAYS.length - 1));
  setupBoard(level, 0);
  display = keep;
  lvl = freshLevelState(false, false);
  view.build(board, goodsOf);
  coach.clear();
  busy = false;
  renderHud();
}

function dailyColour(day: string): string {
  return GOODS[new Rng(seedOf(day, "calendar")).int(0, GOODS.length - 1)].colors[0];
}

function drawStandIcon(g: CanvasRenderingContext2D, x: number, y: number, s: number, hex: string): void {
  g.fillStyle = "#c9935a";
  g.beginPath();
  g.roundRect(x + s * 0.15, y + 1, s * 0.7, s - 2, s * 0.15);
  g.fill();
  g.fillStyle = hex;
  for (const yy of [0.2, 0.55]) {
    g.beginPath();
    g.roundRect(x + s * 0.25, y + s * yy, s * 0.5, s * 0.22, s * 0.06);
    g.fill();
  }
}

async function showDailyCard(justWon = false): Promise<void> {
  const next = await forgeDailyCard(ui, {
    icon: "🛒",
    state: d().daily,
    level: d().level,
    unlockAfter: ECONOMY.dailyLevel,
    inDaily: playMode === "daily",
    justWon,
    rewardedAvailable: platform.rewardedAvailable,
    shareText: (day, r) => dailyShareText("Aisle Nine", "🛒", day, r, currentStreak(d().daily, day)),
    colourOfDay: dailyColour,
    patch: drawStandIcon,
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
  const stars = starsFor(board.moves, def.par, false);
  if (recordDailyWin(d().daily, day, { moves: board.moves, par: def.par, stars })) {
    const coins = 40 + 10 * stars;
    d().coins += coins;
    setTimeout(() => toast(`+${coins} 🪙`), 300);
    if (d().daily.streak % ECONOMY.streakBonusEvery === 0) {
      d().inv.assistant++;
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
      showSettings();
    },
    onChange: () => save.touch(),
    extra: (close) => [
      button(`🛍 ${t("shop")}`, "green", () => (close(), showShop())),
      button(`🏪 ${t("street")}`, "plain", () => (close(), void showStreet())),
      button(`❓ ${t("howToPlay")}`, "plain", () => (close(), void showHelp())),
      button(t("resetProgress"), "plain", async () => {
        if (!confirm(t("resetConfirm"))) return;
        await save.reset();
        display = new DisplayProgress(0);
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
    el.innerHTML = `<h1>${t("title")}</h1><div class="tag">${t("tagline")}</div>${displayHtml(display, true)}`;
    const leave = () => {
      unlockAudio();
      el.remove();
      inModal = ui.modalOpen;
      resolve();
    };
    el.append(button(n > 1 ? t("continueLevel", { n }) : t("play"), "", leave));
    el.append(button(`🛒 ${t("daily")}${d().daily.results[utcDayKey()] ? " ✓" : ""}`, "plain", () => (leave(), void showDailyCard())));
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
    const from = down;
    down = null;
    if (moved < 14) return onTap(view.pick(e.clientX, e.clientY));
    // A drag from a good to a shelf moves it there.
    const a = view.pick(from.x, from.y);
    const b = view.pick(e.clientX, e.clientY);
    if (a && a.spot >= 0 && b && b.shelf !== a.shelf && !busy && !inModal) {
      if (!canTake(board, a.shelf, a.spot)) return refuse(whyNot(a.shelf));
      select(a);
      void tryMove(b.shelf);
    }
  });
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  $("customer").addEventListener("click", () => void onServe());
  $("btn-undo").addEventListener("click", () => void onUndo());
  $("btn-turn").addEventListener("click", () => void onTurn());
  $("btn-restart").addEventListener("click", () => void onRestart());
  $("btn-hint").addEventListener("click", () => void onHint());
  $("btn-menu").addEventListener("click", showSettings);
  $("btn-daily").addEventListener("click", () => !busy && !inModal && void showDailyCard());
  $("coins").addEventListener("click", () => !busy && !inModal && showShop());
  $("side-shop").addEventListener("click", () => !busy && !inModal && showShop());
  $("side-daily").addEventListener("click", () => !busy && !inModal && void showDailyCard());
  $("mini-display-btn").addEventListener("click", () => !inModal && void showStreet());
  $("side-display-btn").addEventListener("click", () => !inModal && void showStreet());
  window.addEventListener("wheel", (e) => e.preventDefault(), { passive: false });
  window.addEventListener("keydown", (e) => {
    if ([" ", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "PageUp", "PageDown"].includes(e.key) && !(e.target instanceof HTMLSelectElement)) e.preventDefault();
    unlockAudio();
    if (inModal || e.repeat) return;
    const k = e.key.toLowerCase();
    if (k === "z") return void onUndo();
    if (k === " ") return void onTurn();
    if (k === "escape") return select(null);
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
  save = new SaveSlot<SaveData>(platform.storage, { key: "aisle-nine", version: SAVE_VERSION, defaults: defaultSave });
  await save.load();
  platform.loadingProgress(0.4);
  if (import.meta.env.DEV) {
    const q = new URLSearchParams(location.search);
    if (q.get("fresh")) await save.reset();
    if (q.get("level")) d().level = Number(q.get("level"));
    if (q.get("coins")) d().coins = Number(q.get("coins"));
    if (q.get("def")) devDef = JSON.parse(atob(q.get("def")!)) as LevelDef;
    (window as unknown as Record<string, unknown>).__aisle = {
      get board() { return board; },
      get def() { return def; },
      get view() { return view; },
      get display() { return display; },
      get busy() { return busy; },
      get goodsOf() { return goodsOf; },
      get sel() { return sel; },
      save,
      platform,
      startLevel,
      tap: (shelf: number, spot = -1) => onTap({ shelf, spot }),
      /** Dev: play one move (as if tapped). */
      move: (m: Move) => play(m),
      /** Dev: play the level's stored solution from the current board (only valid from the start). */
      solve: async () => {
        for (const m of def.sol) if (!isWon(board)) await play(m);
      },
      power: (id: PowerUpId) => onPowerUp(id),
      assistant: (k: number) => onAssistant(k),
      undo: () => onUndo(),
      showStreet,
      drain: () => view.tweens.finishAll(),
      shot: async (name: string, w = 1080, h = 1920) => {
        const canvas = view.renderer.domElement;
        const prev = { w: canvas.clientWidth, h: canvas.clientHeight, dpr: view.renderer.getPixelRatio() };
        view.renderer.setPixelRatio(1);
        view.resize(w, h);
        view.setSafeArea(h * 0.08, h * 0.16);
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
  // Phone app only: purchases and the daily reminder (never part of web builds).
  if (import.meta.env.VITE_PLATFORM === "app") {
    appExtras = await import("./game/app-extras.ts");
    await appExtras.initStore(grantProduct).catch((err) => console.warn("[aisle-nine] store unavailable", err));
  }
  sfx.synth.setMuted(!d().settings.sound);
  setHapticsEnabled(d().settings.haptics);
  music.setEnabled(d().settings.music);
  display = new DisplayProgress(d().display.index, d().display.filled, d().display.encore);
  view = new StandView($<HTMLCanvasElement>("board"));
  applyCosmetics();
  const resize = () => {
    const wide = window.innerWidth >= 760 && window.innerWidth / window.innerHeight > 1.15;
    document.body.classList.toggle("wide", wide);
    const canvas = $<HTMLCanvasElement>("board");
    view.resize(canvas.clientWidth, canvas.clientHeight);
    const cr = canvas.getBoundingClientRect();
    view.setSafeArea(Math.max(0, $("hud-sub").getBoundingClientRect().bottom - cr.top + 6), Math.max(0, cr.bottom - $("counter").getBoundingClientRect().top + 8));
    redrawDisplay();
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
  $("loading").innerHTML = `<p style="padding:20px;text-align:center">Something went wrong loading Aisle Nine.<br>${String(err)}</p>`;
});
