# Ivan's room: why it looks wrong, and the rebuild plan

Compared against:
- the director's frames: `ref/review2/` (top-down, desk S1, door side);
- the mood references: `ref/mood/` and `ref/look_night.webp`.

## What every good reference does that we don't

| | References | Ivan's room now |
|---|---|---|
| **Light hierarchy** | **One key practical** (a lamp or a screen) that makes a soft, round pool. One cool ambient from the window, very low. Everything else is falloff. You can always say where the light comes from. | Nine competing sources:<br>- lamp, laptop key and city panel;<br>- moon and two sodium up-lights;<br>- ceiling fill and hemisphere fill;<br>- glow sprites, window veil and volume.<br>Patches of light appear with no source (warm "sun" on the door-side shelf, a hard horizontal band on the east wall), and darkness falls in random places. |
| **Walls** | Matte and mid-value (greige, off-white, desaturated sage, or deep but *lit* colour). Light shows on them as **smooth gradients**: wall washes, the lamp's halo, the corner falloff. | Dark green at ~12% albedo with a busy stucco normal. Gradients can't read on it: it goes from flat colour to black. |
| **Materials** | Few, consistent:<br>- matte plaster;<br>- satin wood (low, broad highlights);<br>- soft cotton (no shine, a little sheen at grazing angles);<br>- one or two glossy accents (a glass, a screen).<br>Texture scale is right, and texture is quiet. | Mixed sources fight:<br>- procedural Blender shaders, engine library textures and Poly Haven scans;<br>- some surfaces mirror, some are dead flat (the desk and side desk read black and shiny);<br>- floor planks at the wrong scale with broken stripes;<br>- the navy rug texture reads as confetti;<br>- the Persian rug is a graphic. |
| **Soft goods** | The bed is **simple, clean shapes**: a fitted flat sheet, a folded duvet or blanket, plump rounded pillows, one flat colour each. Softness comes from rounded edges and gentle shading, not from noise. | A cloth-sim duvet with holes and crumples, crease noise on top, blotchy baked light, and box pillows. The mattress doesn't sit in the frame. It reads as chaos. |
| **Set dressing** | **Deliberate**: a few objects placed for the composition. The floor is mostly clear, so it shows the light. | Papers, paper balls, a T-shirt and a clothes heap, scattered at random. The two rugs overlap. Together it reads as noise, not as lived-in. |
| **Air** | Haze is barely there:<br>- a soft halo around practicals;<br>- in the strong refs, a few soft-edged shafts;<br>- it never draws shapes. | Window shafts with **hard edges** read as dark and light bands across the whole frame. Additive glow **sprites** around the monitors show as blue rectangles ("masks"). |
| **Contrast** | A deep but **soft** black. The darkest areas still hold shape (silhouettes against a lit wall), and the eye goes to the lit area. | Crushed pockets next to over-filled areas. There's no clear focal pool. |
| **Window** | A bright, readable view: a moonlit sky, a city or rain. It is the scene's second light source and a strong silhouette frame. | Flat grey glass, a dull city, and blinds that glitter. |

## Root causes (technical)

1. **Lighting design.**
   - The rig grew by patching: every darkness fix added a light.
   - The sodium up-lights and the giant city panel throw light into places the story says are dark.
   - The baked fill makes everything evenly grey.
2. **Bake quality.**
   - Six lightmap groups share 2048² atlases across very different object sizes. A bed or wall gets few texels; small props get many.
   - Low-res lightmaps plus the denoiser leave blotches (the bed), leaks at joins (the bright door edge) and smeared shadows.
3. **Material pipeline.**
   - Three different material systems meet in the engine, each with its own idea of gloss and scale.
   - The environment reflection is captured from a dark room, so every glossy surface reflects black: shiny dark wood.
4. **Modelling.**
   - Procedural stand-ins (bed, duvet, rugs, clutter) are next to scanned assets; they don't match in fidelity.
5. **Effects.**
   - Screen-space sprites and an analytic volume with hard window masks: both draw shapes instead of air.

## The rebuild (in order)

**A. Strip back to a clean base.** Remove:
- the glow sprites and the window veil;
- the sodium up-lights;
- the hemisphere and ceiling fills;
- the volume, until it is redone soft.

**B. One light plan, three layers.**
1. **Key:** the table lamp. A brighter, larger warm emitter, so its pool on the wall, the nightstand, the bed head and the floor is the brightest area of the room.
2. **Accent:** the screens (blue, desk only, from emissive panels). Plus a small warm desk practical, as in the references, so the desk isn't black.
3. **Ambient:** the moonlit sky through the window (world sky only, soft, low, cool). No panel lights, no fills.

Bounce does the rest. The bake is GI, so walls light walls.

**C. Walls and materials.**
- Walls: muted sage-grey at ~25% albedo with a quiet plaster texture, so gradients read.
- Wood: one satin walnut for all furniture (roughness ~0.55, no clearcoat).
- Fabrics: flat cotton colours.
- Floor: plank scale corrected, satin finish.
- Reflections: environment capture taken after the room is lit.

**D. Bed rebuild.**
- A low walnut frame, with the mattress fitted inside it.
- A **flat fitted sheet** in one flat colour.
- A duvet folded back to the foot third: a clean, rounded slab with soft edges, no sim noise.
- Two rounded pillows.

**E. Clean the floor.**
- One rug, centred under the bed foot and desk.
- Remove the paper litter and paper balls.
- Keep one deliberate object: a hoodie over the chair back, or a single book.

**F. Bake at a consistent texel density.**
- Per-object scale in the lightmap pack.
- Higher-res maps for the big surfaces.
- More samples.

**G. Air, redone soft.** Haze that only shows where light is strong, with soft-edged shafts (blurred window mask, lower density) and no sprites.

**H. Window.** A brighter moonlit sky, a cleaner city, and blinds that don't glitter.
