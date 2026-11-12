# Accepted named-event integration, 2026-10-21

The coupled named-event repair preserves the original finite wait budget across
Worker delivery and reserves registered wakes until their owning continuation
observes them. This integration retains the exact accepted production bytes:
candidate `ea2888d76c9d69415e1fd15e1995d7f19a7125fd`, independently accepted by
`73e767f310c0b72b1680affad5148f9baea459aa`. No additional production repair is
included. The entry-to-registration interval remains unreserved.

## Dependency closure and integration review

Remote main was reconciled to `f3698d8827aa048af14e0f0cbaa733bb96801949`.
The accepted review descends directly from it through twenty linear commits;
the complete list and fifty changed paths are in the adjacent evidence.
Every intervening change belongs to this closure:

* `c9e03eb6e40481f6bb570a89f96b856a9a1d5e83` corrects already-attached
  scheduler fixtures used by the regression gates and adds lifecycle coverage.
* Nested cooperative producer progress at `8213294c2ab39b1b925c45da3bf25355c17a4c55`
  was rejected by `64a4132887e1180663fe44c1d8dc35eed18ee023`; its lifetime
  correction `b01994ffac83f083c474c8a98a507a6dd417f0fa` was accepted by
  `f695767607fa614cf27f2dc7c5c604f6073f6e0c`. The authority/CLI stack explicitly
  uses that accepted baseline. Both rejection and corrected acceptance remain
  historical evidence, with the corrected final source integrated together.
* Authority `5bcb4dba9d03a4e76fb25c72bdf5a75acbc34679` was accepted by
  `f503b7997f87607e5575b6028342b557f775aae6`; zero-time CLI wiring
  `250765e0835dcb4655d06189d05d69c2437d8b3b` by
  `8f4ade77e9af1b47463f527118f1035fc22cb986`.
* Finite scheduler `ae0df56636e56b34e4d707655add361a25535799` received only
  component acceptance in `f7cda9b9ee28f5f96d4db24198ad3e4324b96fdb`.
  Wake reservation `26440fa1ed3e1a4bc0301bc103e694b77d0529de` and its review
  `6eb85ae797552c7c39930b8fb554bc8150903ba9` supply the missing provider state.
* Caller clock `32876c2596213d82e4ad074b37fe19bb18400b72` was accepted by
  `0fab66e15696afcdfab95ee2c68deac2d00d48fe`. Diagnostic-only commits
  `41f4375fd762df23a048a7718599481ccfd5683c` and
  `a9a60c69f8598562d80bf8b97f64b3864476280b` document the remaining Worker
  entry and untimed-consumer blockers; they are not production acceptances.
* `e4cf855510ec321f2d7e114e44884e9af7afc915` and `ea2888d76` implement the
  coupled entry, transport, reservation, continuation and lifetime repair;
  `73e767f31` independently accepts that final scoped contract.

Reports and receipts were reconciled across this chain. The exact aggregate
production diff changes only five library files, CLI `test/run.js`, and comments
documenting the existing RPC allocation in `src/00-regions.wat`. Other changes
are the associated tests, fixture corrections and review documents. No game
registry, package, laptop HeroesII/WarcraftIII, deployment or fleet files occur
in the diff. Main is an ancestor; no conflict resolution or historical unrelated
merge is needed. Shared checkout WIP and its HEAD/index/config are preserved.

## Scoped validation

On Linux Node 24.18.1/libuv 1.52.1, all 42 selected commands returned their
expected outcomes: 32 successful commands and ten deliberate assertion
rejections. Nested runners include additional internal cases; 42 counts the
top-level commands. The candidate's complete 27-command selection and the
independent review's three new commands were replayed, followed by twelve
prerequisite checks. These exercise real Node Workers/subprocesses and socket
authority, with source-extracted CLI/Worker adapters and synthetic guest exports.

Coverage includes original entry deadlines, manual-all/auto-one registered
Set–Reset wakes, one reservation, status-only polling, continuation identity,
single stack completion, cleanup/loss/poisoning, ABI, zero/nonnamed/nested
regressions, full ThreadManager and Worker scheduler suites, nested lifetime,
authority, wake provider and caller clocks. Static region declaration/mirror,
import signature and WAT/JS constant checks pass. Tier validation uses the full
Git test inventory despite sparse materialization. Negative logs were inspected
for the intended behavioral assertions, not merely nonzero exit status.

The known sparse-stack test remains a failure, separately recorded and never
counted green. Replaying its exact test with the accepted, exact pre-coupled
`a9a60c69`, and main `f3698d88` ThreadManager sources produces the same line-76
assertion: actual `1074790392`, expected `1073807352`. Source hashes and all
three logs identify the comparison. The accepted manager was restored exactly.

All 77 candidate artifact seals and 29 independent-review artifact seals verify.
The fifty integrated source paths are SHA-256 sealed and match accepted Git
blobs. Tests introduce no production edits. No full build, browser, runtime-box,
full VM, Windows oracle or game qualification was performed.

## Backup, evidence and recovery

Before integration, both remote branches were pushed and verified by exact
`ls-remote` hashes:

* `task/named-event-cli-end-to-end-oct20` → `ea2888d76c9d69415e1fd15e1995d7f19a7125fd`
* `review/named-event-coupled-ea2888d` → `73e767f310c0b72b1680affad5148f9baea459aa`

The isolated repository uses the shared repository's existing strict SSH command
without altering shared configuration. Historical reports' publication holds
and NO REMOTE BACKUP statements describe their earlier runs; the authorized
2026-10-21 access recovery and these verified backups supersede those holds.
Public deployment remains prohibited.

Evidence root: `scratch/runs/20261021-named-event-accepted-integrate/`.
The adjacent `named-event-accepted-integration-20261021/` directory preserves
the command manifest, results/logs, dependency list, source seals, baseline
failure comparisons and verified backup refs in Git. The external receipt
records final task/main hashes and post-push verification. Fetch the accepted
review branch, check out its exact commit, and execute commands.json from that
checkout; copy tier-check.cjs one directory above it. Negative controls must
reject at the recorded assertions. Caller-suite artifacts include their
mutation copies and nested results; their recorded absolute paths are historical.

The preflight measured 39,694,336 bytes of sparse files plus 16 MiB reserve,
below the 64 MiB local task cap. Free space was 3,038,564,352 bytes at admission,
above the fixed 2,285,895,680-byte floor after reservation. Final allocation and
free space are recorded externally. Borrowed object stores are read-only;
remote accepted refs now preserve their reachable history independently.

Qualification remains trusted Linux peers on the stated Node/libuv versions,
same boot and stable calling-thread time namespace. Registration is the wake
linearization point; a pulse entirely before it can be missed. The deadline
bounds eligibility, not RPC return latency. Windows, browser, full interpreter
and game acceptance remain outstanding and are not inferred from integration.
