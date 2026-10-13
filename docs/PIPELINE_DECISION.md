# Blender + three.js, or three.js alone?

**Question:** Blender is one of the two halves of this pipeline. Could three.js do everything on its own and give the same film? Would that cost quality, gain it, or leave it the same? Would it make the machine and the renders faster or slower?

**Short answer:** Not yet. Blender does one job that three.js cannot match today at the same quality and speed: the **path-traced bounce light** baked into the room. Everything else Blender does can move to three.js, and some of it should, because it would make iteration faster. The recommended path is a **narrowed hybrid**:
- keep Blender only as an offline light baker;
- move the acting and previs into the browser;
- run one measured test that decides whether an in-browser baker can retire Blender entirely.

The rest of this document gives the evidence, so the decision can be checked rather than taken on trust.

---

## 1. What Blender does in this pipeline today

| # | Job | Where | Size | When it runs | Does it reach the final pixels? |
|---|---|---|---|---|---|
| 1 | **Builds the set**: the flat, furniture and props, procedurally from Python | `blender/lib/geo.py`, `props_*.py`, `scenes/apartment_shell.py`, `set_intro.py` | ~2,800 lines | When the set changes | Yes, as geometry in `room.glb` |
| 2 | **Unwraps UVs**: metric tiling UVs (UV0) and lightmap islands (UV1, smart UV) | `blender/lib/lightmap.py`, `export_intro.py` | ~500 lines | With the set | Yes, as texture placement and lightmap layout |
| 3 | **Bakes light**: a Cycles path-traced irradiance per time of day, minus the live lights (full − live) | `blender/lib/lightmap.py`, `bake.py`, `lighting.py` | ~950 lines | When light or the set changes; 45–90 min on 4 CPU cores | **Yes, it is most of the room's look**: bounce, colour bleed, soft contact shadows, the city spill, the string lights |
| 4 | **Prepares Ivan**: scales the Tripo rig, adds the glasses, makes the head rigid, seats him | `blender/characters/prep_tripo.py`, `ivan*.py` | ~1,500 lines | Once per character | Yes, as the model |
| 5 | **Acts**: posture curves, gaze, two-bone IK hands, finger flexion and keystrokes, baked to keyframes | `blender/characters/acting.py` | ~390 lines | Every time a performance changes | Yes, as animation in `ivan.glb` |
| 6 | **Previs and reference stills** in Cycles, plus a parity check against the engine | `blender/scenes/previs.py`, `tools/cycles_ref.py` | ~250 lines | During look development | No, these are checks only |

**What three.js does:**
- all the pixels of the film: PBR materials, the live lights (desk lamp, screens, sun), shadows, the lens and depth of field, bloom, haze and dust, the grade and grain;
- the live screens, the cameras and the timing to the voiceover.

That is about 1,650 lines in `engine/src`.

**Takeaway:**
- Jobs 1, 2, 4, 5 and 6 are **code that happens to run in Blender**. They could run in the browser.
- Job 3 is the reason Blender is here.

## 2. The three ways to drop or keep Blender

### A. Hybrid, as today
- **How it works:**
  - Blender builds, bakes and acts offline.
  - three.js plays and renders.
- **Strengths:**
  - the room gets Cycles-quality global illumination at the cost of a texture lookup;
  - the engine runs at 60 fps live.
- **Weaknesses:**
  - two toolchains: Python with bpy and Node with a browser;
  - every acting change is a Blender export (minutes) before you see it;
  - a light change is a 45–90 minute bake on CPU;
  - and Ivan himself gets no baked bounce, only live lights and an environment cube.

### B. three.js only, real-time light (no bake)
- **How it works:** replace the lightmaps with what a browser can compute every frame:
  - shadow maps;
  - ambient occlusion (GTAO or N8AO);
  - light probes or an irradiance volume;
  - screen-space GI (for example the SSGI in `realism-effects`).
- **Strengths:**
  - one toolchain;
  - change a light and see it at once;
  - Ivan and the room are lit by the same system.
- **Weaknesses:** **a visible quality drop in this film specifically.** It is a dark interior lit by small practicals, which is the hardest case for real-time GI:
  - screen-space GI only knows what is on screen, so the bounce flickers and disappears as the camera moves;
  - probes give soft, low-frequency light without the contact shadows under the desk, the shelf and the cork board;
  - the 3 AM look is built from exactly those (see `docs/LOOK_ANALYSIS.md`).
- **Cost to render:** higher per frame than today (more passes), but still seconds per frame on a GPU.

### C. three.js only, light baked in the browser
- **How it works:** keep today's architecture (baked lightmaps plus live lights) but bake with a WebGL path tracer instead of Cycles:
  - `three-gpu-pathtracer` or a lightmapper built on it;
  - xatlas (WASM) unwraps the UVs;
  - a denoiser cleans the result.
- **Strengths:**
  - one toolchain;
  - the bake runs on the GPU, so on your machine it is likely minutes rather than an hour;
  - it could run from the Studio with a button.
- **Weaknesses:**
  - the in-browser bakers are younger than Cycles: fewer light types, no OIDN-grade denoiser, and less control over light paths;
  - it is a real piece of work to build and validate, perhaps several days;
  - the result has to reach parity with the current lightmaps before it can replace them.
- **Cost to render:** identical to today, because the film still plays baked lightmaps.

### D. (For completeness) three.js path-traced final frames
`three-gpu-pathtracer` can render the final frames themselves, path-traced: true bounce on Ivan, physical depth of field and soft shadows.
- **Strengths:** it is the highest physical quality a browser can reach, and it lights Ivan properly, which no option above does.
- **Weaknesses:**
  - roughly tens of seconds to minutes per 1080p frame on a good GPU, against an estimated second or so today;
  - residual noise flickers between frames unless there are many samples or a temporal denoiser;
  - our haze, dust and live canvas screens would need reworking.
- **Best use:** hero stills, the storyboard and look references, not a 37-second film on every revision.

## 3. Side by side

**Ratings:** ●●● best, ●●○ good, ●○○ weak.

| Criterion | A. Hybrid (today) | B. three.js, real-time | C. three.js, browser bake | D. three.js, path-traced frames |
|---|---|---|---|---|
| **Room light quality** (bounce, contact shadows, colour bleed) | ●●● Cycles | ●○○ flat or unstable | ●●○ near Cycles once tuned (to be proven) | ●●● |
| **Ivan's light quality** | ●●○ live lights + env | ●●○ same | ●●○ same | ●●● real bounce |
| **Temporal stability** (no flicker) | ●●● | ●○○ SSGI flickers | ●●● | ●○○ unless many samples |
| **Render time per 1080p frame** (GPU, estimated*) | ●●● about 1 s | ●●○ 1–3 s | ●●● about 1 s | ●○○ 30 s – minutes |
| **Live playback in the browser** | ●●● 60 fps | ●●○ 30–60 fps | ●●● 60 fps | ●○○ progressive only |
| **Time to see a light change** | ●○○ 45–90 min bake (CPU) | ●●● instant | ●●○ minutes (GPU) | ●●○ seconds per still |
| **Time to see an acting change** | ●○○ Blender export | ●●● instant if acting moves to JS | ●●● same | ●●● same |
| **Setup on a new machine** | ●○○ Node + browser + Blender/bpy | ●●● Node + browser | ●●● Node + browser | ●●● Node + browser |
| **Cost to get there** | ●●● done | ●●○ days, plus look re-tuning | ●○○ days, plus a parity proof | ●○○ days, plus noise work |
| **Risk to the locked look** | ●●● none | ●○○ high | ●●○ medium | ●●○ medium |

\* Measured here: 11.5 s per 1080p frame for option A on 4 CPU cores with software GL, so no GPU. The GPU figures are estimates; the Studio's job log shows the real s/frame on your machine.

**Reading it:**
- **A** wins on quality and render cost today.
- **C** is the only option that keeps that quality and also drops Blender, but it has to be built and proven first.
- **B** is the one that would make the film look worse.
- **D** is a tool for stills, not the film's pipeline.

## 4. Performance, plainly

- **Rendering the film:**
  - Baked light is the cheapest global illumination there is: one texture fetch per pixel.
  - Dropping Blender only changes render speed if the bake is replaced by something computed per frame (B or D), and that is slower, not faster.
  - With C, render speed stays the same.
- **Your machine while working:**
  - Blender matters only while it bakes or exports.
  - A CPU bake takes the whole machine for an hour. A Cycles GPU bake (OptiX or Metal) on your machine takes minutes.
  - Run on your local GPU, the Blender step stops being the bottleneck it is in the cloud.
- **Iteration:** this is where three.js-only really wins. Acting and lighting tweaks you can see instantly are worth more than any render-time difference, which is why moving **acting** to the browser is the first recommendation.

## 5. Recommendation

1. **Keep Blender, but only as a baker** (job 3, plus the set geometry until it changes rarely).
   - Nothing about the film's look depends on anything else Blender does.
   - The Studio already runs the bakes as a job, and on a local GPU they take minutes.
2. **Move the acting to three.js** (job 5).
   - Port `acting.py` (posture curves, look-at, two-bone IK, finger flexion, keystrokes) to `engine/src/acting.js`, running on the same skeleton.
   - You would then adjust a performance in the Studio's player and see it at once, with no export.
   - This is about 400 lines of well-understood maths, and it also removes the hand-posture bugs that come from baking.
3. **Run the decisive test for option C.**
   - Bake the 3 AM room with `three-gpu-pathtracer` on your GPU.
   - Compare it with the Cycles lightmaps in the parity sheet (`tools/look_metrics.py`, same cameras).
   - If it matches within the look tolerances (mid-grey share, key/fill, contrast), Blender retires and the pipeline becomes Node plus a browser.
   - If it doesn't, keep Blender as the baker and stop there.
4. **Use path tracing (D) for hero stills only:** posters, the storyboard and look references.

## 6. What would change the answer
- **Very large or open sets** (streets, many rooms): baking gets expensive everywhere, and real-time GI (B) becomes the practical choice.
- **A lot of moving light** (doors opening on sunlight, a lamp carried around): baked light can't follow it, so B or D gain ground.
- **A WebGPU path tracer** with a strong temporal denoiser making D cost a few seconds per frame. Then D becomes the film's renderer, and quality goes up, especially on Ivan.
