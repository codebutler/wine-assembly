Messiah MCI contract investigation — 2026-10-20

MESSIAH-AUDIO-FPS-CONTROLS-20261012 remains blocked on original trace/media
evidence. This task demonstrates and fixes six incorrect error constants in
four MCI functions. It does **not** establish that correcting these constants
removes Messiah's initial open warning or its later audio-CD overlay.

Base: origin/main `682d0c824a0289e502276fb814c368e9e1970d57`, verified against
the remote before exact-file sparse worktree creation. Existing Z-buffer,
registration, recovery and documented `-i +!` work was read, not repeated.
No game, browser, full build, Boat or remote runtime was used.

The historical `messiah-demo.md` records the 0608Z MCI_OPEN call at 4015dd:
message 0x803, flags 0x2000, device string `cdaudio` at 7fd030. It records
host open returning zero without a mounted disc in 0609Z, and the overlay
in 0659Z. These are secondary notes. Recursive local filename inspection of
scratch (including ignored files), ops, and origin/main's tracked inventory
found only the October 14 source/recovery receipts, not the original
0608Z/0609Z/0659Z trace logs or their parameter/return dumps. `ops/runs`
does not exist here. Remote historical snapshots were not accessed.

The current app registration has no `cdAudio` mount. The pinned recovery
manifest contains 300 files and no `.cue` file; this does not prove that
there is no music inside proprietary containers, or that a retail CD is
required by this demo. Installer acquisition/extraction receipts establish
file recovery, not a CD TOC or audio-track payload. No original media was
downloaded, synthesized, mounted or substituted.

Primary contract checked on 2026-10-20:

- [MCI_OPEN](https://learn.microsoft.com/en-us/windows/win32/multimedia/mci-open)
  initializes a device/file; zero means success. TYPE and TYPE_ID govern
  string versus numeric device selection. This page alone does not say that
  an emulator with no installed optical device must manufacture one.
- [MCI_STATUS](https://learn.microsoft.com/en-us/windows/win32/multimedia/mci-status)
  distinguishes MEDIA_PRESENT from READY. An opened CD device can report
  absent media; a failed open supplies no valid device ID for those queries.
- [General MCI errors](https://learn.microsoft.com/en-us/windows/win32/multimedia/general-mci-errors)
  distinguishes invalid device ID, absent/unrecognized device, and readiness.
- Microsoft's [SDK mciapi.h](https://raw.githubusercontent.com/microsoft/win32metadata/main/generation/WinSDK/RecompiledIdlHeaders/um/mciapi.h)
  defines INVALID_DEVICE_ID as BASE+1 and DEVICE_NOT_READY as BASE+20.
  The old 0x106 is HARDWARE and 0x115 is INTERNAL. Open's existing 0x107 is
  INVALID_DEVICE_NAME, despite its misleading source comment.

Actual-handler evidence:

`node test/test-mci-cdaudio-no-media.js` compiles only the production
`handle_mciSendCommandA/W`, slot helpers and error-string handler using the
vendored compiler, connecting them to the actual `createAudioHost` imports.
The fixture supplies identity address translation and a 64KiB arena, not
modeled MCI behavior. It contains no media and no fake audio playback.
Three topologies are tested: absent VFS drive metadata, an empty CD map,
and DRIVE_CDROM metadata without a disc map. The last is only a diagnostic
input; it does not establish an installed Windows CD driver.

Across all three topologies, A/W × string/numeric type open still fails
with 263, leaves the output device-ID sentinel unchanged, and allocates no
host device or guest slot. String open leaves no alias. Invalid IDs
0/1/16/0xffffffff exercise MEDIA_PRESENT, READY and NUMBER_OF_TRACKS,
play and close rejection, including A/W and direct host boundaries.
These are invalid-ID negative controls; no successful empty-device status
or track-count result is claimed. Stdcall ESP increments and output sentinels
are checked. The current error-text handler returns FALSE and an empty
string for open error 263; this is recorded as a separate retained gap,
not treated as evidence that the error is unknown on Windows.

Minimal correction: change only two invalid-ID branches in each A/W command
handler from 0x106 to 0x101, host `_mciCommand`'s invalid-ID return likewise,
and `_mciStringCommand`'s no-disc return from 0x115 to 0x114. Null-parameter,
other error paths, open policy and error-text implementation are unchanged.
No MIDI function or lifecycle test is edited.

Validation: baseline fails the new contract assertion (277 != 276);
candidate passes. Six independent in-memory reversions, one for each changed
constant, each fail the relevant exact numeric assertion (262 != 257 or
277 != 276). These controls run the same actual handlers; they do not fake
successful open or playback. Syntax/diff checks pass. This qualifies only
the extracted MCI composition, not full VM/native/game integration.

Evidence: `scratch/runs/20261020-messiah-mci-contract/` contains baseline
source identities/snapshot, pre-correction diagnostic, before/after results,
six negative controls, final patch/snapshot hashes and remote receipt.
Replay: run the test from the task checkout or retained `candidate/`, then
`node negative-controls.js candidate` from the evidence directory.

Required next evidence, before changing CD-device/open semantics: recover
0608Z/0609Z and 0659Z original logs with build/module identities, actual
MCI return values and subsequent status/play calls; establish the configured
optical-drive topology and genuine demo audio-media/TOC availability. If
those logs cannot be recovered, a separately authorized serialized trace
and an equivalent Windows empty-drive/no-drive comparison are needed.
An open success alone cannot make absent CD audio readable. The initial
warning and later overlay must not be collapsed into one proven cause.
