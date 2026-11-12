# POSITIONT depth admission repair, 2026-10-23

Bounded source repair of review `6ab1cff63f1759dc4284ce84fbe36f9545135745`
against candidate `5eb16d60dd9f5302060509185fb2ebbbad88bba4`, with exact main
base `bb9c496ed13095cc832fdf607f0937fb9c14b7de`. Main and both donor branches
were reconciled read-only with strict dedicated-key SSH. No integration occurs.

## Result and contract

The review correctly identified that the shared clip-space route clips screen
z outside viewport depth bounds and collapses depth for equal bounds. Preserve
the established behavior by narrowing the shared profile: viewport MinZ must
be 0 and MaxZ 1, and every FLOAT4 POSITIONT input z must be in [0,1]. NaN and
out-of-range depths also fall back. The JS producer checks this before descriptor
allocation; the native profile export independently rejects nonidentity depth
ranges. Its descriptor contains no vertex data, so input-depth admission is
the bridge's responsibility. General native fixed compiler exports are unchanged.

Nondefault and equal ranges return null to the existing backend-specific fixed
paths. This preserves software's pretransformed screen-depth/clipping semantics.
It does not claim to correct the pre-existing GPU fallback's depth reconstruction
or make all fallback semantics equivalent across backends. The admitted shared
profile still uses native IR and embedded DEF for both consumers. No shader VM,
rasterizer, GLSL emitter, top-left adjustment, queue or other profile was changed.
The added admission scans the draw's vertex bytes once; no performance result
is claimed.

## Acceptance evidence

`scratch/runs/20261023-render-positiont-depth-repair/checks.json` records argv,
exits and logs. All ten original checks exit 0, including the focused native
test, position-type replay, IR projection, shader lowering, fixed plan cache,
top-left, GPU allocation cleanup, neutral command stream, host dependency closure
and whitespace check. Only the four production WAT fragments are compiled into
the test's 8 MiB arena: module 69,097 bytes, SHA256
`5b12ae64af023d0203a5498ff594eaa38d9f7d90b50046533934f784e4c46ed8`.

The ordinary test now checks explicit expected BGRA and all framebuffer pixels
against the established software route for these five independent cases:

| z | MinZ / MaxZ | clear depth | expected BGRA at (1,1) | route |
|---|---|---|---|---|
| .5 | 0 / 1 | 1 | 0,0,255,255 | shared |
| .1 | .2 / .8 | 1 | 0,0,255,255 | fallback |
| .9 | .2 / .8 | 1 | 0,0,255,255 | fallback |
| .25 | .5 / .5 | .4 | 0,0,255,255 | fallback |
| .75 | .5 / .5 | .6 | 0,0,0,255 | fallback |

Only the default case allocates/compiles a shared descriptor. Three additional
default-viewport inputs (-.1, 1.1 and NaN) reject before allocation. Four direct
native descriptor depth-range rejects supplement the existing ten native
rejects. Existing eleven unsupported profiles, missing-export fallback, unequal
RHW interpolation, clip-space IR bytes, viewport x/y/size DEF rebinding, constant
bank poisoning, immutable snapshots, blend/depth and MUL-to-ADD rejecting oracle
remain exercised. The viewport-rebind control now uses admitted identity depth;
the five new cases explicitly cover the excluded ranges.

The independent review's depth script was copied into this run and corrected
to require expected matching pixels (exit 0). A rejecting control loads the two
exact old candidate producer sources in memory and runs that corrected oracle:
exit 1 at the first wrong expected pixel, with old module SHA logged. The separate
ownership replay exits 0 for success, allocation failure, compile failure, bad
bundle and read fault, including overwrite of the actual released native IR.
All 20 candidate and 20 review evidence seals and 54 unchanged materialized
candidate blobs were verified. The original reviewed files remain untouched.

## Scope, recovery and publication

Actual WebGL pixels, driver compilation, full canonical module/COM bridge,
real heap reuse, games and performance remain unqualified. GPU recording only
checks program/source/state/draw selection; it executes no GLSL. The test arena
uses no-op frees and does not establish production heap lifetime. No canonical
build, browser, Boat/runtime, worker, deployment or main integration was used.
No test box was assigned or operated; lifecycle remains coordinator-owned.

The mandatory measured manifest was saved before checkout in `admission.json`:
31,614,859-byte upper bound includes both entire used thin donors, copied Git,
tools/source/evidence/temp allowance and 8 MiB reserve, below 67,108,864 bytes.
Host free was 6,714,773,504 bytes, above the 2,982,150,144-byte floor even after
projected growth. `GIT_NO_LAZY_FETCH=1` applies throughout; no fetch, archives,
donor metadata or root index changes. The task branch descends from the candidate
and preserves its full thin index. A global diff probe after read-tree could not
read an absent unrelated blob; restoring the donor's exact thin index in this
isolated checkout restored the bounded checks without recovering that blob.

Recover on a normally sized authorized checkout of the published task branch,
run the commands in checks.json, and use the admission manifest for the focused
closure. The rejecting old-candidate control additionally requires its named
read-only donor at the documented absolute path. No ignored application binary
is needed or claimed. Publication uses write-tree --missing-ok and commit-tree
to preserve unmaterialized paths, followed by strict dedicated-key push and
independent exact remote SHA verification in publication.json and the append-only
root messageboard. Full runtime/backend qualification is a separate coordinator
dependency, not an outcome of this source repair.
