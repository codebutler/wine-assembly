# Independent combined SEH/census source acceptance — 2026-10-25

Decision: **ACCEPT**, limited to the Circus prerequisite source gates described
here. No production code was changed by this review. This neither qualifies
native/general SEH/fullVM/gameplay nor enables nonlocal APIs. All 407 inventory
ownership labels remain pending. Pending inventory is not a correctness defect.

Reviewed unchanged host reconciliation `4efa0599fee900a22770c40659e65c3a2e1c9a64`
against main `27e2a7854f8c230af2fd123dec4c9cd0914d49b2`, combined with accepted
SEH implementation `bedb87f029002ba9411127587d4a40c62847f04e` and its independent
review `5a30913951a7bca7482d7f459bbcdf013141a66e`. Initial combined merge
`49afee82cd05993f7dfca40d30f82e4520a87488`, tree
`35bc418a1d5a79704fde87ac57ecbb0456f7a6d0`, retains both task ancestries.
The final review commit adds only this report and one independent regression;
publication and exact final-tree receipts are retained in ops below.

## Independent host lifetime findings

Read the complete intervening Git diffs from the actual prior complete-file seals:
apps/shell/worker `8b6d676ce0c8cd3d35db1f67fa6f21aaaaa2fb25`, renderer
`71d9c29ae1167863c51f27c5a9c0a2c6aca47911`. Verified the old full-file hashes
against base inventory and current full-file hashes against the repair. This is
not acceptance based on hash equality or the implementation narrative alone.

* Apps adds only Airstrike/Penguin selector and pinned required-media entries.
  Its two synchronous DLL-name map closures capture the existing root string;
  they add no deferred guest entry, callback or restoration state.
* Shell moves local manifest reading ahead of init, with createdWine/ctx.wine
  already identifying that launch's host. Manifest fetch uses the abort signal;
  checkpoints after fetch, JSON and asynchronous integrity verification prevent
  cancelled checked plans being published or reaching init. Pinned launches
  revalidate even after `_localFilesResolved`. Generic manifests keep their
  previous merge/registry/track metadata semantics. Actual app-files validation
  verifies the pinned inventory and complete closure before returning buffers;
  EXE bytes and the DLL URL map retain that same checked closure. Required
  companion mode survives lazy normalization. Registry-entry buffers persist
  for the app object's lifetime; immediate reclamation is not promised.
* The Blob URL list lives inside try/finally around map creation and awaited
  loadFiles. Partial map creation, load rejection, progress-callback exceptions
  and cancellation all revoke successfully created URLs after consumers unwind.
  This is safe for required eager companions; it does not certify arbitrary lazy
  URL consumers. Existing queue/restart serialization preserves callback/map
  identity; beforeRun still follows DLL loading and precedes registration/run.
  onStopped's finally forwards onExit; failure forwards onExit(null). Arbitrary
  caller hooks are not newly certified exactly once. failLaunch disposes its
  orphan only after awaited boot work unwinds; public entry releases its guard.
* Worker delta is solely the versioned synchronous render-clear import before
  d3d9-backend. Actual lazy-import excerpt controls verify order, loaded fast path
  and exception propagation. No slice, wait, callback fencing or register restore
  code changed. Node import behavior is unchanged. No guest execution is tested.
* Renderer adds isChild to the root walk and child traversals, keeping owner-only
  popups out of child clipping/composition while retaining their top-level slots.
  Actual children retain ancestor intersections and stale-sequence behavior.
  The new per-child canvas save/try/finally/restore prevents clipping leaks on
  draw/overlay exceptions. Existing recursive wasm/memory aliases are restored
  in finally, including thrown draw paths. No new guest invocation owner exists.

No substantive new ownership defect was found. Structural and raw-row comparison
proves that the host repair changes only sha256/reason in exactly four rows;
unrelated entries, classifications, ownership, scanner and API registration lock
are unchanged. Combined inventory differs additionally only by the already
accepted SEH wrapper hash/boundaryCalls row. src/04-cache.wat and the accepted
src/11-seh.wat/test identities match exactly, so the prior independent semantic
review is reused without widening its modeled scope.

## Exact checks and negative controls

Fresh bounded Node processes scan all **268 source files / 407 boundaries** from
Git, using unchanged scanner/parser bytes. The exact base yields precisely four
expected host hash errors (apps, browser-shell, guest-worker, renderer); the
combined tree yields **zero** errors and zero nonlocal API lock errors. Compact
receipts keep per-entry seals and full source path inventory; no update option,
scanner weakening, classification refresh or source omission is involved.

Passing checks on the combined inputs:

* Existing census suites, including reconcile's 14 controls; ten full-inventory
  rejection controls cover all four unauthorized host edits, missing/duplicate
  entries, unsupported ownership, unreviewed classification, unrelated hash and
  nonlocal API registration.
* SEH supplied **84 behavioral cases / 40 rejecting mutations**; independent
  **31 production-primitive AST controls**. Same unchanged retained-owner
  reproducers reject exact base and pass candidate coverage. Nine supported
  paths pass on both revisions. Full semantic limitations from the independently
  accepted SEH review remain: modeled execution/IO/translation/flags/atomics and
  host concurrency, no native or general unwind proof.
* EDITSTREAM **23/17**, WinHelp **25/17**, WAT parentheses/labels.
* Launch options/callback transport, asset cancellation (six cases), owned-popup
  composition (85 checks), SetParent distinction and shipped D3D dependencies.
* Added independent host regression: **16 primary cases / 3 rejecting mutations**
  for manifest cancellation/publication, pinned revalidation, Blob URL exception
  cleanup, renderer alias/canvas exception restore and lazy worker import
  behavior. Exact production blocks/methods run against modeled host boundaries.
  Removing cancellation checkpoints, revocation or canvas restoration causes
  assertion failures; unsupported operation errors are not counted as rejection.

### Inherited lifecycle failure: retained, not marked passing

Unchanged `test/test-host-worker-lifecycle.js` fails identically on exact base and
combined at host.js:4967: `_processObject` is absent on its Object.create fixture.
The actual host constructor initializes `_processObject` and `_processAliases`.
A supplemental run using the real constructor reaches a second unrelated stale
WorkerLink fixture (`_retiringListeners` omitted); that full trial also remains
**FAIL**, not a passing lifecycle suite.

For a valid bounded comparison, the unchanged first six host-owned case bodies
were executed separately with the actual host constructor, on base and combined:
deferred worker retirement/memory release, rejected retirement retaining owners,
synchronous no-worker release, delayed worker boot cancellation, pending signature
fetch cancellation, and failed-start cleanup all pass. Only fixture construction
and the explicit six-case boundary differ; production methods/assertions do not.
The launch-options and asset-cancellation suites independently cover the relevant
shell callbacks/cancellation, and added exception controls cover changed cleanup.
The original full lifecycle suite and later WorkerLink-specific coverage remain
unqualified. Its inherited unrelated fixture failure is not a required full-VM
acceptance gate for this four-row source-only reconciliation. No required census,
SEH or changed-host control is waived; general lifecycle acceptance is not claimed.

The first direct EDITSTREAM invocation failed ENOENT because the source fragment
was absent from the sparse checkout. The corrected command supplies the exact
Git blob via stdin; EDITSTREAM and WinHelp pass with identical test bodies and
oracle. Both the failure and correction remain evidence. No limits were raised.

## Replay, publication and limits

Evidence root: `/tmp/seh-census-independent-combined-oct25/ops/`. `scope.json`
retains old/new seals and diff identities; `complete-*.diff` preserves all four
full deltas. `census.cjs`, `git-memory.cjs`, `run-tests.py`, `run-remaining.py`,
`negative-controls.cjs`, `lifecycle-constructor.cjs`, `extra-tests-scoped.py` and
individual logs are recovery recipes. `tests.json`, `lifecycle-scoped.json`,
`final-tree-validation.json`, `publication.json`, `cleanup-accounting.json`,
`evidence-manifest.json` and `result.json` bind results and final remote refs.
Replay individual Git-backed tests with `timeout 90 node --max-old-space-size=256
ops/git-memory.cjs test/test-host-census-independent-combined.js`; set REVIEW_REV
for immutable historical sources. Raw census diagnostics, not the comparison
harness exit alone, determine baseline/candidate acceptance.

Sparse non-cone patterns were configured before checkout; flattened read-only
standing donor alternates, no clone/fulltree/repack/donor writes. Dedicated
trusted Git SSH configuration was verified against fresh remote refs. No mount
or runtime invocation exists; no mount-parser execution is claimed. Accounting
includes own Git/checkout/evidence, external session/launcher bytes, whole shared
WAL/SHM, future growth and 8 MiB reserve inside 64 MiB; installed tools/donors
remain separate standing inputs. Each Node command has 256 MiB old-space, 90s
wall limit and output below 128 KiB. Publication uses a fresh-main check and
non-force push; root checkout/index/refs remain untouched (board append only).

No worker spawning, Claude, deployment, build, WebAssembly compile/instantiation,
game, guest or native attempt, acquisition or box lifecycle action. No assigned
box: ID/state/expiry N/A; coordinator retains shutdown ownership. These gates
close prerequisite source blockers only. `_setjmp`/`longjmp` and broader
nonlocal behavior remain locked and unqualified.
