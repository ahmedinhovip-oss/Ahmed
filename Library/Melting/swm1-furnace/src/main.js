// SWM#1 procedure trainer: the furnace in 3D on the left, the main cabinet, local panels and the procedure trainer
// on the right, one plant model under both. Left alone it runs a guided tour through the manual's procedures
// (warm-up, vortex and scrap, impeller change, emptying); any click, drag, wheel or key hands control over.
import {cmd, createPlant, FAULTS, levelOf, P, signals, step} from './model.js';
import {PROCS} from './procedures.js';
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
  overview: {label: 'OVERVIEW', tx: 1.2, ty: 2.0, tz: 0.4, az: 28, el: 20, d: 23, cut: 0, focus: null, labels: ['door', 'vortex', 'asw', 'pump', 'cabinet']},
  chamber: {label: 'CHAMBER', tx: 0, ty: 1.0, tz: 0.2, az: 14, el: 42, d: 14.5, cut: 1, focus: 'bath', labels: ['bath', 'burner1', 'burner2']},
  vortex: {label: 'VORTEX WELL', tx: 4.05, ty: 2.0, tz: 1.0, az: 75, el: 58, d: 5.2, cut: 0, focus: 'vortex', labels: ['vortex', 'conveyor']},
  asw: {label: 'ALUSWIRLER & HOIST', tx: 5.6, ty: 2.6, tz: 0, az: 62, el: 12, d: 11, cut: 0, focus: 'asw', labels: ['asw']},
  plugs: {label: 'PLUGS & PUMP', tx: 4.3, ty: 0.7, tz: 0, az: 55, el: 35, d: 6.5, cut: 0, focus: 'plugs', labels: ['plugs', 'pump']},
  door: {label: 'DOOR & LADLE', tx: -3.9, ty: 2.2, tz: 0, az: 8, el: 10, d: 13.5, cut: 0, focus: 'tilt', labels: ['door', 'ladle']},
};
const SPEEDS = [1, 10, 60, 600];

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
    <div class="ttl"><b>SWM#1 · FVGP-A 3-30 SIDEWELL MELTER</b><span>Procedure trainer · user manual 5.3</span></div>
    <div class="views">${Object.entries(VIEWS)
      .map(([k, v], i) => `<button class="vb" data-view="${k}"><i>${i + 1}</i>${v.label}</button>`)
      .join('')}<button class="vb tg" data-tog="cut"><i>C</i>CUTAWAY</button><button class="vb tg" data-tog="labels"><i>L</i>LABELS</button></div>
    <div class="labels"></div>
    <div class="cap"><span class="ck"></span><span class="ct"></span></div>
    <div class="ctrl">
      <div class="grp"><em>SCENARIO</em><button class="cb" data-scn="cold">COLD · EMPTY</button><button class="cb" data-scn="hot">HOT · RUNNING</button></div>
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
  const trainer = {id: 'p1', i: 0, start: 0, score: 100};
  let speed = 1;
  const ui = {cut: 0, cutOn: false, labelsOn: true, labels: 1, view: 'overview', hiT: -9};
  const plugKeys = ['pneu', 'aswA', 'vortexB', 'pumpM'];
  const act = (name, arg) => {
    const [a, b, c] = name.split(':');
    switch (a) {
      case 'q20':
        return cmd.q20(s, !s.q20);
      case 'aux':
        return cmd.aux(s);
      case 'safety':
        return cmd.safetyReset(s);
      case 'fan':
        return s.fan.run ? cmd.fanStop(s) : cmd.fanStart(s);
      case 'valve':
        return cmd.openMainValve(s);
      case 'sel':
        return cmd.selector(s, Number(b), c);
      case 'silence':
        return cmd.silence(s);
      case 'setSP':
        return cmd.setSP(s, arg[0], clamp(arg[1], 0, 1100));
      case 'aswRun':
        return cmd.aswRun(s, true);
      case 'aswStop':
        return cmd.aswRun(s, false);
      case 'mode':
        return cmd.aswMode(s, b);
      case 'spd':
        return cmd.aswSpeed(s, s.asw.speed + Number(b));
      case 'speed':
        return cmd.aswSpeed(s, arg);
      case 'doorOpen':
        return cmd.door(s, 1);
      case 'doorClose':
        return cmd.door(s, -1);
      case 'doorLock':
        return cmd.doorLock(s, !s.door.locked);
      case 'pumpOn':
        return cmd.pump(s, true);
      case 'pumpOff':
        return cmd.pump(s, false);
      case 'pumpOut':
        return cmd.pumpRemove(s);
      case 'scrapOn':
        return cmd.scrap(s, true);
      case 'scrapOff':
        return cmd.scrap(s, false);
      case 'stype':
        return cmd.scrapType(s, arg);
      case 'squal':
        return cmd.scrapQuality(s, arg);
      case 'proc':
        trainer.id = arg;
        trainer.i = 0;
        trainer.start = s.t;
        return;
      case 'loadScn':
        resetPlant(PROCS.find((p) => p.id === trainer.id).scenario);
        return;
      case 'i':
        return cmd.inspectItem(s, b);
      case 'cleanSensor':
        return cmd.cleanSensor(s);
      case 'platDoor':
        return cmd.platDoor(s, true);
      case 'pour':
        return cmd.pourLadle(s);
      case 'newLadle':
        return cmd.newLadle(s);
      case 'skim':
        return cmd.skim(s);
      case 'skimSurface':
        return cmd.skimSurface(s);
      case 'trays':
        return plugKeys.forEach((k) => cmd.tray(s, k));
      case 'cone':
        return cmd.cone(s, Number(b));
      case 'unlock':
        return cmd.lock(s, b, false);
      case 'open':
        return cmd.plug(s, b, true);
      case 'closeAll':
        plugKeys.forEach((k) => {
          cmd.plug(s, k, false);
          cmd.lock(s, k, true);
        });
        return;
      case 'clipsOff':
        return cmd.clips(s, false);
      case 'clipsOn':
        return cmd.clips(s, true);
      case 'h':
        return cmd.hoist(s, b);
      case 'removeImp':
        return cmd.removeImpeller(s);
      case 'dry':
        return cmd.dryOnVault(s);
      case 'fitImp':
        return cmd.fitImpeller(s, !!s.asw.dried);
      case 'align':
        return cmd.align(s);
      case 'tighten':
        return cmd.tighten(s);
      case 'cleanVolute':
        return cmd.cleanVolute(s);
      case 'retighten':
        return cmd.retighten(s);
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
    burner1: () => `201SH5 · ${t(s.burner[0].toUpperCase())}`,
    burner2: () => `202SH1 · ${t(s.burner[1].toUpperCase())}`,
    door: () => `${t('MAIN DOOR')} · ${iso(Math.round(s.door.pos * 100) + '%')}`,
    ladle: () => `${t('LADLE')} · ${iso(s.ladle.t.toFixed(1) + ' t')}`,
    vortex: () => `${t('VORTEX')} · ${t(s.vortex.state.toUpperCase())}`,
    asw: () => `${t('ALUSWIRLER')} · ${iso(s.asw.speed + '% · ' + Math.round(s.asw.rpm) + ' rpm')} · ${t(s.asw.pos.toUpperCase())}`,
    pump: () => `${t('EXTRACTION PUMP')} → HC#1 · ${iso(s.pump.flow.toFixed(2) + ' t/min')}`,
    plugs: () => `${t('PLUGS')} · ${Object.values(s.plugs).filter((p) => p.open).length}/4 ${t('OPEN')}`,
    cabinet: () => `${t('MAIN CABINET')} · ${t(s.fan.run ? (signals(s).purged ? 'FAN ON' : 'PURGING') : 'FAN OFF')}`,
    bath: () => `${t('BATH')} · ${iso(Math.round(levelOf(s)) + ' mm · ' + (s.mass > 0.3 ? Math.round(s.alT) : '--') + ' °C')}`,
    conveyor: () => `${t('SCRAP')} · ${iso(Math.round(s.scrap.rate) + ' kg/h')} · ${t(s.scrap.on ? 'ON' : 'OFF')}`,
  };
  const OFF = {burner1: [-40, -70], burner2: [40, -70], door: [-60, -60], ladle: [-70, -60], vortex: [50, -60], asw: [40, -70], pump: [50, 50], plugs: [60, 40], cabinet: [-50, -50], bath: [-40, 70], conveyor: [50, -40]};
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
    {at: 0.0, view: 'overview', cap: 'SWM#1, FVGP-A 3-30 sidewell melter: the chamber with its burners and main door, and the side wells: vortex well, Aluswirler, extraction pump.', run: () => (resetPlant('cold'), setProc('p2'))},
    {at: 6, ptr: T_('q20'), run: () => (act('q20'), act('aux'), act('safety')), cap: 'Initial warm-up (§2): master switch 20Q1, auxiliary connection, safety relay reset.'},
    {at: 10, ptr: T_('fan'), run: () => ((speed = 60), act('fan')), cap: '201SH3 starts the combustion fan: a 5 min purge with the lamp flashing, while the tightness control checks the solenoid valves.'},
    {at: 17, ptr: T_('valve'), run: () => act('valve'), cap: 'Purge done, lamp steady: "Open main solenoid valve" sends gas and oxygen to the burners.'},
    {at: 19.5, ptr: T_('sel:0:ON'), run: () => act('sel:0:ON')},
    {at: 21, ptr: T_('sel:1:ON'), run: () => ((speed = 1), act('sel:1:ON')), view: 'chamber', cap: 'Selectors 201SH5 and 202SH1 to ON: both burners light. From cold, raise the set point gradually over a day so moisture escapes.'},
    {at: 29, view: 'vortex', run: () => (resetPlant('hot'), setProc('p3'), act('mode:MAN'), act('aswRun'), act('speed', 45)), cap: 'Permanent regime (§3): the Aluswirler (207SH1, 208SH2 MAN, speed 208S1) pulls a stable vortex in the side well.'},
    {at: 36, ptr: T_('scrapOn'), run: () => act('scrapOn'), cap: 'Clean, dry, loose scrap (chip, profile, UBC, under 150 mm) is fed in and swallowed under the metal.'},
    {at: 43, ptr: T_('spd:5'), run: () => act('speed', 82), cap: 'Too fast for this level: an aggressive vortex draws air in. Flames and dross: lower the speed.'},
    {at: 50, ptr: T_('spd:-5'), run: () => act('speed', 45), cap: 'Back to a stable vortex.'},
    {at: 54, view: 'asw', run: () => (act('scrapOff'), act('aswStop'), setProc('p6')), cap: 'Impeller change (§6.3–6.4): stop the rotation completely first. Never lift a turning impeller.'},
    {at: 58, ptr: T_('clipsOff'), run: () => act('clipsOff')},
    {at: 59.5, ptr: T_('h:up'), run: () => act('h:up')},
    {at: 61, ptr: T_('h:toMaint'), run: () => ((speed = 60), act('h:toMaint')), cap: 'Clips loose, hoist up, onto the maintenance support to cool.'},
    {at: 64, ptr: T_('fitImp'), run: () => (jump(900), act('removeImp'), act('dry'), act('fitImp'), act('align'), act('tighten'), act('cleanVolute')), cap: 'A new impeller, dried 24 h on the vault, fitted, turned at 10 % and aligned, bolts tightened; the volute cleaned.'},
    {at: 69, ptr: T_('h:toWell'), run: () => (act('h:toWell'), act('setSP', ['ch', 940]), jump(4 * 3600))},
    {at: 71, ptr: T_('h:descend'), run: () => ((speed = 1), act('h:descend'), jump(1210)), cap: 'Slow descent to 25 mm above the bath, held 20 min, with the metal 40 °C above its usual set point.'},
    {at: 74, ptr: T_('h:third'), run: () => (act('h:third'), jump(1810)), cap: 'Then 1/3 of the blade length every 10 minutes, waiting while steam bubbles rise from the ceramic.'},
    {at: 78, ptr: T_('h:third'), run: () => (act('h:third'), jump(610))},
    {at: 81, ptr: T_('h:third'), run: () => (act('h:third'), act('clipsOn'))},
    {at: 83, run: () => (act('aswRun'), act('speed', 10)), cap: 'Fixed with the clips; test turns at 10 %. After 2 h, stop and hot re-tighten the bowl screws before any more speed.'},
    {at: 86.5, run: () => (jump(2 * 3600), act('aswStop'))},
    {at: 88, ptr: T_('retighten'), run: () => (act('retighten'), act('aswRun'), act('speed', 45))},
    {at: 92, view: 'plugs', run: () => (resetPlant('hot'), setProc('p5'), (speed = 60)), cap: 'Emptying (§6.2.2) in 4 phases: surface slag off and a tray under every plug, then the pump down to 300 mm…'},
    {at: 96, ptr: T_('trays'), run: () => (act('skimSurface'), act('skimSurface'), act('skimSurface'), act('trays'), act('pumpOn'))},
    {at: 103, ptr: T_('open:pneu'), run: () => (act('cone:1'), act('unlock:pneu'), act('open:pneu')), cap: '…then the pneumatic plug with a new ceramic cone, and the manual plugs, each with its lock removed and PPE on.'},
    {at: 110, view: 'overview', run: () => ((speed = 1), setProc('p1')), cap: 'Seven procedures from the manual, each step checked and every violation recorded. Pick one, load its starting situation and try it.'},
    {at: 117, end: true},
  ];
  const TOUR_LEN = 117;
  // the 20 s film (open the page with #film)
  const FILM = [
    {at: 0.0, view: 'overview', cap: 'SWM#1 sidewell melter: chamber, vortex well, Aluswirler and extraction pump.', run: () => (resetPlant('hot'), setProc('p3'))},
    {at: 2.4, view: 'vortex', run: () => (act('mode:MAN'), act('aswRun'), act('speed', 45), act('scrapOn')), cap: 'The Aluswirler pulls a stable vortex: clean, dry scrap is swallowed under the metal.'},
    {at: 7.0, run: () => act('speed', 82), cap: 'Too fast: an aggressive vortex, flames and dross.'},
    {at: 9.4, view: 'asw', run: () => (act('speed', 45), act('scrapOff'), act('aswStop'), setProc('p6'), act('clipsOff')), cap: 'Impeller change: rotation stopped completely, clips off, hoist up.'},
    {at: 11.1, run: () => act('h:up')},
    {at: 12.0, run: () => (act('h:toMaint'), jump(900), act('removeImp'), act('dry'), act('fitImp'), act('align'), act('tighten'), act('cleanVolute'), act('h:toWell'), act('setSP', ['ch', 940]), jump(4 * 3600)), cap: 'A new dried impeller, aligned and tightened, over the well; the bath brought 40 °C above its set point.'},
    {at: 14.2, run: () => ((speed = 1), act('h:descend'), jump(1210)), cap: 'Hold 25 mm above the bath, then 1/3 of the blade every 10 min.'},
    {at: 16.3, run: () => (act('h:third'), jump(1810))},
    {at: 17.4, run: () => (act('h:third'), jump(610))},
    {at: 18.5, run: () => act('h:third')},
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
    trainer.i = 0;
    trainer.start = 0;
  };
  // skip plant time (the waits the procedure demands) without rushing the steps
  const jump = (sec) => step(s, sec);
  const setProc = (id) => {
    hmi.setProc(id);
    act('proc', id);
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
    setCap('You have control. Pick a procedure on the right, load its starting situation and follow the steps.');
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

    // plant, then the trainer: walk the current procedure and score it
    step(s, dt * speed);
    if (s.asw.rpm > 5 && s.asw.speed <= 20) s.inspect.twirl = true;
    {
      const proc = PROCS.find((p) => p.id === trainer.id);
      const g = signals(s);
      while (trainer.i < proc.steps.length && proc.steps[trainer.i][2](s, g)) trainer.i++;
      const ev = s.events.filter((e) => e.t >= trainer.start);
      trainer.score = Math.max(0, 100 - 12 * ev.filter((e) => e.kind === 'bad').length - 4 * ev.filter((e) => e.kind === 'warn').length);
    }

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
      hmi.refresh(s, trainer);
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
