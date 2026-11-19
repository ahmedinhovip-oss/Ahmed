// Degassing machine operator simulator: the machine in 3D on the left, its control panel and touch HMI on the
// right, one process model under both. Left alone it runs a guided tour (a full auto cycle, then a rotor trip and
// its reset) with a cursor that presses the real buttons; any click, drag, wheel or key hands control over.
import {cmd, createPlant, densityIndex, FAULTS, P, signals, STEP_TEXT, step} from './model.js';
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
  overview: {label: 'OVERVIEW', tx: -0.4, ty: 1.75, tz: 0, az: 24, el: 14, d: 11, cut: 0, focus: null, labels: ['head', 'ladle', 'panel', 'jumbo', 'argon']},
  rotor: {label: 'ROTOR & BAFFLE', tx: 0.25, ty: 1.45, tz: 0, az: 16, el: 9, d: 5.6, cut: 0, focus: 'rotor', labels: ['rotor', 'baffle']},
  inside: {label: 'INSIDE LADLE', tx: 0.35, ty: 0.62, tz: 0, az: 0, el: 20, d: 3.1, cut: 1, focus: 'ladle', labels: ['rotor', 'ladle']},
  feeder: {label: 'FLUX FEEDER', tx: -0.25, ty: 2.05, tz: 0, az: 32, el: 18, d: 3.8, cut: 0, focus: 'feeder', labels: ['feeder', 'head']},
  panel: {label: 'PANEL & GAS', tx: -1.8, ty: 1.4, tz: 0, az: -78, el: 10, d: 6.2, cut: 0, focus: 'panel', labels: ['panel', 'argon', 'hyd']},
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
    <div class="ttl"><b>DEGASSING MACHINE</b><span>Rotary degassing · operator simulator</span></div>
    <div class="views">${Object.entries(VIEWS)
      .map(([k, v], i) => `<button class="vb" data-view="${k}"><i>${i + 1}</i>${v.label}</button>`)
      .join('')}<button class="vb tg" data-tog="cut"><i>C</i>CUTAWAY</button><button class="vb tg" data-tog="lid">LID</button><button class="vb tg" data-tog="labels"><i>L</i>LABELS</button></div>
    <div class="labels"></div>
    <div class="cap"><span class="ck"></span><span class="ct"></span></div>
    <div class="ctrl">
      <div class="grp"><em>SCENARIO</em><button class="cb" data-scn="ready">AUTO · READY</button><button class="cb" data-scn="manual">MANUAL MODE</button></div>
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
  const ui = {lidOn: false, cut: 0, cutOn: false, labelsOn: true, labels: 1, view: 'overview', hiT: -9};
  const LIM = {speed1: [0, 200], speed2: [0, 650], speed3: [0, 450], low: [0, 60], high: [0, 60], fluxRate: [100, 250], vortex: [0, 30], fluxing: [0, 30], mixing: [0, 30], degassing: [0, 30], downDelay: [0, 10], upDelay: [0, 10], pMin: [0, 5], pMax: [0, 5], lowMin: [0, 60], lowMax: [0, 60], highMin: [0, 60], highMax: [0, 60]};
  const act = (name, arg) => {
    if (name.startsWith('m:')) return cmd.manual(s, name.slice(2));
    switch (name) {
      case 'screen':
        hmi.show(arg);
        break;
      case 'controlOn':
        s.control = true;
        break;
      case 'cycleStart':
        cmd.cycleStart(s);
        break;
      case 'cycleStop':
        cmd.cycleStop(s);
        break;
      case 'reset':
        cmd.reset(s);
        break;
      case 'estop':
        cmd.estop(s, !s.estop);
        break;
      case 'modeAuto':
        cmd.mode(s, 'AUTO');
        break;
      case 'modeManual':
        cmd.mode(s, 'MANUAL');
        break;
      case 'clearAlarms':
        cmd.clearAlarms(s);
        break;
      case 'newLadle':
        cmd.newLadle(s);
        break;
      case 'refillFlux':
        cmd.refillFlux(s);
        break;
      case 'lampTest':
      case 'buzzerTest':
        s.log.unshift({t: s.t, text: name === 'lampTest' ? 'Lamp test' : 'Buzzer test'});
        break;
      case 'lang':
        applyLang(getLang() === 'ar' ? 'en' : 'ar');
        break;
      case 'setSP': {
        const [k, v] = arg;
        const lim = LIM[k] || [0, 9999];
        cmd.set(s, k, clamp(v, lim[0], lim[1]));
        break;
      }
    }
  };
  const hmi = createHMI(app, act);
  hmi.show('home');
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
  const st3 = () => (s.head <= 0.002 ? 'HOME' : s.head >= 0.998 ? 'LOWER LIMIT' : s.headCmd > 0 ? 'GOING DOWN' : s.headCmd < 0 ? 'GOING UP' : 'STOPPED');
  const LABELS = {
    rotor: () => `${t('ROTOR')} · ${Math.round(s.rpm)} rpm`,
    baffle: () => `${t('BAFFLE')} · ${t(s.baffle <= 0.002 ? 'UP' : s.baffle >= 0.998 ? 'DOWN' : 'MOVING')}`,
    head: () => `${t('HEAD')} · ${t(st3())}`,
    feeder: () => `${t('VANE FEEDER')} · ${t(s.feeder ? 'ON' : 'OFF')} · ${iso(s.fluxKg.toFixed(1) + ' kg')}`,
    ladle: () => `${t('LADLE')} · ${iso(Math.round(s.metalT) + ' °C · H ' + s.h.toFixed(2) + ' · DI ' + densityIndex(s.h).toFixed(1) + '%')}`,
    argon: () => `${t('ARGON')} · ${iso(s.linePress.toFixed(1) + ' bar · ' + Math.round(s.flow) + ' L/min')}`,
    panel: () => `${t('CONTROL PANEL')} · ${t(s.mode)}`,
    jumbo: () => `${t('JUMBO DISPLAY')} · ${iso(Math.round(s.metalT) + ' °C')}`,
    hyd: () => `${t('HYDRAULIC')} · ${t(s.hyd ? 'ON' : 'OFF')}`,
  };
  const OFF = {rotor: [60, 40], baffle: [-60, -50], head: [-60, -60], feeder: [-50, -60], ladle: [60, 50], argon: [-50, -50], panel: [-40, -70], jumbo: [40, -50], hyd: [-50, 40]};
  labelsEl.innerHTML = Object.keys(LABELS)
    .map((k) => `<div class="lb" data-k="${k}"><svg class="ld"><line/></svg><span></span></div>`)
    .join('');
  const labelNodes = [...labelsEl.children].map((n) => ({k: n.dataset.k, n, span: n.querySelector('span'), line: n.querySelector('line'), svg: n.querySelector('svg')}));

  // ---------------------------------------------------------------- the guided tour
  // each step: at (s of real time), what the cursor presses (a selector) and what the press does
  const H_ = (q) => () => hmi.find(q);
  const O_ = (q) => () => ov.querySelector(q);
  const TOUR = [
    {at: 0.0, view: 'overview', cap: 'Rotary degassing machine (Nutec-Thermo, machines 136–141). A 1 t ladle at 745 °C sits under the rotor; hydrogen is 0.28 ml/100 g.', run: () => resetPlant('ready')},
    {at: 5, ptr: H_('[data-nav=mode]'), run: () => act('screen', 'mode'), cap: 'Mode screen: AUTO for regular production (tower lamp green), MANUAL for setting up (tower lamp yellow).'},
    {at: 8, ptr: H_('[data-a=modeAuto]'), run: () => act('modeAuto')},
    {at: 10, ptr: H_('[data-nav=setting]'), run: () => act('screen', 'setting'), cap: 'Settings (password 12345): down and up delays, vortex, fluxing, mixing and degassing times, gas pressure and flow, and the three rotor speeds.'},
    {at: 16, ptr: H_('[data-nav=process]'), run: () => act('screen', 'process'), cap: 'Machine Process screen: each step lights as the PLC runs it.'},
    {at: 19, ptr: H_('[data-a=cycleStart]'), run: () => ((speed = 3), act('cycleStart')), view: 'rotor', cap: 'CYCLE START: after the 3 s down delay the hydraulic lowers the head from the home (upper) limit.'},
    {at: 23.5, cap: 'Middle sensor: the rotor starts at Speed 1 and argon flows at low flow before the rotor enters the metal.'},
    {at: 27, view: 'inside', run: () => (speed = 12), cap: 'Lower limit: the head stops, Speed 2 (600 rpm) opens a vortex and the process timer starts.'},
    {at: 36.5, view: 'feeder', cap: 'Vane feeder: flux at 180 g/min is drawn down into the vortex, then mixed in.'},
    {at: 46.5, view: 'inside', run: () => (speed = 40), cap: 'Baffle down, Speed 3 (400 rpm) and high argon flow (40 L/min): the anti-vortex plate stops the vortex and fine bubbles sweep out the hydrogen.'},
    {at: 53, ptr: H_('[data-nav=admin]'), run: () => act('screen', 'admin'), cap: 'Admin screen: every motor, limit switch and sensor, with the gas flow, gas pressure and rotor speed.'},
    {at: 61, ptr: H_('[data-nav=drive]'), run: () => act('screen', 'drive'), cap: 'Melt quality: hydrogen falls toward 0.09 ml/100 g and the density index drops below 1 %.'},
    {at: 70, view: 'overview', run: () => (speed = 4), cap: 'Degassing done: baffle up, 3 s up delay, then the rotor turns slowly with argon flowing until it leaves the melt and returns home.'},
    {at: 77, ptr: H_('[data-nav=process]'), run: () => act('screen', 'process'), cap: 'Cycle complete. The metal is ready for casting at about 721 °C.'},
    {at: 81, ptr: H_('[data-a=newLadle]'), run: () => act('newLadle'), cap: 'A new ladle arrives under the machine.'},
    {at: 83, ptr: H_('[data-a=cycleStart]'), run: () => ((speed = 6), act('cycleStart')), view: 'rotor', cap: 'Next cycle…'},
    {at: 88, ptr: O_('.flt'), run: () => ((speed = 2), setFault('rotorTrip')), cap: 'Fault: the rotor motor MPCB-2 trips. The feeder stops, argon keeps flowing, the head returns home and the tower lamp turns red.'},
    {at: 95, ptr: H_('[data-nav=alarm]'), run: () => act('screen', 'alarm'), view: 'panel', cap: 'The alarm screen logs MPCB-2_Rotor on_Tripped and Waiting For Reset.'},
    {at: 100, ptr: O_('.flt'), run: () => setFault('none'), cap: 'Fault repaired on site.'},
    {at: 102, ptr: H_('[data-a=reset]'), run: () => act('reset'), cap: 'RESET, then Clear the logged alarms.'},
    {at: 104.5, ptr: H_('[data-a=clearAlarms]'), run: () => act('clearAlarms')},
    {at: 107, ptr: H_('[data-nav=home]'), run: () => act('screen', 'home'), view: 'overview', cap: 'Ready for the next ladle.'},
    {at: 112, end: true},
  ];
  const TOUR_LEN = 112;
  // the 20 s film: the same operator moves, condensed, for a recorded video (open the page with #film)
  const FILM = [
    {at: 0.0, view: 'overview', cap: 'Rotary degassing machine (Nutec-Thermo). A 1 t ladle at 745 °C, hydrogen 0.28 ml/100 g.', run: () => (resetPlant('ready'), act('screen', 'process'))},
    {at: 2.2, ptr: H_('[data-a=cycleStart]'), run: () => ((speed = 8), act('cycleStart')), view: 'rotor', cap: 'CYCLE START: the head comes down; at the middle sensor the rotor starts and argon flows.'},
    {at: 4.6, view: 'inside', run: () => (speed = 40), cap: 'Lower limit: Speed 2 opens the vortex, then flux is fed into it and mixed.'},
    {at: 6.9, view: 'feeder', cap: 'Vane feeder: flux at 180 g/min drawn into the vortex.'},
    {at: 9.6, view: 'inside', run: () => (speed = 150), cap: 'Baffle down, Speed 3 and high argon flow: the vortex stops and fine bubbles sweep out the hydrogen.'},
    {at: 12.5, ptr: H_('[data-nav=admin]'), run: () => act('screen', 'admin')},
    {at: 15.6, view: 'overview', run: () => ((speed = 6), finishStep('DEGAS'), act('screen', 'process')), cap: 'Done: hydrogen 0.09 ml/100 g, density index under 1 %. The rotor returns home.'},
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
    hmi.closePad();
    if (hmi.screen !== 'home') hmi.show('home');
  };
  // time compression for the film and the tour: end the running step now (its timer reads complete)
  const finishStep = (st) => {
    if (s.step === st) s.stepT = s.set.degassing * 60;
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
    setCap('You have control. Use the HMI and the push buttons on the right exactly as on the machine.');
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
      else if (t.dataset.tog === 'lid') ui.lidOn = !ui.lidOn;
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

    // plant
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
    st.update(s, {lid: ui.lidOn, cut: ui.cut, labels: ui.labels, focus: v.focus, hiK});
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
      ov.querySelector('[data-tog=lid]').classList.toggle('on', ui.lidOn);
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
