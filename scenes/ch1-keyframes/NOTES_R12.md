# Director's notes on the 720p preview `anim4` (2026-10-16), round 12

Times are m:ss. Status: `[x]` = done and checked in still frames.

| Time | Shot | Note | Cause | Fix |
|---|---|---|---|---|
| 1:58–1:59 | K33 | the hand glitches into frame | the cut landed with the mug below the frame; hand and mug then jumped to his lips in 0.7 s | `[x]` the cut lands mid-sip (mug at the lips), then the mug lowers slowly out of frame across K33 into K34 |
| 2:01–2:02 | K34 | the light trails should have micro-animation and grow smoothly | the city's "thinness" lines all appeared on the cut | `[x]` each line grows out of a point like a light trail, staggered over ~2 s, then keeps drifting sideways |
| 2:06–2:07 / 2:24 (screenshot) | K35 / K40 | the cup hand is wrong and shaky; check other angles; a better angle and a slight dolly | K40's top-down hid how he holds the mug (it looked like it floated in front of the hand); the tremor (sin at 44/37/51 rad/s) aliased at 24 fps into jumps | `[x]` K40 is high front-left, 32 mm, with a 6% push: his face, the typing hand and the mug hand all read (checked from 8 angles first). The tremor is an 8–10 Hz shiver over a slower waver. K35's sip lifts over 1.1 s instead of 0.6 s |
| 2:29 | K41 | his whole face is blurred | focus sat 30 cm in front of his face (100 mm at f/2) | `[x]` focus `'iris'`: the real eyeball bones, at the cornea |
| 2:40 | K43 | too much blur on the keyboard; he should tap Enter | f/5.6 at 26 cm; the finger pressed a key at the left end, not Enter | `[x]` arm IK (`tapEnter`): the index tip hovers 3 cm over Enter, comes down at 160.2 s and lifts off. Camera front-right, low, f/8, focus on the fingertip bone. The key shows ⏎ (every key on the deck is the same size; Enter is the last key of the home row) |
| 2:43 | K44 | something interesting: light switching on his face, from the screens, as he works across many things | | `[x]` `flick`: the screen light on his face switches colour and level every 0.3–0.7 s (terminal green, chat cyan, white doc, blue IDE, warm page), snapping in 80 ms, then flares cyan-white on the pass chord |
| 2:46 | K45 | the building's colour blocks could change in patterns | | `[x]` his icons light up row by row from the street; a diagonal band of light runs across the facade every ~1.5 s, waking the rooms it passes; a few rooms switch on and off |

## New engine pieces
- `pick('iris')` and `pick('bone:<name>')` in `engine/src/main.js`: focus on the real eyes or any bone (a fingertip).
- `tapEnter` in `kf1/scene.js`: arm IK onto the Enter key (`legends.userData.enter`, from `keys.js`).
- `flick: [t0, t1]`: screen-light switching on the face (K44).
- `animFacade(age)` in `stage.js`: the monolith's panes animate.
- `tools/_probe_frames.mjs <outDir> <f1,f2,...>` renders a list of frames, each twice.

## Render
The 1080p final was rendered before these fixes. The changed shots are re-rendered into the same take: K07, K16 and K36 for the ⏎ legend, plus K33–K36 and K40–K46. Then the whole film is re-encoded.
