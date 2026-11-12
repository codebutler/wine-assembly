# Nested cooperative local event wait — 2026-10-20

Source candidate accepted by the bounded local tests below. Base is exactly
`c9e03eb6e40481f6bb570a89f96b856a9a1d5e83`: verified remote main
`f3698d8827aa048af14e0f0cbaa733bb96801949` plus the accepted fixture-only
ThreadManager lifecycle correction. Branch: `task/nested-event-wait-oct20`.
No main integration. **NO REMOTE BACKUP**: established publication block remains;
no publication, credential, trust or alternate-route retry was attempted.

The initial provider check correctly returned the blocking sentinel for a valid
unsignaled event. `waitSingleCooperative` then required a thread target and
returned WAIT_FAILED before executing a runnable producer. The correction adds
an event-only branch after the existing Worker/reentry guards. It gives eligible
cooperative siblings normal `runSlice` turns, then polls the actual event provider
for acquisition. Suspension, sleep deadlines, DLL attach and callback gates stay
with the scheduler. No CLI import change or scheduler redesign is needed.

Auto-reset acquisition in `waitSingle` now uses compare-and-exchange instead of a
load followed by a store. A competing consumer between those operations must
prevent success. Manual-reset acquisition observes but does not clear the signal.
This correction is confined to single-event acquisition; it does not certify
every other synchronization API against concurrent races.

The adjacent executable regression extracts the entire unchanged CLI event import
block and uses the real ThreadManager/provider/runSlice. A tiny actual Wasm main
callback calls the wait import synchronously while a separate runnable Wasm
sibling calls the production SetEvent import. The callback returns WAIT_OBJECT_0
only after the sibling runs. With the exact base manager it instead returns -1
(WAIT_FAILED as Wasm i32). Four success combinations cover manual/auto reset and
cold/warm DLL lifecycle. Empty DLL tables, register getters, message-depth getter
and thread registration are fixtures; DLL notification and scheduler ownership
are production. The test does not decode x86 or execute `$wnd_send_message`.

Fourteen groups additionally cover timeout-zero, finite-wait sentinel retention,
ordinary-main yield, suspended/resumed and sleeping producers, no producer,
historical invalid/stale-handle semantics, active/nested worker ownership,
foreign DLL callback-lock ownership, a runnable nonproducer, Worker backend
exclusion, and a deterministic competing atomic consumer. Four in-memory
production mutations fail behavioral assertions: fabricated success, running
suspended siblings, bypassing the reentry guard, and non-atomic consumption.
The baseline is a fifth rejecting run, not a passing candidate result.

Commands from this isolated repository:

```
node docs/reviews/nested-event-wait-20261020.js
node docs/reviews/nested-event-wait-20261020.js --baseline
node docs/reviews/nested-event-wait-20261020.js --fake-success
node docs/reviews/nested-event-wait-20261020.js --run-suspended
node docs/reviews/nested-event-wait-20261020.js --reenter
node docs/reviews/nested-event-wait-20261020.js --non-atomic
```

All five flagged commands must fail assertions. No assertions are disabled.
Full corrected ThreadManager, clock-park, current cold/warm lifecycle, browser
self-suspend source assertions, sync-name, thread-zero-timeout and local guest-RPC
nested-wait regressions pass. Worker scheduler reports **57 passed, 0 failed**.
The guest-RPC regression uses local Node worker_threads; it is not browser/game
qualification. The full ThreadManager suite retains finite-deadline assertions.

Limits are explicit: positive finite waits still use the existing scheduler
sentinel/deadline path. This does not add finite nested guest continuations.
Worker callbacks still cannot recursively dispatch cooperative siblings. A
pending but uninstantiated producer, async I/O, host event-loop callback, foreign
callback owner, suspended or not-yet-due sleeping producer cannot be made ready
by this synchronous event path. It never spins the host event loop. With no
progress or the existing nested-wait-sized 64 Mi-step budget exhausted it retains
WAIT_FAILED rather than inventing success. Supporting those unresolved waits
would require a resumable guest callback continuation whose stack and ownership
survive returning to the host scheduler. Infinite waits without an available
producer are not claimed to synchronously complete correctly.

Unknown/stale handles retain the provider's historical immediate-success fallback;
this task does not claim Win32-invalid-handle conformance. Cross-process event
authority/transport and atomic multi-object waits remain separate assignments.
No full build, PE/game/native Windows/browser/Boat/SSH/runtime access occurred.

Evidence is in `scratch/runs/20261020-nested-event-wait-oct20/`: explicit sparse
scope and projection, flattened read-only object alternates, guarded validation
runner, exact source seals, test commands/logs/hashes, protected shared/supplied
HEAD/index/config verification, receipt and recovery patches. Absent WAT inputs
are read from exact base Git objects by the sealed read-only preload, never
materialized as a src-wide checkout. The allocation cap is 16 MiB and every
artifact-producing step checks the fixed 2,285,895,680-byte available-space floor.
Only this review pair and `lib/thread-manager.js` are committed.
