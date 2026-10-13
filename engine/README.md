# Claude Nine: intro scene engine (run it locally)

A self-contained three.js film engine for the intro scene: Ivan at his desk at 3:04 AM.
It opens in Chrome, Edge, Firefox or Safari. No build step, no internet needed once cloned.

## 1. See it in your browser

You need [Node.js 18+](https://nodejs.org) (any static file server also works).

```bash
cd Ivan-3dScenes
npm run serve            # -> http://localhost:8080
```

Open http://localhost:8080 in Chrome and press **▶ Play**. The film plays with the voiceover.

| Control | What it does |
|---|---|
| Timeline | Scrub the 32-second film |
| Shot buttons | Jump to S1–S5; hover a button for the shot's intention |
| Free camera | Drag to orbit, right-drag to pan, scroll to dolly; turn it off to return to the shot |
| Lens and film look | Toggle depth of field, haze, bloom and grade |
| Captions | Show the voiceover lines |
| Exposure trim / Desk lamp / Screen light | Re-light live |

The **Panel** button (bottom right) hides the controls for a clean view. The frame counter (bottom left)
shows FPS; on a normal desktop GPU it should sit at 60.

Opening `index.html` directly from disk (file://) does **not** work: browsers block module and asset
loading there. Always use a local server (`npm run serve`, or `python3 -m http.server 8080 --directory engine`).

## 2. Render the MP4s

```bash
npm install                      # playwright (+ ffmpeg-static)
npx playwright install chromium  # once
npm run render                   # 1920x1080, 24 fps, uses your GPU
```

This writes to `renders/`:
- `claude_nine_intro_1920x1080.mp4`, a clean film with no audio and no captions;
- `claude_nine_intro_1920x1080_voiceover.mp4`, the same with the voiceover (starting at 1.5 s).

Options:
- `npm run render:preview` renders at 720p (faster).
- `node tools/render_mp4.mjs --frames 120-260` renders just one shot.
- `node tools/render_mp4.mjs --extra "caps=1"` burns in captions.
- `--soft --step 2` is for machines without a GPU.

If ffmpeg-static did not install, put ffmpeg on your PATH (`winget install ffmpeg`, `brew install ffmpeg`).

## 3. Change things

| To change | Edit |
|---|---|
| Shots, lenses, focus pulls, timing | `src/shots.js` |
| Look (DOF strength, haze, bloom, grain, vignette, letterbox) | `LOOK` in `src/post.js` |
| A material's texture, colour or finish | `LIB` in `src/materials.js` (keyed by Blender material name) |
| Live lights | `src/lights.js` |
| Dust and the lamp beam | `src/atmosphere.js` |
| Geometry or baked light | Re-run the Blender export (see `docs/REBUILD_THIS_PROJECT.md`) |

Live reload: save the file and refresh the browser.

## 4. What's in `assets/`

| File | Contents |
|---|---|
| `room.glb` | The flat; materials named as in Blender, UV0 tiling (1 unit = 1 m), UV1 lightmap |
| `lightmaps/lm_*.exr` | Cycles-baked light (half-float, linear), with the live lights' direct light removed |
| `lights.json` | Blender light data (positions, energies, colours) for the live lights |
| `ivan.glb` | The character, seated, with the 32 s performance |
| `tex/` | CC0 PBR texture sets (ambientCG, Poly Haven; see `tex/CREDITS.md`) |
| `voiceover.wav` | The ElevenLabs voiceover |

`vendor/three/` is three.js r170 (MIT), pinned so the scene renders the same everywhere.
