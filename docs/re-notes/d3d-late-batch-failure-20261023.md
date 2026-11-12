# D3D late-batch create rejection, 2026-10-23

Historical source last updated, 2026-10-23. Runtime and implementation claims below describe that dated source; see current app notes and source for subsequent changes.

The defect is in the compaction fixture's choice of execution mode. Its original
no-pixel-change assertion is valid for retained-context preparation, but the
preceding budget reduction selects streaming and remains in effect at that
assertion. No production renderer change is justified by this failure.

Input and read-only remote main: `7f7358c160ae7185fc38f9a15447a6d20c00f97e`. Private branch: `task/d3d-late-batch-failure-repair-oct23`. The accepted `src/10-helpers.wat` large-arena reuse is preserved byte-for-byte.

## Contract and cause

- `lib/d3d9-software-backend.js:550` explicitly selects streaming when
  `holdsBatches` cannot admit all deferred peaks. Its comment explicitly permits
  a late failure to leave earlier batches drawn. Commit
  `3a908f97bafc0a25f18938b1f4913fae959115ed` introduced that behavior deliberately.
- `step` prepares, rasterizes and retires each streaming batch before creating
  the next. The comment near line 1096 promising every batch validates before
  pixels follows the streaming early return and applies to retained contexts.
- `test/test-d3d9-software-backend.js:761` already requires streaming under a
  constrained budget to match retained-mode success pixels and sample totals.
- `d3d9-host.js:499` describes synchronous parameter validation followed by
  asynchronous driver consumption and deferred device faults. `Device.execute`
  returns async completion failures; `CommandQueue._retire` faults the ordered
  stream. These consumers provide error propagation and retirement, not a
  transaction rolling back prior color/depth/stencil writes.
- The compaction fixture lowers `d.budget` to `oldSum-1`, using a sum of immediate
  allocation bounds. Admission uses deferred bounds plus packed input bytes. This selects streaming even though compacted retained contexts are smaller. The injected third create rejection therefore follows two rasterized batches. The original test did not restore the full budget until after its assertion.

The focused fixture repair restores the original budget and asserts retained
mode before preserving the original no-pixel-change assertion. A separate
constrained-mode rejection compares pixels with an independently rendered
two-batch prefix, requires a visible change, and verifies unchanged published
samples, baseline device bytes, zero live contexts and zero pending setup records. Successful constrained rendering still requires the original exact pixels and
`800 * 36` samples. Export wrappers now detect repeated context release. No target rollback buffers or production memory reservations were added.

## Executed offline evidence

`d3d-late-batch-failure-20261023/device-fault-injection.js` calls the actual
production `Device.prepare`, `prepareBatch`, `step`, `draw`, `drawAsync`, `cancel`,
`execute`, retirement and release code, and the actual `CommandQueue` consumer. Only exports are doubled. Synthetic IR headers bypass real shader compilation;
synthetic bounds exercise admission, and synthetic raster exports write one
distinct marker per batch. They do not emulate native geometry or allocator
behavior. The receipt is `d3d-late-batch-failure-20261023/results.json`.

Nine scenarios pass: third-create rejection in both modes, synchronously and
asynchronously; cancellation after the first raster in both modes; successful
async rendering in both modes; and deferred queue failure. The failure trace is:

```
retained: create1 prepare1 create2 prepare2 create3(reject)
streamed: create1 prepare1 raster1 create2 prepare2 raster2 create3(reject)
```

The native compaction and existing backend suites require `render-helper`, which
calls `compileSrcWasm`. They were **not executed** under this assignment. Their
updated native assertions, real pixel/sample equality, native allocator release,
and preservation of the accepted arena optimization remain to be qualified by
an explicitly authorized resource-admissible native run. The coordinator's prior
control/candidate failure at original line 91 is supplied historical evidence,
not a fresh native run by this worker. No guest/runtime access was attempted.
