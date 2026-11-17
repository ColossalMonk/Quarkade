// Phone-app-only features (DESIGN.md §6): Snug Bento's in-app products and the Daily Bento reminder,
// on top of forge's shared store/reminder code. Imported only when VITE_PLATFORM === "app".

import { makeAppExtras } from "../../../../forge/src/app/app-extras.ts";
import type { IapProduct } from "../../../../forge/src/app/app-extras.ts";

export const PRODUCTS: IapProduct[] = [
  { id: "bento_remove_ads", consumable: false },
  { id: "bento_starter_pack", consumable: false },
  { id: "bento_coins_small", consumable: true },
  { id: "bento_coins_medium", consumable: true },
  { id: "bento_coins_large", consumable: true },
  { id: "bento_powerup_bundle", consumable: true },
  { id: "bento_cosmetics_all", consumable: false },
];

export const { initStore, productInfo, buy, restore, setDailyReminder } = makeAppExtras(PRODUCTS, 4104);
