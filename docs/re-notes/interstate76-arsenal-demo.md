# Interstate '76 Arsenal (demo)

Activision, 1998, car combat. The demo is "3D accelerated only" (readme): its
two missions exist only for the hardware path. **Registered as
`i76_arsenal_demo` (candidate `i76-arsenal-demo`, local only), playable in
the browser** after the DirectDraw GetCaps fix (2da06701f, see below).

## Source and layout

- archive.org `Arsenal_201610`, `Arsenal.zip` (36,540,069 bytes, sha1
  c014b6e81ba1794211cf6b762045d412979345be). No licence or redistribution
  grant, so local-only.
- CD-style tree like Battlezone (same Activision engine family, see
  battlezone-demo.md): `Arsenal.exe` autorun, `Arsenal Files\Splash\` (the
  installer front end, `Strings.txt` holds its settings), an InstallShield
  `Install\` folder, and `Install\Data\`, which already is the game:
  `Nitro.exe`, `NITRO.ZFS` (19.6 MB) + `NITRO.ZIX` index, `Addon\`,
  `Miss16\` (`p09.MSN`, `t03.MSN`), `Miss8\` (only `dummy.txt`), `Smk\`
  movies, renderer `ZDX5DRAW.DLL`, and its own `smackw32`, `Strlkup`,
  `anet2`, `Nitshell` DLLs. No installer run needed; run `Nitro.exe` from
  `Install\Data`.
- `Nitro.exe` imports `Strlkup.dll`/`anet2.dll`/`smackw32.dll` and
  LoadLibrary's `NITSHELL.DLL`; declare them (`--dlls=` on the CLI) or
  `StrLookupCreate` hits `crash_unimplemented` at batch 0.

## Command line (parser 0x498d90)

- A bare token is the mission: only `t03` (I'76 Gold) or `p09` (Nitro Pack)
  are accepted (strings at 0x512c08/0x512c0c). Anything else, including no
  argument, gives "Sorry, this version of I'76 Nitro Pack will only work with
  the demo missions." -- the Splash front end passes the mission.
- `-`/`/` switches pick the renderer: `-d3d` -> `ZDX5DRAW.DLL`, `-glide` ->
  `ZGLIDE.DLL`, `-redline`, `-powervr`, `-gdi`. Each sets the renderer name
  (0x66a040) and the 3D flag `[0x53c4f0]`. Without one the game runs its
  8-bit software path: `SetDisplayMode(640,480,8)`, the intro and credits
  Smacker movies play (frames in the evidence), then mission load looks in
  `Miss8\` (empty), the "mission running" flag `[0x554d1c]` stays 0 and the
  main loop calls a NULL error hook `[0x5056b0]` (eip-zero, ~b1284). Esc during
  the movie also ends the process.

## Fixed: `-d3d t03` exited with code 5 (our GetCaps)

**Cause (fixed 2da06701f):** the caps-logging function 0x486910 calls
`IDirectDraw::GetCaps` with two stack DDCAPS whose dwSize it never sets. On
Windows that is DDERR_INVALIDPARAMS and nothing is written (the log then
prints stack garbage, which is why the "SELECTED D3D HW DESC" section reads
"None" -- a red herring). We treated an invalid dwSize as 380 and wrote 380
bytes, over the return address; the function "returned" into the CRT exit and
WinMain looked like it returned 5. Found by a block-entry trace of the last
batch (`--trace-eip-range=0x401000-0x4d0000 --trace-eip-from=1`): the caps
log's `ret` went straight to 0x4c323f. `test-directdraw-getcaps-size.js`.

The notes below were the investigation before that:

- zdx5draw initializes cleanly through our D3D: DirectDrawEnumerate,
  IDirect3D(v1) EnumDevices probe, SetDisplayMode 640x480x16, flip chain,
  IDirect3D2 EnumDevices, CreateDevice (HAL), EnumTextureFormats, viewport,
  render states. Its EnumDevices callback (`ZDX5DRAW+0x2990`) keeps devices
  whose HW desc has dwFlags != 0 (so only our HAL) and copies 0x33 dwords
  (the DX3 0xCC-byte D3DDEVICEDESC) into its own device table (stride 0x140,
  desc at +0xf0).
- Then `Nitro.exe` writes `VIDEOLOG.TXT` (0x486910; text recovered from the
  stack in `d3d-exit5-videolog-run.log`): "SELECTED D3D HW DESC CAPS" are all
  "None", and the DirectDraw driver name/desc fields are garbage. Right after,
  the code at 0x487c47 copies `dpcTriCaps` from the exe's renderer state
  (`0x622e60`, desc at +0x690; `dpcTriCaps` at `0x623558`) and requires
  `dwTextureCaps` bit 0 (PERSPECTIVE); the whole block is zero at exit, so
  WinMain returns 5.
- So the exe's copy of the selected device desc is never filled, although
  our enumeration supplies full caps (`$fill_d3d_device_desc`/`$fill_primcaps`).
  Next: find which zdx5draw export fills the exe's state (`GetFuncDesc`
  0x10001000, `CheckFunc` 0x10001060, `FirstDevice` 0x10001290 -- it bails on
  `[esi+0x20] == 0` --, `GetNumDevice` 0x10001390) and why it copies nothing;
  compare with Battlezone's `plugin\dx5draw.dll`, which reaches gameplay
  under the same emulator. Also check the garbage DirectDraw driver name in
  the log against our `DirectDrawEnumerateA` callback strings.

## Route (browser) and controls

- No input needed: logo ~58 s, intro flyover ~69 s, cockpit ~80 s (Chromium).
  The car starts facing a canyon wall: steer before throttling.
- Up throttle (the view drops to the dashboard while accelerating), Space
  fires, S starts the engine. Evidence:
  `scratch/runs/20261011T2240Z-i76_arsenal_demo-browser-gameplay-w5`.

## Registration notes

- `exe` `Install/Data/Nitro.exe`, `args: '-d3d t03'` (or `p09`), the four
  DLLs in `dlls`, working directory = the data dir.
- Controls are in `Install\Data\KEYBOARD.MAP` / `INPUT.MAP`; use the driving
  touch template (`drivingTouchControls`) with the fire key from the map.
