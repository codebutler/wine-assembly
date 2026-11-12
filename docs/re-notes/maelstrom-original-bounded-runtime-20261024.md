# Maelstrom 3.0.6 original Win32: one bounded runtime, 2026-10-24

Historical source last updated, 2026-10-24. Runtime and implementation claims below describe that dated source; see current app notes and source for subsequent changes.

The single executed run stopped with a **harness argument error before the main batch loop**. The original executable and both original SDL DLLs loaded; CRT, SDL and SDL_net DLL initialization returned EAX=1. Menu, P-to-play, movement, fire, sound and rendering remain **unproven**. There were no screenshots or input dispatches. No emulator repair, replacement game, registry change, build, main merge or second guest run occurred.

The exact first error is retained in the complete 1513-byte raw log (historical artifact: `maelstrom-original-bounded-runtime-20261024/output.log`):

```text
Error: --vfs-mount needs HOSTPATH=GUESTPATH, got: scratch/runs/<run-id>/Ambrosia_Software
    at scratch/runs/<run-id>/run.js:5775:26
```

The canonical harness's `getArgs` splits every repeatable value on commas. The original filename `Docs/Ambrosia_Software,_Inc._FAQ.txt` therefore split a valid per-file mount into invalid arguments. The dependency preamble/codec/font probe passed, but it did not validate mount argument tokenization. That readiness gap is explicit: the failed run did not reach complete guest asset mounting. The task forbade another run after failure; the owned recipe correction below was validated without rerunning the guest.

## Exact execution and identities

Private checkout base and strict-SSH remote main both matched `f6571101e38985b3fa34d328f2ccadd9735a7573` before edits. Static closure was reused from immutable donor commit `f23fd7f51168caebb38571e303cb9630e153ef7c`; no archive reacquisition or repeated archive/PE audit occurred. The accepted archive is 906220 bytes, SHA-256 `6cc9ef78eda9a0c3591dbd6f67b8c534682ef3f30bda0acd3b0138a0a0c52db5`. All 48 original files total 2794170 bytes. The 247-file staging manifest (historical artifact: `maelstrom-original-bounded-runtime-20261024/manifest.json`) pins all transferred assets, runtime sources, codec files, fonts and system CRT: **17027463 bytes**. Remote ordinary-user preflight rehashed every file.

| Input | Bytes | SHA-256 |
|---|---:|---|
| Maelstrom.exe | 135168 | `0eca5703e512d33c5e5a0bc1a27f14bd3aa4ecddded6e09b4d4019c2f27a15e5` |
| SDL.dll | 225280 | `02433232425e68009843bd3ecec20ad67453a48487f7b5828c595b76e2f9d373` |
| SDL_net.dll | 24576 | `46ccbb7e5982e2c15421af7dd4fa29b26841d9731c31a86cf9554c90be53af95` |
| System msvcrt.dll | 278581 | `887eb5ce93edb7192ca3e9220f07f9ca0f94db02af5862ebcbdfcb852db99fd1` |
| Retained full WASM | 1879746 | `8fac39936b6df2418ad86cab118cef19a65a727f649fbc14c412b37818904686` |
| Canonical test/run.js | 685960 | `4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809` |

The pinned `pngjs` 7.0.0 package was reused from `/home/user/wine-assembly/scratch/usage-watch/shadow-man-codec-recovery-oct22/node_modules/pngjs`, with every codec file hashed in the manifest. Its package.json SHA-256 is `85b17f2f852aece03e71edb4ed4d9fddf6a0a8f0b69ac75d7f00b6592d62d37c`. There were no package installs or downloads. The full dependency preamble, raster renderer and 28 font files loaded as UID1000 on Node v24.22.1; preflight (historical artifact: `maelstrom-original-bounded-runtime-20261024/preflight.json`) records exact results.

The actual command (historical artifact: `maelstrom-original-bounded-runtime-20261024/command.json`) and argv (historical artifact: `maelstrom-original-bounded-runtime-20261024/guest-args.json`) preserve every argument. It explicitly used `--no-build --wasm`, software raster rendering, 640x480, fixed 512MiB shared arena, oldspace512MiB, `--quiet-api --quiet-blocks`, max42000 batches and max60 guest-loop seconds, with outer CPU/wall90 and output cap524288 bytes. `MAELSTROM_LIB=.` and `HOME=.` were supplied to the guest; intended executable/CWD were `C:\maelstrom\Maelstrom.exe` and `C:\maelstrom`. There were no fullscreen or networking options. Host `WINE_RUN_EXTRA_ARGS` and `WINE_REGION_MAP` were removed. The actual process also used the bounded pixel-preserving capture preload (historical artifact: `maelstrom-original-bounded-runtime-20261024/capture.cjs`); no capture was reached.

Planned batches: menu PNG30000, P down31000/up31200, play PNG34000, left35000/up36000, up-arrow35200/up36200, space35500/up36500, final PNG39000, limit42000. These were ordinary proposed inputs, not a forced state. None dispatched; the source-defined P start action does not establish gameplay. Schedule receipt (historical artifact: `maelstrom-original-bounded-runtime-20261024/schedule-validation.json`) records that every planned input/capture preceded the limit. Actual dispatch timestamps are **none**.

The process began at **2026-10-24T06:56:31 UTC**, PID/PGID in command.json. It naturally exited1 after **0.121124 seconds**, output1513 bytes, no output/time guard hit and no OOM. The terminal receipt (historical artifact: `maelstrom-original-bounded-runtime-20261024/terminal.json`) records no remaining process group. Observed relocated bases: CRT `0x522000`, SDL `0x666000`, SDL_net `0x7a2000`; both SDL DLLs originally preferred `0x10000000`. All three DllMain calls returned1. No system API/backend failure was observed or inferred from mere diagnostics.

## Validated recovery recipe; no rerun

Stage the **same 48 digest-pinned originals** under `<taskroot>/vfs/maelstrom/` in a fresh authorized task; keep `Images`, `Docs`, `Maelstrom_Fonts`, `Maelstrom_Sounds`, `Maelstrom_Sprites` and every original filename unchanged. Replace all per-file `--vfs-mount` arguments with the supported single `--vfs-tree=<taskroot>/vfs`. Update the EXE and both SDL host paths to `vfs/maelstrom/`; retain guest path/CWD, original environment, explicit no-build/module path and all resource guards. The tree must contain only the game subtree. The system CRT remains a separately pinned DLL input.

Run the retained local validation (historical artifact: `maelstrom-original-bounded-runtime-20261024/validate-recovery.cjs`) with `timeout 60 node --max-old-space-size=256 validate-recovery.cjs` from the retained task directory. It reads the exact canonical production `lib/vfs-host-files.js`, enumerates the actual original48 files, checks filename equality and `guestPathInTree` mapping to `C:\maelstrom`, and rejects the broken comma mount, wrong guest root and missing file. Tests passed (historical artifact: `maelstrom-original-bounded-runtime-20261024/recovery-tests.json`). It creates argv/mapping receipts only and never starts the game. The stage helper (historical artifact: `maelstrom-original-bounded-runtime-20261024/stage.py`) and transfer/identity helper (historical artifact: `maelstrom-original-bounded-runtime-20261024/work.py`) retain the actual transfer recipe; adjust only task-owned root/manifest targets for a separately authorized continuation.

Capture preflight encoded actual 640x480 raster pixels and verified lossless PNG roundtrips. It rejected invalid PNG bytes and excessive dimensions. At most3 frames, each<=131072 bytes and cumulative<=393216, were permitted. No screenshot exists; no menu/game/shot pixels were inspected or claimed. The watchdog rejecting control (historical artifact: `maelstrom-original-bounded-runtime-20261024/watchdog-negative-control.json`) proved TERM, then KILL after5s, and process-group reaping on a TERM-resistant child. The actual guest exited naturally before signals were needed.
