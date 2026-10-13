# How the pipeline works (and what you need to do)

## Blender without opening Blender
Blender is published as a Python module (`bpy`). Claude installs it on the cloud machine
and runs it with no window. Every part of the scene (walls, furniture, materials, lights,
cameras) is a Python script in `blender/scenes/`. Running a script:

1. builds the scene inside headless Blender,
2. renders test stills with Cycles (Blender's path tracer) so we can check them,
3. saves a `.blend` file (you can open it in Blender if you want),
4. exports a `.glb` that the three.js film engine (`app/`) loads.

**You don't need Blender installed.** Installing Blender (free, blender.org) is optional and
useful if you want to look at or tweak a `.blend` file yourself. If you edit one, commit it and
Claude will fold the change back into the script.

```
script.py ──(headless Blender)──► .blend + Cycles test stills
                                 └─► .glb ──► three.js engine (app/) ──► post FX ──► frames ──► ffmpeg ──► film
```

## Where three-blender fits
`ppmpreetham/three-blender` turns a Blender scene into a three.js web page. It's vendored in
`vendor/three_blender` and runs headless. Claude fixed 3 bugs in it (camera/light orientation,
field of view, orbit target). Framing still differs from Blender on our test scene (see
`vendor/three_blender/VENDORED.md`), so the film engine loads GLBs from Blender's own glTF
exporter. three-blender stays useful for quick previews and for baking procedural materials
into textures.

## What you do
- Approve or redirect at each gate: Claude shows renders side by side with the reference.
- Character: see `docs/research/CHARACTER_OPTIONS.md` (free routes, and where Magnific's
  3D generator helps).
- Supply taste: reference photos for materials and props, and corrections.
