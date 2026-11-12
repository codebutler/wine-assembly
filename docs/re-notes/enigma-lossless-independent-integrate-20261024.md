# Enigma lossless PNG independent acceptance, 2026-10-24

Accepted candidate `8c099562d034508ce2496430da79d2d0b07bd50b` from a different producer, against main `35a4a4e59fb2c76f9590b456ef7873e14271862a`. Reviewed all seven changed files, including decompressed producer receipts. Independent evidence is in the adjacent directory. No production source was repaired during acceptance.

The actual pinned runner SHA256 `4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809` selects `lib/canvas-compat.js`, which exports the pinned raster canvas. Its actual `toBufferSync` constructs a pngjs PNG from RGBA bytes and writes with default options. The independent test executes both pinned modules and the runner's exact `canvasToPng` function. Actual emitted IHDR bytes are `[8,6,0,0,0]`: RGBA8, deflate, standard filter, non-interlaced. Thus the candidate contract is compatible with the pinned runner; the test uses varying alpha and verifies exact bytes. Canvas sources and their manifest identities are retained compressed, without altering historical evidence.

All 23 standing pngjs files were rehashed against `/tmp/enigma-provider-complete-startup-oct24/manifest.json`, and producer/test manifest hashes agree. The original capture hash remains `6d64a146f2daf8b598dbf13e3c13f890dbc783d8f5286aacba6d343758d22079`. The candidate's three supplied source hashes match exactly. Historical supervisor and runner inputs were reused unchanged; the full supervisor regression executes the actual transformed try/finally through EOF and unchanged stop function, including shell AND and rejecting exit mutation.

The independent test observes actual real-codec strategy calls `[3,0]` on a different tiled-alpha fixture. It injects a codec exception and an under-cap valid PNG with one alpha byte corrupted: both fail immediately, with only strategy3 attempted. Removing the actual pixel-equality assertion causes this independent oracle to reject the mutant. This distinguishes size fallback from fatal codec/pixel-validation errors rather than repeating the producer's fallback-removal assertion.

The test also installs the actual environment-opted-in adapter through real `Module._compile`, loads the exact pinned capture source, and injects EIO into its underlying writer. The identical EIO object escapes, its durable receipt says `artifactAccepted:false`, and a later ordinary file write rejects with the same object and creates nothing. No later capture or dependent write proceeds. Non-byte-limit receipts intentionally fail the strict supervisor validation with nonzero exit; they cannot authorize continuation. Existing default-mode terminal tests preserve historical behavior and verify quiet-filesystem composition. The lossless opt-in changes only capture transformation; runner/supervisor transforms and accepted preload order remain unchanged.

Bounds remain single131072, cumulative393216, three frames, dimensions800x600 /480000pixels. The explicit prior-total injection in the producer test is accurately documented: three individual caps already equal the cumulative cap, so cumulative-only overflow is unreachable under the other invariants. There is no quantization, resize, alpha normalization or cap increase. At most two sequential level9 encodes run; input is limited to2097152 bytes, raw inflation to1920600 bytes, decoded RGBA to1920000 bytes. Explicit bounded inflate plus real CRC-checking decode reject malformed/truncated/oversized/interlaced input. Work and allocation remain bounded by those limits, with Node heap256 and CPU/wall60 enforced in these tests.

Passing commands (each CPU60, wall60):

```
timeout 60s node --max-old-space-size=256 test/test-enigma-lossless-independent.js
timeout 60s node --max-old-space-size=256 test/test-lossless-capture-png.js
timeout 60s node --max-old-space-size=256 test/test-enigma-terminal-capture-guard.js
timeout 60s python3 -B test/test-enigma-supervisor-exit.py
```

All four are repeated on the final integration tree before publication, with receipts retained adjacent. Integration uses the exclusive `scratch/usage-watch/shared-integration.lock`, actual strict-SSH origin/main reconciliation, and non-forced pushes of task and main refs. Exact commit/ref/blob verification and resource ledgers are retained in `/tmp/enigma-lossless-independent-integrate-oct24/ops` and the append-only root messageboard.

The producer's old1103667/new4156 synthetic sizes do not prove that the missing original batch30000 Enigma frame fits. This is offline codec/control acceptance only. No guest, retained-native instantiation, full build, network install, box lifecycle or public deployment occurred. The next original startup requires fresh runtime/resource admission and packaging the encoder beside the adapter with the documented opt-in. No box is assigned; coordinator retains lifecycle ownership.
