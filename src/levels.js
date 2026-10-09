import { ZOMBIE_TYPES, ROWS } from './constants.js';

export function getLevelDef(n) {
  const plants = ['sunflower', 'peashooter'];
  const newPlants = [];
  if (n >= 2) plants.push('wallnut');
  if (n >= 3) plants.push('snowpea', 'cherrybomb');
  if (n >= 4) plants.push('repeater', 'potatomine');
  if (n === 2) newPlants.push('wallnut');
  if (n === 3) newPlants.push('snowpea', 'cherrybomb');
  if (n === 4) newPlants.push('repeater', 'potatomine');

  const types = ['basic'];
  if (n >= 2) types.push('conehead');
  if (n >= 3) types.push('buckethead');

  return {
    n,
    plants,
    newPlants,
    types,
    waves: Math.min(5 + n, 12),
    interval: Math.max(14, 30 - n * 2.5),
    scale: 1 + (n - 1) * 0.42,
    finalMul: 1.6 + Math.min(n, 6) * 0.15,
    startSun: 100 + Math.min(n - 1, 3) * 50,
    prepTime: n === 1 ? 24 : 18,
  };
}

function shuffled(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export class WaveManager {
  constructor(game, def) {
    this.game = game;
    this.def = def;
    this.wave = 0;
    this.timer = def.prepTime;
    this.started = false;
    this.pending = [];
    this.finished = false;
    this.comingShown = false;
    this.hugeShown = false;
    this.sinceWave = 0;
    this.lastRow = -1;
  }

  get progress() {
    return Math.min(1, this.wave / this.def.waves);
  }

  update(dt) {
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const p = this.pending[i];
      p.delay -= dt;
      if (p.delay <= 0) {
        this.game.spawnZombie(p.type, p.row);
        this.pending.splice(i, 1);
      }
    }
    if (this.finished) return;

    this.timer -= dt;
    this.sinceWave += dt;
    const alive = this.game.zombies.filter((z) => !z.dying).length;

    if (!this.started) {
      if (this.timer <= 4.5 && !this.comingShown) {
        this.comingShown = true;
        this.game.banner('The zombies are coming!');
      }
      if (this.timer <= 0) {
        this.started = true;
        this.spawnWave();
      }
      return;
    }

    const allSpawned = this.wave >= this.def.waves;
    if (!allSpawned) {
      const nextIsFinal = this.wave === this.def.waves - 1;
      if (nextIsFinal && !this.hugeShown && this.timer <= 5.5) {
        this.hugeShown = true;
        this.game.banner('A huge wave of zombies is approaching!', 'warn');
        this.game.audio.warn();
      }
      const quiet = alive <= 1 && this.pending.length === 0 && this.sinceWave > 7;
      if (quiet && nextIsFinal && !this.hugeShown) this.timer = Math.min(this.timer, 5.6);
      else if (this.timer <= 0 || (quiet && !nextIsFinal)) this.spawnWave();
    } else if (alive === 0 && this.pending.length === 0) {
      this.finished = true;
      this.game.winLevel();
    }
  }

  spawnWave() {
    this.wave++;
    this.sinceWave = 0;
    this.timer = this.def.interval;
    const final = this.wave === this.def.waves;
    let budget = Math.max(1, Math.round((1 + (this.wave - 1) * 0.75) * this.def.scale));
    let rows = shuffled([0, 1, 2, 3, 4]);
    let i = 0;
    if (final) {
      budget = Math.round(budget * this.def.finalMul) + 1;
      this.game.banner('Final wave!', 'warn');
      this.pending.push({ type: 'flag', row: rows[i++ % ROWS], delay: 0 });
    }
    while (budget > 0) {
      const type = this.pickType(budget);
      budget -= ZOMBIE_TYPES[type].cost;
      if (i > 0 && i % ROWS === 0) rows = shuffled(rows);
      this.pending.push({ type, row: rows[i % ROWS], delay: i * 0.6 + Math.random() * 0.5 });
      i++;
    }
    this.game.ui.setWave(this.wave, this.def.waves, this.progress);
  }

  pickType(budget) {
    const opts = this.def.types.filter((t) => ZOMBIE_TYPES[t].cost <= budget);
    const total = opts.reduce((s, t) => s + ZOMBIE_TYPES[t].weight, 0);
    let r = Math.random() * total;
    for (const t of opts) {
      r -= ZOMBIE_TYPES[t].weight;
      if (r <= 0) return t;
    }
    return opts[0];
  }
}
