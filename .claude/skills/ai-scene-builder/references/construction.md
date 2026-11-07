## 03 / Turn references into a scene plan

Read the references visually. Describe the composition, dominant shapes, scale, perspective, material families, light direction, palette, atmosphere, and focal point. Separate observed details from guesses. If references conflict, show me the conflict and recommend one direction.

When creating a concept, offer up to three materially different directions, then refine the selected one. Prefer an original arrangement with generic, unbranded props. Avoid recognizable commercial logos, copyrighted artwork, or named franchise designs unless I supply appropriate material and specifically request their use. Ask me for assets I have permission to use; do not describe generated output as automatically rights-cleared.

Produce a compact scene brief and one approved hero reference. Identify the must-have objects, optional dressing, camera-visible details, and open space that should remain uncluttered. Explain which details need real geometry, which can use textures, and which will not be visible enough to justify expensive work. Do not add objects merely to make the scene feel busy.

Save the approved reference and a short decision log. Treat approved composition, geometry, materials, lighting, camera, and animation as separate locks. A request to fix a chair or change a texture does not authorize changing the approved lighting or moving the camera.



## 04 / Establish an editable project

Create one clear project root with simple folders: References, Assets, Scenes, Previews, Finals, and Archive. Keep source models and texture maps inside Assets with readable names. Use relative paths or packed resources where practical. Keep one clearly identified current scene and a small set of meaningful checkpoints. Move superseded versions into Archive instead of filling the working folder with near-duplicates.

Maintain a brief project-status file containing the current scene, approved decisions, output settings, source assets, known problems, and next step. Record paid generation usage and render settings. This should let a new chat resume without reading the entire conversation. Keep private logs and account details outside the public handoff.

Work nondestructively. Preserve the last approved scene before structural changes. Keep geometry, materials, lights, cameras, and animation separately editable. Name objects by purpose. Group every multi-part prop under one sensible parent so moving it also moves its labels, lids, cables, laces, and attachments. Do not silently replace a 3D result with a flat image or baked video.



## 05 / Block out the layout before detailing

Set real-world scale, a consistent ground plane, and the agreed output frame rate before animation. Make a simple blockout using basic shapes. Establish the hero camera early and match the reference's composition, perspective, proportions, and negative space.

Check furniture and prop dimensions, floor and wall contact, clearances, access paths, and object orientation. A plausible camera view must not hide obviously broken geometry from nearby angles. Show a hero view and at least one useful inspection view. For interiors, verify wall thickness, window openings, and exterior context where visible.

Get approval for the blockout before spending time on detailed assets. If proportions are wrong, fix them now. Do not use dark lighting, depth of field, haze, or cropping to disguise layout mistakes.



## 06 / Build and qualify the assets

Choose the simplest method that meets the shot's needs. Model precise manufactured shapes, structural geometry, repeating elements, and alignment-critical parts directly in Blender. Use bevels, thickness, clean shading, and sensible topology. Reserve extra geometry and texture resolution for assets that fill the frame.

For organic or irregular props, consider the optional generated-asset branch. Prepare a clear image of one isolated object, with unobstructed shape, consistent perspective, and no unnecessary background. If useful and supported, provide consistent additional views. Do not assume a generated object will preserve hidden surfaces, exact dimensions, text, or branding.

### Optional / Tripo or another asset-generation service

Use the connected service only if available and authorized. Confirm the intended asset, generation method, output format, and credit cost before a paid batch. Generate one representative asset first. Import it into a staging collection, normalize its scale and orientation, and inspect geometry, UVs, material slots, texture resolution, pivots, and hidden surfaces.

Reject fused parts, melted controls, missing openings, floating fragments, baked-in backgrounds, and toy-like surfaces when they fail the target. Repair the useful asset or regenerate from a better reference; do not repeatedly pay for the same unresolved problem. Stop after the agreed retry budget and explain the alternative.

Rebuild precision parts in Blender when needed. Preserve useful generated fabric or irregular surfaces while replacing weak hard-surface pieces. Save the original generated asset separately from the repaired version. A successful download or import is not quality approval.

### Asset review standard

Render a neutral-light closeup from the important angles, then inspect the asset in its intended shot. Check silhouette, believable construction, seams, edge thickness, hardware, fabric weave, surface response, scale, and contact. A solid-mode viewport proves geometry only; it does not validate textures or materials. Prefer fewer convincing props to many weak ones. Show failures honestly and fix the largest visible problem first.



## 07 / Make a deliberate texture and material pass

Use reference-driven PBR materials with plausible base color, roughness, metalness, normal or bump, and displacement only where justified. Set color and data texture handling correctly for the active renderer. Use actual normal maps through an appropriate normal-map node; do not treat RGB normals as grayscale height. Verify normal conventions when exporting between applications.

Match texture scale to the object. Wood grain should follow construction; fabric weave should not look oversized; seams and finish should make sense. Avoid stretching, obvious tiling, blurry hero textures, and baked directional shadows in base color. Review materials under neutral illumination before adjusting the cinematic lighting.

Create wear where contact and use would cause it: touched edges, handles, desktop zones, floor traffic, folds, and exposed corners. Break up roughness as well as color. Mix broad aging, localized scuffs, and subtle microdetail rather than covering everything in uniform noise. Preserve some clean areas. Damage should match the story and reference, not become an excuse for visual clutter.

For wood, separate grain, finish, edge wear, scratches, and dust. For cloth, check weave, folds, seams, thickness, and restrained sheen. For plastic, glass, metal, paper, and paint, use distinct surface behavior. Do not make every material equally shiny or equally rough.

Show a closeup and a full-scene comparison before and after the pass. If I ask for a shareable color texture, provide the base-color image and clarify when the final appearance also depends on layered shaders, roughness, geometry, or lighting. Do not call an intermediate color image the complete final material.



## 08 / Light for a readable cinematic image

Establish motivated light sources: windows, practical lamps, environmental light, or intentional studio lights. Work from direction, size, softness, and contrast before adding more lights. Make the focal point readable while retaining natural falloff and a believable relationship between foreground and background.

Keep highlights controlled and shadow detail intentional. Cinematic does not mean crushed blacks, excessive orange-and-teal grading, blown windows, or heavy fog. Use atmosphere only when it supports depth or visible light beams; it must not hide weak materials. Check glass, reflections, silhouettes, and contact shadows.

Lock exposure and the view transform for comparisons. Keep display transforms consistent between previews and finals. If I request day and night, create distinct, named lighting states sharing the approved geometry. Review matching camera views so the difference is easy to assess.

After approval, preserve light positions, exposure, atmosphere, camera, and color treatment during unrelated asset revisions. Record any necessary exception and show its visual effect.

