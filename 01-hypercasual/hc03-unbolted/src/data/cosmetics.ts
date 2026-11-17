// Cosmetics (DESIGN.md §4 Shop): screwdrivers, plate finishes and pegboards. Workshop rooms give
// a screwdriver each when finished.

export type CosmeticSlot = "driver" | "finish" | "board";

export interface DriverStyle {
  handle: string;
  grip: string;
  shaft: string;
}

export interface BoardStyle {
  /** Shader kind: 0 wood, 1 blueprint, 2 toy room, 3 night shift. */
  kind: number;
  hex: string;
  /** Page background around the board. */
  bg: string;
}

export interface Cosmetic {
  id: string;
  slot: CosmeticSlot;
  price: number;
  /** Room whose completion gives this item (not sold). */
  album?: string;
  swatch: string;
  driver?: DriverStyle;
  /** Plate finish: 0 painted steel, 1 copper, 2 plywood, 3 candy acrylic. */
  finish?: number;
  board?: BoardStyle;
}

export const COSMETICS: Cosmetic[] = [
  { id: "driver_classic", slot: "driver", price: 0, swatch: "linear-gradient(90deg,#e8443a 60%,#c9ced6 60%)", driver: { handle: "#e8443a", grip: "#b72f27", shaft: "#c9ced6" } },
  { id: "driver_chrome", slot: "driver", price: 300, swatch: "linear-gradient(90deg,#dfe4ea,#8d96a3)", driver: { handle: "#d7dde4", grip: "#8d96a3", shaft: "#eef2f6" } },
  { id: "driver_wood", slot: "driver", price: 500, swatch: "linear-gradient(90deg,#b27a45 60%,#c9ced6 60%)", driver: { handle: "#b27a45", grip: "#7d522b", shaft: "#c9ced6" } },
  { id: "driver_neon", slot: "driver", price: 800, swatch: "linear-gradient(90deg,#39ff9a,#2ad4ff)", driver: { handle: "#39ff9a", grip: "#2ad4ff", shaft: "#f4f7ff" } },
  { id: "driver_golden", slot: "driver", price: 1500, swatch: "linear-gradient(90deg,#f7d56b,#c9962b)", driver: { handle: "#f2c94c", grip: "#b8862a", shaft: "#fff1b8" } },
  { id: "driver_garage", slot: "driver", price: 0, album: "garage", swatch: "linear-gradient(90deg,#f58a1f 60%,#33363d 60%)", driver: { handle: "#f58a1f", grip: "#33363d", shaft: "#c9ced6" } },
  { id: "driver_toy", slot: "driver", price: 0, album: "toyshop", swatch: "linear-gradient(90deg,#f06aa8,#f5c518,#2f7fe0)", driver: { handle: "#f06aa8", grip: "#f5c518", shaft: "#2f7fe0" } },
  { id: "driver_clock", slot: "driver", price: 0, album: "clock", swatch: "linear-gradient(90deg,#9a5b2e,#d4af37)", driver: { handle: "#9a5b2e", grip: "#d4af37", shaft: "#e9dcc0" } },
  { id: "driver_ship", slot: "driver", price: 0, album: "ship", swatch: "linear-gradient(90deg,#14b3b0,#f4f1ea)", driver: { handle: "#14b3b0", grip: "#0d6f6d", shaft: "#f4f1ea" } },
  { id: "driver_space", slot: "driver", price: 0, album: "space", swatch: "radial-gradient(circle at 30% 30%,#fff 0 2px,transparent 3px),linear-gradient(90deg,#5966b8,#232b5c)", driver: { handle: "#5966b8", grip: "#232b5c", shaft: "#c9d0ff" } },

  { id: "finish_steel", slot: "finish", price: 0, swatch: "linear-gradient(135deg,#9fb6cc,#f1d58f,#f3b79a)", finish: 0 },
  { id: "finish_copper", slot: "finish", price: 400, swatch: "linear-gradient(135deg,#b86b3d,#f0a070)", finish: 1 },
  { id: "finish_plywood", slot: "finish", price: 600, swatch: "repeating-linear-gradient(0deg,#e2c08f 0 4px,#cfa874 4px 6px)", finish: 2 },
  { id: "finish_candy", slot: "finish", price: 900, swatch: "linear-gradient(135deg,#ff9fd0,#9fe0ff,#c9ff9f)", finish: 3 },

  { id: "board_garage", slot: "board", price: 0, swatch: "radial-gradient(circle,#7a5a3a 0 2px,#d6b88f 3px)", board: { kind: 0, hex: "#d6b88f", bg: "radial-gradient(ellipse at 50% 30%, #f1e1c6 0%, #dcc29d 60%, #c4a47a 100%)" } },
  { id: "board_blueprint", slot: "board", price: 400, swatch: "repeating-linear-gradient(0deg,#2f5f9a 0 6px,#5a86c0 6px 7px)", board: { kind: 1, hex: "#2f5f9a", bg: "radial-gradient(ellipse at 50% 30%, #4f7fb8 0%, #2f5f9a 60%, #1f4272 100%)" } },
  { id: "board_toy", slot: "board", price: 600, swatch: "repeating-linear-gradient(45deg,#ffd6e6 0 6px,#d6ecff 6px 12px)", board: { kind: 2, hex: "#f6dce6", bg: "radial-gradient(ellipse at 50% 30%, #fff1f6 0%, #f3d8e4 60%, #dcb9cb 100%)" } },
  { id: "board_night", slot: "board", price: 1000, swatch: "radial-gradient(circle,#ffd86b 0 2px,#2a2f45 3px)", board: { kind: 3, hex: "#3a405c", bg: "radial-gradient(ellipse at 50% 30%, #4a5175 0%, #2c3150 60%, #191c30 100%)" } },
];

export const DEFAULT_EQUIPPED: Record<CosmeticSlot, string> = { driver: "driver_classic", finish: "finish_steel", board: "board_garage" };

export function cosmetic(id: string): Cosmetic {
  return COSMETICS.find((c) => c.id === id) ?? COSMETICS[0];
}

export function roomReward(roomId: string): Cosmetic | undefined {
  return COSMETICS.find((c) => c.album === roomId);
}

/** Total stars needed to open each workshop room. */
export const ROOM_STARS = [0, 60, 150, 250, 360];
