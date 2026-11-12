# Shadow Man zero-transfer canonical/native observations, 2026-10-23

Historical source last updated, 2026-10-23. Runtime and implementation claims below describe that dated source; see current app notes and source for subsequent changes.

The consolidated checkpoint (historical artifact: `shadow-man-zero-transfer-canonical-native-20261023/checkpoint.json`)
measured and verified all **3,126 files / 59,897,543 bytes** in the union of the
accepted complete mandatory-gate closure and complete production compiler
closure. Every candidate Git blob was resolved and its full bytes verified;
there are no missing inputs. This includes all 3,104 scanner inputs and the
127 ordered `main.watx` includes. The compressed exact manifest is retained as
`candidate-inputs.json.gz`. No source file was materialized or linked.

`bash tools/build.sh` retains its input files and emits the mandatory
`build/combined.wat`; its exact candidate output is **20,705,035 bytes**, SHA256
`a41d0bcadd03da05a7505825a43ece40c4c6c1ac47fe1d0c2558798ff21f1214`. The checkpoint derived these bytes in memory from the exact include sequence,
using the actual concat wrapper; it did not write that generated file. The canonical command contains no staged-input release operations. The old
phased prerequisite-only driver and its cleanup/release steps were not
substituted for the authorized complete command.

Build/native command limits and arena schedule are recorded but **not entered**:
build oldspace2048MiB CPU/wall900s; native oldspace512MiB CPU/wall150s with one
fixed512MiB arena and no workers; small JS oldspace256MiB/wall60s. The canonical
decoder's historical 44,302,336-byte arena is included separately in the serial
schedule; maximum planned aggregate live arena is 536,870,912 bytes with full
reap between commands. Actual owned live arenas: zero.

All executable native criteria remain pending: complete-module ABI/identity,
real invocation/ownership/run/dispatcher/decoded CACA0005 actual/named
match/mismatch, C3/C2, fused fast/slow POP/RET, modes0/1/2, unknown/inline/
deferred/reentrant/stale and no-false-attribution cases, before-mutation fields
and first-zero adjacency, attribution mutation rejection, prearm fsync, OS86,
returning-observer trap and unchanged required-order rejection. No extracted
fixture declarations were changed, no regression entrypoint ran, and no
producer/census hash was refreshed. There was no fixture work to discard.

Strict read-only remote reconciliation (historical artifact: `shadow-man-zero-transfer-canonical-native-20261023/remote-context.receipt.json`)
observed main `aa09d05dcd6acf80d8f506c1bef1a00a92869119`, source candidate
`2e6f5984d3f64d7781fb02da09bbb8d564302123` and independent review
`2b198a48305552ee84920f1d9d181cf26bb2ebfe` using dedicated SSH key/known-hosts,
BatchMode, StrictHostKeyChecking and GIT_NO_LAZY_FETCH. Main was not merged or
used as source.
