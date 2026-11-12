# Shadow Man complete span inventory and guarded canonical static qualification

Historical source last updated, 2026-10-23. Runtime and implementation claims below describe that dated source; see current app notes and source for subsequent changes.

**GUARDED_MODULE_STATIC passed, exit 0.** One authentic production backend
invocation produced the primary/compat pair; overlaps, both pinned qualifiers and
the repaired independent full binary ABI/layout inspector passed. The inspector
repair passes 16 focused Python tests, including the exact candidate inventory:
268 storage placements plus one source-declared span produce `9a3bc9149d58209c`. The original donor helper, source, mirror and diagnostic combined WAT remain
unchanged. This is guarded static qualification, with no guest or Play claim.

The inspector streams every region declaration from the pinned complete source,
requires a complete storage mirror with unique names, validates sizes, pinned and
derived bases, alignment, containment and initial-memory bounds, and includes all
span base/extent records. It reproduces the compiler's sorted uppercase
`NAME:BASE:SIZE` lines and terminal newline before SHA256 truncation. No declared
hash substitution or special-case span line is used. For this pinned candidate,
derived g2w checks use the compiler's default image base 0x400000; no source image
base override exists. Its full ABI parser compares 291 imports and 2227 function
exports, preserving full signatures, memory limits, noStart and exactly one matching
layout custom section. All type records are retained in the resulting evidence.

The one-shot recipe is explicit (`recipe.py --run`); its default only prints usage. It reuses the exact 140-file/21,207,647-byte closure and accepted gate, decoder and
native guard controls. It stages no combined WAT and never compiles that diagnostic
file. The repaired helper takes explicit `--input-root`, `--combined` and
`--output-dir` arguments, avoiding donor-relative assumptions. Source candidate:
`b41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a`; source acceptance:
`4dab22cfefb7b7048fbb6189b81cdccdd4ab8753`.

The exact successful invocation from the isolated task root was:

```text
python3 docs/re-notes/shadow-man-span-static-canonical-20261023/recipe.py --run
# exit 0; GUARDED_MODULE_STATIC
/usr/local/bin/node --require /home/user/wine-assembly-shadow-man-native-bound-canonical-oct23/docs/re-notes/shadow-man-native-bound-canonical-20261023/native-module-bound.cjs tools/build-compile-wat.js
# backend exit 0, 5.006s, stdout326B/stderr0B
```

Environment removes inherited NODE_OPTIONS and WINE_REGION_SHAKE, then sets
`NODE_OPTIONS=--max-old-space-size=2048`, `WINE_WAT_COMPILER=watx`,
`WINE_WAT_NAMES=0`. The exact original build blob is
`5407cb296ee6cdab2e30a226d1188206beb852af`. Production, standardWat=true,
runtimeBuiltins=false, strictDeclarations=true, primary tailCalls=true and compat
false; no names, shake, legacy or extra WAT. The sole preload is the accepted
guard SHA256 `47ce2e2b835be33eab6b2b24f027ecaab8ceb61c559890e51548c78199beb197`. Guard source/boundary acceptance was reused from 9f442e41, 004eb539 and 80b28a50;
all 30+24+34 retained/committed seals and actual remote refs were checked. No
accepted native guard controls, 52 gates or decoder were replayed.

The driver enforces CPU/wall900s, regular-file24MiB, separate aggregate
stdout+stderr512KiB, TERM then KILL after5s, subreap and full group reap. Guarded
native Module entry is bounded to8MiB before entry. Old-space2048MiB is not an RSS
limit; observed cumulative maximum child RSS was421,146,624B. Small driver exit0,
split-stream aggregate524289B rejected with125 (child SIGTERM, retained524288B),
and file25165825B rejected with EFBIG/exit1. All groups reaped. Focused Python
tests/static parse use CPU/wall60s. No Memory or Instance was constructed.

Both ignored outputs are retained physically under this isolated task root:

Git preserves documentation, exact manifests, helper/driver/tests, deltas and
evidence; **Git does not back up ignored wasm**. `outputs.json` records the physical
retention paths. `recovery.md` explains exact blob reconstruction and the guarded
command contract for a future separately authorized recovery; the current
one-shot attempt latch must not be rerun. The standing20696217B combined WAT
remains SHA25668cdd92ea9f1702b1bf6c6f216fe2b725d4de11fe57a154bc035e5a81e07467b
and is only a diagnostic/static ABI source, never compiler input.
