# Host worker lifecycle fixture repair — 2026-10-25

Base: `20a4ea17a09564911d054e848c12f2f4ee237805`. Fixture-only source-test
repair; independent review is required before integration. No production changes.

The ordinary command `node test/test-host-worker-lifecycle.js` now passes the
complete suite: 12 sequential case blocks and 37 unchanged assertion calls.
No cases, assertions, timing thresholds, rejection paths or production methods
were removed, replaced or relaxed. There is no shortened entry point or preload
in the passing command.

The baseline command exits 1 in `WineAssembly.stop` before its first assertion:
`Cannot read properties of undefined (reading 'exited')`. Replacing only the
host fixture with its real constructor advances through the six initial host
cases and the real Node worker case, then exits 1 in `WorkerLink._beginRetiring`:
`this._retiringListeners is not iterable`. Both failures are retained separately.

Four construction sites now use actual constructors. `wineHost()` constructs
`WineAssembly`, which initializes `_processObject`, `_processAliases` and the
rest of the process identity/lifetime state. The synthetic WorkerLink constructs
`WorkerLink({})`, obtaining its endpoint identity, `_retiringListeners` and other
retirement state before the existing fake transport is assigned. Both synthetic
GuestThreadHost fixtures construct `GuestThreadHost({})`, obtaining its local
send-wait ownership and normal lifecycle defaults before their existing setup.
These constructors do not start workers, clock intervals or guest execution.
All existing Object.assign setup remains intact. No constructor fields were
manually copied into a prototype-only fixture.

Structural comparison uses Node 24.18.1's installed bundled Acorn 8.16.0, read
in memory. All 12 case blocks have identical ASTs after normalizing exactly the
four constructor initializers; all 37 assertion call source strings are exactly
equal. Reversing those four changes and removing the two added setup comments
also reconstructs the entire baseline file byte for byte. Per-case original,
candidate and normalized hashes are recorded. Baseline test SHA-256:
`864c2377f531ba94dc25c83dfeeea9eadcc5fd7ab7a864cffbc3a67d542a26f4`;
repaired test SHA-256:
`62552f162c3efe72ff5813bc83147e8049293478b855aabd4545e3e1ef798419`.

Four separate in-memory production mutations run the full repaired suite;
the checkout's production files remain byte-exact to the base. Every control
exits 1 with ERR_ASSERTION, rather than a fixture error or unsupported operation:

| Actual method mutation | Existing assertion that rejects it |
| --- | --- |
| `_releaseGuestMemory`: clear `this.memory` on entry | `deferred release retains memory` |
| `_terminateAfterLoaderRetirement`: resolve pending readiness instead of rejecting it | `assert.rejects(ready, /stopped/)`: missing expected rejection |
| `_releaseGuestMemory`: omit `_guestRuntimeRetirementError = result.error` | `assert(wine._guestRuntimeRetirementError)` |
| `_stopGuestRuntime`: replace timeout-specific error with generic retirement failure | `assert.match(...message, /timed out/)` |

The readiness control clears the real readiness timer by resolving its pending
promise, and still terminates the real Node worker; it demonstrates loss of the
required rejection without leaving an intentionally hung timer. The timeout
control preserves the deadline and tests whether its diagnostic remains visible.
The unmutated full suite also retains memory after timeout and retains a failed
boot's unretired owner. No genuine production defect was observed in these tests.

Adjacent checks ran once: `node test/test-browser-launch-options.js` (15 PASS
groups, including invalid startup command rejection) and
`node test/test-asset-load-cancellation.js` (6 passed, 0 failed/skipped).

Evidence and recovery recipes are retained in
`/tmp/host-worker-lifecycle-fixture-repair-oct25/ops/`: `baseline.{json,log}`,
`host-constructor-only.{json,log}`, `full-lifecycle.{json,log}`,
`structure.cjs`, `structural-comparison-corrected.log`, `controls.cjs`,
`control-*.{json,log}`, `validation.json`, admission receipts, publication
verification, cleanup/accounting, `evidence-manifest.json` and `result.json`.
The first structural helper had a syntax typo; its failed output is retained as
`structural-comparison.log`. Only that external helper was corrected.

Execution used Node heap 256 MiB, 90-second command wall limits and 128 KiB output
limits. All command processes were reaped; the only worker_threads endpoint was
the existing never-ready fixture, and the board watcher is stopped at handback.
No box was assigned, no guest/Wasm/native/fullVM work ran, and lifecycle remains
coordinator-owned. Root tracked files/index/refs and immutable donor stores were
left unchanged. Checkout used a focused non-cone sparse manifest written before
checkout and flattened read-only Git alternates, without cloning or repacking.
Resource receipts charge the actual current launcher path, session, whole shared
WAL/SHM, future growth and 8 MiB reserve inside the 64 MiB task cap; installed
Node/Codex and immutable donor inputs remain separately identified standing data.

Publication is restricted to `task/host-worker-lifecycle-fixture-repair-oct25`.
The coordinator must independently review this fixture repair; this worker does
not launch reviewers, merge or push main. `ops/result.json` records the final
commit, verified remote ref and complete SHA-256 evidence manifest.
