import * as THREE from 'three';
import { G } from './materials.js';

// One instanced mesh drives every particle in the game.
export class Particles {
  constructor(scene, max = 500) {
    this.scene = scene;
    this.max = max;
    this.items = [];
    this.flashes = [];
    this.dummy = new THREE.Object3D();
    this.tmpColor = new THREE.Color();

    const material = new THREE.MeshStandardMaterial({ roughness: 0.8, flatShading: true });
    this.mesh = new THREE.InstancedMesh(G.ico(0.08, 0), material, max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    for (let i = 0; i < max; i++) {
      this.dummy.scale.setScalar(0);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
      this.mesh.setColorAt(i, this.tmpColor.setHex(0xffffff));
    }
    this.mesh.count = 0;
    scene.add(this.mesh);
  }

  burst(pos, {
    count = 12, color = 0xffffff, colors = null, speed = 3, up = 2, gravity = 9,
    life = 0.6, size = 1, drag = 0.985, spread = 1, jitter = 0.15, bounce = true,
  } = {}) {
    for (let i = 0; i < count; i++) {
      if (this.items.length >= this.max) return;
      const c = colors ? colors[Math.floor(Math.random() * colors.length)] : color;
      this.items.push({
        p: new THREE.Vector3(
          pos.x + (Math.random() - 0.5) * jitter * 2,
          pos.y + (Math.random() - 0.5) * jitter * 2,
          pos.z + (Math.random() - 0.5) * jitter * 2,
        ),
        v: new THREE.Vector3(
          (Math.random() - 0.5) * 2 * speed * spread,
          up + Math.random() * speed,
          (Math.random() - 0.5) * 2 * speed * spread,
        ),
        life: life * (0.7 + Math.random() * 0.6),
        maxLife: life,
        size: size * (0.6 + Math.random() * 0.8),
        color: new THREE.Color(c),
        gravity, drag, bounce,
        rot: new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6),
        spin: (Math.random() - 0.5) * 10,
      });
    }
  }

  flash(pos, { color = 0xffe08a, size = 1.5, dur = 0.35, ring = false } = {}) {
    const geo = ring ? G.torus(1, 0.08, 6, 24) : G.sphere(1, 12, 10);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    m.position.copy(pos);
    if (ring) m.rotation.x = Math.PI / 2;
    m.scale.setScalar(size * 0.2);
    this.scene.add(m);
    this.flashes.push({ mesh: m, t: 0, dur, size, ring });
  }

  update(dt) {
    const items = this.items;
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      it.life -= dt;
      if (it.life <= 0) { items.splice(i, 1); continue; }
      it.v.y -= it.gravity * dt;
      it.v.multiplyScalar(it.drag);
      it.p.addScaledVector(it.v, dt);
      if (it.bounce && it.p.y < 0.04) {
        it.p.y = 0.04;
        it.v.y *= -0.35;
        it.v.x *= 0.6;
        it.v.z *= 0.6;
      }
      it.rot.x += it.spin * dt;
      it.rot.z += it.spin * 0.7 * dt;
    }
    const d = this.dummy;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const k = Math.min(1, it.life / (it.maxLife * 0.5));
      d.position.copy(it.p);
      d.rotation.copy(it.rot);
      d.scale.setScalar(it.size * k);
      d.updateMatrix();
      this.mesh.setMatrixAt(i, d.matrix);
      this.mesh.setColorAt(i, it.color);
    }
    this.mesh.count = items.length;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;

    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i];
      f.t += dt;
      const k = Math.min(1, f.t / f.dur);
      const e = 1 - Math.pow(1 - k, 2);
      f.mesh.scale.setScalar(f.size * (0.2 + 0.8 * e));
      f.mesh.material.opacity = 0.9 * (1 - k);
      if (k >= 1) {
        this.scene.remove(f.mesh);
        f.mesh.material.dispose();
        this.flashes.splice(i, 1);
      }
    }
  }
}
