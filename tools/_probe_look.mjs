// Look-dev probe: one frame rendered with several head looks (window.__look = [pitch, yaw] degrees), to tune lookK.
//   node tools/_probe_look.mjs <frame> <outPrefix> "p,y" "p,y" ...
import { openPage } from './browser.mjs';
const [frame, out, ...looks] = process.argv.slice(2);
const { page, close } = await openPage({ gpu: true, w: 480, h: 270 });
await page.goto('http://localhost:8791/index.html?render=1&scene=kf1');
await page.waitForFunction(() => window.__ready === true, null, { timeout: 0 });
for (const l of looks) {
  const v = l.split(',').map(Number);
  await page.evaluate(([f, v]) => { window.__look = v; window.renderFrame(f); window.renderFrame(f); }, [+frame, v]);
  await page.screenshot({ path: `${out}_${l.replace(/[,.-]/g, '_')}.png` });
}
await close(); console.log('ok', looks.length);
