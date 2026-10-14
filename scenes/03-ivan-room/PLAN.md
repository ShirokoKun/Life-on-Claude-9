# Scene 1, rebuilt: Ivan's room

The intro ("3 AM", 37 s, same voiceover and captions) is being remade in a new set with the new Ivan.

**Refs:**
- `ref/plan_topdown.jpg` is **the layout** (the top-down frame, v2).
- `ref/look_target.webp` is the mood: night, haze, a warm lamp against blue screens and the night window.
- `ref/sketch_plan.jpg` was the first sketch, now superseded by the top-down frame.

**Built by:**
- `blender/scenes/set_room03.py`
- `engine/scenes/s03/scene.js` (the Studio's scene 3)

## Room (world axes, metres)

The axes were chosen so the desk faces +y, as in the flat. The intro's desk props, Ivan's performance and the desk shots then move over by one offset, `OFF = (-5.90, 1.23, 0)`.

| Wall | Where | In the top-down ref |
|---|---|---|
| Window wall | x = 0, west | top |
| Bed-head wall | y = 0, south | left |
| Desk wall | y = 4.8, north | right |
| Door wall | x = 4.0, east | bottom |

Interior is 4.0 × 4.8 m, ceiling 2.7 m.

| Item | Where | Source |
|---|---|---|
| Window: three double-hung units, blinds pulled up | west wall, y 0.95–3.75, sill 0.86, head 2.42 | built |
| Queen bed: walnut, mattress, two pillows, navy duvet (cloth sim + creases) | head on the south wall, x 0.48–2.10, y 0.04–2.16 | built |
| Nightstand + table lamp + alarm clock + books | by the bed head, under the window's south end | Poly Haven + built lamp |
| Corner plant | window/bed corner | Poly Haven `potted_plant_02` |
| Side table, soda cans | south wall beyond the bed | built |
| Guitar, only one (as asked) | leaning on the window wall below the sill | built |
| Clothes pile, T-shirt on the floor | under the window, by the bed | built (cloth heap) |
| Bookshelf + photo + fern on top | window/desk corner | Poly Haven `wooden_bookshelf_worn` |
| Walnut desk, 3-drawer pedestal | north wall, x 0.42–2.30 | built |
| Laptop, glass, mugs, phone, notebook, mouse, chair, pipeline monitor | the intro's desk props, moved by OFF | `props_desk.py`, `props_clutter.py` |
| Second monitor (code) | right of the first | built |
| Plants: tall one at the desk end, small one on the desk | | Poly Haven `potted_plant_01`, `potted_plant_04` |
| Chest of drawers | east wall, by the desk end | Poly Haven `drawer_cabinet` |
| Posters (our own art) | bed wall + beside the window | `wall_print.png` |
| Persian runner (generated, worn) + navy rug under the chair | floor | `rug_persian.png` (generated) |
| Papers and crumpled sheets | floor | built |

## Outside (west, down a valley)

1. Treetops just below the sill.
2. A hillside neighbourhood with sodium and LED street lights; these become the big warm bokeh.
3. Downtown towers at 0.9–2.2 km: the engine's lit-window facade, plus red aviation lights.
4. A sky card with a city-glow band at the horizon.

## Light (3 AM)

Light sources:
- table lamp (40 W, warm);
- laptop key;
- the two monitors (emissive);
- cool city and sky panel at the window (110 W);
- moon (sun lamp, 0.22, from the west);
- two sodium street lights below, throwing warm light up onto the ceiling.

How it's lit:
- **Bake:** Cycles lightmaps on the GPU (OptiX, about 3 minutes), in groups ARCH, DESK, ROOM, WALLN and CEIL. WALLN and CEIL are kept separate so shots can pull the wall and ceiling.
- **Live in the engine:** the lamp, the laptop key, the monitor face key, and a faint moon (for Ivan and crisp window shadows).
- **Exposure:** 1.35, the intro's value.
- **Locked:** `post.js` LOOK.

## Shots

- **Kept:** all nine intro shots, timing and captions. Seven of them (desk, phone, glass, face, reading, pipeline, sent, lean-back) move with OFF.
- **New:**
  - **E1:** straight down into the room, the reference frame.
  - **S1:** a slow push from the door corner toward the desk.
- **Wild wall:** the face shots stand where the north wall is; the wall is pulled for those shots, as on a set. The top shot takes the ceiling off.

## Build

```bash
blender -b --factory-startup -P blender/scenes/set_room03.py -- renders/room03 --cams top,door
blender -b --factory-startup -P blender/scenes/set_room03.py -- engine/scenes/s03/room --bake
```

The first renders the Workbench layout frames; the second bakes and exports to the engine.

The new Ivan uses the same performance:

```bash
python prep_tripo.py ivan_tripo_v3.glb engine/scenes/s03/ivan.glb --events engine/scenes/s03/acting.json
```

Run it through Blender (`-P`, with the args after `--`).

## Open

- Haze and window light shafts (`atmosphere.js` only has the lamp cone and dust today).
- The hoodie on the chair: Ivan sits in it during this scene, so it is on the clothes pile for now.
- Room size: the textures are kept at 1K/512, but the set is about 34 MB with lightmaps.
