# Ivan's room (s03): critique and direction, Oct 15 2026

The scene now plays on the **Ch 1 VO package clock**: chapter seconds 0–37.9, lines V01–V07b, then the flashback (s04).
The sound is `engine/scenes/s03/sound.wav`, the package's full mix (VO and sound design) cut at 37.9 s.

## 1. What was wrong (frames in `renders/s03/review_before_sheet.jpg`)

**Sound and clock**
- The scene played the **old intro voiceover** (VO at 6.0 s, different lines: "Not because anyone asked him to…").
- The current VO starts at 3.0 s and ends on "Well… technically, Claude is doing the building. Ivan keeps saying yes."
- Every cut, focus pull and acting beat was therefore landing on the wrong word.
- "It's still full." would have played while focus sat on Ivan's face, not on the glass.

**The glass (the chapter's one image)**
- It was invisible. Scene 3's window-glass rule (`/Glass/` → opacity 0.04) also caught the hero "Tumbler Glass".
- The water wrote no depth, so the depth of field blurred it by whatever stood behind it (his shirt and hands).
- It read as a ghost cylinder with sparkles, mixed into the background.

**Blur, by shot**
| Shot | Before | Problem |
|---|---|---|
| S1, door corner | 29 mm f/2.8, focus on the desk | Everything sharp, no separation. Lamp head is the hottest thing in frame; window bokeh reads as popcorn. |
| S2, glass | Rack glass → face → glass | The rack to his face landed on "still full" once the new clock applied. |
| S3, bloodshot | High in the wall, looking down | Shows the top of his head, eyes hidden. The string lights sit on his head like a halo. |
| S4, reading | Studio override | The override fixes focus at its aim point, so the line-by-line reading pulls never played. |
| S4b, pipeline | Foreground head at f/2.8 | Head is a large warm blob. Stages never lit on the pings. |
| S5a / S5 | "Sent" POV, then lean back with hands behind head | Belonged to the old lines. Nothing showed "Claude is doing the building" or "keeps saying yes". |

**Glasses**
- Ivan wore thin wire frames fitted for an earlier character.
- They floated about 2 cm off his nose, and the arms stuck out sideways past his head.

## 2. Direction now (one move per shot, real lenses, keyed focus)

| Shot | Time | Line / cue | Camera and focus |
|---|---|---|---|
| E1 Three AM | 0–2.65 | room tone | The Studio's door-corner rise, 13 mm (kept). |
| E2 3:04 | 2.65–5.4 | V01; phone wakes at 4.15 | The phone is dark under "It's 3 AM" and wakes on the click. |
| S1 The zone | 5.4–7.85 | "…hasn't eaten since lunch" | The Studio move (kept), now f/2 focused on his eyes. |
| S2 Six hours ago | 7.85–12.8 | V02, "glass" at 8.55 | Opens on Ivan typing with the glass soft in front, then racks to the glass's front wall on "glass" and holds. Slow push. f/5.6. |
| S2b Still full | 12.8–15.7 | sub drop 12.88, V03 | **New cut on the drop.** 65 mm macro on the waterline against the laptop. Locked off (`still`: no drift, no breathing). He stops typing. |
| S3 Bloodshot | 15.7–21.05 | V04, creak 16.09 | Dolly zoom from screen height. Eyes on the upper third (`lift`), string lights out of frame. He hunches on the creak. |
| S4 Reading | 21.05–26.7 | V05 | The Studio camera (kept), with the full glass in the foreground. Focus walks terminal → Claude chat (reply lands on its tick, 23.94) → file list on "Python scripts". |
| S4b The pipeline | 26.7–30.45 | V06; pings 27.76 / 28.46 / 29.16 | DRAFT, REVIEW and SEND each ring on their ping; focus walks with them. "Sent automatically" pops on the send confirm (28.84). f/4 keeps his head a readable soft edge. |
| S5a Hands off | 30.45–35.0 | V07a, chime 32.50 | "Well…": his hands come off the keys. Focus leaves the idle hand for the screen, where Claude writes the code on the chime. |
| S5 Keeps saying yes | 35.0–37.9 | V07b; Enter 35.70 / 36.30 / 36.85; hit 36.25 | Down over his right hand on the keys at f/8. Each "y ✓" lands on its Enter; the screen glow flinches on the hit. Cut to the flashback. |

**Performance:** `acting.py SCENE_S03` → `engine/scenes/s03/ivan_v2.glb` + `acting_v2.json`. It is a new performance; the intro one is untouched and still used by kf1.

**Screens:** the Ch 1 screens through two time maps (`LAP`, `MON` in `scene.js`).
- The laptop keeps its dark-mode chat panel.
- The y/n prompts take over at V07b.

**Glass:** the water is real transmission (IOR 1.33, a faint blue attenuation) and writes depth.
- The glass is a thin clear shell with a cool fresnel edge (`?rim=` tunes it).
- A meniscus line marks the waterline.

**Glasses:** remodelled from the character sheet in `prep_tripo.add_glasses`.
- Slim round frames (39 mm lenses, 2.4 mm rims), centred on his pupils.
- The bridge rests on the nose; the arms run straight back to the ear tops and hook behind the ears.
- Comparison: `renders/ivan_glasses/glasses_before_after.jpg`.

## 3. Not done or not checked
- **Not checked:** real-time playback in the Studio, and audio/picture sync by ear. Times were measured from the narrator stem, and the full mix's cue times are derived from them.
- **s04** is still on the planned clock (its V08 is 0.3 s early against the real VO). kf1, s04 and the intro still wear the old wire glasses until they are re-exported.
- **Camera overrides:** `camera.json`'s E1/S1/S4 overrides were folded into `scene.js` and cleared from the file. Re-saving a camera in the Studio overrides that shot's focus again.

## 4. Review 2: the glass macro and Ivan's skin

### The glass looked like a picture pasted inside it

**Causes**
- The glass and the water wrote depth. The lens (`post.js` depth of field) therefore treated *everything seen through them* as in focus: a sharp rectangle inside a blurred frame.
- three's transmission refracts a sharp copy of the room (no depth of field), which made the pasted look worse.
- The fresnel rim and the meniscus were too bright and stacked into two neon rings.

**Fix** (`heroGlass`, `meniscus` in `scene.js`)
- Only the water writes depth, so focus lands on the waterline.
- Its refraction is frosted (roughness 0.7), so the room through it is as soft as the room around it.
- The glass shell writes no depth.
- The rims are at a quarter of their old strength, the meniscus is a faint line, and the bubbles are at 10%.
- `?wRough`, `?rim`, `?glassOp` and `?glassDepth=1` tune or revert each part.

### Ivan read pale, grey, plastic and pasted onto the room

| Cause | Evidence | Fix (`tweakCast`, `?skin=0` = old) |
|---|---|---|
| Complementary keys overlapping on his face | The live rig lights the face with the lamp (#ffaf24, amber) *and* the laptop (#2a74fe) and monitor (#86b8ff) at once. Amber + blue average to grey on skin. | On his skin, light keeps 45% of its gel saturation (`skinSat`). The room keeps its gels. |
| No bounce from the room | `envMapIntensity` 0.15. The baked room has GI; he had none, so he floated over it. | The room capture fills him at 0.55 (`skinEnv`). |
| Skin shaded like plaster | Plain Lambert: light stops dead at the terminator. | A wrap term with red-orange scatter (cheap subsurface scattering, `skinSSS`). |
| No surface detail | The Tripo normal map is empty: every texel is (0.5, 0.5, 1.0). | A tiled procedural micro-normal (`skinNrm` 0.35). |
| Hard shadows on the face | The renderer used `PCFSoftShadowMap`, which ignores `shadow.radius`, so the monitor and lamp shadows were pixel-sharp. | Scene 3 uses `PCFShadowMap`; monitor radius 9, lamp radius 6. |
| String lights as a halo in S3 | The bulbs sat directly above his head in the reverse. | Hidden for S3 only. |

**Still limited, and needing more than a shader**
- The hair is Tripo clay geometry with no strands and no specular breakup.
- AgX still desaturates his brightest skin, and there is no screen-space AO or contact shadowing.
- The next steps would be:
  - a hair re-texture or re-model, a real skin albedo or normal bake from the sheet, or a better Tripo/Meshy export;
  - an AO pass (a post-order change, which is locked: ask first).

## 5. Review 3: hair and skin, now shared by every scene
- **Shared module:** the character treatment moved from `s03/scene.js` into `engine/src/skin.js`.
  - `main.js` applies it to Ivan in every scene except the old intro, which stays pixel-identical.
  - A scene can pass `SKIN: {…}` overrides or opt out with `SKIN: false`.
- **Baked shading:** `prep_tripo.bake_shading` stores a per-vertex colour, `Shade`, on every exported Ivan.
  - R = Cycles ambient occlusion (inside the curls, eye sockets, nostrils, under the chin, behind the ears).
  - G = a hair mask from the measured hairline.
- **Hair:** under the mask it is darker, richer and deeply occluded, with a broader sheen. It no longer shares the skin's tan and reads as hair, not clay.
- **Skin:** a 12% saturation return against AgX, AO on both diffuse and specular, and the wrap and micro-normal skipped on hair.
- **Re-exported** with the new glasses and Shade: `s03/ivan_v2.glb` (scene 3), `s03/ivan.glb` (the intro take kf1 holds poses from) and `s04/ivan.glb`. The keystroke files came out identical, so the performances are unchanged.
- **Comparison:** `renders/s03/skin2_compare.jpg`.
