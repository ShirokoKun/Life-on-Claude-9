// Burn a scene's captions into an existing MP4 without re-rendering, looking exactly like the player's captions:
// each line is drawn by Chromium with the engine's own #cap CSS (engine/index.html: font, colour, soft shadow,
// position) and laid over the video by ffmpeg. Also writes the .srt next to the output. Audio is copied untouched.
//   node tools/subtitle.mjs --scene s02 --in deliver/claude_nine_scene02_draft_720p.mp4 [--out x_subtitled.mp4] [--start 0]
// --start: the scene time of the video's first frame (for a range render).
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { loadProject } from '../studio/lib/project.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
// The caption is sized as in the player on a 1920x1080 screen at 125% scaling (1536 CSS px wide), then scaled with
// the video: a 1080p film matches that player exactly, 720p and 4K keep the same proportions.
const REF_W = 1536;

export function srtFor(captions, start = 0) {
  const ts = (t) => { const ms = Math.max(0, Math.round(t * 1000)); const p = (n, w = 2) => String(n).padStart(w, '0');
    return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`; };
  return captions.filter(([, b]) => b > start).map(([a, b, t], i) => `${i + 1}\n${ts(a - start)} --> ${ts(b - start)}\n${t}\n`).join('\n');
}

// the engine's caption CSS, read from engine/index.html so a change there carries into every export
function captionCSS() {
  const src = fs.readFileSync(path.join(ROOT, 'engine', 'index.html'), 'utf8');
  const rule = (sel) => (new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{[^}]*\\}').exec(src) || [''])[0];
  return `${rule(':root')}\n${rule('html, body')}\n${rule('#cap')}\nhtml, body { background: transparent !important; }`;
}

// burn `captions` into `input` -> `output`; resolves false when the video has no captions in its span
export async function burn(ffmpeg, input, output, captions, start = 0) {
  const srt = output.replace(/\.mp4$/i, '.srt');
  const lines = captions.filter(([, b]) => b > start);
  if (!lines.length) return false;
  fs.writeFileSync(srt, srtFor(captions, start));
  const m = /, (\d{2,5})x(\d{2,5})/.exec(spawnSync(ffmpeg, ['-hide_banner', '-i', input]).stderr?.toString() || '');
  const W = m ? +m[1] : 1920, H = m ? +m[2] : 1080, scale = W / REF_W;

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'subs-'));
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: REF_W, height: Math.round(H / scale) }, deviceScaleFactor: scale });
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${captionCSS()}</style></head><body><div id="cap"></div></body></html>`);
  const pngs = [];
  for (const [i, [, , text]] of lines.entries()) {
    await page.evaluate((t) => { document.getElementById('cap').textContent = t; }, text);
    const f = path.join(tmp, `c${i}.png`); await page.screenshot({ path: f, omitBackground: true }); pngs.push(f);
  }
  await browser.close();

  // one overlay per line, shown exactly while the player would show it
  const graph = lines.map(([a, b], i) => `[${i ? 'v' + i : '0:v'}][${i + 1}:v]overlay=0:0:enable='between(t,${(a - start).toFixed(3)},${(b - start - 0.001).toFixed(3)})'[v${i + 1}]`).join(';');
  const r = spawnSync(ffmpeg, ['-y', '-loglevel', 'error', '-i', input, ...pngs.flatMap((f) => ['-i', f]),
    '-filter_complex', graph, '-map', `[v${lines.length}]`, '-map', '0:a?',
    '-c:v', 'libx264', '-crf', H >= 1080 ? '16' : '18', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-c:a', 'copy', '-movflags', '+faststart', output], { stdio: 'inherit' });
  fs.rmSync(tmp, { recursive: true, force: true });
  if (r.status !== 0) throw new Error('ffmpeg failed');
  return true;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const scene = loadProject(ROOT).scenes.find((s) => s.id === arg('scene', 'intro'));
  if (!scene) { console.error('no scene', arg('scene')); process.exit(1); }
  const input = arg('in'); if (!input) { console.error('--in video.mp4 is needed'); process.exit(1); }
  const output = arg('out', input.replace(/\.mp4$/i, '_subtitled.mp4'));
  let ffmpeg = 'ffmpeg'; try { ffmpeg = (await import('ffmpeg-static')).default || ffmpeg; } catch { /* PATH */ }
  if (!(await burn(ffmpeg, input, output, scene.captions, +arg('start', 0)))) { console.log('this scene has no captions'); process.exit(0); }
  console.log('wrote', path.relative(ROOT, path.resolve(output)).split(path.sep).join('/'));
}
