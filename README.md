# Plants vs. Zombies 3D

A fan-made, fully procedural 3D lawn-defense game built with [Three.js](https://threejs.org/).
No textures, models or sound files — every plant, zombie, house, tree and sound effect is generated in code.

## Play

Open `index.html` through any static file server (ES modules need `http://`, not `file://`):

```bash
npx serve .
```

Then visit the printed URL. The game is deployed as a static site, so it also runs on GitHub Pages, Vercel, Netlify, etc. with no build step.

## How it plays

- **Collect sun** — click sun that falls from the sky or pops out of your Sunflowers.
- **Plant** — pick a seed packet (or press `1`–`7`), then click a lawn tile. `X` selects the shovel, `Esc` cancels or pauses, `M` mutes.
- **Hold the line** — zombies shamble in from the street. If one reaches your door, it's over. Each lane has one lawnmower as a last resort.
- **Progress** — 4 hand-tuned levels unlock new plants and zombie types, followed by an endless mode that keeps scaling.

| Plant | Cost | Role |
| --- | --- | --- |
| Sunflower | 50 | Produces sun every 24 s |
| Peashooter | 100 | Fires peas down its lane |
| Wall-nut | 50 | 4000 HP wall; cracks as it is eaten |
| Snow Pea | 175 | Frozen peas slow zombies for 10 s |
| Cherry Bomb | 150 | 3×3 explosion after a short fuse |
| Repeater | 200 | Two peas per shot |
| Potato Mine | 25 | Arms in 14 s, then detonates on contact |

Zombies: regular, Conehead (28 HP), Buckethead (65 HP) and the Flag Zombie that leads each level's final wave. Headgear falls off when a zombie is nearly done.

## Tech notes

- Three.js r170 via import map (no bundler, no dependencies to install).
- Stylised flat-shaded low-poly look, PCF soft shadows, ACES tone mapping, gradient sky dome, drifting clouds and butterflies.
- Seed-packet icons are rendered from the real 3D models at startup with an offscreen renderer.
- Particles use a single `InstancedMesh`; audio is a tiny WebAudio synth including a looping waltz for background music.
- Works with mouse or touch; landscape is recommended on phones.

## Project layout

```
index.html        shell + HUD markup
style.css         HUD, overlays, title screen
src/main.js       bootstraps the loop
src/game.js       game state, input, entities, camera
src/environment.js  house, street, fence, trees, sky, lawnmower model
src/plants.js     plant models + behaviours
src/zombies.js    zombie models + behaviours
src/sun.js        sun pickups and projectiles
src/levels.js     level definitions and wave spawner
src/ui.js         DOM HUD and overlays
src/audio.js      procedural sound effects and music
src/particles.js  instanced particle system
```

This is an unofficial homage made for fun. *Plants vs. Zombies* is a trademark of PopCap / Electronic Arts.
