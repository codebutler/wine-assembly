# Focused integration recovery

Base remote main: 89f1e9d2c67aa94d56d2319115589d07204d42e0. Source chain ends
84f2a0165798f30d7a131dccdcc054a224fbf57b, canonical production c9681105.
Task branch: task/shadow-man-dsetup-qualified-integrate-oct22. Final integration
SHA and independently read actual remote main/task refs are in publication.json
and repository-root messageboard.txt; those operational files are not Git backup.

This is a small independent sparse Git repository, with read-only existing donor
object directories. No root/donor HEAD, index, config or alternates may change.
admission.json records all reused allocated paths and selected file manifest;
selected-manifest.json records exact source blob/SHA256/size pins. Some sparse
donors have materialized files but omit their Git blobs. Only matching Git blob
IDs authorize import into the OWN object database; never infer source identity
from a donor filename. No lazy or broad fetch is required or authorized here.
The complete base tree stays in the index. Never add sparse deletions or use
git add -A. source-paths.json identifies the exact 15 accepted source paths.

Ordinary git commit may reject a missing unchanged base blob while rebuilding
an edited directory tree (observed docs/re-notes/README.md blob
45b71ca3e1bbd663e413fa9932880d092c9a3900). After validating every changed blob
is locally present and all other index entries equal the published base, use
git write-tree --missing-ok, compare that complete tree against the verified
index, then git commit-tree with the exact reviewed main parent and update only
the own task ref. This preserves existing published blob identities without
materializing or fetching unrelated content. It changes no build/test gate.
Push still sends all newly referenced objects and must pass remote validation.
The raw reviewed-source.diff deliberately preserves diff context-space lines;
run whitespace checks on all other staged paths and verify the raw diff against
its source commits instead of rewriting that evidence.

Verification from this checkout:

```sh
GIT_NO_LAZY_FETCH=1 PYTHONDONTWRITEBYTECODE=1 python3 scratch/runs/20261022-shadow-man-dsetup-qualified-integrate/verify.py
```

It validates the staged index (equal to HEAD after commit), all 3,426 qualified
closure inputs, evidence commit associations, source chain, protected metadata,
four original pins through reused verifiers, fresh cheap integration checks,
and whole-local 64 MiB admission including 8 MiB reserve/host free floor. It
replays six offline verifiers while redirecting their output writes into own
replayed/; it never runs the earlier source-fixture verifier, builds WAT/Wasm,
instantiates a module or accesses runtime. Published replay outputs represent
historic run status at their own time; older running-box handbacks are superseded
by the coordinator's stop receipts. Resource measurements can change on replay.

Exact seven evidence commits and immutable local report/verifier paths are in
the durable qualification note and acceptance-associations.json. Recover reports
from those exact remote task refs on an appropriately authorized host if donors
are unavailable; do not substitute unrelated tips or merge entire evidence trees.
The census REVIEW.md is copied verbatim at its referenced path so the integrated
manifest's explanations remain resolvable.

Original 4-file readonly receipt:
/home/user/wine-assembly/scratch/usage-watch/shadow-man-dsetup-native-input-oct22/receipt.json.
Its binaries are not committed. The accepted canonical build and 51 cheap gates
belong to fixture evidence444c4440, exact source c9681105. Canonical modules and
raw native execution remain in coordinator-owned stopped bx_f3gs8qm2 snapshot,
root /home/user/shadow-man-dsetup-canonical-qualification-oct22. Build inputs,
commands, source modes/hashes, compiler/tool provenance and recovery recipes are
retained in the exact evidence commits. No rebuild, download, repack, runtime
recovery or lifecycle action is part of this task or this offline verification.

Publication: review staged diff and relevant checks; commit only accepted source,
necessary documentation and this focused evidence. Push the task branch without
force and verify its actual canonical HTTPS SHA. Re-read actual remote main and
require it still equals the reviewed base; then fast-forward main to the tested
integration commit and push without force. If main materially changes, reconcile
only scoped conflicts or report a precise blocker. Verify actual remote main and
task SHA again, preserve final receipt, and append board via echo >> then tail.
