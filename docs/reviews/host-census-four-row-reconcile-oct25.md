# Four inherited host census identities — 2026-10-25

This is a source-inventory reconciliation against immutable main
`27e2a7854f8c230af2fd123dec4c9cd0914d49b2`. Only `sha256` and `reason`
in four `host-file` entries change. All 407 classifications and pending
ownership labels, all unrelated row bytes, the scanner, and the independent
nonlocal API review lock remain unchanged. Source-gate success is neither
runtime ownership acceptance nor gameplay acceptance. Fresh independent review
and coordinator-serialized integration are required; this worker does not merge.

## Exact identities and complete history

The admission pins were independently verified through Git before checkout.
The first three old seals are exact full files at
`8b6d676ce0c8cd3d35db1f67fa6f21aaaaa2fb25`; the renderer old seal is at
`71d9c29ae1167863c51f27c5a9c0a2c6aca47911`. Every comparison below is from
that file's own prior seal to the exact base, without path-limited excerpts
substituting for the complete file diff.

| Source | Old bytes / SHA-256 | Current bytes / SHA-256 |
| --- | --- | --- |
| `lib/apps.js` | 411370 / `5a438ebd6c312a99f0f638d3cc57336885d4daa707b9bb03d227de008cafbd54` | 413346 / `25c20e4468e55ae997f4d13b4efc08226efe3f7fac6899d72f90d236645a8a0d` |
| `lib/browser-shell.js` | 210435 / `91bc8086de848cf900a8f96fe0e187458776cbb108271acc5cedb07c70cf0eb2` | 211893 / `ee958a3b4f7e5d9006a03ce6f4823653e17f6bb48342c59b304d977b79658890` |
| `lib/guest-worker.js` | 65672 / `41f0e60e1a826b6ee472b133626aa7de6737a7b3a4eff3f4b3dec52b6d7b1b1a` | 65691 / `d1ae471298f667510b5fb3fbec56157e50f706896ededd4ca3450429f48af062` |
| `lib/renderer.js` | 214278 / `3b7b3efb1dc48b73de6d24d0c01e10650b0cc84b0b8cd80df2b49baa3680b2b2` | 214846 / `b1f6f1abbee443875e5d6d2cfcc67c4a077f89b522631749fe226b294cb9de03` |

Complete intervening source changes are confined to three integrations:
`adb2852f0ad9944625d809fd9b73c50dc3d4514e` (apps/shell),
`ffe822a9d50ad79439330609915eb84475acd2bc` (worker), and
`4e00e120b037c7f5d99d1379c36c22079e6d3be1` (renderer).
The four current production blobs exactly equal those integrations' blobs.
Relevant dependency blobs `app-files.js`, `host-window.js`, and `render-clear.js`
also remain identical to their respective integrations. No wrapper candidate
`bedb87f029002ba9411127587d4a40c62847f04e` content or census row is included.

## Lifetime review

**apps.js:** The complete delta adds Airstrike/Penguin selector tuples and
local EXE/DLL/required-manifest registrations with pinned inventory digests.
The two `.map(name => ... + name)` closures synchronously construct DLL URLs;
they retain only the existing media root and create no guest callback, deferred
entry or restoration obligation. The new entries introduce no beforeRun/onExit
hooks, scheduler or run policy. The conservative lexical boundary inventory
remains appropriate for the whole file; no exemption is added.

**browser-shell.js:** Reviewed every moved/deleted/added line and the actual
createLaunchContext, cancelLaunch, public-entry queue/restart/finally,
launchAppInner failure/stop, EXE/files/DLL loading and first-run paths.
Manifest resolution moves from after init to before `wine.init(canvas)`;
`createdWine`, `ctx.wine` and the stop hook already identify the same instance.
Pinned apps revalidate even when `_localFilesResolved` is set. The manifest
fetch and checked-byte reader use the context's abort signal. Cancellation is
checked after response fetch, JSON decoding and complete asynchronous validation,
before publishing checked files, EXE bytes and the URL-to-bytes map to the app.
Validation failure therefore cannot publish a partial checked plan or enter
the guest. Existing failLaunch disposes an unregistered created instance after
the awaited operation unwinds; public-entry finally releases the boot guard.

The validator's `validatedLocalResult` retains the checked fetch buffers and
`loadMode: 'required'` companions. `normalizeLazyFiles` preserves that explicit
mode, so these Blob-backed files are consumed eagerly, without a later lazy
reader depending on revoked URLs. The per-load `verifiedObjectUrls` array is
inside try/finally: partial mapping failure, rejected loadFiles or cancellation
unwind through revocation. On normal completion revocation follows the awaited
loadFiles and precedes the next cancellation checkpoint. Blob construction copies
the supplied bytes. The EXE receives `dynamicExeBytes`; DLL resolution first
looks up the same validated byte map, falling back to existing transfer only
for URLs absent from that closure. The generic unpinned manifest path retains
its existing merge, registry and CD metadata behavior.

The app object keeps checked snapshots for its existing registry-entry lifetime;
the delta does not promise immediate memory reclamation at process exit.
New launches serialize through the existing boot guard. Queue entries retain
the supplied options object; cancelled-boot replacements retain callbacks/maps
through the existing options spread adding directIntent, after old cleanup.
No new callback replaces beforeRun or onExit: beforeRun is still awaited after
DLL setup and before registration/first run; onStopped still invokes onExit in
finally, and failure still notifies onExit(null). Arbitrary caller hooks are not
certified exactly-once by this inventory. No guest token or suspended register
restoration is introduced or newly certified by the manifest callbacks.

**guest-worker.js:** The entire delta is `render-clear.js` inserted before
`d3d9-backend.js` in `loadD3DIMGpuScripts`' existing lazy browser import list.
It uses the same versionedWorkerUrl/cache generation, synchronous importScripts,
existing D3DIMGpu fast path and exception propagation. The helper defines a
pure descriptor API; it creates no timer, guest entry or retained continuation.
The Node branch is unchanged. Reviewed the incoming thread-send slice guard,
retry-yield handling and named-wait single-consumption guard before EAX/ESP/EIP
restoration: no lines in these paths change. The worker's serial dispatch,
callback fencing and pending ownership limitations remain inherited.

**renderer.js:** The complete diff gates the clip-root walk and six
child traversal/recursion sites on isChild, and adds ancestor clipping to the
single-source child layer loop. A recorded parentHwnd on a non-child popup
does not transfer its surface to the owner's child tree: it retains its own
top-level slot. Actual children and nested descendants retain ancestor clipping.
Reviewed window records, stale/hidden/deleted owner cases, own-surface versus
shared overlays, canonical screen-layer collection, parent snapshots, stale
sequence filtering and GPU frame offsets. No window is created/deleted by the
delta, and surface ownership is not reclassified into guest invocation ownership.

`_compositeChildSurfaces` still temporarily aliases wasm/wasmMemory to each
child and restores both in its existing finally across recursion/exceptions.
The new single-source canvas save is paired with try/finally/restore, including
draw/overlay exceptions, preventing its new clip from escaping into siblings.
The other rendering/restoration paths remain inherited. No changed callback
begins guest execution or establishes retained guest invocation tokens.
No new substantive ownership defect was found in these intervening changes.

## Reused acceptance and current checks

Read [local manifest independent review](../re-notes/local-game-manifest-independent-review-20261024.md),
[owned-popup independent review](../re-notes/owned-popup-clipping-current-main-20261024.md),
and [clear contract review](../re-notes/d3d9-explicit-clear-contract-20261024.md).
Exact production/dependency blob equality above binds their relevant source
scope. The popup test was subsequently expanded in
`e5f45399bc5564a84b6b1428e15ffa412db9e929`; the current expanded test was run.
The original-media manifest tests require private game copies and staging;
their accepted unchanged source receipts are reused, not rerun or relabeled.
The clear-contract native excerpt and render-helper suites were not run.

Current commands use installed Node, 256 MiB old-space, 90 seconds per command
and output below 128 KiB. A retained Git-backed filesystem/CommonJS adapter
reads inventory sources in memory from the exact base; no production sources
are materialized. It runs the unchanged scanner CLI and test bodies. The census
suite's scanner-child dump transport uses the same exact full source inventory.

- Baseline CLI exits 1 with exactly the four expected host SHA diagnostics;
  source inventory contains 268 files and 407 boundaries.
- Candidate CLI and scanner API pass all 407 boundaries; nonlocal APIs remain
  disabled and all ownership labels pending.
- Existing `test/test-callback-ownership-census.js` passes its fixtures, lifetime,
  startup and host-review rejection controls. Existing
  `tools/callback-census-reconcile.test.js` passes two producers/14 controls.
- Launch-options regression passes; popup regression passes 85 checks;
  SetParent role distinction and browser D3D dependency-order tests pass.
- Ten additional in-memory full-inventory controls reject four unauthorized
  host edits (including omitted Blob revocation), missing/duplicate rows,
  unsupported ownership, unreviewed kind, an unrelated host hash and nonlocal
  registration. None changes the expected census or production source on disk.
- Extra `test/test-host-worker-lifecycle.js` exits 1 at its first stop: its
  Object.create fixture omits constructor-owned `_processObject`, while exact
  base host.js:4967 requires it. This is an inherited fixture incompatibility,
  not a passing lifecycle result or evidence of a new defect in the reviewed
  delta. No out-of-scope fixture/production repair was attempted.

No focused committed test is added: the existing rejection suite covers the
required concrete inventory cases. Structural and byte comparison verifies only
sha256/reason in the four assigned entries changed, with unrelated rows intact.
No scanner change, classification relaxation, API enablement or ownership-complete
claim is made. SEH/Circus integration requires the coordinator's separate review
and prerequisite reconciliation; no gameplay, native, VM or full-build acceptance.

## Evidence, resources and handoff

Retained evidence: `/tmp/host-census-four-row-repair-oct25/ops/` contains
admission.json (pins, resource calculation, trusted SSH and standing tools),
four complete diff patches, complete-diff-scope.json, baseline/candidate gate
JSON and CLI logs, tests.json and individual logs, negative-controls.json and
driver, git-memory.cjs, scope-check.json, publication.json,
cleanup-accounting.json, evidence-manifest.json and result.json.
Replay from the retained allocation with `timeout 90 node
--max-old-space-size=256 ops/git-memory.cjs cli-gate`; set
`HOST_CENSUS_BASELINE=1` for the rejecting immutable-base census.
Use the same driver with a test path to replay a named source regression.

The isolated sparse non-cone checkout was configured before checkout and uses
flattened read-only standing donor alternates. No clone/fulltree/repack or donor
mutation. Precheckout measured free 3291201536 minus own 67108864 and other
reviewer's 67108864 gives 3156983808, above floor 2982150144; rechecked before
execution. Planned peak 56 MiB includes 8 MiB reserve and external session,
events and SQLite growth allowance. Installed tools/donor are separate standing
inputs. Final measured accounting and cleanup are in the retained receipt.

Root historical checkout/index/refs stay untouched; only append-only root
messageboard claim/result entries are written. Only the task branch is pushed
with the specified dedicated strict SSH configuration and verified remote ref.
No workers, Claude interaction, deployment or successor selection. No box was
assigned: ID/state/expiry are N/A; no lifecycle action, coordinator owns shutdown.
