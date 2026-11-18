// HA01, FVGP-A 1-30 gas melting/holding furnace: the process model. Every number on the HMI and every pose in the 3D
// view reads from the state this file advances. No three.js, no DOM.
//
// Values from the user manual 1982-MA-005-0-OTE-MOP-002 are marked [M]. Values the manual does not give are
// engineering assumptions, marked [A], kept here in one block so they are easy to correct against the real plant.

export const P = {
  // furnace
  capacityT: 30, //            [A] from the type "1-30"
  hearthArea: 12.6, //         [A] m², 4.2 m x 3.0 m hearth
  rhoAl: 2.37, //              t/m³ liquid aluminium
  cpAl: 1.18, //               kJ/kg·K liquid aluminium
  rodLevel: 1000, //           [A] mm above the hearth floor: the working-level rod in the pouring spout [M: rod exists]
  // combustion
  burners: 2, //               [M] burner #1 (75BCU1) and burner #2 (77BCU1)
  burnerKW: 1200, //           [A] kW per burner at full fire
  lowFire: 0.15, //            [A] low-fire fraction of full power
  eff: 0.55, //                [A] available heat fraction
  lhv: 9.97, //                kWh/m³ natural gas
  purge: 60, //                [M] purge timer shown on the combustion screen (the text says six minutes)
  pmax: 15, //                 [M] tightness test, TEST_PMAX
  pmin: 15, //                 [M] tightness test, TEST_PMIN
  safetyTime: 3, //            [A] s to prove flame after the main valve opens
  flameMin: 10, //             [M] µA, below this the flame is lost
  flameMax: 25, //             [M] µA, about the highest signal
  // temperatures
  chSP: 720, //                [M] chamber set point
  chHigh: 780, //              [M] chamber high alarm
  alSP: 720, //                [M] aluminium set point
  alHigh: 780, //              [A] the screen shows 700 °C, below the set point; 780 used here
  alLow: 500, //               [M] aluminium low alarm
  alTransferMin: 690, //       [A] HA01 temperature OK for transfer
  // thermal
  cCh: 6000, //                [A] kJ/K chamber gas + hot face
  shellLoss: 0.09, //          [A] kW/K chamber to ambient
  hA: 4.5, //                  [A] kW/K chamber to bath
  stirGain: 1.6, //            [A] bath heat pick-up with the Aluswirler running
  doorLossKW: 180, //          [A] kW lost through a fully open door
  // hydraulics and metal handling
  doorTime: 12, //             [A] s for a full door stroke
  tiltTime: 22, //             [A] s for a full platform tilt
  tiltMax: 85, //              [A] degrees; past ~90° the ladle's upper rim would lead the lip into the wall
  ladleT: 3.0, //              [A] t of liquid metal per ladle
  ladleTemp: 745, //           [A] °C
  pumpTpm: 0.6, //             [A] t/min transfer pump flow to HC01
  pumpMin: 250, //             [M] minimum level for the transfer pump (setting), mm
  swirlSafe: 300, //           [A] mm Aluswirler safety level
  swirlRpm: 400, //            [A] rpm set point
};

const mm2t = (mm) => (P.hearthArea * mm * P.rhoAl) / 1000;
const t2mm = (t) => (t * 1000) / (P.hearthArea * P.rhoAl);
export const levelOf = (s) => t2mm(s.mass);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const approach = (x, tgt, rate, dt) => (x < tgt ? Math.min(tgt, x + rate * dt) : Math.max(tgt, x - rate * dt));

export const SEQ_TEXT = {
  OFF: 'BURNERS STOPPED',
  FAN: 'FAN START · AIR PROVING',
  PMAX: 'TIGHTNESS CONTROL · TEST P MAX',
  PMIN: 'TIGHTNESS CONTROL · TEST P MIN',
  PURGE: 'PRE-PURGE',
  IGN: 'IGNITION · LOW FIRE POSITION',
  LOW: 'FLAME PROVED · LOW FIRE',
  RUN: 'MODULATING',
  HOLD: 'TEMPERATURE REACHED · BURNERS PAUSED',
  POST: 'POST-PURGE',
  LOCKOUT: 'LOCKOUT · RESET REQUIRED',
};

export const ALARMS = {
  1: 'EMERGENCY STOP PRESSED',
  10: 'GAS PRESSURE LOW',
  12: 'COMBUSTION AIR PRESSURE LOW',
  13: 'COMBUSTION FAN MOTOR PROTECTION',
  20: 'TIGHTNESS CONTROL FAULT EV1 (70Y1)',
  21: 'TIGHTNESS CONTROL FAULT EV2 (MAIN EV)',
  30: 'FLAME FAILURE BURNER #1',
  31: 'FLAME FAILURE BURNER #2',
  40: 'CHAMBER TEMPERATURE HIGH',
  41: 'ALUMINIUM TEMPERATURE HIGH',
  42: 'ALUMINIUM TEMPERATURE LOW',
  50: 'FULL FURNACE · LOADING STOPPED',
  60: 'TRANSFER PUMP MINIMUM LEVEL',
  61: 'ALUSWIRLER SAFETY LEVEL',
  70: 'HYDRAULIC GROUP NOT RUNNING',
  78: 'HC01 COMMS FAULT',
};

export const FAULTS = {
  none: 'No fault',
  gasLow: 'Gas supply pressure low',
  fanTrip: 'Combustion fan motor trip',
  flame2: 'Burner #2 loses its flame',
  leakY1: '70Y1 leaking (tightness test)',
  hc01: 'HC01 communication lost',
};

export const TREND_N = 720; // one sample every 5 s: one hour

export function createPlant(scenario = 'off') {
  const hot = scenario === 'run';
  const s = {
    t: 0,
    ch: hot ? 742 : 705,
    al: hot ? 716 : 708,
    mass: mm2t(hot ? 640 : 560),
    gasM3: 1834.2,
    seq: hot ? 'RUN' : 'OFF',
    seqT: 0,
    fire: hot ? [0.4, 0.4] : [0, 0],
    servo: hot ? [0.4, 0.4] : [0, 0],
    flame: hot ? [17, 17] : [0, 0],
    ev: {y1: hot, y2: hot, y3: hot, y4: hot, b1: hot, b2: hot},
    tight: '', // '', 'TEST', 'OK', 'F-EV1', 'F-EV2'
    testP: 0,
    fan: {run: hot, speed: hot ? 1 : 0},
    pres: -0.02,
    damper: 0.6,
    pI: 0,
    tI: hot ? 0.05 : 0,
    remote: true,
    sp: {ch: P.chSP, al: P.alSP, press: 0, chHigh: P.chHigh, alHigh: P.alHigh, alLow: P.alLow, pumpMin: P.pumpMin, rpm: P.swirlRpm},
    hyd: {run: hot, auto: true},
    door: {pos: 0, cmd: 0, auto: true},
    tilt: {pos: 0, cmd: 0, locked: false, ladle: P.ladleT, poured: 0, auto: true},
    swirl: {run: hot, rpm: hot ? P.swirlRpm : 0, auto: true, prod: true},
    pump: {run: false, auto: true, flow: 0},
    hc01: {request: false, gate: false},
    estop: false,
    fault: 'none',
    alarms: [], // {code, text, t, active, ack}
    history: [],
    full: false,
    trend: {i: 0, n: 0, ch: new Float32Array(TREND_N), chSP: new Float32Array(TREND_N), al: new Float32Array(TREND_N), alSP: new Float32Array(TREND_N), acc: 0},
    log: [],
  };
  if (scenario === 'cold') {
    Object.assign(s, {ch: 60, al: 0, mass: 0});
    s.swirl.run = false;
  }
  if (s.fault === 'none') raise(s, 0); // no-op keeps the alarm table shape stable
  return s;
}

// ------------------------------------------------------------------ alarms
function raise(s, code) {
  if (!code) return;
  const a = s.alarms.find((x) => x.code === code);
  if (a) {
    a.active = true;
    return;
  }
  const rec = {code, text: ALARMS[code], t: s.t, active: true, ack: false};
  s.alarms.unshift(rec);
  s.history.unshift({...rec, kind: 'RAISED'});
  if (s.history.length > 200) s.history.length = 200;
}
const clear = (s, code) => {
  const a = s.alarms.find((x) => x.code === code);
  if (a && a.active) {
    a.active = false;
    s.history.unshift({code, text: a.text, t: s.t, kind: 'CLEARED'});
  }
};
const cond = (s, code, on) => (on ? raise(s, code) : clear(s, code));

// ------------------------------------------------------------------ derived signals: one place for every interlock
export function signals(s) {
  const level = levelOf(s);
  const gasLowOK = s.fault !== 'gasLow';
  const fanFault = s.fault === 'fanTrip';
  const airLowOK = s.fan.run && s.fan.speed > 0.8 && !fanFault;
  const airFlowOK = airLowOK && Math.max(...s.servo) > 0.05 || (airLowOK && ['PMAX', 'PMIN', 'FAN'].includes(s.seq));
  const doorClosed = s.door.pos < 0.01;
  const commsOK = s.fault !== 'hc01';
  const alTempOK = s.al >= P.alTransferMin && s.al <= s.sp.alHigh;
  const bathOK = level > s.sp.pumpMin;
  const pumpOK = s.hyd.run !== undefined && !s.estop;
  const trf = {
    hc01Emergency: !s.estop,
    gate: s.hc01.gate,
    comms: commsOK,
    bath: bathOK,
    hc01Temp: commsOK,
    ha01Temp: alTempOK,
    pump: pumpOK,
  };
  trf.permission = Object.values(trf).every(Boolean);
  const ilk = {
    hc01: commsOK && !s.estop && s.hc01.gate,
    temp: alTempOK,
    pumpPerm: bathOK && pumpOK && s.pump.auto,
    general: trf.permission,
  };
  const startOK = !s.estop && gasLowOK && !fanFault && s.ch < s.sp.chHigh && ['OFF'].includes(s.seq);
  const fireKW = (s.fire[0] + s.fire[1]) * P.burnerKW * (s.seq === 'RUN' || s.seq === 'LOW' ? 1 : s.seq === 'IGN' ? 1 : 0);
  return {
    level,
    tonnes: s.mass,
    gasLowOK,
    gasHighOK: true,
    airLowOK,
    airFlowOK,
    fanFault,
    doorClosed,
    trf,
    ilk,
    startOK,
    fireKW,
    gasM3h: (fireKW / P.lhv) * (s.ev.y1 ? 1 : 0),
    full: level >= P.rodLevel,
    swirlSafe: level >= P.swirlSafe,
    pumpSafe: level > s.sp.pumpMin,
    chSPeff: chamberSP(s),
  };
}

// In remote the aluminium controller writes the chamber set point (cascade); otherwise the operator's chamber SP holds.
function chamberSP(s) {
  if (!s.remote) return s.sp.ch;
  return clamp(s.sp.al + 35 + 2.5 * (s.sp.al - s.al), s.sp.al, s.sp.chHigh - 15);
}

// ------------------------------------------------------------------ operator commands (the HMI buttons call these)
export const cmd = {
  start(s) {
    const g = signals(s);
    if (g.startOK) setSeq(s, 'FAN');
    else note(s, s.seq === 'LOCKOUT' ? 'Reset the lockout first' : !g.gasLowOK ? 'Start blocked: gas pressure low' : s.estop ? 'Start blocked: emergency stop' : 'Burners already running');
  },
  stop(s) {
    if (['OFF', 'LOCKOUT', 'POST'].includes(s.seq)) return;
    closeGas(s);
    setSeq(s, 'POST');
  },
  reset(s) {
    if (s.seq === 'LOCKOUT' && !s.estop) {
      setSeq(s, 'OFF');
      s.tight = '';
    }
    if (s.fault !== 'fanTrip' && !s.fan.run) s.fan.speed = 0;
  },
  estop(s, on) {
    s.estop = on;
    if (on) {
      closeGas(s);
      s.fan.run = false;
      s.hyd.run = false;
      s.door.cmd = 0;
      s.tilt.cmd = 0;
      s.swirl.run = false;
      s.pump.run = false;
      setSeq(s, 'LOCKOUT');
    }
  },
  ack(s) {
    for (const a of s.alarms) a.ack = true;
  },
  clearAlarms(s) {
    s.alarms = s.alarms.filter((a) => a.active || !a.ack);
  },
  hyd(s, on) {
    if (on && s.estop) return note(s, 'Emergency stop pressed');
    s.hyd.run = on;
    if (!on) {
      s.door.cmd = 0;
      s.tilt.cmd = 0;
    }
  },
  door(s, dir) {
    if (!s.hyd.run) {
      raise(s, 70);
      return note(s, 'Start the hydraulic group first');
    }
    s.door.cmd = dir;
  },
  tilt(s, dir) {
    if (!s.hyd.run) {
      raise(s, 70);
      return note(s, 'Start the hydraulic group first');
    }
    if (dir > 0 && !s.tilt.locked) return note(s, 'Lock the ladle (tilt forward) before tilting up');
    if (dir > 0 && s.door.pos < 0.95) return note(s, 'Open the door before tilting up');
    if (dir > 0 && signals(s).full) return note(s, 'Full furnace: loading stopped');
    s.tilt.cmd = dir;
  },
  lock(s, on) {
    if (!s.hyd.run) return note(s, 'Start the hydraulic group first');
    if (!on && s.tilt.pos > 0.02) return note(s, 'Lower the platform before unlocking the ladle');
    s.tilt.locked = on;
  },
  newLadle(s) {
    if (s.tilt.pos > 0.02 || s.tilt.locked) return note(s, 'Lower the platform and unlock the ladle first');
    s.tilt.ladle = P.ladleT;
  },
  swirl(s, on) {
    if (on && !signals(s).swirlSafe) {
      raise(s, 61);
      return note(s, 'Bath below the Aluswirler safety level');
    }
    if (on && s.estop) return;
    s.swirl.run = on;
  },
  pump(s, on) {
    if (on) {
      const g = signals(s);
      if (!g.ilk.general) return note(s, 'Transfer interlocks not fulfilled');
    }
    s.pump.run = on;
  },
  hc01(s, on) {
    s.hc01.request = on;
  },
  remote(s) {
    s.remote = !s.remote;
  },
  setFault(s, f) {
    s.fault = f;
  },
};

function note(s, text) {
  s.log.unshift({t: s.t, text});
  if (s.log.length > 6) s.log.length = 6;
}
function setSeq(s, q) {
  s.seq = q;
  s.seqT = 0;
}
function closeGas(s) {
  Object.assign(s.ev, {y1: false, y2: false, y3: false, b1: false, b2: false});
}
function lockout(s, code) {
  closeGas(s);
  raise(s, code);
  setSeq(s, 'LOCKOUT');
}

// ------------------------------------------------------------------ the step
export function step(s, dt) {
  const n = Math.max(1, Math.ceil(dt / 0.1));
  for (let i = 0; i < n; i++) sub(s, dt / n);
}

function sub(s, dt) {
  s.t += dt;
  s.seqT += dt;
  const g = signals(s);

  // ---------------------------------------------------- combustion sequence
  const fanTarget = s.fan.run && !g.fanFault ? 1 : 0;
  s.fan.speed = approach(s.fan.speed, fanTarget, fanTarget ? 0.35 : 0.15, dt);
  let servoT = 0;
  let wantFlame = [false, false];
  let demand = 0;
  switch (s.seq) {
    case 'OFF':
      s.fan.run = false;
      s.tight = s.tight === 'OK' ? 'OK' : '';
      break;
    case 'FAN':
      s.fan.run = true;
      s.ev.y4 = true;
      servoT = 0.3;
      if (g.fanFault) lockout(s, 13);
      else if (g.airLowOK && s.seqT > 3) setSeq(s, 'PMAX');
      else if (s.seqT > 12) lockout(s, 12);
      break;
    case 'PMAX': {
      // 70Y1 pulses to charge the section between the valves, then everything holds closed for TEST_PMAX
      s.tight = 'TEST';
      s.ev.y1 = s.seqT < 2;
      s.testP = s.seqT < 2 ? Math.min(1, s.testP + dt) : s.testP;
      if (s.seqT >= P.pmax) setSeq(s, 'PMIN');
      break;
    }
    case 'PMIN': {
      // the section is vented by the main valves, then held: a rise means 70Y1 lets gas through
      s.ev.y1 = false;
      s.ev.y2 = s.seqT < 2;
      s.testP = s.seqT < 2 ? Math.max(0, s.testP - dt) : s.testP + (s.fault === 'leakY1' ? 0.08 * dt : 0);
      if (s.seqT >= P.pmin) {
        s.ev.y2 = false;
        if (s.testP > 0.3) {
          s.tight = 'F-EV1';
          lockout(s, 20);
        } else {
          s.tight = 'OK';
          setSeq(s, 'PURGE');
        }
      }
      break;
    }
    case 'PURGE':
      servoT = 1;
      if (!g.airLowOK) lockout(s, g.fanFault ? 13 : 12);
      else if (s.seqT >= P.purge) setSeq(s, 'IGN');
      break;
    case 'IGN':
      servoT = 0;
      if (s.seqT > 4) {
        Object.assign(s.ev, {y1: true, y2: true, y3: true, b1: true, b2: true});
        wantFlame = [true, s.fault !== 'flame2'];
        demand = P.lowFire;
      }
      if (s.seqT > 4 + P.safetyTime) {
        if (s.flame[0] < P.flameMin) lockout(s, 30);
        else if (s.flame[1] < P.flameMin) lockout(s, 31);
        else setSeq(s, 'LOW');
      }
      break;
    case 'LOW':
    case 'RUN': {
      wantFlame = [true, s.fault !== 'flame2'];
      if (s.seq === 'LOW') {
        demand = P.lowFire;
        if (s.seqT > 10) setSeq(s, 'RUN');
      } else {
        // PI on the chamber temperature
        const e = g.chSPeff - s.ch;
        s.tI = clamp(s.tI + 0.00025 * e * dt, -0.3, 0.6);
        demand = clamp(0.3 + 0.025 * e + s.tI, P.lowFire, 1);
      }
      if (s.door.pos > 0.02) demand = P.lowFire; // [M] door open → burners to minimum
      servoT = (demand - P.lowFire) / (1 - P.lowFire);
      if (!g.gasLowOK) lockout(s, 10);
      else if (g.fanFault) lockout(s, 13);
      else if (!g.airLowOK) lockout(s, 12);
      else if (s.ch > s.sp.chHigh) lockout(s, 40);
      else if (s.flame[0] < P.flameMin && s.seqT > 1) lockout(s, 30);
      else if (s.flame[1] < P.flameMin && s.seqT > 1) lockout(s, 31);
      else if (s.seq === 'RUN' && demand <= P.lowFire && s.door.pos < 0.02 && s.ch > g.chSPeff + 12) {
        closeGas(s);
        setSeq(s, 'HOLD');
      }
      break;
    }
    case 'HOLD':
      // gas shut, the fan keeps the chamber swept; below the set point the burners re-light without a new purge
      servoT = 0;
      if (!g.airLowOK) lockout(s, g.fanFault ? 13 : 12);
      else if (s.ch < g.chSPeff - 5 && s.seqT > 20) setSeq(s, 'IGN');
      break;
    case 'POST':
      s.fan.run = true;
      servoT = 1;
      if (s.seqT > 20) {
        s.fan.run = false;
        s.ev.y4 = false;
        setSeq(s, 'OFF');
      }
      break;
    case 'LOCKOUT':
      s.fan.run = false;
      s.ev.y4 = false;
      break;
  }
  if (g.fanFault && s.fan.run) raise(s, 13);
  for (let b = 0; b < 2; b++) {
    s.servo[b] = approach(s.servo[b], servoT, 0.25, dt);
    const lit = wantFlame[b] && s.ev.y1 && s.ev[b ? 'b2' : 'b1'];
    s.fire[b] = lit ? P.lowFire + (1 - P.lowFire) * s.servo[b] : 0;
    // ionisation current: ~14 µA at low fire, ~21 µA at full, a small deterministic flicker
    const tgt = lit ? 14 + 7 * s.servo[b] + 0.8 * Math.sin(s.t * 7.3 + b * 2) : 0;
    s.flame[b] = approach(s.flame[b], tgt, 12, dt);
  }
  void demand;

  // ---------------------------------------------------- heat
  const fireKW = (s.fire[0] + s.fire[1]) * P.burnerKW;
  s.gasM3 += (fireKW / P.lhv / 3600) * dt;
  const level = levelOf(s);
  const hasBath = s.mass > 0.3;
  const stir = s.swirl.rpm / P.swirlRpm;
  const qBath = hasBath ? P.hA * (1 + (P.stirGain - 1) * stir) * (s.ch - s.al) : 0;
  const qLoss = P.shellLoss * (s.ch - 25) + P.doorLossKW * s.door.pos * clamp((s.ch - 25) / 700, 0, 1.2);
  s.ch += ((fireKW * P.eff - qLoss - qBath) / P.cCh) * dt;
  if (hasBath) {
    const cAl = s.mass * 1000 * P.cpAl;
    s.al += ((qBath - 0.04 * (s.al - 25)) / cAl) * dt;
  } else s.al = s.ch * 0.92;

  // ---------------------------------------------------- furnace pressure: the flue damper PID holds the set point
  const pss = 0.42 * (s.fire[0] + s.fire[1]) + 0.18 * s.fan.speed - 0.9 * s.damper - 0.5 * s.door.pos + 0.25;
  s.pres += (pss - s.pres) * Math.min(1, dt / 1.5);
  const pe = s.pres - s.sp.press;
  s.pI = clamp(s.pI + 0.05 * pe * dt, -1, 1);
  s.damper = clamp(0.5 + 0.6 * pe + s.pI, 0, 1);

  // ---------------------------------------------------- hydraulics: door and tilting platform
  if (!s.hyd.run) {
    s.door.cmd = 0;
    s.tilt.cmd = 0;
  }
  s.door.pos = clamp(s.door.pos + (s.door.cmd / P.doorTime) * dt, 0, 1);
  if ((s.door.cmd > 0 && s.door.pos >= 1) || (s.door.cmd < 0 && s.door.pos <= 0)) s.door.cmd = 0;
  if (s.door.cmd < 0 && s.tilt.pos > 0.05) {
    s.door.cmd = 0;
    note(s, 'Door stopped: the platform is up');
  }
  if (s.tilt.cmd > 0 && g.full) {
    s.tilt.cmd = 0;
  }
  s.tilt.pos = clamp(s.tilt.pos + (s.tilt.cmd / P.tiltTime) * dt, 0, 1);
  if ((s.tilt.cmd > 0 && s.tilt.pos >= 1) || (s.tilt.cmd < 0 && s.tilt.pos <= 0)) s.tilt.cmd = 0;
  // pouring: the ladle lip passes the door sill past 55 % of the tilt
  const pourRate = s.tilt.pos > 0.55 && s.tilt.ladle > 0 ? 0.18 * ((s.tilt.pos - 0.55) / 0.45) : 0; // t/s
  if (pourRate > 0) {
    const dm = Math.min(s.tilt.ladle, pourRate * dt);
    if (s.mass > 0.3) s.al = (s.al * s.mass + P.ladleTemp * dm) / (s.mass + dm);
    else s.al = P.ladleTemp;
    s.mass += dm;
    s.tilt.ladle -= dm;
    s.tilt.poured = pourRate;
  } else s.tilt.poured = 0;

  // ---------------------------------------------------- Aluswirler and transfer pump
  if (s.swirl.run && level < P.swirlSafe) {
    s.swirl.run = false;
    raise(s, 61);
  }
  s.swirl.rpm = approach(s.swirl.rpm, s.swirl.run ? s.sp.rpm : 0, 80, dt);
  s.hc01.gate = s.hc01.request && s.fault !== 'hc01';
  if (s.pump.run && !g.ilk.general) {
    s.pump.run = false;
    note(s, 'Transfer stopped: interlock lost');
  }
  s.pump.flow = approach(s.pump.flow, s.pump.run ? P.pumpTpm : 0, 0.6, dt);
  if (s.pump.flow > 0) s.mass = Math.max(0, s.mass - (s.pump.flow / 60) * dt);

  // ---------------------------------------------------- alarm conditions
  cond(s, 1, s.estop);
  cond(s, 10, !g.gasLowOK);
  cond(s, 13, g.fanFault);
  cond(s, 40, s.ch > s.sp.chHigh);
  cond(s, 41, s.mass > 0.3 && s.al > s.sp.alHigh);
  cond(s, 42, s.mass > 0.3 && s.al < s.sp.alLow);
  cond(s, 50, g.full);
  cond(s, 60, s.mass > 0.3 && !g.pumpSafe);
  cond(s, 78, s.fault === 'hc01');
  if (s.hyd.run) clear(s, 70);
  if (g.swirlSafe) clear(s, 61);
  for (const c of [12, 20, 21, 30, 31]) if (s.seq !== 'LOCKOUT') clear(s, c);
  s.full = g.full;

  // ---------------------------------------------------- trends
  const tr = s.trend;
  tr.acc += dt;
  while (tr.acc >= 5) {
    tr.acc -= 5;
    tr.ch[tr.i] = s.ch;
    tr.chSP[tr.i] = chamberSP(s);
    tr.al[tr.i] = s.al;
    tr.alSP[tr.i] = s.sp.al;
    tr.i = (tr.i + 1) % TREND_N;
    tr.n = Math.min(TREND_N, tr.n + 1);
  }
}

// one trend sample right away so the chart is never empty
export function seedTrend(s) {
  const tr = s.trend;
  for (let k = 0; k < TREND_N; k++) {
    const w = Math.sin(k / 23) * 2.5 + Math.sin(k / 7) * 0.8;
    tr.ch[k] = s.ch + w;
    tr.chSP[k] = chamberSP(s);
    tr.al[k] = s.al + w * 0.2;
    tr.alSP[k] = s.sp.al;
  }
  tr.i = 0;
  tr.n = TREND_N;
}
