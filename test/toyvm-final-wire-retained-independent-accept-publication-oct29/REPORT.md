# Independent retained seven-guard wire acceptance

PASS for baseline 1d942889181b132b5535e1b09e9280d6be882fa6. This acceptance checks the exact retained final evidence; it performs no backend, mount, kernel, CLI, browser or gameplay execution.

All five production files retain their supplied SHA256/size pins. All 23 inherited test/report files were copied byte-for-byte to their original paths and checked against the pinned canonical completion receipt (SHA256 20009cfb5a351f6235978c5b7aad4167a84e2cf9f77d306c0f361c655277dcca). input-pins.json records those identities.

The separate check_retained.py never imports the backend or primary oracle. It decodes all request/reply headers and validates exact lengths, sequential unique IDs, expected errno derived from namespace/type/flag predicates, and empty error payloads. Its independent model derives the seed namespace, data, handles, quota counters, failure latch and subsequent accepted transitions. Every retained complete before/after snapshot matches: 87 observations, including all 41 rejections and their succeeding successful root GETATTRs. Only the operation counter advances on rejected requests.

READDIR records are decoded with bounds, alignment, cookies and inode/type identities checked against the model, including nested parent inode 2, movement to root inode 1, restoration and interleaved observations. Valid SETATTR preserves alpha then adds twelve zero bytes; cumulative written becomes 22, handles remain 2, and namespace restoration survives subsequent rejections.

All seven private mutants differ from the exact final backend at one intended predicate and retain unchanged serve bytes. Their first eight wire frames match production fixtures exactly. Independent prefix state and intended guard preconditions are checked before the distinguishing same-opcode/inode/payload request. Terminal effects are checked in full: file-over-directory replacement; removed directory inode; introduced descendant cycle; wrong root READDIR parent; child allocation under a regular file; unsupported SETATTR allocation; and ENOENT changed to EIO with KeyError(999) after missing-parent guard removal. These are intended predicate effects, not fixture setup kills.

The family-only rename-parent mutant starts from alpha/written=10; its production counterpart follows accepted growth to alpha plus twelve zeros/written=22. The checker asserts this exact difference and equality of all other state apart from operations, then independently checks the complete mutant fixture state. The initial checker assumed complete cross-session state equality; its preserved failed check prompted this fixture-assumption correction. No source, retained evidence or production oracle changed, and no behavioral rerun occurred.

Four private in-memory corruptions are independently rejected: changed errno, changed reply unique ID, changed full data state, and changed READDIR parent identity. results.json records their rejection reasons. These controls use the semantic checker directly, so rejection does not merely come from artifact hashes.

Real original epoll/FD cleanup is retained evidence: accept.py uses actual selectors.DefaultSelector and requires EpollSelector, witnesses the actual control socket and anon_inode:[eventpoll] via /proc/self/fd after INIT, joins the serve thread, checks owned FDs with fstat/EBADF and verifies the borrowed peer and EOF. production.json plus all seven mutant receipts preserve these observations. This task checks their identities and consistency; it does not claim fresh cleanup execution.

The inherited REPORT.md limitations remain intact, including inherited loader/composition and generic cleanup groups that were verified rather than rerun. Historical Git commit failure for lib/apps.js missing blob d17c95cd09a65fa56b4bb4f94dfc260e9ea87f17 remains a real original failure. The coordinator-provided receiver closure now proves that object exists and baseline write-tree equals 962faa48b04f325233394838e9ff7df757ba4cd3. That repair enables this separate publication attempt; it does not revise history.

Recheck retained evidence only:
    /usr/bin/python3 test/toyvm-final-wire-retained-independent-accept-publication-oct29/check_retained.py --repo . --output /tmp/retained-results.json

Publication is confined to inherited 23 files and this acceptance directory. The task receipt records exact task/main remote verification. Main is conditionally authorized only while origin main remains the pinned baseline and the exact source/test-only diff is reviewed. No public deployment is authorized. Mounted/kernel, CLI, browser and gameplay acceptance remain open. No Boat is assigned; lifecycle remains coordinator-owned.

All operations use the assigned ops.py supervisor and /usr/bin/python3. Trusted Git SSH settings are fixed by that supervisor. No mount or Node execution occurs, so no mount argv or Node startup configuration is invoked.
