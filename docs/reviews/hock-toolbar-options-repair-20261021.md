# Normal toolbar launch repaired; original Hock scores 0/20 → 10/20

Exact base main `71bc4a6d07387c18725da334983d25c6290fed40`, with required
association commit `b000885e252d926919eee8bedc544bba601dc897` preserved as the
parent of fix `52c165ee0c6018f6691ac6497496c20225f8b05f`. Task branch
`task/hock-toolbar-options-repair-oct21`; no main integration or public deploy.

## Root cause and scope

The toolbar's `index.html` wrapper calls `shell.launchApp()` without options.
`launchApp` forwarded undefined to `launchAppInner`, whose PE-loading call
unconditionally read `launchOpts.showCmd`. The prior normal-toolbar run failed
there before requesting the EXE, despite the catalog direct URL working.

Normalize null/undefined once at the public launcher entry:
`launchOpts = launchOpts ?? {};`. Explicit objects are retained, including
`showCmd: 0`; neither a default show command nor a truthiness conversion is
introduced. The only production delta beyond the association prerequisite is
these three lines (two comment lines and normalization) in `lib/browser-shell.js`.
No core, guest, memory, allowlist, dependency or startup-default change.

Caller trace: the toolbar, desktop/Start-again and ordinary launchExe paths can
omit options. The catalog `?app=` route in index.html supplies `directIntent`
and `startedAt`; debug/explicit launches can supply an object. ShellExecute /
WinExec in host.js pass `{hidden: nShow === 0, showCmd: nShow}`. Process spawning
passes `bypassSingleApp`, `hidden`, `showCmd`, `beforeRun` and `onExit`. VFS and
queued launches forward their options through this same entry. Normalization
precedes the in-flight guard, so both immediate and queued/restarted requests
keep those contracts. `host.js` still uses `ProcessBoot.applyStartupShow`:
omission/null/-1 leaves the historical startup behavior; explicit zero sets
SW_HIDE. Invalid commands, including SW_SHOWDEFAULT (10), still reject.

## Tests and controls

`test/test-browser-launch-options.js` executes the real browser shell to its
loadExe boundary with DOM/host stand-ins; it does not replace launchApp or
launchAppInner. It asserts the exact PE options, init-before-load ordering,
startup-helper effects, failed-PE status and released boot ticket. Thirteen
cases cover no arguments, app key only, explicit undefined/null/empty object,
and frozen explicit options with showCmd null/-1/0/1/3/5/7/11. Five invalid
startup commands reject. Frozen inputs also prevent accidental caller mutation.
The fake PE deliberately returns false: this is contract coverage, not runtime
gameplay evidence.

The unmodified shell fails the new test with the reproduced showCmd TypeError.
Removing just normalization in memory fails again. A separate mutation that
defaults falsy show commands fails specifically on explicit showCmd 0. Both
negative controls exit 1; repaired tests exit 0 locally and remotely.
WinExec VFS forwarding, boot-cursor behavior, all 11 catalog tests (including
the prerequisite's 39 missing-file controls), Hock registration controls,
syntax, whitespace and complete test-tier membership pass.

One existing check is **not passing**: `test/test-shell-execute-launch.js:182`
asserts the old source-text form of the host VFS call without launch options.
It fails identically with exact-main shell/test and unchanged main host.js.
The baseline and repaired failures are preserved. No assertion was weakened,
and this unrelated pre-existing test mismatch was not repaired.

No WAT/build input changed. All 7,252 other tracked staging blobs match exact
main; five intended modified paths match local hashes (four prerequisite paths
plus browser-shell). The new test hash also matches. The previously all-gates
canonical module is reused with its build log and recovery records; no rebuild
or dependency download was necessary.

## Real normal-toolbar acceptance

All runs use SAME `bx_egnm3u4y`, Boat API exec, actual createEmulatorHandler on
`127.0.0.1:18765`, Chrome 151.0.7922.108 headless, 1100×850, cross-origin
isolated, ordinary worker mode. Every run opens `/emulator/?debug` **without
an app query**, selects `#app-select` value `hock_a_loogie`, then clicks the
real `button[onclick="launchApp()"]`. The catalog URL is recorded as metadata
only; it is not navigated for acceptance. Mouse input uses Puppeteer's normal
browser mouse API, never guest state writes or direct guest commands.

| Run | Evidence and result |
| --- | --- |
| Prior toolbar failure, 113 events | Preserved original console/state/PNG: showCmd TypeError before PE; subsequent mouse actions hit error UI. |
| Repaired identical sequence, 113 events / 72.408 s | Original character selection reached; no showCmd error. The old click coordinates do not select a character. |
| Slower click, 113 events / 76.633 s | Still selection only. Pacing alone does not correct the cursor position. EXE response-body capture failed in this intermediate run; do not claim its network EXE hash. |
| Cursor-aimed input, 113 events / 76.851 s | Actual selection, ordinary mouse charge/release gameplay, visible score **0/20 → 10/20**. |

The successful driver moves the pointer to browser (195,600), waits 1 s,
holds left mouse 1.5 s, then releases. Its hover capture shows the game's hand
over Beavis. It then sends 36 charge/release actions at browser (378,462),
cycling 650/800/950 ms holds with 650 ms gaps and 50 ms movement settling.
`input-aimed/shot-00.png` shows 0/20 at timer 119 and a projectile;
`input-aimed/final.png` shows 10/20 at timer 67. Both were visually inspected,
as were the selection/start captures. Input UTC/wall times, screenshots,
console, requests, response hashes and final state are retained. The first two
repaired runs are not labeled gameplay merely because their drivers exited 0.

Final actual HTTP responses establish:

* WASM: `728e1de80ec20a284fc41b339895ee8ac29f16e4ded83325b27576cfacd4466c`, 1,878,508 bytes.
* Original EXE: `974f1b5ff82cfdb87f05b9840ae03cd2ed6ceebe2c8ed547253dadaf1a871ef4`, 223,744 bytes.
* Original package: all 44 intake seals, 39 game files and 38 manifest companions
  independently match; no game bytes were changed. Exact source and manifest
  hashes are in `identity-final.json`.

Auxiliary build-info/auth/favicon and missing comctl32 DLL requests still log
errors; there is no launch exception in the successful run. No claim of whole
game completion, exact struck target/collision, keyboard control coverage,
sound quality, FPS or Windows parity. The cursor targeting used above is an
observed input recipe, not a diagnosis or repair of input-coordinate semantics.

## Evidence and recovery

Adjacent `hock-toolbar-options-repair-20261021-evidence.tgz` contains the raw
85-file remote seal set plus local controls, baseline/repaired logs, validation,
source publication receipt and replay tools. Verify `SHA256SUMS.json` after
extracting, then the nested remote seal set. It contains no game payload.
Local evidence/publication/RECOVERY live in
`scratch/runs/20261021-hock-toolbar-options-repair`.

Assigned staging `/home/user/hock-registered-runtime/repo` retains originals,
dependencies and canonical module on exact main plus prerequisite/fix source;
raw new evidence is `/home/user/hock-toolbar-options-repair`. The source patch,
original recovery recipe/seals and prior canonical build log are in the bundle.
Recover via the task branch, not by treating ignored binaries as Git-backed.

All browser/server processes closed through driver finally blocks. Successful
final API exec confirms the box is RUNNING; owned browser/driver process list
is empty. Expiry **2026-10-21T10:44:02.530Z**, shutdown belongs to coordinator.
Evidence was copied and verified by 09:52 UTC, before the 10:34 handoff deadline.
No create/resume/stop/delete, extra worker, refill, main merge, protected root
WIP/laptop/fleet edit or public deployment was performed. Stop after publication;
independent review must precede any main integration.
