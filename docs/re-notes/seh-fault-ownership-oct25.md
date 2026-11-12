# Synchronous fault wrapper retained ownership — 2026-10-25

Base: remote main `27e2a7854f8c230af2fd123dec4c9cd0914d49b2`.
Scope: **only `$seh_fault_sync` in `src/11-seh.wat`**. This is a retained-context
prerequisite for the Circus/nonlocal-jump pipeline, not whole-SEH safety or
permission to enable `_setjmp`/`longjmp`. No game, native or full-VM execution
was performed. The scanner and independent nonlocal API lock are unchanged;
the census ownership labels remain `pending`.

## Change and lifetime

The previous wrapper built the exception record, changed ESP/EIP and decoded
stream controls, then entered synchronous depth separately for each handler.
It called `$sync_depth_leave` after the bounded run without retaining a child
identity. That primitive retires whatever child is current. A same-depth sibling
could therefore be retired and the interrupted caller restored as if the
original handler still owned the return.

The wrapper now ensures the invocation lifetime and saves the exact i64 parent
and root, acquires a child, then retains its exact i64 token and both synchronous
and invocation depths **before changing fault flags, guest memory, CPU state or
decoded-page state**. Ownership acquisition can still initialize the primitive's
lazy root; that is primitive bookkeeping, not an interrupted-context write.
The existing null-thunk and recursive-entry no-ops precede acquisition.

One child now owns the complete synchronous fault walk, including all handler
visits, ordinary slices and synchronous IO retries. This deliberately replaces
per-handler child acquisition/retirement. Run-time depth is the same as before;
the child remains live between CONTINUE_SEARCH visits. Even an empty/dispatch-
node-only walk reserves and retires a child. Consequently capacity/identity
failure on such a walk traps before initialization instead of returning 0 after
unowned guest writes. No new invocation IDs are issued between handler visits.

Immediately after every `$run`, and after `$host_io_fill_sync` whether it returns
success or failure, the wrapper checks current token, retained root and both
depths. `$invocation_current` additionally invokes the existing live-root,
thread and process-epoch validation. Full i64 comparisons reject high-bit-only
replacements. Checks precede result interpretation, IO retry state changes and
any next run/handler visit. The same checks precede retirement; retained parent,
root and decremented depths are checked before interrupted-context restoration.
A thrown run/import or mismatched owner is allowed to escape without cleanup:
there is no catch/finally that pops a foreign child, restores registers/pages,
or clears the abandoned fault guards. Recovery belongs to the existing explicit
process/thread reset protocol.

Acquisition pins the actual interrupted `$ip` once, before a filter can leave
`$ip` pointing into the decoded spill. The pin remains held across search visits
and is released once at final retirement. Each handler still starts with
`$ip = old_ip`; `$run` resolves its own decoded entry. The existing primitive's
spill desk/flush behavior is retained, with final release at walk completion.

## Successful paths and legacy timeout

The record/cdecl frame, saved registers, packed EFLAGS, decoded stream/page
registers, handler dispositions, dispatch-node skipping, 64-frame walk guard,
1,000,000-step slices, 64 ordinary rounds **per handler**, and 4096 successful
synchronous IO fills **per handler** remain intact. A successful fill retries
the same ReadFile without consuming an ordinary round. No fill, a nonblocking
thread or an exhausted fill budget consumes ordinary rounds as before.

A returned disposition 0 accepts handling; 1 visits the next registration;
other dispositions and an exhausted chain return 0. CONTEXT edits are still not
applied. For an owned handler that has not returned after the budget, the legacy
behavior is intentionally preserved: abandon that handler, retire this owned
child, restore the interrupted caller and return 0. This does **not** establish
that an incomplete handler or nonlocal unwind is safe to resume. The safety
correction is that stale/replaced ownership now traps before retirement or
caller restoration, including on the final timeout slice.

## Offline acceptance evidence

`test/test-seh-fault-ownership.js` parses and interprets the complete production
wrapper AST. It does not substitute another implementation of the wrapper.
The evaluator executes the real branches, record/frame writes, search walk,
loop budgets, checks, retirement call ordering and restore statements. Explicit
modeled boundaries are `$run`, invocation/sync/spill primitives, guest memory
translation/loads/stores, dispatch-node recognition, EFLAGS packing/unpacking
and synchronous host IO. Those boundaries are not proof of their production
implementations, x86 ABI behavior, linear-memory aliasing, actual decoding,
cache recycling or host concurrency. EFLAGS assertions compare the exact saved
packed value; the existing conversion to raw lazy-flag representation is not
claimed to preserve every original lazy-flag internal global.

With installed Node, 256 MiB heap and 90-second timeout per command:

- Candidate: **84 behavioral cases and 40 rejecting mutations pass**.
- Exact unchanged base fails the dedicated retained-sibling oracle with
  `Missing expected exception (Trap): sibling/return must reject`. Its full
  suite also fails acquisition atomicity because EIP, fault guards and guest
  memory were already modified when acquisition failed.
- Both base and candidate pass the same **nine supported-path** cases covering
  handled/search/unhandled/empty/multiple visits, slices, IO and owned timeout.
- Mutations remove acquisition, delay acquisition, remove retained child/root/
  depth guards, remove only immediate run or IO guards, truncate i64 comparisons,
  restore EIP before validation, and remove each saved CPU/page/EFLAGS restore.
  All are rejected by behavioral assertions, not unsupported evaluator opcodes.
- Fault cases cover returned, ordinary-slice, timeout, successful-IO and failed-IO
  boundaries; sibling replacement, leaked child, equal-token extra depth,
  high-bit child/root mismatches, self-consistent new root, retired root,
  thread/epoch mismatch, sync-depth mismatch, and thrown run/IO. Rejection leaves
  the observed foreign context unchanged, with no retirement/restoration or
  further run. Valid restoration checks all eight registers, every saved
  decoded-page/control global and packed EFLAGS. Other cases cover recursion,
  null thunk, last available depth, capacity/sequence failure and spill pins.
- Existing cheap EDITSTREAM source check: 23 cases / 17 mutation negatives pass.
  Existing WinHelp source check: 25 cases / 17 mutation negatives pass.
- JS syntax and WAT parser/parenthesis/label checks pass. Existing SEH render
  tests import `render-helper` and require a compiled/instantiated full VM;
  they were inspected and deliberately not executed under this offline task.

## Concrete inherited census blocker

The unchanged census gate scanned **268 current source files / 407 boundaries**
in memory from the pinned Git tree, substituting only the edited wrapper blob.
Only this wrapper's census hash and boundary-call list were updated. All other
rows, classifications and ownership assertions are unchanged.

The exact base itself fails four host-file hash rows:
`lib/apps.js`, `lib/browser-shell.js`, `lib/guest-worker.js`, `lib/renderer.js`.
After the assigned row update, the candidate fails **exactly those same four
rows**. The unchanged existing census mutation test reaches its real-source
assertion and fails on the same inherited diagnostics. Thus the full census
acceptance is **blocked**, not green. No out-of-scope host row was refreshed,
scanner condition waived, or nonlocal lock weakened. A separately assigned
review of those four host lifetimes and their census identities is the concrete
resume condition for a clean repository-wide census acceptance.

Evidence retained outside Git at `/tmp/seh-fault-retained-ownership-oct25/ops/`:
`admission.json`, `focused-tests.json`, baseline/candidate oracle and supported-
path logs, `baseline-census.json`, `candidate-census.json`, `census-candidate.log`,
source-check logs, `validation.json`, `publication.json`, and `cleanup-accounting.json`.
`check-memory.cjs` records the in-memory inventory/check recipe; the donor is a
read-only standing input and no full source checkout/copy is required. This
branch is tested repair WIP pending the inherited gate blocker and independent
review; it is not merged to main.
