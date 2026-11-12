# D3D9 explicit clear contract — 2026-10-24

Base: `f6571101e38985b3fa34d328f2ccadd9735a7573`. Task branch:
`task/d3d9-explicit-clear-contract-oct24`. No main integration in this task.

`D3D9_CLEAR1` now carries the color, flags, normalized depth, stencil value,
channel mask, explicit top-left origin, target extent, attachment metadata and
clipped rectangles as a recursively frozen snapshot. The host publishes it for
initialization, ColorFill and Clear. The synchronous GPU host, GPU endpoint and
software command executor pass the descriptor intact to their backend adapter.
Adapters validate the descriptor again after transport, including canonical
rectangles, attachment presence and extent. Unknown versions/origins and invalid
flags are errors. Queue copying and structured cloning retain the distinction
between default depth (`undefined`) and explicitly absent depth (`null`).

The guest Clear ABI, viewport/scissor intersection, and D3D9 all-channel clearing
remain intact. The producer owns guest pointer/count/range validation; the helper
owns clear-value validation and rectangle clipping. Empty intersections remain
no-ops. Positional `Device.clear` callers retain their argument order, default
attachments and rejection of out-of-range rectangles. Their zero-area rectangles
remain legal no-ops. The software executor retains native depth quantization,
RGB565 packing and stencil operations; the GPU adapter retains target binding,
top-left to GL scissor conversion and XRGB alpha handling.

The current source differs from the historical S2 proposal: D24S8 stencil clears
already exist. This change preserves them, including low-eight-bit stencil
storage, and rejects stencil requests without the admitted D24S8 attachment.
It does not introduce a stencil success stub. Raw W-clear normalization remains
in the existing API adapter; normalized values are never reciprocally encoded
by this helper. GL and Glide command producers are not migrated. The shared
worker's Glide and legacy D3DIM loader lists gain only the dependency needed by
their existing D3D9 device classes. No capabilities, default backend, shader
lowering, POSITIONT implementation, game registry or WAT source changes occur.

One observable defect is fixed: the software neutral CLEAR consumer previously
discarded `colorMask` while unpacking positional arguments. GPU CLEAR now also
honors the descriptor mask. Ordinary public D3D9 Clear descriptors explicitly
use mask 15, independent of draw render-state masks.

## Regression and evidence

`test/test-d3d9-clear-contract.js` is automatically a **unit** test under the
existing `tools/test-tiers.js` convention; the suite asserts that membership.
It uses the actual host memory-descriptor producer, CommandQueue, synchronous
host consumer, GPU endpoint and software `Device.execute`/clear implementation.
The software device has fixed test allocations instead of unrelated device
heap/program initialization. Five exact production WAT functions implement the
actual color stores, masked stores, stencil stores, depth quantization and
memory-range checks. No JavaScript pixel executor substitutes for these clears.

The excerpt is 5,257 source bytes, a 755-byte module and one 64 KiB memory page:

- Source SHA-256: `4cae063bfb82249f7f09f85fe41a8b65ded473a787bb359492ef88ce605a61a4`.
- Module SHA-256: `61cf1906c68d4cd76ca8a3c3ad7c76aad06bed2728e105cee5943adc085c8b4b`.
- Extraction function names, source positions, exact sizes and hashes, and the
  five compiler-file hashes/Git blobs are in
  `test/support/d3d9-clear-excerpt-pins.json`.

The checked fixture starts BGRA pixels at `[11,22,33,44]`. A clipped red/blue
clear must produce `[64,22,255,44]`, preserve pixels outside the rectangle and
the other color attachment, and write only the selected depth attachment using
the independent expected D16 value `f32(16384/65535)`. Baseline production
software returns `[64,128,255,191]`: it overwrites disabled green and alpha.
The baseline is loaded from the exact base Git objects, with the same fixture
and native functions; the candidate passes without changing expected pixels.

Seven semantic rejecting controls alter flags, color attachment, rectangle,
mask, depth attachment, depth value and queue order. Each must fail the
independent pixel/depth observations. Additional checks cover malformed
descriptors, absent-depth legality, stencil failures, top-left scissor issuance,
named targets, all-channel public Clear, empty clipping, no-op flags/rectangles,
raw16/65535 values, post-publication guest mutations and queued owner mutations.
The draw-clear-draw ordering checks use DRAW observation markers with the actual
queue; **draw rasterization is not tested**. GPU tests check exact calls and
values against strict mocks; **no actual browser, GL driver or GPU pixel
acceptance is claimed**. Lower-left descriptors are rejected by this D3D9 slice.

Candidate suite plus existing browser dependency order, neutral command stream,
shared render-worker dispatcher, D3D9 worker protocol, synchronous software
Present and presentation cadence suites pass. Changed JavaScript syntax and
`git diff --check` pass. Browser fixture changes only insert the helper into
script lists; existing pixel oracles are untouched. No full-source emulator
compilation, guest execution, browser, box operation or deployment was performed.

Reproduce the bounded native check in this sparse checkout using the already
installed, read-only compiler whose files match the base exactly:

```sh
ulimit -t 60
WINE_CLEAR_COMPILER=/tmp/legacy-texture-disable-independent-integrate-oct24/repo/tools/watx.js \
  timeout 60s node --max-old-space-size=256 test/test-d3d9-clear-contract.js
```

Add `WINE_CLEAR_BASELINE=1` for the expected baseline pixel failure. In a complete
checkout, the default compiler path is `tools/watx.js`; the suite checks the
recorded compiler hashes before compiling the excerpt. The host root's parser
does not match the base, so that compiler path was not used for acceptance.
Initial fixture preparation failures (module wrapper syntax and two missing
sparse fixture dependencies) were corrected; their logs remain in the task's
external evidence directory. No native expected pixels were relaxed.

Committed receipts/logs are beside this report in
`evidence/d3d9-explicit-clear-contract-20261024/`. Full admission, test invocation,
compiler mismatch, capture-accounting, final resource and publication receipts
remain under `/tmp/d3d9-explicit-clear-contract-oct24/`. The private checkout uses
read-only Git alternates; recover it from the verified remote task branch rather
than copying its alternate object stores. No archives or binaries were staged.
No box was assigned; lifecycle ownership remains with the coordinator.
