  ;; ============================================================
  ;; OLE STRUCTURED STORAGE — in-memory IStorage / IStream
  ;; ============================================================
  ;; A memory-backed compound-document store. MFC's COleDocument creates a
  ;; temporary docfile (StgCreateDocfile, STGM_DELETEONRELEASE) for every new
  ;; document and CreateStream/CreateStorage into it as OLE items are embedded.
  ;; Real structured storage is a full on-disk format; here the whole tree
  ;; lives in the emulator heap, which is all any in-process compound-document
  ;; app needs. Objects reuse the DX COM machinery ($dx_create_com_obj /
  ;; $dx_from_this / the thunk vtables); their per-object state hangs off the
  ;; DX_OBJECTS entry's misc0 field (+8) as a heap pointer.
  ;;
  ;; DX object type ids: 40 = IStorage, 41 = IStream.
  ;;
  ;; IStream state (16 bytes):  +0 buf(guest heap ptr) +4 cap +8 size +12 pos
  ;; IStorage state (20 + 24*44 bytes):
  ;;   +0  nchildren
  ;;   +4  clsid[16]
  ;;   +20 children[24], each 44 bytes: name[36 ASCII, NUL-term] + type(4) + obj(4)
  ;;       type: 1 = stream, 2 = storage
  ;;
  ;; Lifetime: Release rides $da_release, which — like the whole DX COM layer —
  ;; deliberately does NOT reclaim on final release ($dx_free only marks the
  ;; entry type 0; the wrapper, refcount field, and misc0 state pointer all
  ;; persist). That conservatism exists because some COM refs are AddRef'd via
  ;; paths we don't track, so a "last" release can be wrong and freeing there
  ;; would be a use-after-free. So neither Release nor DestroyElement frees the
  ;; per-object state (stream buffer / child table); the storage tree is a
  ;; bounded temporary docfile reclaimed wholesale when the guest process heap
  ;; is torn down. DestroyElement removes the directory slot only.

  (global $DX_VTBL_ISTORAGE (mut i32) (i32.const 0))
  (global $DX_VTBL_ISTREAM  (mut i32) (i32.const 0))

  (global $OLE_STG_MAX_CHILDREN i32 (i32.const 24))
  (global $OLE_STG_CHILD_SIZE   i32 (i32.const 44))
  (global $OLE_STG_STATE_SIZE   i32 (i32.const 1076)) ;; 20 + 24*44

  ;; ── per-object state helpers ────────────────────────────────
  ;; State heap ptr (guest) stored in the DX_OBJECTS entry's misc0 (+8).
  (func $ole_state (param $this_guest i32) (result i32)
    (i32.load (i32.add (call $dx_from_this (local.get $this_guest)) (i32.const 8))))

  (func $ole_set_state (param $this_guest i32) (param $st i32)
    (i32.store (i32.add (call $dx_from_this (local.get $this_guest)) (i32.const 8)) (local.get $st)))

  ;; Mint a fresh empty IStream, return its guest COM ptr (0 on OOM).
  (func $ole_stream_new (result i32)
    (local $obj i32) (local $st i32)
    (local.set $obj (call $dx_create_com_obj (i32.const 41) (global.get $DX_VTBL_ISTREAM)))
    (if (i32.eqz (local.get $obj)) (then (return (i32.const 0))))
    (local.set $st (call $heap_alloc (i32.const 16)))
    (call $zero_memory (call $g2w (local.get $st)) (i32.const 16))
    (call $ole_set_state (local.get $obj) (local.get $st))
    (local.get $obj))

  ;; Mint a fresh empty IStorage, return its guest COM ptr (0 on OOM).
  (func $ole_storage_new (result i32)
    (local $obj i32) (local $st i32)
    (local.set $obj (call $dx_create_com_obj (i32.const 40) (global.get $DX_VTBL_ISTORAGE)))
    (if (i32.eqz (local.get $obj)) (then (return (i32.const 0))))
    (local.set $st (call $heap_alloc (global.get $OLE_STG_STATE_SIZE)))
    (call $zero_memory (call $g2w (local.get $st)) (global.get $OLE_STG_STATE_SIZE))
    (call $ole_set_state (local.get $obj) (local.get $st))
    (local.get $obj))

  ;; Copy an OLE wide-char name (LPCWSTR) into an ASCII buffer (WASM addr),
  ;; low byte per wchar, up to 35 chars + NUL. NULL source → empty string.
  (func $ole_wstr_ascii (param $wstr_guest i32) (param $dst_wa i32)
    (local $i i32) (local $w i32) (local $ch i32)
    (if (i32.eqz (local.get $wstr_guest))
      (then (i32.store8 (local.get $dst_wa) (i32.const 0)) (return)))
    (local.set $w (call $g2w (local.get $wstr_guest)))
    (local.set $i (i32.const 0))
    (block $done (loop $lp
      (br_if $done (i32.ge_u (local.get $i) (i32.const 35)))
      (local.set $ch (i32.load16_u (i32.add (local.get $w) (i32.mul (local.get $i) (i32.const 2)))))
      (br_if $done (i32.eqz (local.get $ch)))
      (i32.store8 (i32.add (local.get $dst_wa) (local.get $i)) (local.get $ch))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $lp)))
    (i32.store8 (i32.add (local.get $dst_wa) (local.get $i)) (i32.const 0)))

  ;; ASCII strcmp of two WASM-addr NUL-terminated strings → 1 if equal.
  (func $ole_ascii_eq (param $a i32) (param $b i32) (result i32)
    (local $ca i32) (local $cb i32)
    (block $done (loop $lp
      (local.set $ca (i32.load8_u (local.get $a)))
      (local.set $cb (i32.load8_u (local.get $b)))
      (if (i32.ne (local.get $ca) (local.get $cb)) (then (return (i32.const 0))))
      (br_if $done (i32.eqz (local.get $ca)))
      (local.set $a (i32.add (local.get $a) (i32.const 1)))
      (local.set $b (i32.add (local.get $b) (i32.const 1)))
      (br $lp)))
    (i32.const 1))

  ;; child entry WASM addr for storage-state (guest ptr) + index.
  (func $ole_child_wa (param $st i32) (param $idx i32) (result i32)
    (i32.add (call $g2w (local.get $st))
      (i32.add (i32.const 20) (i32.mul (local.get $idx) (global.get $OLE_STG_CHILD_SIZE)))))

  ;; Find a child by ASCII name (WASM addr). Returns index or -1.
  (func $ole_dir_find (param $st i32) (param $name_wa i32) (result i32)
    (local $n i32) (local $i i32) (local $ce i32)
    (local.set $n (i32.load (call $g2w (local.get $st))))
    (local.set $i (i32.const 0))
    (block $done (loop $lp
      (br_if $done (i32.ge_u (local.get $i) (local.get $n)))
      (local.set $ce (call $ole_child_wa (local.get $st) (local.get $i)))
      (if (call $ole_ascii_eq (local.get $ce) (local.get $name_wa))
        (then (return (local.get $i))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $lp)))
    (i32.const -1))

  ;; Insert (or replace) a child (name_wa, type, obj). Returns index or -1 if full.
  (func $ole_dir_put (param $st i32) (param $name_wa i32) (param $type i32) (param $obj i32) (result i32)
    (local $idx i32) (local $n i32) (local $ce i32) (local $j i32) (local $c i32)
    (local.set $idx (call $ole_dir_find (local.get $st) (local.get $name_wa)))
    (if (i32.lt_s (local.get $idx) (i32.const 0))
      (then
        (local.set $n (i32.load (call $g2w (local.get $st))))
        (if (i32.ge_u (local.get $n) (global.get $OLE_STG_MAX_CHILDREN))
          (then (return (i32.const -1))))
        (local.set $idx (local.get $n))
        (i32.store (call $g2w (local.get $st)) (i32.add (local.get $n) (i32.const 1)))))
    (local.set $ce (call $ole_child_wa (local.get $st) (local.get $idx)))
    ;; copy name (up to 35 + NUL)
    (local.set $j (i32.const 0))
    (block $cd (loop $cl
      (br_if $cd (i32.ge_u (local.get $j) (i32.const 36)))
      (local.set $c (i32.load8_u (i32.add (local.get $name_wa) (local.get $j))))
      (i32.store8 (i32.add (local.get $ce) (local.get $j)) (local.get $c))
      (br_if $cd (i32.eqz (local.get $c)))
      (local.set $j (i32.add (local.get $j) (i32.const 1)))
      (br $cl)))
    (i32.store (i32.add (local.get $ce) (i32.const 36)) (local.get $type))
    (i32.store (i32.add (local.get $ce) (i32.const 40)) (local.get $obj))
    (local.get $idx))

  ;; ── shared COM IUnknown for both interfaces ─────────────────
  ;; QueryInterface(this, riid, ppv). accept_iid: the interface's own IID low
  ;; dword (0x0B storage / 0x0C stream); IUnknown (all-zero) always accepted.
  (func $ole_query_interface (param $this i32) (param $riid i32) (param $ppv i32) (param $accept i32) (result i32)
    (local $iid0 i32)
    (if (i32.eqz (local.get $ppv)) (then (return (i32.const 0x80004003)))) ;; E_POINTER
    (local.set $iid0 (if (result i32) (local.get $riid)
      (then (call $gl32 (local.get $riid))) (else (i32.const 0))))
    (if (i32.or (i32.eqz (local.get $iid0)) (i32.eq (local.get $iid0) (local.get $accept)))
      (then
        (call $gs32 (local.get $ppv) (local.get $this))
        (drop (call $da_addref (local.get $this)))
        (return (i32.const 0))))
    (call $gs32 (local.get $ppv) (i32.const 0))
    (i32.const 0x80004002)) ;; E_NOINTERFACE

  ;; ════════════════════════════════════════════════════════════
  ;; IStorage methods
  ;; ════════════════════════════════════════════════════════════
  (func $handle_IStorage_QueryInterface (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $ole_query_interface (local.get $arg0) (local.get $arg1) (local.get $arg2) (i32.const 0x0000000B)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 16))))

  (func $handle_IStorage_AddRef (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $da_addref (local.get $arg0)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8))))

  (func $handle_IStorage_Release (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $da_release (local.get $arg0)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8))))

  ;; CreateStream(this, pwcsName, grfMode, r1, r2, ppstm) — 6 stack dwords.
  (func $handle_IStorage_CreateStream (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $ppstm i32) (local $st i32) (local $name_wa i32) (local $strm i32)
    (local.set $ppstm (call $gl32 (i32.add (global.get $esp) (i32.const 24))))
    (local.set $st (call $ole_state (local.get $arg0)))
    (local.set $name_wa (global.get $OLE_NAME_SCRATCH))
    (call $ole_wstr_ascii (local.get $arg1) (local.get $name_wa))
    (local.set $strm (call $ole_stream_new))
    (if (i32.eqz (local.get $strm))
      (then
        (if (local.get $ppstm) (then (call $gs32 (local.get $ppstm) (i32.const 0))))
        (global.set $eax (i32.const 0x8007000E)) ;; E_OUTOFMEMORY
        (global.set $esp (i32.add (global.get $esp) (i32.const 28))) (return)))
    ;; Register in the directory; a full storage (24 children) fails the create.
    (if (i32.lt_s (call $ole_dir_put (local.get $st) (local.get $name_wa) (i32.const 1) (local.get $strm)) (i32.const 0))
      (then
        (drop (call $da_release (local.get $strm)))
        (if (local.get $ppstm) (then (call $gs32 (local.get $ppstm) (i32.const 0))))
        (global.set $eax (i32.const 0x80030008)) ;; STG_E_INSUFFICIENTMEMORY
        (global.set $esp (i32.add (global.get $esp) (i32.const 28))) (return)))
    (if (local.get $ppstm) (then (call $gs32 (local.get $ppstm) (local.get $strm))))
    (global.set $eax (i32.const 0))
    (global.set $esp (i32.add (global.get $esp) (i32.const 28))))

  ;; OpenStream(this, pwcsName, r1, grfMode, r2, ppstm) — 6 stack dwords.
  (func $handle_IStorage_OpenStream (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $ppstm i32) (local $st i32) (local $name_wa i32) (local $idx i32) (local $ce i32) (local $obj i32)
    (local.set $ppstm (call $gl32 (i32.add (global.get $esp) (i32.const 24))))
    (local.set $st (call $ole_state (local.get $arg0)))
    (local.set $name_wa (global.get $OLE_NAME_SCRATCH))
    (call $ole_wstr_ascii (local.get $arg1) (local.get $name_wa))
    (local.set $idx (call $ole_dir_find (local.get $st) (local.get $name_wa)))
    (if (i32.lt_s (local.get $idx) (i32.const 0))
      (then
        (if (local.get $ppstm) (then (call $gs32 (local.get $ppstm) (i32.const 0))))
        (global.set $eax (i32.const 0x80030002)) ;; STG_E_FILENOTFOUND
        (global.set $esp (i32.add (global.get $esp) (i32.const 28))) (return)))
    (local.set $ce (call $ole_child_wa (local.get $st) (local.get $idx)))
    ;; The element must be a stream (type 1), not a sub-storage — otherwise the
    ;; caller would receive an IStorage through an IStream ppstm.
    (if (i32.ne (i32.load (i32.add (local.get $ce) (i32.const 36))) (i32.const 1))
      (then
        (if (local.get $ppstm) (then (call $gs32 (local.get $ppstm) (i32.const 0))))
        (global.set $eax (i32.const 0x80030002)) ;; STG_E_FILENOTFOUND
        (global.set $esp (i32.add (global.get $esp) (i32.const 28))) (return)))
    (local.set $obj (i32.load (i32.add (local.get $ce) (i32.const 40))))
    (drop (call $da_addref (local.get $obj)))
    (if (local.get $ppstm) (then (call $gs32 (local.get $ppstm) (local.get $obj))))
    (global.set $eax (i32.const 0))
    (global.set $esp (i32.add (global.get $esp) (i32.const 28))))

  ;; CreateStorage(this, pwcsName, grfMode, r1, r2, ppstg) — 6 stack dwords.
  (func $handle_IStorage_CreateStorage (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $ppstg i32) (local $st i32) (local $name_wa i32) (local $sub i32)
    (local.set $ppstg (call $gl32 (i32.add (global.get $esp) (i32.const 24))))
    (local.set $st (call $ole_state (local.get $arg0)))
    (local.set $name_wa (global.get $OLE_NAME_SCRATCH))
    (call $ole_wstr_ascii (local.get $arg1) (local.get $name_wa))
    (local.set $sub (call $ole_storage_new))
    (if (i32.eqz (local.get $sub))
      (then
        (if (local.get $ppstg) (then (call $gs32 (local.get $ppstg) (i32.const 0))))
        (global.set $eax (i32.const 0x8007000E))
        (global.set $esp (i32.add (global.get $esp) (i32.const 28))) (return)))
    ;; Register in the directory; a full storage (24 children) fails the create.
    (if (i32.lt_s (call $ole_dir_put (local.get $st) (local.get $name_wa) (i32.const 2) (local.get $sub)) (i32.const 0))
      (then
        (drop (call $da_release (local.get $sub)))
        (if (local.get $ppstg) (then (call $gs32 (local.get $ppstg) (i32.const 0))))
        (global.set $eax (i32.const 0x80030008)) ;; STG_E_INSUFFICIENTMEMORY
        (global.set $esp (i32.add (global.get $esp) (i32.const 28))) (return)))
    (if (local.get $ppstg) (then (call $gs32 (local.get $ppstg) (local.get $sub))))
    (global.set $eax (i32.const 0))
    (global.set $esp (i32.add (global.get $esp) (i32.const 28))))

  ;; OpenStorage(this, pwcsName, pstgPri, grfMode, snbExclude, r, ppstg) — 7 dwords.
  (func $handle_IStorage_OpenStorage (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $ppstg i32) (local $st i32) (local $name_wa i32) (local $idx i32) (local $ce i32) (local $obj i32)
    (local.set $ppstg (call $gl32 (i32.add (global.get $esp) (i32.const 28))))
    (local.set $st (call $ole_state (local.get $arg0)))
    (local.set $name_wa (global.get $OLE_NAME_SCRATCH))
    (call $ole_wstr_ascii (local.get $arg1) (local.get $name_wa))
    (local.set $idx (call $ole_dir_find (local.get $st) (local.get $name_wa)))
    (if (i32.lt_s (local.get $idx) (i32.const 0))
      (then
        (if (local.get $ppstg) (then (call $gs32 (local.get $ppstg) (i32.const 0))))
        (global.set $eax (i32.const 0x80030002))
        (global.set $esp (i32.add (global.get $esp) (i32.const 32))) (return)))
    (local.set $ce (call $ole_child_wa (local.get $st) (local.get $idx)))
    ;; The element must be a sub-storage (type 2), not a stream — otherwise the
    ;; caller would receive an IStream through an IStorage ppstg.
    (if (i32.ne (i32.load (i32.add (local.get $ce) (i32.const 36))) (i32.const 2))
      (then
        (if (local.get $ppstg) (then (call $gs32 (local.get $ppstg) (i32.const 0))))
        (global.set $eax (i32.const 0x80030002)) ;; STG_E_FILENOTFOUND
        (global.set $esp (i32.add (global.get $esp) (i32.const 32))) (return)))
    (local.set $obj (i32.load (i32.add (local.get $ce) (i32.const 40))))
    (drop (call $da_addref (local.get $obj)))
    (if (local.get $ppstg) (then (call $gs32 (local.get $ppstg) (local.get $obj))))
    (global.set $eax (i32.const 0))
    (global.set $esp (i32.add (global.get $esp) (i32.const 32))))

  ;; CopyTo(this, ciidExclude, rgiidExclude, snbExclude, pstgDest) — 5 dwords. Stub S_OK.
  (func $handle_IStorage_CopyTo (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (i32.const 0))
    (global.set $esp (i32.add (global.get $esp) (i32.const 24))))

  ;; MoveElementTo(this, name, pstgDest, newName, grfFlags) — 5 dwords. Stub S_OK.
  (func $handle_IStorage_MoveElementTo (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (i32.const 0))
    (global.set $esp (i32.add (global.get $esp) (i32.const 24))))

  (func $handle_IStorage_Commit (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (i32.const 0))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8))))

  (func $handle_IStorage_Revert (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (i32.const 0))
    (global.set $esp (i32.add (global.get $esp) (i32.const 4))))

  ;; EnumElements(this, r1, r2, r3, ppenum) — 5 dwords. No enumerator yet.
  (func $handle_IStorage_EnumElements (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (local.get $arg4) (then (call $gs32 (local.get $arg4) (i32.const 0))))
    (global.set $eax (i32.const 0x80004001)) ;; E_NOTIMPL
    (global.set $esp (i32.add (global.get $esp) (i32.const 24))))

  ;; DestroyElement(this, pwcsName) — remove child, compact the array.
  (func $handle_IStorage_DestroyElement (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $st i32) (local $name_wa i32) (local $idx i32) (local $n i32) (local $i i32)
    (local.set $st (call $ole_state (local.get $arg0)))
    (local.set $name_wa (global.get $OLE_NAME_SCRATCH))
    (call $ole_wstr_ascii (local.get $arg1) (local.get $name_wa))
    (local.set $idx (call $ole_dir_find (local.get $st) (local.get $name_wa)))
    (if (i32.ge_s (local.get $idx) (i32.const 0))
      (then
        (local.set $n (i32.load (call $g2w (local.get $st))))
        (local.set $i (local.get $idx))
        (block $cd (loop $cl
          (br_if $cd (i32.ge_u (i32.add (local.get $i) (i32.const 1)) (local.get $n)))
          (call $memcpy
            (call $ole_child_wa (local.get $st) (local.get $i))
            (call $ole_child_wa (local.get $st) (i32.add (local.get $i) (i32.const 1)))
            (global.get $OLE_STG_CHILD_SIZE))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $cl)))
        (i32.store (call $g2w (local.get $st)) (i32.sub (local.get $n) (i32.const 1)))))
    (global.set $eax (i32.const 0))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8))))

  (func $handle_IStorage_RenameElement (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (i32.const 0))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12))))

  (func $handle_IStorage_SetElementTimes (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (i32.const 0))
    (global.set $esp (i32.add (global.get $esp) (i32.const 20))))

  ;; SetClass(this, rclsid) — store the CLSID into storage state (+4).
  (func $handle_IStorage_SetClass (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $st i32)
    (if (local.get $arg1)
      (then
        (local.set $st (call $ole_state (local.get $arg0)))
        (call $memcpy (i32.add (call $g2w (local.get $st)) (i32.const 4)) (call $g2w (local.get $arg1)) (i32.const 16))))
    (global.set $eax (i32.const 0))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8))))

  (func $handle_IStorage_SetStateBits (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (i32.const 0))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12))))

  ;; Stat(this, pstatstg, grfStatFlag) — zero-fill STATSTG, type=STGTY_STORAGE(1),
  ;; copy the stored CLSID.
  (func $handle_IStorage_Stat (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $st i32) (local $ps i32)
    (if (local.get $arg1)
      (then
        (local.set $ps (call $g2w (local.get $arg1)))
        (call $zero_memory (local.get $ps) (i32.const 72))
        (i32.store (i32.add (local.get $ps) (i32.const 4)) (i32.const 1)) ;; STGTY_STORAGE
        (local.set $st (call $ole_state (local.get $arg0)))
        (call $memcpy (i32.add (local.get $ps) (i32.const 48)) (i32.add (call $g2w (local.get $st)) (i32.const 4)) (i32.const 16))))
    (global.set $eax (i32.const 0))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12))))

  ;; ════════════════════════════════════════════════════════════
  ;; IStream methods
  ;; ════════════════════════════════════════════════════════════
  (func $handle_IStream_QueryInterface (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $ole_query_interface (local.get $arg0) (local.get $arg1) (local.get $arg2) (i32.const 0x0000000C)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 16))))

  (func $handle_IStream_AddRef (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $da_addref (local.get $arg0)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8))))

  (func $handle_IStream_Release (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $da_release (local.get $arg0)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8))))

  ;; Read(this, pv, cb, pcbRead) — copy min(cb, size-pos) bytes from pos.
  (func $handle_IStream_Read (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $st i32) (local $sw i32) (local $buf i32) (local $size i32) (local $pos i32) (local $avail i32) (local $n i32)
    (local.set $st (call $ole_state (local.get $arg0)))
    (local.set $sw (call $g2w (local.get $st)))
    (local.set $buf (i32.load (local.get $sw)))
    (local.set $size (i32.load offset=8 (local.get $sw)))
    (local.set $pos (i32.load offset=12 (local.get $sw)))
    (local.set $avail (i32.sub (local.get $size) (local.get $pos)))
    (if (i32.lt_s (local.get $avail) (i32.const 0)) (then (local.set $avail (i32.const 0))))
    (local.set $n (local.get $arg2))
    (if (i32.gt_u (local.get $n) (local.get $avail)) (then (local.set $n (local.get $avail))))
    (if (i32.and (i32.gt_u (local.get $n) (i32.const 0)) (i32.ne (local.get $arg1) (i32.const 0)))
      (then
        (call $memcpy (call $g2w (local.get $arg1))
          (i32.add (call $g2w (local.get $buf)) (local.get $pos)) (local.get $n))
        (i32.store offset=12 (local.get $sw) (i32.add (local.get $pos) (local.get $n)))))
    (if (local.get $arg3) (then (call $gs32 (local.get $arg3) (local.get $n))))
    (global.set $eax (i32.const 0))
    (global.set $esp (i32.add (global.get $esp) (i32.const 16))))

  ;; Write(this, pv, cb, pcbWritten) — grow buffer, copy at pos, advance.
  (func $handle_IStream_Write (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $st i32) (local $sw i32) (local $buf i32) (local $cap i32) (local $size i32) (local $pos i32) (local $need i32) (local $newcap i32) (local $newbuf i32)
    (local.set $st (call $ole_state (local.get $arg0)))
    (local.set $sw (call $g2w (local.get $st)))
    (local.set $buf (i32.load (local.get $sw)))
    (local.set $cap (i32.load offset=4 (local.get $sw)))
    (local.set $size (i32.load offset=8 (local.get $sw)))
    (local.set $pos (i32.load offset=12 (local.get $sw)))
    (local.set $need (i32.add (local.get $pos) (local.get $arg2)))
    (if (i32.gt_u (local.get $need) (local.get $cap))
      (then
        (local.set $newcap (i32.mul (local.get $cap) (i32.const 2)))
        (if (i32.lt_u (local.get $newcap) (local.get $need)) (then (local.set $newcap (local.get $need))))
        (if (i32.lt_u (local.get $newcap) (i32.const 64)) (then (local.set $newcap (i32.const 64))))
        (local.set $newbuf (call $heap_realloc (local.get $buf) (local.get $newcap) (i32.const 0)))
        ;; On OOM heap_realloc leaves the old buffer intact — keep it, write nothing,
        ;; don't advance the position, and fail the call rather than deref NULL.
        (if (i32.eqz (local.get $newbuf))
          (then
            (if (local.get $arg3) (then (call $gs32 (local.get $arg3) (i32.const 0))))
            (global.set $eax (i32.const 0x80030070)) ;; STG_E_MEDIUMFULL
            (global.set $esp (i32.add (global.get $esp) (i32.const 16))) (return)))
        (local.set $buf (local.get $newbuf))
        (i32.store (local.get $sw) (local.get $buf))
        (i32.store offset=4 (local.get $sw) (local.get $newcap))))
    (if (i32.and (i32.gt_u (local.get $arg2) (i32.const 0)) (i32.ne (local.get $arg1) (i32.const 0)))
      (then
        (call $memcpy (i32.add (call $g2w (local.get $buf)) (local.get $pos))
          (call $g2w (local.get $arg1)) (local.get $arg2))))
    (local.set $pos (i32.add (local.get $pos) (local.get $arg2)))
    (i32.store offset=12 (local.get $sw) (local.get $pos))
    (if (i32.gt_u (local.get $pos) (local.get $size)) (then (i32.store offset=8 (local.get $sw) (local.get $pos))))
    (if (local.get $arg3) (then (call $gs32 (local.get $arg3) (local.get $arg2))))
    (global.set $eax (i32.const 0))
    (global.set $esp (i32.add (global.get $esp) (i32.const 16))))

  ;; Seek(this, dlibMove.lo, dlibMove.hi, dwOrigin, plibNewPosition) — 5 dwords.
  ;; 32-bit offsets suffice for in-memory doc streams.
  (func $handle_IStream_Seek (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $st i32) (local $sw i32) (local $size i32) (local $pos i32) (local $newpos i32)
    (local.set $st (call $ole_state (local.get $arg0)))
    (local.set $sw (call $g2w (local.get $st)))
    (local.set $size (i32.load offset=8 (local.get $sw)))
    (local.set $pos (i32.load offset=12 (local.get $sw)))
    ;; dwOrigin: 0=SET, 1=CUR, 2=END
    (local.set $newpos
      (if (result i32) (i32.eq (local.get $arg3) (i32.const 1))
        (then (i32.add (local.get $pos) (local.get $arg1)))
        (else (if (result i32) (i32.eq (local.get $arg3) (i32.const 2))
          (then (i32.add (local.get $size) (local.get $arg1)))
          (else (local.get $arg1))))))
    (if (i32.lt_s (local.get $newpos) (i32.const 0)) (then (local.set $newpos (i32.const 0))))
    (i32.store offset=12 (local.get $sw) (local.get $newpos))
    (if (local.get $arg4)
      (then
        (call $gs32 (local.get $arg4) (local.get $newpos))
        (call $gs32 (i32.add (local.get $arg4) (i32.const 4)) (i32.const 0))))
    (global.set $eax (i32.const 0))
    (global.set $esp (i32.add (global.get $esp) (i32.const 20))))

  ;; SetSize(this, libNewSize.lo, libNewSize.hi) — grow capacity, set size.
  (func $handle_IStream_SetSize (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $st i32) (local $sw i32) (local $buf i32) (local $cap i32)
    (local.set $st (call $ole_state (local.get $arg0)))
    (local.set $sw (call $g2w (local.get $st)))
    (local.set $cap (i32.load offset=4 (local.get $sw)))
    (if (i32.gt_u (local.get $arg1) (local.get $cap))
      (then
        (local.set $buf (call $heap_realloc (i32.load (local.get $sw)) (local.get $arg1) (i32.const 0)))
        ;; On OOM keep the old buffer/size and fail rather than zero the pointer.
        (if (i32.eqz (local.get $buf))
          (then
            (global.set $eax (i32.const 0x80030070)) ;; STG_E_MEDIUMFULL
            (global.set $esp (i32.add (global.get $esp) (i32.const 12))) (return)))
        (i32.store (local.get $sw) (local.get $buf))
        (i32.store offset=4 (local.get $sw) (local.get $arg1))))
    (i32.store offset=8 (local.get $sw) (local.get $arg1))
    (global.set $eax (i32.const 0))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12))))

  ;; CopyTo(this, pstm, cb.lo, cb.hi, pcbRead) [+ pcbWritten at esp+24] — 6 dwords.
  (func $handle_IStream_CopyTo (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (local.get $arg4) (then (call $gs32 (local.get $arg4) (i32.const 0))))
    (global.set $eax (i32.const 0))
    (global.set $esp (i32.add (global.get $esp) (i32.const 28))))

  (func $handle_IStream_Commit (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (i32.const 0))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8))))

  (func $handle_IStream_Revert (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (i32.const 0))
    (global.set $esp (i32.add (global.get $esp) (i32.const 4))))

  ;; LockRegion/UnlockRegion(this, off.lo, off.hi, cb.lo) [+ cb.hi, lockType] — stub.
  (func $handle_IStream_LockRegion (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (i32.const 0x80030001)) ;; STG_E_INVALIDFUNCTION (lock not supported)
    (global.set $esp (i32.add (global.get $esp) (i32.const 24))))

  (func $handle_IStream_UnlockRegion (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (i32.const 0x80030001))
    (global.set $esp (i32.add (global.get $esp) (i32.const 24))))

  ;; Stat(this, pstatstg, grfStatFlag) — type=STGTY_STREAM(2), cbSize=size.
  (func $handle_IStream_Stat (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $st i32) (local $ps i32)
    (if (local.get $arg1)
      (then
        (local.set $ps (call $g2w (local.get $arg1)))
        (call $zero_memory (local.get $ps) (i32.const 72))
        (i32.store (i32.add (local.get $ps) (i32.const 4)) (i32.const 2)) ;; STGTY_STREAM
        (local.set $st (call $ole_state (local.get $arg0)))
        (i32.store (i32.add (local.get $ps) (i32.const 8)) (i32.load offset=8 (call $g2w (local.get $st)))))) ;; cbSize.lo
    (global.set $eax (i32.const 0))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12))))

  ;; Clone(this, ppstm) — a fresh independent stream copy sharing the bytes.
  (func $handle_IStream_Clone (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $src i32) (local $dst i32) (local $srcw i32) (local $dstw i32) (local $size i32) (local $buf i32)
    (local.set $dst (call $ole_stream_new))
    (if (i32.and (i32.ne (local.get $dst) (i32.const 0)) (i32.ne (local.get $arg1) (i32.const 0)))
      (then
        (local.set $src (call $ole_state (local.get $arg0)))
        (local.set $srcw (call $g2w (local.get $src)))
        (local.set $size (i32.load offset=8 (local.get $srcw)))
        (local.set $dstw (call $g2w (call $ole_state (local.get $dst))))
        (if (i32.gt_u (local.get $size) (i32.const 0))
          (then
            (local.set $buf (call $heap_alloc (local.get $size)))
            (call $memcpy (call $g2w (local.get $buf)) (call $g2w (i32.load (local.get $srcw))) (local.get $size))
            (i32.store (local.get $dstw) (local.get $buf))
            (i32.store offset=4 (local.get $dstw) (local.get $size))
            (i32.store offset=8 (local.get $dstw) (local.get $size))))
        (i32.store offset=12 (local.get $dstw) (i32.load offset=12 (local.get $srcw))) ;; same pos
        (call $gs32 (local.get $arg1) (local.get $dst))))
    (global.set $eax (i32.const 0))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8))))

  ;; ════════════════════════════════════════════════════════════
  ;; Stg* top-level functions
  ;; ════════════════════════════════════════════════════════════
  ;; StgCreateDocfile(pwcsName, grfMode, reserved, ppstgOpen) — 4 args.
  ;; Mint an empty root storage in memory. Name/DELETEONRELEASE ignored (the
  ;; tree is heap-backed; nothing touches disk).
  (func $handle_StgCreateDocfile (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $root i32)
    (if (i32.eqz (local.get $arg3))
      (then
        (global.set $eax (i32.const 0x80004003)) ;; E_POINTER (ppstgOpen)
        (global.set $esp (i32.add (global.get $esp) (i32.const 20))) (return)))
    (local.set $root (call $ole_storage_new))
    (if (i32.eqz (local.get $root))
      (then
        (call $gs32 (local.get $arg3) (i32.const 0))
        (global.set $eax (i32.const 0x8007000E)) ;; E_OUTOFMEMORY
        (global.set $esp (i32.add (global.get $esp) (i32.const 20))) (return)))
    (call $gs32 (local.get $arg3) (local.get $root))
    (global.set $eax (i32.const 0)) ;; S_OK
    (global.set $esp (i32.add (global.get $esp) (i32.const 20))))

  ;; StgCreateStorageEx(pwcsName, grfMode, stgfmt, grfAttrs, pStgOptions, pSecurity, riid, ppObjectOpen) — 8 args.
  ;; Same in-memory root storage as StgCreateDocfile.
  (func $handle_StgCreateStorageEx (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $ppobj i32) (local $root i32)
    (local.set $ppobj (call $gl32 (i32.add (global.get $esp) (i32.const 32))))
    (if (i32.eqz (local.get $ppobj))
      (then
        (global.set $eax (i32.const 0x80004003))
        (global.set $esp (i32.add (global.get $esp) (i32.const 36))) (return)))
    (local.set $root (call $ole_storage_new))
    (call $gs32 (local.get $ppobj) (local.get $root))
    (global.set $eax (select (i32.const 0) (i32.const 0x8007000E) (i32.ne (local.get $root) (i32.const 0))))
    (global.set $esp (i32.add (global.get $esp) (i32.const 36))))

  ;; StgIsStorageFile(pwcsName) — no real file; report "not a storage file" (S_FALSE).
  (func $handle_StgIsStorageFile (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (i32.const 1)) ;; S_FALSE
    (global.set $esp (i32.add (global.get $esp) (i32.const 8))))

  ;; StgOpenStorage(pwcsName, pstgPriority, grfMode, snbExclude, reserved, ppstgOpen) — 6 args.
  ;; No backing file exists in memory; report not found.
  (func $handle_StgOpenStorage (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $ppstg i32)
    (local.set $ppstg (call $gl32 (i32.add (global.get $esp) (i32.const 24))))
    (if (local.get $ppstg) (then (call $gs32 (local.get $ppstg) (i32.const 0))))
    (global.set $eax (i32.const 0x80030002)) ;; STG_E_FILENOTFOUND
    (global.set $esp (i32.add (global.get $esp) (i32.const 28))))
