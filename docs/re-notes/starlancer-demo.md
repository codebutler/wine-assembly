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

## Additional dated branch findings

These historical observations supplement the current facts above; they do not establish a new current-main runtime result.

## 2026-10-11: released route review, not a launch-time INI diagnosis

Codex recovered the released `~/slout2/r2.log`, `b0920.png` and `b1120.png`
from boat bx_c585hr7p into
`scratch/runs/20261011T1241Z-starlancer-handoff-review/`.
Both reviewed frames show the **Options menu** (Save/Load, Audio, Control
Devices, Video, Back/Main Menu/Quit), not Ships and Loadout or mission flight.
The route's Esc inputs at batches 640/660 and its later supposed launch-arrow
click therefore need visual revalidation; the evidence does not show which
earlier input first diverged. The run completed 1125 batches without a trap.

The traced profile-string calls name `C:\\starlancer.ini`; there is no
`default.txt` match in this log. Integer-profile calls retain pointer arguments,
so absence of a decoded path is not proof that every integer-profile call
avoided it. The released INI parking patch may address a generic lazy-file
consumer gap, but this run does not demonstrate that it fixes mission launch.
Do not adopt its comment asserting GetPrivateProfileString reads default.txt
as an established game diagnosis.

Next runtime: visually confirm each transition through briefing and loadout,
then capture the actual failing file consumer with bounded filesystem/host
tracing. Preserve licence/approval boundaries; the historical script's clicks
are evidence of what it did, not authority to replay an acceptance prompt.
No new launch, gameplay, FPS or audio qualification accompanies this review.

### Recovered earlier loadout route

The retained `20261011T0630Z-starlancer-demo-d10ba697` evidence includes a
different route: `sl-run17.sh` does **not** press Esc during briefing.
Its reviewed `07-loadout.png` and `08-loadout-after-launch-attempts.png`
both show the actual Ships and Loadout hangar with the Predator selected.
The ship model changes orientation between the frames; flight is still absent.
This separates a confirmed earlier loadout screen from the later r2 Options
menu divergence. Prefer visual checkpoints on the earlier no-Esc route when
resuming; do not assume an arrow click was consumed merely from its coordinates.
Historical licence clicks remain evidence only, not authority for new acceptance.

The installed fixture remains at
`/home/user/wine-assembly-web/test/binaries/candidates/starlancer-demo/installed`
after the old boat expires. `DEFAULT.TXT` is an INI-style `[KeyConfig]` file,
including arrows for steering, `]` for full throttle, Space for lasers and
Enter for missiles. Inventory hashes are in
`scratch/runs/20261011T1400Z-starlancer-fixture-audit/inventory.json`.
Packed `lancer.exe` has no plain-text default.txt/profile-API match in this
static scan; the actual runtime reader remains unproven.
