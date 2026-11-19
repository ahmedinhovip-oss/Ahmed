// Ingot casting machine (ENTEC Industrial Furnaces): the plant model. Built from the "User manual & ingot casting
// machine troubleshooting". A chain conveyor of moulds runs on a 5 HP motor with a Sumiko SU-412 gearbox, speed set by
// a potentiometer on the 5 HP VFD panel. Metal tilted out of the furnace runs down the launder to the distributor
// (star wheel), which fills the moulds as they pass. Water sprays under the moulds cool the ingots on their way to the
// discharge end, where the moulds turn over and two hammers knock the ingots out. The water goes from the machine tank
// to the cooling tower and back to the sprays with the inlet and outlet pumps.
//
// [M] = from the manual. [A] = an assumption the manual does not give; all of them sit in P.

export const P = {
  length: 11.6, //       m  shaft centres [A, read from the drawing ~12.6 m overall]
  pitch: 0.22, //        m  mould pitch along the chain [A]
  radius: 0.35, //       m  sprocket pitch radius [A]
  vMax: 6.0, //          m/min conveyor at full potentiometer [A]
  ingot: 10, //          kg full ingot [A]
  motorHP: 5, //         [M] 5 HP motor, Crompton Greaves; gearbox SU-412 Sumiko
  metalLo: 700, metalHi: 750, // °C at the distributor [M]
  distLo: 100, distHi: 150, //   °C distributor preheat [M], 1 h with torch burners [M]
  distPreheatMin: 60, // min [M]
  mouldCoat: 150, //     °C minimum mould temperature for die coat [M "usually 150"]
  dischargeLo: 150, dischargeHi: 250, // °C ingot at the discharge [M]
  hammerEff: 0.875, //   [M] 85–90 %
  towerMin: 80, //       % cooling tower tank [M]
  castMax: 120, //       min casting, then 30 min cool down [M]
  coolDown: 30, //       min [M]
  water: 30, //          °C water at the sprays [A]
  kAir: 0.0018, //       1/s cooling of an ingot in air [A]
  kWater: 0.013, //      1/s extra cooling at 100 % spray [A]
  kFan: 0.0012, //       1/s pedestal fan at the discharge [A]
  spill: 70, //          % spray above which water spills onto the moulds [A]
  potRate: 25, //        %/s potentiometer change above which the conveyor jerks [A]
  torchRate: 2.0, //     °C/min distributor heating with the torch, so ~1 h to 120 °C [A]
  mouldTorch: 6.0, //    °C/min mould heating with the torch [A]
};
export const LOOP = 2 * P.length + 2 * Math.PI * P.radius;
export const N = Math.floor(LOOP / P.pitch);
export const PITCH = LOOP / N;
// positions along the loop, from the pour end: 0 = top of the rear sprocket; the top strand runs to the discharge
export const U_POUR = 0.9; //              m from the start of the top strand [A]
export const U_DISCH = P.length + Math.PI * P.radius * 0.5; // the turn at the discharge sprocket
export const U_TOPEND = P.length;

export const ALARMS = {
  1: 'CONVEYOR VFD TRIP',
  2: 'WATER PUMP INLET (WP-1) TRIP',
  3: 'MOULD NOT EMPTIED · INGOT RETURNING TO THE DISTRIBUTOR',
  4: 'WATER ON THE MOULDS · RISK OF BLAST',
  5: 'METAL AT DISTRIBUTOR OUT OF 700–750 °C',
  6: 'INGOT AT DISCHARGE ABOVE 250 °C',
  7: 'COOLING TOWER TANK BELOW 80 %',
  8: 'CONVEYOR VIBRATION',
  9: 'EMERGENCY STOP PRESSED',
  10: 'CASTING OVER 2 H · LET THE CONVEYOR COOL 30 MIN',
  11: 'MOULDS OVERFLOWING',
};

export const FAULTS = {
  none: 'No fault',
  chain: 'Chain too loose',
  bearing: 'Plummer block bearing broken',
  shaft: 'Shaft bent at the discharge side',
  drive: 'Loose connection at the drive',
  far: 'AC drive 20 m from the machine',
  wp1: 'Water pump inlet trips',
};

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const approach = (x, tgt, rate, dt) => (x < tgt ? Math.min(tgt, x + rate * dt) : Math.max(tgt, x - rate * dt));
const hash = (i) => {
  const x = Math.sin(i * 91.7 + 17.3) * 43758.5453;
  return x - Math.floor(x);
};

export function createPlant(scenario = 'cold') {
  const ready = scenario === 'ready';
  const moulds = [];
  for (let i = 0; i < N; i++) moulds.push({fill: 0, T: ready ? 160 : 35, ingot: false, Ti: 0, stuck: false, cycles: 0, defect: '', coat: ready, clean: ready});
  return {
    t: 0,
    mcb: true,
    estop: false,
    conv: false, // conveyor drive running
    convTrip: false,
    pot: ready ? 55 : 0, // % potentiometer
    potSet: ready ? 55 : 0,
    potJerk: 0,
    v: 0, // m/min actual
    u: 0, // m chain travel
    wp1: false, wp2: false, wp1Trip: false, auto: false, // inlet / outlet pumps, A/M selector of WP-1 [M]
    tower: false, // cooling tower fan
    towerTank: ready ? 90 : 62, // %
    machTank: 70, // % water tank under the machine
    waterT: P.water,
    spray: ready ? 45 : 0, // % spray flow / pressure valve
    lube: ready, // chain lubricated before casting
    lubeValve: false, // ball valve of the chain lubrication
    gearOil: ready, // gearbox oil level checked / filled
    hammers: 'locked', // 'locked' | 'free'
    operator: true, // a person at the discharge side
    fan: false, // pedestal fan at the discharge
    torchDist: false,
    torchMould: false,
    distT: ready ? 130 : 30,
    distHeatMin: ready ? 60 : 0,
    pour: 0, // t/h from the furnace (tilt)
    metalT: 725, // °C at the distributor
    castMin: 0, // min of casting since the last cool down
    restMin: 999,
    vib: 0, // mm/s vibration
    moulds,
    made: {good: 0, bad: 0, kg: 0, released: 0, knocked: 0},
    lastIngot: null,
    dischT: 0, // IR sensor 1 reading at the discharge
    steps: {},
    alarms: [],
    events: [],
    log: [],
    fault: 'none',
    accident: false,
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
  if (s.events.find((e) => e.text === text && s.t - e.t < 120)) return;
  s.events.unshift({t: s.t, kind, text});
  if (s.events.length > 40) s.events.length = 40;
  note(s, text);
}

// where a mould is: x along the machine (pour end +L/2, discharge -L/2), y of the chain, angle, top strand or not
export function mouldPose(u) {
  const L = P.length;
  const R = P.radius;
  const a = ((u % LOOP) + LOOP) % LOOP;
  if (a < L) return {x: L / 2 - a, y: 0, ang: 0, top: true};
  if (a < L + Math.PI * R) {
    const th = (a - L) / R;
    return {x: -L / 2 - R * Math.sin(th), y: -R + R * Math.cos(th), ang: th, top: false};
  }
  if (a < 2 * L + Math.PI * R) return {x: -L / 2 + (a - L - Math.PI * R), y: -2 * R, ang: Math.PI, top: false};
  const th = (a - 2 * L - Math.PI * R) / R;
  return {x: L / 2 + R * Math.sin(th), y: -R - R * Math.cos(th), ang: Math.PI + th, top: false};
}
export const mouldU = (s, i) => s.u + i * PITCH;

export const cmd = {
  mcb(s, on) {
    s.mcb = on;
    if (!on) (s.conv = false), (s.wp1 = s.wp2 = false), (s.tower = false);
  },
  estop(s, on) {
    s.estop = on;
    if (on) (s.conv = false), (s.pour = 0);
  },
  convStart(s) {
    if (s.estop) return note(s, 'Release the emergency stop first');
    if (!s.mcb) return note(s, 'Switch on the main MCB first');
    if (s.convTrip) return note(s, 'Drive in trip: find the cause, then reset');
    if (!s.lube) event(s, 'warn', 'Conveyor started without lubricating the chain');
    if (!s.gearOil) event(s, 'warn', 'Conveyor started without checking the gearbox oil');
    if (s.hammers !== 'locked' && !s.moulds.some((m) => m.ingot)) event(s, 'bad', 'Hammers not locked: they hit the empty moulds');
    if (s.restMin < P.coolDown && s.castMin === 0 && s.restMin > 0) event(s, 'warn', 'Restarted before the 30 min cool down');
    s.conv = true;
  },
  convStop(s) {
    s.conv = false;
  },
  reset(s) {
    if (s.fault === 'drive' || s.fault === 'far') return note(s, 'The drive trips again: check its connections and its distance to the machine');
    s.convTrip = false;
    s.wp1Trip = s.fault === 'wp1' ? s.wp1Trip : false;
  },
  pot(s, v) {
    const nv = clamp(Math.round(v), 0, 100);
    s.potSet = nv;
  },
  pump(s, k, on) {
    if (on && !s.mcb) return note(s, 'Switch on the main MCB first');
    if (k === 1) {
      if (on && s.wp1Trip) return note(s, 'WP-1 in trip');
      s.wp1 = on;
    } else s.wp2 = on;
  },
  auto(s, on) {
    s.auto = on;
  },
  tower(s, on) {
    if (on && !s.mcb) return note(s, 'Switch on the main MCB first');
    s.tower = on;
  },
  fillTower(s) {
    s.towerTank = 95;
    note(s, 'Cooling tower tank filled to 95 %');
  },
  spray(s, v) {
    s.spray = clamp(Math.round(v), 0, 100);
  },
  lube(s) {
    s.lube = true;
    note(s, 'Chain lubricated');
  },
  lubeValve(s, on) {
    s.lubeValve = on;
  },
  gearOil(s) {
    s.gearOil = true;
    note(s, 'Gearbox oil level checked and topped up');
  },
  hammers(s, st) {
    s.hammers = st;
  },
  operator(s, on) {
    s.operator = on;
  },
  fan(s, on) {
    s.fan = on;
  },
  torch(s, which, on) {
    if (which === 'dist') s.torchDist = on;
    else s.torchMould = on;
  },
  clean(s) {
    if (s.conv) return note(s, 'Stop the conveyor to clean the moulds');
    for (const m of s.moulds) if (!m.ingot) m.clean = true;
    note(s, 'Moulds cleaned with a wire brush');
  },
  coat(s) {
    if (s.conv) return note(s, 'Stop the conveyor to coat the moulds');
    let cold = 0;
    for (const m of s.moulds) {
      if (m.T < P.mouldCoat - 10) cold++;
      m.coat = true;
    }
    if (cold > N * 0.3) event(s, 'bad', 'Die coat applied on cold moulds: it will not bond (needs about 150 °C)');
    else note(s, 'Die coat applied on the mould bases');
  },
  pour(s, tph) {
    s.pour = clamp(tph, 0, 20);
  },
  metal(s, T) {
    s.metalT = clamp(T, 620, 820);
  },
  tighten(s) {
    if (s.conv) return note(s, 'Stop the conveyor first');
    s.steps.after = true;
    note(s, 'Bolts at the moulds and the plummer blocks checked and tightened; chips removed');
  },
  setFault(s, f) {
    s.fault = f;
    if (f === 'wp1') s.wp1Trip = true;
    if (f === 'none') (s.wp1Trip = false), (s.convTrip = false);
  },
};

export function step(s, dt) {
  // potentiometer: turned faster than P.potRate (over this step) jerks the conveyor [M]
  const dp = Math.abs(s.potSet - s.pot);
  if (dp > 1 && dp / Math.max(dt, 1e-6) > P.potRate && s.conv) {
    s.potJerk = 1;
    event(s, 'bad', 'Potentiometer turned abruptly: the conveyor jerks and the ingots ripple');
  }
  s.pot = s.potSet;
  const n = Math.max(1, Math.ceil(dt / 0.1));
  for (let i = 0; i < n; i++) sub(s, dt / n);
}

function sub(s, dt) {
  s.t += dt;
  const min = dt / 60;
  s.potJerk = Math.max(0, s.potJerk - dt / 4);
  // drive
  const driveOK = s.mcb && !s.estop && !s.convTrip;
  s.faultRun = (s.fault === 'drive' || s.fault === 'far') && s.conv && s.v > 0.5 ? (s.faultRun || 0) + dt : 0;
  if (s.faultRun > 45) {
    s.convTrip = true;
    s.conv = false;
    raise(s, 1);
    event(s, 'bad', 'Drive shows an error with vibration: loose connection or faulty drive');
  }
  const vT = s.conv && driveOK ? (P.vMax * s.pot) / 100 : 0;
  s.v = approach(s.v, vT, 3, dt);
  s.u += (s.v / 60) * dt;
  // vibration [M troubleshooting]
  let vib = s.v > 0.05 ? 0.6 : 0;
  if (s.v > 0.05) {
    if (s.fault === 'chain') vib += 4.5;
    if (s.fault === 'bearing') vib += 6;
    if (s.fault === 'shaft') vib += 3.5;
    if (s.fault === 'drive' || s.fault === 'far') vib += 3;
    if (!s.lube) vib += 1.5;
    if (!s.gearOil) vib += 1;
    vib += s.potJerk * 5;
  }
  s.vib = approach(s.vib, vib, 6, dt);
  // water: WP-2 machine tank → tower, WP-1 tower → sprays [M]; auto mode runs WP-1 with the conveyor [M A/M]
  if (s.fault === 'wp1' && (s.wp1 || (s.auto && s.conv))) s.wp1Trip = true;
  const wp1On = s.mcb && !s.wp1Trip && (s.wp1 || (s.auto && s.conv));
  s.wp1Run = wp1On;
  const sprayFlow = wp1On && s.towerTank > 5 ? s.spray / 100 : 0;
  s.sprayFlow = sprayFlow;
  const out = wp1On ? 0.25 * sprayFlow : 0;
  // WP-2 returns what the sprays put in the machine tank, holding it near half full [A]
  const back = s.wp2 && s.mcb ? Math.max(0, out + 0.01 * (s.machTank - 50)) : 0;
  s.towerTank = clamp(s.towerTank + (back * (s.machTank > 5 ? 1 : 0) - out) * dt * 0.6, 0, 100);
  s.machTank = clamp(s.machTank + (out - back * (s.machTank > 5 ? 1 : 0)) * dt * 0.6, 0, 100);
  // preheat [M]
  if (s.torchDist) {
    s.distT = Math.min(260, s.distT + (P.torchRate * dt) / 60);
    s.distHeatMin += min;
  } else s.distT = approach(s.distT, s.pour > 0 ? s.metalT * 0.55 : 30, 0.02, dt);
  // the moulds
  const pourKgS = (s.pour * 1000) / 3600;
  const kWater = P.kWater * sprayFlow;
  let dischSeen = null;
  let heat = 0;
  for (let i = 0; i < N; i++) {
    const m = s.moulds[i];
    const u0 = mouldU(s, i) - (s.v / 60) * dt;
    const u1 = mouldU(s, i);
    const pose = mouldPose(u1);
    const a0 = ((u0 % LOOP) + LOOP) % LOOP;
    const a1 = ((u1 % LOOP) + LOOP) % LOOP;
    const crossed = (x) => (a0 < x && a1 >= x) || (a0 > a1 && (a0 < x || a1 >= x));
    // mould heating by the torch while standing (top strand, near the pour end) [A]
    if (s.torchMould && pose.top) m.T = Math.min(320, m.T + (P.mouldTorch * dt) / 60);
    // pouring: the distributor fills each mould as it passes
    if (s.pour > 0 && crossed(U_POUR)) {
      if (m.ingot || m.stuck) {
        s.accident = true;
        s.conv = false;
        s.pour = 0;
        raise(s, 3);
        event(s, 'bad', 'ACCIDENT: an ingot not released came round to the distributor and was poured on');
        continue;
      }
      const kg = s.v > 0.05 ? pourKgS * (PITCH / (s.v / 60)) : P.ingot * 3;
      m.fill = kg;
      m.ingot = true;
      m.Ti = s.metalT;
      m.cycles = 0;
      let d = '';
      if (kg > P.ingot * 1.1) d = 'overfilled';
      else if (kg < P.ingot * 0.85) d = 'underfilled';
      if (s.metalT < P.metalLo || s.distT < P.distLo - 20 || m.T < 100) d = d || 'cold lap';
      if (s.potJerk > 0.3 || s.vib > 4) d = d || 'ripples';
      if (!m.clean) d = d || 'dirt / burr';
      if (s.metalT > P.metalHi + 20) d = d || 'dross';
      if (m.T < 100 || (s.spray > P.spill && sprayFlow > 0)) {
        event(s, 'bad', 'Metal poured into a wet or cold mould: steam blast risk');
      }
      m.defect = d;
    }
    // cooling of the ingot and of the mould
    if (m.ingot && pose.top) heat += Math.max(0, m.Ti - 100);
    if (m.ingot) {
      const k = P.kAir + (pose.top ? kWater : 0) + (s.fan && pose.x < -P.length / 2 + 2 ? P.kFan : 0);
      m.Ti = P.water + (m.Ti - P.water) * Math.exp(-k * dt);
      m.T = Math.max(m.T, m.Ti * 0.8);
    } else {
      const k = 0.0006 + (pose.top ? kWater * 0.15 : 0);
      if (!s.torchMould || !pose.top) m.T = P.water + (m.T - P.water) * Math.exp(-k * dt);
    }
    // discharge: the hammers knock the ingot out as the mould turns over [M]
    if (crossed(U_DISCH)) {
      if (m.ingot) {
        dischSeen = m.Ti;
        const eff = (s.hammers === 'free' ? P.hammerEff : 0) * (m.coat ? 1 : 0.55);
        let rel = hash(i * 7 + Math.floor(s.u / LOOP) * 131) < eff;
        if (!rel && s.operator) {
          rel = true;
          s.made.knocked++;
          note(s, 'Ingot stuck: the operator knocks it out at the discharge');
        }
        if (rel) {
          let d = m.defect;
          if (m.Ti > P.dischargeHi + 100) d = d || 'not solid at discharge';
          s.lastIngot = {T: m.Ti, kg: m.fill, defect: d};
          s.made.released++;
          s.made.kg += m.fill;
          if (d) s.made.bad++;
          else s.made.good++;
          m.ingot = false;
          m.stuck = false;
          m.fill = 0;
        } else {
          m.stuck = true;
          event(s, 'bad', s.hammers === 'free' ? 'Ingot not released at the discharge and nobody there to knock it out' : 'Hammers locked with filled moulds: ingots ride round');
        }
      } else if (s.hammers === 'free' && s.v > 0.05) {
        event(s, 'warn', 'Hammers hitting the empty moulds');
      }
    }
  }
  // water temperature: heat from the ingots, removed by the tower fan [A]
  s.waterT = clamp(s.waterT + (heat * 0.00004 * sprayFlow - (s.tower ? 0.02 : 0.003) * (s.waterT - P.water)) * dt, P.water, 95);
  if (dischSeen !== null) s.dischT = dischSeen;
  else s.dischT = approach(s.dischT, 30, 1, dt * (s.moulds.some((m) => m.ingot) ? 0 : 1));
  // casting duty [M]
  const casting = s.conv && s.pour > 0;
  if (casting) {
    s.castMin += min;
    s.restMin = 0;
  } else if (!s.conv) {
    s.restMin += min;
    if (s.restMin >= P.coolDown) s.castMin = 0;
  }
  if (casting && !s.lubeValve) event(s, 'warn', 'Lubrication ball valve closed during casting');
  if (casting && s.towerTank < P.towerMin) event(s, 'warn', 'Cooling tower tank below 80 % while casting');
  if (s.pour > 0 && !s.conv) event(s, 'bad', 'Pouring with the conveyor stopped: the mould overflows');
  // the procedure, ticked as it is done [M]
  const S = s.steps;
  if (!s.conv && s.hammers === 'locked') S.hammers = true;
  if (s.lube) S.lube = true;
  if (s.gearOil) S.oil = true;
  if (s.moulds.every((m) => m.clean || m.ingot)) S.clean = true;
  if (s.distT >= P.distLo && s.distT <= P.distHi + 30 && s.distHeatMin >= P.distPreheatMin - 1) S.dist = true;
  if (s.moulds.filter((m) => m.T >= P.mouldCoat - 10).length > N * 0.7) S.mould = true;
  if (s.moulds.every((m) => m.coat)) S.coat = true;
  if (s.conv && s.v > 0.1) S.conv = true;
  if (s.lubeValve && s.conv) S.valve = true;
  if (s.tower && wp1On && s.wp2 && s.towerTank >= P.towerMin) S.water = true;
  if (sprayFlow > 0.15 && s.spray <= P.spill) S.spray = true;
  if (s.pour > 0 && s.metalT >= P.metalLo && s.metalT <= P.metalHi) S.pour = true;
  if (s.lastIngot && !s.lastIngot.defect && s.made.good >= 3) S.speed = true;
  if (s.hammers === 'free' && s.made.released > 0) S.release = true;
  if (s.lastIngot && s.lastIngot.T >= P.dischargeLo && s.lastIngot.T <= P.dischargeHi) S.disch = true;
  // alarms
  cond(s, 1, s.convTrip);
  cond(s, 2, s.wp1Trip);
  if (!s.accident) cond(s, 3, s.moulds.some((m) => m.stuck));
  cond(s, 4, sprayFlow > 0 && s.spray > P.spill);
  cond(s, 5, s.pour > 0 && (s.metalT < P.metalLo || s.metalT > P.metalHi));
  cond(s, 6, s.made.released > 0 && s.dischT > P.dischargeHi && s.v > 0.05);
  cond(s, 7, s.towerTank < P.towerMin);
  cond(s, 8, s.vib > 3);
  cond(s, 9, s.estop);
  cond(s, 10, s.castMin > P.castMax);
  cond(s, 11, s.pour > 0 && (!s.conv || (s.v > 0.05 && pourKgS * (PITCH / (s.v / 60)) > P.ingot * 1.1)));
}

export function rates(s) {
  const mpm = s.v / PITCH; // moulds per minute
  const perMould = s.v > 0.05 ? ((s.pour * 1000) / 60) / mpm : 0;
  const vMatch = s.pour > 0 ? (((s.pour * 1000) / 60 / P.ingot) * PITCH) : 0; // m/min for a full ingot
  return {mpm, perMould, vMatch, potMatch: (vMatch / P.vMax) * 100};
}
