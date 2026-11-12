# POSITIONT guarded diagnostic build passed; COM baseline failed

Historical source last updated, 2026-10-23. Runtime and implementation claims below describe that dated source; see current app notes and source for subsequent changes.

**GUARDED_DIAGNOSTIC build exit 0; baseline exit 1.** The first unexpected failure
was `finite-RHW1e-39-honest-fallback: complete BGRA/depth oracle`, at fixture line
180. Execution stopped immediately; all three negative controls remain
**UNEXECUTED**. No repair, retry, source fix, pin refresh or normal module build
occurred. This is a real local native COM/software-pixel baseline failure, not a
resource-admission or build failure. Full COM qualification is **not accepted**.

The baseline had already passed nine shared-route/native software-pixel cases:
DP, INDEX16/INDEX32 DIP with positive and negative base, multi-stream stride/
offset, DPUP, and three depth comparisons. Their exact frame hashes and counters
are in baseline.log (historical artifact: `render-positiont-guarded-com-qualification-20261023/baseline.log`). The finite tiny-RHW fallback case then differed from its complete expected
BGRA frame. No root cause is asserted and no corrective investigation was run. Allocator-reuse/queue/final-release checks later in the fixture were not reached.

## Accepted guard review

Intrinsic brand/length getters ignore shadowed user properties; fixed views use
their precise view length. Unknown/proxy/spoofed and resizable/growable forms
fail closed. The guard checks <=8,388,608 bytes **before** Reflect.construct;
original source/view/offset/options/argument array/newTarget reach native code. The Proxy forwards static/prototype/call behavior and admitted native errors. Producer's six sealed small control groups were reused, including native DataView
rejection, cross-realm input, subclassing, errors and argument identity. This guards the audited synchronous call sites; it is not a hostile-code sandbox
against retrieval of other native entry points. Compiler VM stages emit bytes;
the builder's constructor runs in the preloaded Node realm.

The independent tiny control (historical artifact: `../../tools/positiont-guarded-independent-control.cjs`)
ran once after combined preflight: **exit 0**, 0.018s, 257 captured bytes, measured
child peak RSS 49,238,016 bytes. One valid eight-byte Module in an offset-7 view
passed. A tiny resizable backing with lying own byteLength/resizable properties
was rejected before a JS sentinel; removing the guard made that same oracle fail. No oversized native validation, Memory or Instance occurred in this control.

## Exact build, provenance and execution

Fixture is **`7aef3ff22f0dbe4fbfe739196bf92ad7a9435fb6`**, scoped offline acceptance
`aea185d3dfc1b772cea00ca1a4aed14b9553dfed`. The successful readiness commit
`54d701e9d7f5de8c9e8fc045864228e6d85db01f` and prior blocked diagnostic
`6fb1ce4b36b5463b100557a8299ad5d4a9cd2f51` were read-only donors. All 26 readiness
and 15 prior-diagnostic seals were reverified against files and exact commits. Accepted 52-prefix/decoder/27-control evidence was reused, never replayed.

Actual exact build argv, inside cwd
`/home/user/wine-assembly-render-positiont-guarded-com-qualification-oct23`:

```sh
/usr/bin/prlimit --cpu=900 --fsize=25165824 -- \
  /home/user/.nvm/versions/node/v24.18.1/bin/node --max-old-space-size=2048 \
  --require /home/user/wine-assembly-shadow-man-native-bound-canonical-oct23/docs/re-notes/shadow-man-native-bound-canonical-20261023/native-module-bound.cjs \
  test/support/positiont-com-module.js --build-diagnostic \
  build/positiont-com-diagnostic.wasm build/positiont-com-diagnostic.provenance.json
```

**Exit 0**, 2.946s, zero capture bytes. Guard preload is solely the authorized
constructor size restriction. Result:

Baseline actual argv:

```sh
/usr/bin/prlimit --cpu=150 --fsize=25165824 -- \
  /home/user/.nvm/versions/node/v24.18.1/bin/node --max-old-space-size=512 \
  --require /home/user/wine-assembly-shadow-man-native-bound-canonical-oct23/docs/re-notes/shadow-man-native-bound-canonical-20261023/native-module-bound.cjs \
  test/test-d3d9-positiont-com-qualification.js --qualify --allow-512m \
  --module=build/positiont-com-diagnostic.wasm \
  --provenance=build/positiont-com-diagnostic.provenance.json
```

**Exit 1**, 0.125s, 3,063 captured bytes, complete unexpected assertion retained. This used the fixture's explicit no-default-compile route, one shared
512 MiB/8192-page arena and one Instance in one fresh process. The process/group
was fully reaped, releasing the arena before task completion. No task-owned Node
process remained. The three same-argument commands with
`--negative-control=disable-shared-route`, `--negative-control=alias-queued-bytes`
and `--negative-control=corrupt-queued-ir` were **not run**. No matching ARMED or
intended exit-1 negative outcomes are claimed.

NODE_PATH stood at `/home/user/wine-dashboard-deps-20261014/node_modules`. Inherited NODE_OPTIONS, compile-cache/coverage/debug outputs and WINE_REGION_MAP/
SHAKE/compiler/name overrides were removed. Exact argv, limits, captures and exits
are adjacent `build.json`, `verify-provenance-pins.json`, `baseline.json` and logs. The one-shot driver (historical artifact: `../../tools/positiont-guarded-execute.py`) exited **2** on the
baseline failure; its attempt/result receipts prevent unchanged reruns.
