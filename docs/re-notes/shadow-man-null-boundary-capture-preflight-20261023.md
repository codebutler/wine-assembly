# Shadow Man NULL boundary capture preflight: blocked before helper verification

Historical source last updated, 2026-10-23. Runtime and implementation claims below describe that dated source; see current app notes and source for subsequent changes.

## Static interface findings retained before admission stopped

The candidate observation argv is syntactically supported by exact `test/run.js`:

```
--trace-at=0x004015d4 --trace-at-limit=1 --trace-at-mem=esp-0x20:128,0x004015d4:64
```

The parser at lines 1526 and 1573–1582 parses addresses as hex, splits each memory
expression on its last colon, and parses decimal lengths. The trace reader at
lines 10486–10566 accepts ESP minus hexadecimal offset and emits 128 stack bytes
and 64 code bytes as contiguous hex strings. Register output uses `regs()`.
**This is an observation-only argv, not a capture/stop contract.**
`--trace-at-limit=1` stops logging/rearming after one observation; it does not
stop the runner, freeze memory or stop at first zero transfer. Code bytes would
be loaded guest memory at 0x004015d4; no opcode there has been observed here.

`src/13-exports.wat:146–163` checks the EIP breakpoint before thunk/decoded-block
execution. The first match sets `bp_skip_once=1` and returns from that `$run`;
the next `$run` at the same address clears it and executes the block. `set_bp`
recomputes debug guards but does not clear `bp_skip_once`.

`src/09c3a-dialog-runtime.wat:229–263` calls `$run(1000000)` inside the synchronous
sender's own loop. It does not branch out on breakpoint halt reason 5. Thus a
breakpoint reached inside this loop can return only to WAT, then be continued
before the outer JS trace has any opportunity to retain registers/stack/code. At a zero EIP it exits that loop and subsequently restores the saved caller EIP,
ESP and other registers (lines 285–299). Merely wrapping the exported JS `run`
or `send_message` cannot intercept their internal WAT-to-WAT `$run` calls or
guarantee preservation of the first zero before sender restoration. This is a
source counterexample to treating those wrappers/flags as sufficient; it is not
a replay of the actual Beenden failure.

There is a stronger existing pre-block observation interface:
`set_trace_eip_range(1,0x004015d4,0x004015d4)` invokes host `log_eip(eip)` at
decoded-block entry (`src/13-exports.wat:322–328`), even in recursive `$run`. A standalone preload could synchronously copy GPRs/128 stack bytes/64 code
bytes and terminate there, without a module rebuild. This remains an **unverified
design**, not a delivered helper: breakpoint arming would intercept before that
import, and a deliberate exception would abandon the live guest call, requiring
the existing external watchdog and no continued guest execution. It also does
not observe thunk dispatch or the earlier zero-EIP branch. No complete first-zero
contract is established by this finding.

Read-only source-declared exports provide:

| Observation | Existing interface | Limit |
| --- | --- | --- |
| Current GPRs/EIP, guest bytes | `get_eax`…`get_edi`, `get_eip`, `guest_read8`/`guest_read32` | State only at an actual host observation boundary |
| Synchronous depth | `get_sync_msg_depth` | No invocation token/root |
| Shared DialogBox pump HWND | `dialogbox_hwnd` | Reads SHARED_DLG_PUMP_HWND, not private pump globals/ended word |
| Current thunk and its metadata | `com_callback_get_thunk`, `thunk_word(addr,w)`, thunk bounds/count getters | Caller must validate metadata at the observed boundary; not a zero-writer trace |
| Sender before/after exported call | JS caller can sample the above | Does not expose internal saved locals or moment of restoration |
| Decoded block before execution | `set_trace_eip_range`, host `log_eip` | After thunk handling; zero branch is earlier |

`com_callback_enter` mutates invocation state; it is not a read-only token getter. `com_callback_check` needs an already known token. Do not use these as substitutes. No read-only export was found in the pinned `13-exports.wat` for `dlg_ret_addr`,
private `dlg_pump_hwnd`, `SHARED_DLG_ENDED`, invocation token/root, sender
`old_eip`/`old_esp`, or CACA0004 entry/completion tuples. No allocated region bases
are inferred. `dialogbox_hwnd` corrects the broader suggestion that the pump HWND
is wholly inaccessible: its shared HWND value is accessible.

If full boundary discrimination remains required after resource admission, the
minimal diagnostic source interface would emit a bounded, synchronous host event
at sender save/before restore and CACA0004 completion (before consuming ESP+4..20
and after ESP+=24), carrying saved/current EIP/ESP, GPRs, private/shared pump HWND
and ended state, return address, invocation token/root/depth and thunk metadata. A first-zero event must occur inside `$run` at its EIP==0 branch before any
sender restoration; retain the frame and stop synchronously on that event. Decoded opcode/target-word provenance would still need an event at the actual
transfer writer to establish CALL/RET/JMP causality. No such source edit or
module compilation was performed, proposed as a repair, or silently substituted. This limitation is independent of the resource blocker.

## Evidence and stopping condition

Run the report checker with the retained diagnosis donor as its only argument:

```
GIT_NO_LAZY_FETCH=1 python3 docs/re-notes/shadow-man-null-boundary-capture-preflight-20261023/check.py /home/user/wine-assembly-shadow-man-null-exit-diagnosis-oct23
```

Host API `log_api_exit` records remain handler exits, never completed guest modal
returns. Genuine 50-byte grafix.cfg SHA256
`0407969d4bf39f2287f8d99bd37feac1212e6492f41038a817f77f39ef79d42d` and the historical
recovery recipe stay in the accepted diagnosis donor. Its historical RUNNING
statement is superseded by coordinator snapshot-stop `stop_428de72b6f35166b`,
completed 2026-10-23 03:03:34.606Z. Box `bx_fn7pn7yg` remains STOPPED per task input;
historical expiry 2026-10-23T03:46:00.580Z; no live state probe or lifecycle action. Coordinator retains ownership. No runtime, Boat operation, build, restoration,
retransfer, packaging, production repair, worker launch, deployment or main merge. Configuration OK/write/enabled Spielen remain accepted; persistence/Play/gameplay
remain untested, partial 479-file VFS export invalid as input, NULL cause unproven.
