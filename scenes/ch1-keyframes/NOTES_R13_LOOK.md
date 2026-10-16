# Round 13: the look overhaul and a glitch audit (2026-10-16)

Checkpoint before this round: git tag `ch1-checkpoint-r12` (branch `checkpoint/ch1-r12`), with the film and a source zip in `../checkpoints/ch1-r12/`.

Working rule from the director: **keyframes only**. No bake, preview or film render until asked; changes are shown as keyframe boards (stills, several angles for the glitched shots).

## 1. The reference: "Three.js – Funniest thing you'll see today" (OpenKnight, 2:18, 1080p30)

Studied as 6 contact sheets (one frame a second) and 24 full-resolution frames. Private study only.

**What makes it look expensive while being low-poly:**
1. **Low key, deep blacks.** Most frames are 70–90% near-black. Light is a few practical sources, never an even fill: streetlights, headlights, a dashboard, a CRT, a wristwatch. Shadows hold no detail and the frame is not afraid of darkness.
2. **One coloured key per shot, and it paints the face.**
   - **Interior:** the face is drenched in red, or in orange from the dash.
   - **Street:** a cool blue-violet ambient, with sodium-amber practicals.
   - **Desert:** a magenta-to-peach sunset.
   - **Skin:** never neutral beige. Skin takes the colour of whatever lights it.
3. **Bloom is big, soft and keeps its colour.**
   - **LEDs:** a red LED blooms *red* and a green one blooms *green*. The core is saturated and the halo spreads 5–15% of the frame.
   - **Streetlights and headlights:** a creamy white-gold, with a wide veil that lifts the haze around them.
4. **Anamorphic streaks:** thin horizontal flares through hot sources (headlights, the scanner, the watch light), plus a horizontal ghost line.
5. **Atmosphere:**
   - **Haze:** air you can see. Headlight cones in haze, and a glow halo around every lamp.
   - **Smoke** in the action shots.
6. **Big, creamy bokeh:** out-of-focus lights become large discs, and shallow focus on faces. The background is mostly bokeh shapes.
7. **Emissive screens with texture:**
   - **CRTs:** blue phosphor, scanlines, noise, a curved vignette, glowing vector lines.
   - **LED segment displays:** red and green digits with visible segments and scanlines; panels that read as *light sources* rather than pictures.
8. **A deliberately fictional, simplified world:** pixel-block buildings with random lit windows, flat stylised mesas, clean simple props. The simplicity is held together by *cinematic light*. That is the "unnatural fictional quality": stylised geometry, real-camera light.
9. **Texture of the image:** fine grain, a little chromatic aberration at the edges, a soft vignette, motion blur on fast moves, a 2.39 letterbox, and tiny red monospace HUD text with green status dots on the title cards.
10. **Colour script per sequence:**
    - night street: blue and amber;
    - inside the car: red;
    - computer: blue CRT and orange;
    - desert: magenta and peach;
    - showroom: neutral, with one hot pink.

    Each sequence has *one* idea.

**What we borrow, and how it maps onto Ch 1:**

| Reference device | Where it goes in Ch 1 |
|---|---|
| The face takes the practical's colour | the night room: the monitor's cyan-blue key on his face, the desk lamp's amber pool, the string lights as warm bokeh |
| Coloured bloom with a saturated core | the screens, Claude, the pixel icons, the light rays, the facade |
| Anamorphic streaks | the lamp bulb, the screen flare in K44, the light rays, the Enter press, the eye in K02 |
| Haze and visible air | the lamp cone in the room, the void worlds, the balcony |
| Big bokeh | the string lights, the city, the void particles |
| A CRT / LED texture on screens | the laptop and monitor UIs (scanlines, phosphor glow) |
| A colour script with one idea per sequence | see section 3 |
| The stylised world, real light | the voids (K21–K28) and the monolith: keep the simple geometry, but light it like a film |

## 2. Audit of our 1080p final (`ch1-checkpoint-r12`)

Read as 7 sheets (one frame a second) plus full-resolution checks. Problems, with causes:

### Lighting and look (the whole film)
- **L1 Flat and evenly lit.** The room reads as soft fill from everywhere; faces are lit frontally with no direction, no rim and no colour. (Room fill too high, no dominant key, lamp and screens too weak as sources.)
- **L2 Muddy palette.** Olive-green walls, brown wood and beige skin dominate, so there is no colour idea per sequence. The reference has saturated accents on deep black.
- **L3 Practicals don't glow.** The desk lamp is a white disc; screens don't wash the face or the desk; the string lights barely bloom. The bloom (strength 0.32, threshold 1.4) is far too restrained for this look.
- **L4 Glows go white.** AgX desaturates bright colour, so every glow turns white-beige instead of a deep colour.
- **L5 No air:** no visible haze in the lamp cone or around the screens.
- **L6 Plastic skin and hair.** Even light on clay-like curls and smooth skin reads as a toy; low-key coloured light hides this and adds mood.

### Glitches (shot by shot)
| Time | Shot | What's wrong | Likely cause |
|---|---|---|---|
| 0–2 s | K01 | the top-down room is murky, with no light to read | no practical glow, low exposure |
| 13–15 s | K04 | the laptop screen is a blown white block | screen emissive too hot for that exposure |
| 21–26 s | K07 | a hard green line along the laptop lid edge | the green light / rim catching the lid bevel |
| 42–45 s | K12 | the window "city" is a flat brown cut-out with a white cloud band | the window backdrop texture |
| 46–50 s | K13 | the shirt is boxy (square shoulders); an orange **ring** floats by his hip; the phone is a black card | cloth skinning on raised arms; the drown halo ring; no screen light on the phone |
| 51–54 s | K14 | the phone reads as a white stick; the forearm comes out of a rigid sleeve tube | the phone is edge-on to the camera; sleeve deformation |
| 55–59, 68–70, 74–84, 178–181 s | icons | flat pastel stickers, no glow, no depth | the icon material and design (see section 4) |
| 94–96 s | K25 | Ivan stands in a beige disc on black, **the water glass floats alone at his feet**, and the rays are opaque plastic bars with no glow | the desk prop glass is not hidden with the desk; the pool disc; the streak material |
| 97 s | K26 | an almost empty black frame (rays not born yet) | timing of the ring and ray births |
| 113–117 s | K32 | the envelopes are a beige clump; a huge dark monitor fills half the frame | envelope layout and camera |
| 120–125 s | K34 | face lit by a flat front fill | the balcony `spill` light |
| 126–128 s | K35 | the neck is a featureless pale tube; the fingers curl over the mug rim into the coffee | the sip pose and grip for a far hand seen from behind |
| 143–147 s | K40 | **the mug hand is reversed and deformed**: the hand wraps the mug from behind with the wrist bent back, and the mug floats in front of the bicep; the tremor makes it worse | the arm IK target and pole for a cup held at chest height while seated |
| 162–165 s | K44 | the face blows out to white-pink, waxy and ghostly; the glasses rims go teal | flick light plus exposure plus AgX highlights |
| 169–171 s | K46 | a figure on a flat white void, no depth | no ground shading, haze or light |
| 182–194 s | K50–K52 | sleeves are stiff tubes, upper arms swollen in the hands-behind-head pose | skinning at extreme shoulder angles |
| 195.5–201.6 s | end | 6 s of black | `cutBlack` 195.52 (check against the VO and end card) |

## 3. Colour script v2 (one idea per sequence)

| Sequence | Shots | Key | Accent | Feeling |
|---|---|---|---|---|
| The flow (day to evening) | K01–K11 | warm amber lamp, low | the monitor's cyan, for the first time | cosy, absorbed |
| The phone and the drowning | K12–K15 | the phone's cold white-blue | a sick green | overwhelm |
| 3 AM | K16–K20 | monitor cyan-blue on the face, the room black | the sticky note's yellow | tired, alone |
| The voids (imagination) | K21–K29 | violet and indigo dark, saturated cyan and magenta light | gold sparks | wonder |
| The balcony | K30–K35 | city amber and teal bokeh, cold blue night | the mug's warm rim | thin, fragile |
| 4 AM and the crash | K36–K44 | screen blue, then the K44 flare to cyan-white | the lamp's amber | dread, then rush |
| He built that (monolith) | K45–K47 | pale dawn, rim-lit | his icons on the facade | awe |
| Morning, rest | K48–K52 | sunrise gold through the window | a soft pink | warmth |

## 4. The holographic pixel icons (director's brief)
- **Voxel form, but designed:** bevelled cubes with depth, read as a 3D object (refs: the voxel TV, the smiley, the computer).
- **A deep glow, not white bloom:** the saturated core colour stays saturated; a wide outer halo in the same hue; colour holds even at the brightest pixel.
- **Holographic:**
  - slightly translucent, so you see a little of the far side and its inner faces;
  - a fresnel edge;
  - faint scanlines moving through it;
  - a subtle chromatic split at the edges;
  - a soft light cast on nearby surfaces.
- **Alive:**
  - a slow bob and turn;
  - pixels light up in sequence when the icon is born;
  - a shimmer.
- **Redesign each icon's pixel art:** mail, calendar, clock, docs, chat bubble, pipeline icons, the life-ups. Make them more legible, better proportioned and richer in palette (2–3 tones per icon plus a highlight).

## 5. Order of work
1. Glitches K25, K40, K35, K13/K14, K12 window, K44 blowout, K32: fix and check from several angles (boards).
2. Look v2:
   - **Post:** a colour-keeping bloom (wider, lower threshold for emissives), an anamorphic streak pass, a deeper grade, haze.
   - **Lighting per sequence:** the colour script above.
3. Icons v2: the holographic voxel material and redesigned pixel art.
4. Keyframe boards, before and after, for the director. No film render until asked.
