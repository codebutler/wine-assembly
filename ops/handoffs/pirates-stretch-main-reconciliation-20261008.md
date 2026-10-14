# Pirates StretchRect source reconciliation

Read-only audit of main `058b82eba` and preserved archive
`archive/codex-shared-tree-20261006` (`428c9abed`), 2026-10-08.
No browser, native test, build, benchmark or production edit was performed.

The October 1 handoff describes rectangular and filtered StretchRect support
that is **not in the inspected main source**. In
`src/09am-d3d-color.wat`, main's `d3d9_color_stretch` explicitly traps on any
non-null source/destination rectangle or nonzero filter. It also traps when
surface sizes or formats differ. Its supported whole-surface copy uses a
per-instance `d3d9_stretch_stage` across source readback and destination upload.
There is no `d3d9_stretch_packet` in that main file.

The archived version contains `d3d9_stretch_rect`, `d3d9_stretch_pixels`,
POINT/NONE and LINEAR sampling, and a 100-byte heap packet containing captured
views and rectangles. Packet and stage are mutable per-instance globals.
The packet is retained across parks, then freed and cleared on completion.
The archive also changes `test/test-d3d9-color-surfaces.js`; its historical
results must not be attributed to current main. Do not bulk-merge the archive:
the relevant host files contain hundreds of unrelated intervening changes.

Current `snapshotThreadSend` / `restoreThreadSend` in `lib/guest-worker.js`,
corresponding snapshots in `lib/guest-thread-host.js`, and cooperative send
snapshots in `lib/thread-manager.js` preserve the render token. They do not
save or restore StretchRect stage or packet. The cooperative dispatch also
has a `_renderSendTargets` deferral guard; the existence of an unsaved global
alone does not prove a reachable nested-call defect. A same-instance nested
StretchRect during a suspended operation remains unsupported by evidence.
Separate Worker instances do not by themselves establish same-instance safety.

Next implementation work should isolate the archived rectangle/filter changes
and their focused tests against current main, examine callback deferral and
operation ownership, then either preserve operation state per invocation or
prove that nested entry is deferred. Require actual negative/positive nested
readback/upload tests with distinct source and destination pixel patterns,
outer-state restoration, and packet cleanup on failure. Retain invalid-call
and fail-fast behavior for unsupported cases. No unchecked pooling or copy
removal belongs in this work.

The October 2 Pirates captain-route stop remains a separate unresolved issue.
Its recorded run never reached StretchRect; restoring this source cannot be
claimed to fix that stop or white terrain. A later original-game transfer run
must identify its actual source/module, reach the operation, and establish
ordered source readback before destination upload. Current-main source audit
changes the prerequisite for that run; it does not supply gameplay evidence.

## Superseding reconciliation, 2026-10-13

The missing-implementation prerequisite above was resolved on October 10.
Commit `51d2f34602a8c5da0469b754a7fd494bfe15b5a6` is an ancestor of
current main `a8d6e35632618bc5a1e4a5739513cdfe20ca186d`; its rectangle/filter
sampling and nested packet stack remain present in `src/09am-d3d-color.wat`.
Each guest stack frame owns its packet; child validation failure/completion
restores the parent phase, while the host still owns the suspended render token.

Retained `scratch/runs/20261010T0816Z-bge-rect-nested/` was inspected: build,
color, targets and aliases exit0; `color-final.log` passes both readback/upload
parks, invalid-child cleanup and distinct source pixels. The negative control
in `nested-negative.log` returns S_OK where the invalid child must fail.
These are handler-level nested-frame tests, not a Pirates callback or gameplay
reproduction. No new execution or current-build certification is claimed.

Do not redo the archived implementation. The next Pirates step is original
fixture/runtime preflight and investigation of its separate captain-route stop.
Its historical run did not reach StretchRect, so this source reconciliation
neither proves transfer execution nor fixes terrain or the captain stop.
