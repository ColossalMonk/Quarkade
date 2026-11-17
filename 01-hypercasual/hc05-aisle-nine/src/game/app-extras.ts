// Phone-app-only features (DESIGN.md §6): Aisle Nine's in-app products and the Daily Restock reminder,
// on top of forge's shared store/reminder code. Imported only when VITE_PLATFORM === "app".

import { makeAppExtras } from "../../../../forge/src/app/app-extras.ts";
import type { IapProduct } from "../../../../forge/src/app/app-extras.ts";

export const PRODUCTS: IapProduct[] = [
  { id: "aisle_remove_ads", consumable: false },
  { id: "aisle_starter_pack", consumable: false },
  { id: "aisle_coins_small", consumable: true },
  { id: "aisle_coins_medium", consumable: true },
  { id: "aisle_coins_large", consumable: true },
  { id: "aisle_powerup_bundle", consumable: true },
  { id: "aisle_cosmetics_all", consumable: false },
];

export const { initStore, productInfo, buy, restore, setDailyReminder } = makeAppExtras(PRODUCTS, 4105);
