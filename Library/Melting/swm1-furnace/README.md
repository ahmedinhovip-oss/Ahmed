# SWM#1 · FVGP-A 3-30 sidewell melter: procedure trainer

An offline trainer built from the **user manual · Procedures** (document 5.3, 1987-MA-005-0-OTE-MOP-003, Insertec).
Open `SWM1-furnace-simulator.html` in Chrome or Edge, or watch the 20 s tour in `SWM1-furnace-tour-20s.mp4`.

- **Left: the furnace in 3D.**
  - **Chamber:** the chamber with its two burners, the main door (210SH1 open, 210SH2 close), and the tilting
    platform with a ladle for the first fill.
  - **Side wells:** the vortex well with the scrap conveyor, the Aluswirler well with its volute and the drive on the
    hoist (working position and maintenance support), and the extraction-pump well with the launder to HC#1.
  - **Plugs:** the pneumatic plug and the three manual plugs, with locks and trays.
  - **Cabinet:** the main cabinet with its light column.
  - **What you can see:** the vortex (weak, stable or aggressive) swallowing scrap, flames and dross when it's too
    fast, steam bubbles from a new ceramic impeller, and metal draining from open plugs.
- **Right: the controls the manual names, and the trainer.**
  - **Main cabinet:** 20Q1, auxiliary connection, safety relay reset, 201SH3 combustion fan (lamp flashes during
    the 5 min purge), "Open main solenoid valve", burner selectors 201SH5 and 202SH1 (OFF / ON / RESET), alarm
    silence, gas manometer, and HMI readouts with password-protected set points.
  - **Local panels:** the Aluswirler (207SH1 run, 208SH2 AUTO/MAN, 208S1 speed), the main door, the extraction
    pump, and the scrap feed (type and condition).
- **The seven procedures of the manual**, step by step:
  1. Pre-operation inspection (§1)
  2. Initial warm-up (§2)
  3. Permanent regime · scrap and transfer (§3, §6.4.7–8)
  4. Cleaning the main chamber (§6.1.1)
  5. Emptying in 4 phases (§6.2.2)
  6. Impeller change (§6.3–6.4)
  7. Long stop (§5)

  Pick one and press **Load starting situation**. Each step ticks when the plant really reaches it.
- **Violations and cautions are recorded and scored**, for example:
  - lifting a turning impeller
  - immersing faster than 1/3 of the blade every 10 min
  - skipping the 20 min hold or the 40 °C superheat
  - raising speed before the hot re-tightening
  - opening a plug with its lock on or no tray
  - loading scrap with the door open, or wet/oily scrap
  - a cold start straight to a high set point
- **Faults to practise:** gas leak (tightness fault), burner 2 not lighting, no gas, dirty level detector, wet scrap.
- **Time:** the speeds go up to ×600 for the long waits (purge, warm-up, impeller hold and stages).
- **English / Arabic** with the EN / عربي button. Panel tags stay as on the plant.

## Values to check against the plant

The manual gives the procedures, tags and safety times. These are assumptions, marked `[A]` in `src/model.js`:

| Value | Used | Manual |
|---|---|---|
| Hearth / capacity | 12.6 m², 30 t | "3-30" |
| Vortex minimum / furnace maximum level | 500 / 950 mm | shown on a drawing, no values |
| Burners | 2 × 1500 kW | not given |
| Aluswirler speed for a stable vortex | 30–65 % depending on level, 600 rpm at 100 % | "defined by the manufacturer" |
| Swallowing capacity | 3000 kg/h of scrap | not given |
| Extraction pump | 0.6 t/min | its own manual (Annex 1) |
| Operating aluminium SP | 730 °C | not given (warm-up SP 900/950 °C is from the manual) |

From the manual: the 5 min purge, the 900/950 °C warm-up set point, the 300 mm pump minimum, 24 h drying at
80–90 °C, 25 mm and 20 min before immersion, 1/3 of the blade every 10 min, about 30 min of bubbles, test turns at
10 %, hot re-tightening after 2 h, and scrap under 150 mm, clean and dry.

## Rebuild

```
./build.sh          # the page
./build.sh video    # also re-record the tour video
```

| Path | Job |
|---|---|
| `src/model.js` | plant model and every operator action, with the manual's checks |
| `src/procedures.js` | the seven procedures as checkable steps |
| `src/scene.js` | the furnace, side wells, hoist and plugs in 3D |
| `src/hmi.js` | cabinet, local panels and the trainer |
| `src/main.js` | layout, views, labels, guided tour, 20 s film (`#film`) |
| `src/i18n.js`, `src/i18n-ar.js` | language switch and the Arabic texts |
| `film/` | video timeline, soundtrack and recorder |
| `docs/` | the source manual |
