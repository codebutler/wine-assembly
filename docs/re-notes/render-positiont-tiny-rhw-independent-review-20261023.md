# Tiny-RHW repair independent acceptance, 2026-10-23

**ACCEPT_OFFLINE_SOURCE_ONLY** for production candidate
`301b568d2c9359a5fe8c8336002412c2c5d9f5e3`. The minimal repair fixes the
identified reciprocal-overflow mechanism. This accepts source and scalar
arithmetic only. It does not establish rebuilt pixels, depth, COM qualification,
native code generation, inlining, performance, WebGL, browser or game behavior.

Exactly one fixture provenance pin is updated in this review branch:
`test/support/positiont-com-source-pins.json`, entry
`src/09ah-d3d-software.wat`,
`40c91282b9ba9d10bc26e75b6383b6005362d23c` →
`538290c4241f9112ff5e16f5cd71735ab38edea9`.
Reviewed source SHA256:
`43ec7d8685cc4942dbdb30b8c9efacf28ec1add81fed4f55f008b7dbe9c4b0c3`.
The production source itself is inherited unchanged from the candidate. Other
285 pins, pin membership/order, fixture, expected pixels, controls and builder
are unchanged. The donor's original pin file remains untouched.

## Independent source trace and oracle validity

Exact candidate objects and the donor's retained numbered source excerpts were
read, including projection, raster interpolation, the three correction sites,
fallback backend flags, POSITIONT vertex output, shared admission, sampler and
channel conversion. Coordinator verification of all 14 retained/committed seals
is reused; the original ten pixel-center/30 tiny-quotient receipt and old-multiply
rejection are evidence, not native execution. No historical gates, guard tests,
decoder, build or COM probe was repeated. See adjacent
`identities-and-reuse.json` for exact identities.

The unchanged fixture stores FLOAT4 POSITIONT via setFloat32: RHW `1e-39`
becomes positive finite binary32 `0x000ae398`, approximately
`1.0000002153053333e-39`. Shared admission rejects it before allocation because
it is outside its positive power-of-two range. Fallback flags preserve screen
XYZ and use the fourth component directly as 1/W. Production project at
source lines 583–604 checks positive finite projection, copies screen XYZ and
stores attributes times this 1/W. It never requires reconstruction of clip W.
The finite post-VS position check at 469–472 also admits this value. The input
is valid for this established fallback contract; the shared range is not a
restriction on fallback rendering.

At the integer pixel centers, the equal RHWs interpolate to tiny positive iw;
`f32.div 1 iw` overflows to Infinity. The old multiply turns nonzero color and
UV into Infinity and zero components into NaN. Nonfinite UV samples return zero;
MODULATE and NaN-to-zero channel conversion explain the retained zero BGRA.
The white 1×1 texture, red diffuse `[1,0,0,1]`, z=.5, LESS against cleared depth1
and triangle `(0,0),(4,0),(0,4)` justify the unchanged opaque-red complete-frame
oracle. Slight subnormal rounding of .25 UV cannot alter this constant texture.
The old report's BGRA assertion wording mentions depth; it is not a depth dump.
The original nine preceding cases passed, tiny-RHW case180 failed, and later
cases plus all three COM negative controls were unexecuted. This review makes
no additional native observations.

## Scalar and call-site correctness

The maximum literal rounds to binary32 FLT_MAX. The ordered comparison
`abs(riw) <= FLT_MAX` accepts every finite reciprocal, including ±0, and rejects
±Infinity and NaN. In the accepted branch the exact old f32 multiplication
remains. No change to ordinary rounding or its occasional one-ulp disagreement
with division is introduced. In the other branch direct f32 division avoids
the extra overflow; numerator and denominator have already been rounded to f32.
The source does not silently clamp a denominator or replace exceptional values.

For positive or negative finite tiny nonzero denominators, division produces the
appropriate finite ratio, signed zero or true overflow. Negative tiny originals
are rejected by projection, but extrapolated outside helper lanes can have
negative or zero interpolated iw; those lanes are calculated before coverage.
The abs check handles both signs. For ±0 denominators, zero/zero remains NaN,
nonzero/zero remains the correctly signed infinity. NaN denominators/numerators
remain NaN; NaN payload identity is not promised. Infinite denominator yields
a finite signed-zero reciprocal and retains the old multiply (including NaN
for infinite numerator). No new division trap exists for floating point.

The reciprocal-overflow boundary is adjacent binary32 denominator bit patterns
`0x00200000` (infinite reciprocal) / `0x00200001` (finite reciprocal); both signs
and finite boundary behavior are covered. Normal finite iw, including very large
iw whose reciprocal is subnormal, preserves the old path. Projection or
interpolation can already have underflowed attributes to zero, or an interpolated
denominator to zero; the helper cannot reconstruct those lost values. For example
minimum-subnormal RHW times .25 becomes zero before this helper. That pre-existing
precision limit does not invalidate repairing avoidable reciprocal overflow.

All three calls pass the same local iw and riw and the original interpolation:

* Fog at line1292: snapshot offset128, already stored over W by project. Only
  the vertex-fog branch changes; Glide fog and table-fog branches remain intact.
* Main varyings at line1299: offsets16+4*j, j<28, original vmask zero shortcut,
  register banks and sprite-coordinate overrides preserved.
* Secondary color at line1323: offsets144+4*j, j<4, original vmask and v1 bank
  writes preserved. Its attribute multiplication in project includes these bytes.

The change is shared software rasterization, including non-POSITIONT and other
callers. Large ordinary clip W can also yield tiny iw, so the repair is applicable
there too. Depth interpolation, clipping, coverage and sampler policy are untouched.
Up to 33 helper calls per lane / 132 per four-lane quad replace inline multiplies,
with repeated finite checks. Masks and fog modes can reduce calls. Whether the
engine inlines them, and their actual hot-loop cost, remain unknown. This is a
correctness acceptance, with performance qualification still outstanding.

## Focused independent evidence

From this private review root:

```sh
python3 docs/re-notes/render-positiont-tiny-rhw-independent-review-20261023/run-focused.py
python3 docs/re-notes/render-positiont-tiny-rhw-independent-review-20261023/run-focused.py --pins
```

Both runner exits **0**. Adjacent per-command JSON/logs retain actual argv, exit,
fresh memory, capture and reaping evidence. The scalar reader evaluates only the
actual helper expression using f32 rounding; it is explicitly not native WAT
execution. An independent BigInt integer-rational nearest-even oracle checks
160 signed tiny quotients, plus a nonuniform per-vertex RHW/attribute weighted
case with exact lattice numerator and denominator (expected2.75). Explicit
zero/sign/NaN/infinity classifications and the reciprocal boundary are checked.
4,096 deterministic finite-reciprocal compatibility cases pass; 1,070 distinguish
the old rounding from unconditional division. Three source call sites are checked
structurally and manually traced above.

Three armed scalar mutations each exit **1**, at their intended assertions:
old multiply and removed-abs fail `tiny exact rational`; unconditional division
fails `finite reciprocal compatibility`. These are independent scalar controls,
not replacements for the three original COM controls. The original tiny case
and oracle remain unchanged and its existing focused receipt is reused.

The actual builder `test/support/positiont-com-module.js` was inspected as text
(adjacent `builder-reviewed.txt`), never imported. It hashes the JSON pin map,
verifies each file's Git blob and only builds on its explicit build entry point.
Thus a single pin edit is safely separable from native work. The invariant test
requires exactly286 entries and one exact authorized delta, exact reviewed blob
and SHA256, and unchanged fixture hash. It rejects a second unrelated pin,
a stale pin and altered source bytes. It does not assert other285 files have
been materialized/verified here; that remains a fresh builder gate.

New sourcePinsSha256 is
`d39a81a012129bd7c81f4f697d0a8317b3869a8195fc6fd32c1ff13fc3431262`;
old provenance identifies `f108ba0cae9dccea9d1628a7581e032e4743cfa54b2da4a21420857e7b7e3cfc`.
The original provenance therefore cannot qualify the new pins. No replacement
module hash or provenance was fabricated. The original ignored module remains
1,883,322B SHA256 `93f41b0fdce5494a235c789bd92f5dcf6cddb7ee16d721d0654a9f9958e7f0bb`,
provenance1,002B SHA256 `190a3d56230da32fcba586230ec08e6a6d96c552cc475eece9750a8e84373383`,
read-only and unchanged in the guarded qualification donor. Git is not their
binary backup; recovery is the donor's exact build recipe plus pinned inputs.

## Resource bounds and next acceptance command

`admission.json` measured focused source inputs before task execution and reserved
35,251,456/67,108,864B for source, private Git/index/new objects, temp, evidence,
external launcher current/growth, separate session JSONL current/growth, and an
8MiB reserve. Host free after all projected growth was5,935,872,768B, above
2,982,150,144. Installed tools run in place; standing read-only object stores and
artifacts are separately identified, not concealed by alternates. Publication
accounting includes directory overhead and actual source/Git/evidence/external/
session usage with future growth/reserve. Mandatory external launcher admission
remained intact. No dependencies were installed.

Each Node command has old-space256MiB (not an RSS limit), CPU/wall60s,
per-file24MiB, aggregate capture512KiB; fresh MemAvailable>=805,306,368B is required.
The runner uses a Linux child subreaper, process groups, TERM then KILL after5s
on limits and reaps owned descendants. All tests were short; no bound was hit.
No project imports autoload compilation, native module or arena constructors.

**Next operation is a separately assigned, admitted native rebuild task.** First
materialize the exact286-file closure using the old retained source manifest,
substituting only the reviewed source and this pin file; assert all other285
identities and the unchanged fixture/builder/guard. The old execute/preflight
drivers embed old manifests/session/paths and must not be blindly rerun.
After fresh combined64MiB accounting, disk floor, available-memory admission
(build>=2,684,354,560B), sole-heavy-owner handoff and accepted guard identities,
the exact next native payload in that new staged root is:

```sh
/usr/bin/prlimit --cpu=900 --fsize=25165824 -- \
  /home/user/.nvm/versions/node/v24.18.1/bin/node --max-old-space-size=2048 \
  --require /home/user/wine-assembly-shadow-man-native-bound-canonical-oct23/docs/re-notes/shadow-man-native-bound-canonical-20261023/native-module-bound.cjs \
  test/support/positiont-com-module.js --build-diagnostic \
  build/positiont-com-tiny-rhw.wasm build/positiont-com-tiny-rhw.provenance.json
```

This is **UNEXECUTED** and requires a newly reviewed wall900s/capture/reaping wrapper,
the accepted 8MiB pre-native guard, absent output paths and source verification.
Then verify all286 actual files, new module/provenance/extraWat identities before
qualification. With fresh qualifier memory>=1,610,612,736B, CPU/wall150s,
file/capture/reaping bounds and one512MiB arena, run the unchanged fixture:

```sh
/usr/bin/prlimit --cpu=150 --fsize=25165824 -- \
  /home/user/.nvm/versions/node/v24.18.1/bin/node --max-old-space-size=512 \
  --require /home/user/wine-assembly-shadow-man-native-bound-canonical-oct23/docs/re-notes/shadow-man-native-bound-canonical-20261023/native-module-bound.cjs \
  test/test-d3d9-positiont-com-qualification.js --qualify --allow-512m \
  --module=build/positiont-com-tiny-rhw.wasm \
  --provenance=build/positiont-com-tiny-rhw.provenance.json
```

Require complete baseline exit0, rebuilt tiny-RHW pixels/depth and every later
allocator-reuse/queue/final-release gate; then fresh processes with identical
arguments plus each of `--negative-control=disable-shared-route`,
`--negative-control=alias-queued-bytes`, `--negative-control=corrupt-queued-ir`
must show matching ARMED/intended failure (exit1). Stop at the first unexpected
result. All native acceptance remains mandatory and **UNEXECUTED here**.
Inlining/performance and real WebGL/browser/game remain unknown.

No native Module/Memory/Instance, arena, compiler, COM, runtime/Boat, GPU/browser,
guest, worker launch/refill, integration/merge/main/deploy or other-process
intervention. Shadow Man's heavy lane, RichEdit, Claude B&W2 and laptop ownership
are preserved. No box assigned: ID/state/expiry N/A; coordinator owns lifecycle.
This bounded worker stops after reviewed publication and hands back the next task.
