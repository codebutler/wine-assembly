# D3D9 real-pixel oracle: scoped corrections; pixels remain unexecuted

Independent input was harness `a518fdba38985cafc52beddf76e7d6845fa97019`
from `task/d3d9-clear-real-webgl-pixels-oct24`, based on production
`36ca14d2806bd839a7918f99f1d844d5cb9fc8c3`. Donor HEAD, actual strict-SSH remote
branch and all eight published receipt seals were verified once before an isolated
non-cone sparse checkout. Production files and existing production probes are unchanged.
The source identities and trusted SSH argv are in [checkpoint.json](evidence/d3d9-real-pixel-oracle-independent-20261024/checkpoint.json).

The original harness needs corrections before accepting a future browser run:

- Its classifier accepted an intended pixel mismatch together with a failed
  `actual-renderbuffer` check. A pure classification reproducer accepts that
  invalid result under the original rule and rejects it under the corrected rule.
  Checks now identify pixels, capability and validation separately; every control
  must complete the same unique check inventory, pass capability/validation,
  report no errors, and fail a specified pixel observation. Candidate acceptance
  derives from individual observations rather than trusting a summary count.
- An external TERM killed the original supervisor before its cleanup finally ran.
  The original AST-derived supervision body, executing harmless owned children,
  leaked both its ordinary child and a detached descendant. The test controller
  killed and reaped those baseline leaks. The corrected supervisor catches TERM
  and INT, ignores repeats during cleanup, handles the spawn transition, and sends
  KILL after a 4.5-second TERM grace inside the five-second limit. Ordinary TERM
  remains unblocked in children. The fixed fixture requires both processes absent
  and reaped; a separate nonzero fixture must retain exit 7.
- Original CPU sampling omitted reaped descendants' CPU. The real-process fixture
  measured 1 baseline tick versus 22 including reaped-child CPU in one retained
  run; exact final measurements are in the receipt. Sampling now includes
  cutime/cstime, supervisor-reaped usage and a terminal CPU check. The 60-second
  limits are unchanged. SQLite growth now charges allocated blocks: the rejecting
  one-byte fixture was charged 1 byte originally and 4096 after correction.
  The running supervisor also checks the host free-space floor.

Retention tests previously established their initial contents through the clear
path under test. The fixture now seeds those contents directly through GL, outside
RenderClear, Device.clearCommand and wrapper.clear. It saves and restores clear
values, masks and scissor enable so production caches are not invalidated by the
observer. Color-only reseeding preserves existing depth/stencil for later draws.
This removes a shared initialization dependency; its real-GL execution is still
pending. Fresh-allocation cache tests deliberately retain their production paths.

The observation design uses a direct GLSL full-screen triangle, explicit window
Z (.25/.5/.75 comparisons), LESS depth testing, EQUAL stencil testing and KEEP
stencil operations. Observer draws disable depth/stencil writes. RGBA readPixels
therefore tests stored attachment effects rather than clear-value cache entries.
Its row flip converts bottom-left readback to top-left expectations. Asymmetric
rectangles and all sixteen channel masks discriminate clipping, origin and masks;
retention expectations now begin from independent uniform GL seeds. Format 80
(D16) and 75 (D24S8) checks query actual renderbuffer depth/stencil sizes, with
allocation/completeness/GL errors failing the harness. This is a review of the
observation mechanism, not measured precision or successful pixel execution.

Source-assembly tests bind all seven recorded production/historical source hashes,
verify the rectangle mutation is exactly one replacement, and evaluate the real
factories five times in one VM realm without constructing a Device or GL context.
Each evaluation replaces its constructor, including candidate after controls.
The CDP path evaluates these source snapshots directly and hashes the same bytes;
it uses neither Node require caching for production modules nor network imports.
Dependencies are snapshotted once and evaluated for every variant. Producer
`ffe822a9d50ad79439330609915eb84475acd2bc` is only the historical Device with
current GPU; intermediate `77180c76b312efe465ad91e60286d40330d77d0d` is only the
historical GPU with current Device. Neither is a whole historical build.

Focused checks passed: five syntax checks; deterministic source assembly and
factory replacement; twelve rejecting classification controls (capability,
validation, allocation error, candidate error, spoofed total, inconsistent pixels,
absent pixel count, missing checks, duplicate check, unrelated mismatch, missing
identity and missing variant); baseline/fixed TERM leak controls, repeated TERM,
KILL/reaping, child TERM unblocking, nonzero exit propagation, reaped CPU and
allocated SQLite growth. These are offline source/classification/Linux-process
checks. No mock GL qualifies pixels. Commands are:

```
node --max-old-space-size=256 tools/test-d3d9-real-oracle-offline.js
python3 tools/test-d3d9-real-supervisor-offline.py FRESH_OUTPUT ACCOUNTING_JSON
```

The Python offline test requires Linux and runs only owned harmless fixtures;
its baseline supervisor body is extracted from the immutable input commit.
Fresh cheap-memory admission used >=805306368 bytes, CPU/wall 60 seconds and
Node heap 256 MiB. Full raw child fixture records remain in the task allocation.
Compact committed [offline receipts](evidence/d3d9-real-pixel-oracle-independent-20261024/supervisor-offline.json)
and [source/classification receipts](evidence/d3d9-real-pixel-oracle-independent-20261024/oracle-offline.json)
record actual observations rather than browser claims.

At the single post-review browser check, **2026-10-24T08:21:46Z**, MemAvailable
was **2357481472**, below **2684354560** by **326873088 bytes**. Relative to the
original 2413625344-byte denial, capacity decreased 56143872 bytes. The supervisor
returned 2 before Node/CDP or Chrome. Its measured projection was 46033280 of
67108864 bytes; owned bytes included full current-worker external session/events,
positive SQLite growth and directory blocks, plus 20 MiB future, 12 MiB browser
increment and the 8 MiB reserve. Host free was 3805032448 bytes, with projected
increment leaving 3763089408 >=2982150144. There was no browser retry. The later
cleanup-only grace adjustment does not change this admission result; final source
identities and offline cleanup retest are separately retained.

**Candidate, producer hybrid, intermediate hybrid and rectangle mutation pixels
are all UNEXECUTED.** Chrome, real GL, renderer/extensions and PNGs are unavailable.
No hardware/software renderer acceptance, full-module build, COM rerun, guest,
gameplay or production rendering repair is claimed. No production defect was
established. Future pixel execution requires a coordinator-assigned task and an
actual capacity recovery, fresh complete admission, and the unchanged real memory
threshold. If a software renderer eventually runs, acceptance must say software.

Ownership: `/tmp/d3d9-real-pixel-oracle-independent-oct24/repo`, branch
`task/d3d9-real-pixel-oracle-independent-oct24`; no main integration. Recover
committed helpers/receipts by fetching that branch. Uncommitted full session,
fixtures, original supervision AST, resource/history and publication receipts are
retained under the task allocation; Git is not their backup. Donors/root tracked
files, index and refs stayed read-only; only the shared board was appended. No
workers, tools installed, mounts, external boxes, lifecycle operations, deployment
or full build. Box ID/state/expiry N/A; coordinator retains lifecycle ownership.
