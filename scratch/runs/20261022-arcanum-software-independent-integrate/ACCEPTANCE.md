# Independent verdict: ACCEPT, historical compositor evidence only

Candidate: `ab0f4ec5085382a9ec1721156f127390b8706ea6`.
Reviewed independently on 2026-10-22, without runtime access, rebuild or packaging.

Raw sample endpoints yield 691 / 25.40108999999985 = **27.20355701271103
selected-layer compositor submissions/s**. All 27 samples and 691 events agree.
This does not establish logical game FPS, unique pixel frames, display refresh,
uninstrumented speed, Windows parity, audio, movement or full-game completion.
No presents/4 conversion or software/WebGL comparison is accepted.

The five-second ownership gate precedes the full interval in both command order
and browser timestamps: 120 events / 5.124655 seconds. Both owner receipts select
one live cooperative Arcanum instance, sole renderer owner, visible HWND 65537,
800x600 OffscreenCanvas overlay and software backend. Both actual Canvas2D
prototypes are covered. The driver refuses a full software interval before a
successful gate, rechecks ownership, bounds the interval and validates samples.
The gate is specific to this run, not a general proof across future app restarts.

Inspected the unchanged counter and historical renderer/filter source. Counting
occurs after the selected-layer draw returns and the plain-nearest filter copies
the derived source into the visible sink and returns true. The selected sequence
must differ from the last counted copy. Raw uploads (1,641 sequence advance),
RAF, Flip/API calls and repeated copies are not the measured event. This scoped
copy-chain observer is not a general occlusion or physical scanout detector.
Existing observer controls pass for hidden/no-op/wrong-copy/repeat/overwrite,
exceptions, replacement, restoration, geometry and OffscreenCanvas; the sample
positive case plus 11 rejection controls pass. Driver syntax passes.

Directly inspected both original measurement PNGs: matching crash wreck/fire,
corpse, standing characters and normal HUD; neither is a menu/dialogue scene.
The images support the measured scene, not a new movement qualification.

Verified all 176 changed on-disk candidate artifacts against the exact commit,
171 SHA-256 seals, the 9,243,446-byte archive hash and 136 exposed archive copies.
Independently hashed all 36 original installed files plus manifest (268,229,946
bytes), compared the complete installed path set and 35 manifest companions plus
EXE, and checked all 153 tracked source pins against historical c26252c4. Verified
canonical ce4ce4f9/c26252c4 Git tree equality, canonical qualification archive hash
and its shipping Wasm f644bbb26edc077239dac17b8b2cfda482aafd9eb44af4c4776d4fe153d5a1a7.
The retained dependency audit lists 362 startup imports and native/emulated
resolution; pre/post remote receipts report 226 runtime pins and 2,253 runner
pins. This review rechecks preserved receipts, not live remote files.

The tested source is c26252c4a95babe583ade1d1c6e2da0c050be45c. Neither the task
base nor current main is qualified by this historical source/module pair.
The first launch's five missing stock-font 404s and absent guest are preserved;
one configuration retest follows. This is a staging failure, not an engine
regression. No erased first failure or unsupported broader performance claim
was found in the scoped report/result.

Integration scope is the candidate's evidence, Arcanum note and measurement-only
harness/validator, plus this independent review. No production engine change.
Actual HTTPS GitHub main was 849e57e73d44c6d160f5db06367481547444c203 at review;
it must be freshly fetched/reconciled before normal, non-force publication.
All advanced main content outside these paths must be preserved.

`verify.py`, `checks.json`, `verification.log` and `admission.json` provide the
replay and guard evidence. The archive was read in place, not copied. Runtime
bx_4sszn2zj was not accessed: coordinator owns snapshot-stop; last candidate
receipt says running/healthy, expiry 2026-10-22T04:44:42.620Z. That historical
receipt is not a claim about its present state. No worker/lifecycle/deployment
or protected root/laptop/fleet/held-work changes were made.

Publication note: initial staging refused paths outside the sparse definition;
initial commit lacked repository-local author identity. No review commit was
created by those attempts. The task ref initially backed up the exact candidate;
staging with --sparse and command-scoped existing Codex identity correct this.
Coordinator board receipt subsequently records snapshot-stop completed at
03:20:19.397Z, operation stop_7eb1565f41c1e5e9; no runtime action by this reviewer.
