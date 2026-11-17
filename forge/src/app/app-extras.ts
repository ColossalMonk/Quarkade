// App-only features shared by every Quarkade game: in-app purchases and an opt-in daily reminder.
// Each game wraps this in its own src/game/app-extras.ts (its product list and reminder id) and
// imports that file dynamically, only when VITE_PLATFORM === "app", so web builds never include it.
//
// Purchases use cordova-plugin-purchase (works with Capacitor; exposes the global CdvPurchase).
// Product IDs must be created with the same names in Google Play Console / App Store Connect.

import { LocalNotifications } from "@capacitor/local-notifications";

export interface IapProduct {
  id: string;
  consumable: boolean;
}

interface CdvOffer {
  order(): Promise<unknown>;
}
interface CdvProduct {
  id: string;
  title?: string;
  pricing?: { price: string };
  owned?: boolean;
  getOffer(): CdvOffer | undefined;
}
interface CdvTransaction {
  products: Array<{ id: string }>;
  finish(): Promise<void>;
}
interface CdvStore {
  register(p: Array<{ id: string; type: string; platform: string }>): void;
  when(): { approved(fn: (t: CdvTransaction) => void): unknown };
  initialize(platforms: string[]): Promise<unknown>;
  get(id: string): CdvProduct | undefined;
  restorePurchases(): Promise<unknown>;
}
interface CdvGlobal {
  store: CdvStore;
  ProductType: { CONSUMABLE: string; NON_CONSUMABLE: string };
  Platform: { GOOGLE_PLAY: string; APPLE_APPSTORE: string };
}

function cdv(): CdvGlobal | undefined {
  return (window as unknown as { CdvPurchase?: CdvGlobal }).CdvPurchase;
}

export interface AppExtras {
  PRODUCTS: IapProduct[];
  /** Set up the store. `grant` is called once per approved purchase with its product id. */
  initStore(grant: (productId: string) => void): Promise<boolean>;
  productInfo(id: string): { title: string; price: string; owned: boolean } | null;
  buy(id: string): Promise<void>;
  restore(): Promise<void>;
  /** Opt-in daily reminder at `hour`:00 local time (default 18:00). */
  setDailyReminder(on: boolean, title: string, body: string, hour?: number): Promise<boolean>;
}

export function makeAppExtras(products: IapProduct[], reminderId: number): AppExtras {
  return {
    PRODUCTS: products,
    async initStore(grant) {
      const C = cdv();
      if (!C) return false;
      const platform = /iphone|ipad|ipod/i.test(navigator.userAgent) ? C.Platform.APPLE_APPSTORE : C.Platform.GOOGLE_PLAY;
      C.store.register(products.map((p) => ({ id: p.id, type: p.consumable ? C.ProductType.CONSUMABLE : C.ProductType.NON_CONSUMABLE, platform })));
      C.store.when().approved((t) => {
        for (const p of t.products) grant(p.id);
        void t.finish();
      });
      await C.store.initialize([platform]);
      return true;
    },
    productInfo(id) {
      const p = cdv()?.store.get(id);
      if (!p) return null;
      return { title: p.title ?? id, price: p.pricing?.price ?? "", owned: !!p.owned };
    },
    async buy(id) {
      const offer = cdv()?.store.get(id)?.getOffer();
      if (offer) await offer.order();
    },
    async restore() {
      await cdv()?.store.restorePurchases();
    },
    async setDailyReminder(on, title, body, hour = 18) {
      await LocalNotifications.cancel({ notifications: [{ id: reminderId }] }).catch(() => {});
      if (!on) return true;
      const perm = await LocalNotifications.requestPermissions();
      if (perm.display !== "granted") return false;
      await LocalNotifications.schedule({
        notifications: [{ id: reminderId, title, body, schedule: { on: { hour, minute: 0 }, allowWhileIdle: true } }],
      });
      return true;
    },
  };
}
