# Plant packages

One folder per machine or system, grouped by plant area. Each package holds everything about that machine:

```
packages/<area>/<package-id>/
  manifest.json           what the dashboard reads: title, area, summary, and the paths below
  README.md               what it is, how to use it, assumptions to check
  <name>-simulator.html   the interactive 3D page (offline, opens in Chrome or Edge)
  <name>-tour-20s.mp4     the recorded tour video
  docs/                   the source documents it was built from (manuals, drawings, P&IDs)
  src/                    the code of the page
  film/                   the video's timeline, soundtrack and recorder
  build.sh                rebuilds the page (and, with `video`, the video)
```

`index.json` lists every package by area. Add a package there when you add its folder.

| Area | Package | Simulator | Video | Source |
|---|---|---|---|---|
| Melting | [HA01 Melting Furnace](melting/ha01-furnace/README.md) | [3D](melting/ha01-furnace/HA01-furnace-simulator.html) | [mp4](melting/ha01-furnace/HA01-furnace-tour-20s.mp4) | [HMI manual](melting/ha01-furnace/docs/) |
