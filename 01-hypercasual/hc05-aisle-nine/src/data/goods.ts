// The 48 goods (DESIGN.md §2): 6 shops × 8. Each good is a low-poly model built in code
// (view/goods3d.ts) from a model kind and up to three colours. The emoji is used in the HUD
// (stand map, basket, cart, customers, displays). No brands or real products.

export interface Good {
  id: string;
  shop: number;
  model: string;
  colors: [string, string, string];
  icon: string;
}

export interface Shop {
  id: string;
  icon: string;
  /** Store theme: back wall, floor and the stand's trim. */
  wall: string;
  floor: string;
  trim: string;
  awning: [string, string];
}

export const SHOPS: Shop[] = [
  { id: "grocery", icon: "🛒", wall: "#f3e6cf", floor: "#c9a77c", trim: "#4f9a5a", awning: ["#4f9a5a", "#f6f1e3"] },
  { id: "bakery", icon: "🥐", wall: "#f7e3d0", floor: "#b98a5e", trim: "#c8743c", awning: ["#c8743c", "#fff4e6"] },
  { id: "toys", icon: "🧸", wall: "#e3eefc", floor: "#9cb6d9", trim: "#3f7fd0", awning: ["#3f7fd0", "#ffe36b"] },
  { id: "garden", icon: "🌻", wall: "#e8f3dc", floor: "#a7b98a", trim: "#5b8c3a", awning: ["#5b8c3a", "#f3f8ea"] },
  { id: "sweets", icon: "🍭", wall: "#fbe3ef", floor: "#e0a9c4", trim: "#e0508f", awning: ["#e0508f", "#ffffff"] },
  { id: "books", icon: "📚", wall: "#efe6da", floor: "#8a6a50", trim: "#7a3b3b", awning: ["#7a3b3b", "#f3e9d8"] },
];

const G = (id: string, shop: number, model: string, colors: [string, string, string], icon: string): Good => ({ id, shop, model, colors, icon });

export const GOODS: Good[] = [
  // Corner Grocery
  G("apple", 0, "apple", ["#e0352b", "#5b3a1e", "#4caf50"], "🍎"),
  G("lemon", 0, "lemon", ["#f7d63a", "#e6b81f", "#7cb342"], "🍋"),
  G("milk", 0, "carton", ["#ffffff", "#3f7fd0", "#e8eef7"], "🥛"),
  G("cereal", 0, "tallbox", ["#f2a33a", "#e0352b", "#fff3c4"], "🥣"),
  G("soup", 0, "can", ["#c9342b", "#f4f4f4", "#b8bec7"], "🥫"),
  G("jam", 0, "jar", ["#9c1f3c", "#e9e2d0", "#d94a6a"], "🍯"),
  G("juice", 0, "bottle", ["#f58a1f", "#2e7d32", "#ffd08a"], "🧃"),
  G("eggs", 0, "eggbox", ["#d8c3a0", "#fff8ea", "#bfa47c"], "🥚"),
  // Bakery
  G("loaf", 1, "loaf", ["#c8803c", "#e7b07a", "#8a5226"], "🍞"),
  G("baguette", 1, "baguette", ["#d39249", "#f0c48a", "#a0612a"], "🥖"),
  G("croissant", 1, "croissant", ["#e0a04a", "#f7d08a", "#a96a2a"], "🥐"),
  G("cupcake", 1, "cupcake", ["#f48fb1", "#8d6e63", "#e0352b"], "🧁"),
  G("donut", 1, "donut", ["#d9a066", "#f06292", "#ffffff"], "🍩"),
  G("cookie", 1, "cookie", ["#d6a35c", "#5d3a1a", "#f0c98a"], "🍪"),
  G("cake", 1, "cake", ["#fff1e0", "#f48fb1", "#e0352b"], "🍰"),
  G("pie", 1, "pie", ["#d39249", "#7b1f3c", "#f0c48a"], "🥧"),
  // Toy Shop
  G("ball", 2, "ball", ["#e0352b", "#ffffff", "#3f7fd0"], "⚽"),
  G("duck", 2, "duck", ["#ffd54a", "#f58a1f", "#222222"], "🦆"),
  G("block", 2, "block", ["#3f7fd0", "#ffd54a", "#e0352b"], "🧱"),
  G("teddy", 2, "teddy", ["#a8703c", "#d9a774", "#3b2615"], "🧸"),
  G("car", 2, "car", ["#e0352b", "#222222", "#bfe3ff"], "🚗"),
  G("top", 2, "top", ["#8e5bd6", "#ffd54a", "#5a3a9a"], "🪀"),
  G("rocket", 2, "rocket", ["#f4f4f4", "#e0352b", "#3f7fd0"], "🚀"),
  G("robot", 2, "robot", ["#9eb3c8", "#5a6f86", "#ff6b6b"], "🤖"),
  // Garden Centre
  G("plant", 3, "plant", ["#c86a3c", "#4caf50", "#2e7d32"], "🪴"),
  G("cactus", 3, "cactus", ["#d07a4a", "#5b9a4a", "#f48fb1"], "🌵"),
  G("sunflower", 3, "sunflower", ["#c86a3c", "#ffd54a", "#5d3a1a"], "🌻"),
  G("seeds", 3, "packet", ["#7cb342", "#fff8ea", "#e0352b"], "🌱"),
  G("wateringcan", 3, "wateringcan", ["#3f9fd0", "#2a6f96", "#bfe3ff"], "🚿"),
  G("gnome", 3, "gnome", ["#e0352b", "#3f7fd0", "#f4f4f4"], "🧙"),
  G("soil", 3, "sack", ["#8a5a37", "#5d3a1a", "#7cb342"], "🪨"),
  G("birdhouse", 3, "birdhouse", ["#d9a066", "#c0392b", "#3b2615"], "🏠"),
  // Sweet Shop
  G("lollipop", 4, "lollipop", ["#ff6b9a", "#ffffff", "#ffd54a"], "🍭"),
  G("candyjar", 4, "candyjar", ["#bfe3ff", "#e0352b", "#ffd54a"], "🫙"),
  G("chocolate", 4, "bar", ["#5d3a1a", "#c0392b", "#e7c58f"], "🍫"),
  G("gumball", 4, "gumball", ["#e0352b", "#ffd54a", "#4caf50"], "🔴"),
  G("macaron", 4, "macaron", ["#9be0c0", "#fff8ea", "#f48fb1"], "🟢"),
  G("candycane", 4, "candycane", ["#ffffff", "#e0352b", "#ffffff"], "🍬"),
  G("icecream", 4, "icecream", ["#e0b070", "#f8bbd0", "#fff3e0"], "🍦"),
  G("jellybeans", 4, "pouch", ["#8e5bd6", "#ffd54a", "#4caf50"], "🫘"),
  // Bookshop
  G("book", 5, "book", ["#3f7fd0", "#f4efe2", "#ffd54a"], "📘"),
  G("globe", 5, "globe", ["#3f9fd0", "#4caf50", "#8a5a37"], "🌍"),
  G("mug", 5, "mug", ["#f4f4f4", "#e0352b", "#5d3a1a"], "☕"),
  G("pencils", 5, "pencils", ["#c86a3c", "#ffd54a", "#4caf50"], "✏️"),
  G("lamp", 5, "lamp", ["#4caf50", "#ffd54a", "#5d3a1a"], "💡"),
  G("notebook", 5, "notebook", ["#e0352b", "#f4efe2", "#222222"], "📒"),
  G("scroll", 5, "scroll", ["#efe0bd", "#c0392b", "#8a5a37"], "📜"),
  G("hourglass", 5, "hourglass", ["#8a5a37", "#ffd08a", "#e8f4ff"], "⏳"),
];

export const GOOD_INDEX: Record<string, number> = Object.fromEntries(GOODS.map((g, i) => [g.id, i]));

export function goodsOfShop(shop: number): number[] {
  return GOODS.map((g, i) => (g.shop === shop ? i : -1)).filter((i) => i >= 0);
}
