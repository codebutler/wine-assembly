# Fresh target clear-value cache repair

Starting revision: `912cd44a9e0b4ffedf106ecc80031351773f5302`, retaining
`77180c76b312efe465ad91e60286d40330d77d0d` and producer
`ffe822a9d50ad79439330609915eb84475acd2bc`. All required commit identities and
the rejection's 12 evidence seals were verified. Strict trusted SSH reconciled
remote main at `f6571101e38985b3fa34d328f2ccadd9735a7573` before checkout.
This task publishes a repair branch for independent review; it does not integrate main.

## Behavior and owning boundary

The exact independent fresh-target probe failed before editing: a preceding
wrapper clear cached depth .25/stencil 52, but real named target initialization
wrote depth 1/stencil 0 directly to GL. The subsequent requested .25/52 clear
was suppressed by the stale cache and used 1/0. Existing-target and cold-cache
controls both passed on that unchanged rejection revision.

`WebGLBackend.bindColorResource` now initializes depth/stencil through the
existing `clear(null, mask, 1, 0)` wrapper. The real initialization, mask,
allocation, attachment and fresh-store lifecycle remain intact. The wrapper
updates the shared clear-value cache when it changes GL state. Subsequent
requested values can then be written or safely suppressed against accurate state.

A narrow audit found the same ownership violation in `bindRenderTarget`: it
wrote stencil zero directly, then called cached clear without a stencil value.
The new isolated implicit-target test reproduces its cache/GL mismatch on the
reverted backend. That initializer now passes depth 1/stencil 0 through the same
wrapper, retaining color and fresh depth/stencil initialization. Only the
wrapper now contains direct clearDepth/clearStencil/clearColor calls in this file.
No adapter, descriptor, existing probe, oracle or initialization was removed.

## Validation

Evidence is under `evidence/d3d9-fresh-target-cache-repair-20261024/`.
`tests.json` records exact argument arrays, exits, elapsed time and fresh memory
checks; `execution-protocol.json` records the common command prefix and limits.
Each Node command used `timeout 60s node --max-old-space-size=256`, CPU soft/hard
limits of 60 seconds and fresh MemAvailable >= 805306368 bytes.

* Unchanged fresh-target probe: rejection exit **1**, repaired exit **0**.
  Existing-target/cold-cache controls: **0** before and after. Its SHA256 remains
  `4b550a8b7966228cddb3957c789803835c1df05bc128c45c5fac14a3b7e86408`.
* Loading only the exact rejection's GPU backend into an isolated process with
  `node -r /tmp/d3d9-fresh-target-cache-repair-oct24/revert-backend.cjs`
  makes that unchanged probe exit **1** for its original named-target assertion.
* New `test/test-d3d9-clear-fresh-target-cache.js`: **0** for eight named cases
  covering D16 and D24S8 depth-only, stencil-only, combined clears, requested
  default/nondefault values, warmed cache, repeat suppression, fresh second
  attachments, existing-target return and implicit/named switches. It exercises
  actual Device/binding/depth-storage/cache/clear methods. It checks cache/GL
  agreement, initialized untouched depth/stencil, color preservation, unrelated
  viewport/depth-range/blend state and retained first-use initialization.
  GL and color/texture allocation are mocked. `--revert` exits **1** at requested
  named depth; `--implicit-only --revert` independently exits **1** at implicit
  stencil cache agreement. Final candidate rerun passes after adding preservation
  assertions; both mutations select the exact rejection backend through Module loading.
* Original independent normalized-depth test and `--probe`: **0** unchanged.
  Its exact-main `--probe --baseline` exits **1** for the original normalized-depth
  reason. Existing focused depth-cache suite: **0**; its exact producer adapter
  `--mutation`: **1** for the first normalized-depth assertion.
* Producer clear-contract suite and its seven semantic rejecting controls: **0**.
  Compiler path, five candidate Git blobs/full-file hashes, ordered balanced
  extraction ranges and byte-exact 5257-byte source were revalidated first.
  Installed compiler was executed in place. This is only a five-function,
  one-64KiB-page excerpt producing 755 module bytes, never a full module build.
* Seven cheap existing suites pass: GPU wrapper, shipped browser dependency
  ordering, neutral command queue, shared render worker, software synchronous
  present, D3D9 shared worker and present cadence. Changed-file syntax and
  `git diff --check` pass. Original four test files remain byte-identical.

These observations establish source behavior at a mocked GL boundary. They
do not establish real GL driver pixels, complete module compilation, rasterized
draws, browser execution, guest compatibility or gameplay.

## Resource, publication and recovery

New explicit non-cone sparse checkout:
`/tmp/d3d9-fresh-target-cache-repair-oct24/repo`, branch
`task/d3d9-fresh-target-cache-repair-oct24`. Required paths were the supplied
donor manifest plus exact rejection changes. Read-only object donors and installed
Node/compiler were used in place; only this checkout's alternate list was
flattened. Deep alternate warnings were retained, not treated as missing objects.
Root tracked files/index/refs and all donor checkouts stayed read-only.
Coordination used append-only `echo >> messageboard.txt` followed by tail.

Input manifest measured 3534248 bytes. Original projected peak 56388608 bytes
remains charged against 67108864, including checkout/Git, generated/temporary
evidence, complete external session/events/logs, positive SQLite growth, future
outputs and an 8388608-byte reserve. Per-file limit is 25165824 bytes;
post-projection host free floor is 2982150144 bytes. Task-root admission,
standing-tools, resource-final and cleanup receipts preserve measurements and
history; capture accounting retains early slice overages and prior allowance.
Fixture/path and initial metadata-recording corrections are disclosed in
`execution-protocol.json`; failed raw logs were retained. No source oracle was
changed to accommodate a failure.

`source.diff`, `regression.diff`, probe hashes, prior seals, raw logs and artifact
seals allow independent review. Task-root publication/committed-verification
receipts record the actual commit and independent strict-SSH remote SHA check.
To recover, fetch this task branch with the existing trusted identity/known-hosts
configuration; do not alter trust settings. Retained runner recipes assume they
are placed back in the task root (parent of `repo`); compiler donor identity is
pinned in the checkpoint. No generated binary requires recovery.

No box was assigned: ID/state/expiry N/A; lifecycle remains coordinator-owned.
No runtime, guest mount argv, worker launch, panes, deployment or main merge.
Own board watcher is terminated at release; evidence remains for coordinator
review. This worker returns ownership and stops after verified publication.
