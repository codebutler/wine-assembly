# Serious Sam: The First Encounter — demo (`serious_sam_demo`)

Croteam, 2001, OpenGL. Registered as `serious_sam_demo` (4cbde5326); candidate
`serious-sam-demo` in `test/candidate-corpus/manifest.json` (archive.org
`SeriousSamDemo.exe`, Disk1 mounted at `C:\`). Reaches player-controlled
gameplay on main with the winmm timer thread on.

An untracked, migration-era `docs/re-notes/serious-sam.md` in the main checkout
recorded private-build experiments (some superseded, some wrong). This file is
the current state; the claims it corrects are listed under "Ruled out / stale".

## Running it

Boat only: the ops box's memory reaper killed local runs, and OpenGL needs
`--headless-gl` (`@node-3d/webgl` + `@node-3d/glfw`, Xorg `:0`).

```sh
DISPLAY=:0 node test/run.js --app=serious_sam_demo --no-build --quiet-api --quiet-blocks \
  --no-close --stuck-after=0 --batch-size=10000 --tick-ms-per-batch=1 --headless-gl \
  --max-batches=73000 --input=...
```

Route (1 ms of guest time per batch; ~60 batches/s while rendering, ~1800 while
loading):

| batch | input | effect |
|---|---|---|
| ~2000 | — | first-run "Information" MessageBox |
| 4000 | Enter (keydown 13) | dismisses it |
| ~20000 | — | intro (Godgames logo, `Levels\Intro.wld`) |
| 21000 / 23000 / 25000 / 27000 | Enter | skip intro, SINGLE PLAYER, NEW GAME, NORMAL |
| ~60000 | — | NETRICSA briefing "Thebes - Karnak" |
| 62000 | mousedown/up at (585,19) | NETRICSA **Exit** button — Escape keydown does *not* close it (keyboard focus is window 0x10008) |
| 64000 | — | Karnak temple room, revolver, health 100 |
| hold W | — | walks through the door into the courtyard; an enemy runs in |

No console setting is needed (see hooks below). Evidence:
`scratch/runs/20261011T0545Z-serious-sam-noconsole-w6` (default input),
`scratch/runs/20261011T0400Z-serious-sam-levelload-w6` (first gameplay).

## Module bases (seeded order Engine, Game, Entities)

| module | runtime base | original base |
|---|---|---|
| Engine.dll | 0x574000 | 0x600c0000 |
| Game.dll | 0x811000 | 0x604a0000 |
| Entities.dll | 0x93f000 | 0x60280000 |
| msvcrt.dll | 0xbee000 | 0x78000000 |

Engine runtime = original − 0x600c0000 + 0x574000. Engine exports its C++
methods by mangled name (`tools/pe-exports.js`), which names most addresses
below.

## Identified functions (Engine originals unless noted)

- `CTStream::ExceptionFilter` 0x600d92d0: filter for EXCEPTION_ACCESS_VIOLATION;
  reads ExceptionInformation[1] (address) and [0] (read=0 → `bReadAccess`),
  finds the stream through FS:[0x2c][Engine `_tls_index`] → block+0xc stream
  list, calls the stream's commit-page virtual. Streams are a two-page window
  over a reservation: on a fault at page p it decommits what it holds and
  commits p and p+1, loading them (inflating, for GRO members) inside the filter.
- Entity load loop 0x6015f794 (`call [edx+0xc]`, progress = i/count →
  "LOADING ENTITIES n%").
- `CRationalEntity::Read_t` 0x6019d8e0 (state-stack count; appends one entry
  per iteration — a corrupt count stalls here), `CMovableEntity::Read_t`
  0x601c8120, `CMovableBrushEntity::Read_t` 0x601c6150.
- zlib `inflate_fast` around 0x601bcff0 (match copy loop 0x601bd087).
- Graphics probe: SearchPathA `OPENGL32.DLL` then `3DFXVGL.DLL`, then
  LoadLibrary; 0x601085a6 uploads a 1x1 GL_RGBA8 texture and enables 32-bit
  textures only if `glGetTexLevelParameteriv(GL_TEXTURE_GREEN_SIZE)` is 8.
- Input hooks installed at 0x600cc1c3: `SetWindowsHookExA(3, 0x600cafb0, 0,
  tid)` and `(4, 0x600cb000, 0, tid)`, handles at 0x6022aed4/0x6022aed8; both
  procs pass the message to the key processor 0x600cae70 and CallNextHookEx.
- Entities.dll static initializer table at 0x603cd2ac (initializers such as
  0x602b8c50).

## Fix chain (all on main)

027c12a54 DLL static TLS · c7c234629 fault mode 5 `reservedPageFaults` ·
ce3aeaad5, 32b9526ec nested fault run keeps `$ip`/page registers ·
bc110628c OPENGL32.DLL system-file stub · 8ed49c3dc glGetTexLevelParameteriv ·
5529ce4aa, 13da5a055 MEM_DECOMMIT unmaps (size-0 bound) · d10ba697's
26aba0e61, d81e4b7e8, 212959d8d decoded-code spill + SEH-walk `$ip` ·
f6c58213a page-crossing accessors re-translate after a fault filter (the
straddling dword that corrupted the state-stack count) · 4cbde5326 registry
entry + browser `reservedPageFaults`.

## Ruled out / stale

- "Hooks 3/4 are unsupported, so movement needs `/inp_iKeyboardReadingMethod=0;`"
  — stale. WH_GETMESSAGE (3) runs for GetMessage and PeekMessage(PM_REMOVE) and
  carries every posted key message; movement works with the default reading
  method (2). WH_CALLWNDPROC (4) is still unimplemented (SetWindowsHookExA
  returns 0); it only sees sent messages and is not needed for movement.
- "The timer callback injected on the main thread corrupts entity loading" —
  wrong: the corrupt count reproduced with the timer thread; the cause was the
  page-crossing accessor (f6c58213a).
- ExceptionInformation[0] write classification: not needed so far.
- Browser route: registered and `reservedPageFaults` is wired into host.js, but
  not yet exercised in a browser.
