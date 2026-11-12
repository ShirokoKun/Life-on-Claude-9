// Renders the film headlessly on the real GPU, in resumable chunks, then encodes the final files.
//   node tools/film.mjs                          -> all shots 3840x2160 30 fps (HDR10 + SDR intermediates in out/), then final encodes
//   node tools/film.mjs --shots 0,2 --w 1920 --h 1080 --samples 8 --out out/test
//   node tools/film.mjs --stills 4,12,20 --w 1280 --h 720    (SDR stills at film times -> shots/film_<t>.jpg)
//   node tools/film.mjs --concat                 (only the final encodes from existing chunks)
// A chunk that stalls is detected by a watchdog and re-rendered; finished chunks are skipped on re-run.
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const argv = process.argv.slice(2);
const o = { w: 3840, h: 2160, fps: 30, samples: 16, port: 5319, out: 'out/film', shots: '', stills: '', concat: false, noconcat: false, hdr: 1, sdr: 1, chunk: 60, url: '', threads: 8 };
for (let i = 0; i < argv.length; i++) { const k = argv[i].replace(/^--/, ''); if (k === 'concat' || k === 'noconcat') { o[k] = true; continue; } const v = argv[++i]; o[k] = ['shots', 'stills', 'out', 'url'].includes(k) ? v : Number(v); }
fs.mkdirSync('out', { recursive: true }); fs.mkdirSync('shots', { recursive: true });
const stamp = () => new Date().toISOString().slice(11, 19);

// Final encodes from the per-chunk intermediates (CPU only).
function concat(kind) {
  const base = o.out.split('/').pop();
  const files = fs.readdirSync('out').filter((f) => f.startsWith(base + '_') && f.endsWith(`_${kind}.mp4`) && fs.existsSync('out/' + f.replace(`_${kind}.mp4`, '.done'))).sort();
  if (!files.length) return console.log('no finished chunks for', kind);
  fs.writeFileSync(`out/list_${kind}.txt`, files.map((f) => `file '${f}'`).join('\n'));
  const snd = fs.existsSync('out/soundtrack.m4a');
  const src = ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', `out/list_${kind}.txt`, ...(snd ? ['-i', 'out/soundtrack.m4a', '-map', '0:v:0', '-map', '1:a:0', '-c:a', 'copy', '-shortest'] : ['-an'])];
  const run = (args, dst) => { execFileSync('ffmpeg', [...src, ...args, '-movflags', '+faststart', dst], { stdio: ['ignore', 'ignore', 'inherit'] }); console.log(stamp(), 'wrote', dst, (fs.statSync(dst).size / 1e6).toFixed(1) + ' MB'); };
  if (kind === 'hdr') {
    run(['-c:v', 'libx265', '-preset', 'slow', '-crf', '12', '-pix_fmt', 'yuv420p10le', '-color_primaries', 'bt2020', '-color_trc', 'smpte2084', '-colorspace', 'bt2020nc', '-color_range', 'tv',
      '-x265-params', `pools=${o.threads}:aq-mode=3:hdr10=1:hdr10-opt=1:repeat-headers=1:colorprim=bt2020:transfer=smpte2084:colormatrix=bt2020nc:range=limited:master-display=G(13250,34500)B(7500,3000)R(34000,16000)WP(15635,16450)L(10000000,50):max-cll=1000,180:log-level=error`,
      '-tag:v', 'hvc1'], 'out/room-at-dawn_4k_hdr10.mp4');
  } else {
    const c709 = ['-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709'];
    run(['-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-threads', String(o.threads), '-pix_fmt', 'yuv420p', ...c709], 'out/room-at-dawn_4k_sdr.mp4');
    run(['-vf', 'scale=1920:1080:flags=lanczos', '-c:v', 'libx264', '-preset', 'slow', '-crf', '19', '-threads', String(o.threads), '-pix_fmt', 'yuv420p', ...c709], 'out/room-at-dawn_1080p_sdr.mp4');
  }
}
if (o.concat) { concat('hdr'); concat('sdr'); process.exit(0); }

const exe = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p));
const stillMode = o.stills !== '';
const vw = stillMode ? o.w : 960, vh = stillMode ? o.h : 540;
let browser = null, page = null;
async function open() {
  if (browser) { try { browser.process()?.kill(); } catch {} }
  browser = await puppeteer.launch({
    executablePath: exe, headless: true, protocolTimeout: 0,
    args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--hide-scrollbars', '--mute-audio', `--window-size=${vw},${vh}`,
      '--js-flags=--expose-gc --max-old-space-size=8192'],
    defaultViewport: { width: vw, height: vh, deviceScaleFactor: 1 },
  });
  page = await browser.newPage();
  // no HMR socket: a file saved elsewhere must not reload the page in the middle of a render
  await page.evaluateOnNewDocument(() => { window.WebSocket = class { constructor() { this.readyState = 3; } addEventListener() {} removeEventListener() {} send() {} close() {} }; });
  page.on('console', (m) => { const t = m.text(); if (/^\[(film|gi|gpu)\]/.test(t) || m.type() === 'error') console.log(stamp(), t.slice(0, 300)); });
  page.on('pageerror', (e) => console.log('PAGEERROR ' + e.message));
  page.on('requestfailed', (r) => console.log(stamp(), 'REQFAIL', r.url().slice(-60), r.failure() && r.failure().errorText));
  await page.goto(`http://127.0.0.1:${o.port}/?shot=1&film=1` + (o.url ? '&' + o.url : ''), { waitUntil: 'load', timeout: 180_000 });
  await page.waitForFunction('window.__ready || window.__error', { timeout: 0, polling: 500 });
  const err = await page.evaluate('window.__error'); if (err) throw new Error(err);
}
await open();

if (stillMode) {
  for (const t of o.stills.split(',').map(Number)) {
    await page.evaluate(async (t, o) => { const m = await import('/src/render/film.js'); m.filmStill(window.__api, t, { w: o.w, h: o.h, samples: o.samples, fps: o.fps }); window.__api.renderer.getContext().finish(); }, t, o);
    const file = `shots/film_${String(t).replace('.', '_')}.jpg`;
    await page.screenshot({ path: file, type: 'jpeg', quality: 84 });
    console.log('still', file);
  }
  await browser.close(); process.exit(0);
}

const ranges = await page.evaluate(async (fps) => (await import('/src/render/film.js')).shotRanges(fps), o.fps);
const want = o.shots === '' ? null : o.shots.split(',').map(Number);
const chunks = [];
for (const r of ranges) { if (want && !want.includes(r.shot)) continue; for (let a = r.from; a < r.to; a += o.chunk) chunks.push({ shot: r.shot, name: r.name, from: a, to: Math.min(r.to, a + o.chunk) }); }
if (o.max) chunks.length = Math.min(chunks.length, o.max);   // --max N: only the first N chunks (tests)
const t0 = Date.now(); let done = 0;
for (const c of chunks) {
  const tag = String(c.shot + 1).padStart(2, '0') + '_' + c.name + '_' + String(c.from).padStart(5, '0');
  const mark = `${o.out}_${tag}.done`;
  if (fs.existsSync(mark)) { done++; continue; }
  for (let attempt = 1; ; attempt++) {
    try {
      await page.evaluate(() => { window.__filmProgress = { frame: -1, at: Date.now() }; });
      const job = page.evaluate((o, c) => window.__film({ w: o.w, h: o.h, fps: o.fps, samples: o.samples, out: o.out, shot: c.shot, from: c.from, to: c.to, hdr: !!o.hdr, sdr: !!o.sdr }), o, c);
      let alive = true; job.then(() => (alive = false), () => (alive = false));
      const dog = (async () => { // watchdog: no new frame for 5 minutes -> give up on this attempt
        let lastSeen = Date.now(), lastFrame = -2;
        while (alive) {
          await new Promise((r) => setTimeout(r, 15000));
          if (!alive) return;
          // the page is busy rendering most of the time, so a slow answer here is normal
          const fr = await Promise.race([page.evaluate(() => window.__filmProgress.frame), new Promise((r) => setTimeout(() => r(null), 30000))]);
          if (fr !== null && fr !== lastFrame) { lastFrame = fr; lastSeen = Date.now(); }
          if (Date.now() - lastSeen > 300000) throw new Error('stalled');
        }
      })();
      const res = await Promise.race([job, dog.then(() => job)]);
      if ((o.hdr && res.hdr !== 0) || (o.sdr && res.sdr !== 0)) throw new Error('ffmpeg exit ' + JSON.stringify(res));
      fs.writeFileSync(mark, JSON.stringify(res));
      done++;
      console.log(stamp(), `chunk ${done}/${chunks.length} ${tag} ok  elapsed ${((Date.now() - t0) / 60000).toFixed(1)} min`);
      break;
    } catch (e) {
      console.log(stamp(), `chunk ${tag} attempt ${attempt} failed: ${String(e.message).slice(0, 200)}`);
      if (attempt >= 4) { console.log('giving up'); process.exit(2); }
      await open();
    }
  }
}
await browser.close();
if (!want && !o.noconcat) { concat('hdr'); concat('sdr'); }
console.log(stamp(), 'film done');
