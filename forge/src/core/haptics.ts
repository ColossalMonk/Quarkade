// Haptics: does nothing on most desktop browsers, vibrates on Android browsers.
// In the Capacitor app build, setHapticsBackend() swaps in Capacitor Haptics.

export type HapticKind = "tick" | "light" | "medium" | "heavy" | "success" | "error" | "celebrate";

const PATTERNS: Record<HapticKind, number | number[]> = {
  tick: 6,
  light: 10,
  medium: 18,
  heavy: 30,
  success: [12, 40, 18],
  error: [14, 50, 14],
  celebrate: [20, 40, 20, 40, 40],
};

type Backend = (kind: HapticKind) => void;

let enabled = true;
let backend: Backend = (kind) => {
  // Browsers block (and log an error for) vibrate() before the user has interacted.
  const activation = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation;
  if (activation && !activation.hasBeenActive) return;
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    try {
      navigator.vibrate(PATTERNS[kind]);
    } catch {
      /* some browsers throw without a user gesture */
    }
  }
};

export function setHapticsBackend(fn: Backend): void {
  backend = fn;
}

export function setHapticsEnabled(on: boolean): void {
  enabled = on;
}

export function haptic(kind: HapticKind): void {
  if (enabled) backend(kind);
}
