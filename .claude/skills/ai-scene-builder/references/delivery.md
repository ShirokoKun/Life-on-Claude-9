## 11 / Render in stages and protect the workstation

Inspect actual hardware and current workloads. Identify the intended render device explicitly; do not assume GPU numbering is stable or that multiple GPUs pool their memory. If I need the workstation responsive, prefer a suitable non-display GPU when available, limit competing CPU work, and benchmark. Do not launch overlapping render queues without checking resources.

Use a preview ladder: simple geometry or Workbench for timing; low-resolution shaded tests for materials and lighting; short representative beauty renders for motion blur, noise, and effects; then final output. Example starting points are 640–960 pixels wide for early motion tests and a short 1080p test before 4K, adapted to the actual shot. Sample counts are measured settings, not a guarantee of quality.

Benchmark representative frames including the most complex effects. Estimate render time from measurements and identify uncertainty. Check memory use, noise, denoising artifacts, texture detail, temporal flicker, motion blur, and depth of field. A half-frame shutter is a useful starting point for cinematic motion blur, not a mandatory setting for every scene.

Render numbered image sequences so interrupted jobs can resume. Use scene-linear EXR for compositing where needed, or an appropriate high-quality image format for simpler delivery. Validate frame dimensions, expected count, missing or corrupt frames, and sequence order before encoding a review video at the agreed frame rate. Never silently fill missing frames and call the render complete.

Keep previews and finals clearly separated. Finals should contain only the latest approved deliverables. Preserve the source scene, scripts, texture dependencies, animation controls, and any required simulation caches. Record resolution, frame rate, frame range, color pipeline, render settings, and measured limitations.



## 12 / Optional Unreal Engine branch

Only take this branch if I want an interactive or real-time version. Preserve the approved Blender scene and use a separate export staging copy. Do not promise that import will reproduce the offline renderer exactly.

Test a representative subset first: structural geometry, one complex material, a transparent or reflective surface, a hero prop, and the camera. Choose an exchange format supported by the installed versions. Check units, coordinate conversion, hierarchy, pivots, normals, UVs, material assignments, and texture paths before importing the whole scene.

Bake or rebuild unsupported procedural materials into suitable PBR maps. Keep illumination out of base color. Verify normal-map conventions and color/data texture interpretation. Match camera filmback, focal length, aspect, framing, and exposure before tuning the look. Rebuild lighting and atmosphere intentionally; numeric values do not necessarily translate one-to-one.

For a Lumen workflow, verify it is actually enabled and inspect surface coverage, reflections, light leaks, small geometry, transparency, and temporal artifacts. Keep important room elements separately addressable. Compare matching views with the Blender reference and review a moving camera, not just one accumulated still.

Measure performance at recorded settings on the intended hardware. Report visual differences and practical tradeoffs. Deliver an editable project and a repeatable import procedure. Do not use a flat render, offline path-traced result, or changed camera as proof of a matching real-time scene.



## 13 / Optional compositing, editing, and delivery

Keep 3D geometry, physical movement, occlusion, lighting, and rendered motion blur in the scene. Use compositing for restrained glow shaping, grading, lens integration, and finishing. Export useful emission, depth, and object masks when the workflow needs them. Preserve linear/display color handling and do not apply the same display transform twice.

Build the rough edit with plain footage and stills first. Set timing before elaborate graphics. Keep the source clips accessible and any graphics editable. Add purposeful B-roll where the narration refers to the visible subject, rather than covering every gap. Avoid unnecessarily short inserts and redundant shots.

Keep one clearly identified current edit, retain the source clips, and archive older versions.

Agree on delivery frame rate before editing. If converting footage speed, distinguish frame-for-frame conforming from frame interpolation or duplication, explain duration changes, and preserve synchronized audio. Audit cut boundaries for one-frame gaps and accidental flashes of lower tracks.

Use proxies or suitable cache media when needed for editing performance. Keep the master resolution and original sources available for final output. Add punch-ins, graphics, music, sound effects, audio mix, and subtitles after the timing is stable. Use only authorized music and other third-party assets.



## 14 / Review gates and stopping rules

Ask for creative review at five meaningful points: concept; blockout; a representative finished asset and look; motion test; final-quality test. Combine gates for simple projects. Continue routine work within the approved direction without asking about every minor technical step.

At each gate, show the actual result, describe the largest remaining issues, and offer a small set of useful next choices. If I do not answer a required creative or spending decision, do not treat silence as approval. Continue independent preparation where possible.

Change one major category at a time. Preserve successful work. Set a small revision budget for each test, compare versions, and stop repeating an approach that is not improving the result. Diagnose the reference, geometry, material, motion, lighting, or tool limitation before another costly attempt.

Do not label work final because a script ran successfully. Validate the visible output and explain anything that remains approximate. Keep previews honest: identify viewport renders, crops, upscales, procedural approximations, and uncached simulations where relevant.



## 15 / Final handoff

Deliver the latest editable scene, required assets and caches, approved stills or video, and a short README explaining how to reopen, modify, and render the project. Include a small shot and asset manifest, the agreed output settings, unresolved issues, and any attribution or license notes needed for supplied assets. Confirm dependencies resolve after reopening.

Finish the requested stage and identify the next useful step. Do not restart discovery questions when the user has already supplied the direction.
