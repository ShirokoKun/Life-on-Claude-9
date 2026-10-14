// One command: serve the engine, capture every frame of a scene in Chromium, encode MP4s (silent + voiceover).
//
//   node tools/render_mp4.mjs                          # the intro, 1920x1080, 24 fps, GPU, into renders/intro/<take>/
//   node tools/render_mp4.mjs --scene s02              # another scene from project.json
//   node tools/render_mp4.mjs --w 1280 --h 720         # faster preview
//   node tools/render_mp4.mjs --soft                   # no GPU (software GL: slow, but works on servers)
//   node tools/render_mp4.mjs --frames 0-120           # a range (for checking a shot)
//   node tools/render_mp4.mjs --step 2                 # every 2nd frame, then motion-interpolated to 24 fps
//   node tools/render_mp4.mjs --take final --skip-existing   # resume a take
//   node tools/render_mp4.mjs --encode-only --take final     # re-encode existing frames
//   node tools/render_mp4.mjs --deliver                # also copy the MP4s into deliver/
//   node tools/render_mp4.mjs --subs                   # also a _subtitled.mp4 (+ .srt) with the captions burned in
//
// Needs: Node 18+, `npm install` (playwright), `npx playwright install chromium`, and ffmpeg on PATH
// (or `npm install ffmpeg-static`). The Studio (npm run studio) runs this for you.
import http from 'http';
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { loadProject } from '../studio/lib/project.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENGINE = path.join(ROOT, 'engine');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const has = (k) => process.argv.includes('--' + k);

const project = loadProject(ROOT);
const scene = project.scenes.find((s) => s.id === arg('scene', 'intro'));
if (!scene) { console.error('no scene', arg('scene'), 'in project.json'); process.exit(1); }
const W = +arg('w', 1920), H = +arg('h', 1080), STEP = +arg('step', 1);
const last = Math.round(scene.duration * scene.fps) - 1;
const [F0, F1] = arg('frames', `0-${last}`).split('-').map(Number);
const take = arg('take', new Date().toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', '_'));
const OUT = path.resolve(arg('out', path.join(ROOT, 'renders', scene.id, take)));
const FRAMES_DIR = path.join(OUT, `frames_${W}x${H}`);
const EXTRA = [scene.id !== 'intro' ? `scene=${scene.id}` : '', arg('extra', '')].filter(Boolean).join('&');
console.log(`scene ${scene.id} "${scene.title}"  frames ${F0}-${F1}  ${W}x${H}  -> ${path.relative(ROOT, OUT)}`);

let ffmpeg = 'ffmpeg';
try { ffmpeg = (await import('ffmpeg-static')).default || ffmpeg; } catch { /* use PATH */ }

// ---- tiny static server (no dependencies)
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json',
  '.glb': 'model/gltf-binary', '.exr': 'application/octet-stream', '.jpg': 'image/jpeg', '.png': 'image/png', '.wav': 'audio/wav' };
const server = http.createServer((req, res) => {
  const p = path.join(ENGINE, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
  if (!p.startsWith(ENGINE) || !fs.existsSync(p)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const url = `http://localhost:${server.address().port}/index.html`;

if (!has('encode-only')) {
  const { openPage, GPU_ARGS, SOFT_ARGS } = await import('./browser.mjs');
  fs.mkdirSync(FRAMES_DIR, { recursive: true });
  const gpu = !has('soft');
  const { page, close } = await openPage({ gpu, w: W, h: H, headless: !has('headed'), args: gpu ? [...GPU_ARGS, '--enable-unsafe-webgpu'] : SOFT_ARGS });
  page.on('pageerror', (e) => console.log('page error:', e.message));
  await page.goto(`${url}?render=1${EXTRA ? '&' + EXTRA : ''}`);
  console.log('loading the scene...');
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 0 });
  const renderer = await page.evaluate(() => {
    const gl = document.querySelector('canvas').getContext('webgl2'); const e = gl && gl.getExtension('WEBGL_debug_renderer_info');
    return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'unknown';
  });
  console.log('GPU:', renderer);
  const todo = [];
  for (let f = F0; f <= F1; f += STEP) todo.push(f);
  const t0 = Date.now(); let n = 0;
  for (const [i, f] of todo.entries()) {
    const file = path.join(FRAMES_DIR, `f_${String(f).padStart(5, '0')}.png`);
    if (has('skip-existing') && fs.existsSync(file)) continue;
    await page.evaluate((k) => window.renderFrame(k), f);
    await page.screenshot({ path: file });
    n++;
    console.log(`progress ${i + 1}/${todo.length} frame ${f}  ${((Date.now() - t0) / n / 1000).toFixed(2)} s/frame`);
  }
  await close();
}
server.close();

// ---- encode
const fps = 24 / STEP;
const name = `${scene.id}_${W}x${H}`;
const silent = path.join(OUT, `${name}.mp4`);
const withVO = path.join(OUT, `${name}_voiceover.mp4`);
const vf = STEP > 1 ? 'minterpolate=fps=24:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1,format=yuv420p' : 'format=yuv420p';
const run = (a) => { const r = spawnSync(ffmpeg, a, { stdio: 'inherit' }); if (r.status !== 0) throw new Error('ffmpeg failed'); };
console.log('encoding...');
// a numbered sequence works everywhere; every-Nth-frame renders need a glob (not on Windows ffmpeg builds)
const input = STEP === 1 ? ['-start_number', String(F0), '-i', path.join(FRAMES_DIR, 'f_%05d.png')]
  : ['-pattern_type', 'glob', '-i', path.join(FRAMES_DIR, 'f_*.png')];
run(['-y', '-loglevel', 'error', '-framerate', String(fps), ...input,
  '-vf', vf, '-r', '24', '-c:v', 'libx264', '-crf', '16', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', silent]);
console.log('wrote', path.relative(ROOT, silent));
const vo = scene.voiceover && path.join(ROOT, scene.voiceover);
if (vo && fs.existsSync(vo)) {
  // the voiceover starts at the scene's VO_OFFSET; a range render starts the audio at its first frame
  const offset = scene.voOffset - F0 / 24;
  const a = offset >= 0 ? ['-itsoffset', String(offset), '-i', vo] : ['-ss', String(-offset), '-i', vo];
  run(['-y', '-loglevel', 'error', '-i', silent, ...a, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k',
    '-af', 'apad', '-shortest', '-movflags', '+faststart', withVO]);
  console.log('wrote', path.relative(ROOT, withVO));
}
const outputs = [silent, withVO];
if (has('subs')) {                                  // captions burned into copies; the clean MP4s stay as they are
  const { burn } = await import('./subtitle.mjs');
  for (const f of [silent, withVO]) if (fs.existsSync(f)) {
    const o = f.replace(/\.mp4$/, '_subtitled.mp4');
    if (await burn(ffmpeg, f, o, scene.captions || [], F0 / 24)) { outputs.push(o); console.log('wrote', path.relative(ROOT, o)); }
  }
}
if (has('deliver')) {
  fs.mkdirSync(path.join(ROOT, 'deliver'), { recursive: true });
  for (const f of outputs) if (fs.existsSync(f)) {
    const d = path.join(ROOT, 'deliver', `claude_nine_${path.basename(f)}`); fs.copyFileSync(f, d); console.log('delivered', path.relative(ROOT, d));
  }
}
console.log('done');
