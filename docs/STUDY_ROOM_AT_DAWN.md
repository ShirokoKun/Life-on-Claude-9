# Study: "6:51 — a room at dawn" (Leon Lin, MIT)

**Source.** https://github.com/Leonxlnx/room-at-dawn, commit `aab8be2` (2026-11-12).
- A full copy is vendored at `reference/external/room-at-dawn/`, with its `LICENSE` (MIT) and `CREDITS.md`.
- The audio is not MIT:
  - Kevin MacLeod, CC BY 4.0;
  - field recordings, public domain and CC BY 4.0.
- Reusing any of it requires the attribution in their `CREDITS.md`.

**What it is.** A photoreal dawn bedroom built entirely from code in three.js. It has no model files, no image
textures and no HDRIs. It runs live in the browser and renders a 45 s 4K HDR10 film. It is the same goal as our room
rebuild, reached a different way. Its lessons beat ours on several points.

## What they do that we don't (and should)

| Their system | How | What it gives | How we adopt it |
|---|---|---|---|
| **Baked path-traced GI, stored per vertex** (`src/bake`, `core/gi.js`) | A CPU path tracer (web workers + three-mesh-bvh) traces sky light through the window: full paths first, then a final gather with next-event estimation through the window opening, combined by MIS. Irradiance and its dominant direction are stored per vertex in `gi.bin`, so normal maps still shade | Cycles-quality soft light at real-time speed. A film frame costs GPU milliseconds, not CPU minutes | Our three.js film engine already bakes lightmaps in Blender. For the room, render from Cycles-baked lightmaps through our engine instead of path-tracing every frame. This removes the 78 s/frame wall |
| **Tessellation rules for per-vertex light** | Every large face gets `maxEdge` (1.5–2 cm where objects rest, 4–6 cm for furniture). Every box is bevelled at ≥ 1.5 mm | Contact shadows and soft gradients without textures | The same rule for our lightmap UV density: dense where things touch |
| **Accumulated offline frames** (`render/film.js`) | Each film frame averages 32–96 jittered sub-frames: anti-aliasing, thin-lens DOF (aperture in mm and a focus point per key), a 180° shutter, with motion as a pure function of time | Smooth, filmic motion blur and DOF. It is the "proper blur" the director asked for, without optical-flow artefacts | Our `engine/src/accum.js` idea (the book mentions it). Make it standard for study films |
| **A shot list as data** | `SHOTS = [{name, dur, samples, exp, keys:[{pos, target, fov, focus, ap}]}]`, Catmull-Rom between keys, constant speed so cuts land in motion, more samples for shallow-focus shots | Editorial rhythm: seven shots of 5–8.5 s, each one move | Our room film should be cut into 6–7 shots, not one long walk |
| **One grade file** (`render/look.js` + `FINAL_FS`) | Exposure; white balance; shadow, mid and highlight tints; foliage-aware vibrance; contrast around mid grey; vignette applied in light before the curve; an Uchimura filmic curve that blends luminance and per-channel mapping and rolls saturated highlights toward white; grain weighted down in highlights; SDR and HDR10 (PQ BT.2020) from the same grade | Highlights never clip to a primary, and the window glows instead of blowing out. That was our washed-out-window problem | Port the Uchimura curve + highlight roll-off to `tools/room_post.py` and the study post stack |
| **Box-projected reflection capture** | A PMREM of the room from its centre, box-projected | Correct glossy reflections inside a room at no ray cost | three.js studies: adopt for satin desks and glass |
| **Procedural materials** (`core/tex.js`, `scene/materials.js`) | Height fields to normal maps, woodchip wallpaper, oak laminate, linen, cable knit, leaf atlases. Each textured material also declares its linear albedo for the bounce light | Rich surfaces without downloads, and correct colour bleed | Use their recipes as references for our painter / `make_room_textures.py` |
| **Wind as a pure function of time** | Crown lean → limb → branch → leaf flutter under a travelling gust field, in the vertex shader | Life in the frame that offline sub-frames can sample | Our PS1 and room loops: everything animated must be `f(t)` |
| **Sound** | Recorded, never synthesised. Filtered as if heard through the closed window | Same rule as ours | Already adopted |
| **Tools** | `tools/shot.mjs` (named-camera stills), `tools/film.mjs` (per-shot film + concat), `tools/eval.mjs`, `tools/profile.mjs` | Repeatable stills per camera | Matches our `study_render.mjs`; borrow the per-shot resume and concat |

## Their composition (their seven shots)

wake (low by the bed, toward the window) → sill (slide along the windowsill) → leaves (the trees outside, focus
racks to far) → duvet (a low glide over the bedding) → macro (desk detail, f/≈ large aperture) → desk → room (wide,
the closing reveal).
- **Pacing:** 5–8.5 s per shot, one slow move each.
- **Grade:** a per-shot exposure trim (`exp`).
- **Fades:** in over 1.6 s and out over 1.8 s.

## Next steps for our room

1. Cut the room film into 6–7 shots in this grammar: wide wake, desk slide, mug macro, toys/window, chair, bookcase,
   room reveal.
2. Port the Uchimura curve with the highlight roll-off, and the tint/vibrance grade, into `tools/room_post.py`.
3. Plan the move to "bake once, render many":
   - bake the Cycles room light to lightmaps (our `blender/lib/lightmap.py` already does this for the main film);
   - render the film in our three.js engine with accumulated sub-frames;
   - this makes a 20 s film take minutes instead of 10 hours on this CPU.
