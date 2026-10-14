# Worms Armageddon demo

Original Team17/MicroProse Windows demo v1.0, February 1999. This is a
different game from the qualified Worms 2 demo. It is not registered or public.

## Original fixture

Source index: <https://bbsfiles.retropc.se/filegate/gamesnet/demo/index.html>.
Original archive: <https://bbsfiles.retropc.se/filegate/gamesnet/demo/wademo.zip>.
Downloaded archive: 13,922,708 bytes, SHA256
`e7b83c05b152a6f47187ef4367cbade4874827c791e17fac05a18ab48090a5df`.

The ZIP contains a WinZip self-extractor, `WaDemo.exe` (13,931,008 bytes),
SHA256 `f42800ec0831e43458e854de8befd075364dd2b442459ae221e68f4116a2d64e`.
Extract its complete installer with 7z, then use `tools/is5-extract.js` on
`data1.cab`. This produces 667 files totaling 20,639,487 bytes. The actual game
`WaDemo.exe` is 2,020,352 bytes, SHA256
`7d6c456c0bd0f4bb197f0305e63e58aeb4868d325cc0110c74bb9d6e968c9bfd`.
Keep the complete tree at `test/binaries/candidates/worms-armageddon-demo/game`.
The source and payload remain ignored compatibility fixtures. The README says
all rights reserved; no redistribution permission has been established.

## Launch and documented controls

A bare EXE route needs explicit seeds for the game's bundled DLLs. Without
DXMfc.dll the first constructor becomes an unresolved API; that is a missing
launch dependency, not a request to implement the game's C++ method in WAT.

```sh
node test/run.js \
  --exe=test/binaries/candidates/worms-armageddon-demo/game/WaDemo.exe \
  --vfs-include='**/*' \
  --dll-seed=test/binaries/candidates/worms-armageddon-demo/game/DXMfc.dll \
  --dll-seed=test/binaries/candidates/worms-armageddon-demo/game/DirectSound.dll \
  --dll-seed=test/binaries/candidates/worms-armageddon-demo/game/DirectX2D.dll \
  --quiet-api --control=8139 --frozen --max-seconds=180 \
  --batch-size=10000 --tick-ms-per-batch=5
```

The original Manual.rtf gives the ordinary route: Single Player, then Play
Quick Game Against Computer. Left/Right move, Return jumps, Backspace jumps
upward, Home centers the active worm, and Space attacks. The README documents
three missions, two training modes, and no streamed audio ambience in this demo.
Menu positions and the gameplay route are not yet measured.

## First bounded launch, 2026-10-13

Full build passed on main `c0c53c2f3a28d8f63481fe64dd6c861fb6f80256`;
Wasm SHA256 `c9971c0abb023c64c8c018505e39734eeb1be52076a23d4846d54385b50b5c07`.
Remote worktree `/home/user/wa-work` on `bx_yqnspudj`; software CLI with
cooperative guest threads. Evidence:
`scratch/runs/20261013T1937Z-worms-armageddon-launch`.

After correcting missing pngjs host dependencies and supplying original DLL
seeds, the game rendered Team17, MicroProse and the upper Worms title. Captures
were reviewed. Escape was sent on the two publisher logos, at batches 477 and
714; no menu selection was attempted without a visible menu. Final capture was
batch 1025, guest time 5125 ms. The control quit completed after 1028 batches,
191.003 seconds and 5,101,010 API calls. The coordinator confirmed the process
absent at 19:41:40 UTC. No compatibility trap occurred on this corrected route.

This is incomplete startup coverage, not a proven compatibility failure.
No menu, gameplay, movement, audio or FPS qualification. Next allocated run:
increase the batch budget before interpreting timed startup behavior, use a
coherent guest-clock setting, inspect each next screen, and follow the original
single-player quick-game route. Keep the existing captures as the baseline.

## Default synthetic-clock follow-up and next input

Run `scratch/runs/20261013T1948Z-worms-armageddon-normal-clock` actually started
at 19:46:02 UTC (the folder name is only an identifier). Same Wasm and fixtures,
100,000 blocks/batch, the default synthetic CLI 200 ms tick (not real wall-clock timing), and `--quiet-blocks`.
Team17 was reviewed at batch 30, then Escape; MicroProse at 45, then Escape.
Batch 65 again showed the upper Worms title. The external 180-second supervisor
sent SIGTERM, handled as orderly shutdown: exit 0 at 19:49:03, 69 batches,
13.8 guest seconds, 177.690 reported run seconds, 3,327,116 API calls. Process
absence was checked at 19:49:11. No trap or gameplay qualification.

The captured children identify this as the **intro title**, not the main menu.
The original `graphics/Intro/title.bmp` is 336x128; its title variants are
336x117 and 336x114. `Intro/a1.bmp` is 48x44 and the other letter images are
32/48x44, matching the letter children at y=135. The main-menu `1up.bmp` and
`multi.bmp` images are 240x150 and were not shown in the captured route.
Initial negative child sizes in CreateWindow logs do not prove a layout bug:
later snapshots show corrected 48/32x44 letter rectangles.

Neither attempt sent input on the actual Worms title: their two Escapes were
on publisher logos. The next concrete ordinary route is to reach this title,
inspect it, then send a **third Escape** and capture the response. If unchanged,
try ordinary Space or a title click with separate captures. Do not repeat only
the same logo waits or infer an emulator defect from the run deadline. Once
the real menu appears, follow Single Player -> Quick Game and reduce the guest
clock for turn-based input capture. There is still no menu/control/FPS claim.

## Main menu reached, 2026-10-13 20:04 UTC

Run `scratch/runs/20261013T2000Z-worms-armageddon-title-input` used the same
100,000-block/200 ms original-DLL route and unchanged Wasm. Explicit ordinary
Escape key-down/key-up at batches 42 and 65 skipped the publisher logos.
The initial scheduled `keypress:27` at 30/45 was a WM_CHAR, not an Escape
key-down/up pair; it must not be used as an equivalent replay.

At batch 85 the reviewed Worms title received Escape. The title faded and the
intro child windows disappeared, leaving WAGame/T17 and no keyboard focus.
After an ordinary click at (320,240) at batch 105 and three steps, the actual
main menu rendered: four colorful panels and Quit. The guest log creates the
MainMenu dialog and labels Single player games, Create a game, Network game,
Options and Quit. This is reviewed menu evidence, not gameplay.

Space at batch 108 and three more steps produced a darkened main-menu image;
the subsequent screen was not assessed. Ordinary control quit at batch 111
exited 0 at 20:04:38; the owned process was absent at 20:04:46. The run reported
278.627 seconds and 5,205,286 API calls. No performance claim is made for the
synthetic clock. Nineteen local artifacts preserve launch, complete input log,
screenshots and exit receipt.

Next allocated route: reproduce the publisher/title Escape events and the
center click; inspect the main menu; click the top-left Single Player panel
around (175,105), step briefly and inspect the next screen before selecting
Play Quick Game Against Computer. Do not send the last Space from this run
before that click. Reduce the clock while frozen for the actual turn-based
movement/jump capture. No guest patches, fake API success or emulator source
changes were needed to reach the menu.

## Original terrain child and rendered match, 2026-10-13

Run `scratch/runs/20261013T2042Z-worms-armageddon-real-child` used source
`924a7b666` and unchanged canonical Wasm `c9971c0abb023c64c8c018505e39734eeb1be52076a23d4846d54385b50b5c07`.
The missing requirement was the existing CLI `--spawn-processes` option.
The guest calls CreateProcessA at 0x42fdc0, closes the returned thread handle,
and waits on the process in 20 ms intervals at 0x42fe01 while pumping messages.
The earlier host `ShellExecute` log label was not evidence of a guest
ShellExecuteA import; this is the CreateProcess fallback route.

With real child spawning enabled, original Landgen.exe ran as guest pid 4004:
`landgen.exe /mission data\land.dat data\mission\polar.img data\custom\snow data\water\blue 72100332 0`.
It wrote 1,670,841 bytes to land.dat. The host merged two written files,
one deletion and 73 registry/INI keys before reporting child completion.
The parent then read the generated file and reached a rendered snow/ice match.
No generated terrain was fabricated, no guest was patched and no emulator
implementation change was needed. Earlier runs without this flag opened a
missing land.dat, returned null from fopen, and reached the indirect-call failure.

Root reviewed control-right-412.png and control-right-433.png, and independently
verified all 36 transferred artifact hashes. These prove rendered match state,
not player control: a thought bubble and later autonomous rocket firing indicate
that the active worm may belong to the AI. A rejected initial ctl keydown verb
also makes the earlier input label unsuitable as evidence. Successful queued
Right input is recorded separately, but movement alone does not isolate its effect.
The next check must identify a human turn and compare idle versus ordinary held
input. Do not count the current run as qualified player-controlled gameplay.

Supervisor 79553 exited 0 at 20:47:10 UTC and its process tree was absent.
The CLI clock remained synthetic 200 ms/batch; this is not an FPS measurement.
The effective child/parent time guards were 420 seconds (first matching argument
wins), with a 450-second external guard. Audio, real-device behavior and sustained
play remain unqualified. The title is not yet registered in the candidate manifest,
so this evidence remains an investigation rather than an unrelated candidate result.

Child termination caveat: output.log records `[Exit] code=0`, followed by a
NULL-EIP diagnostic at child batch486 (previous EIP0x0040c60e). The generated
file was exported and merged, and the parent read it and rendered the match,
but this is not evidence of entirely clean interpreter shutdown. Preserve this
separate diagnostic for follow-up; no generated output bytes were retained
outside the child export/read log.

## 2026-10-13: ordinary human input qualification

The original demo now reaches an actual Player One turn through its real
`Landgen.exe` child and responds visibly to ordinary Up input. This is a narrow
human aiming qualification, not a completed match or browser/audio/performance
qualification. The candidate is not registered in the application corpus yet.

### Original fixture and route

Original `WaDemo.exe` SHA-256:
`7d6c456c0bd0f4bb197f0305e63e58aeb4868d325cc0110c74bb9d6e968c9bfd`.
Remote fixture: `test/binaries/candidates/worms-armageddon-demo/game/`.
Use the original `DXMfc.dll`, `DirectSound.dll`, `DirectX2D.dll`, MFC42/MSVCRT,
data files, and `--spawn-processes`; do not bypass or fabricate the Landgen result.

The bounded CLI route used `--batch-size=100000`, `--tick-ms-per-batch=200`,
`--frozen`, `--control-stdin`, and `--max-seconds=540`, with a 570-second
supervisor bound. Escape dismissed the original splash screens; normal clicks
entered Single Player and Quick Game. After the real child state merged, the
route advanced to batch 771 and paused for visual review. The image showed
Player One, Worm 1 with its red arrow, and a positive timer of 58.

The review gate allowed one ordinary `keydown:38`, 20 batches, `keyup:38`,
and one final batch. No game-memory writes, artificial focus calls, hardcoded
message HWND, or DirectInput-only map writes were used. The exact driver and
command arguments are saved with each run.

### Failure and generic source cause

Control run `scratch/runs/20261013-wa-input-observation-2/` used source
`924a7b666cfd9c7e7a2d55db598ed55c40f1bae6` and module SHA-256
`c9971c0abb023c64c8c018505e39734eeb1be52076a23d4846d54385b50b5c07`.
Its ordinary Up did not change the visible aim. The foreground game HWND was
`0x10029`, but guest focus remained on frontend native BUTTON `0x10020`.
`output.log:7192` and `:7206` show the actual Up down/up messages dispatched to
that frontend HWND. Host physical/async Up was true while held, but the game's
Up byte remained zero. Initialization and activation were both one, and the
game's input-suppression field was zero.

The ordering is explicit in the original trace:

- `output.log:886-887`: frontend dialog `0x1001f` and BUTTON `0x10020` created.
- `:1902`: original game calls `SetActiveWindow(0x10029)`.
- `:1925` and `:1931`: delayed `WM_KILLFOCUS` / `WM_SETFOCUS` reach the old
  frontend control after game activation.

`dlg_focus_first_tabstop` in `src/09a5-handlers-window.wat` assigned focus and
posted its notification pair. The native button's `WM_SETFOCUS` handler later
assigned focus again when that queued notification arrived. Ordinary keyboard
routing in `lib/host-window.js` correctly followed the resulting guest focus.

The generic fix completes the dialog helper's existing
`focus_notify_transfer` transaction synchronously. It preserves the dialog's
own first-tabstop eligibility, including a hidden WinHelp Contents page, instead
of substituting the public SetFocus activation path. A real guest-frame nested
regression also exposed a duplicate focus pass: exported `DefDlgProcA` called
the helper again after `dialog_default_proc` had already handled WM_SETFOCUS.
Removing that second pass preserves focus selected by a nested callback.
DefDlgProcW shares the same handler and stdcall cleanup.

### Candidate evidence

Candidate run `scratch/runs/20261013-wa-input-candidate-1/` used source
`33efb438426cac8107dec028566ca5f38c946ac1` and module SHA-256
`9b3ef6f173daaa8be90733a4b8449733d74ca861062d0383a709f4be02ce1c77`.
The exact tested source/test blobs were integrated as `ab7ea7023`.

The human-idle image is byte-identical to the control, SHA-256
`4ef1cf36b2b66928460fd3638470848252958952367182b25a3e9f804850a981`.
Focus and foreground both remain `0x10029`. Ordinary Up visibly raises the
reticle from approximately `(414,289)` before input to `(388,225)` while held,
then `(366,208)` in the release capture; the worm visibly aims upward and the
timer progresses from 58 to 57.

The source-consumption boundary is directly observed:

- `output.log:7169`: `WM_KEYDOWN`, VK `0x26`, actual game HWND `0x10029`.
- `:7175`: original game keydown branch `0x4695ea`.
- `:7163`: trace-at hit `0x46a380` at batch 774, VK `0x26` and original caller
  `0x4695fa`. Trace and API output streams need not appear in execution order.
- `:7189` / `:7198`: actual game keyup message and branch `0x46960c`.
- State snapshots: keyboard byte `[K+0x132]` is 0 before, 128 at held batch 791,
  and 0 after release at 792. Suppression stays zero.

Original game disassembly establishes the path: window wrapper `0x463880`
reaches `0x469490`; keydown checks `[P+0x2c]`, obtains `K=[P+0x60]`, and calls
`0x46a380` to set `[K+0x10c+VK]=0x80`. Keyup calls `0x46a3b0` to clear it.
The GetKeyboardState callers examined were any-key scans, not this arrow path.

All 42 remote run artifacts were copied and SHA-256 verified. The three human
images were visually reviewed, including an independent coordinator review.
Guest exit was zero at `2026-10-13T21:39:16.699Z`; supervisor 122041, parent
122055, and both process groups were absent at `21:39:25.034Z`, before the
runtime slot was released. See `investigation.json`, `runtime-cleanup.json`,
`launch.json`, `control.jsonl`, and `remote-artifact-hashes.json` in the run.

### Regression validation and limits

`scratch/runs/20261013-focus-conformance/` contains the full build, focused
tests, intermediate nested failure, and original-code negative control.
`test-dialog-setfocus-tabstop.js` executes a real guest x86 wndproc calling the
imported DefDlgProcA thunk, checks live/outer ESP and nonvolatile registers,
checks synchronous notifications with a hidden ancestor, and exercises nested
SetFocus redirection and pending-target destruction. Draining the old dialog's
queue after activating a new window cannot reclaim focus. The original source
fails that stale-focus assertion; the candidate passes.

The full build and `test-active-window.js`, `test-def-dlg-proc.js`,
`test-dialog-custom-dispatch.js`, `test-showwindow-owned-form-activation.js`,
`test-dialog-null-dlgproc-erase.js`, and the focused tabstop suite all pass.
This run establishes ordinary human Up aiming through the original child
route. Firing, movement, a complete match, browser behavior, audio, and timing
performance remain outside this evidence.

## Registered local candidate launch (2026-10-13)

Candidate `1635081e10df4a62183c184ff27a2daf3123b527` adds the local-only
`worms_armageddon_demo` app with five original DLL seeds and
`spawnProcesses: true`. The archive/extractArchive/is5Extract recipe reproduced
all 667 original files (20,639,487 bytes) with zero SHA-256 differences.
Eight registry structure checks passed. No desktop/public release is included.

`scratch/runs/20261013T2156Z-wa-registered/` used
`--app=worms_armageddon_demo --no-build`, without an explicit spawn override,
with module `9b3ef6f173daaa8be90733a4b8449733d74ca861062d0383a709f4be02ce1c77`.
The genuine child merged two written files, one deletion and 73 registry/INI
keys; Quick Game reached the reviewed Player One/Worm 1 human turn at batch
771, timer 58. Its image matches the previously reviewed candidate capture.
All 34 artifacts were copied and SHA-256 verified.

The 120-second visual-review gate expired before coordinator confirmation.
No aiming input was issued in this registered run; the earlier ordinary Up
aiming evidence remains a separate run. Guest exit was zero at 22:01:31.120Z;
supervisor136892, guest136903 and guest group were absent at22:02:49.705Z.
Registered launch is verified; browser, full match, audio and FPS remain open.
