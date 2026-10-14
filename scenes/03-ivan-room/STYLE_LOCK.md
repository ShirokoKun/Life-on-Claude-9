# Ivan's room: the style to match

The world is `ref/look_target.webp`; it's our film's own frame. `ref/look_night.webp` is the same room at 3 AM. The mood refs (`ref/mood/mood_1..8`) add how soft light behaves. Every keyframe is judged against this list.

| | The reference world | Rule for our room |
|---|---|---|
| **Shadows** | No hard edge anywhere. Only soft gradients and contact darkening under objects. | Every baked light is soft (practicals 15–20 cm); shades transmit and never cut light. A hard-edged patch is a bug. |
| **Light hierarchy** | 1. The window (defocused city, blue-grey). 2. The monitors (cool blue, lighting only the desk). 3. One warm lamp (an orange pool on the wall behind it). Everything else is dim. | Three sources only. Nothing else may glow or carry a bright patch. |
| **Darkness** | The room falls off into very dark green and navy, but shapes stay readable (bed, chair, shelves). | Shadows land at about 3–8% brightness in navy or green, never pure black and never grey. |
| **Palette** | Deep teal-green walls, navy duvet and rug, warm mahogany wood, orange lamp, blue screens. | Walls dark muted green, bedding navy (soft highlights), wood warm red-brown satin, one orange accent, one blue accent. |
| **Window** | The brightest big shape; the city is soft bokeh (no building grid), with blinds at the top. | The exterior is defocused points on a blue-grey haze. No readable tower grids, no glitter strip. |
| **Fabrics** | The duvet is soft with gentle quilt folds; the pillow is pale and rounded; hoodie on the chair. | Rounded, plump shapes; soft single highlights; no slabs, no rolling pins, no patterns from the bake. |
| **Materials** | Matte walls, satin wood (one soft highlight), matte electronics, glossy only on the screens. | Wood roughness 0.5–0.65; fabric 1.0 with no sheen; reflections only from the floor and screens. |
| **Depth** | Out-of-focus plants and furniture in the foreground; the window background soft. | Every wide shot has a soft foreground layer and shallow focus (f/2–2.8). |
| **Floor** | Mostly covered by a large navy rug; dark wood at the edges. | A navy rug under the bed's foot and the chair; the wood stays dark and clean. |

Measured target (look_night): mean brightness 0.13, black share about 8%, warm overall RGB.
