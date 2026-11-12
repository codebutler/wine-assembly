# Independent D3D late-batch fixture acceptance, 2026-10-23

Historical source last updated, 2026-10-23. Runtime and implementation claims below describe that dated source; see current app notes and source for subsequent changes.

**Verdict: ACCEPT the fixture repair as a correction to the documented production contract, with fresh offline acceptance. Native qualification remains BLOCKED and unclaimed.**

Reviewed candidate `09dc88de08907d362eef2ac5dbbaad0080147358`, branch
`task/d3d-late-batch-failure-repair-oct23`, directly against its parent and exact
main `7f7358c160ae7185fc38f9a15447a6d20c00f97e`. This independent report branch
starts at that exact main. No production or regression-fixture corrections were
needed or made. The candidate changes no `lib/` or `src/` bytes, preserving the
accepted whole-large-arena fix and its existing arena-reuse regression.

## Independent contract assessment

The original assertion was applied in the wrong execution mode. Production
`Device.prepare` explicitly chooses streaming when deferred peak reservations
cannot all coexist, and explicitly allows earlier batches to remain drawn after
a later failure. This deliberate contract predates the repair (streaming change
`3a908f97bafc0a25f18938b1f4913fae959115ed`). Retained mode prepares every batch
before its first raster step. Both modes publish samples only after full success. Queue failure and retirement do not promise pixel rollback. Exact source blobs,
SHA-256 identities, extraction recipes, excerpts and the actual fixture diff
are retained in adjacent `contract-review.json`.

The repair restores the original budget before exercising retained-mode
atomicity and asserts the mode. It separately selects streaming and compares
late failure with a successful two-batch prefix, while requiring unchanged
published samples, baseline device accounting, no live contexts and no pending
setup records. It retains exact success pixels and `800 * 36` samples. This
preserves an atomic assertion where the implementation promises one; it is not
acceptance obtained solely by removing an oracle.

The new native test assumptions are valid for this fixture:

- The splitter has both a 256-triangle and a 256-distinct-vertex limit. This
  unindexed input has three distinct vertex records per triangle. Independent
  execution of the actual splitter yields index counts
  `[255,255,255,255,255,255,255,255,255,105]`. Descriptor count is the input index
  count, so the first two saved counts divided by three yield **170 triangles**. Independently splitting the sliced prefix produces byte-identical vertices
  and indices for exactly those two batches. Saved record values are copied
  numbers, not later reads from freed context addresses.
- `live.delete(pointer)` tracks a lifetime, permitting reuse after retirement. The pending descriptor entry is removed at completed preparation or release. The fixture uses immediate/deferred constructors without typed constants or
  user clip planes, so its wrappers cover these exercised paths. A fresh
  streaming control using one reused native address passes; a repeated release
  is rejected. This does not establish native allocator correctness.
- The fixture's small contexts remain eligible for ordinary shrink. The accepted
  whole-large-arena exemption applies to different, large context allocations;
  the separate arena-reuse test deliberately covers those and is unchanged.

Limitation: the native prefix repeats identical triangles, so equal final pixels
alone cannot distinguish one successful batch from two. The third-create
injection establishes the intended boundary in the JS path; independent offline
traces with distinguishable marker writes verify two raster calls. The new
native pixels, heap-header assertions and native release behavior still require
actual execution. No export-double result is treated as native evidence.

## Executed scope and rejecting controls

The adjacent `independent.js` executes the actual producer `Device` and geometry
splitter from the exact retained donor. It reuses the producer's explicitly
synthetic export fixture constructor, with independently written assertions and
mutations; it is not an independent native implementation.

Fresh results: **five positive checks and five rejecting controls PASS**. Positive checks cover late retained/streaming failure, streaming address reuse,
saved-count prefix equality, and Set lifetime/repeated-release behavior. Controls
are required to fail with `AssertionError`, detecting missing native release,
premature sample publication, missing prefix writes, incorrectly accepted third
creation, and retained rasterization before all validation. Mutations exist only
in disposable test objects/in-memory fixture text. Production files are untouched. The producer's complete nine-scenario harness was also freshly executed and
passed, including synchronous/asynchronous failures, cancellation, success and
ordered-queue failure. Commands and receipts are adjacent in `execution.json`,
`independent-results.json` and `producer-nine-results.json`.

## Native admission and exact remaining gap

The standing dependency resolution additionally returns `MODULE_NOT_FOUND` for
unconditionally required **pngjs**. Optional GL providers are absent too; their
absence is not used to claim they are needed for the software route. No package
was installed, no archived recovery attempted, and no native gate continued
past the failed prerequisite. The static import inventory is not represented as
a fully resolved native dependency closure. Backend default fonts would also
need measured identities if that test were admitted.

Thus no compiler, Wasm instantiation, native pixels/resources, compaction native
test, arena-reuse native test or backend suite ran. No candidate/module/compiler
execution hashes can be claimed; candidate and compiler **source** identities
are sealed in the manifest. The remaining gap is precisely those real-export
tests under a complete resolved, resource-admitted, phase-enforced closure. This bounded task ends with that blocker, without proposing a successor task.
