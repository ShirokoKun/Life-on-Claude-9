# Cinematic three.js playbook

A from-scratch guide for building **cinematic, film-quality 3D scenes in three.js** (rendered to MP4 and
viewable live in a browser). Give this file to a fresh Claude Code session (or any developer) at the
start of a new project. It holds the taste, the workflow, the settings and the traps learned the hard way.

---

## 1. The taste (what "good" means here)

Reference: the OpenKnight three.js film, Birdcage-style night stills, Ramanujan-film characters.

- **Light is local; the rest falls to black.** About 30–45% of a night frame is true black. Light pools
  on the subject and stops. Darkness is a design element, not a failure to light.
- **One colour world per shot,** plus one accent (for example screen blue plus warm lamp amber, against black).
- **Glow belongs to sources.** Bloom and halation hug hot points (bulbs, screens, headlights). The air
  stays clear, except for visible haze and dust *inside* light beams.
- **Surfaces read as real materials.** Matte paper, satin wood, glossy glaze, brushed metal. Nothing
  shines by accident; nothing is a flat colour.
- **Shallow focus.** Only ~5% of the frame is sharp (the eye, the hand, the object of the line).
  Backgrounds turn into bokeh. Blur hides simple geometry and makes it feel expensive.
- **Clean, not gritty.** Fine film grain, mostly in the shadows. No speckle or noise in flat areas.
- **Camera with intention.** One move per shot (push, drift, arc, rack focus), eased, with sub-degree
  operator breathing. Few cuts. Low angles, foreground occlusion, slight Dutch tilt when it means something.
- **Measured, not guessed.** Compare your frames numerically against reference frames
  (`tools/look_metrics.py`: black share, median luminance, saturation, highlight area, noise, sharpness).

## 2. Architecture (what owns what)

```
Blender (authoring, offline)                three.js (real time, the film camera)
------------------------------              --------------------------------------------
layout, props, characters, rigs             PBR materials with real textures (by material name)
performance (keyframed animation)           live hero lights (with shadows) + reflections
Cycles light bake -> HDR lightmaps          lens: depth of field, haze, dust bokeh, light cones
light positions/energies -> JSON            bloom, tone mapping (AgX), film grade, grain
                                            shots/timeline, audio sync, frame-exact capture -> MP4
```

**The core idea is mixed lighting, the way EEVEE and game engines emulate path tracing:**
1. Bake **irradiance only** (Cycles Diffuse pass, Direct + Indirect, *no Color*) into lightmaps on a
   second UV set, at 2–4K, as linear **half-float EXR** (8-bit PNG/JPEG bakes posterize at night).
2. Subtract the direct contribution of the **live lights** (lights that move, flicker, or must cast
   shadows from animated characters). Do a second bake with only those lights, Direct only, and take
   `lightmap = full − live`.
3. In three.js, every static surface gets a **real PBR texture set** (albedo/normal/roughness from CC0
   libraries: ambientCG, Poly Haven) on a metric UV (1 UV unit = 1 m), plus the lightmap on `uv1` with
   `lightMapIntensity = π` (Cycles' diffuse light pass is E/π).
4. Live lights are created from Blender's values in physical units (spot/point `I = W / 4π`;
   area `L = W / (π·A)`), so baked and live light agree.
5. Reflections come from a **cube capture of the room itself** (PMREM). On lightmapped materials,
   switch off image-based *diffuse* (the lightmap already contains the bounce) and **occlude reflections
   by the lightmap's brightness** (no glowing reflections in dark corners).

Why not bake surface colour into the lightmap (the "texture bake")? It looks flat and plastic: no
view-dependent shine, no detail at close range, low resolution. Keep light and material separate.

## 3. Project layout

```
blender/              lib/ (geometry, materials, lighting, bake), scenes/ (build + export), characters/
engine/
  index.html          viewer UI + import map
  src/main.js         boot, load, timeline, renderFrame(n) for capture
  src/materials.js    material library: name -> texture set, target albedo, finish
  src/lights.js       live lights from lights.json (physical units)
  src/atmosphere.js   dust motes (DOF-aware bokeh), light cones; soft depth test
  src/post.js         lens pass (thin-lens DOF + haze), bloom, AgX output, film grade
  src/shots.js        shot list (lenses, stops, moves, focus pulls), captions, voiceover offset
  assets/             room.glb, character.glb, lightmaps/*.exr, tex/<set>/{albedo,normal,rough}.jpg
  vendor/three/       pinned three.js (offline, reproducible)
tools/                render_mp4.mjs (capture + encode), serve.mjs, look_metrics.py
docs/                 this playbook, project rebuild guide, look analysis
```

Pin three.js (vendor it). Load modules via an import map. No bundler is needed.

## 4. Settings that matter

**Renderer**
- `toneMapping = AgXToneMapping` (matches Blender 4+ default view transform); exposure in EV
  (`toneMappingExposure = 2^EV`), with the same EV as the Blender scene.
- `shadowMap.type = PCFSoftShadowMap`; 2048 maps for hero lights; set `bias` ≈ −1e-4 and
  `normalBias` ≈ 0.01–0.02; near/far tight around the subject.
- Render to a **HalfFloat MSAA** target with a **depth texture** (needed for DOF, haze, soft particles).
- `powerPreference: 'high-performance'`; pixel ratio ≤ 1.5 for live view; 1.0 for capture.

**Textures**
- Albedo `SRGBColorSpace`; normal/roughness/AO `NoColorSpace`; lightmaps `LinearSRGBColorSpace`, `channel = 1`.
- Tiling textures: `RepeatWrapping`, anisotropy 8, repeat = 1 / (metres per tile).
- Hit real albedo values (white paint ~0.75, walnut ~0.08, black plastic ~0.03) by computing the
  texture's mean once and setting `material.color = target / mean`.
- glTF textures use `flipY = false`. Check every new map type with a debug view (render only the
  lightmap on unlit materials: edges must follow the geometry).

**Materials (finish with intention)**
- Matte (roughness 0.85–1): paper, plaster, fabric, cardboard, cork, soil.
- Satin (0.4–0.6): painted wood, plastics, desk and floor (often + clearcoat 0.3–0.45 at roughness 0.2–0.3 for lacquer).
- Gloss (0.03–0.15): screens (with clearcoat), glass, glazed ceramics, liquids.
- Metal: brushed aluminium (metalness 1, roughness 0.3–0.4), powder-coated steel (metalness 0.1–0.3, roughness 0.5).
- Fabrics: `sheen` 0.4–0.6 with a sheen colour near the albedo.
- Transmission only where the camera looks closely (it costs an extra pass); other glass is a
  transparent tint with reflections.

**Lights**
- Keep live lights few: at most 2 shadowed, plus 1–3 unshadowed accents (rim, kicker, area screen).
  The per-material forward-shading limits (**16 texture units**; uniforms per light) are easy to hit.
  Bake everything else.
- RectAreaLight (needs `RectAreaLightUniformsLib.init()`) for screens and windows; it has no shadows.
- A narrow, weak rim from behind separates characters from dark backgrounds.

**Lens (post)**
- Thin-lens circle of confusion: `diameter = f² / (N (S − f)) · |d − S| / d` on a 36 mm sensor,
  converted to pixels. Use real focal lengths and f-stops per shot. A stylised multiplier (1.5–2)
  gives the large-format look.
- Gather DOF with a golden-angle spiral (~100–200 taps), clamping background samples so a sharp
  foreground never bleeds.
- Depth haze `1 − exp(−d · k)` with a very dark tinted colour: depth separation, not fog.
- Draw dust and light cones **after** DOF, with their own CoC (points grow into bokeh discs) and a
  soft depth test against the scene depth.
- Bloom: threshold above 1.0 in HDR (1.4–2.0), strength 0.15–0.3. **Avoid excessive bloom.**
- Film pass, after tone mapping: halation (red-orange glow on hot edges), saturation 1.05–1.15, gentle
  contrast, warm highlights, a hint of blue in the blacks, vignette 0.3–0.5, chromatic aberration ≤ 0.0015,
  grain ~0.01 weighted to the shadows, letterbox (2:1 or 2.39:1).

## 5. Workflow (in order)

1. **Reference first.** Collect stills and frames. Measure them (`look_metrics.py`), write target ranges.
2. **Block out** in Blender at real scale (metres). Fix cameras early; judge the 2D frame.
3. **Dress** with simple shapes plus good materials (most props are boxes, lathes and tubes).
4. **Light in Cycles** until a still looks right. This is your ground truth.
5. **Export:** tiling UVs, joined groups, lightmap UVs, bake (full − live), EXR, glTF with both UV sets,
   `lights.json`.
6. **Engine:** material library, live lights, environment capture, lens and post.
7. **Parity check:** the same camera in Cycles and in three.js, side by side, plus metrics. Fix the
   largest gap first.
8. **Shots:** time them to the voiceover (detect pauses with `ffmpeg -af silencedetect`), one intention each.
9. **Capture:** `renderFrame(n)` per frame (deterministic: no `requestAnimationFrame` time), encode
   with ffmpeg, mux audio with an offset.

## 6. Characters

- AI-generated rigged characters (Tripo, Meshy) usually ship as **several mesh pieces with
  inconsistent weights** and **flipped normals**:
  - Re-weight so everything above the jawline follows the Head bone rigidly, otherwise the mouth
    tears open when the neck bends.
  - Render them `side: DoubleSide`, otherwise holes appear in the face.
- glTF import in Blender sets objects to **quaternion rotation**: set `rotation_mode = 'XYZ'` before
  setting Euler angles, or the rotation is silently ignored.
- Pose in world space (aim bones at directions, 2-bone IK for arms). Animate with a few layered
  behaviours: typing bursts in phrases, breathing at 0.25 Hz, head drift, timed beats (lean in, glance, nod).
- Lighting: live key and rim, plus the room's cube capture for ambient. Never let a character's albedo
  sit under a strong unshadowed light (it reads as plastic).

## 7. Known bugs and traps (and fixes)

| Symptom | Cause | Fix |
|---|---|---|
| Everything looks plastic and flat | lighting/colour baked into one texture; live lights on albedo only | separate lightmap (irradiance) + PBR textures + reflections |
| Blotchy, low-res surfaces | small atlases (1K for a whole flat), JPEG bakes | 4K atlases per group, half-float EXR, denoise (OIDN) |
| Night bakes posterize | 8-bit storage | EXR (or scale into range and divide back) |
| Bright reflections in dark corners | full-strength environment everywhere | occlude reflection radiance by lightmap luminance |
| Double lighting | the same light baked and live | bake `full − live` |
| Some objects unbaked or glowing | curve objects skipped by the bake | convert curves to meshes before baking |
| Shader compile failure / black materials | too many lights or textures per material | ≤ 16 texture units, few live lights, bake the rest |
| Shadow acne / peter-panning | bias settings | `bias −1e-4`, `normalBias 0.01–0.02`, tight shadow camera |
| Transparent objects sort wrongly | depthWrite on glass | `depthWrite: false` on thin glass, transmission only for hero glass |
| Bloom fog over everything | low threshold | HDR threshold ≥ 1.4; local halation instead |
| Gritty, cheap look | heavy grain or noisy bakes | grain ≤ 0.01 in shadows; denoise; metrics noise ≤ reference |
| Background job killed mid-bake | tool time limits | make bakes resumable (skip finished groups) |
| Character faces away / pose ignored | quaternion rotation mode after glTF import | set `rotation_mode = 'XYZ'` |
| Capture frames differ from playback | wall-clock animation | everything driven by `setTime(t)`; `renderFrame(n)` |

## 8. Rendering MP4s

- Real GPU (your machine): `npm run render`, which runs headless Chromium with GPU and takes minutes
  for 30 seconds of 1080p.
- No GPU (cloud containers): software GL takes 10–30 s per frame. Render every 2nd frame, then use
  ffmpeg `minterpolate` to 24 fps; or reduce resolution for previews.
- Encode with `libx264 -crf 16 -preset slow -pix_fmt yuv420p -movflags +faststart`; mux the voiceover
  with `-itsoffset`.

## 9. Working with an AI coding agent on this

- Give it this playbook, the reference images, the script or voiceover, and the look targets.
- Ask for **rounds with a check**: each round ends with a parity sheet (Cycles vs three.js, same
  camera) and the metrics table, before any video render.
- Make it keep a `docs/LOOK_ANALYSIS.md` of what it measured and changed.
- Build locally with a GPU (live preview at 60 fps, fast renders). Use the cloud for Blender batch bakes.
