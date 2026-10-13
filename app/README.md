# Claude Nine engine (app/)

Offline-rendered three.js film engine: Vite, React, TypeScript, @react-three/fiber, drei, @react-three/postprocessing (pmndrs postprocessing) and leva.

**Status: WORK IN PROGRESS. The app does not build yet: `src/main.tsx`, `App.tsx` and the scene and look components are still missing.**

## Pinned versions (package.json)
three 0.185.1 · @react-three/fiber 9.8.1 · @react-three/drei 10.7.9 · @react-three/postprocessing 3.2.0 ·
postprocessing 6.39.5 · leva 0.10.1 · react/react-dom 19.2.8 · vite 7.3.7 · @vitejs/plugin-react 5.2.0 · typescript 5.9.3.
`overrides`: `rollup` is pinned to 4.63.6 because the newest 4.64.6 tarball 404'd on the registry, and `three` is deduped to `$three` because stats-gl pulled in 0.170.

## Done
- `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html` and `.gitignore` are written; `npm install` works.
- `scripts/copy-draco.mjs` runs on postinstall. It copies `three/examples/jsm/libs/draco/gltf` into `public/draco/`, so DRACOLoader has to point at `import.meta.env.BASE_URL + 'draco/'` and never at a CDN.
- `src/engine/params.ts`: URL params `scene`, `cam`, `look`, `render`, `frame`, `fps`, `ui`.
- `src/engine/filmClock.ts`: one deterministic time source (time = frame / fps).
- `src/engine/shake.ts`: deterministic handheld shake (seeded fBm gradient noise, with rotation and position amplitude, frequency, octaves and seed).
- `src/engine/CameraRig.tsx`: copies a source camera (a glTF camera node) onto the R3F camera, keeps the horizontal FOV through `userData.refAspect`, adds shake, and exposes shake controls in leva.
- `src/look/effects/AnamorphicStreakEffect.ts`: a custom postprocessing Effect. It applies a soft-knee threshold and a 1/2 x 1/4 downsample, then blurs along X only with doubling strides, accumulates every level, tints and ADDs the result.
- `src/look/effects/FilmToneEffect.ts`: exposure, then AgX with an ASC-CDL look in AgX space (Punchy is power 1.35 and sat 1.4), then black point, contrast, saturation and gain.

## TODO (unfinished)
1. Write `RadialChromaticAberrationEffect` (CONVOLUTION attribute, offset grows with `pow(r, falloff)`), `FilmGrainEffect` (hash seeded by `filmClock.frame`, grain size relative to 1080p height) and `LetterboxEffect` (aspect 2.0, using the `resolution` uniform).
2. Write `src/look/Look.tsx`: an `<EffectComposer multisampling={0}>` with effects in this order: DOF (`DepthOfFieldEffect`, focusDistance in world metres, bokehScale times height/1080, optional focus target by object name such as "Laptop Screen"), Bloom (mipmapBlur), Streak, FilmTone, SMAA (optional, off by default), CA, Grain, Vignette (built-in), Letterbox. Every parameter goes in leva and in `src/looks/intro_3am.json`, loaded with `import.meta.glob`.
3. Write `src/scene/TestScene.tsx`: a dark room with a desk, a laptop whose screen is a CanvasTexture used as emissive (intensity about 4–6, mesh named "Laptop Screen"), a transmission glass, a RectAreaLight from the screen, and a window with emissive city dots for bokeh.
4. Write `src/scene/GltfScene.tsx`: `useGLTF(path, BASE_URL + 'draco/')`. Pick the camera that matches `?cam=` or else `cameras[0]`, set `userData.refAspect` from the glTF aspectRatio, and pass it to CameraRig.
   - **Light scaling:** the Blender exporter writes W x 683/(4π) as candela. A global compensation of 1/683 makes three's lighting match Blender, and leva gets a separate multiplier for point, spot and directional lights.
   - **Area lights:** Blender AREA lights export as empty nodes (for example "Screen Light"). Add a RectAreaLight proxy on nodes named /Screen Light/ or with an `extras.rect_light` value. Use intensity = W/(π·w·h), emit along local -Z, and run `RectAreaLightUniformsLib.init()` first.
   - **Emissive and bloom:** emissive materials need an emissive-boost knob so they feed bloom.
   - **Animation:** play the GLB's animations with `mixer.setTime(filmClock.time)`.
5. Write `src/App.tsx` and `main.tsx`.
   - **Canvas:** `flat`, `dpr={1}` in render mode, `gl={{ preserveDrawingBuffer: true }}` in render mode, and `frameloop="never"` in render mode.
   - **Render controller:** after Suspense resolves, wait for the composer ref to have its EffectPasses (the r3f composer builds passes one render later), then call `advance(frame / fps)` once and set `window.__frameReady = true`. Also expose `window.__renderFrame(n)` so the page can render a new frame without a reload.
6. Write `scripts/render-frames.mjs`. It imports Playwright from `/opt/node-tools/node_modules/playwright/index.mjs`, sets `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers` and launches with args `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`. It starts `vite preview` (or takes `--url`), sets the viewport to width·scale by height·scale, and writes each frame with `canvas.toDataURL` to `out/frame_%05d.png`. Finally ffmpeg runs with `-vf scale=W:H:flags=lanczos` to downscale for `--scale` and encodes to libx264 yuv420p.
7. Build, render 3 frames at 960x540, iterate on the look, and save one frame to `reference/progress/engine_test.jpg`.
8. Check `public/scenes/poc_desk_3am.glb` (camera "Cam OTS", spot light "City Spill" at 3261 cd, which is 60 W in Blender, and the "Screen Light" area light exported as an empty node) through the GLB path.

## Running (once finished)
- Dev: `npm install && npm run dev`, then open `http://127.0.0.1:5173/?scene=/scenes/poc_desk_3am.glb&cam=Cam%20OTS`.
- Render: `npm run build && node scripts/render-frames.mjs --start 0 --end 2 --width 960 --height 540 --scale 1`.
- Look presets: `src/looks/*.json`, chosen with `?look=<name>`.
