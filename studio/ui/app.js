// Claude Nine Studio, the page. Plain modules, no build step: the server pushes events, the views re-draw.
const $ = (s, el = document) => el.querySelector(s);
const main = $('#main');
const S = { project: null, jobs: [], git: null, system: null, activity: [], incoming: [], follow: null, logs: {} };
// ?export=board: the Board alone at full length, for tools/board_png.mjs (no sidebar, tabs or buttons)
const EXPORT = new URLSearchParams(location.search).get('export');
if (EXPORT) document.documentElement.classList.add('export');

// ------------------------------------------------------------------ small DOM helper
function h(tag, attrs = {}, ...kids) {
  const [name, ...cls] = tag.split('.');
  const el = document.createElement(name || 'div');
  if (cls.length) el.className = cls.join(' ');
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat(Infinity)) if (k != null && k !== false) el.append(k.nodeType ? k : document.createTextNode(String(k)));
  return el;
}
const api = async (url, body) => {
  const r = await fetch(url, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {});
  const d = await r.json(); if (d && d.error) throw new Error(d.error); return d;
};
const fmtT = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;
const tc = (t, fps = 24) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}:${String(Math.floor((t % 1) * fps + 1e-6)).padStart(2, '0')}`;
const ago = (ms) => { const s = (Date.now() - ms) / 1000; return s < 60 ? 'just now' : s < 3600 ? `${Math.floor(s / 60)} min ago` : s < 86400 ? `${Math.floor(s / 3600)} h ago` : new Date(ms).toLocaleDateString(); };
const clock = (ms) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const size = (b) => b > 1e9 ? (b / 1e9).toFixed(1) + ' GB' : b > 1e6 ? (b / 1e6).toFixed(1) + ' MB' : b > 1e3 ? Math.round(b / 1e3) + ' kB' : b + ' B';
const fileURL = (p) => '/files/' + p.split('/').map(encodeURIComponent).join('/');
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 4200); }
const run = (fn) => async (...a) => { try { await fn(...a); } catch (e) { toast(e.message); } };

// a little markdown: headings, tables, lists, quotes, code, bold, italics, links
function md(src) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const inl = (s) => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*([^*]+)\*/g, '$1<i>$2</i>')
    .replace(/_\(([^)]+)\)_/g, '<span class="faint">($1)</span>').replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>').replace(/<br>/g, '<br>');
  const out = []; const L = src.split('\n'); let i = 0;
  while (i < L.length) {
    const l = L[i];
    if (/^```/.test(l)) { const b = []; i++; while (i < L.length && !/^```/.test(L[i])) b.push(L[i++]); i++; out.push(`<pre><code>${esc(b.join('\n'))}</code></pre>`); continue; }
    if (/^#{1,4} /.test(l)) { const n = l.match(/^#+/)[0].length; out.push(`<h${n}>${inl(l.slice(n + 1))}</h${n}>`); i++; continue; }
    if (/^\|/.test(l)) {
      const rows = []; while (i < L.length && /^\|/.test(L[i])) rows.push(L[i++]);
      const cells = (r) => r.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      out.push('<table><tr>' + cells(rows[0]).map((c) => `<th>${inl(c)}</th>`).join('') + '</tr>' +
        rows.slice(2).map((r) => '<tr>' + cells(r).map((c) => `<td>${inl(c)}</td>`).join('') + '</tr>').join('') + '</table>'); continue;
    }
    if (/^> ?/.test(l)) { const b = []; while (i < L.length && /^> ?/.test(L[i])) b.push(L[i++].replace(/^> ?/, '')); out.push(`<blockquote>${b.map(inl).join('<br>')}</blockquote>`); continue; }
    if (/^\s*([-*]|\d+\.) /.test(l)) {
      const ord = /^\s*\d+\./.test(l); const b = [];
      while (i < L.length && /^\s*([-*]|\d+\.) /.test(L[i])) b.push(L[i++].replace(/^\s*([-*]|\d+\.) /, '').replace(/^\[( |x)\] /, (m, x) => (x === 'x' ? '☑ ' : '☐ ')));
      out.push(`<${ord ? 'ol' : 'ul'}>${b.map((x) => `<li>${inl(x)}</li>`).join('')}</${ord ? 'ol' : 'ul'}>`); continue;
    }
    if (l.trim()) { const b = []; while (i < L.length && L[i].trim() && !/^(#|\||>|```|\s*([-*]|\d+\.) )/.test(L[i])) b.push(L[i++]); out.push(`<p>${inl(b.join(' '))}</p>`); continue; }
    i++;
  }
  return out.join('\n');
}

// ------------------------------------------------------------------ data + live events
async function loadAll() {
  [S.project, S.jobs] = await Promise.all([api('/api/project'), api('/api/jobs')]);
  $('#projName').textContent = S.project.name;
  drawSide();
}
const gitReady = Promise.all([api('/api/git'), api('/api/activity')]).then(([g, a]) => { S.git = g; S.activity = a; drawSide(); view.onGit?.(); view.onActivity?.(); });
function connect() {
  const es = new EventSource('/api/events');
  es.addEventListener('hello', () => { $('#connDot').classList.add('live'); $('#connText').textContent = 'live'; });
  es.onerror = () => { $('#connDot').classList.remove('live'); $('#connText').textContent = 'reconnecting…'; };
  es.addEventListener('job', (e) => {
    const j = JSON.parse(e.data); const i = S.jobs.findIndex((x) => x.id === j.id);
    if (i >= 0) S.jobs[i] = j; else S.jobs.unshift(j);
    view.onJob?.(j);
    if (j.state === 'done' || j.state === 'failed') { refreshProject(); if (j.state === 'done') toast(`${j.title}: done`); else toast(`${j.title}: failed. See the log in Renders & jobs.`); }
    drawSide(); view.onJob?.(j);
  });
  es.addEventListener('log', (e) => { const d = JSON.parse(e.data); S.logs[d.id] = ((S.logs[d.id] || '') + d.text).slice(-60000); view.onLog?.(d); });
  es.addEventListener('activity', (e) => { S.activity.unshift(JSON.parse(e.data)); S.activity.length = Math.min(300, S.activity.length); view.onActivity?.(); });
  es.addEventListener('git', (e) => { S.git = JSON.parse(e.data); drawSide(); view.onGit?.(); refreshProject(); });
  es.addEventListener('follow', (e) => { S.follow = JSON.parse(e.data); if (S.git) { S.git.behind = S.follow.behind ?? S.git.behind; } drawSide(); view.onGit?.(); });
  es.addEventListener('incoming', (e) => { S.incoming = JSON.parse(e.data).incoming; drawSide(); view.onGit?.(); });
  es.addEventListener('files', (e) => view.onFiles?.(JSON.parse(e.data)));
  es.addEventListener('frames', () => view.onFrames?.());
  es.addEventListener('reload', (e) => { if (view.onReload) view.onReload(JSON.parse(e.data)); else if (engine.frame) engine.stale = true; });   // a hidden player reloads when shown
}
let refreshT;
function refreshProject() { clearTimeout(refreshT); refreshT = setTimeout(async () => { S.project = await api('/api/project'); drawSide(); view.onProject?.(); }, 400); }

function drawSide() {
  const route = location.hash.slice(2).split('/');
  const nav = $('#navScenes'); nav.replaceChildren(...(S.project?.scenes || []).map((s) =>
    h('a', { href: `#/scene/${s.id}`, class: route[0] === 'scene' && route[1] === s.id ? 'on' : '' }, `${s.number}. ${s.title}`, h('span.chip.' + s.stage, {}, s.stage))));
  document.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('on', a.dataset.nav === route[0]));
  const active = S.jobs.filter((j) => j.state === 'running' || j.state === 'queued').length;
  $('#jobsBadge').hidden = !active; $('#jobsBadge').textContent = active;
  const behind = S.git?.behind || 0;
  $('#pullBadge').hidden = !behind; $('#pullBadge').textContent = behind;
  const r = S.jobs.find((j) => j.state === 'running');
  $('#runMini').hidden = !r;
  if (r) $('#runMini').replaceChildren(h('div', {}, r.title), h('div.bar', {}, h('i', { style: { width: pct(r) + '%' } })), h('div.faint.mono', {}, eta(r)));
}
const pct = (j) => (j.total ? Math.round((100 * (j.done || 0)) / j.total) : 0);
const eta = (j) => j.phase === 'encoding' ? 'encoding…' : j.total ? `${j.done || 0}/${j.total}${j.rate ? ` · ${j.rate.toFixed(1)} s/frame · ~${Math.ceil(((j.total - (j.done || 0)) * j.rate) / 60)} min left` : ''}` : j.last || 'starting…';

// ------------------------------------------------------------------ router
let view = {};
const VIEWS = { scenes: Scenes, scene: Scene, jobs: Jobs, files: Files, activity: Activity, system: System };
function route() {
  view.leave?.();
  const [name, ...rest] = (location.hash.slice(2) || 'scenes').split('/');
  view = {}; main.scrollTop = 0;
  (VIEWS[name] || Scenes)(...rest);
  drawSide();
}
window.addEventListener('hashchange', route);
const page = (...kids) => { const p = h('div.page', {}, ...kids); main.replaceChildren(p); return p; };

// ------------------------------------------------------------------ scenes
function stillFor(s, shot) {
  const st = s.stills || {}; const fps = s.fps || 24;
  const frames = Object.keys(st).map(Number).filter((f) => !shot || (f / fps >= shot.t0 && f / fps < shot.t1));
  if (!frames.length) return null;
  const mid = shot ? (shot.t0 + 0.6 * (shot.t1 - shot.t0)) * fps : frames[Math.floor(frames.length / 2)];
  return st[frames.sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid))[0]];
}
function Scenes() {
  const draw = () => {
    const p = S.project;
    page(
      h('div.head', {}, h('div', {}, h('div.eyebrow', {}, 'Project'), h('h1', {}, p.name), h('p.sub', {}, `${p.scenes.length} scenes · ${fmtT(p.scenes.reduce((a, s) => a + s.duration, 0))} of film`)),
        h('button.btn.primary', { onclick: newScene }, '+ New scene')),
      h('div.sceneGrid', {}, p.scenes.map((s) => {
        const still = stillFor(s, s.shots[Math.floor(s.shots.length / 2)]) || stillFor(s);
        const open = s.notes.filter((n) => !n.done).length;
        const latest = s.renders.find((r) => r.videos.length);
        return h('a.card.sceneCard', { href: `#/scene/${s.id}` },
          h('div.thumb', { style: still ? { backgroundImage: `url(${fileURL(still)})` } : { background: 'linear-gradient(135deg,#1d1a14,#0d0e10)' } }, h('span', {}, String(s.number).padStart(2, '0'))),
          h('div.body', {}, h('div.row', {}, h('h2.grow', {}, s.title), h('span.chip.' + s.stage, {}, s.stage)),
            h('div.stats', {}, h('span', {}, h('b', {}, fmtT(s.duration)), ' long'), h('span', {}, h('b', {}, s.shots.length), ' shots'),
              h('span', {}, h('b', {}, open), ' open notes'), h('span', {}, s.voiceover ? 'voiceover ✓' : 'no voiceover yet')),
            h('div.faint', {}, latest ? `Last film: ${ago(latest.mtime)}` : 'Not rendered in the Studio yet')));
      })));
  };
  draw(); view.onProject = draw;
}
const newScene = run(async () => {
  const title = window.prompt ? prompt('Scene title?', 'The next scene') : null; if (!title) return;
  const id = prompt('Short id (lowercase, e.g. s03)?', 's0' + (S.project.scenes.length + 1)); if (!id) return;
  const s = await api('/api/scenes', { id, title }); await loadAll(); location.hash = `#/scene/${s.id}`;
  toast(`Scene created: engine/scenes/${s.id}/scene.js and ${s.folder}/`);
});

// ------------------------------------------------------------------ one scene: player, board, notes, renders, script
function Scene(id, tab = 'player') {
  const s = S.project.scenes.find((x) => x.id === id); if (!s) return Scenes();
  const tabs = [['player', 'Player'], ['board', 'Board'], ['notes', `Notes${s.notes.filter((n) => !n.done).length ? ' · ' + s.notes.filter((n) => !n.done).length : ''}`], ['renders', 'Render & export'], ['script', 'Storyboard']];
  const body = h('div');
  page(h('div.head', {}, h('div', {}, h('div.eyebrow', {}, `Scene ${s.number} · ${s.id}`), h('h1', {}, s.title),
    h('p.sub', {}, `${fmtT(s.duration)} · ${s.shots.length} shots · ${s.fps} fps · `, h('code', {}, s.module))),
  h('div.row', {}, h('select', { 'aria-label': 'Stage', onchange: run(async (e) => { await api('/api/scenes/update', { id: s.id, stage: e.target.value }); refreshProject(); }) },
    ['idea', 'storyboard', 'draft', 'final'].map((v) => h('option', { value: v, selected: v === s.stage }, v))))),
  h('nav.tabs', {}, tabs.map(([k, l]) => h('a', { href: `#/scene/${id}/${k}`, class: k === tab ? 'on' : '' }, l))), body);
  ({ player: Player, board: Board, notes: Notes, renders: Renders, script: Script }[tab] || Player)(s, body);
}

// ------------------------------------------------------------------ the engine: one loaded player, kept alive between pages
// A scene takes seconds to load (textures, lightmaps, shaders), so leaving the player hides it instead of unloading
// it: back on the player it is there at once. Another scene or another preview quality replaces it.
const PREVIEW_Q = [['full', 'Full'], ['balanced', 'Balanced'], ['fast', 'Fast']];
let previewQ = 'full';
try { previewQ = localStorage.getItem('previewQuality') || 'full'; } catch { /* storage blocked: full */ }
const engine = { frame: null, scene: null, pq: null, stale: false, key: null, started: 0, loadedIn: null };
function engineFor(id) {
  if (engine.frame && (engine.scene !== id || engine.pq !== previewQ)) {
    try { engine.frame.contentWindow.__renderer?.forceContextLoss(); } catch { /* not loaded yet */ }   // free its GPU memory now, not at GC
    engine.frame.remove(); engine.frame = null;
  }
  if (!engine.frame) {
    const f = h('iframe.engine', { src: `/engine/index.html?scene=${id}&caps=1&panel=0${previewQ === 'full' ? '' : '&pq=' + previewQ}`, title: 'Engine', allow: 'autoplay; fullscreen' });
    f.style.visibility = 'hidden';
    f.addEventListener('load', () => {
      f.contentWindow.addEventListener('keydown', (e) => { if (e.target === f.contentWindow.document.body) engine.key?.(e); });
      if (!engine.key) f.contentWindow.studio?.active?.(false);      // already left the player while it loaded
    });
    document.body.append(f);
    Object.assign(engine, { frame: f, scene: id, pq: previewQ, stale: false, started: performance.now(), loadedIn: null });
  } else if (engine.stale) reloadEngine();
  return engine.frame;
}
function reloadEngine() { Object.assign(engine, { stale: false, started: performance.now(), loadedIn: null }); engine.frame.contentWindow.location.reload(); }
function hideEngine() {
  if (!engine.frame) return;
  engine.frame.style.visibility = 'hidden'; engine.key = null;
  engine.frame.contentWindow?.studio?.active?.(false);
}

function Player(s, body) {
  let frame = engineFor(s.id);
  const screen = h('div.screen');
  const tcEl = h('span.tc', {}, '00:00:00'); const shotEl = h('div.shotInfo'); const loadEl = h('span.faint.mono', { style: { fontSize: '12px' } });
  const head = h('div.playhead'); const track = h('div.track');
  const capTrack = h('div.track.caps'); const noteTrack = h('div.track.notes');
  const W = (t) => (100 * t) / s.duration + '%';
  track.append(...s.shots.map((x) => h('div.shot', { style: { left: W(x.t0), width: `calc(${W(x.t1 - x.t0)} - 1px)` }, 'data-id': x.id, title: x.name }, `${x.id} ${x.name}`)));
  capTrack.append(...s.captions.map(([a, b, t]) => h('div.cap', { style: { left: W(a), width: W(b - a) }, title: t })));
  const drawNotes = () => noteTrack.replaceChildren(...s.notes.map((n) => h('i', { class: n.done ? 'done' : '', style: { left: W(n.t) }, title: `${n.shot} @ ${n.t} s: ${n.text}`, onclick: (e) => { e.stopPropagation(); seek(n.t); } })));
  drawNotes();
  const tl = h('div.timeline', {}, track, capTrack, noteTrack, head);
  const E = () => frame.contentWindow?.studio;
  const seek = (t) => E()?.seek(Math.max(0, Math.min(s.duration - 1 / 24, t)));
  const seekWhenReady = (t) => { const wait = setInterval(() => { if (!frame.isConnected) clearInterval(wait); else if (E()?.state().ready) { clearInterval(wait); seek(t); } }, 300); };
  let dragging = false;
  const at = (e) => { const r = track.getBoundingClientRect(); return ((e.clientX - r.left) / r.width) * s.duration; };
  tl.addEventListener('pointerdown', (e) => { dragging = true; tl.setPointerCapture(e.pointerId); seek(at(e)); });
  tl.addEventListener('pointermove', (e) => dragging && seek(at(e)));
  tl.addEventListener('pointerup', () => { dragging = false; });
  const playBtn = h('button.btn.primary', { onclick: () => E()?.play() }, '▶ Play');
  const shotJump = (d) => { const st = E()?.state(); if (!st) return; const i = s.shots.findIndex((x) => x.id === st.shot); const n = s.shots[Math.max(0, Math.min(s.shots.length - 1, i + d))]; seek(n.t0 + 0.01); };
  const quality = h('select', { 'aria-label': 'Preview quality', title: 'Preview quality: Balanced and Fast draw fewer pixels with lighter shadows; Fast also uses smaller textures. Renders always use full quality.',
    onchange: (e) => {
      const t = E()?.state()?.t || 0; previewQ = e.target.value;
      try { localStorage.setItem('previewQuality', previewQ); } catch { /* not remembered */ }
      frame = engineFor(s.id); engine.key = key; seekWhenReady(t);
    } }, PREVIEW_Q.map(([v, l]) => h('option', { value: v, selected: v === previewQ }, `Preview: ${l}`)));
  const noteText = h('textarea', { placeholder: 'What should change here? e.g. "his right hand goes through his cheek"' });
  const addNote = run(async () => {
    const st = E()?.state(); if (!noteText.value.trim() || !st) return;
    s.notes = await api('/api/notes', { scene: s.id, t: st.t, shot: st.shot, text: noteText.value }); noteText.value = ''; drawNotes(); toast(`Note saved to ${s.folder}/NOTES.md`);
  });
  body.replaceChildren(h('div.playerWrap', {},
    h('div', {}, screen,
      h('div.transport', {}, playBtn, h('button.btn', { onclick: () => shotJump(-1), title: 'Previous shot ([)' }, '⏮'), h('button.btn', { onclick: () => seek((E()?.state().t || 0) - 1 / 24), title: 'Back one frame (←)' }, '◀'),
        h('button.btn', { onclick: () => seek((E()?.state().t || 0) + 1 / 24), title: 'Forward one frame (→)' }, '▶'), h('button.btn', { onclick: () => shotJump(1), title: 'Next shot (])' }, '⏭'), tcEl, h('span.grow'),
        quality,
        h('button.btn.ghost', { onclick: () => frame.contentWindow?.document.body.classList.toggle('collapsed'), title: 'The engine\'s own panel: look, lights, free camera' }, 'Engine panel'),
        h('button.btn.ghost', { onclick: () => frame.requestFullscreen?.() }, 'Fullscreen')),
      tl, h('div.ruler', {}, ...Array.from({ length: 7 }, (_, i) => h('span', {}, fmtT((s.duration * i) / 6)))),
      h('p.faint.row', { style: { fontSize: '12px' } }, h('span.grow', {}, h('span.kbd', {}, 'Space'), ' play · ', h('span.kbd', {}, '←'), h('span.kbd', {}, '→'), ' frame · ', h('span.kbd', {}, '['), h('span.kbd', {}, ']'), ' shot · ', h('span.kbd', {}, 'N'), ' note'), loadEl)),
    h('div.card.shotInfo', {}, shotEl, h('div.noteBox', {}, h('h3', {}, 'Note at this moment'), noteText,
      h('div.row', {}, h('button.btn.primary', { onclick: addNote }, 'Save note'), h('span.faint', { style: { fontSize: '12px' } }, 'Claude reads these from NOTES.md'))))));
  // the iframe lives outside the page (so it survives navigation) and is laid over the screen box every frame
  const place = () => {
    const r = screen.getBoundingClientRect(), m = main.getBoundingClientRect();
    const clip = [Math.max(0, m.top - r.top), Math.max(0, r.right - m.right), Math.max(0, r.bottom - m.bottom), Math.max(0, m.left - r.left)];
    Object.assign(frame.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px',
      clipPath: `inset(${clip.map((v) => v + 'px').join(' ')} round 8px)`, visibility: 'visible' });
  };
  let lastShot = null, raf;
  const tick = () => {
    if (!document.fullscreenElement) place();
    const st = E()?.state?.();
    if (st && st.ready) {
      if (engine.loadedIn == null) engine.loadedIn = (performance.now() - engine.started) / 1000;
      loadEl.textContent = `loaded in ${engine.loadedIn.toFixed(1)} s`;
      head.style.left = W(st.t); tcEl.textContent = tc(st.t); playBtn.textContent = st.playing ? '❚❚ Pause' : '▶ Play';
      if (st.shot !== lastShot) {
        lastShot = st.shot; const x = s.shots.find((y) => y.id === st.shot);
        track.querySelectorAll('.shot').forEach((el) => el.classList.toggle('cur', el.dataset.id === st.shot));
        if (x) {
          const vo = s.captions.filter(([a, b]) => a < x.t1 && b > x.t0).map((c) => c[2]).join(' ');
          shotEl.replaceChildren(h('div.eyebrow', {}, `Shot ${x.id} · ${fmtT(x.t0)}–${fmtT(x.t1)}`), h('h2', {}, x.name),
            h('div.lens', {}, x.dolly ? `dolly zoom · f/${x.f}` : `${x.mm[0]}${x.mm[1] !== x.mm[0] ? '→' + x.mm[1] : ''} mm · f/${x.f}`),
            vo ? h('p.vo', {}, vo) : null, h('p.muted', { style: { margin: 0 } }, x.why));
        }
      }
    } else { tcEl.textContent = `loading… ${Math.floor((performance.now() - engine.started) / 1000)} s`; loadEl.textContent = ''; }
    raf = requestAnimationFrame(tick);
  };
  const key = (e) => {
    if (/TEXTAREA|INPUT|SELECT/.test(document.activeElement?.tagName)) return;
    const st = E()?.state(); if (!st) return;
    if (e.key === ' ') { e.preventDefault(); E().play(); } else if (e.key === 'ArrowLeft') seek(st.t - 1 / 24); else if (e.key === 'ArrowRight') seek(st.t + 1 / 24);
    else if (e.key === '[') shotJump(-1); else if (e.key === ']') shotJump(1); else if (e.key.toLowerCase() === 'n') { e.preventDefault(); noteText.focus(); }
  };
  tick();
  addEventListener('keydown', key);
  engine.key = key;
  E()?.active?.(true);
  view.leave = () => { cancelAnimationFrame(raf); removeEventListener('keydown', key); hideEngine(); };
  view.onReload = (d) => {
    const t = E()?.state()?.t || 0; toast(`Engine updated (${d.why}). Reloading the player.`);
    reloadEngine(); seekWhenReady(t);
  };
}

function Board(s, body) {
  const png = `deliver/board_${s.id}.png`;
  const lastExport = h('a.btn.ghost', { href: fileURL(png), target: '_blank', hidden: true }, 'Open PNG');
  const showLast = () => fetch(fileURL(png), { method: 'HEAD' }).then((r) => { lastExport.hidden = !r.ok; if (r.ok) lastExport.href = `${fileURL(png)}?${Date.now()}`; }).catch(() => {});
  const intro = EXPORT
    ? h('p.muted', { style: { margin: '6px 0 2px' } }, `Board · ${s.shots.length} shots · one engine frame per shot, 60% through it · ${new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}`)
    : h('div.row', { style: { margin: '18px 0' } }, h('p.muted.grow', { style: { margin: 0 } }, 'One engine frame per shot, taken 60% through it. Click a frame to open it in the player.'),
      lastExport,
      h('button.btn', { title: `The whole board as one image: ${png}`, onclick: run(async () => { await api('/api/jobs', { kind: 'board', scene: s.id }); toast(`Exporting the board to ${png}. Progress in Renders & jobs.`); }) }, 'Export PNG'),
      h('button.btn.primary', { onclick: run(async () => { await api('/api/jobs', { kind: 'stills', scene: s.id }); toast('Queued: board stills. Progress in Renders & jobs.'); }) }, 'Render board stills'));
  const draw = () => body.replaceChildren(intro,
    h('div.board', { style: EXPORT ? { gridTemplateColumns: `repeat(${s.shots.length <= 9 ? 3 : 4}, minmax(0, 1fr))` } : {} }, s.shots.map((x) => {
      const still = stillFor(s, x); const vo = s.captions.filter(([a, b]) => a < x.t1 && b > x.t0).map((c) => c[2]).join(' ');
      return h('div.s', {}, h('div.img', { style: still ? { backgroundImage: `url(${fileURL(still)}?${Date.now() >> 14})` } : {}, onclick: () => { location.hash = `#/scene/${s.id}/player`; setTimeout(() => $('iframe')?.contentWindow?.studio?.seek(x.t0 + 0.6 * (x.t1 - x.t0)), 2500); } }, still ? '' : 'no still yet'),
        h('div.slate', {}, h('span', {}, h('b', {}, x.id), ` · ${fmtT(x.t0)}–${fmtT(x.t1)}`), h('span', {}, x.dolly ? 'dolly zoom' : `${x.mm[0]}${x.mm[1] !== x.mm[0] ? '→' + x.mm[1] : ''} mm`, ` · f/${x.f}`)),
        h('h2', {}, x.name), vo ? h('p.vo', {}, vo) : null, h('p', {}, x.why));
    })));
  draw(); showLast();
  view.onProject = () => { const n = S.project.scenes.find((x) => x.id === s.id); if (n) { s = n; draw(); } };
  view.onJob = (j) => { if (j.kind === 'board' && j.scene === s.id && j.state === 'done') showLast(); };
}

function Notes(s, body) {
  const draw = () => body.replaceChildren(h('div', { style: { marginTop: '18px' } },
    s.notes.length ? h('div.list', {}, s.notes.slice().reverse().map((n) => h('div', {},
      h('input', { type: 'checkbox', checked: n.done, 'aria-label': 'Done', onchange: run(async (e) => { s.notes = await api('/api/notes/toggle', { scene: s.id, line: n.line, done: e.target.checked }); draw(); }) }),
      h('div.main', {}, h('div', { style: n.done ? { textDecoration: 'line-through', color: 'var(--faint)' } : {} }, n.text), h('div.meta', {}, `shot ${n.shot} · ${n.t} s · ${n.when}`)),
      h('a.btn.small', { href: `#/scene/${s.id}/player`, onclick: () => setTimeout(() => $('iframe')?.contentWindow?.studio?.seek(n.t), 2500) }, 'Watch'))))
      : h('div.empty', {}, 'No notes yet. Leave them in the Player while you watch; they land in ', h('code', {}, `${s.folder}/NOTES.md`), ' where Claude picks them up.')));
  draw(); view.onProject = () => { const n = S.project.scenes.find((x) => x.id === s.id); if (n) { s = n; draw(); } };
}

const PRESETS = [['Preview 960×540', 960, 540], ['720p', 1280, 720], ['1080p (delivery)', 1920, 1080], ['1440p', 2560, 1440], ['4K', 3840, 2160]];
function Renders(s, body) {
  const preset = h('select', {}, PRESETS.map(([l, w, hh], i) => h('option', { value: i, selected: i === 2 }, l)));
  const range = h('select', {}, h('option', { value: 'all' }, `Whole scene (${Math.round(s.duration * s.fps)} frames)`), s.shots.map((x) => h('option', { value: `${Math.round(x.t0 * s.fps)}-${Math.round(x.t1 * s.fps) - 1}` }, `Shot ${x.id}: ${x.name}`)));
  const step = h('select', {}, h('option', { value: 1 }, 'Every frame (final)'), h('option', { value: 2 }, 'Every 2nd frame, interpolated (draft)'));
  const take = h('input', { type: 'text', placeholder: 'take name (optional, e.g. final_v3)' });
  const deliver = h('input', { type: 'checkbox', checked: true });
  const subs = h('input', { type: 'checkbox', checked: false });
  const go = run(async () => {
    const [, w, hh] = PRESETS[+preset.value];
    await api('/api/jobs', { kind: 'render', scene: s.id, w, h: hh, frames: range.value === 'all' ? null : range.value, step: +step.value, take: take.value.trim().replace(/[^\w-]/g, '_') || undefined, deliver: deliver.checked, subs: subs.checked });
    toast('Render queued. Watch it in Renders & jobs.');
  });
  const draw = () => body.replaceChildren(h('div.two', { style: { marginTop: '18px' } },
    h('div.card.form', {}, h('h2', {}, 'Render a film'),
      h('label.f', {}, h('span', {}, 'Resolution'), preset), h('label.f', {}, h('span', {}, 'Range'), range), h('label.f', {}, h('span', {}, 'Frames'), step), h('label.f', {}, h('span', {}, 'Take'), take),
      h('label.chk', {}, deliver, 'Copy the MP4s into deliver/ when done'),
      h('label.chk', {}, subs, 'Burn in subtitles (also writes a _subtitled.mp4 and .srt; the clean MP4s stay)'),
      h('p.faint', { style: { margin: 0, fontSize: '12.5px' } }, `Full look (lens, bloom, grade, grain, letterbox). ${s.voiceover ? 'A second MP4 with the voiceover, starting at ' + s.voOffset + ' s.' : 'No voiceover for this scene yet: silent MP4 only.'} A take resumes where it stopped.`),
      h('div.row', {}, h('button.btn.primary', { onclick: go }, 'Queue render'))),
    h('div', { style: { display: 'grid', gap: '12px' } }, h('h3', {}, 'Takes'),
      s.renders.length ? h('div.list', {}, s.renders.map((r) => h('div', { style: { display: 'grid', gap: '8px' } },
        h('div.row', {}, h('b.grow', {}, r.take), h('span.meta', {}, `${r.frames} frames · ${ago(r.mtime)}`), h('button.btn.small', { onclick: run(() => api('/api/open', { path: r.path })) }, 'Show in folder')),
        r.videos.map((v) => h('div', {}, h('div.faint.mono', {}, v.split('/').pop()), h('video', { src: fileURL(v), controls: true, preload: 'metadata', style: { width: '100%', borderRadius: '6px', background: '#000' } }))))))
        : h('div.empty', {}, 'No takes yet. Renders from the Studio go to ', h('code', {}, `renders/${s.id}/<take>/`), '.'))));
  draw(); view.onProject = () => { const n = S.project.scenes.find((x) => x.id === s.id); if (n) { s = n; draw(); } };
}

function Script(s, body) {
  const box = h('div.md', { style: { marginTop: '18px' } }, 'Loading…'); body.replaceChildren(box);
  (async () => {
    for (const f of [`${s.folder}/STORYBOARD.md`, `${s.folder}/README.md`]) {
      try { const r = await api('/api/text?path=' + encodeURIComponent(f)); box.innerHTML = md(r.text); box.prepend(h('div.row', { style: { marginBottom: '10px' } }, h('code.faint', {}, f), h('button.btn.small', { onclick: run(() => api('/api/open', { path: f })) }, 'Show in folder'))); return; } catch { /* next */ }
    }
    box.textContent = 'No storyboard yet.';
  })();
}

// ------------------------------------------------------------------ jobs
function Jobs() {
  let open = S.jobs.find((j) => j.state === 'running')?.id || S.jobs[0]?.id;
  const logEl = h('pre.log');
  const showLog = async (id) => { open = id; logEl.hidden = false; S.logs[id] = (await api('/api/log?id=' + id)).text; logEl.textContent = S.logs[id] || '(no output yet)'; logEl.scrollTop = 1e9; draw(); };
  const quick = h('div.card.form', {}, h('h2', {}, 'Bake lighting'), h('p.muted', { style: { margin: 0 } }, 'Cycles lightmaps for another time of day, on the same set. Needs Blender (see System). About an hour each.'),
    h('div.row', {}, ['day', 'evening', 'sunrise'].map((p) => h('button.btn', { onclick: run(async () => { await api('/api/jobs', { kind: 'bake', scene: 'intro', preset: p }); toast(`Queued: bake ${p}`); }) }, p))));
  const list = h('div');
  const draw = () => list.replaceChildren(S.jobs.length ? h('div.list', {}, S.jobs.map((j) => h('div', { style: { cursor: 'pointer', background: j.id === open ? 'var(--panel2)' : '' }, onclick: () => showLog(j.id) },
    h('div.main', {}, h('div.row', {}, h('span.t.grow', {}, j.title), h('span.chip.' + j.state, {}, j.state)),
      j.state === 'running' ? [h('div.bar', {}, h('i', { style: { width: pct(j) + '%' } })), h('div.meta', { style: { marginTop: '4px' } }, eta(j))] : h('div.meta', {}, `${ago(j.created)}${j.outputs ? ' · ' + j.outputs.map((o) => o.split('/').pop()).join(', ') : ''}${j.error ? ' · ' + j.error : ''}`)),
    (j.state === 'running' || j.state === 'queued') ? h('button.btn.small', { onclick: run(async (e) => { e.stopPropagation(); await api('/api/jobs/cancel', { id: j.id }); }) }, 'Stop') : null)))
    : h('div.empty', {}, 'Nothing queued. Start a render from a scene\'s "Render & export" tab.'));
  draw();
  page(h('div.head', {}, h('div', {}, h('div.eyebrow', {}, 'Queue'), h('h1', {}, 'Renders & jobs'), h('p.sub', {}, 'One job at a time, in order. Logs are kept in studio/.local/logs/.')),
    h('button.btn.ghost', { onclick: run(async () => { S.jobs = await api('/api/jobs/clear', {}); draw(); }) }, 'Clear finished')),
  h('div.two', {}, h('div', { style: { display: 'grid', gap: '14px' } }, list, quick), h('div', { style: { display: 'grid', gap: '8px' } }, h('h3', {}, 'Log'), logEl)));
  logEl.hidden = !open;
  if (open) showLog(open);
  view.onJob = () => draw();
  view.onLog = (d) => { if (d.id === open) { logEl.textContent = S.logs[d.id]; logEl.scrollTop = 1e9; } };
}

// ------------------------------------------------------------------ files
function Files(start) {
  const tree = h('div.tree'); const prev = h('div.preview', {}, h('div.empty', {}, 'Pick a file to preview it.'));
  const openDirs = new Set(JSON.parse(localStorageGet('studio.dirs') || '[]'));
  let sel = null;
  async function node(e) {
    const row = h('div.n', { title: e.path }, e.dir ? (openDirs.has(e.path) ? '▾' : '▸') : '·', h('span', {}, e.name),
      h('span.sz', {}, e.dir ? (e.frames != null ? `${e.frames} frames` : `${e.count ?? ''}`) : size(e.size)));
    const wrap = h('div', {}, row); const kids = h('div.kids');
    if (e.dir) {
      const load = async () => { kids.replaceChildren(...(await Promise.all((await api('/api/files?dir=' + encodeURIComponent(e.path))).slice(0, 400).map(node)))); };
      row.onclick = async () => { if (openDirs.has(e.path)) { openDirs.delete(e.path); kids.remove(); } else { openDirs.add(e.path); await load(); wrap.append(kids); } row.firstChild.textContent = openDirs.has(e.path) ? '▾' : '▸'; localStorageSet('studio.dirs', JSON.stringify([...openDirs])); };
      if (openDirs.has(e.path)) { await load(); wrap.append(kids); }
    } else row.onclick = () => { tree.querySelectorAll('.sel').forEach((x) => x.classList.remove('sel')); row.classList.add('sel'); sel = e; preview(e); };
    return wrap;
  }
  async function preview(e) {
    const ext = e.name.split('.').pop().toLowerCase(), url = fileURL(e.path);
    const top = h('div.row', {}, h('code.grow', {}, e.path), h('span.faint.mono', {}, size(e.size)), h('button.btn.small', { onclick: run(() => api('/api/open', { path: e.path })) }, 'Show in folder'), h('a.btn.small', { href: url, target: '_blank' }, 'Open'));
    let content;
    if (/^(png|jpe?g|webp|svg|gif)$/.test(ext)) content = h('img', { src: url, alt: e.name });
    else if (/^(mp4|webm|mov)$/.test(ext)) content = h('video', { src: url, controls: true });
    else if (/^(wav|mp3|ogg)$/.test(ext)) content = h('audio', { src: url, controls: true });
    else if (ext === 'md') { const r = await api('/api/text?path=' + encodeURIComponent(e.path)); content = h('div.md', { html: md(r.text) }); }
    else if (/^(js|mjs|json|py|sh|txt|log|css|html|bat|command|yml|yaml)$/.test(ext) || e.size < 200000) { const r = await api('/api/text?path=' + encodeURIComponent(e.path)); content = h('pre', {}, r.text); }
    else content = h('p.muted', {}, 'Binary file (', ext, '). Open it in its own app with "Show in folder".');
    prev.replaceChildren(top, content);
  }
  page(h('div.head', {}, h('div', {}, h('div.eyebrow', {}, 'Project files'), h('h1', {}, 'Files'), h('p.sub', {}, 'Everything the film is made of. Read-only here; edit in your editor or let Claude.'))),
    h('div.files', {}, tree, prev));
  (async () => { tree.replaceChildren(...(await Promise.all((await api('/api/files')).map(node)))); })();
  view.onFiles = (d) => { if (sel && d.files.some((f) => f.replace(/\\/g, '/') === sel.path)) preview(sel); };
}
function localStorageGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function localStorageSet(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } }

// ------------------------------------------------------------------ activity: follow Claude
function Activity() {
  const followBox = h('div.card.followBox'); const commits = h('div'); const feedEl = h('div.feed'); const dirty = h('div');
  const drawFollow = async () => {
    if (!S.git) return;
    const sys = S.system || (S.system = await api('/api/system')); const g = S.git; const f = sys.config.follow;
    const toggle = (k) => run(async (e) => { const c = await api('/api/config', { follow: { [k]: e.target.checked } }); S.system.config = c; drawFollow(); });
    followBox.replaceChildren(
      h('div.row', {}, h('div.grow', {}, h('div.eyebrow', {}, 'Follow Claude'), h('h2', {}, g.upstream ? `Watching ${g.upstream}` : `Branch ${g.branch} has no upstream`)),
        h('div', { style: { textAlign: 'right' } }, h('div.big', { style: { color: g.behind ? 'var(--amber)' : 'var(--fg)' } }, g.behind || 0), h('div.faint', { style: { fontSize: '12px' } }, 'new commits'))),
      h('p.muted', { style: { margin: 0 } }, 'When Claude works in the cloud it pushes to this branch. Following fetches it every minute and shows what arrived; pulling brings it into this folder and the player reloads. When Claude works here on your machine, its edits show up live below.'),
      h('div.row', {}, h('label.chk', {}, h('input', { type: 'checkbox', checked: f.enabled, onchange: toggle('enabled') }), 'Follow (fetch every minute)'),
        h('label.chk', {}, h('input', { type: 'checkbox', checked: f.autoPull, onchange: toggle('autoPull') }), 'Pull automatically when it is safe')),
      h('div.row', {}, h('button.btn', { onclick: run(async () => { await api('/api/follow/check', {}); toast('Checked the remote.'); }) }, 'Check now'),
        h('button.btn.primary', { disabled: !g.behind, onclick: run(async () => { await api('/api/jobs', { kind: 'pull', scene: 'intro' }); toast('Pulling…'); }) }, `Pull ${g.behind || ''} now`),
        S.follow ? h('span.faint', { style: { fontSize: '12px' } }, S.follow.ok ? `last checked ${clock(S.follow.at)}` : `fetch failed: ${S.follow.error}`) : null),
      ...(S.incoming.length && g.behind ? [h('div.list', {}, S.incoming.map((c) => h('div', {}, h('code', {}, c.short), h('div.main', {}, h('div.t', {}, c.subject)), h('span.meta', {}, ago(c.at)))))] : []));
    dirty.replaceChildren(g.dirty.length ? h('div', { style: { display: 'grid', gap: '8px' } }, h('h3', {}, `Uncommitted changes · ${g.dirty.length}`),
      h('div.list', {}, g.dirty.slice(0, 40).map((d) => h('div', {}, h('code', {}, d.code), h('div.main', {}, h('div.t.mono', {}, d.file)))))) : '');
    commits.replaceChildren(h('h3', { style: { marginBottom: '8px' } }, `History · ${g.branch}`), h('div.list', {}, g.commits.map((c) => h('div', {},
      h('code', {}, c.short), h('div.main', {}, h('div.t', {}, c.subject), h('div.meta', {}, `${c.author} · ${c.stat}`)), h('span.meta', {}, ago(c.at))))));
  };
  const drawFeed = () => feedEl.replaceChildren(...(S.activity.length ? S.activity.slice(0, 120).map((a) => h('div', {}, h('time', {}, clock(a.at)), h('span.k.' + a.kind), h('span', {}, a.text)))
    : [h('div.faint', { style: { display: 'block' } }, 'Quiet so far. File edits, commits and jobs appear here as they happen.')]));
  page(h('div.head', {}, h('div', {}, h('div.eyebrow', {}, 'Live'), h('h1', {}, 'Claude activity'), h('p.sub', {}, 'What changed, who changed it, and what is still to come.'))),
    h('div.two', {}, h('div', { style: { display: 'grid', gap: '18px' } }, followBox, dirty, commits),
      h('div.card', { style: { display: 'grid', gap: '8px' } }, h('h3', {}, 'Live feed'), feedEl)));
  view.onGit = drawFollow; view.onActivity = drawFeed;
  gitReady.then(() => { drawFollow(); drawFeed(); });
}

// ------------------------------------------------------------------ system
function System() {
  const p = page(h('div.head', {}, h('div', {}, h('div.eyebrow', {}, 'This machine'), h('h1', {}, 'System'), h('p.sub', {}, 'What the Studio found, and its settings.'))), h('div', {}, 'Checking…'));
  (async () => {
    const sys = S.system = await api('/api/system');
    const row = (ok, name, detail, fix) => h('div', {}, h('b', { class: ok ? 'ok' : 'bad', style: { width: '16px' } }, ok ? '✓' : '✗'), h('div.grow', {}, h('div', {}, name), h('div.faint', { style: { fontSize: '12.5px' } }, ok ? detail : fix)));
    const blenderIn = h('input', { type: 'text', value: sys.config.blender || '', placeholder: sys.blender?.path || '/Applications/Blender.app/Contents/MacOS/Blender' });
    const set = (k) => run(async (e) => { S.system.config = await api('/api/config', { [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }); toast('Saved.'); });
    p.lastChild.replaceWith(h('div.two', {},
      h('div.card', {}, h('h3', { style: { marginBottom: '6px' } }, 'Checks'), h('div.checks', {},
        row(true, `Node ${sys.node}`, `${sys.platform} · ${sys.cpus} cores · ${sys.memGB} GB`),
        row(sys.playwright && sys.chromium, 'Chromium for rendering', 'Playwright and its Chromium are installed', 'Run the setup again, or: npx playwright install chromium'),
        row(sys.ffmpeg, 'ffmpeg for encoding MP4s', 'found', 'Run the setup again (it installs ffmpeg-static), or install ffmpeg'),
        row(sys.git, `git · branch ${sys.branch}`, 'found', 'Install git to follow Claude\'s work'),
        row(!!sys.blender, 'Blender (optional: lighting bakes and new set geometry)', sys.blender ? `${sys.blender.version} · ${sys.blender.path}` : '', 'Not found. Only needed to re-bake light or change the set; set its path on the right.'))),
      h('div.card.form', {}, h('h3', {}, 'Settings'),
        h('label.chk', {}, h('input', { type: 'checkbox', checked: sys.config.gpu, onchange: set('gpu') }), 'Render on the GPU (much faster; turn off only if renders come out black)'),
        h('label.chk', {}, h('input', { type: 'checkbox', checked: sys.config.liveReload, onchange: set('liveReload') }), 'Reload the player when engine files change'),
        h('label.f', {}, h('span', {}, 'Blender path'), blenderIn), h('div.row', {}, h('button.btn', { onclick: run(async () => { S.system.config = await api('/api/config', { blender: blenderIn.value.trim() }); System(); }) }, 'Save and re-check')),
        h('p.faint', { style: { margin: 0, fontSize: '12.5px' } }, 'Project folder: ', h('code', {}, sys.root)))));
  })();
}

// ------------------------------------------------------------------ go
await loadAll();
connect();
route();
