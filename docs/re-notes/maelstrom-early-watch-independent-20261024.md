# Maelstrom early watch repair independent acceptance, 2026-10-24

ACCEPT repair `6af88ef031cf4f5fe0f25a620d3018697ce870b4`, against main input `f879fd0cd81d918ea54a18b1b222fae25dd6d618`. The adapter validates conflicting watch configuration before the historical immediate activation fragment. Disabled transformation is byte identical. This independently closes rejection `494d4115166a0d23aaa5efc7a92fe7195dcd7932`: immediate JS-only watch reads zero bytes before rejection, rather than one.

All 95 focused input Git blobs match their immutable candidate objects. All 38 previous independent report/helper/failure-receipt files are unchanged. Separate acceptance and minimal copies differ from the independent originals by exactly one adapter SHA literal, with all assertions unchanged. Adjacent identity patches and identity.json retain the proof. Historical runner and export snapshots match immutable Git `d8cd8c54c8d63c107696f1e4ef7a1e229dcadc1e` byte for byte; 25 primary and 23 recovery seals match unchanged standing read-only evidence. Nine previously accepted unchanged controls are reused; no runtime replay is claimed.

Fresh producer, unchanged independent acceptance, and minimal --acceptance-oracle all pass. Additional independent matrix runs all eight combinations of native/JS-only, immediate/deferred and target/non-target on actual transformed watch/init/arm/run fragments. Every enabled conflict has zero activation calls, watch reads, diagnostic reads, breakpoint arms, main runs and rows. Disabled controls preserve the original immediate native activation and immediate JS-only read; deferred watches remain deferred. A real breakpoint reads exactly 16 snapshot bytes. Wrong halt reads none and ends unresolved.

The matrix relocates the actual transformed validation fragment to the old late position: actual watch read `[4096]`, diagnostic reads zero, no runs or rows, and conflict oracle rejection. Guard removal also fails and restores the false 16-byte snapshot. The producer retains seven mutations, ten missing/duplicate anchors, seven missing exports, 10,000 finite no-hit batches, unchanged batch size 1000, discarded run return, suspension, render/pacing/scheduler ordering and CLI controls. The whole transformed source parses. Original input, pacing, loop bound and batch code remain intact outside the documented audit insertions.

Commands use Node heap 256 MiB, fresh MemAvailable >=805306368, CPU/wall 60 seconds, actual transformed historical source and controlled JS exports, never WASM/native/guest instantiation. Run from this checkout:

```sh
node --max-old-space-size=256 test/test-maelstrom-breakpoint-boundary-audit.js
node --max-old-space-size=256 docs/re-notes/maelstrom-early-watch-independent-20261024/acceptance.cjs "$PWD"
node --max-old-space-size=256 docs/re-notes/maelstrom-early-watch-independent-20261024/js-only-minimal.cjs "$PWD" --acceptance-oracle
node --max-old-space-size=256 docs/re-notes/maelstrom-early-watch-independent-20261024/matrix.cjs "$PWD"
```

Complete prerequisite adapter/support/test-tier and repair files are integrated together in the isolated task checkout only after remote-main reconciliation under the shared integration flock. Exact merged-tree tests, final diff, command/exit/memory receipts, remote task/main SHAs and cleanup/resource receipts are retained in `/tmp/maelstrom-early-watch-independent-integrate-oct24`; ops/result.json is written last. Publication preserves concurrent main changes and uses fast-forward pushes without force. The initial focused admission was 43,018,706 bytes within 64 MiB, with complete external session/events, positive SQLite/history growth and future allowances plus 8 MiB reserve charged. Standing tools/donors are separate. Strict dedicated Git SSH remains unchanged; mount argv is empty because no guest launch is authorized or executed.

No full build, native/WASM instantiation, guest/browser/box operation, acquisition, deployment or worker launch. Runtime reachability UNPROVEN; historical zero-record cause UNKNOWN. Box ID/state/expiry NONE, lifecycle coordinator.
