# Independent synchronous SEH fault ownership review — 2026-10-25

Decision: **ACCEPTED_SOURCE_REVIEW_PENDING_CENSUS**. Accept the actual wrapper
change and its scoped source behavioral oracle. No production correctness defect
was found in this bounded offline review. **Do not merge:** the required full
census fails four unresolved host-file identities on both exact revisions. None
is waived, refreshed, or assigned a stronger ownership claim by this review.

Reviewed candidate `bedb87f029002ba9411127587d4a40c62847f04e` against exact base
and independently checked remote main `27e2a7854f8c230af2fd123dec4c9cd0914d49b2`.
The supplied six byte/hash pins matched Git blobs in immutable read-only donor
`/tmp/seh-fault-retained-ownership-oct25/repo`. The review branch starts at the
candidate and adds only this report and `test/test-seh-fault-independent-review.js`.
The implementation's report was checked against production source and executed
behavior; it was not used as the acceptance oracle.

## Production source findings

`src/11-seh.wat:$seh_fault_sync` returns immediately for recursion and a null
return thunk, then ensures a lifetime, retains the full i64 parent/root, acquires
a child, and retains its full i64 identity and both depths before changing fault
guards, interrupted registers, stream/page controls, or guest memory. Production
`src/04-cache.wat:$invocation_enter` validates before its capacity check and
allocates a nonwrapping identity before changing depth. Lazy ensure can initialize
ownership bookkeeping and invoke the existing beep lifecycle imports; acquisition
is not a transactional guarantee about those primitives or concurrent host work.

One child owns the complete handler search, slices, and synchronous IO. Checks
immediately after every run and both successful and unsuccessful IO require exact
child/root and both depths. `invocation_current` validates the thread, shared
process epoch and shared live root. All token/root comparisons are i64. Checks
precede interpreting EIP/disposition, retry state changes, and further execution.
The same ownership checks precede retirement, followed by exact parent/root and
decremented depth checks before restoring the interrupted context. A corrupted
parent underneath an otherwise intact child is detected after child retirement,
before CPU restoration; this does not promise rollback of retirement.

The primitive `invocation_sync_leave` intentionally passes the current token to
`invocation_leave`; it cannot independently distinguish an original child from
a replacement sibling. The wrapper's retained check is therefore necessary.
The independent reproducer performs actual production leave/enter AST calls
inside the modeled run: base silently retires the sibling and restores the
caller, while candidate traps without that retirement/restoration.

Acquisition pins the interrupted IP once and retains the pin through search.
Production spill comparisons are unsigned, use a half-open range, and saturate
at bit 31. Bits at depths 31 and above remain set until rewind; they are not
cleared by ordinary leave. The independent controls exercise depths 0, 4, 30,
31, 32 and 62, all four range endpoints, and separately retained invocation and
synchronous depths. The depth-zero forced desk recomputation is still called
by production leave. Its debug/cache consequences remain outside execution proof.

The record/context/cdecl frame, dispatch-node skipping, 64-registration limit,
million-step slice argument, 64 ordinary rounds and 4096 successful fills per
handler remain unchanged. An empty or dispatch-only chain now acquires/retires
one child. Capacity/identity/serial failure can consequently trap on an empty
chain before guest initialization. This is an intentional acquisition change,
not a claim that such failures preserve the base's return value.

Owned timeout still retires the child, restores the caller, and returns zero;
this preserves existing bounded behavior without proving incomplete-handler or
nonlocal-unwind safety. Disposition zero handles, one searches, others stop.
CONTEXT edits remain ignored. Run/import exceptions propagate without cleanup:
no finally pops a foreign owner, restores CPU/page state, or clears abandoned
fault guards. Existing explicit lifetime reset remains the recovery boundary.

Eight registers, EIP, handler/step/yield controls, IP/resume/redirection controls,
and all six saved decoded-page fields are restored in the original order after
validation. The wrapper preserves the value returned by build_eflags and supplies
it to load_eflags; production getters are pure and load_eflags converts to raw
lazy-flag mode. This does not preserve each original lazy-flag global or establish
full architectural EFLAGS fidelity (including unsupported AF behavior).

## Oracle assessment and independent controls

The implementation evaluator executes the complete wrapper AST and rejects
unknown opcodes/calls. Its 40 mutation controls require assertion failures rather
than treating unsupported-opcode errors as successful detection. Exact BigInt
token comparisons are not truncated. Its invocation/stack/spill operations are
models, its guest memory is a word Map, and flags are an arbitrary packed value.
They do not execute production atomic allocation, lazy bootstrap, saturated pins,
translation/sentinel behavior, byte overlap, page watches, cache invalidation,
host concurrency or real decoding. Model snapshots containing packed flags are
evidence about wrapper plumbing, not production flag conversion. These limitations
are material to scope but do not invalidate its retained-owner regression.

The new independent evaluator executes the actual production AST for
invocation ensure/validate/current/new_id/install/thread_begin/enter/leave,
sync enter/leave, and dispatch-node recognition alongside the complete wrapper.
It uses byte-addressed DataView memory and explicit i64 operations. Its atomic
instructions are single-threaded models; run, synchronous IO, guest translation,
guest loads/stores, flags, page-watch effects, debug recomputation, and beep
imports remain modeled. There is no compilation or VM instantiation.

Its **31 controls** cover production spill depths/endpoints, empty/dispatch-only
acquisition, independent depth values, lazy bootstrap, capacity on an empty chain,
serial exhaustion and retired root before writes, a high-bit parent replacement
under the child, each postretirement parent/root/depth guard, actual primitive
sibling replacement at run and at both IO return values, ordinary JavaScript
exceptions at run/IO, and fail-closed unknown AST behavior. Postretirement fault
injection is explicitly synthetic; it tests restoration ordering rather than
claiming normal leave spontaneously corrupts ownership. No new defect was found.

## Completed bounded checks

Every Node command used heap 256 MiB, timeout 90 seconds, and at most 128 KiB
output/file evidence. Dependencies were inspected before execution.

- Candidate implementation suite: **84 behavioral cases / 40 mutations PASS**.
- Same implementation retained-owner reproducer: exact base fails with missing
  expected Trap; candidate passes. Both revisions pass the same **nine supported
  paths**, including search, handled/unhandled/empty chain, slices, IO and timeout.
- Independent controls: **31 PASS**. The unchanged independent sibling reproducer
  also fails on exact base and passes on candidate using production primitive ASTs.
- EDITSTREAM: **23 cases / 17 mutations PASS**. WinHelp: **25 / 17 PASS**.
- JavaScript syntax, WAT parentheses/labels, and parser-based owned-diff checks
  pass. Non-wrapper SEH ASTs are identical; only the assigned census row's hash
  and boundary-call list changed. Scanner and ownership labels are unchanged.

Independent commands from a checkout with the named source/parser paths present:

```sh
timeout 90s node --max-old-space-size=256 test/test-seh-fault-independent-review.js
timeout 90s node --max-old-space-size=256 test/test-seh-fault-independent-review.js --retained-only
git show 27e2a7854f8c230af2fd123dec4c9cd0914d49b2:src/11-seh.wat |
  timeout 90s node --max-old-space-size=256 test/test-seh-fault-independent-review.js --source=/dev/stdin --retained-only
```

The final command must fail with `Missing expected exception (Trap)` on base.
It changes only the interpreted wrapper input; the unchanged production cache
primitives are identical between base and candidate. Full-VM SEH/render-helper
tests and the native arena-spill test were dependency-inspected and not run.

## Required unresolved census blockers

The unchanged scanner ran against the actual full Git source inventory at each
revision: **268 sources, 407 boundaries**. The recipe enumerates root JS, all lib
JS, and direct src WAT/WATX paths using `git ls-tree -z`, reads the corresponding
immutable objects through `git cat-file --batch`, and passes them to the unchanged
`scanSources`, `check`, and `checkNonlocalAPIs`. No full tree or source copies are
needed. Each revision runs in a fresh bounded Node process.

Both revisions fail exactly these rows:

| File | Actual SHA-256 | Census expected SHA-256 |
| --- | --- | --- |
| lib/apps.js | 25c20e4468e55ae997f4d13b4efc08226efe3f7fac6899d72f90d236645a8a0d | 5a438ebd6c312a99f0f638d3cc57336885d4daa707b9bb03d227de008cafbd54 |
| lib/browser-shell.js | ee958a3b4f7e5d9006a03ce6f4823653e17f6bb48342c59b304d977b79658890 | 91bc8086de848cf900a8f96fe0e187458776cbb108271acc5cedb07c70cf0eb2 |
| lib/guest-worker.js | d1ae471298f667510b5fb3fbec56157e50f706896ededd4ca3450429f48af062 | 41f0e60e1a826b6ee472b133626aa7de6737a7b3a4eff3f4b3dec52b6d7b1b1a |
| lib/renderer.js | b1f6f1abbee443875e5d6d2cfcc67c4a077f89b522631749fe226b294cb9de03 | 3b7b3efb1dc48b73de6d24d0c01e10650b0cc84b0b8cd80df2b49baa3680b2b2 |

Source path inventories, diagnostics, actual/expected hashes and host Git blob
identities match exactly across base/candidate. Per-entry seals differ only for
`src/11-seh.wat:$seh_fault_sync`. Both nonlocal API lock checks are clean and the
lock stays closed. Full census acceptance is **BLOCKED**, not passed because its
comparison harness exits successfully. These four rows require coordinator-owned
host lifetime/census reconciliation and a clean required gate before integration.

## Evidence, resource corrections and scope

Evidence root: `/tmp/seh-fault-independent-review-oct25/ops/`.
`identities.json`, `parser-scanner-identities.json`, `tests.json`, the independent
logs, `baseline-census.json`, `candidate-census.json`, `census-comparison.json`,
`census.cjs`, `verify-change.cjs`, resource receipts, publication receipt and
`result.json` retain identities, commands, results and exact inventory recipe.
The standalone regression and this report are committed; ops receipts are local
evidence, not a claim that Git preserves ignored binaries or runtime artifacts.

Two review-harness failures are preserved: the first census evidence serialization
hit the enforced 128 KiB file cap; the subsequent combined two-revision process
hit the 256 MiB heap cap. Neither was retried unchanged or used to raise a limit.
Compact bounded receipts and separate processes per revision completed the same
unchanged scanner gates. Full entries are compared/sealed in memory; receipts
retain inventory, per-entry seals, wrapper details, host hashes and diagnostics.

The sparse checkout was initialized in non-cone mode before checkout and uses
flattened read-only donor object alternates. No donor writes, full clone/tree,
repack, root tracked/index/ref mutations or credentials were made. Root changes
are append-only messageboard claim/result entries. Resource accounting includes
task checkout/Git/evidence, external session and launcher/event bytes, conservative
whole shared WAL/SHM, future growth/publication and an 8 MiB reserve within 64 MiB.
Installed tools and donor objects are identified standing inputs. No links conceal
new materialized bytes. Admission was rechecked before dependent execution and
publication. No mount argv exists in this offline task; no guest attempt or mount
parser invocation is represented as executed. Dedicated trusted Git SSH was used.

No workers, Claude interaction, games, native code, full VM compile/instantiation,
deployment, nonlocal API enablement, test-box query/action, or main merge occurred.
No box was assigned; lifecycle ownership remains with the coordinator. This is
source-level retained-context acceptance only. Full SEH, native/gameplay behavior,
real cache recycling/concurrency and `_setjmp`/`longjmp` remain unqualified.
