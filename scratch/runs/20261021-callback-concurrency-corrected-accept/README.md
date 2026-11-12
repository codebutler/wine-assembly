# Independent corrected acceptance: ACCEPT

Accepted exact snapshot repair `2285cf3017e1a17fb7bb87f13e6e69ae3d841231`,
parent `f8f9785c99cf121cca22ca7c1560903a5e403005`, against fresh remote main
`bc53c1d1cbd1da82f44835cda31e193a52a63aa8`.
This acceptance supersedes the correction report's pending-acceptance status;
the shared publication.json records the eventual integration refs.

Reused review `4b0dbb5d25e9ac6710bd9ba822cac1000261ac0a` findings on exact
production extraction, distinct OS workers, release/completion barriers,
per-owner snapshots, allocator mutations and unit-tier convention. Its original
rejection artifacts remain unchanged. Read the repair report, tests,
verification, publication receipt and check-2.log; committed evidence matches
shared originals. The repair explicitly supersedes the original invalid
whole-memory preservation claims without discarding valid concurrency findings.

All three before snapshots now copy the Uint8Array into a Buffer. The alias
constructor is reachable only through the deliberately broken control. Each
control reaches the actual production comparison at overflow/mismatched leave,
stale owner or all-exhausted, after completion acknowledgements. Serial XOR 1
is asserted to change the header. The same deepStrictEqual executes before
fixture restoration in finally. Corrected controls must reject with the phase
label and deepStrictEqual AssertionError; alias controls must finish with the
same issued count. No separate mock comparison substitutes for these paths.

One independent focused replay passed: syntax, existing token regression,
corrected concurrency and full candidate diff whitespace check. Production
checks 2,035 unique roots/children, seven terminal allocations and 25 rejections.
Both unsafe allocator controls reject; all three preservation controls reject;
all three alias controls falsely accept the identical mutation. On each injected
failure, finally awaits termination of all four workers and checks threadId -1.
Measured cleanup was 2.50 / 2.71 / 5.05 ms, below 15 seconds. This qualifies
these three parent assertion failure paths, not every possible hang or failure.
Exact commands, timings and logs are in tests.json and check-*.log. No added
control or source correction was necessary.

Reviewed main-to-candidate diff: one focused test, two related notes (including
the census qualification link with its API lock retained), and repair evidence.
No production allocator/source, tier, API, SEH, jump-lock or unrelated changes.
The first review allowlist omitted the related census note and was corrected
after inspecting that small inherited diff; no test replay was needed.

Objects and parentage were checked before materialization in a fresh isolated
sparse task/callback-concurrency-corrected-accept-oct21 repository. Review commit
4b0dbb lives in the separate prior review repository and was verified there;
an initial lookup in the repair repository failed before any checkout/writes.
Admission records fresh free space 3,296,628,736 bytes, above the normal reserve
2,982,150,144 plus 64 MiB allocation, and 890,838 bytes projected files (<16 MiB).
New Git objects/evidence are charged to the 64 MiB task cap; existing objects
are read-only alternates. Protected shared files match admission hashes.

Scope: source-test qualification under one owner per slot and quiescent resets.
No Windows conformance, gameplay, API enablement, SEH or allocator-code claims.
No workers, builds, browser, games, downloads, boxes, resume, deploy, ledger
cleanup or root WIP imports. No box assigned; all boxes stopped per coordinator,
with lifecycle ownership unchanged. Original candidate checkout stayed read-only.
