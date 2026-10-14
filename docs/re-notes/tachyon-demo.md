# Tachyon: The Fringe (demo)

NovaLogic, 2000 (copyright screen says 1999). Space combat, first five
single-player missions. Candidate `tachyon-demo`, app `tachyon_demo`, local
only.

## Source and layout

- archive.org `TachyonTheFringe`, `TachyonDemo.zip` (61,461,980 bytes,
  sha1 6a51db79d5d29c0e6f036b9dd29c2ddfd0a42e70). An InstallShield 5 package;
  `tools/is5-extract.js` unpacks `DATA1.CAB` (14 files, 92 MB) to
  `installed/tachyon` (guest `c:\tachyon`).
- `LICENSE.TXT` (NovaLogic): personal use of one copy, no reproduction or
  transfer without written permission. So `localOnly`, never deployed.
- `Front.exe` is the setup front end (Play / Video Setup / Control Setup /
  Update); `Front.cfg` says it runs `tachyon.exe` and writes `tachyon.cfg`.
  The registry launches `Tachyon.exe` directly.
- Data: `Space.pff` (68 MB), `Menubgs.sbf`, `Exile.sbf`. Renderers:
  `Hw_d3d.dll` (Direct3D, loads at 0x6e8000 relocated from 0x10000000) and
  `Hw_3dfx.dll` (Glide 2, wants `glide2x.dll`).

## Renderer configuration

`tachyon.cfg` `[VIDEO]`, read by the game itself with `_lopen`/ReadFile (not
the profile API, so `startupIni` cannot change it):

- `USE_HARDWARE=0` (shipped): software renderer, no hw DLL.
- `USE_HARDWARE=1`, `HW_TYPE=0`: `hw_d3d.dll` (IDirectDraw4 + IDirect3D3).
- `USE_HARDWARE=1`, `HW_TYPE=1`: `hw_3dfx.dll` -> `glide2x.dll`.
- `RES=1` (shipped): under D3D the game sets 640x480x16, then 800x600x32 on a
  second DirectDraw interface, but its menu still draws into 640x480 buffers.
  Our input then scales the page's 640x480 canvas to 800x600 (a click at
  320,226 arrives as WM_MOUSEMOVE 400,282) and every menu click misses
  (`d3d-res1-800x600-click-miss-b1899.png`). Not fixed; open question
  whether the canvas should follow the second mode.
- `RES=0`: stays 640x480 and clicks land.

The registry mounts `Tachyon.cfg` with `iniSet` `USE_HARDWARE=1`, `HW_TYPE=0`,
`RES=0`. That needed dbc778344: a registry file now replaces the generated
local manifest's file at the same guest path.

## Fixes it needed

- dd75c48d3: `IDirectDrawSurface::GetDDInterface` returned the v1
  IDirectDraw. hw_d3d.dll creates its chain on IDirectDraw4, asks the back
  buffer for its DirectDraw (RVA 0x3a7e area) and calls slot 27
  (GetDeviceIdentifier, vendor compared with 0x12d2); on the v1 table it
  hit something else and the game posted WM_CLOSE at batch 6.

## Input

- Menus are WM_MOUSE* driven (DirectInput is created only to enumerate
  joysticks, then released).
- The pilot-name field reads WM_KEYDOWN together with WM_CHAR: CLI
  `keydown` alone or `keypress` alone types nothing; `keydown` + `keypress`
  + `keyup` per letter works (only one of three fast letters stuck; a name
  of one letter enables Play). A real keyboard sends all three.
- Flight keys (readme keychart): arrows pitch/yaw, Space fire, Tab
  afterburner, Backspace full throttle, 0 zero throttle, +/- throttle,
  comma/period roll, 1/2 weapons, ? in-game key chart, Esc exit.

## Route (headless, `--batch-size=100000`, D3D registry config)

Guest 640x480 coordinates.

| batch | input | result |
|---|---|---|
| ~150 | - | main menu (Single Player / Multiplayer / Exit) |
| 200-210 | click 320,226 | pilot slots |
| 320-330 | click 320,63 | slot 1 selected, caret from ~500 |
| 470-494 | keydown+keypress+keyup A, C, E | name "C" |
| 520 | Enter | name accepted |
| 580-590 | click Play 235,365 | intro cutscene (~700) |
| ~2000 | - | starbase interior |
| 2100-2130 | click the "01" door 233,240 | Ship Bay (Pegasus; Configure / Launch / Lobby) |
| 2300-2310 | click Launch 320,440 | launch |
| ~3300 | - | cockpit, training objectives (throttle, roll, ?) |
| ~3700 | - | jump gate |
| ~4800 | - | "Destination: Venus - Training Sector, head to Luna" |

The right-hand console (470,300) opens the news terminal.

Evidence: scratch/runs/20261011T2025Z-tachyon-demo-claude1863.
