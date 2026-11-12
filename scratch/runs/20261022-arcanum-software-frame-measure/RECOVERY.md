# Recovery without a rebuild

Read REPORT.md and the sealed manifests first. `evidence.tar.gz` is the complete
raw record of both browser attempts, including all screenshots; verify its hash
before extraction. `raw/` contains extracted text records, and `captures/` the
images reviewed during routing and measurement. `verify.py` checks archive
members against exposed copies, sample deltas/attribution, and local seals.

The assigned box retains `/home/user/arcanum-software` in place. Coordinator
owns its lifecycle. This recipe authorizes no new launch or box operation.
Verify `pins.json` and `runner-dependencies.json` before any separately
authorized recovery. The runtime source is c26252c4, NOT task base/main849e57e73.

The canonical shipping module is recoverable from the existing main-host
`scratch/runs/20261022-mm-timer-canonical-qualification/qualification-artifacts.tar.gz`
(archive3e308c00, modulef644bbb2; complete hashes in REPORT.md). `prepare.py`
records source/module equivalence and fixture hashes. Git archive of the exact
source revision reconstructs the tracked source; fonts include five existing
generated stock FON files pinned in `font-supplement.json`. Preserve them from
the retained runtime or the existing main-host fonts; do not substitute or
rebuild silently. The fixture remains under the original installed local path.

For source reconstruction, inspect `source-manifest.json`, `pins.json`,
`font-supplement.json`, and the driver sources. The first historical transfer
omitted fonts; do not repeat that omission. `stage-fonts.py` documents the
one actual correction and its session preservation, not a generic replay
command. Transfer streams are bounded chunks through Boat exec, with receipts
and SHA-256 verification. They do not require SCP or local corpus archives.

The unchanged observer counts selected-layer visible compositor submissions.
Run its contracts and `arcanum-software-samples.test.js`; the measurement driver
requires an explicit short `phase: gate` before `phase: full` (20–30 seconds).
The raw historical control commands and reviewed screenshots are evidence of
the UI route, not a blind timing replay. No frames/4 conversion is permitted.
