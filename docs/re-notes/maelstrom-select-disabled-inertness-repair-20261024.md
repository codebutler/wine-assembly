# Maelstrom disabled select lifecycle repair — 2026-10-24

PASS offline implementation repair, pending fresh independent review. Started
from review `7fdbfc003ba8d41afa49b122ad0e8b8af1812d1e`, tree
`07392528b2305d7bf7acad1788e69b0e4cf76593`; rejected candidate
`0e1b2df6e3adff9ad43424966a389c2ea6af227e` remains in history. Main integration
is reserved for a fresh reviewer. Task branch:
`task/maelstrom-select-disabled-inertness-repair-oct24`.

The lifecycle observer reads `enabled` first and reads/validates observation
limits only when enabled. Disabled creation does not enumerate options. Transform
returns the exact source before reading lifecycle or pin configuration. Enabled
transform reads its two required pins explicitly after lifecycle validation.
The accepted event observer is unchanged. Disabled wrapping returns the exact
instance without memory/export access; no guest or instantiate access is needed.

Before repair, the unchanged independent `disabled-repro.cjs` reproduced all three
throwing-getter failures and exited 1. Its fixed acceptance contract explicitly
asserts **three failures**, labels the candidate rejected, and unconditionally
exits 1. It is retained byte-for-byte as historical rejection evidence. Adjacent
`maelstrom-select-disabled-inertness-repair-20261024-evidence/disabled-pass.cjs`
repeats the same three calls, requires zero getter accesses, exact transform
identity, disabled instance identity and no output. It exits 0 on this repair
and exits 1 on the unchanged donor candidate. No inertness requirement was relaxed.

Both lifecycle and accepted event suites passed with the exact standing runner,
exports and scheduler pins. The original seven lifecycle and six accepted event
mutations still reject; two added lifecycle mutations restore eager disabled
observer/transform access and also reject (15 total). Regression tests cover
throwing getters for every limit, lifecycle, both pins and unused string/symbol
options; proxies reject enumeration and every property read except `enabled`.
Explicit false, missing and undefined enable flags all remain disabled. Poisoned
source/instance/memory proxies prove identity and absence of access. Enabled
invalid configuration still rejects before guest reads. Syntax and diff checks
pass. Exact commands, exit codes, captures, hashes and checkout identities are in
the adjacent evidence directory; operational publication/result receipts live in
`/tmp/maelstrom-select-disabled-inertness-repair-oct24/ops/`.

Existing caps, call matching, run return/exception identity, original invocation
counts and no-clear controls remain covered. Summaries retain `witnessedReturns: 0`,
API completion unobserved and API result unavailable. Cached tick behavior is
unchanged. This is fake-instantiate/static validation only; the exact invocation
completion hook runtime gate remains unresolved. The historical winsock source
identity receipt is retained unchanged; no native observer was requalified.

Admission includes all newly owned checkout/index/Git/evidence, launcher/session
logs, full WAL, positive SQLite growth, future publication/transitive Git and an
8 MiB reserve within 64 MiB. Standing read-only tool/donor inodes were reused.
Checkout uses explicit sparse paths and dependency-first flattened alternates;
no fetch, clone, repack or object-store copy. No mounts or mount filenames exist
in this offline task; the unchanged trusted SSH configuration receipt is reused.
CPU/wall 60 s, Node heap 256 MiB, output 128 KiB, files 24 MiB and process-group
TERM/KILL/reap within 5 s remain enforced for task commands.

Retained setup failures: the first reproduction could not load the required head
observer dependency; its verified unchanged blob was then sparsely materialized
before reproduction. An accounting helper initially named `resource.py` shadowed
Python's standard module, preventing four syntax/diff subprocesses from starting;
renaming it `account.py` restored the same limits and all checks passed. These were
internal setup errors, not access denials. A bounded board watcher ended at its
50-second deadline (exit 124) and was reaped. Historical receipts remain intact.

No real WebAssembly instantiate/compile, native/guest execution, download, box,
deployment, worker, independent review or main integration occurred. Root tracked
files/index/refs and all donors stayed read-only; only root append-only messageboard
updates were made. No box assigned: coordinator reports `bx_qa9ex5bu` stopped;
`bx_69aem736` was untouched. Claude idle. Final commit/tree/actual remote SHA,
resource and cleanup receipts are in `ops/result.json`.
