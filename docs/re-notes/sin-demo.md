# SiN Demo (Ritual Entertainment / Activision, 1998)

App `sin_demo` (candidate `sin-demo`, localOnly), "OS Rev 0.93 Demo".
Registered ff0c51dde. Quake II engine: `sin.exe` imports only system DLLs;
`ref_gl.dll`/`ref_soft.dll` and `base/gamex86.dll` load at runtime, data in
`base/pak0.pak`.

## Source and licence

archive.org `swizzle_demu_Sin`, `Sin.exe` (35471872 bytes, SHA-1
`81a61458…`): a WinZip self-extractor whose `data\` folder is a ready
install (the setup.exe beside it is not needed). The P-Z collection item also
has `SinDemo-OpenGL-SW.exe`; not used. `readme.htm`/`readme.doc` contain no
licence or redistribution terms, only a 1998 contest, so it is a localOnly
"no stated terms" fixture like forsaken-demo.

## Running

- `base/default.cfg` sets `vid_ref sw` and `gl_driver 3dfxgl`; the app's
  args select `vid_ref gl` / `gl_driver opengl32` (our GL) and raise
  `cl_timeout`/`timeout` as for kingpin_demo (same Quake II loopback; not
  separately shown to be needed here). CLI needs `--headless-gl`.
- `LoadLibraryA("opengl32")` again answers `0x00400000` (see
  heretic2-demo.md); harmless.

## Route (headless, `--batch-size=50000`)

1. HARDCORPS log-on screen ("Logon Name: blade") by about b800: Enter at
   1150.
2. Circular main menu with GAME selected: Enter at 1400, 1500, 1600, 1700
   through the game menu.
3. Intro maps (JC at headquarters, Blade in the lift, the helipad briefing)
   then a reload (the loading screens recur at about b8000-b8500) and the
   first map's scripted fly-over of the city. Space at 7000/7500 did not
   visibly shorten it.
4. Player control on the rooftop from about b12500: HUD (items, ammo,
   health 89, armor). Up walks, Right turns (into a stairwell).

Evidence: `scratch/runs/20261011T0910Z-sin_demo-gameplay-claude1863`.
Not looked at: the browser, combat, sound, the software renderer.
