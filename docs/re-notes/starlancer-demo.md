# Starlancer Demo (`starlancer_demo`)

Digital Anvil / Microsoft, 2000. Direct3D 7 space combat, trial version.

## Source and licence

- archive.org item `sldemo`: `sldemo.exe`, 75,535,872 bytes, SHA-1
  `ca8e2733aa6344b99c241023b3425ce8556739b9`. Candidate `starlancer-demo`.
- The exe is Microsoft's GenSetup/Hotsetup self-extractor (`Setup.Exe`
  1.2000.6.701, built 2000-06-07) around one CAB at file offset 415160.
  `7z x sldemo.exe` unpacks the whole install layout (108 MB): `lancer.exe`,
  the `srd3d`/`srddraw`/`sr3DFX` renderer DLLs, `mss32` + Miles providers,
  `binkw32` + `.bik` movies, `resource.hog`, `EULA.rtf`.
- `EULA.rtf` is the Microsoft trial EULA, the same text as Midtown Madness
  Trial: non-commercial verbatim redistribution with the EULA allowed, plus
  the standard no-reverse-engineering clause. Registered localOnly.

## lancer.exe is packed

- Entry is a decompression stub at 0x6cd0xx (ESI reads the packed stream at
  0x652xxx, EDI writes the code section from 0x401000, EBX is the bit buffer).
  At the default headless block budget it moves ~230 bytes a batch, so CLI
  runs need `--batch-size=2000000` (the browser's 100k-block slices are fine).
- After a first CRT init (0x00a7xxxx) the stub resolves the game's imports
  itself: `LoadLibraryA` then `GetProcAddress` by name, and calls
  `ExitProcess(0)` from 0x6cd1b2 on the first NULL. That was
  `MessageBoxExA` (added with it). The name table sits at 0x6cb000-0x6cd000 at
  batch 4 (`--input=4:dump-mem:...` in 256-byte pieces); of its ~179 names
  MessageBoxExA was the only one we lacked.

## Input

- The menus read the mouse through DirectInput (`GetDeviceState` ~470k calls
  by the menu) with their own cursor built from relative motion. Headless:
  `--repaint-every=20`, walk the cursor with several `mousemove`s, then
  `mousedown`, a gap, `mouseup`. The game's cursor lands ~35 px ABOVE the
  requested point, so aim 36 px low.

## Headless route (boat bx_y8veqj25, 2026-10-11)

`--batch-size=2000000 --repaint-every=20 --quiet-api`, then:

| batch | input | screen |
|---|---|---|
| 60 | click 153,432 | EULA dialog -> Accept |
| 150 | click 230,138 | "Starlancer needs to detect your hardware" -> OK |
| ~300 | | main menu (Direct3D 7) |
| 330-363 | moves to 118,360, press | Single Player -> Select Pilot |
| 400-423 | moves to 412,294, press | Start Game -> Set Game Difficulty |
| 480-503 | moves to 287,311, press | Start -> mission briefing (~700) -> Ships and Loadout (~900) |
| 920-943 | moves to 598,80, press | launch (see run folder for what follows) |

The menu loop is heavy at this budget (~21k API calls a batch, ~3 batches/s).
Evidence: `scratch/runs/20261011T0630Z-starlancer-demo-d10ba697`.
