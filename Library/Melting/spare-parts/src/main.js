// Spare-parts catalogue for the melting system, from Insertec's list CE-2019-019.2 (CMR-1993-001.2, 07/10/2020).
// 176 items over 11 systems. Filter by system, machine (from the "common spare parts valid for …" notes), type and
// text; see value by system; open an item for its details. Part names stay as the supplier wrote them.
// Opened with #film it plays a scripted 20 s walkthrough that the recorder steps with SIM.advance(dt).
import ITEMS from './items.json';
import {getLang, setLang, t, translateTree} from './i18n.js';

const SEC = [
  ['HA#1', 'Holding & alloying furnace HA#1'],
  ['HC#1', 'Holding & casting furnace HC#1'],
  ['SWM#1', 'Sidewell melting furnace SWM#1'],
  ['SWM#2', 'Sidewell melting furnace SWM#2'],
  ['I', 'IDEX decoating system'],
  ['PUM', 'Molten metal transfer pump'],
  ['TIL', 'Tilting platform'],
  ['DOS', 'Alloy elements storage & dosing'],
  ['PRE', 'Pretreatment system'],
  ['REW', 'Rejected wheels system'],
  ['L', 'Launders system'],
];
const MACH = [
  ['HA#1', 'E1982'],
  ['HC#1', 'E1983'],
  ['SWM#1', 'E1986'],
  ['SWM#2', 'E1987'],
  ['IDEX', 'E1988'],
];
const DOC_TOTAL = 228148;
// which machines an item serves: its own section, plus every machine its "common … valid for" note names
for (const it of ITEMS) {
  const set = new Set();
  const own = {'HA#1': 'HA#1', 'HC#1': 'HC#1', 'SWM#1': 'SWM#1', 'SWM#2': 'SWM#2', I: 'IDEX'}[it.sec];
  if (own) set.add(own);
  if (it.common) for (const [m, e] of MACH) if (it.common.includes(e)) set.add(m);
  it.machines = [...set];
  it.shared = it.machines.length > 1;
}
const eur = (v) => (v ? v.toLocaleString('en-US', {maximumFractionDigits: 0}) + ' €' : '—');
const esc = (x) => String(x).replace(/[&<>"]/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));

const CSS = `
html,body{margin:0;background:#eef0f2;font-family:Inter,'Segoe UI',system-ui,sans-serif;color:#1b1f24}
#app{position:absolute!important;inset:0!important;overflow:hidden;background:#eef0f2;color:#1b1f24;font-family:Inter,'Segoe UI',system-ui,sans-serif}
.sp{display:grid;grid-template-columns:330px 1fr 340px;grid-template-rows:auto 1fr;height:100%}
.sp header{grid-column:1/-1;display:flex;align-items:center;gap:18px;padding:16px 24px 12px;border-bottom:1px solid #d5dade;background:#fff}
.sp header h1{margin:0;font:700 22px Inter,sans-serif}
.sp header .sub{font:12px 'JetBrains Mono',monospace;color:#5d6670}
.kpi{display:flex;gap:10px;margin-left:auto}
.kpi div{background:#f4f6f8;border:1px solid #d5dade;border-radius:6px;padding:6px 12px;min-width:110px}
.kpi b{display:block;font:700 18px Inter,sans-serif;font-variant-numeric:tabular-nums}
.kpi span{font:11px Inter,sans-serif;color:#5d6670}
.langsw{display:flex;height:28px;border:1px solid #d3cdc2;border-radius:5px;overflow:hidden;background:#fbf9f5;cursor:pointer;padding:0}
.langsw span{display:flex;align-items:center;padding:0 10px;font:700 11px 'JetBrains Mono',monospace;color:#6b6f75}
.langsw span.on{background:#1d1f22;color:#fff}
.left{border-right:1px solid #d5dade;background:#fff;overflow:auto;padding:14px 16px}
.left h3,.right h3{margin:4px 0 8px;font:700 11px 'JetBrains Mono',monospace;letter-spacing:1px;color:#5d6670}
.sec{display:grid;grid-template-columns:1fr auto;gap:2px 8px;padding:6px 8px;border-radius:5px;cursor:pointer;align-items:center}
.sec:hover{background:#f4f6f8}.sec.on{background:#2f3a45;color:#fff}.sec.on em{color:#cfd6dc}
.sec b{font:600 13px Inter,sans-serif}.sec em{font:12px 'JetBrains Mono',monospace;color:#5d6670;font-style:normal;font-variant-numeric:tabular-nums}
.sec i{grid-column:1/-1;height:5px;background:#e3e7ea;border-radius:3px;overflow:hidden}
.sec i s{display:block;height:100%;background:#c8471b}
.chips{display:flex;flex-wrap:wrap;gap:6px;margin:4px 0 14px}
.chip{padding:5px 10px;border:1px solid #c9d0d6;border-radius:14px;background:#fff;font:600 12px Inter,sans-serif;cursor:pointer}
.chip.on{background:#c8471b;border-color:#c8471b;color:#fff}
.mid{display:flex;flex-direction:column;min-width:0;min-height:0;padding:14px 18px}
.bar{display:flex;gap:10px;align-items:center;margin-bottom:10px}
.bar input{flex:1;height:34px;border:1px solid #c9d0d6;border-radius:6px;padding:0 12px;font:14px Inter,sans-serif}
.bar .cnt{font:12px 'JetBrains Mono',monospace;color:#5d6670;white-space:nowrap}
.tbl{flex:1;overflow:auto;background:#fff;border:1px solid #d5dade;border-radius:8px}
table{width:100%;border-collapse:collapse;font:12.5px Inter,sans-serif}
th{position:sticky;top:0;background:#2f3a45;color:#fff;text-align:left;padding:7px 8px;font:700 11px Inter,sans-serif;cursor:pointer;white-space:nowrap}
td{padding:6px 8px;border-bottom:1px solid #eef0f2;vertical-align:top}
td.n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
tr{cursor:pointer}tr:hover td{background:#fff6ef}tr.on td{background:#fde3d6}
.ty{font:700 10px Inter,sans-serif;padding:2px 6px;border-radius:3px;white-space:nowrap}
.ty.c{background:#fde2e2;color:#9b1c1c}.ty.u{background:#e3f0e3;color:#2a6b34}.ty.b{background:#fff1cc;color:#7a5a00}
.mtag{display:inline-block;font:600 10px 'JetBrains Mono',monospace;background:#e8edf2;border-radius:3px;padding:1px 5px;margin:1px 2px 1px 0}
.right{border-left:1px solid #d5dade;background:#fff;overflow:auto;padding:14px 16px}
.det{font:13px/1.5 Inter,sans-serif}
.det h2{margin:0 0 6px;font:700 17px Inter,sans-serif}
.det .kv{display:grid;grid-template-columns:110px 1fr;gap:4px 10px;margin:10px 0}
.det .kv span{color:#5d6670}
.det h2,.det b,.det .kv b{color:#1b1f24;opacity:1;font-weight:600}.det,.det *{letter-spacing:normal}.det .kv span{color:#5d6670;font:13px Inter,sans-serif}
.det .note{background:#f4f6f8;border-radius:6px;padding:8px 10px;font-size:12px;color:#33404d}
.empty{color:#5d6670;font:13px Inter,sans-serif}
.cap{position:absolute;left:350px;right:360px;bottom:16px;padding:10px 14px;background:rgba(27,31,36,.9);color:#fff;border-radius:6px;font:600 15px Inter,sans-serif;display:none}
#app.ar .sp{direction:rtl}#app.ar td,#app.ar th{text-align:right}#app.ar td.n{text-align:left}
#app.ar,#app.ar *{font-family:Tahoma,'Segoe UI','Noto Sans Arabic',Arial,sans-serif!important;letter-spacing:0!important}
`;

function boot() {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  document.title = 'Melting Spare Parts';
  const app = document.getElementById('app');
  const st = {sec: null, mach: null, type: null, shared: false, q: '', sort: 'item', dir: 1, sel: null};
  app.innerHTML = `<div class="sp">
    <header><div><h1>Melting system · spare parts</h1><div class="sub">Insertec CE-2019-019.2 · CMR-1993-001.2 · 07/10/2020 · E1982–E1991</div></div>
      <div class="kpi"><div><b data-k="n"></b><span>Items shown</span></div><div><b data-k="v"></b><span>Value shown</span></div><div><b data-k="c"></b><span>Critical</span></div><div><b>${eur(DOC_TOTAL)}</b><span>List total</span></div></div>
      <button class="langsw" data-lang="1"><span data-l="en">EN</span><span data-l="ar">عربي</span></button></header>
    <aside class="left"><h3>SYSTEMS · VALUE</h3><div class="secs"></div>
      <h3>MACHINE</h3><div class="chips mach"></div><h3>TYPE</h3><div class="chips typ"></div>
      <h3>SHARED</h3><div class="chips shr"><button class="chip" data-shared="1">Shared between machines</button></div></aside>
    <main class="mid"><div class="bar"><input placeholder="Search part, drawing or mark…" data-q="1"><span class="cnt"></span></div>
      <div class="tbl"><table><thead><tr>${[['item', 'Item'], ['qty', 'Qty'], ['desc', 'Description'], ['unit', 'Unit €'], ['total', 'Total €'], ['type', 'Type'], ['drawing', 'Drawing'], ['machines', 'Serves']].map(([k, l]) => `<th data-sort="${k}">${l}</th>`).join('')}</tr></thead><tbody></tbody></table></div></main>
    <aside class="right"><h3>PART</h3><div class="det"><p class="empty">Select a part to see its details.</p></div></aside>
  </div><div class="cap"></div>`;
  const $ = (q) => app.querySelector(q);
  const secTot = Object.fromEntries(SEC.map(([k]) => [k, ITEMS.filter((i) => i.sec === k).reduce((a, i) => a + i.total, 0)]));
  const maxSec = Math.max(...Object.values(secTot));
  $('.secs').innerHTML = SEC.map(([k, n]) => `<div class="sec" data-sec="${k}"><b>${n}</b><em>${eur(secTot[k])}</em><i><s style="width:${(secTot[k] / maxSec) * 100}%"></s></i></div>`).join('');
  $('.mach').innerHTML = MACH.map(([m]) => `<button class="chip" data-mach="${m}">${m}</button>`).join('');
  $('.typ').innerHTML = [['CRITICAL', 'Critical'], ['CONSUMABLE', 'Consumable']].map(([k, l]) => `<button class="chip" data-type="${k}">${l}</button>`).join('');

  const rows = () => {
    const q = st.q.trim().toLowerCase();
    let r = ITEMS.filter((i) => (!st.sec || i.sec === st.sec) && (!st.mach || i.machines.includes(st.mach)) && (!st.type || i.type.includes(st.type)) && (!st.shared || i.shared) && (!q || `${i.desc} ${i.drawing} ${i.mark} ${i.system} ${i.group || ''} ${i.item}`.toLowerCase().includes(q)));
    const k = st.sort;
    r = r.slice().sort((a, b) => (k === 'desc' || k === 'type' || k === 'drawing' ? String(a[k]).localeCompare(String(b[k])) : k === 'machines' ? a.machines.length - b.machines.length : a[k] - b[k]) * st.dir);
    return r;
  };
  const tyCls = (ty) => (ty.includes('/') ? 'b' : ty === 'CONSUMABLE' ? 'u' : 'c');
  function render() {
    const r = rows();
    $('tbody').innerHTML = r
      .map((i) => `<tr data-i="${i.item}" class="${st.sel === i.item ? 'on' : ''}"><td class="n">${i.item}</td><td class="n">${i.qty}</td><td>${esc(i.desc)}${i.group ? `<br><small style="color:#5d6670">${esc(i.group)}</small>` : ''}</td><td class="n">${eur(i.unit)}</td><td class="n">${eur(i.total)}</td><td>${i.type ? `<span class="ty ${tyCls(i.type)}">${t(i.type)}</span>` : ''}</td><td>${esc(i.drawing)}${i.mark ? ` · ${esc(i.mark)}` : ''}</td><td>${i.machines.map((m) => `<span class="mtag">${m}</span>`).join('')}</td></tr>`)
      .join('');
    const v = r.reduce((a, i) => a + i.total, 0);
    app.querySelector('[data-k=n]').textContent = r.length;
    app.querySelector('[data-k=v]').textContent = eur(v);
    app.querySelector('[data-k=c]').textContent = r.filter((i) => i.type.startsWith('CRITICAL')).length;
    $('.cnt').textContent = `${r.length} / ${ITEMS.length}`;
    app.querySelectorAll('[data-sec]').forEach((e) => e.classList.toggle('on', e.dataset.sec === st.sec));
    app.querySelectorAll('[data-mach]').forEach((e) => e.classList.toggle('on', e.dataset.mach === st.mach));
    app.querySelectorAll('[data-type]').forEach((e) => e.classList.toggle('on', e.dataset.type === st.type));
    app.querySelector('[data-shared]').classList.toggle('on', st.shared);
    const it = ITEMS.find((x) => x.item === st.sel);
    $('.det').innerHTML = it
      ? `<h2>${esc(it.desc)}</h2>${it.type ? `<span class="ty ${tyCls(it.type)}">${t(it.type)}</span>` : ''}
        <div class="kv"><span>${t('Item')}</span><b>${it.item}</b><span>${t('Quantity')}</span><b>${it.qty}</b><span>${t('Unit price')}</span><b>${eur(it.unit)}</b><span>${t('Total')}</span><b>${eur(it.total)}</b>
        <span>${t('System')}</span><b>${esc(SEC.find((x) => x[0] === it.sec)[1])} · ${esc(it.system)}</b>${it.group ? `<span>${t('Group')}</span><b>${esc(it.group)}</b>` : ''}
        <span>${t('Drawing')}</span><b>${esc(it.drawing) || '—'}</b><span>${t('Mark')}</span><b>${esc(it.mark) || '—'}</b><span>${t('Serves')}</span><b>${it.machines.map((m) => `<span class="mtag">${m}</span>`).join('') || '—'}</b></div>
        ${it.common ? `<p class="note">${esc(it.common)}</p>` : ''}`
      : `<p class="empty">${t('Select a part to see its details.')}</p>`;
  }
  app.addEventListener('click', (e) => {
    const g = (a) => e.target.closest(`[${a}]`);
    let x;
    if ((x = g('data-lang'))) return applyLang(getLang() === 'ar' ? 'en' : 'ar');
    if ((x = g('data-sec'))) st.sec = st.sec === x.dataset.sec ? null : x.dataset.sec;
    else if ((x = g('data-mach'))) st.mach = st.mach === x.dataset.mach ? null : x.dataset.mach;
    else if ((x = g('data-type'))) st.type = st.type === x.dataset.type ? null : x.dataset.type;
    else if ((x = g('data-shared'))) st.shared = !st.shared;
    else if ((x = g('data-sort'))) {
      st.dir = st.sort === x.dataset.sort ? -st.dir : x.dataset.sort === 'total' || x.dataset.sort === 'unit' ? -1 : 1;
      st.sort = x.dataset.sort;
    } else if ((x = g('data-i'))) st.sel = Number(x.dataset.i);
    else return;
    render();
  });
  $('[data-q]').addEventListener('input', (e) => {
    st.q = e.target.value;
    render();
  });
  function applyLang(l) {
    setLang(l);
    app.classList.toggle('ar', getLang() === 'ar');
    translateTree(app);
    app.querySelectorAll('[data-l]').forEach((b) => b.classList.toggle('on', b.dataset.l === getLang()));
    $('[data-q]').placeholder = t('Search part, drawing or mark…');
    render();
    translateTree(app.querySelector('.det'));
  }
  applyLang(getLang());

  // the 20 s walkthrough for the video
  const FILM = [
    [0, 'Insertec spare-parts list for the melting system: 176 items, 228,148 € over 11 systems.', () => Object.assign(st, {sec: null, mach: null, type: null, shared: false, q: '', sel: null, sort: 'item', dir: 1})],
    [3, 'Value by system: HA#1 and the transfer pump carry most of it.', () => Object.assign(st, {sort: 'total', dir: -1})],
    [6, 'Pick a machine: the parts HC#1 can use, including those shared with HA#1.', () => Object.assign(st, {mach: 'HC#1'})],
    [9.5, 'Critical parts only.', () => Object.assign(st, {type: 'CRITICAL'})],
    [12, 'Search: thermocouple.', () => Object.assign(st, {mach: null, type: null, q: 'thermocouple', sort: 'item', dir: 1})],
    [14.5, 'Open a part: drawing, mark, price and every machine it serves.', () => Object.assign(st, {sel: 26})],
    [17, 'Shared parts: one spare covers several furnaces.', () => Object.assign(st, {q: '', shared: true, sel: 141, sort: 'total', dir: -1})],
  ];
  const cap = $('.cap');
  let fi = 0;
  let ft = 0;
  window.SIM = {
    advance(dt) {
      ft += dt;
      while (fi < FILM.length && ft >= FILM[fi][0]) {
        FILM[fi][2]();
        cap.style.display = 'block';
        cap.textContent = t(FILM[fi][1]);
        $('[data-q]').value = st.q;
        render();
        fi++;
      }
    },
    st,
  };
  if (location.hash === '#film') SIM.advance(0);
}
boot();
