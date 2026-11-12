# Shadow Man zero-transfer independent source acceptance, 2026-10-23

Historical source last updated, 2026-10-23. Runtime and implementation claims below describe that dated source; see current app notes and source for subsequent changes.

**ACCEPT_SCOPED_OFFLINE** for candidate
`2e6f5984d3f64d7781fb02da09bbb8d564302123`, whose exact parent is
`b41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a`. No source correctness
counterexample was found within the selected, single-instance diagnostic path. This accepts the source instrumentation and offline controls, not a compiled
module, native execution, original capture, ordinary callback completion, or
game behavior. Original `61e1ea2d` remains **REJECTED**; its immediate zero
writer remains **UNPROVEN**. The preexisting original modal differs from the
synthetic callback-created modal; zero state alone proves no normal completion.

## Actual source control flow reviewed

| Boundary | Source finding and acceptance limit |
| --- | --- |
| CACA0005 writer | `09b-dispatch.wat:1335–1343` records after `handler_set_eip=1` but before `eip=0`. The marker is the metadata actually loaded by the dispatcher; the thunk is computed from the dispatched index, rather than inferred from its name. The helper requires explicit run thunk-entry mode and architectural pre-EIP equal to that actual thunk. |
| Actual versus named thunk | Both named continuation values are retained. A CACA0005 marker at an unexpected address remains `native-caca0005` with `syncReturnThunkMatches:false`; this identifies the executed source assignment, not an authenticated intended continuation. No ordinary-return inference is licensed. |
| RET / RET imm | Both read the existing stack word once into a local, snapshot it before EIP/ESP mutation, then perform the original mutations, `cs_pop`, and `branch_end`. No extra guest stack dereference is introduced. RET imm uses the actual operand for predicted post-ESP. |
| Fused POP/RET | Record follows successful `stack_run_pop` and uses post-POP ESP as the RET address. Actual source commits POP ESP, returns early on its reported fault, and chooses the existing fast translated load or `gl32` slow read. The record describes the terminating RET, not the preceding POPs. |
| Return to the run desk | Actual `cs_pop` only updates its diagnostic depth. `branch_end` delegates to `branch_end_at`; armed range tracing recomputes both chain and tier guards, causing a desk return before following another threaded block. This closes the gap left by the evaluator's no-op tail stub for this selected adapter. |
| Four record calls | Exactly CACA0005, `th_ret`, `th_ret_imm`, and `th_pop_run_ret`; all are before the corresponding EIP write. The sole check call is immediately before the existing first-zero diagnostic event in `$run`. Complete locations are in the source receipt. |
| Fresh/reentrant run | Entry clears kind and thunk-entry flag. The zero desk validates before the next nonzero iteration clears them. A new invocation cannot inherit prior attribution; an outer invocation may conservatively lose attribution after nested work, which yields unknown rather than a fabricated writer. |
| Explicit thunk dispatch | `$run` sets the entry flag immediately around `win32_dispatch`, clears it afterwards, and branches back to the zero desk. CACA0005 sets `handler_set_eip`, preventing the normal auto-return pop from replacing its assignment. |
| Inline dispatch | Nonzero desk clears the flag; inline CALL/JMP dispatch has no arming site. Actual inline callers can overwrite EIP after the handler, so these cases remain unknown, even if architectural EIP happens to equal the thunk. |
| Deferred unload | The dispatch wrapper first completes resource unpinning; those helpers release pins, not guest control. If release schedules a drain, it clears kind before any deferred EIP selection/unload. This conservative invalidation can discard a real CACA assignment but cannot falsely name it. |
| Other writers | CACA0004, auto-return, indirect CALL/JMP-to-zero, Win16/far/tier paths, and host-supplied zero receive no fabricated attribution. Run entry/nonzero iteration reset, plus the selected trace guards, bound history to the immediate desk trip. |

The record/check match saved **i64** token and root, synchronous depth,
diagnostic count, and predicted ESP. The zero event increments count once;
serialization independently requires that adjacency, zero EIP and matching ESP
and depth. Saved modal fields belong to the pre-transfer snapshot; live modal
fields remain in the ordinary boundary envelope. No attempt is made to certify
all modal-frame history. `preEip` is the architectural block EIP, not a promise
of the exact RET instruction VA; the site and threaded cursor provide context.

## Actual CLI and observer contract

The actual CLI selected-send hook is unchanged. The selected adapter binds the
instance object, PID, exact runner, `dlg-cmd`, command 3, action sequence, live
resolved dialog and batch. Earlier Config/OK actions run before arming, with
bounded retained history. Selection does not reuse synthetic batch/HWND values.

The actual preload checks runner realpath/hash, named module bytes/hash,
single compile/instance identity, no start section, no alternate constructor
or streaming path, and main thread. Its `retain` function calls `writeSync`
then `fsyncSync`. `arm` retains the pre-arm receipt synchronously before trace
configuration, native mode 2, and the actual send. A retention failure stops
before send; unsupported protocol version stops before arming. These source
ordering facts were inspected; this review did not execute the real CLI or
intercept a real OS fsync/exit. A future watchdog must independently bound
synchronous execution; the metadata does not enforce that watchdog.

## Executed offline controls

Results: **24/24 candidate checks PASS**, **7/7 independent lifecycle checks
PASS**, exact-source audit PASS, all exit 0 with empty remaining process groups. See candidate receipt (historical artifact: `shadow-man-zero-transfer-independent-review-20261023/candidate-offline.receipt.json`),
independent receipt (historical artifact: `shadow-man-zero-transfer-independent-review-20261023/independent-probe.receipt.json`),
and source receipt (historical artifact: `shadow-man-zero-transfer-independent-review-20261023/source-review.receipt.json`). The copied candidate test changes exactly one ROOT path to read the standing
candidate in place and write outputs only beside the owned test; the input hash
and replacement are retained in
test-adaptation.json (historical artifact: `shadow-man-zero-transfer-independent-review-20261023/test-adaptation.json`). No donor files are written.

The independent probe uses its own small parser/evaluator for the actual run
entry clears, zero-desk prefix, explicit thunk arm/call/clear/auto-return path,
CACA branch, record/check helpers and deferred invalidation. It checks no stale
writer across fresh/reentrant entry and nonzero iteration; unknown inline
dispatch even with matching EIP; token/root/depth/count/ESP invalidation; and
positive immediate CACA preservation. Three intentionally defective in-memory
mutations independently remove run clear, iteration clear, or inline gating. Each then triggers the rejecting **false writer inherited** assertion. They
are rejecting controls, not defects found in the candidate; no production fix
was made. The probe models thunk bounds/metadata, invocation reads and unexecuted
run service helpers and does not run the whole interpreter.

The 24 candidate tests faithfully exercise the changed forms they select and
the real JS serializer. Their full-run claim is narrower: run/deferred checks
extract particular resets rather than executing whole control flow. Fused POP
setup is stubbed, fast mapping is prearranged, `cs_pop`/`branch_end` are no-ops,
invocation ownership is stubbed, and pre-arm retention is a mock rather than an
actual filesystem/CLI. Thus they cannot prove canonical compiler behavior,
real fused POP address selection, memory traps, native invocation validation,
reentrant execution, actual CLI process binding or OS86 termination. The source
walk above checks surrounding implementation but does not upgrade these models
to native evidence.

## Source/census/ABI impact

Exactly **+96 instance-global value bytes**: 20 mutable i32 plus two mutable
i64 globals, with engine storage overhead additional. Existing field accessor
protocol version is **1** at field 9; **mode 2** opts in, fields 10–28 expose
the record. No new named import/export or linear region is claimed or found
in the source diff. Function/global indices, code bytes, and resulting module
identity will change. This source census is not a compiled ABI inventory. Producer hashes, compiler files, census fixtures, and acceptance oracle were
not refreshed or repaired. Historical module
`8fac39936b6df2418ad86cab118cef19a65a727f649fbc14c412b37818904686`
is not evidence for this candidate and was not copied or instantiated.

## Exact remaining qualification, future coordinator assignment only

1. Under a fresh compatible build allocation, pin this candidate's complete
   `src/main.watx` include closure and exact compiler path/blob/full hash plus
   byte-exact excerpt recipe. Produce the corrected static ABI-helper receipt
   including both storage regions **and named spans** (including DIRECT_WINDOW),
   with omission/change/duplicate rejection controls. Do not inherit historical
   producer acceptance or a storage-only fingerprint. Resolve required
   producer/census gates under a separately assigned change; this review has
   not authorized skipping them.
2. In that complete qualified checkout, execute the actual canonical command
   **`bash tools/build.sh`** and retain every mandatory gate result, new module
   SHA-256/size, ABI census and reproducible source/compiler binding. Never use
   `wat2wasm`, a helper-only build, or the historical module as substitution.
3. Native acceptance must use that exact **complete** module, real ownership
   initialization and a future focused fixture that invokes actual `run`,
   dispatcher and decoded guest RET paths. Cover explicit CACA0005 (including
   actual/named mismatch), C3, C2 imm16, fused POP/RET fast and slow routes,
   nonzero/unknown/inline/deferred/reentrant/stale cases and modes 0/1/2. Require pre-mutation fields and real token/root/depth/count/ESP adjacency;
   use the unchanged capture adapter and required-order rejection. Assert no
   false attribution on all unknown controls. Returning observer must trap;
   process capture must fsync pre-arm before native arm/send and terminate
   OS86 with all groups reaped under an external watchdog. A native fixture
   for these new writer paths does not yet exist in this review; creating and
   qualifying it is a concrete remaining dependency, not an implied PASS.
4. Existing executable regression entry points to retain are
   `node test/test-shadow-man-null-capture.cjs`,
   `node test/shadow-man-null-actual-paths.cjs`,
   `node test/shadow-man-null-repair.cjs`, and
   `node test/shadow-man-null-fresh-selection.cjs`, each under its admitted
   guard. The first two assemble extracted fixtures and are not substitutes
   for the complete-module gate. Their declarations must first be reconciled
   with new helper dependencies: for example `test-shadow-man-null-capture.cjs`
   injects the new header but its handwritten globals omit `reg_base`, `ip`
   and the named continuation globals. This is an inspected fixture dependency,
   not an executed compiler failure; this task neither ran nor fixed it.
5. Only after those gates, authorize one original actual-CLI observation with
   the new qualified module, exact unchanged runner and this candidate's
   preload/capture closure. Use `SHADOW_NULL_MODE=revised-first-zero`,
   `SHADOW_NULL_ZERO_TRANSFER=1`, `SHADOW_NULL_BLOCK_POLICY=required`, explicit
   newly built `--wasm`, pinned SHA, PID/runner binding and external watchdog. Observe fresh Configuration, OK, new launcher and counted final ordinary
   Beenden; retain actual argv/action/instance/module/fsync/native writer/terminal
   evidence. A required-block/order failure remains rejection even with a
   known writer; never resume past zero. This can distinguish the historical
   fork but cannot retroactively prove the old session's writer, settings,
   Play, persistence or gameplay.

The canonical and existing regression commands above are executable future
entry points, not commands run here. The new complete-module writer fixture
and fresh original action selection require a new bounded assignment; there is
no already-qualified native acceptance command for this candidate to reuse.
