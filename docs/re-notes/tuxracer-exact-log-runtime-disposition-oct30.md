# Tux Racer retained runtime: title and main menu confirmed

Historical source last updated, 2026-10-30. Runtime and implementation claims below describe that dated source; see current app notes and source for subsequent changes.

Personally inspected exact 640×480 title.png and before.png on 2026-10-30. The first shows the Tux Racer splash and “PRESS ANY KEY TO START”; the second
shows the main menu: Enter an event, Practice, Credits and Quit. Practice, course
selection, race/gameplay and ordinary Quit are **not demonstrated**. The retained
practice.png and course.png have the same length and SHA256 as before.png: their
names describe attempted capture points, not successful transitions.

## Actual retained observation

Exact log observations (line numbers in runtime.stdout):

- Lines14–21 and33–38 show DllMain calls returning EAX1. The log reports157
  eager files/12951513 bytes, cooperative guest thread1, and trace window
 21700..56000. No missing initializer or initial startup success is inferred.
- Line297 records renderer dequeue1 at batch21787: WM_KEYDOWN0x100,
  Enter wParam0xd, lParam0x1c0001. Focus routes to hwnd0x10001; line301 records
  DispatchMessageA to that hwnd. Enqueue/correlation IDs are unavailable;
  queue depth, enqueue time and complete queue composition remain unknown.
- Before.png is captured at batch30000. Mousemove at31000, click320,260 at32000,
  and Enter at40000 are scheduled/logged. Neither a later dequeue nor a later
  DispatchMessageA appears. Keyup26000/44000 is scheduled, not proven delivered.
- At batch22700 totals show63160 decisions/runs/returns, mainPolls4 and
  workerPolls0. By last summary batch49700:1791160 decisions, runnable, runs and
  returned; suspended0, threw0, mainPolls4, workerPolls0, outsidePolls0. Thus
  observed main-run returns continue while measured poll totals remain flat. Last decision: cooperative-interleaved, runnable, yieldReason1. Null
  liveThreads/clock fields do not establish thread liveness or timing.
- Detailed logging reaches its limit at line296:86 decisions,85 starts,
  85 finishes (256 events), then “further observations suppressed”. All29
  summaries say saturated:false; this does **not** negate detailed-event
  suppression. No complete post-limit decision trace or post49700 terminal
  summary exists. YieldReason1 describes observed decisions, not a cause proof.
- Practice.png at38000 and course.png at49000 match the inspected main-menu
  bytes. No after.png was produced. The trace does not establish why later
  input was not observed, nor why CPU use reached SIGXCPU. It does not qualify
  practice/race or a scheduler repair.

## Collector correction and acceptance

The predecessor collector added all four PNG sizes (652097) before selecting,
incorrectly rejecting the set. The corrected reusable collector in
test/tuxracer-exact-log-runtime-disposition-oct30/collector.py takes explicit
name/length/SHA pins, rejects ambiguous/unsafe names, selects and deduplicates
by (length,SHA), then enforces the512KiB ceiling before any fetch. Verified
local representatives are reused; new files use exclusive creation and bounded
11264-byte chunks with final full length/SHA verification. It never packs or
discovers unrelated remote files. The predecessor supervisor remains immutable.

Actual selected set: title136760 + before171779 =308539 unique image bytes;
plus runtime.stdout58468 =367007 bytes, below524288. Four tests pass: old
duplicate-image reproducer and unselected oversized file; genuinely oversized
unique selection rejects before fetching; local reuse plus exact chunk recovery;
pin/name conflicts and corrupt local content reject. The same collector verified
all three actual files with zero fetch calls. These are collector tests, not
guest acceptance. Local wrapper checks separately passed a legitimate655360-byte
generated file under12MiB FSIZE and rejected600000-byte output under512KiB capture;
omitted/root/donor cwd rejecting controls passed. Git DATA256MiB applies only to
Git children, Python DATA128MiB only to Python children. No Node execution needed. The unchanged canonical filename parser receipt was reverified and reused;
there is no new filename-bearing guest invocation.

## Recovery, resources and lifecycle

Wrapper qualification gap: initial local API clients used the specified soft
DATA/CPU/FSIZE limits with inherited infinite hard limits. Review corrected hard
child bounds to DATA128MiB (Git256MiB), CPU60/60 and FSIZE12MiB, preserving stricter
inherited limits; wrapper controls and collector tests passed on that corrected
configuration. Initial receipts are retained, not retroactively qualified. The
remote exact-file reader itself set DATA128MiB, CPU60/60 and FSIZE12MiB hard/soft.

New fork bx_b9s6w3bm created2026-10-30T09:24:14.923Z, finiteTTL1800,
original expiry09:54:14.892Z. This task explicitly owned snapshot-stop. Independent
watchdog armed before API smoke, with separate operation files/logs and20/23/25
minute cutoff/handback/shutdown schedule. Supported explicit-ID API recovered only
runtime.stdout, in six chunks of at most11264 raw bytes; every request envelope
was below16KiB. No new guest process was launched; API subprocess groups were
reaped. The prior worker had already reaped the original guest group.

Recovery recipe: use selected-verification.json local paths first and verify exact
pins. runtime.stdout is task-owned beside completion-receipt.json; title.png and
before.png remain in the parent capture directory. The original stopped source
and new post-recovery snapshot retain the remote exact path
/home/user/tuxracer-render/capture/runtime.stdout. No further provisioning or
access is authorized by this report. Compact receipts and corrected collector
are published; raw media, historical denials and as-run API records remain local. Coordinator appends messageboard-note.txt; this worker does not write shared main.
