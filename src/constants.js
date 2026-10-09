// Lawn grid: 5 rows (z axis, far → near) × 9 columns (x axis, house → street).
export const COLS = 9;
export const ROWS = 5;
export const CELL = 1.7;

export const LAWN_W = COLS * CELL;
export const LAWN_D = ROWS * CELL;
export const LAWN_LEFT = -LAWN_W / 2;
export const LAWN_RIGHT = LAWN_W / 2;
export const LAWN_BACK = -LAWN_D / 2;
export const LAWN_FRONT = LAWN_D / 2;

export const colX = (c) => LAWN_LEFT + (c + 0.5) * CELL;
export const rowZ = (r) => LAWN_BACK + (r + 0.5) * CELL;
export const xToCol = (x) => Math.floor((x - LAWN_LEFT) / CELL);
export const zToRow = (z) => Math.floor((z - LAWN_BACK) / CELL);

export const SPAWN_X = LAWN_RIGHT + 3.4;   // zombies appear on the street
export const MOWER_X = LAWN_LEFT - 0.95;   // lawnmowers wait just off the lawn
export const HOUSE_X = LAWN_LEFT - 1.75;   // a zombie past this point reaches the house

export const SUN_VALUE = 25;
export const PEA_SPEED = 9;
export const PEA_DAMAGE = 1;
export const BITE_DAMAGE = 75;
export const BITE_INTERVAL = 0.9;

export const PLANT_TYPES = {
  sunflower:  { name: 'Sunflower',   cost: 50,  cooldown: 7.5, hp: 300,  desc: 'Gathers sunlight and produces sun every 24 seconds.' },
  peashooter: { name: 'Peashooter',  cost: 100, cooldown: 7.5, hp: 300,  desc: 'Fires peas at the first zombie in its lane.' },
  wallnut:    { name: 'Wall-nut',    cost: 50,  cooldown: 30,  hp: 4000, desc: 'A sturdy, stoic wall that soaks up bites while your shooters work.' },
  snowpea:    { name: 'Snow Pea',    cost: 175, cooldown: 7.5, hp: 300,  desc: 'Frozen peas slow zombies down, giving your lane time to breathe.' },
  cherrybomb: { name: 'Cherry Bomb', cost: 150, cooldown: 50,  hp: 300,  desc: 'Explodes after a short fuse, obliterating every zombie in a 3×3 area.' },
  repeater:   { name: 'Repeater',    cost: 200, cooldown: 7.5, hp: 300,  desc: 'Fires two peas per shot. Twice the peas, twice the fun.' },
  potatomine: { name: 'Potato Mine', cost: 25,  cooldown: 30,  hp: 300,  desc: 'Takes a while to arm, then blows up the first zombie that steps on it.' },
};
export const PLANT_ORDER = ['sunflower', 'peashooter', 'wallnut', 'snowpea', 'cherrybomb', 'repeater', 'potatomine'];

export const ZOMBIE_TYPES = {
  basic:      { name: 'Zombie',            hp: 10, speed: 0.40, cost: 1, weight: 0.62 },
  conehead:   { name: 'Conehead Zombie',   hp: 28, speed: 0.40, cost: 2, weight: 0.28 },
  buckethead: { name: 'Buckethead Zombie', hp: 65, speed: 0.40, cost: 4, weight: 0.10 },
  flag:       { name: 'Flag Zombie',       hp: 10, speed: 0.46, cost: 1, weight: 0 },
};
