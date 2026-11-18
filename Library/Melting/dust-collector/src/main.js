// Fume extraction / dust collector operator simulator: the line from IDEX to the chimney in 3D on the left, its
// control panel on the right, one process model under both. Left alone it runs a guided tour (loading and cleaning
// of the bags, the fan, a hot surge, a burst bag, stop and start); any click, drag, wheel or key hands control over.
import {cmd, createPlant, FAULTS, P, seedTrend, signals, step} from './model.js';
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
  overview: {label: 'OVERVIEW', tx: 21, ty: 6.5, tz: 0, az: 14, el: 12, d: 72, cut: 0, focus: null, labels: ['chimney', 'filter', 'idex', 'fan']},
  filter: {label: 'BAG FILTER', tx: 11.7, ty: 4.9, tz: 0, az: 0, el: 7, d: 21, cut: 1, focus: 'filter', labels: ['bags', 'filter', 'hopper1', 'hopper2']},
  pulse: {label: 'PULSE JET', tx: 11.7, ty: 7.2, tz: 0, az: 24, el: 30, d: 15, cut: 1, focus: 'pulse', labels: ['filter', 'air']},
  fan: {label: 'FAN & CHIMNEY', tx: 2.8, ty: 6.5, tz: 0, az: 34, el: 9, d: 34, cut: 0, focus: 'fan', labels: ['fan', 'chimney']},
  idex: {label: 'IDEX TAKE-OFF', tx: 35, ty: 10, tz: 0, az: 30, el: 12, d: 30, cut: 0, focus: 'idex', labels: ['idex', 'stack', 'duct', 'damper']},
  hopper: {label: 'HOPPERS', tx: 11.7, ty: 1.7, tz: 0, az: 22, el: 6, d: 13, cut: 0, focus: 'hopper', labels: ['hopper1', 'hopper2']},
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
    <div class="ttl"><b>DUST COLLECTOR · IDEX FUME EXTRACTION</b><span>Pulse-jet bag filter · operator simulator</span></div>
    <div class="views">${Object.entries(VIEWS)
      .map(([k, v], i) => `<button class="vb" data-view="${k}"><i>${i + 1}</i>${v.label}</button>`)
      .join('')}<button class="vb tg" data-tog="cut"><i>C</i>CUTAWAY</button><button class="vb tg" data-tog="labels"><i>L</i>LABELS</button></div>
    <div class="labels"></div>
    <div class="cap"><span class="ck"></span><span class="ct"></span></div>
    <div class="ctrl">
      <div class="grp"><em>SCENARIO</em><button class="cb" data-scn="run">RUNNING</button><button class="cb" data-scn="stop">STOPPED</button></div>
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
  let s = createPlant('run');
  seedTrend(s);
  let speed = 1;
  const ui = {cut: 0, cutOn: false, labelsOn: true, labels: 1, view: 'overview', hiT: -9};
  const LIM = {flowSP: [8000, 21000], hzSP: [0, 50], cleanStart: [500, 2500], cleanStop: [300, 2000], pulseMs: [50, 300], pulseGap: [2, 60], airLow: [2, 6], bagLimit: [80, 200], bagHH: [90, 220], emitLimit: [5, 100], hopperHigh: [0.3, 0.95]};
  const act = (name, arg) => {
    if (name.startsWith('cm:')) return cmd.cleanMode(s, name.slice(3));
    switch (name) {
      case 'screen':
        hmi.show(arg);
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
      case 'ack':
        cmd.ack(s);
        break;
      case 'estop':
        cmd.estop(s, !s.estop);
        break;
      case 'clearAlarms':
        cmd.clearAlarms(s);
        break;
      case 'empty':
        cmd.empty(s);
        break;
      case 'cleanNow':
        cmd.cleanNow(s);
        break;
      case 'fanAuto':
        cmd.fanMode(s, true);
        break;
      case 'fanMan':
        cmd.fanMode(s, false);
        break;
      case 'fanStart':
        cmd.fanStart(s);
        break;
      case 'fanStop':
        cmd.fanStop(s);
        break;
      case 'dilAuto':
        cmd.dilution(s, 'auto');
        break;
      case 'rv0On':
      case 'rv0Off':
      case 'rv1On':
      case 'rv1Off':
        cmd.rv(s, Number(name[2]), name.endsWith('On'));
        break;
      case 'lang':
        applyLang(getLang() === 'ar' ? 'en' : 'ar');
        break;
      case 'setSP': {
        const [k, v] = arg;
        const lim = LIM[k] || [0, 99999];
        cmd.set(s, k, clamp(v, lim[0], lim[1]));
        break;
      }
    }
  };
  const hmi = createHMI(app, act);
  hmi.show('over');
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
    chimney: () => `${t('CHIMNEY')} · ${iso(s.emit.toFixed(1) + ' mg/Nm³')}`,
    fan: () => `${t('ID FAN')} · ${iso(s.fan.hz.toFixed(1) + ' Hz · ' + Math.round(s.amps) + ' A')}`,
    filter: () => `${t('BAG FILTER')} · ${iso('ΔP ' + Math.round(s.dp / 9.81) + ' mmWC')}`,
    bags: () => `${t('BAGS')} · ${iso('240 × Ø160 × 3000')}`,
    hopper1: () => `${t('HOPPER 1')} · ${iso(Math.round(s.hopper[0]) + ' kg')}`,
    hopper2: () => `${t('HOPPER 2')} · ${iso(Math.round(s.hopper[1]) + ' kg')}`,
    duct: () => `${t('Ø650 DUCT')} · ${iso(signals(s).ductV.toFixed(1) + ' m/s · ' + Math.round(s.tIn) + ' °C')}`,
    idex: () => `IDEX TOP 25 · ${iso(Math.round(P.fumeM3h + s.surge * (P.surgeM3h - P.fumeM3h)) + ' m³/h · ' + Math.round(P.fumeT + s.surge * (P.surgeT - P.fumeT)) + ' °C')}`,
    stack: () => `${t('EXISTING STACK')} · ${t(s.sys && s.fan.run ? 'DAMPER SHUT' : 'NATURAL DRAFT')}`,
    damper: () => `${t('DILUTION DAMPER')} · ${iso(Math.round(s.dilution * 100) + '%')}`,
    air: () => `${t('AIR RECEIVER')} · ${iso(s.air.toFixed(1) + ' bar')}`,
  };
  const OFF = {chimney: [50, -40], fan: [-60, -60], filter: [40, -60], bags: [-60, -60], hopper1: [-60, 50], hopper2: [60, 50], duct: [40, -60], idex: [60, -50], stack: [50, -40], damper: [60, 40], air: [60, -40]};
  labelsEl.innerHTML = Object.keys(LABELS)
    .map((k) => `<div class="lb" data-k="${k}"><svg class="ld"><line/></svg><span></span></div>`)
    .join('');
  const labelNodes = [...labelsEl.children].map((n) => ({k: n.dataset.k, n, span: n.querySelector('span'), line: n.querySelector('line'), svg: n.querySelector('svg')}));

  // ---------------------------------------------------------------- the guided tour
  // each step: at (s of real time), what the cursor presses (a selector) and what the press does
  const H_ = (q) => () => hmi.find(q);
  const O_ = (q) => () => ov.querySelector(q);
  const TOUR = [
    {at: 0.0, view: 'overview', cap: 'Fume extraction for IDEX: 2000 m³/h of fume at 400 °C taken off at TOP 25 into a Ø650 duct, cleaned in a two-compartment pulse-jet bag filter and sent up the 18 m chimney.', run: () => resetPlant('run')},
    {at: 7, view: 'idex', cap: 'At IDEX the take-off joins the existing natural-draft stack. While the fan runs the stack damper is shut and the hood is held at about −50 Pa.'},
    {at: 14, ptr: H_('[data-nav=filter]'), run: () => act('screen', 'filter'), view: 'filter', cap: 'Bag filter: 2 compartments × 120 bags. Dusty gas enters under the bags, dust builds a cake on the outside, clean air leaves from the plenum above.'},
    {at: 21, run: () => ((speed = 40), primeCake(1410)), cap: 'As the cake builds the differential pressure rises. On demand, cleaning starts at 150 mmWC.'},
    {at: 30, view: 'pulse', run: () => (speed = 4), cap: 'Pulse-jet cleaning: one valve per row fires a 120 ms blast of compressed air down the bags every 10 s, and the cake drops into the hopper.'},
    {at: 39, ptr: H_('[data-nav=fan]'), run: () => ((speed = 2), act('screen', 'fan')), view: 'fan', cap: 'The ID fan on a VFD in flow control: as the bags load its speed rises to hold 15,000 m³/h, and falls back after cleaning.'},
    {at: 46, ptr: H_('[data-nav=over]'), run: () => act('screen', 'over'), view: 'overview', cap: 'Overview screen: the whole line on one page.'},
    {at: 50, ptr: O_('.flt'), run: () => ((speed = 4), setFault('surge')), view: 'idex', cap: 'IDEX surge: a charge or an open door sends hotter fume, and the inlet temperature climbs toward the 130 °C bag limit…'},
    {at: 59, ptr: H_('[data-nav=fan]'), run: () => act('screen', 'fan'), view: 'overview', cap: '…so the dilution damper opens, the fan speeds up to take the cold air, and the hood keeps its suction.'},
    {at: 67, ptr: O_('.flt'), run: () => setFault('none'), cap: 'Surge over: the damper closes again.'},
    {at: 70, ptr: O_('.flt'), run: () => ((speed = 2), setFault('bagBurst')), view: 'fan', cap: 'Fault: a bag bursts. Dust passes straight through and the stack monitor jumps past the 20 mg/Nm³ limit.'},
    {at: 80, ptr: H_('[data-nav=alarm]'), run: () => act('screen', 'alarm'), view: 'filter', cap: 'The alarm is logged and the tower lamp turns red. The broken bag (red) is changed at the next stop.'},
    {at: 86, ptr: H_('[data-a=ack]'), run: () => act('ack'), cap: 'Acknowledge…'},
    {at: 89, ptr: O_('.flt'), run: () => setFault('none'), cap: 'Bag replaced.'},
    {at: 92, ptr: H_('[data-a=clearAlarms]'), run: () => act('clearAlarms')},
    {at: 95, ptr: H_('[data-nav=trend]'), run: () => act('screen', 'trend'), view: 'overview', cap: 'Trends: the ΔP saw-tooth of the cleaning cycles, inlet temperature, fan speed and the stack dust.'},
    {at: 102, ptr: H_('[data-a=stop]'), run: () => act('stop'), view: 'idex', cap: 'SYSTEM STOP: the fan runs down, the stack damper opens and IDEX vents by natural draft through the roof again.'},
    {at: 109, ptr: H_('[data-a=start]'), run: () => act('start'), view: 'overview', cap: 'SYSTEM START: extraction resumes.'},
    {at: 114, end: true},
  ];
  const TOUR_LEN = 114;
  // the 20 s film: the same operator moves, condensed, for a recorded video (open the page with #film)
  const FILM = [
    {at: 0.0, view: 'overview', cap: 'IDEX fume extraction: Ø650 duct, two-compartment pulse-jet bag filter, ID fan and 18 m chimney.', run: () => (resetPlant('run'), act('screen', 'over'))},
    {at: 2.6, view: 'idex', cap: 'Take-off at IDEX TOP 25: 2000 m³/h of fume at 400 °C.'},
    {at: 5.2, view: 'filter', run: () => ((speed = 30), primeCake(1480), act('screen', 'filter')), cap: 'Dust cakes on 240 bags. At 150 mmWC the on-demand cleaning starts.'},
    {at: 8.2, view: 'pulse', run: () => (speed = 6), cap: 'Pulse-jet: a 120 ms air blast per row drops the cake into the hoppers.'},
    {at: 12.0, view: 'fan', run: () => ((speed = 3), act('screen', 'fan')), cap: 'The ID fan VFD holds 15,000 m³/h as the bags load.'},
    {at: 15.2, view: 'overview', run: () => ((speed = 16), setFault('surge'), act('screen', 'over')), cap: 'IDEX surge: the dilution damper opens to keep the bags under 130 °C.'},
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
    if (hmi.screen !== 'over') hmi.show('over');
  };
  // put the bags near a given ΔP so the tour reaches the cleaning point quickly
  const primeCake = (dpTarget) => {
    const v = s.v || 0.6;
    const w = (dpTarget / v - P.dpClean) / P.kCake;
    s.cake = s.cake.map((_, i) => w * (1 + 0.04 * Math.sin(i * 1.7)));
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
    setCap('You have control. Use the HMI and the push buttons on the right.');
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
