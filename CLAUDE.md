# Repository conventions

This repo collects plant equipment packages (3D simulators, videos, source documents) for a later dashboard.

- Every machine or system gets a package folder at `packages/<area>/<package-id>/` (areas so far: `melting`).
  Follow the layout in `packages/README.md`: `manifest.json`, `README.md`, the simulator HTML, the tour video,
  `docs/` with the source files the user provided, `src/`, `film/`, `build.sh`.
- When a package is added, also update `packages/index.json` and the table in `packages/README.md`.
- Simulators are built with the teardown skill in `.claude/skills/teardown` (`npm install` there once per session).
- Values not given by the source documents are marked `[A]` in the package's model and listed in its README.
