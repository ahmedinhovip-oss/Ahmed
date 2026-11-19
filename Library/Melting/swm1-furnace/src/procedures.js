// The manual's procedures as checkable steps. Each step: the text, the manual section, and done(s, g) read from the
// plant state. The trainer walks a procedure in order; a step counts once its condition holds while it is current.
import {levelOf, P} from './model.js';

const both = (s, v) => s.sel[0] === v && s.sel[1] === v;
export const PROCS = [
  {
    id: 'p1', title: 'Pre-operation inspection', ref: '§1', scenario: 'cold',
    steps: [
      ['Thermocouples: continuity in the connections', '§1.1', (s) => s.inspect.tc],
      ['Liquid aluminium level detector: clean sensor', '§1.2', (s) => s.inspect.levelDet && s.fault !== 'levelDirty'],
      ['Feeder well chip level detector: clean sensor', '§1.3', (s) => s.inspect.chipDet],
      ['Master switch 20Q1: ON', '§1.4', (s) => s.q20],
      ['Auxiliary connection: activated', '§1.5', (s) => s.aux],
      ['Reset safety relay: activated', '§1.6', (s) => s.safety],
      ['Temperature controllers: confirm settings and alarms', '§1.7', (s) => s.inspect.controllers],
      ['Supply of gas: pressure on the inlet manometer', '§1.8', (s, g) => s.inspect.gas && g.gasOK],
      ['Furnace main door: closed', '§1.9', (s, g) => g.doorClosed],
      ['Vault and Aluswirler platform access door: closed', '§1.10', (s) => s.platDoor],
      ['Stirring system: twirl test', '§1.11', (s) => s.inspect.twirl],
    ],
  },
  {
    id: 'p2', title: 'Initial warm-up', ref: '§2', scenario: 'cold',
    steps: [
      ['Press "Combustion fan start" 201SH3 in the main cabinet', '§2.1', (s) => s.fan.run],
      ['Wait the purge time: 5 min, "Combustion fan running" light flashing', '§2.2', (s, g) => g.purged],
      ['Tightness control of the general and burner solenoid valves passes', '§2.3', (s) => s.tight === 'OK'],
      ['Press "Open main solenoid valve": gas and oxygen to the burners', '§2.4', (s) => s.mainValve],
      ['Burner selectors 201SH5 and 202SH1 to ON: both burners lit', '§2.5', (s) => s.burner[0] === 'on' && s.burner[1] === 'on'],
      ['Set the chamber set point on the HMI (raise it gradually from cold)', '§2.6', (s) => s.chSP >= 300],
      ['High set point 900/950 °C and wait for the chamber to reach it', '§2.7', (s) => s.chSP >= 900 && s.chT >= 890],
      ['Aluswirler: Run 207SH1, selector 208SH2 to MAN, speed 208S1 up, check alignment', '§2.7', (s) => s.asw.run && s.asw.mode === 'MAN' && s.asw.speed > 0],
      ['Introduce the extraction pump into the auxiliary well', '§2.7', (s) => s.pump.in],
    ],
  },
  {
    id: 'p3', title: 'Permanent regime · scrap and transfer', ref: '§3', scenario: 'fill',
    steps: [
      ['Main door closed for permanent automatic mode (open it only to pour the ladle)', '§3', (s) => s.mass > 0],
      ['First load: pour liquid aluminium from the ladle until the vortex minimum level', '§3', (s) => levelOf(s) >= P.levelMin],
      ['Close the main door; burner selectors 201SH5 and 202SH1 ON', '§3', (s, g) => g.doorClosed && both(s, 'ON')],
      ['Start the Aluswirler and set 208S1 for a stable vortex at this level', '§6.4.7', (s) => s.vortex.state === 'stable'],
      ['Before loading: door closed, no cleaning, loading or maintenance, no anomaly on screen', '§3', (s, g) => g.doorClosed && !s.alarms.some((a) => a.active)],
      ['Load clean, dry scrap (chip, profile or UBC, ≤150 mm) into the vortex', '§6.4.8', (s) => s.scrap.melted > 300],
      ['Transfer to HC#1 with the extraction pump, never below the Aluswirler minimum', '§3', (s) => (s.pump.transferred || 0) > 1 && levelOf(s) >= P.levelMin - 5],
    ],
  },
  {
    id: 'p4', title: 'Cleaning the main chamber', ref: '§6.1.1', scenario: 'hot',
    steps: [
      ['Press 210SH1 "Open door" until the door reaches the top', '§6.1.1', (s) => s.door.pos >= 0.999],
      ['Lock the door fully open', '§6.1.1', (s) => s.door.locked],
      ['Drag the slag from back to front, sides first, into the bins under the door', '§6.1.1', (s) => s.chamberSlag <= 0.001],
      ['Unlock the door', '§6.1.1', (s) => !s.door.locked],
      ['Press 210SH2 "Close door"', '§6.1.1', (s, g) => g.doorClosed],
    ],
  },
  {
    id: 'p5', title: 'Emptying the furnace (4 phases)', ref: '§6.2.2', scenario: 'hot',
    steps: [
      ['Remove the slag and semi-solid material from the surface', '§6.2.2', (s) => s.surfaceSlag < 0.2],
      ['Place a tray or bin under each plug', '§6.2.2', (s) => Object.values(s.plugs).every((p) => p.tray)],
      ['Phase 1: drain with the extractor pump down to 300 mm', '§6.2.2', (s) => levelOf(s) <= P.pumpMin + 15],
      ['Phase 2: take a new ceramic cone', '§6.2.2', (s) => s.plugs.pneu.coneSteps >= 1],
      ['Phase 2: remove the mechanical lock and open the pneumatic plug', '§6.2.2', (s) => s.plugs.pneu.open],
      ['Phase 2: clean the metal cone, place the new ceramic cone, clean the hole', '§6.2.2', (s) => s.plugs.pneu.coneSteps >= 5],
      ['Phase 3: unlock and open the two Aluswirler manual plugs (with PPE)', '§6.2.2', (s) => s.plugs.aswA.open && s.plugs.vortexB.open],
      ['Phase 4: stop and remove the extraction pump, unlock and open its manual plug', '§6.2.2', (s) => !s.pump.in && s.plugs.pumpM.open],
      ['Furnace empty', '§6.2.2', (s) => levelOf(s) < 3],
      ['After emptying: clean the contact faces, gasket, close and lock every plug', '§6.2.2', (s) => Object.values(s.plugs).every((p) => !p.open && p.lock) && s.plugs.pneu.cone === 'new'],
    ],
  },
  {
    id: 'p6', title: 'Impeller change', ref: '§6.3–6.4', scenario: 'hot',
    steps: [
      ['Stop the Aluswirler completely (never lift a turning impeller)', '§6.3.3', (s) => !s.asw.run && s.asw.rpm < 1],
      ['Loosen the clips that secure the pump assembly', '§6.3.3', (s) => !s.asw.clips],
      ['Raise the assembly with the hoist', '§6.3.3', (s) => s.asw.pos !== 'working'],
      ['Move it to the holding position on the auxiliary support', '§6.3.3', (s) => s.asw.pos === 'maint' || s.asw.imp.newPiece],
      ['Let it cool and remove the impeller from the coupling flange', '§6.3.3', (s) => !s.asw.imp.present || s.asw.imp.newPiece],
      ['Dry the new ceramic piece 24 h on the vault (80–90 °C)', '§6.4.4', (s) => s.asw.dried],
      ['Fit the new dry impeller: through bolts in, alignment bolts loose', '§6.4.4', (s) => s.asw.imp.present && s.asw.imp.newPiece],
      ['Turn at 10 % and align against a reference with the alignment screws', '§6.4.4', (s) => s.asw.imp.aligned],
      ['Tighten all the through bolts and lock the alignment bolts', '§6.4.4', (s) => s.asw.imp.tight],
      ['Clean the volute where the new impeller will sit', '§6.4.5', (s) => s.asw.imp.cleanVolute],
      ['Lift and move the assembly over the well (not into the metal)', '§6.4.5', (s) => ['over', 'lowering', 'working'].includes(s.asw.pos) && s.asw.imp.newPiece],
      ['Bring the aluminium 40 °C above the usual set point', '§6.4.5', (s) => s.alT >= s.alSP + P.superheat - 2],
      ['Slow descent to 25 mm above the bath; hold 20 min', '§6.4.5', (s) => (s.asw.pos === 'lowering' || s.asw.pos === 'working') && s.t - s.asw.imp.holdStart >= P.impHold],
      ['Immerse 1/3 of the blade length every 10 min; wait while bubbles show', '§6.4.5', (s) => s.asw.immersion >= 0.999 && s.asw.pos === 'working'],
      ['Assembly on its support: fix it with the clips', '§6.4.5', (s) => s.asw.pos === 'working' && s.asw.clips],
      ['Test turns at 10 %: smooth, no noises', '§6.4.6', (s) => s.asw.run && s.asw.speed <= P.testSpeed && s.asw.rpm > 5 && !s.asw.imp.cracked],
      ['After 2 h stop and hot re-tighten the bowl screws', '§6.4.6', (s) => s.asw.imp.retightened],
      ['Raise the speed slightly until a minimum vortex forms', '§6.4.7', (s) => s.vortex.state === 'stable'],
    ],
  },
  {
    id: 'p7', title: 'Long furnace stop', ref: '§5', scenario: 'drained',
    steps: [
      ['Furnace completely emptied and slag removed from the chamber and the Aluswirler area', '§5', (s) => levelOf(s) < 3 && s.chamberSlag <= 0.001],
      ['Turn the burners off: selectors 201SH5 and 202SH1 to OFF', '§5', (s) => both(s, 'OFF')],
      ['Turn the combustion fan off with 201SH3', '§5', (s) => !s.fan.run],
      ['Disconnect voltage: main switch 20Q1 to OFF', '§5', (s) => !s.q20],
    ],
  },
];
