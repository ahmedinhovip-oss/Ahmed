// English / Arabic. The markup is written in English; t() gives the current language. Team texts (names, roles,
// duties) carry their own *_ar fields in team.json; pick() chooses between them.
import {AR} from './i18n-ar.js';

let lang = 'en';
try {
  lang = localStorage.getItem('lib-lang') === 'ar' ? 'ar' : 'en';
} catch (e) {
  /* storage blocked: start in English */
}
export const getLang = () => lang;
export function setLang(l) {
  lang = l === 'ar' ? 'ar' : 'en';
  try {
    localStorage.setItem('lib-lang', lang);
  } catch (e) {
    /* keep it for this visit only */
  }
}
export function t(s) {
  if (lang !== 'ar' || s == null) return s;
  return AR[s] ?? s;
}
// obj.key in English, obj.key_ar in Arabic
export const pick = (o, k) => (lang === 'ar' && o[k + '_ar'] != null ? o[k + '_ar'] : o[k]);

// translate every element marked data-t (its English text is kept in the attribute)
export function translateTree(root) {
  for (const el of root.querySelectorAll('[data-t]')) el.textContent = t(el.dataset.t);
  for (const el of root.querySelectorAll('[data-title]')) el.title = t(el.dataset.title);
}
