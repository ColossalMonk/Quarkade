// requestAnimationFrame loop with a clamped delta time.

export class Loop {
  private raf = 0;
  private last = 0;
  private running = false;
  private paused = false;

  private readonly tick: (dt: number, time: number) => void;

  constructor(tick: (dt: number, time: number) => void) {
    this.tick = tick;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const frame = (now: number) => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000));
      this.last = now;
      if (!this.paused) this.tick(dt, now / 1000);
    };
    this.raf = requestAnimationFrame(frame);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    this.last = performance.now();
  }
}
