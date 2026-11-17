# Knotwork — Phone app build

The app is the same game wrapped with **Capacitor 8**. The `app` build uses forge's app driver (`forge/src/platform/drivers/app.ts`) for:
- AdMob ads, Google's consent form (UMP) and Apple's tracking prompt (ATT)
- saves through Capacitor Preferences
- phone vibration through Capacitor Haptics

It also adds `src/game/app-extras.ts` for in-app purchases (cordova-plugin-purchase) and the opt-in daily reminder (Local Notifications).

The Android project has been generated in `android/`. **It has not been compiled here:** this machine has no JDK or Android SDK.

## One-time setup
1. Install **Android Studio**. It includes a JDK and the Android SDK.
2. iOS needs a Mac with Xcode. Run `npx cap add ios` there.

## Build and run (Android)
From `Quarkade/`:

```bash
node forge/tools/build-all.ts 01-hypercasual/hc01-knotwork app
```

```bash
cd 01-hypercasual/hc01-knotwork && node ../../node_modules/@capacitor/cli/bin/capacitor sync android
```

Then open `01-hypercasual/hc01-knotwork/android` in Android Studio and press Run.

**App icon and splash** (source: `resources/icon.png`, 1024×1024):

```bash
cd 01-hypercasual/hc01-knotwork && npx @capacitor/assets generate --android --iconBackgroundColor "#f1dbbb" --splashBackgroundColor "#f1dbbb"
```

## Before release
- **AdMob:**
  - Put your App ID in `android/app/src/main/AndroidManifest.xml`; it currently holds Google's test ID.
  - Build with `VITE_ADMOB_INTERSTITIAL=...` and `VITE_ADMOB_REWARDED=...`. Without them the app uses Google's test ad units.
- **In-app products:** create the product IDs listed in `STORE.md` in Play Console and App Store Connect.
- **App ID:** `com.quarkade.knotwork` in `capacitor.config.json`. Change it if you rename the game; it can't change after the first upload.
- **Privacy policy:** host `legal/privacy.html` and add its URL to the store listing.
- **Test on a real low-end Android phone:**
  - 60 fps on a 12-needle level
  - ads, the consent form, purchases (with test accounts) and the reminder
