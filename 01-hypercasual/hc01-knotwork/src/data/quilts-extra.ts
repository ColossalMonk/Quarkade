// Extra quilt albums: Seaside, Sweets and Night Sky. Same format as quilts.ts:
// 8x8 grids written as text, top row first. Letters are yarn keys (palette.ts).

import type { Album, QuiltPicture } from "./quilts.ts";

const q = (id: string, name: string, art: string): QuiltPicture => ({
  id,
  name,
  rows: art
    .trim()
    .split("\n")
    .map((r) => r.replace(/\s+/g, "")),
});

export const EXTRA_ALBUMS: Album[] = [
  {
    id: "seaside",
    name: "Seaside",
    pictures: [
      q("fish", "Fish", `
        s s s s s s s w
        s s o o o s w s
        o s o o o o s s
        o o o o o c o s
        o o o o o o o s
        o s o o o o s s
        s s o o o s s s
        s s s s s s s s`),
      q("crab", "Crab", `
        r s r s s r s r
        s r s s s s r s
        s r c s s c r s
        s r r r r r r s
        r r r r r r r r
        s r r r r r r s
        r s r s s r s r
        y y y y y y y y`),
      q("sailboat", "Sailboat", `
        s s s s b r r s
        s s s w b s s s
        s s w w b w s s
        s w w w b w w s
        w w w w b w w w
        r r r r r r r r
        t r r r r r r t
        t t t t t t t t`),
      q("shell", "Seashell", `
        t t t t t t t t
        t t k k k k t t
        t k w k k w k t
        k w k w w k w k
        k k w k k w k k
        t k k w w k k t
        t t k k k k t t
        t t t t t t t t`),
      q("whale", "Whale", `
        s s w s w s s s
        s s s w s s s s
        s n n n n s n n
        n w n n n n n s
        n n n n n n n s
        n n w w w n s s
        s n n n n s s s
        t t t t t t t t`),
      q("lighthouse", "Lighthouse", `
        n n n r r n n n
        y y n y y n y y
        n n r r r r n n
        n n n w w n n n
        n n n r r n n n
        n n w w w w n n
        n n r r r r n n
        c c c c c c c c`),
      q("anchor", "Anchor", `
        s s s n n s s s
        w s n s s n s s
        s s s n n s s w
        s n n n n n n s
        s s s n n s s s
        n s s n n s s n
        n n s n n s n n
        s n n n n n n s`),
      q("wave", "Wave", `
        s s s s s s s s
        s s s w w w s s
        s s w t t t w s
        s w t t s s w s
        w t t s s s s s
        t t t w s s s w
        t t t t w w w t
        n n n n n n n n`),
    ],
  },
  {
    id: "sweets",
    name: "Sweets",
    pictures: [
      q("cupcake", "Cupcake", `
        s s s r s s s s
        s s k k k k s s
        s k k w k k k s
        k k k k k w k k
        s p w p p w p s
        s p w p p w p s
        s s w p p w s s
        s s p p p p s s`),
      q("icecream", "Ice Cream", `
        s s s k k s s s
        s s k k k k s s
        s k k w k k k s
        s k k k k k k s
        s o b o o b o s
        s s o b b o s s
        s s s o o s s s
        s s s o o s s s`),
      q("donut", "Donut", `
        s s k k k k s s
        s k y k k w k s
        k k k k k k y k
        k w k s s k k k
        k k k s s k w k
        o k y k k k k o
        s o k o o k o s
        s s o o o o s s`),
      q("candy", "Wrapped Candy", `
        y y y y y y y y
        y y y y y y y y
        k y y r r y y k
        k k r w r r k k
        k k r r w r k k
        k y y r r y y k
        y y y y y y y y
        y y y y y y y y`),
      q("cherry", "Cherries", `
        s s s s b g g s
        s s s b b g s s
        s s b s s b s s
        s b s s s s b s
        s r s s s s r s
        r w r s s r w r
        r r r s s r r r
        s r s s s s r s`),
      q("lollipop", "Lollipop", `
        s s k k k k s s
        s k w w w k k s
        s k w k k w k s
        s k w k w w k s
        s k k w w k k s
        s s k k k k s s
        s s s w s s s s
        s s s w s s s s`),
      q("cakeslice", "Cake Slice", `
        s s s s s s r s
        s s s s s k k k
        s s s k k y y y
        s k k y y y y y
        k r r r r r r r
        y y y y y y y y
        y y y y y y y y
        w w w w w w w w`),
      q("strawberry", "Strawberry", `
        w w w g g w w w
        w g g g g g g w
        w r r r r r r w
        r y r r y r r r
        r r r y r r y r
        w r y r r y r w
        w w r r r r w w
        w w w r r w w w`),
    ],
  },
  {
    id: "night",
    name: "Night Sky",
    pictures: [
      q("moon", "Crescent Moon", `
        n n y y y y n n
        n y y y n n n n
        y y y n n n w n
        y y n n n n n n
        y y n n n n n n
        y y y n n w n n
        n y y y n n n n
        n n y y y y n n`),
      q("star", "Star", `
        w n n y y n n n
        n n n y y n n w
        y y y y y y y y
        n y y y y y y n
        n n y y y y n n
        n n y y y y n n
        n y y n n y y n
        n y n n n n y n`),
      q("owl", "Owl", `
        n b n n n n b n
        n b b b b b b n
        b y y b b y y b
        b y c b b c y b
        b b b o o b b b
        b b b b b b b b
        n b b b b b b n
        n o o n n o o n`),
      q("rocket", "Rocket", `
        n n n r r n n n
        n n r r r r n w
        n n w s s w n n
        n n w s s w n n
        w n w w w w n n
        n r w w w w r n
        r r n y y n r r
        n n n y y n n n`),
      q("planet", "Ringed Planet", `
        n n n n n n n y
        n n o o o o n n
        n o o o o o o n
        w o o o o o o w
        n w w w w w w n
        n o o o o o o n
        n n o o o o n n
        y n n n n n n n`),
      q("comet", "Comet", `
        o n n n n n n w
        n o o n n n n n
        n o y y n n n n
        n n y y y n n n
        n n n y y w y n
        w n n n y w w y
        n n n n n y y n
        n n n n n n n n`),
      q("lantern", "Lantern", `
        n n n c c n n n
        n n y y y y n n
        n r o r r o r n
        r r o r r o r r
        r r o r r o r r
        n r o r r o r n
        n n y y y y n n
        n n n o o n n n`),
      q("fox", "Fox", `
        o n n n n n n o
        o o n n n n o o
        o o o o o o o o
        o o c o o c o o
        w o o o o o o w
        n w w o o w w n
        n n w w w w n n
        n n n c c n n n`),
    ],
  },
];
