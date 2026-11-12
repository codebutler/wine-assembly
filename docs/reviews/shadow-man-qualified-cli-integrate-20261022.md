# CLI shell callback repair: qualified integration

With spawning enabled, the installed CLI `shell_execute` callback now calls
the existing VFS child transport once per WinExec/default/open request, after
calling the base callback once. Previously it could return 33 without a fork.
Capture retains priority; other verbs and disabled spawning retain base behavior.
Executable quoting, parameters, cwd and show are forwarded without an OS shell.
Missing files return 2; synchronous export/fork failure returns 0 and removes
the partial snapshot. The transport's existing merge and child lifetime remain.

Reviewed the complete `test/run.js` diff from main
`324cc4f9580755a4fcc97eea0a5e4070ea7a0df9` to production/regression
`0a130dc477ac7e885d520d05093db880c7be941a` (candidate
`30bdd15fb0c824701716ab04335a4688a7c36a96`). Those source bytes are integrated
unchanged. The focused regression exercises the installed callback and real
parser/export/merge with a substituted OS fork. Review
`13bb92cd2e1bc060ff908722843d1e97a439b1a4` also corrects three stale browser
test assertions for the existing `launchOpts` argument and rejects a missing
relative call. Those assertion changes are included; browser production is unchanged.

The combined intended main passed 20 targeted command outcomes: routing,
baseline zero-fork reproduction, four routing rejecting controls, corrected
browser assertions on baseline/candidate and three rejecting controls, authentic
ordinary-lazy VFS export and omission control, existing exporter, syntax and
automatic unit-tier classification. Expected failures were checked for their
specific assertion reason. Full build and guest execution were outside this task.

## Runtime evidence disposition

Retained run `20261022-shadow-man-top-level-ui-capture`, commit
`d2988e91d53c35ad0c1ab2bed0ced9e40bf8a205`, proves a genuine installer-owned
640×480 German welcome dialog with Weiter/Abbrechen. Its verifier and nine
offline predicate assertions passed again; the image was independently inspected.
ONE original Setup attempt lasted 55.841951871 seconds, with two genuine forks,
preloads and module instances: installer OS PID 61339 and helper 61346. Original
`_ins5576._mp` was extracted; 243 pins matched before/after. The remote 512 MiB
allocation was enforced; no ENOSPC was observed. No input or Accept occurred.

Exact tested host was `13bb92cd2e1bc060ff908722843d1e97a439b1a4`, containing
production `0a130dc`; historical module was **1,878,971 bytes**, SHA256
`f644bbb26edc077239dac17b8b2cfda482aafd9eb44af4c4776d4fe153d5a1a7`.
This was a mixed historical-module/reviewed-host closure, not a new canonical
compilation or a runtime test of the final documentation commit.

The diagnostic timer fired only after the 55-second limit (actual delay
54521.651199 ms); prompt stopping was not proved. Its intentional asynchronous
observer throw was not an emulator trap. Installer guest exit was unknown;
helper guest ExitProcess(0) and Node exit 0 do not establish installation.
Installation, gameplay, browser behavior, Windows parity, readiness and
asynchronous error handling remain unqualified. Return 33 means synchronous
transport acceptance, not child readiness or success. Existing parent-exit kill,
merge-failure and resolver/search limitations remain. Diagnostic observer changes
are excluded from production integration.

## Recovery and reproducibility

Integration evidence and replay:
`scratch/runs/20261022-shadow-man-qualified-cli-integrate/{verify.py,checks.json,source-identities.json,retained-evidence.json,runtime-disposition.json}`.
Run `python3 scratch/runs/20261022-shadow-man-qualified-cli-integrate/verify.py`
from the focused checkout. It runs offline checks and rejecting controls only.
The focused checkout must contain the exact-main supporting JS files identified
in `source-identities.json`, plus `lib/mem-utils.js`, `tools/test-tiers.js` and
`test/test-vfs-export.js`; recover missing text only from retained local objects
with `GIT_NO_LAZY_FETCH=1` and verify against the base tree.

Original independent review remains at
`/home/user/wine-assembly-shadow-man-cli-independent-review-oct22/scratch/runs/20261022-shadow-man-cli-independent-review/`.
Runtime REPORT/RECOVERY/verifier/PNG remain at
`/home/user/wine-assembly-shadow-man-top-level-ui-capture-oct22/scratch/runs/20261022-shadow-man-top-level-ui-capture/`.
Their exact hashes and paths are recorded in `retained-evidence.json`; do not
duplicate evidence stacks or guest fixtures. Historical closure donor is
`/home/user/wine-assembly-shadow-man-exact-runtime-closure-oct22`, commit
`a0236c978074ece58495c9eab7db6168e27e71b4`.

Original media/module and pinned closure remain under remote
`/home/user/shadow-man-tools-ready-oct22`; the runtime's 101 output files,
76,788,243 bytes, have a hash-verified inactive backup in its
`inactive-evidence/shadow-man-top-level-ui-capture-oct22` directory. Follow the
retained RECOVERY and handback hash inventory if separately authorized to recover.
Git does not preserve ignored media, wasm or the complete VFS outputs. Do not
repeat the guest run to reproduce this source check.

Coordinator receipt
`/home/user/wine-assembly/scratch/usage-watch/shadow-man-runtime-closeout-1937-oct22.json`
records box `bx_495585da` snapshot-stopped at 19:37:46.968 UTC. This worker made
no box query or lifecycle change. No compute is required or authorized here.

The isolated integration uses tree-preserving explicit staging, then
`git write-tree --missing-ok` / `git commit-tree` with exact main as parent:
unrelated missing blobs stay referenced without fetching or deleting them.
Publication receipts record actual canonical HTTPS task/main refs. Pushes are
ordinary fast forwards, reconciled immediately before main integration. No
shared root/donor HEAD, index, config or alternates are changed.
