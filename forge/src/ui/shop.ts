// The cosmetics shop shared by every game: tabs of items bought with coins or earned from albums,
// plus an optional extra tab (the phone app's real-money store).
// i18n keys: shop, equip, equipped, albumReward, buyNone, close, and the item ids themselves.

import type { Ui } from "./ui.ts";
import { t } from "../core/i18n.ts";

export interface ShopItem {
  id: string;
  tab: string;
  price: number;
  /** Earned by finishing this album/collection (id), not bought. */
  album?: string;
  swatch: string;
}

export interface ShopOptions {
  tabs: Array<{ id: string; label: string }>;
  items: ShopItem[];
  coins: () => number;
  isOwned: (id: string) => boolean;
  inUse: (id: string) => boolean;
  equip: (id: string) => void;
  /** Pay coins and add to owned (the shop checks the price first). */
  buy: (item: ShopItem) => void;
  albumLabel: (albumId: string) => string;
  /** Optional extra tab rendered by the game (e.g. the app store). */
  extraTab?: { id: string; label: string; render: (box: HTMLElement, grid: HTMLElement, repaint: () => void) => void };
}

export function showShop(ui: Ui, o: ShopOptions): Promise<void> {
  let tab = o.tabs[0].id;
  return ui.openModal(
    (box, close) => {
      const paint = () => {
        box.innerHTML = `<h2>${t("shop")}</h2>`;
        const coins = document.createElement("div");
        coins.className = "coins-won";
        coins.textContent = `🪙 ${o.coins()}`;
        box.append(coins);
        const tabs = document.createElement("div");
        tabs.className = "tabs";
        const all = o.extraTab ? [...o.tabs, { id: o.extraTab.id, label: o.extraTab.label }] : o.tabs;
        for (const tb of all) {
          const b = document.createElement("button");
          b.textContent = tb.label;
          b.className = tb.id === tab ? "on" : "";
          b.addEventListener("click", () => {
            tab = tb.id;
            paint();
          });
          tabs.append(b);
        }
        box.append(tabs);
        const grid = document.createElement("div");
        grid.className = "shop-grid";
        if (o.extraTab && tab === o.extraTab.id) {
          o.extraTab.render(box, grid, paint);
          box.append(ui.button(t("close"), "plain", close));
          return;
        }
        for (const item of o.items.filter((i) => i.tab === tab)) {
          const owned = o.isOwned(item.id);
          const used = o.inUse(item.id);
          const card = document.createElement("div");
          card.className = "shop-card" + (used ? " in-use" : "");
          card.innerHTML = `<span class="swatch" style="background:${item.swatch}"></span><span class="name">${t(item.id)}</span>`;
          let btn: HTMLButtonElement;
          if (used) btn = ui.button(t("equipped"), "plain small", () => {}, true);
          else if (owned) btn = ui.button(t("equip"), "green small", () => (o.equip(item.id), paint()));
          else if (item.album) {
            btn = ui.button(`📖 ${o.albumLabel(item.album)}`, "plain small", () => ui.toast(`${t("albumReward")}: ${o.albumLabel(item.album!)}`));
          } else {
            btn = ui.button(`🪙 ${item.price}`, "small", () => {
              if (o.coins() < item.price) return ui.toast(t("buyNone"));
              o.buy(item);
              o.equip(item.id);
              paint();
            }, o.coins() < item.price);
          }
          card.append(btn);
          grid.append(card);
        }
        box.append(grid);
        box.append(ui.button(t("close"), "plain", close));
      };
      paint();
    },
    { dismissable: true },
  );
}
