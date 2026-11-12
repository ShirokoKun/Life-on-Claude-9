// Headless screenshots / bakes through the real GPU.
//   node tools/shot.mjs bed wide desk            -> shots/bed.jpg ...
//   node tools/shot.mjs --bake 128               -> path-trace lighting, save public/bake/gi.bin
//   options: --w 1280 --h 720 --accum 8 --time 2 --tag name --look '{"exposure":3}' --url <extra query>
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const opt = { w: 1280, h: 720, accum: 8, time: 2, tag: '', bake: 0, workers: 6, url: '', look: null, q: 82, port: 5319 };
const cams = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a.startsWith('--')) { const k = a.slice(2); const v = argv[++i]; opt[k] = ['tag', 'url'].includes(k) ? v : k === 'look' ? JSON.parse(v) : Number(v); }
  else cams.push(a);
}
const exe = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p));
const browser = await puppeteer.launch({
  executablePath: exe, headless: true,
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', `--window-size=${opt.w},${opt.h}`, '--hide-scrollbars', '--mute-audio'],
  defaultViewport: { width: opt.w, height: opt.h, deviceScaleFactor: 1 }, protocolTimeout: 3600_000,
});
const page = await browser.newPage();
// no HMR socket: a file saved elsewhere must not reload the page in the middle of a bake / render
await page.evaluateOnNewDocument(() => { window.WebSocket = class { constructor() { this.readyState = 3; } addEventListener() {} removeEventListener() {} send() {} close() {} }; });
const logs = [];
page.on('console', (m) => { const t = m.text(); logs.push(t); if (/^\[(bake|boot|gi|gpu|film)\]/.test(t) || m.type() === 'error' || m.type() === 'warn') console.log('  ' + t.slice(0, 400)); });
page.on('pageerror', (e) => console.log('  PAGEERROR ' + e.message));
const base = `http://127.0.0.1:${opt.port}/?shot=1` + (opt.bake ? `&bake=${opt.bake}&workers=${opt.workers}` : '') + (opt.url ? '&' + opt.url : '');
const t0 = Date.now();
await page.goto(base, { waitUntil: 'load', timeout: 120_000 });
await page.waitForFunction('window.__ready || window.__error', { timeout: 3600_000, polling: 500 });
const err = await page.evaluate('window.__error');
if (err) { console.log('ERROR', err); await browser.close(); process.exit(1); }
console.log(`ready in ${((Date.now() - t0) / 1000).toFixed(1)}s`, await page.evaluate('JSON.stringify(window.__api.stats())'));
if (opt.bake) console.log('bake:', await page.evaluate('JSON.stringify(window.__bakeDone)'));
fs.mkdirSync('shots', { recursive: true });
let ci = 0;
for (const cam of cams) {
  const t1 = Date.now();
  let camArg = cam;
  if (cam.includes(',')) { const n = cam.split(',').map(Number); camArg = { pos: n.slice(0, 3), target: n.slice(3, 6), fov: n[6] || 50 }; }
  const info = await page.evaluate((o) => window.__api.shot(o), { cam: camArg, w: opt.w, h: opt.h, accum: opt.accum, time: opt.time, look: opt.look });
  const name = (typeof camArg === 'string' ? cam : 'custom' + (ci++ ? ci : '')) + (opt.tag ? '_' + opt.tag : '');
  const file = path.join('shots', name + '.jpg');
  await page.screenshot({ path: file, type: 'jpeg', quality: opt.q });
  console.log(`shot ${file}  ${Date.now() - t1}ms  calls=${info.calls} tris=${info.tris}`);
}
await browser.close();
