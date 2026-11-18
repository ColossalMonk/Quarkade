// Phone-app-only features (DESIGN.md §6): Koi Out's in-app products and the Daily Pond reminder,
// on top of forge's shared store/reminder code. Imported only when VITE_PLATFORM === "app".

import { makeAppExtras } from "../../../../forge/src/app/app-extras.ts";
import type { IapProduct } from "../../../../forge/src/app/app-extras.ts";

export const PRODUCTS: IapProduct[] = [
  { id: "koi_remove_ads", consumable: false },
  { id: "koi_starter_pack", consumable: false },
  { id: "koi_coins_small", consumable: true },
  { id: "koi_coins_medium", consumable: true },
  { id: "koi_coins_large", consumable: true },
  { id: "koi_powerup_bundle", consumable: true },
  { id: "koi_cosmetics_all", consumable: false },
];

export const { initStore, productInfo, buy, restore, setDailyReminder } = makeAppExtras(PRODUCTS, 4106);
