// Where each level comes from: hand-made tutorial (1-20), shipped packs (21+), then the
// runtime generator for anything past the last pack.

export const PACK_SIZE = 500;
export const FIRST_PACK_LEVEL = 21;
/** Packs shipped in public/packs. Raise when more are built. */
export const SHIPPED_PACKS = 6;

export function packIndexFor(n: number): number {
  return Math.floor((n - FIRST_PACK_LEVEL) / PACK_SIZE);
}
