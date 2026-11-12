# Mad Bomber browser acceptance — 2026-10-21

ACCEPT `27c3bb0adba86db7e12786a00df5c6689a97adec` for bounded ordinary
registered browser gameplay. Fresh remote main was reconciled at
`0c0fa3ebd7a84b6254a160c6cdfa6774c556d4cb` before integration. This review
selectively imports the producer's two Mad Bomber notes and 111 evidence files;
it changes no production code, root task/status ledger, assets or deployment.

## Independent observations

Eight original PNGs were opened: first window startup, one-player,
bucket-center and window-after; second window catch-4600, catch-5200,
catch-6800 and window-after. The first window shows menu selection, falling
bombs and moved buckets but stays at score 0. The second shows score 0 at
4.725 seconds, a catch splash with score 1 at 5.337 seconds, then a splash
with score 3 at 6.891 seconds and buckets farther left. Both final images say
Press Fire with two buckets; second-window score 3 persists. These are actual
snapshot timestamps relative to window start, not filename offsets.

Both scripts and command plans were inspected. Enter and Space use paired
Puppeteer keyboard down/up; focusing and bucket movement use page.mouse.
The only page evaluation reads DOM text and canvas geometry. No guest-memory
writes, API replacement or injected observer establishes the result. The
registered localhost deep link goes through index.html's ordinary launchApp
route, lib/apps.js's original Mad Bomber manifest and threads:false. The
unchanged Notepad dropdown is not the running app: title, original game image,
EXE network request and launch log identify Mad Bomber.

New offline checks authenticate 111 retained candidate files against exact
Git blobs, 6,908 staged and 7,299 canonical-build manifest entries against
their respective Git trees, and all 40 ordered action/snapshot records against
the two plans and actual times. Both successful network responses correspond
to the recorded hashes of actual response bodies, not merely a disk module:
`728e1de80ec20a284fc41b339895ee8ac29f16e4ded83325b27576cfacd4466c`,
1,878,508 bytes. Windows last 60.201 and 60.197 seconds including final
capture/close. Terminal receipts show both harnesses exited 0; cleanup records
show six owned PIDs absent and port 8080 closed. This is bounded harness exit,
not completion of the game.

Exact Git comparison from canonical build
`30a2c3fb1b5c2bfa8a6b001d7394d5cf50df295d` to tested main changes only
docs/evidence/status and two Army observer tool/test files. Neither tool occurs
in either actual browser network log or this capture harness. Production,
compiler/build and browser-host inputs (including package-lock, host, index,
registry, WAT closure and region map) are unchanged. Canonical successful
build logs and pre/post source/168-asset/2,407-dependency receipts are reused;
there was no new build, runtime execution or asset extraction.

The producer verifier was independently replayed successfully: 108 seals,
6,908 source entries, 168 asset pins, 2,407 dependency entries, two sessions,
14 PNGs and 40 timestamped records. Those are checks of retained sealed
records; no live remote filesystem was rehashed. New checks are reproducible
with `python3 -B docs/reviews/madbomber-browser-integration-20261021/verify.py`.
Review outputs are in
`scratch/runs/20261021-madbomber-browser-independent-integrate/`.

## Evidence sufficiency and limits

The selected 14 original images plus full bounded input, snapshot,
console/network/error, provenance and exit records suffice for these narrow
claims. They are committed directly; no archives are copied or repackaged.
The full 17,791,642-byte remote archive exceeded the producer's transport cap
and was NOT independently available or verified here. Its producer-recorded
hash is only a recovery reference. This review does not imply every remote
capture was inspected or recovered.

Empty page-error arrays do not erase diagnostics: autoplay warnings, optional
build-info/icon/favicon 404s and aborted requests remain recorded. FPS, audio
quality, sustained play, full completion and Windows parity remain unqualified.

Producer reports and recovery notes describe a historical RUNNING handoff.
The coordinator receipt supersedes it: bx_j693sabt snapshot-stop
`stop_de5a4e06823d7665` completed at `2026-10-21T17:23:04.958Z`, error null;
prior expiry was `2026-10-21T19:06:34.564Z`. No box was accessed, created,
resumed or stopped by this review. Lifecycle remains coordinator-owned.

Admission was independently checked at 3,406,315,520 free bytes against
2,982,150,144 required including the 64 MiB allocation. Candidate projection
is 10,778,986 bytes, below 16 MiB. The isolated sparse task worktree preserves
shared WIP; publication receipts record final allocation and exact remote refs.
