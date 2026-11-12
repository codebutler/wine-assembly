# Independent Penguin shot-state review, 2026-10-24

**Accepted:** original candidate `129441a03836ff3265befffd49163b7fed932daa` proves the immediate shot count0→1 and effective cannon ammo10→9 described in the [scoped report](penguin-command-postloop-shot-acceptance-20261024.md). The independent review used raw trace bytes, original PE instructions, memory/register operands, exact argv, runner trace source and identity/terminal receipts. Artifact seals alone were not the acceptance oracle. No guest, build, browser or box operation was performed.

[Results](penguin-command-shot-state-independent-review-20261024/result.json) retain a pristine pass and five deliberate in-memory corruption rejections: wrong count, wrong ammo, wrong module hash, wrong trace range and wrong first trace entry. Original artifacts were never edited. The range probe changes both argv receipts together, so rejection is independent of receipt equality. State probes use semantic memory parsing rather than a fixed log digest.

Run the focused checker from the repository root:

```sh
python3 docs/re-notes/penguin-command-shot-state-independent-review-20261024/check.py
```

The checker verifies the four immediate states and all six entry identities, actual A40033/up40295 dispatch, the unchanged input schedule and allowed argument surface, module/runner/EXE identity consistency, the291-file rehash receipt, normal43000-batch completion and consistent untruncated successful API/terminal receipts. It explicitly retains the later ammo−1 and failed PNG limitation. No assertion turns those later effects into a broader gameplay claim.

[Exact bindings](penguin-command-shot-state-independent-review-20261024/exact-bindings.json) record independent full-file hashes of the immutable historical module and original EXE,36 disassembled instruction byte sequences independently extracted through the PE section table, and seven focused source excerpts checked against exact Git blob/full-file/excerpt hashes. Five current-runner excerpts establish trace parsing, register/flags/direct memory reads, immediate stream output and range arming; two historical export excerpts establish the matching trace hook. Prior accepted SDL/filter evidence was reused within its existing scope. [Original trace-source checkpoint](penguin-command-postloop-shot-acceptance-20261024/predecessor-static-checkpoint.json) retains its wider context. [File bindings](penguin-command-shot-state-independent-review-20261024/bindings.json) seal the selected evidence and checker/results for review on the integrated tree.

The module hash is historical b41a7c5f, **not current-main Wasm**. The optional PNGs failed EFBIG and provide **no visible projectile proof**. Later `406f40` entries are in the next routine and do not extend the immediate count/ammo finding. No production code, dashboard or playability status is changed. The selected evidence is Git-resolvable here; bulky history and incomplete PNGs remain linked by the original task commit. The coordinator owns box lifecycle; all assigned boxes were already reported stopped, and this reviewer allocated none.
