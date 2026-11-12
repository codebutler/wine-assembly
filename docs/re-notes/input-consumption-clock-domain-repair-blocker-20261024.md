# Input consumption clock repair: acceptance blocker — 2026-10-24

Historical source last updated, 2026-10-24. Runtime and implementation claims below describe that dated source; see current app notes and source for subsequent changes.

Status: **BLOCKED before implementation**. The required immutable correctness
command cannot exit 0 under its own assertions. No repair is claimed, and the
clock-domain defect in source candidate `01da39b4471d7f2827be043804b755aa9bb6b141`
remains open. This report branch starts from that exact candidate, whose parent
is accepted main `adb2852f0ad9944625d809fd9b73c50dc3d4514e`. No main integration.

## Exact contradiction

External immutable reproducer:
`independent-controls.js`

Line 118 unconditionally executes:

```js
assert.strictEqual(actualGuestTick,14);assert.strictEqual(reported,1400);
```

Line 120 executes with the required flag:

```js
if(process.argv.includes('--assert-correct-last-tick')) assert.strictEqual(reported,actualGuestTick,'lastGuestTick is not the last guest-visible return');
```

Both values are local constants; `reported` is the primitive Number parsed from
the trace. Passing requires that same value to equal both 1400 and 14. An honest
repair that reports 14 fails line 118; the original that reports 1400 fails line
120. Reporting unavailable also cannot satisfy line 118. Changing guest clock
semantics, altering assertions or intercepting the assertion machinery is outside
the assignment and would invalidate the independent control.

The default invocation intentionally asserts the known defect and is not a
passing correctness criterion. It was not run in this task.

## Exact replay and retained evidence

```sh
node --max-old-space-size=256 scratch/runs/<run-id>/independent-controls.js scratch/runs/<run-id>/repo --assert-correct-last-tick
```

The production startup wrapper was inspected: `test/run.js:4422` maps both batch
readers, `h.get_ticks = guestClock.ticks` installs the mapped guest source, and
the snapshot at line 4473 reads raw `tickState.lastTick`. The reproduced defect
is real; the blocker concerns accepting its repair, not disputing the defect.
