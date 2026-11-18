// The degassing machine in 3D, built against the Admin screen of the manual: a base frame and column with the
// hydraulic cylinder, the red head and arm riding the column, the rotor motor driving the graphite shaft and rotor,
// the anti-vortex baffle with its own motor, the vane feeder and flux hopper, the argon cylinder and the control
// panel with its tower lamp, plus the ladle of molten metal and a jumbo temperature display. update(s) poses it all.
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

// metres: ladle at the origin, machine column toward -x
export const G = {
  ladleX: 0.35, ladleR: 0.6, ladleIn: 0.45, ladleH: 0.95, floorIn: 0.15, metalTop: 0.8,
  colX: -1.0, colTop: 3.6,
  shaft: 1.25, rotorHome: 1.6, // rotor bottom height at home
  baffleDX: -0.33, baffleTravel: 0.55,
};
export const rotorBottom = (s) => G.rotorHome - P.stroke * s.head;
const armBottom = (s) => rotorBottom(s) + G.shaft + 0.1;

function mat(color, o = {}) {
  return new THREE.MeshStandardMaterial({color, roughness: 0.55, metalness: 0.2, ...o});
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
  scene.fog = new THREE.Fog(BG, 18, 40);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.45;
  const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 100);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb9b2a6, 1.4));
  const sun = new THREE.DirectionalLight(0xffffff, 2.1);
  sun.position.set(-5, 9, 7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {left: -5, right: 5, top: 5, bottom: -5, near: 1, far: 25});
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xfff1e0, 0.6);
  fill.position.set(6, 4, -5);
  scene.add(fill);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(20, 64), mat('#dedad2', {roughness: 0.95, metalness: 0}));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const grid = new THREE.GridHelper(24, 48, 0xcfc9be, 0xd6d1c7);
  grid.position.y = 0.002;
  scene.add(grid);

  const cut = new THREE.Plane(new V3(0, 0, -1), 99);
  const clip = [cut];
  const M = {
    frame: mat('#4f6275', {metalness: 0.4}),
    red: mat('#c0322b', {roughness: 0.45}),
    grey: mat('#9aa3ad', {metalness: 0.4}),
    dark: mat('#33393f', {metalness: 0.4}),
    graphite: mat('#2b2c2e', {roughness: 0.7, metalness: 0.1}),
    rod: mat('#c4cad0', {metalness: 0.9, roughness: 0.25}),
    hopper: mat('#6f8597', {metalness: 0.4}),
    steel: mat('#59626c', {metalness: 0.45, side: THREE.DoubleSide, clippingPlanes: clip}),
    refr: mat('#d6c3a6', {roughness: 0.9, metalness: 0, side: THREE.DoubleSide, clippingPlanes: clip}),
    metal: mat('#6c747d', {metalness: 0.6, roughness: 0.28, envMapIntensity: 1.2, emissive: new THREE.Color('#ff5014'), emissiveIntensity: 0.12, clippingPlanes: clip, side: THREE.DoubleSide, transparent: true}),
    cylinder: mat('#4f8a5b', {roughness: 0.4, metalness: 0.3}),
    cabinet: mat('#c9ced3', {metalness: 0.3}),
    yellow: mat('#f0c419'),
    hose: mat('#1f2326', {roughness: 0.8}),
    on: mat('#2fa04a'),
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
  const cyl = (r1, r2, h, m, parent = root, seg = 28) => {
    const o = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), m);
    o.castShadow = o.receiveShadow = true;
    parent.add(o);
    return o;
  };
  const between = (o, a, b) => {
    const d = new V3().subVectors(b, a);
    o.position.copy(a).addScaledVector(d, 0.5);
    o.scale.set(1, Math.max(1e-4, d.length()), 1);
    o.quaternion.setFromUnitVectors(new V3(0, 1, 0), d.normalize());
  };

  // ------------------------------------------------------------ base frame, column, hydraulic cylinder, power pack
  box(1.5, 0.12, 1.3, M.frame, G.colX - 0.2, 0.06, 0);
  for (const z of [-0.55, 0.55]) box(1.5, 0.18, 0.12, M.frame, G.colX - 0.2, 0.15, z);
  const col = box(0.34, G.colTop, 0.34, M.frame, G.colX, G.colTop / 2 + 0.12, 0);
  void col;
  box(0.08, G.colTop - 0.3, 0.06, M.rod, G.colX + 0.2, G.colTop / 2 + 0.2, 0.12);
  box(0.08, G.colTop - 0.3, 0.06, M.rod, G.colX + 0.2, G.colTop / 2 + 0.2, -0.12);
  const hBarrel = cyl(0.09, 0.09, 1.7, M.dark);
  hBarrel.position.set(G.colX - 0.3, 0.12 + 0.85, 0);
  const hRod = cyl(0.04, 0.04, 1, M.rod);
  const hpu = new THREE.Group();
  hpu.position.set(G.colX - 0.6, 0.12, -0.35);
  root.add(hpu);
  box(0.5, 0.4, 0.4, M.dark, 0, 0.2, 0, hpu);
  const hpuMotor = cyl(0.11, 0.11, 0.3, M.grey, hpu);
  hpuMotor.position.set(0, 0.55, 0);
  // limit switches on the column: upper, middle (sensor), lower
  const lsY = (head) => armBottom({head}) + 0.05;
  const lsMat = [mat('#f2f2f2'), mat('#f2f2f2'), mat('#f2f2f2')];
  [0, P.middleAt, 1].forEach((h, i) => box(0.06, 0.08, 0.08, lsMat[i], G.colX - 0.2, lsY(h), 0.22));

  // ------------------------------------------------------------ the head: carriage, arm, rotor motor, shaft, rotor
  const head = new THREE.Group();
  root.add(head);
  box(0.48, 0.55, 0.5, M.red, G.colX, 0.27, 0, head);
  const armLen = G.ladleX - G.colX + 0.3;
  box(armLen, 0.26, 0.42, M.red, G.colX + armLen / 2, 0.23, 0, head);
  // rotor motor and its cooling cowl
  const rMotor = cyl(0.16, 0.16, 0.42, M.grey, head);
  rMotor.position.set(G.ladleX, 0.36 + 0.21, 0);
  const rCowl = cyl(0.17, 0.17, 0.12, mat('#f2f2f2'), head);
  rCowl.position.set(G.ladleX, 0.36 + 0.48, 0);
  // the spinning parts: shaft and rotor
  const spin = new THREE.Group();
  spin.position.set(G.ladleX, 0, 0);
  head.add(spin);
  const shaft = cyl(0.05, 0.05, G.shaft, M.graphite, spin, 20);
  shaft.position.y = 0.1 - G.shaft / 2;
  const rotor = cyl(0.13, 0.13, 0.1, M.graphite, spin, 24);
  rotor.position.y = 0.1 - G.shaft - 0.05 + 0.05;
  for (let k = 0; k < 6; k++) {
    const v = box(0.1, 0.11, 0.035, mat('#1d1e20'), 0, rotor.position.y, 0, spin);
    const a = (k * Math.PI) / 3;
    v.position.x = Math.cos(a) * 0.1;
    v.position.z = Math.sin(a) * 0.1;
    v.rotation.y = -a;
  }
  const coupling = cyl(0.08, 0.08, 0.1, M.rod, head);
  coupling.position.set(G.ladleX, 0.05, 0);
  // baffle: plate on two guide rods, lowered by its own motor on the arm
  const baffleMotor = cyl(0.08, 0.08, 0.22, M.grey, head);
  baffleMotor.position.set(G.ladleX + G.baffleDX, 0.36 + 0.11, 0.18);
  const baffle = new THREE.Group();
  baffle.position.set(G.ladleX + G.baffleDX, 0, 0);
  head.add(baffle);
  box(0.05, 0.6, 0.5, M.graphite, 0, -0.1 - 0.3 - 0.05, 0, baffle);
  for (const z of [-0.18, 0.18]) {
    const r = cyl(0.018, 0.018, 0.75, M.rod, baffle, 10);
    r.position.set(0, 0.2, z);
  }
  // vane feeder: hopper, feeder motor, delivery tube toward the rotor shaft
  const hopper = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.08, 0.45, 4, 1), M.hopper);
  hopper.rotation.y = Math.PI / 4;
  hopper.position.set(G.colX + 0.62, 0.36 + 0.3, 0);
  hopper.castShadow = true;
  head.add(hopper);
  const feederMotor = cyl(0.06, 0.06, 0.16, M.grey, head);
  feederMotor.rotation.z = Math.PI / 2;
  feederMotor.position.set(G.colX + 0.62, 0.42, 0.26);
  const tube = cyl(0.025, 0.025, 1, M.rod, head, 10);
  const tubeA = new V3(G.colX + 0.62, 0.15, 0.12);
  const tubeB = new V3(G.ladleX - 0.12, -0.55, 0.16);
  between(tube, tubeA, tubeB);

  // ------------------------------------------------------------ ladle and metal
  const lad = new THREE.Group();
  lad.position.set(G.ladleX, 0, 0);
  root.add(lad);
  const prof = [[0.001, 0], [G.ladleR - 0.04, 0], [G.ladleR, 0.04], [G.ladleR, G.ladleH], [G.ladleR + 0.04, G.ladleH + 0.03]].map(([r, y]) => new THREE.Vector2(r, y));
  const shell = new THREE.Mesh(new THREE.LatheGeometry(prof, 48), M.steel);
  shell.castShadow = true;
  lad.add(shell);
  const inner = new THREE.Mesh(new THREE.LatheGeometry([[G.ladleIn, G.floorIn], [G.ladleIn, G.ladleH], [G.ladleR, G.ladleH]].map(([r, y]) => new THREE.Vector2(r, y)), 48), M.refr);
  lad.add(inner);
  const floorIn = new THREE.Mesh(new THREE.CircleGeometry(G.ladleIn, 40), M.refr);
  floorIn.rotation.x = -Math.PI / 2;
  floorIn.position.y = G.floorIn + 0.002;
  lad.add(floorIn);
  // lifting trunnions
  for (const z of [-1, 1]) {
    const t = cyl(0.06, 0.06, 0.16, M.steel, lad, 16);
    t.rotation.x = Math.PI / 2;
    t.position.set(0, 0.7, z * (G.ladleR + 0.08));
  }
  // metal body (side wall) and the free surface, which carries the vortex
  const body = new THREE.Mesh(new THREE.CylinderGeometry(G.ladleIn - 0.005, G.ladleIn - 0.005, G.metalTop - G.floorIn, 48, 1, true), M.metal);
  body.position.y = (G.metalTop + G.floorIn) / 2;
  lad.add(body);
  const SR = 26;
  const SA = 48;
  const surfGeo = new THREE.CircleGeometry(G.ladleIn - 0.005, SA, 0, Math.PI * 2);
  const surfRing = new THREE.RingGeometry(0.0, G.ladleIn - 0.005, SA, SR);
  surfRing.rotateX(-Math.PI / 2);
  void surfGeo;
  const surf = new THREE.Mesh(surfRing, M.metal);
  surf.position.y = G.metalTop;
  lad.add(surf);
  const surfPos = surfRing.attributes.position;
  const surfR = new Float32Array(surfPos.count);
  for (let i = 0; i < surfPos.count; i++) surfR[i] = Math.hypot(surfPos.getX(i), surfPos.getZ(i));
  // thermocouple for the jumbo display
  const tc = cyl(0.015, 0.015, 0.9, M.rod, lad, 8);
  tc.position.set(0.32, 0.75, -0.2);
  tc.rotation.z = 0.25;

  // bubbles and flux grains: deterministic, from the time and the index
  const NB = 160;
  const bubbles = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshStandardMaterial({color: '#e9eef3', metalness: 0.2, roughness: 0.15, transparent: true, opacity: 0.85}), NB);
  bubbles.frustumCulled = false;
  lad.add(bubbles);
  const NF = 40;
  const grains = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({color: '#f4f0e6', roughness: 0.9}), NF);
  grains.frustumCulled = false;
  root.add(grains);
  const dm = new THREE.Object3D();

  // ------------------------------------------------------------ argon cylinder, control panel, tower lamp, jumbo display
  const argon = new THREE.Group();
  argon.position.set(-2.0, 0, 0.75);
  root.add(argon);
  const bottle = cyl(0.12, 0.12, 1.45, mat('#7d8790', {metalness: 0.5}), argon, 24);
  bottle.position.y = 0.72;
  const shoulder = cyl(0.06, 0.12, 0.14, M.cylinder, argon, 24);
  shoulder.position.y = 1.52;
  const reg = box(0.12, 0.12, 0.08, M.rod, 0, 1.66, 0, argon);
  void reg;
  const gauge = cyl(0.05, 0.05, 0.03, mat('#ffffff'), argon, 20);
  gauge.rotation.x = Math.PI / 2;
  gauge.position.set(0.0, 1.7, 0.07);
  const hose = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new V3(-2.0, 1.66, 0.75), new V3(-1.6, 1.4, 0.6), new V3(-1.25, 1.2, 0.25), new V3(G.colX - 0.05, 1.0, 0.2)]), 30, 0.02, 8, false),
    M.hose,
  );
  root.add(hose);
  const panel = new THREE.Group();
  panel.position.set(-2.1, 0, -0.75);
  panel.rotation.y = 0.5;
  root.add(panel);
  box(0.7, 1.7, 0.35, M.cabinet, 0, 0.85, 0, panel);
  const screen = box(0.36, 0.24, 0.01, new THREE.MeshBasicMaterial({color: '#cfe6f6'}), 0, 1.25, 0.18, panel);
  void screen;
  // tower lamp: red, yellow, green
  const lampCol = ['#e02020', '#f5c400', '#21b34a'];
  const lamps = lampCol.map((c, i) => {
    const m = new THREE.MeshStandardMaterial({color: c, emissive: new THREE.Color(c), emissiveIntensity: 0, roughness: 0.3, transparent: true, opacity: 0.92});
    const l = cyl(0.06, 0.06, 0.1, m, panel, 20);
    l.position.set(0.2, 1.88 + (2 - i) * 0.105, 0);
    return m;
  });
  const lampPole = cyl(0.02, 0.02, 0.15, M.rod, panel, 8);
  lampPole.position.set(0.2, 1.75, 0);
  // jumbo display: four red digits drawn on a canvas
  const jc = document.createElement('canvas');
  jc.width = 512;
  jc.height = 192;
  const jtex = new THREE.CanvasTexture(jc);
  jtex.colorSpace = THREE.SRGBColorSpace;
  const jumbo = new THREE.Group();
  jumbo.position.set(1.55, 0, -0.2);
  jumbo.rotation.y = -0.6;
  root.add(jumbo);
  const pole = cyl(0.03, 0.03, 2.1, M.dark, jumbo, 10);
  pole.position.y = 1.05;
  box(0.86, 0.36, 0.1, M.dark, 0, 2.25, 0, jumbo);
  const jface = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.28), new THREE.MeshBasicMaterial({map: jtex, toneMapped: false}));
  jface.position.set(0, 2.25, 0.052);
  jumbo.add(jface);
  let jLast = '';
  const drawJumbo = (txt) => {
    if (txt === jLast) return;
    jLast = txt;
    const c = jc.getContext('2d');
    c.fillStyle = '#120404';
    c.fillRect(0, 0, 512, 192);
    c.fillStyle = '#ff2a1a';
    c.font = 'bold 150px "DejaVu Sans Mono", Consolas, monospace';
    c.textAlign = 'right';
    c.textBaseline = 'middle';
    c.fillText(txt, 430, 100);
    c.font = 'bold 60px Arial, sans-serif';
    c.fillText('°C', 500, 60);
    jtex.needsUpdate = true;
  };

  // ------------------------------------------------------------ highlight and label anchors
  const hiMat = new THREE.LineBasicMaterial({color: ACCENT, transparent: true, opacity: 0.9, depthTest: false});
  const hi = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), hiMat);
  hi.renderOrder = 10;
  scene.add(hi);
  const ANCHORS = {
    rotor: new V3(G.ladleX, 0.5, 0),
    baffle: new V3(G.ladleX + G.baffleDX, 1.2, 0),
    head: new V3(G.colX + 0.4, 2.2, 0.2),
    feeder: new V3(G.colX + 0.62, 2.3, 0),
    ladle: new V3(G.ladleX + 0.45, 0.6, 0.3),
    argon: new V3(-2.0, 1.4, 0.75),
    panel: new V3(-2.1, 2.0, -0.75),
    jumbo: new V3(1.55, 2.4, -0.2),
    hyd: new V3(G.colX - 0.3, 1.2, 0),
  };
  const HI = {
    rotor: () => [new V3(G.ladleX, 0.55, 0), new V3(0.5, 1.0, 0.5)],
    baffle: () => [new V3(G.ladleX + G.baffleDX, 0.75, 0), new V3(0.25, 0.9, 0.65)],
    feeder: () => [new V3(G.colX + 0.62, ANCHORS.feeder.y - 0.2, 0.05), new V3(0.7, 0.8, 0.7)],
    ladle: () => [new V3(G.ladleX, 0.5, 0), new V3(1.35, 1.05, 1.35)],
    panel: () => [new V3(-2.1, 1.1, -0.75), new V3(0.95, 2.3, 0.6)],
  };

  const tmp = new V3();
  function update(s, opt) {
    const T = s.t;
    const ab = armBottom(s);
    head.position.set(0, ab, 0);
    // anchors that ride with the head
    ANCHORS.feeder.y = ab + 0.85;
    ANCHORS.head.y = ab + 0.3;
    ANCHORS.baffle.y = ab - 0.1 - 0.3 - G.baffleTravel * s.baffle;
    ANCHORS.rotor.y = Math.max(0.35, rotorBottom(s) + 0.2);
    between(hRod, new V3(G.colX - 0.3, 1.8, 0), new V3(G.colX - 0.3, Math.max(1.85, ab + 0.3), 0));
    hpuMotor.material = s.hyd ? M.on : M.grey;
    // limit switches light green when made
    const made = [s.head <= 0.002, s.fault !== 'middle' && Math.abs(s.head - P.middleAt) < 0.03, s.head >= 0.998];
    lsMat.forEach((m, i) => m.color.set(made[i] ? '#33c24d' : '#f2f2f2'));
    // rotor spin
    spin.rotation.y = (T * s.rpm * 2 * Math.PI) / 60;
    baffle.position.y = -G.baffleTravel * s.baffle;
    // cutaway: front half of the ladle off, the metal see-through
    const ck = opt.cut;
    cut.constant = 99 * (1 - ck) + 0 * ck;
    M.metal.opacity = 1 - 0.62 * ck;
    M.metal.depthWrite = ck < 0.5;
    // vortex: depth at the shaft, a little swell at the wall
    const depth = 0.16 * s.vortex;
    const sw = 0.006 * (s.rpm / 600);
    for (let i = 0; i < surfPos.count; i++) {
      const r = surfR[i];
      const x = surfPos.getX(i);
      const z = surfPos.getZ(i);
      const a = Math.atan2(z, x);
      const y = -depth * Math.exp(-((r / 0.2) ** 2)) + depth * 0.25 * (r / G.ladleIn) ** 2 + sw * Math.sin(a * 3 + T * 6) * (r / G.ladleIn) + 0.004 * Math.sin(r * 30 - T * 4) * (s.flow / 60);
      surfPos.setY(i, y);
    }
    surfPos.needsUpdate = true;
    surfRing.computeVertexNormals();
    M.metal.emissiveIntensity = 0.06 + 0.12 * clamp((s.metalT - 650) / 120, 0, 1);
    // bubbles from the rotor to the surface, swirling with the rotor
    const rb = rotorBottom(s) + 0.05;
    const immersed = rb < G.metalTop - 0.05;
    const nOn = immersed ? Math.round(NB * clamp(s.flow / 50, 0, 1)) : 0;
    for (let i = 0; i < NB; i++) {
      if (i >= nOn) {
        dm.scale.setScalar(0);
        dm.position.set(0, -5, 0);
      } else {
        const rise = 0.6 + 0.6 * hash(i + 1);
        const ph = (T * rise * 0.9 + hash(i + 7)) % 1;
        const y0 = rb;
        const y = y0 + (G.metalTop - y0) * ph;
        const spread = 0.12 + 0.28 * hash(i + 3) * (0.4 + 0.6 * ph);
        const ang = hash(i + 11) * Math.PI * 2 + T * (s.rpm / 60) * 0.6 * (1 - 0.6 * s.baffle) + ph * 2;
        dm.position.set(Math.cos(ang) * spread, y, Math.sin(ang) * spread);
        dm.scale.setScalar(0.008 + 0.014 * hash(i + 5) * (0.5 + s.flow / 60));
      }
      dm.updateMatrix();
      bubbles.setMatrixAt(i, dm.matrix);
    }
    bubbles.instanceMatrix.needsUpdate = true;
    // flux grains falling from the tube into the vortex
    const tB = tubeB.clone().add(new V3(0, ab, 0));
    for (let i = 0; i < NF; i++) {
      if (!s.feeder) {
        dm.scale.setScalar(0);
        dm.position.set(0, -5, 0);
      } else {
        const ph = (T * 1.6 + hash(i + 21)) % 1;
        const yEnd = G.metalTop;
        dm.position.set(tB.x + 0.04 * (hash(i + 2) - 0.5) + ph * 0.06, tB.y - (tB.y - yEnd) * ph * ph, tB.z + 0.04 * (hash(i + 4) - 0.5));
        dm.rotation.set(ph * 9, ph * 7, 0);
        dm.scale.setScalar(0.012);
      }
      dm.updateMatrix();
      grains.setMatrixAt(i, dm.matrix);
    }
    grains.instanceMatrix.needsUpdate = true;
    // tower lamp: red on an active alarm (blinking), yellow manual, green auto healthy
    const alarm = s.alarms.some((a) => a.active);
    const blink = Math.floor(T * 2) % 2 === 0;
    lamps[0].emissiveIntensity = alarm && blink ? 1.6 : 0.02;
    lamps[1].emissiveIntensity = s.mode === 'MANUAL' ? 1.4 : 0.02;
    lamps[2].emissiveIntensity = s.mode === 'AUTO' && !alarm ? 1.4 : 0.02;
    drawJumbo(String(Math.round(s.metalT)));
    // highlight
    const h = opt.focus && HI[opt.focus] && HI[opt.focus]();
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
