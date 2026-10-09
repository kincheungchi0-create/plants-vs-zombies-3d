import * as THREE from 'three';
import { mesh, G, rand } from './materials.js';
import { ZOMBIE_TYPES, COLS, colX, rowZ, xToCol, SPAWN_X, LAWN_LEFT, BITE_DAMAGE, BITE_INTERVAL } from './constants.js';

const ZC = {
  skin: 0xb5c9ad, suit: 0x5b4a3b, pants: 0x3b3744, shirt: 0xd5dbd1, tie: 0xb73a36,
  shoe: 0x2a2623, eye: 0xffffff, pupil: 0x141414, mouth: 0x3a1f1f, teeth: 0xf1efe6,
  cone: 0xf0892b, coneBand: 0xf5f0e8, bucket: 0xa6abb2, bucketDark: 0x7d8289,
  flag: 0xd9453d, pole: 0x8a6a4a, hair: 0x3b3027,
};
const FROZEN = new THREE.Color(0x6fb3ff);

// Builds a zombie facing -x (it walks toward the house on the left).
export function buildZombie(type) {
  const mats = [];
  const nm = (c, o = {}) => {
    const m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, metalness: 0, flatShading: true, ...o });
    m.userData.base = m.color.clone();
    mats.push(m);
    return m;
  };
  const skin = nm(ZC.skin), suit = nm(ZC.suit), pants = nm(ZC.pants), shirt = nm(ZC.shirt);
  const tie = nm(ZC.tie), shoe = nm(ZC.shoe), eye = nm(ZC.eye, { roughness: 0.4 }), pupil = nm(ZC.pupil);
  const mouth = nm(ZC.mouth), teeth = nm(ZC.teeth), hair = nm(ZC.hair);

  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);

  const legs = [];
  for (const s of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(0, 0.8, s * 0.13);
    const upper = mesh(G.box(0.17, 0.4, 0.17), pants);
    upper.position.y = -0.2;
    hip.add(upper);
    const knee = new THREE.Group();
    knee.position.y = -0.4;
    hip.add(knee);
    const lower = mesh(G.box(0.15, 0.36, 0.15), pants);
    lower.position.y = -0.18;
    knee.add(lower);
    const foot = mesh(G.box(0.3, 0.1, 0.17), shoe);
    foot.position.set(-0.07, -0.37, 0);
    knee.add(foot);
    body.add(hip);
    legs.push({ hip, knee });
  }

  const torso = mesh(G.box(0.3, 0.64, 0.48), suit);
  torso.position.y = 1.12;
  body.add(torso);
  const shirtM = mesh(G.box(0.03, 0.5, 0.2), shirt);
  shirtM.position.set(-0.16, 1.16, 0);
  body.add(shirtM);
  const tieM = mesh(G.box(0.03, 0.3, 0.07), tie);
  tieM.position.set(-0.175, 1.14, 0);
  body.add(tieM);
  const collar = mesh(G.box(0.32, 0.06, 0.5), shirt);
  collar.position.y = 1.44;
  body.add(collar);
  // torn hem
  const hem = mesh(G.box(0.31, 0.08, 0.5), nm(0x4a3a2e));
  hem.position.y = 0.82;
  hem.rotation.x = 0.06;
  body.add(hem);

  const arms = [];
  for (const s of [-1, 1]) {
    const shoulder = new THREE.Group();
    shoulder.position.set(0, 1.38, s * 0.31);
    const upper = mesh(G.box(0.14, 0.36, 0.14), suit);
    upper.position.y = -0.18;
    shoulder.add(upper);
    const elbow = new THREE.Group();
    elbow.position.y = -0.36;
    shoulder.add(elbow);
    const lower = mesh(G.box(0.12, 0.3, 0.12), suit);
    lower.position.y = -0.15;
    elbow.add(lower);
    const cuff = mesh(G.box(0.13, 0.05, 0.13), shirt);
    cuff.position.y = -0.3;
    elbow.add(cuff);
    const hand = mesh(G.sphere(0.075, 7, 6), skin);
    hand.position.y = -0.36;
    elbow.add(hand);
    shoulder.rotation.z = -Math.PI / 2 + 0.25;
    body.add(shoulder);
    arms.push({ shoulder, elbow });
  }

  const neck = new THREE.Group();
  neck.position.y = 1.47;
  body.add(neck);
  const head = new THREE.Group();
  head.position.y = 0.26;
  neck.add(head);
  const skull = mesh(G.sphere(0.27, 11, 9), skin);
  skull.scale.set(0.95, 1.05, 0.9);
  head.add(skull);
  for (const [s, r] of [[-1, 0.065], [1, 0.05]]) {
    const e = mesh(G.sphere(r, 8, 6), eye, { shadow: false });
    e.position.set(-0.21, 0.05, s * 0.1);
    head.add(e);
    const p = mesh(G.sphere(r * 0.5, 6, 5), pupil, { shadow: false });
    p.position.set(-0.21 - r * 0.7, 0.05, s * 0.1);
    head.add(p);
  }
  const brow = mesh(G.box(0.08, 0.04, 0.3), hair);
  brow.position.set(-0.2, 0.15, 0);
  brow.rotation.z = -0.2;
  head.add(brow);
  const tuft = mesh(G.box(0.08, 0.16, 0.06), hair);
  tuft.position.set(-0.02, 0.3, 0.06);
  tuft.rotation.z = 0.5;
  head.add(tuft);
  const tuft2 = mesh(G.box(0.06, 0.12, 0.05), hair);
  tuft2.position.set(0.06, 0.29, -0.08);
  tuft2.rotation.z = -0.4;
  head.add(tuft2);
  const upperMouth = mesh(G.box(0.08, 0.06, 0.18), mouth, { shadow: false });
  upperMouth.position.set(-0.23, -0.09, 0);
  head.add(upperMouth);
  const jaw = new THREE.Group();
  jaw.position.set(-0.02, -0.12, 0);
  head.add(jaw);
  const jawM = mesh(G.box(0.26, 0.11, 0.24), skin);
  jawM.position.set(-0.1, -0.07, 0);
  jaw.add(jawM);
  for (const z of [-0.06, 0.04]) {
    const t = mesh(G.box(0.03, 0.05, 0.03), teeth, { shadow: false });
    t.position.set(-0.22, -0.01, z);
    jaw.add(t);
  }

  let accessory = null;
  if (type === 'conehead') {
    accessory = new THREE.Group();
    accessory.position.y = 0.2;
    const coneMat = nm(ZC.cone, { roughness: 0.6 });
    const c = mesh(G.cone(0.21, 0.52, 9), coneMat);
    c.position.y = 0.26;
    accessory.add(c);
    const band = mesh(G.cyl(0.125, 0.15, 0.07, 9), nm(ZC.coneBand));
    band.position.y = 0.3;
    accessory.add(band);
    const base = mesh(G.box(0.36, 0.03, 0.36), coneMat);
    accessory.add(base);
    head.add(accessory);
  } else if (type === 'buckethead') {
    accessory = new THREE.Group();
    accessory.position.y = 0.16;
    const bm = nm(ZC.bucket, { roughness: 0.45, metalness: 0.5 });
    const b = mesh(G.cyl(0.31, 0.26, 0.38, 12), bm);
    b.position.y = 0.19;
    accessory.add(b);
    const rim = mesh(G.torus(0.31, 0.028, 6, 16), nm(ZC.bucketDark, { roughness: 0.45, metalness: 0.5 }));
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.38;
    accessory.add(rim);
    const handle = mesh(G.torus(0.3, 0.02, 5, 14, Math.PI), nm(ZC.bucketDark, { roughness: 0.45, metalness: 0.5 }));
    handle.position.y = 0.38;
    handle.rotation.y = Math.PI / 2;
    handle.rotation.x = 0.4;
    accessory.add(handle);
    head.add(accessory);
  } else if (type === 'flag') {
    const pole = mesh(G.cyl(0.02, 0.02, 1.4, 6), nm(ZC.pole));
    pole.position.set(-0.55, 1.7, 0.32);
    body.add(pole);
    const flag = mesh(G.box(0.5, 0.34, 0.02), nm(ZC.flag, { roughness: 0.7 }));
    flag.position.set(-0.29, 2.2, 0.32);
    body.add(flag);
    const emblem = mesh(G.circle(0.09, 10), nm(0x2d2d2d), { shadow: false });
    emblem.position.set(-0.29, 2.2, 0.332);
    body.add(emblem);
    const emblem2 = mesh(G.circle(0.09, 10), nm(0x2d2d2d), { shadow: false });
    emblem2.position.set(-0.29, 2.2, 0.308);
    emblem2.rotation.y = Math.PI;
    body.add(emblem2);
  }

  return { group: g, parts: { body, legs, arms, neck, head, jaw, accessory }, mats };
}

export class Zombie {
  constructor(game, type, row) {
    this.game = game;
    this.type = type;
    this.def = ZOMBIE_TYPES[type];
    this.row = row;
    this.x = SPAWN_X + rand(0, 1.2);
    this.z = rowZ(row) + rand(-0.22, 0.22);
    this.hp = this.def.hp;
    this.maxHp = this.def.hp;
    this.speed = this.def.speed * rand(0.9, 1.1);
    this.state = 'walk';
    this.target = null;
    this.eatTimer = 0;
    this.frozen = 0;
    this.t = rand(0, 10);
    this.gaitPhase = rand(0, Math.PI * 2);
    this.dying = false;
    this.dieT = 0;
    this.deathKind = null;
    this.flash = 0;
    this.groanTimer = rand(2, 9);
    this.hasAccessory = type === 'conehead' || type === 'buckethead';

    const built = buildZombie(type);
    this.mesh = built.group;
    this.parts = built.parts;
    this.mats = built.mats;
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.scale.setScalar(1.08);
  }

  get alive() { return !this.dying; }

  update(dt) {
    this.t += dt;
    if (this.dying) { this.updateDeath(dt); return; }

    if (this.frozen > 0) {
      this.frozen -= dt;
      if (this.frozen <= 0) this.setTint(false);
    }
    const slow = this.frozen > 0 ? 0.5 : 1;

    if (this.state === 'eat') {
      if (!this.target || this.target.dead) {
        this.state = 'walk';
        this.target = null;
      } else {
        this.eatTimer -= dt * slow;
        if (this.eatTimer <= 0) {
          this.eatTimer = BITE_INTERVAL;
          this.target.takeDamage(BITE_DAMAGE);
          this.game.audio.chomp();
          this.game.particles.burst(new THREE.Vector3(this.x - 0.4, 0.7, this.z), { count: 4, colors: [0x6cc644, 0x4f9d32], speed: 1.2, up: 1.5, gravity: 7, life: 0.5, size: 0.6 });
        }
      }
    }
    if (this.state === 'walk') {
      this.x -= this.speed * slow * dt;
      const col = xToCol(this.x - 0.3);
      if (col >= 0 && col < COLS) {
        const p = this.game.plantAt(col, this.row);
        if (p && !p.dead && this.x - colX(col) <= 0.52) {
          this.state = 'eat';
          this.target = p;
          this.eatTimer = 0.35;
        }
      }
      if (this.x < LAWN_LEFT - 0.2) this.game.zombieReachedEdge(this);
    }

    this.animate(slow);
    this.groanTimer -= dt;
    if (this.groanTimer <= 0) {
      this.groanTimer = rand(7, 16);
      this.game.audio.groan();
    }
    if (this.flash > 0) {
      this.flash -= dt;
      if (this.flash <= 0) this.setFlash(false);
    }
    this.mesh.position.x = this.x;
    this.mesh.position.z = this.z;
  }

  animate(slow) {
    const P = this.parts;
    const w = this.t * 5.6 * slow + this.gaitPhase;
    if (this.state === 'walk') {
      const s = Math.sin(w);
      P.legs[0].hip.rotation.z = s * 0.5;
      P.legs[1].hip.rotation.z = -s * 0.5;
      P.legs[0].knee.rotation.z = Math.max(0, s) * 0.7;
      P.legs[1].knee.rotation.z = Math.max(0, -s) * 0.7;
      P.body.position.y = Math.abs(Math.cos(w)) * 0.06;
      P.body.rotation.z = 0.1 + Math.sin(w * 0.5) * 0.03;
      P.body.rotation.x = Math.sin(w) * 0.04;
      P.arms[0].shoulder.rotation.z = -Math.PI / 2 + 0.25 + Math.sin(w) * 0.15;
      P.arms[1].shoulder.rotation.z = -Math.PI / 2 + 0.25 - Math.sin(w) * 0.15;
      P.arms[0].elbow.rotation.z = 0.15 + Math.sin(w + 1) * 0.1;
      P.arms[1].elbow.rotation.z = 0.15 - Math.sin(w + 1) * 0.1;
      P.neck.rotation.x = Math.sin(w * 0.5) * 0.12;
      P.neck.rotation.z = 0.12 + Math.sin(w) * 0.05;
      P.jaw.rotation.z = 0.15 + Math.sin(w * 0.7) * 0.1;
    } else if (this.state === 'eat') {
      const c = this.t * 11 * slow;
      P.jaw.rotation.z = 0.2 + (Math.sin(c) * 0.5 + 0.5) * 0.5;
      P.neck.rotation.z = 0.28 + Math.sin(c) * 0.08;
      P.neck.rotation.x = 0;
      P.body.rotation.z = 0.16;
      P.body.rotation.x = 0;
      P.body.position.y = 0;
      P.legs[0].hip.rotation.z = 0.12;
      P.legs[1].hip.rotation.z = -0.1;
      P.legs[0].knee.rotation.z = 0.05;
      P.legs[1].knee.rotation.z = 0.05;
      P.arms[0].shoulder.rotation.z = -Math.PI / 2 + 0.05 + Math.sin(c) * 0.08;
      P.arms[1].shoulder.rotation.z = -Math.PI / 2 + 0.1 - Math.sin(c) * 0.08;
    }
  }

  takeDamage(d, kind = 'shot') {
    if (this.dying) return;
    this.hp -= d;
    this.flash = 0.08;
    this.setFlash(true);
    if (this.hasAccessory && this.hp <= 10) this.dropAccessory();
    if (this.hp <= 0) this.die(kind);
  }

  dropAccessory() {
    const a = this.parts.accessory;
    if (!a) return;
    this.hasAccessory = false;
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    a.getWorldPosition(pos);
    a.getWorldQuaternion(quat);
    this.parts.head.remove(a);
    a.position.copy(pos);
    a.quaternion.copy(quat);
    this.game.addDebris(a, new THREE.Vector3(rand(1, 2.5), rand(2.5, 4), rand(-1, 1)));
  }

  freeze(duration = 10) {
    if (this.dying) return;
    const wasFrozen = this.frozen > 0;
    this.frozen = Math.max(this.frozen, duration);
    if (!wasFrozen) { this.setTint(true); this.game.audio.freeze(); }
  }

  setTint(frozen) {
    for (const m of this.mats) {
      m.color.copy(m.userData.base);
      if (frozen) m.color.lerp(FROZEN, 0.55);
    }
  }

  setFlash(on) {
    for (const m of this.mats) {
      m.emissive.setHex(on ? 0xffffff : 0x000000);
      m.emissiveIntensity = on ? 0.5 : 1;
    }
  }

  setOpacity(o) {
    for (const m of this.mats) m.opacity = o;
  }

  die(kind) {
    this.dying = true;
    this.deathKind = kind;
    this.dieT = 0;
    this.state = 'dead';
    this.setFlash(false);
    for (const m of this.mats) { m.transparent = true; m.depthWrite = true; }
    if (kind === 'explosion') {
      for (const m of this.mats) m.color.setHex(0x2a2522);
      this.vel = new THREE.Vector3(rand(-2, 3), rand(5, 7.5), rand(-2.5, 2.5));
      this.spin = new THREE.Vector3(rand(-6, 6), rand(-3, 3), rand(-8, 8));
    } else if (kind === 'mower') {
      this.vel = new THREE.Vector3(rand(1, 2.5), rand(3.5, 5), rand(-1.5, 1.5));
      this.spin = new THREE.Vector3(rand(-4, 4), rand(-2, 2), rand(4, 9));
    }
    this.game.onZombieDeath(this, kind);
  }

  updateDeath(dt) {
    this.dieT += dt;
    const T = this.dieT;
    if (this.deathKind === 'shot') {
      const k = Math.min(1, T / 0.7);
      const e = 1 - Math.pow(1 - k, 3);
      this.mesh.rotation.z = -Math.PI / 2 * e;
      this.parts.arms[0].shoulder.rotation.z = -Math.PI / 2 + 0.25 - e * 0.8;
      this.parts.arms[1].shoulder.rotation.z = -Math.PI / 2 + 0.25 - e * 0.5;
      if (T > 0.55) this.mesh.position.y -= dt * 0.9;
      const op = T > 0.75 ? Math.max(0, 1 - (T - 0.75) / 0.6) : 1;
      this.setOpacity(op);
      if (T > 1.4) this.game.removeZombie(this);
    } else {
      this.vel.y -= 13 * dt;
      this.mesh.position.addScaledVector(this.vel, dt);
      this.mesh.rotation.x += this.spin.x * dt;
      this.mesh.rotation.y += this.spin.y * dt;
      this.mesh.rotation.z += this.spin.z * dt;
      this.x = this.mesh.position.x;
      const op = Math.max(0, 1 - Math.max(0, T - 0.4) / 0.8);
      this.setOpacity(op);
      if (T > 1.25) this.game.removeZombie(this);
    }
  }
}
