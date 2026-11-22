// AI Office, Phase 1: the team from team.json lives a working day in a 3D office.
// Time runs on a simulated clock (1x = 15 office-seconds per second). Each person asks plan.js where to be,
// walks there on the grid from office.js, and takes the pose of what they are doing.
import * as THREE from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {CSS2DRenderer} from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import team from '../team.json';
import {buildOffice} from './office.js';
import {makePerson, poseTargets, applyPose} from './people.js';
import {makePlanner, fmt, hm, DAYS} from './plan.js';
import {t, pick, getLang, setLang, translateTree} from './i18n.js';

const app = document.getElementById('app');
app.innerHTML = `
<canvas id="gl"></canvas>
<div id="labels"></div>
<header class="bar">
  <div class="brand"><b data-t="AI Office"></b><span data-t="Synergies Castings"></span></div>
  <div class="clock"><span id="day"></span><b id="time"></b></div>
  <div class="grp" id="speeds">
    <button data-speed="0" data-t="Pause"></button>
    <button data-speed="1">1×</button>
    <button data-speed="4">4×</button>
    <button data-speed="16">16×</button>
  </div>
  <button id="lang" class="lang">ع</button>
</header>
<nav class="views">
  <button data-view="overview" data-t="Work floor"></button>
  <button data-view="top" data-t="Top view"></button>
  <button data-view="meeting" data-t="Meeting room"></button>
  <button data-view="cafe" data-t="Cafeteria"></button>
  <button data-view="training" data-t="Training corner"></button>
  <button data-view="lounge" data-t="Lounge"></button>
  <span class="sep"></span>
  <button id="meetNow" class="act" data-t="Start a meeting now"></button>
  <button id="breakNow" class="act" data-t="Break time"></button>
  <button id="workNow" class="act" data-t="Back to work"></button>
  <button id="labelsBtn" data-t="Labels"></button>
  <span class="sep mob"></span>
  <button id="teamBtn" class="mob" data-t="Team"></button>
  <button id="agendaBtn" class="mob" data-t="Agenda"></button>
</nav>
<aside id="agenda" class="panel pleft">
  <h3 data-t="Today's agenda"></h3>
  <div id="agendaList"></div>
  <h3 data-t="Activity"></h3>
  <div id="log"></div>
</aside>
<aside id="team" class="panel pright">
  <h3 data-t="Team"></h3>
  <div id="teamList"></div>
  <p class="hint" data-t="Click a person or a name to see the job description."></p>
</aside>
<aside id="detail" class="panel pright hidden"></aside>
<footer class="note" data-t="Phase 1: the office and the job descriptions. The agents do not do real work yet."></footer>
`;

// ---------------------------------------------------------------- 3D
const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({canvas, antialias: true});
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
const labels = new CSS2DRenderer({element: document.getElementById('labels')});

const scene = new THREE.Scene();
scene.background = new THREE.Color('#e6eaee');
const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.47;
controls.minDistance = 3;
controls.maxDistance = 60;

scene.add(new THREE.HemisphereLight('#ffffff', '#b9a98f', 1.6));
const sun = new THREE.DirectionalLight('#fff4e2', 2.2);
sun.position.set(8, 22, 12);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, {left: -20, right: 20, top: 16, bottom: -16, near: 1, far: 60});
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.02;
scene.add(sun);

const office = buildOffice(scene, team);
const spots = office.spots;
const planner = makePlanner(team);

// ---------------------------------------------------------------- people
const byId = Object.fromEntries(team.agents.map((a) => [a.id, a]));
const deptOf = Object.fromEntries(team.departments.map((d) => [d.id, d]));
const owner = byId[team.owner];
const crowd = team.agents.map((a) => {
  const p = makePerson(a.look, a.id);
  scene.add(p.root);
  const st = {a, p, x: spots.outside.x, z: spots.outside.z, rot: Math.PI, path: [], spot: null, plan: null, visible: false, walkPhase: 0};
  p.root.visible = false;
  p.tag.addEventListener('click', () => select(a.id));
  if (a.chair) p.tag.classList.add('ceo');
  return st;
});
const crowdById = Object.fromEntries(crowd.map((s) => [s.a.id, s]));

// ---------------------------------------------------------------- clock
const MIN_PER_SEC = 0.25; // 1x: 15 office-seconds per real second
let speed = 1;
let simMin = hm('07:54'); // Sunday, just before the stand-up
let lastAgendaMin = -1;
let follow = null;
let labelMode = 1; // 0 off, 1 names, 2 names + what they are doing
let selected = null;

function spotOf(id) {
  return spots[id] || spots.outside;
}
function placeAt(st, spotId) {
  const s = spotOf(spotId);
  st.x = s.x;
  st.z = s.z;
  st.rot = s.rot;
  st.path = [];
}
// put everyone straight where they belong (after a clock jump)
function snapAll() {
  for (const st of crowd) {
    const pl = planner.plan(st.a.id, simMin);
    st.plan = pl;
    st.spot = pl.spot;
    placeAt(st, pl.spot);
    st.visible = !pl.away;
    st.p.root.visible = st.visible;
  }
}

// ---------------------------------------------------------------- log
const logEl = document.getElementById('log');
const log = [];
function addLog(en, ar) {
  const f = fmt(simMin);
  log.unshift({time: `${f.hh}:${f.mm}`, en, ar});
  log.length = Math.min(log.length, 40);
  renderLog();
}
function renderLog() {
  logEl.innerHTML = log
    .slice(0, 8)
    .map((l) => `<div><i dir="ltr">${l.time}</i> ${getLang() === 'ar' ? l.ar : l.en}</div>`)
    .join('');
}
const nm = (a) => pick(a, 'name');
const placeName = (spot) => {
  const k = spot.split(':')[0];
  if (k === 'desk') return null;
  if (k === 'visit') return null;
  return {meet: 'Meeting room', meetstand: 'Meeting room', cafe: 'Cafeteria', train: 'Training corner', lounge: 'Lounge'}[k] || null;
};

// ---------------------------------------------------------------- per-frame update of one person
const WALK = 1.5; // m/s at 1x
function updatePerson(st, dt, now) {
  const id = st.a.id;
  const pl = planner.plan(id, simMin);
  st.plan = pl;
  if (pl.spot !== st.spot) {
    const prev = st.spot;
    st.spot = pl.spot;
    if (!st.visible && !pl.away) {
      placeAt(st, 'outside');
      st.visible = true;
      st.p.root.visible = true;
      addLog(`${st.a.name} arrived`, `${st.a.name_ar} ${fem(st.a) ? 'وصلت' : 'وصل'}`);
    } else if (pl.away && prev) {
      addLog(`${st.a.name} left for the day`, `${st.a.name_ar} ${fem(st.a) ? 'غادرت' : 'غادر'}`);
    }
    const s = spotOf(pl.spot);
    const way = office.nav.path(st.x, st.z, s.x, s.z);
    // leaving the building: through the door, then outside
    st.path = way;
    const where = placeName(pl.spot);
    if (where && prev && placeName(prev) !== where && !pl.meeting) addLog(`${st.a.name} walked to the ${where.toLowerCase()}`, `${st.a.name_ar} ${fem(st.a) ? 'ذهبت' : 'ذهب'} إلى ${AR_PLACE(where)}`);
    if (pl.spot.startsWith('visit:')) {
      const o = byId[pl.with];
      addLog(`${st.a.name} went to ${o.name}'s desk`, `${st.a.name_ar} ${fem(st.a) ? 'ذهبت' : 'ذهب'} إلى مكتب ${o.name_ar}`);
    }
  }

  // walk
  let walking = false;
  if (st.path.length) {
    const step = WALK * Math.min(speed, 6) * dt;
    let left = step;
    while (left > 0 && st.path.length) {
      const tg = st.path[0];
      const dx = tg.x - st.x;
      const dz = tg.z - st.z;
      const d = Math.hypot(dx, dz);
      if (d <= left) {
        st.x = tg.x;
        st.z = tg.z;
        left -= d;
        st.path.shift();
      } else {
        st.x += (dx / d) * left;
        st.z += (dz / d) * left;
        left = 0;
        const want = Math.atan2(dx, dz);
        st.rot = turn(st.rot, want, dt * 10);
      }
    }
    walking = st.path.length > 0;
    st.walkPhase += step * 3.6;
  }
  if (!walking) {
    const s = spotOf(st.spot);
    st.rot = turn(st.rot, s.rot, dt * 6);
    if (pl.away && st.spot === 'outside' && st.visible) {
      st.visible = false;
      st.p.root.visible = false;
    }
  }
  st.walking = walking;
  st.arrived = !walking;
  st.p.walkPhase = st.walkPhase;
  st.p.root.position.set(st.x, 0, st.z);
  st.p.root.rotation.y = st.rot;
  return now;
}
function turn(a, b, k) {
  let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  return a + d * Math.min(1, k);
}
const AR_PLACE = (w) => t(w);
const fem = (a) => a.look && a.look.outfit === 'hijab';

// pose: who speaks in a meeting, who is being visited
function poseFor(st, now) {
  if (st.walking) return 'walk';
  const pl = st.plan;
  if (!pl) return 'stand';
  let pose = pl.pose;
  if (pose === 'meet') {
    // one speaker at a time among those seated in the same meeting
    const group = crowd.filter((o) => o.arrived && o.plan && o.plan.pose === 'meet' && o.plan.meeting === pl.meeting && o.visible);
    if (group.length > 1) {
      const order = group.map((o) => o.a.id).sort();
      const k = Math.floor(now / 5) % order.length;
      if (order[k] === st.a.id) pose = 'speak';
    }
  }
  if (pose === 'type') {
    const visitor = crowd.find((o) => o.plan && o.plan.with === st.a.id && o.arrived && o.visible);
    if (visitor) pose = 'speak';
  }
  return pose;
}

// ---------------------------------------------------------------- tags
function tagText(st) {
  const a = st.a;
  const pl = st.plan || {};
  st.p.tag.querySelector('b').textContent = nm(a);
  st.p.tag.querySelector('.role').textContent = pick(a, 'role');
  let doing = getLang() === 'ar' ? pl.act_ar || t(pl.act) : pl.act;
  if (st.walking && st.spot) {
    const w = placeName(st.spot);
    if (w) doing = `${t('Walking to')} ${t(w)}`;
  }
  st.p.tag.querySelector('.doing').textContent = doing || '';
  st.p.tag.classList.toggle('full', labelMode === 2 || selected === a.id);
  st.p.tag.style.display = labelMode === 0 && selected !== a.id ? 'none' : '';
  const dept = deptOf[a.dept];
  st.p.tag.style.setProperty('--dot', dept ? dept.color : '#f2b632');
}

// ---------------------------------------------------------------- agenda, meeting screen, whiteboard
const SKILLS = [
  ['Casting-defects analysis from photos', 'تحليل عيوب السباكة من الصور'],
  ['Meeting minutes in Arabic and English', 'محاضر الاجتماعات بالعربية والإنجليزية'],
  ['Turning a spreadsheet into a dashboard', 'تحويل جدول بيانات إلى لوحة متابعة'],
  ['Searching machine manuals (PDF)', 'البحث في أدلة الآلات (PDF)'],
  ['Writing an 8D report', 'كتابة تقرير 8D'],
];
function drawScreens(ag) {
  const ar = getLang() === 'ar';
  const font = "'Inter','Segoe UI',Tahoma,sans-serif";
  const now = ag.items.find((i) => i.state === 'now' && i.kind === 'meeting' && i.place === 'meeting');
  const nxt = ag.items.find((i) => i.state === 'next' && i.kind === 'meeting');
  const ov = planner.getOverride();
  const ovOn = ov && ov.kind === 'meeting' && simMin >= ov.from && simMin < ov.to;
  spots._meetScreen.userData.draw((ctx, w, h) => {
    ctx.fillStyle = '#0f1b2b';
    ctx.fillRect(0, 0, w, h);
    ctx.direction = ar ? 'rtl' : 'ltr';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#7fb0e6';
    ctx.font = `600 ${h * 0.09}px ${font}`;
    ctx.fillText(ovOn || now ? t('Now') : t('Next'), w / 2, h * 0.2);
    ctx.fillStyle = '#fff';
    ctx.font = `700 ${h * 0.12}px ${font}`;
    const it = ovOn ? {name: 'Team meeting', name_ar: 'اجتماع الفريق', s: ov.from % 1440, e: ov.to % 1440} : now || nxt;
    const title = it ? (ar ? it.name_ar : it.name) : t('No more meetings today.');
    wrap(ctx, title, w / 2, h * 0.45, w * 0.9, h * 0.15);
    if (it) {
      ctx.fillStyle = '#f2b632';
      ctx.font = `600 ${h * 0.1}px ${font}`;
      ctx.fillText(`${clock(it.s)} – ${clock(it.e)}`, w / 2, h * 0.82);
    }
  });
  const sk = SKILLS[ag.day % SKILLS.length];
  spots._board.userData.draw((ctx, w, h) => {
    ctx.fillStyle = '#fbfbfa';
    ctx.fillRect(0, 0, w, h);
    ctx.direction = ar ? 'rtl' : 'ltr';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#2b6cb0';
    ctx.font = `700 ${h * 0.13}px ${font}`;
    ctx.fillText(t('Skill of the day'), w / 2, h * 0.24);
    ctx.fillStyle = '#222';
    ctx.font = `600 ${h * 0.11}px ${font}`;
    wrap(ctx, ar ? sk[1] : sk[0], w / 2, h * 0.5, w * 0.9, h * 0.14);
    ctx.strokeStyle = '#d9534f';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(w * 0.2, h * 0.86);
    ctx.lineTo(w * 0.42, h * 0.74);
    ctx.lineTo(w * 0.6, h * 0.8);
    ctx.lineTo(w * 0.8, h * 0.66);
    ctx.stroke();
  });
}
function wrap(ctx, text, x, y, maxW, lh) {
  const words = String(text).split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  lines.push(line);
  lines.forEach((l, i) => ctx.fillText(l, x, y + (i - (lines.length - 1) / 2) * lh));
}
const clock = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(Math.floor(m % 60)).padStart(2, '0')}`;

const agendaEl = document.getElementById('agendaList');
let prevStates = {};
function renderAgenda() {
  const ag = planner.agenda(simMin);
  const ar = getLang() === 'ar';
  if (!ag.workday) {
    agendaEl.innerHTML = `<p class="hint">${t('Weekend: the office is closed.')}</p>`;
  } else
    agendaEl.innerHTML = ag.items
      .map((i, k) => {
        const who = i.kind === 'break' ? '' : i.list.length === team.agents.length ? t('everyone') : i.list.map((id) => nm(byId[id])).join(', ');
        return `<div class="ev ${i.state} ${i.kind}" data-k="${k}">
          <i dir="ltr">${clock(i.s)}–${clock(i.e)}</i>
          <b>${ar ? i.name_ar : i.name}</b>
          ${i.chair && i.kind === 'meeting' ? `<em>${t('Chair')}: ${nm(byId[i.chair])}</em>` : ''}
          ${who ? `<small>${who}</small>` : ''}
          <button class="jump" data-s="${i.s}">${t('Jump here')}</button></div>`;
      })
      .join('');
  for (const b of agendaEl.querySelectorAll('.jump'))
    b.onclick = () => {
      const day = Math.floor(simMin / 1440);
      simMin = day * 1440 + Number(b.dataset.s) - 5;
      planner.setOverride(null);
      snapAll();
      addLog(`⏩ ${clock(Number(b.dataset.s) - 5)}`, `⏩ ${clock(Number(b.dataset.s) - 5)}`);
    };
  // log the start of each meeting / break
  for (const i of ag.items) {
    const key = i.name + ag.day;
    if (i.state === 'now' && prevStates[key] === 'next') addLog(`${i.name} started`, `بدأ: ${i.name_ar}`);
    prevStates[key] = i.state;
  }
  drawScreens(ag);
}

// ---------------------------------------------------------------- team list and job description panel
const teamEl = document.getElementById('teamList');
const detailEl = document.getElementById('detail');
function renderTeam() {
  teamEl.innerHTML = team.agents
    .map((a) => {
      const st = crowdById[a.id];
      const doing = st.plan ? (getLang() === 'ar' ? st.plan.act_ar || t(st.plan.act) : st.plan.act) : '';
      return `<button class="member ${selected === a.id ? 'sel' : ''}" data-id="${a.id}" style="--dot:${deptOf[a.dept].color}">
        <span class="dot"></span><b>${nm(a)}</b><small>${pick(a, 'role')}</small><em>${doing}</em></button>`;
    })
    .join('');
  for (const b of teamEl.querySelectorAll('.member')) b.onclick = () => select(b.dataset.id);
}
function renderDetail() {
  if (!selected) {
    detailEl.classList.add('hidden');
    document.getElementById('team').classList.remove('hidden-d');
    return;
  }
  const a = byId[selected];
  const st = crowdById[selected];
  const ar = getLang() === 'ar';
  const boss = !a.reports_to ? t('The Board') : `${nm(byId[a.reports_to])} (${pick(byId[a.reports_to], 'role')})`;
  const ag = planner.agenda(simMin);
  const mine = ag.items.filter((i) => i.kind === 'meeting' && i.list.includes(a.id));
  const doing = st.plan ? (ar ? st.plan.act_ar || t(st.plan.act) : st.plan.act) : '';
  detailEl.innerHTML = `
    <div class="dhead" style="--dot:${deptOf[a.dept].color}">
      <span class="dot"></span><div><h2>${nm(a)}</h2><p>${pick(a, 'role')}</p></div>
      <button id="closeD" title="${t('Close')}">✕</button>
    </div>
    <div class="now"><small>${t('Doing now')}</small><b>${doing}</b></div>
    <div class="drow"><button id="followBtn" class="${follow === a.id ? 'on' : ''}">${t('Follow')}</button></div>
    ${a.assumed ? `<p class="assumed">${t('Starter job description [A]: not yet confirmed.')}</p>` : ''}
    <h4>${t('Job description')}</h4><p>${pick(a, 'summary')}</p>
    <h4>${t('Duties')}</h4><ul>${(ar ? a.duties_ar : a.duties).map((d) => `<li>${d}</li>`).join('')}</ul>
    <h4>${t('Delivers')}</h4><p>${pick(a, 'delivers')}</p>
    <dl><dt>${t('Department')}</dt><dd>${pick(deptOf[a.dept], 'name')}</dd><dt>${t('Reports to')}</dt><dd>${boss}</dd></dl>
    <h4>${t('Meetings today')}</h4><ul>${mine.map((m) => `<li><i>${clock(m.s)}</i> ${ar ? m.name_ar : m.name}</li>`).join('') || '<li>—</li>'}</ul>
    <h4>${t('Phase 2 tools')}</h4><p class="tools">${a.tools_phase2.map((x) => `<span>${x}</span>`).join('')}</p>`;
  detailEl.classList.remove('hidden');
  document.getElementById('team').classList.add('hidden-d');
  document.getElementById('closeD').onclick = () => select(null);
  document.getElementById('followBtn').onclick = () => {
    follow = follow === a.id ? null : a.id;
    renderDetail();
  };
}
function select(id) {
  selected = id;
  if (!id) follow = null;
  for (const st of crowd) st.p.ring.visible = st.a.id === id;
  renderTeam();
  renderDetail();
  if (id && window.innerWidth < 760) document.body.classList.add('show-team');
}

// clicking a person in 3D
const ray = new THREE.Raycaster();
let down = null;
canvas.addEventListener('pointerdown', (e) => (down = [e.clientX, e.clientY]));
canvas.addEventListener('pointerup', (e) => {
  if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return;
  const r = canvas.getBoundingClientRect();
  ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
  const hits = ray.intersectObjects(crowd.filter((s) => s.visible).map((s) => s.p.root), true);
  const hit = hits.find((h) => h.object.userData.person);
  select(hit ? hit.object.userData.person : null);
});

// ---------------------------------------------------------------- camera views
const VIEWS = {
  overview: [[0, 22, 23], [-0.5, 0, -0.5]],
  top: [[0, 36, 0.1], [0, 0, 0]],
  meeting: [[7.6, 8.5, 3.2], [11, 0.5, -6]],
  cafe: [[4, 8, 14.5], [11, 0.4, 6]],
  training: [[-7, 6.5, 14.5], [-11, 0.9, 7.5]],
  lounge: [[1.5, 5.5, 14.5], [-2.2, 0.5, 8.2]],
};
let camAnim = null;
function goView(k) {
  const [p, tg] = VIEWS[k];
  follow = null;
  camAnim = {from: camera.position.clone(), fromT: controls.target.clone(), to: new THREE.Vector3(...p), toT: new THREE.Vector3(...tg), t: 0};
  for (const b of document.querySelectorAll('[data-view]')) b.classList.toggle('on', b.dataset.view === k);
}
camera.position.set(...VIEWS.overview[0]);
controls.target.set(...VIEWS.overview[1]);

// ---------------------------------------------------------------- buttons
for (const b of document.querySelectorAll('[data-view]')) b.onclick = () => goView(b.dataset.view);
function setSpeed(s) {
  speed = s;
  for (const b of document.querySelectorAll('[data-speed]')) b.classList.toggle('on', Number(b.dataset.speed) === s);
}
for (const b of document.querySelectorAll('[data-speed]')) b.onclick = () => setSpeed(Number(b.dataset.speed));
document.getElementById('meetNow').onclick = () => {
  planner.setOverride({kind: 'meeting', from: simMin, to: simMin + 25});
  addLog(`Meeting called by ${owner.name}`, `اجتماع دعا إليه ${owner.name_ar}`);
  goView('meeting');
};
document.getElementById('breakNow').onclick = () => {
  planner.setOverride({kind: 'break', from: simMin, to: simMin + 15});
  addLog(`Break called by ${owner.name}`, `استراحة أعلنها ${owner.name_ar}`);
  goView('cafe');
};
document.getElementById('workNow').onclick = () => {
  planner.setOverride(null);
  addLog('Everyone back to work', 'الجميع عادوا إلى العمل');
  goView('overview');
};
document.getElementById('labelsBtn').onclick = () => {
  labelMode = (labelMode + 1) % 3;
  document.getElementById('labelsBtn').classList.toggle('on', labelMode > 0);
};
document.getElementById('teamBtn').onclick = () => document.body.classList.toggle('show-team');
document.getElementById('agendaBtn').onclick = () => document.body.classList.toggle('show-agenda');
document.getElementById('lang').onclick = () => {
  setLang(getLang() === 'ar' ? 'en' : 'ar');
  applyLang();
};
function applyLang() {
  const ar = getLang() === 'ar';
  document.documentElement.lang = ar ? 'ar' : 'en';
  document.documentElement.dir = ar ? 'rtl' : 'ltr';
  document.getElementById('lang').textContent = ar ? 'EN' : 'ع';
  translateTree(app);
  office.relabel(t, getLang());
  renderLog();
  renderAgenda();
  renderTeam();
  renderDetail();
  updateClock();
}
function updateClock() {
  const f = fmt(simMin);
  document.getElementById('day').textContent = t(DAYS[f.day]);
  document.getElementById('time').textContent = `${f.hh}:${f.mm}`;
}

// ---------------------------------------------------------------- loop
function resize() {
  const w = app.clientWidth;
  const h = app.clientHeight;
  renderer.setSize(w, h, false);
  labels.setSize(w, h);
  camera.aspect = w / h;
  camera.fov = w < 700 ? 55 : 38;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

snapAll();
for (const st of crowd) tagText(st);
setSpeed(1);
applyLang();
document.getElementById('labelsBtn').classList.add('on');
document.querySelector('[data-view="overview"]').classList.add('on');

let last = performance.now();
let uiTick = 0;
let simNow = 0; // seconds of animation time (stops while paused)
// one simulation step: clock, walking, poses
function step(dt) {
  simNow += dt * (speed ? 1 : 0);
  simMin += dt * speed * MIN_PER_SEC;
  // after hours skip the night (and the weekend) to the next working morning
  const tm = simMin % 1440;
  if (tm > planner.END + 20 && crowd.every((s) => !s.visible)) {
    let d = Math.floor(simMin / 1440) + 1;
    while (!planner.workday(d % 7)) d++;
    simMin = d * 1440 + planner.START - 12;
    planner.setOverride(null);
    prevStates = {};
  }
  for (const st of crowd) {
    updatePerson(st, dt * (speed ? 1 : 0), simNow);
    if (!st.visible) continue;
    const pose = poseFor(st, simNow);
    st.p.cup.visible = pose === 'coffee';
    st.p.bubble.classList.toggle('on', pose === 'speak' && labelMode > 0);
    applyPose(st.p, poseTargets(st.p, pose, simNow, speed), dt);
  }
}
function frame(nowMs) {
  // a slow frame still moves the clock on (in small steps so nobody walks through a wall)
  let dt = Math.min(0.5, (nowMs - last) / 1000);
  const fdt = Math.min(0.1, dt);
  last = nowMs;
  while (dt > 0) {
    const h = Math.min(0.05, dt);
    step(h);
    dt -= h;
  }
  dt = fdt;

  // camera: animation to a view, or follow the selected person
  if (camAnim) {
    camAnim.t = Math.min(1, camAnim.t + dt / 1.2);
    const e = camAnim.t < 0.5 ? 2 * camAnim.t * camAnim.t : 1 - (-2 * camAnim.t + 2) ** 2 / 2;
    camera.position.lerpVectors(camAnim.from, camAnim.to, e);
    controls.target.lerpVectors(camAnim.fromT, camAnim.toT, e);
    if (camAnim.t >= 1) camAnim = null;
  } else if (follow && crowdById[follow].visible) {
    const st = crowdById[follow];
    const tg = new THREE.Vector3(st.x, 0.9, st.z);
    const off = camera.position.clone().sub(controls.target);
    controls.target.lerp(tg, 1 - Math.exp(-dt * 3));
    camera.position.copy(controls.target).add(off);
  }
  controls.update();

  uiTick += dt;
  if (uiTick > 0.25) {
    uiTick = 0;
    for (const st of crowd) tagText(st);
    updateClock();
    const m = Math.floor(simMin);
    if (m !== lastAgendaMin) {
      lastAgendaMin = m;
      renderAgenda();
      renderTeam();
      if (selected) renderDetail();
    }
  }
  renderer.render(scene, camera);
  labels.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// for checks from the browser console / automated screenshots
window.__office = {
  setTime: (hhmm, day = 0) => {
    simMin = day * 1440 + hm(hhmm);
    snapAll();
  },
  setSpeed,
  goView,
  advance: (sec) => {
    for (let k = 0; k < sec * 20; k++) step(0.05);
  },
  state: () => crowd.map((s) => ({id: s.a.id, x: +s.x.toFixed(2), z: +s.z.toFixed(2), spot: s.spot, walking: s.walking, visible: s.visible})),
  clock: () => document.getElementById('time').textContent,
  select,
};
