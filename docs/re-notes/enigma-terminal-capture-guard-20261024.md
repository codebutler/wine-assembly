# Enigma terminal capture rejection, 2026-10-24

The opt-in adapter makes the retained runner's batch-30000 `png` byte rejection
terminal before the next guest invocation or batch. It preserves the original
AssertionError object, writes a bounded terminal receipt, fsyncs its inode,
publishes it without overwriting an existing receipt, and fsyncs its directory.
Both the PNG catch and enclosing batch crash catch rethrow the latched object.
The actual final main error handler retains the object and sets exitCode=1.
No successful PNG is reported or written on this rejection.

This is offline propagation acceptance. No PNG from Enigma, startup/menu,
gameplay, build, native/WASM instantiation, browser, box, acquisition or public
deployment acceptance is claimed. No box is assigned; lifecycle remains with
the coordinator. The old diagnostic continued from the first PNG fault at
30000 to the unrelated regex fault at 44896. These tests do not replay it.

## Identity and composition

Base donor: `f879fd0cd81d918ea54a18b1b222fae25dd6d618`. Historical runner and
filesystem recovered read-only from Git
`d8cd8c54c8d63c107696f1e4ef7a1e229dcadc1e`; the former box's local runner path
does not exist on this host. The recovered runner is exactly 685960 bytes,
SHA256 `4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809`.
`inputs.json` records the exact filesystem, capture and supervisor identities.
Their full gzip snapshots and the standing pngjs manifest are adjacent.

The adapter accepts only that original runner or the exact accepted quiet-FS
transform (`343f7572511b0de8bf79f3a9415d68e4bc6577490cc3bf71f1e8c066623477fb`).
Preload order is terminal adapter, unchanged quiet-FS adapter, unchanged
capture.cjs, runner. Quiet-FS first is rejected. The filesystem itself is
unchanged. Capture.cjs retains dimensions, pixel equality, 131072 encoded-byte,
three-frame and 393216 cumulative-byte guards. The sole capture-source change
wraps its existing byte assertion and latches its actual thrown object.
There is no message-based interception or console suppression.

The hook is inactive unless `ENIGMA_TERMINAL_CAPTURE_INSTALL=1`.
Installation requires absolute canonical runner/capture paths and a fresh
receipt path, and refuses already-loaded runner/capture modules. Input hashes
and exact single-anchor counts fail closed. Existing receipt/pending files
must be retained; choose a fresh path for each authorized attempt.
Receipt I/O failure remains fatal, attaches `terminalReceiptError` to the
original denial, and is not durable-receipt acceptance. It never resumes work.

## Executed acceptance

Run from the task repository (Node heap256MiB, CPU/wall60):

```sh
timeout 60 bash -c 'ulimit -t 60; node --max-old-space-size=256 test/test-enigma-terminal-capture-guard.js'
```

The focused test extracts and executes the PNG branch, complete batch catch,
and final main rejection handler from the **actual transformed full source**.
It mocks renderer/guest interfaces and observes process control. It executes
the original transformed capture source against the real retained pngjs7 codec
and real file writes. The dependency is used read-only in place; its 23 files
and 63864 bytes are hash-verified against the original transfer manifest.
No codec implementation or copied catch logic is substituted.

A deterministic real noisy 256x256 PNG exceeds the unchanged encoded-byte
guard. The sentinel proves no guest work occurs in that batch or the next.
The original object escapes both catches; original name/code/message survive,
no image or successful log exists, and observed real I/O confirms the write,
inode fsync, exclusive publication and directory fsync order. A real small PNG
retains exact pixels and ordinary continuation. Disabled behavior retains the
historical swallowed PNG error. Unrelated renderer errors retain their
historical FAILED record; unrelated guest errors still take the failing crash
path. The test belongs to the default unit tier by the existing classifier;
no unnecessary central exception was added.

Seven rejecting mutations cover swallowed inner denial, outer crash
reclassification, early successful return, replacement error, dropped latch,
producer swallow and producer reclassification. Hash changes and every missing
or duplicated runner/capture/supervisor anchor reject. Missing inputs, stale
receipts, wrong preload order and invalid supervisor receipts reject.
The first local mutation trial exposed an ineffective test mutation: replacing
the inner error was correctly repaired by the outer latch. The retained failed
trial is in task ops history; the final mutation targets the outer boundary.

The hash-bound supervisor transform preserves the old limits and watchdog.
It checks the terminal receipt before each poll's other work, and checks again
after child exit so a fast failure is classified even if no poll observes it.
The test executes that actual transformed polling loop and finalization tail
with process control stubs. Both poll detection and natural-exit finalization
retain the raw rejection and reason `capture-byte-limit`; malformed, oversized
and reclassified receipts reject. No historical guest-mode supervisor was run.

## Recovery and future command

`raw-terminal-receipt.json` is a byte copy from the passing composed test.
`test-final.json`, `identity.json`, `source-transforms.diff`, compressed original
inputs, and `next-command.json` retain the test, exact code/input identities,
complete injection diff, and executable argv/environment recipe.
Regenerate transformations with the published helper at its eventual location:

```js
const a = require('./tools/enigma-terminal-capture-guard.cjs');
const fs = require('node:fs');
fs.writeFileSync('/fresh/task/supervise.py',
  a.transformSupervisor(fs.readFileSync('/retained/original/supervise.py','utf8')),
  {flag:'wx'});
```

`next-command.json` prepends the adapter to the retained historical argv and
adds its explicit environment. This is a recovery recipe, not authorization
to run a guest. A coordinator must restore and verify the named inputs,
allocate runtime/expiry, revalidate the actual mount argv with the canonical
parser, and supply a fresh admitted supervisor configuration. The preserved
historical supervisor has an expired start cutoff and old box labels; this
offline patch deliberately does not manufacture a fresh runtime allocation.
Keep the adapter first, the original guard limits, and a unique receipt path.

Resource receipts in task `ops/` retain full external session/events, positive
SQLite growth, future allowances and 8MiB reserve within 64MiB, host-free and
memory admission, failed test history and final cleanup/publication receipts.
Root tracked/index/refs, donors and original inputs remain read-only. Only the
task branch is published; no main integration is authorized.
