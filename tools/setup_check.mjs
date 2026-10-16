// New machine? Run this first: node tools/setup_check.mjs
// It checks everything the film needs that git does not carry (fonts, audio stems, Blender props, Claude's notes, the
// studio workspace) plus the tools (Node, Playwright's Chromium, ffmpeg, Blender), and says where each missing piece
// lives in the transfer pack (MAC_TRANSFER_GUIDE.md). Exit code 1 when something required is missing.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WS = path.resolve(ROOT, '..', '..');               // the studio workspace: <ws>/Life on Claude 9/Ivan-3dScenes
const HOME = os.homedir(), MAC = process.platform === 'darwin';
const rows = []; let bad = 0;
const check = (need, name, ok, fix) => { rows.push([ok ? 'ok     ' : need ? 'MISSING' : 'missing', name, ok ? '' : fix]); if (!ok && need) bad++; };
const has = (p) => fs.existsSync(p);
const full = (p) => has(p) && fs.readdirSync(p).length > 0;
const runs = (cmd, args) => spawnSync(cmd, args, { stdio: 'ignore', shell: process.platform === 'win32' && !/[\\/]/.test(cmd) }).status === 0;

// ---- tools
check(true, `Node 18+ (have ${process.version})`, +process.versions.node.split('.')[0] >= 18, 'install Node 22 LTS (nodejs.org or `brew install node`)');
check(true, 'npm packages (playwright)', has(path.join(ROOT, 'node_modules', 'playwright')), 'run `npm install` in the repo');
let chromium = false;
try { const { chromium: c } = await import('playwright'); chromium = has(c.executablePath()); } catch { /* no playwright yet */ }
check(true, "Playwright's Chromium", chromium, 'run `npx playwright install chromium`');
check(true, 'ffmpeg', runs('ffmpeg', ['-version']) || has(path.join(ROOT, 'node_modules', 'ffmpeg-static')), '`brew install ffmpeg` (or `npm install ffmpeg-static`)');
const BF = 'C:\\Program Files\\Blender Foundation';
const blenders = [process.env.BLENDER, 'blender', '/Applications/Blender.app/Contents/MacOS/Blender',
  ...(has(BF) ? fs.readdirSync(BF).map((n) => path.join(BF, n, 'blender.exe')) : [])].filter(Boolean);
check(false, 'Blender 5.2 (only to rebuild the set, light or Ivan)', blenders.some((b) => runs(b, ['--version'])), 'blender.org, version 5.2, into /Applications');

// ---- the repo
const branch = spawnSync('git', ['branch', '--show-current'], { cwd: ROOT, encoding: 'utf8' }).stdout?.trim();
// a duplicated scene's branch (scene/<id>, made by the Studio) carries the Ch 1 work too: any branch that contains it is fine
const hasCh1 = spawnSync('git', ['merge-base', '--is-ancestor', 'bc0a77c', 'HEAD'], { cwd: ROOT }).status === 0;
check(true, `git branch with the Ch 1 work (on ${branch || '?'})`, branch === 'claude/wonderful-franklin-gzawe0' || hasCh1, '`git checkout claude/wonderful-franklin-gzawe0` (the Ch 1 work is on this branch, not main)');
check(true, "Ivan's eye models (ivan_eyes.glb)", has(path.join(ROOT, 'engine/scenes/s03/ivan_eyes.glb')) && has(path.join(ROOT, 'engine/scenes/s04/ivan_eyes.glb')), '`git pull`: they are in git');

// ---- the transfer pack
const SD = 'audio/Ch01_VO_SoundPackage/03_SOUND_DESIGN';
check(false, 'Ch 1 sound stems, buses, mixes (sound work only; the film\'s mix is in git)', ['stems', 'buses', 'mixes'].every((d) => full(path.join(ROOT, SD, d))), `pack: into-repo/${SD}/  ->  repo/${SD}/`);
check(false, 'Poly Haven props (Blender set rebuilds only)', full(path.join(ROOT, 'blender/assets/props')), 'pack: into-repo/blender/assets/props/  ->  repo/blender/assets/props/  (or `node tools/polyhaven.mjs <id>`)');
// the screens' text: Windows draws Segoe UI, Consolas, Segoe Print, Comic Sans MS; a Mac must have the same files or the text changes
const FONTS = { 'Segoe UI': ['segoeui.ttf', 'seguisb.ttf', 'segoeuib.ttf'], Consolas: ['consola.ttf', 'consolab.ttf'], 'Segoe Print': ['segoepr.ttf', 'segoeprb.ttf'], 'Comic Sans MS': ['comic.ttf', 'comicbd.ttf'] };
const fontDirs = MAC ? [path.join(HOME, 'Library/Fonts'), '/Library/Fonts', '/System/Library/Fonts/Supplemental']
  : process.platform === 'win32' ? ['C:\\Windows\\Fonts', path.join(process.env.LOCALAPPDATA || '', 'Microsoft/Windows/Fonts')] : [path.join(HOME, '.local/share/fonts'), '/usr/share/fonts'];
const installed = new Set(fontDirs.filter(has).flatMap((d) => fs.readdirSync(d).map((f) => f.toLowerCase())));
const alias = { 'comic.ttf': 'comic sans ms.ttf', 'comicbd.ttf': 'comic sans ms bold.ttf' };   // the Mac's own Comic Sans files
for (const [fam, files] of Object.entries(FONTS)) {
  const miss = files.filter((f) => !installed.has(f) && !installed.has(alias[f] || '-'));
  check(true, `font ${fam}`, !miss.length, `pack: fonts/ (${miss.join(', ')}): double-click each, Install in Font Book`);
}

// ---- Claude's context
const mem = has(path.join(HOME, '.claude/projects')) && fs.readdirSync(path.join(HOME, '.claude/projects'))
  .some((d) => has(path.join(HOME, '.claude/projects', d, 'memory', 'ch1-keyframes-state.md')));
check(true, "Claude's project notes (memory)", mem, 'pack: claude-memory/*  ->  ~/.claude/projects/<this folder, slashes as dashes>/memory/  (MAC_TRANSFER_GUIDE.md, step 6)');
check(true, 'studio workspace (CLAUDE.md, context-library)', has(path.join(WS, 'CLAUDE.md')) && has(path.join(WS, 'context-library', 'README.md')), `pack: into-workspace/*  ->  ${WS}/`);

const w = Math.max(...rows.map((r) => r[1].length));
for (const [s, n, fix] of rows) console.log(`${s}  ${n.padEnd(w)}${fix ? '   -> ' + fix : ''}`);
console.log(bad ? `\n${bad} required item(s) missing. The transfer pack and MAC_TRANSFER_GUIDE.md have them.` : '\nEverything the film needs is here. Next: npm run serve -- 8791, then open http://localhost:8791/index.html?scene=kf1');
process.exit(bad ? 1 : 0);
