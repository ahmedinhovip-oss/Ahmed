// IDEX fume extraction and pulse-jet bag filter (dust collector): the process model. The HMI, the stack monitor and
// every moving part of the 3D view read the state this file advances. No three.js, no DOM.
//
// [D] = from the general-arrangement drawing (Section L-L). [A] = an assumption: the drawing gives the plant's
// geometry and the fume source, not its operating values. Every assumption sits in P and is listed in the README.

export const P = {
  // the fume source and the line [D]
  fumeM3h: 2000, //            m³/h at 400 °C, natural draft from IDEX "TOP 25"
  fumeT: 400,
  ductDia: 0.65, //            m, Ø650 duct
  ductLen: 11.694 + 6.0 + 2.552 + 4.55, // m of Ø650 duct to the filter outlet bend
  chimneyH: 18, chimneyDia: 1.5,
  compartments: 2, compLen: 3.84,
  // fan and filter [A]
  designM3h: 21000, //         m³/h the fan gives at 50 Hz with clean bags
  hoodM3h: 15000, //           m³/h design extraction at the IDEX take-off: 12.6 m/s in the Ø650 duct
  ambient: 35, //              °C
  ductCool: 0.45, //           °C lost per metre of duct at design flow
  bagsPerComp: 120, //         Ø160 × 3000 mm polyester bags
  bagArea: 1.51, //            m² per bag
  rows: 8, //                  pulse valves (rows) per compartment
  bagLimit: 130, //            °C polyester: dilution damper opens above this
  bagHH: 150, //               °C high-high
  dpClean: 700, //             Pa·min/m bag resistance (× air-to-cloth)
  kCake: 12, //                Pa per g/m² per m/min
  dustIn: 1.2, //              g/Nm³ at the hood
  cleanStart: 1470, //         Pa (150 mmWC) on-demand cleaning starts
  cleanStop: 980, //           Pa (100 mmWC) and stops
  pulseMs: 120,
  pulseGap: 10, //             s between valves
  pulseEff: 0.7, //            share of a row's cake one pulse drops
  airBar: 6, airLow: 4.5, airDrop: 0.35, airRecover: 0.12, // compressed air header
  hopperKg: 400, hopperHigh: 0.8, airlockKgh: 30,
  emitNormal: 4, emitBurst: 85, emitLimit: 20, // mg/Nm³ at the stack
  fanKW: 37, hoodSP: -50, //   Pa suction at the IDEX take-off at design flow
  dilutionM3h: 7000, //        m³/h of cold air through the dilution damper
  surgeM3h: 7000, surgeT: 680, // a charging / door-open surge from IDEX
};

const AREA = P.bagsPerComp * P.bagArea; // m² per compartment

export const ALARMS = {
  1: 'FAN MOTOR TRIP · VFD FAULT',
  2: 'COMPRESSED AIR PRESSURE LOW',
  3: 'FILTER DIFFERENTIAL PRESSURE HIGH',
  4: 'INLET TEMPERATURE HIGH · DILUTION DAMPER OPEN',
  5: 'INLET TEMPERATURE HIGH HIGH',
  6: 'STACK DUST EMISSION HIGH · BROKEN BAG',
  7: 'HOPPER 1 LEVEL HIGH',
  8: 'HOPPER 2 LEVEL HIGH',
  9: 'ROTARY AIRLOCK RV1 TRIP',
  10: 'PULSE VALVE FAULT · COMPARTMENT 1 ROW 3',
  11: 'HOOD SUCTION LOW · FUME ESCAPE AT IDEX',
  12: 'EMERGENCY STOP PRESSED',
};

export const FAULTS = {
  none: 'No fault',
  fanTrip: 'Fan motor / VFD trips',
  airLow: 'Compressor stops: air header falls',
  bagBurst: 'A bag bursts in compartment 2',
  airlockTrip: 'Rotary airlock RV1 trips',
  surge: 'IDEX hot surge (charging, door open)',
  valve: 'Pulse valve C1-R3 stuck closed',
};

export const TREND_N = 720;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const approach = (x, tgt, rate, dt) => (x < tgt ? Math.min(tgt, x + rate * dt) : Math.max(tgt, x - rate * dt));

export function createPlant(scenario = 'run') {
  const run = scenario === 'run';
  const s = {
    t: 0,
    sys: run, // system started from the panel
    estop: false,
    resetNeeded: false,
    fan: {run: run, hz: run ? 31 : 0, sp: 50, auto: true},
    flowSP: P.hoodM3h,
    q: 0, // m³/h actual at the fan
    tIn: P.ambient, // °C at the filter inlet
    tStack: P.ambient,
    dilution: 0, // 0..1
    dilutionAuto: true,
    cake: Array.from({length: P.compartments * P.rows}, (_, i) => (run ? 100 + 10 * Math.sin(i * 1.7) : 20)), // g/m² per row
    dp: 0, // Pa
    clean: {mode: 'DEMAND', active: false, next: 0, row: 0, pulseT: -9, count: 0}, // DEMAND | TIMER | OFF
    air: P.airBar,
    hopper: [run ? 120 : 40, run ? 105 : 35], // kg
    rv: [run, run], // rotary airlocks running
    emit: P.emitNormal,
    emitHigh: 0, // s above the limit
    hood: 0,
    kw: 0,
    amps: 0,
    fault: 'none',
    surge: 0,
    alarms: [],
    history: [],
    log: [],
    trend: {i: 0, n: 0, acc: 0, dp: new Float32Array(TREND_N), tIn: new Float32Array(TREND_N), emit: new Float32Array(TREND_N), hz: new Float32Array(TREND_N)},
  };
  solve(s);
  return s;
}

// ------------------------------------------------------------------ the gas side, solved each step
function resistance(s) {
  // the duct as a fixed share of the design pressure; the bags from their cake (the compartments are in parallel)
  const wAvg = s.cake.reduce((a, b) => a + b, 0) / s.cake.length;
  return {wAvg};
}
function solve(s) {
  const {wAvg} = resistance(s);
  // flow from the fan: proportional to speed, reduced as the bags load (system curve)
  const vDesign = P.designM3h / 60 / (AREA * P.compartments); // m/min air-to-cloth at design
  const dpDesign = (P.dpClean + P.kCake * 100) * vDesign + 900; // bags at 100 g/m² + 900 Pa of duct and stack
  let q = s.fan.run && !s.estop ? (P.designM3h * s.fan.hz) / 50 : 0;
  for (let k = 0; k < 3; k++) {
    const v = q / 60 / (AREA * P.compartments);
    const dpSys = (P.dpClean + P.kCake * wAvg) * v + 900 * (q / P.designM3h) ** 2;
    q = s.fan.run && !s.estop ? ((P.designM3h * s.fan.hz) / 50) * Math.sqrt(dpDesign / Math.max(200, dpSys)) ** 0.5 : 0;
  }
  // the cold-air dilution damper adds air at the filter inlet, the fan's flow stays the same
  const v = q / 60 / (AREA * P.compartments);
  s.q = q;
  s.v = v;
  s.dp = q > 0 ? (P.dpClean + P.kCake * wAvg) * v : 0;
  // inlet temperature: hot fume mixed with hood air, cooled along the duct, diluted
  const hotM3h = P.fumeM3h + s.surge * (P.surgeM3h - P.fumeM3h);
  const hotT = P.fumeT + s.surge * (P.surgeT - P.fumeT);
  const hotN = (hotM3h * 273) / (273 + hotT);
  const dilQ = s.dilution * P.dilutionM3h;
  const hoodQ = Math.max(0, q - dilQ);
  let tMix = P.ambient;
  for (let k = 0; k < 4; k++) {
    const nHood = (hoodQ * 273) / (273 + tMix);
    tMix = P.ambient + ((hotT - P.ambient) * Math.min(hotN, nHood)) / Math.max(1, nHood);
  }
  const cool = q > 0 ? P.ductCool * P.ductLen * (P.designM3h / Math.max(q, 2000)) * 0.6 : 0;
  const tDuct = Math.max(P.ambient, tMix - cool);
  const tIn = q > 0 ? (tDuct * hoodQ + P.ambient * dilQ) / Math.max(1, q) : P.ambient;
  s.tInTarget = tIn;
  s.hoodQ = hoodQ;
  // suction at the IDEX take-off, from the hood flow (square law); fume escapes when it falls under ~10 Pa
  s.hood = q > 0 ? P.hoodSP * (hoodQ / P.hoodM3h) ** 2 : 0;
  // fan shaft power and current
  const dpTot = s.dp + 900 * (q / P.designM3h) ** 2;
  s.kw = q > 0 ? (P.fanKW * (q / P.designM3h) * dpTot) / (dpDesign * 0.95) : 0;
  s.amps = s.kw > 0 ? (s.kw * 1000) / (Math.sqrt(3) * 415 * 0.86 * 0.92) : 0;
}

export function signals(s) {
  const nDust = (s.q * 273) / (273 + s.tIn);
  return {
    nDust,
    dustKgh: (nDust * P.dustIn) / 1000,
    v: s.v || 0,
    ductV: s.q / 3600 / ((Math.PI * P.ductDia * P.ductDia) / 4),
    airOK: s.air >= P.airLow,
    fumeEscape: s.sys && s.hood > -10,
    hopperPct: s.hopper.map((h) => h / P.hopperKg),
    running: s.sys && s.fan.run && !s.estop,
  };
}

function raise(s, no) {
  if (s.alarms.find((a) => a.no === no && a.active)) return;
  const rec = {no, t: s.t, active: true, ack: false};
  s.alarms.unshift(rec);
  s.history.unshift({...rec, kind: 'APPEARED'});
  if (s.history.length > 200) s.history.length = 200;
}
function cond(s, no, on) {
  if (on) return raise(s, no);
  const a = s.alarms.find((x) => x.no === no && x.active);
  if (a) {
    a.active = false;
    s.history.unshift({no, t: s.t, kind: 'CLEARED'});
  }
}
function note(s, text) {
  s.log.unshift({t: s.t, text});
  if (s.log.length > 6) s.log.length = 6;
}

// ------------------------------------------------------------------ operator commands
export const cmd = {
  start(s) {
    if (s.estop) return note(s, 'Release the emergency stop first');
    if (s.resetNeeded) return note(s, 'Press RESET first');
    s.sys = true;
    s.fan.run = s.fault !== 'fanTrip';
    s.rv = [true, true];
  },
  stop(s) {
    s.sys = false;
    s.fan.run = false;
    note(s, 'System stopped: fume goes by natural draft through the roof stack');
  },
  reset(s) {
    if (s.estop) return note(s, 'Release the emergency stop first');
    s.resetNeeded = false;
    for (const a of s.alarms) a.ack = true;
  },
  estop(s, on) {
    s.estop = on;
    if (on) {
      s.sys = false;
      s.fan.run = false;
      s.resetNeeded = true;
    }
  },
  ack(s) {
    for (const a of s.alarms) a.ack = true;
  },
  clearAlarms(s) {
    s.alarms = s.alarms.filter((a) => a.active);
  },
  fanMode(s, auto) {
    s.fan.auto = auto;
  },
  fanStart(s) {
    if (!s.sys) return note(s, 'Start the system first');
    if (s.fault === 'fanTrip') return raise(s, 1);
    s.fan.run = true;
  },
  fanStop(s) {
    s.fan.run = false;
  },
  cleanMode(s, m) {
    s.clean.mode = m;
  },
  cleanNow(s) {
    if (!signals(s).airOK) return note(s, 'Compressed air low: cleaning blocked');
    s.clean.active = true;
    s.clean.manual = true;
  },
  rv(s, i, on) {
    if (on && i === 0 && s.fault === 'airlockTrip') return raise(s, 9);
    s.rv[i] = on;
  },
  empty(s) {
    s.hopper = s.hopper.map((h) => Math.min(h, 20));
    note(s, 'Dust bins emptied');
  },
  dilution(s, v) {
    if (v === 'auto') s.dilutionAuto = true;
    else {
      s.dilutionAuto = false;
      s.dilution = v;
    }
  },
  set(s, k, v) {
    if (k === 'hzSP') s.fan.sp = v;
    else if (k === 'flowSP') s.flowSP = v;
    else P[k] = v;
  },
  setFault(s, f) {
    s.fault = f;
    if (f === 'fanTrip' && s.fan.run) {
      s.fan.run = false;
      raise(s, 1);
    }
    if (f === 'airlockTrip') {
      s.rv[0] = false;
      raise(s, 9);
    }
    if (f === 'none') {
      if (s.sys && !s.fan.run && !s.estop) s.fan.run = false;
    }
  },
};

// ------------------------------------------------------------------ the step
export function step(s, dt) {
  const n = Math.max(1, Math.ceil(dt / 0.25));
  for (let i = 0; i < n; i++) sub(s, dt / n);
}

function sub(s, dt) {
  s.t += dt;
  // fan speed: auto holds the flow set point against the bag resistance, manual follows the Hz set point
  if (s.fan.run && !s.estop && s.sys) {
    let target = s.fan.sp;
    if (s.fan.auto) {
      // the hz the system curve needs for the flow set point
      // the dilution air comes on top of the hood flow, so the hood keeps its suction
      const ratio = s.q > 0 ? (s.flowSP + s.dilution * P.dilutionM3h) / s.q : 1;
      target = clamp(s.fan.hz * (1 + 0.6 * (ratio - 1)), 25, 50);
    }
    s.fan.hz = approach(s.fan.hz, target, 3, dt);
  } else s.fan.hz = approach(s.fan.hz, 0, 5, dt);
  if (s.fault === 'fanTrip' && s.fan.run) {
    s.fan.run = false;
    raise(s, 1);
  }
  // IDEX surge
  s.surge = approach(s.surge, s.fault === 'surge' ? 1 : 0, 0.08, dt);
  solve(s);
  const g = signals(s);
  s.tIn += (s.tInTarget - s.tIn) * Math.min(1, dt / 20);
  s.tStack += (s.tIn - 4 - s.tStack) * Math.min(1, dt / 40);
  // dilution damper: opens on high inlet temperature to protect the bags
  if (s.dilutionAuto) {
    const want = s.tIn > P.bagLimit - 12 ? clamp((s.tIn - (P.bagLimit - 18)) / 10, 0, 1) : s.tIn < P.bagLimit - 35 ? 0 : s.dilution;
    s.dilution = approach(s.dilution, want, 0.05, dt);
  }

  // dust onto the bags: shared over the rows by flow
  if (g.running && s.q > 0) {
    const gs = (g.nDust * P.dustIn) / 3600; // g/s
    const perRow = gs / s.cake.length / (AREA / P.rows);
    for (let i = 0; i < s.cake.length; i++) s.cake[i] += perRow * dt * (1 + 0.15 * Math.sin(i * 2.3));
  }

  // pulse-jet cleaning
  s.air = approach(s.air, s.fault === 'airLow' ? 3.2 : P.airBar, s.fault === 'airLow' ? 0.02 : P.airRecover, dt);
  const c = s.clean;
  if (c.mode === 'DEMAND') {
    if (!c.active && s.dp > P.cleanStart) c.active = true;
    if (c.active && !c.manual && s.dp < P.cleanStop) c.active = false;
  } else if (c.mode === 'TIMER') c.active = g.running;
  else if (!c.manual) c.active = false;
  if (c.active && (g.running || c.manual)) {
    c.next -= dt;
    if (c.next <= 0) {
      c.next = P.pulseGap;
      if (g.airOK) {
        const row = c.row;
        const stuck = s.fault === 'valve' && row === 2;
        if (!stuck) {
          const before = s.cake[row];
          s.cake[row] = before * (1 - P.pulseEff) + 4;
          const kg = ((before - s.cake[row]) * (AREA / P.rows)) / 1000;
          s.hopper[row < P.rows ? 0 : 1] += kg;
        } else raise(s, 10);
        s.air -= P.airDrop;
        c.pulseT = s.t;
        c.lastRow = row;
        c.count++;
        c.row = (c.row + 1) % s.cake.length;
        if (c.manual && c.row === 0) {
          c.manual = false;
          c.active = s.dp > P.cleanStop && c.mode === 'DEMAND';
        }
      }
    }
  }
  if (s.fault !== 'valve') cond(s, 10, false);

  // hoppers and rotary airlocks
  for (let i = 0; i < 2; i++) {
    if (i === 0 && s.fault === 'airlockTrip') s.rv[0] = false;
    if (s.rv[i] && s.sys) s.hopper[i] = Math.max(0, s.hopper[i] - (P.airlockKgh / 3600) * dt);
    s.hopper[i] = Math.min(P.hopperKg, s.hopper[i]);
  }
  // emission at the stack
  const emitT = !g.running ? 0 : s.fault === 'bagBurst' ? P.emitBurst : P.emitNormal * (1 + 0.6 * Math.max(0, (s.t - c.pulseT) < 3 ? 1 : 0));
  s.emit += (emitT - s.emit) * Math.min(1, dt / 6);
  s.emitHigh = s.emit > P.emitLimit ? s.emitHigh + dt : 0;

  // alarms
  cond(s, 2, s.air < P.airLow);
  cond(s, 3, s.dp > P.cleanStart + 400);
  cond(s, 4, s.tIn > P.bagLimit);
  cond(s, 5, s.tIn > P.bagHH);
  cond(s, 6, s.emitHigh > 20);
  cond(s, 7, s.hopper[0] / P.hopperKg > P.hopperHigh);
  cond(s, 8, s.hopper[1] / P.hopperKg > P.hopperHigh);
  cond(s, 11, g.fumeEscape && s.t > 5);
  cond(s, 12, s.estop);
  if (s.fault !== 'fanTrip') cond(s, 1, false);
  if (s.fault !== 'airlockTrip') cond(s, 9, false);

  // trends, one sample every 5 s
  const tr = s.trend;
  tr.acc += dt;
  while (tr.acc >= 5) {
    tr.acc -= 5;
    tr.dp[tr.i] = s.dp;
    tr.tIn[tr.i] = s.tIn;
    tr.emit[tr.i] = s.emit;
    tr.hz[tr.i] = s.fan.hz;
    tr.i = (tr.i + 1) % TREND_N;
    tr.n = Math.min(TREND_N, tr.n + 1);
  }
}

// an hour of history so the trend screen opens full
export function seedTrend(s) {
  const tr = s.trend;
  for (let k = 0; k < TREND_N; k++) {
    const ph = (k % 260) / 260;
    tr.dp[k] = s.sys ? 1000 + 470 * ph - (ph > 0.92 ? 480 * (ph - 0.92) / 0.08 : 0) : 0;
    tr.tIn[k] = s.sys ? 58 + 3 * Math.sin(k / 31) : P.ambient;
    tr.emit[k] = s.sys ? P.emitNormal + 0.8 * Math.sin(k / 7) ** 2 : 0;
    tr.hz[k] = s.sys ? 44 + 3 * ph : 0;
  }
  tr.i = 0;
  tr.n = TREND_N;
}
