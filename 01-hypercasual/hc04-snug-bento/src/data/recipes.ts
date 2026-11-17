// Recipes and café menus (DESIGN.md §4 Progression). Each recipe lists foods to pack; every food
// piece in a finished box ticks one off the current recipe. 5 menus × 8 recipes.

export interface RecipePart {
  food: string;
  need: number;
}

export interface Recipe {
  id: string;
  name: string;
  menu: number;
  parts: RecipePart[];
  /** Dish illustration on the menu board: the main food's icon plus a garnish. */
  icon: string;
}

export interface Menu {
  id: string;
  board: string;
  accent: string;
}

export const MENUS: Menu[] = [
  { id: "home", board: "#2f3b2f", accent: "#f5cf4a" },
  { id: "picnic", board: "#2f3b4a", accent: "#e8435f" },
  { id: "festival", board: "#3b2f3b", accent: "#f58a1f" },
  { id: "seaside", board: "#24394a", accent: "#7cc9f2" },
  { id: "space", board: "#1e2238", accent: "#c9d0ff" },
];

// [id, name, menu, icon, [food, weight]...] — weights are shared out over the recipe's total.
const RAW: Array<[string, string, number, string, Array<[string, number]>]> = [
  ["karaage", "Karaage Bento", 0, "🍗", [["karaage", 4], ["rice", 3], ["tamagoyaki", 2], ["broccoli", 2]]],
  ["salmon", "Grilled Salmon Bento", 0, "🐟", [["salmon", 4], ["rice", 3], ["edamame", 2], ["tomato", 2]]],
  ["omelette", "Omelette Bento", 0, "🥚", [["tamagoyaki", 4], ["rice", 3], ["sausage", 2], ["broccoli", 2]]],
  ["onigiri", "Onigiri Set", 0, "🍙", [["onigiri", 3], ["tamagoyaki", 2], ["carrot", 2], ["tomato", 2]]],
  ["noodle", "Cold Noodle Box", 0, "🍜", [["noodles", 4], ["tamagoyaki", 2], ["edamame", 2], ["carrot", 2]]],
  ["gyoza", "Gyoza Bento", 0, "🥟", [["gyoza", 4], ["rice", 3], ["soy", 1], ["broccoli", 2]]],
  ["veggie", "Garden Bento", 0, "🥦", [["broccoli", 3], ["carrot", 3], ["edamame", 3], ["rice", 2]]],
  ["family", "Family Feast", 0, "🍱", [["karaage", 3], ["salmon", 3], ["rice", 3], ["tamagoyaki", 2], ["tomato", 2]]],
  ["sandwich", "Picnic Sandwiches", 1, "🥪", [["tamagoyaki", 3], ["salmon", 2], ["tomato", 2], ["strawberry", 2]]],
  ["berries", "Berry Basket", 1, "🍓", [["strawberry", 3], ["grape", 3], ["fruitsalad", 3], ["jelly", 2]]],
  ["hanami", "Hanami Box", 1, "🌸", [["onigiri", 3], ["jelly", 2], ["tamagoyaki", 2], ["sausage", 2]]],
  ["kid", "Kid's Octopus Box", 1, "🌭", [["sausage", 4], ["rice", 2], ["tomato", 2], ["grape", 2]]],
  ["chicken", "Fried Chicken Picnic", 1, "🍗", [["karaage", 4], ["ketchup", 1], ["carrot", 2], ["strawberry", 2]]],
  ["mochi", "Mochi Party", 1, "🍡", [["mochi", 3], ["fruitsalad", 2], ["strawberry", 2], ["jelly", 2]]],
  ["lemonade", "Sunny Day Box", 1, "🍋", [["fruitsalad", 3], ["tempura", 2], ["edamame", 2], ["tomato", 2]]],
  ["grand", "Grand Picnic", 1, "🧺", [["karaage", 3], ["onigiri", 2], ["fruitsalad", 3], ["tamagoyaki", 2], ["grape", 2]]],
  ["takoyaki", "Festival Bites", 2, "🐙", [["meatball", 4], ["noodles", 3], ["ketchup", 1], ["edamame", 2]]],
  ["yakisoba", "Yakisoba Box", 2, "🍜", [["noodles", 4], ["sausage", 2], ["carrot", 2], ["meatball", 2]]],
  ["tempura", "Tempura Tray", 2, "🍤", [["tempura", 4], ["rice", 3], ["soy", 1], ["broccoli", 2]]],
  ["dumplings", "Steamed Dumplings", 2, "🥟", [["dumpling", 3], ["gyoza", 2], ["soy", 1], ["edamame", 2]]],
  ["skewer", "Skewer Stand", 2, "🍢", [["meatball", 3], ["sausage", 3], ["karaage", 2], ["tomato", 2]]],
  ["sweets", "Festival Sweets", 2, "🍬", [["jelly", 3], ["mochi", 2], ["strawberry", 2], ["grape", 2]]],
  ["lantern", "Lantern Night Box", 2, "🏮", [["gyoza", 3], ["tempura", 2], ["noodles", 2], ["edamame", 2]]],
  ["matsuri", "Matsuri Feast", 2, "🎆", [["karaage", 3], ["noodles", 3], ["meatball", 2], ["jelly", 2], ["tempura", 2]]],
  ["sushi", "Sushi Box", 3, "🍣", [["sushi", 4], ["kappa", 3], ["soy", 1], ["edamame", 2]]],
  ["salmonrice", "Salmon Rice Bowl", 3, "🐟", [["salmon", 4], ["rice", 3], ["kappa", 2], ["tamagoyaki", 2]]],
  ["beach", "Beach Day Box", 3, "🏖️", [["fruitsalad", 3], ["onigiri", 2], ["tempura", 2], ["grape", 2]]],
  ["maki", "Maki Platter", 3, "🍱", [["kappa", 4], ["sushi", 3], ["tamagoyaki", 2], ["soy", 1]]],
  ["harbour", "Harbour Lunch", 3, "⚓", [["salmon", 3], ["tempura", 3], ["rice", 2], ["carrot", 2]]],
  ["coral", "Coral Jelly Box", 3, "🪸", [["jelly", 3], ["mochi", 2], ["fruitsalad", 2], ["strawberry", 2]]],
  ["lighthouse", "Lighthouse Feast", 3, "🗼", [["sushi", 3], ["salmon", 3], ["gyoza", 2], ["edamame", 2]]],
  ["ocean", "Ocean Grand Box", 3, "🌊", [["sushi", 3], ["kappa", 2], ["tempura", 2], ["salmon", 2], ["jelly", 2]]],
  ["moon", "Moon Rice Box", 4, "🌙", [["onigiri", 3], ["rice", 3], ["tamagoyaki", 2], ["edamame", 2]]],
  ["rocket", "Rocket Fuel Box", 4, "🚀", [["karaage", 3], ["sausage", 3], ["meatball", 2], ["ketchup", 1]]],
  ["star", "Star Jelly Box", 4, "⭐", [["jelly", 3], ["mochi", 3], ["grape", 2], ["strawberry", 2]]],
  ["orbit", "Orbit Noodles", 4, "🪐", [["noodles", 4], ["gyoza", 2], ["carrot", 2], ["broccoli", 2]]],
  ["comet", "Comet Sushi", 4, "☄️", [["sushi", 3], ["kappa", 3], ["salmon", 2], ["soy", 1]]],
  ["astronaut", "Astronaut Snack", 4, "👩‍🚀", [["dumpling", 3], ["tempura", 2], ["fruitsalad", 2], ["tomato", 2]]],
  ["galaxy", "Galaxy Platter", 4, "🌌", [["karaage", 2], ["sushi", 2], ["noodles", 2], ["jelly", 2], ["mochi", 2]]],
  ["finale", "Café Grand Finale", 4, "🍱", [["rice", 3], ["salmon", 2], ["karaage", 2], ["tamagoyaki", 2], ["fruitsalad", 2], ["jelly", 2]]],
];

/** Foods a recipe needs in all: ~10 levels each, a little more later on (tune with simulate.ts). */
function totalFor(index: number): number {
  return 30 + Math.min(14, index);
}

/** Sauce cups and soft foods are rare pieces: a recipe asks for only a few of them. */
const RARE_CAP: Record<string, number> = { soy: 1, ketchup: 1, mayo: 1, onigiri: 2, dumpling: 2, mochi: 2 };

export const RECIPES: Recipe[] = RAW.map(([id, name, menu, icon, weights], index) => {
  const total = totalFor(index);
  const sum = weights.reduce((a, [, wgt]) => a + wgt, 0);
  const parts = weights.map(([food, wgt]) => ({ food, need: Math.min(RARE_CAP[food] ?? 99, Math.max(1, Math.round((wgt / sum) * total))) }));
  return { id, name, menu, icon, parts };
});

export function recipesOfMenu(m: number): Recipe[] {
  return RECIPES.filter((r) => r.menu === m);
}

/** Total stars needed to open each menu. */
export const MENU_STARS = [0, 60, 150, 250, 360];
