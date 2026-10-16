// Claude Nine Studio: the local control room for the film. No dependencies beyond Node 18+.
//
//   npm run studio            (or double-click start-mac.command / start-windows.bat / start-linux.sh)
//   node studio/server.mjs [--port 8080] [--open]
//
// Serves the Studio UI at /, the engine at /engine/, project files at /files/ (read only), and an API:
// the project and its scenes, notes, a job queue (renders, stills, bakes) with live logs, the file tree,
// git activity (and following a branch Claude pushes to), all pushed to the page as server-sent events.
import http from 'http';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn, execFile } from 'child_process';
import { fileURLToPath } from 'url';
import * as P from './lib/project.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const LOCAL = path.join(HERE, '.local');                    // per-machine state (gitignored)
fs.mkdirSync(path.join(LOCAL, 'logs'), { recursive: true });
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };

// ------------------------------------------------------------------ config
const CONFIG_FILE = path.join(LOCAL, 'config.json');
const DEFAULTS = { port: 8080, gpu: true, blender: '', follow: { enabled: false, every: 60, autoPull: false }, liveReload: true };
let config = { ...DEFAULTS, ...(fs.existsSync(CONFIG_FILE) ? JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) : {}) };
config.follow = { ...DEFAULTS.follow, ...config.follow };
const saveConfig = () => fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
const PORT = +arg('port', process.env.PORT || config.port);

// ------------------------------------------------------------------ events (server-sent)
const clients = new Set();
function emit(type, data) {
  const msg = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) res.write(msg);
}
const activity = [];                                          // the recent feed, for pages that open later
function feed(kind, text, extra = {}) {
  const e = { at: Date.now(), kind, text, ...extra };
  activity.unshift(e); activity.length = Math.min(activity.length, 300);
  emit('activity', e);
}

// ------------------------------------------------------------------ helpers
const sh = (cmd, args, opts = {}) => new Promise((res) => execFile(cmd, args, { cwd: ROOT, maxBuffer: 1 << 24, ...opts },
  (err, stdout, stderr) => res({ ok: !err, out: String(stdout).trimEnd(), err: String(stderr || (err && err.message) || '').trim() })));
const git = (...a) => sh('git', a);
const inside = (rel) => { const p = path.resolve(ROOT, rel); if (p !== ROOT && !p.startsWith(ROOT + path.sep)) throw new Error('outside the project'); return p; };
// raw bytes (a reference image), capped
const readRaw = (req, max) => new Promise((res, rej) => { const parts = []; let n = 0;
  req.on('data', (c) => { n += c.length; if (n > max) { rej(new Error(`too large (over ${Math.round(max / 1e6)} MB)`)); req.destroy(); } else parts.push(c); });
  req.on('end', () => res(Buffer.concat(parts))); req.on('error', rej); });
const readBody = (req) => new Promise((res, rej) => { let b = ''; req.on('data', (c) => { b += c; if (b.length > 1e6) req.destroy(); }); req.on('end', () => { try { res(b ? JSON.parse(b) : {}); } catch (e) { rej(e); } }); });
const project = () => P.loadProject(ROOT);
const sceneById = (id) => { const s = project().scenes.find((x) => x.id === id); if (!s) throw new Error('no scene ' + id); return s; };

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.glb': 'model/gltf-binary', '.exr': 'application/octet-stream', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif',
  '.svg': 'image/svg+xml', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.md': 'text/plain; charset=utf-8', '.py': 'text/plain; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8', '.log': 'text/plain; charset=utf-8', '.sh': 'text/plain; charset=utf-8', '.zip': 'application/zip' };

function sendFile(req, res, file) {
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end('not found'); return; }
  const st = fs.statSync(file), size = st.size, type = TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
  // no-cache = the browser asks every time; the ETag lets it keep its copy (304) until the file really changes
  const etag = `W/"${size.toString(36)}-${Math.floor(st.mtimeMs).toString(36)}"`;
  if (req.headers['if-none-match'] === etag) { res.writeHead(304, { ETag: etag, 'Cache-Control': 'no-cache' }); res.end(); return; }
  const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
  if (range) {                                                 // video scrubbing
    const a = range[1] ? +range[1] : 0, b = range[2] ? +range[2] : size - 1;
    res.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${a}-${b}/${size}`, 'Accept-Ranges': 'bytes', 'Content-Length': b - a + 1, 'Cache-Control': 'no-cache' });
    fs.createReadStream(file, { start: a, end: b }).pipe(res); return;
  }
  res.writeHead(200, { 'Content-Type': type, 'Content-Length': size, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache', ETag: etag });
  fs.createReadStream(file).pipe(res);
}
const json = (res, data, code = 200) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' }); res.end(JSON.stringify(data)); };

// ------------------------------------------------------------------ system check
async function system() {
  const has = async (cmd, args) => (await sh(cmd, args)).ok;
  let playwright = false, chromium = false;
  try { const pw = await import('playwright'); playwright = true; chromium = fs.existsSync(pw.chromium.executablePath()); } catch { /* not installed */ }
  let ffmpeg = await has('ffmpeg', ['-version']);
  if (!ffmpeg) try { ffmpeg = !!(await import('ffmpeg-static')).default; } catch { /* none */ }
  const blender = await findBlender();
  const branch = (await git('rev-parse', '--abbrev-ref', 'HEAD')).out;
  return { node: process.version, platform: `${os.platform()} ${os.arch()}`, cpus: os.cpus().length, memGB: Math.round(os.totalmem() / 1e9),
    playwright, chromium, ffmpeg, blender, git: await has('git', ['--version']), branch, root: ROOT, config };
}
// every Blender under Program Files, newest first, so a new release is found without a code change
function windowsBlenders() {
  const d = 'C:\\Program Files\\Blender Foundation';
  try { return fs.readdirSync(d).filter((n) => /^Blender [\d.]+$/.test(n)).sort((a, b) => b.localeCompare(a, undefined, { numeric: true })).map((n) => path.join(d, n, 'blender.exe')); }
  catch { return []; }
}
async function findBlender() {
  const c = [config.blender, process.env.BLENDER, 'blender',
    '/Applications/Blender.app/Contents/MacOS/Blender', ...windowsBlenders()].filter(Boolean);
  for (const b of c) { const r = await sh(b, ['--version']); if (r.ok) return { path: b, version: r.out.split('\n')[0] }; }
  return null;
}

// ------------------------------------------------------------------ jobs: one at a time, in order
const JOBS_FILE = path.join(LOCAL, 'jobs.json');
let jobs = fs.existsSync(JOBS_FILE) ? JSON.parse(fs.readFileSync(JOBS_FILE, 'utf8')) : [];
for (const j of jobs) if (j.state === 'running' || j.state === 'queued') j.state = 'stopped';   // the Studio restarted
let running = null;
const saveJobs = () => fs.writeFileSync(JOBS_FILE, JSON.stringify(jobs.slice(0, 200), null, 2));
const pub = (j) => { const { proc, ...rest } = j; return rest; };

// exp/lampK/scrK numbers, fx 0|1, look a word: only these reach the render URL
function settingsQuery(st) {
  if (!st || typeof st !== 'object') return '';
  const q = new URLSearchParams();
  for (const k of ['exp', 'lampK', 'scrK']) if (Number.isFinite(+st[k])) q.set(k, String(+st[k]));
  if (st.fx === 0 || st.fx === '0') q.set('fx', '0');
  if (typeof st.look === 'string' && /^\w{1,32}$/.test(st.look)) q.set('look', st.look);
  return q.toString();
}

async function commandFor(j) {
  const node = process.execPath, s = sceneById(j.scene);
  if (j.kind === 'render') {
    const a = ['tools/render_mp4.mjs', '--scene', s.id, '--w', String(j.w), '--h', String(j.h), '--take', j.take, '--skip-existing'];
    if (j.frames) a.push('--frames', j.frames);
    if (j.step > 1) a.push('--step', String(j.step));
    if (!config.gpu) a.push('--soft');
    if (j.deliver) a.push('--deliver');
    if (j.subs) a.push('--subs');
    const q = settingsQuery(j.settings);              // the player's current settings: the export renders what you see
    if (q) a.push('--extra', q);
    return [node, a];
  }
  if (j.kind === 'stills') {                                    // one frame per shot (or the given times) for the board
    const times = j.times || s.shots.map((x) => +(x.t0 + 0.6 * (x.t1 - x.t0)).toFixed(2));
    const a = ['tools/capture.mjs', '--url', `http://localhost:${PORT}/engine/index.html`, '--out', `renders/${s.id}/stills`,
      '--w', String(j.w || 1280), '--h', String(j.h || 720), '--at', times.join(',')];
    if (s.id !== 'intro') a.push('--extra', `scene=${s.id}`);
    if (config.gpu) a.push('--gpu');
    j.total = times.length;
    return [node, a];
  }
  if (j.kind === 'board') {                                     // the Board page as one PNG, for sharing
    return [node, ['tools/board_png.mjs', '--scene', s.id, '--url', `http://localhost:${PORT}`, '--out', `deliver/board_${s.id}.png`]];
  }
  if (j.kind === 'bake') {
    const b = await findBlender(); if (!b) throw new Error('Blender not found: set its path in System');
    return [b.path, ['-b', '--factory-startup', '--python', 'blender/scenes/export_engine.py', '--',
      `engine/assets/lighting/${j.preset}`, '--preset', j.preset, '--lm-only', '--samples', String(j.samples || 64)]];
  }
  if (j.kind === 'pull') return ['git', ['pull', '--ff-only']];
  throw new Error('unknown job ' + j.kind);
}

async function next() {
  if (running) return;
  const j = jobs.find((x) => x.state === 'queued'); if (!j) return;
  running = j; j.state = 'running'; j.started = Date.now(); j.log = path.join('studio', '.local', 'logs', `${j.id}.log`);
  let cmd;
  try { cmd = await commandFor(j); } catch (e) { j.state = 'failed'; j.error = e.message; running = null; emit('job', pub(j)); saveJobs(); return next(); }
  const log = fs.createWriteStream(path.join(ROOT, j.log));
  log.write(`$ ${cmd[0]} ${cmd[1].join(' ')}\n`);
  const p = spawn(cmd[0], cmd[1], { cwd: ROOT, detached: process.platform !== 'win32', env: { ...process.env, FORCE_COLOR: '0' } });
  j.proc = p; j.pid = p.pid;
  feed('job', `${j.title} started`, { job: j.id });
  emit('job', pub(j)); saveJobs();
  const onData = (d) => {
    const text = String(d); log.write(text);
    for (const line of text.split('\n')) {
      let m = /progress (\d+)\/(\d+)/.exec(line) || /frame \d+ \((\d+)\/(\d+)\)/.exec(line);
      if (m) { j.done = +m[1]; j.total = +m[2]; }
      if ((m = /s\/frame/.test(line) && /([\d.]+) s\/frame/.exec(line))) j.rate = +m[1];
      if (/^encoding/.test(line)) j.phase = 'encoding';
      if ((m = /^(?:wrote|delivered) (.+\.(?:mp4|png))$/.exec(line.trim()))) (j.outputs ||= []).push(m[1]);
      if (line.trim()) j.last = line.trim().slice(0, 200);
    }
    emit('job', pub(j));
    emit('log', { id: j.id, text });
  };
  p.stdout.on('data', onData); p.stderr.on('data', onData);
  p.on('close', (code) => {
    log.end();
    j.state = j.state === 'cancelled' ? 'cancelled' : code === 0 ? 'done' : 'failed';
    j.ended = Date.now(); delete j.proc; running = null;
    feed('job', `${j.title} ${j.state}`, { job: j.id });
    emit('job', pub(j)); saveJobs();
    if (j.kind === 'pull' && j.state === 'done') emit('reload', { why: 'pulled' });
    next();
  });
}
function addJob(spec) {
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const s = sceneById(spec.scene || 'intro');
  const titles = { render: `Render ${s.title} ${spec.w}×${spec.h}${spec.frames ? ' frames ' + spec.frames : ''}`, stills: `Board stills for ${s.title}`, board: `Board PNG for ${s.title}`,
    bake: `Bake ${spec.preset} lighting`, pull: 'Pull the latest work' };
  const j = { id, state: 'queued', created: Date.now(), take: spec.take || id, ...spec, scene: s.id, title: titles[spec.kind] || spec.kind };
  jobs.unshift(j); saveJobs(); emit('job', pub(j)); next();
  return j;
}
function cancelJob(id) {
  const j = jobs.find((x) => x.id === id); if (!j) throw new Error('no job');
  if (j.state === 'queued') { j.state = 'cancelled'; emit('job', pub(j)); saveJobs(); return; }
  if (j.state === 'running' && j.proc) {
    j.state = 'cancelled';
    if (process.platform === 'win32') spawn('taskkill', ['/pid', String(j.pid), '/T', '/F']);
    else try { process.kill(-j.pid, 'SIGTERM'); } catch { j.proc.kill(); }
  }
}

// ------------------------------------------------------------------ files
const TREE_ROOTS = ['scenes', 'engine/scenes', 'engine/src', 'engine/assets', 'blender', 'docs', 'deliver', 'renders', 'tools', 'reference'];
function listDir(rel) {
  const dir = inside(rel);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).filter((d) => !d.name.startsWith('.') && d.name !== 'node_modules' && d.name !== '__pycache__')
    .map((d) => {
      const p = path.join(dir, d.name), st = fs.statSync(p);
      const e = { name: d.name, path: path.relative(ROOT, p).split(path.sep).join('/'), dir: d.isDirectory(), size: st.size, mtime: st.mtimeMs };
      if (e.dir) { try { const kids = fs.readdirSync(p); e.count = kids.length; if (/^frames_/.test(d.name) || d.name === 'stills') e.frames = kids.filter((k) => k.endsWith('.png')).length; } catch { /* unreadable */ } }
      return e;
    }).sort((a, b) => (b.dir - a.dir) || a.name.localeCompare(b.name, undefined, { numeric: true }));
}

// ------------------------------------------------------------------ watching: files, git, the followed branch
const WATCH = ['engine', 'scenes', 'docs', 'blender', 'tools', 'deliver', 'project.json'];
const pending = new Map(); let flushT = null;
function changed(rel) {
  if (/node_modules|__pycache__|\.git[\\/]|\.blend1$|\.local[\\/]/.test(rel)) return;
  pending.set(rel, Date.now());
  clearTimeout(flushT); flushT = setTimeout(flush, 700);
}
function flush() {
  const files = [...pending.keys()]; pending.clear();
  const engine = files.some((f) => /^engine[\\/]/.test(f) && !/(camera|look)\.json$/.test(f));   // camera/look saves: no reload
  const frames = files.filter((f) => /\.png$/.test(f) && /renders/.test(f)).length;
  const shown = files.filter((f) => !/\.png$/.test(f));
  if (shown.length) feed('files', shown.length === 1 ? `changed ${shown[0]}` : `${shown.length} files changed`, { files: shown.slice(0, 30) });
  emit('files', { files: files.slice(0, 200), engine, frames });
  if (engine && config.liveReload) emit('reload', { why: 'engine changed', files: shown.filter((f) => /^engine/.test(f)).slice(0, 10) });
}
for (const w of WATCH) {
  const p = path.join(ROOT, w); if (!fs.existsSync(p)) continue;
  try { fs.watch(p, { recursive: fs.statSync(p).isDirectory() }, (_e, f) => f && changed(path.join(w, String(f)))); }
  catch { /* recursive watch unsupported (old Node on Linux): the poll below still catches commits */ }
}
// renders/ fills with frames: count them instead of reporting each one
let rendersCount = -1;
setInterval(() => {
  const r = path.join(ROOT, 'renders'); if (!fs.existsSync(r)) return;
  let n = 0; const walk = (d, depth) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { if (e.isDirectory() && depth < 4) walk(path.join(d, e.name), depth + 1); else if (e.name.endsWith('.png')) n++; } };
  try { walk(r, 0); } catch { return; }
  if (n !== rendersCount) { if (rendersCount >= 0) emit('frames', { total: n, added: n - rendersCount }); rendersCount = n; }
}, 5000);

let head = '';
async function gitState() {
  const [h, branch, status, log, up] = await Promise.all([git('rev-parse', 'HEAD'), git('rev-parse', '--abbrev-ref', 'HEAD'), git('status', '--porcelain'),
    git('log', '-40', '--pretty=format:%x1e%H%x1f%h%x1f%an%x1f%at%x1f%s', '--shortstat'), git('rev-parse', '--abbrev-ref', '@{u}')]);
  const commits = log.out.split('\x1e').filter(Boolean).map((block) => {
    const [line, ...rest] = block.split('\n');
    const [hash, short, author, at, subject] = line.split('\x1f');
    return { hash, short, author, at: +at * 1000, subject, stat: rest.join(' ').trim() };
  });
  let behind = 0, ahead = 0;
  if (up.ok) { const c = await git('rev-list', '--left-right', '--count', `HEAD...${up.out}`); if (c.ok) [ahead, behind] = c.out.split(/\s+/).map(Number); }
  return { head: h.out, branch: branch.out, upstream: up.ok ? up.out : null, ahead, behind,
    dirty: status.out ? status.out.split('\n').map((l) => ({ code: l.slice(0, 2), file: l.slice(3) })) : [], commits };
}
setInterval(async () => {
  const h = (await git('rev-parse', 'HEAD')).out;
  if (h && h !== head) { if (head) { const g = await gitState(); feed('commit', g.commits[0]?.subject || 'new commit', { commit: g.commits[0] }); emit('git', g); } head = h; }
}, 4000);

// follow: fetch the branch Claude pushes to, show what's new, pull it when asked (or automatically)
let lastFetch = 0, fetching = false;
async function follow(force = false) {
  if (fetching || (!force && (!config.follow.enabled || Date.now() - lastFetch < config.follow.every * 1000))) return;
  fetching = true; lastFetch = Date.now();
  const r = await git('fetch', '--quiet');
  fetching = false;
  if (!r.ok) { emit('follow', { ok: false, error: r.err.slice(0, 300) }); return; }
  const g = await gitState();
  emit('follow', { ok: true, at: lastFetch, behind: g.behind, ahead: g.ahead });
  if (g.behind > 0) {
    const inc = await git('log', `HEAD..${g.upstream}`, '--pretty=format:%h%x1f%s%x1f%at');
    const incoming = inc.out ? inc.out.split('\n').map((l) => { const [short, subject, at] = l.split('\x1f'); return { short, subject, at: +at * 1000 }; }) : [];
    emit('incoming', { incoming });
    if (config.follow.autoPull && !g.dirty.length && !running) addJob({ kind: 'pull', scene: 'intro' });
  }
}
setInterval(() => follow(false), 5000);

// ------------------------------------------------------------------ routes
const routes = {
  'GET /api/project': async () => {
    const p = project();
    for (const s of p.scenes) s.stills = P.sceneStills(ROOT, s);
    return p;
  },
  'GET /api/system': system,
  'POST /api/config': async (b) => { config = { ...config, ...b, follow: { ...config.follow, ...(b.follow || {}) } }; saveConfig(); if (b.follow?.enabled) follow(true); return config; },
  'GET /api/jobs': async () => jobs.map(pub),
  'POST /api/jobs': async (b) => pub(addJob(b)),
  // the Look editor's versions: engine/scenes/<id>/look.json ({ active, versions: { name: state } })
  'POST /api/look': async (b) => {
    const s = sceneById(b.scene);
    if (s.id === 'intro') throw new Error('the intro look is locked');
    const d = b.data || {}, versions = d.versions || {};
    if (typeof versions !== 'object' || Object.keys(versions).some((n) => !/^[\w-]{1,32}$/.test(n))) throw new Error('bad version names');
    const out = JSON.stringify({ active: typeof d.active === 'string' ? d.active : null, versions }, null, 1);
    if (out.length > 2e6) throw new Error('look too large');
    const f = path.join(ROOT, path.dirname(s.module), 'look.json');
    fs.writeFileSync(f, out);
    return { ok: true, file: path.relative(ROOT, f) };
  },
  // the player's camera keyframe overrides: engine/scenes/<id>/camera.json (the intro: engine/assets/camera.json)
  'POST /api/camera': async (b) => {
    const s = sceneById(b.scene);
    const shots = (b.data && b.data.shots) || {}, ok = {};
    const vec = (v) => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite);
    const key = (k) => k && vec(k.pos) && vec(k.at) && Number.isFinite(k.mm) && Number.isFinite(k.f);
    for (const [id, o] of Object.entries(shots)) {
      if (!/^[\w-]{1,16}$/.test(id) || !key(o.a) || (o.b && !key(o.b))) throw new Error('bad keyframe for ' + id);
      ok[id] = o.b ? { a: o.a, b: o.b } : { a: o.a };
    }
    const f = s.id === 'intro' ? path.join(ROOT, 'engine', 'assets', 'camera.json') : path.join(ROOT, path.dirname(s.module), 'camera.json');
    fs.writeFileSync(f, JSON.stringify({ shots: ok }, null, 1));
    return { ok: true, file: path.relative(ROOT, f), shots: Object.keys(ok) };
  },
  'POST /api/jobs/cancel': async (b) => { cancelJob(b.id); return { ok: true }; },
  'POST /api/jobs/clear': async () => { jobs = jobs.filter((j) => j.state === 'running' || j.state === 'queued'); saveJobs(); return jobs.map(pub); },
  'GET /api/log': async (b, q) => { const j = jobs.find((x) => x.id === q.get('id')); if (!j?.log) return { text: '' };
    const f = path.join(ROOT, j.log); if (!fs.existsSync(f)) return { text: '' }; const t = fs.readFileSync(f, 'utf8'); return { text: t.slice(-60000) }; },
  'GET /api/files': async (b, q) => (q.get('dir') ? listDir(q.get('dir')) : TREE_ROOTS.filter((r) => fs.existsSync(path.join(ROOT, r))).map((r) => ({ ...listDir(path.dirname(r) || '.').find((e) => e.path === r), name: r }))),
  'GET /api/text': async (b, q) => { const f = inside(q.get('path')); const st = fs.statSync(f); if (st.size > 2e6) return { text: '(too large to show)', size: st.size }; return { text: fs.readFileSync(f, 'utf8'), size: st.size }; },
  'GET /api/git': gitState,
  'GET /api/activity': async () => activity,
  'POST /api/follow/check': async () => { await follow(true); return { ok: true }; },
  'POST /api/notes': async (b) => { P.addNote(ROOT, sceneById(b.scene), b); return P.readNotes(ROOT, sceneById(b.scene)); },
  'POST /api/notes/refs': async (b) => { P.addRefs(ROOT, sceneById(b.scene), b.line, b.refs || []); return P.readNotes(ROOT, sceneById(b.scene)); },   // more reference images on a note
  'POST /api/notes/toggle': async (b) => { P.toggleNote(ROOT, sceneById(b.scene), b.line, b.done); return P.readNotes(ROOT, sceneById(b.scene)); },
  'POST /api/scenes': async (b) => P.createScene(ROOT, P.loadProject(ROOT), b),
  'POST /api/scenes/update': async (b) => {
    const p = P.loadProject(ROOT); const s = p.scenes.find((x) => x.id === b.id); if (!s) throw new Error('no scene');
    for (const k of ['title', 'stage', 'voiceover']) if (k in b) s[k] = b[k];
    P.saveProject(ROOT, p); return s;
  },
  'POST /api/open': async (b) => {                               // reveal a file or folder in Finder / Explorer
    const f = inside(b.path);
    const [cmd, args] = process.platform === 'darwin' ? ['open', ['-R', f]] : process.platform === 'win32' ? ['explorer', [`/select,${f}`]] : ['xdg-open', [fs.statSync(f).isDirectory() ? f : path.dirname(f)]];
    spawn(cmd, args, { detached: true, stdio: 'ignore' }).unref(); return { ok: true };
  },
};

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  try {
    if (u.pathname === '/api/events') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
      res.write(`event: hello\ndata: ${JSON.stringify({ at: Date.now() })}\n\n`);
      clients.add(res); req.on('close', () => clients.delete(res)); return;
    }
    if (req.method === 'POST' && u.pathname === '/api/refs/upload') {   // a note's reference image (raw bytes): saved per keyframe, path back
      const q = u.searchParams, data = await readRaw(req, 40e6);
      return json(res, { path: P.saveRef(ROOT, sceneById(q.get('scene')), { shot: q.get('shot'), name: q.get('name'), type: req.headers['content-type'], data }) });
    }
    const h = routes[`${req.method} ${u.pathname}`];
    if (h) return json(res, await h(req.method === 'POST' ? await readBody(req) : {}, u.searchParams));
    if (u.pathname.startsWith('/engine/')) return sendFile(req, res, inside(decodeURIComponent(u.pathname.slice(1)).replace(/\/$/, '/index.html')));
    if (u.pathname.startsWith('/files/')) return sendFile(req, res, inside(decodeURIComponent(u.pathname.slice(7))));
    const ui = path.join(HERE, 'ui', u.pathname === '/' ? 'index.html' : decodeURIComponent(u.pathname));
    if (!ui.startsWith(path.join(HERE, 'ui'))) { res.writeHead(403); res.end(); return; }
    return sendFile(req, res, ui);
  } catch (e) { json(res, { error: e.message }, 400); }
});
setInterval(() => { for (const r of clients) r.write(': ping\n\n'); }, 20000);

server.listen(PORT, '127.0.0.1', async () => {
  head = (await git('rev-parse', 'HEAD')).out;
  const url = `http://localhost:${PORT}/`;
  console.log(`\n  Claude Nine Studio is running:  ${url}\n  (Ctrl+C to stop)\n`);
  if (process.argv.includes('--open')) {
    const [cmd, args] = process.platform === 'darwin' ? ['open', [url]] : process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]] : ['xdg-open', [url]];
    spawn(cmd, args, { detached: true, stdio: 'ignore' }).on('error', () => {}).unref();
  }
  next();
});
server.on('error', (e) => { console.error(e.code === 'EADDRINUSE' ? `Port ${PORT} is busy. Is the Studio already running? Try: npm run studio -- --port ${PORT + 1}` : e.message); process.exit(1); });
