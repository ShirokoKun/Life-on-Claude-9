# Render stack research: getting the "OpenKnight" film look in three.js

Researched 2026-10-13. I checked versions against the npm registry on that date and confirmed APIs by
reading package tarballs (three r183/r186, postprocessing 6.39.5, three-gpu-pathtracer 0.0.27,
three-fenestra 0.3.0, @remotion/three 4.0.535, @takram effects 0.6.4). Anything I took only from
search snippets or memory is marked **(unverified)**. Some sites could not be reached from this sandbox:
github.com API, remotion.dev, discourse.threejs.org and jsdelivr data.

**Constraint that drives most choices:** the machine this runs on has **no GPU** (4 vCPU, 15 GB RAM,
no `/dev/dri`). Headless Chromium will rasterise through SwiftShader (CPU). WebGL2 is solid there.
WebGPU-on-SwiftShader in headless Linux is unproven, and path tracing on CPU is impractical.

## 1. Recommended stack

| Layer | Pick | Version | Why |
|---|---|---|---|
| Renderer | three.js `WebGLRenderer` (WebGL2) | **0.186.1** (app pins 0.185.1, which is fine) | three-fenestra and the pmndrs post stack are WebGL-only, and SwiftShader handles WebGL2 reliably. Keep WebGPU/TSL as plan B (§3.1). |
| Scene graph / app | React Three Fiber + drei | 9.8.1 / 10.7.9 | Already in `app/`. Also needed by @remotion/three. |
| Post framework | pmndrs `postprocessing` (+ `@react-three/postprocessing`) | **6.39.5** (Zlib) / 3.2.0 (MIT) | It merges effects into a few passes and has AgX, LUT3D, CA, vignette, DOF and godrays built in. v7 is still beta (7.0.0-beta.16, Feb 2026), so don't use it. |
| **Supersampling, DOF, motion blur, soft shadows** | **Custom accumulation pass** (about 200 lines, written by us) | n/a | We render offline, so each output frame is the average of N jittered sub-renders. One loop gives true AA, real bokeh (oval if we want), real shutter motion blur and penumbrae from area lights. This beats any screen-space approximation (§3.2). |
| Anamorphic streaks | Custom `Effect`: a port of three r183 `AnamorphicNode` (MIT) | n/a | No maintained library does horizontal streaks for pmndrs. `AnamorphicNode` was **removed between r183 and r186**; r186 `BloomNode` only exposes a `highPassFn` hook. The algorithm is about 20 lines: threshold, then a horizontal tent-weighted sum at reduced resolution. |
| Ghosts / starburst flare | `LensFlareEffect` from @react-three/postprocessing (has `anamorphic`, `flareShape` and `aditionalStreaks` flags) | 3.2.0 | Use it on flare-on-cut moments only. Fallback: `@takram/three-geospatial-effects` `LensFlareEffect` 0.6.4 (MIT). It does bloom-feature ghosts and halo only, with no streaks. |
| Tonemap + grade | `ToneMappingEffect({mode: AGX})` then `LUT3DEffect` with `LUTCubeLoader` (.cube) | in postprocessing 6.39.5 | AgX is the default mode in 6.39.x. Grade with a .cube authored in Resolve/Blender (§2). |
| AO | Baked AO in the lightmap; `n8ao` for movable objects | n8ao **2.0.1** (ISC, peer postprocessing ≥6.30) | Baked AO is free and clean. Run N8AO per sub-render if characters need contact darkening. |
| GI | Cycles bake (indirect only) to a lightmap on `uv1`, plus `LightProbeGridWebGL` (in r186) for dynamic objects | three r186 addons | Five light presets means five bakes, which is cheap. Skip realism-effects: last release 1.1.2 (May 2023), reported incompatible with current three. |
| Volumetrics | Hand-placed fake beam meshes plus dust particles; `three-good-godrays` for shadowed shafts | 0.12.1 | three-good-godrays declares a peer `three <=0.182.0`, so test it on r186 before relying on it. |
| Interior mapping | **three-fenestra** | **0.3.0** (MIT, June 2026) | See §7. |
| Path tracer | three-gpu-pathtracer + oidn-web | **0.0.27** (Oct 2026) / 0.5.0 | Use it for ground-truth reference stills and maybe hero inserts, and **only on a GPU box** (§4). |
| Assets | Blender glTF exporter, then `@gltf-transform/cli` | 4.5.1 | `optimize`, `meshopt`, and optional KTX2 (needs KTX-Software `ktx` on PATH). |
| Sequencing | **Blender is the source of truth** (glTF animation clips, `AnimationMixer.setTime`) | Blender 4.4+/5.x | Cameras are already authored headless in bpy. r186 GLTFLoader reads `KHR_animation_pointer`, so animated FOV and light intensity can come through. Theatre.js is not recommended (§5). |
| Handheld shake | Camera Shakify (Blender extension), baked to keys; runtime fallback `simplex-noise` | 0.5.1 (Feb 2026) / 4.0.3 | Real recorded handheld data (CC0). Deterministic. |
| Harness | **Remotion + @remotion/three** (Studio preview, render to PNG sequence), with a Playwright fallback script for 16-bit/EXR dumps | **4.0.535** (2026-10-12); playwright 1.64.0 | See §5 for the full evaluation. |
| Encode | ffmpeg (system) | n/a | PNG sequence to ProRes/H.264. Render the true 2.39:1 frame and pad to 16:9 in ffmpeg if needed. |
| Claude skills | `cloudai-x/threejs-skills` (10 skills); `dgreenheck/webgpu-claude-skill` only if we go TSL | n/a | Optional. I did not review their content or licence. |

## 2. Look recipe (reference trait → technique)

| Trait | Technique | Starting values / notes |
|---|---|---|
| Low-key, motivated practicals | Every light has a visible emitter mesh (emissive, HDR intensity 2–20) plus a matching three light. Screen = `RectAreaLight` (needs `RectAreaLightUniformsLib`) plus a shadow-casting `SpotLight` at the screen centre. Lamps = `PointLight`/`SpotLight` with shadows. Ambient is close to 0; the bake supplies the bounce. | RectAreaLight works only on Standard/Physical materials and **casts no shadows**. Fix: in the accumulation loop, jitter the shadow-caster across the emitter's rectangle each sub-render to get correct soft shadows. Drive the screen light's colour from the screen texture's mean colour each frame. |
| AgX / filmic | `renderer.toneMapping = NoToneMapping`, `ToneMappingEffect({mode: ToneMappingMode.AGX})` last before the LUT. Set Blender view transform to AgX for the Cycles check renders. | three's AgX follows EaryChow/Filament's curve. It is close to Blender's AgX "Base" but not identical **(unverified match)**. Fix the difference in the LUT. |
| Crushed blacks | Done in the grade LUT (toe and lift below 0), plus exposure -0.5 to -1 EV. Don't use a black-level effect. | Author the .cube in Resolve on a Cycles still, or with `ociobakelut` against Blender's OCIO config. Load with `LUTCubeLoader` and `LUT3DEffect`. Use tetrahedral interpolation (`LUT3DEffect` has the option). |
| Strong bloom | `BloomEffect({mipmapBlur: true, luminanceThreshold: 1.0, intensity: 1–2, radius: 0.7–0.85})` on HDR (`HalfFloatType` composer, as three-blender already emits). | Bloom must run **before** tonemapping. Emissives above 1.0 drive it, so set screen and bulb emissive intensity explicitly. |
| Anamorphic horizontal streaks | Custom Effect: threshold at luminance >1.5–3, render at 1/4 height × 1/2 width, sum 64–128 horizontal taps (tent weight), tint cool blue (0.6, 0.8, 1.2), add. Offline lets us use 256 taps. | Port `AnamorphicNode` from three r183 (`examples/jsm/tsl/display/AnamorphicNode.js`). Cheaper alternative: reuse BloomEffect's mip chain on a render target squashed vertically ×8. |
| Shallow DOF, big bokeh | **Accumulation DOF**: per sub-render, offset the camera on the aperture disk and shear the projection (`setViewOffset`/off-axis) so the focal plane stays fixed. Sample an **ellipse 1:1.8 (tall)** for anamorphic oval bokeh. Focus distance and f-stop come from the Blender camera. | Needs 32–64 samples for a smooth large CoC. Bright out-of-focus practicals then give real bokeh discs, because bloom is applied after accumulation. pmndrs `DepthOfFieldEffect` (gather) is the preview fallback; three-blender's `height: 480` is too low for finals. |
| Edge chromatic aberration | `ChromaticAberrationEffect({radialModulation: true, modulationOffset: 0.2–0.4, offset: (0.0015, 0.0005)})`, or a custom radial lens shader with `LensDistortionEffect`. | Apply on HDR before the tonemap so highlights fringe. |
| Film grain | **Custom grain** (not `NoiseEffect`, which is per-pixel white noise and time-seeded from a wall-clock delta). Use luminance-weighted Gaussian grain about 1.5 px in size, seeded by `filmClock.frame`, applied **last at output resolution**. | Grain must come after any downscale or it averages away. Don't copy lygia's grain: lygia uses the Prosperity licence (non-commercial). |
| Vignette | `VignetteEffect({offset: 0.3, darkness: 0.5–0.7})` after the LUT. | n/a |
| Heavy motion blur on whips | Accumulation over the shutter interval. 180° = 1/60 s at 30 fps; use 270–360° on whip pans. Sample time stratified per sub-render (`mixer.setTime(t + dt·k/N)`). | Whip pans need about 64+ samples to avoid stepping, so make sample count a per-shot parameter. TSL `MotionBlur` / realism-effects velocity blur isn't needed. |
| Handheld shake | Camera Shakify in Blender on a parent empty, baked (`nla.bake(visual_keying=True)`) before glTF export. Or runtime 2–3 octaves of seeded `simplex-noise` on rotation (0.1–0.4°, 0.5–2 Hz). | Shake has to be a pure function of time, so drei `<CameraShake>` is out (it uses `useFrame` delta). Baked shake is also visible in the Cycles checks. |
| Letterbox 2:1–2.39:1 | Render the real aspect (e.g. 1920×804 or 2048×858). Set Blender's render resolution to the same so FOV and sensor fit match. Add bars in ffmpeg (`pad=1920:1080:(ow-iw)/2:(oh-ih)/2`) or as DOM in Remotion. | Don't render bars in WebGL, because they waste samples. |
| Window interiors (exteriors) | three-fenestra `InteriorMappingMaterial`, instanced, with `emissiveVariation` for lit and unlit windows. | Only for the exterior/city shots. For the balcony view, a few facade planes. |
| Screens with scanlines | Emissive map = UI texture (CanvasTexture or a video texture; in Remotion, `useOffthreadVideoTexture` gives frame-exact video). Shader term: `emissive *= 0.88 + 0.12*sin(uv.y*lines*π)`, plus an RGB subpixel mask, plus a slight edge falloff. `emissiveIntensity` 3–8. | Inject with `three-custom-shader-material` 6.4.0 (MIT) or `onBeforeCompile`. Pair with the RectAreaLight above. |

**Post order (one `EffectComposer`, `frameBufferType: HalfFloatType`; use FloatType for the accumulation RT):**
`AccumulationPass (N jittered renders → linear HDR)` → `EffectPass(bloom, anamorphic, lensflare?, CA)` →
`EffectPass(AgX tonemap, LUT3D, vignette)` → `EffectPass(grain, dither)` → readback.
Sub-pixel jitter inside the accumulation replaces SMAA, TAA and supersampling, so render at the output resolution.

## 3. Notes by topic

### 3.1 Post frameworks compared
- **pmndrs postprocessing 6.39.5**: mature and WebGL-only. Its effects include Bloom, SelectiveBloom, DepthOfField
  (`worldFocusDistance`/`worldFocusRange`), ChromaticAberration (radial), LensDistortion, Noise, Vignette, LUT3D + LUTCubeLoader,
  ToneMapping (AGX default), GodRays, SSAO, TiltShift, Scanline and SMAA. It has **no** motion blur, TAA, SSR, SSGI or anamorphic effect.
  v7 has been in beta since 2024 (beta.16 on 2026-02-19), and its WebGPU plans are unclear **(unverified)**.
- **three.js built-in `EffectComposer`** (`examples/jsm/postprocessing`): UnrealBloom, Bokeh, FilmPass, LUTPass, GTAO, SSR, TAARender,
  SSAARender and Output passes. Each pass is a separate full-screen draw. Usable, but pmndrs is nicer to work with.
  `SSAARenderPass`/`TAARenderPass` show the jitter-and-accumulate idea we generalise.
- **three.js WebGPU / TSL nodes (r186 `examples/jsm/tsl/display/`)**: BloomNode, DepthOfFieldNode, MotionBlur, TRAANode, TAAUNode,
  GTAONode, SSGINode, SSRNode, SSSNode (*screen-space contact shadows*), GodraysNode (from three-good-godrays),
  LensflareNode, ChromaticAberrationNode, FilmNode, Lut3DNode, DenoiseNode/RecurrentDenoiseNode, FSR1Node and SMAANode.
  This is the most complete set. `AnamorphicNode` existed through r183 and is gone in r186. It is the right long-term target, but
  (a) three-fenestra uses `onBeforeCompile` and would need a TSL port, (b) N8AO and pmndrs don't run there, and (c) headless WebGPU
  on a GPU-less Linux box is unproven. **Plan B:** if a GPU render box appears, port fenestra (about 300 lines, MIT) and move.
- **SSR**: we have few glossy surfaces (desk, screen glass, balcony door). Use a box-projected env cubemap or a `CubeCamera` per shot.
  Offline, a per-frame `CubeCamera` is affordable.

### 3.2 Offline quality: the accumulation loop
For each output frame, for k in 0..N-1: set time `t = frame/fps + shutter·(k+0.5)/N` (stratified), set the sub-pixel jitter (Halton 2,3),
the lens sample (Vogel/R2 on an ellipse), and the jitter of each area-light shadow caster. Render to a `FloatType` RT and add with weight 1/N.
Then run post once. One knob (N) trades time for quality per shot. Typical values: 16 for static dialogue, 64 for DOF or whip shots.
alphaHash hair and dithered shadows converge cleanly. Use `renderer.setViewOffset`, or a jittered `projectionMatrix` for
lens shear. Disable the `matrixAutoUpdate` side effects so the AnimationMixer is the only thing moving objects.
Cost on SwiftShader CPU is unknown. **Benchmark one 1920×804 frame at N=16 before committing to a schedule.**

### 3.3 Lighting realism
- **RectAreaLight**: LTC shading, no shadows, Standard/Physical materials only. Use the jittered-shadow-caster trick, or bake.
- **Lightmaps**: in Blender, give each static mesh a second UV ("UVMap.001", single-user data). Bake Cycles *Diffuse → Indirect only*,
  colour off, per preset, to half-float EXR. In three, set `mat.lightMap = tex; tex.channel = 1; tex.flipY = false`
  (r151+ uses `texture.channel`; glTF has no lightmap slot, so the textures load separately).
  Keep direct lights real-time so speculars and characters stay correct. KTX2Loader supports BasisU UASTC-HDR if VRAM gets tight.
- **Probes**: r186 ships `LightProbeGridWebGL` (L2 SH irradiance volume baked from the scene; `LightProbeGrid` is the WebGPU version)
  and `LightProbeGenerator`. Bake one grid per preset to light the character with bounce light.
- **Volumetrics**: the sunrise preset's balcony beams. A hand-built beam volume mesh (additive, noise, depth-fade, soft edges)
  plus about 2k instanced dust sprites lit only inside the beam gives the most control. three-good-godrays raymarches the shadow map
  and is physically right but heavier, and its peer range stops at r182. pmndrs `GodRaysEffect` is radial-blur only.
- **Shadows**: r186 **removed `PCFSoftShadowMap`** (it now falls back to `PCFShadowMap` with a warning). Options are `VSMShadowMap`,
  drei `<SoftShadows>` (PCSS injection), or best offline, the area-light jitter above. Use 2048–4096 maps and tune bias and normalBias per light.
  For contact shadows use N8AO or baked AO. `SSSNode` covers this only on WebGPU.

### 3.4 Materials
- **Glass of water**: `MeshPhysicalMaterial` with `transmission 1`, `thickness`, `ior 1.5` for glass and 1.33 for water, `attenuationColor/Distance`,
  `dispersion` (r163+). **Limitation:** three's transmission pass only sees opaque objects, so water behind glass doesn't refract
  correctly. Merge glass and water into one closed mesh with water IOR, or path-trace that insert. Bubbles: instanced tiny spheres
  with a fresnel-only physical material (high specular, no transmission) plus an env map.
- **Skin**: WebGL has no SSS. Approximate with `MeshPhysicalMaterial` (roughness about 0.45, specular 0.35–0.5, faint red `sheen`), plus a wrap-diffuse
  or red-terminator tweak via CSM, plus a thin translucency term for ears (`examples/jsm/shaders/SubsurfaceScatteringShader.js`).
  WebGPU has `MeshSSSNodeMaterial` (thickness translucency). The reference hides skin with DOF and rim light, and we should do the same.
- **Hair cards**: `alphaHash: true` (r154+) plus accumulation means no sorting problems and smooth edges. Use `anisotropy` and
  `anisotropyRotation/Map` (KHR_materials_anisotropy, which GLTFLoader reads) along the card tangent, and export tangents from Blender.
- **Textures**: offline, VRAM rather than download size is the limit. Keep PNG/JPEG at source resolution by default.
  `gltf-transform optimize in.glb out.glb --compress meshopt --texture-compress ktx2` (UASTC for normals and hero assets, ETC1S for bulk)
  when needed. Check visually, because SwiftShader may transcode to uncompressed RGBA anyway **(unverified)**.

## 4. three-gpu-pathtracer: can it do final frames?
0.0.27 (2026-10-08) is now **WebGPU compute-based** (`three-gpu-pathtracer/webgpu`, `WebGPUPathTracer`, peer `three >=0.185`,
`three-mesh-bvh >=0.9.15`). The legacy `WebGLPathTracer` is still exported from the root. Features: area lights (`ShapedAreaLight`
extends RectAreaLight, rect or circle), spot, point and directional lights (MIS only), emissive materials (**no MIS → noisy small screens**,
so put a ShapedAreaLight on each screen), `PhysicalCamera` DOF, Standard/Physical materials only (transmission yes, SSS no),
skinned meshes via `SkinnedMeshBVH`, `OIDNDenoiser` (oidn-web 0.5.0, MIT), FSR upscaler, `stableNoise`, `maxSamples`, and a
"render video" example. Animation uses `setScene` once, then `updateTransforms()`/`updateCamera()` each frame, with `reset()` and accumulation to `maxSamples`.
Custom shaders (fenestra, scanlines, CSM) are **ignored**. **Verdict:** use it on a GPU machine as a look-truth reference to tune the
raster lights against, and possibly for 1–3 static inserts (glass of water). It is not the film renderer: no GPU here, no custom materials,
and its output bypasses our pmndrs post chain.

## 5. Sequencing, capture and harness
- **Theatre.js**: npm `@theatre/core`/`@theatre/r3f` 0.7.2, last published **2024-05-19**. "1.0 around the corner" has been
  promised since 2024 with development in a private repo, and Studio is AGPL (core is Apache-2.0). Headless playback via
  `sheet.sequence.position = t` is deterministic and would work. But it duplicates the Blender keys and is effectively unmaintained.
  **Recommendation: drop it**. Use Blender for cameras and lights, leva for look knobs, and the Remotion timeline for shot order.
- **Remotion (evaluated seriously)**: 4.0.535 (2026-10-12). `@remotion/three` exports `ThreeCanvas`, `ThreeWebGPUCanvas`,
  `useVideoTexture` and `useOffthreadVideoTexture`. I read the source: while rendering it sets R3F `frameloop="never"` and calls
  `advance()` per frame inside a `delayRender` handle, so the screenshot waits for the GL frame. Pros: Studio timeline scrubbing of
  the whole cut, `<Sequence layout="none">` per shot, audio and burned-in subtitles as DOM over the canvas, frame-exact video
  textures for the laptop and phone UI, `--sequence --image-format=png` or direct ProRes/H.264, frame-range chunking, `npx remotion gpu`.
  Cons: `advance(performance.now())` means **R3F `useFrame` deltas are wall-clock**, so all animation must read `useCurrentFrame()`
  (our `filmClock` already enforces pure functions of the frame). Composer effects that use time (NoiseEffect) are non-deterministic.
  Frames come out 8-bit (no EXR). CPU-only needs `--gl=swangle`, GPU needs `angle`/`angle-egl`. ANGLE leaks memory on long renders, so chunk.
  Licence: free for individuals and companies of **up to 3 people**; above that a Company License is needed
  ($25/seat/mo, or render-based at $0.01/render with a $100/mo minimum).
  **Verdict: adopt as the harness and preview tool** (it fits the existing R3F app). Keep `app/scripts/render-frames.mjs`
  (Playwright, `?render=1&frame=N`) as the fallback that can read back the float RT for 16-bit TIFF/EXR grading in Resolve.
- **Other capture options**: CCapture.js (last release 2020, hooks rAF/Date): skip it. WebCodecs + `mediabunny` 1.61.4 (MPL-2.0)
  encodes in the browser, which we don't need since ffmpeg is on the box. HeyGen **HyperFrames** 0.8.x (Apache-2.0) is a Puppeteer+ffmpeg
  HTML-to-video framework with a three.js seek adapter; it's an alternative to Remotion with no seat licence, but I didn't evaluate it in depth.
  Chrome `HeadlessExperimental.beginFrame` gives frame-exact compositing but no rAF.
- **Determinism rules**: no `Math.random` (use a seeded PRNG keyed by frame), no `performance.now`, `mixer.setTime(t)` instead of `update(dt)`,
  wait for all textures and video frames to load before each capture, `preserveDrawingBuffer: true` or a readback inside the frame.

## 6. Examples and prior art
- Quantales interactive 3D short (R3F, drei, GSAP; about 5.5 min; shots defined as camera/target/FOV data). See the three.js forum
  thread "Interactive 3D Animated Short Film built with Three.js, R3F". It's real-time, not offline.
- Codrops: "Interactive 3D with Three.js BatchedMesh and WebGPURenderer" (2024) builds a DOF, SSAO and vignette tilt-shift look in TSL.
  The Codrops TSL/WebGPU tags have more recent experiments. I found no Codrops article specifically on cinematic grain or anamorphic flares.
- I couldn't find the "OpenKnight" reference online (no search hits), so the reverse-engineering in `docs/PLAN.md` stands as is.
- three.js official examples to crib from: `webgl_shadowmap_pcss`, `webgl_materials_subsurface_scattering`,
  `webgl_postprocessing_ssaa`/`taa` (jitter accumulation), `webgpu_postprocessing_*` (TSL reference for every effect),
  `webgl_lightprobes*`, and the pathtracer's `renderVideo.html`.
- Claude Code skills: `cloudai-x/threejs-skills` (fundamentals, materials, lighting, textures, animation, shaders, postprocessing,
  loaders, and more; install with `npx -y skills add cloudai-x/threejs-skills --skill <name> --agent claude-code`). Its README clone URL points
  elsewhere, so check it first. `dgreenheck/webgpu-claude-skill` covers TSL (r183+). Both are generic, so add them only if they prove useful.

## 7. three-fenestra (verified from the tarball)
- npm `three-fenestra` **0.3.0** (2026-06-18; 0.2.0 was the only earlier release). **MIT.** Author Edgar Pérez (codedgar).
  Repo github.com/codedgar/three-fenestra, demo three-fenestra.codedgar.com. Peer `three >=0.150.0`, no dependencies, and it says "pre-1.0".
- API: `new InteriorMappingMaterial({ backAtlas, backAtlasCols=4, backAtlasRows=4, depth=1, backScale=0.66, planeSize: Vector2,
  windowId: Vector3, interiorEmissive, emissiveVariation, lod, instanced, frontAtlas…, frontTransmission=0.25, glassThickness,
  refractionStrength, glassDirtMap, glassFresnelStrength, glassSmudgeStrength, ...MeshStandardMaterialParameters })`.
  Setters: `setBackAtlas`, `setFrontAtlas(tex, cols, rows)`, `setFrontNormal/Roughness/MetalnessAtlas`, `setGlassDirtMap`,
  `setEmissiveVariation({litRatio, warm, cool, coolChance, brightMin, brightRange, dim} | null)`.
  It has an instanced mode (one draw call per facade), an LOD blend to a flat impostor, and starter atlases at `three-fenestra/starter/{rooms,overlay}.webp`.
  R3F works via `extend({ InteriorMappingMaterial })` with `args={[{...}]}`.
- Implementation: a `MeshStandardMaterial` subclass using **`onBeforeCompile`**, so it is **WebGL-only**. That is the main reason
  this stack stays on `WebGLRenderer`. The README recommends a cool ambient, a warm interior emissive and low bloom (about 0.4) for night.

## 8. Things I could not verify
- Whether WebGPU works under SwiftShader in headless Chromium on this box. Test it with `chrome://gpu` via Playwright.
- How close three's AgX matches Blender's AgX looks, and the actual SwiftShader cost per frame of N-sample accumulation.
- Whether Camera Shakify's shake survives glTF export without baking (assume it doesn't; bake it).
- Content and licence of the cloudai-x skills. pmndrs v7's WebGPU roadmap. Whether three-good-godrays works on r186.
- Remotion screenshot timing with `preserveDrawingBuffer` off (assume it's needed). Remotion docs mention a future "5.0" with auto GL; npm latest is 4.0.535.

## Links
- three.js r186 addons: https://github.com/mrdoob/three.js/tree/dev/examples/jsm (tsl/display, lighting/LightProbeGridWebGL.js) · docs https://threejs.org/docs/
- AnamorphicNode docs (r183-era): https://threejs.org/docs/pages/AnamorphicNode.html · LensflareNode: https://threejs.org/docs/pages/LensflareNode.html
- pmndrs postprocessing: https://github.com/pmndrs/postprocessing · releases tracker https://releasealert.dev/github/pmndrs/postprocessing
- react-postprocessing LensFlare: https://react-postprocessing.docs.pmnd.rs/effects/lensflare
- takram effects: https://www.npmjs.com/package/@takram/three-geospatial-effects
- N8AO: https://github.com/n8python/n8ao · realism-effects: https://github.com/0beqz/realism-effects · forum "Substitutes for realism-effects": https://discourse.threejs.org/t/substitutes-for-realism-effects/86443
- three-good-godrays: https://github.com/Ameobea/three-good-godrays
- three-gpu-pathtracer: https://github.com/gkjohnson/three-gpu-pathtracer · API https://gkjohnson.github.io/tools/docs/three-gpu-pathtracer/ · oidn-web https://www.npmjs.com/package/oidn-web
- three-fenestra: https://www.npmjs.com/package/three-fenestra · https://github.com/codedgar/three-fenestra
- Remotion three: https://www.remotion.dev/docs/three-canvas · GPU/gl flags https://www.remotion.dev/docs/gl-options , https://www.remotion.dev/docs/cli/gpu · licence https://www.remotion.dev/docs/license/pricing
- HyperFrames: https://www.npmjs.com/package/hyperframes · HeyGen write-up https://www.heygen.com/research/html-to-video
- Theatre.js: https://www.theatrejs.com · https://www.npmjs.com/package/@theatre/core
- Camera Shakify: https://extensions.blender.org/add-ons/camera-shakify · https://github.com/EatTheFuture/camera_shakify
- gltf-transform: https://gltf-transform.dev/cli · KTX-Software: https://github.com/KhronosGroup/KTX-Software
- Lightmap forum threads: https://discourse.threejs.org/t/lightmap-uses-wrong-uv-in-loaded-gltf-model/57434 · https://hackmd.io/@XR/lightmapping-web
- Headless Chrome GPU flags: https://developer.chrome.com/blog/supercharge-web-ai-testing
- Quantales short: https://discourse.threejs.org/t/interactive-3d-animated-short-film-built-with-three-js-r3f/92270
- Codrops TSL post example: https://tympanus.net/codrops/2024/10/30/interactive-3d-with-three-js-batchedmesh-and-webgpurenderer/
- Skills: https://github.com/cloudai-x/threejs-skills · https://github.com/dgreenheck/webgpu-claude-skill
