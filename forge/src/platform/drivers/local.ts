// Development driver: no portal. Ads are simulated with an on-screen card so ad flows
// (pause, mute, reward, cancel) can be tested without any SDK.

import type { DriverHooks, PlatformDriver } from "../types.ts";
import { createLocalStorage } from "../../core/save.ts";

function fakeAd(kind: "interstitial" | "rewarded"): Promise<boolean> {
  return new Promise((resolve) => {
    const wrap = document.createElement("div");
    wrap.setAttribute("data-forge-fake-ad", kind);
    wrap.style.cssText =
      "position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;" +
      "background:rgba(20,16,30,.86);color:#fff;font:600 18px system-ui;flex-direction:column;gap:14px;";
    const label = document.createElement("div");
    label.textContent = kind === "rewarded" ? "Rewarded ad (dev)" : "Interstitial ad (dev)";
    const timer = document.createElement("div");
    timer.style.cssText = "font-size:42px;font-weight:800";
    const row = document.createElement("div");
    row.style.cssText = "display:flex;gap:10px";
    const close = document.createElement("button");
    close.textContent = kind === "rewarded" ? "Finish (reward)" : "Close";
    const cancel = document.createElement("button");
    cancel.textContent = "Skip (no reward)";
    for (const b of [close, cancel]) {
      b.style.cssText = "font:600 15px system-ui;padding:10px 16px;border-radius:10px;border:0;cursor:pointer";
    }
    row.append(close);
    if (kind === "rewarded") row.append(cancel);
    wrap.append(label, timer, row);
    document.body.append(wrap);

    let left = kind === "rewarded" ? 2 : 1;
    timer.textContent = String(left);
    const iv = setInterval(() => {
      left -= 1;
      timer.textContent = String(Math.max(0, left));
      if (left <= 0) clearInterval(iv);
    }, 1000);
    const done = (ok: boolean) => {
      clearInterval(iv);
      wrap.remove();
      resolve(ok);
    };
    close.onclick = () => done(true);
    cancel.onclick = () => done(false);
  });
}

export function createLocalDriver(): PlatformDriver {
  let hooks: DriverHooks | null = null;
  return {
    name: "local",
    supportsRewarded: true,
    async init(h) {
      hooks = h;
    },
    loadingProgress() {},
    loadingDone() {},
    firstFrame() {},
    gameplayStart() {},
    gameplayStop() {},
    async interstitial() {
      hooks?.pause();
      await fakeAd("interstitial");
      hooks?.resume();
    },
    async rewarded() {
      hooks?.pause();
      const ok = await fakeAd("rewarded");
      hooks?.resume();
      return ok;
    },
    happyTime() {},
    storage: createLocalStorage(),
    language: () => undefined,
  };
}
