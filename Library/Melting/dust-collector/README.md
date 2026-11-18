# Dust Collector · IDEX fume extraction: operator simulator

An offline training simulator built from the **general-arrangement drawing of the dust collector (Section L-L)**.
Open `Dust-collector-simulator.html` in Chrome or Edge, or watch the 20 s tour in `Dust-collector-tour-20s.mp4`.

- **Left: the whole line in 3D, at the drawing's dimensions.**
  - **Source:** the IDEX unit (TOP 25 take-off; 2000 m³/h at 400 °C) and the existing natural-draft stack through the
    roof (16 m) to its canopy (18 m).
  - **Duct:** the Ø650 duct, a 6000 + 11 694 mm run at about 7 m through the building wall, a bellows at the column,
    then a 2552 mm drop.
  - **Bag filter:** two compartments of 3840 mm (7910 overall, 8870 high), with hoppers, rotary airlocks, a ladder
    and a roof walkway.
  - **Outlet:** bends B11 and B12, the blower and motor (650 × 490 outlet), and the self-supported Ø1500 × 18 m
    chimney on its Ø5620 foundation.
  - **What you can see:** moving gas (dusty before the bags, clean after), dust cake building on the bags, pulse-jet
    blasts and the cake falling, hoppers filling, the dilution damper, and the stack plume.
  - **Controls:** six views, a cutaway into the filter, and labels.
- **Right: a bag-filter control panel.** The drawing does not include the panel, so this is a typical layout.
  - **Top strip:** a stack dust monitor, the tower lamp and the filter readings.
  - **HMI screens:** Overview synoptic, Filter (pulse valves, ΔP, cleaning mode), Fan (VFD flow control), Hoppers,
    Settings, Alarm (with history) and Trends.
  - **Cabinet buttons:** start, stop, acknowledge, reset and emergency stop.
- **Faults to practise:**
  - fan / VFD trip
  - compressed air low (cleaning blocked, ΔP keeps rising)
  - burst bag (stack dust jumps past the limit)
  - rotary airlock trip (hopper fills)
  - IDEX hot surge (dilution damper protects the bags)
  - stuck pulse valve
- **English / Arabic** with the EN / عربي button.

## What comes from the drawing and what is assumed

From the drawing: the geometry and dimensions above, the Ø650 duct, the two compartments, the blower and motor
position, the chimney, and the fume source (2000 m³/h at 400 °C natural draft).

The drawing has no process data, so these are typical values, marked `[A]` in `src/model.js`. Please check them
against the supplier's datasheet:

| Value | Used |
|---|---|
| Hood extraction / fan at 50 Hz | 15 000 / 21 000 m³/h (12.6 m/s in the Ø650 duct) |
| Bags | 2 × 120, Ø160 × 3000 mm polyester (air-to-cloth about 0.7 m/min), 8 pulse rows per compartment |
| Cleaning | on demand, starts at 150 mmWC and stops at 100 mmWC; 120 ms pulses, 10 s apart; air 6 bar, low 4.5 bar |
| Bag protection | dilution damper from 118 °C, limit 130 °C, high-high 150 °C |
| Dust at the hood | 1.2 g/Nm³; stack 4 mg/Nm³ normal, alarm above 20 mg/Nm³ |
| Fan motor | 37 kW on a VFD |
| Hoppers / airlocks | 400 kg each, level high at 80 %; 30 kg/h airlocks |
| Hot surge from IDEX | 7000 m³/h at 680 °C (charging, door open) |
| Filter depth | 3.2 m (the drawing shows the side elevation only) |

If you have the dust collector's O&M manual or its panel screens, send them: the panel will then match the real one.

## Rebuild

```
./build.sh          # the 3D page
./build.sh video    # also re-record the tour video (slow without a GPU)
```

| Path | Job |
|---|---|
| `src/model.js` | process model: fan and system curve, mixing and dilution, cake build-up, pulse-jet cleaning, hoppers, emission, alarms |
| `src/scene.js` | the line in 3D at the drawing's dimensions |
| `src/hmi.js` | the control panel and its screens |
| `src/main.js` | layout, views, labels, guided tour, 20 s film script (`#film`) |
| `src/i18n.js`, `src/i18n-ar.js` | language switch and the Arabic texts |
| `film/` | video timeline, soundtrack and frame recorder |
| `docs/` | the source drawing |
