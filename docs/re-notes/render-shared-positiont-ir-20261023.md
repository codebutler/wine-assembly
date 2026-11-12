# Shared D3D9 POSITIONT native IR source candidate, 2026-10-23

Base: `bb9c496ed13095cc832fdf607f0937fb9c14b7de`. Branch:
`task/render-positiont-recovered-input-oct23`. This implements one bounded
source slice; it does **not** qualify the renderer or any game.

The supplied `docs/render-command-unification.md` proposal was read from the
coordinator workspace. That path is absent from the exact base tree. Its
Incremental implementation and Acceptance sections supplied the assignment;
no copy of the proposal is introduced by this change.

The existing WAT fixed compiler already emits immutable native IR with DEF
constant records. Software used that compiler, while WebGL used a separate JS
fixed-function plan. WebGL's guest-IR entry point correctly refused the native
fixed-origin flag. The migration therefore adds a bounded native export and a
separate fixed-origin GPU entry point rather than relaxing guest validation.

## Supported contract

The producer admits triangle list/strip/fan draws with no bound guest shaders,
exactly FLOAT4 POSITIONT0, FLOAT4 or D3DCOLOR diffuse0, and FLOAT2/3/4 UV0 in
distinct registers. Texture0 is a 2D texture; stage0 uses MODULATE with TEXTURE
and DIFFUSE for both RGB and alpha. Stage1 terminates the cascade. Lighting,
fog, specular, alpha test, color key, user clipping and outline fill are outside
this profile. Ordinary existing depth/blend state remains in the draw packet.
Other profiles and older native artifacts retain the previous fallback.

`d3d_fixed_compile_positiont` validates the bounded DFX1 profile and invokes
the existing compiler. The read-only DFB1 adapter exports version1,
`positiont-modulate`, `d3d-clip`, `embedded-def`, and copied vertex/pixel IR.
The bridge frees the native bundle and descriptor before publishing the
packet. Both executors consume these same serialized IR/DEF bytes, ignoring
the guest programmable constant banks. Software bypasses its fixed-state
compiler for the packet; WebGL bypasses its JS fixed plan.

Both use the clip-space vertex program, rather than selecting the old
software-only screen-coordinate variant. Software therefore uses its ordinary
clip-space raster projection. The GPU adapter retains the established D3D
integer-center/top-left conversion of 0.5 - 1/16 pixel after IR execution.
Queue transport, resource identities, leases, presentation, completion and
readback code are unchanged. The recording GPU test observes zero readback or
finish calls for the supported draw; these are test-double observations, not
measurements of a browser driver.

## Validation

`node test/test-d3d9-shared-positiont-ir.js` compiles only the four existing
native IR/VM/raster/fixed fragments, unchanged except for the added export,
with the vendored WATX compiler. It validates and executes a 69,067-byte module
with an 8 MiB test arena. Module SHA256:
`49311866a815fdf9719c8cb4fa5d5f713fa4c189d2ea096d3d9a5558e6be5591`.
The arena replaces guest allocation/address translation, does not reclaim
allocations, and cannot qualify the canonical heap or its lifetime behavior.

Passing controls cover exact IR-byte differential against the existing native
compiler; independently expected viewport DEF; immutable copies; changed
viewport constants; poisoned guest constant banks; eleven unsupported-profile
fallbacks and missing-export fallback; ten direct native descriptor rejects;
independently expected native texture/diffuse pixels, depth order, alpha blend,
and unequal-RHW interpolation; four full-image comparisons to the preserved
native software fallback; and queued snapshot mutation behind an incomplete
command. A MUL-to-ADD corruption executes but fails the same expected-pixel
oracle, proving the semantic rejecting control.

The production GPU consumer is exercised with a recording GPU. The test makes
both duplicate fixed compilers throw, confirms the native GLSL sources and
raster adaptation, and observes a draw. It does **not** execute GLSL or produce
GPU pixels. The existing position-format test is also run through the focused
native module using the retained replay adapter; its assertions pass, but its
canonical application/heap environment is not claimed.

Existing shader IR view, D3D9 shader lowering, fixed-plan cache, fixed top-left
bias, GPU allocation/retirement, and neutral command-stream tests pass without
the canonical build. Exact commands, exits and logs are in the evidence run.
Test tier classification is automatic UNIT by the existing filename rules;
no central test list edit is needed.

## Outstanding acceptance

Real WebGL1 and WebGL2 compilation/pixels, complete guest COM-to-bridge drawing,
canonical application compilation and heap lifetime, actual GPU readback
counts/bytes/causes, and representative D3D/OpenGL/Glide game captures remain
unexecuted. The five proposal Glide regression cases (NFS II SE, NFS III,
Diablo II, Hitman and Hype), gameplay and performance are not qualified.
No runtime, Boat, browser, lifecycle operation or deployment was performed.
No test box was assigned; `bx_fn7pn7yg` remains coordinator/Shadow Man owned.

Evidence and recovery:
`scratch/runs/20261023-render-positiont-recovered-input/` contains admission,
exact input recovery, measured dependency closure, commands/exits, logs and
the existing-test replay adapter. The coordinator's recovered stream input
is exactly 47,664 bytes, Git blob
`1af9d8eb5f9cc476de30c9097452ae6870cf79cc`, and is unchanged by this patch.
All unmodified base paths are preserved in the thin index; publication uses
`write-tree --missing-ok` because intentionally unmaterialized blobs are absent.
