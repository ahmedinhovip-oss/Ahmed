// HA01 operator simulator: the 3D furnace on the left, the cabinet HMI on the right, one plant model under both.
// Left alone it runs a guided tour (start-up, charging a ladle, transfer to HC01, a fault and its reset) with a
// cursor that presses the real HMI buttons; any click, drag, wheel or key hands control to the operator.
import {cmd, createPlant, FAULTS, levelOf, P, seedTrend, step} from './model.js';
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
  overview: {label: 'OVERVIEW', tx: -0.8, ty: 1.9, tz: 0.4, az: -28, el: 19, d: 24, cut: 0, focus: null, labels: ['door', 'ladle', 'swirl', 'flue']},
  burners: {label: 'BURNERS', tx: -0.6, ty: 2.0, tz: -2.6, az: 205, el: 16, d: 11, cut: 0, focus: 'burners', labels: ['burner1', 'burner2', 'fan', 'flue']},
  inside: {label: 'INSIDE', tx: 0, ty: 1.0, tz: 0.2, az: 14, el: 42, d: 14.5, cut: 1, focus: 'bath', labels: ['bath', 'burner1', 'burner2']},
  door: {label: 'DOOR & TILT', tx: -3.9, ty: 2.2, tz: 0, az: 8, el: 10, d: 13.5, cut: 0, focus: 'tilt', labels: ['door', 'ladle']},
  swirl: {label: 'ALUSWIRLER', tx: 0.9, ty: 2.4, tz: 2.8, az: 22, el: 22, d: 8.5, cut: 0, focus: 'swirl', labels: ['swirl', 'bath']},
  pump: {label: 'TRANSFER', tx: 3.9, ty: 2.1, tz: 0.6, az: 62, el: 20, d: 10, cut: 0, focus: 'pump', labels: ['pump', 'rod', 'bath']},
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
    <div class="ttl"><b>HA01 · FVGP-A 1-30</b><span>Gas melting furnace · operator simulator</span></div>
    <div class="views">${Object.entries(VIEWS)
      .map(([k, v], i) => `<button class="vb" data-view="${k}"><i>${i + 1}</i>${v.label}</button>`)
      .join('')}<button class="vb tg" data-tog="cut"><i>C</i>CUTAWAY</button><button class="vb tg" data-tog="labels"><i>L</i>LABELS</button></div>
    <div class="labels"></div>
    <div class="cap"><span class="ck"></span><span class="ct"></span></div>
    <div class="ctrl">
      <div class="grp"><em>SCENARIO</em><button class="cb" data-scn="off">HOT · BURNERS OFF</button><button class="cb" data-scn="run">HOT · RUNNING</button></div>
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
  let s = createPlant('off');
  seedTrend(s);
  let speed = 1;
  const ui = {cut: 0, cutOn: false, labelsOn: true, labels: 1, view: 'overview', hiT: -9};
  const act = (name, arg) => {
    switch (name) {
      case 'screen':
        hmi.show(arg);
        break;
      case 'ptab':
        hmi.setPtab(arg);
        break;
      case 'goIlk':
        hmi.setPtab('ilk');
        hmi.show('param');
        break;
      case 'start':
        cmd.start(s);
        break;
      case 'stop':
        cmd.stop(s);
        break;
      case 'reset':
        cmd.reset(s);
        break;
      case 'estop':
        cmd.estop(s, !s.estop);
        break;
      case 'ack':
        cmd.ack(s);
        break;
      case 'clearAl':
        cmd.clearAlarms(s);
        break;
      case 'history':
        hmi.toggleHist();
        break;
      case 'hydOn':
        cmd.hyd(s, true);
        break;
      case 'hydOff':
        cmd.hyd(s, false);
        break;
      case 'doorUp':
        cmd.door(s, 1);
        break;
      case 'doorDn':
        cmd.door(s, -1);
        break;
      case 'tiltUp':
        cmd.tilt(s, 1);
        break;
      case 'tiltDn':
        cmd.tilt(s, -1);
        break;
      case 'lock':
        cmd.lock(s, true);
        break;
      case 'unlock':
        cmd.lock(s, false);
        break;
      case 'newLadle':
        cmd.newLadle(s);
        break;
      case 'swOn':
        cmd.swirl(s, true);
        break;
      case 'swOff':
        cmd.swirl(s, false);
        break;
      case 'pumpOn':
        cmd.pump(s, true);
        break;
      case 'pumpOff':
        cmd.pump(s, false);
        break;
      case 'hc01':
        cmd.hc01(s, !s.hc01.request);
        break;
      case 'remote':
        cmd.remote(s);
        break;
      case 'lang':
        applyLang(getLang() === 'ar' ? 'en' : 'ar');
        break;
      case 'setSP': {
        const [k, v] = arg;
        const lim = {al: [600, 800], ch: [600, 950], alHigh: [600, 900], alLow: [300, 750], chHigh: [650, 1000], press: [-1, 1], rpm: [0, 600], pumpMin: [50, 900]}[k];
        s.sp[k] = clamp(v, lim[0], lim[1]);
        if (k === 'ch' && s.remote) s.log.unshift({t: s.t, text: 'REMOTE is on: the aluminium loop writes the chamber SP'});
        break;
      }
    }
  };
  const hmi = createHMI(app, act);
  hmi.show('status');
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
    burner1: () => `${t('BURNER #1')} · ${s.fire[0] ? iso(Math.round(s.fire[0] * 100) + '% · ' + Math.round(s.flame[0]) + ' µA') : t('OFF')}`,
    burner2: () => `${t('BURNER #2')} · ${s.fire[1] ? iso(Math.round(s.fire[1] * 100) + '% · ' + Math.round(s.flame[1]) + ' µA') : t('OFF')}`,
    fan: () => `${t('COMBUSTION FAN')} · ${t(s.fault === 'fanTrip' ? 'FAULT' : s.fan.speed > 0.05 ? 'RUN' : 'STOP')}`,
    door: () => `${t('DOOR')} · ${iso(Math.round(s.door.pos * 100) + '%')} ${t('OPEN')}`,
    ladle: () => `${t('LADLE')} · ${iso(s.tilt.ladle.toFixed(1) + ' t · ' + Math.round(s.tilt.pos * P.tiltMax) + '°')}`,
    swirl: () => `${t('ALUSWIRLER')} · ${Math.round(s.swirl.rpm)} rpm`,
    pump: () => `${t('TRANSFER PUMP')} → HC01 · ${s.pump.flow.toFixed(2)} t/min`,
    hpu: () => `${t('HYDRAULIC GROUP')} · ${t(s.hyd.run ? 'RUN' : 'STOP')}`,
    flue: () => `${t('FLUE DAMPER')} · ${Math.round(s.damper * 100)}% · ${s.pres.toFixed(2)} mbar`,
    bath: () => `${t('BATH')} · ${Math.round(levelOf(s))} mm · ${s.mass.toFixed(1)} t · ${s.mass > 0.3 ? Math.round(s.al) : '--'} °C`,
    rod: () => `${t('LEVEL ROD')} · ${P.rodLevel} mm`,
  };
  const OFF = {burner1: [-40, -70], burner2: [40, -70], fan: [-20, -60], door: [-60, -60], ladle: [-70, -60], swirl: [30, -60], pump: [40, -60], hpu: [-30, -50], flue: [40, -40], bath: [-40, 70], rod: [50, 40]};
  labelsEl.innerHTML = Object.keys(LABELS)
    .map((k) => `<div class="lb" data-k="${k}"><svg class="ld"><line/></svg><span></span></div>`)
    .join('');
  const labelNodes = [...labelsEl.children].map((n) => ({k: n.dataset.k, n, span: n.querySelector('span'), line: n.querySelector('line'), svg: n.querySelector('svg')}));

  // ---------------------------------------------------------------- the guided tour
  // each step: at (s of real time), what the cursor presses (a selector) and what the press does
  const H_ = (q) => () => hmi.find(q);
  const O_ = (q) => () => ov.querySelector(q);
  const TOUR = [
    {at: 0.0, view: 'overview', cap: 'HA01 · FVGP-A 1-30 gas melting furnace. The burners are stopped; the metal is holding at about 708 °C.', run: () => resetPlant('off')},
    {at: 4.5, ptr: H_('[data-nav=comb]'), run: () => act('screen', 'comb'), view: 'burners', cap: 'Combustion system: the gas train in yellow, combustion air from the fan in blue, two burners on the back wall.'},
    {at: 10, ptr: H_('[data-a=start]'), run: () => ((speed = 6), act('start')), cap: 'START: the combustion fan runs up and the minimum air pressure switch proves the air.'},
    {at: 13, cap: 'Tightness control: 70Y1 charges the section between the valves, then TEST P MAX and TEST P MIN hold it for 15 s each.'},
    {at: 16.5, cap: 'Pre-purge: both servomotors open fully and the fan sweeps the chamber before any gas is allowed in.'},
    {at: 24.8, view: 'inside', cap: 'Ignition: the servomotors close to the low-fire position, the main valves open, and each burner must prove more than 10 µA of flame signal.'},
    {at: 34, cap: 'Flames proved. After 10 s at low fire the chamber controller modulates the burners toward its set point.'},
    {at: 40, ptr: H_('[data-nav=param]'), run: () => (act('ptab', 'temp'), act('screen', 'param')), view: 'overview', cap: 'Temperature control in REMOTE: the aluminium loop writes the chamber set point; high and low alarms below each.'},
    {at: 47, ptr: H_('[data-nav=hyd]'), run: () => ((speed = 2), act('screen', 'hyd')), view: 'door', cap: 'Charging a ladle from the hydraulic screen.'},
    {at: 49.5, ptr: H_('[data-a=hydOn]'), run: () => act('hydOn'), cap: 'Start the hydraulic group…'},
    {at: 51.5, ptr: H_('[data-a=lock]'), run: () => act('lock'), cap: '…tilt forward to lock the ladle on the platform…'},
    {at: 53.5, ptr: H_('[data-a=doorUp]'), run: () => act('doorUp'), cap: '…and raise the door. With the door open the burners drop to minimum power.'},
    {at: 60.5, ptr: H_('[data-a=tiltUp]'), run: () => act('tiltUp'), cap: 'Tilt up: past the sill the metal pours in. The level rises and the bath temperature mixes.'},
    {at: 79, ptr: H_('[data-a=tiltDn]'), run: () => ((speed = 5), act('tiltDn')), cap: 'Tilt down…'},
    {at: 85, ptr: H_('[data-a=doorDn]'), run: () => act('doorDn'), cap: '…lower the door; 110Y1 EV LOAD then clamps it tight and the burners modulate again.'},
    {at: 89.5, ptr: H_('[data-nav=param]'), run: () => ((speed = 10), act('goIlk')), view: 'pump', cap: 'Transfer to HC01: all four interlocks must be green.'},
    {at: 92.5, ptr: H_('[data-a=hc01]'), run: () => act('hc01'), cap: 'HC01 asks for metal and opens its transfer gate.'},
    {at: 95.5, ptr: H_('[data-a=pumpOn]'), run: () => act('pumpOn'), cap: 'START TRANSFER: the pump runs and the level falls toward the pump minimum.'},
    {at: 103, ptr: H_('[data-a=pumpOff]'), run: () => (act('pumpOff'), act('hc01')), cap: 'Transfer stopped.'},
    {at: 106, ptr: O_('.flt'), run: () => ((speed = 2), setFault('fanTrip'), act('screen', 'comb')), view: 'burners', cap: 'Fault: the combustion fan motor protection trips. Air pressure is lost, the gas valves close and the system locks out.'},
    {at: 113, ptr: H_('[data-nav=alarm]'), run: () => act('screen', 'alarm'), cap: 'Alarms are listed in time order and stay until they are acknowledged.'},
    {at: 117, ptr: H_('[data-a=ack]'), run: () => act('ack'), cap: 'ACKNOWLEDGE silences them.'},
    {at: 120, ptr: O_('.flt'), run: () => setFault('none'), cap: 'Fault repaired on site.'},
    {at: 122.5, ptr: H_('[data-a=clearAl]'), run: () => (act('reset'), act('clearAl')), cap: 'RESET the lockout, then clear the corrected alarms from the list.'},
    {at: 126, ptr: H_('[data-nav=trend]'), run: () => act('screen', 'trend'), view: 'overview', cap: 'Trends: chamber and aluminium, set point and real value, over the last hour.'},
    {at: 133, end: true},
  ];
  const TOUR_LEN = 133;
  // the 20 s film: the same operator moves, condensed, for a recorded video (open the page with #film)
  const FILM = [
    {at: 0.0, view: 'overview', cap: 'HA01 · FVGP-A 1-30 gas melting furnace. Burners stopped, metal holding at 708 °C.', run: () => resetPlant('off')},
    {at: 2.2, ptr: H_('[data-nav=comb]'), run: () => act('screen', 'comb'), view: 'burners', cap: 'Combustion screen: the gas train in yellow, combustion air in blue.'},
    {at: 3.4, ptr: H_('[data-a=start]'), run: () => ((speed = 30), act('start')), cap: 'START: the fan proves air, 70Y1 passes the tightness test, then the chamber is purged.'},
    {at: 6.6, view: 'inside', cap: 'Ignition: each burner must prove more than 10 µA of flame signal, then the burners modulate.'},
    {at: 9.2, ptr: H_('[data-nav=hyd]'), run: () => ((speed = 12), act('screen', 'hyd'), act('hydOn'), act('lock')), view: 'door', cap: 'Charging a ladle: raise the door and the burners drop to low fire.'},
    {at: 9.9, ptr: H_('[data-a=doorUp]'), run: () => act('doorUp')},
    {at: 11.0, ptr: H_('[data-a=tiltUp]'), run: () => act('tiltUp'), cap: 'Tilt up: the ladle pours over the sill. The bath level and temperature change.'},
    {at: 14.0, ptr: H_('[data-nav=param]'), run: () => ((speed = 20), act('tiltDn'), act('goIlk'), act('hc01')), view: 'pump', cap: 'Transfer to HC01: all four interlocks green, then START TRANSFER.'},
    {at: 15.0, ptr: H_('[data-a=pumpOn]'), run: () => act('pumpOn')},
    {at: 17.0, ptr: O_('.flt'), run: () => ((speed = 2), setFault('fanTrip'), act('screen', 'alarm')), view: 'burners', cap: 'Fault: the combustion fan trips. The gas valves close, the burners lock out and the alarm is raised.'},
    {at: 20, end: true},
  ];
  const FILM_MODE = location.hash === '#film';
  const SCRIPT = FILM_MODE ? FILM : TOUR;
  const SLEN = FILM_MODE ? 20 : TOUR_LEN;
  const tour = {on: true, t: 0, i: 0};
  const resetPlant = (sc) => {
    s = createPlant(sc);
    seedTrend(s);
    fltSel.value = 'none';
    ui.cutOn = false;
    hmi.closePad();
    if (hmi.screen !== 'status') hmi.show('status');
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
    setCap('You have control. Use the HMI on the right exactly as on the cabinet panel.');
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
