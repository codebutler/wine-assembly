# Rollcage demo (Psygnosis/Attention to Detail, 1999, Direct3D)

App id `rollcage_demo`, candidate `rollcage-demo` (registered 2026-10-11, w5).

## Source and licence

- archive.org item `RollcageDemo`, `RollcageDemo.zip`: 25,918,163 bytes, SHA-1
  `3e95613233ac21d2543d999c5f86fb5d98ea8f45`.
- It is a demo CD. `DISK1/ROLLCAGE/` holds the game loose, already laid out as
  installed:
  - a launcher `ROLLCAGE.EXE` (40 KB);
  - `DIRECT3D/ROLLCAGE.EXE` (786 KB) and `QMIXER.DLL`;
  - `GLIDE/ROLLCAGE.EXE` and `QMIXER.DLL`;
  - `IDXDATA/ROLLCAGE.IDX` and `ROLLCAGE.IMG` (20 MB).
- `DATA1.CAB` (InstallShield 5) only lists those same files.
- **No licence grant.** `README.TXT` says "© 1999 Psygnosis Ltd/Attention To
  Detail ... All rights reserved". The setup script names a `license.txt` that
  exists neither on the disc nor in the cab. The candidate is `localOnly`.

## Launch

- `DIRECT3D\ROLLCAGE.EXE` opens its data as `..\IDXData\rollcage.img`, so it
  must start in `C:\Rollcage\Direct3D`.
  - Started from `C:\Rollcage`, the setup dialog came up with blank buttons
    and an empty Device/Resolution list, because the per-language
    `PC_INFORMATION_MESSAGES` strings and the mode list never loaded.
- Static imports include `QMIXER.dll` (QSound) from its own directory and
  DINPUT/DSOUND/DPLAYX.
- **ATD "GFX chaining".** The first process is only the setup dialog (dialog
  129, DlgProc `0x43838a`).
  - Play creates event `ATDGFXCHAINING`, runs `CreateProcessA("Rollcage.exe",
    "\"Rollcage.exe\" /FRONTEND")`, waits 100 ms and exits.
  - The menus, attract mode and races all run in that `/FRONTEND` child.
  - After an idle attract cycle the front end relaunches itself (another
    `/FRONTEND`) and exits.
  - So the app needs `spawnProcesses: true`.
  - Since the CLI fix, a spawned child inherits the parent's DLL seeds; before
    it, the child crashed on the unresolved `QSWaveMixInitEx`.
- Input is DirectInput only: `GetDeviceState` on the keyboard (256 bytes,
  buffer at `0x4e0200`). Use `di-keydown`/`di-keyup`; `WM_KEYDOWN` does nothing.

## Route (CLI, `--batch-size=200000`)

```
node test/run.js --app=rollcage_demo --no-build --quiet-api --quiet-blocks \
  --batch-size=200000 --max-batches=1400 --input=250:click:451:121 \
  --pipe-child-args="--batch-size=200000 --input=160:di-keydown:13,162:di-keyup:13,200:di-keydown:13,202:di-keyup:13,240:di-keydown:13,242:di-keyup:13,280:di-keydown:13,282:di-keyup:13,400:di-keydown:38,450:png:race.png,600:png:race2.png"
```

- Parent batch 250: click Play at (451,121).
- Child batch 150: main menu (League / Arcade / ... / Quit Game).
- The Enter presses go through Arcade, then the car screen, then the track list
  (Daytona highlighted, "Harpoon Islands"), then the start.
- By child batch 450 the race has started: LAP 00 OF 03, 5th place, 53 km/h.
- Holding Up (VK 38): by batch 600 the player is on lap 1 at 349 km/h, driving
  along a tunnel wall.

Spawned children are full 512 MB guests. An earlier attempt let the
`/FRONTEND` relaunch chain nest several deep and wedged an 8 GB boat. Run
under a watchdog that caps the number of spawned children.

Evidence: `scratch/runs/20261011T0650Z-rollcage_demo-race-w5`.
