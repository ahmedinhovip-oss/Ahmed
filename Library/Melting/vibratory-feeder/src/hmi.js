// The right side of the vibratory-feeder simulator: the common starter of the two motors (the manual drives them from
// one starter), the eccentric weight settings of each motor (inner and outer, by the % marks), the wiring / rotation
// of each motor, the bin openings against the particle size, the overband magnet, the five checks before starting,
// the readouts and the alarms and violations.
import {ALARMS, P, signals} from './model.js';
import {getLang, t, translateTree} from './i18n.js';

const CHECKS = [
  ['supply', 'a) Input to the motors is 415 V, 3 Ph, 50 Hz; both driven from a common starter'],
  ['conns', 'b) All connections made tight'],
  ['bolts', 'c) Bolts connecting the trough with the vibratory motors tightened'],
  ['springs', 'd) Complete assembly placed on its springs properly'],
  ['rotation', 'e) Both motors run in opposite directions as per the sketch'],
];
const pctSel = (m, side) => `<select data-ecc="${m}:${side}">${Array.from({length: 11}, (_, i) => `<option value="${i * 10}">${i * 10} %</option>`).join('')}</select>`;

export function createHMI(host, act) {
  const root = document.createElement('div');
  root.className = 'tp';
  host.appendChild(root);
  root.innerHTML = `
  <div class="hd"><b>VIBRATORY FEEDER</b><span>500 × 2000 · SS-304 · 2 × 0.5 HP · 1440 RPM</span><span class="clk" data-v="clock"></span>
    <div class="lc"><i data-c="lcR"></i><i data-c="lcA"></i><i data-c="lcG"></i></div></div>
  <div class="cab2">
    <div class="r1">
      <div class="ctl"><em>COMMON STARTER · START</em><button class="pbn g" data-a="start"><span></span></button><i class="lmp" data-c="runL"></i></div>
      <div class="ctl"><em>STOP</em><button class="pbn r" data-a="stop"><span></span></button></div>
      <div class="ctl"><em>RESET OVERLOAD</em><button class="pbn b" data-a="reset"><span></span></button></div>
      <div class="ctl"><em>EMERGENCY STOP</em><button class="pbn r" data-a="estop" data-c="esB"><span></span></button></div>
      <div class="ctl"><em>MOTOR 1</em><i class="lmp" data-c="m1L"></i><i class="sub" data-v="a1"></i></div>
      <div class="ctl"><em>MOTOR 2</em><i class="lmp" data-c="m2L"></i><i class="sub" data-v="a2"></i></div>
    </div>
    <div class="ro">
      <div><span>Stroke along the drive line</span><b data-v="amp"></b></div>
      <div><span>Transverse / rocking</span><b data-v="trans"></b></div>
      <div><span>Conveying speed</span><b data-v="speed"></b></div>
      <div><span>Feed rate</span><b data-v="feed"></b></div>
      <div><span>Delivered</span><b data-v="fed"></b></div>
      <div><span>Iron removed by the magnet</span><b data-v="iron"></b></div>
      <div><span>Iron passed to the furnace</span><b data-v="ironP"></b></div>
      <div><span>Fatigue on the motor feet</span><b data-v="dmg"></b></div>
    </div>
  </div>
  <div class="loc">
    <div class="lp"><h6>ECCENTRIC WEIGHTS · % OF MAX FORCE</h6>
      <div class="lr"><em>M1</em> inner ${pctSel(0, 0)} outer ${pctSel(0, 1)}</div>
      <div class="lr"><em>M2</em> inner ${pctSel(1, 0)} outer ${pctSel(1, 1)}</div>
      <div class="lr"><em>ALL</em><button class="mbt" data-a="all:40">40 %</button><button class="mbt" data-a="all:60">60 %</button><button class="mbt" data-a="all:80">80 %</button><button class="mbt" data-a="all:100">100 %</button></div>
      <div class="lr"><i data-v="eccNote"></i></div></div>
    <div class="lp"><h6>WIRING · ROTATION</h6>
      <div class="lr"><em>M1</em><b class="rot2" data-v="d1"></b><button class="mbt" data-a="swap:0">SWAP 2 PHASES</button></div>
      <div class="lr"><em>M2</em><b class="rot2" data-v="d2"></b><button class="mbt" data-a="swap:1">SWAP 2 PHASES</button></div>
      <div class="lr"><i data-v="dirNote"></i></div>
      <h6>OVERBAND MAGNET</h6><div class="lr"><button class="mbt" data-a="mag:1">ON</button><button class="mbt" data-a="mag:0">OFF</button><span class="lmp" data-c="magL"></span></div></div>
    <div class="lp"><h6>BIN OPENING</h6>
      <div class="lr"><em>Vertical</em><input type="range" min="50" max="900" step="10" data-op="V"><b data-v="oV"></b></div>
      <div class="lr"><em>Horizontal</em><input type="range" min="30" max="700" step="10" data-op="H"><b data-v="oH"></b></div>
      <div class="lr"><em>Largest piece</em><b data-v="part"></b></div>
      <div class="lr"><i data-v="openNote"></i></div></div>
  </div>
  <div class="tr3">
    <div class="th3"><b class="t3">CHECK BEFORE STARTING</b><button class="mbt" data-a="repair">REPAIR CRACKED FOOT</button><span class="score" data-v="score"></span></div>
    <div class="tb3"><ol class="steps">${CHECKS.map(([k, txt]) => `<li data-k="${k}"><span class="st"></span><span class="tx">${txt}</span><button class="tk" data-a="chk:${k}">CHECK</button></li>`).join('')}</ol>
      <div class="side"><h6>ALARMS</h6><ul class="ev al2"></ul><h6>VIOLATIONS · CAUTIONS</h6><ul class="ev vi"></ul></div></div>
    <div class="msg2" data-v="msg"></div>
  </div>`;
  const nodes = {v: [...root.querySelectorAll('[data-v]')], c: [...root.querySelectorAll('[data-c]')]};
  root.addEventListener('click', (e) => {
    const a = e.target.closest('button[data-a]');
    if (a) act(a.dataset.a);
  });
  root.addEventListener('change', (e) => {
    const k = e.target.dataset.ecc;
    if (k) {
      const [m, side] = k.split(':').map(Number);
      act('ecc', [m, side, Number(e.target.value)]);
    }
  });
  root.addEventListener('input', (e) => {
    const o = e.target.dataset.op;
    if (o) act('open', [o, Number(e.target.value)]);
  });
  const sels = [...root.querySelectorAll('[data-ecc]')];
  const ops = [...root.querySelectorAll('[data-op]')];
  let lastAl = '';
  let lastEv = '';
  function refresh(s) {
    const g = signals(s);
    const on = (b) => (b ? 'on' : '');
    const blink = Math.floor(s.t * 2) % 2 === 0;
    const alarm = s.alarms.some((a) => a.active);
    const amps = s.rpm.map((r, m) => (r > 50 ? (P.flA * (0.55 + 0.45 * (g.f[m] / 100)) + (s.trans > 0.3 ? 0.15 : 0)).toFixed(2) + ' A' : '0.00 A'));
    const arrow = (d) => (d > 0 ? '⟳ CW' : '⟲ CCW');
    const V = {
      clock: `${String(Math.floor(s.t / 60)).padStart(2, '0')}:${String(Math.floor(s.t % 60)).padStart(2, '0')}`,
      a1: amps[0],
      a2: amps[1],
      amp: `${s.amp.toFixed(2)} mm`,
      trans: `${s.trans.toFixed(2)} mm`,
      speed: `${s.speed.toFixed(1)} m/min`,
      feed: `${s.feed.toFixed(1)} t/h`,
      fed: `${s.fed.toFixed(2)} t`,
      iron: `${s.iron.toFixed(1)} kg`,
      ironP: `${s.ironPassed.toFixed(1)} kg`,
      dmg: s.cracked ? 'CRACKED' : `${Math.round(s.damage)} %`,
      d1: arrow(s.dir[0]),
      d2: arrow(s.dir[1]),
      dirNote: g.opposite ? 'Opposite directions: straight-line throw' : 'Same direction: no straight throw, the body rocks',
      eccNote: g.unequal ? 'Unequal: set the same % on both sides of both motors' : 'Equal on both sides of both motors',
      oV: `${s.openV} mm`,
      oH: `${s.openH} mm`,
      part: `${s.particle} mm`,
      openNote: s.bridging ? `Too small: openings must be at least 2 × ${s.particle} mm` : 'Openings OK for the particle size',
      score: `${t('Checks')} ${Object.values(s.checks).filter(Boolean).length}/5`,
      msg: s.log.length && s.t - s.log[0].t < 30 ? '⚠ ' + t(s.log[0].text) : '',
    };
    const C = {
      lcR: alarm && blink ? 'r on' : 'r',
      lcA: s.bridging && s.run ? 'a on' : 'a',
      lcG: s.run ? 'g on' : 'g',
      runL: 'lmp ' + on(s.run),
      m1L: 'lmp ' + (s.tripped[0] ? 'bad' : on(s.rpm[0] > 50)),
      m2L: 'lmp ' + (s.tripped[1] ? 'bad' : on(s.rpm[1] > 50)),
      magL: 'lmp ' + on(s.magnet),
      esB: 'pbn r ' + (s.estop ? 'held' : ''),
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
    sels.forEach((el) => {
      const [m, side] = el.dataset.ecc.split(':').map(Number);
      if (document.activeElement !== el && Number(el.value) !== s.ecc[m][side]) el.value = String(s.ecc[m][side]);
    });
    ops.forEach((el) => {
      const v = el.dataset.op === 'V' ? s.openV : s.openH;
      if (document.activeElement !== el && Number(el.value) !== v) el.value = String(v);
    });
    root.querySelectorAll('.steps li').forEach((li) => li.setAttribute('class', s.checks[li.dataset.k] ? 'done' : ''));
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
    closePad() {},
  };
}
