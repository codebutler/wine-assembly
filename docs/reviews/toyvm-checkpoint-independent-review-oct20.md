# ToyVM interruption checkpoint independent review — 2026-10-20

ACCEPT candidate `2f8df49fc7777a34212d9a94b773e6757c205132` onto
`2c58e9dc5d42ecc170b7c86c5b9011a1b265b62b`. Integrate only its exact
`tools/toyvm/arm-bench.js` and `tools/toyvm/arm-bench.test.js` blobs plus this
report. No candidate ancestry or production repair is included.

The unchanged production CLI and runOne parser were exercised with controlled
child transport and actual JSON serialization/filesystem writes. Runtime
imports are denied. Reused candidate tests pass: interruption after 1, 4 and
10 completed attempts, calibration and preceding completed programs, real
harness SIGKILL in flight and during temporary-file writing, duplicate labels,
rotation, ties, failures and selected-only mismatches. Baseline and unsafe
direct-writer negative controls fail as intended. A 28-call-per-version
differential against fresh main preserves every final JSON field except added
completion metadata, and all CLI output.

Thirteen independent production CLI scenarios pass: interruption before the
first result preserves an existing output byte-for-byte; temporary open,
partial write, file fsync and rename failures at checkpoint 1 and checkpoint 3
preserve the prior published file, propagate failure, close descriptors and
remove temporary files. Directory fsync failure after rename propagates failure
but leaves the valid newly published checkpoint. A failed calibration checkpoint
preserves existing output; successful calibration sets the measured budget to
3000 from a 1000-dispatch, two-second calibration and six-second target.
Every pre-rename observation sees the old published bytes and valid temporary
JSON. No failed execution prints an aggregate.

The exact aggregate predicate independently excludes incomplete rows with no
selected checks, failed rows and mismatched rows; removing its completion guard
fails. This predicate check is isolated, whereas interruption and filesystem
checks execute the unchanged entire production CLI.

Required unchanged test-tier, test-timeout and both ToyVM bundle reproducibility
gates (including bundle self-checks) pass over the exact integration tree using
a read-only Git snapshot filesystem adapter. Source/test syntax and whitespace
checks pass. The existing unit-test convention covers this test; no tier edits,
bundle changes or gate changes are needed.

Evidence retained separately at
`scratch/runs/20261020-toyvm-checkpoint-independent-review-oct20/`:
`verify.js`, `independent.js`, `tests.json`, `independent.json`, `trace-*.json`,
`killed-*.json`, negative-control logs, `gates.js`, `gates.json`, `gates.log`,
`setup.js`, `preflight.json`, `change.patch`, `receipt.json`, `remote-final.txt`
and `SHA256SUMS.json`. Run `node verify.js` and `node independent.js` there
to reproduce controlled checks using the preserved sparse repository and
fresh-main `prior.js`. Original candidate evidence seals were verified.

Qualification limits: no actual benchmark, guest runtime, browser, full build
or hardware power-loss test. Atomicity is qualified for this filesystem and
process interruption. Directory fsync support remains filesystem-dependent.
SIGKILL can leave an unreferenced temporary file; a result interrupted before
rename is not committed. The checkpoint file is for a single writer and has no
resume mechanism. There is no checkpoint without `--out`. Completion means
scheduled attempts finished, including failed attempts, rather than success.
