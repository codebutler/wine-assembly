# Shadow Man independent static acceptance: REJECT

Historical source last updated, 2026-10-23. Runtime and implementation claims below describe that dated source; see current app notes and source for subsequent changes.

The complete span serialization repair works for the pinned input, but the
requested independent rejection of invalid declarations is incomplete. The
inspector's `declarations()` accepts `stride`, `mask`, and `size-is-power-of-2`
clauses; `inventory()` never validates those laws. This is a supported form
already used in the pinned closure, not an exotic parser extension.

The minimal independent regression uses the pinned CS_RING declaration, with
stride changed from 4 to 8 while size stays 256 and count stays 64. The isolated
fixture mirror places it at aligned base 0x100. The compiler requires
`stride * count == size` and rejects 512 != 256. The inspector returns a valid
inventory and computed fingerprint `3d574b11c1c140e6`. The rejection assertion
therefore exits **1**, demonstrating the gap. See adjacent
`reject-invalid-stride.py`, `independent-rejecting-test.stdout/.json`,
`pinned-CS_RING.txt`, and `compiler-law-excerpt.txt`. Compiler semantics were read
from the exact manifest-bound `tools/watx-src/compiler-codegen.js`, especially
lines 1909–1921 and 2162–2197; no compiler was run.

The original **16 focused tests pass, exit 0**, 1.857 seconds. They include the
exact readonly candidate and reconstruct 268 storage placements plus DIRECT_WINDOW
as one span, yielding **9a3bc9149d58209c**. The old storage-only
b0f1d4c2a339d18f remains inadequate. Source fixed/derived bases, extents,
alignment, containment, duplicate/missing inventory and bounds are checked. The hash is computed from sorted `NAME:BASE:SIZE` uppercase eight-digit hex
records and a terminal newline, matching `tools/region-layout-hash.js:51–60`;
the mirror's declared hash is compared afterward, never substituted.

The derived-base equation uses GUEST_BASE + guest VA - 0x400000, agreeing with
the compiler default for this pinned closure, which contains no image-base
override. Do not generalize this parser to an overridden image base, arbitrary
WAT headers, or arbitrary WebAssembly validation. The explicit CLI arguments bind
the input-root mirror and both build outputs, combined source, and output evidence
directory. Combined SHA256 is fixed to
68cdd92ea9f1702b1bf6c6f216fe2b725d4de11fe57a154bc035e5a81e07467b. The recipe separately admits exact source/mirror blobs and staged pins; the helper
alone does not authenticate the root as a Git candidate.

The binary comparison retains full import and export signatures, not only names
or counts, with exactly one imported/exported shared memory (8192..32768 pages),
no start section and exactly one `wine-region-layout` custom section whose whole
payload must equal the derived 16-character fingerprint. Raw retained evidence
reports 291 imports, 2227 function exports, 172 types per binary and 269 placements. The independent parser is an ABI inspector, not a replacement for native binary
validation. Existing native qualification evidence is reused, not rerun.
