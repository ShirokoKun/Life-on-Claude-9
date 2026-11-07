---
name: director_taste
description: The director's visual taste baseline (PS1 subway, kitchen-in-3-lights, blue-fog/red-glow night) and the quality bar they expect
type: user
---
The director wants AAA-game / animated-feature quality, never "basic simple scenes". Full notes: docs/TASTE_BASELINE.md, images in reference/taste/.
- Taste: muted or cool field + ONE hot accent (red/orange); light with a visible source plus visible air (shafts, fog); wet reflections; foreground framing; depth layers into fog; one living detail per shot.
- "Material on everything should be designed and positioned with intention": no filler props; roughness varies, grime and wear.
- Tutorials are for learning; applied work must be more cinematic and more interesting than the tutorial subject (no plain room scenes).
- Overlays in references (years, HUD icons) are to be ignored.
- 2026-11-07 REJECTED the WebGL "Cistern": "nowhere near the tutorial", "does not look 3D", too much light/glow, no textures, mirror floor weird, unreadable. Use Blender + Cycles with real CC0 assets (Poly Haven), readable first, matte floors, motivated light, every object nameable. See docs/TASTE_BASELINE.md "Rejection" section.
- The director's book of the whole project (249-page PDF, Drive id 1rHS7cQPygzUn58MTPaHGBByj_YPjJXtT) holds the rules ledger (A1-A26, B1-B23...): A15 open assets first, A12 readable first, B4 lighting, B13 world physics, B20 AAA audit.
- 2026-11-07 LIKED the PS1 "Last Train" v1 aesthetic ("I love that aesthetic, save it"). Frozen in engine/studies/ps1-subway-v1/ + git tag ps1-last-train-v1. Next direction (v2): closer to the reference: low-poly but CLEAN and CINEMATIC, better character modelling (proper hand posture, low-poly design like the ref), better environment design and slightly better lighting.
- Every study must carry a small story or an interesting idle loop (something is going on), not a static set.
- Workflow: use Haiku subagents for research (tools, assets, techniques), review their output, then implement. For painting textures, consider p5.js / p5.brush and other open-source GitHub tools.
- 2026-11-07 REJECTED the Blender back-alley built from Poly Haven modular facade kits ("the trashiest models… made the entire thing fucked up"). Generic modular kits read cheap; don't use them for hero sets. Asset choice is judged as hard as the render.
- NEXT (director's order): rebuild the tutorial's room (the cluttered home office with blinds) to match its quality as exactly as possible: models, textures, render, video output. THEN the PS1/PS2 scene from the subway reference. Keep the PS1 system as saved (engine/studies/ps1-subway-v1 + current).
