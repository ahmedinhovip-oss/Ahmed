# HC01 · FRSW 1-25 melting furnace: operator simulator

An offline training simulator built from the user manual **1983-MA-005-0-OTE-MOP-002 (HMI description)**.
Open `HC01-furnace-simulator.html` in Chrome or Edge, or watch the 20 s tour in `HC01-furnace-tour-20s.mp4`.

HC01 shares its combustion system and HMI layout with HA01 (same Insertec family), so this package starts from the
HA01 simulator and changes what the manual shows differently:

- **Transfer from HA01:** the status screen's four conditions: Emergency OK, TRF Pump Ready, TRF Pump ON, HC01 TRF
  Gate OPN. Open the gate and START TRANSFER: metal arrives from HA01, the level rises and the bath temperature
  mixes. At the working-level rod the full-furnace warning lights and the transfer stops.
- **No Aluswirler and no tilting platform.** The hydraulic screen has only the hydraulic group and the door (EV load,
  open, close).
- **Parameter tabs:** Temperature control (with REMOTE), Combustion control, Transfer pump.
- **Metal to casting:** a simulated draw so the level can fall again.
- **Unchanged from HA01:** combustion start-up (fan, tightness test, purge, ignition, flame signal), alarms with
  history, trends, faults and the English / Arabic switch.

## Values to check against the plant

Assumed (`[A]` in `src/model.js`): 25 t capacity on a 10.5 m² hearth, metal arriving from HA01 at 735 °C and
0.6 t/min, the casting draw at 0.25 t/min. The burner rating and the other furnace values are HA01's. The purge
timer shows 60 s as on the screen; the manual's text says six minutes.

## Rebuild

```
./build.sh          # the 3D page
./build.sh video    # also re-record the tour video
```
