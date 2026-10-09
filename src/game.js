import * as THREE from 'three';
import {
  COLS, ROWS, CELL, colX, rowZ, xToCol, zToRow, LAWN_RIGHT, LAWN_LEFT, MOWER_X, HOUSE_X,
  PLANT_TYPES, PLANT_ORDER, PEA_SPEED, PEA_DAMAGE,
} from './constants.js';
import { buildEnvironment, buildMower } from './environment.js';
import { Particles } from './particles.js';
import { Plant, BUILDERS, buildPlantIconModel } from './plants.js';
import { Zombie } from './zombies.js';
import { Sun, Pea } from './sun.js';
import { getLevelDef, WaveManager } from './levels.js';
import { rand, pick, lerp } from './materials.js';

const DEG = Math.PI / 180;

export class Game {
  constructor(canvas, ui, audio) {
    this.canvas = canvas;
    this.ui = ui;
    this.audio = audio;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 220);
    this.env = buildEnvironment(this.scene);
    this.particles = new Particles(this.scene);
    this.clock = new THREE.Clock();

    this.state = 'title';
    this.level = 0;
    this.sun = 0;
    this.grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    this.plants = [];
    this.zombies = [];
    this.peas = [];
    this.suns = [];
    this.mowers = [];
    this.debris = [];
    this.decor = [];
    this.timers = [];
    this.cooldowns = {};
    this.selected = null;
    this.shovel = false;
    this.stats = { kills: 0, planted: 0, sunCollected: 0, wave: 0 };
    this.titleT = 0;
    this.time = 0;

    this.pointer = new THREE.Vector2(-10, -10);
    this.pointerPx = { x: -1000, y: -1000 };
    this.raycaster = new THREE.Raycaster();
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.22);
    this.hoverCell = null;

    this.hoverMesh = new THREE.Mesh(
      new THREE.BoxGeometry(CELL - 0.06, 0.06, CELL - 0.06),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.28, depthWrite: false }),
    );
    this.hoverMesh.position.y = 0.04;
    this.hoverMesh.visible = false;
    this.scene.add(this.hoverMesh);
    this.ghosts = {};
    this.ghost = null;

    this.camPos = new THREE.Vector3(0, 10, 16);
    this.camLook = new THREE.Vector3(0, 0, 0);
    this.camGoal = new THREE.Vector3();
    this.lookGoal = new THREE.Vector3();
    this.shakeAmt = 0;
    this.shakeOff = new THREE.Vector3();

    this.icons = this.renderIcons();
    this.placeDecor();
    this.bindInput();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'playing') this.pause();
    });
  }

  // ---------- Setup ----------
  renderIcons() {
    const r = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
    r.setPixelRatio(1);
    r.setSize(192, 192);
    r.setClearColor(0x000000, 0);
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.15;
    const s = new THREE.Scene();
    s.add(new THREE.HemisphereLight(0xffffff, 0x667755, 1.3));
    const d = new THREE.DirectionalLight(0xfff0d2, 2.4);
    d.position.set(2, 4, 3);
    s.add(d);
    const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    const icons = {};
    const size = new THREE.Vector3(), center = new THREE.Vector3();
    for (const type of PLANT_ORDER) {
      const m = buildPlantIconModel(type);
      s.add(m);
      const box = new THREE.Box3().setFromObject(m);
      box.getSize(size);
      box.getCenter(center);
      const radius = Math.max(size.x, size.y, size.z) * 0.6;
      const dist = radius / Math.tan(15 * DEG);
      cam.position.set(center.x + dist * 0.75, center.y + dist * 0.42, center.z + dist * 0.55);
      cam.lookAt(center);
      r.render(s, cam);
      icons[type] = r.domElement.toDataURL('image/png');
      s.remove(m);
    }
    r.dispose();
    r.forceContextLoss();
    return icons;
  }

  placeDecor() {
    const spots = [['sunflower', 1, 1], ['peashooter', 2, 1], ['wallnut', 3, 2], ['sunflower', 1, 3], ['snowpea', 2, 3], ['repeater', 2, 2], ['sunflower', 0, 2]];
    for (const [type, c, r] of spots) {
      const p = new Plant(this, type, c, r);
      p.age = 1;
      p.mesh.scale.setScalar(p.baseScale);
      this.scene.add(p.mesh);
      this.decor.push(p);
    }
  }

  clearDecor() {
    for (const p of this.decor) this.scene.remove(p.mesh);
    this.decor = [];
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.frameCamera();
  }

  frameCamera() {
    const aspect = this.camera.aspect;
    const vfov = this.camera.fov * DEG;
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * aspect);
    const pitch = 48 * DEG;
    const halfW = 9.4;
    const halfD = 6.1 * Math.sin(pitch) + 1.0;
    const dist = Math.max(halfW / Math.tan(hfov / 2), halfD / Math.tan(vfov / 2));
    this.gameLook = new THREE.Vector3(0.35, 0, -0.75);
    this.gameCam = this.gameLook.clone().add(new THREE.Vector3(0, Math.sin(pitch) * dist, Math.cos(pitch) * dist));
  }

  // ---------- Input ----------
  bindInput() {
    const c = this.canvas;
    c.addEventListener('pointermove', (e) => this.setPointer(e));
    c.addEventListener('pointerdown', (e) => {
      this.setPointer(e);
      this.audio.init();
      this.audio.resume();
      if (e.button === 2) { this.deselect(); return; }
      this.onClick();
    });
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => this.onKey(e));

    this.ui.on('seed', (type) => this.selectSeed(type));
    this.ui.on('shovel', () => this.toggleShovel());
    this.ui.on('pause', () => (this.state === 'playing' ? this.pause() : this.state === 'paused' ? this.resume() : null));
    this.ui.on('mute', () => this.toggleMute());
  }

  setPointer(e) {
    this.pointerPx.x = e.clientX;
    this.pointerPx.y = e.clientY;
    this.pointer.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  }

  onKey(e) {
    if (e.key === 'Escape') {
      if (this.state === 'playing') { if (this.selected || this.shovel) this.deselect(); else this.pause(); }
      else if (this.state === 'paused') this.resume();
      return;
    }
    if (this.state !== 'playing') return;
    if (e.key === 'x' || e.key === 'X') this.toggleShovel();
    if (e.key === 'm' || e.key === 'M') this.toggleMute();
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= 9 && this.def) {
      const type = this.def.plants[n - 1];
      if (type) this.selectSeed(type);
    }
  }

  toggleMute() {
    this.audio.init();
    this.audio.setMuted(!this.audio.muted);
    this.ui.setMuted(this.audio.muted);
  }

  selectSeed(type) {
    if (this.state !== 'playing') return;
    this.audio.init();
    if (this.selected === type) { this.deselect(); return; }
    const def = PLANT_TYPES[type];
    if ((this.cooldowns[type] || 0) > 0) { this.audio.deny(); this.ui.toast('Still recharging…'); return; }
    if (this.sun < def.cost) { this.audio.deny(); this.ui.toast(`Not enough sun — ${def.name} costs ${def.cost}`); return; }
    this.selected = type;
    this.shovel = false;
    this.audio.select();
    this.setGhost(type);
  }

  toggleShovel() {
    if (this.state !== 'playing') return;
    this.shovel = !this.shovel;
    this.selected = null;
    this.setGhost(null);
    this.audio.click();
  }

  deselect() {
    this.selected = null;
    this.shovel = false;
    this.setGhost(null);
  }

  setGhost(type) {
    if (this.ghost) { this.ghost.visible = false; this.ghost = null; }
    if (!type) return;
    if (!this.ghosts[type]) {
      const m = buildPlantIconModel(type);
      m.traverse((o) => {
        if (o.isMesh) {
          o.material = o.material.clone();
          o.material.transparent = true;
          o.material.opacity = 0.5;
          o.material.depthWrite = false;
          o.castShadow = false;
        }
      });
      m.scale.setScalar(1.22);
      this.scene.add(m);
      this.ghosts[type] = m;
    }
    this.ghost = this.ghosts[type];
  }

  cellUnderPointer() {
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const p = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(this.groundPlane, p)) return null;
    const col = xToCol(p.x), row = zToRow(p.z);
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return null;
    return { col, row };
  }

  sunUnderPointer() {
    let best = null, bestD = 46;
    const v = new THREE.Vector3();
    for (const s of this.suns) {
      if (s.collecting) continue;
      v.copy(s.mesh.position).project(this.camera);
      const sx = (v.x + 1) / 2 * window.innerWidth, sy = (1 - v.y) / 2 * window.innerHeight;
      const d = Math.hypot(sx - this.pointerPx.x, sy - this.pointerPx.y);
      if (d < bestD) { bestD = d; best = s; }
    }
    return best;
  }

  onClick() {
    if (this.state !== 'playing') return;
    const sun = this.sunUnderPointer();
    if (sun) { this.collectSun(sun); return; }
    const cell = this.cellUnderPointer();
    if (!cell) { if (this.selected || this.shovel) this.deselect(); return; }
    if (this.shovel) { this.digAt(cell.col, cell.row); return; }
    if (this.selected) { this.tryPlant(this.selected, cell.col, cell.row); return; }
    this.audio.click();
  }

  // ---------- Game flow ----------
  startLevel(n) {
    this.clearBoard();
    this.clearDecor();
    this.level = n;
    this.def = getLevelDef(n);
    this.sun = this.def.startSun;
    this.ui.setSun(this.sun, true);
    this.cooldowns = {};
    this.deselect();
    this.ui.renderSeeds(this.def.plants, this.icons, this.def.newPlants);
    this.ui.setLevel(n);
    this.ui.setWaveLayout(this.def.waves);
    for (let r = 0; r < ROWS; r++) {
      const mesh = buildMower();
      mesh.position.set(MOWER_X, 0, rowZ(r));
      this.scene.add(mesh);
      this.mowers.push({ row: r, mesh, state: 'idle', x: MOWER_X, t: 0 });
    }
    this.waves = new WaveManager(this, this.def);
    this.skySunTimer = 4.5;
    this.stats = { kills: 0, planted: 0, sunCollected: 0, wave: 0 };
    this.timers = [];
    this.time = 0;
    this.state = 'playing';
    this.ui.hideOverlay();
    this.ui.showHud(true);
    this.audio.init();
    this.audio.resume();
    this.audio.levelStart();
    this.audio.startMusic();
    this.banner(n <= 5 ? `Level ${n}` : `Level ${n} · Endless`, 'gold');
    this.after(1.7, () => this.banner('Ready…'));
    this.after(2.5, () => this.banner('Set…'));
    this.after(3.3, () => this.banner('Plant!', 'gold'));
    if (n === 1) {
      this.after(4.6, () => this.ui.showHint('Tip: plant Sunflowers first — sun is your economy ☀', 6000));
      this.after(13, () => this.ui.showHint('Click falling sun to collect it', 5000));
    }
    if (this.def.newPlants.length) {
      this.after(5.2, () => this.ui.showHint(`New seed packet unlocked: ${this.def.newPlants.map((t) => PLANT_TYPES[t].name).join(' & ')}`, 5000));
    }
  }

  clearBoard() {
    for (const p of this.plants) { this.scene.remove(p.mesh); p.mats.forEach((m) => m.dispose()); }
    for (const z of this.zombies) { this.scene.remove(z.mesh); z.mats.forEach((m) => m.dispose()); }
    for (const p of this.peas) this.scene.remove(p.mesh);
    for (const s of this.suns) { this.scene.remove(s.mesh); s.dispose(); }
    for (const m of this.mowers) this.scene.remove(m.mesh);
    for (const d of this.debris) this.scene.remove(d.mesh);
    this.plants = []; this.zombies = []; this.peas = []; this.suns = []; this.mowers = []; this.debris = [];
    this.grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    this.hoverMesh.visible = false;
  }

  after(t, fn) { this.timers.push({ t: this.time + t, fn }); }

  banner(text, kind) { this.ui.banner(text, kind); }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.ui.showPause(() => this.resume(), () => this.startLevel(this.level), () => this.toTitle());
  }
  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.ui.hideOverlay();
    this.audio.resume();
  }

  toTitle() {
    this.clearBoard();
    this.state = 'title';
    this.titleT = 0;
    this.audio.stopMusic();
    this.ui.showHud(false);
    this.placeDecor();
    this.ui.showTitle(() => this.startLevel(1));
  }

  lose(zombie) {
    if (this.state !== 'playing') return;
    this.state = 'gameover';
    this.stats.wave = Math.max(0, this.waves.wave - 1);
    this.deselect();
    this.shake(0.6);
    this.audio.stopMusic();
    this.audio.lose();
    this.banner('The zombies ate your brains!', 'warn');
    this.loserZombie = zombie;
    this.after(2.6, () => this.ui.showGameOver(this.level, this.stats, () => this.startLevel(this.level), () => this.toTitle()));
  }

  winLevel() {
    if (this.state !== 'playing') return;
    this.state = 'levelcomplete';
    this.deselect();
    this.audio.win();
    this.banner('Level complete!', 'gold');
    for (let i = 0; i < 6; i++) {
      this.after(i * 0.25, () => this.particles.burst(new THREE.Vector3(rand(LAWN_LEFT, LAWN_RIGHT), rand(1.5, 3), rand(-3, 3)), {
        count: 18, colors: [0xffd166, 0xff8fb1, 0x9ad8ff, 0xb28dff, 0x8ae16a], speed: 2.5, up: 2, gravity: 2.5, life: 1.6, size: 0.9, drag: 0.97, bounce: false,
      }));
    }
    const next = getLevelDef(this.level + 1);
    this.after(2.2, () => this.ui.showLevelComplete(this.level, this.stats, next, this.icons, () => this.startLevel(this.level + 1)));
  }

  // ---------- Entities ----------
  plantAt(col, row) { return this.grid[row]?.[col] || null; }

  tryPlant(type, col, row) {
    const def = PLANT_TYPES[type];
    if (this.grid[row][col]) { this.audio.deny(); this.ui.toast('There is already a plant here'); return; }
    if ((this.cooldowns[type] || 0) > 0) { this.audio.deny(); this.ui.toast('Still recharging…'); return; }
    if (this.sun < def.cost) { this.audio.deny(); this.ui.toast(`Not enough sun — ${def.name} costs ${def.cost}`); this.deselect(); return; }
    const p = new Plant(this, type, col, row);
    this.scene.add(p.mesh);
    this.grid[row][col] = p;
    this.plants.push(p);
    this.sun -= def.cost;
    this.ui.setSun(this.sun);
    this.cooldowns[type] = def.cooldown;
    this.stats.planted++;
    this.audio.plant();
    if (type === 'cherrybomb') this.audio.fuse();
    this.particles.burst(new THREE.Vector3(p.x, 0.1, p.z), { count: 12, colors: [0x6b4a2e, 0x8a6a4a, 0x58b043], speed: 1.6, up: 2, life: 0.55, size: 0.8 });
    this.deselect();
    this.ui.hideHint();
  }

  digAt(col, row) {
    const p = this.grid[row][col];
    if (!p) { this.audio.deny(); return; }
    this.removePlant(p, 'dug');
    this.audio.dig();
    this.shovel = false;
  }

  removePlant(p, reason) {
    this.scene.remove(p.mesh);
    p.mats.forEach((m) => m.dispose());
    if (this.grid[p.row][p.col] === p) this.grid[p.row][p.col] = null;
    const i = this.plants.indexOf(p);
    if (i >= 0) this.plants.splice(i, 1);
    p.dead = true;
    if (reason === 'eaten' || reason === 'dug') {
      this.particles.burst(new THREE.Vector3(p.x, 0.5, p.z), { count: 14, colors: [0x58b043, 0x3f8c33, 0x6b4a2e], speed: 2, up: 2.5, life: 0.7, size: 0.9 });
    }
  }

  spawnZombie(type, row) {
    const z = new Zombie(this, type, row);
    this.scene.add(z.mesh);
    this.zombies.push(z);
  }

  removeZombie(z) {
    this.scene.remove(z.mesh);
    z.mats.forEach((m) => m.dispose());
    const i = this.zombies.indexOf(z);
    if (i >= 0) this.zombies.splice(i, 1);
  }

  onZombieDeath(z, kind) {
    this.stats.kills++;
    this.audio.zombieDie();
    if (kind === 'shot') {
      this.particles.burst(new THREE.Vector3(z.x, 1.2, z.z), { count: 6, colors: [0xb5c9ad, 0x5b4a3b], speed: 1.2, up: 1.5, life: 0.6, size: 0.7 });
    }
  }

  firstZombieInRow(row, minX, maxX) {
    let best = null;
    for (const z of this.zombies) {
      if (z.dying || z.row !== row) continue;
      if (z.x < minX || z.x > maxX) continue;
      if (!best || z.x < best.x) best = z;
    }
    return best;
  }

  zombieReachedEdge(z) {
    const mower = this.mowers[z.row];
    if (mower && mower.state === 'idle') {
      mower.state = 'running';
      mower.t = 0;
      this.audio.mower();
      this.shake(0.15);
    } else if (z.x < HOUSE_X) {
      this.lose(z);
    }
  }

  spawnPea(x, y, z, kind) {
    const pea = new Pea(x, y, z, kind, zToRow(z));
    this.scene.add(pea.mesh);
    this.peas.push(pea);
    this.audio.shoot();
  }

  spawnSun(x, z, mode) {
    const s = new Sun(this, x, z, mode);
    this.scene.add(s.mesh);
    this.suns.push(s);
    if (mode === 'pop') this.audio.sunPop();
  }

  collectSun(s) {
    s.collect(this.ui.sunTargetNdc(), this.camera);
    this.audio.collect();
    this.particles.burst(s.mesh.position.clone(), { count: 8, colors: [0xffe66d, 0xfff3b0, 0xffd34d], speed: 1.5, up: 1.2, gravity: 2, life: 0.5, size: 0.6, bounce: false });
  }

  addDebris(mesh, vel) {
    this.scene.add(mesh);
    this.debris.push({ mesh, vel, spin: new THREE.Vector3(rand(-6, 6), rand(-4, 4), rand(-6, 6)), t: 0 });
  }

  explode(col, row, radiusCells, dmg, { small = false } = {}) {
    const x = colX(col), z = rowZ(row);
    const pos = new THREE.Vector3(x, 0.5, z);
    for (const zb of this.zombies) {
      if (zb.dying) continue;
      if (Math.abs(zb.row - row) <= radiusCells && Math.abs(zb.x - x) <= radiusCells * CELL + 0.75) zb.takeDamage(dmg, 'explosion');
    }
    const k = small ? 0.6 : 1;
    this.particles.burst(pos, { count: Math.round(44 * k), colors: [0xffd166, 0xff7b3a, 0xe63946, 0xfff3c4], speed: 5 * k, up: 4, life: 0.9, size: 1.7 * k, spread: 1.1 });
    this.particles.burst(pos, { count: Math.round(20 * k), colors: [0x555555, 0x777777, 0x9a9a9a], speed: 2, up: 2.5, gravity: -1.6, life: 1.5, size: 2.4 * k, drag: 0.96, bounce: false });
    if (small) this.particles.burst(pos, { count: 14, colors: [0x6b4a2e, 0xd6a467], speed: 3, up: 3.5, life: 0.8, size: 1 });
    this.particles.flash(pos, { size: small ? 2.2 : 3.6, dur: 0.4 });
    this.particles.flash(pos, { size: small ? 2.6 : 4.6, dur: 0.5, ring: true, color: 0xffb347 });
    this.shake(small ? 0.25 : 0.55);
    this.audio.explode();
    for (let dr = -radiusCells; dr <= radiusCells; dr++) {
      for (let dc = -radiusCells; dc <= radiusCells; dc++) this.env.scorch(row + dr, col + dc);
    }
  }

  shake(a) { this.shakeAmt = Math.max(this.shakeAmt, a); }

  // ---------- Update ----------
  update(dt) {
    this.time += dt;
    this.env.update(dt);
    this.particles.update(dt);
    this.ui.update(dt);

    for (let i = this.timers.length - 1; i >= 0; i--) {
      if (this.time >= this.timers[i].t) { const t = this.timers.splice(i, 1)[0]; t.fn(); }
    }

    if (this.state === 'title') {
      this.titleT += dt;
      for (const p of this.decor) p.update(dt);
      const a = this.titleT * 0.08;
      this.camGoal.set(Math.sin(a) * 15, 6.5 + Math.sin(this.titleT * 0.2) * 0.8, Math.cos(a) * 15 + 3);
      this.lookGoal.set(0, 0.6, 0);
      this.updateCamera(dt, this.titleT < 0.1 ? 1 : 1 - Math.exp(-dt * 2));
      return;
    }

    this.camGoal.copy(this.gameCam);
    this.lookGoal.copy(this.gameLook);
    if (this.state === 'gameover' && this.loserZombie) {
      this.lookGoal.lerp(new THREE.Vector3(this.loserZombie.x, 0.8, this.loserZombie.z), 0.35);
      this.camGoal.lerp(new THREE.Vector3(this.loserZombie.x + 4, 4.5, this.loserZombie.z + 6), 0.35);
    }
    this.updateCamera(dt, 1 - Math.exp(-dt * 2.2));

    if (this.state !== 'playing') {
      for (const s of this.suns) if (s.collecting) s.update(dt, this.camera);
      this.updateDebris(dt);
      return;
    }

    for (const k of Object.keys(this.cooldowns)) {
      if (this.cooldowns[k] > 0) this.cooldowns[k] = Math.max(0, this.cooldowns[k] - dt);
    }
    this.waves.update(dt);

    this.skySunTimer -= dt;
    if (this.skySunTimer <= 0) {
      this.skySunTimer = rand(8.5, 11.5);
      this.spawnSun(colX(Math.floor(rand(0, COLS))) + rand(-0.4, 0.4), rowZ(Math.floor(rand(0, ROWS))) + rand(-0.4, 0.4), 'sky');
    }

    for (const p of this.plants.slice()) p.update(dt);
    for (const z of this.zombies.slice()) z.update(dt);
    this.updatePeas(dt);
    this.updateSuns(dt);
    this.updateMowers(dt);
    this.updateDebris(dt);
    this.updateHover();
    this.ui.updateSeeds(this.sun, this.cooldowns, this.selected, this.shovel);
  }

  updateCamera(dt, k) {
    this.camPos.lerp(this.camGoal, k);
    this.camLook.lerp(this.lookGoal, k);
    this.shakeAmt *= Math.exp(-dt * 5);
    if (this.shakeAmt < 0.002) this.shakeAmt = 0;
    this.shakeOff.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(this.shakeAmt * 0.35);
    this.camera.position.copy(this.camPos).add(this.shakeOff);
    this.camera.lookAt(this.camLook);
  }

  updatePeas(dt) {
    for (let i = this.peas.length - 1; i >= 0; i--) {
      const pea = this.peas[i];
      pea.update(dt, PEA_SPEED);
      let hit = null;
      for (const z of this.zombies) {
        if (z.dying || z.row !== pea.row) continue;
        if (Math.abs(pea.x - (z.x - 0.1)) < 0.32) { if (!hit || z.x < hit.x) hit = z; }
      }
      if (hit) {
        hit.takeDamage(PEA_DAMAGE, 'shot');
        if (pea.kind === 'snow') {
          hit.freeze(10);
          this.audio.snowHit();
          this.particles.burst(pea.mesh.position, { count: 8, colors: [0xcdf1ff, 0x9fe0ff, 0xffffff], speed: 1.6, up: 1.5, gravity: 5, life: 0.5, size: 0.6 });
        } else {
          this.audio.hit();
          this.particles.burst(pea.mesh.position, { count: 7, colors: [0x8be04a, 0x5fb34a, 0xc5f08a], speed: 1.6, up: 1.5, gravity: 6, life: 0.45, size: 0.6 });
        }
        this.scene.remove(pea.mesh);
        this.peas.splice(i, 1);
        continue;
      }
      if (pea.x > LAWN_RIGHT + 3.5) { this.scene.remove(pea.mesh); this.peas.splice(i, 1); }
    }
  }

  updateSuns(dt) {
    for (let i = this.suns.length - 1; i >= 0; i--) {
      const s = this.suns[i];
      s.update(dt, this.camera);
      if (s.done) {
        if (s.arrived) {
          this.sun += s.value;
          this.stats.sunCollected += s.value;
          this.ui.setSun(this.sun);
          this.ui.bumpSun();
        }
        this.scene.remove(s.mesh);
        s.dispose();
        this.suns.splice(i, 1);
      }
    }
  }

  updateMowers(dt) {
    for (const m of this.mowers) {
      if (m.state === 'idle') {
        m.mesh.position.y = 0;
        continue;
      }
      if (m.state !== 'running') continue;
      m.t += dt;
      m.x += 7.5 * dt;
      m.mesh.position.x = m.x;
      m.mesh.position.y = Math.abs(Math.sin(m.t * 30)) * 0.035;
      m.mesh.rotation.z = Math.sin(m.t * 40) * 0.05;
      for (const w of m.mesh.userData.wheels) w.rotation.y -= dt * 30;
      if (Math.random() < dt * 20) {
        this.particles.burst(new THREE.Vector3(m.x - 0.4, 0.4, m.mesh.position.z), { count: 2, colors: [0x9a9a9a, 0xbdbdbd], speed: 0.6, up: 1, gravity: -1, life: 0.7, size: 1.1, bounce: false });
        this.particles.burst(new THREE.Vector3(m.x, 0.1, m.mesh.position.z), { count: 2, colors: [0x8bd35e, 0x5fb34a], speed: 1.5, up: 2, life: 0.5, size: 0.6 });
      }
      for (const z of this.zombies) {
        if (z.dying || z.row !== m.row) continue;
        if (z.x < m.x + 0.6 && z.x > m.x - 1.2) z.takeDamage(9999, 'mower');
      }
      if (m.x > LAWN_RIGHT + 3.5) { m.state = 'gone'; this.scene.remove(m.mesh); }
    }
  }

  updateDebris(dt) {
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const d = this.debris[i];
      d.t += dt;
      d.vel.y -= 12 * dt;
      d.mesh.position.addScaledVector(d.vel, dt);
      if (d.mesh.position.y < 0.12) {
        d.mesh.position.y = 0.12;
        d.vel.set(d.vel.x * 0.5, Math.abs(d.vel.y) * 0.3, d.vel.z * 0.5);
        d.spin.multiplyScalar(0.5);
      }
      d.mesh.rotation.x += d.spin.x * dt;
      d.mesh.rotation.y += d.spin.y * dt;
      d.mesh.rotation.z += d.spin.z * dt;
      if (d.t > 1.6) {
        d.mesh.traverse((o) => { if (o.isMesh) { o.material.transparent = true; o.material.opacity = Math.max(0, 1 - (d.t - 1.6) / 0.6); } });
      }
      if (d.t > 2.3) { this.scene.remove(d.mesh); this.debris.splice(i, 1); }
    }
  }

  updateHover() {
    const active = this.selected || this.shovel;
    const cell = active ? this.cellUnderPointer() : null;
    if (!cell) {
      this.hoverMesh.visible = false;
      if (this.ghost) this.ghost.visible = false;
      return;
    }
    const occupied = !!this.grid[cell.row][cell.col];
    const valid = this.shovel ? occupied : !occupied;
    this.hoverMesh.visible = true;
    this.hoverMesh.position.set(colX(cell.col), 0.04, rowZ(cell.row));
    this.hoverMesh.material.color.setHex(valid ? (this.shovel ? 0xffd34d : 0xffffff) : 0xff5a4e);
    this.hoverMesh.material.opacity = valid ? 0.28 : 0.22;
    if (this.ghost) {
      this.ghost.visible = valid;
      this.ghost.position.set(colX(cell.col), 0, rowZ(cell.row));
    }
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
