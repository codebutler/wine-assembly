# Independent clear/cache acceptance — REJECT

Candidate `77180c76b312efe465ad91e60286d40330d77d0d`, retaining producer
`ffe822a9d50ad79439330609915eb84475acd2bc` and independent rejection
`c1bfc2c696e8b88749a3b8ab04f935b5e52d7cb1`, was reviewed against exact
remote main `f6571101e38985b3fa34d328f2ccadd9735a7573`. Strict trusted SSH
confirmed these remote identities before review. No main integration is accepted.

## Blocking behavior: fresh named attachment initialization bypasses cache

`WebGLBackend.bindColorResource` (`lib/gpu-backend.js`, fresh depth-store branch)
executes `gl.clearDepth(1); gl.clearStencil(0); gl.clear(...)` without updating
`_stateValues`. The repaired `Device.clearCommand` correctly delegates requested
values to `WebGLBackend.clear`, but that wrapper suppresses writes when its cache
already matches the requested values. Consequently:

1. A legitimate wrapper call caches depth .25 and stencil 52.
2. A clear first binds a named color resource with a fresh D24S8 depth surface.
3. Binding initializes the new surface at depth 1 and stencil 0, leaving cached
   .25 and 52 unchanged.
4. The requested depth/stencil clear (.25, 52) skips both GL writes and actually
   clears at **1, 0**. The cache continues to claim **.25, 52**.

The new independent probe records exactly:

```json
{"clears":[{"mask":0,"depth":0.25,"stencil":52},{"mask":12,"depth":1,"stencil":0},{"mask":12,"depth":1,"stencil":0}],"cacheDepth":[0.25],"cacheStencil":[52]}
```

`test/test-d3d9-clear-fresh-target-independent.js` executes the actual Device
adapter, bindDepth, WebGLBackend.bindColorResource, clear, and state-cache methods.
Only storage allocation/texture binding primitives and the GL boundary are
mocked. Target binding itself is not replaced. The assertion requires the final
clear to use .25 and 52 and exits 1. The same assertion passes with an already
bound target (`--existing-target`) and with no preceding cache population
(`--cold-cache`). These controls isolate the first-use initialization/cache
interaction. This is a source/mock-boundary correctness result, not GPU pixels.
The wrapper source is byte-exact from baseline; the initializer defect exists
there. This review does not claim that the original baseline positional adapter
has identical behavior for this new case.

## Review and retained passing evidence

Reviewed descriptor creation/copy/freezing and validation, host initialization,
ColorFill/Clear publication, synchronous/worker dispatch, positional compatibility,
software masked native stores, GPU masks/scissor, attachment identities and shipped
dependency ordering. No production WAT changes occur. The depth/stencil repair
removes the adapter's direct clear-value writes but does not cover fresh named
attachment initialization in the unchanged wrapper. Producer and focused cache
fixtures stub this binding path, so their passing results cannot close this gap.

The original independent observation and `--probe` assertion prefix (2072 bytes)
is byte-exact from reviewer c1bfc2c69; SHA256
`12c84f2b97688fdee0c805d746e78d52c6e1d90397e0041d33210c4b04b5e522`.
Only the accepted outer orchestration now expects candidate pass/baseline fail.
It was not edited in this task. Independent default and candidate probe pass;
exact baseline fails for the original normalized-depth reason. The focused
first/repeated/interleaved/default/absent/named/color/stencil/all-sixteen-mask/no-op
suite passes; its exact producer-adapter reverting mutation fails as required.
Raw logs and command/exit/memory receipts are under
`evidence/d3d9-clear-cache-independent-20261024/`.

All Node runs used oldspace 256 MiB, CPU limit 60 s, timeout 60 s, and fresh
MemAvailable above 805306368 bytes. Each finished below .11 s. On identifying
this blocking correctness failure, acceptance stopped as assigned. The producer
seven controls and seven cheap regressions were not rerun here; their earlier
receipts remain supporting evidence only. No compiler was invoked, so no new
excerpt/compiler/module acceptance is claimed. No full build, browser, real GL
driver, raster draw, guest or gameplay result is claimed.

## Publication and recovery

This branch adds only this report, the discriminating probe and its evidence;
all producer/reviewer/repair commits remain ancestors. It makes no production
repair and does not merge main. Fetch task/d3d9-clear-cache-independent-integrate-oct24
using the existing strict trusted SSH configuration. The new private explicit
sparse checkout is `/tmp/d3d9-clear-cache-independent-integrate-oct24/repo`.
The parent holds admission/manifest, full source/test diffs, setup warnings,
publication/resource/cleanup receipts. Read-only donors and installed tools were
used in place. Only this checkout's alternate list was flattened; deep alternate
warnings did not imply unavailable objects. No donor/index/ref edits occurred.

Measured input manifest: 3519247 bytes. Original projected peak: 56388608 bytes,
including checkout/Git, temporary/evidence, external full session/events/logs,
positive SQLite growth, future outputs and 8388608-byte reserve within 67108864.
Final receipts retain earlier charges/history and check per-file/capture/host
free-space limits. Initial bookkeeping fixes (python executable name and reading
sparse-absent evidence through Git blobs) changed no oracle or source.
Root tracked/index/refs stayed read-only; coordination used append-only board.
No box assigned: ID/state/expiry N/A; lifecycle remains coordinator-owned.
No workers, panes or deployment. Publication returns ownership to coordinator;
this worker stops without repair or integration.
