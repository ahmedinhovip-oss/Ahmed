// The ingot casting machine in 3D, at its real size: the base frame with its water tank, the two chains and the moulds
// running round the front and rear sprockets, the distributor star wheel under the launder from the tilting furnace,
// the spray headers under the top strand, the two hammers and the discharge with its ingot stack, the 5 HP motor and
// Sumiko gearbox, the cooling tower with its fan and the inlet / outlet pumps, the VFD panel, the IR temperature
// panel, the pedestal fan and the operator at the discharge. Ingots glow by their temperature.
import * as THREE from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {mouldPose, mouldU, N, P, U_POUR} from './model.js';

const V3 = THREE.Vector3;
const ACCENT = 0xe3562a;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const mat = (color, o = {}) => new THREE.MeshStandardMaterial({color, roughness: 0.55, metalness: 0.3, ...o});
const L = P.length;
const R = P.radius;
const TOP = 1.15; // chain top strand height
const W = 0.72; // mould length across the machine [A]

// metal colour by temperature
const C_SOLID = new THREE.Color('#c4c9ce');
const C_DULL = new THREE.Color('#6a2a16');
const C_RED = new THREE.Color('#e0491b');
const C_HOT = new THREE.Color('#ffc35a');
function metalColor(T, out) {
  if (T < 250) return out.copy(C_SOLID);
  if (T < 450) return out.copy(C_SOLID).lerp(C_DULL, (T - 250) / 200);
  if (T < 620) return out.copy(C_DULL).lerp(C_RED, (T - 450) / 170);
  return out.copy(C_RED).lerp(C_HOT, clamp((T - 620) / 130, 0, 1));
}

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true});
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const scene = new THREE.Scene();
  const BG = new THREE.Color('#e9e6e0');
  scene.background = BG;
  scene.fog = new THREE.Fog(BG, 40, 80);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.5;
  const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 200);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb9b2a6, 1.4));
  const sun = new THREE.DirectionalLight(0xffffff, 2.0);
  sun.position.set(-6, 14, 9);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  Object.assign(sun.shadow.camera, {left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 50});
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 40), mat('#dedad2', {roughness: 0.95, metalness: 0}));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const grid = new THREE.GridHelper(40, 40, 0xcfc9be, 0xd6d1c7);
  grid.position.y = 0.003;
  scene.add(grid);
  const M = {
    frame: mat('#2f5d6b', {metalness: 0.4}),
    guard: mat('#d6df4c', {metalness: 0.1, roughness: 0.6}),
    mould: mat('#b9bec3', {metalness: 0.7, roughness: 0.35}),
    chain: mat('#2a2d31', {metalness: 0.7}),
    steel: mat('#7d868f', {metalness: 0.6}),
    tank: mat('#5b7f93', {metalness: 0.3}),
    pipe: mat('#c3c6c9', {metalness: 0.1}),
    motor: mat('#2f6fa8'),
    gear: mat('#3c4248'),
    dist: mat('#7b5a43', {metalness: 0.5, roughness: 0.7}),
    furnace: mat('#5d646b', {metalness: 0.4}),
    refr: mat('#b8a48a', {roughness: 0.9, metalness: 0}),
    tower: mat('#6aa38a', {metalness: 0.1, roughness: 0.5}),
    pump: mat('#2c5f9e'),
    panel: mat('#d1d4d8', {metalness: 0.2}),
    dark: mat('#2f3439'),
    metal: new THREE.MeshStandardMaterial({color: '#ff8a2a', emissive: new THREE.Color('#ff6a10'), emissiveIntensity: 1.2, roughness: 0.4}),
    water: new THREE.MeshStandardMaterial({color: '#6fb4e8', transparent: true, opacity: 0.55, roughness: 0.2}),
    flame: new THREE.MeshStandardMaterial({color: '#6aa8ff', emissive: new THREE.Color('#3b7bff'), emissiveIntensity: 2, transparent: true, opacity: 0.75}),
  };
  const root = new THREE.Group();
  scene.add(root);
  const box = (w, h, d, m, x, y, z, parent = root) => {
    const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    o.position.set(x, y, z);
    o.castShadow = o.receiveShadow = true;
    parent.add(o);
    return o;
  };
  const cyl = (r1, r2, h, m, parent = root, seg = 24) => {
    const o = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), m);
    o.castShadow = o.receiveShadow = true;
    parent.add(o);
    return o;
  };
  // base frame, trusses, water tank [M items 4, 11]
  for (const z of [-0.62, 0.62]) {
    box(L + 0.6, 0.12, 0.1, M.frame, 0, 0.12, z);
    box(L + 0.6, 0.12, 0.1, M.frame, 0, TOP - 2 * R - 0.12, z);
    for (let x = -L / 2; x <= L / 2 + 0.01; x += L / 6) box(0.1, TOP - 2 * R - 0.12, 0.1, M.frame, x, (TOP - 2 * R) / 2, z);
    for (let k = 0; k < 6; k++) {
      const d = box(Math.hypot(L / 6, TOP - 2 * R - 0.24), 0.07, 0.06, M.frame, -L / 2 + (k + 0.5) * (L / 6), (TOP - 2 * R) / 2, z);
      d.rotation.z = (k % 2 ? 1 : -1) * Math.atan2(TOP - 2 * R - 0.24, L / 6);
    }
    // guards along the top strand
    box(L, 0.14, 0.05, M.guard, 0, TOP + 0.07, z * 1.03);
  }
  box(L - 1.2, 0.35, 1.05, M.tank, 0.2, 0.32, 0); // water tank under the machine
  // shafts and sprockets [M items 5, 6, 8, 10]
  const sprockets = [];
  for (const x of [-L / 2, L / 2]) {
    const sh = cyl(0.05, 0.05, 1.6, M.steel);
    sh.rotation.x = Math.PI / 2;
    sh.position.set(x, TOP - R, 0);
    for (const z of [-0.58, 0.58]) {
      const sp = cyl(R + 0.03, R + 0.03, 0.05, M.chain, root, 18);
      sp.rotation.x = Math.PI / 2;
      sp.position.set(x, TOP - R, z);
      sprockets.push(sp);
      box(0.22, 0.18, 0.16, M.dark, x, TOP - R, z * 1.3); // plummer blocks
    }
    box(0.4, TOP - R - 0.1, 0.12, M.frame, x, (TOP - R) / 2, -0.8);
    box(0.4, TOP - R - 0.1, 0.12, M.frame, x, (TOP - R) / 2, 0.8);
  }
  // tension screws at the rear shaft [M item 9]
  for (const z of [-0.8, 0.8]) {
    const ts = cyl(0.02, 0.02, 0.5, M.steel);
    ts.rotation.z = Math.PI / 2;
    ts.position.set(L / 2 + 0.3, TOP - R, z);
  }
  // chains: two dark bands along both strands
  for (const z of [-0.55, 0.55]) {
    box(L, 0.04, 0.05, M.chain, 0, TOP - 0.06, z);
    box(L, 0.04, 0.05, M.chain, 0, TOP - 2 * R + 0.06, z);
  }
  // moulds and ingots
  const mGeo = new THREE.BoxGeometry(PITCH_W(), 0.11, W);
  const moulds = new THREE.InstancedMesh(mGeo, M.mould, N);
  moulds.castShadow = moulds.receiveShadow = true;
  moulds.frustumCulled = false;
  root.add(moulds);
  const ingots = new THREE.InstancedMesh(new THREE.BoxGeometry(PITCH_W() * 0.78, 0.07, W * 0.86), new THREE.MeshStandardMaterial({color: '#ffffff', metalness: 0.5, roughness: 0.4}), N);
  ingots.frustumCulled = false;
  ingots.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3);
  root.add(ingots);
  // stack of released ingots at the discharge
  const NST = 80;
  const stack = new THREE.InstancedMesh(new THREE.BoxGeometry(0.66, 0.07, 0.16), mat('#c4c9ce', {metalness: 0.7, roughness: 0.35}), NST);
  stack.castShadow = true;
  stack.frustumCulled = false;
  root.add(stack);
  box(1.2, 0.08, 1.2, M.steel, -L / 2 - 1.1, 0.04, 0); // pallet
  const chute = box(0.9, 0.04, 0.9, M.steel, -L / 2 - 0.55, 0.45, 0);
  chute.rotation.z = 0.7;
  // distributor star wheel [M item 3]
  const distG = new THREE.Group();
  distG.position.set(L / 2 - U_POUR, TOP + 0.45, 0);
  root.add(distG);
  const hub = cyl(0.22, 0.22, 0.5, M.dist, distG, 20);
  hub.rotation.x = Math.PI / 2;
  for (let k = 0; k < 12; k++) {
    const sp = box(0.12, 0.2, 0.42, M.dist, 0, 0, 0, distG);
    const a = (k / 12) * Math.PI * 2;
    sp.position.set(Math.cos(a) * 0.3, Math.sin(a) * 0.3, 0);
    sp.rotation.z = a;
  }
  const dshaft = cyl(0.03, 0.03, 1.5, M.steel);
  dshaft.rotation.x = Math.PI / 2;
  dshaft.position.set(L / 2 - U_POUR, TOP + 0.45, 0.6);
  for (const z of [-0.8, 0.8]) box(0.08, 0.6, 0.08, M.frame, L / 2 - U_POUR, TOP + 0.15, z);
  // furnace and launder
  const furnace = new THREE.Group();
  furnace.position.set(L / 2 + 3.2, 1.6, 0);
  root.add(furnace);
  box(2.0, 1.6, 2.0, M.furnace, 0, 0, 0, furnace);
  box(1.6, 0.1, 1.6, M.refr, 0, 0.82, 0, furnace);
  box(0.6, 0.12, 0.25, M.refr, -1.2, 0.5, 0, furnace); // spout
  box(0.4, 1.6, 2.2, M.frame, 0, -0.8, 0).position.set(L / 2 + 3.2, 0.4, 0);
  const launder = new THREE.Group();
  root.add(launder);
  const lFrom = new V3(L / 2 + 1.9, 2.0, 0);
  const lTo = new V3(L / 2 - U_POUR + 0.1, TOP + 0.85, 0);
  const lDir = lTo.clone().sub(lFrom);
  const lLen = lDir.length();
  const ld = box(lLen, 0.14, 0.26, M.refr, 0, 0, 0, launder);
  launder.position.copy(lFrom).add(lTo).multiplyScalar(0.5);
  launder.rotation.z = Math.atan2(lDir.y, lDir.x);
  void ld;
  const stream = box(lLen, 0.04, 0.12, M.metal, 0, 0.07, 0, launder);
  const fall = cyl(0.03, 0.03, 0.4, M.metal);
  fall.position.set(L / 2 - U_POUR, TOP + 0.65, 0);
  // spray headers under the top strand and the water jets [M]
  for (const z of [-0.3, 0.3]) {
    const p = cyl(0.045, 0.045, L - 1.6, M.pipe);
    p.rotation.z = Math.PI / 2;
    p.position.set(-0.3, TOP - 0.35, z);
  }
  const NJ = 120;
  const jets = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.012, 0.004, 1, 5), M.water, NJ);
  jets.frustumCulled = false;
  root.add(jets);
  // hammers at the discharge [M item 13]
  const hammers = [-0.25, 0.25].map((z) => {
    const g = new THREE.Group();
    g.position.set(-L / 2 + 0.15, TOP - 2 * R - 0.2, z);
    root.add(g);
    box(0.06, 0.06, 0.06, M.steel, 0, 0, 0, g);
    const arm = box(0.05, 0.05, 0.6, M.steel, 0, 0, 0, g);
    arm.rotation.y = Math.PI / 2;
    arm.position.set(0.3, 0, 0);
    box(0.12, 0.12, 0.12, M.dark, 0.58, 0, 0, g);
    return g;
  });
  for (const z of [-0.8, 0.8]) box(0.08, TOP - 2 * R, 0.08, M.frame, -L / 2 + 0.15, (TOP - 2 * R) / 2, z);
  const hbar = cyl(0.03, 0.03, 1.6, M.steel);
  hbar.rotation.x = Math.PI / 2;
  hbar.position.set(-L / 2 + 0.15, TOP - 2 * R - 0.2, 0);
  // drive: 5 HP motor and gearbox on the front shaft [M items 1, 7]
  const drive = new THREE.Group();
  drive.position.set(-L / 2, TOP - R, 1.25);
  root.add(drive);
  box(0.5, 0.45, 0.4, M.gear, 0, -0.1, 0, drive);
  const mot = cyl(0.17, 0.17, 0.55, M.motor.clone(), drive, 20);
  mot.position.set(0, -0.6, 0);
  box(0.6, 0.06, 0.6, M.frame, 0, -0.95, 0, drive);
  // cooling tower and pumps
  const tower = new THREE.Group();
  tower.position.set(L / 2 - 1.5, 0, -4.2);
  root.add(tower);
  cyl(1.0, 1.15, 1.8, M.tower, tower, 32).position.y = 1.2;
  box(2.4, 0.3, 2.4, M.tank, 0, 0.15, 0, tower);
  const fanBlades = new THREE.Group();
  fanBlades.position.y = 2.15;
  tower.add(fanBlades);
  for (let k = 0; k < 4; k++) {
    const b = box(0.85, 0.02, 0.16, M.dark, 0, 0, 0, fanBlades);
    b.rotation.y = (k * Math.PI) / 2;
    b.position.set(Math.cos((k * Math.PI) / 2) * 0.42, 0, -Math.sin((k * Math.PI) / 2) * 0.42);
  }
  cyl(0.12, 0.12, 0.3, M.motor, tower, 16).position.y = 2.35;
  const pumps = [L / 2 - 3.3, L / 2 - 4.3].map((x) => {
    const g = new THREE.Group();
    g.position.set(x, 0, -2.6);
    root.add(g);
    const m = cyl(0.13, 0.13, 0.42, M.pump.clone(), g, 18);
    m.rotation.z = Math.PI / 2;
    m.position.set(0, 0.3, 0);
    box(0.24, 0.24, 0.24, M.pump, -0.3, 0.3, 0, g);
    box(0.7, 0.08, 0.35, M.frame, -0.1, 0.06, 0, g);
    return m;
  });
  for (const [x, z1, z2] of [[L / 2 - 3.6, -2.6, -0.7], [L / 2 - 4.6, -2.6, -0.7]]) {
    const p = cyl(0.05, 0.05, Math.abs(z2 - z1), M.pipe);
    p.rotation.x = Math.PI / 2;
    p.position.set(x, 0.3, (z1 + z2) / 2);
  }
  // VFD panel and IR temperature panel [M]
  const panel = new THREE.Group();
  panel.position.set(-L / 2 + 2.2, 0, 2.3);
  root.add(panel);
  box(0.9, 1.1, 0.4, M.panel, 0, 1.0, 0, panel);
  box(0.06, 0.5, 0.3, M.frame, -0.3, 0.25, 0, panel);
  box(0.06, 0.5, 0.3, M.frame, 0.3, 0.25, 0, panel);
  const lampMat = new THREE.MeshStandardMaterial({color: '#21b34a', emissive: new THREE.Color('#21b34a'), emissiveIntensity: 0});
  box(0.06, 0.06, 0.03, lampMat, -0.25, 1.35, 0.21, panel);
  box(0.6, 0.45, 0.25, M.panel, 1.0, 1.3, 0, panel);
  box(0.06, 1.1, 0.06, M.frame, 1.0, 0.55, 0, panel);
  // pedestal fan at the discharge [M]
  const pfan = new THREE.Group();
  pfan.position.set(-L / 2 - 0.9, 0, -1.4);
  root.add(pfan);
  cyl(0.03, 0.03, 1.2, M.dark, pfan, 8).position.y = 0.6;
  const pblades = new THREE.Group();
  pblades.position.set(0.05, 1.25, 0.12);
  pblades.rotation.y = 0.9;
  pfan.add(pblades);
  for (let k = 0; k < 3; k++) {
    const b = box(0.04, 0.24, 0.01, M.steel, 0, 0, 0, pblades);
    b.geometry.translate(0, 0.12, 0);
    b.rotation.z = (k * 2 * Math.PI) / 3;
  }
  // operator at the discharge with a hammer [M]
  const op = new THREE.Group();
  op.position.set(-L / 2 - 0.4, 0, 1.35);
  root.add(op);
  const ob = cyl(0.2, 0.22, 1.1, mat('#c0322b'), op, 16);
  ob.position.y = 0.95;
  const oh = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), mat('#8a5a3a'));
  oh.position.y = 1.65;
  op.add(oh);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat('#f1f1f1'));
  helmet.position.y = 1.68;
  op.add(helmet);
  for (const dz of [-0.09, 0.09]) cyl(0.07, 0.07, 0.45, M.dark, op, 10).position.set(0, 0.22, dz);
  // torches (preheat)
  const torchD = cyl(0.0, 0.1, 0.5, M.flame);
  torchD.position.set(L / 2 - U_POUR + 0.5, TOP + 0.45, 0.4);
  torchD.rotation.z = Math.PI / 2;
  const torchM = cyl(0.0, 0.08, 0.4, M.flame);
  torchM.position.set(L / 2 - 2.2, TOP + 0.35, 0);
  torchM.rotation.x = Math.PI;

  // highlight and anchors
  const hiMat = new THREE.LineBasicMaterial({color: ACCENT, transparent: true, opacity: 0.9, depthTest: false});
  const hi = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), hiMat);
  hi.renderOrder = 10;
  scene.add(hi);
  const HI = {
    dist: [new V3(L / 2 - U_POUR, TOP + 0.5, 0), new V3(1.0, 1.0, 1.0)],
    moulds: [new V3(0, TOP - R, 0), new V3(L + 0.8, 2 * R + 0.3, 1.5)],
    disch: [new V3(-L / 2 - 0.4, TOP - R, 0), new V3(1.6, 1.6, 1.8)],
    drive: [new V3(-L / 2, TOP - R - 0.4, 1.25), new V3(0.8, 1.2, 0.7)],
    water: [new V3(L / 2 - 2.5, 1.1, -2.8), new V3(4.5, 2.6, 4.0)],
    panel: [new V3(-L / 2 + 2.7, 1.1, 2.3), new V3(2.1, 1.0, 0.7)],
    spray: [new V3(-0.3, TOP - 0.3, 0), new V3(L - 1.2, 0.5, 1.0)],
  };
  const ANCHORS = {
    dist: new V3(L / 2 - U_POUR, TOP + 0.85, 0.3),
    furnace: new V3(L / 2 + 3.2, 2.5, 0),
    moulds: new V3(0, TOP + 0.1, 0.62),
    spray: new V3(-1, TOP - 0.35, 0.62),
    disch: new V3(-L / 2 - 0.3, TOP - 0.5, 0),
    hammer: new V3(-L / 2 + 0.6, TOP - 2 * R - 0.2, 0.3),
    stack: new V3(-L / 2 - 1.1, 0.4, 0),
    drive: new V3(-L / 2, TOP - R - 0.6, 1.4),
    tower: new V3(L / 2 - 1.5, 2.3, -4.2),
    pumps: new V3(L / 2 - 3.8, 0.5, -2.6),
    panel: new V3(-L / 2 + 2.2, 1.6, 2.3),
    ir: new V3(-L / 2 + 3.2, 1.6, 2.3),
  };
  const dm = new THREE.Object3D();
  const col = new THREE.Color();
  const tmp = new V3();
  function update(s, opt) {
    const T = s.t;
    // moulds and ingots on the loop
    for (let i = 0; i < N; i++) {
      const p = mouldPose(mouldU(s, i));
      dm.position.set(p.x, TOP + p.y, 0); // pose y is relative to the top strand
      dm.rotation.set(0, 0, p.ang);
      dm.scale.set(1, 1, 1);
      dm.updateMatrix();
      moulds.setMatrixAt(i, dm.matrix);
      const m = s.moulds[i];
      if (m.ingot) {
        const k = clamp(m.fill / P.ingot, 0.2, 1.25);
        dm.position.y += Math.cos(p.ang) * (0.03 + 0.02 * k);
        dm.position.x += -Math.sin(p.ang) * (0.03 + 0.02 * k);
        dm.scale.set(1, k, 1);
        dm.updateMatrix();
        ingots.setMatrixAt(i, dm.matrix);
        metalColor(m.Ti, col);
        ingots.setColorAt(i, col);
      } else {
        dm.scale.set(0, 0, 0);
        dm.updateMatrix();
        ingots.setMatrixAt(i, dm.matrix);
      }
    }
    moulds.instanceMatrix.needsUpdate = true;
    ingots.instanceMatrix.needsUpdate = true;
    ingots.instanceColor.needsUpdate = true;
    // sprockets and distributor turn with the chain
    for (const sp of sprockets) sp.rotation.y = -s.u / R;
    distG.rotation.z = s.u / 0.32;
    // stack of released ingots: rows of 5 crossed layer by layer
    const nst = Math.min(NST, s.made.released);
    for (let i = 0; i < NST; i++) {
      if (i < nst) {
        const layer = Math.floor(i / 5);
        const k = i % 5;
        const cross = layer % 2;
        dm.position.set(-L / 2 - 1.1 + (cross ? 0 : (k - 2) * 0.2), 0.12 + layer * 0.075, cross ? (k - 2) * 0.2 : 0);
        dm.rotation.set(0, cross ? 0 : Math.PI / 2, 0);
        dm.scale.set(1, 1, 1);
      } else dm.scale.set(0, 0, 0);
      dm.updateMatrix();
      stack.setMatrixAt(i, dm.matrix);
    }
    stack.instanceMatrix.needsUpdate = true;
    // furnace tilt and the stream
    const pouring = s.pour > 0;
    furnace.rotation.z = THREE.MathUtils.lerp(furnace.rotation.z, pouring ? 0.12 + 0.012 * s.pour : 0, 0.1);
    stream.visible = fall.visible = pouring;
    stream.scale.z = 0.6 + 0.04 * s.pour;
    M.metal.emissiveIntensity = 0.6 + 0.6 * clamp((s.metalT - 650) / 120, 0, 1);
    // water jets: up to the mould bottoms; too much pressure throws water over the moulds
    const flow = s.sprayFlow || 0;
    const over = s.spray > P.spill;
    for (let i = 0; i < NJ; i++) {
      if (flow > 0.02) {
        const x = -L / 2 + 1.0 + (i / NJ) * (L - 2.4);
        const z = i % 2 ? 0.3 : -0.3;
        const h = 0.2 + 0.12 * flow + (over ? 0.45 : 0);
        const ph = (T * 3 + i * 0.37) % 1;
        dm.position.set(x, TOP - 0.33 + h / 2, z + (over ? (ph - 0.5) * 0.4 : 0));
        dm.scale.set(1, h, 1);
      } else dm.scale.set(0, 0, 0);
      dm.rotation.set(0, 0, 0);
      dm.updateMatrix();
      jets.setMatrixAt(i, dm.matrix);
    }
    jets.instanceMatrix.needsUpdate = true;
    // hammers: knocking when free, held up when locked
    hammers.forEach((h, k) => {
      const knock = s.hammers === 'free' && s.v > 0.05 ? Math.max(0, Math.sin((s.u / 0.22) * Math.PI * 2 + k)) : 0;
      h.rotation.z = s.hammers === 'free' ? -0.35 + 0.4 * knock : 0.9;
    });
    // drive, tower fan, pumps, pedestal fan, torches, operator, lamps
    mot.material.color.set(s.convTrip ? '#d33' : s.v > 0.05 ? '#2fa04a' : '#2f6fa8');
    fanBlades.rotation.y += s.tower ? 0.35 : 0;
    pumps[0].material.color.set(s.wp1Trip ? '#d33' : s.wp1Run ? '#2fa04a' : '#2c5f9e');
    pumps[1].material.color.set(s.wp2 && s.mcb ? '#2fa04a' : '#2c5f9e');
    pblades.rotation.z += s.fan ? 0.5 : 0;
    torchD.visible = s.torchDist;
    torchM.visible = s.torchMould;
    torchD.scale.setScalar(0.9 + 0.2 * Math.sin(T * 30));
    torchM.scale.setScalar(0.9 + 0.2 * Math.sin(T * 27));
    op.visible = s.operator;
    lampMat.emissiveIntensity = s.conv ? 1.6 : 0;
    // vibration shakes the frame a little (shown ×)
    root.position.y = s.vib > 1 ? Math.sin(T * 60) * 0.002 * s.vib : 0;
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

function PITCH_W() {
  return P.pitch * 0.92;
}
