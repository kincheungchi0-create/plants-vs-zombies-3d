import * as THREE from 'three';
import { mat, mesh, G, rand, pick } from './materials.js';
import {
  COLS, ROWS, CELL, LAWN_LEFT, LAWN_RIGHT, LAWN_BACK, LAWN_FRONT, LAWN_D, colX, rowZ,
} from './constants.js';

const C = {
  lawnA: 0x8bd35e, lawnB: 0x79c24f, ground: 0x6fae48, soil: 0x7a5636,
  wall: 0xf3e6ca, wallTrim: 0xe2cfaa, roof: 0xc75b4d, roofDark: 0xa8483c, door: 0x7b4a2f,
  frame: 0xfdfbf5, glass: 0x9ad2f2, step: 0xd4ccbb, chimney: 0xb0574a,
  asphalt: 0x5a5e6b, asphaltLine: 0xf0c75e, sidewalk: 0xdad5c8, curb: 0xc3bdae,
  fence: 0xf7f2e8, hedge: [0x3f9237, 0x4aa341, 0x3a8a33], trunk: 0x8b5a3c,
  foliage: [0x4f9e3e, 0x5fb34a, 0x3f8f36, 0x6cc155], cloud: 0xffffff,
  flower: [0xff8fb1, 0xffffff, 0xb28dff, 0xffd166, 0xff6b6b], mailbox: 0x3b4a6b, lamp: 0x3b3f46,
};

export function buildEnvironment(scene) {
  const env = { clouds: [], trees: [], butterflies: [], tiles: [], scorched: [], t: 0 };

  // ---------- Sky ----------
  const skyMat = new THREE.ShaderMaterial({
    uniforms: {
      topColor: { value: new THREE.Color(0x4c9ff0) },
      midColor: { value: new THREE.Color(0x9fd3ff) },
      bottomColor: { value: new THREE.Color(0xe6f4ff) },
    },
    vertexShader: `
      varying vec3 vWorld;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: `
      uniform vec3 topColor; uniform vec3 midColor; uniform vec3 bottomColor;
      varying vec3 vWorld;
      void main() {
        float h = normalize(vWorld).y;
        vec3 c = h < 0.12
          ? mix(bottomColor, midColor, smoothstep(-0.05, 0.12, h))
          : mix(midColor, topColor, smoothstep(0.12, 0.7, h));
        gl_FragColor = vec4(c, 1.0);
      }`,
    side: THREE.BackSide,
    depthWrite: false,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(90, 24, 12), skyMat);
  scene.add(sky);
  scene.fog = new THREE.Fog(0xd9ecff, 34, 80);

  // ---------- Lights ----------
  const hemi = new THREE.HemisphereLight(0xcde6ff, 0x5c8f3a, 0.95);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0d2, 2.5);
  sun.position.set(11, 19, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -17;
  sun.shadow.camera.right = 17;
  sun.shadow.camera.top = 14;
  sun.shadow.camera.bottom = -14;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 60;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(sun);
  scene.add(sun.target);
  env.sunLight = sun;

  // Sun disc in the sky
  const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeGlowTexture(), color: 0xfff3c0, transparent: true, opacity: 0.9,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  }));
  sunSprite.position.copy(sun.position).normalize().multiplyScalar(75);
  sunSprite.scale.set(26, 26, 1);
  scene.add(sunSprite);

  // ---------- Ground & lawn ----------
  const ground = mesh(G.plane(160, 160), mat(C.ground, { flat: false }), { shadow: false, receive: true });
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.03;
  scene.add(ground);

  const tileGeo = G.box(CELL, 0.18, CELL);
  for (let r = 0; r < ROWS; r++) {
    env.tiles[r] = [];
    for (let c = 0; c < COLS; c++) {
      const base = (r + c) % 2 === 0 ? C.lawnA : C.lawnB;
      const m = new THREE.MeshStandardMaterial({ color: base, roughness: 0.95, flatShading: true });
      m.userData.base = new THREE.Color(base);
      const tile = mesh(tileGeo, m, { shadow: false, receive: true });
      tile.position.set(colX(c), -0.09, rowZ(r));
      scene.add(tile);
      env.tiles[r][c] = tile;
    }
  }
  // Soil border around the lawn
  const border = mat(C.soil);
  const bw = 0.16;
  const addBorder = (w, d, x, z) => {
    const b = mesh(G.box(w, 0.12, d), border, { shadow: false, receive: true });
    b.position.set(x, -0.06, z);
    scene.add(b);
  };
  addBorder(COLS * CELL + bw * 2, bw, 0, LAWN_BACK - bw / 2);
  addBorder(COLS * CELL + bw * 2, bw, 0, LAWN_FRONT + bw / 2);
  addBorder(bw, ROWS * CELL, LAWN_LEFT - bw / 2, 0);
  addBorder(bw, ROWS * CELL, LAWN_RIGHT + bw / 2, 0);

  // ---------- House (left) ----------
  const HX = LAWN_LEFT - 1.35; // lawn-facing wall plane
  const houseDepth = LAWN_D + 7;
  const wall = mesh(G.box(3.2, 5.4, houseDepth), mat(C.wall), { receive: true });
  wall.position.set(HX - 1.6, 2.7, 0);
  scene.add(wall);
  const trim = mesh(G.box(3.3, 0.5, houseDepth + 0.1), mat(C.wallTrim), { receive: true });
  trim.position.set(HX - 1.6, 0.25, 0);
  scene.add(trim);
  const band = mesh(G.box(3.3, 0.18, houseDepth + 0.1), mat(C.frame));
  band.position.set(HX - 1.6, 5.3, 0);
  scene.add(band);

  // Gable roof: triangular prism extruded along z
  const roofShape = new THREE.Shape();
  roofShape.moveTo(-2.4, 0);
  roofShape.lineTo(2.4, 0);
  roofShape.lineTo(0, 2.1);
  roofShape.closePath();
  const roofGeo = new THREE.ExtrudeGeometry(roofShape, { depth: houseDepth + 1.2, bevelEnabled: false });
  roofGeo.translate(0, 0, -(houseDepth + 1.2) / 2);
  const roof = mesh(roofGeo, mat(C.roof, { flat: true }), { receive: true });
  roof.position.set(HX - 1.6, 5.38, 0);
  scene.add(roof);
  const ridge = mesh(G.box(0.22, 0.14, houseDepth + 1.4), mat(C.roofDark));
  ridge.position.set(HX - 1.6, 7.5, 0);
  scene.add(ridge);
  const chimney = mesh(G.box(0.6, 1.6, 0.6), mat(C.chimney));
  chimney.position.set(HX - 2.4, 6.6, -3.2);
  scene.add(chimney);
  const chimneyTop = mesh(G.box(0.74, 0.16, 0.74), mat(C.roofDark));
  chimneyTop.position.set(HX - 2.4, 7.44, -3.2);
  scene.add(chimneyTop);

  // Door in the middle row
  const doorZ = rowZ(2);
  const doorFrame = mesh(G.box(0.12, 2.5, 1.35), mat(C.frame));
  doorFrame.position.set(HX + 0.02, 1.25, doorZ);
  scene.add(doorFrame);
  const door = mesh(G.box(0.12, 2.3, 1.1), mat(C.door, { roughness: 0.6 }));
  door.position.set(HX + 0.06, 1.15, doorZ);
  scene.add(door);
  const knob = mesh(G.sphere(0.06, 8, 6), mat(0xe9c46a, { roughness: 0.3, metalness: 0.6 }));
  knob.position.set(HX + 0.15, 1.1, doorZ + 0.4);
  scene.add(knob);
  const doorWindow = mesh(G.box(0.04, 0.5, 0.6), mat(C.glass, { roughness: 0.2, emissive: 0x2a5a80, emissiveIntensity: 0.4 }));
  doorWindow.position.set(HX + 0.13, 1.85, doorZ);
  scene.add(doorWindow);
  // Steps
  const step1 = mesh(G.box(0.8, 0.16, 1.7), mat(C.step), { receive: true });
  step1.position.set(HX + 0.4, 0.08, doorZ);
  scene.add(step1);
  const step2 = mesh(G.box(0.45, 0.32, 1.5), mat(C.step), { receive: true });
  step2.position.set(HX + 0.22, 0.16, doorZ);
  scene.add(step2);
  // Awning
  const awning = mesh(G.box(1.1, 0.1, 1.9), mat(C.roof));
  awning.position.set(HX + 0.5, 2.6, doorZ);
  awning.rotation.z = 0.18;
  scene.add(awning);
  for (const s of [-1, 1]) {
    const strut = mesh(G.cyl(0.03, 0.03, 1.0, 6), mat(C.roofDark));
    strut.position.set(HX + 0.6, 2.15, doorZ + s * 0.85);
    strut.rotation.z = -0.6;
    scene.add(strut);
  }
  // Porch light
  const lampGlow = mesh(G.sphere(0.09, 8, 6), mat(0xfff0b3, { emissive: 0xffc966, emissiveIntensity: 1.4, flat: false }), { shadow: false });
  lampGlow.position.set(HX + 0.12, 2.05, doorZ + 0.95);
  scene.add(lampGlow);
  const lampCage = mesh(G.box(0.1, 0.26, 0.2), mat(0x3b3f46));
  lampCage.position.set(HX + 0.05, 2.05, doorZ + 0.95);
  scene.add(lampCage);

  // Windows on rows 0/4
  for (const wz of [rowZ(0) - 0.4, rowZ(4) + 0.4]) {
    const frame = mesh(G.box(0.1, 1.5, 1.3), mat(C.frame));
    frame.position.set(HX + 0.02, 2.75, wz);
    scene.add(frame);
    const glass = mesh(G.box(0.1, 1.3, 1.1), mat(C.glass, { roughness: 0.15, emissive: 0x2a5a80, emissiveIntensity: 0.45 }), { shadow: false });
    glass.position.set(HX + 0.04, 2.75, wz);
    scene.add(glass);
    const mulV = mesh(G.box(0.12, 1.3, 0.06), mat(C.frame));
    mulV.position.set(HX + 0.05, 2.75, wz);
    scene.add(mulV);
    const mulH = mesh(G.box(0.12, 0.06, 1.1), mat(C.frame));
    mulH.position.set(HX + 0.05, 2.75, wz);
    scene.add(mulH);
    const sill = mesh(G.box(0.26, 0.1, 1.45), mat(C.frame));
    sill.position.set(HX + 0.08, 1.98, wz);
    scene.add(sill);
    // Flower box
    const fbox = mesh(G.box(0.34, 0.3, 1.2), mat(0x8b5a3c));
    fbox.position.set(HX + 0.14, 1.78, wz);
    scene.add(fbox);
    for (let i = 0; i < 7; i++) {
      const f = mesh(G.sphere(0.09, 7, 5), mat(pick(C.flower), { flat: false }), { shadow: false });
      f.position.set(HX + 0.2 + rand(-0.08, 0.1), 1.98 + rand(0, 0.1), wz - 0.5 + i * 0.165);
      scene.add(f);
      const l = mesh(G.sphere(0.08, 6, 4), mat(0x4a9a3a), { shadow: false });
      l.position.set(HX + 0.22, 1.9, wz - 0.5 + i * 0.165 + 0.07);
      l.scale.set(1.2, 0.5, 0.9);
      scene.add(l);
    }
  }

  // ---------- Sidewalk & street (right) ----------
  const SW0 = LAWN_RIGHT + bw;
  const sidewalk = mesh(G.box(1.4, 0.14, 60), mat(C.sidewalk, { flat: false }), { shadow: false, receive: true });
  sidewalk.position.set(SW0 + 0.7, 0.0, 0);
  scene.add(sidewalk);
  // sidewalk seams
  for (let z = -29; z <= 29; z += 1.7) {
    const seam = mesh(G.box(1.4, 0.02, 0.05), mat(C.curb), { shadow: false });
    seam.position.set(SW0 + 0.7, 0.08, z);
    scene.add(seam);
  }
  const curb = mesh(G.box(0.25, 0.2, 60), mat(C.curb, { flat: false }), { shadow: false, receive: true });
  curb.position.set(SW0 + 1.5, 0.0, 0);
  scene.add(curb);
  const street = mesh(G.box(16, 0.08, 60), mat(C.asphalt, { flat: false, roughness: 1 }), { shadow: false, receive: true });
  street.position.set(SW0 + 1.62 + 8, -0.04, 0);
  scene.add(street);
  const dashGeo = G.box(0.16, 0.02, 1.1);
  const dashMat = mat(C.asphaltLine, { flat: false });
  const dashes = new THREE.InstancedMesh(dashGeo, dashMat, 24);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 24; i++) {
    dummy.position.set(SW0 + 1.62 + 7.2, 0.005, -27 + i * 2.4);
    dummy.updateMatrix();
    dashes.setMatrixAt(i, dummy.matrix);
  }
  dashes.receiveShadow = true;
  scene.add(dashes);
  const drain = mesh(G.circle(0.5, 14), mat(0x3d4048, { flat: false }), { shadow: false });
  drain.rotation.x = -Math.PI / 2;
  drain.position.set(SW0 + 3.2, 0.006, LAWN_FRONT + 2.6);
  scene.add(drain);

  // Mailbox
  const mbPost = mesh(G.box(0.12, 1.1, 0.12), mat(0x6b4a2e));
  mbPost.position.set(SW0 + 0.45, 0.55, LAWN_FRONT + 1.5);
  scene.add(mbPost);
  const mbBox = mesh(G.box(0.62, 0.36, 0.34), mat(C.mailbox, { roughness: 0.5 }));
  mbBox.position.set(SW0 + 0.45, 1.25, LAWN_FRONT + 1.5);
  scene.add(mbBox);
  const mbTop = mesh(G.cyl(0.17, 0.17, 0.62, 10), mat(C.mailbox, { roughness: 0.5 }));
  mbTop.rotation.z = Math.PI / 2;
  mbTop.position.set(SW0 + 0.45, 1.43, LAWN_FRONT + 1.5);
  scene.add(mbTop);
  const mbFlag = mesh(G.box(0.04, 0.3, 0.1), mat(0xd9453d));
  mbFlag.position.set(SW0 + 0.12, 1.5, LAWN_FRONT + 1.5);
  scene.add(mbFlag);

  // Street lamp
  const lampPole = mesh(G.cyl(0.07, 0.1, 4.6, 8), mat(C.lamp, { roughness: 0.5, metalness: 0.3 }));
  lampPole.position.set(SW0 + 1.0, 2.3, LAWN_BACK - 1.8);
  scene.add(lampPole);
  const lampArm = mesh(G.box(1.1, 0.08, 0.08), mat(C.lamp, { roughness: 0.5, metalness: 0.3 }));
  lampArm.position.set(SW0 + 1.5, 4.55, LAWN_BACK - 1.8);
  scene.add(lampArm);
  const lampHead = mesh(G.box(0.5, 0.18, 0.3), mat(C.lamp, { roughness: 0.5, metalness: 0.3 }));
  lampHead.position.set(SW0 + 2.0, 4.5, LAWN_BACK - 1.8);
  scene.add(lampHead);
  const lampBulb = mesh(G.box(0.4, 0.06, 0.22), mat(0xfff6d6, { emissive: 0xffe3a0, emissiveIntensity: 0.9 }), { shadow: false });
  lampBulb.position.set(SW0 + 2.0, 4.39, LAWN_BACK - 1.8);
  scene.add(lampBulb);

  // ---------- Back fence (white pickets) ----------
  const fenceZ = LAWN_BACK - 1.0;
  const fenceX0 = LAWN_LEFT - 0.2, fenceX1 = SW0 - 0.1;
  const fenceLen = fenceX1 - fenceX0;
  const picketCount = Math.floor(fenceLen / 0.36);
  const picketMat = mat(C.fence, { flat: false });
  const pickets = new THREE.InstancedMesh(G.box(0.12, 1.15, 0.05), picketMat, picketCount);
  const tips = new THREE.InstancedMesh(G.cone(0.085, 0.16, 4), picketMat, picketCount);
  for (let i = 0; i < picketCount; i++) {
    const x = fenceX0 + 0.18 + i * (fenceLen / picketCount);
    dummy.position.set(x, 0.575, fenceZ);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    pickets.setMatrixAt(i, dummy.matrix);
    dummy.position.set(x, 1.15 + 0.08, fenceZ);
    dummy.rotation.set(0, Math.PI / 4, 0);
    dummy.updateMatrix();
    tips.setMatrixAt(i, dummy.matrix);
  }
  pickets.castShadow = true;
  tips.castShadow = true;
  scene.add(pickets, tips);
  for (const y of [0.4, 0.9]) {
    const rail = mesh(G.box(fenceLen, 0.1, 0.05), picketMat);
    rail.position.set((fenceX0 + fenceX1) / 2, y, fenceZ + 0.05);
    scene.add(rail);
  }
  for (let x = fenceX0; x <= fenceX1 + 0.01; x += (fenceLen / 5)) {
    const post = mesh(G.box(0.18, 1.35, 0.18), picketMat);
    post.position.set(x, 0.675, fenceZ + 0.06);
    scene.add(post);
    const cap = mesh(G.box(0.24, 0.08, 0.24), picketMat);
    cap.position.set(x, 1.38, fenceZ + 0.06);
    scene.add(cap);
  }

  // ---------- Front hedge ----------
  const hedgeZ = LAWN_FRONT + 0.95;
  for (let x = LAWN_LEFT + 0.1; x < SW0 - 0.3; x += 0.62) {
    const h = mesh(G.sphere(0.46, 9, 7), mat(pick(C.hedge)));
    h.scale.set(1, 0.72, 0.8);
    h.position.set(x + rand(-0.05, 0.05), 0.26, hedgeZ + rand(-0.06, 0.06));
    h.rotation.y = rand(0, Math.PI);
    scene.add(h);
    if (Math.random() < 0.35) {
      const f = mesh(G.sphere(0.06, 6, 5), mat(pick(C.flower), { flat: false }), { shadow: false });
      f.position.set(x + rand(-0.2, 0.2), 0.58, hedgeZ + rand(-0.2, 0.2));
      scene.add(f);
    }
  }

  // ---------- Trees & bushes ----------
  const treeSpots = [
    [-10.5, -6.2, 1.25], [-6.5, -4.6, 1.0], [-2.2, -5.8, 1.35], [2.6, -4.4, 0.95],
    [6.4, -6.0, 1.3], [10.2, -4.8, 1.1], [14.5, -6.5, 1.2], [-13, -2.5, 1.05],
    [18, -2.5, 1.0], [22, -7, 1.3], [-9, 9.5, 1.1], [-13.5, 5, 1.2],
  ];
  for (const [x, z, s] of treeSpots) env.trees.push(makeTree(scene, x, z, s));
  const bushSpots = [[LAWN_LEFT - 0.4, LAWN_BACK - 2.2], [LAWN_LEFT - 0.6, LAWN_FRONT + 2.4], [SW0 + 0.3, LAWN_BACK - 3.4], [SW0 - 0.9, LAWN_BACK - 1.9], [SW0 - 0.8, LAWN_FRONT + 2.6]];
  for (const [x, z] of bushSpots) {
    for (let i = 0; i < 3; i++) {
      const b = mesh(G.sphere(rand(0.35, 0.55), 8, 6), mat(pick(C.hedge)));
      b.position.set(x + rand(-0.4, 0.4), rand(0.15, 0.3), z + rand(-0.4, 0.4));
      b.scale.y = 0.8;
      scene.add(b);
    }
  }

  // ---------- Grass tufts & flowers ----------
  const tuftCount = 420;
  const tufts = new THREE.InstancedMesh(G.cone(0.05, 0.3, 4), new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }), tuftCount);
  const col = new THREE.Color();
  for (let i = 0; i < tuftCount; i++) {
    let x, z;
    if (Math.random() < 0.5) { // strips behind and in front of the lawn
      x = rand(LAWN_LEFT - 0.3, SW0 - 0.2);
      z = Math.random() < 0.5 ? rand(LAWN_BACK - 0.85, LAWN_BACK - 0.25) : rand(LAWN_FRONT + 0.2, LAWN_FRONT + 0.6);
    } else { // around the house sides and beyond the fence
      x = rand(LAWN_LEFT - 1.2, SW0 - 0.2);
      z = Math.random() < 0.5 ? rand(LAWN_BACK - 5.5, LAWN_BACK - 1.3) : rand(LAWN_FRONT + 1.6, LAWN_FRONT + 5);
    }
    dummy.position.set(x, 0.12, z);
    dummy.rotation.set(rand(-0.25, 0.25), rand(0, 6.3), rand(-0.25, 0.25));
    dummy.scale.set(rand(0.7, 1.3), rand(0.6, 1.5), rand(0.7, 1.3));
    dummy.updateMatrix();
    tufts.setMatrixAt(i, dummy.matrix);
    col.setHex(pick([0x5fb34a, 0x6cc155, 0x4f9e3e, 0x7bcf5f]));
    tufts.setColorAt(i, col);
  }
  tufts.castShadow = true;
  scene.add(tufts);

  const flowerCount = 46;
  const stems = new THREE.InstancedMesh(G.cyl(0.015, 0.02, 0.26, 5), mat(0x4a9a3a), flowerCount);
  const heads = new THREE.InstancedMesh(G.sphere(0.07, 7, 5), new THREE.MeshStandardMaterial({ roughness: 0.6 }), flowerCount);
  for (let i = 0; i < flowerCount; i++) {
    let x, z;
    if (i < 24) { x = HX + rand(0.15, 0.45); z = rand(LAWN_BACK - 3, LAWN_FRONT + 3); if (Math.abs(z - doorZ) < 1.2) z += 2.4; }
    else { x = rand(LAWN_LEFT, SW0 - 0.4); z = Math.random() < 0.5 ? rand(LAWN_BACK - 0.8, LAWN_BACK - 0.3) : rand(LAWN_FRONT + 0.25, LAWN_FRONT + 0.55); }
    dummy.position.set(x, 0.13, z);
    dummy.rotation.set(rand(-0.15, 0.15), 0, rand(-0.15, 0.15));
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    stems.setMatrixAt(i, dummy.matrix);
    dummy.position.set(x, 0.28, z);
    dummy.scale.setScalar(rand(0.8, 1.3));
    dummy.updateMatrix();
    heads.setMatrixAt(i, dummy.matrix);
    col.setHex(pick(C.flower));
    heads.setColorAt(i, col);
  }
  heads.castShadow = true;
  scene.add(stems, heads);

  // ---------- Clouds ----------
  const cloudMat = new THREE.MeshStandardMaterial({ color: C.cloud, roughness: 1, emissive: 0x6a7f99, emissiveIntensity: 0.35, fog: true });
  for (let i = 0; i < 9; i++) {
    const g = new THREE.Group();
    const n = 3 + Math.floor(Math.random() * 4);
    for (let k = 0; k < n; k++) {
      const r = rand(0.9, 1.8);
      const p = mesh(G.sphere(1, 9, 7), cloudMat, { shadow: false });
      p.scale.set(r * rand(1, 1.5), r * 0.62, r);
      p.position.set((k - n / 2) * rand(0.9, 1.3), rand(-0.2, 0.3), rand(-0.4, 0.4));
      g.add(p);
    }
    g.position.set(rand(-38, 38), rand(13, 20), rand(-34, -8));
    g.scale.setScalar(rand(0.9, 1.6));
    g.userData.speed = rand(0.25, 0.6);
    scene.add(g);
    env.clouds.push(g);
  }

  // ---------- Butterflies ----------
  const wingColors = [0xffa8d6, 0x9ad8ff, 0xfff3a3, 0xd7b6ff];
  for (let i = 0; i < 4; i++) {
    const g = new THREE.Group();
    const wingMat = mat(wingColors[i % wingColors.length], { side: THREE.DoubleSide, flat: false, roughness: 0.6 });
    const body = mesh(G.sphere(0.03, 6, 4), mat(0x3b2f2f), { shadow: false });
    body.scale.set(2.2, 1, 1);
    g.add(body);
    const wings = [];
    for (const s of [-1, 1]) {
      const pivot = new THREE.Group();
      const w = mesh(G.plane(0.2, 0.15), wingMat, { shadow: false });
      w.rotation.x = -Math.PI / 2;
      w.position.z = s * 0.1;
      pivot.add(w);
      g.add(pivot);
      wings.push({ pivot, s });
    }
    g.userData = { wings, phase: rand(0, 6), cx: rand(-4, 4), cz: rand(-2, 2), fx: rand(0.25, 0.45), fz: rand(0.2, 0.4), ax: rand(3, 6), az: rand(1.5, 3.2), h: rand(1.0, 1.8) };
    scene.add(g);
    env.butterflies.push(g);
  }

  // ---------- Per-frame ambience ----------
  const tmp = new THREE.Vector3();
  env.update = (dt) => {
    env.t += dt;
    const t = env.t;
    for (const c of env.clouds) {
      c.position.x += c.userData.speed * dt;
      if (c.position.x > 44) c.position.x = -44;
    }
    for (const tr of env.trees) {
      tr.crown.rotation.z = Math.sin(t * 0.8 + tr.phase) * 0.025;
      tr.crown.rotation.x = Math.cos(t * 0.6 + tr.phase) * 0.02;
    }
    for (const b of env.butterflies) {
      const u = b.userData;
      const tt = t + u.phase;
      tmp.set(u.cx + Math.sin(tt * u.fx) * u.ax, u.h + Math.sin(tt * 1.7) * 0.25, u.cz + Math.cos(tt * u.fz) * u.az);
      const dir = tmp.clone().sub(b.position);
      if (dir.lengthSq() > 1e-6) {
        const yaw = Math.atan2(-dir.z, dir.x);
        b.rotation.y = yaw;
      }
      b.position.copy(tmp);
      const flap = Math.sin(tt * 18) * 0.95;
      for (const w of u.wings) w.pivot.rotation.x = w.s * flap;
    }
    for (let i = env.scorched.length - 1; i >= 0; i--) {
      const s = env.scorched[i];
      s.tile.material.color.lerp(s.tile.material.userData.base, dt * 0.35);
      s.t += dt;
      if (s.t > 8) { s.tile.material.color.copy(s.tile.material.userData.base); env.scorched.splice(i, 1); }
    }
  };

  env.scorch = (r, c) => {
    const tile = env.tiles[r]?.[c];
    if (!tile) return;
    tile.material.color.lerp(new THREE.Color(0x3b2f23), 0.7);
    env.scorched.push({ tile, t: 0 });
  };

  return env;
}

function makeTree(scene, x, z, s) {
  const g = new THREE.Group();
  const trunk = mesh(G.cyl(0.16, 0.26, 1.8, 7), mat(C.trunk));
  trunk.position.y = 0.9;
  g.add(trunk);
  const crown = new THREE.Group();
  crown.position.y = 1.7;
  const layers = [[0, 1.25, 0], [0.35, 1.0, 0.2], [-0.25, 0.85, -0.2], [0.1, 0.7, 0.3]];
  layers.forEach(([dx, r, dz], i) => {
    const m = mesh(G.sphere(1, 8, 6), mat(C.foliage[i % C.foliage.length]));
    m.scale.setScalar(r);
    m.position.set(dx, i * 0.55, dz);
    crown.add(m);
  });
  g.add(crown);
  g.position.set(x, 0, z);
  g.scale.setScalar(s);
  g.rotation.y = rand(0, 6);
  scene.add(g);
  return { group: g, crown, phase: rand(0, 6) };
}

export function buildMower() {
  const g = new THREE.Group();
  const red = mat(0xd6402f, { roughness: 0.45 });
  const darkRed = mat(0xb33426, { roughness: 0.5 });
  const metal = mat(0x3a3a3a, { roughness: 0.5, metalness: 0.4 });
  const body = mesh(G.box(0.64, 0.26, 0.44), red);
  body.position.y = 0.3;
  g.add(body);
  const top = mesh(G.box(0.42, 0.14, 0.32), darkRed);
  top.position.set(-0.02, 0.5, 0);
  g.add(top);
  const engine = mesh(G.cyl(0.1, 0.11, 0.14, 8), metal);
  engine.position.set(0.06, 0.62, 0);
  g.add(engine);
  const cap = mesh(G.cyl(0.05, 0.05, 0.06, 8), mat(0xe9c46a, { roughness: 0.3, metalness: 0.5 }));
  cap.position.set(0.06, 0.72, 0);
  g.add(cap);
  const grille = mesh(G.box(0.05, 0.14, 0.3), metal);
  grille.position.set(0.33, 0.28, 0);
  g.add(grille);
  const wheels = [];
  for (const [x, z] of [[-0.24, -0.25], [-0.24, 0.25], [0.22, -0.25], [0.22, 0.25]]) {
    const w = mesh(G.cyl(0.13, 0.13, 0.08, 10), mat(0x2b2b2b, { roughness: 0.7 }));
    w.rotation.x = Math.PI / 2;
    w.position.set(x, 0.14, z);
    g.add(w);
    const hub = mesh(G.cyl(0.05, 0.05, 0.09, 8), mat(0xd6d6d6, { roughness: 0.3, metalness: 0.4 }));
    hub.rotation.x = Math.PI / 2;
    hub.position.set(x, 0.14, z);
    g.add(hub);
    wheels.push(w, hub);
  }
  for (const z of [-0.15, 0.15]) {
    const h = mesh(G.cyl(0.022, 0.022, 0.85, 6), metal);
    h.position.set(-0.5, 0.62, z);
    h.rotation.z = 0.95;
    g.add(h);
  }
  const grip = mesh(G.cyl(0.03, 0.03, 0.4, 6), mat(0x222222));
  grip.rotation.x = Math.PI / 2;
  grip.position.set(-0.84, 0.86, 0);
  g.add(grip);
  g.userData.wheels = wheels;
  return g;
}

export function makeGlowTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.75)');
  grad.addColorStop(0.6, 'rgba(255,255,255,0.18)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
