// Launder transfer pump simulator: the pump in 3D on the left (in the furnace well, over the bath, or on the
// maintenance stand with its parts on the table), the starter, VFD, hoist, readouts, the assembly in bill-of-materials
// order and the operating steps on the right. Left alone it runs a guided tour: assembly, preheat, immersion, a slow
// start, the transfer down to the minimum level, a jammed rotor, and back to the stand for cleaning.
import {cmd, createPlant, FAULTS, ORDER, P, step} from './model.js';
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
  overview: {label: 'OVERVIEW', tx: -1.2, ty: 1.0, tz: -0.4, az: -35, el: 22, d: 9.5, cut: 0, focus: null, labels: ['motor', 'bath', 'launder', 'table']},
  pump: {label: 'PUMP ASSEMBLY', follow: 'pump', az: -30, el: 10, d: 3.6, cut: 0, focus: 'pump', labels: ['motor', 'mount', 'posts', 'base', 'bail']},
  top: {label: 'MOTOR & COUPLING', follow: 'top', az: -30, el: 14, d: 1.9, cut: 1, focus: 'top', labels: ['motor', 'mount']},
  base: {label: 'BASE & ROTOR', follow: 'base', az: -35, el: 25, d: 1.7, cut: 1, focus: 'base', labels: ['base', 'rotor']},
  well: {label: 'WELL & LAUNDER', tx: -0.1, ty: 1.2, tz: -0.9, az: -55, el: 30, d: 5.8, cut: 0, focus: 'well', labels: ['bath', 'launder']},
  table: {label: 'PARTS TABLE', tx: -1.4, ty: 0.9, tz: 1.1, az: 10, el: 26, d: 4.6, cut: 0, focus: 'table', labels: ['table']},
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
    <div class="ttl"><b>LAUNDER TRANSFER PUMP</b><span>MMEI MINI-902L · assembly and operation</span></div>
    <div class="views">${Object.entries(VIEWS)
      .map(([k, v], i) => `<button class="vb" data-view="${k}"><i>${i + 1}</i>${v.label}</button>`)
      .join('')}<button class="vb tg" data-tog="cut"><i>C</i>CUTAWAY</button><button class="vb tg" data-tog="labels"><i>L</i>LABELS</button></div>
    <div class="labels"></div>
    <div class="cap"><span class="ck"></span><span class="ct"></span></div>
    <div class="ctrl">
      <div class="grp"><em>SCENARIO</em><button class="cb" data-scn="bench">PARTS ON THE TABLE</button><button class="cb" data-scn="run">RUNNING IN THE WELL</button></div>
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
  let s = createPlant('bench');
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
      case 'hz':
        return cmd.hz(s, arg[0]);
      case 'move':
        return cmd.move(s, b);
      case 'fit':
        return cmd.fit(s, b);
      case 'rm':
        return cmd.remove(s, b);
      case 'disasm':
        return cmd.disassembleAll(s);
      case 'clean':
        return cmd.clean(s);
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
    motor: () => `${t('MOTOR')} · ${iso('4 HP · ' + Math.round(s.rpm) + ' rpm · ' + s.amps.toFixed(1) + ' A')}`,
    mount: () => `${t('MOTOR MOUNT · COUPLING')} · ${iso('162 mm')}`,
    posts: () => `${t('POSTS')} · ${iso('3 × MINI-201L-R')}`,
    base: () => `${t('SNOUTED BASE')} · ${iso('457 × 356')}`,
    rotor: () => `${t('HOOK ROTOR')} · ${iso('7 in · ' + Math.round(s.rpm) + ' rpm')}`,
    bail: () => `${t('BAIL')} · ${iso('A = 1861 mm')}`,
    bath: () => `${t('BATH')} · ${iso(Math.round((s.level - P.baseTop) * 1000) + ' mm')} ${t('above the base')}`,
    launder: () => `${t('LAUNDER')} · ${iso(s.q.toFixed(2) + ' t/min · ' + s.moved.toFixed(2) + ' t')}`,
    table: () => `${t('PARTS TABLE')} · ${iso(ORDER.filter((k) => !s.asm[k]).length)} ${t('loose')}`,
  };
  const OFF = {motor: [70, -50], mount: [-70, -30], posts: [70, 20], base: [70, 40], rotor: [-70, 50], bail: [60, -40], bath: [60, 50], launder: [-50, -50], table: [50, -60]};
  labelsEl.innerHTML = Object.keys(LABELS)
    .map((k) => `<div class="lb" data-k="${k}"><svg class="ld"><line/></svg><span></span></div>`)
    .join('');
  const labelNodes = [...labelsEl.children].map((n) => ({k: n.dataset.k, n, span: n.querySelector('span'), line: n.querySelector('line'), svg: n.querySelector('svg')}));

  // ---------------------------------------------------------------- the guided tour
  // each step: at (s of real time), what the cursor presses (a selector) and what the press does
  const H_ = (q) => () => hmi.find(q);
  const O_ = (q) => () => ov.querySelector(q);
  const T_ = (id) => () => hmi.find(`[data-a="${id}"]`);
  const F_ = (k) => () => hmi.find(`[data-a="fit:${k}"]`);
  const TOUR = [
    {at: 0.0, view: 'overview', cap: 'MINI launder transfer pump (MMEI MINI-902L-22ABL0): a 4 HP motor turns a 7 in rotor in a snouted base on the well floor, pushing metal up the riser into the launder.', run: () => resetPlant('bench')},
    {at: 6, view: 'table', cap: 'On the maintenance stand: the snouted base, and the parts of the bill of materials on the table.'},
    {at: 9, ptr: F_('motor'), run: () => act('fit:motor'), cap: 'Out of order is refused: the motor needs the posts, shaft, mount, coupling and star ring first.'},
    {at: 13, view: 'pump', ptr: F_('posts'), run: () => act('fit:posts'), cap: 'Three posts (2) into the base (1)…'},
    {at: 15, ptr: F_('shaft'), run: () => act('fit:shaft'), cap: '…the 3 in shaft (3) through the base…'},
    {at: 17, view: 'base', ptr: F_('rotor'), run: () => act('fit:rotor'), cap: '…the 7 in hook rotor (4) onto it, inside the pumping chamber.'},
    {at: 20, view: 'top', ptr: F_('mount'), run: () => act('fit:mount'), cap: 'Motor mount (5) on the posts: four 1/2"-13 × 1 3/4" bolts (13) with lock washers (10).'},
    {at: 23, ptr: F_('coupling'), run: () => act('fit:coupling'), cap: 'Solid coupling (9) on the shaft, at the 162 mm offset distance.'},
    {at: 25.5, ptr: F_('star'), run: () => act('fit:star'), cap: 'Star ring (8): four 1/2"-13 × 1 1/2" bolts (12).'},
    {at: 28, ptr: F_('motor'), run: () => act('fit:motor'), cap: 'Motor (6) into the coupling: four 3/8"-16 × 1 3/4" bolts (14) with lock washers (11).'},
    {at: 31, view: 'pump', ptr: F_('bail'), run: () => act('fit:bail'), cap: 'Bail (7) for the hoist. L version: 1861 mm overall, 1038 mm to the motor mount.'},
    {at: 35, view: 'well', ptr: H_('[data-a="move:preheat"]'), run: () => (act('move:preheat'), (speed = 60)), cap: 'Hang it over the bath to preheat to 500 °C. A cold pump in the metal cracks (time ×60).'},
    {at: 45, ptr: H_('[data-a="move:well"]'), run: () => (act('move:well'), (speed = 10)), cap: 'Preheated: lower it into the well, base on the floor.'},
    {at: 49, ptr: H_('[data-a="start"]'), run: () => (act('hz', [20]), act('start')), cap: 'Start at low speed on the VFD…'},
    {at: 53, ptr: H_('[data-hz]'), run: () => act('hz', [45]), cap: '…then ramp up: below about 28 Hz the rotor cannot lift the metal to the riser lip; at 45 Hz it runs down the launder.'},
    {at: 59, run: () => (speed = 300), cap: 'As the furnace empties, the lift grows and the flow falls (time ×300).'},
    {at: 66, cap: 'Below the pump minimum the rotor draws in air: the flow surges and oxides go down the launder. Stop before this.'},
    {at: 70, ptr: H_('[data-a="stop"]'), run: () => (act('stop'), (speed = 10)), cap: 'Stop.'},
    {at: 72, ptr: O_('.flt'), run: () => (setFault('none'), (s.level = 0.85), setFault('jam'), act('start')), cap: 'Fault: a solid piece jams the rotor. The current jumps and the overload trips. Never force it: the shaft breaks.'},
    {at: 80, ptr: H_('[data-a="move:stand"]'), run: () => (setFault('none'), act('reset'), act('move:stand')), view: 'overview', cap: 'Lift it out onto the stand…'},
    {at: 86, ptr: H_('[data-a="clean"]'), run: () => act('clean'), cap: '…clean the dross from the base and rotor, and inspect the parts. Every step is on the right.'},
    {at: 93, end: true},
  ];
  const TOUR_LEN = 93;
  const FILM = [
    {at: 0.0, view: 'pump', cap: 'MINI launder transfer pump: 4 HP, 1000 rpm, 3 in shaft, 7 in hook rotor (MMEI MINI-902L).', run: () => resetPlant('bench')},
    ...['posts', 'shaft', 'rotor', 'mount', 'coupling', 'star', 'motor', 'bail'].map((k, i) => ({at: 1.0 + i * 0.75, ptr: F_(k), run: () => act('fit:' + k)})),
    {at: 7.2, view: 'well', run: () => (act('move:preheat'), (speed = 900)), cap: 'Preheated over the bath to 500 °C, then lowered into the well (time ×900).'},
    {at: 9.4, run: () => (act('move:well'), (speed = 10))},
    {at: 10.6, ptr: H_('[data-a="start"]'), run: () => (act('hz', [20]), act('start')), cap: 'Started slowly, then ramped up: the rotor pushes the metal up the riser into the launder.'},
    {at: 11.8, run: () => act('hz', [45])},
    {at: 15.5, view: 'base', cap: 'The 7 in hook rotor turning in the snouted base (cutaway).'},
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
    speed = 1;
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
    setCap('You have control. Assemble, preheat, immerse and run the pump from the right; drag to orbit, scroll to zoom.');
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
    const w = v.follow && st.WHERE[v.follow];
    const tgt = {tx: w ? w[0] : (v.tx ?? cam.tx), ty: w ? w[1] : (v.ty ?? cam.ty), tz: w ? w[2] : (v.tz ?? cam.tz), az: v.az + off.az, el: clamp(v.el + off.el, -15, 75), d: v.d * off.k};
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
