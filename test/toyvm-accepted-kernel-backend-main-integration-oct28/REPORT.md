# Current integration boundary

This source-only integration starts at remote main
`52503470c1d336fc894f74b7ab0e989ec0454859`. It transplants the finite 15-file
closure from independent acceptance `9b3469be4bd1e3f162bfbed91a6bd7697e4bfee5`
of backend candidate `89d1a07ab71e22eeb9da6c1cf4e550905714161a`.
All accepted files remain byte-identical; `source-pins.json` binds their blobs,
sizes and SHA-256 identities. Current main had no overlapping closure paths.
No historical branch merge or unrelated source changes are included.

The existing acceptance of eight real-kernel checks (production entry first),
18 backend/error checks and 13 inherited diagnostics is reused unchanged.
Its coordinator-verified evidence archive is 138621 bytes, SHA-256
`3d031c56aa3ad9097e57a94a4c993265a4cbd5e5a24618feda5ddb7d7eb2b949`.
Integration checks compile the Python sources without running their bodies,
verify the complete source pins, and exercise the exact adapter's early unsafe
backend and supervisor identity rejection with child creation forbidden.
No FUSE, confinement activation, guest, build, browser or Boat operation is run.

`browserAllowed=false`. The default-deny Linux x86-64 tiny-fixture confinement
policy remains unchanged. Writable mappings, anonymous filesystem allocation,
IPC/descriptor import and unsupported syscalls remain restricted. No browser
runner is connected. Production browser profile accounting, browser syscall and
descriptor compatibility, production caller wiring and lifecycle remain gates
requiring separately authorized implementation and independent acceptance.
This integration does not qualify ToyVM gameplay or a browser workload.

Historical reports and recovery commands describe their original tasks; their
old runtime paths, cutoffs and lifecycle delegation do not authorize execution.
Never execute `pinned-guard.py` or the pinned supervisor's top-level body.
Its importable supervisor API is an immutable accepted dependency.

For portable source recovery, clone the published integration task branch,
then run `python3 -B test/toyvm-accepted-kernel-backend-main-integration-oct28/check_integration.py`
from any working directory. The source/test closure uses repository-relative
siblings and Python's standard library. Real-kernel tests additionally require
an independently authorized Linux x86-64 FUSE/Landlock/seccomp host and
`/usr/bin/fusermount3`; this report grants no runtime allowance.
