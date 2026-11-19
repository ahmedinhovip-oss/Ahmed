// 2.0 t single girder EOT crane (Safex Industries, machine no. 2199, W.O. 5408, GA SIL-GA-2749 rev 6) for the CNC
// bay of Synergies Castings: the plant model. Built from the review documents: inspection report, history sheet,
// internal inspection (deflection, speed and ampere tests), dimensions report, motor test reports, wire rope and hook
// certificates and the general arrangement drawing. All three motions on VFDs, operated from a pendant on a festoon.
//
// [M] = from the documents. [A] = an assumption the documents do not give; all of them sit in P.

export const P = {
  swl: 2000, //            kg [M] capacity, class M5 medium duty
  span: 22.285, //         m  [M]
  bay: 32.0, //            m  [M] bay length (DSL and LT rails 32 m)
  hol: 4.4, //             m  [M] height of lift
  apDSL: 1.8, apOther: 1.5, // m [M] hook approach DSL side / other side
  wheelbase: 3.2, //       m  [M]
  endCarriage: 4.0, //     m  [M] end carriage overall length
  falls: 4, //             [M]
  // speeds, m/min: required fast / slow [M]; the model runs at the measured fast speeds of the speed test [M]
  vReq: {ho: 4.0, ct: 15.0, lt: 20.0},
  vMeas: {ho: 4.01, ct: 14.01, lt: 20.4},
  slow: 0.1, //            [M] slow speed = 1/10 of fast (4.0/0.4, 15/1.5, 20/2.0)
  ramp: {ho: 1.0, ct: 2.0, lt: 3.0}, // s VFD acceleration time to fast speed [A]
  // motors [M]
  kw: {ho: 2.2, ct: 0.55, lt: 0.75},
  rpm: {ho: 1445, ct: 1425, lt: 1445},
  flc: {ho: 4.8, ct: 1.52, lt: 2.05},
  ratio: {ho: 120, ct: 41, lt: 41.72}, // gearboxes [M]
  drum: 0.209, //          m  [M] rope drum Ø 209, pitch 9.5, length 700
  ctWheel: 0.13, //        m  [M] CT wheel tread Ø 130
  ltWheel: 0.2, //         m  [M] LT wheel Ø 200
  rope: {d: 8, mbf: 45.0, broke: 52.4}, // mm, kN [M] 6x36 IWRC 1960, min breaking force, tested
  hookProof: 6000, //      kg [M] C-hook proof load (SWL 3 t)
  // ampere test [M]: hoist up / down and CT at 2000 kg, LT no load; no-load hoist current from the motor test [M]
  amp: {hoUp: 3.78, hoDn: 3.17, ho0: 3.22, ct: 1.07, ct0: 0.97, lt0: 1.2},
  ltLoaded: 0.12, //       A  extra LT current at 2000 kg [A]
  ct0Loss: 0.04, //        A  CT to/fro difference [M 1.07 / 1.03]
  // girder deflection [M]: 13.0 mm at 2000 kg (trolley at mid span); permissible span/900 = 24.76 mm
  defl: 13.0,
  deflMax: 22.285 * 1000 / 900,
  overload: 1.1, //        overload device trips hoisting above 110 % SWL [A]
  testLoad: 2500, //       kg [M] overload test load (125 %)
  hold: 10, //             s  hold time counted as a passed load test in the simulator [A]
  creep: 0.02, //          m/s hook creep with a worn brake under load [A]
  rail: 5.9, //            m  top of LT rail above the floor [A, read from the GA]
};
export const CT_MIN = P.apDSL;
export const CT_MAX = P.span - P.apOther;
export const LT_MIN = P.endCarriage / 2 + 0.3; // end stoppers [A]
export const LT_MAX = P.bay - P.endCarriage / 2 - 0.3;

export const LOADS = [
  [0, 'No load'],
  [450, 'CNC spindle (≈ 450 kg)'],
  [1000, 'Test weight 1000 kg'],
  [2000, 'Test weight 2000 kg (SWL)'],
  [2500, 'Test weight 2500 kg (overload test)'],
  [3000, 'Load 3000 kg (over capacity)'],
];

// height from the hook to the bottom of each load on its slings, m [A]: the load leaves the floor above it
export const RIG = {0: 0, 450: 1.32, 1000: 1.28, 2000: 1.38, 2500: 1.42, 3000: 1.45};

export const ALARMS = {
  1: 'OVERLOAD · HOISTING UP BLOCKED',
  2: 'HOIST UPPER LIMIT',
  3: 'HOIST LOWER LIMIT',
  4: 'CROSS TRAVEL END LIMIT',
  5: 'LONG TRAVEL END LIMIT',
  6: 'HOOK CREEPING DOWN · CHECK HOIST BRAKE',
  7: 'LT MOTOR 2 TRIPPED · BRIDGE SKEWING',
  8: 'NO POWER ON THE DSL',
  9: 'EMERGENCY STOP PRESSED',
  10: 'ROPE DAMAGED · INSPECT BEFORE USE',
};

export const FAULTS = {
  none: 'No fault',
  brake: 'Hoist brake lining worn',
  lt2: 'LT motor 2 trips',
  dsl: 'DSL supply lost',
  rope: 'Broken wires in the rope',
};

// the tests of the inspection documents, run on the simulator [M]
export const TESTS = [
  ['speedHo', 'Speed test · hoisting (required 4.0 m/min)'],
  ['speedCt', 'Speed test · cross travel (required 15.0 m/min)'],
  ['speedLt', 'Speed test · long travel (required 20.0 m/min)'],
  ['ampHo', 'Ampere test · hoist up and down with 2000 kg'],
  ['ampCt', 'Ampere test · cross travel to and fro with 2000 kg'],
  ['ampLt', 'Ampere test · long travel left and right, no load'],
  ['defl', 'Deflection · 2000 kg at mid span ≤ 24.76 mm'],
  ['load', 'Load test · 2000 kg lifted and held'],
  ['over', 'Overload test · 2500 kg lifted and held (test key)'],
];

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const approach = (x, tgt, rate, dt) => (x < tgt ? Math.min(tgt, x + rate * dt) : Math.max(tgt, x - rate * dt));
const AX = ['ho', 'ct', 'lt'];

export function createPlant() {
  return {
    t: 0,
    power: true, // DSL live
    on: false, // pendant ON (main contactor)
    estop: false,
    fast: true, // second step of the pendant buttons
    testKey: false, // overload test key (overload device bypassed, witnessed test)
    pos: {ho: 1.2, ct: 6, lt: 8}, // hook lift above floor, trolley from DSL rail, bridge along the bay
    v: {ho: 0, ct: 0, lt: 0}, // m/min, signed
    jog: {ho: 0, ct: 0, lt: 0}, // pendant buttons held: -1, 0, 1
    goal: {ho: null, ct: null, lt: null}, // the tour drives to a target as if the button were held
    load: 0, // kg on the hook
    lifted: false,
    brake: {ho: true, ct: true, lt: true},
    holdT: 0, // s the current load has been held clear of the floor
    skew: 0, // mm
    ropeOK: true,
    fault: 'none',
    tests: {},
    rec: {}, // recorded values of the tests
    acc: {}, // running conditions for the speed tests
    alarms: [],
    events: [],
    log: [],
  };
}

export function deflection(s) {
  const L = P.span;
  const a = clamp(s.pos.ct, 0.01, L - 0.01);
  const b = L - a;
  const W = s.lifted ? s.load : 0;
  // simply supported girder, point load at a: deflection under the load, scaled to 13.0 mm at 2000 kg mid span [M]
  return P.defl * (W / 2000) * ((a * a * b * b) / ((L * L * L * L) / 16));
}
// deflection shape along the girder (z from the DSL rail) for the 3D view, mm
export function deflAt(s, z) {
  const L = P.span;
  const a = clamp(s.pos.ct, 0.01, L - 0.01);
  const b = L - a;
  const W = s.lifted ? s.load : 0;
  const x = clamp(z, 0, L);
  const f = x <= a ? b * x * (L * L - b * b - x * x) : a * (L - x) * (L * L - a * a - (L - x) * (L - x));
  return P.defl * (W / 2000) * (f / ((L * L * L * L) / 8));
}

export function currents(s) {
  const k = s.lifted ? s.load / 2000 : 0;
  const run = (ax) => Math.abs(s.v[ax]) > 0.01;
  const frac = (ax) => Math.abs(s.v[ax]) / P.vMeas[ax];
  // VFD: the motor current follows the torque more than the speed; at slow speed a bit lower [A]
  const sp = (ax) => (frac(ax) >= 0.95 ? 1 : 0.75 + 0.25 * (frac(ax) / 0.95));
  const ho = !run('ho') ? 0 : (s.v.ho > 0 ? P.amp.ho0 + (P.amp.hoUp - P.amp.ho0) * k : P.amp.ho0 + (P.amp.hoDn - P.amp.ho0) * k) * sp('ho');
  const ct = !run('ct') ? 0 : (P.amp.ct0 + (P.amp.ct - P.amp.ct0) * k - (s.v.ct < 0 ? P.ct0Loss * k : 0)) * sp('ct');
  const ltOne = !run('lt') ? 0 : (P.amp.lt0 + P.ltLoaded * k) * sp('lt');
  const lt = [ltOne * (s.fault === 'lt2' ? 1.6 : 1), s.fault === 'lt2' ? 0 : ltOne];
  return {ho, ct, lt};
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
function pass(s, k, rec) {
  if (rec) s.rec[k] = rec;
  if (!s.tests[k]) note(s, 'Recorded: ' + TESTS.find((x) => x[0] === k)[1]);
  s.tests[k] = true;
}

export const cmd = {
  on(s) {
    if (s.estop) return note(s, 'Release the emergency stop first');
    if (!s.power) return note(s, 'No power on the DSL');
    s.on = true;
  },
  off(s) {
    s.on = false;
    for (const a of AX) (s.jog[a] = 0), (s.goal[a] = null);
  },
  estop(s, on) {
    s.estop = on;
    if (on) cmd.off(s);
  },
  jog(s, ax, d) {
    s.goal[ax] = null;
    if (d && !s.on) {
      s.jog[ax] = 0;
      return note(s, 'Press ON on the pendant first');
    }
    s.jog[ax] = d;
  },
  goTo(s, ax, x, fast = true) {
    if (!s.on) return note(s, 'Press ON on the pendant first');
    s.fast = fast;
    s.goal[ax] = x;
  },
  speed(s, fast) {
    s.fast = fast;
  },
  key(s, on) {
    s.testKey = on;
    if (on) event(s, 'warn', 'Overload device bypassed with the test key: only for the witnessed overload test');
  },
  setLoad(s, kg) {
    if (s.lifted || s.pos.ho > 1.5) return note(s, 'Set the load down and lower the hook to hook on or off');
    if (Math.abs(s.v.ho) > 0.01) return;
    s.load = kg;
    s.holdT = 0;
    if (kg > P.swl * P.overload && !s.testKey) note(s, 'Load above the capacity: the overload device will not let it lift');
  },
  inspectRope(s) {
    if (!s.ropeOK) {
      if (s.on || s.lifted) return note(s, 'Set the load down and switch off before changing the rope');
      s.ropeOK = true;
      if (s.fault === 'rope') s.fault = 'none';
      cond(s, 10, false);
      note(s, 'Rope replaced: 8 mm 6×36 IWRC 1960, breaking force 52.4 kN tested');
    } else note(s, 'Rope inspected: no broken wires, no kinks, lubricated');
  },
  setFault(s, f) {
    s.fault = f;
    s.power = f !== 'dsl';
    if (f === 'rope') s.ropeOK = false;
    if (!s.power) cmd.off(s);
  },
};

export function step(s, dt) {
  const n = Math.max(1, Math.ceil(dt / 0.05));
  for (let i = 0; i < n; i++) sub(s, dt / n);
}

function sub(s, dt) {
  s.t += dt;
  const lim = {ho: [0, P.hol], ct: [CT_MIN, CT_MAX], lt: [LT_MIN, LT_MAX]};
  const overloadBlock = s.load > P.swl * P.overload && !s.testKey;
  for (const ax of AX) {
    // what the pendant asks for: a held button, or the tour's target
    let d = s.jog[ax];
    let vmax = P.vMeas[ax] * (s.fast ? 1 : P.slow);
    if (s.goal[ax] !== null) {
      const e = s.goal[ax] - s.pos[ax];
      if (Math.abs(e) < 0.004) {
        s.goal[ax] = null;
        d = 0;
      } else {
        d = Math.sign(e);
        // slow down near the target like an operator on the first step [A]
        const stop = (P.vMeas[ax] / 60) * P.ramp[ax] * 0.6;
        if (Math.abs(e) < stop) vmax = Math.max(P.vMeas[ax] * P.slow, vmax * (Math.abs(e) / stop));
      }
    }
    if (!s.on || !s.power || s.estop) d = 0;
    if (ax === 'ho' && d > 0 && overloadBlock && (s.lifted || s.load > 0)) d = 0;
    if (d > 0 && s.pos[ax] >= lim[ax][1] - 1e-4) d = 0;
    if (d < 0 && s.pos[ax] <= lim[ax][0] + 1e-4) d = 0;
    let tgt = d * vmax;
    if (ax === 'lt' && s.fault === 'lt2') tgt *= 0.6;
    const acc = P.vMeas[ax] / P.ramp[ax];
    s.v[ax] = approach(s.v[ax], tgt, acc * (tgt === 0 && !s.on ? 3 : 1), dt);
    s.brake[ax] = Math.abs(s.v[ax]) < 0.01 && d === 0;
    s.pos[ax] += (s.v[ax] / 60) * dt;
    if (s.pos[ax] > lim[ax][1]) (s.pos[ax] = lim[ax][1]), (s.v[ax] = 0);
    if (s.pos[ax] < lim[ax][0]) (s.pos[ax] = lim[ax][0]), (s.v[ax] = 0);
  }
  // worn brake: the hook creeps down under load with the brake set
  if (s.fault === 'brake' && s.brake.ho && s.lifted) s.pos.ho = Math.max(0, s.pos.ho - P.creep * (s.load / 2000) * dt);
  s.lifted = s.load > 0 && s.pos.ho > RIG[s.load] + 0.02;
  if (s.lifted) s.holdT += Math.abs(s.v.ho) < 0.01 ? dt : 0;
  else s.holdT = 0;
  if (s.fault === 'lt2' && Math.abs(s.v.lt) > 0.01) s.skew = Math.min(60, s.skew + Math.abs(s.v.lt) * 0.05 * dt);
  else if (s.fault !== 'lt2') s.skew = approach(s.skew, 0, 5, dt);
  if (s.lifted && s.load > P.swl && !s.testKey) event(s, 'bad', 'Load above the 2000 kg capacity lifted');
  if (s.lifted && !s.ropeOK) event(s, 'bad', 'Lifting with a damaged rope');
  if (s.load > 0 && !s.lifted && (Math.abs(s.v.ct) > 0.05 || Math.abs(s.v.lt) > 0.05)) event(s, 'bad', 'Load dragged along the floor: lift it clear before travelling');

  // the tests
  for (const ax of AX) {
    const key = 'speed' + ax[0].toUpperCase() + ax.slice(1);
    const steady = s.fast && Math.abs(Math.abs(s.v[ax]) - P.vMeas[ax] * (ax === 'lt' && s.fault === 'lt2' ? 0.6 : 1)) < 0.001;
    s.acc[key] = steady ? (s.acc[key] || 0) + dt : 0;
    if (s.acc[key] > 2 && s.fault === 'none') pass(s, key, `${P.vMeas[ax].toFixed(2)} m/min`);
  }
  const c = currents(s);
  const rec2 = (k, part, val, ok) => {
    if (!ok) return;
    s.acc[k] = s.acc[k] || {};
    s.acc[k][part] = val;
  };
  const at2000 = s.lifted && s.load === 2000;
  rec2('ampHo', 'up', c.ho, at2000 && s.v.ho > P.vMeas.ho * 0.99);
  rec2('ampHo', 'dn', c.ho, at2000 && s.v.ho < -P.vMeas.ho * 0.99);
  rec2('ampCt', 'to', c.ct, at2000 && s.v.ct > P.vMeas.ct * 0.99);
  rec2('ampCt', 'fro', c.ct, at2000 && s.v.ct < -P.vMeas.ct * 0.99);
  rec2('ampLt', 'l', c.lt[0], !s.lifted && s.v.lt > P.vMeas.lt * 0.99);
  rec2('ampLt', 'r', c.lt[0], !s.lifted && s.v.lt < -P.vMeas.lt * 0.99);
  const A = s.acc;
  if (A.ampHo && A.ampHo.up && A.ampHo.dn) pass(s, 'ampHo', `${A.ampHo.up.toFixed(2)} / ${A.ampHo.dn.toFixed(2)} A`);
  if (A.ampCt && A.ampCt.to && A.ampCt.fro) pass(s, 'ampCt', `${A.ampCt.to.toFixed(2)} / ${A.ampCt.fro.toFixed(2)} A`);
  if (A.ampLt && A.ampLt.l && A.ampLt.r) pass(s, 'ampLt', `${A.ampLt.l.toFixed(2)} / ${A.ampLt.r.toFixed(2)} A`);
  if (at2000 && Math.abs(s.pos.ct - P.span / 2) < 0.3 && s.brake.ct) pass(s, 'defl', `${deflection(s).toFixed(1)} mm`);
  if (s.lifted && s.load === 2000 && s.holdT >= P.hold && s.fault !== 'brake') pass(s, 'load', '2000 kg · held');
  if (s.lifted && s.load === 2500 && s.testKey && s.holdT >= P.hold && s.fault !== 'brake') pass(s, 'over', '2500 kg · held');

  const moving = (ax) => s.jog[ax] !== 0 || s.goal[ax] !== null;
  cond(s, 1, overloadBlock && s.on);
  cond(s, 2, s.pos.ho >= P.hol - 1e-3 && moving('ho'));
  cond(s, 3, s.pos.ho <= 1e-3 && moving('ho') && s.jog.ho < 0);
  cond(s, 4, (s.pos.ct <= CT_MIN + 1e-3 || s.pos.ct >= CT_MAX - 1e-3) && moving('ct'));
  cond(s, 5, (s.pos.lt <= LT_MIN + 1e-3 || s.pos.lt >= LT_MAX - 1e-3) && moving('lt'));
  cond(s, 6, s.fault === 'brake' && s.lifted && s.brake.ho);
  cond(s, 7, s.fault === 'lt2' && (Math.abs(s.v.lt) > 0.01 || s.skew > 5));
  cond(s, 8, !s.power);
  cond(s, 9, s.estop);
  cond(s, 10, !s.ropeOK);
}
