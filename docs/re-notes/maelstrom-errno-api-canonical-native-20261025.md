# Maelstrom errno latch: canonical compilation and controlled native observations

Historical source last updated, 2026-10-26. Runtime and implementation claims below describe that dated source; see current app notes and source for subsequent changes.

Both canonical diagnostic binaries compile, validate, and pass full static ABI
inspection. Ten controlled compiled-native scenarios pass on `bx_k38z8byn`. Errno **0, 4 and 37** reach status 4/event 3 through genuine owned select
completion, CALL EDI, a nested native return and the final C3 RET, before
`CMP [EAX],4` executes. This is controlled qualification with an explicit
synthetic CRT mapping and thread-data provider. Original-game errno, caller,
loader mapping and gameplay remain **UNKNOWN**.

## Exact build and ABI

The 128 raw source files are retained in a hash-bound compressed bundle. The
driver reconstructs them in memory, uses the canonical compiler's byte decoder,
and builds its three identical VFS aliases per source. Only the four accepted
transformed fragments overlay that VFS; `src/main.watx` supplies the include
order, and every instrumented fragment is demonstrably reached. Source inputs
remain byte-identical. Production, standardWat, no runtime builtins, strict
declarations, no names/shake and the original dispatch trampoline apply.

The unchanged historical 8 MiB native-module guard is preloaded before either
synchronous fixed-Buffer Module constructor. Task output bounds are stricter,
2 MiB per module. Node 24.22.1/V8 13.6.233.17-node.58 successfully validates both
actual binaries, including the tail-call instructions.

## Actual native behavior and limits

Controlled CRT base is explicitly `0x522000`, **not a loader observation**. Authentic `_errno` bytes at RVA c430 are `e82274ffff83c008c3`. Their real relative
CALL reaches a synthetic `_getptd` provider which returns an initialized
thread-data pointer; actual ADD EAX,8 and C3 RET then return to `007a3366`. The source block is `007a3362`, decoder CALL-register/H119 uses EDI, and final
RET/H41 is in the block at CRT RVA c435 (RET byte RVA c438). The nested provider
RET below the owned post-ESP does not capture.

Errno 0/4/37 each capture token 1, thread 1, regbank `86228992`, select result and
EBP 1, pre/post ESP `0x07412000`/`0x07412018`, EAX `0x00451008`, authentic native
entry `0x0052e430`, predecessor `0x0052e435`, and successor `0x007a3366`. Caller triple is `0x0040e12a`, `0x04103000`, `1000`, read at post-ESP + 0x124. Only status 4/event 3 is accepted. Successor entry count remains zero; ordinary
one-block run budgets stop before CMP. No breakpoint, forced yield, diagnostic
clock/import, lazy mapping, or diagnostic guest mutation manufactures the visit.

OFF/ON normalized architectural registers, lazy-flag operands/results,
initialized guest fixture memory, API/import activity, counters, run budget and
yield states match for all three successful errno values. OFF private diagnostic
state remains zero. The private captured state cannot reset on another start. Relocated fixture pointers are normalized explicitly in the retained test.

Seven additional actual-module controls pass by rejecting: wrong select return,
wrong native target, wrong CALL return PC, EBP/result mismatch, unsafe errno
read, return without the owned CALL, and block-executor mode. Stale token,
foreign thread/regbank, mismatched post-frame, unsafe caller-span, code16/uop,
and nested CALL rejection are **not compiled-native qualified here**. The
4096-attempt cap and disabled unused-getter rules retain prior source-level
acceptance; this run does not claim their native exhaustion/host-oracle coverage. There is no full-memory equivalence claim beyond initialized guest fixtures,
compat native instantiation, native overhead measurement, full authentic
`_getptd`, original guest, loader proof or gameplay acceptance.

## Execution, recovery and publication

Committed evidence lives in `maelstrom-errno-api-canonical-native-20261025/`. The hash-verified compressed remote evidence contains exact full ABI/types,
source/compiler/transformed-input seals, native states, rejecting controls,
supervisor results and retained logs. `RECOVERY.md` describes decoding and
reproduction. Binary modules remain at
`/home/user/maelstrom-errno-api-canonical-native-oct25/ops/` on the assigned box;
the compressed source bundle also remains there and under the local owned ops.
