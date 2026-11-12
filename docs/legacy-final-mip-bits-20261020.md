# Final legacy mip filter bits

Audited fetched main `a1704200c21b6e5a961d0d39093609891956f489`.
Both remaining advertised mip bits are unsupported. The only production change
is `fill_primcaps.dwTextureFilterCaps`: **F3 → C3**, clearing **0x10 and 0x20**.
DX7 descriptor builders inherit **030003C3**. Other fields and bits are unchanged.
Existing exact-mask tests are reconciled, including the previous mip suite.

## Exact legacy meanings

The retained Microsoft SDK `d3dcaps.h` lines 251–252 and `d3dtypes.h`
lines 985–986 identify these constants (copies and hashes in the evidence).
They came from Microsoft's win32metadata `generation/WinSDK/RecompiledIdlHeaders/um/`
directory, retained by the preceding audit, not from modern stage filter enums.

| Capability | Legacy D3DFILTER value | Required operation |
| --- | --- | --- |
| LINEARMIPNEAREST, 0x10 | 5 | Point sample two adjacent mip levels and interpolate between their colors |
| LINEARMIPLINEAR, 0x20 | 6 | Bilinear sample each of two adjacent mip levels and interpolate between their colors |

The semantic distinction is documented in Microsoft's
[D3DPRIMCAPS contract](https://learn.microsoft.com/en-us/windows-hardware/drivers/ddi/d3dcaps/ns-d3dcaps-_d3dprimcaps)
and [archived D3DPRIMCAPS documentation](https://learn.microsoft.com/en-us/previous-versions/ms896914(v=msdn.10)).
In particular, LINEARMIPNEAREST is **not** bilinear filtering within one level.

## Implementation and evidence

In `src/09ab-handlers-d3dim-core.wat`, both the filter selection in
`d3dim_draw_tl_triangle_textured` and `d3dim_gpu_describe` recognize only value 2
as linear. With stage MAG/MIN and legacy MAG unset, legacy MIN values 5 and 6
produce `linear=0`. `d3dim_texture_sample_keyed` then fetches a point from its
single supplied image; its interface carries neither a second mip image nor
an LOD interpolation weight. Its actual fetch/decode helpers read that image.
`lib/d3dim-gpu.js` lowers the descriptor to point min/mag with `mip: 0`.
Neither path performs the required between-level interpolation; value 6 also
lacks the required within-level bilinear sampling.

`node test/test-legacy-final-mip-bits.js` executes extracted production WAT:
filter selection, descriptor filter writes, sampler, address helper, bilerp,
keyed/prepared fetch, format decoder and expand helpers. It also executes the
actual JavaScript sampler assignment. No hand-written pixel-fetch implementation
stands in for the production code.

The 36 state cases cover legal stage point/linear controls and legacy
point/linear/5/6, at each fallback source with stage MIPFILTER 0/1/2.
The legacy MIN-only cases explicitly reach values 5 and 6. Each case samples
real memory containing a 4x4 black/white checkerboard and a separately bound
2x2 red/blue checkerboard. Controls yield the expected point or bilinear colors;
5/6 yield point colors. These are separately bound images, **not** a harness
that invents mipchain selection or derivatives.

There are 90 descriptor-field checks through the actual builders and extracted
GetCaps 1/2/3/7 handlers, covering both primitive types, HAL/HEL, sizes,
alignment, return/stack effects and bounds guards. Enumeration-to-builder
wiring is asserted; callbacks are not run.

Ten mutation controls reject each re-advertised bit separately, both together,
lost point/linear support, unrelated bit clearing, enabled GPU mip filtering,
software recognition of each value 5/6 as linear, and broken production pixel
loads. The unchanged main baseline passes backend observations and fails on
the advertised 0x10 bit. Separate 0x20-only re-advertising proves that bit is
independently rejected, too.

The four existing source suites pass after exact-mask reconciliation; their
old reviews are not reopened. Native enumeration is syntax-checked only.
This is extracted-source evidence, not a canonical build, full VM, native COM,
callback/lifetime, complete draw, actual GPU render, automatic mipchain, or game
qualification. No runtime, Boat, browser, worker or main merge was used.

Self-contained snapshot, baseline, replay, logs, provenance and hashes:
`scratch/runs/20261020-legacy-final-mip-bits/`.
