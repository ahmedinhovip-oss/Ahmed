# Melting system · spare-parts catalogue

Built from Insertec's **spare-parts list CE-2019-019.2** (CMR-1993-001.2, 07/10/2020) for the automated alloying
and melting system (E1982–E1991). This file is a parts list, not a machine manual, so this package is a
**catalogue** instead of a 3D simulator. Open `Melting-spare-parts-catalogue.html`; the 20 s walkthrough is
`Melting-spare-parts-tour-20s.mp4` (no sound).

- **Coverage:** all 176 items, in 11 systems with their value (HA#1, HC#1, SWM#1, SWM#2, IDEX, transfer pump,
  tilting platform, dosing, pre-treatment, rejected wheels, launders).
- **Filters:**
  - **Machine:** HA#1, HC#1, SWM#1, SWM#2 or IDEX. This uses the list's notes "Common spare parts valid for
    E1982-HA#1, E1983-HC#1 …", so a machine also shows the shared parts listed under another furnace.
  - **Type:** critical or consumable.
  - **Shared:** only the parts that serve more than one machine.
  - **Search:** by part name, drawing or mark.
- **Sorting:** click any column (for example, total value).
- **Details:** click a part to see its quantity, prices, drawing and mark, its system and group, and every machine
  it serves.
- **Language:** EN / عربي switches the labels and system names. Part names stay as the supplier wrote them.
- **Totals:**
  - The list total is 228,148 €; the rows add up to 228,152 € (rounding in the source).
  - Items 143–146 (shaft & rotor, posts, base, cement) are priced inside item 142.

## Rebuild

```
./build.sh          # the page
./build.sh video    # also the walkthrough video
```

The data is `src/items.json`, extracted from the PDF.
