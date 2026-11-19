// Motorised vibratory feeder (Electro Magnetic Industries, for Synergies Castings), the feeder of the magnetic
// separator line: the plant model. Built from the Installation, Operation and Maintenance Manual. Two unbalance
// vibratory motors, driven from a common starter and turning in opposite directions, give a straight-line throw
// along the drive line; the eccentric weights (percentage marks) set the force, amplitude and conveying speed.
//
// [M] = from the manual. [A] = an assumption the manual does not give; all of them sit in P.

export const P = {
  width: 0.5, length: 2.0, //  m trough [M] 500 mm W x 2000 mm L
  motorHP: 0.5, rpm: 1440, //  [M] each motor
  volts: 415, //               [M] 3 ph 50 Hz
  ampMax: 3.0, //              [A] mm stroke at 100 % on both motors
  vPerMm: 9, //                [A] m/min conveying speed per mm of stroke (throw angle ~30°)
  bulk: 0.25, //               [A] t/m³ loose aluminium chips / turnings
  flA: 0.95, //                [A] A full-load current per motor
  ironShare: 0.012, //         [A] share of ferrous pieces in the scrap
  magnetEff: 0.96, //          [A] pick-up of the overband magnet when it is running
  crackLimit: 100, //          damage units before a motor foot cracks
};

export const ALARMS = {
  1: 'MOTOR 1 OVERLOAD TRIP',
  2: 'MOTOR 2 OVERLOAD TRIP',
  3: 'MOTORS TURNING THE SAME WAY · NO STRAIGHT THROW',
  4: 'UNEQUAL ECCENTRIC SETTINGS · TRANSVERSE FORCE',
  5: 'MOTOR FOOT CRACKED',
  6: 'MATERIAL BRIDGING AT THE BIN OPENING',
  7: 'TROUGH NOT SEATED ON ITS SPRINGS',
  8: 'MAGNETIC SEPARATOR OFF · IRON PASSING',
  9: 'EMERGENCY STOP PRESSED',
};

export const FAULTS = {
  none: 'No fault',
  m2trip: 'Motor 2 overload trips',
  sameDir: 'Motor 2 rewired: same direction as motor 1',
  spring: 'A spring out of its seat',
  bolts: 'Trough bolts loose',
  bigScrap: 'Oversize scrap (300 mm pieces)',
};

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const approach = (x, tgt, rate, dt) => (x < tgt ? Math.min(tgt, x + rate * dt) : Math.max(tgt, x - rate * dt));

export function createPlant(scenario = 'ready') {
  const ok = scenario !== 'install';
  return {
    t: 0,
    supply: true, // 415 V at the common starter
    run: false,
    estop: false,
    // eccentric weight settings, % of maximum force, inner and outer weight of each motor [M]
    ecc: ok ? [[60, 60], [60, 60]] : [[50, 70], [80, 80]],
    dir: ok ? [1, -1] : [1, 1], // rotation; opposite is correct [M]
    tripped: [false, false],
    springs: ok,
    // the 'install' scenario: as unpacked, nothing checked, one spring unseated, bolts loose, both motors wired the same way
    bolts: ok,
    checks: ok ? {supply: true, conns: true, bolts: true, springs: true, rotation: true} : {},
    // bin opening above the trough inlet [M rules]
    openV: 150, // mm vertical
    openH: 100, // mm horizontal (gate height above the trough = bed depth limit)
    particle: 50, // mm largest piece
    magnet: true,
    // motion
    rpm: [0, 0],
    amp: 0, // mm stroke along the drive line
    trans: 0, // mm transverse / rocking component
    speed: 0, // m/min conveying speed
    feed: 0, // t/h
    fed: 0, // t delivered
    iron: 0, // kg removed by the magnet
    ironPassed: 0, // kg of iron passing to the furnace
    damage: 0,
    cracked: false,
    bridging: false,
    phase: [0, 0],
    alarms: [],
    events: [],
    log: [],
    fault: 'none',
  };
}

export function signals(s) {
  const f = s.ecc.map((m) => (m[0] + m[1]) / 2);
  const sideDiff = s.ecc.map((m) => Math.abs(m[0] - m[1]));
  const live = s.rpm.map((r) => r / P.rpm);
  const opposite = s.dir[0] !== s.dir[1];
  // the two forces add along the drive line when the motors turn opposite ways; across it they cancel
  const k0 = (f[0] / 100) * live[0];
  const k1 = (f[1] / 100) * live[1];
  const line = opposite ? (k0 + k1) / 2 : Math.min(k0, k1) * 0.15;
  const across = opposite ? Math.abs(k0 - k1) / 2 : (k0 + k1) / 2;
  const minOpenH = 2 * s.particle; // [M] horizontal opening ≥ 2 × largest particle
  const minOpenV = 2 * s.particle; // [M] vertical opening 2–3 × largest particle
  const bedDepth = Math.min(s.openH, 120) / 1000; // m
  return {f, sideDiff, opposite, line, across, minOpenH, minOpenV, bedDepth, unequal: Math.abs(f[0] - f[1]) > 0.5 || sideDiff.some((d) => d > 0.5)};
}

function raise(s, no) {
  if (s.alarms.find((a) => a.no === no && a.active)) return;
  s.alarms.unshift({no, t: s.t, active: true});
  if (s.alarms.length > 60) s.alarms.length = 60;
}
function cond(s, no, on) {
  if (on) return raise(s, no);
  for (const a of s.alarms) if (a.no === no) a.active = false;
}
function note(s, text) {
  s.log.unshift({t: s.t, text});
  if (s.log.length > 6) s.log.length = 6;
}
function event(s, kind, text) {
  if (s.events.find((e) => e.text === text && s.t - e.t < 60)) return;
  s.events.unshift({t: s.t, kind, text});
  if (s.events.length > 40) s.events.length = 40;
  note(s, text);
}

export const cmd = {
  start(s) {
    if (s.estop) return note(s, 'Release the emergency stop first');
    if (!s.supply) return note(s, 'No 415 V supply at the common starter');
    if (s.cracked) return note(s, 'A motor foot is cracked: repair before running');
    const missing = ['supply', 'conns', 'bolts', 'springs', 'rotation'].filter((k) => !s.checks[k]);
    if (missing.length) event(s, 'warn', 'Started without completing the checks before starting');
    const g = signals(s);
    if (g.unequal) event(s, 'bad', 'Started with unequal eccentric weights: transverse forces can crack the motor body or legs');
    if (!g.opposite) event(s, 'bad', 'Started with both motors turning the same way');
    s.tripped = [false, false];
    s.run = true;
  },
  stop(s) {
    s.run = false;
  },
  estop(s, on) {
    s.estop = on;
    if (on) s.run = false;
  },
  reset(s) {
    if (s.fault !== 'm2trip') s.tripped = [false, false];
    for (const a of s.alarms) if (a.no <= 2) a.active = s.tripped[a.no - 1];
  },
  setEcc(s, m, side, v) {
    if (s.run) event(s, 'bad', 'Eccentric weights adjusted with the motors running');
    s.ecc[m][side] = clamp(Math.round(v / 10) * 10, 0, 100);
  },
  setAllEcc(s, v) {
    if (s.run) event(s, 'bad', 'Eccentric weights adjusted with the motors running');
    const x = clamp(Math.round(v / 10) * 10, 0, 100);
    s.ecc = [[x, x], [x, x]];
  },
  swapDir(s, m) {
    if (s.run) return note(s, 'Stop the feeder before changing the wiring');
    s.dir[m] = -s.dir[m];
  },
  check(s, k) {
    s.checks[k] = true;
    if (k === 'springs' && !s.springs) {
      s.springs = true;
      note(s, 'Trough re-seated on its springs');
    }
    if (k === 'bolts' && !s.bolts) {
      s.bolts = true;
      note(s, 'Trough-to-motor bolts tightened');
    }
    if (k === 'rotation' && s.dir[0] === s.dir[1]) note(s, 'Both motors turn the same way: swap two phases of one motor');
  },
  opening(s, which, v) {
    if (which === 'V') s.openV = clamp(v, 50, 900);
    else s.openH = clamp(v, 30, 700);
  },
  magnet(s, on) {
    s.magnet = on;
  },
  repair(s) {
    if (s.run) return note(s, 'Stop the feeder first');
    s.cracked = false;
    s.damage = 0;
    cond(s, 5, false);
    note(s, 'Motor foot repaired');
  },
  setFault(s, f) {
    s.fault = f;
    if (f === 'sameDir') s.dir[1] = s.dir[0];
    if (f === 'spring') s.springs = false;
    if (f === 'bolts') s.bolts = false;
    if (f === 'bigScrap') s.particle = 300;
    if (f === 'none') {
      if (s.particle === 300) s.particle = 50;
    }
  },
};

export function step(s, dt) {
  const n = Math.max(1, Math.ceil(dt / 0.05));
  for (let i = 0; i < n; i++) sub(s, dt / n);
}

function sub(s, dt) {
  s.t += dt;
  if (s.fault === 'm2trip' && s.run && !s.tripped[1]) {
    s.tripped[1] = true;
    raise(s, 2);
  }
  for (let m = 0; m < 2; m++) {
    const on = s.run && !s.tripped[m] && !s.estop;
    s.rpm[m] = approach(s.rpm[m], on ? P.rpm : 0, on ? 900 : 500, dt);
    s.phase[m] += (s.dir[m] * s.rpm[m] * 2 * Math.PI * dt) / 60;
  }
  const g = signals(s);
  let amp = P.ampMax * g.line;
  let trans = P.ampMax * g.across;
  if (!s.springs) {
    amp *= 0.4;
    trans += P.ampMax * 0.3 * (s.run ? 1 : 0);
  }
  if (!s.bolts) trans += 0.4 * amp;
  s.amp = approach(s.amp, amp, 6, dt);
  s.trans = approach(s.trans, trans, 6, dt);
  s.speed = s.amp * P.vPerMm * (s.springs ? 1 : 0.5);
  // the feed: the bed under the gate moves at the conveying speed, unless the material bridges in the bin
  s.bridging = s.openV < 2 * s.particle || s.openH < 2 * s.particle;
  const feed = s.bridging ? 0 : s.speed * 60 * P.width * g.bedDepth * P.bulk * (s.fault === 'bolts' ? 0.85 : 1);
  s.feed = approach(s.feed, feed, 4, dt);
  const dt_h = dt / 3600;
  const tons = s.feed * dt_h;
  s.fed += tons;
  const fe = tons * 1000 * P.ironShare;
  s.iron += s.magnet ? fe * P.magnetEff : 0;
  s.ironPassed += s.magnet ? fe * (1 - P.magnetEff) : fe;
  // fatigue from transverse forces: a mismatch or the same-way rotation cracks a foot in minutes [A]
  if (s.run && s.trans > 0.25) s.damage += (s.trans - 0.25) * 0.6 * dt;
  if (s.damage >= P.crackLimit && !s.cracked) {
    s.cracked = true;
    s.run = false;
    raise(s, 5);
    event(s, 'bad', 'A motor foot cracked from the transverse forces');
  }
  const running = s.rpm[0] > 50 || s.rpm[1] > 50;
  cond(s, 3, running && !g.opposite);
  cond(s, 4, running && g.unequal);
  cond(s, 6, running && s.bridging);
  cond(s, 7, !s.springs);
  cond(s, 8, running && !s.magnet && s.feed > 0.05);
  cond(s, 9, s.estop);
  if (!s.tripped[0]) cond(s, 1, false);
  if (!s.tripped[1]) cond(s, 2, false);
}
