// Room dimensions in metres. X = along the window wall, Z = into the room (window wall at z = 0), Y = up.
export const ROOM = {
  W: 4.8, D: 4.0, H: 2.5, wallT: 0.32,
  win: { x0: 0.55, x1: 2.45, y0: 0.86, y1: 2.26, mullion: 1.74, frameZ0: -0.205, frameZ1: -0.135, glassZ: -0.17 },
  door: { z0: 2.72, z1: 3.62, h: 2.02 },
};
export const BED = { x0: 0.12, x1: 1.56, z0: 1.92, z1: 3.98, top: 0.5 };      // mattress top at y = 0.5
export const DESK = { x0: 2.68, x1: 3.78, z0: 0.02, z1: 0.64, top: 0.74 };
export const WARDROBE = { x0: 3.8, x1: 4.78, z0: 0.0, z1: 0.6, h: 2.12 };
export const RADIATOR = { x0: 0.95, x1: 2.05, y0: 0.14, y1: 0.74, z0: 0.03, z1: 0.13 };
export const CURTAIN = { rodY: 2.38, z: 0.19, left: [0.34, 0.66], right: [2.34, 2.62], bottom: 0.06 };
export const NIGHTSTAND = { x0: 1.64, x1: 2.06, z0: 3.54, z1: 3.97, top: 0.5 };
export const RUG = { x0: 1.8, x1: 3.5, z0: 1.38, z1: 2.92 };
export const SHELVES = { x0: 3.08, x1: 3.76, depth: 0.2, y: [1.32, 1.68] };   // wall shelves above the desk (window wall)
export const POSTCARDS = { x0: 2.7, x1: 3.04, y0: 1.05, y1: 1.92 };          // collage on the window wall, right of the curtain
export const PLANT_SHELF = { x0: 0.0, x1: 0.2, z0: 0.28, z1: 0.86, y: 2.0 }; // high shelf on the left wall for the big trailing pothos
