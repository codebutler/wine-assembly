# Independent review: ACCEPT, scoped coupled contract

Reviewed exact `ea2888d76c9d69415e1fd15e1995d7f19a7125fd` against
`a9a60c69f8598562d80bf8b97f64b3864476280b`. No blocking production defect
found within the qualified Linux Node source-slice contract. This is acceptance
of the coupled entry/RPC/CLI/reservation/continuation behavior, not merely of
timestamp transport. No production files changed in this review.

## Evidence and conclusions

Independently inspected the complete 12-file candidate diff, including all
seven production JS/WAT paths. Replayed 13 selected commands: seven successful
commands and six intended behavioral rejections. Added one independent test
with a passing run and two additional mutations rejected at explicit assertions.
All 16 outcomes are recorded in `replay.json` and `independent-tests.json`.

* Entry deadlines: actual Node Worker calls to production imports, broker and
  extracted main/per-thread CLI adapters time out after 180ms delivery on a
  50ms original budget, retaining the signal. Delay after clock validation is
  charged at registration. Committed success survives delayed observation.
  Exact-base source slices return success after the same delivery delay and
  fail the original-budget assertion. Broker recapture also fails it.
* Identity: the independent test changes version, sequence, slot, handle and
  timeout individually; each rejects before consuming a signal. Changing just
  a shared digest word also rejects. Removing production digest verification
  fails that assertion. Fresh valid calls recover after rejection; sequence
  exhaustion rejects without wrap while zero probes still operate.
* Registration: one registration and three status-only polls are counted in a
  real Worker invocation. The new test explicitly puts Set–Reset before
  registration: the Worker parks. Set–Reset after registration resolves it.
  Two actual Workers with distinct clients sharing one named authority object
  receive manual-all / auto-one wakes after Reset. The existing reacquisition
  mutation fails the explicit registered-pulse assertion. Duplicate registration
  fails the late-assignment result assertion (258 instead of 0), not startup.
* Continuation: the independent test joins actual ThreadManager scheduler
  completion to actual WorkerLink.completeWait marshalling and the production
  Worker completion body. Exactly one stack pop occurs. Duplicate completion
  and an old completion during a later invocation cannot pop again. Removing
  WorkerLink sequence forwarding fails an explicit doesNotReject assertion.
  Existing mutations also reject stale continuations and disabled Worker
  ownership checks. These are behavioral failures, not syntax/import failures.
* Lifetime: the new Worker continuation observes cancellation after close;
  fresh objects remain usable. Replayed reservation regressions cover partial
  references, final close/recreate and cooperative/Worker scheduling. Acceptance
  exercises thread retirement, explicit owner shutdown, cancellation, terminal
  forgetting and reservation quotas. Replayed socket-proxy loss tests discard
  register/status/cancel/forget replies after actual authority operations:
  ambiguity traps, clients stay poisoned, mutations are not replayed, and
  thread retirement still happens. Missing authority clock acknowledgment
  rejects before registration. There is no retry/reconnect acceptance claim.
* Compatibility: replayed nested, import-throw and caller-stack tests plus
  reservation regression cover unsupported nested/infinite/positive multiwait
  rejection before consumption and zero/nonnamed behavior. The allocated
  4096-entry nested scan is exercised at its last entry.

## ABI and extraction fidelity

The 64-word control block and 256-byte stride remain unchanged. New words
28–31, 34–37 and 53–56 are disjoint from arguments 12–27, f64 words 32–33,
input/publication 40–52 and control 0–11. Audio occupies the excluded final
16 blocks. Full-tree source search confirms the WAT runtime consumer uses
THREAD_RPC offset 36 **bytes** (word 9), not digest word 36. The generated
region map and declaration agree; no region moved. Replayed ABI assertions
and reused sealed allocator/mirror/constants/import-signature gates support
this inspection. GuestThreadHost forwards entry metadata; Worker slice replies
carry sequence; ThreadManager and WorkerLink preserve it to completion.
Browser host completion calls do not opt into Node clock transport.

The new test reuses candidate fixture construction to avoid duplicating RPC
plumbing; its assertions and two in-memory production mutations are independent.
The fixture evaluates exact production RPC and ThreadManager source, extracts
the CLI import assignments and Worker completeWait body, and runs real Node
Workers plus a separate authority subprocess. The new test additionally calls
the real WorkerLink marshalling method. Synthetic guest exports supply stack,
return address, yield and register operations. It does not exercise full Worker
initialization, guest x86 dispatch, actual CLI main orchestration or real guest
stack translation. Its deliberate shared-word corruption/sequence seeding is
fault injection, not a production operation. Authority reservation algorithm
is real and unchanged by the candidate. The historical baseline option loads
the exact base RPC, ThreadManager, CLI and Worker slices with the same harness;
unchanged support dependencies remain candidate checkout files. The added
validateWaitClock method is unused by the baseline path.

## Limits, separate failure and recovery

**Guest entry to authority registration remains unreserved.** A pulse entirely
in that interval can be missed; the new test demonstrates it. Registration is
the linearization point. Original entry time bounds eligibility, not response
latency. Post-registration reservation guarantees do not extend backward into
this gap. Digest agreement assumes trusted peers, not hostile shared writers.

Qualification is Linux Node v24.18.1 / libuv 1.52.1, same boot and stable
calling-thread time namespace. No full VM, full build, browser, Windows oracle,
game, Boat/runtime or cross-host clock qualification was performed.

The existing sparse-stack failure is preserved separately and NOT counted as
green: candidate `logs/regression-5.log` and exact-base
`logs/sparse-stack-baseline.log` both report line 76, actual 1074790392 versus
1073807352. All 77 supplied artifact seals were independently verified before
reuse; `reused-evidence.json` records them. No historical evidence was changed.

Evidence directory: `scratch/runs/20261021-named-event-independent-review/`.
Sparse projection measured before checkout: 169 files, 6,426,624 allocated
bytes, plus an 8MiB reserve, under the 32MiB cap. The new repository uses 38
flattened object-only views, without nested alternates or writes to borrowed
stores. `guard.py` checks allocation and fixed free floor 2,285,895,680 before
write batches. Final receipt records actual allocation and protected shared/
candidate HEAD, index and config seals. Review branch:
`review/named-event-coupled-ea2888d`.

Recover source by retaining exact candidate objects and applying `commit.patch`
to that candidate in a fresh branch. `change.patch` is the equivalent aggregate;
apply one, not both. `source-seals.json` seals all materialized tested sources,
including the new test/report. `evidence.patch` recreates evidence files under
`review-evidence/`; `SHA256SUMS.json` seals the final artifacts externally.
Run commands in the two test manifests. Expected negative exits must include
the assertion diagnoses described above; a startup failure is not acceptance.

Publication held: **NO REMOTE BACKUP**. Local review commit is in receipt.json.
No network/auth/SSH retry, integration, repair expansion, worker launch or game
selection. Laptop HeroesII/WarcraftIII and Claude fleet untouched. Bounded
review complete; stop after local commit and evidence sealing.
