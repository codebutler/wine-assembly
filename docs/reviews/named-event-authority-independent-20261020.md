# Independent named-event authority review — 2026-10-20

**ACCEPT exact `5bcb4dba9d03a4e76fb25c72bdf5a75acbc34679`, scoped to its
standalone local Unix/Node provider contract.** No production changes made.
Review branch: `task/named-event-authority-review-oct20`.
Publication remains blocked and was not retried: **NO REMOTE BACKUP**.

## Provenance and replay

Read host AGENTS.md, repository CLAUDE.md, latest coordination board, exact
source, submitted test/report, receipt and seals. All 12 submitted SHA-256
artifact seals verified; source/test/report bytes also match the exact commit
blobs. Fresh isolated Git repository uses flattened read-only object alternates.
Before checkout, explicitly measured five paths (AGENTS.md, CLAUDE.md, provider,
submitted test, submitted report): 48,128 bytes total. Available space was
2,652,057,600 bytes, above fixed 2,285,895,680-byte floor plus 16MiB allocation.
No broad src checkout. Shared and supplied HEAD/index/config remain protected;
submitted evidence was neither edited nor regenerated.

Replayed with actual Node subprocesses, no stubs replacing the provider:

| Command | Exit | Observation |
| --- | --- | --- |
| `node test/test-named-event-authority.js --progress-only` | 0 | Two distinct forked clients; synchronous calls precede caller callbacks |
| `node test/test-named-event-authority.js` | 0 | All submitted checks, including 40 auto-reset races, lifecycle, SIGKILL, timeout and authority loss |
| `node test/test-named-event-authority.js --independent-control` | 1 | Two separate authorities yield `[true, true]`; exactly-one-consumer assertion rejects |

Node version and full commands/exits are preserved in the run receipt and JSON
results. This review uses only local subprocess/worker/socket execution.

## Independent checks

Run `node docs/reviews/named-event-authority-independent-20261020.js` from the
review checkout. Seven groups pass:

1. Owner blocks in `spawnSync` throughout a real child process's synchronous
   open/acquire/set. Owner callback remains undispatched. Auto-reset consumes
   once, child set reaches owner, and normal process exit eventually reclaims
   a child-only name. This directly covers owner JS blocking missing from the
   submitted fork progress test, whose owner awaits IPC asynchronously.
2. Exactly 1024 UTF-8 bytes accepted; larger, empty, NUL, non-string names and
   invalid modes rejected. Case-distinct names remain distinct. Validation
   errors leave the client usable.
3. 4096 references to one name reach the per-session cap; the next open yields
   ENOSPC. Closing one reference restores capacity without changing generation.
   Shutdown releases all references; repeated shutdown is harmless; recreation
   uses a fresh generation.
4. A separate subprocess speaks the submitted JSON protocol and deliberately
   keeps its socket connected after shutdown. An observer sees ENOENT after
   acknowledgement, proving release does not rely on subsequent EOF.
5. Session shutdown preserves another session's reference and signal, and does
   not transfer ownership of the old handle.
6. Terminating a client bridge produces bounded ETIMEDOUT and then ECLOSED even
   though posting to a terminated Worker need not throw synchronously.
7. Authority close returns the same promise on repetition, removes its private
   directory, causes existing clients to fail ECONNECTION then ECLOSED, and
   rejects a new connection to the removed endpoint.

Two isolated transport fault injections retain real authority state transitions
and socket transport. They change only successful set response delivery:
withhold the response, or destroy that session's socket before responding.
The first returns ETIMEDOUT, the second ECONNECTION. Another session observes
the committed signal exactly once, and both failed clients reject reuse with
ECLOSED. Thus **disconnect as well as timeout can have an unknown operation
outcome**; neither means rollback. These are fault-injected executions, not
claims that the unchanged server intentionally drops responses.

Four isolated behavioral controls exit 1 with assertions, not import failures:

| Mutation | Rejecting observation |
| --- | --- |
| Remove auto-reset consumption | Child's second acquisition unexpectedly succeeds |
| Remove EOF cleanup | Child-only name survives beyond bounded reclamation probe |
| Remove shutdown release before acknowledgement | Connected protocol client's name remains openable |
| Remove timeout poisoning | Reuse yields another deadline instead of ECLOSED |

The initial public-API shutdown probe alone did not reject removal of explicit
release: immediate bridge termination allowed EOF cleanup to mask it. The
connected-socket probe above was added for this reason; final runs reject that
mutation. No production fix or duplicated authority implementation was added.

## Assessment

The authority worker exclusively owns event state and session reference maps.
Its serialized callbacks perform check-and-consume together; no client mirrors
signal state. Dedicated client bridges progress while callers block. Existing
create retains mode/state, partial references keep the generation alive, final
release destroys it, and fresh UUID handles cannot address a replacement.
Explicit shutdown cleans before acknowledgement; process/socket death cleans
asynchronously, preserving surviving references. Errors are distinct from false
acquisition. Timeout/connection failure poisons the client without replay or
fallback; namespace owner loss destroys that namespace. All tested behavior is
consistent with the documented standalone contract. No blocking defect found.

This is a trusted same-user Unix transport, not a hostile-peer security review.
EOF reclamation is eventual, there is no fairness or persistent recovery promise,
and abrupt owner death may leave an inert temporary directory. Timing tests use
bounded generous guards rather than throughput or latency promises. Event-table
and connection-count exhaustion were inspected in source but not stress-tested;
the per-session reference bound was exercised. Guest adapters, positive waits,
native semantics and browser integration are explicitly absent from this
candidate and are not acceptance requirements for this review.

## Evidence and recovery

Evidence directory:
`scratch/runs/20261020-named-event-authority-independent-20261020/`.
It contains projection/protected/verification records, replay and independent
command results/logs, isolated mutation/fault sources, receipt, change.patch,
commit.patch and SHA256SUMS.json. To reproduce an injected case, use the
`provider` path recorded in independent-tests.json as `PROVIDER` and execute its
recorded command from the review checkout. Final seals identify exact tested
inputs, including this review pair. The receipt records the local commit and
space/protected-metadata checks. Patches preserve only this two-file review;
alternates depend on existing local object stores and are not remote backup.

No shared/supplied checkout edits, main integration, guest wiring, game work,
runtime access, remote publication, auth/SSH/browser/full-build attempts,
worker launch or queue refill were performed. Bounded task complete; stop.
