# Finite single-event wake reservation provider — 2026-10-20

Base: exact `f7cda9b9ee28f5f96d4db24198ad3e4324b96fdb` from the supplied
finite-independent checkout. Branch: `task/named-event-wake-reservation-oct20`.
Only `lib/named-event-authority.js`, the NEW
`test/test-named-event-wake-reservation.js`, and this NEW report are changed.
The exact tested commit is recorded in the evidence receipt and messageboard.
**Local only; NO REMOTE BACKUP.** No publication retry or main integration.

## Outcome and scope

The standalone authority now registers finite waits and reserves their results
when Set occurs. A subsequent Reset cannot erase those results. Real subprocess
manual-reset waiters both succeed after Set–Reset before status retrieval;
exactly one auto-reset waiter succeeds. The original provider with the explicit
legacy polling adapter misses both pulses and fails the same reservation oracle.

This implements the provider prerequisite identified by the finite-independent
review. **The existing finite CLI API remains BLOCKED pending integration and
acceptance.** Nothing here changes ThreadManager, CLI imports, guest RPC, or
scheduler behavior. No Windows, complete CLI/PE, fullVM, browser, game, infinite
wait, wait-all, mutex, semaphore, or concurrent native CloseHandle qualification
is claimed. No build was required or run.

## Public protocol and clock contract

All methods use the existing synchronous bridge and single authority endpoint.

```js
const clock = client.waitClock();
const wait = client.registerWait(ref.handle, 500, clock);
// wait: { waitId, generation, state }
const result = client.waitStatus(wait.waitId); // { state }
// If pending, yield to producers; query the SAME waitId later.
// On abandonment, resolve cancellation's returned state before discarding it:
const terminal = client.cancelWait(wait.waitId); // terminal is never pending
client.forgetWait(wait.waitId); // only after a terminal result is handled
```

States are `pending`, `signaled`, `timed-out`, and `cancelled`. Registration
returns a fresh session-owned UUID and the original event generation. It checks
the existing signal and consumes an auto-reset signal OR queues the wait in one
serialized operation. There is no separate initial acquire. A registration
already past its deadline becomes `timed-out` without consuming even a currently
signaled event. Every registration, including immediate/expired results, uses
one result slot; rejection with ENOSPC occurs before signal acquisition.

`waitClock()` returns `{epoch, tick}`: an authority-instance UUID and a decimal
nanosecond string measured by **that authority's** `process.hrtime.bigint()`
relative to its own start. It is neither a wall clock nor a client epoch.
`registerWait(handle, timeoutMs, clock)` requires an integer finite duration
1..4294967294 milliseconds and a valid, non-future stamp from that authority.
Missing/malformed/foreign stamps and zero/INFINITE durations return EINVAL.
Zero-timeout acquisition remains the unchanged `acquire(handle)` method.

The deadline is exactly `clock.tick + timeoutMs * 1000000`, evaluated in the
authority's nanoseconds. At `now >= deadline` the wait is expired. One authority
time sample at each request's serialization point determines eligibility for
that whole synchronous operation. A Set sampled 1ns before the deadline wins;
at equality or later it cannot assign that waiter. A 100ms housekeeping timer
also expires pending records without client polling, but timer punctuality is
not required for correctness: every authenticated request first expires all
overdue pending records. Timer expiration leaves bounded terminal results.
Processing and transport after a committed assignment may finish after its
deadline; that does not revoke success. Host suspension follows the runtime's
monotonic clock behavior; no wall-time or suspend-inclusive guarantee is added.

The stamp can be passed between processes connected to the same authority.
Clients must preserve it as opaque data; **process-local `performance.now()`
values are never assumed to share an epoch**. Stamps are not cryptographically
authenticated capabilities; this retains the original trusted same-user local
transport model. A stamp does not register interest, reserve a signal, allocate
a result, or extend an existing registration. A pulse entirely before actual
registration is not reserved. Reusing an old stamp does not restart its clock.

Transport matters: the duration begins at the authority's clock observation,
not the caller's entry into `waitClock()`. The inbound clock-request delay is
outside this provider interval; the clock-response delay and all registration
transit count against it. An old stamp can therefore produce immediate timeout.
No exact caller-entry deadline or cross-process clock synchronization is claimed.
Future guest integration must explicitly resolve that boundary. For a
conservative caller-entry bound it can measure elapsed **duration** locally
across the clock RPC and subtract that elapsed duration (rounded up) from the
requested finite budget, using the returned authority stamp. This can expire
early by transport uncertainty; it is not an exact Win32 timing solution.
If that budget is exhausted, do not register a fresh full-duration wait. Exact
caller-entry semantics without early expiry require a separately reviewed
clock/transport contract; do not silently stretch the guest timeout or compare
unrelated epochs. This task qualifies only the explicit authority-stamped
deadline protocol.

## Linearization, lifetime, and cancellation

The single authority worker serializes requests; there is no await inside a
state transition. Registration linearizes at its eligibility/signal check and
queue insertion. Set first excludes expired records, then commits success for
all eligible manual-reset waiters or at most one auto-reset waiter. Manual Set
also retains the signal bit; auto Set consumes the bit for an assigned waiter,
or retains it if none are eligible. Consecutive Sets can assign distinct pending
auto waiters; without waiters the bit still coalesces. The current insertion
order selects an auto waiter, but no cross-process arrival fairness is promised.

`settle` only transitions `pending` records. It removes the record from the
event's queue and clears its event pointer. Reset touches only the event signal
bit. Status returns the recorded state, with no second acquire or re-arming.
Repeated status calls return the same terminal result even after Reset, expiry,
handle closure, or recreation of the same name. They do not consume a newer
signal. Integration must still complete its guest frame exactly once; repeated
observation of a result is not permission to complete multiple guest waits.

Cancellation serializes against Set and expiration. Before assignment it returns
`cancelled` (or `timed-out` if expiry already won) and removes queue membership.
After assignment it returns `signaled` unchanged. **It does not refund a signal,
transfer the wake to another waiter, or pretend cancellation won.** A caller
abandoning a successful result forfeits that already committed auto wake. This
is an explicit limitation, not a recoverable signal ledger.

Closing the exact reference used for registration cancels its pending waits,
even if another reference to the same generation survives. Closing a different
reference does not cancel them. Terminal results survive either close. Pending
waits therefore never pin an event beyond its issuing reference; final reference
close deletes the name as before. Recreate obtains a new generation and new
handles; retained old results cannot acquire from that replacement. This
reference-specific cancellation policy is not a claim about native Windows
CloseHandle-during-wait semantics.

Explicit shutdown cancels pending waits, releases references, and drops all
results before acknowledgement, even if the socket remains connected. EOF does
the same eventually. Before the authority observes EOF a disconnected client's
registration may still win a racing Set; the committed wake is not refunded.
Tests separately cover disconnect before and after assignment. A live stalled
client keeps its references and terminal result quota; there is no heartbeat
or result TTL that silently forgets an unobserved success.

## Bounds and cleanup

Pending waits and retained terminal results share limits of **256 per session**
and **4096 across the authority**. ENOSPC is explicit and leaves signal state
untouched. `forgetWait(waitId)` releases a terminal result; on a pending wait it
returns EBUSY. First cancel and inspect the returned state when abandoning a
pending wait. Forgotten, stale, or other-session IDs return EBADWAIT for all
three result operations. Forget is an explicit deletion, not an idempotent
acknowledgement protocol; never replay it after unknown transport outcome.

There is no unbounded timer or notification queue per waiter. The one timer
and per-request sweep scan at most 4096 records; event queues contain only
pending records. Terminal records retain a handle string, deadline and state,
but no event pointer. Result retention does not prevent event generation
reclamation. Existing 4096-event, 4096-reference/session, 128-connection, 16KiB
frame and 1024-byte-name limits remain. No new dependency is introduced.

## Failure and durability boundary

Durable here means retained through later Set/Reset/status/close operations in
the **live authority session**, until explicit forget or session cleanup. It
does not mean disk persistence, reconnect recovery, or survival of authority
death. There is deliberately no registration replay/deduplication on a new
session. Calling register twice intentionally creates two distinct waits.

Existing ETIMEDOUT/ECONNECTION poisoning remains unchanged. A failed registration
can already have acquired a signal or enqueued a wait; a failed Set can already
have assigned one or many wakes; a failed status can hide an already committed
result; a failed cancel/forget can already have committed. All are unknown
outcomes, never proof of rollback. Bridge termination eventually triggers EOF
cleanup, but cannot undo a committed auto wake. Subsequent calls return ECLOSED;
no reconnect, retry, mirrored acquisition, or replacement authority is allowed.
Owner failure loses the namespace and pending/results together.

## Acceptance evidence

Run `node test/test-named-event-wake-reservation.js`. Eight groups cover actual
forked registrations, manual pulse broadcast, 24 two-process auto races,
immediate/persistent state, idempotent retrieval with a second signal waiting,
late registration and no-poll expiration, predeadline assignment retained past
expiry, invalid/foreign clocks, cancel-before/after, repeated Set, ownership,
partial/final close and recreation, SIGKILL before/after assignment, connected
shutdown, bridge/authority loss, and all 4096 pending plus retained result slots.
Exhaustion is checked before acquisition; forget, EOF and shutdown reclaim slots.

`run-tests.py` in the evidence directory runs **19 commands with expected exits**:

| Evidence | Result |
| --- | --- |
| New provider suite, unchanged production clock | 8 groups pass |
| Isolated deterministic authority-clock copy | Set at deadline −1ns succeeds; equality/+1ns expire and preserve signal |
| Exact original provider + explicit polling adapter | Assertion rejection; manual and auto both report two pending waits after Set–Reset |
| Seven behavioral mutations | Each rejected by assertion: erase reserved wakes, auto broadcast, status double-consumption, cancellation refund, missing close cancellation, missing expiration, equality treated as eligible |
| Three committed-wake transport faults | Withheld registration reply, disconnected registration reply, withheld status reply all preserve committed consumption and poison without replay |
| Original authority progress/full suites | Pass, including 40 subprocess zero-acquisition races |
| Original independent-authority control | Required assertion rejection with two winners |
| Existing independent authority suite | All seven groups pass |
| Existing independent lost-Set-reply faults | Both timeout and disconnect modes pass |

The clock copy changes only the time source and adds a test-only `__tick` request;
production has no clock injection API. Fault/mutation providers are isolated
copies selected by PROVIDER; historical test/evidence files are unchanged.
Expected assertion failures are discrimination evidence, not passing production
executions. Native OS event behavior is not used as an oracle in these tests.

## Integration and recovery

Future integration must replace finite-path `acquire` polling with one owned
registration, maintain `{session, handle, generation, waitId, deadline}` identity
per guest continuation, inspect the immediate registration state, yield while
pending, then retrieve only that result. Preserve unsupported-path guards before
registration. Do not time out locally and discard a possible committed wake:
resolve authority status/cancellation first, cache exactly one guest completion,
and explicitly forget terminal results. Terminated threads must cancel and
forget without refunding assigned signals. Process teardown must close sessions.
Map ENOSPC, EBADWAIT, cancellation, and unknown transport outcomes explicitly.
Keep one namespace endpoint across children; retain all stale-generation checks.
Resolve the caller-entry deadline limitation above and add actual CLI/main/Worker
continuation, cross-process pulse, scheduling, termination, and no-replay tests.
Register the new test with the project's test tiers during integration. Until
that work is independently accepted, the finite API blocker remains in place.

Evidence directory: `scratch/runs/20261020-named-event-wake-reservation-oct20/`.
It contains measured projection/protected metadata, source seals, tests.json,
logs, isolated variants, reproducible run-tests.py, verification, receipt,
change.patch, commit.patch, and SHA256SUMS.json. Recovery: restore the exact base,
apply commit.patch, then run the provider suite and recorded commands. Patches
do not back up the borrowed base object stores. Narrow sparse projection was
configured before materialization; flattened alternates are read-only inputs.
Prewrite checks enforce allocation below 16MiB and available bytes above the
fixed 2285895680 floor. Shared/supplied HEAD-index-config and projected historical
inputs are checked unchanged. No workers/refill, runtime403, Boat, SSH, browser,
fullbuild, auth/trust/publication retry, laptopHeroesII/WarcraftIII, historical
WIP, main, integration, or deployment changes. **NO REMOTE BACKUP.**
