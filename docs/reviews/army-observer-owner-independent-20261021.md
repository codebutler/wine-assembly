# Independent acceptance: Army observer preload ownership

Verdict: **ACCEPT** candidate `3372225162a8e83e5a9d67c4d3c0740496f85da2`,
source fix `6f26b8c35c6fd50b20f72b9f2c76f97e79e30f75`, against exact main
`30a2c3fb1b5c2bfa8a6b001d7394d5cf50df295d`. Fresh origin/main was reconciled
to that same base before integration. The candidate contains only the coherent
observer guard, its preload regression, investigation note, report and evidence.
No authority, transport, deadline, reservation or lifetime code changes.

## Correctness and independently replayed checks

Node auxiliary workers inherit CLI preloads/environment. Previously the worker
opened the main owner's output with `wx`, throwing EEXIST before serving the
authority. A synchronously waiting caller then reported ETIMEDOUT. The new
`isMainThread` predicate scopes only automatic installation. Exported capture()
remains available, with explicitly supplied instance/regions, in any thread.
It does not globally disable explicit worker observation or alter authority
behavior. Main-thread file exclusivity, map/path validation, single-instance
ownership, bounded samples and import restoration remain enforced.

On local Node v24.18.1, all seven suites passed: army-bltfast-preload,
army-bltfast-observer, army-bltfast-captured-abi, jig-owning-api-observer,
named-event-authority, named-event-wake-reservation, named-event-caller-deadline.
These cover actual --require/NODE_OPTIONS transports, auto-reset consumption,
last-close disappearance, subprocess races, peer loss, reservations/capacity,
deadline boundaries, ABI/pixel rejection and ownership. Deadline extension,
early-expiry and unrelated-clock-domain mutants each rejected with exit 1.

Independent ownership-controls.js additionally ran the full explicit capture
pixel/ownership fixture inside a real auxiliary worker, with a preload and an
intentionally relative output/foreign map. Explicit capture passed, instantiate
retained its original identity, and no implicit output appeared. Removing the
guard reproduced ETIMEDOUT (exit 1); disabling main auto-installation rejected
the main ownership fixture (exit 1). Restored candidate preload passed again.
The candidate source was restored byte-for-byte; no production edit was needed.
git diff --check passed. Tests used the combined candidate on unchanged main.

## Inspected sealed runtime evidence (not replayed)

Verified all **56 outer and 22 runtime seals**. Independently matched all 7,299
recorded baseline git blob identities to exact-main's tree, both candidate file
SHA-256 values to source commit 6f26b8c, and all **57 files** in the tracked
producer archive to preserved evidence. Archive SHA-256:
`143a784ac3c568e932b982c79b7be3f9be5f85804f807f4756de832757e1142a`.
Reviewed the identity-check implementation and before/after receipts: it reads
and hashes all 419 original files, resolved support DLLs, source and module.
Only the two candidate files differ; module remains 1,878,508 bytes with SHA-256
`728e1de80ec20a284fc41b339895ee8ac29f16e4ded83325b27576cfacd4466c`.
These are inspected sealed runtime attestations, not fresh local asset hashing.

Both original 4,041-byte failure logs match and contain ETIMEDOUT; the direct
worker probe exposes EEXIST. Reviewed launch arguments and successful output:
same original route, --no-threads, 200000 quantum, 750 batches, 90s bound;
ole32 DllMain returns 1, exit 0, ordinary click/Enter/Numpad6 input recorded.
Actually viewed bootcamp.png, turn-before.png and turn-after.png: welcome pane,
then unobscured terrain/Sarge/HUD, then changed sign/terrain/Sarge screen positions.
Eight completed BltFast records each have nine matching sampled copied regions,
HRESULT 0, no observer errors/pending calls. Initial corruption remains unknown.
No new runtime replay, packaging, build or asset staging was warranted/performed.

## Limits and handoff

This accepts bounded CLI startup/input/camera and sampled-copy evidence; it does
not establish full gameplay, FPS, audio, browser behavior, native parity or
terrain-stripe causality. The repository-wide evidence checker still reports
the historical Zuma containment error and unrelated missing/invalid records;
this investigation has no corpus candidate and is not attached to another game.

Fresh sparse checkout was projected before materialization; task footprint is
below 64 MiB and free space exceeds 2,285,895,680 + 600 MiB. Root WIP, laptop
Heroes II/Warcraft III and fleet untouched. No workers or replacement tasks.
Box bx_e8a7pw8v is left untouched and RUNNING per producer's sealed idle/healthy
handoff, expiry 2026-10-21T12:21:46.313Z. No fresh API state claim; no owned remote
processes were created. Coordinator retains shutdown ownership, handback before
12:10 UTC. No public deployment. Exact integration commit and normal task/main
remote verification are recorded in publication.json and the messageboard.
