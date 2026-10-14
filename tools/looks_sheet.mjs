// Mood presets side by side: every look (rows) x a few cameras (columns), one sheet.
//   node tools/looks_sheet.mjs [--scene s03] [--looks clean,blue3am,...] [--w 640] [--gpu]
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const scene = arg('scene', 's03');
const looks = arg('looks', 'clean,blue3am,lampwindow,screen,garage').split(',');
const W = +arg('w', 640), H = Math.round(W * 9 / 16);
const cams = [
  ['desk', '0.55,3.2,1.45,1.35,4.5,0.95,28,2.8'],
  ['bed+door', '1.2,4.55,1.65,3.2,0.6,0.7,22,4'],
  ['window', '3.75,2.3,1.35,0.0,2.3,1.15,22,4'],
];
const out = path.join(ROOT, 'renders', scene, 'looks');
fs.mkdirSync(out, { recursive: true });
let ffmpeg = 'ffmpeg'; try { ffmpeg = (await import('ffmpeg-static')).default || ffmpeg; } catch { /* PATH */ }
const font = 'C\\:/Windows/Fonts/arial.ttf';
const files = [];
for (const look of looks) for (const [cn, cam] of cams) {
  const dir = path.join(out, `tmp_${look}_${cn}`.replace(/\W/g, '_'));
  fs.rmSync(dir, { recursive: true, force: true });
  spawnSync(process.execPath, [path.join(ROOT, 'tools', 'capture.mjs'), '--url', 'http://localhost:8080/engine/index.html',
    '--extra', `scene=${scene}&look=${look}&cam=${cam}`, '--out', dir, '--at', '5', '--w', String(W), '--h', String(H),
    ...(process.argv.includes('--gpu') ? ['--gpu'] : [])], { encoding: 'utf8' });
  const png = fs.existsSync(dir) && fs.readdirSync(dir).find((x) => x.endsWith('.png'));
  const dst = path.join(out, `${look}_${cn}.png`.replace(/\+/g, '_'));
  if (png) { fs.copyFileSync(path.join(dir, png), dst); files.push([look, cn, dst]); console.log(look, cn); }
  fs.rmSync(dir, { recursive: true, force: true });
}
const n = cams.length;
const inputs = files.flatMap(([, , f]) => ['-i', f]);
const lab = (i, t) => `[${i}]drawtext=fontfile='${font}':text='${t}':x=10:y=8:fontsize=${Math.round(H / 16)}:fontcolor=white:box=1:boxcolor=black@0.55:boxborderw=5[v${i}]`;
const parts = files.map(([l, c], i) => lab(i, `${l}  -  ${c}`.replace(/[':+]/g, ' ')));
const rows = looks.map((_, r) => `${Array.from({ length: n }, (_, c) => `[v${r * n + c}]`).join('')}hstack=${n}[r${r}]`);
const graph = [...parts, ...rows, `${looks.map((_, r) => `[r${r}]`).join('')}vstack=${looks.length}`].join(';');
const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
const sheet = path.join(out, `looks_${stamp}.jpg`);
spawnSync(ffmpeg, ['-y', '-loglevel', 'error', ...inputs, '-filter_complex', graph, '-frames:v', '1', '-q:v', '3', sheet], { stdio: 'inherit' });
console.log('wrote', path.relative(ROOT, sheet));
