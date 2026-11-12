# Hype: authenticated browser logical gameplay FPS

**PASS: 188 logical callback entries in 10,708.68 ms = 17.5558518884 FPS.**
The unchanged accepted validator exits 0 (`validation.json`, `validator-cli-exit.json`).
This is one observed wall-clock gameplay interval, not displayed FPS or a
statistical confidence interval. One bounded browser session was used; no second
session, rebuild, packaging, production source change, validator change or merge.

## Owner authentication and capture correction

The old selector confused exported thread ID 1 with internal tid 1. The new
capture driver enumerates **all four live guest workers**, authenticates the
64 live bytes at guest `0x43f610`, enables the existing logical counter with
pace 0, and observes counter changes before choosing an owner. Render workers
are excluded by their actual URL. The emitting slot is not hard-coded.

`evidence/session1/owner-probes.json` records slot 1 advancing 0→49 over
2,588.21 ms; slots 0, 2 and 3 did not advance. Captured live Worker creation,
`init` and `initGuestThread` messages tie the selected instance to slot 1,
internal tid 1, exported ID 2, and
`http://127.0.0.1:8080/lib/guest-worker.js?v=dev`.
`authenticated-owner.json` retains that chain and the actual callback code.
The exact source's `init_thread` assigns exported ID = internal tid + 1.
The existing logical marker counts entries to this callback on this instance;
the historical 99 callback/196 swap observation is not used in this calculation.

The primary measurement has 108 genuine paired counter/`performance.now()`
samples in one stable worker clock domain. Each reads enabled address, pace,
instance identity, exported ID and live callback bytes. Full-interval worker
mutation listeners and creation/termination records show no counter-setting,
reinitialization or ownership changes. The exact WAT has one count increment
site and no reset writer; a replacement instance would fail identity checks.
Counts remain monotonic. All prior address/pace settings were restored after
capture (`restore-slot*.json`), and all sampling timers/listeners were removed.

The same session sampled the wrong owners as controls. Slot 0 had 109 samples
with count 0 while slot 1 advanced by 188; slots 2 and 3 also stayed at 0.
The capture authentication rejects each non-emitting owner before it can be
labelled a logical-game-frame receipt. Their unqualified receipts are rejected
by the unchanged validator with `fps: null`. The validator alone checks a
supplied contract; it does not authenticate owners or files. No zero gameplay
FPS claim follows from these controls. The old 106 invalid samples and rejected
receipt are preserved separately in `rejected-prior/`, unchanged.

`controls.json` records ten passing rejection checks: three live wrong owners,
prior invalid evidence, disabled state, changed reset epoch, count decrease,
changed owner, changed clock domain and absent continuous coverage.

## Gameplay and environment

Ordinary Enter (200 ms) selects New Game; Space (600 ms) passes instructions.
During the measured interval ArrowUp and ArrowDown are each held for 600 ms.
Personally inspected `world-before-measure.png`, `during-up.png`,
`during-down.png` and `world-after-measure.png`: the knight remains in the
nighttime street, movement/pose and relative barrel/terrain positions respond
to input, and the final image remains in gameplay. No menu, reload or other
input intervenes. These are bounded gameplay/input observations, not full-game
completion, audio or rendering-parity qualification.

Exact source/build base: `b88c818ba3a071877e889e7cc779975a193591ce`.
Prior evidence: `56c92dc2abad4c2cbf1ca26ab0b85a5dfbde388f`.
Canonical native module (1,878,508 bytes):
`728e1de80ec20a284fc41b339895ee8ac29f16e4ded83325b27576cfacd4466c`.
Original EXE:
`635f394121e50001227b97741dbf304f0a88f819c6f2ba2378cf61d9fa2a6344`.

Before and after the session, 6,731 staged Git blob identities and all 59
original assets matched, as did HEAD and the canonical module. The prior
canonical build, callback census and 66 observer/validator tests are reused,
not rerun. No assets or source archive were copied locally. Browser resource
timing records the native module URL and exact decoded size; tail calls and a
live module are present. Module hash attribution uses the observed private
artifact route plus pre/post server bytes, not a fabricated in-browser digest.

Chrome 151.0.7922.108, Node 24.18.1, Linux x86_64, assigned 4 vCPU/8 GB box,
real guest Workers, viewport 1000×760. Live Glide endpoint uses WebGL.
CDP reports ANGLE Vulkan 1.3 SwiftShader Device (Subzero), SwANGLE 5.0.0:
**software-rendered WebGL**, not hardware GPU or the native software Glide
backend. Only `127.0.0.1:8080` was served; no public deployment or route.

## Instrumentation overhead

The selected owner's 108 sample callbacks took 5.29 ms total: median
0.045 ms, maximum 0.115 ms, approximately 0.0494% of the measured interval.
The largest count/time pairing read span was 0.010 ms. Across all four workers,
sample callbacks accumulated 21.78 ms (overlapping intervals; not an elapsed
time correction). The two in-interval screenshot operations took 194.52 and
245.74 ms of driver elapsed time. Gameplay continued during those operations;
their elapsed time is included, not subtracted.

A subsequent stationary 1,000 ms sampling interval in the same browser recorded
187 callbacks/10,016.5 ms (18.6692/s), 11 samples, 0.525 ms total sampling cost,
median 0.040 ms. This contextualizes sampled callback costs only: it differs in
input and screenshot work and is sequential, so the rate difference is not a
causal overhead estimate. Logical marker/cache effects, timer scheduling,
lifecycle-hook cost, CDP and screenshot CPU contention are not isolated. The
reported 17.5559 FPS is the actual instrumented interval; no overhead-corrected
or uninstrumented performance claim is made. Full data: `overhead.json`.

## Evidence, validation and handoff

Session `cmd_iey3xavknvtb`, process 33276, started 12:26:48.193Z and exited 0
at 12:27:36.802Z; errors are empty. `capture.js` is the executed capture-only
driver; `preflight.js`, `recover.js` and `finalize.js` preserve the recipes.
Recovery downloaded individual hashed files, no new or duplicate archives.
`recovery-manifest.json` seals 38 remote artifacts (3,441,668 bytes).
`SHA256SUMS.json` seals the final local bundle; `verify.js` verifies recovery,
seals, exact validator identity and acceptance/rejection results offline.

The pinned dashboard checker exits 1 for the pre-existing Zuma containment
failure and historical records (`dashboard-check.json`). Hype has no exact
candidateId in the pinned manifest; these remain investigation artifacts, not
a dashboard result attached to an unrelated candidate.

**bx_2ghgsv9d is left RUNNING**, API state idle, health ok; expiry
2026-10-21T14:01:16.889Z. Evidence recovered before 12:28 UTC, well before
13:40. Postflight shows no task browser/server or port 8080 listener. Source,
build and originals remain at `/home/user/hype-browser-fps/repo`; remote new
evidence is `/home/user/hype-browser-fps/counter-owner`.
Coordinator owns shutdown. No stop/delete/resume/snapshot, replacement box,
agents, SSH, main merge, root WIP, laptop/Heroes II/Warcraft III or fleet work.
The publication receipt records the exact pushed task commit and remote ref.
