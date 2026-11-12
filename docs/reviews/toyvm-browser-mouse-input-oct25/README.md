Browser mouse input implementation, 2026-10-25

Source base: d9012a86a91c13dbe70dbcc4dceff2d7895c18a4. Task branch:
task/toyvm-browser-mouse-input-oct25. No main integration or deployment.

The shared bindInput binding (also exported as bindKeyboard for compatibility)
delivers absolute mouse position and left/right/middle button bits to LiveRun's
existing INT33 state. It counts transitions once and accumulates deltas between
absolute samples, without an initial origin jump. Canvas CSS offset/scaling and
clamping are handled independently from guest coordinates: low-resolution graphics
use at least 640 horizontal units, text uses 640x200, and larger graphics use the
canvas backing resolution. Existing guest-programmed ranges remain unsupported.
No changes to dos.js or emulator execution semantics were needed.

Both actual browser launchers now own and dispose their binding with the run.
Blur, hidden document, pagehide, cancellation, lost capture, stop, exit and detach
release buttons. Retry changes owner and discards held gesture state; late input
cannot mutate the previous run. Pointer Events use mouse pointers only, with a
mouse-event fallback where PointerEvent is absent. Existing keyboard handlers,
touch-to-Enter and audio startup behavior are retained. The corpus launcher binds
before startup and disposes on a failed startup as well as ordinary stop.

Unsupported: pointer lock/relative gameplay, wheel, touch/pen mouse emulation,
custom INT33 ranges/sensitivity and mouse callback interrupts. The existing INT33
edge query returns the current position rather than retaining per-edge positions;
this task preserves that existing behavior. DOM/state fixtures establish input
delivery and polling semantics only. No browser, guest, native compiler, Wasm
Module/Memory/Instance or game ran. Gameplay, sound and FPS remain unqualified.

Validation commands (Node heap 128 MiB, CPU/wall 60 seconds each):

    node test/test-toyvm-mouse-input.js --bundle --controls
    node test/test-toyvm-live.js --input-only
    node test/test-toyvm-held-keys.js
    node test/test-toyvm-dos-corpus.js
    node tools/toyvm/site.js --js-only
    node tools/toyvm/bundle-browser.js
    node tools/toyvm/bundle-browser.js --check

The original binding fails the focused fixture at scaled/offset movement delivery
(actual x=160, expected x=320); baseline.log retains the failure. The repaired
binding passes source and generated main-bundle fixtures for Pointer Events and
fallback mouse events. Removing mouseInput or releaseMouse is rejected. The mouse
fixture arms throwing guards against Wasm allocation/compilation. The full existing
live test is deliberately not run: --input-only selects only the input fixture.
Held-key tests pass and all 23 static corpus assessment tests pass. Payload-dependent
manifest freshness is skipped because payloads are absent. The manifest change is
only the mouse fact and seven cautions; title status, blockers, original identity
and recorded gameplay evidence are unchanged. Both generated bundles are current.

Operational qualification: the initial sparse checkout pattern accidentally
materialized generated corpus payloads, measuring 113,292,552 directory bytes and
exceeding the 64 MiB task allocation. They were never executed and were removed
by narrowing sparse patterns. Subsequent measured files were about 9.5 MiB, with
a projection below 52 MiB including 40 MiB for publication, session/shared database
growth, futures and the 8 MiB reserve. The original cap overrun is not retroactively
compliant. A broad Git search also exceeded the capture guard; its output was
discarded and subsequent reads were path-bounded. See resource-correction.json.

Recovery: use the task branch with an exact sparse checkout of the changed files,
plus tools/toyvm, lib/compile-wat.js, lib/wat-manifest.js, tools/dos-exe-scan.js and
the pre-existing fonts/Terminal.fon. Run the commands above without starting the
guest. Generated JS bundles are committed; no native binaries or credentials are
added. External task receipts and publication identity are retained in
/tmp/toyvm-browser-mouse-input-oct25/ops. No box was assigned; lifecycle remains
with the coordinator and protected boxes were untouched. The platform remote
SSH403 denial was not retried.
