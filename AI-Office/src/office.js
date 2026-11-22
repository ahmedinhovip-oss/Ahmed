// The office: floor, walls, rooms, furniture, the spots people go to, and the walk grid (A* + string pulling).
// Units are metres. +z faces the default camera; a person with rotation.y = 0 faces +z.
import * as THREE from 'three';

const M = {};
function mat(hex, o = {}) {
  const k = hex + JSON.stringify(o);
  if (!M[k]) M[k] = new THREE.MeshStandardMaterial({color: hex, roughness: 0.8, ...o});
  return M[k];
}
function box(parent, w, h, d, m, x, y, z, ry = 0, shadow = true) {
  const g = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  g.position.set(x, y, z);
  g.rotation.y = ry;
  g.castShadow = shadow;
  g.receiveShadow = true;
  parent.add(g);
  return g;
}
function cyl(parent, rt, rb, h, m, x, y, z, seg = 20) {
  const g = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
  g.position.set(x, y, z);
  g.castShadow = true;
  g.receiveShadow = true;
  parent.add(g);
  return g;
}

// text painted on a canvas, used for floor zone names, the meeting screen and the whiteboard
export function textPlane(w, h, px = 256) {
  const c = document.createElement('canvas');
  c.width = Math.round(px * (w / h));
  c.height = px;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({map: tex, transparent: true}));
  m.userData.draw = (fn) => {
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    fn(ctx, c.width, c.height);
    tex.needsUpdate = true;
  };
  return m;
}
const FONT = "'Inter', 'Segoe UI', Tahoma, 'Noto Sans Arabic', sans-serif";

// ---------------------------------------------------------------- layout
export const BOUNDS = {x0: -16.5, x1: 16.5, z0: -11.5, z1: 13.5};
export const ROOMS = {
  meeting: {x0: 6, x1: 16, z0: -11, z1: -1},
  cafe: {x0: 6, x1: 16, z0: 1, z1: 11},
  training: {x0: -15.5, x1: -6.5, z0: 5, z1: 10.8},
  lounge: {x0: -5, x1: 0.5, z0: 5.6, z1: 10.8},
};
const ZONES = [
  {x0: -15.2, x1: -6.8, z0: -10.4, z1: -3.6},
  {x0: -6, x1: 3, z0: -10.4, z1: -3.6},
  {x0: -15.2, x1: -6.8, z0: -2.8, z1: 3.8},
  {x0: -6, x1: 3, z0: -2.8, z1: 3.8},
];
const DOOR = {x0: 2.2, x1: 4.2}; // entrance in the front wall (z = 11)

export function buildOffice(scene, team) {
  const root = new THREE.Group();
  scene.add(root);
  const spots = {}; // id -> {x, z, rot, pose}
  const blocks = []; // rects {x0,x1,z0,z1} and circles {cx,cz,r} the walk grid avoids
  const rect = (x0, x1, z0, z1) => blocks.push({x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1)});
  const circ = (cx, cz, r) => blocks.push({cx, cz, r});

  // floor
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(32, 22), mat('#d9c3a0', {roughness: 0.9}));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  root.add(floor);
  // wood planks: faint stripes
  for (let x = -16; x < 16; x += 0.8) box(root, 0.01, 0.002, 22, mat('#c9b18c'), x, 0.001, 0, 0, false);
  // outside apron at the entrance
  const apron = new THREE.Mesh(new THREE.PlaneGeometry(6, 2.5), mat('#bfc3c7'));
  apron.rotation.x = -Math.PI / 2;
  apron.position.set((DOOR.x0 + DOOR.x1) / 2, 0, 12.3);
  apron.receiveShadow = true;
  root.add(apron);

  const wallM = mat('#f2f0ec');
  const H = 3.0;
  const T = 0.15;
  function wall(x0, z0, x1, z1, m = wallM, h = H) {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const g = box(root, len, h, T, m, (x0 + x1) / 2, h / 2, (z0 + z1) / 2, -Math.atan2(z1 - z0, x1 - x0));
    rect(x0 - T, x1 + T, z0 - T, z1 + T);
    return g;
  }
  const glass = mat('#bcd6e6', {transparent: true, opacity: 0.28, roughness: 0.1, metalness: 0.1});
  const frameM = mat('#2b2f36');
  function glassWall(x0, z0, x1, z1) {
    const g = wall(x0, z0, x1, z1, glass, 2.6);
    g.castShadow = false;
    // frame posts every 2 m and a top rail
    const len = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.max(1, Math.round(len / 2));
    for (let i = 0; i <= n; i++) {
      const f = i / n;
      box(root, 0.06, 2.6, 0.06, frameM, x0 + (x1 - x0) * f, 1.3, z0 + (z1 - z0) * f);
    }
    box(root, x1 - x0 || 0.06, 0.06, z1 - z0 || 0.06, frameM, (x0 + x1) / 2, 2.6, (z0 + z1) / 2);
  }

  // outer walls; the back wall is windows like an office tower
  // the front wall is cut low so the camera sees in (a cutaway)
  wall(-16, 11, DOOR.x0, 11, wallM, 1.1);
  wall(DOOR.x1, 11, 16, 11, wallM, 1.1);
  box(root, 0.12, 2.6, 0.2, frameM, DOOR.x0, 1.3, 11);
  box(root, 0.12, 2.6, 0.2, frameM, DOOR.x1, 1.3, 11);
  box(root, DOOR.x1 - DOOR.x0 + 0.3, 0.4, 0.2, frameM, (DOOR.x0 + DOOR.x1) / 2, 2.8, 11);
  wall(-16, -11, -16, 11);
  wall(16, -11, 16, 11);
  wall(-16, -11, 16, -11, wallM, 0.5);
  const sky = mat('#7fa6d9', {roughness: 0.3, metalness: 0.2, emissive: '#3a5f96', emissiveIntensity: 0.25});
  for (let x = -15; x < 16; x += 3) {
    box(root, 2.8, 2.3, 0.05, sky, x + 0.5, 1.75, -11.05, 0, false);
    box(root, 0.12, 2.5, 0.16, frameM, x - 1, 1.75, -11);
    box(root, 3, 0.1, 0.16, frameM, x + 0.5, 2.9, -11);
    box(root, 3, 0.1, 0.16, frameM, x + 0.5, 0.6, -11);
    box(root, 0.06, 2.3, 0.1, frameM, x + 0.5, 1.75, -11);
  }

  // meeting room: glass on the floor side, door gap
  glassWall(6, -11, 6, -4.8);
  glassWall(6, -2.9, 6, -1);
  glassWall(6, -1, 16, -1);
  // cafeteria
  wall(6, 1, 16, 1);
  wall(6, 1, 6, 3.7);
  wall(6, 5.5, 6, 11);

  // ---------------------------------------------------------------- furniture helpers
  const deskTop = mat('#f4f4f2');
  const deskBody = mat('#7d8186');
  const chairM = mat('#2a2c30');
  const lampM = mat('#ee7a2f', {roughness: 0.5});
  const laptopM = mat('#b9bec4', {metalness: 0.6, roughness: 0.35});
  const screenM = mat('#1b2635', {emissive: '#4f86c6', emissiveIntensity: 0.6});

  function chair(x, z, rot, m = chairM) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rot;
    box(g, 0.48, 0.07, 0.46, m, 0, 0.44, 0);
    box(g, 0.46, 0.55, 0.06, m, 0, 0.75, -0.24);
    cyl(g, 0.03, 0.03, 0.4, mat('#555'), 0, 0.22, 0, 8);
    cyl(g, 0.24, 0.24, 0.03, mat('#555'), 0, 0.03, 0, 12);
    root.add(g);
    return g;
  }
  function plant(x, z, s = 1) {
    cyl(root, 0.2 * s, 0.15 * s, 0.35 * s, mat('#d07a4a'), x, 0.175 * s, z, 14);
    const leaf = mat('#4f8a4b');
    for (let i = 0; i < 6; i++) {
      const a = i * 1.05;
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.18 * s, 10, 8), leaf);
      l.position.set(x + Math.cos(a) * 0.12 * s, (0.55 + (i % 3) * 0.17) * s, z + Math.sin(a) * 0.12 * s);
      l.castShadow = true;
      root.add(l);
    }
    circ(x, z, 0.25 * s);
  }
  function desk(x, z, w = 1.6, big = false) {
    // person sits on the -z side facing +z (the camera); the laptop's back is to the camera
    box(root, w, 0.05, 0.8, deskTop, x, 0.74, z);
    box(root, w - 0.04, 0.68, 0.06, deskBody, x, 0.36, z + 0.37); // modesty panel toward the camera
    box(root, 0.06, 0.7, 0.76, deskBody, x - w / 2 + 0.05, 0.36, z);
    box(root, 0.06, 0.7, 0.76, deskBody, x + w / 2 - 0.05, 0.36, z);
    // laptop: base and a screen tilted toward the seat
    box(root, 0.36, 0.02, 0.25, laptopM, x, 0.775, z - 0.05);
    const scr = box(root, 0.36, 0.24, 0.015, laptopM, x, 0.9, z + 0.07);
    scr.rotation.x = 0.25;
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.2), screenM);
    face.position.set(x, 0.9, z + 0.06);
    face.rotation.set(0.25, Math.PI, 0);
    root.add(face);
    if (big) box(root, 0.6, 0.35, 0.03, screenM, x - 0.45, 1.05, z + 0.25);
    // desk lamp
    cyl(root, 0.07, 0.08, 0.02, lampM, x + w / 2 - 0.2, 0.775, z + 0.2, 10);
    const arm = cyl(root, 0.012, 0.012, 0.42, lampM, x + w / 2 - 0.2, 0.98, z + 0.15, 6);
    arm.rotation.x = -0.3;
    const shade = cyl(root, 0.03, 0.09, 0.12, lampM, x + w / 2 - 0.2, 1.18, z + 0.04, 12);
    shade.rotation.x = -0.9;
    rect(x - w / 2, x + w / 2, z - 0.4, z + 0.4);
  }

  // ---------------------------------------------------------------- work floor: department zones and desks
  const zoneLabels = [];
  const deskOf = {};
  team.departments.slice(0, ZONES.length).forEach((d, di) => {
    const Z = ZONES[di];
    const carpet = new THREE.Mesh(new THREE.PlaneGeometry(Z.x1 - Z.x0, Z.z1 - Z.z0), mat(d.color, {roughness: 1}));
    carpet.rotation.x = -Math.PI / 2;
    carpet.position.set((Z.x0 + Z.x1) / 2, 0.004, (Z.z0 + Z.z1) / 2);
    carpet.receiveShadow = true;
    root.add(carpet);
    const lbl = textPlane(4, 0.5);
    lbl.rotation.x = -Math.PI / 2;
    lbl.position.set(Z.x0 + 2.2, 0.01, Z.z1 - 0.4);
    root.add(lbl);
    zoneLabels.push({mesh: lbl, dept: d});

    const people = team.agents.filter((a) => a.dept === d.id);
    const perRow = 3;
    const rows = Math.ceil(people.length / perRow) || 1;
    people.forEach((a, i) => {
      const r = Math.floor(i / perRow);
      const inRow = Math.min(perRow, people.length - r * perRow);
      const c = i % perRow;
      const big = people.length === 1;
      const x = (Z.x0 + Z.x1) / 2 + (c - (inRow - 1) / 2) * 2.6;
      const z = rows === 1 ? (Z.z0 + Z.z1) / 2 + 0.3 : Z.z0 + 2.2 + r * 2.9;
      desk(x, z, big ? 2.2 : 1.6, big);
      chair(x, z - 0.92, 0);
      spots['desk:' + a.id] = {x, z: z - 0.92, rot: 0, pose: 'sit'};
      // a colleague who comes over stands beside the desk, turned toward the seat
      spots['visit:' + a.id] = {x: x + 0.95, z: z - 1.35, rot: Math.atan2(x - (x + 0.95), z - 0.92 - (z - 1.35)), pose: 'stand'};
      deskOf[a.id] = {x, z};
    });
  });

  // ---------------------------------------------------------------- meeting room
  {
    const R = ROOMS.meeting;
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(9.6, 9.6), mat('#a9b4c0', {roughness: 1}));
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(11, 0.004, -6);
    rug.receiveShadow = true;
    root.add(rug);
    box(root, 6.4, 0.07, 2.0, mat('#6b4632', {roughness: 0.55}), 11, 0.75, -6);
    box(root, 0.3, 0.72, 1.2, mat('#3b2a20'), 9, 0.36, -6);
    box(root, 0.3, 0.72, 1.2, mat('#3b2a20'), 13, 0.36, -6);
    rect(7.8, 14.2, -7, -5);
    const seatsX = [8.5, 10, 11.5, 13];
    const seats = [];
    for (const x of seatsX) seats.push({x, z: -7.75, rot: 0});
    for (const x of seatsX) seats.push({x, z: -4.25, rot: Math.PI});
    seats.push({x: 7.3, z: -6, rot: Math.PI / 2});
    seats.forEach((s, i) => {
      chair(s.x, s.z, s.rot);
      spots['meet:' + i] = {...s, pose: 'sit'};
    });
    // the chair at the head of the table, for whoever chairs the meeting
    chair(14.75, -6, -Math.PI / 2, mat('#7a2f3a'));
    spots['meet:head'] = {x: 14.75, z: -6, rot: -Math.PI / 2, pose: 'sit'};
    // standing room for more people than chairs
    for (let i = 0; i < 8; i++) spots['meetstand:' + i] = {x: 7.5 + i * 1.05, z: -9.6, rot: 0, pose: 'stand'};
    // wall screen on the window side, facing into the room
    box(root, 0.08, 1.3, 2.3, mat('#111'), 6.15, 1.6, -8.3, 0);
    const screen = textPlane(2.2, 1.2, 300);
    screen.position.set(6.2, 1.6, -8.3);
    screen.rotation.y = Math.PI / 2;
    root.add(screen);
    plant(15.4, -10.4, 1.2);
    plant(15.4, -1.6, 1);
    spots._meetScreen = screen;
    void R;
  }

  // ---------------------------------------------------------------- cafeteria
  {
    box(root, 0.8, 1.05, 7, mat('#e6e2da'), 15.4, 0.52, 6);
    box(root, 0.82, 0.05, 7.02, mat('#4a4a4a'), 15.4, 1.06, 6);
    box(root, 0.5, 0.6, 0.45, mat('#262626'), 15.45, 1.38, 3.6); // coffee machine
    box(root, 0.5, 1.9, 0.7, mat('#c8ccd0', {metalness: 0.4}), 15.55, 0.95, 9.8); // fridge
    rect(15, 16, 2.4, 10.2);
    const tables = [[8.6, 3.8], [8.6, 8.2], [12.2, 3.8], [12.2, 8.2]];
    let n = 0;
    for (const [cx, cz] of tables) {
      cyl(root, 0.62, 0.62, 0.05, mat('#f1efe9'), cx, 0.74, cz, 28);
      cyl(root, 0.05, 0.05, 0.72, mat('#555'), cx, 0.36, cz, 8);
      cyl(root, 0.3, 0.3, 0.03, mat('#555'), cx, 0.02, cz, 16);
      circ(cx, cz, 0.62);
      for (let k = 0; k < 4; k++) {
        const a = Math.PI / 4 + (k * Math.PI) / 2;
        const x = cx + Math.cos(a) * 1.05;
        const z = cz + Math.sin(a) * 1.05;
        const rot = Math.atan2(cx - x, cz - z);
        chair(x, z, rot, mat('#c76b3c'));
        spots['cafe:' + n++] = {x, z, rot, pose: 'sit'};
      }
      // a cup on each table
      cyl(root, 0.04, 0.035, 0.09, mat('#fff'), cx + 0.15, 0.81, cz, 10);
    }
    plant(6.8, 10.3, 1.1);
  }

  // ---------------------------------------------------------------- training corner (Hisham's skill sessions)
  {
    const R = ROOMS.training;
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(R.x1 - R.x0, R.z1 - R.z0), mat('#e9d8a6', {roughness: 1}));
    rug.rotation.x = -Math.PI / 2;
    rug.position.set((R.x0 + R.x1) / 2, 0.004, (R.z0 + R.z1) / 2);
    rug.receiveShadow = true;
    root.add(rug);
    // a freestanding whiteboard facing the camera; Hisham stands beside it, the class sits facing it
    box(root, 3.2, 1.6, 0.06, mat('#fafafa', {roughness: 0.3}), -11, 1.45, 5.55);
    box(root, 3.3, 0.06, 0.15, frameM, -11, 0.62, 5.6);
    for (const x of [-12.6, -9.4]) box(root, 0.06, 2.3, 0.06, frameM, x, 1.15, 5.52);
    rect(-12.7, -9.3, 5.4, 5.75);
    const board = textPlane(3.0, 1.4, 300);
    board.position.set(-11, 1.45, 5.59);
    root.add(board);
    spots._board = board;
    spots['train:lead'] = {x: -9.0, z: 6.35, rot: 0.25, pose: 'present'};
    const seats = [[-13.0, 8.4], [-11.6, 8.7], [-10.1, 8.7], [-8.7, 8.4], [-12.3, 9.9], [-9.4, 9.9]];
    seats.forEach(([x, z], i) => {
      const rot = Math.atan2(-11 - x, 5.6 - z);
      cyl(root, 0.2, 0.2, 0.45, mat('#3f6e8c'), x, 0.225, z, 16);
      spots['train:' + i] = {x, z, rot, pose: 'sit'};
    });
    plant(-15.2, 10.4, 1.1);
  }

  // ---------------------------------------------------------------- lounge
  {
    const R = ROOMS.lounge;
    const rug = new THREE.Mesh(new THREE.CircleGeometry(2.4, 40), mat('#b7c4b0', {roughness: 1}));
    rug.rotation.x = -Math.PI / 2;
    rug.position.set((R.x0 + R.x1) / 2, 0.005, 8.2);
    rug.receiveShadow = true;
    root.add(rug);
    const sofaM = mat('#4b5563');
    // sofa against the front wall facing -z, and one facing it
    box(root, 3.0, 0.42, 0.85, sofaM, -2.25, 0.21, 10.2);
    box(root, 3.0, 0.5, 0.22, sofaM, -2.25, 0.65, 10.55);
    box(root, 2.2, 0.42, 0.85, sofaM, -2.25, 0.21, 6.1);
    box(root, 2.2, 0.5, 0.22, sofaM, -2.25, 0.65, 5.75);
    rect(-3.75, -0.75, 9.8, 10.8);
    rect(-3.35, -1.15, 5.6, 6.5);
    cyl(root, 0.55, 0.55, 0.05, mat('#7a5a40'), -2.25, 0.42, 8.15, 24);
    cyl(root, 0.05, 0.05, 0.4, mat('#555'), -2.25, 0.2, 8.15, 8);
    circ(-2.25, 8.15, 0.55);
    spots['lounge:0'] = {x: -3.1, z: 9.85, rot: Math.PI, pose: 'lounge'};
    spots['lounge:1'] = {x: -1.4, z: 9.85, rot: Math.PI, pose: 'lounge'};
    spots['lounge:2'] = {x: -2.7, z: 6.45, rot: 0, pose: 'lounge'};
    spots['lounge:3'] = {x: -1.8, z: 6.45, rot: 0, pose: 'lounge'};
    plant(0.2, 10.4, 1.3);
    plant(-4.6, 10.4, 1);
  }

  // shelves and plants along the floor
  box(root, 0.4, 2, 1.4, mat('#3a3a3a'), 15.7, 1, -0.0);
  plant(4.6, -10.4, 1.2);
  plant(-15.3, -10.4, 1.1);
  plant(5.4, 0, 1);
  plant(-15.3, 4.2, 0.9);

  // pendant lamps
  const cord = mat('#333');
  const bulb = mat('#fff7e6', {emissive: '#fff1cc', emissiveIntensity: 0.8});
  for (const [x, z] of [[-11, -7], [-2, -7], [-11, 0.5], [-2, 0.5], [9.5, -6], [12.5, -6], [10.4, 6], [-11, 8], [-2.2, 8.2]]) {
    cyl(root, 0.006, 0.006, 0.8, cord, x, 3.4, z, 4).castShadow = false;
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), bulb);
    b.position.set(x, 2.95, z);
    root.add(b);
  }

  // entrance: outside spot (people disappear there) and the doorway
  spots['outside'] = {x: (DOOR.x0 + DOOR.x1) / 2, z: 12.9, rot: Math.PI, pose: 'stand'};
  spots['door'] = {x: (DOOR.x0 + DOOR.x1) / 2, z: 10.2, rot: Math.PI, pose: 'stand'};
  const doorSign = textPlane(1.8, 0.35);
  doorSign.position.set((DOOR.x0 + DOOR.x1) / 2, 2.8, 11.12);
  root.add(doorSign);

  // room name signs on the floor
  const roomSigns = [
    {mesh: textPlane(3.6, 0.5), key: 'Meeting room', x: 11, z: -2.0},
    {mesh: textPlane(3.6, 0.5), key: 'Cafeteria', x: 11, z: 1.9},
    {mesh: textPlane(3.6, 0.5), key: 'Training corner', x: -13.2, z: 10.5},
    {mesh: textPlane(3.6, 0.5), key: 'Lounge', x: -2.2, z: 8.95},
  ];
  for (const s of roomSigns) {
    s.mesh.rotation.x = -Math.PI / 2;
    s.mesh.position.set(s.x, 0.012, s.z);
    root.add(s.mesh);
  }

  // repaint every canvas label in the current language
  function relabel(t, lang) {
    const rtl = lang === 'ar';
    const paint = (mesh, text, color = 'rgba(30,30,30,0.75)', size = 0.55) => {
      mesh.userData.draw((ctx, w, h) => {
        ctx.font = `600 ${Math.round(h * size)}px ${FONT}`;
        ctx.fillStyle = color;
        ctx.textBaseline = 'middle';
        ctx.direction = rtl ? 'rtl' : 'ltr';
        ctx.textAlign = rtl ? 'right' : 'left';
        ctx.fillText(text, rtl ? w - 8 : 8, h / 2);
      });
    };
    for (const z of zoneLabels) paint(z.mesh, rtl ? z.dept.name_ar : z.dept.name);
    for (const s of roomSigns) paint(s.mesh, t(s.key));
    paint(doorSign, t('Entrance'), '#ffffff');
    doorSign.userData.draw((ctx, w, h) => {
      ctx.fillStyle = '#2b2f36';
      ctx.fillRect(0, 0, w, h);
      ctx.font = `700 ${Math.round(h * 0.55)}px ${FONT}`;
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(t('Entrance'), w / 2, h / 2);
    });
  }

  const nav = makeGrid(blocks);
  return {root, spots, nav, deskOf, relabel};
}

// ---------------------------------------------------------------- walk grid
const CELL = 0.25;
const RAD = 0.3; // body radius kept clear of furniture and walls
function makeGrid(blocks) {
  const W = Math.ceil((BOUNDS.x1 - BOUNDS.x0) / CELL);
  const Hh = Math.ceil((BOUNDS.z1 - BOUNDS.z0) / CELL);
  const blocked = new Uint8Array(W * Hh);
  const cx = (i) => BOUNDS.x0 + (i + 0.5) * CELL;
  const cz = (j) => BOUNDS.z0 + (j + 0.5) * CELL;
  for (let j = 0; j < Hh; j++)
    for (let i = 0; i < W; i++) {
      const x = cx(i);
      const z = cz(j);
      // outside the building only the entrance apron is walkable
      if (z > 11 && (x < DOOR.x0 - 1 || x > DOOR.x1 + 1)) {
        blocked[j * W + i] = 1;
        continue;
      }
      if (x < -15.85 || x > 15.85 || z < -10.85) {
        blocked[j * W + i] = 1;
        continue;
      }
      for (const b of blocks) {
        if (b.r !== undefined) {
          if (Math.hypot(x - b.cx, z - b.cz) < b.r + RAD) {
            blocked[j * W + i] = 1;
            break;
          }
        } else if (x > b.x0 - RAD && x < b.x1 + RAD && z > b.z0 - RAD && z < b.z1 + RAD) {
          blocked[j * W + i] = 1;
          break;
        }
      }
    }
  const toCell = (x, z) => [
    Math.max(0, Math.min(W - 1, Math.floor((x - BOUNDS.x0) / CELL))),
    Math.max(0, Math.min(Hh - 1, Math.floor((z - BOUNDS.z0) / CELL))),
  ];
  const free = (i, j) => i >= 0 && j >= 0 && i < W && j < Hh && !blocked[j * W + i];
  function nearestFree(i, j) {
    if (free(i, j)) return [i, j];
    for (let r = 1; r < 20; r++)
      for (let dj = -r; dj <= r; dj++)
        for (let di = -r; di <= r; di++) {
          if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
          if (free(i + di, j + dj)) return [i + di, j + dj];
        }
    return [i, j];
  }
  function los(ax, az, bx, bz) {
    const d = Math.hypot(bx - ax, bz - az);
    const n = Math.ceil(d / 0.1);
    for (let k = 1; k < n; k++) {
      const [i, j] = toCell(ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n);
      if (!free(i, j)) return false;
    }
    return true;
  }
  // A* on 8 neighbours, then pull the string so people walk straight lines
  function path(ax, az, bx, bz) {
    const [si, sj] = nearestFree(...toCell(ax, az));
    const [gi, gj] = nearestFree(...toCell(bx, bz));
    const S = sj * W + si;
    const G = gj * W + gi;
    const g = new Float32Array(W * Hh).fill(Infinity);
    const from = new Int32Array(W * Hh).fill(-1);
    const closed = new Uint8Array(W * Hh);
    const heap = [];
    const push = (n, f) => {
      heap.push([f, n]);
      let k = heap.length - 1;
      while (k > 0) {
        const p = (k - 1) >> 1;
        if (heap[p][0] <= heap[k][0]) break;
        [heap[p], heap[k]] = [heap[k], heap[p]];
        k = p;
      }
    };
    const pop = () => {
      const top = heap[0];
      const last = heap.pop();
      if (heap.length) {
        heap[0] = last;
        let k = 0;
        for (;;) {
          const l = 2 * k + 1;
          const r = l + 1;
          let m = k;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
          if (m === k) break;
          [heap[m], heap[k]] = [heap[k], heap[m]];
          k = m;
        }
      }
      return top[1];
    };
    const hcost = (n) => {
      const dx = Math.abs((n % W) - gi);
      const dz = Math.abs(((n / W) | 0) - gj);
      return Math.max(dx, dz) + 0.414 * Math.min(dx, dz);
    };
    g[S] = 0;
    push(S, hcost(S));
    while (heap.length) {
      const n = pop();
      if (n === G) break;
      if (closed[n]) continue;
      closed[n] = 1;
      const i = n % W;
      const j = (n / W) | 0;
      for (let dj = -1; dj <= 1; dj++)
        for (let di = -1; di <= 1; di++) {
          if (!di && !dj) continue;
          const ni = i + di;
          const nj = j + dj;
          if (!free(ni, nj)) continue;
          if (di && dj && (!free(i + di, j) || !free(i, j + dj))) continue;
          const m = nj * W + ni;
          const c = g[n] + (di && dj ? 1.414 : 1);
          if (c < g[m]) {
            g[m] = c;
            from[m] = n;
            push(m, c + hcost(m));
          }
        }
    }
    const cells = [];
    if (from[G] === -1 && G !== S) return [{x: bx, z: bz}];
    for (let n = G; n !== -1; n = from[n]) cells.push({x: cx(n % W), z: cz((n / W) | 0)});
    cells.reverse();
    cells.push({x: bx, z: bz});
    const out = [];
    let cur = {x: ax, z: az};
    let k = 0;
    while (k < cells.length) {
      let far = k;
      for (let q = cells.length - 1; q > k; q--)
        if (los(cur.x, cur.z, cells[q].x, cells[q].z)) {
          far = q;
          break;
        }
      out.push(cells[far]);
      cur = cells[far];
      k = far + 1;
    }
    return out;
  }
  return {path};
}
