# Independent acceptance of D3D9 oracle and supervisor corrections

Accepted the scoped harness corrections at
`517aa38662e9ab83ba1759ad3f8e6a777a887415`, after reviewing their exact diff
against `a518fdba38985cafc52beddf76e7d6845fa97019`. This acceptance covers
the source assembly, classification, observation design and Linux supervisor.
It does not accept GL pixels or establish a production rendering defect.
The parent harness and its relevant reports/evidence are included as dependencies.
No production library file changes are part of this integration.

The classifier derives acceptance from individual observations rather than summary
totals. All four variants must complete the same unique name/kind inventory;
capability/validation must pass and errors must be empty. Each control must fail
a pixel observation assigned to that specific control. Twelve rejecting controls
passed, including an old-rule false acceptance with a failed renderbuffer check.
The candidate's real check results cannot be overridden by a spoofed failed total.

The retention fixture now seeds storage directly through GL, outside RenderClear,
Device.clearCommand and wrapper.clear. Review confirms that the changed GL clear
values, write masks (including separate front/back stencil masks) and scissor
enable are restored in finally. No wrapper cache is changed by the seed. Color
reseeding can leave stored depth/stencil untouched. These observations are source
review and syntax results; their execution on GL remains pending.

Source assembly matched all recorded production/historical bytes, the rectangle
mutation was exactly one replacement, and five successive factory evaluations
created distinct constructors in one VM realm. Dependencies are snapshotted and
evaluated per variant. Producer/intermediate are explicitly hybrid blob controls,
not full historical builds.

Fresh owned-process tests reproduced the old supervisor's TERM leak of both an
ordinary child and a detached descendant. The test explicitly killed and reaped
those leaks. The fixed repeated-TERM case killed/reaped both with KILL sent after
4.508 seconds; exit 7 survived unchanged, graceful child TERM was unblocked,
reaped-child CPU changed from 1 to 21 ticks, and one allocated SQLite byte was
charged as 4096 bytes rather than 1. The host floor check retains the exact
2982150144-byte floor and subtracts future allowance and reserve from current free.

An additional independent test targets the transition between real Popen creation
and return to supervise. Removing only the transition signal mask is a rejecting
mutation: SIGINT reaches the handler before the child handle is assigned and
leaks both fixture processes. The test controller explicitly kills/reaps these
owned leaks. Unmodified SIGINT and TERM transition cases both kill/reap ordinary
and detached children in under five seconds. A nested three-process real-CPU
fixture reports 0.356031 seconds for a 0.3-second leaf workload plus interpreter
overhead, discriminating omitted or multiply counted inherited CPU. See fresh
[transition evidence](evidence/d3d9-oracle-fixes-independent-integrate-20261024/transition.json).
No broad process signaling is used. No browser admission is invoked by these tests.

Commands (fresh output and accounting must be supplied):

```
node --max-old-space-size=256 tools/test-d3d9-real-oracle-offline.js
python3 tools/test-d3d9-real-supervisor-offline.py FRESH_OUTPUT ACCOUNTING_JSON
python3 tools/test-d3d9-supervisor-transition-offline.py FRESH_OUTPUT ACCOUNTING_JSON
```

Six JS/Python syntax checks also pass. Executed source hashes, fresh command
receipts, initial resource projection, actual positive allocated SQLite growth,
and full source identities are retained in the adjacent evidence directory.
All execution uses cheap-memory admission >=805306368, CPU/wall 60 seconds,
Node heap 256 MiB, per-file <=25165824, and the 64 MiB complete allocation
including external full history/events, future growth and 8 MiB reserve.
Installed tools and immutable donor inputs are separately identified standing
read-only inputs; no tool is copied or installed. Directory blocks are charged.
The initial projection was 50331648/67108864, leaving host free above the floor.

Candidate, producer hybrid, intermediate hybrid and rectangle mutation pixel
outcomes are all **UNEXECUTED**. This worker did not attempt browser admission,
poll memory for a browser retry, launch Chrome, use mock GL as pixel evidence,
build, mount a guest, use a box, deploy, or repair production rendering. The last
real browser gate remains **2357481472 < 2684354560**, at 08:21:46Z on 2026-10-24.
Only a separately assigned future task after actual capacity recovery may attempt
the browser; it must pass fresh complete admission with the unchanged threshold.
Renderer, extensions, PNGs, GL behavior, hardware, full module, COM and gameplay
acceptance are unavailable. Box ID/state/expiry are N/A; coordinator owns lifecycle.

Ownership: `/tmp/d3d9-oracle-fixes-independent-integrate-oct24/repo`, branch
`task/d3d9-oracle-fixes-independent-integrate-oct24`. Integration uses a merge with
current remote main as first parent and the reviewed donor as second parent so
the baseline/historical objects required by the tests remain in ancestry. Its
tree includes only reviewed harness/fixture/tests and relevant reports/evidence.
Final tests run on that exact integration source tree before publication. Actual
integration SHA and verified task/main remote refs are recorded in the append-only
repository messageboard and task-root publication receipt after the push.
Root tracked/index/refs and donors remain read-only. Shared integration alone is
serialized with `scratch/usage-watch/shared-integration.lock`. Recover source from
the task branch; full session history and raw process fixtures remain outside Git
under the task allocation and external paths declared by its accounting receipt.
