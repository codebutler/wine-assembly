# Retained bsearch comparator ownership

2026-10-18 source milestone following validated qsort. No nonlocal API enabled.

Bsearch now keeps return address, key/base/size/comparator, bounds, midpoint,
parent, expected child, root and expected return ESP in private retained frames.
The 64 KiB BSEARCH_CONTEXTS region has sixteen 4 KiB thread partitions and
64 frames per partition; the invocation stack limits live callback children
to 63. Nested bsearch no longer overwrites the outer search bounds. Empty
arrays and null comparators return without changing an outer frame or token.
Existing zero-size behavior is preserved; no new validation policy is added.

Each comparator receives a fresh identity, retained through run slices. The
existing CACA000C dispatch case calls bsearch_continue, which checks live
root/frame, exact cdecl return ESP and retained expected child before changing
ESP, ownership or search bounds. Found and not-found paths restore the parent
and original caller stack; midpoint uses low+(high-low)/2 to avoid unsigned
sum overflow. The frame and child stay active on trap/abandonment until an
explicit host-quiescent process/thread reset. Old frame bytes and cached depth
are retired lazily by root identity. This is not exception or SEH unwinding,
and a guest deliberately entering its active continuation with matching stack
is not authenticated as an actual RET.

The authored full-WAT test executes x86 imported bsearch and comparator RETs
in either compiler dispatch mode. Cases include first/middle/last hits, lower/
interior/upper misses, zero/one count, null comparator, nested/no-op callbacks,
distinct sibling tokens and yields, guest trap then explicit process reset,
thread-root replacement with retained depth, and interleaved shared-memory
main/worker comparator execution. Controlled real-handler probes cover wrong
ESP/stale child rejection without state changes, 63-frame capacity, allocator
exhaustion, and unsigned midpoint arithmetic. These direct probes are distinct
from the guest path; interleaved instances are not concurrent OS Workers.
Both dispatch modes now pass compiled execution. Sibling modules are
preinstantiated before loading guest code so active data segments cannot
overwrite a live comparator; production init_thread attachment occurs later.
This does not test late module instantiation into live guest memory.

Seven reviewed census records change: six bsearch helpers/entry points and
win32_dispatch_inner's CACA000C case. The latter removes one inline EIP write,
now owned by bsearch_finish; other continuation cases are unchanged. Bare
bsearch owner/depth mutations are inventoried. All labels remain pending.

Remaining blockers for real `_setjmp`/`longjmp`: retained ownership for
init/exit callbacks, the other window/dialog/enumeration/
COM/media/APC/timer families and deferred host callbacks; JS alias/dynamic
entry and exception/restoration audit beyond the conservative census;
cross-family nesting and real concurrent Worker lifetime validation; thread,
process, callback and SEH rejection rules for saved jump contexts; actual jump
buffer/register/stack restoration semantics and guest x86 tests in both
dispatch modes. Existing sync hooks pop the current token, not a retained
expected token for every producer. Neither census counts nor current depth
establish complete ownership. The temporary nonlocal API review lock stays.

## Validation receipt

2026-10-18, source 4655d603d (including reviewed main 20ff02505 and fixture
preinstantiation fix b62f558f1): normal gated build; actual guest bsearch in
tail-call and non-tail-call modes; qsort in both modes with the same fixture
fix; token primitives; and production PE/NE/init_thread lifecycle all passed.
No test failed and no guard fired. Seven process groups exited. The build's
lowest recorded free disk was 2,251,481,088 bytes, above the 2 GiB + 64 MiB
stop threshold; free disk recovered above admission before subsequent tests.
Each command was separately admitted above 2 GiB + 128 MiB with a 180-second
deadline and 8 MiB output cap. No game, browser or jump API was enabled.

Candidate SHA-256 is
`db326070a32982632b2e3e882be24f6e873f4ea850711e95055d578715e0df89`
(1,869,051 bytes). Canonical `9176e819` was unchanged. Evidence and previous
qsort artifacts are preserved in
`scratch/runs/20261018-bsearch-ownership-validation/`: guard.js, per-command
JSON/logs, artifacts.json, exact build-closure paths/preflight and source
sparse patterns. Reproduce with the normal build then
`node test/test-bsearch-invocation-ownership.js` and the same command with
`--no-tail-calls`, each under a fresh guard receipt and runtime grant.
