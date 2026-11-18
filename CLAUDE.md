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
  `python3 Library/build_dashboard.py` to regenerate `dashboard.html`, and give the user a ZIP of
  `dashboard.html` + `Library/` (deliverables only, no `src/` or `film/`) to unzip into the OneDrive folder.
- Simulators are built with the teardown skill in `.claude/skills/teardown` (`npm install` there once per session).
- Values not given by the source documents are marked `[A]` in the package's model and listed in its README.
