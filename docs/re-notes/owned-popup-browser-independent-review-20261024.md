# Independent browser regression review (2026-10-24)

Accepted producer `facd6f56c1b4bdc80688ee3bd258f123becded56`, based on
remote main `f42083c61a18d56fd739d3cd702c4d67d36784b7`. Reviewed all four
added fixture, CDP harness, supervisor and report files. Production renderer,
CanvasSurface and the existing 85-check fixture are unchanged; existing exact
source semantic results are reused. This review adds only this note.

The oracle compares hard-coded RGBA colors at chosen coordinates using real
Canvas2D getImageData. It does not compute expectations through the renderer's
geometry or clipping helpers. Production methods perform composition and
CanvasSurface performs screen blits/clips. Geometry exports, window records,
offscreen creation and non-client painting are fixtures. Checks independently
distinguish an owned popup from a child, exercise nested parent/client clipping,
empty intersections, sibling clip restoration, client-offset bitmap layers in
screen/single/stack paths, and actual multi-window stack composition. Sparse
pixel probes are a regression oracle, not exhaustive image equivalence.

Independently rehashed all 109 producer evidence seals. Inspected raw checks,
source/executed hashes, cleanup receipts and actual candidate/baseline,
GPU-offset and single-clip PNG pairs. Retrieved the exact historical renderer
from its named Git object and reproduced both unique-site text mutations in
memory; all four executed hashes match their raw receipts. Baseline has 18
passing and 17 failing pixels, candidate 35 passing, and each mutation 32
passing/3 failing. Each rejection is a named RGBA mismatch with exit 1;
cleanup failure is null and descendant lists are empty. These are not startup
or compilation failures. Full scripts execute before the fixture; CDP runtime
exceptions use the separate harness-error path.

Fresh independent execution passed admission (MemAvailable 3,517,644,800 bytes
at supervisor launch) and ran once with the exact candidate source:

```sh
cd /tmp/owned-popup-browser-independent-integrate-oct24/repo
python3 tools/test-owned-popup-browser-cdp.py \
  /tmp/owned-popup-browser-independent-integrate-oct24/c "$PWD/lib/renderer.js"
```

Result: **35 PASS, 0 FAIL**, exit 0, 2.236 seconds, no supervisor failure,
all 13 observed descendants reaped. Independently inspected its multi-stack
PNG. The prior exact-source baseline and rejecting controls are reused rather
than launching three redundant browser trees. Node old-space is 256 MiB;
supervisor wall/aggregate sampled CPU limits are 60 seconds, with TERM then
KILL cleanup. No packages, build, public server or security-disable flags.
The renderer-security sampling map was empty in the retained final candidate
and independent run: default sandbox launch flags are preserved, but these
receipts do not independently attest renderer seccomp state. CPU accounting
is sampled, as stated in the producer note, not exact exited-process accounting.

Scope: synthetic geometry and Canvas2D GPU-kind bitmap; no native GUI, WebGL,
SetParent execution, guest, VM/module build or gameplay qualification. This
closes a specific Canvas2D regression gap and complements the unchanged
semantic fixture. No boxes were assigned or operated; coordinator lifecycle
ownership remains unchanged.

Ignored recovery evidence is retained at
`/tmp/owned-popup-browser-independent-integrate-oct24`: admission and fresh
browser admission, source-binding, sealed-evidence-review, `c/pixels.json`,
ten PNGs, harness/Chrome logs and `c/cleanup-resource.json`, plus publication,
resource/cleanup and seal receipts. Producer evidence remains read-only at
`/tmp/owned-popup-browser-cdp-regression-oct24`; its committed report contains
the baseline and mutation recovery commands. Regenerate only after fresh
memory/disk admission using a new short output path. No ignored artifact is
claimed to be preserved by Git. Review task branch and main publication are
verified by strict SSH actual refs under the coordinator integration lock.
