# WAT OpenGL command encoder

## Origin and purpose

This implements the GL transport proposal from Claude session
`107a07a4-b280-4ca1-ba54-fd68ab0e4e9c`
([session](https://claude.ai/code/session_01PdpTf48VEMdk9DGoSaXVKz)).
The measurements and SimGolf headless recipe are in
[simgolf-demo.md](re-notes/simgolf-demo.md#2026-09-15-what-the-opengl-transport-actually-carries-per-frame).

Previously every guest GL vertex, attribute, and state call entered JavaScript
to update `GLCommandStream.Encoder`. Moving that work into WAT removes those
individual host calls while preserving the renderer's command format.

```text
guest gl*/wgl*
    -> WAT attributes, client arrays, primitive conversion
    -> command records in linear memory
    -> synchronous batch submission at capacity or a semantic barrier
    -> GLCommandStream.replay
    -> gl-compat -> gpu-backend
```

## Transport contract

Internal host opcode `0x10001` means
`gpu_gl_call(0x10001, wasmByteOffset, byteLength)`. It returns the last
command's result. The caller owns the memory until synchronous replay finishes;
worker execution must wait for the broker's response before reusing it.

Each record retains the existing eight-word header:

| Word | Meaning |
| --- | --- |
| 0 | Record byte length, including header and payload |
| 1 | GL opcode, or `0x10000` for packed geometry |
| 2 | Auxiliary value; primitive mode for packed geometry |
| 3 | Captured stack byte length |
| 4 | Original guest pointer, when present |
| 5 | Pointer payload byte length |
| 6 | Copied payload offset relative to the batch |
| 7 | Pointer-copy or pointer-borrow flags |

Packed vertices contain 14 floats: position (3), color (4), texture unit 0
coordinates (2), normal (3), and texture unit 1 coordinates (2).
Quads, strips, fans, polygons, and line strips/loops become independent
triangles or lines, preserving the existing provoking vertex for flat color.

Queries, context transitions, presents, and explicit flushes submit all earlier
commands before returning. Texture uploads borrow guest memory only during a
synchronous submission. Copied input arrays are captured when the API is called,
before the guest can overwrite them. GDI32 `SwapBuffers` and the legacy WGL
spelling must both observe this ordering.

## Compatibility and validation

The JavaScript encoder remains the reference implementation for parity tests.
The production replay and GL renderer continue to consume the same records.
Parity must include record bytes, barrier return values, guest output memory,
context changes, and capacity-triggered submissions.

The CLI selects the reference path with `--gl-encoder=js`; `--gl-encoder=wat`
selects the native path. Selection happens before DLL initialization and is
inherited by guest workers. The encoder locks that selection at its first call,
because changing encoders mid-context would discard current attribute state.

The native path is the default. Each instance lazily allocates a 2 MiB command
buffer and a growing immediate-vertex buffer. Allocations are checked for
contiguous linear-memory backing before use; fragmented backing or allocation
failure traps instead of overwriting unrelated memory. Context snapshots and
attribute stacks grow dynamically without a fixed context or nesting limit.
As with the JavaScript reference, frontend attribute snapshots belong to an
instance; moving an existing context between separate WASM instances does not
transfer those snapshots.

`node tools/gen-gl-encoder-abi.js` generates native argument-length and barrier
tables. The existing constant and barrier build gates reject stale output.

### D3D transport boundary

Inspection corrected one premise of the archived proposal: the two binary
headers are both 32 bytes but have different fields. D3DIM also rotates three
asynchronous buffers, each held until its sequence completes, while GL borrows
one range only for synchronous replay. They cannot share a mutable ring without
changing that ownership protocol. This port preserves the D3D queue and its
fences. Both renderers continue to share `gpu-backend.js`; GL state and record
semantics remain separate from D3D.

Headless GL runs establish rendering correctness and count boundary crossings.
They do not establish browser frame rate. Use the non-default SimGolf clock
recipe in the linked notes to avoid its known seed-dependent terrain-generator
overwrite.

## Verification

`node test/test-opengl-wat-encoder.js` compiles the production sources and
compares native batches byte-for-byte with the JavaScript encoder. It covers
all ten primitive modes, flat/smooth colors, incomplete primitives, typed and
indexed arrays, both texture units, context/attribute lifetimes, buffer pressure,
copied and borrowed pointers, query results, invalid inputs, and shared-memory
instance isolation. Boundary tests place vector arguments at the end of memory
to catch unused-component reads.

`test/test-opengl-command-stream.js` also exercises the worker producer and
broker together: the handoff contains only offset/length, and results and guest
output writes are visible before the producer resumes. SwapBuffers ordering
and worker encoder-selection inheritance have separate regressions.

Headless comparisons use a pinned WASM artifact and a fixed batch limit:

| Workload | Frames | JS host calls/frame | WAT host calls/frame | Evidence |
| --- | ---: | ---: | ---: | --- |
| Quake II startup, 30,000 batches | 17 | 6,453.9 | 40.9 | Identical PNG bytes, draw counts, and vertex counts |
| Warcraft III animated menu, 40,000 batches | 81 | 4,776.6 | 8.0 | Both render the menu; totals differ slightly (127.1 vs 127.0 draws/frame), so this is a visual smoke test |
| SimGolf course, 301,180 batches | 38 | 2,568.7 | 26.4 | Matching spans, draws, vertices, and final PNG |

These counts include startup work. They establish fewer WASM-to-JavaScript
crossings, not an FPS improvement or full gameplay acceptance.

For reproduction, preload `tools/gl-stats-preload.js` in `test/run.js`, use
`--headless-gl --gl-encoder=js` and `--gl-encoder=wat` with the same pinned
`--no-build --wasm=PATH`, and compare the whole-run counters. Quake II uses
`--app=quake2_demo --args='+set vid_ref gl +map demo1' --max-batches=30000`;
Warcraft III uses `--app=warcraft3_demo --max-batches=40000`.
SimGolf uses `--app=simgolf_demo --max-batches=301180
--tick-ms-per-batch=37 --stuck-after=100000000 --control=8179`.
