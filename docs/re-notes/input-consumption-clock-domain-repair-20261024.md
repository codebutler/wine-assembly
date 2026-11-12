# Input consumption clock-domain repair — 2026-10-24

Source: `01da39b4471d7f2827be043804b755aa9bb6b141`, parent accepted main
`adb2852f0ad9944625d809fd9b73c50dc3d4514e`. Review publication
`0ba9e0d8ff7f98b740790660610991f692474efd` is evidence, not the source parent.
This task publishes a candidate repair only; main awaits independent acceptance.

The production startup wrapper maps raw batch ticks before returning them to
the guest. At batch 7, step 200, factor 0.01, the guest receives 14 while
`tickState.lastTick` remains 1400. The old trace mislabeled that raw state as
`lastGuestTick`. The trace now observes actual successful returns at the outer
guest-clock reader and retains the returned number. It never probes the clock
to obtain this field or remaps a historical return. The main host import uses
the observed reader; disabled observation returns the original reader unchanged.

`lastGuestTick` starts as `unavailable` in both clock modes and stays stale until
another reader call, including across explicit or automatic startup release.
Real-clock reads are captured after scaling/mapping as well. `guestMs` still
uses the existing publish path. Clock construction, raw tick semantics, startup
mapping, event identities, routing, Dispatch correlation and the 1000-record
cap are preserved. Calls shared with host timing hooks also update the reader
observation. Independent worker API reads are not observed by this field.

## Production-path inspection

Inspected candidate production initialization in `test/run.js`: bench wrapper,
startup batch wrapper, `createGuestClockSource`, real startup mapping, startup
event release, `h.get_ticks`, `ctx.guestNowMs`, renderer clock wiring and sleep
clock readers. The new regression executes the production initialization block
from the startup-wrapper comment through trace installation, including the
actual import assignment. It supplies clocks and time, not a replacement
startup-wrapper implementation.

Read-only WAT call-site inspection: `src/09a0-handlers-base.wat` GetTickCount
calls `host_get_ticks`; `src/09a7-handlers-dispatch.wat` timeGetTime and
QueryPerformanceCounter do too. QPC then multiplies by 1000 and uses its shared
monotonic counter. `lastGuestTick` is the host millisecond return, not QPC's
interpolated microsecond result. `lib/host-imports.js` uses `ctx.guestNowMs`
for other local import tables. No WAT, graphics, manifest or guest clock source
was edited. No compiled or gameplay acceptance is claimed.

## Immutable independent-oracle provenance

The [adjacent evidence directory](input-consumption-clock-domain-repair-20261024/)
retains byte-for-byte copies of both oracles, the tiny correction diff, the
coordinator's baseline rejection receipt/log and passing repair results.

- Original external reproducer: SHA-256
  `3026681798630ccbe2b93957ac31b1f40cf83540723c678dbe1fe2e374e059cf`.
  It matches the unchanged review-adjacent oracle. Its unconditional
  `reported == 1400` contradicts correctness-mode `reported == actual == 14`.
  It remains historical evidence, not a passing requirement.
- Coordinator-corrected oracle: SHA-256
  `e516ba5f6396c3e42ff6041e8d8d78859ed7eac42848040ee60132b7c989242c`.
  Only the known-defect assertion is conditionalized to diagnosis mode, with
  a corresponding output message. All noncontradictory controls are unchanged.
  The retained receipt proves correctness mode rejects source `01da39b`.
- This worker changed neither external oracle and did not run the no-flag
  known-defect diagnostic as a passing criterion.

Required acceptance command (exit 0):

```sh
node --max-old-space-size=256 /home/user/wine-assembly/scratch/usage-watch/input-consumption-oracle-correction-oct24/independent-controls.js /tmp/input-consumption-corrected-oracle-repair-oct24/repo --assert-correct-last-tick
```

Its startup observation is `batch=7 guestMs=14 clock=batch lastGuestTick=14`.
The unchanged independent controls also pass actual production renderer FIFO
identity, duplicate balanced key/mouse events, delayed dequeue at 7 and later
Dispatch A/W at 11, unavailable Dispatch correlation, empty polls, routing,
trace on/off equivalence, mixed-record cap and real scaled/mapped no-probe
observations.

## Focused validation and recovery

All commands ran source-only with Node heap 256 MiB, CPU/wall limits 60 seconds
per command, and fresh MemAvailable admission above 805306368 bytes. See
adjacent `tests.json`, `source-identities.json` and logs for exact identities.

- `test/test-input-consumption-clock-domain.js`: production batch startup
  guest 14/raw 1400; stale actual returns before/after explicit and automatic
  release; nonstartup, rebased/paused batch; real scaled/mapped clocks; actual
  host import wiring; enabled/disabled identical returns/state; cap/no probes.
- Five rejecting source mutations: raw-state label, snapshot-time remapping
  of history, extra guest probe, detached host reader and dropped tick evidence.
- Existing `test/test-cli-tick-ms-input.js --source-only`,
  `test/test-batch-clock.js` and `test/test-guest-clock-source.js`: pass.
- Syntax checks of `test/run.js` and `test/input-consumption-trace.js`: pass.
  `git diff --check`: pass.

One initial regression fixture run failed because a Node-required clock module
uses its own Date global; the fixture now supplies its existing supported `now`
option. The failed log/receipt are retained externally. No production clock or
independent assertion was changed to resolve that fixture issue.

Recovery closure: materialize the exact Git blobs in `source-identities.json`
before testing. Required paths include `test/run.js`, the trace helper, the
three existing tests above, the new focused test, and `lib/{batch-clock,
guest-clock,startup-clock,host-window,renderer-input}.js`. In a fresh private
repository, enable explicit non-cone sparse checkout and write these paths to
`.git/info/sparse-checkout` before checking out the task branch. `startup-clock`
is required by the external oracle even when absent from a donor's working
tree; use its verified Git blob. Built-in Node modules need no packages.
Only private alternate ordering was flattened dependency-first; no donor was
changed, no broad checkout/repack or tool copies occurred.

External retained artifacts: `/tmp/input-consumption-corrected-oracle-repair-oct24/`
contains admission, all logs including failed fixture history, test/source
identities, publication/ref verification, resource and cleanup receipts. The
allocation includes checkout/Git/copies/transport/evidence/temp, full external
session/events history, positive SQLite growth, future allowance and an 8 MiB
reserve. `resource-prepublish.json` records the measured projection and host
floor. No binaries/run artifacts are needed to reproduce these source checks.

No box assigned: ID/state/expiry N/A. No deployment, compiler, Wasm instance,
browser, game, packages, downloads, additional worker or shared integration.
Unused box lifecycle remains with the coordinator.
