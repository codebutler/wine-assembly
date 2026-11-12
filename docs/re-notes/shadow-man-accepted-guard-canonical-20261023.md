# Shadow Man accepted guard canonical invocation — blocked before compilation

Historical source last updated, 2026-10-23. Runtime and implementation claims below describe that dated source; see current app notes and source for subsequent changes.

The required unchanged, read-only donor helper `static-abi.py` (SHA256 `85f0e144d28167b8e5df2b305855e56b22218e113ef2cf4f394e7b3253e5797d`) extracts **268** storage-region records from the exact candidate mirror and hashes them to **`b0f1d4c2a339d18f`**. The mirror declares **`9a3bc9149d58209c`**. Its `assert layout==declared,(layout,declared)` would therefore fail before either output module is inspected. The mismatch was established by a read-only compatibility calculation, without executing the helper against a module or modifying its bytes or input.

The precise missing input is the source's named span `(region.declare-span $DIRECT_WINDOW (base 0x00000000) (end 0x08000000))`, which is not a storage-region record in the generated mirror. The compiler's layout-hash implementation explicitly includes spans. Adding `DIRECT_WINDOW:00000000:08000000` to the **diagnostic in-memory hash calculation only** yields the mirror's declared `9a3bc9149d58209c`. This diagnoses the helper's incomplete layout inventory; it does not qualify a module. The task explicitly requires stopping on incompatible helper/layout data, so neither helper repair nor an altered mirror, speculative build, or relaxed assertion was attempted. A separately authorized complete static inspector is the observable resume requirement.

The sole actual task invocation was:

```text
python3 /home/user/wine-assembly-shadow-man-accepted-guard-canonical-oct23/docs/re-notes/shadow-man-accepted-guard-canonical-20261023/recipe.py --run
exit 3
BLOCKED ('STATIC_HELPER_LAYOUT_INCOMPATIBLE', 'b0f1d4c2a339d18f', '9a3bc9149d58209c', 268)
```

It performed one consolidated pre-build admission, including exact closure, tool, guard, resource and helper compatibility checks. The attempt latch prohibits retry. Running the helper without `--run` prints usage and never compiles. Recipe AST parsing passed. No source staging, driver controls, native guard controls, backend, overlap checker, pinned native qualifier, binary ABI inspector, `WebAssembly.Module`, `Memory`, `Instance`, handler or guest execution occurred. There are **zero backend invocations and zero new module files**, rather than an actual compiler failure. The proposed, **unexecuted** backend argv is:

```text
/usr/local/bin/node --require /home/user/wine-assembly-shadow-man-native-bound-canonical-oct23/docs/re-notes/shadow-man-native-bound-canonical-20261023/native-module-bound.cjs tools/build-compile-wat.js
```

The accepted guard itself is **2,462 bytes**, SHA256 `47ce2e2b835be33eab6b2b24f027ecaab8ceb61c559890e51548c78199beb197`. Its exact retained and committed bytes were verified. Source review confirms the exact compiler uses a direct synchronous `new WebAssembly.Module(buf)` on the fixed Buffer emitted by `appendSection`; the pinned qualifier uses `new WebAssembly.Module(b)` on a fixed `fs.readFileSync` Buffer. No constructor capture or alternative native entry route is introduced at these call sites; the compiler VM does not receive WebAssembly. The byte-length guard applies before native construction, preserves arguments/options, and rejects unknown or dynamic storage. It is accepted for these audited synchronous sites, not as a hostile-code sandbox. Existing boundary and independent controls were reused, never replayed.

The donor's **140-file / 21,207,647-byte** compiler/postcheck closure was reused without scanner reconstruction or materialization. Each path's candidate blob identity, byte length and SHA256 was checked through read-only exact Git objects, including all 128 dynamically enumerated WAT/WATX files, four VM stages, compiler/closure/trampoline/layout-hash, original build script, postcompiler and generated mirror. Built-ins and separately identified installed tools/stdlib run in place; no installation or copy was made. The accepted 52-gate/decoder prefix was reused without replay. Standing diagnostic combined.wat was checked at **20,696,217 bytes**, SHA256 `68cdd92ea9f1702b1bf6c6f216fe2b725d4de11fe57a154bc035e5a81e07467b`; it is never a compiler input. The standing 1,817-byte qualifier was verified at SHA256 `4f8b0bbddac21abc821f7da77dc4d7a8573a81b15358a3ff75f173b40a862bdc`.
