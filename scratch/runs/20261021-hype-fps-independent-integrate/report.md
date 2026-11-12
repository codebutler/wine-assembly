# Hype independent acceptance: bounded browser logical FPS

Accepted candidate `12e43047471843e8ae49a85844fae53c4184881f`, with prior
`56c92dc2abad4c2cbf1ca26ab0b85a5dfbde388f`, against tested and freshly verified
remote main `b88c818ba3a071877e889e7cc779975a193591ce`.
**188 callback entries / 10,708.679999999935 ms = 17.55585188837477 logical FPS.**
This closes the bounded HYPE-BROWSER-FPS measurement obligation. It is an
instrumented browser gameplay interval, not displayed FPS or game completion.

## Independent evidence and arithmetic

Read and ran both existing offline verifiers. Independently checked 75 candidate
seals, 38 recovered artifacts, 127 prior seals, all 78 candidate Git files,
129 files in the prior committed archive and 66 nested recovery files against
the existing recovered bytes. The committed archive SHA256 is
`72d1a4a261e81d0c0a9975cfaccdd45ac8680223e5c67dc34c0b20d18abcc6e5`;
its nested recovery archive is the separately reported `1cdc7f82…` archive.
No archive was extracted, copied or repackaged. The prior archive is integrated
by its existing Git blob, without materializing it in the sparse worktree.

Matched all 6,731 source-manifest entries to exact base Git object IDs/sizes.
Read-only SHA256/size checks independently matched all 59 original local assets
(38,067,871 bytes). Original EXE SHA256:
`635f394121e50001227b97741dbf304f0a88f819c6f2ba2378cf61d9fa2a6344`.
Its PE section mapping independently matches all 64 captured live callback
bytes at `0x43f610`. Six original instruction sequences install render callback
`0x43f180` at `0x5b228c` and finish callback `0x43f610` at `0x5b2290`.
Disassembly confirms world finalization/swap and the direct nested UI call
`0x43f678 -> 0x422260`. These static assignments are not a new live registration
trace. The historical 99 callbacks/196 swaps establishes context, not a factor
used to compute this interval; swaps cannot substitute for this counter.

The driver enumerates actual guest-worker URLs and observes all four counters.
Only slot 1 advanced during the probe (0 to 49). Creation record ID 3, init
slot 1 and initGuestThread tid 1 map to exported ID 2 through exact
`init_thread` source. Selection is based on positive counter delta, not a
hard-coded historical tid. Render-worker URL is excluded. Wrong slots 0/2/3
remain zero and are not gameplay-FPS evidence.

All 108 raw primary samples are retained and match the receipt exactly.
Endpoints are count 52 at 23570.215000000084 ms and count 240 at
34278.89500000002 ms. Adjacent deltas also sum to 188. Each count and timestamp
is read synchronously in the owning worker using its `performance.now()` and
stable timeOrigin `1792585612090.67`. No guest/batch/CPU clock or requested sleep
duration substitutes for elapsed time. Largest observed pairing read span is
0.010 ms. Delayed timer delivery is included in the measured interval.

Exact WAT has one counter increment and no reset writer. The decoder emits the
marker first at the selected block and prevents folds/uop loops swallowing it;
stale addresses do not count. Arming flushes the cache for the marker; pace 0
does not pace the callback. Stable original instance identity, live code and
enabled state are checked at every sample. Worker message monitoring covers
initialization, shutdown and mutating export messages throughout; actual
captured mutation events are empty, lifecycle records are unchanged, counts
are monotonic and all four prior address/pace settings were restored. The
generation string alone is a label, not independent reset detection. The
combined source/lifecycle/identity evidence supports reset-free coverage in
this session, not protection against arbitrary adversarial code mutation.

Independently regenerated all ten rejection checks: three live wrong owners,
the unchanged old 106 invalid samples, disabled state, changed generation,
count decrease, changed owner, changed clock domain and absent continuous
coverage. Six are synthetic contract mutations, not runtime fault injection.
The wrong-owner receipt deliberately removes qualification before validation;
its rejection is not proof that the validator discovered the wrong owner.
Two explicit limit controls confirm that falsely qualified wrong-owner zero
and nonexistent evidence paths can pass the validator. The validator does
not authenticate files or the emitting-owner flag. Acceptance rests on the
independent capture, source, binary, lifecycle and image review above.

## Images, build and scope

Personally viewed the actual `world-before-measure.png`, `during-up.png`,
`during-down.png` and `world-after-measure.png`. All show the knight in the
nighttime street. Up changes knight pose/scale and relative barrel/terrain
positions; Down changes them back; the final image remains gameplay. The
ordinary input log and executed driver agree (Enter 200 ms, Space 600 ms,
then Up/Down 600 ms each). No menu/reload input occurs inside the interval.
These snapshots support bounded gameplay/input progression; they are not a
continuous video proving every presented frame or exact movement distance.

Canonical native module SHA256:
`728e1de80ec20a284fc41b339895ee8ac29f16e4ded83325b27576cfacd4466c`,
1,878,508 bytes. Reused the sealed successful canonical build and exact
66-test observer/validator run; the test and validator bytes match base Git.
The archive initially lacked Git HEAD for the API-table baseline; the retained
exact-Git metadata repair and subsequent check exit 0 close that prerequisite.
No build, package, runtime or full test suite was repeated. Candidate pre/post
receipts agree on source, module, HEAD and all assets. Native module URL and
decoded size, tail-call support and live module agree. Module digest attribution
comes from sealed server-byte checks and the private served route, not a new
in-browser hash. Integration changes only evidence and documentation, so it
does not invalidate that production build.

Chrome 151.0.7922.108 / Node 24.18.1 / Linux x86_64, assigned 4 vCPU/8 GB,
real guest Workers, 1000x760 viewport. Live Glide endpoint is WebGL; CDP reports
ANGLE Vulkan 1.3 SwiftShader Device (Subzero), SwANGLE 5.0.0. This is
**software-rendered WebGL**. Hardware GPU, native software Glide, displayed
FPS, full-game completion, audio quality and Windows/rendering parity remain
unqualified. No public deployment.

Independent sample-cost sum is 5.290000000736 ms (median 0.045 ms, maximum
0.115 ms), 0.049399% of the interval. This measures sampler callback execution
only. The two screenshot operations cost 194.52 and 245.74 ms driver elapsed
time, already included. The subsequent stationary sparse interval's
187/10016.5 ms differs in input/screenshots and ordering; its higher rate is
not a causal overhead estimate. Marker/cache, scheduling, lifecycle hooks,
CDP and screenshot contention remain unisolated. No overhead correction or
uninstrumented-rate estimate is accepted.

## Integration and recovery

Only accepted candidate/prior reports, harness/evidence and narrow Hype status
updates are integrated. Base main contains no HYPE-BROWSER-FPS task row, so
the reviewed closed row is added rather than copying root WIP. Root WIP,
laptop, Heroes II, Warcraft III and fleet are untouched. Existing dashboard
checker exits 1 for historical Zuma containment/missing/invalid records; Hype
has no exact candidateId in the pinned manifest. No unrelated dashboard
candidate or fabricated result.json is published.

New review evidence: `scratch/runs/20261021-hype-fps-independent-integrate/`.
`offline.py`, `controls.js`, their outputs and callback disassembly preserve
reproduction. A first draft of the offline check wrongly compared the outer
archive with the nested archive and treated runtime callback slots as initialized
PE data; those check assumptions were corrected against actual archive members
and original MOV instruction sequences. No candidate defect was hidden or fixed.
Candidate `verify.js` remains unchanged. Review seals cover final outputs.
Publication receipt records the exact normal task/main pushes and verified refs.

Historical producer reports saying RUNNING describe the capture handoff only.
Coordinator owns box `bx_2ghgsv9d` lifecycle; its former expiry was
2026-10-21T14:01:16.889Z. The local authoritative receipt initially said pending;
its final update records snapshot-stop `stop_223af722c87d2f18` **completed at
12:36:32.756Z, error null** (requested 12:35:30.782Z). This coordinator receipt
supersedes the producer's RUNNING handoff. There is no assigned runnable slot.
No lifecycle/runtime/newbox,
resume or SSH action was made. The old denied SSH/resume routes were not retried;
successful earlier authorized API/file capture does not authorize future runtime.
