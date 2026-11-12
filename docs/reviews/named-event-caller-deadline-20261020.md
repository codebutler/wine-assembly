# Caller-entry deadline repair — 2026-10-20

Implemented a qualified, opt-in caller-entry clock for the standalone provider.
This is not finite Windows API acceptance, CLI integration, or native parity.
Base is exact independent review `6eb85ae797552c7c39930b8fb554bc8150903ba9`,
whose accepted provider is `26440fa1ed3e1a4bc0301bc103e694b77d0529de`.
Local branch: `task/named-event-caller-deadline-oct20`. Only the provider, NEW
`test/test-named-event-caller-deadline.js`, and this report change.

## Exact contract

```js
// First operation at the logical caller wait entry, after client construction:
const stamp = client.waitClock({ callerEntry: true });
const registration = client.registerWait(handle, timeoutMs, stamp);
// Thereafter inspect this registration's result; do not acquire again.
```

The entry instant is the first `process.hrtime.bigint()` read in `waitClock`.
The finite interval ends exactly `timeoutMs * 1000000n` later in that monotonic
clock. All subsequent work counts, including domain lookup, bridge scheduling,
inbound clock-request delay, authority processing, response transit, caller
scheduling, and registration transit. No RTT estimate, elapsed-time subtraction,
rounding, safety margin, or replenishment of the budget is used. Code before the
entry read, including client construction, is outside this interval. An eventual
guest API must place that read at its own defined entry; this patch does not
instrument guest entry.

The new client transmits the absolute local sample and its clock-domain identity.
The authority validates the domain and that the sample is between its origin
and current observation, then subtracts **its actual monotonic origin** once to
produce the existing relative stamp. `registerWait` and all reservation state
transitions are unchanged. Equality expires: `now >= entry + budget`.
Invalid samples fail `EINVAL`; unqualified/foreign clock domains fail
`ECLOCKSCOPE`. There is no fallback to a later authority stamp. The new client
requires an echo acknowledgment of its exact caller sample/domain: an old
authority that ignores the new field is explicitly rejected. This acknowledgment
is protocol capability detection, not cryptographic attestation.

No-argument `waitClock()` retains its authority-observation contract and wire
stamp shape. Old clients still work with this authority; a new client can still
use the legacy path against an old authority. An opt-in stamp adds acknowledgment
metadata, which existing `registerWait` validation ignores. Existing authority
epoch rejection and foreign handle/result ownership checks remain intact.

The budget governs **eligibility**, not a hard wall-clock RPC return bound.
An assigned predeadline wake remains successful if observed after expiry.
Conversely, an expired registration cannot consume an already-present signal.
Transport timeout/disconnection still poisons the client with unknown outcome;
no reconnect, retry, or replay is introduced. A long RPC can return after the
finite budget; its independent `client.timeoutMs` transport guard is unchanged.

Registration linearizes at the authority's per-request monotonic sample in its
single synchronous turn, before expiry/eligibility decisions and insertion into
the wait queue. No other authority request interleaves that turn. Taking either
kind of clock stamp registers **no interest**. A Set followed by Reset before
that registration turn is not reserved; a signal still present at registration
may be consumed only if unexpired. Duplicate registrations remain distinct.

## Why these clocks can be compared, and where they cannot

This opt-in is deliberately gated to **Linux, Node 24.18.1, libuv 1.52.1** with
readable real procfs and matching boot ID plus `/proc/thread-self/ns/time`
identity. It is a trusted local-process contract: use unmodified runtime clock
implementations, a stable time namespace throughout caller/authority lifetime,
and the same live kernel boot. Namespace switching, clock shims, hostile procfs,
spoofed messages/versions, remote socket forwarding and modified runtime builds
are outside the contract. Existing token transport is not a clock attestation
mechanism. Other versions/platforms or missing procfs fail explicitly rather
than guessing. Qualification of more runtimes requires source review and tests.

The justification is source semantics plus causal runtime checks, not a claim
that arbitrary Node clocks have equivalent epochs:

* [Node 24.18.1 process binding](https://github.com/nodejs/node/blob/v24.18.1/src/node_process_methods.cc)
  returns the raw `uv_hrtime()` value in `HrtimeBigIntImpl`; both slow and fast
  bindings reach it. There is no process-start subtraction. The JS wrapper,
  fast binding header and exact bundled libuv sources are sealed with this run.
* [Bundled libuv core](https://github.com/nodejs/node/blob/v24.18.1/deps/uv/src/unix/core.c)
  selects `UV_CLOCK_PRECISE`.
  [Bundled Linux implementation](https://github.com/nodejs/node/blob/v24.18.1/deps/uv/src/unix/linux.c)
  reads `CLOCK_MONOTONIC` and returns integer nanoseconds. The precise branch
  does not use the coarse clock. Its source matches upstream libuv 1.52.1.
* [Linux 6.8 clock implementation](https://github.com/torvalds/linux/blob/v6.8/kernel/time/posix-timers.c)
  obtains monotonic time and applies the current time namespace's offset.
  [Namespace definitions](https://github.com/torvalds/linux/blob/v6.8/include/linux/time_namespace.h)
  show the namespace-owned offset and freezing once joined. Same boot and
  namespace therefore select the same epoch; different namespaces are rejected,
  even if they happen to have equal offsets. Thread-self checks the calling
  thread, not just the process leader. This is the OS monotonic timescale, not
  calendar time; suspend-inclusive wall time is not promised.

Actual execution used Linux 6.8.0-117 x86-64 and Node binary SHA-256
`f3432a45b03b2da0d270095fdd8813dc34cbea73f5fc8b18c7a384b7cf9b333a`.
Each of an actual forked subprocess and actual Worker supplied 12 clock samples
bracketed by coordinator-thread before/after samples; all satisfied causal
ordering. Both also used the opt-in through real client bridges/socket authority,
expired waits without consuming a signal, and exercised manual/auto reservations.
Bracketing is a sanity check, not a mathematical proof of zero offset or an
empirical nanosecond accuracy claim. The source-defined common clock establishes
the contract. No different time namespace was created or privileged operation
attempted; domain mismatch and unavailable-domain paths are executable controls.

## Acceptance evidence

Evidence root: `scratch/runs/20261020-named-event-caller-deadline-oct20/`.

* `timing/results.json`: 15 focused commands with required exits, including the
  old provider's reproduced 50ms success after roughly 181ms inbound delay and
  its rejection by the NEW assertion. New opt-in inbound, response, and
  registration 180ms delays time out and preserve the auto signal. A delayed
  registration response still returns the predeadline committed success.
* Controlled clock copies exercise Set and immediate registration at deadline
  −1/equal/+1ns, late observation, and expired signal preservation through the
  same caller-sample conversion and actual transport. +1ms extension and −1ms
  early-expiry mutants fail behavioral assertions. A foreign-domain acceptance
  mutant and a mixed-version silent-fallback mutant also fail assertions.
* `tests.json` and `independent-tests.json`: all 19 supplied and 22 independent
  commands rerun on the changed provider, with required negative exits. This
  retains ownership/lifetime, manual/auto Set–Reset, original missed-pulse
  baseline rejection, quotas, cleanup, cancellation, poison and no-replay
  evidence. The old no-argument inbound delay limitation remains intentionally
  visible in these unchanged compatibility tests.
* `optin-regressions.json`: seven additional commands use provider copies whose
  default is opt-in, without editing supplied tests. Full reservation and
  independent production groups pass, plus five committed-operation lost-reply
  cases: register, Set, status, cancel, forget. The focused test also drops the
  caller-clock reply and checks poison/no-replay and preserved/newer signals.
* `parent-seal-verification.json` verifies all 80 supplied artifact seals and 12
  committed source seals. Unchanged supplied evidence remains authoritative for
  its original scope; it is neither overwritten nor presented as this patch's
  changed-provider execution.

Development evidence is retained: the first extension mutant reached EINVAL
before the behavioral assertion, so controlled registration was advanced 2ms
to make the faulty stamp syntactically admissible and test the real boundary.
The first extra opt-in fault harness dropped every Set response, including the
observer's later Set; it was corrected to drop one committed reply, matching the
sealed harness. Pre-acknowledgment executions are under `before-ack/`; final
execution is against the acknowledgment-checking provider. These harness issues
are not hidden as passing acceptance results.

## Remaining integration gates and recovery

CLI/guest wiring is unchanged. Still required: define the actual guest entry
and registration linearization contract (including the unreserved pre-registration
window); own one registration per continuation; map errors/ENOSPC; resolve
status/cancellation before local expiry cleanup; forget terminal results;
preserve single completion and thread/process lifetime semantics. Unsupported
infinite/multiwait/nested paths must fail before acquisition. Actual CLI main,
Worker and subprocess routing, producer progress, Set–Reset, termination,
close/recreate and ambiguous outcomes need integration acceptance and tier
registration. Stock runtimes beyond the narrowly qualified clock scope need
their own qualification. None of these gates is waived by this repair.

Fresh independent sparse Git repository uses flattened read-only alternate
stores, based exactly on the review commit. Initial projection was 86,446 bytes;
the additional unchanged independent authority test was measured at 6,695 bytes
before materialization. Fixed free floor is 2,285,895,680 bytes, allocation
16MiB. Final metadata/history/capacity checks and local commit are in
`receipt.json`; exact sources/artifacts are in `source-seals.json` and
`SHA256SUMS.json`. Patches preserve this change; borrowed base object stores must
also be retained. No shared/supplied HEAD, index or config is changed.

Reproduce using `node test/test-named-event-caller-deadline.js` (set
`OLD_PROVIDER` to the exact supplied provider and `EVIDENCE_DIR` to a fresh
directory to include the old-provider/mixed-version controls), followed by the
sealed `run-tests.py`, `run-independent.py`, and `run-optin.py` in a recovered
evidence root with its `repo` checkout. Existing artifact paths in those runners
are local; do not overwrite historical evidence when replaying.

No workers, queue refill, runtime/Boat/SSH/browser/fullbuild, main integration,
deployment, laptop game work, Hock changes, or publication/auth/trust retries.
HTTPS credentials / SSH host-key publication hold remains unchanged.
**NO REMOTE BACKUP.** Local commit, patches and sealed receipts only. Task stops
after this bounded result; further assignments belong to the coordinator.
