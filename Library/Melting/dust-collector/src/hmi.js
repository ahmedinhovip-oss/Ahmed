// The control panel of the fume extraction / bag filter. The drawing gives no panel, so this is a typical pulse-jet
// baghouse panel [A]: a stack dust monitor, tower lamp and filter ΔP on top; the touch HMI (Overview, Filter, Fan,
// Hoppers, Settings, Alarm, Trends) with soft keys and F1–F7; the cabinet push buttons. Values from the plant state,
// buttons through act(name, arg).
import {ALARMS, P, signals, TREND_N} from './model.js';
import {getLang, t, translateTree} from './i18n.js';

export const CLOCK0 = new Date(2026, 10, 18, 7, 0, 0).getTime();
const pad = (n) => String(n).padStart(2, '0');
const dt = (tm) => new Date(CLOCK0 + tm * 1000);
const clock = (tm) => {
  const d = dt(tm);
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};
const hms = (tm) => {
  const d = dt(tm);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};
const KEYS = [
  ['over', 'Overview'],
  ['filter', 'Filter'],
  ['fan', 'Fan'],
  ['hop', 'Hoppers'],
  ['set', 'Settings'],
  ['alarm', 'Alarm'],
  ['trend', 'Trends'],
];
const lamp = (k, label) => `<div class="pl"><span class="dot" data-c="${k}"></span><span>${label}</span></div>`;
const num = (k, unit = '') => `<span class="nb2" data-v="${k}">0</span>${unit ? `<i class="u">${unit}</i>` : ''}`;
const setf = (k, unit) => `<button class="nb2 ed" data-sp="${k}" data-v="set_${k}">0</button><i class="u">${unit}</i>`;
const btn = (a, l, cls = 'mbtn') => `<button class="${cls}" data-a="${a}">${l}</button>`;

export function createHMI(host, act) {
  const root = document.createElement('div');
  root.className = 'dp dcp';
  host.appendChild(root);
  root.innerHTML = `
  <div class="top">
    <div class="jumbo em"><b data-v="emit">0</b><i>mg/Nm³</i><span>STACK DUST MONITOR · LIMIT ${P.emitLimit}</span></div>
    <div class="tower" title="Tower lamp"><span class="tl r" data-c="tlR"></span><span class="tl y" data-c="tlY"></span><span class="tl g" data-c="tlG"></span><em>TOWER LAMP</em></div>
    <div class="melt"><h5>FILTER</h5>
      <div class="mq"><span>Differential pressure</span><b data-v="dpMM">0</b><i>mmWC</i></div>
      <div class="mq"><span>Inlet temperature</span><b data-v="tIn">0</b><i>°C</i></div>
      <div class="mq"><span>Flow at the fan</span><b data-v="q">0</b><i>m³/h</i></div></div>
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
    <div class="pb"><button class="btn g" data-a="start"><span></span></button><em>SYSTEM START</em><i class="ind" data-c="indRun"></i></div>
    <div class="pb"><button class="btn r" data-a="stop"><span></span></button><em>SYSTEM STOP</em></div>
    <div class="pb"><button class="btn y" data-a="ack"><span></span></button><em>ALARM ACK</em><i class="ind" data-c="indAck"></i></div>
    <div class="pb"><button class="btn b" data-a="reset"><span></span></button><em>RESET</em><i class="ind" data-c="indRst"></i></div>
    <div class="pb es"><button class="mush" data-a="estop" data-c="mush"><span></span></button><em>EMERGENCY STOP</em></div>
    <div class="ops"><button class="op" data-a="empty">EMPTY DUST BINS</button><div class="msg" data-v="msg"></div></div>
  </div>
  <div class="pad" hidden><div class="pd"><div class="pt" data-v="padTitle"></div><div class="pn" data-v="padNote"></div>
    <input class="pi" inputmode="decimal"><div class="pk">${[7, 8, 9, 4, 5, 6, 1, 2, 3, '-', 0, '.'].map((k) => `<button data-k="${k}">${k}</button>`).join('')}</div>
    <div class="pr"><button data-k="del">⌫</button><button data-k="esc">CANCEL</button><button data-k="ok" class="ok">ENTER</button></div></div></div>`;
  const body = root.querySelector('.sbody');
  let screen = 'over';
  let hist = false;
  let nodes = {v: [], c: []};
  const fixed = {v: [...root.querySelectorAll('.top [data-v], .sh [data-v], .cab [data-v]')], c: [...root.querySelectorAll('.top [data-c], .cab [data-c]')]};
  let last = null;
  const TITLES = {over: 'Fume extraction · Overview', filter: 'Bag filter · Pulse-jet cleaning', fan: 'ID fan · VFD', hop: 'Hoppers · Rotary airlocks', set: 'Settings', alarm: 'Alarm', trend: 'Trends'};

  const overSVG = () => `<svg class="osvg" viewBox="0 0 640 330" width="596" height="307">
    <defs><marker id="arr" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10z" fill="#5a6672"/></marker></defs>
    <rect x="530" y="150" width="90" height="120" class="o-idex"/><text x="575" y="215" class="o-t">IDEX</text>
    <rect x="560" y="40" width="14" height="110" class="o-duct"/><path d="M548 40 L567 22 L586 40z" class="o-dark"/><text x="545" y="30" class="o-s" text-anchor="end">CANOPY · NATURAL DRAFT</text>
    <rect x="566" y="86" width="20" height="5" data-c="oStackDamper" class="o-damp"/>
    <path data-c="oFlowIn" class="o-flow" d="M567 150 L567 120 L330 120 L330 210 L300 210"/>
    <rect x="200" y="140" width="100" height="120" class="o-filter"/><line x1="250" y1="140" x2="250" y2="260" class="o-div"/>
    <text x="250" y="132" class="o-t">BAG FILTER</text>
    ${[0, 1].map((c) => `<rect x="${205 + c * 50}" y="150" width="40" height="70" data-c="oComp${c}" class="o-comp"/><path d="M${205 + c * 50} 230 L${245 + c * 50} 230 L${232 + c * 50} 252 L${218 + c * 50} 252z" class="o-hop"/>`).join('')}
    <path data-c="oFlowOut" class="o-flow" d="M200 160 L170 160 L170 250 L130 250"/>
    <circle cx="110" cy="250" r="20" data-c="oFan" class="o-fan"/><text x="110" y="286" class="o-s">ID FAN</text>
    <path data-c="oFlowStack" class="o-flow" d="M100 232 L100 200 L46 120"/>
    <rect x="30" y="20" width="22" height="250" class="o-chim"/><text x="41" y="290" class="o-s">CHIMNEY 18 m</text>
    <rect x="336" y="170" width="18" height="12" data-c="oDil" class="o-damp"/><text x="345" y="198" class="o-s">DILUTION</text>
    <foreignObject x="380" y="96" width="150" height="24"><div class="fo">${num('tInO', '°C')}${num('vDuct', 'm/s')}</div></foreignObject>
    <foreignObject x="196" y="264" width="120" height="24"><div class="fo">ΔP ${num('dpO', 'Pa')}</div></foreignObject>
    <foreignObject x="70" y="296" width="150" height="24"><div class="fo">${num('hzO', 'Hz')}${num('ampO', 'A')}</div></foreignObject>
    <foreignObject x="0" y="0" width="150" height="20"><div class="fo">${num('emitO', 'mg/Nm³')}</div></foreignObject>
    <foreignObject x="460" y="276" width="180" height="24"><div class="fo">Hood ${num('hoodO', 'Pa')}</div></foreignObject>
  </svg>`;

  const screens = {
    over: () => `<div class="over">${overSVG()}<div class="ostate" data-c="ostate"><span data-v="state"></span></div></div>`,
    filter: () => `<div class="flt2"><div class="fcol">
        <div class="dpbar"><div data-v="dpBar"></div><i class="mk s" style="bottom:${(P.cleanStart / 2500) * 100}%"></i><i class="mk e" style="bottom:${(P.cleanStop / 2500) * 100}%"></i></div>
        <div class="dpv">${num('dpPa', 'Pa')}<br>${num('dpMM2', 'mmWC')}</div></div>
      <div class="fcol2">
        <div class="kv"><span>Cleaning mode</span><button class="mb2" data-a="cm:DEMAND" data-c="cmD">ON DEMAND</button><button class="mb2" data-a="cm:TIMER" data-c="cmT">TIMER</button><button class="mb2" data-a="cm:OFF" data-c="cmO">OFF</button></div>
        <div class="kv"><span>Cleaning</span><span class="tag2" data-c="cleanTag"><span data-v="cleanState"></span></span>${btn('cleanNow', 'CLEAN NOW')}</div>
        <div class="kv"><span>Compressed air header</span>${num('air', 'bar')}<span class="dot" data-c="airOK"></span></div>
        <div class="kv"><span>Pulses fired</span>${num('pulses')}</div>
        <h6>PULSE VALVES · ROW CAKE (g/m²)</h6>
        <div class="rows">${[0, 1].map((c) => `<div class="cmp"><b>COMPARTMENT ${c + 1}</b>${Array.from({length: P.rows}, (_, r) => `<div class="rw"><span class="dot" data-c="pv${c * P.rows + r}"></span><span class="rl">R${r + 1}</span><span class="cb2"><i data-v="cake${c * P.rows + r}"></i></span></div>`).join('')}</div>`).join('')}</div>
      </div></div>`,
    fan: () => `<div class="drv"><svg class="gauge" viewBox="0 0 240 150"><path d="M20 130 A100 100 0 0 1 220 130" class="ga"/><path class="gv" d="M20 130 A100 100 0 0 1 220 130" pathLength="100"/>
        ${[0, 10, 20, 30, 40, 50].map((v) => {
          const a = Math.PI - (v / 50) * Math.PI;
          return `<text x="${120 + Math.cos(a) * 82}" y="${132 - Math.sin(a) * 82}" class="gt">${v}</text>`;
        }).join('')}
        <text x="120" y="118" class="gn" data-v="hz">0</text><text x="120" y="140" class="gu">Hz</text></svg>
      <div class="dc"><div class="mstate2" data-c="fanState"><span data-v="fanText"></span></div>
        <div class="kv"><span>Mode</span><button class="mb2" data-a="fanAuto" data-c="fA">AUTO · FLOW</button><button class="mb2" data-a="fanMan" data-c="fM">MANUAL · Hz</button></div>
        <div class="kv"><span>Flow set point</span>${setf('flowSP', 'm³/h')}</div>
        <div class="kv"><span>Speed set point (manual)</span>${setf('hzSP', 'Hz')}</div>
        <div class="kv"><span>Flow</span>${num('q2', 'm³/h')}</div>
        <div class="kv"><span>Motor current</span>${num('amps', 'A')}</div>
        <div class="kv"><span>Shaft power</span>${num('kw', 'kW')}</div>
        <div class="kv"><span>Hood suction at IDEX</span>${num('hood', 'Pa')}</div>
        <div class="kv"><span>Dilution damper</span>${num('dil', '%')}${btn('dilAuto', 'AUTO')}</div>
        <div class="br2">${btn('fanStart', 'START')}${btn('fanStop', 'STOP')}</div></div></div>`,
    hop: () => `<div class="hop">${[0, 1]
      .map(
        (i) => `<div class="hb2"><h6>HOPPER ${i + 1}</h6><div class="lvl2"><div data-v="hopBar${i}"></div><i style="bottom:${P.hopperHigh * 100}%"></i></div>
        <div class="kv"><span>Dust</span>${num('hop' + i, 'kg')}</div><div class="kv">${lamp('hopHi' + i, 'Level high')}</div>
        <div class="kv"><span>Rotary airlock RV${i + 1}</span><span class="dot" data-c="rv${i}"></span></div><div class="br2">${btn('rv' + i + 'On', 'RUN')}${btn('rv' + i + 'Off', 'STOP')}</div></div>`,
      )
      .join('')}<div class="hnote">Dust load at the hood ${num('dustKgh', 'kg/h')} · airlock capacity ${P.airlockKgh} kg/h each</div></div>`,
    set: () => `<div class="set"><div class="sc"><h6>CLEANING</h6>
      <div class="sr"><span>Start cleaning at ΔP</span>${setf('cleanStart', 'Pa')}</div>
      <div class="sr"><span>Stop cleaning at ΔP</span>${setf('cleanStop', 'Pa')}</div>
      <div class="sr"><span>Pulse duration</span>${setf('pulseMs', 'ms')}</div>
      <div class="sr"><span>Interval between valves</span>${setf('pulseGap', 's')}</div>
      <div class="sr"><span>Minimum air pressure</span>${setf('airLow', 'bar')}</div></div>
      <div class="sc"><h6>PROTECTION</h6>
      <div class="sr"><span>Bag temperature limit</span>${setf('bagLimit', '°C')}</div>
      <div class="sr"><span>High-high temperature</span>${setf('bagHH', '°C')}</div>
      <div class="sr"><span>Stack emission limit</span>${setf('emitLimit', 'mg/Nm³')}</div>
      <div class="sr"><span>Hopper level high</span>${setf('hopperHigh', '× full')}</div>
      <p class="lock">Typical pulse-jet settings; adjust to the supplier's commissioning sheet.</p></div></div>`,
    alarm: () => `<div class="alm"><div class="ah"><b>${hist ? 'ALARM HISTORY' : 'ACTIVE ALARMS'}</b></div><table><thead><tr><th>No.</th><th>Time</th><th>Text</th><th>State</th></tr></thead><tbody data-v="altable"></tbody></table>
      <div class="ab2">${btn('ack', 'ACKNOWLEDGE', 'clr2')}${btn('history', hist ? 'ACTIVE' : 'HISTORY', 'clr2')}${btn('clearAlarms', 'CLEAR', 'clr2')}</div></div>`,
    trend: () => `<div class="tr2"><canvas width="1240" height="700"></canvas><div class="lg2"><span style="--c:#b9367a">ΔP Pa</span><span style="--c:#e07b00">Inlet °C ×10</span><span style="--c:#1f4fd6">Fan Hz ×30</span><span style="--c:#111">Dust mg/Nm³ ×50</span><em>last 60 min</em></div></div>`,
  };

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
    if (a) {
      if (a.dataset.a === 'history') {
        hist = !hist;
        return show('alarm');
      }
      return act(a.dataset.a);
    }
    const sp = e.target.closest('[data-sp]');
    if (sp) return openPad(sp.dataset.sp);
  });
  const pad_ = root.querySelector('.pad');
  const pin = pad_.querySelector('.pi');
  let padKey = null;
  const NAMES = {cleanStart: 'Start cleaning at ΔP (Pa)', cleanStop: 'Stop cleaning at ΔP (Pa)', pulseMs: 'Pulse duration (ms)', pulseGap: 'Interval between valves (s)', airLow: 'Minimum air pressure (bar)', bagLimit: 'Bag temperature limit (°C)', bagHH: 'High-high temperature (°C)', emitLimit: 'Stack emission limit (mg/Nm³)', hopperHigh: 'Hopper level high (× full)', flowSP: 'Flow set point (m³/h)', hzSP: 'Speed set point (Hz)'};
  function openPad(k) {
    padKey = k;
    pad_.hidden = false;
    pin.value = '';
    pad_.querySelector('[data-v=padTitle]').textContent = t(NAMES[k]);
    pad_.querySelector('[data-v=padNote]').textContent = t('Only authorised personnel may change settings.');
  }
  pad_.addEventListener('click', (e) => {
    const k = e.target.dataset.k;
    if (k === undefined) return;
    if (k === 'esc') pad_.hidden = true;
    else if (k === 'del') pin.value = pin.value.slice(0, -1);
    else if (k === 'ok') {
      const v = parseFloat(pin.value);
      if (Number.isFinite(v)) act('setSP', [padKey, v]);
      pad_.hidden = true;
    } else pin.value += k;
  });

  function values(s) {
    const g = signals(s);
    const V = {};
    const C = {};
    const on = (b) => (b ? 'on' : '');
    const alarm = s.alarms.some((a) => a.active);
    const unack = s.alarms.some((a) => !a.ack);
    const blink = Math.floor(s.t * 2) % 2 === 0;
    const running = g.running;
    Object.assign(V, {
      clock: clock(s.t),
      stitle: TITLES[screen],
      emit: s.emit.toFixed(1),
      emitO: s.emit.toFixed(1),
      dpMM: (s.dp / 9.81).toFixed(0),
      dpMM2: (s.dp / 9.81).toFixed(0),
      dpPa: s.dp.toFixed(0),
      dpO: s.dp.toFixed(0),
      tIn: s.tIn.toFixed(0),
      tInO: s.tIn.toFixed(0),
      q: Math.round(s.q).toLocaleString('en-US'),
      q2: Math.round(s.q).toLocaleString('en-US'),
      vDuct: g.ductV.toFixed(1),
      hz: s.fan.hz.toFixed(1),
      hzO: s.fan.hz.toFixed(1),
      amps: s.amps.toFixed(0),
      ampO: s.amps.toFixed(0),
      kw: s.kw.toFixed(1),
      hood: s.hood.toFixed(0),
      hoodO: s.hood.toFixed(0),
      dil: Math.round(s.dilution * 100).toString(),
      air: s.air.toFixed(1),
      pulses: String(s.clean.count),
      cleanState: !s.clean.active ? 'IDLE' : !g.airOK ? 'BLOCKED · AIR LOW' : 'CLEANING',
      fanText: s.fault === 'fanTrip' ? 'VFD FAULT · TRIPPED' : running ? 'RUNNING' : 'STOPPED',
      state: s.estop ? 'EMERGENCY STOP' : !s.sys ? 'STOPPED · FUME BY NATURAL DRAFT THROUGH THE ROOF' : !s.fan.run ? 'FAN STOPPED · NO EXTRACTION' : s.clean.active ? 'EXTRACTING · CLEANING BAGS' : 'EXTRACTING',
      dustKgh: g.dustKgh.toFixed(1),
      msg: s.log.length && s.t - s.log[0].t < 30 ? '⚠ ' + t(s.log[0].text) : '',
      set_cleanStart: String(P.cleanStart),
      set_cleanStop: String(P.cleanStop),
      set_pulseMs: String(P.pulseMs),
      set_pulseGap: String(P.pulseGap),
      set_airLow: String(P.airLow),
      set_bagLimit: String(P.bagLimit),
      set_bagHH: String(P.bagHH),
      set_emitLimit: String(P.emitLimit),
      set_hopperHigh: String(P.hopperHigh),
      set_flowSP: String(s.flowSP),
      set_hzSP: String(s.fan.sp),
    });
    s.hopper.forEach((h, i) => (V['hop' + i] = h.toFixed(0)));
    s.cake.forEach((w, i) => (V['cake' + i] = w.toFixed(0)));
    Object.assign(C, {
      tlR: 'tl r ' + (alarm && (blink || !unack) ? 'on' : ''),
      tlY: 'tl y ' + on(s.sys && s.clean.active),
      tlG: 'tl g ' + on(running && !alarm),
      indRun: 'ind ' + on(running),
      indAck: 'ind ' + on(unack && blink),
      indRst: 'ind ' + on(s.resetNeeded && blink),
      mush: 'mush ' + on(s.estop),
      ostate: 'ostate ' + (s.estop || (alarm && unack) ? 'bad' : running ? 'ok' : ''),
      oFlowIn: 'o-flow ' + (running ? 'dirty' : ''),
      oFlowOut: 'o-flow ' + (running ? 'clean' : ''),
      oFlowStack: 'o-flow ' + (running ? 'clean' : ''),
      oFan: 'o-fan ' + (s.fault === 'fanTrip' ? 'bad' : running ? 'on' : ''),
      oStackDamper: 'o-damp ' + (running ? 'shut' : 'open'),
      oDil: 'o-damp ' + (s.dilution > 0.05 ? 'open' : 'shut'),
      oComp0: 'o-comp ' + (s.clean.active && s.clean.lastRow < P.rows && s.t - s.clean.pulseT < 1 ? 'pulse' : ''),
      oComp1: 'o-comp ' + (s.clean.active && s.clean.lastRow >= P.rows && s.t - s.clean.pulseT < 1 ? 'pulse' : ''),
      cmD: 'mb2 ' + on(s.clean.mode === 'DEMAND'),
      cmT: 'mb2 ' + on(s.clean.mode === 'TIMER'),
      cmO: 'mb2 ' + on(s.clean.mode === 'OFF'),
      cleanTag: 'tag2 ' + (s.clean.active ? (g.airOK ? 'on' : 'bad') : ''),
      airOK: 'dot ' + (g.airOK ? 'on' : 'bad'),
      fanState: 'mstate2 ' + (s.fault === 'fanTrip' ? 'bad' : running ? 'run' : ''),
      fA: 'mb2 ' + on(s.fan.auto),
      fM: 'mb2 ' + on(!s.fan.auto),
    });
    for (let i = 0; i < s.cake.length; i++) C['pv' + i] = 'dot ' + (s.fault === 'valve' && i === 2 ? 'bad' : i === s.clean.lastRow && s.t - s.clean.pulseT < 0.6 ? 'on' : '');
    for (let i = 0; i < 2; i++) {
      C['rv' + i] = 'dot ' + (i === 0 && s.fault === 'airlockTrip' ? 'bad' : on(s.rv[i] && s.sys));
      C['hopHi' + i] = 'dot ' + (g.hopperPct[i] > P.hopperHigh ? 'bad' : '');
    }
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
    const sty = (k, prop, v) => {
      const n = body.querySelector(`[data-v="${k}"]`);
      if (n) n.style[prop] = v;
    };
    if (screen === 'filter') {
      sty('dpBar', 'height', `${Math.min(100, (s.dp / 2500) * 100)}%`);
      for (let i = 0; i < s.cake.length; i++) sty('cake' + i, 'width', `${Math.min(100, (s.cake[i] / 200) * 100)}%`);
    }
    if (screen === 'fan') {
      const arc = body.querySelector('.gv');
      if (arc) arc.style.strokeDasharray = `${(s.fan.hz / 50) * 100} 100`;
    }
    if (screen === 'hop') for (let i = 0; i < 2; i++) sty('hopBar' + i, 'height', `${(s.hopper[i] / P.hopperKg) * 100}%`);
    if (screen === 'alarm') {
      const list = hist ? s.history.slice(0, 40) : s.alarms;
      const key = getLang() + (hist ? 'h' : 'a') + list.map((a) => a.no + (a.active ? 'A' : '') + (a.ack ? 'K' : '') + a.t.toFixed(0)).join();
      if (key !== last) {
        last = key;
        body.querySelector('[data-v=altable]').innerHTML = list.length
          ? list
              .map((a) =>
                hist
                  ? `<tr class="${a.kind === 'APPEARED' ? 'act' : ''}"><td>${a.no}</td><td>${hms(a.t)}</td><td>${t(ALARMS[a.no])}</td><td>${t(a.kind)}</td></tr>`
                  : `<tr class="${a.active ? (a.ack ? 'ackd' : 'act') : ''}"><td>${a.no}</td><td>${hms(a.t)}</td><td>${t(ALARMS[a.no])}</td><td>${t(a.active ? 'ACTIVE' : 'CLEARED')}${a.ack ? ' · ' + t('ACK') : ''}</td></tr>`,
              )
              .join('')
          : `<tr><td colspan="4" class="none">${t('No alarms')}</td></tr>`;
      }
    }
    if (screen === 'trend') drawTrend(s);
  }
  function drawTrend(s) {
    const cv = body.querySelector('canvas');
    if (!cv) return;
    const c = cv.getContext('2d');
    const w = cv.width;
    const h = cv.height;
    c.fillStyle = '#fff';
    c.fillRect(0, 0, w, h);
    const L = 60;
    const R = w - 20;
    const T = 20;
    const B = h - 50;
    c.font = '20px Arial';
    c.strokeStyle = '#e1e3e6';
    c.fillStyle = '#555';
    c.lineWidth = 2;
    for (let v = 0; v <= 2500; v += 500) {
      const y = B - (v / 2500) * (B - T);
      c.beginPath();
      c.moveTo(L, y);
      c.lineTo(R, y);
      c.stroke();
      c.fillText(String(v), 6, y + 7);
    }
    for (let m = 0; m <= 60; m += 10) {
      const x = R - (m / 60) * (R - L);
      c.beginPath();
      c.moveTo(x, T);
      c.lineTo(x, B);
      c.stroke();
      c.fillText(m ? `-${m} ${t('min')}` : t('now'), x - 30, B + 32);
    }
    const tr = s.trend;
    const n = tr.n;
    const at = (arr, k) => arr[(tr.i - n + k + TREND_N) % TREND_N];
    const ser = [['dp', 1, '#b9367a'], ['tIn', 10, '#e07b00'], ['hz', 30, '#1f4fd6'], ['emit', 50, '#111']];
    for (const [k, sc, colr] of ser) {
      c.strokeStyle = colr;
      c.lineWidth = 3;
      c.beginPath();
      for (let i = 0; i < n; i++) {
        const x = R - ((n - 1 - i) / (TREND_N - 1)) * (R - L);
        const y = B - Math.min(1, (at(tr[k], i) * sc) / 2500) * (B - T);
        i ? c.lineTo(x, y) : c.moveTo(x, y);
      }
      c.stroke();
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
  };
}
