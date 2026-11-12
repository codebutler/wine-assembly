# Enigma callback instrumentation: cooperative scheduler qualification

Historical source last updated, 2026-10-30. Runtime and implementation claims below describe that dated source; see current app notes and source for subsequent changes.

Candidate/base: `d3c9e74f2e54c9294624f3e9ca9c0ac4d62b9a62`.

The bounded integration test passes against the published, unchanged
`ThreadManager` module, including the complete real `runSlice()` method. It adds the enclosing cooperative scheduler coverage missing from the earlier
acceptance, which extracted the consumption block and manually cleared grants. No production repair or main-branch integration is included.

Run from the repository root with Node 20:

```sh
/usr/bin/node --max-old-space-size=192 tools/acceptance/enigma-callback-real-scheduler-oct30.js
```

The first behavioral checkpoint calls real `runSlice()` with all four synthetic
guest threads parked on empty semaphores and verifies zero guest dispatches. Two real audio hosts then admit callbacks with identical token, voice and header
values on distinct export objects. Each callback runs through the scheduler,
releases a different real semaphore to a parked consumer, and supplies a synthetic
return restoring its original wait. Checks cover:

- Real release, grant, scheduler consumption and wait completion, with exact
  result register, return EIP and 12-byte stack adjustment at guest dispatch.
- Clearing both grant handle and trace correlation; a second slice on the same
  empty semaphore performs no additional guest dispatch or consumption.
- Callback return records and restored guest wait fields, scheduler waitPolls
  and waitStartedAt bookkeeping, and continued parking on the unsignaled wait.
- Callback owner/token to release identity to consumer correlation across two
  owners, including the other owner's pending state after the first returns.
- Enabled/disabled equality for dispatch log, guest states, run counts and sync
  table, with zero trace-enable hook calls when disabled.
- A distinguishing rejecting control injects stale grant trace ID 999 while
  keeping the real scheduler unchanged. Scheduling succeeds, but the precise
  release-to-consume assertion rejects it.

Guest exports are explicitly synthetic JavaScript. They supply callback
admission, return markers, guest run behavior, wait frames and the caller's
`waveWaitSaved` input. Already-initialized thread fixtures skip DLL attach by
declaring `_dllAttachNotified`; no scheduler method is stubbed, extracted or
replaced. This test qualifies scheduler/component wiring and trace correlation,
not authentic WAT completion, x86 instructions, continuation authentication,
guest execution, browser ownership routing, worker scheduling, full CLI or
gameplay. Those remain separate gates.

The prior canonical receipt at
`completion-receipt.json`
is reused for unchanged earlier checks; its suites were not replayed. All 19 dispatch input files matched byte count, SHA-256 and exact candidate Git
blob identity. The new test additionally pins the three production modules
directly at startup.

Evidence root: `enigma-callback-real-scheduler-qualification-oct30`. `e/scheduler-acceptance-final.{json,stdout,stderr}` retains the passing execution
and its ten trace events. `e/node-startup.*` retains the exact startup limits. `verified-inputs.json` binds all source identities. `completion-receipt.json`
records publication and recovery evidence; `recovery.patch` is retained separately.

The first local test failure (`e/scheduler-acceptance.*`) was an incorrect fixture
expectation that sleepCount survives a non-sleeping run. The production tail
explicitly resets that field; the corrected fixture asserts the reset and tests
wait bookkeeping independently. No production counterexample was identified. The first blob-check helper also had a nested-string NUL syntax error; its
corrected byte construction passed. Both original diagnostics are retained.
