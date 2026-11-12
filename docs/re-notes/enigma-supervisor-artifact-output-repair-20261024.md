# Enigma supervisor artifact/output separation — producer handoff

Base: `010bb7c2176d0f783b56657cff1b2848ebd102d2`. Producer task branch only;
no main merge, guest, native module, acquisition, deployment or box operation.

The pinned original supervisor applied `RLIMIT_FSIZE=131072` to both PNG files
and redirected stdout/stderr. That prevented the accepted explicit single-frame
profile from writing its otherwise valid larger PNG.

`transformSupervisor` now derives its artifact allowance from the existing
validated profile definitions: default 131072 bytes; explicit `single-frame`
2097152 bytes. Other profile names reject before launch. The original supervisor
SHA pin and unique-anchor checks remain mandatory. The original comes from the
exact committed `original-supervise.py.gz`, not an already transformed source.

The child receives one pipe for combined stdout/stderr. Only the supervisor owns
the log, and each read is bounded by the remaining 131072-byte retention budget.
The reader preserves fault detection across chunks and stops on the first
recognized fault. Cleanup drains remaining pipe data after child exit, closing
the poll/EOF race. This is independent of artifact file limits and does not rely
on logfile-size polling to prevent overshoot. Guards and nonzero child outcomes
finalize nonzero before shell-AND dependent work. The capture receipt's strict
validation and original writer-error identity remain intact.

The original TERM/KILL/subreaper cleanup structure remains, with its TERM grace
shortened from five seconds to one so KILL and reaping fit inside five seconds.
Default PNG frame/cumulative limits remain 3/393216; the explicit profile remains
1/2097152. No codec, dimensions, pixel identity or receipt error rules are loosened.

## Executed evidence and limits

Six suites passed: lossless PNG, independent lossless, terminal guard, single-frame
profile, supervisor exit, and the new complete-supervisor regression. The latter
executes the real transformed Python program and real Node capture preload,
kernel RLIMITs, stdout/stderr pipes, process groups and subreaper cleanup.
It adapts only historical deployment admission literals: expired cutoff, actual
UID, memory floor reduced to 805306368, and CPU reduced to 60 seconds. The
production transport/finalization code is unchanged. Exact adaptation hashes and
the configured source from the last attempt are retained in the adjacent evidence.

The passing full run (`full-supervisor-final-r2.log`) verified:

- 640x480 high-entropy PNG, 1229723 bytes, exact RGBA identity; default rejection.
- Actual kernel file caps 131072 and 2097152; default oversized raw write and
  >2MiB raw write reject at their respective kernel boundaries.
- A valid PNG with a CRC-correct ancillary chunk over 2MiB rejects before artifact
  write; writer EIO keeps the original error object and prohibits later writes.
- Fast/slow combined stdout/stderr floods retain exactly 131072 bytes and fail
  finalization. The EOF case freezes the real supervisor between turns, lets the
  writer exit with buffered output, then resumes it; child returncode zero still
  yields output-guard/nonzero. Removing final drain is rejected by this oracle.
- TERM-resistant child and grandchild are KILLed/reaped in 1.078 seconds, with no
  remaining group or PID. Shell-AND dependents remain absent on rejection.
- Invalid profile, natural nonzero child exit, and fast observable fault reject.
  Removing pipe retention permits 240000 bytes and is explicitly rejected as a
  mutant; those bytes are not a successful production-output result.

The existing exit/terminal suites retain malformed/oversized receipt controls,
capture-exit reverting mutation, poll/cleanup/publication error controls and EIO
identity tests. Their extracted-tail mocks now explicitly supply the output
interface; the additional full-program regression uses no transport/OS mocks.
The prior historical child-exit-zero oracle is strengthened to require nonzero
child/guard propagation. The receipt helper still compares to its historical
oracle, including the same explicit single-frame validation.

## First resource rejection — final acceptance pending

After the six passing suites, a final full-program run added optional emission
of exact transformed/configured source and results for sealing. Its accept case
failed the original supervisor's real disk admission expression
`free - 60000000 >= 2982150144` **before child launch**. That establishes free
space below 3042150144 at that instant; the instantaneous value was not captured.
No dependent test execution was retried. The failed run is not called a pass.
The production transformation SHA is identical to the previous passing full run.
The only later test change adds optional evidence emission and exact admission
metadata; final-tree full acceptance remains pending.

Earlier preparation/test failures are retained: an ambiguous cleanup anchor,
Node flood fixture short-write/EAGAIN behavior, a VM-relative module path, and a
timing-sensitive EOF-mutant control. These were corrected before passing runs;
none is hidden or treated as a resource-admission pass. The real resource
rejection is separately retained in `first-resource-rejection.json`.

Resume condition: a coordinator-assigned final full-supervisor evidence run
under fresh, stable disk admission. Independent review and integration follow;
the producer does not merge. No authentic game/runtime claim follows from these
synthetic tests, and authentic frame/menu/gameplay fit remains unknown.

## Recovery and accounting

Live ops: `/tmp/enigma-supervisor-artifact-output-repair-oct24/ops`.
`run-check.py` owns cheap-test admission: available memory >=805306368, Node heap
256MiB, CPU/wall 60 seconds, combined tool capture <=131072, file <=24MiB.
It does not compile or instantiate a canonical module. Source fixtures and PNG
codec use verified existing read-only inputs. No installed-tool copy is charged
as a new artifact; task-owned source/Git/temp/evidence and all full external
session/launcher history, positive SQLite growth, future growth and 8MiB reserve
are charged. Another 64MiB reservation is included in host-floor projections.
Initial projection was 52336073/67108864 bytes. The later preservation ledger is
retained separately; it does not erase or retry the first rejection.

Adjacent `artifact-seals.json` binds source, receipts, command logs and original
Git inputs. Local/remote commit verification and final accounting are ops
receipts written after the commit, avoiding self-referential commit claims.
The board watcher and all owned subprocess groups are reaped; no box was
assigned, and lifecycle ownership remains with the coordinator.
