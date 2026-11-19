// SWM#1 (FVGP-A 3-30) in 3D: the melting chamber with its vertical-lift main door (210SH1 / 210SH2), the tilting
// platform and ladle for the first fill, two burners (201SH5, 202SH1) and the combustion fan, the roof and flue; and
// the sidewell block from the manual's plan: the vortex well with the scrap conveyor, the Aluswirler well with its
// volute and the drive on the hoist (working position, maintenance support), and the extraction-pump well with the
// launder to HC#1; the pneumatic plug and the three manual plugs with their trays; the cabinet with the light column.
// update(s) poses everything from the plant state.
import * as THREE from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {levelOf, P} from './model.js';
const TILT_MAX = 85;

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
  box(2.6, 0.25, 2.2, M.dark, pivot.x - 1.3, 0.125, 0);
  for (const sz of [-1, 1]) box(0.25, pivot.y, 0.25, M.frame, pivot.x + 0.05, pivot.y / 2, sz * 0.95);
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
  // (no ladder at this end: the sidewell block sits there)
  // the gas main runs over the roof line at the back; it goes with the roof in the cutaway

  // ------------------------------------------------------------ the sidewell block (+x): vortex, Aluswirler, pump wells
  const SW = {x0: xo, x1: xo + 2.1, cx: xo + 1.05, h: 1.75, d: 1.05};
  const wellZ = {vortex: 1.1, asw: 0, pump: -1.1};
  const well = (cx, cz, w, d, h) => {
    const g = new THREE.Group();
    g.position.set(cx, base, cz);
    root.add(g);
    const t = 0.16;
    for (const sz of [-1, 1]) box(w, h, t, M.steel, 0, h / 2, sz * (d / 2 - t / 2), g);
    for (const sx of [-1, 1]) box(t, h, d, M.steel, sx * (w / 2 - t / 2), h / 2, 0, g);
    box(w - 2 * t, 0.3, d - 2 * t, M.refr, 0, 0.15, 0, g);
    const metal = box(w - 2 * t - 0.02, 1, d - 2 * t - 0.02, M.bath, 0, 0, 0, g, false);
    return {g, metal};
  };
  const wells = {vortex: well(SW.cx, wellZ.vortex, 2.1, SW.d, SW.h), asw: well(SW.cx, wellZ.asw, 2.1, SW.d, SW.h), pump: well(SW.cx, wellZ.pump, 2.1, SW.d, SW.h)};
  const wTop = base + SW.h;
  // the volute in the Aluswirler well (a dark ring near the floor)
  const volute = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.06, 10, 32), M.dark);
  volute.rotation.x = Math.PI / 2;
  volute.position.set(SW.cx, base + 0.45, wellZ.asw);
  root.add(volute);
  // vortex surface in the vortex well, deformed by the impeller's pull
  const VR = 0.4;
  const vGeo = new THREE.RingGeometry(0, VR, 40, 16);
  vGeo.rotateX(-Math.PI / 2);
  const vSurf = new THREE.Mesh(vGeo, M.bath);
  vSurf.position.set(SW.cx, 0, wellZ.vortex);
  root.add(vSurf);
  const vPos = vGeo.attributes.position;
  const vR = new Float32Array(vPos.count);
  for (let i = 0; i < vPos.count; i++) vR[i] = Math.hypot(vPos.getX(i), vPos.getZ(i));
  // scrap conveyor to the vortex well, chips on the belt and falling, flakes swirling, flames on a bad vortex
  const belt = box(3.2, 0.08, 0.5, mat('#3d434a'), SW.x1 + 1.4, 3.05, wellZ.vortex);
  belt.rotation.z = 0.28;
  for (const z of [-0.3, 0.3]) box(3.2, 0.25, 0.04, M.frame, SW.x1 + 1.4, 3.1, wellZ.vortex + z).rotation.z = 0.28;
  for (const x of [SW.x1 + 0.6, SW.x1 + 2.4]) box(0.12, x > SW.x1 + 1 ? 3.3 : 2.8, 0.12, M.frame, x, (x > SW.x1 + 1 ? 3.3 : 2.8) / 2, wellZ.vortex);
  const NCH = 70;
  const chips = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.3, 0.6), new THREE.MeshStandardMaterial({color: '#cfd4d8', metalness: 0.8, roughness: 0.3}), NCH);
  chips.frustumCulled = false;
  root.add(chips);
  const flameV = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.9, 16, 1, true), new THREE.MeshBasicMaterial({color: 0xff6a1a, transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide}));
  flameV.position.set(SW.cx, 0, wellZ.vortex);
  root.add(flameV);
  // the hoist portal over the Aluswirler well, running out to the maintenance support
  const hX0 = SW.x0 + 0.2;
  const hX1 = SW.x1 + 2.6;
  for (const x of [hX0, SW.x1 + 0.2, hX1]) for (const z of [-0.65, 0.65]) box(0.16, 4.6, 0.16, M.frame, x, 2.3, z);
  for (const z of [-0.65, 0.65]) box(hX1 - hX0, 0.18, 0.16, M.frame, (hX0 + hX1) / 2, 4.6, z);
  const trolley = box(0.4, 0.2, 1.4, M.dark, SW.cx, 4.45, 0);
  const hookRope = cyl(0.015, 0.015, 1, M.dark, root, 6);
  const maintX = SW.x1 + 2.0;
  box(1.2, 2.1, 1.0, M.frame, maintX, 1.05, 0).material = mat('#5d6a77', {metalness: 0.4});
  // the Aluswirler drive assembly: base plate, red motor, shaft, ceramic impeller
  const asmG = new THREE.Group();
  root.add(asmG);
  const plate = box(1.3, 0.1, 0.9, mat('#7fd27f', {metalness: 0.3}), 0, 0.05, 0, asmG);
  void plate;
  const aMotor = cyl(0.26, 0.26, 0.7, M.red, asmG);
  aMotor.position.set(0.2, 0.5, 0);
  const aBox = box(0.3, 0.35, 0.3, M.dark, 0.2, 0.95, 0.28, asmG);
  void aBox;
  const aShaft = cyl(0.07, 0.09, 1.1, mat('#3a3b3e'), asmG, 16);
  aShaft.position.set(0, -0.55, 0);
  const impG = new THREE.Group();
  impG.position.set(0, -1.32, 0);
  asmG.add(impG);
  const impMat = mat('#4a4c50', {roughness: 0.8, metalness: 0.1});
  const impBody = cyl(0.3, 0.3, 0.32, impMat, impG, 24);
  void impBody;
  for (let k = 0; k < 6; k++) {
    const v = box(0.12, 0.3, 0.05, M.dark, 0, -0.02, 0, impG);
    const ang6 = (k * Math.PI) / 3;
    v.position.x = Math.cos(ang6) * 0.28;
    v.position.z = Math.sin(ang6) * 0.28;
    v.rotation.y = -ang6;
  }
  const clipsM = mat('#f0c419');
  const clipBlocks = [[-0.6, -0.4], [0.6, -0.4], [-0.6, 0.4], [0.6, 0.4]].map(([x, z]) => box(0.12, 0.1, 0.12, clipsM, x, 0.12, z, asmG));
  const NBU = 24;
  const bubbles = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshStandardMaterial({color: '#f2f5f7', transparent: true, opacity: 0.8}), NBU);
  bubbles.frustumCulled = false;
  root.add(bubbles);
  // the extraction pump (green) over the pump well, the launder to HC#1, and its stand when removed
  const pumpG = new THREE.Group();
  root.add(pumpG);
  box(0.3, 0.12, 1.0, M.frame, 0, 0.06, 0, pumpG);
  const pMotor = cyl(0.25, 0.25, 0.7, M.green, pumpG);
  pMotor.position.set(0, 0.5, 0);
  const pShaft = cyl(0.05, 0.05, 1.3, M.rod, pumpG);
  pShaft.position.set(0, -0.6, 0);
  box(0.9, 0.9, 0.9, M.frame, SW.x1 + 1.2, 0.45, -2.2);
  const launder = box(2.6, 0.18, 0.32, M.ladle, SW.x1 + 1.3, wTop - 0.1, wellZ.pump - 0.25);
  void launder;
  const pumpStream = box(2.4, 0.05, 0.2, new THREE.MeshStandardMaterial({color: '#d9dde1', metalness: 0.8, roughness: 0.25, emissive: '#ff7a33', emissiveIntensity: 0.2}), SW.x1 + 1.35, wTop - 0.0, wellZ.pump - 0.25);
  box(0.4, 2.4, 2.4, M.steel, SW.x1 + 2.8, 1.2, -1.6);
  // plugs on the outer wall: manual plugs (Aluswirler and vortex wells), pneumatic plug and manual plug (pump well)
  const PLUGS = {
    vortexB: {z: wellZ.vortex, y: base + 0.32},
    aswA: {z: wellZ.asw, y: base + 0.32},
    pneu: {z: wellZ.pump + 0.22, y: base + 0.32},
    pumpM: {z: wellZ.pump - 0.25, y: base + 0.32},
  };
  const plugObj = {};
  for (const [k, p] of Object.entries(PLUGS)) {
    const g = new THREE.Group();
    g.position.set(SW.x1 + 0.1, p.y, p.z);
    root.add(g);
    const m = mat(k === 'pneu' ? '#d0a020' : '#a0a7ae', {metalness: 0.5});
    const body = cyl(0.08, 0.08, 0.22, m, g, 16);
    body.rotation.z = Math.PI / 2;
    const lockM = mat('#c0322b');
    const lock = box(0.06, 0.22, 0.06, lockM, 0.14, 0, 0, g);
    if (k === 'pneu') {
      const actr = cyl(0.06, 0.06, 0.4, M.air || M.rod, g, 12);
      actr.position.set(0.1, 0.25, 0);
    }
    const tray = box(0.55, 0.3, 0.4, mat('#5a636c'), SW.x1 + 0.45, 0.15, p.z);
    const stream = cyl(0.03, 0.04, 1, new THREE.MeshStandardMaterial({color: '#d9dde1', metalness: 0.8, roughness: 0.25, emissive: '#ff7a33', emissiveIntensity: 0.3}));
    plugObj[k] = {g, body, lock, tray, stream};
  }
  // the cabinet with the light column and the gas manometer
  const cab = new THREE.Group();
  cab.position.set(xo - 0.4, 0, -zo - 1.6);
  root.add(cab);
  box(1.6, 2.0, 0.5, mat('#c9ced3', {metalness: 0.3}), 0, 1.0, 0, cab);
  const lampCol = ['#e02020', '#f5a000', '#21b34a'];
  const lamps = lampCol.map((c, i) => {
    const m = new THREE.MeshStandardMaterial({color: c, emissive: new THREE.Color(c), emissiveIntensity: 0, transparent: true, opacity: 0.92});
    const l = cyl(0.07, 0.07, 0.12, m, cab, 20);
    l.position.set(0.6, 2.2 + (2 - i) * 0.125, 0);
    return m;
  });
  const fanLamp = new THREE.MeshStandardMaterial({color: '#f2f2f2', emissive: new THREE.Color('#ffd23a'), emissiveIntensity: 0});
  box(0.1, 0.1, 0.04, fanLamp, -0.3, 1.5, 0.27, cab);
  // thermocouples
  const tcV = cyl(0.03, 0.03, 0.9, M.rod, roofG);
  tcV.position.set(-0.8, vault + 0.1, 0.6);
  const slagLayer = new THREE.Mesh(new THREE.PlaneGeometry(2 * hx - 0.1, 2 * hz - 0.1), new THREE.MeshStandardMaterial({color: '#6e6256', roughness: 1, transparent: true, opacity: 0.8}));
  slagLayer.rotation.x = -Math.PI / 2;
  root.add(slagLayer);

  // ------------------------------------------------------------ highlight and anchors
  const hiMat = new THREE.LineBasicMaterial({color: ACCENT, transparent: true, opacity: 0.9, depthTest: false});
  const hi = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), hiMat);
  hi.renderOrder = 10;
  scene.add(hi);
  const HI = {
    burners: [new V3(0, G.burnerY, bz - 0.5), new V3(3.0, 1.2, 1.3)],
    door: [new V3(dx, 2.2, 0), new V3(0.6, 2.8, 2 * G.doorZ + 0.6)],
    tilt: [new V3(pivot.x - 1.1, 1.5, 0), new V3(2.8, 2.6, 2.2)],
    vortex: [new V3(SW.cx, base + 1.2, wellZ.vortex), new V3(2.2, 2.4, 1.2)],
    asw: [new V3(SW.cx + 1.2, 2.5, 0), new V3(5, 4.6, 1.6)],
    pump: [new V3(SW.cx, base + 1.4, wellZ.pump), new V3(2.2, 2.8, 1.2)],
    plugs: [new V3(SW.x1 + 0.3, 0.6, 0), new V3(0.9, 1.2, 3.4)],
    cabinet: [new V3(xo - 0.4, 1.3, -zo - 1.6), new V3(1.9, 2.8, 0.9)],
    bath: [new V3(0, fy + 0.5, 0), new V3(2 * hx + 0.1, 1.1, 2 * hz + 0.1)],
  };
  const ANCHORS = {
    burner1: new V3(G.burnerX[0], G.burnerY, -hz + 0.9),
    burner2: new V3(G.burnerX[1], G.burnerY, -hz + 0.9),
    door: new V3(dx - 0.2, G.doorTop + 0.3, 0),
    ladle: new V3(pivot.x - 1.0, 2.2, 0),
    vortex: new V3(SW.cx, wTop + 0.2, wellZ.vortex + 0.3),
    asw: new V3(SW.cx, 3.0, 0),
    pump: new V3(SW.cx, wTop + 1.0, wellZ.pump),
    plugs: new V3(SW.x1 + 0.3, 0.7, 0),
    cabinet: new V3(xo - 0.4, 2.7, -zo - 1.6),
    bath: new V3(-0.6, fy + 0.6, 0.2),
    conveyor: new V3(SW.x1 + 2.2, 3.4, wellZ.vortex),
  };

  const state = {cutK: 0};
  const tmp = new V3();
  const dm = new THREE.Object3D();
  const hash = (i) => {
    const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  };

  function update(s, opt) {
    const T = s.t;
    const lvl = levelOf(s) / 1000;
    const ck = opt.cut;
    state.cutK = ck;
    cutTop.constant = 99 * (1 - ck) + (vault - 0.05) * ck;
    cutFront.constant = 99 * (1 - ck) + (hz + 0.02) * ck;
    roofG.visible = ck < 0.5;
    const by = G.floor;
    bath.visible = lvl > 0.005;
    bath.scale.set(1, Math.max(0.001, lvl), 1);
    bath.position.set(0, by + lvl / 2, 0);
    const glow = clamp((s.alT - 600) / 300, 0, 1);
    M.bath.emissiveIntensity = 0.04 + 0.14 * glow;
    M.refr.emissiveIntensity = clamp((s.chT - 550) / 500, 0, 0.35) * 0.25;
    slagLayer.visible = lvl > 0.01 && s.chamberSlag > 0.02;
    slagLayer.position.set(0, by + lvl + 0.01, 0);
    slagLayer.material.opacity = 0.25 + 0.6 * s.chamberSlag;
    // the wells share the bath level
    const bathTop = by + lvl;
    for (const w of Object.values(wells)) {
      const h = Math.max(0.001, bathTop - base - 0.3);
      w.metal.visible = lvl > 0.02;
      w.metal.scale.y = h;
      w.metal.position.y = 0.3 + h / 2;
    }
    // flames in the chamber
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
    });
    const vcol = (m, on, bad) => m.color.set(bad ? '#d33' : on ? '#3bb44a' : '#f2f2f2');
    vcol(v70Y1, s.mainValve, s.tight === 'FAIL');
    vcol(vB[0], s.burner[0] === 'on', s.burner[0] === 'fail');
    vcol(vB[1], s.burner[1] === 'on', s.burner[1] === 'fail');
    const purging = s.fan.run && s.fan.purge < P.purge;
    fanHub.material.color.set(s.fan.run ? '#3bb44a' : '#ffffff');
    fanHub.rotation.x = s.fan.run ? T * 40 : 0;
    // main door
    const lift = s.door.pos * (G.doorTop - G.sill + 0.15);
    door.position.set(dx, doorY0 + lift, 0);
    const rodTop = gTop - 1.75;
    const rodBot = door.position.y + doorH / 2;
    between(lRod, new V3(dx - 0.05, rodBot, 0), new V3(dx - 0.05, rodTop, 0));
    lClamp.position.set(dx - 0.05, rodBot, 0);
    // tilting platform and ladle
    const ang = s.ladle.tilt * (TILT_MAX * Math.PI) / 180;
    tiltG.rotation.z = -ang;
    arms.forEach((a) => {
      const k = 1;
      a.position.set(-1.0, 0.45 + 0.35 * k, a.userData.sz * (0.95 - 0.05 * k));
      a.rotation.x = a.userData.sz * 0.35;
    });
    const fillK = s.ladle.t / P.ladleT;
    ladleMetal.visible = fillK > 0.01 && s.ladle.tilt < 0.6;
    const hgt = 0.15 + 1.05 * Math.sqrt(fillK);
    ladleMetal.position.y = hgt;
    const rr = 0.62 + ((0.82 - 0.62) * hgt) / 1.25 - 0.06;
    ladleMetal.scale.set(rr, rr, 1);
    ladleMetal.rotation.set(-Math.PI / 2, 0, 0);
    ladleMetal.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new V3(0, 0, 1), ang));
    tiltG.updateMatrixWorld();
    const att = tAttach.clone().applyMatrix4(tiltG.matrixWorld);
    const d = att.clone().sub(tBase);
    const mid = tBase.clone().addScaledVector(d.clone().normalize(), 1.25);
    between(tBarrel, tBase, mid);
    between(tRod, mid.clone().addScaledVector(d.clone().normalize(), -0.1), att);
    const pouring = s.ladle.pouring && s.ladle.tilt > 0.6 && s.ladle.t > 0;
    stream.visible = pouring;
    if (pouring) {
      ladleG.updateMatrixWorld();
      const lip = new V3(1.0, 1.38, 0).applyMatrix4(ladleG.matrixWorld);
      between(stream, lip, new V3(Math.min(-hx + 0.5, lip.x + 0.6), by + lvl, 0));
      stream.scale.x = stream.scale.z = 1.0;
    }
    hpuMotor.rotation.y = s.door.cmd || s.ladle.pouring ? T * 30 : 0;
    // vortex well surface
    vSurf.position.y = bathTop;
    vSurf.visible = lvl > 0.02;
    const depth = 0.28 * s.vortex.depth;
    for (let i = 0; i < vPos.count; i++) {
      const r = vR[i];
      const a2 = Math.atan2(vPos.getZ(i), vPos.getX(i));
      vPos.setY(i, -depth * Math.exp(-((r / 0.22) ** 2)) + depth * 0.2 * (r / VR) ** 2 + 0.01 * Math.sin(a2 * 4 - T * 8) * (r / VR) * s.vortex.depth);
    }
    vPos.needsUpdate = true;
    vGeo.computeVertexNormals();
    // chips: on the belt and falling into the vortex while feeding, floating flakes when the vortex does not swallow
    const feeding = s.scrap.on;
    for (let i = 0; i < NCH; i++) {
      const float = i < Math.min(NCH, Math.round(s.scrap.buffer * 1.5));
      if (float) {
        const ra = 0.12 + 0.25 * hash(i);
        const an = hash(i + 3) * 6.28 + T * (s.asw.rpm / 60) * 0.5;
        dm.position.set(SW.cx + Math.cos(an) * ra, bathTop + 0.01, wellZ.vortex + Math.sin(an) * ra);
        dm.rotation.set(hash(i) * 3, an, 0);
        dm.scale.setScalar(0.06);
      } else if (feeding) {
        const ph = (T * 0.35 + hash(i)) % 1;
        if (ph < 0.75) {
          const u = ph / 0.75;
          dm.position.set(SW.x1 + 2.9 - u * 2.6, 3.5 - u * 0.75 + 0.06, wellZ.vortex + (hash(i + 1) - 0.5) * 0.3);
        } else {
          const u = (ph - 0.75) / 0.25;
          dm.position.set(SW.x1 + 0.3 - u * 0.5, 2.75 - u * u * (2.75 - bathTop), wellZ.vortex + (hash(i + 1) - 0.5) * 0.3);
        }
        dm.rotation.set(ph * 7, ph * 5, 0);
        dm.scale.setScalar(0.05);
      } else {
        dm.position.set(0, -9, 0);
        dm.scale.setScalar(0);
      }
      dm.updateMatrix();
      chips.setMatrixAt(i, dm.matrix);
    }
    chips.instanceMatrix.needsUpdate = true;
    flameV.visible = s.scrap.flames > 0.05;
    flameV.position.y = bathTop + 0.4;
    flameV.scale.set(1, 0.6 + 0.4 * s.scrap.flames + 0.15 * Math.sin(T * 17), 1);
    flameV.material.opacity = 0.65 * s.scrap.flames;
    // the Aluswirler assembly on the hoist
    const a = s.asw;
    const impBottomWork = base + 0.32;
    let ax = SW.cx;
    let ay = wTop; // plate height
    if (a.pos === 'raised' || a.pos === 'over') ay = wTop + 1.6;
    else if (a.pos === 'maint') {
      ax = maintX;
      ay = 2.1 + 1.55;
    } else if (a.pos === 'lowering') {
      const bottom = bathTop + 0.025 - a.immersion * 0.9;
      ay = Math.max(wTop, wTop + (bottom - impBottomWork));
    }
    asmG.position.set(ax, ay, 0);
    impG.visible = a.imp.present;
    impMat.color.set(a.imp.cracked ? '#8a3a2a' : a.imp.newPiece && !a.imp.retightened ? '#5b5e63' : '#4a4c50');
    impG.rotation.y = (T * a.rpm * 2 * Math.PI) / 60;
    aMotor.material = a.rpm > 5 ? M.green : M.red;
    clipBlocks.forEach((c) => c.position.setY(a.clips ? 0.12 : 0.3));
    trolley.position.x = ax;
    between(hookRope, new V3(ax, 4.35, 0), new V3(ax, ay + 1.0, 0));
    // steam bubbles from a new ceramic piece for about 30 min after it first touches the metal
    const bubOn = a.imp.newPiece && s.t - a.imp.firstWet < P.bubbles && s.t - a.imp.firstWet > 0;
    for (let i = 0; i < NBU; i++) {
      if (bubOn) {
        const ph = (T * 0.8 + hash(i)) % 1;
        const an = hash(i + 7) * 6.28;
        dm.position.set(ax + Math.cos(an) * (0.1 + 0.08 * ph), bathTop + 0.01 + 0.02 * Math.sin(ph * 6), Math.sin(an) * (0.1 + 0.08 * ph));
        dm.scale.setScalar(0.025 * (1 - ph) + 0.005);
      } else {
        dm.position.set(0, -9, 0);
        dm.scale.setScalar(0);
      }
      dm.updateMatrix();
      bubbles.setMatrixAt(i, dm.matrix);
    }
    bubbles.instanceMatrix.needsUpdate = true;
    // extraction pump
    pumpG.position.set(s.pump.in ? SW.cx : SW.x1 + 1.2, s.pump.in ? wTop : 0.9, s.pump.in ? wellZ.pump : -2.2);
    pMotor.material = s.pump.flow > 0.01 ? M.green : M.red;
    pumpStream.visible = s.pump.flow > 0.05;
    // plugs, locks, trays and the draining streams
    for (const [k, o] of Object.entries(plugObj)) {
      const p = s.plugs[k];
      o.lock.visible = p.lock;
      o.body.position.x = p.open ? 0.25 : 0;
      o.tray.visible = p.tray;
      const flowing = p.open && lvl > 0.003;
      o.stream.visible = flowing;
      if (flowing) between(o.stream, new V3(SW.x1 + 0.2, PLUGS[k].y - 0.05, PLUGS[k].z), new V3(SW.x1 + 0.45, 0.3, PLUGS[k].z));
    }
    // light column: red on an alarm (blinking until silenced), amber while purging, green with the burners on
    const alarm = s.alarms.some((x) => x.active);
    const blink = Math.floor(T * 2) % 2 === 0;
    lamps[0].emissiveIntensity = alarm && (blink || s.silenced) ? 1.6 : 0.02;
    lamps[1].emissiveIntensity = purging ? (blink ? 1.4 : 0.2) : 0.02;
    lamps[2].emissiveIntensity = s.burner.some((b) => b === 'on') ? 1.4 : 0.02;
    fanLamp.emissiveIntensity = !s.fan.run ? 0 : purging ? (blink ? 1.2 : 0) : 1.2;
    const h = opt.focus && HI[opt.focus];
    hi.visible = !!h && opt.hiK > 0.01;
    if (h) {
      hi.position.copy(h[0]);
      hi.scale.copy(h[1]);
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
