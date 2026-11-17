// Main Street (DESIGN.md §4 Progression): 6 shops × 8 displays. A display lists goods to sell, in
// triples (crates); every triple sold ticks one crate off the current display. Shops open by stars.

import { GOODS, GOOD_INDEX, SHOPS } from "./goods.ts";

export interface DisplayPart {
  good: string;
  need: number;
}

export interface Display {
  id: string;
  name: string;
  shop: number;
  parts: DisplayPart[];
  icon: string;
}

/** Total stars needed to open each shop. */
export const SHOP_STARS = [0, 60, 150, 250, 360, 480];

// [name, icon, [good, weight]...] per shop, 8 each. Weights are shared out over the display's total.
const RAW: Array<Array<[string, string, Array<[string, number]>]>> = [
  [
    ["Fruit Stand", "🍎", [["apple", 3], ["lemon", 2]]],
    ["Dairy Fridge", "🥛", [["milk", 3], ["eggs", 2]]],
    ["Breakfast Shelf", "🥣", [["cereal", 3], ["milk", 2], ["juice", 2]]],
    ["Pantry", "🥫", [["soup", 3], ["jam", 2]]],
    ["Juice Bar", "🧃", [["juice", 3], ["lemon", 2], ["apple", 2]]],
    ["Picnic Corner", "🧺", [["jam", 2], ["eggs", 2], ["apple", 2]]],
    ["Soup Aisle", "🍲", [["soup", 3], ["cereal", 2], ["milk", 1]]],
    ["Grand Grocery", "🛒", [["apple", 2], ["milk", 2], ["soup", 2], ["juice", 2]]],
  ],
  [
    ["Bread Basket", "🍞", [["loaf", 3], ["baguette", 2]]],
    ["Morning Pastries", "🥐", [["croissant", 3], ["cookie", 2]]],
    ["Cupcake Tower", "🧁", [["cupcake", 3], ["donut", 2]]],
    ["Donut Wall", "🍩", [["donut", 3], ["cookie", 2]]],
    ["Cake Stand", "🍰", [["cake", 3], ["cupcake", 2]]],
    ["Pie Window", "🥧", [["pie", 3], ["loaf", 2]]],
    ["Cookie Jar", "🍪", [["cookie", 3], ["croissant", 2], ["baguette", 1]]],
    ["Wedding Order", "🎂", [["cake", 2], ["cupcake", 2], ["pie", 2], ["donut", 2]]],
  ],
  [
    ["Ball Pit", "⚽", [["ball", 3], ["block", 2]]],
    ["Bath Time", "🦆", [["duck", 3], ["ball", 2]]],
    ["Building Corner", "🧱", [["block", 3], ["robot", 2]]],
    ["Teddy Shelf", "🧸", [["teddy", 3], ["duck", 2]]],
    ["Race Track", "🚗", [["car", 3], ["top", 2]]],
    ["Space Corner", "🚀", [["rocket", 3], ["robot", 2]]],
    ["Spinning Tops", "🪀", [["top", 3], ["block", 2], ["car", 1]]],
    ["Toy Parade", "🎠", [["teddy", 2], ["rocket", 2], ["car", 2], ["duck", 2]]],
  ],
  [
    ["Potting Bench", "🪴", [["plant", 3], ["soil", 2]]],
    ["Desert Corner", "🌵", [["cactus", 3], ["plant", 2]]],
    ["Sunny Border", "🌻", [["sunflower", 3], ["seeds", 2]]],
    ["Seed Rack", "🌱", [["seeds", 3], ["wateringcan", 2]]],
    ["Watering Station", "🚿", [["wateringcan", 3], ["soil", 2]]],
    ["Gnome Garden", "🧙", [["gnome", 3], ["birdhouse", 2]]],
    ["Bird Corner", "🐦", [["birdhouse", 3], ["sunflower", 2], ["seeds", 1]]],
    ["Flower Show", "🏵️", [["sunflower", 2], ["cactus", 2], ["gnome", 2], ["plant", 2]]],
  ],
  [
    ["Lollipop Tree", "🍭", [["lollipop", 3], ["candycane", 2]]],
    ["Sweet Jars", "🫙", [["candyjar", 3], ["gumball", 2]]],
    ["Chocolate Box", "🍫", [["chocolate", 3], ["macaron", 2]]],
    ["Gumball Corner", "🔴", [["gumball", 3], ["jellybeans", 2]]],
    ["Macaron Tower", "🟢", [["macaron", 3], ["chocolate", 2]]],
    ["Winter Treats", "🍬", [["candycane", 3], ["icecream", 2]]],
    ["Ice Cream Cart", "🍦", [["icecream", 3], ["lollipop", 2], ["jellybeans", 1]]],
    ["Candy Carnival", "🎪", [["lollipop", 2], ["chocolate", 2], ["icecream", 2], ["candyjar", 2]]],
  ],
  [
    ["New Books", "📘", [["book", 3], ["notebook", 2]]],
    ["Map Room", "🌍", [["globe", 3], ["scroll", 2]]],
    ["Reading Nook", "☕", [["mug", 3], ["lamp", 2]]],
    ["Stationery", "✏️", [["pencils", 3], ["notebook", 2]]],
    ["Lamp Corner", "💡", [["lamp", 3], ["book", 2]]],
    ["Old Scrolls", "📜", [["scroll", 3], ["hourglass", 2]]],
    ["Story Hour", "⏳", [["hourglass", 3], ["mug", 2], ["pencils", 1]]],
    ["Grand Library", "🏛️", [["book", 2], ["globe", 2], ["lamp", 2], ["hourglass", 2]]],
  ],
];

/** Crates a display needs: grows a little through the street. */
export function totalFor(i: number): number {
  return 44 + Math.min(20, i);
}

export const DISPLAYS: Display[] = RAW.flatMap((shop, si) =>
  shop.map(([name, icon, parts], di) => {
    const i = si * 8 + di;
    const total = totalFor(i);
    const wsum = parts.reduce((a, [, w]) => a + w, 0);
    let left = total;
    const out = parts.map(([good, w], k) => {
      const need = k === parts.length - 1 ? left : Math.max(2, Math.round((total * w) / wsum));
      left -= need;
      return { good, need };
    });
    return { id: `${SHOPS[si].id}_${di}`, name, shop: si, parts: out, icon };
  }),
);

export function displaysOfShop(shop: number): Display[] {
  return DISPLAYS.filter((d) => d.shop === shop);
}

// Sanity: every display's goods exist.
for (const d of DISPLAYS) for (const p of d.parts) if (GOOD_INDEX[p.good] === undefined) throw new Error(`display ${d.id}: unknown good ${p.good}`);
void GOODS;
