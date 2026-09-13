  ;; ============================================================
  ;; WIN32 API HANDLER FUNCTIONS
  ;; Hand-written implementations called from the generated dispatch.
  ;; Each handler receives (arg0..arg4, name_ptr) and must set $eax
  ;; and adjust $esp for stdcall cleanup before returning.
  ;; ============================================================

  ;; =====================================================================
  ;; RECT — the first CLASS-C layout (docs/watx-layout-migration-design.md
  ;; §7, wave 6). Class C is the guest's memory: the address descends from
  ;; $g2w, so these bytes belong to the application, and the offsets below
  ;; are not a choice we get to make.
  ;;
  (; FROZEN: RECT — Win32 ABI, windef.h. Four LONGs, in this order, and the
     guest binary already contains the compiled instructions that read them at
     these offsets. Moving one is not a refactor: it is a wire-format change,
     it traps nowhere, and it misreads every app at once.
     tools/gen-layout-offsets.js --check refuses any movement. ;)
  (layout Rect
    (field left   i32)    ;; +0
    (field top    i32)    ;; +4
    (field right  i32)    ;; +8
    (field bottom i32))   ;; +12  ends at +16 == sizeof(RECT)

  ;; A SECOND layout for the same C structure, deliberately, with the reason
  ;; stated as docs/watx-layout-migration-design.md §7 requires: `PaintRect`
  ;; (src/10-helpers.wat) describes a slot of the emulator's OWN PAINT_SCRATCH
  ;; ring, and that ring is NOT a RECT array. It hands out 16 opaque bytes and
  ;; three of its live slots are something else entirely — a "X, Y" status
  ;; string, a single '>' glyph byte, an address passed straight to $w2g. So
  ;; PaintRect cannot carry the FROZEN marker (its bytes are ours, and a slot
  ;; may legitimately stop being a rect), and `Rect` cannot be merged into it
  ;; (its bytes are Microsoft's, and must never stop being a rect). Same four
  ;; fields, opposite ownership.
  ;;
  ;; WHAT THE $g2w BASE DOES AND DOES NOT PROVE, because this is the finding
  ;; the class-C waves have to carry: `--base-local-from-call=$g2w` proves a
  ;; local holds a GUEST pointer. It does not prove WHICH guest structure,
  ;; because every class-C record in the tree arrives through the same one
  ;; call. Read at +0/+4/+8/+12 off a $g2w'd local, in this file alone:
  ;; $handle_GetSystemDirectoryA's `$dst` (an ANSI path buffer),
  ;; $handle_CoCreateGuid's `$wa` (a GUID) and $handle_GetLogicalDriveStringsW's
  ;; `$buf` (a UTF-16 buffer) are all indistinguishable from a rect to any
  ;; mechanical rule, and all three would convert BYTE-IDENTICALLY. So the
  ;; attribution here is the Win32 SIGNATURE — every converted function takes
  ;; an LPRECT at that argument position per the SDK — and it is spelled as an
  ;; explicit --only-func list in tools/build.sh, not derived.
  ;; =====================================================================

  ;; =====================================================================
  ;; POINT — the second CLASS-C layout, and the same ownership story as RECT
  ;; above: the address comes out of $g2w, the bytes are the application's,
  ;; and the two offsets are Microsoft's.
  ;;
  (; FROZEN: POINT — Win32 ABI, windef.h. Two LONGs, x then y, and the guest
     binary already contains the compiled instructions that read them at these
     offsets. Moving one is a wire-format change: it traps nowhere and
     misreads every app at once.
     tools/gen-layout-offsets.js --check refuses any movement. ;)
  (layout Point
    (field x i32)    ;; +0
    (field y i32))   ;; +4  ends at +8 == sizeof(POINT)

  ;; Emulator-private heap record backing the opaque HHOOK values returned by
  ;; SetWindowsHook[Ex]. Unlike RECT/POINT this is not a guest ABI: USER owns
  ;; every byte and can retire or extend the representation internally.
  (layout HookNode
    (field magic        i32)  ;; +0  "HOK1" while linked
    (field proc         i32)  ;; +4  guest HookProc
    (field next         i32)  ;; +8  older hook in this class
    (field retired_next i32)) ;; +12 deferred-free list

  ;; WHY THIS LAYOUT IS SMALL, and it is a finding about the tree and not
  ;; about POINT: almost every guest POINT in this emulator is touched through
  ;; the $gs32/$gl32 guest accessors, which take a GUEST address and are calls,
  ;; not `i32.load`/`i32.store` on a $g2w'd local. The layout system describes
  ;; the latter, so it cannot see the former at all. $handle_GetCursorPos,
  ;; $handle_GetViewportOrgEx, $handle_SetViewportOrgEx, $handle_GetWindowOrgEx,
  ;; $handle_SetWindowOrgEx, $handle_OffsetViewportOrgEx,
  ;; $handle_OffsetWindowOrgEx, $handle_GetCurrentPositionEx,
  ;; $handle_GetBrushOrgEx, $handle_DPtoLP and $handle_LPtoDP all take an
  ;; LPPOINT by their SDK prototype and are all declined for exactly that
  ;; reason — the access width and kind disagree with the field, not the name.
  ;; $handle_GetCaretPos is declined for a narrower one: its base is an inline
  ;; `(call $g2w …)` per access rather than a local, so there is no base local
  ;; to attribute. None of these is a judgement about whether the pointer is a
  ;; POINT; they all are.
  ;;
  ;; And the same $g2w warning as RECT applies with more force at eight bytes
  ;; than at sixteen. In src/09a7-handlers-dispatch.wat, $handle_GetDCOrgEx
  ;; (an LPPOINT, converted) and $handle_QueryPerformanceCounter (a
  ;; LARGE_INTEGER, NOT converted) sit four lines apart and write +0/+4 off a
  ;; $g2w'd local named `$wa` in the same shape. Both convert byte-identically
  ;; and one of them would be a lie. The --only-func list in tools/build.sh is
  ;; what separates them, and it is a claim about the SDK prototype.
  ;; =====================================================================

  ;; ---- Timer table helpers ----
  ;; Timer table at 0x24C0: 16 entries × 20 bytes
  ;; Each entry: [hwnd:4][id:4][interval:4][last_tick:4][callback:4]
  ;; A zero hwnd/id pair means the slot is empty. Window-owned timers may use
  ;; ID 0 (Tetris does), while thread/callback timers have hwnd=0 and an
  ;; auto-generated nonzero ID.

  ;; $timer_set(hwnd, id, interval_ms, callback) — add or update a timer
  ;;
  ;; Locked for the same reason as the window table: this is a scan-then-claim
  ;; over a table every instance shares, so two threads calling SetTimer at the
  ;; same instant can both settle on the same free slot and one timer never
  ;; fires. The clock read is deliberately OUTSIDE the lock — it is a host
  ;; import, and rule 1 on $lock_acquire is that a section holding a spinlock
  ;; must not make one: in worker mode that call blocks in Atomics.wait for the
  ;; main thread, which may itself be spinning for this lock.
  (func $timer_set (param $hwnd i32) (param $id i32) (param $interval i32) (param $callback i32)
    (local $i i32)
    (local $addr i32)
    (local $free_slot i32)
    (local $owner_tid i32)
    (global.set $tick_count (call $host_get_ticks))
    (local.set $owner_tid (call $wnd_get_thread (local.get $hwnd)))
    (if (i32.eqz (local.get $owner_tid))
      (then (local.set $owner_tid (global.get $current_thread_id))))
    (local.set $free_slot (i32.const -1))
    (local.set $i (i32.const 0))
    (call $lock_wnd_acquire)
    (block $break
      (loop $loop
        (br_if $break (i32.ge_u (local.get $i) (global.get $TIMER_MAX)))
        (local.set $addr (i32.add (global.get $TIMER_TABLE) (i32.mul (local.get $i) (global.get $TIMER_ENTRY_SIZE))))
        ;; Check if this slot matches (same hwnd + id) — update in place.
        ;; Either half may legitimately be zero, so only the zero/zero pair is
        ;; empty.
        (if (i32.and
              (i32.or
                (i32.ne (i32.load (local.get $addr)) (i32.const 0))
                (i32.ne (i32.load (i32.add (local.get $addr) (i32.const 4))) (i32.const 0)))
              (i32.and
                (i32.eq (i32.load (local.get $addr)) (local.get $hwnd))
                (i32.eq (i32.load (i32.add (local.get $addr) (i32.const 4))) (local.get $id))))
          (then
            ;; Existing records follow the same publish protocol as inserts:
            ;; hide the id while rewriting the payload, then publish it last.
            (i32.atomic.store offset=4 (local.get $addr) (i32.const 0))
            (i32.store (i32.add (local.get $addr) (i32.const 8)) (local.get $interval))
            (i32.store (i32.add (local.get $addr) (i32.const 12)) (global.get $tick_count))
            (i32.store (i32.add (local.get $addr) (i32.const 16)) (local.get $callback))
            (i32.store (i32.add (global.get $TIMER_SHARED)
              (i32.add (i32.const 0x10) (i32.mul (local.get $i) (i32.const 4))))
              (local.get $owner_tid))
            (i32.atomic.store offset=4 (local.get $addr) (local.get $id))
            (call $lock_wnd_release)
            (return)
          )
        )
        ;; Track first free slot (only hwnd=0,id=0 is empty).
        (if (i32.and
              (i32.eq (local.get $free_slot) (i32.const -1))
              (i32.and
                (i32.eqz (i32.load (local.get $addr)))
                (i32.eqz (i32.load (i32.add (local.get $addr) (i32.const 4))))))
          (then (local.set $free_slot (local.get $i))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $loop)
      )
    )
    ;; Not found — insert into free slot
    (if (i32.ge_s (local.get $free_slot) (i32.const 0))
      (then
        (local.set $addr (i32.add (global.get $TIMER_TABLE) (i32.mul (local.get $free_slot) (global.get $TIMER_ENTRY_SIZE))))
        (i32.store (local.get $addr) (local.get $hwnd))
        (i32.store (i32.add (local.get $addr) (i32.const 8)) (local.get $interval))
        (i32.store (i32.add (local.get $addr) (i32.const 12)) (global.get $tick_count))
        (i32.store (i32.add (local.get $addr) (i32.const 16)) (local.get $callback))
        (i32.store (i32.add (global.get $TIMER_SHARED)
          (i32.add (i32.const 0x10) (i32.mul (local.get $free_slot) (i32.const 4))))
          (local.get $owner_tid))
        ;; id is the publication word and is written after the complete entry.
        (i32.atomic.store offset=4 (local.get $addr) (local.get $id))
        (drop (i32.atomic.rmw.add (global.get $TIMER_SHARED) (i32.const 1)))
      )
    )
    (call $lock_wnd_release)
  )

  ;; $timer_kill(hwnd, id) — remove a timer, return 1 if found
  ;; Under the same lock as $timer_set: freeing a slot while another thread is
  ;; mid-scan for a free one is how a slot ends up claimed twice.
  (func $timer_kill (param $hwnd i32) (param $id i32) (result i32)
    (local $i i32)
    (local $addr i32)
    (local.set $i (i32.const 0))
    (call $lock_wnd_acquire)
    (block $break
      (loop $loop
        (br_if $break (i32.ge_u (local.get $i) (global.get $TIMER_MAX)))
        (local.set $addr (i32.add (global.get $TIMER_TABLE) (i32.mul (local.get $i) (global.get $TIMER_ENTRY_SIZE))))
        (if (i32.and
              (i32.or
                (i32.ne (i32.load (local.get $addr)) (i32.const 0))
                (i32.ne (i32.load (i32.add (local.get $addr) (i32.const 4))) (i32.const 0)))
              (i32.and
                (i32.eq (i32.load (local.get $addr)) (local.get $hwnd))
                (i32.eq (i32.load (i32.add (local.get $addr) (i32.const 4))) (local.get $id))))
          (then
            ;; Clear both identity fields to mark the slot empty. The id is the
            ;; field another thread's scan tests, so publish that one atomically.
            (i32.atomic.store offset=4 (local.get $addr) (i32.const 0))
            (i32.store (local.get $addr) (i32.const 0))
            (i32.store (i32.add (global.get $TIMER_SHARED)
              (i32.add (i32.const 0x10) (i32.mul (local.get $i) (i32.const 4)))) (i32.const 0))
            (drop (i32.atomic.rmw.sub (global.get $TIMER_SHARED) (i32.const 1)))
            (call $lock_wnd_release)
            (return (i32.const 1))
          )
        )
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $loop)
      )
    )
    (call $lock_wnd_release)
    (i32.const 0)
  )

  ;; Real USER tears down HWND-owned timers when the window is destroyed.
  ;; Without this, timer-driven child pages can keep sending WM_TIMER after
  ;; their HWND has gone away and continue drawing through cached parent DCs.
  (func $timer_kill_hwnd (param $hwnd i32)
    (local $i i32)
    (local $addr i32)
    (local.set $i (i32.const 0))
    (call $lock_wnd_acquire)
    (block $break
      (loop $loop
        (br_if $break (i32.ge_u (local.get $i) (global.get $TIMER_MAX)))
        (local.set $addr (i32.add (global.get $TIMER_TABLE) (i32.mul (local.get $i) (global.get $TIMER_ENTRY_SIZE))))
        (if (i32.and
              (i32.eq (i32.load (local.get $addr)) (local.get $hwnd))
              (i32.or
                (i32.ne (i32.load (local.get $addr)) (i32.const 0))
                (i32.ne (i32.load (i32.add (local.get $addr) (i32.const 4))) (i32.const 0))))
          (then
            (i32.atomic.store offset=4 (local.get $addr) (i32.const 0))
            (i32.store (local.get $addr) (i32.const 0))
            (i32.store (i32.add (global.get $TIMER_SHARED)
              (i32.add (i32.const 0x10) (i32.mul (local.get $i) (i32.const 4)))) (i32.const 0))
            (drop (i32.atomic.rmw.sub (global.get $TIMER_SHARED) (i32.const 1)))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $loop)))
    (call $lock_wnd_release))

  ;; Consume one due multimedia-timer period without moving its phase to the
  ;; late delivery time. A 5ms periodic timer polled at t=6,12,18 otherwise
  ;; becomes a 6ms timer permanently; advancing to the latest 5ms boundary
  ;; keeps future callbacks aligned while still skipping missed callbacks.
  (func $mm_timer_consume_due_tick (param $slot i32)
    (local $periods i32) (local $interval i32)
    (local.set $interval (i32.load offset=4 (local.get $slot)))
    (if (i32.eqz (local.get $interval))
      (then (i32.store offset=16 (local.get $slot) (global.get $tick_count)))
      (else
        (local.set $periods
          (i32.div_u
            (i32.sub (global.get $tick_count) (i32.load offset=16 (local.get $slot)))
            (local.get $interval)))
        (i32.store offset=16 (local.get $slot)
          (i32.add
            (i32.load offset=16 (local.get $slot))
            (i32.mul (local.get $periods) (local.get $interval)))))))

  ;; Address of multimedia-timer slot $i.
  (func $mm_timer_slot (param $i i32) (result i32)
    (i32.add (global.get $MM_TIMER_TABLE)
      (i32.mul (local.get $i) (global.get $MM_TIMER_ENTRY))))

  ;; Slot holding timer id $id, or 0. Id 0 is the free marker, never a timer.
  (func $mm_timer_find (param $id i32) (result i32)
    (local $i i32) (local $slot i32)
    (if (i32.eqz (local.get $id)) (then (return (i32.const 0))))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (global.get $MM_TIMER_MAX)))
      (local.set $slot (call $mm_timer_slot (local.get $i)))
      (if (i32.eq (i32.load (local.get $slot)) (local.get $id))
        (then (return (local.get $slot))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (i32.const 0))

  ;; First slot whose period has elapsed, or 0. Refreshes $tick_count, so the
  ;; caller does not have to.
  (func $mm_timer_due_slot (result i32)
    (local $i i32) (local $slot i32)
    (global.set $tick_count (call $host_get_ticks))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (global.get $MM_TIMER_MAX)))
      (local.set $slot (call $mm_timer_slot (local.get $i)))
      (if (i32.load (local.get $slot))
        (then
          (if (i32.ge_u
                (i32.sub (global.get $tick_count) (i32.load offset=16 (local.get $slot)))
                (i32.load offset=4 (local.get $slot)))
            (then (return (local.get $slot))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (i32.const 0))

  ;; Charge one period to a due slot, retiring it if it was a one-shot.
  (func $mm_timer_consume_slot (param $slot i32)
    (call $mm_timer_consume_due_tick (local.get $slot))
    (if (i32.load offset=20 (local.get $slot))
      (then (i32.store (local.get $slot) (i32.const 0)))))

  ;; $timer_check_due(msg_ptr, consume) — scan timer table, fill MSG with first due timer, return 1 if found
  ;; $consume: 1 = update last_tick (PM_REMOVE/GetMessage), 0 = peek only (PM_NOREMOVE)
  (func $timer_check_due (param $msg_ptr i32) (param $consume i32) (result i32)
    (local $i i32)
    (local $addr i32)
    (local $elapsed i32)
    (local $found i32)
    ;; Update tick_count from host real time
    (global.set $tick_count (call $host_get_ticks))
    (local.set $i (i32.const 0))
    (call $lock_wnd_acquire)
    (block $break
      (loop $loop
        (br_if $break (i32.ge_u (local.get $i) (global.get $TIMER_MAX)))
        (local.set $addr (i32.add (global.get $TIMER_TABLE) (i32.mul (local.get $i) (global.get $TIMER_ENTRY_SIZE))))
        ;; Skip the empty zero/zero identity pair, and every slot owned by
        ;; another guest thread: a WM_TIMER is delivered to the thread that set
        ;; the timer. Both halves are normalized to 0/1 before the i32.and —
        ;; the raw id is arbitrary and an even one would clear the low bit.
        (if (i32.and
              (i32.or
                (i32.ne (i32.load (local.get $addr)) (i32.const 0))
                (i32.ne (i32.atomic.load offset=4 (local.get $addr)) (i32.const 0)))
              (i32.eq (i32.load (i32.add (global.get $TIMER_SHARED)
                (i32.add (i32.const 0x10) (i32.mul (local.get $i) (i32.const 4)))))
                (global.get $current_thread_id)))
          (then
            (local.set $elapsed (i32.sub (global.get $tick_count) (i32.load (i32.add (local.get $addr) (i32.const 12)))))
            (if (i32.ge_u (local.get $elapsed) (i32.load (i32.add (local.get $addr) (i32.const 8))))
              (then
                ;; Timer is due — only update last_tick if consuming
                (if (local.get $consume)
                  (then (i32.store (i32.add (local.get $addr) (i32.const 12)) (global.get $tick_count))))
                (call $gs32 (local.get $msg_ptr) (i32.load (local.get $addr)))                          ;; hwnd
                (call $gs32 (i32.add (local.get $msg_ptr) (i32.const 4)) (i32.const 0x0113))            ;; WM_TIMER
                (call $gs32 (i32.add (local.get $msg_ptr) (i32.const 8)) (i32.load (i32.add (local.get $addr) (i32.const 4))))   ;; wParam=timerID
                (call $gs32 (i32.add (local.get $msg_ptr) (i32.const 12)) (i32.load (i32.add (local.get $addr) (i32.const 16)))) ;; lParam=callback
                ;; MSG.time participates in application-side queue ordering.
                ;; SMAC peeks three disjoint ranges into three MSG structs and
                ;; removes the one with the oldest timestamp. Leaving the tail
                ;; untouched (the caller initializes it to UINT_MAX) makes a
                ;; timer found in the second range lose a three-way tie to the
                ;; empty first struct, so the due timer is never consumed.
                (call $msg_store_input_tail
                  (local.get $msg_ptr)
                  (i32.load (local.get $addr))
                  (i32.const 0x0113)
                  (i32.load (i32.add (local.get $addr) (i32.const 16))))
                (local.set $found (i32.const 1))
                (br $break)
              )
            )
          )
        )
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $loop)
      )
    )
    (call $lock_wnd_release)
    (if (local.get $found) (then (return (i32.const 1))))
    ;; Check multimedia timers (timeSetEvent)
    (local.set $addr (call $mm_timer_due_slot))
    (if (local.get $addr)
      (then
        ;; The MSG carries dwUser itself: a one-shot retires the moment it is
        ;; taken, so DispatchMessage can no longer find its slot by timer id.
        (call $gs32 (local.get $msg_ptr) (i32.load offset=12 (local.get $addr)))          ;; hwnd field = dwUser
        (call $gs32 (i32.add (local.get $msg_ptr) (i32.const 4)) (i32.const 0x7FF0))      ;; internal MM_TIMER
        (call $gs32 (i32.add (local.get $msg_ptr) (i32.const 8)) (i32.load (local.get $addr)))  ;; wParam=timerID
        (call $gs32 (i32.add (local.get $msg_ptr) (i32.const 12))
          (i32.load offset=8 (local.get $addr)))                                          ;; lParam=callback
        (call $msg_store_input_tail
          (local.get $msg_ptr)
          (i32.load offset=12 (local.get $addr))
          (i32.const 0x7FF0)
          (i32.load offset=8 (local.get $addr)))
        ;; Retire the one-shot only when the caller is really taking the
        ;; message; a PM_NOREMOVE peek must still see it next time.
        (if (local.get $consume)
          (then (call $mm_timer_consume_slot (local.get $addr))))
        (return (i32.const 1))))
    (i32.const 0)
  )

  ;; Shared cross-instance posted-message queues, one per owning Win32 thread.
  ;; The former implementation was one unlocked count+array at hard-coded
  ;; 0xB400.  Besides allowing two producers to overwrite the same slot, that
  ;; address is inside WND_DLG_RECORDS.  Posting from a worker could therefore
  ;; corrupt a dialog even when the queue race did not fire.
  (func $thread_msg_queue_addr (param $tid i32) (result i32)
    (if (i32.or (i32.lt_u (local.get $tid) (i32.const 1))
                (i32.gt_u (local.get $tid) (i32.const 8)))
      (then (return (i32.const 0))))
    (i32.add (global.get $THREAD_MSG_QUEUES)
      (i32.mul (i32.sub (local.get $tid) (i32.const 1))
        (global.get $THREAD_MSG_QUEUE_STRIDE))))

  (func $shared_post_queue_enqueue (param $hwnd i32) (param $msg i32) (param $wparam i32) (param $lparam i32) (result i32)
    (local $cnt i32) (local $tail i32) (local $slot i32) (local $queue i32) (local $tid i32)
    (local.set $tid (call $wnd_get_thread (local.get $hwnd)))
    ;; HWND 0 and handles which vanished between routing and enqueue belong to
    ;; the caller's queue.  PostThreadMessage is a separate API.
    (if (i32.eqz (local.get $tid))
      (then (local.set $tid (global.get $current_thread_id))))
    (local.set $queue (call $thread_msg_queue_addr (local.get $tid)))
    (if (i32.eqz (local.get $queue)) (then (return (i32.const 0))))
    (call $lock_wnd_acquire)
    (local.set $cnt (i32.load (local.get $queue)))
    (if (i32.ge_u (local.get $cnt) (global.get $THREAD_MSG_QUEUE_MAX))
      (then
        (call $lock_wnd_release)
        (return (i32.const 0))))
    (local.set $tail (i32.load offset=8 (local.get $queue)))
    (local.set $slot (i32.add (local.get $queue)
      (i32.add (i32.const 0x10) (i32.mul (local.get $tail) (i32.const 16)))))
    (i32.store          (local.get $slot) (local.get $hwnd))
    (i32.store offset=4 (local.get $slot) (local.get $msg))
    (i32.store offset=8 (local.get $slot) (local.get $wparam))
    (i32.store offset=12 (local.get $slot) (local.get $lparam))
    (i32.store offset=8 (local.get $queue)
      (i32.rem_u (i32.add (local.get $tail) (i32.const 1))
        (global.get $THREAD_MSG_QUEUE_MAX)))
    ;; Count is the publication word and is written after the payload.
    (i32.store (local.get $queue) (i32.add (local.get $cnt) (i32.const 1)))
    (call $lock_wnd_release)
    (i32.const 1)
  )

  (func $shared_post_queue_read (param $msg_ptr i32) (param $remove i32) (result i32)
    (local $cnt i32) (local $head i32) (local $slot i32) (local $queue i32)
    (local.set $queue (call $thread_msg_queue_addr (global.get $current_thread_id)))
    (if (i32.eqz (local.get $queue)) (then (return (i32.const 0))))
    ;; Count is the producer's publication word. Avoid taking the process-wide
    ;; window lock for the overwhelmingly common empty poll; a producer racing
    ;; this hint may make this one nonblocking read report empty, then the next
    ;; poll observes it. A nonzero hint still goes through the locked,
    ;; authoritative count below.
    (if (i32.eqz (i32.load (local.get $queue)))
      (then (return (i32.const 0))))
    (call $lock_wnd_acquire)
    (local.set $cnt (i32.load (local.get $queue)))
    (if (i32.eqz (local.get $cnt))
      (then
        (call $lock_wnd_release)
        (return (i32.const 0))))
    (local.set $head (i32.load offset=4 (local.get $queue)))
    (local.set $slot (i32.add (local.get $queue)
      (i32.add (i32.const 0x10) (i32.mul (local.get $head) (i32.const 16)))))
    (call $gs32 (local.get $msg_ptr) (i32.load (local.get $slot)))
    (call $gs32 (i32.add (local.get $msg_ptr) (i32.const 4)) (i32.load offset=4 (local.get $slot)))
    (call $gs32 (i32.add (local.get $msg_ptr) (i32.const 8)) (i32.load offset=8 (local.get $slot)))
    (call $gs32 (i32.add (local.get $msg_ptr) (i32.const 12)) (i32.load offset=12 (local.get $slot)))
    (call $msg_store_input_tail
      (local.get $msg_ptr)
      (i32.load (local.get $slot))
      (i32.load offset=4 (local.get $slot))
      (i32.load offset=12 (local.get $slot)))
    (if (local.get $remove)
      (then
        (i32.store offset=4 (local.get $queue)
          (i32.rem_u (i32.add (local.get $head) (i32.const 1))
            (global.get $THREAD_MSG_QUEUE_MAX)))
        (i32.store (local.get $queue) (i32.sub (local.get $cnt) (i32.const 1)))))
    (call $lock_wnd_release)
    (i32.const 1)
  )

;; ---- PlaySound / sndPlaySound shared core --------------------------------
  ;; sndPlaySoundA, PlaySoundA and PlaySoundW all end up doing one thing: hand
  ;; a complete RIFF/WAVE image to $host_play_sound. They differ only in how
  ;; the caller *names* that image — a file on the VFS, a memory block it owns,
  ;; or a WAVE resource in the module — so each naming form resolves to a
  ;; (wasm address, byte length) pair here and they share one validator, one
  ;; flag decision and one playback call.

  ;; A blob is only worth handing to the host if it opens with the RIFF/WAVE
  ;; container header. Anything shorter than a minimal 44-byte canonical WAV,
  ;; or carrying a different fourcc, is a caller error that has to report FALSE
  ;; — never a silent success that leaves the app waiting for audio.
  (func $sound_wav_is_valid (param $data_wa i32) (param $size i32) (result i32)
    (if (i32.lt_u (local.get $size) (i32.const 44)) (then (return (i32.const 0))))
    ;; "RIFF" at +0 and "WAVE" at +8
    (if (i32.ne (i32.load (local.get $data_wa)) (i32.const 0x46464952))
      (then (return (i32.const 0))))
    (if (i32.ne (i32.load (i32.add (local.get $data_wa) (i32.const 8))) (i32.const 0x45564157))
      (then (return (i32.const 0))))
    (i32.const 1))

  ;; One place hands a validated WAV image to the host, so one place owns the
  ;; handle that comes back. The host plays it on a voice it keeps; remembering
  ;; that voice is what makes the *next* PlaySound, SND_PURGE and
  ;; PlaySound(NULL) able to stop this one instead of merely claiming to.
  ;; A host with no audio output returns 0 — that is "nothing to stop later",
  ;; not a failure of the call, so the caller still gets TRUE.
  (func $sound_start (param $data_wa i32) (param $size i32) (param $loop i32)
        (result i32)
    (call $sound_stop_current)
    (global.set $sound_voice
      (call $host_play_sound (local.get $data_wa) (local.get $size)
        (i32.ne (local.get $loop) (i32.const 0))))
    (i32.const 1))

  ;; Stop and release whatever this process last started through PlaySound.
  ;; voice_close is stop-and-free: the voice is a one-shot nobody will ask
  ;; about again, and leaving the slot behind leaks one per sound played.
  (func $sound_stop_current
    (if (global.get $sound_voice)
      (then
        (drop (call $host_voice_close (global.get $sound_voice)))
        (global.set $sound_voice (i32.const 0)))))

  ;; SND_MEMORY: pszSound points at a complete WAV image the caller owns. The
  ;; API carries no length, so the RIFF chunk size at +4 (plus the 8-byte RIFF
  ;; header it excludes) is the only length there is.
  (func $sound_play_memory (param $img_guest i32) (param $loop i32) (result i32)
    (local $data_wa i32) (local $size i32)
    (if (i32.eqz (local.get $img_guest)) (then (return (i32.const 0))))
    (local.set $data_wa (call $g2w (local.get $img_guest)))
    (local.set $size (i32.add
      (i32.load (i32.add (local.get $data_wa) (i32.const 4))) (i32.const 8)))
    (if (i32.eqz (call $sound_wav_is_valid (local.get $data_wa) (local.get $size)))
      (then (return (i32.const 0))))
    (call $sound_start (local.get $data_wa) (local.get $size) (local.get $loop)))

  ;; SND_FILENAME (and the no-flag default): pszSound is a path. Read it
  ;; through the same VFS bridge every other file API uses, into a temporary
  ;; heap block whose first dword doubles as fs_read_file's bytes-read out
  ;; parameter. $host_play_sound copies the bytes out synchronously, so the
  ;; block is freed as soon as it returns. A path that does not resolve returns
  ;; FALSE, which is exactly what Win98 reports for a missing sound file.
  (func $sound_play_file (param $path_guest i32) (param $wide i32) (param $loop i32)
        (result i32)
    (local $handle i32) (local $size i32) (local $blk i32)
    (local $data_guest i32) (local $data_wa i32) (local $ok i32)
    (if (i32.eqz (local.get $path_guest)) (then (return (i32.const 0))))
    (local.set $handle (call $host_fs_create_file
      (call $g2w (local.get $path_guest))
      (i32.const 0x80000000)   ;; GENERIC_READ
      (i32.const 3)            ;; OPEN_EXISTING
      (i32.const 0x80)         ;; FILE_ATTRIBUTE_NORMAL
      (local.get $wide)))
    (if (i32.eq (local.get $handle) (i32.const -1)) (then (return (i32.const 0))))
    (local.set $size (call $host_fs_get_file_size (local.get $handle)))
    ;; 16 MB is far past any Win98-era effect or jingle; refuse rather than
    ;; hand the heap an attacker-sized allocation from a guest string.
    (if (i32.or (i32.lt_s (local.get $size) (i32.const 44))
                (i32.gt_u (local.get $size) (i32.const 0x01000000)))
      (then
        (drop (call $host_fs_close_handle (local.get $handle)))
        (return (i32.const 0))))
    (local.set $blk (call $heap_alloc (i32.add (local.get $size) (i32.const 4))))
    (if (i32.eqz (local.get $blk))
      (then
        (drop (call $host_fs_close_handle (local.get $handle)))
        (return (i32.const 0))))
    (local.set $data_guest (i32.add (local.get $blk) (i32.const 4)))
    (i32.store (call $g2w (local.get $blk)) (i32.const 0))
    (local.set $ok (call $host_fs_read_file (local.get $handle)
      (local.get $data_guest) (local.get $size) (local.get $blk)))
    (drop (call $host_fs_close_handle (local.get $handle)))
    (if (i32.or (i32.eqz (local.get $ok))
                (i32.ne (i32.load (call $g2w (local.get $blk))) (local.get $size)))
      (then
        (call $heap_free (local.get $blk))
        (return (i32.const 0))))
    (local.set $data_wa (call $g2w (local.get $data_guest)))
    (if (i32.eqz (call $sound_wav_is_valid (local.get $data_wa) (local.get $size)))
      (then
        (call $heap_free (local.get $blk))
        (return (i32.const 0))))
    (drop (call $sound_start (local.get $data_wa) (local.get $size) (local.get $loop)))
    (call $heap_free (local.get $blk))
    (i32.const 1))

  ;; SND_RESOURCE: pszSound is MAKEINTRESOURCE(id) naming a WAVE resource in
  ;; the module's own resource directory.
  (func $sound_play_resource (param $name_id i32) (param $loop i32) (result i32)
    (local $hrsrc i32) (local $entry_wa i32) (local $rva i32) (local $size i32)
    (local $data_wa i32)
    (if (i32.eqz (global.get $rsrc_rva)) (then (return (i32.const 0))))
    (local.set $hrsrc (call $find_resource_named_type (local.get $name_id)))
    (if (i32.eqz (local.get $hrsrc)) (then (return (i32.const 0))))
    (local.set $entry_wa (call $g2w (i32.add (global.get $image_base) (local.get $hrsrc))))
    (local.set $rva (i32.load (local.get $entry_wa)))
    (local.set $size (i32.load (i32.add (local.get $entry_wa) (i32.const 4))))
    (if (i32.eqz (local.get $size)) (then (return (i32.const 0))))
    (local.set $data_wa (call $g2w (i32.add (global.get $image_base) (local.get $rva))))
    (call $sound_start (local.get $data_wa) (local.get $size) (local.get $loop)))

  ;; fdwSound decides which naming form applies, and the order of the tests is
  ;; load-bearing: SND_RESOURCE is 0x00040004, i.e. it *contains* SND_MEMORY,
  ;; so the resource test has to run first or every resource id gets
  ;; dereferenced as a pointer to a WAV image.
  ;;
  ;; The flags that do not pick a form:
  ;;   SND_SYNC (0) / SND_ASYNC (0x1) — the host voice plays on its own clock,
  ;;     so both play and return immediately. A synchronous caller therefore
  ;;     resumes early rather than blocking the whole emulator inside an API
  ;;     call.
  ;;   SND_LOOP (0x8) — passed to the host voice, which repeats the image until
  ;;     the next stop.
  ;;   SND_NODEFAULT (0x2), SND_NOWAIT (0x2000) — we never substitute a default
  ;;     sound and never block, so both are already satisfied by construction.
  (func $sound_play_dispatch (param $name_id i32) (param $flags i32) (param $wide i32)
        (result i32)
    (local $loop i32)
    (local.set $loop (i32.and (local.get $flags) (i32.const 0x8)))
    ;; NULL name, or SND_PURGE (0x40): "stop whatever this process started
    ;; through PlaySound". The host hands back a voice for every sound started
    ;; here, so this is a real stop now, not a claim that one happened.
    (if (i32.or (i32.eqz (local.get $name_id))
                (i32.ne (i32.and (local.get $flags) (i32.const 0x40)) (i32.const 0)))
      (then
        (call $sound_stop_current)
        (return (i32.const 1))))
    ;; SND_NOSTOP (0x10): the caller would rather have nothing than interrupt.
    ;; Windows returns FALSE immediately when the sound device is busy with a
    ;; sound this process already started, and plays nothing. Everything below
    ;; goes through $sound_start, which stops the previous voice first — that
    ;; is PlaySound's default "one sound at a time per process" behaviour.
    (if (i32.and (i32.ne (i32.and (local.get $flags) (i32.const 0x10)) (i32.const 0))
                 (i32.ne (global.get $sound_voice) (i32.const 0)))
      (then
        (if (call $host_voice_is_playing (global.get $sound_voice))
          (then (return (i32.const 0))))))
    (if (i32.ne (i32.and (local.get $flags) (i32.const 0x40000)) (i32.const 0))
      (then (return (call $sound_play_resource (local.get $name_id) (local.get $loop)))))
    (if (i32.ne (i32.and (local.get $flags) (i32.const 0x4)) (i32.const 0))
      (then (return (call $sound_play_memory (local.get $name_id) (local.get $loop)))))
    ;; SND_ALIAS (0x10000) / SND_ALIAS_ID (0x110000) name an entry in the
    ;; registry's AppEvents sound scheme. This machine ships no scheme, so
    ;; every alias resolves to "no sound is assigned" — which Win98 reports as
    ;; FALSE. Say so instead of claiming a sound was played.
    (if (i32.ne (i32.and (local.get $flags) (i32.const 0x10000)) (i32.const 0))
      (then
        (call $host_log_i32 (i32.const 0x50534E41))  ;; 'PSNA': alias, no scheme installed
        (call $host_log_i32 (local.get $name_id))
        (return (i32.const 0))))
    ;; Everything left names a file: SND_FILENAME (0x20000) says so outright,
    ;; and a bare fdwSound of 0 / SND_SYNC / SND_ASYNC means a filename too —
    ;; that is sndPlaySound's default and PlaySound's documented fallback.
    (call $sound_play_file (local.get $name_id) (local.get $wide) (local.get $loop)))

  ;; 65: sndPlaySoundA(pszSound, fuSound) — legacy 2-arg sound API. Same
  ;; naming forms as PlaySound minus the module handle, so it shares the core.
  (func $handle_sndPlaySoundA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $sound_play_dispatch
      (local.get $arg0) (local.get $arg1) (i32.const 0)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12)))
  )

  ;; 863: PlaySoundW(pszSound, hmod, fdwSound) — 3 args stdcall. hmod only
  ;; matters for SND_RESOURCE out of a loaded DLL; we resolve WAVE resources
  ;; from the running image, so it is not consulted. The one A/W difference
  ;; that reaches the core is how the filename form spells its path.
  (func $handle_PlaySoundW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $sound_play_dispatch
      (local.get $arg0) (local.get $arg2) (i32.const 1)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 16)))
  )

  ;; PlaySoundA(pszSound, hmod, fdwSound) — 3 args stdcall, ANSI path form.
  (func $handle_PlaySoundA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $sound_play_dispatch
      (local.get $arg0) (local.get $arg2) (i32.const 0)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 16)))
  )

  ;; RegisterWindowMessage is an *interning* call: registering the same name
  ;; twice must give the same number back, which is how two components (or two
  ;; spellings of one API) agree on what "commdlg_FindReplace" means. On
  ;; Windows the number comes from the global atom table, shared with
  ;; RegisterClipboardFormat, so intern through the same table $clipfmt_intern
  ;; owns. Both spellings land here; the W one only narrows on the way in.
  (func $register_window_message (param $name_g i32) (result i32)
    (local $id i32) (local $name_wa i32)
    (local.set $id (call $clipfmt_intern (local.get $name_g))) (local.set $name_wa (call $g2w (local.get $name_g)))
    ;; FNV-1a("commdlg_FindReplace") = 0x1A9C8FD4. Common-dialog clients
    ;; register FINDMSGSTRING and later compare a delivered message against the
    ;; value they got, so the find/replace dialog has to send that same one.
    (if (i32.and
          (i32.ne (local.get $id) (i32.const 0))
          (i32.eq (call $hash_api_name (local.get $name_wa))
                  (i32.const 0x1A9C8FD4)))
      (then (global.set $findreplace_message (local.get $id))))
    ;; FNV-1a("SHELLHOOK") = 0x684BA376. RegisterShellHook has no message-id
    ;; argument, so retain the exact interned value while the name is still
    ;; available instead of trying to reconstruct it from a counter later.
    (if (i32.and
          (i32.ne (local.get $id) (i32.const 0))
          (i32.eq (call $hash_api_name (local.get $name_wa))
                  (i32.const 0x684BA376)))
      (then (global.set $shell_hook_message (local.get $id))))
    (local.get $id))

  ;; 66: RegisterWindowMessageA(lpString) — return unique msg ID from 0xC000+ range
  (func $handle_RegisterWindowMessageA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $register_window_message (local.get $arg0)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8)))
  )

  ;; Retire or promote the process-wide main window before its table record is
  ;; removed. Kept separate so lifecycle tests can exercise this decision
  ;; without invoking the host-facing recursive destruction path.
  (func $destroy_main_window_lifecycle (param $hwnd i32)
    (if (i32.eq (local.get $hwnd) (global.get $main_hwnd))
      (then
        (if (i32.and
              (i32.ne (call $wnd_table_get (i32.add (global.get $main_hwnd) (i32.const 1))) (i32.const 0))
              (i32.ne (call $wnd_get_parent (i32.add (global.get $main_hwnd) (i32.const 1)))
                      (global.get $main_hwnd)))
          (then (global.set $main_hwnd (i32.add (global.get $main_hwnd) (i32.const 1))))
          (else
            (if (call $wnd_is_effectively_visible (local.get $hwnd))
              (then (global.set $quit_flag (i32.const 1))))
            ;; The slot is removed next. Leave no stale main handle behind so
            ;; a replacement top-level created during an SDL video-mode reset
            ;; becomes the new input/paint target.
            (global.set $main_hwnd (i32.const 0)))))))

  ;; 83: DestroyWindow
  (func $handle_DestroyWindow (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $focus_lost i32) (local $focus_parent i32) (local $focus_guard i32)
    (local $wndproc i32) (local $ret_addr i32)
    ;; Recursive destruction also removes every child. If any of them held
    ;; focus, that focus is lost just as surely as when the root itself held
    ;; it. Tetris closes an About dialog whose OK child has focus; retaining
    ;; that dead child made every subsequent arrow key disappear.
    (if (global.get $focus_hwnd)
      (then
        (if (i32.eq (local.get $arg0) (global.get $focus_hwnd))
          (then (local.set $focus_lost (i32.const 1)))
          (else
            (local.set $focus_parent (call $wnd_get_parent (global.get $focus_hwnd)))
            (block $focus_done (loop $focus_ancestors
              (br_if $focus_done (i32.eqz (local.get $focus_parent)))
              (if (i32.eq (local.get $focus_parent) (local.get $arg0))
                (then
                  (local.set $focus_lost (i32.const 1))
                  (br $focus_done)))
              (local.set $focus_guard (i32.add (local.get $focus_guard) (i32.const 1)))
              (br_if $focus_done (i32.ge_u (local.get $focus_guard) (global.get $MAX_WINDOWS)))
              (local.set $focus_parent (call $wnd_get_parent (local.get $focus_parent)))
              (br $focus_ancestors)))))))
    ;; After main_hwnd promotion below, transfer focus to the (possibly new)
    ;; main window rather than leaving a handle that recursive destruction
    ;; just removed from the table.
    (if (local.get $focus_lost)
      (then (global.set $focus_hwnd (i32.const 0))))
    ;; When destroying main_hwnd, promote to next window only if it's a sibling
    ;; top-level window — NOT a child of the destroyed window.  A hidden first
    ;; window may only be a startup/helper HWND: Pinball destroys its invisible
    ;; splash before creating the visible table window.  Do not leave a stale
    ;; WM_QUIT behind in that case; a later GetMessage path (Options > Music)
    ;; would consume it and terminate an otherwise healthy app.
    (call $destroy_main_window_lifecycle (local.get $arg0))
    ;; Give the parent back the area this window covered, before the record
    ;; that says who the parent is goes away.
    (call $wnd_uncover_parent (local.get $arg0))
    ;; Recursively destroy window and all its children (frees table slots)
    (call $wnd_destroy_recursive (local.get $arg0))
    ;; Transfer focus to main_hwnd: deliver WM_SETFOCUS synchronously via EIP redirect.
    ;; On real Windows, destroying the focused window gives focus to the next foreground window.
    ;; Only if main_hwnd is valid and different from the destroyed window (may have been promoted).
    (if (i32.and (i32.ne (local.get $focus_lost) (i32.const 0))
                 (i32.and (i32.ne (global.get $main_hwnd) (i32.const 0))
                          (i32.ne (global.get $main_hwnd) (local.get $arg0))))
      (then
        (local.set $wndproc (call $wnd_table_get (global.get $main_hwnd)))
        (if (i32.eqz (local.get $wndproc))
          (then (local.set $wndproc (global.get $wndproc_addr))))
        ;; A Win16 WndProc is a packed selector:offset, not a linear EIP. This
        ;; handler can run below the Win16 call32 bridge (USER.53), so let the
        ;; task's ordinary queue dispatcher resolve that far procedure after
        ;; the bridge has restored its real stack. Tic Tac Drop destroys its
        ;; splash this way while promoting the playable VB form.
        (if (global.get $win16_in_call32)
          (then
            (global.set $focus_hwnd (global.get $main_hwnd))
            (drop (call $post_queue_push (global.get $main_hwnd)
              (i32.const 0x0007) (i32.const 0) (i32.const 0))))
          (else
        (if (i32.and (i32.ne (local.get $wndproc) (i32.const 0))
                     (i32.lt_u (local.get $wndproc) (i32.const 0xFFFF0000)))
          (then
            (global.set $focus_hwnd (global.get $main_hwnd))
            (local.set $ret_addr (call $gl32 (global.get $esp)))
            ;; DestroyWindow stdcall(1): [ret, hwnd] = 8 bytes. The focus
            ;; wndproc must return through CACA002A before the API caller:
            ;; otherwise its LRESULT (commonly zero) becomes DestroyWindow's
            ;; BOOL. Use the same saved-return frame as SetFocus, but retain
            ;; TRUE as this API's result.
            (global.set $esp (i32.sub (global.get $esp) (i32.const 40)))
            (call $gs32 (global.get $esp) (global.get $setfocus_ret_thunk))
            (call $gs32 (i32.add (global.get $esp) (i32.const 4)) (global.get $main_hwnd))
            (call $gs32 (i32.add (global.get $esp) (i32.const 8)) (i32.const 0x0007))  ;; WM_SETFOCUS
            (call $gs32 (i32.add (global.get $esp) (i32.const 12)) (i32.const 0))      ;; wParam = 0
            (call $gs32 (i32.add (global.get $esp) (i32.const 16)) (i32.const 0))      ;; lParam = 0
            (call $gs32 (i32.add (global.get $esp) (i32.const 20)) (local.get $ret_addr))
            (call $gs32 (i32.add (global.get $esp) (i32.const 24)) (i32.const 1))
            (call $gs32 (i32.add (global.get $esp) (i32.const 28)) (global.get $ebx))
            (call $gs32 (i32.add (global.get $esp) (i32.const 32)) (global.get $esi))
            (call $gs32 (i32.add (global.get $esp) (i32.const 36)) (global.get $edi))
            (call $gs32 (i32.add (global.get $esp) (i32.const 40)) (global.get $ebp))
            (global.set $eip (local.get $wndproc))
            (global.set $steps (i32.const 0))
            (return)))))))
    (global.set $eax (i32.const 1))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8))) (return)
  )

(func $compat_is_pinball_exe (result i32)
    (if (i32.ne (global.get $exe_name_len) (i32.const 11))
      (then (return (i32.const 0))))
    (if (i32.ne (i32.load (global.get $exe_name_wa)) (i32.const 0x626E6970))
      (then (return (i32.const 0)))) ;; pinb
    (if (i32.ne (i32.load offset=4 (global.get $exe_name_wa)) (i32.const 0x2E6C6C61))
      (then (return (i32.const 0)))) ;; all.
    (if (i32.ne (i32.load offset=8 (global.get $exe_name_wa)) (i32.const 0x00657865))
      (then (return (i32.const 0)))) ;; exe\0
    (i32.const 1))

  ;; 85: GetDC — Phase B: alloc DcRecord via host_alloc_window_dc
  ;; (whole=0). GetDC(NULL) and GetDC(GetDesktopWindow()) → screen DC.
  (func $handle_GetDC (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $hdc i32) (local $target_hwnd i32)
    ;; Pinball uses its desktop handle as a window-clipped primary surface.
    ;; Giving it the canonical desktop bitmap draws the table behind
    ;; an opaque gray main window. Keep native desktop-DC behavior for other
    ;; apps (notably MFC WinHelp), but bind this request to Pinball's actual
    ;; compositor window.
    (if (i32.and
          (i32.eq (local.get $arg0) (i32.const 0x10000))
          (i32.and
            (call $compat_is_pinball_exe)
            (i32.ne (global.get $main_hwnd) (i32.const 0))))
      (then (local.set $target_hwnd (global.get $main_hwnd)))
      (else
        (if (i32.ne (local.get $arg0) (i32.const 0x10000))
          (then (local.set $target_hwnd (local.get $arg0))))))
    (if (local.get $target_hwnd)
      (then
        (local.set $hdc (call $host_alloc_window_dc (local.get $target_hwnd) (i32.const 0)))
        (call $dc_apply_client_clip (local.get $hdc) (local.get $target_hwnd)))
      (else
        (local.set $hdc (call $host_alloc_screen_dc))))
    (global.set $eax (local.get $hdc))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8))) (return)
  )

  ;; The SM_* table, with no calling convention attached. GetSystemMetrics is
  ;; the same question in Win32 and in Win16 — USER.179 takes the same indices
  ;; and means the same things — so the answers live here and both dispatchers
  ;; call in. An index with no entry is 0, which is what Windows returns for a
  ;; metric it does not define.
  ;; A DirectDraw SetDisplayMode replaces the screen metrics for as long as the
  ;; mode is in effect — it switches the whole display, so on Windows
  ;; SM_CXSCREEN/SM_CYSCREEN report the mode, not the desktop the app was
  ;; launched from, until RestoreDisplayMode. Caesar III depends on it
  ;; — in fullscreen it takes SetRect(0, 0, SM_CXSCREEN, SM_CYSCREEN) as its
  ;; client size and scales the cursor from there down to its 800x600 logical
  ;; screen, so reporting the host canvas (1280 wide in the browser) put every
  ;; click at ~62% of the position the player aimed at, and nothing in the main
  ;; menu ever highlighted or responded.
  (func $screen_metric_w (result i32)
    (if (call $dx_display_mode_get)
      (then (return (call $dx_display_w_get))))
    (i32.and (call $host_get_screen_size) (i32.const 0xFFFF)))

  (func $screen_metric_h (result i32)
    (if (call $dx_display_mode_get)
      (then (return (call $dx_display_h_get))))
    (i32.shr_u (call $host_get_screen_size) (i32.const 16)))

  ;; Bottom edge of the browser desktop's usable area. Keep the classic
  ;; taskbar reservation in one place so SPI_GETWORKAREA, GetMonitorInfo and
  ;; SHAppBarMessage cannot describe three different desktops.
  (func $screen_work_bottom (result i32)
    (local $height i32)
    (local.set $height (call $screen_metric_h))
    (select (i32.sub (local.get $height) (i32.const 28)) (i32.const 0)
      (i32.gt_u (local.get $height) (i32.const 28))))

  (func $system_metric (param $index i32) (result i32)
    (if (i32.eq (local.get $index) (i32.const 0))  ;; SM_CXSCREEN
      (then (return (call $screen_metric_w))))
    (if (i32.eq (local.get $index) (i32.const 1))  ;; SM_CYSCREEN
      (then (return (call $screen_metric_h))))
    (if (i32.eq (local.get $index) (i32.const 2))  ;; SM_CXVSCROLL
      (then (return (i32.const 16))))
    (if (i32.eq (local.get $index) (i32.const 3))  ;; SM_CYHSCROLL
      (then (return (i32.const 16))))
    (if (i32.eq (local.get $index) (i32.const 4))  ;; SM_CYCAPTION
      (then (return (i32.const 19))))
    (if (i32.eq (local.get $index) (i32.const 5))  ;; SM_CXBORDER
      (then (return (i32.const 1))))
    (if (i32.eq (local.get $index) (i32.const 6))  ;; SM_CYBORDER
      (then (return (i32.const 1))))
    (if (i32.eq (local.get $index) (i32.const 7))  ;; SM_CXFIXEDFRAME
      (then (return (i32.const 3))))
    (if (i32.eq (local.get $index) (i32.const 8))  ;; SM_CYFIXEDFRAME
      (then (return (i32.const 3))))
    (if (i32.eq (local.get $index) (i32.const 9))  ;; SM_CYVTHUMB
      (then (return (i32.const 16))))
    (if (i32.eq (local.get $index) (i32.const 10)) ;; SM_CXHTHUMB
      (then (return (i32.const 16))))
    (if (i32.eq (local.get $index) (i32.const 11)) ;; SM_CXICON
      (then (return (i32.const 32))))
    (if (i32.eq (local.get $index) (i32.const 12)) ;; SM_CYICON
      (then (return (i32.const 32))))
    (if (i32.eq (local.get $index) (i32.const 13)) ;; SM_CXCURSOR
      (then (return (i32.const 32))))
    (if (i32.eq (local.get $index) (i32.const 14)) ;; SM_CYCURSOR
      (then (return (i32.const 32))))
    (if (i32.eq (local.get $index) (i32.const 15)) ;; SM_CYMENU
      (then (return (i32.const 19))))
    (if (i32.eq (local.get $index) (i32.const 16)) ;; SM_CXFULLSCREEN
      (then (return (call $screen_metric_w))))
    ;; The 46 rows are caption + frame, which a mode-switched fullscreen app
    ;; does not have: there the full-screen client area is the whole mode.
    (if (i32.eq (local.get $index) (i32.const 17)) ;; SM_CYFULLSCREEN
      (then
        (if (call $dx_display_mode_get)
          (then (return (call $dx_display_h_get))))
        (return (i32.sub (i32.shr_u (call $host_get_screen_size) (i32.const 16))
                         (i32.const 46)))))
    (if (i32.eq (local.get $index) (i32.const 19)) ;; SM_MOUSEPRESENT
      (then (return (i32.const 1))))
    (if (i32.eq (local.get $index) (i32.const 20)) ;; SM_CYVSCROLL
      (then (return (i32.const 16))))
    (if (i32.eq (local.get $index) (i32.const 21)) ;; SM_CXHSCROLL
      (then (return (i32.const 16))))
    (if (i32.eq (local.get $index) (i32.const 28)) ;; SM_CXMIN
      (then (return (i32.const 112))))
    (if (i32.eq (local.get $index) (i32.const 29)) ;; SM_CYMIN
      (then (return (i32.const 27))))
    (if (i32.eq (local.get $index) (i32.const 30)) ;; SM_CXSIZE
      (then (return (i32.const 18))))
    (if (i32.eq (local.get $index) (i32.const 31)) ;; SM_CYSIZE
      (then (return (i32.const 18))))
    (if (i32.eq (local.get $index) (i32.const 32)) ;; SM_CXFRAME
      (then (return (i32.const 4))))
    (if (i32.eq (local.get $index) (i32.const 33)) ;; SM_CYFRAME
      (then (return (i32.const 4))))
    (if (i32.eq (local.get $index) (i32.const 34)) ;; SM_CXMINTRACK
      (then (return (i32.const 112))))
    (if (i32.eq (local.get $index) (i32.const 35)) ;; SM_CYMINTRACK
      (then (return (i32.const 27))))
    (if (i32.eq (local.get $index) (i32.const 36)) ;; SM_CXDOUBLECLK
      (then (return (i32.const 4))))
    (if (i32.eq (local.get $index) (i32.const 37)) ;; SM_CYDOUBLECLK
      (then (return (i32.const 4))))
    (if (i32.eq (local.get $index) (i32.const 38)) ;; SM_CXICONSPACING
      (then (return (i32.const 75))))
    (if (i32.eq (local.get $index) (i32.const 39)) ;; SM_CYICONSPACING
      (then (return (i32.const 75))))
    (if (i32.eq (local.get $index) (i32.const 43)) ;; SM_CMOUSEBUTTONS
      (then (return (i32.const 3))))
    (if (i32.eq (local.get $index) (i32.const 45)) ;; SM_CXEDGE
      (then (return (i32.const 2))))
    (if (i32.eq (local.get $index) (i32.const 46)) ;; SM_CYEDGE
      (then (return (i32.const 2))))
    ;; Native Win98 COMCTL32 uses the small-icon metrics to size image lists.
    ;; Returning zero makes ImageList_Create fail before controls can populate.
    (if (i32.eq (local.get $index) (i32.const 49)) ;; SM_CXSMICON
      (then (return (i32.const 16))))
    (if (i32.eq (local.get $index) (i32.const 50)) ;; SM_CYSMICON
      (then (return (i32.const 16))))
    (if (i32.eq (local.get $index) (i32.const 0x3D)) ;; SM_CXMAXIMIZED
      (then (return (i32.add (call $screen_metric_w) (i32.const 8)))))
    (if (i32.eq (local.get $index) (i32.const 0x3E)) ;; SM_CYMAXIMIZED
      (then (return (i32.add (call $screen_metric_h) (i32.const 8)))))
    (i32.const 0))

  ;; 90: GetSystemMetrics (actual slot used by imports)
  (func $handle_GetSystemMetrics (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $system_metric (local.get $arg0)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8)))
  )

  ;; ConvertToGlobalHandle promotes a process-local kernel handle so it can be
  ;; inherited by another process. This emulator has one process and stable
  ;; handle identities, therefore the promoted handle is the same handle.
  (func $handle_ConvertToGlobalHandle (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (local.get $arg0))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8)))
  )

  ;; 1099: EnumDisplayMonitors(hdc, lprcClip, lpfnEnum, dwData) — 4 args stdcall
  ;; Calls lpfnEnum(hMonitor, hdcMonitor, lprcMonitor, dwData) once for primary monitor
  (func $handle_EnumDisplayMonitors (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $ret_addr i32) (local $callback i32) (local $data i32) (local $rect_guest i32) (local $screen i32)
    ;; arg2 = lpfnEnum (callback), arg3 = dwData
    (local.set $callback (local.get $arg2))
    (local.set $data (local.get $arg3))
    ;; If no callback, just return TRUE
    (if (i32.eqz (local.get $callback))
      (then
        (global.set $eax (i32.const 1))
        (global.set $esp (i32.add (global.get $esp) (i32.const 20)))
        (return)))
    ;; Save original return address
    (local.set $ret_addr (call $gl32 (global.get $esp)))
    ;; Pop EnumDisplayMonitors frame: ret + 4 args = 20 bytes
    (global.set $esp (i32.add (global.get $esp) (i32.const 20)))
    ;; Allocate RECT {0, 0, screenW, screenH} on stack (16 bytes)
    (global.set $esp (i32.sub (global.get $esp) (i32.const 16)))
    (local.set $rect_guest (i32.add (i32.sub (global.get $esp) (i32.const 0x12000)) (global.get $image_base)))
    (local.set $screen (call $host_get_screen_size))
    (call $gs32 (global.get $esp) (i32.const 0))         ;; left
    (call $gs32 (i32.add (global.get $esp) (i32.const 4)) (i32.const 0))   ;; top
    (call $gs32 (i32.add (global.get $esp) (i32.const 8)) (i32.and (local.get $screen) (i32.const 0xFFFF))) ;; right
    (call $gs32 (i32.add (global.get $esp) (i32.const 12)) (i32.shr_u (local.get $screen) (i32.const 16))) ;; bottom
    ;; Push callback args right-to-left: dwData, lprcMonitor, hdcMonitor, hMonitor
    (global.set $esp (i32.sub (global.get $esp) (i32.const 4)))
    (call $gs32 (global.get $esp) (local.get $data))          ;; dwData
    (global.set $esp (i32.sub (global.get $esp) (i32.const 4)))
    (call $gs32 (global.get $esp) (local.get $rect_guest))    ;; lprcMonitor (guest addr)
    (global.set $esp (i32.sub (global.get $esp) (i32.const 4)))
    (call $gs32 (global.get $esp) (i32.const 0))              ;; hdcMonitor = NULL
    (global.set $esp (i32.sub (global.get $esp) (i32.const 4)))
    (call $gs32 (global.get $esp) (i32.const 0x00010001))     ;; hMonitor (fake handle)
    ;; Push return address — callback is stdcall so it pops its own 16 bytes
    ;; After callback returns, RECT (16 bytes on stack) remains — but caller's ESP is restored
    ;; Actually the RECT sits below the callback frame, need to adjust:
    ;; When callback returns (stdcall pops 16 bytes), ESP points to RECT.
    ;; We need the original ret_addr AFTER the RECT is cleaned up.
    ;; Solution: put a thunk return address that cleans up the RECT and returns.
    ;; Simpler: just put the RECT in scratch memory instead of on the stack.
    ;; Let's use WASM address 0xAD00 area which is below GUEST_BASE.
    ;; Actually — store RECT at a fixed known location in the sub-GUEST_BASE region.
    ;; Reset: undo stack RECT, use fixed scratch instead.
    (global.set $esp (i32.add (global.get $esp) (i32.const 32))) ;; undo the 4 pushes + RECT
    ;; Write RECT at WASM addr 0xAD40 (unused scratch below GUEST_BASE)
    (i32.store (i32.const 0xAD40) (i32.const 0))       ;; left
    (i32.store (i32.const 0xAD44) (i32.const 0))       ;; top
    (i32.store (i32.const 0xAD48) (i32.const 640))     ;; right
    (i32.store (i32.const 0xAD4C) (i32.const 480))     ;; bottom
    ;; Guest address for 0xAD40: image_base + (0xAD40 - 0x12000) = image_base - 0x72C0
    ;; Actually RECT needs to be at a guest-addressable address. g2w = guest - image_base + GUEST_BASE
    ;; So guest = wasm - GUEST_BASE + image_base = 0xAD40 - 0x12000 + image_base
    ;; If image_base=0x400000 -> guest = 0x3F8D40, which is below image_base but above 0.
    ;; The callback reads RECT via the pointer — so it will do g2w(guest) and get 0xAD40. Should work.
    (local.set $rect_guest (i32.add (i32.sub (i32.const 0xAD40) (i32.const 0x12000)) (global.get $image_base)))
    ;; Push callback args right-to-left
    (global.set $esp (i32.sub (global.get $esp) (i32.const 4)))
    (call $gs32 (global.get $esp) (local.get $data))          ;; dwData
    (global.set $esp (i32.sub (global.get $esp) (i32.const 4)))
    (call $gs32 (global.get $esp) (local.get $rect_guest))    ;; lprcMonitor
    (global.set $esp (i32.sub (global.get $esp) (i32.const 4)))
    (call $gs32 (global.get $esp) (i32.const 0))              ;; hdcMonitor
    (global.set $esp (i32.sub (global.get $esp) (i32.const 4)))
    (call $gs32 (global.get $esp) (i32.const 0x00010001))     ;; hMonitor
    ;; Push return address — when stdcall callback pops 16 bytes and rets, goes to ret_addr
    (global.set $esp (i32.sub (global.get $esp) (i32.const 4)))
    (call $gs32 (global.get $esp) (local.get $ret_addr))
    ;; Jump to callback
    (global.set $eip (local.get $callback))
    (global.set $steps (i32.const 0))
  )

  ;; 91: GetClientRect
  (func $handle_GetClientRect (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $cs i32)
    (local.set $cs (call $wnd_get_client_size_packed (local.get $arg0)))
    (call $gs32 (local.get $arg1) (i32.const 0))       ;; left
    (call $gs32 (i32.add (local.get $arg1) (i32.const 4)) (i32.const 0))   ;; top
    (call $gs32 (i32.add (local.get $arg1) (i32.const 8))
      (i32.and (local.get $cs) (i32.const 0xFFFF)))     ;; right = clientW
    (call $gs32 (i32.add (local.get $arg1) (i32.const 12))
      (i32.shr_u (local.get $cs) (i32.const 16)))       ;; bottom = clientH
    (global.set $eax (i32.const 1))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12))) (return)
  )

  ;; 92: GetWindowTextA(hwnd, lpString, nMaxCount) → int
  ;; A window's title as ANSI, into the guest buffer $buf ($max bytes), with
  ;; the character count as the result. There are three places a title can
  ;; live and both spellings of GetWindowText have to look in all of them, so
  ;; the search lives here and GetWindowTextW widens what it finds.
  (func $window_text_ansi (param $hwnd i32) (param $buf i32) (param $max i32) (result i32)
    (local $src i32) (local $len i32) (local $copy_len i32) (local $buf_wa i32)
    ;; Child controls own their text in their WAT-side wndproc state. Route
    ;; the read through WM_GETTEXT so edit/button/static text stays consistent
    ;; with GetDlgItemTextA and SetWindowTextA.
    (if (call $ctrl_table_get_class (local.get $hwnd))
      (then
        (return (call $control_wndproc_dispatch
          (local.get $hwnd) (i32.const 0x000D)
          (local.get $max) (local.get $buf)))))
    ;; Registered custom controls created from dialog resources live in the
    ;; WAT window table but may have no renderer-side child mirror. Their
    ;; wndprocs still expect USER's normal window-text storage to work.
    (local.set $src (call $title_table_get_ptr (local.get $hwnd)))
    (if (local.get $src)
      (then
        (if (i32.le_s (local.get $max) (i32.const 0))
          (then (return (i32.const 0))))
        (local.set $len (call $title_table_get_len (local.get $hwnd)))
        (local.set $copy_len (local.get $len))
        (if (i32.ge_u (local.get $copy_len) (local.get $max))
          (then (local.set $copy_len (i32.sub (local.get $max) (i32.const 1)))))
        (local.set $buf_wa (call $g2w (local.get $buf))) (call $memcpy (local.get $buf_wa) (local.get $src) (local.get $copy_len))
        (i32.store8 (i32.add (local.get $buf_wa) (local.get $copy_len)) (i32.const 0))
        (return (local.get $copy_len))))
    (call $host_get_window_text
      (local.get $hwnd) (call $g2w (local.get $buf)) (local.get $max)))

  (func $handle_GetWindowTextA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $window_text_ansi
      (local.get $arg0) (local.get $arg1) (local.get $arg2)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 16)))
  )

  ;; Return the canonical Win32 name for a WAT-owned standard control. These
  ;; children deliberately do not have renderer.windows entries, so the host
  ;; fallback cannot identify them. Frameworks such as InstallShield inspect
  ;; the notification HWND with GetClassNameA before dispatching WM_COMMAND.
  (func $control_class_name_ptr (param $hwnd i32) (result i32)
    (local $class i32)
    (local.set $class (call $ctrl_table_get_class (local.get $hwnd)))
    (if (i32.eq (local.get $class) (i32.const 1)) (then (return (region.addr $CLASS_NAME_STRINGS 0x00)))) ;; Button
    (if (i32.or (i32.eq (local.get $class) (i32.const 2))
                (i32.or (i32.eq (local.get $class) (i32.const 24))
                        (i32.eq (local.get $class) (i32.const 25))))
      (then (return (region.addr $CLASS_NAME_STRINGS 0x08)))) ;; Edit / RichEdit-backed edit
    (if (i32.eq (local.get $class) (i32.const 3)) (then (return (region.addr $CLASS_NAME_STRINGS 0x0D)))) ;; Static
    (if (i32.eq (local.get $class) (i32.const 4)) (then (return (region.addr $CLASS_NAME_STRINGS 0x14)))) ;; ListBox
    (if (i32.eq (local.get $class) (i32.const 5)) (then (return (region.addr $CLASS_NAME_STRINGS 0x26)))) ;; ComboBox
    (if (i32.eq (local.get $class) (i32.const 7)) (then (return (region.addr $CLASS_NAME_STRINGS 0x1C)))) ;; ScrollBar
    (if (i32.eq (local.get $class) (i32.const 8)) (then (return (region.addr $CLASS_NAME_STRINGS 0x6A)))) ;; SysTreeView32
    (if (i32.eq (local.get $class) (i32.const 17)) (then (return (region.addr $CLASS_NAME_STRINGS 0x2F)))) ;; progress
    (if (i32.eq (local.get $class) (i32.const 18)) (then (return (region.addr $CLASS_NAME_STRINGS 0x41)))) ;; SysListView32
    (if (i32.eq (local.get $class) (i32.const 19)) (then (return (region.addr $CLASS_NAME_STRINGS 0x58)))) ;; trackbar
    (if (i32.eq (local.get $class) (i32.const 21)) (then (return (region.addr $CLASS_NAME_STRINGS 0x174)))) ;; toolbar
    (i32.const 0))

  ;; The name a window's class was actually registered under, as a WASM
  ;; address, or 0 when this hwnd has no class record or the class was named
  ;; by atom rather than by string.
  ;;
  ;; This outranks the built-in name because a superclass is still its own
  ;; class: Storm registers "SDlgStatic" over USER's Static and then decides
  ;; which artwork each dialog child gets by strcmp'ing GetClassNameA's answer
  ;; against that exact string (storm.dll 0x15005112). Answering "Static"
  ;; makes every lookup miss, and a child with no art record paints black.
  (func $wnd_registered_class_name (param $hwnd i32) (result i32)
    (local $slot i32) (local $name i32)
    (local.set $slot (call $wnd_get_class_slot (local.get $hwnd)))
    (if (i32.lt_s (local.get $slot) (i32.const 0)) (then (return (i32.const 0))))
    ;; WNDCLASSA sits at class record + 8; lpszClassName is its +36 field.
    (local.set $name (i32.load offset=44 (call $class_record_addr (local.get $slot))))
    ;; A small value is MAKEINTATOM, which names no string to hand back.
    (if (i32.lt_u (local.get $name) (i32.const 0x10000)) (then (return (i32.const 0))))
    (call $g2w (local.get $name)))

  (func $copy_control_class_name
    (param $hwnd i32) (param $buf i32) (param $max i32) (result i32)
    (local $src i32) (local $len i32) (local $buf_wa i32)
    (local.set $src (call $wnd_registered_class_name (local.get $hwnd)))
    (if (i32.eqz (local.get $src))
      (then (local.set $src (call $control_class_name_ptr (local.get $hwnd)))))
    (if (i32.or (i32.eqz (local.get $src)) (i32.le_s (local.get $max) (i32.const 0)))
      (then (return (i32.const -1))))
    (local.set $len (call $strlen (local.get $src)))
    (if (i32.ge_u (local.get $len) (local.get $max))
      (then (local.set $len (i32.sub (local.get $max) (i32.const 1)))))
    (local.set $buf_wa (call $g2w (local.get $buf))) (call $memcpy (local.get $buf_wa) (local.get $src) (local.get $len))
    (i32.store8 (i32.add (local.get $buf_wa) (local.get $len)) (i32.const 0))
    (local.get $len))

  ;; GetClassNameA(hwnd, lpClassName, nMaxCount) → chars copied
  (func $handle_GetClassNameA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $len i32)
    (local.set $len (call $copy_control_class_name
      (local.get $arg0) (local.get $arg1) (local.get $arg2)))
    (if (i32.ge_s (local.get $len) (i32.const 0))
      (then
        (global.set $eax (local.get $len))
        (global.set $esp (i32.add (global.get $esp) (i32.const 16)))
        (return)))
    (global.set $eax (call $host_get_window_class
      (local.get $arg0) (call $g2w (local.get $arg1)) (local.get $arg2)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 16)))
  )

  ;; A local WND_RECORDS entry, the permanent desktop, or a top-level window
  ;; owned by another process through the shared renderer are the three valid
  ;; HWND domains. Keep this predicate shared so geometry APIs and IsWindow do
  ;; not drift on cross renderer-only windows.
  (func $window_handle_valid (param $hwnd i32) (result i32)
    (i32.and
      (i32.ne (local.get $hwnd) (i32.const 0))
      (i32.or
        (i32.eq (local.get $hwnd) (i32.const 0x10000))
        (i32.or
          (i32.ge_s (call $wnd_table_find (local.get $hwnd)) (i32.const 0))
          (call $host_get_window_info (local.get $hwnd) (i32.const 4))))))

  ;; 93: GetWindowRect
  (func $handle_GetWindowRect (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; GetWindowRect(hwnd, lpRect) — fills RECT with screen coords
    (if (i32.eqz (call $window_handle_valid (local.get $arg0)))
      (then
        (global.set $last_error (i32.const 1400)) ;; ERROR_INVALID_WINDOW_HANDLE
        (global.set $eax (i32.const 0))
        (global.set $esp (i32.add (global.get $esp) (i32.const 12)))
        (return)))
    (call $host_get_window_rect (local.get $arg0) (call $g2w (local.get $arg1)))
    (global.set $eax (i32.const 1))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12))) (return)
  )

  ;; 94: GetDlgCtrlID(hwnd) → the control id in this window's CONTROL_TABLE row
  (func $handle_GetDlgCtrlID (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $ctrl_table_get_id (local.get $arg0)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8)))  ;; stdcall, 1 arg
  )

  ;; 95: GetDlgItemTextA(hDlg, nIDDlgItem, lpString, nMaxCount) → int
  ;; Implemented as GetDlgItem + WM_GETTEXT so the control's own wndproc
  ;; serves the text from its EditState / ButtonState / StaticState — the
  ;; JS _controlText Map that used to cache these strings is gone.
  ;; A dialog item's text as ANSI, into the guest buffer $buf ($max bytes).
  ;; Both spellings of GetDlgItemText ask the control the same question and
  ;; differ only in the encoding they hand back.
  (func $dlg_item_text_ansi (param $hdlg i32) (param $id i32) (param $buf i32) (param $max i32) (result i32)
    (local $ctrl i32)
    (local.set $ctrl (call $ctrl_find_by_id (local.get $hdlg) (local.get $id)))
    (if (local.get $ctrl)
      (then (return (call $wnd_send_message (local.get $ctrl)
              (i32.const 0x000D)              ;; WM_GETTEXT
              (local.get $max)                ;; nMaxCount
              (local.get $buf)))))            ;; lpString (guest ptr)
    ;; Empty string on miss, matching Win32. NOTE: i32.and is BITWISE — for
    ;; a logical "ptr non-null AND len > 0" coerce both sides to 0/1 first,
    ;; otherwise an even-aligned ptr & 1 = 0 and the null-terminator never lands.
    (if (i32.and (i32.ne (local.get $buf) (i32.const 0))
                 (i32.gt_u (local.get $max) (i32.const 0)))
      (then (i32.store8 (call $g2w (local.get $buf)) (i32.const 0))))
    (i32.const 0))

  (func $handle_GetDlgItemTextA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $dlg_item_text_ansi
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 20))) (return)
  )

  ;; 96: GetDlgItem(hDlg, nIDDlgItem) → HWND of child control
  ;; Returns NULL if hDlg is 0 or child not found; otherwise real control HWND
  (func $handle_GetDlgItem (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $result i32)
    ;; NULL parent → no dialog → return NULL
    (if (i32.eqz (local.get $arg0))
      (then
        (global.set $eax (i32.const 0))
        (global.set $esp (i32.add (global.get $esp) (i32.const 12)))
        (return)))
    ;; Look up real HWND from the control table. Returning a fabricated HWND
    ;; makes later APIs like SetWindowTextA report success against a non-window,
    ;; which hides missing-template/control bugs from the app.
    (local.set $result (call $ctrl_find_by_id (local.get $arg0) (local.get $arg1)))
    (global.set $eax (local.get $result))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12)))  ;; stdcall, 2 args
  )

  ;; 97: GetCursorPos
  (func $handle_GetCursorPos (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $pos i32)
    (local $x i32)
    (local $y i32)
    (local.set $pos (call $host_get_mouse_position))
    (local.set $x (i32.and (local.get $pos) (i32.const 0xFFFF)))
    (local.set $y (i32.and (i32.shr_u (local.get $pos) (i32.const 16)) (i32.const 0xFFFF)))
    (global.set $last_msg_pos_x (local.get $x))
    (global.set $last_msg_pos_y (local.get $y))
    (call $gs32 (local.get $arg0) (local.get $x))
    (call $gs32 (i32.add (local.get $arg0) (i32.const 4)) (local.get $y))
    (global.set $eax (i32.const 1))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8))) (return)
  )

  ;; 98: GetLastActivePopup(hWnd) — 1 arg stdcall. USER remembers the last
  ;; active direct owned popup; child/owned windows and empty groups return hWnd.
  ;; The per-owner state and validation are keyed by live window-table slots.
  (func $handle_GetLastActivePopup (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $wnd_get_last_active_popup (local.get $arg0)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8)))  ;; stdcall, 1 arg
  )

  ;; 99: GetFocus — STUB: unimplemented
  (func $handle_GetFocus (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (global.get $focus_hwnd))
    (global.set $esp (i32.add (global.get $esp) (i32.const 4))))

  ;; 100: ReleaseDC(hwnd, hdc) — release the WAT-owned DC, return 1.
  (func $handle_ReleaseDC (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (drop (call $host_release_dc (local.get $arg1)))
    (global.set $eax (i32.const 1))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12)))
  )

  ;; 101: SetWindowLongA — STUB: unimplemented
  (func $handle_SetWindowLongA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $wndproc i32) (local $thunk_idx i32) (local $thunk_api i32)
    (local $slot i32) (local $dialog_marked i32)
    ;; SetWindowLongA(hWnd, nIndex, dwNewLong) — nIndex is signed
    ;; GWL_WNDPROC=-4, GWL_USERDATA=-21, GWL_STYLE=-16, GWL_EXSTYLE=-20, GWL_ID=-12
    ;; Also positive indices for dialog extra bytes (DWLP_USER etc.)
    (if (i32.eq (local.get $arg1) (i32.const -21))  ;; GWL_USERDATA
      (then
        (global.set $eax (call $wnd_set_userdata (local.get $arg0) (local.get $arg2)))
        (global.set $esp (i32.add (global.get $esp) (i32.const 16))) (return)))
    (if (i32.eq (local.get $arg1) (i32.const -4))   ;; GWL_WNDPROC — subclass
      (then
        (global.set $eax (call $wnd_table_get (local.get $arg0)))  ;; return old wndproc
        ;; Top-level placeholders have no previous guest proc. Native controls,
        ;; however, must return the built-in sentinel so subclasses can chain
        ;; stateful messages through CallWindowProc.
        (if (i32.and
              (i32.eq (global.get $eax) (global.get $WNDPROC_BUILTIN))
              (i32.eqz (call $ctrl_table_get_class (local.get $arg0))))
          (then (global.set $eax (i32.const 0))))
        ;; If old wndproc is 0 (not in table), fall back to global wndproc for main window
        (if (i32.and (i32.eqz (global.get $eax))
                     (i32.eq (local.get $arg0) (global.get $main_hwnd)))
          (then (global.set $eax (global.get $wndproc_addr))))
        ;; WAT-native trackbars already implement the common-control messages
        ;; Funtris uses. Letting the app replace their wndproc routes every
        ;; initialization SendMessage through an x86 subclass chain that never
        ;; reaches browser-idle again, so keep the native wndproc installed.
        (if (i32.eq (call $ctrl_table_get_class (local.get $arg0)) (i32.const 19))
          (then
            (global.set $esp (i32.add (global.get $esp) (i32.const 16)))
            (return)))
        (call $wnd_table_set (local.get $arg0) (local.get $arg2)) ;; set new wndproc
        (global.set $esp (i32.add (global.get $esp) (i32.const 16))) (return)))
    (if (i32.eq (local.get $arg1) (i32.const -12))  ;; GWL_ID
      (then
        ;; CONTROL_TABLE+4 is the ONLY copy of the notification id, so this one
        ;; store is the whole of GWL_ID. There used to be a second store here
        ;; hand-syncing ButtonState's own copy — a bare (i32.store offset=12)
        ;; against a record declared in another file — because a control whose
        ;; id is reassigned after creation must notify with the NEW id (VCL
        ;; creates TNewButton with hMenu=0 and assigns its id immediately
        ;; afterward; a stale zero made its mouse release notify the form as
        ;; command 0). That sync covered ctrl_class 1 and no other, so combo
        ;; boxes, list boxes, list views and colour grids kept notifying with
        ;; the id they were created with. Deleting the duplicate field fixes
        ;; all five at once and removes the raw offset.
        (global.set $eax
          (call $ctrl_table_set_id (local.get $arg0) (local.get $arg2)))
        (global.set $esp (i32.add (global.get $esp) (i32.const 16))) (return)))
    (if (i32.eq (local.get $arg1) (i32.const -16))  ;; GWL_STYLE
      (then
        (global.set $eax (call $wnd_set_style (local.get $arg0) (local.get $arg2)))
        (global.set $esp (i32.add (global.get $esp) (i32.const 16))) (return)))
    (if (i32.eq (local.get $arg1) (i32.const -20))  ;; GWL_EXSTYLE
      (then
        (global.set $eax (call $ctrl_get_ex_style (local.get $arg0)))  ;; old value
        (call $ctrl_set_ex_style (local.get $arg0) (local.get $arg2))
        (global.set $esp (i32.add (global.get $esp) (i32.const 16))) (return)))
    ;; Dialog and registered-window extra bytes are independent of application
    ;; GWL_USERDATA. WinHelp's toolbar uses multiple positive LONG offsets.
    (if (i32.ge_s (local.get $arg1) (i32.const 0))
      (then
        ;; DWLP_DLGPROC is byte offset 4 on Win32. A raw dialog class can use
        ;; USER32's imported DefDlgProcA/W thunk as its registered WNDPROC,
        ;; then attach the actual DLGPROC with SetWindowLong. Keep that proc in
        ;; the dialog table: treating it as ordinary class-extra data makes
        ;; DefDlgProc silently discard WM_INITDIALOG and every owner-draw call.
        (local.set $wndproc (call $wnd_table_get (local.get $arg0)))
        (local.set $slot (call $wnd_table_find (local.get $arg0)))
        (local.set $dialog_marked (i32.const 0))
        (if (i32.ge_s (local.get $slot) (i32.const 0))
          (then
            (local.set $dialog_marked
              (i32.load offset=8 (call $dialog_state_addr (local.get $slot))))))
        (local.set $thunk_api (i32.const -1))
        (if (i32.and
              (i32.ge_u (local.get $wndproc) (global.get $thunk_guest_base))
              (i32.lt_u (local.get $wndproc) (global.get $thunk_guest_end)))
          (then
            (local.set $thunk_idx
              (i32.div_u
                (i32.sub (local.get $wndproc) (global.get $thunk_guest_base))
                (i32.const 8)))
            (local.set $thunk_api
              (i32.load (i32.add
                (i32.add (global.get $THUNK_BASE)
                  (i32.mul (local.get $thunk_idx) (i32.const 8)))
                (i32.const 4))))))
        (if (i32.and
              (i32.eq (local.get $arg1) (i32.const 4))
              (i32.or
                (i32.eq (local.get $wndproc) (global.get $WNDPROC_DIALOG))
                (i32.or
                  (i32.ne (local.get $dialog_marked) (i32.const 0))
                  (i32.or
                    (call $wnd_class_is_dialog (local.get $arg0))
                    (i32.or
                      (i32.eq (local.get $thunk_api) (i32.const 2649))
                      (i32.eq (local.get $thunk_api) (i32.const 2650)))))))
          (then
            (global.set $eax
              (call $dialog_proc_set (local.get $arg0) (local.get $arg2)))
            (global.set $esp (i32.add (global.get $esp) (i32.const 16)))
            (return)))
        (if (call $dialog_proc_get (local.get $arg0))
          (then
            (global.set $eax (call $dialog_extra_set
              (local.get $arg0) (local.get $arg1) (local.get $arg2))))
          (else
            (global.set $eax (call $wnd_extra_set
              (local.get $arg0) (local.get $arg1) (local.get $arg2)))))
        (global.set $esp (i32.add (global.get $esp) (i32.const 16))) (return)))
    ;; Default: return 0 for unhandled indices
    (global.set $eax (i32.const 0))
    (global.set $esp (i32.add (global.get $esp) (i32.const 16)))
  )

  ;; SetWindowWord(hWnd, nIndex, wNewWord) → WORD (previous value)
  ;;
  ;; Win16's window-word API, still exported by USER32 and still used: Win98's
  ;; System Monitor calls it for View > Hide Title Bar, and with no entry point
  ;; registered that menu item was a hard fail-fast crash.
  ;;
  ;; A negative index names the same field as SetWindowLong -- GWL_WNDPROC -4,
  ;; GWL_ID -12, GWL_STYLE -16 and friends -- so hand those to the 32-bit
  ;; handler and narrow the result, rather than keeping a second copy of that
  ;; logic. Both are stdcall(3), so it pops the frame correctly for us too.
  ;;
  ;; A non-negative index is a byte offset into the window's extra bytes, and
  ;; the whole point of this call is that it touches exactly two of them:
  ;; widening it to a dword store would silently clobber the neighbouring word.
  (func $handle_SetWindowWord (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $slot i32) (local $p i32) (local $old i32)
    (if (i32.lt_s (local.get $arg1) (i32.const 0))
      (then
        (call $handle_SetWindowLongA
          (local.get $arg0) (local.get $arg1)
          (i32.and (local.get $arg2) (i32.const 0xFFFF))
          (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
        (global.set $eax (i32.and (global.get $eax) (i32.const 0xFFFF)))
        (return)))
    (local.set $slot (call $wnd_table_find (local.get $arg0)))
    ;; 16 bytes of extra storage per window; a word needs both of its bytes
    ;; inside it.
    (if (i32.or (i32.lt_s (local.get $slot) (i32.const 0))
                (i32.gt_u (local.get $arg1) (i32.const 14)))
      (then
        (global.set $eax (i32.const 0))
        (global.set $esp (i32.add (global.get $esp) (i32.const 16)))
        (return)))
    (local.set $p (call $wnd_extra_addr (local.get $slot) (local.get $arg1)))
    (local.set $old (i32.load16_u (local.get $p)))
    (i32.store16 (local.get $p) (i32.and (local.get $arg2) (i32.const 0xFFFF)))
    (global.set $eax (local.get $old))
    (global.set $esp (i32.add (global.get $esp) (i32.const 16)))
  )

  ;; GetWindowWord(hWnd, nIndex) → WORD. Negative indices and the aligned
  ;; window-extra offsets used by Win32 applications share GetWindowLong's
  ;; backing state; return its low word. Both APIs are stdcall(2), so the long
  ;; handler also performs the correct stack cleanup.
  (func $handle_GetWindowWord (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_GetWindowLongA
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
    (global.set $eax (i32.and (global.get $eax) (i32.const 0xFFFF)))
  )

  ;; 102: SetWindowTextA
  (func $handle_SetWindowTextA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $wa i32) (local $len i32)
    (if (i32.eqz (local.get $arg0))
      (then
        (global.set $eax (i32.const 0))
        (global.set $esp (i32.add (global.get $esp) (i32.const 12)))
        (return)))
    (local.set $wa (call $g2w (local.get $arg1)))
    (local.set $len (call $guest_strlen (local.get $arg1)))
    ;; Child controls treat SetWindowText as WM_SETTEXT on their own wndproc.
    ;; Top-level dialogs/windows still update the caption title table below.
    (if (i32.and
          (i32.ne (call $ctrl_table_get_class (local.get $arg0)) (i32.const 0))
          (i32.or
            (i32.lt_u (call $ctrl_table_get_class (local.get $arg0)) (i32.const 10))
            (i32.gt_u (call $ctrl_table_get_class (local.get $arg0)) (i32.const 16))))
      (then
        (global.set $eax (call $control_wndproc_dispatch
          (local.get $arg0) (i32.const 0x000C) (i32.const 0) (local.get $arg1)))
        (call $host_set_window_text (local.get $arg0) (local.get $wa))
        (global.set $esp (i32.add (global.get $esp) (i32.const 12)))
        (return)))
    ;; Native child windows such as RichEdit20A are not WAT control-table
    ;; controls, but SetWindowText still maps to WM_SETTEXT for them. Without
    ;; this, WordPad's File->New title reset succeeds while the RichEdit buffer
    ;; keeps the previous document text.
    (if (i32.and
          (i32.ne (call $wnd_get_parent (local.get $arg0)) (i32.const 0))
          (i32.ne (call $wnd_table_get (local.get $arg0)) (i32.const 0)))
      (then
        (call $richedit_format_reset_hwnd (local.get $arg0))
        (call $title_table_set (local.get $arg0) (local.get $wa) (local.get $len))
        (global.set $eax (call $wnd_send_message
          (local.get $arg0) (i32.const 0x000C) (i32.const 0) (local.get $arg1)))
        (call $host_set_window_text (local.get $arg0) (local.get $wa))
        (global.set $esp (i32.add (global.get $esp) (i32.const 12)))
        (return)))
    ;; Store in TITLE_TABLE so DefWindowProc WM_NCPAINT can redraw the
    ;; caption text from WAT-side state. Also post WM_NCPAINT.
    (call $title_table_set (local.get $arg0) (local.get $wa) (local.get $len))
    (call $nc_flags_set (local.get $arg0) (i32.const 1))
    ;; SetWindowText can run inside a synchronous common-dialog hook, where
    ;; the normal deferred NC-paint scan cannot run until after the modal
    ;; frame is already exposed. Paint the new caption immediately as USER does.
    (call $defwndproc_do_ncpaint (local.get $arg0))
    (call $host_set_window_text (local.get $arg0) (local.get $wa))
    (global.set $eax (i32.const 1))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12))) (return)
  )

  ;; 103: SetDlgItemTextA — delegate to the control's wndproc via
  ;; WM_SETTEXT so EditState / ButtonState / StaticState own the string.
  (func $handle_SetDlgItemTextA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $ctrl i32) (local $wa i32) (local $len i32)
    (local.set $ctrl (call $ctrl_find_by_id (local.get $arg0) (local.get $arg1)))
    (if (local.get $ctrl)
      (then
        ;; USER's window text is independent of the class wndproc. Registered
        ;; dialog controls such as Sound Recorder's noflicker readout query it
        ;; through GetWindowTextA while painting.
        (if (local.get $arg2)
          (then
            (local.set $wa (call $g2w (local.get $arg2)))
            (local.set $len (call $strlen (local.get $wa)))))
        (call $title_table_set (local.get $ctrl) (local.get $wa) (local.get $len))
        (drop (call $wnd_send_message (local.get $ctrl)
                (i32.const 0x000C)                    ;; WM_SETTEXT
                (i32.const 0)
                (local.get $arg2)))))                 ;; lpString (guest ptr)
    (global.set $eax (i32.const 1))
    (global.set $esp (i32.add (global.get $esp) (i32.const 16))) (return)
  )

  ;; 104: SetDlgItemInt(hDlg, nIDDlgItem, uValue, bSigned) — format integer
  ;; into decimal ASCII and delegate to WM_SETTEXT on the child edit.
  (func $handle_SetDlgItemInt (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $ctrl i32) (local $buf i32) (local $buf_w i32)
    (local $val i32) (local $neg i32) (local $tmp i32)
    (local $digits i32) (local $i i32)
    (local.set $ctrl (call $ctrl_find_by_id (local.get $arg0) (local.get $arg1)))
    (if (local.get $ctrl)
      (then
        (local.set $val (local.get $arg2))
        (local.set $neg (i32.const 0))
        (if (i32.and (i32.ne (local.get $arg3) (i32.const 0))
                     (i32.lt_s (local.get $val) (i32.const 0)))
          (then
            (local.set $neg (i32.const 1))
            (local.set $val (i32.sub (i32.const 0) (local.get $val)))))
        ;; 16-byte scratch is plenty: max 10 digits + sign + NUL
        (local.set $buf (call $heap_alloc (i32.const 16)))
        (if (local.get $buf)
          (then
            (local.set $buf_w (call $g2w (local.get $buf)))
            ;; Count digits (at least 1 for val==0)
            (local.set $tmp (local.get $val))
            (local.set $digits (i32.const 1))
            (block $cnt_done (loop $cnt
              (local.set $tmp (i32.div_u (local.get $tmp) (i32.const 10)))
              (br_if $cnt_done (i32.eqz (local.get $tmp)))
              (local.set $digits (i32.add (local.get $digits) (i32.const 1)))
              (br $cnt)))
            ;; Write sign if needed
            (if (local.get $neg)
              (then
                (i32.store8 (local.get $buf_w) (i32.const 0x2D))  ;; '-'
                (local.set $buf_w (i32.add (local.get $buf_w) (i32.const 1)))))
            ;; Emit digits right-to-left
            (local.set $i (i32.sub (local.get $digits) (i32.const 1)))
            (local.set $tmp (local.get $val))
            (block $emit_done (loop $emit
              (i32.store8
                (i32.add (local.get $buf_w) (local.get $i))
                (i32.add (i32.const 0x30) (i32.rem_u (local.get $tmp) (i32.const 10))))
              (local.set $tmp (i32.div_u (local.get $tmp) (i32.const 10)))
              (br_if $emit_done (i32.eqz (local.get $i)))
              (local.set $i (i32.sub (local.get $i) (i32.const 1)))
              (br $emit)))
            ;; NUL terminator
            (i32.store8 (i32.add (local.get $buf_w) (local.get $digits)) (i32.const 0))
            (drop (call $wnd_send_message (local.get $ctrl)
                    (i32.const 0x000C)          ;; WM_SETTEXT
                    (i32.const 0)
                    (local.get $buf)))
            (call $heap_free (local.get $buf)))))
      )
    (global.set $eax (i32.const 1))
    (global.set $esp (i32.add (global.get $esp) (i32.const 20)))  ;; stdcall, 4 args
  )

  ;; 105: SetForegroundWindow(hWnd) — 1 arg stdcall
  (func $handle_SetForegroundWindow (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $top i32)
    (local.set $top (call $wnd_top_level (local.get $arg0)))
    (if (i32.and
          (i32.ge_s (call $wnd_table_find (local.get $top)) (i32.const 0))
          (i32.eq (call $wnd_get_thread (local.get $top)) (global.get $current_thread_id)))
      (then (drop (call $active_window_transition (local.get $top)))))
    (global.set $eax (call $host_activate_window (local.get $arg0)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8)))  ;; stdcall, 1 arg
  )

  ;; SwitchToThisWindow(hWnd, fAltTab) — activate renderer window
  (func $handle_SwitchToThisWindow (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $top i32)
    (local.set $top (call $wnd_top_level (local.get $arg0)))
    (if (i32.and
          (i32.ge_s (call $wnd_table_find (local.get $top)) (i32.const 0))
          (i32.eq (call $wnd_get_thread (local.get $top)) (global.get $current_thread_id)))
      (then (drop (call $active_window_transition (local.get $top)))))
    (drop (call $host_activate_window (local.get $arg0)))
    (global.set $eax (i32.const 0))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12)))
  )

  ;; CloseWindow(hWnd) — despite the name, Win32 minimizes the window.
  (func $handle_CloseWindow (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $top i32) (local $slot i32)
    (local.set $slot (call $wnd_table_find (local.get $arg0)))
    (if (i32.and (i32.lt_s (local.get $slot) (i32.const 0))
                 (i32.eqz (call $host_get_window_info (local.get $arg0) (i32.const 4))))
      (then
        (global.set $last_error (i32.const 1400)) ;; ERROR_INVALID_WINDOW_HANDLE
        (global.set $eax (i32.const 0))
        (global.set $esp (i32.add (global.get $esp) (i32.const 8)))
        (return)))
    ;; Use the same browser-side transition as SC_MINIMIZE and retain the
    ;; guest-visible bit queried by IsIconic/GetWindowPlacement.
    (call $host_sys_command (local.get $arg0) (i32.const 0xF020)) ;; SC_MINIMIZE
    (if (i32.ge_s (local.get $slot) (i32.const 0))
      (then
        (call $wnd_apply_show_state (local.get $arg0) (i32.const 6)) ;; SW_MINIMIZE
        (local.set $top (call $wnd_top_level (local.get $arg0)))
        (if (i32.eq (global.get $active_hwnd) (local.get $top))
          (then (drop (call $active_window_transition (i32.const 0)))))))
    (global.set $eax (i32.const 1))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8)))
  )

  ;; CascadeWindows(hwndParent, how, lpRect, cKids, lpKids) → arranged count.
  (func $handle_CascadeWindows (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $host_arrange_windows
      (i32.const 0) (local.get $arg1)
      (select (call $g2w (local.get $arg2)) (i32.const 0) (i32.ne (local.get $arg2) (i32.const 0)))
      (local.get $arg3)
      (select (call $g2w (local.get $arg4)) (i32.const 0) (i32.ne (local.get $arg4) (i32.const 0)))))
    (global.set $esp (i32.add (global.get $esp) (i32.const 24))))

  ;; TileWindows(hwndParent, how, lpRect, cKids, lpKids) → arranged count.
  (func $handle_TileWindows (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $host_arrange_windows
      (i32.const 1) (local.get $arg1)
      (select (call $g2w (local.get $arg2)) (i32.const 0) (i32.ne (local.get $arg2) (i32.const 0)))
      (local.get $arg3)
      (select (call $g2w (local.get $arg4)) (i32.const 0) (i32.ne (local.get $arg4) (i32.const 0)))))
    (global.set $esp (i32.add (global.get $esp) (i32.const 24))))

  ;; ArrangeIconicWindows(hwndParent) → height occupied by icon rows.
  (func $handle_ArrangeIconicWindows (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $host_arrange_windows
      (i32.const 2) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8))))

  ;; Helper: apply a new cursor and return the previous handle. Shared by
  ;; $handle_SetCursor and DefWindowProc's WM_SETCURSOR path.
  (func $set_cursor_internal (param $hcur i32) (result i32)
    (local $prev i32)
    (local.set $prev (global.get $current_cursor))
    (global.set $current_cursor (local.get $hcur))
    ;; A cursor the guest built from bitmaps carries its own pixels; anything
    ;; else is an IDC_* or a PE resource the host resolves from the handle.
    (if (i32.eqz (call $cursor_push (local.get $hcur)))
      (then (call $host_set_cursor (call $icon_opaque_cursor_source (local.get $hcur)))))
    (local.get $prev))

  ;; 106: SetCursor(hCursor) — 1 arg stdcall, returns previous HCURSOR.
  (func $handle_SetCursor (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $set_cursor_internal (local.get $arg0)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8)))
  )

  ;; GetCursor() — return the cursor most recently installed by SetCursor.
  ;; SDL queries this while bringing its DirectDraw window to the foreground.
  (func $handle_GetCursor (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (global.get $current_cursor))
    (global.set $esp (i32.add (global.get $esp) (i32.const 4)))
  )

  ;; 107: SetFocus(hwnd) — 1 arg stdcall, return previous focus hwnd
  (func $handle_SetFocus (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $wndproc i32) (local $prev i32) (local $ret_addr i32)
    (local.set $prev (global.get $focus_hwnd))
    (global.set $eax (local.get $prev))
    ;; Focus change: post WM_KILLFOCUS to outgoing window. The incoming
    ;; WM_SETFOCUS is delivered synchronously below (EIP redirect).
    (if (i32.and (i32.ne (local.get $prev) (local.get $arg0))
                 (i32.ne (local.get $prev) (i32.const 0)))
      (then
        (drop (call $post_queue_push
                (local.get $prev) (i32.const 0x0008)
                (local.get $arg0) (i32.const 0)))))
    (global.set $focus_hwnd (local.get $arg0))
    (local.set $wndproc (call $wnd_table_get (local.get $arg0)))
    ;; Dialog HWNDs keep USER's DefDlgProc marker in the window table, while
    ;; their real guest DLGPROC lives in dialog state.  The marker is below the
    ;; WAT-native range, so the generic x86 branch would otherwise jump to
    ;; 0xFFFE0002 and decode emulator-private data as guest instructions.
    (if (i32.eq (local.get $wndproc) (global.get $WNDPROC_DIALOG))
      (then
        (drop (call $dialog_default_proc
          (local.get $arg0) (i32.const 0x0007) (local.get $prev) (i32.const 0)))
        (global.set $esp (i32.add (global.get $esp) (i32.const 8)))
        (return)))
    ;; WAT-native wndproc: dispatch inline
    (if (i32.ge_u (local.get $wndproc) (i32.const 0xFFFF0000))
      (then (drop (call $wat_wndproc_dispatch
              (local.get $arg0) (i32.const 0x0007) (local.get $prev) (i32.const 0)))
        (global.set $esp (i32.add (global.get $esp) (i32.const 8)))
        (return)))
    ;; x86 wndproc: no entry means try globals
    (if (i32.eqz (local.get $wndproc))
      (then
        (if (i32.eq (local.get $arg0) (global.get $main_hwnd))
          (then (local.set $wndproc (global.get $wndproc_addr))))))
    ;; Deliver WM_SETFOCUS synchronously by redirecting EIP to the wndproc.
    ;; Keep SetFocus's return value and the nonvolatile register set in a
    ;; continuation frame below its original two-word stdcall frame.
    (if (local.get $wndproc)
      (then
        (local.set $ret_addr (call $gl32 (global.get $esp)))
        (global.set $esp (i32.sub (global.get $esp) (i32.const 40)))
        (call $gs32 (global.get $esp) (global.get $setfocus_ret_thunk))
        (call $gs32 (i32.add (global.get $esp) (i32.const 4)) (local.get $arg0))     ;; hwnd
        (call $gs32 (i32.add (global.get $esp) (i32.const 8)) (i32.const 0x0007))    ;; WM_SETFOCUS
        (call $gs32 (i32.add (global.get $esp) (i32.const 12)) (local.get $prev))    ;; wParam = prev focus
        (call $gs32 (i32.add (global.get $esp) (i32.const 16)) (i32.const 0))        ;; lParam = 0
        (call $gs32 (i32.add (global.get $esp) (i32.const 20)) (local.get $ret_addr))
        (call $gs32 (i32.add (global.get $esp) (i32.const 24)) (local.get $prev))
        (call $gs32 (i32.add (global.get $esp) (i32.const 28)) (global.get $ebx))
        (call $gs32 (i32.add (global.get $esp) (i32.const 32)) (global.get $esi))
        (call $gs32 (i32.add (global.get $esp) (i32.const 36)) (global.get $edi))
        (call $gs32 (i32.add (global.get $esp) (i32.const 40)) (global.get $ebp))
        (global.set $eip (local.get $wndproc))
        (global.set $steps (i32.const 0))
        (return)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8)))
  )

  ;; 108: LoadCursorA(hInstance, lpCursorName) — return HCURSOR encoding the IDC_*.
  ;; System cursors: hInstance=0, lpCursorName is an ordinal (MAKEINTRESOURCE,
  ;; value < 0x10000) in the IDC_* range (32512..). Encoded handle:
  ;;   0x60000 | (IDC_X & 0xFFFF) — system IDC cursor.
  ;;   0x680000 | (resource & 0xFFFF) — app RT_GROUP_CURSOR resource.
  (func $handle_LoadCursorA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.and (i32.eqz (local.get $arg0))
                 (i32.lt_u (local.get $arg1) (i32.const 0x10000)))
      (then (global.set $eax (i32.or (i32.const 0x60000)
                                     (i32.and (local.get $arg1) (i32.const 0xFFFF)))))
      (else
        (if (i32.lt_u (local.get $arg1) (i32.const 0x10000))
          (then (global.set $eax (i32.or (i32.const 0x680000)
                                         (i32.and (local.get $arg1) (i32.const 0xFFFF)))))
          (else (global.set $eax (i32.const 0x67F00)))))) ;; string cursor names unsupported
    (global.set $esp (i32.add (global.get $esp) (i32.const 12)))
  )

  ;; ---- ICON_TABLE: HICON → the resource it was loaded from ----
  ;; An icon handle used to be the constant 0x60001, which meant DrawIconEx
  ;; had nothing to draw and every icon in the system was the same nothing.
  ;; Remembering {hInstance, resource id} is the whole difference: the pixels
  ;; are already decodable from the PE by $gdi_icon_draw_resource_at.
  ;; An icon built from bitmaps rather than loaded from a resource: CreateIcon
  ;; hands over the AND and XOR bits directly, so there is no {module,
  ;; resource} to remember. It is interned with a null instance and the colour
  ;; bitmap as its "resource", and drawing one blits that bitmap — see
  ;; $icon_draw_handle. Visual Basic's controls build their pictures this way.
  (global $ICON_FROM_BITMAP i32 (i32.const 0x1C0B17))
  (global $ICON_FROM_OPAQUE i32 (i32.const 0x0FACED))
  ;; A Win16 NE module id, stored in ICON_TABLE's hInstance word. The low 24
  ;; bits are the $win16_res_module selector (task=1, DLL=0x10000|id).
  (global $ICON_FROM_WIN16 i32 (i32.const 0x16000000))

  (func $icon_intern (param $hinst i32) (param $resid i32) (result i32)
    (local $i i32) (local $p i32) (local $free i32)
    (local.set $free (i32.const -1))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (global.get $MAX_ICONS)))
      (local.set $p (i32.add (global.get $ICON_TABLE)
                     (i32.mul (local.get $i) (i32.const 8))))
      ;; A repeat load of the same resource must hand back the same handle:
      ;; apps compare HICONs, and DestroyIcon on a duplicate is common.
      (if (i32.and (i32.eq (i32.load (local.get $p)) (local.get $hinst))
                   (i32.eq (i32.load offset=4 (local.get $p)) (local.get $resid)))
        (then (return (i32.or (global.get $ICON_HANDLE_TAG) (local.get $i)))))
      (if (i32.and (i32.lt_s (local.get $free) (i32.const 0))
                   (i32.eqz (i32.load offset=4 (local.get $p))))
        (then (local.set $free (local.get $i))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (if (i32.lt_s (local.get $free) (i32.const 0)) (then (return (i32.const 0))))
    (local.set $p (i32.add (global.get $ICON_TABLE)
                   (i32.mul (local.get $free) (i32.const 8))))
    (i32.store (local.get $p) (local.get $hinst))
    (i32.store offset=4 (local.get $p) (local.get $resid))
    (i32.or (global.get $ICON_HANDLE_TAG) (local.get $free)))

  ;; Draw a bitmap-backed ICONINFO record.  cursor_rasterize is the one place
  ;; that interprets the AND/XOR planes, including DDB orientation and
  ;; monochrome icons; sampling that canonical BGRA result keeps DrawIcon and
  ;; the browser cursor path on the same pixels.  Win98 icons have binary
  ;; transparency, so an opaque source pixel replaces the destination while a
  ;; transparent one leaves it untouched.
  (func $cursor_draw_handle (param $hicon i32) (param $hdc i32)
        (param $x i32) (param $y i32) (param $cx i32) (param $cy i32)
        (param $di_flags i32) (result i32)
    (local $record i32) (local $src_w i32) (local $src_h i32)
    (local $pixels_ga i32) (local $pixels i32) (local $dst i32)
    (local $dx i32) (local $dy i32) (local $px i32) (local $py i32)
    (local $sx i32) (local $sy i32) (local $pixel i32)
    (local.set $record (call $cursor_record (local.get $hicon)))
    (if (i32.eqz (local.get $record)) (then (return (i32.const 0))))
    (local.set $src_w (call $cursor_width (local.get $record)))
    (local.set $src_h (call $cursor_height (local.get $record)))
    (if (i32.or
          (i32.or (i32.le_s (local.get $src_w) (i32.const 0))
            (i32.gt_s (local.get $src_w) (i32.const 1024)))
          (i32.or (i32.le_s (local.get $src_h) (i32.const 0))
            (i32.gt_s (local.get $src_h) (i32.const 1024))))
      (then (return (i32.const 0))))
    (if (i32.le_s (local.get $cx) (i32.const 0))
      (then (local.set $cx (local.get $src_w))))
    (if (i32.le_s (local.get $cy) (i32.const 0))
      (then (local.set $cy (local.get $src_h))))
    (if (i32.or
          (i32.or (i32.le_s (local.get $cx) (i32.const 0))
            (i32.gt_s (local.get $cx) (i32.const 4096)))
          (i32.or (i32.le_s (local.get $cy) (i32.const 0))
            (i32.gt_s (local.get $cy) (i32.const 4096))))
      (then (return (i32.const 0))))
    (local.set $pixels_ga (call $dib_alloc
      (i32.shl (i32.mul (local.get $src_w) (local.get $src_h)) (i32.const 2))))
    (if (i32.eqz (local.get $pixels_ga)) (then (return (i32.const 0))))
    (local.set $pixels (call $g2w (local.get $pixels_ga)))
    (if (i32.eqz (call $cursor_rasterize (local.get $record) (local.get $pixels)))
      (then
        (call $dib_free_wasm (local.get $pixels))
        (return (i32.const 0))))
    (local.set $dst (global.get $GDI_BLIT_DST_DESC))
    (if (i32.eqz (call $gdi_surface_descriptor (local.get $hdc) (local.get $dst)))
      (then
        (call $dib_free_wasm (local.get $pixels))
        (return (i32.const 0))))
    (local.set $dx (call $gdi_line_map_x (local.get $dst) (local.get $x)))
    (local.set $dy (call $gdi_line_map_y (local.get $dst) (local.get $y)))
    (block $rows_done (loop $rows
      (br_if $rows_done (i32.ge_u (local.get $py) (local.get $cy)))
      (local.set $sy (i32.div_u (i32.mul (local.get $py) (local.get $src_h))
        (local.get $cy)))
      (local.set $px (i32.const 0))
      (block $cols_done (loop $cols
        (br_if $cols_done (i32.ge_u (local.get $px) (local.get $cx)))
        (local.set $sx (i32.div_u (i32.mul (local.get $px) (local.get $src_w))
          (local.get $cx)))
        (local.set $pixel (i32.load (i32.add (local.get $pixels)
          (i32.shl (i32.add (i32.mul (local.get $sy) (local.get $src_w))
            (local.get $sx)) (i32.const 2)))))
        (if (i32.and
              (i32.ne (i32.and (local.get $pixel) (i32.const 0xFF000000))
                (i32.const 0))
              (call $gdi_raster_clip_visible (local.get $hdc) (local.get $dst)
                (i32.add (local.get $dx) (local.get $px))
                (i32.add (local.get $dy) (local.get $py))))
          (then (drop (call $gdi_raster_write (local.get $dst)
            (i32.add (local.get $dx) (local.get $px))
            (i32.add (local.get $dy) (local.get $py))
            (i32.and (local.get $pixel) (i32.const 0x00FFFFFF))))))
        (local.set $px (i32.add (local.get $px) (i32.const 1)))
        (br $cols)))
      (local.set $py (i32.add (local.get $py) (i32.const 1)))
      (br $rows)))
    (call $gdi_geometry_present (local.get $hdc) (local.get $dst)
      (local.get $dx) (local.get $dy)
      (i32.add (local.get $dx) (local.get $cx))
      (i32.add (local.get $dy) (local.get $cy)))
    (call $dib_free_wasm (local.get $pixels))
    (i32.const 1))

  ;; Paint an interned icon. Returns 0 for any handle we did not intern, which
  ;; keeps the old opaque handles (and system icons we ship no pixels for)
  ;; behaving exactly as before instead of drawing garbage.
  (func $icon_draw_handle (param $hicon i32) (param $hdc i32)
        (param $x i32) (param $y i32) (param $cx i32) (param $cy i32)
        (param $di_flags i32) (result i32)
    (local $slot i32) (local $p i32) (local $ok i32)
    (if (call $cursor_draw_handle
          (local.get $hicon) (local.get $hdc)
          (local.get $x) (local.get $y) (local.get $cx) (local.get $cy)
          (local.get $di_flags))
      (then (return (i32.const 1))))
    (if (i32.ne (i32.and (local.get $hicon) (i32.const 0xFFFF0000))
                (global.get $ICON_HANDLE_TAG))
      (then (return (i32.const 0))))
    (local.set $slot (i32.and (local.get $hicon) (i32.const 0xFFFF)))
    (if (i32.ge_u (local.get $slot) (global.get $MAX_ICONS))
      (then (return (i32.const 0))))
    (local.set $p (i32.add (global.get $ICON_TABLE)
                   (i32.mul (local.get $slot) (i32.const 8))))
    (if (i32.eqz (i32.load offset=4 (local.get $p)))
      (then (return (i32.const 0))))
    ;; cx/cy of 0 mean "the icon's own size" — resources and CreateIcon's
    ;; legacy bitmap wrapper default to the Win98 large-icon metric.
    (if (i32.le_s (local.get $cx) (i32.const 0))
      (then (local.set $cx (i32.const 32))))
    (if (i32.le_s (local.get $cy) (i32.const 0))
      (then (local.set $cy (i32.const 32))))
    ;; An icon that was built rather than loaded has a bitmap where its
    ;; resource id would be; blit that instead of walking a resource.
    (if (i32.eq (i32.load (local.get $p)) (global.get $ICON_FROM_BITMAP))
      (then
        (local.set $ok (call $gdi_dc_alloc))
        (if (i32.eqz (local.get $ok)) (then (return (i32.const 0))))
        (drop (call $host_gdi_select_object (local.get $ok)
                (i32.and (i32.load offset=4 (local.get $p))
                  (i32.const 0x7FFFFFFF))))
        (drop (call $host_gdi_bitblt (local.get $hdc) (local.get $x) (local.get $y)
                (local.get $cx) (local.get $cy) (local.get $ok)
                (i32.const 0) (i32.const 0) (i32.const 0x00CC0020)))
        (drop (call $gdi_dc_delete (local.get $ok)))
        (return (i32.const 1))))
    ;; Opaque system/named handles had no drawable pixels before being copied;
    ;; their independent copy remains intentionally opaque too.
    (if (i32.eq (i32.load (local.get $p)) (global.get $ICON_FROM_OPAQUE))
      (then (return (i32.const 0))))
    ;; NE icon resources live in a flat table rather than the PE resource
    ;; tree. Restore the module captured by Win16 LoadIcon while decoding.
    (if (i32.eq
          (i32.and (i32.load (local.get $p)) (i32.const 0xFF000000))
          (global.get $ICON_FROM_WIN16))
      (then
        (global.set $win16_res_module_id
          (i32.and (i32.load (local.get $p)) (i32.const 0x00FFFFFF)))
        (local.set $ok (call $gdi_icon_draw_resource_at
          (local.get $hdc) (i32.and (i32.load offset=4 (local.get $p))
            (i32.const 0x7FFFFFFF))
          (local.get $cx) (local.get $cy) (i32.const 1)
          (local.get $x) (local.get $y) (local.get $di_flags)))
        (global.set $win16_res_module_id (i32.const 0))
        (return (local.get $ok))))
    ;; The icon belongs to the module it was loaded from, which need not be
    ;; the one running now.
    (call $push_rsrc_ctx (i32.load (local.get $p)))
    (local.set $ok (call $gdi_icon_draw_resource_at
      (local.get $hdc) (i32.and (i32.load offset=4 (local.get $p))
        (i32.const 0x7FFFFFFF))
      (local.get $cx) (local.get $cy) (i32.const 1)
      (local.get $x) (local.get $y) (local.get $di_flags)))
    (call $pop_rsrc_ctx)
    (local.get $ok))

  ;; ---- CURSOR_TABLE: an HICON/HCURSOR the guest BUILT from bitmaps ----
  ;; ICON_TABLE remembers {module, resource}; CreateIconIndirect has neither.
  ;; It hands over an ICONINFO — a hotspot and one or two bitmaps — and games
  ;; that draw their own pointer (Heroes of Might and Magic II builds one per
  ;; interface mode) then SetCursor it. Keeping the ICONINFO is what lets the
  ;; AND/XOR planes be composited later; the constant handle this used to
  ;; return dropped the bitmaps on the floor and every cursor in the app
  ;; became the host's default arrow.

  ;; The live record behind a handle, or 0 for a handle we did not intern.
  (func $cursor_record (param $handle i32) (result i32)
    (local $slot i32) (local $p i32)
    (if (i32.ne (i32.and (local.get $handle) (i32.const 0xFFFF0000))
                (global.get $CURSOR_HANDLE_TAG))
      (then (return (i32.const 0))))
    (local.set $slot (i32.and (local.get $handle) (i32.const 0xFFFF)))
    (if (i32.or (i32.eqz (local.get $slot))
                (i32.gt_u (local.get $slot) (global.get $MAX_CURSORS)))
      (then (return (i32.const 0))))
    (local.set $p (i32.add (global.get $CURSOR_TABLE)
      (i32.mul (i32.sub (local.get $slot) (i32.const 1))
               (global.get $CURSOR_TABLE_STRIDE))))
    ;; A slot with no bitmaps is free, not an empty cursor.
    (if (i32.and (i32.eqz (i32.load offset=12 (local.get $p)))
                 (i32.eqz (i32.load offset=16 (local.get $p))))
      (then (return (i32.const 0))))
    (local.get $p))

  (func $cursor_intern (param $is_icon i32) (param $xhot i32) (param $yhot i32)
        (param $mask i32) (param $color i32) (result i32)
    (local $i i32) (local $p i32)
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (global.get $MAX_CURSORS)))
      (local.set $p (i32.add (global.get $CURSOR_TABLE)
        (i32.mul (local.get $i) (global.get $CURSOR_TABLE_STRIDE))))
      (if (i32.and (i32.eqz (i32.load offset=12 (local.get $p)))
                   (i32.eqz (i32.load offset=16 (local.get $p))))
        (then
          (i32.store (local.get $p) (local.get $is_icon))
          (i32.store offset=4 (local.get $p) (local.get $xhot))
          (i32.store offset=8 (local.get $p) (local.get $yhot))
          (i32.store offset=12 (local.get $p) (local.get $mask))
          (i32.store offset=16 (local.get $p) (local.get $color))
          (i32.store offset=20 (local.get $p) (i32.const 0))
          (return (i32.or (global.get $CURSOR_HANDLE_TAG)
            (i32.add (local.get $i) (i32.const 1))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (i32.const 0))

  ;; Materialize one plane from packed icon resource bytes. The bitmap owns
  ;; both its pixels and its palette, so the caller may unlock/free the source
  ;; resource immediately after CreateIconFromResourceEx returns.
  (func $cursor_resource_bitmap (param $width i32) (param $height i32)
        (param $bpp i32) (param $top_down i32) (param $stride i32)
        (param $palette i32) (param $palette_count i32) (param $pixels i32)
        (result i32)
    (memory.fill (global.get $GDI_BITMAP_PLAN) (i32.const 0) (i32.const 48))
    (i32.store (global.get $GDI_BITMAP_PLAN) (local.get $width))
    (i32.store offset=4 (global.get $GDI_BITMAP_PLAN) (local.get $height))
    (i32.store offset=8 (global.get $GDI_BITMAP_PLAN) (local.get $bpp))
    (i32.store offset=12 (global.get $GDI_BITMAP_PLAN)
      (i32.shl (local.get $top_down) (i32.const 1)))
    (i32.store offset=16 (global.get $GDI_BITMAP_PLAN) (local.get $stride))
    (i32.store offset=20 (global.get $GDI_BITMAP_PLAN) (local.get $palette))
    (i32.store offset=24 (global.get $GDI_BITMAP_PLAN) (local.get $palette_count))
    (i32.store offset=28 (global.get $GDI_BITMAP_PLAN) (local.get $pixels))
    (i32.store offset=32 (global.get $GDI_BITMAP_PLAN)
      (i32.mul (local.get $stride) (local.get $height)))
    (call $gdi_bitmap_create_owned (global.get $GDI_BITMAP_PLAN)
      (local.get $pixels) (i32.const 1) (i32.const 1)
      (i32.const 1) (i32.const 0) (i32.const 0))) ;; owned DIB orientation

  ;; Nearest-neighbour scaling for an owned icon plane. CreateIconFromResourceEx
  ;; is the size-selecting API, so cx/cy are observable through GetIconInfo and
  ;; SetCursor rather than advisory hints. Preserve indexed palettes while the
  ;; WAT raster path scales the canonical bitmap storage.
  (func $cursor_scale_bitmap (param $bitmap i32) (param $width i32)
        (param $height i32) (result i32)
    (local $record i32) (local $bpp i32) (local $stride i32)
    (local $scaled i32) (local $src i32) (local $dst i32)
    (local.set $record (call $gdi_object_record (local.get $bitmap)))
    (if (i32.eqz (call $gdi_bitmap_record_valid (local.get $record)))
      (then (return (i32.const 0))))
    (if (i32.and
          (i32.eq (load.field.memarg GdiBitmap width (local.get $record)) (local.get $width))
          (i32.eq (load.field.memarg GdiBitmap height (local.get $record)) (local.get $height)))
      (then (return (local.get $bitmap))))
    (if (i32.or (i32.le_s (local.get $width) (i32.const 0))
          (i32.or (i32.gt_s (local.get $width) (i32.const 256))
            (i32.or (i32.le_s (local.get $height) (i32.const 0))
              (i32.gt_s (local.get $height) (i32.const 512)))))
      (then
        (drop (call $gdi_object_delete_full (local.get $bitmap)))
        (return (i32.const 0))))
    (local.set $bpp (load.field.memarg GdiBitmap bpp (local.get $record)))
    (local.set $stride (i32.shl
      (i32.shr_u (i32.add (i32.mul (local.get $width) (local.get $bpp))
        (i32.const 31)) (i32.const 5)) (i32.const 2)))
    (memory.fill (global.get $GDI_BITMAP_PLAN) (i32.const 0) (i32.const 48))
    (i32.store (global.get $GDI_BITMAP_PLAN) (local.get $width))
    (i32.store offset=4 (global.get $GDI_BITMAP_PLAN) (local.get $height))
    (i32.store offset=8 (global.get $GDI_BITMAP_PLAN) (local.get $bpp))
    (i32.store offset=12 (global.get $GDI_BITMAP_PLAN)
      (i32.and (load.field.memarg GdiBitmap flags (local.get $record)) (i32.const 2)))
    (i32.store offset=16 (global.get $GDI_BITMAP_PLAN) (local.get $stride))
    (i32.store offset=20 (global.get $GDI_BITMAP_PLAN)
      (load.field.memarg GdiBitmap palette (local.get $record)))
    (i32.store offset=24 (global.get $GDI_BITMAP_PLAN)
      (load.field.memarg GdiBitmap palette_count (local.get $record)))
    (i32.store offset=32 (global.get $GDI_BITMAP_PLAN)
      (i32.mul (local.get $stride) (local.get $height)))
    (local.set $scaled (call $gdi_bitmap_create_owned (global.get $GDI_BITMAP_PLAN)
      (i32.const 0) (i32.const 0)
      (i32.ne (load.field.memarg GdiBitmap palette_count (local.get $record)) (i32.const 0))
      (i32.const 0) (i32.const 3) (i32.const 0)))
    (if (i32.eqz (local.get $scaled))
      (then
        (drop (call $gdi_object_delete_full (local.get $bitmap)))
        (return (i32.const 0))))
    (local.set $src (global.get $CURSOR_MASK_DESC))
    (local.set $dst (global.get $CURSOR_COLOR_DESC))
    (if (i32.or
          (i32.eqz (call $gdi_raster_desc_from_bitmap
            (local.get $bitmap) (local.get $src)))
          (i32.eqz (call $gdi_raster_desc_from_bitmap
            (local.get $scaled) (local.get $dst))))
      (then
        (drop (call $gdi_object_delete_full (local.get $scaled)))
        (drop (call $gdi_object_delete_full (local.get $bitmap)))
        (return (i32.const 0))))
    (if (i32.eqz (call $gdi_raster_stretch_blt
          (i32.const 0) (i32.const 0) (local.get $dst)
          (i32.const 0) (i32.const 0) (local.get $width) (local.get $height)
          (local.get $src) (i32.const 0) (i32.const 0)
          (load.field.memarg GdiBitmap width (local.get $record))
          (load.field.memarg GdiBitmap height (local.get $record))
          (i32.const 0) (i32.const 0x00CC0020)))
      (then
        (drop (call $gdi_object_delete_full (local.get $scaled)))
        (drop (call $gdi_object_delete_full (local.get $bitmap)))
        (return (i32.const 0))))
    (drop (call $gdi_object_delete_full (local.get $bitmap)))
    (local.get $scaled))

  ;; Decode one RT_ICON or RT_CURSOR image. RT_CURSOR begins with the Win9x
  ;; LOCALHEADER hotspot; both formats then carry a DIB whose stored height is
  ;; XOR+AND (twice the visible height). Only classic uncompressed DIB formats
  ;; are accepted here: those are the formats Win98 USER consumes natively.
  (func $cursor_create_from_resource (param $resource_ga i32) (param $size i32)
        (param $is_icon i32) (param $version i32) (param $want_w i32)
        (param $want_h i32) (param $flags i32) (result i32)
    (local $data i32) (local $dib_size i32) (local $header_size i32)
    (local $width i32) (local $stored_h i32) (local $height i32)
    (local $bpp i32) (local $top_down i32) (local $palette_count i32)
    (local $palette_bytes i32) (local $color_stride i32) (local $mask_stride i32)
    (local $color_bytes i32) (local $mask_bytes i32)
    (local $palette i32) (local $color_bits i32) (local $mask_bits i32)
    (local $mask i32) (local $color i32) (local $handle i32)
    (local $xhot i32) (local $yhot i32)
    (if (i32.or (i32.eqz (local.get $resource_ga))
          (i32.or (i32.lt_u (local.get $version) (i32.const 0x00020000))
            (i32.gt_u (local.get $version) (i32.const 0x00030000))))
      (then (return (i32.const 0))))
    (if (i32.eqz (local.get $is_icon))
      (then
        (if (i32.lt_u (local.get $size) (i32.const 16))
          (then (return (i32.const 0))))
        (local.set $xhot (call $gl16 (local.get $resource_ga)))
        (local.set $yhot (call $gl16
          (i32.add (local.get $resource_ga) (i32.const 2))))
        (local.set $resource_ga (i32.add (local.get $resource_ga) (i32.const 4)))
        (local.set $size (i32.sub (local.get $size) (i32.const 4)))))
    (if (i32.lt_u (local.get $size) (i32.const 12))
      (then (return (i32.const 0))))
    (local.set $data (call $g2w (local.get $resource_ga)))
    (local.set $dib_size (local.get $size))
    (local.set $header_size (i32.load (local.get $data)))
    (if (i32.eq (local.get $header_size) (i32.const 12))
      (then
        (local.set $width (i32.load16_u offset=4 (local.get $data)))
        (local.set $stored_h (i32.load16_u offset=6 (local.get $data)))
        (if (i32.ne (i32.load16_u offset=8 (local.get $data)) (i32.const 1))
          (then (return (i32.const 0))))
        (local.set $bpp (i32.load16_u offset=10 (local.get $data)))
        (if (i32.le_u (local.get $bpp) (i32.const 8))
          (then
            (local.set $palette_count
              (i32.shl (i32.const 1) (local.get $bpp)))
            (local.set $palette_bytes
              (i32.mul (local.get $palette_count) (i32.const 3))))))
      (else
        (if (i32.or (i32.lt_u (local.get $header_size) (i32.const 40))
              (i32.gt_u (local.get $header_size) (local.get $dib_size)))
          (then (return (i32.const 0))))
        (local.set $width (i32.load offset=4 (local.get $data)))
        (local.set $stored_h (i32.load offset=8 (local.get $data)))
        (if (i32.ne (i32.load16_u offset=12 (local.get $data)) (i32.const 1))
          (then (return (i32.const 0))))
        (local.set $bpp (i32.load16_u offset=14 (local.get $data)))
        (if (i32.ne (i32.load offset=16 (local.get $data)) (i32.const 0))
          (then (return (i32.const 0))))
        (local.set $top_down (i32.lt_s (local.get $stored_h) (i32.const 0)))
        (if (local.get $top_down)
          (then (local.set $stored_h
            (i32.sub (i32.const 0) (local.get $stored_h)))))
        (if (i32.le_u (local.get $bpp) (i32.const 8))
          (then
            (local.set $palette_count (i32.load offset=32 (local.get $data)))
            (if (i32.eqz (local.get $palette_count))
              (then (local.set $palette_count
                (i32.shl (i32.const 1) (local.get $bpp)))))
            (if (i32.gt_u (local.get $palette_count)
                  (i32.shl (i32.const 1) (local.get $bpp)))
              (then (return (i32.const 0))))
            (local.set $palette_bytes
              (i32.shl (local.get $palette_count) (i32.const 2)))))))
    (if (i32.or
          (i32.or (i32.le_s (local.get $width) (i32.const 0))
            (i32.gt_s (local.get $width) (i32.const 256)))
          (i32.or (i32.lt_u (local.get $stored_h) (i32.const 2))
            (i32.or (i32.and (local.get $stored_h) (i32.const 1))
              (i32.and
                (i32.and (i32.ne (local.get $bpp) (i32.const 1))
                  (i32.ne (local.get $bpp) (i32.const 4)))
                (i32.and (i32.ne (local.get $bpp) (i32.const 8))
                  (i32.and (i32.ne (local.get $bpp) (i32.const 24))
                    (i32.ne (local.get $bpp) (i32.const 32))))))))
      (then (return (i32.const 0))))
    (local.set $height (i32.shr_u (local.get $stored_h) (i32.const 1)))
    (if (i32.gt_s (local.get $height) (i32.const 256))
      (then (return (i32.const 0))))
    ;; A top-down monochrome resource would need its two planes reordered to
    ;; form Win32's single 2H mask bitmap. Such resources are not a Win9x icon
    ;; format, so reject instead of silently swapping AND and XOR.
    (if (i32.and (local.get $top_down) (i32.eq (local.get $bpp) (i32.const 1)))
      (then (return (i32.const 0))))
    (local.set $color_stride (i32.shl
      (i32.shr_u (i32.add (i32.mul (local.get $width) (local.get $bpp))
        (i32.const 31)) (i32.const 5)) (i32.const 2)))
    (local.set $mask_stride (i32.shl
      (i32.shr_u (i32.add (local.get $width) (i32.const 31))
        (i32.const 5)) (i32.const 2)))
    (local.set $color_bytes (i32.mul (local.get $color_stride) (local.get $height)))
    (local.set $mask_bytes (i32.mul (local.get $mask_stride) (local.get $height)))
    (if (i32.or
          (i32.gt_u (i32.add (local.get $header_size) (local.get $palette_bytes))
            (local.get $dib_size))
          (i32.gt_u (i32.add
              (i32.add (local.get $header_size) (local.get $palette_bytes))
              (i32.add (local.get $color_bytes) (local.get $mask_bytes)))
            (local.get $dib_size)))
      (then (return (i32.const 0))))
    (local.set $palette (i32.add (local.get $data) (local.get $header_size)))
    (local.set $color_bits (i32.add (local.get $palette) (local.get $palette_bytes)))
    (local.set $mask_bits (i32.add (local.get $color_bits) (local.get $color_bytes)))
    (if (i32.eq (local.get $bpp) (i32.const 1))
      (then
        ;; XOR bytes followed by AND bytes are already the memory layout of a
        ;; bottom-up monochrome ICONINFO mask whose logical height is 2H.
        (local.set $mask (call $cursor_resource_bitmap
          (local.get $width) (local.get $stored_h) (i32.const 1) (i32.const 0)
          (local.get $mask_stride) (i32.const 0) (i32.const 0)
          (local.get $color_bits))))
      (else
        (local.set $color (call $cursor_resource_bitmap
          (local.get $width) (local.get $height) (local.get $bpp)
          (local.get $top_down) (local.get $color_stride)
          (local.get $palette) (local.get $palette_count) (local.get $color_bits)))
        (if (local.get $color)
          (then (local.set $mask (call $cursor_resource_bitmap
            (local.get $width) (local.get $height) (i32.const 1)
            (local.get $top_down) (local.get $mask_stride)
            (i32.const 0) (i32.const 0) (local.get $mask_bits)))))))
    (if (i32.eqz (local.get $mask))
      (then
        (if (local.get $color)
          (then (drop (call $gdi_object_delete_full (local.get $color)))))
        (return (i32.const 0))))
    (if (i32.and (local.get $flags) (i32.const 0x40)) ;; LR_DEFAULTSIZE
      (then
        (if (i32.eqz (local.get $want_w)) (then (local.set $want_w (i32.const 32))))
        (if (i32.eqz (local.get $want_h)) (then (local.set $want_h (i32.const 32)))))
      (else
        (if (i32.eqz (local.get $want_w)) (then (local.set $want_w (local.get $width))))
        (if (i32.eqz (local.get $want_h)) (then (local.set $want_h (local.get $height))))))
    (if (i32.or (i32.le_s (local.get $want_w) (i32.const 0))
          (i32.or (i32.gt_s (local.get $want_w) (i32.const 256))
            (i32.or (i32.le_s (local.get $want_h) (i32.const 0))
              (i32.gt_s (local.get $want_h) (i32.const 256)))))
      (then
        (drop (call $gdi_object_delete_full (local.get $mask)))
        (if (local.get $color)
          (then (drop (call $gdi_object_delete_full (local.get $color)))))
        (return (i32.const 0))))
    (if (i32.eq (local.get $bpp) (i32.const 1))
      (then (local.set $mask (call $cursor_scale_bitmap
        (local.get $mask) (local.get $want_w)
        (i32.shl (local.get $want_h) (i32.const 1)))))
      (else
        (local.set $color (call $cursor_scale_bitmap
          (local.get $color) (local.get $want_w) (local.get $want_h)))
        (if (local.get $color)
          (then (local.set $mask (call $cursor_scale_bitmap
            (local.get $mask) (local.get $want_w) (local.get $want_h)))))))
    (if (i32.or (i32.eqz (local.get $mask))
          (i32.and (i32.ne (local.get $bpp) (i32.const 1))
            (i32.eqz (local.get $color))))
      (then
        (if (local.get $mask)
          (then (drop (call $gdi_object_delete_full (local.get $mask)))))
        (if (local.get $color)
          (then (drop (call $gdi_object_delete_full (local.get $color)))))
        (return (i32.const 0))))
    (if (local.get $is_icon)
      (then
        (local.set $xhot (i32.shr_u (local.get $want_w) (i32.const 1)))
        (local.set $yhot (i32.shr_u (local.get $want_h) (i32.const 1))))
      (else
        (local.set $xhot (i32.div_u
          (i32.mul (local.get $xhot) (local.get $want_w)) (local.get $width)))
        (local.set $yhot (i32.div_u
          (i32.mul (local.get $yhot) (local.get $want_h)) (local.get $height)))))
    (local.set $handle (call $cursor_intern (local.get $is_icon)
      (local.get $xhot) (local.get $yhot) (local.get $mask) (local.get $color)))
    (if (i32.eqz (local.get $handle))
      (then
        (drop (call $gdi_object_delete_full (local.get $mask)))
        (if (local.get $color)
          (then (drop (call $gdi_object_delete_full (local.get $color)))))))
    (local.get $handle))

  (func $cursor_width (param $rec i32) (result i32)
    (call $gdi_bitmap_record_width
      (call $gdi_object_record (i32.load offset=12 (local.get $rec)))))

  ;; A monochrome cursor's mask bitmap holds both planes stacked: the AND rows
  ;; on top and the XOR rows below, so the picture is half as tall as it is.
  ;; With a colour plane the mask is the AND rows alone.
  (func $cursor_height (param $rec i32) (result i32)
    (if (i32.load offset=16 (local.get $rec))
      (then (return (call $gdi_bitmap_record_height
        (call $gdi_object_record (i32.load offset=16 (local.get $rec)))))))
    (i32.shr_u (call $gdi_bitmap_record_height
      (call $gdi_object_record (i32.load offset=12 (local.get $rec))))
      (i32.const 1)))

  ;; Which raster row holds picture row $row of a cursor plane.
  ;;
  ;; CreateBitmap's scanlines run top-down — that is what MSDN documents for a
  ;; DDB and what every app building a cursor mask writes — but a plain DDB is
  ;; planned here with no top-down flag, so the raster layer reads it back
  ;; bottom-up and hands out the picture mirrored. Undo that here rather than
  ;; in the raster layer, where it would move every existing blit. A real DIB
  ;; carries its own orientation and is already right.
  (func $cursor_plane_row (param $hbm i32) (param $desc i32) (param $row i32)
        (result i32)
    (local $rec i32)
    (if (i32.load offset=20 (local.get $desc)) (then (return (local.get $row))))
    (local.set $rec (call $gdi_object_record (local.get $hbm)))
    (if (i32.eqz (local.get $rec)) (then (return (local.get $row))))
    (if (i32.and (load.field.memarg GdiBitmap flags (local.get $rec)) (i32.const 1))
      (then (return (local.get $row))))
    (i32.sub (i32.sub (i32.load offset=8 (local.get $desc)) (i32.const 1))
             (local.get $row)))

  ;; Composite the ICONINFO planes into width*height premultiplied BGRA rows,
  ;; top-down, at $dst. Win32's four AND/XOR combinations are: opaque black,
  ;; opaque white, transparent, and invert-the-screen. Nothing on a web page
  ;; can XOR the desktop, so an invert pixel is drawn black — that is what the
  ;; outline strokes of a monochrome pointer are made of, and dropping them
  ;; would leave a shape with no edge.
  (func $cursor_rasterize (param $rec i32) (param $dst i32) (result i32)
    (local $w i32) (local $h i32) (local $x i32) (local $y i32)
    (local $mask i32) (local $color i32) (local $and i32) (local $xor i32)
    (local $rgb i32) (local $p i32) (local $alpha i32)
    (local.set $w (call $cursor_width (local.get $rec)))
    (local.set $h (call $cursor_height (local.get $rec)))
    (if (i32.or (i32.le_s (local.get $w) (i32.const 0))
                (i32.le_s (local.get $h) (i32.const 0)))
      (then (return (i32.const 0))))
    (local.set $mask (global.get $CURSOR_MASK_DESC))
    (if (i32.eqz (call $gdi_raster_desc_from_bitmap
          (i32.load offset=12 (local.get $rec)) (local.get $mask)))
      (then (return (i32.const 0))))
    (if (i32.load offset=16 (local.get $rec))
      (then
        (local.set $color (global.get $CURSOR_COLOR_DESC))
        (if (i32.eqz (call $gdi_raster_desc_from_bitmap
              (i32.load offset=16 (local.get $rec)) (local.get $color)))
          (then (return (i32.const 0))))))
    (local.set $y (i32.const 0))
    (block $rows_done (loop $rows
      (br_if $rows_done (i32.ge_s (local.get $y) (local.get $h)))
      (local.set $x (i32.const 0))
      (block $cols_done (loop $cols
        (br_if $cols_done (i32.ge_s (local.get $x) (local.get $w)))
        ;; A mask read that fails reads as "transparent" rather than as a
        ;; black pixel: a truncated mask must not paint a block of ink.
        (local.set $and (call $gdi_raster_read_index
          (local.get $mask) (local.get $x)
          (call $cursor_plane_row (i32.load offset=12 (local.get $rec))
            (local.get $mask) (local.get $y))))
        (if (i32.lt_s (local.get $and) (i32.const 0))
          (then (local.set $and (i32.const 1))))
        (local.set $alpha (i32.const 255))
        (local.set $rgb (i32.const 0))
        (if (local.get $color)
          (then
            (if (local.get $and)
              (then (local.set $alpha (i32.const 0)))
              (else
                (local.set $rgb (call $gdi_raster_read
                  (local.get $color) (local.get $x)
                  (call $cursor_plane_row (i32.load offset=16 (local.get $rec))
                    (local.get $color) (local.get $y))))
                (if (i32.lt_s (local.get $rgb) (i32.const 0))
                  (then (local.set $rgb (i32.const 0)))))))
          (else
            (local.set $xor (call $gdi_raster_read_index (local.get $mask)
              (local.get $x)
              (call $cursor_plane_row (i32.load offset=12 (local.get $rec))
                (local.get $mask) (i32.add (local.get $y) (local.get $h)))))
            (if (i32.lt_s (local.get $xor) (i32.const 0))
              (then (local.set $xor (i32.const 0))))
            (if (local.get $and)
              (then
                ;; AND=1: leave the screen alone (XOR=0) or invert it (XOR=1).
                (if (i32.eqz (local.get $xor))
                  (then (local.set $alpha (i32.const 0)))))
              (else
                (if (local.get $xor)
                  (then (local.set $rgb (i32.const 0xFFFFFF))))))))
        (local.set $p (i32.add (local.get $dst)
          (i32.shl (i32.add (i32.mul (local.get $y) (local.get $w))
                            (local.get $x)) (i32.const 2))))
        (if (local.get $alpha)
          (then
            (i32.store8 (local.get $p) (local.get $rgb))                       ;; B
            (i32.store8 offset=1 (local.get $p)
              (i32.shr_u (local.get $rgb) (i32.const 8)))                      ;; G
            (i32.store8 offset=2 (local.get $p)
              (i32.shr_u (local.get $rgb) (i32.const 16)))                     ;; R
            (i32.store8 offset=3 (local.get $p) (i32.const 255)))
          (else (i32.store (local.get $p) (i32.const 0))))
        (local.set $x (i32.add (local.get $x) (i32.const 1)))
        (br $cols)))
      (local.set $y (i32.add (local.get $y) (i32.const 1)))
      (br $rows)))
    (i32.const 1))

  ;; Present an interned cursor. Returns 0 for any handle we did not intern,
  ;; leaving the IDC_*/resource path in host_set_cursor untouched.
  (func $cursor_push (param $handle i32) (result i32)
    (local $rec i32) (local $w i32) (local $h i32) (local $ga i32) (local $wa i32)
    (local.set $rec (call $cursor_record (local.get $handle)))
    (if (i32.eqz (local.get $rec)) (then (return (i32.const 0))))
    (local.set $w (call $cursor_width (local.get $rec)))
    (local.set $h (call $cursor_height (local.get $rec)))
    (if (i32.or (i32.le_s (local.get $w) (i32.const 0))
                (i32.le_s (local.get $h) (i32.const 0)))
      (then (return (i32.const 0))))
    ;; Already composited once: the host keeps the picture under this handle.
    (if (i32.load offset=20 (local.get $rec))
      (then
        (call $host_set_cursor_image (local.get $handle)
          (local.get $w) (local.get $h)
          (i32.load offset=4 (local.get $rec)) (i32.load offset=8 (local.get $rec))
          (i32.const 0))
        (return (i32.const 1))))
    (local.set $ga (call $dib_alloc
      (i32.shl (i32.mul (local.get $w) (local.get $h)) (i32.const 2))))
    (if (i32.eqz (local.get $ga)) (then (return (i32.const 0))))
    (local.set $wa (call $g2w (local.get $ga)))
    (if (i32.eqz (call $cursor_rasterize (local.get $rec) (local.get $wa)))
      (then
        (call $dib_free_wasm (local.get $wa))
        (return (i32.const 0))))
    (call $host_set_cursor_image (local.get $handle)
      (local.get $w) (local.get $h)
      (i32.load offset=4 (local.get $rec)) (i32.load offset=8 (local.get $rec))
      (local.get $wa))
    (call $dib_free_wasm (local.get $wa))
    (i32.store offset=20 (local.get $rec) (i32.const 1))
    (i32.const 1))

  ;; Release a built icon/cursor. The bitmaps are ours — CreateIconIndirect
  ;; copies what the caller passed, exactly as Win32 does, so the app is free
  ;; to delete its originals the moment it returns.
  (func $cursor_destroy (param $handle i32) (result i32)
    (local $rec i32)
    (local.set $rec (call $cursor_record (local.get $handle)))
    (if (i32.eqz (local.get $rec)) (then (return (i32.const 0))))
    (if (i32.load offset=12 (local.get $rec))
      (then (drop (call $gdi_object_delete_full (i32.load offset=12 (local.get $rec))))))
    (if (i32.load offset=16 (local.get $rec))
      (then (drop (call $gdi_object_delete_full (i32.load offset=16 (local.get $rec))))))
    (memory.fill (local.get $rec) (i32.const 0) (global.get $CURSOR_TABLE_STRIDE))
    (i32.const 1))

  ;; 109: LoadIconA(hInstance, lpIconName)
  (func $handle_LoadIconA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; Named (string-pointer) icon resources are not interned: the resource
    ;; walker addresses RT_GROUP_ICON by ordinal. Those keep the old opaque
    ;; handle rather than a slot that would decode to the wrong picture.
    (if (i32.and (i32.ne (local.get $arg0) (i32.const 0))
                 (i32.le_u (local.get $arg1) (i32.const 0xFFFF)))
      (then
        (global.set $eax (call $icon_intern (local.get $arg0) (local.get $arg1)))
        (if (global.get $eax)
          (then (global.set $esp (i32.add (global.get $esp) (i32.const 12)))
                (return)))))
    (global.set $eax (i32.const 0x60001)) ;; opaque HICON, no pixels
    (global.set $esp (i32.add (global.get $esp) (i32.const 12)))
  )

  ;; 110: LoadStringA
  (func $handle_LoadStringA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; RT_STRING walker lives in WAT — see $string_load_a in 10-helpers.wat.
    ;; arg0 = hInstance — may be a satellite DLL (e.g. MCM's lang.dll). Route
    ;; the resource lookup to that module for the duration of the call.
    (call $push_rsrc_ctx (local.get $arg0))
    (global.set $eax (call $string_load_a
      (local.get $arg1)                ;; string ID
      (call $g2w (local.get $arg2))    ;; buffer (WASM ptr)
      (local.get $arg3)))              ;; max chars
    (call $pop_rsrc_ctx)
    (global.set $esp (i32.add (global.get $esp) (i32.const 20))) (return)
  )

  ;; 111: LoadAcceleratorsA(hInstance, lpTableName). Each distinct resource
  ;; receives a real repository handle; a miss returns NULL rather than the old
  ;; unconditional fixed handle.
  (func $handle_LoadAcceleratorsA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $data i32)
    (call $push_rsrc_ctx (local.get $arg0))
    (local.set $data (call $rsrc_find_data_wa (i32.const 9) (local.get $arg1)))
    (call $pop_rsrc_ctx)
    (global.set $eax (call $accel_table_load
      (local.get $data) (i32.div_u (global.get $rsrc_last_size) (i32.const 8))))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12))) (return)
  )

  ;; 112: EnableWindow
  ;; EnableWindow(hWnd, bEnable) returns nonzero only when the window was
  ;; previously disabled. COMCTL32's modal PropertySheet loop relies on that
  ;; exact Win32 contract: it remembers the owner only when its own disable
  ;; changed state, then re-enables the owner after destroying the sheet.
  (func $handle_EnableWindow (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $idx i32) (local $style i32) (local $new_style i32) (local $prev_disabled i32)
    (local.set $idx (call $wnd_table_find (local.get $arg0)))
    (if (i32.eq (local.get $idx) (i32.const -1))
      (then
        (global.set $eax (i32.const 0))
        (global.set $esp (i32.add (global.get $esp) (i32.const 12)))
        (return)))
    (local.set $style (call $wnd_get_style (local.get $arg0)))
    (local.set $prev_disabled
      (i32.ne
        (i32.and (local.get $style) (i32.const 0x08000000))
        (i32.const 0)))
    (if (local.get $arg1)
      (then
        (local.set $new_style
          (i32.and (local.get $style) (i32.const 0xF7FFFFFF))))
      (else
        (local.set $new_style
          (i32.or (local.get $style) (i32.const 0x08000000)))))
    (if (i32.ne (local.get $new_style) (local.get $style))
      (then
        (drop (call $wnd_set_style (local.get $arg0) (local.get $new_style)))
        ;; WM_ENABLE(wParam=bEnable). Most built-in controls ignore it, but
        ;; owner/subclassed windows may rely on the notification.
        (drop (call $wnd_send_message
          (local.get $arg0) (i32.const 0x000A)
          (select (i32.const 1) (i32.const 0) (local.get $arg1))
          (i32.const 0)))
        (call $invalidate_hwnd (local.get $arg0))))
    (global.set $eax (local.get $prev_disabled))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12)))  ;; stdcall, 2 args
  )

;; 114: EndDialog(hDlg, nResult) — end modal dialog, set result
  (func $handle_EndDialog (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $deferred i32)
    ;; MFC also calls EndDialog on dialogs created through CreateDialogParamA.
    ;; Those modeless dialogs have no CACA0004 pump, so do not poison the
    ;; global modal-completion flags unless this hwnd is the active modal.
    ;; Both tests read the shared mirrors, not this instance's own
    ;; $dlg_pump_hwnd/$dlg_ended: the pump lives on main, and an NSIS installer
    ;; calls EndDialog from its extraction thread, whose private copies are 0.
    ;;
    ;; First EndDialog wins. Real USER only records the result and lets the
    ;; DialogBox loop destroy the window once the DLGPROC has returned, so the
    ;; WM_DESTROY the app then sees is delivered *after* the result has been
    ;; read. We destroy inline, so a DLGPROC that calls EndDialog again from
    ;; its own WM_DESTROY (Disk Cleanup answers WM_DESTROY with
    ;; EndDialog(hDlg, IDCANCEL)) would otherwise overwrite the IDOK the user
    ;; actually chose, and the caller would take the cancel path and exit.
    (if (i32.and
          (i32.and
            (i32.ne (i32.load (global.get $SHARED_DLG_PUMP_HWND)) (i32.const 0))
            (i32.eq (local.get $arg0) (i32.load (global.get $SHARED_DLG_PUMP_HWND))))
          (i32.eqz (i32.load (global.get $SHARED_DLG_ENDED))))
      (then
        (global.set $dlg_ended (i32.const 1))
        (global.set $dlg_result (local.get $arg1))
        (i32.store (global.get $SHARED_DLG_ENDED) (i32.const 1))
        (i32.store (global.get $SHARED_DLG_RESULT) (local.get $arg1))
        ;; CACA0004 checks dlg_ended to exit Wine Assembly's own modal pump.
        ;; A modeless/native dialog loop must finish its synchronous call stack
        ;; instead; yielding here strands Storm's SDlgDialogBoxParam before it
        ;; can observe SDlg_EndDialog and return the selected class.
        (global.set $yield_flag (i32.const 1))
        ;; This dialog belongs to our own modal pump, and CACA0004 tears it
        ;; down the moment the DLGPROC returns. Leave the window standing
        ;; until then, exactly as USER does: EndDialog only records the
        ;; result. A DLGPROC routinely keeps using its own controls after
        ;; calling EndDialog -- the DirectX SDK's bellhop reads the service
        ;; provider combo's item data back with SendDlgItemMessage(CB_
        ;; GETITEMDATA) in a `while (data != CB_ERR)` free loop right after
        ;; EndDialog(hDlg, 1). Destroying the controls here makes every one
        ;; of those calls answer 0 instead of CB_ERR, so the loop never ends
        ;; and the run dies with the host log buffer eating all of the JS
        ;; heap.
        (local.set $deferred (i32.const 1))))
    ;; Remove the visible frame here, even for DialogBoxParamA. Renderer-side
    ;; WAT dialog routing can call EndDialog synchronously while the guest is
    ;; between modal-pump turns; waiting for the pump leaves the dialog stuck
    ;; on screen. Use the normal recursive destruction path so the dialog and
    ;; its children receive WM_DESTROY/WM_NCDESTROY and dead focus/capture is
    ;; cleared. Storm's SDlgEndDialog relies on that lifecycle to advance from
    ;; Diablo's modeless class picker. The pump cleanup path below is guarded
    ;; for already-removed dialogs.
    (if (i32.and
          (i32.eqz (local.get $deferred))
          (i32.and
            (i32.ne (call $wnd_table_get (local.get $arg0)) (i32.const 0))
            (i32.ne (local.get $arg0) (global.get $dlg_ending_hwnd))))
      (then
        (global.set $dlg_ending_hwnd (local.get $arg0))
        (call $wnd_destroy_recursive (local.get $arg0))
        (global.set $dlg_ending_hwnd (i32.const 0))))
    ;; Don't set quit_flag — that kills the main message loop.
    ;; CACA0004 checks dlg_ended to exit the modal loop.
    (global.set $eax (i32.const 1))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12)))  ;; stdcall, 2 args
  )

  ;; 115: InvalidateRect(hwnd, lprc, bErase). lprc=NULL → full client rect.
  (func $handle_InvalidateRect (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $l i32) (local $t i32) (local $r i32) (local $b i32) (local $wa i32) (local $cs i32)
    (if (i32.eqz (local.get $arg0))
      (then
        (global.set $eax (i32.const 1))
        (global.set $esp (i32.add (global.get $esp) (i32.const 16))) (return)))
    (if (local.get $arg1)
      (then
        (local.set $wa (call $g2w (local.get $arg1)))
        (local.set $l (load.field Rect left (local.get $wa)))
        (local.set $t (load.field.memarg Rect top (local.get $wa)))
        (local.set $r (load.field.memarg Rect right (local.get $wa)))
        (local.set $b (load.field.memarg Rect bottom (local.get $wa))))
      (else
        (local.set $cs (call $host_get_window_client_size (local.get $arg0)))
        (local.set $l (i32.const 0)) (local.set $t (i32.const 0))
        (local.set $r (i32.and (local.get $cs) (i32.const 0xFFFF)))
        (local.set $b (i32.shr_u (local.get $cs) (i32.const 16)))))
    (call $update_invalidate_rect (local.get $arg0) (local.get $l) (local.get $t) (local.get $r) (local.get $b))
    ;; bErase is deliberately not turned into a queued WM_ERASEBKGND here.
    ;; Windows erases from inside BeginPaint, in the same breath as the paint;
    ;; a separately queued erase arrives whenever the pump gets to it, and Hearts
    ;; draws a dealt hand with its own DC outside WM_PAINT -- so the erase landed
    ;; after the cards and wiped four of them off the table. See $handle_BeginPaint
    ;; for where the background is decided instead.
    ;;
    ;; Win32 bErase is still recorded, because BeginPaint has to report it back
    ;; as ps.fErase: an app that asked for an erase and has no class brush is
    ;; the app that paints its own background. bErase = FALSE never clears a
    ;; pending erase -- the flag accumulates until a paint consumes it.
    ;;
    ;; Keep Win16 on its historical USER path. Windows 3.x games including
    ;; Klotski use InvalidateRect(TRUE) as a continuous redraw request while
    ;; also painting with window DCs outside BeginPaint. Turning every request
    ;; into a new queued erase wipes that artwork once per pump iteration.
    (if (i32.and
          (i32.eqz (global.get $code16))
          (local.get $arg2))
      (then (call $nc_flags_set (local.get $arg0) (i32.const 2))))
    (if (i32.eq (local.get $arg0) (global.get $main_hwnd))
      (then (global.set $paint_pending (i32.const 1)))
      (else (call $paint_flag_set (local.get $arg0))))
    (call $host_invalidate (local.get $arg0))
    (global.set $eax (i32.const 1))
    (global.set $esp (i32.add (global.get $esp) (i32.const 16))) (return)
  )

  ;; 116: FillRect(hdc, lprc, hbr)
  (func $handle_FillRect (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $desc i32) (local $rc i32)
    (local.set $desc (global.get $GDI_LINE_DESC))
    (local.set $rc (call $g2w (local.get $arg1)))
    (if (call $gdi_surface_descriptor (local.get $arg0) (local.get $desc))
      (then (global.set $eax (call $gdi_fill_rect_desc
        (local.get $arg0) (local.get $desc)
        (load.field Rect left (local.get $rc)) (load.field.memarg Rect top (local.get $rc))
        (load.field.memarg Rect right (local.get $rc)) (load.field.memarg Rect bottom (local.get $rc))
        (local.get $arg2))))
      (else (global.set $eax (i32.const 0))))
    (global.set $esp (i32.add (global.get $esp) (i32.const 16)))
  )

  ;; 117: FrameRect(hdc, lprc, hbr) — draw 1px frame using brush
  (func $handle_FrameRect (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $wa i32) (local $desc i32)
    (local.set $wa (call $g2w (local.get $arg1)))
    (local.set $desc (global.get $GDI_LINE_DESC))
    (if (call $gdi_surface_descriptor (local.get $arg0) (local.get $desc))
      (then (global.set $eax (call $gdi_frame_rect_desc
        (local.get $arg0) (local.get $desc)
        (load.field Rect left (local.get $wa)) (load.field.memarg Rect top (local.get $wa))
        (load.field.memarg Rect right (local.get $wa)) (load.field.memarg Rect bottom (local.get $wa))
        (local.get $arg2))))
      (else (global.set $eax (i32.const 0))))
    (global.set $esp (i32.add (global.get $esp) (i32.const 16)))  ;; stdcall, 3 args
  )

  ;; 118: LoadBitmapA
  (func $handle_LoadBitmapA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $gdi_bitmap_load_resource
      (local.get $arg0) (local.get $arg1) (i32.const 0)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12))) (return)
  )

  ;; Restore and activate an iconic window. OpenIcon is not just a spelling of
  ;; ShowWindow(SW_RESTORE): USER first gives the wndproc a synchronous
  ;; WM_QUERYOPEN veto. WAT-native top-levels have no application override, so
  ;; their zero result means "use the default TRUE"; an x86 wndproc's zero is
  ;; an intentional veto unless it is a dialog that declined the message.
  (func $open_icon_core (param $hwnd i32) (result i32)
    (local $wp i32) (local $query i32) (local $top i32)
    (if (i32.lt_s (call $wnd_table_find (local.get $hwnd)) (i32.const 0))
      (then
        (global.set $last_error (i32.const 1400)) ;; ERROR_INVALID_WINDOW_HANDLE
        (return (i32.const 0))))
    (if (i32.eqz (call $wnd_min_get (local.get $hwnd)))
      (then (return (i32.const 0))))
    (local.set $wp (call $wnd_table_get (local.get $hwnd)))
    (local.set $query
      (call $wnd_send_message
        (local.get $hwnd) (i32.const 0x0013) ;; WM_QUERYOPEN
        (i32.const 0) (i32.const 0)))
    (if (i32.and
          (i32.eqz (local.get $query))
          (i32.or
            (i32.lt_u (local.get $wp) (i32.const 0xFFFF0000))
            (i32.and
              (i32.eq (local.get $wp) (global.get $WNDPROC_DIALOG))
              (global.get $dialog_last_proc_handled))))
      (then (return (i32.const 0))))

    (call $host_sys_command (local.get $hwnd) (i32.const 0xF120)) ;; SC_RESTORE
    (call $wnd_apply_show_state (local.get $hwnd) (i32.const 9)) ;; SW_RESTORE
    (call $post_resize_messages (local.get $hwnd)
      (select (i32.const 2) (i32.const 0) (call $wnd_max_get (local.get $hwnd))))
    (call $paint_flag_set_inv (local.get $hwnd))
    (call $nc_flags_set (local.get $hwnd) (i32.const 4))
    (local.set $top (call $wnd_top_level (local.get $hwnd)))
    (if (i32.and
          (i32.ge_s (call $wnd_table_find (local.get $top)) (i32.const 0))
          (i32.eq (call $wnd_get_thread (local.get $top)) (global.get $current_thread_id)))
      (then (drop (call $active_window_transition (local.get $top)))))
    (drop (call $host_activate_window (local.get $hwnd)))
    (i32.const 1))

  ;; 119: OpenIcon(hwnd) — restores a minimized window; return nonzero.
  (func $handle_OpenIcon (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $open_icon_core (local.get $arg0)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8)))
  )

  ;; Pack an HWND's current window origin. Child coordinates are parent-client
  ;; relative; top-level coordinates come from the renderer-owned window rect.
  (func $window_xy_packed (param $hwnd i32) (result i32)
    (if (i32.ne
          (i32.and (call $wnd_get_style (local.get $hwnd)) (i32.const 0x40000000))
          (i32.const 0))
      (then (return (call $ctrl_get_xy_packed (local.get $hwnd)))))
    (call $host_get_window_rect (local.get $hwnd) (global.get $WINDOW_RECT_SCRATCH))
    (i32.or
      (i32.and (i32.load (global.get $WINDOW_RECT_SCRATCH)) (i32.const 0xFFFF))
      (i32.shl
        (i32.and (i32.load offset=4 (global.get $WINDOW_RECT_SCRATCH)) (i32.const 0xFFFF))
        (i32.const 16))))

  ;; 120: MoveWindow — hwnd(arg0), x(arg1), y(arg2), w(arg3), h(arg4), bRepaint=[esp+24]
  ;; MoveWindow is SetWindowPos without z-order/activation changes. A false
  ;; bRepaint maps to SWP_NOREDRAW and suppresses update-region creation.
  ;; A same-size MoveWindow is marked SWP_NOSIZE before WM_WINDOWPOSCHANGED, so
  ;; DefWindowProc does not send another WM_SIZE. Some applications enforce an
  ;; aspect ratio from WM_SIZE by calling MoveWindow with the dimensions they
  ;; already have; repeating the message would recurse forever.
  (func $handle_MoveWindow (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $cx i32) (local $cy i32) (local $cs i32) (local $old_cs i32) (local $dlg_rec i32)
    (local $x i32) (local $y i32) (local $old_xy i32) (local $new_xy i32)
    (local $flags i32) (local $original_flags i32) (local $repaint i32)
    (local $insert_after i32) (local $windowpos i32)
    (local.set $x (local.get $arg1))
    (local.set $y (local.get $arg2))
    (local.set $cx (local.get $arg3))
    (local.set $cy (local.get $arg4))
    (local.set $repaint (call $gl32 (i32.add (global.get $esp) (i32.const 24))))
    (local.set $flags (i32.const 0x0014)) ;; SWP_NOZORDER | SWP_NOACTIVATE
    (if (i32.eqz (local.get $repaint))
      (then (local.set $flags (i32.or (local.get $flags) (i32.const 0x0008))))) ;; SWP_NOREDRAW
    (global.set $esp (i32.add (global.get $esp) (i32.const 28)))
    (local.set $original_flags (local.get $flags))
    (local.set $windowpos (call $windowpos_message_begin
      (local.get $arg0) (local.get $insert_after)
      (local.get $x) (local.get $y) (local.get $cx) (local.get $cy)
      (local.get $flags)))
    (if (local.get $windowpos)
      (then
        (local.set $insert_after
          (call $gl32 (i32.add (local.get $windowpos) (i32.const 4))))
        (local.set $x
          (call $gl32 (i32.add (local.get $windowpos) (i32.const 8))))
        (local.set $y
          (call $gl32 (i32.add (local.get $windowpos) (i32.const 12))))
        (local.set $cx
          (call $gl32 (i32.add (local.get $windowpos) (i32.const 16))))
        (local.set $cy
          (call $gl32 (i32.add (local.get $windowpos) (i32.const 20))))
        (local.set $flags
          (i32.or
            (i32.and
              (call $gl32 (i32.add (local.get $windowpos) (i32.const 24)))
              (i32.const 0xFFFFFDEF))
            (i32.and (local.get $original_flags) (i32.const 0x00000210))))
        (if (i32.lt_s (call $wnd_table_find (local.get $arg0)) (i32.const 0))
          (then
            (call $windowpos_message_cancel (local.get $windowpos))
            (global.set $last_error (i32.const 1400))
            (global.set $eax (i32.const 0))
            (return)))))
    (local.set $repaint
      (i32.eqz (i32.and (local.get $flags) (i32.const 0x0008))))
    (local.set $old_cs (call $host_get_window_client_size (local.get $arg0)))
    (local.set $old_xy (call $window_xy_packed (local.get $arg0)))
    (call $host_move_window (local.get $arg0) (local.get $x) (local.get $y)
      (local.get $cx) (local.get $cy) (local.get $flags))
    (call $ctrl_geom_sync (local.get $arg0) (local.get $x) (local.get $y)
      (local.get $cx) (local.get $cy) (local.get $flags))
    (call $defwndproc_do_nccalcsize (local.get $arg0))
    (call $host_sync_window_client
      (local.get $arg0)
      (call $wnd_client_screen_x (local.get $arg0))
      (call $wnd_client_screen_y (local.get $arg0))
      (i32.sub (call $client_rect_get_r (local.get $arg0)) (call $client_rect_get_l (local.get $arg0)))
      (i32.sub (call $client_rect_get_b (local.get $arg0)) (call $client_rect_get_t (local.get $arg0))))
    ;; A window DC may outlive the geometry it was acquired under. Visual
    ;; Basic picture boxes retain a DC while the control grows from its 1x1
    ;; creation fallback to its authored size, so rebuild USER-visible clips
    ;; after a real client-size transition.
    (local.set $cs (call $host_get_window_client_size (local.get $arg0)))
    (local.set $new_xy (call $window_xy_packed (local.get $arg0)))
    (if (i32.eq (local.get $old_xy) (local.get $new_xy))
      (then (local.set $flags (i32.or (local.get $flags) (i32.const 2)))))
    (if (i32.eq (local.get $old_cs) (local.get $cs))
      (then (local.set $flags (i32.or (local.get $flags) (i32.const 1)))))
    (if (i32.ne (local.get $cs) (local.get $old_cs))
      (then (call $gdi_refresh_window_dc_system_clips)))
    (call $windowpos_message_update
      (local.get $windowpos) (local.get $arg0) (local.get $insert_after)
      (local.get $x) (local.get $y) (local.get $cx) (local.get $cy)
      (local.get $flags))
    (call $windowpos_message_end (local.get $windowpos) (local.get $arg0))
    (local.set $dlg_rec (call $dlg_record_for_hwnd (local.get $arg0)))
    (if (i32.and
          (i32.and
            (i32.ne (local.get $dlg_rec) (i32.const 0))
            (i32.ne (i32.load offset=4 (local.get $dlg_rec)) (i32.const 0)))
          (i32.lt_s (call $wnd_get_class_slot (local.get $arg0)) (i32.const 0)))
      (then
        (if (local.get $repaint)
          (then (drop (call $host_erase_background (local.get $arg0) (i32.const 16)))))))
    ;; If the main window is moved/resized before its first ShowWindow, refresh
    ;; the pending WM_SIZE that was seeded during CreateWindowExA. EmPipe does
    ;; exactly this; using the stale 0x0 create size moves its controls offscreen.
    (if (i32.eq (local.get $arg0) (global.get $main_hwnd))
    (then
	      (if (i32.ne (local.get $cs) (local.get $old_cs))
	        (then
	          (global.set $pending_wm_size (local.get $cs))
	          (if (local.get $repaint)
	            (then (call $invalidate_hwnd (local.get $arg0)))))))
	    (else
	      (if (i32.ne (local.get $cs) (local.get $old_cs))
	        (then
	          (if (local.get $repaint)
	            (then (call $invalidate_hwnd (local.get $arg0))))
              ;; A child that grew covers parent pixels it has never erased. It
              ;; owns no surface of its own, so whatever the parent left there
              ;; stays until something fills it -- Solitaire's score bar is
              ;; WHITE_BRUSH-classed and draws its text opaquely, so after the
              ;; main window widened, the widened part of the bar stayed the
              ;; grey the reallocated back-canvas came with. Queue the erase the
              ;; way USER's invalidate-on-resize does.
              (if (local.get $repaint)
                (then (call $nc_flags_set (local.get $arg0) (i32.const 2))))))))
    (global.set $eax (i32.const 1))
    (return)
  )

 123: CheckRadioButton(hDlg, firstId, lastId, checkId) — clear all in
  ;; [firstId,lastId] and set checkId. Pure WAT path now that ButtonState
  ;; bit 1 is the source of truth.
  (func $handle_CheckRadioButton (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $id i32) (local $ctrl i32)
    (local.set $id (local.get $arg1))
    (block $done (loop $scan
      (br_if $done (i32.gt_u (local.get $id) (local.get $arg2)))
      (local.set $ctrl (call $ctrl_find_by_id (local.get $arg0) (local.get $id)))
      (if (local.get $ctrl)
        (then
          ;; Drive the real BUTTON message path so ButtonState.flags,
          ;; CONTROL_TABLE fallback state, invalidation, and immediate repaint
          ;; stay in sync. Calc relies on CheckRadioButton after BN_CLICKED.
          (drop (call $wnd_send_message
            (local.get $ctrl)
            (i32.const 0x00F1) ;; BM_SETCHECK
            (select (i32.const 1) (i32.const 0)
              (i32.eq (local.get $id) (local.get $arg3)))
            (i32.const 0)))))
      (local.set $id (i32.add (local.get $id) (i32.const 1)))
      (br $scan)))
    (global.set $eax (i32.const 1))
    (global.set $esp (i32.add (global.get $esp) (i32.const 20))) (return)
  )

  ;; 124: CheckDlgButton — WAT-only; the _checkStates Map in host-imports
  ;; is gone, ButtonState.flags bit 1 is the source of truth.
  (func $handle_CheckDlgButton (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $ctrl_hwnd i32)
    (local.set $ctrl_hwnd (call $ctrl_find_by_id (local.get $arg0) (local.get $arg1)))
    (if (local.get $ctrl_hwnd)
      (then (call $ctrl_set_check_state (local.get $ctrl_hwnd) (local.get $arg2))
            (call $host_invalidate (local.get $ctrl_hwnd))))
    (global.set $eax (i32.const 1))
    (global.set $esp (i32.add (global.get $esp) (i32.const 16))) (return)
  )

  ;; 125: CharNextA
  ;; CharNext{A,W}(lpsz) — advance one character, stopping on the terminator.
  ;; One character is one byte in ANSI and one UTF-16 code unit wide.
  (func $char_next (param $p i32) (param $wide i32) (result i32)
    (select
      (local.get $p)
      (i32.add (local.get $p) (select (i32.const 2) (i32.const 1) (local.get $wide)))
      (i32.eqz (call $gl_char (local.get $p) (local.get $wide)))))

  ;; CharPrev{A,W}(lpszStart, lpszCurrent) — step back one character, never
  ;; before the start of the string.
  (func $char_prev (param $start i32) (param $cur i32) (param $wide i32) (result i32)
    (select
      (local.get $start)
      (i32.sub (local.get $cur) (select (i32.const 2) (i32.const 1) (local.get $wide)))
      (i32.le_u (local.get $cur) (local.get $start))))

  (func $handle_CharNextA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $char_next (local.get $arg0) (i32.const 0)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8))) (return)
  )

  ;; 126: CharPrevA
  (func $handle_CharPrevA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $char_prev (local.get $arg0) (local.get $arg1) (i32.const 0)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12))) (return)
  )

  ;; 127: IsDialogMessageA(hDlg, lpMsg)
  ;;
  ;; The keyboard half of a dialog lives here, not in the control: a plain
  ;; edit control ignores VK_RETURN, and USER is what turns that keystroke
  ;; into the default command. Diablo's name-entry dialog is exactly that
  ;; shape -- DIABLOEDIT's WM_KEYDOWN handles only VK_LEFT, the OK button is
  ;; WS_DISABLED and ownerdrawn so it is not a default pushbutton either, and
  ;; the dialog procedure advances the game from WM_COMMAND id IDOK. Storm
  ;; calls IsDialogMessageA on every pump iteration; while this answered 0
  ;; unconditionally, Enter simply fell through to the edit and vanished.
  ;;
  ;; Only the two command keys are claimed. Everything else still answers 0,
  ;; so the caller goes on to TranslateMessage/DispatchMessage exactly as it
  ;; did before -- USER would have dispatched those same messages itself and
  ;; returned TRUE, and this way the app's own pump stays in charge of them.
  (func $handle_IsDialogMessageA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $target i32) (local $msg i32) (local $vk i32)
    (local $walk i32) (local $depth i32) (local $inside i32)
    (local $code i32) (local $def i32) (local $id i32) (local $btn i32)
    (global.set $eax (i32.const 0))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12)))  ;; stdcall, 2 args
    (if (i32.or (i32.eqz (local.get $arg0)) (i32.eqz (local.get $arg1)))
      (then (return)))
    (local.set $target (call $gl32 (local.get $arg1)))
    (local.set $msg (call $gl32 (i32.add (local.get $arg1) (i32.const 4))))
    (local.set $vk (call $gl32 (i32.add (local.get $arg1) (i32.const 8))))
    ;; WM_KEYDOWN only, and only the keys USER itself claims: the two command
    ;; keys, Tab, and the four arrows. Everything else still falls through.
    (if (i32.ne (local.get $msg) (i32.const 0x0100)) (then (return)))
    (if (i32.eqz (i32.or
          (i32.or
            (i32.eq (local.get $vk) (i32.const 0x0D))
            (i32.eq (local.get $vk) (i32.const 0x1B)))
          (i32.or
            (i32.eq (local.get $vk) (i32.const 0x09))
            (i32.and (i32.ge_u (local.get $vk) (i32.const 0x25))
                     (i32.le_u (local.get $vk) (i32.const 0x28))))))
      (then (return)))
    ;; The message must belong to this dialog or one of its descendants.
    (local.set $inside (i32.eq (local.get $target) (local.get $arg0)))
    (local.set $walk (local.get $target))
    (local.set $depth (i32.const 0))
    (block $done_walk (loop $up
      (br_if $done_walk (local.get $inside))
      (local.set $walk (call $wnd_get_parent (local.get $walk)))
      (br_if $done_walk (i32.eqz (local.get $walk)))
      (local.set $inside (i32.eq (local.get $walk) (local.get $arg0)))
      (local.set $depth (i32.add (local.get $depth) (i32.const 1)))
      (br_if $done_walk (i32.ge_u (local.get $depth) (i32.const 32)))
      (br $up)))
    (if (i32.eqz (local.get $inside)) (then (return)))
    ;; A control that asks for every key keeps it (DLGC_WANTALLKEYS/MESSAGE).
    (local.set $code (call $wnd_send_message
      (local.get $target) (i32.const 0x0087)
      (local.get $vk) (local.get $arg1)))
    (if (i32.and (local.get $code) (i32.const 0x0004)) (then (return)))
    ;; Tab and the arrows move the focus, and a control that asked for them
    ;; (DLGC_WANTTAB / DLGC_WANTARROWS -- an edit or a listbox) keeps them.
    (if (i32.eq (local.get $vk) (i32.const 0x09))
      (then
        (if (i32.and (local.get $code) (i32.const 0x0002)) (then (return)))
        (local.set $btn (call $dialog_next_tabstop
          (local.get $arg0) (local.get $target)
          (select (i32.const -1) (i32.const 1)
            (i32.and (call $host_get_key_down_state (i32.const 0x10))
                     (i32.const 0x8000)))))
        (if (local.get $btn) (then (call $set_focus (local.get $btn))))
        (global.set $eax (i32.const 1))
        (return)))
    (if (i32.and (i32.ge_u (local.get $vk) (i32.const 0x25))
                 (i32.le_u (local.get $vk) (i32.const 0x28)))
      (then
        (if (i32.and (local.get $code) (i32.const 0x0001)) (then (return)))
        ;; VK_LEFT (0x25) and VK_UP (0x26) go back; VK_RIGHT/VK_DOWN forward.
        (local.set $btn (call $dialog_next_group_item
          (local.get $arg0) (local.get $target)
          (select (i32.const -1) (i32.const 1)
            (i32.le_u (local.get $vk) (i32.const 0x26)))))
        (if (i32.and
              (i32.ne (local.get $btn) (i32.const 0))
              (i32.ne (local.get $btn) (local.get $target)))
          (then (call $set_focus (local.get $btn))))
        (global.set $eax (i32.const 1))
        (return)))
    (if (i32.eq (local.get $vk) (i32.const 0x1B))
      (then
        (drop (call $wnd_send_message
          (local.get $arg0) (i32.const 0x0111) (i32.const 2)
          (call $ctrl_find_by_id (local.get $arg0) (i32.const 2))))
        (global.set $eax (i32.const 1))
        (return)))
    ;; VK_RETURN on a focused pushbutton fires that button, not the dialog's
    ;; default -- USER makes the focused button the default for as long as it
    ;; holds the focus. Diablo's menus are exactly this shape: five ownerdrawn
    ;; Buttons and no default id, so without this the arrow keys moved the
    ;; highlight and Enter still launched the first item.
    (if (i32.and
          (i32.ne (local.get $target) (local.get $arg0))
          (i32.eq (call $ctrl_table_get_class (local.get $target)) (i32.const 1)))
      (then
        (if (i32.eqz (i32.and (call $wnd_get_style (local.get $target))
                              (i32.const 0x08000000)))  ;; !WS_DISABLED
          (then
            (drop (call $wnd_send_message
              (local.get $arg0) (i32.const 0x0111)
              (call $ctrl_table_get_id (local.get $target)) (local.get $target)))
            (global.set $eax (i32.const 1))
            (return)))))
    ;; VK_RETURN: the dialog's own default id when it claims one, IDOK when
    ;; it does not. A default button that exists but is disabled swallows the
    ;; key rather than firing -- an absent one does not.
    (local.set $def (call $wnd_send_message
      (local.get $arg0) (i32.const 0x0400) (i32.const 0) (i32.const 0)))  ;; DM_GETDEFID
    (if (i32.eq (i32.shr_u (local.get $def) (i32.const 16)) (i32.const 0x554B))
      (then
        (local.set $id (i32.and (local.get $def) (i32.const 0xFFFF)))
        (local.set $btn (call $ctrl_find_by_id (local.get $arg0) (local.get $id)))
        (global.set $eax (i32.const 1))
        (if (i32.eqz (local.get $btn)) (then (return)))
        (if (i32.and (call $wnd_get_style (local.get $btn)) (i32.const 0x08000000))
          (then (return)))
        (drop (call $wnd_send_message
          (local.get $arg0) (i32.const 0x0111) (local.get $id) (local.get $btn)))
        (return)))
    (drop (call $wnd_send_message
      (local.get $arg0) (i32.const 0x0111) (i32.const 1)
      (call $ctrl_find_by_id (local.get $arg0) (i32.const 1))))
    (global.set $eax (i32.const 1))
  )

  ;; 128: IsIconic(hwnd) → BOOL — is the window minimized?
  ;; This answered 0 unconditionally while ShowWindow(SW_MINIMIZE) and
  ;; SC_MINIMIZE were both plainly reaching the renderer, so an app that
  ;; minimizes itself and then asks — the ordinary shape of a WM_SIZE or
  ;; WM_PAINT guard, and of "restore me before showing a dialog" — was told no.
  (func $handle_IsIconic (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $wnd_min_get (local.get $arg0)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8)))
  )

  ;; 129: ChildWindowFromPoint(hWndParent, POINT). POINT is passed by value.
  ;; Convert the parent-client point to screen coordinates and use the shared
  ;; HWND-tree hit tester. Win32 returns the parent when no child contains it.
  (func $handle_ChildWindowFromPoint (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $child i32)
    (local.set $child (call $wnd_child_from_point_deep
      (local.get $arg0)
      (i32.add (call $wnd_client_screen_x (local.get $arg0)) (local.get $arg1))
      (i32.add (call $wnd_client_screen_y (local.get $arg0)) (local.get $arg2))))
    (global.set $eax
      (select (local.get $child) (local.get $arg0) (local.get $child)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 16)))
  )

  ;; 130: ScreenToClient
  (func $handle_ScreenToClient (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $pt i32) (local $ox i32) (local $oy i32)
    (local.set $pt (call $g2w (local.get $arg1)))
    (local.set $ox (call $wnd_client_screen_x (local.get $arg0)))
    (local.set $oy (call $wnd_client_screen_y (local.get $arg0)))
    (store.field Point x (local.get $pt)
      (i32.sub (load.field Point x (local.get $pt)) (local.get $ox)))
    (store.field.memarg Point y (local.get $pt)
      (i32.sub (load.field.memarg Point y (local.get $pt)) (local.get $oy)))
    (global.set $eax (i32.const 1))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12))) (return)
  )

;; 132: WinHelpA(hwnd, lpszHelp, uCommand, dwData) — unified WAT dispatcher
  (func $handle_WinHelpA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $accepted i32)
    (local.set $accepted (call $help_dispatch_api_a
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3)))
    (call $help_present_dispatch (local.get $accepted) (local.get $arg2))
    (global.set $eax (local.get $accepted))
    (global.set $esp (i32.add (global.get $esp) (i32.const 20)))
  )

  ;; 133: IsChild
  (func $handle_IsChild (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (if (result i32) (i32.and
    (i32.ne (global.get $dlg_hwnd) (i32.const 0))
    (i32.eq (local.get $arg0) (global.get $dlg_hwnd)))
    (then (i32.const 1)) (else (i32.const 0))))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12))) (return)
  )

  ;; 134: GetSysColorBrush(nIndex) — 1 arg stdcall
  (func $handle_GetSysColorBrush (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $host_gdi_create_solid_brush (call $win98_sys_color (local.get $arg0))))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8)))
  )

  ;; 135: GetSysColor
  (func $handle_GetSysColor (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $win98_sys_color (local.get $arg0)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8))) (return)
  )

  ;; 136: DialogBoxParamA(hInstance, lpTemplate, hWndParent, lpDialogFunc, dwInitParam)
  ;; DialogBoxParamA(hInstance, lpTemplateName, hWndParent, lpDialogFunc, dwInitParam)
  ;; Creates modal dialog, sends WM_INITDIALOG, enters message loop, returns EndDialog result
  (func $handle_DialogBoxParamA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $hwnd i32) (local $init_param i32)
    (local $dlg_rec i32) (local $ctrl_count i32) (local $i i32) (local $ctrl_hwnd i32)
    ;; arg0=hInstance, arg1=lpTemplateName (resource ID), arg2=hWndParent
    ;; arg3=lpDialogFunc, arg4=dwInitParam. Five stdcall args live at
    ;; [esp+4]..[esp+20]; [esp+24] is already the caller's own frame, so
    ;; reading it handed WM_INITDIALOG a garbage lParam (usually 0).
    ;; HyperTerminal's "Connect To" DlgProc stores that lParam in its
    ;; per-dialog block and then asserts it non-NULL — a 0 there took the
    ;; app straight to ExitProcess(1).
    (local.set $init_param (local.get $arg4))
    ;; Keep the previous modal pump in this call's consumed argument frame.
    ;; The initial DLGPROC frame is placed below it, and CACA0004 restores
    ;; these words when this DialogBox returns. Nested modal dialogs therefore
    ;; compose on the guest stack instead of overwriting one global pump.
    (call $gs32 (i32.add (global.get $esp) (i32.const 4))
      (global.get $dlg_pump_hwnd))
    (call $gs32 (i32.add (global.get $esp) (i32.const 8))
      (global.get $dlg_proc))
    (call $gs32 (i32.add (global.get $esp) (i32.const 12))
      (global.get $dlg_ret_addr))
    (call $gs32 (i32.add (global.get $esp) (i32.const 16))
      (global.get $dlg_callback_yield_pending))
    (call $gs32 (i32.add (global.get $esp) (i32.const 20))
      (global.get $dlg_init_focus_hwnd))
    ;; Allocate HWND
    (local.set $hwnd (global.get $next_hwnd))
    (global.set $next_hwnd (i32.add (global.get $next_hwnd) (i32.const 1)))
    ;; Set as dialog hwnd (and dedicated modal-pump hwnd so nested
    ;; CreateDialogParamA can't hijack the pump's hwnd-less fallback)
    (global.set $dlg_hwnd (local.get $hwnd))
    (global.set $dlg_pump_hwnd (local.get $hwnd))
    (i32.store (global.get $SHARED_DLG_PUMP_HWND) (local.get $hwnd))
    (global.set $dlg_ended (i32.const 0))
    (global.set $dlg_result (i32.const 0))
    (i32.store (global.get $SHARED_DLG_ENDED) (i32.const 0))
    (i32.store (global.get $SHARED_DLG_RESULT) (i32.const 0))
    (global.set $dlg_proc (local.get $arg3))
    ;; USER keeps the DLGPROC separate from the dialog window's DefDlgProc
    ;; WNDPROC. This is observable when a framework subclasses the dialog and
    ;; chains to the saved previous procedure.
    (call $wnd_table_set (local.get $hwnd) (global.get $WNDPROC_DIALOG))
    (drop (call $dialog_proc_set (local.get $hwnd) (local.get $arg3)))
    ;; Parse the RT_DIALOG template fully in WAT — allocates child hwnds,
    ;; fills CONTROL_TABLE + CONTROL_GEOM, sends WM_CREATE, stores header
    ;; state in WND_DLG_RECORDS[slot]. Handles int IDs and guest string
    ;; pointers (named entries) via $find_resource. Route resource lookup
    ;; through hInstance so templates in a satellite DLL resolve.
    (call $push_rsrc_ctx (local.get $arg0))
    (drop (call $dlg_load (local.get $hwnd) (local.get $arg1)))
    (call $pop_rsrc_ctx)
    ;; DialogBoxParam creates a top-level owned dialog and shows it before
    ;; WM_INITDIALOG. Template styles commonly omit WS_VISIBLE; USER's modal
    ;; creation path still makes the HWND visible, so keep WAT style in sync
    ;; before visibility-dependent hit-testing/painting runs.
    (call $wnd_set_parent (local.get $hwnd) (i32.const 0))
    (call $wnd_set_owner (local.get $hwnd) (local.get $arg2))
    (drop (call $wnd_set_style (local.get $hwnd)
      (i32.or (call $wnd_get_style (local.get $hwnd)) (i32.const 0x10000000)))) (call $wnd_note_active_popup (local.get $hwnd))
    ;; Tell the renderer the dialog has been loaded; JS reads geom /
    ;; style / controls from the dlg_* / ctrl_* exports.
    (call $host_dialog_loaded (local.get $hwnd) (local.get $arg2))
    ;; USER's dialog manager places the frame relative to the owner's client
    ;; area (DS_ABSALIGN opts out) and centres a DS_CENTER template. The host
    ;; has mirrored the window by now, so this measures both rects and moves.
    (call $dlg_place_owner_relative (local.get $hwnd))
    ;; Populate WAT CLIENT_RECT from the same frame metrics the renderer
    ;; uses so ScreenToClient/MapWindowPoints subtract the real client origin.
    (call $defwndproc_do_nccalcsize (local.get $hwnd))
    ;; Fill dialog client area with COLOR_BTNFACE — template DlgProcs
    ;; typically don't handle WM_PAINT, expecting DefDlgProc to erase,
    ;; but our modal pump doesn't fall through to DefWindowProc on a
    ;; FALSE return from WM_PAINT. Without this, the back-canvas stays
    ;; transparent/teal between control bodies.
    (call $dlg_fill_bkgnd (local.get $hwnd))
    ;; Seed WM_NCPAINT so the modal pump delivers chrome paint to the
    ;; dialog's wndproc → DefDlgProc/DefWindowProc → back-canvas chrome.
    ;; Without this, modal dialogs stay chrome-less in the PNG.
    (call $nc_flags_set (local.get $hwnd) (i32.const 1))
    ;; Enqueue WM_PAINT for each child control. Mirrors CreateDialogParamA;
    ;; otherwise buttons/edits/statics never get their first WM_PAINT while
    ;; the modal pump runs. Walk via $wnd_next_child_slot rather than
    ;; assuming contiguous hwnd allocation — combobox WM_CREATE may
    ;; allocate auxiliary windows (inner listbox, WS_POPUP shell) that
    ;; punch holes in the dlg_hwnd+1..dlg_hwnd+ctrl_count range.
    (local.set $i (i32.const 0))
    (block $done (loop $push_loop
      (local.set $i (call $wnd_next_child_slot (local.get $hwnd) (local.get $i)))
      (br_if $done (i32.eq (local.get $i) (i32.const -1)))
      (local.set $ctrl_hwnd (call $wnd_slot_hwnd (local.get $i)))
      (if (i32.and (call $wnd_get_style (local.get $ctrl_hwnd)) (i32.const 0x10000000))
        (then (call $paint_flag_set_inv (local.get $ctrl_hwnd))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $push_loop)))
    ;; The dialog's own client area needs a WM_PAINT too. A template DlgProc
    ;; that ignores it costs nothing — $dlg_fill_bkgnd already painted the
    ;; COLOR_BTNFACE and the pump's take clears the flag, so there is no
    ;; repaint loop — but an app that draws its client itself never sees a
    ;; single paint otherwise. Welcome to Windows 98 is exactly that shape:
    ;; every visible element (banner bitmap, the seven menu rows, the body
    ;; text) is drawn by its DLGPROC over invisible SS_SUNKEN statics that
    ;; exist only as geometry anchors, so the dialog rendered as an empty
    ;; grey box with nothing but the Close button.
    (call $paint_flag_set_inv (local.get $hwnd))
    ;; Do not synchronously paint children during DialogBoxParamA creation.
    ;; The modal pump below drains seeded WAT-native paints after the dialog
    ;; is visible and its USER-style visible region is stable.
    ;; Show the dialog — real DialogBoxParam auto-shows before WM_INITDIALOG
    (drop (call $host_show_window (local.get $hwnd) (i32.const 1)))
    ;; Save return address — we'll restore it when EndDialog is called
    (global.set $dlg_ret_addr (call $gl32 (global.get $esp)))
    ;; Apply the five-argument stdcall cleanup explicitly. The callback frame
    ;; below reaches back across these 24 bytes so the consumed API frame stays
    ;; beneath it as nested-pump storage.
    (global.set $esp (i32.add (global.get $esp) (i32.const 24)))
    ;; Determine the control USER passes in WM_INITDIALOG.wParam before the
    ;; callback runs. A TRUE callback return applies this default afterward;
    ;; FALSE means the application assigned focus itself.
    (local.set $ctrl_hwnd (call $dialog_first_init_tabstop (local.get $hwnd)))
    ;; Set up call to dialog proc: DlgProc(hwnd, WM_INITDIALOG, ctrl, init).
    ;; Return to dialog loop thunk which pumps messages until EndDialog. Keep
    ;; this API frame in place until then: its consumed args hold the previous
    ;; pump state, and CACA0004 pops all 24 bytes after restoring them.
    (global.set $esp (i32.sub (global.get $esp) (i32.const 44)))  ;; API frame + 4 args + ret
    (call $gs32 (global.get $esp) (global.get $dlg_loop_thunk))  ;; ret → dialog message loop
    (call $gs32 (i32.add (global.get $esp) (i32.const 4)) (local.get $hwnd))          ;; hDlg
    (call $gs32 (i32.add (global.get $esp) (i32.const 8)) (i32.const 0x0110))         ;; WM_INITDIALOG
    (global.set $dlg_init_focus_hwnd (local.get $ctrl_hwnd))
    (call $gs32 (i32.add (global.get $esp) (i32.const 12)) (global.get $dlg_init_focus_hwnd)) ;; wParam (focus hwnd)
    (call $gs32 (i32.add (global.get $esp) (i32.const 16)) (local.get $init_param))   ;; lParam
    ;; Set EIP to dialog proc and signal redirection (don't let caller override EIP)
    (global.set $eip (local.get $arg3))
    ;; Let the host observe/show the modal shell before WM_INITDIALOG starts,
    ;; then yield once more when that guest callback returns to CACA0004.
    (global.set $dlg_callback_yield_pending (i32.const 1))
    (global.set $yield_flag (i32.const 1))
    (global.set $steps (i32.const 0))
  )

  ;; DialogBoxParamW — same as A. Template names, if strings, are UTF-16,
  ;; but $find_resource only matches integer IDs and ASCII strings, so
  ;; UTF-16 string templates fall to the int branch either way (like
  ;; CreateDialogParamW). Winmine's Custom dialog uses int IDs (0x5A).
  (func $handle_DialogBoxParamW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $hwnd i32)
    (local.set $hwnd (global.get $next_hwnd))
    (call $handle_DialogBoxParamA (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
    (call $wnd_unicode_set (local.get $hwnd) (i32.const 1))
  )

  ;; DialogBoxIndirectParamA uses the same modal creation/pump as
  ;; DialogBoxParamA, but arg1 already points at a DLGTEMPLATE rather than an
  ;; RT_DIALOG resource name. $dlg_load consumes and clears this one-shot.
  (func $handle_DialogBoxIndirectParamA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $dlg_indirect_template_ptr (local.get $arg1))
    (call $handle_DialogBoxParamA
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
  )

 139: OffsetRect — STUB: unimplemented
  (func $handle_OffsetRect (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; OffsetRect(lprc, dx, dy) → BOOL. Moves rect by (dx, dy)
    ;; RECT: left, top, right, bottom (4 DWORDs)
    (local $wa i32)
    (local.set $wa (call $g2w (local.get $arg0)))
    (store.field Rect left (local.get $wa) (i32.add (load.field Rect left (local.get $wa)) (local.get $arg1)))                        ;; left += dx
    (store.field Rect top (local.get $wa) (i32.add (load.field Rect top (local.get $wa)) (local.get $arg2)))  ;; top += dy
    (store.field Rect right (local.get $wa) (i32.add (load.field Rect right (local.get $wa)) (local.get $arg1)))  ;; right += dx
    (store.field Rect bottom (local.get $wa) (i32.add (load.field Rect bottom (local.get $wa)) (local.get $arg2))) ;; bottom += dy
    (global.set $eax (i32.const 1))
    (global.set $esp (i32.add (global.get $esp) (i32.const 16)))  ;; stdcall, 3 args
  )

  ;; 140: MapWindowPoints(hWndFrom, hWndTo, lpPoints, cPoints) → int
  ;; Translate an array of POINTs from hWndFrom's client space into hWndTo's.
  ;; hWndFrom/hWndTo==NULL means screen coordinates. Return packs dx/dy in
  ;; signed 16-bit halves, matching the Win32 contract.
  (func $handle_MapWindowPoints (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $dx i32) (local $dy i32)
    (local $i i32) (local $p i32)
    (local.set $dx (i32.sub
      (call $wnd_client_screen_x (local.get $arg0))
      (call $wnd_client_screen_x (local.get $arg1))))
    (local.set $dy (i32.sub
      (call $wnd_client_screen_y (local.get $arg0))
      (call $wnd_client_screen_y (local.get $arg1))))
    ;; Apply to each POINT (or RECT = 2 POINTs, caller picks cPoints)
    (local.set $i (i32.const 0))
    (local.set $p (call $g2w (local.get $arg2)))
    (block $apply_done (loop $apply
      (br_if $apply_done (i32.ge_u (local.get $i) (local.get $arg3)))
      (store.field Point x (local.get $p)
        (i32.add (load.field Point x (local.get $p)) (local.get $dx)))
      (store.field.memarg Point y (local.get $p)
        (i32.add (load.field.memarg Point y (local.get $p)) (local.get $dy)))
      (local.set $p (i32.add (local.get $p) (i32.const 8)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $apply)))
    (global.set $eax (i32.or (i32.and (local.get $dx) (i32.const 0xFFFF))
                             (i32.shl (local.get $dy) (i32.const 16))))
    (global.set $esp (i32.add (global.get $esp) (i32.const 20))))

  ;; 141: SetWindowPos
  ;; WINDOWPOS structs handed to guest wndprocs by $windowpos_notify. These are
  ;; guest-visible, so they come from $heap_alloc (which returns guest
  ;; addresses) rather than one of the emulator-private scratch regions, which
  ;; live outside the g2w window and cannot be dereferenced by the guest.
  ;;
  ;; A wndproc handling WM_WINDOWPOSCHANGED routinely calls SetWindowPos again
  ;; — VCL does it while laying out children — so a single shared struct would
  ;; be rewritten underneath an outer frame that still holds the pointer. The
  ;; depth counter picks the slot and bounds the recursion in one move.
  ;; Base of the wndproc markers GetClassInfo hands out for USER's own control
  ;; classes; the low byte carries the $control_wndproc_dispatch class id.
  ;; Sits in the same reserved 0xFFFE_xxxx space as $WNDPROC_BUILTIN.
  (global $WNDPROC_SYSCLASS i32 (i32.const 0xFFFE0100))

  ;; Give a newly adopted control the WM_CREATE it never received.
  ;;
  ;; Every control proc allocates its state block in WM_CREATE, and a window
  ;; created under the app's own class name never had one routed to it. Left
  ;; alone the state pointer stays NULL and the procs then read and write
  ;; through guest address zero -- which superficially works, because both
  ;; sides use the same bad pointer, while quietly corrupting low guest
  ;; memory. Replaying creation is also how the control learns its id, caption
  ;; and button kind, none of which it can recover later.
  (global $sysclass_cs (mut i32) (i32.const 0))
  (func $sysclass_replay_create (param $hwnd i32) (param $slot i32)
    (local $cs i32) (local $cs_w i32) (local $name i32) (local $geom i32)
    (if (i32.eqz (global.get $sysclass_cs))
      ;; 48-byte CREATESTRUCT followed by the caption it points at.
      (then (global.set $sysclass_cs (call $heap_alloc (i32.const 304)))))
    (if (i32.eqz (global.get $sysclass_cs)) (then (return)))
    (local.set $cs (global.get $sysclass_cs))
    (local.set $name (i32.add (local.get $cs) (i32.const 48)))
    (local.set $cs_w (call $g2w (local.get $cs)))
    (drop (call $host_get_window_text
      (local.get $hwnd) (call $g2w (local.get $name)) (i32.const 255)))
    (local.set $geom (call $ctrl_geom_addr (local.get $slot)))
    (i32.store           (local.get $cs_w) (i32.const 0))  ;; lpCreateParams
    (i32.store offset=4  (local.get $cs_w) (i32.const 0))  ;; hInstance
    (i32.store offset=8  (local.get $cs_w) (call $ctrl_table_get_id (local.get $hwnd)))
    (i32.store offset=12 (local.get $cs_w) (call $wnd_get_parent (local.get $hwnd)))
    (i32.store offset=16 (local.get $cs_w) (i32.load16_u offset=6 (local.get $geom)))
    (i32.store offset=20 (local.get $cs_w) (i32.load16_u offset=4 (local.get $geom)))
    (i32.store offset=24 (local.get $cs_w) (i32.load16_u offset=2 (local.get $geom)))
    (i32.store offset=28 (local.get $cs_w) (i32.load16_u (local.get $geom)))
    (i32.store offset=32 (local.get $cs_w) (call $wnd_get_style (local.get $hwnd)))
    (i32.store offset=36 (local.get $cs_w) (local.get $name))
    (i32.store offset=40 (local.get $cs_w) (i32.const 0))  ;; lpszClass
    (i32.store offset=44 (local.get $cs_w) (call $ctrl_get_ex_style (local.get $hwnd)))
    (drop (call $control_wndproc_dispatch
      (local.get $hwnd) (i32.const 0x0001) (i32.const 0) (local.get $cs))))

  (global $windowpos_ring (mut i32) (i32.const 0))
  (global $windowpos_depth (mut i32) (i32.const 0))
  (global $WINDOWPOS_SLOT i32 (i32.const 32))   ;; 28-byte struct, padded
  (global $WINDOWPOS_DEPTH_MAX i32 (i32.const 8))

  ;; Allocate one reentrant guest-visible WINDOWPOS and send the mutable
  ;; WM_WINDOWPOSCHANGING half of USER's positioning transaction. The same
  ;; slot remains live until $windowpos_message_end sends WM_WINDOWPOSCHANGED,
  ;; so nested SetWindowPos calls cannot rewrite the outer wndproc's lParam.
  ;; SWP_NOSENDCHANGING suppresses only the first message.
  (func $windowpos_message_begin
    (param $hwnd i32) (param $insert_after i32) (param $x i32) (param $y i32)
    (param $cx i32) (param $cy i32) (param $flags i32) (result i32)
    (local $wp i32) (local $slot i32) (local $w i32)
    (local.set $wp (call $wnd_table_get (local.get $hwnd)))
    (if (i32.eqz (local.get $wp)) (then (return (i32.const 0))))
    ;; 0xFFFE_xxxx values are emulator markers, not callable procedures. WAT
    ;; wndprocs live at 0xFFFF_xxxx and are safe through $wnd_send_message.
    (if (i32.and
          (i32.ge_u (local.get $wp) (i32.const 0xFFFE0000))
          (i32.lt_u (local.get $wp) (i32.const 0xFFFF0000)))
      (then (return (i32.const 0))))
    ;; The Win16 far-procedure path constructs its own Pascal message frames;
    ;; this 32-bit stdcall sender cannot keep a queued WINDOWPOS alive for it.
    (if (i32.and
          (i32.ne (global.get $code16) (i32.const 0))
          (call $win16_is_far_proc (local.get $wp)))
      (then (return (i32.const 0))))
    (if (i32.ge_u (global.get $windowpos_depth) (global.get $WINDOWPOS_DEPTH_MAX))
      (then (return (i32.const 0))))
    (if (i32.eqz (global.get $windowpos_ring))
      (then
        (global.set $windowpos_ring (call $heap_alloc
          (i32.mul (global.get $WINDOWPOS_SLOT) (global.get $WINDOWPOS_DEPTH_MAX))))))
    (if (i32.eqz (global.get $windowpos_ring))
      (then (return (i32.const 0))))
    (local.set $slot (i32.add (global.get $windowpos_ring)
      (i32.mul (global.get $windowpos_depth) (global.get $WINDOWPOS_SLOT))))
    (local.set $w (call $g2w (local.get $slot)))
    (i32.store (local.get $w) (local.get $hwnd))
    (i32.store offset=4 (local.get $w) (local.get $insert_after))
    (i32.store offset=8 (local.get $w) (local.get $x))
    (i32.store offset=12 (local.get $w) (local.get $y))
    (i32.store offset=16 (local.get $w) (local.get $cx))
    (i32.store offset=20 (local.get $w) (local.get $cy))
    (i32.store offset=24 (local.get $w) (local.get $flags))
    (global.set $windowpos_depth (i32.add (global.get $windowpos_depth) (i32.const 1)))
    (if (i32.eqz (i32.and (local.get $flags) (i32.const 0x0400))) ;; !SWP_NOSENDCHANGING
      (then
        (drop (call $wnd_send_message
          (local.get $hwnd) (i32.const 0x0046) (i32.const 0) (local.get $slot)))))
    (local.get $slot))

  ;; Publish the final values through the same WINDOWPOS before the changed
  ;; notification. Mutating this second message has no effect because USER has
  ;; already committed the operation.
  (func $windowpos_message_update
    (param $slot i32) (param $hwnd i32) (param $insert_after i32)
    (param $x i32) (param $y i32) (param $cx i32) (param $cy i32)
    (param $flags i32)
    (local $w i32)
    (if (i32.eqz (local.get $slot)) (then (return)))
    (local.set $w (call $g2w (local.get $slot)))
    (i32.store (local.get $w) (local.get $hwnd))
    (i32.store offset=4 (local.get $w) (local.get $insert_after))
    (i32.store offset=8 (local.get $w) (local.get $x))
    (i32.store offset=12 (local.get $w) (local.get $y))
    (i32.store offset=16 (local.get $w) (local.get $cx))
    (i32.store offset=20 (local.get $w) (local.get $cy))
    (i32.store offset=24 (local.get $w) (local.get $flags)))

  (func $windowpos_message_end (param $slot i32) (param $hwnd i32)
    (if (i32.eqz (local.get $slot)) (then (return)))
    (drop (call $wnd_send_message
      (local.get $hwnd) (i32.const 0x0047) (i32.const 0) (local.get $slot)))
    (global.set $windowpos_depth (i32.sub (global.get $windowpos_depth) (i32.const 1)))
  )

  (func $windowpos_message_cancel (param $slot i32)
    (if (i32.eqz (local.get $slot)) (then (return)))
    (global.set $windowpos_depth
      (i32.sub (global.get $windowpos_depth) (i32.const 1))))

  ;; WM_MOVE carries the upper-left of the client area. Top-level coordinates
  ;; are screen-relative; child coordinates are relative to the parent's
  ;; client origin.
  (func $window_client_xy_packed (param $hwnd i32) (result i32)
    (local $x i32) (local $y i32) (local $parent i32)
    (local.set $x (call $wnd_client_screen_x (local.get $hwnd)))
    (local.set $y (call $wnd_client_screen_y (local.get $hwnd)))
    (if (i32.ne
          (i32.and (call $wnd_get_style (local.get $hwnd)) (i32.const 0x40000000))
          (i32.const 0))
      (then
        (local.set $parent (call $wnd_get_parent (local.get $hwnd)))
        (if (local.get $parent)
          (then
            (local.set $x (i32.sub (local.get $x)
              (call $wnd_client_screen_x (local.get $parent))))
            (local.set $y (i32.sub (local.get $y)
              (call $wnd_client_screen_y (local.get $parent))))))))
    (i32.or
      (i32.and (local.get $x) (i32.const 0xFFFF))
      (i32.shl (i32.and (local.get $y) (i32.const 0xFFFF)) (i32.const 16))))

  ;; DefWindowProc owns the legacy geometry messages. A wndproc that consumes
  ;; WM_WINDOWPOSCHANGED without chaining here intentionally receives neither,
  ;; exactly as USER documents.
  (func $windowpos_defproc_geometry (param $hwnd i32) (param $windowpos i32)
    (local $flags i32) (local $wh i32)
    (if (i32.eqz (local.get $windowpos)) (then (return)))
    (local.set $flags
      (call $gl32 (i32.add (local.get $windowpos) (i32.const 24))))
    (if (i32.eqz (i32.and (local.get $flags) (i32.const 2))) ;; !SWP_NOMOVE
      (then
        (drop (call $wnd_send_message
          (local.get $hwnd) (i32.const 0x0003) (i32.const 0)
          (call $window_client_xy_packed (local.get $hwnd))))))
    (if (i32.eqz (i32.and (local.get $flags) (i32.const 1))) ;; !SWP_NOSIZE
      (then
        (local.set $wh (i32.or
          (i32.and
            (i32.sub (call $client_rect_get_r (local.get $hwnd))
              (call $client_rect_get_l (local.get $hwnd)))
            (i32.const 0xFFFF))
          (i32.shl
            (i32.and
              (i32.sub (call $client_rect_get_b (local.get $hwnd))
                (call $client_rect_get_t (local.get $hwnd)))
              (i32.const 0xFFFF))
            (i32.const 16))))
        (drop (call $wnd_send_message
          (local.get $hwnd) (i32.const 0x0005) (i32.const 0) (local.get $wh))))))

  (func $handle_SetWindowPos (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; SetWindowPos(hwnd, hWndInsertAfter, X, Y, cx, cy, uFlags)
    (local $x i32) (local $y i32) (local $cx i32) (local $cy i32)
    (local $uFlags i32) (local $original_flags i32) (local $dlg_rec i32)
    (local $screen i32) (local $insert_after i32) (local $windowpos i32)
    (local $old_wh i32) (local $new_wh i32) (local $old_xy i32) (local $new_xy i32)
    (local.set $insert_after (local.get $arg1))
    (local.set $x (local.get $arg2))
    (local.set $y (local.get $arg3))
    (local.set $cx (local.get $arg4))
    (local.set $cy (call $gl32 (i32.add (global.get $esp) (i32.const 24))))
    (local.set $uFlags (call $gl32 (i32.add (global.get $esp) (i32.const 28))))
    ;; An AdjustWindowRectEx-expanded CW_USEDEFAULT remains "leave this part
    ;; alone" during SDL's first SetWindowPos, even though it is no longer the
    ;; exact 0x80000000 bit pattern understood by the host fallback.
    (if (i32.or
          (call $is_cw_usedefault_value (local.get $x))
          (call $is_cw_usedefault_value (local.get $y)))
      (then (local.set $uFlags (i32.or (local.get $uFlags) (i32.const 2))))) ;; SWP_NOMOVE
    (if (i32.or
          (call $is_cw_usedefault_value (local.get $cx))
          (call $is_cw_usedefault_value (local.get $cy)))
      (then (local.set $uFlags (i32.or (local.get $uFlags) (i32.const 1))))) ;; SWP_NOSIZE
    ;; Once SDL supplies a real size, its adjusted 0xc0000000 coordinates mean
    ;; center that top-level window in the current display mode.
    (if (i32.eqz (i32.and (call $wnd_get_style (local.get $arg0)) (i32.const 0x40000000)))
      (then
        (local.set $screen (call $host_get_screen_size))
        (if (call $is_adjusted_center_coord (local.get $x))
          (then (local.set $x
            (if (result i32)
              (i32.gt_u (i32.and (local.get $screen) (i32.const 0xffff)) (local.get $cx))
              (then (i32.div_u
                (i32.sub (i32.and (local.get $screen) (i32.const 0xffff)) (local.get $cx))
                (i32.const 2)))
              (else (i32.const 0))))))
        (if (call $is_adjusted_center_coord (local.get $y))
          (then (local.set $y
            (if (result i32)
              (i32.gt_u (i32.shr_u (local.get $screen) (i32.const 16)) (local.get $cy))
              (then (i32.div_u
                (i32.sub (i32.shr_u (local.get $screen) (i32.const 16)) (local.get $cy))
                (i32.const 2)))
              (else (i32.const 0))))))))
    ;; USER exposes one mutable WINDOWPOS before touching geometry. The app
    ;; may change position, size, z-order and most flags. NOACTIVATE and
    ;; NOOWNERZORDER are explicitly documented as immutable in this message.
    (local.set $original_flags (local.get $uFlags))
    (local.set $windowpos (call $windowpos_message_begin
      (local.get $arg0) (local.get $insert_after)
      (local.get $x) (local.get $y) (local.get $cx) (local.get $cy)
      (local.get $uFlags)))
    (if (local.get $windowpos)
      (then
        (local.set $insert_after
          (call $gl32 (i32.add (local.get $windowpos) (i32.const 4))))
        (local.set $x
          (call $gl32 (i32.add (local.get $windowpos) (i32.const 8))))
        (local.set $y
          (call $gl32 (i32.add (local.get $windowpos) (i32.const 12))))
        (local.set $cx
          (call $gl32 (i32.add (local.get $windowpos) (i32.const 16))))
        (local.set $cy
          (call $gl32 (i32.add (local.get $windowpos) (i32.const 20))))
        (local.set $uFlags
          (i32.or
            (i32.and
              (call $gl32 (i32.add (local.get $windowpos) (i32.const 24)))
              (i32.const 0xFFFFFDEF))
            (i32.and (local.get $original_flags) (i32.const 0x00000210))))
        ;; A wndproc is allowed to destroy the target while processing the
        ;; synchronous changing message. Never apply its stale HWND afterward.
        (if (i32.lt_s (call $wnd_table_find (local.get $arg0)) (i32.const 0))
          (then
            (call $windowpos_message_cancel (local.get $windowpos))
            (global.set $last_error (i32.const 1400)) ;; ERROR_INVALID_WINDOW_HANDLE
            (global.set $eax (i32.const 0))
            (global.set $esp (i32.add (global.get $esp) (i32.const 32)))
            (return)))))
    ;; Child controls own their geometry in CONTROL_GEOM. Top-level frames do
    ;; not: their renderer window can still be at the resource-template size
    ;; while the compatibility record and client rectangle already contain
    ;; the requested final dimensions. Read the live outer window rectangle,
    ;; which is also the coordinate space of SetWindowPos cx/cy. Reading the
    ;; stale compatibility record made a real frame resize look
    ;; like a no-op, added SWP_NOSIZE to WM_WINDOWPOSCHANGED, and suppressed
    ;; the derived WM_SIZE that common controls use for bottom anchoring.
    (if (i32.and (call $wnd_get_style (local.get $arg0)) (i32.const 0x40000000))
      (then (local.set $old_wh (call $ctrl_get_wh_packed (local.get $arg0))))
      (else
        (call $host_get_window_rect (local.get $arg0) (global.get $WINDOW_RECT_SCRATCH))
        (local.set $old_wh
          (i32.or
            (i32.and
              (i32.sub
                (i32.load offset=8 (global.get $WINDOW_RECT_SCRATCH))
                (i32.load (global.get $WINDOW_RECT_SCRATCH)))
              (i32.const 0xFFFF))
            (i32.shl
              (i32.and
                (i32.sub
                  (i32.load offset=12 (global.get $WINDOW_RECT_SCRATCH))
                  (i32.load offset=4 (global.get $WINDOW_RECT_SCRATCH)))
                (i32.const 0xFFFF))
              (i32.const 16))))))
    (local.set $old_xy (call $window_xy_packed (local.get $arg0)))
    ;; Commit geometry and z-order independently, as the SWP flags require.
    (call $host_move_window (local.get $arg0) (local.get $x) (local.get $y) (local.get $cx) (local.get $cy) (local.get $uFlags))
    (if (i32.and (i32.eqz (i32.and (local.get $uFlags) (i32.const 0x0004))) (i32.eqz (i32.and (call $wnd_get_style (local.get $arg0)) (i32.const 0x40000000)))) (then (call $host_set_window_zorder (local.get $arg0) (local.get $arg1))))
    (call $ctrl_geom_sync (local.get $arg0) (local.get $x) (local.get $y) (local.get $cx) (local.get $cy) (local.get $uFlags))
    (if (i32.and (call $wnd_get_style (local.get $arg0)) (i32.const 0x40000000))
      (then (local.set $new_wh (call $ctrl_get_wh_packed (local.get $arg0))))
      (else
        (call $host_get_window_rect (local.get $arg0) (global.get $WINDOW_RECT_SCRATCH))
        (local.set $new_wh
          (i32.or
            (i32.and
              (i32.sub
                (i32.load offset=8 (global.get $WINDOW_RECT_SCRATCH))
                (i32.load (global.get $WINDOW_RECT_SCRATCH)))
              (i32.const 0xFFFF))
            (i32.shl
              (i32.and
                (i32.sub
                  (i32.load offset=12 (global.get $WINDOW_RECT_SCRATCH))
                  (i32.load offset=4 (global.get $WINDOW_RECT_SCRATCH)))
                (i32.const 0xFFFF))
              (i32.const 16))))))
    (local.set $new_xy (call $window_xy_packed (local.get $arg0)))
    ;; Make the changed WINDOWPOS describe what USER actually changed, so its
    ;; default procedure does not derive geometry messages for a no-op half.
    (if (i32.eq (local.get $old_xy) (local.get $new_xy))
      (then (local.set $uFlags (i32.or (local.get $uFlags) (i32.const 2)))))
    (if (i32.eq (local.get $old_wh) (local.get $new_wh))
      (then (local.set $uFlags (i32.or (local.get $uFlags) (i32.const 1)))))
    ;; Keep WAT's GWL_STYLE in sync with SetWindowPos visibility flags. Apps
    ;; such as Tetravex show custom child panels via SWP_SHOWWINDOW instead of
    ;; ShowWindow; if WS_VISIBLE stays clear here, WAT's paint selector treats
    ;; their later InvalidateRect calls as hidden-window work and drops them.
    (if (i32.and (local.get $uFlags) (i32.const 0x0040)) ;; SWP_SHOWWINDOW
      (then
        (drop (call $wnd_set_style (local.get $arg0)
          (i32.or (call $wnd_get_style (local.get $arg0)) (i32.const 0x10000000))))
        (if (i32.eqz (i32.and (local.get $uFlags) (i32.const 0x0008))) ;; !SWP_NOREDRAW
          (then
            (if (i32.eq (local.get $arg0) (global.get $main_hwnd))
              (then
                (global.set $paint_pending (i32.const 1))
                (call $update_invalidate_full (local.get $arg0))
                ;; SWP_SHOWWINDOW: the frame itself is appearing, so the
                ;; non-client area needs painting, not just a composite.
                (call $host_invalidate_frame (local.get $arg0)))
              (else (call $paint_flag_set_inv (local.get $arg0))))))))
    (if (i32.and (local.get $uFlags) (i32.const 0x0080)) ;; SWP_HIDEWINDOW
      (then
        (drop (call $wnd_set_style (local.get $arg0)
          (i32.and (call $wnd_get_style (local.get $arg0)) (i32.const 0xEFFFFFFF))))
        (call $paint_clear_subtree (local.get $arg0))))
    (call $defwndproc_do_nccalcsize (local.get $arg0))
    (call $host_sync_window_client
      (local.get $arg0)
      (call $wnd_client_screen_x (local.get $arg0))
      (call $wnd_client_screen_y (local.get $arg0))
      (i32.sub (call $client_rect_get_r (local.get $arg0)) (call $client_rect_get_l (local.get $arg0)))
      (i32.sub (call $client_rect_get_b (local.get $arg0)) (call $client_rect_get_t (local.get $arg0))))
    ;; SetWindowPos can resize retained-DC controls; refresh after NCCALCSIZE.
    (if (i32.ne (local.get $new_wh) (local.get $old_wh))
      (then (call $gdi_refresh_window_dc_system_clips)))
    (call $windowpos_message_update
      (local.get $windowpos) (local.get $arg0) (local.get $insert_after)
      (local.get $x) (local.get $y) (local.get $cx) (local.get $cy)
      (local.get $uFlags))
    (call $windowpos_message_end (local.get $windowpos) (local.get $arg0))
    ;; Repaint a moved WAT-native control immediately, but only if it is
    ;; actually on screen. Its own WS_VISIBLE bit is not enough: a control
    ;; inside a hidden dialog page keeps that bit set, and painting it writes
    ;; onto the top-level back-canvas at a position the page is about to leave,
    ;; where nothing will erase it. $handle_DeferWindowPos already tests it
    ;; this way.
    (if (i32.and
          (i32.and
            (i32.ne (call $ctrl_table_get_class (local.get $arg0)) (i32.const 0))
            (call $wnd_is_effectively_visible (local.get $arg0)))
          (i32.eqz (i32.and (local.get $uFlags) (i32.const 0x0008)))) ;; !SWP_NOREDRAW
      (then
        (drop (call $control_wndproc_dispatch
          (local.get $arg0) (i32.const 0x000F) (i32.const 0) (i32.const 0)))))
    (if (i32.eqz (i32.and (local.get $uFlags) (i32.const 0x0008))) ;; !SWP_NOREDRAW
      (then
        (local.set $dlg_rec (call $dlg_record_for_hwnd (local.get $arg0)))
        (if (i32.and
              (i32.and
                (i32.ne (local.get $dlg_rec) (i32.const 0))
                (i32.ne (i32.load offset=4 (local.get $dlg_rec)) (i32.const 0)))
              (i32.lt_s (call $wnd_get_class_slot (local.get $arg0)) (i32.const 0)))
          (then (drop (call $host_erase_background (local.get $arg0) (i32.const 16)))))))
    (global.set $eax (i32.const 1))
    (global.set $esp (i32.add (global.get $esp) (i32.const 32)))
  )

  ;; 142: DrawTextA(hdc, lpString, nCount, lpRect, uFormat)
  (func $handle_DrawTextA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $host_gdi_draw_text
      (local.get $arg0)
      (call $g2w (local.get $arg1))
      (local.get $arg2)
      (call $g2w (local.get $arg3))
      (local.get $arg4)
      (i32.const 0) ;; isWide = 0
    ))
    (global.set $esp (i32.add (global.get $esp) (i32.const 24)))  ;; stdcall, 5 args
  )

  ;; DrawTextEx applies DRAWTEXTPARAMS around the common DrawText backend.
  ;; Margins are logical rectangle units; the tab length is an average-cell
  ;; count consumed directly by the WAT bitmap layout without overlapping the
  ;; legacy DrawText DT_TABSTOP bits.
  (func $draw_text_ex (param $hdc i32) (param $text_guest i32) (param $count i32)
        (param $rect_guest i32) (param $format i32) (param $params_guest i32)
        (param $wide i32) (result i32)
    (local $text i32) (local $rect i32) (local $params i32) (local $valid i32)
    (local $left i32) (local $top i32) (local $right i32) (local $bottom i32)
    (local $left_margin i32) (local $right_margin i32) (local $tab_chars i32)
    (local $result i32) (local $drawn i32) (local $calculated_right i32)
    (local.set $text (call $g2w (local.get $text_guest)))
    (local.set $rect (call $g2w (local.get $rect_guest)))
    (if (local.get $params_guest)
      (then
        (local.set $params (call $g2w (local.get $params_guest)))
        (local.set $valid (i32.ge_u (i32.load (local.get $params)) (i32.const 20)))))
    (if (i32.and (local.get $valid) (i32.ne (local.get $rect_guest) (i32.const 0)))
      (then
        (local.set $left (load.field Rect left (local.get $rect)))
        (local.set $top (load.field.memarg Rect top (local.get $rect)))
        (local.set $right (load.field.memarg Rect right (local.get $rect)))
        (local.set $bottom (load.field.memarg Rect bottom (local.get $rect)))
        (local.set $left_margin (i32.load offset=8 (local.get $params)))
        (local.set $right_margin (i32.load offset=12 (local.get $params)))
        (store.field Rect left (local.get $rect) (i32.add (local.get $left) (local.get $left_margin)))
        (store.field.memarg Rect right (local.get $rect)
          (i32.sub (local.get $right) (local.get $right_margin)))))
    (if (i32.and (local.get $valid)
          (i32.ne (i32.and (local.get $format) (i32.const 0x40)) (i32.const 0)))
      (then
        (local.set $tab_chars (i32.load offset=4 (local.get $params)))
        (if (i32.lt_s (local.get $tab_chars) (i32.const 0))
          (then (local.set $tab_chars (i32.const 0))))
        (if (i32.gt_s (local.get $tab_chars) (i32.const 255))
          (then (local.set $tab_chars (i32.const 255))))))
    (global.set $gdi_bitmap_draw_text_tab_chars (local.get $tab_chars))
    (local.set $result (call $host_gdi_draw_text
      (local.get $hdc) (local.get $text) (local.get $count) (local.get $rect)
      (local.get $format) (local.get $wide)))
    (global.set $gdi_bitmap_draw_text_tab_chars (i32.const 0))
    (if (local.get $valid)
      (then
        (local.set $drawn (local.get $count))
        (if (i32.eq (local.get $drawn) (i32.const -1))
          (then (local.set $drawn
            (if (result i32) (local.get $wide)
              (then (call $strlen_w (local.get $text)))
              (else (call $strlen_a (local.get $text)))))))
        (if (i32.lt_s (local.get $drawn) (i32.const 0))
          (then (local.set $drawn (i32.const 0))))
        (i32.store offset=16 (local.get $params) (local.get $drawn))))
    (if (i32.and (local.get $valid) (i32.ne (local.get $rect_guest) (i32.const 0)))
      (then
        (if (i32.ne (i32.and (local.get $format) (i32.const 0x400)) (i32.const 0))
          (then
            (local.set $calculated_right (load.field.memarg Rect right (local.get $rect)))
            (store.field Rect left (local.get $rect) (local.get $left))
            (store.field.memarg Rect top (local.get $rect) (local.get $top))
            (store.field.memarg Rect right (local.get $rect)
              (i32.add (local.get $calculated_right) (local.get $right_margin))))
          (else
            (store.field Rect left (local.get $rect) (local.get $left))
            (store.field.memarg Rect top (local.get $rect) (local.get $top))
            (store.field.memarg Rect right (local.get $rect) (local.get $right))
            (store.field.memarg Rect bottom (local.get $rect) (local.get $bottom))))))
    (local.get $result))

  ;; DrawTextExA(hdc, lpString, nCount, lpRect, uFormat, lpDTParams)
  (func $handle_DrawTextExA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $draw_text_ex
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4)
      (call $gl32 (i32.add (global.get $esp) (i32.const 24)))
      (i32.const 0)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 28)))  ;; stdcall, 6 args
  )

  ;; DrawEdge(hdc, qrc, edge, grfFlags) — 4 args stdcall
  (func $handle_DrawEdge (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $rc i32) (local $desc i32)
    (local.set $rc (call $g2w (local.get $arg1)))
    (local.set $desc (global.get $GDI_LINE_DESC))
    (if (call $gdi_surface_descriptor (local.get $arg0) (local.get $desc))
      (then (global.set $eax (call $gdi_draw_edge_desc
        (local.get $arg0) (local.get $desc)
        (load.field Rect left (local.get $rc)) (load.field.memarg Rect top (local.get $rc))
        (load.field.memarg Rect right (local.get $rc)) (load.field.memarg Rect bottom (local.get $rc))
        (local.get $arg2) (local.get $arg3) (local.get $rc))))
      (else (global.set $eax (i32.const 0))))
    (global.set $esp (i32.add (global.get $esp) (i32.const 20)))
  )

  ;; 144: GetClipboardData(uFormat) → HANDLE
  ;; CF_TEXT/CF_OEMTEXT plus registered non-OLE Rich Text Format clipboard
  ;; data. Handles are direct heap pointers, matching the emulator's GlobalLock
  ;; identity behavior.
  (func $handle_GetClipboardData (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (drop (local.get $arg1))
    (drop (local.get $arg2))
    (drop (local.get $arg3))
    (drop (local.get $arg4))
    (drop (local.get $name_ptr))
    (if (i32.eqz (global.get $clipboard_open))
      (then
        (global.set $last_error (i32.const 1418)) ;; ERROR_CLIPBOARD_NOT_OPEN
        (global.set $eax (i32.const 0))
        (global.set $esp (i32.add (global.get $esp) (i32.const 8)))
        (return)))
    (global.set $eax (call $clipboard_get_data_handle (local.get $arg0)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8)))
  )


  ;; 187: KillTimer(hwnd, nIDEvent) — clear the timer
  (func $handle_KillTimer (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $timer_kill (local.get $arg0) (local.get $arg1)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12)))
  )

  ;; 188: SetTimer
  (func $timer_next_auto_id (result i32)
    (i32.add (i32.const 0x1001)
      (i32.atomic.rmw.add offset=4 (global.get $TIMER_SHARED) (i32.const 1))))

  (func $handle_SetTimer (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $tid i32)
    (local.set $tid (local.get $arg1))
    ;; Only thread timers need an auto-generated ID. A window timer retains
    ;; the caller's ID verbatim, including zero, because WM_TIMER and
    ;; KillTimer identify it with that same value.
    (if (i32.and (i32.eqz (local.get $arg0)) (i32.eqz (local.get $tid)))
      (then
        (local.set $tid (call $timer_next_auto_id))))
    (call $timer_set (local.get $arg0) (local.get $tid) (local.get $arg2) (local.get $arg3))
    ;; Window-timer success is boolean; do not turn an ID-zero timer into an
    ;; apparent failure even though its delivered/stored ID stays zero.
    (global.set $eax
      (select (i32.const 1) (local.get $tid)
        (i32.and (i32.ne (local.get $arg0) (i32.const 0)) (i32.eqz (local.get $tid)))))
    (global.set $esp (i32.add (global.get $esp) (i32.const 20))) (return)
  )

  ;; 189: FindWindowA(lpClassName, lpWindowName). USER searches only top-level
  ;; windows and compares both optional filters case-insensitively.
  (func $handle_FindWindowA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $find_window_core
      (i32.const 0) (i32.const 0) (local.get $arg0) (local.get $arg1)
      (i32.const 0)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12)))  ;; stdcall, 2 args
  )

  ;; 915: SearchPathA(lpPath, lpFileName, lpExtension, nBufLen, lpBuffer, lpFilePart) — 6 args stdcall
  ;; SearchPath{A,W}(lpPath, lpFileName, lpExtension, nBufLen, lpBuffer, lpFilePart).
  ;; The host walks the VFS the same way for both spellings; $wide only decides
  ;; how it reads the three input strings and writes the result back.
  (func $search_path (param $path_g i32) (param $file_g i32) (param $ext_g i32)
                     (param $buflen i32) (param $buf_g i32) (param $part_g i32)
                     (param $wide i32) (result i32)
    (call $host_fs_search_path
      (select (i32.const 0) (call $g2w (local.get $path_g)) (i32.eqz (local.get $path_g)))
      (select (i32.const 0) (call $g2w (local.get $file_g)) (i32.eqz (local.get $file_g)))
      (select (i32.const 0) (call $g2w (local.get $ext_g)) (i32.eqz (local.get $ext_g)))
      (local.get $buflen)
      (local.get $buf_g)       ;; guest addr, host g2w's
      (local.get $part_g)      ;; filePartPtrGA
      (local.get $wide)))

  (func $handle_SearchPathA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; 6th arg (lpFilePart) lives at esp+24 (skip ret addr + 5 visible args)
    (global.set $eax (call $search_path
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4)
      (call $gl32 (i32.add (global.get $esp) (i32.const 24)))
      (i32.const 0)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 28)))  ;; stdcall, 6 args
  )

  ;; 914: DllUnregisterServer() — no-op, return S_OK
  (func $handle_DllUnregisterServer (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (i32.const 0))  ;; S_OK
    (global.set $esp (i32.add (global.get $esp) (i32.const 4)))  ;; stdcall, 0 args
  )

  ;; DllRegisterServer: no generic registration implementation. A native DLL's
  ;; own export must perform its registration; never fabricate that success.
  (func $handle_DllRegisterServer (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $crash_unimplemented (local.get $name_ptr))
    (global.set $esp (i32.add (global.get $esp) (i32.const 4))))

  ;; One candidate against FindWindowEx's two filters. Either guest pointer
  ;; may be 0, which means "any". A class is matched through the class table
  ;; rather than by string, so the MAKEINTATOM form of a class key selects the
  ;; same record its name does; a title is compared case-insensitively against
  ;; the window's stored text, the way USER's own comparison does.
  (func $find_window_matches (param $hwnd i32) (param $class_g i32)
                             (param $title_g i32) (param $wide i32) (result i32)
    (local $slot i32) (local $title_wa i32)
    (if (local.get $class_g)
      (then
        (local.set $slot (call $class_find_slot
          (if (result i32) (local.get $wide)
            (then (call $class_wide_name_key (local.get $class_g)))
            (else (call $class_name_key (local.get $class_g))))))
        (if (i32.lt_s (local.get $slot) (i32.const 0)) (then (return (i32.const 0))))
        (if (i32.ne (local.get $slot) (call $wnd_get_class_slot (local.get $hwnd)))
          (then (return (i32.const 0))))))
    (if (local.get $title_g)
      (then
        (local.set $title_wa (call $title_table_get_ptr (local.get $hwnd)))
        (if (i32.eqz (local.get $title_wa)) (then (return (i32.const 0))))
        (if (i32.eqz
              (if (result i32) (local.get $wide)
                (then (call $wide_ascii_eq
                  (call $g2w (local.get $title_g)) (local.get $title_wa)))
                (else (call $guest_ansi_eq_wasm_ci
                  (local.get $title_g) (local.get $title_wa)))))
          (then (return (i32.const 0))))))
    (i32.const 1))

  ;; Highest sibling in USER's WAT-owned Z order. parent=0 selects top-level
  ;; records, the WAT equivalent of treating the desktop as their parent.
  (func $find_window_z_first (param $parent i32) (result i32)
    (local $i i32) (local $hwnd i32) (local $rank i32)
    (local $best i32) (local $best_rank i32)
    (local.set $i (i32.const 0))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (global.get $MAX_WINDOWS)))
      (local.set $hwnd (call $wnd_slot_hwnd (local.get $i)))
      (if (i32.and
            (i32.ne (local.get $hwnd) (i32.const 0))
            (i32.eq (call $wnd_get_parent (local.get $hwnd)) (local.get $parent)))
        (then
          (local.set $rank (call $wnd_z_get (local.get $hwnd)))
          (if (i32.or
                (i32.eqz (local.get $best))
                (i32.gt_s (local.get $rank) (local.get $best_rank)))
            (then
              (local.set $best (local.get $hwnd))
              (local.set $best_rank (local.get $rank))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (local.get $best))

  ;; Highest sibling below hwndChildAfter. SetWindowPos owns the rank updates,
  ;; so this follows live Z-order mutations instead of window allocation slots.
  (func $find_window_z_next (param $parent i32) (param $after i32) (result i32)
    (local $i i32) (local $hwnd i32) (local $rank i32)
    (local $after_rank i32) (local $best i32) (local $best_rank i32)
    (local.set $after_rank (call $wnd_z_get (local.get $after)))
    (local.set $i (i32.const 0))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (global.get $MAX_WINDOWS)))
      (local.set $hwnd (call $wnd_slot_hwnd (local.get $i)))
      (if (i32.and
            (i32.ne (local.get $hwnd) (i32.const 0))
            (i32.eq (call $wnd_get_parent (local.get $hwnd)) (local.get $parent)))
        (then
          (local.set $rank (call $wnd_z_get (local.get $hwnd)))
          (if (i32.and
                (i32.lt_s (local.get $rank) (local.get $after_rank))
                (i32.or
                  (i32.eqz (local.get $best))
                  (i32.gt_s (local.get $rank) (local.get $best_rank))))
            (then
              (local.set $best (local.get $hwnd))
              (local.set $best_rank (local.get $rank))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (local.get $best))

  ;; Shared FindWindow/FindWindowEx walk. A non-null hwndChildAfter must be a
  ;; live direct child of the requested parent; accepting an unrelated window
  ;; would silently continue in the wrong tree. Candidates are visited from
  ;; top to bottom in the same sibling Z order SetWindowPos mutates.
  (func $find_window_core (param $parent i32) (param $after i32)
                          (param $class_g i32) (param $title_g i32)
                          (param $wide i32) (result i32)
    (local $cur i32)
    (if (local.get $after)
      (then
        (if (i32.or
              (i32.eq (call $wnd_table_find (local.get $after)) (i32.const -1))
              (i32.ne (call $wnd_get_parent (local.get $after)) (local.get $parent)))
          (then (return (i32.const 0))))
        (local.set $cur
          (call $find_window_z_next (local.get $parent) (local.get $after))))
      (else
        (local.set $cur (call $find_window_z_first (local.get $parent)))))
    (block $done (loop $scan
      (br_if $done (i32.eqz (local.get $cur)))
      (if (call $find_window_matches
            (local.get $cur) (local.get $class_g) (local.get $title_g)
            (local.get $wide))
        (then (return (local.get $cur))))
      (local.set $cur
        (call $find_window_z_next (local.get $parent) (local.get $cur)))
      (br $scan)))
    (i32.const 0))

  ;; 913: FindWindowExA(hwndParent, hwndChildAfter, lpszClass, lpszWindow)
  ;; Walks hwndParent's direct children in Z order, resuming after
  ;; hwndChildAfter when one is given. Winamp's "Winamp Gen" frame locates the
  ;; embedded plug-in window it has to size with exactly this call --
  ;; FindWindowEx(parent, 0, 0, 0) from its WM_SIZE/WM_SHOWWINDOW arm -- so
  ;; while this answered NULL every embedded plug-in kept the 100x100 box it
  ;; was created with instead of being fitted to the frame's client area. AVS
  ;; was the visible case: its visualisation drew as a small square over the
  ;; window's titlebar.
  ;;
  (func $handle_FindWindowExA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $find_window_core
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3)
      (i32.const 0)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 20)))  ;; stdcall, 4 args
  )

  ;; 190: BringWindowToTop(hWnd) — 1 arg stdcall
  ;; Raise the HWND among siblings, then activate its associated top-level window.
  (func $handle_BringWindowToTop (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $top i32)
    (local.set $top (call $wnd_top_level (local.get $arg0)))
    (call $host_set_window_zorder (local.get $arg0) (i32.const 0)) (global.set $eax (call $host_activate_window (local.get $arg0))) ;; HWND_TOP then activate
    (if (i32.and
          (i32.ge_s (call $wnd_table_find (local.get $top)) (i32.const 0))
          (i32.eq (call $wnd_get_thread (local.get $top)) (global.get $current_thread_id)))
      (then (drop (call $active_window_transition (local.get $top)))))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8)))  ;; stdcall, 1 arg
  )

  ;; 191: GetPrivateProfileIntA(lpAppName, lpKeyName, nDefault, lpFileName)
  ;; No INI file support — return nDefault (arg2)
  (func $handle_GetPrivateProfileIntA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; GetPrivateProfileIntA(appName, keyName, nDefault, fileName) — 4 args stdcall
    (global.set $eax (call $host_ini_get_int
      (call $g2w (local.get $arg0))
      (call $g2w (local.get $arg1))
      (local.get $arg2)
      (call $g2w (local.get $arg3))
      (i32.const 0)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 20)))
  )

  ;; 192: WritePrivateProfileStringA(appName, keyName, string, fileName) — 4 args stdcall
  (func $handle_WritePrivateProfileStringA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $host_ini_write_string
      (call $g2w (local.get $arg0))
      (if (result i32) (local.get $arg1) (then (call $g2w (local.get $arg1))) (else (i32.const 0)))
      (if (result i32) (local.get $arg2) (then (call $g2w (local.get $arg2))) (else (i32.const 0)))
      (call $g2w (local.get $arg3))
      (i32.const 0)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 20)))
  )

  (func $write_private_profile_section (param $app i32) (param $strings i32) (param $file i32) (param $wide i32)
    (local $error i32)
    (local.set $error (call $host_ini_write_section
      (if (result i32) (local.get $app) (then (call $g2w (local.get $app))) (else (i32.const 0)))
      (if (result i32) (local.get $strings) (then (call $g2w (local.get $strings))) (else (i32.const 0)))
      (if (result i32) (local.get $file) (then (call $g2w (local.get $file))) (else (i32.const 0)))
      (local.get $wide)))
    (if (local.get $error) (then (global.set $last_error (local.get $error))))
    (global.set $eax (i32.eqz (local.get $error))))

  (func $handle_WritePrivateProfileSectionA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $write_private_profile_section (local.get $arg0) (local.get $arg1) (local.get $arg2) (i32.const 0))
    (global.set $esp (i32.add (global.get $esp) (i32.const 16))))

  (func $handle_WritePrivateProfileSectionW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $write_private_profile_section (local.get $arg0) (local.get $arg1) (local.get $arg2) (i32.const 1))
    (global.set $esp (i32.add (global.get $esp) (i32.const 16))))

  ;; 193: ShellExecuteA(hwnd, lpOperation, lpFile, lpParameters, lpDirectory, nShowCmd)
  (func $handle_ShellExecuteA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $host_shell_execute
      (local.get $arg0)
      (if (result i32) (local.get $arg1) (then (call $g2w (local.get $arg1))) (else (i32.const 0)))
      (if (result i32) (local.get $arg2) (then (call $g2w (local.get $arg2))) (else (i32.const 0)))
      (if (result i32) (local.get $arg3) (then (call $g2w (local.get $arg3))) (else (i32.const 0)))
      (if (result i32) (local.get $arg4) (then (call $g2w (local.get $arg4))) (else (i32.const 0)))
      (call $gl32 (i32.add (global.get $esp) (i32.const 24))))) ;; nShowCmd
    (drop (local.get $name_ptr))
    (global.set $esp (i32.add (global.get $esp) (i32.const 28)))  ;; 6 args + ret
  )

  ;; 194: ShellAboutA(hwnd, szApp, szOtherStuff, hIcon) — show About dialog
  ;; ShellAbout's strings come straight from the guest call. No PE
  ;; version-resource parsing needed; WAT can build the dialog entirely
  ;; from the args. The host_shell_about import only logs (so the
  ;; existing [ShellAbout] log gate keeps firing); all rendering state
  ;; comes from $create_about_dialog → $host_register_dialog_frame +
  ;; $ctrl_create_child.
  (func $handle_ShellAboutA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $dlg i32)
    (local.set $dlg (global.get $next_hwnd))
    (global.set $next_hwnd (i32.add (global.get $next_hwnd) (i32.const 1)))
    (drop (call $host_shell_about
      (local.get $dlg) (local.get $arg0) (call $g2w (local.get $arg1))))
    (call $create_about_dialog
      (local.get $dlg) (local.get $arg0)
      (local.get $arg1) (local.get $arg2))
    (global.set $eax (i32.const 1))
    (global.set $esp (i32.add (global.get $esp) (i32.const 20)))
  )

  ;; 195: SHGetSpecialFolderPathA(hwnd, pszPath, csidl, fCreate) -> BOOL.
  ;; Use SHGetFolderPathW's canonical CSIDL table, then narrow its result. This
  ;; keeps the ANSI legacy export aligned with the Win2k shfolder forwarder.
  (func $handle_SHGetSpecialFolderPathA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $saved_esp i32) (local $wide i32) (local $hr i32) (local $folder i32)
    (local.set $saved_esp (global.get $esp))
    (if (i32.eqz (local.get $arg1))
      (then
        (global.set $eax (i32.const 0))
        (global.set $esp (i32.add (global.get $esp) (i32.const 20)))
        (return)))
    (local.set $wide (call $heap_alloc (i32.const 520)))
    (if (i32.eqz (local.get $wide))
      (then
        (call $gs8 (local.get $arg1) (i32.const 0))
        (global.set $eax (i32.const 0))
        (global.set $esp (i32.add (global.get $esp) (i32.const 20)))
        (return)))
    (local.set $folder (local.get $arg2))
    (if (local.get $arg3)
      (then (local.set $folder (i32.or (local.get $folder) (i32.const 0x8000)))))
    (call $handle_SHGetFolderPathW
      (local.get $arg0) (local.get $folder) (i32.const 0) (i32.const 0)
      (local.get $wide) (local.get $name_ptr))
    (local.set $hr (global.get $eax))
    (global.set $esp (local.get $saved_esp))
    (if (i32.eqz (local.get $hr))
      (then
        (drop (call $wide_to_ansi (local.get $wide) (local.get $arg1) (i32.const 260)))
        (global.set $eax (i32.const 1)))
      (else
        (call $gs8 (local.get $arg1) (i32.const 0))
        (global.set $eax (i32.const 0))))
    (call $heap_free (local.get $wide))
    (global.set $esp (i32.add (global.get $esp) (i32.const 20)))
  )

  ;; CSIDL_FLAG_CREATE asks the shell path API to create the returned folder.
  ;; The host VFS accepts the UTF-16 path we just wrote and creates its parent
  ;; entry as well; an already-present path is still a successful lookup.
  (func $sh_folder_maybe_create (param $nFolder i32) (param $dst i32)
    (if (i32.and (local.get $nFolder) (i32.const 0x8000))
      (then (drop (call $host_fs_create_directory
        (local.get $dst) (i32.const 1))))))

  ;; SHGetFolderPathW(hwndOwner, nFolder, hToken, dwFlags, pszPath) -> HRESULT.
  ;; The Win2k shfolder forwarder resolves this dynamically before trying its
  ;; legacy shell32 ordinal. Return the canonical paths for the system and
  ;; Program Files CSIDLs used by setup engines; pszPath is always MAX_PATH.
  (func $handle_SHGetFolderPathW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $dst i32) (local $folder i32)
    (drop (local.get $arg0)) (drop (local.get $arg2))
    (drop (local.get $arg3)) (drop (local.get $name_ptr))
    ;; Mask CSIDL_FLAG_* from the high bits before selecting the folder.
    (local.set $folder (i32.and (local.get $arg1) (i32.const 0x00ff)))
    (if (i32.eqz (local.get $arg4))
      (then
        (global.set $eax (i32.const 0x80004003)) ;; E_POINTER
        (global.set $esp (i32.add (global.get $esp) (i32.const 24)))
        (return)))
    (local.set $dst (call $g2w (local.get $arg4)))

    ;; CSIDL_DESKTOPDIRECTORY(0x10): the current user's physical desktop.
    ;; Inno Setup requests this for its {userdesktop} shortcut target.
    (if (i32.eq (local.get $folder) (i32.const 0x10))
      (then
        ;; UTF-16LE "C:\\WINDOWS\\Desktop\0".
        (i32.store (local.get $dst) (i32.const 0x003a0043))
        (i32.store offset=4 (local.get $dst) (i32.const 0x0057005c))
        (i32.store offset=8 (local.get $dst) (i32.const 0x004e0049))
        (i32.store offset=12 (local.get $dst) (i32.const 0x004f0044))
        (i32.store offset=16 (local.get $dst) (i32.const 0x00530057))
        (i32.store offset=20 (local.get $dst) (i32.const 0x0044005c))
        (i32.store offset=24 (local.get $dst) (i32.const 0x00730065))
        (i32.store offset=28 (local.get $dst) (i32.const 0x0074006b))
        (i32.store offset=32 (local.get $dst) (i32.const 0x0070006f))
        (i32.store16 offset=36 (local.get $dst) (i32.const 0))
        (call $sh_folder_maybe_create (local.get $arg1) (local.get $dst))
        (global.set $eax (i32.const 0))
        (global.set $esp (i32.add (global.get $esp) (i32.const 24)))
        (return)))

    ;; CSIDL_PROGRAMS(0x02): the Win2k shfolder used by Unicode Inno Setup
    ;; reads the all-users Common Programs value on this compatibility path.
    (if (i32.eq (local.get $folder) (i32.const 0x02))
      (then
        ;; UTF-16LE "C:\\WINDOWS\\Start Menu\\Programs\0".
        (i32.store (local.get $dst) (i32.const 0x003a0043))
        (i32.store offset=4 (local.get $dst) (i32.const 0x0057005c))
        (i32.store offset=8 (local.get $dst) (i32.const 0x004e0049))
        (i32.store offset=12 (local.get $dst) (i32.const 0x004f0044))
        (i32.store offset=16 (local.get $dst) (i32.const 0x00530057))
        (i32.store offset=20 (local.get $dst) (i32.const 0x0053005c))
        (i32.store offset=24 (local.get $dst) (i32.const 0x00610074))
        (i32.store offset=28 (local.get $dst) (i32.const 0x00740072))
        (i32.store offset=32 (local.get $dst) (i32.const 0x004d0020))
        (i32.store offset=36 (local.get $dst) (i32.const 0x006e0065))
        (i32.store offset=40 (local.get $dst) (i32.const 0x005c0075))
        (i32.store offset=44 (local.get $dst) (i32.const 0x00720050))
        (i32.store offset=48 (local.get $dst) (i32.const 0x0067006f))
        (i32.store offset=52 (local.get $dst) (i32.const 0x00610072))
        (i32.store offset=56 (local.get $dst) (i32.const 0x0073006d))
        (i32.store16 offset=60 (local.get $dst) (i32.const 0))
        (call $sh_folder_maybe_create (local.get $arg1) (local.get $dst))
        (global.set $eax (i32.const 0))
        (global.set $esp (i32.add (global.get $esp) (i32.const 24)))
        (return)))

    ;; CSIDL_COMMON_APPDATA(0x17).
    (if (i32.eq (local.get $folder) (i32.const 0x17))
      (then
        ;; UTF-16LE "C:\\WINDOWS\\All Users\\Application Data\0".
        (i32.store (local.get $dst) (i32.const 0x003a0043))
        (i32.store offset=4 (local.get $dst) (i32.const 0x0057005c))
        (i32.store offset=8 (local.get $dst) (i32.const 0x004e0049))
        (i32.store offset=12 (local.get $dst) (i32.const 0x004f0044))
        (i32.store offset=16 (local.get $dst) (i32.const 0x00530057))
        (i32.store offset=20 (local.get $dst) (i32.const 0x0041005c))
        (i32.store offset=24 (local.get $dst) (i32.const 0x006c006c))
        (i32.store offset=28 (local.get $dst) (i32.const 0x00550020))
        (i32.store offset=32 (local.get $dst) (i32.const 0x00650073))
        (i32.store offset=36 (local.get $dst) (i32.const 0x00730072))
        (i32.store offset=40 (local.get $dst) (i32.const 0x0041005c))
        (i32.store offset=44 (local.get $dst) (i32.const 0x00700070))
        (i32.store offset=48 (local.get $dst) (i32.const 0x0069006c))
        (i32.store offset=52 (local.get $dst) (i32.const 0x00610063))
        (i32.store offset=56 (local.get $dst) (i32.const 0x00690074))
        (i32.store offset=60 (local.get $dst) (i32.const 0x006e006f))
        (i32.store offset=64 (local.get $dst) (i32.const 0x00440020))
        (i32.store offset=68 (local.get $dst) (i32.const 0x00740061))
        (i32.store offset=72 (local.get $dst) (i32.const 0x00000061))
        (call $sh_folder_maybe_create (local.get $arg1) (local.get $dst))
        (global.set $eax (i32.const 0))
        (global.set $esp (i32.add (global.get $esp) (i32.const 24)))
        (return)))

    ;; CSIDL_PROGRAM_FILES(0x26)/PROGRAM_FILESX86(0x2A):
    ;; UTF-16LE "C:\\Program Files\0".
    (if (i32.or (i32.eq (local.get $folder) (i32.const 0x26))
                (i32.eq (local.get $folder) (i32.const 0x2a)))
      (then
        (i32.store (local.get $dst) (i32.const 0x003a0043))
        (i32.store offset=4 (local.get $dst) (i32.const 0x0050005c))
        (i32.store offset=8 (local.get $dst) (i32.const 0x006f0072))
        (i32.store offset=12 (local.get $dst) (i32.const 0x00720067))
        (i32.store offset=16 (local.get $dst) (i32.const 0x006d0061))
        (i32.store offset=20 (local.get $dst) (i32.const 0x00460020))
        (i32.store offset=24 (local.get $dst) (i32.const 0x006c0069))
        (i32.store offset=28 (local.get $dst) (i32.const 0x00730065))
        (i32.store16 offset=32 (local.get $dst) (i32.const 0))
        (call $sh_folder_maybe_create (local.get $arg1) (local.get $dst))
        (global.set $eax (i32.const 0))
        (global.set $esp (i32.add (global.get $esp) (i32.const 24)))
        (return)))

    ;; CSIDL_PROGRAM_FILES_COMMON(0x2B)/COMMONX86(0x2C):
    ;; UTF-16LE "C:\\Program Files\\Common Files\0".
    (if (i32.or (i32.eq (local.get $folder) (i32.const 0x2b))
                (i32.eq (local.get $folder) (i32.const 0x2c)))
      (then
        (i32.store (local.get $dst) (i32.const 0x003a0043))
        (i32.store offset=4 (local.get $dst) (i32.const 0x0050005c))
        (i32.store offset=8 (local.get $dst) (i32.const 0x006f0072))
        (i32.store offset=12 (local.get $dst) (i32.const 0x00720067))
        (i32.store offset=16 (local.get $dst) (i32.const 0x006d0061))
        (i32.store offset=20 (local.get $dst) (i32.const 0x00460020))
        (i32.store offset=24 (local.get $dst) (i32.const 0x006c0069))
        (i32.store offset=28 (local.get $dst) (i32.const 0x00730065))
        (i32.store offset=32 (local.get $dst) (i32.const 0x0043005c))
        (i32.store offset=36 (local.get $dst) (i32.const 0x006d006f))
        (i32.store offset=40 (local.get $dst) (i32.const 0x006f006d))
        (i32.store offset=44 (local.get $dst) (i32.const 0x0020006e))
        (i32.store offset=48 (local.get $dst) (i32.const 0x00690046))
        (i32.store offset=52 (local.get $dst) (i32.const 0x0065006c))
        (i32.store offset=56 (local.get $dst) (i32.const 0x00000073))
        (call $sh_folder_maybe_create (local.get $arg1) (local.get $dst))
        (global.set $eax (i32.const 0))
        (global.set $esp (i32.add (global.get $esp) (i32.const 24)))
        (return)))

    ;; CSIDL_WINDOWS(0x24) and CSIDL_SYSTEM(0x25)/SYSTEMX86(0x29).
    (if (i32.or (i32.eq (local.get $folder) (i32.const 0x24))
          (i32.or (i32.eq (local.get $folder) (i32.const 0x25))
                  (i32.eq (local.get $folder) (i32.const 0x29))))
      (then
        (i32.store (local.get $dst) (i32.const 0x003a0043))
        (i32.store offset=4 (local.get $dst) (i32.const 0x0057005c))
        (i32.store offset=8 (local.get $dst) (i32.const 0x004e0049))
        (i32.store offset=12 (local.get $dst) (i32.const 0x004f0044))
        (i32.store offset=16 (local.get $dst) (i32.const 0x00530057))
        (if (i32.eq (local.get $folder) (i32.const 0x24))
          (then (i32.store16 offset=20 (local.get $dst) (i32.const 0)))
          (else
            (i32.store offset=20 (local.get $dst) (i32.const 0x0053005c))
            (i32.store offset=24 (local.get $dst) (i32.const 0x00530059))
            (i32.store offset=28 (local.get $dst) (i32.const 0x00450054))
            (i32.store offset=32 (local.get $dst) (i32.const 0x0000004d))))
        (call $sh_folder_maybe_create (local.get $arg1) (local.get $dst))
        (global.set $eax (i32.const 0))
        (global.set $esp (i32.add (global.get $esp) (i32.const 24)))
        (return)))

    (i32.store16 (local.get $dst) (i32.const 0))
    (global.set $eax (i32.const 0x80070002)) ;; HRESULT_FROM_WIN32(ERROR_FILE_NOT_FOUND)
    (global.set $esp (i32.add (global.get $esp) (i32.const 24)))
  )

  ;; SHGetFolderPathA(hwndOwner, nFolder, hToken, dwFlags, pszPath) -> HRESULT.
  ;; ANSI forwarder for setup engines that dynamically resolve the A spelling.
  (func $handle_SHGetFolderPathA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $saved_esp i32) (local $wide i32) (local $hr i32)
    (local.set $saved_esp (global.get $esp))
    (if (i32.eqz (local.get $arg4))
      (then
        (global.set $eax (i32.const 0x80004003)) ;; E_POINTER
        (global.set $esp (i32.add (global.get $esp) (i32.const 24)))
        (return)))
    (local.set $wide (call $heap_alloc (i32.const 520)))
    (if (i32.eqz (local.get $wide))
      (then
        (call $gs8 (local.get $arg4) (i32.const 0))
        (global.set $eax (i32.const 0x8007000e)) ;; E_OUTOFMEMORY
        (global.set $esp (i32.add (global.get $esp) (i32.const 24)))
        (return)))
    (call $handle_SHGetFolderPathW
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3)
      (local.get $wide) (local.get $name_ptr))
    (local.set $hr (global.get $eax))
    (global.set $esp (local.get $saved_esp))
    (if (i32.eqz (local.get $hr))
      (then
        (drop (call $wide_to_ansi (local.get $wide) (local.get $arg4) (i32.const 260))))
      (else
        (call $gs8 (local.get $arg4) (i32.const 0))))
    (call $heap_free (local.get $wide))
    (global.set $eax (local.get $hr))
    (global.set $esp (i32.add (global.get $esp) (i32.const 24)))
  )

  ;; 196: DragAcceptFiles(hwnd, fAccept). Win9x records this as the
  ;; WS_EX_ACCEPTFILES bit on the destination window; the browser shell reads
  ;; the same WAT-owned style through $drop_target_at before constructing an
  ;; HDROP and posting WM_DROPFILES.
  (func $handle_DragAcceptFiles (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $ex i32)
    (local.set $ex (call $ctrl_get_ex_style (local.get $arg0)))
    (if (local.get $arg1)
      (then (local.set $ex (i32.or (local.get $ex) (i32.const 0x10))))
      (else (local.set $ex (i32.and (local.get $ex) (i32.const -17)))))
    (call $ctrl_set_ex_style (local.get $arg0) (local.get $ex))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12)))
  )

  ;; Query one path in the DROPFILES payload. The format describes the source
  ;; encoding independently of whether the caller selected DragQueryFileA or
  ;; DragQueryFileW, so this helper converts in either direction. Return value
  ;; excludes the terminator, and iFile=-1 asks for the number of paths.
  (func $drop_read_char (param $src i32) (param $wide i32) (result i32)
    (if (result i32) (local.get $wide)
      (then (call $gl16 (local.get $src)))
      (else (call $gl8 (local.get $src)))))

  (func $drop_query_file (param $hdrop i32) (param $index i32)
        (param $dst i32) (param $cch i32) (param $dst_wide i32) (result i32)
    (local $src i32) (local $source_wide i32) (local $source_step i32)
    (local $file i32) (local $length i32) (local $copied i32) (local $ch i32)
    (if (i32.eqz (local.get $hdrop)) (then (return (i32.const 0))))
    (local.set $src (i32.add (local.get $hdrop) (call $gl32 (local.get $hdrop))))
    (local.set $source_wide
      (i32.ne (call $gl32 (i32.add (local.get $hdrop) (i32.const 16))) (i32.const 0)))
    (local.set $source_step
      (select (i32.const 2) (i32.const 1) (local.get $source_wide)))

    ;; Locate the requested string, or count every string for index=-1.
    (block $located (loop $files
      (local.set $ch (call $drop_read_char
        (local.get $src) (local.get $source_wide)))
      (if (i32.eqz (local.get $ch))
        (then
          (if (i32.eq (local.get $index) (i32.const -1))
            (then (return (local.get $file))))
          (return (i32.const 0))))
      (if (i32.eq (local.get $file) (local.get $index))
        (then (br $located)))
      (block $name_done (loop $skip_name
        (local.set $ch (call $drop_read_char
          (local.get $src) (local.get $source_wide)))
        (local.set $src (i32.add (local.get $src) (local.get $source_step)))
        (br_if $name_done (i32.eqz (local.get $ch)))
        (br $skip_name)))
      (local.set $file (i32.add (local.get $file) (i32.const 1)))
      (br $files)))

    ;; Measure in source characters. Our browser-created paths are 7-bit ANSI,
    ;; but accepting either DROPFILES spelling also keeps app-created HDROPs
    ;; coherent with the documented structure.
    (block $length_done (loop $measure
      (local.set $ch (call $drop_read_char
        (i32.add (local.get $src)
          (i32.mul (local.get $length) (local.get $source_step)))
        (local.get $source_wide)))
      (br_if $length_done (i32.eqz (local.get $ch)))
      (local.set $length (i32.add (local.get $length) (i32.const 1)))
      (br $measure)))
    (if (i32.eqz (local.get $dst)) (then (return (local.get $length))))
    (if (i32.eqz (local.get $cch)) (then (return (i32.const 0))))

    (local.set $copied
      (select (local.get $length) (i32.sub (local.get $cch) (i32.const 1))
        (i32.lt_u (local.get $length) (local.get $cch))))
    (local.set $file (i32.const 0))
    (block $copy_done (loop $copy
      (br_if $copy_done (i32.ge_u (local.get $file) (local.get $copied)))
      (local.set $ch (call $drop_read_char
        (i32.add (local.get $src)
          (i32.mul (local.get $file) (local.get $source_step)))
        (local.get $source_wide)))
      (if (local.get $dst_wide)
        (then (call $gs16
          (i32.add (local.get $dst) (i32.mul (local.get $file) (i32.const 2)))
          (local.get $ch)))
        (else (call $gs8 (i32.add (local.get $dst) (local.get $file))
          (select (local.get $ch) (i32.const 63)
            (i32.le_u (local.get $ch) (i32.const 255))))))
      (local.set $file (i32.add (local.get $file) (i32.const 1)))
      (br $copy)))
    (if (local.get $dst_wide)
      (then (call $gs16
        (i32.add (local.get $dst) (i32.mul (local.get $copied) (i32.const 2)))
        (i32.const 0)))
      (else (call $gs8 (i32.add (local.get $dst) (local.get $copied)) (i32.const 0))))
    (local.get $copied))

  ;; 197: DragQueryFileA(hDrop, iFile, lpszFile, cch)
  (func $handle_DragQueryFileA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $drop_query_file
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3)
      (i32.const 0)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 20)))  ;; stdcall, 4 args
  )

  ;; 198: DragFinish(hDrop) — release the heap block supplied with
  ;; WM_DROPFILES. It is legal to pass the handle to several DragQueryFile
  ;; calls before this one final release.
  (func $handle_DragFinish (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (local.get $arg0) (then (call $heap_free (local.get $arg0))))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8)))  ;; stdcall, 1 arg
  )

  ;; 199: GetOpenFileNameA(lpOFN) — show modal Open dialog
  ;;
  ;; Builds a WAT-driven Open dialog (class 12), parks EIP at the
  ;; CACA0006 modal pump thunk via $modal_begin, and yields to JS.
  ;; The dialog's wndproc writes the chosen filename back into
  ;; OFN.lpstrFile and calls $modal_done(1/0) on OK/Cancel. The pump
  ;; restores eax/eip/esp on the next interpreter pass after that.
  (func $handle_GetOpenFileNameA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $dlg i32) (local $owner i32)
    (call $modal_capture_nonvolatile)
    (global.set $opendlg_wide (i32.const 0))
    (local.set $dlg (global.get $next_hwnd))
    (global.set $next_hwnd (i32.add (global.get $next_hwnd) (i32.const 1)))
    ;; OPENFILENAME.hwndOwner at +4
    (local.set $owner (call $gl32 (i32.add (local.get $arg0) (i32.const 4))))
    (call $create_open_dialog (local.get $dlg) (local.get $owner) (i32.const 0) (local.get $arg0))
    ;; 1-arg stdcall: ret addr (4) + arg (4) = 8 bytes to pop on return.
    (call $modal_begin (local.get $dlg) (i32.const 8))
  )

  ;; GetOpenFileNameW(lpOFN) — the dialog UI uses the same byte-oriented WAT
  ;; controls, while filter parsing and the selected output buffer honor the
  ;; Unicode OPENFILENAME contract.
  (func $handle_GetOpenFileNameW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $dlg i32) (local $owner i32)
    (call $modal_capture_nonvolatile)
    (global.set $opendlg_wide (i32.const 1))
    (local.set $dlg (global.get $next_hwnd))
    (global.set $next_hwnd (i32.add (global.get $next_hwnd) (i32.const 1)))
    (local.set $owner (call $gl32 (i32.add (local.get $arg0) (i32.const 4))))
    (call $create_open_dialog (local.get $dlg) (local.get $owner) (i32.const 0) (local.get $arg0))
    (call $modal_begin (local.get $dlg) (i32.const 8))
  )

  ;; 200: GetFileTitleA(lpszFile, lpszTitle, cbBuf)
  ;; Return the display title portion of a path. Success returns 0; if the
  ;; destination buffer is too small, return the required char count including
  ;; the NUL terminator. Good enough for Notepad's File->Open title update.
  (func $handle_GetFileTitleA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $p i32) (local $base i32) (local $ch i32) (local $len i32)
    (if (i32.eqz (local.get $arg0))
      (then
        (global.set $eax (i32.const -1))
        (global.set $esp (i32.add (global.get $esp) (i32.const 16)))
        (return)))
    (local.set $p (local.get $arg0))
    (local.set $base (local.get $arg0))
    (block $done (loop $scan
      (local.set $ch (call $gl8 (local.get $p)))
      (br_if $done (i32.eqz (local.get $ch)))
      (if (i32.or
            (i32.or (i32.eq (local.get $ch) (i32.const 0x5C)) ;; '\'
                    (i32.eq (local.get $ch) (i32.const 0x2F))) ;; '/'
            (i32.eq (local.get $ch) (i32.const 0x3A)))         ;; ':'
        (then (local.set $base (i32.add (local.get $p) (i32.const 1)))))
      (local.set $p (i32.add (local.get $p) (i32.const 1)))
      (br $scan)))
    (local.set $len (call $guest_strlen (local.get $base)))
    (if (i32.or (i32.eqz (local.get $arg1))
                (i32.lt_u (local.get $arg2) (i32.add (local.get $len) (i32.const 1))))
      (then
        (global.set $eax (i32.add (local.get $len) (i32.const 1)))
        (global.set $esp (i32.add (global.get $esp) (i32.const 16)))
        (return)))
    (call $guest_strcpy (local.get $arg1) (local.get $base))
    (global.set $eax (i32.const 0))
    (global.set $esp (i32.add (global.get $esp) (i32.const 16)))
  )

  ;; 201: ChooseFontA(lpCF) — show the WAT-driven Font picker with face/
  ;; style/size listboxes. On OK, writes chosen size back to LOGFONT.lfHeight.
  (func $handle_ChooseFontA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $dlg i32) (local $owner i32)
    (call $modal_capture_nonvolatile)
    (local.set $dlg (global.get $next_hwnd))
    (global.set $next_hwnd (i32.add (global.get $next_hwnd) (i32.const 1)))
    (local.set $owner (call $gl32 (i32.add (local.get $arg0) (i32.const 4))))
    (call $create_font_dialog (local.get $dlg) (local.get $owner) (local.get $arg0))
    (call $modal_begin (local.get $dlg) (i32.const 8)))

  ;; 202: FindTextA(lpFR) — create modeless Find dialog, return HWND
  (func $handle_FindTextA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $hwnd i32) (local $owner i32)
    (local.set $hwnd (global.get $next_hwnd))
    (global.set $next_hwnd (i32.add (global.get $next_hwnd) (i32.const 1)))
    ;; Read hwndOwner from FINDREPLACE struct at offset +4
    (local.set $owner (call $gl32 (i32.add (local.get $arg0) (i32.const 4))))
    ;; Bare host log line for the [FindTextA] gate. All renderer state is
    ;; created from inside $create_findreplace_dialog via host_register_dialog_frame.
    (drop (call $host_show_find_dialog (local.get $hwnd) (local.get $owner) (local.get $arg0)))
    (call $create_findreplace_dialog (local.get $hwnd) (local.get $owner) (local.get $arg0) (i32.const 0))
    (global.set $eax (local.get $hwnd))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8)))  ;; stdcall, 1 arg
  )

  ;; ReplaceTextA(lpFR) — create modeless Replace dialog, return HWND.
  ;; This is commonly resolved dynamically by MFC, so it must participate in
  ;; the normal API hash/GetProcAddress path even when no PE imports it.
  (func $handle_ReplaceTextA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $hwnd i32) (local $owner i32)
    (local.set $hwnd (global.get $next_hwnd))
    (global.set $next_hwnd (i32.add (global.get $next_hwnd) (i32.const 1)))
    (local.set $owner (call $gl32 (i32.add (local.get $arg0) (i32.const 4))))
    (call $create_findreplace_dialog (local.get $hwnd) (local.get $owner) (local.get $arg0) (i32.const 1))
    (global.set $eax (local.get $hwnd))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8)))
  )

  ;; 203: PageSetupDlgA(lpPS) — show placeholder modal dialog
  (func $handle_PageSetupDlgA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $dlg i32) (local $owner i32) (local $flags i32)
    (call $modal_capture_nonvolatile)
    (local.set $flags (call $gl32 (i32.add (local.get $arg0) (i32.const 16))))
    ;; PAGESETUPDLG ptPaperSize + rtMinMargin + rtMargin. WordPad requests
    ;; thousandths of an inch; also honor hundredths-of-mm callers.
    (if (i32.and (local.get $flags) (i32.const 8)) ;; PSD_INHUNDREDTHSOFMILLIMETERS
      (then
        (call $gs32 (i32.add (local.get $arg0) (i32.const 20)) (i32.const 21590))
        (call $gs32 (i32.add (local.get $arg0) (i32.const 24)) (i32.const 27940))
        (call $gs32 (i32.add (local.get $arg0) (i32.const 28)) (i32.const 635))
        (call $gs32 (i32.add (local.get $arg0) (i32.const 32)) (i32.const 635))
        (call $gs32 (i32.add (local.get $arg0) (i32.const 36)) (i32.const 635))
        (call $gs32 (i32.add (local.get $arg0) (i32.const 40)) (i32.const 635))
        (call $gs32 (i32.add (local.get $arg0) (i32.const 44)) (i32.const 2540))
        (call $gs32 (i32.add (local.get $arg0) (i32.const 48)) (i32.const 2540))
        (call $gs32 (i32.add (local.get $arg0) (i32.const 52)) (i32.const 2540))
        (call $gs32 (i32.add (local.get $arg0) (i32.const 56)) (i32.const 2540)))
      (else
        (call $gs32 (i32.add (local.get $arg0) (i32.const 20)) (i32.const 8500))
        (call $gs32 (i32.add (local.get $arg0) (i32.const 24)) (i32.const 11000))
        (call $gs32 (i32.add (local.get $arg0) (i32.const 28)) (i32.const 250))
        (call $gs32 (i32.add (local.get $arg0) (i32.const 32)) (i32.const 250))
        (call $gs32 (i32.add (local.get $arg0) (i32.const 36)) (i32.const 250))
        (call $gs32 (i32.add (local.get $arg0) (i32.const 40)) (i32.const 250))
        (call $gs32 (i32.add (local.get $arg0) (i32.const 44)) (i32.const 1000))
        (call $gs32 (i32.add (local.get $arg0) (i32.const 48)) (i32.const 1000))
        (call $gs32 (i32.add (local.get $arg0) (i32.const 52)) (i32.const 1000))
        (call $gs32 (i32.add (local.get $arg0) (i32.const 56)) (i32.const 1000))))
    (local.set $dlg (global.get $next_hwnd))
    (global.set $next_hwnd (i32.add (global.get $next_hwnd) (i32.const 1)))
    (local.set $owner (call $gl32 (i32.add (local.get $arg0) (i32.const 4))))
    (global.set $common_dialog_kind (i32.const 1))
    (global.set $common_dialog_struct (local.get $arg0))
    (call $create_page_setup_dialog (local.get $dlg) (local.get $owner))
    (call $modal_begin (local.get $dlg) (i32.const 8)))

  ;; 204: CommDlgExtendedError() — return 0 (no error)
  (func $handle_CommDlgExtendedError (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (i32.const 0))
    (global.set $esp (i32.add (global.get $esp) (i32.const 4)))  ;; stdcall, 0 args
  )

  ;; 205: exit
  (func $handle_exit (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; cdecl: pop only the return address; the caller owns the status arg.
    (global.set $esp (i32.add (global.get $esp) (i32.const 4)))
    (global.set $atexit_exit_code (local.get $arg0))
    (call $crt_atexit_run_next)
  )

  ;; 206: _exit
  (func $handle__exit (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $esp (i32.add (global.get $esp) (i32.const 4)))
    (call $host_exit (local.get $arg0))
    (global.set $eip (i32.const 0))
    (global.set $yield_flag (i32.const 1))
    (global.set $steps (i32.const 0)) (return)
  )

  ;; _cexit() — cdecl, run CRT cleanup without terminating the process. The
  ;; current atexit runner is exit-oriented, so keep this as a startup-safe
  ;; cleanup acknowledgement until a returning terminator chain exists.
  (func $handle__cexit (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $esp (i32.add (global.get $esp) (i32.const 4)))
  )

  ;; 207: __getmainargs
  (func $handle___getmainargs (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; arg0=&argc, arg1=&argv, arg2=&envp
    (if (i32.eqz (global.get $fake_cmdline_addr))
      (then (call $store_fake_cmdline)))
    (call $gs32 (local.get $arg0)
      (call $gl32 (i32.add (global.get $fake_cmdline_addr) (i32.const 508))))
    (call $gs32 (local.get $arg1)
      (i32.add (global.get $fake_cmdline_addr) (i32.const 1024)))
    (call $gs32 (local.get $arg2)
      (i32.add (global.get $fake_cmdline_addr) (i32.const 1532)))
    (global.set $eax (i32.const 0))
    (global.set $esp (i32.add (global.get $esp) (i32.const 4))) (return)
  )

  ;; 208: __p__fmode
  (func $handle___p__fmode (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.eqz (global.get $msvcrt_fmode_ptr))
    (then (global.set $msvcrt_fmode_ptr (call $heap_alloc (i32.const 4)))
    (call $gs32 (global.get $msvcrt_fmode_ptr) (i32.const 0))))
    (global.set $eax (global.get $msvcrt_fmode_ptr))
    (global.set $esp (i32.add (global.get $esp) (i32.const 4))) (return)
  )

  ;; 209: __p__commode
  (func $handle___p__commode (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.eqz (global.get $msvcrt_commode_ptr))
    (then (global.set $msvcrt_commode_ptr (call $heap_alloc (i32.const 4)))
    (call $gs32 (global.get $msvcrt_commode_ptr) (i32.const 0))))
    (global.set $eax (global.get $msvcrt_commode_ptr))
    (global.set $esp (i32.add (global.get $esp) (i32.const 4))) (return)
  )

  ;; 210: _initterm(start, end) — CRT init table walker
  ;; Iterates function pointers from [start] to [end), calling each non-NULL entry.
  ;; Uses continuation thunk (0xCACA0003) to chain calls through the emulator.
  (func $handle__initterm (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $fn i32)
    ;; Save return address and end pointer for continuation
    (global.set $initterm_ret (call $gl32 (global.get $esp)))
    (global.set $initterm_end (local.get $arg1))
    (global.set $initterm_ptr (local.get $arg0))
    ;; cdecl: pop only the return address; the caller owns both arguments.
    (global.set $esp (i32.add (global.get $esp) (i32.const 4)))
    ;; Find first non-NULL entry and call it
    (block $done (loop $scan
      (br_if $done (i32.ge_u (global.get $initterm_ptr) (global.get $initterm_end)))
      (local.set $fn (call $gl32 (global.get $initterm_ptr)))
      (global.set $initterm_ptr (i32.add (global.get $initterm_ptr) (i32.const 4)))
      (if (local.get $fn)
        (then
          ;; Push continuation thunk as return address, then jump to fn
          (global.set $esp (i32.sub (global.get $esp) (i32.const 4)))
          (call $gs32 (global.get $esp) (global.get $initterm_thunk))
          (global.set $eip (local.get $fn))
          (global.set $steps (i32.const 0))
          (return)))
      (br $scan)))
    ;; All entries processed — return to original caller
    (global.set $eip (global.get $initterm_ret))
  )

  ;; 211: _controlfp(new, mask) — cdecl; return default FPU control word
  (func $handle__controlfp (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (i32.const 0x9001F))
    ;; The caller owns the two arguments. Pop only our return address.
    (global.set $esp (i32.add (global.get $esp) (i32.const 4)))
  )

  ;; 212: _strrev
  (func $handle__strrev (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $v i32) (local $i i32) (local $j i32)
    ;; Implement _strrev: reverse string in-place
    (local.set $i (call $g2w (local.get $arg0)))  ;; start pointer (wasm addr)
    (local.set $j (local.get $i))
    ;; Find end of string
    (block $end (loop $find
    (br_if $end (i32.eqz (i32.load8_u (local.get $j))))
    (local.set $j (i32.add (local.get $j) (i32.const 1)))
    (br $find)))
    ;; j now points to null terminator; back up one
    (if (i32.gt_u (local.get $j) (local.get $i))
    (then (local.set $j (i32.sub (local.get $j) (i32.const 1)))))
    ;; Swap from both ends
    (block $done (loop $swap
    (br_if $done (i32.ge_u (local.get $i) (local.get $j)))
    (local.set $v (i32.load8_u (local.get $i)))
    (i32.store8 (local.get $i) (i32.load8_u (local.get $j)))
    (i32.store8 (local.get $j) (local.get $v))
    (local.set $i (i32.add (local.get $i) (i32.const 1)))
    (local.set $j (i32.sub (local.get $j) (i32.const 1)))
    (br $swap)))
    (global.set $eax (local.get $arg0))
    (global.set $esp (i32.add (global.get $esp) (i32.const 4))) (return)
  )

  ;; 213: toupper lives in src/09a6-handlers-crt.wat beside $handle_tolower and
  ;; $handle_towupper, which delegates to it. A SECOND $handle_toupper stood here
  ;; until 2026-08-31 and had never run: the compiler's `funcIndexMap` is
  ;; last-wins, so every call to the name — including the generated dispatch
  ;; table's — resolved to the CRT file's body, and this one was emitted and
  ;; never reached. Nothing said so, because `strictDeclarations` was off in
  ;; every shipped build; it is on now (tools/watx-closure.js).

  ;; 214: memmove
  (func $handle_memmove (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $guest_memmove (local.get $arg0) (local.get $arg1) (local.get $arg2))
    (global.set $eax (local.get $arg0))
    (global.set $esp (i32.add (global.get $esp) (i32.const 4))) (return)
  )

  ;; 215: strchr
  (func $handle_strchr (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $v i32) (local $i i32) (local $j i32)
    ;; Implement strchr(str, char) — find char in string, return ptr or NULL
    (local.set $i (call $g2w (local.get $arg0)))
    (local.set $v (i32.and (local.get $arg1) (i32.const 0xFF)))
    (global.set $eax (i32.const 0)) ;; default: not found
    (block $done (loop $scan
    (local.set $j (i32.load8_u (local.get $i)))
    (if (i32.eq (local.get $j) (local.get $v))
    (then (global.set $eax (i32.add (i32.sub (local.get $i) (global.get $GUEST_BASE)) (global.get $image_base))) (br $done)))
    (br_if $done (i32.eqz (local.get $j)))
    (local.set $i (i32.add (local.get $i) (i32.const 1)))
    (br $scan)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 4))) (return)
  )

  ;; 216: _XcptFilter — cdecl, returns EXCEPTION_CONTINUE_SEARCH (0).
  ;; nop was leaving ret-addr on stack and corrupting subsequent instructions;
  ;; pop the ret-addr (cdecl: caller pops args).
  (func $handle__XcptFilter (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (i32.const 0))
    (global.set $esp (i32.add (global.get $esp) (i32.const 4)))
  )

  ;; 217: _CxxThrowException — STUB: unimplemented
  (func $handle__CxxThrowException (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $crash_unimplemented (local.get $name_ptr))
  )

  ;; 218-222, 250: the lstr* family. These used to call $dispatch_lstr, which
  ;; re-read the API *name* one character at a time to decide which of them it
  ;; was — after the generated br_table had already resolved that name to this
  ;; exact function. The name-sniffing layer is gone; each handler is its own
  ;; body, which is also what lets the Win16 bridge (09e) call them directly:
  ;; it has an ordinal, not a name, and so used to reimplement them instead.

  ;; The two spellings of each lstr* entry point differ only in character
  ;; width, so each operation has one body here with a $wide flag and both
  ;; handlers are thin spellings of it. They used to be written twice, and the
  ;; copies had drifted apart on NULL handling: lstrlenW and lstrcpyW checked
  ;; for NULL (which is what Win98 does — its lstr* sit behind an SEH handler
  ;; that turns a bad pointer into a benign result) while the ANSI twins
  ;; dereferenced it.

  (func $lstr_len (param $s i32) (param $wide i32) (result i32)
    (if (i32.eqz (local.get $s)) (then (return (i32.const 0))))
    (if (local.get $wide) (then (return (call $guest_wcslen (local.get $s)))))
    (call $guest_strlen (local.get $s)))

  (func $lstr_cpy (param $dst i32) (param $src i32) (param $wide i32)
    (if (i32.or (i32.eqz (local.get $dst)) (i32.eqz (local.get $src))) (then (return)))
    (if (local.get $wide)
      (then (call $guest_wcscpy (local.get $dst) (local.get $src)))
      (else (call $guest_strcpy (local.get $dst) (local.get $src)))))

  (func $lstr_cat (param $dst i32) (param $src i32) (param $wide i32)
    (if (i32.or (i32.eqz (local.get $dst)) (i32.eqz (local.get $src))) (then (return)))
    (call $lstr_cpy
      (i32.add (local.get $dst) (i32.mul (call $lstr_len (local.get $dst) (local.get $wide))
                                         (select (i32.const 2) (i32.const 1) (local.get $wide))))
      (local.get $src) (local.get $wide)))

  ;; Copies at most count-1 characters and always terminates.
  (func $lstr_cpyn (param $dst i32) (param $src i32) (param $max i32) (param $wide i32)
    (if (i32.or (i32.eqz (local.get $dst)) (i32.eqz (local.get $src))) (then (return)))
    (if (local.get $wide)
      (then (call $guest_wcsncpy (local.get $dst) (local.get $src) (local.get $max)))
      (else (call $guest_strncpy (local.get $dst) (local.get $src) (local.get $max)))))

  ;; Negative / zero / positive, optionally ASCII case-insensitive. A NULL
  ;; string sorts before a non-NULL one, and two NULLs are equal.
  (func $lstr_cmp (param $a i32) (param $b i32) (param $wide i32) (param $fold i32) (result i32)
    (local $i i32) (local $step i32) (local $c1 i32) (local $c2 i32)
    (if (i32.or (i32.eqz (local.get $a)) (i32.eqz (local.get $b)))
      (then (return (i32.sub (i32.ne (local.get $a) (i32.const 0))
                             (i32.ne (local.get $b) (i32.const 0))))))
    (local.set $step (select (i32.const 2) (i32.const 1) (local.get $wide)))
    (block $done (loop $cmp
      (local.set $c1 (call $gl_char (i32.add (local.get $a) (local.get $i)) (local.get $wide)))
      (local.set $c2 (call $gl_char (i32.add (local.get $b) (local.get $i)) (local.get $wide)))
      (if (local.get $fold)
        (then
          (local.set $c1 (call $tolower (local.get $c1)))
          (local.set $c2 (call $tolower (local.get $c2)))))
      (if (i32.ne (local.get $c1) (local.get $c2))
        (then (return (i32.sub (local.get $c1) (local.get $c2)))))
      (br_if $done (i32.eqz (local.get $c1)))
      (local.set $i (i32.add (local.get $i) (local.get $step)))
      (br $cmp)))
    (i32.const 0))

  ;; PathRemoveFileSpecA/W(pszPath) removes the final component in place and
  ;; returns TRUE only when the string actually changed.
  (func $path_remove_file_spec (param $path i32) (param $wide i32) (result i32)
    (local $step i32) (local $off i32) (local $last i32) (local $ch i32)
    (if (i32.eqz (local.get $path)) (then (return (i32.const 0))))
    (local.set $step (select (i32.const 2) (i32.const 1) (local.get $wide)))
    (local.set $last (i32.const 0xffffffff))
    (block $done (loop $scan
      (local.set $ch (call $gl_char (i32.add (local.get $path) (local.get $off)) (local.get $wide)))
      (br_if $done (i32.eqz (local.get $ch)))
      (if (i32.or (i32.eq (local.get $ch) (i32.const 0x5c))
                  (i32.eq (local.get $ch) (i32.const 0x2f)))
        (then (local.set $last (local.get $off))))
      (local.set $off (i32.add (local.get $off) (local.get $step)))
      (br $scan)))
    (if (i32.eq (local.get $last) (i32.const 0xffffffff))
      (then (return (i32.const 0))))
    ;; Preserve drive roots: "C:\foo" becomes "C:\", not "C:".
    (if (i32.and
          (i32.eq (local.get $last) (i32.mul (local.get $step) (i32.const 2)))
          (i32.eq (call $gl_char (i32.add (local.get $path) (local.get $step)) (local.get $wide)) (i32.const 0x3a)))
      (then
        (local.set $last (i32.add (local.get $last) (local.get $step)))))
    (if (local.get $wide)
      (then (i32.store16 (call $g2w (i32.add (local.get $path) (local.get $last))) (i32.const 0)))
      (else (i32.store8 (call $g2w (i32.add (local.get $path) (local.get $last))) (i32.const 0))))
    (i32.const 1))

  ;; One character at a guest address, ANSI or wide.
  (func $gl_char (param $p_g i32) (param $wide i32) (result i32)
    (if (local.get $wide) (then (return (call $gl16 (local.get $p_g)))))
    (call $gl8 (local.get $p_g)))

  ;; 218: lstrlenA
  (func $handle_lstrlenA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $lstr_len (local.get $arg0) (i32.const 0)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8)))
  )

  ;; InstallShield 11 dynamically asks KERNEL32 for the historical unsuffixed
  ;; export. Its byte-string contract is identical to lstrlenA.
  (func $handle_lstrlen (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $lstr_len (local.get $arg0) (i32.const 0)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8)))
  )

  ;; 219: lstrcpyA
  (func $handle_lstrcpyA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $lstr_cpy (local.get $arg0) (local.get $arg1) (i32.const 0))
    (global.set $eax (local.get $arg0))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12)))
  )

  ;; 220: lstrcatA
  (func $handle_lstrcatA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $lstr_cat (local.get $arg0) (local.get $arg1) (i32.const 0))
    (global.set $eax (local.get $arg0))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12)))
  )

  ;; 221: lstrcpynA(dst, src, count) — copies at most count-1 chars.
  (func $handle_lstrcpynA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $lstr_cpyn (local.get $arg0) (local.get $arg1) (local.get $arg2) (i32.const 0))
    (global.set $eax (local.get $arg0))
    (global.set $esp (i32.add (global.get $esp) (i32.const 16)))
  )

  ;; 222: lstrcmpA
  (func $handle_lstrcmpA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $lstr_cmp (local.get $arg0) (local.get $arg1) (i32.const 0) (i32.const 0)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12)))
  )

  (func $handle_PathRemoveFileSpecA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $path_remove_file_spec (local.get $arg0) (i32.const 0)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8)))
  )

  ;; 223: RegCloseKey(hKey) — 1 arg stdcall
  (func $handle_RegCloseKey (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $host_reg_close_key (local.get $arg0)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8)))
  )

  ;; RegFlushKey(hKey) — 1 arg stdcall
  (func $handle_RegFlushKey (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $host_reg_flush_key (local.get $arg0)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8)))
  )

  ;; RegDeleteKeyA(hKey, lpSubKey) — 2 args stdcall
  (func $handle_RegDeleteKeyA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $host_reg_delete_key
      (local.get $arg0)
      (if (result i32) (local.get $arg1)
        (then (call $g2w (local.get $arg1))) (else (i32.const 0)))
      (i32.const 0)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12)))
  )

  ;; RegDeleteKeyW(hKey, lpSubKey) — 2 args stdcall
  (func $handle_RegDeleteKeyW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $host_reg_delete_key
      (local.get $arg0)
      (if (result i32) (local.get $arg1)
        (then (call $g2w (local.get $arg1))) (else (i32.const 0)))
      (i32.const 1)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12)))
  )

  ;; RegDeleteValueA(hKey, lpValueName) — 2 args stdcall
  (func $handle_RegDeleteValueA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $host_reg_delete_value
      (local.get $arg0)
      (if (result i32) (local.get $arg1)
        (then (call $g2w (local.get $arg1))) (else (i32.const 0)))
      (i32.const 0)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12)))
  )

  ;; RegDeleteValueW(hKey, lpValueName) — 2 args stdcall
  (func $handle_RegDeleteValueW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $host_reg_delete_value
      (local.get $arg0)
      (if (result i32) (local.get $arg1)
        (then (call $g2w (local.get $arg1))) (else (i32.const 0)))
      (i32.const 1)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12)))
  )

  ;; 224: RegCreateKeyA(hKey, lpSubKey, phkResult) — 3 args stdcall
  (func $handle_RegCreateKeyA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $host_reg_create_key
      (local.get $arg0) (call $g2w (local.get $arg1)) (local.get $arg2)
      (i32.const 0) (i32.const 0)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 16)))
  )

  ;; 225: RegQueryValueExA(hKey, lpValueName, lpReserved, lpType, lpData, lpcbData) — 6 args stdcall
  ;; RegQueryValueEx{A,W}(hKey, lpValueName, lpReserved, lpType, lpData,
  ;; lpcbData) — 6 args stdcall. The host does the whole read; the only thing
  ;; the spelling decides is how it reads the value name and writes strings
  ;; back, which is the $wide flag it already takes.
  (func $reg_query_value_ex (param $hkey i32) (param $name_g i32) (param $type_g i32)
                            (param $data_g i32) (param $cb_g i32) (param $wide i32) (result i32)
    (call $host_reg_query_value
      (local.get $hkey)
      (select (i32.const 0) (call $g2w (local.get $name_g)) (i32.eqz (local.get $name_g)))
      (local.get $type_g) (local.get $data_g) (local.get $cb_g) (local.get $wide)))

  (func $handle_RegQueryValueExA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $reg_query_value_ex
      (local.get $arg0) (local.get $arg1) (local.get $arg3) (local.get $arg4)
      (call $gl32 (i32.add (global.get $esp) (i32.const 24))) (i32.const 0)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 28)))
  )

  ;; SHQueryValueExA/W(hKey, pszValue, pdwReserved, pdwType, pvData, pcbData)
  ;; SHLWAPI's registry read. It differs from RegQueryValueEx only in that it
  ;; expands a REG_EXPAND_SZ result and reports it as REG_SZ; the registry
  ;; here stores no unexpanded strings, so the read is the same read.
  ;; Explorer reaches this through SHELL32 ordinal 509.
  (func $handle_SHQueryValueExA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $reg_query_value_ex
      (local.get $arg0) (local.get $arg1) (local.get $arg3) (local.get $arg4)
      (call $gl32 (i32.add (global.get $esp) (i32.const 24))) (i32.const 0)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 28)))
  )

  (func $handle_SHQueryValueExW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $reg_query_value_ex
      (local.get $arg0) (local.get $arg1) (local.get $arg3) (local.get $arg4)
      (call $gl32 (i32.add (global.get $esp) (i32.const 24))) (i32.const 1)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 28)))
  )

  ;; RegSetValueEx{A,W}(hKey, lpValueName, Reserved, dwType, lpData, cbData)
  ;; — 6 args stdcall, one write with the spelling as a flag.
  (func $reg_set_value_ex (param $hkey i32) (param $name_g i32) (param $type i32)
                          (param $data_g i32) (param $cb i32) (param $wide i32) (result i32)
    (call $host_reg_set_value
      (local.get $hkey)
      (select (i32.const 0) (call $g2w (local.get $name_g)) (i32.eqz (local.get $name_g)))
      (local.get $type) (local.get $data_g) (local.get $cb) (local.get $wide)))

  ;; 226: RegSetValueExA
  (func $handle_RegSetValueExA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $reg_set_value_ex
      (local.get $arg0) (local.get $arg1) (local.get $arg3) (local.get $arg4)
      (call $gl32 (i32.add (global.get $esp) (i32.const 24))) (i32.const 0)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 28)))
  )

  ;; 227-231: the Local* family, formerly routed through $dispatch_local, which
  ;; picked the operation from name[5]. Local and Global memory are the same
  ;; heap here, so the pairs are deliberately identical bodies.

  ;; 227: LocalAlloc(uFlags, uBytes)
  (func $handle_LocalAlloc (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $heap_alloc (local.get $arg1)))
    (if (i32.and (local.get $arg0) (i32.const 0x40)) ;; LMEM_ZEROINIT
      (then (if (global.get $eax)
              (then (call $zero_memory (call $g2w (global.get $eax)) (local.get $arg1))))))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12)))
  )

  ;; 228: LocalFree
  (func $handle_LocalFree (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $heap_free (local.get $arg0))
    (global.set $eax (i32.const 0))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8)))
  )

  ;; 229: LocalLock — handles are pointers here, so locking is the identity.
  (func $handle_LocalLock (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (local.get $arg0))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8)))
  )

  ;; 230: LocalUnlock — returns FALSE, meaning the lock count reached zero.
  (func $handle_LocalUnlock (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (i32.const 0))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8)))
  )

  ;; 231: LocalReAlloc(hMem, uBytes, uFlags)
  (func $handle_LocalReAlloc (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $heap_realloc (local.get $arg0) (local.get $arg1) (local.get $arg2)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 16)))
  )

  ;; LocalSize(hMem) — LocalAlloc returns a fixed guest pointer whose aligned
  ;; allocation size is stored in the four-byte heap header immediately before
  ;; it. Return the usable data bytes, matching the existing GlobalSize path.
  (func $handle_LocalSize (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.eqz (local.get $arg0))
      (then (global.set $eax (i32.const 0)))
      (else
        (global.set $eax
          (i32.sub (call $gl32 (i32.sub (local.get $arg0) (i32.const 4)))
                   (i32.const 4)))))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8)))
  )

  ;; 232-237: the Global* family, formerly routed through $dispatch_global,
  ;; which picked the operation from name[6]. That byte aliased
  ;; GlobalAddAtomA with GlobalAlloc and GlobalFindAtomA/GlobalFlags with
  ;; GlobalFree — safe only because those happened to have their own handlers.

  ;; 232: GlobalAlloc(uFlags, dwBytes)
  (func $handle_GlobalAlloc (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $heap_alloc (local.get $arg1)))
    ;; The unified emulator heap reuses blocks freed by HeapAlloc/LocalAlloc as
    ;; GlobalAlloc results. That makes unrelated stale bytes much more visible
    ;; than on Win9x (Diablo's CEL decoder leaves transparent skip runs alone).
    ;; Zero is a valid result for memory whose contents are otherwise
    ;; unspecified, and keeps GlobalAlloc deterministic; GMEM_ZEROINIT remains
    ;; satisfied as a strict subset of this behavior.
    (if (global.get $eax)
      (then (call $zero_memory (call $g2w (global.get $eax)) (local.get $arg1))))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12)))
  )

  ;; 233: GlobalFree
  (func $handle_GlobalFree (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $heap_free (local.get $arg0))
    (global.set $eax (i32.const 0))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8)))
  )

  ;; 234: GlobalLock
  (func $handle_GlobalLock (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (local.get $arg0))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8)))
  )

  ;; 235: GlobalUnlock
  (func $handle_GlobalUnlock (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (i32.const 0))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8)))
  )

  ;; 236: GlobalReAlloc(hMem, dwBytes, uFlags)
  (func $handle_GlobalReAlloc (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $heap_realloc (local.get $arg0) (local.get $arg1) (local.get $arg2)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 16)))
  )

  ;; 237: GlobalSize — usable bytes, from the four-byte heap header before the
  ;; block. Same rule as $handle_LocalSize.
  (func $handle_GlobalSize (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax
      (i32.sub (call $gl32 (i32.sub (local.get $arg0) (i32.const 4))) (i32.const 4)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8)))
  )

  ;; 238: GlobalCompact — STUB: unimplemented
  (func $handle_GlobalCompact (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $crash_unimplemented (local.get $name_ptr))
  )

  ;; 239: RegOpenKeyA
  (func $handle_RegOpenKeyA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; RegOpenKeyA(hKey, lpSubKey, phkResult) — 3 args stdcall
    (local $hResult i32)
    (local.set $hResult (call $host_reg_open_key
      (local.get $arg0) (call $g2w (local.get $arg1)) (i32.const 0)))
    (if (local.get $hResult)
      (then (call $gs32 (local.get $arg2) (local.get $hResult))
             (global.set $eax (i32.const 0)))  ;; ERROR_SUCCESS
      (else (global.set $eax (i32.const 2))))  ;; ERROR_FILE_NOT_FOUND
    (global.set $esp (i32.add (global.get $esp) (i32.const 16)))
  )

  ;; 240: RegOpenKeyExA(hKey, lpSubKey, ulOptions, samDesired, phkResult) — 5 args stdcall
  (func $handle_RegOpenKeyExA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $hResult i32)
    (local.set $hResult (call $host_reg_open_key
      (local.get $arg0) (call $g2w (local.get $arg1)) (i32.const 0)))
    (if (local.get $hResult)
      (then (call $gs32 (local.get $arg4) (local.get $hResult))
             (global.set $eax (i32.const 0)))
      (else (global.set $eax (i32.const 2))))
    (global.set $esp (i32.add (global.get $esp) (i32.const 24)))
  )

  ;; 241: RegisterClassExA
  (func $handle_RegisterClassExA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $tmp i32) (local $class_name_wa i32) (local $slot i32) (local $dst i32) (local $src i32)
    ;; WNDCLASSEX: cbSize(+0) style(+4) lpfnWndProc(+8) cbClsExtra(+12) cbWndExtra(+16)
    ;;   hInstance(+20) hIcon(+24) hCursor(+28) hbrBackground(+32) lpszMenuName(+36)
    ;;   lpszClassName(+40) hIconSm(+44)
    (local.set $tmp (call $gl32 (i32.add (local.get $arg0) (i32.const 8)))) ;; lpfnWndProc
    (local.set $class_name_wa (call $g2w (call $gl32 (i32.add (local.get $arg0) (i32.const 40)))))
    ;; WNDCLASSEX without cbSize/hIconSm is exactly WNDCLASSA.  Copy and
    ;; publish it while the class-table writer lock is still held.
    (local.set $src (call $g2w (i32.add (local.get $arg0) (i32.const 4))))
    (global.set $eax (call $class_table_register_data
      (local.get $class_name_wa) (local.get $src)))
    ;; Store first EXE-space wndproc as main (skip DLL-registered classes)
    (if (i32.and (i32.eqz (global.get $wndproc_addr))
      (i32.and (i32.ge_u (local.get $tmp) (global.get $image_base))
               (i32.lt_u (local.get $tmp) (i32.add (global.get $image_base) (global.get $exe_size_of_image)))))
    (then
      (global.set $wndproc_addr (local.get $tmp))
      (global.set $wndclass_style (call $gl32 (i32.add (local.get $arg0) (i32.const 4))))
      (global.set $wndclass_bg_brush (call $gl32 (i32.add (local.get $arg0) (i32.const 32)))))
    (else
      (if (i32.and
            (i32.and (i32.eqz (global.get $wndproc_addr2))
                     (i32.ne (local.get $tmp) (global.get $wndproc_addr)))
            (i32.and (i32.ge_u (local.get $tmp) (global.get $image_base))
                     (i32.lt_u (local.get $tmp) (i32.add (global.get $image_base) (global.get $exe_size_of_image)))))
        (then (global.set $wndproc_addr2 (local.get $tmp))))))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8))) (return)
  )

  ;; 242: RegisterClassA
  (func $handle_RegisterClassA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $tmp i32) (local $class_name_wa i32) (local $slot i32) (local $dst i32)
    ;; WNDCLASSA: style(+0) lpfnWndProc(+4) cbClsExtra(+8) cbWndExtra(+12)
    ;;   hInstance(+16) hIcon(+20) hCursor(+24) hbrBackground(+28)
    ;;   lpszMenuName(+32) lpszClassName(+36)
    (local.set $tmp (call $gl32 (i32.add (local.get $arg0) (i32.const 4)))) ;; lpfnWndProc
    (local.set $class_name_wa (call $class_name_key (call $gl32 (i32.add (local.get $arg0) (i32.const 36)))))
    (global.set $eax (call $class_table_register_data
      (local.get $class_name_wa) (call $g2w (local.get $arg0))))
    ;; Store first EXE-space wndproc as main (skip DLL-registered classes)
    (if (i32.and (i32.eqz (global.get $wndproc_addr))
      (i32.and (i32.ge_u (local.get $tmp) (global.get $image_base))
               (i32.lt_u (local.get $tmp) (i32.add (global.get $image_base) (global.get $exe_size_of_image)))))
    (then
      (global.set $wndproc_addr (local.get $tmp))
      (global.set $wndclass_style (call $gl32 (local.get $arg0)))
      (global.set $wndclass_bg_brush (call $gl32 (i32.add (local.get $arg0) (i32.const 28)))))
    (else
      (if (i32.and
            (i32.and (i32.eqz (global.get $wndproc_addr2))
                     (i32.ne (local.get $tmp) (global.get $wndproc_addr)))
            (i32.and (i32.ge_u (local.get $tmp) (global.get $image_base))
                     (i32.lt_u (local.get $tmp) (i32.add (global.get $image_base) (global.get $exe_size_of_image)))))
        (then (global.set $wndproc_addr2 (local.get $tmp))))))
    ;; Keep the atom returned by class_table_register.  Callers commonly pass
    ;; it straight back to CreateWindowEx; collapsing every registration to
    ;; 0xC001 attaches later classes to the first registered WNDCLASS.
    (global.set $esp (i32.add (global.get $esp) (i32.const 8))) (return)
  )

  ;; 243: BeginPaint
  (func $handle_BeginPaint (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $cs i32) (local $brush i32) (local $hdc i32) (local $wa i32) (local $partial i32) (local $desc i32)
    (local $erase_pending i32)
    ;; Win98: BeginPaint sends WM_ERASEBKGND before returning. The default
    ;; handler fills the client area with this hwnd's registered class
    ;; hbrBackground. A NULL hbrBackground means no default erase; the app owns
    ;; the pixels. Do not use the last-registered class here: Solitaire's
    ;; custom "Stat" child is created after the main class and must not change
    ;; how unrelated hwnds erase.
    (local.set $brush (call $wnd_get_bg_brush (local.get $arg0)))
    ;; Whether an erase is still owed for this window, read before the fill
    ;; below clears it. fErase is decided from this at the end.
    (local.set $erase_pending
      (i32.ne (i32.and (call $nc_flags_test (local.get $arg0)) (i32.const 2))
              (i32.const 0)))
    ;; Fill PAINTSTRUCT: hdc(+0), fErase(+4), rcPaint(+8: left,top,right,bottom)
    (local.set $wa (call $g2w (local.get $arg1)))
    (call $zero_memory (local.get $wa) (i32.const 64))
    (local.set $hdc (call $host_alloc_window_dc (local.get $arg0) (i32.const 0)))
    (if (local.get $hdc)
      (then (call $host_paint_begin (local.get $arg0))))
    (call $gs32 (local.get $arg1) (local.get $hdc)) ;; hdc
    (call $gs32 (i32.add (local.get $arg1) (i32.const 4)) (i32.const 0)) ;; fErase
    ;; WAT owns the update rect. rcPaint is the pending update bbox; if no
    ;; update exists, return the full client rect like Win32's empty fallback.
    (local.set $wa (i32.add (local.get $wa) (i32.const 8)))
    (local.set $partial (call $update_get_rect (local.get $arg0) (local.get $wa)))
	    (if (i32.eqz (local.get $partial))
	      (then
	        ;; Empty update rect: rcPaint = full client.
	        (local.set $cs (call $host_get_window_client_size (local.get $arg0)))
	        (i32.store (local.get $wa) (i32.const 0))
	        (i32.store offset=4 (local.get $wa) (i32.const 0))
	        (i32.store offset=8 (local.get $wa) (i32.and (local.get $cs) (i32.const 0xFFFF)))
	        (i32.store offset=12 (local.get $wa) (i32.shr_u (local.get $cs) (i32.const 16)))))
	    ;; Some Win9x games resize/maximize from inside WM_PAINT and then draw a
	    ;; complete redraw-class scene while the old partial update region is still
	    ;; installed. For maximized CS_HREDRAW/CS_VREDRAW top-levels, promote that
	    ;; paint to the full client so the redraw is not clipped to the pre-resize
	    ;; splash/update rectangle.
	    (if (i32.and
	          (i32.and (local.get $partial) (call $wnd_max_get (local.get $arg0)))
	          (i32.ne (i32.and (global.get $wndclass_style) (i32.const 0x0003)) (i32.const 0)))
	      (then
	        (local.set $cs (call $host_get_window_client_size (local.get $arg0)))
	        (i32.store (local.get $wa) (i32.const 0))
	        (i32.store offset=4 (local.get $wa) (i32.const 0))
	        (i32.store offset=8 (local.get $wa) (i32.and (local.get $cs) (i32.const 0xFFFF)))
	        (i32.store offset=12 (local.get $wa) (i32.shr_u (local.get $cs) (i32.const 16)))
	        (local.set $partial (i32.const 0))))
    ;; Win16/VBRUN paint code commonly probes GetClipBox immediately after
    ;; BeginPaint and uses that rectangle to copy an AutoRedraw backing bitmap
    ;; to the visible HDC. Keep its historical update rect in the app clip
    ;; before applying the USER/system clip; moving it solely into the system
    ;; clip made Tic Tac Drop see a 1x1 paint box and copy only one pixel of
    ;; its completed board.
    (if (i32.and
          (i32.or (global.get $code16) (global.get $win16_beginpaint_call32))
          (local.get $partial))
      (then
        (drop (call $host_gdi_intersect_clip_rect
          (local.get $hdc)
          (i32.load (local.get $wa))
          (i32.load offset=4 (local.get $wa))
          (i32.load offset=8 (local.get $wa))
          (i32.load offset=12 (local.get $wa))))))
    ;; WAT-owned visible clipping: client bounds, parent, CLIPCHILDREN and
    ;; CLIPSIBLINGS establish USER's system clip. The update rectangle is part
    ;; of that same system region, not the application-selected clip:
    ;; SelectClipRgn/IntersectClipRect may replace the latter during WM_PAINT
    ;; but must never let drawing escape rcPaint. CARDS.DLL selects one card
    ;; rectangle at a time; keeping rcPaint in the app clip let those selects
    ;; erase Hearts' three already-dealt opponent hands outside the update.
    (call $dc_apply_client_clip (local.get $hdc) (local.get $arg0))
    (if (i32.and
          (i32.eqz
            (i32.or (global.get $code16) (global.get $win16_beginpaint_call32)))
          (local.get $partial))
      (then
        (drop (call $gdi_dc_system_clip_rect
          (local.get $hdc)
          (i32.load (local.get $wa))
          (i32.load offset=4 (local.get $wa))
          (i32.load offset=8 (local.get $wa))
          (i32.load offset=12 (local.get $wa))
          (i32.const 1))))) ;; RGN_AND
    ;; Erase through the same clipped paint HDC. Win98's BeginPaint/WM_ERASEBKGND
    ;; is constrained by the update/visible region; erasing before the clip is
    ;; installed wipes too much during small invalidations (Spider card drags).
    (local.set $cs (call $host_get_window_client_size (local.get $arg0)))
    ;; Whose background is it? Filling here unconditionally is right for a
    ;; window that lets USER paint its background, and destroys one that paints
    ;; its own: Hearts fills its baize green in WM_ERASEBKGND and was registered
    ;; with WHITE_BRUSH, so every paint turned the table white -- and which of
    ;; the two won depended on the order the pump happened to run them in, so it
    ;; flickered between green and white as the game went on.
    ;;
    ;; The window itself has already answered the question. NC_FLAGS bit 3 is
    ;; set when a WM_ERASEBKGND reaches DefWindowProc, which only happens for a
    ;; window that did not want it. Bit 1 means an erase is still outstanding
    ;; and nobody has been given it yet -- the first paint of a window's life --
    ;; and the class brush is the right answer there too.
    ;;
    ;; Bit 1 is a child's answer only. A top-level window is offered its
    ;; WM_ERASEBKGND by the pump (GetMessageA's startup phase, and
    ;; $host_erase_background after it), so by the time it reaches BeginPaint
    ;; the question has already been put to its wndproc and bit 3 records the
    ;; answer. Honouring the creation-time bit 1 here as well erases a second
    ;; time, with the class brush, on top of whatever the app painted in
    ;; between -- and a VB form registers its class with COLOR_WINDOW+1 while
    ;; painting its real BackColor itself, so that second erase is white.
    ;; Rodent's Revenge is the visible case: its whole status panel, mouse
    ;; count, timer and score came out as a white band (7645 px against the
    ;; reviewed Win98 capture) once this fill started firing.
    ;;
    ;; Children have no pump-delivered erase, so for them the creation seed is
    ;; still the only background they would ever get -- IdleWild's IWINFO pane
    ;; is white in Win98 for exactly that reason (test-win16-wep1-gameplay).
    ;; They are also no longer filled on every single paint, which used to
    ;; black out Diablo's burning logo on 13 frames of every 15: the sibling
    ;; frame below it repaints on its own InvalidateRect(rc, FALSE), and that
    ;; leaves bit 1 clear.
    ;; Same --trace-erase line as $host_erase_background: this is the other
    ;; place a window's background gets filled, and telling the two apart is
    ;; the whole point of the trace. Negative height marks the BeginPaint one.
    ;; The trace fires whether or not the fill below runs -- it reports the
    ;; question, not the answer.
    (call $host_erase_trace (local.get $arg0) (local.get $brush)
      (i32.and (local.get $cs) (i32.const 0xFFFF))
      (i32.sub (i32.const 0) (i32.shr_u (local.get $cs) (i32.const 16))))
    (if (i32.and (i32.ne (local.get $brush) (i32.const 0))
          (i32.or
            (i32.ne (i32.and (call $nc_flags_test (local.get $arg0))
                             (i32.const 8)) (i32.const 0))
            (i32.and
              (i32.ne (i32.and (call $wnd_get_style (local.get $arg0))
                               (i32.const 0x40000000)) (i32.const 0))
              (i32.or
                (global.get $code16)
                (i32.and
                  (i32.ne (i32.and (call $nc_flags_test (local.get $arg0))
                                   (i32.const 2)) (i32.const 0))
                  ;; A Win16 custom child (VB ThunderPictureBox et al.) can
                  ;; draw into its visible DC before it validates with
                  ;; BeginPaint. Treating that later BeginPaint as a request
                  ;; to repaint the class brush puts USER's background on top
                  ;; of the app pixels. WAT-native controls paint through
                  ;; their own path rather than the Win16 BeginPaint thunk, and
                  ;; first exposure is already erased when the parent becomes
                  ;; visible.
                  (i32.eqz (global.get $win16_beginpaint_call32)))))))
      (then
        (call $nc_flags_clear (local.get $arg0) (i32.const 2))
        (local.set $desc (global.get $GDI_LINE_DESC))
        (if (call $gdi_surface_descriptor (local.get $hdc) (local.get $desc))
          (then (drop (call $gdi_fill_rect_desc
            (local.get $hdc) (local.get $desc)
            (i32.const 0) (i32.const 0)
            (i32.and (local.get $cs) (i32.const 0xFFFF))
            (i32.shr_u (local.get $cs) (i32.const 16))
            (local.get $brush)))))))
    ;; fErase is the answer to "did anyone erase the background for you?", and
    ;; it is the only way an app finds out that it has to do it itself. USER
    ;; erases from the class brush; a window whose class has none gets a
    ;; WM_ERASEBKGND that DefWindowProc declines, and BeginPaint then reports
    ;; TRUE so the app paints its own background.
    ;;
    ;; Storm builds every Diablo menu on exactly that contract: its paint
    ;; wrapper saves GCL_HBRBACKGROUND, sets it to NULL, calls BeginPaint, puts
    ;; the brush back -- and draws the whole menu background only when the
    ;; returned ps.fErase is non-zero. Answering 0 unconditionally here left
    ;; Diablo a black screen with five invisible buttons on it.
    ;;
    ;; Two things have to be true before the answer is TRUE: an erase was owed
    ;; at all, and nothing performed it. Win98 only sends WM_ERASEBKGND when
    ;; the update region was invalidated with bErase, and only then can fErase
    ;; come back TRUE; InvalidateRect(hwnd, NULL, FALSE) means "keep what is
    ;; on screen" and reports FALSE.
    ;;
    ;; The brush test is load-bearing for Diablo: dropping it left the menu a
    ;; black screen with five invisible buttons. Do NOT additionally require
    ;; erase_pending here (tried twice now): storm creates its 640x480 menu
    ;; dialog hidden, shows it, and paints it only through the flame
    ;; animation's InvalidateRect(NULL, FALSE) cycle — the erase-owed bit is
    ;; consumed by the first paint and never set again, so gating fErase on it
    ;; answers 0 to every later full-menu paint and storm never draws the
    ;; background again: black menu with faint text (36c78d79 regressed this).
    ;; Answering 1 whenever the class brush is NULL is what real USER's
    ;; DefWindowProc contract degenerates to for these apps, and the verified
    ;; retail-Diablo-to-Tristram run was made on exactly this shape.
    (if (i32.eqz (local.get $brush))
      (then (call $gs32 (i32.add (local.get $arg1) (i32.const 4)) (i32.const 1))))
    (if (i32.and
          (i32.eqz (global.get $code16))
          (local.get $erase_pending))
      (then (call $nc_flags_clear (local.get $arg0) (i32.const 2))))
    (global.set $eax (local.get $hdc))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12))) (return)
  )

  ;; USER's clipboard transaction is exclusive even though this emulator has
  ;; one Windows process. EmptyClipboard later transfers ownership to the HWND
  ;; associated here; a NULL HWND means the task may inspect the clipboard but
  ;; cannot publish new data after emptying it.
  (global $clipboard_open (mut i32) (i32.const 0))
  (global $clipboard_open_hwnd (mut i32) (i32.const 0))
  (global $clipboard_owner_hwnd (mut i32) (i32.const 0))
  (global $clipboard_emptied_by_opener (mut i32) (i32.const 0))

  ;; 244: OpenClipboard(hwndNewOwner).
  (func $handle_OpenClipboard (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (drop (local.get $arg1))
    (drop (local.get $arg2))
    (drop (local.get $arg3))
    (drop (local.get $arg4))
    (drop (local.get $name_ptr))
    (if (global.get $clipboard_open)
      (then
        (global.set $last_error (i32.const 5)) ;; ERROR_ACCESS_DENIED
        (global.set $eax (i32.const 0))
        (global.set $esp (i32.add (global.get $esp) (i32.const 8)))
        (return)))
    (if (i32.and
          (i32.ne (local.get $arg0) (i32.const 0))
          (i32.lt_s (call $wnd_table_find (local.get $arg0)) (i32.const 0)))
      (then
        (global.set $last_error (i32.const 1400)) ;; ERROR_INVALID_WINDOW_HANDLE
        (global.set $eax (i32.const 0))
        (global.set $esp (i32.add (global.get $esp) (i32.const 8)))
        (return)))
    (global.set $clipboard_open (i32.const 1))
    (global.set $clipboard_open_hwnd (local.get $arg0))
    (global.set $clipboard_emptied_by_opener (i32.const 0))
    (global.set $eax (i32.const 1))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8)))
  )

  ;; 245: CloseClipboard(). Ownership survives closing; only the exclusive
  ;; access transaction ends.
  (func $handle_CloseClipboard (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (drop (local.get $arg0))
    (drop (local.get $arg1))
    (drop (local.get $arg2))
    (drop (local.get $arg3))
    (drop (local.get $arg4))
    (drop (local.get $name_ptr))
    (if (i32.eqz (global.get $clipboard_open))
      (then
        (global.set $last_error (i32.const 1418)) ;; ERROR_CLIPBOARD_NOT_OPEN
        (global.set $eax (i32.const 0))
        (global.set $esp (i32.add (global.get $esp) (i32.const 4)))
        (return)))
    (global.set $clipboard_open (i32.const 0))
    (global.set $clipboard_open_hwnd (i32.const 0))
    (global.set $clipboard_emptied_by_opener (i32.const 0))
    (global.set $eax (i32.const 1))
    (global.set $esp (i32.add (global.get $esp) (i32.const 4)))
  )

  ;; 246: IsClipboardFormatAvailable(format)
  (func $handle_IsClipboardFormatAvailable (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (drop (local.get $arg1))
    (drop (local.get $arg2))
    (drop (local.get $arg3))
    (drop (local.get $arg4))
    (drop (local.get $name_ptr))
    (global.set $eax (call $clipboard_is_format_available (local.get $arg0)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8)))
  )

  ;; 247: GetEnvironmentStringsW — a wide copy of the process environment.
  ;; This used to answer with a literal L"A=B\0\0" while the ANSI spelling
  ;; handed back the command line, so the two disagreed about the environment
  ;; and neither described it. Both are copies of one real block now.
  (func $handle_GetEnvironmentStringsW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $env_strings (i32.const 1)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 4))) (return)
  )

  ;; 248: GetSaveFileNameA(lpOFN) — show modal Save As dialog
  ;; Same UI as GetOpenFileName, just kind=1 → "Save As" title + "Save" button.
  (func $handle_GetSaveFileNameA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $dlg i32) (local $owner i32)
    (call $modal_capture_nonvolatile)
    (global.set $opendlg_wide (i32.const 0))
    (local.set $dlg (global.get $next_hwnd))
    (global.set $next_hwnd (i32.add (global.get $next_hwnd) (i32.const 1)))
    (local.set $owner (call $gl32 (i32.add (local.get $arg0) (i32.const 4))))
    (call $create_open_dialog (local.get $dlg) (local.get $owner) (i32.const 1) (local.get $arg0))
    (call $modal_begin (local.get $dlg) (i32.const 8))
  )

  ;; GetSaveFileNameW(lpOFN) — the W twin of the above, exactly as
  ;; GetOpenFileNameW is to GetOpenFileNameA. It was simply missing, so
  ;; the XP Sound Recorder (a Unicode app) trapped on File > Save and
  ;; File > Save As instead of showing a dialog.
  (func $handle_GetSaveFileNameW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $dlg i32) (local $owner i32)
    (call $modal_capture_nonvolatile)
    (global.set $opendlg_wide (i32.const 1))
    (local.set $dlg (global.get $next_hwnd))
    (global.set $next_hwnd (i32.add (global.get $next_hwnd) (i32.const 1)))
    (local.set $owner (call $gl32 (i32.add (local.get $arg0) (i32.const 4))))
    (call $create_open_dialog (local.get $dlg) (local.get $owner) (i32.const 1) (local.get $arg0))
    (call $modal_begin (local.get $dlg) (i32.const 8))
  )

;; 250: lstrcmpiA
  (func $handle_lstrcmpiA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $lstr_cmp (local.get $arg0) (local.get $arg1) (i32.const 0) (i32.const 1)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12)))
  )

  ;; 251-252: FreeEnvironmentStrings{A,W} — release the copy handed out by
  ;; GetEnvironmentStrings. Both spellings free the same kind of heap block.
  (func $handle_FreeEnvironmentStringsA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (local.get $arg0) (then (call $heap_free (local.get $arg0))))
    (global.set $eax (i32.const 1))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8)))
  )

  (func $handle_FreeEnvironmentStringsW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_FreeEnvironmentStringsA (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
  )

  ;; 253: GetVersion — return winver, 0 args
  (func $handle_GetVersion (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (global.get $winver))
    (global.set $esp (i32.add (global.get $esp) (i32.const 4)))
  )

;; 255: wsprintfA
  (func $handle_wsprintfA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; wsprintfA(buf, fmt, ...) — cdecl, caller cleans stack
    (global.set $eax (call $wsprintf_impl
      (local.get $arg0) (local.get $arg1) (i32.add (global.get $esp) (i32.const 12))))
    ;; cdecl: only pop return address
    (global.set $esp (i32.add (global.get $esp) (i32.const 4)))
  )

  ;; wvsprintfA(buf, fmt, arglist) — stdcall, 3 args
  (func $handle_wvsprintfA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; wsprintf_impl expects arg_ptr as a guest address and reads args with gl32.
    (global.set $eax (call $wsprintf_impl
      (local.get $arg0) (local.get $arg1) (local.get $arg2)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 16)))
  )

  ;; GetPrivateProfileString{A,W}(appName, keyName, default, retBuf, nSize, fileName)
  ;; — 6 args stdcall. One INI read for both spellings; $wide picks the encoding.
  (func $ini_get_string (param $app_g i32) (param $key_g i32) (param $def_g i32)
                        (param $buf_g i32) (param $size i32) (param $file_g i32)
                        (param $wide i32) (result i32)
    (call $host_ini_get_string
      (select (i32.const 0) (call $g2w (local.get $app_g)) (i32.eqz (local.get $app_g)))
      (select (i32.const 0) (call $g2w (local.get $key_g)) (i32.eqz (local.get $key_g)))
      (select (i32.const 0) (call $g2w (local.get $def_g)) (i32.eqz (local.get $def_g)))
      (local.get $buf_g)        ;; retBuf (guest addr — host will g2w)
      (local.get $size)         ;; nSize
      (call $g2w (local.get $file_g))
      (local.get $wide)))

  (func $handle_GetPrivateProfileStringA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $ini_get_string
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4)
      (call $gl32 (i32.add (global.get $esp) (i32.const 24)))
      (i32.const 0)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 28)))
  )

  ;; GetPrivateProfileSectionA(appName, returnedString, size, fileName)
  ;; returns a double-NUL-terminated sequence of key=value strings.
  (func $handle_GetPrivateProfileSectionA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $host_ini_get_section
      (call $g2w (local.get $arg0))
      (local.get $arg1)
      (local.get $arg2)
      (call $g2w (local.get $arg3))
      (i32.const 0)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 20)))
  )

  ;; 257: __wgetmainargs
  (func $handle___wgetmainargs (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; arg0=&argc, arg1=&argv, arg2=&envp (wide versions)
    (if (i32.eqz (global.get $msvcrt_wcmdln_ptr))
      (then (call $store_fake_wcmdline)))
    (call $gs32 (local.get $arg0)
      (call $gl32 (i32.add (global.get $msvcrt_wcmdln_ptr) (i32.const 772))))
    (call $gs32 (local.get $arg1) (i32.add (global.get $msvcrt_wcmdln_ptr) (i32.const 776)))
    (call $gs32 (local.get $arg2) (i32.add (global.get $msvcrt_wcmdln_ptr) (i32.const 784)))
    (global.set $eax (i32.const 0))
    (global.set $esp (i32.add (global.get $esp) (i32.const 4))) (return)
  )

  ;; 258: __p__wcmdln
  (func $handle___p__wcmdln (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.eqz (global.get $msvcrt_wcmdln_ptr))
      (then (call $store_fake_wcmdline)))
    (call $gs32 (i32.add (global.get $msvcrt_wcmdln_ptr) (i32.const 768)) (global.get $msvcrt_wcmdln_ptr))
    (global.set $eax (i32.add (global.get $msvcrt_wcmdln_ptr) (i32.const 768)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 4))) (return)
  )

  ;; 259: __p__acmdln
  (func $handle___p__acmdln (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.eqz (global.get $fake_cmdline_addr))
      (then (call $store_fake_cmdline)))
    (global.set $eax (i32.add (global.get $fake_cmdline_addr) (i32.const 504)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 4))) (return)
  )

  ;; __p__environ() — cdecl, returns &_environ for the narrow CRT. Keep the
  ;; distinct __initenv slot in the adjacent word: MSVCRT initializes
  ;; `__initenv = _environ`, but they remain two globals so a later assignment
  ;; through &_environ does not rewrite the initial-environment snapshot.
  (func $handle___p__environ (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.eqz (global.get $fake_cmdline_addr))
      (then (call $store_fake_cmdline)))
    (if (i32.eqz (global.get $msvcrt_environ_ptr))
      (then
        (global.set $msvcrt_environ_ptr (call $heap_alloc (i32.const 8)))
        (call $gs32 (global.get $msvcrt_environ_ptr)
          (i32.add (global.get $fake_cmdline_addr) (i32.const 1532)))
        (call $gs32 (i32.add (global.get $msvcrt_environ_ptr) (i32.const 4))
          (i32.add (global.get $fake_cmdline_addr) (i32.const 1532)))))
    (global.set $eax (global.get $msvcrt_environ_ptr))
    (global.set $esp (i32.add (global.get $esp) (i32.const 4))) (return)
  )

  ;; __p___initenv() — cdecl, returns &__initenv for the narrow CRT startup path.
  (func $handle___p___initenv (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle___p__environ
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
    (global.set $eax (i32.add (global.get $msvcrt_environ_ptr) (i32.const 4)))
  )

  ;; 260: __set_app_type(type) — cdecl; sets GUI vs console, no-op for us
  (func $handle___set_app_type (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $esp (i32.add (global.get $esp) (i32.const 4)))
  )

  ;; 261: __setusermatherr(handler) — cdecl; set math error handler, no-op
  (func $handle___setusermatherr (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $esp (i32.add (global.get $esp) (i32.const 4)))
  )

  ;; 262: _adjust_fdiv
  (func $handle__adjust_fdiv (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; Return pointer to a 0 dword (no FDIV bug)
    (if (i32.eqz (global.get $msvcrt_fmode_ptr))
      (then (global.set $msvcrt_fmode_ptr (call $heap_alloc (i32.const 4)))))
    (global.set $eax (global.get $msvcrt_fmode_ptr))
    (global.set $esp (i32.add (global.get $esp) (i32.const 4))) (return)
  )

  ;; 263: free(ptr) — cdecl
  (func $handle_free (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $heap_free (local.get $arg0))
    (global.set $esp (i32.add (global.get $esp) (i32.const 4)))
  )

  ;; 264: malloc(size) — cdecl
  (func $handle_malloc (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $heap_alloc (local.get $arg0)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 4)))
  )

  ;; operator new(size_t) / operator new[](size_t) — cdecl. The MSVC decorated
  ;; names ??2@YAPAXI@Z and ??_U@YAPAXI@Z; both are plain allocations, and
  ;; MSVC's own implementations are malloc with a new-handler retry loop we
  ;; have no use for. Returning NULL on exhaustion matches the non-throwing
  ;; behaviour of the msvcrt these binaries link against.
  (func $cpp_operator_new (param $size i32)
    (global.set $eax (call $heap_alloc (local.get $size)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 4)))
  )
  (func $handle_??2@YAPAXI@Z (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $cpp_operator_new (local.get $arg0))
  )
  (func $handle_??_U@YAPAXI@Z (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $cpp_operator_new (local.get $arg0))
  )

  ;; operator delete(void*) / operator delete[](void*) — cdecl, and a NULL
  ;; pointer is explicitly a no-op in C++.
  (func $cpp_operator_delete (param $ptr i32)
    (if (local.get $ptr) (then (call $heap_free (local.get $ptr))))
    (global.set $esp (i32.add (global.get $esp) (i32.const 4)))
  )
  (func $handle_??3@YAXPAX@Z (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $cpp_operator_delete (local.get $arg0))
  )
  (func $handle_??_V@YAXPAX@Z (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $cpp_operator_delete (local.get $arg0))
  )

  ;; 265: calloc(num, size) — cdecl
  (func $handle_calloc (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $tmp i32)
    (local.set $tmp (i32.mul (local.get $arg0) (local.get $arg1)))
    (global.set $eax (call $heap_alloc (local.get $tmp)))
    (call $zero_memory (call $g2w (global.get $eax)) (local.get $tmp))
    (global.set $esp (i32.add (global.get $esp) (i32.const 4)))
  )

  ;; 266: rand
  (func $handle_rand (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $rand_seed (i32.add (i32.mul (global.get $rand_seed) (i32.const 1103515245)) (i32.const 12345)))
    (global.set $eax (i32.and (i32.shr_u (global.get $rand_seed) (i32.const 16)) (i32.const 0x7FFF)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 4))) (return)
  )

  ;; 267: srand(seed) — cdecl
  (func $handle_srand (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $rand_seed (local.get $arg0))
    (global.set $esp (i32.add (global.get $esp) (i32.const 4)))
  )

  ;; 268: _purecall
  (func $handle__purecall (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $host_exit (i32.const 3))
    (global.set $esp (i32.add (global.get $esp) (i32.const 4))) (return)
  )

  ;; 269: _onexit(func) — cdecl; accept the shutdown registration.
  ;; The emulator tears down the whole guest process at exit, so there is no
  ;; process-global CRT state left for these callbacks to release. Returning
  ;; the supplied function matches successful CRT registration.
  (func $handle__onexit (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (local.get $arg0))
    (global.set $esp (i32.add (global.get $esp) (i32.const 4)))
  )

  ;; 270: __dllonexit(func, begin, end) — cdecl; DLL-local counterpart.
  (func $handle___dllonexit (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (local.get $arg0))
    (global.set $esp (i32.add (global.get $esp) (i32.const 4)))
  )

  ;; 271: _splitpath — STUB: unimplemented
  (func $handle__splitpath (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $crash_unimplemented (local.get $name_ptr))
  )

  ;; 272: _wcsicmp — STUB: unimplemented
  (func $handle__wcsicmp (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $crash_unimplemented (local.get $name_ptr))
  )

  ;; 273: _wtoi — cdecl; wide string to int
  (func $handle__wtoi (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $tmp i32) (local $v i32) (local $i i32)
    (local.set $i (i32.const 0))
    (local.set $tmp (i32.const 0))
    (local.set $v (call $gl16 (local.get $arg0)))
    ;; Skip whitespace
    (block $ws_done (loop $ws
      (br_if $ws_done (i32.ne (local.get $v) (i32.const 0x20)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (local.set $v (call $gl16 (i32.add (local.get $arg0) (i32.shl (local.get $i) (i32.const 1)))))
      (br $ws)))
    ;; Parse digits
    (block $done (loop $parse
      (br_if $done (i32.lt_u (local.get $v) (i32.const 0x30)))
      (br_if $done (i32.gt_u (local.get $v) (i32.const 0x39)))
      (local.set $tmp (i32.add (i32.mul (local.get $tmp) (i32.const 10)) (i32.sub (local.get $v) (i32.const 0x30))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (local.set $v (call $gl16 (i32.add (local.get $arg0) (i32.shl (local.get $i) (i32.const 1)))))
      (br $parse)))
    (global.set $eax (local.get $tmp))
    (global.set $esp (i32.add (global.get $esp) (i32.const 4))) (return)
  )

  ;; 274: _itow — int to wide string (STUB: unimplemented: write "0")
  (func $handle__itow (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $crt_itoa (local.get $arg0) (local.get $arg1) (local.get $arg2) (i32.const 1)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 4)))
  )

  ;; 275: wcscmp — STUB: unimplemented
  (func $handle_wcscmp (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $crash_unimplemented (local.get $name_ptr))
  )

  ;; 276: wcsncpy
  (func $handle_wcsncpy (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $v i32) (local $i i32)
    (local.set $i (i32.const 0))
    (block $d (loop $l
      (br_if $d (i32.ge_u (local.get $i) (local.get $arg2)))
      (local.set $v (call $gl16 (i32.add (local.get $arg1) (i32.shl (local.get $i) (i32.const 1)))))
      (call $gs16 (i32.add (local.get $arg0) (i32.shl (local.get $i) (i32.const 1))) (local.get $v))
      (br_if $d (i32.eqz (local.get $v)))
      (local.set $i (i32.add (local.get $i) (i32.const 1))) (br $l)))
    (global.set $eax (local.get $arg0))
    (global.set $esp (i32.add (global.get $esp) (i32.const 4)))
  )

  ;; 277: wcslen — STUB: unimplemented
  (func $handle_wcslen (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $crash_unimplemented (local.get $name_ptr))
  )

  ;; 278: memset(dest, ch, count) — cdecl
  (func $handle_memset (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $guest_memset (local.get $arg0) (local.get $arg1) (local.get $arg2))
    (global.set $eax (local.get $arg0))
    (global.set $esp (i32.add (global.get $esp) (i32.const 4)))
  )

  ;; 279: memcpy(dest, src, count) — cdecl
  (func $handle_memcpy (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $guest_memmove (local.get $arg0) (local.get $arg1) (local.get $arg2))
    (global.set $eax (local.get $arg0))
    (global.set $esp (i32.add (global.get $esp) (i32.const 4)))
  )

  ;; 280: __CxxFrameHandler — C++ exception frame handler (STUB: unimplemented, return 1=ExceptionContinueSearch)
  (func $handle___CxxFrameHandler (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $crash_unimplemented (local.get $name_ptr))
  )

  ;; 281: _global_unwind2 — STUB: unimplemented
  (func $handle__global_unwind2 (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $crash_unimplemented (local.get $name_ptr))
  )

  ;; 282: _getdcwd — STUB: unimplemented: return empty string
  (func $handle__getdcwd (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $crash_unimplemented (local.get $name_ptr))
  )

  ;; 283: GetModuleHandleW(lpModuleName) — the A lookup, over a narrowed name.
  ;; It used to run its own search ($find_dll_by_wname, now gone) that compared
  ;; the name exactly and knew nothing of the ole32 rule, so the same module
  ;; resolved under one spelling and came back NULL under the other.
  (func $handle_GetModuleHandleW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $len i32) (local $ansi i32)
    (if (local.get $arg0)
      (then
        (local.set $len (i32.add (call $guest_wcslen (local.get $arg0)) (i32.const 1)))
        (local.set $ansi (call $heap_alloc (local.get $len)))
        (if (i32.eqz (local.get $ansi))
          (then (global.set $eax (i32.const 0))
                (global.set $esp (i32.add (global.get $esp) (i32.const 8)))
                (return)))
        (drop (call $wide_to_ansi (local.get $arg0) (local.get $ansi) (local.get $len)))))
    (call $handle_GetModuleHandleA (local.get $ansi) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
    (if (local.get $ansi) (then (call $heap_free (local.get $ansi))))
  )

  ;; 284: GetModuleFileNameW — write L"C:\<exe_name>\0" as wide string
  (func $handle_GetModuleFileNameW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $idx i32) (local $path_g i32)
    (local.set $idx (call $static_sys_dll_from_handle (local.get $arg0)))
    (if (local.get $idx)
      (then
        (global.set $eax (call $static_sys_dll_file_name
          (i32.sub (local.get $idx) (i32.const 1))
          (local.get $arg1) (local.get $arg2) (i32.const 1)))
        (global.set $esp (i32.add (global.get $esp) (i32.const 16))) (return)))
    (local.set $idx (i32.const 0))
    (block $not_loaded (loop $scan_loaded
      (br_if $not_loaded (i32.ge_u (local.get $idx) (global.get $dll_count)))
      (if (i32.eq (local.get $arg0)
            (i32.load (i32.add (global.get $DLL_TABLE)
              (i32.mul (local.get $idx) (i32.const 32)))))
        (then
          (local.set $path_g (i32.load (i32.add (global.get $DLL_PATH_TABLE)
            (i32.shl (local.get $idx) (i32.const 2)))))
          (if (local.get $path_g)
            (then
              (global.set $eax (call $loaded_module_file_name
                (local.get $path_g) (local.get $arg1) (local.get $arg2) (i32.const 1)))
              (global.set $esp (i32.add (global.get $esp) (i32.const 16)))
              (return)))))
      (local.set $idx (i32.add (local.get $idx) (i32.const 1)))
      (br $scan_loaded)))
    (global.set $eax (call $module_file_name (local.get $arg1) (local.get $arg2) (i32.const 1)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 16))) (return)
  )

  ;; 285: GetCommandLineW
  (func $handle_GetCommandLineW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.eqz (global.get $msvcrt_wcmdln_ptr))
      (then (call $store_fake_wcmdline)))
    (global.set $eax (global.get $msvcrt_wcmdln_ptr))
    (global.set $esp (i32.add (global.get $esp) (i32.const 4))) (return)
  )

  ;; 286: CreateWindowExW — convert ASCII-compatible wide strings and reuse
  ;; the mature A path. This keeps Unicode callers on the same CBT hook,
  ;; WM_CREATE, menu, owner/parent, control-class, and show/paint machinery as
  ;; ANSI callers. Class table keys are byte-string hashes, so RegisterClassW
  ;; and CreateWindowExA-style lookup share the same slots after conversion.
  ;; While the A core runs, these preserve the caller-owned UTF-16 pointers for
  ;; CREATESTRUCTW. They are per-WASM-instance and cleared before returning.
  (global $createwnd_wide_name (mut i32) (i32.const 0))
  (global $createwnd_wide_class (mut i32) (i32.const 0))
  (func $handle_CreateWindowExW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $class_a i32) (local $title_a i32)
    (local.set $class_a (local.get $arg1))
    (if (i32.ge_u (local.get $arg1) (i32.const 0x10000))
      (then
        (local.set $class_a (call $heap_alloc (i32.const 256)))
        (if (local.get $class_a)
          (then
            (drop (call $wide_to_ansi (local.get $arg1) (local.get $class_a) (i32.const 256)))))))
    (local.set $title_a (local.get $arg2))
    (if (i32.ge_u (local.get $arg2) (i32.const 0x10000))
      (then
        (local.set $title_a (call $heap_alloc (i32.const 512)))
        (if (local.get $title_a)
          (then
            (drop (call $wide_to_ansi (local.get $arg2) (local.get $title_a) (i32.const 512)))))))
    (global.set $createwnd_wide_name (local.get $arg2))
    (global.set $createwnd_wide_class (local.get $arg1))
    (call $handle_CreateWindowExA
      (local.get $arg0)
      (local.get $class_a)
      (local.get $title_a)
      (local.get $arg3)
      (local.get $arg4)
      (local.get $name_ptr))
    (global.set $createwnd_wide_name (i32.const 0))
    (global.set $createwnd_wide_class (i32.const 0))
    ;; Free in reverse allocation order so the first-fit free list can reuse
    ;; both differently-sized blocks on the next call without fragmentation.
    (if (i32.and (i32.ne (local.get $title_a) (i32.const 0))
                 (i32.ne (local.get $title_a) (local.get $arg2)))
      (then (call $heap_free (local.get $title_a))))
    (if (i32.and (i32.ne (local.get $class_a) (i32.const 0))
                 (i32.ne (local.get $class_a) (local.get $arg1)))
      (then (call $heap_free (local.get $class_a))))
    (return)
  )

  ;; 287: RegisterClassW
  (func $handle_RegisterClassW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; RegisterClassW — same layout as RegisterClassA, just Unicode strings
    (local $tmp i32) (local $class_name_wa i32) (local $slot i32) (local $dst i32)
    (local.set $tmp (call $gl32 (i32.add (local.get $arg0) (i32.const 4))))
    (local.set $class_name_wa (call $class_wide_name_key (call $gl32 (i32.add (local.get $arg0) (i32.const 36)))))
    (global.set $eax (call $class_table_register_data
      (local.get $class_name_wa) (call $g2w (local.get $arg0))))
    (if (i32.and (i32.eqz (global.get $wndproc_addr))
      (i32.and (i32.ge_u (local.get $tmp) (global.get $image_base))
               (i32.lt_u (local.get $tmp) (i32.add (global.get $image_base) (global.get $exe_size_of_image)))))
    (then
      (global.set $wndproc_addr (local.get $tmp))
      (global.set $wndclass_style (call $gl32 (local.get $arg0)))
      (global.set $wndclass_bg_brush (call $gl32 (i32.add (local.get $arg0) (i32.const 28)))))
    (else (if (i32.and
      (i32.and (i32.eqz (global.get $wndproc_addr2))
               (i32.ne (local.get $tmp) (global.get $wndproc_addr)))
      (i32.and (i32.ge_u (local.get $tmp) (global.get $image_base))
               (i32.lt_u (local.get $tmp) (i32.add (global.get $image_base) (global.get $exe_size_of_image)))))
    (then (global.set $wndproc_addr2 (local.get $tmp))))))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8)))
  )

  ;; 288: RegisterClassExW
  (func $handle_RegisterClassExW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $tmp i32) (local $class_name_wa i32) (local $slot i32) (local $dst i32) (local $src i32)
    ;; WNDCLASSEXW: cbSize(+0) style(+4) lpfnWndProc(+8) ... lpszClassName(+40)
    (local.set $tmp (call $gl32 (i32.add (local.get $arg0) (i32.const 8))))
    (local.set $class_name_wa (call $class_wide_name_key (call $gl32 (i32.add (local.get $arg0) (i32.const 40)))))
    (local.set $src (call $g2w (i32.add (local.get $arg0) (i32.const 4))))
    (global.set $eax (call $class_table_register_data
      (local.get $class_name_wa) (local.get $src)))
    (if (i32.and (i32.eqz (global.get $wndproc_addr))
      (i32.and (i32.ge_u (local.get $tmp) (global.get $image_base))
               (i32.lt_u (local.get $tmp) (i32.add (global.get $image_base) (global.get $exe_size_of_image)))))
    (then
      (global.set $wndproc_addr (local.get $tmp))
      (global.set $wndclass_style (call $gl32 (i32.add (local.get $arg0) (i32.const 4))))
      (global.set $wndclass_bg_brush (call $gl32 (i32.add (local.get $arg0) (i32.const 32)))))
    (else
      (if (i32.and
            (i32.and (i32.eqz (global.get $wndproc_addr2))
                     (i32.ne (local.get $tmp) (global.get $wndproc_addr)))
            (i32.and (i32.ge_u (local.get $tmp) (global.get $image_base))
                     (i32.lt_u (local.get $tmp) (i32.add (global.get $image_base) (global.get $exe_size_of_image)))))
        (then (global.set $wndproc_addr2 (local.get $tmp))))))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8)))
  )

  ;; 289: DefWindowProcW — same as DefWindowProcA
  (func $handle_DefWindowProcW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.eq (local.get $arg1) (i32.const 0x0047))
      (then
        (call $windowpos_defproc_geometry (local.get $arg0) (local.get $arg3))
        (global.set $eax (i32.const 0))
        (global.set $esp (i32.add (global.get $esp) (i32.const 20)))
        (return)))
    ;; WM_NCCREATE (0x81): accepting non-client creation is the documented
    ;; default. Returning zero aborts CreateWindowEx before WM_CREATE.
    (if (i32.eq (local.get $arg1) (i32.const 0x0081))
      (then
        (global.set $eax (i32.const 1))
        (global.set $esp (i32.add (global.get $esp) (i32.const 20)))
        (return)))
    ;; Encoding-neutral default: permit WM_QUERYOPEN unless the application
    ;; consumes it before reaching DefWindowProcW.
    (if (i32.eq (local.get $arg1) (i32.const 0x0013))
      (then
        (global.set $eax (i32.const 1))
        (global.set $esp (i32.add (global.get $esp) (i32.const 20)))
        (return)))
    ;; WM_CLOSE (0x10): default close destroys the target. Only closing the
    ;; main window should end the message loop; modeless dialogs are ordinary
    ;; owned windows and closing them must not terminate the app.
    (if (i32.eq (local.get $arg1) (i32.const 0x0010))
    (then
      ;; A DialogBoxParamA dialog closed through default WM_CLOSE must end
      ;; the modal pump; destroying the HWND alone leaves the guest waiting
      ;; forever in the CACA0004 loop.
      (if (i32.and
            (i32.ne (i32.load (global.get $SHARED_DLG_PUMP_HWND)) (i32.const 0))
            (i32.eq (local.get $arg0) (i32.load (global.get $SHARED_DLG_PUMP_HWND))))
        (then
          (global.set $dlg_ended (i32.const 1))
          (global.set $dlg_result (i32.const 2)) ;; IDCANCEL
          (i32.store (global.get $SHARED_DLG_ENDED) (i32.const 1))
          (i32.store (global.get $SHARED_DLG_RESULT) (i32.const 2))
          (if (call $wnd_table_get (local.get $arg0))
            (then
              (call $wnd_destroy_children (local.get $arg0))
              (call $wnd_table_remove (local.get $arg0))))
          (call $host_destroy_window (local.get $arg0))
          (global.set $yield_flag (i32.const 1))
          (global.set $eax (i32.const 0))
          (global.set $esp (i32.add (global.get $esp) (i32.const 20)))
          (return)))
      (if (i32.eq (local.get $arg0) (global.get $main_hwnd))
        (then (global.set $quit_flag (i32.const 1))))
      (if (i32.eq (local.get $arg0) (global.get $focus_hwnd))
        (then (global.set $focus_hwnd (i32.const 0))))
      (call $wnd_destroy_recursive (local.get $arg0))
      (global.set $eax (i32.const 0))
      (global.set $esp (i32.add (global.get $esp) (i32.const 20))) (return)))
    ;; WM_ERASEBKGND (0x14): fill client area with background brush
    (if (i32.eq (local.get $arg1) (i32.const 0x0014))
    (then
    ;; Reaching here is the window saying that USER owns its background: it was
    ;; sent the erase and handed it straight back. NC_FLAGS bit 3 records that,
    ;; and $handle_BeginPaint uses it to decide whether to repaint the class
    ;; brush on later paints. A window that erases for itself never gets here,
    ;; and must not have its own background overwritten -- Hearts fills its
    ;; baize green and was registered with WHITE_BRUSH.
    (call $nc_flags_set (local.get $arg0) (i32.const 8))
    (global.set $eax (call $host_erase_background (local.get $arg0) (call $wnd_get_bg_brush (local.get $arg0))))
    (global.set $esp (i32.add (global.get $esp) (i32.const 20))) (return)))
    ;; WM_PAINT: default handling is an empty paint cycle that validates the
    ;; update region, identical to DefWindowProcA.
    (if (i32.eq (local.get $arg1) (i32.const 0x000F))
    (then
    (call $update_clear_hwnd (local.get $arg0))
    (call $paint_flag_clear_hwnd (local.get $arg0))
    (global.set $eax (i32.const 0))
    (global.set $esp (i32.add (global.get $esp) (i32.const 20))) (return)))
    (global.set $eax (i32.const 0))
    (global.set $esp (i32.add (global.get $esp) (i32.const 20))) (return)
  )

  ;; 290: LoadCursorW(hInstance, lpCursorName) — a cursor named by ordinal is
  ;; the only kind either spelling can load, and an ordinal has no encoding,
  ;; so this is exactly LoadCursorA.
  (func $handle_LoadCursorW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_LoadCursorA (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
  )

  ;; 291: LoadIconW(hInstance, lpIconName) → HICON. An icon named by ordinal —
  ;; MAKEINTRESOURCE, which is every icon we can actually decode — has no
  ;; encoding, so this is the A implementation verbatim: it used to hand back
  ;; the opaque no-pixels handle and the same icon drew in A and vanished in W.
  (func $handle_LoadIconW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_LoadIconA (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
  )

  ;; 293: MessageBoxW — narrow its UTF-16 strings into the one message-box
  ;; implementation shared with MessageBoxA/MessageBoxIndirectA.
  (func $handle_MessageBoxW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_MessageBox_core (local.get $arg0) (local.get $arg1)
      (local.get $arg2) (local.get $arg3) (i32.const 20) (i32.const 1)))

  ;; 294: SetWindowTextW(hwnd, lpString) → BOOL
  (func $handle_SetWindowTextW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $text_gp i32) (local $text_wa i32) (local $len i32)
    (if (i32.eqz (local.get $arg0))
      (then
        (global.set $eax (i32.const 0))
        (global.set $esp (i32.add (global.get $esp) (i32.const 12)))
        (return)))
    (if (i32.ge_u (local.get $arg1) (i32.const 0x10000))
      (then
        (local.set $text_gp (call $heap_alloc
          (i32.add (call $guest_wcslen (local.get $arg1)) (i32.const 1))))
        (if (local.get $text_gp)
          (then
            (local.set $len (call $wide_to_ansi
              (local.get $arg1)
              (local.get $text_gp)
              (i32.add (call $guest_wcslen (local.get $arg1)) (i32.const 1))))
            (local.set $text_wa (call $g2w (local.get $text_gp)))))))
    ;; Child controls treat SetWindowText as WM_SETTEXT on their own wndproc.
    ;; WAT-native controls store byte strings, so pass the converted buffer.
    (if (i32.and
          (i32.ne (call $ctrl_table_get_class (local.get $arg0)) (i32.const 0))
          (i32.or
            (i32.lt_u (call $ctrl_table_get_class (local.get $arg0)) (i32.const 10))
            (i32.gt_u (call $ctrl_table_get_class (local.get $arg0)) (i32.const 16))))
      (then
        (global.set $eax (call $control_wndproc_dispatch
          (local.get $arg0) (i32.const 0x000C) (i32.const 0) (local.get $text_gp)))
        (call $host_set_window_text (local.get $arg0) (local.get $text_wa))
        (if (local.get $text_gp) (then (call $heap_free (local.get $text_gp))))
        (global.set $esp (i32.add (global.get $esp) (i32.const 12)))
        (return)))
    ;; Native child windows such as RichEdit20A are not WAT control-table
    ;; controls, but SetWindowText still maps to WM_SETTEXT for them.
    (if (i32.and
          (i32.ne (call $wnd_get_parent (local.get $arg0)) (i32.const 0))
          (i32.ne (call $wnd_table_get (local.get $arg0)) (i32.const 0)))
      (then
        (call $richedit_format_reset_hwnd (local.get $arg0))
        (call $title_table_set (local.get $arg0) (local.get $text_wa) (local.get $len))
        (global.set $eax (call $wnd_send_message
          (local.get $arg0) (i32.const 0x000C) (i32.const 0) (local.get $text_gp)))
        (call $host_set_window_text (local.get $arg0) (local.get $text_wa))
        (if (local.get $text_gp) (then (call $heap_free (local.get $text_gp))))
        (global.set $esp (i32.add (global.get $esp) (i32.const 12)))
        (return)))
    (call $title_table_set (local.get $arg0) (local.get $text_wa) (local.get $len))
    (call $nc_flags_set (local.get $arg0) (i32.const 1))
    (call $defwndproc_do_ncpaint (local.get $arg0))
    (call $host_set_window_text (local.get $arg0) (local.get $text_wa))
    (if (local.get $text_gp) (then (call $heap_free (local.get $text_gp))))
    (global.set $eax (i32.const 1))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12))))

  ;; 295: GetWindowTextW(hwnd, lpString, nMaxCount) → int (chars copied)
  ;; The same read as GetWindowTextA, staged through an ANSI buffer of the
  ;; same character count and widened into the caller's. It used to answer
  ;; "" for every window, which is a wrong answer rather than a missing one.
  (func $handle_GetWindowTextW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $tmp i32) (local $len i32)
    (global.set $esp (i32.add (global.get $esp) (i32.const 16)))
    (if (i32.or (i32.eqz (local.get $arg1)) (i32.le_s (local.get $arg2) (i32.const 0)))
      (then (global.set $eax (i32.const 0)) (return)))
    (i32.store16 (call $g2w (local.get $arg1)) (i32.const 0))
    (local.set $tmp (call $heap_alloc (local.get $arg2)))
    (if (i32.eqz (local.get $tmp))
      (then (global.set $eax (i32.const 0)) (return)))
    (call $gs8 (local.get $tmp) (i32.const 0))
    (local.set $len (call $window_text_ansi
      (local.get $arg0) (local.get $tmp) (local.get $arg2)))
    (drop (call $ansi_to_wide (local.get $tmp) (local.get $arg1) (local.get $arg2)))
    (call $heap_free (local.get $tmp))
    (global.set $eax (local.get $len)))

  ;; 296: SendMessageW — routing and stack layout are identical to A. Message
  ;; payloads remain opaque here; individual WAT controls interpret the
  ;; message-specific buffers. Reuse the synchronous subclass/default-proc
  ;; path so Unicode applications can drive common controls (Media Player 32
  ;; uses TB_ADDBUTTONSW through an app-installed toolbar subclass).
  ;; True for the messages whose lParam is a caller-supplied string. The W
  ;; forms carry UTF-16 there; WAT-native controls store bytes, so the text has
  ;; to be narrowed before it reaches one.
  (func $msg_lparam_is_text (param $msg i32) (result i32)
    (i32.or
      (i32.or
        (i32.eq (local.get $msg) (i32.const 0x000C))   ;; WM_SETTEXT
        (i32.eq (local.get $msg) (i32.const 0x00C2)))  ;; EM_REPLACESEL
      (i32.or
        (i32.or
          (i32.or (i32.eq (local.get $msg) (i32.const 0x0143))    ;; CB_ADDSTRING
                  (i32.eq (local.get $msg) (i32.const 0x014A)))   ;; CB_INSERTSTRING
          (i32.or (i32.eq (local.get $msg) (i32.const 0x014C))    ;; CB_FINDSTRING
                  (i32.eq (local.get $msg) (i32.const 0x014D))))  ;; CB_SELECTSTRING
        (i32.or
          (i32.or (i32.eq (local.get $msg) (i32.const 0x0158))    ;; CB_FINDSTRINGEXACT
                  (i32.eq (local.get $msg) (i32.const 0x0180)))   ;; LB_ADDSTRING
          (i32.or
            (i32.or (i32.eq (local.get $msg) (i32.const 0x0181))  ;; LB_INSERTSTRING
                    (i32.eq (local.get $msg) (i32.const 0x018C))) ;; LB_SELECTSTRING
            (i32.or (i32.eq (local.get $msg) (i32.const 0x018F))  ;; LB_FINDSTRING
                    (i32.eq (local.get $msg) (i32.const 0x01A2)))))))) ;; LB_FINDSTRINGEXACT

  ;; Narrow a W message's string lParam for a WAT-native target, or return 0
  ;; when nothing needs converting. Only WAT-native controls are converted: a
  ;; guest window that was sent a W message wants its UTF-16 pointer intact,
  ;; and for those SendMessage may redirect EIP and read the string long after
  ;; this returns, so a temporary buffer would be freed out from under it.
  (func $msg_narrow_text_lparam (param $hwnd i32) (param $msg i32) (param $lParam i32)
        (result i32)
    (local $n i32) (local $buf i32)
    (if (i32.eqz (call $msg_lparam_is_text (local.get $msg))) (then (return (i32.const 0))))
    (if (i32.lt_u (local.get $lParam) (i32.const 0x10000)) (then (return (i32.const 0))))
    (if (i32.eqz (call $ctrl_table_get_class (local.get $hwnd))) (then (return (i32.const 0))))
    (local.set $n (i32.add (call $guest_wcslen (local.get $lParam)) (i32.const 1)))
    (local.set $buf (call $heap_alloc (local.get $n)))
    (if (i32.eqz (local.get $buf)) (then (return (i32.const 0))))
    (drop (call $wide_to_ansi (local.get $lParam) (local.get $buf) (local.get $n)))
    (local.get $buf))

  ;; SendMessageW — the A path owns dispatch. Only the text-bearing messages
  ;; differ, and only when the target is one of our own controls: XP Sound
  ;; Recorder fills its format combo with CB_ADDSTRING of LoadStringW text, and
  ;; reading that UTF-16 as bytes left every row showing just its first letter.
  (func $handle_SendMessageW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $narrow i32)
    (local.set $narrow
      (call $msg_narrow_text_lparam (local.get $arg0) (local.get $arg1) (local.get $arg3)))
    (call $handle_SendMessageA
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (select (local.get $narrow) (local.get $arg3) (local.get $narrow))
      (local.get $arg4) (local.get $name_ptr))
    (if (local.get $narrow) (then (call $heap_free (local.get $narrow))))
  )

  ;; 297: PostMessageW — same as PostMessageA
  ;; A posted message carries no text, so the wide spelling is the ANSI one.
  ;; It used to be a copy of an older PostMessageA and had drifted: no
  ;; cross-instance routing, and it wrote the queue inline instead of going
  ;; through $post_queue_push, so Unicode callers were invisible to the
  ;; message tracing and could not post to another instance's window.
  (func $handle_PostMessageW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_PostMessageA (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))

  ;; SendNotifyMessageW has no string payload of its own. Preserve the A
  ;; implementation's same-thread synchronous and cross-thread queued paths.
  (func $handle_SendNotifyMessageW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_SendNotifyMessageA
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))

  ;; 298: SetErrorMode — atomically replace the process-wide Win98 x86 mode.
  (func $handle_SetErrorMode (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (i32.atomic.rmw.xchg offset=12 (global.get $SHARED_COUNTERS) (i32.and (local.get $arg0) (i32.const 0x8003))))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8)))
  )

  ;; 299: GetCurrentThreadId — main thread is 1; worker threads get stable ids.
  (func $handle_GetCurrentThreadId (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (global.get $current_thread_id))
    (global.set $esp (i32.add (global.get $esp) (i32.const 4)))
  )

  ;; 300: LoadLibraryW — convert the module name and use the same lookup/load
  ;; path as LoadLibraryA. TEXT_SCRATCH is WAT-private, so expose its inverse
  ;; g2w address while the synchronous host loader consumes the name.
  (func $handle_LoadLibraryW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $ansi_gp i32)
    ;; Keep the optional theming-module contract identical to LoadLibraryA.
    ;; Decide optional-module availability before conversion and delegation so
    ;; mutable guest-side staging cannot alter the ANSI lookup contract. Use a
    ;; Boolean null check: i32.and is bitwise, and UTF-16 pointers are aligned.
    (if (i32.and (i32.ne (local.get $arg0) (i32.const 0))
          (call $wide_ascii_eq (call $g2w (local.get $arg0)) (i32.const 0x36D)))
      (then
        (global.set $eax (i32.const 0))
        (global.set $esp (i32.add (global.get $esp) (i32.const 8)))
        (return)))
    (local.set $ansi_gp
      (i32.add
        (i32.sub (global.get $TEXT_SCRATCH) (global.get $GUEST_BASE))
        (global.get $image_base)))
    (drop (call $wide_to_ansi
      (local.get $arg0) (local.get $ansi_gp) (global.get $TEXT_SCRATCH_SIZE)))
    (call $handle_LoadLibraryA
      (local.get $ansi_gp) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
  )

  (func $handle_LoadLibraryExW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_LoadLibraryEx_core
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (i32.const 1)))

  ;; 301: GetStartupInfoW — zero-fill the struct
  (func $handle_GetStartupInfoW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $zero_memory (call $g2w (local.get $arg0)) (i32.const 68))
    ;; Set cb = 68 (sizeof STARTUPINFOW)
    (call $gs32 (local.get $arg0) (i32.const 68))
    (global.set $eax (local.get $arg0))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8))) (return)
  )

  ;; 302: GetKeyState(nVirtKey) → SHORT — 1 arg stdcall
  (func $handle_GetKeyState (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; Return the current high-bit down state without consuming
    ;; GetAsyncKeyState's one-shot press latch. Toggle-key low bits are not
    ;; tracked yet.
    (global.set $eax
      (i32.and
        (call $host_get_key_down_state (local.get $arg0))
        (i32.const 0x8000)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8)))
  )

  (func $handle_keybd_event (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; keybd_event synthesizes system keyboard input. Feed the host FIFO used
    ;; by real browser keys rather than the posted-message queue: Get/PeekMessage
    ;; will then apply normal thread routing, hot-key matching and WH_KEYBOARD
    ;; callbacks. Prefer the focused child as the system-input target.
    (drop (call $host_queue_keyboard_input
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3)
      (select (global.get $focus_hwnd) (global.get $main_hwnd)
        (i32.ne (global.get $focus_hwnd) (i32.const 0)))))
    (global.set $eax (i32.const 0))
    (global.set $esp (i32.add (global.get $esp) (i32.const 20)))
  )

  ;; ToAsciiEx(uVirtKey, uScanCode, lpKeyState, lpChar, uFlags, hkl) → int.
  ;; 6-arg stdcall. Translate vkey + Shift state to up to one ASCII char in
  ;; *lpChar. Returns 1 on success, 0 if no translation, -1 for dead keys.
  ;; Minimal: handle letters/digits with Shift, and a handful of punctuation
  ;; that SDL apps rely on (Space, Enter, Esc, Tab).
  (func $handle_ToAsciiEx
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $vk i32) (local $ks i32) (local $out i32) (local $shift i32) (local $ch i32)
    (local.set $vk (local.get $arg0))
    (local.set $ks (call $g2w (local.get $arg2)))
    (local.set $out (call $g2w (local.get $arg3)))
    (local.set $shift (i32.and (i32.load8_u (i32.add (local.get $ks) (i32.const 0x10))) (i32.const 0x80)))
    (local.set $ch (i32.const 0))
    ;; A-Z (0x41-0x5A): lowercase unless Shift held
    (if (i32.and (i32.ge_u (local.get $vk) (i32.const 0x41)) (i32.le_u (local.get $vk) (i32.const 0x5A)))
      (then (local.set $ch
        (select (local.get $vk) (i32.add (local.get $vk) (i32.const 0x20)) (local.get $shift)))))
    ;; 0-9 (0x30-0x39): direct ASCII when no Shift; ignored with Shift here.
    (if (i32.eqz (local.get $ch))
      (then (if (i32.and (i32.ge_u (local.get $vk) (i32.const 0x30)) (i32.le_u (local.get $vk) (i32.const 0x39)))
        (then (if (i32.eqz (local.get $shift))
          (then (local.set $ch (local.get $vk))))))))
    ;; Space=0x20, Enter=0x0D, Esc=0x1B, Tab=0x09, Back=0x08
    (if (i32.eqz (local.get $ch))
      (then
        (if (i32.eq (local.get $vk) (i32.const 0x20)) (then (local.set $ch (i32.const 0x20))))
        (if (i32.eq (local.get $vk) (i32.const 0x0D)) (then (local.set $ch (i32.const 0x0D))))
        (if (i32.eq (local.get $vk) (i32.const 0x1B)) (then (local.set $ch (i32.const 0x1B))))
        (if (i32.eq (local.get $vk) (i32.const 0x09)) (then (local.set $ch (i32.const 0x09))))
        (if (i32.eq (local.get $vk) (i32.const 0x08)) (then (local.set $ch (i32.const 0x08))))))
    (if (local.get $ch)
      (then
        (i32.store16 (local.get $out) (local.get $ch))
        (global.set $eax (i32.const 1)))
      (else (global.set $eax (i32.const 0))))
    (global.set $esp (i32.add (global.get $esp) (i32.const 28)))
  )

  ;; ToAscii(uVirtKey, uScanCode, lpKeyState, lpChar, uFlags) → int.
  ;; The non-Ex entry point uses the same current keyboard layout and output
  ;; contract. Delegate to the tested translator, then correct its six-argument
  ;; stdcall pop to this API's five-argument frame.
  (func $handle_ToAscii
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_ToAsciiEx
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
    (global.set $esp (i32.sub (global.get $esp) (i32.const 4))))

  ;; ToUnicode(uVirtKey, uScanCode, lpKeyState, pwszBuff, cchBuff, wFlags).
  ;; The supported US-layout subset is identical to ToAsciiEx's and that
  ;; implementation already writes a UTF-16 code unit. The sixth argument has
  ;; different meaning (flags rather than HKL), but neither path consumes it.
  (func $handle_ToUnicode
    (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.or (i32.eqz (local.get $arg3)) (i32.le_s (local.get $arg4) (i32.const 0)))
      (then
        (global.set $eax (i32.const 0))
        (global.set $esp (i32.add (global.get $esp) (i32.const 28)))
        (return)))
    (call $handle_ToAsciiEx
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))

  ;; GetKeyboardState(LPBYTE lpKeyState[256]) → BOOL — 1 arg stdcall.
  ;; SDL polls this every frame to build its keyboard snapshot. Snapshot the
  ;; complete table in one host call: in a guest Worker, calling the scalar
  ;; get_key_down_state import 256 times parked and woke the Worker 256 times.
  ;; The host still uses the non-consuming physical/down-state view, preserving
  ;; GetAsyncKeyState's separate one-shot low press bit.
  (func $handle_GetKeyboardState (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax
      (call $host_get_keyboard_state (call $g2w (local.get $arg0))))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8)))
  )

  ;; 303: GetParent — STUB: unimplemented
  ;; GetParent(hwnd) — 1 arg stdcall, return parent hwnd or 0
  (func $handle_GetParent (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $wnd_get_parent_api (local.get $arg0)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8)))
  )

  ;; GetAncestor(hWnd, gaFlags). Unlike GetParent, GA_PARENT never substitutes
  ;; a top-level popup's owner. GA_ROOTOWNER first reaches the child root, then
  ;; follows each owner and that owner's child root.
  (func $handle_GetAncestor (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $walk i32) (local $next i32) (local $guard i32)
    (global.set $eax (i32.const 0))
    (if (i32.lt_s (call $wnd_table_find (local.get $arg0)) (i32.const 0))
      (then
        (global.set $esp (i32.add (global.get $esp) (i32.const 12)))
        (return)))
    ;; GA_PARENT = 1.
    (if (i32.eq (local.get $arg1) (i32.const 1))
      (then
        (global.set $eax (call $wnd_get_parent (local.get $arg0)))
        (global.set $esp (i32.add (global.get $esp) (i32.const 12)))
        (return)))
    (if (i32.or
          (i32.eq (local.get $arg1) (i32.const 2))  ;; GA_ROOT
          (i32.eq (local.get $arg1) (i32.const 3))) ;; GA_ROOTOWNER
      (then
        (local.set $walk (local.get $arg0))
        (block $parents_done (loop $parents
          (local.set $next (call $wnd_get_parent (local.get $walk)))
          (br_if $parents_done (i32.eqz (local.get $next)))
          (local.set $walk (local.get $next))
          (local.set $guard (i32.add (local.get $guard) (i32.const 1)))
          (br_if $parents_done (i32.ge_u (local.get $guard) (global.get $MAX_WINDOWS)))
          (br $parents)))
        ;; GA_ROOTOWNER = 3. An owner's root may itself be a child in a
        ;; malformed table, so apply the same bounded parent walk each time.
        (if (i32.eq (local.get $arg1) (i32.const 3))
          (then
            (block $owners_done (loop $owners
              (local.set $next (call $wnd_get_owner (local.get $walk)))
              (br_if $owners_done (i32.eqz (local.get $next)))
              (local.set $walk (local.get $next))
              (block $owner_parents_done (loop $owner_parents
                (local.set $next (call $wnd_get_parent (local.get $walk)))
                (br_if $owner_parents_done (i32.eqz (local.get $next)))
                (local.set $walk (local.get $next))
                (local.set $guard (i32.add (local.get $guard) (i32.const 1)))
                (br_if $owner_parents_done
                  (i32.ge_u (local.get $guard) (global.get $MAX_WINDOWS)))
                (br $owner_parents)))
              (local.set $guard (i32.add (local.get $guard) (i32.const 1)))
              (br_if $owners_done (i32.ge_u (local.get $guard) (global.get $MAX_WINDOWS)))
              (br $owners)))))
        (global.set $eax (local.get $walk))))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12)))
  )

  ;; 304: GetWindow(hWnd, uCmd) — 2 args stdcall.
  ;; Prefer WAT's per-instance window table, then fall back to the JS renderer's
  ;; full window list so cross-instance top-level/dialog relationships are still
  ;; visible to apps walking USER z-order.
  (func $handle_GetWindow (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $parent i32) (local $known i32)
    (local.set $known
      (i32.ne (call $wnd_table_find (local.get $arg0)) (i32.const -1)))
    ;; GW_HWNDFIRST(0) / GW_HWNDLAST(1): first/last sibling at same parent.
    (if (i32.eq (local.get $arg1) (i32.const 0))
      (then
        (local.set $parent (call $wnd_get_parent (local.get $arg0)))
        ;; The renderer owns the combined top-level z-order across app
        ;; instances. WAT remains authoritative for local child siblings.
        (global.set $eax
          (if (result i32) (i32.eqz (local.get $parent))
            (then (call $host_get_window_related (local.get $arg0) (local.get $arg1)))
            (else (call $wnd_find_first_child (local.get $parent)))))
        (global.set $esp (i32.add (global.get $esp) (i32.const 12)))
        (return)))
    (if (i32.eq (local.get $arg1) (i32.const 1))
      (then
        (local.set $parent (call $wnd_get_parent (local.get $arg0)))
        (global.set $eax
          (if (result i32) (i32.eqz (local.get $parent))
            (then (call $host_get_window_related (local.get $arg0) (local.get $arg1)))
            (else (call $wnd_find_last_child (local.get $parent)))))
        (global.set $esp (i32.add (global.get $esp) (i32.const 12)))
        (return)))
    ;; GW_HWNDNEXT = 2
    (if (i32.eq (local.get $arg1) (i32.const 2))
      (then
        (local.set $parent (call $wnd_get_parent (local.get $arg0)))
        (global.set $eax
          (if (result i32) (i32.eqz (local.get $parent))
            (then (call $host_get_window_related (local.get $arg0) (local.get $arg1)))
            (else (call $wnd_find_next_sibling (local.get $arg0)))))
        (global.set $esp (i32.add (global.get $esp) (i32.const 12)))
        (return)))
    ;; GW_HWNDPREV = 3
    (if (i32.eq (local.get $arg1) (i32.const 3))
      (then
        (local.set $parent (call $wnd_get_parent (local.get $arg0)))
        (global.set $eax
          (if (result i32) (i32.eqz (local.get $parent))
            (then (call $host_get_window_related (local.get $arg0) (local.get $arg1)))
            (else (call $wnd_find_prev_sibling (local.get $arg0)))))
        (global.set $esp (i32.add (global.get $esp) (i32.const 12)))
        (return)))
    ;; GW_OWNER = 4 → return owner hwnd, not child geometry parent.
    (if (i32.eq (local.get $arg1) (i32.const 4))
      (then
        (global.set $eax (call $wnd_get_owner (local.get $arg0)))
        (if (i32.and (i32.eqz (global.get $eax)) (i32.eqz (local.get $known)))
          (then (global.set $eax (call $host_get_window_related (local.get $arg0) (local.get $arg1)))))
        (global.set $esp (i32.add (global.get $esp) (i32.const 12)))
        (return)))
    ;; GW_CHILD = 5 → first child of hwnd
    (if (i32.eq (local.get $arg1) (i32.const 5))
      (then
        (global.set $eax (call $wnd_find_first_child (local.get $arg0)))
        (if (i32.and (i32.eqz (global.get $eax)) (i32.eqz (local.get $known)))
          (then (global.set $eax (call $host_get_window_related (local.get $arg0) (local.get $arg1)))))
        (global.set $esp (i32.add (global.get $esp) (i32.const 12)))
        (return)))
    ;; GW_ENABLEDPOPUP = 6 → enabled visible popup owned by hwnd, or hwnd itself.
    (if (i32.eq (local.get $arg1) (i32.const 6))
      (then
        (global.set $eax (call $host_get_window_related (local.get $arg0) (local.get $arg1)))
        (global.set $esp (i32.add (global.get $esp) (i32.const 12)))
        (return)))
    (global.set $eax (i32.const 0))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12)))  ;; stdcall, 2 args
  )

  ;; IsWindow(hwnd) → BOOL. Desktop has no WND_RECORDS slot, and windows owned
  ;; by another process exist only in the shared renderer window registry.
  ;; A value merely resembling the 0x10000+ handle range is not sufficient:
  ;; HWND_BROADCAST (-1) is unsigned-greater than 0x10000, and treating it as a
  ;; window leaves old InstallShield splash pumps waiting for it forever.
  (func $handle_IsWindow (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $window_handle_valid (local.get $arg0)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8))))

  ;; IsWindowUnicode(hwnd) reflects whether the HWND was created through a W
  ;; entry point. Native common controls use this to choose A/W message layouts.
  (func $handle_IsWindowUnicode (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $wnd_unicode_get (local.get $arg0)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8))))

  ;; Describe a system control class to an app that asked about it.
  ;;
  ;; Neither VCL nor MFC creates a BUTTON window directly. They call
  ;; GetClassInfo on the system class, keep its lpfnWndProc, register their own
  ;; class name (TButton, Afx:...) with their own wndproc, and chain whatever
  ;; they do not handle back to the proc they kept. Painting is one of the
  ;; things they do not handle. Returning FALSE here sends VCL down its
  ;; DefWindowProc fallback, and the control is then painted by nobody.
  ;;
  ;; The wndproc handed out is a marker carrying the class id, because by the
  ;; time it is called back the window's own class name is the app's, not
  ;; USER's — the marker is the only remaining link to what it started as.
  ;; $name_key is the class key ($class_name_key for A, $class_wide_name_key
  ;; for W): an atom, or the WASM address of the name. $name_guest is what the
  ;; caller passed, and is echoed back as lpszClassName.
  (func $system_class_describe (param $name_key i32) (param $name_guest i32)
        (param $out_guest i32) (param $hinstance i32) (result i32)
    (local $class i32) (local $out i32)
    ;; Both spellings resolve here. USER classes also accept atoms, while the
    ;; implemented common-control classes registered by InitCommonControls are
    ;; string-only; both expose the existing WAT wndproc markers.
    (local.set $class (call $builtin_ctrl_class_id_key (local.get $name_key)))
    (if (i32.and (i32.eqz (local.get $class)) (i32.ge_u (local.get $name_key) (i32.const 0x10000))) (then (local.set $class (call $comctl_class_ctrl_id (local.get $name_key)))))
    (if (i32.eqz (local.get $class)) (then (return (i32.const 0))))
    (local.set $out (call $g2w (local.get $out_guest)))
    ;; CS_VREDRAW|CS_HREDRAW|CS_DBLCLKS|CS_GLOBALCLASS, as USER registers these.
    ;; VCL masks the DC bits off and forces CS_PARENTDC regardless of what it is
    ;; told. CS_GLOBALCLASS is what makes them visible to every process, which
    ;; is precisely the property an app is confirming when it asks.
    (i32.store (local.get $out) (i32.const 0x400B))
    (i32.store offset=4 (local.get $out)
      (i32.or (global.get $WNDPROC_SYSCLASS) (local.get $class)))
    (i32.store offset=8 (local.get $out) (i32.const 0))   ;; cbClsExtra
    (i32.store offset=12 (local.get $out) (i32.const 0))  ;; cbWndExtra
    (i32.store offset=16 (local.get $out) (local.get $hinstance))
    (i32.store offset=20 (local.get $out) (i32.const 0))  ;; hIcon
    (i32.store offset=24 (local.get $out) (i32.const 0))  ;; hCursor
    (i32.store offset=28 (local.get $out) (i32.const 0))  ;; hbrBackground
    (i32.store offset=32 (local.get $out) (i32.const 0))  ;; lpszMenuName
    (i32.store offset=36 (local.get $out) (local.get $name_guest))
    (i32.const 1))

  (func $handle_GetClassInfoA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; GetClassInfoA(hInstance, lpClassName, lpWndClass) → BOOL
    ;; Look up class in our class table; if found, copy saved WNDCLASS to output
    (local $slot i32) (local $src i32)
    (local.set $slot (call $class_find_slot (call $g2w (local.get $arg1))))
    (if (i32.ge_s (local.get $slot) (i32.const 0))
      (then
        ;; Found — copy 40-byte WNDCLASS from class record to output buffer
        (local.set $src (call $class_wndclass_addr (local.get $slot)))
        (call $memcpy (call $g2w (local.get $arg2)) (local.get $src) (i32.const 40))
        (global.set $eax (i32.const 1))
        (global.set $esp (i32.add (global.get $esp) (i32.const 16)))
        (return)))
    ;; Not one of the app's own classes — it may be one of USER's.
    (if (call $system_class_describe
          (call $class_name_key (local.get $arg1))
          (local.get $arg1) (local.get $arg2) (local.get $arg0))
      (then
        (global.set $eax (i32.const 1))
        (global.set $esp (i32.add (global.get $esp) (i32.const 16)))
        (return)))
    ;; Not found — return FALSE
    (global.set $eax (i32.const 0))
    (global.set $esp (i32.add (global.get $esp) (i32.const 16)))
  )

  ;; 306: GetClassInfoW(hInstance, lpClassName, lpWndClass)
  (func $handle_GetClassInfoW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $slot i32) (local $src i32) (local $key i32)
    (local.set $key (call $class_wide_name_key (local.get $arg1)))
    (local.set $slot (call $class_find_slot (local.get $key)))
    (if (i32.ge_s (local.get $slot) (i32.const 0))
      (then
        (local.set $src (call $class_wndclass_addr (local.get $slot)))
        (call $memcpy (call $g2w (local.get $arg2)) (local.get $src) (i32.const 40))
        (global.set $eax (i32.const 1))
        (global.set $esp (i32.add (global.get $esp) (i32.const 16)))
        (return)))
    ;; USER's own classes answer the W entry point too. Before this, an app that
    ;; asked for L"BUTTON" was told no such class exists, which is the same
    ;; DefWindowProc fallback $system_class_describe was written to prevent --
    ;; it just could not be reached from here.
    (if (call $system_class_describe
          (local.get $key) (local.get $arg1) (local.get $arg2) (local.get $arg0))
      (then
        (global.set $eax (i32.const 1))
        (global.set $esp (i32.add (global.get $esp) (i32.const 16)))
        (return)))
    (global.set $eax (i32.const 0))
    (global.set $esp (i32.add (global.get $esp) (i32.const 16)))
  )

  ;; GetClassInfoExA/W expose the same saved class data with cbSize prepended
  ;; and hIconSm appended. $wide selects the class-name lookup spelling.
  (func $get_class_info_ex (param $hinstance i32) (param $name_guest i32)
                           (param $out_guest i32) (param $wide i32) (result i32)
    (local $key i32) (local $slot i32) (local $src i32) (local $out i32)
    (if (i32.or (i32.eqz (local.get $name_guest)) (i32.eqz (local.get $out_guest)))
      (then (return (i32.const 0))))
    (local.set $key
      (if (result i32) (local.get $wide)
        (then (call $class_wide_name_key (local.get $name_guest)))
        (else (call $class_name_key (local.get $name_guest)))))
    (local.set $slot (call $class_find_slot (local.get $key)))
    (local.set $out (call $g2w (local.get $out_guest)))
    (if (i32.ge_s (local.get $slot) (i32.const 0))
      (then
        (local.set $src (call $class_wndclass_addr (local.get $slot)))
        (call $memcpy (i32.add (local.get $out) (i32.const 4))
          (local.get $src) (i32.const 40)))
      (else
        (if (i32.eqz (call $system_class_describe
              (local.get $key) (local.get $name_guest)
              (i32.add (local.get $out_guest) (i32.const 4)) (local.get $hinstance)))
          (then (return (i32.const 0))))))
    (i32.store (local.get $out) (i32.const 48))
    ;; WNDCLASSEX.hIcon is at +24 after the four-byte cbSize prefix.
    (i32.store offset=44 (local.get $out) (i32.load offset=24 (local.get $out)))
    (i32.const 1))

  (func $handle_GetClassInfoExA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $get_class_info_ex
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (i32.const 0)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 16))))

  (func $handle_GetClassInfoExW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $get_class_info_ex
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (i32.const 1)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 16))))

  ;; 307: SetWindowLongW — STUB: unimplemented, return 0 (previous value)
  ;; SetWindowLongW — same as A for non-string indices
  (func $handle_SetWindowLongW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_SetWindowLongA (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
  )

  ;; 308: GetWindowLongW — STUB: unimplemented, return 0
  ;; GetWindowLongW — same as A for non-string indices
  (func $handle_GetWindowLongW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_GetWindowLongA (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
  )

  (func $handle_PathRemoveFileSpecW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $path_remove_file_spec (local.get $arg0) (i32.const 1)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8)))
  )

  ;; Set/GetClassLongW — same scalar indices as A; class string fields are not
  ;; modeled by the current lightweight class table.
  (func $handle_SetClassLongW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_SetClassLongA
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
  )

  (func $handle_GetClassLongW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_GetClassLongA
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
  )

  ;; 309: InitCommonControlsEx — return 1 (success) — STUB: unimplemented
  (func $handle_InitCommonControlsEx (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; InitCommonControlsEx(lpInitCtrls) → BOOL. 1 arg stdcall. Return TRUE
    (global.set $eax (i32.const 1))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8)))
  )

  ;; OleInitialize lives with the other COM/OLE apartment handlers in
  ;; 09a7b-ole.wat. The old fixed-S_OK duplicate here was dead after WATX name
  ;; resolution and made the silent-stub inventory count one API twice.
  ;; Keeping one definition also makes the handler table's name resolve to one
  ;; implementation instead of depending on source-order shadowing.

  ;; 311: CoTaskMemFree(pv) — 1 arg stdcall, free via heap_free
  (func $handle_CoTaskMemFree (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (local.get $arg0)
      (then (call $heap_free (local.get $arg0))))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8)))
  )

nW — STUB: unimplemented
  (func $handle_lstrlenW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $lstr_len (local.get $arg0) (i32.const 1)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8)))
  )

  ;; 321: lstrcpyW
  (func $handle_lstrcpyW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $lstr_cpy (local.get $arg0) (local.get $arg1) (i32.const 1))
    (global.set $eax (local.get $arg0))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12))) (return)
  )

  ;; 322: lstrcmpW(lpString1, lpString2) → int
  (func $handle_lstrcmpW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $lstr_cmp (local.get $arg0) (local.get $arg1) (i32.const 1) (i32.const 0)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12))))

  ;; 323: lstrcmpiW(lpString1, lpString2) → int, ASCII case-insensitive
  (func $handle_lstrcmpiW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $lstr_cmp (local.get $arg0) (local.get $arg1) (i32.const 1) (i32.const 1)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12)))
  )

  ;; 324: CharNextW — advance by one wide char
  (func $handle_CharNextW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $char_next (local.get $arg0) (i32.const 1)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8))) (return)
  )

  ;; CharPrevW(lpszStart, lpszCurrent) — step back one UTF-16 code unit.
  (func $handle_CharPrevW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $char_prev (local.get $arg0) (local.get $arg1) (i32.const 1)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12))) (return)
  )

  ;; 325: wsprintfW — wide sprintf (cdecl, caller cleans up)
  ;; wsprintfW(buf, fmt, ...) — cdecl; varargs at guest esp+12 (after ret + buf + fmt)
  (func $handle_wsprintfW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; wsprintf_impl_w treats out/fmt/arg_ptr all as guest addresses (uses gl16/gl32 internally)
    (global.set $eax (call $wsprintf_impl_w
      (local.get $arg0)
      (local.get $arg1)
      (i32.add (global.get $esp) (i32.const 12))))
    ;; cdecl: only pop return address
    (global.set $esp (i32.add (global.get $esp) (i32.const 4))))

  ;; 326: TlsAlloc — return next TLS index
  (func $handle_TlsAlloc (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $index i32)
    (local.set $index (call $tls_reserve))
    (if (i32.eq (local.get $index) (i32.const -1))
      (then
        (global.set $eax (i32.const -1)) ;; TLS_OUT_OF_INDEXES
        (global.set $esp (i32.add (global.get $esp) (i32.const 4)))
        (return)))
    (if (i32.eqz (global.get $tls_slots))
      (then
        (global.set $tls_slots (call $heap_alloc (i32.const 256)))
        (call $zero_memory (call $g2w (global.get $tls_slots)) (i32.const 256))))
    (global.set $eax (local.get $index))
    (global.set $esp (i32.add (global.get $esp) (i32.const 4))) (return)
  )

  ;; 327: TlsGetValue(index)
  (func $handle_TlsGetValue (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.ge_u (local.get $arg0) (i32.const 64))
      (then
        (global.set $last_error (i32.const 87)) ;; ERROR_INVALID_PARAMETER
        (global.set $eax (i32.const 0))
        (global.set $esp (i32.add (global.get $esp) (i32.const 8)))
        (return)))
    (if (i32.eqz (global.get $tls_slots))
      (then
        (global.set $last_error (i32.const 0))
        (global.set $eax (i32.const 0))
        (global.set $esp (i32.add (global.get $esp) (i32.const 8)))
        (return)))
    (global.set $eax (call $gl32 (i32.add (global.get $tls_slots) (i32.shl (local.get $arg0) (i32.const 2)))))
    (global.set $last_error (i32.const 0))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8))) (return)
  )

  ;; 328: TlsSetValue(index, value)
  (func $handle_TlsSetValue (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.ge_u (local.get $arg0) (i32.const 64))
      (then
        (global.set $last_error (i32.const 87)) ;; ERROR_INVALID_PARAMETER
        (global.set $eax (i32.const 0))
        (global.set $esp (i32.add (global.get $esp) (i32.const 12)))
        (return)))
    (if (i32.eqz (global.get $tls_slots))
      (then
        (global.set $tls_slots (call $heap_alloc (i32.const 256)))
        (call $zero_memory (call $g2w (global.get $tls_slots)) (i32.const 256))))
    (call $gs32 (i32.add (global.get $tls_slots) (i32.shl (local.get $arg0) (i32.const 2))) (local.get $arg1))
    (global.set $last_error (i32.const 0))
    (global.set $eax (i32.const 1))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12))) (return)
  )

  ;; 329: TlsFree(index) — return TRUE
  (func $handle_TlsFree (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.ge_u (local.get $arg0) (i32.const 64))
      (then
        (global.set $last_error (i32.const 87)) ;; ERROR_INVALID_PARAMETER
        (global.set $eax (i32.const 0))
        (global.set $esp (i32.add (global.get $esp) (i32.const 8)))
        (return)))
    (global.set $last_error (i32.const 0))
    (global.set $eax (i32.const 1))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8)))
  )

  ;; CRITICAL_SECTION: +0=DebugInfo, +4=LockCount, +8=RecursionCount,
  ;; +0C=OwningThread, +10=LockSemaphore, +14=SpinCount.
  (func $critical_section_init (param $arg0 i32) (param $spin i32)
    (local $cs i32)
    (local.set $cs (call $g2w (local.get $arg0)))
    ;; Zero the struct then set LockCount = -1 (unlocked)
    (i32.store (local.get $cs) (i32.const 0))            ;; DebugInfo
    (i32.store offset=4 (local.get $cs) (i32.const -1))  ;; LockCount = -1 (unlocked)
    (i32.store offset=8 (local.get $cs) (i32.const 0))   ;; RecursionCount
    (i32.store offset=12 (local.get $cs) (i32.const 0))  ;; OwningThread
    (i32.store offset=16 (local.get $cs) (i32.const 0))  ;; LockSemaphore
    (i32.store offset=20 (local.get $cs) (local.get $spin)) ;; SpinCount
    ;; The only place a section is legitimately born, so the only place worth
    ;; recording it. See $cs_release_owned.
    (call $cs_register (local.get $cs)))

  ;; 330: InitializeCriticalSection(lpCriticalSection)
  (func $handle_InitializeCriticalSection (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $critical_section_init (local.get $arg0) (i32.const 0))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8)))
  )

  ;; InitializeCriticalSectionAndSpinCount(lpCriticalSection, dwSpinCount).
  ;; Uniprocessor Windows may ignore the requested spin count, but retaining it
  ;; is observable through the public structure and costs nothing here.
  (func $handle_InitializeCriticalSectionAndSpinCount (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $critical_section_init (local.get $arg0) (local.get $arg1))
    (global.set $eax (i32.const 1))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12)))
  )

  ;; ---- the section registry -------------------------------------------------
  ;;
  ;; A section held by a thread that has ended is not held, it is LOST, and every
  ;; waiter then parks forever. Windows has the same hazard and no answer for it;
  ;; we do have one, because we know exactly when a guest thread ends — including
  ;; when it ends by trapping, which no guest can clean up after.
  ;;
  ;; This replaces taking a section by force after a timeout. That guessed from
  ;; elapsed rounds and rewrote the counters under a live owner, which corrupted
  ;; the very data the section protected. Releasing at exit fires when the owner
  ;; is *known* to be gone.

  ;; Slot address for index i.
  (func $cs_slot (param $i i32) (result i32)
    (i32.add (global.get $CS_TABLE) (i32.mul (local.get $i) (i32.const 4))))

  ;; Remember this section (WASM address). Idempotent, and safe against two
  ;; threads initialising sections at the same time — the slot is claimed with a
  ;; CAS rather than a load-then-store.
  (func $cs_register (param $cs i32)
    (local $i i32) (local $slot i32) (local $cur i32)
    (block $done
      (loop $scan
        (br_if $done (i32.ge_u (local.get $i) (global.get $CS_TABLE_ENTRIES)))
        (local.set $slot (call $cs_slot (local.get $i)))
        (local.set $cur (i32.atomic.load (local.get $slot)))
        (br_if $done (i32.eq (local.get $cur) (local.get $cs)))   ;; already known
        (if (i32.eqz (local.get $cur))
          (then
            ;; Won the slot? Done. Lost it to another thread? Keep scanning.
            (br_if $done (i32.eqz (i32.atomic.rmw.cmpxchg
              (local.get $slot) (i32.const 0) (local.get $cs))))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $scan))))

  (func $cs_unregister (param $cs i32)
    (local $i i32) (local $slot i32)
    (block $done
      (loop $scan
        (br_if $done (i32.ge_u (local.get $i) (global.get $CS_TABLE_ENTRIES)))
        (local.set $slot (call $cs_slot (local.get $i)))
        (if (i32.eq (i32.atomic.load (local.get $slot)) (local.get $cs))
          (then
            (i32.atomic.store (local.get $slot) (i32.const 0))
            (br $done)))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $scan))))

  ;; Release every registered section owned by $owner ($current_thread_id of the
  ;; thread that has ended — main is 1, a spawned thread is tid+1). Returns how
  ;; many were released, which is never routine: a nonzero answer means a thread
  ;; ended inside a section, and callers report it.
  (func $cs_release_owned (param $owner i32) (result i32)
    (local $i i32) (local $cs i32) (local $n i32)
    (block $done
      (loop $scan
        (br_if $done (i32.ge_u (local.get $i) (global.get $CS_TABLE_ENTRIES)))
        (local.set $cs (i32.atomic.load (call $cs_slot (local.get $i))))
        (if (local.get $cs)
          (then
            (if (i32.eq (i32.load offset=12 (local.get $cs)) (local.get $owner))
              (then
                ;; Counters first, owner last — the same publish-last order the
                ;; WAT's own locks use, so a thread that sees it free sees the
                ;; counters already settled.
                (i32.store offset=8 (local.get $cs) (i32.const 0))
                (i32.store offset=4 (local.get $cs) (i32.const -1))
                (if (call $cs_owner_aligned (local.get $cs))
                  (then (i32.atomic.store offset=12 (local.get $cs) (i32.const 0)))
                  (else (i32.store offset=12 (local.get $cs) (i32.const 0))))
                (local.set $n (i32.add (local.get $n) (i32.const 1)))))))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $scan)))
    (local.get $n))

  ;; Park an EnterCriticalSection that cannot be satisfied yet (reason 9).
  ;;
  ;; It CANNOT spin. The holder is another guest thread that will release the
  ;; section when it next runs, and on the browser's main thread — or the CLI's,
  ;; which both runs guest code and serves the workers' host imports — spinning
  ;; is the deadlock: the holder is parked in Atomics.wait for an import this
  ;; thread would have served. So the whole API call parks the same way a
  ;; blocking socket call does: EIP is still on the thunk, and clearing the yield
  ;; re-enters this handler with the same argument once someone else has had a
  ;; turn.
  ;;
  ;; ESP is deliberately NOT touched: this is called before the handler pops its
  ;; stdcall frame, so the return address and the argument are already where a
  ;; re-entry needs them. (The winsock equivalent subtracts, because those
  ;; handlers pop on entry and have to put it back — the invariant is the same,
  ;; the arithmetic is not. Subtracting here dropped ESP by 8 per park and
  ;; WordPad's thread trapped after three of them.)
  (func $cs_block (param $cs i32) (param $owner i32)
    (global.set $cs_waits (i32.add (global.get $cs_waits) (i32.const 1)))
    ;; The frame is deliberately left on the stack for the re-entry to find, so
    ;; record where it is. If the guest is dispatched anywhere else before it
    ;; comes back, those bytes are lost — see $cs_park_pending.
    (global.set $cs_park_pending (i32.const 1))
    (global.set $cs_park_esp (global.get $esp))
    (global.set $cs_park_eip (global.get $eip))
    ;; What this thread is parked on, and who had it. "Thread blocked" is not a
    ;; diagnosis; "thread blocked on section X held by thread N" is, and it is the
    ;; difference between guessing at a deadlock and reading it.
    (global.set $cs_wait_addr (local.get $cs))
    (global.set $cs_wait_owner (local.get $owner))
    ;; Opt out of $run's thunk-zone auto-pop. It fires whenever a handler leaves
    ;; EIP alone, yield or no yield, and sets EIP = [ESP] — which splices the call
    ;; out entirely: the guest resumes after it without the section, with the
    ;; argument still on the stack. Four bytes leak per park, and the thread dies
    ;; later at a garbage EIP (0x113, in the browser). Every other re-entering
    ;; thunk raises this for the same reason; see the CACA000x continuations.
    (global.set $handler_set_eip (i32.const 1))
    ;; Re-enter the CALL, not the block. Most API calls are dispatched inline
    ;; from inside a decoded block, where EIP still names that block's first
    ;; instruction — so leaving EIP alone makes the resume re-execute the
    ;; argument pushes and call the API again on top of the frame it already
    ;; left on the stack. Measured on Winamp: ESP 8 bytes lower on the retry,
    ;; and thread 1 later returning into .data at winamp.exe+0x4fe9c.
    (global.set $eip (global.get $current_thunk_eip))
    (global.set $yield_reason (i32.const 9))
    (global.set $yield_flag (i32.const 1))
    (global.set $steps (i32.const 0)))

  ;; 331: EnterCriticalSection(lpCriticalSection)
  ;;
  ;; Real mutual exclusion, because there are real threads now. The old version
  ;; bumped the counters and wrote OwningThread = 1 unconditionally, which is
  ;; survivable when exactly one instance runs at a time and is not a defensible
  ;; basis for anything else: two threads inside one section corrupt whatever it
  ;; was protecting, and the symptom shows up far away as bad data.
  ;;
  ;; OwningThread is the lock word, claimed with a CAS. It holds
  ;; $current_thread_id, which is exactly what GetCurrentThreadId returns —
  ;; guest CRT and MFC lock code reads this field and compares it against that,
  ;; so it has to be the same number and not a private one. 0 means free, and no
  ;; thread id is ever 0 (main is 1, a spawned thread is tid+1).
  (func $handle_EnterCriticalSection (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $cs i32) (local $me i32) (local $prev i32) (local $spin i32)
    (local $owner i32) (local $round i32)
    (local.set $cs (call $g2w (local.get $arg0)))
    (local.set $me (global.get $current_thread_id))
    ;; Contended from inside a synchronous wndproc: parking is not available.
    ;; $wnd_send_message runs the procedure on a recursive interpreter frame,
    ;; and a yield there returns to that loop, not to the host -- so the owning
    ;; thread never gets a turn, the loop burns its round budget in an instant
    ;; and silently abandons the wndproc. That is what left Diablo's main menu
    ;; without its flaming logo: the PCX loader in its WM_INITDIALOG takes a
    ;; Storm section, and the tail of the handler (which posts the message that
    ;; starts the flame animation) never ran. Give the owner a bounded inline
    ;; turn instead, exactly as waitSingleCooperative does for events. With the
    ;; worker backend the pump is a no-op and the CAS spin below carries it.
    (local.set $owner (i32.load offset=12 (local.get $cs)))
    (if (i32.and (i32.ne (local.get $owner) (i32.const 0))
                 (i32.and (i32.ne (local.get $owner) (local.get $me))
                          (i32.ne (global.get $sync_msg_depth) (i32.const 0))))
      (then
        (block $pumped (loop $pump_round
          (br_if $pumped (i32.eqz (call $host_cs_pump)))
          (local.set $owner (i32.load offset=12 (local.get $cs)))
          (br_if $pumped (i32.eqz (local.get $owner)))
          (br_if $pumped (i32.eq (local.get $owner) (local.get $me)))
          (local.set $round (i32.add (local.get $round) (i32.const 1)))
          (br_if $pumped (i32.ge_u (local.get $round) (i32.const 16)))
          (br $pump_round)))))
    (if (call $cs_owner_aligned (local.get $cs))
      (then
        ;; Spin briefly before considering a park. The holder is a guest thread
        ;; on another OS thread and is running RIGHT NOW, so most contention
        ;; clears in microseconds — which is exactly what CRITICAL_SECTION's
        ;; SpinCount is for on a multiprocessor. Parking instead costs a whole
        ;; scheduler round per attempt, and that is not a small constant:
        ;; measured on Winamp in worker mode, each of its three threads parked
        ;; ~2000 times and the decoded audio barely started before the run ended.
        ;;
        ;; The spin is BOUNDED and always ends — in a park for a spawned thread,
        ;; or in taking the section for the guest's main thread (see below) — so
        ;; unlike the WAT's own locks it cannot deadlock the thread that serves
        ;; the holder's host imports. A few thousand atomic ops is tens of
        ;; microseconds; a wait would be unbounded, and that is the difference.
        (local.set $spin (i32.const 0))
        (block $done
          (loop $again
            (local.set $prev (i32.atomic.rmw.cmpxchg offset=12
              (local.get $cs) (i32.const 0) (local.get $me)))
            (br_if $done (i32.eqz (local.get $prev)))
            (br_if $done (i32.eq (local.get $prev) (local.get $me)))
            (local.set $spin (i32.add (local.get $spin) (i32.const 1)))
            (br_if $again (i32.lt_u (local.get $spin) (i32.const 2000))))))
      (else
        ;; A misaligned CRITICAL_SECTION would TRAP the atomic — WASM requires
        ;; natural alignment where `lock cmpxchg` does not. Compilers align the
        ;; struct, so this is the rare path, and being no better than the old
        ;; racy version there beats killing the app.
        (local.set $prev (i32.load offset=12 (local.get $cs)))
        (if (i32.eqz (local.get $prev))
          (then (i32.store offset=12 (local.get $cs) (local.get $me))))))
    ;; Held by somebody else: park and retry. Both operands are 0/1 predicates.
    (if (i32.and (i32.ne (local.get $prev) (i32.const 0))
                 (i32.ne (local.get $prev) (local.get $me)))
      (then
        (global.set $cs_wait_spins (i32.add (global.get $cs_wait_spins) (i32.const 1)))
        ;; Never barge and never steal. Owner-thread callback dispatch now parks
        ;; and resumes nested sends explicitly, so there is no longer a callback
        ;; running on the wrong instance that needs this semantic escape hatch.
        (call $cs_block (local.get $cs) (local.get $prev))
        (return)))
    (global.set $cs_wait_spins (i32.const 0))
    ;; Came back to a park: the frame must be exactly where it was left, or the
    ;; caller's `ret` will pop something that is not its return address.
    (if (global.get $cs_park_pending)
      (then
        (if (i32.ne (global.get $esp) (global.get $cs_park_esp))
          (then (global.set $cs_resume_esp_delta
            (i32.sub (global.get $esp) (global.get $cs_park_esp)))))
        (global.set $cs_park_pending (i32.const 0))))
    ;; Not parked any more. Left set, this reads as "still waiting" long after the
    ;; section was acquired, and a stale name in a deadlock report is worse than
    ;; no name — it accuses a thread that let go.
    (global.set $cs_wait_addr (i32.const 0))
    (global.set $cs_wait_owner (i32.const 0))
    ;; Ours now, or already ours — recursive entry is allowed and only counted.
    ;; LockCount: -1 -> 0 on the first acquire, then up with each recursion.
    (i32.store offset=4 (local.get $cs)
      (i32.add (i32.load offset=4 (local.get $cs)) (i32.const 1)))
    (i32.store offset=8 (local.get $cs)
      (i32.add (i32.load offset=8 (local.get $cs)) (i32.const 1)))
    ;; A contended attempt sets this flag so $run preserves the import frame.
    ;; Once the retry acquires the section it is an ordinary completed API call.
    (global.set $handler_set_eip (i32.const 0))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8)))
  )

  ;; TryEnterCriticalSection(lpCriticalSection) -> BOOL. Use the same owner
  ;; word and recursive counters as EnterCriticalSection, but contention is an
  ;; immediate FALSE and never parks the calling guest thread.
  (func $handle_TryEnterCriticalSection (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $cs i32) (local $me i32) (local $prev i32)
    (local.set $cs (call $g2w (local.get $arg0)))
    (local.set $me (global.get $current_thread_id))
    (if (call $cs_owner_aligned (local.get $cs))
      (then
        (local.set $prev (i32.atomic.rmw.cmpxchg offset=12
          (local.get $cs) (i32.const 0) (local.get $me))))
      (else
        (local.set $prev (i32.load offset=12 (local.get $cs)))
        (if (i32.eqz (local.get $prev))
          (then (i32.store offset=12 (local.get $cs) (local.get $me))))))
    (if (i32.or (i32.eqz (local.get $prev))
                (i32.eq (local.get $prev) (local.get $me)))
      (then
        (i32.store offset=4 (local.get $cs)
          (i32.add (i32.load offset=4 (local.get $cs)) (i32.const 1)))
        (i32.store offset=8 (local.get $cs)
          (i32.add (i32.load offset=8 (local.get $cs)) (i32.const 1)))
        (global.set $eax (i32.const 1)))
      (else (global.set $eax (i32.const 0))))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8))))

  ;; Is this section's OwningThread word 4-byte aligned, i.e. can it be the
  ;; target of an atomic? Its address is guest-derived and GUEST_BASE is aligned,
  ;; so this follows the guest's own alignment.
  (func $cs_owner_aligned (param $cs i32) (result i32)
    (i32.eqz (i32.and (i32.add (local.get $cs) (i32.const 12)) (i32.const 3))))

  ;; 332: LeaveCriticalSection(lpCriticalSection)
  (func $handle_LeaveCriticalSection (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $cs i32) (local $rec i32)
    (local.set $cs (call $g2w (local.get $arg0)))
    ;; A non-owner Leave is invalid and must not mutate the section. The former
    ;; compatibility path released somebody else's lock because callbacks could
    ;; execute on the wrong instance; owner-thread SendMessage removes that cause.
    (if (i32.ne (i32.load offset=12 (local.get $cs)) (global.get $current_thread_id))
      (then
        (global.set $cs_bad_leaves (i32.add (global.get $cs_bad_leaves) (i32.const 1)))
        (global.set $cs_bad_leave_addr (local.get $cs))
        (global.set $cs_bad_leave_owner (i32.load offset=12 (local.get $cs)))
        (global.set $esp (i32.add (global.get $esp) (i32.const 8)))
        (return)))
    ;; RecursionCount-- / LockCount--
    (local.set $rec (i32.sub (i32.load offset=8 (local.get $cs)) (i32.const 1)))
    (i32.store offset=8 (local.get $cs) (local.get $rec))
    (i32.store offset=4 (local.get $cs)
      (i32.sub (i32.load offset=4 (local.get $cs)) (i32.const 1)))
    ;; Release LAST, and atomically: the counters have to be settled before
    ;; another thread can see the section free and start writing them, which is
    ;; the same publish-last ordering the WAT's own locks use.
    (if (i32.le_s (local.get $rec) (i32.const 0))
      (then
        (i32.store offset=8 (local.get $cs) (i32.const 0))
        (i32.store offset=4 (local.get $cs) (i32.const -1))
        (if (call $cs_owner_aligned (local.get $cs))
          (then (i32.atomic.store offset=12 (local.get $cs) (i32.const 0)))
          (else (i32.store offset=12 (local.get $cs) (i32.const 0))))))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8)))
  )

  ;; 333: DeleteCriticalSection(lpCriticalSection)
  (func $handle_DeleteCriticalSection (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $cs i32)
    (local.set $cs (call $g2w (local.get $arg0)))
    (i32.store (local.get $cs) (i32.const 0))
    (i32.store offset=4 (local.get $cs) (i32.const -1))
    (i32.store offset=8 (local.get $cs) (i32.const 0))
    (i32.store offset=12 (local.get $cs) (i32.const 0))
    (i32.store offset=16 (local.get $cs) (i32.const 0))
    (i32.store offset=20 (local.get $cs) (i32.const 0))
    ;; Freed memory can be reallocated as something else, and a stale entry would
    ;; have a later thread's exit writing zeroes into whatever now lives there.
    (call $cs_unregister (local.get $cs))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8)))
  )

  ;; 334: GetCurrentThread — 0 args, return pseudo-handle 0xFFFFFFFE (-2)
  (func $handle_GetCurrentThread (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (i32.const 0xFFFFFFFE))
    (global.set $esp (i32.add (global.get $esp) (i32.const 4)))
  )

  ;; 335: GetProcessHeap — stable process heap handle accepted by Heap* APIs.
  (func $handle_GetProcessHeap (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (global.get $PROCESS_HEAP_HANDLE))
    (global.set $esp (i32.add (global.get $esp) (i32.const 4)))  ;; stdcall, 0 args
  )

  ;; 336: SetStdHandle(nStdHandle, hHandle) — replace the corresponding raw
  ;; value in the process standard-handle table. Windows deliberately does not
  ;; validate hHandle here; the later read/write operation validates it.
  (func $handle_SetStdHandle (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax
      (call $console_std_handle_set (local.get $arg0) (local.get $arg1)))
    (if (i32.eqz (global.get $eax))
      (then (global.set $last_error (i32.const 6)))) ;; ERROR_INVALID_HANDLE
    (global.set $esp (i32.add (global.get $esp) (i32.const 12)))
  )

  ;; FreeConsole() — detach console handles/window/state. Windows reports
  ;; success even when the process was already detached.
  (func $handle_FreeConsole (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $console_detach)
    (global.set $eax (i32.const 1))
    (global.set $esp (i32.add (global.get $esp) (i32.const 4)))
  )

  ;; 337: FlushFileBuffers — VFS writes are synchronous; validate the writable handle.
  (func $handle_FlushFileBuffers (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $error i32)
    (local.set $error (call $host_fs_flush_file_buffers (local.get $arg0)))
    (if (local.get $error) (then (global.set $last_error (local.get $error))))
    (global.set $eax (i32.eqz (local.get $error))) (global.set $esp (i32.add (global.get $esp) (i32.const 8))))

  ;; 338: IsValidCodePage(CodePage)
  (func $handle_IsValidCodePage (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $is_supported_code_page (local.get $arg0)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8)))  ;; stdcall, 1 arg
  )

  ;; 339: GetEnvironmentStringsA — an ANSI copy of the process environment.
  ;; It used to return the command line, which is a different string entirely
  ;; and has no double NUL, so a CRT walking it read past the end.
  (func $handle_GetEnvironmentStringsA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $env_strings (i32.const 0)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 4))) (return)
  )

  ;; 340: InterlockedIncrement(ptr)
  (func $handle_InterlockedIncrement (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $tmp i32)
    (local.set $tmp (i32.add (call $gl32 (local.get $arg0)) (i32.const 1)))
    (call $gs32 (local.get $arg0) (local.get $tmp))
    (global.set $eax (local.get $tmp))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8))) (return)
  )

  ;; 341: InterlockedDecrement(ptr)
  (func $handle_InterlockedDecrement (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $tmp i32)
    (local.set $tmp (i32.sub (call $gl32 (local.get $arg0)) (i32.const 1)))
    (call $gs32 (local.get $arg0) (local.get $tmp))
    (global.set $eax (local.get $tmp))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8))) (return)
  )

  ;; 342: InterlockedExchange(ptr, value)
  (func $handle_InterlockedExchange (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $gl32 (local.get $arg0)))
    (call $gs32 (local.get $arg0) (local.get $arg1))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12))) (return)
  )

  ;; InterlockedCompareExchange(ptr, newVal, comparand) → original
  ;; Atomic (single-threaded emu, so just sequential): if *ptr == comparand, *ptr = newVal.
  (func $handle_InterlockedCompareExchange (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $orig i32)
    (local.set $orig (call $gl32 (local.get $arg0)))
    (global.set $eax (local.get $orig))
    (if (i32.eq (local.get $orig) (local.get $arg2))
      (then (call $gs32 (local.get $arg0) (local.get $arg1))))
    (global.set $esp (i32.add (global.get $esp) (i32.const 16)))
  )

;; Does [ptr, ptr+len) lack the requested access? $g2w answers whether every
  ;; crossed page is backed. Sparse VirtualAlloc pages additionally retain the
  ;; caller's exact PAGE_* value in their packed PTE, so these cold probe APIs
  ;; can honor NOACCESS, GUARD and read/write distinctions without adding a
  ;; permission branch to the emulator's hot load/store path. Direct image,
  ;; heap and DIB pages remain permissive until they gain equivalent metadata.
  ;;
  ;; The previous test was a flat "above 0x02000000 is bad", which stopped being
  ;; true long ago: the sparse heap and VirtualAlloc arena live up near
  ;; 0x3F800000, and an app's own stack sits well above the cutoff too (the
  ;; Direct3D viewer runs on one at 0x074FFxxx). A caller handing us a stack
  ;; buffer — the ordinary way to use this API — was told its own frame was
  ;; unreadable.
  (func $ptr_range_access_bad
      (param $ptr i32) (param $len i32) (param $write i32) (result i32)
    (local $last i32) (local $cur i32) (local $pte i32) (local $protect i32)
    ;; A zero-length range is accessible even when ptr is NULL.
    (if (i32.eqz (local.get $len)) (then (return (i32.const 0))))
    (if (i32.eqz (local.get $ptr)) (then (return (i32.const 1))))
    (local.set $last (i32.add (local.get $ptr) (i32.sub (local.get $len) (i32.const 1))))
    (if (i32.lt_u (local.get $last) (local.get $ptr)) (then (return (i32.const 1))))
    (local.set $cur (local.get $ptr))
    (block $done (loop $pages
      (if (i32.eq (call $g2w (local.get $cur)) (global.get $NULL_SENTINEL))
        (then (return (i32.const 1))))
      (local.set $pte
        (i32.atomic.load
          (i32.add (global.get $GUEST_PAGE_TABLE)
            (i32.and (i32.shr_u (local.get $cur) (i32.const 10))
              (i32.const 0x003FFFFC)))))
      (if (i32.and (local.get $pte) (global.get $GUEST_PTE_PRESENT))
        (then
          (local.set $protect
            (i32.and (local.get $pte) (global.get $GUEST_PTE_PROTECT_MASK)))
          ;; Guard pages fail a system-service probe. PAGE_NOCACHE does not
          ;; change access. For mapped pages, WRITECOPY remains writable.
          (if (i32.and (local.get $protect) (i32.const 0x100))
            (then (return (i32.const 1))))
          (local.set $protect (i32.and (local.get $protect) (i32.const 0xFF)))
          (if (local.get $write)
            (then
              (if (i32.eqz (i32.or
                    (i32.or
                      (i32.eq (local.get $protect) (i32.const 0x04))
                      (i32.eq (local.get $protect) (i32.const 0x08)))
                    (i32.or
                      (i32.eq (local.get $protect) (i32.const 0x40))
                      (i32.eq (local.get $protect) (i32.const 0x80)))))
                (then (return (i32.const 1)))))
            (else
              (if (i32.eqz (i32.or
                    (i32.or
                      (i32.eq (local.get $protect) (i32.const 0x02))
                      (i32.eq (local.get $protect) (i32.const 0x04)))
                    (i32.or
                      (i32.or
                        (i32.eq (local.get $protect) (i32.const 0x08))
                        (i32.eq (local.get $protect) (i32.const 0x20)))
                      (i32.or
                        (i32.eq (local.get $protect) (i32.const 0x40))
                        (i32.eq (local.get $protect) (i32.const 0x80))))))
                (then (return (i32.const 1))))))))
      (br_if $done
        (i32.le_u (local.get $last) (i32.or (local.get $cur) (i32.const 0xFFF))))
      (local.set $cur
        (i32.add (i32.or (local.get $cur) (i32.const 0xFFF)) (i32.const 1)))
      (br $pages)))
    (i32.const 0))

  (func $ptr_range_bad (param $ptr i32) (param $len i32) (result i32)
    (call $ptr_range_access_bad
      (local.get $ptr) (local.get $len) (i32.const 0)))

  ;; 343: IsBadReadPtr(lp, ucb) → BOOL. Nonzero means the range is NOT readable.
  (func $handle_IsBadReadPtr (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $ptr_range_access_bad
      (local.get $arg0) (local.get $arg1) (i32.const 0)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12))))

  ;; 344: IsBadWritePtr(lp, ucb) → BOOL.
  (func $handle_IsBadWritePtr (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $ptr_range_access_bad
      (local.get $arg0) (local.get $arg1) (i32.const 1)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12)))  ;; stdcall, 2 args
  )

  ;; 345: SetUnhandledExceptionFilter(lpTopLevelFilter) -> previous filter.
  ;;
  ;; The comment used to say "store filter" while the body stored nothing and
  ;; returned a constant 0. Both halves matter: a CRT installs its filter at
  ;; startup and a DLL that installs its own is expected to chain to whatever
  ;; it displaced, so returning a fabricated 0 tells every caller it is the
  ;; first one and loses the filter the previous caller had installed.
  (func $handle_SetUnhandledExceptionFilter (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (global.get $unhandled_exception_filter))
    (global.set $unhandled_exception_filter (local.get $arg0))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8)))
  )

  ;; AddVectoredExceptionHandler(First, Handler) -> opaque handle. ScummVM
  ;; installs this as a defensive crash reporter during startup. Keep the
  ;; registration coherent with RemoveVectoredExceptionHandler; the existing
  ;; SEH/top-level-filter machinery remains authoritative for delivered faults.
  (func $handle_AddVectoredExceptionHandler (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (drop (local.get $arg0))
    (global.set $vectored_exception_handler (local.get $arg1))
    (global.set $eax (local.get $arg1))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12))))

  ;; RemoveVectoredExceptionHandler(Handle) -> ULONG.
  (func $handle_RemoveVectoredExceptionHandler (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.and
          (i32.ne (local.get $arg0) (i32.const 0))
          (i32.eq (local.get $arg0) (global.get $vectored_exception_handler)))
      (then
        (global.set $vectored_exception_handler (i32.const 0))
        (global.set $eax (i32.const 1)))
      (else (global.set $eax (i32.const 0))))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8))))

  ;; 937: SetPriorityClass(hProcess, dwPriorityClass). Publish the selected
  ;; Win98 class process-wide; the browser scheduler remains cooperative, but
  ;; callers must observe truthful state and failures instead of fixed success.
  (func $handle_SetPriorityClass (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $esp (i32.add (global.get $esp) (i32.const 12)))
    (if (i32.eqz (call $current_process_handle_valid (local.get $arg0)))
      (then
        (global.set $last_error (i32.const 6)) ;; ERROR_INVALID_HANDLE
        (global.set $eax (i32.const 0))
        (return)))
    (if (i32.eqz (call $win98_process_priority_valid (local.get $arg1)))
      (then
        (global.set $last_error (i32.const 87)) ;; ERROR_INVALID_PARAMETER
        (global.set $eax (i32.const 0))
        (return)))
    (i32.atomic.store offset=8
      (global.get $SHARED_COUNTERS) (local.get $arg1))
    (global.set $eax (i32.const 1))
  )

  ;; SetProcessShutdownParameters(dwLevel, dwFlags) — record the process's
  ;; shutdown ordering so the matching Get* returns what was set. Explorer sets
  ;; a low level so it shuts down after the apps it hosts.
  (func $handle_SetProcessShutdownParameters (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $shutdown_level (local.get $arg0))
    (global.set $shutdown_flags (local.get $arg1))
    (global.set $eax (i32.const 1))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12)))
  )

  ;; GetProcessShutdownParameters(lpdwLevel, lpdwFlags) — report stored values.
  (func $handle_GetProcessShutdownParameters (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (local.get $arg0)
      (then (i32.store (call $g2w (local.get $arg0)) (global.get $shutdown_level))))
    (if (local.get $arg1)
      (then (i32.store (call $g2w (local.get $arg1)) (global.get $shutdown_flags))))
    (global.set $eax (i32.const 1))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12)))
  )

  ;; The browser hosts one Win32 process. Accept its contextual pseudo-handle
  ;; and the durable handle OpenProcess issues for its stable PID; no other
  ;; numeric value names a process object in this runtime.
  (func $current_process_handle_valid (param $handle i32) (result i32)
    (i32.or
      (i32.eq (local.get $handle) (i32.const -1))
      (i32.eq (local.get $handle)
        (i32.or (i32.const 0x000e2000)
          (i32.and (call $current_process_id) (i32.const 0x0fff))))))

  ;; Windows 98 exposes the original four process classes. The later
  ;; ABOVE_NORMAL/BELOW_NORMAL and background-mode values must not be accepted
  ;; merely because a modern header assigns them constants.
  (func $win98_process_priority_valid (param $class i32) (result i32)
    (i32.or
      (i32.or
        (i32.eq (local.get $class) (i32.const 0x20))  ;; NORMAL_PRIORITY_CLASS
        (i32.eq (local.get $class) (i32.const 0x40))) ;; IDLE_PRIORITY_CLASS
      (i32.or
        (i32.eq (local.get $class) (i32.const 0x80))  ;; HIGH_PRIORITY_CLASS
        (i32.eq (local.get $class) (i32.const 0x100))))) ;; REALTIME_PRIORITY_CLASS

  ;; A zero shared cell is the fresh-process default, NORMAL_PRIORITY_CLASS.
  ;; Once SetPriorityClass runs it publishes the explicit class atomically so
  ;; cooperative and real Worker instances see one process-wide value.
  (func $process_priority_class_get (result i32)
    (local $class i32)
    (local.set $class
      (i32.atomic.load offset=8 (global.get $SHARED_COUNTERS)))
    (select (local.get $class) (i32.const 0x20)
      (i32.ne (local.get $class) (i32.const 0))))

  ;; 1264: GetPriorityClass(hProcess) — return the retained process class.
  (func $handle_GetPriorityClass (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $esp (i32.add (global.get $esp) (i32.const 8)))
    (if (i32.eqz (call $current_process_handle_valid (local.get $arg0)))
      (then
        (global.set $last_error (i32.const 6)) ;; ERROR_INVALID_HANDLE
        (global.set $eax (i32.const 0))
        (return)))
    (global.set $eax (call $process_priority_class_get))
  )

  ;; 1265: GetThreadPriority(hThread). The host owns thread HANDLE identity;
  ;; pass the contextual Win32 tid as well so pseudo-handle -2 resolves to the
  ;; calling guest thread rather than always meaning the UI thread.
  (func $handle_GetThreadPriority (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $priority i32)
    (global.set $esp (i32.add (global.get $esp) (i32.const 8)))
    (local.set $priority (call $host_get_thread_priority
      (local.get $arg0) (global.get $current_thread_id)))
    (if (i32.eq (local.get $priority) (i32.const 0x7fffffff))
      (then (global.set $last_error (i32.const 6)))) ;; ERROR_INVALID_HANDLE
    (global.set $eax (local.get $priority))
  )

  ;; 1266: GetUpdateRgn(hWnd, hRgn, bErase) — copy updateRgn into hRgn.
  (func $handle_GetUpdateRgn (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $rv i32) (local $rect i32)
    (local.set $rect (call $paint_scratch_take))
    (local.set $rv (call $update_get_rect (local.get $arg0) (local.get $rect)))
    (if (i32.and (i32.ne (local.get $rv) (i32.const 0)) (i32.ne (local.get $arg1) (i32.const 0)))
      (then
        (drop (call $gdi_rgn_set_rect
          (local.get $arg1)
          (load.field PaintRect left (local.get $rect))
          (load.field.memarg PaintRect top (local.get $rect))
          (load.field.memarg PaintRect right (local.get $rect))
          (load.field.memarg PaintRect bottom (local.get $rect))))))
    ;; Win16 USER returned this runtime's historical BOOL-shaped result here.
    ;; Several VB-era libraries check only zero/non-zero instead of the Win32
    ;; region complexity constants; preserve that ABI for thunked callers.
    (if (global.get $code16)
      (then
        (global.set $eax (select (i32.const 1) (i32.const 0) (local.get $rv)))
        (global.set $esp (i32.add (global.get $esp) (i32.const 16)))
        (return)))
    ;; Win32 returns a region type: SIMPLEREGION (2) for the one rectangle we
    ;; track, NULLREGION (1) when nothing is pending. ERROR (0) is reserved for
    ;; a bad window, and Storm treats anything else as pending content.
    (if (i32.eqz (call $wnd_table_get (local.get $arg0)))
      (then
        (global.set $eax (i32.const 0))
        (global.set $esp (i32.add (global.get $esp) (i32.const 16)))
        (return)))
    (global.set $eax (select (i32.const 2) (i32.const 1) (local.get $rv)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 16)))
  )

  ;; 346: IsDebuggerPresent — no guest debugger is attached.
  (func $handle_IsDebuggerPresent (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (i32.const 0))
    (global.set $esp (i32.add (global.get $esp) (i32.const 4)))
  )

  ;; 347: lstrcpynW — copy up to n wide chars
  (func $handle_lstrcpynW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $lstr_cpyn (local.get $arg0) (local.get $arg1) (local.get $arg2) (i32.const 1))
    (global.set $eax (local.get $arg0))
    (global.set $esp (i32.add (global.get $esp) (i32.const 16)))
  )

  ;; 348: FindFirstFileW — STUB: unimplemented
  (func $handle_FindFirstFileW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; FindFirstFileW(lpFileName, lpFindFileData) — 2 args
    (global.set $eax (call $host_fs_find_first_file
      (call $g2w (local.get $arg0)) (local.get $arg1) (i32.const 1)))
    (if (i32.eq (global.get $eax) (i32.const -1))
      (then (global.set $last_error (i32.const 2)))) ;; ERROR_FILE_NOT_FOUND
    (global.set $esp (i32.add (global.get $esp) (i32.const 12)))
  )

  ;; 349: GetFileAttributesW — STUB: unimplemented
  (func $handle_GetFileAttributesW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $attrs i32)
    ;; GetFileAttributesW(lpFileName) — 1 arg
    (local.set $attrs (call $host_fs_get_file_attributes
      (call $g2w (local.get $arg0)) (i32.const 1)))
    (global.set $eax (local.get $attrs))
    (if (i32.eq (local.get $attrs) (i32.const -1))
      (then (global.set $last_error (i32.const 2)))) ;; ERROR_FILE_NOT_FOUND
    (global.set $esp (i32.add (global.get $esp) (i32.const 8)))
  )

  ;; 350: GetShortPathNameW — STUB: unimplemented
  (func $handle_GetShortPathNameW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; GetShortPathNameW(lpszLongPath, lpszShortPath, cchBuffer) — 3 args
    (global.set $eax (call $host_fs_get_short_path_name
      (call $g2w (local.get $arg0)) (local.get $arg1) (local.get $arg2) (i32.const 1)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 16)))
  )

  ;; 351: CreateDirectoryW — STUB: unimplemented
  (func $handle_CreateDirectoryW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $path_wa i32)
    (local.set $path_wa (call $g2w (local.get $arg0)))
    ;; CreateDirectoryW(lpPathName, lpSecurityAttributes) — 2 args
    (global.set $eax (call $host_fs_create_directory
      (local.get $path_wa) (i32.const 1)))
    (if (global.get $eax)
      (then (global.set $last_error (i32.const 0)))
      (else
        (global.set $last_error
          (if (result i32)
            (i32.ne (call $host_fs_get_file_attributes
              (local.get $path_wa) (i32.const 1)) (i32.const -1))
            (then (i32.const 183)) ;; ERROR_ALREADY_EXISTS
            (else (i32.const 5)))))) ;; ERROR_ACCESS_DENIED
    (global.set $esp (i32.add (global.get $esp) (i32.const 12)))
  )

  ;; 352: IsDBCSLeadByte(ch)
  (func $handle_IsDBCSLeadByte (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $is_dbcs_lead_byte (local.get $arg0)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8)))  ;; stdcall, 1 arg
  )

  ;; 353: GetTempPathW — STUB: unimplemented
  (func $handle_GetTempPathW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; GetTempPathW(nBufferLength, lpBuffer) — 2 args
    (global.set $eax (call $host_fs_get_temp_path
      (local.get $arg0) (local.get $arg1) (i32.const 1)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12)))
  )

  ;; 354: GetTempFileNameW — STUB: unimplemented
  (func $handle_GetTempFileNameW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; GetTempFileNameW(lpPathName, lpPrefixString, uUnique, lpTempFileName) — 4 args
    (global.set $eax (call $host_fs_get_temp_file_name
      (call $g2w (local.get $arg0)) (call $g2w (local.get $arg1)) (local.get $arg2) (local.get $arg3) (i32.const 1)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 20)))
  )

  ;; 355: lstrcatW(dst, src) — concatenate wide strings, return dst
  (func $handle_lstrcatW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $lstr_cat (local.get $arg0) (local.get $arg1) (i32.const 1))
    (global.set $eax (local.get $arg0))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12)))  ;; stdcall, 2 args
  )

  ;; 356: GlobalHandle — our GlobalLock returns ptr as-is, so GlobalHandle returns same value
  (func $handle_GlobalHandle (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (local.get $arg0))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8)))  ;; stdcall, 1 arg
  )

ctl32 can route an ANSI status-bar string through ExtTextOutW
  ;; as packed byte pairs. Recognize only a printable byte string terminated
  ;; within the supplied UTF-16 span; ordinary UTF-16 ASCII has zero high
  ;; bytes and cannot match. The count can extend past the ANSI terminator
  ;; because the control obtained it by running lstrlenW over the byte buffer.
  (func $gdi_ext_text_out_w_packed_ansi_len (param $text i32) (param $count i32) (result i32)
    (local $i i32) (local $limit i32) (local $ch i32)
    (if (i32.or (i32.eqz (local.get $text))
          (i32.or (i32.le_s (local.get $count) (i32.const 0))
            (i32.gt_u (local.get $count) (i32.const 0x7FFF))))
      (then (return (i32.const 0))))
    (if (i32.eqz (i32.load8_u offset=1 (local.get $text)))
      (then (return (i32.const 0))))
    (local.set $limit (i32.shl (local.get $count) (i32.const 1)))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (local.get $limit)))
      (local.set $ch (i32.load8_u (i32.add (local.get $text) (local.get $i))))
      (if (i32.eqz (local.get $ch))
        (then (return (local.get $i))))
      (if (i32.and
            (i32.or (i32.lt_u (local.get $ch) (i32.const 0x20))
              (i32.gt_u (local.get $ch) (i32.const 0x7E)))
            (i32.and (i32.ne (local.get $ch) (i32.const 9))
              (i32.and (i32.ne (local.get $ch) (i32.const 10))
                (i32.ne (local.get $ch) (i32.const 13)))))
        (then (return (i32.const 0))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (if (i32.eqz (i32.load8_u (i32.add (local.get $text) (local.get $limit))))
      (then (return (local.get $limit))))
    (i32.const 0))

rushOrgEx(hdc, x, y, lppt) — canonical WAT-owned brush origin.
  (func $handle_SetBrushOrgEx (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $wa i32) (local $old_x i32) (local $old_y i32) (local $aux i32)
    (local.set $aux (call $gdi_dc_aux_entry (local.get $arg0) (i32.const 1)))
    (if (i32.eqz (local.get $aux))
      (then
        (global.set $eax (i32.const 0))
        (global.set $esp (i32.add (global.get $esp) (i32.const 20)))
        (return)))
    (local.set $old_x (call $gdi_dc_aux_get (local.get $arg0) (i32.const 8) (i32.const 0)))
    (local.set $old_y (call $gdi_dc_aux_get (local.get $arg0) (i32.const 12) (i32.const 0)))
    (if (local.get $arg3)
      (then
        (local.set $wa (call $g2w (local.get $arg3)))
        (store.field Point x (local.get $wa) (local.get $old_x))
        (store.field Point y (local.get $wa) (local.get $old_y))
      )
    )
    (drop (call $gdi_dc_aux_set (local.get $arg0) (i32.const 8)
      (local.get $arg1) (i32.const 0)))
    (drop (call $gdi_dc_aux_set (local.get $arg0) (i32.const 12)
      (local.get $arg2) (i32.const 0)))
    (global.set $eax (i32.const 1))
    (global.set $esp (i32.add (global.get $esp) (i32.const 20)))  ;; stdcall, 4 args
  )

  ;; Heap-backed USER hook node layout (guest pointer returned as HHOOK):
  ;;   magic "HOK1" while live, proc, next, retired-list link
  ;; Removed nodes stay allocated while any hook callback is active. A hook
  ;; can unhook itself (or an older active hook) and still return safely.
  (func $hook_head_get (param $id_hook i32) (result i32)
    (if (i32.eq (local.get $id_hook) (i32.const 2))
      (then (return (global.get $keyboard_hook_head))))
    (if (i32.eq (local.get $id_hook) (i32.const 5))
      (then (return (global.get $cbt_hook_head))))
    (i32.const 0))

  (func $hook_node_proc (param $node i32) (result i32)
    (if (i32.eqz (local.get $node)) (then (return (i32.const 0))))
    (load.field.memarg HookNode proc (call $g2w (local.get $node))))

  (func $hook_head_set (param $id_hook i32) (param $node i32)
    (local $proc i32)
    (local.set $proc (call $hook_node_proc (local.get $node)))
    (if (i32.eq (local.get $id_hook) (i32.const 2))
      (then
        (global.set $keyboard_hook_head (local.get $node))
        (global.set $keyboard_hook_proc (local.get $proc))
        (return)))
    (if (i32.eq (local.get $id_hook) (i32.const 5))
      (then
        (global.set $cbt_hook_head (local.get $node))
        (global.set $cbt_hook_proc (local.get $proc)))))

  (func $hook_next_live (param $node i32) (result i32)
    (local $wa i32)
    (if (local.get $node)
      (then
        (local.set $node
          (load.field.memarg HookNode next (call $g2w (local.get $node))))))
    (block $done (loop $scan
      (br_if $done (i32.eqz (local.get $node)))
      (local.set $wa (call $g2w (local.get $node)))
      (br_if $done
        (i32.eq (load.field HookNode magic (local.get $wa))
          (i32.const 0x314B4F48)))
      (local.set $node (load.field.memarg HookNode next (local.get $wa)))
      (br $scan)))
    (local.get $node))

  (func $hook_reap_retired
    (local $node i32) (local $next i32)
    (if (global.get $hook_dispatch_depth) (then (return)))
    (local.set $node (global.get $hook_retired_head))
    (global.set $hook_retired_head (i32.const 0))
    (block $done (loop $reap
      (br_if $done (i32.eqz (local.get $node)))
      (local.set $next
        (load.field.memarg HookNode retired_next
          (call $g2w (local.get $node))))
      (call $heap_free (local.get $node))
      (local.set $node (local.get $next))
      (br $reap))))

  (func $hook_retire (param $node i32)
    (local $wa i32)
    (local.set $wa (call $g2w (local.get $node)))
    (store.field HookNode magic (local.get $wa) (i32.const 0))
    (if (global.get $hook_dispatch_depth)
      (then
        (store.field.memarg HookNode retired_next (local.get $wa)
          (global.get $hook_retired_head))
        (global.set $hook_retired_head (local.get $node)))
      (else (call $heap_free (local.get $node)))))

  (func $hook_dispatch_enter (param $id_hook i32) (result i32)
    (local $node i32)
    (local.set $node (call $hook_head_get (local.get $id_hook)))
    (if (i32.eqz (local.get $node)) (then (return (i32.const 0))))
    (global.set $hook_active_node (local.get $node))
    (global.set $hook_dispatch_depth
      (i32.add (global.get $hook_dispatch_depth) (i32.const 1)))
    (call $hook_node_proc (local.get $node)))

  (func $hook_dispatch_leave (param $previous i32)
    (global.set $hook_active_node (local.get $previous))
    (if (global.get $hook_dispatch_depth)
      (then
        (global.set $hook_dispatch_depth
          (i32.sub (global.get $hook_dispatch_depth) (i32.const 1)))))
    (call $hook_reap_retired))

  (func $hook_remove_handle_from
      (param $id_hook i32) (param $handle i32) (result i32)
    (local $prev i32) (local $node i32) (local $next i32) (local $wa i32)
    (local.set $node (call $hook_head_get (local.get $id_hook)))
    (block $missing (loop $scan
      (br_if $missing (i32.eqz (local.get $node)))
      (local.set $wa (call $g2w (local.get $node)))
      (local.set $next (load.field.memarg HookNode next (local.get $wa)))
      (if (i32.eq (local.get $node) (local.get $handle))
        (then
          (if (local.get $prev)
            (then
              (store.field.memarg HookNode next (call $g2w (local.get $prev))
                (local.get $next)))
            (else
              (call $hook_head_set (local.get $id_hook) (local.get $next))))
          (call $hook_retire (local.get $node))
          (return (i32.const 1))))
      (local.set $prev (local.get $node))
      (local.set $node (local.get $next))
      (br $scan)))
    (i32.const 0))

  (func $hook_remove_proc
      (param $id_hook i32) (param $proc i32) (result i32)
    (local $node i32)
    (local.set $node (call $hook_head_get (local.get $id_hook)))
    (block $missing (loop $scan
      (br_if $missing (i32.eqz (local.get $node)))
      (if (i32.eq (call $hook_node_proc (local.get $node)) (local.get $proc))
        (then
          (return
            (call $hook_remove_handle_from
              (local.get $id_hook) (local.get $node)))))
      (local.set $node
        (load.field.memarg HookNode next (call $g2w (local.get $node))))
      (br $scan)))
    (i32.const 0))

  ;; CallNextHookEx ignores hhk and enters the next live procedure in the
  ;; currently executing chain. HKN1 leaves EAX untouched so the exact next
  ;; hook LRESULT reaches the suspended caller.
  (func $handle_CallNextHookEx (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $next i32) (local $ret i32)
    ;; CallNextHookEx(hhk, nCode, wParam, lParam) — 4 args stdcall
    (local.set $next (call $hook_next_live (global.get $hook_active_node)))
    (if (i32.eqz (local.get $next))
      (then
        (global.set $eax (i32.const 0))
        (global.set $esp (i32.add (global.get $esp) (i32.const 20)))
        (return)))
    (local.set $ret (call $gl32 (global.get $esp)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 20)))
    ;; Context below the next HookProc frame: magic, CallNext caller, current.
    (global.set $esp (i32.sub (global.get $esp) (i32.const 4)))
    (call $gs32 (global.get $esp) (global.get $hook_active_node))
    (global.set $esp (i32.sub (global.get $esp) (i32.const 4)))
    (call $gs32 (global.get $esp) (local.get $ret))
    (global.set $esp (i32.sub (global.get $esp) (i32.const 4)))
    (call $gs32 (global.get $esp) (i32.const 0x314E4B48)) ;; "HKN1"
    (global.set $esp (i32.sub (global.get $esp) (i32.const 4)))
    (call $gs32 (global.get $esp) (local.get $arg3))
    (global.set $esp (i32.sub (global.get $esp) (i32.const 4)))
    (call $gs32 (global.get $esp) (local.get $arg2))
    (global.set $esp (i32.sub (global.get $esp) (i32.const 4)))
    (call $gs32 (global.get $esp) (local.get $arg1))
    (global.set $esp (i32.sub (global.get $esp) (i32.const 4)))
    (call $gs32 (global.get $esp) (global.get $font_enum_ret_thunk))
    (global.set $hook_active_node (local.get $next))
    (global.set $eip (call $hook_node_proc (local.get $next)))
    (global.set $steps (i32.const 0))
  )

  ;; USER models process-local WH_KEYBOARD and WH_CBT chains. New hooks are
  ;; prepended, matching SetWindowsHookEx ordering; the node pointer is HHOOK.
  (func $install_supported_hook (param $id_hook i32) (param $proc i32) (result i32)
    (local $node i32) (local $wa i32)
    (if (i32.eqz (local.get $proc))
      (then (return (i32.const 0))))
    (if (i32.and
          (i32.ne (local.get $id_hook) (i32.const 2))
          (i32.ne (local.get $id_hook) (i32.const 5)))
      (then (return (i32.const 0))))
    (local.set $node (call $heap_alloc (size-of HookNode)))
    (if (i32.eqz (local.get $node)) (then (return (i32.const 0))))
    (local.set $wa (call $g2w (local.get $node)))
    (store.field HookNode magic (local.get $wa)
      (i32.const 0x314B4F48)) ;; "HOK1"
    (store.field.memarg HookNode proc (local.get $wa) (local.get $proc))
    (store.field.memarg HookNode next (local.get $wa)
      (call $hook_head_get (local.get $id_hook)))
    (store.field.memarg HookNode retired_next (local.get $wa) (i32.const 0))
    (call $hook_head_set (local.get $id_hook) (local.get $node))
    (local.get $node)
  )

  ;; 380: UnhookWindowsHookEx(hhk) → BOOL
  (func $handle_UnhookWindowsHookEx (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $removed i32)
    (local.set $removed
      (call $hook_remove_handle_from (i32.const 2) (local.get $arg0)))
    (if (i32.eqz (local.get $removed))
      (then
        (local.set $removed
          (call $hook_remove_handle_from (i32.const 5) (local.get $arg0)))))
    (global.set $eax (local.get $removed))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8))))

  ;; 854: UnhookWindowsHook(nCode, pfnFilterProc) → BOOL — legacy version
  (func $handle_UnhookWindowsHook (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax
      (call $hook_remove_proc (local.get $arg0) (local.get $arg1)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12))))

  ;; 381: SetWindowsHookExW — same class-specific handle as the A path.
  ;; SetWindowsHookExW(idHook, lpfn, hMod, dwThreadId) — the hook proc is a
  ;; code pointer, so there is nothing to widen; the A path is the whole story.
  (func $handle_SetWindowsHookExW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_SetWindowsHookExA
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
  )

  ;; SetWindowsHookExA — install one of USER's process-local hook classes.
  (func $handle_SetWindowsHookExA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; SetWindowsHookExA(idHook, lpfn, hMod, dwThreadId)
    (global.set $eax
      (call $install_supported_hook (local.get $arg0) (local.get $arg1)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 20)))
  )

  ;; 382: RedrawWindow(hwnd, lprcUpdate, hrgnUpdate, flags). Minimal:
  ;; treat as InvalidateRect/Rgn. RDW_VALIDATE (flags & 8) clears instead.
  ;; Other flag nuances (RDW_FRAME, RDW_UPDATENOW, RDW_NOCHILDREN) ignored.
  (func $handle_RedrawWindow (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $l i32) (local $t i32) (local $r i32) (local $b i32) (local $wa i32) (local $cs i32)
    (if (i32.eqz (local.get $arg0))
      (then
        (global.set $eax (i32.const 1))
        (global.set $esp (i32.add (global.get $esp) (i32.const 20))) (return)))
    ;; Derive rect: lprcUpdate if set, else hrgnUpdate bbox, else full client.
    (if (local.get $arg1)
      (then
        (local.set $wa (call $g2w (local.get $arg1)))
        (local.set $l (load.field Rect left (local.get $wa)))
        (local.set $t (load.field.memarg Rect top (local.get $wa)))
        (local.set $r (load.field.memarg Rect right (local.get $wa)))
        (local.set $b (load.field.memarg Rect bottom (local.get $wa))))
      (else
        (local.set $cs (call $host_get_window_client_size (local.get $arg0)))
        (local.set $l (i32.const 0)) (local.set $t (i32.const 0))
        (local.set $r (i32.and (local.get $cs) (i32.const 0xFFFF)))
        (local.set $b (i32.shr_u (local.get $cs) (i32.const 16)))))
    (if (i32.and (local.get $arg3) (i32.const 0x8))  ;; RDW_VALIDATE
      (then
        (drop (call $update_validate_rect (local.get $arg0) (local.get $l) (local.get $t) (local.get $r) (local.get $b))))
      (else
        (call $update_invalidate_rect (local.get $arg0) (local.get $l) (local.get $t) (local.get $r) (local.get $b))
        (if (i32.eq (local.get $arg0) (global.get $main_hwnd))
          (then (global.set $paint_pending (i32.const 1)))
          (else (call $paint_flag_set (local.get $arg0))))
        (call $host_invalidate (local.get $arg0))))
    (global.set $eax (i32.const 1))
    (global.set $esp (i32.add (global.get $esp) (i32.const 20))) (return)
  )

  ;; 383: ValidateRect(hwnd, lprc). lprc=NULL → full client (clear all).
  (func $handle_ValidateRect (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $l i32) (local $t i32) (local $r i32) (local $b i32) (local $wa i32) (local $cs i32) (local $empty i32)
    (if (i32.eqz (local.get $arg0))
      (then
        (global.set $eax (i32.const 1))
        (global.set $esp (i32.add (global.get $esp) (i32.const 12))) (return)))
    (if (local.get $arg1)
      (then
        (local.set $wa (call $g2w (local.get $arg1)))
        (local.set $l (load.field Rect left (local.get $wa)))
        (local.set $t (load.field.memarg Rect top (local.get $wa)))
        (local.set $r (load.field.memarg Rect right (local.get $wa)))
        (local.set $b (load.field.memarg Rect bottom (local.get $wa))))
      (else
        (local.set $cs (call $host_get_window_client_size (local.get $arg0)))
        (local.set $l (i32.const 0)) (local.set $t (i32.const 0))
        (local.set $r (i32.and (local.get $cs) (i32.const 0xFFFF)))
        (local.set $b (i32.shr_u (local.get $cs) (i32.const 16)))))
    (local.set $empty (call $update_validate_rect (local.get $arg0) (local.get $l) (local.get $t) (local.get $r) (local.get $b)))
    (if (i32.and (i32.ne (local.get $empty) (i32.const 0))
                 (i32.eq (local.get $arg0) (global.get $main_hwnd)))
      (then (global.set $paint_pending (i32.const 0))))
    (global.set $eax (i32.const 1))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12)))
  )

  ;; 384: GetWindowDC(hwnd) → HDC. Like GetDC but includes non-client area.
  ;; Phase B: alloc DcRecord with kind='whole' so origin is window top-left.
  (func $handle_GetWindowDC (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $hdc i32)
    ;; GetDesktopWindow returns our fixed pseudo HWND 0x10000. It has no
    ;; ordinary window-table geometry, so binding a window DC to it fails and
    ;; MFC's CWindowDC constructor throws CResourceException. Native Windows
    ;; treats both NULL and the desktop HWND as requests for a screen DC.
    (if (i32.or (i32.eqz (local.get $arg0))
          (i32.eq (local.get $arg0) (i32.const 0x10000)))
      (then (local.set $hdc (call $host_alloc_screen_dc)))
      (else
        (local.set $hdc (call $host_alloc_window_dc (local.get $arg0) (i32.const 1)))
        (if (local.get $hdc)
          (then (call $dc_apply_window_clip (local.get $hdc) (local.get $arg0))))))
    (global.set $eax (local.get $hdc))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8)))
  )

  ;; 385: GrayStringW — STUB: unimplemented
  (func $handle_GrayStringW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $crash_unimplemented (local.get $name_ptr))
  )

  ;; 386: DrawTextW
  (func $handle_DrawTextW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $host_gdi_draw_text
      (local.get $arg0)
      (call $g2w (local.get $arg1))
      (local.get $arg2)
      (call $g2w (local.get $arg3))
      (local.get $arg4)
      (i32.const 1) ;; isWide = 1
    ))
    (global.set $esp (i32.add (global.get $esp) (i32.const 24)))  ;; stdcall, 5 args
  )

  ;; DrawTextExW
  (func $handle_DrawTextExW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $draw_text_ex
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4)
      (call $gl32 (i32.add (global.get $esp) (i32.const 24)))
      (i32.const 1)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 28)))  ;; stdcall, 6 args
  )

  ;; 387: TabbedTextOutW — same WAT layout path with UTF-16 runs.
  (func $handle_TabbedTextOutW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $gdi_tabbed_text
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4)
      (call $gl32 (i32.add (global.get $esp) (i32.const 24)))
      (call $gl32 (i32.add (global.get $esp) (i32.const 28)))
      (call $gl32 (i32.add (global.get $esp) (i32.const 32)))
      (i32.const 1) (i32.const 1)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 36)))
  )

  ;; 388: DestroyIcon(hIcon) — release built and copied icons. Loaded shared
  ;; resources remain live; an invalidated private handle fails.
  (func $handle_DestroyIcon (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $icon_destroy_handle (local.get $arg0)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8)))
  )

  ;; One LOGFONT{A,W} of system-font defaults at $buf. The two structs differ
  ;; only in lfFaceName's element width — 28 bytes of fields, then 32 chars —
  ;; so the whole NONCLIENTMETRICS layout below shifts with $wide and cannot be
  ;; written with static offsets.
  (func $spi_write_logfont (param $buf i32) (param $wide i32)
    (local $i i32) (local $ch i32)
    (i32.store offset=0  (local.get $buf) (i32.const -11))  ;; lfHeight
    (i32.store offset=16 (local.get $buf) (i32.const 400))  ;; lfWeight
    ;; lfFaceName at +28: "MS Sans Serif" from the shared constant at 0x270.
    (local.set $i (i32.const 0))
    (block $done (loop $copy
      (local.set $ch (i32.load8_u (i32.add (i32.const 0x270) (local.get $i))))
      (br_if $done (i32.eqz (local.get $ch)))
      (if (local.get $wide)
        (then (i32.store16
                (i32.add (i32.add (local.get $buf) (i32.const 28))
                         (i32.shl (local.get $i) (i32.const 1)))
                (local.get $ch)))
        (else (i32.store8
                (i32.add (i32.add (local.get $buf) (i32.const 28)) (local.get $i))
                (local.get $ch))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $copy)))
    ;; Do not depend on the caller or enclosing structure initialization for
    ;; the LOGFONT face terminator. Some Win9x callers reuse stack storage.
    (if (local.get $wide)
      (then (i32.store16
        (i32.add (i32.add (local.get $buf) (i32.const 28))
          (i32.shl (local.get $i) (i32.const 1)))
        (i32.const 0)))
      (else (i32.store8
        (i32.add (i32.add (local.get $buf) (i32.const 28)) (local.get $i))
        (i32.const 0)))))

  ;; SystemParametersInfo{A,W}(uiAction, uiParam, pvParam, fWinIni) — one body,
  ;; $wide selects the string encoding. The W entry point used to be a 6-line
  ;; return-TRUE stub sitting directly above this implementation, so every W
  ;; caller got a success code and an untouched buffer.
  (func $spi_core (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $wide i32) (result i32)
    (local $buf i32) (local $i i32)
    (local $lf i32) (local $narrow i32) (local $p i32) (local $size i32)
    ;; LOGFONTA is 60 bytes, LOGFONTW 92 — every offset past lfCaptionFont moves.
    (local.set $lf (if (result i32) (local.get $wide) (then (i32.const 92)) (else (i32.const 60))))
    ;; SPI_SETDESKWALLPAPER = 0x14. The host loads the named VFS bitmap and
    ;; interprets uiParam=0/1 as centered/tiled for the Win98 Paint commands.
    (if (i32.eq (local.get $arg0) (i32.const 0x14))
      (then
        (if (i32.eqz (local.get $arg2)) (then (return (i32.const 0))))
        ;; The host reads a NUL-terminated byte path, so a W caller's UTF-16
        ;; name has to be narrowed before it is handed over.
        (if (local.get $wide)
          (then
            (local.set $narrow (call $shellexec_narrow_w (local.get $arg2)))
            (if (i32.eqz (local.get $narrow)) (then (return (i32.const 0))))
            (local.set $i (call $host_set_wallpaper
              (call $g2w (local.get $narrow)) (local.get $arg1)))
            (call $heap_free (local.get $narrow))
            (return (local.get $i))))
        (return (call $host_set_wallpaper
          (call $g2w (local.get $arg2)) (local.get $arg1)))))
    ;; SPI_GETWORKAREA = 0x30: fill RECT with the usable desktop area. The
    ;; browser desktop owns a classic 28px bottom taskbar (the same rectangle
    ;; SHAppBarMessage reports), so applications must not center or maximize
    ;; their windows underneath it.
    (if (i32.eq (local.get $arg0) (i32.const 0x30))
      (then
        (if (local.get $arg2)
          (then
            (local.set $buf (call $g2w (local.get $arg2)))
            (i32.store        (local.get $buf) (i32.const 0))
            (i32.store offset=4  (local.get $buf) (i32.const 0))
            (i32.store offset=8  (local.get $buf) (call $screen_metric_w))
            (i32.store offset=12 (local.get $buf) (call $screen_work_bottom))))
        (return (i32.const 1))))
    ;; SPI_GETNONCLIENTMETRICS = 0x29: fill NONCLIENTMETRICS struct
    ;; Win9x applications commonly pass uiParam=0 and declare the versioned
    ;; layout through NONCLIENTMETRICS.cbSize. Newer callers also pass the size
    ;; in uiParam, so accept either source while requiring the complete A/W
    ;; layout before writing its five LOGFONT records.
    (if (i32.eq (local.get $arg0) (i32.const 0x29))
      (then
        (if (local.get $arg2)
          (then
            (local.set $buf (call $g2w (local.get $arg2)))
            (local.set $size (local.get $arg1))
            (if (i32.eqz (local.get $size))
              (then (local.set $size (i32.load (local.get $buf)))))
            (if (i32.lt_u (local.get $size)
                  (i32.add (i32.const 40) (i32.mul (local.get $lf) (i32.const 5))))
              (then (return (i32.const 0))))
            ;; Initialize the complete Win98 layout. A larger declaration may
            ;; include fields added by newer Windows versions; leave that tail
            ;; alone rather than treating an unbounded caller value as a fill
            ;; length.
            (memory.fill (local.get $buf) (i32.const 0)
              (i32.add (i32.const 40) (i32.mul (local.get $lf) (i32.const 5))))
            ;; cbSize, iBorderWidth, iScrollWidth, iScrollHeight, iCaptionWidth, iCaptionHeight
            (i32.store        (local.get $buf)                       (local.get $size))  ;; cbSize
            (i32.store offset=4  (local.get $buf) (i32.const 1))    ;; iBorderWidth
            (i32.store offset=8  (local.get $buf) (i32.const 16))   ;; iScrollWidth
            (i32.store offset=12 (local.get $buf) (i32.const 16))   ;; iScrollHeight
            (i32.store offset=16 (local.get $buf) (i32.const 18))   ;; iCaptionWidth
            (i32.store offset=20 (local.get $buf) (i32.const 18))   ;; iCaptionHeight
            ;; Five LOGFONTs at their real struct offsets. The A path used to
            ;; place them at 84/148/212/276 — that spacing skips the two
            ;; iSmCaption and two iMenu ints, so every font after the caption
            ;; font landed inside the preceding one. Real layout:
            ;;   lfCaptionFont   24
            ;;   iSmCaptionWidth/Height  24+lf, +4
            ;;   lfSmCaptionFont 32+lf
            ;;   iMenuWidth/Height       32+2lf, +4
            ;;   lfMenuFont      40+2lf
            ;;   lfStatusFont    40+3lf
            ;;   lfMessageFont   40+4lf
            ;; cbSize is therefore 340 (A) / 500 (W).
            (local.set $p (i32.add (local.get $buf) (i32.const 24)))
            (call $spi_write_logfont (local.get $p) (local.get $wide))
            (local.set $p (i32.add (local.get $p) (local.get $lf)))
            (i32.store offset=0 (local.get $p) (i32.const 12))  ;; iSmCaptionWidth
            (i32.store offset=4 (local.get $p) (i32.const 15))  ;; iSmCaptionHeight
            (local.set $p (i32.add (local.get $p) (i32.const 8)))
            (call $spi_write_logfont (local.get $p) (local.get $wide))
            (local.set $p (i32.add (local.get $p) (local.get $lf)))
            (i32.store offset=0 (local.get $p) (i32.const 18))  ;; iMenuWidth
            (i32.store offset=4 (local.get $p) (i32.const 18))  ;; iMenuHeight
            (local.set $p (i32.add (local.get $p) (i32.const 8)))
            (call $spi_write_logfont (local.get $p) (local.get $wide))  ;; lfMenuFont
            (local.set $p (i32.add (local.get $p) (local.get $lf)))
            (call $spi_write_logfont (local.get $p) (local.get $wide))  ;; lfStatusFont
            (local.set $p (i32.add (local.get $p) (local.get $lf)))
            (call $spi_write_logfont (local.get $p) (local.get $wide)))) ;; lfMessageFont
        (return (i32.const 1))))
    (i32.const 1))

  ;; 389: SystemParametersInfoW — 4 args stdcall
  (func $handle_SystemParametersInfoW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $spi_core (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3) (i32.const 1)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 20)))
  )

  ;; SystemParametersInfoA(uiAction, uiParam, pvParam, fWinIni) — 4 args stdcall
  (func $handle_SystemParametersInfoA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $spi_core (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3) (i32.const 0)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 20)))
  )

  ;; 390: IsWindowVisible
  (func $handle_IsWindowVisible (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax
      (if (result i32) (i32.ge_s (call $wnd_table_find (local.get $arg0)) (i32.const 0))
        (then
          (if (result i32) (i32.and (call $wnd_get_style (local.get $arg0)) (i32.const 0x10000000))
            (then (i32.const 1))
            (else (i32.const 0))))
        (else (call $host_get_window_info (local.get $arg0) (i32.const 1)))))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8)))
  )

  ;; 391: InflateRect(lprc, dx, dy) → BOOL — 3 args stdcall
  (func $handle_InflateRect (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $wa i32)
    (local.set $wa (call $g2w (local.get $arg0)))
    ;; left -= dx
    (store.field Rect left (local.get $wa)
      (i32.sub (load.field Rect left (local.get $wa)) (local.get $arg1)))
    ;; top -= dy
    (store.field Rect top (local.get $wa)
      (i32.sub (load.field Rect top (local.get $wa)) (local.get $arg2)))
    ;; right += dx
    (store.field Rect right (local.get $wa)
      (i32.add (load.field Rect right (local.get $wa)) (local.get $arg1)))
    ;; bottom += dy
    (store.field Rect bottom (local.get $wa)
      (i32.add (load.field Rect bottom (local.get $wa)) (local.get $arg2)))
    (global.set $eax (i32.const 1))
    (global.set $esp (i32.add (global.get $esp) (i32.const 16)))
  )

  ;; 392: LoadBitmapW
  (func $handle_LoadBitmapW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $gdi_bitmap_load_resource
      (local.get $arg0) (local.get $arg1) (i32.const 1)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12))) (return)
  )

  ;; 393: wvsprintfW — STUB: unimplemented
  ;; wvsprintfW(lpOut, lpFmt, arglist) — the W twin of wvsprintfA, using the
  ;; same wide implementation wsprintfW already goes through. The only
  ;; difference from wsprintfW is where the arguments come from: an explicit
  ;; va_list pointer rather than the caller's stack. NT Paint formats its
  ;; Stretch/Skew dialog through this, and trapped here.
  (func $handle_wvsprintfW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $wsprintf_impl_w
      (local.get $arg0) (local.get $arg1) (local.get $arg2)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 16)))
  )

  ;; 121: DrawFocusRect(hdc, lprc)
  (func $handle_DrawFocusRect (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $rc i32) (local $desc i32)
    (local.set $rc (call $g2w (local.get $arg1)))
    (local.set $desc (global.get $GDI_LINE_DESC))
    (if (call $gdi_surface_descriptor (local.get $arg0) (local.get $desc))
      (then (global.set $eax (call $gdi_focus_rect_desc
        (local.get $arg0) (local.get $desc)
        (load.field Rect left (local.get $rc)) (load.field.memarg Rect top (local.get $rc))
        (load.field.memarg Rect right (local.get $rc)) (load.field.memarg Rect bottom (local.get $rc)))))
      (else (global.set $eax (i32.const 0))))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12)))  ;; ret + 2 args
  )

  ;; 395: PtInRect(lprc, pt.x, pt.y) -> BOOL — 3 args stdcall
  (func $handle_PtInRect (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $rect_w i32)
    (local.set $rect_w (call $g2w (local.get $arg0)))
    ;; Check: left <= x < right && top <= y < bottom
    (if (i32.and
      (i32.and
        (i32.le_s (load.field Rect left (local.get $rect_w)) (local.get $arg1))                          ;; left <= x
        (i32.lt_s (local.get $arg1) (load.field Rect right (local.get $rect_w)))   ;; x < right
      )
      (i32.and
        (i32.le_s (load.field Rect top (local.get $rect_w)) (local.get $arg2))   ;; top <= y
        (i32.lt_s (local.get $arg2) (load.field Rect bottom (local.get $rect_w)))  ;; y < bottom
      )
    )
    (then (global.set $eax (i32.const 1)))
    (else (global.set $eax (i32.const 0))))
    (global.set $esp (i32.add (global.get $esp) (i32.const 16))) ;; stdcall 3 params + ret
  )

  ;; 396: WinHelpW — normalize UTF-16 and share the WinHelpA engine
  (func $handle_WinHelpW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $accepted i32)
    (local.set $accepted (call $help_dispatch_api_w
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3)))
    (call $help_present_dispatch (local.get $accepted) (local.get $arg2))
    (global.set $eax (local.get $accepted))
    (global.set $esp (i32.add (global.get $esp) (i32.const 20)))
  )

  ;; 397: GetCapture — capture window associated with the current thread.
  (func $handle_GetCapture (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $capture_current_thread))
    (global.set $esp (i32.add (global.get $esp) (i32.const 4)))  ;; 0 args
  )

  ;; 398: RegisterClipboardFormatW(lpszFormat) → UINT
  ;; Returns a registered clipboard format ID. "Rich Text Format" is stable so
  ;; Set/GetClipboardData can recognize the non-OLE RTF payload.
  (func $handle_RegisterClipboardFormatW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (drop (local.get $arg1))
    (drop (local.get $arg2))
    (drop (local.get $arg3))
    (drop (local.get $arg4))
    (drop (local.get $name_ptr))
    (global.set $eax
      (call $clipboard_register_format (local.get $arg0) (i32.const 1)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8))))

  ;; 399: CopyRect(lprcDst, lprcSrc) → BOOL — 2 args stdcall
  (func $handle_CopyRect (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $dst i32) (local $src i32)
    (local.set $dst (call $g2w (local.get $arg0)))
    (local.set $src (call $g2w (local.get $arg1)))
    (store.field Rect left (local.get $dst) (load.field Rect left (local.get $src)))
    (store.field Rect top (local.get $dst) (load.field Rect top (local.get $src)))
    (store.field Rect right (local.get $dst) (load.field Rect right (local.get $src)))
    (store.field Rect bottom (local.get $dst) (load.field Rect bottom (local.get $src)))
    (global.set $eax (i32.const 1))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12)))
  )

  ;; 400: IntersectRect(lprcDst, lprcSrc1, lprcSrc2) → BOOL
  (func $handle_IntersectRect (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $dst i32) (local $s1 i32) (local $s2 i32)
    (local $left i32) (local $top i32) (local $right i32) (local $bottom i32)
    (local.set $dst (call $g2w (local.get $arg0)))
    (local.set $s1 (call $g2w (local.get $arg1)))
    (local.set $s2 (call $g2w (local.get $arg2)))
    ;; left = max(s1.left, s2.left)
    (local.set $left (select
      (load.field Rect left (local.get $s1)) (load.field Rect left (local.get $s2))
      (i32.gt_s (load.field Rect left (local.get $s1)) (load.field Rect left (local.get $s2)))))
    ;; top = max(s1.top, s2.top)
    (local.set $top (select
      (load.field Rect top (local.get $s1)) (load.field Rect top (local.get $s2))
      (i32.gt_s (load.field Rect top (local.get $s1)) (load.field Rect top (local.get $s2)))))
    ;; right = min(s1.right, s2.right)
    (local.set $right (select
      (load.field Rect right (local.get $s1)) (load.field Rect right (local.get $s2))
      (i32.lt_s (load.field Rect right (local.get $s1)) (load.field Rect right (local.get $s2)))))
    ;; bottom = min(s1.bottom, s2.bottom)
    (local.set $bottom (select
      (load.field Rect bottom (local.get $s1)) (load.field Rect bottom (local.get $s2))
      (i32.lt_s (load.field Rect bottom (local.get $s1)) (load.field Rect bottom (local.get $s2)))))
    ;; Check if intersection is empty
    (if (i32.or (i32.ge_s (local.get $left) (local.get $right))
                (i32.ge_s (local.get $top) (local.get $bottom)))
      (then
        ;; Empty: zero out dst, return FALSE
        (store.field Rect left (local.get $dst) (i32.const 0))
        (store.field Rect top (local.get $dst) (i32.const 0))
        (store.field Rect right (local.get $dst) (i32.const 0))
        (store.field Rect bottom (local.get $dst) (i32.const 0))
        (global.set $eax (i32.const 0))
      )
      (else
        (store.field Rect left (local.get $dst) (local.get $left))
        (store.field Rect top (local.get $dst) (local.get $top))
        (store.field Rect right (local.get $dst) (local.get $right))
        (store.field Rect bottom (local.get $dst) (local.get $bottom))
        (global.set $eax (i32.const 1))
      )
    )
    (global.set $esp (i32.add (global.get $esp) (i32.const 16)))  ;; stdcall, 3 args
  )

  ;; 401: UnionRect(lprcDst, lprcSrc1, lprcSrc2) → BOOL
  (func $handle_UnionRect (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $dst i32) (local $s1 i32) (local $s2 i32)
    (local $s1l i32) (local $s1t i32) (local $s1r i32) (local $s1b i32)
    (local $s2l i32) (local $s2t i32) (local $s2r i32) (local $s2b i32)
    (local $e1 i32) (local $e2 i32)
    (local.set $dst (call $g2w (local.get $arg0)))
    (local.set $s1 (call $g2w (local.get $arg1)))
    (local.set $s2 (call $g2w (local.get $arg2)))
    (local.set $s1l (load.field Rect left (local.get $s1)))
    (local.set $s1t (load.field.memarg Rect top (local.get $s1)))
    (local.set $s1r (load.field.memarg Rect right (local.get $s1)))
    (local.set $s1b (load.field.memarg Rect bottom (local.get $s1)))
    (local.set $s2l (load.field Rect left (local.get $s2)))
    (local.set $s2t (load.field.memarg Rect top (local.get $s2)))
    (local.set $s2r (load.field.memarg Rect right (local.get $s2)))
    (local.set $s2b (load.field.memarg Rect bottom (local.get $s2)))
    (local.set $e1 (i32.or
      (i32.ge_s (local.get $s1l) (local.get $s1r))
      (i32.ge_s (local.get $s1t) (local.get $s1b))))
    (local.set $e2 (i32.or
      (i32.ge_s (local.get $s2l) (local.get $s2r))
      (i32.ge_s (local.get $s2t) (local.get $s2b))))
    (if (i32.and (local.get $e1) (local.get $e2))
      (then
        (store.field Rect left (local.get $dst) (i32.const 0))
        (store.field.memarg Rect top (local.get $dst) (i32.const 0))
        (store.field.memarg Rect right (local.get $dst) (i32.const 0))
        (store.field.memarg Rect bottom (local.get $dst) (i32.const 0))
        (global.set $eax (i32.const 0)))
      (else
        (if (local.get $e1)
          (then
            (store.field Rect left (local.get $dst) (local.get $s2l))
            (store.field.memarg Rect top (local.get $dst) (local.get $s2t))
            (store.field.memarg Rect right (local.get $dst) (local.get $s2r))
            (store.field.memarg Rect bottom (local.get $dst) (local.get $s2b)))
          (else
            (if (local.get $e2)
              (then
                (store.field Rect left (local.get $dst) (local.get $s1l))
                (store.field.memarg Rect top (local.get $dst) (local.get $s1t))
                (store.field.memarg Rect right (local.get $dst) (local.get $s1r))
                (store.field.memarg Rect bottom (local.get $dst) (local.get $s1b)))
              (else
                (store.field Rect left (local.get $dst)
                  (select (local.get $s1l) (local.get $s2l) (i32.lt_s (local.get $s1l) (local.get $s2l))))
                (store.field.memarg Rect top (local.get $dst)
                  (select (local.get $s1t) (local.get $s2t) (i32.lt_s (local.get $s1t) (local.get $s2t))))
                (store.field.memarg Rect right (local.get $dst)
                  (select (local.get $s1r) (local.get $s2r) (i32.gt_s (local.get $s1r) (local.get $s2r))))
                (store.field.memarg Rect bottom (local.get $dst)
                  (select (local.get $s1b) (local.get $s2b) (i32.gt_s (local.get $s1b) (local.get $s2b))))))))
        (global.set $eax (i32.const 1))))
    (global.set $esp (i32.add (global.get $esp) (i32.const 16)))
  )

  ;; Store the bounding rectangle left after subtracting src2 from src1.
  ;; Win32 only trims when the intersection spans src1 completely along one
  ;; axis; a corner overlap cannot be represented by one RECT and therefore
  ;; leaves src1 unchanged. Inputs are values rather than pointers so dst may
  ;; alias either source, as the API permits in common docking call patterns.
  (func $rect_subtract_to_wa
      (param $dst i32)
      (param $s1l i32) (param $s1t i32) (param $s1r i32) (param $s1b i32)
      (param $s2l i32) (param $s2t i32) (param $s2r i32) (param $s2b i32)
      (result i32)
    (local $il i32) (local $it i32) (local $ir i32) (local $ib i32)
    (store.field Rect left (local.get $dst) (local.get $s1l))
    (store.field.memarg Rect top (local.get $dst) (local.get $s1t))
    (store.field.memarg Rect right (local.get $dst) (local.get $s1r))
    (store.field.memarg Rect bottom (local.get $dst) (local.get $s1b))
    (if (i32.or
          (i32.ge_s (local.get $s1l) (local.get $s1r))
          (i32.ge_s (local.get $s1t) (local.get $s1b)))
      (then
        (store.field Rect left (local.get $dst) (i32.const 0))
        (store.field.memarg Rect top (local.get $dst) (i32.const 0))
        (store.field.memarg Rect right (local.get $dst) (i32.const 0))
        (store.field.memarg Rect bottom (local.get $dst) (i32.const 0))
        (return (i32.const 0))))
    (local.set $il
      (select (local.get $s1l) (local.get $s2l)
        (i32.gt_s (local.get $s1l) (local.get $s2l))))
    (local.set $it
      (select (local.get $s1t) (local.get $s2t)
        (i32.gt_s (local.get $s1t) (local.get $s2t))))
    (local.set $ir
      (select (local.get $s1r) (local.get $s2r)
        (i32.lt_s (local.get $s1r) (local.get $s2r))))
    (local.set $ib
      (select (local.get $s1b) (local.get $s2b)
        (i32.lt_s (local.get $s1b) (local.get $s2b))))
    ;; No intersection: the result is the source rectangle copied above.
    (if (i32.or
          (i32.ge_s (local.get $il) (local.get $ir))
          (i32.ge_s (local.get $it) (local.get $ib)))
      (then (return (i32.const 1))))
    ;; Complete coverage has an empty geometric difference.
    (if (i32.and
          (i32.and (i32.eq (local.get $il) (local.get $s1l))
                   (i32.eq (local.get $it) (local.get $s1t)))
          (i32.and (i32.eq (local.get $ir) (local.get $s1r))
                   (i32.eq (local.get $ib) (local.get $s1b))))
      (then
        (store.field Rect left (local.get $dst) (i32.const 0))
        (store.field.memarg Rect top (local.get $dst) (i32.const 0))
        (store.field.memarg Rect right (local.get $dst) (i32.const 0))
        (store.field.memarg Rect bottom (local.get $dst) (i32.const 0))
        (return (i32.const 0))))
    ;; A full-height intersection can trim a left or right strip.
    (if (i32.and
          (i32.eq (local.get $it) (local.get $s1t))
          (i32.eq (local.get $ib) (local.get $s1b)))
      (then
        (if (i32.eq (local.get $il) (local.get $s1l))
          (then (store.field Rect left (local.get $dst) (local.get $ir)))
          (else
            (if (i32.eq (local.get $ir) (local.get $s1r))
              (then (store.field.memarg Rect right (local.get $dst) (local.get $il)))))))
      (else
        ;; A full-width intersection can trim a top or bottom strip.
        (if (i32.and
              (i32.eq (local.get $il) (local.get $s1l))
              (i32.eq (local.get $ir) (local.get $s1r)))
          (then
            (if (i32.eq (local.get $it) (local.get $s1t))
              (then (store.field.memarg Rect top (local.get $dst) (local.get $ib)))
              (else
                (if (i32.eq (local.get $ib) (local.get $s1b))
                  (then (store.field.memarg Rect bottom (local.get $dst) (local.get $it))))))))))
    (i32.const 1))

  ;; SubtractRect(lprcDst, lprcSrc1, lprcSrc2) → BOOL.
  (func $handle_SubtractRect (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $dst i32) (local $s1 i32) (local $s2 i32)
    (local $s1l i32) (local $s1t i32) (local $s1r i32) (local $s1b i32)
    (local $s2l i32) (local $s2t i32) (local $s2r i32) (local $s2b i32)
    (local.set $dst (call $g2w (local.get $arg0)))
    (local.set $s1 (call $g2w (local.get $arg1)))
    (local.set $s2 (call $g2w (local.get $arg2)))
    (local.set $s1l (load.field Rect left (local.get $s1)))
    (local.set $s1t (load.field.memarg Rect top (local.get $s1)))
    (local.set $s1r (load.field.memarg Rect right (local.get $s1)))
    (local.set $s1b (load.field.memarg Rect bottom (local.get $s1)))
    (local.set $s2l (load.field Rect left (local.get $s2)))
    (local.set $s2t (load.field.memarg Rect top (local.get $s2)))
    (local.set $s2r (load.field.memarg Rect right (local.get $s2)))
    (local.set $s2b (load.field.memarg Rect bottom (local.get $s2)))
    (global.set $eax
      (call $rect_subtract_to_wa
        (local.get $dst)
        (local.get $s1l) (local.get $s1t) (local.get $s1r) (local.get $s1b)
        (local.get $s2l) (local.get $s2t) (local.get $s2r) (local.get $s2b)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 16)))  ;; stdcall, 3 args
  )

  ;; 402: WindowFromPoint(POINT pt) → HWND. POINT is passed by value as two
  ;; dwords on the stack, so arg0=x, arg1=y. Pick the highest-z visible
  ;; top-level containing the screen point, then descend through its children.
  ;; Returning main_hwnd unconditionally is observably wrong when an app hides
  ;; its bootstrap HWND and recreates the real surface in a second one. SDL 1.2
  ;; checks WindowFromPoint against its current video HWND before accepting
  ;; mouse motion; DOSBox therefore left its DOS cursor frozen over every game
  ;; after changing video mode from hwnd 0x10001 to hwnd 0x10005.
  (func $handle_WindowFromPoint (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $slot i32) (local $hwnd i32) (local $best i32)
    (local $z i32) (local $best_z i32)
    (local $x i32) (local $y i32) (local $w i32) (local $h i32)
    (local $deep i32)
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $slot) (global.get $MAX_WINDOWS)))
      (local.set $hwnd (call $wnd_slot_hwnd (local.get $slot)))
      (if (i32.and
            (i32.and (i32.ne (local.get $hwnd) (i32.const 0))
                     (i32.eqz (call $wnd_get_parent (local.get $hwnd))))
            (i32.ne (i32.and (call $wnd_get_style (local.get $hwnd))
                             (i32.const 0x10000000))
                    (i32.const 0)))
        (then
          (local.set $x (call $wnd_window_screen_x (local.get $hwnd)))
          (local.set $y (call $wnd_window_screen_y (local.get $hwnd)))
          (local.set $w (call $wnd_screen_w (local.get $hwnd)))
          (local.set $h (call $wnd_screen_h (local.get $hwnd)))
          (if (i32.and
                (i32.and (i32.ge_s (local.get $arg0) (local.get $x))
                         (i32.lt_s (local.get $arg0)
                           (i32.add (local.get $x) (local.get $w))))
                (i32.and (i32.ge_s (local.get $arg1) (local.get $y))
                         (i32.lt_s (local.get $arg1)
                           (i32.add (local.get $y) (local.get $h)))))
            (then
              (local.set $z (call $wnd_z_get (local.get $hwnd)))
              (if (i32.or (i32.eqz (local.get $best))
                          (i32.gt_s (local.get $z) (local.get $best_z)))
                (then
                  (local.set $best (local.get $hwnd))
                  (local.set $best_z (local.get $z))))))))
      (local.set $slot (i32.add (local.get $slot) (i32.const 1)))
      (br $scan)))
    (if (local.get $best)
      (then
        (local.set $deep (call $wnd_child_from_point_deep
          (local.get $best) (local.get $arg0) (local.get $arg1)))))
    (global.set $eax
      (select (local.get $deep) (local.get $best) (local.get $deep)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12)))
  )

  ;; 403: IsRectEmpty — STUB: unimplemented
  ;; IsRectEmpty(lpRect=arg0) → BOOL. Empty iff right<=left OR bottom<=top.
  (func $handle_IsRectEmpty (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $r i32)
    (if (i32.eqz (local.get $arg0))
      (then (global.set $eax (i32.const 1))
            (global.set $esp (i32.add (global.get $esp) (i32.const 8)))
            (return)))
    (local.set $r (call $g2w (local.get $arg0)))
    (global.set $eax
      (i32.or
        (i32.le_s (load.field Rect right (local.get $r))   ;; right
                  (load.field Rect left (local.get $r)))                             ;; left
        (i32.le_s (load.field Rect bottom (local.get $r))  ;; bottom
                  (load.field Rect top (local.get $r)))))  ;; top
    (global.set $esp (i32.add (global.get $esp) (i32.const 8)))
  )

  ;; 404: EqualRect(lprc1, lprc2) → BOOL. Compares 4 LONGs (16 bytes).
  (func $handle_EqualRect (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $a i32) (local $b i32)
    (global.set $eax (i32.const 1))
    (if (i32.or (i32.eqz (local.get $arg0)) (i32.eqz (local.get $arg1)))
      (then (global.set $eax (i32.const 0)))
      (else
        (local.set $a (call $g2w (local.get $arg0)))
        (local.set $b (call $g2w (local.get $arg1)))
        (if (i32.or
              (i32.or (i32.ne (load.field Rect left (local.get $a)) (load.field Rect left (local.get $b)))
                      (i32.ne (load.field.memarg Rect top (local.get $a)) (load.field.memarg Rect top (local.get $b))))
              (i32.or (i32.ne (load.field.memarg Rect right (local.get $a)) (load.field.memarg Rect right (local.get $b)))
                      (i32.ne (load.field.memarg Rect bottom (local.get $a)) (load.field.memarg Rect bottom (local.get $b)))))
          (then (global.set $eax (i32.const 0))))))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12)))  ;; stdcall, 2 args
  )

  ;; 405: ClientToScreen
  (func $handle_ClientToScreen (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $pt i32) (local $ox i32) (local $oy i32)
    (local.set $pt (call $g2w (local.get $arg1)))
    (local.set $ox (call $wnd_client_screen_x (local.get $arg0)))
    (local.set $oy (call $wnd_client_screen_y (local.get $arg0)))
    (store.field Point x (local.get $pt)
      (i32.add (load.field Point x (local.get $pt)) (local.get $ox)))
    (store.field.memarg Point y (local.get $pt)
      (i32.add (load.field.memarg Point y (local.get $pt)) (local.get $oy)))
    (global.set $eax (i32.const 1))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12))) (return)
  )

  ;; Change this thread queue's active top-level and synchronously deliver the
  ;; documented WM_ACTIVATE pair. State changes before callbacks so a wndproc
  ;; that calls GetActiveWindow observes the new window. If the callback picks
  ;; a descendant focus itself, preserve that choice; otherwise DefWindowProc's
  ;; default is represented by moving focus to the activated top-level.
  (func $active_window_transition (param $target i32) (result i32)
    (local $previous i32) (local $old_focus i32)
    (local.set $previous (global.get $active_hwnd))
    (if (i32.and
          (i32.ne (local.get $previous) (i32.const 0))
          (i32.lt_s (call $wnd_table_find (local.get $previous)) (i32.const 0)))
      (then
        (local.set $previous (i32.const 0))
        (global.set $active_hwnd (i32.const 0))))
    (if (i32.eq (local.get $previous) (local.get $target))
      (then (return (local.get $previous))))

    (global.set $active_hwnd (local.get $target)) (call $wnd_note_active_popup (local.get $target))
    (if (local.get $previous)
      (then
        (drop (call $wnd_send_message
          (local.get $previous) (i32.const 0x0006) ;; WM_ACTIVATE
          (i32.shl (call $wnd_min_get (local.get $previous)) (i32.const 16)) ;; WA_INACTIVE
          (local.get $target)))
        (call $host_invalidate_frame (local.get $previous))))
    (if (i32.and
          (i32.ne (local.get $target) (i32.const 0))
          (i32.ge_s (call $wnd_table_find (local.get $target)) (i32.const 0)))
      (then
        (drop (call $wnd_send_message
          (local.get $target) (i32.const 0x0006) ;; WM_ACTIVATE
          (i32.or (i32.const 1) ;; WA_ACTIVE
            (i32.shl (call $wnd_min_get (local.get $target)) (i32.const 16)))
          (local.get $previous)))
        (call $host_invalidate_frame (local.get $target))))

    ;; WM_ACTIVATE's default procedure assigns focus only when the window is
    ;; not minimized. Respect an application-selected child focus established
    ;; by the activation callback itself.
    (local.set $old_focus (global.get $focus_hwnd))
    (if (i32.and
          (i32.and
            (i32.ne (local.get $target) (i32.const 0))
            (i32.eq (global.get $active_hwnd) (local.get $target)))
          (i32.and
            (i32.ge_s (call $wnd_table_find (local.get $target)) (i32.const 0))
            (i32.eqz (call $wnd_min_get (local.get $target)))))
      (then
        (if (i32.or
              (i32.eqz (local.get $old_focus))
              (i32.ne (call $wnd_top_level (local.get $old_focus)) (local.get $target)))
          (then
            (global.set $focus_hwnd (local.get $target))
            (if (i32.and
                  (i32.ne (local.get $old_focus) (i32.const 0))
                  (i32.ge_s (call $wnd_table_find (local.get $old_focus)) (i32.const 0)))
              (then
                (drop (call $wnd_send_message
                  (local.get $old_focus) (i32.const 0x0008) ;; WM_KILLFOCUS
                  (local.get $target) (i32.const 0)))))
            (drop (call $wnd_send_message
              (local.get $target) (i32.const 0x0007) ;; WM_SETFOCUS
              (local.get $old_focus) (i32.const 0))))))
      (else
        ;; Clearing this thread's active window also releases focus belonging
        ;; to the window being deactivated.
        (if (i32.and
              (i32.ne (local.get $old_focus) (i32.const 0))
              (i32.or
                (i32.eqz (local.get $previous))
                (i32.eq (call $wnd_top_level (local.get $old_focus))
                        (local.get $previous))))
          (then
            (global.set $focus_hwnd (i32.const 0))
            (if (i32.ge_s (call $wnd_table_find (local.get $old_focus)) (i32.const 0))
              (then
                (drop (call $wnd_send_message
                  (local.get $old_focus) (i32.const 0x0008) ;; WM_KILLFOCUS
                  (i32.const 0) (i32.const 0)))))))))
    (local.get $previous))

  ;; 406: SetActiveWindow(hwnd) — previous active top-level for this thread.
  (func $handle_SetActiveWindow (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.or
          (i32.lt_s (call $wnd_table_find (local.get $arg0)) (i32.const 0))
          (i32.ne (i32.and (call $wnd_get_style (local.get $arg0))
                           (i32.const 0x40000000)) (i32.const 0)))
      (then
        (global.set $eax (i32.const 0))
        (global.set $esp (i32.add (global.get $esp) (i32.const 8)))
        (return)))
    (if (i32.ne (call $wnd_get_thread (local.get $arg0))
                (global.get $current_thread_id))
      (then
        ;; USER clears the calling queue's active status when hWnd belongs to
        ;; another thread; it does not transfer ownership across queues.
        (global.set $eax (call $active_window_transition (i32.const 0))))
      (else
        (global.set $eax (call $active_window_transition (local.get $arg0)))
        (drop (call $host_activate_window (local.get $arg0)))))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8)))
  )

;; 469: ExitThread(dwExitCode) — 1 arg, no return
  (func $handle_ExitThread (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $host_exit_thread (local.get $arg0))
    (global.set $yield_reason (i32.const 2))
    (global.set $eip (i32.const 0))
    (global.set $steps (i32.const 0))
  )

  ;; 470: FindNextFileA — STUB: unimplemented
  (func $handle_FindNextFileA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; FindNextFileA(hFindFile, lpFindFileData) — 2 args
    (global.set $eax (call $host_fs_find_next_file
      (local.get $arg0) (local.get $arg1) (i32.const 0)))
    (if (i32.eqz (global.get $eax)) (then (global.set $last_error (i32.const 18)))) (global.set $esp (i32.add (global.get $esp) (i32.const 12)))
  )

  ;; 471: GetEnvironmentVariableA(lpName, lpBuffer, nSize) → chars written
  (func $handle_GetEnvironmentVariableA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $env_get (local.get $arg0) (local.get $arg1) (local.get $arg2) (i32.const 0)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 16)))
  )

  ;; GetEnvironmentVariableW(lpName, lpBuffer, nSize) — the environment core
  ;; stores one ANSI block and widens values on output, keeping A/W mutations
  ;; coherent through the existing $env_get helper.
  (func $handle_GetEnvironmentVariableW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $env_get (local.get $arg0) (local.get $arg1) (local.get $arg2) (i32.const 1)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 16)))
  )

  ;; ExpandEnvironmentStringsA(lpSrc, lpDst, nSize) -> required chars,
  ;; including the terminating NUL. Unknown variables remain verbatim.
  (func $handle_ExpandEnvironmentStringsA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $env_expand_a
      (local.get $arg0) (local.get $arg1) (local.get $arg2)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 16)))
  )

  ;; Fill OSVERSIONINFO from $winver. Both spellings share this: the struct is
  ;; identical up to szCSDVersion, which is empty either way. The W handler
  ;; used to hardcode Windows 98 instead, so an app told (via $winver) that it
  ;; was running on NT still read 4.10 back if it asked in Unicode.
  ;; winver uses GetVersion format: high word = build (bit 31: set=Win9x, clear=NT)
  ;; low word = (minor<<8)|major
  (func $version_info (param $out_g i32)
    (local $w0 i32)
    (local.set $w0 (call $g2w (local.get $out_g)))
    ;; dwMajorVersion at +4
    (i32.store (i32.add (local.get $w0) (i32.const 4))
      (i32.and (global.get $winver) (i32.const 0xFF)))
    ;; dwMinorVersion at +8
    (i32.store (i32.add (local.get $w0) (i32.const 8))
      (i32.and (i32.shr_u (global.get $winver) (i32.const 8)) (i32.const 0xFF)))
    ;; dwBuildNumber at +12 (bits 16-30, mask off platform bit)
    (i32.store (i32.add (local.get $w0) (i32.const 12))
      (i32.and (i32.shr_u (global.get $winver) (i32.const 16)) (i32.const 0x7FFF)))
    ;; dwPlatformId at +16: bit 31 set = Win9x (1), clear = NT (2)
    (i32.store (i32.add (local.get $w0) (i32.const 16))
      (if (result i32) (i32.and (global.get $winver) (i32.const 0x80000000))
        (then (i32.const 1))    ;; VER_PLATFORM_WIN32_WINDOWS
        (else (i32.const 2))))  ;; VER_PLATFORM_WIN32_NT
    ;; szCSDVersion at +20: empty string. Two zero bytes terminate it whether
    ;; the caller reads it as CHAR or WCHAR.
    (i32.store8 (i32.add (local.get $w0) (i32.const 20)) (i32.const 0))
    (i32.store8 (i32.add (local.get $w0) (i32.const 21)) (i32.const 0)))

  ;; 472: GetVersionExA — fill OSVERSIONINFOA (148 bytes min) from $winver
  (func $handle_GetVersionExA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $version_info (local.get $arg0))
    (global.set $eax (i32.const 1))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8)))
  )

  ;; InstallShield 11 dynamically asks KERNEL32 for the historical unsuffixed
  ;; GetVersionEx export. Win9x resolves that spelling to the ANSI contract.
  (func $handle_GetVersionEx (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $version_info (local.get $arg0))
    (global.set $eax (i32.const 1))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8)))
  )

  ;; 473: SetConsoleCtrlHandler(HandlerRoutine, Add) → BOOL
  (func $handle_SetConsoleCtrlHandler (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax
      (call $console_ctrl_handler_set (local.get $arg0) (local.get $arg1)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12))))

  ;; 474: SetEnvironmentVariableW(lpName, lpValue) → BOOL
  (func $handle_SetEnvironmentVariableW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $env_set (local.get $arg0) (local.get $arg1) (i32.const 1)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12))))

  ;; CompareString core, shared by both spellings: the comparison rules are the
  ;; same, only the character stride differs. $p1/$p2 are WASM addresses,
  ;; lengths are in characters and -1 means "NUL-terminated". Returns
  ;; CSTR_LESS_THAN(1), CSTR_EQUAL(2), CSTR_GREATER_THAN(3).
  (func $compare_string (param $flags i32) (param $p1 i32) (param $len1 i32)
                        (param $p2 i32) (param $len2 i32) (param $wide i32) (result i32)
    (local $i i32) (local $c1 i32) (local $c2 i32) (local $minlen i32) (local $step i32)
    (local.set $step (select (i32.const 2) (i32.const 1) (local.get $wide)))
    (if (i32.eq (local.get $len1) (i32.const -1))
      (then (local.set $len1 (select
        (call $strlen_w (local.get $p1)) (call $strlen_a (local.get $p1)) (local.get $wide)))))
    (if (i32.eq (local.get $len2) (i32.const -1))
      (then (local.set $len2 (select
        (call $strlen_w (local.get $p2)) (call $strlen_a (local.get $p2)) (local.get $wide)))))
    (local.set $minlen (select (local.get $len1) (local.get $len2) (i32.lt_u (local.get $len1) (local.get $len2))))
    (block $cmp_done (loop $cmp
      (br_if $cmp_done (i32.ge_u (local.get $i) (local.get $minlen)))
      (local.set $c1 (call $load_char
        (i32.add (local.get $p1) (i32.mul (local.get $i) (local.get $step))) (local.get $wide)))
      (local.set $c2 (call $load_char
        (i32.add (local.get $p2) (i32.mul (local.get $i) (local.get $step))) (local.get $wide)))
      ;; NORM_IGNORECASE (flag 1): uppercase both
      (if (i32.and (local.get $flags) (i32.const 1))
        (then
          (if (i32.and (i32.ge_u (local.get $c1) (i32.const 97)) (i32.le_u (local.get $c1) (i32.const 122)))
            (then (local.set $c1 (i32.sub (local.get $c1) (i32.const 32)))))
          (if (i32.and (i32.ge_u (local.get $c2) (i32.const 97)) (i32.le_u (local.get $c2) (i32.const 122)))
            (then (local.set $c2 (i32.sub (local.get $c2) (i32.const 32)))))))
      (if (i32.lt_u (local.get $c1) (local.get $c2)) (then (return (i32.const 1))))
      (if (i32.gt_u (local.get $c1) (local.get $c2)) (then (return (i32.const 3))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $cmp)))
    ;; Common prefix: the shorter string sorts first.
    (select (i32.const 1) (select (i32.const 3) (i32.const 2)
      (i32.gt_u (local.get $len1) (local.get $len2)))
      (i32.lt_u (local.get $len1) (local.get $len2))))

  ;; One character at a WASM address, ANSI or wide.
  (func $load_char (param $p i32) (param $wide i32) (result i32)
    (if (local.get $wide) (then (return (i32.load16_u (local.get $p)))))
    (i32.load8_u (local.get $p)))

  ;; 475: CompareStringA(Locale, dwCmpFlags, lpString1, cchCount1, lpString2, cchCount2) → int
  (func $handle_CompareStringA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; arg4 = lpString2, cchCount2 (6th arg) is still on the guest stack at esp+24
    (global.set $eax (call $compare_string (local.get $arg1)
      (call $g2w (local.get $arg2)) (local.get $arg3)
      (call $g2w (local.get $arg4)) (call $gl32 (i32.add (global.get $esp) (i32.const 24)))
      (i32.const 0)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 28))))

  ;; 476: CompareStringW — same comparison, wide characters
  (func $handle_CompareStringW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $compare_string (local.get $arg1)
      (call $g2w (local.get $arg2)) (local.get $arg3)
      (call $g2w (local.get $arg4)) (call $gl32 (i32.add (global.get $esp) (i32.const 24)))
      (i32.const 1)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 28))))

  ;; 477: IsValidLocale(Locale, dwFlags) → BOOL
  (func $handle_IsValidLocale (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (i32.const 1))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12))))

  ;; Invoke one ANSI string enumeration callback and free its temporary buffer
  ;; after the callback returns through CACA0011. The SYS1 typed context keeps
  ;; this distinct from the older saved-return-only users of that thunk.
  (func $system_string_enum_a (param $callback i32) (param $value i32)
        (param $ret_addr i32)
    (local $text i32) (local $wa i32) (local $len i32)
    (if (i32.eqz (local.get $callback))
      (then
        (global.set $eax (i32.const 0))
        (global.set $eip (local.get $ret_addr))
        (return)))
    (local.set $len (call $strlen_a (local.get $value)))
    (local.set $text (call $heap_alloc (i32.add (local.get $len) (i32.const 1))))
    (if (i32.eqz (local.get $text))
      (then
        (global.set $eax (i32.const 0))
        (global.set $eip (local.get $ret_addr))
        (return)))
    (local.set $wa (call $g2w (local.get $text)))
    (memory.copy (local.get $wa) (local.get $value) (i32.add (local.get $len) (i32.const 1)))
    ;; Context after the callback's RET 4: marker, allocation, API return.
    (global.set $esp (i32.sub (global.get $esp) (i32.const 4)))
    (call $gs32 (global.get $esp) (local.get $ret_addr))
    (global.set $esp (i32.sub (global.get $esp) (i32.const 4)))
    (call $gs32 (global.get $esp) (local.get $text))
    (global.set $esp (i32.sub (global.get $esp) (i32.const 4)))
    (call $gs32 (global.get $esp) (i32.const 0x31535953)) ;; "SYS1"
    (global.set $esp (i32.sub (global.get $esp) (i32.const 4)))
    (call $gs32 (global.get $esp) (local.get $text))
    (global.set $esp (i32.sub (global.get $esp) (i32.const 4)))
    (call $gs32 (global.get $esp) (global.get $font_enum_ret_thunk))
    (global.set $eip (local.get $callback))
    (global.set $steps (i32.const 0)))

  ;; 478: EnumSystemLocalesA(lpLocaleEnumProc, dwFlags) → BOOL. This
  ;; compatibility layer exposes one stable US-English system locale.
  (func $handle_EnumSystemLocalesA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $ret i32) (local $value i32)
    (local.set $ret (call $gl32 (global.get $esp)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12)))
    (local.set $value (i32.const 0x2DA))
    (i32.store (local.get $value) (i32.const 0x30303030))
    (i32.store offset=4 (local.get $value) (i32.const 0x39303430))
    (i32.store8 offset=8 (local.get $value) (i32.const 0))
    (call $system_string_enum_a (local.get $arg0) (local.get $value) (local.get $ret)))

  ;; 479: GetLocaleInfoW(Locale, LCType, lpLCData, cchData) → chars written.
  ;; Same values as the A spelling, written as UTF-16 — see $locale_info.
  (func $handle_GetLocaleInfoW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $locale_info
      (local.get $arg1) (local.get $arg2) (local.get $arg3) (i32.const 1)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 20))))

  ;; 480: GetTimeZoneInformation(lpTZI) — zero-fill 172-byte struct, return TIME_ZONE_ID_UNKNOWN (0)
  (func $handle_GetTimeZoneInformation (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $wa i32)
    (local.set $wa (call $g2w (local.get $arg0)))
    ;; Zero-fill 172 bytes
    (memory.fill (local.get $wa) (i32.const 0) (i32.const 172))
    (global.set $eax (i32.const 0))  ;; TIME_ZONE_ID_UNKNOWN
    (global.set $esp (i32.add (global.get $esp) (i32.const 8)))  ;; stdcall, 1 arg
  )

  ;; Win98 KERNEL32 ordinal 99 (ordinal-only, native RVA 0x1e260).
  ;; This is the internal timezone-cache classifier used by Explorer, not the
  ;; public GetTimeZoneInformation API.  The guest has no modeled daylight
  ;; transition, so it is always in standard time after the optional refresh.
  (func $handle_KERNEL32_Ordinal99 (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (i32.const 1)) ;; TIME_ZONE_ID_STANDARD
    (global.set $esp (i32.add (global.get $esp) (i32.const 8))) ;; ret 4
  )

  ;; 481: SetEnvironmentVariableA(lpName, lpValue) → BOOL
  (func $handle_SetEnvironmentVariableA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $env_set (local.get $arg0) (local.get $arg1) (i32.const 0)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12)))
  )

  ;; 482: Beep — STUB: unimplemented
  (func $handle_Beep (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $crash_unimplemented (local.get $name_ptr))
  )

  ;; 483: GetDiskFreeSpace{A,W}(lpRoot, lpSectorsPerCluster, lpBytesPerSector,
  ;; lpFreeClusters, lpTotalClusters). What the root names decides the answer:
  ;; a mounted CD-ROM reports Win98 CDFS geometry — 2048-byte sectors, one
  ;; sector per cluster, nothing free, and the disc's own block count — because
  ;; era CD checks read exactly these numbers (Diablo XOR-folds BytesPerSector
  ;; with the drive type and the filesystem name and compares the fold against
  ;; a constant, so 512-byte sectors here read as "not a CD"). Anything else is
  ;; the fixed disk: just under 1GB free of just under 2GB at 8 sectors/cluster,
  ;; 512 bytes/sector. Keep both byte products below INT32_MAX: some Win95-era
  ;; installers multiply this legacy geometry with signed 32-bit arithmetic.
  (func $disk_free_space (param $root i32) (param $spc i32) (param $bps i32)
                         (param $free i32) (param $total i32) (param $wide i32)
    (local $root_wa i32)
    (local.set $root_wa
      (if (result i32) (local.get $root)
        (then (call $g2w (local.get $root)))
        (else (i32.const 0))))
    (if (i32.eq (call $host_fs_drive_type (local.get $root_wa) (local.get $wide))
                (i32.const 5)) ;; DRIVE_CDROM
      (then
        (if (local.get $spc) (then (call $gs32 (local.get $spc) (i32.const 1))))
        (if (local.get $bps) (then (call $gs32 (local.get $bps) (i32.const 2048))))
        (if (local.get $free) (then (call $gs32 (local.get $free) (i32.const 0))))
        (if (local.get $total)
          (then (call $gs32 (local.get $total)
            (call $host_fs_volume_size (local.get $root_wa) (local.get $wide))))))
      (else
        (if (local.get $spc) (then (call $gs32 (local.get $spc) (i32.const 8))))
        (if (local.get $bps) (then (call $gs32 (local.get $bps) (i32.const 512))))
        (if (local.get $free) (then (call $gs32 (local.get $free) (i32.const 262143))))
        (if (local.get $total) (then (call $gs32 (local.get $total) (i32.const 524287)))))))

  (func $handle_GetDiskFreeSpaceA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $disk_free_space (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (i32.const 0))
    (global.set $eax (i32.const 1))
    (global.set $esp (i32.add (global.get $esp) (i32.const 24)))  ;; stdcall, 5 args
  )

  ;; 484: GetLogicalDrives() — one bit per currently assigned drive letter.
  (func $handle_GetLogicalDrives (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $host_fs_logical_drive_mask))
    (global.set $esp (i32.add (global.get $esp) (i32.const 4)))  ;; stdcall, 0 args
  )

  ;; GetLogicalDriveStringsA/W returns each assigned root plus one final NUL.
  ;; The required size includes that final NUL; a successful return excludes it.
  (func $logical_drive_strings
        (param $length i32) (param $buffer_g i32) (param $wide i32) (result i32)
    (local $mask i32) (local $letter i32) (local $count i32)
    (local $required i32) (local $buf i32) (local $out i32) (local $stride i32)
    (local.set $mask (call $host_fs_logical_drive_mask))
    (local.set $letter (i32.const 0))
    (block $count_done (loop $count_loop
      (br_if $count_done (i32.ge_u (local.get $letter) (i32.const 26)))
      (if (i32.and (local.get $mask) (i32.shl (i32.const 1) (local.get $letter)))
        (then (local.set $count (i32.add (local.get $count) (i32.const 1)))))
      (local.set $letter (i32.add (local.get $letter) (i32.const 1)))
      (br $count_loop)))
    (local.set $required (i32.add (i32.mul (local.get $count) (i32.const 4)) (i32.const 1)))
    (if (i32.lt_u (local.get $length) (local.get $required))
      (then (return (local.get $required))))
    (if (i32.eqz (local.get $buffer_g))
      (then
        (global.set $last_error (i32.const 87)) ;; ERROR_INVALID_PARAMETER
        (return (i32.const 0))))
    (local.set $buf (call $g2w (local.get $buffer_g)))
    (local.set $stride (select (i32.const 2) (i32.const 1) (local.get $wide)))
    (local.set $letter (i32.const 0))
    (block $write_done (loop $write_loop
      (br_if $write_done (i32.ge_u (local.get $letter) (i32.const 26)))
      (if (i32.and (local.get $mask) (i32.shl (i32.const 1) (local.get $letter)))
        (then
          (if (local.get $wide)
            (then
              (i32.store16 (i32.add (local.get $buf) (local.get $out))
                (i32.add (i32.const 0x41) (local.get $letter)))
              (i32.store16 (i32.add (local.get $buf) (i32.add (local.get $out) (i32.const 2))) (i32.const 0x3A))
              (i32.store16 (i32.add (local.get $buf) (i32.add (local.get $out) (i32.const 4))) (i32.const 0x5C))
              (i32.store16 (i32.add (local.get $buf) (i32.add (local.get $out) (i32.const 6))) (i32.const 0)))
            (else
              (i32.store8 (i32.add (local.get $buf) (local.get $out))
                (i32.add (i32.const 0x41) (local.get $letter)))
              (i32.store8 (i32.add (local.get $buf) (i32.add (local.get $out) (i32.const 1))) (i32.const 0x3A))
              (i32.store8 (i32.add (local.get $buf) (i32.add (local.get $out) (i32.const 2))) (i32.const 0x5C))
              (i32.store8 (i32.add (local.get $buf) (i32.add (local.get $out) (i32.const 3))) (i32.const 0))))
          (local.set $out (i32.add (local.get $out) (i32.mul (i32.const 4) (local.get $stride))))))
      (local.set $letter (i32.add (local.get $letter) (i32.const 1)))
      (br $write_loop)))
    (if (local.get $wide)
      (then (i32.store16 (i32.add (local.get $buf) (local.get $out)) (i32.const 0)))
      (else (i32.store8 (i32.add (local.get $buf) (local.get $out)) (i32.const 0))))
    (i32.sub (local.get $required) (i32.const 1)))

  (func $handle_GetLogicalDriveStringsA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $logical_drive_strings (local.get $arg0) (local.get $arg1) (i32.const 0)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12)))  ;; stdcall, 2 args
  )

  (func $handle_GetLogicalDriveStringsW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $logical_drive_strings (local.get $arg0) (local.get $arg1) (i32.const 1)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12)))
  )

  ;; GetKeyboardType(nTypeFlag) → int. Enhanced 101/102-key (type 4, 12 func keys).
  ;; nTypeFlag: 0=type, 1=subtype, 2=num func keys. We report type=4, subtype=0, keys=12.
  (func $handle_GetKeyboardType (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax
      (select (i32.const 12)
        (select (i32.const 0) (i32.const 4) (i32.eq (local.get $arg0) (i32.const 1)))
        (i32.eq (local.get $arg0) (i32.const 2))))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8)))  ;; stdcall, 1 arg
  )

  ;; GetKeyboardLayout(idThread) → HKL. Return US English (0x04090409, device+lang both en-US).
  (func $handle_GetKeyboardLayout (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (i32.const 0x04090409))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8)))  ;; stdcall, 1 arg
  )

  ;; CreateIconFromResourceEx(presbits, dwResSize, fIcon, dwVer, cx, cy, Flags)
  ;; — 7 args. Decode the packed RT_ICON/RT_CURSOR bytes into an owned
  ;; CURSOR_TABLE object, preserving Win9x LOCALHEADER hotspots and requested
  ;; sizing. The handle then works with SetCursor, GetIconInfo and DestroyIcon.
  (func $handle_CreateIconFromResourceEx (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $cursor_create_from_resource
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3)
      (local.get $arg4)
      (call $gl32 (i32.add (global.get $esp) (i32.const 24)))
      (call $gl32 (i32.add (global.get $esp) (i32.const 28)))))
    (if (global.get $eax)
      (then (global.set $last_error (i32.const 0)))
      (else (global.set $last_error (i32.const 13)))) ;; ERROR_INVALID_DATA
    (global.set $esp (i32.add (global.get $esp) (i32.const 32)))
  )

  ;; LookupIconIdFromDirectoryEx(presbits, fIcon, cxDesired, cyDesired, Flags)
  ;; selects an RT_ICON/RT_CURSOR id from a packed GRPICONDIR. SHELL32 uses
  ;; this while reopening shell32.dll's authentic group-icon resources; the
  ;; returned WORD is a resource id, not an HICON. Prefer the closest geometry
  ;; and, for equally sized images, the greatest available color depth.
  (func $handle_LookupIconIdFromDirectoryEx (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $count i32) (local $i i32) (local $entry i32)
    (local $want_w i32) (local $want_h i32) (local $w i32) (local $h i32)
    (local $dw i32) (local $dh i32) (local $score i32) (local $best_score i32)
    (local $bpp i32) (local $best_bpp i32) (local $best_id i32)
    (local.set $best_score (i32.const 0x7fffffff))
    (if (i32.or (i32.eqz (local.get $arg0))
          (i32.ne (call $gl16 (local.get $arg0)) (i32.const 0)))
      (then
        (global.set $eax (i32.const 0))
        (global.set $esp (i32.add (global.get $esp) (i32.const 24)))
        (return)))
    (if (i32.or
          (i32.and (local.get $arg1)
            (i32.ne (call $gl16 (i32.add (local.get $arg0) (i32.const 2)))
                    (i32.const 1)))
          (i32.and (i32.eqz (local.get $arg1))
            (i32.ne (call $gl16 (i32.add (local.get $arg0) (i32.const 2)))
                    (i32.const 2))))
      (then
        (global.set $eax (i32.const 0))
        (global.set $esp (i32.add (global.get $esp) (i32.const 24)))
        (return)))
    (local.set $count (call $gl16 (i32.add (local.get $arg0) (i32.const 4))))
    (local.set $want_w (local.get $arg2))
    (local.set $want_h (local.get $arg3))
    (if (i32.eqz (local.get $want_w)) (then (local.set $want_w (i32.const 32))))
    (if (i32.eqz (local.get $want_h)) (then (local.set $want_h (i32.const 32))))
    (local.set $entry (i32.add (local.get $arg0) (i32.const 6)))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (local.get $count)))
      (local.set $w (call $gl8 (local.get $entry)))
      (local.set $h (call $gl8 (i32.add (local.get $entry) (i32.const 1))))
      ;; ICO encodes 256 pixels as a zero byte.
      (if (i32.eqz (local.get $w)) (then (local.set $w (i32.const 256))))
      (if (i32.eqz (local.get $h)) (then (local.set $h (i32.const 256))))
      (local.set $bpp (call $gl16 (i32.add (local.get $entry) (i32.const 6))))
      (local.set $dw (i32.sub (local.get $w) (local.get $want_w)))
      (if (i32.lt_s (local.get $dw) (i32.const 0))
        (then (local.set $dw (i32.sub (i32.const 0) (local.get $dw)))))
      (local.set $dh (i32.sub (local.get $h) (local.get $want_h)))
      (if (i32.lt_s (local.get $dh) (i32.const 0))
        (then (local.set $dh (i32.sub (i32.const 0) (local.get $dh)))))
      (local.set $score (i32.add (local.get $dw) (local.get $dh)))
      (if (i32.or
            (i32.lt_u (local.get $score) (local.get $best_score))
            (i32.and (i32.eq (local.get $score) (local.get $best_score))
                     (i32.gt_u (local.get $bpp) (local.get $best_bpp))))
        (then
          (local.set $best_score (local.get $score))
          (local.set $best_bpp (local.get $bpp))
          (local.set $best_id (call $gl16
            (i32.add (local.get $entry) (i32.const 12))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (local.set $entry (i32.add (local.get $entry) (i32.const 14)))
      (br $scan)))
    (global.set $eax (local.get $best_id))
    (global.set $esp (i32.add (global.get $esp) (i32.const 24)))
  )

  ;; LoadKeyboardLayoutA(pwszKLID, Flags) — pretend the requested layout was activated.
  (func $handle_LoadKeyboardLayoutA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (i32.const 0x04090409))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12)))
  )

  ;; GetKeyboardLayoutNameA(pwszKLID) — write 9-byte ASCIIZ "00000409" (US English) and return TRUE.
  (func $handle_GetKeyboardLayoutNameA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $p i32)
    (if (i32.eqz (local.get $arg0))
      (then (global.set $eax (i32.const 0))
            (global.set $esp (i32.add (global.get $esp) (i32.const 8))) (return)))
    (local.set $p (call $g2w (local.get $arg0)))
    (i32.store (local.get $p) (i32.const 0x30303030))         ;; "0000"
    (i32.store offset=4 (local.get $p) (i32.const 0x39303430)) ;; "0409"
    (i32.store8 offset=8 (local.get $p) (i32.const 0))
    (global.set $eax (i32.const 1))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8)))
  )

  ;; GetKeyboardLayoutList(nBuff, lpList) — report one layout (US English).
  ;; If lpList non-NULL and nBuff>=1, write HKL 0x04090409. Return total count (1).
  (func $handle_GetKeyboardLayoutList (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.and (i32.ne (local.get $arg1) (i32.const 0)) (i32.ge_s (local.get $arg0) (i32.const 1)))
      (then (i32.store (call $g2w (local.get $arg1)) (i32.const 0x04090409))))
    (global.set $eax (i32.const 1))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12)))
  )

  ;; GetTextCharacterExtra(hdc) → int. Inter-character spacing (0 = default).
  (func $handle_GetTextCharacterExtra (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $gdi_dc_aux_get (local.get $arg0) (i32.const 20) (i32.const 0)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8)))  ;; stdcall, 1 arg
  )

  ;; 485: GetFileAttributesA — STUB: unimplemented
  (func $handle_GetFileAttributesA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $attrs i32)
    ;; GetFileAttributesA(lpFileName) — 1 arg
    (local.set $attrs (call $host_fs_get_file_attributes
      (call $g2w (local.get $arg0)) (i32.const 0)))
    (global.set $eax (local.get $attrs))
    (if (i32.eq (local.get $attrs) (i32.const -1))
      (then (global.set $last_error (i32.const 2)))) ;; ERROR_FILE_NOT_FOUND
    (global.set $esp (i32.add (global.get $esp) (i32.const 8)))
  )

  ;; 486: GetCurrentDirectoryA — STUB: unimplemented
  (func $handle_GetCurrentDirectoryA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; GetCurrentDirectoryA(nBufferLength, lpBuffer) — 2 args
    (global.set $eax (call $host_fs_get_current_directory
      (local.get $arg0) (local.get $arg1) (i32.const 0)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12)))
  )

  ;; 487: SetCurrentDirectoryA — STUB: unimplemented
  (func $handle_SetCurrentDirectoryA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; SetCurrentDirectoryA(lpPathName) — 1 arg
    (global.set $eax (call $host_fs_set_current_directory
      (call $g2w (local.get $arg0)) (i32.const 0)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8)))
  )

  ;; 488: SetFileAttributesA — STUB: unimplemented
  (func $handle_SetFileAttributesA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; SetFileAttributesA(lpFileName, dwFileAttributes) — 2 args
    (global.set $eax (call $host_fs_set_file_attributes
      (call $g2w (local.get $arg0)) (local.get $arg1) (i32.const 0)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12)))
  )

  ;; 489: GetFullPathNameA — STUB: unimplemented
  (func $handle_GetFullPathNameA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; GetFullPathNameA(lpFileName, nBufferLength, lpBuffer, lpFilePart) — 4 args
    (global.set $eax (call $host_fs_get_full_path_name
      (call $g2w (local.get $arg0)) (local.get $arg1) (local.get $arg2) (local.get $arg3) (i32.const 0)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 20)))
  )

  ;; GetDriveType{A,W}(lpRootPathName). The Win98 environment advertises only
  ;; fixed C: and CD-ROM D:. Installers enumerate letters independently of
  ;; GetLogicalDrives, so reporting every other letter as fixed makes them pick
  ;; the nonexistent A: drive as their default destination.
  ;; A mounted volume owns its letter, so ask the host before falling back to
  ;; that built-in map: an ISO mounted at D:\ reports DRIVE_CDROM from its own
  ;; mount record, and a mount at any other letter is answered too. 0 means no
  ;; mount claims the letter.
  (func $drive_type (param $root_g i32) (param $wide i32) (result i32)
    (local $drive i32) (local $mounted i32)
    (local.set $mounted (call $host_fs_drive_type
      (if (result i32) (local.get $root_g)
        (then (call $g2w (local.get $root_g)))
        (else (i32.const 0)))
      (local.get $wide)))
    (if (local.get $mounted) (then (return (local.get $mounted))))
    (if (i32.eqz (local.get $root_g)) (then (return (i32.const 3))))
    (if (i32.ne
          (call $gl_char
            (i32.add (local.get $root_g)
              (select (i32.const 2) (i32.const 1) (local.get $wide)))
            (local.get $wide))
          (i32.const 0x3A))
      (then (return (i32.const 1)))) ;; DRIVE_NO_ROOT_DIR
    (local.set $drive
      (i32.and (call $gl_char (local.get $root_g) (local.get $wide))
        (i32.const 0xDF)))
    (if (i32.eq (local.get $drive) (i32.const 0x43))
      (then (return (i32.const 3)))) ;; DRIVE_FIXED
    (if (i32.eq (local.get $drive) (i32.const 0x44))
      (then (return (i32.const 5)))) ;; DRIVE_CDROM
    (i32.const 1)) ;; DRIVE_NO_ROOT_DIR

  (func $handle_GetDriveTypeA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $drive_type (local.get $arg0) (i32.const 0)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8)))  ;; stdcall, 1 arg
  )

  ;; 491: GetCurrentProcessId — return this emulated process's stable PID
  (func $handle_GetCurrentProcessId (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $current_process_id))
    (global.set $esp (i32.add (global.get $esp) (i32.const 4)))
  )

  ;; 492: CreateDirectoryA — STUB: unimplemented
  (func $handle_CreateDirectoryA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $path_wa i32)
    (local.set $path_wa (call $g2w (local.get $arg0)))
    ;; CreateDirectoryA(lpPathName, lpSecurityAttributes) — 2 args
    (global.set $eax (call $host_fs_create_directory
      (local.get $path_wa) (i32.const 0)))
    (if (global.get $eax)
      (then (global.set $last_error (i32.const 0)))
      (else
        (global.set $last_error
          (if (result i32)
            (i32.ne (call $host_fs_get_file_attributes
              (local.get $path_wa) (i32.const 0)) (i32.const -1))
            (then (i32.const 183)) ;; ERROR_ALREADY_EXISTS
            (else (i32.const 5)))))) ;; ERROR_ACCESS_DENIED
    (global.set $esp (i32.add (global.get $esp) (i32.const 12)))
  )

  ;; 493: RemoveDirectoryA — STUB: unimplemented
  (func $handle_RemoveDirectoryA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; RemoveDirectoryA(lpPathName) — 1 arg
    (global.set $eax (call $host_fs_remove_directory
      (call $g2w (local.get $arg0)) (i32.const 0)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8)))
  )

  ;; 494: SetCurrentDirectoryW — STUB: unimplemented
  (func $handle_SetCurrentDirectoryW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; SetCurrentDirectoryW(lpPathName) — 1 arg
    (global.set $eax (call $host_fs_set_current_directory
      (call $g2w (local.get $arg0)) (i32.const 1)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8)))
  )

  ;; 495: RemoveDirectoryW — STUB: unimplemented
  (func $handle_RemoveDirectoryW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; RemoveDirectoryW(lpPathName) — 1 arg
    (global.set $eax (call $host_fs_remove_directory
      (call $g2w (local.get $arg0)) (i32.const 1)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8)))
  )

  ;; 496: GetDriveTypeW — Unicode counterpart of GetDriveTypeA.
  (func $handle_GetDriveTypeW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $drive_type (local.get $arg0) (i32.const 1)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8)))
  )

  ;; 497: MoveFileA — STUB: unimplemented
  (func $handle_MoveFileA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; MoveFileA(lpExistingFileName, lpNewFileName) — 2 args
    (global.set $eax (call $host_fs_move_file
      (call $g2w (local.get $arg0)) (call $g2w (local.get $arg1)) (i32.const 0)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12)))
  )

  ;; 498: GetExitCodeProcess — STUB: unimplemented
  (func $handle_GetExitCodeProcess (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (local.get $arg1)
      (then (call $gs32 (local.get $arg1)
        (if (result i32)
          (i32.eq (local.get $arg0)
            (i32.or (i32.const 0x000E2000)
              (i32.and (call $current_process_id) (i32.const 0xFFF))))
          (then (i32.const 259))  ;; STILL_ACTIVE
          (else (i32.const 0))))))
    (global.set $eax (i32.const 1))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12))) ;; stdcall, 2 args
  )

  ;; 499: CreateProcessA — STUB: unimplemented
  (func $handle_CreateProcessA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $pi i32) (local $launch_file i32) (local $launch_dir i32) (local $launch_result i32)
    ;; Browser hosts can chain-launch an EXE from the caller's VFS through the
    ;; same handoff ShellExecute uses. Headless hosts keep returning success,
    ;; which models the launch boundary for installer extraction tests.
    (local.set $launch_file (if (result i32) (local.get $arg0)
      (then (local.get $arg0))
      (else (local.get $arg1))))
    (local.set $launch_dir (call $gl32 (i32.add (global.get $esp) (i32.const 32))))
    (if (i32.eqz (local.get $launch_file))
      (then
        (global.set $last_error (i32.const 2)) ;; ERROR_FILE_NOT_FOUND
        (global.set $eax (i32.const 0))
        (global.set $esp (i32.add (global.get $esp) (i32.const 44)))
        (return)))
    (local.set $launch_result (call $host_shell_execute
      (i32.const 0) (i32.const 0)
      (call $g2w (local.get $launch_file))
      (i32.const 0)
      (if (result i32) (local.get $launch_dir) (then (call $g2w (local.get $launch_dir))) (else (i32.const 0)))
      (i32.const 1)))
    (if (i32.le_u (local.get $launch_result) (i32.const 32))
      (then
        (global.set $last_error
          (if (result i32) (local.get $launch_result)
            (then (local.get $launch_result))
            (else (i32.const 2))))
        (global.set $eax (i32.const 0))
        (global.set $esp (i32.add (global.get $esp) (i32.const 44)))
        (return)))
    (local.set $pi (call $gl32 (i32.add (global.get $esp) (i32.const 40))))
    (if (local.get $pi)
      (then
        (call $gs32 (local.get $pi) (i32.const 0x000E3001))       ;; hProcess
        (call $gs32 (i32.add (local.get $pi) (i32.const 4)) (i32.const 0x000E3002)) ;; hThread
        (call $gs32 (i32.add (local.get $pi) (i32.const 8)) (i32.const 0x3001))     ;; dwProcessId
        (call $gs32 (i32.add (local.get $pi) (i32.const 12)) (i32.const 0x3002))))  ;; dwThreadId
    (drop (local.get $arg0))
    (drop (local.get $arg1))
    (drop (local.get $arg2))
    (drop (local.get $arg3))
    (drop (local.get $arg4))
    (drop (local.get $name_ptr))
    (global.set $last_error (i32.const 0))
    (global.set $eax (i32.const 1))
    (global.set $esp (i32.add (global.get $esp) (i32.const 44))) ;; stdcall, 10 args
  )

  ;; WinExec(lpCmdLine, uCmdShow) — legacy launcher. Pinball's Options →
  ;; Select Table and Win9x installers expect a real child-launch attempt.
  ;; Mark this call so the browser host applies WinExec parsing/error rules.
  (func $handle_WinExec (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $host_shell_execute
      (i32.const 0) (local.get $name_ptr)
      (if (result i32) (local.get $arg0) (then (call $g2w (local.get $arg0))) (else (i32.const 0)))
      (i32.const 0) (i32.const 0) (local.get $arg1)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12)))
  )

  ;; 500: CreateProcessW — STUB: unimplemented
  (func $handle_CreateProcessW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $app i32) (local $cmd i32) (local $dir i32) (local $dir_w i32)
    (local.set $app (call $shellexec_narrow_w (local.get $arg0)))
    (local.set $cmd (call $shellexec_narrow_w (local.get $arg1)))
    (local.set $dir_w (call $gl32 (i32.add (global.get $esp) (i32.const 32))))
    (local.set $dir (call $shellexec_narrow_w (local.get $dir_w)))
    (if (local.get $dir)
      (then (call $gs32 (i32.add (global.get $esp) (i32.const 32)) (local.get $dir))))
    (call $handle_CreateProcessA
      (local.get $app) (local.get $cmd) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
    (if (local.get $app) (then (call $heap_free (local.get $app))))
    (if (local.get $cmd) (then (call $heap_free (local.get $cmd))))
    (if (local.get $dir) (then (call $heap_free (local.get $dir))))
  )

  ;; 501: HeapValidate — STUB: unimplemented
  (func $handle_HeapValidate (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $crash_unimplemented (local.get $name_ptr))
  )

  ;; 502: HeapCompact — STUB: unimplemented
  (func $handle_HeapCompact (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $crash_unimplemented (local.get $name_ptr))
  )

  ;; 503: HeapWalk — STUB: unimplemented
  (func $handle_HeapWalk (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $crash_unimplemented (local.get $name_ptr))
  )

  ;; HeapSetInformation(hHeap, HeapInformationClass, HeapInformation, HeapInformationLength)
  ;; Win9x-era heaps have no LFH mode to apply. Accept recognized heap handles so
  ;; modern VC runtimes can continue after their compatibility probe.
  (func $handle_HeapSetInformation (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.eqz (call $heap_api_handle_valid (local.get $arg0)))
      (then
        (global.set $last_error (i32.const 6)) ;; ERROR_INVALID_HANDLE
        (global.set $eax (i32.const 0))
        (global.set $esp (i32.add (global.get $esp) (i32.const 20)))
        (return)))
    (global.set $eax (i32.const 1))
    (global.set $esp (i32.add (global.get $esp) (i32.const 20)))
  )

  ;; 504: ReadConsoleA(hConsole, lpBuffer, nCharsToRead, lpCharsRead, lpReserved) → BOOL
  ;; Blocks on the console input queue; see $console_read.
  (func $handle_ReadConsoleA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (call $console_read (local.get $arg1) (local.get $arg2) (local.get $arg3) (i32.const 0))
      (then (return)))
    (global.set $eax (i32.const 1))
    (global.set $esp (i32.add (global.get $esp) (i32.const 24))))

  ;; 505: SetConsoleMode(hConsole, dwMode) → BOOL
  (func $handle_SetConsoleMode (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $console_mode (local.get $arg1))
    (call $console_input_set_mode (local.get $arg1))
    (global.set $eax (i32.const 1))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12))))

  ;; 506: GetConsoleMode(hConsole, lpMode) → BOOL
  (func $handle_GetConsoleMode (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (i32.store (call $g2w (local.get $arg1)) (call $console_input_mode))
    (global.set $eax (i32.const 1))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12))))

  ;; 507: WriteConsoleA — delegates to console buffer write
  (func $handle_WriteConsoleA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $console_write
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (i32.const 0)))
    (if (i32.and (global.get $eax) (i32.ne (local.get $arg3) (i32.const 0)))
      (then (i32.store (call $g2w (local.get $arg3)) (local.get $arg2))))
    (if (i32.eqz (global.get $eax))
      (then (global.set $last_error (i32.const 6))))
    (global.set $esp (i32.add (global.get $esp) (i32.const 24))))

  ;; 508: GetFileInformationByHandle(hFile, lpFileInformation) → BOOL
  ;; Populate the stable fields exposed by the in-memory VFS. Timestamps are
  ;; synthetic (as in GetFileTime), while file size and handle validity come
  ;; from the host so callers can distinguish real VFS files from bad handles.
  (func $handle_GetFileInformationByHandle (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $info i32) (local $size i32)
    (if (i32.eqz (local.get $arg1))
      (then
        (global.set $eax (i32.const 0))
        (global.set $esp (i32.add (global.get $esp) (i32.const 12)))
        (return)))
    (local.set $size (call $host_fs_get_file_size (local.get $arg0)))
    (if (i32.eq (local.get $size) (i32.const -1))
      (then
        (global.set $eax (i32.const 0))
        (global.set $esp (i32.add (global.get $esp) (i32.const 12)))
        (return)))
    (local.set $info (call $g2w (local.get $arg1)))
    (i32.store offset=0 (local.get $info) (i32.const 0x20))       ;; FILE_ATTRIBUTE_ARCHIVE
    (i32.store offset=4 (local.get $info) (i32.const 0x256D4000)) ;; creation FILETIME low
    (i32.store offset=8 (local.get $info) (i32.const 0x01BF53EB)) ;; creation FILETIME high
    (i32.store offset=12 (local.get $info) (i32.const 0x256D4000))
    (i32.store offset=16 (local.get $info) (i32.const 0x01BF53EB))
    (i32.store offset=20 (local.get $info) (i32.const 0x256D4000))
    (i32.store offset=24 (local.get $info) (i32.const 0x01BF53EB))
    (i32.store offset=28 (local.get $info) (i32.const 0x57415458)) ;; stable volume serial, "WATX"
    (i32.store offset=32 (local.get $info) (i32.const 0))         ;; file size high
    (i32.store offset=36 (local.get $info) (local.get $size))
    (i32.store offset=40 (local.get $info) (i32.const 1))         ;; link count
    (i32.store offset=44 (local.get $info) (i32.const 0))
    (i32.store offset=48 (local.get $info) (local.get $arg0))     ;; stable per-open file index
    (global.set $eax (i32.const 1))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12)))
  )

  ;; 509: PeekNamedPipe — STUB: unimplemented
  (func $handle_PeekNamedPipe (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $crash_unimplemented (local.get $name_ptr))
  )

  ;; 510: ReadConsoleInputA(hConsole, lpBuffer, nLength, lpNumberOfEventsRead) → BOOL
  ;; Blocking, like the real API: it returns only once at least one event is
  ;; queued.
  (func $handle_ReadConsoleInputA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $n i32)
    (call $console_input_poll_host)
    (if (global.get $console_ctrl_dispatching) (then (return)))
    (if (i32.eqz (call $console_input_count))
      (then
        (call $console_input_block)
        (return)))
    (local.set $n (call $console_read_input (local.get $arg1) (local.get $arg2) (i32.const 0)))
    (call $console_input_drop (local.get $n))
    (if (local.get $arg3)
      (then (i32.store (call $g2w (local.get $arg3)) (local.get $n))))
    (global.set $eax (i32.const 1))
    (global.set $esp (i32.add (global.get $esp) (i32.const 20))))

  ;; 511: PeekConsoleInputA(hConsole, lpBuffer, nLength, lpNumberOfEventsRead) → BOOL
  ;; Non-destructive: copies without dropping, and never blocks.
  (func $handle_PeekConsoleInputA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $console_input_poll_host)
    (if (global.get $console_ctrl_dispatching) (then (return)))
    (if (local.get $arg3)
      (then (i32.store (call $g2w (local.get $arg3))
        (call $console_read_input (local.get $arg1) (local.get $arg2) (i32.const 0))))
      (else (drop (call $console_read_input (local.get $arg1) (local.get $arg2) (i32.const 0)))))
    (global.set $eax (i32.const 1))
    (global.set $esp (i32.add (global.get $esp) (i32.const 20))))

  ;; 512: GetNumberOfConsoleInputEvents(hConsole, lpNumberOfEvents) → BOOL
  (func $handle_GetNumberOfConsoleInputEvents (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $console_input_poll_host)
    (if (global.get $console_ctrl_dispatching) (then (return)))
    (i32.store (call $g2w (local.get $arg1)) (call $console_input_count))
    (global.set $eax (i32.const 1))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12))))

  ;; 513: CreatePipe — STUB: unimplemented
  (func $handle_CreatePipe (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $crash_unimplemented (local.get $name_ptr))
  )

  ;; 514: GetSystemTimeAsFileTime(lpFileTime) — exact UTC wall-clock FILETIME.
  (func $handle_GetSystemTimeAsFileTime (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (drop (call $host_wall_clock (call $g2w (local.get $arg0)) (i32.const 2)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8)))
  )

  ;; 515: SetLocalTime — STUB: unimplemented
  (func $handle_SetLocalTime (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $crash_unimplemented (local.get $name_ptr))
  )

  ;; 516: GetSystemTime(lpSystemTime) — host wall clock in UTC.
  (func $handle_GetSystemTime (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (drop (call $host_wall_clock (call $g2w (local.get $arg0)) (i32.const 0)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8)))
  )

  ;; 517: FormatMessageW(dwFlags, lpSource, dwMessageId, dwLanguageId, lpBuffer, nSize, Arguments)
  ;; The same call as FormatMessageA with UTF-16 on both ends: the template is
  ;; narrowed on the way in, the finished text widened on the way out, and
  ;; nSize counts WCHARs rather than bytes. The decisions in between belong to
  ;; $format_message_ansi, which is the only implementation either spelling has.
  (func $handle_FormatMessageW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $nSize i32) (local $args_g i32) (local $len i32) (local $fmt_ga i32)
    (local $fmt_wa i32) (local $tmp_ga i32) (local $dst i32) (local $buf_ga i32)
    (local.set $nSize (call $gl32 (i32.add (global.get $esp) (i32.const 24))))
    (local.set $args_g (call $gl32 (i32.add (global.get $esp) (i32.const 28))))
    (if (i32.and (local.get $arg0) (i32.const 0x200))
      (then (local.set $args_g (i32.const 0))))
    (global.set $esp (i32.add (global.get $esp) (i32.const 32)))  ;; stdcall, 7 args
    (if (i32.and (local.get $arg0) (i32.const 0x400))
      (then
        (if (i32.eqz (local.get $arg1))
          (then (global.set $eax (i32.const 0)) (return)))
        (local.set $fmt_ga (call $heap_alloc
          (i32.add (call $guest_wcslen (local.get $arg1)) (i32.const 1))))
        (if (i32.eqz (local.get $fmt_ga))
          (then (global.set $eax (i32.const 0)) (return)))
        (drop (call $wide_to_ansi (local.get $arg1) (local.get $fmt_ga)
          (i32.add (call $guest_wcslen (local.get $arg1)) (i32.const 1))))
        (local.set $fmt_wa (call $g2w (local.get $fmt_ga)))))
    (local.set $len (call $format_message_ansi (local.get $arg0) (local.get $fmt_wa)
      (local.get $arg1) (local.get $arg2) (local.get $args_g) (i32.const 0) (i32.const 0)))
    ;; Expanded once more into an ANSI staging buffer and widened from there:
    ;; the caller's buffer is UTF-16, which $format_message_ansi cannot write.
    (local.set $tmp_ga (call $heap_alloc (i32.add (local.get $len) (i32.const 1))))
    (if (local.get $tmp_ga)
      (then
        (drop (call $format_message_ansi (local.get $arg0) (local.get $fmt_wa)
          (local.get $arg1) (local.get $arg2) (local.get $args_g)
          (call $g2w (local.get $tmp_ga)) (i32.add (local.get $len) (i32.const 1))))
        (if (i32.and (local.get $arg0) (i32.const 0x100))
          (then
            (local.set $buf_ga (call $heap_alloc
              (i32.shl (i32.add (local.get $len) (i32.const 1)) (i32.const 1))))
            (i32.store (call $g2w (local.get $arg4)) (local.get $buf_ga))
            (local.set $dst (local.get $buf_ga))
            (local.set $nSize (i32.add (local.get $len) (i32.const 1))))
          (else
            (local.set $dst (local.get $arg4))))
        (if (i32.and (i32.ne (local.get $dst) (i32.const 0))
                     (i32.ne (local.get $nSize) (i32.const 0)))
          (then (drop (call $ansi_to_wide
            (local.get $tmp_ga) (local.get $dst) (local.get $nSize)))))
        (call $heap_free (local.get $tmp_ga))))
    (if (local.get $fmt_ga) (then (call $heap_free (local.get $fmt_ga))))
    (global.set $eax (local.get $len))
  )

  ;; 518: GetFileSize — STUB: unimplemented
  (func $handle_GetFileSize (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; GetFileSize(hFile, lpFileSizeHigh) — 2 args
    (if (local.get $arg1) (then (call $gs32 (local.get $arg1) (i32.const 0))))
    (global.set $eax (call $host_fs_get_file_size (local.get $arg0)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12)))
  )

  ;; GetFileTime(hFile, lpCreationTime, lpLastAccessTime, lpLastWriteTime).
  ;; File timestamps belong to the VFS entry, so enumeration and subsequent
  ;; opens observe exactly what SetFileTime stored (not a fresh clock sample).
  (func $handle_GetFileTime (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $err i32)
    (local.set $err (call $host_fs_file_time
      (local.get $arg0) (i32.const 0)
      (if (result i32) (local.get $arg1) (then (call $g2w (local.get $arg1))) (else (i32.const 0)))
      (if (result i32) (local.get $arg2) (then (call $g2w (local.get $arg2))) (else (i32.const 0)))
      (if (result i32) (local.get $arg3) (then (call $g2w (local.get $arg3))) (else (i32.const 0)))))
    (if (local.get $err)
      (then
        (global.set $last_error (local.get $err))
        (global.set $eax (i32.const 0)))
      (else
        (global.set $last_error (i32.const 0))
        (global.set $eax (i32.const 1))))
    (global.set $esp (i32.add (global.get $esp) (i32.const 20)))
  )

  ;; GetStringTypeExA(Locale, dwInfoType, lpSrcStr, cchSrc, lpCharType)
  (func $handle_GetStringTypeExA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $get_string_type_core
      (local.get $arg2) (local.get $arg3) (local.get $arg4) (i32.const 0)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 24))))

  ;; 520: GetStringTypeExW(Locale, dwInfoType, lpSrcStr, cchSrc, lpCharType)
  (func $handle_GetStringTypeExW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $get_string_type_core
      (local.get $arg2) (local.get $arg3) (local.get $arg4) (i32.const 1)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 24))))

  ;; 521: GetThreadLocale() → LCID. A new process begins at the en-US user
  ;; locale, and subsequently returns the calling thread's retained setting.
  (func $handle_GetThreadLocale (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $host_get_thread_locale
      (global.get $current_thread_id)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 4))))

  (func $create_semaphore_core
      (param $initial i32) (param $maximum i32)
      (param $name i32) (param $wide i32) (result i32)
    (local $name_wa i32) (local $failure_error i32)
    (if (local.get $name)
      (then (local.set $name_wa (call $g2w (local.get $name)))))
    (local.set $failure_error
      (if (result i32)
          (i32.or
            (i32.le_s (local.get $maximum) (i32.const 0))
            (i32.or
              (i32.lt_s (local.get $initial) (i32.const 0))
              (i32.gt_s (local.get $initial) (local.get $maximum))))
        (then (i32.const 87)) ;; ERROR_INVALID_PARAMETER
        (else (i32.const 8)))) ;; ERROR_NOT_ENOUGH_MEMORY
    ;; The host resolves a same-name existing object before validating the new
    ;; counts, because Win32 explicitly ignores those counts on reopen.
    (call $sync_created_handle
      (call $host_create_semaphore
        (local.get $initial) (local.get $maximum)
        (local.get $name_wa) (local.get $wide))
      (local.get $failure_error)))

  (func $open_semaphore_core (param $name i32) (param $wide i32) (result i32)
    (call $sync_opened_handle
      (if (result i32) (local.get $name)
        (then (call $host_open_semaphore
          (call $g2w (local.get $name)) (local.get $wide)))
        (else (i32.const 0)))))

  ;; 522: CreateSemaphoreW(lpAttr, lInit, lMax, lpName) → counted named semaphore.
  (func $handle_CreateSemaphoreW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $create_semaphore_core
      (local.get $arg1) (local.get $arg2) (local.get $arg3) (i32.const 1)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 20))))

  ;; 523: ReleaseSemaphore(hSem, lReleaseCount, lpPrevCount) → host increments and writes back prior count.
  (func $handle_ReleaseSemaphore (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $host_release_semaphore
      (local.get $arg0)
      (local.get $arg1)
      (if (result i32) (local.get $arg2) (then (call $g2w (local.get $arg2))) (else (i32.const 0)))))
    (global.set $esp (i32.add (global.get $esp) (i32.const 16))))

  ;; Mutexes reuse the shared event host ABI with private kind bits in `wide`:
  ;; bit 0 selects A/W string decoding and bit 1 selects mutex semantics.
  (func $create_mutex_core (param $initial_owner i32) (param $name i32) (param $wide i32) (result i32)
    (local $name_wa i32)
    (if (local.get $name)
      (then (local.set $name_wa (call $g2w (local.get $name)))))
    (call $sync_created_handle
      (call $host_create_event
        (i32.const 0) (local.get $initial_owner) (local.get $name_wa)
        (i32.or (local.get $wide) (i32.const 2)))
      (i32.const 8))) ;; ERROR_NOT_ENOUGH_MEMORY

  (func $open_mutex_core (param $name i32) (param $wide i32) (result i32)
    (call $sync_opened_handle
      (if (result i32) (local.get $name)
        (then (call $host_open_event
          (call $g2w (local.get $name))
          (i32.or (local.get $wide) (i32.const 2))))
        (else (i32.const 0)))))

  ;; 524: CreateMutexW(lpMutexAttributes, bInitialOwner, lpName) → HANDLE
  (func $handle_CreateMutexW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $create_mutex_core (local.get $arg1) (local.get $arg2) (i32.const 1)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 16))))

  ;; 525: ReleaseMutex(hMutex) — release only the calling thread's ownership.
  ;; Bit 31 privately distinguishes this operation from SetEvent on the shared
  ;; one-argument host ABI.
  (func $handle_ReleaseMutex (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $result i32)
    (local.set $result (call $host_set_event
      (i32.or (local.get $arg0) (i32.const 0x80000000))))
    (if (i32.eq (local.get $result) (i32.const 1))
      (then
        (global.set $eax (i32.const 1))
        (global.set $last_error (i32.const 0)))
      (else
        (global.set $eax (i32.const 0))
        (global.set $last_error
          (if (result i32) (i32.eq (local.get $result) (i32.const -1))
            (then (i32.const 6))     ;; ERROR_INVALID_HANDLE
            (else (i32.const 288)))))) ;; ERROR_NOT_OWNER
    (global.set $esp (i32.add (global.get $esp) (i32.const 8))))

  ;; OpenMutexA/W resolve named mutexes in this emulated process.
  (func $handle_OpenMutexA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $open_mutex_core (local.get $arg2) (i32.const 0)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 16))))

  (func $handle_OpenMutexW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $open_mutex_core (local.get $arg2) (i32.const 1)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 16))))

  ;; CreateMutexA(lpAttr, bInitialOwner, lpName)
  (func $handle_CreateMutexA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $create_mutex_core (local.get $arg1) (local.get $arg2) (i32.const 0)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 16))))

  ;; CreateSemaphoreA(lpAttr, lInit, lMax, lpName) → counted named semaphore.
  (func $handle_CreateSemaphoreA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $create_semaphore_core
      (local.get $arg1) (local.get $arg2) (local.get $arg3) (i32.const 0)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 20))))

  ;; OpenSemaphoreA(dwDesiredAccess, bInheritHandle, lpName). Access masks and
  ;; inheritance are not yet represented, but lookup and reference lifetime are.
  (func $handle_OpenSemaphoreA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $open_semaphore_core (local.get $arg2) (i32.const 0)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 16))))

  ;; 526: CreateEventW(lpAttr, bManualReset, bInitialState, lpName) — 4 args stdcall
  (func $handle_CreateEventW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $create_event_core
      (local.get $arg1) (local.get $arg2) (local.get $arg3) (i32.const 1)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 20)))
  )

  ;; 527: WaitForMultipleObjects(nCount, lpHandles, bWaitAll, dwMilliseconds) — 4 args stdcall
  (func $handle_WaitForMultipleObjects (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $result i32) (local $handles_wa i32)
    (local.set $handles_wa (call $g2w (local.get $arg1)))
    (local.set $result (call $host_wait_multiple (local.get $arg0) (local.get $handles_wa) (local.get $arg2) (local.get $arg3)))
    (if (i32.eq (local.get $result) (i32.const 0xFFFF))
      (then
        (global.set $yield_reason (i32.const 1))
        (global.set $wait_handle (local.get $arg0)) ;; nCount
        (global.set $wait_handles_ptr (local.get $handles_wa))
        (global.set $wait_all (i32.ne (local.get $arg2) (i32.const 0)))
        (global.set $wait_timeout (local.get $arg3))
        (global.set $wait_stack_bytes (i32.const 20))
        (global.set $steps (i32.const 0))
        (return)))
    (global.set $eax (local.get $result))
    (drop (local.get $arg4))
    (drop (local.get $name_ptr))
    (global.set $esp (i32.add (global.get $esp) (i32.const 20)))
  )

  ;; 528: GlobalAddAtomW(lpString) — 1 arg stdcall, shares the A namespace.
  (func $handle_GlobalAddAtomW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $narrow i32)
    (local.set $narrow (call $atom_narrow_w (local.get $arg0)))
    (global.set $eax (call $atom_add (global.get $ATOM_GLOBAL_TABLE) (local.get $narrow)))
    (call $atom_narrow_free (local.get $arg0) (local.get $narrow))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8)))
  )

  ;; 529: FindResourceW — integer IDs share the A walk; named resources are
  ;; UTF-16 and must temporarily select the wide-name comparator.
  (func $handle_FindResourceW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $push_rsrc_ctx (local.get $arg0))
    (global.set $eax (call $find_resource_w (local.get $arg2) (local.get $arg1)))
    (call $pop_rsrc_ctx)
    (global.set $esp (i32.add (global.get $esp) (i32.const 16)))
  )

  ;; 530: GlobalGetAtomNameW(nAtom, lpBuffer, nSize)
  (func $handle_GlobalGetAtomNameW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $atom_get_name (global.get $ATOM_GLOBAL_TABLE)
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (i32.const 1)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 16)))
  )

  ;; 531: GetProfileIntW(appName, keyName, nDefault) — Unicode win.ini read
  (func $handle_GetProfileIntW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $host_ini_get_int
      (if (result i32) (local.get $arg0) (then (call $g2w (local.get $arg0))) (else (i32.const 0)))
      (if (result i32) (local.get $arg1) (then (call $g2w (local.get $arg1))) (else (i32.const 0)))
      (local.get $arg2)
      (global.get $win_ini_name_ptr)
      (i32.const 1)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 16)))
  )

  ;; GetProfileStringW(appName, keyName, default, retBuf, nSize) — Unicode win.ini read
  (func $handle_GetProfileStringW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $host_ini_get_string
      (if (result i32) (local.get $arg0) (then (call $g2w (local.get $arg0))) (else (i32.const 0)))
      (if (result i32) (local.get $arg1) (then (call $g2w (local.get $arg1))) (else (i32.const 0)))
      (if (result i32) (local.get $arg2) (then (call $g2w (local.get $arg2))) (else (i32.const 0)))
      (local.get $arg3)
      (local.get $arg4)
      (global.get $win_ini_name_ptr)
      (i32.const 1)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 24)))
  )

  ;; VirtualProtect(lpAddress, dwSize, flNewProtect, lpflOldProtect).
  ;; Sparse VirtualAlloc pages retain their exact PAGE_* value in packed PTEs.
  ;; Validate the complete page-rounded range before changing any page and
  ;; publish the first page's actual previous value. Direct image/heap pages
  ;; remain permissive until their section/page metadata joins this model.
  (func $handle_VirtualProtect (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $old i32) (local $old_wa i32)
    (if (i32.or
          (i32.eqz (local.get $arg0))
          (i32.or
            (i32.eqz (local.get $arg1))
            (i32.or
              (i32.eqz (local.get $arg3))
              (i32.eqz (call $guest_page_protection_valid (local.get $arg2))))))
      (then
        (global.set $last_error (i32.const 87)) ;; ERROR_INVALID_PARAMETER
        (global.set $eax (i32.const 0)))
      (else
        (local.set $old_wa (call $g2w (local.get $arg3)))
        (if (i32.eq (local.get $old_wa) (global.get $NULL_SENTINEL))
          (then
            (global.set $last_error (i32.const 87))
            (global.set $eax (i32.const 0)))
          (else
            (if (i32.ge_u (local.get $arg0) (global.get $VIRTUAL_ALLOC_MIN))
              (then
                (local.set $old (call $virtual_map_protect
                  (local.get $arg0) (local.get $arg1) (local.get $arg2))))
              (else
                (local.set $old (i32.const 0x40))))
            (if (i32.eq (local.get $old) (i32.const -1))
              (then
                (global.set $last_error (i32.const 487)) ;; ERROR_INVALID_ADDRESS
                (global.set $eax (i32.const 0)))
              (else
                (i32.store (local.get $old_wa) (local.get $old))
                (global.set $eax (i32.const 1))))))))
    (global.set $esp (i32.add (global.get $esp) (i32.const 20)))
  )

  ;; VirtualQuery(lpAddress, lpBuffer, dwLength) → SIZE_T
  ;; Describe low user-space probes as committed RW regions rooted at
  ;; image_base. Apps that probe a ptr (e.g. CRT exception filter, MFC heap walker)
  ;; just want a non-zero return + plausible State/Protect, not real bookkeeping.
  ;; GetSystemInfo publishes 0x7FFEFFFF as the maximum application address, so
  ;; queries at 0x80000000 or above must fail. Without that boundary, address-
  ;; space walkers wrap back to zero and scan our synthetic regions forever.
  ;; MEMORY_BASIC_INFORMATION layout (28 bytes):
  ;;   +0  BaseAddress     PVOID
  ;;   +4  AllocationBase  PVOID
  ;;   +8  AllocationProtect DWORD  (PAGE_READWRITE = 0x04)
  ;;   +12 RegionSize      SIZE_T
  ;;   +16 State           DWORD   (MEM_COMMIT = 0x1000)
  ;;   +20 Protect         DWORD   (PAGE_READWRITE = 0x04)
  ;;   +24 Type            DWORD   (MEM_PRIVATE = 0x20000)
  (func $handle_VirtualQuery (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $buf i32)
    (if (i32.eqz (local.get $arg1))
      (then (global.set $eax (i32.const 0))
            (global.set $esp (i32.add (global.get $esp) (i32.const 16)))
            (return)))
    (if (i32.lt_u (local.get $arg2) (i32.const 28))
      (then (global.set $eax (i32.const 0))
            (global.set $esp (i32.add (global.get $esp) (i32.const 16)))
            (return)))
    (if (i32.ge_u (local.get $arg0) (i32.const 0x80000000))
      (then (global.set $last_error (i32.const 87)) ;; ERROR_INVALID_PARAMETER
            (global.set $eax (i32.const 0))
            (global.set $esp (i32.add (global.get $esp) (i32.const 16)))
            (return)))
    (local.set $buf (call $g2w (local.get $arg1)))
    (i32.store (local.get $buf)                            (i32.and (local.get $arg0) (i32.const 0xFFFFF000)))
    (i32.store (i32.add (local.get $buf) (i32.const 4))    (global.get $image_base))
    (i32.store (i32.add (local.get $buf) (i32.const 8))    (i32.const 0x04))      ;; AllocationProtect = PAGE_READWRITE
    (i32.store (i32.add (local.get $buf) (i32.const 12))   (i32.const 0x10000000));; RegionSize = 256MB (huge)
    (i32.store (i32.add (local.get $buf) (i32.const 16))   (i32.const 0x1000))    ;; State = MEM_COMMIT
    (i32.store (i32.add (local.get $buf) (i32.const 20))   (i32.const 0x04))      ;; Protect = PAGE_READWRITE
    (i32.store (i32.add (local.get $buf) (i32.const 24))   (i32.const 0x20000))   ;; Type = MEM_PRIVATE
    (global.set $eax (i32.const 28))
    (global.set $esp (i32.add (global.get $esp) (i32.const 16))))

  ;; VirtualQueryEx(hProcess, lpAddress, lpBuffer, dwLength) -> SIZE_T
  ;; Wine-Assembly hosts one guest process, so the current-process pseudo
  ;; handle is the only cross-process query target it can describe. Delegate
  ;; that case to VirtualQuery and reject invented external process handles.
  (func $handle_VirtualQueryEx (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.ne (local.get $arg0) (i32.const -1))
      (then
        (global.set $last_error (i32.const 6)) ;; ERROR_INVALID_HANDLE
        (global.set $eax (i32.const 0))
        (global.set $esp (i32.add (global.get $esp) (i32.const 20)))
        (return)))
    (call $handle_VirtualQuery
      (local.get $arg1) (local.get $arg2) (local.get $arg3)
      (i32.const 0) (i32.const 0) (local.get $name_ptr))
    ;; VirtualQuery popped its return address and three arguments; account for
    ;; VirtualQueryEx's leading process handle as the fourth argument.
    (global.set $esp (i32.add (global.get $esp) (i32.const 4))))

  ;; GetDeviceGammaRamp(hdc, lpRamp) — retrieve WAT-owned display LUT state.
  (func $handle_GetDeviceGammaRamp (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $gdi_gamma_ramp_get (local.get $arg0)
      (if (result i32) (local.get $arg1)
        (then (call $g2w (local.get $arg1))) (else (i32.const 0)))))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12))))

  ;; 533: FindResourceExW(hModule, lpType, lpName, wLanguage) → HRSRC
  ;; The resource walker addresses types and names by ordinal and matches
  ;; string names as ASCII, which is exactly what FindResourceW already does
  ;; with the same pointers — the Ex form only adds a language we ignore.
  (func $handle_FindResourceExW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_FindResourceExA (local.get $arg0) (local.get $arg1)
      (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
  )

  ;; 534: SizeofResource(hModule, hResInfo) — return size from resource data entry
  (func $handle_SizeofResource (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; hResInfo (arg1) is relative to hModule (same as FindResource return).
    ;; Data entry: [RVA:4][Size:4][CodePage:4][Reserved:4]
    (if (i32.eqz (local.get $arg1))
      (then (global.set $eax (i32.const 0))
      (global.set $esp (i32.add (global.get $esp) (i32.const 12))) (return)))
    (call $push_rsrc_ctx (local.get $arg0))
    (global.set $eax
      (call $gl32
        (i32.add (call $r_base)
          (i32.add (local.get $arg1) (i32.const 4)))))
    (call $pop_rsrc_ctx)
    (global.set $esp (i32.add (global.get $esp) (i32.const 12)))
  )

  ;; 535: GetProcessVersion(ProcessId). PID zero names the caller. This runtime
  ;; has one process, whose original PE headers remain mapped at image_base.
  ;; Windows returns the executable's stamped subsystem version with the major
  ;; component in the high word and minor component in the low word; this is
  ;; not the differently encoded operating-system value returned by GetVersion.
  (func $handle_GetProcessVersion (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $pe_wa i32)
    (global.set $esp (i32.add (global.get $esp) (i32.const 8)))
    (if (i32.and
          (i32.ne (local.get $arg0) (i32.const 0))
          (i32.ne (local.get $arg0) (call $current_process_id)))
      (then
        (global.set $last_error (i32.const 87)) ;; ERROR_INVALID_PARAMETER
        (global.set $eax (i32.const 0))
        (return)))
    (local.set $pe_wa
      (call $g2w
        (i32.add (global.get $image_base)
          (call $gl32 (i32.add (global.get $image_base) (i32.const 0x3c))))))
    (global.set $eax
      (i32.or
        (i32.shl
          (i32.load16_u offset=0x48 (local.get $pe_wa))
          (i32.const 16))
        (i32.load16_u offset=0x4a (local.get $pe_wa))))
  )

  ;; GetProcessAffinityMask(hProcess, *processMask, *systemMask) → BOOL.
  ;; The browser machine has one logical processor, but the process handle is
  ;; still part of the contract: a fabricated external process must not gain a
  ;; plausible mask merely because both real outputs happen to be constants.
  (func $handle_GetProcessAffinityMask (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $esp (i32.add (global.get $esp) (i32.const 16)))
    (if (i32.eqz (call $current_process_handle_valid (local.get $arg0)))
      (then
        (global.set $last_error (i32.const 6)) ;; ERROR_INVALID_HANDLE
        (global.set $eax (i32.const 0))
        (return)))
    (if (local.get $arg1)
      (then (i32.store (call $g2w (local.get $arg1)) (i32.const 1))))
    (if (local.get $arg2)
      (then (i32.store (call $g2w (local.get $arg2)) (i32.const 1))))
    (global.set $eax (i32.const 1))
  )

  ;; SetThreadAffinityMask(hThread, dwAffinityMask) → previous mask (DWORD_PTR).
  ;; The only possible current and previous mask is bit zero. Resolve the
  ;; handle through the same process-wide thread authority as priority APIs so
  ;; pseudo and durable handles work while closed/fabricated handles fail.
  (func $handle_SetThreadAffinityMask (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $esp (i32.add (global.get $esp) (i32.const 12)))
    (if (i32.eq
          (call $host_get_thread_priority
            (local.get $arg0) (global.get $current_thread_id))
          (i32.const 0x7fffffff))
      (then
        (global.set $last_error (i32.const 6)) ;; ERROR_INVALID_HANDLE
        (global.set $eax (i32.const 0))
        (return)))
    (if (i32.ne (local.get $arg1) (i32.const 1))
      (then
        (global.set $last_error (i32.const 87)) ;; ERROR_INVALID_PARAMETER
        (global.set $eax (i32.const 0))
        (return)))
    (global.set $eax (i32.const 1))
  )

  ;; 536: GlobalFlags(hMem) → flags/lock count.
  ;; Our GlobalAlloc returns a direct heap pointer and GlobalLock is identity,
  ;; so there is no movable/discardable/lock-count state to report. Return 0,
  ;; which is the normal unlocked/fixed-memory result.
  (func $handle_GlobalFlags (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (i32.const 0))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8)))
  )

  ;; 537: GetDiskFreeSpaceW(lpRootPathName, ...) — every value this call
  ;; returns is a number written through a caller pointer; only the root
  ;; string's encoding differs, and $disk_free_space takes that as a flag.
  (func $handle_GetDiskFreeSpaceW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $disk_free_space (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (i32.const 1))
    (global.set $eax (i32.const 1))
    (global.set $esp (i32.add (global.get $esp) (i32.const 24)))  ;; stdcall, 5 args
  )

  ;; 538: SearchPathW(lpPath, lpFileName, lpExtension, nBufferLength,
  ;;                  lpBuffer, lpFilePart) → chars written
  ;; The host search takes an isWide flag and does the conversion on both
  ;; sides of itself, so this is SearchPathA with that flag set.
  (func $handle_SearchPathW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $search_path
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4)
      (call $gl32 (i32.add (global.get $esp) (i32.const 24)))
      (i32.const 1)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 28)))  ;; stdcall, 6 args
  )

  ;; Win98 accepts the seven ordinary relative values. A REALTIME process also
  ;; accepts the intermediate -7..6 values documented for that priority class;
  ;; background-processing mode is a post-Win98 API and stays invalid here.
  (func $win98_thread_priority_valid (param $priority i32) (result i32)
    (i32.or
      (i32.or
        (i32.eq (local.get $priority) (i32.const -15)) ;; THREAD_PRIORITY_IDLE
        (i32.eq (local.get $priority) (i32.const 15))) ;; THREAD_PRIORITY_TIME_CRITICAL
      (if (result i32)
        (i32.eq (call $process_priority_class_get) (i32.const 0x100))
        (then
          (i32.and
            (i32.ge_s (local.get $priority) (i32.const -7))
            (i32.le_s (local.get $priority) (i32.const 6))))
        (else
          (i32.and
            (i32.ge_s (local.get $priority) (i32.const -2))
            (i32.le_s (local.get $priority) (i32.const 2)))))))

  ;; 539: SetThreadPriority(hThread, nPriority). ThreadManager retains the value
  ;; on the underlying thread object, so CreateThread handles and duplicates
  ;; observe the same state in cooperative and real-Worker backends.
  (func $handle_SetThreadPriority (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $esp (i32.add (global.get $esp) (i32.const 12)))
    (if (i32.eqz (call $win98_thread_priority_valid (local.get $arg1)))
      (then
        (global.set $last_error (i32.const 87)) ;; ERROR_INVALID_PARAMETER
        (global.set $eax (i32.const 0))
        (return)))
    (global.set $eax (call $host_set_thread_priority
      (local.get $arg0) (local.get $arg1) (global.get $current_thread_id)))
    (if (i32.eqz (global.get $eax))
      (then (global.set $last_error (i32.const 6)))) ;; ERROR_INVALID_HANDLE
  )

  ;; 1250: GetExitCodeThread(hThread, lpExitCode) — 2 args stdcall
  (func $handle_GetExitCodeThread (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; Write exit code to lpExitCode
    (call $gs32 (local.get $arg1) (call $host_get_exit_code_thread (local.get $arg0)))
    (global.set $eax (i32.const 1))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12)))
  )

  ;; TerminateThread(hThread, dwExitCode) — legacy installers use this to tear
  ;; down helper threads during setup cleanup.
  (func $handle_TerminateThread (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $host_terminate_thread (local.get $arg0) (local.get $arg1)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12)))
  )

  ;; SuspendThread(hThread) — 1 arg stdcall, return previous suspend count (0 = not suspended)
  (func $handle_SuspendThread (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $result i32)
    (local.set $result (call $host_suspend_thread (local.get $arg0)))
    ;; The host privately tags a successful self-suspend in bit 31. Hide that
    ;; bit from the Win32 caller and stop this guest slice immediately; Windows
    ;; would not let the suspended thread execute its next instruction until a
    ;; different thread resumed it.
    (global.set $eax (i32.and (local.get $result) (i32.const 0x7FFFFFFF)))
    (if (i32.ne (i32.and (local.get $result) (i32.const 0x80000000)) (i32.const 0))
      (then
        (global.set $yield_reason (i32.const 11)) ;; private self-suspend yield
        (global.set $yield_flag (i32.const 1))))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8)))
  )

  ;; 541: GetPrivateProfileIntW — STUB: unimplemented
  (func $handle_GetPrivateProfileIntW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; GetPrivateProfileIntW(appName, keyName, nDefault, fileName) — 4 args stdcall
    (global.set $eax (call $host_ini_get_int
      (call $g2w (local.get $arg0))
      (call $g2w (local.get $arg1))
      (local.get $arg2)
      (call $g2w (local.get $arg3))
      (i32.const 1)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 20)))
  )

  ;; 542: GetPrivateProfileStringW — STUB: unimplemented
  (func $handle_GetPrivateProfileStringW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $ini_get_string
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4)
      (call $gl32 (i32.add (global.get $esp) (i32.const 24)))
      (i32.const 1)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 28)))
  )

  ;; 543: WritePrivateProfileStringW(appName, keyName, string, fileName) — 4 args stdcall
  (func $handle_WritePrivateProfileStringW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $host_ini_write_string
      (call $g2w (local.get $arg0))
      (if (result i32) (local.get $arg1) (then (call $g2w (local.get $arg1))) (else (i32.const 0)))
      (if (result i32) (local.get $arg2) (then (call $g2w (local.get $arg2))) (else (i32.const 0)))
      (call $g2w (local.get $arg3))
      (i32.const 1)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 20)))
  )

  ;; 544: CopyFileW — STUB: unimplemented
  (func $handle_CopyFileW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; CopyFileW(lpExistingFileName, lpNewFileName, bFailIfExists) — 3 args
    (global.set $eax (call $host_fs_copy_file
      (call $g2w (local.get $arg0)) (call $g2w (local.get $arg1)) (local.get $arg2) (i32.const 1)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 16)))
  )

  (func $fixed_windows_path_char (param $i i32) (result i32)
    (local $c i32)
    (if (i32.eq (local.get $i) (i32.const 0)) (then (local.set $c (i32.const 67))))  ;; C
    (if (i32.eq (local.get $i) (i32.const 1)) (then (local.set $c (i32.const 58))))  ;; :
    (if (i32.eq (local.get $i) (i32.const 2)) (then (local.set $c (i32.const 92))))  ;; \
    (if (i32.eq (local.get $i) (i32.const 3)) (then (local.set $c (i32.const 87))))  ;; W
    (if (i32.eq (local.get $i) (i32.const 4)) (then (local.set $c (i32.const 73))))  ;; I
    (if (i32.eq (local.get $i) (i32.const 5)) (then (local.set $c (i32.const 78))))  ;; N
    (if (i32.eq (local.get $i) (i32.const 6)) (then (local.set $c (i32.const 68))))  ;; D
    (if (i32.eq (local.get $i) (i32.const 7)) (then (local.set $c (i32.const 79))))  ;; O
    (if (i32.eq (local.get $i) (i32.const 8)) (then (local.set $c (i32.const 87))))  ;; W
    (if (i32.eq (local.get $i) (i32.const 9)) (then (local.set $c (i32.const 83))))  ;; S
    (if (i32.eq (local.get $i) (i32.const 10)) (then (local.set $c (i32.const 92)))) ;; \
    (if (i32.eq (local.get $i) (i32.const 11)) (then (local.set $c (i32.const 83)))) ;; S
    (if (i32.eq (local.get $i) (i32.const 12)) (then (local.set $c (i32.const 89)))) ;; Y
    (if (i32.eq (local.get $i) (i32.const 13)) (then (local.set $c (i32.const 83)))) ;; S
    (if (i32.eq (local.get $i) (i32.const 14)) (then (local.set $c (i32.const 84)))) ;; T
    (if (i32.eq (local.get $i) (i32.const 15)) (then (local.set $c (i32.const 69)))) ;; E
    (if (i32.eq (local.get $i) (i32.const 16)) (then (local.set $c (i32.const 77)))) ;; M
    (local.get $c))

  ;; The emulated Win98 installation has one fixed Windows directory and its
  ;; SYSTEM child. Both APIs share the same TCHAR-count and truncation rules.
  (func $get_fixed_windows_directory (param $buf_g i32) (param $size i32)
        (param $wide i32) (param $system i32) (result i32)
    (local $required i32) (local $length i32)
    (local $base_wa i32) (local $at_wa i32) (local $i i32) (local $c i32)
    (local.set $required
      (select (i32.const 18) (i32.const 11) (local.get $system)))
    (local.set $length (i32.sub (local.get $required) (i32.const 1)))
    (if (i32.or (i32.eqz (local.get $buf_g))
                (i32.lt_u (local.get $size) (local.get $required)))
      (then (return (local.get $required))))
    (local.set $base_wa (call $g2w (local.get $buf_g)))
    (block $done (loop $copy
      (br_if $done (i32.ge_u (local.get $i) (local.get $required)))
      (local.set $at_wa (i32.add (local.get $base_wa)
        (i32.shl (local.get $i) (local.get $wide))))
      (local.set $c
        (if (result i32) (i32.lt_u (local.get $i) (local.get $length))
          (then (call $fixed_windows_path_char (local.get $i)))
          (else (i32.const 0))))
      (if (local.get $wide)
        (then (i32.store16 (local.get $at_wa) (local.get $c)))
        (else (i32.store8 (local.get $at_wa) (local.get $c))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $copy)))
    (local.get $length))

  (func $handle_GetSystemDirectoryA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $get_fixed_windows_directory
      (local.get $arg0) (local.get $arg1) (i32.const 0) (i32.const 1)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12))))

  (func $handle_GetSystemDirectoryW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $get_fixed_windows_directory
      (local.get $arg0) (local.get $arg1) (i32.const 1) (i32.const 1)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12))))

  (func $handle_GetWindowsDirectoryA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $get_fixed_windows_directory
      (local.get $arg0) (local.get $arg1) (i32.const 0) (i32.const 0)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12))))

  ;; GetSystemWindowsDirectoryA was introduced for terminal-server-aware
  ;; callers. Win98 has one Windows directory, so it is the same path and
  ;; buffer contract as GetWindowsDirectoryA.
  (func $handle_GetSystemWindowsDirectoryA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_GetWindowsDirectoryA
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))

  ;; GetWindowsDirectoryW(lpBuffer, uSize) — UTF-16 counterpart with the
  ;; Win32 required-size contract used by Unicode setup runtimes.
  (func $handle_GetWindowsDirectoryW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $get_fixed_windows_directory
      (local.get $arg0) (local.get $arg1) (i32.const 1) (i32.const 0)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12))))

  ;; 546: GetVolumeInformationW — the same volume GetVolumeInformationA
  ;; describes, with its two strings written as UTF-16.
  (func $handle_GetVolumeInformationW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $volume_information
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (i32.const 1)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 36))) ;; stdcall 8 args
  )

  ;; 782: GetVolumeInformationA — 8 args stdcall, return TRUE with fake data
  ;; The volume this emulator presents, filled into the caller's out
  ;; parameters. Both spellings describe the same volume and differ only in
  ;; how the two strings are written, so $wide decides that and nothing else.
  ;; The three arguments past arg4 are read off the guest stack here, before
  ;; either entry point pops it.
  (func $volume_information (param $root i32) (param $name_buf i32)
                            (param $name_size i32) (param $serial i32)
                            (param $max_comp i32) (param $wide i32) (result i32)
    (local $wa_esp i32) (local $fs_flags i32) (local $fs_name i32)
    (local $mounted_serial i32) (local $root_wa i32) (local $name_wa i32) (local $fs_wa i32)
    (local.set $wa_esp (call $g2w (global.get $esp)))
    (local.set $fs_flags (i32.load (i32.add (local.get $wa_esp) (i32.const 24))))
    (local.set $fs_name (i32.load (i32.add (local.get $wa_esp) (i32.const 28)))) (if (local.get $root) (then (local.set $root_wa (call $g2w (local.get $root)))))
    ;; A mounted volume's label — the string an era CD check compares against.
    ;; Nothing mounted at this letter has a label, so the volume has none: an
    ;; empty string, in the caller's encoding.
    (if (local.get $name_buf)
      (then (local.set $name_wa (call $g2w (local.get $name_buf)))
        (if (i32.eqz (call $host_fs_volume_label
              (if (result i32) (local.get $root)
                (then (local.get $root_wa))
                (else (i32.const 0)))
              (local.get $wide)
              (local.get $name_wa)
              (local.get $name_size)))
          (then
            (if (local.get $wide)
              (then (i32.store16 (local.get $name_wa) (i32.const 0)))
              (else (i32.store8 (local.get $name_wa) (i32.const 0))))))))
    ;; A mounted volume's own serial when one is mounted here; the emulator's
    ;; fixed C: serial otherwise.
    (if (local.get $serial)
      (then
        (local.set $mounted_serial (call $host_fs_volume_serial
          (if (result i32) (local.get $root)
            (then (local.get $root_wa))
            (else (i32.const 0)))
          (local.get $wide)))
        (call $gs32 (local.get $serial)
          (select (local.get $mounted_serial) (i32.const 0x12345678)
                  (i32.ne (local.get $mounted_serial) (i32.const 0))))))
    (if (local.get $max_comp)
      (then (call $gs32 (local.get $max_comp) (i32.const 255))))
    ;; FILE_CASE_PRESERVED_NAMES | FILE_CASE_SENSITIVE_SEARCH
    (if (local.get $fs_flags)
      (then (call $gs32 (local.get $fs_flags) (i32.const 0x00000003))))
    ;; The filesystem name is part of era CD checks: Diablo XOR-folds the first
    ;; four bytes of this string into the constant it compares, so a mounted
    ;; CD-ROM must say "CDFS" the way Win98 does, not "FAT".
    (if (local.get $fs_name)
      (then (local.set $fs_wa (call $g2w (local.get $fs_name)))
        (if (i32.eq (call $host_fs_drive_type
              (if (result i32) (local.get $root)
                (then (local.get $root_wa))
                (else (i32.const 0)))
              (local.get $wide))
              (i32.const 5)) ;; DRIVE_CDROM
          (then
            (if (local.get $wide)
              (then
                (i32.store16 (local.get $fs_wa) (i32.const 0x43))          ;; 'C'
                (i32.store16 offset=2 (local.get $fs_wa) (i32.const 0x44)) ;; 'D'
                (i32.store16 offset=4 (local.get $fs_wa) (i32.const 0x46)) ;; 'F'
                (i32.store16 offset=6 (local.get $fs_wa) (i32.const 0x53)) ;; 'S'
                (i32.store16 offset=8 (local.get $fs_wa) (i32.const 0)))
              (else
                (i32.store (local.get $fs_wa) (i32.const 0x53464443))     ;; "CDFS"
                (i32.store8 offset=4 (local.get $fs_wa) (i32.const 0)))))
          (else
            (if (local.get $wide)
              (then
                (i32.store16 (local.get $fs_wa) (i32.const 0x46))          ;; 'F'
                (i32.store16 offset=2 (local.get $fs_wa) (i32.const 0x41)) ;; 'A'
                (i32.store16 offset=4 (local.get $fs_wa) (i32.const 0x54)) ;; 'T'
                (i32.store16 offset=6 (local.get $fs_wa) (i32.const 0)))
              (else
                (i32.store (local.get $fs_wa) (i32.const 0x00544146)))))))) ;; "FAT"
    (i32.const 1))

  (func $handle_GetVolumeInformationA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $volume_information
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (i32.const 0)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 36))) ;; stdcall 8 args
  )

  ;; 547: OutputDebugStringW — STUB: unimplemented
  (func $handle_OutputDebugStringW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_OutputDebugStringA
      (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
  )

  ;; IsBadStringPtr checks readable characters only through the first NUL or
  ;; ucchMax, whichever comes first. A zero maximum succeeds even for NULL.
  (func $ptr_string_bad
      (param $ptr i32) (param $max i32) (param $wide i32) (result i32)
    (local $i i32) (local $at i32) (local $width i32) (local $wa i32)
    (if (i32.eqz (local.get $max)) (then (return (i32.const 0))))
    (if (i32.eqz (local.get $ptr)) (then (return (i32.const 1))))
    (local.set $width (select (i32.const 2) (i32.const 1) (local.get $wide)))
    (local.set $at (local.get $ptr))
    (block $done (loop $chars
      (br_if $done (i32.ge_u (local.get $i) (local.get $max)))
      (if (call $ptr_range_access_bad
            (local.get $at) (local.get $width) (i32.const 0))
        (then (return (i32.const 1))))
      (local.set $wa (call $g2w (local.get $at)))
      (if (if (result i32) (local.get $wide)
            (then
              (i32.and
                (i32.eqz (i32.load8_u (local.get $wa)))
                (i32.eqz (i32.load8_u (call $g2w
                  (i32.add (local.get $at) (i32.const 1)))))))
            (else (i32.eqz (i32.load8_u (local.get $wa)))))
        (then (return (i32.const 0))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $done (i32.ge_u (local.get $i) (local.get $max)))
      (if (i32.gt_u (local.get $at) (i32.sub (i32.const -1) (local.get $width)))
        (then (return (i32.const 1))))
      (local.set $at (i32.add (local.get $at) (local.get $width)))
      (br $chars)))
    (i32.const 0))

  ;; 548: IsBadStringPtrA(lpsz, ucchMax)
  (func $handle_IsBadStringPtrA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $ptr_string_bad
      (local.get $arg0) (local.get $arg1) (i32.const 0)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12)))
  )

  ;; 549: IsBadStringPtrW(lpsz, ucchMax)
  (func $handle_IsBadStringPtrW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $ptr_string_bad
      (local.get $arg0) (local.get $arg1) (i32.const 1)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12)))
  )

  ;; 550: GlobalDeleteAtom(nAtom) — release one global reference; 0 = success.
  (func $handle_GlobalDeleteAtom (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $atom_delete (global.get $ATOM_GLOBAL_TABLE) (local.get $arg0)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8)))
  )

  ;; FindAtomA/W(lpString) — process-local lookup; 0 when never added.
  (func $handle_FindAtomA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $atom_find (global.get $ATOM_LOCAL_TABLE) (local.get $arg0)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8)))
  )

  (func $handle_FindAtomW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $narrow i32)
    (local.set $narrow (call $atom_narrow_w (local.get $arg0)))
    (global.set $eax (call $atom_find (global.get $ATOM_LOCAL_TABLE) (local.get $narrow)))
    (call $atom_narrow_free (local.get $arg0) (local.get $narrow))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8)))
  )

  ;; 551: GlobalFindAtomW(lpString) — global lookup; 0 when never added.
  (func $handle_GlobalFindAtomW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $narrow i32)
    (local.set $narrow (call $atom_narrow_w (local.get $arg0)))
    (global.set $eax (call $atom_find (global.get $ATOM_GLOBAL_TABLE) (local.get $narrow)))
    (call $atom_narrow_free (local.get $arg0) (local.get $narrow))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8)))
  )

  (func $handle_CopyMetaFileA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $gdi_metafile_copy (local.get $arg0) (i32.const 6)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12))))

  (func $handle_CopyMetaFileW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $gdi_metafile_copy (local.get $arg0) (i32.const 6)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12))))

  ;; 146: ExtCreatePen(style, width, LOGBRUSH*, styleCount, styleEntries).
  (func $handle_ExtCreatePen (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $brush i32) (local $style i32) (local $color i32) (local $flags i32)
    (if (i32.eqz (local.get $arg2))
      (then (global.set $eax (i32.const 0)))
      (else
        (local.set $brush (call $g2w (local.get $arg2)))
        (local.set $style (i32.and (local.get $arg0) (i32.const 0xF)))
        (local.set $color (i32.load offset=4 (local.get $brush)))
        (local.set $flags (i32.or
          (select (i32.const 1) (i32.const 0) (i32.eq (local.get $style) (i32.const 5)))
          (i32.and (local.get $arg0) (i32.const 0x000FFF00))))
        (global.set $eax (call $gdi_object_alloc (i32.const 1)
          (local.get $style) (local.get $arg1) (local.get $color) (local.get $flags)))))
    (global.set $esp (i32.add (global.get $esp) (i32.const 24)))
  )

  ;; 561: EnumMetaFile — validate and enumerate each classic WMF record through
  ;; the guest MFENUMPROC. The WAT callback context owns the HANDLETABLE.
  (func $handle_EnumMetaFile (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $ret i32)
    (local.set $ret (call $gl32 (global.get $esp)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 20)))
    (call $gdi_metafile_enum_start (local.get $arg0) (local.get $arg1)
      (local.get $arg2) (local.get $arg3) (local.get $ret) (global.get $esp))
  )

;; 563: PlayMetaFileRecord — replay one validated WMF record against the
  ;; caller's live HANDLETABLE, preserving object/state changes for the next
  ;; EnumMetaFile callback.
  (func $handle_PlayMetaFileRecord (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $gdi_metafile_play_wmf_record
      (local.get $arg0)
      (if (result i32) (local.get $arg1)
        (then (call $g2w (local.get $arg1))) (else (i32.const 0)))
      (if (result i32) (local.get $arg2)
        (then (call $g2w (local.get $arg2))) (else (i32.const 0)))
      (local.get $arg3)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 20)))
  )

SetColorAdjustment — validate and copy complete per-DC state.
  (func $handle_SetColorAdjustment (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $gdi_color_adjustment_set
      (local.get $arg0)
      (if (result i32) (local.get $arg1)
        (then (call $g2w (local.get $arg1))) (else (i32.const 0)))))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12)))
  )

  (func $handle_GetColorAdjustment (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $gdi_color_adjustment_get
      (local.get $arg0)
      (if (result i32) (local.get $arg1)
        (then (call $g2w (local.get $arg1))) (else (i32.const 0)))))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12)))
  )

;; 571: PolyDraw — WAT-owned PT_MOVETO/PT_LINETO/PT_BEZIERTO path execution.
  (func $handle_PolyDraw (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $points_wa i32) (local $types_wa i32)
    (local.set $points_wa (call $g2w (local.get $arg1)))
    (local.set $types_wa (call $g2w (local.get $arg2)))
    (if (call $gdi_dc_path_is_open (local.get $arg0))
      (then (global.set $eax (call $gdi_dc_path_record_polydraw (local.get $arg0)
        (local.get $points_wa) (local.get $types_wa) (local.get $arg3))))
      (else (global.set $eax (call $gdi_poly_draw (local.get $arg0)
        (local.get $points_wa) (local.get $types_wa) (local.get $arg3)))))
    (global.set $esp (i32.add (global.get $esp) (i32.const 20)))
  )

 574: SetMapperFlags — per-DC font mapper flags.
  (func $handle_SetMapperFlags (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $gdi_dc_aux_set
      (local.get $arg0) (i32.const 16) (local.get $arg1) (i32.const 0)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12)))
  )

  ;; StartDocW — the DOCINFO strings are only names for a print job nothing
  ;; here reads, so starting the job is the same act in either encoding.
  (func $handle_StartDocW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_StartDocA (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
  )

  ;; 603: GetCharWidthW(hdc, first, last, widths) — UTF-16 range width query.
  (func $handle_GetCharWidthW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_GetCharWidth32W
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
  )

  ;; 606: GetTextFaceW(hdc, cch, face) — UTF-16 variant of GetTextFaceA.
  (func $handle_GetTextFaceW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $gdi_font_write_text_face
      (local.get $arg0) (local.get $arg1)
      (if (result i32) (local.get $arg2)
        (then (call $g2w (local.get $arg2))) (else (i32.const 0)))
      (i32.const 1)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 16)))
  )

;; IME stubs — we never inject IME composition, so Immm* are no-ops.
  ;; ImmAssociateContext(hWnd, hIMC) → prev HIMC (we always return 0 — no previous)
  (func $handle_ImmAssociateContext (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (i32.const 0))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12)))
  )

  ;; ImmGetContext(hWnd) → HIMC (return 0 = no IME context)
  (func $handle_ImmGetContext (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (i32.const 0))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8)))
  )

  ;; ImmGetDefaultIMEWnd(hWnd) → HWND of the thread's default IME window.
  ;; No IME is installed here, so there is no IME window to return; real
  ;; Windows returns NULL in exactly that case and callers (MCM's input
  ;; setup) treat it as "no IME, use plain keyboard input".
  (func $handle_ImmGetDefaultIMEWnd (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (i32.const 0))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8)))
  )

  ;; ImmIsIME(hKL) → BOOL. The emulated machine exposes only the plain
  ;; en-US keyboard layout, so no enumerated HKL is an IME. This still needs a
  ;; real callable export: VCL loads IMM32 dynamically, caches the pointer,
  ;; and calls it for every result from GetKeyboardLayoutList.
  (func $handle_ImmIsIME (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (i32.const 0))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8)))
  )

  ;; ImmReleaseContext(hWnd, hIMC) balances a successful ImmGetContext call.
  ;; This no-IME machine never issues a HIMC, so neither NULL nor a fabricated
  ;; numeric value can name acquired context state to release.
  (func $handle_ImmReleaseContext (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (i32.const 0))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12)))
  )

  ;; ImmNotifyIME(hIMC, action, index, value) → BOOL. We do not create an
  ;; input context or composition state, so there is nothing to notify.
  (func $handle_ImmNotifyIME (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (i32.const 0))
    (global.set $esp (i32.add (global.get $esp) (i32.const 20)))
  )

  ;; The rest of the IMM32 surface Warcraft III imports. It asks for all of it
  ;; the moment a text field appears -- the Single Player screen -- and every
  ;; one of these is reached with the HIMC that $handle_ImmGetContext returned,
  ;; which on this no-IME machine is NULL. That is not a shortcut: Windows with
  ;; no IME installed returns NULL there too, and these are then the documented
  ;; results for a context that does not exist. They are constant because the
  ;; answer genuinely does not vary, not because the work was skipped -- the
  ;; day this machine grows an input context, they grow state with it.

  ;; ImmGetOpenStatus(hIMC) → BOOL: is the IME open. No context, never open.
  (func $handle_ImmGetOpenStatus (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (i32.const 0))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8))))

  ;; ImmSetOpenStatus(hIMC, fOpen) → BOOL. Opening an IME that is not there
  ;; fails; reporting success would tell the game a composition window exists.
  (func $handle_ImmSetOpenStatus (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (i32.const 0))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12))))

  ;; ImmGetConversionStatus(hIMC, lpfdwConversion, lpfdwSentence) → BOOL.
  ;; FALSE on an invalid context, and on failure Windows leaves both output
  ;; DWORDs untouched -- so this deliberately writes neither. A caller that
  ;; ignores the return value keeps whatever it initialised them to, which is
  ;; the same thing it would keep on a real no-IME machine.
  (func $handle_ImmGetConversionStatus (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (i32.const 0))
    (global.set $esp (i32.add (global.get $esp) (i32.const 16))))

  ;; ImmSetConversionStatus(hIMC, fdwConversion, fdwSentence) → BOOL.
  (func $handle_ImmSetConversionStatus (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (i32.const 0))
    (global.set $esp (i32.add (global.get $esp) (i32.const 16))))

  ;; ImmGetCompositionStringA(hIMC, dwIndex, lpBuf, dwBufLen) → LONG. The
  ;; return is a byte COUNT, so 0 means "an empty composition string, and the
  ;; buffer is now valid" -- a lie we would be caught in. IMM_ERROR_GENERAL
  ;; (-2) is what an invalid context returns, and it is negative, which is the
  ;; test every caller of this function performs.
  (func $handle_ImmGetCompositionStringA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (i32.const -2))
    (global.set $esp (i32.add (global.get $esp) (i32.const 20))))

  ;; ImmGetCandidateListA(hIMC, dwIndex, lpCandList, dwBufLen) → DWORD, the
  ;; size copied or required. Zero is the documented failure here (unlike the
  ;; composition string above, this one returns a size, not a count that could
  ;; legitimately be empty), and no CANDIDATELIST is written.
  (func $handle_ImmGetCandidateListA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (i32.const 0))
    (global.set $esp (i32.add (global.get $esp) (i32.const 20))))

  ;; CharLower accepts either a character in the low word or a mutable,
  ;; NUL-terminated string. Translate a string pointer once, then vary only
  ;; the character width between A and W.
  (func $char_lower (param $value i32) (param $wide i32) (result i32)
    (local $p_wa i32) (local $c i32) (local $lower i32) (local $step i32)
    (if (i32.eqz (i32.and (local.get $value) (i32.const 0xffff0000)))
      (then
        (local.set $c (i32.and (local.get $value)
          (if (result i32) (local.get $wide)
            (then (i32.const 0xffff)) (else (i32.const 0xff)))))
        (return (call $tolower (local.get $c)))))
    (local.set $p_wa (call $g2w (local.get $value)))
    (local.set $step (i32.shl (i32.const 1) (local.get $wide)))
    (block $done (loop $lp
      (local.set $c
        (if (result i32) (local.get $wide)
          (then (i32.load16_u (local.get $p_wa)))
          (else (i32.load8_u (local.get $p_wa)))))
      (br_if $done (i32.eqz (local.get $c)))
      (local.set $lower (call $tolower (local.get $c)))
      (if (i32.ne (local.get $lower) (local.get $c))
        (then
          (if (local.get $wide)
            (then (i32.store16 (local.get $p_wa) (local.get $lower)))
            (else (i32.store8 (local.get $p_wa) (local.get $lower))))))
      (local.set $p_wa (i32.add (local.get $p_wa) (local.get $step)))
      (br $lp)))
    (local.get $value))

  (func $handle_CharLowerA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $char_lower (local.get $arg0) (i32.const 0)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8))))

  (func $handle_CharLowerW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $char_lower (local.get $arg0) (i32.const 1)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8))))

  ;; CharLowerBuff is count-delimited and therefore processes embedded NULs.
  ;; cchLength is a character count for both encodings, not a byte count for W.
  (func $char_lower_buff (param $buf_g i32) (param $length i32)
        (param $wide i32) (result i32)
    (local $base_wa i32) (local $at_wa i32)
    (local $i i32) (local $c i32) (local $lower i32)
    (if (i32.eqz (local.get $buf_g)) (then (return (i32.const 0))))
    (local.set $base_wa (call $g2w (local.get $buf_g)))
    (block $done (loop $lp
      (br_if $done (i32.ge_u (local.get $i) (local.get $length)))
      (local.set $at_wa (i32.add (local.get $base_wa)
        (i32.shl (local.get $i) (local.get $wide))))
      (local.set $c
        (if (result i32) (local.get $wide)
          (then (i32.load16_u (local.get $at_wa)))
          (else (i32.load8_u (local.get $at_wa)))))
      (local.set $lower (call $tolower (local.get $c)))
      (if (i32.ne (local.get $lower) (local.get $c))
        (then
          (if (local.get $wide)
            (then (i32.store16 (local.get $at_wa) (local.get $lower)))
            (else (i32.store8 (local.get $at_wa) (local.get $lower))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $lp)))
    (local.get $length))

  (func $handle_CharLowerBuffA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $char_lower_buff
      (local.get $arg0) (local.get $arg1) (i32.const 0)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12))))

  (func $handle_CharLowerBuffW (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $char_lower_buff
      (local.get $arg0) (local.get $arg1) (i32.const 1)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12))))

  ;; CharUpperBuffA(lpsz, cchLength) — uppercase cchLength characters in
  ;; place and return how many were converted. Unlike CharUpperA this does not
  ;; stop at a NUL: the count is the whole contract.
  (func $handle_CharUpperBuffA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $p i32) (local $i i32) (local $c i32)
    (if (i32.eqz (local.get $arg0))
      (then
        (global.set $eax (i32.const 0))
        (global.set $esp (i32.add (global.get $esp) (i32.const 12)))
        (return)))
    (local.set $p (call $g2w (local.get $arg0)))
    (block $done (loop $lp
      (br_if $done (i32.ge_u (local.get $i) (local.get $arg1)))
      (local.set $c (i32.load8_u (i32.add (local.get $p) (local.get $i))))
      (if (i32.and
            (i32.ge_u (local.get $c) (i32.const 0x61))
            (i32.le_u (local.get $c) (i32.const 0x7a)))
        (then
          (i32.store8
            (i32.add (local.get $p) (local.get $i))
            (i32.sub (local.get $c) (i32.const 0x20)))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $lp)))
    (global.set $eax (local.get $arg1))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12)))
  )

  ;; Win98's en-US ANSI/OEM pair is CP1252 <-> CP437, not a byte copy.
  ;; Keep the complete single-byte maps in a free page immediately below the
  ;; branch histograms. Unrepresentable characters use the Windows default
  ;; character '?'. The two 256-byte tables make the string and counted APIs
  ;; share exactly the same conversion, including in-place calls.
  (global $CP1252_TO_CP437 i32 (region.addr $CP1252_TO_CP437 0))
  (global $CP437_TO_CP1252 i32 (region.addr $CP437_TO_CP1252 0))
  (global $file_apis_ansi (mut i32) (i32.const 1))
  (data (region.addr $CP1252_TO_CP437 0)
    "\00\01\02\03\04\05\06\07\08\09\0a\0b\0c\0d\0e\0f\10\11\12\13\14\15\16\17\18\19\1a\1b\1c\1d\1e\1f"
    "\20\21\22\23\24\25\26\27\28\29\2a\2b\2c\2d\2e\2f\30\31\32\33\34\35\36\37\38\39\3a\3b\3c\3d\3e\3f"
    "\40\41\42\43\44\45\46\47\48\49\4a\4b\4c\4d\4e\4f\50\51\52\53\54\55\56\57\58\59\5a\5b\5c\5d\5e\5f"
    "\60\61\62\63\64\65\66\67\68\69\6a\6b\6c\6d\6e\6f\70\71\72\73\74\75\76\77\78\79\7a\7b\7c\7d\7e\7f"
    "\3f\3f\3f\9f\3f\3f\3f\3f\3f\3f\3f\3f\3f\3f\3f\3f\3f\3f\3f\3f\3f\3f\3f\3f\3f\3f\3f\3f\3f\3f\3f\3f"
    "\ff\ad\9b\9c\3f\9d\3f\3f\3f\3f\a6\ae\aa\3f\3f\3f\f8\f1\fd\3f\3f\e6\3f\fa\3f\3f\a7\af\ac\ab\3f\a8"
    "\3f\3f\3f\3f\8e\8f\92\80\3f\90\3f\3f\3f\3f\3f\3f\3f\a5\3f\3f\3f\3f\99\3f\3f\3f\3f\3f\9a\3f\3f\e1"
    "\85\a0\83\3f\84\86\91\87\8a\82\88\89\8d\a1\8c\8b\3f\a4\95\a2\93\3f\94\f6\3f\97\a3\96\81\3f\3f\98")
  (data (region.addr $CP437_TO_CP1252 0)
    "\00\01\02\03\04\05\06\07\08\09\0a\0b\0c\0d\0e\0f\10\11\12\13\14\15\16\17\18\19\1a\1b\1c\1d\1e\1f"
    "\20\21\22\23\24\25\26\27\28\29\2a\2b\2c\2d\2e\2f\30\31\32\33\34\35\36\37\38\39\3a\3b\3c\3d\3e\3f"
    "\40\41\42\43\44\45\46\47\48\49\4a\4b\4c\4d\4e\4f\50\51\52\53\54\55\56\57\58\59\5a\5b\5c\5d\5e\5f"
    "\60\61\62\63\64\65\66\67\68\69\6a\6b\6c\6d\6e\6f\70\71\72\73\74\75\76\77\78\79\7a\7b\7c\7d\7e\7f"
    "\c7\fc\e9\e2\e4\e0\e5\e7\ea\eb\e8\ef\ee\ec\c4\c5\c9\e6\c6\f4\f6\f2\fb\f9\ff\d6\dc\a2\a3\a5\3f\83"
    "\e1\ed\f3\fa\f1\d1\aa\ba\bf\3f\ac\bd\bc\a1\ab\bb\3f\3f\3f\3f\3f\3f\3f\3f\3f\3f\3f\3f\3f\3f\3f\3f"
    "\3f\3f\3f\3f\3f\3f\3f\3f\3f\3f\3f\3f\3f\3f\3f\3f\3f\3f\3f\3f\3f\3f\3f\3f\3f\3f\3f\3f\3f\3f\3f\3f"
    "\3f\df\3f\3f\3f\3f\b5\3f\3f\3f\3f\3f\3f\3f\3f\3f\3f\b1\3f\3f\3f\3f\f7\3f\b0\3f\b7\3f\3f\b2\3f\a0")

  (func $char_translate_buffer (param $src_g i32) (param $dst_g i32)
        (param $count i32) (param $table i32)
    (local $src i32) (local $dst i32) (local $i i32) (local $ch i32)
    (local.set $src (call $g2w (local.get $src_g)))
    (local.set $dst (call $g2w (local.get $dst_g)))
    (block $done (loop $copy
      (br_if $done (i32.ge_u (local.get $i) (local.get $count)))
      (local.set $ch (i32.load8_u (i32.add (local.get $src) (local.get $i))))
      (i32.store8 (i32.add (local.get $dst) (local.get $i))
        (i32.load8_u (i32.add (local.get $table) (local.get $ch))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $copy))))

  (func $char_translate_string (param $src_g i32) (param $dst_g i32)
        (param $table i32)
    (local $src i32) (local $dst i32) (local $i i32) (local $ch i32)
    (local.set $src (call $g2w (local.get $src_g)))
    (local.set $dst (call $g2w (local.get $dst_g)))
    (block $done (loop $copy
      (local.set $ch (i32.load8_u (i32.add (local.get $src) (local.get $i))))
      (i32.store8 (i32.add (local.get $dst) (local.get $i))
        (i32.load8_u (i32.add (local.get $table) (local.get $ch))))
      (br_if $done (i32.eqz (local.get $ch)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $copy))))

  ;; CharToOemA(pSrc, pDst) and the counted Buff form. ANSI callers may
  ;; convert in place; a one-byte table lookup naturally preserves that case.
  (func $handle_CharToOemA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $char_translate_string
      (local.get $arg0) (local.get $arg1) (global.get $CP1252_TO_CP437))
    (global.set $eax (i32.const 1))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12))))

  (func $handle_CharToOemBuffA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $char_translate_buffer
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (global.get $CP1252_TO_CP437))
    (global.set $eax (i32.const 1))
    (global.set $esp (i32.add (global.get $esp) (i32.const 16))))

  ;; OemToCharA(lpSrc, lpDst) — CP437 to the process CP1252 page.
  (func $handle_OemToCharA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $char_translate_string
      (local.get $arg0) (local.get $arg1) (global.get $CP437_TO_CP1252))
    (global.set $eax (i32.const 1))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12)))
  )

  ;; OemToCharBuffA converts all cchDstLength bytes and does not stop at NUL.
  (func $handle_OemToCharBuffA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $char_translate_buffer
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (global.get $CP437_TO_CP1252))
    (global.set $eax (i32.const 1))
    (global.set $esp (i32.add (global.get $esp) (i32.const 16)))
  )

  ;; The file-API character-set selector is process global on Win98. FAR uses
  ;; the OEM mode so names received from the console and names passed to the
  ;; ANSI file APIs stay in the same byte domain.
  (func $handle_SetFileApisToOEM (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $file_apis_ansi (i32.const 0)) (drop (call $host_fs_file_api_ansi (i32.const 0)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 4))))

  (func $handle_SetFileApisToANSI (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $file_apis_ansi (i32.const 1)) (drop (call $host_fs_file_api_ansi (i32.const 1)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 4))))

  (func $handle_AreFileApisANSI (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $host_fs_file_api_ansi (i32.const -1)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 4))))

  ;; 697: ??1type_info@@UAE@XZ — soft-stub — STUB: unimplemented
  (func $handle_??1type_info@@UAE@XZ (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $crash_unimplemented (local.get $name_ptr))
  )

  ;; 698: ?terminate@@YAXXZ — soft-stub — STUB: unimplemented
  (func $handle_?terminate@@YAXXZ (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $crash_unimplemented (local.get $name_ptr))
  )

  ;; 699: HeapSize — return allocation size from heap header
  (func $handle_HeapSize (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; HeapSize(hHeap, dwFlags, lpMem) → size
    ;; Our heap stores block size (including 4-byte header) at [ptr-4]
    ;; Only valid for pointers in our heap range; return -1 for unknown pointers
    (if (i32.eqz (call $heap_api_handle_valid (local.get $arg0)))
      (then
        (global.set $last_error (i32.const 6)) ;; ERROR_INVALID_HANDLE
        (global.set $eax (i32.const 0xFFFFFFFF))
        (global.set $esp (i32.add (global.get $esp) (i32.const 16)))
        (return)))
    (if (i32.and
          (i32.ge_u (local.get $arg2) (i32.add (global.get $image_base) (global.get $exe_size_of_image)))
          (i32.lt_u (local.get $arg2) (global.get $heap_ptr)))
      (then
        (global.set $eax (i32.sub
          (call $gl32 (i32.sub (local.get $arg2) (i32.const 4)))
          (i32.const 4))))
      (else
        (global.set $eax (i32.const 0xFFFFFFFF))))  ;; not our allocation
    (global.set $esp (i32.add (global.get $esp) (i32.const 16)))
  )

  ;; 700: IsProcessorFeaturePresent(dwProcessorFeature) → BOOL
  (func $handle_IsProcessorFeaturePresent (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; Keep this aligned with the CPUID personality in 05-alu.wat. The guest
    ;; implements CMPXCHG8B, MMX, and RDTSC, but deliberately does not advertise
    ;; SSE. In particular PF_FLOATING_POINT_PRECISION_ERRATA (0) must be FALSE:
    ;; the VC runtime queries it during process attach, before a DLL can register
    ;; its native classes.
    (global.set $eax
      (i32.or
        (i32.or (i32.eq (local.get $arg0) (i32.const 2))  ;; PF_COMPARE_EXCHANGE_DOUBLE
                (i32.eq (local.get $arg0) (i32.const 3))) ;; PF_MMX_INSTRUCTIONS_AVAILABLE
        (i32.eq (local.get $arg0) (i32.const 8))))        ;; PF_RDTSC_INSTRUCTION_AVAILABLE
    (global.set $esp (i32.add (global.get $esp) (i32.const 8)))
  )

  ;; 701: CoRegisterMessageFilter(lpMsgFilter, lplpMsgFilter) — 2 args stdcall
  (func $handle_CoRegisterMessageFilter (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; Write NULL to *lplpMsgFilter if non-null
    (if (local.get $arg1)
      (then (call $gs32 (local.get $arg1) (i32.const 0))))
    (global.set $eax (i32.const 0))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12)))
  )

  ;; 716: _EH_prolog — MSVCRT SEH frame setup (special calling convention)
  ;; On entry: EAX = exception handler address, [ESP] = return address
  ;; Builds SEH frame: push -1 (trylevel), push handler (EAX), push old fs:[0],
  ;; set fs:[0] = ESP, save old EBP, set EBP to frame, return to caller.
  (func $handle__EH_prolog (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $ret_addr i32)
    (local $old_seh i32)
    ;; [ESP] = return address (from the call instruction)
    (local.set $ret_addr (call $gl32 (global.get $esp)))
    ;; Push -1 (initial trylevel)
    (global.set $esp (i32.sub (global.get $esp) (i32.const 4)))
    (call $gs32 (global.get $esp) (i32.const 0xFFFFFFFF))
    ;; Push EAX (exception handler)
    (global.set $esp (i32.sub (global.get $esp) (i32.const 4)))
    (call $gs32 (global.get $esp) (global.get $eax))
    ;; Push old fs:[0] (previous SEH head)
    (local.set $old_seh (call $gl32 (global.get $fs_base)))
    (global.set $esp (i32.sub (global.get $esp) (i32.const 4)))
    (call $gs32 (global.get $esp) (local.get $old_seh))
    ;; Set fs:[0] = ESP (install new SEH frame)
    (call $gs32 (global.get $fs_base) (global.get $esp))
    ;; Save EBP where the return address was: [ESP+12] = EBP
    (call $gs32 (i32.add (global.get $esp) (i32.const 12)) (global.get $ebp))
    ;; LEA EBP, [ESP+12] — EBP points to saved EBP
    (global.set $ebp (i32.add (global.get $esp) (i32.const 12)))
    ;; Set EIP to return address
    (global.set $eip (local.get $ret_addr))
  )
