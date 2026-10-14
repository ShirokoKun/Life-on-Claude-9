// Material audit of a scene: every material's colour, roughness, metalness, clearcoat, maps, lightmap and env strength.
//   node tools/audit_materials.mjs [--scene s03] [--url http://localhost:8080/engine/index.html]
// Use it whenever assets or the material library change (LESSONS.md: the metal bug hid for days).
import fs from 'fs';
import { openPage } from './browser.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const scene = arg('scene', 's03'), url = arg('url', 'http://localhost:8080/engine/index.html');
const { page, close } = await openPage({ gpu: true, w: 640, h: 360 });
await page.goto(`${url}?render=1&scene=${scene}`);
await page.waitForFunction(() => window.__ready === true, null, { timeout: 0 });
const rows = await page.evaluate(() => {
  const seen = new Map();
  window.__scene.traverse((o) => {
    if (!o.isMesh || !o.visible) return;
    for (const m of [].concat(o.material)) {
      const k = m.name || '(none)';
      const e = seen.get(k) || { n: 0, objs: new Set(), m };
      e.n++; if (e.objs.size < 3) e.objs.add(o.name.slice(0, 24)); seen.set(k, e);
    }
  });
  const f = (x) => x == null ? '-' : (+x).toFixed(2);
  const lum = (c) => c ? (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) : 0;   // linear
  // what the surface really reflects: the colour factor times the texture's mean (sRGB map decoded to linear)
  const cv = document.createElement('canvas'); cv.width = cv.height = 16; const g = cv.getContext('2d', { willReadFrequently: true });
  const meanOf = (t) => { try { const im = t.image || t.source?.data; g.clearRect(0, 0, 16, 16); g.drawImage(im, 0, 0, 16, 16);
    const d = g.getImageData(0, 0, 16, 16).data; let r = 0, gg = 0, b = 0; const lin = (v) => Math.pow(v / 255, 2.2);
    for (let i = 0; i < d.length; i += 4) { r += lin(d[i]); gg += lin(d[i + 1]); b += lin(d[i + 2]); } const n = d.length / 4;
    return { r: r / n, g: gg / n, b: b / n }; } catch { return null; } };
  const eff = (m) => { if (!m.color) return '-'; const t = m.map && meanOf(m.map); const c = t ? { r: m.color.r * t.r, g: m.color.g * t.g, b: m.color.b * t.b } : m.color;
    const s = (v) => Math.round(255 * Math.pow(Math.min(1, v), 1 / 2.2)).toString(16).padStart(2, '0');
    return `${lum(c).toFixed(3)} #${s(c.r)}${s(c.g)}${s(c.b)}`; };
  return [...seen.entries()].sort((a, b) => b[1].n - a[1].n).map(([k, { n, objs, m }]) =>
    `| ${k} | ${n} | ${m.color ? '#' + m.color.getHexString() : '-'} | ${eff(m)} | ${f(Math.min(1, m.roughness))} | ${f(m.metalness)}${m.metalnessMap ? ' (map)' : ''} | ${f(m.clearcoat)} | ` +
    `${m.map ? (m.map.name || m.map.source?.data?.src?.split('/').pop() || 'map') : ''} | ${m.normalMap ? 'yes' : ''} | ${m.lightMap ? f(m.lightMapIntensity) : 'none'} | ` +
    `${f(m.envMapIntensity)} | ${m.emissive && m.emissive.getHex() ? f(m.emissiveIntensity) : ''} | ${[...objs].join(', ')} |`);
});
await close();
const md = [`# Material audit: ${scene}`, '', '| material | meshes | colour factor | real albedo (linear, sRGB) | rough | metal | coat | map | nrm | lightmap | env | emit | objects |',
  '|---|---|---|---|---|---|---|---|---|---|---|---|---|', ...rows].join('\n');
fs.mkdirSync(`renders/${scene}`, { recursive: true });
fs.writeFileSync(`renders/${scene}/material_audit.md`, md);
console.log(md);
