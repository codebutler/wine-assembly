# Pharaoh demo

Impressions' 1999 city builder, built on the Caesar III engine family
([caesar3-demo.md](caesar3-demo.md)). Registered as `pharaoh_demo`.

## Payload

`test/candidate-corpus/manifest.json`, id `pharaoh-demo`:

```text
archive.org PharaohDemo/PharaohDemo.zip (SHA-1 e09b5f04...)
  -> InstallShield 5 media (data1.cab, built 1999-08-10)
  -> tools/is5-extract.js (fetcher step is5Extract) -> installed/
     PharaohDemo.exe + SMACKW32.DLL + mss32.dll + binkw32.dll + data (305 files, ~121 MB)
```

The cab's common header carries version 0x01000004, the early IS5 layout
`tools/is5-extract.js` was written for (Heretic II). It yields the same 305
files and 121 MB as `unshield -g Executable`, needs no host unshield (the ops box has none),
and checks every file against its recorded expanded size. The fetched candidate
is about 207 MB on disk (86 MB of installer media plus `installed/`); the zip
itself only lives in the fetcher's temp directory.

Licence: the Sierra demo EULA shipped in the package (EULADEMO.txt) grants a
single-user licence and forbids copying or reproduction, so the candidate is
`localOnly`.

`SMACKW32.DLL` and `mss32.dll` are listed as app DLLs; `binkw32.dll` is
loaded from the install directory by the normal import path.

## Speed

At the CLI's default block budget the title takes thousands of batches and
looks frozen (uniform frames, a few hundred API calls). Pass
`--batch-size=100000`: the title screen appears at about batch 2000.

## Route to a growing village (batch numbers at --batch-size=100000)

Each click is a mousemove, a mousedown, and a mouseup about 25 batches later.

| Batches | Action |
|---|---|
| 2050-2075 | (320,300) title "Click to Start" |
| 2450-2475 | (320,138) Play Demo |
| 2850-2875 | (320,138) Predynastic Period |
| 3500/3510 | keydown/keyup 13: accept the default name |
| 3900-3925 | (484,398) briefing "Nubt: A Village is Born", To the city |
| 4400-4440 | (499,283) Build Roads |
| 4520-4650 | drag (100,300) to (420,300): a road |
| 4800-4840 | (499,243) Build Housing |
| 4860-4960 | drag (160,318) to (340,340): housing plots beside the road |

Result: immigrants walk in along the road, and the population grows from 0 to
39 (April) and then 60 (June 3500 BC) with the huts occupied by about batch 9000.

Housing plots with no road access disappear, so build the road first.

## Sidebar buttons (640x480, construction panel)

Hover over a button and its tooltip names it:

| y \ x | 499 | 529 | 561 | 593 |
|---|---|---|---|---|
| 243 | Housing | Farming and Food | Entertainment | Health and Sanitation |
| 283 | Roads | Industrial | Religious | Municipal |
| 322 | Clear Land | Storage and Distribution | Education | Military |
| 363 | Undo | View Messages | Cycle trouble spots | (fourth button) |

Evidence: `scratch/runs/20261011T0730Z-pharaoh-w6/`.

## Browser route (800x600) and drag-to-build (claude:w4, 2026-10-11)

The browser runs the demo at **800x600**, while the CLI defaults to 640x480
(`--screen=800x600` matches the browser). At 800x600 the menu art is 640x480
centred at (80,60), and the city sidebar is in its 800x600 layout. The 640x480
table above does not apply there. Guest coordinates at 800x600:

| Action | Point |
|---|---|
| title "Click to Start" | (400,360) |
| Play Demo, then Predynastic Period | (400,172) |
| name | Enter |
| briefing "To the city" arrow | (606,497) |
| Build Housing / Build Roads (sidebar column 1, rows 1/2) | (625,305) / (625,350) |

Drag-to-build works in the browser in both cooperative and Threads mode: the
road preview shows its cost while the button is held, a road and a housing
block get built, and huts fill (Pop 50 after 60 s). The earlier report that it
built nothing came from a probe pressing (659,283), which is not the Roads
button at 800x600. With that point neither the CLI nor the browser shows a
preview. Evidence: `scratch/runs/20261011T1225Z-pharaoh-drag-800-w4`.
