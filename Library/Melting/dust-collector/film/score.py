"""Score for the dust collector film: a quiet bed, the ID fan's steady hum (rising as it speeds up for the dilution
air), a sharp air pulse for each valve the film fires, a soft whoosh at each view change and a low warning tone
when the surge pushes the inlet temperature to the bag limit.

    python ../../../.claude/skills/teardown/run_sfx.py film/score.py

Every time comes from film/timeline.json, which mirrors FILM in src/main.js.
"""

import os

from sfx.score_kit import airy, beep, bed, chords, hiss, hz, rumble
from sfx.synth import click

TIMELINE = "timeline.json"
OUT = os.path.join(os.environ.get("TEARDOWN_OUT", "teardown-out"), "dc-score.wav")
TARGET_LUFS = -14.0
SEED = 31

CHORDS = chords("Em9:E2 B2 D3 F#3 G3/E1", "Cmaj7:C2 G2 B2 E3/C1", "G6:G1 D2 E2 B2/G0", "D6sus:D2 G2 A2 B2/D1")
MOTIF = [(0.5, hz("B4")), (1.5, hz("E5")), (2.5, hz("D5"))]


def score(mix, tl):
    dur = tl["duration"]
    left, right, low, drums = bed(dur, 84, CHORDS, MOTIF, motif_voice="epiano", kicks=(0,), snares=(), hats=0, swing=0.0, keys_vel=0.55, keys_lp=2800)
    mix.put_stereo(0, left, right, 0.09)
    mix.put(0, low, 0.09)
    mix.put(0, drums, 0.03)
    f0, f1 = tl["fan"]
    surge = tl["surge"]
    mix.put(f0, rumble(f1 - f0, lambda t: 44 if t < surge + 1.5 else 44 + min(14, (t - surge - 1.5) * 10), 1.0), 0.04)
    for v in tl["views"]:
        mix.put(v - 0.2, airy(0.6, 500, 1500, 0.6), 0.02)
    for k in range(tl["pulses"]):
        t0 = tl["pulseStart"] + k * tl["pulseGap"] * (3 if k > 8 else 1)
        if t0 < 12:
            mix.put(t0, hiss(0.12, 4200, 1.0), 0.06)
            mix.put(t0, click(1800, 0.02), 0.03)
    mix.put(tl["damper"], beep(hz("A4"), 0.4), 0.03)
    mix.put(tl["damper"] + 0.5, beep(hz("A4"), 0.4), 0.03)
