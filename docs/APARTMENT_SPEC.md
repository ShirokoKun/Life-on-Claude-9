# Apartment spec: measured interpretation of `reference/ours/02-floor-plan.jpg`

## TODO (unfinished, the build was cut short)
- [ ] **`blender/scenes/apartment_shell.py` has never been run.** It parses as valid Python but has not been executed. Run it with `--no-export --render <scratch>`, fix any bpy errors, then check the 3 renders.
- [ ] No renders yet, so `reference/progress/shell_{plan,wide,desk}.jpg` do not exist.
- [ ] Compare the plan render against the sketch for layout fidelity. Check that no walls cross doors, nothing floats and the scale is right.
- [ ] Check the exporter: `ObjectExporter` exports each mesh as a GLB with `use_selection` and then places it again with `matrix_world`. This may apply the transform twice for objects that are not at the origin. Verify in three.js.
- [ ] User sign-off on the open questions at the bottom.

All numbers below come from the `APT` dict at the top of `blender/scenes/apartment_shell.py`. That dict is the source of truth, so edit it there.

## Frame of reference
- Units are metres. The origin is the **south-west exterior corner** (bottom-left of the sketch). +X points east (right on the sketch), +Y points north (up on the sketch), +Z points up. The finished floor is at z = 0.
- **Orientation:** the dining window on the right-hand wall faces **EAST**. The sunrise (azimuth about 100°, low elevation) comes through it and rakes west across the dining zone, onto the desk and over Ivan's chair.
- Scale was taken from the sketch at about 157 px/m on both axes.

## Envelope
| Item | Value |
|---|---|
| Overall footprint | **10.0 m (E–W) × 7.7 m (N–S)**. The sketch ratio is 1.30, so 7.6 became 7.7. |
| Ceiling | 2.7 m (slab 0.2 m) |
| Exterior wall | 0.25 m, running z −0.2 to 2.9 |
| Interior wall | 0.12 m, running z 0 to 2.7 |
| Balcony | Recessed loggia. Slab X 0–6.05, Y 5.55–7.7 (clear depth 2.15 m), set 0.03 m below the interior floor, with a soffit above. |
| Railing | 1.1 m high along the north edge (Y≈7.62) and the west edge (X≈0.08). Handrail, bottom rail, posts about every 1.5 m, balusters at about 0.12 m. |

## Walls (plan boxes x0, y0, x1, y1)
| Wall | Box | Openings |
|---|---|---|
| South (ext) | 0, 0, 10, 0.25 | Main door, centred at X 4.62, 1.0 wide, 2.1 high, closed |
| West (ext) | 0, 0, 0.25, 5.55 | none |
| East (ext) | 9.75, 0, 10, 7.7 | **East window**, centred at Y 3.6 (Y 2.4–4.8), 2.4 wide, sill 0.75, head 2.3, 3 panes |
| Kitchen north (ext) | 6.05, 7.45, 10, 7.7 | none |
| Kitchen west (ext, faces balcony) | 6.05, 5.3, 6.3, 7.7 | none |
| Balcony wall (ext) | 0, 5.3, 6.3, 5.55 | Bedroom window centred at X 1.2, 1.4 wide, sill 0.9, head 2.2, 2 panes. **Sliding glass door** centred at X 4.6 (X 3.5–5.7), 2.2 wide, head 2.3, 2 sliding leaves. |
| Bedroom/hall | 2.64, 0.2, 2.76, 5.35 | Bedroom door at Y 2.7, 0.8 wide, 2.05 high, opens 60° into the bedroom |
| Bath W north | 0.2, 2.04, 2.7, 2.16 | Bath W door at X 0.825, 0.75 wide, opens 55° into the bath (en-suite from the bedroom) |
| Bath E west | 5.89, 0.2, 6.01, 2.16 | none |
| Bath E north | 5.89, 2.04, 9.8, 2.16 | Bath E door at X 9.175, 0.75 wide, opens 45° into the bath |

## Rooms (clear interior rectangles)
| Room | Rect | Size |
|---|---|---|
| Bedroom | 0.25, 2.16 – 2.64, 5.3 | 2.39 × 3.14 |
| Bath W (shower) | 0.25, 0.25 – 2.64, 2.04 | 2.39 × 1.79 |
| Entry hall | 2.76, 0.25 – 5.89, 2.16 | 3.13 × 1.91 |
| Living | 2.76, 2.16 – 6.3, 5.3 | open plan |
| Desk zone | 5.89, 2.16 – 7.9, 3.7 | open plan |
| Dining | 6.3, 2.16 – 9.75, 5.2 | open plan |
| Kitchen | 6.3, 5.2 – 9.75, 7.45 | 3.45 × 2.15 |
| Bath E (tub) | 6.01, 0.25 – 9.75, 2.04 | 3.74 × 1.79 |
| Balcony | 0, 5.55 – 6.05, 7.7 | 6.05 × 2.15 |

## Furniture (`Furn_<item>`)
Size is w × d × h. The position is the footprint centre plus the base z. Rotation: 0 means the front (user side) faces south, 90 faces east, 180 faces north, −90 faces west.

| Item | Size | Position | Rot |
|---|---|---|---|
| BookDrawer (chest + books) | 0.8×0.4×0.9 | 2.96, 3.9 | 90 |
| FloorLamp | 0.3×0.3×1.75 | 3.0, 5.02 | 0 |
| BeanBag | Ø0.85×0.6 | 3.68, 4.6 | 0 |
| ShoeRack | 0.8×0.32×0.5 | 2.92, 0.75 | 90 |
| **Desk** | 1.4×0.7×0.75 | 6.95, 2.52, against the Bath E north wall | 180 |
| **OfficeChair** | 0.62×0.62×1.15 | 6.95, 3.3. Ivan faces south toward the wall, with the east window on his left. | 0 |
| Laptop | 0.31×0.22 | 6.95, 2.56, z 0.75, hinge on the south side | 180 |
| DeskLamp | 0.16×0.45 | 7.47, 2.33, z 0.75 | 180 |
| WallClock | Ø0.3 | 6.95, 2.18, z 1.6 (centre 1.75), in the desk sightline | 180 |
| DiningTable (round) | Ø0.9×0.75 | 8.6, 4.35 | 0 |
| DiningChair_W / _E | 0.45×0.48×0.9 | 7.95, 4.35 / 9.25, 4.35 | 90 / −90 |
| Pantry (tall) | 0.6×0.62×2.2 | 6.6, 7.14 | 0 |
| CounterRun | 2.15×0.62×0.9 | 7.975, 7.14 | 0 |
| Sink / Cooktop / CoffeeMaker | on the counter | X 7.35 / 8.2 / 8.72 | 0 |
| Fridge | 0.7×0.65×1.85 | 9.4, 7.12 | 0 |
| UpperCabinets | 2.15×0.35×0.72 | 7.975, 7.275, z 1.5 | 0 |
| Island (peninsula off the east wall) | 2.45×0.65×0.92 | 8.525, 5.525 | 180 |
| Bed (head on the west wall) | 1.4×1.9×0.55 | 1.2, 3.7 | 90 |
| BedsideDrawer + BedsideLamp | 0.45×0.4×0.55 | 0.45, 4.67 | 90 |
| ShowerTray + glass screen | 0.9×0.9 | 0.7, 0.7 | 90 |
| Toilet_W / Vanity_W | — | 2.3, 0.95 / 1.6, 0.475 | −90 / 180 |
| Toilet_E / Vanity_E / Bathtub | 1.7×0.75 tub | 6.35, 1.0 / 7.2, 0.475 / 8.9, 0.625 | 90 / 180 / 0 |

## Cameras
- `Cam_Plan` is an orthographic top-down view with clip start set to cut at z 1.45, like an architectural plan. The ceiling and soffit are hidden for that render.
- `Cam_Wide` is a 16 mm lens at (4.95, 0.55, 1.6), just inside the main door, looking north to the balcony door.
- `Cam_Desk` is a 24 mm lens at (5.25, 2.55, 1.45) in the hall, looking at (7.6, 3.55, 0.95). It shows the chair and laptop in 3/4 view, with the east window behind them.

## Uncertain points in the sketch interpretation
1. **Bath W door:** the sketch has no clear gap. The small rectangle at the top of the left toilet was read as a door from the bedroom (en-suite). It could also be a vanity, with a door to the hall instead.
2. **Desk facing:** the laptop's screen line is drawn on the south side, so Ivan sits north of the desk facing the toilet wall. This gives a wall clock in his sightline, the east window on his left, and the camera can see his face only from the hall side (west) or with a tight shot between the screen and the wall.
3. **Kitchen:** the stub on the left was read as a tall pantry. The item on the east wall near the island was dropped, and the island was made a peninsula running off the east wall and moved to Y 5.2–5.85 to keep a 1 m aisle. Upper cabinets are inferred; they are not in the sketch.
4. **Dining table:** the sketch draws it at about 1.2 m; it was reduced to Ø0.9 m.
5. **Bedroom:** it is 2.39 m wide, so a 1.9 m bed leaves only about 0.49 m at its foot. The double line on the bedroom's east wall might be a wardrobe; it was ignored.
6. **Balcony depth:** the sketch reads at about 2.15 m clear, which is deep. It is modelled as a recessed loggia.
