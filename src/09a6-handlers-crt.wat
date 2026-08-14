  ;; ============================================================
  ;; C RUNTIME / STRING FUNCTION HANDLERS
  ;; ============================================================

  ;; _mbschr(str, ch) — cdecl, find first occurrence of byte in MBCS string
  (func $handle__mbschr (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $wa i32) (local $ch i32) (local $cur i32)
    (local.set $wa (call $g2w (local.get $arg0)))
    (local.set $ch (i32.and (local.get $arg1) (i32.const 0xFF)))
    (block $d (loop $l
      (local.set $cur (i32.load8_u (local.get $wa)))
      (if (i32.eq (local.get $cur) (local.get $ch))
        (then
          (global.set $eax (i32.add (i32.sub (local.get $wa) (i32.const 0x12000)) (global.get $image_base)))
          (global.set $esp (i32.add (global.get $esp) (i32.const 4)))
          (return)))
      (br_if $d (i32.eqz (local.get $cur)))
      (local.set $wa
        (i32.add (local.get $wa)
          (select
            (i32.const 2)
            (i32.const 1)
            (i32.and
              (call $is_dbcs_lead_byte (local.get $cur))
              (i32.ne (i32.load8_u (i32.add (local.get $wa) (i32.const 1))) (i32.const 0))))))
      (br $l)))
    (global.set $eax (i32.const 0))
    (global.set $esp (i32.add (global.get $esp) (i32.const 4)))
  )
  ;; 720: _mbsrchr(str, ch) — cdecl, find last occurrence of byte in MBCS string
  (func $handle__mbsrchr (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $wa i32) (local $last i32) (local $ch i32) (local $cur i32)
    (local.set $wa (call $g2w (local.get $arg0)))
    (local.set $last (i32.const 0))
    (local.set $ch (i32.and (local.get $arg1) (i32.const 0xFF)))
    (block $d (loop $l
      (local.set $cur (i32.load8_u (local.get $wa)))
      (if (i32.eq (local.get $cur) (local.get $ch))
        (then (local.set $last (local.get $wa))))
      (br_if $d (i32.eqz (local.get $cur)))
      (local.set $wa
        (i32.add (local.get $wa)
          (select
            (i32.const 2)
            (i32.const 1)
            (i32.and
              (call $is_dbcs_lead_byte (local.get $cur))
              (i32.ne (i32.load8_u (i32.add (local.get $wa) (i32.const 1))) (i32.const 0))))))
      (br $l)))
    ;; Convert WASM addr back to guest addr, or 0 if not found
    (if (local.get $last)
      (then (global.set $eax (i32.add (i32.sub (local.get $last) (i32.const 0x12000)) (global.get $image_base))))
      (else (global.set $eax (i32.const 0))))
    (global.set $esp (i32.add (global.get $esp) (i32.const 4)))
  )

  ;; 781: _mbsnbcmp(s1, s2, n) — cdecl, compare n bytes (ASCII memcmp)
  (func $handle__mbsnbcmp (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $wa1 i32) (local $wa2 i32) (local $n i32) (local $b1 i32) (local $b2 i32)
    (local.set $wa1 (call $g2w (local.get $arg0)))
    (local.set $wa2 (call $g2w (local.get $arg1)))
    (local.set $n (local.get $arg2))
    (block $done (loop $cmp
      (br_if $done (i32.eqz (local.get $n)))
      (local.set $b1 (i32.load8_u (local.get $wa1)))
      (local.set $b2 (i32.load8_u (local.get $wa2)))
      (if (i32.ne (local.get $b1) (local.get $b2))
        (then
          (global.set $eax (i32.sub (local.get $b1) (local.get $b2)))
          (global.set $esp (i32.add (global.get $esp) (i32.const 4)))
          (return)))
      (local.set $wa1 (i32.add (local.get $wa1) (i32.const 1)))
      (local.set $wa2 (i32.add (local.get $wa2) (i32.const 1)))
      (local.set $n (i32.sub (local.get $n) (i32.const 1)))
      (br $cmp)))
    (global.set $eax (i32.const 0))
    (global.set $esp (i32.add (global.get $esp) (i32.const 4)))
  )

  ;; 783: SHGetFileInfoA(pszPath, dwFileAttributes, psfi, cbFileInfo, uFlags) — 5 args stdcall
  ;; Return 0 (failure) — no shell file info available
  (func $handle_SHGetFileInfoA (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (i32.const 0))
    (global.set $esp (i32.add (global.get $esp) (i32.const 24)))
  )

  ;; 721: _mbsinc(ptr) — cdecl, advance to next MBCS character
  (func $handle__mbsinc (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $mbsinc_ptr (local.get $arg0)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 4)))
  )

  ;; 722: _strdup(str) — cdecl, allocate copy of string
  (func $handle__strdup (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $wa i32) (local $len i32)
    (local.set $wa (call $g2w (local.get $arg0)))
    ;; strlen
    (local.set $len (i32.const 0))
    (block $d (loop $l
      (br_if $d (i32.eqz (i32.load8_u (i32.add (local.get $wa) (local.get $len)))))
      (local.set $len (i32.add (local.get $len) (i32.const 1))) (br $l)))
    (local.set $len (i32.add (local.get $len) (i32.const 1))) ;; include NUL
    (global.set $eax (call $heap_alloc (local.get $len)))
    (memory.copy (call $g2w (global.get $eax)) (local.get $wa) (local.get $len))
    (global.set $esp (i32.add (global.get $esp) (i32.const 4)))
  )

  ;; 723: _stricmp(s1, s2) — cdecl, case-insensitive compare
  (func $handle__stricmp (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $wa1 i32) (local $wa2 i32) (local $c1 i32) (local $c2 i32)
    (local.set $wa1 (call $g2w (local.get $arg0)))
    (local.set $wa2 (call $g2w (local.get $arg1)))
    (block $d (loop $l
      (local.set $c1 (i32.load8_u (local.get $wa1)))
      (local.set $c2 (i32.load8_u (local.get $wa2)))
      ;; tolower
      (if (i32.and (i32.ge_u (local.get $c1) (i32.const 0x41)) (i32.le_u (local.get $c1) (i32.const 0x5A)))
        (then (local.set $c1 (i32.or (local.get $c1) (i32.const 0x20)))))
      (if (i32.and (i32.ge_u (local.get $c2) (i32.const 0x41)) (i32.le_u (local.get $c2) (i32.const 0x5A)))
        (then (local.set $c2 (i32.or (local.get $c2) (i32.const 0x20)))))
      (br_if $d (i32.ne (local.get $c1) (local.get $c2)))
      (br_if $d (i32.eqz (local.get $c1)))
      (local.set $wa1 (i32.add (local.get $wa1) (i32.const 1)))
      (local.set $wa2 (i32.add (local.get $wa2) (i32.const 1)))
      (br $l)))
    (global.set $eax (i32.sub (local.get $c1) (local.get $c2)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 4)))
  )

  ;; 724: strlen(str) — cdecl
  (func $handle_strlen (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $wa i32) (local $len i32)
    (local.set $wa (call $g2w (local.get $arg0)))
    (block $d (loop $l
      (br_if $d (i32.eqz (i32.load8_u (i32.add (local.get $wa) (local.get $len)))))
      (local.set $len (i32.add (local.get $len) (i32.const 1))) (br $l)))
    (global.set $eax (local.get $len))
    (global.set $esp (i32.add (global.get $esp) (i32.const 4)))
  )

  ;; mbstowcs(dst, src, count) — cdecl, single-byte codepage approximation.
  ;; Returns converted WCHAR count excluding the terminating NUL.
  (func $handle_mbstowcs (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $dst i32) (local $src i32) (local $i i32) (local $ch i32)
    (local.set $src (call $g2w (local.get $arg1)))
    (if (i32.eqz (local.get $arg0))
      (then
        (global.set $eax (call $strlen (local.get $src)))
        (global.set $esp (i32.add (global.get $esp) (i32.const 4)))
        (return)))
    (local.set $dst (call $g2w (local.get $arg0)))
    (block $done (loop $copy
      (br_if $done (i32.ge_u (local.get $i) (local.get $arg2)))
      (local.set $ch (i32.load8_u (i32.add (local.get $src) (local.get $i))))
      (i32.store16 (i32.add (local.get $dst) (i32.shl (local.get $i) (i32.const 1))) (local.get $ch))
      (br_if $done (i32.eqz (local.get $ch)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $copy)))
    (global.set $eax (local.get $i))
    (global.set $esp (i32.add (global.get $esp) (i32.const 4)))
  )

  ;; wcstombs(dst, src, count) — cdecl, maps low byte of each WCHAR.
  ;; Returns converted byte count excluding the terminating NUL.
  (func $handle_wcstombs (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $dst i32) (local $src i32) (local $i i32) (local $ch i32)
    (local.set $src (call $g2w (local.get $arg1)))
    (if (i32.eqz (local.get $arg0))
      (then
        (global.set $eax (call $strlen_w (local.get $src)))
        (global.set $esp (i32.add (global.get $esp) (i32.const 4)))
        (return)))
    (local.set $dst (call $g2w (local.get $arg0)))
    (block $done (loop $copy
      (br_if $done (i32.ge_u (local.get $i) (local.get $arg2)))
      (local.set $ch (i32.load16_u (i32.add (local.get $src) (i32.shl (local.get $i) (i32.const 1)))))
      (i32.store8 (i32.add (local.get $dst) (local.get $i)) (local.get $ch))
      (br_if $done (i32.eqz (local.get $ch)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $copy)))
    (global.set $eax (local.get $i))
    (global.set $esp (i32.add (global.get $esp) (i32.const 4)))
  )

  ;; 725: strrchr(str, ch) — cdecl
  (func $handle_strrchr (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $wa i32) (local $last i32) (local $ch i32)
    (local.set $wa (call $g2w (local.get $arg0)))
    (local.set $ch (i32.and (local.get $arg1) (i32.const 0xFF)))
    (block $d (loop $l
      (if (i32.eq (i32.load8_u (local.get $wa)) (local.get $ch))
        (then (local.set $last (local.get $wa))))
      (br_if $d (i32.eqz (i32.load8_u (local.get $wa))))
      (local.set $wa (i32.add (local.get $wa) (i32.const 1)))
      (br $l)))
    (if (local.get $last)
      (then (global.set $eax (i32.add (i32.sub (local.get $last) (i32.const 0x12000)) (global.get $image_base))))
      (else (global.set $eax (i32.const 0))))
    (global.set $esp (i32.add (global.get $esp) (i32.const 4)))
  )

  ;; 726: strcmp(s1, s2) — cdecl
  (func $handle_strcmp (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $wa1 i32) (local $wa2 i32) (local $c1 i32) (local $c2 i32)
    (local.set $wa1 (call $g2w (local.get $arg0)))
    (local.set $wa2 (call $g2w (local.get $arg1)))
    (block $d (loop $l
      (local.set $c1 (i32.load8_u (local.get $wa1)))
      (local.set $c2 (i32.load8_u (local.get $wa2)))
      (br_if $d (i32.ne (local.get $c1) (local.get $c2)))
      (br_if $d (i32.eqz (local.get $c1)))
      (local.set $wa1 (i32.add (local.get $wa1) (i32.const 1)))
      (local.set $wa2 (i32.add (local.get $wa2) (i32.const 1)))
      (br $l)))
    (global.set $eax (i32.sub (local.get $c1) (local.get $c2)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 4)))
  )

  ;; 727: strcpy(dest, src) — cdecl
  (func $handle_strcpy (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $dst i32) (local $src i32) (local $ch i32) (local $i i32)
    (local.set $dst (call $g2w (local.get $arg0)))
    (local.set $src (call $g2w (local.get $arg1)))
    (block $d (loop $l
      (br_if $d (i32.ge_u (local.get $i) (i32.const 65536)))
      (local.set $ch (i32.load8_u (local.get $src)))
      (i32.store8 (local.get $dst) (local.get $ch))
      (br_if $d (i32.eqz (local.get $ch)))
      (local.set $dst (i32.add (local.get $dst) (i32.const 1)))
      (local.set $src (i32.add (local.get $src) (i32.const 1)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $l)))
    (i32.store8 (local.get $dst) (i32.const 0))
    (global.set $eax (local.get $arg0))
    (global.set $esp (i32.add (global.get $esp) (i32.const 4)))
  )

  ;; 728: strncpy(dest, src, count) — cdecl
  (func $handle_strncpy (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $dst i32) (local $src i32) (local $i i32) (local $ch i32)
    (local.set $dst (call $g2w (local.get $arg0)))
    (local.set $src (call $g2w (local.get $arg1)))
    (block $d (loop $l
      (br_if $d (i32.ge_u (local.get $i) (local.get $arg2)))
      (local.set $ch (i32.load8_u (i32.add (local.get $src) (local.get $i))))
      (i32.store8 (i32.add (local.get $dst) (local.get $i)) (local.get $ch))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br_if $l (local.get $ch))
      ;; pad with zeros
      (block $d2 (loop $l2
        (br_if $d2 (i32.ge_u (local.get $i) (local.get $arg2)))
        (i32.store8 (i32.add (local.get $dst) (local.get $i)) (i32.const 0))
        (local.set $i (i32.add (local.get $i) (i32.const 1))) (br $l2)))))
    (global.set $eax (local.get $arg0))
    (global.set $esp (i32.add (global.get $esp) (i32.const 4)))
  )

  ;; 729: strcat(dest, src) — cdecl
  (func $handle_strcat (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $dst i32) (local $src i32) (local $ch i32) (local $i i32)
    (local.set $dst (call $g2w (local.get $arg0)))
    ;; find end of dest
    (block $d (loop $l
      (br_if $d (i32.ge_u (local.get $i) (i32.const 65536)))
      (br_if $d (i32.eqz (i32.load8_u (local.get $dst))))
      (local.set $dst (i32.add (local.get $dst) (i32.const 1)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $l)))
    ;; copy src
    (local.set $src (call $g2w (local.get $arg1)))
    (local.set $i (i32.const 0))
    (block $d2 (loop $l2
      (br_if $d2 (i32.ge_u (local.get $i) (i32.const 65536)))
      (local.set $ch (i32.load8_u (local.get $src)))
      (i32.store8 (local.get $dst) (local.get $ch))
      (br_if $d2 (i32.eqz (local.get $ch)))
      (local.set $dst (i32.add (local.get $dst) (i32.const 1)))
      (local.set $src (i32.add (local.get $src) (i32.const 1)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $l2)))
    (i32.store8 (local.get $dst) (i32.const 0))
    (global.set $eax (local.get $arg0))
    (global.set $esp (i32.add (global.get $esp) (i32.const 4)))
  )

  ;; 730: atoi(str) — cdecl
  (func $handle_atoi (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $wa i32) (local $val i32) (local $neg i32) (local $ch i32)
    (local.set $wa (call $g2w (local.get $arg0)))
    ;; skip whitespace
    (block $d (loop $l
      (local.set $ch (i32.load8_u (local.get $wa)))
      (br_if $d (i32.gt_u (local.get $ch) (i32.const 0x20)))
      (local.set $wa (i32.add (local.get $wa) (i32.const 1))) (br $l)))
    ;; sign
    (if (i32.eq (local.get $ch) (i32.const 0x2D)) ;; '-'
      (then (local.set $neg (i32.const 1))
            (local.set $wa (i32.add (local.get $wa) (i32.const 1))))
      (else (if (i32.eq (local.get $ch) (i32.const 0x2B))
        (then (local.set $wa (i32.add (local.get $wa) (i32.const 1)))))))
    ;; digits
    (block $d2 (loop $l2
      (local.set $ch (i32.load8_u (local.get $wa)))
      (br_if $d2 (i32.lt_u (local.get $ch) (i32.const 0x30)))
      (br_if $d2 (i32.gt_u (local.get $ch) (i32.const 0x39)))
      (local.set $val (i32.add (i32.mul (local.get $val) (i32.const 10)) (i32.sub (local.get $ch) (i32.const 0x30))))
      (local.set $wa (i32.add (local.get $wa) (i32.const 1))) (br $l2)))
    (if (local.get $neg) (then (local.set $val (i32.sub (i32.const 0) (local.get $val)))))
    (global.set $eax (local.get $val))
    (global.set $esp (i32.add (global.get $esp) (i32.const 4)))
  )

  ;; MSVCRT double math returns through x87 ST(0). These are cdecl, so the
  ;; callee only pops the return address; the caller removes stack arguments.
  (func $handle_ceil (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $fpu_push (f64.ceil (f64.load (call $g2w (i32.add (global.get $esp) (i32.const 4))))))
    (global.set $esp (i32.add (global.get $esp) (i32.const 4)))
  )

  (func $handle_sqrt (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $fpu_push (f64.sqrt (f64.load (call $g2w (i32.add (global.get $esp) (i32.const 4))))))
    (global.set $esp (i32.add (global.get $esp) (i32.const 4)))
  )

  (func $handle_sin (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $fpu_push (call $host_math_sin (f64.load (call $g2w (i32.add (global.get $esp) (i32.const 4))))))
    (global.set $esp (i32.add (global.get $esp) (i32.const 4)))
  )

  (func $handle_pow (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $fpu_push
      (call $host_math_pow
        (f64.load (call $g2w (i32.add (global.get $esp) (i32.const 4))))
        (f64.load (call $g2w (i32.add (global.get $esp) (i32.const 12))))))
    (global.set $esp (i32.add (global.get $esp) (i32.const 4)))
  )

  ;; _CIpow is MSVC's x87-stack helper: ST(1)=base, ST(0)=exponent.
  (func $handle__CIpow (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $exponent f64) (local $base f64)
    (local.set $exponent (call $fpu_pop))
    (local.set $base (call $fpu_pop))
    (call $fpu_push (call $host_math_pow (local.get $base) (local.get $exponent)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 4)))
  )

  ;; 731: _ftol — cdecl, convert float on FPU stack to i32 (special: no stack args, reads ST(0))
  (func $handle__ftol (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; Pop ST(0) and truncate to i32
    (global.set $eax (i32.trunc_sat_f64_s (call $fpu_pop)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 4)))
  )

  ;; 732: sprintf(buf, fmt, ...) — cdecl, same as wsprintfA
  (func $handle_sprintf (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $wsprintf_impl
      (local.get $arg0) (local.get $arg1) (i32.add (global.get $esp) (i32.const 12))))
    ;; cdecl: only pop return address
    (global.set $esp (i32.add (global.get $esp) (i32.const 4)))
  )

  ;; 733: realloc(ptr, size) — cdecl
  (func $handle_realloc (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $new_ptr i32) (local $old_size i32)
    ;; realloc(NULL, size) = malloc(size)
    (if (i32.eqz (local.get $arg0))
      (then
        (global.set $eax (call $heap_alloc (local.get $arg1)))
        (global.set $esp (i32.add (global.get $esp) (i32.const 4)))
        (return)))
    ;; realloc(ptr, 0) = free(ptr)
    (if (i32.eqz (local.get $arg1))
      (then
        (call $heap_free (local.get $arg0))
        (global.set $eax (i32.const 0))
        (global.set $esp (i32.add (global.get $esp) (i32.const 4)))
        (return)))
    ;; Read old block size from header (ptr-4 in guest space)
    (local.set $old_size (call $gl32 (i32.sub (local.get $arg0) (i32.const 4))))
    (local.set $new_ptr (call $heap_alloc (local.get $arg1)))
    ;; Copy min(old_size, new_size) bytes
    (if (i32.gt_u (local.get $old_size) (local.get $arg1))
      (then (local.set $old_size (local.get $arg1))))
    (memory.copy (call $g2w (local.get $new_ptr)) (call $g2w (local.get $arg0)) (local.get $old_size))
    (call $heap_free (local.get $arg0))
    (global.set $eax (local.get $new_ptr))
    (global.set $esp (i32.add (global.get $esp) (i32.const 4)))
  )

  ;; 734: _strlwr(str) — cdecl, lowercase string in-place
  (func $handle__strlwr (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $wa i32) (local $ch i32)
    (local.set $wa (call $g2w (local.get $arg0)))
    (block $d (loop $l
      (local.set $ch (i32.load8_u (local.get $wa)))
      (br_if $d (i32.eqz (local.get $ch)))
      (if (i32.and (i32.ge_u (local.get $ch) (i32.const 0x41)) (i32.le_u (local.get $ch) (i32.const 0x5A)))
        (then (i32.store8 (local.get $wa) (i32.or (local.get $ch) (i32.const 0x20)))))
      (local.set $wa (i32.add (local.get $wa) (i32.const 1))) (br $l)))
    (global.set $eax (local.get $arg0))
    (global.set $esp (i32.add (global.get $esp) (i32.const 4)))
  )

  ;; bsearch(key, base, nmemb, size, compar) — cdecl, guest-callback comparator.
  ;; Drives the binary search step-by-step: each probe pushes (key, elem) on the
  ;; stack plus the CACA000C return thunk, then jumps to compar. The continuation
  ;; handler in 09b-dispatch.wat narrows [low, high) based on the returned eax and
  ;; re-enters this helper until the range collapses or a match is found.
  (func $bsearch_probe
    (local $mid i32) (local $elem i32)
    ;; range empty → return NULL to caller
    (if (i32.ge_u (global.get $bsearch_low) (global.get $bsearch_high))
      (then
        (global.set $eax (i32.const 0))
        (global.set $eip (global.get $bsearch_ret))
        (global.set $esp (i32.add (global.get $esp) (i32.const 4)))
        (return)))
    (local.set $mid (i32.div_u
      (i32.add (global.get $bsearch_low) (global.get $bsearch_high))
      (i32.const 2)))
    (global.set $bsearch_mid (local.get $mid))
    (local.set $elem (i32.add (global.get $bsearch_base)
      (i32.mul (local.get $mid) (global.get $bsearch_size))))
    ;; Push compar args (cdecl: right-to-left) then return thunk.
    ;; [esp-4]=thunk, [esp-8]=key, [esp-12]=elem
    (global.set $esp (i32.sub (global.get $esp) (i32.const 4)))
    (call $gs32 (global.get $esp) (local.get $elem))
    (global.set $esp (i32.sub (global.get $esp) (i32.const 4)))
    (call $gs32 (global.get $esp) (global.get $bsearch_key))
    (global.set $esp (i32.sub (global.get $esp) (i32.const 4)))
    (call $gs32 (global.get $esp) (global.get $bsearch_thunk))
    (global.set $eip (global.get $bsearch_compar))
    (global.set $steps (i32.const 0))
  )

  (func $handle_bsearch (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; arg0=key, arg1=base, arg2=nmemb, arg3=size, arg4=compar. cdecl → caller
    ;; pops the 5 args; we only save the return address and leave args in place.
    (global.set $bsearch_ret    (call $gl32 (global.get $esp)))
    (global.set $bsearch_key    (local.get $arg0))
    (global.set $bsearch_base   (local.get $arg1))
    (global.set $bsearch_size   (local.get $arg3))
    (global.set $bsearch_compar (local.get $arg4))
    (global.set $bsearch_low    (i32.const 0))
    (global.set $bsearch_high   (local.get $arg2))
    ;; Empty array or NULL comparator → return NULL immediately.
    (if (i32.or (i32.eqz (local.get $arg2)) (i32.eqz (local.get $arg4)))
      (then
        (global.set $eax (i32.const 0))
        (global.set $esp (i32.add (global.get $esp) (i32.const 4)))
        (return)))
    (call $bsearch_probe)
  )

  ;; fallback: unknown API — crash with full details
  (func $handle_fallback (param $name_ptr i32) (param $api_id i32)
    ;; Route unimplemented ws2_32 names to the soft stub (host_sock_api) before
    ;; crashing. The extended surface (stub2) goes FIRST
    ;; so that where the two overlap (getservbyname) its real implementation wins
    ;; over the older "return NULL" stub. Both read args off the guest stack and
    ;; stdcall-clean $esp themselves, so the fallback just returns on a hit.
    (if (call $winsock_soft_stub2 (call $hash_api_name (local.get $name_ptr)))
      (then (return)))
    (if (call $winsock_soft_stub (call $hash_api_name (local.get $name_ptr)))
      (then (return)))
    (call $host_log_i32 (local.get $api_id))
    (call $host_crash_unimplemented
      (local.get $name_ptr)
      (global.get $esp)
      (global.get $eip)
      (global.get $ebp))
    (unreachable)
  )
  ;; True when GetProcAddress may return a soft-stub thunk (api_id=0xFFFF)
  ;; for this name. `name_wa` is a WASM pointer to a NUL-terminated ASCII name
  ;; (same form $lookup_api_id / $hash_api_name expect).
  (func $winsock_gpa_allow (param $name_wa i32) (result i32)
    (i32.or
      (call $winsock_hash_is_soft (call $hash_api_name (local.get $name_wa)))
      (call $winsock_hash_is_soft2 (call $hash_api_name (local.get $name_wa))))
  )

  (func $winsock_hash_is_soft (param $h i32) (result i32)
    (i32.or (i32.or (i32.or (i32.or
      (i32.eq (local.get $h) (i32.const 0xa2fdb778))  ;; htonl
      (i32.eq (local.get $h) (i32.const 0x9b4be08c))) ;; ntohl
      (i32.or
        (i32.eq (local.get $h) (i32.const 0xb24c04c1))  ;; ntohs
        (i32.eq (local.get $h) (i32.const 0xeeb619ba)))) ;; inet_ntoa
      (i32.or (i32.or
        (i32.eq (local.get $h) (i32.const 0xc7535f2e))  ;; bind
        (i32.eq (local.get $h) (i32.const 0x3b3b76a6))) ;; listen
        (i32.or
          (i32.eq (local.get $h) (i32.const 0x08247e29))  ;; accept
          (i32.eq (local.get $h) (i32.const 0xf8206a4b))))) ;; shutdown
      (i32.or (i32.or (i32.or
        (i32.eq (local.get $h) (i32.const 0x76be7fe9))  ;; getservbyname
        (i32.eq (local.get $h) (i32.const 0xeec8fdb4))) ;; getpeername
        (i32.or
          (i32.eq (local.get $h) (i32.const 0x9b8e7ddc))  ;; getsockname
          (i32.eq (local.get $h) (i32.const 0x1a8be126)))) ;; WSAAsyncSelect
        (i32.or (i32.or
          (i32.eq (local.get $h) (i32.const 0xf0ec5e8e))  ;; WSAEventSelect
          (i32.eq (local.get $h) (i32.const 0x889758b6))) ;; WSAEnumNetworkEvents
          (i32.eq (local.get $h) (i32.const 0x6ed76a1b))))) ;; WSAIoctl
  )

  ;; Implement soft-stubbed winsock APIs. Returns 1 if handled.
  ;; Args still sit on the guest stack at entry; stdcall-clean before return.
  (func $winsock_soft_stub (param $h i32) (result i32)
    (local $a0 i32) (local $a1 i32) (local $a2 i32) (local $a3 i32)
    (local $wa i32) (local $addr i32) (local $i i32) (local $n i32) (local $oct i32)
    (local.set $a0 (call $gl32 (i32.add (global.get $esp) (i32.const 4))))
    (local.set $a1 (call $gl32 (i32.add (global.get $esp) (i32.const 8))))
    (local.set $a2 (call $gl32 (i32.add (global.get $esp) (i32.const 12))))
    (local.set $a3 (call $gl32 (i32.add (global.get $esp) (i32.const 16))))
    ;; htonl / ntohl — 32-bit byte swap, 1 arg
    (if (i32.or (i32.eq (local.get $h) (i32.const 0xa2fdb778))
                 (i32.eq (local.get $h) (i32.const 0x9b4be08c)))
      (then
        (global.set $eax (i32.or (i32.or
          (i32.shl (i32.and (local.get $a0) (i32.const 0xFF)) (i32.const 24))
          (i32.shl (i32.and (local.get $a0) (i32.const 0xFF00)) (i32.const 8)))
          (i32.or
            (i32.shr_u (i32.and (local.get $a0) (i32.const 0xFF0000)) (i32.const 8))
            (i32.shr_u (i32.and (local.get $a0) (i32.const 0xFF000000)) (i32.const 24)))))
        (global.set $esp (i32.add (global.get $esp) (i32.const 8)))
        (return (i32.const 1))))
    ;; ntohs — 16-bit byte swap, 1 arg
    (if (i32.eq (local.get $h) (i32.const 0xb24c04c1))
      (then
        (global.set $eax (i32.or
          (i32.shl (i32.and (local.get $a0) (i32.const 0xFF)) (i32.const 8))
          (i32.and (i32.shr_u (local.get $a0) (i32.const 8)) (i32.const 0xFF))))
        (global.set $esp (i32.add (global.get $esp) (i32.const 8)))
        (return (i32.const 1))))
    ;; inet_ntoa(in_addr by value as u32) — 1 arg; guest ptr to static "a.b.c.d"
    (if (i32.eq (local.get $h) (i32.const 0xeeb619ba))
      (then
        (if (i32.eqz (global.get $winsock_ntoa))
          (then (global.set $winsock_ntoa (call $heap_alloc (i32.const 16)))))
        (local.set $wa (call $g2w (global.get $winsock_ntoa)))
        (local.set $addr (local.get $a0))
        (local.set $i (i32.const 0))
        (local.set $oct (i32.const 0))
        (loop $octs
          (local.set $n (i32.and (local.get $addr) (i32.const 0xFF)))
          (if (i32.ge_u (local.get $n) (i32.const 100))
            (then
              (i32.store8 (i32.add (local.get $wa) (local.get $i))
                (i32.add (i32.const 0x30) (i32.div_u (local.get $n) (i32.const 100))))
              (local.set $i (i32.add (local.get $i) (i32.const 1)))
              (local.set $n (i32.rem_u (local.get $n) (i32.const 100)))
              (i32.store8 (i32.add (local.get $wa) (local.get $i))
                (i32.add (i32.const 0x30) (i32.div_u (local.get $n) (i32.const 10))))
              (local.set $i (i32.add (local.get $i) (i32.const 1)))
              (local.set $n (i32.rem_u (local.get $n) (i32.const 10))))
            (else (if (i32.ge_u (local.get $n) (i32.const 10))
              (then
                (i32.store8 (i32.add (local.get $wa) (local.get $i))
                  (i32.add (i32.const 0x30) (i32.div_u (local.get $n) (i32.const 10))))
                (local.set $i (i32.add (local.get $i) (i32.const 1)))
                (local.set $n (i32.rem_u (local.get $n) (i32.const 10)))))))
          (i32.store8 (i32.add (local.get $wa) (local.get $i))
            (i32.add (i32.const 0x30) (local.get $n)))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (local.set $oct (i32.add (local.get $oct) (i32.const 1)))
          (local.set $addr (i32.shr_u (local.get $addr) (i32.const 8)))
          (if (i32.lt_u (local.get $oct) (i32.const 4))
            (then
              (i32.store8 (i32.add (local.get $wa) (local.get $i)) (i32.const 0x2E))
              (local.set $i (i32.add (local.get $i) (i32.const 1)))
              (br $octs))))
        (i32.store8 (i32.add (local.get $wa) (local.get $i)) (i32.const 0))
        (global.set $eax (global.get $winsock_ntoa))
        (global.set $esp (i32.add (global.get $esp) (i32.const 8)))
        (return (i32.const 1))))
    ;; bind — success no-op, 3 args
    (if (i32.eq (local.get $h) (i32.const 0xc7535f2e))
      (then
        (global.set $eax (i32.const 0))
        (global.set $esp (i32.add (global.get $esp) (i32.const 16)))
        (return (i32.const 1))))
    ;; listen — 2 args
    (if (i32.eq (local.get $h) (i32.const 0x3b3b76a6))
      (then
        (global.set $eax (i32.const 0))
        (global.set $esp (i32.add (global.get $esp) (i32.const 12)))
        (return (i32.const 1))))
    ;; accept — 3 args → INVALID_SOCKET
    (if (i32.eq (local.get $h) (i32.const 0x08247e29))
      (then
        (global.set $eax (i32.const -1))
        (global.set $esp (i32.add (global.get $esp) (i32.const 16)))
        (return (i32.const 1))))
    ;; shutdown — 2 args
    (if (i32.eq (local.get $h) (i32.const 0xf8206a4b))
      (then
        (global.set $eax (i32.const 0))
        (global.set $esp (i32.add (global.get $esp) (i32.const 12)))
        (return (i32.const 1))))
    ;; getservbyname — NULL (caller uses literal port)
    (if (i32.eq (local.get $h) (i32.const 0x76be7fe9))
      (then
        (global.set $eax (i32.const 0))
        (global.set $esp (i32.add (global.get $esp) (i32.const 12)))
        (return (i32.const 1))))
    ;; getpeername / getsockname — SOCKET_ERROR, 3 args
    (if (i32.or (i32.eq (local.get $h) (i32.const 0xeec8fdb4))
                 (i32.eq (local.get $h) (i32.const 0x9b8e7ddc)))
      (then
        (global.set $eax (i32.const -1))
        (global.set $esp (i32.add (global.get $esp) (i32.const 16)))
        (return (i32.const 1))))
    ;; WSAAsyncSelect(s, hwnd, wMsg, lEvent) — 4 args
    (if (i32.eq (local.get $h) (i32.const 0x1a8be126))
      (then
        (global.set $eax (call $host_sock_async_select
          (local.get $a0) (local.get $a1) (local.get $a2) (local.get $a3)))
        (global.set $esp (i32.add (global.get $esp) (i32.const 20)))
        (return (i32.const 1))))
    ;; WSAEventSelect — 3 args
    (if (i32.eq (local.get $h) (i32.const 0xf0ec5e8e))
      (then
        (global.set $eax (i32.const 0))
        (global.set $esp (i32.add (global.get $esp) (i32.const 16)))
        (return (i32.const 1))))
    ;; WSAEnumNetworkEvents — 3 args
    (if (i32.eq (local.get $h) (i32.const 0x889758b6))
      (then
        (global.set $eax (i32.const 0))
        (global.set $esp (i32.add (global.get $esp) (i32.const 16)))
        (return (i32.const 1))))
    ;; WSAIoctl — 9 args
    (if (i32.eq (local.get $h) (i32.const 0x6ed76a1b))
      (then
        (global.set $eax (i32.const 0))
        (global.set $esp (i32.add (global.get $esp) (i32.const 40)))
        (return (i32.const 1))))
    (i32.const 0)
  )

  ;; ══ Optional Winsock host surface ════════════════════════════════════════
  ;; The rest of the ws2_32 surface a period program reaches for. Before this,
  ;; anything outside api_table.json + $winsock_soft_stub above TRAPPED — the
  ;; runtime printed "UNIMPLEMENTED API: <name>" to a console nobody had open
  ;; and executed `unreachable`, so the guest just died.
  ;;
  ;; These entries do the two things WAT must own — read the stdcall args and
  ;; clean the guest stack — and hand the work to ONE host import,
  ;; $host_sock_api(op, …). The host implementation owns the op codes and
  ;; struct layouts.
  ;; Pointer args go through $g2w_or0 (NULL-safe guest→wasm).

  (func $winsock_hash_is_soft2 (param $h i32) (result i32)
    (i32.or (i32.or (i32.or (i32.or
      (i32.eq (local.get $h) (i32.const 0xb844e89a))  ;; gethostname
      (i32.eq (local.get $h) (i32.const 0xdd58403c))) ;; getsockopt
      (i32.or
        (i32.eq (local.get $h) (i32.const 0xe99a661a))  ;; __WSAFDIsSet
        (i32.eq (local.get $h) (i32.const 0x218e6768)))) ;; WSASetLastError
      (i32.or (i32.or
        (i32.eq (local.get $h) (i32.const 0x76be7fe9))  ;; getservbyname
        (i32.eq (local.get $h) (i32.const 0xe65aee8d))) ;; getservbyport
        (i32.or
          (i32.eq (local.get $h) (i32.const 0xfdb93e0d))  ;; getprotobyname
          (i32.eq (local.get $h) (i32.const 0xc829cbbb))))) ;; getprotobynumber
      (i32.or (i32.or (i32.or (i32.or
        (i32.eq (local.get $h) (i32.const 0xe8e269a3))  ;; gethostbyaddr
        (i32.eq (local.get $h) (i32.const 0xdfb6021d))) ;; inet_ntop
        (i32.or
          (i32.eq (local.get $h) (i32.const 0xc5c336e5))  ;; inet_pton
          (i32.eq (local.get $h) (i32.const 0x9467f52c)))) ;; getaddrinfo
        (i32.or (i32.or
          (i32.eq (local.get $h) (i32.const 0x36bc6608))  ;; freeaddrinfo
          (i32.eq (local.get $h) (i32.const 0x8489a1ea))) ;; sendto
          (i32.or
            (i32.eq (local.get $h) (i32.const 0x885f273d))  ;; recvfrom
            (i32.eq (local.get $h) (i32.const 0x94a923e6))))) ;; WSASocketA
        (i32.or (i32.or (i32.or
          (i32.eq (local.get $h) (i32.const 0xa6a9403c))  ;; WSASocketW
          (i32.eq (local.get $h) (i32.const 0xc2bda844))) ;; WSAHtons
          (i32.or
            (i32.eq (local.get $h) (i32.const 0xc9bdb349))  ;; WSAHtonl
            (i32.eq (local.get $h) (i32.const 0xe9c4003c)))) ;; WSANtohs
          (i32.or (i32.or
            (i32.eq (local.get $h) (i32.const 0xe0c3f211))  ;; WSANtohl
            (i32.eq (local.get $h) (i32.const 0xbc9b094d))) ;; WSAIsBlocking
            (i32.or (i32.or
              (i32.eq (local.get $h) (i32.const 0xf83c3c8e))  ;; WSASetBlockingHook
              (i32.eq (local.get $h) (i32.const 0x4a2cf502))) ;; WSAUnhookBlockingHook
              (i32.or
                (i32.eq (local.get $h) (i32.const 0x624b46f7))  ;; WSACancelBlockingCall
                (i32.eq (local.get $h) (i32.const 0xf371be25))))))))) ;; WSACancelAsyncRequest
  )

  ;; Returns 1 if handled (eax set, guest stack cleaned).
  (func $winsock_soft_stub2 (param $h i32) (result i32)
    (local $a0 i32) (local $a1 i32) (local $a2 i32) (local $a3 i32)
    (local $a4 i32) (local $a5 i32) (local $buf i32)
    (local.set $a0 (call $gl32 (i32.add (global.get $esp) (i32.const 4))))
    (local.set $a1 (call $gl32 (i32.add (global.get $esp) (i32.const 8))))
    (local.set $a2 (call $gl32 (i32.add (global.get $esp) (i32.const 12))))
    (local.set $a3 (call $gl32 (i32.add (global.get $esp) (i32.const 16))))
    (local.set $a4 (call $gl32 (i32.add (global.get $esp) (i32.const 20))))
    (local.set $a5 (call $gl32 (i32.add (global.get $esp) (i32.const 24))))

    ;; gethostname(name, namelen) → 0 | SOCKET_ERROR — 2 args
    (if (i32.eq (local.get $h) (i32.const 0xb844e89a))
      (then
        (global.set $eax (call $host_sock_api (i32.const 1)
          (call $g2w_or0 (local.get $a0)) (local.get $a1)
          (i32.const 0) (i32.const 0) (i32.const 0)))
        (global.set $esp (i32.add (global.get $esp) (i32.const 12)))
        (return (i32.const 1))))

    ;; getsockopt(s, level, optname, optval, optlen) — 5 args
    (if (i32.eq (local.get $h) (i32.const 0xdd58403c))
      (then
        (global.set $eax (call $host_sock_api (i32.const 2)
          (local.get $a0) (local.get $a1) (local.get $a2)
          (call $g2w_or0 (local.get $a3)) (call $g2w_or0 (local.get $a4))))
        (global.set $esp (i32.add (global.get $esp) (i32.const 24)))
        (return (i32.const 1))))

    ;; WSASetLastError(err) — 1 arg, no return value
    (if (i32.eq (local.get $h) (i32.const 0x218e6768))
      (then
        (drop (call $host_sock_api (i32.const 3)
          (local.get $a0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)))
        (global.set $eax (i32.const 0))
        (global.set $esp (i32.add (global.get $esp) (i32.const 8)))
        (return (i32.const 1))))

    ;; __WSAFDIsSet(s, set) — 2 args. FD_ISSET expands to this, so EVERY
    ;; select() caller needs it (it was missing entirely).
    (if (i32.eq (local.get $h) (i32.const 0xe99a661a))
      (then
        (global.set $eax (call $host_sock_api (i32.const 4)
          (local.get $a0) (call $g2w_or0 (local.get $a1))
          (i32.const 0) (i32.const 0) (i32.const 0)))
        (global.set $esp (i32.add (global.get $esp) (i32.const 12)))
        (return (i32.const 1))))

    ;; getservbyname(name, proto) — 2 args; returns a pointer into the static
    ;; servent (winsock's per-thread-static contract).
    (if (i32.eq (local.get $h) (i32.const 0x76be7fe9))
      (then
        (if (i32.eqz (global.get $winsock_servent))
          (then (global.set $winsock_servent (call $heap_alloc (i32.const 128)))))
        (local.set $buf (global.get $winsock_servent))
        (global.set $eax (call $host_sock_api (i32.const 5)
          (call $g2w_or0 (local.get $a0)) (call $g2w_or0 (local.get $a1))
          (call $g2w (local.get $buf)) (local.get $buf) (i32.const 0)))
        (global.set $esp (i32.add (global.get $esp) (i32.const 12)))
        (return (i32.const 1))))

    ;; getservbyport(port, proto) — 2 args; port arrives in network order.
    (if (i32.eq (local.get $h) (i32.const 0xe65aee8d))
      (then
        (if (i32.eqz (global.get $winsock_servent))
          (then (global.set $winsock_servent (call $heap_alloc (i32.const 128)))))
        (local.set $buf (global.get $winsock_servent))
        (global.set $eax (call $host_sock_api (i32.const 6)
          (local.get $a0) (call $g2w_or0 (local.get $a1))
          (call $g2w (local.get $buf)) (local.get $buf) (i32.const 0)))
        (global.set $esp (i32.add (global.get $esp) (i32.const 12)))
        (return (i32.const 1))))

    ;; getprotobyname(name) — 1 arg
    (if (i32.eq (local.get $h) (i32.const 0xfdb93e0d))
      (then
        (if (i32.eqz (global.get $winsock_protoent))
          (then (global.set $winsock_protoent (call $heap_alloc (i32.const 128)))))
        (local.set $buf (global.get $winsock_protoent))
        (global.set $eax (call $host_sock_api (i32.const 7)
          (call $g2w_or0 (local.get $a0))
          (call $g2w (local.get $buf)) (local.get $buf)
          (i32.const 0) (i32.const 0)))
        (global.set $esp (i32.add (global.get $esp) (i32.const 8)))
        (return (i32.const 1))))

    ;; getprotobynumber(num) — 1 arg
    (if (i32.eq (local.get $h) (i32.const 0xc829cbbb))
      (then
        (if (i32.eqz (global.get $winsock_protoent))
          (then (global.set $winsock_protoent (call $heap_alloc (i32.const 128)))))
        (local.set $buf (global.get $winsock_protoent))
        (global.set $eax (call $host_sock_api (i32.const 8)
          (local.get $a0)
          (call $g2w (local.get $buf)) (local.get $buf)
          (i32.const 0) (i32.const 0)))
        (global.set $esp (i32.add (global.get $esp) (i32.const 8)))
        (return (i32.const 1))))

    ;; gethostbyaddr(addr, len, type) — 3 args. Reuses the SAME static hostent
    ;; gethostbyname returns into, matching winsock's per-thread-static contract.
    (if (i32.eq (local.get $h) (i32.const 0xe8e269a3))
      (then
        (if (i32.eqz (global.get $winsock_hostent))
          (then (global.set $winsock_hostent (call $heap_alloc (i32.const 256)))))
        (local.set $buf (global.get $winsock_hostent))
        (global.set $eax (call $host_sock_api (i32.const 9)
          (call $g2w_or0 (local.get $a0)) (local.get $a1) (local.get $a2)
          (call $g2w (local.get $buf)) (local.get $buf)))
        (global.set $esp (i32.add (global.get $esp) (i32.const 16)))
        (return (i32.const 1))))

    ;; inet_ntop(af, src, dst, size) → dst | NULL — 4 args (caller's buffer).
    (if (i32.eq (local.get $h) (i32.const 0xdfb6021d))
      (then
        (global.set $eax (call $host_sock_api (i32.const 10)
          (local.get $a0) (call $g2w_or0 (local.get $a1))
          (call $g2w_or0 (local.get $a2)) (local.get $a3) (local.get $a2)))
        (global.set $esp (i32.add (global.get $esp) (i32.const 20)))
        (return (i32.const 1))))

    ;; inet_pton(af, src, dst) → 1 | 0 | -1 — 3 args
    (if (i32.eq (local.get $h) (i32.const 0xc5c336e5))
      (then
        (global.set $eax (call $host_sock_api (i32.const 11)
          (local.get $a0) (call $g2w_or0 (local.get $a1))
          (call $g2w_or0 (local.get $a2)) (i32.const 0) (i32.const 0)))
        (global.set $esp (i32.add (global.get $esp) (i32.const 16)))
        (return (i32.const 1))))

    ;; getaddrinfo(node, service, hints, res) → 0 | error — 4 args. One
    ;; AF_INET/SOCK_STREAM result in the static buffer; hints are ignored.
    (if (i32.eq (local.get $h) (i32.const 0x9467f52c))
      (then
        (if (i32.eqz (global.get $winsock_addrinfo))
          (then (global.set $winsock_addrinfo (call $heap_alloc (i32.const 256)))))
        (local.set $buf (global.get $winsock_addrinfo))
        (global.set $eax (call $host_sock_api (i32.const 12)
          (call $g2w_or0 (local.get $a0)) (call $g2w_or0 (local.get $a1))
          (call $g2w_or0 (local.get $a3))
          (call $g2w (local.get $buf)) (local.get $buf)))
        (global.set $esp (i32.add (global.get $esp) (i32.const 20)))
        (return (i32.const 1))))

    ;; freeaddrinfo(ai) — 1 arg, no return: the storage is static, so nothing
    ;; to free. Accepting the call is the whole point (it used to trap).
    (if (i32.eq (local.get $h) (i32.const 0x36bc6608))
      (then
        (global.set $eax (i32.const 0))
        (global.set $esp (i32.add (global.get $esp) (i32.const 8)))
        (return (i32.const 1))))

    ;; sendto(s, buf, len, flags, to, tolen) — 6 args
    (if (i32.eq (local.get $h) (i32.const 0x8489a1ea))
      (then
        (global.set $eax (call $host_sock_api (i32.const 13)
          (local.get $a0) (call $g2w_or0 (local.get $a1)) (local.get $a2)
          (call $g2w_or0 (local.get $a4)) (i32.const 0)))
        (global.set $esp (i32.add (global.get $esp) (i32.const 28)))
        (return (i32.const 1))))

    ;; recvfrom(s, buf, len, flags, from, fromlen) — 6 args
    (if (i32.eq (local.get $h) (i32.const 0x885f273d))
      (then
        (global.set $eax (call $host_sock_api (i32.const 14)
          (local.get $a0) (call $g2w_or0 (local.get $a1)) (local.get $a2)
          (call $g2w_or0 (local.get $a4)) (call $g2w_or0 (local.get $a5))))
        (global.set $esp (i32.add (global.get $esp) (i32.const 28)))
        (return (i32.const 1))))

    ;; WSAHtons/WSANtohs(s, value, lpout) — 3 args, 16-bit swap through lpout.
    (if (i32.or (i32.eq (local.get $h) (i32.const 0xc2bda844))
                 (i32.eq (local.get $h) (i32.const 0xe9c4003c)))
      (then
        (global.set $eax (call $host_sock_api (i32.const 15)
          (i32.const 2) (local.get $a1) (call $g2w_or0 (local.get $a2))
          (i32.const 0) (i32.const 0)))
        (global.set $esp (i32.add (global.get $esp) (i32.const 16)))
        (return (i32.const 1))))

    ;; WSAHtonl/WSANtohl(s, value, lpout) — 3 args, 32-bit swap through lpout.
    (if (i32.or (i32.eq (local.get $h) (i32.const 0xc9bdb349))
                 (i32.eq (local.get $h) (i32.const 0xe0c3f211)))
      (then
        (global.set $eax (call $host_sock_api (i32.const 15)
          (i32.const 4) (local.get $a1) (call $g2w_or0 (local.get $a2))
          (i32.const 0) (i32.const 0)))
        (global.set $esp (i32.add (global.get $esp) (i32.const 16)))
        (return (i32.const 1))))

    ;; WSASocketA/W(af, type, proto, lpProtocolInfo, g, flags) — 6 args. The
    ;; winsock2 spelling of socket(); the optional host transport owns it.
    (if (i32.or (i32.eq (local.get $h) (i32.const 0x94a923e6))
                 (i32.eq (local.get $h) (i32.const 0xa6a9403c)))
      (then
        (global.set $eax (call $host_sock_socket
          (local.get $a0) (local.get $a1) (local.get $a2)))
        (global.set $esp (i32.add (global.get $esp) (i32.const 28)))
        (return (i32.const 1))))

    ;; The Winsock 1.1 blocking-hook family. We never block the guest behind a
    ;; hook (a blocking recv is owned by the host), so the honest answers
    ;; are: not blocking, no previous hook, nothing to cancel.
    ;; WSAIsBlocking() / WSAUnhookBlockingHook() — 0 args
    (if (i32.or (i32.eq (local.get $h) (i32.const 0xbc9b094d))
                 (i32.eq (local.get $h) (i32.const 0x4a2cf502)))
      (then
        (global.set $eax (i32.const 0))
        (global.set $esp (i32.add (global.get $esp) (i32.const 4)))
        (return (i32.const 1))))
    ;; WSACancelBlockingCall() — 0 args
    (if (i32.eq (local.get $h) (i32.const 0x624b46f7))
      (then
        (global.set $eax (i32.const 0))
        (global.set $esp (i32.add (global.get $esp) (i32.const 4)))
        (return (i32.const 1))))
    ;; WSASetBlockingHook(lpBlockFunc) / WSACancelAsyncRequest(h) — 1 arg
    (if (i32.or (i32.eq (local.get $h) (i32.const 0xf83c3c8e))
                 (i32.eq (local.get $h) (i32.const 0xf371be25)))
      (then
        (global.set $eax (i32.const 0))
        (global.set $esp (i32.add (global.get $esp) (i32.const 8)))
        (return (i32.const 1))))

    (i32.const 0)
  )
