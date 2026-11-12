# Qualified POSITIONT integration, 2026-10-23

Reviewed integration of accepted head `95a12b641d2b9195762c4800a1db8e3b76a3ceee`
over fresh strict-remote main `6666ab7b28c9efca61c3ce6875c05da71111507a`.
The task branch is `task/render-positiont-qualified-integrate-oct23` in private
root `/home/user/wine-assembly-render-positiont-qualified-integrate-oct23`.
Session: `01a1678d-7618-70d2-994a-2a3efeec5d8b`.

The integration carries the exact accepted POSITIONT source, tests, documentation
and retained evidence. It preserves all unrelated main entries, including Claude's
B&W2 documentation, TODOS row and run evidence. The shared checkout's HEAD and
index are never updated. Shadow Man, RichEdit, Claude's separate heap repair and
laptop claims remain outside this task.

## Review and qualification coverage

The exact [219-path accepted delta](render-positiont-qualified-integrate-20261023/accepted-delta.patch)
was reviewed against old main `bb9c496ed13095cc832fdf607f0937fb9c14b7de`.
It contains seven production files, eight test/support/tier files, and scoped
POSITIONT reports/evidence. No historical branch was blindly cherry-picked.
The [linear ancestry](render-positiont-qualified-integrate-20261023/ancestry.txt)
and [acceptance coverage](render-positiont-qualified-integrate-20261023/acceptance-coverage.json)
bind the complete chain:

- Shared IR, both consumers, depth restriction and numerical admission through
  `5427a9e2e7d20984249cadcf67f1cb33cc9d85c0`: independent acceptance
  `6ac29d0c4bd8def2f5cf06d4cac1795a08f1e754`.
  Its [exact acceptance report](render-positiont-qualified-integrate-20261023/accepted-source-review.md)
  covers inherited source and software pixels; GPU recording executes no GLSL.
- Original COM fixture `7aef3ff22f0dbe4fbfe739196bf92ad7a9435fb6`:
  independent offline acceptance `aea185d3dfc1b772cea00ca1a4aed14b9553dfed`.
  Its [exact report](render-positiont-qualified-integrate-20261023/accepted-fixture-review.md)
  covers render-helper, prebuilt loader/builder, guards, pins and tier changes.
- Tiny-RHW source `301b568d2c9359a5fe8c8336002412c2c5d9f5e3`:
  independent source/scalar acceptance and single provenance pin update
  `345ea682b7ff6f70d942315051c01f935e1bbcd2`.
  The accepted source blob is `538290c4241f9112ff5e16f5cd71735ab38edea9`.
- Fixture-only allocator checkpoint/order correction
  `c9a59870ff46416653d0782ebfc296df1bb0ae59`: independently accepted and
  fully retained-module qualified by the exact accepted head `95a12b641`.

Native qualification is **reused, not replayed**. The accepted
[full qualification report](render-positiont-reuse-independent-qualification-20261023.md)
and adjacent four exact command receipts/raw logs show baseline exit 0, then
ARMED `disable-shared-route`, `alias-queued-bytes` and `corrupt-queued-ir`
exits 1 at their intended route or queued complete BGRA/depth assertion.
Baseline covers tiny-RHW/recovery pixels and depth, six authentic reused
allocation addresses with 34164 requested bytes, poison/hash, queue copying,
invalid ranges, resource releases and final device destruction.
The prior no-op-free run causally rejects at the unchanged 1 MiB request limit;
its runner postcondition mismatch remains **NOT runner PASS**.

The prior 52 gates, decoder, scalar arithmetic, build and causal/native runs
were not repeated. The current explicit integration authorization is scoped to
this accepted source/software/COM chain. It does not claim real WebGL1/2 driver
compilation or pixels, browser, gameplay or performance qualification. Historical
reports retain their original outstanding requirements and superseded blockers.

## Fresh main reconciliation and exact tree checks

[Strict remote lookup](render-positiont-qualified-integrate-20261023/remote-before.txt)
returned main `6666ab7b` and the exact accepted task head. Both descend from
old main. Main's 56 changed paths are documentation/TODOS and B&W2 run evidence;
they overlap neither the 219 accepted entries nor any qualified input.
Their [mode/blob manifest](render-positiont-qualified-integrate-20261023/preserved-current-main-delta.json)
and [main documentation delta](render-positiont-qualified-integrate-20261023/current-main-docs.patch)
remain unchanged. B&W2 run artifacts are preserved by mode/blob identity; they
are not added as integration evidence or executed here.

The [Git-object verifier](render-positiont-qualified-integrate-20261023/verify-integration.py)
compares every unrelated tree entry against fresh main, every accepted entry
against the accepted head, and all 290 closure blobs/modes against its manifest.
It reads committed Git blobs, not absent focused-checkout files. All 286 pin
entries, pin order/digest, source bytes/SHA256, fixture identity and file modes
match the qualified candidate. The [proposed-tree proof](render-positiont-qualified-integrate-20261023/proposed-tree-proof.json)
contains the complete qualified closure and a digest of the preserved unrelated
manifest. Publication also requires this verifier against actual commits.

Reviewed merge commit `620cc1c290d88590b368e90db5d55bd96af4c51f` has parents
fresh main and the exact accepted head. Its
[committed-tree proof](render-positiont-qualified-integrate-20261023/committed-tree-proof.json)
passes all 286 pin/blob checks, 290 closure mode/byte checks, fixture identity and
unrelated-tree preservation checks. The
[task backup receipt](render-positiont-qualified-integrate-20261023/task-backup.json)
records an actual strict-remote match for this tested merge before main publication.
A subsequent documentation-only commit retains this proof; its final committed
tree receives the same verifier before publication, with the final receipt in the
external publication directory below.

The [static checks](render-positiont-qualified-integrate-20261023/static-checks.json)
pass owned production/test/support/tier `git diff --check`; historical raw logs
remain verbatim. No project JS was imported and no default compile path invoked.
The first local preparation check expected nine test/support/tier entries rather
than eight and stopped before index construction. Both its failure receipt and
the corrected passing receipt are retained; production/fixture code was untouched.

## Retained artifact and recovery

Read-only retained module:
`/home/user/wine-assembly-render-positiont-tiny-rhw-native-qualification-oct23/build/positiont-com-tiny-rhw.wasm`,
1883361 bytes, SHA256
`5d057b5424b710fb28f1c617786ba71d7c8c116fb74e51eac611ec9a79868ef1`.
Adjacent `positiont-com-tiny-rhw.provenance.json`, 1002 bytes, SHA256
`e64c83f925f52649f46e1a89bb952d7dde06d627f7a799f0956a535c1bca8cc3`.
Source pin digest:
`d39a81a012129bd7c81f4f697d0a8317b3869a8195fc6fd32c1ff13fc3431262`.
Extra-WAT digest:
`4bd65ac87452abb4ec5f728f88b399439c9fa4fec91a53b3e6cb96468f58d068`.
Both artifact identities and provenance fields are rechecked as bytes only.

Git does not back up ignored binaries. These exact retained paths stay in place;
no relocation or rebuild occurs. The existing
[recovery recipe](render-positiont-tiny-rhw-native-qualification-20261023/recovery.md),
its source manifest/build receipt and the full qualification report preserve
reconstruction and replay instructions for a separately authorized future task.
Those commands were not executed by this integration task.

## Admission, publication and handback

The [single consolidated admission](render-positiont-qualified-integrate-20261023/admission.json)
measured projected peak **41638442/67108864 bytes**, including private Git/index/
new objects, focused copies, temporary/generated evidence, capture, external
launcher events/stderr, separate session JSONL plus future growth and an 8 MiB
reserve. Host after projected growth was **4872280840 bytes**, above 2982150144.
Standing donors, ten explicit direct object stores and installed tools were
separately measured. No archived recovery, hidden linked copies, tool install,
native Module/Memory/Instance, build, browser/GPU/guest/Boat or donor mutation.

Commands use CPU/wall 60 seconds, regular-file cap 24 MiB, aggregate capture
512 KiB, fail-closed 125, TERM then KILL after five seconds and subreaping.
The Git tree checks are the relevant fresh checks for this unchanged qualified
source integration. All owned command groups are reaped. No heavy lane or box
was used; box ID/state/expiry N/A. Runtime lifecycle remains coordinator-owned.

Publication uses a tested task backup followed by a normal fast-forward remote
main update, with a fresh strict-SSH remote check immediately beforehand and
actual main/task SHA verification afterward. No force push or public deployment.
Immutable committed-tree verification and publication outcomes are recorded in
adjacent evidence where available and externally at
`/home/user/wine-assembly/scratch/usage-watch/render-positiont-qualified-integrate-oct23-session01a1678d/`.
This worker stops after this bounded integration; the coordinator owns assignment.
