// Fetch CC0 models from Poly Haven (glTF + bin + textures) into blender/assets/props/<id>/.
//   node tools/polyhaven.mjs potted_plant_02 fern_02 [--res 1k|2k|4k]
// Already-downloaded files are skipped. Licence: CC0 (polyhaven.com/license); credits go in CREDITS.md.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const res = args.includes('--res') ? args[args.indexOf('--res') + 1] : '2k';
const ids = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--res');

async function get(url, file) {
  if (fs.existsSync(file)) return 0;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const buf = Buffer.from(await r.arrayBuffer());
  fs.writeFileSync(file, buf);
  return buf.length;
}

for (const id of ids) {
  const files = await (await fetch(`https://api.polyhaven.com/files/${id}`)).json();
  const g = files.gltf?.[res]?.gltf || files.gltf?.['2k']?.gltf || files.gltf?.['1k']?.gltf;
  if (!g) { console.log('no glTF for', id); continue; }
  const dir = path.join(ROOT, 'blender', 'assets', 'props', id);
  let n = await get(g.url, path.join(dir, path.basename(g.url)));
  for (const [rel, f] of Object.entries(g.include || {})) n += await get(f.url, path.join(dir, rel));
  console.log(id, (n / 1e6).toFixed(1), 'MB', '->', path.relative(ROOT, dir).split(path.sep).join('/'));
}
