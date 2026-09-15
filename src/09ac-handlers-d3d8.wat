  ;; Direct3D 8 compatibility layer.  D3D8's fixed-function state is close
  ;; enough to D3D9 that the device shares the mature D3D9 backend state; the
  ;; ABI-facing vtable and presentation-parameter layout remain strictly D3D8.

  ;; Texture8 cannot reuse Texture9's vtable: D3D9 inserted three methods at
  ;; slot 14.  This per-instance lazy vtable is safe for worker instances and
  ;; leaves the fixed cross-thread registry layout untouched.
  (global $DX_VTBL_D3DTEX8 (mut i32) (i32.const 0))
  ;; D3D8 vertex-declaration token type 2. Spell this semantically because its
  ;; bit pattern happens to overlap the private thread-RPC address range.
  (global $D3D8_DECL_TOKEN_STREAM i32 (i32.const 536870912))

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

  (func $handle_d3d8_unimplemented (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; Keep unsupported D3D8 methods fail-fast, including the original guest
    ;; call frame in the diagnostic. This intentionally never returns.
    (call $host_crash_unimplemented (local.get $name_ptr)
      (global.get $esp) (global.get $eip) (global.get $ebp))
    (unreachable))

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

  (func $handle_IDirect3D8_CheckDeviceType (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $windowed i32)
    ;; this, Adapter, CheckType, DisplayFormat and BackBufferFormat are the five
    ;; direct dispatcher arguments.  Windowed is the sixth COM argument.
    (local.set $windowed (call $gl32 (i32.add (global.get $esp) (i32.const 24))))
    (global.set $esp (i32.add (global.get $esp) (i32.const 28)))
    (if (local.get $arg1) (then
      (global.set $eax (i32.const 0x8876086c)) (return))) ;; D3DERR_INVALIDCALL
    (if (i32.ne (local.get $arg2) (i32.const 1)) (then
      (global.set $eax (i32.const 0x8876086b)) (return))) ;; D3DERR_INVALIDDEVICE
    ;; The sole enumerated display mode is X8R8G8B8.  Its back buffer may add
    ;; alpha, but otherwise must have the same RGB layout.  The shared backend
    ;; supports both its advertised windowed and fullscreen paths.
    (if (i32.or (i32.ne (local.get $arg3) (i32.const 22))
          (i32.and (i32.ne (local.get $arg4) (i32.const 22))
                   (i32.ne (local.get $arg4) (i32.const 21)))) (then
      (global.set $eax (i32.const 0x8876086a)) (return))) ;; D3DERR_NOTAVAILABLE
    (drop (local.get $windowed))
    (global.set $eax (i32.const 0)))

  (func $handle_IDirect3D8_CheckDeviceFormat (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $rtype i32) (local $format i32)
    ;; RType and CheckFormat are arguments six and seven including this.
    (local.set $rtype (call $gl32 (i32.add (global.get $esp) (i32.const 24))))
    (local.set $format (call $gl32 (i32.add (global.get $esp) (i32.const 28))))
    (global.set $esp (i32.add (global.get $esp) (i32.const 32)))
    (if (i32.or (local.get $arg1) (i32.ne (local.get $arg2) (i32.const 1))) (then
      (global.set $eax (i32.const 0x8876086c)) (return))) ;; D3DERR_INVALIDCALL
    ;; Only X8R8G8B8 is exposed as an adapter mode.  Of the D3D8 resource
    ;; families, only ordinary 2D textures currently have a complete create,
    ;; lock and sampling path.  Ask the same format gate CreateTexture uses so
    ;; capability negotiation can never promise a texture it then refuses.
    (if (i32.or (i32.ne (local.get $arg3) (i32.const 22))
          (i32.or (local.get $arg4) (i32.ne (local.get $rtype) (i32.const 3)))) (then
      (global.set $eax (i32.const 0x8876086a)) (return))) ;; D3DERR_NOTAVAILABLE
    (if (i32.eqz (call $d3d9_texture_format_supported (local.get $format))) (then
      (global.set $eax (i32.const 0x8876086a)) (return)))
    (global.set $eax (i32.const 0)))

  (func $handle_IDirect3D8_CheckDeviceMultiSampleType (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $multisample i32)
    ;; arg4 is Windowed; MultiSampleType is the sixth COM argument on-stack.
    (local.set $multisample (call $gl32 (i32.add (global.get $esp) (i32.const 24))))
    (global.set $esp (i32.add (global.get $esp) (i32.const 28)))
    (if (i32.or (local.get $arg1) (i32.gt_u (local.get $multisample) (i32.const 16))) (then
      (global.set $eax (i32.const 0x8876086c)) (return))) ;; D3DERR_INVALIDCALL
    (if (i32.ne (local.get $arg2) (i32.const 1)) (then
      (global.set $eax (i32.const 0x8876086b)) (return))) ;; D3DERR_INVALIDDEVICE
    ;; The backend exposes no antialias target.  NONE works for either
    ;; windowed/fullscreen mode on the two 32-bit color surface layouts it can
    ;; present; every real multisample technique is unavailable.
    (if (i32.or (local.get $multisample)
          (i32.and (i32.ne (local.get $arg3) (i32.const 22))
                   (i32.ne (local.get $arg3) (i32.const 21)))) (then
      (global.set $eax (i32.const 0x8876086a)) (return))) ;; D3DERR_NOTAVAILABLE
    (drop (local.get $arg4))
    (global.set $eax (i32.const 0)))

  (func $d3d8_fill_caps (param $out i32) (result i32)
    (local $caps i32)
    (if (i32.eqz (local.get $out)) (then (return (i32.const 0x8876086c))))
    (local.set $caps (call $g2w (local.get $out)))
    (call $zero_memory (local.get $caps) (i32.const 0xd4))
    (i32.store (local.get $caps) (i32.const 1))       ;; DeviceType = HAL
    ;; Advertise the fixed-function surface the shared WebGL backend actually
    ;; implements. Leaving every bitfield zero made UE2 disable mipmaps and
    ;; material paths even though CreateTexture and the fixed-function compiler
    ;; handle them. Keep cube/volume textures, anisotropy, hardware T&L and
    ;; programmable shaders clear: their D3D8 entry points are not implemented.
    (i32.store offset=0x0c (local.get $caps) (i32.const 0x00080000)) ;; CANRENDERWINDOWED
    (i32.store offset=0x1c (local.get $caps) (i32.const 0x00088f00)) ;; DevCaps
    (i32.store offset=0x20 (local.get $caps) (i32.const 0x00000ef0)) ;; PrimitiveMiscCaps
    (i32.store offset=0x24 (local.get $caps) (i32.const 0x00600190)) ;; RasterCaps
    (i32.store offset=0x28 (local.get $caps) (i32.const 0x000000ff)) ;; ZCmpCaps
    (i32.store offset=0x2c (local.get $caps) (i32.const 0x000007ff)) ;; SrcBlendCaps
    (i32.store offset=0x30 (local.get $caps) (i32.const 0x000007ff)) ;; DestBlendCaps
    (i32.store offset=0x34 (local.get $caps) (i32.const 0x000000ff)) ;; AlphaCmpCaps
    (i32.store offset=0x38 (local.get $caps) (i32.const 0x00084208)) ;; ShadeCaps
    (i32.store offset=0x3c (local.get $caps) (i32.const 0x00004405)) ;; TextureCaps
    (i32.store offset=0x40 (local.get $caps) (i32.const 0x03030300)) ;; TextureFilterCaps
    (i32.store offset=0x4c (local.get $caps) (i32.const 0x00000017)) ;; TextureAddressCaps
    (i32.store offset=0x54 (local.get $caps) (i32.const 0x0000001f)) ;; LineCaps
    (i32.store offset=0x58 (local.get $caps) (i32.const 4096))
    (i32.store offset=0x5c (local.get $caps) (i32.const 4096))
    (i32.store offset=0x64 (local.get $caps) (i32.const 8192)) ;; MaxTextureRepeat
    (i32.store offset=0x68 (local.get $caps) (i32.const 4096)) ;; MaxTextureAspectRatio
    (i32.store offset=0x6c (local.get $caps) (i32.const 1))    ;; MaxAnisotropy
    (f32.store offset=0x70 (local.get $caps) (f32.const 1e10)) ;; MaxVertexW
    (i32.store offset=0x88 (local.get $caps) (i32.const 0x000000ff)) ;; StencilCaps
    (i32.store offset=0x8c (local.get $caps) (i32.const 8)) ;; eight FVF texcoords
    (i32.store offset=0x90 (local.get $caps) (i32.const 0x03feffff)) ;; TextureOpCaps
    (i32.store offset=0x94 (local.get $caps) (i32.const 8))
    (i32.store offset=0x98 (local.get $caps) (i32.const 8))
    (i32.store offset=0x9c (local.get $caps) (i32.const 0x0000003b)) ;; VertexProcessingCaps
    (i32.store offset=0xa0 (local.get $caps) (i32.const 8)) ;; MaxActiveLights
    (f32.store offset=0xb0 (local.get $caps) (f32.const 1)) ;; MaxPointSize
    ;; Zero here means the device cannot draw a single primitive. UE2 records
    ;; these limits and later sizes/splits its dynamic batches from them.
    (i32.store offset=0xb4 (local.get $caps) (i32.const 1048575)) ;; MaxPrimitiveCount
    (i32.store offset=0xb8 (local.get $caps) (i32.const 1048575)) ;; MaxVertexIndex
    (i32.store offset=0xbc (local.get $caps) (i32.const 8)) ;; MaxStreams
    (i32.store offset=0xc0 (local.get $caps) (i32.const 255))
    (i32.store offset=0xc8 (local.get $caps) (i32.const 96)) ;; MaxVertexShaderConst
    (i32.const 0))

  (func $handle_IDirect3D8_GetDeviceCaps (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $esp (i32.add (global.get $esp) (i32.const 20)))
    (if (i32.or (local.get $arg1) (i32.ne (local.get $arg2) (i32.const 1)))
      (then (global.set $eax (i32.const 0x8876086c)) (return)))
    (global.set $eax (call $d3d8_fill_caps (local.get $arg3))))

  (func $handle_IDirect3D8_GetAdapterMonitor (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; Browser guests have no native HMONITOR.  Return NULL without claiming a
    ;; host monitor even for adapter zero.
    (global.set $eax (call $d3d8_adapter_monitor (local.get $arg1)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12))))

  ;; Translate D3DPRESENT_PARAMETERS8 (52 bytes) to the D3D9 layout (56 bytes)
  ;; and let the established D3D9 device/backend allocator do the real work.
  (func $handle_IDirect3D8_CreateDevice (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $pp8 i32) (local $out i32) (local $pp9 i32) (local $dev i32) (local $hr i32)
    (local.set $pp8 (call $gl32 (i32.add (global.get $esp) (i32.const 24))))
    (local.set $out (call $gl32 (i32.add (global.get $esp) (i32.const 28))))
    (if (i32.or (i32.eqz (local.get $pp8)) (i32.eqz (local.get $out))) (then
      (if (local.get $out) (then (call $gs32 (local.get $out) (i32.const 0))))
      (global.set $eax (i32.const 0x8876086c))
      (global.set $esp (i32.add (global.get $esp) (i32.const 32)))
      (return)))
    (local.set $pp9 (call $heap_alloc (i32.const 56)))
    (if (i32.eqz (local.get $pp9)) (then
      (call $gs32 (local.get $out) (i32.const 0))
      (global.set $eax (i32.const 0x8007000e))
      (global.set $esp (i32.add (global.get $esp) (i32.const 32)))
      (return)))
    (call $zero_memory (call $g2w (local.get $pp9)) (i32.const 56))
    (memory.copy (call $g2w (local.get $pp9)) (call $g2w (local.get $pp8)) (i32.const 20))
    (call $gs32 (i32.add (local.get $pp9) (i32.const 24)) (call $gl32 (i32.add (local.get $pp8) (i32.const 20))))
    (call $gs32 (i32.add (local.get $pp9) (i32.const 28)) (call $gl32 (i32.add (local.get $pp8) (i32.const 24))))
    (call $gs32 (i32.add (local.get $pp9) (i32.const 32)) (call $gl32 (i32.add (local.get $pp8) (i32.const 28))))
    (call $gs32 (i32.add (local.get $pp9) (i32.const 36)) (call $gl32 (i32.add (local.get $pp8) (i32.const 32))))
    (call $gs32 (i32.add (local.get $pp9) (i32.const 40)) (call $gl32 (i32.add (local.get $pp8) (i32.const 36))))
    (call $gs32 (i32.add (local.get $pp9) (i32.const 44)) (call $gl32 (i32.add (local.get $pp8) (i32.const 40))))
    (call $gs32 (i32.add (local.get $pp9) (i32.const 48)) (call $gl32 (i32.add (local.get $pp8) (i32.const 44))))
    (call $gs32 (i32.add (local.get $pp9) (i32.const 52)) (call $gl32 (i32.add (local.get $pp8) (i32.const 48))))
    (call $gs32 (i32.add (global.get $esp) (i32.const 24)) (local.get $pp9))
    (call $handle_IDirect3D9_CreateDevice
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
    (local.set $hr (global.get $eax))
    (if (i32.eqz (local.get $hr)) (then
      (local.set $dev (call $gl32 (local.get $out)))
      (if (local.get $dev) (then
        (i32.store (call $g2w (local.get $dev)) (global.get $DX_VTBL_D3DDEV8))))))
    (call $heap_free (local.get $pp9))
    (global.set $eax (local.get $hr)))

  (func $handle_IDirect3DDevice8_QueryInterface (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $esp (i32.add (global.get $esp) (i32.const 16)))
    (if (i32.eqz (local.get $arg2)) (then (global.set $eax (i32.const 0x80004003)) (return)))
    (call $gs32 (local.get $arg2) (i32.const 0))
    (if (i32.eqz (local.get $arg1)) (then (global.set $eax (i32.const 0x80004003)) (return)))
    (if (i32.or
          (call $guid_words_equal (call $g2w (local.get $arg1))
            (i32.const 0) (i32.const 0) (i32.const 0x000000c0) (i32.const 0x46000000))
          (call $guid_words_equal (call $g2w (local.get $arg1))
            (i32.const 0x7385e5df) (i32.const 0x41d58fe8)
            (i32.const 0xb4d7b686) (i32.const 0xcfb64785)))
      (then
        (drop (call $dx_com_addref (local.get $arg0)))
        (call $gs32 (local.get $arg2) (local.get $arg0))
        (global.set $eax (i32.const 0))
        (return)))
    (global.set $eax (i32.const 0x80004002)))

  (func $handle_IDirect3DDevice8_ResourceManagerDiscardBytes (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    ;; The browser backend owns resource residency. The byte count is an
    ;; advisory eviction request, so accepting it without eviction is valid.
    (drop (local.get $arg1))
    (global.set $eax (i32.const 0))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12))))

  (func $handle_IDirect3DDevice8_GetDeviceCaps (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $d3d8_fill_caps (local.get $arg1)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12))))

  (func $handle_IDirect3DDevice8_GetDisplayMode (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $eax (call $d3d8_write_display_mode (local.get $arg1)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 12))))

  ;; D3D9 inserted a swap-chain index before D3D8's back-buffer index.
  ;; Devices in this backend expose only the implicit swap chain, so insert
  ;; zero and correct the delegated stdcall cleanup by one word.
  (func $handle_IDirect3DDevice8_GetBackBuffer (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_IDirect3DDevice9_GetBackBuffer
      (local.get $arg0) (i32.const 0) (local.get $arg1)
      (local.get $arg2) (local.get $arg3) (local.get $name_ptr))
    (global.set $esp (i32.sub (global.get $esp) (i32.const 4))))

  ;; D3D8 overloads SetVertexShader: fixed-function declarations are passed as
  ;; an FVF DWORD, while programmable shaders use handles returned by its
  ;; incompatible CreateVertexShader API. UE2's startup value is an FVF, so
  ;; translate that path to D3D9 SetFVF; shader handles remain explicitly
  ;; unsupported until CreateVertexShader itself has a D3D8 wrapper.
  (func $handle_IDirect3DDevice8_SetVertexShader (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (if (i32.ge_u (local.get $arg1) (i32.const 0x10000))
      (then
        (call $d3d9_declaration_bind (local.get $arg0) (local.get $arg1))
        (global.set $esp (i32.add (global.get $esp) (i32.const 12)))
        (return)))
    (call $handle_IDirect3DDevice9_SetFVF
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr)))

  ;; D3D9 inserted OffsetInBytes before Stride. D3D8 streams always begin at
  ;; byte zero, so supply that field and correct the delegated stack cleanup
  ;; from D3D9's six words back to D3D8's five.
  (func $handle_IDirect3DDevice8_SetStreamSource (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_IDirect3DDevice9_SetStreamSource
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (i32.const 0) (local.get $arg3) (local.get $name_ptr))
    (global.set $esp (i32.sub (global.get $esp) (i32.const 4))))

  ;; D3D8 retains BaseVertexIndex at SetIndices time; D3D9 moved that value to
  ;; DrawIndexedPrimitive. Keep the value in the reserved word between the
  ;; common clear-color and point-scale fields and bind the index buffer
  ;; normally. D3D9 itself neither reads nor writes this word.
  (func $handle_IDirect3DDevice8_SetIndices (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $state i32)
    (call $d3d9_buffer_bind (local.get $arg0) (local.get $arg1)
      (i32.const 7) (i32.const 0) (i32.const 0) (i32.const 0))
    (if (i32.eqz (global.get $eax)) (then
      (local.set $state (call $d3d9_program_state (local.get $arg0)))
      (if (local.get $state) (then
        (call $gs32 (i32.add (local.get $state) (i32.const 1692)) (local.get $arg2))))))
    (global.set $esp (i32.add (global.get $esp) (i32.const 16))))

  ;; D3D8 keeps sampler controls in D3DTEXTURESTAGESTATETYPE. D3D9 moved
  ;; those same controls into D3DSAMPLERSTATETYPE, so forwarding the numeric
  ;; type to the D3D9 texture-stage handler rejected every address/filter call.
  ;; Return the D3D9 sampler-state number, or zero for a true shared TSS.
  (func $d3d8_sampler_type (param $type i32) (result i32)
    (if (result i32) (i32.lt_u (i32.sub (local.get $type) (i32.const 13)) (i32.const 2))
      (then (i32.sub (local.get $type) (i32.const 12)))
      (else (if (result i32) (i32.lt_u (i32.sub (local.get $type) (i32.const 15)) (i32.const 7))
        (then (i32.sub (local.get $type) (i32.const 11)))
        (else (select (i32.const 3) (i32.const 0)
          (i32.eq (local.get $type) (i32.const 25))))))))

  (func $handle_IDirect3DDevice8_GetTextureStageState (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $sampler i32)
    (local.set $sampler (call $d3d8_sampler_type (local.get $arg2)))
    (if (local.get $sampler)
      (then (call $d3d9_sampler_state (local.get $arg0) (local.get $arg1)
        (local.get $sampler) (local.get $arg3) (i32.const 1)))
      (else (if (i32.eq (local.get $arg2) (i32.const 32))
        (then (global.set $eax (i32.const 0x8876086c)))
        (else (call $d3d9_texture_stage_state (local.get $arg0) (local.get $arg1)
          (local.get $arg2) (local.get $arg3) (i32.const 1))))))
    (global.set $esp (i32.add (global.get $esp) (i32.const 20))))

  (func $handle_IDirect3DDevice8_SetTextureStageState (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $sampler i32)
    (local.set $sampler (call $d3d8_sampler_type (local.get $arg2)))
    (if (local.get $sampler)
      (then (call $d3d9_sampler_state (local.get $arg0) (local.get $arg1)
        (local.get $sampler) (local.get $arg3) (i32.const 0)))
      (else (if (i32.eq (local.get $arg2) (i32.const 32))
        (then (global.set $eax (i32.const 0x8876086c)))
        (else (call $d3d9_texture_stage_state (local.get $arg0) (local.get $arg1)
          (local.get $arg2) (local.get $arg3) (i32.const 0))))))
    (global.set $esp (i32.add (global.get $esp) (i32.const 20))))

  ;; D3D8 exposes only render target zero and binds its color/depth pair in a
  ;; single call. D3D9 split those operations and added a target index.
  (func $handle_IDirect3DDevice8_SetRenderTarget (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3d9_color_binding (local.get $arg0) (i32.const 0) (local.get $arg1))
    (if (i32.eqz (global.get $eax))
      (then (call $d3d9_depth_binding (local.get $arg0) (local.get $arg2) (i32.const 0))))
    (global.set $esp (i32.add (global.get $esp) (i32.const 16))))

  (func $handle_IDirect3DDevice8_GetRenderTarget (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $handle_IDirect3DDevice9_GetRenderTarget
      (local.get $arg0) (i32.const 0) (local.get $arg1)
      (local.get $arg3) (local.get $arg4) (local.get $name_ptr))
    (global.set $esp (i32.sub (global.get $esp) (i32.const 4))))

  ;; D3D8 CreateTexture is D3D9 CreateTexture without the final shared-handle
  ;; parameter. Feed its otherwise identical fields to the common allocator.
  (func $handle_IDirect3DDevice8_CreateTexture (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $out i32) (local $texture i32)
    (local.set $out (call $gl32 (i32.add (global.get $esp) (i32.const 32))))
    (call $d3d9_texture_create
      (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4)
      (call $gl32 (i32.add (global.get $esp) (i32.const 24)))
      (call $gl32 (i32.add (global.get $esp) (i32.const 28)))
      (local.get $out))
    (if (i32.eqz (global.get $eax)) (then
      (local.set $texture (call $gl32 (local.get $out)))
      (if (local.get $texture) (then
        (if (i32.eqz (global.get $DX_VTBL_D3DTEX8)) (then
          (global.set $DX_VTBL_D3DTEX8
            (call $init_com_vtable (global.get $API_ID_IDirect3DTexture8_BASE) (i32.const 19)))))
        (call $gs32 (local.get $texture) (global.get $DX_VTBL_D3DTEX8))))))
    (global.set $esp (i32.add (global.get $esp) (i32.const 36))))

  ;; D3D8 vertex/index buffer creation has the same fields as D3D9 except for
  ;; D3D9's trailing shared-handle pointer. Allocate the common buffer object
  ;; directly so the six-argument D3D8 stdcall frame is consumed exactly.
  (func $handle_IDirect3DDevice8_CreateVertexBuffer (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3d9_buffer_create (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4)
      (call $gl32 (i32.add (global.get $esp) (i32.const 24))) (i32.const 6))
    (global.set $esp (i32.add (global.get $esp) (i32.const 28))))

  (func $handle_IDirect3DDevice8_CreateIndexBuffer (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (call $d3d9_buffer_create (local.get $arg0) (local.get $arg1) (local.get $arg2)
      (local.get $arg3) (local.get $arg4)
      (call $gl32 (i32.add (global.get $esp) (i32.const 24))) (i32.const 7))
    (global.set $esp (i32.add (global.get $esp) (i32.const 28))))

  ;; Pair D3D8's retained SetIndices base with every indexed draw while
  ;; preserving the common D3D9 async draw protocol.
  (func $handle_IDirect3DDevice8_DrawIndexedPrimitive (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $state i32) (local $base i32)
    (local.set $state (call $d3d9_program_state (local.get $arg0)))
    (if (local.get $state) (then
      (local.set $base (call $gl32 (i32.add (local.get $state) (i32.const 1692))))))
    (call $d3d9_draw_buffer (local.get $arg0) (local.get $arg1) (local.get $base)
      (local.get $arg2) (local.get $arg3) (local.get $arg4)
      (call $gl32 (i32.add (global.get $esp) (i32.const 24))) (i32.const 1))
    (if (global.get $d3d_render_token) (then (return)))
    (global.set $esp (i32.add (global.get $esp) (i32.const 28))))

  ;; Convert the Direct3D 8 declaration token stream into D3DVERTEXELEMENT9.
  ;; UE2's software-T&L declarations use stream zero, FLOAT1..4/D3DCOLOR and
  ;; no shader function. The returned D3D9 declaration COM pointer is opaque
  ;; to D3D8 callers and serves as their DWORD shader/declaration handle.
  (func $handle_IDirect3DDevice8_CreateVertexShader (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $src i32) (local $tmp i32) (local $elem i32) (local $token i32)
    (local $stream i32) (local $offset i32) (local $dtype i32) (local $reg i32)
    (local $usage i32) (local $usage_index i32) (local $size i32)
    (local $count i32) (local $elements i32)
    (global.set $eax (i32.const 0x8876086c))
    (global.set $esp (i32.add (global.get $esp) (i32.const 24)))
    (if (local.get $arg3) (then (call $gs32 (local.get $arg3) (i32.const 0))))
    (if (i32.or (i32.eqz (local.get $arg1))
          (i32.or (local.get $arg2) (i32.eqz (local.get $arg3)))) (then (return)))
    (local.set $tmp (call $heap_alloc (i32.const 136)))
    (if (i32.eqz (local.get $tmp))
      (then (global.set $eax (i32.const 0x8007000e)) (return)))
    (local.set $src (call $g2w (local.get $arg1)))
    (block $finish (loop $tokens
      (if (i32.ge_u (local.get $count) (i32.const 32))
        (then (call $heap_free (local.get $tmp)) (return)))
      (local.set $token (i32.load (i32.add (local.get $src) (i32.mul (local.get $count) (i32.const 4)))))
      (local.set $count (i32.add (local.get $count) (i32.const 1)))
      (if (i32.eq (local.get $token) (i32.const 0xffffffff)) (then (br $finish)))
      (if (i32.eq (i32.and (local.get $token) (i32.const 0xf0000000)) (global.get $D3D8_DECL_TOKEN_STREAM))
        (then
          (local.set $stream (i32.and (local.get $token) (i32.const 0xf)))
          ;; D3D8 exposes the same sixteen stream selectors now implemented by
          ;; the common D3D9 binding table. Preserve the selector: UT2003's
          ;; terrain declaration splits position/normal/colors/UVs over 0..4.
          (if (i32.ge_u (local.get $stream) (i32.const 16))
            (then (call $heap_free (local.get $tmp)) (return)))
          (local.set $offset (i32.const 0))
          (br $tokens)))
      (if (i32.ne (i32.and (local.get $token) (i32.const 0xf0000000)) (i32.const 0x40000000))
        (then (call $heap_free (local.get $tmp)) (return)))
      (local.set $dtype (i32.and (i32.shr_u (local.get $token) (i32.const 16)) (i32.const 0xf)))
      (local.set $reg (i32.and (local.get $token) (i32.const 0x1f)))
      (if (i32.or (i32.gt_u (local.get $dtype) (i32.const 4))
            (i32.gt_u (local.get $reg) (i32.const 16)))
        (then (call $heap_free (local.get $tmp)) (return)))
      (local.set $usage_index (i32.const 0))
      (local.set $usage
        (if (result i32) (i32.eqz (local.get $reg)) (then (i32.const 0))
          (else (if (result i32) (i32.eq (local.get $reg) (i32.const 1)) (then (i32.const 1))
            (else (if (result i32) (i32.eq (local.get $reg) (i32.const 2)) (then (i32.const 2))
              (else (if (result i32) (i32.eq (local.get $reg) (i32.const 3)) (then (i32.const 3))
                (else (if (result i32) (i32.eq (local.get $reg) (i32.const 4)) (then (i32.const 4))
                  (else (if (result i32) (i32.lt_u (local.get $reg) (i32.const 7))
                    (then (local.set $usage_index (i32.sub (local.get $reg) (i32.const 5))) (i32.const 10))
                    (else (if (result i32) (i32.lt_u (local.get $reg) (i32.const 15))
                      (then (local.set $usage_index (i32.sub (local.get $reg) (i32.const 7))) (i32.const 5))
                      (else (if (result i32) (i32.eq (local.get $reg) (i32.const 15))
                        (then (local.set $usage_index (i32.const 1)) (i32.const 0))
                        (else (local.set $usage_index (i32.const 1)) (i32.const 3))))))))))))))))))
      (local.set $elem (i32.add (call $g2w (local.get $tmp))
        (i32.mul (local.get $elements) (i32.const 8))))
      (i32.store16 (local.get $elem) (local.get $stream))
      (i32.store16 offset=2 (local.get $elem) (local.get $offset))
      (i32.store8 offset=4 (local.get $elem) (local.get $dtype))
      (i32.store8 offset=5 (local.get $elem) (i32.const 0))
      (i32.store8 offset=6 (local.get $elem) (local.get $usage))
      (i32.store8 offset=7 (local.get $elem) (local.get $usage_index))
      (local.set $elements (i32.add (local.get $elements) (i32.const 1)))
      (local.set $size
        (if (result i32) (i32.eqz (local.get $dtype)) (then (i32.const 4))
          (else (if (result i32) (i32.eq (local.get $dtype) (i32.const 1)) (then (i32.const 8))
            (else (if (result i32) (i32.eq (local.get $dtype) (i32.const 2)) (then (i32.const 12))
              (else
                (if (result i32) (i32.eq (local.get $dtype) (i32.const 3))
                  (then (i32.const 16)) (else (i32.const 4))))))))))
      (local.set $offset (i32.add (local.get $offset) (local.get $size)))
      (br $tokens)))
    (local.set $elem (i32.add (call $g2w (local.get $tmp))
      (i32.mul (local.get $elements) (i32.const 8))))
    (i32.store (local.get $elem) (i32.const 0x000000ff))
    (i32.store offset=4 (local.get $elem) (i32.const 0x00000011))
    (call $d3d9_declaration_create (local.get $arg0) (local.get $tmp) (local.get $arg3))
    (call $heap_free (local.get $tmp)))

  (func $handle_IDirect3DDevice8_DeleteVertexShader (param $arg0 i32) (param $arg1 i32) (param $arg2 i32) (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (global.set $esp (i32.add (global.get $esp) (i32.const 12)))
    (global.set $eax (i32.const 0x8876086c))
    (if (i32.ge_u (local.get $arg1) (i32.const 0x10000))
      (then
        (global.set $esp (i32.sub (global.get $esp) (i32.const 12)))
        (call $handle_IDirect3DVertexDeclaration9_Release
          (local.get $arg1) (i32.const 0) (i32.const 0)
          (i32.const 0) (i32.const 0) (local.get $name_ptr))
        (global.set $esp (i32.add (global.get $esp) (i32.const 4)))
        (global.set $eax (i32.const 0)))))
