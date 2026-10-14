// Look-lock keyframes: render each keyframe camera of a set and put it next to its reference, with numbers.
//   node tools/keyframes.mjs [--set scenes/03-ivan-room] [--only KF1,KF2] [--w 960] [--gpu]
// Reads <set>/keyframes.json; writes renders/<scene>/keyframes/<id>.png, keyframes_<stamp>.jpg (ours | reference,
// one row per keyframe) and the numbers (tools/frame_stats.py) in keyframes_<stamp>.md.
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const set = arg('set', 'scenes/03-ivan-room');
const spec = JSON.parse(fs.readFileSync(path.join(ROOT, set, 'keyframes.json'), 'utf8'));
const only = arg('only', '') ? arg('only').split(',') : null;
const W = +arg('w', 960), H = Math.round(W * 9 / 16);
const url = arg('url', 'http://localhost:8080/engine/index.html');
const out = path.join(ROOT, 'renders', spec.scene, 'keyframes');
fs.mkdirSync(out, { recursive: true });
let ffmpeg = 'ffmpeg'; try { ffmpeg = (await import('ffmpeg-static')).default || ffmpeg; } catch { /* PATH */ }

const frames = spec.frames.filter((f) => !only || only.includes(f.id));
const rows = [];
for (const f of frames) {
  const dir = path.join(out, 'tmp_' + f.id);
  fs.rmSync(dir, { recursive: true, force: true });
  const r = spawnSync(process.execPath, [path.join(ROOT, 'tools', 'capture.mjs'), '--url', url, '--extra', `scene=${spec.scene}&cam=${f.cam.join(',')}${arg('look', f.look || '') ? '&look=' + arg('look', f.look) : ''}`,
    '--out', dir, '--at', String(spec.at ?? 5), '--w', String(W), '--h', String(H), ...(process.argv.includes('--gpu') ? ['--gpu'] : [])], { encoding: 'utf8' });
  const png = fs.existsSync(dir) && fs.readdirSync(dir).find((x) => x.endsWith('.png'));
  if (!png) { console.error(f.id, 'capture failed', (r.stderr || '').slice(-400)); continue; }
  const ours = path.join(out, `${f.id}.png`);
  fs.copyFileSync(path.join(dir, png), ours);
  fs.rmSync(dir, { recursive: true, force: true });
  rows.push({ f, ours, ref: path.join(ROOT, set, f.ref), before: f.before && path.join(ROOT, set, f.before) });
  console.log(f.id, 'rendered');
}

const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
const sheet = path.join(out, `keyframes_${stamp}.jpg`);
const font = 'C\\:/Windows/Fonts/arial.ttf';
const label = (t) => `drawtext=fontfile='${font}':text='${t.replace(/[':]/g, ' ')}':x=14:y=12:fontsize=22:fontcolor=white:box=1:boxcolor=black@0.55:boxborderw=6`;
// --before adds a first column: the frame the human reviewed earlier (before | now | reference)
const BEFORE = process.argv.includes('--before');
const blank = path.join(out, 'blank.png');
if (BEFORE && !fs.existsSync(blank)) spawnSync(ffmpeg, ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', `color=c=0x111111:s=${W}x${H}`, '-frames:v', '1', blank]);
const per = BEFORE ? 3 : 2;
const inputs = rows.flatMap((r) => [...(BEFORE ? ['-i', r.before && fs.existsSync(r.before) ? r.before : blank] : []), '-i', r.ours, '-i', r.ref]);
const fit = `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H}`;
const parts = rows.map((r, i) => { const k = per * i, o = BEFORE ? 1 : 0;
  return (BEFORE ? `[${k}]${fit},${label(r.before ? `${r.f.id} before (your review)` : `${r.f.id} before - none`)}[z${i}];` : '') +
  `[${k + o}]scale=${W}:${H},${label(`${r.f.id} now - ${r.f.name}`)}[a${i}];` +
  `[${k + o + 1}]${fit},${label(`${r.f.id} reference`)}[b${i}];` +
  `${BEFORE ? `[z${i}]` : ''}[a${i}][b${i}]hstack=${per}[r${i}]`; }).join(';');
const graph = `${parts};${rows.map((_, i) => `[r${i}]`).join('')}vstack=inputs=${rows.length}`;
const res = spawnSync(ffmpeg, ['-y', '-loglevel', 'error', ...inputs, '-filter_complex', rows.length > 1 ? graph : graph.replace(/;\[r0\]vstack=inputs=1$/, ''),
  '-frames:v', '1', '-q:v', '3', sheet], { stdio: 'inherit' });
if (res.status !== 0) process.exit(1);

const stats = spawnSync('python', ['-I', path.join(ROOT, 'tools', 'frame_stats.py'), ...rows.flatMap((r) => [r.ours, r.ref])], { encoding: 'utf8' });
const md = [`# Keyframes ${stamp}`, '', `Sheet: ${path.relative(ROOT, sheet)}`, '', '```', stats.stdout.trim(), '```', '',
  ...rows.map((r) => `- **${r.f.id} ${r.f.name}**: take from the reference: ${r.f.take}`)].join('\n');
fs.writeFileSync(sheet.replace(/\.jpg$/, '.md'), md);
console.log(stats.stdout);
console.log('wrote', path.relative(ROOT, sheet));
