# Maelstrom event-triggered main boundary observer — 2026-10-24

`tools/maelstrom-event-boundary-observer.cjs` adds a separate, opt-in offline
transform for the exact historical runner. It replaces the six fixed-batch
samples for this new mode. The accepted `maelstrom-head-yield-observer.cjs` and
its suites remain byte-identical. Base: `4ba28bf1d8b0644f237e8a4f29f54241446b1bcd`.
The diagnostic `6edba85a587c34b77a3573b938002a7426a77b2f` is a read-only reference;
its evidence was not merged into this branch.

The original capture remains inconclusive: the observed EIP was reconstructed
as WSOCK32.select thunk 2079, reason 8 is net_wait, and entry counts 972/972
cannot prove MOV/CALL execution. This implementation makes no gamefix and does
not claim to explain the original zero result.

The transform wraps main exports once, immediately after the runner's existing
instantiation. A copied export descriptor set substitutes only `run`; an instance
proxy exposes that same export facade to the runner, loader and ThreadManager.
This avoids Proxy invariants on immutable WASM exports. It observes actual calls
from all three direct runner sites and the scheduler's `target.run(1000000)`.
Each original call is invoked once with its original arguments and return/throw
identity. The existing call sites, catches, scheduler callbacks, yield handling,
breakpoints, guest diagnostics, input, clock and batch pacing are unchanged.
The transform does not add a run, clear a yield or arm a breakpoint.

Before/after state is observed at actual main invocation boundaries. Records
trigger once per event: head `0x7a3362`, interior `0x7a3366`, and reason 8 at a
thunk whose actual metadata API id is 934 (the pinned API table's select).
A missing metadata export at the historically reconstructed select address
produces an explicitly **unverified** address-based event. A conflicting actual
API id does not trigger select. Reason 1 does not trigger net_wait.
An event already present before invocation gets a before record and an after
record; an event first reached by that invocation gets an after record containing
both snapshots. Batch is informational, including null for calls before the
outer loop. No historical batch index controls observation.

Records contain EIP/EDI/EAX/EBP/ESP, reason/flag, halt, breakpoint readback, raw
head/interior entry counts, cache stores/clears/invalidations, cached tick count,
actual thunk metadata and six stack words (return plus five select arguments).
Only validated select metadata permits following the fd_set/timeval pointers.
Each fd_set includes its count and at most two socket values, with truncation
explicit; a count above 64 is rejected. Timeval contains two raw 32-bit words.
Missing exports/fields are `unavailable`; null pointers are `NULL`; rejected spans
are `out-of-range`. The pinned exports have no select deadline getter, so that
field is always `unavailable`.

Memory observation is deliberately limited to the pinned g2w direct window and
the actual memory buffer bounds, rejecting the whole span before decoding.
It uses the exported image base and frozen ABI spans GUEST_BASE `0x12000` and
DIRECT_WINDOW end `0x08000000`. Sparse/DIB pointers are rejected. It never calls
guest_read or guest_to_wasm: source inspection found g2w slow/miss paths can
materialize GPU data, invoke SEH and write the sentinel. Retained source witnesses
and full-file identities are in the sibling evidence directory.

Output stops at **16 records / 8192 bytes**, counting prefix and newline. Reaching
either cap stops observation without stopping execution; a summary is best effort
inside the same caps. A sink failure disables this observer without replacing a
guest return/exception. No stream, existing diagnostic or external output/file
guard is replaced. No API completion is inferred: `apiCompletion=unobserved` and
`apiResult=unattributed`. A matching preexisting blocking reason and halt 4 is
classified as the pre-dispatch guard; counts remain entries, never execution.

Coverage is main **invocation boundaries**, including scheduler-internal calls.
A head visited and left wholly inside one call remains unobserved. Existing
caller-selected breakpoints may expose such arrivals; this mode does not add one.
Independent WASM worker threads and watch configurations are explicitly rejected.
Observer overhead and native/runtime equivalence have not been measured.

For an already staged historical runner tree, generate a new adjacent runner:

```sh
node tools/maelstrom-event-boundary-observer.cjs --enable \
  /OWNED/runner/test/run.js /OWNED/13-exports.wat \
  /OWNED/runner/lib/thread-manager.js /OWNED/runner/test/run-events.js
```

`--disabled` writes byte-identical source. Outputs use exclusive creation and
must be new and adjacent; the input is never overwritten. This command only
transforms JavaScript. Any later runtime needs a separately authorized assignment.
Enabled runtime configuration requires explicit `--no-build --wasm=...` and
`--count=7a3362,7a3366`, with no `--threads` or watch flags. Generation validates
runner/exports/scheduler digests. Runtime rechecks the installed scheduler before
guest allocation and hashes the runner's already-read module bytes against the
historical module identity before compilation. This task never read or loaded
that module. Existing trace/breakpoint settings remain caller-owned.

Run the executable offline suites with the pinned source files:

```sh
node --max-old-space-size=256 test/test-maelstrom-event-boundary-observer.cjs \
  /OWNED/run.js /OWNED/13-exports.wat /OWNED/thread-manager.js
node --max-old-space-size=256 test/test-maelstrom-head-yield-observer.js \
  /OWNED/run.js /OWNED/13-exports.wat
```

Reconstruct those three files with narrow `git show REV:PATH` from the identities
in `inputs.json`; no checkout/build/module is needed for these tests. Each command
ran under the retained supervisor: Node heap 256 MiB, CPU/wall 60 s, aggregate
output 131072 bytes, per-file 24 MiB, process-group TERM/KILL within 5 s and reap.

PASS: transformed production setup plus the three retained runner call sites,
the actual pinned `_dispatchCooperativeSend` method under controlled inputs,
head at shifted batches, preexisting/arriving net_wait, metadata and arguments,
reason1/neighbor rejection, unavailable/bounded reads, record/byte caps, callback
delivery once, return/exception identity and disabled identity. Six rejecting
mutants detect missing scheduler wrapping, extra runs, yield clearing, wrong
reason, unsafe read bounds and count-as-execution classification. The sample
controlled sequence fits in 7 records / 4862 bytes. The accepted observer suite
and syntax checks pass. These are offline controls, **not native or gameplay
qualification**; no guest, box, build, acquisition, worker or main integration
was performed. Coordinator retains runtime lifecycle ownership.
