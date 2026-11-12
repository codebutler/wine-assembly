# Callback census reconciled with accepted startup integration

Source commit: `a33939583068231aaa7c3fc5155b87f3ec85c07b` (remote main verified
before checkout). Task branch: `task/hock-startup-census-local-oct21`.
This is a local source prerequisite repair. No main merge or runtime acceptance.

The 401-entry census passes. Every inventory key, classification, ownership,
EIP target, export, boundary-call list and ownership-write list is unchanged.
Only reviewed digests and reasons change; ownership remains `pending` and the
independent nonlocal API lock remains closed. No enforcement or production code
changes. The existing census regression gains real-source rejection controls.

## Review provenance and semantic findings

Imported the manifest and census-test repair from
`b3fce6f6fffcb83300397bcacc2691f1d6cb22da`, reviewed at
`4261fd93a512dd1377818c4f374addbb8aee6267`. Its nine-producer lifetime review and
17-command receipt remain inherited evidence, not newly rerun process/Worker
acceptance. The original report is available at that exact commit as
`docs/reviews/hock-canonical-census-20261021.md`, and its receipt and report remain
under `scratch/runs/20261021-hock-canonical-census-repair/`.

Independently read the complete startup integration delta from 4261fd93 to
a339395, including supporting ShellEx, environment, region, import and CLI
changes. Applying the prior pins to current source produced exactly nine
changed-producer diagnostics. All nine changes are digest-only in the scanner;
they nevertheless require semantic review:

| Producer | Reviewed behavior and lifetime obligation |
| --- | --- |
| host.js | Explicit tracked spawn bypasses the legacy opt-in; showCmd travels with beforeRun/onExit. Hidden progress is separate from guest visibility. Startup publication precedes PE initialization. Existing stable process object, cancellation and idempotent completion remain. |
| browser-shell.js | Pending launches retain their options. Only tracked bypassSingleApp children bypass parent-exit scheduling; ordinary shell launches keep queue ordering. The show choice reaches loadExe. |
| host-imports.js | Unsupported process_spawn still returns zero, with the two new parameters. No new callback retention. |
| process-boot.js | Distinguishes absence from SW_HIDE zero, validates commands, serializes child argv and publishes to the shared process latch. This latch is not an invocation token. |
| renderer.js | SW_FORCEMINIMIZE uses the existing non-child minimize path and restoration rectangle. No new guest restoration boundary. |
| CreateWindowExA | Defers selection until successful creation and suppresses premature host visibility. Native completion uses its local HWND; guest completion must use its saved frame HWND. Failed creation must neither consume the latch nor restore a latch consumed by a nested successful show. |
| ShowWindow | Rejects NULL/missing targets before selection. Eligible first-show/default selection, activation-command filtering and prior-visibility return survive the callback continuation. |
| PeekMessageA_fetch | Pending WM_SIZE uses iconic/maximized state and zero minimized extent; existing delivery target is retained. |
| win32_dispatch_inner | Successful creation selects using the invocation's guest-stack HWND after accepted callbacks. Iconic activation and size payloads are updated. General dialog, activation ownership and removed-target continuation gaps remain. |

Supporting ShellEx code owns narrowed/expanded buffers until synchronous host
transport returns, requests a tracked process explicitly, and does not replace
failure with an untracked fallback. Browser/CLI transport copies command data;
the retained show option is a scalar. Import arity and generated signatures agree.
STARTUP_SHOW_STATE is appended; validation preserves every old exported region
mapping. New startup helper functions do not themselves write EIP or introduce
an invocation boundary under the existing scanner's rules. This review does not
claim the census pins every non-boundary dependency independently.

## Fresh validation

Evidence: `scratch/runs/20261021-hock-startup-census-local/`.
Run `python3 ../run-tests.py` from its isolated `repo/` to replay the recorded
commands and controls. `tests.json` contains exact argv, environment and exits:
19 commands, eight successes and 11 expected behavioral assertion rejections.

- `node tools/callback-ownership-census.js`: 401 boundaries; repeated after
  source restoration. The baseline failure is retained in `baseline.log`.
- `node test/test-callback-ownership-census.js`: prior fixtures, two inherited
  real lifetime controls and nine startup producer mutations reject with exact
  diagnostics. Actual WAT exports supply host-recognition context.
- `node docs/reviews/shell-startup-complete-path-fix-20261020.js`: 24 startup cases.
- `REVIEW_REV=a33939583068231aaa7c3fc5155b87f3ec85c07b node
  docs/reviews/startup-latch-valid-show-fix-20261020.js ../repair.json`: 21 probes
  (18 acceptance groups and three retained baseline observations).
- Same REVIEW_REV with `node ../independent.js ../independent.json`: 24 independent
  groups against exact Git blobs, including saved-HWND ownership and nested
  successful-show consumption across outer failure.
- `WINE_NAMED_EVENT_ENDPOINT='{"integrationFixture":true}' node ../validation.js`:
  69 checks and three internal transport controls, actual startup serializer,
  CLI callbacks/argument consumer, browser PE option handoff, host pre-PE prefix,
  region preservation, source syntax, logical-operand and silent-stub gates.
- Behavioral controls reject removed NULL guard, early selection, blind rollback,
  missing successful commit, global instead of saved HWND, lost explicit
  selection, wrong startup info, continuation size, renderer minimize, iconic
  state and prior-visibility return. Each rejection is an assertion, not a missing
  dependency or absent mutation target.
- Two additional actual CLI mutations remove host show transport and substitute
  the global HWND in successful dispatch. Both exit 1 with exactly the named
  producer digest diagnostic. `finally` restores original bytes and verifies
  SHA-256; `cli-controls.json` records original/mutated seals and restoration.
- `git diff --check` passes. `source-seals.json` and `source-verification.json`
  confirm all 280 materialized production inputs match exact source commit bytes
  before tests and after controls. No source edit persists.

The independent runner is copied unchanged from the accepted integration's
preserved runner. The validation runner uses exact current-main object fallback
for sparse files while retaining the old region comparison base. Its recording
fork boundary, inherited endpoint sentinel and real ThreadManager serializer
remain disclosed adapters; no process authority or runtime is launched.
Initial validation failed at a missing sparse syntax-check file; it was admitted
and materialized before the passing run. Initial new census controls lacked WAT
export context and were corrected before the final run. Neither setup failure
counts as a passing result.

## Custody, recovery and remaining gaps

Exact commit objects were verified in existing isolated object stores before
materialization; no shared Git config/index/HEAD was changed. The new isolated
checkout alone uses Codex <codex@users.noreply.github.com>. Projected sparse scope
was 29,011,968 allocated bytes; tests/evidence stayed below the 64 MiB cap with
the 2,285,895,680-byte free-space floor preserved. `projection.json` records the
pre-write scope. Final `receipt.json`, `remote-ref.txt` and `SHA256SUMS.json`
record publication and artifact custody. Only this report, the manifest and the
focused census test are committed.

Recovery requires the pushed task branch plus the separately retained evidence
directory (run-tests.py, independent.js, validation.js, JSON and logs). Historical
assembler blobs used by startup harnesses must remain available via the accepted
startup backup branches documented in the integration report. Git alone does
not preserve ignored evidence or alternate object stores.

No full local build, canonical artifact, binary, browser, Boat call, deployment,
gameplay or full PE/NE invocation test ran. Canonical build remains outstanding;
original-runtime acceptance remains blocked by the recorded resume 403 at
`scratch/runs/20261021-hock-current-main-build-run/resume.json`. No retry or
alternate route was attempted, and that worker's staged repository is untouched.
The historical full window-publication replay remains missing. Startup tests
compile dependency slices with identity addressing, seeded classes, ret16
callback driving and recorded graphics boundaries; they do not qualify full
interpreter/Worker scheduling or native Windows behavior. Dialog return defects,
nested activation ownership, removed-target continuation liveness, native class
failures and CBT/DLGPROC reentrancy remain unqualified. Prior process/named-event
concurrency and general nonlocal ownership limitations remain. Coordinator review
and a future canonical build/runtime task are separate; this bounded task stops
after verified task-branch push.
