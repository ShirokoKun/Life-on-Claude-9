// Keyframe board: load a keyframe scene once, render each shot's held frame, and lay them out as a labelled sheet.
//   node tools/kf_board.mjs [--scene kf1] [--take r1] [--only K01,K08] [--w 1280] [--gpu] [--url http://localhost:8080/engine/index.html]
// Writes renders/<scene>/<take>/<id>.png and renders/<scene>/<take>/board.jpg (id, beat, VO time on each frame).
// A shot's frame is taken at its middle (held frames: any time inside the shot is the same picture).
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { openPage } from './browser.mjs';
import { readSceneModule } from '../studio/lib/project.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const SCENE = arg('scene', 'kf1'), TAKE = arg('take', 'r1');
const W = +arg('w', 1280), H = Math.round(W * 9 / 16);
const url = arg('url', 'http://localhost:8080/engine/index.html');
const only = arg('only', '') ? arg('only').split(',') : null;
const proj = JSON.parse(fs.readFileSync(path.join(ROOT, 'project.json'), 'utf8'));
const sc = proj.scenes.find((s) => s.id === SCENE) || { module: `engine/scenes/${SCENE}/scene.js` };
const mod = readSceneModule(ROOT, sc);
const shots = mod.shots.filter((s) => !only || only.includes(s.id));
const out = path.join(ROOT, 'renders', SCENE, TAKE);
fs.mkdirSync(out, { recursive: true });

const { page, close } = await openPage({ gpu: process.argv.includes('--gpu'), w: W, h: H });
const errors = [];
page.on('pageerror', (e) => { errors.push(e.message); console.log('ERR', e.message); });
page.on('console', (m) => { if (['error', 'warning'].includes(m.type()) && !/Failed to load resource/.test(m.text())) console.log('console', m.text().slice(0, 300)); });
page.on('response', (r) => { if (r.status() >= 400) console.log('missing', r.status(), r.url().replace(/^https?:\/\/[^/]+/, '')); });
await page.goto(`${url}?render=1&scene=${SCENE}${arg('extra', '') ? '&' + arg('extra') : ''}`);
await page.waitForFunction(() => window.__ready === true, null, { timeout: 0 });
const t0 = Date.now();
const rows = [];
for (const s of shots) {
  const t = Math.max(s.t0 + 0.5 * (s.t1 - s.t0), 1.0);
  const f = Math.round(t * 24);
  const tf = Date.now();
  await page.evaluate((n) => { window.renderFrame(n); window.renderFrame(n); }, f);   // twice: the lens, lights and follows settle on the new shot
  const lost = await page.evaluate(() => { const gl = window.__renderer.getContext(); return gl.isContextLost(); });
  if (lost) console.log('CONTEXT LOST at', s.id);
  const file = path.join(out, `${s.id}.png`);
  await page.screenshot({ path: file, timeout: 300000 });
  rows.push({ ...s, t, f, file });
  console.log(`${s.id} t=${t.toFixed(2)} f${f} ${s.name}  ${((Date.now() - tf) / 1000).toFixed(1)} s`);
}
await close();
console.log(`${shots.length} frames in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
fs.writeFileSync(path.join(out, 'frames.json'), JSON.stringify(rows.map(({ id, name, t0, t1, t, f }) => ({ id, name, t0, t1, t, f })), null, 1));

// the sheet: 4 across, label strip under each frame
const py = `
import json, sys
from PIL import Image, ImageDraw, ImageFont
rows = json.load(open(sys.argv[1], encoding='utf8')); out = sys.argv[2]; d = sys.argv[3]
w, h = 640, 360; lab = 44; cols = 4
n = len(rows); R = (n + cols - 1) // cols
sheet = Image.new('RGB', (w * cols, (h + lab) * R), (14, 14, 16))
try: font = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 17); small = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 14)
except Exception: font = small = ImageFont.load_default()
dr = ImageDraw.Draw(sheet)
for i, r in enumerate(rows):
    x, y = (i % cols) * w, (i // cols) * (h + lab)
    im = Image.open(d + '/' + r['id'] + '.png').convert('RGB').resize((w, h))
    sheet.paste(im, (x, y))
    dr.text((x + 8, y + h + 4), r['id'] + '  ' + r['name'], fill=(240, 236, 228), font=font)
    dr.text((x + 8, y + h + 24), '%.2f-%.2f s   f%d' % (r['t0'], r['t1'], r['f']), fill=(150, 150, 160), font=small)
sheet.save(out, quality=88)
`;
const pyFile = path.join(out, '_sheet.py');
fs.writeFileSync(pyFile, py);
const r = spawnSync('python', ['-I', pyFile, path.join(out, 'frames.json'), path.join(out, 'board.jpg'), out], { encoding: 'utf8' });
fs.rmSync(pyFile);
if (r.status) console.log(r.stderr); else console.log('wrote', path.relative(ROOT, path.join(out, 'board.jpg')));
if (errors.length) console.log(`${errors.length} page errors`);
