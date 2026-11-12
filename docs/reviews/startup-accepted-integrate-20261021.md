# Accepted startup closure integrated on current main

The startup latch now survives NULL/invalid HWND calls and failed creation,
and commits at the successful show boundary using the invocation's saved HWND.
A nested successful show retains its consumption if the outer creation fails.

Integration base: `4261fd93a512dd1377818c4f374addbb8aee6267`.
Reviewed candidate: `aa8f7e23362eca7db7a71beb3deab3f20bbb916e`.
Independent closure: `3ad30f66ad19df9551de853e23570e298b9a45bd`.
Tested source tree: `67c9989e2c32d066f5dcc548701efba605781ad7`.
The final documentation/evidence commit does not change those tested sources.

Both exact historical candidate/review branches were pushed and verified with
ls-remote before integration. Seven scoped commits were ported in order:
e295f1128, ea6f896e8, 8bcd437fa, b09ba2e35, 3ba8e4a46, aa8f7e233, 3ad30f66.
This includes the reviewed ShellExecuteEx transport prerequisite and its D1
environment repair acceptance. Main already contained the four-line D1 repair;
its port adds only the supporting report/test. No unrelated historical ancestry
was merged. All 33 changed paths belong to that accepted closure.

Only the appended region declaration and its generated mirror conflicted.
Main's lookup regions remain in place; STARTUP_SHOW_STATE is appended at the
allocator-selected `0x07FCA2F0`, size 16. The unmodified generator produces
layout hash `7714899180ab402f`. Validation confirms every previous exported
region descriptor/base/size/end remains unchanged. No census manifest was edited.

## Regression evidence

25 final commands have expected outcomes: 11 successful commands and 14
behavioral assertion rejections. Failed harness setup attempts remain in the
logs and are excluded from those totals.

- Original submitted startup matrix: 24 cases pass.
- Repair acceptance: 18 acceptance groups plus three inherited observations.
- Independent accepted oracle: 24 groups pass against exact integration blobs.
- Transport/layout/static validation: 68 checks and three rejecting transport
  controls; includes browser option handoff, both CLI callbacks and child parser,
  pre-PE publication, region preservation, changed-fragment balance, JS syntax,
  logical operands and silent-handler gates.
- Five latch controls reject NULL guard removal, early consumption, blind abort
  rollback, missing successful commit, and global instead of saved HWND ownership.
- Six submitted controls reject explicit selection, startup info, continuation,
  renderer, iconic state, and previous-visibility return mutations.
- Exact rejected original b09ba2e rejects NULL, failed NCCREATE and failed CREATE.
- Exact baseline 8bcd437 retains dialog-marker, nested-creation ownership and
  removed-target continuation observations. Integration retains those observations.
- Shell/environment prerequisite replay: 177 named checks, 13 independent
  expected rejections and the original replay's 13 controls. Eight D1 expectations
  pass repaired integration and reject the exact parent. Allocation, error,
  shared environment/CRT and deferred launch lifetime coverage is retained.
- Generated host signatures pass for 290 imports; generated region freshness and
  diff whitespace pass.

The original validation harness lacked main's ThreadManager/live child context.
The integration runner supplies the actual ThreadManager environment serializer,
an explicit inherited endpoint sentinel, and a real Set. Its existing fork is
still a recording boundary; no authority or child is launched. The prerequisite
harness also needed main's actual extracted process-handle lookup and actual
startup argument serializer. All original assertions and controls are retained.
These are disclosed test adapter changes, not production stubs. Runners preserve
exact-parent negative controls while reading tested production from integration.
The independent oracle is byte-identical to the accepted preserved reviewer WIP.

42 candidate and 12 closure artifact seals verify. Every recorded submitted
matrix and repair input matches the tested integration Git blob. Source seals,
patch, commands, logs, initial harness failures, runner adaptations and original
backup verification are archived in the sibling `startup-accepted-integrate-20261021-evidence`
directory. Final external receipt/ref verification lives in
`scratch/runs/20261021-startup-accepted-integrate`.

## Limits and recovery

This remains compiled dependency-slice acceptance: identity addressing, seeded
classes, ret16 callback driving, and recorded graphics/cleanup boundaries.
No full build, VM, PE, game, browser, Worker scheduling, native Windows, runtime
box or deployment was used. The full ShellEx W test was ported but not executed
because it requires the full VM. Dialog return/message defects, nested creation
activation ownership and continuation liveness after record removal remain.
Native class failures, CBT reentrancy and actual DLGPROC remain unqualified.
Unsupported ShellEx flags, Unicode narrowing, incomplete associations/DDE/URLs,
async boot failure, invalid pointers and extreme overflow retain their prior limits.

For recovery, restore the archived evidence files into the run directory and
provide an isolated sparse checkout as its `repo/`, with the historical accepted
objects available. Run `python3 run-controls.py` there. From `repo/`, run the
original complete-path JS, the repair JS with REVIEW_REV set to the tested commit,
and `../runners/independent.js` with the same REVIEW_REV. Run validation with
`WINE_NAMED_EVENT_ENDPOINT='{"integrationFixture":true}' node ../runners/validation.js`.
The original reports document fixture boundaries. Retain external historical
artifacts separately; Git branches alone do not back up ignored run artifacts.

The shared checkout and supplied repositories' HEAD/index/config remain unchanged.
Disk admission reserves 64 MiB for this task plus 64 MiB for the census worker
above the mandatory 2,285,895,680-byte floor. Final receipt records actual usage.
The messageboard lists every changed producer for the census worker's subsequent
reconciliation. Main publication uses a fresh-ref check and ordinary fast-forward
push; a concurrent incompatible update must reject rather than overwrite it.
