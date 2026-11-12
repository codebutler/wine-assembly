# Shadow Man declaration-law technical review: blocked (2026-10-23)

Historical source last updated, 2026-10-23. Runtime and implementation claims below describe that dated source; see current app notes and source for subsequent changes.

## Exact inputs and review completed

Compiler standing input is the canonical donor's
`tools/watx-src/compiler-codegen.js`, 302257 bytes, SHA256
`84744dbdef3897f589f1c1465cc6d3025448250df09b1254369fdb16f73fa94d`,
Git blob `71d05cb80f8d87d3d879d6b1d6329a5c5eeaca8c`. Canonical donor root:
`/home/user/wine-assembly-shadow-man-span-static-canonical-oct23`. The verifier checked compiler, mirror and build.sh bytes against the canonical
manifest and source-bindings entries, including Git blob hashes computed from
the actual bytes. Candidate remains
`b41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a`; source acceptance is
`4dab22cfefb7b7048fbb6189b81cdccdd4ab8753`. Mirror blob is `7f96dd1a81886946eb5fccefd5676c24e9016349`, SHA256
`1f1edfd8f13ef528434828243e8f1e37a059d2c4136dc7aaa1427b91e629e968`;
build.sh blob is `5407cb296ee6cdab2e30a226d1188206beb852af`, SHA256
`5ca2278e733bea26d8c261b993006424b845bc9328753d1b1506119e4608b5ef`. The read-only build compiler contract `tools/build-compile-wat.js` SHA256 is
`ef0833c055363f71f383eee1b2d285c3521d151e8a4048123c36ba920c5e6c87`. Neither compiler nor contract was executed.

Manual review read the whole helper delta, helper, retained schema/laws excerpt,
new 14-method suite, original 16-test suite and unchanged rejecting probe. Actual
compiler sections for heads, globals, extents and laws were read directly at the
correct standing path. The automated schema-excerpt equality assertion occurs
after the failed diff assertion and was **not reached**.

The delta introduces clause arity validation; module-level source-form selection;
immutable literal i32 global extraction; strict signed decimal/hex token parsing
within i32/u32 bounds; positive stride/count with exact Python multiplication;
mask cardinality from count when strided or byte size otherwise; positive
power-of-two slots and exact slots-minus-one value; and explicit positive extent
before size-power checks. It also pins the g2w prerequisite and rejects self
containment. Span handling, detailed source/binary ABI comparison and full payload
comparison remain visible in the helper. These are review observations, not a
passing independent acceptance result.

The compiler's early constant scan is looser than the inspector's structural
immutable-i32 requirement. The helper intentionally rejects referenced mutable,
computed, imported, malformed and unsupported exported-global forms rather than
trying to accept every compiler syntax. It is scoped to the pinned closure,
not a general WATX validator, macro expander or allocator replay.

## Checks not completed

| Required check | This worker's result |
|---|---|
| Original 16 Python tests | NOT RUN |
| New 14 Python test methods | NOT RUN |
| Unchanged CS_RING rejecting probe | NOT RUN |
| Independent derived-region controls | Authored and retained, NOT RUN |
| Same retained modules, Python static parse | NOT RUN |
| Exact detailed old JSON equality | NOT RUN |
| Complete inventory / ABI / custom payload | NOT independently revalidated |

The unchanged prior rejection probe requires size256/stride8/count64 to reject
because 8*64 != 256. Its missing mask global must not substitute for the intended
stride/count size-law rejection. Independent additional controls were prepared
for a derived region with named stride/count globals: mismatched product, wrong
byte-size mask despite valid count, and unsupported exported law-global syntax. They include a positive derived/global baseline but were never executed.

Combined input remains at
`/home/user/wine-assembly-shadow-man-complete-gate-data-readiness-oct23/build/combined.wat`. It was only hashed, never compiled. Required retained expectations remain
269 inventory entries (268 storage + DIRECT_WINDOW), fingerprint
`9a3bc9149d58209c`, 291 imports, 2227 function exports, 172 types,
one imported/exported shared memory 8192..32768, no start and exact full custom
payload. Native validation, native compilation, guest/runtime and gameplay
qualifications remain outside this task; retained binaries are not shown defective.
