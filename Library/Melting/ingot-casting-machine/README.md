# Ingot Casting Machine: operating simulator

Built from the **User manual & ingot casting machine troubleshooting** (ENTEC Industrial Furnaces). Open
`Ingot-casting-machine-simulator.html` in Chrome or Edge, or watch `Ingot-casting-machine-tour-20s.mp4`.

- **3D at real size:**
  - **Machine:** the base frame and water tank, the two chains and the moulds round the front and rear sprockets,
    with the plummer blocks and tension screws.
  - **Pour end:** the distributor star wheel under the launder from the tilting furnace.
  - **Cooling:** the spray headers under the top strand.
  - **Discharge:** the two hammers and the ingot stack, the 5 HP motor and gearbox, the pedestal fan and the
    operator.
  - **Water and panels:** the cooling tower with its fan, the inlet and outlet pumps, the VFD panel and the IR
    temperature panel.
  - Ingots glow by their temperature.
- **Panels as drawn and photographed in the manual:**
  - **VFD panel:** main MCB 63 A TP, the R/Y/B lamps, conveyor START/STOP with ON/TRIP lamps and the emergency stop.
    It also has water pump inlet WP-1 and outlet WP-2 with their lamps, the A/M selector of WP-1, the PT-100 water
    temperature and the speed potentiometer.
  - **IR panel:** LOW TEMP INDIC-1 (discharge) and HIGH TEMP INDIC-2 (distributor).
- **The manual's steps, ticked as they are done:**
  - **Before starting:** hammers locked, chain lubricated, gearbox oil checked, moulds wire-brushed.
  - **Preheat:** the distributor preheated 1 h to 100–150 °C, and the moulds to about 150 °C before the die coat.
  - **Starting:** conveyor started, lubrication ball valve open, cooling tower tank ≥ 80 % with the fan and both
    pumps on, and the spray kept low.
  - **Casting:** metal at the distributor at 700–750 °C, the speed turned slowly, the hammers freed, and the ingot
    at 150–250 °C at the discharge.
  - **After casting:** bolts tightened and chips removed.
- **What goes wrong if you don't:**
  - **Water:** water thrown onto the moulds risks a blast, and so does metal in a cold or wet mould.
  - **Potentiometer:** turned abruptly, it jerks the conveyor and the ingots ripple.
  - **Pour against speed:** a mismatch gives under-filled or overflowing moulds.
  - **Hammers:** they release 85–90 % of the ingots. A stuck one needs the operator, or it rides round to the
    distributor (accident).
  - **Duty:** cast 2 h, then cool 30 min.
- **Troubleshooting faults (vibration):** chain too loose, broken plummer block bearing, bent shaft at the
  discharge, loose drive connection, AC drive 20 m away from the machine, and a water pump trip.

## Assumed (`[A]` in `src/model.js`)

The manual gives the procedure and temperatures but no machine data. These values are assumed:

- 11.6 m between the shaft centres, read approximately from the drawing.
- 0.22 m mould pitch and 10 kg ingots.
- 6 m/min conveyor speed at full potentiometer.
- Cooling rates in air, under the sprays and from the fan.
- Above 70 % spray, water reaches the mould tops.
- A potentiometer turned faster than 25 %/s counts as abrupt.
- Torch heating rates, water tank flows and the water temperature model.
