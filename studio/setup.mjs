// One-time (and safe to repeat) setup for the Studio: npm packages, the Chromium that renders, ffmpeg, and a
// check for Blender. The start-up scripts run this before every launch; it only does work the first time,
// or after package.json changes.
//   node studio/setup.mjs [--force]
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOCAL = path.join(ROOT, 'studio', '.local');
fs.mkdirSync(LOCAL, { recursive: true });
const STAMP = path.join(LOCAL, 'setup.json');
const win = process.platform === 'win32';
const say = (s) => console.log(`  ${s}`);
const step = (s) => console.log(`\n▸ ${s}`);
const run = (cmd, args) => spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit', shell: win }).status === 0;

const [major] = process.versions.node.split('.').map(Number);
if (major < 18) { console.error(`Node ${process.versions.node} is too old: the Studio needs Node 18 or newer (https://nodejs.org).`); process.exit(1); }

const hash = crypto.createHash('sha1').update(fs.readFileSync(path.join(ROOT, 'package.json'))).digest('hex');
const stamp = fs.existsSync(STAMP) ? JSON.parse(fs.readFileSync(STAMP, 'utf8')) : {};
const force = process.argv.includes('--force');

console.log('\nClaude Nine Studio: setup');
if (force || stamp.packages !== hash || !fs.existsSync(path.join(ROOT, 'node_modules', 'playwright'))) {
  step('Installing packages (playwright, ffmpeg). This takes a minute the first time.');
  if (!run(win ? 'npm.cmd' : 'npm', ['install', '--no-fund', '--no-audit'])) { console.error('npm install failed. Check your internet connection and run the start script again.'); process.exit(1); }
  stamp.packages = hash;
} else say('packages: up to date');

let chromiumOK = false;
try { const { chromium } = await import('playwright'); chromiumOK = fs.existsSync(chromium.executablePath()); } catch { /* not yet */ }
if (!chromiumOK || force) {
  step('Downloading the Chromium that renders frames (about 150 MB, once).');
  if (!run(win ? 'npx.cmd' : 'npx', ['playwright', 'install', 'chromium'])) { console.error('Could not install Chromium. Run: npx playwright install chromium'); process.exit(1); }
} else say('chromium: installed');

let ffmpeg = spawnSync('ffmpeg', ['-version'], { shell: win }).status === 0;
if (!ffmpeg) try { ffmpeg = !!(await import('ffmpeg-static')).default; } catch { /* optional dependency missing */ }
say(ffmpeg ? 'ffmpeg: found' : 'ffmpeg: NOT found. MP4 encoding will fail; install ffmpeg (brew install ffmpeg / winget install ffmpeg) or rerun with --force.');

const git = spawnSync('git', ['--version'], { shell: win }).status === 0;
say(git ? 'git: found' : 'git: not found. Following Claude\'s work needs git (https://git-scm.com).');

const BF = 'C:\\Program Files\\Blender Foundation';   // every installed version, newest first
const winBlenders = fs.existsSync(BF) ? fs.readdirSync(BF).filter((n) => /^Blender [\d.]+$/.test(n))
  .sort((a, b) => b.localeCompare(a, undefined, { numeric: true })).map((n) => path.join(BF, n, 'blender.exe')) : [];
const blenders = [process.env.BLENDER, 'blender', '/Applications/Blender.app/Contents/MacOS/Blender', ...winBlenders].filter(Boolean);
const blender = blenders.find((b) => spawnSync(b, ['--version'], { stdio: 'ignore' }).status === 0);
say(blender ? `blender: ${blender}` : 'blender: not found (optional: only for re-baking light and changing the set; set its path in Studio > System).');

stamp.at = new Date().toISOString();
fs.writeFileSync(STAMP, JSON.stringify(stamp, null, 2));
console.log('\nSetup done.\n');
