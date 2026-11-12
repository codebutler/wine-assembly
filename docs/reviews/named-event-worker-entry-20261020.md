# Worker entry consumer boundary — blocked, no production repair

Exact base `41f4375fd762df23a048a7718599481ccfd5683c`; local branch
`task/named-event-worker-entry-oct20`. **The requested transport prerequisite is
NOT IMPLEMENTED or accepted.** Only this report and a new diagnostic are changed.
The original reproducer and accepted provider are unchanged.

## Concrete scope constraint

The existing consumer has a second constraint beyond the missing RPC entry
timestamp. `ThreadManager.waitSingle` calls `NamedEventClient.acquire` before
parking; `_resolveAuthorityWait` subsequently checks a local performance clock
and calls the same zero-time acquisition. `acquire` accepts only a handle and
does not enforce an entry deadline. The caller-entry `waitClock` wire operation
validates and translates a timestamp, but deliberately accepts an aged timestamp:
only the later `registerWait(handle, timeout, clock)` applies its deadline.

Consequently carrying a timestamp into these consumers and validating it does
not suffice to reject the existing late success. Even checking expiry at the
broker or on a separate authority request leaves an interval before acquisition
in which the budget can expire. Translating it to a fresh local deadline would
also violate the requested no-conversion/no-replenishment constraint.

The existing deadline-aware consumer operation is `registerWait`. Replacing
acquisition with it requires deciding ownership of pending reservations,
continuation status, cancellation, terminal forgetting and teardown. That is
the expressly deferred reservation/lifetime integration. A new atomic
deadline-aware non-reserving acquire would instead change the accepted provider
contract; no provider defect justifies that change here.

This is a blocker to **end-to-end deadline acceptance with the unchanged
consumer**, not evidence that timestamp transport itself is intrinsically
impossible. A dormant transport could be implemented independently, but would
not repair the demonstrated production behavior. This task does not claim such
a dormant feature as a tested repair, nor implement a partial reservation
scheduler or silently fail all previously working finite waits.

## New evidence

`test/test-named-event-worker-entry-boundary.js` retains the actual Node Worker,
`createWorkerImports`, `createMainBroker`, extracted unchanged `test/run.js`
per-thread adapter and actual ThreadManager/authority consumer. It uses an
explicitly **diagnostic sideband sample immediately before the import**, not
production host-entry capture. It does not claim invocation transport, version
negotiation, shared ABI safety or full VM coverage.

Two probes use exact decimal integer nanoseconds from the qualified Linux
Node 24.18.1/libuv 1.52.1 clock and matching boot/thread-time namespace:

* With 180ms delay before validation, the authority echoes the exact expired
  timestamp; the production CLI adapter still returns success and consumes
  the auto-reset signal for a 50ms wait.
* With delay after validation, validation occurs about 4.035ms after entry in
  the recorded run, and acquisition is attempted about 187.304ms after entry.
  The unchanged adapter again succeeds. The test asserts that this fixture's
  validation preceded expiry, so it cannot pass by merely reproducing the
  already-expired first case.

Both probes re-submit the same aged timestamp and assert identical translated
stamps (no budget replenishment), reject a foreign domain, then separately
re-signal and use `registerWait` with the exact sample. That operation returns
`timed-out` and leaves the signal intact. Each diagnostic reservation is
forgotten and the handle and Worker are cleaned up. Existing authority process
exit cleanup remains in effect. These are trusted local peer tests, not a
qualification of another platform, namespace or Windows behavior.

Four commands in `tests.json` have their expected exits:

1. Unmodified original reproducer: exit 0, old behavior reproduced, 190.301ms
   production result and 185.995ms broker-provider near miss.
2. Original `--require-entry-budget`: exit 1 at late-success assertion.
3. New consumer-boundary diagnostic: exit 0, both probes reproduced.
4. New `--require-entry-budget`: exit 1 at the intended 0 versus 258 assertion.

Passing diagnostics are **not acceptance**. No actual entry transport,
concurrent invocation ownership, stale-metadata protocol, mixed-version
handshake, dropped-metadata/late-capture negative controls, repeated-call/zero
or non-wait compatibility acceptance were implemented. No ABI changed, so no
ABI/build static gates were represented as executed. No full interpreter/PE,
browser, game or native Windows run occurred; register exports are fixtures.

## Preservation and remaining gates

The fresh isolated sparse repository projects 6,621,051 bytes from the exact
base, measured before writes with 3,639,730,176 bytes free. Allocation is 32MiB;
the fixed free floor is 2,285,895,680 bytes. Flattened alternate views borrow
objects without nested alternates. Shared/supplied HEAD, index and config are
sealed and checked; all materialized base source blobs remain unchanged.
Evidence root: `scratch/runs/20261020-named-event-worker-entry-oct20/`.
It contains projection, logs, test exits, preservation checks, patches and
seals. Preserve borrowed object stores along with patches for recovery.

Remaining work includes the requested production entry capture/transport and
all its listed acceptance gates, followed by full reservation/lifetime
integration. The entry-to-registration gap remains unreserved; Set–Reset
within it may be missed. No Windows parity is claimed. The coordinator owns
scope decisions and successors; this single-task worker stops at this boundary.

No main integration, push, deployment, workers/refill, Boat/SSH/browser/full
build, runtime retries, auth/trust bypass, laptop game or Claude changes.
Publication held: **NO REMOTE BACKUP**.
