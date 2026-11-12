# Candidate recovery status

October 18 metadata refresh: **136 candidates, 122 package recipes, 13 manual
preparations and one shared fixture**, with 19 output inventories and zero
malformed references. Manifest SHA256:
`f8a225650cd1f115a20c2eb89390a28545187bcd9601ac4872892712a6f3200f`.
The 13 manual IDs below are unchanged. Local summary receipt:
`scratch/recovery-audit-20261018.json`. This audit ran no downloads, installation
or game validation; inventory presence is not a fresh recovery receipt. The
following October 15 counts are historical, not the current total.

Snapshot including AVP2 and BG2 original-payload recovery, 2026-10-15. Refresh with `node tools/audit-candidate-recovery.js`; JSON identifies the manifest SHA256 and reports malformed package references.

135 candidates:121 package recipes,13 manual preparations,1 shared fixture (generally-track-editor uses generally). These counts describe metadata, not successful installed-game reconstruction or current source availability. They do not cover every registry entry or the separate DOS corpus. An output inventory file is not a fresh recovery receipt. All 18 current output inventories follow the candidate-ID filename convention so the audit can discover them, including the four GOG DOS packages. Audit reports zero malformed references; manifest SHA256 is `6570ac6636b1f40cc3b616347370caa432241fd3dc09326c7dfebfc964342496`.

## Completed bounded recovery work

BG2 now has seven pinned original source parts and tested REWise/cabinet
assembly. Fresh generic recovery matched all645 installed files; prepare and
cached reuse passed. Browser metadata excludes host sidecars, with644 support
entries and all645 original bytes verified unchanged on the retained fixture.
See `docs/bg2-generic-validation-20261015.json` and the BG2 re-note. This does
not claim new gameplay, audio or performance verification.

Forced refresh preserves the prior fixture until replacement preparation succeeds (14cc377a7). Publication uses two renames, so process-death/concurrent-writer recovery is still not guaranteed.

The DOS downloader now also stages and hash-checks downloads and extracts into a clean tree before publication. Download, hash, extraction or missing-executable failures preserve the previous archive and game tree; a failed publication attempts rollback and reports the retained backup path if rollback fails. Serialize recovery for each title: the two-renames operation is not crash-atomic. Successful `--force` replaces the complete tree, including local saves/modifications; copy those elsewhere first. Normal cached reuse still checks the archive and executable presence, not every companion file. Offline regressions use a synthetic ZIP and local HTTP, not guest-runtime qualification.

Fresh recoveries were verified and committed for .kkrieger,Sanity,Nocturne,Urban Chaos,Return Fire,Messiah,ThiefII,RageI,RageII,Outcast. Their source/hash/extraction evidence and limitations are in docs/re-notes and per-title output inventories where present. Urban Chaos config.ini and ThiefII DARKINST.CFG are explicitly reconstructed installer state. No new gameplay/audio/FPS or public deployment claim follows from acquisition.

## Remaining manual preparations

| Candidate | Concrete remaining work |
|---|---|
| dungeons-of-dredmor-release | Steam2 depot recovery is documented separately; requires original torrent/depot preparation and acquisition rights. Generic fetcher has no Steam2 pipeline. |
| starcraft-shareware | Original CCD/IMG preparation and installed-tree export remain manual; do not equate disc acquisition with installed game. |
| diablo-shareware | Pinned original ISO; installed output requires original AUTORUN.EXE guest installer and exported-tree verification. |
| moorhuhn-tennis | Pinned installer; original installer/wrapper must run and export projector/SWF/basepath. |
| moorhuhn-3-puzzles | Shares original Moorhuhn3 acquisition but each loader needs captured child-launch extraction. |
| best-of-moorhuhn | Pinned original ISO plus transient wrapper exports still needed. |
| reflexive-ricochet-xtreme | Existing external recovery tool pinned to615d946772e344e54ee3a7444d5f0010b68b79ac; original installers/source receipts and output hashes documented in docs/re-notes/reflexive.md. Not implemented by generic fetcher; no fresh external-tool recovery in this audit. |
| reflexive-zuma-deluxe | Existing external recovery tool pinned to615d946772e344e54ee3a7444d5f0010b68b79ac; original installers/source receipts and output hashes documented in docs/re-notes/reflexive.md. Not implemented by generic fetcher; no fresh external-tool recovery in this audit. |
| reflexive-crimsonland | Existing external recovery tool pinned to615d946772e344e54ee3a7444d5f0010b68b79ac; original installers/source receipts and output hashes documented in docs/re-notes/reflexive.md. Not implemented by generic fetcher; no fresh external-tool recovery in this audit. |
| reflexive-collapse-crunch | Existing external recovery tool pinned to615d946772e344e54ee3a7444d5f0010b68b79ac; original installers/source receipts and output hashes documented in docs/re-notes/reflexive.md. Not implemented by generic fetcher; no fresh external-tool recovery in this audit. |
| reflexive-alien-shooter | Existing external recovery tool pinned to615d946772e344e54ee3a7444d5f0010b68b79ac; original installers/source receipts and output hashes documented in docs/re-notes/reflexive.md. Not implemented by generic fetcher; no fresh external-tool recovery in this audit. |
| disciples2-demo | Pinned local Wise installer; complete installed-tree export and upstream provenance still needed. |
| beyond-good-evil-demo | Pinned local installer only; upstream URL absent. Preserve original settings registry and complete installation export. |

## Further scope

Ultima IV now recovers its complete 175-file installed payload from the existing
pinned GOG package, including original save templates. Fresh recovery and
byte comparison against independent extraction/restored files passed; see
`docs/re-notes/ultima4-gog.md`. Arena now recovers348 pinned original payload
files, but its older browser-preparation inventory additionally demands102
installer temporary files and70 files absent from the package. The canonical inventory now contains only those 348 original files, and
preparation migrates exact known metadata with backups while preserving saves;
unknown metadata is refused. Pristine and old-metadata preparation pass.
Browser gameplay/save-reload validation remains separate; exact removed
paths/hashes are recorded in the Arena recovery evidence. Daggerfall now recovers1623 original files with fresh
recipe, independent extraction and restored-file byte comparisons; its dedicated
browser metadata preparation remains distinct from generic acquisition.
Shadow Warrior now recovers181 original files, independently byte-compared,
including its original cue sheet, MODE2 media and audio tracks. Its native CD
runtime support remains separate from package recovery. These are separate
from the DOS downloader's existing ZIP recipes.

Audit existing package recipes for installer-only outputs, mutable-save separation and complete output inventories. The initial older-local-tree audit is not current-main completeness. Worms Armageddon already has an integrated complete recipe and fresh667-file recovery verification; the older audit missed it. Silver original media hashes and C:/SILVER plus D:/SILVER ZIP mounting are recovered in docs/re-notes/silver-demo.md, and silver-demo now reconstructs3147 original files and preserves the source ZIP. Dual-drive runtime mounting remains separate from acquisition; no browser/desktop qualification. Reconcile other registry-only fixtures separately. DOS GOG-derived installed trees,Comanche3 original-media provenance and Hornet discovery downloads require their own recovery contracts. Preserve permitted original packages/evidence outside Git; upstream mirrors cannot guarantee permanent availability. Boat SSH remains unavailable to the scoped key. On 2026-10-14, the documented and authorized Boat exec API was verified on a fresh separate test box, allowing clean builds and runtime validation. This resolves the transport blocker only; automated-review restrictions on specific diagnostics remain in force.

Gallinelle XXL now has a pinned original ZIP recipe: validate MODE2 Form1 sectors,
extract the ISO and original Game/Bonus cabinet groups. Four output files are
hash-pinned and independently compared; this is local recovery, not public
redistribution or new gameplay acceptance. MODE2 Form2, mixed sector modes and
mismatched XA subheaders are rejected instead of silently slicing wrong data.

AVP2 now has a tracked 18-file original cabinet inventory at
`test/candidate-corpus/avp2-demo-files.json`, verified against the recovered
payload. Its pinned ISO/cabinet recipe now passes fresh forced recovery with unshield1.5.1;
all18 output hashes match the retained original payload. The original launcher
still must produce its command file before the child launch can be validated. The inventory
excludes generated files and does not assert a complete launcher handoff.
