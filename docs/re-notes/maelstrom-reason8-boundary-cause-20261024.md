# Maelstrom reason 8 and the six missed boundaries — 2026-10-24

Historical source last updated, 2026-10-24. Runtime and implementation claims below describe that dated source; see current app notes and source for subsequent changes.

`122700024 = 0x075040f8`: this is thunk **2079**, statically reconstructed as **SDL_net's WSOCK32.select import, ordinal 18**, not the target head `0x007a3362`. Reason **8 is `net_wait`**, a host-serviced park/retry contract. The last four observed calls to `run(1000)` encounter an already pending reason 8 and halt before dispatching that thunk. This explains those four unchanged pairs; it does not establish a failure of the target MOV/CALL.

## Exact source provenance and address reconstruction

Exact relevant source lines at the module revision:

The capture prints thunk base `0x07500000`, SDL load completion count 2069, and SDL_net completion count 2091. Runner revision `lib/dll-loader.js:916–940` logs the count **after** each `loadDll` returns. The retained SDL_net.dll SHA-256 is `46ccbb7e5982e2c15421af7dd4fa29b26841d9731c31a86cf9554c90be53af95`.

Its PE ILT has 21 WSOCK32 ordinal imports, followed by loaded SDL/MSVCRT dependencies and one KERNEL32 import: 22 system thunks, matching `2091 - 2069`. WSOCK32 entry index 10 is ordinal 18, IAT RVA `0x2050` (loaded IAT address `0x007a4050`). Thus `(0x075040f8 - 0x07500000)/8 = 2079 = 2069 + 10`. This mapping derives from retained binary bytes, loader policy and captured allocation counts; no guest thunk-memory readback was captured. Runtime metadata corruption/overwrite is not independently excluded. A neighboring import control rejects an off-by-one mapping.

## What reason 8 does here

[09d-winsock.wat:2745–2778](https://github.com/vgrichina/wine-assembly/blob/b41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a/src/09d-winsock.wat#L2745) implements `select`. It pops 24 bytes, pumps sockets and tests readiness. If none are ready, a NULL timeout parks indefinitely (2758–2759); a positive timeout parks while the tick deadline remains in the future (2760–2771). A ready set, zero timeout or expired deadline completes instead. The capture lacks the stack arguments, fd_sets, timeout contents and deadline, so **which wait branch and why no socket was ready remain unknown**.

[09d-winsock.wat:1325–1336](https://github.com/vgrichina/wine-assembly/blob/b41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a/src/09d-winsock.wat#L1325) implements `$vsock_block`: undo the frame pop, suppress auto-return, set EIP to `current_thunk_eip`, set reason 8, set flag 1, and zero steps. It preserves EAX. The run loop consumes flag 1 into flag 0/halt 3 (exports 162–167); an outstanding reason 8 then halts with code 4 (267–299), **before** thunk dispatch or x86 execution. Flag 0 therefore does not mean the wait completed. Captured EAX `0x53000001` is a retained register value, not a captured select result; EDI `0x0052e430`, EBP 5 and ESP `0x074ffb18` do not identify the timeout.

Runner revision [test/run.js:10697–10733](https://github.com/vgrichina/wine-assembly/blob/d8cd8c54c8d63c107696f1e4ef7a1e229dcadc1e/test/run.js#L10697) explicitly handles reason 8: clear the yield, give the event loop a turn, and pump VLAN. Exports 1933–1938 clears the reason. Do **not** infer from identical boundary snapshots that the host never cleared it: those snapshots bracket only the observed `run`, not all intervening host/scheduler work. The source contract permits a cleared call to retry and park again.

Reason 8 alone is not unique API provenance: module source also sets it in `09c5-menu.wat:5263` for popup tracking and `09f-win16-ddeml.wat:1483,1516,1547` for Win16 waits. The thunk reconstruction supplies the select attribution here. Reason 1 is a different waiting contract; the accepted native reason1/halt5↔4 example cannot diagnose this original reason8 capture.

## Why the six samples missed the head

The observer arms at batch 36163 and samples exactly six ordinary main-run boundaries. Pairs 36163–36164 have non-head EIPs, reason 0 and halt 3; all head/interior counts remain zero. They show ordinary yield-flag stops, not target breakpoints. Pairs 36165–36168 begin and end at the select thunk with reason 8/flag 0/halt 4, identical registers and cache counts, and one recorded loop block. Their pending guard prevents dispatch; the recorded block count is not an executed x86 instruction count.

This fixed historical batch window did not coincide with a sampled target-head arrival in this capture. It expired while the main instance was parked at select. The raw log does not reveal a deeper scheduling divergence or a target instruction failure. No head breakpoint or head trace was captured. Runner trace logging itself samples EIP after its ordinary run (`test/run.js:10473–10481`); it is not an all-execution-site trace.

The final counts 972/972 occur outside these zero-count pairs. They establish entries into the run-loop counting stage, not execution of MOV/CALL: exports 197–236 increments counters **before** the blocking-reason guard. The regression executes those actual forms and reaches count 972 while halting before dispatch. This is a rejecting counterexample to entry-count-as-execution, not a claim that pending reason 8 caused the actual final counts. The actual cause/timing of those counts and the historical zero result remain unknown.

## Executable check and remaining observation

Run `python3 tools/maelstrom-reason8-regression.py` (also executable directly). It verifies evidence hashes, parses the retained PE imports, evaluates the retained WAT subset for select/park/pre-execution guards, and checks all six raw pairs. Controls cover readiness, NULL/zero/expired timeout, clearing reason 8, a neighboring ordinal, replacing the reason8 guard with reason1, and nonzero entry counts without dispatch. Host socket/tick inputs are controlled test inputs; this is an offline semantic check, not a guest replay or proof of captured readiness/deadline. PASS output and exact excerpt/full-file/blob provenance are in the sibling evidence directory.

No concrete instrumentation defect is proven, so there is no production correction. The precise missing observation for the select wait is runtime `thunk_word(0x075040f8,0/1)`, the saved return/arguments at ESP through ESP+20, pointed-to fd_sets/timeval, current ticks and select deadline at the first park. For the MOV/CALL question, the missing observation is an immediate head EIP/breakpoint readback with reason/flag/registers around the actual main invocation that reaches it, including scheduler-internal invocations; historical batch number alone is insufficient. Neither observation was attempted here.
