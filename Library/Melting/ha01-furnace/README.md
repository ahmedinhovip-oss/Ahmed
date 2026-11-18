# HA01 · FVGP-A 1-30 gas melting furnace: operator simulator

An offline training simulator built from the user manual **1982-MA-005-0-OTE-MOP-002 (HMI description)**.
Open `HA01-furnace-simulator.html` in Chrome or Edge, or watch the 20 s tour in `HA01-furnace-tour-20s.mp4`. Nothing is installed, and no network connection is needed.

- **Left: the furnace in 3D.** You can see the chamber, two burners, the gas and air trains, the combustion fan,
  the vertical-lift door, the tilting platform and ladle, the Aluswirler, the transfer pump, the flue damper and
  the level rod. Drag to orbit and use the mouse wheel to zoom. Keys `1`–`6` switch views, `C` cuts the furnace
  open, and `L` shows or hides the labels.
- **Right: the cabinet HMI**, rebuilt screen by screen from the manual:
  - Furnace status
  - Combustion system (valves 70Y1–70Y4, the main EVs, servomotors 76SM1/78SM1, flame signal in µA, the
    tightness test and purge)
  - Adjustment parameters (temperature control with REMOTE cascade, combustion control, Aluswirler, transfer
    pump, transfer interlock)
  - Hydraulic system (door EVs 110Y1–110Y3, tilting and ladle lock)
  - Alarms (with acknowledge, reset/clear and history)
  - Trends
- **English / Arabic.** Switch with the EN / عربي button on the 3D side or the LANGUAGE button on the HMI header
  (as on the real panel). Both sides, the tour captions, alarms and messages change; tags, units and numbers stay as on
  the panel. The choice is remembered. Translations are in `src/i18n-ar.js`.
- **One plant model under both sides** (`model.js`). Every value on the HMI and every movement in 3D comes from
  the same state, so the two always agree.
- **Guided tour.** When the page is left alone it walks through a start-up, a ladle charge, a transfer to HC01, a
  fan trip and its reset. Click anywhere to take control. **Inject fault** lets you practise:
  - low gas pressure
  - a fan trip
  - a flame failure on burner #2
  - a leaking 70Y1 (fails the tightness test)
  - lost communication with HC01

## Model values to check against the plant

The manual gives the screens, set points and safety logic. It does not give the furnace's physical size or its
burner rating. The values the model had to assume are marked `[A]` in the `P` block at the top of `model.js`; the
main ones are:

| Value | Assumed | Note |
|---|---|---|
| Capacity / hearth | 30 t, 4.2 × 3.0 m | read from the type "1-30" |
| Burner rating | 2 × 1200 kW, low fire 15 % | |
| Working-level rod | 1000 mm above the hearth floor | |
| Transfer pump flow | 0.6 t/min | |
| Ladle | 3.0 t at 745 °C | |
| Aluminium high alarm | 780 °C | the screen shows 700 °C, which is below the 720 °C set point |
| Purge | 60 s | as on the combustion screen; the text of the manual says six minutes |

Correct any of these in `src/model.js` and run `./build.sh`.

## Rebuild

```
./build.sh          # the 3D page
./build.sh video    # also re-record the tour video (slow without a GPU)
```

| Path | Job |
|---|---|
| `src/model.js` | process model: combustion sequence, tightness test, heat balance, hydraulics, transfer, alarms |
| `src/scene.js` | the 3D furnace, posed from the model state |
| `src/hmi.js` | the HMI screens |
| `src/main.js` | layout, camera views, labels, controls, guided tour, 20 s film script (`#film`) |
| `src/i18n.js`, `src/i18n-ar.js` | language switch and the Arabic texts |
| `src/style.css` | styles |
| `film/` | video timeline, soundtrack (`score.py`) and frame recorder |
| `docs/` | the source manual |
