#!/usr/bin/env bash
# Rebuild the AI Office from team.json and src/:
#   1. the agent files in .claude/agents/ (one per person)
#   2. AI-Office.html, one offline page (three.js and fonts inlined)
# Needs `npm install` once in .claude/skills/teardown (the bundler and three.js live there).
set -euo pipefail
cd "$(dirname "$0")"
python3 make_agents.py
SKILL=../.claude/skills/teardown
TEARDOWN_OUT=out node "$SKILL/sims/build.mjs" ./src
sed 's|<title>src</title>|<title>AI Office</title>|' out/dist/src.html > AI-Office.html
echo "page: AI-Office.html"
