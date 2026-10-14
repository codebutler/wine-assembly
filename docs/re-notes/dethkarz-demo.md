# Dethkarz demo (Beam Software / Melbourne House, Infogrames 1998, Direct3D)

App id `dethkarz_demo`, candidate `dethkarz-demo` (registered 2026-10-11, w5).
Evidence: `scratch/runs/20261011T0750Z-dethkarz_demo-race-w5/`.

## Source and licence

- archive.org item `DETHKARZ`, `DETHKARZ.zip`: 17,402,067 bytes, SHA-1
  `b43457dfe3d18a25822c5048b735d4570ea476ac`.
- The zip holds an InstallShield 5 setup. `unshield` extracts three groups:
  - "Dethkarz Main Files": `Dethkarz.exe`, `IFORCE2.DLL`, the `.ifr` force
    profiles and `Device Libraries\`;
  - "Data";
  - "GOB File": `Dethkarz.zip`, the game archive (GOB).
- **No licence grant.** `City Demo Readme.txt` gives only the story and
  controls. The exe and setup state no redistribution terms. The candidate is
  `localOnly`.

## Layout the game needs

- **`Install Path`.** `HKLM\Software\Melbourne House\Dethkarz` must hold
  `Install Path`. The game opens `<drive>:\Data\Dethkarz.zip` from it.
  - Unset, it fails with `Failed to load GOB @:\Data\Dethkarz.zip`.
  - The registration writes `C:\Dethkarz`, and the GOB goes in
    `installed/dethkarz/Data`.
- **Renderer DLLs.** Renderers are found with
  `FindFirstFileA(".\Device Libraries\*.dll")`.
  - The folder name has a space. `unshield` writes it as `Device_Libraries`,
    so the candidate copies it back as `Device Libraries`.
  - With only `Device_Libraries`, the game fails with MessageBox `002 - No
    valid graphics drivers were found`.
  - The folder holds `Vertigo Direct3D.dll` and
    `Vertigo 3Dfx (Glide 2).dll`.

## Startup driver dialog

- `DialogBoxIndirectParamA` (DlgProc `0x402be0`) offers "3Dfx Voodoo Native
  Driver" first and "Microsoft Direct3D Hardware Driver" second.
  - Picking Direct3D shows a "Direct3D Device" combo: Primary Display Driver.
  - The mode is 640x480x16.
- **Glide is the default, and it dies.** OK on the default crashes in
  `_grTexDetailControl@16` (unimplemented in `09a8h-glide.wat`), called with
  tmu 0, lodBias 4, detailScale 6 and detailMax 1.0.
  - Detail-texture combine factors are an explicit backend limitation there.
  - Pick Direct3D. In the browser, that means choosing it in the dropdown.
- **Main wndproc `0x49e0c0`.** Its WM_SIZE arm (around `0x49e1d8`) maps
  wParam onto ShowWindow:
  - SIZE_RESTORED → SW_RESTORE;
  - SIZE_MINIMIZED → SW_MINIMIZE;
  - SIZE_MAXIMIZED → SW_SHOWMAXIMIZED.
  
  It then calls `InvalidateRect` and `UpdateWindow`.
  - Before this registration, our ShowWindow(SW_SHOWMAXIMIZED) on an
    already-maximized main window re-posted WM_MOVE/WM_SIZE (and an extra
    WM_SHOWWINDOW). That made an endless loop.
  - The post queue drains before host input, so the modal dialog never saw
    another click. The dropdown opened but no item could be picked
    (`before-fix-dropdown-stuck.png`).
  - Fixed in `$handle_ShowWindow`: WM_SHOWWINDOW is sent only on a visibility
    change, and an already-visible zoomed window gets no resize pair.

## Headless route (CLI, `--batch-size=200000`)

1. Pick Direct3D with mouse down and up:
   - combo arrow at (494,198), batches 300/303;
   - "Microsoft Direct3D" item at (300,236), batches 320/323;
   - OK at (243,288), batches 340/343.
2. Title "PRESS ENTER" by batch 1000. Send Enter (keydown plus
   `di-keydown:13`) at batches 1000, 1150, 1300, 1450, 1600 and 1750:
   - Game Select → Arcade;
   - Car Select (Hyperon Alpha "Arrow"; Begin Race);
   - Metro City (Medium) loading;
   - grid.
3. Camera flyby until "GO" at about batch 3200.
4. Up (`di-keydown:38` plus keydown) held from before GO does nothing. Release
   it and press it again after GO (batches 3240/3250).
   - The car reaches 111 km/h in gear 2 by batch 3400.
   - It reaches 219 km/h in gear 3 and position 19/20 by batch 3700.

Route script: `route.sh` in the evidence folder. With threads off the run is
about 36 s of wall time for 3900 batches.

## Phone route (WebKit, iPhone 15 landscape, Threads on)

- The driver dialog is drawn zoomed to the phone width. Real taps work on it:
  the combo arrow, then "Microsoft Direct3D Hardware Driver", then OK.
- The menus read Enter through `GetDeviceState`, not through messages. An
  overlay Enter whose keydown and keyup came in one JS turn was never seen;
  6d595095a holds every overlay key for at least 100 ms.
- The overlay's Esc/Enter (top left) sit under the "swipe up here for more
  screen" gutter until Safari's bars collapse (MOBILE-GUTTER-COVERS-TL-CONTROLS).
- Race: Gas held 113 km/h, stick steers, Brake, Esc pauses. Evidence:
  `scratch/runs/20261011T1330Z-dethkarz_demo-mobile-webkit-w5`.

## Open

- Glide path: `grTexDetailControl` and the detail combine factor.
- Firing (Ctrl, readme "Shift fires") is not confirmed in the captures.
- `ole32.dll` is reported as "loaded as a real PE but is not on disk" on a
  fresh checkout. That is harmless here.
