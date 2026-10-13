# three-blender (vendored)

Upstream: https://github.com/ppmpreetham/three-blender (MIT), commit in UPSTREAM_COMMIT.
Imported as a Python package (`import three_blender`) from headless `bpy`; no Blender UI needed.

Local patches:
- `exporter/coords.py`, `cameras.py`, `lights.py`, `animation.py`: cameras and lights use
  `AXIS_CONVERSION @ R` (not the mesh conjugation), otherwise they aim 90 degrees off.
- `exporter/cameras.py`: three.js `fov` is vertical; convert from Blender's horizontal sensor fit.
- `exporter/runtime.py`: OrbitControls target in front of the lens, not the world origin.

Known issue (open): with these fixes the exported page's framing still differs from Cycles on
`blender/scenes/poc_desk_3am.py`, while Blender's own glTF exporter + GLTFLoader frames it
correctly. Until resolved, the film engine (`app/`) loads single-file GLBs from Blender's
official exporter; three-blender stays useful for quick previews and procedural-material baking.
