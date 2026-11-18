"""Score for the degassing machine film: a quiet bed, the hydraulic whine as the head travels, the rotor's hum rising
to Speed 2 for the vortex and settling at Speed 3, the argon hiss (soft at low flow, fuller during degassing), a
rattle for the flux grains, a click per press and a chime when the cycle completes.

    python ../../../.claude/skills/teardown/run_sfx.py film/score.py

Every time comes from film/timeline.json, which mirrors FILM in src/main.js.
"""

import os

from sfx.score_kit import beep, bed, chords, hiss, hz, motor, rattle, rumble
from sfx.synth import click

TIMELINE = "timeline.json"
OUT = os.path.join(os.environ.get("TEARDOWN_OUT", "teardown-out"), "deg-score.wav")
TARGET_LUFS = -14.0
SEED = 23

CHORDS = chords("Am9:A1 E2 G2 B2 C3/A0", "Fmaj7:F1 C2 E2 A2/F0", "Cmaj7:C2 G2 B2 E3/C1", "G6:G1 D2 E2 B2/G0")
MOTIF = [(0.5, hz("E5")), (1.5, hz("G5")), (2.5, hz("D5"))]


def score(mix, tl):
    dur = tl["duration"]
    left, right, low, drums = bed(dur, 88, CHORDS, MOTIF, motif_voice="epiano", kicks=(0,), snares=(), hats=0, swing=0.0, keys_vel=0.55, keys_lp=2800)
    mix.put_stereo(0, left, right, 0.09)
    mix.put(0, low, 0.09)
    mix.put(0, drums, 0.03)
    for key, f in (("head", 140), ("headUp", 130)):
        a, z = tl[key]
        mix.put(a, motor(z - a, f, 1100, 11), 0.02)
    r0, r1 = tl["rotor"]
    v0, v1 = tl["vortex"]
    d0, d1 = tl["degas"]

    def rotor_hz(t):
        t += r0
        if t < v0:
            return 38
        if t < v1:
            return 70
        if t < d1:
            return 55
        return 38

    mix.put(r0, rumble(r1 - r0, rotor_hz, 1.0), 0.04)
    mix.put(tl["middle"], hiss(d0 - tl["middle"], 3000, 0.5), 0.02)
    mix.put(d0, hiss(d1 - d0, 2400, 1.0), 0.035)
    f0, f1 = tl["flux"]
    mix.put(f0, rattle(f1 - f0, 22, 3400, 3, 1.0), 0.03)
    for key in ("baffleDown", "baffleUp"):
        a, z = tl[key]
        mix.put(a, motor(max(0.4, z - a), 170, 1300, 9), 0.015)
    for t in tl["clicks"]:
        mix.put(t, click(2400, 0.025), 0.05)
    for k, n in enumerate(("E5", "G5", "C6")):
        mix.put(tl["done"] + 0.12 * k, beep(hz(n), 0.35), 0.035)
