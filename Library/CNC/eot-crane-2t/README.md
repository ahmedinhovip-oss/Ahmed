# 2.0 t Single Girder EOT Crane · CNC bay: operator and test simulator

Built from **SYNERGIES 2T 22.285 MTRS SG EOT CRANE REVIEW DOCUMENTS** (Safex Industries, machine no. 2199,
W.O. 5408, GA drawing SIL-GA-2749 rev 6). The documents include:

- the inspection report and history sheet
- the internal inspection: deflection, speed and ampere tests, witnessed by Bureau Veritas
- the dimensions report
- the ABB motor test reports
- the rope drum and wheel material certificates
- the wire rope and hook certificates
- the general arrangement drawing

The GA drawing gives the location as **CNC** (application: CNC spindle), so this package sits in the CNC area.

Open `EOT-crane-2t-simulator.html` in Chrome or Edge, or watch `EOT-crane-2t-tour-20s.mp4`.

- **3D at real size:**
  - **Bay:** the 32 m bay with its columns and gantry girders, the 50 × 50 square-bar rails and end stoppers.
  - **Bridge:** two end carriages, 4 m long, wheelbase 3.2 m, Ø200 wheels, one LT motor each. The golden-yellow
    girder spans 22.285 m.
  - **Hoist:** the underslung hoist with a Ø209 drum, a 2.2 kW motor, a 120:1 gearbox and a disc brake. The 8 mm rope
    runs in 4 falls to the hook block.
  - **Services:** the shrouded DSL, the festoon, and the pendant with its operator.
  - **Loads:** test weights and a CNC spindle.
- **Girder deflection:** the girder bends under the load as a simply supported beam, scaled to the measured
  13.0 mm at 2000 kg mid span. The girder view shows it ×100.
- **Pendant:**
  - ON, OFF and emergency stop
  - two-step buttons, slow at 1/10 and fast, for UP/DOWN, LEFT/RIGHT (cross travel) and FORWARD/REVERSE (long travel)
- **Readouts:** speeds, positions, motor currents against their rated currents, brakes, the load and the
  deflection against 24.76 mm (span/900, IS 807).
- **Speeds:** taken from the speed test (4.01 / 14.01 / 20.4 m/min). They agree with the gearing: hoist
  1445 rpm ÷ 120 × π × 0.209 m ÷ 2 (4 falls) ≈ 3.95 m/min, and CT 1425 ÷ 41 × π × 0.13 ≈ 14.2 m/min.
- **Currents:** from the ampere test (hoist 3.78 A up / 3.17 A down and CT 1.07 / 1.03 A at 2000 kg, LT 1.2 A no
  load) and the motor no-load test.
- **Tests recorded as you run them:**
  - speed (hoist, CT, LT)
  - ampere (hoist, CT, LT)
  - deflection
  - load test at 2000 kg
  - overload test at 2500 kg
- **Faults to practise:** a worn hoist brake (the hook creeps down), LT motor 2 tripping (the bridge skews), DSL
  supply lost, broken wires in the rope.

## Assumed (`[A]` in `src/model.js`)

The documents are test and acceptance records, not an operating manual. These values are assumed:

- VFD ramp times: 1 s hoist, 2 s CT, 3 s LT.
- Slowdown before a target, as an operator would use step 1.
- Overload device setting: hoisting blocked above 110 % of SWL. A test key bypasses it for the witnessed 125 % test.
- Load tests: the simulator counts a load as held after 10 s. A real test holds it longer.
- Worn-brake creep rate.
- LT current rise with load, and the CT current at slow speed.
- Rail height of 5.9 m, read approximately from the GA drawing.
- Sling heights of the loads, and the CNC spindle at about 450 kg.
- The bay building, columns and the CNC machines on the floor are shown only for context.
