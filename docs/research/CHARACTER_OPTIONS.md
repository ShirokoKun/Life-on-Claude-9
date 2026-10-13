# Character options for "Ivan" (three.js, game-grade realistic look)

Researched 2026-10-13. Target: CC4/MetaHuman-class human (PBR skin, hair cards, ARKit-52 face shapes,
mocap body), exported to GLB for three.js. Constraints: no CC4 licence, Magnific subscription,
Windows laptop (user), headless Blender `bpy` 5.2 on Linux (Claude).

Verification notes: many vendor sites (metahuman.com, dev.epicgames.com, magnific.com,
makehumancommunity.org, polyhammer.com) were **not reachable** from the research sandbox, so their
content comes from search-engine snippets and press coverage. The MPFB2 repo **was** cloned and
read directly (version 2.0.18, last commit 2026-10-04). Anything marked *(unverified)* needs a check.

## Verdict table

| Option | Cost | Quality vs target | Face anim | Effort | Verdict |
|---|---|---|---|---|---|
| **MetaHuman** (UE 5.6/5.7) + Blender bake to ARKit morphs | Free (< US$1M revenue) | **Matches target** (it *is* the target class) | RigLogic joints + correctives; ARKit-52 must be **baked** for three.js | High (UE install on laptop; bake script) | **Hero path**, if laptop runs UE 5.6+ |
| **MPFB2** (MakeHuman for Blender) | Free, CC0 output | Medium: clean but "MakeHuman look"; skin and hair below target | **ARKit-52 + visemes shape keys built in** (faceunits01 pack) | Low: fully scriptable headless by Claude | **Start here** (pipeline + stand-in + extras) |
| CC4 / CC5 trial | Free 30 days | Matches target | Yes (ARKit-compatible) | Medium | No: 30 exports, no Headshot export, no commercial grant |
| Magnific 3D generator (Tripo v3.1 / Tripo P1 / TRELLIS 2) | Already owned | Static mesh, fused clothes, baked look | None | Low | Props, glasses, **likeness head for Mesh-to-MetaHuman** |
| Hunyuan3D / TRELLIS / Tripo / Meshy / Rodin direct | Free-paid | Body-only auto-rig at best | No usable face rig | Medium | Props / extras only |
| Avaturn | No free tier found (PRO ~US$800/mo per aggregators) | Medium (photo avatar) | ARKit-52 + visemes | Low | Not worth paying for |
| Ready Player Me | Shut down 31 Jan 2026 (Netflix) | n/a | n/a | n/a | Dead |
| Daz3D Genesis 9 | Base free; **Interactive licence** per asset for real-time use | Medium-high | Morphs, not ARKit-named | High (licences, bridge) | Avoid |
| VRoid | Free | Anime | Yes | Low | Wrong style |
| AccuRIG / Mixamo (rig only) | Free | Body rig only | None | Low | Fallback body rig for AI meshes |

## Recommended pipeline

Two tracks that share **one** three.js contract: GLB with a humanoid skeleton (Mixamo/UE-style names),
morph targets named with the **52 ARKit names** (`jawOpen`, `eyeBlinkLeft`, ...) plus optional
Oculus visemes, meshopt-compressed geometry, KTX2 textures. Face/body animation code written against
that contract works for either character, so Track A is never throwaway.

**Track A: MPFB2 Ivan now (Claude, headless; roughly 1-2 days)**
1. *User (Windows, 5 min):* download `makehuman_system_assets` and `faceunits01` (+ `visemes02`) zip
   packs from <https://static.makehumancommunity.org/asset_packs/> and drop them in the repo or server
   (the server proxy blocks that domain; GitHub and PyPI work).
2. *Claude:* install MPFB 2.0.18 as an extension for `bpy` 5.2, script per `script_samples/` 01-10:
   `HumanService.create_human()`, macro targets (male, ~30, thin, slightly tall), skin `GAMEENGINE`
   type, eyes/brows/lashes/teeth/tongue, `add_builtin_rig(basemesh, "game_engine")` (53 bones) or
   `"mixamo"` (52 bones), `FaceService.load_targets(..., load_meta_visemes=True, load_arkit_faceunits=True)`.
3. *Claude:* clothes: MakeHuman stock sweater/shirt/trousers are weak; better: model knit sweater +
   collar + pleated trousers as simple meshes in Blender script and transfer weights from body
   (Data Transfer modifier), or use Magnific GLB clothing as shape reference only. Glasses: rigid prop
   parented to `head` bone (Magnific "Tripo P1" low-poly or hand-built torus frames).
4. *Claude:* hair: MPFB hair editor / Blender hair curves -> Bystedt "Hair cards from curves" GN
   setup -> cards with alpha texture; or keep a MakeHuman short-hair proxy for v1.
5. *Claude:* export glTF (`export_morph=True`, `export_morph_normal=False` to save size), then
   `gltf-transform` (`resize`, `meshopt`, `ktx --uastc` for normal/skin, `etc1s` for others).
6. *User:* body mocap: Rokoko Vision free (30 s/month video->FBX) or Mixamo library; face: iPhone
   Live Link Face CSV or plain webcam video. *Claude:* retarget FBX to rig in Blender; convert CSV /
   MediaPipe blendshape scores to glTF morph-weight tracks (names already match ARKit).

**Track B: MetaHuman hero upgrade (user on Windows + Claude; roughly 1 week, riskier)**
1. *User:* check laptop: UE 5.6+ needs a discrete DX12 GPU (8 GB+ VRAM recommended), ~100 GB disk
   *(Epic sys-reqs, unverified for this laptop)*. Install Epic Games Launcher -> UE 5.7 (MetaHuman
   Creator is built in since 5.6; autorig/texture synthesis use Epic cloud, so be online).
2. *User + Magnific:* generate Ivan's **head** in Magnific 3D (Tripo v3.1, up to 4 views from our
   turnaround art, neutral face, no glasses, hair as short as possible) -> GLB.
3. *User:* MetaHuman Creator -> **From Custom Mesh** (Epic says it targets "AI-generated meshes"),
   conform, then refine in Creator: thin body preset, age ~30, skin tone, short side-part groom.
4. *User:* export: (a) **DCC Export** zip (head/body `.dna` + textures), (b) Geometry/FBX export of
   head + body skeletal meshes at a mid LOD (LOD1-LOD3) with morph targets, (c) the groom's **card
   LOD** static meshes + textures as FBX. Upload to repo `blender/source/`.
5. *Claude (headless):* load DNA with Poly Hammer **Character DNA** (free base edition, GPLv3,
   bundles OpenRigLogic, supports Blender 5.2) and drive the face-board controls with MetaHuman's
   ARKit->control mapping to **bake 52 ARKit shape keys** on a chosen LOD; delete face joints;
   keep ~70 body bones; join hair cards; same export/optimise as Track A step 5.
   Risk: Character DNA has never been tested headless by us; fallback is to do the bake in UE
   (Pose Asset `mh_arkit_mapping_pose`, unverified asset name) or a paid ARKit-conversion plugin.
6. Clothing: MetaHuman wardrobe is limited; plan to model sweater/trousers in Blender as in Track A.

Decision point: if step B1 fails (laptop GPU too weak) stay on Track A and invest in its skin/hair.

## Per-option notes

### 1. MetaHuman
- **Licence:** since MetaHuman 5.6 (June 2025) MetaHumans "can be used with any engine or creative
  software", free under the standard UE licence for < US$1M revenue; above that a UE seat licence is
  reportedly needed for rendering outside UE *(EULA wording seen second-hand only)*.
  [metahuman.com/license](https://www.metahuman.com/en-US/license) ·
  [CG Channel, 2025-06-04](https://www.cgchannel.com/2025/06/you-can-now-sell-metahumans-or-use-them-in-unity-or-godot/) ·
  [Renderu](https://renderu.com/en/news/post/26778)
- **Install:** Creator, Mesh to MetaHuman and Animator are inside UE 5.6+ (no web app). Cloud services
  still required for autorig/texture synthesis. 5.7 adds Houdini/Maya groom tools, nothing Blender.
  [MetaHuman 5.7 release](https://www.metahuman.com/releases/metahuman-5-7-is-now-available)
- **Likeness from AI mesh:** "From Custom Mesh" is aimed at "custom sculpts, 3D scans, AI-generated
  meshes"; best with human-like A-pose meshes. Since 5.6 you build an Identity then "Conform".
  [Epic: From custom mesh](https://dev.epicgames.com/documentation/metahuman/metahuman-creator-from-custom-mesh-tool-in-unreal-engine) ·
  [Epic: From mesh](https://dev.epicgames.com/documentation/metahuman/from-mesh)
- **Export:** Export tool has DCC Export (`.dna` + `.png` + `.json` zip), Geometry Export (skeletal
  meshes), DNA Export, Materials Export. No official Blender target; groom card meshes are exported
  from UE as FBX by hand.
  [Epic: export tool](https://dev.epicgames.com/documentation/metahuman/metahuman-creator-export-tool-in-unreal-engine) ·
  [UE forum: DCC to Blender/FBX](https://forums.unrealengine.com/t/metahuman-dcc-blender-or-fbx-export/2544434)
- **Blender:** Poly Hammer Character DNA base edition free since July 2026 (GPLv3, OpenRigLogic MIT,
  0.10.3 adds Blender 5.2); Pro US$79 adds shape-key editor, LOD calibration etc. Exports back to DNA,
  **not** glTF, so the ARKit bake + glTF export is our script.
  [Poly Hammer blog](https://www.polyhammer.com/blog/free-character-dna-addon-openriglogic) ·
  [CG Channel 2026-07](https://www.cgchannel.com/2026/07/the-character-dna-metahuman-add-on-for-blender-is-now-free/) ·
  [Rigify control rig (DP 2026-05)](https://digitalproduction.com/2026/05/12/poly-hammer-brings-metahumans-to-blender-rigify/)
- **Face:** native control set is ~251 `CTRL_expressions_*` curves driving hundreds of face joints +
  correctives (RigLogic). three.js cannot run RigLogic, so bake to ARKit-52 morphs. Paid shortcut:
  Fab plugin converting the face rig to ARKit-52 morphs (UE 5.7+).
  [Fab listing](https://www.fab.com/listings/d8372d7b-ac3a-443a-88a4-10f48307e2ed)
- **Hair:** grooms are strands; card and mesh LODs exist for real-time. Some third-party grooms ship
  strands only. Use stock MetaHuman grooms (they include cards) or UE Hair Card Generator.
  [Epic LODs](https://dev.epicgames.com/documentation/metahuman/controlling-metahuman-levels-of-detail-lods-in-unreal-engine) ·
  [Hair Card Generator](https://dev.epicgames.com/documentation/unreal-engine/creating-hair-cards-and-lods-using-hair-card-generator)
- **three.js practicalities** (our assessment): three.js stores bones in a texture, so no hard bone
  cap, but each extra face joint costs CPU per frame; drop face joints after baking. Morph targets
  use a data texture (no 8-target limit on WebGL2); 52 morphs on a ~10-20k-vertex head is fine, LOD0
  heads + 8K textures are not. Budget: < 30 MB GLB for the hero after meshopt + KTX2, 2K textures
  (4K only for face albedo/normal). No verified public MetaHuman-to-three.js file sizes found.

### 2. MPFB2 (verified from repo, v2.0.18, 2026-10-04)
- **Headless:** yes. Repo ships `test/execute_tests_headless.bash` (`blender -b ... -P`) and
  `script_samples/01..10` (create human, targets, rigs, Rigify, skin, assets, full FBX export) using
  `HumanService`, `AssetService`, `FaceService`, `ExportService`. Code has explicit Blender 5.1/5.2
  branches. Pip `bpy` (vs the Blender binary) untested by upstream: extension import path needs care.
  [github.com/makehumancommunity/mpfb2](https://github.com/makehumancommunity/mpfb2)
- **Rigs bundled:** `default` (163 bones, incl. face), `game_engine` (53), `mixamo` (52),
  `mixamo_unity`, `cmu_mb`, `openpose`, Rigify `human` metarig.
- **Face:** `FaceService.load_targets()` loads visemes01 (22 Microsoft), visemes02 (15 Oculus,
  `viseme_sil` etc.) and faceunits01 (**52 ARKit**, `jawOpen`...), at zero weight: exactly the three.js
  contract. Expression stack/library tools added in 2.0.16. Needs the `faceunits01` asset pack.
  [Release 2.0.16](https://static.makehumancommunity.org/mpfb/releases/release_2016.html) ·
  [Release 2.0.15](https://static.makehumancommunity.org/mpfb/releases/release_2015.html)
- **Licence:** code GPLv3; assets **CC0** (`LICENSE.ASSETS.md`), so generated characters are free to ship.
- **Quality:** skins from system assets (texture-based, `GAMEENGINE`/enhanced/procedural skin node
  trees), procedural eyes; topology ~13k-vert base mesh *(approx.)*. Looks clearly "MakeHuman" next to
  MetaHuman: weaker pores/micro-normal, simpler eyes, poly-strip hair proxies, dated clothes. Gap is
  closable partly with our own skin maps (detail normal, roughness) and three.js skin shading.
- **Proof it works in three.js:** a TalkingHead user exported an MPFB character to GLB and used it
  after renaming bones and adding eye bones.
  [mpfb2 #302](https://github.com/makehumancommunity/mpfb2/issues/302) ·
  [TalkingHead](https://github.com/met4citizen/TalkingHead)

### 3. Character Creator 4/5 trial
CC5 released Aug 2025 (CC4 still sold). Trial: 30 days, FBX/OBJ/USD export capped at 30, watermarked
720p video. Moderators: in trial only "Free Resources" content or your own models export; **Headshot
heads cannot be exported**; commercial-use grants apply to licensed content, not trial output.
Verdict: fine to evaluate, not to ship Ivan.
[Reallusion download/compare](https://reallusion.com/character-creator/download.html) ·
[Trial export thread](https://forum.reallusion.com/PrintTopic545558.aspx) ·
[CC5 release notes](https://discussions.reallusion.com/t/cc5-05-cc4-65-release-note-support-zbrush-2026-1-1-daz-g9-subscription-license-and-31-fixes/16291)

### 4. Magnific 3D generator (formerly Freepik)
Engines: **Tripo v3.1** (top quality), **Tripo P1** (lightweight low-poly, 48-20k faces per Tripo),
**TRELLIS 2** (single image, PBR). Up to 4 reference views; texture Textureless/Standard/Detailed;
face limit up to 1M; output **GLB only**; no rigging, no face shapes in Magnific's UI *(from docs
snippets)*. Expect triangulated, fused-clothing meshes with lighting baked into albedo.
Best roles: (1) props/set dressing; (2) Ivan head as input to Mesh-to-MetaHuman; (3) glasses frames;
(4) a 3D likeness reference for sculpting MPFB targets.
[Magnific 3D Generator docs](https://www.magnific.com/ai/docs/3d-generator) ·
[Tripo P1 (dev page)](https://developers.tripo3d.com/en/models/p1)

### 5. Other image-to-3D
- **Tripo** (direct): humanoid auto-rig + 100+ mocap clips; no verified facial blendshapes.
  [Styly guide](https://styly.cc/tips/how-to-automatically-rig-3d-models-with-the-3d-generation-ai-tripo/)
- **TRELLIS.2** (Microsoft, Dec 2025): open, MIT, 4B params, PBR GLB; NVIDIA deps non-commercial. No rig.
  [CGWorld](https://cgworld.jp/flashnews/01-202601-TRELLIS2.html)
- **Hunyuan3D**: 3.x hosted-only per a 2026 timeline; last open weights 2.1 (Jun 2025), Tencent
  community licence excludes EU/UK/KR *(verify)*.
  [Cinevva timeline](https://app.cinevva.com/guides/ai-3d-model-generation-timeline-2026)
- **Meshy / Rodin**: body auto-rig add-ons only; no face rig found. **UniRig** (open, MIT code)
  predicts skeleton + skinning for arbitrary meshes. [UniRig](https://huggingface.co/VAST-AI/UniRig)
- Verdict: none gives a hero face. OK for background extras rigged via AccuRIG/Mixamo.

### 6. Avatar platforms
- **Ready Player Me:** acquired by Netflix (Dec 2025); public services off 31 Jan 2026.
  [PocketGamer.biz](https://www.pocketgamer.biz/netflix-acquires-avatar-creation-platform-ready-player-me)
- **Avaturn:** ARKit + visemes + humanoid rig GLB, but no free tier confirmed (aggregators: none as
  of Aug 2026). [CostBench](https://costbench.com/software/ai-3d-generation/avaturn/free-plan/)
- **Daz G9:** real-time/game distribution needs per-product Interactive Licences; web GLB counts as
  distributing the mesh. [Daz licences](https://forum.daz3d.com/daz-licenses)
- **VRoid:** anime only. Skip.

### 7. Rigging and capture
- **Mixamo:** still free with Adobe ID mid-2026 but in maintenance mode (multi-day outage June 2025).
  Use its clip library; don't depend on it. [Cinevva 2026](https://app.cinevva.com/guides/free-character-animations-rigging)
- **AccuRIG (Reallusion):** free, FBX/USD export, staff say personal + commercial use is OK for your own
  characters; needs free ActorCore account. [CG Channel](https://www.cgchannel.com/2023/10/rig-and-showcase-3d-characters-for-free-with-accurig-1-3) ·
  [EULA thread](https://discussions.reallusion.com/t/question-about-accurig-2s-eula/15034)
- **Rokoko:** Starter free forever: FBX export, Vision video mocap 30 s/month; Rokoko Create
  (text-to-anim) 5 free FBX/month. [Pricing](https://rokoko.com/pricing/) ·
  [CG Channel 2026-04](https://www.cgchannel.com/2026/04/rokoko-create-generates-full-body-animations-for-free/)
- **Move.ai:** free tier unclear in 2026 (older: ~50 s video total). *(unverified)*
- **Face capture:** iPhone **Live Link Face** records CSV of ARKit curves (free app); Face Cap /
  iFacialMocap similar. three.js's own `webgl_morphtargets_face` example uses a Face Cap ARKit head.
  No iPhone? **MediaPipe Face Landmarker** outputs 52 ARKit-named blendshape scores per frame from
  ordinary video (VIDEO mode, runs offline in Python on the server). Claude converts either to glTF
  morph-weight animation (or a JSON track applied at runtime).
  [MediaPipe Face Landmarker](https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker) ·
  [LLF CSV Blender add-on](https://nickfisher.gumroad.com/l/tvzndw) ·
  [three.js face example](https://threejs.org/examples/#webgl_morphtargets_face)

### 8. Hair for three.js
- **Authoring (free):** Blender hair curves -> Daniel Bystedt's free "Hair cards from curves" Geometry
  Nodes (pay-what-you-want, $0 OK; built for 3.6+, check on 5.2). Alternatives: Simple Hair Cards
  (Superhive, tested on 5.2 LTS), paid "Hair Tool". MetaHuman grooms ship card LODs.
  [CG Channel](https://www.cgchannel.com/?p=156171) · [80.lv](https://80.lv/articles/free-hair-cards-from-curves-setup-for-blender) ·
  [Simple Hair Cards](https://superhivemarket.com/products/simple-hair-cards)
- **Rendering:** for short side-parted hair, cards with `alphaHash: true` (no sorting, grain cleaned
  by TAA/MSAA) or `alphaToCoverage` with MSAA; opaque inner "scalp cap" layer with hair-colored albedo;
  `MeshPhysicalMaterial.anisotropy` + `anisotropyMap` (flow along card V) for the Kajiya-Kay-like
  highlight; `sheen` for fuzz. Avoid alpha blending except a thin outer layer sorted manually.
  [three.js alpha hash/A2C thread](https://discourse.threejs.org/t/alpha-test-vs-alpha-hash/44493)
- **Skin:** `MeshPhysicalMaterial` has no true SSS; options are `MeshSSSNodeMaterial` (WebGPU/TSL,
  experimental) or the `SubsurfaceScatteringShader` addon, plus a custom screen-space blur.
  [MeshSSSNodeMaterial](https://threejs.org/docs/pages/MeshSSSNodeMaterial.html) ·
  [SSSS thread](https://discourse.threejs.org/t/skin-shading-with-screen-space-sub-surface-scattering/83939)

### Examples and tooling
- No public three.js short with MetaHuman-grade realistic characters was found. Closest: stylised
  shorts (Quantales R3F film, shot-list + GSAP timeline approach worth copying).
  [three.js forum](https://discourse.threejs.org/t/interactive-3d-animated-short-film-built-with-three-js-r3f/92270)
- **Optimisation:** `@gltf-transform/cli` (meshopt for skinned/morph meshes, not Draco; `ktx` UASTC
  for normals/face, ETC1S for the rest; `resize`), `gltfpack` (meshoptimizer), three.js
  `MeshoptDecoder` + `KTX2Loader`. npm and PyPI are reachable from the server.
  [glTF-Transform](https://github.com/donmccurdy/glTF-Transform) ·
  [meshoptimizer](https://github.com/zeux/meshoptimizer) ·
  [community skill: asset-pipeline-3d](https://skills.sh/anthemflynn/ccmp/asset-pipeline-3d)
- Useful repos: MPFB `script_samples/`, TalkingHead (ARKit/viseme GLB conventions, Mixamo clips),
  Character DNA (Poly Hammer), UniRig. No official Claude Code skill for this pipeline exists.
