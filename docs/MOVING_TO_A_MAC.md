# Moving the project to a new Mac

GitHub carries the code, the scenes, the lightmaps, the characters and the scene audio. Some things are not in git;
copy them across yourself (USB drive or cloud folder) if you want them.

## 1. On the Mac: get the project

```bash
git clone https://github.com/ShirokoKun/Life-on-Claude-9 Ivan-3dScenes
cd Ivan-3dScenes
git checkout claude/wonderful-franklin-gzawe0
npm run studio
```

`npm run studio` installs the packages, the Chromium that renders and ffmpeg the first time (`studio/setup.mjs`),
then opens the Studio at http://localhost:8080. Node 18 or newer is needed (https://nodejs.org).

Blender: install Blender into `/Applications`. The Studio already looks for
`/Applications/Blender.app/Contents/MacOS/Blender` (or set `BLENDER=/path/to/blender`).

## 2. Not in git: copy these from the PC if you need them

| What | Where on the PC | Size | Needed? |
|---|---|---|---|
| Ch 1 sound package stems, buses and mixes | `audio/Ch01_VO_SoundPackage/03_SOUND_DESIGN/{stems,buses,mixes}` (from the `Ch01_*.zip` files in Downloads) | ~135 MB | Only to rebuild the mix or cut new scene audio. The scene audio itself is in git |
| Renders and review frames | `renders/` | ~12.9 GB | No; every render can be made again. Copy the takes you want to keep |
| Delivery videos | `deliver/*.mp4` (the newer ones are not in git) | ~290 MB | Only if you want the finished files |
| Poly Haven props | `blender/assets/props/` | ~70 MB | Only for rebuilding the set in Blender; `node tools/polyhaven.mjs <id>` fetches them again |
| Lightmap bake intermediates | `engine/scenes/s03/lighting/*/lightmaps/*_full.exr`, `*_live.exr` | ~300 MB | No; the engine loads only the merged `lm_*.exr` |

Rebuilt by the Mac itself, do not copy: `node_modules/`, `studio/.local/` (the render browser for Windows).

## 3. Outside this repo

- `D:\CLAUDE\context-library\` (taste, workflows, project notes), `D:\CLAUDE\CLAUDE.md`, `D:\CLAUDE\skills-packages\`:
  the studio's long-term memory. Not in any git repo: copy the whole `D:\CLAUDE` folder minus this repo.
- `D:\CLAUDE\Life on Claude 9\.claude\launch.json`: the Studio preview entry for Claude.
- Claude's memory for this project: `C:\Users\swast\.claude\projects\D--CLAUDE-Life-on-Claude-9\memory\`.
  On the Mac the folder name follows the new path (e.g. `~/.claude/projects/-Users-<you>-...-Life-on-Claude-9/memory/`);
  copy the `memory` folder into it after the first Claude session there.
