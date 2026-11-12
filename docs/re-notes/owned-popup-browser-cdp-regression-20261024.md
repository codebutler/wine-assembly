# Owned popup browser Canvas2D regression (2026-10-24)

Adds an explicit installed-browser regression for the accepted compositor fix
on main `f42083c61a18d56fd739d3cd702c4d67d36784b7`. Production source and the
existing 85-check synthetic fixture are unchanged. This closes that fixture's
Canvas2D qualification gap; it does not replace its semantic coverage.

The browser evaluates the complete authentic `lib/surface.js` and
`lib/renderer.js` scripts, then the new browser-only fixture. Screen composition
uses production CanvasSurface; single/stack presentation uses native Canvas2D
save/restore, clipping and drawImage. The oracle reads actual RGBA pixels with
getImageData and retains small canvas PNGs. No RasterSurface adapter is involved.
Only geometry exports, window records, offscreen creation and guest non-client
painting are fixtures. The recorded non-child parent/owner link explicitly models
post-SetParent host state; this test does not execute SetParent or a guest.

Coverage includes popup children beyond the owner's bounds, exclusion from the
owner's child pass, nested ancestor/client clipping, empty intersections, sibling
clip restoration, GPU-kind bitmap client offsets in screen/single/stack paths,
and a multi-window stack with popup pixels beyond its owner. The GPU-kind layer
is a real Canvas2D bitmap, **not WebGL pixels**. No native GUI, full VM/module,
gameplay or guest lifecycle qualification is claimed.

## Results and identities

| Renderer/control | Passed | Failed | Exit |
| --- | ---: | ---: | ---: |
| Current main | 35 | 0 | 0 |
| Exact historical baseline | 18 | 17 | 1 |
| Candidate, zero GPU bitmap offset | 32 | 3 | 1 |
| Candidate, remove single-source child clip | 32 | 3 | 1 |

Baseline is `eb0c0a71c93c98bb2e394629e2c093bdcd4a9baf:lib/renderer.js`,
blob `ea371310c14bf39f070c3f23050dac9784700d45`, SHA-256
`3b7b3efb1dc48b73de6d24d0c01e10650b0cc84b0b8cd80df2b49baa3680b2b2`.
Candidate renderer SHA-256 is
`b1f6f1abbee443875e5d6d2cfcc67c4a077f89b522631749fe226b294cb9de03`.
Each mutation must match exactly one source site and records its executed hash.
The offset control fails the frame-preservation pixel in all three paths. The
clip control fails only the single-source ancestor/empty-clip pixels. Historical
baseline failures include popup children outside the owner and nested clipping;
they are pixel mismatches, not script errors. Harness errors use exit 2.

Executed with installed Node v24.18.1 and Chrome 151 (Linux), using built-in
WebSocket/fetch for local CDP. No Puppeteer dependency, packages or browser install.
The command deliberately lives outside automatic unit discovery: installed Chrome
and explicit browser admission are prerequisites, not general unit dependencies.

## Repeat and recover

Use fresh short output names under a task allocation (Chromium Unix sockets have
a path limit). The Linux Python supervisor admits fresh memory/disk, sets a
256 MiB Node old-space/browser JS heap, 60s wall/aggregate sampled CPU limits and
24 MiB per-file/profile bounds, and adopts/reaps detached browser helpers.
It sends TERM, then KILL after at most five seconds, and requires zero remaining
descendants. The browser retains its default sandbox; no security-disable flag
is passed. `--bw-timezone=Etc/UTC` prevents this installed fork's startup network
timezone probe. Profile, cache, crash config and temporary files stay in OUTPUT.

```sh
git show eb0c0a71c93c98bb2e394629e2c093bdcd4a9baf:lib/renderer.js > "$TASK/baseline.js"
python3 tools/test-owned-popup-browser-cdp.py "$TASK/c" "$PWD/lib/renderer.js"
python3 tools/test-owned-popup-browser-cdp.py "$TASK/b" "$TASK/baseline.js"
python3 tools/test-owned-popup-browser-cdp.py "$TASK/m1" "$PWD/lib/renderer.js" gpu-offset
python3 tools/test-owned-popup-browser-cdp.py "$TASK/m2" "$PWD/lib/renderer.js" single-clip
```

`TASK` must already exist, have a short absolute path and satisfy the supervisor's
52 MiB projection, including 8 MiB reserve, within the assigned 64 MiB allocation.
It requires fresh MemAvailable >= 2684354560 and host free after projection
>= 2982150144. The owner must also account external session/SQLite growth.

Retained ignored evidence: `/tmp/owned-popup-browser-cdp-regression-oct24`.
`test-receipts.json` summarizes every attempt; `c3`, `b`, `m1`, `m2` contain
pixels.json, ten bounded PNGs per run, browser/harness logs and cleanup/resource
receipts. `resource-ledger.json`, `temp-cleanup.json`, publication/final-resource
receipts and `evidence-seals.json` preserve accounting, identities and recovery.
All browser trees were serialized and reaped. Disposable profiles/temp were
measured before removal; PNGs, logs and receipts remain.

Preparation history is retained: first startup timed out during automatic
timezone probing; second hit Chromium's Unix socket path limit. UTC configuration
and short output paths corrected those harness issues. An initial sibling lacked
the mock geometry exports and failed one pixel; adding the same exports used by
the other windows corrected it. Corrected candidate passed twice. These were
fixture/startup errors, not resource denials or production renderer defects.
Initial oversized instruction/board capture is retained and conservatively
charged in the ledger; subsequent reads were bounded. Nothing was reset.

Strict SSH verified actual remote main before the private explicit sparse checkout.
The released donor's Git objects were accessed only through read-only alternates.
No shared root tracked files/index/refs, donor files, production renderer, DLLs,
caps, historical ledgers or other lanes were edited. Task branch publication only;
independent acceptance and integration remain coordinator-owned. No boxes assigned.
