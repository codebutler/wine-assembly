# Heretic II Demo (Raven Software / Activision, 1998)

App `heretic2_demo` (candidate `heretic-2-demo`, localOnly). A Quake II-engine
third-person action game: `Heretic2.exe` is a 28 KB stub that imports
`Quake2Main` from `quake2.dll`; `H2Common.dll` is shared by everything; the
renderer (`ref_gl.dll` / `ref_soft.dll`), `SndDll.dll` and, under `Base\`,
`gamex86.dll`, `Player.dll` and `Client Effects.dll` are `LoadLibrary`'d at
runtime. Registered 274f69e21.

## Licence

`license.txt` in `_user1.cab` is Activision's standard licence: personal use
of one copy, no copying or distribution without written consent. Hence
localOnly, never deployed. (`rules.txt` beside it is a 1998 contest, not a
licence.)

## Install

archive.org `h2_demo_us`, `h2_demo_us.exe` (40079639 bytes, SHA-1
`d6593f2a…`): an InstallShield self-extractor that `7z x` unpacks into
`data1.cab`..`data4.cab`, `setup.ins` etc. One file group, "Program
Executable Files", 1825 files, 64 MB.

**unshield cannot read these cabs.** The common header is version
`0x01000004` ("major version 0", treated as 5). Every file descriptor has
flags 6 (compressed | obfuscated) but the data is not obfuscated, so
unshield's de-obfuscation corrupts it ("Decompression failed with code -3");
`-O` segfaults (1.5.1 and upstream master 0d1e7cb alike). The data is plain
IS5: `[u16 length][raw deflate]` chunks. Descriptors are packed 0x2a apart,
with no MD5. `tools/is5-extract.js` handles it, including files split across
volumes; the fetcher step is `is5Extract`.

## Running

- `--app=heretic2_demo` mounts the tree; the two static-import DLLs are in
  `dlls`. Ad hoc: `--exe=.../Heretic2.exe --dlls=quake2.dll,H2Common.dll
  --vfs-include='**/*'`.
- **Time bomb** (quake2.dll `0x1002df50`, called as a game starts):
  `time()` must lie between `0x35649ff8` (1998-05-21) and `0x363c8deb`
  (1998-11-01), otherwise MessageBox "Unauthorized access not permitted!"
  and exit. The app entry pins `wallClock: '1998-09-01T12:00:00Z'`; ad hoc,
  `--wall-clock-ms=904651200000`.
- **Renderer.** `Base\default.cfg` sets `vid_ref soft` (works, DirectDraw)
  and `gl_driver 3DfxGL_Ht2` (a 3Dfx MiniGL in `drivers\`; `D3DGL` and
  `Veritegl` are the other two). The entry's args pick `vid_ref gl` with
  `gl_driver opengl32`. On the CLI GL needs `--headless-gl` or
  `--gl-renderer=software`; without a backend `wglMakeCurrent` fails and the
  game falls back to ref_soft.
- **GL window position.** Quake II `MoveWindow()`s its window to
  `vid_xpos`/`vid_ypos`, defaults 3/22, even the fullscreen `WS_POPUP`, so
  the GL frame sat 22 px down the screen. The args set both to 0.
- `LoadLibraryA("opengl32")` answers `0x00400000`: our emulated GL module's
  handle aliases the exe's. Harmless here (GetProcAddress finds the wgl
  entry points) but worth knowing if a module-handle comparison ever bites.
- `SndDll.dll` imports ole32.dll (not present; its imports fall to stubs).
  A3D initialises and is torn down; DirectSound is used.

## Route (headless, `--batch-size=50000`)

Main menu by b200. Enter at 300/400/500/600 (Game → new game → difficulty)
starts the first area by about b700. Up from b1000 walks Corvus to the
lectern (tutorial text), Right turns him toward the hall with the
stained-glass doors. Evidence:
`scratch/runs/20261011T0645Z-heretic2_demo-gameplay-claude1863`.

Not yet looked at: the browser, combat, level transitions, the A3D/sound
path, performance.
