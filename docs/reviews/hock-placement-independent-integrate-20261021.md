# Hock SetWindowPlacement independent acceptance — 2026-10-21

**ACCEPT** the bounded client-geometry repair in
`5d5e48d0d97be71f8f7c0dcc1596f5bea770d59d` on exact remote main
`7e5cf3535946e0a7bf42179b728a8471dc9f6b67`. The production source is unchanged
from the tested candidate. This review adds evidence only; no census refresh,
game-specific bypass, registration, asset or unrelated source change.

The host move must precede non-client recalculation: the latter queries the
host's new outer rectangle. `client_rect_set` selects the passed HWND's table
slot; screen-origin helpers and host synchronization use the same invocation
HWND, not `main_hwnd` or creation globals. Recalculation and synchronization
complete before the pre-existing first-show/min/max handling. The added helper
chain has no guest callback; it therefore cannot invalidate the handler's
WINDOWPLACEMENT pointer through a newly introduced callback. The sequence
matches the existing SetWindowPos geometry path. Existing ShowWindow behavior
and its callbacks remain outside this ten-line change.

## Independent acceptance evidence

- Replayed the submitted 15 resize, shrink, move-only, repeat and convergence
  cases across captioned, borderless and initially hidden windows using actual
  source-sliced WAT and actual host geometry functions. All pass, including
  stdcall cleanup, USER size and host mirror/origin. Added 15 cross-window
  isolation observations (both USER and renderer), per-call HWND ownership,
  move-before-sync, and sync-before-first-show assertions.
- Exact-base control rejects with 392×272 rather than 500×348 client size.
  Refresh-before-move mutation rejects identically. Omit-host-sync rejects the
  renderer mirror, 392×272 rather than 500×348. All three exit 1 with the
  expected assertion; passing candidate exits 0. Mutations are in memory only.
- Thirteen final commands all exit 0: replay; 267 region owners; 401 unchanged
  callback boundaries; callback-census regression; region-owner regression;
  127 fragment balance; unchanged A/W ratchet; all 2,073 test-tier memberships;
  logical-and gate; strict region declarations; WAT duplicate ratchet;
  generated region-map freshness; whitespace. No pin/baseline refresh.
- Candidate archive contains 65 files, including 64 SHA256-sealed entries;
  every seal verifies. All 7,133 remote source/test hashes match candidate Git
  objects. The only production delta from base is the ten-line placement
  change. Package seals match the parent record, including all 39 game files.
  Canonical build log and successful command receipt, 15-case full harness,
  two mutations and three related show tests were reviewed in sealed evidence.

The original full regression compiles the entire WAT tree; local full builds
were prohibited. Independent replay therefore uses the repository's existing
source-slice assembler with actual NCCALCSIZE, client storage and host imports
(removing its old NCCALCSIZE sink). Public packed-client and coordinate exports
are connected to their production helpers. Painting/notification sinks,
identity guest addressing and deterministic scratch allocation remain explicit
fixture boundaries. This is not a fullVM or callback-execution parity claim.
Initial fixture export wiring errors were corrected before acceptance. An
initial owner gate failed because a test owner file was absent from the sparse
checkout; materializing the exact blob resolved it. An incorrectly named
logical-and command was corrected. These are recorded separately from final
passing gates in `tests.json`.

## Runtime scope and recovery

Canonical candidate module SHA256:
`eafeaa142c98fe60c489865c89a676c20afffe51002fe36799f42aa46d19ac2c`.
Source identity, archive hash and exact commands are in `verification.json`,
`final-tests.json` and `controls.json` in the attached sealed evidence archive.
No module was downloaded/rehashed and no Boat/runtime call was made here.
Source equality permits reuse of the candidate's canonical-build and original
selection-screen evidence; it does not turn that run into a new main runtime.
The coordinator visually verified character selection. Input, gameplay, audio,
right-character clipping, rendering completeness and Windows parity remain
unaccepted. SAME `bx_3f3x23m3` remains exclusively coordinator-owned; this worker
performed no lifecycle operation or worker launch.

Run: `scratch/runs/20261021-hock-placement-independent-integrate`.
Recovery and replay scripts are in
[`hock-placement-independent-integrate-20261021-evidence.tgz`](hock-placement-independent-integrate-20261021-evidence.tgz).
The review branch contains the candidate as its parent; ordinary main
fast-forward preserves every previously committed main/laptop change. Shared
worktree, candidate checkout, configuration and unrelated WIP were untouched.
Publication receipt and independently queried remote refs are retained in the
run folder and repository messageboard after publication.
