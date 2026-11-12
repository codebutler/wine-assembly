# Army Men paired BltFast observer (source-only)

Base `4169ebe6bc1ab858719ce12127ded7d8c0b2ef64`; isolated file-only checkout
`/tmp/wa-army-bltfast-paired-oct20`, branch `task/army-bltfast-paired-oct20`.
No guest, build, browser, runtime/box action, settings probe or other worker ran.
The upward stripes remain unexplained.

## Deliverable and verification

`tools/army-bltfast-observer.js` reuses `jig-owning-api-observer.js` for
authenticated API IDs/counters, owner identity, invocation sequence, nested
dispatch stack and post-handler ESP/EAX. The only plumbing extension is an
optional stack return-address filter **before** the record quota; other
BltFast callsites cannot exhaust the selected-call quota.

Run these source-only checks from the checkout:

```
node tools/army-bltfast-observer.test.js
node tools/army-bltfast-preload.test.js
node tools/jig-owning-api-observer.test.js
node --check tools/army-bltfast-observer.js
git diff --check
```

Independent fake-host fixtures exercise literal padded pixel bytes, an
immutable coordinate-copy oracle, missing return, bad pitch/bounds/backing/
slot/code, failed HRESULT, mismatched copy, overlapping nested invocations,
repeated calls at identical stack addresses, 30 unrelated callsites before
the target, eight-call limit, redirect and changed metadata. These pass;
they are not full-VM or real-game captures.
The preload fixture stubs WebAssembly.instantiate (no WASM execution) and
checks owner binding, unchanged result identity, second-owner rejection,
exclusive output and import restoration. It passes too.

## Original call and observation boundary

Read the prior scroll-entry review/controller/child/pins/plan. Independently
read the retained installed EXE without copying it:
`scratch/runs/20261019-army-men-authorized-install-buffer/final-vfs/program files/the 3do company/army men demo/armymendemo.exe`.
SHA-256 matches the historical controller:
`dea8303de872789553f3190ad64e80bf3c0528a5d9d3cb18ad85e0c40664078c`.
`objdump -d --start-address=0x4074f1 --stop-address=0x407515 FILE` shows:

```
4074f1  8d442400       lea eax,[esp]
4074f5  6a10           push 0x10
4074f7  50             push eax       ; source RECT at pre-push ESP
4074f8  a1d8444700     mov eax,[0x4744d8]
4074fd  50             push eax       ; source surface
4074fe  52             push edx       ; destination y
4074ff  51             push ecx       ; destination x
407500  50             push eax       ; destination this
407501  8b00           mov eax,[eax]
407503  ff501c         call [eax+0x1c]
407506  8d4c2410       lea ecx,[esp+0x10]
```

Thus the original entry `4074f1` and the API entry with stack return address
`407506` identify the same callsite. The adapter validates these 21 code bytes
in guest memory on each selected entry. It reads actual stack arguments; it
does not reuse historical surface pointers, pitch or HRESULT.

`src/09b-dispatch.wat:1686–1693` calls the generated handler, restores
nonvolatile registers, then invokes `host_log_api_exit`. This observes the
handler's return **before** guest EIP resumes at `407506`. The BltFast handler
cleans 28 bytes (six arguments plus saved return address); the observer
requires that ESP delta, unchanged dispatch EIP and zero yield reason.
It records EAX even on failure, never infers success. This is not a breakpoint
at the caller's next instruction.

`test/run.js:dxLookupThis` and the `DxObject` layout in
`src/09a8-handlers-directx.wat` establish this+4 → slot, 32-byte entries,
width/height at +12/+14, bpp/pitch at +16/+18, and **WASM backing** at +20.
The handler uses this backing directly. Allocated table bases come from the
matching RegionMap, including DX_SURF_FMT; compressed formats are rejected.
All guest spans require contiguous valid translation and all backing spans
must fit memory. Full surface extents, pitch and copy bounds are validated.

## Evidence and limits

At most eight selected invocations retain three horizontal by three vertical
sample positions, up to eight pixels each, from the source and destination
before **and after that invocation**. Each source-pre sample is the immutable
copy oracle for its destination-post sample. Samples use actual pitch and
include both sides of row transitions across sampled rows. This is partial
pixel coverage, not a full-surface proof. Metadata changes, nested selected
calls, missing returns or ambiguous observer pairing reject the observation.
`accepted` means complete evidence, not successful HRESULT or correct pixels.

The first pre-call sample is retained to check for pre-existing corruption.
`initialCorruption.status` is explicitly `unknown`: without an independent
clean image/reference, arbitrary pixel bytes cannot prove terrain was clean.
Inspect these samples together with the ordinary pre-input scene capture.
Neither a matching sampled copy nor unknown initial corruption clears the
game's stripes. No actual surface metadata or HRESULT was obtained here.

## Next admitted runtime

The executable preload form is:

```
ARMY_BLTFAST_OUTPUT=/absolute/new-evidence/paired.json \
node --require ./tools/army-bltfast-observer.js test/run.js \
  --trace-api=IDirectDrawSurface_BltFast --quiet-api --no-threads \
  --no-build --max-seconds=60 [reviewed original EXE/VFS/registry/control arguments]
```

This is an integration form, not a claim of a runnable provisioned environment.
Use the existing reviewed controller/ordinary turn plan and its wall/log/disk
guards with a matching source/module/region-map bundle. Trace API must remain
enabled: quiet alone disables the imports. Do not use the old controller
unchanged: it pins an older runner/module. The preload wraps the actual
`test/run.js:4798` instantiate imports, binds that instance's exports before
execution, and restores observer imports on exit. It accepts one owner only;
it rejects a second owning instance and custom region maps. Output uses
exclusive creation, a 256KiB serialization ceiling, and no per-call logging.
Hard kill may leave an empty output; that is incomplete evidence.

**Concrete runtime blocker:** no currently authorized accessible runtime.
The sole approved box `bx_b7sxrkh9` is stopped, and the coordinator's normal
resume returned `403 api_key_action_forbidden sandbox.resume`. No retry,
alternate route, credential, replacement or runtime action was attempted.
Coordinator must assign an accessible authorized runtime and reviewed
matching bundle before executing the integration form. Source deliverable
is complete; actual capture, initial scene review and stripe attribution
remain pending that separate assignment.

## Independent integration review

Reviewed `854c6b6aa4f0ca774a0dac4dbad37b9cab06a4d2` against current
`origin/main` `4169ebe6bc1ab858719ce12127ded7d8c0b2ef64`, reading the actual
runner, dispatch, DirectDraw layout, import and RegionMap contracts through
Git without a build. The runner constructs `{host: h}` before instantiate;
the preload wraps those imports before WASM captures them and binds exports
before the runner executes guest code. Its translator is the same
`lib/mem-utils.js:g2w` used by the runner (direct, DIB, packed sparse pages).
The runner checks the module's region-layout stamp; the admitted bundle still
must match. `--trace-api` keeps all dispatch hooks enabled despite the named
trace filter and `--quiet-api`. Wrappers preserve original import calls and
the instantiate result; closing restores the JS import object and makes
already-captured wrappers pass through.

One concrete defect was reproduced: after seven completed calls, an eighth
retained call could overlap a ninth unretained call and still be accepted.
Marking active parents interleaved now happens before the eight-call pixel
quota. The focused regression fails on the submitted implementation and
passes with this correction; all three documented JS suites pass.
No renderer, guest behavior or runtime fixture was changed.

Self-contained source-review evidence is retained at
`scratch/runs/20261020-army-bltfast-paired-review/receipt.json`: baseline and
corrected test logs, the failing regression, source hashes and review findings.
The original receipt's named `/tmp/army-preload-fixture-R8s1ob/capture.json`
existed and was copied byte-for-byte to `original-preload-capture.json` in
that run; the original artifact and receipt were preserved. Review receipt
artifact references are local to the review run.

This makes the diagnostic source ready for a separately assigned runtime.
No actual paired capture was obtained; terrain stripes remain unresolved.
