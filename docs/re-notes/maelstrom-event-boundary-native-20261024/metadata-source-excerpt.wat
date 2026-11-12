  ;; WriteProcessMemory can replace an API entry with guest instructions.
  ;; Keep its original dispatch descriptor separate from those visible bytes.
  ;; Immutable records {next,index,originalLo,originalHi} are published into
  ;; 256 shared buckets. Restoring the original bytes restores API dispatch.
  (global $THUNK_PATCH_STATE i32 (region.addr $THUNK_PATCH_STATE 0))
  (global $THUNK_PATCH_STATE_SIZE i32 (i32.const 16))
  (func $thunk_patch_record (param $idx i32) (result i32)
    (local $table i32) (local $n i32)
    (local.set $table (i32.atomic.load offset=4 (global.get $THUNK_PATCH_STATE)))
    (if (i32.eqz (local.get $table)) (then (return (i32.const 0))))
    (local.set $n (i32.atomic.load (call $g2w (i32.add (local.get $table)
      (i32.shl (i32.and (local.get $idx) (i32.const 255)) (i32.const 2))))))
    (block $end (loop $scan
      (br_if $end (i32.eqz (local.get $n)))
      (if (i32.eq (call $gl32 (i32.add (local.get $n) (i32.const 4))) (local.get $idx))
        (then (return (call $g2w (local.get $n)))))
      (local.set $n (call $gl32 (local.get $n))) (br $scan)))
    (i32.const 0))
  (func $thunk_metadata_addr (param $idx i32) (result i32)
    (local $rec i32)
    (local.set $rec (call $thunk_patch_record (local.get $idx)))
    (if (local.get $rec) (then (return (i32.add (local.get $rec) (i32.const 8)))))
    (i32.add (global.get $THUNK_BASE) (i32.shl (local.get $idx) (i32.const 3))))
  (func $thunk_patch_changed (param $idx i32) (result i32)
