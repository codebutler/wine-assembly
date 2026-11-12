# Maelstrom frozen select record adapter

Candidate based on accepted main `606caff1de558f185487aed5e31ede159262ba7e`
(tree `fa0cf92625c22dc90e3effbb0a32f3759c3c79bd`). This is a host adapter,
not a new native qualification or original-game capture.

`tools/maelstrom-select-frozen-record.cjs` binds
`createOracle(actualInstance, actualInstance.exports)` and takes captures only
with `snapshot(actualInstance.exports)`. Start once before supported original
execution. At ordinary successful run returns, `observe(batch)` ignores
authentic idle/unchanged polls and submits changed attempts to the unchanged
oracle. An unseen park followed by another attempt still rejects as a counter
gap. No completion is inferred from live EAX, ESP, EIP or fdsets.

The first accepted completion is deeply frozen and persisted once. Its
`historicalCompletion` contains only the trusted result, attempt and latched
identity. `liveHostObservation` separately labels later state with the host
observation batch and wall-clock milliseconds. The model regression shows
result 7 and post-ESP 4120 retained while live EAX/ESP/EIP become
39321/34952/30583 and live fdsets become [9,8,7]. Neither completion-time fdsets
nor completion-time EIP are available from this latch. The runner adapter
reports only later live EAX/ESP/EIP; it does not invent fdset evidence.

The accepted hook is byte-identical, SHA-256
`b7c77c20b12cd582d6fcfbe246e1f0abdcb644266fc3f161bf5d683d93b13930`.
Its `storage()` generates `msc_end`, which copies EAX after the real select
result store and records invocation-owned metadata. `msc_arm` and `msc_enter`
return before writes once completion is set. Those source freeze guards and
the post-store placement are checked structurally against the exact pinned
canonical sources, with a rejecting removed-guard control. The source
evaluator also exercises a later call after completion with changed ownership
and registers. These checks are **model/source evidence, not native evidence**.

## Reproduce the cheap checks

From this candidate checkout, with the retained readonly inputs:

```sh
node --max-old-space-size=256 test/test-maelstrom-select-frozen-record.cjs \
  /home/user/wine-assembly-shadow-man-span-static-canonical-oct23 \
  /tmp/maelstrom-head-yield-observer-oct24/ops/run.js
node --max-old-space-size=256 test/test-maelstrom-select-completion-hook.cjs \
  /home/user/wine-assembly-shadow-man-span-static-canonical-oct23
node --max-old-space-size=256 test/test-maelstrom-select-hook-repair.cjs \
  /home/user/wine-assembly-shadow-man-span-static-canonical-oct23
```

Actual bounded invocations, output and exit statuses are committed in
`test/fixtures/maelstrom-select-frozen-record-20261024/`. They use a 60-second
CPU/wall guard, 256 MiB Node heap and bounded output. The adapter suite passes
12 groups; the unchanged hook suites pass 11 and 16 groups. The adapter suite
runs its same positive regression against two rejecting baselines: substitute
live EAX for the result (`--baseline-live-result`, 39321 != 7), and demand a
completion-time live-state fence (`--baseline-live-fence`). Each baseline must
exit 1. Neither changes the accepted hook, source or module.

The first adapter test invocation failed because its setup fixture had already
leased the same model through another adapter. The fixture was corrected to
use a fresh model for the real transformed setup. The original failed receipt
and subsequent passing receipts are retained. No acceptance rule was relaxed.

## Intended future original execution (not performed)

`tools/maelstrom-select-frozen-runner.cjs` checks the entire original runner
SHA-256 `4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809`
and four unique anchors before producing any output. Generate into a new file:

```sh
node --max-old-space-size=256 tools/maelstrom-select-frozen-runner.cjs \
  /tmp/maelstrom-head-yield-observer-oct24/ops/run.js NEW_RUNNER
```

For a future coordinator-assigned execution, place that generated runner at
the ordinary `test/run.js` location in a recovered runner closure with these
two new tools and the unchanged hook available under `tools/`. Add only
`--maelstrom-select-frozen-record=NEW_HOST_JSONL` to the otherwise accepted
original-run argv. The transform starts immediately after the actual
`WebAssembly.instantiate(wasmModule, imports)` and before PE/DLL startup;
the pinned runner calls `stageAndLoadPe` and `callDllMain` later. It observes
after each of the three explicit main-instance `run(BATCH_SIZE)` sites.
It does not instrument nested DLL-loader calls or worker instances. Attempts
lost during those executions remain subject to the unchanged counter-gap
rejection. No successful select arrival or capture is promised.

The transform retains the main suspension condition and interleaved swallow
versus break catch bodies. Diagnostic start/capture/persistence failures close
the adapter and print a diagnostic; they do not enter guest exception handling
or stop guest execution. A throwing guest run is not a safe-return observation.
Repeated starts and a second adapter for the same instance/export source reject.
No option means no adapter require, export reads, start, clock reads or sink IO.

The tests parse the full transformed real runner without executing it, evaluate
its extracted setup/run/catch fragments with host fakes, and reverse the four
edits to recover the byte-exact original. This proves preserved untouched
startup, input, pacing and budget source; it is not a runtime equivalence claim.
There is no change to batch size, clocks, yields, budgets, scheduling inputs,
production WAT, hook or oracle, and no synthetic select in the runner.

Future execution must reuse the unchanged accepted diagnostic module
`select-hook.wasm`, SHA-256
`ed9d74e5ab4c8bf03bb9f94a56ec41e6e28d9abfa282a20c6654e35e9d177ea7`,
and scheduler SHA-256
`f0a2f006b0eb992bcdb904f10128167b06bfe143ac05661b82f9586d9755bf40`.
The previous filename-bearing tree-mount argv receipt is retained unchanged,
including all 48 files and its comma-bearing filename; no mount or guest was
executed here. A future runtime assignment still needs its own admission and
lifecycle schedule. No box was assigned or accessed in this task.

Native/compiler/guest/box/download/deploy/main-merge counts are all zero.
Original arrival, park/completion, fdsets/timeval, route/thread state, gameplay,
observer overhead and runtime behavior remain unknown. The earlier no-fence
finding remains valid; this adapter consumes a historical immutable record and
does not retroactively qualify completion-time live-state inspection.
