// Minimal tween manager. Call tweens.update(dt) once per frame.

export type Ease = (t: number) => number;

export const ease = {
  linear: (t: number) => t,
  inQuad: (t: number) => t * t,
  outQuad: (t: number) => 1 - (1 - t) * (1 - t),
  inOutQuad: (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  outCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outBack: (t: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  outElastic: (t: number) => {
    if (t === 0 || t === 1) return t;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
  },
};

interface Tween {
  elapsed: number;
  duration: number;
  delay: number;
  ease: Ease;
  onUpdate: (t: number) => void;
  resolve: () => void;
  cancelled: boolean;
}

export class Tweens {
  private list: Tween[] = [];

  /** Runs onUpdate(easedT) from 0 to 1 over `duration` seconds. Resolves when done. */
  to(duration: number, onUpdate: (t: number) => void, opts: { ease?: Ease; delay?: number } = {}): Promise<void> {
    return new Promise((resolve) => {
      this.list.push({
        elapsed: 0,
        duration: Math.max(0.0001, duration),
        delay: opts.delay ?? 0,
        ease: opts.ease ?? ease.outCubic,
        onUpdate,
        resolve,
        cancelled: false,
      });
    });
  }

  wait(seconds: number): Promise<void> {
    return this.to(seconds, () => {}, { ease: ease.linear });
  }

  update(dt: number): void {
    if (this.list.length === 0) return;
    const current = this.list;
    this.list = [];
    const keep: Tween[] = [];
    for (const tw of current) {
      if (tw.cancelled) continue;
      if (tw.delay > 0) {
        tw.delay -= dt;
        keep.push(tw);
        continue;
      }
      tw.elapsed += dt;
      const raw = Math.min(1, tw.elapsed / tw.duration);
      tw.onUpdate(tw.ease(raw));
      if (raw >= 1) tw.resolve();
      else keep.push(tw);
    }
    this.list = keep.concat(this.list); // plus any tweens started from inside onUpdate
  }

  get busy(): boolean {
    return this.list.length > 0;
  }

  /** Finish every running tween immediately. */
  finishAll(): void {
    const list = this.list;
    this.list = [];
    for (const tw of list) {
      tw.onUpdate(1);
      tw.resolve();
    }
  }
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
