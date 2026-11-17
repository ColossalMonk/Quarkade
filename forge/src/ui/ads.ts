// Rewarded-ad budget shared by every game: per-level and per-day caps overall and per item.
// The day counters live in the game's save (so they survive reloads); level counters reset per level.

export interface AdDay {
  key: string;
  rewarded: number;
  byItem: Record<string, number>;
}

export interface AdCaps {
  perLevel: number;
  perDay: number;
  /** Caps for one item (power-up, undo pack, hint...). Items not listed are only limited overall. */
  item: (id: string) => { perLevel?: number; perDay?: number } | undefined;
}

export class AdBudget {
  private caps: AdCaps;
  private level = { ads: 0, byItem: {} as Record<string, number> };

  constructor(caps: AdCaps) {
    this.caps = caps;
  }

  newLevel(): void {
    this.level = { ads: 0, byItem: {} };
  }

  get adsThisLevel(): number {
    return this.level.ads;
  }

  get levelCapReached(): boolean {
    return this.level.ads >= this.caps.perLevel;
  }

  /** Can the player watch an ad for `item` right now? */
  can(item: string, day: AdDay, rewardedAvailable: boolean): boolean {
    if (!rewardedAvailable) return false;
    if (this.level.ads >= this.caps.perLevel || day.rewarded >= this.caps.perDay) return false;
    const c = this.caps.item(item);
    if (c?.perLevel !== undefined && (this.level.byItem[item] ?? 0) >= c.perLevel) return false;
    if (c?.perDay !== undefined && (day.byItem[item] ?? 0) >= c.perDay) return false;
    return true;
  }

  /** Count a watched (rewarded) ad. */
  record(item: string, day: AdDay): void {
    this.level.ads++;
    this.level.byItem[item] = (this.level.byItem[item] ?? 0) + 1;
    day.rewarded++;
    day.byItem[item] = (day.byItem[item] ?? 0) + 1;
  }
}

export interface InterstitialRule {
  firstLevel: number;
  everyLevels: number;
  minGapSec: number;
}

/** The shared interstitial rule: natural breaks only, never early, never right after a reward. */
export function interstitialDue(rule: InterstitialRule, level: number, levelsSinceAd: number, opts: { noAds?: boolean; justRewarded?: boolean; celebration?: boolean }): boolean {
  if (opts.noAds || opts.justRewarded || opts.celebration) return false;
  return level >= rule.firstLevel && levelsSinceAd >= rule.everyLevels;
}
