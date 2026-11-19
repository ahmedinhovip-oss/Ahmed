// SWM#1, FVGP-A 3-30 sidewell melting furnace with the Aluswirler vortex: the plant model behind the procedure
// trainer. Built from the user manual "Procedures" (document 5.3, 1987-MA-005-0-OTE-MOP-003). The trainer, the
// cabinet and the 3D view all read this state; operator actions go through cmd and are checked against the manual.
//
// [M] = from the manual. [A] = an assumption the manual does not give; all of them sit in P.

export const P = {
  purge: 300, //               s [M] 5 min purge, "Combustion fan running" light flashing
  burnerKW: 1500, //           [A] per burner, two burners (201SH5, 202SH1) [M]
  lowFire: 0.2, //             [A]
  eff: 0.5, //                 [A]
  cCh: 9000, //                [A] kJ/K chamber
  shellLoss: 0.1, //           [A] kW/K
  hA: 5, //                    [A] kW/K chamber to bath
  warmSP: 925, //              [M] 900/950 °C high set point to load liquid aluminium on a hot chamber
  alSP: 730, //                [A] operating aluminium set point
  area: 12.6, rho: 2.37, //    [A] hearth m², t/m³ (30 t at about 1 m)
  levelMin: 500, //            [A] mm minimum level to generate the vortex [M: exists]
  levelMax: 950, //            [A] mm furnace capacity maximum level [M: exists]
  pumpMin: 300, //             [M] mm minimum aluminium height for the extraction pump
  pumpTpm: 0.6, //             [A] t/min to HC#1
  ladleT: 3, ladleTemp: 760, // [A]
  scrapMax: 3000, //           [A] kg/h a stable vortex can swallow
  impHold: 1200, //            [M] s hold 25 mm above the bath (20 min)
  stageGap: 600, //            [M] s per third of the blade length (10 min)
  bubbles: 1800, //            [M] s of steam bubbles from a ceramic piece (about 30 min)
  retighten: 7200, //          [M] s before hot re-tightening of the bowl screws (2 h)
  dryHours: 24, //             [M] h drying on the vault at 80–90 °C
  superheat: 40, //            [M] °C above the usual SP before immersing a new impeller
  testSpeed: 10, //            [M] % first turns
  doorTime: 14, //             [A] s for a full door stroke
};

const mm2t = (mm) => (P.area * mm * P.rho) / 1000;
export const levelOf = (s) => (s.mass * 1000) / (P.area * P.rho);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const approach = (x, tgt, rate, dt) => (x < tgt ? Math.min(tgt, x + rate * dt) : Math.max(tgt, x - rate * dt));

export const ALARMS = {
  1: 'BURNER 1 IGNITION FAILURE',
  2: 'BURNER 2 IGNITION FAILURE',
  3: 'TIGHTNESS CONTROL FAULT',
  4: 'SAFETY RELAY NOT RESET',
  5: 'NO GAS PRESSURE AT THE INLET',
  6: 'MAIN DOOR OPEN · BURNERS AT MINIMUM',
  7: 'LEVEL BELOW ALUSWIRLER MINIMUM · NO VORTEX',
  8: 'LEVEL BELOW PUMP MINIMUM (300 mm)',
  9: 'FURNACE AT MAXIMUM LEVEL',
  10: 'VORTEX NOT SWALLOWING · SCRAP ACCUMULATING',
  11: 'AGGRESSIVE VORTEX · FLAMES AND SLAG',
  12: 'IMPELLER CRACKED',
  13: 'LIQUID ALUMINIUM LEVEL DETECTOR DIRTY',
};

export const FAULTS = {
  none: 'No fault',
  leak: 'Gas leak between solenoid valves',
  burner2: 'Burner 2 does not light',
  noGas: 'No gas at the inlet manometer',
  levelDirty: 'Level detector dirty',
  wetScrap: 'Wet / oily scrap delivered',
};

export function createPlant(scenario = 'cold') {
  const hot = scenario !== 'cold';
  const s = {
    t: 0,
    q20: hot,
    aux: hot,
    safety: hot,
    fan: {run: hot, purge: hot ? P.purge : 0},
    tight: hot ? 'OK' : '', // '', TEST, OK, FAIL
    tightTries: 0,
    mainValve: hot,
    sel: hot ? ['ON', 'ON'] : ['OFF', 'OFF'],
    burner: hot ? ['on', 'on'] : ['off', 'off'], // off, ign, on, fail
    ignT: [0, 0],
    fire: [0, 0],
    chT: hot ? 820 : 35,
    alT: hot ? 735 : 35,
    chSP: hot ? 820 : 120,
    alSP: P.alSP,
    mass: hot ? mm2t(scenario === 'empty' ? 380 : 720) : 0,
    door: {pos: 0, cmd: 0, locked: false},
    platDoor: true, // vault and Aluswirler platform access door closed
    ladle: {t: P.ladleT, tilt: 0, pouring: false},
    asw: {
      run: hot,
      mode: 'MAN', // 208SH2
      speed: hot ? 45 : 0, // % on 208S1
      rpm: 0,
      pos: hot ? 'working' : 'working', // working | raised | maint | over | lowering
      lift: 0, // m above the working position
      x: 0, // 0 over the well, 1 at the maintenance support
      immersion: hot ? 1 : 1, // 0..1 of the blade length L under the bath
      clips: true,
      imp: {present: true, cracked: false, dry: true, aligned: true, tight: true, retightened: true, placedAt: -1e9, lastStage: -1e9, firstWet: -1e9, holdStart: -1, stages: 3, newPiece: false},
      cool: 0,
    },
    vortex: {depth: 0, state: 'none'}, // none | weak | stable | aggressive
    scrap: {on: false, rate: 1500, type: 'chip', quality: 'clean', buffer: 0, melted: 0, slag: 0, flames: 0},
    pump: {in: hot, run: false, flow: 0},
    plugs: {
      pneu: {open: false, lock: true, cone: 'old', tray: false, coneSteps: 0},
      aswA: {open: false, lock: true, tray: false},
      vortexB: {open: false, lock: true, tray: false},
      pumpM: {open: false, lock: true, tray: false},
    },
    surfaceSlag: hot ? 1 : 0, // 0..1 on the chamber surface
    chamberSlag: hot ? 0.6 : 0,
    skims: 0,
    inspect: {}, // P1 inspection ticks
    fault: 'none',
    alarms: [],
    events: [], // violations and good-practice notes the trainer scores
    log: [],
    silenced: false,
  };
  if (scenario === 'fill') {
    // hot chamber, metal below the vortex minimum, a full ladle on the tilting platform
    s.mass = mm2t(340);
    s.asw.run = false;
    s.asw.speed = 0;
    s.chT = 935;
    s.chSP = 925;
    s.surfaceSlag = 0;
  }
  if (scenario === 'drained') {
    s.mass = 0;
    s.asw.run = false;
    s.asw.speed = 0;
    s.chamberSlag = 0;
    s.surfaceSlag = 0;
    s.pump.in = false;
  }
  return s;
}

// ------------------------------------------------------------------ signals
export function signals(s) {
  const level = levelOf(s);
  const gasOK = s.fault !== 'noGas' && s.q20;
  const purged = s.fan.run && s.fan.purge >= P.purge;
  const doorClosed = s.door.pos < 0.01;
  const optimal = 30 + (35 * (level - P.levelMin)) / (P.levelMax - P.levelMin); // [A] best 208S1 % for the level
  return {
    level,
    gasOK,
    purged,
    doorClosed,
    optimal,
    aswInWell: s.asw.pos === 'working' && s.asw.lift < 0.01 && s.asw.x < 0.01,
    vortexOK: level >= P.levelMin,
    pumpOK: level >= P.pumpMin,
    fanLamp: !s.fan.run ? 'off' : purged ? 'on' : 'flash',
    permanentOK: doorClosed && s.sel[0] === 'ON' && s.sel[1] === 'ON',
  };
}

function raise(s, no) {
  if (s.alarms.find((a) => a.no === no && a.active)) return;
  s.alarms.unshift({no, t: s.t, active: true});
  if (s.alarms.length > 60) s.alarms.length = 60;
  s.silenced = false;
}
function cond(s, no, on) {
  if (on) return raise(s, no);
  for (const a of s.alarms) if (a.no === no) a.active = false;
}
function note(s, text) {
  s.log.unshift({t: s.t, text});
  if (s.log.length > 6) s.log.length = 6;
}
// a violation of the manual (kind 'bad') or a caution (kind 'warn'), scored by the trainer
function event(s, kind, text, ref) {
  if (s.events.find((e) => e.text === text && s.t - e.t < 60)) return;
  s.events.unshift({t: s.t, kind, text, ref});
  if (s.events.length > 40) s.events.length = 40;
  note(s, text);
}

// ------------------------------------------------------------------ operator actions
export const cmd = {
  q20(s, on) {
    s.q20 = on;
    if (!on) {
      if (levelOf(s) > 50) event(s, 'bad', 'Main switch 20Q1 off with metal in the furnace', '§5');
      Object.assign(s, {aux: false, mainValve: false});
      s.fan.run = false;
      s.asw.run = false;
      s.pump.run = false;
    }
  },
  aux(s) {
    if (!s.q20) return note(s, 'Switch 20Q1 on first');
    s.aux = true;
  },
  safetyReset(s) {
    if (!s.aux) return note(s, 'Activate the auxiliary connection first');
    s.safety = true;
    for (const a of s.alarms) if (a.no === 4) a.active = false;
  },
  fanStart(s) {
    if (!s.safety) {
      raise(s, 4);
      return note(s, 'Safety relay not reset');
    }
    if (!s.fan.run) {
      s.fan.run = true;
      s.fan.purge = 0;
      s.tight = 'TEST';
    }
  },
  fanStop(s) {
    if (s.burner.some((b) => b === 'on')) event(s, 'bad', 'Combustion fan stopped with burners firing', '§5');
    s.fan.run = false;
    s.mainValve = false;
    s.burner = ['off', 'off'];
  },
  openMainValve(s) {
    const g = signals(s);
    if (!g.purged) return note(s, 'Wait for the purge to finish (lamp steady)');
    if (s.tight !== 'OK') return note(s, 'Tightness control not passed');
    if (!g.gasOK) {
      raise(s, 5);
      return note(s, 'No gas pressure at the inlet manometer');
    }
    s.mainValve = true;
  },
  selector(s, i, pos) {
    if (pos === 'RESET') {
      if (s.burner[i] === 'fail') s.burner[i] = 'off';
      cond(s, i + 1, false);
      s.sel[i] = 'RESET';
      return;
    }
    s.sel[i] = pos;
  },
  silence(s) {
    s.silenced = true;
  },
  setSP(s, which, v) {
    if (which === 'ch') {
      if (s.chT < 200 && v > 600 && s.t < 3600 * 8) event(s, 'warn', 'Chamber SP raised straight to high from cold: heat gradually over a day so moisture can escape', '§2.5');
      s.chSP = v;
    } else s.alSP = v;
  },
  door(s, dir) {
    if (dir > 0 && s.door.locked) return note(s, 'Door is locked open');
    if (dir < 0 && s.door.locked) return note(s, 'Unlock the door before closing it');
    if (dir > 0 && s.scrap.on) event(s, 'bad', 'Main door opened while loading scrap into the vortex', '§3');
    s.door.cmd = dir;
  },
  doorLock(s, on) {
    if (on && s.door.pos < 0.99) return note(s, 'Open the door fully before locking it');
    s.door.locked = on;
  },
  skim(s) {
    if (s.door.pos < 0.99 || !s.door.locked) return note(s, 'Open the main door fully and lock it before cleaning');
    s.chamberSlag = Math.max(0, s.chamberSlag - 0.2);
    s.skims++;
    if (s.chamberSlag <= 0.001) note(s, 'Chamber clean: slag dragged from back to front into the bins');
  },
  pourLadle(s) {
    if (s.door.pos < 0.95) return note(s, 'Open the main door to pour the ladle');
    if (s.ladle.t <= 0) return note(s, 'The ladle is empty');
    if (s.chT < 850) event(s, 'warn', 'Liquid aluminium loaded on a chamber below 900/950 °C', '§2.7');
    s.ladle.pouring = true;
  },
  newLadle(s) {
    s.ladle.t = P.ladleT;
    s.ladle.tilt = 0;
  },
  aswRun(s, on) {
    if (on && !s.q20) return note(s, 'Switch 20Q1 on first');
    if (on && !signals(s).aswInWell) return note(s, 'The Aluswirler is not in its working position');
    s.asw.run = on;
  },
  aswMode(s, m) {
    s.asw.mode = m;
  },
  aswSpeed(s, v) {
    const a = s.asw;
    const imp = a.imp;
    v = clamp(Math.round(v), 0, 100);
    if (v > P.testSpeed && !imp.retightened && a.run) {
      event(s, 'bad', 'Speed raised above 10 % before the hot re-tightening of the bowl screws', '§6.4.6');
    }
    a.speed = v;
  },
  scrap(s, on) {
    if (on) {
      const g = signals(s);
      if (!g.doorClosed) return event(s, 'bad', 'Scrap loading with the main door open', '§3');
      if (!g.vortexOK) return note(s, 'Level below the minimum to generate a vortex');
      if (s.scrap.quality !== 'clean') event(s, 'bad', 'Wet, oily or painted scrap fed to the vortex: splash and explosion risk', '§6.4.8');
    }
    s.scrap.on = on;
  },
  scrapQuality(s, q) {
    s.scrap.quality = q;
  },
  scrapType(s, k) {
    s.scrap.type = k;
  },
  scrapRate(s, v) {
    s.scrap.rate = clamp(v, 0, 5000);
  },
  pump(s, on) {
    if (on && !s.pump.in) return note(s, 'The extraction pump is not in its working position');
    if (on && levelOf(s) < P.pumpMin) {
      raise(s, 8);
      return note(s, 'Level below the 300 mm pump minimum');
    }
    if (on && levelOf(s) < P.levelMin + 20) event(s, 'warn', 'Transferring close to the Aluswirler minimum level', '§3');
    s.pump.run = on;
  },
  pumpRemove(s) {
    if (s.pump.run) return note(s, 'Stop the pump first (Annex, procedure 8.2)');
    s.pump.in = !s.pump.in;
  },
  // ---- the Aluswirler assembly on the hoist (impeller change)
  hoist(s, act) {
    const a = s.asw;
    if (act === 'up') {
      if (a.run || a.rpm > 1) return event(s, 'bad', 'Impeller lifted while rotating: molten metal thrown from the impeller', '§6.3.3');
      if (a.clips && a.pos === 'working') return note(s, 'Loosen the clamping clips first');
      a.pos = 'raised';
    } else if (act === 'toMaint') {
      if (a.pos !== 'raised') return note(s, 'Raise the assembly with the hoist first');
      a.pos = 'maint';
      a.cool = 0;
    } else if (act === 'toWell') {
      if (a.pos !== 'maint') return note(s, 'The assembly is not on the maintenance support');
      if (!a.imp.present) return note(s, 'Fit an impeller first');
      a.pos = 'over';
    } else if (act === 'descend') {
      // slow descent to 25 mm above the bath, then the 20 min hold
      if (a.pos !== 'over') return note(s, 'Move the assembly over the well first');
      if (!a.imp.cleanVolute) event(s, 'warn', 'Volute not cleaned before the new impeller', '§6.4.5');
      a.pos = 'lowering';
      a.immersion = 0;
      a.imp.holdStart = s.t;
      a.imp.lastStage = s.t;
    } else if (act === 'third') {
      if (a.pos !== 'lowering') return note(s, 'Lower the assembly to 25 mm above the bath first');
      const imp = a.imp;
      if (a.immersion === 0 && s.t - imp.holdStart < P.impHold) event(s, 'bad', 'Immersion started before the 20 min hold at 25 mm above the bath', '§6.4.5');
      if (s.alT < s.alSP + P.superheat - 2) event(s, 'warn', 'Bath not 40 °C above the usual SP: aluminium may solidify on the impeller', '§6.4.5');
      const gap = s.t - imp.lastStage;
      if (a.immersion > 0 && gap < P.stageGap) {
        if (gap < P.stageGap / 2) {
          imp.cracked = true;
          raise(s, 12);
          event(s, 'bad', 'Immersed faster than 1/3 of the blade every 10 min: thermal shock, the impeller cracked', '§6.4.5');
        } else event(s, 'warn', 'Third lowered before 10 min: thermal shock risk', '§6.4.5');
      }
      if (a.immersion > 0 && s.t - imp.firstWet < P.bubbles && imp.newPiece) event(s, 'warn', 'Lowered while steam bubbles were still visible around the shaft', '§6.4.5');
      if (a.immersion === 0) imp.firstWet = s.t;
      if (!imp.dry) {
        imp.cracked = true;
        raise(s, 12);
        event(s, 'bad', 'Ceramic piece not dried 24 h: steam explosion risk, the impeller cracked', '§6.4.4');
      }
      a.immersion = Math.min(1, a.immersion + 1 / 3);
      imp.lastStage = s.t;
      if (a.immersion >= 0.999) {
        a.pos = 'working';
        a.clips = false;
        imp.placedAt = s.t;
        note(s, 'Assembly resting on its support: fix it with the clips');
      }
    }
  },
  clips(s, on) {
    if (on && s.asw.pos !== 'working') return note(s, 'The assembly is not on its support');
    s.asw.clips = on;
  },
  removeImpeller(s) {
    const a = s.asw;
    if (a.pos !== 'maint') return note(s, 'Move the assembly to the maintenance support first');
    if (a.cool < 600) event(s, 'warn', 'Impeller removed before it cooled down', '§6.3.3');
    a.imp.present = false;
  },
  fitImpeller(s, dried) {
    const a = s.asw;
    if (a.pos !== 'maint') return note(s, 'Move the assembly to the maintenance support first');
    if (a.imp.present) return note(s, 'Remove the old impeller first');
    a.imp = {present: true, cracked: false, dry: dried, aligned: false, tight: false, retightened: false, placedAt: -1e9, lastStage: -1e9, firstWet: -1e9, holdStart: -1, stages: 0, newPiece: true, bolted: true};
  },
  align(s) {
    const a = s.asw;
    if (a.pos !== 'maint' || !a.imp.present) return note(s, 'Fit the impeller on the maintenance support first');
    a.imp.aligned = true;
    note(s, 'Turned at 10 %, checked against the reference, alignment screws adjusted');
  },
  tighten(s) {
    const a = s.asw;
    if (!a.imp.aligned) event(s, 'bad', 'Through bolts tightened before the impeller was aligned', '§6.4.4');
    a.imp.tight = true;
  },
  cleanVolute(s) {
    s.asw.imp.cleanVolute = true;
  },
  retighten(s) {
    const a = s.asw;
    if (a.pos !== 'working') return note(s, 'The impeller is not in its working position');
    if (s.t - a.imp.placedAt < P.retighten - 60) event(s, 'warn', 'Bowl screws re-tightened before the 2 h in the metal', '§6.4.6');
    if (a.run) event(s, 'bad', 'Re-tightening with the impeller turning: stop it first', '§6.4.6');
    a.imp.retightened = true;
  },
  dryOnVault(s) {
    note(s, 'Impeller left on the vault at 80–90 °C for 24 h');
    s.asw.dried = true;
  },
  // ---- plugs (emptying)
  tray(s, k) {
    s.plugs[k].tray = true;
  },
  lock(s, k, on) {
    s.plugs[k].lock = on;
  },
  cone(s, step) {
    const p = s.plugs.pneu;
    // the manual's order: 1 take a new cone, 2 open plug, 3 clean the metal cone, 4 place the new cone, 5 clean the hole
    if (step !== p.coneSteps + 1) event(s, 'warn', 'Ceramic cone steps out of the manual order', '§6.2.2');
    p.coneSteps = Math.max(p.coneSteps, step);
    if (step === 4) p.cone = 'new';
  },
  plug(s, k, open) {
    const p = s.plugs[k];
    if (open) {
      if (p.lock) return event(s, 'bad', 'Plug opened without removing the mechanical lock', '§6.2.2');
      if (!p.tray) event(s, 'bad', 'Plug opened with no tray or bin under it', '§6.2.2');
      if (s.surfaceSlag > 0.2) event(s, 'warn', 'Surface slag not removed before emptying: outlets may block', '§6.2.2');
      if (k === 'pumpM' && s.pump.in) return note(s, 'Remove the extraction pump before its manual plug');
      if (k !== 'pneu' && levelOf(s) > P.pumpMin + 30) event(s, 'warn', 'Manual plug opened before draining by pump and pneumatic plug', '§6.2.2');
    }
    p.open = open;
  },
  skimSurface(s) {
    s.surfaceSlag = Math.max(0, s.surfaceSlag - 0.35);
  },
  inspectItem(s, k) {
    s.inspect[k] = true;
    if (k === 'levelDet' && s.fault === 'levelDirty') {
      raise(s, 13);
      return note(s, 'Level detector dirty: clean the sensor');
    }
  },
  cleanSensor(s) {
    if (s.fault === 'levelDirty') s.fault = 'none';
    cond(s, 13, false);
    s.inspect.levelDet = true;
  },
  platDoor(s, closed) {
    s.platDoor = closed;
  },
  setFault(s, f) {
    s.fault = f;
    if (f === 'wetScrap') s.scrap.quality = 'wet';
    if (f === 'none' && s.scrap.quality === 'wet') s.scrap.quality = 'clean';
  },
};

// ------------------------------------------------------------------ the step
export function step(s, dt) {
  const n = Math.max(1, Math.ceil(dt / 0.25));
  for (let i = 0; i < n; i++) sub(s, dt / n);
}

function sub(s, dt) {
  s.t += dt;
  const g = signals(s);
  const level = g.level;
  // combustion: purge, tightness during the purge, burners on their selectors
  if (s.fan.run && s.q20) {
    s.fan.purge += dt;
    if (s.tight === 'TEST' && s.fan.purge > P.purge * 0.6) {
      if (s.fault === 'leak') {
        s.tight = 'FAIL';
        s.tightTries++;
        raise(s, 3);
      } else s.tight = 'OK';
    }
  } else if (!s.fan.run) {
    s.fan.purge = 0;
    if (s.tight !== 'FAIL') s.tight = '';
  }
  for (let b = 0; b < 2; b++) {
    const want = s.sel[b] === 'ON' && s.mainValve && g.purged && g.gasOK;
    if (!want) {
      if (s.burner[b] !== 'fail') s.burner[b] = 'off';
    } else if (s.burner[b] === 'off') {
      s.burner[b] = 'ign';
      s.ignT[b] = 0;
    }
    if (s.burner[b] === 'ign') {
      s.ignT[b] += dt;
      if (s.ignT[b] > 5) {
        if (b === 1 && s.fault === 'burner2') {
          s.burner[b] = 'fail';
          raise(s, 2);
        } else s.burner[b] = 'on';
      }
    }
    if (s.sel[b] === 'RESET' && s.burner[b] !== 'fail') s.sel[b] = 'ON';
    // temperature control: proportional on the chamber, minimum with the door open [A]
    let demand = 0;
    if (s.burner[b] === 'on') {
      demand = clamp(0.2 + (s.chSP - s.chT) / 60, P.lowFire, 1);
      if (!g.doorClosed) demand = P.lowFire;
      if (s.chT > s.chSP + 15) demand = 0;
    }
    s.fire[b] = approach(s.fire[b], demand, 0.3, dt);
  }
  cond(s, 6, !g.doorClosed && s.burner.some((b) => b === 'on'));

  // heat
  const fireKW = (s.fire[0] + s.fire[1]) * P.burnerKW;
  const hasBath = s.mass > 0.3;
  const stir = s.asw.rpm > 5 ? 1.5 : 1;
  const qBath = hasBath ? P.hA * stir * (s.chT - s.alT) : 0;
  const qLoss = P.shellLoss * (s.chT - 25) + 200 * s.door.pos * clamp((s.chT - 25) / 700, 0, 1.2);
  s.chT += ((fireKW * P.eff - qLoss - qBath) / P.cCh) * dt;
  if (hasBath) {
    const c = s.mass * 1180;
    // scrap takes its melting heat out of the bath (about 1.1 MJ/kg to melt from cold) [A]
    const meltKW = (s.scrap.meltRate || 0) * 1100 / 3600;
    s.alT += ((qBath - 0.04 * (s.alT - 25) - meltKW) / c) * dt;
  } else s.alT = s.chT * 0.9;

  // main door and the ladle
  s.door.pos = clamp(s.door.pos + (s.door.cmd / P.doorTime) * dt, 0, 1);
  if ((s.door.cmd > 0 && s.door.pos >= 1) || (s.door.cmd < 0 && s.door.pos <= 0)) s.door.cmd = 0;
  if (s.ladle.pouring) {
    s.ladle.tilt = approach(s.ladle.tilt, 1, 0.08, dt);
    if (s.ladle.tilt > 0.6 && s.ladle.t > 0) {
      const dm = Math.min(s.ladle.t, 0.15 * dt);
      s.alT = s.mass > 0.3 ? (s.alT * s.mass + P.ladleTemp * dm) / (s.mass + dm) : P.ladleTemp;
      s.mass += dm;
      s.ladle.t -= dm;
    }
    if (s.ladle.t <= 0) s.ladle.pouring = false;
  } else s.ladle.tilt = approach(s.ladle.tilt, 0, 0.1, dt);

  // Aluswirler: speed from 208S1 in MAN; AUTO keeps the speed that suits the level [A]
  const a = s.asw;
  if (a.mode === 'AUTO' && a.run) a.speed = Math.round(approach(a.speed, g.optimal, 2, dt));
  const canTurn = a.run && s.q20 && g.aswInWell && a.imp.present && !a.imp.cracked;
  a.rpm = approach(a.rpm, canTurn ? a.speed * 6 : 0, canTurn ? 120 : 400, dt); // [A] 600 rpm at 100 %; braked to a stop
  if (a.pos === 'maint') a.cool += dt;
  if (a.pos === 'working' && !a.clips && a.run && a.rpm > 1) event(s, 'bad', 'Aluswirler turning before it was fixed with the clips', '§6.4.5');
  // the vortex: needs the minimum level; best near the speed that suits the level
  const pct = a.rpm / 6;
  const dev = pct - g.optimal;
  let vstate = 'none';
  if (a.rpm > 5 && g.vortexOK) vstate = dev < -10 ? 'weak' : dev > 15 ? 'aggressive' : 'stable';
  s.vortex.state = vstate;
  s.vortex.depth = approach(s.vortex.depth, vstate === 'none' ? 0 : clamp(pct / 80, 0, 1.2), 0.5, dt);
  // scrap into the vortex
  const sc = s.scrap;
  if (sc.on && (!g.vortexOK || !g.doorClosed)) sc.on = false;
  const feed = sc.on ? sc.rate : 0; // kg/h
  const swallow = vstate === 'stable' ? P.scrapMax : vstate === 'aggressive' ? P.scrapMax * 1.2 : vstate === 'weak' ? P.scrapMax * 0.25 : 0;
  sc.buffer = Math.max(0, sc.buffer + ((feed - swallow) / 3600) * dt);
  const meltRate = Math.min(swallow, feed + (sc.buffer > 0 ? swallow : 0)); // kg/h
  sc.meltRate = meltRate;
  s.scrap.meltRate = meltRate;
  const dm = (meltRate / 3600 / 1000) * dt;
  s.mass += dm * (vstate === 'aggressive' ? 0.93 : 0.98); // the rest goes to dross
  sc.melted += dm * 1000;
  const slagRate = (vstate === 'aggressive' ? 0.06 : 0.015) + (sc.quality !== 'clean' ? 0.05 : 0);
  sc.slag += meltRate * slagRate * (dt / 3600);
  s.surfaceSlag = clamp(s.surfaceSlag + meltRate * slagRate * 0.00002 * dt, 0, 1);
  sc.flames = approach(sc.flames, sc.on && (vstate === 'aggressive' || sc.quality !== 'clean') ? 1 : 0, 0.5, dt);
  cond(s, 10, sc.on && sc.buffer > 25);
  cond(s, 11, sc.on && vstate === 'aggressive');
  if (sc.on && vstate === 'aggressive') event(s, 'warn', 'Aggressive vortex: lower the impeller speed (air entry, flames, slag)', '§6.4.7');
  if (sc.buffer > 25) event(s, 'warn', 'Vortex does not swallow: raise the impeller speed', '§6.4.7');

  // extraction pump to HC#1 and the plugs
  if (s.pump.run && level < P.pumpMin) {
    s.pump.run = false;
    raise(s, 8);
    note(s, 'Pump stopped at the 300 mm minimum');
  }
  s.pump.flow = approach(s.pump.flow, s.pump.run && s.pump.in ? P.pumpTpm : 0, 0.6, dt);
  s.mass = Math.max(0, s.mass - (s.pump.flow / 60) * dt);
  s.pump.transferred = (s.pump.transferred || 0) + (s.pump.flow / 60) * dt;
  const pl = s.plugs;
  const drainT = (pl.pneu.open ? 0.08 : 0) + (pl.aswA.open ? 0.03 : 0) + (pl.vortexB.open ? 0.03 : 0) + (pl.pumpM.open ? 0.03 : 0); // t/s [A]
  // the pneumatic plug empties the well down to the floor; the manual plugs drain the last pockets
  const floorMM = pl.pneu.open ? (pl.aswA.open && pl.vortexB.open && pl.pumpM.open ? 0 : 40) : P.pumpMin * 0;
  if (drainT > 0 && level > floorMM) s.mass = Math.max(mm2t(floorMM), s.mass - drainT * dt);
  cond(s, 7, a.run && level < P.levelMin && level > 10);
  cond(s, 9, level >= P.levelMax);
  if (sc.on && level >= P.levelMax) {
    sc.on = false;
    note(s, 'Maximum level: scrap feeding stopped');
  }
  cond(s, 4, s.aux && !s.safety);
  if (s.fault !== 'noGas') cond(s, 5, false);
  if (s.fault !== 'leak' && s.tight === 'FAIL') {
    s.tight = s.fan.run ? 'TEST' : '';
    cond(s, 3, false);
  }
}
