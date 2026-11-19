// MINI launder transfer pump (Molten Metal Equipment Innovations, MINI-902L-22ABL0, "6 in longer than standard"),
// used at Synergies Oman: the plant model. Built from the assembly drawing (3 sheets): the 14-item bill of
// materials, the length table (T / S / N / L) and the dimensions. A 4 HP 1000 rpm 400 V 50 Hz motor on a steel motor
// mount and star ring drives a 3 in shaft through a solid coupling; the 7 in hook rotor turns in the snouted base,
// which sits on the well floor between three posts and pushes metal out of its snout into the riser and the launder.
//
// [M] = from the drawing. [A] = an assumption the drawing does not give (no operating data in it); all sit in P.

export const P = {
  hp: 4, rpm: 1000, volts: 400, hz: 50, frame: '215TC', // [M] motor ELEC-MTBD-B041021
  shaftIn: 3, rotorIn: 7, //  [M] 3 in shaft, 7 in hook rotor
  A: 1861, B: 1038, C: 1102, // mm [M] L version (N 1708/886/949, S 1556/733/797, T 1403/581/645)
  weight: 250, //             [M] L version (lb)
  base: [457, 356], mount: 406, coupOffset: 162, // mm [M]
  fla: 5.8, //                A  full-load current of a 4 HP 400 V motor [A]
  i0: 2.6, //                 A  current turning in the metal at no flow [A]
  qMax: 1.0, //               t/min at 1000 rpm and no head [A]
  hShut: 1.1, //              m  shut-off head at 1000 rpm [A]
  lip: 1.25, //               m  riser lip above the well floor [A]
  tonsPerM: 50, //            t of metal per metre of bath height in the furnace [A]
  minSub: 0.25, //            m  metal above the top of the base, minimum (HC01's pump minimum level setting is 250 mm) [A]
  baseTop: 0.2, //            m  [A]
  preheatC: 500, //           °C pump temperature before immersion [A]
  preheatRate: 18, //         °C/min above the bath [A]
  bathT: 740, //              °C [A]
  drossRate: 0.5, //          % flow loss per hour of running [A]
  hzMax: 50,
};

// the bill of materials [M] and the assembly order [A, following the exploded view]
export const PARTS = {
  base: {no: 1, pn: 'MINI-002A', name: 'MINI-HF snouted standard base', qty: 1},
  posts: {no: 2, pn: 'MINI-201L-R', name: 'Standard MINI post assembly', qty: 3},
  shaft: {no: 3, pn: 'MINI-102L-R', name: 'MINI-HF shaft assembly, 3 in dia.', qty: 1},
  rotor: {no: 4, pn: 'MINI-122A', name: 'MINI 7 in hook rotor assembly', qty: 1},
  mount: {no: 5, pn: 'MINI-300C', name: 'Motor mount steel assembly', qty: 1},
  motor: {no: 6, pn: 'ELEC-MTBD-B041021', name: 'Motor 4 HP / 1000 rpm / 3 ph / 50 Hz / 400 V / 215TC', qty: 1},
  bail: {no: 7, pn: 'HDWR-STRS-21MTBD', name: 'Bail, 210TC motor strap, side mount', qty: 1},
  star: {no: 8, pn: 'MINI-302C-21', name: 'Star ring 210TC / 250TC', qty: 1},
  coupling: {no: 9, pn: 'MINI-346D', name: 'MINI 3 in solid coupling assembly', qty: 1},
};
export const STEPS = [
  ['posts', 'posts', 'Three posts (2) into the snouted base (1)', ''],
  ['shaft', 'shaft', 'Shaft assembly (3) down through the base', ''],
  ['rotor', 'rotor', 'Hook rotor (4) onto the shaft, inside the base', ''],
  ['mount', 'mount', 'Motor mount (5) on the posts', '4 × 1/2"-13 × 1 3/4" hex bolts (13) + 1/2" lock washers (10)'],
  ['coupling', 'coupling', 'Solid coupling (9) on the shaft, 162 mm offset distance', ''],
  ['star', 'star', 'Star ring (8) on the motor mount', '4 × 1/2"-13 × 1 1/2" hex bolts (12) + 1/2" lock washers (10)'],
  ['motor', 'motor', 'Motor (6) into the coupling, on the star ring', '4 × 3/8"-16 × 1 3/4" hex bolts (14) + 3/8" lock washers (11)'],
  ['bail', 'bail', 'Bail (7) strapped to the motor for lifting', ''],
];
export const ORDER = STEPS.map((x) => x[0]);

export const ALARMS = {
  1: 'MOTOR OVERLOAD TRIP',
  2: 'METAL LEVEL BELOW PUMP MINIMUM · AIR DRAWN IN',
  3: 'PUMP NOT PREHEATED',
  4: 'ROTOR JAMMED',
  5: 'COUPLING VIBRATION',
  6: 'EMERGENCY STOP PRESSED',
  7: 'PUMP CRACKED · THERMAL SHOCK',
  8: 'FLOW LOW · DROSS IN THE BASE',
};
export const FAULTS = {
  none: 'No fault',
  dross: 'Dross building up in the base',
  jam: 'Solid piece jams the rotor',
  coupling: 'Coupling loose / misaligned',
  lowLevel: 'Furnace nearly empty',
};

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const approach = (x, t, r, dt) => (x < t ? Math.min(t, x + r * dt) : Math.max(t, x - r * dt));

export function createPlant(scenario = 'bench') {
  const assembled = scenario !== 'bench';
  const asm = {};
  for (const k of ORDER) asm[k] = assembled;
  return {
    t: 0,
    asm,
    pos: scenario === 'run' ? 'well' : 'stand', // stand | preheat | well
    hoist: scenario === 'run' ? 0 : 1, // 0 in the well, 0.6 over the bath (preheat), 1 on the stand
    power: true,
    estop: false,
    run: scenario === 'run',
    hz: scenario === 'run' ? 45 : 0,
    hzSet: scenario === 'run' ? 45 : 0,
    rpm: scenario === 'run' ? 900 : 0,
    tripped: false,
    pumpT: scenario === 'run' ? P.bathT : 30,
    preheatMin: scenario === 'run' ? 30 : 0,
    level: 0.9, // m of metal above the well floor
    q: 0, // t/min
    moved: 0, // t
    amps: 0,
    dross: 0, // % flow lost
    cracked: false,
    vib: 0,
    exploded: 0,
    lastWrong: null,
    steps: {},
    alarms: [],
    events: [],
    log: [],
    fault: 'none',
  };
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

export const assembled = (s) => ORDER.every((k) => s.asm[k]);
export function head(s) {
  return Math.max(0, P.lip - s.level);
}

export const cmd = {
  fit(s, k) {
    if (s.pos !== 'stand') return note(s, 'Bring the pump to the maintenance stand first');
    if (s.asm[k]) return;
    const i = ORDER.indexOf(k);
    const missing = ORDER.slice(0, i).filter((x) => !s.asm[x]);
    if (missing.length) {
      s.lastWrong = k;
      return event(s, 'bad', `Out of order: (${PARTS[missing[0]].no}) ${PARTS[missing[0]].name} goes on before (${PARTS[k].no}) ${PARTS[k].name}`);
    }
    s.asm[k] = true;
    note(s, `Fitted: (${PARTS[k].no}) ${PARTS[k].name}`);
  },
  remove(s, k) {
    if (s.pos !== 'stand') return note(s, 'Bring the pump to the maintenance stand first');
    if (!s.asm[k]) return;
    const i = ORDER.indexOf(k);
    const above = ORDER.slice(i + 1).filter((x) => s.asm[x]);
    if (above.length) return event(s, 'bad', `Out of order: (${PARTS[above[above.length - 1]].no}) ${PARTS[above[above.length - 1]].name} comes off first`);
    s.asm[k] = false;
    if (k === 'rotor' || k === 'shaft') {
      s.cracked = false;
      s.dross = 0;
    }
    note(s, `Removed: (${PARTS[k].no}) ${PARTS[k].name}`);
  },
  disassembleAll(s) {
    for (const k of [...ORDER].reverse()) cmd.remove(s, k);
  },
  clean(s) {
    if (s.pos !== 'stand') return note(s, 'Lift the pump out onto the stand to clean it');
    s.dross = 0;
    note(s, 'Base and rotor cleaned of dross; rotor and shaft inspected');
    s.steps.clean = true;
  },
  move(s, where) {
    if (s.run) return note(s, 'Stop the pump before moving it');
    if (where !== 'stand' && !assembled(s)) return note(s, 'Assemble the pump completely before lifting it to the furnace');
    if (where === 'well' && s.pumpT < P.preheatC) {
      event(s, 'bad', 'Pump immersed without preheating: thermal shock cracks the rotor and the posts');
      s.cracked = true;
    }
    s.pos = where;
  },
  start(s) {
    if (s.estop) return note(s, 'Release the emergency stop first');
    if (s.tripped) return note(s, 'Overload tripped: find the cause and reset');
    if (!assembled(s)) return note(s, 'The pump is not assembled');
    if (s.pos !== 'well' || s.hoist > 0.02) {
      event(s, 'bad', 'Pump started out of the metal: the rotor runs dry');
    }
    if (s.hzSet > 25) event(s, 'warn', 'Started at high speed: ramp up from low speed [A]');
    s.run = true;
  },
  stop(s) {
    s.run = false;
  },
  reset(s) {
    if (s.fault === 'jam') return note(s, 'Still jammed: lift the pump out and clear the base');
    s.tripped = false;
  },
  estop(s, on) {
    s.estop = on;
    if (on) s.run = false;
  },
  hz(s, v) {
    s.hzSet = clamp(Math.round(v), 0, P.hzMax);
  },
  setFault(s, f) {
    s.fault = f;
    if (f === 'lowLevel') s.level = Math.min(s.level, P.baseTop + P.minSub + 0.03);
    if (f === 'jam' && s.pos === 'stand') s.fault = 'none';
  },
};

export function step(s, dt) {
  const n = Math.max(1, Math.ceil(dt / 0.1));
  for (let i = 0; i < n; i++) sub(s, dt / n);
}

function sub(s, dt) {
  s.t += dt;
  const target = {stand: 1, preheat: 0.6, well: 0}[s.pos];
  s.hoist = approach(s.hoist, target, 0.12, dt);
  s.exploded = approach(s.exploded, assembled(s) ? 0 : 1, 1, dt);
  const inMetal = s.hoist < 0.02 && s.pos === 'well';
  // temperature of the pump: preheated over the bath, hot in the metal, cools on the stand [A]
  if (s.pos === 'preheat' && s.hoist < 0.62) {
    s.pumpT = Math.min(P.bathT - 120, s.pumpT + (P.preheatRate * dt) / 60);
    s.preheatMin += dt / 60;
  } else if (inMetal) s.pumpT = approach(s.pumpT, P.bathT, 5, dt);
  else if (s.pos === 'stand') s.pumpT = approach(s.pumpT, 30, 0.2, dt);
  // drive
  const runOK = s.run && !s.estop && !s.tripped;
  s.hz = approach(s.hz, runOK ? s.hzSet : 0, 10, dt); // VFD ramp 5 s to 50 Hz [A]
  let rpm = (P.rpm * s.hz) / P.hz;
  if (s.fault === 'jam' && inMetal && runOK) rpm = 0;
  s.rpm = approach(s.rpm, rpm, 600, dt);
  // flow: pump curve against the lift from the bath to the riser lip [A]
  const k = s.rpm / P.rpm;
  const subm = s.level - P.baseTop;
  const low = subm < P.minSub;
  let q = 0;
  if (inMetal && s.rpm > 1 && subm > 0.05) {
    const h = head(s);
    const hs = P.hShut * k * k;
    q = h < hs ? P.qMax * k * Math.sqrt(1 - h / hs) : 0;
    q *= 1 - s.dross / 100;
    if (s.cracked) q *= 0.6;
    if (low) q *= 0.55 + 0.25 * Math.sin(s.t * 3); // air drawn in: the flow surges
  }
  s.q = approach(s.q, Math.max(0, q), 1, dt);
  s.moved += (s.q * dt) / 60;
  s.level = Math.max(P.baseTop + 0.02, s.level - (s.q * dt) / 60 / P.tonsPerM);
  // current [A]
  const load = inMetal ? 1 : 0.15;
  let amps = s.rpm > 1 ? P.i0 * 0.6 + (P.i0 * 0.4 + 2.6 * load) * k * k * k * (1 + s.dross / 60) : 0;
  if (s.fault === 'jam' && inMetal && runOK) amps = P.fla * 5;
  s.amps = approach(s.amps, amps, 20, dt);
  if (s.amps > P.fla * 1.15 && runOK) {
    s.overT = (s.overT || 0) + dt;
    if (s.overT > 2) {
      s.tripped = true;
      s.run = false;
      raise(s, 1);
      if (s.fault === 'jam') event(s, 'bad', 'Rotor jammed: the motor tripped on overload. Never force it: the shaft breaks');
    }
  } else s.overT = 0;
  // dross builds up while running [A]
  if (inMetal && s.rpm > 1) s.dross = Math.min(60, s.dross + ((s.fault === 'dross' ? 40 : P.drossRate) * dt) / 3600);
  s.vib = s.fault === 'coupling' && s.rpm > 50 ? 3 + 4 * k : s.rpm > 50 ? 0.5 * k : 0;
  if (s.fault === 'coupling' && s.rpm > 300) event(s, 'warn', 'Vibration at the motor: check the coupling and the 162 mm offset distance');
  if (inMetal && low && s.rpm > 1) event(s, 'bad', 'Metal level below the pump minimum: air is drawn in, oxides go to the launder');
  if (s.run && !inMetal && s.rpm > 50) event(s, 'bad', 'Rotor running dry out of the metal');
  // procedure [A]
  const S = s.steps;
  if (assembled(s)) S.asm = true;
  if (s.pos === 'preheat' && s.pumpT >= P.preheatC) S.preheat = true;
  if (inMetal && !s.cracked) S.immerse = true;
  if (inMetal && s.run && s.hzSet <= 25 && s.rpm > 50) S.slow = true;
  if (S.slow && s.q > 0.3) S.flow = true;
  if (s.moved > 0.5 && !low) S.level = true;
  // alarms
  cond(s, 1, s.tripped);
  cond(s, 2, inMetal && low);
  cond(s, 3, s.pos === 'preheat' && s.pumpT < P.preheatC);
  cond(s, 4, s.fault === 'jam' && inMetal && s.run);
  cond(s, 5, s.vib > 2.5);
  cond(s, 6, s.estop);
  cond(s, 7, s.cracked);
  cond(s, 8, s.dross > 15);
}
