# Expendable Demo (Rage Software, 1999)

`--app=expendable_demo`. Direct3D (DirectX 6) third-person shooter, also sold
as *Millennium Soldier: Expendable*. Candidate `expendable-demo`: archive.org
`expendabledemo`, `expendabledemo.zip` (51,392,996 B, sha1
`fd8c182434fd0604f40c12c638fef3d45c408cba`), an InstallShield 5 setup whose
`data1.cab` group "Program Executable Files" `unshield` extracts into
`installed/`. Local only: the installer's licence dialog has no text, and the
manual's retail EULA (`english/Maneng.doc`) forbids copying and electronic
transfer.

## Launch chain

- `Expendable.exe` is a launcher dialog (Play / Setup / Exit). Play stays
  disabled until Setup has saved options. Setup is an MFC property sheet
  (Video / Audio pages). Its "Select Direct Draw Driver" list is filled from
  `DirectDrawEnumerateA` (callback `0x401680`): DirectDrawCreate, QI
  IDirectDraw4, GetCaps, QI IDirect3D3 + EnumDevices (callback `0x401610`
  takes the HAL device's `dwDeviceRenderBitDepth`), EnumDisplayModes, then
  `IDirectDraw4::GetDeviceIdentifier`, whose `szDescription` is the name
  listed. The list is first filled before the sheet exists (dialog handle
  global `0x4179b0` still 0, every CB_ADDSTRING fails), then again by the
  Video page proc `0x403510` from the saved name list.
- Enter in the sheet saves under `HKLM\Software\Rage\Expendable\Options`
  (Driver "Primary", DriverNum 0, ResolutionX/Y 640/480, Colour Depth 16,
  TextureCompression 0, UseDirectShow 1, UseVsync/TripleBuffer/AntiAlias/
  Stencil 0, DisableSound 0, MaxStream 0, Sound 0) and enables Play.
- Play `CreateProcessA("Go.exe")` and exits. The registry entry runs `go.exe`
  directly with those values in `startupRegistry`.

Fixed on the way (2026-10-11):

- **`GetDeviceIdentifier` layout.** DDDEVICEIDENTIFIER's strings are
  MAX_DDDEVICEID_STRING (512), not MAX_PATH: we wrote szDescription at +260,
  the launcher read an empty name at +512, and with no readable driver Play
  never enabled.
- **IDirectInputDevice2 on a v3 DirectInput.** `go.exe` creates DirectInput
  0x0300, QIs its keyboard device for IDirectInputDevice2A, and on our old
  E_NOINTERFACE released the device but kept the NULL; at batch ~160 it called
  Unacquire through it (`0x42e7d0`, EIP 0). Device2 now has no version floor
  (Device7 still needs v7).

## Route (headless, default clock, `--batch-size=50000`)

Menus read window key messages; gameplay keys go through DirectInput, so send
each key both ways (`keydown` + `di-keydown`).

| batch | input | screen |
|---|---|---|
| ~300 | — | main menu: Arcade Game / Options / Credits / Exit to Windows |
| 400 | Enter | New Game / Continue a Game / Skill Level / Back |
| 1000, 1600 | Enter | mission briefing over the 3D level: System Sigmus, planet Novocastria, Capital City, "Wipe out alien advance party and locate subway entrance"; HUD "PRESS FIRE TO JOIN", credits 5 |
| 4000 | Ctrl (fire) | soldier spawns, HUD with lives/ammo/TIME |
| 6000-7000 | hold Up | soldier walks down the street to the crates; an enemy appears |
| ~7600 | — | back at the main menu |

The return to the menu after ~3600 batches of play looks like the level TIME
counter running out on the 200 ms/batch clock (it falls from four digits to
14 within ~2000 batches); not investigated.

Both arms render the same frames: software D3DIM, and `--headless-gl
--d3dim-gpu` (60,521 GPU draws, 0 fallbacks over 7000 batches). Evidence:
`scratch/runs/20261011T0840Z-expendable-demo-w4`.
