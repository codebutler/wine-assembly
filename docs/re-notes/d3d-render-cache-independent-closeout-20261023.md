# Independent render phase/cache closeout — 2026-10-23

**ACCEPT for source integration** of feature `fd5e3fc9329711d3190bbd5c7046976c21d0b9a1`
and repair `773e611262df8db9a222f7643b68c6b2e77b15cc` onto freshly reconciled remote
main. This verdict is a bounded independent source/protocol review. Full canonical
compilation, native D3D assertions, build gates and gameplay remain pending.
No renderer/WAT/D3D fixture changes were made; `09dc88de` is excluded.

## Independent evidence and executable provenance

The exact candidate parent is fd5e3fc9; remote main was verified as
`7f7358c160ae7185fc38f9a15447a6d20c00f97e`. Ten selected working files match their
candidate blobs and full SHA-256 seals in [source-seals.json](d3d-render-cache-independent-closeout-20261023/source-seals.json).
The prior rejection `3405dbc5` and its actual independent.js were read as standing
inputs. Producer reports and assertions were treated as claims.

Fresh producer execution passed **34 protocol checks and 10 executable groups**.
The separate [independent.js](d3d-render-cache-independent-closeout-20261023/independent.js)
passed **12 groups**, including two expected original-candidate failures. Its
repaired adapter oracle fails on fd5e3fc9 with Missing expected exception; its
loader oracle independently fails with Missing expected rejection. Each requires
its own changed-code sentinel on the repair and succeeds there. These are real
reproductions of both stale executable mismatches, not substituted cache mocks.

Positive controls retain the real compile-src, closure and loader exports and the
original boot function. A valid changed adapter emits marker 19, a valid changed
loader marker 11, a changed vm stage marker 8, and a changed closure marker 14;
non-tail mode emits 44. Prepare/consume returns matching changed bytes. Other
callers' held compiler exports continue emitting their original marker 4, and
shared loader/closure objects remain identical. Marker bytes are in a small
structurally formed Wasm custom section; no engine compiles or instantiates it.
Twelve helper/artifact revisions execute through retained exports, preserve the
fresh helper revision and current artifact export, and leave shared Module
children counts fixed. The producer also tests changed artifact compilation
behavior and throw-only helper/artifact/closure/stage rejection.

The fixtures run **actual canonical compile-src.js, watx-closure.js and watx.js**,
including the closure shebang, lazy absolute loader imports, Buffer decoding,
three VFS aliases, exact extraWat (including a lone UTF-16 surrogate), canonical
compile options and tailCalls. Only the four compiler stage bodies and host/native
APIs are replaced by explicitly tiny fixtures. Source decoding includes non-ASCII
UTF-8. No compiler stage from the vendored production compiler was evaluated.
No wrapper intercepts the private compiler graph, replaces its require cache,
or bypasses its sealed filesystem. Receipt rewriting in one consume-only control
is explicitly a trusted manifest fixture, not evidence of successful preparation.

## Dependency and compatibility assessment

Private CommonJS evaluation consumes the same captured buffers that supply the
receipt. The actual closure reads only fs.readFileSync/existsSync/readdirSync and
path; actual watx.js uses fs/path/vm and its fixed four-stage list. All four actual
stage files were read from donor Git object storage, hashed and inspected for
module/IO dependencies without materialization or execution. They contain no
external module/file acquisition; compiler composition stays in the loader's vm
context. All six files under watx-src (four stages plus provenance/changelog),
all top-level .wat/.watx source inputs, helper, artifact, adapters, loader and
wat-manifest are inventoried. The loader reads four explicit stages; the sealed
filesystem covers those exact paths. No additional transitive stage input was
found. Sealed bytes are copied before exposing them to compiler code.

Independent controls reject a new builtin dependency, unsealed JS dependency,
unsealed filesystem read, missing stage, changed stage inventory, an extra
compiler input and a compiler symlink. Changed-during-compilation source bytes
reject before publication. This evaluator is deliberately limited to the current
canonical adapters; it does not implement general Node package/directory/JSON
resolution, require.cache or the complete fs/Module interface. A future canonical
adapter requiring such an API must receive new compatibility review. Unsupported
dependencies fail closed; there is no compilation fallback. Its exposed vm and
appendFileSync are trusted-code capabilities, not a hostile-code security boundary.

Default callers preserve falsy-extraWat conversion and tail-call behavior,
unchanged-input byte-cache reuse, source invalidation and prebuilt Module overloads.
The producer's prebuilt controls pass without compiler use. Consumption verifies
inventory/hash/schema and does **zero compiler imports/evaluation or fallback**;
independent throwing loader/stage fixtures still consume their sealed artifact.
Missing metadata fails before the host. Module 8 MiB and manifest 128 KiB descriptor
limits reject before Buffer allocation, independently checked with allocation
sentinels. This bounds artifact input allocation, not the full compiler heap.
Exact candidate tools/test-tiers.js classifies the protocol test as unit and its
controls helper as non-test; the helper is invoked by that unit test. The root's
standing classifier differed, so it was not used: exact candidate object bytes
were evaluated in a private Module without extraction. The mismatch is retained.

The Wasm Map has one entry per helper implementation and clears on successful
replacement. Each cached wrapper retains only its latest private implementation;
old original implementation state can remain reachable as well. Thus the review
establishes bounded retained implementation/cache state, not a claim that the
whole process always holds exactly one module. Private compile graphs and captured
source buffers are invocation-local. There is no shared require-cache purge or
unbounded replacement history in module.children. This is structural reasoning
plus repeated-revision checks, not a full heap-profile measurement.

## Phase boundary, races and limits

Both actual D3D entrypoints were executed independently in preparation mode.
Only their top-level Device/fixture imports were doubled; their real boot call and
extraWat ran through actual adapters/loader with tiny stages. Host imports throw
if reached; Memory throws and instantiate is doubled. The process exits with
PREPARATION ONLY before host/native/allocation/test assertions. **Neither D3D
suite passed its rendering assertions in this task.** Preparation cannot qualify
native D3D behavior. The original compaction fixture defect is unchanged here.

Inputs are trusted local files, with ordinary Node initial module loading assumed
stable. Snapshot capture is not an atomic filesystem transaction or a defense
against hostile writers, in-place same-size concurrent rewrites, ABA edits, or
changes between Node's initial source read and its top-level evaluatedSource read.
Within an invocation, captured compiler buffers determine execution, and the
post-compile inventory comparison rejects observed changes. Helper/artifact
wrappers delegate to changed current implementations, check the captured helper
bytes and reject throw-only replacements. Publication writes the manifest last;
concurrent same-path publishers are not serialized by the artifact protocol.
Callers must own their output paths and avoid concurrent edits during a run.
A subsequent consume independently rejects current identity/hash mismatches.

These source fixtures cannot establish whole-tree canonical compiler behavior,
full-memory liveness/performance, native engine acceptance, font/pngjs closure,
D3D allocator pixels or gameplay. Existing cold-closure measurement is 23,342,723
bytes and projected 81,512,518 > 67,108,864 before package/font recovery. pngjs and
full canonical gates remain separately unresolved. The snapshot repair retains
source/compiler buffers while compiling, so a fresh compiler heap/allocation
admission is required, followed by separately admitted 512 MiB native tests.
No full-source compile, native compilation/instantiation, 512 MiB allocation,
package acquisition, guest/runtime/box operation or other worker was attempted.

## Resources, recovery and integration

Initial measured projection was 49,720,012 / 67,108,864 bytes, including full
SQLite database/WAL/SHM, external launcher/events and session, private 8 MiB
headroom, future growth 16 MiB, reserve 8 MiB and publication 1 MiB. Host-after was
4,526,698,925 bytes against minimum 2,982,150,144. Continuous guard checks cover
commands, selected files, fixtures, temporary/output/evidence and publication.
Files cap at 25,165,824; aggregate streamed capture cap is 524,288, with an initial
100,000 bytes charged for direct initial policy/measurement output. Commands have
CPU/wall <=60 seconds; Node heap 256 MiB and MemAvailable >=805,306,368. Python
has wall <=60 seconds. Installed Node v24.18.1 and read-only donors are standing
inputs; no tools were copied or links used to conceal bytes. Shared Git alternates
are the explicit authorized read-only donor arrangement. The clone had no checkout;
explicit non-cone absolute file patterns were installed before read-tree. Only the
ten admitted files and this report/evidence were materialized.

Recovery: run the adjacent guard from its original /tmp base; run Node on
`test/test-render-artifact-protocol.js` and this independent.js from the exact
private checkout. Preserve TMPDIR under that allocation and strict SSH identity.
The first attempted harness write had a shell quoting error and made no source
change. The first independent run reached the bounds group, where a nested regex
escape was a harness syntax error; replacing it with the same explicit RegExp
fixed the prerequisite, with the oracle unchanged. These failures are retained,
not counted as successful controls. No resource guard failed and no unchanged
failed operation was retried. The standing classifier mismatch was handled by
using exact candidate bytes, preserving unrelated root changes.

Conditional integration is serialized through the append-only messageboard,
with fresh strict-SSH main reconciliation, final diff/source seals/checks and
non-force publication. Feature commits and report only are eligible; fixture
09dc88de is excluded. Actual final task/main SHAs are recorded in the repository
messageboard and /tmp publication.json after push verification. No root index,
working tree, local main ref or unrelated changes are modified by this checkout.
Box ID/state/expiry: N/A, no assigned box; coordinator owns lifecycle, previous
boxes remain stopped. Shadow Man 128 MiB hold and original Airstrike/Penguin SSH403
remain unchanged. Stop after this one bounded task.
