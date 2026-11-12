# Callback token allocator concurrency — 2026-10-21

## Snapshot correction (supersedes original preservation claims)

Independent review `4b0dbb5d25e9ac6710bd9ba822cac1000261ac0a` rejected
candidate `f8f9785c99cf121cca22ca7c1560903a5e403005`: its three whole-memory
before snapshots aliased shared memory. The original PASS runs below did **not**
establish whole-memory preservation. The per-owner copied snapshots and the
accepted extraction/ownership findings remain valid.

The corrected test copies bytes at all three sites through one `preserved`
helper. New controls run the actual production scenario and comparison at
overflow/mismatched leave, stale-owner rejection, and all-exhausted barriers.
Each flips the shared serial after the rejected rounds: the copied snapshot
rejects it, while switching only the snapshot to the original alias incorrectly
accepts the identical mutation. Restoration occurs after comparison. Whole-memory
checks remain confined to quiescent/all-rejected phases; mixed contention keeps
the original per-owner checks so legitimate other-owner writes are allowed.

Corrected validation passes the four-worker production case (2,035 unique
roots/children, seven terminal allocations and 25 rejections), the original
CAS/overflow controls, all three preservation controls and their alias false
accepts, and the existing token regression. Each injected preservation failure
unwinds through pool cleanup; all four thread IDs are -1 after termination,
observed in 1.95–3.76 ms against the 15-second bound. This demonstrates cleanup
for these parent assertion failures, not every possible worker hang/failure.

Commands, logs, admission and correction details are in
`scratch/runs/20261021-callback-concurrency-snapshot-fix/`. Original rejection
evidence remains unchanged. No production allocator/API/SEH or jump-lock change;
no Windows/gameplay claim. The correction branch awaits independent acceptance
and is not merged to main. The remainder records the original scope and results,
with preservation claims and validation counts superseded by this section.

For NEW-GAME-CIRCUS-LINUX-20261018 / NEW-GAMES-PIPELINE, the previously
unexercised OS-worker allocator prerequisite now has a source-only regression:
`test/test-callback-invocation-concurrency.js`. No production correction was
needed. Baseline is exact remote main
`bc53c1d1cbd1da82f44835cda31e193a52a63aa8`; the read-only accepted-ledger
checkout had that HEAD but a stale `origin/main` at `59296360…`. The isolated
task repository records the verified remote main. Existing token and lifecycle
tests on that baseline use serial instance calls and do not close this gap.

## Preconditions and exercised behavior

The positive module extracts the complete delimited production ownership block
from `src/04-cache.wat`, unmodified, and compiles it with the vendored WATX
compiler. Only memory placement, thread-ID configuration and observation
exports are fixture wiring. Actual audio-host process/thread lifecycle imports
are used. Four distinct Node `worker_threads` instantiate that same module
against one shared `WebAssembly.Memory`; each owns a different slot (1–4).
The parent owns slot 0. No slot has concurrent executors.

Every phase waits for all workers to reach a shared-atomic release barrier.
Completion acknowledgements establish quiescence before parent memory writes,
process replacement, or the next phase. Slot replacement runs only after its
old owner has stopped executing. No process reset races active token calls.
This qualifies allocator concurrency under these ownership rules, not
concurrent lifecycle replacement.

- Concurrent vacant-slot bootstrap joins one nonzero epoch.
- Eight waves allocate 63 children per owner, retaining all children until
  every worker has completed allocation. A global set rejects zero and any
  repeated issued root/child, including identities from already retired waves.
- Overflow and incorrect expected-token leave trap with unchanged owner
  bytes/globals; complete all-rejection phases preserve the entire memory.
- Valid LIFO leave restores the root. Quiescent slot replacement allocates a
  fresh root and rejects the stale instance. Quiescent process replacement
  changes epoch/root, rejects old workers, and permits fresh slot ownership.
- With every worker parked, fixture injection sets the serial to `UINT64_MAX-7`.
  Thirty-two contending attempts admit exactly seven unique identities and
  reject 25. Every rejected attempt preserves its owner's state; other owners
  may legitimately change the shared allocator concurrently. A subsequent
  all-rejected phase preserves the entire memory and terminal serial. Valid
  leave still succeeds, but retiring tokens does not replenish serial capacity.

Each production run checks 2,035 unique roots/children, plus epoch/main-root
checks. The positive module has no scheduling hook inside the allocator;
barriers coordinate entry, not a simulated single-thread schedule. The test
does not assert any particular scheduler fairness or CAS retry count.

## Rejecting controls and bounds

Two test-only mutations are separately compiled from the same extracted block.
Replacing compare-and-swap with load/store, with a rendezvous after the read,
forces all four workers to issue the same live child. The same freshness oracle
used by the production case rejects it. Removing the terminal guard permits
wrap through zero; the same exhaustion oracle rejects it. Exact single-match
mutation assertions prevent silently testing an unmodified control. Neither
mutation is written to production source.

Every worker barrier and parent phase has a 15-second deadline. The pool
terminates all workers in `finally`, including on errors, with a 15-second
termination deadline. Recorded shell runs have an additional 90-second bound.

## Validation and recovery

On Linux x64, Node v24.18.1 / V8 13.6.233.17-node.50:

```sh
node --check test/test-callback-invocation-concurrency.js
timeout 90s node test/test-callback-invocation-tokens.js
timeout 90s node test/test-callback-invocation-concurrency.js
git diff --check
```

Syntax and existing token regression pass. Three repeated final concurrency
runs pass, each rejecting both unsafe controls. Logs, admission, protected-file
hashes and publication receipt are retained at
`scratch/runs/20261021-callback-token-concurrency/` in the shared host repository.
No build artifact is required or produced. For sparse recovery, materialize the
exact file closure listed in `admission.json`, plus this test and report. It
includes four vendored compiler stages and the three audio-host dependencies;
there is no package install or source-tree build. The regression uses the
default unit-test filename tier convention.

No canonical build, production-artifact lifecycle rerun, browser/game execution,
download, box operation or deployment was performed. This does not establish
Windows jump conformance, retained expected-token coverage, SEH behavior,
deferred/JS/timer/wave/APC ownership, or Circus gameplay. The nonlocal-jump review
lock and disabled setjmp/longjmp are unchanged. Previously accepted native API
work is outside this task. Independent acceptance and integration remain
coordinator-owned; the task branch is not merged to main.
