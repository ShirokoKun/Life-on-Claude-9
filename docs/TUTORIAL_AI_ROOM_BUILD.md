# What the "AI-built room" tutorial teaches (and how we use it)

Source: the director's reference video (2:48, 1080p, 24 fps), Google Drive `1jSXkj6Lq8ZW2q42jvTbct09q44iSJcaQ`.
Contact sheets: `reference/taste/tutorial_ai_room_sheet_*.jpg` (one frame every 2.5 s).

**The point of the video is method, not the room.** The director has said plainly: the tutorial room is for learning;
the work we make should be more cinematic and more interesting than a room. Learn the pipeline, then apply it to
better subjects.

## 1. The pipeline, step by step (as the video shows it)

| # | Stage (video title) | What happens | The lesson for us |
|---|---|---|---|
| 0 | Final shots first | It opens on the finished film: a cramped Japanese home office, daylight through blinds, a handheld camera. | Show the goal first. Every build starts from the target frame. |
| 1 | **Building the Room** | AI-written Blender scripts build the shell: floor slab, walls, window frames with mullions and wire-glass, the L-desk with drawers, a cubby shelf. All grey clay. | Architecture first, in real metres, in grey. Judge proportions before any material exists. |
| 2 | **Building the Blinds** | The blinds alone: headrail, about 40 slats with a slight curve, ladder cords, a pull-cord with a metal tassel. | One hero "system" object, modelled with real mechanical detail, because it shapes the light. It earns the attention because it makes the light stripes. |
| 3 | **AI-Generated Prop References** | The AI makes a reference image for each prop (vacuum, plush toy, towels, bag, figure, lamp, scanner, junk piles). | Every prop gets a picture before it gets a model. |
| 4 | **AI-Directed Asset Creation** | For each asset the AI chooses: model it directly (blinds, desk, cabinet, shelves, rack, monitor, cork board, rug, calculator, pens) or generate it in Tripo from the reference and refine it (sofa, chair, lamps, cans, mugs, controllers, figures, bags, cables, food packets). The scorecard is 41 direct-modelling types and 70 generated types, with repeated instances grouped. | **Decide per asset**: geometric, hard-surface objects get scripts. Organic, soft or complex ones (cloth, plush, food packets, cables) get generated. |
| 5 | **PBR Refinement** | Foil packaging: metallic response and roughness are adjusted only on the exposed silver areas. | Fix materials by region and by response, not by colour. |
| 6 | **AI-Assisted Model Repair** | A generated radio had a mushy grille and dial. Scripts rebuild the grille and the tuning dial and keep the body's UVs and normals. | When generation fails on detail, rebuild only that part procedurally. |
| 7 | **Dressing the Room** | Large props go in first (chair, desk units, shelves, vacuum, bag). Then mid-size props (monitors, PC, lamp, laptop), then small ones (mugs, cans, papers, figures, cables, a waste basket). | Dress from big to small. Clutter clusters where a person lives and thins out with distance. |
| 8 | **AI-Authored Shaders** | First neutral surfaces (all grey: read the form and the light), then the final materials: node materials, surface wear, glass. | Grey pass, then materials. Wear (edges, grime, fingerprints) is what makes it real. |
| 9 | **AI-Authored Lighting** | Sky + monitor light, then the sun added, then sun direction and exposure tuned. | Light in layers: ambient sky, practicals, then the key (sun). Check each layer alone. |
| 10 | **AI-Authored Atmosphere** | Volumetric scattering so the light through the room becomes visible. | Atmosphere is what turns a render into a frame. |
| 11 | **AI-Authored Night Lighting** | A separate night rig: IES profiles on the practicals (desk lamp, task lamps, monitor glow), a city outside the window, dark blinds. | Same geometry, different time of day = a new mood. (We already do this: `timeofday.js`.) |
| 12 | Final film | Handheld walk-throughs, fast whip pans, close inserts of desk details, a lamp switched on in the dark. Both day and night. | Camera that feels operated: handheld, motivated moves, close details, light-change moments. |

## 2. What makes its frames look real (measured by eye)

- **Density with order.** About 110 asset types. Objects cluster: desk mess near the keyboard, books stacked, cables run between devices.
- **Light that has a source.** Every bright area traces back to a window or a practical. The blinds turn the sun into stripes.
- **Muted, slightly desaturated palette** with a few saturated accents (a red toy, a red box, a blue bag), so the eye has landmarks.
- **Contrast through exposure.** The windows clip to white and the room falls into soft dark. Nothing is fill-lit flat.
- **Wear everywhere.** Scuffed floor, creased leather chair, dust on the sill.
- **Lens behaviour.** Wide lens (around 20–24 mm), slight lens distortion, motion blur on the whip pans, shallow focus on inserts.

## 3. How this maps onto our pipeline

| Tutorial step | Ours |
|---|---|
| Room scripts | `blender/scenes/apartment_shell.py`, `blender/lib/geo.py`, or, with no Blender, procedural three.js builders (`engine/studies/lib/`) |
| Prop references + Tripo | `docs/WORKFLOW.md` §3.4 (the same Tripo settings work for props: Smart Mesh, PBR) |
| Direct vs generated | Hard-surface: script. Soft, organic, cloth, plush, food: generate and refine. |
| Shaders | `engine/src/materials.js` (CC0 PBR sets, finishes); for studies, `engine/studies/lib/` |
| Day / night lighting | `engine/src/timeofday.js` bakes |
| Atmosphere | `engine/src/atmosphere.js`, `volume.js`; for studies, fog cards and light shafts in `engine/studies/lib/cine.js` |

## 4. Checklist for any new environment (copy into the scene's NOTES.md)

1. Target frame(s) picked and saved in `reference/`.
2. Grey shell in real metres; frame judged from the shot camera, not an orbit view.
3. One hero system object that shapes the light (blinds, grille, ring, lattice...).
4. Asset list, and the decision per asset: script it, generate it, or repair it.
5. Dress from big to small, in clusters with intent, thinning with distance.
6. Grey material pass, then final materials with wear.
7. Light in layers (ambient, practicals, key), each checked alone; then atmosphere.
8. Alternate lighting (another time of day or mood) on the same geometry.
9. Camera: one motivated move per shot, real focal lengths, handheld life.
10. Contact sheet against the references before anything is called done.

## 5. The final film, studied closely (2026-11-07): what to copy

**Camera.** One handheld walk-through, not separate locked shots:
- A wide lens, about 18 mm, operated at walking pace.
- It starts in the doorway with the dark door jamb as a foreground frame, pushes in past the chair, then rises to look
  steeply down at the desk.
- It pans along the window to the toys on the tower, then whip-pans right past the sunlit side wall to the bookshelves,
  the door with its poster, and the sofa buried in bags and boxes. It comes back to the desk.
- The shake is constant. Every fast pan smears with heavy motion blur. The night pass repeats the route.

**Light.** The exposure is set for the room, so the windows and blinds clip to white and bloom into a milky haze. The
room falls off fast from the window: the floor and corners go nearly black. There's no visible sun stripe in the main
take. The night pass:
- the desk lamp is the key, a warm cone on the keyboard;
- the monitor gives a cool glow;
- the window is dark blue with blurred city lights and rain on the glass.

**Shadows.** Very soft and large. The contact darkness is deep under the desk, inside the shelves, behind the chair and
under every object, and no edge is hard.

**Materials.**
- The desk laminate has a satin sheen that catches the window and is the brightest surface after the glass.
- The black leather is glossy, with sharp highlights along every crease and roll.
- Ceramic mugs glint, and the monitors are satin black.
- The walls are matte warm grey, the cardboard and paper rough, the books and labels printed.
- Every surface carries scuffs and dust.

**Mood and grade.** Desaturated and slightly cool; lifted blacks (film), grain, a soft vignette, lens softness.

**Measured** (`tools/look_metrics.py`):

| | Tutorial | Our raw Cycles before the fix |
|---|---|---|
| Black share | 0 % | 18 % |
| Median luminance | 0.06–0.07 | 0.026 |
| Sharpness | 0.8–9.7 | 17 |
| Highlight area | 4–10 % | — |

**Applied in our rebuild:**
- `blender/scenes/tutorial_room.py --film` is the walk-through (waypoints, Catmull-Rom, layered shake, Cycles motion blur).
- The back of the room exists now: the door with its poster and the sofa corner.
- The haze thickens toward the windows.
- `tools/room_post.py` is the lens and grade: lifted blacks, window bloom and haze, softness, cool desaturation,
  vignette, grain.
