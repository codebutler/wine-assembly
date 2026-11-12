# RichEdit / WinHelp census reconciliation, 2026-10-20

Base: `8580f3aac0fac2b15e932c931620e0491d86b8a8`.
The canonical build previously stopped before compilation with four census
errors: sha256 and boundaryCalls for `$edit_stream_call` and
`$help_macro_call_routine`. This change updates exactly those two fields in
those two rows. No production helper, gate implementation, other census row,
classification, reason or `ownership: pending` assertion changes.

The reviewed merged changes are RichEdit
`3c01665cdeb65ca7aebfdae7aec8dba4c3499884` and WinHelp
`78dcf52b52379d37bc3eff0843b5b7b5bce3f8cf`. Their retained child/root i64
tokens and depth i32 are captured after synchronous acquisition, before guest
callback-frame writes. Child/root/depth guards precede retirement and all
caller-context restoration on completion and 64-slice timeout. Each producer
therefore adds two `$invocation_current` calls to the census boundary list.
The source hashes pin the ordering and guards as well as the calls.

Reviewed the actual `04-cache.wat` helpers: acquisition validates and obtains a
child before depth/spill mutation; current validates thread/epoch/root; leave
consumes the current token, so it cannot substitute for the wrappers' retained
identity check. A thrown run or failed guard leaves restoration unexecuted.
RichEdit null callback still returns 1 without acquisition; valid timeout
returns error 1. WinHelp argument parsing/heap preparation precedes acquisition;
its before-write guarantee is about the callback frame. Valid timeout retains
existing accepted status and argument cleanup, not proof of guest completion.
Trap recovery remains a process-reset boundary; no new lifetime approval is made.

Validation on Node v24.18.1:

- The unchanged scanner and checker over all 266 fetched-main source files
  reproduce exactly the four baseline errors; the corrected lock accepts all
  396 entries. Nonlocal API registration/handler checks remain closed.
- `node tools/callback-census-reconcile.test.js`: two actual producer ASTs,
  14 rejection controls. Guard deletion, late acquisition, and omitted ESP
  restore remain rejected; root/depth/restore mutations preserve boundary-call
  lists and must still fail the body hash. A refreshed hash with a stale
  boundary list fails independently. Relabeling ownership as covered fails.
- `node test/test-callback-ownership-census.js`: existing inventory mutations pass.
- `node test/test-edit-stream-ownership.js`: 23 cases, 17 behavioral mutations.
- `node test/test-winhelp-callback-ownership.js`: 25 cases, 17 behavioral mutations.
  These existing tests include nested success/timeout, siblings, capacity,
  high-bit identity differences, and all 13 saved-state restores.

Self-contained evidence:
`scratch/runs/20261020-callback-census-reconcile/`.
Run `node replay.js` there: compressed full source inventory, Git blob
identities, baseline lock, corrected snapshot and test dependencies are retained.
The full inventory is scanned in memory to respect the sparse-checkout disk
budget. This invokes the same source scanner/checker as the canonical gate;
it does not run the full build or claim compilation success. Non-owned census
entries, including JS COM entries, are compared unchanged.

All seven fullVM native scenarios remain unexecuted by this task: edit ordinary,
nested, error, timeout; help ordinary, nested, timeout. Actual x86 ABI,
register/ESP and sibling oracles, spill/SEH, thread/epoch enforcement,
asynchronous resumption, native Windows comparison and Circus gameplay require
separate qualification. No runtime, main integration or CRT jump enablement.
