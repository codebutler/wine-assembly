# Shadow Man static inspector technical review — 2026-10-23

Historical source last updated, 2026-10-23. Runtime and implementation claims below describe that dated source; see current app notes and source for subsequent changes.

Verdict: **ACCEPT_SCOPED_STATIC_INSPECTOR**. This independent Python-only run
accepts the corrected inspector at repair commit
`9ceffa0c7927431fc0ea575ee5ad2318f68e494c`, branch
`task/shadow-man-static-declaration-laws-repair-oct23`. All original 16 tests,
all new 14 tests, the unchanged rejecting probe, three independent negative
controls and retained-module static inspection executed successfully, exit 0. The candidate inspector and donor tests were not edited.

The helper is adjacent `static-abi.py`, 15587 bytes, SHA256
`2507d350af9a96cb7dea47ab03df36674f07bd89ecc6c740acd37b4fc85d1bd8`. Its canonical predecessor SHA256 is
`f7313b509c59cd6b01d51f9337b423d5e89c81e18df75ce233a9b308ce241cee`. The complete retained `helper.patch` was applied independently: all 13 hunks
matched exact old lines and both range counts; the resulting entire bytes
equal the candidate. Diff-format string equality was deliberately replaced
under the coordinator's explicit authorization. `input-verification.json`
and `verify-inputs.receipt.json` retain the proof and exact inputs.

Compiler standing input is
`/home/user/wine-assembly-shadow-man-span-static-canonical-oct23/tools/watx-src/compiler-codegen.js`,
302257 bytes, Git blob `71d05cb80f8d87d3d879d6b1d6329a5c5eeaca8c`,
SHA256 `84744dbdef3897f589f1c1465cc6d3025448250df09b1254369fdb16f73fa94d`. The excerpt is exactly inclusive lines **1759–1810, 1890–2006, 2161–2200**,
11191 bytes, SHA256
`9aee170db719a6bcc979c007091635f7c537f2e2333471cc9a0ee4b015c98b12`. The donor report's contiguous 1759–2006 description and predecessor verifier
assertion were incorrect metadata; the three-range selection matches the
retained bytes. The task-local correction changes no semantic tests or inputs. Historical reports and their failures remain untouched. The full verifier
and acceptance command sequence were reviewed before execution.

## Semantic review and executed controls

| Contract | Review and replay |
|---|---|
| Clause schema | Single operand for ordinary clauses; no operands for power law; exact `stride N (count N)` structure; duplicate, unknown and incomplete clauses reject. Span clauses remain restricted to base, extent and owner. |
| Stride/count | Literals or actual immutable i32 globals; both positive; exact Python product equals extent. No wrapping or floating-point approximation can accept an overflow alias. |
| Mask | Must name an immutable i32 global. Cardinality is count with stride, otherwise byte size; positive power-of-two cardinality; exact value cardinality minus one. |
| Power | Positive extent and exact power-of-two size. Zero rejects before the power check. |
| Placement | Original fixed/allocated/derived/source/mirror extent, alignment, containment and bounds checks retained; derived g2w requires pinned GUEST_BASE; gap/image-base overrides reject. |

`original16.receipt.json`: unchanged original test bytes, 16 tests, OK, exit 0. `new14.receipt.json`: unchanged donor law-test bytes, 14 tests, OK, exit 0,
including malformed syntax, positivity, product/overflow, globals, mask
cardinality/value, power, spoofing and all declaration heads.

`unchanged-rejecting-probe.receipt.json`: the probe from rejection
`b3d78c931cb50bd67da60aa58f6834f5df12d8fa` is byte-identical to its
retained original. CS_RING size 256 / stride 8 / count 64 now rejects with
`('stride/count size law', 'CS_RING', 8, 64, 256)`. Exit 0 means that the probe
confirmed this intended rejection.

`independent-controls.receipt.json`: reused and independently reviewed
predecessor controls first accept a matching derived-region/global fixture,
then reject three meaningful mutations: stride 4 × count 128 versus size 256;
mask 255 for count 128; exported syntax used for a law global. Each rejection
matches its intended law. These controls add derived-placement and global
cardinality coverage without changing source/mirror extents to manufacture
an unrelated failure. No further harness expansion was needed.

## Retained-module static result

`module-static.receipt.json` and `verify-results.receipt.json` both exit 0. `static-abi.json` equals the **entire old detailed parsed JSON**, including
every type, import/export signature, memory and custom-section record. `acceptance-results.json` records the explicit postconditions: 269 inventory
entries = 268 storage + DIRECT_WINDOW, complete serialization fingerprint
`9a3bc9149d58209c`, 291 imports, 2227 function exports, 172 types, exactly one
shared memory 8192..32768 pages, no start section and exactly one layout
custom section whose whole payload is the 16 ASCII fingerprint bytes.
