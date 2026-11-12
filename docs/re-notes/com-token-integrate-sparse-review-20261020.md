# Independent compiled COM boundary integration review

Reviewed candidate `3a9adf5822cb387b56f011cd1df997e62715e6fa` from
`origin/task/com-token-real-boundaries-oct20` against fetched main
`bc4e1436eeeb02f9063d75066436b20ce2f54eff`. The candidate test and note
are integrated byte-for-byte; no correctness repair or production edit
was needed. This review note is the only additional tracked file.

The ownership block comes directly from `src/04-cache.wat`; AST extraction
preserves the actual sync-depth and COM enter/check/leave bodies.
Fourteen candidate evidence source pins match both Git trees and each
materialized dependency. Host lifecycle notifications return zero and
debug recomputation is inert; neither implements token rejection.

Independent execution passes all six compiled groups and eight compiled
mutations. Capacity reaches 63 children plus the root, rejects child 64
before mutation, unwinds and admits another valid child. Retained parents,
retired siblings and a token changed above bit 31 exercise both check and
leave. Actual process restart, root replacement, changed thread ID and an
uninitialized alias exercise stale admission. Valid owners remain usable.
Every rejected call compares all 64 KiB of shared memory and every mutable
global declared in the fixture across all instances. Immutable region
constants need no snapshot. This is fixture state, not entire VM state.

Mutation compilation and initial instantiation are outside the expected
assertion-failure boundary. Behavioral failures must be AssertionError,
so a compiler failure or unexpected raw Wasm trap cannot masquerade as
a detected mutant. The pin-corruption and pre-check depth-corruption
mutations demonstrate that trapping alone is insufficient.

Validation:

- Original evidence SHA-256 verification and snapshot replay pass.
- Fresh sparse-checkout compiled boundary test: six groups/eight mutations.
- Primitive invocation suite passes, including its serial exhaustion case.
- Adjacent JS ownership suite: 30 source cases and 12 mutation controls pass.
  Its first attempt lacked the sparse `lib/storage.js` read dependency;
  adding that exact base blob resolved the environment failure.
- Unchanged test-tier validator and its regression pass against the complete
  base Git test-directory listing plus the new test: 2,052 tests, new test in
  `unit`. A directory-listing adapter avoids materializing unrelated tests.
  Membership is filename-derived; no registration change is required.
- New test syntax, scoped diff checks, candidate blob identity and shared
  worktree HEAD/index preservation pass.

Evidence and replay recipe:
`scratch/runs/20261020-com-token-integrate-sparse/` contains `review.js`,
`review.json`, test/replay logs and integration receipts. Run `node review.js`
from that evidence location while the named sparse worktree exists.
The original candidate evidence and snapshot remain unchanged at
`scratch/runs/20261020-com-token-real-boundaries/`; its `replay.js` remains
the independent self-contained test recovery recipe.

The fresh worktree was created with `--no-checkout`, exact non-cone patterns
were inspected before `read-tree -mu HEAD`, and only exact candidate paths
were restored. Disk was checked after each materialization. Worktree,
private Git metadata and evidence totaled about 2.22 MB before this note;
final receipts account for commit metadata under the 4 MiB cap.

This qualifies compiled helper/wrapper composition only. No full build,
full VM, native/x86, Boat or browser execution was performed. The adjacent
storage suite models primitives and CPU execution; it does not turn the
compiled test into storage-to-VM composition or public JS activation
qualification. Concurrent retirement, spill reclamation, native capacity
and stale rejection, abort/yield/exit/budget behavior remain unqualified.
Primitive serial exhaustion is not new COM-boundary coverage. Public
activation and whole nonlocal-jump readiness remain open; no jump lock is
cleared by this integration.
