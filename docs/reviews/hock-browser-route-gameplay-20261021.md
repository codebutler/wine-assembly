# Hock browser association; normal selection blocked before PE load

Base: exact remote main `71bc4a6d07387c18725da334983d25c6290fed40`.
Task branch: `task/hock-browser-route-gameplay-oct21`. No main merge.

The missing association is implemented: local-only `hock_a_loogie` in
`lib/apps.js`, candidate `appIds`, and the toolbar's static selector option in
`index.html`. The app points to original `game/BBLOOGIE.EXE`, requires the
existing generated `.wine-assembly-browser.json`, and mounts its 38 companions.
The selector option is necessary because desktop clicks also assign the static
select's value. No server allowlist, emulator core, guest state, DLL substitute,
payload or public deployment change was made.

## Tests and original identity

All 11 `ops/emulator-server.test.js` tests pass locally and on the assigned box.
The new Hock test checks the exact registered EXE, manifest, candidate association,
local-only selector membership and real `buildCatalog`/`launchFor` URL. It serves
the closure through the actual HTTP handler, removes each of the 39 files in
turn and verifies unavailable/null route, checks missing manifest, rejects
unrelated private files and traversal, and rejects a companion symlink into
private data. Its synthetic bytes test metadata/access behavior only.
The existing gateway, path/manifest escape, range and build-pin tests also pass.
The existing Hock metadata test passes with its 11 rejection controls; its
optional extraction replay was not repeated. Syntax and `git diff --check` pass.

Actual remote originals are independently verified before/after: 44 intake
seals, 39 game files, 38 generated companion names/sizes/VFS paths. Original EXE
SHA256 `974f1b5ff82cfdb87f05b9840ae03cd2ed6ceebe2c8ed547253dadaf1a871ef4`;
outer archive `e10d150131258641af11609249ac7f1c430e67e4138943d175b0365ba64be00b`.
No download or extraction was needed.

Remote source was mapped from the accepted prior staging to exact main, after
saving its raw prior patch. All 7253 other tracked blobs match main, with exactly
four intended changed files matching local SHA256 seals. None is a compile
input. The prior all-gates canonical build is reused, not rebuilt:
`728e1de80ec20a284fc41b339895ee8ac29f16e4ded83325b27576cfacd4466c`.
Both browser runs captured that actual HTTP response hash (1,878,508 bytes).
Full changed-source hashes are in `identity-final.json`; initial and final
patches are preserved separately.

## Browser results and precise stopping condition

Only the assigned `bx_egnm3u4y` was used, through Boat API exec. The actual
`createEmulatorHandler` was bound to `127.0.0.1:18765`; Chrome
`151.0.7922.108`, headless, 1100x850, cross-origin isolated, normal worker mode.
No explicit-EXE browser bypass, state injection, mocked assets or replacement
launcher was used.

The initial three-file association probe used the actual catalog route:

```text
http://127.0.0.1:18765/emulator/?debug&app=hock_a_loogie&build=728e1de80ec20a284fc41b339895ee8ac29f16e4ded83325b27576cfacd4466c
```

It reached the original **Choose Beavis or Butt-head to start** screen.
The log records all 38 data files mounted; HTTP response hashes establish the
original EXE, generated manifest and canonical module. This is browser route
startup evidence only. It exposed the missing static toolbar option, added in
the final patch; no guest behavior changed between patches.

The final-source run opened `http://127.0.0.1:18765/emulator/?debug`, selected
the real `#app-select` option `hock_a_loogie`, and clicked the real Launch button.
It failed **before PE loading**:

```text
TypeError: Cannot read properties of undefined (reading 'showCmd')
  at launchAppInner (.../lib/browser-shell.js?v=dev:3471:29)
```

Exact unchanged source: `index.html`'s `launchApp()` calls `shell.launchApp()`
without options; `lib/browser-shell.js:2528` accepts `launchOpts` without a
default, passes it unchanged at line 2571, then dereferences
`launchOpts.showCmd` at line 3471. The catalog URL path supplies an options
object, explaining its successful startup. **This launcher prerequisite is the
first blocker; it was not repaired under this association-only assignment.**

The bounded driver completed naturally in 72.322 seconds and recorded 113
browser events, including the planned character click and mouse hold/releases.
Those later events encountered the fatal-launch UI: they are **not guest input
or gameplay evidence**. Its exit 0 means the capture completed, not that Hock
passed. The named `selection.png`, `started.png` and `final.png` in this second
run show the error, not those gameplay checkpoints. Actual state/console logs
and screenshot inspection determine the failure. No score, HUD progression,
FPS, completion, audio quality, persistence or Windows parity is accepted.
Prior explicit-EXE 0→5 evidence remains separate. Auxiliary build-info/auth/
favicon 404s are recorded; none is the observed `showCmd` exception.

## Evidence and handoff

Adjacent `hock-browser-route-gameplay-20261021-evidence.tgz` contains the raw
remote bundle (43 SHA256 seals), scripts, both source patches, original package
identity/recovery recipe, prior build log, network/console/state/input records,
route-startup and failure screenshots. Archive SHA256:
`167c7304e4189fb05e09806cae58fe94b06c01efa216ac46785922c34592ac0a`.
Extract into a new directory and verify `hock-browser-route-gameplay/SHA256SUMS.json`.
Local report/recovery/publication: `scratch/runs/20261021-hock-browser-route-gameplay`.
No ignored game binary is backed up by this Git commit.

Remote staging remains `/home/user/hock-registered-runtime/repo`, exact main
plus the final four-file patch. Raw evidence remains
`/home/user/hock-browser-route-gameplay`. Evidence was copied back before
09:38 UTC, well before the 10:34 preservation deadline. Browser and private
server closed normally; no owned browser/driver remains. Box **RUNNING**,
expiry **2026-10-21T10:44:02.530Z**; coordinator owns shutdown. No lifecycle,
workers, unrelated root WIP, laptop/fleet or public deployment actions.
Stop here pending independent review and a separately assigned launcher repair.
