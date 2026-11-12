# Independent Hock registered smoke acceptance — 2026-10-21

**ACCEPT for bounded registered CLI startup.** Reviewed commit
`43e612a9294480448a7f7e832fae6c9ed01da734` against exact remote main
`d4ba733fb0d1c9e6d67ff0db715a5c0535307e6f`. No additional production repair.
The seven-path submitted change is coherent: Hock workload metadata, corpus
termination/classification, two regressions, game notes and report/evidence.
Prior scoring and registration integrations remain ancestors.

The 100000 → 1000 block quantum reduces the maximum block budget by 100×;
retaining 3000 batches alone is not equivalent coverage. It is nevertheless a
meaningful startup smoke: the unchanged original game loads its PE, DLL and
39-file VFS, initializes its window/audio path and reaches character selection.
Both the oversized diagnostic and normal-quantum capture show the same screen.
This is a bounded startup contract, not sustained gameplay, responsiveness or
performance acceptance. The 120000 ms deadline and failure gates remain active.

## Independent checks

* Verified the committed archive SHA256
  `3875e88a9a8eb5b667bf9dfd01c6ce66a5fe2c10a822660720687b94aebe18e7`,
  all **115 outer + 71 inner seals**, all four changed source hashes, submitted
  publication and actual source delta. Inspected the character-selection image;
  its SHA256 `7e12c9eed8c8489830261791a42b7a4a3716b4ab834ea50a149c08aac1122ac2`
  matches the registered normal-PNG observation.
* Fresh Boat API exec checked **7253 source seals**, exactly four intended
  differences, **44 intake seals, 39 original game files, 38 browser companion
  entries**, complete 39-file actual VFS and prior 28/71 evidence seals.
  No original bytes changed. Original EXE remains
  `974f1b5ff82cfdb87f05b9840ae03cd2ed6ceebe2c8ed547253dadaf1a871ef4`.
* Canonical module remains
  `728e1de80ec20a284fc41b339895ee8ac29f16e4ded83325b27576cfacd4466c`;
  actual consumer module remains
  `a5972cbaf915aa1d155b301da5fae1c80298b2be381034945c7e58cc81e02f72`.
  Reused sealed prior section comparison: identical executable sections, only
  the canonical 37-byte layout custom section differs. No unnecessary rebuild;
  sealed canonical all-gates build evidence was inspected and reused.
* Independent actual `node test/test-cli-candidate-corpus.js
  --id=hock-a-loogie-1995 --strict` on the same staging: **exit 0, 1 READY,
  0 blocked, 0 skipped, 0 harness failures**. Completed **3000 batches / 68196
  API calls / 38.820 guest seconds**, 45.101 s overall, below a 75 s outer bound.
  Observer recorded original argv/options, VFS and module without changing
  arguments or return values. No remaining guest/corpus process.
* Reran submitted runner regression, Hock metadata with 11 rejection controls,
  and Silver launch contract with eight checks: all exit 0. Optional historical
  intake fixture regression is not claimed; direct originals checks above pass.
  An initial sparse checkout lacked compile-src.js; adding the exact tracked
  dependency allowed the runner test to execute, without source modification.
* Independent controls exercise actual `runCandidate`: CRASH, STUCK,
  WebAssembly.RuntimeError, WebAssembly.LinkError, worker-prefixed RuntimeError,
  lowercase crash, unimplemented API, two missing-DLL formats, nonzero exit,
  signal and timeout all BLOCKED; compile failure HARNESS. Actual clean log plus
  DLL advisory READY. A **real WebAssembly unreachable trap caught by a child
  exiting 0** remains BLOCKED. A real CPU-loop child with SIGTERM handler is
  killed by SIGKILL at 1000 ms, returns ETIMEDOUT, remains BLOCKED, and its PID
  is absent (ESRCH). This is independent of submitted green test assertions.
* Reused exact sealed actual oversized-quantum negative: **exit 1**, ETIMEDOUT /
  SIGKILL at the unchanged 120 s child deadline, 122.922 s total; no outer kill.
  It preceded the boundary change, but timeout classification precedes the
  marker check; independent final-source controls verify this unchanged path.

## Classifier judgment and limits

Word boundaries correctly distinguish the advisory's “crashes as” from actual
CLI `*** CRASH at batch ...` and `STUCK at EIP=...`; punctuation-prefixed
WebAssembly.RuntimeError/LinkError and worker prefixes still match. Source
inspection found these actual diagnostics in the launch path. The new matcher
deliberately does **not** match arbitrary suffixed identifiers (`CRASHED`,
`CRASH_worker`, `RuntimeErrorExtra`); controls record this limitation. These
were not found as emitted fatal formats in the checked path. It is not a
general natural-language error detector. Nonzero exit/signal/timeout remain
independent gates. No demonstrated fatal-format regression justifies rejection.

Registered input/gameplay/scoring, browser selector/route, completion,
persistence, audible/correct audio, FPS and Windows parity remain unqualified.
The missing-comctl32 advisory remains visible and its unused ordinal paths are
not qualified. Prior explicit-EXE 0→5 scoring evidence remains separate.

Independent scripts/logs/receipts: adjacent
`hock-registered-independent-integrate-20261021-evidence.tgz` (SHA256SUMS.json).
Working evidence/recovery:
`scratch/runs/20261021-hock-registered-independent-integrate/`.
Remote new evidence: `/home/user/hock-registered-independent-integrate`;
existing staging and producer evidence retained. **bx_egnm3u4y left RUNNING**,
last test exec completed 09:22:40 UTC; expiry **10:44:02.530 UTC** per assignment.
Coordinator owns shutdown. No workers, box lifecycle changes, deployment,
root-WIP edits or laptop/Claude-fleet access. Stop after normal verified
task/main publication; fresh remote main must still be reconciled before push.
