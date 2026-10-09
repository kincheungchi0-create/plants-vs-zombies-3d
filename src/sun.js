import * as THREE from 'three';
import { mat, mesh, G, easeOutBack, easeInOut, lerp, rand } from './materials.js';
import { makeGlowTexture } from './environment.js';
import { SUN_VALUE } from './constants.js';

let glowTex = null;
const sunMat = mat(0xffe25a, { emissive: 0xffb000, emissiveIntensity: 0.9, roughness: 0.35, flat: true });
const rayMat = mat(0xffd34d, { emissive: 0xffa000, emissiveIntensity: 0.7, roughness: 0.5 });

export class Sun {
  constructor(game, x, z, mode = 'sky', value = SUN_VALUE) {
    this.game = game;
    this.value = value;
    this.mode = mode;
    this.t = 0;
    this.life = 0;
    this.collecting = false;
    this.done = false;
    this.arrived = false;
    this.baseY = 0.42;
    this.x = x;
    this.z = z;

    const g = new THREE.Group();
    this.core = mesh(G.sphere(0.26, 12, 10), sunMat, { shadow: false });
    g.add(this.core);
    this.rays = new THREE.Group();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const r = mesh(G.cone(0.06, 0.22, 4), rayMat, { shadow: false });
      r.position.set(Math.cos(a) * 0.37, Math.sin(a) * 0.37, 0);
      r.rotation.z = a - Math.PI / 2;
      this.rays.add(r);
    }
    g.add(this.rays);
    if (!glowTex) glowTex = makeGlowTexture();
    this.sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: 0xffd44a, transparent: true, opacity: 0.8,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    this.sprite.scale.set(1.9, 1.9, 1);
    g.add(this.sprite);
    this.mesh = g;

    if (mode === 'sky') {
      g.position.set(x, 12, z);
      this.vy = -1.7;
    } else {
      g.position.set(x, 1.0, z);
      this.vel = new THREE.Vector3(rand(-1.4, 1.4), 2.8, rand(0.3, 1.1));
      this.baseY = 0.42;
    }
    g.scale.setScalar(0.01);
  }

  update(dt, camera) {
    this.t += dt;
    const g = this.mesh;
    if (this.collecting) { this.updateCollect(dt, camera); return; }

    const sc = this.t < 0.35 ? easeOutBack(this.t / 0.35) : 1;
    g.scale.setScalar(Math.max(0.01, sc));

    if (this.mode === 'sky') {
      g.position.y += this.vy * dt;
      g.position.x = this.x + Math.sin(this.t * 1.6) * 0.3;
      if (g.position.y <= this.baseY) { g.position.y = this.baseY; this.mode = 'idle'; }
    } else if (this.mode === 'pop') {
      this.vel.y -= 7.5 * dt;
      g.position.addScaledVector(this.vel, dt);
      if (this.vel.y < 0 && g.position.y <= this.baseY) {
        g.position.y = this.baseY;
        this.mode = 'idle';
        this.x = g.position.x;
        this.z = g.position.z;
      }
    } else {
      this.life += dt;
      g.position.y = this.baseY + Math.sin(this.t * 2.2) * 0.06;
      if (this.life > 8.5) {
        this.sprite.material.opacity = 0.3 + ((Math.sin(this.life * 16) + 1) / 2) * 0.5;
        if (this.life > 10.5) this.done = true;
      }
    }
    this.rays.quaternion.copy(camera.quaternion);
    this.rays.rotateZ(this.t * 0.9);
    this.core.rotation.y += dt * 1.2;
  }

  collect(targetNdc, camera) {
    this.collecting = true;
    this.ct = 0;
    this.startNdc = this.mesh.position.clone().project(camera);
    this.targetNdc = targetNdc;
    this.dist = this.mesh.position.distanceTo(camera.position);
    this.sprite.material.opacity = 0.9;
  }

  updateCollect(dt, camera) {
    this.ct += dt / 0.6;
    const k = Math.min(1, this.ct);
    const e = easeInOut(k);
    const ndc = new THREE.Vector3(lerp(this.startNdc.x, this.targetNdc.x, e), lerp(this.startNdc.y, this.targetNdc.y, e), 0.5);
    const dir = ndc.unproject(camera).sub(camera.position).normalize();
    this.mesh.position.copy(camera.position).addScaledVector(dir, this.dist * (1 - 0.35 * e));
    this.mesh.scale.setScalar(1 - 0.55 * e);
    this.rays.quaternion.copy(camera.quaternion);
    this.rays.rotateZ(this.t * 3);
    if (k >= 1) { this.done = true; this.arrived = true; }
  }

  dispose() {
    this.sprite.material.dispose();
  }
}

// Projectiles: peas and frozen peas.
const peaMat = mat(0x8be04a, { emissive: 0x2f7a16, emissiveIntensity: 0.25, roughness: 0.5 });
const snowMat = mat(0xcdf1ff, { emissive: 0x62c8ff, emissiveIntensity: 0.6, roughness: 0.3 });

export class Pea {
  constructor(x, y, z, kind = 'pea', row = 0) {
    this.kind = kind;
    this.row = row;
    this.x = x;
    this.done = false;
    this.t = 0;
    this.mesh = mesh(G.sphere(0.13, 9, 7), kind === 'snow' ? snowMat : peaMat, { shadow: true });
    this.mesh.position.set(x, y, z);
    if (kind === 'snow') {
      this.mesh.add(mesh(G.ico(0.17, 0), mat(0xeaf9ff, { transparent: true, opacity: 0.45, roughness: 0.2 }), { shadow: false }));
    }
  }
  update(dt, speed) {
    this.t += dt;
    this.x += speed * dt;
    this.mesh.position.x = this.x;
    this.mesh.rotation.z -= dt * 12;
    this.mesh.position.y = 0.76 + Math.sin(this.t * 20) * 0.01;
  }
}
