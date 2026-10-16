// Claude's first form (director, round 13): before it is the voxel character, Claude is the SPARK, the warm starburst of
// the scene-4 draft ("Hello, Claude"). As the story goes on it evolves into the character: `evo` 0 is the pure spark,
// toward 1 its rays break into pixels at the tips (the character starting to show through).
// It is a light, not a sticker: the star (deep glow, glow.js), a soft halo in the air, a point light that paints his
// face, and it breathes (scale and glow on a slow pulse) and turns slowly.
import * as THREE from 'three';

function starTexture(pixel) {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'); g.translate(128, 128);
  for (let i = 0; i < 10; i++) {                       // ten rays, alternating long and short (the s04 design)
    const r = i % 2 ? 66 : 108; g.rotate(Math.PI / 5);
    const grd = g.createLinearGradient(0, 14, 0, r); grd.addColorStop(0, '#fff6d8'); grd.addColorStop(0.45, '#ffd25a'); grd.addColorStop(1, '#ff9a3c');
    if (!pixel) { g.strokeStyle = grd; g.lineCap = 'round'; g.lineWidth = 24; g.beginPath(); g.moveTo(0, 16); g.lineTo(0, r); g.stroke(); }
    else {                                             // the rays as stacked pixels, gaps opening toward the tips
      g.fillStyle = grd; const step = 15;
      for (let y = 16, k = 0; y < r; y += step, k++) { const w = 24 - k * 2.2; if (k > 2 && k % 2) continue; g.fillRect(-w / 2, y, w, step - 3); }
    }
  }
  const core = g.createRadialGradient(0, 0, 0, 0, 0, 40); core.addColorStop(0, '#ffffff'); core.addColorStop(0.6, '#fff1c4'); core.addColorStop(1, 'rgba(255,220,150,0)');
  g.fillStyle = core; g.beginPath(); g.arc(0, 0, 40, 0, 7); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function haloTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,0.6)'); gr.addColorStop(0.2, 'rgba(255,255,255,0.22)'); gr.addColorStop(0.55, 'rgba(255,255,255,0.06)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c);
}

export function createSpark() {
  const group = new THREE.Group(); group.name = 'Claude spark'; group.visible = false;
  const mk = (tex) => new THREE.SpriteMaterial({ map: tex, color: new THREE.Color(2.2, 1.9, 1.5), transparent: true, depthWrite: false, toneMapped: true });
  const star = new THREE.Sprite(mk(starTexture(false))); star.userData.glow = 1; group.add(star);
  const pix = new THREE.Sprite(mk(starTexture(true))); pix.userData.glow = 1; group.add(pix);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTexture(), color: 0xffb060, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.renderOrder = 4; group.add(halo);
  const light = new THREE.PointLight(0xffb36b, 0, 1.6, 2); group.add(light);

  function set({ pos, t = 0, size = 0.07, born = 1, evo = 0, glow = 1, lightK = 1 } = {}) {
    group.visible = born > 0.001;
    if (!group.visible) { light.intensity = 0; return; }
    group.position.copy(pos);
    const pop = born < 1 ? 1 + 0.35 * Math.sin(born * Math.PI) : 1;          // a little overshoot as it pops out
    const breath = 1 + 0.07 * Math.sin(t * 2.1) + 0.03 * Math.sin(t * 5.3);   // it breathes
    const s = size * born * pop * breath;
    const e = Math.min(1, Math.max(0, evo));
    star.scale.setScalar(s); pix.scale.setScalar(s * 1.04);
    star.material.rotation = pix.material.rotation = 0.22 * t;
    star.material.opacity = (1 - e) * born; pix.material.opacity = e * born;
    star.visible = e < 0.999; pix.visible = e > 0.001;
    const k = glow * (0.85 + 0.15 * Math.sin(t * 2.1));
    star.material.color.setRGB(2.2 * k, 1.9 * k, 1.5 * k); pix.material.color.copy(star.material.color);
    halo.scale.setScalar(s * 5.5); halo.material.opacity = 0.55 * born * k;
    light.intensity = 1.6 * lightK * born * k; light.distance = 1.6;
  }
  return { group, set, light, halo };
}
