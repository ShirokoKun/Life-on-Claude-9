// Props for Chapter 1's keyframes. Round 14 (director, ref R3): every pixel icon is a WHITE OUTLINE icon, one pixel
// lines, no fill, no black, an inherent glow (lineicons.js). The four modules (K21, K22, K49), the email pipeline and
// review + approve (K15-K17), the envelopes (K32), the tick, the life-ups (K24). The round 13 coloured 7-tone palettes
// are gone. Code blocks (V07a) stay voxels (not drawn in this round).
import * as THREE from 'three';
import { voxels, voxelMaterial, hex } from './voxel.js';
import { lineIcon, setLine, layerK, dottedArrow, setArrow, pen, text, LIFE_ICONS, design } from './lineicons.js';
export { setLine, layerK, setArrow };

export const MODULE_ORDER = ['calendar', 'meetings', 'documents', 'research'];
// a module icon (px: the size of one pixel of the icon, in metres)
export function icon(name, { px = 0.01, k = 2.2 } = {}) {
  const g = lineIcon(name, { px, k }); g.name = `Icon ${name}`;
  return g;
}

// an envelope (K32's stream); a sent one carries a tick badge
export function envelope({ px = 0.006, k = 2.0, check = false } = {}) {
  return lineIcon(check ? 'envelopeSent' : 'envelope', { px, k });
}

// a code block: one line of code as a glowing brick (Claude stacks these into the email system)
export function codeBlock(i, { size = 0.01, glow = 2.4 } = {}) {
  const cols = ['#7ad8ff', '#9df2bd', '#ffd43b', '#ff9a6b', '#c9a8ff'];
  const n = 3 + (i * 7) % 5;
  const row = 'G'.repeat(n) + '.'.repeat(Math.max(0, 7 - n));
  return voxels([row.replace(/\./g, 'D'), 'DDDDDDD'], { G: hex(cols[i % cols.length]), D: hex('#2b3340') },
    { size, depth: 2, material: voxelMaterial({ glow }) });
}

// the email pipeline (K15 the offer): inbox -> sort -> draft -> you, dotted arrows between
export const PIPE_ORDER = ['inbox', 'sort', 'draft', 'you'];
export function pipeIcon(name, { px = 0.01, k = 2.2 } = {}) { const g = lineIcon(name, { px, k }); g.name = 'Pipe ' + name; return g; }
export function pixelArrow({ px = 0.01, len = 14, k = 1.8 } = {}) { return dottedArrow(len, { px, k }); }
export function checkMark({ px = 0.008, k = 2.4 } = {}) { return lineIcon('check', { px, k }); }

// review + approve (K16-K17)
export const reviewIcon = (o = {}) => lineIcon('review', { px: 0.011, k: 2.2, ...o });
export const approveIcon = (o = {}) => lineIcon('approve', { px: 0.011, k: 2.2, ...o });
// the burst round a stamped tick: eight short strokes at 45-degree steps (drawn outward)
export function burst({ px = 0.011, k = 2.0, r0 = 12, r1 = 14 } = {}) {
  const P = pen();
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4, c = Math.cos(a), s = Math.sin(a);
    P.line(Math.round(c * r0), Math.round(s * r0), Math.round(c * r1), Math.round(s * r1));
  }
  const v = [...P.px.values()], mx = Math.min(...v.map((p) => p.x)), my = Math.min(...v.map((p) => p.y));
  v.forEach((p, i) => { p.x -= mx; p.y -= my; p.o = i / Math.max(1, v.length - 1); });
  return lineIcon({ px: v, w: Math.max(...v.map((p) => p.x)) + 1, h: Math.max(...v.map((p) => p.y)) + 1 }, { px, k });
}

// the cheat code for his life (V15): game power-ups made of the things his days are made of. Each: the white line
// icon and, under it, its label in the pixel font (what the cheat gives him)
export const LIFE_UPS = LIFE_ICONS;
export function lifeUp(i, { px = 0.012 } = {}) {
  const L = LIFE_UPS[i];
  const g = new THREE.Group(); g.name = 'Life up ' + L.name;
  const spr = lineIcon(L.name, { px, k: 2.3 }); spr.name = 'sprite'; g.add(spr);
  const P = pen(); text(P, L.label, 0, 0);
  const v = [...P.px.values()]; v.forEach((p, j) => { p.o = j / Math.max(1, v.length - 1); });
  const lab = lineIcon({ px: v, w: Math.max(...v.map((p) => p.x)) + 1, h: 5 }, { px: px * 0.55, k: 2.0 });
  lab.position.y = -(spr.userData.size[1] / 2 + px * 2.6); lab.name = 'label'; g.add(lab);
  g.visible = false;
  return g;
}
export { design };
