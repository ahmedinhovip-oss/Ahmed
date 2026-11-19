#!/usr/bin/env bash
# Rebuild the catalogue page (and with `video`, the walkthrough video) with the teardown kit's bundler.
set -euo pipefail
cd "$(dirname "$0")"
SKILL=../../../.claude/skills/teardown
TEARDOWN_OUT=out node "$SKILL/sims/build.mjs" ./src
sed 's|<title>src</title>|<title>Melting Spare Parts</title>|' out/dist/src.html > Melting-spare-parts-catalogue.html
echo "page: Melting-spare-parts-catalogue.html"
if [ "${1:-}" = video ]; then
  node film/record.cjs "$PWD/Melting-spare-parts-catalogue.html" out/frames
  ffmpeg -y -loglevel error -framerate 30 -i out/frames/f%04d.png -f lavfi -i anullsrc=r=48000:cl=stereo \
    -vf "scale=1920:1080:flags=lanczos" -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p -c:a aac -shortest -movflags +faststart Melting-spare-parts-tour-20s.mp4
fi
