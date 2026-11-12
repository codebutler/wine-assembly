# Hock normal-toolbar launch and bounded gameplay accepted

Independent verdict: ACCEPT browser association `b000885e252d926919eee8bedc544bba601dc897`
and options fix `52c165ee0c6018f6691ac6497496c20225f8b05f`, with evidence
`6ccf7691291b3cd4257785b65c71cf01045b69d6`, against fresh origin/main
`71bc4a6d07387c18725da334983d25c6290fed40`. The task branch preserves all
three commits as ancestors. No other production change is introduced.

## Source review

Hock uses the original `game/BBLOOGIE.EXE`, the generated complete companion
manifest, `requiredFiles: true`, the local candidate registry, and the real
toolbar selector. The corpus association is local-only; no production route
or public deployment is added. The catalog requires the EXE, manifest and
every declared companion, rejects missing files and symlink substitutions,
and serves only registered paths. Original-package authenticity comes from
the pinned acquisition recipe and sealed identity evidence, not from catalog
availability alone. No original package, core, WAT or host changes are present.

`launchOpts = launchOpts ?? {}` at the public entry fixes omitted/null options
before dispatching to the inner loader. It preserves object identity and
explicit zero, including frozen objects. Toolbar and Start-again calls omit
options; catalog launch supplies intent/timing; ShellExecute/WinExec pass
hidden/showCmd; process spawning passes bypassSingleApp, beforeRun and onExit.
Those objects still pass through the existing immediate/queued/restart paths.
The PE loader receives the original showCmd; no truthy default is introduced.

## Independent checks

Commands and raw exits are retained in the adjacent evidence directory:

| Command | Exit / observation |
| --- | --- |
| `node test/test-browser-launch-options.js` | 0; 13 launch cases, 5 invalid startup commands reject |
| `node ../negative-controls.cjs omit-normalization test/test-browser-launch-options.js` | 1; reproduced undefined showCmd TypeError |
| `node ../negative-controls.cjs truthy-showcmd test/test-browser-launch-options.js` | 1; explicit showCmd 0 becomes 1 and assertion rejects |
| `node --test ops/emulator-server.test.js` | 0; 11 tests, including all 39 missing-file controls and private-path/symlink rejection |
| `node test/test-hock-a-loogie-local-registration.js` | 0; 11 metadata controls; retained-package extraction explicitly skipped locally |
| `node test/test-boot-cursor.js` | 0 |
| `node test/test-shell-execute-launch.js` | 1 on candidate AND exact-main sparse baseline, same line 182 assertion |
| `node --check lib/browser-shell.js`; `git diff --check 71bc4a6d HEAD` | 0 each |
| `python3 ../review.py` | 0; archive, source, seal, route and HTTP identity checks |

The line182 ShellExecute regex expects `launchVfsExe(..., params)` but exact
main already supplies `..., params, launchOpts)`. Host and that test are byte
identical between base and candidate. This is an existing source-assertion
mismatch, not a passing test or a new regression; no test was weakened/fixed.
The first catalog attempt lacked `ops/hosting/public-server` in this sparse
checkout; adding its tracked directory made all 11 tests pass. Both logs remain.

Reused exact-source WinExec full-VM, tier membership and canonical all-gates
receipts from the prior sealed archive; no duplicate compilation, acquisition,
repackaging or runtime replay. The reviewed delta changes no compile inputs.

## Evidence acceptance and limits

Verified repair archive SHA256
`25f97cff2c9f12bdfea9f4e9b97c450a4a08d7d2516baa5e867746c518834fdc`,
all **102 outer / 85 inner** seals, and the association archive's **43** seals.
Five changed source hashes and the new regression match the tested source.
The sealed identity script/receipt checks 7,252 unchanged tracked staging blobs,
44 intake seals, all 39 original files and each of 38 companions' bytes, size
and `c:\\filename` mapping. Independently cross-checked all 38 actual HTTP bundle
paths against the original seal names and the EXE/manifest/module responses:

- Canonical WASM `728e1de80ec20a284fc41b339895ee8ac29f16e4ded83325b27576cfacd4466c`.
- Original EXE `974f1b5ff82cfdb87f05b9840ae03cd2ed6ceebe2c8ed547253dadaf1a871ef4`.
- Manifest `d96cd2f9cd6f3ab559cc77afac6ba60be7389d3dd2353919ae52371f40e39362`.

Read the actual driver, events, requests, responses and console. It opens
`/emulator/?debug` without an app query, selects `hock_a_loogie`, and clicks
the actual Launch button. Its catalog URL is metadata, not the navigation.
All 113 events use normal browser input; no guest writes or direct commands.
Visually inspected the selected toolbar, original character-selection screen,
gameplay **0/20, time119**, and **10/20, time67**. Chrome151, 1100x850, ordinary
workers, private loopback; successful run elapsed76.851s. Prior toolbar failure
and two selection-only repaired runs remain distinct from that scoring run.

This closes TG103's original-game registration/normal browser launch and
bounded mouse gameplay requirement. Earlier explicit-EXE0→5 and registered
CLI startup evidence remain separate. No whole-game completion, persistence,
keyboard coverage, audio quality, FPS, exact collision/target or Windows parity
qualification. Missing comctl32/auxiliary HTTP warnings remain documented.

## Recovery and handoff

Task branch `task/hock-toolbar-independent-integrate-oct21`; local run
`scratch/runs/20261021-hock-toolbar-independent-integrate` contains review
scripts, controls, logs, copied inspected images, result/publication/RECOVERY.
Adjacent review evidence contains scripts and raw logs; existing source archives
retain the full runtime evidence and original recovery recipe, with no game
binaries in Git. Fetch the task/main commit, then verify the existing archives;
do not treat the sparse shared clone or ignored runtime assets as a backup.

Fresh main was reconciled before integration. A fetch initially hit inherited
alternate-ref enumeration (`bad object .alternate`); command-local
`git -c core.alternateRefsCommand='exit 0' fetch --no-tags origin main` succeeded
without changing shared configuration or bypassing object validation.
Normal non-force pushes and independent HTTPS ref checks are recorded in local
publication.json and the append-only messageboard.

No runtime access was needed. SAME `bx_egnm3u4y` remains coordinator-reported
RUNNING/idle/healthy at10:06UTC, expiry **10:44:02.530UTC**. No new runtime state
observation is claimed. No owned processes were started; handback before
**10:34UTC**, coordinator owns shutdown. No workers, refill, lifecycle action,
unrelated WIP/config/laptop/fleet edits or public deployment. Bounded task stops
after publication and verification.
