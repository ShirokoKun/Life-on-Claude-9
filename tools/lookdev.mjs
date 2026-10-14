// Look-dev: load a scene once, render many camera/time variants (window.__cam overrides the shot camera).
//   node tools/lookdev.mjs --scene s02 --out dir "name|t|x,y,z,ax,ay,az,mm,f" "name|t" ...   (no camera = the shot's)
// Needs the engine served (npm run serve -- 8791) or --url.
import { chromium } from 'playwright';
import fs from 'fs';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const url = arg('url', 'http://localhost:8791/index.html'), out = arg('out', 'lookdev');
const W = +arg('w', 960), H = +arg('h', 540);
const specs = process.argv.slice(2).filter((a, i, all) => !a.startsWith('--') && !(all[i - 1] || '').startsWith('--'));
fs.mkdirSync(out, { recursive: true });
const args = process.argv.includes('--gpu') ? ['--enable-gpu', '--ignore-gpu-blocklist']
  : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const b = await chromium.launch({ args });
const p = await b.newPage({ viewport: { width: W, height: H } });
p.on('pageerror', (e) => console.log('ERR', e.message));
const extra = [arg('scene') && arg('scene') !== 'intro' ? `scene=${arg('scene')}` : '', arg('extra', '')].filter(Boolean).join('&');
await p.goto(`${url}?render=1${extra ? '&' + extra : ''}`);
await p.waitForFunction(() => window.__ready === true, null, { timeout: 0 });
for (const s of specs) {
  const [name, t, cam] = s.split('|');
  await p.evaluate(([c, f]) => { window.__cam = c || null; window.renderFrame(f); }, [cam || '', Math.round(+t * 24)]);
  await p.screenshot({ path: `${out}/${name}.png` });
  console.log('rendered', name);
}
await b.close();
