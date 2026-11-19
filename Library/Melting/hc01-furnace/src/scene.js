// HC01 (FRSW 1-25) in 3D, built against the furnace status synoptic of its manual: the steel box with its ribs, the
// vertical-lift door on its gantry with the hydraulic cylinder (no tilting platform on this furnace),
// two burners on the back wall fed by the gas train and the combustion fan, the roof hood and flue with its damper,
// the yellow-railed roof platform, the Aluswirler well (red motor) and the transfer-pump well (green motor) with the
// level rod. update(s) poses everything from the plant state; nothing is animated on its own.
import * as THREE from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {levelOf, P} from './model.js';

const V3 = THREE.Vector3;
const ACCENT = 0xe3562a;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

// geometry, metres: x along the furnace (door at -x, pump well at +x), z across (burners at -z, Aluswirler at +z)
export const G = {
  L: 6.0, W: 4.6, H: 3.2, base: 0.35, // steel casing, on a 0.35 m plinth
  hx: 2.1, hz: 1.5, floor: 0.75, vault: 2.85, // inner hearth (4.2 x 3.0 m) and vault
  doorZ: 1.05, sill: 1.85, doorTop: 2.7,
  burnerX: [-1.0, 1.0], burnerY: 2.35,
};
export const bathTop = (s) => G.floor + levelOf(s) / 1000;

function mat(color, o = {}) {
  return new THREE.MeshStandardMaterial({color, roughness: 0.6, metalness: 0.15, ...o});
}

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true});
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.localClippingEnabled = true;

  const scene = new THREE.Scene();
  const BG = new THREE.Color('#e9e6e0');
  scene.background = BG;
  scene.fog = new THREE.Fog(BG, 30, 60);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.45;
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 200);

  scene.add(new THREE.HemisphereLight(0xffffff, 0xb9b2a6, 1.4));
  const sun = new THREE.DirectionalLight(0xffffff, 2.1);
  sun.position.set(-8, 14, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 40});
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xfff1e0, 0.6);
  fill.position.set(9, 6, -8);
  scene.add(fill);

  // floor
  const floor = new THREE.Mesh(new THREE.CircleGeometry(30, 64), mat('#dedad2', {roughness: 0.95}));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const grid = new THREE.GridHelper(40, 40, 0xcfc9be, 0xd6d1c7);
  grid.position.y = 0.002;
  scene.add(grid);

  // ------------------------------------------------------------ clipping for the cutaway
  // two planes: everything kept must lie below the vault line and behind the front hearth wall, so the cut takes off
  // the roof and the front wall together and the chamber reads from above and in front
  const cutTop = new THREE.Plane(new V3(0, -1, 0), 99);
  const cutFront = new THREE.Plane(new V3(0, 0, -1), 99);
  const clip = [cutTop, cutFront];

  const M = {
    steel: mat('#8e99a5', {metalness: 0.35, roughness: 0.55, clippingPlanes: clip, side: THREE.DoubleSide}),
    rib: mat('#7d8894', {metalness: 0.35, roughness: 0.55, clippingPlanes: clip}),
    refr: mat('#d9c7ab', {roughness: 0.9, clippingPlanes: clip, side: THREE.DoubleSide, emissive: new THREE.Color('#ff5a1f'), emissiveIntensity: 0}),
    dark: mat('#3a4048', {roughness: 0.5, metalness: 0.4}),
    frame: mat('#9aa4ae', {metalness: 0.4, roughness: 0.5}),
    yellow: mat('#f0c419', {roughness: 0.5}),
    red: mat('#c8352b', {roughness: 0.45, metalness: 0.2}),
    green: mat('#2f9e44', {roughness: 0.45, metalness: 0.2}),
    white: mat('#eef0f2', {roughness: 0.5}),
    rod: mat('#c0c6cc', {metalness: 0.9, roughness: 0.25}),
    gas: mat('#e9b21c', {roughness: 0.45, metalness: 0.3}),
    air: mat('#b6bec7', {roughness: 0.4, metalness: 0.5}),
    bath: mat('#5f6873', {metalness: 0.55, roughness: 0.3, envMapIntensity: 1.3, emissive: new THREE.Color('#ff5014'), emissiveIntensity: 0.1}),
    ladle: mat('#59626c', {metalness: 0.4, roughness: 0.55}),
    hyd: mat('#a0522d', {roughness: 0.5}),
  };
  const root = new THREE.Group();
  scene.add(root);
  const box = (w, h, d, m, x, y, z, parent = root, shadow = true) => {
    const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    o.position.set(x, y, z);
    o.castShadow = shadow;
    o.receiveShadow = true;
    parent.add(o);
    return o;
  };
  const cyl = (r1, r2, h, m, parent = root, seg = 24) => {
    const o = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), m);
    o.castShadow = true;
    o.receiveShadow = true;
    parent.add(o);
    return o;
  };
  // a cylinder between two points
  const between = (o, a, b) => {
    const d = new V3().subVectors(b, a);
    o.position.copy(a).addScaledVector(d, 0.5);
    o.scale.set(1, d.length(), 1);
    o.quaternion.setFromUnitVectors(new V3(0, 1, 0), d.normalize());
  };
  const pipe = (pts, r, m) => {
    const g = new THREE.Group();
    for (let i = 0; i < pts.length - 1; i++) {
      const o = cyl(r, r, 1, m, g, 16);
      between(o, new V3(...pts[i]), new V3(...pts[i + 1]));
      const j = new THREE.Mesh(new THREE.SphereGeometry(r * 1.02, 12, 8), m);
      j.position.set(...pts[i + 1]);
      g.add(j);
    }
    root.add(g);
    return g;
  };

  // ------------------------------------------------------------ casing: plinth, walls with the door opening, roof
  const {L, W, H, base, hx, hz, floor: fy, vault} = G;
  const xo = L / 2;
  const zo = W / 2;
  box(L + 0.3, base, W + 0.3, M.dark, 0, base / 2, 0);
  const wallT = 0.12; // steel skin
  // refractory lining as solid blocks between the skin and the hearth
  const top = base + H;
  // back and front long walls
  for (const sz of [-1, 1]) {
    box(L, H, wallT, M.steel, 0, base + H / 2, sz * (zo - wallT / 2));
    box(2 * hx + 2 * (xo - hx - wallT), vault - base, zo - hz - wallT, M.refr, 0, base + (vault - base) / 2, sz * (hz + (zo - hz - wallT) / 2));
  }
  // door-end wall (-x) with the opening, pump-end wall (+x)
  const endWall = (sx) => {
    const x = sx * (xo - wallT / 2);
    const xr = sx * (hx + (xo - hx - wallT) / 2);
    const rt = xo - hx - wallT;
    if (sx < 0) {
      const sideW = (W - 2 * G.doorZ) / 2;
      for (const sz of [-1, 1]) {
        box(wallT, H, sideW, M.steel, x, base + H / 2, sz * (G.doorZ + sideW / 2));
        box(rt, vault - base, hz - G.doorZ, M.refr, xr, base + (vault - base) / 2, sz * (G.doorZ + (hz - G.doorZ) / 2));
      }
      box(wallT, G.sill - base, 2 * G.doorZ, M.steel, x, base + (G.sill - base) / 2, 0);
      box(wallT, top - G.doorTop, 2 * G.doorZ, M.steel, x, G.doorTop + (top - G.doorTop) / 2, 0);
      box(rt, G.sill - base, 2 * G.doorZ, M.refr, xr, base + (G.sill - base) / 2, 0);
      box(rt, vault - G.doorTop, 2 * G.doorZ, M.refr, xr, G.doorTop + (vault - G.doorTop) / 2, 0);
      // door frame
      for (const sz of [-1, 1]) box(0.18, G.doorTop - G.sill + 0.3, 0.16, M.dark, x - 0.12, (G.sill + G.doorTop) / 2, sz * (G.doorZ + 0.08));
    } else {
      box(wallT, H, W, M.steel, x, base + H / 2, 0);
      box(rt, vault - base, 2 * hz, M.refr, xr, base + (vault - base) / 2, 0);
    }
  };
  endWall(-1);
  endWall(1);
  // hearth floor and vault (refractory) and the roof skin
  box(2 * hx, fy - base, 2 * hz, M.refr, 0, base + (fy - base) / 2, 0);
  box(L - 2 * wallT, top - vault, W - 2 * wallT, M.refr, 0, vault + (top - vault) / 2, 0);
  box(L, 0.1, W, M.steel, 0, top + 0.05, 0);
  // vertical ribs on the long walls
  for (const sz of [-1, 1]) for (let i = 0; i <= 6; i++) box(0.12, H - 0.2, 0.14, M.rib, -xo + 0.25 + (i * (L - 0.5)) / 6, base + H / 2, sz * (zo + 0.07));
  for (const sz of [-1, 1]) box(L, 0.16, 0.16, M.rib, 0, base + 0.5, sz * (zo + 0.08));

  // ------------------------------------------------------------ bath (inside), with a cap that follows the level
  const bath = box(2 * hx - 0.02, 1, 2 * hz - 0.02, M.bath, 0, 0, 0, root, false);
  bath.castShadow = false;

  // flames: an outer warm cone and an inner blue core per burner, along +z from the back wall
  const flameMat = new THREE.MeshBasicMaterial({color: 0xff5a14, transparent: true, opacity: 0.82, depthWrite: false, side: THREE.DoubleSide});
  const coreMat = new THREE.MeshBasicMaterial({color: 0xffc23a, transparent: true, opacity: 0.95, depthWrite: false});
  const flameGeo = new THREE.ConeGeometry(1, 1, 24, 1, true).translate(0, -0.5, 0).rotateX(-Math.PI / 2); // tip toward +z
  const flames = G.burnerX.map((bx) => {
    const g = new THREE.Group();
    g.position.set(bx, G.burnerY, -hz);
    const outer = new THREE.Mesh(flameGeo, flameMat);
    const core = new THREE.Mesh(flameGeo, coreMat);
    g.add(outer, core);
    root.add(g);
    const glow = new THREE.PointLight(0xff8a3a, 0, 6, 1.6);
    glow.position.set(bx, G.burnerY, -hz + 0.8);
    root.add(glow);
    return {g, outer, core, glow};
  });

  // ------------------------------------------------------------ burners and the combustion train on the back (-z)
  const bz = -zo;
  const burnerBodies = G.burnerX.map((bx) => {
    const g = new THREE.Group();
    const body = cyl(0.26, 0.3, 0.8, M.dark, g);
    body.rotation.x = Math.PI / 2;
    body.position.set(bx, G.burnerY, bz - 0.4);
    const flange = cyl(0.42, 0.42, 0.08, M.frame, g);
    flange.rotation.x = Math.PI / 2;
    flange.position.set(bx, G.burnerY, bz - 0.04);
    root.add(g);
    return {g, body};
  });
  // combustion fan on the floor behind the furnace
  const fanG = new THREE.Group();
  fanG.position.set(-2.4, 0, -3.9);
  root.add(fanG);
  const vol = cyl(0.62, 0.62, 0.4, M.white, fanG, 40);
  vol.rotation.z = Math.PI / 2;
  vol.position.set(0, 0.85, 0);
  const fanMotor = cyl(0.26, 0.26, 0.7, M.dark, fanG);
  fanMotor.rotation.z = Math.PI / 2;
  fanMotor.position.set(-0.55, 0.85, 0);
  const fanHub = cyl(0.3, 0.3, 0.42, mat('#ffffff'), fanG, 24);
  fanHub.rotation.z = Math.PI / 2;
  fanHub.position.set(0.02, 0.85, 0);
  box(1.4, 0.2, 0.9, M.dark, -0.2, 0.1, 0, fanG);
  // air main to both burners (grey), gas main (yellow)
  const airY = 1.75;
  pipe([[-2.4, 1.3, -3.9], [-2.4, airY, -3.9], [-2.4, airY, -3.2], [1.0, airY, -3.2]], 0.16, M.air);
  for (const bx of G.burnerX) pipe([[bx, airY, -3.2], [bx, G.burnerY, -3.2], [bx, G.burnerY, bz - 0.8]], 0.13, M.air);
  const gasY = 3.0;
  pipe([[3.6, 0.2, -3.6], [3.6, gasY, -3.6], [-1.0, gasY, -3.6]], 0.07, M.gas);
  for (const bx of G.burnerX) pipe([[bx, gasY, -3.6], [bx, gasY, -2.95], [bx, G.burnerY + 0.2, -2.95], [bx, G.burnerY + 0.2, bz - 0.55]], 0.05, M.gas);
  // valve bodies on the gas line: 70Y1 (main) and the two main EVs, coloured by state in update()
  const valveMat = () => mat('#f2f2f2', {roughness: 0.4});
  const valve = (x, y, z) => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    const m = valveMat();
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 12), m);
    const act = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.26, 0.2), M.dark);
    act.position.y = 0.24;
    g.add(b, act);
    root.add(g);
    return m;
  };
  const v70Y1 = valve(2.4, gasY, -3.6);
  const vB = G.burnerX.map((bx) => valve(bx, G.burnerY + 0.6, -2.95));
  // gas meter at the inlet
  box(0.4, 0.5, 0.35, M.dark, 3.6, 1.0, -3.6);

  // ------------------------------------------------------------ door, gantry and lift cylinder (-x end)
  const dx = -xo - 0.12;
  const door = new THREE.Group();
  root.add(door);
  const doorH = G.doorTop - G.sill + 0.25;
  box(0.22, doorH, 2 * G.doorZ + 0.3, M.steel, 0, 0, 0, door);
  box(0.06, doorH - 0.15, 2 * G.doorZ + 0.1, M.refr, 0.14, 0, 0, door);
  for (let i = -2; i <= 2; i++) box(0.08, doorH - 0.1, 0.08, M.rib, -0.14, 0, i * 0.5, door);
  const doorY0 = (G.sill + G.doorTop) / 2 + 0.02;
  // gantry posts and beam above the door
  const gTop = 5.6;
  for (const sz of [-1, 1]) box(0.2, gTop, 0.2, M.frame, dx - 0.05, gTop / 2, sz * (G.doorZ + 0.45));
  box(0.3, 0.3, 2 * G.doorZ + 1.1, M.frame, dx - 0.05, gTop, 0);
  // lift cylinder: barrel hangs from the beam, the rod pulls the door up
  const barrel = cyl(0.11, 0.11, 1.6, M.dark);
  barrel.position.set(dx - 0.05, gTop - 0.95, 0);
  const lRod = cyl(0.045, 0.045, 1, M.red);
  const lClamp = box(0.2, 0.12, 0.3, M.dark, 0, 0, 0);

  // ------------------------------------------------------------ tilting platform and ladle in front of the door
  // pivot placed so that at the full tilt the ladle lip sits over the sill at the door face (x -3.15 m, y 2.0 m)
  // and the ladle's upper rim stays outside the raised door slab
  const pivot = new V3(-4.5, 1.74, 0);
  const tiltG = new THREE.Group();
  tiltG.position.copy(pivot);
  root.add(tiltG);
  // stand
  const standParts = [box(2.6, 0.25, 2.2, M.dark, pivot.x - 1.3, 0.125, 0), ...[-1, 1].map((sz) => box(0.25, pivot.y, 0.25, M.frame, pivot.x + 0.05, pivot.y / 2, sz * 0.95))];
  // platform (in tilt group coords: x toward -x from the pivot)
  box(2.2, 0.16, 1.9, M.frame, -1.1, -0.08, 0, tiltG);
  // the ladle: a lathed bucket standing on the platform, mouth toward +y
  const ladleG = new THREE.Group();
  ladleG.position.set(-1.0, 0, 0);
  tiltG.add(ladleG);
  const prof = [[0.001, 0], [0.62, 0], [0.7, 0.1], [0.82, 1.25], [0.86, 1.32], [0.86, 1.38]].map(([r, y]) => new THREE.Vector2(r, y));
  const ladle = new THREE.Mesh(new THREE.LatheGeometry(prof, 40), M.ladle);
  ladle.castShadow = true;
  ladleG.add(ladle);
  const inner = new THREE.Mesh(new THREE.LatheGeometry(prof.map((v) => new THREE.Vector2(Math.max(0.001, v.x - 0.08), v.y + 0.06)), 40), M.refr.clone());
  inner.material.side = THREE.BackSide;
  inner.material.clippingPlanes = [];
  ladleG.add(inner);
  const ladleMetal = new THREE.Mesh(new THREE.CircleGeometry(1, 40), M.bath);
  ladleMetal.rotation.x = -Math.PI / 2;
  ladleG.add(ladleMetal);
  // spout lip toward the door
  box(0.3, 0.08, 0.36, M.ladle, 0.86, 1.35, 0, ladleG);
  // lock arms (tilting forward/backward in the manual: lock/unlock the ladle)
  const arms = [-1, 1].map((sz) => {
    const a = box(0.12, 0.9, 0.1, M.yellow, 0, 0, 0, tiltG);
    a.userData.sz = sz;
    return a;
  });
  // tilt cylinder from the floor to the platform underside
  const tBarrel = cyl(0.12, 0.12, 1, M.dark);
  const tRod = cyl(0.05, 0.05, 1, M.rod);
  const tBase = new V3(pivot.x - 2.3, 0.3, 0);
  const tAttach = new V3(-1.6, -0.15, 0); // in platform coords
  // pour stream
  const stream = cyl(0.06, 0.09, 1, new THREE.MeshStandardMaterial({color: '#d9dde1', metalness: 0.8, roughness: 0.25, emissive: '#ff7a33', emissiveIntensity: 0.25}));
  // hydraulic power pack
  const hpu = new THREE.Group();
  hpu.position.set(-4.2, 0, -2.9);
  root.add(hpu);
  box(1.4, 0.8, 0.9, M.hyd, 0, 0.4, 0, hpu);
  const hpuMotor = cyl(0.2, 0.2, 0.55, M.dark, hpu);
  hpuMotor.position.set(-0.2, 1.08, 0);
  box(0.25, 0.25, 0.25, M.air, 0.35, 0.95, 0, hpu);

  // ------------------------------------------------------------ roof: hood, flue + damper, platform with railings
  const roofG = new THREE.Group();
  root.add(roofG);
  const hood = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 1.35, 0.7, 4, 1), M.frame);
  hood.rotation.y = Math.PI / 4;
  hood.position.set(0.3, top + 0.45, 0);
  hood.castShadow = true;
  roofG.add(hood);
  const flue = cyl(0.42, 0.42, 2.2, M.frame, roofG);
  flue.position.set(0.3, top + 1.9, 0);
  const damper = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.04, 32), M.dark);
  damper.position.set(0.3, top + 2.4, 0);
  roofG.add(damper);
  const damperRing = cyl(0.46, 0.46, 0.22, M.dark, roofG);
  damperRing.position.set(0.3, top + 2.4, 0);
  // the flue is sliced open above the ring so the damper reads
  flue.scale.y = 0.45;
  flue.position.y = top + 1.3;
  const flue2 = cyl(0.42, 0.42, 1.0, M.frame, roofG);
  flue2.position.set(0.3, top + 3.05, 0);
  // railings
  const railY = top + 1.05;
  const rail = (a, b) => {
    const o = cyl(0.03, 0.03, 1, M.yellow, roofG, 8);
    between(o, new V3(...a), new V3(...b));
  };
  const rx = xo - 0.1;
  const rz = zo - 0.1;
  const corners = [[-rx + 1.2, -rz], [rx, -rz], [rx, rz], [-rx + 1.2, rz]];
  for (let i = 0; i < 3; i++) {
    const [ax, az] = corners[i];
    const [bx2, bz2] = corners[i + 1];
    rail([ax, railY, az], [bx2, railY, bz2]);
    rail([ax, railY - 0.5, az], [bx2, railY - 0.5, bz2]);
    const n = Math.round(Math.hypot(bx2 - ax, bz2 - az) / 1.2);
    for (let k = 0; k <= n; k++) {
      const x = ax + ((bx2 - ax) * k) / n;
      const z = az + ((bz2 - az) * k) / n;
      rail([x, top + 0.1, z], [x, railY, z]);
    }
  }
  // ladder at the pump end
  for (const sz of [-1, 1]) rail([xo + 1.25, 0, -1.5 + sz * 0.3], [xo + 1.25, top + 1.0, -1.5 + sz * 0.3]);
  for (let k = 1; k < 12; k++) rail([xo + 1.25, k * 0.3, -1.8], [xo + 1.25, k * 0.3, -1.2]);
  box(1.2, 0.08, 0.9, M.frame, xo + 0.65, top + 0.04, -1.5, roofG);
  // the gas main runs over the roof line at the back; it goes with the roof in the cutaway

  // ------------------------------------------------------------ Aluswirler well (+z) and transfer pump well (+x)
  const well = (cx, cz, w, d, h) => {
    const g = new THREE.Group();
    g.position.set(cx, base, cz);
    root.add(g);
    const t = 0.18;
    box(w, h, t, M.steel, 0, h / 2, -d / 2 + t / 2, g);
    box(w, h, t, M.steel, 0, h / 2, d / 2 - t / 2, g);
    box(t, h, d, M.steel, -w / 2 + t / 2, h / 2, 0, g);
    box(t, h, d, M.steel, w / 2 - t / 2, h / 2, 0, g);
    box(w - 2 * t, 0.3, d - 2 * t, M.refr, 0, 0.15, 0, g);
    const metal = box(w - 2 * t - 0.02, 1, d - 2 * t - 0.02, M.bath, 0, 0, 0, g, false);
    return {g, metal};
  };
  const swW = well(0.9, zo + 0.7, 1.5, 1.4, 1.75);
  const pmW = well(xo + 0.7, 0.5, 1.4, 1.6, 1.75);
  // Aluswirler: red motor and white cooling fan on a bridge over the well
  const swirlG = new THREE.Group();
  swirlG.position.set(0.9, base + 1.75, zo + 0.7);
  root.add(swirlG);
  box(1.7, 0.14, 0.3, M.frame, 0, 0.07, 0, swirlG);
  const swMotor = cyl(0.26, 0.26, 0.9, M.red, swirlG);
  swMotor.position.set(0, 0.65, 0);
  const swFan = cyl(0.3, 0.3, 0.2, M.white, swirlG);
  swFan.position.set(0, 1.2, 0);
  const swFanBlade = box(0.5, 0.04, 0.08, M.dark, 0, 1.32, 0, swirlG);
  const swShaft = cyl(0.05, 0.05, 1.6, M.rod, swirlG);
  swShaft.position.set(0, -0.7, 0);
  const swImp = new THREE.Group();
  swImp.position.set(0, -1.45, 0);
  swirlG.add(swImp);
  for (let k = 0; k < 4; k++) {
    const b = box(0.5, 0.18, 0.05, M.rod, 0, 0, 0, swImp);
    b.rotation.y = (k * Math.PI) / 4;
  }
  // transfer pump: green motor on a bridge, launder toward HC01
  const pumpG = new THREE.Group();
  pumpG.position.set(xo + 0.7, base + 1.75, 0.5);
  root.add(pumpG);
  box(0.3, 0.14, 1.5, M.frame, 0, 0.07, 0, pumpG);
  const pMotor = cyl(0.28, 0.28, 0.8, M.green, pumpG);
  pMotor.position.set(0, 0.6, 0);
  const pCap = cyl(0.18, 0.28, 0.25, M.green, pumpG);
  pCap.position.set(0, 1.12, 0);
  const pShaft = cyl(0.05, 0.05, 1.4, M.rod, pumpG);
  pShaft.position.set(0, -0.6, 0);
  const launder = box(2.6, 0.18, 0.3, M.ladle, xo + 2.2, base + 1.65, 1.15);
  void launder;
  const pumpStream = box(2.4, 0.06, 0.18, new THREE.MeshStandardMaterial({color: '#d9dde1', metalness: 0.8, roughness: 0.25, emissive: '#ff7a33', emissiveIntensity: 0.2}), xo + 2.25, base + 1.76, 1.15);
  const coupling = pipe([[xo + 0.7, base + 1.3, 0.9], [xo + 0.7, base + 1.68, 1.15], [xo + 1.0, base + 1.68, 1.15]], 0.07, M.ladle);
  void coupling;
  // HC01 stub: the next furnace's wall, so the launder goes somewhere
  box(0.4, 2.4, 2.4, M.steel, xo + 3.7, 1.2, 1.15);
  // level rod (green, in the spout) and the laser above the pump well
  const rodLvl = cyl(0.025, 0.025, 1.6, M.green);
  rodLvl.position.set(xo + 0.35, base + 1.45 + 0.2, -0.05);
  const laser = box(0.25, 0.18, 0.25, M.dark, xo + 0.7, base + 2.6, 0.0);
  const beamMat = new THREE.MeshBasicMaterial({color: 0xff2a2a, transparent: true, opacity: 0.55});
  const beam = cyl(0.008, 0.008, 1, beamMat);
  // thermocouples: vault and bath
  const tcV = cyl(0.03, 0.03, 0.9, M.rod, roofG);
  tcV.position.set(-0.8, vault + 0.1, 0.6);
  const tcB = cyl(0.03, 0.03, 2.2, M.rod);
  tcB.position.set(1.7, fy + 1.0, 1.2);
  tcB.rotation.z = 0.12;

  // ------------------------------------------------------------ highlight: an accent outline box around one part
  const hiMat = new THREE.LineBasicMaterial({color: ACCENT, transparent: true, opacity: 0.9, depthTest: false});
  const hi = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), hiMat);
  hi.renderOrder = 10;
  scene.add(hi);
  const HI = {
    burners: [new V3(0, G.burnerY, bz - 0.5), new V3(3.0, 1.2, 1.3)],
    fan: [new V3(-2.55, 0.9, -3.9), new V3(1.8, 1.6, 1.4)],
    door: [new V3(dx, doorY0 + 0.6, 0), new V3(0.6, doorH + 1.4, 2 * G.doorZ + 0.6)],
    tilt: [new V3(pivot.x - 1.1, 1.5, 0), new V3(2.8, 2.6, 2.2)],
    swirl: [new V3(0.9, base + 1.9, zo + 0.7), new V3(1.9, 2.6, 1.6)],
    pump: [new V3(xo + 0.7, base + 1.9, 0.5), new V3(1.7, 2.6, 1.8)],
    hpu: [new V3(-4.2, 0.65, -2.9), new V3(1.7, 1.5, 1.2)],
    flue: [new V3(0.3, top + 1.6, 0), new V3(1.4, 3.0, 1.4)],
    bath: [new V3(0, fy + 0.5, 0), new V3(2 * hx + 0.1, 1.1, 2 * hz + 0.1)],
  };

  // label anchors, in world space, read by the console
  const ANCHORS = {
    burner1: new V3(G.burnerX[0], G.burnerY, -hz + 0.9),
    burner2: new V3(G.burnerX[1], G.burnerY, -hz + 0.9),
    fan: new V3(-2.4, 1.6, -3.9),
    door: new V3(dx - 0.2, G.doorTop + 0.3, 0),
    ladle: new V3(pivot.x - 1.0, 2.2, 0),
    swirl: new V3(0.9, base + 3.4, zo + 0.7),
    pump: new V3(xo + 0.7, base + 3.2, 0.5),
    hpu: new V3(-4.2, 1.5, -2.9),
    flue: new V3(0.3, top + 3.6, 0),
    bath: new V3(-0.6, fy + 0.6, 0.2),
    rod: new V3(xo + 0.35, base + 2.5, -0.05),
  };

  const state = {cutK: 0};
  const tmp = new V3();

  function update(s, opt) {
    const T = s.t;
    const lvl = levelOf(s) / 1000;
    // cutaway: the plane slides from beyond the front wall to the hearth centreline
    state.cutK = opt.cut;
    const ck = opt.cut;
    cutTop.constant = 99 * (1 - ck) + (vault - 0.05) * ck;
    cutFront.constant = 99 * (1 - ck) + (hz + 0.02) * ck;
    roofG.visible = ck < 0.5;
    swirlG.visible = swW.g.visible = false;
    tiltG.visible = tBarrel.visible = tRod.visible = false;
    for (const o of standParts) o.visible = false;
    // bath block from the hearth floor to the level
    const by = G.floor;
    bath.visible = lvl > 0.005;
    bath.scale.set(1, Math.max(0.001, lvl), 1);
    bath.position.set(0, by + lvl / 2, 0);
    const glow = clamp((s.al - 600) / 300, 0, 1);
    M.bath.emissiveIntensity = 0.04 + 0.14 * glow;
    M.refr.emissiveIntensity = clamp((s.ch - 550) / 500, 0, 0.35) * 0.25;
    // wells follow the bath level (they are connected under the wall)
    for (const w of [swW, pmW]) {
      const h = Math.max(0.001, lvl + (G.floor - base) - 0.3);
      w.metal.visible = lvl > 0.02;
      w.metal.scale.y = h;
      w.metal.position.y = 0.3 + h / 2;
    }
    // flames
    flames.forEach((f, b) => {
      const fire = s.fire[b];
      const on = fire > 0.01;
      f.g.visible = on;
      f.glow.intensity = on ? 1.5 + 3 * fire : 0;
      if (!on) return;
      const fl = 1 + 0.06 * Math.sin(T * 23 + b * 3) + 0.04 * Math.sin(T * 37 + b);
      const len = (0.7 + 1.7 * fire) * fl;
      const r = 0.16 + 0.14 * fire;
      f.outer.scale.set(r, r, len);
      f.core.scale.set(r * 0.5, r * 0.5, len * 0.45);
      f.outer.position.z = 0;
    });
    // valves: green when energised, white when not, red on a tightness fault
    const vcol = (m, on, bad) => m.color.set(bad ? '#d33' : on ? '#3bb44a' : '#f2f2f2');
    vcol(v70Y1, s.ev.y1, s.tight === 'F-EV1');
    vcol(vB[0], s.ev.b1, s.tight === 'F-EV2');
    vcol(vB[1], s.ev.b2, s.tight === 'F-EV2');
    // fan: white stopped, green running, red on a motor fault [M]
    fanHub.material.color.set(s.fault === 'fanTrip' && (s.fan.run || s.seq === 'LOCKOUT') ? '#d33' : s.fan.speed > 0.05 ? '#3bb44a' : '#ffffff');
    fanHub.rotation.x = T * 40 * s.fan.speed;
    // door
    const lift = s.door.pos * (G.doorTop - G.sill + 0.15);
    door.position.set(dx, doorY0 + lift, 0);
    const rodTop = gTop - 1.75;
    const rodBot = door.position.y + doorH / 2;
    between(lRod, new V3(dx - 0.05, rodBot, 0), new V3(dx - 0.05, rodTop, 0));
    lClamp.position.set(dx - 0.05, rodBot, 0);
    // tilt: the platform swings about the pivot toward the door, up to P.tiltMax
    const ang = s.tilt.pos * (P.tiltMax * Math.PI) / 180;
    tiltG.rotation.z = -ang;
    // lock arms: up and in when locked
    arms.forEach((a) => {
      const k = s.tilt.locked ? 1 : 0;
      a.position.set(-1.0, 0.45 + 0.35 * k, a.userData.sz * (0.95 - 0.05 * k));
      a.rotation.x = a.userData.sz * (k ? 0.35 : -0.25);
    });
    // ladle metal: the free surface stays level in world space; its height in the bucket follows the tonnes
    const fillK = s.tilt.ladle / P.ladleT;
    ladleMetal.visible = fillK > 0.01 && s.tilt.pos < 0.6;
    const hgt = 0.15 + 1.05 * Math.sqrt(fillK);
    ladleMetal.position.y = hgt;
    const rr = 0.62 + ((0.82 - 0.62) * hgt) / 1.25 - 0.06;
    ladleMetal.scale.set(rr, rr, 1);
    ladleMetal.rotation.set(-Math.PI / 2, 0, 0);
    ladleMetal.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new V3(0, 0, 1), ang));
    // tilt cylinder
    tiltG.updateMatrixWorld();
    const att = tAttach.clone().applyMatrix4(tiltG.matrixWorld);
    const d = att.clone().sub(tBase);
    const bLen = 1.25;
    const mid = tBase.clone().addScaledVector(d.clone().normalize(), bLen);
    between(tBarrel, tBase, mid);
    between(tRod, mid.clone().addScaledVector(d.clone().normalize(), -0.1), att);
    // pour stream: from the lip down to the bath through the door
    const pouring = s.tilt.poured > 0;
    stream.visible = pouring;
    if (pouring) {
      ladleG.updateMatrixWorld();
      const lip = new V3(1.0, 1.38, 0).applyMatrix4(ladleG.matrixWorld);
      const land = new V3(Math.min(-hx + 0.5, lip.x + 0.6), G.floor + lvl, 0);
      between(stream, lip, land);
      stream.scale.x = stream.scale.z = 0.6 + 2 * s.tilt.poured;
    }
    // hydraulic pump motor turns
    hpuMotor.rotation.y = s.hyd.run ? T * 30 : 0;
    hpuMotor.material = s.hyd.run ? M.green : M.dark;
    // Aluswirler: motor green running, red stopped [M]; impeller spins at the rpm
    swMotor.material = s.swirl.rpm > 5 ? M.green : M.red;
    const a = (T * s.swirl.rpm * 2 * Math.PI) / 60;
    swImp.rotation.y = a;
    swFanBlade.rotation.y = a;
    // transfer pump: green running, red stopped [M]
    pMotor.material = s.pump.flow > 0.01 ? M.green : M.red;
    pCap.material = pMotor.material;
    pumpStream.visible = s.pump.flow > 0.05;
    pumpStream.scale.y = 0.5 + s.pump.flow;
    // flue damper angle from the pressure controller output
    damper.rotation.z = (1 - s.damper) * (Math.PI / 2) * 0.95;
    // laser beam from the sensor to the metal
    const ly = base + 0.3 + Math.max(0.02, lvl + (G.floor - base) - 0.3);
    between(beam, new V3(xo + 0.7, base + 2.5, 0), new V3(xo + 0.7, ly, 0));
    beam.visible = opt.labels > 0.5;
    // highlight
    const h = opt.focus && HI[opt.focus];
    hi.visible = !!h && opt.hiK > 0.01;
    if (h) {
      hi.position.copy(h[0]);
      hi.scale.copy(h[1]).multiplyScalar(1 + 0.03 * Math.sin(T * 0 + performance.now() / 300));
      hiMat.opacity = 0.9 * opt.hiK;
    }
  }

  function setCamera(c, w, h) {
    camera.aspect = w / h;
    camera.setViewOffset(w, h, 0, 0, w, h);
    const ce = Math.cos(c.el);
    camera.position.set(c.tx + c.d * ce * Math.sin(c.az), c.ty + c.d * Math.sin(c.el), c.tz + c.d * ce * Math.cos(c.az));
    camera.lookAt(c.tx, c.ty, c.tz);
    camera.updateProjectionMatrix();
  }

  function project(key, w, h) {
    tmp.copy(ANCHORS[key]).project(camera);
    return [(tmp.x * 0.5 + 0.5) * w, (-tmp.y * 0.5 + 0.5) * h, tmp.z < 1];
  }

  return {renderer, scene, camera, update, setCamera, project, ANCHORS};
}
