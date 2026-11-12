# Native COM owner-boundary acceptance — 2026-10-20

**Accepted for the exact old source/module below.** This report preserves
completed native evidence; publication did not rerun native tests, rebuild,
change source, access the runtime, or integrate main.

## Tested identities

| Identity | Value |
| --- | --- |
| Source commit | `ee139a0947c82e3a8eba4920508cb760d99882f5` |
| Module SHA-256 | `5e66c75862052b13b73f80bdcbcd67a1a65fd99d3e9e79d33f96548d00cc2a21` |
| Corrected fixture commit | `b71d343012d9e9b12c4ca283ab0740cd6d7427b7` |
| Fixture path at that commit | `test/test-com-native-owner-boundaries.js` |
| Fixture SHA-256 | `90ccff8a0be806a4ceaf04f7415a8ec451fc623b4008562bc78a28a8c7b9342e` |
| Execution environment | `bx_6czhvg6m`, Linux x64, Node `v24.18.1`, V8 `13.6.233.17-node.50` |

The original run verified 6,438 source identities before and after execution;
module and fixture remained unchanged. Its runtime lease was released at
`2026-10-20T14:31:57.198Z`, with the runtime left running until its assigned
`2026-10-20T15:53:12Z` TTL. This is historical evidence, not a current lease.

## Positive acceptance and actual controls

One corrected positive run exited 0: **126 completed x86 callbacks**, 126
public bridge rows, maximum live depth **63**, and **13 unchanged-state
rejections**. The callbacks comprise 63 AddRefs and 63 Releases through
public registration/revocation and real storage-to-COM-wrapper execution.
The ABI oracle checks guest `this`, return sentinel, EAX, EIP, yield and
`ret 4` cleanup before parent restoration. Rejections include stale slot,
stale epoch, and retired-child-against-sibling checks.

Three controls actually ran once each against that module:

| Control | Observed result |
| --- | --- |
| Public 64th-child overflow | Exit 0 for the expected rejection. Exported enter rejected the genuine public child with 63 children still live, zero completed callbacks and six unchanged-state rejection records. No synthetic unwind. |
| Bad return cleanup | Deepest AddRef deliberately used `ret 8`. Exit 1 at `native ret 4 cleanup before restore`; actual ESP 4292724 versus expected 4292720, callback index 62 at depth 63. |
| State-corruption sensitivity | After a genuine capacity trap, the observer deliberately changed EAX. Exit 1 at `rejected exported operation changed state`. This tests the oracle, not a production mutation. |

All four terminal receipts record absent process groups, no timeout, no
signal and no log-cap termination. Transport completion is separate from
the deliberately failing fixture exits.

The prior failed attempt remains preserved under
`scratch/runs/20261020-com-native-owner-boundaries/`; it is not acceptance.
Its extraneous region-map assertion was removed and its epoch-token oracle
tightened before these corrected runs. The earlier ten offline controls
remain prior evidence, not additional native executions.

## Verification and scope

Evidence root: `scratch/runs/20261020-com-native-after-recovery/`.
The coordinator independently ran its `verify.js` successfully, recorded on
the append-only board at `2026-10-20T14:40:20+00:00`: hashes, all 126 ABI rows,
13 preserved rejections and three controls passed. This publication reuses
that PASS and independently rechecks all 31 files in `SHA256SUMS.json`,
receipt/terminal acceptance fields, the fixture's Git identity and the
retained canonical module hash. No native test was repeated.

Unchanged-state checks cover the exported rejection: all 512 MiB shared
memory and the observed registers/control state and exported arena fields.
Storage cookie allocation precedes entry, so this does not promise that
the entire public registration attempt leaves state unchanged.

**No current-main qualification.** This does not independently observe
private invocation globals or `spill_desk_forced`, and does not qualify spill
pressure/reclamation, races, serial exhaustion, arbitrary abort/yield,
public activation, gameplay or nonlocal readiness. The report's base on
main does not extend the tested source identity.

## Recovery without archive duplication

Keep the existing ignored evidence in place. Git preserves this report and
its hash anchors, not the ignored module/archive; no archive is duplicated
by this task.

1. Recover the fixture from the pinned fixture commit/path above with an
   immutable `git show`, then check its SHA-256 before use. The evidence also
   retains the identical bytes at `recovered/fixture.js`.
2. Keep `receipt.json`, `SHA256SUMS.json`, `verify.js`, all four transport
   receipts, `postflight.json` and the `recovered/` tree together.
   `recovered/{positive,overflow}/result.json` contains success oracles;
   `recovered/{bad-ret,state-corruption}/failure.json` contains the expected
   failures. Each mode also retains `terminal.json` and `output.log`.
3. The existing `recover-transport.json` contains the encoded recovered
   files; `run.js` records their decoding into `recovered/`, original
   staging, bounded execution and recovery. Inspect these saved recipes
   before any recovery; running native modes requires a new assignment.
4. The canonical module, source manifest, source-staging receipt, environment
   and build log remain under
   `scratch/runs/20261020-js-com-native-run/recovered/canonical-build/`.
   The existing `scratch/runs/20261020-js-com-native-run/recovery.json.gz`
   is retained. Use its saved recovery machinery and immutable source
   identities; rebuilding is not evidence that the old binary was tested.
5. A later evidence-only check can run
   `node scratch/runs/20261020-com-native-after-recovery/verify.js`.
   It reads saved results and checks their hashes/oracles; it does not
   execute the native fixture. This publication did not repeat that check.

SHA-256 anchors (paths relative to the evidence root unless stated):

| Artifact | SHA-256 |
| --- | --- |
| `SHA256SUMS.json` | `45eeffdb427f744c3e01cad7344cc7cacb0ec973d899c72a5f2cf4bd2af29597` |
| `receipt.json` | `45780b36c0c3de15c214b482109ce1279e5c982ed8d41cfdca43eee3653c59b1` |
| `verify.js` | `53aac72378ef5f504d7dd10a82edbc52c01c9a16195d8732e6a061888ebc5530` |
| `recovered/positive/result.json` | `e789e1ad7e5db2278dd39e27a1ab33e4cb8e87684e60aa1729ac82d7d7cd1d6e` |
| `recovered/overflow/result.json` | `c5c7db7e57bf5f18307434375ce9e97ecb825c744807f82df3d5386ea9557ba6` |
| `recovered/bad-ret/failure.json` | `21449e431959e6bc582cb96bdfa79e06bc6934ca3d56cd6340655dd68bf360c6` |
| `recovered/state-corruption/failure.json` | `d9221a10feeefa2bafb9aa97e82034057656d71d0760eac42e67291e6e32b20c` |
| Earlier `canonical-build/source-manifest.json` | `e395129c92310dfe2043f7c62faa8a4f71ec8ba1e168f9c290fd4ba7ce7adc57` |
| Earlier `recovery.json.gz` | `e62bd6e27c56511a55f2d489aecb2ad9b23389033cf4009ffe51da24dfc2090a` |

The original receipt's null report commit and publication-cap blocker are
historical and remain unmodified. This later documentation task preserves
the accepted result separately; it does not rewrite the original receipt.
