# Exact select hook: canonical build and controlled native qualification

**CONTROLLED_NATIVE_PASS; independent review pending.** One compiler process
compiled both diagnostic modules; one native process instantiated the tail module
once with a fixed 512 MiB shared linear arena and Node heap limit 512 MiB. No
original game, test box, download, deployment or main integration occurred.

Accepted hook base: `01c4a60d50afe394a0afc9fda1267e6a508e7821`, tree
`2a9a16c9dad6eba99c5c79b02c0796b92186a692`. Standing canonical source/compiler
revision: `b41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a` at
`/home/user/wine-assembly-shadow-man-span-static-canonical-oct23`, reused in place.
The accepted hook file SHA-256 remains
`b7c77c20b12cd582d6fcfbe246e1f0abdcb644266fc3f161bf5d683d93b13930`.

## Actual modules and build

| Module | Bytes | SHA-256 |
|---|---:|---|
| [Tail diagnostic](maelstrom-select-hook-recovered-canonical-native-20261024-evidence/select-hook.wasm) | 1,880,716 | `ed9d74e5ab4c8bf03bb9f94a56ec41e6e28d9abfa282a20c6654e35e9d177ea7` |
| [Compatibility diagnostic](maelstrom-select-hook-recovered-canonical-native-20261024-evidence/select-hook.compat.wasm) | 1,883,289 | `b0674d48d612fad540bc7dd6da1c431ac29682108dfbf13cac3dddad2bf650e8` |

`tools/maelstrom-select-hook-canonical-build.cjs` verifies the retained 140-file,
21,207,647-byte manifest, all six hook pins and accepted transformer hash. It
uses `watxSourceClosure` / `compileClosure` from the standing compiler. Only the
accepted transformed winsock and dispatcher text replaces closure VFS entries;
all `f`, `src/f`, `./f` aliases agree. The single `src/main.watx` entry reaches
128 files, including both transformed files. Compiler byte-to-text decoding is
preserved, including ASCII comment normalization; raw transformed and compiler-text
hashes are separately recorded. No source was materialized or modified.

Options remain production, standardWat, no runtimeBuiltins, strictDeclarations,
tailCalls true/false, no names, shake or extra sources. Compatibility uses the
unchanged accepted dispatch-trampoline overlay. Both modules receive the original
`wine-region-layout` stamping recipe and pass synchronous native Module validation
with the unchanged historical 8 MiB constructor guard preloaded. Guard SHA-256:
`47ce2e2b835be33eab6b2b24f027ecaab8ceb61c559890e51548c78199beb197`.
Compiler loader SHA-256:
`d04ed1d5ca74fc1b6f10357576a38e726d58f0ad908ccf34a29de35052aa1a33`;
closure helper SHA-256:
`60d2f039abeb4a940405c885cb507ee98649eb3659969580c336a7302e5bb86c`.
Full compiler stages, helper, closure and transformed input seals are in
`build-inputs.json`; compiler-produced full inventories are in `build-outputs.json`.

## Static acceptance and controls

The unchanged accepted static helper independently reconstructs all 269 storage
regions and named spans from the source and region mirror, including DIRECT_WINDOW.
Its serialization derives `9a3bc9149d58209c`; the declared fingerprint is not used
as independent proof. Full source imports and signatures (291, including memory),
2,245 function exports/signatures, memory import/export, noStart and exact custom
section payloads match both binaries. Seventeen getters are `() -> i32`;
`msc_start` is `() -> ()`. Both modes add exactly eighteen private mutable i32
zero globals compared with their respective sealed canonical baseline. Memory and
data sections are byte-identical to the original; no host import or guest storage
was added. Compatibility's original two trampoline globals are preserved.

Six binary-record controls reject a new host import, changed getter signature and
changed layout payload for each module. Four focused emitted-source controls
reject completion before the actual EAX store, park-as-completion, missing EAX
store and erased completion. Two native-evidence controls reject park completion
using stale EAX and a completion retaining pre-store EAX. These are rejecting
source/record mutations, **not additional native mutant executions**. Accepted
implementation/source/binaries remain unchanged.

## Actual native acceptance

Cheap preflight checks exact signatures, narrowly pins the two retained native
initializer recipes, verifies disjoint code/return/stack/fdset/timeval fixtures,
and rejects a deliberately contaminated counter fixture (972 remains a count,
never an execution inference). Every actual fixture rechecks fresh counter values
`[0,0]` before its run. The exact native mount argv and intended mount-file list
are empty; the retained canonical-parser receipt for that unchanged configuration
also covers ordinary and comma-bearing control filenames. Trusted SSH configuration
is retained verbatim in `configuration.json` and `checkout.json`.

Fresh admission and exclusive `/tmp/wine-ops-heavy-runtime.lock` precede the sole
native process. A synchronous guarded Module and real Instance run actual
production dispatcher/handler code, with a native socket allocation and a
documented EOF-ready socket-state fixture. JS does not implement select, its
dispatcher, readiness filter, stack handling, result store or diagnostic globals.
Only lifecycle notifications, controlled `get_ticks`, and the socket teardown
notification are supported host imports; unexpected behavioral imports throw.
WSA is inactive, so the real `vsock_pump` gate returns without network work.

Seven scenarios run OFF and then ON, using disjoint fixtures on the same instance:

| Case | Production entry | Actual result |
|---|---|---|
| NULL-timeval park | run's thunk zone | reason 8, restored ESP, stale EAX preserved |
| Finite-timeout park | decoded CALL EDI | reason 8, restored ESP, two original clock calls |
| Positive ready result | decoded JMP EDI | EAX 1, ESP +24, fdset retained |
| Zero timeval | thunk zone | EAX 0, ESP +24, fdset emptied |
| Finite-timeout park | decoded CALL EDI | reason 8, restored ESP |
| Expired finite deadline | thunk zone | EAX 0, original clock comparison, fdset emptied |
| Positive ready result | thunk zone | EAX 1, ESP +24 |

Twenty real `run(1)` calls include three pending-yield control invocations per
lane. Each active case increments actual API dispatch count once. Pending controls
add no API call, host call, register change or diagnostic completion. One-block
budgets prevent the subsequent return block from executing; its stale-result
sentinel and fresh return counter are checked separately. Counters alone are not
called execution proof. Normalized OFF/ON registers, ESP/EIP, fdset contents,
yield/halt state, original host-call sequences and cache deltas match exactly.
No diagnostic operation clears yields, advances clocks, pumps sockets or writes
guest memory. Fixture setup and scheduler-resume setters are explicit test actions.

The accepted `snapshot(e)` and `createOracle(instance,e)` capture authentic native
exports at safe synchronous boundaries. They accept park token 1 from thunk entry,
park token 2 from inline CALL and positive completion token 3 from inline JMP.
The final native snapshot has API 934, thunk `0x75040f8`, thread 1, compiler-placed
REGFILE `86228992`, saved return `4784672`, preESP `121709056`, postESP `121709080`,
two parks, one completion, result 1. Pre-run EAX was `0x5a170123`; the diagnostic
result matches the actual production EAX store rather than that stale value.
Forged copies, stale authentic captures, wrong instance, wrong export source and
reused authentic completion reject. The first completion remains frozen through
later actual calls. See `native-result.json` and native terminal/capture receipts.

## Limits, resources and recovery

This qualifies controlled production pathways only. First-completion freezing
means the later zero returns are behavioral checks, not zero-result diagnostic
captures. Actual same-frame retry completion, exceptions within select,
unsupported direct `test_call_select` after start, compatibility instantiation,
unobserved intra-invocation properties and overhead remain unqualified. No
original-game/API-result causality is established; the original-game runtime gate
remains unresolved pending coordinator review and an authorized runtime task.

Initial precheckout admission passed with 62,750,720 projected bytes of 67,108,864,
including current full WAL, session/launcher files, positive SQLite growth,
publication, future growth and 8 MiB reserve; memory was 3,186,044,928 bytes against
2,684,354,560. Every execution/publication stage remeasures. Completed materialized
bytes replace their remaining-growth projection rather than being double charged.
Installed Node/compiler and standing readonly inputs execute in place. Both actual
modules are explicitly retained in this evidence directory as well as owned ops.

Compiler limits: CPU/wall 900 s, oldspace 2048 MiB, aggregate output 524,288 bytes.
Native: CPU 90 s/wall 60 s, heap/arena 512 MiB each, output 131,072 bytes. Cheap
commands: CPU/wall 60 s, Node heap 256 MiB. All supervisor subprocesses have a
24 MiB regular-file limit, subreaper and process-group TERM/KILL/reap within 5 s.
Compiler elapsed 5.205 s, peak child RSS 461,602,816 bytes; native elapsed 0.048 s,
peak child RSS 143,114,240 bytes. Both exit 0 with no surviving group.

Retained bookkeeping failures: the first static checker compared compat globals
against the tail baseline; it was corrected to the exact sealed compat baseline.
The first focused ordering checker expected one extra closing parenthesis; only
that checker was corrected. Original failing captures remain. The first timeout
board watcher lacked an explicit regular-file guard and was terminated; its log
and correction receipt remain charged. Guard identity was recorded after compiler
dispatch, although the unchanged guard was preloaded before the driver. Read-only
receipt searches included missing paths and truncated inspection output; those
session/launcher bytes remain charged. No compiler/backend fix or native retry.
The previous worker's failed memory admission and all prior receipts remain in
their original paths; this task does not erase those charges or limitations.

The owned root is `/tmp/maelstrom-select-hook-recovered-canonical-native-oct24`.
`ops/supervise.py` and `account.py` are retained here for recovery, with commands in
terminal receipts. To reproduce in a separately authorized task, restore these
ops scripts beside its isolated repo, use the standing inputs in place, take fresh
admission, and run the focused build/static/preflight/native drivers. One-shot
attempt receipts forbid unchanged replay in this task. Actual execution finished
before 2026-10-25 00:15 UTC. No box was assigned or queried; `bx_69aem736` is untouched,
state/expiry unqueried, lifecycle and shutdown remain coordinator-owned.

The task branch is `task/maelstrom-select-hook-recovered-canonical-native-oct24`.
External ops retain final publication/ref/blob seals, resource and cleanup receipts;
the append-only repository messageboard records the actual commit/remote branch.
Root tracked files/index/refs and all donors are readonly. Claude idle. Stop after
publication; independent review is next.
