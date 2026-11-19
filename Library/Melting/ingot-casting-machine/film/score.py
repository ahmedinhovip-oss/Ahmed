"""Score for the ingot casting machine film: a quiet bed, the low drone of the conveyor drive, a soft hiss of the water
sprays, and a whoosh at each view.

Every time comes from film/timeline.json, which mirrors FILM in src/main.js.
"""

import os

from sfx.score_kit import airy, bed, chords, hz, rattle, rumble

TIMELINE = "timeline.json"
OUT = os.path.join(os.environ.get("TEARDOWN_OUT", "teardown-out"), "icm-score.wav")
TARGET_LUFS = -14.0
SEED = 71

CHORDS = chords("Am9:A1 E2 G2 B2 C3/A0", "Fmaj7:F1 C2 E2 A2/F0", "Cmaj7:C2 G2 B2 E3/C1", "G6:G1 D2 E2 B2/G0")
MOTIF = [(0.5, hz("E5")), (1.5, hz("C5")), (2.5, hz("D5"))]


def score(mix, tl):
    dur = tl["duration"]
    left, right, low, drums = bed(dur, 84, CHORDS, MOTIF, motif_voice="epiano", kicks=(0,), snares=(), hats=0, swing=0.0, keys_vel=0.55, keys_lp=2800)
    mix.put_stereo(0, left, right, 0.09)
    mix.put(0, low, 0.09)
    mix.put(0, drums, 0.03)
    mix.put(0, rumble(dur, lambda t: 36, 1.0), 0.04)
    mix.put(0.5, rattle(dur - 0.5, 20, 6000, 3, 1.0), 0.015)
    for v in tl["views"]:
        mix.put(v - 0.2, airy(0.6, 500, 1500, 0.6), 0.02)
