# Historical quarantine 24 / 102 / 144 — bounded disposition, 2026-10-20

Historical source last updated, 2026-10-20. Runtime and implementation claims below describe that dated source; see current app notes and source for subsequent changes.

Current main `63d22caf879ca77d891d284f7926416a210136c2` already corrects the Caesar image. Preserve that correction. No metadata or original files were changed in this task. Missing original images and quarantine inventories prevent fresh byte verification or new exact associations for Collapse and Hitman. This is a documentary review, not a visual reinspection, game run, input/FPS test, current-build acceptance or completion of OPS-HISTORICAL-UNLINKED.

| Quarantine index | Reconciliation and confidence | Disposition |
| --- | --- | --- |
| 24 | The handoff rejects `generally` for `build/caesar3-gameplay.png`. Current main already publishes the exact source/original path as `caesar3_demo`, image SHA-256 `eca35577c263b49993122fc38f8a654d7fceb7d2742b6e6a4bdc3122035983d8`. The retained recovered copy was freshly rehashed and matches; the original is missing. | Already corrected; preserve existing metadata. |
| 102 | Handoff rejects `reflexive-crimsonland`; prior visual review reports Collapse! Crunch loading artwork. `docs/re-notes/reflexive.md:52` independently names `collapse-800.png` in the initial 35-second loading probe. Strong game-level documentary context, insufficient exact historical image/executable binding. | Keep exact association unresolved; no new manifest entry. |
| 144 | Handoff rejects `unreal-special-edition` and reports Hitman title/menu. The retained Hitman note does not name `hitman-software-check.png`. Exact edition, executable, original absolute path and image hash remain unknown. | Keep unresolved; do not borrow the separate Hitman demo image association. |

## Source-to-executable limits

For Caesar, `test/test-caesar3-gameplay.js:14,70–76` names `test/binaries/candidates/caesar-3-demo/installed/c3.exe`, selects `--app=caesar3_demo`, and takes its city screenshot destination from `CAESAR3_SCREENSHOT` or a temporary `city.png`. It does **not** hardcode `build/caesar3-gameplay.png`. `docs/re-notes/caesar3-demo.md:5–16,32–44` describes the installer-derived payload and this route. `lib/apps.js:7036` maps the same registered app to `c3.exe`. These support the existing route/executable identity but do not independently reproduce the historical output-path binding. The manifest last changed at `adf119ed6d8668ac762d254f45743fd4919ccd2a` (“Recover corpus screenshots across registry apps and historical artifacts”), already an ancestor of the reviewed main. Its retained transcript references were not opened. Neither duplicate recovery nor speculative metadata weakening is justified.

For Collapse, `docs/re-notes/reflexive.md:12–41` identifies the `reflexive-probe` acquisition root and the installed corpus copies. The current corpus candidate `reflexive-collapse-crunch` names `game/Collapse3.exe`; registered route `collapse_crunch` uses that fixture. The explicit reproduction command at note lines 289–294 launches `Collapse! Crunch/Collapse3.exe` but writes **`collapse-long.png`**, a different, black capture. Its documented executable hash `7f581e685db736239993efa843b145d085372c90c2d094f9fa4f1a3772947edb` is not a hash of row 102, nor was the executable rehashed here. The context suggests a useful recovery lead but cannot substitute for the missing row inventory/image/provenance. No later gameplay, input or FPS evidence is transferred to this initial loading screenshot.

For Hitman, `docs/re-notes/hitman-demo.md:1–5` and `lib/apps.js:6726–6735` describe the installer-derived `hitman_glide_demo` route and `launch-game/Hitman.Exe`. Current historical metadata has a **different** `hitman-fixed-world.png` entry, recorded SHA-256 `209cff04c97265cc4ea830864af874ce3674e67232201b71fc94425b13d30b9a`. Neither establishes the edition or renderer of `hitman-software-check.png`. No association is inferred from filename similarity.

## Missing evidence and stopping condition

Exact absent paths checked on this host:

- `/home/user/wine-assembly/scratch/ops-quarantine-review-20261002/inventory.json`
- `/home/user/wine-assembly/scratch/ops-quarantine-review-20261002/dispositions.json`
- `/home/user/wine-assembly/scratch/ops-quarantine-review-20261002/dispositions.md`
- `/home/user/wine-assembly/scratch/ops-quarantine-review-20261002/evidence-hashes.json`
- `/home/user/wine-assembly/scratch/ops-backfill/quarantine`
- `/home/user/wine-assembly/build/caesar3-gameplay.png`
- `collapse-800.png` (note-root/basename location; inventory unavailable)

The exact three quarantine bundle suffixes and original absolute Hitman path are unavailable because the inventory is missing. Only Hitman's basename is retained in the handoff; this report does not fabricate an absolute path or full image hashes for rows 102/144. Missing files here do not prove loss on the original laptop, whose ownership remains unchanged.
