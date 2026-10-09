import { Game } from './game.js';
import { UI } from './ui.js';
import { GameAudio } from './audio.js';

const canvas = document.getElementById('c');
const ui = new UI();
const audio = new GameAudio();
const game = new Game(canvas, ui, audio);

ui.showTitle(() => {
  audio.init();
  audio.resume();
  game.startLevel(1);
});

// Unlock audio on the first interaction anywhere.
const unlock = () => { audio.init(); audio.resume(); };
window.addEventListener('pointerdown', unlock, { once: true });
window.addEventListener('keydown', unlock, { once: true });

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  game.update(dt);
  game.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

window.__game = game;
