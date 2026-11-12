# Army Men named-event startup timeout: observer preload ownership

The reproducible timeout is repaired by scoping the diagnostic CLI observer's
automatic installation to Node's main thread. The event authority itself was
not failing to make transport progress after startup: its worker never reached
startup. Node inherited `--require ./tools/army-bltfast-observer.js` and
`ARMY_BLTFAST_OUTPUT`; the worker attempted `openSync(output, 'wx')` on the file
already held by the main CLI and threw `EEXIST`. The authority's caller was
blocked in `Atomics.wait`, so its worker error listener could not expose that
error synchronously; the existing bounded receive correctly failed closed with
`ETIMEDOUT`. A direct worker probe on the assigned box captured the underlying
EEXIST stack at observer line138. Both preserved original 4,041-byte guest
logs are byte-identical and end at ole32 DllMain0xa47fcb/crashEIP0xa481b9.

## Candidate and scope

Base: exact main `30a2c3fb1b5c2bfa8a6b001d7394d5cf50df295d`.
Tested source commit: `6f26b8c35c6fd50b20f72b9f2c76f97e79e30f75`.
Branch: `task/army-authority-startup-repair-oct21`, pushed and exact remote ref
verified. Main remains the base, pending independent acceptance; no merge or
public deployment. Subsequent branch commits preserve the report/evidence only.

Only `tools/army-bltfast-observer.js` and its existing preload test changed.
The observer adds `require('node:worker_threads').isMainThread` to its opt-in
installation condition. This applies to all auxiliary workers, including both
authority server and client bridge, without special-casing an event role or
game address. Explicit `capture()` consumers are unchanged. Main-thread output
exclusivity, matching-map validation, single owning WASM instance, passive
capture, ABI/pixel acceptance and bounded output remain enforced. No transport,
timeout, reservation, lifetime, ThreadManager, guest, runner, or threading-route
changes. The existing no-threads cooperative route still creates real Node
workers for named-event transport.

Candidate SHA-256:

* observer: `caba605957f55f055e7d54d9d49bfbc77a3e3a3457f459ab14b9aca80ebbd9c7`
* preload test: `23d9e76e0647c47400d070cde1c6ed717f8dc65fc66e3b5cf5bc837bae5d866f`

## Tests and rejecting controls

The extended preload regression failed before the fix with authority-constructor
ETIMEDOUT and passes after. It uses actual authority/client worker transports
under both command-line `--require` and `NODE_OPTIONS`, checks auto-reset
consumption/last-close disappearance, and proves an auxiliary worker neither
wraps WebAssembly.instantiate nor creates its own capture file. It retains the
owning-main fixture, second-instance rejection, import restoration and output
report checks. Explicit controls reject an existing output path, foreign region
map and relative output path; the preexisting evidence bytes remain identical.

Passing focused suites:

* `tools/army-bltfast-preload.test.js`, `army-bltfast-observer.test.js`,
  `army-bltfast-captured-abi.test.js`, `jig-owning-api-observer.test.js`.
  The pixel/ABI suites reject missing/wrong return cleanup, missing sixth stack
  argument, failed HRESULT, bad pitch/bounds/backing, nested/interleaved calls,
  incorrect copies and foreign ownership.
* `test/test-named-event-authority.js`: real subprocess races, owned references,
  last-close/recreation, stale handles, SIGKILL cleanup, independent-authority
  rejection, authority loss and unresponsive peer poisoning.
* `test/test-named-event-wake-reservation.js`: eight groups including Set/Reset
  reservations, one-winner races, deadline/expiry, cancellation/reference close,
  EOF/shutdown, transport loss, per-session/global capacity and reclamation.
* `test/test-named-event-caller-deadline.js`: real peers, inbound/response/
  registration delay, late observation, boundary/scope, lost reply. Deliberate
  deadline extension, early expiry and unrelated-clock-domain mutations each
  reject with exit1; positive cases exit0.

The four observer suites also pass on the assigned runtime. The ordinary
callback ownership census passes there: **401 source boundaries unchanged**,
nonlocal APIs remain disabled/ownership pending. No census refresh, hash bypass,
review-gate modification or new canonical build claim.

## Actual same-route result

The candidate retained the original launch arguments, observer preload, original
EXE/cwd/VFS/registry, `--no-threads`, 200000-block quantum, 750-batch/90-second
bounds and input schedule. Only output destinations changed. The controller
adds a bounded SIGKILL fallback after its existing SIGTERM deadline; neither
deadline fired. Full command and environment construction are in controller.js
and run1/launch.json.

At 2026-10-21T11:13Z on Node24.18.1/libuv1.52.1, ole32 DllMain0xa47fcb
returned1, as did the other initializers. Original BootCamp.AMM loaded. Normal
click320,180 at batch279 reached the **Welcome to Bootcamp** pane. Enter down500/
up501 dismissed it. The inspected batch670 frame is unobscured terrain/Sarge/HUD;
Numpad6 down674/up706 precedes the inspected batch713 frame with changed terrain,
sign and Sarge positions. This is actual bounded original input/camera-response
evidence, not an inference from successful startup. Exit0, 750 batches,
3,518,482 API calls, 12.099s reported runner duration. These are workload counts,
not gameplay FPS. No audio, browser, full gameplay, native parity or general
compatibility qualification.

The unchanged observer reports accepted=true: eight completed original BltFast
calls, HRESULT0, nine samples each, sampled destination-post bytes matching
source-pre bytes, with no observer errors/ambiguity/pending calls. The main
owner remains pinned and imports restore on exit. The eight-call/24-raw-call
limits still apply. This establishes sampled copy behavior only; initial
corruption remains explicitly unknown and terrain-stripe causality is unresolved.

## Identity, artifacts and handoff

Unchanged canonical module from the prior all-gates exact-main build:
`728e1de80ec20a284fc41b339895ee8ac29f16e4ded83325b27576cfacd4466c`,
1,878,508 bytes. This JS-only observer change reuses that module with honest
provenance; no rebuild or fresh canonical qualification was performed. All
7,299 tracked source identities were checked before staging and after execution;
exactly the two candidate files differ. All419 originals and the resolved real
DLL bytes were reverified before/after; no packaging or support staging repeated.

Local run: `scratch/runs/20261021-army-authority-startup-repair`.
Remote evidence: `/home/user/army-current-main/authority-startup-repair-evidence`
and sibling `.tgz`. Source staging remains at `/home/user/army-current-main/repo`
(exact base plus the two sealed candidate files), VFS/support files unchanged.
Old evidence directories remain intact. `verify.py` checks22 remote artifact
seals, full source delta, original/support identities, two original failures,
underlying worker error, focused tests, guest exit/input and sampled-copy data.
The tracked report and evidence archive are under `docs/reviews/` on this branch.
No Army candidate exists in the exact-main corpus; this remains an investigation
receipt, with no result attached to an unrelated dashboard candidate.
The repository-wide evidence checker retains the pre-existing
20261002T042949Z-reflexive-zuma-deluxe-startup containment error and historical
missing/invalid records; none is this task's evidence. The task's offline
verification passes all22 remote seals.

Box `bx_e8a7pw8v` is left **RUNNING**, API state `idle`, health `ok`, expiry
`2026-10-21T12:21:46.313Z`. Post-run process capture shows no guest/controller.
Coordinator owns shutdown and receives ownership before12:10UTC. No stop,
resume, new box, SSH, agent, refill, root WIP, laptop HeroesII/WarcraftIII or
fleet changes. Local sparse checkout was projected before materialization;
task footprint remains below64MiB and free space above2,285,895,680+600MB.

Remaining acceptance: independent review/integration of this task branch.
Broader gameplay/FPS/audio/browser/stripe/native-parity claims remain unqualified.
