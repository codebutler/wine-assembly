# Maelstrom breakpoint-boundary technical review — REJECT

Historical source last updated, 2026-10-24. Runtime and implementation claims below describe that dated source; see current app notes and source for subsequent changes.

The pinned historical `src/13-exports.wat` tests a changed WASM watchpoint at
lines 172–179, before the EIP breakpoint at lines 183–195. **Both branches write
`last_run_halt = 5`.** The adapter nevertheless labels every raw 5 as
`eip-breakpoint`. Its configuration checks do not exclude watchpoints; the
historical runner supports arming them alongside `--trace-at`.

The unchanged adapter accepts a source-proven watchpoint halt with EIP
`0x7a3366` and correct `get_bp_addr()` readback, emits a target record labelled
`eip-breakpoint`, reads 16 bytes, and concludes `target-observed`. At a different
EIP the same watchpoint halt is still incorrectly labelled `eip-breakpoint`,
although memory observation is correctly withheld. Arming/readback proves the
breakpoint is installed; it does not distinguish the earlier watchpoint branch. The historical no-watch recipe does not demonstrate this collision occurred in
the retained capture. The defect is in the adapter's accepted configurations
and positive causal label, not evidence of a new historical guest failure.

An acceptable revision must either establish the exclusive halt cause or
reject conflicting configurations and use a source-supported halt label. This review deliberately leaves that implementation to a new assignment.

## Reproducer and controls

The adjacent `reproduce.cjs` hashes the unmodified candidate adapter and pinned
runner/exports, transforms the actual runner, and executes exact transformed
watch arming, audit initialization, breakpoint arming, main-run and finish
fragments. Mock exports supply the two **source-proven** halt causes; this is
an offline fragment integration test, not WAT execution or a runtime replay. The `run` call remains 1000 blocks. Real breakpoint control: 16 reads and one
target. Wrong-halt control (8 at target): zero reads and unresolved summary. Watchpoint collision: 16 reads and the false positive label. Its explicit
acceptance oracle fails with the retained assertion, exit 1.

```sh
node --max-old-space-size=256 docs/re-notes/maelstrom-breakpoint-boundary-audit-independent-20261024/reproduce.cjs scratch/runs/<run-id>/repo
node --max-old-space-size=256 docs/re-notes/maelstrom-breakpoint-boundary-audit-independent-20261024/reproduce.cjs scratch/runs/<run-id>/repo --acceptance-oracle
```

## Checks that passed

The full 7725-byte adapter and 11818-byte test were reviewed. The main snapshot
hook is immediately after the existing run and before host/render/scheduler
work. Actual main arming/readback is tested; the disabled transformation is
byte-identical. Input injection, batch size 1000, pacing and maximum budgets
are unchanged. Optional guards/counters have explicit unavailable values.
