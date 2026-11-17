// Tiny typed event emitter.

type Handler<T> = (payload: T) => void;

export class Emitter<Events extends Record<string, unknown>> {
  private handlers: { [K in keyof Events]?: Set<Handler<Events[K]>> } = {};

  on<K extends keyof Events>(name: K, fn: Handler<Events[K]>): () => void {
    let set = this.handlers[name];
    if (!set) {
      set = new Set();
      this.handlers[name] = set;
    }
    set.add(fn);
    return () => set!.delete(fn);
  }

  emit<K extends keyof Events>(name: K, payload: Events[K]): void {
    const set = this.handlers[name];
    if (!set) return;
    for (const fn of [...set]) fn(payload);
  }
}
