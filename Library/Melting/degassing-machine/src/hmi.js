// The control panel of the degassing machine: the touch HMI rebuilt from the manual's screens (Home, Mode,
// Process, Setting, Drive RPM, Manual, Alarm, Admin, with the soft-key bar and F1–F8), the tower lamp, the jumbo
// temperature display, a melt-quality readout and the cabinet push buttons. Every value is read from the plant
// state; every button calls act(name, arg).
import {ALARMS, densityIndex, P, signals, STEP_TEXT} from './model.js';
import {getLang, t, translateTree} from './i18n.js';

export const CLOCK0 = new Date(2026, 10, 18, 7, 0, 0).getTime();
const pad = (n) => String(n).padStart(2, '0');
const dt = (tm) => new Date(CLOCK0 + tm * 1000);
const clock = (tm) => {
  const d = dt(tm);
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};
const hms = (tm) => {
  const d = dt(tm);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};
const mmss = (sec) => [pad(Math.floor(sec / 60)), pad(Math.floor(sec % 60))];

const KEYS = [
  ['home', 'Home'],
  ['mode', 'Mode'],
  ['process', 'Process'],
  ['setting', 'Setting'],
  ['drive', 'Drive RPM'],
  ['manual', 'Manual'],
  ['alarm', 'Alarm'],
  ['admin', 'Admin'],
];
const lamp = (k, label) => `<div class="pl"><span class="dot" data-c="${k}"></span><span>${label}</span></div>`;
const num = (k, unit = '') => `<span class="nb2" data-v="${k}">0</span>${unit ? `<i class="u">${unit}</i>` : ''}`;
const setf = (k, unit) => `<button class="nb2 ed" data-sp="${k}" data-v="set_${k}">0</button><i class="u">${unit}</i>`;

export function createHMI(host, act) {
  const root = document.createElement('div');
  root.className = 'dp';
  host.appendChild(root);
  root.innerHTML = `
  <div class="top">
    <div class="jumbo"><b data-v="jumbo">745</b><i>°C</i><span>JUMBO DISPLAY · METAL TEMPERATURE</span></div>
    <div class="tower" title="Tower lamp"><span class="tl r" data-c="tlR"></span><span class="tl y" data-c="tlY"></span><span class="tl g" data-c="tlG"></span><em>TOWER LAMP</em></div>
    <div class="melt"><h5>MELT QUALITY (simulated)</h5>
      <div class="mq"><span>Hydrogen</span><b data-v="h">0</b><i>ml/100 g</i></div>
      <div class="mq"><span>Density index</span><b data-v="di">0</b><i>%</i></div>
      <div class="mq"><span>Flux added</span><b data-v="fluxUsed">0</b><i>g</i></div></div>
  </div>
  <div class="bezel"><div class="touch">TOUCH</div>
    <div class="scr">
      <div class="sh"><span class="stitle" data-v="stitle"></span><span class="sclock" data-v="clock"></span></div>
      <div class="sbody"></div>
      <div class="keys">${KEYS.map(([k, l]) => `<button class="sk" data-nav="${k}">${l}</button>`).join('')}</div>
    </div>
    <div class="fkeys">${KEYS.map(([k], i) => `<button class="fk" data-nav="${k}">F${i + 1}</button>`).join('')}</div>
  </div>
  <div class="cab">
    <div class="pb"><button class="btn g" data-a="controlOn"><span></span></button><em>CONTROL ON</em><i class="ind" data-c="indCtl"></i></div>
    <div class="pb"><button class="btn g" data-a="cycleStart"><span></span></button><em>CYCLE START</em><i class="ind" data-c="indRun"></i></div>
    <div class="pb"><button class="btn r" data-a="cycleStop"><span></span></button><em>CYCLE STOP</em></div>
    <div class="pb"><button class="btn b" data-a="reset"><span></span></button><em>RESET</em><i class="ind" data-c="indRst"></i></div>
    <div class="pb es"><button class="mush" data-a="estop" data-c="mush"><span></span></button><em>EMERGENCY STOP</em></div>
    <div class="ops"><button class="op" data-a="newLadle">NEW LADLE</button><button class="op" data-a="refillFlux">REFILL FLUX</button><div class="msg" data-v="msg"></div></div>
  </div>
  <div class="pad" hidden><div class="pd"><div class="pt" data-v="padTitle"></div><div class="pn" data-v="padNote"></div>
    <input class="pi" type="password" inputmode="decimal"><div class="pk">${[7, 8, 9, 4, 5, 6, 1, 2, 3, '-', 0, '.'].map((k) => `<button data-k="${k}">${k}</button>`).join('')}</div>
    <div class="pr"><button data-k="del">⌫</button><button data-k="esc">CANCEL</button><button data-k="ok" class="ok">ENTER</button></div></div></div>`;
  const body = root.querySelector('.sbody');
  let screen = 'home';
  let nodes = {v: [], c: []};
  let fixed = {v: [...root.querySelectorAll('.top [data-v], .sh [data-v], .cab [data-v]')], c: [...root.querySelectorAll('.top [data-c], .cab [data-c]')]};
  let last = null;
  let unlocked = false;

  const TITLES = {home: 'DEGASSING MACHINE', mode: 'Mode', process: 'Machine Process', setting: 'Setting', drive: 'Drive RPM', manual: 'Manual Mode', alarm: 'Alarm', admin: 'Admin'};
  const screens = {
    home: () => `<div class="home"><div class="hbox">DEGASSING MACHINE</div><div class="hname">NUTEC - THERMO FURNACES AND<br>EQUIPMENTS PVT. LTD.</div>
      <div class="hmeta">Machine no. 136 / 137 / 138 / 139 / 140 / 141 · Synergies Casting LLC, Sohar</div>
      <div class="hstate" data-c="hstate"><span data-v="stepText"></span></div></div>`,
    mode: () => `<div class="mode"><div class="ml"><button class="gb">Increase Brightness</button><button class="gb">Decrease Brightness</button><button class="gb" data-a="lampTest">Lamp Test</button><button class="gb" data-a="buzzerTest">Buzzer Test</button></div>
      <div class="mc"><button class="mb" data-a="modeAuto" data-c="mAuto">Auto</button><button class="mb" data-a="modeManual" data-c="mMan">Manual</button>
        <p class="mnote">Auto mode for regular production (tower lamp green). Manual mode for initial setting (tower lamp yellow).</p></div>
      <div class="mr"><button class="gb" disabled>Activate CleanScreen</button><button class="gb" disabled>Calibrate Touch Screen</button><button class="gb" disabled>Exit Runtime</button></div></div>`,
    process: () => `<div class="proc"><div class="pc">
      ${lamp('pAutoHealthy', 'Auto Mode Healthy')}${lamp('pCycle', 'Auto Cycle Start')}${lamp('pHyd', 'Hydraulic ON')}${lamp('pDown', 'Rotor Down')}
      ${lamp('pS1', 'Rotor Speed_1')}${lamp('pLow', 'Gas - Low Flow')}
      <div class="pl"><span class="dot" data-c="pVortex"></span><span>Vortex Formation Time</span>${num('tVortexM')}<i class="u">Min</i>${num('tVortexS')}<i class="u">Sec</i></div>
      ${lamp('pS2', 'Rotor Speed_2')}</div><div class="pc">
      <div class="pl"><span class="dot" data-c="pFlux"></span><span>Vane Feeder on (Flux)</span>${num('tFluxM')}<i class="u">Min</i>${num('tFluxS')}<i class="u">Sec</i></div>
      <div class="pl"><span class="dot" data-c="pMix"></span><span>Mixing_ON</span>${num('tMixM')}<i class="u">Min</i>${num('tMixS')}<i class="u">Sec</i></div>
      ${lamp('pHigh', 'Gas - High Flow')}${lamp('pBafDown', 'Baffle Down')}${lamp('pS3', 'Rotor Speed_3')}
      <div class="pl"><span class="dot" data-c="pDegas"></span><span>Degassing</span>${num('tDegM')}<i class="u">Min</i>${num('tDegS')}<i class="u">Sec</i></div>
      ${lamp('pBafUp', 'Baffle Up')}${lamp('pHyd2', 'Hydraulic ON')}${lamp('pUp', 'Rotor Up')}</div>
      <div class="pstep" data-c="pstep"><span data-v="stepText"></span><span class="ptimer">Process time ${num('timer')}</span></div></div>`,
    setting: () => `<div class="set"><div class="sc"><h6>TIMER SETTING</h6>
      <div class="sr"><span>Rotor Down Delay</span>${setf('downDelay', 'sec')}</div>
      <div class="sr"><span>VORTEX FORMATION</span>${setf('vortex', 'Min')}</div>
      <div class="sr"><span>FLUXING</span>${setf('fluxing', 'Min')}</div>
      <div class="sr"><span>MIXING</span>${setf('mixing', 'Min')}</div>
      <div class="sr"><span>DEGASSING</span>${setf('degassing', 'Min')}</div>
      <div class="sr"><span>Rotor Up Delay</span>${setf('upDelay', 'sec')}</div></div>
      <div class="sc"><h6>PRESSURE / FLOW SETTING</h6>
      <div class="sg"><span></span><b>MINIMUM</b><b>MAXIMUM</b></div>
      <div class="sg"><span>GAS PRESSURE</span><span class="cl">${setf('pMin', '')}</span><span class="cl">${setf('pMax', 'Bar')}</span></div>
      <div class="sg"><span>GAS FLOW · LOW</span><span class="cl">${setf('lowMin', '')}</span><span class="cl">${setf('lowMax', 'L/min')}</span></div>
      <div class="sg"><span>GAS FLOW · HIGH</span><span class="cl">${setf('highMin', '')}</span><span class="cl">${setf('highMax', 'L/min')}</span></div>
      <div class="spd"><div class="pl"><span class="dot" data-c="driveReady"></span><span>Drive Ready</span></div>
        <div><em>Speed 1</em>${setf('speed1', 'RPM')}</div><div><em>Speed 2</em>${setf('speed2', 'RPM')}</div><div><em>Speed 3</em>${setf('speed3', 'RPM')}</div></div>
      <p class="lock" data-v="lockText"></p></div></div>`,
    drive: () => `<div class="drv"><svg class="gauge" viewBox="0 0 240 150"><path d="M20 130 A100 100 0 0 1 220 130" class="ga"/><path data-c="gArc" class="gv" d="M20 130 A100 100 0 0 1 220 130" pathLength="100"/>
        ${[0, 100, 200, 300, 400, 500, 600, 700].map((v) => {
          const a = Math.PI - (v / 700) * Math.PI;
          return `<text x="${120 + Math.cos(a) * 82}" y="${132 - Math.sin(a) * 82}" class="gt">${v}</text>`;
        }).join('')}
        <text x="120" y="118" class="gn" data-v="rpm">0</text><text x="120" y="140" class="gu">RPM</text></svg>
      <div class="dc"><div class="pl"><span class="dot" data-c="driveReady"></span><span>Drive Ready</span></div>
        <div class="pl"><span class="dot" data-c="dS1"></span><span>Speed 1</span>${num('set_speed1', 'RPM')}</div>
        <div class="pl"><span class="dot" data-c="dS2"></span><span>Speed 2</span>${num('set_speed2', 'RPM')}</div>
        <div class="pl"><span class="dot" data-c="dS3"></span><span>Speed 3</span>${num('set_speed3', 'RPM')}</div>
        <div class="sr"><span>Gas flow · LOW used</span>${setf('low', 'L/min')}</div>
        <div class="sr"><span>Gas flow · HIGH used</span>${setf('high', 'L/min')}</div>
        <div class="sr"><span>Flux feed rate</span>${setf('fluxRate', 'g/min')}</div>
        <div class="sr"><span>Gas flow now</span>${num('flow', 'L/min')}</div></div></div>`,
    manual: () => `<div class="man"><p class="mnote" data-v="manNote"></p><div class="mg">
      ${[
        ['Hydraulic', 'hydOn', 'ON', 'hydOff', 'OFF', 'mHyd'],
        ['Rotor', 'rotorUp', 'UP', 'rotorDown', 'DOWN', 'mRot'],
        ['Baffle', 'baffleUp', 'UP', 'baffleDown', 'DOWN', 'mBaf'],
        ['Feeder', 'feederOn', 'ON', 'feederOff', 'OFF', 'mFeed'],
        ['Drive', 'driveOn', 'ON', 'driveOff', 'OFF', 'mDrive'],
      ]
        .map(([n, a1, l1, a2, l2, c]) => `<div class="mrow"><span class="dot" data-c="${c}"></span><b>${n}</b><button class="mbtn" data-a="m:${a1}">${l1}</button><button class="mbtn" data-a="m:${a2}">${l2}</button></div>`)
        .join('')}
      <div class="mrow"><span class="dot" data-c="mGas"></span><b>Gas flow</b><button class="mbtn" data-a="m:gasLow">LOW</button><button class="mbtn" data-a="m:gasHigh">HIGH</button><button class="mbtn" data-a="m:gasOff">OFF</button></div>
      <div class="mrow"><span class="dot" data-c="mSpd"></span><b>Speed</b><button class="mbtn" data-a="m:speed1">1</button><button class="mbtn" data-a="m:speed2">2</button><button class="mbtn" data-a="m:speed3">3</button></div>
      </div></div>`,
    alarm: () => `<div class="alm"><table><thead><tr><th>No.</th><th>Time</th><th>Date</th><th>Text</th></tr></thead><tbody data-v="altable"></tbody></table>
      <button class="clr" data-a="clearAlarms">Clear</button></div>`,
    admin: () => `<div class="adm">${adminSVG()}
      <div class="atim"><div class="ar"><span>Vortex Formation Time</span>${num('aVs')}<i class="u">Min</i>${num('aVa')}<i class="u">Sec</i></div>
      <div class="ar"><span>Vane Feeder on (Flux)</span>${num('aFs')}<i class="u">Min</i>${num('aFa')}<i class="u">Sec</i></div>
      <div class="ar"><span>Mixing_ON</span>${num('aMs')}<i class="u">Min</i>${num('aMa')}<i class="u">Sec</i></div>
      <div class="ar"><span>Degassing</span>${num('aDs')}<i class="u">Min</i>${num('aDa')}<i class="u">Sec</i></div></div></div>`,
  };

  function adminSVG() {
    const L = (x, y, k, txt, lx, ly, anchor = 'end') => `<line x1="${lx}" y1="${ly}" x2="${x}" y2="${y}" class="lead"/><circle cx="${x}" cy="${y}" r="6" class="alamp" data-c="${k}"/><text x="${lx + (anchor === 'end' ? -4 : 4)}" y="${ly + 4}" class="atx" text-anchor="${anchor}">${txt}</text>`;
    return `<svg class="asvg" viewBox="0 0 600 300" width="600" height="300">
      <rect x="150" y="270" width="250" height="14" class="am"/><rect x="190" y="40" width="34" height="232" class="am"/>
      <g data-c="aHead" class="ahead"><rect x="170" y="70" width="210" height="34" class="ar2"/><rect x="330" y="46" width="34" height="26" class="amo"/>
        <rect x="343" y="104" width="8" height="110" class="agr"/><rect x="333" y="210" width="28" height="10" class="agr"/>
        <rect x="290" y="104" width="6" height="80" class="agr"/><polygon points="236,56 270,56 262,70 244,70" class="amo"/></g>
      <rect x="300" y="200" width="100" height="72" class="alad"/><rect x="304" y="214" width="92" height="54" class="amet"/>
      <rect x="430" y="150" width="60" height="122" class="acab"/><rect x="510" y="140" width="22" height="132" rx="8" class="acyl"/>
      ${L(318, 56, 'aBafMotor', 'Baffle Motor ON', 120, 18)}
      ${L(253, 62, 'aFluxLvl', 'Flux Level Sensor', 430, 18, 'start')}
      ${L(296, 110, 'aBafUp', 'Baffle Up Sensor', 120, 50)}
      ${L(296, 182, 'aBafDown', 'Baffle Down Limit switch', 120, 82)}
      ${L(364, 58, 'aRotMotor', 'Rotor Motor ON', 430, 50, 'start')}
      ${L(250, 98, 'aFeedMotor', 'Vane feeder motor ON', 430, 82, 'start')}
      ${L(207, 74, 'aTop', 'Top - Limit switch', 120, 114)}
      ${L(207, 150, 'aMid', 'Middle - Sensor', 120, 146)}
      ${L(207, 236, 'aBot', 'Bottom - Limit switch', 120, 178)}
      ${L(520, 150, 'aPress', 'Pressure Switch', 560, 118, 'start')}
      ${L(240, 262, 'aHydOn', 'Hydraulic ON', 120, 246)}
      ${L(226, 230, 'aRotUp', 'Rotor Up', 120, 214)}
      ${L(226, 248, 'aRotDown', 'Rotor Down', 120, 278)}
      <foreignObject x="440" y="104" width="120" height="24"><div class="fo">${num('flow', 'Ltr/Min')}</div></foreignObject>
      <foreignObject x="452" y="124" width="110" height="24"><div class="fo">${num('press', 'Bar')}</div></foreignObject>
      <foreignObject x="10" y="190" width="100" height="24"><div class="fo">${num('rpm', 'RPM')}</div></foreignObject>
    </svg>`;
  }

  function show(name) {
    screen = name;
    body.innerHTML = screens[name]();
    body.className = 'sbody s-' + name;
    translateTree(body);
    nodes = {v: [...body.querySelectorAll('[data-v]')], c: [...body.querySelectorAll('[data-c]')]};
    for (const b of root.querySelectorAll('.sk')) b.classList.toggle('on', b.dataset.nav === name);
    last = null;
  }

  root.addEventListener('click', (e) => {
    const n = e.target.closest('[data-nav]');
    if (n) return act('screen', n.dataset.nav);
    const a = e.target.closest('button[data-a]');
    if (a) return act(a.dataset.a);
    const sp = e.target.closest('[data-sp]');
    if (sp) return openPad(sp.dataset.sp);
  });

  // ------------------------------------------------------------ password and set point keypad
  const pad_ = root.querySelector('.pad');
  const pin = pad_.querySelector('.pi');
  let padKey = null;
  const NAMES = {downDelay: 'Rotor Down Delay (sec)', vortex: 'Vortex formation (Min)', fluxing: 'Fluxing (Min)', mixing: 'Mixing (Min)', degassing: 'Degassing (Min)', upDelay: 'Rotor Up Delay (sec)', pMin: 'Minimum gas pressure (Bar)', pMax: 'Maximum gas pressure (Bar)', lowMin: 'Low gas flow minimum (L/min)', lowMax: 'Low gas flow maximum (L/min)', highMin: 'High gas flow minimum (L/min)', highMax: 'High gas flow maximum (L/min)', speed1: 'Speed 1 (max 200 rpm)', speed2: 'Speed 2 (max 650 rpm)', speed3: 'Speed 3 (max 450 rpm)', low: 'Low gas flow used (L/min)', high: 'High gas flow used (L/min)', fluxRate: 'Flux feed rate (g/min)'};
  function openPad(k) {
    padKey = k;
    pad_.hidden = false;
    pin.value = '';
    pin.type = unlocked ? 'text' : 'password';
    pad_.querySelector('[data-v=padTitle]').textContent = unlocked ? t(NAMES[k]) : t('Enter the password');
    pad_.querySelector('[data-v=padNote]').textContent = t(unlocked ? 'Set values as instructed by NUTEC-THERMO technicians.' : 'Settings are protected. Password: 12345 (from the manual).');
  }
  pad_.addEventListener('click', (e) => {
    const k = e.target.dataset.k;
    if (k === undefined) return;
    if (k === 'esc') pad_.hidden = true;
    else if (k === 'del') pin.value = pin.value.slice(0, -1);
    else if (k === 'ok') {
      if (!unlocked) {
        if (pin.value === '12345') {
          unlocked = true;
          openPad(padKey);
        } else {
          pin.value = '';
          pad_.querySelector('[data-v=padNote]').textContent = t('Wrong password');
        }
        return;
      }
      const v = parseFloat(pin.value);
      if (Number.isFinite(v)) act('setSP', [padKey, v]);
      pad_.hidden = true;
    } else pin.value += k;
  });

  // ------------------------------------------------------------ refresh
  function values(s) {
    const g = signals(s);
    const V = {};
    const C = {};
    const on = (b) => (b ? 'on' : '');
    const st = s.step;
    const after = (list) => list.includes(st);
    V.clock = clock(s.t);
    V.stitle = TITLES[screen];
    V.jumbo = String(Math.round(s.metalT));
    V.h = s.h.toFixed(3);
    V.di = densityIndex(s.h).toFixed(1);
    V.fluxUsed = Math.round(s.fluxUsed).toString();
    V.stepText = s.mode === 'MANUAL' && st === 'IDLE' ? 'MANUAL MODE' : STEP_TEXT[st];
    V.timer = `${mmss(s.timer).join(':')}`;
    V.rpm = String(Math.round(s.rpm));
    V.flow = String(Math.round(s.flow));
    V.press = s.linePress.toFixed(2);
    for (const k of Object.keys(s.set)) V['set_' + k] = String(s.set[k]);
    const tm = (sec) => mmss(sec);
    [V.tVortexM, V.tVortexS] = tm(s.done.vortex);
    [V.tFluxM, V.tFluxS] = tm(s.done.flux);
    [V.tMixM, V.tMixS] = tm(s.done.mix);
    [V.tDegM, V.tDegS] = tm(s.done.degas);
    V.aVs = pad(s.set.vortex);
    V.aFs = pad(s.set.fluxing);
    V.aMs = pad(s.set.mixing);
    V.aDs = pad(s.set.degassing);
    V.aVa = String(Math.floor(s.done.vortex)).padStart(4, '0');
    V.aFa = String(Math.floor(s.done.flux)).padStart(4, '0');
    V.aMa = String(Math.floor(s.done.mix)).padStart(4, '0');
    V.aDa = String(Math.floor(s.done.degas)).padStart(4, '0');
    V.lockText = unlocked ? 'Settings unlocked.' : 'Tap a value to change it (password protected).';
    V.manNote = s.mode === 'MANUAL' ? 'Manual mode: each function runs while you command it. Interlocks still apply.' : 'Select MANUAL on the Mode screen to use these functions.';
    V.msg = s.log.length && s.t - s.log[0].t < 30 ? '⚠ ' + t(s.log[0].text) : '';
    const alarm = s.alarms.some((a) => a.active);
    const blink = Math.floor(s.t * 2) % 2 === 0;
    Object.assign(C, {
      tlR: 'tl r ' + (alarm && blink ? 'on' : ''),
      tlY: 'tl y ' + on(s.mode === 'MANUAL'),
      tlG: 'tl g ' + on(s.mode === 'AUTO' && !alarm),
      indCtl: 'ind ' + on(s.control),
      indRun: 'ind ' + on(s.mode === 'AUTO' && !['IDLE', 'HOME', 'DONE', 'STOPPED'].includes(st)),
      indRst: 'ind ' + on(s.resetNeeded && blink),
      mush: 'mush ' + on(s.estop),
      hstate: 'hstate ' + (st === 'ABORT' || st === 'STOPPED' ? 'bad' : st === 'DONE' ? 'ok' : ''),
      pstep: 'pstep ' + (st === 'ABORT' || st === 'STOPPED' ? 'bad' : ''),
      mAuto: 'mb ' + on(s.mode === 'AUTO'),
      mMan: 'mb ' + on(s.mode === 'MANUAL'),
      pAutoHealthy: 'dot ' + on(s.mode === 'AUTO' && g.healthy),
      pCycle: 'dot ' + on(s.mode === 'AUTO' && !['IDLE', 'HOME', 'DONE', 'STOPPED'].includes(st)),
      pHyd: 'dot ' + on(s.hyd && s.headCmd > 0),
      pDown: 'dot ' + on(s.headCmd > 0),
      pS1: 'dot ' + on(s.drive && s.speedSel === 1),
      pLow: 'dot ' + on(s.gas === 'LOW'),
      pVortex: 'dot ' + on(st === 'VORTEX'),
      pS2: 'dot ' + on(s.drive && s.speedSel === 2),
      pFlux: 'dot ' + on(s.feeder),
      pMix: 'dot ' + on(st === 'MIX'),
      pHigh: 'dot ' + on(s.gas === 'HIGH'),
      pBafDown: 'dot ' + on(s.baffleCmd > 0 || (g.baffleDown && after(['DEGAS']))),
      pS3: 'dot ' + on(s.drive && s.speedSel === 3),
      pDegas: 'dot ' + on(st === 'DEGAS'),
      pBafUp: 'dot ' + on(s.baffleCmd < 0),
      pHyd2: 'dot ' + on(s.hyd && s.headCmd < 0),
      pUp: 'dot ' + on(s.headCmd < 0),
      driveReady: 'dot ' + on(g.rotorOK && !s.estop && s.control),
      dS1: 'dot ' + on(s.drive && s.speedSel === 1),
      dS2: 'dot ' + on(s.drive && s.speedSel === 2),
      dS3: 'dot ' + on(s.drive && s.speedSel === 3),
      mHyd: 'dot ' + on(s.hyd),
      mRot: 'dot ' + on(s.headCmd !== 0),
      mBaf: 'dot ' + on(s.baffleCmd !== 0),
      mFeed: 'dot ' + on(s.feeder),
      mDrive: 'dot ' + on(s.drive),
      mGas: 'dot ' + on(s.gas !== 'OFF'),
      mSpd: 'dot ' + on(s.drive),
      aBafMotor: 'alamp ' + on(s.baffleCmd !== 0),
      aFluxLvl: 'alamp ' + (g.fluxOK ? 'on' : 'bad'),
      aBafUp: 'alamp ' + on(g.baffleUp),
      aBafDown: 'alamp ' + on(g.baffleDown),
      aRotMotor: 'alamp ' + (!g.rotorOK ? 'bad' : on(s.rpm > 5)),
      aFeedMotor: 'alamp ' + (!g.feederOK ? 'bad' : on(s.feeder)),
      aTop: 'alamp ' + on(g.upperLS),
      aMid: 'alamp ' + (s.fault === 'middle' ? 'bad' : on(Math.abs(s.head - P.middleAt) < 0.03)),
      aBot: 'alamp ' + on(g.lowerLS),
      aPress: 'alamp ' + (g.pressOK ? 'on' : 'bad'),
      aHydOn: 'alamp ' + (!g.hydOK ? 'bad' : on(s.hyd)),
      aRotUp: 'alamp ' + on(s.headCmd < 0),
      aRotDown: 'alamp ' + on(s.headCmd > 0),
    });
    // the drive gauge arc
    C.gArc = 'gv';
    return {V, C};
  }
  function apply(list, V, C) {
    for (const n of list.v) {
      const k = n.dataset.v;
      if (!(k in V)) continue;
      const v = t(V[k]);
      if (n.textContent !== v) n.textContent = v;
    }
    for (const n of list.c) {
      const k = n.dataset.c;
      if (k in C && n.getAttribute('class') !== C[k]) n.setAttribute('class', C[k]);
    }
  }
  function refresh(s) {
    const {V, C} = values(s);
    apply(fixed, V, C);
    apply(nodes, V, C);
    if (screen === 'drive') {
      const arc = body.querySelector('.gv');
      if (arc) arc.style.strokeDasharray = `${(s.rpm / 700) * 100} 100`;
    }
    if (screen === 'alarm') {
      const key = getLang() + s.alarms.map((a) => a.no + (a.active ? 'A' : '') + a.t.toFixed(0)).join();
      if (key !== last) {
        last = key;
        const d = (tm) => {
          const x = dt(tm);
          return `${x.getMonth() + 1}/${x.getDate()}/${x.getFullYear()}`;
        };
        body.querySelector('[data-v=altable]').innerHTML = s.alarms.length
          ? s.alarms.map((a) => `<tr class="${a.active ? 'act' : ''}"><td>${a.no}</td><td>${hms(a.t)}</td><td>${d(a.t)}</td><td>${t(ALARMS[a.no])}</td></tr>`).join('')
          : `<tr><td colspan="4" class="none">${t('No alarms logged')}</td></tr>`;
      }
    }
  }

  translateTree(root);
  return {
    root,
    show,
    refresh,
    relang() {
      translateTree(root);
      show(screen);
    },
    get screen() {
      return screen;
    },
    find(sel) {
      return root.querySelector(sel);
    },
    closePad() {
      pad_.hidden = true;
    },
    unlock() {
      unlocked = true;
    },
  };
}
