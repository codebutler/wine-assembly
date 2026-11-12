# D3D9 immutable RGBA snapshot slice

Source base: `397cdb6ca37c1f247cdd6e2618f6e1f3529342c4`.

A replacement texture reused its mip record, storage pointer and dirty sequence; changing only four bytes outside the sparse fingerprint returned the previous RGBA. The baseline fixture reproduces this stale result. Cache hits now require the same device-entry incarnation and texture-allocation generation as well as the mip address, dirty sequence and storage/layout. A generation change decodes a fresh definition under a new serial. This conservative rule also re-decodes unchanged textures after another allocation; no performance acceptance is claimed.

The existing command queue already privately copies asynchronous DRAW payloads. Residency commits after admission; rejected builders leave the consumer unchanged, forget producer assumptions and resend definitions with stale-key retirements on retry. The tests exercise this actual host/queue/worker endpoint path with an injected mock device.

Run `node --max-old-space-size=128 --test test/test-d3d9-immutable-rgba-snapshot.js`. Six behavioral fixtures pass: unsampled replacement, queued update/reclaim/release ordering, budget rejection/retry, device incarnation and mip identities with stale-generation rejection, same-identity key-only reuse, and reset/republication. Baseline log predates the last two fixture additions and records two genuine failures and two passes. Syntax checks cover host and both affected test files; `git diff --check` passes. Existing native tests were not run; their snapshot-cache comments were updated to describe the exact generation rule.

`lib/render-textures.js` is absent from the pinned base. This is one D3D9 correctness slice, not completion of the broader shared-registry S3 migration. The consumer endpoint and accepted clear code are unchanged. No render-target aliases, cubemaps, CPU Lock, shader, overlay, save, dashboard, compiler, native executor, browser, GPU or guest acceptance. No boxes assigned or touched; coordinator retains lifecycle ownership.

Recovery: checkout the published task branch from the source base and run the focused command above. The code, fixtures and these evidence logs are committed; external resource/publication receipts remain in `/tmp/render-immutable-rgba-snapshot-oct25/ops`. Checkout uses own Git objects plus read-only flattened standing donor views; no recursive alternates, full clone or repack. The first reusable-view checkout failure and its local flat-view recovery are recorded in the worker session.

Committed baseline log has trailing whitespace normalized for the diff gate; raw output is retained in external `ops/baseline.log`.
