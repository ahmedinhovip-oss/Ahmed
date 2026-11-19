// 2 t EOT crane simulator: the crane in its bay in 3D on the left, the pendant, drives, load and the tests of the
// inspection report on the right, one model under both. Left alone it runs a guided tour: travel, hook on the rated
// load, lift (speed and ampere tests), the girder deflection, the load test, the overload device and the witnessed
// overload test, and a long-travel motor trip.
import {cmd, createPlant, deflection, FAULTS, P, step} from './model.js';
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
  overview: {label: 'OVERVIEW', follow: 'bridge', tx: 0, ty: 2.8, tz: 0, az: 48, el: 24, d: 44, focus: null, labels: ['hoist', 'girder', 'bridge', 'dsl', 'pendant', 'load']},
  hoist: {label: 'HOIST TROLLEY', follow: 'hoist', az: 62, el: 6, d: 6, focus: 'hoist', labels: ['hoist', 'rope']},
  hook: {label: 'HOOK & LOAD', follow: 'hook', az: 40, el: 10, d: 8, focus: 'hook', labels: ['hook', 'load', 'rope']},
  girder: {label: 'GIRDER DEFLECTION ×100', follow: 'bridge', az: 90, el: 3, d: 36, defl: 1, focus: 'girder', labels: ['girder', 'load']},
  endcarr: {label: 'END CARRIAGE & DSL', follow: 'ec', az: 30, el: 14, d: 10, focus: 'ec', labels: ['ec', 'dsl']},
  pendant: {label: 'PENDANT', follow: 'pendant', az: 75, el: 12, d: 5, focus: 'pendant', labels: ['pendant']},
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
    <div class="ttl"><b>2 T EOT CRANE</b><span>CNC bay · operator simulator</span></div>
    <div class="views">${Object.entries(VIEWS)
      .map(([k, v], i) => `<button class="vb" data-view="${k}"><i>${i + 1}</i>${v.label}</button>`)
      .join('')}<button class="vb tg" data-tog="labels"><i>L</i>LABELS</button></div>
    <div class="labels"></div>
    <div class="cap"><span class="ck"></span><span class="ct"></span></div>
    <div class="ctrl">
      <div class="grp"><em>SCENARIO</em><button class="cb" data-scn="ready">RESET CRANE</button></div>
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
  let s = createPlant();
  let speed = 1;
  const ui = {cut: 0, labelsOn: true, labels: 1, view: 'overview', hiT: -9};
  const act = (name, arg) => {
    const [a, b, c] = name.split(':');
    switch (a) {
      case 'on':
        return cmd.on(s);
      case 'off':
        return cmd.off(s);
      case 'estop':
        return cmd.estop(s, !s.estop);
      case 'jog':
        return cmd.jog(s, b, Number(c));
      case 'go':
        return cmd.goTo(s, arg[0], arg[1], arg[2] !== false);
      case 'spd':
        return cmd.speed(s, b === '1');
      case 'key':
        return cmd.key(s, b === '1');
      case 'load':
        return cmd.setLoad(s, Number(b));
      case 'rope':
        return cmd.inspectRope(s);
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
  const f2 = (x) => Math.abs(x).toFixed(2);
  const LABELS = {
    hoist: () => `${t('HOIST')} · ${iso(f2(s.v.ho) + ' m/min · 2.2 kW · 120:1')}`,
    rope: () => `${t('ROPE')} · ${iso('8 mm 6×36 · 4')} ${t('FALLS')}`,
    hook: () => `${t('HOOK')} · ${iso(s.pos.ho.toFixed(2) + ' m')}`,
    load: () => `${t('LOAD')} · ${iso(s.load + ' kg')}${s.load && !s.lifted ? ' · ' + t('ON FLOOR') : ''}`,
    girder: () => `${t('GIRDER')} · ${iso(deflection(s).toFixed(1) + ' / ' + P.deflMax.toFixed(2) + ' mm')}`,
    bridge: () => `${t('LONG TRAVEL')} · ${iso(f2(s.v.lt) + ' m/min')}`,
    ec: () => `${t('END CARRIAGE')} · ${iso('Ø200 · 3200 mm')}`,
    dsl: () => `${t('DSL')} · ${iso('415 V')} · ${t(s.power ? 'LIVE' : 'NO POWER')}`,
    pendant: () => `${t('PENDANT')} · ${t(s.on ? 'ON' : 'OFF')}`,
  };
  const OFF = {hoist: [60, -60], rope: [60, 10], hook: [70, 30], load: [-70, 40], girder: [40, -60], bridge: [50, -50], ec: [-50, -60], dsl: [60, 50], pendant: [-60, -50]};
  labelsEl.innerHTML = Object.keys(LABELS)
    .map((k) => `<div class="lb" data-k="${k}"><svg class="ld"><line/></svg><span></span></div>`)
    .join('');
  const labelNodes = [...labelsEl.children].map((n) => ({k: n.dataset.k, n, span: n.querySelector('span'), line: n.querySelector('line'), svg: n.querySelector('svg')}));

  // ---------------------------------------------------------------- the guided tour
  // each step: at (s of real time), what the cursor presses (a selector) and what the press does
  const H_ = (q) => () => hmi.find(q);
  const O_ = (q) => () => ov.querySelector(q);
  const T_ = (id) => () => hmi.find(`[data-a="${id}"]`);
  const go = (ax, x, fast = true) => act('go', [ax, x, fast]);
  const J = (ax, d) => H_(`[data-jog="${ax}:${d}"]`);
  const TOUR = [
    {at: 0.0, view: 'overview', cap: '2.0 t single girder EOT crane (Safex no. 2199) over the 32 m CNC bay: span 22.285 m, lift 4.4 m, class M5, every motion on a VFD.', run: () => resetPlant()},
    {at: 6, view: 'pendant', ptr: H_('[data-a="on"]'), run: () => act('on'), cap: 'The operator walks with the pendant on its festoon. ON closes the main contactor.'},
    {at: 10, view: 'overview', ptr: J('lt', 1), run: () => (go('lt', 14), (speed = 5)), cap: 'FORWARD: long travel at 20 m/min on two 0.75 kW motors, one per end carriage (time ×5).'},
    {at: 15, view: 'endcarr', cap: 'End carriage: 4 m long, wheelbase 3.2 m, Ø200 wheels on 50 × 50 square-bar rails; power from the shrouded DSL.'},
    {at: 20, view: 'hoist', ptr: J('ct', 1), run: () => go('ct', P.span / 2), cap: 'RIGHT: cross travel at 15 m/min (0.55 kW, 41:1) to mid span.'},
    {at: 27, view: 'hook', ptr: H_('[data-load]'), run: () => act('load:2000'), cap: 'Hook on the 2000 kg test weight: the rated load.'},
    {at: 30, ptr: J('ho', 1), run: () => go('ho', 3.2), cap: 'UP at 4.0 m/min: 1445 rpm ÷ 120 on the Ø209 drum gives 7.9 m/min of rope, halved by the 4 falls. The hoist current is recorded (ampere test).'},
    {at: 38, view: 'girder', run: () => (speed = 1), cap: '2000 kg at mid span: the girder bends 13.0 mm (shown ×100), under the IS 807 limit span/900 = 24.76 mm.'},
    {at: 45, view: 'hook', run: () => (speed = 5), cap: 'Held clear of the floor with the disc brake set: the load test.'},
    {at: 50, ptr: J('ho', -1), run: () => go('ho', 1.2), cap: 'DOWN: the lowering current is recorded too, and the load goes back to the floor.'},
    {at: 57, ptr: H_('[data-load]'), run: () => (act('load:2500'), go('ho', 2.4)), cap: '2500 kg: the overload device stops hoisting above 110 % of the rated load.'},
    {at: 63, ptr: H_('[data-a="key:1"]'), run: () => (act('key:1'), go('ho', 2.4)), cap: 'Only for the witnessed overload test (125 %), the test key bypasses it…'},
    {at: 71, cap: '…the 2500 kg are lifted and held: overload test passed. Then the key comes out.'},
    {at: 75, ptr: J('ho', -1), run: () => go('ho', 1.2)},
    {at: 79, ptr: H_('[data-a="key:0"]'), run: () => (act('key:0'), act('load:0'))},
    {at: 81, view: 'overview', ptr: O_('.flt'), run: () => (setFault('lt2'), go('lt', 9)), cap: 'Fault: one long-travel motor trips. The other end leads, the bridge skews and the running motor overloads: stop.'},
    {at: 88, run: () => (setFault('none'), (speed = 1)), cap: 'Every test of the inspection report is on the right. Hold the pendant buttons and run them yourself.'},
    {at: 94, end: true},
  ];
  const TOUR_LEN = 94;
  const FILM = [
    {at: 0.0, view: 'overview', cap: '2.0 t single girder EOT crane over the CNC bay: span 22.285 m, lift 4.4 m, all motions on VFDs.', run: () => resetPlant('film')},
    {at: 2.4, view: 'hoist', cap: 'Hoist: 2.2 kW, 120:1, Ø209 drum, 8 mm rope in 4 falls: 4.0 m/min (time ×8).'},
    {at: 3.2, ptr: J('ho', 1), run: () => (go('ho', 3.4), (speed = 8))},
    {at: 7.2, view: 'girder', run: () => (speed = 1), cap: '2000 kg at mid span: the girder bends 13.0 mm (shown ×100), limit span/900 = 24.76 mm.'},
    {at: 11.5, view: 'overview', ptr: J('lt', 1), run: () => (go('lt', 15), go('ct', 15), (speed = 4)), cap: 'Long travel 20 m/min on two 0.75 kW motors, cross travel 15 m/min (time ×4).'},
    {at: 16.3, view: 'pendant', run: () => go('ho', 1.4), cap: 'Two-step pendant buttons: slow 1/10, fast. Every test of the inspection report runs on the right.'},
    {at: 20, end: true},
  ];
  const FILM_MODE = location.hash === '#film';
  const SCRIPT = FILM_MODE ? FILM : TOUR;
  const SLEN = FILM_MODE ? 20 : TOUR_LEN;
  const tour = {on: true, t: 0, i: 0};
  const resetPlant = (sc) => {
    s = createPlant();
    fltSel.value = 'none';
    speed = 1;
    if (sc === 'film') {
      s.on = true;
      s.pos.ct = P.span / 2;
      s.pos.lt = 9;
      s.load = 2000;
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
    setCap('You have control. Hold the pendant buttons on the right; drag to orbit, scroll to zoom.');
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

    step(s, dt * speed);

    // camera
    const v = VIEWS[ui.view];
    const w = v.follow && st.WHERE[v.follow];
    const tgt = {tx: w ? w[0] : v.tx, ty: w ? w[1] : v.ty, tz: w ? w[2] : v.tz, az: v.az + off.az, el: clamp(v.el + off.el, -15, 75), d: v.d * off.k};
    const ck = 1 - Math.exp(-dt / 0.35);
    cam.az += wrap(tgt.az - cam.az) * ck;
    for (const key of ['tx', 'ty', 'tz', 'el', 'd']) cam[key] += (tgt[key] - cam[key]) * ck;
    ui.cut += ((v.defl ? 1 : 0) - ui.cut) * (1 - Math.exp(-dt / 0.4));
    ui.labels += ((ui.labelsOn ? 1 : 0) - ui.labels) * (1 - Math.exp(-dt / 0.2));
    st.setCamera({...cam, az: cam.az * D2R, el: cam.el * D2R}, SW, H);
    const hiK = clamp(1 - (T - ui.hiT - 2.5) / 0.6, 0, 1);
    st.update(s, {defl: ui.cut, labels: ui.labels, focus: v.focus, hiK});
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
