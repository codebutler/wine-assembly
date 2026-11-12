# Recovery and ownership handoff

Read report.md: accepted 188 logical callbacks / 10708.68 ms = 17.5558518884 FPS,
authenticated slot1/internal tid1/exported2. The old106 wrong-owner samples are
rejected, not zero FPS. One browser session used; capture finished successfully.

Run `node verify.js` from this directory for offline seals/validator/controls.
Exact production source is Git b88c818ba3a071877e889e7cc779975a193591ce;
prior build/assets/66-test receipts are in prior remote evidence commit
56c92dc2abad4c2cbf1ca26ab0b85a5dfbde388f. No proprietary asset copy is bundled.
The retained source validator is byte-identical to the pinned Git object.

SAME bx_2ghgsv9d left RUNNING, idle/healthy, expiry14:01:16.889Z on2026-10-21.
Coordinator owns shutdown; do not stop/resume/replace it from this worker.
All owned browser/server/timer/listener resources cleaned and counter settings
restored. Remote /home/user/hype-browser-fps/repo retains exact staging;
counter-owner/ retains new raw artifacts. owner-capture.js is the executed
harness; owner-preflight.js checks staged bytes without rebuilding.
No local archives were materialized; individual remote files are sealed by
recovery-manifest.json. API exec/file routes only, private localhost8080.

Task branch task/hype-counter-owner-measure-oct21. publication.json records
commit and verified remote ref after push; main is not merged. Stop here.
