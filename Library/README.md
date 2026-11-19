# Equipment Library

Open `dashboard.html` (one folder up). It lists the seven plant areas in metal-flow order. Each machine card has
**Open 3D simulator**, **Play video**, and downloads for the manuals, the video and the 3D page.

```
dashboard.html
Library/
  index.json                 areas and the packages in each (the dashboard is built from this)
  build_dashboard.py         regenerates ../dashboard.html after a change
  <Area>/<package-id>/
    manifest.json            title, equipment, summary, file paths
    README.md                how to use it, values assumed
    <name>-simulator.html    the 3D simulator (offline; Chrome or Edge)
    <name>-tour-20s.mp4      the tour video
    poster.jpg               the card image
    docs/                    the manuals it was built from
    src/  film/  build.sh    code and video script (kept in GitHub, not needed on OneDrive)
```

| Area | Machines |
|---|---|
| Melting | [HA01 Melting Furnace](Melting/ha01-furnace/README.md), [HC01 Melting Furnace](Melting/hc01-furnace/README.md), [Degassing Machine](Melting/degassing-machine/README.md), [Dust Collector](Melting/dust-collector/README.md), [SWM#1 Procedure Trainer](Melting/swm1-furnace/README.md), [Vibratory Feeder](Melting/vibratory-feeder/README.md), [Spare Parts Catalogue](Melting/spare-parts/README.md) |
| Casting | none yet |
| Die Maintenance | none yet |
| Heat Treatment | none yet |
| CNC | [2.0 t EOT Crane](CNC/eot-crane-2t/README.md) |
| Paint Line | none yet |
| Packing | none yet |
