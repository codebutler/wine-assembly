# Independent input-consumption timing acceptance — 2026-10-24

Verdict: **ACCEPT** the complete producer `01da39b4471d7f2827be043804b755aa9bb6b141`
plus clock repair `b49c99a6ae8ea092d4d121b9f614e932a8dae9cb` against accepted main
`adb2852f0ad9944625d809fd9b73c50dc3d4514e`, for source-level CLI diagnostics.
The candidate is an unchanged descendant of that main. Integration includes the
complete candidate, its repair/provenance evidence and this independent review.
Remote reconciliation, exact resulting-commit reruns and actual published refs
are recorded externally in `publication.json`, rather than predicting a SHA here.

## Review and independent evidence

Reviewed the full main-to-candidate source diff: `test/run.js`, the complete
trace helper, modified tick-input regression, new clock-domain regression and
CLI documentation. Reviewed the repair report, producer-to-repair patch,
immutable oracle versions, baseline-reject receipt and all seven donor test-log
hashes. The donor's `reviewable.patch` is the repair diff from producer01da39b;
the independent `complete-candidate.patch` covers accepted main to repair.
[Source identities and receipts](input-consumption-clock-independent-closeout-20261024/)
retain the exact complete focused closure, including `startup-clock.js`.

The production reader observer is installed after benchmark/startup wrappers
and guest-clock selection. `h.get_ticks` resolves that observed reader at call
time; `ctx.guestNowMs` and renderer stamping forward through it. Before any
successful reader call, the recorded return is unavailable. At batch7 with
200ms/batch and startup factor0.01, the actual return and `lastGuestTick` are14,
while raw batch state remains1400. Publication does not overwrite the recorded
return, including after event/maxMs startup release. Real mode records the
scaled/mapped actual return. Shared host reader calls also update it; independent
worker-thread API reads and QPC microsecond interpolation are outside its scope.

The observer preserves arguments, receiver, return and thrown exceptions;
failed calls retain the prior successful return. Disabled observation preserves
the underlying reader identity. Snapshots use publication and spend no guest
probe. The trace's cap is shared across observation types:1000 records, one
suppression notice, no further snapshots. Existing legacy input output and
clock state are preserved when tracing is disabled.

Actual production renderer FIFO controls preserve event object identity and
balanced duplicate key/mouse order. Raw enqueues receive identity-based IDs;
renderer-generated events retain unavailable origin. Requested schedule2,
actual dequeue7 and dispatch11 remain separate observations. Focus routing uses
the dequeue ID; DispatchMessageA/W explicitly declares correlation unavailable,
including duplicate MSG tuples. Empty polls produce no new dequeue observation.
Main input polling priority and full-width wParam/lParam remain unchanged.
The API logger closure is defined earlier but guest instantiation/execution
follows clock/trace initialization, avoiding an initialization-order exposure.

## Checks

Eight bounded Node commands passed independently; see `tests.json` and logs:

- Corrected immutable oracle with `--assert-correct-last-tick`: actual14 equals
  reported14; actual renderer FIFO/duplicates/delayed dispatch, empty polls,
  routing, disabled equivalence, mixed cap and real mapped no-probe controls.
- Production clock-domain regression, including all five rejecting mutations:
  raw label, remapped history, extra probe, detached reader and missing tick.
- New independent comparison executes the complete production clock block,
  including benchmark wrappers and ctx/renderer/audio/calendar wiring, against
  accepted main. All eight real/batch × startup on/off × benchmark on/off cases
  have identical returns/state with trace on/off. Receiver/exception controls
  additionally exercise observer behavior not covered by the donor regression.
- Existing `test/test-cli-tick-ms-input.js --source-only`,
  `test/test-batch-clock.js`, `test/test-guest-clock-source.js`.
- Syntax checks for production runner and trace helper; `git diff --check`.

Original oracle SHA256 `3026681798630ccbe2b93957ac31b1f40cf83540723c678dbe1fe2e374e059cf`
is preserved. Corrected external oracle SHA256
`e516ba5f6396c3e42ff6041e8d8d78859ed7eac42848040ee60132b7c989242c`
was unchanged. Verified the exact tiny correction: known-bug1400 assertion is
conditional on diagnosis mode, with the success message updated; correctness
still requires14. Verified the baseline rejection receipt and its log hash;
no contradictory original correctness-pass requirement was imposed.

Reproduce from the complete focused closure with Node heap256MiB, CPU/wall60s,
fresh MemAvailable>=805306368; the extra fixture takes the repo path argument.
No native compiler, Wasm instance, browser, game, packages or download was used.
The exact resulting integration commit is checked again before publication.

## Limits and next prerequisites

This accepts source diagnostics, not guest/module or gameplay behavior. A future
authorized runtime qualification still needs the exact built module/commit/hash,
registered original guest assets, route/environment receipts and actual guest
execution. Penguin firing retest additionally needs an inspected unclipped
800x600 client/cannon viewport and matched delivered-input/projectile evidence.
Scheduled batches or score differences alone cannot prove firing causality.
Independent worker API logging, DirectInput polling and completed wndproc
execution remain outside these observations.

Artifacts: `/tmp/input-consumption-clock-independent-closeout-oct24/` retains
full candidate/repair patches, admission, test logs, verification, exact-tree
reruns, publication, seals and final resource/cleanup receipts. Installed tools
and immutable donor are separately measured standing inputs; private Git uses
an explicitly declared donor object alternate, with no hidden task copies.
Task projection includes checkout/Git/evidence/temp/transport, external full
session/events and positive SQLite growth, future allowance and8MiB reserve.
Box ID/state/expiry: N/A; none assigned or accessed. No deployment. Coordinator
retains all box lifecycle ownership. Root and donors were read-only except the
root append-only messageboard claim/publication. No workers spawned or launched.
