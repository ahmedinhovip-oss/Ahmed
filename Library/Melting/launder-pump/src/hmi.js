// The right side of the launder pump simulator: the pump starter and VFD (start / stop / overload reset / emergency
// stop, frequency), the hoist positions (maintenance stand, over the bath to preheat, in the well), the readouts, the
// assembly in the order of the exploded view with the bolts from the bill of materials, and the operating steps.
import {ALARMS, assembled, head, P, PARTS, STEPS} from './model.js';
import {getLang, t, translateTree} from './i18n.js';

const OPS = [
  ['asm', 'Pump assembled and checked on the maintenance stand'],
  ['preheat', 'Preheated over the bath to 500 °C before it touches the metal'],
  ['immerse', 'Lowered into the well, base on the floor, no thermal shock'],
  ['slow', 'Started at low speed (≤ 25 Hz), then ramped up'],
  ['flow', 'Metal flowing into the launder'],
  ['level', 'Transfer stopped before the level falls below the pump minimum'],
  ['clean', 'Lifted out: base and rotor cleaned of dross, parts inspected'],
];

export function createHMI(host, act) {
  const root = document.createElement('div');
  root.className = 'tp';
  host.appendChild(root);
  const pb = (a, cls, label, c = '') => `<div class="ctl"><em>${label}</em><button class="pbn ${cls}" data-a="${a}" ${c ? `data-c="${c}"` : ''}><span></span></button></div>`;
  root.innerHTML = `
  <div class="hd"><b>LAUNDER TRANSFER PUMP</b><span>MMEI MINI-902L-22ABL0 · 4 HP · 1000 RPM · 400 V</span><span class="clk" data-v="clock"></span>
    <div class="lc"><i data-c="lcR"></i><i data-c="lcA"></i><i data-c="lcG"></i></div></div>
  <div class="cab2">
    <div class="r1">${pb('start', 'g', 'START')}${pb('stop', 'r', 'STOP')}${pb('reset', 'b', 'RESET OVERLOAD')}${pb('estop', 'r', 'EMERGENCY STOP', 'esB')}
      <div class="ctl"><em>RUN</em><i class="lmp" data-c="runL"></i></div><div class="ctl"><em>TRIP</em><i class="lmp" data-c="trL"></i></div>
      <div class="ctl hz"><em>VFD FREQUENCY</em><input type="range" min="0" max="50" step="1" data-hz><b data-v="hzSet"></b></div></div>
    <div class="r1 hoist"><em>HOIST</em><button class="mbt" data-a="move:stand" data-c="mvS">MAINTENANCE STAND</button><button class="mbt" data-a="move:preheat" data-c="mvP">OVER THE BATH · PREHEAT</button><button class="mbt" data-a="move:well" data-c="mvW">INTO THE WELL</button></div>
    <div class="ro">
      <div><span>Motor speed</span><b data-v="rpm"></b></div>
      <div><span>Flow to the launder</span><b data-v="q"></b></div>
      <div><span>Transferred</span><b data-v="moved"></b></div>
      <div><span>Metal above the base</span><b data-v="sub"></b></div>
      <div><span>Lift to the riser lip</span><b data-v="head"></b></div>
      <div><span>Motor current</span><b data-v="amps"></b></div>
      <div><span>Pump temperature</span><b data-v="pumpT"></b></div>
      <div><span>Dross in the base</span><b data-v="dross"></b></div>
    </div>
  </div>
  <div class="tr3">
    <div class="th3"><b class="t3">ASSEMBLY · BILL OF MATERIALS</b><button class="mbt" data-a="disasm">DISASSEMBLE ALL</button><button class="mbt" data-a="clean">CLEAN BASE & ROTOR</button><span class="score" data-v="score"></span></div>
    <div class="tb3"><ol class="steps asm">${STEPS.map(([k, , txt, bolts]) => `<li data-k="${k}"><span class="st"></span><span class="tx">${txt}${bolts ? `<i class="bl">${bolts}</i>` : ''}<i class="pn">${PARTS[k].pn}</i></span><button class="tk" data-a="fit:${k}">FIT</button><button class="tk" data-a="rm:${k}">REMOVE</button></li>`).join('')}</ol>
      <div class="side"><h6>OPERATION</h6><ol class="steps ops">${OPS.map(([k, txt]) => `<li data-o="${k}"><span class="st"></span><span class="tx">${txt}</span></li>`).join('')}</ol>
        <h6>ALARMS</h6><ul class="ev al2"></ul><h6>VIOLATIONS · CAUTIONS</h6><ul class="ev vi"></ul></div></div>
    <div class="msg2" data-v="msg"></div>
  </div>`;
  const nodes = {v: [...root.querySelectorAll('[data-v]')], c: [...root.querySelectorAll('[data-c]')]};
  root.addEventListener('click', (e) => {
    const a = e.target.closest('button[data-a]');
    if (a) act(a.dataset.a);
  });
  root.addEventListener('input', (e) => {
    if (e.target.dataset.hz !== undefined) act('hz', [Number(e.target.value)]);
  });
  const hzEl = root.querySelector('[data-hz]');
  let lastAl = '';
  let lastEv = '';
  function refresh(s) {
    const blink = Math.floor(s.t * 2) % 2 === 0;
    const alarm = s.alarms.some((a) => a.active);
    const on = (b) => (b ? 'on' : '');
    const V = {
      clock: `${String(Math.floor(s.t / 3600)).padStart(2, '0')}:${String(Math.floor((s.t % 3600) / 60)).padStart(2, '0')}:${String(Math.floor(s.t % 60)).padStart(2, '0')}`,
      hzSet: `${s.hzSet} Hz`,
      rpm: `${Math.round(s.rpm)} rpm · ${s.hz.toFixed(1)} Hz`,
      q: `${s.q.toFixed(2)} t/min`,
      moved: `${s.moved.toFixed(2)} t`,
      sub: `${Math.round((s.level - P.baseTop) * 1000)} mm (min ${P.minSub * 1000})`,
      head: `${head(s).toFixed(2)} m`,
      amps: `${s.amps.toFixed(1)} / ${P.fla} A`,
      pumpT: `${Math.round(s.pumpT)} °C`,
      dross: `${s.dross.toFixed(0)} %`,
      score: `${t('Fitted')} ${STEPS.filter(([k]) => s.asm[k]).length}/${STEPS.length}`,
      msg: s.log.length && s.t - s.log[0].t < 30 ? '⚠ ' + t(s.log[0].text) : '',
    };
    const C = {
      lcR: alarm && blink ? 'r on' : 'r',
      lcA: s.pos === 'preheat' ? 'a on' : 'a',
      lcG: s.run ? 'g on' : 'g',
      esB: 'pbn r ' + (s.estop ? 'held' : ''),
      runL: 'lmp ' + on(s.run && s.rpm > 10),
      trL: 'lmp ' + (s.tripped ? 'bad' : ''),
      mvS: 'mbt ' + on(s.pos === 'stand'),
      mvP: 'mbt ' + on(s.pos === 'preheat'),
      mvW: 'mbt ' + on(s.pos === 'well'),
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
    if (document.activeElement !== hzEl && Number(hzEl.value) !== s.hzSet) hzEl.value = String(s.hzSet);
    root.querySelectorAll('.asm li').forEach((li) => li.setAttribute('class', s.asm[li.dataset.k] ? 'done' : s.lastWrong === li.dataset.k ? 'cur' : ''));
    root.querySelectorAll('.ops li').forEach((li) => li.setAttribute('class', s.steps[li.dataset.o] ? 'done' : ''));
    root.classList.toggle('full', assembled(s));
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
