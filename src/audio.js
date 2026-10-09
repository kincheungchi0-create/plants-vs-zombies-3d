// Fully procedural WebAudio: no sound files needed.
const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

// A gentle 3/4 waltz in D minor — the lawn's background loop.
const BPM = 104;
const STEP = 60 / BPM / 2; // eighth-note steps
const BAR = 6;              // eighth notes per 3/4 bar
const MELODY = [
  [0, 74, 2], [2, 77, 1], [3, 76, 1], [4, 74, 2],
  [6, 69, 4],
  [12, 70, 2], [14, 74, 1], [15, 72, 1], [16, 70, 2],
  [18, 69, 4],
  [24, 77, 2], [26, 76, 1], [27, 74, 1], [28, 72, 2],
  [30, 70, 2], [32, 69, 2], [34, 67, 2],
  [36, 69, 3], [39, 65, 1], [40, 64, 2],
  [42, 62, 6],
];
const CHORDS = [
  [50, 53, 57], [50, 53, 57], [46, 50, 53], [45, 49, 52],
  [53, 57, 60], [46, 50, 53], [45, 49, 52], [50, 53, 57],
];
const TOTAL_STEPS = CHORDS.length * BAR;

export class GameAudio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.lastGroan = 0;
    this.musicTimer = null;
  }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.75;
    this.master.connect(ctx.destination);

    this.sfx = ctx.createGain();
    this.sfx.gain.value = 0.9;
    this.sfx.connect(this.master);

    this.music = ctx.createGain();
    this.music.gain.value = 0.42;
    const delay = ctx.createDelay(1.0);
    delay.delayTime.value = 0.34;
    const fb = ctx.createGain();
    fb.gain.value = 0.22;
    const wet = ctx.createGain();
    wet.gain.value = 0.25;
    delay.connect(fb).connect(delay);
    this.music.connect(this.master);
    this.music.connect(delay);
    delay.connect(wet).connect(this.master);

    const len = ctx.sampleRate;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.75, this.ctx.currentTime, 0.02);
  }

  get ready() { return !!this.ctx && !this.muted; }

  tone(freq, { type = 'sine', dur = 0.2, gain = 0.2, attack = 0.005, slide, filter, q, delay = 0, dest } = {}) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    let node = o;
    if (filter) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = filter;
      if (q) f.Q.value = q;
      o.connect(f);
      node = f;
    }
    node.connect(g);
    g.connect(dest || this.sfx);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  noise({ dur = 0.2, gain = 0.2, type = 'lowpass', freq = 1000, slide, q = 0.8, delay = 0, attack = 0.003 } = {}) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t0);
    if (slide) f.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t0 + dur);
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(this.sfx);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  // ---- SFX ----
  click() { this.tone(900, { type: 'square', dur: 0.05, gain: 0.05, slide: 600 }); }
  select() { this.tone(660, { type: 'triangle', dur: 0.08, gain: 0.1 }); this.tone(880, { type: 'triangle', dur: 0.1, gain: 0.08, delay: 0.05 }); }
  deny() { this.tone(220, { type: 'square', dur: 0.12, gain: 0.07, slide: 160, filter: 900 }); }
  shoot() { this.tone(520, { type: 'square', dur: 0.07, gain: 0.07, slide: 200, filter: 1800 }); this.noise({ dur: 0.05, gain: 0.05, freq: 2200, type: 'bandpass' }); }
  hit() { this.noise({ dur: 0.08, gain: 0.14, freq: 1400, slide: 300 }); this.tone(180, { type: 'sine', dur: 0.08, gain: 0.1, slide: 90 }); }
  snowHit() { this.tone(1500, { type: 'sine', dur: 0.12, gain: 0.07, slide: 900 }); this.noise({ dur: 0.1, gain: 0.05, type: 'highpass', freq: 3000 }); }
  plant() { this.tone(160, { type: 'triangle', dur: 0.14, gain: 0.18, slide: 70 }); this.noise({ dur: 0.1, gain: 0.08, freq: 500 }); }
  dig() { this.noise({ dur: 0.18, gain: 0.14, type: 'bandpass', freq: 700, slide: 300, q: 1.2 }); }
  collect() { this.tone(880, { type: 'sine', dur: 0.12, gain: 0.12 }); this.tone(1320, { type: 'sine', dur: 0.22, gain: 0.1, delay: 0.07 }); this.tone(1760, { type: 'triangle', dur: 0.25, gain: 0.04, delay: 0.1 }); }
  sunPop() { this.tone(700, { type: 'triangle', dur: 0.12, gain: 0.07, slide: 1000 }); }
  chomp() { this.noise({ dur: 0.09, gain: 0.16, freq: 600, slide: 200 }); this.tone(110, { type: 'sine', dur: 0.1, gain: 0.1, slide: 60 }); }
  groan() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - this.lastGroan < 1.8) return;
    this.lastGroan = now;
    const f = 80 + Math.random() * 30;
    this.tone(f, { type: 'sawtooth', dur: 0.7, gain: 0.07, slide: f * 0.75, filter: 380, q: 1.5, attack: 0.15 });
    this.tone(f * 1.5, { type: 'triangle', dur: 0.6, gain: 0.03, slide: f, filter: 500, attack: 0.2 });
  }
  zombieDie() { this.tone(140, { type: 'sawtooth', dur: 0.35, gain: 0.06, slide: 50, filter: 500 }); this.noise({ dur: 0.2, gain: 0.06, freq: 400 }); }
  explode() {
    this.noise({ dur: 0.7, gain: 0.5, freq: 3500, slide: 80, q: 0.5 });
    this.tone(70, { type: 'sine', dur: 0.55, gain: 0.5, slide: 28 });
    this.tone(200, { type: 'square', dur: 0.1, gain: 0.1, slide: 60 });
  }
  armed() { this.tone(900, { type: 'square', dur: 0.06, gain: 0.05 }); this.tone(1200, { type: 'square', dur: 0.08, gain: 0.05, delay: 0.09 }); }
  fuse() { this.noise({ dur: 1.1, gain: 0.05, type: 'highpass', freq: 4000, attack: 0.1 }); }
  mower() {
    this.tone(95, { type: 'sawtooth', dur: 1.6, gain: 0.14, slide: 130, filter: 700, attack: 0.05 });
    this.noise({ dur: 1.5, gain: 0.08, freq: 900, slide: 1400, attack: 0.05 });
  }
  warn() {
    this.tone(110, { type: 'sawtooth', dur: 1.4, gain: 0.08, slide: 95, filter: 500, attack: 0.3 });
    this.tone(165, { type: 'sawtooth', dur: 1.4, gain: 0.05, slide: 140, filter: 500, attack: 0.3 });
  }
  freeze() { this.tone(2000, { type: 'sine', dur: 0.25, gain: 0.05, slide: 600 }); }
  lose() {
    [62, 58, 55, 50].forEach((n, i) => this.tone(midi(n), { type: 'triangle', dur: 0.6, gain: 0.14, delay: i * 0.32, filter: 1500 }));
    this.tone(midi(38), { type: 'sawtooth', dur: 1.8, gain: 0.1, delay: 1.2, filter: 300 });
  }
  win() {
    [62, 66, 69, 74, 78, 81, 86].forEach((n, i) => this.tone(midi(n), { type: 'triangle', dur: 0.5, gain: 0.12, delay: i * 0.1, filter: 2500 }));
    this.tone(midi(50), { type: 'sine', dur: 1.4, gain: 0.14, delay: 0.6 });
  }
  levelStart() {
    [62, 69, 74].forEach((n, i) => this.tone(midi(n), { type: 'triangle', dur: 0.35, gain: 0.1, delay: i * 0.12, filter: 2000 }));
  }

  // ---- Music ----
  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.15;
    this.musicTimer = setInterval(() => this.scheduleMusic(), 50);
  }
  stopMusic() {
    if (this.musicTimer) clearInterval(this.musicTimer);
    this.musicTimer = null;
  }
  scheduleMusic() {
    if (!this.ctx) return;
    while (this.nextTime < this.ctx.currentTime + 0.3) {
      this.playStep(this.step % TOTAL_STEPS, this.nextTime);
      this.nextTime += STEP;
      this.step++;
    }
  }
  playStep(s, t) {
    const delay = Math.max(0, t - this.ctx.currentTime);
    const dest = this.music;
    for (const [st, n, len] of MELODY) {
      if (st === s) this.tone(midi(n), { type: 'triangle', dur: STEP * len * 0.95, gain: 0.13, attack: 0.02, filter: 2200, delay, dest });
    }
    const bar = Math.floor(s / BAR), inBar = s % BAR;
    const chord = CHORDS[bar];
    if (inBar === 0) {
      this.tone(midi(chord[0] - 12), { type: 'sine', dur: STEP * 2.2, gain: 0.2, attack: 0.01, delay, dest });
      this.tone(midi(chord[0] - 12), { type: 'triangle', dur: STEP * 2, gain: 0.05, attack: 0.01, filter: 600, delay, dest });
    }
    if (inBar === 2 || inBar === 4) {
      this.tone(midi(chord[1]), { type: 'triangle', dur: STEP * 0.9, gain: 0.05, attack: 0.01, filter: 1500, delay, dest });
      this.tone(midi(chord[2]), { type: 'triangle', dur: STEP * 0.9, gain: 0.05, attack: 0.01, filter: 1500, delay, dest });
    }
  }
}
