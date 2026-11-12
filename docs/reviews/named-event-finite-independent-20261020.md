# Independent finite named single-wait acceptance, 2026-10-20

Candidate: **ae0df56636e56b34e4d707655add361a25535799**, exact source in
`scratch/runs/20261020-named-event-finite-single-oct20/repo`.
Parent: `8f4ade77e9af1b47463f527118f1035fc22cb986`.
Review branch: `task/named-event-finite-independent-oct20`.

## Verdict

**The scheduler component passes bounded acceptance; correct finite Windows
named-event wait behavior is NOT accepted.** Authority waiter registration and
wake reservation remain an unresolved correctness prerequisite. The component
can be retained as conditional scheduler work only, with that blocker attached;
the missing protocol is not an optional conformance enhancement that this
review waives. No additional, independently reproducible defect in the stated
scheduler-sampled contract was found.

This distinction matters: a finite wait now parks instead of explicitly failing
as unsupported, but it can silently miss a signal while parked. In the new
test, two waits are already parked on an unsignaled event. The producer performs
Set then Reset before the scheduler's next probe. Both waiters remain parked
and eventually return WAIT_TIMEOUT. This reproduces for manual-reset and
auto-reset events with the real authority. Persistent-signal controls yield two
successes for manual-reset and one for auto-reset, so the transient failure is
not a broken event fixture. There is no registered authority waiter to reserve
the wake. Scheduler polling cannot establish Windows event-wait conformance.

The candidate disclosed this defect; this review independently reproduces it
and keeps it blocking API acceptance. It does not request unrelated infinite
wait or wait-all implementation. A subsequent registration protocol needs its
own deadline, cancellation, disconnect, and wake ownership review. The current
synchronous acquire can also start before a deadline and finish after it;
there is no authority-side deadline or acquisition timestamp. The tests below
validate the host's sampling cutoff, not a provider-enforced temporal cutoff.

## Identity and replay

Before checkout, independently verified all **182** submitted source SHA-256
seals against the exact candidate blobs, and all **54** artifact seals in the
submitted manifest. At sealing, also verified every supplied and projected
source file against those seals. The measured projection is
182 files, **6,579,749 bytes**. A fresh sparse repository uses flattened object
views with no inherited `info/alternates` chains; alternate object contents are
read-only inputs. No shared or supplied checkout/index/config was modified.

All **21 submitted commands** reproduced their expected exits. `replay.json`
records commands and individual logs. This includes the normal finite suite,
the exact-parent rejection, fake-success/no-deadline/wrong-worker-id rejection
controls, the historical positive-wait rejection, the scoped zero replay,
full ThreadManager, Worker scheduler **57/57**, clocks, zero-timeout, names,
guest-RPC nested/import-throw, self-suspend source assertion, authority,
thread lifecycle, nested-event and repaired lifetime suites, and independent
zero-timeout CLI acceptance. The finite suite's actual subprocess/fork and
real ordinary Worker scenarios reproduced, including auto/manual competition
and actual bridge termination/poisoning. Expected failing commands are not
reported as successful execution.

The historical CLI test is unchanged from the parent and still rejects at
line 130: its depth-zero, positive wait expects WAIT_FAILED, but the now-set
event returns WAIT_OBJECT_0. The adapter makes one asserted unique textual
replacement: `[1, 500, -1]` becomes `depth ? [1, 500, -1] : [-1]`. Only the two
ordinary positive unsupported expectations are removed. Nested positives,
ordinary INFINITE, the following no-consumption assertion, zero acquisition,
24 subprocess races, lifetime, routing, and poisoning tests remain. This is an
honest scoped regression adapter, not evidence that positive waits fully conform.

## New adversaries and controls

Run `node docs/reviews/named-event-finite-independent-20261020.js` from this
checkout. **16 groups pass**, using a real authority, independently constructed
register/link fixtures, actual Node Workers and guest RPC, and a tiny actual
Wasm sibling. Only ThreadManager's monotonic clock is replaced in memory for
deterministic deadline boundaries; authority transport uses its real clocks.
The submitted suite separately supplies real elapsed-time coverage.

| Area | Independent evidence |
| --- | --- |
| Initial transport | Advance monotonic time during the first unsuccessful acquire past the entire timeout; the first poll times out and preserves a newly set signal. Moving deadline creation after transport fails this test. |
| Clocks and delayed polling | Frozen, huge positive and negative guest clocks do not change the finite deadline. Poll at deadline-minus-one remains parked; poll exactly at deadline times out without consuming the late signal. |
| Ownership | Different thread IDs retain different deadlines. Zero probes and recursive rejection do not overwrite the outer continuation. Missing/mismatched identities fail without consuming another thread's signal. |
| Main and nested guards | `_localSendFrames` and render-send guards leave registers and signal untouched. Removing a guard after expiration does not restart the deadline. Normal completion updates EAX/EIP/ESP once, by 12 bytes. |
| Cooperative scheduling | `runSlice` keeps the pending frame intact, completes on the first expired poll without local poll-floor delay, and does not complete twice. |
| Sibling progress | Actual Wasm sibling runs through `runSlice`, invokes a nested rejection, preserves the main continuation, then signals it. The main frame remains untouched until its own completion. |
| Parked Worker cache | Repeated `_pollParkedWait` calls preserve one cached completion and do not consume a second auto-reset signal. |
| Actual ordinary Workers | New Workers use actual RPC and the candidate's CLI adapter. One ID expires while another acquires the same signal; each receives exactly one 12-byte completion. A terminated parked Worker receives no completion and consumes no later signal. |
| Cleanup | `terminateThread` removes only the victim continuation; normal `_markThreadExited` removes its own. Surviving waits still acquire. Process exit/client cleanup is also covered by the replayed independent CLI suite. |
| Lifetime | Partial close preserves the original wait. Twenty successive slot reuses do not authorize a stale continuation or consume the replacement signal. |
| Unsupported paths | Recursive signaled positive, INFINITE, positive multiwait, and zero wait-all still fail without consuming the supplied signals. Actual nested Worker routing is covered by the replay. |
| Transport | An injected acquisition exception leaves both continuation identities intact and produces no completion. Replayed actual bridge death returns ETIMEDOUT then ECLOSED, retains the poisoned client, and does not reconnect/replay. |
| Known defect | Real-authority manual/auto Set-Reset between polls is missed; persistent-signal controls distinguish the reservation gap from general acquisition failure. |

Four **new** in-memory behavioral mutations each exit 1 at an assertion:

* `--control=late-start`: starts the deadline after initial transport.
* `--control=no-expiry`: disables the deadline comparison.
* `--control=no-exit-cleanup`: retains a terminated thread's continuation.
* `--control=nested-probe`: removes the recursive positive-wait guard.

`independent-tests.json` and corresponding logs retain all five executions.
No production source was changed to run these controls.

## Scheduler/source inspection and limits

The new authority branch precedes local timeout shortcuts and minimum poll
counts in all three completion paths. Its `performance.now()` deadline is
separate from `_waitNow()`/deadlineClock and guest batch time. Terminal resolution
deletes that thread's record; zero acquisition does not overwrite it. Proxy
object identity is checked before polling, preventing final close/reuse from
authorizing replacement acquisition. Callback-only `resolveWait` rejects before
consumption. Positive recursive host imports reject before the initial probe;
real nested Workers retain their existing local type-4 refusal.

The actual CLI loop was inspected beyond the extracted test closure:
`mainExecutionSuspended` suppresses guest reentry while owned; the 4ms async
pause yields to host work; sibling scheduling remains between the main-run
section and unconditional end-of-batch `checkMainYield`; the stuck detector
exempts only an owned named continuation. The end-of-batch poll is not gated by
`mainExecutionSuspended`, so the suspension test does not introduce a circular
wait. Existing render-send and local-send-frame guards delay completion without
changing the captured deadline. Worker polling caches a consumed completion;
cooperative idle hints do not probe again.

These checks do not execute a complete CLI/PE boot or the full interpreter's
guest wait frame. Register exports and Worker slice/reply protocol are fixtures;
Wasm sibling dispatch and Node Worker/RPC transport are real. No native Windows,
game, browser, full VM, infinite/wait-all, alertable wait extension, concurrent
CloseHandle semantics, or handle-wraparound qualification is claimed. The
historical source-only browser assertion ran in Node, not in a browser.

## Retention and isolation

Evidence: `scratch/runs/20261020-named-event-finite-independent-oct20/`:
`projection.json`, `protected.json`, `verification.json`, `replay.json`,
`independent-tests.json`, logs, `receipt.json`, `change.patch`, `commit.patch`,
and `SHA256SUMS.json`. The receipt records the local review commit and final
capacity. `read-only-inputs.cjs` supplies sparse missing WAT assertions directly
from exact candidate blobs without a build. Recovery: restore this candidate,
apply `commit.patch`, and run the new JS review and recorded replay commands.

Only the two NEW review MD/JS files are committed. Mandatory prewrite checks
keep allocation below **16 MiB** and available space above **2,285,895,680**
bytes. Shared/supplied HEAD-index-config and historical evidence are rechecked
at sealing. No production correction, main integration, workers/refill,
runtime/403/auth/trust/Boat/SSH/browser/publication retry, or WIP/game edit.
**NO REMOTE BACKUP**: local commit and patches only; existing publication hold
was not retried. Stop with the conditional component verdict and the explicit
authority-registration correctness blocker.
