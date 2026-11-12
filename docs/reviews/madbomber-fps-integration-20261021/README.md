# Mad Bomber logical browser FPS: independent acceptance

Accepted candidate `30f86aa7f2ebd36a99418412edeeb7da5fd943a9` against fresh
origin/main `f09e09c6643997986bbafad69c37adae4906df90` on 2026-10-21.
The accepted claim is **94 logical gameplay entries in one 4.438655-second
instrumented interval (21.1775864536 logical FPS)**. It is not sustained or
display FPS, uninstrumented/native hardware performance, audio quality,
full-game completion, or Windows parity. Canvas2D rendered the game in a
software ANGLE/SwiftShader environment; the toolbar WebGL selector is not
renderer evidence.

## Independent reasoning

Read the full report, capture harness, validator, original loop disassembly,
counter/decoder/compiler source and diagnostics. The original outer loop at
403d01 calls SDL_GetTicks then increments 40fd40; SDL_PollEvent is an inner
loop. Movement, active bomb updates and drawing occur before the tick/delay
backedge at 4057bc. Counting that entry measures logical iterations, not SDL
rectangle updates. Initialization and fire reset the guest frame variable;
they do not reset the instrumentation counter. The independently decoded
analysis image matches all 6,848 live loop bytes. That comparison validates
the analysis decoder for this range; it does not claim whole-image decoding
correctness. The original executable remains the normal launched artifact.

The exact source has one logical-count writer, incrementing an instance-local
i32 initialized to zero; the setter does not reset it. Pace zero leaves the
existing pacing behavior in place and never calls the marker's pacing path.
Address changes request a cache flush. Decoder boundary/poison rules and the
micro-op exclusion preserve the marker. Flush and subsequent instrumentation
effects preclude an uninstrumented rate claim. No wrap is present (53 to 147).

Registry threads:false and the live inventory agree: no guest Worker; main
equals threadManager.mainInstance, exported ID 1; cooperative handle 921600
has exported ID 2. Both counters are enabled, but only main emits. The short
9-sample probe, positive-owner uniqueness assertion, live wrong-owner rejection
and six mutations execute before primary sampling. The main instance and
cooperative membership remain stable, with no recorded setter/lifecycle events.
These wrappers are observational evidence, not protection from arbitrary
unobserved code; source inspection supplies the reset/lifetime argument.

All 46 primary samples have increasing finite performance.now timestamps,
paired reads within 0.015 ms, stable clock origin/owner identity, address
403d01, pace/paced zero, running/active state, unchanged loop bytes and zero
cooperative count. Independently recomputed 147−53 over 4438.655 ms.
Guest frame 27→121 corroborates the same 94 entries, with offset 26 throughout.
Sampling occurs on the cooperative page event loop, so guest execution cannot
interleave those synchronous reads. It is still a sampled measurement, not
continuous proof of every scene state.

Personally inspected all four PNGs: One Player menu, active bombs and score 0,
score 1 with splash, then score 3 with buckets moved left. Enter and Space
precede the interval; only mouse movements occur inside it. Before/during/after
snapshot times bracket the measurement as reported. Screenshot capture is
asynchronous and these images corroborate gameplay rather than timestamping
each logical frame.

Actual Chrome response capture hashes the response body (not merely a disk
path): 1,878,508 bytes, SHA256
728e1de80ec20a284fc41b339895ee8ac29f16e4ded83325b27576cfacd4466c,
with matching HTTP 200 network record. Canonical build exit 0 and unchanged
route/build inputs are reused; no build or runtime replay was needed.
Eight preserved source files independently match exact main Git blobs.
Page errors are empty. Four optional 404s and four aborted requests remain
visible in diagnostics; three aborted DLL requests have successful responses
elsewhere in the network log. They do not establish audio quality.

## Checks and limits

Reused verifier PASS: 76 seals, 24 recovery files, 6,909 staged and 7,299
canonical source identities, 168 assets, 2,407 dependencies, 6,848 live bytes,
seven premeasurement controls, restoration and cleanup. Independently matched
80 candidate evidence files to Git blobs. New check.js adds 11 rejection
controls for timestamp/count validity, pacing, instance/code changes,
owner membership, stopped gameplay and missing owner.

Two deliberate adversarial copies demonstrate validator limits: a uniformly
wrong thread ID, or a second emitting owner, can pass validate() alone. This
is not a blocker for this capture: the harness authenticates unique ownership
before the interval and the independent check requires exact inventory IDs
and zero cooperative counts at every sample. Do not reuse validate() alone
as an authentication gate for another run.

Sampling costs total 24.925 ms (0.56154%); the in-interval screenshot costs
234.872 ms of driver time. Neither is subtracted. This is not a causal
overhead estimate: marker/cache, timer, logging, CDP and screenshot effects
remain included. No stronger performance conclusion is accepted.

## Integration and recovery

Select only the candidate report and its 80 evidence files, plus this review
and offline results. Shared evidence is read in place; Git index selection
avoids another materialized copy. No production source, root TODOS/STATUS,
shared configuration, originals, archives or unrelated WIP is changed.
Pre-materialization projection was 9,356 existing bytes plus 2 MiB review
reserve (<16 MiB); fresh free space 3,360,788,480 exceeded admission
2,982,150,144. Total task allocation remains below 64 MiB.

The coordinator's finalized receipt
scratch/usage-watch/madbomber-fps-stop-status-oct21.json records
bx_ppatp9cq snapshot-stop stop_6fb32456ee965834 completed
2026-10-21T17:41:49.464Z, error null; historical expiry was 19:28:40.555Z.
This supersedes the producer's RUNNING handoff. No runtime/lifecycle call
was made here; ownership remains with the coordinator.

Run `node docs/reviews/madbomber-fps-integration-20261021/check.js REPO_ROOT`
against the preserved candidate evidence, then its verify.js. Review outputs
are in scratch/runs/20261021-madbomber-fps-independent-integrate; publication
receipt and append-only messageboard record final exact refs. Candidate
RECOVERY.md remains the original recovery recipe and carries no new runtime
authorization.
