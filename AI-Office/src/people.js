// People built from simple shapes: dishdasha + kumma, suit, hijab + abaya, coverall + hard hat.
// Each has joints (hips, knees, shoulders, elbows, spine, head) posed every frame by pose(); angles ease toward the
// target so sitting down, standing up and starting to walk blend instead of snapping.
import * as THREE from 'three';
import {CSS2DObject} from 'three/examples/jsm/renderers/CSS2DRenderer.js';

const mats = {};
const m = (c, o = {}) => (mats[c + JSON.stringify(o)] ||= new THREE.MeshStandardMaterial({color: c, roughness: 0.75, ...o}));
const G = {
  limb: new THREE.CapsuleGeometry(0.055, 0.32, 4, 10),
  fore: new THREE.CapsuleGeometry(0.045, 0.2, 4, 10),
  thigh: new THREE.CapsuleGeometry(0.075, 0.32, 4, 10),
  shin: new THREE.CapsuleGeometry(0.06, 0.34, 4, 10),
  torso: new THREE.CapsuleGeometry(0.17, 0.3, 6, 14),
  head: new THREE.SphereGeometry(0.11, 20, 16),
  hand: new THREE.SphereGeometry(0.045, 10, 8),
  foot: new THREE.BoxGeometry(0.1, 0.06, 0.22),
  eye: new THREE.SphereGeometry(0.014, 8, 6),
  pelvis: new THREE.CapsuleGeometry(0.15, 0.06, 4, 12),
};
function mesh(parent, geo, mat, x = 0, y = 0, z = 0) {
  const o = new THREE.Mesh(geo, mat);
  o.position.set(x, y, z);
  o.castShadow = true;
  parent.add(o);
  return o;
}
function group(parent, x = 0, y = 0, z = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

export function makePerson(look, id) {
  const skin = m(look.skin || '#b98a64');
  const main = m(look.color || '#555');
  const outfit = look.outfit || 'suit';
  const robe = outfit === 'dishdasha' || outfit === 'hijab';
  const legM = outfit === 'suit' ? m('#262a31') : main;
  const shoeM = m(outfit === 'dishdasha' ? '#6b4a2e' : '#1d1d1d');

  const root = new THREE.Group();
  root.userData.id = id;
  const body = group(root);
  const hip = group(body, 0, 0.95, 0);
  mesh(hip, G.pelvis, legM, 0, 0, 0).rotation.z = Math.PI / 2;

  const legs = [];
  for (const s of [-1, 1]) {
    const L = group(hip, 0.1 * s, 0, 0);
    mesh(L, G.thigh, legM, 0, -0.22, 0);
    const K = group(L, 0, -0.45, 0);
    mesh(K, G.shin, legM, 0, -0.22, 0);
    mesh(K, G.foot, shoeM, 0, -0.47, 0.05);
    legs.push({L, K});
  }
  // a robe hangs from the hips over the legs while standing
  let skirt = null;
  if (robe) {
    skirt = mesh(hip, new THREE.CylinderGeometry(0.19, 0.27, 0.86, 18, 1, true), main, 0, -0.44, 0);
    skirt.material = m(look.color, {side: THREE.DoubleSide});
  }

  const spine = group(hip, 0, 0.02, 0);
  mesh(spine, G.torso, main, 0, 0.3, 0).scale.set(1.1, 1, 0.72);
  if (outfit === 'suit') {
    const shirt = mesh(spine, new THREE.BoxGeometry(0.1, 0.22, 0.02), m(look.shirt || '#eee'), 0, 0.42, 0.125);
    shirt.castShadow = false;
    mesh(spine, new THREE.BoxGeometry(0.03, 0.18, 0.021), m('#7a2f3a'), 0, 0.4, 0.128).castShadow = false;
  }
  if (outfit === 'coverall' || look.hardhat === '#f2c230') {
    // hi-vis stripes
    for (const y of [0.2, 0.36]) mesh(spine, new THREE.CylinderGeometry(0.19, 0.19, 0.035, 18, 1, true), m('#e9ee5a', {emissive: '#5a5c10'}), 0, y, 0).scale.set(1.0, 1, 0.68);
  }
  if (outfit === 'dishdasha') {
    // the tassel (furakha) at the neck
    mesh(spine, new THREE.CylinderGeometry(0.008, 0.012, 0.2, 6), m('#d8cfb8'), 0, 0.45, 0.13);
  }

  const neck = group(spine, 0, 0.62, 0);
  const head = mesh(neck, G.head, skin, 0, 0.09, 0.01);
  head.scale.set(0.95, 1.08, 1);
  for (const s of [-1, 1]) mesh(head, G.eye, m('#1b1b1b'), 0.04 * s, 0.015, 0.098).castShadow = false;
  if (outfit === 'dishdasha') {
    mesh(neck, new THREE.CylinderGeometry(0.104, 0.11, 0.09, 20), m(look.cap || '#7a2f3a'), 0, 0.17, -0.005);
    mesh(neck, new THREE.CylinderGeometry(0.104, 0.104, 0.012, 20), m('#e9dcc0'), 0, 0.2, -0.005);
    // beard
    const b = mesh(neck, new THREE.SphereGeometry(0.09, 14, 10, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5), m('#231a14'), 0, 0.07, 0.025);
    b.scale.set(1.05, 0.9, 1.0);
  } else if (outfit === 'hijab') {
    const sc = m(look.scarf || '#333');
    const s1 = mesh(neck, new THREE.SphereGeometry(0.128, 20, 16), sc, 0, 0.1, -0.018);
    s1.scale.set(1, 1.1, 1);
    mesh(neck, new THREE.CylinderGeometry(0.11, 0.2, 0.16, 18), sc, 0, -0.04, -0.005);
    // face stays clear: draw the face over the scarf
    head.position.z = 0.03;
  } else {
    const hair = mesh(neck, new THREE.SphereGeometry(0.115, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), m('#1e1711'), 0, 0.1, 0);
    hair.scale.set(1, 1.05, 1.02);
  }
  if (look.hardhat) {
    const hh = mesh(neck, new THREE.SphereGeometry(0.14, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), m(look.hardhat, {roughness: 0.4}), 0, 0.17, 0);
    hh.scale.set(1, 0.8, 1.05);
    mesh(neck, new THREE.CylinderGeometry(0.16, 0.16, 0.012, 20), m(look.hardhat, {roughness: 0.4}), 0, 0.17, 0.02);
  }

  const arms = [];
  for (const s of [-1, 1]) {
    const S = group(spine, 0.235 * s, 0.52, 0);
    mesh(S, G.limb, main, 0, -0.15, 0);
    const E = group(S, 0, -0.31, 0);
    mesh(E, G.fore, main, 0, -0.12, 0);
    mesh(E, G.hand, skin, 0, -0.27, 0);
    arms.push({S, E, s});
  }
  // a cup appears in the right hand at the cafeteria
  const cup = mesh(arms[1].E, new THREE.CylinderGeometry(0.035, 0.03, 0.09, 10), m('#ffffff'), 0, -0.3, 0.04);
  cup.visible = false;

  // selection ring
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.38, 0.46, 40), new THREE.MeshBasicMaterial({color: '#f2b632', transparent: true, opacity: 0.9}));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  ring.visible = false;
  root.add(ring);

  // name tag
  const tag = document.createElement('div');
  tag.className = 'tag';
  tag.innerHTML = '<b></b><span class="role"></span><div class="doing"></div>';
  const label = new CSS2DObject(tag);
  label.position.set(0, 2.15, 0);
  root.add(label);
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.textContent = '…';
  const bub = new CSS2DObject(bubble);
  bub.position.set(0.35, 1.95, 0);
  root.add(bub);

  // every mesh points back to its person, for clicking
  root.traverse((o) => {
    if (o.isMesh) o.userData.person = id;
  });

  const cur = {body: 0, legL: 0, legR: 0, kneeL: 0, kneeR: 0, armL: 0, armR: 0, abL: 0, abR: 0, elL: 0, elR: 0, spine: 0, head: 0, headY: 0};
  return {root, body, legs, arms, spine, neck, skirt, cup, ring, tag, label, bubble, bub, cur, robe, phase: Math.random() * 6};
}

// target joint angles for a pose; t is real seconds for small idle motions
export function poseTargets(p, pose, t, speed) {
  const T = {body: 0, legL: 0, legR: 0, kneeL: 0.05, kneeR: 0.05, armL: 0.05, armR: 0.05, abL: 0.07, abR: 0.07, elL: -0.15, elR: -0.15, spine: 0, head: 0, headY: 0};
  const sit = () => {
    T.body = -0.45;
    T.legL = T.legR = -Math.PI / 2;
    T.kneeL = T.kneeR = Math.PI / 2;
  };
  const w = p.phase + t * 1.3;
  switch (pose) {
    case 'walk': {
      const ph = p.walkPhase;
      const a = 0.5;
      T.legL = -a * Math.sin(ph);
      T.legR = a * Math.sin(ph);
      T.kneeL = 0.7 * Math.max(0, Math.sin(ph - 1.2));
      T.kneeR = 0.7 * Math.max(0, -Math.sin(ph - 1.2));
      T.armL = 0.42 * Math.sin(ph);
      T.armR = -0.42 * Math.sin(ph);
      T.elL = T.elR = -0.3;
      T.spine = 0.05;
      T.bob = 0.025 * Math.abs(Math.cos(ph));
      break;
    }
    case 'sit':
    case 'type':
      sit();
      T.armL = T.armR = -0.62;
      T.elL = -0.95 + 0.06 * Math.sin(t * 17 + p.phase);
      T.elR = -0.95 + 0.06 * Math.sin(t * 15 + p.phase + 1);
      T.abL = T.abR = 0.12;
      T.spine = 0.12;
      T.head = 0.22 + 0.04 * Math.sin(w * 0.4);
      T.headY = 0.12 * Math.sin(w * 0.23);
      break;
    case 'meet':
    case 'speak': {
      sit();
      T.armL = T.armR = -0.75;
      T.elL = T.elR = -0.75;
      T.abL = T.abR = 0.16;
      T.spine = 0.06;
      T.head = 0.02;
      T.headY = 0.35 * Math.sin(w * 0.35);
      if (pose === 'speak') {
        T.armR = -1.0 + 0.25 * Math.sin(t * 4.2);
        T.elR = -0.9 + 0.3 * Math.sin(t * 3.1);
        T.head = -0.05 + 0.08 * Math.sin(t * 5);
      }
      break;
    }
    case 'listen':
      sit();
      T.armL = T.armR = -0.3;
      T.elL = T.elR = -1.2;
      T.abL = T.abR = 0.2;
      T.head = -0.1 + 0.05 * Math.sin(w);
      break;
    case 'coffee': {
      sit();
      const lift = Math.max(0, Math.sin(w * 0.9)) ** 3;
      T.armR = -0.5 - 0.55 * lift;
      T.elR = -1.1 - 0.9 * lift;
      T.armL = -0.6;
      T.elL = -0.8;
      T.head = -0.1 * lift;
      T.headY = 0.4 * Math.sin(w * 0.3);
      break;
    }
    case 'lounge':
      sit();
      T.spine = -0.25;
      T.armL = T.armR = -0.2;
      T.elL = T.elR = -0.6;
      T.abL = T.abR = 0.3;
      T.head = 0.2;
      T.headY = 0.2 * Math.sin(w * 0.3);
      break;
    case 'present':
      T.armR = -1.45 + 0.2 * Math.sin(t * 2.2);
      T.abR = 0.25;
      T.elR = -0.25;
      T.armL = -0.5 + 0.15 * Math.sin(t * 3);
      T.elL = -1.0;
      T.headY = 0.5 * Math.sin(w * 0.5);
      T.head = -0.05;
      break;
    case 'discuss':
      T.armR = -0.6 + 0.25 * Math.sin(t * 3.4);
      T.elR = -1.0 + 0.2 * Math.sin(t * 2.6);
      T.armL = -0.2;
      T.elL = -0.6;
      T.headY = 0.15 * Math.sin(w * 0.6);
      T.head = 0.15;
      break;
    default:
      T.headY = 0.25 * Math.sin(w * 0.4);
  }
  void speed;
  return T;
}

export function applyPose(p, T, dt) {
  const c = p.cur;
  const k = 1 - Math.exp(-dt * 9);
  for (const key of Object.keys(c)) c[key] += ((T[key] ?? 0) - c[key]) * k;
  p.body.position.y = c.body + (T.bob || 0);
  p.legs[0].L.rotation.x = c.legL;
  p.legs[1].L.rotation.x = c.legR;
  p.legs[0].K.rotation.x = c.kneeL;
  p.legs[1].K.rotation.x = c.kneeR;
  p.arms[0].S.rotation.x = c.armL;
  p.arms[1].S.rotation.x = c.armR;
  p.arms[0].S.rotation.z = -c.abL;
  p.arms[1].S.rotation.z = c.abR;
  p.arms[0].E.rotation.x = c.elL;
  p.arms[1].E.rotation.x = c.elR;
  p.spine.rotation.x = c.spine;
  p.neck.rotation.x = c.head;
  p.neck.rotation.y = c.headY;
  // a robe can't fold over the knees: hide it once the person is mostly seated (the legs are robe-coloured)
  if (p.skirt) p.skirt.visible = c.body > -0.2;
  p.label.position.y = 2.15 + c.body;
  p.bub.position.y = 1.95 + c.body;
}
