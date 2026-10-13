// The project as the Studio sees it: project.json, each scene's module (shots, captions, timing) read without
// running it (the modules import three through the engine's import map), its folder, notes, and renders.
import fs from 'fs';
import path from 'path';

export function loadProject(ROOT) {
  const p = JSON.parse(fs.readFileSync(path.join(ROOT, 'project.json'), 'utf8'));
  p.scenes = p.scenes.map((s) => ({ ...s, ...readSceneModule(ROOT, s), notes: readNotes(ROOT, s), renders: listRenders(ROOT, s) }));
  return p;
}

export function saveProject(ROOT, p) {
  const clean = { ...p, scenes: p.scenes.map(({ id, number, title, module, folder, voiceover, stage }) => ({ id, number, title, module, folder, voiceover, stage })) };
  fs.writeFileSync(path.join(ROOT, 'project.json'), JSON.stringify(clean, null, 2) + '\n');
}

const num = (src, name, d) => { const m = new RegExp(`export const ${name} = ([\\d.]+)`).exec(src); return m ? +m[1] : d; };
const unq = (s) => s.replace(/\\'/g, "'").replace(/\\"/g, '"');

export function readSceneModule(ROOT, scene) {
  const file = path.join(ROOT, scene.module);
  if (!fs.existsSync(file)) return { fps: 24, duration: 0, voOffset: 0, shots: [], captions: [], missing: true };
  const src = fs.readFileSync(file, 'utf8');
  const out = { fps: num(src, 'FPS', 24), duration: num(src, 'DURATION', 0), voOffset: num(src, 'VO_OFFSET', 0), shots: [], captions: [] };
  const block = (name) => { const i = src.indexOf(`export const ${name} = [`); if (i < 0) return ''; const j = src.indexOf('\n];', i); return src.slice(i, j); };
  for (const e of block('SHOTS').split(/\n\s*\{ id: /).slice(1)) {
    const g = (re) => { const m = re.exec(e); return m ? m[1] : null; };
    const mm = /mm: \[([\d.]+), ([\d.]+)\]/.exec(e);
    out.shots.push({
      id: g(/^'([^']+)'/), name: unq(g(/name: '((?:[^'\\]|\\.)*)'/) || ''),
      t0: +g(/t0: ([\d.]+)/), t1: +g(/t1: ([\d.]+)/),
      mm: mm ? [+mm[1], +mm[2]] : null, dolly: g(/dolly: ([\d.]+)/) ? +g(/dolly: ([\d.]+)/) : null, f: +(g(/f: ([\d.]+)/) || 0),
      why: unq(g(/why: '((?:[^'\\]|\\.)*)'/) || ''),
    });
  }
  for (const m of block('CAPTIONS').matchAll(/\[([\d.]+), ([\d.]+), (['"])((?:(?!\3)[^\\]|\\.)*)\3\]/g)) out.captions.push([+m[1], +m[2], unq(m[4])]);
  return out;
}

// NOTES.md in the scene folder: one line per note, a checkbox, the shot and time, the text. People write them in
// the Studio; Claude reads the same file.
const NOTE_RE = /^- \[( |x)\] \*\*(\S+) @ ([\d.]+) s\*\* (.*?)(?: _\(([^)]*)\)_)?$/;
export function readNotes(ROOT, scene) {
  const f = path.join(ROOT, scene.folder, 'NOTES.md');
  if (!fs.existsSync(f)) return [];
  return fs.readFileSync(f, 'utf8').split('\n').map((l, i) => {
    const m = NOTE_RE.exec(l); return m && { line: i, done: m[1] === 'x', shot: m[2], t: +m[3], text: m[4], when: m[5] || '' };
  }).filter(Boolean);
}
export function addNote(ROOT, scene, { shot, t, text }) {
  const f = path.join(ROOT, scene.folder, 'NOTES.md');
  fs.mkdirSync(path.dirname(f), { recursive: true });
  if (!fs.existsSync(f)) fs.writeFileSync(f, `# Notes: scene ${scene.number}, ${scene.title}\n\nLeft in the Studio while watching. Claude works through the open ones; tick a box when it's fixed.\n\n`);
  const when = new Date().toISOString().slice(0, 16).replace('T', ' ');
  fs.appendFileSync(f, `- [ ] **${shot || '-'} @ ${(+t).toFixed(1)} s** ${String(text).replace(/\s+/g, ' ').trim()} _(${when})_\n`);
}
export function toggleNote(ROOT, scene, line, done) {
  const f = path.join(ROOT, scene.folder, 'NOTES.md');
  const lines = fs.readFileSync(f, 'utf8').split('\n');
  if (!NOTE_RE.test(lines[line] || '')) throw new Error('no note on that line');
  lines[line] = lines[line].replace(/^- \[( |x)\]/, `- [${done ? 'x' : ' '}]`);
  fs.writeFileSync(f, lines.join('\n'));
}

// renders/<scene>/<take>/ : frames_WxH/ + mp4s; plus the films in deliver/ named after the scene
export function listRenders(ROOT, scene) {
  const out = [];
  const dir = path.join(ROOT, 'renders', scene.id);
  if (fs.existsSync(dir)) {
    for (const take of fs.readdirSync(dir)) {
      const td = path.join(dir, take); if (!fs.statSync(td).isDirectory()) continue;
      const files = fs.readdirSync(td);
      const framesDir = files.find((f) => f.startsWith('frames_'));
      const frames = framesDir ? fs.readdirSync(path.join(td, framesDir)).filter((f) => f.endsWith('.png')).length : 0;
      out.push({ take, path: path.relative(ROOT, td), frames, videos: files.filter((f) => f.endsWith('.mp4')).map((f) => path.relative(ROOT, path.join(td, f))),
        mtime: fs.statSync(td).mtimeMs });
    }
  }
  return out.sort((a, b) => b.mtime - a.mtime);
}

export function sceneStills(ROOT, scene) {
  const dir = path.join(ROOT, 'renders', scene.id, 'stills');
  if (!fs.existsSync(dir)) return {};
  const out = {};
  for (const f of fs.readdirSync(dir)) { const m = /^f_(\d+)\.png$/.exec(f); if (m) out[+m[1]] = `renders/${scene.id}/stills/${f}`; }
  return out;
}

// A new scene: an engine module that starts as a copy of the template, a folder with a storyboard and notes.
export function createScene(ROOT, p, { id, title }) {
  if (!/^[a-z][a-z0-9_]{1,20}$/.test(id)) throw new Error('id: lowercase letters, digits, underscore');
  if (p.scenes.some((s) => s.id === id)) throw new Error('that id exists');
  const number = Math.max(0, ...p.scenes.map((s) => s.number)) + 1;
  const slug = String(title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || id;
  const folder = `scenes/${String(number).padStart(2, '0')}-${slug}`;
  const mod = `engine/scenes/${id}/scene.js`;
  fs.mkdirSync(path.join(ROOT, path.dirname(mod)), { recursive: true });
  fs.writeFileSync(path.join(ROOT, mod), fs.readFileSync(path.join(ROOT, 'studio', 'templates', 'scene.js'), 'utf8').replace(/__TITLE__/g, title).replace(/__ID__/g, id));
  fs.mkdirSync(path.join(ROOT, folder), { recursive: true });
  fs.writeFileSync(path.join(ROOT, folder, 'STORYBOARD.md'), `# Scene ${number}: ${title}\n\n**Script:**\n\n> \n\n## Shots\n\n| # | Time | Line | Shot | Camera | Action | Light |\n|---|---|---|---|---|---|---|\n`);
  const scene = { id, number, title, module: mod, folder, voiceover: null, stage: 'idea' };
  p.scenes.push(scene);
  saveProject(ROOT, p);
  return scene;
}
