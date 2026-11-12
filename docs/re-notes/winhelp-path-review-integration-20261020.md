# WinHelp qualified DLL path integration review — 2026-10-20

Independent source review passes for candidate
`02d53c85c0c956f784bb2d82da94f75ca9fca2e7` from
`task/winhelp-native-failure-retry-oct20`, applied to fetched main
`ee139a0947c82e3a8eba4920508cb760d99882f5` in a fresh sparse worktree.
The three candidate files are byte-identical to that commit. No additional
production correction was needed. Army, callback census and JS COM changes
are retained through the main parent; the only additional file is this report.

The prior worker terminated with exit 143 after its verified push. Its saved
events contain the successful push and matching remote ref. Its final receipt
is absent: neither `result.json` nor the `receipt.json` mentioned prospectively
in its note exists in its evidence directory. The reason for termination is
unknown. This review does not manufacture a prior receipt or modify that
worker's evidence or worktree.

## Ownership review

On this exact main, qualified lookup uses `find_dll_by_path_locked`; it does
not fall back to an export basename. The resolver's separate `help_dup_cstring`
allocation is published as `next_dll_path` while the loader lock is held.
Successful `load_dll` stores it in DLL_PATH_TABLE and lifecycle offset 60,
clears the pending pointer and publishes `last_loaded_dll_index`. Generation
retirement clears the table and frees that saved allocation. The document's
registration string therefore remains independent.

On rejected mapping, the loader leaves `last_loaded_dll_index` negative,
clears `next_dll_path`, releases the lock and does not take ownership.
The new branch frees the copy and both temporary read allocations without
initializing a failed row. Copy allocation failure frees the read temporaries.
A zero DllMain entry is not confused with failed mapping: the resolver checks
the published row index. Missing exports still return zero. Review is scoped
to this change; the source model is not a full VFS, allocator or loader test.

## Independent checks

Run from the repository:

```sh
node scratch/runs/20261020-winhelp-path-review-integrate/replay.js
```

The self-contained replay needs Node only:

- Actual resolver AST: qualified resolution, cache and row reuse, distinct
  paths sharing a basename, persistent ownership, copy/load/export failures.
- Fetched main's old resolver fails the unchanged success assertion. The
  original tested baseline also fails through the preserved replay.
- Four mutations are rejected: omitted publication, document-pointer alias,
  rejected-copy leak, and publication before taking the loader lock.
- Existing WinHelp ownership suite: 25 cases and 17 mutation controls pass.
- Original fixture offline checks and byte comparisons pass; all three saved
  native logs still fail the unchanged success oracle before DLL entry.
- Full 266-file source census: all 399 entries match current inventory and
  are identical before/after this change; nonlocal API locks remain closed.
- WAT parsing, scoped logical-AND gate, JS syntax and staged whitespace pass.
  The new test is classified in the existing e2e tier by filename convention.
  No manifest, generated ABI, region layout, dispatch table or census row changed.

The initial review harness used an extra parser filename and exceeded the
parser's 128-file location table during the full census. Reusing the actual
source filename corrected the harness; the complete replay then passed.
No production change was involved.

## Evidence and limits

`scratch/runs/20261020-winhelp-path-review-integrate/` contains source identities,
compressed full-source input, snapshots, original evidence copy, original push
events, baseline, replay, logs, validation, hashes and this review's final
receipt. `result.json` records the exact tested integration commit and verified
remote refs after publication; it is this review's receipt only.

No runtime, Boat, browser or full build was used. Source checks do not establish
native success. The three native WinHelp scenarios remain pending requalification:
build the exact integrated candidate under the canonical gates, then run
help-ordinary, help-nested and help-timeout once each with the original fixture
and unchanged oracle, retaining the module hash and source manifest. Require
actual DLL entry/arguments/results, register and ESP restoration, nested or
timeout evidence as appropriate, and 70 successful siblings; stop on failure.
The prior native observations were failures, not post-fix results.
