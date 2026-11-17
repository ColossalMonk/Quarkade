// Recipe progress (DESIGN.md §4): which food each piece becomes, and how packed foods tick off the
// current recipe card. The same pattern as Knotwork's quilt, Density's tower and Unbolted's gadget:
// level foods are drawn from what the recipe still needs, so every level moves it forward.

import { Rng, seedOf } from "../../../../forge/src/core/rng.ts";
import type { PieceDef } from "../logic/rules.ts";
import { FOODS, FOOD_INDEX, candidatesFor, sauceFor } from "../data/foods.ts";
import { MENUS, MENU_STARS, RECIPES, recipesOfMenu } from "../data/recipes.ts";
import type { Recipe } from "../data/recipes.ts";

export function menuOpen(i: number, totalStars: number): boolean {
  return totalStars >= (MENU_STARS[i] ?? Infinity);
}

/** Next recipe: the first unfinished one in an open menu, else an Encore of a finished one. */
export function nextRecipe(finished: string[], totalStars: number, encores: number): { index: number; encore: boolean } {
  for (let i = 0; i < RECIPES.length; i++) {
    const r = RECIPES[i];
    if (menuOpen(r.menu, totalStars) && !finished.includes(r.id)) return { index: i, encore: false };
  }
  const done = RECIPES.map((r, i) => ({ r, i })).filter(({ r }) => finished.includes(r.id));
  if (!done.length) return { index: 0, encore: false };
  return { index: done[encores % done.length].i, encore: true };
}

/** Menus whose 8 recipes are all finished. */
export function completedMenus(finished: string[]): string[] {
  return MENUS.filter((_, m) => recipesOfMenu(m).every((r) => finished.includes(r.id))).map((m) => m.id);
}

export class RecipeProgress {
  index: number;
  filled: number[];
  encore: boolean;

  constructor(index: number, filled: number[] = [], encore = false) {
    this.index = index;
    this.filled = this.recipe.parts.map((_, i) => filled[i] ?? 0);
    this.encore = encore;
  }

  get recipe(): Recipe {
    return RECIPES[this.index % RECIPES.length];
  }

  get total(): number {
    return this.recipe.parts.reduce((a, p) => a + p.need, 0);
  }

  get done(): number {
    return this.recipe.parts.reduce((a, p, i) => a + Math.min(p.need, this.filled[i]), 0);
  }

  get complete(): boolean {
    return this.done >= this.total;
  }

  remaining(foodId: string): number {
    return this.recipe.parts.reduce((a, p, i) => a + (p.food === foodId ? Math.max(0, p.need - this.filled[i]) : 0), 0);
  }

  /**
   * A food for every piece: from the foods that fit (size, temperature, soft), the one this recipe
   * needs most, spreading the need over several pieces; sauce cups match the food they touch.
   */
  mapFoods(pieces: PieceDef[], levelNumber: number): number[] {
    const rng = new Rng(seedOf(levelNumber, this.index, "foods"));
    const want = new Map<string, number>(this.recipe.parts.map((p, i) => [p.food, Math.max(0, p.need - this.filled[i])]));
    const out = pieces.map(() => -1);
    const used = new Map<number, number>();
    pieces.forEach((pc, i) => {
      if (pc.sauce !== undefined) return;
      const cands = candidatesFor(pc.c.length, pc.t, !!pc.s, false);
      // Variety first (each food at most twice while others fit), then what the recipe needs most.
      const score = (f: number) => ((used.get(f) ?? 0) >= 2 ? -100 : 0) - (used.get(f) ?? 0) * 3 + Math.min(6, want.get(FOODS[f].id) ?? 0);
      const ranked = rng.shuffle(cands.slice()).sort((a, b) => score(b) - score(a));
      const pick = ranked[0] ?? FOOD_INDEX.rice;
      out[i] = pick;
      used.set(pick, (used.get(pick) ?? 0) + 1);
      const id = FOODS[pick].id;
      if (want.has(id)) want.set(id, Math.max(0, want.get(id)! - 1));
    });
    pieces.forEach((pc, i) => {
      if (pc.sauce === undefined) return;
      const target = out[pc.sauce] >= 0 ? FOODS[out[pc.sauce]].id : "rice";
      // A recipe that needs a sauce gets that sauce when it suits the food.
      const needed = this.recipe.parts.find((p) => FOODS[FOOD_INDEX[p.food]]?.sauce && FOODS[FOOD_INDEX[p.food]].goesWith?.includes(target));
      out[i] = needed ? FOOD_INDEX[needed.food] : sauceFor(target);
    });
    return out;
  }

  /** True if this level can finish the recipe ("Last Dish" label). */
  canFinishWith(foods: number[]): boolean {
    const count = new Map<string, number>();
    for (const f of foods) count.set(FOODS[f].id, (count.get(FOODS[f].id) ?? 0) + 1);
    let left = 0;
    for (const p of this.recipe.parts) {
      const r = this.remaining(p.food);
      if (r > (count.get(p.food) ?? 0)) return false;
      left += r;
    }
    return left > 0;
  }

  /** A packed food ticks one off. Returns the recipe part, or -1 if the recipe doesn't need it. */
  tick(foodId: string): number {
    const i = this.recipe.parts.findIndex((p, j) => p.food === foodId && this.filled[j] < p.need);
    if (i < 0) return -1;
    this.filled[i]++;
    return i;
  }

  /**
   * Catch-up at the end of a level: unfinished parts whose food wasn't in the level get a tick
   * (two by default), so rare foods (sauce cups, soft foods) don't stall a recipe.
   */
  topUp(levelFoods: string[], times = 2): number {
    let last = -1;
    for (let k = 0; k < times; k++) {
      const i = this.recipe.parts.findIndex((p, j) => !levelFoods.includes(p.food) && this.filled[j] < p.need);
      if (i < 0) break;
      this.filled[i]++;
      last = i;
    }
    return last;
  }

  serialize(): { index: number; filled: number[]; encore: boolean } {
    return { index: this.index, filled: this.filled.slice(), encore: this.encore };
  }
}
