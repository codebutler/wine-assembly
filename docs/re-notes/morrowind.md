# Morrowind (GOTY retail ISO) — local-only candidate

Not in `lib/apps.js`. The ISO (`downloads/Morrowind.iso`), the installed tree
(`test/binaries/candidates/morrowind/installed/`) and the registry snapshot
(`test/binaries/candidates/morrowind/registry.json`) are all gitignored and stay
on this machine.

## Reproduce

```bash
I=test/binaries/candidates/morrowind/installed
node test/run.js --exe="$I/Morrowind.exe" --dll-seed=binkw32.dll --vfs-include='**' \
  --iso=downloads/Morrowind.iso --reg-import=test/binaries/candidates/morrowind/registry.json \
  --memory-mb=1024 --headless-gl --quiet-api --stuck-after=100000 --no-close \
  --max-batches=9000000 --max-seconds=570 --input=...
```

- `--iso` because the game checks for its CD and reads `d:\video\*.bik` from it.
- `--memory-mb=1024`: at 512 MB the sparse arena runs out while DirectShow
  builds the title-music graph (`[heap] OOM ... sparse arena`), and the game
  shows `Music Error: Can not play file ... morrowind title.mp3` then exits.
- `--headless-gl`: Morrowind renders through D3D8 on the GL backend.
- `--wasm-enforce-bounds-checks` (a node flag) only when chasing a SIGBUS: the
  headless-gl native module installs a segfault handler that turns a wasm
  out-of-bounds access into SIGBUS with no stack. The flag makes it a JS trap
  with a wasm stack. It costs roughly 3x.

## Reaching gameplay (2026-09-19)

Reached: the prison-ship hold with Jiub, textured, lit and animating. About
2k batches after `chargenname1.mp3` the game shows its "Name" text-entry
prompt (label, caret, OK) over the world, then waits for input. That is the
end of what the driver automates. Before the mip-chain fix the prompt drew as
an empty frame on a fog clear: the UI font textures hit the same rejected
draws. What gets there, in one run of about
3.5 minutes of wall clock:

- The driver: `node test/binaries/candidates/morrowind/drive-morrowind.js OUTDIR 2 1500`.
  It is gitignored like everything else here. Its screenshots are
  `OUTDIR/world-N.png`.
- `--tick-ms-per-batch=2` for the **whole** run, plus `--control-stdin`. The
  driver watches which files the game reads and reacts:

  | file the game reads | driver's mode | what the driver does |
  |---|---|---|
  | a `.bik` in boot | video | ESC pulse every 3 s |
  | `mw_logo.bik` | menu | alternate ESC and a DI click, which lands on New |
  | `splash\*.tga` after the menu | world load | nothing, just wait |
  | `mw_intro.bik` | intro | ESC pulse every 3 s |
  | `music\explore\*` | world | take the screenshots |

  **Do not treat `.bsa` reads after the menu as a world load.** The menu
  itself reads `morrowind.bsa`, and treating that as "loading" made the
  driver stop clicking.
- Timeline at tick 2 (~5000 batches/s):

  | batch | event |
  |---|---|
  | 13.6k | Bethesda logo, skipped at once |
  | 515k | `mw_logo` / menu |
  | 539k | New |
  | 568k | `mw_intro`, skipped |
  | 570k | in world |

- The WebGL D3D9 backend used to reject most world draws, so the world
  showed as a bare fog clear with a crosshair. Two fixes (both in
  `test/test-d3d9-webgl-partial-mips.js`):
  - **Partial mip chains.** Morrowind's DDS textures stop above 1x1, and
    `lib/d3d9-backend.js` threw `incomplete mip chain`. It now clamps with
    `TEXTURE_MAX_LEVEL` on WebGL2, and box-filters the missing levels on
    WebGL1 (headless GL).
  - **Lit draws with no NORMAL.** `lib/d3d9-fixed.js` threw `missing vertex
    semantic 3:0`. The normal now reads as zero, as it does on D3D9.

## Boot sequence (default 200 ms/batch, 1000-block batches)

| batch | what |
|---|---|
| ~7k | `bethesda logo.bik` (Bink, has audio) |
| 150k-250k | loading bar over `splash_*.tga` (splash picture itself draws light blue — not investigated) |
| ~560k | `mw_logo.bik`, then title music via DirectShow |
| ~600k | main menu: New / Load / Options / Credits / Exit |
| click | `di-mousedown:1`/`di-mouseup:1` with no move lands on **New** (the DI cursor starts at screen centre, 320,240) |
| +70k | world load (splash TGAs, `morrowind.bsa`/`.esm` reads), then `mw_intro.bik` |

## The Bink clock problem (the main blocker)

Bink paces video against wall time (`timeGetTime`/`QueryPerformanceCounter`
and the DirectSound play cursor). At the default 200 ms/batch, decoding one
frame costs more guest time than the frame lasts, so Bink is permanently
behind: it decodes and skips forever and never presents, with **zero** API
calls from the main thread (main loops inside binkw32 `+0xd100..0xd1db`, the
bitstream decoder). The picture is byte-identical for 300k+ batches. This hit
the Bethesda logo in some runs and `mw_intro.bik` in every run.

ESC only skips a video when it lands while the decoder is between frames, so
ESC schedules are luck, not a fix. What works is a slower guest clock:
`--tick-ms-per-batch=2` plays the logos visibly. `--input=B:tick-ms:N` switches
the cadence mid-run so the boot can stay on the fast clock (added for this app).

Large batches (`--batch-size=10000 --tick-ms-per-batch=20`) give the same
ops-per-guest-ms with fewer batches, but PNG captures of the D3D8 frame came
back as the empty GDI window intermittently at that batch size — use the
default batch size when a picture matters.

## Music restarts every ~1000 batches — not a bug

After the intro, exploration music (`music\explore\mx_explore_N.mp3`) opens a
new DirectShow graph about every 1000 batches. A 3-minute track at
200 ms/batch is ~900 batches, so the tracks really are ending. It does mean
many graph builds per run, which is part of why 512 MB runs out.

## Emulator fixes this app needed (2026-09-18)

- `CoCreateFreeThreadedMarshaler` + FTM inner/IMarshal objects (quartz).
- `ReplyMessage` (one pending reply per cross-thread send depth).
- COM in-proc DLL loads requested from a **cooperative worker thread** (yield 3)
  were never serviced — T3 parked forever. `run.js`/`host.js` now service them
  and sync main's DLL/thunk globals into the worker first (`adoptMainGlobals`).
- `$load_dll` rebases an image that would overflow the low guest spans into a
  sparse reservation. Before, `l3codecx.ax` was placed at `0x45e6000` and its
  image overwrote emulator tables (PAGE_INDEX_ARENA), which surfaced as
  `0xCAC4BAD0` dispatch garbage. quartz/devenum/l3codecx now load near
  `0x7e8x_xxxx`.
- Import-name logging in `$win32_dispatch` used `GUEST_BASE + rva` instead of
  `g2w(image_base + rva)` — out of bounds for a rebased DLL.
- `$static_sys_dll_name_at` stops at the list terminator; a rebased DLL's
  handle is above the pseudo-handle base and used to walk off the list
  (`GetModuleFileNameA`).

## Threads

binkw32 starts two worker threads that sit in `WaitForSingleObject` at
binkw32 `+0xd3c3` (runtime `0x8e13c3` when binkw32 loads at `0x8d4000`,
origBase `0x30000000`). quartz threads appear and exit per graph; one reports
`EIP=0 (likely call/jmp to NULL)` when its thread proc returns — harmless.
