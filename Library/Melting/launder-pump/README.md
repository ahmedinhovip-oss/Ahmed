# Launder Transfer Pump · MINI-902L: assembly and operating simulator

Built from the **MMEI assembly drawing MINI-902X-22ABL0 rev B** ("MINI launder transfer pump used at Synergies
Oman", L version). Open `Launder-pump-simulator.html` in Chrome or Edge, or watch `Launder-pump-tour-20s.mp4`.

- **From the drawing:**
  - **Bill of materials:** all 14 items with their part numbers.
    1. Snouted base MINI-002A
    2. 3 × post MINI-201L-R
    3. 3 in shaft MINI-102L-R
    4. 7 in hook rotor MINI-122A
    5. Motor mount MINI-300C
    6. Motor 4 HP / 1000 rpm / 3 ph / 50 Hz / 400 V / 215TC
    7. Bail
    8. Star ring MINI-302C-21
    9. 3 in solid coupling MINI-346D
    10. 8 × 1/2" lock washers
    11. 4 × 3/8" lock washers
    12. 4 × 1/2"-13 × 1 1/2" hex bolts
    13. 4 × 1/2"-13 × 1 3/4" hex bolts
    14. 4 × 3/8"-16 × 1 3/4" hex bolts
  - **Dimensions of the L version:**
    - A = 1861, B = 1038, C = 1102 mm
    - base 457 × 356, motor mount 406 × 406
    - coupling offset distance 162 mm
    - weight 250
  - **Other lengths:** N 1708 / 886 / 949, S 1556 / 733 / 797, T 1403 / 581 / 645.
- **Assembly trainer:** the parts wait on a table next to the maintenance stand. You fit them in the order of the
  exploded view, with the right bolts and washers at each joint. Fitting or removing out of order is refused and
  logged. You can also disassemble completely and clean the base and the rotor.
- **Operation:** hoist the pump over the bath to preheat, then lower it into the well. Start on the VFD and ramp up.
  The rotor pushes the metal up the riser into the launder.
  - **Readouts:** speed, flow, tonnes moved, metal above the base, lift to the riser lip, current against the full-load
    current, pump temperature and dross.
- **Faults:** dross building up in the base, a solid piece jamming the rotor (overload trip), a loose or misaligned
  coupling (vibration), and a nearly empty furnace (air drawn in).
- **Mistakes:** immersing the pump cold (thermal shock), starting out of the metal (running dry), and starting at
  high speed.

## Assumed (`[A]` in `src/model.js`)

The drawing is an assembly drawing with no operating data. These values are assumed:

- **Assembly order:** follows the exploded view.
- **Pump curve:** 1.0 t/min at 1000 rpm with no head, and 1.1 m shut-off head. Below about 28 Hz the pump cannot
  reach the lip.
- **Riser:** lip 1.25 m above the well floor.
- **Furnace:** 50 t per metre of bath.
- **Minimum metal above the base:** 250 mm, the same figure as HC01's pump minimum-level setting.
- **Preheat:** to 500 °C at 18 °C/min.
- **Currents:** 5.8 A full-load and the current model.
- **Dross:** the build-up rate.
- **Layout:** the well, launder and stand are shown only for context.
