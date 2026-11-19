"""Score for the launder pump film: a quiet bed, a soft metallic tick for each part fitted, the motor hum once it
runs (1000 rpm at 50 Hz, ramping), and a whoosh at each view.

Every time comes from film/timeline.json, which mirrors FILM in src/main.js.
"""

import os

from sfx.score_kit import airy, bed, chords, hz, rumble

TIMELINE = "timeline.json"
OUT = os.path.join(os.environ.get("TEARDOWN_OUT", "teardown-out"), "lp-score.wav")
TARGET_LUFS = -14.0
SEED = 83

CHORDS = chords("Em9:E2 B2 D3 F#3 G3/E1", "Cmaj7:C2 G2 B2 E3/C1", "G6:G1 D2 E2 B2/G0", "D6:D2 A2 B2 F#3/D1")
MOTIF = [(0.5, hz("B4")), (1.5, hz("D5")), (2.5, hz("A4"))]


def score(mix, tl):
    dur = tl["duration"]
    left, right, low, drums = bed(dur, 90, CHORDS, MOTIF, motif_voice="epiano", kicks=(0,), snares=(), hats=0, swing=0.0, keys_vel=0.55, keys_lp=2800)
    mix.put_stereo(0, left, right, 0.09)
    mix.put(0, low, 0.09)
    mix.put(0, drums, 0.03)
    for f in tl["fits"]:
        mix.put(f, airy(0.12, 2500, 6000, 0.2), 0.04)
    a, b = tl["run"]
    mix.put(a, rumble(b - a, lambda t: 16 + min(t, 1.5) * 12, 1.0), 0.06)
    for v in tl["views"]:
        mix.put(v - 0.2, airy(0.6, 500, 1500, 0.6), 0.02)
