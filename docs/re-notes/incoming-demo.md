# Incoming (demo, "Lux et Robur")

Rage Software, 1998, Direct3D (DirectDraw + D3D, DirectInput keyboard,
DirectSound, DirectPlay) arcade shooter: you fly or drive vehicles and man gun
turrets. Candidate `incoming-demo`, app `incoming_demo`, local only.

## Source and layout

- archive.org `incoming_201401`, `incoming.exe` (3,971,633 bytes, sha1
  c00f73f19088d50c8fb3690fc7a0fea503ea5f5f).
- That file is a WinZip self-extractor, and the zip inside is a ready-to-run
  tree (no installer): `incoming.exe` (the game, 926,208 bytes),
  `gameindex.exe`, `asc\` (language text, level scripts `levels.txt`,
  `africa\*.odl/.wdl/.bin`, `pads\PAD0.CTL`), `ppm\` (256x256 PPM textures),
  `pcobject\` (`.ian` models), `wavs\`, and `save\incoming.cfg` plus `store.lev`.
- The candidate extracts the zip to `installed/incoming` (guest
  `c:\incoming`). The working directory must be the game folder: it opens
  `asc\language\.\keychar.txt` relative to it, and a bare `--exe=` run stops on
  the "Incoming Error Report." MessageBox "File asc\language\.\keychar.txt not
  found !!".
- Imports: USER32, GDI32, WINMM, ole32, DDRAW, DINPUT, DPLAYX, DSOUND,
  KERNEL32. The readme lists its command-line switches (`-notfullscreen`,
  `-nosound`, `-nolighting` ...); none are needed.

## Route (headless, `--batch-size=100000`)

- About 1,500 batches of loading ("Please wait.... loading Incoming." window,
  646x506), then the 640x480 3D main menu: Start Game / Load Game / Game
  Options / Exit.
- Enter on Start Game, then Enter three more times (about 400 batches apart),
  goes through the Mission Briefing (Kenya, ADATA installation) into phase 1/10
  in the gun turret. Frames at 3,400 batches and later show gameplay.
- In the browser, four taps on the touch Enter button do the same.
- Game Options = Down x2 + Enter; Controller is the fifth item. Its Keyboard
  page is the authoritative key chart: Space fire primary, L Shift fire
  secondary, arrows left/right/up/down, Q forward, A reverse, Z/X rotate
  left/right. The touch layout uses exactly these keys.
- Don't press Enter blind in the Video submenu: it toggles the first setting
  (Lighting).

## Verified behaviour

- Left held about 90 batches turns the turret about 180 degrees, toward the base.
- Space fires: the score went to -3000 with "RADAR DAMAGED" when the turret
  faced the friendly radar dish.
- L Ctrl does nothing, as the chart says.
- Browser at 844x390: holding the dpad turns the turret, and holding Fire draws
  tracers.

Evidence: `scratch/runs/20261011T1822Z-incoming-demo-w4/`.

## Not checked

Audio output, DirectPlay, flying/driving phases beyond the first turret phase,
Threads vs cooperative mode differences, WebKit.
