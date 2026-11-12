Recover from task/save-bundle-collision-retained-integrate-oct26 in a focused
sparse checkout. Include paths in source-pins.json plus the three test files,
test/evidence/save-bundle-independent-oct26/ and docs/save-sync-normalized-destination-oct26/.
Run tests.json commands with Node --max-old-space-size=192 and timeout 35s.
Independent suite needs SAVE_ACCEPT_BASELINE pointing to exact pre-repair main
lib/save-bundle.js SHA-256 3683e564797c1df2c4e9e335b7eb2fca5edcf7e5f440f125bdadbcc846f5f848.
SAVE_ACCEPT_EVIDENCE and SAVE_SYNC_EVIDENCE must point to owned output directories.
No dependency installation, full checkout, guest, wasm arena or network is needed.
The source tree tested before documentation and the final commit tree are bound
in sibling ops/result.json. Verify evidence-manifest.json and historical manifests.
Ops setup/test/review/publication scripts retain focused object recovery, exact
trusted SSH configuration and resource admission. Borrow flat immutable leaves;
recover only missing pinned objects, never fetch entire history. No ignored
binary or run output is the sole copy of important test evidence.
