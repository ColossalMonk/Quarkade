// Quilt pictures: 8x8 grids written as text, top row first. Letters are yarn keys (palette.ts).
import { EXTRA_ALBUMS } from "./quilts-extra.ts";
// Albums of 8: Cosy Home and Garden below; Seaside, Sweets and Night Sky in quilts-extra.ts.

export interface QuiltPicture {
  id: string;
  name: string;
  rows: string[]; // 8 strings of 8 letters
}

export interface Album {
  id: string;
  name: string;
  pictures: QuiltPicture[];
}

const q = (id: string, name: string, art: string): QuiltPicture => ({
  id,
  name,
  rows: art
    .trim()
    .split("\n")
    .map((r) => r.replace(/\s+/g, "")),
});

const BASE_ALBUMS: Album[] = [
  {
    id: "home",
    name: "Cosy Home",
    pictures: [
      q("cat", "Cat Face", `
        w o w w w w o w
        w o o w w o o w
        w o o o o o o w
        o o c o o c o o
        o o o o o o o o
        o o o k k o o o
        w o o o o o o w
        w w o o o o w w`),
      q("teacup", "Teacup", `
        s w s w s s s s
        s s w s w s s s
        w w w w w w s s
        w b b b b w w s
        w w w w w w s w
        w w w w w w w s
        s w w w w s s s
        t t t t t t t s`),
      q("house", "House", `
        s s s r r s s s
        s s r r r r s s
        s r r r r r r s
        r r r r r r r r
        s w y w w y w s
        s w w w w w w s
        s w w b b w w s
        g g g b b g g g`),
      q("heart", "Heart", `
        w w w w w w w w
        w r r w w r r w
        r k r r r r r r
        r k r r r r r r
        r r r r r r r r
        w r r r r r r w
        w w r r r r w w
        w w w r r w w w`),
      q("candle", "Candle", `
        n n n y y n n n
        n n y o o y n n
        n n n o o n n n
        n n n w w n n n
        n n n w w n n n
        n n n w w n n n
        n n b b b b n n
        n b b b b b b n`),
      q("cookie", "Cookie", `
        s s o o o o s s
        s o o b o o o s
        o o o o o b o o
        o b o o o o o o
        o o o o b o o o
        o o b o o o b o
        s o o o o o o s
        s s o o o o s s`),
      q("sock", "Sock", `
        s s w w w s s s
        s s r r r s s s
        s s r r r s s s
        s s w w w s s s
        s s r r r s s s
        s s r r r r r s
        s s w r r r r r
        s s w w r r w w`),
      q("plant", "Plant", `
        w w w g g w w w
        w g w g g w g w
        w g g g g g g w
        w w g g g g w w
        w w w g g w w w
        w o o o o o o w
        w w o o o o w w
        w w o o o o w w`),
    ],
  },
  {
    id: "garden",
    name: "Garden",
    pictures: [
      q("sunflower", "Sunflower", `
        s s y y y y s s
        s y y b b y y s
        s y b b b b y s
        s y y b b y y s
        s s y y y y s s
        s s s g g s s s
        s g g g g s s s
        s s s g g s s s`),
      q("mushroom", "Mushroom", `
        g g r r r r g g
        g r w r r w r g
        r r r r r r w r
        r w r r r r r r
        g g w w w w g g
        g g w w w w g g
        g g w w w w g g
        g g g g g g g g`),
      q("snail", "Snail", `
        g g g g g g g g
        g g o o o g g g
        g o b b o o g g
        g o b o b o g g
        g o o b b o g g
        w w o o o o g g
        g w w w w w w w
        g g g g g g g g`),
      q("bee", "Bee", `
        s s w s s w s s
        s w w s w w s s
        s y c y c y y s
        y c y c y c c y
        y c y c y c c y
        s y c y c y y s
        s s s s s s s s
        s s s s s s s s`),
      q("carrot", "Carrot", `
        w w w g w g w w
        w w w g g w w w
        w w o o o w w w
        w w o o o w w w
        w w w o o w w w
        w w w o o w w w
        w w w w o w w w
        w w w w w w w w`),
      q("tulip", "Tulip", `
        s s k s k s k s
        s s k k k k k s
        s s k k k k k s
        s s s k k k s s
        s s s s g s s s
        s g s s g s g s
        s s g s g g s s
        s s s g g s s s`),
      q("ladybug", "Ladybug", `
        g g g c c g g g
        g g c w w c g g
        g r r c c r r g
        r c r r r r c r
        r r r c c r r r
        r c r r r r c r
        g r r r r r r g
        g g r r r r g g`),
      q("wateringcan", "Watering Can", `
        w w w w w w w s
        w t t t w w s w
        t w w t t t t w
        t t t t t t w w
        t t t t t t w w
        w t t t t t w w
        w w w w w w w s
        w w w w w w s w`),
    ],
  },
];

/** All albums: Cosy Home and Garden here, Seaside, Sweets and Night Sky in quilts-extra.ts. */
export const ALBUMS: Album[] = [...BASE_ALBUMS, ...EXTRA_ALBUMS];

export const ALL_PICTURES: Array<{ album: number; index: number; picture: QuiltPicture }> = ALBUMS.flatMap((a, ai) =>
  a.pictures.map((p, pi) => ({ album: ai, index: pi, picture: p })),
);
