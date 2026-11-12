# Real-browser D3D9 clear regression: memory-blocked

The assigned base is accepted main `36ca14d2806bd839a7918f99f1d844d5cb9fc8c3`.
Its donor and actual remote main/task refs matched before checkout. This task adds
an isolated real-WebGL pixel harness, but **does not close pixel acceptance**.
The single fresh browser admission at 2026-10-24T08:03:37Z measured
MemAvailable **2413625344 bytes**, below the required **2684354560**. The
supervisor exited 2 before starting Node/CDP or Chrome. No browser retry occurred.
The actual denial and cleanup receipt is
[`evidence/d3d9-clear-real-webgl-20261024/browser-denied.json`](evidence/d3d9-clear-real-webgl-20261024/browser-denied.json).

## Harness and intended discrimination

`test/fixtures/d3d9-clear-real-pixels.js` creates actual production `Device` and
`WebGLBackend` instances, real WebGL2 contexts, color textures/framebuffers and
D16/D24S8 renderbuffers. Production `RenderClear` descriptor construction,
structured cloning, Device attachment binding, target initialization and clears
are retained. Independent direct GLSL triangles and RGBA readPixels observe the
stored depth and stencil. No GL method or allocation is mocked. No guest fixture
or host COM path executes; this is a focused Device/wrapper closure.

The planned observations cover normalized .25 followed by the wrapper's default
1 and the positional adapter's default 1; nondefault cached .25/52 followed by
fresh implicit/named initialization and repeated requests; existing identity
switches; D16 and D24S8 precision; all 16 channel masks; top-left clipped color,
depth and stencil rectangles; absent depth rejection; zero flags/empty regions;
and color, depth and stencil retention using later tested draws. Capability or
allocation errors fail the candidate; no passing skip exists.

`tools/d3d9-clear-real-cdp.js` uses installed Chrome and Node built-in WebSocket
and fetch, with loopback CDP on about:blank. It loads exact production source
bytes without a package or local web server. Four sequential source variants
share one browser tree: current candidate; exact producer `ffe822a9` Device with
current GPU; exact intermediate `77180c76` GPU with current Device; and a current
Device mutation dropping rectangle restrictions. These are explicitly hybrid
blob controls, not whole historical builds. Acceptance requires candidate pixels
passing and each control failing its specified pixel assertion without harness
errors. Compact numeric mismatches, source hashes, runtime GL identity/extensions
and small PNGs would be emitted before the summary. None were emitted in this
task because browser admission was denied.

`tools/test-d3d9-clear-real-browser.py` is the sole resource supervisor. It checks
fresh memory, task-owned allocated disk bytes plus full external session/events,
positive SQLite growth, future allowance and 8 MiB reserve. It starts one child
session, bounds wall and aggregate sampled CPU at 60 seconds, retains the
256 MiB Node heap and 24 MiB file bound, and cleans the entire process group and
adopted/detached descendants with TERM followed by KILL after at most 5 seconds,
then reaps. Chromium's ordinary sandbox remains enabled. The startup gate and
syntax checks executed; browser-tree cleanup and pixel behavior remain untested.

## Results and qualification

JavaScript syntax checks and Python syntax parsing passed. Exact candidate and
historical source identities are recorded in `source-identities.json`. Existing
independent oracles were not changed or rerun. Accepted offline results remain
in `d3d9-fresh-cache-independent-20261024.md`.

Candidate, producer, intermediate and rectangle-rejecting **pixel outcomes are
all UNEXECUTED**. Runtime browser version, GL version, renderer, extensions,
hardware/software driver identity and PNGs are unavailable. There is no real-GL,
hardware, full-module, guest or gameplay qualification, and no production defect
was established. The sole blocker is the measured browser-memory gate. The
coordinator owns any future capacity change and reassignment; this worker stopped
browser work on its first denial.

Artifacts were retained before task `result.json` was written last under
`evidence/d3d9-clear-real-webgl-20261024/`. This subsystem has no assigned corpus
candidate ID, so the task evidence remains with this investigation note and is
not linked to an unrelated game/dashboard capture. No image was produced to
inspect. The denial receipt was inspected; reviewed task metadata never means
reviewed pixels.

## Recovery and ownership

Private checkout `/tmp/d3d9-clear-real-webgl-pixels-oct24/repo`, branch
`task/d3d9-clear-real-webgl-pixels-oct24`. Recover the committed harness and note
by fetching that task branch. Its base ancestry supplies both historical blob
controls. Checkout used `git init`, read-only alternates, explicit non-cone paths,
and `GIT_NO_LAZY_FETCH=1`; donors and root tracked files/index/refs were untouched.
All Git remote operations use the assigned dedicated identity and known-hosts
file with BatchMode, IdentitiesOnly and StrictHostKeyChecking; no trust edits.
Initial missing evidence-helper path and alternate-depth diagnostics were
corrected within this task and charged to cumulative capture, with no reset.

After an actual capacity change, a coordinator-assigned follow-up can prepare a
fresh accounting JSON naming `allocation`, complete `external` session/event
paths, `sqliteBaseline`, `sqliteDirectory` and `future` bytes, then use:

```sh
python3 tools/test-d3d9-clear-real-browser.py FRESH_SHORT_OUTPUT ACCOUNTING_JSON
```

OUTPUT must be a fresh direct child of allocation, with an absolute pathname at
most 58 bytes for Chrome sockets. Use the retained accounting.json as a recipe;
remeasure all required budgets for the new task. This task's exact command and
external accounting are preserved under its private root. No installs, downloads,
compiler/full build, deployment, main merge, guest mount or box operations occur.
Box ID/state/expiry are N/A; lifecycle ownership remains with the coordinator.
