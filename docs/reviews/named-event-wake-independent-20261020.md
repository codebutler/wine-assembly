# Independent named-event wake reservation review — 2026-10-20

**Verdict: ACCEPT the standalone, authority-stamped provider scope at exact
`26440fa1ed3e1a4bc0301bc103e694b77d0529de`. Finite Windows API acceptance remains
BLOCKED.** No additional production defect was found within the documented
provider contract. The timing and integration limitations below are unresolved
requirements, not waived requirements. No Windows oracle, complete CLI/PE,
fullVM, browser, game, or native conformance claim is made.

Local review branch: `task/named-event-wake-review-recovered-oct20`, based directly
on the candidate. Only NEW `test/test-named-event-wake-independent.js` and this
report are owned/committed. No production repair or CLI wiring. The final local
commit is in receipt.json and the append-only board. **NO REMOTE BACKUP.**
Publication remains held on previously reported HTTPS credentials / SSH host-key
failure; neither was retried. No main integration or deployment.

## Evidence and independent execution

Evidence root: `scratch/runs/20261020-named-event-wake-review-recovered-oct20/`.
The supplied receipt, report, protocol implementation, test harness and runner
were inspected. All **10 source seals and 43 supplied artifact seals** verified.
Candidate provider SHA-256:
`64766be7aadb12be60a0c9492c71120b706a184ea7456686f0266a39e38c5ebb`.
Source seals are also checked against exact candidate Git blobs, not only files.

`python3 run-tests.py` replays all **19 supplied commands**, with each expected
exit and all expected negative exits required to contain AssertionError. These
include the eight production groups, 24 two-subprocess auto races, full original
authority regression/independent suites, deterministic boundaries, seven
behavioral mutations, lost/disconnected registration replies, lost status reply,
and the prior lost/disconnected Set reply checks. No historical artifact is
overwritten: the runner and its outputs live under this new evidence root.

`python3 run-independent.py` executes **22 additional commands** against the NEW
test. Commands, environment, elapsed time, provider hash and exact results are in
`independent-tests.json`; full output is in `logs/independent-*.log`.

| New executable evidence | Result |
| --- | --- |
| Production, five groups | Pass: actual subprocess plus actual Worker share one authority; manual broadcast/auto single consumer, repeated Set, terminal idempotence, reference identity/ownership, cancellation, expired/foreign stamps, stamp-only gap, duplicate registration, repeated quota reclamation |
| Deterministic clock provider | Pass: both Set eligibility and immediate registration at deadline −1ns/equal/+1ns; old terminal result remains unchanged after deadline |
| Exact baseline with explicit acquire polling | Required assertion rejection: **both** manual and auto report `[false,false]` after Set–Reset |
| Five committed-operation reply losses | Pass: registerWait, Set, waitStatus, cancelWait, forgetWait timeout, poison, and do not replay against a newer signal |
| Three transport-delay copies | Pass: inbound clock delay is excluded; clock response and registration delay count against the stamped budget |
| Four new behavioral mutants | Required assertion rejection: retained per-session slot after forget, foreign epoch accepted, closing one reference cancels unrelated waits, missing poison after ambiguous reply |
| Seven supplied mutants under NEW test | Required assertion rejection: reset erases reservations, auto broadcast, status double-consumption, cancellation refund, missing close cancellation, missing expiry, equality eligible |

The baseline adapter explicitly performs the old scheduler-style acquire at
entry and acquire again at observation; it does not pretend that baseline has
registration methods. Both missed-pulse cases run before the joint assertion,
so failure of the first cannot hide the second. On the candidate the same pulse
schedule yields two manual successes and exactly one auto success, even when
the waiters are a forked process and a Worker. This is provider-level replay of
the original missed-wake schedule, not a complete CLI execution.

The first independent pass exposed a test weakness: the refund mutant survived
because a newer signal was already present. The test now cancels an assigned
wait while the signal bit is empty and asserts it stays empty, before testing
newer-signal preservation. `independent-tests-first-pass.json` preserves that
development observation; final logs/records come from the corrected test. An
early inline guard invocation also failed from a Python path/string error before
any write; the standalone guard immediately passed. Neither is a provider defect.

## Protocol findings

I independently inspected the production transitions. One authority Worker
serializes each request without awaiting. `expire(tick)` runs before each
authenticated operation using one authority time sample. `settle` only changes
pending records, removes event queue membership and clears the event pointer.
Set records success for all pending manual waiters or one auto waiter, while
Reset changes only the signal bit. Terminal status does not acquire again.
This is the essential correction for the reproduced missed pulses.

At `now >= expires`, expiry wins. The isolated clock copy substitutes the clock
source and adds a test-only tick request; it retains real client bridges,
authority Worker and socket protocol. It deterministically exercises −1/equal/+1
nanoseconds without claiming physical nanosecond scheduling precision. The
equality mutant is rejected. Expired immediate registration does not consume an
existing signal, and a predeadline committed result remains signaled after
deadline, reset, close and recreation. Foreign stamps and foreign-owned handles
or result IDs fail explicitly.

Before assignment, cancel removes queue membership and returns cancelled (or
timed-out if expiry won). After assignment it returns signaled and does not
refund. Reference close cancels only its own pending waits; another reference's
wait remains eligible. Terminal results survive final close without pinning the
event; recreation has a new generation and old status cannot consume its signal.
Supplied replay verifies SIGKILL/EOF before and after assignment using private
reference disappearance as the cleanup barrier, plus shutdown with the socket
still connected. EOF races before cleanup can still assign a wake; there is no
refund on later cleanup. This is documented behavior, not native CloseHandle
qualification.

Pending and terminal records share 256/session and 4096/global limits. Supplied
replay fills both global pending and terminal capacity, verifies ENOSPC before
signal consumption, then reclaims via forget, EOF and shutdown. NEW tests fill
256 immediate terminals and explicitly forget/reuse capacity through three fresh
sessions. Cancel alone does not release a retained result; pending forget is
EBUSY, and forgotten IDs are EBADWAIT. The new forget-leak mutation is rejected.

Bridge timeout/disconnect is an ambiguous outcome. The client becomes closed and
terminates its bridge, with no automatic reconnect/replay. NEW fault copies drop
one reply only **after** the selected operation commits, so these are not simple
pre-operation transport failures. They verify ECLOSED on the next call and
preservation of a newer externally supplied signal. Supplied replay separately
covers disconnected replies and authority/bridge death. Durability is limited
to the live authority/session; there is no restart recovery or refund ledger.

## Scope limitations and reproducible integration blockers

**Caller-entry timeout is NOT solved by authority-stamped time.** Run
`run-independent.py` and inspect `independent-delay-inbound-clock.log`: an
isolated provider delays clock request processing 180ms before sampling time.
The caller requests 50ms, yet registration can return signaled after roughly
181ms from caller entry. In contrast, delaying the clock response 180ms or
delaying registration 180ms produces timed-out and preserves the signal. These
are actual Worker/socket executions with deliberate transport/processing delays,
not source-pattern assertions. Exact measured durations are in the logs.

The stamp is opaque authority epoch/tick data, not a local process clock epoch.
A stamp alone registers no interest: NEW production tests take a stamp, Set and
Reset, then register; that wait is pending. Two registrations with the same
stamp get distinct IDs and may consume two Sets. They are not deduplicated RPC
retries. Consequently, neither early clock acquisition nor repeating an
ambiguous registration closes the caller-entry or pre-registration pulse gap.

These limits are accurately documented by the candidate and are acceptable
only for its explicitly narrower standalone contract. They would be defects
if exposed as an accepted finite Windows wait contract. Conservative elapsed
duration subtraction may avoid late expiry but can expire early; it is not an
exact solution and is not accepted here. Clock suspension semantics, trusted
local transport, nonpersistent results and deliberate forfeiture of assigned
wakes on abandonment likewise remain documented scope limits.

Required integration gates:

1. Establish and independently validate the caller-entry deadline and
   registration/transport linearization contract, including delayed clock request,
   delayed response, delayed registration, and pulses before registration. Do not
   silently extend or shorten finite timeouts or compare unrelated epochs.
2. Replace finite-path acquire polling with one owned registration. Track session,
   handle, generation, waitId and deadline per continuation; handle immediate
   terminal results, poll only that result, and complete each guest frame once.
3. Resolve status/cancellation before discarding a locally expired continuation;
   explicitly forget terminal records. Test thread termination, process shutdown,
   close/recreate, ENOSPC/error mappings, and unknown outcomes without replay or
   signal refund. Preserve unsupported infinite/multiwait/nested guards before
   any acquisition/registration.
4. Repeat manual/auto Set–Reset, deadline, producer-progress, lifetime and failure
   cases through actual CLI main/Worker continuations and subprocess routing.
   Register tests with project tiers and independently review that integration.
   This review does not authorize integration or assert Windows/native parity.

## Isolation, capacity and recovery

Admission measured 3,695,697,920 free bytes before writes, above fixed floor
2,285,895,680 plus the 16MiB task allocation. The exact candidate's ten-file
110,512-byte sparse projection was measured before materialization. A fresh
standalone Git directory/branch borrows flattened existing object stores only
as read-only alternates; shared and supplied HEAD/index/config are preserved.
Guard checks precede evidence generation/tests/commit writes. Final capacity,
metadata, historical-file preservation, clean status and commit verification are
recorded in `verification.json` / `receipt.json`. Previous stopped reviewer
artifacts are untouched.

Recovery: retain exact candidate and alternate object stores, restore this
review's `commit.patch`, run `node test/test-named-event-wake-independent.js`,
then the sealed replay/independent runners for faults and negative controls.
`source-seals.json`, exact command records, patches and `SHA256SUMS.json` identify
the tested content. Local patches do not back up borrowed base objects. No
runtime/Boat/SSH/browser/fullbuild, workers/refill, denied/auth/trust/publication
retries, main integration, deployment, or laptop game changes were performed.
**NO REMOTE BACKUP.** This bounded review ends after its local commit and receipt.
