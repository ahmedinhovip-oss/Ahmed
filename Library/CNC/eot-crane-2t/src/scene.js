// The 2 t single girder EOT crane in 3D, at its real size: the 32 m bay with its columns and gantry girders
// (customer's scope), the 50 × 50 square-bar LT rails, the two end carriages (4 m, wheelbase 3.2 m, Ø200 wheels, two
// LT motors), the golden-yellow girder over the 22.285 m span, the underslung wire-rope hoist (drum Ø209, 4 falls)
// and its CT drive, the hook block and C-hook, the shrouded GI DSL along one side with the collector, the I-track
// festoon and the pendant, test weights and a few CNC machines on the floor. The girder bends with the load; in the
// girder view the bend is shown ×100.
import * as THREE from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {deflAt, P, RIG} from './model.js';

const V3 = THREE.Vector3;
const ACCENT = 0xe3562a;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const mat = (color, o = {}) => new THREE.MeshStandardMaterial({color, roughness: 0.55, metalness: 0.3, ...o});
const BAY = P.bay;
const SPAN = P.span;
const RAIL = P.rail;
const GIRDER_Y = RAIL + 0.55; // girder centre [A]
const GIRDER_H = 0.5;
const HOIST_Y = GIRDER_Y - GIRDER_H / 2 - 0.32; // drum axis under the bottom flange

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true});
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const scene = new THREE.Scene();
  const BG = new THREE.Color('#e9e6e0');
  scene.background = BG;
  scene.fog = new THREE.Fog(BG, 70, 140);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.5;
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 300);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb9b2a6, 1.4));
  const sun = new THREE.DirectionalLight(0xffffff, 2.0);
  sun.position.set(-14, 30, 18);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  Object.assign(sun.shadow.camera, {left: -24, right: 24, top: 24, bottom: -24, near: 1, far: 90});
  sun.shadow.bias = -0.0005;
  scene.add(sun);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(90, 70), mat('#dedad2', {roughness: 0.95, metalness: 0}));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const grid = new THREE.GridHelper(64, 64, 0xcfc9be, 0xd6d1c7);
  grid.position.y = 0.003;
  scene.add(grid);
  const M = {
    yellow: mat('#e8b923', {metalness: 0.35, roughness: 0.45}), // RAL 1004 golden yellow [M]
    steel: mat('#6c7680', {metalness: 0.6}),
    column: mat('#8b97a3', {metalness: 0.4}),
    rail: mat('#4a4f55', {metalness: 0.8, roughness: 0.3}),
    dark: mat('#2f3439'),
    motor: mat('#3a6fa8'),
    brake: mat('#b23a2e'),
    rope: mat('#9aa3ab', {metalness: 0.8, roughness: 0.35}),
    hook: mat('#e8b923', {metalness: 0.4}),
    weight: mat('#5d646b', {metalness: 0.5}),
    dsl: mat('#d2d6da', {metalness: 0.2}),
    cnc: mat('#d4d8dc', {metalness: 0.2}),
    cncDoor: mat('#2f6fa8'),
    concrete: mat('#c9c3b8', {roughness: 0.9, metalness: 0}),
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
  // world frame: x along the bay (long travel, 0 at the bay centre), z across the span (DSL rail at -SPAN/2), y up
  const zDSL = -SPAN / 2;
  const zOther = SPAN / 2;
  // building: columns every 6.4 m, gantry girders, LT rails
  for (const z of [zDSL - 0.45, zOther + 0.45]) {
    for (let x = -BAY / 2; x <= BAY / 2 + 0.01; x += 6.4) {
      box(0.4, RAIL + 0.4, 0.4, M.column, x, (RAIL + 0.4) / 2, z + Math.sign(z) * 0.2);
      box(0.6, 0.15, 0.6, M.concrete, x, 0.075, z + Math.sign(z) * 0.2);
    }
  }
  for (const z of [zDSL, zOther]) {
    box(BAY, 0.6, 0.3, M.column, 0, RAIL - 0.05 - 0.3, z); // gantry girder (customer's scope) [M]
    box(BAY, 0.05, 0.05, M.rail, 0, RAIL - 0.025, z); // 50 × 50 square bar [M]
    for (const x of [-BAY / 2, BAY / 2]) box(0.25, 0.3, 0.25, M.brake, x - Math.sign(x) * 0.12, RAIL + 0.15, z); // end stoppers [M 4 nos]
  }
  // DSL: shrouded GI conductors along the DSL side, under the gantry girder [M]
  box(BAY, 0.12, 0.09, M.dsl, 0, RAIL - 0.5, zDSL - 0.35);
  for (let x = -BAY / 2 + 1; x < BAY / 2; x += 2) box(0.04, 0.25, 0.04, M.steel, x, RAIL - 0.33, zDSL - 0.35);
  // CNC machines along the bay (context)
  const cncs = [];
  for (const [x, z] of [[-11, -5], [-4, -5], [3, -5], [10, -5], [-8, 5.5], [1, 5.5], [9, 5.5]]) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    root.add(g);
    box(3.2, 2.3, 2.2, M.cnc, 0, 1.15, 0, g);
    box(1.6, 1.3, 0.04, M.cncDoor, -0.3, 1.25, 1.11, g);
    box(0.5, 0.9, 0.5, M.dark, 1.9, 1.35, 0.8, g);
    cncs.push(g);
  }
  // bridge: end carriages and the girder
  const bridge = new THREE.Group();
  root.add(bridge);
  const ecs = [zDSL, zOther].map((z) => {
    const g = new THREE.Group();
    g.position.set(0, RAIL, z);
    bridge.add(g);
    box(P.endCarriage, 0.32, 0.26, M.yellow, 0, 0.27, 0, g);
    box(0.3, 0.35, 0.3, M.dark, -P.endCarriage / 2 - 0.1, 0.25, 0, g); // buffers
    box(0.3, 0.35, 0.3, M.dark, P.endCarriage / 2 + 0.1, 0.25, 0, g);
    const wheels = [-P.wheelbase / 2, P.wheelbase / 2].map((x) => {
      const w = cyl(P.ltWheel / 2, P.ltWheel / 2, 0.07, M.steel, g, 24);
      w.rotation.x = Math.PI / 2;
      w.position.set(x, P.ltWheel / 2, 0);
      return w;
    });
    // LT drive: one geared motor per end carriage, flange mounted (B5) [M 2 nos]
    const mo = cyl(0.11, 0.11, 0.3, M.motor, g, 20);
    mo.rotation.x = Math.PI / 2;
    mo.position.set(-P.wheelbase / 2, 0.15, -Math.sign(z) * 0.36);
    box(0.24, 0.24, 0.16, M.dark, -P.wheelbase / 2, 0.15, -Math.sign(z) * 0.18, g);
    return {g, wheels, mo};
  });
  // the girder, bent by the load: a segmented box whose vertices move down with the deflection line
  const girderGeo = new THREE.BoxGeometry(0.42, GIRDER_H, SPAN + 0.3, 1, 2, 60);
  const gpos = girderGeo.attributes.position;
  const g0 = Float32Array.from(gpos.array);
  const girder = new THREE.Mesh(girderGeo, M.yellow);
  girder.castShadow = girder.receiveShadow = true;
  girder.position.set(0, GIRDER_Y, 0);
  bridge.add(girder);
  const flangeGeo = new THREE.BoxGeometry(0.34, 0.03, SPAN + 0.3, 1, 1, 60);
  const fpos = flangeGeo.attributes.position;
  const f0 = Float32Array.from(fpos.array);
  const flange = new THREE.Mesh(flangeGeo, M.steel);
  flange.position.set(0, GIRDER_Y - GIRDER_H / 2 - 0.015, 0);
  bridge.add(flange);
  // walkway-free single girder: the panel on the girder near the DSL end, the collector arm to the DSL
  box(0.7, 0.9, 0.3, mat('#c9ced3'), 0.5, GIRDER_Y + 0.1, zDSL + 1.2, bridge);
  const coll = box(0.06, 0.06, 0.5, M.dark, 0.6, RAIL - 0.45, zDSL - 0.15, bridge);
  void coll;
  // festoon I-track along the girder side (CT and pendant festoon) [M]
  box(0.06, 0.08, SPAN, M.steel, 0.36, GIRDER_Y - 0.1, 0, bridge);
  const festoon = new THREE.Group();
  bridge.add(festoon);
  const loops = [];
  for (let i = 0; i < 8; i++) {
    const lp = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.018, 6, 20, Math.PI), M.dark);
    lp.rotation.set(0, Math.PI / 2, Math.PI);
    festoon.add(lp);
    loops.push(lp);
  }
  // hoist trolley (underslung, on the bottom flange) [M S3 model]
  const trolley = new THREE.Group();
  bridge.add(trolley);
  box(0.5, 0.12, 0.7, M.steel, 0, GIRDER_Y - GIRDER_H / 2 - 0.08, 0, trolley);
  for (const sx of [-0.2, 0.2]) for (const sz of [-0.25, 0.25]) {
    const w = cyl(P.ctWheel / 2, P.ctWheel / 2, 0.04, M.dark, trolley, 16);
    w.rotation.z = Math.PI / 2;
    w.position.set(sx, GIRDER_Y - GIRDER_H / 2 + 0.02, sz);
  }
  const drum = cyl(P.drum / 2 + 0.01, P.drum / 2 + 0.01, 0.7, M.steel, trolley, 28); // Ø209 × 700 [M]
  drum.rotation.z = Math.PI / 2;
  drum.position.set(0, HOIST_Y, 0);
  const grooves = new THREE.Mesh(new THREE.CylinderGeometry(P.drum / 2 + 0.014, P.drum / 2 + 0.014, 0.66, 28, 1, true), new THREE.MeshStandardMaterial({color: '#59616a', wireframe: true}));
  grooves.rotation.z = Math.PI / 2;
  grooves.position.copy(drum.position);
  trolley.add(grooves);
  const hoMotor = cyl(0.13, 0.13, 0.42, M.motor, trolley, 24); // 2.2 kW, frame 100L [M]
  hoMotor.rotation.z = Math.PI / 2;
  hoMotor.position.set(0.62, HOIST_Y, 0);
  box(0.12, 0.3, 0.3, M.brake, 0.9, HOIST_Y, 0, trolley); // DC disc brake [M]
  box(0.28, 0.4, 0.4, M.dark, -0.5, HOIST_Y, 0, trolley); // gearbox 120:1 [M]
  const ctMotor = cyl(0.08, 0.08, 0.24, M.motor, trolley, 18); // 0.55 kW [M]
  ctMotor.position.set(-0.32, GIRDER_Y - GIRDER_H / 2 - 0.1, 0.42);
  // ropes (4 falls) and the hook block
  const ropes = [-0.09, -0.03, 0.03, 0.09].map((dx) => {
    const r = cyl(0.008, 0.008, 1, M.rope, trolley, 6);
    r.position.x = dx;
    return r;
  });
  const block = new THREE.Group();
  trolley.add(block);
  box(0.36, 0.3, 0.14, M.yellow, 0, 0, 0, block);
  for (const dx of [-0.07, 0.07]) {
    const sh = cyl(0.1, 0.1, 0.05, M.steel, block, 20);
    sh.rotation.z = Math.PI / 2;
    sh.position.set(dx, 0.04, 0);
  }
  const hook = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.03, 10, 24, Math.PI * 1.5), M.hook);
  hook.position.set(0, -0.32, 0);
  hook.rotation.z = Math.PI * 0.75;
  block.add(hook);
  cyl(0.025, 0.025, 0.14, M.steel, block, 10).position.set(0, -0.2, 0);
  // pendant on its own festoon trolley, following the hoist [M PB festoon]
  const pend = new THREE.Group();
  bridge.add(pend);
  const pcab = cyl(0.008, 0.008, 1, M.dark, pend, 6);
  const pbox = box(0.12, 0.42, 0.1, mat('#e8b923'), 0, 1.25, 0, pend);
  const pbtn = box(0.13, 0.3, 0.02, mat('#33393f'), 0, 1.23, 0.05, pend);
  void pbtn;
  // operator at the pendant
  const op = new THREE.Group();
  root.add(op);
  const opBody = cyl(0.2, 0.22, 1.1, mat('#2f6fa8'), op, 16);
  opBody.position.y = 0.95;
  const opHead = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), mat('#d9a87a'));
  opHead.position.y = 1.65;
  op.add(opHead);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat('#f1f1f1'));
  helmet.position.y = 1.68;
  op.add(helmet);
  for (const dz of [-0.09, 0.09]) cyl(0.07, 0.07, 0.45, M.dark, op, 10).position.set(0, 0.22, dz);
  // the loads: test weights (steel blocks) and a CNC spindle
  const loads = {};
  const mkBlock = (kg) => {
    const g = new THREE.Group();
    const v = kg / 7850; // m³ of steel
    const side = Math.cbrt(v / 0.5);
    const b = box(side * 1.2, side * 0.5 * 1.2, side * 1.2, M.weight, 0, side * 0.3, 0, g);
    b.userData.h = side * 0.6;
    g.userData.h = side * 0.6;
    g.userData.w = side * 0.6;
    root.add(g);
    g.visible = false;
    return g;
  };
  for (const kg of [1000, 2000, 2500, 3000]) loads[kg] = mkBlock(kg);
  const sp = new THREE.Group();
  const spBody = cyl(0.2, 0.2, 1.2, mat('#9aa6b2', {metalness: 0.7}), sp, 24);
  spBody.rotation.z = Math.PI / 2;
  spBody.position.y = 0.22;
  const spNose = cyl(0.12, 0.16, 0.25, M.steel, sp, 20);
  spNose.rotation.z = Math.PI / 2;
  spNose.position.set(0.72, 0.22, 0);
  sp.userData.h = 0.42;
  sp.userData.w = 0.4;
  sp.visible = false;
  root.add(sp);
  loads[450] = sp;
  const slings = [0, 1, 2, 3].map(() => {
    const r = cyl(0.01, 0.01, 1, mat('#2e7d32'), root, 6);
    r.visible = false;
    return r;
  });

  // highlight and anchors (world positions refreshed every frame)
  const hiMat = new THREE.LineBasicMaterial({color: ACCENT, transparent: true, opacity: 0.9, depthTest: false});
  const hi = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), hiMat);
  hi.renderOrder = 10;
  scene.add(hi);
  const ANCHORS = {};
  for (const k of ['hoist', 'hook', 'girder', 'bridge', 'ec', 'dsl', 'pendant', 'rope', 'load']) ANCHORS[k] = new V3();
  const WHERE = {};
  const tmp = new V3();
  const tmp2 = new V3();
  const yAxis = new V3(0, 1, 0);

  function bend(s, ex) {
    // girder vertices: z in the girder's frame is from -SPAN/2 - 0.15 to +SPAN/2 + 0.15
    for (const [pos, base] of [[gpos, g0], [fpos, f0]]) {
      for (let i = 0; i < pos.count; i++) {
        const z = base[i * 3 + 2];
        const d = (deflAt(s, z + SPAN / 2) / 1000) * ex;
        pos.array[i * 3 + 1] = base[i * 3 + 1] - d;
      }
      pos.needsUpdate = true;
    }
    girderGeo.computeVertexNormals();
  }

  let lastBend = '';
  function update(s, opt) {
    const ex = 1 + 99 * (opt.defl || 0); // ×100 in the girder view
    const bx = s.pos.lt - BAY / 2;
    const skew = (s.skew / 1000) * 20;
    bridge.position.set(bx, 0, 0);
    bridge.rotation.y = -skew / SPAN;
    const key = [s.pos.ct.toFixed(3), s.lifted ? s.load : 0, ex.toFixed(2)].join();
    if (key !== lastBend) {
      lastBend = key;
      bend(s, ex);
    }
    const tz = -SPAN / 2 + s.pos.ct;
    const dy = (deflAt(s, s.pos.ct) / 1000) * ex;
    trolley.position.set(0, -dy, tz);
    // wheels and drum turn with the travel
    for (const e of ecs) for (const w of e.wheels) w.rotation.y = (s.pos.lt / (P.ltWheel / 2)) % (Math.PI * 2);
    drum.rotation.x = (s.pos.ho * 2 / (P.drum / 2)) % (Math.PI * 2);
    grooves.rotation.x = drum.rotation.x;
    for (const e of ecs) e.mo.material.color.set(Math.abs(s.v.lt) > 0.01 ? '#2fa04a' : '#3a6fa8');
    if (s.fault === 'lt2' && Math.abs(s.v.lt) > 0.01) ecs[1].mo.material = M.brake;
    else ecs[1].mo.material = ecs[0].mo.material;
    hoMotor.material.color.set(Math.abs(s.v.ho) > 0.01 ? '#2fa04a' : '#3a6fa8');
    ctMotor.material.color.set(Math.abs(s.v.ct) > 0.01 ? '#2fa04a' : '#3a6fa8');
    // hook height: h = 0 is the hook's lowest point at the floor; a load leaves the floor once h passes its rig height
    const L = loads[s.load];
    const rig = RIG[s.load] || 0;
    const lh = L ? L.userData.h : 0;
    const hookY = s.pos.ho + 0.42; // block centre, world y
    block.position.set(0, hookY + dy, 0); // the trolley is lowered by the bend; the hook keeps its own height
    for (const r of ropes) {
      const len = Math.max(0.05, HOIST_Y - (hookY + dy + 0.15));
      r.scale.y = len;
      r.position.y = hookY + dy + 0.15 + len / 2;
    }
    for (const [kg, g] of Object.entries(loads)) g.visible = Number(kg) === s.load;
    trolley.getWorldPosition(tmp);
    const hookWorld = new V3(tmp.x, hookY, tmp.z);
    const bottom = Math.max(0, s.pos.ho - rig);
    if (L) {
      L.position.set(hookWorld.x, bottom, hookWorld.z);
      L.rotation.y = bridge.rotation.y;
      const hw = L.userData.w;
      const corners = [[-hw, -hw], [hw, -hw], [hw, hw], [-hw, hw]];
      slings.forEach((sl, i) => {
        sl.visible = true;
        const a = new V3(hookWorld.x, s.pos.ho + 0.02, hookWorld.z);
        const b = new V3(hookWorld.x + corners[i][0], bottom + lh, hookWorld.z + corners[i][1]);
        tmp2.subVectors(a, b);
        const len = Math.max(0.01, tmp2.length());
        sl.position.copy(b).addScaledVector(tmp2, 0.5);
        sl.scale.set(1, len, 1);
        sl.quaternion.setFromUnitVectors(yAxis, tmp2.normalize());
      });
    } else slings.forEach((sl) => (sl.visible = false));
    // festoon loops bunch toward the DSL end as the trolley moves away
    loops.forEach((lp, i) => {
      const z = -SPAN / 2 + 0.4 + (i / 7) * Math.max(0.2, s.pos.ct - 0.9);
      lp.position.set(0.36, GIRDER_Y - 0.12 - 0.22, z);
    });
    // pendant: hangs beside the hoist; the operator stands by it
    pend.position.set(0.9, 0, tz - 2.2);
    const ctop = GIRDER_Y - 0.12;
    pcab.scale.y = ctop - 1.46;
    pcab.position.y = 1.46 + (ctop - 1.46) / 2;
    void pbox;
    pend.getWorldPosition(tmp);
    op.position.set(tmp.x - 0.55, 0, tmp.z + 0.15);
    op.rotation.y = -Math.PI / 2;
    // anchors
    trolley.getWorldPosition(tmp);
    ANCHORS.hoist.set(tmp.x + 0.6, HOIST_Y - dy + 0.2, tmp.z);
    ANCHORS.hook.set(hookWorld.x + 0.2, hookWorld.y - 0.3, hookWorld.z);
    ANCHORS.rope.set(hookWorld.x, (HOIST_Y + hookWorld.y) / 2, hookWorld.z);
    ANCHORS.load.set(hookWorld.x, bottom + lh, hookWorld.z);
    ANCHORS.girder.set(bx, GIRDER_Y + 0.3 - dy, tz > 0 ? tz - 4 : tz + 4);
    ANCHORS.bridge.set(bx, GIRDER_Y + 0.3, zOther - 2);
    ANCHORS.ec.set(bx + P.wheelbase / 2, RAIL + 0.45, zDSL);
    ANCHORS.dsl.set(bx - 3, RAIL - 0.5, zDSL - 0.35);
    pend.getWorldPosition(tmp);
    ANCHORS.pendant.set(tmp.x, 1.45, tmp.z);
    const tw = trolley.getWorldPosition(new V3());
    WHERE.hoist = [tw.x, HOIST_Y - 0.6, tw.z];
    WHERE.hook = [hookWorld.x, (s.pos.ho + hookWorld.y) / 2, hookWorld.z];
    WHERE.ec = [bx, RAIL, zDSL];
    WHERE.pendant = [ANCHORS.pendant.x, 1.3, ANCHORS.pendant.z];
    WHERE.bridge = [bx, RAIL - 1.5, 0];
    WHERE.dsl = [bx - 1.5, RAIL - 0.3, zDSL];
    const HI = {
      hoist: [new V3(ANCHORS.hoist.x - 0.45, HOIST_Y - dy, ANCHORS.hoist.z), new V3(2.1, 0.75, 1.0)],
      hook: [new V3(hookWorld.x, hookWorld.y - 0.15, hookWorld.z), new V3(0.6, 0.8, 0.5)],
      girder: [new V3(bx, GIRDER_Y, 0), new V3(0.7, 0.8, SPAN + 0.5)],
      ec: [new V3(bx, RAIL + 0.25, zDSL), new V3(P.endCarriage + 0.6, 0.6, 0.6)],
      pendant: [new V3(ANCHORS.pendant.x, 1.25, ANCHORS.pendant.z), new V3(0.4, 0.7, 0.4)],
      dsl: [new V3(0, RAIL - 0.5, zDSL - 0.35), new V3(BAY, 0.4, 0.4)],
      bridge: [new V3(bx, RAIL + 0.4, 0), new V3(P.endCarriage + 0.5, 1.2, SPAN + 0.8)],
    };
    const h = opt.focus && HI[opt.focus];
    hi.visible = !!h && opt.hiK > 0.01;
    if (h) {
      hi.position.copy(h[0]);
      hi.scale.copy(h[1]);
      hi.rotation.y = opt.focus === 'dsl' ? 0 : bridge.rotation.y;
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
  return {renderer, scene, camera, update, setCamera, project, ANCHORS, WHERE};
}
