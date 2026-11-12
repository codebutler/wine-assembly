# Finite single named-event CLI waits

Exact base `8f4ade77e9af1b47463f527118f1035fc22cb986`, which independently
accepted production `250765e0835dcb4655d06189d05d69c2437d8b3b` for zero-timeout
acquisition. Branch `task/named-event-finite-single-oct20`. The tested local
commit is recorded in the evidence receipt and messageboard. **NO REMOTE
BACKUP**: the existing publication hold was not retried.

## Change

Finite positive ordinary single waits now make an authority acquisition probe
and, if unsatisfied, return the existing scheduler sentinel. The host records
the original proxy identity and a monotonic deadline per guest thread. Main,
cooperative guest threads, and ordinary Worker parked waits poll through the
existing scheduler completion paths; those paths perform the normal single
stdcall completion. No local proxy word becomes a consumable event signal.

The CLI Worker single-wait adapter supplies the actual thread identity, because
an ordinary broker call has no cooperative `_runningThreadHandle` scope. Local
handles retain their previous import routing. A real Worker still rejects
nested named waits in the unchanged guest-rpc adapter. Recursive main and
cooperative positive named waits reject before probing, including already-set
events. The callback-only Worker resolver rejects named waits before consuming.
Infinite named waits, named wait-all, and positive named multiwait remain
unsupported. Zero-timeout single and wait-any acquisition remain supported.

The main CLI suspension closure keeps an owned wait's guest frame parked. An
asynchronous four-millisecond host pause permits event-loop work and bounded
authority polling while normal sibling scheduling continues. The stuck detector
recognizes this owned finite continuation. Cooperative and free-running Worker
idle hints likewise bound polling without an extra acquisition. Exited threads
release their continuation bookkeeping. These changes do not synchronously
wait for a producer on the scheduling host or re-run guest wait code in a loop.

## Deadline and lifetime contract

The deadline starts before the initial synchronous authority probe and uses
`performance.now()`, independently of accelerated or frozen guest batch time.
It is not restarted on the first scheduler poll. The named path bypasses local
main's no-producer early timeout and its guest-poll-count floor. A later poll
at or beyond the deadline returns WAIT_TIMEOUT without another acquisition;
a signal arriving after that deadline remains available. Already-signaled
initial acquisition succeeds normally. There are no exact-duration assertions:
tests require no early timeout and use generous upper watchdog bounds.

Acquisition remains a synchronous, bounded transport operation, as in the
accepted provider. Its latency and scheduler latency can extend observed return
time. A probe begun before the deadline can finish after it. There is no
provider-side deadline or registered kernel waiter: this is scheduler-sampled
acquisition, matching the existing scheduler model. A Set followed by Reset
before an acquisition probe is not latched as a wake reservation. Native
transient-signal/reservation conformance would require a separate authority
wait-registration protocol; it is not claimed here.

Partial closes retain a live proxy. Final close/reuse fails the original wait
before any replacement acquisition; original proxy identity and issued-handle
recognition remain authoritative. Provider generation/reference handling is
unchanged. Transport failure propagates, retains the poisoned client, and does
not complete the guest wait as timeout or success or reconnect/replay. Concurrent
native close-during-wait semantics and handle wraparound remain unqualified.

## Validation

Run from the isolated checkout:

```sh
node test/test-named-event-finite-single.js
node test/test-named-event-finite-single.js --zero-regression
```

The new finite suite passes eight reported groups, including:

* A real subprocess, launched by an actual CLI fork statement, arms delayed
  Set only after main parks and wakes it before its deadline. Both fork
  statements establish the shared endpoint.
* An unsignaled wait expires without early success or the no-local-producer
  shortcut, even with a huge guest-clock jump. Waiting until after expiration
  before the first poll does not restart the deadline or consume a late signal.
* Actual Wasm sibling code runs through `runSlice` to signal the waiting main.
  A cooperative guest wait also resumes through the normal scheduler.
* Two real Node Workers execute `createWorkerImports`, normal main broker
  routing, the actual CLI per-thread adapter, `runWorkerSlices`, parked-wait
  resolution and completion. Auto-reset gives one success and one real finite
  timeout; manual-reset gives two successes. Register/link fixtures verify one
  12-byte completion. Reset, immediate finite acquisition, and idle park bounds
  are also checked.
* Partial reference close, final close and slot reuse; unsupported nested,
  infinite and multiwait paths leaving signals intact; transport loss during
  a parked wait followed by explicit poisoning without replacement/replay.

The suite executes the actual main suspension closure and asynchronous park
statement. PE loading, register exports, Worker slice reply/completion protocol
and registration are fixtures. It does **not** execute a complete CLI main/PE
boot, full guest interpreter, full VM, native Windows or game qualification.

Four controls exit 1 at behavioral assertions: `--baseline` (exact accepted
base returns WAIT_FAILED instead of parking), `--fake-success` (invented
immediate success), `--no-deadline` (unsignaled wait exceeds the harness bound),
and `--wrong-worker-id` (ordinary Worker continuations lose their ownership).
Their failures are recorded, not counted as passing execution.

All 21 final commands have expected exits in `final-tests.json`. Regressions
include full ThreadManager, Worker scheduler **57/57**, clock-park, zero-timeout
thread acquisition, name decoding, guest RPC nested/import-throw, browser-main
self-suspend source check, standalone authority, thread-resume lifecycle,
nested-event wait, repaired nested lifetime and independent lifetime acceptance.
The independent CLI review suite also passes.

The historical CLI integration test is byte-identical and intentionally fails
at its old requirement that a signaled ordinary positive named wait return
WAIT_FAILED (now it returns WAIT_OBJECT_0). `--zero-regression` is a clearly
scoped new replay: it loads that original file in memory and restricts only
the ordinary unsupported-single assertion to INFINITE. Its nested positive
assertions and all zero-acquisition, 24 two-child races, authority lifetime,
Worker nested/ordinary routing and poisoning assertions remain. Neither the
historical file nor its original evidence was changed.

## Isolation and recovery

Evidence: `scratch/runs/20261020-named-event-finite-single-oct20/`, including
projection, protected metadata hashes, original/final test command logs,
source seals, receipt, `change.patch`, `commit.patch` and `SHA256SUMS.json`.
The explicit 180-file, 6,549,585-byte projection was measured and written before
checkout; the exact base was materialized in a fresh repository with flattened
read-only alternate object views. Missing WAT assertion inputs are read directly
from exact-base blobs by the retained preload, without a build.

Only `lib/thread-manager.js`, narrow `test/run.js` adapters, the new finite test
and this report are committed. Protected shared/supplied HEAD, index and config
hashes and all other projected source blobs are checked at sealing. Available
space stayed above 2,285,895,680 bytes and allocation below 16 MiB, with prewrite
checks; final measurements are in the receipt. Restore the exact base and apply
the retained commit patch, then replay the recorded commands.

No main integration, worker spawning, replacement task, runtime/403 retry,
Boat/SSH/browser/fullbuild, auth/trust change, publication attempt or laptop
game/WIP edit occurred. The next dependency is independent acceptance of this
scoped scheduler change; stronger transient-signal semantics need authority
registration, not a claim that zero-probe polling provides kernel reservations.
