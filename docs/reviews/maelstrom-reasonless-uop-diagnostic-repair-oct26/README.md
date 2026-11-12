# Terminal native-latch guard diagnostics (offline source repair)

Base: c6279bb936462834ccd9b51ea99a684a5befcda3. Original helper SHA-256:
3ea873bc5c18283fc6045b55d00a2e957eaff46b4372534dd59fba18354a9f6f.

The unchanged helper rejects an awaiting-select UOP mode change with status 5,
event 0, rejectReason 0. The same behavioral regression expecting a diagnostic
fails against those unchanged bytes. With the repair, that transition still
rejects and emits guard reason 15 (`uop-mode-switch`). Unchanged modes remain
inert in all three active phases. Status/event and capture transitions retain
their previous behavior; no reset operation was added.

The bounded inventory found reasonless start-mode/select-ownership, completion
UOP-mode, owned CALL/RET anchor, and direct-window mapping guards. Each now emits
a nonzero reason (10–36), plus the existing scalar mode/select snapshot. Compound
mode and stale-select checks retain their existing predicates. Former combined
anchor checks retain predicate order and fail-closed outcomes, reporting the
first failed anchor. No source pin, native byte anchor, ownership predicate,
mode eligibility, PC/frame/mapping anchor, or accepted completion code 1–9 changed.
The adapter decodes guard reasons separately as native-guard-rejection/v1,
preserves terminal closure, and keeps errno/caller separate from diagnostics.
Legacy all-zero diagnostics remain readable without inventing a cause.

Validation uses the existing tiny source-AST interpreter, not WebAssembly or a
compiler. The new suite passes 10 groups covering reasons 10–36, unchanged modes,
rejection in active phases, nonowners/nested returns, first-reason immutability,
terminal hooks, fresh-instance zero state, successful capture, and adapter
persistence/rejecting controls. The retained scalar suite passes 14 groups and
all 511 completion failure combinations; its explicit --storage-only entry point
avoids game-byte staging. Its default pinned-transform/binary check remains.
All prior accepted tests are retained. No replay of the two canonical builds or
36 native groups, no canonical compilation, no guest/native execution occurred.

Commands (run from repository root under ops/run.py CPU90/FSIZE25165824/wall120):

    node --max-old-space-size=16 test/maelstrom-native-guard-diagnostics.test.cjs
    node --max-old-space-size=16 test/maelstrom-native-latch-rejection.test.cjs --storage-only

Baseline reproduction uses MNE_GUARD_HELPER pointing at the unchanged accepted
helper (with only its require path adjusted for the local evidence directory),
then the same first command with --baseline to assert the original reason 0.
Without --baseline that unchanged helper fails the reason-15 assertion as expected.
Node startup receipts record unlimited DATA/AS inherited by Node; Git DATA is
applied only to Git subprocesses. 16MiB old-space is not a process RSS cap.

Resource evidence accounts task checkout/Git/tmp/evidence, actual launcher/session,
positive main-DB growth, shared WAL/SHM once, future growth once and 8MiB reserve.
Precommit projection: 53,362,688 / 67,108,864 bytes; aggregate actual Codex RSS
703,455,232 bytes; MemAvailable 2,853,609,472 bytes. Publication has a fresh gate.
Only a sparse checkout and exact missing test blobs were materialized. The
specified immutable donor lacked those test objects; they were recovered by
exact blob identity from the standing accepted donor, which was not modified.
Root source/worktree and refs were read-only; messageboard append-only.
No filename-bearing runtime mount argv exists in this offline task, so no mount
or box action was performed. Trusted dedicated Git SSH configuration is used.
Initial broad source excerpt was longer than the requested 8192-byte excerpt
budget; this capture-only procedural overrun is retained, not acceptance evidence.
Total task capture remains below 2MiB; no execution/resource gate was waived.

Measured authentic rejection cause remains UNKNOWN. The supplied retained sole
guest reached loader/native startup then status5/event0/reason0 with zero
entries/completions. This repair does NOT identify which source guard fired.
Original-game acceptance remains false. Authentic errno/caller observation and
any new runtime/build qualification require separate authorization/admission.
The earlier 2dd81e... evidence publication remains NOT PUSHED, and its historical
packing incident remains UNQUALIFIED; no old artifacts were copied or republished.
No main integration, workers, successor tasks, or runtime operations occurred.
Box bx_vs4xtsz3 was reported STOPPED/snapshot verified 10:11:30Z by coordinator;
no box was assigned here, and lifecycle ownership stays with coordinator.

Publication preparation retained an initial ordinary git-commit failure:
the minimal donor lacks an unchanged toyvm-bundle.js object, and the new local
repository initially lacked author configuration. Remote main was verified at
the exact pinned base before using write-tree --missing-ok plus commit-tree;
unchanged absent objects are retained by identity rather than staged or fetched.
The intended diff is reviewed and no unrelated tree entry is changed. These
routine sparse/local-identity errors were resolved within this same assignment.
