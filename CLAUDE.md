# Repository conventions

This repo is the plant **Equipment Library**: `dashboard.html` at the root plus the `Library/` folder beside it.
The user keeps a copy at `C:\Users\SCO100317\OneDrive - Synergies Castings LLC\Desktop\CEO Tasks\2. Cluade files\`
(`dashboard.html` and `Library\` side by side).

- Areas, in metal-flow order: Melting, Casting, Die Maintenance, Heat Treatment, CNC, Paint Line, Packing
  (`Library/<Area>/`, listed in `Library/index.json`).
- Every machine the user sends manuals for gets a package at `Library/<Area>/<package-id>/` with the layout in
  `Library/README.md`: `manifest.json`, `README.md`, the 3D simulator HTML, the tour video (20 s mp4),
  `poster.jpg`, `docs/` holding the user's source files, `src/`, `film/`, `build.sh`.
- After adding a package: add its id to the area in `Library/index.json`, then run
  `python3 Library/build_dashboard.py` to regenerate `dashboard.html` (links into `Library/`), then
  `python3 Library/build_dashboard.py --single` and send the user `dashboard-single.html` renamed to
  `dashboard.html`: one self-contained file (simulators, videos, manuals embedded) that the user drops into the
  OneDrive folder. The single file is not committed (.gitignore).
- Simulators are built with the teardown skill in `.claude/skills/teardown` (`npm install` there once per session).
- Every simulator has an English / Arabic switch (see `Library/Melting/ha01-furnace/src/i18n.js` and `i18n-ar.js`):
  write the markup in English, translate every shown string into Arabic, keep tags, units and numbers as on the panel.
- Values not given by the source documents are marked `[A]` in the package's model and listed in its README.

# AI Office

`AI-Office/` is the user's AI team in a 3D office (see `AI-Office/README.md`). `AI-Office/team.json` is the one source
for people, job descriptions (EN + AR), meetings and breaks; `AI-Office/build.sh` rebuilds `AI-Office.html` and the
agent files in `AI-Office/.claude/agents/`. The dashboard shows it as a banner, so rebuild the dashboard after changing it.
Phase 2: agents' real reports live in `AI-Office/work/<agent>/`, inputs in `AI-Office/inbox/<agent>/`; the daily run is
described in `AI-Office/RUN.md`. Never invent numbers in a report; anything leaving the team is a draft.
