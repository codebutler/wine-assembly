# Independent Enigma FindFirstFile review (2026-10-24)

Accepted candidate `099509b272f458f9ac91867b035651855cc6522f` from
`task/enigma-findfirst-literal-pattern-repair-oct24`, based on main
`979042c93eec78095d0e4ee078d4efb25a55a5ff`. The only production change is
the regular-expression construction in `VirtualFS.findFirstFile`.

The full character class covers backslash, caret, dollar, dot, star, plus,
question, parentheses, brackets, braces and pipe. The single replacement pass
escapes literal regex characters and expands only `*` and `?`; replacement
output is not processed again. Anchors and case-insensitivity remain present.
The preceding DOS `*.*` normalization and following enumeration, path/root
handling, sorting, metadata and find-handle code are unchanged. Backslash is
resolved as a path separator; pipe is covered for permissive mounted VFS names.

The actual candidate filesystem SHA-256 is
`542ecac68e15882d9f5455e89c2c92198d3e3042b53b599b29706a6668fcb3b1`.
The retained baseline is byte-identical to the main Git blob, SHA-256
`4c255570c74512262849420c74fe73704fcfe006dc09fb963272c66c9ea0b27e`.
The unchanged real-VirtualFS regression passes the candidate and rejects that
baseline with the leading-plus SyntaxError. Its paired/unpaired punctuation,
near matches, anchors, case, paths, roots, dot records and wildcard checks
execute the exported production class; lazy loaders throw if enumeration reads
file data. Existing VFS tests pass 46/46, slash-resolution and device-namespace
tests pass. The actual test-tier classifier assigns the new test to unit through
its filename convention, requiring no exception. The global census and full
build were not run in this focused checkout.

All ten producer controls were independently reconstructed and matched to their
recorded module SHA-256 and rejecting receipt: eight escaping omissions (plus,
brackets, parentheses, dollar, caret, braces, pipe, dot), and disabled star and
question wildcards. Those exact-revision execution receipts were reused.
An additional independent production-class probe checks combined punctuation,
Unicode, hyphen, strict end matching, sizes and metadata-only enumeration. It
passes the candidate and rejects a real-module mutation removing the end anchor.
Two local helper assertions stopped before that mutation ran; their correction
and original diagnostics are retained without repeating passing candidate tests.

Evidence is adjacent in
`enigma-findfirst-independent-integration-20261024-evidence/`, including exact
input bindings, full bounded test outputs, fresh per-process memory/disk gates,
and the independent probe. The task root retains setup/review recipes, focused
manifest, sparse noncone path rules, bounded Git stderr, final staged diff,
publication, accounting and cleanup receipts. Read-only standing object views
are borrowed without copying stores; no donor or root Git data is changed.
Git uses the dedicated trusted SSH identity and known-hosts configuration.
No guest mount argv exists, so canonical mount parsing is inapplicable here.

Main publication is conditional on an exclusive shared-integration lock, fresh
remote reconciliation, reviewed scoped changes, final-tree tests and nonforce
push with actual remote ref verification. Madbomber has publication priority.
The publication receipt records the actual parent/main and resulting revision.

This host filesystem repair does not establish historical Enigma module,
startup, menu or gameplay acceptance. PNG capture rejection occurred at batch
30000 before the later regex exception at batch44896; the historical runner
continued after that rejection. PNG fit and immediate-stop compatibility remain
unresolved. No runtime/adapter/PNG/API/output guard was modified. No native
instantiation, build, guest, browser, acquisition, deployment or worker launched.
No box was assigned; lifecycle ownership remains with the coordinator.
