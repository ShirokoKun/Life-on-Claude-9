// Voxel props for Chapter 1's keyframes: the four modules (V13a-d), envelopes (V09 drowning, V19 auto-replies),
// code blocks (V07a Claude building), a check mark. ASCII pixel art -> voxels (voxel.js).
import * as THREE from 'three';
import { voxels, voxelMaterial, hex } from './voxel.js';

const W = hex('#fff4e2'), K = hex('#1d1a22');
export const ICONS = {
  calendar: { accent: '#ff5a4d', rows: [
    '.X.....X.', 'XXXXXXXXX', 'XRRRRRRRX', 'XWWWWWWWX', 'XWKWKWKWX', 'XWWWWWWWX', 'XWKWKWKWX', 'XWWWWWWWX', 'XXXXXXXXX'] },
  meetings: { accent: '#ffd43b', rows: [
    '..XXXXX..', '.XWWWWWX.', 'XWWWKWWWX', 'XWWWKWWWX', 'XWWWKKKWX', 'XWWWWWWWX', 'XWWWWWWWX', '.XWWWWWX.', '..XXXXX..'] },
  documents: { accent: '#9df2bd', rows: [
    'XXXXXX...', 'XWWWWXX..', 'XWKKWWXX.', 'XWWWWWWX.', 'XWKKKKWX.', 'XWWWWWWX.', 'XWKKKKWX.', 'XWWWWWWX.', 'XXXXXXXX.'] },
  research: { accent: '#7ad8ff', rows: [
    '..XXX....', '.XWWWX...', 'XWWWWWX..', 'XWKWWWX..', 'XWWWWWX..', '.XWWWX...', '..XXXXX..', '.....XXX.', '......XXX'] },
};
export const MODULE_ORDER = ['calendar', 'meetings', 'documents', 'research'];

export function icon(name, { size = 0.022, glow = 2.2 } = {}) {
  const I = ICONS[name];
  const g = voxels(I.rows, { X: hex(I.accent), R: hex(I.accent), W, K }, { size, depth: 2, frontOnly: { K: 'W' },
    material: voxelMaterial({ glow }) });
  g.name = `Icon ${name}`;
  return g;
}

export function envelope({ size = 0.012, glow = 1.6, check = false } = {}) {
  const rows = check
    ? ['XXXXXXXXX', 'XKWWWWWKX', 'XWKWWWKWX', 'XWWKWKGGX', 'XWWWKGGWX', 'XXXXXXXXX']
    : ['XXXXXXXXX', 'XKWWWWWKX', 'XWKWWWKWX', 'XWWKWKWWX', 'XWWWKWWWX', 'XXXXXXXXX'];
  return voxels(rows, { X: hex('#d9d2c3'), W: hex('#f6efe2'), K: hex('#8a8172'), G: hex('#5ff0a0') },
    { size, depth: 1, material: voxelMaterial({ glow }) });
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
export const PIPE = {
  inbox: { accent: '#7ad8ff', rows: ['.........', '.XXXXXXX.', '.XWWWWWX.', '.XWKWKWX.', '.XWWKWWX.', 'XXWWWWWXX', 'X.......X', 'X.XXXXX.X', 'XXXXXXXXX'] },
  sort: { accent: '#ffd43b', rows: ['XXXXXXXXX', 'XWWWWWWWX', '.XWWWWWX.', '..XWWWX..', '...XWX...', '...XWX...', '...XWX...', '....X....', '.........'] },
  draft: { accent: '#9df2bd', rows: ['XXXXX....', 'XWWWXX..P', 'XWKKWX.PP', 'XWWWWXPP.', 'XWKKKPP..', 'XWWWPPX..', 'XWKKKWX..', 'XWWWWWX..', 'XXXXXXX..'] },
  you: { accent: '#ff9a6b', rows: ['...XXX...', '..XWWWX..', '..XWWWX..', '...XXX...', '..XXXXX.G', '.XWWWWXGG', '.XWWWGGG.', '.XWWWWGX.', '.XXXXXXX.'] },
};
export const PIPE_ORDER = ['inbox', 'sort', 'draft', 'you'];
export function pipeIcon(name, { size = 0.02, glow = 2.0 } = {}) {
  const I = PIPE[name];
  return voxels(I.rows, { X: hex(I.accent), W, K, P: hex('#ffd43b'), G: hex('#5ff0a0') }, { size, depth: 2, frontOnly: { K: 'W' },
    material: voxelMaterial({ glow }) });
}
export function pixelArrow({ size = 0.014, glow = 2.4, color = '#e8f4ff' } = {}) {
  return voxels(['...X.', 'XXXXX', '...X.'], { X: hex(color) }, { size, depth: 1, material: voxelMaterial({ glow }) });
}

export function checkMark({ size = 0.02, glow = 3 } = {}) {
  return voxels(['......G', '.....GG', 'G...GG.', 'GG.GG..', '.GGG...', '..G....'], { G: hex('#5ff0a0') },
    { size, depth: 2, material: voxelMaterial({ glow }) });
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
  const spr = voxels(L.rows, { X: hex(L.accent), W, K, S: hex('#e8e2d8'), C: hex('#5a3420'), Y: hex('#ffe08a'), G: hex('#5ff0a0') },
    { size, depth: 2, frontOnly: { K: 'W' }, material: voxelMaterial({ glow: 2.4 }) });
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
