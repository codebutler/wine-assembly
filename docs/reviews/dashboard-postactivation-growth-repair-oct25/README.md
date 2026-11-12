Dashboard registry retention repair

Every snapshot formerly evicted and required lib/apps.js. Node retained each old module through readers.js module.children, including its exported registry. 48 synthetic refreshes retained 48 modules and 395846 export bytes; the same oracle retains zero after repair.

The reader now compiles a size-pinned, bounded source read into an isolated CommonJS module, with filename and relative dependency lookup preserved. It does not evict another consumer’s cache. Oversize input is reported through the existing registry warning. No global registry or session caps were removed. Existing UTF-16 clipping and byte-window goal readers are unchanged.

Regression coverage includes registry revisions, retained module/export counts, freshness and independent-cache identity, relative imports, growing and oversized source, thrown registry recovery, expanding session discovery, rotated/appended histories and obsolete asset removal. Existing bounded/UTF8/rotation/goal tests pass unchanged; 16 ordinary reader tests pass. Baseline fails 3 of 4 new cases; repaired passes 4 of 4; cap-removal control fails.

Run each test with NODE_OPTIONS=--max-old-space-size=128 and TMPDIR pointing to a task-owned directory, within 60 seconds. Commands and hashes are in evidence.json. Ordinary reader tests use the standing pngjs installation through NODE_PATH, not an acquired or copied package. Full HTTP/UI/runtime suites were not run.

Source branch only: no main integration or live activation. One allowed readonly process measurement saw PID1645265 RSS1275240KiB; the synthetic defect explains a growth mechanism but is not a measured decomposition of live RSS. Coordinator owns acceptance, activation and all testbox lifecycle; this task owns no box.
