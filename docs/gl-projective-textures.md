# Projective texture coordinates: Oni implementation contract

Oni's New Game reaches unimplemented `glTexCoord4f` (API4430, vector form4431).
The captured scalar argument bits are `3a8c1452,3bb71048,00000000,3bb727be`:
q is not1. Evidence: `scratch/runs/20261011T1719Z-oni-webgl/browser-start.log`.
The browser WebGL menu already renders with the filename-case fix7b088a123;
the software gray-menu issue is independent. No API implementation is included
in this document.

## Correctness constraints

Carry homogeneous `(s,t,r,q)` through the texture matrix and vertex stream.
For a fragment, use interpolated S/Q and T/Q. Dividing at each vertex and
then interpolating is wrong. With clip-space vertex w, the rasterizer needs
interpolated S/w and Q/w (and T/w), independently for each texture unit.
Do not alter vertex position w to approximate texture q: that changes other
interpolants. Preserve existing API IDs and existing packed field offsets.

Current main480dc72e0 has the15-float vertex record from9be0a0efb; do not base
the fix on the older14-float source used in the first Oni diagnostic boat.
One possible appended layout is19floats: existing15, then r0/q0/r1/q1.
All producers, consumers, snapshots and stride checks must agree.

## Paths to update together

- `src/api_table.json`, dispatch generator GPU opcode map and generated tables:
  route4f/fv only after their implementations exist; retain fail-fast otherwise.
- `src/09a8c-gl-encoder.wat`: current texture components, packed vertices,
  copying/chunking/stride calculations, immediate and replay paths.
- `src/09a8e-gl-state.wat`: context save/reset/restore, current attribute stack,
  array defaults and four-component array reads.2f/fv must reset r=0,q=1.
  Audit display-list compile versus execution semantics.
- `lib/gl-command-stream.js`, GL host/worker consumers and `lib/gl-compat.js`:
  stride, attributes, full texture-matrix input, homogeneous varyings, fragment
  division, and border-sampling shader variants for both units.
- `src/09a8g-gl-raster.wat`: clip/interpolation records and separate texture-q
  planes, preserving depth/color/fog interpolation. Existing texture-matrix
  code divides per vertex, so do not extend that approximation to this API.

## Required regression

Render a screen-aligned quad with left `(s,q)=(0,1)` and right `(3,3)` using
a texture whose color boundary is u=0.5. Correct projective sampling crosses
at x=1/4 of the quad; a per-vertex-divide shortcut crosses at x=1/2. Test
both WebGL and software, and both scalar/vector API calls. Include q=1
baseline,2f resetting q, nonzero r under a texture matrix, state restoration,
and client-array/list paths. Test against the old implementation to establish
that the new case fails there. Run existing projective-vertex tests as well.

Then rebuild on a temporary boat with the filename-case fix, repeat the
ordinary Oni menu/New Game/Start route, and verify actual player movement.
Do not equate clearing the API trap with correct rendering or gameplay.

## WebGL texture-matrix prerequisite verified

The browser shader now carries matrix-generated S/T/Q and divides in the
fragment shader, including both texture units and the GL_CLAMP border path.
Extended test-gl-projective-web tests the quarter-width boundary (16/64),
independent position w and texture q (32/64), q=1 reset, WebGL1/2 and both
sampling paths. Old source fails with boundary11; all26 fixed cases plus
16 existing border checks pass. Evidence: scratch/runs/20261011T1846Z-oni-projective-matrix.

This does not implement glTexCoord4f/4fv, change the packed ABI, or fix the
software rasterizer. Those remain required before Oni can pass its trap.

## Software control reproduced, 2026-10-11 21:33 UTC

A diagnostic derived from test-gl-projective-vertex.js loads the same
S=3*s, Q=1+2*s texture matrix as the WebGL regression. At width32, the
software boundary is16 instead of8. With independent position w=1|3,
it is24 instead of16. The original position-w controls pass (16 and24).
Thus the texture-matrix per-vertex divide is an observed rendering failure,
not only a source-level concern. No GL implementation changed in this run.
Evidence and runnable diagnostic: scratch/runs/20261011T2133Z-oni-software-projective/.
The identity receipt records the actual boat source and raster SHA256;
the diagnostic exits nonzero intentionally, asserting the missing behavior.
It is not installed as a passing normal-suite test.

The source audit adds these concrete constraints to the implementation:

- Encoder record counts/copies/chunk limits use both15 floats and60 bytes
  throughout gl_append_vertex4, packed copies and primitive assembly. Change
  all producers together with GLCommandStream.VERTEX_FLOATS and JS fallback.
- Context records in09a8e are allocated/cleared as160 bytes, with the last
  currently used word at144. Appending four f32 values at148..160 requires
  at least164 bytes; update every allocation/reset and context restore path.
  Attribute-stack nodes separately save both texture pairs and need expansion.
- Software near/far clipping interpolates48-byte records. Adding q0/q1
  makes56 bytes. The near polygon at512 then ends736 (still before viewport
  at768), but five far records at784 would end1064 and overlap the normal
  matrix scratch beginning1024. Relocate/reserve these ranges together;
  changing only the interpolation stride corrupts lighting/texgen state.
- Preserve position reciprocal-w for depth/color/fog. Unit0 and unit1 need
  separate interpolated texture-Q/w denominators, including lines and points.
  Two-component calls/arrays must restore r=0,q=1, and four-component
  client arrays, display lists and context/attribute restores must retain q.

Next: implement this coordinated state/stream/raster change, then promote
this diagnostic into the existing regression and run both software and
WebGL quarter-boundary checks before replaying Oni. glTexCoord4f/4fv remain
fail-fast until the complete route exists; no gameplay qualification yet.

## Software texture unit 1 prerequisite implemented

Unit1 triangles now carry matrix-generated S/T/Q through clipping and
interpolate S/w, T/w and Q/w independently of vertex position w. The sampler
already divides these planes per pixel; its denominator now uses texture Q.
Unit0 retains its old per-vertex texture-matrix divide and remains pending.
The guest glTexCoord4 APIs and packed15-float format are still unchanged.

Clip records are now56 bytes, with reserved q0 and live q1 at48/52. The
far-clipped polygon moved to scratch+0x680 (five records end0x798, inside
the existing0x800 allocation), away from lighting and texgen scratch.
The existing clip pass copied only40 bytes of its previous48-byte records,
dropping unit1 coordinates on retained vertices; it now copies the full56.

Extended test-gl-projective-vertex.js: old source fails unit1 boundary16
instead of8; fixed source passes quarter boundary8, independent w/Q16,
near/far clipping within one raster pixel, identity reset and original
position-w controls16/24. Full build and existing software raster,
multitexture, lines and texgen suites pass on bx_k7xdfrq9. Evidence:
scratch/runs/20261011T2141Z-oni-unit1-projective/. This is a scoped renderer
prerequisite; Oni has not been replayed past its missing API.

## Software texture unit 0 triangle prerequisite implemented

Unit0 triangles now also retain homogeneous S/T/Q through clipping. Their
shared span keeps the existing S/w,T/w numerators and selects an independent
Q/w plane only during a GL triangle draw. Position reciprocal-w, color and
depth remain on their original paths. The GL-only denominator flag is cleared
after the draw, so ordinary D3D spans use their supplied denominator.

The regression now exercises each texture unit: control unit0 boundary16
instead of8 fails; both fixed units pass8, combined w/Q16, near/far clipping,
identity reset and the position-w controls. Full build, software raster,
multitexture, lines, texgen and D3DIM vertex-buffer draw (900 pixels) pass.
Evidence: scratch/runs/20261011T2147Z-oni-unit0-projective/.

This covers matrix-generated Q for triangles. Projective line interpolation
and unit1 line/point sampling remain separate; the guest glTexCoord4f/4fv
API/current state, context/attribute preservation and packed19-float stream
are still pending. No ordinary Oni gameplay replay or qualification yet.
