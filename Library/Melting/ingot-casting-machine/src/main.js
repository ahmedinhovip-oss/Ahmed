// Ingot casting machine simulator: the machine in 3D on the left (ingots glow by temperature), the 5 HP VFD panel, the IR
// temperature panel, the pour, water and discharge controls and the operating steps of the manual on the right, one
// model under both. Left alone it runs a guided tour: the preparations, the preheat, the start, the pour, the cooling,
// the discharge, then two mistakes (too much spray water, an abrupt potentiometer turn).
import {cmd, createPlant, FAULTS, P, rates, step} from './model.js';
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
  overview: {label: 'OVERVIEW', tx: 0, ty: 0.8, tz: -1.2, az: 32, el: 24, d: 22, focus: null, labels: ['dist', 'moulds', 'disch', 'tower', 'panel', 'furnace']},
  pour: {label: 'POUR & DISTRIBUTOR', tx: 4.2, ty: 1.4, tz: 0, az: 35, el: 22, d: 6.5, focus: 'dist', labels: ['dist', 'furnace', 'moulds']},
  cooling: {label: 'MOULDS & SPRAYS', tx: 0, ty: 0.9, tz: 0, az: 12, el: 12, d: 9, focus: 'spray', labels: ['moulds', 'spray']},
  discharge: {label: 'DISCHARGE & HAMMERS', tx: -6.0, ty: 0.7, tz: 0, az: -125, el: 16, d: 6, focus: 'disch', labels: ['disch', 'hammer', 'stack']},
  drive: {label: 'DRIVE', tx: -5.8, ty: 0.6, tz: 1.2, az: 20, el: 12, d: 4, focus: 'drive', labels: ['drive']},
  water: {label: 'COOLING TOWER & PUMPS', tx: 3.0, ty: 1.0, tz: -3.2, az: 60, el: 22, d: 9, focus: 'water', labels: ['tower', 'pumps']},
  panel: {label: 'PANELS', tx: -3.0, ty: 1.2, tz: 2.3, az: 10, el: 10, d: 5, focus: 'panel', labels: ['panel', 'ir']},
};
const SPEEDS = [1, 10, 60, 300];

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
    <div class="ttl"><b>INGOT CASTING MACHINE</b><span>Melting · operator simulator</span></div>
    <div class="views">${Object.entries(VIEWS)
      .map(([k, v], i) => `<button class="vb" data-view="${k}"><i>${i + 1}</i>${v.label}</button>`)
      .join('')}<button class="vb tg" data-tog="labels"><i>L</i>LABELS</button></div>
    <div class="labels"></div>
    <div class="cap"><span class="ck"></span><span class="ct"></span></div>
    <div class="ctrl">
      <div class="grp"><em>SCENARIO</em><button class="cb" data-scn="cold">COLD · BEFORE CASTING</button><button class="cb" data-scn="ready">PREPARED · HOT</button></div>
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
  let s = createPlant('cold');
  let speed = 1;
  const ui = {labelsOn: true, labels: 1, view: 'overview', hiT: -9};
  // the tour turns the potentiometer slowly, as the manual asks
  let potTo = null;
  const act = (name, arg) => {
    const [a, b] = name.split(':');
    switch (a) {
      case 'mcb':
        return cmd.mcb(s, !s.mcb);
      case 'start':
        return cmd.convStart(s);
      case 'stop':
        return cmd.convStop(s);
      case 'reset':
        return cmd.reset(s);
      case 'estop':
        return cmd.estop(s, !s.estop);
      case 'wp1':
        return cmd.pump(s, 1, b === '1');
      case 'wp2':
        return cmd.pump(s, 2, b === '1');
      case 'am':
        return cmd.auto(s, !s.auto);
      case 'pot':
        potTo = null;
        return cmd.pot(s, arg[0]);
      case 'potTo':
        potTo = Number(b);
        return;
      case 'pour':
        return cmd.pour(s, arg[0]);
      case 'metal':
        return cmd.metal(s, arg[0]);
      case 'spray':
        return cmd.spray(s, arg[0]);
      case 'tower':
        return cmd.tower(s, b === '1');
      case 'fill':
        return cmd.fillTower(s);
      case 'hm':
        return cmd.hammers(s, b);
      case 'op':
        return cmd.operator(s, !s.operator);
      case 'fan':
        return cmd.fan(s, !s.fan);
      case 'lube':
        return cmd.lube(s);
      case 'oil':
        return cmd.gearOil(s);
      case 'clean':
        return cmd.clean(s);
      case 'torch':
        return cmd.torch(s, b, b === 'dist' ? !s.torchDist : !s.torchMould);
      case 'coat':
        return cmd.coat(s);
      case 'valve':
        return cmd.lubeValve(s, !s.lubeValve);
      case 'tighten':
        return cmd.tighten(s);
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
    dist: () => `${t('DISTRIBUTOR')} · ${iso((s.pour > 0 ? s.metalT : s.distT).toFixed(0) + ' °C')}`,
    furnace: () => `${t('FURNACE')} · ${iso(s.pour.toFixed(1) + ' t/h')}`,
    moulds: () => `${t('MOULDS')} · ${iso(s.v.toFixed(2) + ' m/min · ' + rates(s).mpm.toFixed(1) + '/min')}`,
    spray: () => `${t('SPRAYS')} · ${iso(s.spray + ' %')}${s.spray > P.spill ? ' · ' + t('TOO HIGH') : ''}`,
    disch: () => `${t('DISCHARGE')} · ${iso(s.dischT.toFixed(0) + ' °C')}`,
    hammer: () => `${t('HAMMERS')} · ${t(s.hammers === 'free' ? 'FREE' : 'LOCKED')}`,
    stack: () => `${t('INGOTS')} · ${iso(s.made.released + ' · ' + (s.made.kg / 1000).toFixed(2) + ' t')}`,
    drive: () => `${t('5 HP MOTOR · SU-412 GEARBOX')} · ${iso(s.vib.toFixed(1) + ' mm/s')}`,
    tower: () => `${t('COOLING TOWER')} · ${iso(s.towerTank.toFixed(0) + ' %')}`,
    pumps: () => `${t('WP-1 / WP-2')} · ${t(s.wp1Run ? 'ON' : 'OFF')} / ${t(s.wp2 && s.mcb ? 'ON' : 'OFF')}`,
    panel: () => `${t('5 HP VFD PANEL')} · ${iso('POT ' + s.potSet + ' %')}`,
    ir: () => `${t('IR SENSORS')} · ${iso(s.dischT.toFixed(0) + ' / ' + (s.pour > 0 ? s.metalT : s.distT).toFixed(0) + ' °C')}`,
  };
  const OFF = {dist: [50, -60], furnace: [40, -50], moulds: [40, -60], spray: [60, 50], disch: [-60, -50], hammer: [60, 40], stack: [-50, 50], drive: [60, 40], tower: [50, -50], pumps: [-50, 40], panel: [-50, -60], ir: [50, -60]};
  labelsEl.innerHTML = Object.keys(LABELS)
    .map((k) => `<div class="lb" data-k="${k}"><svg class="ld"><line/></svg><span></span></div>`)
    .join('');
  const labelNodes = [...labelsEl.children].map((n) => ({k: n.dataset.k, n, span: n.querySelector('span'), line: n.querySelector('line'), svg: n.querySelector('svg')}));

  // ---------------------------------------------------------------- the guided tour
  // each step: at (s of real time), what the cursor presses (a selector) and what the press does
  const H_ = (q) => () => hmi.find(q);
  const O_ = (q) => () => ov.querySelector(q);
  const T_ = (id) => () => hmi.find(`[data-a="${id}"]`);
  const S_ = (k) => () => hmi.find(`[data-sk="${k}"]`);
  const TOUR = [
    {at: 0.0, view: 'overview', cap: 'Ingot casting machine: a chain of moulds under the distributor, water sprays below, hammers at the discharge, a 5 HP motor on a VFD.', run: () => resetPlant('cold')},
    {at: 6, view: 'discharge', ptr: S_('hammers'), run: () => act('hm:locked'), cap: 'Before starting: both hammers locked so they do not hit the empty moulds…'},
    {at: 8.5, view: 'cooling', ptr: S_('lube'), run: () => act('lube'), cap: '…the chain lubricated…'},
    {at: 10.5, view: 'drive', ptr: S_('oil'), run: () => act('oil'), cap: '…the gearbox oil level checked…'},
    {at: 12.5, view: 'cooling', ptr: S_('clean'), run: () => act('clean'), cap: '…and the moulds cleaned with a wire brush.'},
    {at: 15, view: 'pour', ptr: S_('dist'), run: () => (act('torch:dist'), act('torch:mould'), (speed = 300)), cap: 'Torch burners: the distributor for 1 h to 100–150 °C, the moulds to the die-coat temperature, about 150 °C (time ×300).'},
    {at: 28, ptr: S_('mould'), run: () => (act('torch:dist'), act('torch:mould'), (speed = 10)), cap: 'Both hot: torches off.'},
    {at: 30, view: 'cooling', ptr: S_('coat'), run: () => act('coat'), cap: 'Die coat on the mould bases for a smooth release.'},
    {at: 33, view: 'panel', ptr: H_('[data-a="start"]'), run: () => (act('start'), act('valve'), act('potTo:55')), cap: 'START the conveyor on the VFD, open the lubrication ball valve, and turn the potentiometer smoothly and slowly.'},
    {at: 40, view: 'water', ptr: S_('water'), run: () => (act('fill'), act('tower:1'), act('wp2:1'), act('wp1:1'), act('spray', [45])), cap: 'Cooling tower tank above 80 %, tower fan, outlet pump (tank → tower) and inlet pump (tower → sprays). Spray flow kept low.'},
    {at: 47, view: 'pour', ptr: H_('[data-sl="pour"]'), run: () => (act('pour', [9]), act('metal', [725]), (speed = 20)), cap: 'Tilt the furnace: metal at the distributor 725 °C (700–750). The distributor fills each passing mould (time ×20).'},
    {at: 54, view: 'cooling', cap: 'Pour and speed matched: 9 t/h at 3.3 m/min fills each mould with about 10 kg. The sprays cool the ingots on the way.'},
    {at: 60, view: 'discharge', ptr: S_('release'), run: () => (act('hm:free'), act('fan')), cap: 'Free the hammers as the first full moulds arrive. They release 85–90 % of the ingots; the operator knocks out the rest.'},
    {at: 68, cap: 'Ingots leave at 150–250 °C; the pedestal fan helps. Never let one ride round to the distributor.'},
    {at: 74, view: 'cooling', ptr: H_('[data-sl="spray"]'), run: () => act('spray', [90]), cap: 'Mistake: spray pressure too high. Water lands on the moulds and can blast when the metal comes.'},
    {at: 79, run: () => act('spray', [45])},
    {at: 81, view: 'panel', ptr: H_('[data-pot]'), run: () => act('pot', [90]), cap: 'Mistake: potentiometer turned abruptly. The conveyor jerks, ingots ripple, and the moulds are under-filled at this speed.'},
    {at: 86, run: () => act('potTo:55')},
    {at: 89, view: 'overview', run: () => (speed = 1), cap: 'Cast 2 h, then let the conveyor cool 30 min. After casting tighten the bolts and remove the chips. Every step is on the right.'},
    {at: 96, end: true},
  ];
  const TOUR_LEN = 96;
  const FILM = [
    {at: 0.0, view: 'overview', cap: 'Ingot casting machine: moulds on a chain, distributor, water sprays, hammers at the discharge.', run: () => resetPlant('film')},
    {at: 3.2, view: 'pour', cap: 'Metal at 725 °C runs down the launder; the distributor fills each passing mould.'},
    {at: 7.4, view: 'cooling', cap: 'Water sprays under the moulds cool the ingots on their way (time ×6).'},
    {at: 11.6, view: 'discharge', cap: 'At the discharge the moulds turn over and the hammers knock out the ingots at 150–250 °C.'},
    {at: 16.0, view: 'water', cap: 'Tank → cooling tower → sprays, with the outlet and inlet pumps.'},
    {at: 20, end: true},
  ];
  const FILM_MODE = location.hash === '#film';
  const SCRIPT = FILM_MODE ? FILM : TOUR;
  const SLEN = FILM_MODE ? 20 : TOUR_LEN;
  const tour = {on: true, t: 0, i: 0};
  const resetPlant = (sc) => {
    s = createPlant(sc === 'film' ? 'ready' : sc);
    fltSel.value = 'none';
    speed = 1;
    potTo = null;
    if (sc === 'film') {
      // a machine already casting: run it on before the film starts
      Object.assign(s, {lubeValve: true, tower: true, wp1: true, wp2: true, spray: 45, hammers: 'free', fan: true, pour: 9, metalT: 725});
      s.steps.hammers = true;
      cmd.convStart(s);
      step(s, 320);
      s.events.length = 0;
      s.log.length = 0;
      speed = 6;
    }
  };
  const setFault = (f) => {
    cmd.setFault(s, f);
    fltSel.value = f;
  };
  const setView = (v) => {
    ui.view = v;
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
    setCap('You have control. Work through the steps on the right; drag to orbit, scroll to zoom.');
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
    else if (k === 'l') ui.labelsOn = !ui.labelsOn;
  });
  tourBtn.addEventListener('click', () => (tour.on ? takeOver() : startTour()));

  // ---------------------------------------------------------------- controls on the stage
  ov.addEventListener('click', (e) => {
    if (e.target.closest('[data-lang]')) return applyLang(getLang() === 'ar' ? 'en' : 'ar');
    const v = e.target.closest('[data-view]');
    if (v) setView(v.dataset.view);
    const t = e.target.closest('[data-tog]');
    if (t) ui.labelsOn = !ui.labelsOn;
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

    if (potTo !== null) {
      const d = potTo - s.potSet;
      if (Math.abs(d) < 1) potTo = null;
      else cmd.pot(s, s.potSet + Math.sign(d) * Math.min(Math.abs(d), Math.max(1, 10 * dt * speed)));
    }
    step(s, dt * speed);

    // camera
    const v = VIEWS[ui.view];
    const tgt = {tx: v.tx, ty: v.ty, tz: v.tz, az: v.az + off.az, el: clamp(v.el + off.el, -15, 75), d: v.d * off.k};
    const ck = 1 - Math.exp(-dt / 0.35);
    cam.az += wrap(tgt.az - cam.az) * ck;
    for (const key of ['tx', 'ty', 'tz', 'el', 'd']) cam[key] += (tgt[key] - cam[key]) * ck;
    ui.labels += ((ui.labelsOn ? 1 : 0) - ui.labels) * (1 - Math.exp(-dt / 0.2));
    st.setCamera({...cam, az: cam.az * D2R, el: cam.el * D2R}, SW, H);
    const hiK = clamp(1 - (T - ui.hiT - 2.5) / 0.6, 0, 1);
    st.update(s, {labels: ui.labels, focus: v.focus, hiK});
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
