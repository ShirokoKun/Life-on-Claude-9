// GPU cost breakdown per top-level scene group at a given resolution.
//   node tools/profile.mjs [w] [h]
import puppeteer from 'puppeteer-core';
const w = Number(process.argv[2] || 3840), h = Number(process.argv[3] || 2160);
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'], defaultViewport: { width: 960, height: 540 }, protocolTimeout: 0 });
const page = await browser.newPage();
await page.evaluateOnNewDocument(() => { window.WebSocket = class { constructor() { this.readyState = 3; } addEventListener() {} removeEventListener() {} send() {} close() {} }; });
page.on('pageerror', (e) => console.log('PAGEERROR ' + e.message));
await page.goto('http://127.0.0.1:5319/?shot=1', { waitUntil: 'load' });
await page.waitForFunction('window.__ready || window.__error', { timeout: 0, polling: 300 });
const res = await page.evaluate(async (w, h) => {
  const api = window.__api, { renderer, scene, camera, pipe } = api, gl = renderer.getContext();
  api.resize(w, h, { msaa: 0 }); api.setCam('bed');
  const px = new Uint8Array(4);
  const sync = () => { gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); };
  const time = (fn, n = 4) => { fn(); sync(); const t = performance.now(); for (let i = 0; i < n; i++) fn(); sync(); return +((performance.now() - t) / n).toFixed(1); };
  const sceneOnly = () => { renderer.info.reset(); renderer.setRenderTarget(pipe.rtMain); renderer.clear(); renderer.render(scene, camera); };
  const out = {};
  out.sceneAll = time(sceneOnly); out.tris = renderer.info.render.triangles; out.calls = renderer.info.render.calls;
  for (const g of scene.children) { g.visible = false; out['without_' + (g.name || g.type)] = time(sceneOnly); g.visible = true; }
  out.fullSubframe = time(() => pipe._sceneAndAOAccum(1 / 16));
  return out;
}, w, h);
console.log(JSON.stringify(res, null, 1));
await browser.close();
