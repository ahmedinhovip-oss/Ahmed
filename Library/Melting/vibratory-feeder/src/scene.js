// The motorised vibratory feeder in 3D: the stand on its foundation bolts, four coil springs, the 500 × 2000 SS-304
// trough, the two unbalance vibratory motors on their bracket with eccentric weights you can see turning (in
// opposite directions when wired right), the bin above the inlet with its gate opening, scrap moving along the
// trough, and an overband magnet at the discharge lifting the iron pieces into their own bin [A]. The trough's
// motion is exaggerated ×25 so the millimetre stroke can be seen.
import * as THREE from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {P} from './model.js';

const V3 = THREE.Vector3;
const ACCENT = 0xe3562a;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const hash = (i) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
const SHOW = 25; // motion exaggeration
const mat = (color, o = {}) => new THREE.MeshStandardMaterial({color, roughness: 0.5, metalness: 0.3, ...o});

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true});
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const scene = new THREE.Scene();
  const BG = new THREE.Color('#e9e6e0');
  scene.background = BG;
  scene.fog = new THREE.Fog(BG, 14, 30);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.5;
  const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 100);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb9b2a6, 1.4));
  const sun = new THREE.DirectionalLight(0xffffff, 2.0);
  sun.position.set(-3, 7, 5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {left: -4, right: 4, top: 4, bottom: -4, near: 1, far: 20});
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(15, 64), mat('#dedad2', {roughness: 0.95, metalness: 0}));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const grid = new THREE.GridHelper(16, 32, 0xcfc9be, 0xd6d1c7);
  grid.position.y = 0.002;
  scene.add(grid);
  const M = {
    ss: mat('#c9cfd5', {metalness: 0.75, roughness: 0.3}),
    frame: mat('#4f6275', {metalness: 0.4}),
    concrete: mat('#c9c3b8', {roughness: 0.9, metalness: 0}),
    spring: mat('#c0322b', {metalness: 0.5}),
    motor: mat('#2f6fa8'),
    weight: mat('#f0c419'),
    dark: mat('#33393f'),
    bin: mat('#7d8994', {side: THREE.DoubleSide}),
    belt: mat('#2a2d31', {roughness: 0.8}),
    magnet: mat('#c0322b'),
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
  // trough frame of reference: x along the 2 m length (inlet at -1, discharge at +1), y up, z across
  const L = P.length;
  const W = P.width;
  const deckY = 0.9;
  // foundation, stand and springs
  box(2.4, 0.15, 1.1, M.concrete, 0, 0.075, 0);
  for (const x of [-0.85, 0.85]) for (const z of [-0.38, 0.38]) box(0.12, 0.55, 0.12, M.frame, x, 0.15 + 0.275, z);
  for (const z of [-0.38, 0.38]) box(1.9, 0.1, 0.12, M.frame, 0, 0.7, z);
  const springs = [];
  for (const x of [-0.85, 0.85])
    for (const z of [-0.38, 0.38]) {
      const pts = [];
      for (let k = 0; k <= 80; k++) {
        const a = (k / 80) * Math.PI * 2 * 6;
        pts.push(new V3(Math.cos(a) * 0.05, (k / 80) * 0.12, Math.sin(a) * 0.05));
      }
      const sp = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, 0.009, 6), M.spring);
      sp.position.set(x, 0.75, z);
      root.add(sp);
      springs.push(sp);
    }
  // the vibrating body: trough, side walls, motor bracket, motors
  const body = new THREE.Group();
  root.add(body);
  box(L, 0.012, W, M.ss, 0, deckY, 0, body);
  for (const z of [-W / 2, W / 2]) box(L, 0.16, 0.01, M.ss, 0, deckY + 0.08, z, body);
  box(0.01, 0.16, W, M.ss, -L / 2, deckY + 0.08, 0, body);
  box(L - 0.1, 0.06, 0.06, M.ss, 0, deckY - 0.04, -W / 2 + 0.05, body);
  box(L - 0.1, 0.06, 0.06, M.ss, 0, deckY - 0.04, W / 2 - 0.05, body);
  for (const x of [-0.85, 0.85]) box(0.16, 0.04, 0.9, M.ss, x, deckY - 0.03, 0, body);
  // motor bracket under the trough, inclined along the drive line (30°)
  const br = box(0.5, 0.02, 0.7, M.frame, -0.1, deckY - 0.22, 0, body);
  br.rotation.z = -0.52;
  const motors = [-1, 1].map((sz, m) => {
    const g = new THREE.Group();
    g.position.set(-0.1, deckY - 0.32, sz * 0.2);
    g.rotation.z = -0.52;
    body.add(g);
    const mb = cyl(0.11, 0.11, 0.26, M.motor, g, 24);
    mb.rotation.x = Math.PI / 2;
    // eccentric weights at both shaft ends, turning with the shaft
    const ws = [-1, 1].map((e) => {
      const wg = new THREE.Group();
      wg.position.z = e * 0.16;
      g.add(wg);
      const disc = cyl(0.1, 0.1, 0.035, M.dark, wg, 24);
      disc.rotation.x = Math.PI / 2;
      const sector = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.04, 24, 1, false, 0, Math.PI), M.weight);
      sector.rotation.x = Math.PI / 2;
      wg.add(sector);
      return {wg, sector};
    });
    const motorMat = mb.material;
    return {g, ws, motorMat, m};
  });
  // the bin above the inlet and its gate
  const bin = new THREE.Group();
  root.add(bin);
  const hop = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.22, 0.75, 4, 1, true), M.bin);
  hop.rotation.y = Math.PI / 4;
  hop.position.set(-0.65, deckY + 1.15, 0);
  hop.castShadow = true;
  bin.add(hop);
  for (const [x, z] of [[-1.05, -0.4], [-1.05, 0.4], [-0.25, -0.4], [-0.25, 0.4]]) box(0.06, 1.6, 0.06, M.frame, x, 0.8, z, bin);
  const gate = box(0.02, 0.3, W - 0.04, M.dark, -0.42, 0, 0, bin);
  // overband magnet at the discharge
  const mag = new THREE.Group();
  mag.position.set(L / 2 - 0.05, deckY + 0.55, 0);
  root.add(mag);
  box(0.9, 0.08, 0.7, M.belt, 0, -0.12, 0, mag);
  const magBox = box(0.55, 0.2, 0.55, M.magnet, 0, 0.02, 0, mag);
  for (const x of [-0.45, 0.45]) {
    const d = cyl(0.08, 0.08, 0.74, M.dark, mag, 16);
    d.rotation.x = Math.PI / 2;
    d.position.x = x;
    d.position.y = -0.12;
  }
  for (const z of [-0.45, 0.45]) box(0.06, deckY + 0.6, 0.06, M.frame, L / 2 + 0.45, (deckY + 0.6) / 2, z);
  const ironBin = box(0.45, 0.35, 0.45, mat('#5a636c'), L / 2 + 0.75, 0.18, -0.55);
  const chuteBin = box(0.6, 0.45, 0.7, mat('#6d7782'), L / 2 + 0.35, 0.23, 0.15);
  void ironBin;
  void chuteBin;
  // starter panel on a post
  const panel = box(0.4, 0.55, 0.18, mat('#c9ced3'), -1.7, 1.2, -0.9);
  box(0.06, 1.0, 0.06, M.frame, -1.7, 0.5, -0.9);
  const panelLamp = new THREE.MeshStandardMaterial({color: '#21b34a', emissive: new THREE.Color('#21b34a'), emissiveIntensity: 0});
  box(0.06, 0.06, 0.03, panelLamp, -1.6, 1.36, -0.8);
  void panel;
  // scrap pieces on the trough, and iron pieces lifted by the magnet
  const NS = 260;
  const chips = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.35, 0.6), mat('#d7dce1', {metalness: 0.8, roughness: 0.3}), NS);
  chips.frustumCulled = false;
  root.add(chips);
  const NI = 16;
  const irons = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.6, 0.6), mat('#3b3f44', {metalness: 0.6}), NI);
  irons.frustumCulled = false;
  root.add(irons);
  const dm = new THREE.Object3D();
  // highlight and anchors
  const hiMat = new THREE.LineBasicMaterial({color: ACCENT, transparent: true, opacity: 0.9, depthTest: false});
  const hi = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), hiMat);
  hi.renderOrder = 10;
  scene.add(hi);
  const HI = {
    motors: [new V3(-0.1, deckY - 0.3, 0), new V3(0.7, 0.4, 0.85)],
    trough: [new V3(0, deckY + 0.08, 0), new V3(L + 0.1, 0.3, W + 0.1)],
    springs: [new V3(0, 0.8, 0), new V3(1.9, 0.3, 0.95)],
    bin: [new V3(-0.65, deckY + 0.9, 0), new V3(1.3, 1.3, 1.0)],
    magnet: [new V3(L / 2 - 0.05, deckY + 0.5, 0), new V3(1.05, 0.45, 0.85)],
  };
  const ANCHORS = {
    m1: new V3(-0.1, deckY - 0.35, -0.38),
    m2: new V3(-0.1, deckY - 0.35, 0.38),
    trough: new V3(0.4, deckY + 0.18, W / 2),
    bin: new V3(-0.65, deckY + 1.6, 0),
    gate: new V3(-0.42, deckY + 0.2, W / 2),
    magnet: new V3(L / 2, deckY + 0.7, 0),
    springs: new V3(0.85, 0.8, 0.45),
    panel: new V3(-1.7, 1.55, -0.9),
  };
  const tmp = new V3();
  // the body's motion: along the drive line (30° up-forward) plus a rocking transverse part
  const dl = new V3(Math.cos(0.52), Math.sin(0.52), 0);
  function update(s, opt) {
    const T = s.t;
    const ph = s.phase[0];
    const a = (s.amp / 1000) * SHOW * 0.5;
    const tr = (s.trans / 1000) * SHOW * 0.5;
    body.position.set(dl.x * a * Math.sin(ph), dl.y * a * Math.sin(ph) + (s.springs ? 0 : -0.025), tr * Math.cos(ph * 1.0));
    body.rotation.x = s.springs ? 0 : 0.03;
    body.rotation.y = (tr * 0.6) * Math.sin(ph);
    springs.forEach((sp, i) => {
      sp.scale.y = 1 - 0.25 * (body.position.y / 0.05) * (i % 2 ? 1 : 0.8);
      sp.visible = s.springs || i !== 0;
    });
    motors.forEach((mo) => {
      const run = s.rpm[mo.m] > 50;
      mo.motorMat.color.set(s.tripped[mo.m] ? '#d33' : run ? '#2fa04a' : '#2f6fa8');
      mo.ws.forEach((w, side) => {
        // the sector's arc grows with the % mark (overlap of the inner and outer weights)
        const pct = s.ecc[mo.m][side] / 100;
        if (w.pct !== pct) {
          w.pct = pct;
          w.sector.geometry.dispose();
          w.sector.geometry = new THREE.CylinderGeometry(0.1, 0.1, 0.04, 24, 1, false, 0, Math.PI * (0.25 + 0.75 * pct));
        }
        w.wg.rotation.z = s.phase[mo.m] / 40; // shown slowed down
      });
    });
    // gate height = horizontal opening (bed depth)
    gate.position.y = deckY + 0.012 + clamp(s.openH / 1000, 0.03, 0.7) + 0.15;
    // scrap: moving at the conveying speed (exaggerated ×6 to read), heaped under the bin when bridging
    const vis = (s.speed / 60) * 6;
    for (let i = 0; i < NS; i++) {
      let x = -0.6 + ((hash(i) * 1.6 + T * vis * (0.85 + 0.3 * hash(i + 3))) % 1.6);
      const flowing = s.feed > 0.05;
      if (!flowing) x = -0.6 + hash(i) * 0.35;
      const z = (hash(i + 7) - 0.5) * (W - 0.06);
      const y = deckY + 0.012 + 0.01 + hash(i + 9) * Math.min(0.08, s.openH / 1000) * (flowing ? 0.5 : 1);
      dm.position.set(x + body.position.x, y + body.position.y, z + body.position.z);
      dm.rotation.set(hash(i) * 3, hash(i + 1) * 6, hash(i + 2) * 3);
      dm.scale.setScalar(0.025 + 0.02 * hash(i + 4) * (s.particle / 50));
      dm.updateMatrix();
      chips.setMatrixAt(i, dm.matrix);
    }
    chips.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < NI; i++) {
      const p = (hash(i + 31) + T * 0.35) % 1;
      if (s.feed > 0.05 && s.magnet) {
        const x = L / 2 - 0.35 + p * 0.9;
        const y = p < 0.2 ? deckY + 0.03 + p * 2.4 : deckY + 0.5;
        dm.position.set(x, y, (hash(i) - 0.5) * 0.4);
        dm.scale.setScalar(0.035);
      } else {
        dm.position.set(0, -9, 0);
        dm.scale.setScalar(0);
      }
      dm.updateMatrix();
      irons.setMatrixAt(i, dm.matrix);
    }
    irons.instanceMatrix.needsUpdate = true;
    magBox.material.color.set(s.magnet ? '#c0322b' : '#7a5a58');
    panelLamp.emissiveIntensity = s.run ? 1.5 : 0;
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
