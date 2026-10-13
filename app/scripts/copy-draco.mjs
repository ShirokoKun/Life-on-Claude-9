// Copies the Draco glTF decoder out of three's node_modules into public/draco,
// so DRACOLoader never touches a CDN (gstatic/jsdelivr are blocked here and
// offline renders must not depend on the network anyway).
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'node_modules/three/examples/jsm/libs/draco/gltf');
const dst = join(root, 'public/draco');
if (!existsSync(src)) {
  console.warn(`[copy-draco] ${src} not found, skipping`);
  process.exit(0);
}
mkdirSync(dst, { recursive: true });
cpSync(src, dst, { recursive: true });
console.log(`[copy-draco] ${src} -> ${dst}`);
