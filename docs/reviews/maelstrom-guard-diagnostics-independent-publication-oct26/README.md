# Independent acceptance and conditional main publication

Verdict: ACCEPT, limited to the offline diagnostic repair
`1721032d2010c1de93abfe0a24878542cbcc6d80`, parent
`c6279bb936462834ccd9b51ea99a684a5befcda3`.

The exact original helper is SHA-256
`3ea873bc5c18283fc6045b55d00a2e957eaff46b4372534dd59fba18354a9f6f`;
the repaired helper is
`52d044f14d6ee129b2b6f5b81335f7d2c00b70a9f7513b7bd179203936150da8`.
All four source/test pins and all eleven committed candidate evidence files
were independently verified. The candidate's unchanged 24 groups and 511
completion combinations are reused from its committed manifest, checkpoint
and retained receipts. No canonical builds or 36 native groups were replayed.

Independent source review examined every added/removed predicate and its
control flow. Both generated storage variants match the original ordered AST
after removing only rejection-snapshot writes and expanding combined rejection
ORs into ordered rejection checks. The newly explicit return at the end of
the UOP-switch function has no following instruction. This normalization is
restricted to branches that only reject. The original boolean predicates,
order, mode eligibility, nonowner early returns, nested-return behavior,
direct-window mapper, capture writes and completion codes 1–9 remain intact.
The transform function is byte-identical. Exported source/native pins, anchor
maps, field lists and accepted completion reason map match exactly.

The independent behavioral suite passes nine groups and 510 original/repaired
comparisons. It reproduces unchanged status 5/event 0/reason 0, catches the same
reason-15 regression against unchanged bytes, then passes against repaired
bytes. It challenges unsigned nonboolean switch values through active and
terminal phases, stale select fields, owners and nonowners, nested frames,
first-reason/terminal immutability, direct-window and memory-page boundaries,
malformed/unknown/reason-0 adapter input, stale diagnostics and callback reentry.
Four meaningful mutations are killed: removing the terminal completion guard,
removing the CALL owner guard, changing the UOP rejection reason, and weakening
the direct-window upper bound. Tests validate the model's exercised arithmetic,
eager OR evaluation, offset stability and per-invocation returns. The harness
implements bounded zero-default linear-memory reads, avoiding a sparse-Map
artifact. This is source-AST execution, not compiled WebAssembly qualification.

The original candidate's new regression test and changes to the retained test
were reviewed. The explicit `--storage-only` route preserves the default full
pinned-transform/binary check. Its changed formerly-unknown reason-10 rejection
fixtures use 37, since 10 is now a defined guard code. Existing rejection
validation and completion precedence checks remain.

Retained `independent-harness.cjs` is the exact tested file. Replay by placing
it at `test/maelstrom-guard-independent-publication.test.cjs` in a sparse checkout
containing the candidate helper, adapter, select helper and select model. Recover
the original helper byte-exact with:

    git show c6279bb936462834ccd9b51ea99a684a5befcda3:tools/maelstrom-native-errno-latch.cjs > tools/independent-baseline.cjs
    node --max-old-space-size=16 test/maelstrom-guard-independent-publication.test.cjs

Run the retained `predicate-equivalence.cjs` from a sibling `ops/` directory
whose `../repo` names that checkout. Use the retained supervisor recipe:
CPU 90 seconds, wall 120 seconds, FSIZE 25165824, capture 131072, and Git-only
DATA 536870912. Node inherits unlimited DATA/AS; its 16 MiB old-space flag is
not a physical-process RSS cap. The startup receipt binds the actual executable,
flags, environment and inherited limits. Installed tools and immutable donors
are standing read-only inputs. All task-created bytes, evidence copies, Git,
session/launcher growth, positive DB growth, shared WAL/SHM once, future growth
once and 8 MiB reserve count toward the 67108864-byte allocation. Fresh resource
manifests gate checkout, execution, packing and pushes. Trusted dedicated Git
SSH identity/known-hosts configuration is unchanged; no credentials are retained.

Integration is a fast-forward through the exact candidate plus this review,
conditional on fresh remote main still being the accepted parent. Only review
evidence is added above the candidate. Merged-tree checks must verify exact
source/dependency blob hashes, both evidence manifests and the complete changed
path set; unchanged source behavior reuses the pinned passing receipts. Remote
task and main refs and their tree/ancestry relationship must be verified after
publication. The final publication receipt is retained in the task's `ops/`
and repository messageboard, since a commit cannot embed its own SHA.

Incidents retained: sparse checkout reported the unchanged absent toyvm bundle
blob already missing in the standing donor. Sparse tree creation uses exact
unchanged object identities and `write-tree --missing-ok`; no broad checkout or
ref dump occurs. Two independent harness fixture failures were corrected before
acceptance: zero-default mapped reads and explicit `offset=0` operand indexing.
Their first-failure output is retained. No diagnostic repair was made by this
reviewer. The candidate's earlier excerpt procedural overrun remains disclosed.
Initial review staging found its new directory absent from the local sparse
patterns; adding only that owned directory resolved the local staging error.
No platform or resource denial occurred.

Authentic original status 5/event 0/reason 0 cause remains UNKNOWN. The synthetic
UOP-switch reproducer does not establish that it caused the authentic rejection.
Authentic errno/caller remain UNKNOWN; originalGameAcceptance is false. Native,
guest and new build qualification remain separate runtime gates; they are not
necessary to establish this bounded source-only diagnostic change. No canonical
build, native/guest execution, box, SSH-to-box, service or public deployment was
attempted. Box `bx_vs4xtsz3` was supplied STOPPED, snapshot verified 10:11:30Z;
none is assigned and lifecycle remains coordinator-owned. Claude stays idle.
Local-only evidence commit `2dd81e1526b08b6bae78c1ca7cd588fcf2a52f3e` remains
blocked 221184 bytes over its allocation: no unchanged push retry or copying of
its old evidence occurred. Historical packing remains UNQUALIFIED. No workers
or successors were launched. Stop after publication or a concrete blocker.
