// Phone-app-only features (DESIGN.md §6): Knotwork's in-app products and the Daily Swatch reminder,
// on top of forge's shared store/reminder code. Imported only when VITE_PLATFORM === "app".

import { makeAppExtras } from "../../../../forge/src/app/app-extras.ts";
import type { IapProduct } from "../../../../forge/src/app/app-extras.ts";

export const PRODUCTS: IapProduct[] = [
  { id: "knotwork_remove_ads", consumable: false },
  { id: "knotwork_starter_pack", consumable: false },
  { id: "knotwork_coins_small", consumable: true },
  { id: "knotwork_coins_medium", consumable: true },
  { id: "knotwork_coins_large", consumable: true },
  { id: "knotwork_powerup_bundle", consumable: true },
  { id: "knotwork_cosmetics_all", consumable: false },
];

export const { initStore, productInfo, buy, restore, setDailyReminder } = makeAppExtras(PRODUCTS, 4101);
