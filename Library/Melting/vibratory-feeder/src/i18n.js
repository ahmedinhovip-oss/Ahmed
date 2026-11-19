// English / Arabic for the whole page. Markup is written in English; translateTree() swaps every text node (and
// title/aria-label) through the AR dictionary and can swap back, because each node keeps its English original.
// Values the HMI refreshes go through t() as they are written. Tags (70Y1, 110Y2, 75BCU1), units and numbers stay
// as they are on the real panel.
import {AR, AR_RE} from './i18n-ar.js';

let lang = 'en';
try {
  lang = localStorage.getItem('lib-lang') === 'ar' ? 'ar' : 'en';
} catch (e) {
  /* storage blocked: start in English */
}
// the recorded film is always in English
if (location.hash === '#film') lang = 'en';

export const getLang = () => lang;
export function setLang(l) {
  lang = l === 'ar' ? 'ar' : 'en';
  try {
    localStorage.setItem('lib-lang', lang);
  } catch (e) {
    /* keep it for this visit only */
  }
}

// panel tags (201SH3, 20Q1, HC#1, 208S1) mix digits and letters: keep each one a single left-to-right run in Arabic
const TAG = /(?<![\w#])(?=[\w#]*\d)(?=[\w#]*[A-Za-z])[\w#]+/g;
const iso = (x) => x.replace(TAG, (m) => '\u2066' + m + '\u2069');
function lookup(k) {
  if (AR[k] !== undefined) return iso(AR[k]);
  for (const [re, rep] of AR_RE) if (re.test(k)) return iso(k.replace(re, rep));
  return null;
}

// one string: English in, the current language out
export function t(s) {
  if (lang !== 'ar' || s == null || s === '') return s;
  const k = String(s).trim();
  const tr = lookup(k);
  return tr == null ? s : String(s).replace(k, tr);
}

export function translateTree(root) {
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const p = n.parentNode;
    if (p && (p.nodeName === 'SCRIPT' || p.nodeName === 'STYLE')) continue;
    if (n.__en === undefined) n.__en = n.nodeValue;
    const k = n.__en.trim();
    if (!k) continue;
    const tr = lang === 'ar' ? lookup(k) : null;
    n.nodeValue = tr == null ? n.__en : n.__en.replace(k, tr);
  }
  for (const el of root.querySelectorAll('[title],[aria-label]')) {
    for (const a of ['title', 'aria-label']) {
      if (!el.hasAttribute(a)) continue;
      const key = 'en' + a.replace('-', '');
      if (el.dataset[key] === undefined) el.dataset[key] = el.getAttribute(a);
      const tr = lang === 'ar' ? lookup(el.dataset[key]) : null;
      el.setAttribute(a, tr == null ? el.dataset[key] : tr);
    }
  }
}
