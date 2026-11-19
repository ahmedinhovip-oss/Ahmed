"""Score for the vibratory feeder film: a quiet bed, the 1440 rpm hum of the two motors while they run (24 Hz and its
harmonics), a dry rattle of scrap on the trough, a soft whoosh at each view, and a harsher, beating hum when the
motors run unbalanced and the same way.

Every time comes from film/timeline.json, which mirrors FILM in src/main.js.
"""

import os

from sfx.score_kit import airy, bed, chords, hz, rattle, rumble

TIMELINE = "timeline.json"
OUT = os.path.join(os.environ.get("TEARDOWN_OUT", "teardown-out"), "vf-score.wav")
TARGET_LUFS = -14.0
SEED = 53

CHORDS = chords("Cmaj9:C2 G2 B2 D3 E3/C1", "Am7:A1 E2 G2 C3/A0", "Fmaj7:F1 C2 E2 A2/F0", "G6:G1 D2 E2 B2/G0")
MOTIF = [(0.5, hz("E5")), (1.5, hz("G5")), (2.5, hz("D5"))]


def score(mix, tl):
    dur = tl["duration"]
    left, right, low, drums = bed(dur, 92, CHORDS, MOTIF, motif_voice="epiano", kicks=(0,), snares=(), hats=0, swing=0.0, keys_vel=0.55, keys_lp=2800)
    mix.put_stereo(0, left, right, 0.09)
    mix.put(0, low, 0.09)
    mix.put(0, drums, 0.03)
    a, b = tl["run1"]
    mix.put(a, rumble(b - a, lambda t: 48, 1.0), 0.05)
    mix.put(a + 0.8, rattle(b - a - 0.8, 40, 3800, 7, 1.0), 0.03)
    c, d = tl["run2"]
    mix.put(c, rumble(d - c, lambda t: 48 + 3 * ((t * 2) % 1), 1.0), 0.06)
    for v in tl["views"]:
        mix.put(v - 0.2, airy(0.6, 500, 1500, 0.6), 0.02)
