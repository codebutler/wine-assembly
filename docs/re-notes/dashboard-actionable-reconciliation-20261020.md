# Dashboard actionable reconciliation — 2026-10-20

Bounded ledger correction against fetched origin/main `6ccd344268a34232583ed5895bd79eb134f04fe3`. No runtime, build, browser, guest, box or public deployment. The shared ledger contains unrelated WIP; only exact fields of the following twelve IDs are changed, plus a dated STATUS summary. Existing Done criteria and checkbox history are preserved; explicit status takes precedence.

## Parser evidence

`ops/readers.js` parseTasks and its exact clip/date helpers were evaluated locally without service imports. The literal pending predicate from `ops/app.js` was evaluated against the complete parsed task set (including dependencies). `queued` is not a supported explicit status and falls back to the checkbox; prose about pending work is not a blocker. No dashboard code change is needed.

Within the requested twelve: before=12 actionable; after=4 actionable (listed below), 8 blocked. This is not a count of every backlog task. The umbrella rows remain active because source prerequisites are actively assigned; they are not complete. Runtime-dependent phases do not make all work blocked.

## Per-task dependency evidence

### NEW-GAMES-PIPELINE

- State: active; worker: coordinator (remaining callback source assignments).
- Next/dependencies: RichEdit edit_stream_call source3c01665c was delivered by edit-stream-owner-oct20; fullVM is pending. Remaining callback/JS/concurrency/SEH source prerequisites need coordinator assignment. Circus ICM source066436de and native fixture1bae355 await fullVM; Mad Bomber wave API7fd352855 reviewedfe540cf2 awaits fullVM. Keep child gameplay criteria open; runtime403 blocks captures, not remaining source work.
- Source work remains actionable; later runtime acceptance requires restored authorized access.

### GLD3D-CORPUS-27-20261006

- State: active; worker: legacy-texture-rest-oct20.
- Next/dependencies: Surface4/7 ABI is merged. legacy-texture-rest-oct20 owns remaining noncube capability contracts. Cube advertisement correctionf856627 is off main pending fullVM, not cube storage support. Hype validator is main6ccd344268 but actual FPS capture is pending. Historical27 membership and software/WebGL gameplay coverage remain incomplete; exact local path checks are in docs/re-notes/dashboard-actionable-reconciliation-20261020.md.
- Source work remains actionable; later runtime acceptance requires restored authorized access.

### NEW-GAME-RETURN-FIRE-DEMO-20261009

- State: blocked; worker: none (capture recovery needed).
- Next/dependencies: Recover original2046native/2050browser build/input/screenshots before renewed review. Registration/palette/media recovery are on main. Audio/FPS are separate from Done; exact locally absent capture directories are recorded in docs/re-notes/dashboard-actionable-reconciliation-20261020.md.
- Blocker: Original scratch/runs/20261009T2046Z-return-fire-realized-native and scratch/runs/20261009T2050Z-return-fire-realized-browser are absent locally; recovery source availability is unknown, no remote probe.

### NEW-GAME-AOE3-DEMO-20261010

- State: blocked; worker: none (awaiting authorized runtime and verified original closure).
- Next/dependencies: Ordinary Accept/Yes authorization persists from20261018; acceptedInGuest=false until observed. Recover/verify original installer, supporting assets and historical receipt, then use an authorized bounded runtime to observe acceptance and installed payload. Local exact-path observations and unknown remote availability are in docs/re-notes/dashboard-actionable-reconciliation-20261020.md.
- Blocker: Existing sandbox.resume 403 api_key_action_forbidden; requires documented authorized runtime access change and coordinator allocation, not a retry.

### NEW-GAME-CONAN-DEMO-20261010

- State: blocked; worker: none (awaiting authorized runtime and verified original closure).
- Next/dependencies: Ordinary Accept/Yes authorization persists from20261018; acceptedInGuest=false until observed. Recover/verify original installer, supporting assets and historical receipt, then use an authorized bounded runtime to observe acceptance and installed payload. Local exact-path observations and unknown remote availability are in docs/re-notes/dashboard-actionable-reconciliation-20261020.md.
- Blocker: Existing sandbox.resume 403 api_key_action_forbidden; requires documented authorized runtime access change and coordinator allocation, not a retry.

### NEW-GAME-ARANNA-DEMO-20261010

- State: blocked; worker: none (awaiting authorized runtime and verified original closure).
- Next/dependencies: Ordinary Accept/Yes authorization persists from20261018; acceptedInGuest=false until observed. Recover/verify original installer, supporting assets and historical receipt, then use an authorized bounded runtime to observe acceptance and installed payload. Local exact-path observations and unknown remote availability are in docs/re-notes/dashboard-actionable-reconciliation-20261020.md.
- Blocker: Existing sandbox.resume 403 api_key_action_forbidden; requires documented authorized runtime access change and coordinator allocation, not a retry.

### NEW-GAME-SHADOW-MAN-DEMO-20261013

- State: blocked; worker: none (awaiting authorized runtime and verified original closure).
- Next/dependencies: Ordinary Accept/Yes authorization persists from20261018; acceptedInGuest=false until observed. Recover/verify original installer, supporting assets and historical receipt, then use an authorized bounded runtime to observe acceptance and installed payload. Local exact-path observations and unknown remote availability are in docs/re-notes/dashboard-actionable-reconciliation-20261020.md.
- Blocker: Existing sandbox.resume 403 api_key_action_forbidden; requires documented authorized runtime access change and coordinator allocation, not a retry.

### D3D-LEGACY-TEXTURE-CAPS-AUDIT-20261013

- State: active; worker: legacy-texture-rest-oct20.
- Next/dependencies: legacy-texture-rest-oct20 owns remaining caps audit excluding cube. f856627 clears unsupported CUBEMAP only, source115checks+4mutations PASS, off main pending exact-source normalbuild/public COM and rejection tests. Surface4/7 ABI is already merged. No independent-face storage or backend/gameplay qualification claimed.
- Source work remains actionable; later runtime acceptance requires restored authorized access.

### NEW-GAME-JEDI-KNIGHT-DEMO-20261015

- State: blocked; worker: none (awaiting authorized runtime and verified original closure).
- Next/dependencies: Ordinary Accept/Yes authorization persists from20261018; acceptedInGuest=false until observed. Recover/verify original installer, supporting assets and historical receipt, then use an authorized bounded runtime to observe acceptance and installed payload. Local exact-path observations and unknown remote availability are in docs/re-notes/dashboard-actionable-reconciliation-20261020.md.
- Blocker: Existing sandbox.resume 403 api_key_action_forbidden; requires documented authorized runtime access change and coordinator allocation, not a retry.

### NEW-GAME-CIRCUS-LINUX-20261018

- State: active; worker: none (RichEdit source delivered; remaining prerequisites coordinator-owned).
- Next/dependencies: Property-page/CRT/qsort/bsearch fixes are already main. ICM ownership066436de plus real-x86 fixture1bae355 are off main pending fullVM. edit-stream-owner-oct20 delivered RichEdit edit_stream_call source3c01665c; its fullVM remains pending and remaining callback/JS/concurrency/SEH prerequisites keep jump APIs disabled. Runtime403 blocks native/gameplay evidence, not source work.
- Source work remains actionable; later runtime acceptance requires restored authorized access.

### NEW-GAME-MADBOMBER-20261018

- State: blocked; worker: none (source prerequisites delivered).
- Next/dependencies: LockFile and SetLocalTime are already qualified on main. waveOutGetErrorTextA/W implementation7fd352855 is main and source reviewfe540cf2 passed; exact-source normalbuild/native API validation and original SDL observation remain. No active LockFile preparation or gameplay claim.
- Blocker: Existing sandbox.resume 403 api_key_action_forbidden; requires documented authorized runtime access change and coordinator allocation, not a retry.
- Parsed depends-on: MADBOMBER-WINMM-ERROR-TEXT-20261019.

### MADBOMBER-WINMM-ERROR-TEXT-20261019

- State: blocked; worker: none (source review complete).
- Next/dependencies: Implementation7fd352855 already main; independent reviewfe540cf2 passed host+48cases and dispatch/API/import mirrors, no production changes. Next authorized exact-source normalbuild and public native wave API tests with module SHA, then original SDL observation; source checks do not qualify the guest.
- Blocker: Existing sandbox.resume 403 api_key_action_forbidden; requires documented authorized runtime access change and coordinator allocation, not a retry.

## Evidence provenance and limitations

Board records retained in the self-contained run directory identify source reviewfe540cf2 (wave), f856627 (cube), 066436de and1bae355 (ICM), and Hype6ccd344268. Source tests are not native or game evidence. ICM private stale-owner/epoch/spill/SEH/in-instance recovery and current-thunk parking are not covered by its unexecuted native fixture. RichEdit source3c01665c is delivered (20 modeled cases and4 mutation negatives, no fullVM); the noncube audit remains a live coordinator assignment; this task neither edits their source nor integrates their branches.

Return Fire historical gameplay scope is recorded in `docs/re-notes/alice-return-fire-reconciliation-20261018.md`; no renewed screenshot review here. Installer histories are retained in existing task checkpoints; old requests to await licence decisions are historical and superseded by authorization20261018, not by actual guest acceptance. Shadow Man media is a historical remote-only GS1199.iso lead; no exact current local installer path is established, so none is invented. Aranna `/home/user/aranna-game-20261010` is a historical remote path, not a locally verified payload. Jedi recovered archive/receipt paths are checked below; file presence alone does not establish a complete installable closure. The graphics inventory `docs/gfx-corpus-current-inventory-20261019.json` supplies exact historical missingOwnPaths; their local availability is rechecked below, without claiming all other assets remain present. Historical27 membership remains a separate unknown, not a reason to block available source work.

## Exact local path observations

These are local stat observations only; absent means ENOENT at the exact path, not absent on every host. No remote availability was probed and no binary was copied or checked out.

| Path | Observation |
| --- | --- |
| `scratch/runs/20261009T2046Z-return-fire-realized-native` | absent (ENOENT) |
| `scratch/runs/20261009T2050Z-return-fire-realized-browser` | absent (ENOENT) |
| `scratch/runs/20261009T2052Z-return-fire-browser-audio/gameplay-audio.webm` | absent (ENOENT) |
| `test/binaries/win98-games-a-d/Age-of-empire-3trial-Win98-SW.exe` | absent (ENOENT) |
| `test/binaries/win98-games-a-d/Conan cauldron-DX9-D3D/ConanPC-Demo.exe` | absent (ENOENT) |
| `test/binaries/win98-games-a-d/DungeonSiegelegendsofaranna_demo-D3D.exe` | absent (ENOENT) |
| `scratch/runs/20261010T0430Z-aoe3-eula` | absent (ENOENT) |
| `scratch/runs/20261010T0803Z-conan-destination` | absent (ENOENT) |
| `scratch/runs/20261015-jedi-installer-capture/evidence.tgz` | present file (644121 bytes) |
| `scratch/runs/20261015-jedi-original-child-startup/evidence/demo-license.txt` | present file (3421 bytes) |
| `docs/license-acceptance-authorization-20261018.json` | present file (560 bytes) |
| `test/binaries/candidates/lords2-demo/original/SETUP.EXE` | absent (ENOENT) |
| `packages/freeware/dxball/dxball.exe` | absent (ENOENT) |
| `packages/freeware/blobby-volley/volley.exe` | absent (ENOENT) |
| `test/binaries/candidates/nox-demo/game/nox.exe` | absent (ENOENT) |
| `test/binaries/candidates/nox-demo/game/mss32.dll` | absent (ENOENT) |
| `test/binaries/candidates/barrage-105/game/BARRAGE/barrage.exe` | absent (ENOENT) |
| `test/binaries/candidates/barrage-105/game/BARRAGE/SDL.dll` | absent (ENOENT) |
| `test/binaries/candidates/barrage-105/game/BARRAGE/SDL_mixer.dll` | absent (ENOENT) |
| `test/binaries/candidates/barrage-105/game/BARRAGE/iconv.dll` | absent (ENOENT) |
| `test/binaries/candidates/barrage-105/game/BARRAGE/libFLAC-8.dll` | absent (ENOENT) |
| `test/binaries/candidates/barrage-105/game/BARRAGE/libgcc_s_sjlj-1.dll` | absent (ENOENT) |
| `test/binaries/candidates/barrage-105/game/BARRAGE/libintl-8.dll` | absent (ENOENT) |
| `test/binaries/candidates/barrage-105/game/BARRAGE/libmikmod-3.dll` | absent (ENOENT) |
| `test/binaries/candidates/barrage-105/game/BARRAGE/libogg-0.dll` | absent (ENOENT) |
| `test/binaries/candidates/barrage-105/game/BARRAGE/libvorbis-0.dll` | absent (ENOENT) |
| `test/binaries/candidates/barrage-105/game/BARRAGE/libvorbisfile-3.dll` | absent (ENOENT) |
| `test/binaries/candidates/barrage-105/game/BARRAGE/libwinpthread-1.dll` | absent (ENOENT) |
| `test/binaries/candidates/ltris-128/game/LTRIS/ltris.exe` | absent (ENOENT) |
| `test/binaries/candidates/ltris-128/game/LTRIS/SDL.dll` | absent (ENOENT) |
| `test/binaries/candidates/ltris-128/game/LTRIS/SDL_mixer.dll` | absent (ENOENT) |
| `test/binaries/candidates/ltris-128/game/LTRIS/iconv.dll` | absent (ENOENT) |
| `test/binaries/candidates/ltris-128/game/LTRIS/libFLAC-8.dll` | absent (ENOENT) |
| `test/binaries/candidates/ltris-128/game/LTRIS/libgcc_s_sjlj-1.dll` | absent (ENOENT) |
| `test/binaries/candidates/ltris-128/game/LTRIS/libintl-8.dll` | absent (ENOENT) |
| `test/binaries/candidates/ltris-128/game/LTRIS/libmikmod-3.dll` | absent (ENOENT) |
| `test/binaries/candidates/ltris-128/game/LTRIS/libogg-0.dll` | absent (ENOENT) |
| `test/binaries/candidates/ltris-128/game/LTRIS/libvorbis-0.dll` | absent (ENOENT) |
| `test/binaries/candidates/ltris-128/game/LTRIS/libvorbisfile-3.dll` | absent (ENOENT) |
| `test/binaries/candidates/ltris-128/game/LTRIS/libwinpthread-1.dll` | absent (ENOENT) |
| `test/binaries/candidates/lmarbles-108/game/LMARBLES/lmarbles.exe` | absent (ENOENT) |
| `test/binaries/candidates/lmarbles-108/game/LMARBLES/SDL.dll` | absent (ENOENT) |
| `test/binaries/candidates/lmarbles-108/game/LMARBLES/SDL_mixer.dll` | absent (ENOENT) |
| `test/binaries/candidates/lmarbles-108/game/LMARBLES/iconv.dll` | absent (ENOENT) |
| `test/binaries/candidates/lmarbles-108/game/LMARBLES/libFLAC-8.dll` | absent (ENOENT) |
| `test/binaries/candidates/lmarbles-108/game/LMARBLES/libgcc_s_sjlj-1.dll` | absent (ENOENT) |
| `test/binaries/candidates/lmarbles-108/game/LMARBLES/libintl-8.dll` | absent (ENOENT) |
| `test/binaries/candidates/lmarbles-108/game/LMARBLES/libmikmod-3.dll` | absent (ENOENT) |
| `test/binaries/candidates/lmarbles-108/game/LMARBLES/libogg-0.dll` | absent (ENOENT) |
| `test/binaries/candidates/lmarbles-108/game/LMARBLES/libvorbis-0.dll` | absent (ENOENT) |
| `test/binaries/candidates/lmarbles-108/game/LMARBLES/libvorbisfile-3.dll` | absent (ENOENT) |
| `test/binaries/candidates/lmarbles-108/game/LMARBLES/libwinpthread-1.dll` | absent (ENOENT) |
| `test/binaries/candidates/lbreakout2-251/game/LBREAKOUT/lbreakout2.exe` | absent (ENOENT) |
| `test/binaries/candidates/lbreakout2-251/game/LBREAKOUT/SDL.dll` | absent (ENOENT) |
| `test/binaries/candidates/lbreakout2-251/game/LBREAKOUT/SDL_mixer.dll` | absent (ENOENT) |
| `test/binaries/candidates/lbreakout2-251/game/LBREAKOUT/SDL_net.dll` | absent (ENOENT) |
| `test/binaries/candidates/lbreakout2-251/game/LBREAKOUT/libpng.dll` | absent (ENOENT) |
| `test/binaries/candidates/lbreakout2-251/game/LBREAKOUT/zlib.dll` | absent (ENOENT) |
| `test/binaries/candidates/outlaws-demo/game/OUTDEMO/oldemo.exe` | absent (ENOENT) |
| `test/binaries/candidates/supertux-013/game/supertux.exe` | absent (ENOENT) |
| `test/binaries/candidates/supertux-013/game/SDL.dll` | absent (ENOENT) |
| `test/binaries/candidates/supertux-013/game/SDL_image.dll` | absent (ENOENT) |
| `test/binaries/candidates/supertux-013/game/SDL_mixer.dll` | absent (ENOENT) |
| `test/binaries/candidates/supertux-013/game/jpeg.dll` | absent (ENOENT) |
| `test/binaries/candidates/supertux-013/game/libpng1.dll` | absent (ENOENT) |
| `test/binaries/candidates/supertux-013/game/zlib.dll` | absent (ENOENT) |
| `test/binaries/candidates/worms-armageddon-demo/game/WaDemo.exe` | absent (ENOENT) |
| `test/binaries/candidates/worms-armageddon-demo/game/DXMfc.dll` | absent (ENOENT) |
| `test/binaries/candidates/worms-armageddon-demo/game/DirectSound.dll` | absent (ENOENT) |
| `test/binaries/candidates/worms-armageddon-demo/game/DirectX2D.dll` | absent (ENOENT) |
| `test/binaries/candidates/worms-armageddon-demo/game/MFC42.DLL` | absent (ENOENT) |
| `test/binaries/candidates/worms-armageddon-demo/game/MSVCRT.DLL` | absent (ENOENT) |
| `test/binaries/candidates/neverwinter-nights-demo/game/nwmain.exe` | absent (ENOENT) |
| `test/binaries/candidates/neverwinter-nights-demo/game/Mss32.dll` | absent (ENOENT) |
| `test/binaries/candidates/neverwinter-nights-demo/game/binkw32.dll` | absent (ENOENT) |
| `test/binaries/candidates/avp2-demo/game/AVP2.exe` | absent (ENOENT) |

## Reproduction and evidence

Self-contained `scratch/runs/20261020-dashboard-actionable-reconciliation/` retains before/after main and live ledger snapshots, parser/app sources, supplied dashboard12, board excerpt, exact edits, path observations and parser results. `verify.js` reruns parser/predicate and scoped-diff assertions without repository or runtime dependencies. No existing unrelated task bodies, Done criteria, laptop WarcraftIII/HeroesII work, shared Git HEAD or index are changed. Integration is restricted to TODOS.md, ops/STATUS.md and this report, by normal fast-forward only.
