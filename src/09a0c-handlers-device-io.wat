  ;; ============================================================
  ;; DEVICE I/O CONTROL
  ;; ============================================================

  ;; DeviceIoControl is imported by WinRAR 3.10, Far 1.70 and 7zFM.  Their
  ;; call sites do not issue ordinary file reads or writes:
  ;;
  ;;   WinRAR/Far  0x00000001/06   Win9x \\.\vwin32 DOS register requests
  ;;   7zFM        0x00074004      IOCTL_DISK_GET_PARTITION_INFO
  ;;               0x00070000      IOCTL_DISK_GET_DRIVE_GEOMETRY
  ;;               0x0002404c      IOCTL_CDROM_GET_DRIVE_GEOMETRY
  ;;   Far         0x002d0c04      IOCTL_STORAGE_GET_MEDIA_TYPES_EX
  ;;               0x0004d004      IOCTL_SCSI_PASS_THROUGH
  ;;               0x002d1400      IOCTL_STORAGE_QUERY_PROPERTY
  ;;               0x00090018/1c   FSCTL_LOCK_VOLUME/UNLOCK_VOLUME
  ;;               0x002d4800/04   EJECT_MEDIA/MEDIA_REMOVAL
  ;;               0x002d4808/0c   LOAD_MEDIA/RESERVE
  ;;               0x0009c040      FSCTL_SET_COMPRESSION
  ;;               0x000900a4/a8/ac SET/GET/DELETE_REPARSE_POINT
  ;;
  ;; The browser VFS has files and directories, but no device-driver handles,
  ;; physical geometry, removable media, volume locks, per-file compression,
  ;; or reparse points.  Microsoft documents these controls as operations on
  ;; the corresponding device/volume/file-system facilities.  Claiming any of
  ;; them succeeded would fabricate state.  Keep the API callable so all three
  ;; programs can take their own documented failure paths, and distinguish a
  ;; recognized-but-unavailable request (ERROR_NOT_SUPPORTED) from an unknown
  ;; control code (ERROR_INVALID_FUNCTION).
  (func $device_io_known_control (param $code i32) (result i32)
    (if (i32.eq (local.get $code) (i32.const 0x00000001)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $code) (i32.const 0x00000006)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $code) (i32.const 0x00074004)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $code) (i32.const 0x00070000)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $code) (i32.const 0x0002404c)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $code) (i32.const 0x002d0c04)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $code) (i32.const 0x0004d004)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $code) (i32.const 0x002d1400)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $code) (i32.const 0x00090018)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $code) (i32.const 0x0009001c)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $code) (i32.const 0x002d4800)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $code) (i32.const 0x002d4804)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $code) (i32.const 0x002d4808)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $code) (i32.const 0x002d480c)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $code) (i32.const 0x0009c040)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $code) (i32.const 0x000900a4)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $code) (i32.const 0x000900a8)) (then (return (i32.const 1))))
    (if (i32.eq (local.get $code) (i32.const 0x000900ac)) (then (return (i32.const 1))))
    (i32.const 0))

  (func $device_io_guest_range (param $ptr i32) (param $size i32) (result i32)
    (if (i32.eqz (local.get $size)) (then (return (i32.const 1))))
    (if (i32.eqz (local.get $ptr)) (then (return (i32.const 0))))
    (i32.ne
      (call $g2w_affine_span (local.get $ptr) (local.get $size))
      (global.get $NULL_SENTINEL)))

  (func $device_io_error
      (param $handle i32) (param $code i32)
      (param $in i32) (param $in_size i32)
      (param $out i32) (param $out_size i32)
      (param $bytes_returned i32) (param $overlapped i32) (result i32)
    ;; Only an extant browser-VFS file handle is representable here.  Console,
    ;; process, synchronization, device-name, and unknown handles fail before
    ;; any guest output is inspected or changed.
    (if (i32.eq (call $host_fs_get_file_size (local.get $handle)) (i32.const -1))
      (then (return (i32.const 6)))) ;; ERROR_INVALID_HANDLE
    ;; Every target call is synchronous.  The VFS does not retain the
    ;; FILE_FLAG_OVERLAPPED bit or an asynchronous device queue.
    (if (local.get $overlapped)
      (then (return (i32.const 50)))) ;; ERROR_NOT_SUPPORTED
    ;; Microsoft requires lpBytesReturned for a synchronous request.  Validate
    ;; every complete span before dispatch.  No path below stores through any
    ;; of them, preserving all caller buffers atomically on failure.
    (if (i32.or
          (i32.eqz (call $device_io_guest_range
            (local.get $bytes_returned) (i32.const 4)))
          (i32.or
            (i32.eqz (call $device_io_guest_range
              (local.get $in) (local.get $in_size)))
            (i32.eqz (call $device_io_guest_range
              (local.get $out) (local.get $out_size)))))
      (then (return (i32.const 87)))) ;; ERROR_INVALID_PARAMETER
    (select
      (i32.const 50) ;; ERROR_NOT_SUPPORTED
      (i32.const 1)  ;; ERROR_INVALID_FUNCTION
      (call $device_io_known_control (local.get $code))))

  ;; BOOL DeviceIoControl(hDevice, code, in, inSize, out, outSize,
  ;;                      bytesReturned, overlapped) -- eight-argument stdcall.
  ;; The dispatcher passes the first five arguments directly.  The remaining
  ;; three are still on the guest stack at +24/+28/+32 from the return slot.
  (func $handle_DeviceIoControl
      (param $arg0 i32) (param $arg1 i32) (param $arg2 i32)
      (param $arg3 i32) (param $arg4 i32) (param $name_ptr i32)
    (local $out_size i32) (local $bytes_returned i32) (local $overlapped i32)
    (local.set $out_size (call $gl32
      (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24))))
    (local.set $bytes_returned (call $gl32
      (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28))))
    (local.set $overlapped (call $gl32
      (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32))))

    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (global.set $last_error
      (call $device_io_error
        (local.get $arg0) (local.get $arg1)
        (local.get $arg2) (local.get $arg3)
        (local.get $arg4) (local.get $out_size)
        (local.get $bytes_returned) (local.get $overlapped)))
    (i32.store offset=16 (global.get $reg_base) (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 36))))
