"""Score for the SWM#1 procedure-trainer film: a quiet bed, the Aluswirler's hum while it turns, a scrap rattle while
the conveyor feeds the vortex, a harsher roar during the aggressive-vortex demonstration, the hoist motor, and a soft
chime at each third of the blade lowered into the metal.

Every time comes from film/timeline.json, which mirrors FILM in src/main.js.
"""

import os

from sfx.score_kit import beep, bed, chords, hz, motor, rattle, rumble

TIMELINE = "timeline.json"
OUT = os.path.join(os.environ.get("TEARDOWN_OUT", "teardown-out"), "swm-score.wav")
TARGET_LUFS = -14.0
SEED = 41

CHORDS = chords("Bm9:B1 F#2 A2 C#3 D3/B0", "Gmaj7:G1 D2 F#2 B2/G0", "Dmaj7:D2 A2 C#3 F#3/D1", "A6sus:A1 D2 E2 F#2/A0")
MOTIF = [(0.5, hz("F#4")), (1.5, hz("B4")), (2.5, hz("A4"))]


def score(mix, tl):
    dur = tl["duration"]
    left, right, low, drums = bed(dur, 80, CHORDS, MOTIF, motif_voice="epiano", kicks=(0,), snares=(), hats=0, swing=0.0, keys_vel=0.55, keys_lp=2800)
    mix.put_stereo(0, left, right, 0.09)
    mix.put(0, low, 0.09)
    mix.put(0, drums, 0.03)
    s0, s1 = tl["scrap"]
    a0, a1 = tl["aggressive"]
    mix.put(0.3, rumble(s1 + 0.8, lambda t: 46 if t + 0.3 < a0 else 62, 1.0), 0.04)
    mix.put(s0, rattle(s1 - s0, 30, 3000, 5, 1.0), 0.025)
    mix.put(a0, rumble(a1 - a0, lambda t: 90, 1.0), 0.02)
    h0, h1 = tl["hoist"]
    mix.put(h0, motor(h1 - h0 + 0.6, 160, 1200, 10), 0.02)
    for k, t in enumerate(tl["thirds"]):
        mix.put(t, beep(hz(["D5", "F#5", "A5"][k]), 0.3), 0.035)
