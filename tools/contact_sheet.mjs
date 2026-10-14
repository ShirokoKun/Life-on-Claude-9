// A contact sheet of a scene: one frame from the middle of every shot, tiled in shot order.
//   node tools/contact_sheet.mjs --scene ch1 [--url http://localhost:8080/engine/index.html] [--w 480] [--cols 6] [--gpu]
// Frames go to renders/<scene>/sheet/f_*.png, the sheet to renders/<scene>/contact_sheet.jpg.
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const scene = arg('scene', 'ch1'), url = arg('url', 'http://localhost:8080/engine/index.html');
const W = +arg('w', 480), H = Math.round(W * 9 / 16), cols = +arg('cols', 6);

const mod = fs.readFileSync(path.join(ROOT, 'engine', 'scenes', scene, 'timeline.json'), 'utf8');
const shots = JSON.parse(mod).shots;
const at = shots.map((s) => ((s.t0 + s.t1) / 2).toFixed(2)).join(',');
const dir = path.join(ROOT, 'renders', scene, 'sheet');
fs.rmSync(dir, { recursive: true, force: true });
const cap = spawnSync(process.execPath, [path.join(ROOT, 'tools', 'capture.mjs'), '--url', url, '--extra', `scene=${scene}`,
  '--out', dir, '--at', at, '--w', String(W), '--h', String(H), ...(process.argv.includes('--gpu') ? ['--gpu'] : [])], { stdio: 'inherit' });
if (cap.status !== 0) process.exit(cap.status);

let ffmpeg = 'ffmpeg'; try { ffmpeg = (await import('ffmpeg-static')).default || ffmpeg; } catch { /* PATH */ }
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.png')).sort();
const rows = Math.ceil(files.length / cols);
const out = path.join(ROOT, 'renders', scene, 'contact_sheet.jpg');
const r = spawnSync(ffmpeg, ['-y', '-loglevel', 'error', '-framerate', '1', '-i', path.join(dir, 'f_%05d.png').replace(/f_%05d/, 'f_%05d'),
  '-vf', `tile=${cols}x${rows}:padding=4:color=0x111111`, '-frames:v', '1', out], { stdio: 'inherit' });
if (r.status !== 0) {                     // non-contiguous frame numbers: tile through a concat list instead
  const list = path.join(dir, 'list.txt');
  fs.writeFileSync(list, files.map((f) => `file '${path.join(dir, f).replace(/\\/g, '/')}'\nduration 1`).join('\n'));
  spawnSync(ffmpeg, ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-vf', `tile=${cols}x${rows}:padding=4:color=0x111111`,
    '-frames:v', '1', out], { stdio: 'inherit' });
}
console.log(`${files.length} shots -> ${path.relative(ROOT, out)}`);
