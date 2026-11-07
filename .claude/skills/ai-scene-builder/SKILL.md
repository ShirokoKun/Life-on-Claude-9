---
name: ai-scene-builder
description: "Build or refine editable Blender scenes through blockout, assets, lighting, previews, and optional animation or Unreal export. Use for guided AI-assisted 3D scene creation."
---

# AI Scene Builder

Build a scene in reviewable stages, preserving the user's approved composition and look. Support a custom scene or the included nostalgic bedroom example.

## Start with the requested outcome

- For a new scene, establish its subject, visual target, and still-versus-animation deliverable. Ask only for consequential missing details; use reasonable defaults for reversible choices.
- For an existing scene, inspect it first and modify a versioned copy. Keep unrelated materials, cameras, animation, and lighting unchanged.
- Verify actual Blender/tool access. Without access, provide a runnable script and explain what the user must run. Never describe unexecuted work as built, rendered, or inspected.
- On first use, read the setup section in `references/installation.md`. Locate the Blender executable, run its version check, and identify a writable project folder. Blender's bundled Python runs the helpers; neither a separate Python installation nor a Blender MCP server is required when local shell execution is available. Avoid opening or modifying an unrelated active scene.
- First milestone by default: a blockout, one wide camera, and one low-resolution still. Do not automatically add animation, a tornado, night variants, or Unreal export.

## Work in stages

1. Establish scale, silhouette, camera framing, and object placement before detailed assets.
2. Test one representative imported/generated asset before generating a batch. Check scale, material maps, normals, and scene fit. Paid services require an agreed budget.
3. Develop materials and motivated lighting with a fixed exposure. Correct an overlit object at the light source or with a flag before darkening the whole scene.
4. Render a small still and inspect the actual image for contact, clipping, missing textures, excessive haze, noise, and framing. Describe visible limitations honestly.
5. Add motion only when requested. Validate start, middle, and end, plus collisions and transitions. Preserve frame rate and timing across exports.
6. Benchmark representative frames before a long render. Report measured time, settings, and an estimate range. Use resumable image sequences and respect the user's GPU allocation.
7. Deliver the editable scene and clearly identify the current version. Verify external dependencies, not just whether a file was saved.

Use review checkpoints for consequential creative decisions; do not repeatedly ask permission for routine work already authorized.

## Read only the relevant guides

- [Bedroom example](references/bedroom.md): self-contained scene brief and included visual reference.
- [Scene construction](references/construction.md): layout, assets, materials, and lighting.
- [Animation and effects](references/motion.md): cameras, levitation, vortex, and liquid-glass finishing.
- [Rendering and delivery](references/delivery.md): previews, denoising, dependencies, and optional Unreal export.
- [Installation and usage](references/installation.md): Codex, Claude, and helper commands.

## Blender helpers

- `scripts/create_blockout.py` creates a simple bedroom layout in a new file. It is a starting scaffold, not the furnished final scene. Run only in a fresh background Blender process with `--factory-startup`. It refuses to overwrite an existing output.
- `scripts/audit_scene.py` inspects the loaded scene and writes a JSON report without saving changes to the Blender file. Use it to identify missing image dependencies and render settings; it does not replace visual review.

Read each helper's arguments before running it. Resolve all resource paths relative to this skill folder, not the user's working directory. Use Blender's `--python-exit-code 1` before `--python` so script errors propagate to the launcher. Resolve paths for the current machine; no fixed GPU index or workstation paths are required. The skill does not install Blender or provide an app-control connection.
