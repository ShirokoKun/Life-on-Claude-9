// The Studio's Board for a scene as one PNG: every shot's frame, timing, lens, voiceover line and intent, laid out
// exactly as the Board page shows them (its ?export=board layout: no sidebar, tabs or buttons).
//   node tools/board_png.mjs --scene s02 [--url http://localhost:8080] [--out deliver/board_s02.png] [--width 1680] [--scale 2]
// Needs the Studio running (npm run studio). The frames are the board stills (Board > Render board stills).
import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const scene = arg('scene', 'intro'), url = arg('url', 'http://localhost:8080');
const out = arg('out', `deliver/board_${scene}.png`), W = +arg('width', 1680), scale = +arg('scale', 2);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: W, height: 900 }, deviceScaleFactor: scale });
page.on('pageerror', (e) => console.log('page error:', e.message));
await page.goto(`${url}/?export=board#/scene/${scene}/board`);
await page.waitForSelector('.board .s', { timeout: 60000 });
const info = await page.evaluate(async () => {
  await document.fonts.ready;
  const cells = [...document.querySelectorAll('.board .img')];
  const urls = cells.map((c) => /url\("?(.*?)"?\)/.exec(c.style.backgroundImage)?.[1]).filter(Boolean);
  await Promise.all(urls.map((u) => new Promise((res) => { const i = new Image(); i.onload = i.onerror = res; i.src = u; })));
  return { shots: cells.length, frames: urls.length };
});
await page.waitForTimeout(300);
fs.mkdirSync(path.dirname(out), { recursive: true });
await page.screenshot({ path: out, fullPage: true });
const { width, height } = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight }));
await browser.close();
if (info.frames < info.shots) console.log(`note: ${info.shots - info.frames} of ${info.shots} shots have no still yet (Board > Render board stills)`);
console.log(`${info.shots} shots, ${width * scale}x${height * scale} px, ${(fs.statSync(out).size / 1e6).toFixed(1)} MB`);
console.log(`wrote ${out}`);
