# Independent POSITIONT source review, 2026-10-23

Historical source last updated, 2026-10-23. Runtime and implementation claims below describe that dated source; see current app notes and source for subsequent changes.

Verdict: **REQUEST CHANGES** for candidate
`5eb16d60dd9f5302060509185fb2ebbbad88bba4`, branch
`task/render-positiont-recovered-input-oct23`, base
`bb9c496ed13095cc832fdf607f0937fb9c14b7de`. Strict authenticated `ls-remote` independently matched candidate and main. Main is still the supplied base; this review performs no integration.

## First correctness gap: POSITIONT depth and clipping regression

At `lib/d3d9-software-backend.js:899`, the migration disables the
pretransformed raster flag for every shared native packet. The native fixed
compiler's existing clip-space program reconstructs z as
`(POSITIONT.z - MinZ) / (MaxZ - MinZ)`; when the denominator is zero its scale
is zero (`src/09aj-d3d-fixed.wat:521`). This program now enters homogeneous
clipping and ordinary viewport depth projection.

The previous software POSITIONT path deliberately skips homogeneous clipping
and copies screen x/y/z, retaining RHW for perspective varyings. See
`src/09ah-d3d-software.wat:584` and the explicit POSITIONT comment at line 683. The profile admits nondefault and equal viewport depth bounds without excluding
the affected vertex depths. Therefore an otherwise supported draw changes
observable pixels when it is migrated.

The independent `depth-controls.js` executes the actual native fragments and
both production software routes. All cases use a white texture, red diffuse,
triangle `(0,0),(4,0),(0,4)`, RHW=1, LESS depth, and pixel `(1,1)`:

The second and third rows are clipped away. The last two demonstrate both
directions of the wrong depth decision: the shared path collapses depth to .5. Every case is accepted by the new producer and by the software viewport
validator. This is an introduced software regression; no new GPU pixel
regression is asserted (the old JS WebGL emitter already reconstructs z).

Hand production repair back to the coordinator: preserve the pretransformed
depth/clipping semantics or narrow admission safely, then extend the normal
pixel differential to these cases. Do not infer that shared IR bytes alone
make raster semantics equivalent. No production file or candidate test was
changed by this review.

## Other reviewed boundaries and evidence

All ten donor checks independently replayed with exit 0. The exact focused
module is 69,067 bytes, SHA256
`49311866a815fdf9719c8cb4fa5d5f713fa4c189d2ea096d3d9a5558e6be5591`,
using the declared 8 MiB arena. This includes native texture/diffuse, depth,
blend, unequal RHW, viewport DEF, guest-bank poisoning, four fallback image
comparisons, eleven JS profile rejects, ten direct native descriptor rejects,
and the MUL-to-ADD semantic rejecting control. Existing tests do pass; their
viewport comparison uses z=.5 inside [.2,.8], so it misses this gap. No false
pass of their stated individual pixel oracle was demonstrated.

`ownership-controls.js` independently verifies descriptor/bundle frees on
success, zero descriptor allocation, zero native compilation, bad bundle
projection, and a thrown postcompile memory read. It overwrites the actual
released vertex IR storage and confirms the packet retains its bytes. The
candidate's own storage-reuse assertion overwrites descriptor storage rather
than native IR; this independent control supplies the stronger check. Native
heap reuse is still unqualified: the arena's frees are no-ops. The new controls
exit 0 when all expected rejection/cleanup assertions and all four demonstrated
pixel differences hold.

GPU recording checks production shader selection/source/state and draw calls;
it executes no GLSL and produces **no actual WebGL pixels**. Real WebGL1/2
compilation/pixels, full COM-to-bridge/canonical module and heap behavior,
actual-driver readback counts/causes, games and performance remain unqualified. No full build, Boat, browser, runtime, lifecycle, deployment, worker or main
write was performed. No test box is assigned. `bx_fn7pn7yg` remains owned by
the coordinator; its state/expiry were not probed in this source-only task.

## Reproduction and accounting

The measured whole allocation manifest was written **before checkout**:
26,757,246-byte upper bound, including donor/copy Git/source/tools, temporary
and evidence allowances, and 8 MiB reserve; cap 67,108,864 bytes. Host free
6,726,496,256 bytes exceeded the 2,982,150,144-byte floor including projected
growth. `GIT_NO_LAZY_FETCH=1` applies throughout. A local isolated copy of the
small focused donor supplied all inputs: no raw recovery, broad fetch/archive,
or donor metadata change. All 57 materialized tracked candidate files match
their Git blob identities and all 20 donor evidence seals verify.
