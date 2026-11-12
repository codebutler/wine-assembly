# Shadow Man canonical module admission — BLOCKED before staging

Historical source last updated, 2026-10-23. Runtime and implementation claims below describe that dated source; see current app notes and source for subsequent changes.

## First precise blocker

The exact `tools/build-compile-wat.js` constructs two synchronous `WebAssembly.Module(buf)` objects **before writing either artifact**, without checking their byte lengths. The task permits these operations only for modules at most 8 MiB. A filesystem limit cannot constrain those in-memory buffers. Source modifications and behavioral preloads are forbidden.

Installed Node v24.18.1 advertises `--wasm-max-module-size`. The proposed command therefore included `--wasm-max-module-size=8388608` as an engine guard, retaining the exact candidate script and options. Before staging, a small control tested the same flag at eight bytes. The first control was malformed: its ten-byte custom section lacked the required name-length byte. It failed with `CompileError: reached end while decoding length @+10`, which proves no size enforcement. That evidence is preserved.

Observable resume condition: a separately assigned task supplies an independently proven bound on synchronous native validation, or a static exact-candidate emitted-size proof establishing each buffer is at most 8 MiB before validation. Any change to the authentic backend or preload restriction requires separate coordinator authorization. Merely measuring artifact files after this backend returns would not resolve the ordering problem.

## Combined preflight and exact inputs

The adjacent `manifest.json` identifies **140 exact files / 21,207,647 bytes**, each with candidate Git blob, SHA256 and bytes. All were available through read-only Git object access and were independently checked before potential staging. This includes all **128** top-level WAT/WATX files discovered by the compiler's directory read: `main.watx` and its 127 included fragments. The compiler closure is `build-compile-wat.js`, `watx-closure.js`, `watx.js`, four dynamically VM-loaded vendored compiler stages, `region-layout-hash.js`, and `dispatch-trampoline.js`. Postcompile `wasm-data.js`, exact `build.sh`, and the generated layout mirror are also pinned. The layout-hash module's `region-layout.js` dependency is inside its uncalled helper/CLI path; build calls only `layoutHash` and `appendSection`. No external npm package or non-source data is consumed by this active compiler path. Qualifier dependencies are Node built-ins.

The original build script blob is `5407cb296ee6cdab2e30a226d1188206beb852af`; its unique boundary is `node tools/build-compile-wat.js`. Proposed compiler settings remained mode=production, standardWat=true, runtimeBuiltins=false, strictDeclarations=true, primary tailCalls=true / compat=false, no names/shake/legacy/extraWat. Only one authentic script invocation was planned for the pair; **zero** occurred.

Accepted source review `4dab22cfefb7b7048fbb6189b81cdccdd4ab8753` and prerequisite evidence at `3c1bfd31b6054bdb3910b8049f20db626167ca36` are reused. The successful actual 52-Node prefix was not replayed, nor was its decoder. This task independently checked the donor result exit 0 and compared retained diagnostic `combined.wat` against all 127 exact fragments plus wrapper: **20,696,217 bytes**, SHA256 `68cdd92ea9f1702b1bf6c6f216fe2b725d4de11fe57a154bc035e5a81e07467b`. It remains read-only at `/home/user/wine-assembly-shadow-man-complete-gate-data-readiness-oct23/build/combined.wat`, never a compiler input or task copy.
