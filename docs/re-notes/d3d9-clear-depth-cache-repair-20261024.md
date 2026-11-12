# D3D9 clear depth/cache repair

Repairs producer `ffe822a9d50ad79439330609915eb84475acd2bc`, retaining its
complete candidate and independent reviewer
`c1bfc2c696e8b88749a3b8ab04f935b5e52d7cb1` as ancestors. Exact remote main
`f6571101e38985b3fa34d328f2ccadd9735a7573` was reconciled over the dedicated
strict trusted SSH configuration before changes. This is a private task branch;
there is no main integration or deployment in this assignment.

The adapter previously wrote `gl.clearDepth(.25)` directly and then called
`WebGLBackend.clear(color, mask)`. Its missing third argument defaults to 1,
so the wrapper overwrote the first requested .25 and cached 1. Subsequent
results depended on cache history. `Device.clearCommand` now passes the
normalized depth through the existing wrapper API and removes the direct GL
write. Stencil values likewise go through the wrapper's existing fourth
argument, retaining the low-byte conversion and write mask. This keeps both
clear-value caches consistent when another frontend interleaves wrapper calls.
There is no new cache or wrapper API change. Channel-mask handling stays in
the adapter; non-depth clears retain the wrapper's existing default of 1.

The independent probe body, setup and expected depths are byte-exact from
the reviewer. Only its outer orchestration changes: repaired candidate must
pass; exact baseline must fail for the original normalized-depth assertion.
`evidence/d3d9-clear-depth-cache-repair-20261024/independent-before.js.txt`,
`independent-outer.diff` and `probe-integrity.json` preserve before/after evidence.
The observed repaired writes are `[.25,.5]`, with actual `gl.clear` depths
`[.25,.5]`. Exact baseline still writes `[.25,1,.5]` and clears at `[1,.5]`.
No software expected depth was changed. Producer mock expectations now assert
the forwarded wrapper arguments rather than a direct GL call.

`test/test-d3d9-clear-depth-cache.js` executes the actual Device adapter and
WebGLBackend methods with a mocked GL boundary and stubbed allocation. It checks
first .25, next .5, repeated values, return to .25, interleaved wrapper changes,
cache contents and redundant-write suppression, positional/descriptor defaults,
absent depth, named targets, combined/color/stencil-only clears, all sixteen
channel masks, zero flags and empty regions. Public wrapper explicit/default
depth remains covered. Its reverting mutation loads the exact original producer
adapter and must reject the first .25 at `gl.clear`; the raw rejecting log is
retained. Target allocation, constructors and a driver are outside this fixture.

All final checks pass: independent default and unchanged probe; focused cache
suite with rejecting mutation; producer clear-contract suite with seven semantic
rejecting controls; GPU wrapper, shipped dependency order, neutral queue,
shared worker, synchronous presentation, D3D9 worker and presentation cadence.
Baseline `--probe --baseline` and reverted-adapter checks exit 1 as required;
the assertions identify the original depth mismatch. One dependency-order run
failed because a browser-loaded file was absent from the explicit sparse
checkout. Adding that exact fixture input resolved it without a source change;
its original failure remains in tests.json and the log.

Every Node check uses fresh MemAvailable >=805306368 bytes, oldspace 256 MiB,
CPU limit 60 seconds and wall timeout 60 seconds. Before the producer suite,
the compiler checkpoint independently matched five full installed compiler
hashes and candidate Git blobs, plus exact function names/order/start/end lines,
byte counts and hashes. Only the five-function, 5257-byte WAT excerpt was
compiled (source SHA256
`4cae063bfb82249f7f09f85fe41a8b65ded473a787bb359492ef88ce605a61a4`),
producing the same 755-byte module SHA256
`61cf1906c68d4cd76ca8a3c3ad7c76aad06bed2728e105cee5943adc085c8b4b`.
This uses one 64 KiB memory page. No full/default/native emulator compilation,
browser, guest, GPU driver or raster-draw acceptance is claimed. Existing
producer software pixels and DRAW markers retain their original limited scope.

Recovery: fetch `task/d3d9-clear-trusted-ssh-depth-repair-oct24` with the existing
strict SSH identity/known-hosts configuration into a new explicit sparse checkout.
The private checkout is `/tmp/d3d9-clear-trusted-ssh-depth-repair-oct24/repo`.
Admission, focused manifest, Git warning history, publication and final resource
receipts remain in its parent directory. The predecessor's blocked receipt and
launcher/session history remain separate and charged; no history was reset.
Readonly donor alternates are standing inputs, not a remote backup. Git reports
pre-existing deep alternate nesting warnings; all required exact objects and
tests were available, and no donor was modified or repacked.

The 56388608-byte projection includes checkout/Git, evidence/temporary data,
external session/events/log history, positive SQLite growth, future growth and
8388608-byte reserve within 67108864 bytes; final measured receipts also check
per-file/capture limits and the 2982150144-byte host-free floor. No archive,
installed executable or compiler was copied. Root tracked files/index/refs and
donors remain read-only; only the append-only root board was written. No box
was assigned or operated; box ID/state/expiry are N/A and lifecycle ownership
remains with the coordinator. Independent acceptance and integration belong to
the coordinator after this worker publishes and stops.
