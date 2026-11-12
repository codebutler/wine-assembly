# Independent frozen select adapter review — ACCEPT (offline)

Reviewed candidate `f977ded63e9bc13d12a3ea66966502a8abbd693e`, based on
main `606caff1de558f185487aed5e31ede159262ba7e`. The candidate is integrated
unchanged. This accepts its source/model/host adapter semantics, not an original
game capture or a new native qualification. No compiler, native module,
guest, test box, public deployment, worker or subagent was used.

The historical result, attempt and identity come from the unchanged
instance/export-bound snapshot and oracle. Later live EAX/ESP/EIP have their
own batch/time metadata and explicit later-state label. The immutable hook
can be observed after subsequent guest instructions. No execution fence,
short batches, completion-time fdsets or completion-time live EIP are required
or claimed. The accepted native qualification on base main is not rerun.

## Source and placement findings

The two production additions are the adapter and the exact runner transformer.
Their candidate blobs remain `9ada19e7e0570ae841e4f82cfb4cf9cd7fc4d7b7`
and `d91571577ae28db2cd696ac068b65d958fe0b1e1`. Hook SHA-256 remains
`b7c77c20b12cd582d6fcfbe246e1f0abdcb644266fc3f161bf5d683d93b13930`.
No WAT, hook, oracle, scheduler, pacing or input changes occur.

The transform requires runner SHA-256
`4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809`
and four unique anchors. Full transform/restore returns exactly the pinned
685960-byte source; changed source and duplicate/missing anchors reject.
Setup follows actual instantiation at original line 4850, before `ctx.exports`
and PE/DLL startup. Observation follows normal return at original lines 10363,
10831 and 10876. Main suspension still skips execution and observation; the
parallel swallow and serial break paths retain their original guest behavior.
Diagnostic observation catches are internal to the observer. A throwing run
does not observe. No new wrapper executes or alters guest calls.

The idle shortcut requires started=1 and every other diagnostic scalar zero;
the unchanged-park shortcut compares every field. Neither creates a historical
result. Changed snapshots go through the original fail-closed oracle. Missing
attempts and counter gaps reject. Closure precedes live reads and persistence,
so failure cannot replay a previously accepted completion. The diagnostic
catch reports failure and disables observation; it does not claim success.

## Evidence

Receipts, full bounded stdout/stderr, generated real JSONL, supervisor and
resource measurements are retained beside this report in
`maelstrom-select-frozen-independent-integrate-20261024-evidence/`.

| Check | Outcome |
| --- | --- |
| Supplied adapter suite | 12 groups pass, including live-result and live-fence baselines rejecting |
| Unchanged hook/model suite | 11 groups pass |
| Unchanged hook repair suite | 16 groups pass |
| Independent idle/park sequence | repeated idle/unchanged parks followed by genuine attempt 2 completion pass |
| Independent missed attempts | unseen initial and intermediate parks reject and close |
| Independent malformed states | fault, capped, wrong API, counter/token/post gap and pending identity change reject |
| Independent lifecycle | invalid batches, failed start, duplicate start, closure and replay controls pass |
| Actual generated sink | two separate instances append two LF-terminated records; both independently parse and preserve result/later state |
| Actual run fragments | sink/readLive exceptions preserve guest continuation, guest exception identity and swallow/break distinction at all three sites |
| No option/suspension | opaque revoked owner untouched; suspended main does not run or observe |
| Independent rejecting mutation | suppress oracle rejection in process only: unseen-attempt regression fails with missing expected counter-gap exception |

The independent suite has eight groups and uses the unchanged source evaluator.
The rejecting mutation never edits candidate production files. Wrong instance,
source, forged/copy/mutated/replayed capture, cap and closed-source cases also
pass in the unchanged hook repair suite. No broad swallowed rejection passed
these controls. Ordinary sink failures produce a diagnostic and no successful
record; persisted evidence is only available after an actual successful write.

Reproduce in this checkout, supplying a **new empty writable directory** for
the independent persisted sink:

```sh
node --max-old-space-size=256 test/test-maelstrom-select-frozen-record.cjs \
  /home/user/wine-assembly-shadow-man-span-static-canonical-oct23 \
  /tmp/maelstrom-head-yield-observer-oct24/ops/run.js
node --max-old-space-size=256 test/test-maelstrom-select-completion-hook.cjs \
  /home/user/wine-assembly-shadow-man-span-static-canonical-oct23
node --max-old-space-size=256 test/test-maelstrom-select-hook-repair.cjs \
  /home/user/wine-assembly-shadow-man-span-static-canonical-oct23
node --max-old-space-size=256 test/test-maelstrom-select-frozen-independent.cjs \
  /home/user/wine-assembly-shadow-man-span-static-canonical-oct23 \
  /tmp/maelstrom-head-yield-observer-oct24/ops/run.js NEW_EMPTY_DIRECTORY
```

Initial review bookkeeping errors are retained: an unnecessary source-root HEAD
equality assertion failed (HEAD is d8cd8c54); all six consumed source files were
then verified byte-equal to assigned b41a7c5 and their hook pins. The first hook
test lacked its JSON pin fixture in the sparse set; adding that unchanged
dependency passed. An initial suspected sink escaping problem was disproved
by generated-code execution and real LF-framed persistence. None was a candidate
defect or access denial. The original failed hook receipt is retained.

## Integration and limits

Exclusive shared integration lock covers reconciliation, final checks and
publication. Actual remote main was exactly expected 606caff1 and the candidate
task ref exactly f977ded6 before integration. The owned sparse repository uses
flattened dependency-first read-only alternates, without fetch, clone, repack,
object copy or full-tree materialization. All 23 candidate changed blobs are
verified unchanged in the integration commit. The added report, independent
suite and evidence are reviewed and committed, then relevant suites are run
on that exact committed tree before atomic fast-forward publication of task
and main. Final SHA/tree/ref/blob receipts reside in the owned ops directory;
publication is conditional on those checks. A changed main blocks publication.

The 64 MiB accounting includes checkout/Git/staging/temp/evidence/publication,
full external session and launcher logs, positive SQLite growth, future growth
and 8 MiB reserve. Installed tools and existing read-only inputs are separately
accounted. Cheap execution uses 256 MiB Node heap, 60-second CPU/wall limits,
bounded output/capture and process-group TERM/KILL cleanup. The existing exact
filename-bearing tree-mount receipt is reused; no mount or guest is executed.
Strict dedicated Git SSH trust configuration is preserved.

Runtime arrival, retries/completion in the original game, fdsets/timeval,
thread/route state, gameplay, overhead and runtime equivalence remain unknown.
Nested DLL-loader runs and worker instances are outside this adapter's three
explicit run sites; missed attempts still reject. No new native qualification
is inferred from source, model or host-fragment controls. No box is assigned:
bx_vwsk6745 is coordinator-reported stopped and unqueried here;
hostbx_69aem736 is untouched; lifecycle remains coordinator-owned.
