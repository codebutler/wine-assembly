# Render-test compilation / execution artifact handoff, 2026-10-23

Implemented on exact base `7f7358c160ae7185fc38f9a15447a6d20c00f97e`, branch
`task/d3d-render-artifact-phase-separation-oct23`. This resolves the same-process
compiler/native phase coupling identified by independent report
`e1a80dd38b07b6b8909aeeb8ca4eb1eb7ae9b9df`. It does **not** qualify a native
renderer run or merge the fixture candidate `09dc88de08907d362eef2ac5dbbaad0080147358`.
Neither candidate's assertions nor production renderer/WAT/API behavior changed.

## Interface and input contract

Two explicit, mutually exclusive environment variables select a mode on the
existing `bootRenderHarness` call:

* `WINE_RENDER_ARTIFACT_PREPARE=/absolute/path/name.wasm` compiles the first
  harness invocation's exact `extraWat` and `tailCalls`, writes that module and
  `name.wasm.json`, and exits successfully **before** host dependencies, guest
  memory, instantiation or test assertions. This is a compiler-only command,
  never a passing test result. Use it only with a single-harness entrypoint.
* `WINE_RENDER_ARTIFACT=/absolute/path/name.wasm` validates the receipt against
  current files/options and returns bytes to the normal runtime boot path.
  Missing/empty/relative paths, absent or malformed metadata, stale or mismatched
  inputs, changed module bytes and modules larger than 8 MiB fail closed. No
  compilation fallback occurs. Manifest reads are bounded to 128 KiB; module
  size is checked on its open descriptor before allocating or reading its bytes.

Both artifact modes reject combination with `prebuiltModule`. With neither
variable set, the existing canonical compile path and transform remain. Its
cache key now incorporates fresh file identities so changed sources cannot hit
an earlier compiled-source cache entry. Existing prebuilt callers retain the
WebAssembly.Module overload and the prohibition on additional `extraWat`.

`test/render-artifact.js` compiles through existing `test/compile-src.js` and
`tools/watx-closure.js`; it does not duplicate the source include order or the
canonical production compiler options. The original append-to-13-exports
transform updates all three VFS spellings through `compile-src`. Provenance
seals every top-level `.wat`/`.watx` input in the canonical helper's VFS, including
the entry manifest and unused fragments, in deterministic filename order. This
is an input inventory, not another compile order. It also seals the entire
`tools/watx-src` tree, loader, closure adapter, manifest helper, compile adapter,
render helper and artifact helper. File paths, lengths and SHA-256 hashes,
exact extraWat JavaScript code-unit identity (UTF-16LE), tail-call option and
module hash/length are checked.
No Git revision alone is accepted as identity. Receipt schema and field ordering
are deliberately exact: consume the generated receipt without rewriting it.

Preparation checks inputs again after compilation and requires that WATX has
not previously been loaded in that process. Consumption only reads/hashes
compiler **files**; it never imports `compile-src`, `watx.js`, compiler stages or
the compiler VM. Source root is the checkout containing these helpers, resolved
from `__dirname`, never a CWD-selected root or a global source-file cache. It
must remain immutable during an admitted command. Compiler files must therefore
be available to runtime verification even though they are never evaluated.

The receipt is a local integrity/provenance record, not a signed attestation or
canonical-gate certificate. Compilation alone runs none of the mandatory build
gates. With extra exports this is an instrumented test artifact, not a claim of
byte identity with the shipped canonical module.

## Executed protocol acceptance

Command, from a checkout containing the two unchanged target test files:

```sh
node --max-old-space-size=256 test/test-render-artifact-protocol.js
```

**34 protocol checks PASS.** The committed regression copies the actual render
helper, artifact helper and compile-src adapter to an isolated dependency
fixture. It extracts both real target tests' distinct extraWat strings from
their unchanged calls, prepares each through that real helper path in a fresh
child, and verifies all three transformed VFS aliases at a closure double.
Compiler output is an eight-byte generated empty Wasm binary. WATX is a throwing
sentinel, not the full compiler. Preparation host imports and guest allocation
are also throwing sentinels. Runtime uses a tiny supplied ArrayBuffer and an
instantiation double; no WebAssembly native execution occurs.

Checks cover exact matching inputs; changed extraWat, tailCalls, source, entry
manifest, added VFS file, compiler stage/loader/adapter, compile adapter and
harness; changed or missing module; missing/malformed/unknown receipt fields;
oversized metadata and file sizes; a previously loaded compiler; actual consume
boot with zero compiler imports and unchanged compile-call count; rejection
before instantiate with no fallback; default transform/cache/source invalidation,
falsy extraWat and non-tail behavior; and existing prebuilt overload/rejections.
Oversized descriptor sizes are injected using a stat double, avoiding staging
an oversized file. These are protocol controls, not native acceptance evidence.

The test's filename is automatically classified `unit` by existing
`tools/test-tiers.js`; no registration edit is necessary. Focused classification,
syntax checks and `git diff --check` passed. No broad suite or gate was claimed.
Retained evidence and the guard wrapper are in the adjacent
`d3d-render-artifact-phase-separation-20261023/` directory. The standalone
regression itself is the reproducible acceptance recipe.

## Exact future commands and prerequisites — NOT executed here

A separately authorized, measured checkout must contain this helper change and
the intended D3D fixture candidate, with complete exact sources, compiler files,
required host dependencies (including `pngjs`), and the canonical build gates
appropriate to that candidate already satisfied. Assemble/integrate that
snapshot separately; this task performed no integration or main merge. Changing
any sealed source/helper/compiler file requires regenerating the artifact.
Use distinct modules for the two tests; their extra exports are different.

After fresh disk/allocation/per-file/capture admission, set `REPO` to that
absolute immutable checkout and `ARTIFACTS` to its separately admitted absolute
output directory. Create that directory within its allocation. For **each**
compiler command require fresh MemAvailable >= 2,684,354,560 bytes, compiler heap
2,048 MiB, CPU and wall <= 900 seconds; enforce streaming aggregate capture and
the allocation continuously. For example, with the future task's external
streaming/allocation wrapper surrounding each command:

```sh
# Compile ONLY. Exit 0 here is artifact preparation, not test acceptance.
test "$(awk '/^MemAvailable:/{print $2}' /proc/meminfo)" -ge 2621440 &&
(cd "$REPO" && ulimit -t 900 &&
 env -u WINE_RENDER_ARTIFACT WINE_RENDER_ARTIFACT_PREPARE="$ARTIFACTS/compaction.wasm" \
 timeout --signal=KILL 900s node --max-old-space-size=2048 test/test-d3d-software-compaction.js)

test "$(awk '/^MemAvailable:/{print $2}' /proc/meminfo)" -ge 2621440 &&
(cd "$REPO" && ulimit -t 900 &&
 env -u WINE_RENDER_ARTIFACT WINE_RENDER_ARTIFACT_PREPARE="$ARTIFACTS/arena-reuse.wasm" \
 timeout --signal=KILL 900s node --max-old-space-size=2048 test/test-d3d-software-ctx-arena-reuse.js)
```

Do not continue if any prerequisite/guard/compile command fails. Record both
module and receipt hashes and their exact input manifests. For **each** native
command freshly require MemAvailable >= 1,610,612,736 bytes, heap 512 MiB, CPU
and wall <= 150 seconds, admitted aggregate native arenas, plus the same external
disk/capture controls. The helper enforces the 8 MiB bound and identities before
host allocation and instantiation:

```sh
test "$(awk '/^MemAvailable:/{print $2}' /proc/meminfo)" -ge 1572864 &&
(cd "$REPO" && ulimit -t 150 &&
 env -u WINE_RENDER_ARTIFACT_PREPARE WINE_RENDER_ARTIFACT="$ARTIFACTS/compaction.wasm" \
 timeout --signal=KILL 150s node --max-old-space-size=512 test/test-d3d-software-compaction.js)

test "$(awk '/^MemAvailable:/{print $2}' /proc/meminfo)" -ge 1572864 &&
(cd "$REPO" && ulimit -t 150 &&
 env -u WINE_RENDER_ARTIFACT_PREPARE WINE_RENDER_ARTIFACT="$ARTIFACTS/arena-reuse.wasm" \
 timeout --signal=KILL 150s node --max-old-space-size=512 test/test-d3d-software-ctx-arena-reuse.js)
```

These snippets specify the phase-specific commands, not a substitute for the
future task's mandatory admission/capture wrapper. Never run the second command
of either pair after the first fails. Backend tests with their own harness call
can likewise prepare their own artifact; this does not admit any other suite.

The previously measured cold closure allocation overrun (81,512,518 > 67,108,864
bytes before fonts/packages), missing pngjs and main canonical gate/closure
availability are still unresolved. No package recovery, full-source compilation,
512 MiB native allocation, guest, remote runtime or previous qualification was
attempted in this task. Phase coupling is the only blocker resolved here.

## Resource accounting, ownership and publication

First admission: 59,805,115 / 67,108,864 projected bytes, host-after
4,544,963,141 >= 2,982,150,144. This includes full shared SQLite WAL/SHM,
measured external/session files, 16 MiB future growth, an 8 MiB private
checkout/Git/temp/evidence allowance and an 8 MiB reserve inside the total.
Standing installed tools and read-only Git donor have separate measured
identities in the resource receipt; tools ran in place without copying or
link concealment. The private Git store uses an explicit read-only alternate
to existing exact Git objects; root index and refs were untouched.

Protocol commands used Node heap 256 MiB, CPU/wall <= 60 seconds and fresh
MemAvailable >= 805,306,368 bytes. Python commands use wall <= 60 seconds.
`run.py` streams task execution output before buffering, with aggregate capture
524,288 bytes, conservatively starting at 200,000 bytes for earlier bounded
instruction/source reads. No execution guard was rejected; the recorded
rejection evidence consists of expected protocol fault controls. Private files
remain below 25,165,824 bytes; accounting includes fixture temporaries and future
publication growth in the private allowance. The admission and later resource
receipts retain exact measured numbers.

Publication checks caught trailing whitespace in captured diff context inside
the raw validation log. Its exact text and SHA-256 are retained in JSON encoding
instead, so the evidence remains intact and the staged whitespace check passes.
An optional read-only author lookup also found the independent-review commit
absent from the root alternate; no fetch/retry was made. Author identity was
set only in this private repository before publication.

Commit/remote verification is retained in the private adjacent publication
receipt and append-only root messageboard. No force push, credentials change,
shared ownership change or main merge. D3D candidate/review branches, Shadow Man
allocation hold and Airstrike/Penguin runtime403 lanes remain untouched.
Box ID/state/expiry: **N/A**; no box assigned or operated. Prior boxes remain
stopped and the coordinator retains lifecycle ownership. Stop after publication.
