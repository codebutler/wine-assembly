# POSITIONT numerical admission repair, 2026-10-23

Bounded source repair of candidate `931aff173131780f76d5116c4b53a181e2be2eab`
following REQUEST CHANGES `d5ba96fc11f793fc3530ae296ecb64311c022489`.
No integration. Strict dedicated-key `ls-remote` independently returned remote
main `bb9c496ed13095cc832fdf607f0937fb9c14b7de`, candidate and review SHAs.
The shared root's local main was `fef550cf4706601b267ce7848d78a5681e57c843`;
it was read only. This isolated branch starts at the exact candidate.

## Reproduction and repair

Fresh compliant runs of the donor admission and edge controls, before editing,
reproduced finite f32 RHW `1.0000002153053333e-39`, z .5, identity depth:
the preserved software path returns1 and draws10 red pixels; admitted shared
IR returns1 and draws0. The RHW1 control draws10 red pixels on both paths.
The edge full-frame equality oracle exits1 on this difference. These runs use
the actual four production native fragments and actual software framebuffer
bytes, not recorded GPU calls. Before/after logs are in
`scratch/runs/20261023-render-positiont-rhw-admission-repair`.

Only production `lib/d3d-shader-ir.js` changes. It narrows JS admission before
`guest_alloc(288)`. The general fixed compiler, native profile export, software
rasterizer, backend fallbacks, ownership and queue implementations are unchanged.
The native descriptor has no vertex data, so its existing profile guard cannot
validate per-vertex RHW; no native guard change is warranted here.

The supported numerical subset is deliberately conservative:

- Identity viewport depth and all existing profile, stride, offset and z checks.
- Integer viewport x/y in [0,2048], width/height in [1,2048], matching the native
  descriptor domain before conversion to unsigned fields.
- Finite x/y inside that viewport, z in [0,1], positive power-of-two RHW in
  [2^-16,2^16], independently per vertex. Unequal RHW remains admitted.
- Finite reconstructed clip components inside all six clip planes and exact
  f32 round trips of screen x/y, depth and reciprocal W. Any failure falls back
  for the complete draw before descriptor allocation or compilation.

The arithmetic checked is the emitted POSITIONT VS in
`src/09aj-d3d-fixed.wat`: f32 sx=2/width, sy=-2/height, bx=-1-x0*sx,
by=1-y0*sy; RCP(RHW), separate MUL/ADD for viewport reconstruction, then MUL
by W. `src/09ag-d3d-shader-vm.wat` uses f32x4 division and separate multiplication
and addition for these native operations. The inverse checks follow the actual
f32 operations of `d3d_software_project` in `src/09ah-d3d-software.wat`, including
each rounding point. They validate eligibility only; native IR/DEF emission is
still authoritative.

Power-of-two scaling in this bounded range keeps W and recovered RHW finite,
normal and exact; a component may still underflow, which the exact depth and
coordinate checks catch. The bounds also leave ample headroom for reconstruction
and reciprocal interpolation. In-viewport vertices and positive W avoid shared
clipper-created vertices that have no counterpart in the old screen-space path.
Exact projection checks exclude finite cancellation/rounding of screen inputs.
This is a sufficient conservative software admission subset, not an assertion
that all other finite values are invalid graphics inputs. Their established
backend-specific behavior remains the fallback's responsibility.

## Fresh validation

Exact argv, exits and logs are in `checks.json`:

- `node test/test-d3d9-shared-positiont-ir.js`: exit0. Retains five corrected
  depth cases, explicit pixels/full frames, ordinary native selection with
  fallback traps, unequal-RHW color interpolation, MUL-to-ADD rejection,
  viewport DEF rebinding/constant poisoning, queue copies and GPU source
  recording. The moved viewport fixture now puts its vertices inside the moved
  viewport; it still independently checks changed DEF and immutable prior IR.
- `node test/test-d3d9-positiont-numerical-admission.js`: exit0. Ten exact
  expected-red-pixel,10-red-coverage and full-frame comparisons: ordinary RHW1,
  exact finite repro, both admitted bounds, below/above bounds, unequal bounds,
  unequal unsafe RHW, nonbinary reciprocal and large finite RHW.51 additional
  preallocation rejects cover nonfinite/nonpositive/subnormal RHW, adjacent f32
  boundary values, nonfinite/large/outside coordinates, finite cancellation,
  subnormal depth loss and invalid viewport fields. Admitted cases increment
  real native descriptor and compiler counters; excluded cases increment neither.
- The same numerical test with `--require ./scratch/runs/20261023-render-positiont-rhw-admission-repair/candidate-preload.js`:
  exit1 EXPECTED. The SHA-pinned exact931aff JS producer, with unchanged exact
  native inputs, fails the nonblack pixel oracle for finite reciprocal overflow
  before the new admission assertion. `reject-931aff.log` preserves the failure.
- `structural-controls.js`: exit0;23 retained depth/range/stride/offset/index
  rejects before allocation, unaligned backing-view/attribute-offset control,
  five direct native nonfinite/depth descriptor rejects.
- Retained `ownership-controls.js`: exit0; success, allocation-zero, native-zero,
  bad-bundle and read-error cleanup, plus overwrite of released native IR storage.
- Donor edge sweep after repair: exit0, including exact full-frame equality for
  the finite repro. Equal empty frames for invalid RHW are not positive evidence.
- Syntax, ordinary unit-tier classification and owned diff whitespace: exit0.

Two intermediate fixture failures are retained honestly: the first extension
used the original FLOAT4 nonzero-UV snapshot, whose tiny-RHW fallback is not the
review's expected-red fixture; the next accumulated too much allocation in the
original no-op-free8MiB arena. Final numerical checks use the exact review input
in a separate ordinary test/process with its own8MiB fixture arena. No production
change was made for these test-construction issues. Unrelated previously accepted
source checks from931aff/reviewd5ba are reused, not broadly replayed.

Focused output is69097B, SHA256
`5b12ae64af023d0203a5498ff594eaa38d9f7d90b50046533934f784e4c46ed8`;
fixture memory is exactly8388608B. This is not the canonical full module.
Native source is unchanged. `input-verification.json` pins35 unchanged
materialized candidate files; the precheckout manifest seals every copied input.

## Resource and qualification limits

The measured manifest was written BEFORE checkout creation:3847525B copied
inputs/Git/source/evidence,16MiB growth allowance,8MiB reserve inside64MiB;
upper29013349B. Projected free6535813787B exceeded required2982150144B.
Final storage measurement is in `allocation-final.json`. Existing read-only
donors and installed tools are recorded separately. Node24.18.1
(`/home/user/.nvm/versions/node/v24.18.1/bin/node`,123656816B) executes IN PLACE
under the user's corrected accounting; no tools were copied, acquired or installed.
No hardlinks, symlinks, broad fetch/archive, donor metadata writes or shared root
index writes. Thin-index publication preserves every unowned candidate path.

Pre-existing GPU fixed fallback limitations remain explicit: excluded depth/RHW
or coordinates are not newly qualified as matching software. GPU recordings
execute no GLSL and produce no pixels. No-op fixture frees do not prove real
heap reuse. Full canonical module/build, COM-to-host/real allocator paths,
actual WebGL1/2 driver compilation and pixels, games and performance all remain
separate qualification. No full compile, Boat/browser/guest/runtime/recovery,
media, GPU run, merge or deployment occurred. No box assigned/contacted;
box state/expiry unprobed. Coordinator retains lifecycle ownership.
