// Nutec-Thermo rotary degassing machine (machines 136–141, supplied March 2021): the process model. The HMI, the
// tower lamp, the jumbo display and every pose in the 3D view read the state this file advances. No three.js, no DOM.
//
// [M] = from the Working and Maintenance Manual. [A] = an assumption the manual does not give; all of them sit in P.

export const P = {
  // machine [M]
  powerKW: {baffle: 0.5, hydraulic: 1.5, rotor: 1.5, feeder: 0.25, total: 4},
  rotorMax: 650, //            rpm
  fluxCap: 25, //              kg in the hopper
  gasMaxLpm: 60,
  // hydraulic head and baffle [A]
  stroke: 1.35, //             m from home (upper limit) to the lower limit
  middleAt: 0.48, //           stroke fraction where the middle sensor sits: rotor just above the melt
  headSpeed: 0.12, //          m/s
  baffleTime: 6, //            s for a full baffle stroke
  // ladle [A]
  ladleKg: 980, //             0.9 m bore, 0.65 m of metal
  metalT0: 745, //             °C as tapped from the furnace
  h0: 0.28, //                 ml H2 / 100 g before treatment
  hEq: 0.06, //                floor the melt tends to under argon
  kH: 4.7e-5, //               removal constant per lpm, scaled by (rpm/400)^1.5
  coolIdle: 1.2 / 60, //       °C/s radiation from the ladle
  coolGas: 0.0006 / 60, //     °C/s per lpm of argon
  fluxLowKg: 2, //             flux-low switch in the hopper
  linePress: 2.2, //           bar, regulated argon line pressure
};

// operator settings: defaults inside the ranges the manual gives [M ranges, A values]
export const DEFAULTS = {
  downDelay: 3, //   s  Rotor down delay (pre-set 3 s) [M]
  vortex: 2, //      min Vortex formation (100–180 s) [M range]
  fluxing: 1, //     min [A]
  mixing: 1, //      min [A]
  degassing: 15, //  min (10–20 min) [M range]
  upDelay: 3, //     s  Rotor up delay (pre-set 3 s) [M]
  pMin: 1, //        bar minimum gas pressure [M]
  pMax: 3, //        bar maximum gas pressure [M]
  lowMin: 6, lowMax: 20, //   lpm low flow window (vortex 6–20 lpm) [M]
  highMin: 25, highMax: 60, // lpm high flow window (degassing 25–60 lpm) [M]
  low: 15, //        lpm low flow used [A]
  high: 40, //       lpm high flow used [A]
  speed1: 150, //    rpm Speed 1 (max 200) [M max]
  speed2: 600, //    rpm Speed 2 (max 650) — vortex, flux, mixing [M max]
  speed3: 400, //    rpm Speed 3 (max 450) — degassing [M max]
  fluxRate: 180, //  g/min (100–250 g/min) [M range]
};

// alarm numbers and texts exactly as in the PLC list of the manual
export const ALARMS = {
  1: 'MPCB-1_Vane Feeder_Tripped',
  2: 'MPCB-2_Rotor on_Tripped',
  3: 'MPCB-3_Hydraulic_Tripped',
  4: 'MPCB-4_Baffle up/down_Tripped',
  5: 'C2 Vane feeder contactor',
  6: 'C3 Rotor On contractor',
  7: 'C4_Hyd. On Contactor',
  8: 'C5_BaffleUpContactor',
  9: 'C6_BaffleDownContactor',
  10: 'Emergency stop Pressed',
  11: 'Waiting For Reset',
  12: 'Gas Pressure Low',
  13: 'Rotor Middel Limit switch not in Position',
  14: 'Flex Low',
};

export const FAULTS = {
  none: 'No fault',
  gasLow: 'Argon pressure low (cylinder empty)',
  rotorTrip: 'Rotor motor MPCB-2 trips',
  hydTrip: 'Hydraulic motor MPCB-3 trips',
  feederTrip: 'Vane feeder MPCB-1 trips',
  baffleTrip: 'Baffle motor MPCB-4 trips',
  fluxLow: 'Flux hopper runs low',
  middle: 'Middle sensor out of position',
};

// the auto cycle, in the order of the Process screen
export const STEPS = ['HOME', 'DOWN_DELAY', 'DOWN', 'VORTEX', 'FLUX', 'MIX', 'BAFFLE_DOWN', 'DEGAS', 'BAFFLE_UP', 'UP_DELAY', 'UP', 'DONE'];
export const STEP_TEXT = {
  IDLE: 'READY · ROTOR AT HOME',
  HOME: 'READY · ROTOR AT HOME',
  DOWN_DELAY: 'ROTOR DOWN DELAY',
  DOWN: 'ROTOR GOING DOWN',
  VORTEX: 'VORTEX FORMATION',
  FLUX: 'FLUX FEEDING',
  MIX: 'MIXING',
  BAFFLE_DOWN: 'BAFFLE GOING DOWN',
  DEGAS: 'DEGASSING',
  BAFFLE_UP: 'BAFFLE GOING UP',
  UP_DELAY: 'ROTOR UP DELAY',
  UP: 'ROTOR GOING UP',
  DONE: 'CYCLE COMPLETE · ROTOR AT HOME',
  ABORT: 'CYCLE ABORTED · RETURNING HOME',
  STOPPED: 'STOPPED · WAITING FOR RESET',
};

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const approach = (x, tgt, rate, dt) => (x < tgt ? Math.min(tgt, x + rate * dt) : Math.max(tgt, x - rate * dt));

export function createPlant(scenario = 'ready') {
  const s = {
    t: 0,
    control: true,
    mode: 'AUTO', // AUTO | MANUAL
    step: 'IDLE',
    stepT: 0,
    timer: 0, // process time since the lower limit [M: "timer is activated to show the process time"]
    set: {...DEFAULTS},
    head: 0, // stroke fraction 0 home .. 1 lower limit
    headCmd: 0, // -1 up, 0, +1 down
    baffle: 0, // 0 up .. 1 down
    baffleCmd: 0,
    hyd: false,
    drive: false,
    speedSel: 0, // 0 none, 1, 2, 3
    rpm: 0,
    gas: 'OFF', // OFF | LOW | HIGH
    flow: 0, // lpm
    linePress: P.linePress,
    feeder: false,
    fluxKg: 18,
    fluxUsed: 0,
    // the melt
    metalT: P.metalT0,
    h: P.h0,
    hStart: P.h0,
    vortex: 0, // 0..1 visible vortex depth
    estop: false,
    resetNeeded: false,
    fault: 'none',
    alarms: [], // {no, t, active}
    log: [],
    // what the cycle has done, for the report line
    done: {vortex: 0, flux: 0, mix: 0, degas: 0},
  };
  if (scenario === 'manual') s.mode = 'MANUAL';
  return s;
}

// ------------------------------------------------------------------ derived signals
export function signals(s) {
  const upperLS = s.head <= 0.002;
  const lowerLS = s.head >= 0.998;
  const middle = s.fault !== 'middle' && s.head >= P.middleAt - 0.02;
  const immersed = s.head > P.middleAt + 0.05;
  const baffleUp = s.baffle <= 0.002;
  const baffleDown = s.baffle >= 0.998;
  const pressOK = s.linePress >= s.set.pMin;
  return {
    upperLS,
    lowerLS,
    middle,
    immersed,
    baffleUp,
    baffleDown,
    pressOK,
    fluxOK: s.fluxKg > P.fluxLowKg,
    rotorOK: s.fault !== 'rotorTrip',
    hydOK: s.fault !== 'hydTrip',
    feederOK: s.fault !== 'feederTrip',
    baffleOK: s.fault !== 'baffleTrip',
    healthy: !s.estop && !s.resetNeeded && pressOK && s.fault !== 'rotorTrip' && s.fault !== 'hydTrip' && s.control,
    di: densityIndex(s.h),
  };
}

// reduced-pressure test density index, % [A]: ~9.5 % at 0.28 ml/100 g, under 2 % below 0.10 ml/100 g
export const densityIndex = (h) => clamp(45 * (h - 0.07), 0.5, 20);

function raise(s, no) {
  const a = s.alarms.find((x) => x.no === no && x.active);
  if (a) return;
  s.alarms.unshift({no, t: s.t, active: true});
  if (s.alarms.length > 60) s.alarms.length = 60;
}
function clearAlarm(s, no) {
  for (const a of s.alarms) if (a.no === no) a.active = false;
}
function note(s, text) {
  s.log.unshift({t: s.t, text});
  if (s.log.length > 6) s.log.length = 6;
}
function setStep(s, st) {
  s.step = st;
  s.stepT = 0;
}

// ------------------------------------------------------------------ operator commands
export const cmd = {
  cycleStart(s) {
    const g = signals(s);
    if (s.mode !== 'AUTO') return note(s, 'Select AUTO mode first');
    if (!g.healthy) return note(s, s.resetNeeded ? 'Press RESET first' : !g.pressOK ? 'Gas pressure low' : 'Machine not healthy');
    if (!g.upperLS) return note(s, 'Rotor must start from the home position');
    if (!['IDLE', 'HOME', 'DONE'].includes(s.step)) return note(s, 'Cycle already running');
    s.timer = 0;
    s.hStart = s.h;
    s.done = {vortex: 0, flux: 0, mix: 0, degas: 0};
    setStep(s, 'DOWN_DELAY');
  },
  cycleStop(s) {
    if (s.mode === 'AUTO' && !['IDLE', 'HOME', 'DONE', 'ABORT', 'STOPPED'].includes(s.step)) abort(s, 'Cycle stopped by operator');
  },
  reset(s) {
    if (s.estop) return note(s, 'Release the emergency stop first');
    s.resetNeeded = false;
    clearAlarm(s, 11);
    if (s.step === 'STOPPED') setStep(s, signals(s).upperLS ? 'IDLE' : 'ABORT');
  },
  estop(s, on) {
    s.estop = on;
    if (on) {
      s.headCmd = 0;
      s.baffleCmd = 0;
      s.hyd = false;
      s.drive = false;
      s.feeder = false;
      s.resetNeeded = true;
      setStep(s, 'STOPPED');
    }
  },
  mode(s, m) {
    if (!['IDLE', 'HOME', 'DONE', 'STOPPED'].includes(s.step) && m !== s.mode) return note(s, 'Finish or stop the cycle before changing mode');
    s.mode = m;
    if (m === 'MANUAL') setStep(s, 'IDLE');
  },
  clearAlarms(s) {
    s.alarms = s.alarms.filter((a) => a.active);
  },
  set(s, key, v) {
    s.set[key] = v;
  },
  // manual functions [M "functions of manual mode"]
  manual(s, fn) {
    if (s.mode !== 'MANUAL') return note(s, 'Select MANUAL mode for these functions');
    if (s.estop) return note(s, 'Emergency stop pressed');
    const g = signals(s);
    switch (fn) {
      case 'hydOn':
        if (!g.hydOK) return raise(s, 3);
        s.hyd = true;
        break;
      case 'hydOff':
        s.hyd = false;
        s.headCmd = 0;
        break;
      case 'rotorDown':
        if (!s.hyd) return note(s, 'Switch the hydraulic ON first');
        s.headCmd = 1;
        break;
      case 'rotorUp':
        if (!s.hyd) return note(s, 'Switch the hydraulic ON first');
        if (g.baffleDown || s.baffle > 0.05) return note(s, 'Raise the baffle before the rotor');
        s.headCmd = -1;
        break;
      case 'baffleDown':
        if (!g.baffleOK) return raise(s, 4);
        if (!g.lowerLS) return note(s, 'Lower the rotor to the lower limit first');
        s.baffleCmd = 1;
        break;
      case 'baffleUp':
        if (!g.baffleOK) return raise(s, 4);
        s.baffleCmd = -1;
        break;
      case 'feederOn':
        if (!g.feederOK) return raise(s, 1);
        if (!g.fluxOK) return raise(s, 14);
        s.feeder = true;
        break;
      case 'feederOff':
        s.feeder = false;
        break;
      case 'gasLow':
        s.gas = 'LOW';
        break;
      case 'gasHigh':
        s.gas = 'HIGH';
        break;
      case 'gasOff':
        s.gas = 'OFF';
        break;
      case 'driveOn':
        if (!g.rotorOK) return raise(s, 2);
        if (g.immersed && s.flow < 1) return note(s, 'Open the gas before turning the rotor in the melt');
        s.drive = true;
        if (!s.speedSel) s.speedSel = 1;
        break;
      case 'driveOff':
        s.drive = false;
        break;
      case 'speed1':
      case 'speed2':
      case 'speed3':
        s.speedSel = Number(fn.slice(-1));
        break;
    }
  },
  setFault(s, f) {
    s.fault = f;
    if (f === 'fluxLow') s.fluxKg = Math.min(s.fluxKg, 1.2);
    if (f === 'none') {
      s.linePress = P.linePress;
      if (s.fluxKg < P.fluxLowKg + 0.5) s.fluxKg = 18;
    }
  },
  newLadle(s) {
    if (!signals(s).upperLS) return note(s, 'Raise the rotor to home before changing the ladle');
    s.metalT = P.metalT0;
    s.h = P.h0;
    s.hStart = P.h0;
    s.timer = 0;
    s.done = {vortex: 0, flux: 0, mix: 0, degas: 0};
    if (s.step === 'DONE') setStep(s, 'IDLE');
  },
  refillFlux(s) {
    s.fluxKg = P.fluxCap;
    if (s.fault === 'fluxLow') s.fault = 'none';
  },
};

// a fault in the cycle: feeder off, keep argon flowing while the rotor is in the melt, baffle up, rotor home
function abort(s, why) {
  note(s, why);
  s.feeder = false;
  s.resetNeeded = true;
  raise(s, 11);
  setStep(s, 'ABORT');
}

// ------------------------------------------------------------------ the step
export function step(s, dt) {
  const n = Math.max(1, Math.ceil(dt / 0.1));
  for (let i = 0; i < n; i++) sub(s, dt / n);
}

function sub(s, dt) {
  s.t += dt;
  s.stepT += dt;
  let g = signals(s);
  const set = s.set;
  // gas supply: the cylinder runs empty under the gasLow fault
  s.linePress = approach(s.linePress, s.fault === 'gasLow' ? 0.4 : P.linePress, 0.5, dt);

  // ---------------------------------------------------- auto sequence
  if (s.mode === 'AUTO') {
    const atDone = () => {
      s.headCmd = 0;
    };
    switch (s.step) {
      case 'IDLE':
      case 'HOME':
      case 'DONE':
        s.hyd = false;
        s.drive = false;
        s.gas = 'OFF';
        s.feeder = false;
        s.speedSel = 0;
        atDone();
        break;
      case 'DOWN_DELAY':
        s.hyd = true;
        if (s.stepT >= set.downDelay) setStep(s, 'DOWN');
        break;
      case 'DOWN':
        s.hyd = true;
        s.headCmd = 1;
        // the middle sensor: rotor starts at speed 1 and argon flows at low flow before the rotor enters the melt
        if (g.middle) {
          s.drive = true;
          s.speedSel = 1;
          s.gas = 'LOW';
        }
        if (g.lowerLS) {
          s.headCmd = 0;
          if (!s.drive) {
            raise(s, 13);
            abort(s, 'Rotor reached the bottom without the middle sensor');
            break;
          }
          s.timer = 0;
          setStep(s, 'VORTEX');
        }
        break;
      case 'VORTEX':
        s.speedSel = 2;
        s.gas = 'LOW';
        s.done.vortex = s.stepT;
        if (s.stepT >= set.vortex * 60) setStep(s, 'FLUX');
        break;
      case 'FLUX':
        s.speedSel = 2;
        s.gas = 'LOW';
        s.feeder = true;
        s.done.flux = s.stepT;
        if (!g.fluxOK) {
          raise(s, 14);
          s.feeder = false;
          note(s, 'Flux low: feeding stopped, cycle continues');
          setStep(s, 'MIX');
        } else if (s.stepT >= set.fluxing * 60) {
          s.feeder = false;
          setStep(s, 'MIX');
        }
        break;
      case 'MIX':
        s.speedSel = 2;
        s.gas = 'LOW';
        s.feeder = false;
        s.done.mix = s.stepT;
        if (s.stepT >= set.mixing * 60) setStep(s, 'BAFFLE_DOWN');
        break;
      case 'BAFFLE_DOWN':
        s.gas = 'HIGH';
        s.speedSel = 3;
        s.baffleCmd = 1;
        if (g.baffleDown) {
          s.baffleCmd = 0;
          setStep(s, 'DEGAS');
        } else if (!g.baffleOK) {
          raise(s, 4);
          abort(s, 'Baffle motor tripped');
        }
        break;
      case 'DEGAS':
        s.gas = 'HIGH';
        s.speedSel = 3;
        s.done.degas = s.stepT;
        if (s.stepT >= set.degassing * 60) setStep(s, 'BAFFLE_UP');
        break;
      case 'BAFFLE_UP':
        s.gas = 'LOW';
        s.speedSel = 1;
        s.baffleCmd = -1;
        if (g.baffleUp) {
          s.baffleCmd = 0;
          setStep(s, 'UP_DELAY');
        }
        break;
      case 'UP_DELAY':
        s.gas = 'LOW';
        s.speedSel = 1;
        if (s.stepT >= set.upDelay) setStep(s, 'UP');
        break;
      case 'UP':
      case 'ABORT':
        s.feeder = false;
        if (s.step === 'ABORT' && s.baffle > 0.002 && g.baffleOK) {
          s.baffleCmd = -1;
          s.headCmd = 0;
        } else {
          s.baffleCmd = 0;
          s.hyd = g.hydOK && !s.estop;
          s.headCmd = s.hyd ? -1 : 0;
        }
        // argon keeps flowing and the rotor turns slowly until it is out of the melt
        if (g.immersed) {
          s.gas = g.pressOK ? 'LOW' : s.gas;
          s.speedSel = 1;
          s.drive = g.rotorOK;
        } else {
          s.drive = false;
          s.gas = 'OFF';
        }
        if (g.upperLS) {
          s.headCmd = 0;
          s.hyd = false;
          if (s.step === 'UP') {
            setStep(s, 'DONE');
            note(s, 'Cycle complete');
          } else setStep(s, s.resetNeeded ? 'STOPPED' : 'IDLE');
        }
        break;
      case 'STOPPED':
        s.drive = false;
        s.feeder = false;
        s.headCmd = 0;
        if (!g.immersed) s.gas = 'OFF';
        break;
    }
    // faults that end the cycle
    const running = !['IDLE', 'HOME', 'DONE', 'ABORT', 'STOPPED'].includes(s.step);
    if (running) {
      if (!g.pressOK) {
        raise(s, 12);
        abort(s, 'Gas pressure low: rotor returns home');
      } else if (!g.rotorOK && s.drive) {
        raise(s, 2);
        abort(s, 'Rotor motor tripped');
      } else if (!g.hydOK) {
        raise(s, 3);
        abort(s, 'Hydraulic motor tripped');
      } else if (!g.feederOK && s.feeder) {
        raise(s, 1);
        s.feeder = false;
        abort(s, 'Vane feeder tripped');
      }
    }
  }

  // ---------------------------------------------------- actuators
  g = signals(s);
  if (!g.hydOK) {
    s.hyd = false;
    raise(s, 3);
  }
  if (!g.rotorOK && s.drive) {
    s.drive = false;
    raise(s, 2);
  }
  if (!g.feederOK && s.feeder) {
    s.feeder = false;
    raise(s, 1);
  }
  if (s.estop) {
    s.hyd = s.drive = s.feeder = false;
    s.headCmd = s.baffleCmd = 0;
    raise(s, 10);
  } else clearAlarm(s, 10);
  const headV = (P.headSpeed / P.stroke) * dt;
  if (s.hyd && s.headCmd) s.head = clamp(s.head + s.headCmd * headV, 0, 1);
  if ((s.headCmd > 0 && s.head >= 1) || (s.headCmd < 0 && s.head <= 0)) s.headCmd = 0;
  if (s.baffleCmd && g.baffleOK && !s.estop) s.baffle = clamp(s.baffle + (s.baffleCmd / P.baffleTime) * dt, 0, 1);
  else if (s.baffleCmd && !g.baffleOK) raise(s, 4);
  if ((s.baffleCmd > 0 && s.baffle >= 1) || (s.baffleCmd < 0 && s.baffle <= 0)) s.baffleCmd = 0;
  const rpmT = s.drive ? [0, set.speed1, set.speed2, set.speed3][s.speedSel] || 0 : 0;
  s.rpm = approach(s.rpm, Math.min(rpmT, P.rotorMax), 220, dt);
  const flowT = !g.pressOK ? 0 : s.gas === 'HIGH' ? set.high : s.gas === 'LOW' ? set.low : 0;
  s.flow = approach(s.flow, flowT, 30, dt);
  if (s.feeder) {
    const kg = (set.fluxRate / 1000 / 60) * dt;
    s.fluxKg = Math.max(0, s.fluxKg - kg);
    if (g.immersed) s.fluxUsed += kg * 1000;
    if (!g.fluxOK) {
      raise(s, 14);
      if (s.mode === 'MANUAL') s.feeder = false;
    }
  }
  if (g.fluxOK) clearAlarm(s, 14);
  if (g.pressOK) clearAlarm(s, 12);

  // ---------------------------------------------------- the melt
  const inMelt = g.immersed ? 1 : 0;
  const k = P.kH * s.flow * Math.pow(s.rpm / 400, 1.5) * inMelt;
  s.h = Math.max(P.hEq, s.h - k * (s.h - P.hEq) * dt);
  s.metalT -= (P.coolIdle + P.coolGas * s.flow * inMelt) * dt;
  // a vortex opens with speed above ~300 rpm while the baffle is up, and closes as the baffle goes in
  const vT = inMelt * clamp((s.rpm - 300) / 300, 0, 1) * (1 - s.baffle);
  s.vortex = approach(s.vortex, vT, 0.6, dt);
  if (s.mode === 'AUTO' && !['IDLE', 'HOME', 'DONE', 'STOPPED'].includes(s.step) && s.head >= 0.998) s.timer += dt;
}
