// The MINI launder transfer pump in 3D at the drawing's sizes (L version: 1861 mm over the bail): the snouted base,
// three posts, the 3 in shaft with the 7 in hook rotor, the red steel motor mount with its guard and air elbow, the
// solid coupling, the star ring, the green 4 HP motor and the bail. Around it: the furnace well with the bath, the
// riser and the launder to the next furnace, the maintenance stand with the parts laid out on a table, and the hoist
// hook. Parts that are not fitted wait on the table; the cutaway makes the base and the guard see-through.
import * as THREE from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {ORDER, P} from './model.js';

const V3 = THREE.Vector3;
const ACCENT = 0xe3562a;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const mat = (color, o = {}) => new THREE.MeshStandardMaterial({color, roughness: 0.55, metalness: 0.3, ...o});
const mm = (x) => x / 1000;
const FLOOR_W = 0.4; // well floor above the shop floor
const WELL = 0.9; // inner size of the well
const WALL_TOP = FLOOR_W + 1.15;
const STAND = new V3(-2.6, 0.6, 0);
const TABLE = new V3(-2.6, 0.75, 1.6);

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true});
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const scene = new THREE.Scene();
  const BG = new THREE.Color('#e9e6e0');
  scene.background = BG;
  scene.fog = new THREE.Fog(BG, 18, 40);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.5;
  const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 100);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb9b2a6, 1.4));
  const sun = new THREE.DirectionalLight(0xffffff, 2.0);
  sun.position.set(-4, 9, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 30});
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 30), mat('#dedad2', {roughness: 0.95, metalness: 0}));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const grid = new THREE.GridHelper(20, 40, 0xcfc9be, 0xd6d1c7);
  grid.position.y = 0.002;
  scene.add(grid);
  const M = {
    base: mat('#4a4f55', {roughness: 0.8, metalness: 0.2, transparent: true}),
    post: mat('#a9adb2', {roughness: 0.6, metalness: 0.2}),
    shaft: mat('#bfc3c7', {roughness: 0.5, metalness: 0.3}),
    rotor: mat('#3b3f44', {roughness: 0.7}),
    red: mat('#b8281e', {metalness: 0.35, transparent: true}),
    green: mat('#2fae3c', {metalness: 0.25}),
    dark: mat('#26292d', {metalness: 0.5}),
    steel: mat('#8a929a', {metalness: 0.6}),
    refr: mat('#c9b79c', {roughness: 0.9, metalness: 0, transparent: true}),
    shell: mat('#59616a', {metalness: 0.4}),
    frame: mat('#5d6a77', {metalness: 0.4}),
    metal: new THREE.MeshStandardMaterial({color: '#d9dde1', metalness: 0.85, roughness: 0.22, emissive: new THREE.Color('#ff6a1a'), emissiveIntensity: 0.18, transparent: true}),
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

  // ------------------------------------------------------------ furnace and its pump well, riser and launder [A]
  const T = 0.3; // wall thickness
  const fz = WELL / 2 + T / 2;
  box(WELL + 2 * T, FLOOR_W, WELL + 2 * T, M.refr, 0, FLOOR_W / 2, 0);
  for (const z of [-fz, fz]) box(WELL + 2 * T, WALL_TOP, T, M.refr, 0, WALL_TOP / 2, z);
  box(T, WALL_TOP, WELL, M.refr, -WELL / 2 - T / 2, WALL_TOP / 2, 0);
  // the main hearth beyond the well, behind a low arch (the well is open to it under the bath)
  box(T, WALL_TOP - 0.7, WELL, M.refr, WELL / 2 + T / 2, 0.7 + (WALL_TOP - 0.7) / 2, 0);
  box(3.2, WALL_TOP + 0.6, 3.0, M.shell, WELL / 2 + T + 1.6, (WALL_TOP + 0.6) / 2, 0);
  const well = new THREE.Mesh(new THREE.BoxGeometry(WELL, 1, WELL), M.metal);
  root.add(well);
  // riser from the snout to the lip, and the launder away over the wall toward the next furnace
  const riser = cyl(0.06, 0.06, 1, M.refr);
  const launder = box(3.0, 0.16, 0.28, M.refr, 0, 0, 0);
  launder.rotation.z = -0.04;
  launder.position.set(-0.2, FLOOR_W + P.lip + 0.02, -WELL / 2 - T - 1.4);
  launder.rotation.y = Math.PI / 2;
  const laundMetal = box(2.9, 0.03, 0.16, M.metal, 0, 0, 0);
  laundMetal.rotation.copy(launder.rotation);
  laundMetal.position.copy(launder.position).add(new V3(0, 0.07, 0));
  const elbow = box(0.28, 0.16, 0.5, M.refr, 0.29, FLOOR_W + P.lip + 0.02, -WELL / 2 + 0.1);
  void elbow;
  box(1.6, 1.4, 1.2, M.shell, -0.2, 0.7, -WELL / 2 - T - 3.2); // the next furnace's launder inlet

  // ------------------------------------------------------------ maintenance stand and parts table
  box(0.8, 0.06, 0.8, M.frame, STAND.x, STAND.y - 0.03, 0);
  for (const [x, z] of [[-0.35, -0.35], [0.35, -0.35], [-0.35, 0.35], [0.35, 0.35]]) box(0.06, STAND.y, 0.06, M.frame, STAND.x + x, STAND.y / 2, z);
  box(3.6, 0.05, 0.9, mat('#8a6f4e', {metalness: 0}), TABLE.x + 1.6, TABLE.y - 0.025, TABLE.z);
  for (const x of [-0.1, 3.3]) for (const z of [-0.4, 0.4]) box(0.06, TABLE.y, 0.06, M.frame, TABLE.x + x, TABLE.y / 2, TABLE.z + z);

  // ------------------------------------------------------------ the pump parts, each in pump coordinates (base bottom = 0)
  const pump = new THREE.Group();
  root.add(pump);
  const parts = {};
  const part = (k) => {
    const g = new THREE.Group();
    pump.add(g);
    parts[k] = {g, home: new V3(), lowY: 0};
    return g;
  };
  // (1) snouted base 457 × 356 [M], 200 high [A], snout Ø83 on the outlet side
  const gBase = part('base');
  box(mm(457), 0.2, mm(356), M.base, 0, 0.1, 0, gBase);
  const snout = cyl(mm(83) / 2 + 0.02, mm(83) / 2 + 0.02, 0.14, M.base, gBase, 20);
  snout.rotation.x = Math.PI / 2;
  snout.position.set(0.12, 0.1, -mm(356) / 2 - 0.06);
  const chamberRing = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.135, 32), mat('#6b7178', {side: THREE.DoubleSide}));
  chamberRing.rotation.x = -Math.PI / 2;
  chamberRing.position.y = 0.201;
  gBase.add(chamberRing);
  // (2) three posts, B = 1038 to the motor mount [M]
  const gPosts = part('posts');
  const POSTS = [Math.PI / 2, (7 * Math.PI) / 6, (11 * Math.PI) / 6].map((a) => [Math.cos(a) * 0.165, Math.sin(a) * 0.14]);
  for (const [x, z] of POSTS) cyl(mm(76) / 2, mm(76) / 2, mm(P.B) - 0.2, M.post, gPosts, 16).position.set(x, 0.2 + (mm(P.B) - 0.2) / 2, z);
  // (3) shaft, 3 in [M]
  const gShaft = part('shaft');
  cyl(mm(76) / 2, mm(76) / 2, 1.07, M.shaft, gShaft, 20).position.y = 0.06 + 0.535;
  // (4) 7 in hook rotor [M], in the base chamber
  const gRotor = part('rotor');
  cyl(mm(178) / 2, mm(178) / 2, 0.09, M.rotor, gRotor, 28).position.y = 0.1;
  for (let k = 0; k < 4; k++) {
    const h = box(0.05, 0.07, 0.02, M.dark, 0, 0.1, 0, gRotor);
    const a = (k * Math.PI) / 2;
    h.position.x = Math.cos(a) * 0.085;
    h.position.z = Math.sin(a) * 0.085;
    h.rotation.y = -a;
  }
  // (5) motor mount 406 × 406 steel [M] with the coupling guard and the air elbow
  const gMount = part('mount');
  const mY = mm(P.B);
  box(mm(406), 0.03, mm(406), M.red, 0, mY + 0.015, 0, gMount);
  const guard = cyl(0.15, 0.15, 0.23, M.red, gMount, 28);
  guard.position.y = mY + 0.03 + 0.115;
  const elb = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.05, 10, 20, Math.PI / 2), M.red);
  elb.position.set(-0.2, mY + 0.2, 0);
  elb.rotation.y = Math.PI / 2;
  gMount.add(elb);
  // (9) solid coupling, 3 in [M]
  const gCoup = part('coupling');
  cyl(0.06, 0.06, 0.15, mat('#c9ccd0', {metalness: 0.8}), gCoup, 20).position.y = mY + 0.1;
  // (8) star ring [M]
  const gStar = part('star');
  const star = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.02, 8, 32), M.dark);
  star.rotation.x = Math.PI / 2;
  star.position.y = mY + 0.27;
  gStar.add(star);
  // (6) motor 4 HP, 215TC [M]
  const gMotor = part('motor');
  const motY = mY + 0.29;
  const mBody = cyl(0.15, 0.15, 0.38, M.green, gMotor, 32);
  mBody.position.y = motY + 0.19;
  for (let k = 0; k < 7; k++) cyl(0.162, 0.162, 0.012, M.green, gMotor, 32).position.y = motY + 0.06 + k * 0.045;
  box(0.12, 0.14, 0.1, M.green, 0, motY + 0.25, 0.2, gMotor); // terminal box
  cyl(0.14, 0.15, 0.08, mat('#c5c9cd'), gMotor, 28).position.y = motY + 0.42;
  // (7) bail to the top, A = 1861 [M]
  const gBail = part('bail');
  const bail = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.015, 8, 24, Math.PI), M.dark);
  bail.position.y = mm(P.A) - 0.13;
  gBail.add(bail);
  for (const x of [-0.13, 0.13]) box(0.03, 0.1, 0.03, M.dark, x, mm(P.A) - 0.18, 0, gBail);
  const LOWY = {base: 0, posts: 0.2, shaft: 0.06, rotor: 0.055, mount: mY, coupling: mY + 0.025, star: mY + 0.25, motor: motY, bail: mm(P.A) - 0.24};
  // table slots for loose parts, laid in fitting order
  const slot = {base: 0, posts: 0, shaft: 1, rotor: 1.6, mount: 2.2, coupling: 2.8, star: 3.1, motor: 2.5, bail: 3.3};

  // hoist hook and chain
  const chain = cyl(0.012, 0.012, 1, M.dark);
  const hook = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 8, 16, Math.PI * 1.5), M.dark);
  root.add(hook);
  const NB = 40;
  const drops = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), M.metal, NB);
  drops.frustumCulled = false;
  root.add(drops);

  const hiMat = new THREE.LineBasicMaterial({color: ACCENT, transparent: true, opacity: 0.9, depthTest: false});
  const hi = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), hiMat);
  hi.renderOrder = 10;
  scene.add(hi);
  const ANCHORS = {};
  for (const k of ['motor', 'mount', 'base', 'rotor', 'posts', 'bath', 'launder', 'table', 'bail']) ANCHORS[k] = new V3();
  const WHERE = {};
  const tmp = new V3();
  const dm = new THREE.Object3D();

  function pumpOrigin(h, out) {
    // 0 in the well, 0.6 above the bath (preheat), 1 on the stand
    if (h <= 0.6) return out.set(0, FLOOR_W + (h / 0.6) * (P.lip + 0.25 - 0.05), 0);
    const k = (h - 0.6) / 0.4;
    const a = new V3(0, FLOOR_W + P.lip + 0.2, 0);
    return out.set(a.x + (STAND.x - a.x) * k, a.y + (STAND.y - a.y) * k + Math.sin(k * Math.PI) * 1.2, 0);
  }

  function update(s, opt) {
    const O = pumpOrigin(s.hoist, new V3());
    pump.position.copy(O);
    // spinning parts
    const ang = (s.t * s.rpm * 2 * Math.PI) / 60;
    // fitted parts sit in the pump; loose ones wait on the table
    const onStand = s.pos === 'stand' && s.hoist > 0.98;
    for (const k of ORDER.concat(['base'])) {
      const pt = parts[k];
      const fitted = k === 'base' || s.asm[k];
      if (fitted || !onStand) {
        pt.g.position.set(0, 0, 0);
        pt.g.visible = fitted;
      } else {
        pt.g.visible = true;
        // lay it on the table: lift so its lowest point rests on the table top
        pt.g.position.set(TABLE.x + slot[k] - O.x, TABLE.y - LOWY[k] - O.y + (k === 'rotor' ? 0.0 : 0), TABLE.z - O.z);
      }
    }
    gShaft.rotation.y = ang;
    gRotor.rotation.y = ang;
    gCoup.rotation.y = ang;
    M.base.opacity = opt.cut > 0.5 ? 0.35 : 1;
    M.red.opacity = opt.cut > 0.5 ? 0.4 : 1;
    M.green.color.set(s.tripped ? '#d33' : '#2fae3c');
    // bath in the well
    const lv = FLOOR_W + s.level;
    well.scale.set(1, s.level, 1);
    well.position.set(0, FLOOR_W + s.level / 2, 0);
    M.metal.emissiveIntensity = 0.18;
    M.refr.opacity = opt.cut > 0.5 ? 0.18 : 1;
    M.refr.depthWrite = !(opt.cut > 0.5);
    M.metal.opacity = opt.cut > 0.5 ? 0.3 : 1;
    well.renderOrder = 2;
    // riser from the snout (when the pump is in the well) to the lip
    const inWell = s.pos === 'well' && s.hoist < 0.02;
    riser.visible = true;
    const r0 = FLOOR_W + 0.1;
    riser.scale.y = P.lip - 0.1;
    riser.position.set(0.12 + 0.17, r0 + (P.lip - 0.1) / 2, -WELL / 2 + 0.1);
    laundMetal.visible = inWell && s.q > 0.02;
    laundMetal.scale.z = 0.4 + s.q;
    // drops at the launder lip when flowing
    for (let i = 0; i < NB; i++) {
      if (inWell && s.q > 0.02) {
        const p = (i / NB + s.t * 0.9) % 1;
        dm.position.set(0.29 + (Math.sin(i) * 0.05), FLOOR_W + P.lip + 0.08, -WELL / 2 + 0.1 - p * 0.6);
        dm.scale.setScalar(0.012 + 0.01 * s.q);
      } else dm.scale.setScalar(0);
      dm.updateMatrix();
      drops.setMatrixAt(i, dm.matrix);
    }
    drops.instanceMatrix.needsUpdate = true;
    // hook and chain to the bail when the pump travels or hangs over the bath
    const hooked = s.hoist > 0.02 && s.hoist < 0.98;
    const top = new V3(O.x, O.y + mm(P.A) + 0.03, O.z);
    hook.visible = chain.visible = true;
    hook.position.copy(hooked ? top : new V3(O.x, O.y + mm(P.A) + 0.5, O.z));
    chain.scale.y = 4.5 - hook.position.y;
    chain.position.set(hook.position.x, hook.position.y + chain.scale.y / 2, hook.position.z);
    // anchors
    ANCHORS.motor.set(O.x + 0.16, O.y + motY + 0.25, O.z);
    ANCHORS.mount.set(O.x - 0.2, O.y + mY + 0.03, O.z);
    ANCHORS.base.set(O.x + 0.2, O.y + 0.15, O.z);
    ANCHORS.rotor.set(O.x, O.y + 0.1, O.z + 0.1);
    ANCHORS.posts.set(O.x + 0.165, O.y + 0.6, O.z);
    ANCHORS.bail.set(O.x, O.y + mm(P.A), O.z);
    ANCHORS.bath.set(0.3, lv, 0.3);
    ANCHORS.launder.set(-0.2, FLOOR_W + P.lip + 0.1, -WELL / 2 - T - 1.2);
    ANCHORS.table.set(TABLE.x + 1.6, TABLE.y + 0.2, TABLE.z);
    WHERE.pump = [O.x, O.y + 0.9, O.z];
    WHERE.top = [O.x, O.y + mY + 0.2, O.z];
    WHERE.base = [O.x, O.y + 0.15, O.z];
    const HI = {
      pump: [new V3(O.x, O.y + mm(P.A) / 2, O.z), new V3(0.6, mm(P.A) + 0.05, 0.6)],
      top: [new V3(O.x, O.y + mY + 0.4, O.z), new V3(0.5, 0.85, 0.5)],
      base: [new V3(O.x, O.y + 0.12, O.z), new V3(0.6, 0.3, 0.6)],
      well: [new V3(0, FLOOR_W + 0.6, 0), new V3(WELL, 1.2, WELL)],
      table: [new V3(TABLE.x + 1.6, TABLE.y + 0.4, TABLE.z), new V3(3.7, 0.9, 1.0)],
    };
    const h = opt.focus && HI[opt.focus];
    hi.visible = !!h && opt.hiK > 0.01;
    if (h) {
      hi.position.copy(h[0]);
      hi.scale.copy(h[1]);
      hiMat.opacity = 0.9 * opt.hiK;
    }
    void clamp;
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
  return {renderer, scene, camera, update, setCamera, project, ANCHORS, WHERE};
}
