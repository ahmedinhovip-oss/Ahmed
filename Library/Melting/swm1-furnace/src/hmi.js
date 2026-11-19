// The right side of the SWM#1 trainer: the main cabinet with the controls the procedures name (20Q1, auxiliary
// connection, safety relay reset, 201SH3 combustion fan, "Open main solenoid valve", burner selectors 201SH5 and
// 202SH1, alarm silence, the gas manometer), small HMI readouts with password-protected set points, the local
// panels (Aluswirler 207SH1 / 208SH2 / 208S1, main door 210SH1 / 210SH2, extraction pump, scrap feed), and the
// procedure trainer: pick a procedure, follow its steps, use the task buttons, and see the violations it records.
import {ALARMS, levelOf, P, signals} from './model.js';
import {PROCS} from './procedures.js';
import {getLang, t, translateTree} from './i18n.js';

export const CLOCK0 = new Date(2026, 10, 19, 6, 0, 0).getTime();
const pad = (n) => String(n).padStart(2, '0');
const clock = (tm) => {
  const d = new Date(CLOCK0 + tm * 1000);
  const days = Math.floor(tm / 86400);
  return `${days ? `+${days}d ` : ''}${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};
const mmss = (sec) => `${pad(Math.floor(sec / 60))}:${pad(Math.floor(sec % 60))}`;

// the task buttons each procedure offers, besides the cabinet and local panels
const TASKS = {
  p1: [['i:tc', 'Check thermocouples'], ['i:levelDet', 'Inspect level detector'], ['cleanSensor', 'Clean level sensor'], ['i:chipDet', 'Inspect chip detector'], ['i:controllers', 'Confirm controllers'], ['i:gas', 'Read gas manometer'], ['platDoor', 'Close vault / platform door']],
  p2: [],
  p3: [['doorOpen', 'Open door 210SH1'], ['pour', 'Pour the ladle'], ['newLadle', 'Bring a full ladle'], ['doorClose', 'Close door 210SH2']],
  p4: [['skim', 'Drag slag to the bins']],
  p5: [['skimSurface', 'Remove surface slag'], ['trays', 'Place trays under every plug'], ['cone:1', '1 Take new ceramic cone'], ['unlock:pneu', 'Remove lock · pneumatic'], ['open:pneu', 'Open pneumatic plug'], ['cone:3', '3 Clean metal cone'], ['cone:4', '4 Place new cone'], ['cone:5', '5 Clean the hole'], ['unlock:aswA', 'Remove lock · Aluswirler plug'], ['open:aswA', 'Open Aluswirler plug'], ['unlock:vortexB', 'Remove lock · vortex plug'], ['open:vortexB', 'Open vortex plug'], ['pumpOut', 'Remove extraction pump'], ['unlock:pumpM', 'Remove lock · pump plug'], ['open:pumpM', 'Open pump manual plug'], ['closeAll', 'Clean faces, gasket, close and lock all']],
  p6: [['clipsOff', 'Loosen clips'], ['h:up', 'Hoist up'], ['h:toMaint', 'To maintenance support'], ['removeImp', 'Remove impeller'], ['dry', 'Dry new piece 24 h on vault'], ['fitImp', 'Fit new impeller'], ['align', 'Turn 10 % and align'], ['tighten', 'Tighten through bolts'], ['cleanVolute', 'Clean the volute'], ['h:toWell', 'Move over the well'], ['h:descend', 'Descend to 25 mm above bath'], ['h:third', 'Lower 1/3 of the blade'], ['clipsOn', 'Fix with clips'], ['retighten', 'Hot re-tighten bowl screws']],
  p7: [],
};

export function createHMI(host, act) {
  const root = document.createElement('div');
  root.className = 'tp';
  host.appendChild(root);
  const sel = (k, label) => `<div class="sel"><em>${label}</em><div class="sw3" data-c="sel${k}">${['OFF', 'ON', 'RESET'].map((p) => `<button data-a="sel:${k}:${p}">${p}</button>`).join('')}</div></div>`;
  root.innerHTML = `
  <div class="hd"><b>SWM#1 · FVGP-A 3-30</b><span>MAIN CABINET</span><span class="clk" data-v="clock"></span>
    <div class="lc"><i data-c="lcR"></i><i data-c="lcA"></i><i data-c="lcG"></i></div></div>
  <div class="cab2">
    <div class="r1">
      <div class="ctl"><em>20Q1 MASTER</em><button class="rot" data-a="q20" data-c="q20"><span></span></button><i data-v="q20t"></i></div>
      <div class="ctl"><em>AUXILIARY</em><button class="pbn w" data-a="aux"><span></span></button><i class="lmp" data-c="auxL"></i></div>
      <div class="ctl"><em>RESET SAFETY RELAY</em><button class="pbn b" data-a="safety"><span></span></button><i class="lmp" data-c="safL"></i></div>
      <div class="ctl"><em>201SH3 COMBUSTION FAN</em><button class="pbn g" data-a="fan"><span></span></button><i class="lmp" data-c="fanL"></i><i class="sub" data-v="purge"></i></div>
      <div class="ctl"><em>OPEN MAIN SOLENOID VALVE</em><button class="pbn y" data-a="valve"><span></span></button><i class="lmp" data-c="valveL"></i></div>
      <div class="ctl gauge2"><em>GAS INLET</em><svg viewBox="0 0 80 50"><path d="M8 44 A32 32 0 0 1 72 44" fill="none" stroke="#889" stroke-width="3"/><line data-c="needle" x1="40" y1="44" x2="40" y2="16" stroke="#c0322b" stroke-width="2.5"/><circle cx="40" cy="44" r="3" fill="#222"/></svg><i class="sub" data-v="gasP"></i></div>
    </div>
    <div class="r2">${sel(0, '201SH5 BURNER 1')}${sel(1, '202SH1 BURNER 2')}
      <div class="ctl"><em>ALARM SILENCE</em><button class="pbn r" data-a="silence"><span></span></button></div>
      <div class="hmi2">
        <div class="kv2"><span>Chamber</span><b data-v="chT"></b><button class="spb" data-sp="ch" data-v="chSP"></button></div>
        <div class="kv2"><span>Aluminium</span><b data-v="alT"></b><button class="spb" data-sp="al" data-v="alSP"></button></div>
        <div class="kv2"><span>Level</span><b data-v="level"></b><i data-v="lvlNote"></i></div>
        <div class="kv2"><span>Burners</span><b data-v="burners"></b><i data-v="tight"></i></div>
      </div>
    </div>
  </div>
  <div class="loc">
    <div class="lp"><h6>ALUSWIRLER</h6>
      <div class="lr"><button class="mbt" data-a="aswRun">207SH1 RUN</button><button class="mbt" data-a="aswStop">STOP</button><span class="lmp" data-c="aswL"></span></div>
      <div class="lr"><em>208SH2</em><div class="sw3 two" data-c="aswMode"><button data-a="mode:AUTO">AUTO</button><button data-a="mode:MAN">MAN</button></div></div>
      <div class="lr"><em>208S1</em><button class="mbt s" data-a="spd:-5">−</button><input type="range" min="0" max="100" class="knob" data-k="speed"><button class="mbt s" data-a="spd:5">+</button><b data-v="speed"></b></div>
      <div class="lr"><span class="vtag" data-c="vtag"><span data-v="vortex"></span></span><i data-v="rpm"></i></div></div>
    <div class="lp"><h6>MAIN DOOR</h6>
      <div class="lr"><button class="mbt" data-a="doorOpen">210SH1 OPEN</button><button class="mbt" data-a="doorClose">210SH2 CLOSE</button></div>
      <div class="lr"><button class="mbt" data-a="doorLock" data-c="lockB">LOCK OPEN</button><b data-v="door"></b></div>
      <h6>EXTRACTION PUMP</h6>
      <div class="lr"><button class="mbt" data-a="pumpOn">START</button><button class="mbt" data-a="pumpOff">STOP</button><span class="lmp" data-c="pumpL"></span><i data-v="pumpT"></i></div></div>
    <div class="lp"><h6>SCRAP TO THE VORTEX</h6>
      <div class="lr"><button class="mbt" data-a="scrapOn">FEED</button><button class="mbt" data-a="scrapOff">STOP</button><span class="lmp" data-c="scrapL"></span></div>
      <div class="lr"><select data-k="stype"><option value="chip">Chip</option><option value="profile">Profile</option><option value="ubc">Can (UBC)</option></select>
        <select data-k="squal"><option value="clean">Clean, dry</option><option value="wet">Wet</option><option value="oily">Oily / painted</option></select></div>
      <div class="lr"><i data-v="melted"></i><i data-v="slag"></i></div></div>
  </div>
  <div class="tr3">
    <div class="th3"><select data-k="proc">${PROCS.map((p, i) => `<option value="${p.id}">${i + 1}. ${p.title}</option>`).join('')}</select>
      <button class="mbt" data-a="loadScn">Load starting situation</button><span class="score" data-v="score"></span></div>
    <div class="tb3"><ol class="steps"></ol><div class="side"><div class="tasks"></div><h6>VIOLATIONS · CAUTIONS</h6><ul class="ev"></ul></div></div>
    <div class="msg2" data-v="msg"></div>
  </div>
  <div class="pad" hidden><div class="pd"><div class="pt" data-v="padTitle"></div><div class="pn">Only authorised personnel may change set points.</div>
    <input class="pi" inputmode="decimal"><div class="pk">${[7, 8, 9, 4, 5, 6, 1, 2, 3, '-', 0, '.'].map((k) => `<button data-k="${k}">${k}</button>`).join('')}</div>
    <div class="pr"><button data-k="del">⌫</button><button data-k="esc">CANCEL</button><button data-k="ok" class="ok">ENTER</button></div></div></div>`;
  let proc = PROCS[0];
  const stepsEl = root.querySelector('.steps');
  const tasksEl = root.querySelector('.tasks');
  const evEl = root.querySelector('.ev');
  const knob = root.querySelector('[data-k=speed]');
  const nodes = {v: [...root.querySelectorAll('[data-v]')], c: [...root.querySelectorAll('[data-c]')]};

  function renderProc() {
    stepsEl.innerHTML = proc.steps.map(([txt, ref], i) => `<li data-i="${i}"><span class="st"></span><span class="tx">${txt}</span><em>${ref}</em></li>`).join('');
    tasksEl.innerHTML = (TASKS[proc.id] || []).map(([a, l]) => `<button class="tk" data-a="${a}">${l}</button>`).join('') || `<p class="none2">${'Use the cabinet and the local panels.'}</p>`;
    translateTree(stepsEl);
    translateTree(tasksEl);
    lastEv = '';
  }
  root.addEventListener('click', (e) => {
    const a = e.target.closest('button[data-a]');
    if (a) return act(a.dataset.a);
    const sp = e.target.closest('[data-sp]');
    if (sp) return openPad(sp.dataset.sp);
  });
  root.addEventListener('change', (e) => {
    const k = e.target.dataset.k;
    if (k === 'proc') {
      proc = PROCS.find((p) => p.id === e.target.value);
      renderProc();
      act('proc', proc.id);
    } else if (k === 'stype') act('stype', e.target.value);
    else if (k === 'squal') act('squal', e.target.value);
  });
  knob.addEventListener('input', () => act('speed', Number(knob.value)));

  const pad_ = root.querySelector('.pad');
  const pin = pad_.querySelector('.pi');
  let padKey = null;
  function openPad(k) {
    padKey = k;
    pad_.hidden = false;
    pin.value = '';
    pad_.querySelector('[data-v=padTitle]').textContent = t(k === 'ch' ? 'Chamber set point °C' : 'Aluminium set point °C');
    act('i:controllers');
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

  let lastEv = '';
  let lastStep = -2;
  function refresh(s, trainer) {
    const g = signals(s);
    const on = (b) => (b ? 'on' : '');
    const blink = Math.floor(s.t * 2) % 2 === 0;
    const alarm = s.alarms.some((a) => a.active);
    const lvl = levelOf(s);
    const V = {
      clock: clock(s.t),
      q20t: s.q20 ? 'ON' : 'OFF',
      purge: !s.fan.run ? '' : g.purged ? 'PURGED' : `PURGE ${mmss(Math.max(0, P.purge - s.fan.purge))}`,
      gasP: g.gasOK ? '180 mbar' : '0 mbar',
      chT: `${Math.round(s.chT)} °C`,
      alT: s.mass > 0.3 ? `${Math.round(s.alT)} °C` : '---',
      chSP: `SP ${Math.round(s.chSP)}`,
      alSP: `SP ${Math.round(s.alSP)}`,
      level: `${Math.round(lvl)} mm`,
      lvlNote: lvl >= P.levelMax ? 'MAXIMUM' : lvl >= P.levelMin ? 'VORTEX OK' : lvl >= P.pumpMin ? 'BELOW VORTEX MIN' : 'BELOW PUMP MIN',
      burners: s.burner.map((b) => t(b.toUpperCase())).join(' · '),
      tight: s.tight ? `${t('TIGHTNESS')} ${t(s.tight)}` : '',
      speed: `${s.asw.speed} %`,
      rpm: `${Math.round(s.asw.rpm)} rpm`,
      vortex: s.vortex.state.toUpperCase(),
      door: `${Math.round(s.door.pos * 100)} %${s.door.locked ? ' · LOCKED' : ''}`,
      pumpT: `${s.pump.flow.toFixed(2)} t/min${s.pump.in ? '' : ' · OUT'}`,
      melted: `${Math.round(s.scrap.melted)} kg melted`,
      slag: `${Math.round(s.scrap.slag)} kg dross`,
      msg: s.log.length && s.t - s.log[0].t < 40 ? '⚠ ' + t(s.log[0].text) : '',
      score: `${t('Steps')} ${trainer.i}/${proc.steps.length} · ${t('Score')} ${trainer.score}`,
    };
    const C = {
      lcR: alarm && (blink || s.silenced) ? 'r on' : 'r',
      lcA: s.fan.run && !g.purged ? (blink ? 'a on' : 'a') : 'a',
      lcG: s.burner.some((b) => b === 'on') ? 'g on' : 'g',
      q20: 'rot ' + on(s.q20),
      auxL: 'lmp ' + on(s.aux),
      safL: 'lmp ' + on(s.safety),
      fanL: 'lmp ' + (!s.fan.run ? '' : g.purged || blink ? 'on' : ''),
      valveL: 'lmp ' + on(s.mainValve),
      needle: '',
      sel0: 'sw3 v' + s.sel[0],
      sel1: 'sw3 v' + s.sel[1],
      aswL: 'lmp ' + on(s.asw.rpm > 5),
      aswMode: 'sw3 two v' + s.asw.mode,
      vtag: 'vtag ' + s.vortex.state,
      lockB: 'mbt ' + on(s.door.locked),
      pumpL: 'lmp ' + on(s.pump.flow > 0.01),
      scrapL: 'lmp ' + on(s.scrap.on),
    };
    for (const n of nodes.v) {
      const k = n.dataset.v;
      if (!(k in V)) continue;
      const v = t(V[k]);
      if (n.textContent !== v) n.textContent = v;
    }
    for (const n of nodes.c) {
      const k = n.dataset.c;
      if (!(k in C)) continue;
      const base = n.getAttribute('class')?.split(' ')[0] || '';
      const want = k.startsWith('lc') ? C[k] : C[k];
      if (k === 'needle') continue;
      if (n.getAttribute('class') !== want) n.setAttribute('class', want);
      void base;
    }
    const ndl = root.querySelector('[data-c=needle]');
    const ang = (g.gasOK ? 0.55 : -0.95) * (Math.PI / 2);
    ndl.setAttribute('x2', String(40 + Math.sin(ang) * 28));
    ndl.setAttribute('y2', String(44 - Math.cos(ang) * 28));
    if (document.activeElement !== knob && Number(knob.value) !== s.asw.speed) knob.value = String(s.asw.speed);
    // trainer: steps and violations
    if (trainer.i !== lastStep) {
      lastStep = trainer.i;
      stepsEl.querySelectorAll('li').forEach((li, i) => li.setAttribute('class', i < trainer.i ? 'done' : i === trainer.i ? 'cur' : ''));
      const cur = stepsEl.querySelector('li.cur');
      if (cur) cur.scrollIntoView({block: 'nearest'});
    }
    const key = getLang() + s.events.map((e) => e.t.toFixed(0)).join();
    if (key !== lastEv) {
      lastEv = key;
      evEl.innerHTML = s.events.length
        ? s.events.map((e) => `<li class="${e.kind}"><b>${e.kind === 'bad' ? '✕' : '!'}</b> ${t(e.text)} <em>${e.ref}</em></li>`).join('')
        : `<li class="ok">${t('No violations so far.')}</li>`;
    }
  }
  translateTree(root);
  renderProc();
  return {
    root,
    refresh,
    get proc() {
      return proc;
    },
    setProc(id) {
      proc = PROCS.find((p) => p.id === id);
      root.querySelector('[data-k=proc]').value = id;
      renderProc();
    },
    relang() {
      translateTree(root);
      renderProc();
      lastStep = -2;
    },
    find(sel) {
      return root.querySelector(sel);
    },
    closePad() {
      pad_.hidden = true;
    },
  };
}
void ALARMS;
