# Baldur's Gate II demo

## Retained fixture metadata verification (2026-10-15, resumed work)

The merged generator at `8ef8e1073` regenerated the retained local fixture's
browser manifest with 644 support entries. Its existing manifest already had
644 entries; parsed file records remained identical (only serialization changed).
All 645 required installed files matched their recorded hashes both before and
after generation. The extra file is host browser metadata. This is a local
metadata check, not a new game run or deployment. Before/after manifests and
hash receipt are preserved in `scratch/runs/20261015-bg2-manifest-regeneration`.

`fetch-candidate-corpus.js --id=baldurs-gate2-demo --prepare` verifies the
645 required installed files before regenerating browser metadata. It does not
repeat extraction or require the moved source directory. Extra save files and
metadata are preserved; changed or missing required files stop preparation
without replacing them. The coordinator verified the retained 645-file install
plus its metadata, and synthetic changed/missing-file and extra-save cases.

## Recovery evidence refresh (2026-10-15)

The original local split package and the 2026-10-09/10 extraction receipts
referenced below are no longer present. The retained installed candidate still
contains all 644 browser-manifest support files at their recorded sizes, plus
the original BGMain.exe: 645 files, 850839386 bytes. Fresh SHA256 measurements
are in `docs/bg2-retained-inventory-20261015.json`; these are a comparison target
measured from the retained fixture, not the missing historical inventory.
BGMain independently matches the original SHA256 recorded below.

The Internet Archive member listing at
https://archive.org/download/win-98-games-a-d.-7z/Win98_Games-A-D.7z/
exposes all seven original parts. Acquisition evidence and complete member URLs
are in `docs/bg2-recovery-20261015.json`. The EXE digest has a preexisting pin;
the six W02–W07 digests are fresh source measurements. The containing archive
metadata records 7169873753 bytes and SHA1
`c53417bcc617790d9671ec385c49ee6f018846c9`.

Recovery must concatenate EXE, W02, W03, W04, W05, W06, W07 in that order,
extract with the historical REWise revision below, then extract the inner
InstallShield cabinets and reproduce the original group destinations and
case-insensitive Extra overlay. Preserve CD2. The retained 75-byte `baldur.ini`
contains only `[Alias]`, `HD0:=C:\`, and `CD1:=C:\CD1\` through
`CD4:=C:\CD4\`, each line terminated by CRLF. Do not synthesize gameplay settings.

Acquisition alone does not establish a repeatable assembly recipe. Exact
REWise invocation and installer group mapping need reinspection because the
historical assembly script/audit is missing. Compare every assembled file to
the fresh 645-file retained inventory before marking recovery reproducible.
No extraction, build, or game runtime was performed for this acquisition step.

The pinned REWise source is now checked out cleanly at
`bx_tgbme2h7:/home/user/bg2-recovery-20261015/REWise`. Its README confirms
ordered concatenation and `rewise -x OUTPUT -p -t TMP INPUT`; the Makefile lists
nine C source units and places `-lz` before objects. The prepared
`tools/bg2-source-recovery.js` compiles those same units with `-lz` last,
preserves all original parts, checks their pins and the extractor identity,
and records extraction logs and hashed outer/inner inventories. It refuses
an existing extraction directory and requires 6 GiB free. `plan ROOT` is
read-only. The compile/extract path remains **unexecuted**, pending a separate
resource grant; use the external 1500-second timeout recorded in the JSON.

The controller stops before assembly. `setup.inx`, group inventory, and Extra
paths must establish the exact mapping first. Its `compare INSTALLED
INVENTORY.json` mode compares all file sizes/hashes case-insensitively and
rejects missing, unexpected, duplicate-case, or changed files. Compare the
645-file assembled tree before adding the generated browser manifest.

### Fresh extraction completed; assembly queued

Controller `145974` exited 0 at `2026-10-15T00:37:17.048Z`. The pinned nine-unit
gcc build succeeded with `-lz` last. REWise produced 46 files directly under
`extraction/outer/MAINDIR`; no alternate-path fallback was needed. unshield
produced 651 files under `extraction/inner`. Complete commands, source hashes,
extractor hash and all output hashes are in `docs/bg2-extraction-20261015.json`.
No compiler or extractor processes remained at source-slot release.

`data1.hdr` SHA256 `1b006399559c55ff08fa517e8b721bfba33825175be9e37562b3c53fd6029c6d`
explicitly pairs `hd0_cab` with `<TARGETDIR>` and the seven other `hd0_*`
groups with `cache`, `characters`, `data`, `music`, `override`, `scripts`,
and `sounds` beneath it. `setup.inx` SHA256
`5acac56439c38e52d506916c9f3ccd7a94b69bb8742e65a700c4220a24172dfd`
contains root README/license/autorun copy names at offsets 0x4dea–0x4e78,
Extra root and subdirectory overlay names at 0x4e9c–0x50a1, and HD0/CD1–CD4
aliases. The outer original CD2 tree contains three resource files.

An explicit `assemble ROOT INVENTORY.json` mode implements this mapping,
checks both metadata hashes, applies case-insensitive overlays, writes only
the documented 75-byte CRLF alias file, and requires the complete byte
comparison before success. The helper's case-insensitive directory/file
overwrite behavior passed a small synthetic test.

### Exact installed-tree recovery verified

Assembly-only controller `150474` exited 0 at `2026-10-15T00:41:16.986Z`.
The first source-backed mapping passed without adjustments: **645 expected,
645 actual, zero missing/extra/changed files**, totaling 850839386 bytes.
All contents match the fresh retained inventory by SHA256. The 663 source
copies include 19 case-insensitive replacements; the separately reconstructed
alias file is exactly 75 bytes and matches the retained original layout.
Receipt and exact copy/overwrite history: `docs/bg2-assembly-20261015.json`.
Recovered tree: `bx_tgbme2h7:/home/user/bg2-recovery-20261015/installed`.

The corpus recipe now pins all seven source URLs/digests, retains source media
and recovery receipts in a sibling `.bg2-recovery-*` directory, runs the pinned
REWise and unshield stages, and requires the full installed-tree comparison
before publishing. It preserves the existing root fixture layout and hence
the 644-support-file browser manifest. Dependencies are git, gcc, zlib headers,
and the pinned `/usr/bin/unshield` binary from Debian package 1.5.1-1; dependency
or identity mismatches fail explicitly. `recover ROOT` wraps the individual
steps for a fresh directory containing the seven original parts.

The individual original-media extraction and assembly stages are tested.
The newly connected generic fetcher route has only source-level validation
so far; a fresh end-to-end `fetch-candidate-corpus.js --id=baldurs-gate2-demo
--force` remains pending a separate extraction grant. This recovery does not
add a browser/gameplay/audio/FPS claim.

Distinct from the Baldur's Gate 1 previews in baldurs-gate-demos.md. No BG2
entry exists in the inspected DESKTOP_APPS list or current app registry.

Original local package directory:
`test/binaries/win98-games-a-d/Baldurs-Gate-2_demo-SW-OpenGL/`.
Seven split Wise installer files are present: `bg2demogs.EXE` and
`bg2demogs.W02` through `bg2demogs.W07`. The first six are102400000 bytes each;
W07 is33270892 bytes, total647670892. EXE header strings identify Wise and
"Baldur's Gate II Demo". No payload modification or installation yet.

Run `20261009T0852Z-bg2-installer-preflight` contains exact paths, sizes and
SHA256 for every part. Initial executable SHA256:
`772c67fd2d73599e60a43c74466df11641a55f68ccce02fb82b38e26e666f689`.

Next: transfer the original split package to a temporary boat, inspect the
installer route and extract/install there. Keep all split siblings mounted
together. Installed executable/support paths remain unknown until this is
done. Local disk is near the2GiB floor, so do not extract locally. Serialize
runtime behind Alice; no concurrent second worker under the budget policy.

Acceptance requires registered launch, ordinary input changing gameplay and
a reviewed screenshot with original media/build identity. Installer, menu and
automatic cinematic captures do not qualify. No public deployment or approval
of agreements is authorized by this task.

Original-media transfer started21:12:13Z to bx_42ztf6q5:/home/user/bg2-original-20261009. SCP was unavailable to this API key; existing authorized exec-based file transfer is used instead. Local controller2285616 has immutable21:42:13Z deadline and per-file original/remote SHA256 checks. Receipt scratch/bg2-transfer-20261009/receipt.json is authoritative; partial transfer is not installation. This only copies original files while the one guest-runtime slot stays serialized.

## Remote media staged (2026-10-09T21:38:58Z)

Resumed controller2307995 completed all seven original Wise parts,647670892 bytes, with per-file SHA256 verification on bx_42ztf6q5:/home/user/bg2-original-20261009. Receipt and initial file inspection retained in scratch/runs/20261009T2139Z-bg2-staged-media/. Remote box lacks 7z and unshield; archive listing did not run, even though the piped shell returned0. Next obtain a suitable extractor on the temporary box, inspect the Wise package and determine installed executable/support paths. No installer acceptance, game run or gameplay evidence yet. Boat expires22:04:59Z.

## Outer Wise package extracted

REWise c3d3b68903a90ec53ff7b0a4ae704adc6302814b from https://codeberg.org/CYBERDEV/REWise documents concatenating split W02/W03 files. Original part hashes were rechecked during concatenation. Its default Makefile placed -lz before objects and failed linking; relinking identical objects with -lz last succeeded. Controller131426 completed21:56:59Z. Run20261009T2157Z-bg2-extracted retains extractor revision, exact build command/controller, original hashes and46-file inventory;659095831 extracted bytes. Original failed build129175 is retained remotely, no installer payload was touched by that attempt.

The outer package is a wrapper around another InstallShield installer: /home/user/bg2-extract-v2-20261009/files/MAINDIR/data1.cab, data1.hdr anddata2.cab. Extract those next with unshield; final game asset tree remains unknown. Extra/BGMain.exe is7139374 bytes SHA256944db091d82c6144db8c9a21c085e4504bdc549fca8003c31e309646567bb98b. Extra appears to contain demo overrides, not a complete independently runnable installation; do not launch it with missing resources or silently synthesize config. No game run or agreement acceptance.

Inner InstallShield extraction134145 completed21:59:27Z,651 files830851985 bytes, evidence run20261009T2200Z-bg2-inner-extracted. Grouped files are under /home/user/bg2-inner-20261009/files: hd0_cab contains BGMain.exe/BGConfig.exe/Keymap.ini, plus hd0_data, hd0_music, hd0_override, hd0_scripts, hd0_characters, hd0_sounds andhd0_cache. InstallShield engine groups are also present; do not mistake them for game assets. Next confirm installer destination/group mapping and demo Extra overrides, assemble the original installed tree and run normal startup. No gameplay or final installed layout claim yet.

Named snapshot alice-bg2-20261009 saved3864395776 bytes before temporary-box expiry. Fork bx_hx8msa33 created22:01:05Z, expires23:01:05Z; verify all source/media paths after hydration. Old bx_42ztf6q5 has no live guest/build.

## Main-build character creation and opening dungeon (2026-10-09)

Original installer layout assembled at /home/user/bg2-installed-v2-20261009 on bx_hx8msa33. Main280d28eb1/module527004d9 reaches character creation, opening dungeon and completed Imoen dialogue using ordinary inputs; run20261009T2227Z-bg2-opening-dungeon. Movement not yet verified: prior controller28492/28499 exited22:31:39Z before request59 executed. Fresh bounded movement replay32192 now runs /tmp/bg2-movement-play.js; collect response59 and cleanup. Original demo BGMain SHA944db091; no guest patches or approvals. Register and verify browser after movement; local installed candidate path remains missing.

Installer setup.inx strings confirm hd0 group destinations, Extra overrides and Alias HD0/CD1-CD4 paths. Assembly script/audit are retained in scratch/runs/20261009T2209Z-bg2-install-layout. Windows case-insensitive overlay semantics applied; only installer path aliases synthesized, no gameplay settings changed. Chitin.key references76 files absent from the demo after case-insensitive resolution; exact names in assembly.json, not yet an observed runtime failure. The complete original demo overlay executable SHA256 is944db091d82c6144db8c9a21c085e4504bdc549fca8003c31e309646567bb98b.

Name entry needs ordinary keydown/keyup (65 inserted a); keypress alone did not populate this field. Ended Imoen dialogue with visible ordinary responses, step58 shows dungeon and both party portraits. Prior run request59 has no response and must not count as movement. First character-creation controller24705/24712 also terminated before its late requests46-49; retained run20261009T2221Z-bg2-character-creation distinguishes them.

## Ordinary player movement verified (2026-10-09T22:36Z)

Original BG2 demo native player movement verified on main280d28eb1/module527004d9, run20261009T2236Z-bg2-player-movement; photo978. Ordinary creation/dialogue, select hero via portrait, ground click moves hero away from cage while companion remains nearby.32192/32199 terminal0 at22:36:40Z. Next register complete original media then browser/audio/FPS; frozen native run is not FPS evidence. Installed tree /home/user/bg2-installed-v2-20261009 on bx_hx8msa33; missing local test/binaries/candidates/baldurs-gate2-demo. CLI warnings name missing remote test/binaries/dlls/{shell32,comctl32,ole32}.dll; restore exact fixtures for follow-up. Alice remains second lane under one-worker budget.

Run controller replayed only previously acknowledged ordinary inputs1-58. Request59 clicked terrain; camera shift alone was insufficient proof. Request60 selected the hero portrait (603,41); request61 clicked walkable ground (186,319), advancing200 batches. Reviewed step59/61 show the green-armored player move from beside the central cage to the lower-left walkway while the cage stays fixed and the companion remains behind. This is player control, not an automatic cinematic. Exact source, original executable hash, all inputs/responses, controller, output and clean termination are retained in the self-contained run.

Two existing Baldur Chapters I/II compatibility patches refused unexpected bytes for this different executable, explicitly logged, so those patches were not applied. Three missing real-system-DLL warnings also remain; gameplay proof is scoped to the recorded native route, not complete Windows DLL coverage or browser parity.

## Registered browser route (2026-10-09T23:57Z)

Added local-only app `baldurs_gate2_demo` and corpus candidate `baldurs-gate2-demo`. The complete support manifest contains 644 files (original executable separate), including audio. Installer path aliases resolve against C:\. On temporary bx_hx8msa33, original-main module527004d9 and default browser Worker/WebGL render the menu; ordinary Single Player/New Game clicks reach character generation. Run `20261009T2357Z-bg2-browser-registration` records this partial browser evidence. Browser gameplay, sound quality and FPS remain unverified. The bounded controller61300 is still active; do not launch another browser until it is terminal.

Local media copy remains incomplete. API transfer stopped at23:47:12Z on the2GiB disk guard. Private SSH connection timed out; both processes exited and its temporary authorized key was removed at23:55:10Z. Port forwarding is unavailable to this API key. Compressed, per-chunk/per-file-hashed API transfer now resumes verified files using `scratch/bg2-transfer-20261009/download-compressed.js`, with a45-minute deadline and disk guard; its receipt must prove completion before publishing the local manifest. Original inventory is645 files850839386 bytes. Remote complete fixture is unaffected. Local comctl32.dll exists but shell32.dll/ole32.dll are absent; none were substituted in this browser run.

## Browser opening scene stalls (2026-10-10)

Run `20261010T0014Z-bg2-browser-cutscene` preserves complete ordinary inputs, captures, logs, controller and served-module identity. Character import explicitly says disabled for demo. Created male human lawful-good fighter through normal menus, allocated original proficiency points, named him with ordinary A key, and accepted. Opening dungeon renders, but repeated captures show the same magic-particle pattern. Escape does not establish a skip. A20.032-second observation records0 guest presents/uploads while769116 blocks execute; logical FPS is unknown. This is a browser presentation/progress blocker, not evidence of player control or a diagnosed cause. No runtime exception appears in captured browser errors. Native cooperative gameplay does not resolve this Worker-route difference.

Controller61300 and Chrome61312 ended cleanly at00:14:37.156Z on immutable1200-second deadline. The later thread-popup request arrived after termination and produced no capture; it is not evidence. Fresh diagnostic controller73552 replays only the same ordinary inputs through Accept (omits Escape), then takes8 read-only scheduler snapshots30 seconds apart plus presentation counters. It has its own1500-second guard and private browser output `/home/user/bg2-browser-diagnostic-20261010`; collect that controller before any further runtime. No guest-state edits or speculative fix.

Diagnostic73552/73564 finished00:33:36.758Z, terminal0. **Replay did not reach dungeon**: name was not accepted, final reviewed image is character creation. Run `20261010T0033Z-bg2-browser-thread-stall` records this harness mismatch honestly. Its607 presentations over20.052s and8 stable thread snapshots are a healthy-menu control, not stall evidence. Main previous EIP00912326 leads to PeekMessageA (IAT00a065e0); worker00434d10 follows Sleep (00a06448),00434d9a follows SuspendThread (00a06380), and00434e62 precedes WaitForSingleObject (00a06454). Those states alone cannot identify a broken scheduler. Disassembly excerpts include unaligned leading instructions; only the explicit aligned API-call boundaries support these mappings.

Follow-up controller79682 uses the same original input replay, then explicitly reopens Name, enters A, completes it and accepts, with screenshots and8 read-only thread/register/clock/game-object samples. No guest writes. Output `/home/user/bg2-browser-deep-20261010`,1500-second immutable deadline. Boat extended to archiveAfter01:43:39Z. Media transfer hit its45-minute deadline00:41:21Z after83 completed files799219683 transferred bytes (plus prior verified files); prior receipt preserved, terminal verified, a new bounded resume now copies only missing files. Complete local manifest remains unpublished pending full645-file hash verification.

## Local media complete; replay input mismatch localized

Resumed transfer completed00:48:34.888Z: all645 original installed files850839386 bytes SHA256 verified. The644-support-file `.wine-assembly-browser.json` and `.original-inventory.json` are now published under local `test/binaries/candidates/baldurs-gate2-demo`. Run `20261010T0054Z-bg2-installed-media` preserves both transfer receipts and inventory. This removes the missing-local-media blocker; it does not establish browser gameplay.

Second diagnostic79682/79694 completed00:52:22.833Z, terminal0, but again remained in character creation. Reviewed replay030 shows the Name button; replay031 after its click does not show the modal; replay032 after A still has no name. Run `20261010T0052Z-bg2-browser-replay-mismatch` retains these exact checkpoints plus8 clock/register/memory samples, all scoped to the menu. Manual Appearance click worked. Subsequent manual Done/Name sequence arrived after controller shutdown and produced no capture. Next instrument ordinary click delivery and positively confirm the Name modal before typing, then capture the original dungeon stall. Do not infer its scheduler cause from the menu snapshots. All runtimes and transfers are terminal.

Diagnostic correction: `get_sleep_yielded` in `src/13-exports.wat` reads **and clears** the flag. The second replay's8 memory samples called it; their earlier read-only description is incorrect and those samples may perturb scheduler state. Preserve them as tainted menu diagnostics, not causal evidence. First replay's standard thread snapshots did not call it. Follow-up90293 stops its replay before Name and enables only the existing renderer-input observer; it contains neither these memory samples nor this getter.

## Actual dungeon critical-section stall (2026-10-10T01:23Z)

Controller90293 stopped replay before Name, revealing an earlier divergence: character was a cleric with alignment/abilities/skills unfinished, so Name was unavailable. The visible state was completed manually through normal inputs; renderer observer confirms pointer packets at expected guest coordinates. Confirmed Name modal, ordinary A, Done and Accept reach the dungeon. This is a harness sequencing problem, not a demonstrated broken Name control. The current cleric differs from the earlier fighter, so do not call it an identical character comparison.

Cutscene visibly advances through intruder dialogue and character movement, then stops before player dialogue, **without Escape**. Run `20261010T0123Z-bg2-dungeon-critical-section` preserves actual dungeon evidence. A20.028s late sample records0 presents/uploads despite898086 executed blocks. Browser errors are empty. Read-only registers show main/active-worker clocks advancing by roughly10 seconds between snapshots; no frozen-clock explanation is established.

Worker slot5 (guest tid6) repeatedly parks at EnterCriticalSection thunk07500528, return0045b374, guest CS00c1d816 / WASM0082f816. Direct lock words at01:23Z are debug0, LockCount-1, recursion1, owner1, semaphore0, spin0. Main guest thread1 is polling PeekMessageA around00912326. The original0045b360 wrapper enters its object+8 CS; caller path0063870d →0099ecfa invokes the object's virtual lock method. Owner/recursion evidence narrows the next investigation, but does not prove who failed to release or whether an ownership transition is incorrect. Trace acquisition/release and initialization for this lock before any runtime patch. These live probes omit the destructive sleep getter; their controllers are preserved.

Ordinary stop completed90293/Chrome90305 at01:23:50.174Z, terminal0. All runtime/transfer jobs are terminal. Native player movement remains valid; browser player movement, sound quality and logical gameplay FPS remain unverified. Local media is complete, so no fixture-transfer blocker remains.
# Concurrent packed critical-section reproduction (2026-10-10)

The browser's stuck section at guest `00c1d816` is misaligned by two bytes.
The original implementation avoids a WebAssembly unaligned-atomic trap by
using an unprotected load/store for the owner claim. A standalone test with
two actual Node workers sharing the original main module `527004d9…` reproduces
overlapping owners, lost protected increments, and a final owner with
recursion 1 but LockCount -1. The aligned control completes 100,000 increments
without overlap and releases normally. Evidence:
`scratch/runs/20261010T0131Z-unaligned-cs-race`.

The candidate serializes packed owner claim/release using the existing
split-lock mutex, held only for memory accesses, never across guest execution,
host imports, callbacks or parking. Aligned sections retain their CAS path.
Canonical build and concurrent Enter/TryEnter/recursive tests across offsets
0,1,2,3,5,6,7 pass, as do the original reproducer and 26 existing CS checks.
Candidate module: `9b307a5c28acffd256dceacf43e261e3997a171cb21a01d1804ebba1cc61774c`.
Browser verification on that candidate now passes the opening cutscene and
Imoen's dialogue, followed by two ordinary player-directed floor movements.
Run `20261010T0146Z-bg2-browser-lock-fix` contains reviewed before/after images,
trusted input records, and the served module hash. The worker that previously
parked on the corrupt section now waits normally on its event. Controller
101560 and Chrome 101572 exited cleanly at 01:45:36Z. Final concurrency tests
also exercise non-owner Leave and abandoned-section reuse for packed layouts.

Audio and logical gameplay FPS remain unqualified. A pointer alignment issue
is visible after entering gameplay: the guest cursor does not match the page
click location. Keyboard dialogue choices and floor clicks still establish
control, but coordinate mapping needs its own investigation. Do not describe
the game as fully qualified from this run alone.

### Pointer diagnostic correction and current-main repeat

`Puppeteer.connect()` defaults mutate the attached page viewport. The live
probe therefore was not browser-layout-neutral even though its guest exports
were reads. A fresh diagnostic measured the canvas CSS rectangle changing
from 660x568 to 460x336 after attachment. Use `defaultViewport: null` when
attaching to an existing browser. Explicitly restoring the original 1000x800
viewport removed the discrepancy without changing runtime input code.

Run `20261010T0208Z-bg2-pointer-geometry` repeats the complete cutscene,
ordinary dialogue click and floor-directed player movement with the viewport
preserved, on integrated-main module
`b84324ed9ad9c04a780d418348b22a065642cdea08422a74b06d2635019116de`.
The earlier setup replay diverged during the diagnostic resize and was
completed manually as a dwarf fighter. Controller107744/Chrome107756 exited
normally at02:08:22Z. The pointer mismatch is a harness side effect, not a
remaining demonstrated game-input defect. Gameplay qualification is complete;
audio and logical FPS remain separate follow-ups.
