# Independent caller-entry acceptance — 2026-10-20

**ACCEPT exact `32876c2596213d82e4ad074b37fe19bb18400b72` for its documented,
qualified standalone `waitClock({ callerEntry: true })` contract.** No scoped
production defect was found. This is not acceptance of finite Windows API
semantics, native Windows parity, CLI wiring, arbitrary Node versions, or a
strict options schema. Review changes only this report and NEW
`test/test-named-event-caller-independent.js`. Production is unchanged.

## Independent findings

The deadline starts at the first `process.hrtime.bigint()` read inside
`waitClock`, following JS parameter evaluation/destructuring. The read precedes
procfs/domain lookup, bridge work and transport. It is not a claim about time
spent evaluating arguments, option getters, client construction, or an unwired
guest API. New adversarial tests insert 180ms into the caller's procfs read,
through both an actual forked subprocess and Worker, then register a 50ms wait.
Both expire and preserve the auto-reset signal. A mutant moving the read after
domain lookup fails with `signaled` instead of `timed-out`. This exercises an
entry-placement risk not covered by the submitted transport-delay tests.

Inspected the sealed Node JS wrapper, fast binding header and C++ implementation:
`HrtimeBigIntImpl` returns raw `uv_hrtime()`, without subtracting process startup.
The sealed bundled libuv core selects `UV_CLOCK_PRECISE`; Linux takes
`CLOCK_MONOTONIC`, returning integer nanoseconds. Bundled core/Linux sources
match the separately sealed libuv 1.52.1 files. The sealed Linux 6.8 sources show
the monotonic getter plus current time-namespace monotonic offset. Matching live
boot and calling-thread namespace, stable throughout each peer's lifetime, are
necessary qualifications. `/proc/thread-self/ns/time` checks the executing
thread. Causal clock brackets in the focused replay cover real subprocess and
Worker peers; they are sanity checks, not proof of zero clock offset. The
source-defined common timescale is the justification.

Execution is Linux x86-64, Node 24.18.1/libuv 1.52.1; Node binary hash matches the
candidate receipt. No alternate namespace was created. Unsupported platform,
Node version, libuv version, malformed/unavailable procfs and foreign domain
controls reject. These controls do not qualify other actual runtimes. Trusted,
unmodified local peers and stable namespace are assumptions: spoofed versions,
hostile procfs, clock shims, namespace switching and socket forwarding remain
outside acceptance. No suspend-inclusive wall-time claim is made.

Authority conversion subtracts its actual startup `origin` once and checks the
caller sample is within `[origin, current observation]`. New real-transport
checks recover an identical origin from two stamp pairs, reject a pre-origin
sample and future sample, and re-submit an aged valid sample: its relative tick
is unchanged and it expires without consuming a signal. Foreign epochs and
malformed relative stamps reject. Future/stale validation is not an elapsed-time
estimate and cannot replenish the budget. Exact relative expiry is
`entry + timeoutMs * 1000000n`; equality expires.

An exact echo of caller tick AND domain is required. New authority-copy controls
corrupt just the echoed tick, just the domain, or omit the acknowledgment;
all fail `ECLOCKSCOPE`, then allow an explicit legacy wait to succeed. Mixed
old-authority/new-client replay rejects silent fallback, and its fallback mutant
fails. A NEW actual old client, loaded from the exact parent provider, registers
against the new authority and receives a reserved Set–Reset wake. The legacy
no-argument API retains its authority-observation deadline, including its known
inbound-delay limitation.

## Inputs, failures and limits

New wire tests reject null/boolean/numeric/empty/negative/fractional/whitespace/
exponent/oversized tick representations, future/pre-origin samples, foreign
domains, malformed registration stamps and invalid finite budgets. Explicit
validation errors leave the client usable and preserve the signal. Aged valid
stamps remain legal; they produce terminal timeout results. Sequentially
registering/forgetting 260 such results checks cleanup beyond the per-session
256-result quota. Existing unchanged result/session lifetime and quota evidence
is reused, not represented as newly rerun broad coverage.

**Options are permissive, not schema-validated.** `waitClock(null)` raises a
local TypeError. Primitives, unknown keys and falsey `callerEntry` values use the
legacy path; truthy values opt in. The tests record this behavior rather than
claiming malformed options are all rejected. Consumers must use the documented
literal `{ callerEntry: true }`; a typo can select legacy timing. Strict schema
validation would be a separate API-hardening assignment. Option getters also
run before the entry read. Neither behavior invalidates the explicitly scoped
first-read contract, and neither is accepted as a future guest-entry contract.

Reviewed unchanged `_call`, bridge and cleanup paths. Transport timeout or loss
poisons and terminates the bridge; no reconnect/retry/replay path was added.
Focused lost-clock-reply replay verifies `ETIMEDOUT`, `ECLOSED` on further calls,
and preservation of both existing and newer signals. Explicit clock rejection
does not poison: clock sampling acquires no event or reservation, and compatibility
errors have a known outcome. Sealed parent changed-provider opt-in fault evidence
for register/Set/status/cancel/forget and unchanged authority lifecycle evidence
is retained and reused.

## Executed evidence and negative controls

Evidence root: `scratch/runs/20261020-named-event-caller-independent-oct20/`.

* `focused-replay/results.json`: all 15 submitted focused commands independently
  replayed against the exact candidate, including the exact old provider.
  Old inbound 180ms/50ms reproducer succeeds at 181.536ms and is rejected by the
  caller-budget assertion. Candidate inbound, clock-response and registration
  delays time out at 184.455ms, 183.993ms and 181.999ms, preserving the signal.
  A registration reply observed at 182.071ms retains predeadline success.
* The focused controlled-clock fixture tests both Set and immediate registration
  at deadline -1/equal/+1 nanoseconds, plus later observation. Its extension
  mutant fails at equality (`signaled` versus `timed-out`); early-expiry mutant
  fails at -1 (`timed-out` versus `signaled`). These are behavioral failures,
  not parse/startup failures. Domain acceptance and silent-fallback mutants
  also fail their assertions.
* `independent-sealed/results.json`: eight final NEW commands with expected
  exits: real subprocess/Worker domain-lookup delay, malformed-input/cleanup,
  qualification, rejecting late-entry mutant, three acknowledgment corruptions,
  and actual old-client compatibility. All seven non-mutant commands exit zero;
  the deliberately wrong entry placement exits one with the intended assertion.
* `verification.json`: verified all 289 candidate artifact seals and nine source
  blobs at exact candidate; also all 80 parent-review artifacts and 12 source
  blobs at exact `6eb85ae797552c7c39930b8fb554bc8150903ba9`. Source-chain downloads
  and historical results are retained read-only. Broad unchanged suites were
  not redundantly replayed. Candidate diff confirms reservation, expiry,
  cancellation and bridge implementation did not change.

An initial independent mutation accidentally added a second domain lookup
instead of moving it. It remained correctly expired and the harness rejected
the expected-exit mismatch. That run is retained in `independent/`; corrected
seven-case run in `independent-final/`; final eight-case run is
`independent-sealed/`. No unsuccessful development evidence was overwritten.

## Remaining gates and recovery

Pre-registration pulses remain unreserved. Neither kind of clock request
registers interest. Set–Reset before the authority registration turn can be
missed; this is not repaired or waived. The authority's request sample is the
registration linearization point within a synchronous turn. Eligibility, not
RPC return latency, is bounded; assignment before expiry survives observation
after expiry. Guest entry must still be defined and instrumented, including the
guest-entry-to-registration gap. Integration must own one registration per
continuation, preserve single completion and thread/process lifetimes, resolve
status/cancellation before local expiry cleanup, forget terminal results and
map errors/ENOSPC. Infinite/multiwait/nested unsupported paths must fail before
acquisition. CLI main/Worker/subprocess routing, producer progress, Set–Reset,
close/recreate, termination, ambiguous outcomes and test-tier registration remain
gates. No Windows oracle or additional platform qualification is claimed.

Fresh isolated sparse branch `task/named-event-caller-independent-oct20` starts
at the exact candidate. Pre-checkout projection: 63,241 bytes; initial free
space: 3,666,018,304 bytes. Fixed free floor: 2,285,895,680 bytes; allocation:
16MiB. Flattened alternate views expose borrowed objects read-only; retain those
stores for recovery. `receipt.json`, `source-seals.json`, `SHA256SUMS.json`,
`change.patch` and `commit.patch` seal final checks and local review commit.
Shared/supplied HEAD, index and config remain unchanged.

To replay, use a fresh evidence directory and run this NEW test with
`EVIDENCE_DIR` and `OLD_PROVIDER` pointing to the exact parent provider; repeat
the candidate's focused test with separate fresh evidence. Preserve both
borrowed base objects and local patches. Do not overwrite historical runs.

Publication remains held: **NO REMOTE BACKUP**. No production repair, CLI wiring,
main integration, push, deployment, workers/refill, Boat/SSH/browser/fullbuild,
auth/trust retry, laptop game or Claude changes. This bounded review stops here.
