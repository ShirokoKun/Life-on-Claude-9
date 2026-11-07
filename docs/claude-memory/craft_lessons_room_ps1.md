---
name: craft_lessons_room_ps1
description: Hard-won technique lessons from the tutorial-room rebuild (Blender/Cycles) and PS1 v2 (rigged CC0 character, p5.brush) - read before any similar build
type: feedback
---
Room rebuild (blender/scenes/tutorial_room.py):
- Build a PLACEMENT MAP from the reference frames before dressing; the director calls invented positions "hallucinated". Compare side by side every pass (ffmpeg hstack of tutorial frame | ours).
- Density by ZONES (desk working area, behind monitors, sill, under desk, floor, walls, shelves); the director's complaint "looks empty" = too few small items. Small junk (packets, chargers, sticky notes, file holders) is what makes it lived-in.
- Match the reference camera: the tutorial wide is close (~2.5 m from the window wall) with a 16 mm lens; hide the front wall from the camera (visible_camera False) when you need distance.
- Cycles windows: glass for camera/glossy rays, transparent for light rays (arch-viz trick), or the room goes black with caustics off.
- Flat boxes without UVs sample one pixel of an image: map images with Generated coordinates (K.gen_uv).
- Black leather reads only with tufted geometry (K.cushion) + low roughness + coat; flat cubes look like slabs.
- Render budget on 4 CPU cores: ~1 min/frame at 960x540, 20 spp with haze; render every 2nd frame and motion-interpolate (ffmpeg minterpolate) for films; frames are resumable (use_overwrite False + placeholders).
Why: the director rejected positioning and emptiness twice; these fixed it.
How to apply: any interior or prop-heavy set.

PS1 v2 (engine/studies/ps1-subway-v2):
- For characters, start from a CC0 rigged base (Quaternius Universal Base Characters via itch.io; Playwright clicks "No thanks, just take me to the downloads") and make the design our own (outfit by bone-weight regions, hair cut, colours). Never copy a known character.
- Pose with IK targets + finger FK in Blender; check with --preview renders (body and --headcam); bake to GLB; drive AnimationMixer from the harness clock; precompute ember/mouth paths for smoke trails.
- Blender's Python has no PIL: paint textures with system python first.
- p5.brush 2.2.3 + p5 2.2.0 vendored in engine/vendor/p5; paint in a fresh page per texture (it keeps buffers); setAttributes after createCanvas.
PS1 v3 (2026-11-07, director's notes "cigarette goes inside the face", "add outside background", "other models proper"):
- Hand-to-mouth actions need RULES checked in the build: filter-to-lips distance solved, wrist searched for alignment, finger-in-head test; rest pose keeps the hand beside the shoulder so smoke clears the face.
- Colour-block clothing by body region (bone weights + height), never by a pattern on an automatic UV unwrap (it scatters into camo).
- Faceted PS1-cinematic look = planar dissolve (delimit MATERIAL+UV) + flatShading.
- Always keep the approved version frozen (copy + tag) and improve a duplicate.
Room v3 (2026-11-07, director: "check the plan before rendering, don't waste render time"):
- WORKFLOW: refine -> audit (tutorial_room.py --audit: overlap list + ortho plan + iso) -> 720p review stills (48 spp, ~2 min) -> only then the long render. Review at 720p, not 1440p (1440p = 20 min/still).
- Audit catches: chair through desks, door blocked by bookcase, clutter in the walkway, props inside props, doubled ceiling fixtures, assets facing the wall (Poly Haven wall_clock needs rz=-90 on an x-max wall). Exclude cables from bbox overlap tests.
- Look: dim grey-green walls, exposure -0.95, bloom only on clipped pixels + highlight shoulder (else windows wash to white), area lights hidden from camera, muted prop colours, dielectric spec ~0.35, satin desk.
- Cost on 4 CPU cores: 1280x720, 40 spp adaptive 0.04, motion blur, DOF = ~78 s/frame; real 24 fps beats every-2nd-frame interpolation.
