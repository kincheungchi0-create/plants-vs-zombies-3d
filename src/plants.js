import * as THREE from 'three';
import { mat, mesh, G, addFace, easeOutBack, rand } from './materials.js';
import { PLANT_TYPES, COLS, CELL, colX, rowZ, LAWN_RIGHT } from './constants.js';

const M = {
  stem: mat(0x4e9a3a), leaf: mat(0x58b043), leafDark: mat(0x3f8c33),
  pea: mat(0x6cc644), peaDark: mat(0x4f9d32), peaInner: mat(0x1f4d1a),
  snow: mat(0x7cc9ee), snowDark: mat(0x4ea6d6),
  ice: mat(0xeaf9ff, { roughness: 0.25, emissive: 0x7fd4ff, emissiveIntensity: 0.3 }),
  rep: mat(0x3f9a2d), repDark: mat(0x2e7a22),
  petal: mat(0xffc93c, { emissive: 0xffa500, emissiveIntensity: 0.12 }),
  sunface: mat(0x6e4320), sunfaceLight: mat(0x8a5a2f),
  nut: mat(0xb6803f), nutLight: mat(0xd9a964), crack: mat(0x3b2412),
  cherry: mat(0xd93333, { roughness: 0.45 }), cherryStem: mat(0x6a4a2a),
  potato: mat(0xd6a467), soil: mat(0x6b4a2e),
  redLight: mat(0xff2a2a, { emissive: 0xff0000, emissiveIntensity: 1.3 }),
};

function addBaseLeaves(g, y, material = M.leaf) {
  for (const s of [-1, 1]) {
    const leaf = mesh(G.sphere(0.15, 7, 5), material);
    leaf.scale.set(1.0, 0.3, 1.8);
    leaf.position.set(0.05, y, s * 0.2);
    leaf.rotation.x = s * 0.35;
    leaf.rotation.y = s * 0.3;
    g.add(leaf);
  }
}

function buildSunflower() {
  const g = new THREE.Group();
  const stem = mesh(G.cyl(0.055, 0.075, 0.74, 7), M.stem);
  stem.position.y = 0.37;
  g.add(stem);
  addBaseLeaves(g, 0.2);
  const head = new THREE.Group();
  head.position.y = 0.82;
  const face = mesh(G.sphere(0.27, 12, 10), M.sunface);
  face.scale.set(0.6, 1, 1);
  head.add(face);
  const ring = mesh(G.torus(0.19, 0.05, 6, 16), M.sunfaceLight);
  ring.rotation.y = Math.PI / 2;
  ring.position.x = 0.1;
  head.add(ring);
  const petalGeo = G.sphere(0.1, 7, 5);
  const petals = [];
  for (let i = 0; i < 13; i++) {
    const a = (i / 13) * Math.PI * 2;
    const p = mesh(petalGeo, M.petal);
    p.scale.set(0.35, 2.1, 0.9);
    p.position.set(0, Math.sin(a) * 0.36, Math.cos(a) * 0.36);
    p.rotation.x = Math.PI / 2 - a;
    head.add(p);
    petals.push(p);
  }
  addFace(head, { x: 0.165, y: 0.03, spacing: 0.09, mouth: 'smile', mouthY: -0.09, mouthR: 0.065 });
  g.add(head);
  g.userData.head = head;
  g.userData.petals = petals;
  return g;
}

function buildShooter({ headMat, darkMat, headR = 0.3, ice = false, sprouts = 1, snoutLen = 0.36 }) {
  const g = new THREE.Group();
  const stem = mesh(G.cyl(0.05, 0.07, 0.56, 7), M.stem);
  stem.position.y = 0.28;
  g.add(stem);
  addBaseLeaves(g, 0.16);
  const head = new THREE.Group();
  head.position.y = 0.74;
  head.add(mesh(G.sphere(headR, 12, 10), headMat));
  const snout = mesh(G.cyl(0.15, 0.12, snoutLen, 10), headMat);
  snout.rotation.z = -Math.PI / 2;
  snout.position.set(headR * 0.7 + snoutLen / 2, 0.02, 0);
  head.add(snout);
  const lip = mesh(G.torus(0.145, 0.035, 6, 14), darkMat);
  lip.rotation.y = Math.PI / 2;
  lip.position.set(headR * 0.7 + snoutLen, 0.02, 0);
  head.add(lip);
  const inner = mesh(G.circle(0.12, 12), M.peaInner, { shadow: false });
  inner.rotation.y = Math.PI / 2;
  inner.position.set(headR * 0.7 + snoutLen + 0.006, 0.02, 0);
  head.add(inner);
  for (let i = 0; i < sprouts; i++) {
    const s = mesh(G.sphere(0.07, 6, 5), M.leafDark);
    s.scale.set(0.5, 1.7, 0.9);
    s.position.set(-0.06 - i * 0.1, headR + 0.04, i % 2 ? -0.08 : 0.06);
    s.rotation.z = 0.55 + i * 0.3;
    head.add(s);
  }
  if (ice) {
    for (let i = 0; i < 5; i++) {
      const c = mesh(G.cone(0.045, 0.22, 5), M.ice);
      const a = -0.9 + i * 0.45;
      c.position.set(-0.08 + Math.sin(a) * 0.08, headR * 0.95, Math.cos(a) * 0.24 - 0.12);
      c.rotation.z = rand(-0.4, 0.4);
      c.rotation.x = (i - 2) * 0.32;
      head.add(c);
    }
  }
  addFace(head, { x: headR * 0.86, y: 0.11, spacing: 0.11, eyeR: 0.05, pupilR: 0.028, mouth: 'none' });
  g.add(head);
  g.userData.head = head;
  g.userData.snout = snout;
  return g;
}

const buildPeashooter = () => buildShooter({ headMat: M.pea, darkMat: M.peaDark });
const buildSnowPea = () => buildShooter({ headMat: M.snow, darkMat: M.snowDark, ice: true });
const buildRepeater = () => buildShooter({ headMat: M.rep, darkMat: M.repDark, headR: 0.32, sprouts: 2, snoutLen: 0.42 });

function buildWallnut() {
  const g = new THREE.Group();
  const body = mesh(G.sphere(0.42, 12, 10), M.nut);
  body.scale.set(0.85, 1.12, 0.9);
  body.position.y = 0.47;
  g.add(body);
  const patch = mesh(G.sphere(0.3, 10, 8), M.nutLight);
  patch.scale.set(0.35, 1.05, 0.95);
  patch.position.set(0.24, 0.43, 0);
  g.add(patch);
  const faceG = new THREE.Group();
  faceG.position.set(0, 0.52, 0);
  g.add(faceG);
  addFace(faceG, { x: 0.35, y: 0.08, spacing: 0.12, eyeR: 0.06, pupilR: 0.032, mouth: 'frown', mouthY: -0.15, mouthR: 0.06, brows: true, browAngle: 0.45 });
  const cracks = [];
  for (let i = 0; i < 6; i++) {
    const c = mesh(G.box(0.03, 0.26, 0.03), M.crack, { shadow: false });
    const a = (i / 6) * Math.PI * 2 + 0.5;
    c.position.set(Math.cos(a) * 0.33, 0.47 + (i % 2 ? 0.2 : -0.16), Math.sin(a) * 0.36);
    c.rotation.set(rand(-0.6, 0.6), -a, rand(-0.5, 0.5));
    c.visible = false;
    g.add(c);
    cracks.push(c);
  }
  g.userData.cracks = cracks;
  g.userData.body = body;
  g.userData.face = faceG;
  return g;
}

function buildCherryBomb() {
  const g = new THREE.Group();
  const cherries = new THREE.Group();
  g.add(cherries);
  const spots = [[-0.15, 0.3, -0.17], [0.13, 0.3, 0.17]];
  spots.forEach(([x, y, z]) => {
    const c = new THREE.Group();
    c.position.set(x, y, z);
    c.add(mesh(G.sphere(0.28, 12, 10), M.cherry));
    const shine = mesh(G.sphere(0.06, 6, 5), mat(0xffb3b3, { roughness: 0.3 }), { shadow: false });
    shine.position.set(0.12, 0.17, -0.14);
    c.add(shine);
    addFace(c, { x: 0.23, y: 0.05, spacing: 0.1, eyeR: 0.05, pupilR: 0.028, mouth: 'frown', mouthY: -0.1, mouthR: 0.05, brows: true, browAngle: -0.55 });
    const stem = mesh(G.cyl(0.02, 0.025, 0.6, 5), M.cherryStem);
    stem.position.set(-x * 0.55, 0.5, -z * 0.55);
    stem.rotation.z = x > 0 ? 0.35 : -0.35;
    stem.rotation.x = z > 0 ? -0.45 : 0.45;
    c.add(stem);
    cherries.add(c);
  });
  const leaf = mesh(G.sphere(0.1, 7, 5), M.leaf);
  leaf.scale.set(1.7, 0.3, 0.9);
  leaf.position.set(0, 0.9, 0);
  leaf.rotation.z = 0.3;
  g.add(leaf);
  g.userData.cherries = cherries;
  return g;
}

function buildPotatoMine(armed = false) {
  const g = new THREE.Group();
  const mound = mesh(G.sphere(0.3, 10, 7), M.soil);
  mound.scale.set(1.15, 0.42, 1);
  mound.position.y = 0.02;
  g.add(mound);
  const sprout = mesh(G.sphere(0.05, 6, 5), M.leaf);
  sprout.scale.set(0.5, 1.6, 0.5);
  sprout.position.y = 0.16;
  g.add(sprout);
  const potato = new THREE.Group();
  potato.position.y = 0.28;
  const body = mesh(G.sphere(0.3, 11, 9), M.potato);
  body.scale.set(1.1, 0.78, 0.95);
  potato.add(body);
  addFace(potato, { x: 0.28, y: 0.0, spacing: 0.1, eyeR: 0.05, pupilR: 0.03, mouth: 'smile', mouthY: -0.1, mouthR: 0.05 });
  const stalk = mesh(G.cyl(0.015, 0.015, 0.14, 5), mat(0x2b1a12));
  stalk.position.set(-0.05, 0.28, 0);
  potato.add(stalk);
  const light = mesh(G.sphere(0.055, 8, 6), M.redLight, { shadow: false });
  light.position.set(-0.05, 0.37, 0);
  potato.add(light);
  potato.visible = armed;
  sprout.visible = !armed;
  g.add(potato);
  g.userData.potato = potato;
  g.userData.sprout = sprout;
  g.userData.light = light;
  g.userData.mound = mound;
  return g;
}

export const BUILDERS = {
  sunflower: buildSunflower,
  peashooter: buildPeashooter,
  wallnut: buildWallnut,
  snowpea: buildSnowPea,
  cherrybomb: buildCherryBomb,
  repeater: buildRepeater,
  potatomine: buildPotatoMine,
};

export function buildPlantIconModel(type) {
  return type === 'potatomine' ? buildPotatoMine(true) : BUILDERS[type]();
}

// Give a model its own material instances so it can flash / fade independently.
export function privatizeMaterials(root) {
  const mats = [];
  root.traverse((o) => {
    if (o.isMesh) {
      o.material = o.material.clone();
      o.material.userData.baseEmissive = o.material.emissive.clone();
      o.material.userData.baseEmissiveIntensity = o.material.emissiveIntensity;
      mats.push(o.material);
    }
  });
  return mats;
}

export class Plant {
  constructor(game, type, col, row) {
    this.game = game;
    this.type = type;
    this.def = PLANT_TYPES[type];
    this.col = col;
    this.row = row;
    this.x = colX(col);
    this.z = rowZ(row);
    this.hp = this.def.hp;
    this.maxHp = this.def.hp;
    this.dead = false;
    this.t = Math.random() * 10;
    this.age = 0;
    this.hitFlash = 0;
    this.shake = 0;

    this.mesh = BUILDERS[type]();
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = rand(-0.08, 0.08);
    this.baseScale = 1.22;
    this.mesh.scale.setScalar(0.01);
    this.mats = privatizeMaterials(this.mesh);
    this.u = this.mesh.userData;

    this.shootTimer = 0.6;
    this.secondShot = 0;
    this.sunTimer = 7;
    this.fuse = type === 'cherrybomb' ? 1.25 : 0;
    this.armTimer = type === 'potatomine' ? 14 : 0;
    this.armed = false;
    this.crackStage = 0;
  }

  update(dt) {
    this.t += dt;
    this.age += dt;
    // Pop-in
    if (this.age < 0.4) this.mesh.scale.setScalar(Math.max(0.01, easeOutBack(this.age / 0.4)) * this.baseScale);
    else if (this.type !== 'cherrybomb') this.mesh.scale.setScalar(this.baseScale);

    if (this.hitFlash > 0) {
      this.hitFlash -= dt;
      if (this.hitFlash <= 0) this.setFlash(false);
    }
    if (this.shake > 0) {
      this.shake -= dt;
      this.mesh.position.x = this.x + Math.sin(this.t * 60) * 0.03 * this.shake;
    } else {
      this.mesh.position.x = this.x;
    }

    switch (this.type) {
      case 'sunflower': this.updateSunflower(dt); break;
      case 'peashooter':
      case 'snowpea':
      case 'repeater': this.updateShooter(dt); break;
      case 'wallnut': this.updateWallnut(dt); break;
      case 'cherrybomb': this.updateCherry(dt); break;
      case 'potatomine': this.updateMine(dt); break;
    }
  }

  updateSunflower(dt) {
    const h = this.u.head;
    h.rotation.z = Math.sin(this.t * 1.5) * 0.08;
    h.rotation.y = Math.sin(this.t * 0.9) * 0.12;
    h.position.y = 0.82 + Math.sin(this.t * 2) * 0.012;
    this.sunTimer -= dt;
    if (this.sunTimer < 1.5) {
      const k = 1 - this.sunTimer / 1.5;
      const s = 1 + Math.sin(k * Math.PI) * 0.12;
      h.scale.setScalar(s);
      for (const m of this.mats) if (m.emissive.getHex() !== 0) m.emissiveIntensity = 0.12 + k * 0.9;
    } else {
      h.scale.setScalar(1);
    }
    if (this.sunTimer <= 0) {
      this.sunTimer = 24;
      for (const m of this.mats) if (m.userData.baseEmissive) m.emissiveIntensity = m.userData.baseEmissiveIntensity;
      this.game.spawnSun(this.x, this.z, 'pop');
      this.game.particles.burst(new THREE.Vector3(this.x, 0.9, this.z), { count: 8, colors: [0xffe66d, 0xfff3b0], speed: 1.2, up: 1.5, gravity: 3, life: 0.6, size: 0.7 });
    }
  }

  updateShooter(dt) {
    const h = this.u.head;
    h.position.y = 0.74 + Math.sin(this.t * 2.2) * 0.015;
    h.rotation.z = Math.sin(this.t * 1.3) * 0.03;
    const recoil = Math.max(0, this.shootTimer - 1.15) / 0.25;
    h.scale.set(1 - recoil * 0.12, 1 + recoil * 0.1, 1 + recoil * 0.1);
    this.shootTimer -= dt;
    if (this.secondShot > 0) {
      this.secondShot -= dt;
      if (this.secondShot <= 0) this.fire();
    }
    if (this.shootTimer <= 0) {
      const target = this.game.firstZombieInRow(this.row, this.x - 0.4, LAWN_RIGHT + 1.2);
      if (target) {
        this.fire();
        this.shootTimer = 1.4;
        if (this.type === 'repeater') this.secondShot = 0.16;
      } else {
        this.shootTimer = 0.1;
      }
    }
  }

  fire() {
    const kind = this.type === 'snowpea' ? 'snow' : 'pea';
    this.game.spawnPea(this.x + 0.62, 0.76, this.z, kind);
    this.u.head.scale.set(0.88, 1.1, 1.1);
    this.shootTimer = Math.max(this.shootTimer, 1.4);
  }

  updateWallnut(dt) {
    const b = this.u.body;
    const s = 1 + Math.sin(this.t * 1.6) * 0.012;
    b.scale.set(0.85 * s, 1.12 / s, 0.9 * s);
    const frac = this.hp / this.maxHp;
    const stage = frac < 0.33 ? 3 : frac < 0.66 ? 2 : frac < 0.9 ? 1 : 0;
    if (stage !== this.crackStage) {
      this.crackStage = stage;
      this.u.cracks.forEach((c, i) => { c.visible = i < stage * 2; });
    }
  }

  updateCherry(dt) {
    this.fuse -= dt;
    const k = 1 - Math.max(0, this.fuse) / 1.25;
    const s = Math.min(1, this.age / 0.4 >= 1 ? 1 : easeOutBack(this.age / 0.4)) * (1 + k * 0.45);
    this.mesh.scale.setScalar(s * this.baseScale);
    this.mesh.position.x = this.x + Math.sin(this.t * 55) * 0.035 * k;
    this.mesh.position.z = this.z + Math.cos(this.t * 47) * 0.03 * k;
    for (const m of this.mats) {
      if (m.color.r > 0.6 && m.color.g < 0.4) { m.emissive.setHex(0xff2200); m.emissiveIntensity = k * 0.8; }
    }
    if (this.fuse <= 0 && !this.dead) {
      this.dead = true;
      this.game.explode(this.col, this.row, 1, 90);
      this.game.removePlant(this, 'exploded');
    }
  }

  updateMine(dt) {
    if (!this.armed) {
      this.armTimer -= dt;
      this.u.sprout.rotation.z = Math.sin(this.t * 3) * 0.2;
      if (this.armTimer <= 0) {
        this.armed = true;
        this.u.potato.visible = true;
        this.u.sprout.visible = false;
        this.popT = 0;
        this.game.audio.armed();
        this.game.particles.burst(new THREE.Vector3(this.x, 0.2, this.z), { count: 10, colors: [0x6b4a2e, 0x8a6a4a], speed: 1.5, up: 2, life: 0.5, size: 0.8 });
      }
      return;
    }
    this.popT = (this.popT ?? 1) + dt;
    const p = this.u.potato;
    p.scale.setScalar(this.popT < 0.35 ? easeOutBack(this.popT / 0.35) : 1);
    p.position.y = 0.28 + Math.sin(this.t * 2.5) * 0.01;
    this.u.light.material.emissiveIntensity = (Math.sin(this.t * 6) > 0.2) ? 1.3 : 0.2;
    const z = this.game.firstZombieInRow(this.row, this.x - 0.45, this.x + 0.55);
    if (z) {
      this.dead = true;
      this.game.explode(this.col, this.row, 0, 90, { small: true });
      this.game.removePlant(this, 'exploded');
    }
  }

  takeDamage(d) {
    if (this.dead) return;
    this.hp -= d;
    this.hitFlash = 0.1;
    this.shake = 0.25;
    this.setFlash(true);
    if (this.hp <= 0) {
      this.dead = true;
      this.game.removePlant(this, 'eaten');
    }
  }

  setFlash(on) {
    for (const m of this.mats) {
      if (on) { m.emissive.setHex(0xffffff); m.emissiveIntensity = 0.45; }
      else { m.emissive.copy(m.userData.baseEmissive); m.emissiveIntensity = m.userData.baseEmissiveIntensity; }
    }
  }
}
