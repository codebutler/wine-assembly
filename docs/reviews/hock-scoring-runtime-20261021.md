# Hock-A-Loogie original-game scoring: 2026-10-21

## Offline publication review (2026-10-25)

**ACCEPT, historical bounded scoring only.** Exact remote main
`eeb4b3372c8b18361dae83509652b67281f67d0c` already contains this report's
prior independent review, the Hock scoring note and the byte-identical candidate
archive from `54b0ee54ba8053d7d430350dc332e1ff1ddcce92`. This publication
preserves them and adds this qualification; it does not replay a historical
patch over later notes. No TODO/status history is imported or changed.

The reviewer independently inspected sealed run2 shot-02/final images showing
0/20 at timer116 and 5/20 at timer59, the real mouse-input driver, timings and
read-only score dump. The archive's SHA256 is exactly
`2561cd2b2051cf6ba53bab01799d9564705926919294c32dd8d2423cb49b3f99`;
unchanged coordinator verification of 118 outer and 53 nested seals is reused.
Altered archive bytes and an altered expected hash are both rejecting controls.
The historical runtime `776d37d55d2f749dcb29203e3bd26b8a5e9c05bd` and
historical main `d2034ccf750f2482fa78012b30039800e75b9f54` independently match
all 5,017 inputs under the archived mapping rule. Module, source-manifest,
package and EXE identities below remain historical evidence. They are not a
build or runtime qualification of eeb4b337 or of this documentation revision.

Earlier registration/status statements below are dated review history, not a
fresh evaluation of today's backlog. Exact struck target/collision instant,
completion, audio, FPS, Windows parity and broad goal completion remain
unqualified. No build, runtime access or replay occurred. bx_c6f3np32 is
coordinator-reported stopped; historical running/expiry wording below records
the original handoff only. Lifecycle remains coordinator-owned.

Independent acceptance, integrity tests, resulting-tree checks and publication
receipts: `/tmp/hock-scoring-reviewed-publication-oct25/ops/` on the review host.

## Independent integration review (2026-10-21)

Accepted report commit `54b0ee54ba8053d7d430350dc332e1ff1ddcce92` against
upstream main `d2034ccf750f2482fa78012b30039800e75b9f54`. The delta contains
only this report, its evidence archive, the Hock investigation note and relevant
status updates; production inputs remain unchanged. Archive SHA256 is
`2561cd2b2051cf6ba53bab01799d9564705926919294c32dd8d2423cb49b3f99`.
The reviewer matched that exact archive to the coordinator's successful 118
outer/53 nested seal verification, inspected actual run2 shot-02/final PNGs,
drive2.py, timings and score-dump log, and accepted visible 0/20→5/20 scoring.
The driver issues mouse input, captures and read-only dumps; 135 events and
72.274-second exit0 alone are not the visual acceptance criterion.

The archived integrated-identity receipt maps the runtime candidate below to
d2034ccf's previously verified 5,017 identical non-documentation inputs. Its
referenced integration identity file SHA256
`c8ca21c73655db44dc6f2fe3e3a2c4aa3f1d79df99135d6be1caecafd04dfb78`
and source-manifest SHA256 were checked against the actual retained files.
Canonical/compat hashes and original package/EXE identities below are retained;
no rebuild or runtime access was needed or performed.

TG103's current Done condition is original-game registration, player-controlled
gameplay and reviewed screenshots with exact source/runtime evidence. This
accepts gameplay/scoring and reviewed evidence. Registration is **not
established**: main's lib/apps.js and test/candidate-corpus/manifest.json have
no Hock/BBLOOGIE entry, and the preserved route uses explicit --exe. TG103
therefore remains open. This does not promote whole-game completion, audio,
FPS, Windows parity or exact collision/target attribution, nor close a broader goal.

Historical lifecycle wording below describes the scoring worker's handoff.
The coordinator subsequently snapshot-stopped bx_c6f3np32 successfully at
2026-10-21T06:53:53.444Z (stop_5926740f3d3e7781, error null); its former expiry
was 08:14:54.696Z. Integration did not access or resume the box. Capacity hold
was resolved before this isolated sparse review; root WIP remains untouched.
Local review/recovery receipts: scratch/runs/20261021-hock-scoring-recovered-integrate.

## Original runtime report

**PASS, bounded scoring evidence:** unmodified original BBLOOGIE.EXE accepted
mouse charge/release input and increased the visible score from **0/20 to 5/20**.
Two targeted runs were used; no third run, production fix, rebuild, main merge,
new game, deployment or worker assignment was performed. This is not completion,
audio, FPS or Windows-parity qualification.

## Evidence and observed behavior

The sealed companion `hock-scoring-runtime-20261021-evidence.tgz` contains the
exact drivers, commands, wall-clock input timings, complete logs, PNGs and
source/package identities. Extract it and verify `SHA256SUMS.json` and the nested
`runtime/SHA256SUMS.json` before review. The runtime archive's 53 seals were
checked after download. No game memory, bytes or state were edited; the only
guest-memory operations were two read-only diagnostic dumps per run.

| Run | Real input | Actual result |
|---|---|---|
| run1, 58.274 s | Select left character with a 250 ms click; 15 left-button holds at canvas (320,250), cycling 150/300/450/650/900 ms, 2.8 s apart | Visible projectiles, but score remained 0/20; after capture timer 76. All 54 input/capture commands acknowledged; exit 0 at the wall-clock limit. |
| run2, 72.274 s | Same selection; 36 holds at (308,250), cycling 650/800/950 ms, 1.55 s apart | Score 0/20 at timer 116, still 0/20 at timer 67, then **5/20 at timer 61** and final timer 59. All 135 commands acknowledged; exit 0 at the wall-clock limit. |

The decisive inspected screenshots are `runtime/run2/shot-02.png` (0/20),
`runtime/run2/shot-34.png` (0/20), `runtime/run2/after.png` (5/20) and
`runtime/run2/final.png` (5/20). `runtime/run2/shot-20.png` also shows a projectile
and moving targets while the score is still zero. The opening `before.png`
briefly shows the original next-level banner with a 0/0 denominator; the later
gameplay captures above establish the 0/20 → 5/20 comparison.

Input acknowledgments alone are not the acceptance evidence. The visible score
increase is. A read-only dump at 69 seconds independently reads score 5 at
guest address `0x41a030`, versus 0 in the 8.1-second dump. The earlier shot-34
capture is at about 63.8 seconds; the 69-second dump brackets the observed
increase. The exact collision instant and identity of the struck target are
not established by these spaced screenshots. No additional hit count, target
type, level advance or completion is claimed.

## Original control behavior used to choose the route

The preserved original package has no `Bbgame.hlp`; the executable's Help action
names `..\Bbgame.hlp`. Its Unicode resources supply Help/Contents and the game
menus, but no control instructions. Inspection therefore used the original
EXE's code, not an invented game rule or an alteration of its state.

At `0x40445a` and `0x404475`, the game polls GetAsyncKeyState for left/right
mouse buttons and converts their held bits into flags 4/8. The active-game
handler `0x401c20` uses horizontal pointer position and starts a charged shot
when the player is ready. At `0x402ce9`–`0x402d21`, continued holding increments
the charge up to 61 logical ticks; release or the charge limit leaves that
state. Charges below 30 and charges of at least 30 use different animation and
projectile-creation paths. Projectile update `0x403060` uses the remaining
charge and the original table at `0x444210` to determine vertical travel.
These observations motivated shorter holds first, then denser 650–950 ms
charges aimed centrally. They do not establish a universal wall-clock timing
recipe across hosts. Relevant disassembly receipts are in `inspection/`.

## Exact identity and environment

- Integrated main independently checked: `d2034ccf750f2482fa78012b30039800e75b9f54`.
  Its 5,017 non-documentation inputs match the integration identity receipt.
- Runtime checkout: `776d37d55d2f749dcb29203e3bd26b8a5e9c05bd`, tree
  `2f9a39909708b323973fee6f6052433b82e6baa7`. All 7,146 tracked files matched
  their Git blobs and the sealed source manifest before and after both runs;
  runtime Git status remained clean.
- Canonical module SHA256:
  `728e1de80ec20a284fc41b339895ee8ac29f16e4ded83325b27576cfacd4466c`.
- Compat module SHA256:
  `25519647def1c2a25f505a81743d21dec55472ede8780f809edf09b6bb231018`.
- Source-manifest SHA256:
  `9918eef5f9b441693bf39f425ab988af7f5883971c451ddea53796bddae07a76`.
- All 44 package/recovery seals checked; 39 original game files, 2,224,918 bytes.
  EXE SHA256 `974f1b5ff82cfdb87f05b9840ae03cd2ed6ceebe2c8ed547253dadaf1a871ef4`.
  Original archive SHA256
  `e10d150131258641af11609249ac7f1c430e67e4138943d175b0365ba64be00b`.
- Assigned Boat `bx_c6f3np32`, Node v24.18.1, CLI full VM with JS raster renderer,
  640×480 canvas, real guest clock, existing canonical module via `--no-build`.

The prior all-gates qualification is reused only after identity verification.
No new build qualification is implied by these gameplay runs.

## Preservation, recovery and remaining limits

The final runtime archive was preserved locally at 06:43:06 UTC, before the
08:05 deadline: 4,776,090 bytes, SHA256
`ba9d1dc27096bce1299cae82b36b9191456830c1a5f7d7364f8c306cfe9f7422`.
Shared-host free space temporarily fell below the required 2,285,895,680-byte
floor. Both bulk-write guards refused allocation; the eventual transfer
buffered data in memory and waited for at least 24 MiB above the floor before
writing/extracting. Task allocation remained below 64 MiB. No unrelated files
were removed to make room.

`RECOVERY.md` in the evidence explains replay with the preserved original
package and qualified module. Runtime raw files remain in
`/home/user/hock-scoring-runtime`; the existing source/modules/intake remain in
`/home/user/hock-final-size-canonical-runtime`. The SAME box is left RUNNING,
API idle/health ok, expiry **2026-10-21 08:14:54.696 UTC**. Coordinator owns
shutdown. No stop/delete/resume/fork/create operation was issued.

The remaining narrow diagnostic, only if exact collision attribution is needed,
is a denser screenshot sequence during the last roughly six seconds of run2,
with the same genuine input. Scoring itself is demonstrated; further work on
completion, sound, performance or Windows parity is outside this task.
