// The right side of the ingot casting machine simulator: the 5 HP VFD panel as drawn in the manual (main MCB, R/Y/B
// lamps, conveyor START/STOP with ON/TRIP lamps, emergency stop, water pump inlet WP-1 and outlet WP-2 with their
// lamps, the A/M selector of WP-1, the PT-100 water temperature and the speed potentiometer), the IR temperature panel
// (sensor 1 at the discharge, sensor 2 at the distributor), the furnace pour, the water and the discharge controls,
// the readouts, and the operating steps of the manual, ticked as they are done.
import {ALARMS, N, P, rates} from './model.js';
import {getLang, t, translateTree} from './i18n.js';

const STEPS = [
  ['hammers', 'Both hammers locked: they must not hit the empty moulds', 'hm:locked', 'LOCK'],
  ['lube', 'Chain lubricated before casting', 'lube', 'LUBRICATE'],
  ['oil', 'Gearbox oil level checked, filled if low', 'oil', 'CHECK OIL'],
  ['clean', 'Moulds cleaned with a wire brush (dirt, burr)', 'clean', 'WIRE BRUSH'],
  ['dist', 'Distributor preheated with the torch burners 1 h, 100–150 °C', 'torch:dist', 'TORCH'],
  ['mould', 'Moulds preheated to the die-coat temperature (about 150 °C)', 'torch:mould', 'TORCH'],
  ['coat', 'Die coat on the mould bases for a smooth release', 'coat', 'DIE COAT'],
  ['conv', 'Main MCB and AC drive on, conveyor started', null, ''],
  ['valve', 'Lubrication ball valve open during casting', 'valve', 'BALL VALVE'],
  ['water', 'Cooling tower tank ≥ 80 %, tower fan, inlet and outlet pumps on', 'fill', 'FILL TANK'],
  ['spray', 'Water flow and pressure low: no water on top of the moulds', null, ''],
  ['pour', 'Furnace tilted: metal at the distributor 700–750 °C', null, ''],
  ['speed', 'Conveyor speed set slowly with the potentiometer to fill the moulds', null, ''],
  ['release', 'Hammers freed once filled moulds reach the discharge', 'hm:free', 'FREE'],
  ['disch', 'Ingot at the discharge 150–250 °C (pedestal fan helps)', null, ''],
  ['after', 'After casting: bolts at moulds and plummer blocks tightened, chips removed', 'tighten', 'TIGHTEN'],
];

export function createHMI(host, act) {
  const root = document.createElement('div');
  root.className = 'tp';
  host.appendChild(root);
  const pb = (a, cls, label, c = '') => `<div class="ctl"><em>${label}</em><button class="pbn ${cls}" data-a="${a}" ${c ? `data-c="${c}"` : ''}><span></span></button></div>`;
  const lamp = (c, label) => `<div class="ctl lm"><em>${label}</em><i class="lmp" data-c="${c}"></i></div>`;
  root.innerHTML = `
  <div class="hd"><b>INGOT CASTING MACHINE</b><span>ENTEC · 5 HP VFD PANEL · ${N} MOULDS</span><span class="clk" data-v="clock"></span>
    <div class="lc"><i data-c="lcR"></i><i data-c="lcA"></i><i data-c="lcG"></i></div></div>
  <div class="cab2">
    <div class="vfd">
      <div class="r1">${lamp('ry', 'R')}${lamp('yy', 'Y')}${lamp('by', 'B')}
        <div class="ctl"><em>MAIN MCB 63 A TP</em><button class="mcb" data-a="mcb" data-c="mcbB"><span></span></button></div>
        <div class="ctl"><em>TEMP · WATER PT-100</em><b class="seg g" data-v="wT"></b></div></div>
      <div class="r1">${lamp('cOn', 'CONVEYOR ON')}${lamp('cTr', 'CONVEYOR TRIP')}${pb('start', 'g', 'START · 5HP VFD')}${pb('stop', 'r', 'STOP')}${pb('reset', 'b', 'RESET')}${pb('estop', 'r', 'EMERGENCY STOP', 'esB')}</div>
      <div class="r1">${lamp('w1On', 'WP-1 ON')}${lamp('w1Tr', 'WP-1 TRIP')}${pb('wp1:1', 'g', 'INLET START')}${pb('wp1:0', 'r', 'INLET STOP')}
        <div class="ctl"><em>A / M</em><button class="mbt" data-a="am" data-c="amB" data-v="am"></button></div></div>
      <div class="r1">${lamp('w2On', 'WP-2 ON')}${pb('wp2:1', 'g', 'OUTLET START')}${pb('wp2:0', 'r', 'OUTLET STOP')}
        <div class="ctl pot"><em>POT · CONVEYOR SPEED</em><input type="range" min="0" max="100" step="1" data-pot><b data-v="potV"></b></div></div>
    </div>
    <div class="irp"><div class="ir"><b class="seg" data-v="ir1"></b><span>LOW TEMP INDIC-1 (IR SENSOR-1)</span></div>
      <div class="ir"><b class="seg" data-v="ir2"></b><span>HIGH TEMP INDIC-2 (IR SENSOR-2)</span></div></div>
  </div>
  <div class="ro">
    <div><span>Conveyor speed</span><b data-v="v"></b></div>
    <div><span>Moulds per minute</span><b data-v="mpm"></b></div>
    <div><span>Metal per mould</span><b data-v="perM"></b></div>
    <div><span>Speed for 10 kg ingots</span><b data-v="vMatch"></b></div>
    <div><span>Distributor</span><b data-v="distT"></b></div>
    <div><span>Moulds (average)</span><b data-v="mT"></b></div>
    <div><span>Cooling tower tank</span><b data-v="tank"></b></div>
    <div><span>Vibration</span><b data-v="vib"></b></div>
    <div><span>Casting time</span><b data-v="cast"></b></div>
    <div><span>Ingots good / defective</span><b data-v="made"></b></div>
    <div><span>Last ingot</span><b data-v="last"></b></div>
    <div><span>Knocked out by hand</span><b data-v="knock"></b></div>
  </div>
  <div class="loc">
    <div class="lp"><h6>FURNACE · POUR</h6>
      <div class="lr"><em>Pour</em><input type="range" min="0" max="16" step="0.5" data-sl="pour"><b data-v="pour"></b></div>
      <div class="lr"><em>Metal</em><input type="range" min="640" max="800" step="5" data-sl="metal"><b data-v="metal"></b></div></div>
    <div class="lp"><h6>WATER</h6>
      <div class="lr"><em>Spray</em><input type="range" min="0" max="100" step="5" data-sl="spray"><b data-v="spray"></b></div>
      <div class="lr"><em>Tower fan</em><button class="mbt" data-a="tower:1" data-c="tw1">ON</button><button class="mbt" data-a="tower:0" data-c="tw0">OFF</button></div></div>
    <div class="lp"><h6>DISCHARGE</h6>
      <div class="lr"><em>Hammers</em><button class="mbt" data-a="hm:locked" data-c="hmL">LOCKED</button><button class="mbt" data-a="hm:free" data-c="hmF">FREE</button></div>
      <div class="lr"><em>Operator</em><button class="mbt" data-a="op" data-c="opB" data-v="op"></button><em>Fan</em><button class="mbt" data-a="fan" data-c="fanB" data-v="fan"></button></div></div>
  </div>
  <div class="tr3">
    <div class="th3"><b class="t3">OPERATION · AS IN THE MANUAL</b><span class="score" data-v="score"></span></div>
    <div class="tb3"><ol class="steps">${STEPS.map(([k, txt, a, b]) => `<li data-k="${k}"><span class="st"></span><span class="tx">${txt}</span>${a ? `<button class="tk" data-a="${a}" data-sk="${k}">${b}</button>` : ''}</li>`).join('')}</ol>
      <div class="side"><h6>ALARMS</h6><ul class="ev al2"></ul><h6>VIOLATIONS · CAUTIONS</h6><ul class="ev vi"></ul></div></div>
    <div class="msg2" data-v="msg"></div>
  </div>`;
  const nodes = {v: [...root.querySelectorAll('[data-v]')], c: [...root.querySelectorAll('[data-c]')]};
  root.addEventListener('click', (e) => {
    const a = e.target.closest('button[data-a]');
    if (a) act(a.dataset.a);
  });
  root.addEventListener('input', (e) => {
    if (e.target.dataset.pot !== undefined) act('pot', [Number(e.target.value)]);
    const k = e.target.dataset.sl;
    if (k) act(k, [Number(e.target.value)]);
  });
  const potEl = root.querySelector('[data-pot]');
  const sl = [...root.querySelectorAll('[data-sl]')];
  const torchBtns = [...root.querySelectorAll('[data-a^="torch:"]')];
  let lastAl = '';
  let lastEv = '';
  function refresh(s) {
    const r = rates(s);
    const blink = Math.floor(s.t * 2) % 2 === 0;
    const alarm = s.alarms.some((a) => a.active);
    const on = (b) => (b ? 'on' : '');
    const avgT = s.moulds.reduce((a, m) => a + m.T, 0) / N;
    const V = {
      clock: `${String(Math.floor(s.t / 3600)).padStart(2, '0')}:${String(Math.floor((s.t % 3600) / 60)).padStart(2, '0')}:${String(Math.floor(s.t % 60)).padStart(2, '0')}`,
      wT: s.waterT.toFixed(0),
      am: s.auto ? 'AUTO' : 'MAN',
      potV: `${s.potSet} %`,
      ir1: s.dischT > 40 ? s.dischT.toFixed(0) : '25',
      ir2: s.pour > 0 ? s.metalT.toFixed(0) : s.distT.toFixed(0),
      v: `${s.v.toFixed(2)} m/min`,
      mpm: `${r.mpm.toFixed(1)}`,
      perM: s.pour > 0 && s.v > 0.05 ? `${r.perMould.toFixed(1)} kg` : '—',
      vMatch: s.pour > 0 ? `${r.vMatch.toFixed(2)} m/min · POT ${Math.round(r.potMatch)} %` : '—',
      distT: `${s.distT.toFixed(0)} °C · ${s.distHeatMin.toFixed(0)} min`,
      mT: `${avgT.toFixed(0)} °C`,
      tank: `${s.towerTank.toFixed(0)} %`,
      vib: `${s.vib.toFixed(1)} mm/s`,
      cast: `${Math.floor(s.castMin)} / ${P.castMax} min`,
      made: `${s.made.good} / ${s.made.bad}`,
      last: s.lastIngot ? `${s.lastIngot.kg.toFixed(1)} kg · ${s.lastIngot.T.toFixed(0)} °C${s.lastIngot.defect ? ' · ' + s.lastIngot.defect : ''}` : '—',
      knock: `${s.made.knocked}`,
      pour: `${s.pour.toFixed(1)} t/h`,
      metal: `${s.metalT} °C`,
      spray: `${s.spray} %`,
      op: s.operator ? 'PRESENT' : 'AWAY',
      fan: s.fan ? 'ON' : 'OFF',
      score: `${t('Done')} ${Object.values(s.steps).filter(Boolean).length}/${STEPS.length}`,
      msg: s.log.length && s.t - s.log[0].t < 30 ? '⚠ ' + t(s.log[0].text) : '',
    };
    const C = {
      lcR: alarm && blink ? 'r on' : 'r',
      lcA: s.pour > 0 ? 'a on' : 'a',
      lcG: s.conv ? 'g on' : 'g',
      ry: 'lmp ' + on(s.mcb), yy: 'lmp ' + on(s.mcb), by: 'lmp ' + on(s.mcb),
      mcbB: 'mcb ' + on(s.mcb),
      cOn: 'lmp ' + on(s.conv),
      cTr: 'lmp ' + (s.convTrip ? 'bad' : ''),
      w1On: 'lmp ' + on(s.wp1Run),
      w1Tr: 'lmp ' + (s.wp1Trip ? 'bad' : ''),
      w2On: 'lmp ' + on(s.wp2 && s.mcb),
      esB: 'pbn r ' + (s.estop ? 'held' : ''),
      amB: 'mbt ' + on(s.auto),
      tw1: 'mbt ' + on(s.tower), tw0: 'mbt ' + on(!s.tower),
      hmL: 'mbt ' + on(s.hammers === 'locked'), hmF: 'mbt ' + on(s.hammers === 'free'),
      opB: 'mbt ' + on(s.operator),
      fanB: 'mbt ' + on(s.fan),
    };
    for (const n of nodes.v) {
      const k = n.dataset.v;
      if (!(k in V)) continue;
      const v = t(V[k]);
      if (n.textContent !== v) n.textContent = v;
    }
    for (const n of nodes.c) {
      const k = n.dataset.c;
      if (k in C && n.getAttribute('class') !== C[k]) n.setAttribute('class', C[k]);
    }
    if (document.activeElement !== potEl && Number(potEl.value) !== s.potSet) potEl.value = String(s.potSet);
    const val = {pour: s.pour, metal: s.metalT, spray: s.spray};
    for (const el of sl) if (document.activeElement !== el && Number(el.value) !== val[el.dataset.sl]) el.value = String(val[el.dataset.sl]);
    for (const b of torchBtns) b.classList.toggle('on', b.dataset.a === 'torch:dist' ? s.torchDist : s.torchMould);
    root.querySelectorAll('.steps li').forEach((li) => li.setAttribute('class', s.steps[li.dataset.k] ? 'done' : ''));
    const ak = getLang() + s.alarms.map((a) => a.no + (a.active ? 'A' : '')).join();
    if (ak !== lastAl) {
      lastAl = ak;
      const act2 = s.alarms.filter((a) => a.active);
      root.querySelector('.al2').innerHTML = act2.length ? act2.map((a) => `<li class="bad"><b>${a.no}</b> ${t(ALARMS[a.no])}</li>`).join('') : `<li class="ok">${t('No active alarms')}</li>`;
    }
    const ek = getLang() + s.events.map((e) => e.t.toFixed(0)).join();
    if (ek !== lastEv) {
      lastEv = ek;
      root.querySelector('.vi').innerHTML = s.events.length ? s.events.map((e) => `<li class="${e.kind}"><b>${e.kind === 'bad' ? '✕' : '!'}</b> ${t(e.text)}</li>`).join('') : `<li class="ok">${t('No violations so far.')}</li>`;
    }
  }
  translateTree(root);
  return {
    root,
    refresh,
    relang() {
      translateTree(root);
      lastAl = lastEv = '';
    },
    find(sel) {
      return root.querySelector(sel);
    },
  };
}
