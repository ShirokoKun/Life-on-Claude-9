# Life on Claude Nine: production plan v0

Target look: the three.js "OpenKnight" short (stills in `reference/look-target/`).
Our material: script, floor plan, character sheet, storyboards (in `reference/ours/`).

## 1. How the reference was made (reverse-engineered)

**It's a real-time three.js engine, not a pre-rendered film.** The last 25 s is a live
configurator (paint, scanner and driver swapped through the UI in the same scene).
The film is that engine driven by a sequencer, then recorded.

| Area | What's actually happening |
|---|---|
| Frame | Letterboxed, about 2:1 (city) to 2.39:1 (desert). 30 fps. Burned-in subtitles. |
| Edit | 92 cuts in 137 s, so about 1.5 s per shot on average and 0.3–1 s in action. Cuts often land on a flare or a whip pan. |
| Camera | Handheld noise on every shot, slow push-ins, low angles, top-down tracking, POV/dashboard shots, whip pans with heavy motion blur. |
| Geometry | **Cheap.** The city is boxes. Windows come from an *interior-mapping shader* (credited: `three-fenestra`, an MIT npm package). Only the hero car and the characters are detailed. |
| Lighting | Low-key and fully *motivated*: every light has a visible source (streetlamps, headlights, screens, the dashboard). Colour comes from those practicals, e.g. a red cockpit on the face. Blacks are crushed. |
| Post (does ~60% of the look) | Filmic tonemap (AgX/ACES), strong bloom, **anamorphic horizontal streaks**, shallow DOF with big bokeh, chromatic aberration at the frame edges, grain, vignette, motion blur. |
| Characters | Game-grade realistic humans (Character Creator / MetaHuman class). PBR skin, card-based hair, mocap-style body motion, subtle face animation. Weak spots are hidden with DOF, rim light and short shots. |
| Screens/UI | Emissive canvas textures with scanlines and glow. This maps directly to our laptop and phone shots. |

## 2. Our film mapped onto this

- One set: Ivan's apartment, built from `02-floor-plan` (balcony with glass door, bedroom, desk "Table", bean bag, long lamp, kitchen/dining, 2 toilets, main door).
- Lighting is per scene, as presets on the same set:
  `3AM-monitor-blue` · `sunrise-warm` · `optimized-dim-evening` · `blackout` · `nuclear-flash`.
- The hero light is the **laptop screen**, which matches the reference's practical-light logic.
- Storyboard `04-nightroom-blue` is the shot spine. `05-painterly` gives extra framings only (filename says stashed).
- `06-fern` is shape and composition reference only.
- Character: Ivan from `03-character-sheet` (round glasses, side part, white crew-neck over a collared shirt, dark trousers, brown shoes).

## 3. Stack

| Layer | Tool |
|---|---|
| Engine | Vite + React Three Fiber + drei, three.js WebGL2 (WebGPU later if needed) |
| Post | `postprocessing` (pmndrs): AgX, bloom, custom anamorphic streak pass, DOF, CA, grain, vignette, motion blur |
| Sequencing / "controls" | **Theatre.js** (keyframe camera, lights and props per shot, with a studio UI) + **leva** for look knobs |
| Shots | One file per shot: set, light preset, camera track, character clips, duration. A timeline concatenates them. |
| Render | **Offline deterministic capture**: fixed timestep, Playwright headless, PNG sequence, ffmpeg. Because it isn't real-time we can supersample, accumulate frames for real motion blur, and render at 4K then downscale. |
| Set & props | Blender, exported as glTF (Draco/KTX2). Props from Poly Haven / CC0 kits. Baked AO plus real-time lights so presets can change. |
| Character | **Character Creator 4 + Headshot** from the sheet, with card hair, glasses and an ARKit-52 face rig, exported to glTF. Fallback: MetaHuman (now licensed for other engines), but its hair export is painful. AI image-to-3D (Tripo, Hunyuan3D, Meshy) is for **props only**: bad topology and no face rig. |
| Motion | Body: ActorCore/Mixamo libraries plus phone mocap (Move.ai / Rokoko) for typing, slumping and the phone. Face: iPhone Live Link Face to ARKit blendshapes, played as morph targets. |
| Audio | VO, score, SFX and subtitles in the final edit (Resolve/Premiere). |

## 4. Phases (each one gated by a side-by-side against the look target)

0. **Look-dev gate.** One hero shot (Ivan at the desk, 3AM, laptop light) using a stand-in mannequin and a blockout room. Compare it side by side with `t000013.5`/`t000030.5` until the grade, bloom and DOF match. **Nothing else starts until this passes.**
1. Repo skeleton: R3F app, post stack, Theatre.js, shot format, headless frame renderer.
2. Apartment set in Blender from the floor plan, plus 5 lighting presets.
3. Ivan character: model, rig, face, hair, glasses, then an import test under all presets.
4. Shot list from the script and storyboard, then animatics (blockout with camera and timing).
5. Final shots: animation, lighting polish, render.
6. Edit, sound, subtitles, grade check.

## 5. Needed from you

1. Which part of the script the film covers, and the target runtime.
2. The locked shot list. Storyboard 04 has only 9 panels filled.
3. Whether you have Character Creator 4 and Blender, and whether you can do iPhone face capture.
4. The voice/VO plan.
5. Room details: wall/floor materials and mood refs for the apartment.
