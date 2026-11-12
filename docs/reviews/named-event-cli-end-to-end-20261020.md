# Qualified finite named-event CLI repair

Implemented the coupled production repair on isolated branch
`task/named-event-cli-end-to-end-oct20`, based exactly on
`a9a60c69f8598562d80bf8b97f64b3864476280b`. The prior reserved-CLI and
Worker-entry reports remain historical diagnostics, unchanged. They are not
represented as accepted production fixes. Local implementation checkpoint:
`e4cf855510ec321f2d7e114e44884e9af7afc915`; final commit is recorded in the
adjacent evidence receipt after this report is committed.

## Production behavior

`guest-rpc` samples integer nanoseconds at the actual Node Worker host-import
entry, before domain lookup, asynchronous-call flushing or RPC transport. The
sample remains a decimal integer string in the notification, with the exact
qualified domain. No performance.now conversion or browser/Node clock
equivalence is used. Qualification remains only trusted Linux Node 24.18.1 /
libuv 1.52.1 peers with the same boot and stable calling-thread time namespace.
Unsupported clock scope is explicit; it cannot select authority recapture.

RPC protocol v1 binds the sample to slot, monotonic per-slot invocation sequence,
handle and original unsigned timeout. The Worker requires the broker capability
before posting a finite call. Shared request/acknowledgment words and a SHA-256
digest bind the notification fields to the published invocation; missing,
altered, stale, cross-call and mixed-version metadata cannot become a fresh
broker timestamp. This is consistency checking between trusted local peers,
not protection against hostile shared-memory writers. Sequence exhaustion
fails; there is no wrap/reuse. Browser transport does not opt into this clock.

The shared 64-word/256-byte control block keeps its size and allocated base.
Words 53..56 carry version, sequence, acknowledgment and reservation sequence;
previously unused 28..31 and 34..37 carry the digest. They overlap neither
arguments, f64 results, input publication nor audio blocks. The allocated-region
declaration documents the ABI; a new test checks allocation and consumers.
`guest-thread-host` forwards the entry notification. CLI main and per-thread
adapters retain it; direct/cooperative CLI imports capture at their own entry.

`NamedEventClient.validateWaitClock` validates an already captured timestamp
and requires an exact authority echo. The legacy `waitClock` implementation
and the authority reservation algorithm are unchanged. Only `registerWait`
atomically decides deadline eligibility. A delay after validation is still
charged to the original budget. There is no untimed finite acquire and no
broker-local expiry decision.

Each initiating thread owns one reservation. Duplicate initiation fails rather
than replacing it. Scheduler polls query status; they never register again or
acquire. Terminal results are forgotten. A committed signal survives late
observation and cancellation racing with completion; timeout leaves an
unconsumed signal. Closing the owning reference resolves cancellation/status,
forgets the terminal authority record, and retains the local terminal result
until the continuation observes it. Thread teardown cancels/forgets; it still
retires the thread if transport cleanup throws. Explicit owner shutdown and
CLI normal/failure cleanup close the session; existing process/socket cleanup
handles process exit. No reconnect or mutation replay is introduced.

Worker slice replies carry the reservation invocation sequence. Scheduler
continuations and the actual Worker completion body check ownership; stale
and duplicate completions cannot pop the guest stack again. Existing recursive
callback completion tokens remain separate. A stale previously observed reply
cannot consume a later invocation on the same handle/thread.

Infinite, positive multiwait and nested named waits reject before acquisition.
Zero-timeout probes and nonnamed/non-wait paths retain their existing behavior.
Review found the Worker nested guard scanned only 512 of the allocated 4,096
sync entries. It now derives its count from the region size. A last-slot named
event in a mixed local/named nested wait rejects before consuming the local
member. No provider reservation algorithm defect or change was needed.

## Acceptance and negative controls

`test/test-named-event-cli-end-to-end.js` exercises actual Node Workers,
production `createWorkerImports` and `createMainBroker`, extracted production
CLI adapters, actual ThreadManager, and an authority in a separate subprocess
(whose server and client bridges are Workers). The Worker completion body is
also extracted from production and executed in the real Worker. Register/export
fixtures are explicit; no complete interpreter or PE is booted.

The final `tests.json` records 27 commands with expected outcomes: 21 successful
commands and six intentional assertion failures. These cover:

* Original 50ms budget across 180ms delivery on both main and per-thread
  adapters, plus delay after validation that is asserted to precede expiry.
  Both repaired paths time out without consuming the signal. The exact base
  returns success and fails the same acceptance assertion.
* Predeadline assignment observed after a 180ms reply delay; manual Set–Reset
  wakes all registered waits, auto-reset exactly one; repeated invocations,
  original budgets and signal preservation after timeout.
* Dropped, stale, replaced-clock, cross-call, malformed and foreign metadata;
  incompatible broker version; exact authority acknowledgment; no fallback.
* One registration per invocation, status-only polls, main/cooperative/Worker
  scheduler completion, stale continuation rejection and single ESP cleanup.
* Intermediate/final close and recreate, cancellation, thread/owner cleanup,
  270 terminal completions without retained-result quota leakage, 256 pending
  reservations and explicit ENOSPC on the next request.
* Unsupported nested/infinite/multiwait rejection and zero/nonnamed regressions.

Intentional failing controls are the exact baseline, broker recapture,
duplicate registration, status replaced by reacquisition (lost pulse), stale
continuation acceptance, and disabled Worker completion ownership. Their
failures are assertion failures on incorrect behavior, not syntax/startup
failures. The first lost-pulse attempt exposed a null-result dereference in the
test; it was retained in `tests-first-final.json`/its log and corrected to an
explicit lost-wake assertion. Final evidence uses that assertion.

`test/test-named-event-cli-reservation-regressions.js` replays the historical
finite scheduler suite through a new source adapter: new RPC metadata and the
correct reserved Set–Reset expectation. It exercises actual forked producers,
concurrent real Workers, ordinary cooperative scheduling, close/recreate and
fatal poisoned-client reuse. It does not rewrite the historical fixture.

`test/test-named-event-cli-transport-loss.js` forwards real socket traffic in a
separate Worker and discards replies **after** authority operations. Lost
register/status/cancel/forget replies trap, preserve client poison, never
complete falsely and never replay; cancellation failure still retires the
thread. A stripped clock acknowledgment rejects before registration while
leaving the signal intact. Existing authority tests additionally cover explicit
shutdown, SIGKILL, survivor references, authentication errors and authority loss.

Static/regression gates include WAT/JS constants, allocated region declarations,
generated region mirror, Worker import signatures, the new shared-slot ABI test,
full Git-tree test-tier inventory, import-throw/caller-stack/nested routing,
zero-timeout waits, ThreadManager, Worker scheduler (57 cases), clock parking,
authority, and qualified caller clock peers/scope. All four new tests classify
as UNIT. `tier-check.cjs` uses the full Git filename inventory plus new files;
it does not materialize the omitted tests. The ordinary sparse tier invocation
fails because omitted tests are absent and is retained separately.

The broader sparse-stack regression fails at line 76 with actual 1074790392
versus expected 1073807352. The exact-base ThreadManager produces the identical
failure; both logs are retained. This unrelated baseline failure was not repaired
or counted as a passing gate. Initial/development runs are retained separately
from final selected results. No full build or full VM was run.

## Limits and recovery

**Guest entry to authority registration remains unreserved.** Set–Reset wholly
within that gap may be missed. Registration is the reservation linearization
point. Eligibility is bounded by the original deadline; RPC return latency is
not. There is no Windows parity, native oracle, browser clock qualification,
game qualification or runtime-admission claim.

Evidence root: `scratch/runs/20261020-named-event-cli-end-to-end-oct20/`.
The pre-checkout projection was 37,334,706 bytes with 3,629,117,440 bytes free;
allocation is 48MiB and the fixed free floor is 2,285,895,680 bytes. The fresh
sparse repository borrows objects through 37 flattened object-only views,
used read-only, with no nested alternate files. Shared and supplied HEAD,
index and config seals remain unchanged; all 200 supplied artifact seals verify.
Historical diagnostics and reports are unchanged.

`receipt.json`, `tests.json`, `verification.json`, `source-seals.json`,
`SHA256SUMS.json`, aggregate `change.patch`, and per-commit patches seal local
identity and outcomes. Recover by retaining the exact base and borrowed object
stores, creating the named branch at that base, then applying the commit patches
in order. Alternatively apply the aggregate patch once. Do not apply both.
Replay the four new tests with Node 24.18.1/libuv 1.52.1 and the commands in
`tests.json`; the negative controls must exit 1 at their documented assertions.

No workers/refill, main integration, push, publication, Boat/SSH/browser/runtime
retry, broad checkout/fullbuild, credentials/auth/trust bypass, laptop game or
Claude changes. Publication held: **NO REMOTE BACKUP**. This bounded task stops
after sealing the implementation and evidence; successors belong to coordinator.
