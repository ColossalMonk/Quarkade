// Phone-app-only features (DESIGN.md §6): Unbolted's in-app products and the Daily Teardown reminder,
// on top of forge's shared store/reminder code. Imported only when VITE_PLATFORM === "app".

import { makeAppExtras } from "../../../../forge/src/app/app-extras.ts";
import type { IapProduct } from "../../../../forge/src/app/app-extras.ts";

export const PRODUCTS: IapProduct[] = [
  { id: "unbolted_remove_ads", consumable: false },
  { id: "unbolted_starter_pack", consumable: false },
  { id: "unbolted_coins_small", consumable: true },
  { id: "unbolted_coins_medium", consumable: true },
  { id: "unbolted_coins_large", consumable: true },
  { id: "unbolted_powerup_bundle", consumable: true },
  { id: "unbolted_cosmetics_all", consumable: false },
];

export const { initStore, productInfo, buy, restore, setDailyReminder } = makeAppExtras(PRODUCTS, 4103);
