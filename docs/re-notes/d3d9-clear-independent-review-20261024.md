# Independent D3D9 immutable clear review — REJECT

Reviewed candidate `ffe822a9d50ad79439330609915eb84475acd2bc` against
`f6571101e38985b3fa34d328f2ccadd9735a7573`. Remote main was reconciled by
strict SSH before checkout and again before publication; it still equalled the
base. Candidate has not landed. This branch contains review/tests only; no
production repair or main integration is authorized here.

## Blocking finding: normalized GPU clear depth is overwritten

`lib/d3d9-backend.js:334` calls `gl.clearDepth(depth)`, then line 340 calls
`g.clear(color, mask)` without a depth argument. The actual
`WebGLBackend.clear` in `lib/gpu-backend.js:614` defaults that missing argument
to 1 and updates its state cache before `gl.clear(mask)`. On a fresh cache,
a descriptor requesting depth 0.25 therefore clears to **1**, not 0.25.
The direct GL call also bypasses the wrapper's cache: after this first clear
the cache says 1, so a following request for 0.5 happens to survive because
the wrapper skips its redundant write of 1. Correctness depends on cache
history. The retained observation is:

```json
{"writes":[0.25,1,0.5],"clears":[{"mask":4,"depth":1},{"mask":4,"depth":0.5}]}
```

This defect **predates the candidate**: loading the exact base D3D9 adapter
with the unchanged GPU wrapper produces the identical failure. It is not a
new regression caused by descriptor extraction. It still blocks accepting
an end-to-end normalized clear contract. Producer GPU assertions replace
`g.clear` with an event recorder, so they verify the intermediate direct
`gl.clearDepth(.25)` but never execute the wrapper that overwrites it.

`test/test-d3d9-clear-independent-review.js --probe` is the minimal failing
regression. It uses the real candidate `Device.clearCommand`, real
`WebGLBackend.clear`, and real `_setState`, capability, depth-mask and scissor
methods, with an explicit mock of the GL boundary. It records the depth
**at gl.clear**, rather than only counting clearDepth calls. Target allocation
is stubbed; constructors and drivers are not exercised. `--probe --baseline`
loads the exact base adapter using `git show` and calls its public positional
API. Both exit 1 on the same expected-depth assertion. The default test mode
also checks these failures occur for the precise semantic reason, providing
a retained rejecting baseline control. It does not make the regression pass
by weakening expected depth or repairing production.

## Reviewed scope and other evidence

Inspected the actual production diff: new `render-clear.js`; host initialization,
ColorFill and Clear publication; synchronous host, GPU endpoint and software
dispatch; both positional adapters; index, guest-worker and shared worker
dependency lists. Browser fixture changes insert the helper before the backend;
the changed dependency test includes it. No WAT production changes occur.

The host keeps guest count/pointer/range checks and intersects viewport,
scissor, named target bounds and rectangles before publication. The helper
copies/freezes canonical rectangles and attachment metadata. Consumer validation
checks descriptor kind/origin, extents, flags, identities and normalized values;
backend resource maps separately reject unknown or changed identities.
Undefined default depth survives queue copying and structured cloning; explicit
null rejects requested depth. Positional order/defaults and out-of-range rectangle
rejection remain represented. Empty intersections and zero-area positional
rectangles become empty regions. Flags zero have no pixel writes, although GPU
binding/mask state can still change. D24S8 low-byte stencil, XRGB alpha handling
and channel selection remain in their backend adapters. Draw setup reapplies
color/depth/stencil masks and scissor state; no driver restoration acceptance is
inferred from this source inspection.

The independent default test additionally checks clipping to `[1,1,3,3]`, frozen
nested rectangles, clone revalidation, malformed width/origin/rectangles/flags,
invalid color identity, undersized depth extents, absent depth rejection and
legacy out-of-range/empty rectangle behavior. The producer suite was rerun once
after compiler admission and passed its native masked pixels, outside-clip and
other-attachment pixels, depth quantization, stencil, host/queue and mock-GPU
checks. Its seven rejecting controls and six existing cheap suite receipts are
reused as supporting evidence, not counted as independent acceptance. All 42
producer implementation/evidence seals were independently rehashed unchanged.

## Commands and results

All Node runs used `ulimit -t 60`, `timeout 60s` and
`node --max-old-space-size=256` with fresh MemAvailable above 805306368 bytes.

```sh
WINE_CLEAR_COMPILER=/tmp/legacy-texture-disable-independent-integrate-oct24/repo/tools/watx.js \
  timeout 60s node --max-old-space-size=256 test/test-d3d9-clear-contract.js
timeout 60s node --max-old-space-size=256 test/test-d3d9-clear-independent-review.js
timeout 60s node --max-old-space-size=256 test/test-d3d9-clear-independent-review.js --probe
timeout 60s node --max-old-space-size=256 test/test-d3d9-clear-independent-review.js --probe --baseline
```

Results respectively: exit **0, 0, 1, 1**. The last two are intentionally
failing expected-behavior regressions. Individual independent runs took less
than 0.1 seconds. One initial test-fixture error attempted to assign the
read-only renderHeight getter; it was removed without changing the oracle.
Its full log remains in the external task directory.

Before compilation, independent hashing bound all five installed compiler files
to their full SHA-256 and actual candidate Git blobs. Exact balanced-function
extraction checked names, order, line positions, byte counts and hashes against
`test/support/d3d9-clear-excerpt-pins.json`. The 5257-byte source SHA-256 was
`4cae063bfb82249f7f09f85fe41a8b65ded473a787bb359492ef88ce605a61a4`;
the produced 755-byte module SHA-256 was
`61cf1906c68d4cd76ca8a3c3ad7c76aad06bed2728e105cee5943adc085c8b4b`.
This was five functions with one 64 KiB page, **not full canonical/module
acceptance**. DRAW observation markers are not raster draws. Both GPU tests
are strict mocks, **not real GL-driver acceptance**. No browser, guest, full
emulator build, installed compiler copy, box operation or deployment occurred.
No box was assigned; all lifecycle ownership remains with the coordinator.

Committed receipts/logs are in
`evidence/d3d9-clear-independent-review-20261024/`. Admission, history accounting,
publication, cleanup and the initial fixture failure remain under
`/tmp/d3d9-clear-independent-accept-oct24/`. Recovery: fetch the verified task
branch with strict SSH into an explicit sparse checkout; alternates are read-only
standing inputs, not a remote backup. Coordinator owns the follow-up and shared
integration decision. This worker stops after publishing this scoped rejection.
