// Where each person should be at a given office time, and what they are doing there.
// Time is minutes since Sunday 00:00 of a simulated week. Everything is a pure function of time (plus the manual
// override from the buttons), so jumping the clock puts everyone straight in the right place.

export const hm = (s) => {
  const [h, m] = s.split(':').map(Number);
  return h * 60 + m;
};
export const fmt = (min) => {
  const d = Math.floor(min / 1440) % 7;
  const t = ((min % 1440) + 1440) % 1440;
  return {day: d, hh: String(Math.floor(t / 60)).padStart(2, '0'), mm: String(Math.floor(t % 60)).padStart(2, '0')};
};
export const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// small deterministic hash -> [0, 1)
function rnd(...k) {
  let h = 2166136261;
  for (const s of k.join('|')) h = Math.imul(h ^ s.charCodeAt(0), 16777619);
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

export function makePlanner(team) {
  const ids = team.agents.map((a) => a.id);
  const idx = Object.fromEntries(ids.map((id, i) => [id, i]));
  const START = hm(team.hours.start);
  const END = hm(team.hours.end);
  const meetings = team.meetings.map((m) => ({...m, s: hm(m.start), e: hm(m.end)}));
  const breaks = team.breaks.map((b) => ({...b, s: hm(b.start), e: hm(b.end)}));
  const LEAD = 4; // minutes people set off before a meeting starts

  function attendees(m, day) {
    if (m.attendees === 'all') return ids.slice();
    const out = m.attendees.filter((a) => a !== '*rotate3' && idx[a] !== undefined);
    if (m.attendees.includes('*rotate3')) {
      const pool = ids.filter((a) => !out.includes(a));
      for (let k = 0; k < 3 && pool.length; k++) out.push(pool[(day * 3 + k) % pool.length]);
    }
    return [...new Set(out)];
  }

  // seat for a person in a meeting: chairs in agent order, then standing room
  function meetSpot(m, list, id) {
    if (m.place === 'training') {
      if (id === list[0]) return 'train:lead';
      return 'train:' + Math.min(5, list.indexOf(id) - 1);
    }
    if (m.chair === id) return 'meet:head';
    const k = list.filter((x) => x !== m.chair).indexOf(id);
    return k < 9 ? 'meet:' + k : 'meetstand:' + (k - 9);
  }

  // what the override buttons ask for: {kind:'meeting'|'break'|'work', from, to}
  let override = null;
  const setOverride = (o) => (override = o);
  const getOverride = () => override;

  function workday(day) {
    return day >= 0 && day <= 4; // Sun..Thu
  }

  // the meeting or break running at minute-of-day tm for this person (with the walk-over lead time)
  function activeEvent(id, day, tm) {
    for (const m of meetings) {
      if (tm < m.s - LEAD || tm >= m.e) continue;
      const list = attendees(m, day);
      if (list.includes(id)) return {type: 'meeting', m, list};
    }
    for (const b of breaks) if (tm >= b.s - 2 && tm < b.e) return {type: 'break', b};
    return null;
  }

  function plan(id, t) {
    const day = Math.floor(t / 1440) % 7;
    const tm = t - Math.floor(t / 1440) * 1440;
    const i = idx[id];
    const a = team.agents[i];
    const arrive = START - 6 + i * 1.5;
    const leave = END + (i % 4) * 2;
    if (!workday(day) || tm < arrive || tm >= leave) return {spot: 'outside', act: 'Off duty', pose: 'stand', away: true};

    if (override && t >= override.from && t < override.to) {
      if (override.kind === 'meeting') {
        const spot = meetSpot({place: 'meeting', chair: team.owner}, ids, id);
        return {spot, act: 'Team meeting', pose: 'meet', meeting: 'now'};
      }
      if (override.kind === 'break') return {spot: 'cafe:' + i, act: 'Coffee break', pose: 'coffee'};
    }

    const ev = activeEvent(id, day, tm);
    if (ev && ev.type === 'meeting') {
      const spot = meetSpot(ev.m, ev.list, id);
      const lead = spot === 'train:lead';
      return {spot, act: ev.m.name, act_ar: ev.m.name_ar, pose: ev.m.place === 'training' ? (lead ? 'present' : 'listen') : 'meet', meeting: ev.m.id};
    }
    if (ev && ev.type === 'break') return {spot: 'cafe:' + i, act: ev.b.name, act_ar: ev.b.name_ar, pose: 'coffee'};

    // the first minutes of the day and the last hour have fixed work
    const block = Math.floor((tm - START) / 25);
    if (tm >= END - 60) return {spot: 'desk:' + id, act: 'Writing the daily report', pose: 'type'};
    // sometimes go over to a colleague's desk, or take a short think on the sofa
    const r = rnd(id, day, block);
    const inBlock = (tm - START) % 25;
    if (r < 0.16 && inBlock >= 6 && inBlock < 14) {
      const pool = team.agents.filter((x) => x.id !== id && (x.dept === a.dept || x.id === a.reports_to || x.reports_to === a.id));
      const other = (pool.length ? pool : team.agents.filter((x) => x.id !== id))[Math.floor(rnd(id, block, 'w') * (pool.length || ids.length - 1))];
      if (other && !activeEvent(other.id, day, tm)) return {spot: 'visit:' + other.id, act: 'Discussing with ' + other.name, act_ar: 'نقاش مع ' + other.name_ar, pose: 'discuss', with: other.id};
    }
    if (r > 0.93 && inBlock >= 8 && inBlock < 16) return {spot: 'lounge:' + (i % 4), act: 'Thinking break', pose: 'lounge'};
    const k = (block + i) % a.tasks.length;
    return {spot: 'desk:' + id, act: a.tasks[k], act_ar: a.tasks_ar[k], pose: 'type'};
  }

  // what's on now and next, for the agenda panel and the meeting-room screen
  function agenda(t) {
    const day = Math.floor(t / 1440) % 7;
    const tm = t - Math.floor(t / 1440) * 1440;
    const items = [
      ...meetings.map((m) => ({kind: 'meeting', id: m.id, name: m.name, name_ar: m.name_ar, s: m.s, e: m.e, place: m.place, chair: m.chair, list: attendees(m, day), agenda: m.agenda, agenda_ar: m.agenda_ar})),
      ...breaks.map((b) => ({kind: 'break', name: b.name, name_ar: b.name_ar, s: b.s, e: b.e, place: b.place})),
    ].sort((x, y) => x.s - y.s);
    for (const it of items) it.state = !workday(day) ? 'off' : tm >= it.e ? 'done' : tm >= it.s ? 'now' : 'next';
    return {day, tm, items, workday: workday(day)};
  }

  return {plan, agenda, setOverride, getOverride, START, END, workday};
}
