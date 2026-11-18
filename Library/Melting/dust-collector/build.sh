#!/usr/bin/env bash
# Rebuild this package's deliverables from src/ with the teardown skill (run `npm install` in the skill folder once).
#   ./build.sh          the 3D page
#   ./build.sh video    also re-record the 20 s tour video (needs ffmpeg; slow on a machine without a GPU)
set -euo pipefail
cd "$(dirname "$0")"
SKILL=../../../.claude/skills/teardown
TEARDOWN_OUT=out node "$SKILL/sims/build.mjs" ./src
sed 's|<title>src</title>|<title>Dust Collector Simulator</title>|' out/dist/src.html > Dust-collector-simulator.html
echo "page: Dust-collector-simulator.html"
if [ "${1:-}" = video ]; then
  TEARDOWN_OUT=out python3 "$SKILL/run_sfx.py" film/score.py
  node film/record.cjs "$PWD/Dust-collector-simulator.html" out/frames
  ffmpeg -y -loglevel error -framerate 30 -i out/frames/f%04d.png -i out/dc-score.wav \
    -vf "scale=1920:1080:flags=lanczos" -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p \
    -c:a aac -b:a 192k -shortest -movflags +faststart Dust-collector-tour-20s.mp4
  echo "video: Dust-collector-tour-20s.mp4"
fi
