// Voxel props for Chapter 1's keyframes: the four modules (V13a-d), envelopes (V09 drowning, V19 auto-replies),
// code blocks (V07a Claude building), a check mark. ASCII pixel art -> voxels (voxel.js).
import * as THREE from 'three';
import { voxels, voxelMaterial, holoVoxels, hex } from './voxel.js';

const W = hex('#fff4e2'), K = hex('#1d1a22');
// round 13: redesigned on an 11 x 11 grid with a 7-tone palette per icon (director: "much better designed"):
// X deep outline, A accent, L light accent, W white, G shade at the base, K ink, H a hot detail
const pal = (deep, accent, light, white, shade, ink, hot) => ({ X: hex(deep), A: hex(accent), L: hex(light), W: hex(white), G: hex(shade), K: hex(ink), H: hex(hot) });
export const ICONS = {
  calendar: { pal: pal('#a3172a', '#ff4458', '#ff9aa4', '#fff5ee', '#d8c8c4', '#3a1c2a', '#ff4458'), rows: [
    '..K.....K..', '.XKXXXXXKX.', 'XAAAAAAAAAX', 'XALLLLLLLAX', 'XWWWWWWWWWX', 'XWKWKWKWKWX',
    'XWWWWWWWWWX', 'XWKWKWHHWWX', 'XWWWWWHHWWX', 'XGGGGGGGGGX', '.XXXXXXXXX.'] },
  meetings: { pal: pal('#b07a06', '#ffc531', '#ffe38f', '#fffaf0', '#e8d9b4', '#3b2a10', '#ff6a2a'), rows: [
    '...XXXXX...', '..XLLLLLX..', '.XLWWWWWLX.', 'XLWWWKWWWLX', 'XWWWWKWWWWX', 'XWWWWKHHWWX',
    'XWWWWWWWWWX', 'XGWWWWWWWGX', '.XGWWWWWGX.', '..XGGGGGX..', '...XXXXX...'] },
  documents: { pal: pal('#13804c', '#36e08a', '#9ff3c4', '#f3fff8', '#cfe6d9', '#1b4a35', '#36e08a'), rows: [
    'XXXXXXX....', 'XWWWWWXX...', 'XWKKKWXLX..', 'XWWWWWXXXX.', 'XWKKKKKKWX.', 'XWWWWWWWWX.',
    'XWKKKKKKWX.', 'XWWWWWWWWX.', 'XWKKKKWAWX.', 'XGGGGGGGGX.', 'XXXXXXXXXX.'] },
  research: { pal: pal('#1763b0', '#45b4ff', '#a2ddff', '#eef9ff', '#c4e3f4', '#16324d', '#ffffff'), rows: [
    '..XXXX.....', '.XLLLLX....', 'XLWWHWLX...', 'XLWHWWLX...', 'XLWWWWLX...', 'XLWWWWLX...',
    '.XLLLLX....', '..XXXXAA...', '......AAA..', '.......AAA.', '........AX.'] },
};
export const MODULE_ORDER = ['calendar', 'meetings', 'documents', 'research'];

export function icon(name, { size = 0.022, glow = 2.2 } = {}) {
  const I = ICONS[name];
  const g = holoVoxels(I.rows, I.pal, { size: size * 9 / 11, depth: 2, frontOnly: { K: 'W', H: 'W' }, glow: glow * 0.7 });
  g.name = `Icon ${name}`;
  return g;
}

export function envelope({ size = 0.012, glow = 1.6, check = false } = {}) {
  const rows = check   // round 13: a white letter, its flap drawn in the accent, a wax seal; sent ones carry a green tick
    ? ['XXXXXXXXXXX', 'XLWWWWWWWLX', 'XWLWWWWWLWX', 'XWWLWWWLWGG', 'XWWWLALWGGX', 'XWWWWWWGGWX', 'XXXXXXXXXXX']
    : ['XXXXXXXXXXX', 'XLWWWWWWWLX', 'XWLWWWWWLWX', 'XWWLWWWLWWX', 'XWWWLALWWWX', 'XWWWWWWWWWX', 'XXXXXXXXXXX'];
  return holoVoxels(rows, { X: hex('#7f8fb3'), L: hex('#6aa8ff'), W: hex('#f4f6ff'), A: hex('#ff5a6a'), G: hex('#38f08f') },
    { size: size * 9 / 11, depth: 1, glow: glow * 0.75 });
}

// a code block: one line of code as a glowing brick (Claude stacks these into the email system)
export function codeBlock(i, { size = 0.01, glow = 2.4 } = {}) {
  const cols = ['#7ad8ff', '#9df2bd', '#ffd43b', '#ff9a6b', '#c9a8ff'];
  const n = 3 + (i * 7) % 5;
  const row = 'G'.repeat(n) + '.'.repeat(Math.max(0, 7 - n));
  return voxels([row.replace(/\./g, 'D'), 'DDDDDDD'], { G: hex(cols[i % cols.length]), D: hex('#2b3340') },
    { size, depth: 2, material: voxelMaterial({ glow }) });
}

// the email pipeline as pixel objects (V10 the offer, V12 it works): inbox -> sort -> draft -> you
export const PIPE = {   // round 13: redesigned, same palette scheme as the module icons (P pencil, G the tick)
  inbox: { pal: pal('#16679e', '#3fb2ff', '#a6dcff', '#f0f9ff', '#c7e2f2', '#173450', '#ffffff'), rows: [
    '...........', '.XXXXXXXXX.', '.XWWWWWWWX.', '.XWKKKKKWX.', '.XWWWWWWWX.', 'XXWKKKKKWXX', 'XAAAWWWAAAX',
    'XAAAAXAAAAX', 'XLLLLLLLLLX', 'XXXXXXXXXXX'] },
  sort: { pal: pal('#a8730a', '#ffc12e', '#ffe48f', '#fffaf0', '#e6d5ab', '#3b2a10', '#ffffff'), rows: [
    'XXXXXXXXXXX', 'XLLLLLLLLLX', 'XAAAAAAAAAX', '.XAAAHAAAX.', '..XAAAAAX..', '...XAAAX...', '....XAX....',
    '....XAX....', '....XLX....', '.....X.....'] },
  draft: { pal: pal('#13804c', '#36e08a', '#9ff3c4', '#f3fff8', '#cfe6d9', '#1b4a35', '#ff7a3a'), rows: [
    'XXXXXX.....', 'XWWWWXX..PP', 'XWKKWWX.PPP', 'XWWWWWXPPP.', 'XWKKKKPPP..', 'XWWWWPPPX..', 'XWKKKHPWX..',
    'XWWWWWWWX..', 'XGGGGGGGX..', 'XXXXXXXXX..'] },
  you: { pal: pal('#b4501a', '#ff8a3d', '#ffc29a', '#fff4ec', '#e7d0c0', '#3d2214', '#ffffff'), rows: [
    '...XXX.....', '..XLLLX....', '..XLLLX....', '...XXX.....', '..XXXXX...G', '.XAAAAAX.GG',
    '.XAAAAAXGG.', '.XLAAALXG..', '.XLLLLLX...', '.XXXXXXX...'] },
};
export const PIPE_ORDER = ['inbox', 'sort', 'draft', 'you'];
export function pipeIcon(name, { size = 0.02, glow = 2.0 } = {}) {
  const I = PIPE[name];
  return holoVoxels(I.rows, { ...I.pal, P: hex('#ffc531'), G: hex('#38f08f') }, { size: size * 9 / 11, depth: 2, frontOnly: { K: 'W', H: 'W' }, glow: glow * 0.7 });
}
export function pixelArrow({ size = 0.014, glow = 2.4, color = '#e8f4ff' } = {}) {
  return voxels(['...X.', 'XXXXX', '...X.'], { X: hex(color) }, { size, depth: 1, material: voxelMaterial({ glow }) });
}

export function checkMark({ size = 0.02, glow = 3 } = {}) {
  return holoVoxels(['.......LG', '......LGG', 'L....LGG.', 'GL..LGG..', '.GLLGG...', '..GGG....', '...G.....'],
    { G: hex('#2fe886'), L: hex('#b6ffd6') }, { size: size * 7 / 9, depth: 2, glow: glow * 0.6 });
}

// the cheat code for his life (V15): game power-ups made of the things his days are made of. Each: a voxel sprite, a
// glowing pickup ring under it, a pixel-font label (what the cheat gives him)
export const LIFE_UPS = [
  { name: 'coffee', label: 'COFFEE x99', accent: '#ff9a4d', rows: [
    '..S.S....', '.S.S.....', '..S.S....', 'XXXXXXX..', 'XWWWWWXXX', 'XWCCCWX.X', 'XWCCCWX.X', 'XWWWWWXXX', '.XXXXX...'] },
  { name: 'hourglass', label: '+38H', accent: '#ffd43b', rows: [
    'XXXXXXX', '.XWWWX.', '..XYX..', '...Y...', '..X.X..', '.XYYYX.', 'XXXXXXX'] },
  { name: 'battery', label: '100%', accent: '#5ff0a0', rows: [
    '..XX..', 'XXXXXX', 'XGGGGX', 'XGGGGX', 'XGGGGX', 'XGGGGX', 'XXXXXX'] },
  { name: 'inbox', label: '0 UNREAD', accent: '#7ad8ff', rows: [
    'XXXXXXXXX', 'XKWWWWWKX', 'XWKWWWKWX', 'XWWKWKWWX', 'XWWWKWWWX', 'XXXXXXXXX'] },
  { name: 'moon', label: 'SKIP SLEEP', accent: '#c9a8ff', rows: [
    '..XXX..', '.XX....', 'XX.....', 'XX.....', 'XX.....', '.XX....', '..XXX..'] },
  { name: 'star', label: 'LVL UP', accent: '#fff1a8', rows: [
    '...X...', '...X...', 'XXXXXXX', '.XXXXX.', '..XXX..', '.XX.XX.', 'X.....X'] },
];
export function lifeUp(i, { size = 0.03 } = {}) {
  const L = LIFE_UPS[i];
  const g = new THREE.Group(); g.name = 'Life up ' + L.name;
  const spr = holoVoxels(L.rows, { X: hex(L.accent), W, K, S: hex('#e8e2d8'), C: hex('#5a3420'), Y: hex('#ffe08a'), G: hex('#5ff0a0') },
    { size, depth: 2, frontOnly: { K: 'W' }, glow: 1.7 });
  spr.name = 'sprite'; g.add(spr);
  const hc = document.createElement('canvas'); hc.width = hc.height = 128; const hg = hc.getContext('2d');
  const gr = hg.createRadialGradient(64, 64, 0, 64, 64, 64); const ac = new THREE.Color(hex(L.accent));
  const rgb = (k) => `rgba(${Math.round(ac.r * 255)},${Math.round(ac.g * 255)},${Math.round(ac.b * 255)},${k})`;
  gr.addColorStop(0, rgb(0.32)); gr.addColorStop(0.3, rgb(0.08)); gr.addColorStop(1, rgb(0)); hg.fillStyle = gr; hg.fillRect(0, 0, 128, 128);
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(size * 10, size * 10), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(hc), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.position.z = -size * 2; halo.name = 'halo'; g.add(halo);                     // a soft glow behind it, not a ring
  const c = document.createElement('canvas'); c.width = 256; c.height = 48;
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
  x.font = 'bold 30px "Courier New", monospace'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillStyle = L.accent; x.fillText(L.label, 128, 26);
  const tex = new THREE.CanvasTexture(c); tex.magFilter = THREE.NearestFilter; tex.colorSpace = THREE.SRGBColorSpace;
  const lab = new THREE.Mesh(new THREE.PlaneGeometry(size * 16, size * 3), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, color: new THREE.Color(1.6, 1.6, 1.6) }));
  lab.position.y = -size * 5.6; lab.name = 'label'; g.add(lab);
  g.visible = false;
  return g;
}
