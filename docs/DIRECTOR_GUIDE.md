# Director's guide: from my idea to the film (Ch 2 onward)

**For the director (Swastik):** how to brief a chapter, a scene or a single shot. Vague is fine.
**For Claude:** how to read that brief, what to ask, and how to turn it into frames with the system Chapter 1 built.
Start every session with: *"Read `docs/DIRECTOR_GUIDE.md`, then here is what I have."*

Ch 1 lives in `engine/scenes/kf1/` (code) and `scenes/ch1-keyframes/` (notes). It is the reference for how things are
done, not a template to copy. Take its tools, rules and taste; build each new place and moment for its own story.

---

## 1. What the director gives

Any mix of these, in any order. Nothing here is required except the story.

| Input | Example |
|---|---|
| **The story beat** (a script line or VO line) | "A week later, someone at work compliments him on how clear his writing has become." |
| **The feeling** | "hollow", "he's high on it", "she feels invisible" |
| **Storyboard panels** | sketches or colour frames; say which panel goes with which line |
| **References** | images, film stills, a video; say what to take from each (light, colour, pose, texture, camera) |
| **Motion and transitions** | "match cut", "the environment fades in, not a cut", "the room transforms around him while he sits" |
| **Musts and must-nots** | "his face stays sharp", "no UI on his head" |

Drop images in `scenes/<scene folder>/refs/<shot or beat>/`. Voice notes and rough words are fine. Claude turns them into
the precise version and shows it back.

## 2. What Claude does with it

1. **Read everything first:** the brief, every reference image (open each one), the script section, this guide, and
   the Ch 1 notes for anything similar (`scenes/ch1-keyframes/KEYFRAMES.md`, `TRANSITIONS.md`, `R14_CHECKLIST.md`).
2. **Say it back in film terms:** a short beat table. For each line: the keyframe, the world (real place or imagined),
   the hero (what is sharp), the anchor that carries into the next shot, how we get in, the light idea, and the
   storyboard panel or reference it follows.
3. **Ask only what changes the picture** (section 3). At most 3–5 questions, each with a recommended answer.
4. **Build keyframes:** one composed, lit, posed 3D frame per line. No animation, no film render yet.
5. **Render a board and look at it** before saying anything. Show before/after and the reference side by side.
6. **The director notes the board** (in the Studio player or in chat). Fix, re-render, repeat until every frame is ✓.
7. **Then, in this order:** lock the transitions, refine materials and look, animate (layout, then acting), render a
   720p review film, then the 1080p final.

Never skip a gate. A frame that is not locked is not animated.

## 3. When Claude must ask (and when not)

**Ask** when the answer changes what is built:
- a new place or a new person appears (what it looks like, any reference);
- a word could mean two different films ("transform": the room morphs, or he is somewhere else?);
- the brief conflicts with the script, the storyboard or a locked rule;
- the clock: is there a voiceover for this chapter yet? (Ch 1 was timed to the VO package. Without a VO, frames are
  built in story order with temporary lengths and re-timed when it arrives.)
- a wardrobe or appearance change for Ivan (his clothes are part of his model: a change means a new model).

**Don't ask** for things with a sensible default: the lens, the exact light levels, which tool. Decide, show it, and
name the choice so the director can overrule it.

Every question comes with options and a recommendation. Never a blank "what do you want?"

## 4. The director's words, and how the film does them

How Claude reads a word, and what it becomes in this engine. These are starting points: the director's intention wins.
Fields are those of a shot in the scene's `SHOTS` list (see `engine/scenes/kf1/scene.js` and `engine/src/shots.js`).

| The director says | It means on film | How the engine does it |
|---|---|---|
| **match cut** | same composition, different time or world; only one thing changes | share the camera constants across shots (K01 → K11 → K48 top-downs; K04 → K47 the glass) |
| **fade in the environment / make it appear, not a cut** | the world builds around something that stays | `dim` the room from black up, or a zone whose parts are `born` one by one; the anchor stays lit throughout |
| **the environment transforms while he sits** | the character is the anchor; the world changes around him in one held frame | same camera, his pose held; the room dims to black, then the new world rises in (`zone` + `zopt`, the K13 drowning and K21 void pattern) |
| **walls fall away** | reality peels off a world that was waiting behind it | `zone` with `zoneAt` (the room holds until the beat), `deskAway` (the desk swept off) |
| **dissolve by light / time passes** | the light changes, nothing else moves | `light: '3am -> day (blend a-b)'` or `light: 'day sunrise time-lapse'` |
| **smash cut / snap back** | reality returns hard on a beat | a straight cut on the word; the imagined texture drops to 0 on the cut frame |
| **cut to black / vacuum** | silence, a full stop | `cutBlack: t` or `black: true`; the next shot uses `fadeIn: [t, seconds]` |
| **fade up** | slow return, gentle | `fadeIn` (linear light, not a video fade) |
| **push in / zoom / move closer** | one slow move toward the subject | `from` → `to` with `mv: [a, b]` so it lands on a beat; `ease: 'in' / 'out' / 'lin'` |
| **orbit / go round him** | the camera arcs, the subject stays centred | `arc: [x, y]` (the centre), or a flow across shots (`FLOWS`) |
| **one continuous move across lines** | several keyframes, one camera move | `flow: 'F#'` in each shot, the move in `FLOWS` |
| **rack focus / pull focus to X** | attention moves without a cut | keyed `focus: [[t, target], ...]`; targets `'eyes'`, `'mon:x,y'`, `'lap:x,y'`, a point |
| **dreamy / imagined / in his head** | his imagination: its own texture | a `stage.js` zone; the imagination pass (`ZONE_IMAG`, or `imag` per shot): grain, posterise, duotone |
| **magic / alive** | small things with their own light, appearing on the words | white line icons (`lineicons.js`) drawn on, Claude (`claude.js`), each with its own soft light |
| **real / grounded** | the room's baked light, no imagined texture, natural posture | normal frame: light preset, `key` light, `ev` |
| **cold / warm / lonely** | the colour of the key light on his face | `key: { at, color, k }`, the colour script (`MOOD` / `ZMOOD`) |
| **brighter / darker / it's too much light** | exposure, not more lamps | `ev`, `evTo` (a ramp), `dim` |
| **hold / let it breathe** | no move, the frame sits | no `mv`; breathing is on by default |
| **glitch / fraying** | the image itself breaks | a texture or a stage effect (K34's light trails); never on his body by shader (it failed in Ch 1) |
| **from his eyes / what he sees** | the reflection or the POV | lens reflections (`refl`), the K29 / K41 eye frames |

If a word is not in this table, Claude says how it read it before building.

## 5. Places: what gets built how

| Kind of place | Example | How it's built |
|---|---|---|
| **Ivan's room** (any chapter) | the desk at night, the bed, the door | the same room as Ch 1: s03 set + `kf1/room.js` + the time-of-day bakes. Same objects, same positions (read them from the running scene with `tools/_probe.mjs`), dressed for the story's state (see `docs/WORLD_BIBLE.md` §2: `loop_decay` for Ch 2–3) |
| **A new real place** | office, park, living room, a hallway | its own Blender set (`blender/scenes/`, like `set_room03.py`): real scale, Poly Haven / CC0 props, materials separate from light, baked lightmaps per time of day, exported to the engine. It must reach the room's quality. Measure it against its references |
| **A small code-built real place** | the Ch 1 balcony | `stage.js` style: simple shapes, real light, used when the camera sees little of it |
| **An imagined world** | the drowning, the cheat code, the tower | a `stage.js` zone: simple geometry lit like film, on near-black, with its own texture. Each has one idea |

Rules for every place:
- **One anchor survives every crossing** (the chair, the desk, the mug, his glasses).
- **Every light is motivated:** a window, a lamp, a screen, Claude, a TV.
- **Continuity is planned:** props planted earlier pay off later (Sarah's photo on the desk, the east-wall door for her
  knock, the book with the early bookmark, the hoodie, the glass of water).

## 6. The house rules (carried from Ch 1)

**Look (locked):** `engine/src/post.js` LOOK: AgX, real lens and depth of field, grain, 2:1 letterbox. Changes go on
top (the colour script, `glow.js`), never into it.

**Light and colour:**
- Low key, deep blacks; a few practical sources, never an even fill.
- One coloured key per shot, and it paints the face. Skin takes the colour of what lights it.
- Teal against orange on near-black. Warm is human (lamp, sun, home); cool is the machine and the night.
- One colour idea per sequence. Write the colour script for a new chapter before lighting it
  (Ch 1's is in `scenes/ch1-keyframes/NOTES_R13_LOOK.md` §3).
- Glow keeps its colour (the deep glow), it never goes white.

**Camera:** one move per shot, real focal lengths and f-stops, keyed focus pulls. One hero per frame: what is sharp
speaks, what is soft listens. Find cameras with a probe grid (`tools/_probe_cams.mjs`), not by guessing.

**Composition:** normal frames follow the storyboard panel by panel; imagined frames may go further but must never look
cheap. Side views from his right; he looks screen-right at the machine.

**People:**
- Ivan (as he renders): curly hair, round glasses, a dark navy crew-neck T-shirt, beige trousers. His model, rig and
  existing performances are locked; new poses are added at runtime, new acting is added in `acting.py`, never rewritten.
- Hands must look human: real grips (research the pose), no fingers in the face, no flipped wrists; check from
  several angles. Feet on the floor.
- A new person (Sarah, a colleague) is a new character made the same way as Ivan (reference images, then Tripo, then
  the rig). It needs the director's look reference first.

**Claude (the character):** always the voxel creature, its glow always on, its light real on Ivan's face. It arrives
from a device and assembles; it touches something rather than floating. Its mood follows the story
(warm, bright, cold, hollow).

**Icons and screens:** white outline icons only (no fill, no black), each reading as the exact word spoken, one by one
on the words. Screens are live canvases; text readable at the lens used. Never panels floating on his head.

**Materials:** the director notices fakes at once. Glass reads as glass (rim, walls, base, clear water); cloth as
cloth. Transparent hero objects must write depth or the lens can't focus on them.

## 7. How Claude shows the work

- **Look before claiming:** render, open the frames, compare to the panel and reference side by side.
- **Measure, don't guess:** times, frame numbers, positions from the running scene.
- **Say what was not seen:** real-time playback, sound sync, any frame not rendered.
- **Every round:** a board (`renders/<scene>/<take>/board.jpg`), before/after, and the list of notes with a verdict on each.
- **Write it down:** the scene's `NOTES.md` (ticked only after a render shows the fix), and a short resume note for
  the next session.
- **Commit small** on the project branch; the director follows it in the Studio.

## 8. On the Mac (quick reference)

```bash
node tools/setup_check.mjs                       # first, every new machine; stop if anything says MISSING
npm run studio                                   # the Studio, http://localhost:8080
node tools/serve.mjs 8791                        # or just the engine, for boards without the Studio
node tools/kf_board.mjs --scene kf1 --take r15 --gpu --url http://localhost:8791/index.html
node tools/kf_board.mjs --scene kf1 --take r15 --only K12,K13 --gpu --url http://localhost:8791/index.html
```

A new chapter is a new keyframe scene (the Studio's **+ New scene**, or `project.json`), built on the kf1 modules
(`claude.js`, `stage.js`, `lineicons.js`, `rig.js`, `grip.js`, `room.js`) rather than a copy of kf1's shot list.
Any change to a shared module must leave the Ch 1 frames unchanged: render a kf1 board before and after and compare.

## 9. A brief, ready to fill

```
Chapter / scene:
Script lines this covers:
What it should feel like (start -> end):
Storyboard panels (file + which line each goes with):
References (file + what to take from it):
How it moves (cuts, transitions, camera):
Places and people in it:
Must have / must not:
Anything I'm unsure about:
```

Half-filled is fine. Claude fills the gaps, asks only what matters, and shows frames.
