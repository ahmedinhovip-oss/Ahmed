"""Score for the EOT crane film: a quiet bed, the hoist motor's whine while the hook rises (1445 rpm through the
120:1 gearbox), a deeper rumble of the long-travel wheels on the rails, and a soft whoosh at each view.

Every time comes from film/timeline.json, which mirrors FILM in src/main.js.
"""

import os

from sfx.score_kit import airy, bed, chords, hz, rumble

TIMELINE = "timeline.json"
OUT = os.path.join(os.environ.get("TEARDOWN_OUT", "teardown-out"), "crane-score.wav")
TARGET_LUFS = -14.0
SEED = 61

CHORDS = chords("Dmaj9:D2 A2 C#3 E3 F#3/D1", "Bm7:B1 F#2 A2 D3/B0", "Gmaj7:G1 D2 F#2 B2/G0", "A6:A1 E2 F#2 C#3/A0")
MOTIF = [(0.5, hz("F#5")), (1.5, hz("A5")), (2.5, hz("E5"))]


def score(mix, tl):
    dur = tl["duration"]
    left, right, low, drums = bed(dur, 88, CHORDS, MOTIF, motif_voice="epiano", kicks=(0,), snares=(), hats=0, swing=0.0, keys_vel=0.55, keys_lp=2800)
    mix.put_stereo(0, left, right, 0.09)
    mix.put(0, low, 0.09)
    mix.put(0, drums, 0.03)
    for key, f, g in (("hoist", 96, 0.05), ("travel", 40, 0.06), ("lower", 90, 0.04)):
        a, b = tl[key]
        mix.put(a, rumble(b - a, lambda t, f=f: f, 1.0), g)
    for v in tl["views"]:
        mix.put(v - 0.2, airy(0.6, 500, 1500, 0.6), 0.02)
