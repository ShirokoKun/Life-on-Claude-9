# Install and use

This package contains instructions, a bedroom reference, and two Python helpers. It does not contain the finished Blender scene or paid asset-generation credits.

## What you need

- Blender 4.5 LTS is the tested version. Other Blender versions may need adjustments.
- Codex or Claude Code with access to a local project folder and permission to run Blender commands. No specific Blender connector is required for the bundled scripts.
- A working folder with space for your scenes and renders. The starter is small; finished textured scenes can be much larger.
- Optional: your own models or an authorized asset-generation service. Tripo, Unreal, and Fusion are not required for the bedroom blockout.

The skill is a guided creation workflow. It does not generate the finished reference room in one command. For the exact completed room, use the separate Blender scene download.

## Codex
Extract the ZIP, then copy its `ai-scene-builder` folder to `~/.agents/skills/` (personal) or `.agents/skills/` inside your project. Older installations may use `~/.codex/skills/`; this package was initially tested there. Install in only one location to avoid duplicates. Start a new chat or reload the app if it does not appear. Ask: "Use $ai-scene-builder to build a nostalgic bedroom. Start with a blockout and one preview still."

## Claude Code
Copy the same folder into `~/.claude/skills/` for personal use, or `.claude/skills/` inside a project. Invoke `/ai-scene-builder`, or ask Claude to use AI Scene Builder. The `agents/openai.yaml` file is Codex metadata and is not needed by Claude.

## Claude web or desktop chat
Where custom Skills uploads and code execution are enabled, upload the skill ZIP through Customize > Skills. Keep the ZIP intact for uploading. Availability depends on account/workspace settings. The instructions can guide the project, but a hosted chat does not automatically control your local Blender. Use an appropriate local connection or run the supplied scripts yourself. Claude compatibility is based on its documented SKILL.md format; this package has not been execution-tested in Claude.

## Blender helpers
Use Blender 4.5 or a compatible version. Replace BLENDER with the full path to your Blender executable and SKILL with this unpacked folder. Quote paths containing spaces. In PowerShell put `&` before the quoted executable.

Create a new simple layout and optional preview:
```
BLENDER --background --factory-startup --python-exit-code 1 --python SKILL/scripts/create_blockout.py -- --output room-blockout.blend --render room-preview.png
```
The preview is 640x360, 16 Cycles samples, CPU by default. Omit `--render` to save only. This is intentionally basic geometry for layout review.

Inspect an existing scene without saving changes:
```
BLENDER --background room-blockout.blend --python-exit-code 1 --python SKILL/scripts/audit_scene.py -- --output scene-audit.json
```
Both scripts refuse to overwrite their outputs. Choose new output names for subsequent runs. The audit checks image dependencies and lists linked libraries; caches and animated image dependencies still need manual inspection.

## Example requests
- Build my own scene from this reference; start with the layout.
- Keep this scene and camera, but soften daylight on the bed.
- Add a slow doorway camera move after we settle the still.
- Help me build a vortex test with paper, smoke, and a soccer ball.

Agent/tool setup, assets, and artistic decisions affect the result. The sample image is a visual target, not the output of the blockout script.

## First run without writing commands yourself

After installing, send this:

> Use AI Scene Builder. First check that you can find and run my local Blender, and tell me where you will save the project. Build the included bedroom blockout and show one preview still. Use the supplied helper as a starting point. Do not start an animation render or paid asset generation. If Blender is unavailable, explain the exact setup step I need.

Success means a new `.blend` opens in Blender and you can see a basic bed, desk, chair, and TV layout in the preview. It will intentionally look like simple blocks. Next ask the agent to refine the approved layout, then model and texture the props in stages.

## Manual Windows example

In PowerShell, change the two paths below to match your machine. Run from a new working folder. The script uses Blender's Python; do not run it with ordinary `python` or install `bpy` with pip.

```powershell
$blenderExe = 'C:/Program Files/Blender Foundation/Blender 4.5/blender.exe'
$skillDir = Join-Path $env:USERPROFILE '.agents/skills/ai-scene-builder'
& $blenderExe --version
& $blenderExe --background --factory-startup --python-exit-code 1 --python "$skillDir/scripts/create_blockout.py" -- --output "$PWD/room-blockout.blend" --render "$PWD/room-preview.png"
& $blenderExe --background "$PWD/room-blockout.blend" --python-exit-code 1 --python "$skillDir/scripts/audit_scene.py" -- --output "$PWD/scene-audit.json"
```

For Claude Code, change `.agents/skills` to `.claude/skills`. On macOS the executable is usually `/Applications/Blender.app/Contents/MacOS/Blender`; on Linux try `blender --version`. Use the generic commands above with quoted absolute paths to the script and outputs.

## If something does not work

- Skill missing: the folder must contain `SKILL.md` directly, without an extra ZIP-name folder around it. Check the install location and reload.
- Blender not found: point to the actual executable, not a shortcut. Test `--version` first.
- `No module named bpy`: run with Blender, not system Python.
- Output already exists: choose a new filename. The helpers deliberately preserve previous work.
- Can't run local commands: use the manual commands or a locally enabled agent; uploading a skill alone does not grant desktop control.
- A render looks basic: that is the blockout stage. Continue with the construction guide, using the included image as a visual target.

Format documentation: [Codex skills](https://learn.chatgpt.com/docs/build-skills), [Claude Code skills](https://code.claude.com/docs/en/skills), [Claude ZIP uploads](https://support.claude.com/en/articles/12512198-how-to-create-custom-skills).
