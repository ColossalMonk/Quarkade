// Phone-app-only features (DESIGN.md §6): Density's in-app products and the Daily Brew reminder,
// on top of forge's shared store/reminder code. Imported only when VITE_PLATFORM === "app".

import { makeAppExtras } from "../../../../forge/src/app/app-extras.ts";
import type { IapProduct } from "../../../../forge/src/app/app-extras.ts";

export const PRODUCTS: IapProduct[] = [
  { id: "density_remove_ads", consumable: false },
  { id: "density_starter_pack", consumable: false },
  { id: "density_coins_small", consumable: true },
  { id: "density_coins_medium", consumable: true },
  { id: "density_coins_large", consumable: true },
  { id: "density_powerup_bundle", consumable: true },
  { id: "density_cosmetics_all", consumable: false },
];

export const { initStore, productInfo, buy, restore, setDailyReminder } = makeAppExtras(PRODUCTS, 4102);
