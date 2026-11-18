// Koi varieties (DESIGN.md §2, §4): 6 regions × 8, drawn by the koi shader from a pattern id and
// three colours. Variety names are the traditional, generic koi names.

export const PAT = { solid: 0, kohaku: 1, sanke: 2, showa: 3, tancho: 4, asagi: 5, utsuri: 6, ginrin: 7 } as const;

export interface Variety {
  id: string;
  name: string;
  region: number;
  pattern: number;
  /** Base, patches, second patches (or fins). */
  colors: [string, string, string];
}

export interface Region {
  id: string;
  icon: string;
  /** Water: deep, shallow. Bank: stone, grass. */
  deep: string;
  shallow: string;
  stone: string;
  grass: string;
}

export const REGIONS: Region[] = [
  { id: "garden", icon: "🏮", deep: "#1f5f6b", shallow: "#4fa3a5", stone: "#9a9488", grass: "#6f9a4a" },
  { id: "temple", icon: "⛩️", deep: "#23526e", shallow: "#5a9ab8", stone: "#a89a86", grass: "#7a8f4a" },
  { id: "paddies", icon: "🌾", deep: "#3d6a4a", shallow: "#88b06a", stone: "#a48d68", grass: "#9ab35a" },
  { id: "bamboo", icon: "🎋", deep: "#1d5a52", shallow: "#57a08a", stone: "#8c9488", grass: "#4f8a4a" },
  { id: "moon", icon: "🌕", deep: "#14284a", shallow: "#35577e", stone: "#6c7488", grass: "#3a5a5a" },
  { id: "dragon", icon: "🐉", deep: "#164a6a", shallow: "#4aa0c8", stone: "#7d7f86", grass: "#4a7a5a" },
];

/** Total stars needed to reach each region. */
export const REGION_STARS = [0, 60, 150, 250, 360, 480];

const V = (id: string, name: string, region: number, pattern: number, colors: [string, string, string]): Variety => ({ id, name, region, pattern, colors });

export const VARIETIES: Variety[] = [
  // Garden Pond: the classics.
  V("kohaku", "Kohaku", 0, PAT.kohaku, ["#f7f3ec", "#e0352b", "#f7f3ec"]),
  V("ogon", "Ogon", 0, PAT.solid, ["#f2c14e", "#ffe28a", "#f2c14e"]),
  V("tancho", "Tancho", 0, PAT.tancho, ["#f7f3ec", "#e0352b", "#f7f3ec"]),
  V("chagoi", "Chagoi", 0, PAT.solid, ["#a86b3c", "#c98e5a", "#a86b3c"]),
  V("benigoi", "Benigoi", 0, PAT.solid, ["#d9452e", "#f06a46", "#d9452e"]),
  V("shiro", "Shiro Muji", 0, PAT.solid, ["#f4f1ea", "#ffffff", "#f4f1ea"]),
  V("kigoi", "Kigoi", 0, PAT.solid, ["#f2d23a", "#fff07a", "#f2d23a"]),
  V("orenji", "Orenji Ogon", 0, PAT.solid, ["#f2892e", "#ffb15e", "#f2892e"]),
  // Temple Pond.
  V("sanke", "Taisho Sanke", 1, PAT.sanke, ["#f7f3ec", "#e0352b", "#1d1d22"]),
  V("showa", "Showa", 1, PAT.showa, ["#1d1d22", "#e0352b", "#f7f3ec"]),
  V("shiroutsuri", "Shiro Utsuri", 1, PAT.utsuri, ["#1d1d22", "#f7f3ec", "#1d1d22"]),
  V("hiutsuri", "Hi Utsuri", 1, PAT.utsuri, ["#1d1d22", "#e0452e", "#1d1d22"]),
  V("kiutsuri", "Ki Utsuri", 1, PAT.utsuri, ["#1d1d22", "#f2c94e", "#1d1d22"]),
  V("bekko", "Shiro Bekko", 1, PAT.sanke, ["#f7f3ec", "#f7f3ec", "#1d1d22"]),
  V("akabekko", "Aka Bekko", 1, PAT.sanke, ["#e0452e", "#e0452e", "#1d1d22"]),
  V("tanchoshowa", "Tancho Showa", 1, PAT.tancho, ["#1d1d22", "#e0352b", "#f7f3ec"]),
  // Rice Paddies.
  V("asagi", "Asagi", 2, PAT.asagi, ["#7f9fb8", "#e0703e", "#c9d8e4"]),
  V("shusui", "Shusui", 2, PAT.asagi, ["#6f93b8", "#e05a3e", "#3f5f86"]),
  V("matsuba", "Matsuba", 2, PAT.asagi, ["#c99a3e", "#e0b45e", "#4a3a22"]),
  V("akamatsuba", "Aka Matsuba", 2, PAT.asagi, ["#d9532e", "#f07a4e", "#4a2a1a"]),
  V("karashi", "Karashi", 2, PAT.solid, ["#d9b23a", "#f0d06a", "#d9b23a"]),
  V("soragoi", "Soragoi", 2, PAT.solid, ["#8a9aa8", "#aebccb", "#8a9aa8"]),
  V("ochiba", "Ochiba", 2, PAT.kohaku, ["#9aa4ae", "#c98e4a", "#9aa4ae"]),
  V("midorigoi", "Midorigoi", 2, PAT.solid, ["#9ac86a", "#c8ea8a", "#9ac86a"]),
  // Bamboo Stream.
  V("goromo", "Goromo", 3, PAT.kohaku, ["#f7f3ec", "#7a2a5a", "#f7f3ec"]),
  V("koromo", "Ai Goromo", 3, PAT.sanke, ["#f7f3ec", "#e0352b", "#2a3a6a"]),
  V("goshiki", "Goshiki", 3, PAT.sanke, ["#6a7a8a", "#d9452e", "#1d1d22"]),
  V("kumonryu", "Kumonryu", 3, PAT.utsuri, ["#1d1d22", "#f4f1ea", "#1d1d22"]),
  V("hariwake", "Hariwake", 3, PAT.kohaku, ["#e8e8ec", "#f2a83e", "#e8e8ec"]),
  V("kujaku", "Kujaku", 3, PAT.asagi, ["#e8e2d0", "#e0703e", "#8a7a4a"]),
  V("doitsu", "Doitsu Kohaku", 3, PAT.kohaku, ["#f7f3ec", "#e0352b", "#3a3a3a"]),
  V("kikokuryu", "Kikokuryu", 3, PAT.utsuri, ["#d9d9e0", "#1d1d22", "#d9d9e0"]),
  // Moonlit Lake.
  V("platinum", "Platinum Ogon", 4, PAT.solid, ["#e6e9ee", "#ffffff", "#e6e9ee"]),
  V("ginsui", "Ginsui", 4, PAT.asagi, ["#9fb8d0", "#e8eef4", "#6f88a8"]),
  V("kinsui", "Kinsui", 4, PAT.asagi, ["#c9a85a", "#f0d48a", "#6f88a8"]),
  V("hikari", "Hikari Utsuri", 4, PAT.utsuri, ["#2a2a30", "#e8d48a", "#2a2a30"]),
  V("sakura", "Sakura Ogon", 4, PAT.kohaku, ["#f7f0e6", "#f2a0a8", "#f7f0e6"]),
  V("budo", "Budo Goromo", 4, PAT.sanke, ["#f7f3ec", "#6a2a6a", "#3a1a3a"]),
  V("ginrin", "Ginrin Kohaku", 4, PAT.ginrin, ["#f7f3ec", "#e0352b", "#ffffff"]),
  V("beniKumonryu", "Beni Kumonryu", 4, PAT.showa, ["#1d1d22", "#e0452e", "#f4f1ea"]),
  // Dragon Gate: the rare ones.
  V("kinginrin", "Kin Ginrin", 5, PAT.ginrin, ["#f2c14e", "#ffe28a", "#ffffff"]),
  V("yamabuki", "Yamabuki Ogon", 5, PAT.solid, ["#f5d23a", "#fff4a0", "#f5d23a"]),
  V("akahajiro", "Aka Hajiro", 5, PAT.tancho, ["#d9452e", "#f7f3ec", "#d9452e"]),
  V("hajiro", "Hajiro", 5, PAT.utsuri, ["#1d1d22", "#1d1d22", "#f7f3ec"]),
  V("kanoko", "Kanoko Kohaku", 5, PAT.sanke, ["#f7f3ec", "#e0352b", "#e0352b"]),
  V("butterfly", "Butterfly Kohaku", 5, PAT.kohaku, ["#f7f3ec", "#e0352b", "#f7f3ec"]),
  V("ryu", "Dragon Showa", 5, PAT.showa, ["#1d1d22", "#f2c14e", "#f7f3ec"]),
  V("ginga", "Ginga", 5, PAT.ginrin, ["#3a4a6a", "#9fb8d0", "#ffffff"]),
];

export function varietiesOfRegion(r: number): number[] {
  return VARIETIES.map((v, i) => (v.region === r ? i : -1)).filter((i) => i >= 0);
}

/** Sightings a variety needs to be complete in the journal: grows a little up the river. */
export function sightingsFor(region: number): number {
  return 18 + region * 4;
}
