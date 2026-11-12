The enabled `tools/maelstrom-native-errno-latch.cjs` transform now reads each
canonical pinned source property once, validates that captured primitive string,
and passes that same value to composition and output. This closes the accessor
validation/output identity gap without changing generated CALL/RET hooks, binary
checks, direct-read bounds, completion linkage, or one-shot state. Inherited
getters and proxies use the same single-read contract. Unused alias paths are
never enumerated. The disabled early return still inspects only `enabled`.

The repair is based on independent REJECT commit
`07dec4e6ff92356a896d2868aaa7e9a5b4b0c98d`, preserving candidate
`4542e115ac2b1e0cca6748bd00cdce2b4f781199` and its immutable independent review.
Only the implementation above, the new
`test/maelstrom-native-errno-source-snapshot.test.cjs`, and this task's review
evidence are changed. The original 13-group suite and independent 9-group
oracle retain their bytes.

The unchanged independent `pin-repro.cjs` has SHA-256
`83376305f77386948a2f9bcc22f2df6dbbb111db1ef7473e39a6c7f1e22c1ac5`.
It exits 1 on the donor with `defect:true`, three getter reads, and unpinned
decoder SHA-256 `5a19b0ff2bd490061a8a38e6ac98d57a801546b86ed8389f0a06820aee936a60`.
It exits 0 on the repair with `defect:false`, one read, and the expected decoder
SHA-256 `fec7b2413c972eca6ce666cd5300308047cdc08f7ca6a4542edfea98f02a3837`.
Its actual assertion is `assert(!receipt.defect)`; the candidate label embedded
in that unchanged program remains historical. No diagnostic or assertion was
weakened. Authentic plain input passes and altered plain input rejects in both
runs. Stable plain CLI input was not demonstrated affected; CLI acceptance was
not repeated for this API repair.

All 13 supplied source/model groups, all nine unchanged independent groups,
and six new snapshot groups pass. The new groups cover third-read output
substitution, every pinned property, unpinned first reads, inherited getters,
proxy traps, mutations by later getters, and disabled sources/unused options.
The four existing output mutations actually reject: stale token (4 versus 5),
capture after dispatch (3 versus 4), unsafe direct span (134217728 versus
4294967295), and result as errno (0 versus 10004). Restoring the original
three-read sequence in memory also actually rejects at the new output-hash
assertion (`57f724a0...` versus pinned `fec7b241...`); the implementation on
disk stays repaired. The initial narrower regression also rejected the donor;
the committed final six-group regression is bound by the mutation-control and
passing receipts.

Exact source, binary, and installed-tool paths, lengths and full SHA-256 pins
are in [standing-inputs.json](maelstrom-native-errno-source-snapshot-repair-20261025/standing-inputs.json).
The implementation's original source-identity evidence was independently
cross-checked against those unchanged inputs; its full hash is in
[source-identity-verified.json](maelstrom-native-errno-source-snapshot-repair-20261025/source-identity-verified.json).
Inputs were read in place from canonical source
`/home/user/wine-assembly-shadow-man-span-static-canonical-oct23`, original
`/tmp/maelstrom-original-win32-closure-oct24/extracted/Maelstrom-3.0.6`, and
`/home/user/wine-assembly/test/binaries/dlls/msvcrt.dll`.
No installed tools were copied. Dependency-first readonly alternates back the
explicit five-path checkout; Git auto maintenance is disabled. Root and donor
HEAD, refs, index and tracked-diff hashes are unchanged. Only the append-only
root messageboard is written. The trusted SSH configuration is recorded;
there is no mount argv or conditional runtime invocation to parse.

[manifest.json](maelstrom-native-errno-source-snapshot-repair-20261025/manifest.json)
binds the implementation, regression, unchanged reproducer, controls, guarded
commands, logs and receipts. Guards enforce Node heap 256 MiB, CPU/wall 60 s,
131072-byte output, 24 MiB per file, 2 MiB narrow capture and TERM/KILL/reap
within five seconds. Every test process exited and was reaped without timeout
or output truncation. Resource receipts charge checkout/Git/staging/temp,
evidence/publication copies, full external launcher/session logs, positive
SQLite growth, future allowance and an 8 MiB reserve inside 64 MiB. A
prepublication snapshot stores tracked-diff digests instead of full diff text.
Final actual remote verification, final accounting and watcher cleanup are in
the task-owned `ops/result.json`, written last after publication.

This is source/model acceptance only. No build, compilation, instantiation,
native/guest/browser run, box operation, acquisition, worker launch, or main
merge occurred. Native errno, native caller, gameplay, completion fdsets/timeval
and native overhead/equivalence remain UNKNOWN. The remaining gate is separately
authorized canonical build/compiled-native qualification with a loader-proven CRT
base and original capture. No boxes were assigned; `bx_g84h8h98` remains
coordinator-reported stopped/unqueried and `hostbx_69aem736` untouched. Runtime
lifecycle ownership remains with the coordinator. Stop after this tested branch
is published and verified.
