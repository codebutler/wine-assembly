# Penguin Command 1.6.11 retained executable closure — 2026-10-23

Historical source last updated, 2026-10-23. Runtime and implementation claims below describe that dated source; see current app notes and source for subsequent changes.

## Original identities and recovery

Authoritative preceding report remains
`/home/user/wine-assembly-penguin-command-original-oct23/docs/re-notes/penguin-command-original-20261023.md`. Its acquisition-only disposition and prior metadata redirect guard violation
remain historical facts; this explicitly authorized continuation made **no
metadata or download request**.

Read-only retained ZIP:
`/home/user/wine-assembly-penguin-command-original-oct23/docs/re-notes/penguin-command-original-20261023/archive.zip`. Size **1,410,755**; SHA-256
`4399b52a1f8fec2501737a53ab42def6d5faebde37c0de5efc1295ab495caf34`. Archive identity was rechecked before inspecting any contents. All **118 entries,
114 files and 4 directories, 2,302,319 uncompressed bytes** passed full CRC,
case-fold duplicate, relative-path, encryption, symlink and size checks. Extracted
once into this private evidence directory's ignored `original/` tree. `files.json` records all entries, byte counts, compressed sizes, CRC32s and
SHA-256s (including empty directory contents). No substituted build was acquired.

| Executable | Bytes | Original SHA-256 | Entry RVA |
| --- | ---: | --- | --- |
| `penguin-command.exe` | 107008 | `14d6e430c26c44c94ef5c176eca2f66edd82dd66fd155d29a5596e3d6e170fc1` | `0x1290` |
| `penguin-command-windowed.exe` | 32768 | `34410ed35ee997f05cbcbf14b55116799a435fee68813e3ad89bb39e6822beeb` | `0x1290` |

All eight EXE/DLL images are PE32, machine `0x14c`. `pe.json` contains actual
headers, every imported name/hint/ordinal and every nonempty export with its
ordinal/RVA/forwarder. There are **zero ordinal imports**. The windowed EXE is
a separate launcher: its embedded command is `penguin-command --windowed` and
its import table includes `CreateProcessA`. Launch the original game directly
with `--windowed` to avoid needing a child emulator.

## Dependency closure and precise unknowns

`dependency-closure.json` accounts **682 import edges**, including both EXEs,
all six bundled DLLs and the selected standing CRT's own recursive imports. Bundled providers are `SDL.dll`, `SDL_image.dll`, `SDL_mixer.dll`, `jpeg.dll`,
`libpng12-0.dll`, `zlib1.dll`. Each imported symbol from these providers has a
matching original export; libpng's nine zlib imports all resolve by name. There
are no provider export forwarders requiring another closure. Selected strings
in SDL_image contain 9 `jpeg_*` and 16 `png_*` lookup candidates: all 25 are
exported by the bundled JPEG/PNG providers. This establishes availability,
not executed lookup or ABI behavior.

Remaining imported system DLLs are emulated ADVAPI32, GDI32, KERNEL32, USER32,
WINMM. **Exactly two distinct imported names lack API-table entries:**

| Consumer | DLL / missing name | Qualification |
| --- | --- | --- |
| SDL.dll | WINMM / `waveOutGetErrorTextA` | Audio diagnostic path candidate; reachability unexecuted |
| SDL_mixer.dll | WINMM / `midiStreamStop` | MIDI path candidate; reachability unexecuted |

All other system import names are present; name presence is not an assertion of
implemented or correct semantics. The first-run quiet profile uses documented
`--nosound`; it cannot prove those two paths are avoided, and neither name is
declared an executed fatal blocker. If an actual trap reaches either name,
preserve the API/EIP trace for a coordinator-assigned implementation task.

Dynamic strings additionally name DDRAW, DINPUT, DSOUND, OPENGL32 and USER32
backends. DirectDrawCreate/DirectInputCreateA/DirectSoundCreate are runtime
backend candidates, not missing bundled redistributables. No backend was
executed. SDL_image's TIFF candidate (`libtiff-3.dll`; leading printable byte
appears in the naive string as `blibtiff-3.dll`), and SDL_mixer's Vorbis/SMPEG
candidates are not bundled. Assets contain no TIFF, OGG or MP3; their codecs
are not needed by the retained PNG/JPG/WAV/S3M profile, subject to actual loader
behavior. Do not fetch them preemptively. `selected-strings.json` is explicitly
a static candidate list, not a complete dynamic call graph.

## VFS, license, controls and real launch interface

Bundled README and README-win32 state GPL v2; COPYING contains GPL version 2,
June 1991. Win32 README says unpack-and-run; fullscreen defaults to 800×600;
`--windowed`/`-w`, `--nosound`/`-s` are supported. The current directory **must
equal the EXE directory**. Settings and scores are written to
`penguin-command.dat` beside the EXE. This file is absent from the archive and
must be creatable in writable guest VFS.

`launch-manifest.json` gives exact guest paths and hashes: EXE at
`c:\penguin-command.exe`, cwd `c:\`, seven explicitly seeded native providers
(six bundled plus CRT), **83 PNG/JPG graphics files** at unchanged
`c:\data\gfx\...` paths. This is the smallest supported quiet profile derived
from the retained asset types; execution has not established a smaller
file-by-file working set. The manifest also lists **8 optional WAV/S3M sound
assets** at `c:\data\sound\...`. For a later sound-enabled run, add
`--vfs-include='data/sound/*.wav' --vfs-include='data/sound/*.s3m'` and remove
`--nosound`. XBM/XPM cursor/icon source files, docs and the wrapper EXE are not
mounted by the quiet profile. No registry entries or initial config are asserted.

Actual harness source was read, not executed. `harness-source-identities.json`
binds full file hashes. Verified implementations:

- `test/run.js`: `--no-build`, `--wasm`, `--exe`, `--exe-guest-path`, `--args`,
  repeatable `--dll-seed`, `--vfs-include`, `--cwd`, `--control-stdin`, `--png`,
  `--save-vfs`, `--save-vfs-suffix`, `--max-seconds`, `--max-batches`, `--no-close`.
- `lib/process-boot.js` resolves explicit seeds without requiring registry
  membership; recursive discovered DLLs require `isLoadableDll`. Registry knows
  SDL and CRT but not SDL_image/mixer/JPEG/PNG/zlib. Explicit seeds supply them
  without changing registry/source. `lib/dll-loader.js` patches provider imports.
- `lib/vfs-host-files.js` expands both PNG/JPG globs relative to the EXE and
  preserves subdirectories. Loaded native DLLs are mounted by the harness;
  no second manual copy or VFS directory tree is required.

```sh
export HARNESS_ROOT=/home/user/wine-assembly
export PENGUIN_DATA=/home/user/wine-assembly-penguin-command-retained-closure-oct23/docs/re-notes/penguin-command-retained-closure-20261023/original/penguin-command-1.6.11
export PENGUIN_CRT=/home/user/wine-assembly/test/binaries/dlls/msvcrt.dll
export RUN_DIR=/path/to/admitted/empty/runtime-evidence
export QUALIFIED_WASM=/path/to/coordinator-qualified/wine-assembly.wasm
sh /home/user/wine-assembly-penguin-command-retained-closure-oct23/docs/re-notes/penguin-command-retained-closure-20261023/launch.sh
```

`launch.sh` is the full minimal command, including `--no-build`, windowed quiet
args, all providers, exact asset globs, 60-second wall limit, 200000 batches,
ordinary input control, exit capture and `.dat` export. Its shell syntax was
checked without executing it. A future admitted streaming capture guard must
surround the runtime; the static task's output and memory budget do not authorize
running this command here.

Ordinary input/capture recipe using newline JSON on that process's stdin:

1. Send `{"action":"png","path":"/ABS_RUN_DIR/title.png"}` and inspect the
   actual title/menu. Binary text includes `Normal Game` and `Arcade Game`. Click the observed `Normal Game` label with `{"cmd":"click:X:Y"}`; substitute
   observed canvas coordinates. Menu coordinates and keyboard start binding
   remain unknown; no guessed batch/coordinate is claimed to reach gameplay.
2. Mouse aims; left/middle/right cannon uses left/middle/right mouse button or
   **A/S/D**, per README. Harness supports `{"cmd":"mousemove:400:200"}`,
   `{"cmd":"keydown:65"}`, then `{"cmd":"keyup:65"}` for ordinary left-cannon
   fire. Use 83/68 for middle/right; keyboard avoids assuming unsupported
   middle/right click syntax.
3. Capture `{"action":"png","path":"/ABS_RUN_DIR/play.png"}`, aim elsewhere,
   fire again, then capture `play-after.png`. Require actual missile/explosion,
   moving enemies and score/wave evidence before any gameplay claim. Send
   `{"action":"quit"}` to end the bounded harness; `.dat` VFS export, if created,
   lands in the designated evidence directory. This host-control quit does not
   prove the game's ordinary exit/save path; test that separately if needed.

Timing, title/menu route, SDL video selection, timer/thread behavior, no-sound
reachability, native CRT initialization, screenshots and persisted scores remain
unexecuted. No changes to the renderer, Shadow Man hold, RichEdit or POSITIONT.
