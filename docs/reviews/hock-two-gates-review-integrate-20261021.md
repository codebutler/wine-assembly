# Hock canonical prerequisite integration review

Verdict: ACCEPT the two prerequisites for integration, with source-slice
qualification only. Base is `5b078c91d5cf6da5e337cda5e7665803c03c99e5`.
Reviewed owner candidate `4174b3b84330fe5a83942ba1d3ddd6b2e0395a13` and
A/W candidate `268b3fcd4b7adc7f5da8c0e077cf14b809d9638f` independently in
`scratch/runs/20261021-hock-two-gates-review-integrate/repo`.
Task branch: `task/hock-two-gates-review-integrate-oct21`.

## Semantic findings

The original STARTUP_SHOW_STATE owner names a global in a fragment that only
references that global. The replacement names `$startup_show_set`, a top-level
function in that fragment which directly publishes the command at offset 4,
the first-show latch at offset 8, and the explicit-value flag at offset 0
using atomic stores. It is a valid direct owner. The exact region file differs
only in that annotation: no size, alignment, allocation or executable change.
Both the obsolete owner and an indirect consumer are rejected by the real CLI.

`$class_table_register_data` is exactly a two-argument, result-returning
forwarder to `$class_table_register_encoded` with final argument zero. It has
no locals, side effects, synchronization or cleanup of its own. Independently
parsed AST comparison expands precisely two calls and matches the entire
combined runtime fragment, ignoring only parser positions/comments. Evaluation
order and the original arguments are retained, including ExA's +4 structure
offset and A's guest-pointer translation. Core locking, record copy, encoding
publication, atom behavior, procedure selection and ESP cleanup remain in the
same unchanged code. W handlers and the helper fragment are byte-identical to
base. This is a census-visible expansion, not a new registration implementation.

The complete combined callback census passes with 401 unchanged boundaries.
All root JS, lib JS and WAT inputs to that scan are materialized. These ANSI
handlers have no direct EIP/invocation boundary and are not exported producer
wrappers; their changes do not alter an inventoried producer digest. There is
no producer drift prerequisite here and no census, baseline, classification,
ownership-pending assertion or nonlocal review lock was refreshed.

## Independent replay and evidence

Verified every sealed file in both committed archives: 68 owner artifacts and
38 A/W artifacts. Read the committed reports, diffs, contract harness, adapter
scope, original receipts and command ledgers. The integration archive beside
this report preserves the independent commands, exits, diagnostics, source
hashes, admission record, replay scripts and inherited adapters.

- A/W replay: 17 commands, nine successful exits and eight expected rejecting
  exits. The real four-handler contract passes 28 groups on combined source
  and again on original ANSI source. Six behavior mutations and two actual CLI
  disconnections reject at their intended assertions/diagnostics. The live
  census regression has 15 checks over 251 pairs. No baseline update.
- Owner CLI rejects the original missing definition and an indirect consumer.
  All 267 owner declarations pass, with 21 owner-regression checks. Strict
  declarations, memory/RPC mapping and generated mirror checks pass.
- Callback census and its mutation suite pass, including final restored-source
  replay. Manifest, fragment balance, duplicate-WAT ratchet, allocation shake,
  handler ESP, logical-AND, stdcall epilogues, compiler provenance, layout-offset
  freshness and whitespace checks pass.
- Startup replay passes 24 submitted cases, 21 latch probes, 24 independent
  groups and 48 adapted transport/layout checks with three internal rejecting
  controls. Lifetime adapter passes 89 checks and five internal controls.
- AST equivalence and 1,045 materialized source/tool/test input seals are in
  `equivalence.json`; only the two production files and two regression tests
  differ among those base inputs. The staged diff is exactly the candidates'
  nine-file union plus this integration report/archive.

The review ledger retains a compiler-provenance checkout failure before its
required exact-base test files were materialized. Initial receipts separately
retain missing contract/owner-test sparse paths. The first callback attempt
omitted host.js and rejected its missing producer; after exact-base root JS
materialization, the complete scan passes. One mistakenly root-relative census
invocation exited MODULE_NOT_FOUND. Review-script development also encountered
cross-VM AST array prototypes, an intentional owner-mutation overlapping an
early read-only proof attempt, and Git stdout buffer exhaustion. The final
proof normalizes parser arrays and uses a bounded 16 MiB output buffer; it ran
after mutations finished. These are review harness/checkout failures, not
production fixes or ignored acceptance failures. Original ledgers and workflow
notes retain them; the latest exact-command outcomes govern acceptance.

## Limits and integration

The historical transport harness lacks ThreadManager; the historical lifetime
fixture predates the two-argument publication ABI and generation declarations.
Replays use the previously preserved, reviewed adapters with exact-base fallback
reads. Their mocks record process transport and single-thread lock boundaries;
they do not prove real child startup, concurrent locking or full PE/NE callbacks.
Unchanged base passing the same behavior suite establishes equivalence for
those exercised cases, not correctness of every Unicode, integer-name or
registration edge case. ExA's existing translation and wide key truncation are
unchanged. The previously missing toy-VM font was not materialized or qualified.

This is not a full canonical build or all-build-gates claim. Remaining build
gates, full WATX compilation, compiled-module checks, original Hock startup,
screenshots and gameplay require the separately authorized canonical/runtime
task. No assets, full local compilation, Boat/runtime/browser, workers, compute
or lifecycle operations were used. Shared checkout/config, laptop changes,
Claude fleet and stopped boxes were left alone.

Integration is an ordinary non-force fast-forward only after latest main is
reconciled to the unchanged base and the task commit is pushed and verified.
Post-publication exact refs are recorded in the run's publication receipt and
append-only repository messageboard. The isolated repository borrows Git object
stores; the pushed task branch and committed archives are the durable recovery
copy. Replay `run-tests.py`, `review.py` and `node equivalence.js` from a fresh
isolated run with this source, respecting the 64 MiB cap and 2,285,895,680-byte
free floor. The admission projection was 39,174,144 bytes plus 8 MB reserve.
