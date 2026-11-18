# Degassing Machine (Nutec-Thermo, machines 136–141): operator simulator

An offline training simulator built from the **Degassing Machine Working and Maintenance Manual** (Nutec-Thermo,
for Synergies Casting LLC, Sohar). Open `Degassing-machine-simulator.html` in Chrome or Edge, or watch the 20 s tour
in `Degassing-machine-tour-20s.mp4`.

- **Left: the machine in 3D.**
  - **Machine:** the base frame and column with its hydraulic cylinder, and the red head and arm.
  - **Rotor and baffle:** the rotor motor driving the graphite shaft and rotor, and the anti-vortex baffle with its motor.
  - **Flux:** the vane feeder and its flux hopper.
  - **Gas and controls:** the argon cylinder, and the control panel with its tower lamp.
  - **Ladle:** the 1 t ladle of metal and the jumbo temperature display.
  - **What you can see:** the vortex opening at Speed 2, flux grains falling into it, argon bubbles, and the baffle
    stopping the vortex during degassing. Five views, a cutaway into the ladle, and labels.
- **Right: the control panel.** The touch HMI with the manual's screens:
  - **Home**
  - **Mode:** Auto / Manual, lamp test.
  - **Process:** the step lamps with timers.
  - **Setting:** timers, gas pressure and flow, the three speeds. Password **12345**.
  - **Drive RPM**
  - **Manual:** the manual functions.
  - **Alarm:** the PLC alarm list, 1–14.
  - **Admin:** the machine picture with every sensor.
  - **Also on the panel:** soft keys and F1–F8, the tower lamp (green auto, yellow manual, red alarm), the jumbo
    display, the cabinet push buttons (Control ON, Cycle Start, Cycle Stop, Reset, Emergency Stop), and a simulated
    melt-quality readout (hydrogen, density index, flux added).
- **The auto cycle, as in the manual.** Cycle start → 3 s rotor down delay → head down → at the middle sensor the
  rotor starts at Speed 1 and argon flows at low flow → lower limit: Speed 2, vortex formation → vane feeder (flux) →
  mixing → baffle down, Speed 3, high flow, degassing → baffle up → 3 s up delay → rotor up with argon flowing until it
  leaves the melt → home.
- **Faults to practise:**
  - argon pressure low
  - rotor, hydraulic, feeder or baffle MPCB trip
  - flux low
  - middle sensor out of position
  - emergency stop

  Each fault aborts the cycle the safe way and raises the manual's alarm and **Waiting For Reset**.
- **English / Arabic** with the EN / عربي button. The choice is shared with the other simulators in the library.

## Values to check against the machine

The manual gives the process ranges, speeds, power, alarms and screens. It does not give the head stroke, ladle size
or melt chemistry. These are assumptions, marked `[A]` in `src/model.js`:

| Value | Used | Manual |
|---|---|---|
| Vortex / fluxing / mixing / degassing time | 2 / 1 / 1 / 15 min | vortex 100–180 s, degassing 10–20 min |
| Gas flow low / high | 15 / 40 L/min | vortex 6–20, degassing 25–60 L/min |
| Speed 1 / 2 / 3 | 150 / 600 / 400 rpm | max 200 / 650 / 450 rpm |
| Flux rate | 180 g/min | 100–250 g/min |
| Ladle | 980 kg at 745 °C | not given |
| Hydrogen before → removal rate | 0.28 ml/100 g, first-order with flow and rpm | not given |
| Density index | 45 × (H − 0.07) % | not given |
| Head stroke and speed | 1.35 m at 0.12 m/s | not given |
| Argon line pressure | 2.2 bar | inlet 2–5 bar, min/max setting 1 / 3 bar |

## Rebuild

```
./build.sh          # the 3D page
./build.sh video    # also re-record the tour video (slow without a GPU)
```

| Path | Job |
|---|---|
| `src/model.js` | process model: auto sequence, manual functions, interlocks, alarms, hydrogen and temperature |
| `src/scene.js` | the machine in 3D, posed from the model state |
| `src/hmi.js` | the control panel and HMI screens |
| `src/main.js` | layout, views, labels, controls, guided tour, 20 s film script (`#film`) |
| `src/i18n.js`, `src/i18n-ar.js` | language switch and the Arabic texts |
| `src/style.css` | styles |
| `film/` | video timeline, soundtrack and frame recorder |
| `docs/` | the source manual |
