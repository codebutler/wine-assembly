# Accepted normalized save collision repair integration

Integrates exact repair `ef3fdad258660c3b838e0836aff32b3ef4a4f8b3`, independent review `b4db7dc62304d30807e4126afe3494712163f11d`, and compatibility
tests `ab92eee9657299f60e9080835f9b75cd408fc403` onto trusted remote main `061461fb3e2bd088ccb6ec464ecbe958c83d46ca` (tree
`35d743e4569496ad3f30e678d4328c9747aed1fc`). The old candidate ancestor is
used only to identify accepted changes. Main is preserved as the direct parent.

The only production change is the byte-exact accepted `lib/save-bundle.js`
blob `b6bf55a0dd8750c75e3fab524841275fdca7e259`, SHA-256
`4ac22b490b0c201d5c4d7ee0047882522eeb4690d93b095e4eb755d84590f3ee`.
The main pre-repair blob matched the accepted ancestor. Validation sanitizes
ZIP member names before normalizing destinations, rejects repeated normalized
destinations before any import mutation, and uses that same normalized path
for validation and writes. Raw member names remain available.

All 77 accepted repair/review paths and 18 compatibility test/evidence paths
retain their exact accepted blobs. Main `lib/save-sync.js` stays blob
`3168327d3079b7552093384bbba89d44de75574d` (SHA-256
`87bc3878b4700b64f93a82f8920977677e9caeb2bbfcbecd1a572eb750d2dced`).
All other main entries, including Maelstrom, bounded file reader, host parser,
renderer and owned-upload fixes, are preserved. No presentation repair is added.

Merged source tree `a38b5617ff949012b48ca23f8a2f9f002e5518af` passed supplied 5/5, independent 9/9,
compatibility 9/9 with finite 35-second commands and Node heap limit 192 MiB.
The final commit adds this evidence directory only after that tested tree;
ops/result.json binds its exact final commit/tree and the docs-only relation.
Each suite checkpoint records the exact tests/source hashes. Original test
checkpoint main fields describe their historical fixture pins; this review
and tests.json identify the actual merged parent/tree. No test oracle changed.

The actual CLI text/JSON filename consumer shows normalized `.path`, retains
raw `.member` in JSON, and extracts with raw member spelling. The compatibility
suite also exercises local SaveSync push/pull/sync, caller Buffer ownership,
VirtualFS application, registry/INI state, mixed-case downloads, empty files,
empty bundles, and byte-identical legacy-writer round trips. Stores and HTTP
transport are injected in memory. Test source/dependency pins match accepted
sources and current main. Default storage backend is not executed.

All 72 independent acceptance payloads and 16 compatibility evidence payloads
were rehashed and preserved byte-exact. The unchanged pre-repair supplied
reproduction (2 pass/3 expected failures) and compatibility collision controls
(0 pass/2 expected failures) are reused; no changed dependencies require rerun.
The original independent Buffer/Uint8Array oracle incident and compatibility
fixture oracle incident (first 7 pass/1 fail, corrected `[0]` payload expectation)
remain in their original evidence directories and reviews. These were test
fixture issues, not additional production defects. Local setup/read incidents
are recorded separately in incidents.json.

No real save transport, server/browser durability, runtime, guest/gameplay,
canonical compile, deployment or restart was attempted or qualified. No box
is assigned (state/expiry not applicable); lifecycle stays coordinator-owned.
Root worktree/index/refs and donor repositories remain read-only. Publication
uses trusted SSH, exact remote verification, a current-main race check and a
normal fast-forward push, without force.
