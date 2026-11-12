# Independent Jedi installation acceptance — 2026-10-21

**Accepted:** the original SFX directory contract, ordinary licence acceptance,
28-file installation (39,900,850 bytes), installed launcher, and ordinary Play
transition to the original DirectX 5.0 requirement dialog. **No gameplay claim.**
The source/module under test were fe49a84e745015ecdbe752e028235924ef4324dc /
728e1de80ec20a284fc41b339895ee8ac29f16e4ded83325b27576cfacd4466c.

Reviewed exact revisions:

* Layout/install: 4f0844c013c46afd446428578d75f5ec8afca515,
  task/jedi-original-layout-install-oct21.
* Predicate/acquisition: 15cca1febd66e643283f28243946b98df8e9fa9e,
  task/jedi-directx-predicate-oct21.
* Alternate acquisition: bc301ce5f4e605ae26456f33e6403a8aa2a6fb35,
  task/jedi-original-alternate-recovery-oct21.

Independent review inspected the actual Setup Complete, launcher and DirectX
PNG images, installer and launch logs, copy/hash census, original decoder and
caller disassembly, encoded path records, and recovery recipes. The original
caller removes the configured source prefix, creates the remaining directory,
then extracts the ZIP basename; this supports WEBJEDI and its subdirectories,
including the distinction between outer JK1MPDEM and embedded jk1mpdemo.gob.
Setup Complete alone would not prove copying: the 28 original hash matches and
361 observed-tree mappings provide that evidence. The retained log finds both
DDRAW.DLL and DSOUND.DLL at 1024 bytes before the dialog; this is not proof of
absent drivers or of the failing version/API predicate.

Reused sealed exact-revision evidence; offline verifiers again passed 87 layout
seals / 361 mappings / 39 originals / 28 installed / 79 recorded VFS controls,
16 predicate seals, and five alternate-acquisition seals. These are historical
observations, not new guest or VFS execution. Native decoder's 43 comparisons
and canonical build are sealed prior results, not rerun here. `review.py`
checks every selected file against its exact Git/archive provenance, all mapping
paths, rejects an incorrect package without writes, restores tiny synthetic
source/original/payload mappings, rejects an existing destination, and rejects
corrupt payload bytes. No original package is available for fresh extraction,
CRC replay, full restore or runtime replay. This does not invalidate the sealed
historical installation. No production behavior changed or rebuild was needed.

## Recovery and evidence preservation

Selected reports are historical snapshots. Their RUNNING handoffs and
same-directory archive-verifier instructions describe the original task bundles.
This main integration contains only selected text, recipes and three screenshots.
No executable, decompressed segment, recovery payload binary or archive is added.
`provenance.json` maps each selected byte to Git or an original archive member.
Full sealed archives remain preserved at the exact task revisions above; do not
repackage them or confuse them with the absent original package.

For full offline verification, materialize `verify.py` and `evidence.tgz` from
the corresponding exact revision into a new scratch directory, then execute
`python3 verify.py` there. Layout archive SHA-256:
fea97ead7fe1b0f4f9bba0264d8073e5956857150dba2d97a2b1a4a62190f9cb.
Predicate archive SHA-256:
994e37183e275bb7222546a9f3d2af3a962f55f814be98db50fe4fb5c5bb4bf2.
Use `git show REV:docs/reviews/NAME-20261021/evidence.tgz` for recovery;
this needs no runtime or original download. The alternate verifier runs directly
in its selected directory. Run this review with `python3 review.py`.

Future original recovery requires jedidemo.exe, 21,195,858 bytes, SHA-256
8aae38165e08b68bb63cfd21b8c28ed1d4d8f1bb400a0162588d5b86acdc827e.
With that exact package and the preserved inventory:

1. Run `python3 recover-layout.py PACKAGE original-inventory.json NEW_SOURCE`.
   Then run the same command with `NEW_SOURCE --check`. This recovers the
   original distribution, not an installed tree.
2. Create a separate flat original-files directory from those 39 verified files:
   for each `layout-proof.json.files` row, take `NEW_SOURCE / output.lower()`,
   verify its size/hash against the inventory, and write it under `row.name`
   with that exact inventory spelling. Basenames are unique. Do not pass the
   nested lowercase source tree directly to `restore.py`.
3. Extract the hash-verified full layout evidence archive into EVIDENCE_DIR;
   use a source checkout at exact fe49a84e and the flat verified originals.
   Run `python3 restore.py EVIDENCE_DIR EXACT_SOURCE FLAT_ORIGINALS NEW_DEST`.
   It checks each observed mapping's size/SHA-256. Registry exports stay in
   the evidence's install1/launch2 directories; do not invent registry entries.

Run recipes with ordinary Python assertions enabled, trusted pinned manifests,
fresh destinations and sufficient storage on a coordinator-assigned environment.
Restore is not transactional: a later missing/corrupt input may leave a partial
destination, which must never be reported as a restored installation. No missing
originals are supplied by these recipes. This review did not perform those steps.

## Present task status

NEW-GAME-JEDI-KNIGHT-DEMO-20261015 remains incomplete. Ordinary guest licence
acceptance and installation are proven; engine handoff, gameplay, game input,
audio and FPS remain unqualified. DirectX predicate unknown; no localized defect
established. Current blocking prerequisite is exact original-byte recovery:
187 mappings have available source/payload inputs, 174 require originals.
Archive timeouts/HTTP500 and four alternate candidates produced no package;
that bounded failure does not establish that every possible source is unavailable.
The old saved-box resume403 is historical, not a current authorization ban.

The exact-main Jedi TODO section differs from the shared dirty WIP and still
describes unobserved acceptance/resume403. This focused tracked status supersedes
that Jedi section and historical STATUS statements without importing or committing
either root WIP file. Coordinator assignment is required for further work.

Coordinator local receipt records bx_wbedea9e snapshot-stop
stop_a31a541f37c3db32 completed at 2026-10-21T16:19:28.147Z, error null;
prior expiry was 18:01:57.547Z. It supersedes producer RUNNING handoffs.
This reviewer used no runtime API, box access, lifecycle action, workers,
downloads, packaging or builds. Lifecycle remains coordinator-owned.
