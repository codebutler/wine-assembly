# Win32-owned NE bridge: implementation boundaries

Source audit, 2026-10-15. No runtime or original game execution. This continues the stages in outlaws-pmpro-loader.md after the independently tested synthetic KERNEL32 image. KERNEL32 ordinals 35/36/37 and QT_Thunk remain absent until their actual behavior is implemented.

## Process-owned address space first

load_ne is unsuitable: it sets image_base to zero and switches the entire task to Win16. load_ne_dll_sized can place DLL segments without that switch, but currently derives guest addresses from fixed WIN16_ARENA=0x00100000. For a PE at 0x00400000 the first slots lie below the direct guest mapping, and later slots overlap PE address space. Module records, handle tables and allocation bookkeeping also live in the hidden arena page. Changing only segment placement would leave those consumers addressing the old arena.

Introduce a process-owned arena reservation and accessor shared by every arena-derived pointer, with the historical address retained for pure NE tasks. Reserve the whole required guest span without colliding with existing PE images/allocations; commit backing only as needed. Publish the base and initialized state in shared process memory under the existing allocation/publication discipline, never an instance-private mutable global that Workers would disagree about. Initialization creates the thunk selector and allocator/metadata state without clearing PE state or changing image_base/is_win16. Check existing full-span contiguous-memory assumptions before allowing sparse mappings: calls that memcpy a run after a single g2w require contiguous backing, not merely individually committed pages. Roll back reservations and metadata on failure.

Tests: run actual arena and NE load helpers in tiny WAT under nonzero PE image_base; verify preexisting image, stack and allocation canaries, named/ordinal far exports, disjoint sparse backing, duplicate publication, exhaustion rollback, and reset/reuse. Pure NE arena placement must remain unchanged.

## Invocation-owned stacks and context

Existing win16_begin_dll_inits and win16_dll_init_resume preserve 16-bit register halves and rely on task-global queue/segment state. They cannot restore a Win32 caller. New bridge frames must retain all eight 32-bit registers, return EIP, segment selectors and their bases, code/stack-size state, flags (including the lazy representation or an exact materialized equivalent), and Win16 bridge scratch state. Save/restore complete current state, not assumed default Win32 segment values. Nest frames per thread and retain their allocation/owner identity through yields.

Each invocation needs a private 16-bit stack with a real selector and a private 32-bit scratch stack. Existing win16_call32_begin uses the top of GUEST_STACK because pure Win16 tasks never use it; under a suspended PE caller that overwrites its stack. Select bridge-owned scratch when a bridge frame is active, preserving the old pure NE path. A continuation restores the caller only after the real LibEntry/far function returns. Exceptions, cancellation and thread retirement must unwind frame-owned allocations and module initialization ownership without installing another thread as caller. Do not hold publication locks across guest execution or async service.

Tests: distinct high halves in every register; nondefault segment/flag values; canaries at the original PE stack top and around both private stacks; a LibEntry invoking a real Win16-to-Win32 API; nested bridge frames; yield/resume with a second thread; failed initialization and retirement. These tests exercise extracted actual WAT helpers before a full synthetic PE-to-NE native fixture.

## Module lifetime, then QT ABI

Reuse NE parsing, relocations, private metadata, far exports and selector allocation after arena ownership is correct. Add explicit loading/initializing/ready/unloading states with an owner and references. Duplicate loads share the ready module, while concurrent initialization cannot expose an uninitialized DLL. Define dependency reference ownership and failure rollback; missing imports or initialization rejection release name slots, metadata, segments and dependencies. LoadLibrary16 must run real LibEntry and publish success afterward. GetProcAddress16 returns only actual named/ordinal far exports. Final FreeLibrary16 must implement the required termination behavior before releasing executable state. Validate exact calling conventions against primary ABI sources before appending APIs to the table.

QT_Thunk then uses the tested context machinery but needs its own verified ABI: EDX far target, caller stack arguments and cleanup, return AX/DX semantics and nested callbacks. PMPRO62F operation 1000 expects AX to identify shared memory, which is an additional concrete behavior to verify; a nonzero stub cannot satisfy it. Synthetic initialization success/failure, duplicate load/unload/reload, missing exports, nested calls and complete caller restoration must pass before exposing the exports or replaying original Outlaws.

The arena/context work is a prerequisite, not a claim that NE module lifecycle or QT_Thunk is implemented. The original Outlaws renderer may have further shared-memory or hardware requirements after the bridge.

## First arena implementation checkpoint

The separate arena stage adds an eight-byte process record: atomically published usable base and a lock-protected pending-cleanup base. All arena-derived consumers use the accessor. Pure NE keeps its historical address and never invokes the PE allocator. Win32 activation is an internal host export only; no guest API or library-loading path calls it yet.

The initial implementation reserves and commits 944 contiguous 64 KiB pages (59 MiB), then checks the entire span with the actual affine-span helper before clearing it and publishing. This deliberately spends backing memory to preserve existing cross-slot copy assumptions. Failed reserve/commit, partial commit and non-affine backing publish nothing. If rollback itself fails, the reservation remains in pending-cleanup state; a later ensure retries cleanup without allocating a second arena. Final release failure preserves the live published base and reports failure. Process replacement returns an error before modifying the old process when release fails.

The reset call sites are the top-level PE and NE loaders, before changing image_base or virtual-map state. The production JS caller is process-boot.stageAndLoadPe, outside the DLL load service; the only WAT call to load_ne is the NE branch of load_pe. These call sites do not hold DLL_LOAD_LOCK. The existing recursive loader lock protects publication, with the already-established DLL_LOAD_LOCK → LOCK_VIRTUAL_MAP order. No new host import or await occurs while holding it. Whole-process replacement still requires guest execution to have stopped.

The tiny-WAT regression compiles actual arena, lock, metadata and affine-span helpers. It covers a nonzero PE image base, disjoint backing and PE/arena canaries, observation from a second instance during each initialization step, repeated acquisition, metadata addresses, all allocation failures, failed rollback retention/retry, failed final release, unload/reload and the pure NE path. The allocator is controlled in this fixture: it does not establish compatibility with the real virtual allocator. A native synthetic real-allocator gate, including the full 59 MiB affine span and concurrent callers, remains mandatory before bridge activation. Actual Win16 initialization, selectors, reference counts and QT calling context remain subsequent stages.

Source validation: tiny arena regression and historical Win16 arena-bounds test pass; WAT fragment/manifest checks, region declarations/owners/mirror, all five region shake modes, address-ratchet/JS-copy gates, WAT/JS constants, normalized logical operands, test-tier/timeout membership and diff whitespace checks pass. No full build, native emulator or original Outlaws run has been performed for the arena change.

The tiny regression also runs two actual JS Workers over the same compiled tiny module and shared memory. One initializer pauses before commit while the other enters the real loader lock; the test observes no published base and exactly one reservation. Both then obtain the same initialized base and metadata addresses and exit cleanly. A five-second deadline, early-exit detection and final termination keep this bounded. This tests lock/publication contention with controlled allocation, not the real allocator or full emulator.

## Bounded real-allocator controller

`tools/run-win32-ne-arena-native.js` requires exact `WA_NE_ARENA_COMMIT` and an outside-checkout `WA_NE_ARENA_EVIDENCE` directory. Run only after a separate sole-lane grant, in a fresh isolated checkout, under an outer 1,000-second timeout. Production src/lib bytes must match reviewed arena commit 3df6edbcb2ccb2096c8cd8b406e66e4b78d3f7fb. The controller performs the normal build (600 seconds), tiny regression (30), explicit-prebuilt real-allocator fixture (90), unchanged pure-NE arena bounds (30), and unchanged NE additive-far loader regression (60). It checks all physical tracked build inputs, 52 approved dependency hashes, idle process state, and the preserved 937466db/a948a826/0dbf1893/04ede4000/e26a7515 modules around every arm.

The new native fixture uses a 1,024-byte synthetic PE, SHA-256 106d01a11c61b79ae9b9d37b9017c78cdce667ab9f5c3cf7dc65ac207faab2e2. The source-only PE parser confirms its entry and raw mapping. Planned assertions cover all 15,104 pages of the arena's real affine mapping, PE/foreign-allocation canaries, metadata addresses, repeated acquisition and release, two real full-module Workers sharing one reservation, whole-process reload, and real backing exhaustion by an unrelated 240 MiB allocation followed by successful retry. No NE DLL is loaded into that PE yet. These native assertions are prepared, not claimed to pass before execution. No original game or browser is part of this controller.

## Real-allocator result

The granted controller ran source 99a4a37f734507d6b6241808487381ab5db04ef6 in fresh isolated `/home/user/wa-ne-arena-native`. PID 258567 (command cmd_bncgny7xci1g) started 2026-10-15T16:52:12.238Z and exited zero at 16:52:45.800Z. Normal full build passed in 29,416 ms; tiny helper/concurrent test passed in 254 ms; real-allocator fixture passed in 224 ms; unchanged pure-NE bounds and additive-far loader tests passed. Module SHA-256: ca90c018226b1b002d257dde09e1913fd35c2e22cac43a2128ae88744f80cccd.

The real allocator satisfied the full 61,865,984-byte affine span, canaries, metadata, two full-module Workers sharing one reservation, whole-process reload, backing-exhaustion cleanup and subsequent retry. This qualifies the arena prerequisite only. NE DLL initialization in Win32, private stacks, caller restoration, lifecycle APIs and QT_Thunk remain unimplemented, and no original game or browser ran.

Independent postflight at 16:53:09.293Z verified no active runtime processes, all 5,046 physical source files and 52 dependency hashes unchanged, and all five preserved donor modules unchanged. The lane was explicitly released. Recovery archive `scratch/runs/20261015-outlaws-kernel32-native/ne-arena.tar.gz` is 3,766,771 bytes, SHA-256 f82074ca9929b700e4ea312160ea44664fcdcc3e0f4a1199d5330b554bc7bee6. It contains the module, logs, source/dependency inventories and independent postflight; remote evidence is `/tmp/wa-ne-arena-native-20261015`. The external preflight explicitly enforced more than 2 GiB free (38 GB observed), verified idle and all pins, and extended/verified TTL to 17:51:53.185Z before the 1,000-second outer command. Git reported known alternate-store depth warnings, but every physical tracked blob was verified and all commands completed successfully.

## Invocation context prerequisite (source-only)

The next separate branch starts from integrated main 9a50486b1735342943767d23a3b8226f4a03c895. Internal invocation helpers acquire two private arena slots: one 64 KiB 16-bit stack and one 64 KiB Win32 API scratch stack. The scratch slot's first 1 KiB holds context and is excluded from argument space. Process bootstrap establishes the shared selector allocator and thunk slot without changing image_base or is_win16. An active-frame count pins the arena against process replacement.

Each per-instance linked frame has an owner and a generation-bearing token. Completion rejects foreign, stale or out-of-order tokens; a reused memory address does not make an old completion valid. Exact restoration includes all eight full-width general registers, EIP/interpreter position, segment selectors/bases and code-size state, lazy flags/direction/extra flags, yield state, Win16 call32 bookkeeping, x87 controls/tags/raw payloads, and MMX/XMM files. Abort unwinds only that instance's frames. Release keeps the loader lock through restoration so another instance cannot recycle the context while it is still being read.

Stack entry is deliberately separate from acquisition and resets the nested Win16 call32 marker. The existing win16_call32_begin selects the current invocation's private scratch when one exists, with a bound that prevents arguments from overwriting saved context; the historical pure-NE scratch path stays unchanged. No guest API enters this machinery. A future invocation must validate/select its CS:IP and DS before guest execution. Far-call continuations, host cancellation/retirement integration, serialization of actual Win16 guest execution, and NE module initialization/lifecycle are still required before activation; this source stage does not claim they exist.

The actual-helper tiny regression passes nested stack/call32 restoration, high register halves, all listed saved globals and floating-point/vector bytes, original PE-stack canaries, foreign and stale-generation rejection, out-of-order completion, argument-bound trapping, two independent instances, abort, live-frame arena pinning, selector exhaustion and failed arena acquisition, and the unchanged legacy scratch choice. The earlier arena helper/concurrent regression also passes. No full build or native runtime has yet run this context change.

Context race review closes the gap between arena ensure and lifetime pinning: frame acquisition rechecks atomic publication under DLL_LOAD_LOCK, retrying if another instance released the reservation. A deterministic second-instance release at that exact boundary passes; reverting only the revalidation makes the required-retry assertion fail. Segment/address prefixes and effective-address scratch (`d_seg`, `d_addr16`, `ea_temp`) now round-trip alongside the independent required CPU-state list. The modeled FP state consists of the five saved x87 globals and complete FPU/MMX/XMM files; this emulator does not model MXCSR.

Activation gate: a real invocation runner must pair the existing `sync_depth_enter`/`sync_depth_leave` around nested guest execution, entering while the caller's own IP is still current, so suspended threaded/spill code cannot be recycled. Cache generations, allocation cursors and invalidation state must remain current, not be restored from a frame snapshot. Saving IP alone does not pin its decoded stream. This context-only stage does not run guest instructions and has no such runner yet. Native prerequisite validation must exercise acquisition, private stack selection, nested restoration and allocator lifetime without treating them as executable NE DLL lifecycle or QT support.

Prepared native context controller: `tools/run-win32-ne-context-native.js`, with exact `WA_NE_CONTEXT_COMMIT` and outside-checkout `WA_NE_CONTEXT_EVIDENCE`, requires a separate sole-lane grant and an outer 1,100-second timeout. It pins production src/lib to f9f47f3294edb7f41326ae21a83f003f981056ee, checks more than 2 GiB free, physical tracked inputs, all 52 approved dependencies, idle runtime state and six preserved modules (including admitted arena ca90c018). Arms are normal build (600 seconds), tiny context (30), full-module context (90), tiny arena (30), real allocator (90), unchanged pure-NE bounds (30), and unchanged NE loader (60). Each arm has source/dependency/module checks before and after; no build gates are skipped.

The prepared full-module context fixture uses the same synthetic PE and production host imports as the admitted arena fixture. Two initialized WASM instances share actual allocator backing. It checks nested private 16-bit stack selection, general/FPU/MMX/XMM file restoration and observable segment/EIP/FS state, wrong-owner/out-of-order/stale completion rejection, owner-specific abort, failed process reset while any frame is active, PE image/stack canaries, final release and process reuse. Private call32 scratch argument writes and all saved scalar CPU state remain covered by the actual-helper tiny test; the native fixture does not execute call32 or guest instructions. These native assertions are prepared, not claimed to pass. Source syntax, test-tier membership and JS region-copy gates pass.

## Native context prerequisite result

The granted controller ran immutable source 82a81080256b449d3b9973855470c99d0387731e in fresh `/home/user/wa-ne-context-native`. PID 285459 (cmd_2hf48r4hxbfm) ran from 2026-10-15T17:17:28.675Z to 17:17:52.756Z and exited zero. All seven arms passed: normal build 18,839 ms, tiny context 439 ms, full-module context 100 ms, tiny arena 264 ms, real allocator 204 ms, unchanged pure-NE bounds 19 ms and unchanged NE loader 27 ms. Built module SHA-256 is 9b57583c1ca8887f7195a268c94312ca6352eb646f4071c740c5a75aff1eb69e at `/home/user/wa-ne-context-native/build/wine-assembly.wasm`.

The native fixture passed actual allocator/private stack and nested restoration assertions on the same synthetic PE SHA-256 106d01a11c61b79ae9b9d37b9017c78cdce667ab9f5c3cf7dc65ac207faab2e2. Wrong-owner/out-of-order/stale completions, owner-specific abort, active-frame process-reset refusal, PE canaries and final release/reuse passed. This establishes the context prerequisite only: no guest instructions, NE DLL initialization, lifecycle API, QT_Thunk, original game or browser ran. The sync-depth/cache pinning activation gate remains required for a future execution runner.

External preflight at 17:17:16.313Z verified idle runtime, six donor module hashes, 52 dependencies and 37.4 GB free; fresh staging verified 5,056 physical source blobs including Terminal.fon. TTL 17:51:53.185Z exceeded the outer 1,100-second bound plus cleanup. Independent postflight at 17:18:12.861Z verified active processes empty, all 5,056 source files and 52 dependencies unchanged, six donor modules unchanged and the new module matching the result manifest. Explicit lane release followed. Known git alternate-depth warnings did not prevent exact physical blob checks or any arm.

Recovery archive `scratch/runs/20261015-outlaws-kernel32-native/ne-context.tar.gz` is 4,808,974 bytes, SHA-256 450d7ac1a7a82794de0d0ea8edef19b75731ed110dc0fe70fa0f254a887857d6; it includes candidate.wasm, all arm logs/statuses, physical source/dependency inventories, result and independent postflight. Remote evidence is `/tmp/wa-ne-context-native-20261015`. Adjacent retained stage/preflight/recovery scripts, source bundle, TTL, launch and terminal API receipts provide the recovery recipe without modifying donors.

## Register-called invocation runner (source checkpoint)

The next layer adds strict mapped 16-bit CS:IP and DS validation, a process execution lease (same-owner nesting, other owners receive busy), the existing sync-depth/spill pin protocol entered before replacing the caller's IP, and an owned far-return continuation. RETF completion must match the current frame's owner, private SS and exact expected SP. It captures DX:AX separately from the saved caller registers. Completion or cancellation restores caller state and releases depth/lease; out-of-order teardown is rejected. Additional run scratch (`resume_ip`, `eip_redirected`, `current_thunk_eip`) now round-trips. Cache cursors and generation state are intentionally not reverted.

`lib/ne-invoke.js` is an internal bounded host driver, not a guest API. It always tears down its exact frame on return, trap, rejected wait, cancellation or budget exhaustion; a teardown failure is surfaced alongside an original error. Callers must supply their exact live-thread exports facade. Asynchronous yield-service callbacks are explicitly rejected before frame acquisition: their settlement cannot yet be bounded, and unwinding while an outstanding service can mutate guest state would be unsafe. All guest waits therefore report unsupported at this stage. Cancellation is checked between bounded run slices. Module publication and dependency ownership are not delegated to this driver.

Actual extracted-helper tests cover selector rejection without caller mutation, LibEntry register setup, real RETF handler/result, execution-lease exclusion, nested cancellation, suspended spill protection and exact restoration. Host-driver unit checks cover return/trap/wait/cancel/budget and teardown failure. The prepared full-module fixture loads synthetic NE code under a nonzero-base PE and executes real return, zero-result entry, nested far CALL/RETF, malformed RETF trap, spinning budget exhaustion and cancellation; these native assertions have not run at this checkpoint. Module lifecycle/publication/dependency rollback and guest exports/QT remain subsequent work in the same lane.

Prepared runner validation controller `tools/run-win32-ne-invoke-native.js` uses exact `WA_NE_INVOKE_COMMIT` and an outside-checkout `WA_NE_INVOKE_EVIDENCE`, under an outer 1,200-second bound and separate sole-lane grant. It pins reviewed production to ef4fb3c606414a9f9d728ccc718c1a98c9b5846f, preserves all seven admitted modules including context 9b57583c, and retains full physical input/dependency/idle/disk checks. It adds host-driver (30 seconds) and actual synthetic NE invocation (90) arms to the earlier normal-build/context/allocator/pure-NE sequence. No original game, browser, guest lifecycle exports or QT is included; no run is claimed by preparation.

Runner review removed inter-slice `setTimeout` suspension: an exports ownership facade does not reserve a guest thread against ordinary scheduling. The current driver performs its bounded slices synchronously, without an await between frame acquisition and teardown. Its Promise API reports completion/errors but does not permit timer-driven cancellation during execution. Tests cover a signal already aborted before acquisition and cancellation raised by a synchronous host callback after actual guest execution. Async waits and scheduler reservations remain unsupported. Other instances are also denied new bridge-frame allocations while a foreign execution/staging lease is live.

Controller review replaces nested synchronous GNU timeouts with the already-tested owned-process-group `runChild` helper from `tools/fifa98-remote-startup.js`. Each child group receives termination/escalation on timeout or controller signal, and surviving descendants are reaped before inspection. Child and postflight failures are retained independently; summary emission is in a protected finalization path. Child environments remove inherited WA_/WINE_/NODE_OPTIONS/NODE_PATH and add only explicit test inputs. Production pin advances to bff5375af1e1d7ef688694f4387344c1c65c4241, including the synchronous ownership correction. Native execution remains unperformed pending a renewed exact-source grant.

## Module transaction source checkpoint (excluded from runner native candidate)

An internal transaction table now occupies the verified unused hidden-page interval 0x8C00..0x8F00: 24 records of 32 bytes, between path selectors and the resource descriptors at 0x9000. Access requires an instance-owned live invocation frame, which pins the process arena. Names use the existing dynamic-module slots. Claim scans the entire table before choosing a free slot, distinguishes an owned new load from a ready reference, and refuses recursive/in-progress or foreign-owner loads. Loading, initializing and ready are distinct states; only nonzero AX permits ready publication.

Staging uses a nonblocking execution lease, not a mutex held across the existing trap-capable parser. The loader rejects a foreign or non-loading transaction before allocation, and records the allocated selector/metadata run before relocation begins. Owner-checked rollback reclaims that provisional run even when the legacy module record was never published; after successful placement, rollback uses the real DLL unload helper. A failed initialization cannot become ready. Pure-NE loading retains its previous path.

Actual extracted-helper tests pass for unpublished ownership, foreign load rejection before allocation, staging with DLL_LOAD_LOCK released, live lease exclusion, provisional allocation reclamation/reuse, AX-zero cleanup, and ready-reference acquisition. Parser execution is controlled in these tiny tests; native malformed-image/relocation rollback is not yet proven. The table is not connected to a guest API or host lifecycle manager. Dependency acquisition/rollback, import validation, ready-only public lookup, final termination/unload and thunk/name allocations remain required work. Runner native candidate 0768448d67a727a64370c55738346ccb2d8eaeae deliberately excludes this later transaction layer.

## Real NE invocation result (transaction layer excluded)

Immutable runner source 0768448d67a727a64370c55738346ccb2d8eaeae ran in fresh `/home/user/wa-ne-invoke-native`, PID 302790 (cmd_3btwgva7itet), 2026-10-15T17:42:43.567Z–17:43:08.823Z, exit zero. All nine arms passed: normal build 19,103 ms; host driver 22; actual native NE invocation 75; tiny context 466; native context 86; tiny arena 232; real allocator 193; unchanged pure-NE bounds 24; unchanged pure-NE loader 35. Every owned process group settled with no remaining processes, timeout or interruption.

The actual NE guest fixture passed normal DX:AX return, AX-zero failed-entry result, nested far CALL/RETF, malformed RETF trap, spinning block-budget exhaustion, synchronous callback cancellation and already-aborted rejection. Caller registers/state, sync depth, frame count and execution lease restored after each case, and another successful invocation worked afterward. This proves real register-called NE invocation under a PE process. It does not prove module lifecycle, async waits, QT_Thunk, browser behavior or the original game. Later transaction commits 3cd27312a/a9260845c were excluded from this runtime source.

Module `/home/user/wa-ne-invoke-native/build/wine-assembly.wasm` SHA-256: d6187fedf42d597311446e527d586b74a06db4f7f5eaaa6b51e483c5cc06603b. External preflight at 17:42:15.619Z verified idle, 52 dependencies, seven donor modules plus Darkstone paired module/map/head/source inventory, and 36.7 GB free. Staging verified 5,062 physical source blobs and the font. TTL was extended and verified to 18:41:32.744Z before the 1,200-second outer run.

Independent postflight at 17:43:36.878Z verified active processes empty, all 5,062 source files and 52 dependencies unchanged, all seven donor modules unchanged, and Darkstone's paired checkout head/physical source/module/map unchanged. Explicit release was sent to root and the FIFA worker. Recovery archive `scratch/runs/20261015-outlaws-kernel32-native/ne-invoke.tar.gz` is 6,181,930 bytes, SHA-256 af173ee1989a1d68bb25d7168eb1208c46404de3b100de810de04dd4ce3715c5. It includes candidate.wasm, logs, group ownership/status receipts, source/dependency inventories, preserved Darkstone inventory and independent postflight. Remote evidence is `/tmp/wa-ne-invoke-native-20261015`; adjacent local bundle/staging/preflight/recovery/TTL/launch/terminal receipts retain the recovery recipe. Known git alternate-depth warnings remained nonfatal; exact physical source checks and every test passed.

## Bounded host module lifecycle (source review packet)

The synchronous internal coordinator in `lib/ne-lifecycle.js` now owns a process lease across dependency acquisition, staging, initialization, publication and rollback. The image inspector copies input bytes and checks the segment, entry, name/import and relocation-chain ranges consumed by the current loader, rejecting cyclic or overlapping chains before staging. Only pre-Windows-4 single-data/data-none DLLs are admitted; recursive dependencies and missing images fail before allocations. KERNEL imports use existing real dispatch, including existing fail-fast unsupported handlers. Nothing here exports the missing Win32 bridge ordinals or QT_Thunk.

Ready references skip initialization. Public internal lookups require ready state and an owned lease; `call` resolves and executes under one scope, with an active-module pin that prevents final unload during a nested callback. A raw lookup address alone grants no execution lifetime. Dependencies transfer exactly the references acquired by their parent. Failed initialization reclaims the module's segment/metadata allocation and name, then releases those dependency references. The scope always restores the caller's CPU/frame state. Guest-allocated GlobalAlloc/selectors and other guest-created resources still need module ownership accounting before broad guest activation; the current rollback tests prove module mappings/references, not arbitrary initializer side effects. Interned import thunks remain process-owned.

Final release reserves a terminating state and lease, resolves WEP by name, and calls it with one callee-cleaned WORD `WEP_FREE_DLL=0`. Its return value is not a veto. This ABI follows [Wine's MODULE_CallWEP and NE_FreeModule](https://github.com/wine-mirror/wine/blob/master/dlls/krnl386.exe16/ne_module.c) and [WEP constants](https://github.com/wine-mirror/wine/blob/master/include/winbase.h). A trapped, cancelled or exhausted WEP retains its module, dependencies and termination owner; an explicit same-owner retry can finish it. Ordinary release cannot silently discard that failure. The Win4 DllEntryPoint lifecycle is explicitly rejected until implemented.

Local source tests pass: `node test/test-ne-image.js`, `node test/test-ne-invoke-driver.js`, `node test/test-win32-ne-context.js`, and `node test/test-win32-ne-module-transaction.js`. The latter uses the actual compiled loader, allocator, export parser and RETF helpers with a controlled guest-run boundary. It covers dependency/ready refs, ordinal holes and named lookup, successful unload, failed initialization, retained failed WEP and retry, active-call unload rejection, and Buffer-unavailable host execution. This is not full-interpreter or browser proof.

Prepared `test/test-win32-ne-lifecycle-candidate.js` executes real synthetic LibEntry/VALUE/WEP bytes with the full interpreter, including two shared instances, nested unload refusal, AX-zero initialization, malformed RETF traps, retained failed termination, and an explicit synthetic-code repair/retry with cache invalidation. The existing runner fixture now uses claim/stage ownership and rollback instead of bypassing the PE guard. No native lifecycle result is claimed yet.

The separately gated original arm requires the unchanged 18,890-byte PMPRO62 NE image, SHA-256 `7e2b17e61e7e4808a50478ddcac06f65fcf9f3ffd741d747c8cb75e20cb05db9`, recovered at `scratch/runs/20261015-outlaws-oemkeyscan-native/original-loader-fixtures/pmpro62.dll`. Static inspection passes: three segments, NE version 3.00, 61 named entries, WEP named ordinal 1, and KERNEL imports 4, 15–21, 48, 96, 132, 171, 176, 184, 185, 197 and 198. The native arm will load/init, compare all named/ordinal lookups, acquire/drop an extra reference, and unload. It will stop on unsupported behavior; it does not call arbitrary hardware-service exports, QT_Thunk, the wrapper or original game.

`tools/run-win32-ne-lifecycle-native.js` pins production source `44699c0df4db30871f613b97b0960d41407b16a3`. It requires exact controller HEAD, physical source/font hashes, all 52 dependency files, eight donor modules plus Darkstone's paired module, and the original image hash before every arm. It uses the already-admitted owned-PGID runner, filters inherited WA_/WINE_/NODE_OPTIONS/NODE_PATH, preserves both primary and postflight failures, and rejects active runtime processes. Twelve child bounds total 1,260 seconds under a 1,500-second outer timeout; normal build is included. External admission must additionally verify adequate TTL, disk floor, paired source/evidence inventories and independent postflight/recovery. No runtime grant is inferred from this source packet.

## Lifecycle native result: synthetic pass, original initialization blocked

Exact source `93410966d20a014a8a450a9ff2d581c6d533700b` ran in `/home/user/wa-ne-lifecycle-native`, PID 332007 (cmd_vvvxcqw9angx), 2026-10-15T18:23:26.483Z–18:24:00.030Z, exit 1. Normal build, host driver, native invocation, tiny context, image validation, tiny lifecycle and actual native synthetic lifecycle passed. The unchanged original PMPRO62 initializer trapped before original export lookup or unload. The controller stopped: tiny arena, native real allocator, pure-NE bounds and pure-NE loader were not run. All owned child groups settled without survivors or timeout. No original compatibility success or complete-suite pass is claimed.

The retained stack maps to `win16_set_sreg` (782), `win16_far_transfer` (792), `th_call_far_imm` (795), then `run` (11923), using this build's combined WAT. This identifies an unmapped code selector during a far CALL; the retained fixture suppressed host numeric logs, so it does not identify the exact guest instruction or prove an unsupported API. Source inspection found import relocation reads `WIN16_THUNK_SEL` before invocation installs the NE selector; the lifecycle staging scope retains the PE caller's zero value. A real import-relocation regression and correction remain separate work. Synthetic lifecycle images in this run contain no executable import relocations.

Candidate module SHA-256 `497bc3c94c89e520091fd6c31b0f95780a1d5d6920f145169e7ba00f78eb04ee`; region map `23615dbc2b7ac3832186beb25da29f85b6e475480894dddf3fd1e7ccdb5d3820`. Independent postflight 18:24:44.336Z verified idle, all 5,069 physical source files, 52 dependencies, nine preserved donor paths and 18,549 external source/evidence records. Runtime explicitly released before further read-only recovery. Frozen remote evidence `/tmp/wa-ne-lifecycle-native-20261015` and archive `/tmp/wa-ne-lifecycle-native-20261015.tar.gz`; recovered archive `scratch/runs/20261015-outlaws-kernel32-native/ne-lifecycle.tar.gz`, 6,351,210 bytes, SHA-256 `20981e3e465734b25923a0ac0eb1128a5608995deaa1e397599cffe8fb0078a1`. Oversized initial transfer failed locally; bounded read-only chunks recovered the same archive and verified its hash without rerunning native code or recreating evidence.

## Import-selector candidate audit, 2026-10-17

Preserved commit `86386f92d8fa57e80a11726f2fa9fa1a0c7ea2c3` passes the
process-owned thunk selector explicitly to relocation while retaining the
existing pure-NE selector. PE DLL staging derives selector index 1, matching
arena bootstrap and invocation setup, without mutating caller globals.
The tiny extracted-WAT transaction test now stages a real KERNEL.4 far-CALL
relocation with both zero and stale nonzero caller selectors. Both produce
selector 15 and the actual LocalInit thunk record, then restore the complete
saved caller snapshot after rollback. This test passed on October 17; its
controlled guest runner does not execute the imported call.

The prepared full-interpreter lifecycle test does execute that call:
LibEntry pushes DS, zero and 16, calls the relocated KERNEL.LocalInit, and
returns with RETF. It checks the data segment grew from 0x100 to 0x110 and
checks caller registers, segment state, EIP, depth and thunk selector after
each lifecycle arm. Selector restoration is now included in the common
snapshot, including the original PMPRO62 arm and initialization failures.
This full-interpreter candidate remains **unrun**; syntax checks passed only.

The native controller's old production-source pin would reject the fix.
It now pins the `src`/`lib` bytes from `86386f92d8fa57e80a11726f2fa9fa1a0c7ea2c3`.
The next native candidate is the reviewed task-branch commit containing this
audit and controller update, supplied as the exact `WA_NE_LIFECYCLE_COMMIT`.
It requires a new build/module hash and fresh external admission, sufficient
disk, preserved inventories, sole runtime ownership and independent postflight.
Use a fresh external evidence directory; retain the October 15 evidence.
No build, remote runtime or original PMPRO62 retry was performed in this audit.
The previous original initializer trap remains the latest native outcome;
the four previously skipped allocator/pure-NE arms and original init/lookup/
unload remain required. QT_Thunk and original game execution remain separate
work, and the lifecycle production implementation remains off main.

### Integrated task candidate, October 17

Task merge `5389533f0891667e590c7eb6ca8a3c0ff80010ff` incorporates main
`baeb16c20e1ba7e0b09c8eb67aefbdc9748fd61f`. Main's host/browser asset and
Quake changes are retained exactly. The six overlapping invocation/document
files retain the reviewed task lifecycle extensions; the NE production bytes
are unchanged from `46baa081e245cb298b2a1b2b5ed55ef26d3f2934`.
The native controller now pins all `src`/`lib` bytes to this integrated merge,
superseding the earlier `86386f92d` pin. Pass the exact subsequent controller
commit as `WA_NE_LIFECYCLE_COMMIT`, not the production-pin commit.

Small checks passed on the integrated source: `test-ne-image.js`,
`test-ne-invoke-driver.js`, `test-win32-ne-context.js`,
`test-win32-ne-module-transaction.js`, `test-http-range-accept-whole.js`,
`test-game-data-timeout.js`, `test-asset-load-cancellation.js` (six cases),
and `test-quake-account-names.js`. Controller syntax and diff checks passed.
No full build, native execution, browser test or main integration was done.
The complete twelve-arm native controller, fresh module hash, unchanged
original PMPRO62 checks, disk floor and external preservation/admission
requirements above still apply. Previous native evidence does not validate
this integrated candidate.

### Ownership and recovery review corrections

Independent review found that the internal coordinator's API boundary did
not prevent NE guest code from calling legacy KERNEL.95/96. Commit
`83a15ca844596c6f04dd971a25c7fb219117020b` makes the actual KERNEL dispatcher
log the ordinal and trap those unsupported guest LoadLibrary/FreeLibrary
calls while a bridge frame exists. It cannot enter legacy reference counting
or unload bridge-owned segments. Ordinary NE dispatch remains unchanged.
The tiny test compiles the real dispatcher, checks both rejected ordinals
during an active pinned module call, and proves memory/refs/pins and saved
globals unchanged. Legacy-handler entry is a distinct host Error in this
fixture, so an accidental legacy call cannot masquerade as the expected trap.

Commit `73e5ce824c41e1c8862b08620867acf6dd1603b7` validates every non-KERNEL
import against its dependency's named/ordinal exports before allocation. It
also checks actual acquired module exports before staging the parent: a ready
module may have been loaded by another coordinator with different source
bytes. Missing source exports leave memory unchanged; missing actual exports
roll back the parent and acquired dependency reference. Tiny tests cover
both ordinal and named misses and retain the original dependency owner's ref.
KERNEL imports continue to use real API dispatch and existing fail-fast
unsupported behavior; no compatibility result follows from preflight alone.

Commit `d5b940c8b104b2e4d7b7e29506ad6e2fd6aea17c` adds structured recovery:
`NeTerminationError` has `code: 'NE_TERMINATION_PENDING'`, `moduleId`, the
original `cause`, and `pendingTerminations: [moduleId]`. Aggregate lifecycle
errors preserve a deduplicated top-level `pendingTerminations` array and
their constituent errors. Thus a caller whose parent already unloaded or
whose initialization rolled back can inspect retained dependency ids and,
after diagnosis, explicitly call `retryTermination(id)` on the same owner.
No automatic retry or release occurs. Tiny tests repair only synthetic WEP
bytes and verify retry after parent release, AX-zero initialization and
initializer traps, with no remaining frame/lease and exact caller restoration.

All four small NE checks passed after these corrections: image validation,
host driver, extracted invocation context and extracted transaction/lifecycle
tests. The native controller now pins production to `d5b940c8b104b2e4d7b7e29506ad6e2fd6aea17c`,
superseding the integrated-source pin above; use the exact subsequent
controller commit as the native candidate. No full build or native execution
has validated these corrections. The prior PMPRO62 initializer failure remains
the latest native outcome, and main integration remains withheld.

### Prepared native review regressions (unrun)

The full-interpreter lifecycle fixture now includes these additional cases:

- Ordinal 2 and named VALUE imports from HELPER execute a relocated far CALL
  and RETF. The fixture checks the imported result 0x1234 at initializer
  publication and on a subsequent call through exported LibEntry.
- Missing ordinal/named exports reject without guest invocation; an already
  loaded HELPER with a different export table triggers actual acquired-module
  validation, parent rollback and dependency ref restoration.
- GUESTLOAD/GUESTFREE invoke relocated KERNEL.95/96 from a published module's
  VALUE export with two references and an active call pin. The fixture requires
  a native trap, the guard's ordinal log, unchanged module records and restored
  caller state, then proves ordinary owned termination remains possible.
- Failed dependency WEP after parent unload, AX-zero initialization and a
  malformed initializer RETF exposes the retained id and original cause. A
  synthetic-only WEP repair invalidates code before same-owner retry; checks
  require final frame/lease cleanup and exact caller restoration.

Only syntax, image inspection/byte assertions, the tiny transaction suite
and image validator were run for this test-only extension. None of the new
full-interpreter cases has executed. Production bytes are unchanged, so the
controller's `d5b940c8b104b2e4d7b7e29506ad6e2fd6aea17c` production pin remains
valid. The exact next native candidate is the task commit containing these
test additions, supplied as `WA_NE_LIFECYCLE_COMMIT`; fresh admission and a
normal build are still required.

### Native named-import correction, 2026-10-18

The first local full-module run at `55a38e16f9c88d0383643daf9728b5029293e355`
passed six arms and the ordinal-import case, then trapped on `HELPER.VALUE`.
The original module `e90da3db6b0740420e370a3d817cd59a9efab403df509de3e161524665badc81`
is retained in `scratch/runs/20261018-outlaws-local-native/`.
Named thunks stored only an import-name-table offset. Dispatch added that
offset to the task-global NE header, which is zero for this PE caller, so the
valid name at importer-relative offset 7 was looked up at linear address 7.

Relocation now resolves names against an already loaded dependency using the
actual importing image's NE header and creates the existing ordinal thunk.
Unresolved and builtin names retain their legacy dispatch path. This does not
add a generic DLL-name storage mechanism or qualify builtin named imports
from PE-owned NE modules.

Evidence in `scratch/runs/20261018-outlaws-named-import-fix/` includes the
original-module failure, canonical build log, passing extracted transaction
test, passing full-module synthetic lifecycle test, and pure-NE additive-far
loader test. The native regression keeps two importers alive with name strings
at the same offset 7: VALUE returns 0x1234 and ENTRY returns 1. Alternating
calls prove that names do not alias through the task-global header or thunk
cache. Existing missing-export, guest lifecycle guard and retained-WEP cases
also pass. PMPRO62 and the complete twelve-arm controller were not rerun for
this focused correction; the controller production pin remains unchanged
pending review of this production-source commit.

## Original WEP failure: source review, 2026-10-18

The retained `20261018-outlaws-fullsuite-native` run at source
`3de949dd78a77cf532353263a27eff4c74089983` passed seven arms and stopped on
original PMPRO62 final unload. The original image remains SHA-256
`7e2b17e61e7e4808a50478ddcac06f65fcf9f3ffd741d747c8cb75e20cb05db9`.
This review used the saved log, original image, NE relocation table and static
8086 disassembly only; no new build, guest, browser or runtime test ran.

The immediate cause is unimplemented **KERNEL.48, GetModuleUsage**. The saved
host tail is `[96,3390482929,65584,138548597]`: `3390482929` is `0xCA16A9F1`,
the final unimplemented-API marker in `win16_dispatch`; `65584` is the packed
KERNEL module 1 / ordinal 48 key. The preceding 96 belongs to the earlier
synthetic BADTRAP test, which does not clear the log before the original arm.
This is not evidence of original PMPRO62 calling the guarded FreeLibrary path.

The original NE entry table names WEP at segment 1 offset `0x00b4`.
Its ordinary path calls `1:173a`, then `1:15ff`, then the near CRT cleanup at
`1:1559`. Cleanup compares DS with SS at `1:1564`–`1:156a`; the retained trap
records DS=55 and SS=71, so it takes the module-usage query path. At `1:156c`
it pushes the WORD at DS:`003b`, and at `1:1570` performs the far import call.
The relocation record at file offset 8149 has type 3, flags 1, site `1571`,
module 1, ordinal 48, confirming the import independently of the host log.
The logged return address `0x08421575` matches original offset `1575` with
code base `0x08420000`. The saved EIP `0x0842156c` identifies the beginning of
that translated block, not the far-call opcode itself.

Initializer `1:0000` stores DI at DS:`003b`. The bridge supplies DI from
`instance`, and `ne-lifecycle.js` supplies the module data selector as instance.
Thus source flow predicts the pushed instance is 55; the failure log does not
include the actual stack argument or data word, so that value is inferred,
not directly sampled. On return the original code compares AX to 1 and skips
destructor work when it is greater than 1. A constant successful answer would
discard real reference-count semantics.

A focused implementation must resolve both the module handles produced by
GetModuleHandle/LoadLibrary and the DGROUP instance selector supplied to
LibEntry. Bridge modules keep their authoritative refs at bridge-record +8;
the legacy DLL refcount is a different store. Final release changes bridge
state from ready (3) to terminating (4), retaining refs=1 while WEP executes.
The query must remain valid during that terminating state, remain read-only,
and return zero for invalid/stale handles. It must not change DS/SS to bypass
the query or relax guest LoadLibrary/FreeLibrary guards.

Next bounded validation, once the runtime lane is granted: add a synthetic
NE import of KERNEL.48 which queries its saved initializer instance, exercise
one/two/one references and the final WEP query, and cover invalid handles,
module-handle aliases, caller restoration and preserved termination leases.
Then run the unchanged original arm with a diagnostic snapshot of the
argument and record refs at this import; inspect any later failure before
claiming unload success. Finally run the complete twelve-arm controller.
The four arms after original PMPRO62 remain unrun in the retained suite.
No implementation change is included in this source-only review.

### KERNEL.48 implementation checkpoint, 2026-10-18

The dispatcher now implements GetModuleUsage with a read-only lookup of loaded
module handles and DGROUP instance selectors. Bridge ownership records supply
their actual reference count, including state 4 during final WEP; legacy DLLs
use their explicit loader count or the existing implicit import reference.
The standalone pure-NE task image owns one task reference. Unresolved and
retired module handles return zero, without resource lookup's current-CS fallback
or the generic handle decoder's invalid-handle trap. This covers loaded NE
images; builtin dispatcher identities without a loaded NE image have no NE
reference record and return zero.

Primary implementation reference: Wine's
[GetModuleUsage16](https://github.com/wine-mirror/wine/blob/master/dlls/krnl386.exe16/ne_module.c)
resolves NE_GetPtr and returns the module count, or zero for an unresolved handle.
No constant success path replaces the bridge's count, and the original DLL,
guest LoadLibrary/FreeLibrary guards and termination retention are unchanged.

The tiny transaction fixture compiles the actual dispatcher, argument reader,
handler and far return. It checks both handles, 1/2/1 references, state-4 WEP,
invalid/stale/non-module handles, Pascal cleanup, unchanged module memory and
caller restoration. It also covers legacy implicit/explicit refs and a DGROUP
selector above the handle-table base. The native fixture now imports KERNEL.48
in VALUE and WEP, saves initializer DI in DGROUP, and makes WEP reject a count
other than one. Native and unchanged-original validation are pending at this
source checkpoint; the controller's production pin is deliberately unchanged.

Review identified that the generic handle table starts at 0x100 and can overlap
DGROUP selectors (`index * 8 + 7`). Module aliases now skip selector-shaped
slots, both on fresh allocation and reuse; generic UI mappings retain their
existing capacity. GetModuleUsage ignores non-module mappings while resolving
a live DGROUP. This makes the two accepted module identities disjoint without
changing UI handle interpretation. Tiny regressions exercise an occupied UI
slot equal to DGROUP, fresh/reused reserved slots and all module IDs. These
rules apply to newly initialized processes; no live old-module migration is
performed.

### Focused native validation, 2026-10-18

Source `a62466211ea61f4d199f7057622a4e2ce98e82b7` passed the canonical build
and full-interpreter lifecycle fixture, including the new relocated
GetModuleUsage queries (1/2/1 and final WEP) and the unchanged original PMPRO62.
Original initialization, all 61 named/ordinal lookup pairs, duplicate load,
reference decrement and final unload completed with the PE caller restored.
The module is SHA-256
`3b5655d5d7e6046bfaa21c90d39abe34a279eff8957700f284282cd6b0fe98e3`.
Evidence, original bytes, region map, bounded recovery controller, logs and
process receipts are retained in `scratch/runs/20261018-outlaws-module-usage/`.
Both owned process groups exited zero without survivors; independent postflight
passed and free space remained above 2 GiB. Synthetic malformed-WEP traps in
the log are expected rejection/retry cases, not original failures.

This is focused validation, not the twelve-arm suite or original Outlaws
gameplay/QT_Thunk. The controller production pin still names the earlier
named-import fix. Root review and pin advancement precede the next full-suite
run, including the four arms skipped after the previous original failure.
