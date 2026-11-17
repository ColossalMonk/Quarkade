// The buy card: get an item by watching an ad or paying coins (DESIGN rule shared by all games).
// Uses i18n keys: watchAd, buyNone, limitReached, close.

import type { Ui } from "./ui.ts";
import { para } from "./ui.ts";
import { t } from "../core/i18n.ts";

export interface BuyCardOptions {
  icon: string;
  title: string;
  desc: string;
  price: number;
  coins: () => number;
  /** Take coins; called only when the player can afford it. */
  spend: (amount: number) => void;
  canWatchAd: boolean;
  /** Show the "limit reached" note (ads exist but the per-level cap is used up). */
  limitReached?: boolean;
  watchAd: () => Promise<boolean>;
  grant: () => void;
  onCoinSound?: () => void;
}

/** Resolves true if the item was granted. */
export async function buyCard(ui: Ui, o: BuyCardOptions): Promise<boolean> {
  let granted = false;
  await ui.openModal(
    (box, close) => {
      box.innerHTML = `<div class="big-icon">${o.icon}</div><h2>${o.title}</h2>`;
      box.append(para(o.desc));
      box.append(
        ui.button(`🎬 ${t("watchAd")}`, "ad", async () => {
          if (await o.watchAd()) {
            granted = true;
            o.grant();
            close();
          }
        }, !o.canWatchAd),
      );
      const affordable = o.coins() >= o.price;
      box.append(
        ui.button(`🪙 ${o.price}`, "", () => {
          if (o.coins() < o.price) return ui.toast(t("buyNone"));
          o.spend(o.price);
          o.onCoinSound?.();
          granted = true;
          o.grant();
          close();
        }, !affordable),
      );
      if (o.limitReached) box.append(para(t("limitReached")));
      box.append(ui.button(t("close"), "plain", close));
    },
    { dismissable: true },
  );
  return granted;
}
