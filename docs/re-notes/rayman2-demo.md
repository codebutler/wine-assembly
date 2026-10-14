# Rayman 2: The Great Escape (demo)

Ubisoft, 1999, Direct3D (GliDX6) / Glide (GliVD1) 3D platformer. Candidate
`rayman2-demo`, app `rayman2_demo`, local only.

## Source and layout

- archive.org `Rayman2TheGreatEscape`, `Rayman2Demo.zip` (59,378,961 bytes,
  sha1 b133d45c0b388c43e0466af2813f460895655f8c).
- The zip is a ready-to-run tree: `Rayman2Demo.exe` (internal name
  MainWinR.exe, 208 exports), `BinData\`, `dll\GliDX6vr.dll`,
  `dll\GliVD1vr.dll`, and the Ubisoft sound modules `WAVPWBVR.dll` and
  `APMP5BVR.dll` (plus the `S` variants, chosen by `dll\SND_CPA.ini`).
- The candidate extracts it to `installed/rayman2` (guest `c:\rayman2`).

## Renderer configuration

The renderer comes from `C:\WINDOWS\UbiSoft\Ubi.ini` `[Rayman2]`:
`GLI_DllFile`, `GLI_Dll`, `GLI_Driver`, `GLI_Device` and `GLI_Mode`. The exe
loads `dll\<GLI_DllFile>vr.dll`. With no ini it loads `dll\vr.dll` and stops on
"Graphics Dll not found, run install". The candidate writes the ini
(`postExtract` writeText) for `GliDX6` / `Direct3D HAL` / `1 - 640 x 480 x 16`.

## Two emulator bugs it found (fixed with the registration)

1. **EnumZBufferFormats from a guest thread returned to address 0.** The
   renderer runs on the game thread (CreateThread at 0x401870) and calls
   IDirect3D3::EnumZBufferFormats there. The thread-instance thunk table
   (`$sync_thread_thunk_globals`) never rebuilt CACA000D, so the callback's
   return address was 0. qsort (CACA002D) and LineDDA (CACA0012) had the same
   gap. `test-thread-thunk-sync.js` now checks that every thunk the PE loader
   allocates is rebuilt.
2. **CreateWindowEx overwrote the EXE's export directory.** The CREATESTRUCT
   scratch lived at `image_base+0x100`. This exe's PE header starts at 0xB0, so
   its data directories sit there, and the class-name pointer replaced the
   export RVA at 0x400128. WAVPWBVR's init then failed
   `GetProcAddress(exe, "_SND_fn_vDisplayError@8")`, asserted (error 0x1d) and
   hit DebugBreak, ending the game thread. The scratch is now a heap block per
   instance (`$wnd_scratch`).

After both, the CLI (`--app=rayman2_demo`) reaches 3D gameplay: Rayman in the
grass with the demo logo by batch ~8000. The game thread is heavy (about
80 batches/s).

## Controls (Readme.txt) and touch layout

Arrows move relative to the camera, A jumps (and skips text), Space fires,
Ctrl strafes and recentres the camera, Shift walks, keypad 0 holds look mode.
The touch layout is a pad plus Fire/Jump, Strafe/Walk, and Look/Esc.
