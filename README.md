# Life on Claude Nine

An animated short about Ivan, who discovers at 3 AM that he can automate his life. The film plays and renders in a three.js engine; Blender bakes the light and builds the set. The **Studio** runs all of it from your browser.

## Start here (one click)

1. Clone the repository (or download it from GitHub as a ZIP and unzip it).
2. Double-click the launcher for your system:

| System | Double-click | Or in a terminal |
|---|---|---|
| macOS | `Start Studio.command` | `npm run studio` |
| Windows | `Start Studio.bat` | `npm run studio` |
| Linux | `start-studio.sh` | `./start-studio.sh` |

The first launch:
- installs what is missing: Node.js (with Homebrew on a Mac, winget on Windows), the npm packages, the Chromium that renders frames (about 150 MB), and ffmpeg;
- opens **http://localhost:8080** in your browser.

Later launches skip straight to the Studio. Stop it with Ctrl+C in its terminal window.

> On a Mac, if the first double-click is blocked ("unidentified developer"), right-click the file → **Open** once.
> On a Mac, Node.js is installed only if Homebrew is present; otherwise the launcher opens nodejs.org for you.

## The Studio

| Page | What you do there |
|---|---|
| **Scenes** | Every scene of the film, with its stage (idea, storyboard, draft, final), length, shots and open notes. **+ New scene** creates the engine module and the scene folder. |
| **Scene → Player** | Watch the scene in the engine with the full look. Use the shot timeline (click or drag to scrub), go frame by frame, step shot to shot, read each shot's lens and intent beside the picture, and **leave notes at the exact moment** ("his hand goes through his cheek here"). |
| **Scene → Board** | The storyboard: one engine frame per shot with timing, lens, voiceover line and intent. **Render board stills** refreshes it. |
| **Scene → Notes** | Your notes for the scene, kept in `scenes/<scene>/NOTES.md`. Claude reads that file and ticks off what it fixed. |
| **Scene → Render & export** | Render the film (preview to 4K, whole scene or one shot, final or draft) with the full look. You get a silent MP4 and, when the scene has a voiceover, a second MP4 with it. Takes resume where they stopped; MP4s can go straight to `deliver/`. |
| **Scene → Storyboard** | The scene's written storyboard. |
| **Renders & jobs** | The queue (one job at a time), progress with time left, the live log, stop buttons, and the lighting bakes (needs Blender). |
| **Claude activity** | Follow Claude's work. When Claude works in the cloud, the Studio fetches its branch every minute, shows the commits that arrived, and pulls them with one click or automatically; the player reloads by itself. When Claude Code runs on your machine, every file it changes appears in the live feed and the player reloads. |
| **Files** | Browse everything the film is made of (scenes, engine, assets, Blender scripts, docs, renders, deliveries), with previews of images, video, audio, Markdown and code, and **Show in folder** buttons. |
| **System** | What was found on this machine (Node, Chromium, ffmpeg, git, Blender) and the settings: GPU rendering, live reload, Blender path. |

Renders on your machine use its GPU. A 1080p frame takes about a second there, against about 11 s on the cloud's CPU.

## Working with Claude on this project

- **In the cloud (claude.ai/code):**
  - Claude pushes to the project branch (`project.json` → `branch`).
  - Turn on **Follow** in *Claude activity* to watch the work arrive.
- **On your machine:**
  - Run `claude` in this folder.
  - It reads `CLAUDE.md` (the project map and its rules) and the scenes' `NOTES.md` files.
  - Keep the Studio open beside it to watch every change land.

## Where things are

```
project.json              the film: scenes, order, stage, voiceover, branch
scenes/<nn-name>/         per scene: STORYBOARD.md, NOTES.md, README.md
engine/                   the three.js engine (index.html, src/, assets/, scenes/<id>/scene.js)
blender/                  set, lighting presets, lightmap bakes, character acting (Python, headless)
tools/                    capture, render_mp4, board, render_loop, texture and look tools
studio/                   the Studio (server.mjs, ui/, setup.mjs); studio/.local/ is per machine
docs/                     how it is made: WORKFLOW.md (master), PIPELINE_DECISION.md, playbook, bibles
deliver/                  finished films and sheets
renders/                  frames and takes (not in git)
```

Deeper documents:
- `docs/WORKFLOW.md`: the whole pipeline, its locked settings and the lessons learned.
- `docs/PIPELINE_DECISION.md`: Blender + three.js against three.js alone.
- `engine/README.md`: the engine on its own.
