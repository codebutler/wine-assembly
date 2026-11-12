# Enigma bounded staging repair — 2026-10-26

Implemented `tools/enigma-bounded-staging.py` and an executable replacement
`verify-and-stage.py` recipe. The operation streams required inputs in 8192-byte
chunks into an exclusively owned new tree. Matching font files under
`runtime/fonts/` and `runner/fonts/` share one **newly copied owned inode** with
read-only permissions. Both required paths and every content byte remain.
Non-font files stay independent even when their bytes match. There are no donor
hard links, symlinks, persisted transfer buffers or copied tool installations.

All required duplicate donors are rehashed before creating their aliases.
Missing, oversized, truncated or changed inputs fail closed. Only the fresh
invocation-owned temporary tree is removed after errors or interruption; existing
destinations (including symlinks) are rejected. Publication is one directory
rename. The destination parent must be exclusively owned, with no concurrent
publisher. Consumers must treat the host font tree as immutable: do not chmod or
write linked fonts. These paths are host dependencies, outside the guest `vfs/`
tree. This does not deduplicate writable guest files or change any accepted
supervisor, guard, runner, module or source pin.

## Evidence and scope

Base: `86ac66885c45866c2cbd57cb464cddccadca6893`, borrowed through flat read-only
Git alternates. `input-pins.json`, `historical-standing-identities.json` and
`historical-supervisor-identity.json` preserve the historical pins, including
module SHA-256 `8fac39936b6df2418ad86cab118cef19a65a727f649fbc14c412b37818904686`,
source `b41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a`, ABI 291 and layout
`9a3bc9149d58209c`. The runner remains revision
`d8cd8c54c8d63c107696f1e4ef7a1e229dcadc1e`, SHA-256
`4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809`.

`required-manifest.json.gz` restores the original manifest byte-exactly (SHA-256
`4ccbdd4e9bab80a88bf9565f813681c5369e4b16ef5dcd34291b87c361a793fe`).
`verify-and-stage.py` was executed in verification-only mode: all 2659 required
sources, totaling 37,476,538 logical bytes, were streamed and rehashed without
materializing a guest payload. `source-verification.stdout` retains the 29 font
aliases, sizes, hashes and canonical paths. Logical duplicate font bytes total
712,744; their measured 4 KiB allocation saving is 786,432 bytes.

Run the focused regression with:

```
python3 -B test/test-enigma-bounded-staging.py
```

Seven tests pass under a 16 MiB Python data limit, 60-second CPU limit and 24 MiB
file limit. Fixtures generate synthetic bytes in bounded chunks with the exact
72 retained font paths, sizes and multiplicities; no real font/media payload is
copied. Every output size and hash is checked. Old and repaired trees have the
same 6,168,021 logical bytes, including three representative non-font controls.
Measured allocation falls from 6,414,336 to 5,627,904 bytes. Path-summed allocation
is unchanged, proving why counting each owned physical inode once matters.
The baseline allocation fails both historical budget assertions and the repaired
operation passes them. Tests also reject changed duplicate sources, missing file
and Git inputs, changed sizes/content, unsafe paths, existing evidence, and link
errors; interruption cleans only invocation-owned disposables. The CLI is tested
with both real file and pinned Git-blob fixture inputs.

## The two retained failures are different snapshots

Neither historical FAIL is rewritten as PASS. `historical-resource-ready.json`
records the original peak **67,547,136**, cap 67,108,864, excess **438,272**.
`enigma-staged-capture-fresh-admission-oct26.json` is the later coordinator
retained/new-worker projection: peak **67,588,096**, excess **479,232**. The later
receipt follows lossless manifest and index compression reclaiming 1,511,424
bytes, and uses updated local/session/database and future-worker charges.

Compared with the original, its retained local charge increases by 24,576,
session/launcher by 458,752 and positive database highwater by 774,144; its future
worker charge replaces the original session future plus 1,216,512 checkout future.
The net snapshot difference is **40,960 bytes**. It is not another measurement
of the same original failure and is not a changed cap.

`projection-comparison.json` changes only remote owned physical font allocation
in each snapshot; all other charges, transfer overlap, capture/publication,
positive database/session history and **8 MiB reserve** remain identical:

| Snapshot | Baseline FAIL | Repaired projection | Headroom |
| --- | ---: | ---: | ---: |
| Original ready | 67,547,136 | 66,760,704 | 348,160 |
| Later retained | 67,588,096 | 66,801,664 | 307,200 |

This comparison uses the demonstrated 4 KiB allocation model. It is **not an
actual remote staging measurement or a fresh runtime admission**. New helper and
recipe files fit inside the existing unchanged checkout/helpers future allowance;
no additional standing tool exemption is used for new files. All newly owned
bytes in this repair task, including Git, evidence, session, launcher, positive
database growth once, future growth and reserve, are separately covered by the
fresh task admission receipts. Installed tools and standing donors are inventoried
separately, never copied or hard-linked into the staging tree.

## Recovery and remaining gates

The replacement recipe defaults to verifying the retained manifest. On a host
with the pinned standing inputs, `--stage NEW_DESTINATION` invokes the actual
streaming operation. That full staging option was **not run here** and requires
new explicit task/resource admission; do not stage the 37 MB payload locally in
this repair allocation. An API transport must apply the same canonical/alias
plan within a new owned target and rehash every destination; this offline recipe
does not contact Boat or claim transport qualification.

`account.py` and `run-tests.py` preserve the actual worker wrappers; replay them
from the original sibling `ops/` directory, with its retained SQLite baseline.
For a fresh task, take a new baseline and bind its own session/launcher instead
of reusing the old worker's admission. `standing-donors.json` measures borrowed
objects and standing input files separately; `standing-tools.json` pins the
installed executables. No borrowed object or source is a new task-owned copy.

Before any guest attempt, the coordinator must admit the complete retained plus
new task footprint, verify target filesystem allocation and immutable-font
contract, preserve history, validate the exact launch configuration, and allocate
exclusive runtime ownership. Exact historical filename-bearing argv was checked
again with the canonical parser under Node's 16 MiB heap; all 2659 intended paths
are enumerated in `parser.json` (2460 VFS files, no comma filenames). The unchanged
parser receipt was read before checkout; fresh execution occurred after checkout
and before source verification. No conditional runtime operation occurred.

Initial regression failures are retained in `tests-first.*`: a fixture buffered
font contents under the 16 MiB data limit and the helper initially accepted `.`
as a target. The fixture now generates bounded chunks, and `.` is rejected.
The initial temporary test allowance was 4 MiB; the measured simultaneous fixture
trees need 12,042,240 bytes before small parent/Git overhead. It was corrected to
16 MiB and the exact final suite rerun under a fresh passing admission. No resource
limit or test oracle was weakened. `checkpoint-tests.json` binds the passing
group to source/test/input hashes. Historical source and failure evidence remain
unchanged in the donor.

No build, guest, frame capture, gameplay, Boat operation, service, lifecycle
mutation, main change or worker launch occurred. Testbox ID/state/expiry: N/A to
this offline task; the user reports prior boxes STOPPED, without a new API check.
The coordinator retains lifecycle ownership. Publication is only the task branch.
