# Moving Life on Claude Nine to a new machine (Mac mini)

Two parts:
- **GitHub** holds all the code, scenes, models, light and docs.
- **The transfer pack** (`Mac_transfer.zip`, made on the Windows PC) holds the files git does not carry.

Nothing else is needed; everything left out is listed at the end.

## 1. Install the tools (once)
```
xcode-select --install
brew install node ffmpeg gh
```
- Node 22 LTS is fine.
- Blender 5.2 (from blender.org) goes in `/Applications`. It's only needed to rebuild the set, the light or Ivan's model.

## 2. Make the workspace and clone
The film expects this layout. The studio files sit two folders above the repo.
```
~/CLAUDE/
  CLAUDE.md, context-library/, skills-packages/, yt-reference-frames/      <- from the pack (step 4)
  Life on Claude 9/
    Ivan-3dScenes/                                                         <- the git repo
```
```
gh auth login
mkdir -p ~/CLAUDE/"Life on Claude 9"
cd ~/CLAUDE/"Life on Claude 9"
git clone -b claude/wonderful-franklin-gzawe0 https://github.com/ShirokoKun/Life-on-Claude-9 Ivan-3dScenes
cd Ivan-3dScenes
npm install
npx playwright install chromium
```
The Chapter 1 work is on the branch `claude/wonderful-franklin-gzawe0`, not `main`.

## 3. Unzip the transfer pack
Copy `Mac_transfer.zip` to the Mac (AirDrop, USB or a drive) and unzip it anywhere, for example `~/Downloads/Mac_transfer/`. It holds:

| Folder in the pack | What it is | Where it goes |
|---|---|---|
| `fonts/` | The fonts the film's screens draw with on Windows: Segoe UI, Consolas, Segoe Print, Comic Sans MS. Without them a Mac draws the screen text in other fonts. | Select all, double-click, **Install** in Font Book |
| `into-repo/` | The Ch 1 sound stems, buses and mixes (135 MB) and the Poly Haven props for Blender (69 MB) | Merge into the repo: `cp -R ~/Downloads/Mac_transfer/into-repo/ ~/CLAUDE/"Life on Claude 9"/Ivan-3dScenes/` |
| `into-workspace/` | The studio's `CLAUDE.md`, `context-library/` (taste and workflows), `skills-packages/`, `yt-reference-frames/` | `cp -R ~/Downloads/Mac_transfer/into-workspace/ ~/CLAUDE/` |
| `claude-memory/` | Claude's notes on this project: state, your taste, the workflow rules | step 4 |
| `reference-frames/` | Three frames rendered on the PC, for a side-by-side check on the Mac | step 5 |
| `films/` | The latest review renders (if present) | wherever you like |

The fonts are Microsoft's. They are for your own machine only; never put them on GitHub.

## 4. Give Claude its notes back
Open Claude Code in `~/CLAUDE/Life on Claude 9` once, then quit it. That creates the project's folder under `~/.claude/projects/`. Then:
```
D=$(ls -d ~/.claude/projects/*Life-on-Claude-9 | head -1); mkdir -p "$D/memory"; cp ~/Downloads/Mac_transfer/claude-memory/*.md "$D/memory/"
```
Or just tell Claude: "install the memory from ~/Downloads/Mac_transfer/claude-memory". The repo's `CLAUDE.md` tells it how.

## 5. Check
```
cd ~/CLAUDE/"Life on Claude 9"/Ivan-3dScenes
node tools/setup_check.mjs
```
Every line should say `ok`; each `MISSING` line says which pack folder fixes it. Then render one frame:
```
node tools/render_mp4.mjs --scene kf1 --frames 4320-4320 --take maccheck
```
Compare `renders/kf1/maccheck/frames_1920x1080/f_04320.png` with `reference-frames/f4320_1080.png`. Expect the same picture, with only tiny differences: the Mac's GPU (Metal) and font smoothing differ slightly from Windows' Direct3D.

## 6. Work
- Preview in a browser: `npm run serve -- 8791`, then http://localhost:8791/index.html?scene=kf1
- The Studio: `npm run studio`
- The full film at 1080p: `node tools/render_mp4.mjs --scene kf1 --take <name>`
- Where the work stands: `scenes/ch1-keyframes/RESUME_HERE.md`

## Not in git and not in the pack (made again anywhere)
- **`renders/`** (15 GB of frames and MP4s): `tools/render_mp4.mjs` makes them again.
- **`node_modules/` and Chromium:** `npm install` and `npx playwright install chromium`.
- **Bake intermediates** (`lightmaps/*_full.exr`, `*_live.exr`): a rebake in Blender writes them. The engine only loads the merged `lm_*.exr`, which are in git.
- **Old deliveries** (`deliver/*.mp4`): renders.
- **Other projects in `D:\CLAUDE`** (`FLow mcp`, `visionflow-app`, `Design System IDK`) and `yt-reference-frames.zip` (the same frames as the folder): not part of this film.
