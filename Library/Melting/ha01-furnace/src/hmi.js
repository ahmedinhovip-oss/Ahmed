// The touch-panel HMI of the main cabinet, rebuilt from the manual's screens: furnace status, combustion system,
// adjustment parameters (temperature, combustion, Aluswirler, transfer pump, transfer interlock), hydraulic system,
// alarms with history, and trends. Every value is read from the plant state each refresh; every button calls an
// operator command through act(name, arg).
import {ALARMS, levelOf, P, SEQ_TEXT, signals, TREND_N} from './model.js';
import {getLang, t, translateTree} from './i18n.js';

const ICON = {
  status: `<svg viewBox="0 0 48 40"><rect x="6" y="14" width="34" height="20" fill="#9aa4ae" stroke="#4b5560"/><rect x="3" y="6" width="5" height="30" fill="#6b7580"/><rect x="2" y="6" width="44" height="3" fill="#6b7580"/><rect x="20" y="10" width="12" height="4" fill="#f0c419"/><rect x="34" y="18" width="5" height="9" fill="#2f9e44"/><rect x="22" y="20" width="5" height="8" fill="#c8352b"/></svg>`,
  comb: `<svg viewBox="0 0 48 40"><rect x="6" y="12" width="9" height="16" fill="#2f9e44"/><rect x="15" y="17" width="5" height="6" fill="#2f9e44"/><path d="M20 20 q10 -10 22 0 q-12 10 -22 0z" fill="#ff8a2a"/><path d="M20 20 q7 -5 13 0 q-6 5 -13 0z" fill="#ffd23a"/></svg>`,
  param: `<svg viewBox="0 0 48 40"><g fill="#6b6f74"><circle cx="17" cy="15" r="9"/><circle cx="32" cy="27" r="8"/></g><g fill="#d7d9dc"><circle cx="17" cy="15" r="3.5"/><circle cx="32" cy="27" r="3"/></g></svg>`,
  hyd: `<svg viewBox="0 0 48 40"><rect x="6" y="18" width="36" height="16" fill="#8b4a22"/><rect x="10" y="8" width="16" height="10" fill="#d7d9dc" stroke="#555"/><rect x="28" y="10" width="8" height="8" fill="#2a64c8"/><circle cx="30" cy="27" r="5" fill="#ccc"/><rect x="6" y="34" width="36" height="3" fill="#2f9e44"/></svg>`,
  alarm: `<svg viewBox="0 0 48 40"><path d="M10 32 q0 -18 14 -20 q14 2 14 20z" fill="#e02020"/><rect x="8" y="31" width="32" height="4" fill="#e02020"/><circle cx="24" cy="10" r="3" fill="#e02020"/><g stroke="#fff" stroke-width="1.2"><path d="M14 30 h20 M15 26 h18 M17 22 h14"/></g></svg>`,
  trend: `<svg viewBox="0 0 48 40"><rect x="8" y="6" width="32" height="28" fill="#fff" stroke="#666"/><path d="M8 15 h32 M8 25 h32 M19 6 v28 M29 6 v28" stroke="#bbb"/><rect x="14" y="9" width="5" height="22" rx="2.5" fill="#f0c419" stroke="#a07800"/><path d="M20 26 l6 -8 l6 4 l6 -10" stroke="#c8352b" stroke-width="2" fill="none"/></svg>`,
};
const NAV = [
  ['status', 'Furnace status'],
  ['comb', 'Combustion system'],
  ['param', 'Adjustment parameters'],
  ['hyd', 'Hydraulic system'],
  ['alarm', 'Alarms'],
  ['trend', 'Trends'],
];
const PARAM_TABS = [
  ['temp', 'TEMPERATURE CONTROL'],
  ['comb', 'COMBUSTION CONTROL'],
  ['swirl', 'ALUSWIRLER'],
  ['pump', 'TRANSFER PUMP'],
  ['ilk', 'TRANSFER INTERLOCK'],
];

const f0 = (x) => Math.round(x).toString();
const f1 = (x) => x.toFixed(1);
const f2 = (x) => x.toFixed(2);
const pad = (n) => String(n).padStart(2, '0');
export const CLOCK0 = new Date(2026, 10, 18, 7, 0, 0).getTime();
const clock = (t) => {
  const d = new Date(CLOCK0 + t * 1000);
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};
const hms = (t) => {
  const d = new Date(CLOCK0 + t * 1000);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

// small builders ---------------------------------------------------------------------------------
const lamp = (k, label = '') => `<span class="lamp" data-c="${k}"></span>${label ? `<span class="ll">${label}</span>` : ''}`;
const btn = (a, label, extra = '') => `<button class="hb" data-a="${a}" ${extra}>${label}</button>`;
const val = (k, cls = 'vbox') => `<span class="${cls}" data-v="${k}">-</span>`;

function valveSVG(x, y, k, name) {
  return `<g transform="translate(${x},${y})" class="valve" data-c="${k}">
    ${name ? `<rect x="-16" y="-48" width="32" height="13" class="tag"/><text x="0" y="-38" class="tt">${name}</text>` : ''}
    <rect x="-16" y="-34" width="32" height="10" class="auto"/><text x="0" y="-26" class="ta">AUTO</text>
    <rect x="-8" y="-22" width="16" height="12" class="act"/>
    <circle r="9" class="body"/><circle r="4" class="core"/></g>`;
}
function servoSVG(x, y, k, name) {
  return `<g transform="translate(${x},${y})"><rect x="-22" y="-44" width="44" height="13" class="tag"/><text x="0" y="-34" class="tt">${name}</text>
    <rect x="-22" y="-29" width="44" height="10" class="auto"/><text x="0" y="-21" class="ta">AUTO</text>
    <circle r="12" fill="#bfc4c9" stroke="#555"/><text x="0" y="5" class="tm">M</text>
    <text x="-30" y="-6" class="ts">OPEN</text><text x="30" y="-6" class="ts">CLOSED</text>
    <circle cx="-26" cy="4" r="5" class="sl" data-c="${k}o"/><circle cx="26" cy="4" r="5" class="sl" data-c="${k}c"/></g>`;
}

function combustionSVG() {
  const gasY = 70;
  const airY = 196;
  return `<svg class="pid" viewBox="0 0 700 470" width="680" height="457">
  <defs><marker id="ay" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10z" fill="#f2c200"/></marker></defs>
  <!-- gas main -->
  <path d="M0 ${gasY} H40" class="inlet"/>
  <path class="gp" data-c="gasflow" d="M110 ${gasY} H600 V128 M560 ${gasY} V290 H600 V300"/>
  <rect x="40" y="${gasY - 13}" width="70" height="26" rx="4" fill="#585e66"/><rect x="58" y="${gasY - 8}" width="34" height="16" fill="#3b4047"/><text x="75" y="${gasY + 4}" class="tw">RESET</text>
  <rect x="38" y="${gasY - 50}" width="74" height="22" class="num"/><text x="44" y="${gasY - 34}" class="tn" data-v="gasM3">0</text><text x="118" y="${gasY - 33}" class="tu">m3</text>
  <rect x="146" y="${gasY - 54}" width="50" height="14" class="tag"/><text x="171" y="${gasY - 43}" class="tt">GAS LOW</text><rect x="161" y="${gasY - 36}" width="20" height="18" class="pss" data-c="gaslow"/>
  <rect x="202" y="${gasY - 54}" width="54" height="14" class="tag"/><text x="229" y="${gasY - 43}" class="tt">GAS HIGH</text><rect x="219" y="${gasY - 36}" width="20" height="18" class="pss" data-c="gashigh"/>
  ${valveSVG(290, gasY, 'y1', '70Y1')}
  <rect x="322" y="${gasY - 54}" width="44" height="14" class="tag"/><text x="344" y="${gasY - 43}" class="tt">TIGHT</text><rect x="334" y="${gasY - 36}" width="20" height="18" class="pss" data-c="tight"/>
  ${valveSVG(396, gasY, 'y2', '70Y2')}
  ${valveSVG(450, gasY, 'y3', '70Y3')}
  <rect x="480" y="20" width="62" height="26" rx="8" class="mev"/><text x="511" y="31" class="tb">MAIN EV</text><text x="511" y="42" class="tb">BURNER 1</text>
  ${valveSVG(560, gasY, 'b1', '')}
  <rect x="480" y="240" width="62" height="26" rx="8" class="mev"/><text x="511" y="251" class="tb">MAIN EV</text><text x="511" y="262" class="tb">BURNER 2</text>
  <g transform="translate(0,220)">${valveSVG(560, gasY, 'b2', '')}</g>
  <!-- air -->
  <path class="ap" data-c="airflow" d="M160 380 H195 V${airY} H600 V160 M470 ${airY} V340 H600 V330"/>
  <path class="ap" d="M230 ${airY} V275 H290"/>
  ${valveSVG(258, 275, 'y4', '70Y4')}
  <rect x="300" y="226" width="20" height="18" class="pss" data-c="airflowsw"/><rect x="324" y="228" width="64" height="14" class="tag"/><text x="356" y="239" class="tt">AIR FLOW</text>
  <rect x="300" y="262" width="20" height="18" class="pss" data-c="airlow"/><rect x="324" y="264" width="64" height="14" class="tag"/><text x="356" y="275" class="tt">AIR LOW</text>
  ${servoSVG(520, 148, 'sm1', '76SM1')}
  ${servoSVG(520, 340, 'sm2', '78SM1')}
  <!-- fan -->
  <rect x="18" y="300" width="72" height="26" class="tag"/><text x="54" y="311" class="tt">COMBUSTION</text><text x="54" y="322" class="tt">FAN</text>
  <path d="M60 380 m-36 0 a36 36 0 1 0 72 0 a36 36 0 1 0 -72 0 M90 362 H160 V398 H90" fill="#c9ced3" stroke="#555"/>
  <circle cx="60" cy="380" r="16" class="fanc" data-c="fan"/>
  <!-- burners -->
  ${[0, 1]
    .map((b) => {
      const y = b ? 330 : 128;
      return `<g transform="translate(600,${y})"><rect x="0" y="-22" width="14" height="44" fill="#9aa1a8" stroke="#555"/><rect x="14" y="-30" width="6" height="60" fill="#777"/>
      <g data-c="flame${b}" class="flame"><path d="M20 0 q30 -20 70 0 q-40 20 -70 0z" class="fo"/><path d="M20 0 q16 -9 34 0 q-18 9 -34 0z" class="fi"/></g></g>
      <rect x="556" y="${y + 38}" width="40" height="18" class="cbox"/><text x="576" y="${y + 51}" class="tb" data-v="pow${b}">0</text>
      <rect x="600" y="${y + 38}" width="40" height="18" class="ybox"/><text x="620" y="${y + 51}" class="tb" data-v="srv${b}">0</text>
      <rect x="644" y="${y + 38}" width="54" height="18" class="mbox"/><text x="671" y="${y + 51}" class="tb" data-v="ua${b}">0 µA</text>
      <rect x="604" y="${y - 50}" width="94" height="16" class="obox"/><text x="651" y="${y - 38}" class="tb">${b ? '77BCU1 · #2' : '75BCU1 · #1'}</text>`;
    })
    .join('')}
  </svg>`;
}

export function createHMI(host, act) {
  const root = document.createElement('div');
  root.className = 'hmi';
  host.appendChild(root);
  root.innerHTML = `
  <div class="hdr">
    <div class="brand"><b>HA01</b><span>FVGP-A 1-30 MELTING FURNACE</span><div class="clock" data-v="clock"></div></div>
    <div class="nav">${NAV.map(([k, t]) => `<button class="nb" data-nav="${k}" title="${t}">${ICON[k]}</button>`).join('')}</div>
    <div class="warn" data-c="warn" title="Active alarms"><svg viewBox="0 0 40 36"><path d="M20 3 L38 33 H2z" fill="#f7d417" stroke="#111" stroke-width="2"/><rect x="18" y="12" width="4" height="12" fill="#111"/><rect x="18" y="26" width="4" height="4" fill="#111"/></svg><span data-v="nalarm">0</span></div>
    <button class="lang" data-a="lang" title="Language"><b>LANGUAGE</b><span data-v="langNow"></span></button>
  </div>
  <div class="banner" data-c="banner"><span data-v="banner"></span></div>
  <div class="body"></div>
  <div class="ftr">
    <div class="fb"><i>CHAMBER SP</i><b data-v="fChSP"></b></div><div class="fb"><i>CHAMBER PV</i><b data-v="fCh"></b></div>
    <div class="fb"><i>ALUMINIUM SP</i><b data-v="fAlSP"></b></div><div class="fb"><i>ALUMINIUM PV</i><b data-v="fAl"></b></div>
    <div class="msg" data-v="msg"></div>
    <div class="plc"><svg viewBox="0 0 40 30"><path d="M8 4 v10 a8 8 0 0 0 16 0 v-10 M16 22 v3 a6 6 0 0 0 12 0 v-6" stroke="#111" stroke-width="2.4" fill="none"/><circle cx="28" cy="17" r="3" fill="#111"/></svg></div><div class="plc g">PLC</div>
  </div>
  <div class="pad" hidden><div class="pd"><div class="pt" data-v="padTitle"></div><div class="pn">Only authorised personnel, under their responsibility, may change set points.</div>
    <input class="pi" inputmode="decimal"><div class="pk">${[7, 8, 9, 4, 5, 6, 1, 2, 3, '-', 0, '.'].map((k) => `<button data-k="${k}">${k}</button>`).join('')}</div>
    <div class="pr"><button data-k="del">⌫</button><button data-k="esc">CANCEL</button><button data-k="ok" class="ok">ENTER</button></div></div></div>`;
  const body = root.querySelector('.body');
  let screen = '';
  let ptab = 'temp';
  let hist = false;
  let nodes = {v: [], c: []};
  const hdrNodes = {
    v: [...root.querySelectorAll('.hdr [data-v], .banner [data-v], .ftr [data-v]')],
    c: [...root.querySelectorAll('.hdr [data-c], .banner[data-c]')],
  };

  // ------------------------------------------------------------ screens
  const screens = {
    status: () => `
      <div class="st">
        <div class="col">
          <div class="tbox"><h4>CHAMBER TEMPERATURE</h4><div class="row"><b>PV</b>${val('ch', 'pv')}</div><div class="row"><b>SP</b>${val('chSP', 'spv')}</div></div>
          <div class="tbox"><h4>ALUMINIUM TEMPERATURE</h4><div class="row"><b>PV</b>${val('al', 'pv')}</div><div class="row"><b>SP</b>${val('alSP', 'spv')}</div></div>
          <div class="doorst" data-c="doorst"><span data-v="doorst"></span></div>
          <div class="panel"><h4>BURNERS</h4><div class="seqtxt" data-v="seq"></div><div class="kv"><span>Firing rate</span>${val('fire')}</div><div class="kv"><span>Gas flow</span>${val('gasflow')}</div></div>
        </div>
        <div class="col mid">
          <div class="panel"><h4>ALUMINIUM LEVEL</h4><div class="kv"><span>Bath height</span>${val('level')}</div><div class="kv"><span>Estimated vol (Tn)</span>${val('tonnes')}</div>
            <div class="lvl"><div class="lf" data-v="lvlbar"></div><div class="rod" style="bottom:${(P.rodLevel / 1100) * 100}%"><span>WORKING LEVEL ROD</span></div><div class="pm" data-v="pmline"><span>PUMP MIN</span></div></div>
            <div class="kv full">${lamp('full')}<span>FULL FURNACE · loading stopped</span></div></div>
          <div class="mot"><div class="mn" data-c="swirlMot">ALUSWIRLER</div><div class="kv">${lamp('swirlSafe')}<span>Aluswirler safety level</span></div><div class="kv"><span>Speed</span>${val('rpm')}</div></div>
          <div class="mot"><div class="mn" data-c="pumpMot">TRANSFER PUMP</div><div class="kv">${lamp('pumpSafe')}<span>Trf pump safety level</span></div><div class="kv"><span>Flow to HC01</span>${val('flow')}</div></div>
        </div>
        <div class="col">
          <div class="panel trf"><h4>TRANSFER STATUS</h4>
            ${[
              ['hc01Emergency', 'HC01 Emergency OK'],
              ['gate', 'Transfer Gate OPEN'],
              ['comms', 'Communication OK'],
              ['bath', 'Bath Level OK'],
              ['hc01Temp', 'HC01 Temperature OK'],
              ['ha01Temp', 'HA01 Temperature OK'],
              ['pump', 'Transfer Pump STATUS'],
              ['permission', 'TRANSFER PERMISSION'],
            ]
              .map(([k, t]) => `<div class="kv"><span>${t}</span>${lamp('trf_' + k)}</div>`)
              .join('')}
            <h4>TRF INTERLOCKS</h4>${btn('goIlk', '&gt;&gt;&gt;', 'class="hb wide"')}
          </div>
          <div class="panel"><h4>FURNACE PRESSURE</h4><div class="kv"><span>PV</span>${val('pres')}</div><div class="kv"><span>Damper OP</span>${val('damper')}</div></div>
        </div>
      </div>`,
    comb: () => `
      <div class="cb">${combustionSVG()}
        <div class="leak"><h5>LEAKAGE · TIGHTNESS CONTROL</h5><div class="lg2">
          <div class="lc">${lamp('lkTEST', 'TEST')}${lamp('lkPS', 'P-SWITCH')}${lamp('lkOK', 'OK')}${lamp('lkF1', 'F-EV1')}${lamp('lkF2', 'F-EV2')}</div>
          <div class="lt"><em>${P.pmax} s TEST_PMAX</em>${val('pmaxT', 'sbox')}<em>${P.pmin} s TEST_PMIN</em>${val('pminT', 'sbox')}</div></div></div>
        <div class="purge"><div class="prow"><span class="pl" data-c="purgeL">PURGE</span><b>${P.purge} s</b>${val('purgeT', 'sbox')}</div><div class="cyc" data-c="cyc"><span data-v="seq"></span></div></div>
        <div class="ctl">${btn('start', 'START BURNERS', 'class="hb go"')}${btn('stop', 'STOP')}${btn('reset', 'RESET')}${btn('estop', 'EMERGENCY STOP', 'class="hb es" data-c="es"')}</div>
      </div>`,
    param: () => `
      <div class="tabs">${PARAM_TABS.map(([k, t]) => `<button class="tb ${k === ptab ? 'on' : ''}" data-ptab="${k}">${t}</button>`).join('')}</div>
      <div class="pbody">${PARAMS[ptab]()}</div>`,
    hyd: () => `
      <div class="hy">
        <div class="hbx"><h4>HYDRAULIC GROUP</h4><div class="mstate" data-c="hydMot"><span data-v="hydState"></span></div>
          <div class="kv"><span>Mode</span><select data-a="mode"><option>AUTOMATIC</option><option>MANUAL</option></select></div>
          <div class="br">${btn('hydOn', 'START')}${btn('hydOff', 'STOP')}</div>${btn('reset', 'RESET', 'class="hb wide"')}</div>
        <div class="hbx"><h4>FURNACE DOOR</h4><div class="mstate" data-c="doorMot"><span data-v="doorst"></span></div>
          <div class="bar"><div data-v="doorbar"></div></div><div class="kv"><span>Position</span>${val('doorpos')}</div>
          <div class="kv"><span>Mode</span><select><option>AUTOMATIC</option><option>MANUAL</option></select></div>
          <div class="br">${btn('doorUp', 'RAISE ▲')}${btn('doorDn', 'LOWER ▼')}</div>
          <div class="evs">${lamp('ev110Y1', '110Y1 EV LOAD')}<br>${lamp('ev110Y2', '110Y2 OPEN DOOR')}<br>${lamp('ev110Y3', '110Y3 CLOSE DOOR')}</div></div>
        <div class="hbx"><h4>TILTING PLATFORM</h4><div class="mstate" data-c="tiltMot"><span data-v="tiltst"></span></div>
          <div class="bar"><div data-v="tiltbar"></div></div><div class="kv"><span>Angle</span>${val('tiltang')}</div><div class="kv"><span>Ladle</span>${val('ladle')}</div>
          <div class="br">${btn('tiltUp', 'TILT UP')}${btn('tiltDn', 'TILT DOWN')}</div>
          <div class="br">${btn('lock', 'LOCK LADLE')}${btn('unlock', 'UNLOCK')}</div>
          <div class="evs">${lamp('evUp', 'TILTING UP')}<br>${lamp('evDn', 'TILTING DOWN')}<br>${lamp('evFw', 'FORWARD · ladle locked')}<br>${lamp('evBw', 'BACKWARD · ladle unlocked')}</div>
          ${btn('newLadle', 'NEW LADLE (forklift)', 'class="hb wide"')}</div>
      </div>
      <div class="hint">Charging: start the group → lock the ladle → raise the door (burners drop to low fire) → tilt up → tilt down → lower the door.</div>`,
    alarm: () => `
      <div class="al"><div class="ah"><b>${hist ? 'ALARM HISTORY' : 'ACTIVE ALARMS'}</b></div>
        <table><thead><tr><th>TIME</th><th>No.</th><th>ALARM</th><th>STATE</th></tr></thead><tbody data-v="altable"></tbody></table>
        <div class="ab">${btn('ack', 'ACKNOWLEDGE')}${btn('history', hist ? 'ACTIVE' : 'HISTORY')}${btn('clearAl', 'RESET / CLEAR')}</div></div>`,
    trend: () => `
      <div class="tr"><canvas width="1320" height="880"></canvas>
        <div class="lg"><span style="--c:#2f9e44">Chamber SP</span><span style="--c:#111">Chamber PV</span><span style="--c:#1f4fd6">Aluminium SP</span><span style="--c:#d0312d">Aluminium PV</span><em>last 60 min · 5 s samples</em></div></div>`,
  };
  const PARAMS = {
    temp: () => `<div class="tc">
      <div class="tcol"><div class="th"><span class="bl">ALUMINIUM</span><span class="gn">CONTROL ON</span></div>
        <div class="tg"><div class="gauge"><div data-v="gAl"></div></div><div class="tf">
        ${btn('remote', 'REMOTE', 'class="hb rm" data-c="remote"')}
        <i>SP</i><button class="sp" data-sp="al" data-v="alSP"></button><i>PV</i>${val('al', 'pvb')}
        <i>SP ALARM HIGH</i><button class="sp w" data-sp="alHigh" data-v="alHigh"></button><i>SP ALARM LOW</i><button class="sp w" data-sp="alLow" data-v="alLow"></button></div></div><div class="op">OP</div></div>
      <div class="tcol"><div class="th"><span class="bl">HOLDING CHAMBER</span><span class="gn">CONTROL ON</span></div>
        <div class="tg"><div class="gauge"><div data-v="gCh"></div></div><div class="tf">
        <i>SP</i><button class="sp" data-sp="ch" data-v="chSP"></button><i>PV</i>${val('ch', 'pvb')}
        <i>SP ALARM HIGH</i><button class="sp w" data-sp="chHigh" data-v="chHigh"></button><em class="rmk" data-v="rmk"></em></div></div><div class="op">OP</div></div>
      <div class="tcol"><div class="th"><span class="bl">PRESSURE</span><span class="gn">AUTO</span></div>
        <div class="tg"><div class="gauge p"><div data-v="gP"></div></div><div class="tf">
        <i>SP</i><button class="sp" data-sp="press" data-v="pSP"></button><i>PV</i>${val('pres', 'pvb')}<i>DAMPER OP</i>${val('damper', 'pvb')}</div></div></div>
      </div>
      <div class="lvlbox"><b>ALUMINIUM LEVEL</b>${val('levelS', 'vbox')}</div>`,
    comb: () => `<div class="mg">
      <div class="hbx"><h4>COMBUSTION FAN</h4><div class="mstate" data-c="fanMot"><span data-v="fanState"></span></div><div class="kv"><span>Speed</span>${val('fanSpd')}</div>
        <div class="kv"><span>Mode</span><select><option>AUTOMATIC</option><option>MANUAL</option></select></div><div class="br">${btn('start', 'START')}${btn('stop', 'STOP')}</div>${btn('reset', 'RESET', 'class="hb wide"')}</div>
      ${[0, 1]
        .map(
          (b) => `<div class="hbx"><h4>BURNER #${b + 1} · ${b ? '78SM1' : '76SM1'}</h4><div class="mstate" data-c="bMot${b}"><span data-v="bState${b}"></span></div>
        <div class="kv"><span>Servomotor</span>${val('srvP' + b)}</div><div class="kv"><span>Firing rate</span>${val('powP' + b)}</div><div class="kv"><span>Flame signal</span>${val('uaP' + b)}</div></div>`,
        )
        .join('')}
      <div class="hbx"><h4>FURNACE PRESSURE</h4><div class="kv"><span>SP</span>${val('pSP')}</div><div class="kv"><span>PV</span>${val('pres')}</div><div class="kv"><span>Damper OP</span>${val('damper')}</div></div></div>`,
    swirl: () => `<div class="mg">
      <div class="hbx big"><h4>ALUSWIRLER MOTOR</h4><div class="mstate" data-c="swMot"><span data-v="swState"></span></div>
        <div class="kv"><span>Mode</span><select><option>AUTOMATIC</option><option>MANUAL</option></select></div>
        <div class="kv"><span>Function</span><select><option>PRODUCTION</option><option>MAINTENANCE</option></select></div>
        <div class="kv"><span>Speed (rpm)</span>${val('rpmN', 'pvb')}</div><div class="kv"><span>Set point (rpm)</span><button class="sp w" data-sp="rpm" data-v="rpmSP"></button></div>
        <div class="br">${btn('swOn', 'START')}${btn('swOff', 'STOP')}</div>${btn('reset', 'RESET', 'class="hb wide"')}</div>
      <div class="hbx"><h4>COOLING FAN</h4><div class="mstate" data-c="swFan"><span data-v="swFanS"></span></div></div>
      <div class="hbx"><h4>VARIABLE SPEED DRIVE</h4><div class="mstate" data-c="swVsd"><span data-v="swVsdS"></span></div><div class="kv">${lamp('swirlSafe')}<span>Safety level ≥ ${P.swirlSafe} mm</span></div></div></div>`,
    pump: () => `<div class="mg">
      <div class="hbx big"><h4>TRANSFER PUMP MOTOR</h4><div class="mstate" data-c="pMot"><span data-v="pState"></span></div>
        <div class="kv"><span>Mode</span><select><option>AUTOMATIC</option><option>MANUAL</option></select></div>
        <div class="kv"><span>Flow</span>${val('flow', 'pvb')}</div>
        <div class="br">${btn('pumpOn', 'START')}${btn('pumpOff', 'STOP')}</div>${btn('reset', 'RESET', 'class="hb wide"')}</div>
      <div class="hbx"><h4>COOLING FAN · VSD</h4><div class="mstate" data-c="pFan"><span data-v="pFanS"></span></div></div>
      <div class="hbx"><h4>HC01 (simulated)</h4><div class="kv">${lamp('trf_gate', 'Transfer gate')}</div>${btn('hc01', 'HC01 REQUESTS TRANSFER', 'class="hb wide" data-c="hc01req"')}</div>
      <div class="hbx wide2"><h4>MINIMUM LEVEL ALARM</h4><div class="kv"><span>Laser level</span>${val('level', 'pvb')}</div><div class="kv"><span>Minimum level</span><button class="sp w" data-sp="pumpMin" data-v="pumpMin"></button></div></div></div>`,
    ilk: () => `<div class="ilk"><p>Conditions to transfer the load from this furnace (HA01) to HC01:</p>
      ${[
        ['hc01', 'HC01 INTERLOCK', 'HC01 healthy, communicating, transfer gate open'],
        ['temp', 'TEMPERATURE INTERLOCK', `HA01 metal between ${P.alTransferMin} °C and the high alarm`],
        ['pumpPerm', 'TRF PUMP PERMISSION', 'Bath above the pump minimum level, pump in automatic'],
        ['general', 'GENERAL PERMISSION', 'All transfer status signals OK'],
      ]
        .map(([k, t, d]) => `<div class="ic">${lamp('ilk_' + k)}<div><b>${t}</b><span>${d}</span></div></div>`)
        .join('')}
      <div class="br">${btn('hc01', 'HC01 REQUESTS TRANSFER', 'class="hb" data-c="hc01req"')}${btn('pumpOn', 'START TRANSFER')}${btn('pumpOff', 'STOP')}</div></div>`,
  };

  function show(name) {
    screen = name;
    body.innerHTML = screens[name]();
    translateTree(body);
    body.className = 'body s-' + name;
    nodes = {v: [...body.querySelectorAll('[data-v]')], c: [...body.querySelectorAll('[data-c]')]};
    for (const b of root.querySelectorAll('.nb')) b.classList.toggle('on', b.dataset.nav === name);
    last = null;
  }
  root.addEventListener('click', (e) => {
    const n = e.target.closest('[data-nav]');
    if (n) return act('screen', n.dataset.nav);
    const t = e.target.closest('[data-ptab]');
    if (t) return act('ptab', t.dataset.ptab);
    const a = e.target.closest('button[data-a]');
    if (a) return act(a.dataset.a);
    const sp = e.target.closest('[data-sp]');
    if (sp) return openPad(sp.dataset.sp);
  });

  // ------------------------------------------------------------ set point keypad
  const pad_ = root.querySelector('.pad');
  const pin = pad_.querySelector('.pi');
  let padKey = null;
  const SPNAME = {al: 'ALUMINIUM SET POINT °C', ch: 'CHAMBER SET POINT °C', alHigh: 'ALUMINIUM HIGH ALARM °C', alLow: 'ALUMINIUM LOW ALARM °C', chHigh: 'CHAMBER HIGH ALARM °C', press: 'PRESSURE SET POINT mbar', rpm: 'ALUSWIRLER SPEED rpm', pumpMin: 'PUMP MINIMUM LEVEL mm'};
  function openPad(k) {
    padKey = k;
    pad_.hidden = false;
    pad_.querySelector('[data-v=padTitle]').textContent = t(SPNAME[k]);
    pin.value = '';
    act('padOpen', k);
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

  // ------------------------------------------------------------ refresh
  let last = null;
  function values(s) {
    const g = signals(s);
    const V = {};
    const C = {};
    const lvl = levelOf(s);
    const doorTxt = s.door.pos < 0.01 ? 'DOOR CLOSED' : s.door.pos > 0.99 ? 'DOOR OPEN' : s.door.cmd > 0 ? 'DOOR OPENING' : s.door.cmd < 0 ? 'DOOR CLOSING' : 'DOOR PART OPEN';
    Object.assign(V, {
      clock: clock(s.t),
      ch: f0(s.ch) + '°C',
      al: s.mass > 0.3 ? f0(s.al) + '°C' : '---',
      chSP: f0(g.chSPeff) + '°C',
      alSP: f0(s.sp.al) + '°C',
      alHigh: f0(s.sp.alHigh) + ' °C',
      alLow: f0(s.sp.alLow) + ' °C',
      chHigh: f0(s.sp.chHigh) + ' °C',
      pSP: f2(s.sp.press) + ' mbar',
      pres: f2(s.pres) + ' mbar',
      damper: f0(s.damper * 100) + ' %',
      rmk: s.remote ? 'REMOTE: SP written by the aluminium loop' : 'LOCAL: operator SP',
      fChSP: f0(g.chSPeff),
      fCh: f0(s.ch),
      fAlSP: f0(s.sp.al),
      fAl: s.mass > 0.3 ? f0(s.al) : '---',
      level: f1(lvl) + ' mm',
      levelS: '+' + f1(lvl) + ' mm',
      tonnes: f1(s.mass) + ' Tn',
      doorst: doorTxt,
      seq: SEQ_TEXT[s.seq],
      fire: f0(((s.fire[0] + s.fire[1]) / 2) * 100) + ' %',
      gasflow: f0(g.gasM3h) + ' m³/h',
      gasM3: s.gasM3.toFixed(2),
      rpm: f0(s.swirl.rpm) + ' rpm',
      rpmN: f0(s.swirl.rpm),
      rpmSP: f0(s.sp.rpm),
      flow: f2(s.pump.flow) + ' t/min',
      pumpMin: f0(s.sp.pumpMin) + ' mm',
      pmaxT: (s.seq === 'PMAX' ? f0(s.seqT) : s.tight === 'OK' || s.seq === 'PMIN' ? P.pmax : 0) + ' s',
      pminT: (s.seq === 'PMIN' ? f0(s.seqT) : s.tight === 'OK' ? P.pmin : 0) + ' s',
      purgeT: (s.seq === 'PURGE' ? f0(s.seqT) : ['IGN', 'LOW', 'RUN', 'HOLD'].includes(s.seq) ? P.purge : 0) + ' s',
      hydState: s.hyd.run ? 'RUNNING' : 'STOPPED',
      doorpos: f0(s.door.pos * 100) + ' %',
      tiltang: f0(s.tilt.pos * P.tiltMax) + '°',
      ladle: f2(s.tilt.ladle) + ' t',
      tiltst: s.tilt.cmd > 0 ? 'TILTING UP' : s.tilt.cmd < 0 ? 'TILTING DOWN' : s.tilt.pos > 0.01 ? 'RAISED' : 'DOWN',
      fanState: s.fault === 'fanTrip' ? 'MOTOR PROTECTION FAULT' : s.fan.speed > 0.05 ? 'RUNNING' : 'STOPPED',
      fanSpd: f0(s.fan.speed * 100) + ' %',
      swState: s.swirl.rpm > 5 ? 'RUNNING' : 'STOPPED',
      swFanS: s.swirl.rpm > 5 ? 'RUNNING' : 'STOPPED',
      swVsdS: s.swirl.run ? 'READY · RUN' : 'READY',
      pState: s.pump.flow > 0.01 ? 'RUNNING' : 'STOPPED',
      pFanS: s.pump.flow > 0.01 ? 'RUNNING' : 'STOPPED',
      nalarm: String(s.alarms.filter((a) => a.active || !a.ack).length),
      msg: s.log.length && s.t - s.log[0].t < 30 ? '⚠ ' + t(s.log[0].text) : '',
      langNow: getLang() === 'ar' ? 'عربي' : 'EN',
    });
    for (let b = 0; b < 2; b++) {
      V['pow' + b] = f0(s.fire[b] * 100);
      V['srv' + b] = f0(s.servo[b] * 100);
      V['ua' + b] = f0(s.flame[b]) + ' µA';
      V['srvP' + b] = f0(s.servo[b] * 100) + ' %';
      V['powP' + b] = f0(s.fire[b] * 100) + ' %';
      V['uaP' + b] = f1(s.flame[b]) + ' µA';
      V['bState' + b] = s.fire[b] > 0 ? (s.fire[b] <= P.lowFire + 0.01 ? 'LOW FIRE' : 'FIRING') : 'OFF';
      C['flame' + b] = 'flame ' + (s.fire[b] > 0 ? (s.fire[b] > 0.5 ? 'big' : 'small') : 'off');
      C['bMot' + b] = 'mstate ' + (s.fire[b] > 0 ? 'run' : '');
    }
    const top = s.alarms.find((a) => a.active) || s.alarms.find((a) => !a.ack);
    V.banner = top ? `${top.code}    ${t(ALARMS[top.code] || top.text)}` : 'NO ACTIVE ALARMS';
    const lampC = (on, bad = 'red') => 'lamp ' + (on ? 'green' : bad);
    const ev = (on, bad) => 'valve ' + (bad ? 'bad' : on ? 'on' : 'off');
    Object.assign(C, {
      banner: 'banner ' + (top ? (top.active ? 'red' : 'amber') : 'grey'),
      warn: 'warn ' + (s.alarms.some((a) => !a.ack) ? 'blink' : ''),
      doorst: 'doorst ' + (s.door.pos < 0.01 ? 'ok' : 'open'),
      full: 'lamp ' + (g.full ? 'orange' : 'off'),
      swirlMot: 'mn ' + (s.swirl.rpm > 5 ? 'run' : 'stop'),
      pumpMot: 'mn ' + (s.pump.flow > 0.01 ? 'run' : 'stop'),
      swirlSafe: lampC(g.swirlSafe),
      pumpSafe: lampC(g.pumpSafe),
      gaslow: 'pss ' + (g.gasLowOK ? 'ok' : 'bad'),
      gashigh: 'pss ok',
      tight: 'pss ' + (s.tight === 'OK' ? 'ok' : s.tight.startsWith('F') ? 'bad' : s.tight === 'TEST' ? 'wait' : 'idle'),
      airflowsw: 'pss ' + (g.airFlowOK ? 'ok' : s.fan.run ? 'bad' : 'idle'),
      airlow: 'pss ' + (g.airLowOK ? 'ok' : s.fan.run || s.seq === 'LOCKOUT' ? 'bad' : 'idle'),
      y1: ev(s.ev.y1, s.tight === 'F-EV1'),
      y2: ev(s.ev.y2, s.tight === 'F-EV2'),
      y3: ev(s.ev.y3, false),
      y4: ev(s.ev.y4, false),
      b1: ev(s.ev.b1, false),
      b2: ev(s.ev.b2, false),
      gasflow: 'gp ' + (s.ev.y1 && (s.fire[0] + s.fire[1] > 0 || s.seq === 'PMAX') ? 'flow' : ''),
      airflow: 'ap ' + (s.fan.speed > 0.3 ? 'flow' : ''),
      fan: 'fanc ' + (s.fault === 'fanTrip' && s.seq === 'LOCKOUT' ? 'bad' : s.fan.speed > 0.05 ? 'on' : 'off'),
      sm1o: 'sl ' + (s.servo[0] > 0.95 ? 'on' : ''),
      sm1c: 'sl ' + (s.servo[0] < 0.05 ? 'on' : ''),
      sm2o: 'sl ' + (s.servo[1] > 0.95 ? 'on' : ''),
      sm2c: 'sl ' + (s.servo[1] < 0.05 ? 'on' : ''),
      lkTEST: 'lamp ' + (s.tight === 'TEST' ? 'amber' : 'off'),
      lkPS: 'lamp ' + (s.seq === 'PMAX' || s.seq === 'PMIN' ? 'amber' : 'off'),
      lkOK: 'lamp ' + (s.tight === 'OK' ? 'green' : 'off'),
      lkF1: 'lamp ' + (s.tight === 'F-EV1' ? 'red' : 'off'),
      lkF2: 'lamp ' + (s.tight === 'F-EV2' ? 'red' : 'off'),
      purgeL: 'pl ' + (s.seq === 'PURGE' ? 'on' : ''),
      cyc: 'cyc ' + (s.seq === 'LOCKOUT' ? 'bad' : s.seq === 'RUN' || s.seq === 'LOW' ? 'ok' : ''),
      es: 'hb es ' + (s.estop ? 'on' : ''),
      remote: 'hb rm ' + (s.remote ? 'on' : ''),
      hydMot: 'mstate ' + (s.hyd.run ? 'run' : ''),
      doorMot: 'mstate ' + (s.door.cmd ? 'run' : s.door.pos > 0.01 ? 'warn' : ''),
      tiltMot: 'mstate ' + (s.tilt.cmd ? 'run' : s.tilt.pos > 0.01 ? 'warn' : ''),
      ev110Y1: 'lamp ' + (s.hyd.run && s.door.pos < 0.01 ? 'green' : 'off'),
      ev110Y2: 'lamp ' + (s.door.cmd > 0 ? 'green' : 'off'),
      ev110Y3: 'lamp ' + (s.door.cmd < 0 ? 'green' : 'off'),
      evUp: 'lamp ' + (s.tilt.cmd > 0 ? 'green' : 'off'),
      evDn: 'lamp ' + (s.tilt.cmd < 0 ? 'green' : 'off'),
      evFw: 'lamp ' + (s.tilt.locked ? 'green' : 'off'),
      evBw: 'lamp ' + (!s.tilt.locked ? 'green' : 'off'),
      fanMot: 'mstate ' + (s.fault === 'fanTrip' ? 'bad' : s.fan.speed > 0.05 ? 'run' : ''),
      swMot: 'mstate ' + (s.swirl.rpm > 5 ? 'run' : ''),
      swFan: 'mstate ' + (s.swirl.rpm > 5 ? 'run' : ''),
      swVsd: 'mstate ' + (s.swirl.run ? 'run' : ''),
      pMot: 'mstate ' + (s.pump.flow > 0.01 ? 'run' : ''),
      pFan: 'mstate ' + (s.pump.flow > 0.01 ? 'run' : ''),
      hc01req: 'hb wide ' + (s.hc01.request ? 'on' : ''),
    });
    for (const [k, v] of Object.entries(g.trf)) C['trf_' + k] = lampC(v);
    for (const [k, v] of Object.entries(g.ilk)) C['ilk_' + k] = lampC(v);
    return {V, C, g, lvl};
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
    const {V, C, lvl} = values(s);
    apply(hdrNodes, V, C);
    apply(nodes, V, C);
    // styles that are not text
    const sty = (k, prop, v) => {
      const n = body.querySelector(`[data-v="${k}"]`);
      if (n) n.style[prop] = v;
    };
    if (screen === 'status') {
      sty('lvlbar', 'height', `${Math.min(100, (lvl / 1100) * 100)}%`);
      sty('pmline', 'bottom', `${(s.sp.pumpMin / 1100) * 100}%`);
    }
    if (screen === 'param' && ptab === 'temp') {
      sty('gAl', 'height', `${(s.al / 1200) * 100}%`);
      sty('gCh', 'height', `${(s.ch / 1200) * 100}%`);
      sty('gP', 'height', `${((s.pres + 1) / 2) * 100}%`);
    }
    if (screen === 'hyd') {
      sty('doorbar', 'width', `${s.door.pos * 100}%`);
      sty('tiltbar', 'width', `${s.tilt.pos * 100}%`);
    }
    if (screen === 'alarm') {
      const list = hist ? s.history.slice(0, 40) : s.alarms;
      const key = getLang() + (hist ? 'h' : 'a') + list.map((a) => a.code + (a.active ? 'A' : '') + (a.ack ? 'K' : '') + a.t.toFixed(0)).join();
      if (key !== last) {
        last = key;
        const tb = body.querySelector('[data-v=altable]');
        tb.innerHTML = list.length
          ? list
              .map((a) =>
                hist
                  ? `<tr class="${a.kind === 'RAISED' ? 'act' : 'clr'}"><td>${hms(a.t)}</td><td>${a.code}</td><td>${t(ALARMS[a.code] || a.text)}</td><td>${t(a.kind === 'RAISED' ? 'APPEARED' : 'CLEARED')}</td></tr>`
                  : `<tr class="${a.active ? (a.ack ? 'ackd' : 'act') : 'clr'}"><td>${hms(a.t)}</td><td>${a.code}</td><td>${t(ALARMS[a.code] || a.text)}</td><td>${t(a.active ? 'ACTIVE' : 'CLEARED')}${a.ack ? ' · ' + t('ACK') : ''}</td></tr>`,
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
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = '#fff';
    c.fillRect(0, 0, w, h);
    const tr = s.trend;
    const n = tr.n;
    const ser = ['chSP', 'ch', 'alSP', 'al'];
    let lo = 1e9;
    let hi = -1e9;
    const at = (arr, k) => arr[(tr.i - n + k + TREND_N) % TREND_N];
    for (const k of ser) for (let i = 0; i < n; i++) {
      const v = at(tr[k], i);
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
    lo = Math.floor((lo - 10) / 20) * 20;
    hi = Math.ceil((hi + 10) / 20) * 20;
    const L = 90;
    const R = w - 30;
    const T = 30;
    const B = h - 70;
    c.font = '22px Inter, sans-serif';
    c.fillStyle = '#555';
    c.strokeStyle = '#e1e3e6';
    c.lineWidth = 2;
    for (let v = lo; v <= hi; v += 20) {
      const y = B - ((v - lo) / (hi - lo)) * (B - T);
      c.beginPath();
      c.moveTo(L, y);
      c.lineTo(R, y);
      c.stroke();
      c.fillText(v + '°', 18, y + 8);
    }
    for (let m = 0; m <= 60; m += 10) {
      const x = R - (m / 60) * (R - L);
      c.beginPath();
      c.moveTo(x, T);
      c.lineTo(x, B);
      c.stroke();
      c.fillText(m ? `-${m} ${t('min')}` : t('now'), x - 36, B + 36);
    }
    const col = {chSP: '#2f9e44', ch: '#111', alSP: '#1f4fd6', al: '#d0312d'};
    for (const k of ser) {
      c.strokeStyle = col[k];
      c.lineWidth = k.endsWith('SP') ? 3 : 4;
      c.setLineDash(k.endsWith('SP') ? [14, 8] : []);
      c.beginPath();
      for (let i = 0; i < n; i++) {
        const x = R - ((n - 1 - i) / (TREND_N - 1)) * (R - L);
        const y = B - ((at(tr[k], i) - lo) / (hi - lo)) * (B - T);
        i ? c.lineTo(x, y) : c.moveTo(x, y);
      }
      c.stroke();
    }
    c.setLineDash([]);
  }

  translateTree(root);
  return {
    root,
    // re-render everything in the current language
    relang() {
      translateTree(root);
      if (screen) show(screen);
    },
    show,
    refresh,
    get screen() {
      return screen;
    },
    setPtab(k) {
      ptab = k;
      if (screen === 'param') show('param');
    },
    toggleHist() {
      hist = !hist;
      if (screen === 'alarm') show('alarm');
    },
    // the element a tour step points at, for the cursor
    find(sel) {
      return root.querySelector(sel);
    },
    closePad() {
      pad_.hidden = true;
    },
  };
}
void ALARMS;
