# Rage of Mages demo preflight

Source: https://archive.org/details/RageofMages_1020 (item labels it Demo).
Download: https://archive.org/download/RageofMages_1020/romdemo.zip
34,080,548 bytes; SHA1 `808a0d8a0af3ec5e8b881deee666384cd2f4ed1e`.
Fetched and hash-verified on temporary bx_n9yzd3f9, 2026-10-12.
Private compatibility fixture; no public redistribution/deployment assumed.

ZIP extraction succeeds: RoMDemo.exe and RoMDemo.r00 through .r10.
The EXE is a multipart solid RAR SFX, not yet the game executable. 7-Zip23.01
reports Headers Error, Unexpected end of archive, and Unsupported Method for
rom.exe. Its output rom.exe is zero bytes and must not be launched or treated
as a valid extraction. Source archive is retained unchanged under
`/home/user/rage-of-mages-demo-preflight/` on the temporary box.

Next try a compatible RAR reader, verify extracted PE/imports and bundled
instructions, then run a bounded launch. No launch, gameplay, screenshot,
audio/FPS or registration qualification yet. This refills Oni's core lane
after its registered browser gameplay reached ops review.

unrar-free0.1.3 rejects the SFX; a separate copy with the63388-byte SFX
prefix stripped still fails (Bad RAR file). Ubuntu unrar7.0.7 also reports
rom.exe checksum error/Unexpected end of archive. No reader produced a
verified payload. Do not call this an emulator crash or conclude corruption
solely from these readers. Next inspect volume format/continuation headers
and compare an independent demo source or older compatible reader.
Exact logs/source identity: `scratch/runs/20261012T0320Z-rage-of-mages-preflight`.

## Volume audit, 2026-10-12 03:33 UTC

Fresh snapshot fork bx_5avf2969 retains the original files unchanged. All
12 volumes have valid RAR signatures (SFX offset 63388, others offset 0).
The full-sized continuation volumes vary from 2,915,138 to 2,915,171 bytes,
despite matching packed-length headers in r00 through r04. Counting newline
bytes gives 8,314–11,951 LF bytes per volume, but **zero or one CRLF pair**
in each continuation volume (two in the SFX). This is strong evidence
consistent with destructive text-mode newline conversion of compressed data;
the historical transfer mechanism remains unproven. A reader-version change
alone is unlikely to recover missing bytes. Do not insert CR before every LF:
original bare LF bytes cannot be distinguished from converted CRLF that way.

Reproduction and full counts are `audit-volumes.js` / `volume-audit.json`
in the same evidence directory. No guest execution or binary repair attempted.
The forum's romdemo.zip link points back to this same Archive item and is not
an independent source. A separate candidate is GameStar's October 1998 disc:
publisher contents https://download.gamestar.de/public/33400/33409/10_1998_cd.pdf
lists `Demos\\Rom\\Romdemo.exe`; Archive item `GSCDA1998` contains
`1998-10/GS1098.ISO`. A bounded ISO9660 HTTP-range reader is checking that
directory, without downloading the full 672 MB disc to the persistent box.
The directory is confirmed: ROMDEMO.EXE is 42,111,946 bytes at ISO sector
197989, with README.TXT, INFO.TXT and CDV.TXT alongside it. The first large
HTTP range timed out after 90 seconds; directory evidence is preserved in
`disc-fetch.log`. This is an independent candidate, not yet a verified payload.
The follow-up 1 MB chunked transfer returned HTTP 500. Retained partial bytes
are unverified and must not be extracted/launched as a complete installer.
Next resume this exact independent source when its HTTP service responds;
do not retry the damaged multipart ZIP with further readers. The temporary
box was stopped after this source-only investigation; no browser/CLI slot used.

## Independent demo recovered and launched (2026-10-12 03:46 UTC)

Direct Archive server `https://ia803103.us.archive.org/15/items/GSCDA1998/1998-10/GS1098.ISO`
accepted 1 MB HTTP ranges for the exact ISO extent identified above. Full
installer42,111,946bytes SHA256
`c27baf4367b3593e1d0572b7411ffd485319f997075d94ec15344a25a64c83bc`.
7-Zip extracts this ZIP SFX successfully (14 files,68,092,880bytes), unlike
the damaged multipart source. The PE-format warning is expected for this
ZIP SFX; extraction reports Everything is Ok. No installer execution needed.
Remote fixture `/home/user/rage-of-mages-demo-preflight/independent` on
bx_qvkda4g8; originals retained. Logs/hashes in0320Z preflight evidence.

Game `rom.exe`2,059,776bytes SHA256
`0efdb79503d9ffc851a08317d8471c300b1afb26b28866c99ef5c9f3da6fe019`;
image base0x400000, imports DirectDraw, DirectSound and bundled smackw32.dll.
All resources are in the same directory. CLI `--exe=<dir>/rom.exe
--vfs-include=**/* --quiet-api --batch-size=100000` reaches a clear English
main menu by3000batches (10.584s). The branch module hash is
`9e835f75dfe5d2fcfb91f592641e945f91baadcd20f6751460777f4dba888cd6`.
Exact commands/logs/screenshots:0347Z-rage-of-mages-first-launch.

Ordinary `3100:click:220:105` opens New Game and reaches the rendered world
with opening dialogue by7000batches (0348Z-rage-of-mages-new-game).
`7100:click:316:310` advances to the next character's dialogue (0349Z world).
These prove menu/dialogue input only, not unit movement or qualified gameplay.
The harness warns real ole32/shell32/comctl32 DLL files are absent; imports
use available WAT handlers. No ordinal trap occurred in these runs, but full
fixture equivalence is not asserted. Browser, registration, touch/audio/FPS
remain unverified. No emulator source changes were needed to reach this point.

### Ordinary selection and movement verified

0350Z-rage-of-mages-dialogue repeats OK clicks at7100..12100 in1000-batch
steps, reaching the world and a top-left tip. Close tip at(290,156) batch14000,
select the wizard at(240,309)14500. Selected.png15000 shows her portrait,
commands and health/mana bars. Click(240,230)15100 reaches another encounter
dialogue; this alone does not expose the unit position.

0352Z-rage-of-mages-movement-followup adds(316,310) clicks at20000,21000,
22000 to progress dialogue. By25000 the selected wizard is visibly near
(300,309), displaced from(240,309), while the other character and ground
landmarks stay put. These ordinary clicks establish selection and movement;
the later clicks can also issue ground orders once dialogue closes, so do not
attribute the entire route solely to the15100 click. The15500 intermediate
capture is already obscured by dialogue. Final still has a top-left gameplay
tip, but both units and the selected character's HUD are clearly visible.
Reviewed selected/final images, commands and logs are preserved; no guest
state edits. Bounded25000-batch replay exits0. Next local-only registration
and browser/touch route, then audio and scene-qualified FPS. CLI batches/s
are not FPS; no release approval or public asset distribution is implied.

## Local registration and Chromium touch gameplay (2026-10-12 04:05 UTC)

Registration `9bdf532e4` on `codex/dr2-registration` adds local candidate
`rage-of-mages-demo`, app `rage_of_mages_demo`, and direct touch with an Esc
button/keyboard affordance. It does not add the game to DESKTOP_APPS.
The manifest uses explicit manual placement of the verified installer into
`archive/ROMDEMO.EXE`, then existing `extractArchive` preparation into `game`.
Archive entry-download URLs respond HTTP200 with zero bytes on both data
servers; hash checks reject them. No working one-click download is claimed.
The full disc SHA1 is `cc199d8dc56fc2636843d625a724f9e21467f483` per Archive
metadata. Installer SHA1 is `46b0dbb02e6eafa6eaf9c334c635f9744546f094`.
Prepared14files and game EXE hash match the verified CLI fixture.

`20261012T0401Z-rage-of-mages-browser`: fresh remote build and Chrome155,
same module9e835f75..8cd6. Registered entry reaches menu. Actual Chromium
touchscreen taps open New Game, advance all six opening dialogue prompts,
close the tip and select the wizard. Step3 has her at screen(257,545);
step4 after a tap(350,550) has her visibly displaced near(355,545), while the
other character and terrain landmarks remain fixed. This is browser gameplay.
Viewport844x390 then shows the entire game with side gutters and visible Esc/
keyboard controls. Step6 after tap(390,260) moves her from about(435,260) to
(385,260), confirming touch input still maps correctly at that layout.

Menu/step1..6, exact probe/command JSON, run log, stage and module/browser
identity are preserved. Stage complete04:05:44, browser/server finally closed.
This is desktop Chromium touch emulation, not Safari or a physical phone.
Audio quality, scene-qualified FPS and broader combat/save/load remain open.
Core compatibility is ready for ops review; registration is not on main yet.

## Integration reconciliation, 2026-10-13

Recovered from `origin/codex/wsasocket-capability` at `15b37458e` during the
release merge audit. The local-only registration and its required runtime fixes
are now on main. Earlier statements that integration is pending describe the
historical run, not the current branch. This recovery adds no fresh gameplay,
audio, performance, Safari, or physical-device qualification; retain the
recorded run IDs, module hashes, limitations, and failed attempts above.


## Automated whole-disc recovery, 2026-10-14

Downloaded full672151552-byte GS1098.ISO from https://archive.org/download/GSCDA1998/1998-10/GS1098.ISO and verified SHA1 cc199d8dc56fc2636843d625a724f9e21467f483. 7-Zip23.01 exposes Joliet path DEMOS/Rom/ROMDEMO.EXE; this nested installer matches42111946 bytes and SHA1 46b0dbb02e6eafa6eaf9c334c635f9744546f094. The recipe copies it to archive/ROMDEMO.EXE and unpacks the original ZIP SFX into game/. No guest installer execution, binary repair, or configuration synthesis. The damaged alternate multipart archive is unused.

Run `node tools/fetch-candidate-corpus.js --id=rage-of-mages-demo`, then `node test/test-rage-of-mages-demo-recovery.js`. All14 files are pinned in test/candidate-corpus/rage-of-mages-demo-files.json and were byte-compared with separately extracted original source. rom.exe matches the previously recorded SHA256. Restored-fixture differences: none. Full-disc recovery requires roughly1.5GB free temporary/output space, includes unrelated disc material, and remains a private fixture. Original-game runtime/audio/FPS and public deployment were not tested.
