import { PLANT_TYPES } from './constants.js';

const $ = (sel) => document.querySelector(sel);

export class UI {
  constructor() {
    this.hud = $('#hud');
    this.sunPanel = $('#sun-panel');
    this.sunCount = $('#sun-count');
    this.tray = $('#seed-tray');
    this.shovelBtn = $('#shovel');
    this.levelName = $('#level-name');
    this.waveText = $('#wave-text');
    this.progressFill = $('#progress-fill');
    this.progressFlags = $('#progress-flags');
    this.progressHead = $('#progress-head');
    this.bannerEl = $('#banner');
    this.toastEl = $('#toast');
    this.overlay = $('#overlay');
    this.card = $('#overlay-card');
    this.hint = $('#hint');
    this.pauseBtn = $('#btn-pause');
    this.muteBtn = $('#btn-mute');
    this.canvas = $('#c');

    this.handlers = {};
    this.cards = {};
    this.displayedSun = 0;
    this.targetSun = 0;
    this.bannerTimer = null;
    this.toastTimer = null;
    this.hintTimer = null;

    this.shovelBtn.addEventListener('click', (e) => { e.stopPropagation(); this.emit('shovel'); });
    this.pauseBtn.addEventListener('click', (e) => { e.stopPropagation(); this.emit('pause'); });
    this.muteBtn.addEventListener('click', (e) => { e.stopPropagation(); this.emit('mute'); });
  }

  on(name, fn) { this.handlers[name] = fn; }
  emit(name, ...args) { this.handlers[name]?.(...args); }

  showHud(v) { this.hud.classList.toggle('hidden', !v); }

  // ---- Sun ----
  setSun(n, immediate = false) {
    this.targetSun = n;
    if (immediate) { this.displayedSun = n; this.sunCount.textContent = n; }
  }
  bumpSun() {
    this.sunPanel.classList.remove('bump');
    void this.sunPanel.offsetWidth;
    this.sunPanel.classList.add('bump');
  }
  sunTargetNdc() {
    const r = this.sunCount.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    return { x: (cx / window.innerWidth) * 2 - 1, y: -(cy / window.innerHeight) * 2 + 1 };
  }

  // ---- Seeds ----
  renderSeeds(types, icons, newTypes = []) {
    this.tray.innerHTML = '';
    this.cards = {};
    types.forEach((type, i) => {
      const def = PLANT_TYPES[type];
      const el = document.createElement('div');
      el.className = 'seed';
      el.dataset.type = type;
      el.title = `${def.name} — ${def.desc}`;
      el.innerHTML = `
        <span class="seed-key">${i + 1}</span>
        <img class="seed-icon" src="${icons[type]}" alt="${def.name}" draggable="false" />
        <div class="seed-cost">${def.cost}</div>
        <div class="seed-cd"></div>
        ${newTypes.includes(type) ? '<span class="seed-new">NEW</span>' : ''}`;
      el.addEventListener('click', (e) => { e.stopPropagation(); this.emit('seed', type); });
      this.tray.appendChild(el);
      this.cards[type] = { el, cd: el.querySelector('.seed-cd'), cost: def.cost };
    });
  }

  updateSeeds(sun, cooldowns, selected, shovel) {
    for (const [type, c] of Object.entries(this.cards)) {
      const cdLeft = cooldowns[type] || 0;
      const total = PLANT_TYPES[type].cooldown;
      c.cd.style.height = cdLeft > 0 ? `${(cdLeft / total) * 100}%` : '0%';
      c.el.classList.toggle('cooling', cdLeft > 0);
      c.el.classList.toggle('unaffordable', sun < c.cost);
      c.el.classList.toggle('selected', selected === type);
    }
    this.shovelBtn.classList.toggle('selected', !!shovel);
    this.canvas.classList.toggle('planting', !!selected);
    this.canvas.classList.toggle('shovel', !!shovel);
  }

  // ---- Level / waves ----
  setLevel(n) {
    this.levelName.textContent = n <= 5 ? `Level ${n}` : `Level ${n} · Endless`;
  }
  setWaveLayout(waves) {
    this.progressFlags.innerHTML = '';
    const f = document.createElement('div');
    f.className = 'pflag';
    f.style.left = '100%';
    this.progressFlags.appendChild(f);
    this.progressFill.style.width = '0%';
    this.progressHead.style.left = '0%';
    this.waveText.textContent = `Get ready… ${waves} waves`;
  }
  setWave(wave, waves, progress) {
    this.waveText.textContent = wave >= waves ? 'Final wave!' : `Wave ${wave} of ${waves}`;
    const pct = `${Math.round(progress * 100)}%`;
    this.progressFill.style.width = pct;
    this.progressHead.style.left = pct;
  }
  setMuted(m) { this.muteBtn.classList.toggle('muted', m); }

  // ---- Messages ----
  banner(text, kind = '') {
    const span = this.bannerEl.querySelector('span');
    this.bannerEl.className = '';
    void this.bannerEl.offsetWidth;
    span.textContent = text;
    this.bannerEl.className = `show ${kind}`;
    clearTimeout(this.bannerTimer);
    this.bannerTimer = setTimeout(() => { this.bannerEl.className = ''; }, 2500);
  }
  toast(text, ms = 2200) {
    this.toastEl.textContent = text;
    this.toastEl.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toastEl.classList.remove('show'), ms);
  }
  showHint(text, ms = 5000) {
    this.hint.textContent = text;
    this.hint.classList.add('show');
    clearTimeout(this.hintTimer);
    this.hintTimer = setTimeout(() => this.hint.classList.remove('show'), ms);
  }
  hideHint() { this.hint.classList.remove('show'); }

  // ---- Overlays ----
  showOverlay(html, wire = () => {}) {
    this.card.innerHTML = html;
    this.overlay.classList.add('visible');
    wire(this.card);
  }
  hideOverlay() { this.overlay.classList.remove('visible'); }

  showTitle(onStart) {
    this.showOverlay(`
      <div class="title-logo">Plants <span class="vs">vs.</span> Zombies <span class="three-d">3D</span></div>
      <p class="tagline">Defend your lawn. Collect sun. Plant wisely. Don't let them in.</p>
      <div class="howto">
        <div><b>☀️ Gather sun</b>Click falling sun and the sun your Sunflowers produce.</div>
        <div><b>🌱 Plant</b>Pick a seed packet, then click a lawn tile. Keys 1–7 also work.</div>
        <div><b>🧟 Hold the line</b>If a zombie reaches your door, it's over. Lawnmowers are your last defence.</div>
      </div>
      <button class="btn" id="btn-start">Play</button>
      <p class="credits">A fan-made homage · built with Three.js · no assets, everything is procedural</p>
    `, (card) => card.querySelector('#btn-start').addEventListener('click', onStart));
  }

  showLevelComplete(level, stats, nextDef, icons, onContinue) {
    const unlocks = nextDef.newPlants.map((t) => {
      const d = PLANT_TYPES[t];
      return `<div class="unlock"><img src="${icons[t]}" alt="${d.name}" /><div><span class="tag">NEW PLANT</span><b>${d.name}</b><small>${d.desc}</small></div></div>`;
    }).join('');
    this.showOverlay(`
      <h2 class="overlay-h gold">Level ${level} complete!</h2>
      <p class="overlay-p">The lawn is quiet again. For now.</p>
      <div class="stats">
        <div><b>${stats.kills}</b>zombies stopped</div>
        <div><b>${stats.planted}</b>plants placed</div>
        <div><b>${stats.sunCollected}</b>sun collected</div>
      </div>
      ${unlocks}
      <button class="btn gold" id="btn-continue">Next level</button>
    `, (card) => card.querySelector('#btn-continue').addEventListener('click', onContinue));
  }

  showGameOver(level, stats, onRetry, onMenu) {
    this.showOverlay(`
      <h2 class="overlay-h danger">The zombies ate your brains!</h2>
      <p class="overlay-p">They made it to the door on level ${level}. Regroup, replant, try again.</p>
      <div class="stats">
        <div><b>${stats.kills}</b>zombies stopped</div>
        <div><b>${stats.wave}</b>waves survived</div>
      </div>
      <button class="btn" id="btn-retry">Try again</button>
      <button class="btn secondary" id="btn-menu">Main menu</button>
    `, (card) => {
      card.querySelector('#btn-retry').addEventListener('click', onRetry);
      card.querySelector('#btn-menu').addEventListener('click', onMenu);
    });
  }

  showPause(onResume, onRestart, onMenu) {
    this.showOverlay(`
      <h2 class="overlay-h">Paused</h2>
      <p class="overlay-p">The zombies are patiently waiting. Sort of.</p>
      <button class="btn" id="btn-resume">Resume</button>
      <button class="btn secondary" id="btn-restart">Restart level</button>
      <button class="btn secondary" id="btn-menu">Main menu</button>
    `, (card) => {
      card.querySelector('#btn-resume').addEventListener('click', onResume);
      card.querySelector('#btn-restart').addEventListener('click', onRestart);
      card.querySelector('#btn-menu').addEventListener('click', onMenu);
    });
  }

  update(dt) {
    if (this.displayedSun !== this.targetSun) {
      const diff = this.targetSun - this.displayedSun;
      const step = Math.sign(diff) * Math.max(1, Math.ceil(Math.abs(diff) * Math.min(1, dt * 10)));
      this.displayedSun = Math.abs(step) >= Math.abs(diff) ? this.targetSun : this.displayedSun + step;
      this.sunCount.textContent = this.displayedSun;
    }
  }
}
