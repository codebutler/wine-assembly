# Local native lifecycle admission

`tools/run-win32-ne-lifecycle-native.js` keeps its historical remote mode by
default, including nine pinned donor paths and the 52-file dependency inventory.
Local use requires `WA_NE_MODE=local-prepare` or `local-run` and
`WA_NE_LOCAL_CONFIG=/absolute/config.json`. Preparation verifies admission and
source/fixture/dependency pins without building or executing a guest. It still
requires an idle runtime lane. A successful preparation is not a suite pass.

Both modes also require the existing `WA_NE_LIFECYCLE_COMMIT`, fresh external
`WA_NE_LIFECYCLE_EVIDENCE` directory, and `WA_NE_ORIGINAL` original PMPRO62 DLL
(SHA-256 `7e2b17e61e7e4808a50478ddcac06f65fcf9f3ffd741d747c8cb75e20cb05db9`).
Production src/lib remain pinned to `a62466211ea61f4d199f7057622a4e2ce98e82b7`,
including importer-owned named-import resolution, KERNEL.48 GetModuleUsage,
and module aliases reserved separately from instance selectors.

The version-1 JSON config contains:

- `dependencies`: absolute real directory, also the target of this worktree's
  `node_modules`. Both `pngjs` and `wabt` must resolve inside it. Every file is
  freshly hashed; symlinks outside it fail. Every subsequent inspection repeats
  the inventory, detecting additions, removals and mutations.
- `donors`: nonempty array of `{path, sha256}` for actual retained donor files.
  Hashes must match one of the controller's reviewed historical donor hashes.
  Local mode protects these actual files; it does not assert that absent remote
  donor paths or the historical 52-file dependency layout exist.
- `infrastructure`: array of `{pid, startTime, command, role}`. Obtain the exact
  identity with exported `processIdentity(pid)` from `tools/ne-local-admission.js`
  after reviewing the process. Roles are `dashboard`, `watchdog`, or `codex`,
  limited to recognized command shapes. PID start time and complete command must
  still match at every inspection. Do not include competing work as infrastructure.

Unknown Node processes, browsers, and build commands block admission. No process
is terminated or suspended by admission. The free disk floor remains strictly
above 2 GiB and is rechecked around every child. Child deadlines and owned-group
cleanup remain unchanged. Runtime ownership must be assigned before local-run.

Verified local inputs as of 2026-10-18: genuine pngjs 7.0.0 and wabt 1.0.39
are installed under `/tmp/wa-outlaws-local-deps/node_modules`. Restored arena,
context, and invoke donor modules, their hashes, local config, and recovery
commands are retained under the shared repository's
`scratch/runs/20261018-outlaws-local-inputs/`. The restored lifecycle donor is
excluded because its hash is not in the reviewed allowlist. The original DLL
is retained under `scratch/runs/20261015-outlaws-oemkeyscan-native/original-loader-fixtures/`.
Earlier local preparation passed. The first native suite stopped at NAMEIMPORT
after six passing arms; the next passed seven arms and stopped at original
PMPRO62 termination because KERNEL.48 was missing. Focused canonical/native
validation of this production pin passed, including unchanged PMPRO62's 61
exports, duplicate reference, and final unload, with evidence retained under
`scratch/runs/20261018-outlaws-module-usage/`. These focused results do not
establish a full twelve-arm suite pass. The subsequent complete suite result is
recorded below. Refresh infrastructure identities and verify every supplied input for
each new run; missing files, dependencies, and mismatched hashes remain hard
failures.

Bounded source-only checks: `node test/test-ne-local-admission.js` and
`node --check tools/run-win32-ne-lifecycle-native.js`.

Full local validation at controller commit
`b6e97f6ccf7ad3aee389e347255b49a3a6acade7` passed fresh admission and all twelve
arms on 2026-10-18: canonical build, host driver, native invocation, tiny
context, image validation, tiny lifecycle, native lifecycle, original PMPRO62,
tiny arena, real allocator, pure-NE bounds, and pure-NE loader. The original DLL
passed initialization, all 61 named/ordinal lookup pairs, duplicate references,
and final unload. The canonical module SHA-256 is
`3b5655d5d7e6046bfaa21c90d39abe34a279eff8957700f284282cd6b0fe98e3`.
Evidence and recovery recipes are retained in
`scratch/runs/20261018-outlaws-module-usage-fullsuite-native/`; fresh admission
is in `scratch/runs/20261018-outlaws-module-usage-fullsuite-prepare/`.
Controller and all children exited zero, all twelve owned groups were empty,
postflight passed, and 2,993,885,184 bytes remained free after evidence copies.
This validates the native bridge lifecycle, not original Outlaws gameplay,
browser execution, or QT_Thunk.
