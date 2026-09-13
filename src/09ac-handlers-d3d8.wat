  ;; Direct3D 8 capability-only compatibility facade.  UE2 probes this object
  ;; before honoring a non-D3D renderer choice.  It intentionally exposes no
  ;; IDirect3DDevice8: CreateDevice returns D3DERR_NOTAVAILABLE.

  (func $d3d8_not_available (result i32) (i32.const 0x8876086a))
  (func $d3d8_adapter_count (result i32) (i32.const 1))
  (func $d3d8_mode_count (param $adapter i32) (result i32)
    (i32.eqz (local.get $adapter)))
  (func $d3d8_adapter_monitor (param $adapter i32) (result i32)
    (drop (local.get $adapter))
    (i32.const 0))

  (func $handle_d3d8_not_available_6 (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $d3d8_not_available))
    (global.set $esp (i32.add (global.get $esp) (i32.const 28))))

  (func $handle_d3d8_not_available_7 (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $d3d8_not_available))
    (global.set $esp (i32.add (global.get $esp) (i32.const 32))))

  (func $handle_Direct3DCreate8 (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $dx_create_com_obj (i32.const 37) (global.get $DX_VTBL_D3D8)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8))))

  (func $handle_IDirect3D8_QueryInterface (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $iid i32)
    (global.set $esp (i32.add (global.get $esp) (i32.const 16)))
    (if (i32.eqz (local.get $arg2))
      (then (global.set $eax (i32.const 0x80004003)) (return))) ;; E_POINTER
    (call $gs32 (local.get $arg2) (i32.const 0))
    (if (i32.eqz (local.get $arg1))
      (then (global.set $eax (i32.const 0x80004003)) (return)))
    (local.set $iid (call $g2w (local.get $arg1)))
    ;; IID_IUnknown or IID_IDirect3D8
    (if (i32.or
          (call $guid_words_equal (local.get $iid)
            (i32.const 0) (i32.const 0) (i32.const 0x000000c0) (i32.const 0x46000000))
          (call $guid_words_equal (local.get $iid)
            (i32.const 0x1dd9e8da) (i32.const 0x4d401c77)
            (i32.const 0xfe98cfb0) (i32.const 0x1295fffd)))
      (then
        (drop (call $dx_com_addref (local.get $arg0)))
        (call $gs32 (local.get $arg2) (local.get $arg0))
        (global.set $eax (i32.const 0))
        (return)))
    (global.set $eax (i32.const 0x80004002))) ;; E_NOINTERFACE

  (func $handle_IDirect3D8_RegisterSoftwareDevice (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $d3d8_not_available))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12))))

  (func $handle_IDirect3D8_GetAdapterCount (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $d3d8_adapter_count))
    (global.set $esp (i32.add (global.get $esp) (i32.const 8))))

  (func $handle_IDirect3D8_GetAdapterIdentifier (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $esp (i32.add (global.get $esp) (i32.const 20)))
    (if (i32.or (local.get $arg1) (i32.eqz (local.get $arg3)))
      (then (global.set $eax (i32.const 0x8876086c)) (return)))
    ;; D3DADAPTER_IDENTIFIER8 is 0x42c bytes.  A zeroed identifier is valid
    ;; enough for compatibility probes and avoids inventing PCI/WHQL data.
    (call $zero_memory (call $g2w (local.get $arg3)) (i32.const 0x42c))
    (global.set $eax (i32.const 0)))

  (func $handle_IDirect3D8_GetAdapterModeCount (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $d3d8_mode_count (local.get $arg1)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12))))

  (func $d3d8_write_display_mode (param $out i32) (result i32)
    (if (i32.eqz (local.get $out)) (then (return (i32.const 0x8876086c))))
    (call $gs32 (local.get $out) (i32.const 640))
    (call $gs32 (i32.add (local.get $out) (i32.const 4)) (i32.const 480))
    (call $gs32 (i32.add (local.get $out) (i32.const 8)) (i32.const 60))
    (call $gs32 (i32.add (local.get $out) (i32.const 12)) (i32.const 22)) ;; X8R8G8B8
    (i32.const 0))

  (func $handle_IDirect3D8_EnumAdapterModes (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax
      (if (result i32) (i32.and (i32.eqz (local.get $arg1)) (i32.eqz (local.get $arg2)))
        (then (call $d3d8_write_display_mode (local.get $arg3)))
        (else (i32.const 0x8876086c))))
    (global.set $esp (i32.add (global.get $esp) (i32.const 20))))

  (func $handle_IDirect3D8_GetAdapterDisplayMode (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax
      (if (result i32) (i32.eqz (local.get $arg1))
        (then (call $d3d8_write_display_mode (local.get $arg2)))
        (else (i32.const 0x8876086c))))
    (global.set $esp (i32.add (global.get $esp) (i32.const 16))))

  (func $handle_IDirect3D8_GetDeviceCaps (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $caps i32)
    (global.set $esp (i32.add (global.get $esp) (i32.const 20)))
    (if (i32.or (local.get $arg1) (i32.ne (local.get $arg2) (i32.const 1)))
      (then (global.set $eax (i32.const 0x8876086c)) (return)))
    (if (i32.eqz (local.get $arg3))
      (then (global.set $eax (i32.const 0x8876086c)) (return)))
    (local.set $caps (call $g2w (local.get $arg3)))
    (call $zero_memory (local.get $caps) (i32.const 0xd4))
    (i32.store (local.get $caps) (i32.const 1))       ;; DeviceType = HAL
    (i32.store offset=0x58 (local.get $caps) (i32.const 4096))
    (i32.store offset=0x5c (local.get $caps) (i32.const 4096))
    (i32.store offset=0x94 (local.get $caps) (i32.const 8))
    (i32.store offset=0x98 (local.get $caps) (i32.const 8))
    (i32.store offset=0xbc (local.get $caps) (i32.const 8)) ;; MaxStreams
    (i32.store offset=0xc0 (local.get $caps) (i32.const 255))
    (global.set $eax (i32.const 0)))

  (func $handle_IDirect3D8_GetAdapterMonitor (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; Browser guests have no native HMONITOR.  Return NULL without claiming a
    ;; host monitor even for adapter zero.
    (global.set $eax (call $d3d8_adapter_monitor (local.get $arg1)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12))))
