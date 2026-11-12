# D3D9 draw-layout provenance observer

Source-only diagnostic for BW2-DRAW-LAYOUT-PROVENANCE-20261018. It does not
repair a layout, select a producer, or classify the missing October 9 evidence.
No guest/browser run or module/source placement validation has been performed.

## Node harness adapter (source-only)

`tools/d3d9-layout-capture.js` supplies the concrete adapters; it is not enabled
by `test/run.js` or a browser flag. Its tests execute the real
`GuestRpc.createMainBroker().serveRpc` and `D3D9Host.Bridge.call`, with synthetic
shared memory and a pre-existing inert device entry. They reach the actual
layout loads and FVF rejection without instantiating WAT or a renderer:

```
node --test tools/d3d9-layout-capture.test.js tools/d3d9-layout-observer.test.js
```

Harness placement, once separately authorized for a live run:

1. Call `Capture.identity({moduleBytes, repository, runId})` with the exact byte
   buffer passed to module compilation. It hashes those bytes and reads the
   checkout HEAD and dirty status with Git. This records actual inputs; it does
   not certify that an existing module was built from that commit. Retain the
   matching build receipt and generated region map. A dirty checkout requires
   a separately retained source manifest/diff before any source attribution.
2. Construct `Capture.create({identity, getMemory, getExports, capacity})` on
   the host. The memory getter returns the current buffer; the exports getter
   supplies the consuming instance. The adapter requires `guest_to_wasm`, checks
   both ends of every guest word, and rejects the NULL sentinel or a split word.
   DX lookup uses the checked device slot and current generated `DX_OBJECTS`
   base/size, type 20 and misc1. There is no affine address fallback.
3. Call `capture.attachHost(ctx.d3d9Bridge)` before any guest execution. It
   preserves an existing callback, hooks the exact production read and wraps
   host entry. On the broker use its existing per-slot table factory:
   `slot => capture.brokerTable(tableFor(slot), slot)`. This creates a table
   view without modifying the original. The real request slot is scoped only
   during the synchronous import; nested calls and exceptions restore it.
   An optional third argument is a getter for an independently known actual
   guest thread ID. Without that getter the ID is null, not slot+1 or the
   consuming main instance's ID. Unscoped direct host calls have null thread.
4. On each issuing Worker construct its own capture adapter, then call
   `capture.installWorker(imports, apiTable, getExports, actualSlot)` after the
   final overrides and before instantiation. The late exports getter reads
   `get_current_thread_id()` from that executing instance. The harness still
   owns enabling/restoring API logging on each instance and transporting the
   bounded snapshots out of each Worker. This adapter does not add a Worker
   control message or silently change API logging.
5. Save `capture.snapshot()` before evidence metadata; call `capture.dispose()`
   during cleanup and inspect its restoration results. A later callback owner
   is preserved and reported as a restoration conflict.

The current D3D9 broker path publishes `{t:'rpc', slot}` with its control-block
arguments. There is **no shared request ID** exposed at draw issue and host
consumption. All capture correlation fields therefore remain null; the report
explicitly sets `crossBoundaryPairingQualified` and
`producerAttributionQualified` to false. A slot identifies an origin, not a
unique call. The exact host samples and per-instance order remain useful, but
must not be joined by sequence number, timestamp, pointer or slot as proof of
a producer. Adding a real shared request token is a separate protocol change.

Live validation still needs the module/build/source receipt, per-Worker import
placement/logging and snapshot transport checks, and an authorized run. The
Boat was reported stopped with snapshot verification at
2026-10-15T19:22:25.445Z; the prior scoped resume returned HTTP 403 and remains
unresolved. This source checkpoint does not retry or bypass it. No October 9
raw evidence has been recovered or reconstructed.

`node --test tools/d3d9-layout-observer.test.js` runs only synthetic JS tests.
The production-hook test executes the exact read/validation prefix extracted
from `lib/d3d9-host.js`; it is not a compiled WAT or browser integration test.

## Opt-in placement contract

Load `tools/d3d9-layout-observer.js` explicitly (CommonJS or browser global
`D3D9LayoutObserver`). Nothing imports or installs it by default. Construct one
recorder **per guest Worker**, plus a host recorder. Supply:

- `getMemory(): ArrayBuffer | SharedArrayBuffer`, current linear memory buffer.
- `g2w(guest): number`, the current instance's real sparse-aware translator.
  Do not substitute direct-window arithmetic or return the NULL sentinel as a
  valid mapping. Invalid/unmapped reads must throw; errors are counted.
- `resolveProgram(device): number`, the current guest program pointer. Resolve
  device+4 to its DX slot, validate it against the current DX region size, then
  require `DxObject.type == 20` and read `DxObject.misc1` at relative offset 20.
  DX entries have stride 32. Obtain the region base from the matching generated
  region map, not a copied allocation address. Return 0 for an invalid device.
- `getThread(): {slot, id}`, the actual Worker slot and instance's
  `get_current_thread_id()` value. Host code must obtain the originating thread
  from the active broker request; use null if unavailable, never main-thread ID.
- `identity`: caller-owned source commit, module SHA256, run ID and placement.
  Missing identity stays null; synthetic tests use `synthetic-only`.
- `capacity`: 4..4096 records, default 128.

After all other import overrides, before instantiation, call
`observer.installAPI(imports, apiTable, getExports)` and
`observer.installGPU(imports, 'gpu_gl_call', 'draw-issue', getCorrelation)`.
The API adapter extends the existing `log_i32` COM ordinal marker, `log`, and
`log_api_exit` tracing boundaries, resolving full method names via api_table.
The caller must enable and later restore API logging on **each instance**;
`--quiet-api` may otherwise remove the events. The observer deliberately does
not call `set_api_log` or change guest state. Import wrappers installed after
WASM instantiation cannot retroactively replace its captured functions.

On the consuming host instance, explicitly set the D3D9Host option
`onLayoutRead: values => hostObserver.hostRead(values, getCorrelation())` and
call `hostObserver.installGPU(d3d9Host, 'call', 'host-entry', getCorrelation)`.
Preserve/restore an existing option callback if installing into a live host;
prefer construction-time options and disposing the host with the run. The
hook runs immediately after the two real layout loads and passes their actual
values, program WA and descriptor WA without rereading layout. Its optional
callback is protected separately from production validation. Disabled cost is
one option branch; no object, log or memory snapshot is allocated when absent.

`getCorrelation()` must return a bounded caller-provided broker request ID
shared by issue and host scopes; default null explicitly means **uncorrelated**.
No new RPC field or synchronization is introduced here. A usable live packet
requires the harness to wire that ID and originating-thread context, pin the
module/source, and validate placement under a separate runtime grant. Separate
recorders' sequence numbers are local orders, not a global cross-thread order.

## Retention and interpretation

Identity is defensively copied at construction; thread, correlation, arguments,
and event fields are copied when recorded. Later caller mutations cannot rewrite
retained or frozen evidence. Each copied value is limited to 256 nodes, depth 8,
32 keys per object/32 array entries and 4096 total key/string characters. Only
finite numbers, strings, booleans, null, plain objects and dense arrays are
accepted. Accessors are rejected without invocation; cycles, oversized values
and unsupported types are observation errors, not silently truncated identities.

`observer.snapshot()` returns detached JSON-safe records. API entry/exit pairs
use entry sequence IDs. Captures/Apply resolve the device from block+8; Reset
resolves the program again on exit. Live VS/declaration/FVF and active recording
block mask/declaration/FVF are distinct fields. Descriptor snapshots retain all
16 words at draw issue and host entry. The exact host-read event contains the
values read by validation; its program is a **WASM address**, whereas
`state.program` and `descriptorState.program` are **guest pointers**.

The ring retains only the most recent capacity records, freezing at the first
synchronous draw rejection (-1) or thrown draw exception. A freeze does not
cancel a draw, pause the guest, or modify the exception. It may omit enclosing
API/issue exits after the host rejection. It does not infer that every rejected
draw failed layout validation. An async Promise is returned unchanged and
labelled asynchronous, not interpreted as success or rejection. Layout rejection
in the inspected host occurs synchronously before enqueueing.

Except for the exact consumer values, memory snapshots are non-atomic samples;
a racing guest thread can mutate between individual reads. No snapshot proves
thread exclusion. `host-entry` must never be relabelled `host-read`. The observer
never derives a current observation from old pointer values or missing files.

Selected API argument retention is capped at 16 words. The import adapter's
nesting stack is capped at 64 frames; deeper calls are omitted until unwound.
Aborted/unbalanced API logging invalidates later entry/exit pairing; end that
run and reinstall for a fresh run, rather than treating partial pairs as proof.
Unmapped reads or adapter exceptions increment `observerErrors` and cannot
replace original function results or exceptions. Any nonzero `observerErrors`
sets `pairingDisqualified: true`: that packet must not be used as producer or
entry/exit pairing evidence, even if some records appear intact. A false flag
only means no observer error was recorded; it does not certify placement,
correlation, thread identity or complete API logging. No source logs are emitted.

Always call `observer.dispose()` in harness cleanup. It restores own property
descriptors (or removes inherited-method shadows), unless another owner has
subsequently replaced a wrapper; the returned false then reports the conflict.
Remove/restore the host option callback separately. Save snapshots before
publishing any evidence metadata. This checkpoint has no current B&W2 producer
samples and licenses no renderer fallback or visual-causality claim.
