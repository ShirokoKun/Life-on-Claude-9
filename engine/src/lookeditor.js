// Look editor: hands-on control of a scene's whole picture, saved per scene to look.json (preview and export read it).
//   grade      blacks (lift), gamma, whites (gain), contrast, saturation, temperature, tint, vignette, bloom, halation, grain
//   lights     every live light in the scene: on/off, intensity, colour (and shadow softness)
//   baked      the baked light per area (lightmap groups): intensity
//   glow       practicals and the outside: lamp shades, bulbs, fairy lights, LEDs, screens, city, sky: intensity, colour
//   ambient    the night fill: intensity, sky and ground colour
// Values are relative to the scene as authored (1 = as designed; colours replace). Versions: save under a name, load,
// set active. The active version is applied at load, so a render uses exactly what was saved.
import * as THREE from 'three';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { VS } from './post.js';

const GRADE = {          // key: [label, min, max, step, identity]
  lift: ['Blacks (lift)', -0.08, 0.08, 0.002, 0], gamma: ['Mid-tones (gamma)', 0.5, 1.8, 0.01, 1], gain: ['Whites (gain)', 0.5, 1.8, 0.01, 1],
  contrast: ['Contrast', 0.6, 1.6, 0.01, 1], sat: ['Saturation', 0, 2, 0.01, 1], temp: ['Temperature', -1, 1, 0.01, 0], tint: ['Tint', -1, 1, 0.01, 0],
  shadowCol: ['Shadow colour', 0, 0, 0, '#808080'], highCol: ['Highlight colour', 0, 0, 0, '#808080'],
  vignette: ['Vignette', 0, 1.2, 0.01, null], bloom: ['Bloom', 0, 2, 0.01, null], halation: ['Halation', 0, 1, 0.01, null], grain: ['Grain', 0, 0.04, 0.001, null],
};
const GLOW = [            // [group, label, test(material, object)]
  ['shade', 'Lamp shades', (m) => /Lamp Shade/.test(m.name)], ['bulb', 'Bulbs', (m) => /Lamp_Bulb/.test(m.name)],
  ['fairy', 'Fairy lights', (m) => /Fairy/.test(m.name)], ['led', 'LEDs and strips', (m) => /LED/.test(m.name)],
  ['screens', 'Screens (glow)', (m) => /Screen/.test(m.name)],
  ['city', 'City lights', (m, o) => /^(Valley_|House_Windows|Facade_Towers|Street_|Aviation_)/.test(o.name)], ['sky', 'Sky', (m, o) => /^Sky_Card/.test(o.name)],
];
const BAKED = { ARCH: 'Walls and floor', ROOM: 'Bed and furniture', DESK: 'Desk area', PROPS: 'Props and plants', WALLN: 'Desk wall', CEIL: 'Ceiling' };

function gradePass() {
  return new ShaderPass({
    uniforms: { tDiffuse: { value: null }, lift: { value: 0 }, gamma: { value: 1 }, gain: { value: 1 }, contrast: { value: 1 }, sat: { value: 1 },
      wb: { value: new THREE.Vector3(1, 1, 1) }, sh: { value: new THREE.Vector3(0.5, 0.5, 0.5) }, hi: { value: new THREE.Vector3(0.5, 0.5, 0.5) },
      aspect: { value: 16 / 9 }, target: { value: 2 } },
    vertexShader: VS,
    fragmentShader: `uniform sampler2D tDiffuse; uniform float lift, gamma, gain, contrast, sat, aspect, target; uniform vec3 wb, sh, hi; varying vec2 vUv;
      void main(){
        vec3 c = texture2D(tDiffuse, vUv).rgb;
        if (abs(vUv.y - 0.5) > aspect / target * 0.5) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }   // keep the letterbox
        c *= wb;
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        c += (sh - 0.5) * 0.25 * (1.0 - smoothstep(0.0, 0.5, l));             // shadow colour
        c += (hi - 0.5) * 0.25 * smoothstep(0.4, 1.0, l);                     // highlight colour
        c = max((c - 0.35) * contrast + 0.35, 0.0);                         // contrast around a low (filmic) pivot
        c = pow(c, vec3(1.0 / gamma)) * gain;                               // mid-tones, then whites
        l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        c = mix(vec3(l), c, sat);
        c = c + lift * (1.0 - c);                                           // blacks last: lift raises, negative crushes
        gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0); }`,
  });
}
const hex = (c) => `#${c.getHexString()}`;
const v3 = (h) => { const c = new THREE.Color(h); return new THREE.Vector3(c.r, c.g, c.b); };

export async function createLookEditor({ scene, root, LM, L, post, renderer, sceneId, url, mount, onChange }) {
  const lampBase = L && L.lampBase;
  // ---- what the scene has, with its authored values (the base every control is relative to)
  const lights = [];
  scene.traverse((o) => {
    if (!o.isLight || o.isAmbientLight) return;
    if (!o.name) o.name = `${o.type.replace('Light', '')} ${lights.filter((l) => l.o.type === o.type).length + 1}`;
    lights.push({ o, i: o.intensity, c: o.color.clone(), r: o.shadow ? o.shadow.radius : 0 });
  });
  const lm = {}, glow = {};
  root.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of [].concat(o.material)) {
      if (m.lightMap) { const g = Object.keys(LM).find((n) => LM[n] === m.lightMap); if (g) (lm[g] ||= []).some((x) => x.m === m) || lm[g].push({ m, k: m.lightMapIntensity }); }
      if (m.emissive && (m.emissiveIntensity > 0)) for (const [g, , test] of GLOW) if (test(m, o)) { (glow[g] ||= []).some((x) => x.m === m) || glow[g].push({ m, k: m.emissiveIntensity, c: m.emissive.clone() }); break; }
    }
  });
  const film = post.film.uniforms, base = { vignette: film.vignette.value, halation: film.halation.value, grain: film.grain.value, bloom: post.bloom.strength };
  let pass = null;
  const ensurePass = () => { if (!pass) { pass = gradePass(); post.composer.addPass(pass); } return pass; };

  // ---- state and file
  let file = { active: null, versions: {} };
  try { const r = await fetch(`${url}?v=${Date.now()}`); if (r.ok) file = { active: null, versions: {}, ...(await r.json()) }; } catch { /* none yet */ }
  const fresh = () => ({ grade: {}, lights: {}, lm: {}, glow: {} });
  let st = (file.active && file.versions[file.active]) ? structuredClone(file.versions[file.active]) : fresh();

  function apply() {
    const g = st.grade, has = Object.keys(g).some((k) => k in GRADE && GRADE[k][4] !== null && g[k] !== undefined && g[k] !== GRADE[k][4]);
    if (has || pass) {
      const p = ensurePass().uniforms;
      for (const k of ['lift', 'gamma', 'gain', 'contrast', 'sat']) p[k].value = g[k] ?? GRADE[k][4];
      const t = g.temp ?? 0, ti = g.tint ?? 0;
      p.wb.value.set(1 + 0.18 * t, 1 - 0.12 * ti, 1 - 0.18 * t);
      p.sh.value.copy(v3(g.shadowCol || '#808080')); p.hi.value.copy(v3(g.highCol || '#808080'));
      p.aspect.value = film.aspect.value; p.target.value = film.target.value;
    }
    film.vignette.value = g.vignette ?? base.vignette; film.halation.value = g.halation ?? base.halation; film.grain.value = g.grain ?? base.grain;
    post.bloom.strength = g.bloom ?? base.bloom;
    for (const l of lights) {
      const s = st.lights[l.o.name] || {};
      l.o.intensity = s.on === false ? 0 : l.i * (s.k ?? 1);
      if (L && l.o === L.lamp) L.lampBase = s.on === false ? 0 : lampBase * (s.k ?? 1);   // the player drives this one per frame
      l.o.color.copy(s.c ? new THREE.Color(s.c) : l.c);
      if (l.o.shadow && s.soft != null) l.o.shadow.radius = s.soft;
    }
    for (const [g2, list] of Object.entries(lm)) for (const x of list) x.m.lightMapIntensity = x.k * (st.lm[g2] ?? 1);
    for (const [g2, list] of Object.entries(glow)) {
      const s = st.glow[g2] || {};
      for (const x of list) { x.m.emissiveIntensity = x.k * (s.k ?? 1); x.m.emissive.copy(s.c ? new THREE.Color(s.c) : x.c); }
    }
    onChange && onChange();
  }
  apply();
  if (!mount) return { apply, state: () => st };

  // ---- the panel
  const el = (tag, attrs = {}, ...kids) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) { if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (v != null) e.setAttribute(k, v); } e.append(...kids); return e; };
  const slider = (label, min, max, step, get, set) => {
    const out = el('output', {}, (+get()).toFixed(step < 0.01 ? 3 : 2));
    const inp = el('input', { type: 'range', min, max, step, value: get(), oninput: (e) => { set(+e.target.value); out.textContent = (+e.target.value).toFixed(step < 0.01 ? 3 : 2); apply(); } });
    return el('div', { class: 'row' }, el('label', {}, label), out, inp);
  };
  const color = (label, get, set) => el('div', { class: 'row' }, el('label', {}, label), el('span'),
    el('input', { type: 'color', value: get(), oninput: (e) => { set(e.target.value); apply(); } }));
  const group = (title, ...rows) => el('details', {}, el('summary', {}, title), ...rows);
  const status = el('div', { class: 'note' }, '');

  function build() {
    const g = st.grade;
    const gradeRows = Object.entries(GRADE).map(([k, [label, min, max, step, id]]) =>
      typeof id === 'string' ? color(label, () => g[k] || id, (v) => { g[k] = v; })
        : slider(label, min, max, step, () => g[k] ?? (id ?? (k === 'bloom' ? base.bloom : base[k])), (v) => { g[k] = v; }));
    const lightRows = lights.map((l) => {
      const s = () => (st.lights[l.o.name] ||= {});
      return el('div', { class: 'le-light' },
        el('label', { class: 't' }, el('input', { type: 'checkbox', ...(st.lights[l.o.name]?.on === false ? {} : { checked: '' }), onchange: (e) => { s().on = e.target.checked; apply(); } }), ` ${l.o.name}`),
        slider('Intensity ×', 0, 4, 0.01, () => st.lights[l.o.name]?.k ?? 1, (v) => { s().k = v; }),
        color('Colour', () => st.lights[l.o.name]?.c || hex(l.c), (v) => { s().c = v; }),
        ...(l.o.castShadow ? [slider('Shadow softness', 0, 20, 0.5, () => st.lights[l.o.name]?.soft ?? l.r, (v) => { s().soft = v; })] : []));
    });
    const bakedRows = Object.keys(lm).map((g2) => slider(`${BAKED[g2] || g2} ×`, 0, 3, 0.01, () => st.lm[g2] ?? 1, (v) => { st.lm[g2] = v; }));
    const glowRows = GLOW.filter(([g2]) => glow[g2]).flatMap(([g2, label]) => {
      const s = () => (st.glow[g2] ||= {});
      return [slider(`${label} ×`, 0, 4, 0.01, () => st.glow[g2]?.k ?? 1, (v) => { s().k = v; }), color(`${label} colour`, () => st.glow[g2]?.c || hex(glow[g2][0].c), (v) => { s().c = v; })];
    });
    const names = Object.keys(file.versions);
    const pick = el('select', {}, el('option', { value: '' }, '— versions —'), ...names.map((n) => el('option', { value: n, ...(n === file.active ? { selected: '' } : {}) }, n + (n === file.active ? ' (active)' : ''))));
    const nameIn = el('input', { type: 'text', placeholder: 'version name, e.g. warm_v2', value: file.active || '' });
    mount.replaceChildren(
      el('div', { class: 'note', style: 'margin-bottom:6px' }, 'Look editor · saved per scene, used by the export'),
      group('Grade', ...gradeRows), group('Lights', ...lightRows), group('Baked light (areas)', ...bakedRows), group('Practicals and outside', ...glowRows),
      el('div', { class: 'chips' },
        el('button', { type: 'button', onclick: () => save(nameIn.value.trim() || 'main') }, 'Save version'),
        el('button', { type: 'button', onclick: () => { if (pick.value) { st = structuredClone(file.versions[pick.value]); file.active = pick.value; apply(); save(pick.value, 'Loaded and set active: '); } } }, 'Load'),
        el('button', { type: 'button', onclick: () => { st = fresh(); apply(); build(); status.textContent = 'Reset to the scene as authored (not saved).'; } }, 'Reset')),
      el('div', { class: 'row' }, nameIn, el('span'), pick), status);
  }
  async function save(name, msg = 'Saved and active: ') {
    if (!/^[\w-]{1,32}$/.test(name)) { status.textContent = 'Name: letters, digits, - and _ only.'; return; }
    file.versions[name] = structuredClone(st); file.active = name;
    try {
      const r = await fetch('/api/look', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scene: sceneId, data: file }) });
      if (!r.ok) throw new Error(await r.text());
      status.textContent = `${msg}${name}. The export renders this version.`;
    } catch (e) { status.textContent = `Not saved: ${String(e.message).slice(0, 100)} (open the player through the Studio).`; }
    build();
  }
  build();
  return { apply, state: () => st };
}
