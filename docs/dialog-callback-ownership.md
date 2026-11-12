# Dialog callback ownership source reconciliation

Historical source last updated, 2026-10-20. Runtime and implementation claims below describe that dated source; see current app notes and source for subsequent changes.

`node test/test-dialog-callback-ownership.js` parses the actual WAT and
evaluates the synchronous x86 branch from register saving through restoration. The routing prefix and subsequent native edit fallback are excluded. The
evaluator models invocation primitives, guest memory, run slices and host
service boundaries; it does not compile or execute the VM.

The 44 cases cover capacity and rejected acquisition before guest writes,
last available child, arguments, fresh siblings, nested completion and nested
timeout, normal slices, 64-round timeout, 4096-round sleep timeout, serviced
and failed DLL loads, nested service callbacks, host/run traps, and malformed
completed stdcall ESP. Return/timeout/sleep/load exits reject live extra
children, same-depth replacements, high token-bit changes, root changes and
depth changes without leaving or restoring interrupted state. Five AST mutations remove each retained guard, move acquisition late, or
remove the completed ESP guard; each must fail a behavioral assertion. The historical pre-fix source fails capacity-before-write. Fetched main passes.

The existing core owns epoch/thread validation, token allocation and spill
pins; these are not reimplemented or proven by this model. RichEdit
`3c01665c` and ICM `066436de` use the same retained-local contract; their source
harness informed this evaluator. No CRT jump gate, census, ledger or core
invocation code changed. The dedicated test is directly invoked; no shared
test-tier registry was edited.

Evidence: `scratch/runs/20261020-dialog-callback-ownership/`, containing
source/parser snapshots, historical baseline, replay recipe, logs and hashes. This task ran no full build, fullVM, browser, guest or runtime operation. Historical runtime claims in `re-notes/sync-window-invocation-ownership.md`
were not repeated and are not fresh qualification for current main.
