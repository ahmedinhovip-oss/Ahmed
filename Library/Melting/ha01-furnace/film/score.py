"""Score for the HA01 furnace film: a quiet Dm9 bed at 84 bpm, the combustion fan's hum from START to the trip, a gas
puff at ignition and the burners' low roar (lower once the door drops them to low fire), the hydraulic whine under the
door and the tilt, a hiss for the pour, the transfer pump's motor, a click per HMI press and the alarm horn at the trip.

    python ../.claude/skills/teardown/run_sfx.py film/score.py

Every time comes from film/timeline.json, which mirrors FILM in main.js.
"""

import os

from sfx.score_kit import beep, bed, chords, hiss, hz, motor, puff, rumble
from sfx.synth import click

TIMELINE = "timeline.json"
OUT = os.path.join(os.environ.get("TEARDOWN_OUT", "teardown-out"), "ha01-score.wav")
TARGET_LUFS = -14.0
SEED = 11

CHORDS = chords("Dm9:D2 A2 C3 E3 F3/D1", "Bbmaj7:Bb1 F2 A2 D3/Bb0", "Fmaj7:F2 C3 E3 A3/F1", "C6sus:C2 F2 G2 A2 D3/C1")
MOTIF = [(0.5, hz("A4")), (1.5, hz("D5")), (2.5, hz("C5"))]


def score(mix, tl):
    dur = tl["duration"]
    left, right, low, drums = bed(dur, 84, CHORDS, MOTIF, motif_voice="epiano", kicks=(0,), snares=(), hats=0, swing=0.0, keys_vel=0.55, keys_lp=2800)
    mix.put_stereo(0, left, right, 0.09)
    mix.put(0, low, 0.09)
    mix.put(0, drums, 0.03)
    f0, f1 = tl["fan"]
    mix.put(f0, motor(f1 - f0, 95, 900, 6), 0.012)
    mix.put(tl["ignition"], puff(1.0), 0.07)
    mix.put(tl["ignition"] + 0.12, puff(0.8), 0.06)
    b0, b1 = tl["burners"]
    lf = tl["lowFire"] - b0
    mix.put(b0, rumble(b1 - b0, lambda t: 48 if t < 1.0 or t > lf else 62, 1.0), 0.05)
    for key, f in (("door", 150), ("tilt", 135), ("tiltDown", 120)):
        a, z = tl[key]
        mix.put(a, motor(z - a, f, 1100, 11), 0.018)
    p0, p1 = tl["pour"]
    mix.put(p0, hiss(p1 - p0, 2600, 0.8), 0.03)
    q0, q1 = tl["pump"]
    mix.put(q0, motor(q1 - q0, 175, 1500, 9), 0.016)
    for t in tl["clicks"]:
        mix.put(t, click(2400, 0.025), 0.05)
    for k in range(5):
        mix.put(tl["trip"] + 0.15 + 0.55 * k, beep(880, 0.22), 0.05)
        mix.put(tl["trip"] + 0.42 + 0.55 * k, beep(660, 0.22), 0.05)
