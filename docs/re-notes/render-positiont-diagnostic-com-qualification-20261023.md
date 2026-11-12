# POSITIONT diagnostic build/COM qualification: BLOCKED before build

Historical source last updated, 2026-10-23. Runtime and implementation claims below describe that dated source; see current app notes and source for subsequent changes.

The first unresolved execution-admission requirement is a **pre-build upper
bound for the exact diagnostic module output**. Exact builder
`test/support/positiont-com-module.js` checks `bytes.length<=32*1024*1024`
only **after** `compileSrcWasm` returns. The task requires an established output
bound before compilation and finite **24 MiB** regular files. The supplied exact
fixture/readiness evidence contains no built diagnostic module or tighter
pre-build output bound. Thus output size is **unknown**, not proven oversized. The 32 MiB accepted maximum exceeds the file allowance by 8,388,608 bytes. Do not infer the actual output size from that maximum or from the 20,695,174-byte
combined WAT text. No failed build, production defect, or impossibility of a
tighter static bound has been demonstrated.

The bounded preflight (historical artifact: `../../tools/positiont-diagnostic-admission.py`) exited
**2**, `PREBUILD_DIAGNOSTIC_OUTPUT_BOUND_UNKNOWN`. Its receipt (historical artifact: `render-positiont-diagnostic-com-qualification-20261023/admission.json`)
short-circuits execution admission at that requirement. It is **not** a complete
transitive compiler/qualification closure, phased build admission, or runnable
reconstruction recipe. No compiler source closure was materialized. No compile,
native Module/Instance, 512 MiB arena, COM/allocator/software-pixel execution,
baseline, or negative control ran. Actual module and provenance hashes are null.

## Exact source and reused evidence

Candidate is `7aef3ff22f0dbe4fbfe739196bf92ad7a9435fb6`, standing fixture donor
`/home/user/wine-assembly-render-positiont-com-qualification-fixture-oct23`. Scoped offline acceptance remains user-supplied
`aea185d3dfc1b772cea00ca1a4aed14b9553dfed`, also recorded by the sealed readiness
report. This worker does not claim independent requalification of that acceptance.

The accepted **52 Node invocations, decoder result and 27 controls were reused**,
never rerun. Earlier failed recipes retain their failed/invalid scope. No baseline,
source hash, scanner package, generated file or production source was refreshed.

Exact inspected builder SHA-256 is
`b3efbbd167939a7048569c303165795b772544e111b6fb576d57773909ae72ba`. It appends `extraWat` only to `13-exports.wat`, passes `{tailCalls:true}` to
`test/compile-src.js`, and inherits `mode:'production', standardWat:true,
runtimeBuiltins:false, strictDeclarations:true` from `tools/watx-closure.js`. The unchanged compiler `BinaryWriter.ensure` dynamically doubles its buffer;
it supplies no 24 MiB output ceiling. The builder itself also executes
`validateExports(new WebAssembly.Module(bytes))` **before writing** the module. It is not a pure byte-emission operation. Nothing here authorizes invoking it
before the required heavy-phase serialization and memory admission.

The fixture's prebuilt route verifies provenance, required exports and sources,
then uses `bootRenderHarness({prebuiltModule:input.module,...})`. That branch
avoids the helper's default compile. Its local guest memory is one shared
8192-page/512 MiB arena. This was source inspection only. Complete transitive
JS/WAT/non-JS/dynamic qualification closure was not established after the
short-circuit; no complete runtime-resource acceptance is implied.

## Actual commands, exits and resources

The exact child argv is recorded by preflight-capture.json (historical artifact: `render-positiont-diagnostic-com-qualification-20261023/preflight-capture.json`):

```sh
/usr/bin/prlimit --cpu=600 --fsize=25165824 -- \
  /usr/bin/prlimit --as=536870912 --cpu=60 -- \
  /usr/bin/python3 \
  /home/user/wine-assembly-render-positiont-diagnostic-com-qualification-oct23/tools/positiont-diagnostic-admission.py
```

It was invoked through `run(argv, log, 60)` in
positiont-diagnostic-capture.py (historical artifact: `../../tools/positiont-diagnostic-capture.py`),
imported using Python `importlib.util.spec_from_file_location` as in the retained
launcher events. Effective preflight CPU limit is 60 seconds, wall 60 seconds,
virtual address space 512 MiB; the process exited in 0.228 seconds. Aggregate
stdout/stderr was **135 bytes**, bounded at 524,288 bytes. Regular files were
bounded at 25,165,824 bytes. Session/process-group leader was **PID 1778769**;
the supervisor fully reaped its group, with zero adopted residue. Peak Python
RSS was **153,960,448 bytes** (includes reading standing Node bytes for hashing). This is not compiler RSS or guest arena use.

The supervisor is the readiness supervisor copied as a task-owned 3,939-byte
tool and changed only from one-second to **five-second** TERM/KILL grace in its
two termination paths. It keeps subreaper ownership, aggregate capture overflow
failure and complete reaping. No overflow occurred here, so this task does not
claim a fresh forced-overflow/grace test. The inherited one-second readiness
controls retain their exact original scope.

ShadowMan session `01a16735-443f-7c91-8b79-bb5bc35976e0`, launcher PID 1767509,
owns its heavy phase. Its named `result.json` was present at the final preflight
sample, but this worker did not inspect handback or descendant termination and
did not wait/compile/instantiate. The earlier static blocker makes that wait
unnecessary for this stopped task. A future assignment must still verify handback,
process termination and fresh memory/disk before its heavy operation.

## Unexecuted commands and stopping condition

The authorized build was **UNEXECUTED**:

```sh
NODE_PATH=/home/user/wine-dashboard-deps-20261014/node_modules \
NODE_OPTIONS=--max-old-space-size=2048 \
node test/support/positiont-com-module.js --build-diagnostic \
  build/positiont-com-diagnostic.wasm build/positiont-com-diagnostic.provenance.json
```

The authorized baseline was **UNEXECUTED**:

```sh
NODE_PATH=/home/user/wine-dashboard-deps-20261014/node_modules \
NODE_OPTIONS=--max-old-space-size=512 \
node test/test-d3d9-positiont-com-qualification.js --qualify --allow-512m \
  --module=build/positiont-com-diagnostic.wasm \
  --provenance=build/positiont-com-diagnostic.provenance.json
```
