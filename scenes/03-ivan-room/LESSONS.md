# Ivan's room: lessons (what went wrong, and the rule that prevents it)

Read this before touching the room's light or materials. Our own earlier notes already said most of it:
- `docs/LOOK_ANALYSIS.md` (the OpenKnight read);
- `docs/CINEMATIC_THREEJS_PLAYBOOK.md` §1 and §7.

The room broke those rules while chasing "too dark".

| What went wrong | Why it happened | Rule from now on |
|---|---|---|
| Nine light sources; light patches with no motivation (warm "sun" on the door-side shelf, a hard band on the east wall) | Each darkness fix added a light: sodium up-lights, a city panel, a ceiling fill, a hemisphere fill, sprites | **Three layers only:** a key practical, an accent, a soft ambient through the window. Fix darkness by moving or sizing the key, or changing wall values. Never add a fill. |
| Walls went from flat colour to black | Deep green at ~7–12% albedo: no gradient can read | Walls are mid-value (15–25% albedo), matte, with a quiet texture. Darkness comes from light falloff, not from black paint. |
| The desk and side desk read black and shiny | Lacquer clearcoat reflecting a dark environment | Wood is satin (roughness 0.5–0.65, no clearcoat). Gloss only where it means something (a glass, a screen, the mug glaze). |
| Poly Haven furniture rendered as solid metal | The engine dropped the glTF metalness map, so factor 1 meant all metal | Audit materials (type, roughness, metalness, env, lightmap) with the browser audit snippet whenever new assets come in. |
| The bed looked like chaos | Cloth sim, crease noise, box pillows, mattress not fitted | Soft goods are clean modelled shapes with rounded edges in flat colours. No noise displacement. |
| Random floor (papers, paper balls, two rugs, confetti rug texture) | "Lived-in" was added as scatter | Dress deliberately: a few objects placed for the composition, and most of the floor clear so it shows light. |
| Blue rectangles around the monitors | Additive glow sprites | Glow comes from the post bloom on real emitters. No sprites. |
| Hard bands from the "volumetric" shafts | Analytic window mask with sharp edges, too dense | Air is barely visible and only where light is strong; shafts have soft edges. The playbook rule: the air stays clear except inside beams. |
| Cyan wall under the window | The outside faces of the wall got the sky panel's light, and the lightmap texels were shared | Delete faces the camera never sees before baking; keep lights away from geometry. |
| Blotches and leaks on the bed and at the door frame | Large and small objects sharing 2K atlases | Big surfaces get their own high-res maps; similar texel density per group. |
| Judged by eye, one frame at a time | No fixed comparison | **Keyframes:** `keyframes.json` + `node tools/keyframes.mjs` renders ours next to the reference, with numbers. Every update is shown as that sheet. |
| Patchwork stripes, boxes and blotches everywhere: floor, bed, walls, poster; the "random", flat, unnatural room | **The engine sampled every s03 lightmap upside down** (mirrored in v), so each surface showed another island's light. Proved: flipping the sampling (`?lmflip`) gives a clean room at once. A second, real bug: procedural colours baked black, so the floor bake was empty (`bake.FLAT_ALBEDO`). Three wrong guesses first (moon, hard lamps, z-fighting), and many look "fixes" (ambient, colours) were tuned against the broken maps. | `scene.js flipV` (s03 and ch1). **When a lit surface looks wrong, first prove the data path: pick the pixel (`tools/pick.mjs`), map the lightmap back onto the surface top-down, and compare with a plain Cycles render.** Only then judge the look. |
| Bed frame, nightstand, duvet and floor read black | Albedos of 0.6–5% (a nightstand scan at 0.6%), well under the intro's oak floor (8.4%) | `node tools/audit_materials.mjs --scene s03` lists every material's real albedo; keep wood at 8–20%, fabrics at 10–45%, and compare with the intro's audit. |
| Iterating took 25 minutes per look change | Every change waited for a full 4K bake, and the browser fought the bake for the GPU | Live changes (albedo, ambient, exposure, sky) are judged with captures in a minute. Light-placement changes use `--preview` (half-size maps). The 4K bake runs only after a look is approved. |
