# Maelstrom native errno successor latch — implementation candidate

The opt-in latch captures native C errno and CheckSockets caller at `007a3366`,
before `CMP [EAX],4`. **Thirteen source AST/model test groups pass; no compilation,
module instantiation, native qualification or original-game run occurred.**
The accepted historical completion remains result zero, attempt seven/six parks.
Its subsequent native errno/caller, completion fdsets/timeval and gameplay remain
unknown. No production socket defect is established.

## Boundary and controls

`tools/maelstrom-native-errno-latch.cjs` composes the unchanged accepted select
transform. Twelve exact consumed source files are pinned; their worktree HEAD is
not claimed as the old module's build revision. Complete EXE/SDL_net/native CRT
hashes and PE section-bound native anchors bind SDL_net's authentic MSVCRT
`_errno` import, frame prologue/epilogue and
`MOV EBP,EAX; CALL EDI; CMP [EAX],4; JE retry` bytes. Preferred
`10001366 - 10000000 + 007a2000` derives the successor; locals `0x114` plus four
saved registers derives caller offset `0x124`. CRT bytes at preferred `7800c430`
are `e8 22 74 ff ff 83 c0 08 c3`: `_getptd()`, add eight, RET. The actual loaded
CRT base is an explicit transform input with no default. The retained numerical
test/CLI base is a synthetic fixture, not a new loader observation.

The pinned decoder emits H119 (`$th_call_r`, actual return operand/register) for
FF D7 and H41 (`$th_ret`) for this C3. The latch saves select's accepted completion
identity, then requires the actual CALL-register event: return `007a3366`, EDI,
native CRT target, source block `007a3362`, same thread/register bank/post-ESP,
and EBP equal to completed result. It captures in `$th_ret` after the existing
return-address load/ESP pop, before `$branch_end` can dispatch CMP. The predecessor
block must be CRT RVA `c435`, containing the byte-bound RET at RVA `c438`.
This works inside a synchronous interpreter invocation; host-return observation
alone is not considered evidence of the visit.

Only private diagnostic globals are written. Exports retain errno pointer/word,
EBP, actual successor PC/ESP, native entry/source block, caller's return PC/socket
set/timeout words, thread/register bank, token and select pre/post/result/parks.
The helper validates complete nonwrapping direct-window spans against actual
linear-memory size, then reads four errno bytes and twelve caller bytes. It never
calls `g2w`, `gl32`, lazy mapping or a fault handler. Low/sentinel, sparse/DIB,
wrapped or out-of-memory spans reject with no zero fallback. Supporting other
mappings is outside this candidate. Caller words are unrestricted observations.

Without `{enabled:true}`, the transform returns its input untouched and does not
read unused inputs/options. Production source files remain unchanged. For a new
diagnostic module call `mne_start()` on its owning instance **instead of**
`msc_start()`, before any select attempt. Status values are 0 inert, 1 awaiting
select, 2 completed, 3 owned native CALL, 4 captured, 5 rejected. **Only status 4
with event 3 is success.** No reset/rearm exists. The record is fixed and one-shot;
the accepted hook retains its 4096-attempt cap. Other threads/register banks cannot
consume ownership; wrong/stale owner events fail closed. Nested returns below the
owned frame do not capture; another owner CALL-register while awaiting native
return conservatively rejects. Code16, block-executor and uop modes reject.

Hooks do not write guest registers/memory, flags, errno, network/input, clocks,
budgets or yields, call host imports or execute additional guest instructions.
The model compares enabled/inert guest state and ordinary dispatch, and checks
source isolation. Native overhead/equivalence remain unqualified.

## Cheap verification and recovery

```sh
MNE_SOURCE_ROOT=/home/user/wine-assembly-shadow-man-span-static-canonical-oct23 \
MNE_ORIGINAL_ROOT=/tmp/maelstrom-original-win32-closure-oct24/extracted/Maelstrom-3.0.6 \
MNE_CRT=/home/user/wine-assembly/test/binaries/dlls/msvcrt.dll \
node --max-old-space-size=256 test/maelstrom-native-errno-latch.test.cjs
```

Retained `ops/check.py` adds CPU/wall 60s, output 131072 bytes, per-file 24 MiB,
and TERM/KILL/reap within five seconds. Tests evaluate transformed WAT AST,
including actual select-end/CALL/RET bodies, not x86 or WebAssembly execution.
Positive/rejecting controls cover errno four/zero/other, pointer/caller derivation,
six parks, wrong PC/thread/call, stale state, invalid memory, one-shot bounds,
disabled inertness, unsupported modes, all source/binary pins and ambiguous anchors.

CLI: `--enable-exact-native-latch CONFIG.json NEW_FRAGMENT_DIRECTORY`; config
contains `sourceRoot`, `originalRoot`, `crt`, `crtLoadedBase`. It validates before
creating output and emits four WAT fragments without building. An initial owned
guard error applied the console cap as RLIMIT_FSIZE and truncated one fragment.
The failure/partial output are preserved and excluded; the corrected guard
separates the authorized file/output limits and a changed invocation passed into
a fresh directory. Earlier model-adapter failures are retained too.

## Future qualification required

A separately assigned task must bind the complete consumed canonical closure and
compiler plus this tool/test revision, use the loader-proven native CRT base,
build a **new** diagnostic module, and qualify actual compiled-native dispatch
with positive/rejecting controls and guest-state/flags/budget/yield preservation.
The standing old accepted module
`ed9d74e5ab4c8bf03bb9f94a56ec41e6e28d9abfa282a20c6654e35e9d177ea7`
does not contain this latch. Preserve all accepted artifacts/qualification.

Only after that qualification and fresh runtime/resource/lifecycle admission may
an original capture be considered. Acceptance requires an instance-bound frozen
status-4/event-3 record, accepted completion phase three without fault/cap,
matching token/thread/register bank/pre/post/result/return, actual native CRT
entry/tail mapping, successor `007a3366`, and the errno/caller words latched before
CMP. Errno four selects retry; otherwise classify saved EBP and the actual caller.
WSAGetLastError, emulator `handle__errno`, result alone, later live memory and
return-PC/ESP coincidence are insufficient. Do not change inputs, shorten batches,
add guest execution or alter yields/budgets to manufacture the visit. Missing or
rejected capture remains unknown. This note does not authorize runtime work.

Evidence is committed beside this note; task ops are
`/tmp/maelstrom-native-errno-successor-latch-oct25/ops`. Generated fragments are
recoverable from pinned inputs, not production changes. Task-branch publication
only. No box is assigned; `bx_g84h8h98` is coordinator-reported stopped/unqueried,
`hostbx_69aem736` untouched; lifecycle stays with the coordinator.
