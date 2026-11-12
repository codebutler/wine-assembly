# Accepted VFS bounded restore: merge-ready snapshot branch

Base: trusted remote main `12e2dccc0ca16bbc327f2773f3352e8dfa787cb4`, read exactly once. Candidate `69a838665969d09be78f3b6ba8f7f13ae49a7cf8`
(parent `061461fb3e2bd088ccb6ec464ecbe958c83d46ca`), independent acceptance `f8393a3c8d2223bdaca4684ddf054952e581e6ed`.
Only production delta: the candidate's 29 added lines in lib/vfs-persistence.js.
Merged source SHA-256 `2224f8b74469606696065ea799931bc192982a608dc2a7ec0e9a690d20a4552e` is byte-exact accepted source.
Both original fixtures are retained unchanged. Every other existing tree path,
mode and blob is preserved, including renderer/browser input/save bundle/save sync/host.

Tested tree: `434b5d318ead33cec9be1b03d1fc0607e5be6f93`. Fresh merged existing persistence and restore checks each
passed once with Node --max-old-space-size=16 and 30-second timeouts.
The tested tree includes all source/test changes; later changes are this review
directory only. Final commit/tree and exact docs-only proof live in ops/result.json
and ops/final-tree-proof.json outside Git to avoid circular tree identifiers.

Reused exact-pinned acceptance: 17 supplied + 14 independent groups (550 bounded
restore calls), baseline 9 PASS / 8 expected FAIL, Darkstone PASS at 64MiB.
Both committed receipt manifests were rehashed (20 + 18 payloads). All 11 actual
merged compatibility/Darkstone closure files equal the accepted candidate blobs.
Surrounding changes since candidate parent affect host.js and lib/save-bundle.js;
both remain byte-exact main, and do not enter the Darkstone closure. No repeat
Darkstone/acceptance run was warranted. Original 16MiB Darkstone OOM and later
admitted64MiB pass remain in candidate evidence; no discarded first failures.

Task branch only. Shared main refs/index/worktree and donors were read-only.
No main merge/publication. Integrator must reconcile any later main movement;
this snapshot is not a claim about a later main. Browser IndexedDB durability,
real reload/restart/failure paths and gameplay remain separate unqualified gates.
No Boat, boxes, browser, build, services or gameplay run; lifecycle coordinator,
box ID/state/expiry not assigned. No workers spawned or successor assignment.
