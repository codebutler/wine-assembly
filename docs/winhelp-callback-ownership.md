# WinHelp macro callback ownership

`help_macro_call_routine` now acquires its synchronous invocation before the
first callback-frame stack/register/EIP write and retains its child token, root token,
and depth in locals. Both ordinary completion and the existing 64-slice
timeout validate all three before retiring the child or restoring the caller.
A mismatch traps without popping another invocation or restoring stale context;
process reset owns recovery.

Reverse argument pushes, the return thunk, million-step slices, register
restoration, argument cleanup, and the existing accepted timeout behavior are
unchanged. No CRT jump enablement or invocation-core changes are included.

Run `node test/test-winhelp-callback-ownership.js`. It parses the actual source
with the repository parser and executes the complete successful guest-call
block with modeled sync/run boundaries. Cases cover capacity before writes,
entry failure, last available slot, zero/one/sixteen arguments, slices and
siblings, valid nesting and nested timeout, child/root/depth/high-bit mismatch,
run traps, and the 64-round timeout. Four mutation controls remove individual
guards or move acquisition late; each must fail a behavioral assertion.
The fetched pre-fix source must fail the capacity-before-write assertion.

This is source-only conformance, not a compiled-module, real x86 ABI, guest,
browser, or fullVM qualification. Parsing/heap preparation, invocation-core
implementation, thread epochs, spill/SEH behavior, and trap recovery remain
outside the modeled boundaries.

Base: `7b15136870328d66a8517b9673efad3fd0941294`. RichEdit `3c01665c`
and main's dialog fix `a5a0267d6` were reconciled as analogues, not modified.
Self-contained snapshot, baseline, logs and replay recipe:
`scratch/runs/20261020-winhelp-callback-ownership/`.

## Independent paired review, 2026-10-20

Reviewed with RichEdit against fetched main
`7ddcd0572b132759c9122c80492e9f9c161a047a` and the actual invocation and
`sync_depth` helpers in `04-cache.wat`. Retained i64 child/root and i32 depth
are checked before leave and caller restoration on both return and timeout.
Core leave validates lifetime but consumes the current token, so it cannot
replace these retained checks. A thrown run or guard failure bypasses caller
restoration and heap cleanup; process reset is the documented recovery boundary.
Argument parsing and heap writes occur before acquisition; the before-write
claim is specifically about the callback frame, not all function memory writes.
Existing valid timeout retirement, cleanup and accepted status are unchanged;
this is not proof of asynchronous-service handling or guest completion.

No additional production defect was demonstrated. Added callback clobbers of
all saved registers and controls on return, slice-64 return and timeout, and
13 individual restore-removal mutations. This closes the original suite's
gap where unchanged register values could hide a missing restore. The suite
now passes 25 cases and 17 mutation controls. Self-contained paired evidence:
`scratch/runs/20261020-callback-pair-review/`. FullVM qualification remains pending.
