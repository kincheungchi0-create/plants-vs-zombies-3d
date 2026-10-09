import * as THREE from 'three';

// Shared, cached materials and geometries so the whole scene stays light.
const matCache = new Map();
const geoCache = new Map();

export function mat(color, opts = {}) {
  const {
    roughness = 0.9, metalness = 0, emissive = 0x000000, emissiveIntensity = 1,
    flat = true, side = THREE.FrontSide, transparent = false, opacity = 1,
  } = opts;
  const key = [color, roughness, metalness, emissive, emissiveIntensity, flat, side, transparent, opacity].join('|');
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color, roughness, metalness, emissive, emissiveIntensity,
      flatShading: flat, side, transparent, opacity,
    });
    matCache.set(key, m);
  }
  return m;
}

function cached(key, make) {
  let g = geoCache.get(key);
  if (!g) { g = make(); geoCache.set(key, g); }
  return g;
}

export const G = {
  sphere: (r, w = 10, h = 8) => cached(`s|${r}|${w}|${h}`, () => new THREE.SphereGeometry(r, w, h)),
  box: (x, y, z) => cached(`b|${x}|${y}|${z}`, () => new THREE.BoxGeometry(x, y, z)),
  cyl: (rt, rb, h, s = 8) => cached(`c|${rt}|${rb}|${h}|${s}`, () => new THREE.CylinderGeometry(rt, rb, h, s)),
  cone: (r, h, s = 8) => cached(`k|${r}|${h}|${s}`, () => new THREE.ConeGeometry(r, h, s)),
  torus: (r, t, rs = 6, ts = 12, arc = Math.PI * 2) => cached(`t|${r}|${t}|${rs}|${ts}|${arc}`, () => new THREE.TorusGeometry(r, t, rs, ts, arc)),
  circle: (r, s = 12) => cached(`o|${r}|${s}`, () => new THREE.CircleGeometry(r, s)),
  plane: (w, h) => cached(`p|${w}|${h}`, () => new THREE.PlaneGeometry(w, h)),
  ico: (r, d = 0) => cached(`i|${r}|${d}`, () => new THREE.IcosahedronGeometry(r, d)),
};

export function mesh(geo, material, { shadow = true, receive = false } = {}) {
  const m = new THREE.Mesh(geo, material);
  m.castShadow = shadow;
  m.receiveShadow = receive;
  return m;
}

// Common face parts shared by plants (facing +x by default; dir = -1 to face -x).
const FACE = {
  white: mat(0xffffff, { roughness: 0.4 }),
  pupil: mat(0x1b1b1b, { roughness: 0.3 }),
  mouth: mat(0x2b1a12),
};

export function addFace(parent, {
  x, y = 0, z = 0, dir = 1, spacing = 0.1, eyeR = 0.045, pupilR = 0.026,
  mouth = 'smile', mouthY = -0.1, mouthR = 0.07, brows = false, browAngle = 0.5,
} = {}) {
  for (const s of [-1, 1]) {
    const e = mesh(G.sphere(eyeR, 8, 6), FACE.white, { shadow: false });
    e.position.set(x, y, z + s * spacing);
    parent.add(e);
    const p = mesh(G.sphere(pupilR, 6, 5), FACE.pupil, { shadow: false });
    p.position.set(x + dir * eyeR * 0.72, y + eyeR * 0.1, z + s * spacing);
    parent.add(p);
    if (brows) {
      const b = mesh(G.box(0.02, 0.022, eyeR * 2.1), FACE.mouth, { shadow: false });
      b.position.set(x + dir * 0.012, y + eyeR + 0.035, z + s * spacing);
      b.rotation.x = s * browAngle;
      parent.add(b);
    }
  }
  if (mouth === 'smile' || mouth === 'frown') {
    const m = mesh(G.torus(mouthR, 0.014, 6, 14, Math.PI), FACE.mouth, { shadow: false });
    m.position.set(x + dir * 0.006, y + mouthY, z);
    m.rotation.set(mouth === 'smile' ? Math.PI : 0, Math.PI / 2, 0);
    parent.add(m);
  } else if (mouth === 'o') {
    const m = mesh(G.sphere(0.04, 6, 5), FACE.mouth, { shadow: false });
    m.position.set(x, y + mouthY, z);
    m.scale.set(0.4, 1.1, 1);
    parent.add(m);
  }
}

export const easeOutBack = (t) => {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
export const easeInOut = (t) => t * t * (3 - 2 * t);
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
