# Independent recovered visual integrity acceptance — 2026-10-26

**ACCEPT** exact published candidate `a21b0561d97a35acc4a909ccdf9ec497cef23dfc`, based on source review and disposable synthetic fixtures through the public `recover(root)` API. No candidate source changes. This decision does not establish visual correctness, original module identity, runtime compatibility or gameplay.

Pinned candidate inputs:

| Path | SHA-256 |
| --- | --- |
| `ops/recover-visuals.js` | `c934e1ad0f59ae70976b643b5fae9eef6381d05cf1df856630eb245c3e279d57` |
| `test/recovered-visual-idempotence.test.js` | `64feb6a0af08d9e1e22953fc880e470e6ca80f2dc15b15e4486eaeccccba9cda` |
| `ops/historical-visuals.json` | `ee286db6b108cac15b85dcbe36d100bd5605807270306302b23a798df8f63b26` |

The supplied suite independently reproduced **52 candidate passes** and **33 baseline false successes**, using the unchanged importer from base `44e344fdb26daab9a07210656597902ba27cb5f7` (SHA-256 `4fa3b192370c939e9d5d6768e8aed24c17fce84c48a6a60b6fd37e936ca16b32`). The coordinator's 97-file package/hash audit is reused; it is not repeated or represented as new independent evidence.

The additional independent fixture covers **36 passing cases**: JSON primitive/array replacements; directory and dangling symlink file components; retained PNG changes; forged candidate, build and evidence claims; false gameplay outcomes; invalid build schema/association with original sources absent; partial paths; recursive JSON ordering and whitespace; and authentic baseline-generated historical bundle layouts with and without build evidence. Both legacy layouts retain the default historical association review. Existing bundles preserve their bytes, modification/change times and importedAt after source removal. Every independent rejection snapshots the whole fixture for nonmutation.

Five targeted source mutants were caught: omitted retained PNG hash validation, omitted provenance comparison, omitted result comparison, following a component symlink, and skipping build-schema validation when sources are unavailable. The first provenance mutant probe changed both candidate claims and remained rejected by the result check; its survivor log is retained. A narrower provenance-only evidence case then caught that mutant. This was an oracle refinement, not a candidate failure. Candidate checks already completed were reused; only the new case was added.

Source review confirms that a self-consistent forged result/provenance pair cannot replace the reviewed mapping: the retained image is independently hashed, provenance is compared to the mapping, and result is reconstructed from that mapping and the validated provenance timestamp. Build evidence retains capture-directory/sample identity validation even when the source files no longer exist. The associated historical hash remains a reported old association, with null commit and the original limitation. No original modules are recovered or freshly verified. Outcomes remain unknown and verification unreviewed.

Reproduction from this task branch (all fixtures stay disposable):

```sh
git show 44e344fdb26daab9a07210656597902ba27cb5f7:ops/recover-visuals.js > /tmp/recovered-baseline.cjs
node --max-old-space-size=256 test/recovered-visual-idempotence.test.js
node --max-old-space-size=256 test/recovered-visual-idempotence.test.js --baseline /tmp/recovered-baseline.cjs
node --max-old-space-size=256 test/recovered-visual-integrity-independent-accept-oct26.cjs --baseline /tmp/recovered-baseline.cjs
```

Focused mutant runs use the independent fixture's `--module /absolute/mutant.cjs --case NAME` arguments. Exact mutant bytes, hashes, commands and expected rejection failures are retained with local evidence under `/tmp/recovered-visual-integrity-independent-accept-oct26/ops/`; see `mutants.json`, `commands.jsonl`, the test-group checkpoints and `evidence-manifest.json`. `result.json` is written last after publication verification.

Limitations: reviewed mappings are trusted inputs; source review and synthetic fixtures do not re-review real images, prove current builds, cover concurrent attacker races, or promise transactional recovery across mappings. No real importer CLI, historical captures, acquisitions, runtime, build, shared source edits or main merge were used. No test box was assigned or touched; coordinator retains lifecycle ownership, and Native/Enigma, Claude and Heroes II/laptop lanes remain untouched.

Resource gates include owned checkout/Git/fixtures/evidence/session/launcher bytes, positive shared SQLite/WAL growth, future growth and an 8 MiB reserve inside 64 MiB. Preexisting donor stores and shared database/WAL identities are recorded separately without double charging. Each child has 60s CPU/wall, 256 MiB Node heap, 24 MiB file and 128 KiB combined output limits. Bootstrap inspection exceeded the 8 KiB excerpt limit; original events and the prior disclosed incident are retained, without retroactive compliance claims. No access denial or guard waiver occurred.
