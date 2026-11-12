# Enigma supervisor denial exit repair, 2026-10-24

A verified terminal capture denial now makes the transformed supervisor exit1
after child/group cleanup, log closure and terminal receipt publication. A caller's
`supervisor && dependent` therefore stops at the denial. The previous adapter
wrote `reason=capture-byte-limit` and child returncode1 but exited0, permitting
dependent work. This repair changes only that supervisor exit propagation.

The adapter inserts an exact-anchor conditional after the complete normal
`finally` tail. It is outside `finally`: an existing polling, cleanup or receipt
publication exception remains the original exception. There is no catch swallowing
unrelated failures. Natural success, missing/disabled diagnostic configuration and
the historical unrelated child-exit behavior remain unchanged. In particular this
does not broadly fix the old supervisor's exit0 for unrelated child exit1.
Original inputs, capture guards, runner error handling, raw receipt durability
and watchdog stop/reap source remain unchanged.

## Inputs and scope

Immutable main donor: `f879fd0cd81d918ea54a18b1b222fae25dd6d618` at
`/tmp/enigma-findfirst-independent-integrate-oct24/repo`.
Terminal candidate and task branch parent:
`ca285950d409fe8a18c65831a2d619e01c6667b0`.
Independent rejecting review:
`53990b0c159b2c6a46824ca038ab2a1fefa70c75`.
FindFirst supporting fixtures:
`455f3ba3e30a3eedef9a3ce984c1fb0321f9541a`.

All50 focused Git blobs were size/hash verified before checkout/copy, with
explicit noncone sparse checkout and read-only object alternates. Five historical
runner/VFS/transitive snapshots were also compared byte for byte against
`d8cd8c54c8d63c107696f1e4ef7a1e229dcadc1e` in the supplied main donor. Runner
SHA256 is `4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809`;
original supervisor SHA256 is
`73be15954cedc19340779ff6bda2397cb94927ca702d2baebdccd5e763cf7b73`.
All nine original review seals and23 standing real pngjs files verified.
Adjacent `input-verification.json` records exact revisions, file sizes and hashes.

The branch inherits the terminal candidate so its production repair is a focused
adapter diff. Unchanged FindFirst adapter/test/snapshots and independent review
oracle/seals are included solely to reproduce the required offline composition
and failing baseline. They are not further implementation work or main integration.
The historical originals and independent oracle remain byte-exact. The separately
named `test-enigma-supervisor-denial-repaired.py` changes only the evidence directory
to load the repaired adapter snapshot; `oracle-identity-only.diff` proves that
binding change. The wrapper rejects a stale candidate snapshot. The independent
composition fixture is byte-exact decompressed content relocated into `test/`,
where its original `__dirname/..` resolves this repository.

## Executed validation

Commands ran in `/tmp/enigma-supervisor-exit-repair-oct24/repo` through the bounded
task-owned `ops/run.py`: fresh MemAvailable>=805306368, Node heap256MiB, CPU/wall60s,
aggregate internal capture1MiB, per-file24MiB. Adjacent receipts preserve actual
argv/status, measured memory, complete bounded stdout/stderr and original failures.

| Command | Result |
| --- | --- |
| `python3 test/test-enigma-supervisor-denial-independent.py` | exit1 as expected: sealed old adapter supervisor exit0, dependent runs; old failing receipt preserved |
| `python3 test/test-enigma-supervisor-denial-repaired.py` | exit0 oracle: actual complete repaired supervisor exits1, dependent absent, terminal receipt retained |
| `python3 test/test-enigma-supervisor-exit.py` | pass: polling and fast natural child exit0/1, actual stop/reap code, shell AND, controls and reverting mutation |
| `node --max-old-space-size=256 test/test-enigma-terminal-capture-guard.js` | pass: original error identity, durable first raw receipt, no next main.run, successful/disabled/unrelated behavior, seven rejecting mutations, source/anchor/receipt controls |
| `node --max-old-space-size=256 test/test-enigma-findfirst-compat.js` | pass: real historical VFS matcher and existing rejecting controls |
| `node --max-old-space-size=256 test/enigma-supervisor-exit-composition.cjs` | pass: actual compiler-boundary FindFirst/terminal/quietFS in FTQ/TFQ, four other orders rejected, real PNG/VFS and no next main.run |
| `node --max-old-space-size=256 test/test-enigma-supervisor-exit.js` | pass: standard unit entry for repaired independent oracle, subprocess regression and unchanged triple fixture; rejects stale fixture identities |

The subprocess regression executes the actual transformed helper and complete
try/loop/finally through EOF. It also runs the original byte-exact `stop()` with
fake child/group interfaces, observes TERM/KILL/poll/wait/reap/group check/log close
in order, and performs real receipt I/O and shell AND. No real kill, guest setup or
old watchdog recipe runs. Removing the newly inserted exit guard yields exactly
the previous rejected transformation: supervisor exits0, dependent runs, the same
denial oracle rejects it. Success executes the dependent command; disabled/missing
receipts and unrelated child exit are compared against the original complete tail.
Polling, cleanup and publication exceptions retain their original errors; malformed
and oversized receipts fail. A polling exception still permits finalization and
receipt publication before the original exception propagates.

These are repair-author offline results, not subsequent independent acceptance or
gameplay claims. PNG startup/menu/gameplay remain unaccepted. Box ID/state/expiry:
none assigned; lifecycle remains coordinator-owned. No guest, WASM/native
instantiation, full build, browser, acquisition, deployment, worker launch, main
merge or box operation occurred. There is no mount argv to validate in this task;
no guest launch is authorized. Git uses the exact dedicated-key strict SSH
configuration from the assignment without changing trust files.

## Resources, publication and recovery

Initial projected task peak43411933/67108864 bytes included Git/source/temp/evidence,
full external session/events/history, positive SQLite growth allowance/future and
8MiB reserve. Projected host free3601880611>=2982150144; MemAvailable2678804480.
An initial local-file check found the sparse donor lacked a working quietFS file;
the already authorized immutable Git blob supplied it before checkout. The failed
check remains in session history; no access denial or policy bypass occurred.
Standing installed tools and immutable donors are charged separately from new
copies. Final `ops/resource-final.json` supersedes the initial projection and retains
all history/growth charges and future reserve. Root/index/refs and donors were
read-only; only this task checkout/branch, task evidence and append-only root board
were written.

The task's `ops/` retains commands, final scoped patch, commit, actual strict-SSH
remote SHA verification, resource and cleanup receipts and recovery instructions.
`ops/result.json` is written last. No main merge is authorized here. Independent
acceptance is the coordinator's next assignment. Next offline check is the standard
unit entry above; historical runtime/box recipes must not be executed.
