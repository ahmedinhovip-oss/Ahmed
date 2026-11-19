// Vibratory feeder simulator: the feeder in 3D on the left (motion exaggerated), the starter, settings, checks and
// readouts on the right, one model under both. Left alone it runs a guided tour: the checks, a correct start, the
// effect of the eccentric weights, then the classic mistakes (unequal weights, same rotation, small bin opening).
import {cmd, createPlant, FAULTS, P, signals, step} from './model.js';
import {createScene} from './scene.js';
import {createHMI} from './hmi.js';
import {getLang, setLang, t, translateTree} from './i18n.js';

const W = 1600;
const H = 900;
const SW = 900; // 3D stage width; the HMI takes the rest
const D2R = Math.PI / 180;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const wrap = (d) => ((((d + 180) % 360) + 360) % 360) - 180;

const VIEWS = {
  overview: {label: 'OVERVIEW', tx: 0.2, ty: 1.0, tz: 0, az: 32, el: 18, d: 6.2, cut: 0, focus: null, labels: ['trough', 'bin', 'magnet', 'm2', 'panel']},
  motors: {label: 'VIBRATORY MOTORS', tx: -0.1, ty: 0.62, tz: 0, az: 18, el: 4, d: 2.3, cut: 0, focus: 'motors', labels: ['m1', 'm2']},
  trough: {label: 'TROUGH & FLOW', tx: 0.1, ty: 0.95, tz: 0, az: 8, el: 48, d: 3.6, cut: 0, focus: 'trough', labels: ['trough', 'gate']},
  bin: {label: 'BIN OPENING', tx: -0.6, ty: 1.2, tz: 0, az: 70, el: 10, d: 3.2, cut: 0, focus: 'bin', labels: ['bin', 'gate']},
  magnet: {label: 'MAGNET', tx: 1.1, ty: 1.1, tz: 0, az: 55, el: 18, d: 3.4, cut: 0, focus: 'magnet', labels: ['magnet']},
  springs: {label: 'SPRINGS & STAND', tx: 0, ty: 0.7, tz: 0, az: 20, el: 6, d: 3.4, cut: 0, focus: 'springs', labels: ['springs']},
};
const SPEEDS = [1, 5, 20, 60];

const CSS = `
html,body{margin:0;background:#d9d6cf;overflow:hidden;font-family:Inter,system-ui,sans-serif}
#app{position:absolute;left:0;top:0;width:${W}px;height:${H}px;transform-origin:0 0;background:#e9e6e0;overflow:hidden}
#gl{position:absolute;left:0;top:0;width:${SW}px;height:${H}px;touch-action:none;cursor:grab}
#gl.drag{cursor:grabbing}
`;

function boot() {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const app = document.getElementById('app');
  const canvas = document.createElement('canvas');
  canvas.id = 'gl';
  app.appendChild(canvas);
  const st = createScene(canvas);

  // ---------------------------------------------------------------- overlay on the 3D stage
  const ov = document.createElement('div');
  ov.className = 'ov';
  app.appendChild(ov);
  ov.innerHTML = `
    <div class="ttl"><b>VIBRATORY FEEDER</b><span>Magnetic separator line · operator simulator</span></div>
    <div class="views">${Object.entries(VIEWS)
      .map(([k, v], i) => `<button class="vb" data-view="${k}"><i>${i + 1}</i>${v.label}</button>`)
      .join('')}<button class="vb tg" data-tog="cut"><i>C</i>CUTAWAY</button><button class="vb tg" data-tog="labels"><i>L</i>LABELS</button></div>
    <div class="labels"></div>
    <div class="cap"><span class="ck"></span><span class="ct"></span></div>
    <div class="ctrl">
      <div class="grp"><em>SCENARIO</em><button class="cb" data-scn="ready">READY · CHECKED</button><button class="cb" data-scn="install">AS INSTALLED · UNCHECKED</button></div>
      <div class="grp"><em>SIM SPEED</em>${SPEEDS.map((x) => `<button class="cb sp" data-spd="${x}">×${x}</button>`).join('')}</div>
      <div class="grp"><em>INJECT FAULT</em><select class="flt">${Object.entries(FAULTS)
        .map(([k, v]) => `<option value="${k}">${v}</option>`)
        .join('')}</select></div>
    </div>
    <button class="tour"><i></i><span></span></button>
    <button class="langsw" data-lang="1" title="Language"><span data-l="en">EN</span><span data-l="ar">عربي</span></button>
    <div class="cursor"><svg viewBox="0 0 24 24" width="26" height="26"><path d="M3 2 L3 19 L8 14.5 L11.5 22 L14.5 20.6 L11 13.3 L17.5 13.3 Z" fill="#1c1d1f" stroke="#fff" stroke-width="1.4"/></svg></div>
    <div class="ring"></div>`;
  const $ = (q) => ov.querySelector(q);
  const labelsEl = $('.labels');
  const capEl = $('.ct');
  const capK = $('.ck');
  const cursorEl = $('.cursor');
  const ringEl = $('.ring');
  const tourBtn = $('.tour');
  const fltSel = $('.flt');

  // ---------------------------------------------------------------- plant and HMI
  let s = createPlant('ready');
  let speed = 1;
  const ui = {cut: 0, cutOn: false, labelsOn: true, labels: 1, view: 'overview', hiT: -9};
  const act = (name, arg) => {
    const [a, b] = name.split(':');
    switch (a) {
      case 'start':
        return cmd.start(s);
      case 'stop':
        return cmd.stop(s);
      case 'reset':
        return cmd.reset(s);
      case 'estop':
        return cmd.estop(s, !s.estop);
      case 'all':
        return cmd.setAllEcc(s, Number(b));
      case 'ecc':
        return cmd.setEcc(s, arg[0], arg[1], arg[2]);
      case 'swap':
        return cmd.swapDir(s, Number(b));
      case 'mag':
        return cmd.magnet(s, b === '1');
      case 'open':
        return cmd.opening(s, arg[0], arg[1]);
      case 'chk':
        return cmd.check(s, b);
      case 'repair':
        return cmd.repair(s);
      case 'lang':
        return applyLang(getLang() === 'ar' ? 'en' : 'ar');
    }
  };
  const hmi = createHMI(app, act);
  // language: one switch for the 3D side and the HMI, remembered for the next visit
  let capSrc = '';
  const setCap = (txt) => {
    capSrc = txt;
    capEl.textContent = t(txt);
  };
  function applyLang(l) {
    setLang(l);
    document.documentElement.lang = getLang();
    app.classList.toggle('ar', getLang() === 'ar');
    translateTree(ov);
    hmi.relang();
    capEl.textContent = t(capSrc);
    for (const b of ov.querySelectorAll('[data-l]')) b.classList.toggle('on', b.dataset.l === getLang());
    for (const L of labelNodes) L.span.textContent = t(LABELS[L.k]());
  }

  // ---------------------------------------------------------------- labels (callouts on the 3D view)
  // numbers keep their left-to-right order inside Arabic text
  const iso = (x) => '\u2066' + x + '\u2069';
  const LABELS = {
    m1: () => `${t('MOTOR 1')} · ${iso(Math.round(s.rpm[0]) + ' rpm · ' + (s.ecc[0][0] === s.ecc[0][1] ? s.ecc[0][0] + '%' : s.ecc[0][0] + '/' + s.ecc[0][1] + '%'))}`,
    m2: () => `${t('MOTOR 2')} · ${iso(Math.round(s.rpm[1]) + ' rpm · ' + (s.ecc[1][0] === s.ecc[1][1] ? s.ecc[1][0] + '%' : s.ecc[1][0] + '/' + s.ecc[1][1] + '%'))}`,
    trough: () => `${t('TROUGH')} · ${iso(s.amp.toFixed(1) + ' mm · ' + s.speed.toFixed(0) + ' m/min · ' + s.feed.toFixed(1) + ' t/h')}`,
    bin: () => `${t('BIN')} · ${t(s.bridging ? 'BRIDGING' : 'FLOWING')}`,
    gate: () => `${t('OPENING')} · ${iso(s.openV + ' × ' + s.openH + ' mm')}`,
    magnet: () => `${t('MAGNET')} · ${iso(s.iron.toFixed(1) + ' kg Fe')}`,
    springs: () => `${t('SPRINGS')} · ${t(s.springs ? 'SEATED' : 'NOT SEATED')}`,
    panel: () => `${t('COMMON STARTER')} · ${t(s.run ? 'RUN' : 'STOP')}`,
  };
  const OFF = {m1: [-80, -70], m2: [80, 60], trough: [40, -60], bin: [-50, -50], gate: [60, -40], magnet: [50, -50], springs: [50, 40], panel: [-40, -50]};
  labelsEl.innerHTML = Object.keys(LABELS)
    .map((k) => `<div class="lb" data-k="${k}"><svg class="ld"><line/></svg><span></span></div>`)
    .join('');
  const labelNodes = [...labelsEl.children].map((n) => ({k: n.dataset.k, n, span: n.querySelector('span'), line: n.querySelector('line'), svg: n.querySelector('svg')}));

  // ---------------------------------------------------------------- the guided tour
  // each step: at (s of real time), what the cursor presses (a selector) and what the press does
  const H_ = (q) => () => hmi.find(q);
  const O_ = (q) => () => ov.querySelector(q);
  const T_ = (id) => () => hmi.find(`[data-a="${id}"]`);
  const TOUR = [
    {at: 0.0, view: 'overview', cap: 'Motorised vibratory feeder of the magnetic separator line: 500 × 2000 mm SS-304 trough on four springs, two 0.5 HP 1440 rpm unbalance motors.', run: () => resetPlant('install')},
    {at: 6, ptr: T_('chk:supply'), run: () => act('chk:supply'), cap: 'Check before starting: a) 415 V, 3 Ph, 50 Hz, both motors from a common starter…'},
    {at: 8, ptr: T_('chk:conns'), run: () => act('chk:conns'), cap: 'b) connections tight…'},
    {at: 9.5, ptr: T_('chk:bolts'), run: () => act('chk:bolts'), cap: 'c) trough-to-motor bolts tightened…'},
    {at: 11, ptr: T_('chk:springs'), run: () => act('chk:springs'), view: 'springs', cap: 'd) the assembly seated on its springs…'},
    {at: 14, ptr: T_('chk:rotation'), run: () => act('chk:rotation'), view: 'motors', cap: 'e) both motors must turn in opposite directions. Here they turn the same way…'},
    {at: 17, ptr: T_('swap:1'), run: () => act('swap:1'), cap: '…so swap two phases of motor 2.'},
    {at: 20, ptr: T_('all:60'), run: () => act('all:60'), cap: 'Eccentric weights: the same % mark on both sides of both motors, 60 % here.'},
    {at: 23, ptr: T_('start'), run: () => act('start'), view: 'trough', cap: 'START: the opposite rotations add along the drive line and cancel across it: a straight-line throw that walks the scrap forward.'},
    {at: 31, ptr: T_('stop'), run: () => act('stop')},
    {at: 32.5, ptr: T_('all:100'), run: () => act('all:100'), cap: 'More eccentric weight, more force: stroke, conveying speed and feed rise.'},
    {at: 34, ptr: T_('start'), run: () => act('start'), view: 'overview'},
    {at: 41, view: 'magnet', cap: 'At the discharge the overband magnet lifts the iron pieces out before the scrap goes to the furnace.'},
    {at: 47, ptr: T_('stop'), run: () => act('stop'), view: 'motors', cap: 'Mistake: motor 1 inner weight left at 50 %, the others at 100 %…'},
    {at: 49, run: () => (act('ecc', [0, 0, 50]), act('start')), cap: '…the forces no longer balance: a transverse rocking that cracks the motor body or legs (fatigue climbs).'},
    {at: 57, ptr: T_('stop'), run: () => (act('stop'), act('all:60')), cap: 'Stop and set the same % on every side.'},
    {at: 60, ptr: O_('.flt'), run: () => (setFault('bigScrap'), act('start')), view: 'bin', cap: 'Oversize scrap: the bin opening must be at least two times the largest piece, or the material bridges.'},
    {at: 66, run: () => (act('open', ['V', 700]), act('open', ['H', 620])), cap: 'Openings raised above 2 × 300 mm: the material flows again.'},
    {at: 72, view: 'overview', run: () => (setFault('none'), act('open', ['V', 150]), act('open', ['H', 100])), cap: 'Every setting and every check from the manual is on the right. Try them.'},
    {at: 78, end: true},
  ];
  const TOUR_LEN = 78;
  const FILM = [
    {at: 0.0, view: 'overview', cap: 'Vibratory feeder of the magnetic separator line: 500 × 2000 SS-304 trough, two 0.5 HP unbalance motors.', run: () => resetPlant('ready')},
    {at: 2.0, view: 'motors', cap: 'The two motors turn in opposite directions, same % on every eccentric weight.'},
    {at: 3.6, ptr: T_('start'), run: () => act('start')},
    {at: 6.0, view: 'trough', cap: 'Straight-line throw: the scrap walks forward under the bin gate (motion shown ×25).'},
    {at: 9.5, view: 'magnet', cap: 'The overband magnet lifts the iron out before the furnace.'},
    {at: 13.0, view: 'motors', run: () => (act('stop'), act('ecc', [0, 0, 30]), act('swap:1')), cap: 'Wrong: unequal weights and both motors the same way…'},
    {at: 14.6, run: () => act('start'), cap: '…the body rocks across the trough instead of throwing forward, and fatigue builds up on the motor feet.'},
    {at: 20, end: true},
  ];
  const FILM_MODE = location.hash === '#film';
  const SCRIPT = FILM_MODE ? FILM : TOUR;
  const SLEN = FILM_MODE ? 20 : TOUR_LEN;
  const tour = {on: true, t: 0, i: 0};
  const resetPlant = (sc) => {
    s = createPlant(sc);
    fltSel.value = 'none';
    ui.cutOn = false;
  };
  const setFault = (f) => {
    cmd.setFault(s, f);
    fltSel.value = f;
  };
  const setView = (v) => {
    ui.view = v;
    ui.cutOn = VIEWS[v].cut > 0;
    ui.hiT = T;
    Object.assign(off, {az: 0, el: 0, k: 1});
  };
  const startTour = () => {
    tour.on = true;
    tour.t = 0;
    tour.i = 0;
    speed = 1;
  };
  const takeOver = () => {
    if (!tour.on) return;
    tour.on = false;
    speed = 1;
    setCap('You have control. Change the weights, the wiring and the bin openings on the right and watch the throw.');
    capT = T;
  };
  addEventListener('pointerdown', (e) => {
    if (e.target.closest('.tour')) return;
    takeOver();
  }, true);
  addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    takeOver();
    const k = e.key.toLowerCase();
    const v = Object.keys(VIEWS)[Number(k) - 1];
    if (v) setView(v);
    else if (k === 'c') ui.cutOn = !ui.cutOn;
    else if (k === 'l') ui.labelsOn = !ui.labelsOn;
  });
  tourBtn.addEventListener('click', () => (tour.on ? takeOver() : startTour()));

  // ---------------------------------------------------------------- controls on the stage
  ov.addEventListener('click', (e) => {
    if (e.target.closest('[data-lang]')) return applyLang(getLang() === 'ar' ? 'en' : 'ar');
    const v = e.target.closest('[data-view]');
    if (v) setView(v.dataset.view);
    const t = e.target.closest('[data-tog]');
    if (t) {
      if (t.dataset.tog === 'cut') ui.cutOn = !ui.cutOn;
      else ui.labelsOn = !ui.labelsOn;
    }
    const sc = e.target.closest('[data-scn]');
    if (sc) resetPlant(sc.dataset.scn);
    const sp = e.target.closest('[data-spd]');
    if (sp) speed = Number(sp.dataset.spd);
  });
  fltSel.addEventListener('change', () => cmd.setFault(s, fltSel.value));

  // orbit and zoom
  const off = {az: 0, el: 0, k: 1};
  let drag = null;
  let scale = 1;
  canvas.addEventListener('pointerdown', (e) => {
    drag = {x: e.clientX, y: e.clientY};
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add('drag');
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    off.az -= ((e.clientX - drag.x) / scale) * 0.3;
    off.el = clamp(off.el + ((e.clientY - drag.y) / scale) * 0.2, -20, 55);
    drag = {x: e.clientX, y: e.clientY};
  });
  const endDrag = () => {
    drag = null;
    canvas.classList.remove('drag');
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    takeOver();
    off.k = clamp(off.k * Math.exp(e.deltaY * 0.0012), 0.35, 2.2);
  }, {passive: false});

  // fit the fixed 1600 x 900 layout to the window
  const fit = () => {
    scale = Math.min(innerWidth / W, innerHeight / H);
    app.style.transform = `translate(${(innerWidth - W * scale) / 2}px, ${(innerHeight - H * scale) / 2}px) scale(${scale})`;
    const pr = clamp((devicePixelRatio || 1) * scale, 0.75, 2);
    st.renderer.setPixelRatio(pr);
    st.renderer.setSize(SW, H, false);
  };
  fit();
  addEventListener('resize', fit);
  const rel = (el) => {
    const r = el.getBoundingClientRect();
    const a = app.getBoundingClientRect();
    return [(r.left + r.width / 2 - a.left) / scale, (r.top + r.height / 2 - a.top) / scale];
  };

  // ---------------------------------------------------------------- the frame
  let T = 0;
  let capT = 0;
  const cam = {...VIEWS.overview, az: VIEWS.overview.az, el: VIEWS.overview.el};
  const cur = {x: 760, y: 600, fromX: 760, fromY: 600, toX: 760, toY: 600, t0: -9, press: -9};
  let lastUI = 0;
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    tick(dt, now);
    requestAnimationFrame(frame);
  }
  function tick(dt, now) {
    T += dt;

    // tour: fire every step whose time has come; move the cursor toward the next step's target ahead of its press
    if (tour.on) {
      tour.t += dt;
      while (tour.i < SCRIPT.length && tour.t >= SCRIPT[tour.i].at) {
        const stp = SCRIPT[tour.i++];
        if (stp.end) {
          if (!FILM_MODE) startTour();
          break;
        }
        if (stp.view) setView(stp.view);
        if (stp.cap) {
          setCap(stp.cap);
          capT = T;
        }
        if (stp.run) stp.run();
        if (stp.ptr) cur.press = T;
      }
      const nxt = SCRIPT.slice(tour.i).find((x) => x.ptr);
      if (nxt && nxt.at - tour.t < 1.1) {
        const el = nxt.ptr();
        if (el) {
          const [x, y] = rel(el);
          if (Math.abs(x - cur.toX) + Math.abs(y - cur.toY) > 2) {
            Object.assign(cur, {fromX: cur.x, fromY: cur.y, toX: x, toY: y, t0: T});
          }
        }
      }
      const k = clamp((T - cur.t0) / 0.8, 0, 1);
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      cur.x = cur.fromX + (cur.toX - cur.fromX) * e;
      cur.y = cur.fromY + (cur.toY - cur.fromY) * e;
      cursorEl.style.opacity = 1;
      cursorEl.style.transform = `translate(${cur.x - 4}px, ${cur.y - 3}px) scale(${T - cur.press < 0.15 ? 0.85 : 1})`;
    } else cursorEl.style.opacity = 0;
    const rk = clamp(1 - (T - cur.press) / 0.5, 0, 1);
    ringEl.style.opacity = tour.on ? rk : 0;
    ringEl.style.transform = `translate(${cur.x}px, ${cur.y}px) translate(-50%,-50%) scale(${1 + (1 - rk) * 1.6})`;

    step(s, dt * speed);

    // camera
    const v = VIEWS[ui.view];
    const tgt = {tx: v.tx, ty: v.ty, tz: v.tz, az: v.az + off.az, el: clamp(v.el + off.el, -15, 75), d: v.d * off.k};
    const ck = 1 - Math.exp(-dt / 0.35);
    cam.az += wrap(tgt.az - cam.az) * ck;
    for (const key of ['tx', 'ty', 'tz', 'el', 'd']) cam[key] += (tgt[key] - cam[key]) * ck;
    ui.cut += ((ui.cutOn ? 1 : 0) - ui.cut) * (1 - Math.exp(-dt / 0.25));
    ui.labels += ((ui.labelsOn ? 1 : 0) - ui.labels) * (1 - Math.exp(-dt / 0.2));
    st.setCamera({...cam, az: cam.az * D2R, el: cam.el * D2R}, SW, H);
    const hiK = clamp(1 - (T - ui.hiT - 2.5) / 0.6, 0, 1);
    st.update(s, {cut: ui.cut, labels: ui.labels, focus: v.focus, hiK});
    st.renderer.render(st.scene, st.camera);

    // labels
    for (const L of labelNodes) {
      const [x, y, front] = st.project(L.k, SW, H);
      let [ox, oy] = OFF[L.k];
      if (x < 330) ox = Math.abs(ox);
      else if (x > 570) ox = -Math.abs(ox);
      const vis = VIEWS[ui.view].labels.includes(L.k) && front && x > 20 && x < SW - 20 && y > 110 && y < H - 120 && ui.labels > 0.02;
      L.n.style.display = vis ? 'block' : 'none';
      if (!vis) continue;
      L.n.style.opacity = ui.labels;
      L.n.style.transform = `translate(${x}px, ${y}px)`;
      L.span.style.transform = `translate(${ox < 0 ? 'calc(-100% + ' + ox + 'px)' : ox + 'px'}, ${oy - 11}px)`;
      L.line.setAttribute('x1', 0);
      L.line.setAttribute('y1', 0);
      L.line.setAttribute('x2', ox);
      L.line.setAttribute('y2', oy);
      if (FILM_MODE || now - lastUI > 110) L.span.textContent = LABELS[L.k]();
    }

    // overlay state and HMI refresh, about 9 times a second
    if (FILM_MODE || now - lastUI > 110) {
      lastUI = now;
      hmi.refresh(s);
      for (const b of ov.querySelectorAll('[data-view]')) b.classList.toggle('on', b.dataset.view === ui.view);
      ov.querySelector('[data-tog=cut]').classList.toggle('on', ui.cutOn);
      ov.querySelector('[data-tog=labels]').classList.toggle('on', ui.labelsOn);
      for (const b of ov.querySelectorAll('[data-spd]')) b.classList.toggle('on', Number(b.dataset.spd) === speed);
      tourBtn.classList.toggle('on', tour.on);
      tourBtn.querySelector('span').textContent = t(tour.on ? 'GUIDED TOUR · CLICK TO TAKE OVER' : '▶ RESTART GUIDED TOUR');
      capK.style.width = tour.on ? `${clamp(tour.t / SLEN, 0, 1) * 100}%` : '0%';
      $('.cap').style.opacity = tour.on || T - capT < 6 ? 1 : 0;
    }
  }
  // film mode: no clock of its own; the capture steps it with SIM.advance(1 / fps)
  if (!FILM_MODE) requestAnimationFrame(frame);
  let filmNow = 0;
  const advance = (dt) => {
    filmNow += dt * 1000;
    tick(dt, filmNow);
  };
  if (getLang() === 'ar') applyLang('ar');
  window.SIM = {get s() {
    return s;
  }, ui, st, act, applyLang, setView, takeOver, startTour, advance, FILM_MODE, get T() {
    return T;
  }, tour};
}

boot();
