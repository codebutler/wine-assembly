# Maelstrom bounded select lifecycle observer — 2026-10-24

Offline implementation based on candidate `164ec9fe3e42d5d1fdf21fdefae1e52588a4cc16`
(accepted main `8fe3b51b94f59a17e3af58e08e0cb87cdbb4165a`). No main integration,
compilation, WebAssembly instantiation, native acceptance, guest, download,
deployment, worker launch or box operation occurred. Claude remained idle.

## Behavior and use

`tools/maelstrom-select-lifecycle-observer.cjs` is an optional companion to the
unchanged accepted event observer. Its `transform(source)` is disabled by default
and returns the identical source. `createObserver(emit)` is likewise disabled;
its `wrapInstance` returns the identical instance without reading exports or
memory. The disabled CLI does not read its unused export/scheduler arguments.

The enabled CLI has the accepted tool's static transform shape:

```sh
node tools/maelstrom-select-lifecycle-observer.cjs --enable-lifecycle \
  OWNED_RUN_JS PINNED_EXPORTS_WAT PINNED_THREAD_MANAGER_JS NEW_ADJACENT_RUN_JS
```

This only writes runner source; it does not execute it. Never write into the
readonly donors. Use `--disabled` for a byte-identical output. The JS API accepts
`transform(source, {enabled:true, exportsSource, schedulerSource, lifecycle:{...}})`.
Existing runner, exports, scheduler, module and configuration pins remain active.
The enabled setup validates lifecycle configuration before the instantiate site.

Default lifecycle window: batches 36164–36180 inclusive, at most 512 invocation
pairs, one summary of at most 4096 bytes. Allowed caps are 1–4096 invocation pairs,
3072–8192 output bytes, and a batch endpoint difference of at most 4096. Unknown
options and invalid limits reject before guest access. Each snapshot reads a
fixed number of getters, two thunk words, and at most six stack words through a
fully checked direct-memory span. No fd-set traversal, setters, `clear_yield`,
`vlan_pump`, `g2w`, guest-read exports or extra `run` calls are introduced.

There is no per-invocation output or retained sequence. The summary stores fixed
counters plus first/last/arrival points and one identity. `windowInvocation` counts
only observed invocations within this window, not the accepted runner's global
invocation number. `parkedSnapshots` counts snapshots, not handler executions.
Retry pairs require the same original thunk, metadata, ESP and six-word stack,
reason 0 before, reason 8 after, and a non-guard halt after. A reason-8 pair ending
at halt 4 is separately counted as a pending guard; it is not a handler retry.
Other uncleared parked pairs are counted without claiming execution. Tick
comparisons distinguish advancing, equal, backward and unavailable samples.
They compare the cached exported `tick_count`, which select does not update;
they do not sample the actual `host_get_ticks` values used by select. Equal
cached ticks can coexist with advancing host time. Neither clock freeze nor
expiration follows: host tick at select and the select deadline are unavailable.

The first qualified reason-8 snapshot anchors the original call only. A window
starting already parked explicitly leaves onset unobserved. Tracking closes
after the first unmatched transition, so another call cannot inherit its retries.
Unrelated net waits and unknown/callback-shaped transitions have separate counts.
After cap, finish or outside the window, this companion performs no guest reads.
Finish emits once; a sink failure cannot replace a guest return or exception.
When composed, the accepted observer retains its independent 16-record/8192-byte
budget; combined output is at most 17 records/16384 bytes (12288 default bytes).
This does not claim a runtime overhead measurement.

## Evidence and interpretation

The exact retained events file is committed as
`test/fixtures/maelstrom-select-arrival-20261024.json` (SHA-256
`0a176485a70ed9e4a7a896f8b8e5fa276eff806e5000b564557888e18c820560`).
Replay retains the actual guest register values and stack words, while rebasing
synthetic linear backing to avoid allocating a guest arena. The real record is
arrival after batch 36164, global invocation 104910, EIP `0x679753` → `0x75040f8`,
reason 8, thunk `[0x80000012,934]`, stack return `0x7a3362`, timeval `[1,0]`.
Its EAX `0x53000001` is not an attributed result. Deduplication explains why
absence of later records cannot establish a parked stall. The final 972/972
counters do not establish execution. No original runtime was reproduced.

Pinned `handle_select` advances ESP by 24, pumps readiness, retains a deadline,
and calls `vsock_block(24)` while waiting. That restores ESP, selects the current
thunk EIP, sets reason 8/yield flag and steps 0. The real completion path clears
waiting state, rewrites fd sets and stores `total` into EAX (winsock lines
2745–2778). Pinned runner lines 10697–10731 clear reason 8, await `setImmediate`,
then pump the wire; the next invocation re-enters the handler. Scheduler lines
2640–2647 and 3460–3474 similarly clear/pump and yield the slice. Runner line
7527 assigns `tickState.batch`; `get_tick_count` is a readonly global getter.
Observed tick progress is reported rather than assuming wall or batch clock
deadline behavior. The accepted original run was natural exit 0, 42000 batches,
11.124 s; this remains retained evidence, not new acceptance.

The retained actual argv selects `--tick-ms-per-batch=200` and no `--real-ticks`,
startup-clock or time-scale flag. Runner lines 4431–4465 bind `h.get_ticks` to
`createGuestClockSource(...).ticks` and publish the same source through context.
The manifest-matching `lib/guest-clock.js` selects `batchClock.getTicks()` in this
mode. `lib/batch-clock.js` derives a base from batch/epoch/paused time and consumes
a bounded per-call step, with a monotonic floor. Runner line 7527 advances the
batch and line 7530 resets calls within the batch. Reading this host function
would itself spend a step, so this passive observer never does so. Its cached
tick getter is a separate readonly observation; synthetic advancing/frozen tick
tests exercise that observation, not a reconstructed deadline or clock freeze.

The runtime manifest's selected runner/scheduler/module entries match the pins,
but it contains no winsock source entry. Separately, the historical Git source
`b41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a:src/09d-winsock.wat` is byte-identical
to the supplied source SHA-256
`c281da4763624a29910386d2d6b05a66f98ca92b2a9194827d880c0234ba89ab`.
This distinction is retained in the selected identity receipt.

Even EIP equal to the saved return address with ESP equal to saved ESP + 24
does not prove a select return at a coarse invocation boundary: intervening code,
callbacks or another call may have run, and EAX may have been reused. Such a tuple
increments `returnCandidates` and closes tracking as unknown. `witnessedReturns`
stays zero, `apiCompletion` stays `unobserved`, and `apiResult` stays `unavailable`.

The missing exact hook must capture an invocation-owned call token, thread/instance,
API ID 934, current thunk, pre-pop ESP and return address at select entry, and a
matching non-park completion after `handle_select` has written `total` (line 2778),
before any other guest instruction or callback can overwrite EAX. It must carry
the result and post-pop ESP through the dispatcher return/continuation decision;
a blocked `$vsock_block` path must never produce completion. Both thunk-zone and
decoded inline CALL/JMP dispatch paths must be covered (`win32_dispatch_inner`
establishes `current_thunk_eip`, lines 164–180). No existing pinned export supplies
that hook. This task deliberately implements honest retry/unknown observation.

## Cheap validation

All commands ran under `ops/guard.py`: Node heap 256 MiB, CPU/wall 60 s,
stdout/stderr 131072 bytes, file 24 MiB, process-group TERM/KILL/reap within 5 s.
Full command receipts and pass/fail evidence are adjacent in
`maelstrom-select-lifecycle-observer-20261024-evidence/`.

```sh
node --check tools/maelstrom-select-lifecycle-observer.cjs
node --check test/test-maelstrom-select-lifecycle-observer.cjs
node test/test-maelstrom-select-lifecycle-observer.cjs RUN_JS EXPORTS_WAT THREAD_MANAGER_JS
node test/test-maelstrom-event-boundary-observer.cjs RUN_JS EXPORTS_WAT THREAD_MANAGER_JS
git diff --check
```

Syntax, retained-event replay, source-shaped pre/post sequences and existing suite
pass. The transformed nested observer setup is executed with a fake instantiate
sentinel; no WebAssembly object is created. Return/exception identity and exactly
one original run per invocation are checked. The existing suite rejects six
mutations; the lifecycle suite rejects seven: dedup-as-stall, stale-EAX-as-result,
unrelated-call conflation, cap bypass, disabled wrapping, direct-window guard
removal and an extra yield clear. CLI checks establish enabled syntax and disabled
identity, including nonexistent unused pin paths.

Two initial test-fixture failures remain recorded: synthetic backing accidentally
fell below the direct-window floor, then a bounds fixture still exercised a second
guard after the targeted guard was removed. Correcting those fixtures preserved
the production guards and rejecting oracle. An early metadata inspection printed
the first 30 manifest entries instead of selected entries; no whole manifest was
printed, and subsequent reads used selected fields. An attempted historical
resource receipt used an absent filename; no unchanged retry occurred.
The first staged whitespace check rejected spaces after numbered blank lines in
rendered source excerpts. Their committed display copies were trimmed; raw
excerpts remain in ops and full-source identities remain unchanged.

Resource admission retains the first 60 MiB projection inside the 64 MiB allocation
and its 8 MiB reserve. The correction includes full external launcher/session/WAL,
positive SQLite growth against an earlier conservative baseline, future files and
publication copies. Initial per-file SQLite sampling was omitted and is explicitly
qualified; the earlier baseline overcharges pre-task growth instead of resetting
charges. All six pins were freshly hashed before use. Git uses dependency-first
flattened readonly alternates and explicit sparse paths: no fetch, clone, repack,
full-tree checkout or recursive object-store publication. Historical 24 MiB pack
failure and all prior accounting defects remain historical evidence.

No box was assigned. `bx_qa9ex5bu` shutdown belongs to the coordinator;
`hostbx_69aem736` was untouched. State/expiry were not queried. Publication is to
the task branch only; final commit/remote verification and cleanup are recorded
in `/tmp/maelstrom-select-lifecycle-observer-oct24/ops/result.json`.
