# Icewind Dale demo — local candidate

The official English demo is pinned in `test/candidate-corpus/manifest.json`
from Archive item `icewind_dale_eng_demo`. Its README expressly prohibits
copying/electronic distribution, so the extracted fixture stays ignored and
must not be deployed or rehosted.

Legacy fetch and test (the fetch recipe requires `unshield`; this is not
evidence that the original installer works):

```sh
node tools/fetch-candidate-corpus.js --id=icewind-dale-demo
node test/test-icewind-dale-demo.js
```

## Original installer investigation

### Decoder overlap correction

The long install's exit counters reported roughly 101 million retired
blocks but only 127,641 invalidation calls. The retirement counter also
counts `page_publish` replacing overlapping entries; it does not prove
that the guest modified its code. The hot cabinet loop at relocated
`0x007b4d21` has ordinary interior branch targets. Alternating an outer
entry with an interior entry made the one-owner-per-byte cache continually
retire the other decode.

`decode_block` now emits an ordinary block end when it reaches an already
cached instruction entry, preserving that suffix instead of overlapping
it again. No guest address or cabinet format is special-cased. The focused
regression in `test-sparse-generated-code-cache.js` failed before this
change because the interior entry vanished after re-entering the outer
prefix. It now requires both entries to remain cached while alternating
them, and retains the subsequent shared-immediate rewrite check. Sparse
and cross-instance invalidation, page-chunk allocation, and 138 x86 cases
pass with this correction.

The actual clean installer run on this build passed inspected copy screens
at batch 8750 (30%) and 18750 (56%). Its next large stdio step did not
return a checkpoint for a long interval: a live process and CPU activity
were not sufficient evidence of installation progress. Final output did
establish a new stopping point at batch 27726: the installer left its
copy-progress UI and trapped on the still-unimplemented
`WritePrivateProfileSectionA`. The caller is `0x0041d366`, returning to
`0x0041d36c` in the emitted InstallShield engine. Process exit was 1,
not Setup Complete. Implement and test the real section-writing semantics
before another full installer acceptance; do not silently return success.
Use shorter step requests or a separately accessible control channel so
progress and orderly-stop commands are not queued behind a long step.

`WritePrivateProfileSectionA/W` are now implemented in `db04f9a8`: section
replacement/deletion writes the VFS file, retains an existing UTF-16LE file's
encoding, and reports invalid parameters, missing parents, and read-only
write failures. Single-key profile writes preserve the section-written keys.
The storage regression and full build pass. `test/test-profile-section.js`
also exercises both compiled WAT handlers with guest pointers, Unicode text,
NULL deletion/flush arguments, BOOL/LastError, and three-argument stdcall
cleanup. The original-installer acceptance below now passes; gameplay using
the installed game's original INI/CD layout remains unverified.

### Completed original installation

The clean guest-produced engine replay on the integrated profile-fix build
(1,073,129-byte WASM, layout `f73bfdc3f7f38137`) completed the original
installation. It passed the former profile-section trap, created shortcuts,
and displayed the compatible-DirectX reinstall question at batch 27750.
Answering No with `dlg-cmd:7` reached the actual **Setup Complete** screen at
batch 27800. Finish (ID 1) led to guest `[Exit] code=0` and a successful VFS
export at batch 27840. This is not a deadline-only or copy-progress acceptance.

The separate output is `/private/tmp/iwd-profile-fixed-installed-vfs`.
Its `program files/black isle/icewind dale demo` subtree contains 1,079 files
totaling 470,164,222 bytes. Read-only comparison with the existing
`installed-extracted/Recommended_compressed` reference found 1,076 identical
files, one changed `icewind.ini`, and two installer-created extras:
`readme.txt` and `uninst.isu`. All 640 sound-set WAVs are present. The original
`CHITIN.KEY` is byte-identical to the reference's original key, not the
legacy modified `CHITIN-full.KEY`. The installer itself wrote these aliases:

```ini
[Alias]
HD0:=C:\Program Files\Black Isle\Icewind Dale Demo\
CD1:=C:\Program Files\Black Isle\Icewind Dale Demo\CD1\
CD2:=C:\CD2\
```

No host decompressor or INI/KEY patch supplied the installed payload. The
export also retains the original `cd2` source tree. Next launch must mount
this entire VFS and use the installed executable's guest path and working
directory, retaining the original CD2 layout and compressed resources.
Do not substitute legacy expanded BIFs or the modified key as gameplay proof.

Inspected screenshots: `/private/tmp/iwd-profile-directx-question.png` and
`/private/tmp/iwd-profile-setup-final.png`. The latter shows Setup Complete.
Replay used `--max-seconds=3600 --control=8137 --control-stdin --frozen`.
This terminal closed stdin, so all wizard actions and checkpoints used HTTP.
Long step requests can exceed HTTP's 30-second response deadline while the
guest keeps running: inspect `/snapshot` credits until zero before issuing
another step. Independent file-size checks established continued progress.
The process priority was lowered during high host load; no benchmark was run.

Two follow-up observations are not covered by this install acceptance: the
Readme checkbox input issued a ShellExecute request before Finish, and VFS
export reported an empty `c:\windows` file/directory collision, preserving
the file as `windows.__vfs_file__`. Neither caused a setup error, but both
deserve separate investigation rather than being silently treated as correct.

### Original-installed game startup

A low-priority headless run mounted the complete exported VFS, loaded
`program files/black isle/icewind dale demo/iddemo.exe`, and set both its
guest executable path and working directory to that installed directory.
No INI, KEY, CD2, override, or compressed resource was changed or removed.
With `--batch-size=200000 --time-scale=10 --repaint-every=10`, Escape at
batches 100, 160, 220, and 280 skipped the intro sequences. The inspected
`/private/tmp/iwd-original-game-later.png` at batch 285 shows the full menu
with readable labels, not just background artwork.

Clicking Create Game at `(480,175)` at batch 300 instead produced
**Cannot connect to the game session**. The inspected error screenshot is
`/private/tmp/iwd-original-party.png` at batch 400; despite its filename it
does not show Party Formation. The run was explicitly quit at batch 450.
This differs from the legacy modified-fixture acceptance and remains the
next gameplay blocker. The error text alone does not establish whether
DirectPlay address creation, COM activation, or another step failed.

A subsequent selective DirectPlay/COM API trace stopped at the internal
180-second deadline at batch 200, before the Create Game click. It provides
no failing session API evidence. Note that `--trace-api=Names` also enables
unfiltered file-read/find diagnostics through `_debugReadFile` and
`_debugFindFile`, so even a nominally selective startup trace emits extensive
resource I/O. Next investigation should enable the relevant tracing at the
menu or suppress those independent file diagnostics while retaining the
DirectPlay/COM trace, then compare with the legacy route on the same build.

The follow-up frozen trace identified a concrete interface gap during menu
initialization, before Create Game: at `0x008d3680`, the executable calls
`CoCreateInstance(0x00997c50, NULL, 1, 0x00997c40, out)` with return address
`0x008d3686`. Decoding the original executable's GUID bytes gives
`CLSID_DirectPlay` and `IID_IDirectPlay4A`
`{0AB1C531-4745-11D1-A7A1-0000F803ABFC}`. The caller stores the HRESULT at
`[ebp-0x1c]` and tests it after `CoUninitialize`.

The current `dplay_query_interface_wa` intentionally rejects this IID because
only the 47-slot ANSI DirectPlay2/3 vtable exists. The compiled
`test-directplay-query-interface.js` now reproduces the exact factory request:
`E_NOINTERFACE`, cleared output, and no leaked temporary object. Its passing
negative test describes a missing feature, not working IWD gameplay. The
legacy fixture's earlier success does not establish that it still works on
this newer COM implementation; the original-installed error should not be
attributed to INI/KEY/CD layout without further evidence.

Next is a real 53-slot ANSI DirectPlay4 implementation. Its additional methods
are group-owner get/set, extended send, queue inspection, and cancellation by
message or priority, as defined in the
[Wine DirectPlay header](https://raw.githubusercontent.com/wine-mirror/wine/master/include/dplay.h).
Simply accepting the IID on the shorter vtable would permit calls past its
end. Ownership, queue state, cancellation, reference lifetimes, and all tail
stdcall contracts need coverage before changing the current rejection test.
The trace run was explicitly quit at batch 350; its inspected session-error
capture is `/private/tmp/iwd-original-dp4-error.png`.

Implementation has started with an internal ownership-storage prerequisite:
the local entity entry now retains an explicit owner ID. Assignment requires
a live group and a live player; transfer replaces that ID, player destruction
invalidates references to it, and group destruction/Close/slot reuse discard
old ownership. Compiled entity tests cover those transitions and failed
assignments preserving prior state. This is not yet `GetGroupOwner` or
`SetGroupOwner` API support: default selection, membership policy, ownership
notifications/migration, per-object session isolation, and public HRESULT
contracts still need to be established. No DP4 IID or additional vtable slot
has been exposed by this prerequisite.

The original `Setup.exe` successfully emits its InstallShield 5.5 engine
through guest execution. Replay that emitted engine, not a host-extracted
cabinet. The following frozen CLI route uses an isolated build and leaves
the legacy gameplay fixture untouched:

```sh
node test/run.js \
  --exe=test/binaries/candidates/icewind-dale-demo/icewind_dale_eng_demo/Setup.exe \
  '--vfs-include=**/*' --no-build --no-threads --quiet-api --quiet-blocks \
  --no-close --screen=800x600 --batch-size=100000 --tick-ms-per-batch=100 \
  --max-seconds=180 --control-stdin --frozen \
  --capture-launch=/private/tmp/iwd-original-bootstrap
```

Step 100 batches, then quit cleanly and wait for the capture to finish.
`launch.json` identifies the guest-produced
`windows/temp/_istmp1.dir/_ins5576._mp` (557,056 bytes), with its original
`zdatai51.dll` and `_wutl951.dll`. The 96-file capture includes the original
cabinet and CD2 source tree; those source files are copied, not decompressed
by the host.

```sh
node test/run.js \
  --exe=/private/tmp/iwd-original-bootstrap/windows/temp/_istmp1.dir/_ins5576._mp \
  '--exe-guest-path=C:\WINDOWS\TEMP\_ISTMP1.DIR\_INS5576._MP' \
  --vfs-tree=/private/tmp/iwd-original-bootstrap '--cwd=C:\' \
  --dll-seed=/private/tmp/iwd-original-bootstrap/windows/temp/_istmp1.dir/zdatai51.dll,/private/tmp/iwd-original-bootstrap/windows/temp/_istmp1.dir/_wutl951.dll \
  --no-build --no-threads --quiet-api --quiet-blocks --no-close \
  --screen=800x600 --batch-size=100000 --tick-ms-per-batch=100 \
  --max-seconds=300 --control-stdin --frozen \
  --save-vfs=/private/tmp/iwd-original-installed-vfs
```

At batch 300 the Welcome screen is visible. Send
`{"cmd":"dlg-input-click:1"}` and step 50 for the License screen; its Yes
button is ID 6. Accept that button and step 50 for Recommended setup.
Thereafter click ID 1 and step 50 at each of Setup Type, CPU Speed,
Destination, and Program Folder. The unchanged defaults install to
`C:\Program Files\Black Isle\Icewind Dale Demo`. At batch 750 the native
install progress window is visible; at batch 1750 it shows 11%, with
`iddemo.exe` (6,283,264 bytes), `dialog.tlk` (2,942,485 bytes), override
resources, characters, and the first area archive actually written by the
guest. At batch 3750 the progress is 18%; at batch 5750 it is 24%, with
284 files totaling 117,868,153 bytes under the destination (including the
in-progress archive). These screens and file sizes were inspected on the isolated
`6cada250` runtime. This is partial installation evidence, not yet a
completed-install or fresh-installed gameplay pass.

The 300-second internal execution guard stopped normally at batch 7177
inside the guest cabinet DLL (`EIP=0x007b4d3f`), and the VFS export completed
with process exit 0. This exit is a test deadline, not Setup Complete.
The destination contains 284 files totaling 142,198,393 bytes. Read-only
comparison against the legacy reference found 280 byte-identical files;
`Data/chranim.bif` is still partial (52,695,040 of 69,527,564 bytes), and
the original 316-byte `icewind.ini` differs from the legacy patched INI.
The other two files are installer-created `uninst.isu` and `readme.txt`.
The installed EXE SHA-256 is
`b94816d10029cb99c0315f175330c917be2fff298394e853e2764973d8d13af4`.

### Longer execution and interrupted-install replay

A fresh replay with `--max-seconds=1800` reached inspected progress screens
at batches 8750 (34%), 9750 (37%), 10750 (40%), 12750 (47%), 14750 (53%),
16750 (59%), 18750 (65%), and 20750 (79%). The internal deadline stopped
at batch 21190, `EIP=0x007b4edd`, still inside cabinet decompression.
It exited cleanly and exported `/private/tmp/iwd-original-complete-vfs`;
despite that directory name, this is **not a complete installation**.
Its destination has 302 files totaling 407,579,613 bytes, with 298
byte-identical to the legacy reference. The incomplete file is now
`Data/sndspell.bif` (21,606,400 of 22,416,309 bytes). The other differences
remain the unpatched INI and installer-created README/uninstall log.
No payload bytes were supplied by a host decompressor.

Directly replaying the engine from that export exits with guest code 4
before its wizard: `_ins0432.ini` and `_isenv31.ini` have been consumed.
Running the original `Setup.exe` again with the exported VFS succeeds and
emits a fresh engine under `_ISTMP2.DIR`, preserving the installed files.
This capture is `/private/tmp/iwd-rebootstrap` (426 files). Its engine
reaches the same wizard, but selecting Program Folder produces
`unInstaller setup failed to initialize. You may not be able to uninstall
this product.` Dismiss the native message box with `dlg-cmd:1`; unlike the
guest wizard buttons, `dlg-input-click:1` alone did not dismiss it.
This interrupted-install route is not a clean-install acceptance.

It also does **not** resume decompression: after 1000 additional copy steps
the wizard shows 11%, and the previously complete `Data/ar1000.bif` has
been replaced with an 8,632,320-byte partial file. The original partial
`sndspell.bif` is untouched. This probe was quit explicitly; its separate
`/private/tmp/iwd-original-reinstall-vfs` export must not replace the earlier
output. A subsequent completion attempt needs one uninterrupted run with
sufficient internal execution allowance, not repeated partial-VFS replay.

Next: require the actual completion screen and verify the complete output before
changing the fetch recipe or registry. Then test gameplay using the original
installed INI/KEY and CD2 layout. Do not reuse this partial directory as an
installed fixture or assume the legacy KEY/CBF modifications remain necessary.

## Legacy fixture preparation

The package is an outer ZIP containing an InstallShield cabinet and CD-resident
data. The fetch recipe extracts the `Recommended compressed` group and merges
the official `CD2/Data` tree into the local installed `Data` directory. Without
that merge the real executable renders its “insert CD in D:\” screen forever.

The fetch recipe rewrites the extracted portable `HD0:=.\` alias to the
installed layout used by the emulator (`HD0:=C:\`, `CD1/CD2:=D:\`). This
Infinity build's dot-prefix branch strips two characters from the original
`hd0:` resource path, producing malformed `C:\0:\...` paths; the absolute
installed aliases let it open `Dialog.tlk` and its BIF resources normally.

## Local-session startup

The original `IDirectPlayLobby2_CreateCompoundAddress` shim returned `S_OK`
and an output size of zero for every call. Infinity Engine uses the documented
two-call sizing pattern in its local-session initializer: first it supplies a
null address buffer and requires `DPERR_BUFFERTOOSMALL` (`0x8877001E`) plus the
required byte count, then it allocates that buffer and calls again. Returning
success from the size probe made the initializer abort, leaving Create Game to
show “Cannot connect to the game session.”

The handler now sizes and packs each `DPCOMPOUNDADDRESSELEMENT` as a GUID,
data length, and payload. `test/test-directplay-lobby-address.js` pins the null,
undersized, and successful-buffer cases independently of the game.

The localhost dropdown must also mount every archive marked as installed
(`location=1`) in `CHITIN.KEY`. The old menu-only 19-file manifest omitted
`BCSgen.bif` and later installed archives; once DirectPlay succeeded, the
installed-resource pass stopped at `ChDimm.cpp:817`, reported the CD as removed,
and terminated. The dropdown now mounts all 34 location-1 archives present in
the Recommended install.

## CD2 and first-area gameplay

The official package's `CD2/Data` directory supplies 24 compressed area/creature
BIFs, two movie BIFs, and `IWDCD.2`. Merely mounting those files under `D:` was
not enough: manifest mounting registered each file and immediate parent but did
not register the `d:\` drive root. Consequently `SetCurrentDirectory("D:\")`
and the game's `FindFirstFile("D:\\*.*")` disc scan failed even though
`D:\data\IWDCD.2` itself resolved. The VFS mount helper now registers the drive
root and every ancestor, and Win32/DOS `*.*` enumeration also matches
extensionless directory names such as `cd2`.

The CBFs are host-inflated once by local fixture preparation into normal BIFF
files. Its matching `CHITIN-full.KEY` changes the 24 expanded BIFs and two
direct movie BIFs from CD2 (`location=9`) to HD (`location=1`). The
retail-derived KEY also advertises 2,464 resources whose backing BIFs are not
in the official demo at all, including `SNDVO.bif`; leaving those entries
active made the loader run its six-pass, 200 ms CD poll forever for an archive
no disc in this package contains. The prepared KEY retains the 12,682
resources backed by the 60 installed/demo archives and removes only those
dangling entries.

NPC and narration audio that retail stores in `SNDVO.bif` is intentionally
loose in the demo. The dropdown mounts all 188 supplied `Override/*.wav`
replacements. Non-audio override resources are not bulk-mounted at startup:
some intentionally replace UI/game resources and activating the whole
directory before the demo's normal phase switch trips
`ChUIControls.cpp:6668`.

## Character-generation sound sets

The executable's `JigSawedME` window title is the official demo build's
internal name; it is unrelated to the Win16 JigSawed app elsewhere in the
corpus.

After the Appearance dialog, the demo clears panel 45 and dynamically creates
one control per directory returned by `FindFirstFile(".\\sounds\\*")`. With
only `Sounds/sndlist.txt` mounted, the directory scan produced no sound set,
the linked-list loop created zero controls, and the immediate lookup of control
0 returned null. The caller at `0x0069CDD1` then entered the assertion at
`0x00534341` (`ChUIControls.cpp:5945`).

The Recommended install contains 16 official sound-set directories with 40
WAV files each (15 MiB total). The localhost manifest now mounts all 640 files,
which creates those directories in the VFS and keeps Play usable after a set
is selected. The exact acceptance completes Gender, Portrait, Race, Class,
Alignment, Abilities, Skills, and Appearance, then requires the populated
16-set Sound panel after the formerly failing Appearance Done click.

The local acceptance skips the intro, requires the detailed menu frame, clicks
Create Game, requires the large transition to Party Formation, opens a
party slot, and drives character creation through the Sound panel. An error
modal or a generic menu-frame change can no longer satisfy the test. The CLI
capture must retain the menu labels and the Prologue title/buttons as real
light GUI-font glyphs; detailed stone artwork without dynamic text is a
failure, even if the same run later reaches gameplay.

`test/test-icewind-dale-menu-web.js` applies the same label-band gate to a
fresh, no-cache Chrome page and also requires the browser VFS to contain the
2,942,485-byte `Dialog.tlk` plus `Data/GUIfont.bif`. It keeps sampling the
actual 640x480 DirectDraw layer for another 30 seconds after the first complete
menu, so a transient first-good frame cannot satisfy the browser regression.
The repeated blank-label reports were not explained by a stale tab: a later
fresh-page report disproved that earlier diagnosis. Repeated exact Chrome runs
kept 738 label glyph pixels throughout the sustained sampling window; no
runtime change is claimed without a reproducible failing transition.

It then names the character `CODEX`, accepts the party, waits through the real
first-area resource load, and requires the native `PROLOGUE` chapter screen.
The chapter narration body is currently blank, but `REPLAY` and `DONE` render.
Pressing Escape hides this panel without completing it and exposes the tavern
under Infinity's `Paused for chapter text` lock—the exact state previously
misclassified as playable because the acceptance treated red status glyphs as
success. The corrected route activates `DONE`, captures the unpaused tavern,
clicks a distant floor point, and requires the created character's pixels to
move. Acceptance then requires the native multiplayer-session state at
`mpsave/default/icewind.gam` and verifies that its party bytes contain
`codex`; the old `NO DISC IN DRIVE D:` screen and a loading image can no
longer count as gameplay, and neither can a static paused HUD. The demo's Q
path did not produce a complete numbered save slot under emulation, so the
test does not mislabel that unavailable path as the persistence contract.

The app opts only authored state into browser persistence (`Characters`,
`Save`, and `MPSave`). A fresh-Chrome regression writes the native default
multiplayer session through the browser VFS, reloads the page, attaches a new
VFS under the same `icewind_dale_demo` app id, and verifies one restored
app-scoped entry whose bytes still contain `codex`. This covers the actual
multiplayer session path written during character acceptance rather than
treating temporary files as saved character state.

An exact browser run with cross-origin isolation and Threads enabled reached
Party Formation with four secondary guest workers. The manifest-driven CLI
acceptance reaches the first-area HUD and native default session save with the
same dropdown asset list.
