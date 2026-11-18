// The IDEX fume extraction line in 3D, laid out from the general-arrangement drawing (Section L-L), in metres with
// x = 0 at the chimney centre: the self-supported Ø1500 × 18 m chimney on its Ø5620 foundation, the blower and motor,
// the outlet duct (bends B11, B12), the two-compartment pulse-jet bag filter (2 × 3840 = 7910 mm, 8870 mm high) with
// hoppers and rotary airlocks, the Ø650 duct (2552 drop, 6000 + 11694 run at about 7 m) through the building wall to
// the take-off at IDEX "TOP 25", and the existing natural-draft stack through the roof (16 m) to its canopy (18 m).
// update(s) poses everything from the plant state.
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

export const G = {
  fanX: 3.9, fanY: 1.06,
  outX: 6.3, // vertical outlet duct (B11 → B12)
  fx0: 7.75, fx1: 15.66, fMid: 11.7, fz: 1.6, // filter body, depth [A]
  tube: 6.6, roof: 7.9, rail: 8.87, hopTop: 3.1, hopBot: 1.75,
  inY: 3.45, dropX: 20.3, ductY: 7.3,
  wallX: 20.7, colX: 26.8, idexX0: 38.3, idexX1: 46.3, idexH: 8.165, stackX: 37.9, roofY: 16, canopyY: 18,
};

function mat(color, o = {}) {
  return new THREE.MeshStandardMaterial({color, roughness: 0.55, metalness: 0.25, ...o});
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
  scene.fog = new THREE.Fog(BG, 120, 220);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.45;
  const camera = new THREE.PerspectiveCamera(32, 1, 0.2, 400);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb9b2a6, 1.4));
  const sun = new THREE.DirectionalLight(0xffffff, 2.1);
  sun.position.set(5, 40, 30);
  sun.target.position.set(22, 0, 0);
  scene.add(sun.target);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {left: -35, right: 35, top: 35, bottom: -35, near: 1, far: 120});
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.05;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xfff1e0, 0.6);
  fill.position.set(40, 20, -30);
  scene.add(fill);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(160, 80), mat('#dedad2', {roughness: 0.95, metalness: 0}));
  floor.rotation.x = -Math.PI / 2;
  floor.position.x = 22;
  floor.receiveShadow = true;
  scene.add(floor);
  const grid = new THREE.GridHelper(120, 60, 0xcfc9be, 0xd6d1c7);
  grid.position.set(22, 0.003, 0);
  scene.add(grid);

  const cut = new THREE.Plane(new V3(0, 0, -1), 99);
  const clip = [cut];
  const M = {
    steel: mat('#8f9aa5', {metalness: 0.4}),
    casing: mat('#9ba7b3', {metalness: 0.35, side: THREE.DoubleSide, clippingPlanes: clip}),
    frame: mat('#4f6275', {metalness: 0.4}),
    duct: mat('#b9c0c7', {metalness: 0.55, roughness: 0.35}),
    concrete: mat('#c9c3b8', {roughness: 0.9, metalness: 0}),
    chimney: mat('#a7afb7', {metalness: 0.45}),
    yellow: mat('#f0c419'),
    blower: mat('#2f6fa8', {metalness: 0.3}),
    motor: mat('#3d8f5a', {metalness: 0.3}),
    dark: mat('#33393f', {metalness: 0.4}),
    air: mat('#3a78d8', {metalness: 0.3}),
    idex: mat('#c7cdd3', {metalness: 0.2}),
    ghost: new THREE.MeshStandardMaterial({color: '#aeb6be', transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide}),
    dust: mat('#8a7458', {roughness: 0.95, metalness: 0}),
    bellows: mat('#4a4f55', {roughness: 0.8}),
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
  const cyl = (r1, r2, h, m, parent = root, seg = 32) => {
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
  // a round duct along a polyline with smooth bends
  const duct = (pts, r, m = M.duct, bend = 0.9) => {
    const path = new THREE.CurvePath();
    const P3 = pts.map((p) => new V3(...p));
    let start = P3[0].clone();
    for (let i = 1; i < P3.length - 1; i++) {
      const a = P3[i - 1];
      const b = P3[i];
      const c = P3[i + 1];
      const da = new V3().subVectors(a, b).normalize();
      const dc = new V3().subVectors(c, b).normalize();
      const rr = Math.min(bend, a.distanceTo(b) / 2, b.distanceTo(c) / 2);
      const p1 = b.clone().addScaledVector(da, rr);
      const p2 = b.clone().addScaledVector(dc, rr);
      path.add(new THREE.LineCurve3(start, p1));
      path.add(new THREE.QuadraticBezierCurve3(p1, b.clone(), p2));
      start = p2;
    }
    path.add(new THREE.LineCurve3(start, P3[P3.length - 1]));
    const len = path.getLength();
    const o = new THREE.Mesh(new THREE.TubeGeometry(path, Math.ceil(len * 6), r, 20, false), m);
    o.castShadow = o.receiveShadow = true;
    root.add(o);
    return {mesh: o, path, len};
  };
  const rail = (a, b, m = M.yellow, r = 0.035) => {
    const o = cyl(r, r, 1, m, root, 8);
    between(o, new V3(...a), new V3(...b));
    return o;
  };

  // ------------------------------------------------------------ chimney and foundation [D]
  const raft = cyl(2.81, 2.81, 0.08, M.concrete, root, 48);
  raft.position.set(0, 0.04, 0);
  const ped = cyl(0.95, 0.95, 0.45, M.concrete, root, 40);
  ped.position.set(0, 0.3, 0);
  const flare = cyl(0.75, 1.16, 2.3, M.chimney, root, 40);
  flare.position.set(0, 0.45 + 1.15, 0);
  const stackBody = cyl(0.75, 0.75, P.chimneyH - 2.75, M.chimney, root, 40);
  stackBody.position.set(0, 2.75 + (P.chimneyH - 2.75) / 2, 0);
  const lip = cyl(0.8, 0.8, 0.2, M.dark, root, 40);
  lip.position.set(0, P.chimneyH, 0);
  for (let k = 0; k < 30; k++) {
    const a = (k / 30) * Math.PI * 2;
    const b = cyl(0.03, 0.03, 0.32, M.dark, root, 6);
    b.position.set(Math.cos(a) * 1.125, 0.6, Math.sin(a) * 1.125);
  }
  // ------------------------------------------------------------ blower and motor
  const fanG = new THREE.Group();
  fanG.position.set(G.fanX, 0, 0);
  root.add(fanG);
  box(2.2, 0.25, 2.4, M.frame, 0, 0.125, -0.4, fanG);
  const volute = cyl(0.78, 0.78, 0.7, M.blower, fanG, 40);
  volute.rotation.x = Math.PI / 2;
  volute.position.set(0, G.fanY + 0.15, 0);
  const impeller = new THREE.Group();
  impeller.position.set(0, G.fanY + 0.15, 0.36);
  fanG.add(impeller);
  for (let k = 0; k < 8; k++) {
    const blade = box(0.06, 0.62, 0.04, M.dark, 0, 0, 0, impeller);
    blade.rotation.z = (k * Math.PI) / 8;
  }
  const hub = cyl(0.12, 0.12, 0.05, M.steel, impeller);
  hub.rotation.x = Math.PI / 2;
  box(0.65, 0.95, 0.49, M.blower, -0.35, G.fanY + 1.0, 0, fanG); // the 650 × 490 outlet
  const motor = cyl(0.32, 0.32, 0.9, M.motor, fanG, 28);
  motor.rotation.x = Math.PI / 2;
  motor.position.set(0, G.fanY - 0.05, -1.15);
  const shaftC = cyl(0.06, 0.06, 0.5, M.steel, fanG, 12);
  shaftC.rotation.x = Math.PI / 2;
  shaftC.position.set(0, G.fanY - 0.05, -0.5);
  const motorFan = box(0.5, 0.05, 0.05, M.dark, 0, G.fanY - 0.05, -1.62, fanG);
  // blower outlet to the chimney: the 650 × 490 rectangular duct, rising and then on the diagonal [D]
  const rectA = new V3(G.fanX - 0.35, G.fanY + 1.45, 0);
  const rectB = new V3(G.fanX - 0.35, 2.6, 0);
  const rectC = new V3(0.72, 6.1, 0);
  for (const [a, b] of [[rectA, rectB], [rectB, rectC]]) {
    const o = box(0.65, 1, 0.49, M.duct, 0, 0, 0);
    const d = new V3().subVectors(b, a);
    o.position.copy(a).addScaledVector(d, 0.5);
    o.scale.set(1, d.length() + 0.3, 1);
    o.quaternion.setFromUnitVectors(new V3(0, 1, 0), d.normalize());
  }

  // ------------------------------------------------------------ the bag filter
  const fW = G.fx1 - G.fx0;
  const casingG = new THREE.Group();
  root.add(casingG);
  // dirty-gas section and clean-air plenum, one skin, cut open by the cutaway
  const shell = new THREE.Mesh(new THREE.BoxGeometry(fW, G.roof - G.hopTop, 2 * G.fz), M.casing);
  shell.position.set(G.fMid, (G.roof + G.hopTop) / 2, 0);
  shell.castShadow = true;
  casingG.add(shell);
  const tubeSheet = box(fW - 0.05, 0.04, 2 * G.fz - 0.05, mat('#7b8692', {side: THREE.DoubleSide, clippingPlanes: clip}), G.fMid, G.tube, 0, casingG);
  void tubeSheet;
  // stiffeners on the casing
  for (let k = 0; k <= 8; k++) box(0.1, G.roof - G.hopTop, 0.08, mat('#7c8792', {clippingPlanes: clip}), G.fx0 + (k * fW) / 8, (G.roof + G.hopTop) / 2, G.fz + 0.04, casingG);
  box(0.06, G.roof - G.hopTop, 2 * G.fz, mat('#7c8792', {clippingPlanes: clip, side: THREE.DoubleSide}), G.fMid, (G.roof + G.hopTop) / 2, 0, casingG);
  // hoppers: one inverted pyramid per compartment
  const hopGeo = new THREE.CylinderGeometry(1.0, 0.18, G.hopTop - G.hopBot, 4, 1, true);
  hopGeo.rotateY(Math.PI / 4);
  const hoppers = [0, 1].map((i) => {
    const cx = G.fx0 + P.compLen / 2 + i * (P.compLen + 0.23);
    const h = new THREE.Mesh(hopGeo, M.casing);
    h.scale.set(P.compLen / 2 / 0.72, 1, G.fz / 0.72);
    h.position.set(cx, (G.hopTop + G.hopBot) / 2, 0);
    h.castShadow = true;
    casingG.add(h);
    return cx;
  });
  // hopper dust: a smaller pyramid that fills with the level (seen in the cutaway)
  const dustGeo = new THREE.CylinderGeometry(1.0, 0.18, 1, 4, 1);
  dustGeo.rotateY(Math.PI / 4);
  dustGeo.translate(0, 0.5, 0);
  const dusts = hoppers.map((cx) => {
    const d = new THREE.Mesh(dustGeo, M.dust);
    d.position.set(cx, G.hopBot + 0.02, 0);
    root.add(d);
    return d;
  });
  // rotary airlocks under the hoppers, and dust bins
  const airlocks = hoppers.map((cx) => {
    const g = new THREE.Group();
    g.position.set(cx, G.hopBot - 0.25, 0);
    root.add(g);
    const body = cyl(0.22, 0.22, 0.4, M.steel, g, 20);
    body.rotation.x = Math.PI / 2;
    const rot = new THREE.Group();
    g.add(rot);
    for (let k = 0; k < 3; k++) {
      const v = box(0.4, 0.03, 0.42, M.dark, 0, 0, 0, rot);
      v.rotation.z = (k * Math.PI) / 3;
    }
    const m = cyl(0.11, 0.11, 0.35, M.motor, g, 16);
    m.rotation.x = Math.PI / 2;
    m.position.set(0, 0, 0.42);
    box(0.9, 0.9, 0.9, mat('#5a636c'), 0, -0.25 - 0.45 - 0.35, 0, g);
    return rot;
  });
  // legs and bracing on pedestals [D: 500 × 500 / 844 × 500]
  for (const x of [G.fx0 + 0.1, G.fMid, G.fx1 - 0.1])
    for (const z of [-G.fz + 0.1, G.fz - 0.1]) {
      box(0.25, G.hopTop, 0.25, M.frame, x, G.hopTop / 2, z);
      box(x === G.fMid ? 0.84 : 0.5, 0.25, 0.5, M.concrete, x, 0.12, z);
    }
  for (const y of [1.1, 2.4]) for (const z of [-G.fz + 0.1, G.fz - 0.1]) box(fW, 0.14, 0.14, M.frame, G.fMid, y, z);
  // walkway and railings on the roof, ladder on the left side
  box(fW + 0.4, 0.08, 2 * G.fz + 0.4, mat('#6d7782', {metalness: 0.5}), G.fMid, G.roof + 0.04, 0);
  const rY = G.rail;
  const cs = [[G.fx0 - 0.2, -G.fz - 0.2], [G.fx1 + 0.2, -G.fz - 0.2], [G.fx1 + 0.2, G.fz + 0.2], [G.fx0 - 0.2, G.fz + 0.2]];
  for (let i = 0; i < 4; i++) {
    const [ax, az] = cs[i];
    const [bx, bz] = cs[(i + 1) % 4];
    rail([ax, rY, az], [bx, rY, bz]);
    rail([ax, rY - 0.5, az], [bx, rY - 0.5, bz]);
    const n = Math.max(1, Math.round(Math.hypot(bx - ax, bz - az) / 1.3));
    for (let k = 0; k < n; k++) rail([ax + ((bx - ax) * k) / n, G.roof, az + ((bz - az) * k) / n], [ax + ((bx - ax) * k) / n, rY, az + ((bz - az) * k) / n]);
  }
  for (const z of [-0.3, 0.3]) rail([G.fx0 - 0.55, 0, z + 1.1], [G.fx0 - 0.55, G.rail, z + 1.1]);
  for (let k = 1; k < 28; k++) rail([G.fx0 - 0.55, k * 0.3, 0.8], [G.fx0 - 0.55, k * 0.3, 1.4]);
  // compressed air: receiver beside the filter and a header with one pulse valve per row, on the roof
  const recv = cyl(0.35, 0.35, 1.8, M.air, root, 24);
  recv.position.set(G.fx1 + 1.1, 1.2, -1.2);
  const valves = [];
  for (let c = 0; c < 2; c++)
    for (let r = 0; r < P.rows; r++) {
      const x = G.fx0 + 0.35 + c * (P.compLen + 0.23) + ((r + 0.5) * (P.compLen - 0.5)) / P.rows;
      const blow = rail([x, G.roof + 0.25, -G.fz], [x, G.roof + 0.25, G.fz - 0.2], M.air, 0.04);
      const m = mat('#e8e8e8');
      const v = box(0.16, 0.18, 0.16, m, x, G.roof + 0.4, -G.fz - 0.1);
      v.userData.m = m;
      valves.push({x, m, blow});
    }
  rail([G.fx0, G.roof + 0.4, -G.fz - 0.3], [G.fx1, G.roof + 0.4, -G.fz - 0.3], M.air, 0.07);
  // bags: 8 rows × 15 across per compartment, hanging from the tube sheet [A]
  const NB = P.compartments * P.rows * 15;
  const bagGeo = new THREE.CylinderGeometry(0.08, 0.08, 3.0, 10);
  const bagMat = new THREE.MeshStandardMaterial({color: '#ffffff', roughness: 0.9, metalness: 0});
  const bags = new THREE.InstancedMesh(bagGeo, bagMat, NB);
  bags.castShadow = false;
  root.add(bags);
  const dm = new THREE.Object3D();
  const bagPos = [];
  for (let c = 0; c < 2; c++)
    for (let r = 0; r < P.rows; r++)
      for (let k = 0; k < 15; k++) bagPos.push([valves[c * P.rows + r].x, G.tube - 1.52, -G.fz + 0.2 + (k * (2 * G.fz - 0.4)) / 14, c * P.rows + r]);
  const col = new THREE.Color();

  // ------------------------------------------------------------ ducts [D]
  const inlet = duct([[G.fx1 + 0.3, G.inY, 0], [G.dropX, G.inY, 0], [G.dropX, G.ductY, 0], [G.stackX - 0.6, G.ductY, 0], [G.stackX - 0.6, G.idexH + 0.35, 0], [G.stackX, G.idexH + 0.35, 0]], P.ductDia / 2);
  // the inlet header inside the filter, under the bags (seen in the cutaway)
  const header = cyl(P.ductDia / 2, P.ductDia / 2, fW - 0.3, M.duct, root, 20);
  header.rotation.z = Math.PI / 2;
  header.position.set(G.fMid + 0.1, G.inY, 0);
  const outlet = duct([[G.fx0 + 0.2, G.roof - 0.55, 0], [G.outX, G.roof - 0.55, 0], [G.outX, G.fanY + 0.15, 0], [G.fanX + 0.6, G.fanY + 0.15, 0]], P.ductDia / 2, M.duct, 1.0);
  // bellows at the building column [D: hatched joint]
  const bel = cyl(0.42, 0.42, 0.6, M.bellows, root, 20);
  bel.rotation.z = Math.PI / 2;
  bel.position.set(G.colX, G.ductY, 0);
  // dilution (cold-air bleed) damper on the drop [A]
  const dilG = new THREE.Group();
  dilG.position.set(G.dropX + 0.65, 5.2, 0);
  root.add(dilG);
  const stub = cyl(0.3, 0.3, 0.7, M.duct, dilG, 20);
  stub.rotation.z = Math.PI / 2;
  const flap = cyl(0.28, 0.28, 0.03, M.dark, dilG, 20);
  flap.rotation.z = Math.PI / 2;
  flap.position.x = 0.36;
  const dilAct = box(0.25, 0.25, 0.25, mat('#c0322b'), 0.2, 0.45, 0, dilG);
  void dilAct;
  // pipe supports under the long run
  for (const x of [23.5, 29, 33.5]) box(0.15, G.ductY - 0.33, 0.15, M.frame, x, (G.ductY - 0.33) / 2, 0.45);

  // ------------------------------------------------------------ building, IDEX and the existing stack
  const ghostWall = new THREE.Mesh(new THREE.PlaneGeometry(0.01, 1), M.ghost);
  void ghostWall;
  const wall = box(0.2, G.roofY, 14, M.ghost, G.wallX, G.roofY / 2, 0);
  wall.castShadow = false;
  const roofSlab = box(G.idexX1 + 3 - G.wallX, 0.3, 14, M.ghost, (G.idexX1 + 3 + G.wallX) / 2, G.roofY, 0);
  roofSlab.castShadow = false;
  box(0.5, G.roofY, 0.5, mat('#9aa3ad', {transparent: true, opacity: 0.5}), G.colX, G.roofY / 2, -1.5);
  const idex = box(G.idexX1 - G.idexX0, G.idexH, 6, M.idex, (G.idexX0 + G.idexX1) / 2, G.idexH / 2, 0);
  void idex;
  for (let k = 0; k < 6; k++) box(0.1, G.idexH - 0.4, 0.06, mat('#aeb5bc'), G.idexX0 + 0.6 + k * 1.4, G.idexH / 2, 3.03);
  // IDEX outlet "TOP 25" riser, the tee and the existing Ø650 stack to the canopy [D]
  const riser = cyl(0.33, 0.33, 0.6, M.duct, root, 20);
  riser.position.set(G.stackX, G.idexH + 0.05, 0);
  const oldStack = cyl(0.325, 0.325, G.canopyY - G.idexH - 0.6, M.duct, root, 20);
  oldStack.position.set(G.stackX, (G.canopyY + G.idexH + 0.6) / 2, 0);
  const canopy = new THREE.Mesh(new THREE.ConeGeometry(0.75, 0.55, 4), M.dark);
  canopy.rotation.y = Math.PI / 4;
  canopy.position.set(G.stackX, G.canopyY + 0.35, 0);
  root.add(canopy);
  // isolation damper in the old stack: closed while the system runs [A]
  const stackDamper = cyl(0.31, 0.31, 0.03, M.dark, root, 20);
  stackDamper.position.set(G.stackX, G.idexH + 1.2, 0);

  // ------------------------------------------------------------ moving air: particles along the gas path
  const pathPts = [
    [G.stackX, G.idexH, 0], [G.stackX, G.idexH + 0.35, 0], [G.stackX - 0.6, G.idexH + 0.35, 0], [G.stackX - 0.6, G.ductY, 0], [G.dropX, G.ductY, 0], [G.dropX, G.inY, 0],
    [G.fx1, G.inY, 0], [G.fMid, G.inY, 0], [G.fMid, G.tube - 0.3, 0], [G.fMid, G.roof - 0.55, 0], [G.fx0, G.roof - 0.55, 0], [G.outX, G.roof - 0.55, 0],
    [G.outX, G.fanY + 0.15, 0], [G.fanX, G.fanY + 0.15, 0], [G.fanX - 0.35, G.fanY + 1.2, 0], [G.fanX - 0.35, 2.6, 0], [0.7, 6.1, 0], [0, 6.1, 0], [0, P.chimneyH, 0],
  ].map((p) => new V3(...p));
  const segLen = [];
  let pathLen = 0;
  for (let i = 0; i < pathPts.length - 1; i++) {
    const l = pathPts[i].distanceTo(pathPts[i + 1]);
    segLen.push(l);
    pathLen += l;
  }
  const filterAt = (() => {
    let acc = 0;
    for (let i = 0; i < 8; i++) acc += segLen[i];
    return acc;
  })();
  const at = (d, out) => {
    let x = ((d % pathLen) + pathLen) % pathLen;
    for (let i = 0; i < segLen.length; i++) {
      if (x <= segLen[i]) return out.lerpVectors(pathPts[i], pathPts[i + 1], x / segLen[i]);
      x -= segLen[i];
    }
    return out.copy(pathPts[pathPts.length - 1]);
  };
  const NP = 420;
  const parts = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 6, 4), new THREE.MeshBasicMaterial({color: '#ffffff', transparent: true, opacity: 0.85}), NP);
  parts.frustumCulled = false;
  root.add(parts);
  const pcol = new THREE.Color();
  // natural-draft fume up the old stack when the system is off
  const NS = 60;
  const draft = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 6, 4), new THREE.MeshBasicMaterial({color: '#9b8a75', transparent: true, opacity: 0.6}), NS);
  draft.frustumCulled = false;
  root.add(draft);
  // stack plume: denser and browner as the emission rises
  const NPL = 90;
  const plumeMat = new THREE.MeshBasicMaterial({color: '#a9a39a', transparent: true, opacity: 0.35, depthWrite: false});
  const plume = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), plumeMat, NPL);
  plume.frustumCulled = false;
  root.add(plume);
  // a burst of cake falling from the row just pulsed
  const NC = 80;
  const cakeFall = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), M.dust, NC);
  cakeFall.frustumCulled = false;
  root.add(cakeFall);
  const puffMat = new THREE.MeshBasicMaterial({color: '#bfe1ff', transparent: true, opacity: 0, depthWrite: false});
  const puff = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), puffMat);
  root.add(puff);

  // ------------------------------------------------------------ highlight and anchors
  const hiMat = new THREE.LineBasicMaterial({color: ACCENT, transparent: true, opacity: 0.9, depthTest: false});
  const hi = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), hiMat);
  hi.renderOrder = 10;
  scene.add(hi);
  const HI = {
    filter: [new V3(G.fMid, 5.3, 0), new V3(fW + 0.6, 7.4, 2 * G.fz + 0.6)],
    fan: [new V3(G.fanX - 0.2, 1.4, -0.5), new V3(2.6, 2.9, 3.2)],
    chimney: [new V3(0, 9.2, 0), new V3(2.6, 18.6, 2.6)],
    idex: [new V3(G.stackX + 2, 9, 0), new V3(10, 18.5, 7)],
    hopper: [new V3(G.fMid, 1.6, 0), new V3(fW + 0.4, 3.2, 2 * G.fz + 0.4)],
    pulse: [new V3(G.fMid, G.roof + 0.4, -0.2), new V3(fW + 0.4, 1.1, 2 * G.fz + 0.6)],
  };
  const ANCHORS = {
    chimney: new V3(0, P.chimneyH + 0.4, 0),
    fan: new V3(G.fanX, 2.3, 0),
    filter: new V3(G.fMid, G.rail + 0.3, 0),
    hopper1: new V3(hoppers[0], G.hopBot - 0.3, G.fz),
    hopper2: new V3(hoppers[1], G.hopBot - 0.3, G.fz),
    duct: new V3(31, G.ductY + 0.4, 0),
    idex: new V3(G.stackX, G.idexH + 0.4, 0),
    stack: new V3(G.stackX, G.canopyY + 0.7, 0),
    damper: new V3(G.dropX + 1.0, 5.2, 0),
    air: new V3(G.fx1 + 1.1, 2.2, -1.2),
    bags: new V3(G.fMid - 1.9, 4.6, -0.6),
  };

  const tmp = new V3();
  const tv = new V3();
  function update(s, opt) {
    const T = s.t;
    const running = s.sys && s.fan.run && !s.estop;
    const ck = opt.cut;
    cut.constant = 99 * (1 - ck) + 0.0 * ck;
    // fan
    const rps = (s.fan.hz / 50) * 24.6; // ~1480 rpm at 50 Hz
    impeller.rotation.z = -T * rps * Math.PI * 2 * 0.05;
    motorFan.rotation.z = T * rps * Math.PI * 2 * 0.05;
    // bags, coloured by their cake; the row just pulsed jumps
    const since = T - s.clean.pulseT;
    for (let i = 0; i < NB; i++) {
      const [x, y, z, row] = bagPos[i];
      const kick = row === s.clean.lastRow && since < 0.4 ? 1 + 0.08 * Math.sin(since * 60) : 1;
      dm.position.set(x, y, z);
      dm.scale.set(kick, 1, kick);
      dm.updateMatrix();
      bags.setMatrixAt(i, dm.matrix);
      const w = clamp(s.cake[row] / 160, 0, 1);
      col.setRGB(0.95 - 0.45 * w, 0.94 - 0.5 * w, 0.92 - 0.62 * w);
      if (s.fault === 'bagBurst' && row === 11 && i % 15 === 7) col.set('#d33');
      bags.setColorAt(i, col);
    }
    bags.instanceMatrix.needsUpdate = true;
    bags.instanceColor.needsUpdate = true;
    bags.visible = ck > 0.02;
    header.visible = ck > 0.02;
    // pulse valves light up as they fire, with a puff in the plenum
    valves.forEach((v, i) => v.m.color.set(i === s.clean.lastRow && since < 0.5 ? '#3bb44a' : s.fault === 'valve' && i === 2 ? '#d33' : '#e8e8e8'));
    if (since < 0.6 && s.clean.lastRow != null) {
      const v = valves[s.clean.lastRow];
      puff.position.set(v.x, G.tube + 0.3, 0);
      puff.scale.set(0.3 + since, 0.4 + since * 1.4, 1.2 + since * 2);
      puffMat.opacity = 0.55 * (1 - since / 0.6) * ck;
    } else puffMat.opacity = 0;
    for (let i = 0; i < NC; i++) {
      if (since < 2.2 && s.clean.lastRow != null && ck > 0.5) {
        const v = valves[s.clean.lastRow];
        const ph = clamp(since / 2.2 + hash(i) * 0.15, 0, 1);
        dm.position.set(v.x + (hash(i + 3) - 0.5) * 0.4, G.tube - 0.4 - ph * ph * (G.tube - 0.4 - G.hopTop + 0.3), -G.fz + 0.2 + hash(i + 7) * (2 * G.fz - 0.4));
        dm.scale.setScalar(0.05);
      } else {
        dm.position.set(0, -9, 0);
        dm.scale.setScalar(0);
      }
      dm.updateMatrix();
      cakeFall.setMatrixAt(i, dm.matrix);
    }
    cakeFall.instanceMatrix.needsUpdate = true;
    // hopper dust and airlocks
    s.hopper.forEach((kg, i) => {
      const f = clamp(kg / P.hopperKg, 0, 1);
      const h = Math.max(0.01, f * (G.hopTop - G.hopBot - 0.05));
      dusts[i].scale.set(((P.compLen / 2 / 0.72) * (0.18 + 0.82 * f)) / 1.0, h, ((G.fz / 0.72) * (0.18 + 0.82 * f)) / 1.0);
      dusts[i].visible = ck > 0.02;
      if (s.rv[i] && s.sys) airlocks[i].rotation.z = -T * 1.2;
    });
    // dilution damper flap
    flap.rotation.y = s.dilution * (Math.PI / 2) * 0.9;
    stackDamper.rotation.x = running ? 0 : Math.PI / 2;
    // gas particles: speed follows the flow; brown (dusty) before the bags, pale after; warm near IDEX on a surge
    const vis = running ? 1 : 0;
    const flowK = s.q / P.hoodM3h;
    const hot = clamp((s.tIn - 60) / 80, 0, 1);
    for (let i = 0; i < NP; i++) {
      const d = (hash(i) * pathLen + T * 4.5 * flowK) % pathLen;
      at(d, tv);
      tv.x += (hash(i + 5) - 0.5) * 0.35;
      tv.y += (hash(i + 9) - 0.5) * 0.35;
      tv.z += (hash(i + 13) - 0.5) * 0.35;
      dm.position.copy(tv);
      dm.scale.setScalar(vis * (d < filterAt ? 0.07 : 0.05));
      dm.updateMatrix();
      parts.setMatrixAt(i, dm.matrix);
      if (d < filterAt) pcol.setRGB(0.55 + 0.4 * hot, 0.43 - 0.1 * hot, 0.3 - 0.15 * hot);
      else pcol.setRGB(0.8, 0.9, 1.0);
      parts.setColorAt(i, pcol);
    }
    parts.instanceMatrix.needsUpdate = true;
    if (parts.instanceColor) parts.instanceColor.needsUpdate = true;
    // natural draft up the old stack when the system does not run
    for (let i = 0; i < NS; i++) {
      const ph = (hash(i) + T * 0.25) % 1;
      dm.position.set(G.stackX + (hash(i + 2) - 0.5) * 0.3, G.idexH + 0.4 + ph * (G.canopyY + 1.5 - G.idexH), (hash(i + 4) - 0.5) * 0.3);
      dm.scale.setScalar(running ? 0 : 0.08 + 0.12 * ph);
      dm.updateMatrix();
      draft.setMatrixAt(i, dm.matrix);
    }
    draft.instanceMatrix.needsUpdate = true;
    // stack plume
    const e = clamp(s.emit / P.emitBurst, 0, 1);
    plumeMat.color.set(e > 0.3 ? '#8d7a62' : '#c9c6c0');
    plumeMat.opacity = running ? 0.12 + 0.5 * e : 0;
    for (let i = 0; i < NPL; i++) {
      const ph = (hash(i) + T * 0.12) % 1;
      dm.position.set(ph * 9 * (0.5 + hash(i + 1)), P.chimneyH + 0.3 + ph * 5 + (hash(i + 2) - 0.5) * ph * 2, (hash(i + 3) - 0.5) * ph * 3);
      dm.scale.setScalar(running ? 0.35 + ph * 1.6 : 0);
      dm.updateMatrix();
      plume.setMatrixAt(i, dm.matrix);
    }
    plume.instanceMatrix.needsUpdate = true;
    // highlight
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
  void inlet;
  void outlet;
  void raft;
  return {renderer, scene, camera, update, setCamera, project, ANCHORS};
}
