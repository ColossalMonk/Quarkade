// Phone app driver (Capacitor): AdMob ads with Google's consent form (UMP) and Apple's tracking
// prompt, saves in Capacitor Preferences, Capacitor Haptics. Loaded only in the `app` build
// (VITE_PLATFORM=app), through a dynamic import, so web builds never include these packages.
//
// Ad unit IDs come from VITE_ADMOB_INTERSTITIAL / VITE_ADMOB_REWARDED. Without them the
// driver uses Google's public TEST ad units, so a debug build never shows real ads by accident.

import { AdMob, InterstitialAdPluginEvents, RewardAdPluginEvents, AdmobConsentStatus } from "@capacitor-community/admob";
import { Preferences } from "@capacitor/preferences";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import { Capacitor } from "@capacitor/core";
import type { PluginListenerHandle } from "@capacitor/core";
import type { DriverHooks, PlatformDriver, PlatformStorage } from "../types.ts";
import { env } from "../load-script.ts";
import { setHapticsBackend } from "../../core/haptics.ts";

const TEST_UNITS = {
  android: { interstitial: "ca-app-pub-3940256099942544/1033173712", rewarded: "ca-app-pub-3940256099942544/5224354917" },
  ios: { interstitial: "ca-app-pub-3940256099942544/4411468910", rewarded: "ca-app-pub-3940256099942544/1712485313" },
};

function adUnit(kind: "interstitial" | "rewarded"): { id: string; test: boolean } {
  const configured = env(kind === "interstitial" ? "VITE_ADMOB_INTERSTITIAL" : "VITE_ADMOB_REWARDED");
  if (configured) return { id: configured, test: false };
  const os = Capacitor.getPlatform() === "ios" ? "ios" : "android";
  return { id: TEST_UNITS[os][kind], test: true };
}

async function removeAll(handles: Array<Promise<PluginListenerHandle>>): Promise<void> {
  for (const h of handles) await h.then((x) => x.remove()).catch(() => {});
}

export function createAppDriver(): PlatformDriver {
  let hooks: DriverHooks | null = null;
  let adsReady = false;

  const storage: PlatformStorage = {
    async getItem(key) {
      return (await Preferences.get({ key })).value;
    },
    async setItem(key, value) {
      await Preferences.set({ key, value });
    },
  };

  return {
    name: "app",
    get supportsRewarded() {
      return adsReady;
    },
    async init(h) {
      hooks = h;
      setHapticsBackend((kind) => {
        if (kind === "success" || kind === "celebrate") void Haptics.notification({ type: NotificationType.Success });
        else if (kind === "error") void Haptics.notification({ type: NotificationType.Error });
        else void Haptics.impact({ style: kind === "heavy" ? ImpactStyle.Heavy : kind === "medium" ? ImpactStyle.Medium : ImpactStyle.Light });
      });
      try {
        // iOS: ask for tracking permission first (App Tracking Transparency).
        if (Capacitor.getPlatform() === "ios") {
          const st = await AdMob.trackingAuthorizationStatus();
          if (st.status === "notDetermined") await AdMob.requestTrackingAuthorization();
        }
        await AdMob.initialize({});
        // Google's consent form (GDPR / UMP) where it's required.
        const consent = await AdMob.requestConsentInfo();
        if (consent.isConsentFormAvailable && consent.status === AdmobConsentStatus.REQUIRED) await AdMob.showConsentForm();
        adsReady = true;
      } catch (err) {
        console.warn("[forge/app] ads unavailable", err);
        adsReady = false;
      }
    },
    loadingProgress() {},
    loadingDone() {},
    firstFrame() {},
    gameplayStart() {},
    gameplayStop() {},
    async interstitial() {
      if (!adsReady) return;
      const unit = adUnit("interstitial");
      const handles: Array<Promise<PluginListenerHandle>> = [];
      try {
        hooks?.pause();
        await AdMob.prepareInterstitial({ adId: unit.id, isTesting: unit.test });
        await new Promise<void>((resolve) => {
          const done = () => resolve();
          handles.push(AdMob.addListener(InterstitialAdPluginEvents.Dismissed, done));
          handles.push(AdMob.addListener(InterstitialAdPluginEvents.FailedToShow, done));
          AdMob.showInterstitial().catch(done);
        });
      } catch {
        /* no fill */
      } finally {
        await removeAll(handles);
        hooks?.resume();
      }
    },
    async rewarded() {
      if (!adsReady) return false;
      const unit = adUnit("rewarded");
      let earned = false;
      const handles: Array<Promise<PluginListenerHandle>> = [];
      try {
        hooks?.pause();
        await AdMob.prepareRewardVideoAd({ adId: unit.id, isTesting: unit.test });
        await new Promise<void>((resolve) => {
          handles.push(AdMob.addListener(RewardAdPluginEvents.Rewarded, () => (earned = true)));
          handles.push(AdMob.addListener(RewardAdPluginEvents.Dismissed, () => resolve()));
          handles.push(AdMob.addListener(RewardAdPluginEvents.FailedToShow, () => resolve()));
          AdMob.showRewardVideoAd().catch(() => resolve());
        });
      } catch {
        earned = false;
      } finally {
        await removeAll(handles);
        hooks?.resume();
      }
      return earned;
    },
    happyTime() {},
    storage,
    language: () => undefined,
  };
}
