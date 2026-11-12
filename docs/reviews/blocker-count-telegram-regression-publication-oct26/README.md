# Blocker count Telegram regression and publication

Base main: 62b15e94e8898bc5d855392cf7ff639229177e7d. Recover only accepted four-file patch SHA256 d9c602cb579e974ae94276cd13ab657d019253c2fa92bed36c85b6da05dfed75; recovered tree 2cca38b8995e8ce231a6cbcde6d429e322f5990c. Preserve unrelated main fixes.

Only additional ops delta: telegram.test.js:60 expects explicit primary blocker rows / dependent rows. Exact numbers, ownership, authorization, read-only behavior, dependency rendering, hidden completed tasks, and review safeguards remain asserted. Distinct IDs versus rows remain covered by unchanged accepted model tests and adversarial receipts (77 distinct blocked IDs / 91 rows). No production semantics changed beyond accepted patch.

Reused exact-revision 10 implementation passes, 26 independent challenge cases and six merged task-status passes, preserved in adjacent retained review directory (review commit a7d148b414b61676f7d6aad801c8130effeb117b). No duplicate broad review. Affected mocked Telegram /blockers group: 2/2 PASS; new assertion syntax and whitespace PASS. See checkpoint.json for tested tree. Sparse wrapper reset incident and unchanged first failure are retained. No private fixture or task text committed.

Recovery: use this commit on the pinned base; run node --max-old-space-size=192 --test --test-name-pattern=^/blockers ops/telegram.test.js after admission. Live-browser and deployment gates remain open; no deployment, restart, browser or runtime performed. No assigned box; ID/state/expiry N/A, lifecycle ownership remains coordinator.
