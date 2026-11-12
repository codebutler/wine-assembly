# Shadow Man NULL boundary capture mechanism

Historical source last updated, 2026-10-23. Runtime and implementation claims below describe that dated source; see current app notes and source for subsequent changes.

## Capture and stop contract

`tools/shadow-man-null-capture.cjs` arms existing `set_trace_eip_range` for
0x004015d4 and clears the competing EIP breakpoint. The host `log_eip` callback
runs synchronously before that decoded block, including recursive WAT `$run`. It copies all eight GPRs, EIP, 128 guest stack bytes at ESP-32, and 64 **loaded
guest code bytes** at 0x004015d4 through read-only exports. No region addresses
are inferred. Immutable hex strings, metadata, sequence, schema version, stop
policy and a SHA256 seal form the record. The seal detects accidental changes;
it is not authentication. Only the first matching block is retained.

Default mode stops on that block. `tools/shadow-man-null-preload.cjs` wraps the
final `WebAssembly.instantiate(Module, imports)` call used by pinned `test/run.js`,
so runner import construction cannot overwrite the observer. It opens an
exclusive output file, synchronously writes and fsyncs each JSONL record and
exits the dedicated OS process with 86 at a terminal event. Terminal failure
also exits, even if final-record writing fails. Other exit statuses/missing
terminal records are capture failure. The guest is abandoned; this is not a
recoverable pause. An external watchdog is still required for a never-reached
address, guest spin, or OS failure. No export-level JS wrapper is claimed to
intercept recursive `$run`.

For a separately authorized **dedicated main-thread target process**, use the
existing installed Node in place, preload with `--require=.../tools/shadow-man-null-preload.cjs`,
set `SHADOW_NULL_OUTPUT` to an absent output filename, and supply the retained
canonical `--wasm=PATH`. Do not use `--break`, `--trace-at`, `--trace-eip`, guest
workers, or a spawned-child runner with this adapter. The adapter checks the
actual module file hash/size; missing required exports fail before guest work. This task did not inspect the historical wasm export inventory. Child launcher
orchestration is outside this single-process adapter: choose the target process
explicitly in the next runtime assignment, rather than inherit it through an
installer tree. No complete guest/VFS/runtime command was invented here.

## Extra boundary hook and readiness

Existing interfaces cannot expose sender saved locals, private pump state or
first zero before sender restoration. The smallest source addition uses only
existing `host.log_eip`, with negative event tags while explicitly armed by
`set_null_diag(1)`. It allocates no linear-memory region and adds no mandatory
host import. Normal behavior is unchanged with the flag off; no modal ownership,
frame cleanup, sender restoration or dispatch policy is repaired.

| Event | Exact observation |
| --- | --- |
| -1 sender-pre | Saved EIP/ESP, current GPRs before pushing the synchronous callback frame, after invocation allocation |
| -2 sender-before-restore | Saved EIP/ESP and current registers immediately after nested run ends, before identity checks, depth leave and restoration |
| -3 modal-frame-consume | Current completion ESP before reading previous pump from ESP+4..20, after teardown |
| -4 modal-frame-complete | Current EIP/ESP after the 24-byte frame adjustment; savedEsp identifies the consumed frame; before ended/result reset |
| -5 first-zero | `$run` observes EIP==0, before returning to its sender; unconditional trap after callback if the host returns |
| -6 overflow | Attempted 33rd source event; trap even if host returns |

For each source event the host copies the same registers/stack/code plus saved
EIP/ESP, private pump HWND/return/ended, shared pump HWND/ended, current invocation
token/root and synchronous depth. Token/root are decimal strings preserving
64-bit identity. They describe current state, not an inferred sender-owned token. Saved fields on first-zero are zero/not applicable; earlier sender events carry
the saved caller pair. Modal completion records the actual frame after sentinel
adjustment, not the initial CACA0004 entry ESP. No handler exit is labelled a
guest modal return. Pump state may already have changed during teardown; the
record reports its actual value at each named site.

Host records are capped at 32, including the block; the independent source cap
is 32 source events. Reaching either limit is terminal failure. In the explicitly
selected `SHADOW_NULL_UNTIL_ZERO=1` mode, the first block is retained and execution
is authorized to continue only until first-zero or the record cap. This mode
requires `SHADOW_NULL_REVISED_SHA` matching the **new diagnostic module**, and
requires its diagnostic exports. Historical module identity stays separate in
metadata. Do not present a revised module as historical canonical execution.

## Verification

Run `node test/test-shadow-man-null-capture.cjs` in this checkout. Exit 0;
tests.json (historical artifact: `shadow-man-null-capture-mechanism-20261023/tests.json`) lists checks. The 902-byte native fixture uses an 8 MiB arena. It executes the actual source
hook declarations, extracted trace predicate and zero branch against fixture
register/pump globals, including recursive callback-to-host capture. It does
not execute complete production handlers or simulate the Shadow Man incident.

Positive/rejecting tests cover address filtering, register/stack/code copies,
immutability after memory changes, terminal block stop before a native marker,
missing/wrong address, missing registers/bytes, changed stack, continued
execution, missing exports, retention failure, record quota, default-off hook,
first-zero and source quota traps with a returning host observer, and metadata
callback values. The exact pinned runner instantiate call form is executed;
full test/run.js is not launched. A real child Node process loads the preload,
flushes source events and exits 86 before its continuation marker. The fixture
and driver are retained for review; compiler support files were copied unchanged
only for this focused test, and are not proposed changes.
