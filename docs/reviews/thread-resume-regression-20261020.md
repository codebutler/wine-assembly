# Thread resume regression: fixture correction

Accepted as a source-level fixture correction on exact main
`f3698d8827aa048af14e0f0cbaa733bb96801949`. No production code changed.
Local branch: `task/thread-resume-regression-oct20`. **NO REMOTE BACKUP.**
Publication remains blocked by recorded HTTPS credentials / SSH host-key failures;
no publication, authentication or trust retry was made. No main integration.

## Diagnosis and correction

Independently reproduced the unchanged `test/test-thread-manager.js:570` failure:
actual 0, expected 1, “scheduler executes the worker after its final resume”.
The original test and assertions ran with the supplied exact-base WAT reader
copied into this task's evidence directory (its receipts therefore never write
into the supplied read-only run).

`ThreadManager._notifyThreadAttach` creates a resumable notification operation
before a new cooperative thread runs. `runSlice` advances that operation instead
of calling `exports.run`. Even the empty DLL snapshot completes on its own first
quantum; it publishes `_dllAttachNotified = true`, and the next quantum executes
the thread procedure. `resumeThread` correctly decrements the suspend count.
The old helper combined an already-running thread's scheduling expectations
with an uninitialized notification state. This was a stale fixture, not a broken
resume contract. Changing production to bypass notification would be incorrect.

The two fixture corrections explicitly model already-started threads using
`_dllAttachNotified: true`. No existing assertion or expected value changed.
`test/test-thread-manager.js` also gains a nested self-suspend regression: a
partial resume preserves yield 11, and final resume clears it before guest entry.

The adjacent review JS independently drives cold and warm threads through the
unchanged scheduler and DLL loader. It supplies current callback-owner/lock,
empty lifecycle/table/count/stride and metadata-lock exports in shared fixture
memory. It verifies suspended cold threads cannot attach, another callback owner
blocks admission without losing ownership, an empty attach consumes one quantum,
both locks are released, the thread then runs, and subsequent suspend/resume
executes immediately. The addresses in that fixture are private test storage,
not copied production region addresses. There are no DLL guest callbacks in the
empty table model. Already-started scheduling fixtures need no synthetic DLL
callback exports because their real notification phase has completed.

## Complete downstream inventory and results

| Suite | Fixture inventory / result |
| --- | --- |
| `test/test-thread-manager.js` | Shared runnable helper affected resume, vblank, timed sleep, budget/priority/audio and nested wait cases. Corrected once; entire file passes to its final 13 PASS summaries. |
| `test/test-thread-clock-park-sleep.js` | Same missing ready state in spinner/peer helper; independently failed “spinner ran its first slice”, corrected once; entire suite passes. |
| `test/test-worker-thread-scheduler.js` | No fixture correction needed; complete suite **57 passed, 0 failed**, including CREATE_SUSPENDED/ResumeThread and sleeping-worker wake. |
| `test/test-browser-worker-self-suspend.js` | Unchanged; passes host-method/yield-11 source and fake-link behavior tests. No browser launched. |
| Adjacent review JS | Both uncontended and contended cold-start paths plus warm nested suspend/resume pass. |

All assertions remain enabled. No remaining mismatch was found in these complete
suites. The worker suite needed its exact-base filesystem/byte-provider JS
dependencies added to the explicit sparse scope; that missing checkout input
was not a source defect. `test-run-budget-completes-resume.js` and
`test-thread-priority.js` were inspected but not executed: they use the full
render harness, outside the no-fullbuild scope. They concern interpreter block
completion / WAT priority dispatch, not this cooperative fixture state.

Five rejecting controls run in isolated Node module caches without changing
production files or assertions:

| Control | Required rejection |
| --- | --- |
| `--stale-fixture` | Restoring missing ready state reproduces the original final-resume assertion, 0 versus 1. |
| `--skip-resumed` | Production scheduler mutation skipping count-zero workers fails that same final-resume assertion. |
| `--run-suspended` | Removing both scheduler suspend filters fails “scheduler does not execute a suspended worker”. |
| `--keep-self-yield` | Omitting yield-11 clearing prevents successful guest re-entry; new final-resume run-count assertion rejects it. |
| `--skip-attach` | Bypassing notification fails the independent cold-quantum assertion. |

Each control exits 1 with the specified AssertionError; ordinary suites exit 0.
The self-yield mutation's guest-entry assertion is caught by production crash
handling, then rejected externally by the unchanged observed run count.

## Replay and preservation

From the isolated repository in
`scratch/runs/20261020-thread-resume-regression-oct20/repo`:

```sh
node --require ../read-only-inputs.cjs test/test-thread-manager.js
node test/test-thread-clock-park-sleep.js
node test/test-worker-thread-scheduler.js
node test/test-browser-worker-self-suspend.js
node docs/reviews/thread-resume-regression-20261020.js
node --require ../read-only-inputs.cjs docs/reviews/thread-resume-regression-20261020.js --skip-resumed
```

The last command must reject. Substitute the other controls above to replay
each rejection. In a complete checkout, the existing suite needs no preload.
The preload only supplies absent `src/*.wat` reads from exact-base Git objects
and seals its reads; it does not substitute JS, scheduler state or assertions.

Evidence alongside that repo includes `setup.json`, `baseline.{json,log}`,
`tests.json`, per-command logs, `input-seals.json`, `source-seals.json`,
`receipt.json`, `SHA256SUMS.json`, `change.patch`, and `commit.patch`.
The receipt records the final local commit, exact input mapping, protected
HEAD/index/config checks and final footprint. Initial explicit checkout content
was 1,524,489 bytes; flattened read-only alternate closure was established before
materialization. No wholesale src checkout. Task storage stays below 16 MiB and
available disk above the fixed 2,285,895,680-byte guard.

This does not qualify named-event transport, nested event waits, guest DLL
callbacks, a full VM, native Windows, real Workers, games or browser execution.
Those prior dependencies and review holds remain. No runtime/Boat/SSH/auth,
laptop Heroes II/Warcraft III, shared source, main or worker-launch changes.
Single bounded task complete; coordinator owns any further assignment.
