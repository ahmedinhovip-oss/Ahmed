# Vibratory Feeder · magnetic separator line: set-up and operating simulator

Built from the **Installation, Operation and Maintenance Manual for Motorised Vibratory Feeder** (Electro Magnetic
Industries, P.O. SCLLC/P&M/MS/EMI/2020-21/050). The file was named "Magnetic separator manual"; its content covers
the feeder of that line. Open `Vibratory-feeder-simulator.html` in Chrome or Edge, or watch
`Vibratory-feeder-tour-20s.mp4`.

- **3D, motion exaggerated ×25:**
  - **Feeder:** the 500 × 2000 SS-304 trough on four springs and its stand, with the two unbalance motors on an
    inclined bracket. Their eccentric weights grow with the % setting and turn in opposite directions when wired
    right.
  - **Around it:** the bin and its gate above the inlet, and the scrap walking along the trough.
  - **Discharge:** an overband magnet lifting the iron out into its own bin.
- **Panel:**
  - **Starter:** the common starter for both motors (as the manual requires), with overload reset, emergency stop,
    motor lamps and currents.
  - **Readouts:** stroke, transverse rocking, conveying speed, feed rate, iron removed or passed, and fatigue on the
    motor feet.
  - **Settings:** the eccentric weights (inner and outer of each motor, by the % marks), wiring (swap 2 phases),
    the bin openings against the largest piece, and the magnet.
- **From the manual:**
  - the five checks before starting (a–e)
  - opposite rotation of the two motors
  - the same % on both sides of both motors, or transverse forces crack the motor body or legs
  - bin openings: horizontal at least 2 × the largest piece, vertical 2–3 ×
- **Faults to practise:** motor 2 overload, motor rewired the same way, a spring out of its seat, loose bolts,
  oversize scrap.

## Assumed (`[A]` in `src/model.js`)

The manual gives size, motors, supply and the rules above, but no performance data:

- 3 mm stroke at 100 % and 9 m/min per mm of stroke
- chips at 0.25 t/m³, a bed of up to 120 mm under the gate
- 1.2 % iron in the scrap, 96 % magnet pick-up
- the fatigue rate of the motor feet

**The magnet is not in this manual.** If you have the magnetic separator's own manual, send it and I'll add it
properly.
