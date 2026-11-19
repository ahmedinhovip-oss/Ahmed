#!/usr/bin/env bash
# Rebuild this package's deliverables from src/ with the teardown skill (run `npm install` in the skill folder once).
#   ./build.sh          the 3D page
#   ./build.sh video    also re-record the 20 s tour video (needs ffmpeg; slow on a machine without a GPU)
set -euo pipefail
cd "$(dirname "$0")"
SKILL=../../../.claude/skills/teardown
TEARDOWN_OUT=out node "$SKILL/sims/build.mjs" ./src
sed 's|<title>src</title>|<title>Vibratory Feeder Simulator</title>|' out/dist/src.html > Vibratory-feeder-simulator.html
echo "page: Vibratory-feeder-simulator.html"
if [ "${1:-}" = video ]; then
  TEARDOWN_OUT=out python3 "$SKILL/run_sfx.py" film/score.py
  node film/record.cjs "$PWD/Vibratory-feeder-simulator.html" out/frames
  ffmpeg -y -loglevel error -framerate 30 -i out/frames/f%04d.png -i out/vf-score.wav \
    -vf "scale=1920:1080:flags=lanczos" -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p \
    -c:a aac -b:a 192k -shortest -movflags +faststart Vibratory-feeder-tour-20s.mp4
  echo "video: Vibratory-feeder-tour-20s.mp4"
fi
