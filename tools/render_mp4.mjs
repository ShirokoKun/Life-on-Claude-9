// One command: serve the engine, capture every frame in Chromium, encode MP4s (silent + voiceover).
//
//   node tools/render_mp4.mjs                      # 1920x1080, 24 fps, GPU, writes renders/
//   node tools/render_mp4.mjs --w 1280 --h 720     # faster preview
//   node tools/render_mp4.mjs --soft               # no GPU (software GL: slow, but works on servers)
//   node tools/render_mp4.mjs --frames 0-120       # a range (for checking a shot)
//   node tools/render_mp4.mjs --step 2             # every 2nd frame, then motion-interpolated to 24 fps
//   node tools/render_mp4.mjs --encode-only        # re-encode existing frames
//
// Needs: Node 18+, `npm install` (playwright), `npx playwright install chromium`, and ffmpeg on PATH
// (or `npm install ffmpeg-static`).
import http from 'http';
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENGINE = path.join(ROOT, 'engine');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const has = (k) => process.argv.includes('--' + k);
const W = +arg('w', 1920), H = +arg('h', 1080), STEP = +arg('step', 1);
const OUT = path.resolve(arg('out', path.join(ROOT, 'renders')));
const FRAMES_DIR = path.join(OUT, `frames_${W}x${H}`);
const [F0, F1] = arg('frames', '0-767').split('-').map(Number);
const EXTRA = arg('extra', '');

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
  const { chromium } = await import('playwright');
  fs.mkdirSync(FRAMES_DIR, { recursive: true });
  const args = has('soft') ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
    : ['--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu'];
  const browser = await chromium.launch({ args, headless: !has('headed') });
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  page.on('pageerror', (e) => console.log('page error:', e.message));
  await page.goto(`${url}?render=1${EXTRA ? '&' + EXTRA : ''}`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 0 });
  const renderer = await page.evaluate(() => {
    const gl = document.querySelector('canvas').getContext('webgl2'); const e = gl && gl.getExtension('WEBGL_debug_renderer_info');
    return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'unknown';
  });
  console.log('GPU:', renderer);
  const t0 = Date.now(); let n = 0;
  for (let f = F0; f <= F1; f += STEP) {
    const file = path.join(FRAMES_DIR, `f_${String(f).padStart(5, '0')}.png`);
    if (has('skip-existing') && fs.existsSync(file)) continue;
    await page.evaluate((k) => window.renderFrame(k), f);
    await page.screenshot({ path: file });
    if (++n % 24 === 0) console.log(`frame ${f}/${F1}  ${((Date.now() - t0) / n / 1000).toFixed(2)} s/frame`);
  }
  await browser.close();
}
server.close();

// ---- encode
const fps = 24 / STEP;
const silent = path.join(OUT, `claude_nine_intro_${W}x${H}.mp4`);
const withVO = path.join(OUT, `claude_nine_intro_${W}x${H}_voiceover.mp4`);
const vf = STEP > 1 ? 'minterpolate=fps=24:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1,format=yuv420p' : 'format=yuv420p';
const run = (a) => { const r = spawnSync(ffmpeg, a, { stdio: 'inherit' }); if (r.status !== 0) throw new Error('ffmpeg failed'); };
run(['-y', '-loglevel', 'error', '-framerate', String(fps), '-pattern_type', 'glob', '-i', path.join(FRAMES_DIR, 'f_*.png'),
  '-vf', vf, '-r', '24', '-c:v', 'libx264', '-crf', '16', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', silent]);
// voiceover starts at 1.5 s (engine/src/shots.js VO_OFFSET)
run(['-y', '-loglevel', 'error', '-i', silent, '-itsoffset', '1.5', '-i', path.join(ENGINE, 'assets', 'voiceover.wav'),
  '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-af', 'apad', '-shortest', withVO]);
console.log('wrote', silent, '\nwrote', withVO);
