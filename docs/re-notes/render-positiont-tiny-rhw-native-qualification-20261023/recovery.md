# Retained artifacts and separate recovery recipe

Do not rerun this consumed attempt. A fresh coordinator assignment and resource
admission are required for any subsequent build or fixture run.

Retained ignored files in the private task root:

- `build/positiont-com-tiny-rhw.wasm`: 1,883,361 bytes, SHA256 `5d057b5424b710fb28f1c617786ba71d7c8c116fb74e51eac611ec9a79868ef1`.
- `build/positiont-com-tiny-rhw.provenance.json`: 1,002 bytes, SHA256 `e64c83f925f52649f46e1a89bb952d7dde06d627f7a799f0956a535c1bca8cc3`.

Git does not back up these binaries. Keep the allocation and retained bytes.
`source-manifest.json` gives every exact retained location, size, Git blob,
SHA256 and original committed mode. Materialize real files, not links; preserve
fixture 0755 even though the review donor's local fixture is 0644. Only accepted
source blob538290c4 and the reviewed single-pin file substitute the old manifest.
`standing.json` identifies installed tools, pngjs7 and read-only donor/object stores.
`diagnostic.provenance.json` is the exact provenance copy.

If separately authorized to recover unavailable binaries: use a new isolated root,
materialize all 290 manifest files exactly with Git modes, independently verify all
286 pins/sourcePinsSha256 d39a81a012129bd7c81f4f697d0a8317b3869a8195fc6fd32c1ff13fc3431262,
the unchanged builder, fixture, extraWat and accepted guard. Perform a new complete
64 MiB disk/growth/reserve admission, heavy-owner handback, and fresh compiler
memory admission. Use absent output paths and the exact `build.json` argv with
CPU/wall900s, old-space2048MiB, file24MiB/capture512KiB, subreaper/process-group
TERM+5sKILL full reap. No default build or blind pin refresh.

`run.py` is the reviewable one-shot recipe used here, not authorization for a new
run. Its execution-attempt latch must not be removed. A new root/argv can change
provenance bytes, so compare actual newly generated provenance rather than
promising the same argv-dependent hash. Retain outputs and verify before any
separately authorized fixture invocation. This baseline failed at actual allocator
reuse; do not skip that gate or run the three controls as though baseline passed.
