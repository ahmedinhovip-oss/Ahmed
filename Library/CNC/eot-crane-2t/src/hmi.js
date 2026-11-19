// The right side of the crane simulator: the pendant push-button station (ON / OFF, emergency stop, two-step buttons
// for UP / DOWN, cross travel LEFT / RIGHT and long travel FORWARD / REVERSE, all on VFDs), the drive readouts (speed,
// motor current against the rated current, brake), the load on the hook and the test key, the girder deflection
// against its limit, and the tests of the inspection documents, recorded as you run them.
import {ALARMS, currents, deflection, LOADS, P, RIG, TESTS} from './model.js';
import {getLang, t, translateTree} from './i18n.js';

const REQ = {
  speedHo: '4.0 m/min',
  speedCt: '15.0 m/min',
  speedLt: '20.0 m/min',
  ampHo: 'report 3.78 / 3.17 A',
  ampCt: 'report 1.07 / 1.03 A',
  ampLt: 'report 1.2 / 1.2 A',
  defl: 'report 13.0 mm',
  load: 'report: satisfactory',
  over: 'report: satisfactory',
};

export function createHMI(host, act) {
  const root = document.createElement('div');
  root.className = 'tp';
  host.appendChild(root);
  const jb = (ax, d, txt, cls = '') => `<button class="jg ${cls}" data-jog="${ax}:${d}">${txt}</button>`;
  root.innerHTML = `
  <div class="hd"><b>2.0 T SINGLE GIRDER EOT CRANE</b><span>SAFEX · NO. 2199 · SPAN 22.285 M · M5</span><span class="clk" data-v="clock"></span>
    <div class="lc"><i data-c="lcR"></i><i data-c="lcA"></i><i data-c="lcG"></i></div></div>
  <div class="cab2">
    <div class="pnd">
      <div class="pt2">PENDANT</div>
      <div class="prw"><div class="ctl"><em>ON</em><button class="pbn g" data-a="on"><span></span></button></div>
        <div class="ctl"><em>OFF</em><button class="pbn r" data-a="off"><span></span></button></div>
        <div class="ctl"><em>EMERGENCY STOP</em><button class="pbn r" data-a="estop" data-c="esB"><span></span></button></div></div>
      <div class="jgs">
        ${jb('ho', 1, '▲ UP')}${jb('ho', -1, '▼ DOWN')}
        ${jb('ct', -1, '◀ LEFT')}${jb('ct', 1, 'RIGHT ▶')}
        ${jb('lt', 1, '▲ FORWARD')}${jb('lt', -1, '▼ REVERSE')}
      </div>
      <div class="prw"><button class="mbt" data-a="spd:0" data-c="slowB">STEP 1 · SLOW</button><button class="mbt" data-a="spd:1" data-c="fastB">STEP 2 · FAST</button></div>
    </div>
    <div class="ro">
      <div><span>Hoisting</span><b data-v="vHo"></b></div>
      <div><span>Hook height</span><b data-v="hHo"></b></div>
      <div><span>Cross travel</span><b data-v="vCt"></b></div>
      <div><span>Trolley from DSL rail</span><b data-v="pCt"></b></div>
      <div><span>Long travel</span><b data-v="vLt"></b></div>
      <div><span>Bridge along the bay</span><b data-v="pLt"></b></div>
      <div><span>Hoist motor 2.2 kW</span><b data-v="aHo"></b></div>
      <div><span>CT motor 0.55 kW</span><b data-v="aCt"></b></div>
      <div><span>LT motors 2 × 0.75 kW</span><b data-v="aLt"></b></div>
      <div><span>Brakes H / CT / LT</span><b data-v="brk"></b></div>
      <div><span>Load on the hook</span><b data-v="load"></b></div>
      <div><span>Girder deflection</span><b data-v="defl"></b></div>
    </div>
  </div>
  <div class="loc">
    <div class="lp"><h6>LOAD ON THE HOOK</h6>
      <div class="lr"><select data-load>${LOADS.map(([kg, txt]) => `<option value="${kg}">${txt}</option>`).join('')}</select></div>
      <div class="lr"><i data-v="loadNote"></i></div></div>
    <div class="lp"><h6>OVERLOAD DEVICE · TEST KEY</h6>
      <div class="lr"><button class="mbt" data-a="key:0" data-c="k0">NORMAL</button><button class="mbt" data-a="key:1" data-c="k1">TEST KEY · BYPASS</button></div>
      <div class="lr"><i data-v="keyNote"></i></div></div>
    <div class="lp"><h6>WIRE ROPE · 8 MM 6×36 IWRC 1960</h6>
      <div class="lr"><button class="mbt" data-a="rope">INSPECT / REPLACE</button><span class="lmp" data-c="ropeL"></span></div>
      <div class="lr"><i data-v="ropeNote"></i></div></div>
  </div>
  <div class="tr3">
    <div class="th3"><b class="t3">TESTS OF THE INSPECTION REPORT</b><span class="score" data-v="score"></span></div>
    <div class="tb3"><ol class="steps">${TESTS.map(([k, txt]) => `<li data-k="${k}"><span class="st"></span><span class="tx">${txt}</span><em data-r="${k}"></em></li>`).join('')}</ol>
      <div class="side"><h6>ALARMS</h6><ul class="ev al2"></ul><h6>VIOLATIONS · CAUTIONS</h6><ul class="ev vi"></ul></div></div>
    <div class="msg2" data-v="msg"></div>
  </div>`;
  const nodes = {v: [...root.querySelectorAll('[data-v]')], c: [...root.querySelectorAll('[data-c]')], r: [...root.querySelectorAll('[data-r]')]};
  root.addEventListener('click', (e) => {
    const a = e.target.closest('button[data-a]');
    if (a) act(a.dataset.a);
  });
  // pendant buttons: the motion runs while the button is held
  let held = null;
  const release = () => {
    if (!held) return;
    act('jog:' + held + ':0');
    held = null;
  };
  root.addEventListener('pointerdown', (e) => {
    const j = e.target.closest('[data-jog]');
    if (!j) return;
    const [ax, d] = j.dataset.jog.split(':');
    held = ax;
    act('jog:' + ax + ':' + d);
  });
  addEventListener('pointerup', release);
  addEventListener('pointercancel', release);
  root.addEventListener('change', (e) => {
    if (e.target.dataset.load !== undefined) act('load:' + e.target.value);
  });
  const loadSel = root.querySelector('[data-load]');
  const jogs = [...root.querySelectorAll('[data-jog]')];
  let lastAl = '';
  let lastEv = '';
  function refresh(s) {
    const c = currents(s);
    const blink = Math.floor(s.t * 2) % 2 === 0;
    const alarm = s.alarms.some((a) => a.active);
    const sp = (v, ax) => `${Math.abs(v).toFixed(2)} m/min ${Math.abs(v) < 0.01 ? '' : ax === 'ho' ? (v > 0 ? '▲' : '▼') : v > 0 ? '▶' : '◀'}`.trim();
    const amp = (a, flc) => `${a.toFixed(2)} / ${flc} A`;
    const d = deflection(s);
    const rig = RIG[s.load] || 0;
    const V = {
      clock: `${String(Math.floor(s.t / 60)).padStart(2, '0')}:${String(Math.floor(s.t % 60)).padStart(2, '0')}`,
      vHo: sp(s.v.ho, 'ho'),
      hHo: `${s.pos.ho.toFixed(2)} / ${P.hol} m`,
      vCt: sp(s.v.ct, 'ct'),
      pCt: `${s.pos.ct.toFixed(2)} m`,
      vLt: sp(s.v.lt, 'lt'),
      pLt: `${s.pos.lt.toFixed(2)} m`,
      aHo: amp(c.ho, P.flc.ho),
      aCt: amp(c.ct, P.flc.ct),
      aLt: `${c.lt[0].toFixed(2)} + ${c.lt[1].toFixed(2)} A`,
      brk: ['ho', 'ct', 'lt'].map((ax) => (s.brake[ax] ? 'SET' : 'OPEN')).join(' / '),
      load: s.load ? `${s.load} kg${s.lifted ? '' : ' · on floor'}` : '0 kg',
      defl: `${d.toFixed(1)} / ${P.deflMax.toFixed(2)} mm`,
      loadNote: !s.load ? 'Lower the hook to a load and pick it from the list' : s.lifted ? `Clear of the floor by ${(s.pos.ho - rig).toFixed(2)} m` : 'Slings on the hook; hoist up to lift',
      keyNote: s.testKey ? 'Bypassed: overload test only, witnessed' : `Hoisting blocked above ${Math.round(P.swl * P.overload)} kg`,
      ropeNote: s.ropeOK ? `Breaking force tested 52.4 kN (min 45.0)` : 'Broken wires found: replace the rope',
      score: `${t('Tests')} ${Object.values(s.tests).filter(Boolean).length}/${TESTS.length}`,
      msg: s.log.length && s.t - s.log[0].t < 30 ? '⚠ ' + t(s.log[0].text) : '',
    };
    const C = {
      lcR: alarm && blink ? 'r on' : 'r',
      lcA: s.lifted ? 'a on' : 'a',
      lcG: s.on ? 'g on' : 'g',
      esB: 'pbn r ' + (s.estop ? 'held' : ''),
      slowB: 'mbt ' + (s.fast ? '' : 'on'),
      fastB: 'mbt ' + (s.fast ? 'on' : ''),
      k0: 'mbt ' + (s.testKey ? '' : 'on'),
      k1: 'mbt ' + (s.testKey ? 'on' : ''),
      ropeL: 'lmp ' + (s.ropeOK ? 'on' : 'bad'),
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
    for (const n of nodes.r) {
      const v = s.rec[n.dataset.r] ? `${s.rec[n.dataset.r]} · ${t(REQ[n.dataset.r])}` : t(REQ[n.dataset.r]);
      if (n.textContent !== v) n.textContent = v;
    }
    for (const j of jogs) {
      const [ax, dd] = j.dataset.jog.split(':');
      const on = Math.sign(s.v[ax]) === Number(dd) && Math.abs(s.v[ax]) > 0.01;
      j.classList.toggle('on', on);
    }
    if (document.activeElement !== loadSel && Number(loadSel.value) !== s.load) loadSel.value = String(s.load);
    root.querySelectorAll('.steps li').forEach((li) => li.setAttribute('class', s.tests[li.dataset.k] ? 'done' : ''));
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
