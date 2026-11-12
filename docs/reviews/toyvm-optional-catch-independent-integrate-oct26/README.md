# ToyVM optional catch: independent source acceptance

Accepted candidate `d7ed909ca5f3b1acf4d71fe90b48dce22b8d5c97`
(tree `7284315ade664b699bf94b5c452ef9f5d3c42832`) for its scoped literal
dependency lexer and the pending mouse/font/bundler chain. Main was reconciled
at `d9012a86a91c13dbe70dbcc4dceff2d7895c18a4`, an ancestor of the candidate.
The source change correctly treats an optional catch body as a statement block.
Closing it permits a regexp statement, while closing an enclosing function,
arrow, class or object expression retains division context.

The new independent fixture checks 38 valid, unexecuted source cases through
the actual dependency walker. Optional and bound catch, destructured bindings,
nested catch/finally, comments, template substitutions, enclosing expressions,
real default-binding imports and regexp/division transitions pass. The unchanged
rejected parent `5b80af999191fbb0779d2daa026dcc48fc210ebc` fails four of these
cases (34 pass), demonstrating that the fixture detects the repaired defect.
Genuine missing relative dependencies still reject with the missing-dependency
diagnostic. Injected source is syntax checked, never invoked.

Unchanged suites pass: adversarial 20, optional-catch repair 31, lexical 8 and 37,
mouse chords 16, font registries 4, lifecycle 36, required dependencies, supplied
mouse `--bundle --controls`, and chord repair. Regenerated bundles are byte
identical, with complete tracked dependency postorders of 44 main and 43 JIT
modules; both freshness checks pass. Additional source fixtures pass: live
`--input-only`, corpus 23/23, and generated site JavaScript identity. Original
oracles and accepted production source remain unchanged by this review.

The full pending diff contains the assigned source, fixture, generated bundle,
assessment and historical review files. Its mouse/frontend/held-key source
matches accepted closeout `cbcc67e0a`; prior exact-source held-key evidence is
reused because this assignment forbids VM construction. Historical rejection
reports remain as history and are superseded by the scoped successful tests.
No original-game/browser gameplay, VM, Wasm, compiler or deployment acceptance
is claimed. Unsupported escaped identifiers and ambiguous colon-brace/slash
syntax retain the documented fail-closed limitation; this is not a full parser.

Consolidated evidence is in
`/tmp/toyvm-optional-catch-independent-integrate-oct26/ops/`: `result.json`,
`evidence-manifest.json`, `publication.json`, `tests.json`, `controls.json`,
`chain-review.json`, admission receipts, logs and `incidents.json`. The final
receipt binds the exact tested commit/tree and verified remote task/main refs.
The complete source suite is rerun on the committed reconciled tree before
publication. Recovery uses that remote task branch and the coordinator's
standing flat object leaves with the recorded focused sparse manifest; no full
clone, recursive alternates or repack is required.

Resource incidents are retained, not retrospectively relabeled as compliant:
two checkout projections were rejected, and an early source test ran after a
resource assertion because of shell sequencing. Its 38 passes were rerun after
a passing gate. The focused manifest and future publication budget were then
narrowed within the unchanged 64 MiB allocation, including the 8 MiB reserve,
session/launcher, shared WAL/SHM and positive database growth accounting.

Run the independent fixture with:

```sh
NODE_OPTIONS=--max-old-space-size=128 node test/test-toyvm-catch-boundaries-independent-oct26.js
NODE_OPTIONS=--max-old-space-size=128 node test/test-toyvm-catch-boundaries-independent-oct26.js --builder-revision=5b80af999191fbb0779d2daa026dcc48fc210ebc
```

The second command must exit 1 with four failed inert-regexp cases.
