  ;; ---- ListView WndProc ----
  ;;
  ;; Bounded SysListView32 subset for report/list panes. This is intentionally
  ;; smaller than a full common-control clone: it stores columns, fixed 8-slot
  ;; subitem text rows, per-item LVIS_* state, and a vertical top index. That is
  ;; enough for RegEdit/installer details panes to become stateful and for the
  ;; shared Win98 scrollbar helpers to be reused here.
  ;;
  ;; ListViewState (80 bytes, allocated in WM_CREATE)
  ;;   +0   item_count
  ;;   +4   item_cap
  ;;   +8   item_cells_ptr   guest ptr to item_cap * 44-byte rows:
  ;;                          +0..+31 8 x u32 subitem text pointers,
  ;;                          +32 iImage, +36 lParam, +40 LVIS_* state
  ;;   +12  reserved
  ;;   +16  col_count
  ;;   +20  col_cap
  ;;   +24  col_widths_ptr   guest ptr to u32[]
  ;;   +28  col_texts_ptr    guest ptr to u32[] heap string pointers
  ;;   +32  selection_mark   most recently selected row, -1 = none. Selection
  ;;                         itself is the per-item LVIS_SELECTED bit: Win98's
  ;;                         default ListView permits multiple selected rows.
  ;;   +36  top_index        content viewport (LVM_GETTOPINDEX), distinct from
  ;;                         the thumb-only state changed by SetScrollPos
  ;;   +40  extended_style   LVM_SETEXTENDEDLISTVIEWSTYLE shadow
  ;;   +44  drag_anchor_y
  ;;   +48  drag_anchor_top
  ;;   +52  small_image_list handle from LVM_SETIMAGELIST
  ;;   +56  bk_color COLORREF
  ;;   +60  text_color COLORREF
  ;;   +64  text_bk_color COLORREF or CLR_NONE
  ;;   +68  state_image_list handle from LVM_SETIMAGELIST(LVSIL_STATE)
  ;;   +72  normal_image_list handle from LVM_SETIMAGELIST(LVSIL_NORMAL)
  ;; The control id is NOT in the record: $ctrl_table_get_id($hwnd).

  ;; ---- ListViewState accessors ----
  ;;
  ;; Eighteen fields, and three of them are counts whose neighbour is the
  ;; matching capacity (+0/+4 items, +16/+20 columns) — spelled as bare
  ;; offsets, storing an item count into item_cap reads as a plausible line
  ;; and corrupts the next grow. The three COLORREFs at +60/+64/+68 have the
  ;; same problem in the other direction: all three take the same kind of
  ;; value, so a wrong offset paints rather than traps. See the layout
  ;; comment directly above.
  (func $lv_item_count (param $sw ptr<ListViewState>) (result i32)
    (load.field ListViewState item_count (local.get $sw)))
  (func $lv_set_item_count (param $sw ptr<ListViewState>) (param $v i32)
    (store.field ListViewState item_count (local.get $sw) (local.get $v)))
  (func $lv_item_cap (param $sw ptr<ListViewState>) (result i32)
    (load.field.memarg ListViewState item_cap (local.get $sw)))
  (func $lv_set_item_cap (param $sw ptr<ListViewState>) (param $v i32)
    (store.field.memarg ListViewState item_cap (local.get $sw) (local.get $v)))
  (func $lv_cells_ptr (param $sw ptr<ListViewState>) (result i32)
    (load.field.memarg ListViewState item_cells_ptr (local.get $sw)))
  (func $lv_set_cells_ptr (param $sw ptr<ListViewState>) (param $v i32)
    (store.field.memarg ListViewState item_cells_ptr (local.get $sw) (local.get $v)))
  (func $lv_col_count (param $sw ptr<ListViewState>) (result i32)
    (load.field.memarg ListViewState col_count (local.get $sw)))
  (func $lv_set_col_count (param $sw ptr<ListViewState>) (param $v i32)
    (store.field.memarg ListViewState col_count (local.get $sw) (local.get $v)))
  (func $lv_col_cap (param $sw ptr<ListViewState>) (result i32)
    (load.field.memarg ListViewState col_cap (local.get $sw)))
  (func $lv_set_col_cap (param $sw ptr<ListViewState>) (param $v i32)
    (store.field.memarg ListViewState col_cap (local.get $sw) (local.get $v)))
  (func $lv_col_widths_ptr (param $sw ptr<ListViewState>) (result i32)
    (load.field.memarg ListViewState col_widths_ptr (local.get $sw)))
  (func $lv_set_col_widths_ptr (param $sw ptr<ListViewState>) (param $v i32)
    (store.field.memarg ListViewState col_widths_ptr (local.get $sw) (local.get $v)))
  (func $lv_col_texts_ptr (param $sw ptr<ListViewState>) (result i32)
    (load.field.memarg ListViewState col_texts_ptr (local.get $sw)))
  (func $lv_set_col_texts_ptr (param $sw ptr<ListViewState>) (param $v i32)
    (store.field.memarg ListViewState col_texts_ptr (local.get $sw) (local.get $v)))
  (func $lv_selected (param $sw ptr<ListViewState>) (result i32)
    (load.field.memarg ListViewState selected_index (local.get $sw)))
  (func $lv_set_selected (param $sw ptr<ListViewState>) (param $v i32)
    (store.field.memarg ListViewState selected_index (local.get $sw) (local.get $v)))
  (func $lv_top_index (param $sw ptr<ListViewState>) (result i32)
    (load.field.memarg ListViewState top_index (local.get $sw)))
  (func $lv_set_top_index (param $sw ptr<ListViewState>) (param $v i32)
    (store.field.memarg ListViewState top_index (local.get $sw) (local.get $v)))
  (func $lv_ex_style (param $sw ptr<ListViewState>) (result i32)
    (load.field.memarg ListViewState extended_style (local.get $sw)))
  (func $lv_set_ex_style (param $sw ptr<ListViewState>) (param $v i32)
    (store.field.memarg ListViewState extended_style (local.get $sw) (local.get $v)))
  (func $lv_drag_anchor_y (param $sw ptr<ListViewState>) (result i32)
    (load.field.memarg ListViewState drag_anchor_y (local.get $sw)))
  (func $lv_set_drag_anchor_y (param $sw ptr<ListViewState>) (param $v i32)
    (store.field.memarg ListViewState drag_anchor_y (local.get $sw) (local.get $v)))
  (func $lv_drag_anchor_top (param $sw ptr<ListViewState>) (result i32)
    (load.field.memarg ListViewState drag_anchor_top (local.get $sw)))
  (func $lv_set_drag_anchor_top (param $sw ptr<ListViewState>) (param $v i32)
    (store.field.memarg ListViewState drag_anchor_top (local.get $sw) (local.get $v)))
  (func $lv_image_list (param $sw ptr<ListViewState>) (result i32)
    (load.field.memarg ListViewState small_image_list (local.get $sw)))
  (func $lv_set_image_list (param $sw ptr<ListViewState>) (param $v i32)
    (store.field.memarg ListViewState small_image_list (local.get $sw) (local.get $v)))
  (func $lv_bk_color (param $sw ptr<ListViewState>) (result i32)
    (load.field.memarg ListViewState bk_color (local.get $sw)))
  (func $lv_set_bk_color (param $sw ptr<ListViewState>) (param $v i32)
    (store.field.memarg ListViewState bk_color (local.get $sw) (local.get $v)))
  (func $lv_text_color (param $sw ptr<ListViewState>) (result i32)
    (load.field.memarg ListViewState text_color (local.get $sw)))
  (func $lv_set_text_color (param $sw ptr<ListViewState>) (param $v i32)
    (store.field.memarg ListViewState text_color (local.get $sw) (local.get $v)))
  (func $lv_text_bk_color (param $sw ptr<ListViewState>) (result i32)
    (load.field.memarg ListViewState text_bk_color (local.get $sw)))
  (func $lv_set_text_bk_color (param $sw ptr<ListViewState>) (param $v i32)
    (store.field.memarg ListViewState text_bk_color (local.get $sw) (local.get $v)))
  (func $lv_state_image_list (param $sw ptr<ListViewState>) (result i32)
    (load.field.memarg ListViewState state_image_list (local.get $sw)))
  (func $lv_set_state_image_list (param $sw ptr<ListViewState>) (param $v i32)
    (store.field.memarg ListViewState state_image_list (local.get $sw) (local.get $v)))
  (func $lv_normal_image_list (param $sw ptr<ListViewState>) (result i32)
    (load.field.memarg ListViewState normal_image_list (local.get $sw)))
  (func $lv_set_normal_image_list (param $sw ptr<ListViewState>) (param $v i32)
    (store.field.memarg ListViewState normal_image_list (local.get $sw) (local.get $v)))

  (func $lv_header_h (param $sw i32) (result i32)
    (if (result i32) (i32.gt_s (call $lv_col_count (local.get $sw)) (i32.const 0))
      (then (i32.const 18))
      (else (i32.const 0))))

  (func $lv_visible_rows_for_h (param $sw i32) (param $h i32) (result i32)
    (local $avail i32) (local $rows i32)
    (local.set $avail (i32.sub (local.get $h) (call $lv_header_h (local.get $sw))))
    (if (i32.lt_s (local.get $avail) (i32.const 16))
      (then (local.set $avail (i32.const 16))))
    (local.set $rows (i32.div_u (local.get $avail) (i32.const 16)))
    (if (i32.eqz (local.get $rows))
      (then (local.set $rows (i32.const 1))))
    (local.get $rows))

  (func $lv_max_scroll_for_h (param $sw i32) (param $h i32) (result i32)
    (local $max i32)
    (local.set $max
      (i32.sub (call $lv_item_count (local.get $sw))
               (call $lv_visible_rows_for_h (local.get $sw) (local.get $h))))
    (if (i32.lt_s (local.get $max) (i32.const 0))
      (then (local.set $max (i32.const 0))))
    (local.get $max))

  (func $lv_content_right_for_size (param $sw i32) (param $w i32) (param $h i32) (result i32)
    (if (i32.and
          (i32.gt_s (call $lv_max_scroll_for_h (local.get $sw) (local.get $h)) (i32.const 0))
          (i32.gt_s (local.get $w) (i32.const 16)))
      (then (return (i32.sub (local.get $w) (i32.const 16)))))
    (local.get $w))

  (func $lv_report_col_width (param $sw i32) (param $idx i32) (result i32)
    (local $col_count i32) (local $width i32)
    (local.set $col_count (call $lv_col_count (local.get $sw)))
    (if (i32.eqz (local.get $col_count))
      (then
        (if (i32.eq (local.get $idx) (i32.const 0))
          (then (return (i32.const 120))))
        (return (i32.const 0))))
    (if (i32.or (i32.lt_s (local.get $idx) (i32.const 0))
                (i32.ge_s (local.get $idx) (local.get $col_count)))
      (then (return (i32.const 0))))
    (local.set $width
      (i32.load
        (i32.add (call $g2w (call $lv_col_widths_ptr (local.get $sw)))
                 (i32.mul (local.get $idx) (i32.const 4)))))
    (if (i32.le_s (local.get $width) (i32.const 0))
      (then (local.set $width (i32.const 80))))
    (local.get $width))

  (func $lv_report_col_left (param $sw i32) (param $idx i32) (result i32)
    (local $i i32) (local $x i32) (local $width i32)
    (local.set $i (i32.const 0))
    (local.set $x (i32.const 0))
    (block $done (loop $cols
      (br_if $done (i32.ge_s (local.get $i) (local.get $idx)))
      (local.set $width (call $lv_report_col_width (local.get $sw) (local.get $i)))
      (if (i32.le_s (local.get $width) (i32.const 0))
        (then (return (local.get $x))))
      (local.set $x (i32.add (local.get $x) (local.get $width)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $cols)))
    (local.get $x))

  (func $lv_report_total_width (param $sw i32) (result i32)
    (local $col_count i32) (local $i i32) (local $x i32) (local $width i32)
    (local.set $col_count (call $lv_col_count (local.get $sw)))
    (if (i32.eqz (local.get $col_count))
      (then (return (i32.const 120))))
    (local.set $i (i32.const 0))
    (local.set $x (i32.const 0))
    (block $done (loop $cols
      (br_if $done (i32.ge_s (local.get $i) (local.get $col_count)))
      (local.set $width (call $lv_report_col_width (local.get $sw) (local.get $i)))
      (if (i32.le_s (local.get $width) (i32.const 0))
        (then (local.set $width (i32.const 80))))
      (local.set $x (i32.add (local.get $x) (local.get $width)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $cols)))
    (local.get $x))

  (func $lv_cell_text_matches (param $cell_g i32) (param $needle_g i32) (param $partial i32) (result i32)
    (local $hay_w i32) (local $needle_w i32) (local $i i32) (local $hc i32) (local $nc i32)
    (if (i32.or (i32.eqz (local.get $cell_g)) (i32.eqz (local.get $needle_g)))
      (then (return (i32.const 0))))
    (local.set $hay_w (call $g2w (local.get $cell_g)))
    (local.set $needle_w (call $g2w (local.get $needle_g)))
    (block $done (loop $scan
      (local.set $hc (i32.load8_u (i32.add (local.get $hay_w) (local.get $i))))
      (local.set $nc (i32.load8_u (i32.add (local.get $needle_w) (local.get $i))))
      (if (i32.eqz (local.get $nc))
        (then
          (if (local.get $partial) (then (return (i32.const 1))))
          (return (select (i32.const 1) (i32.const 0) (i32.eqz (local.get $hc))))))
      (if (i32.eqz (local.get $hc))
        (then (return (i32.const 0))))
      (if (i32.ne (call $tolower (local.get $hc)) (call $tolower (local.get $nc)))
        (then (return (i32.const 0))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (i32.const 0))

  ;; Per-item record, 44 bytes: 8 subitem text pointers, then image (+32),
  ;; lParam (+36) and state (+40). $lv_ensure_item_capacity, the insert and
  ;; delete shifts and the LVM_SETITEMCOUNT clear all stride by 44 too --
  ;; a WAT global would read better, but lib/compile-wat.js only parses
  ;; globals ahead of the functions and silently loses every definition
  ;; after one declared here.
  (func $lv_cell_addr (param $sw i32) (param $item i32) (param $sub i32) (result i32)
    (i32.add
      (call $g2w (call $lv_cells_ptr (local.get $sw)))
      (i32.add
        (i32.mul (local.get $item) (i32.const 44))
        (i32.mul (local.get $sub) (i32.const 4)))))

  (func $lv_item_image_addr (param $sw i32) (param $item i32) (result i32)
    (i32.add
      (call $g2w (call $lv_cells_ptr (local.get $sw)))
      (i32.add (i32.mul (local.get $item) (i32.const 44)) (i32.const 32))))

  (func $lv_item_param_addr (param $sw i32) (param $item i32) (result i32)
    (i32.add
      (call $g2w (call $lv_cells_ptr (local.get $sw)))
      (i32.add (i32.mul (local.get $item) (i32.const 44)) (i32.const 36))))

  ;; THE Win98 check box: a 13x13 sunken well with a black tick. Used by the
  ;; BUTTON painter (BS_CHECKBOX/BS_AUTOCHECKBOX/BS_3STATE) and by list-view
  ;; state images alike — an app supplies the latter as a two-image LVSIL_STATE
  ;; list, but the images are comctl32's own standard check boxes.
  ;;
  ;; This used to be two implementations: this one, and a 12x12 pen-stroked
  ;; copy inside $button_wndproc whose own comment promised to "compose them the
  ;; way the BUTTON painter does". One pixel apart is a visible mismatch when a
  ;; dialog puts a check box and a checked list-view row on the same line.
  (func $paint_check_box (param $hdc i32) (param $x i32) (param $y i32) (param $checked i32)
    (local $i i32)
    (drop (call $host_gdi_fill_rect (local.get $hdc)
      (local.get $x) (local.get $y)
      (i32.add (local.get $x) (i32.const 13)) (i32.add (local.get $y) (i32.const 13))
      (i32.const 0x30010)))
    ;; EDGE_SUNKEN (0x0A), BF_RECT (0x0F).
    (drop (call $host_gdi_draw_edge (local.get $hdc)
      (local.get $x) (local.get $y)
      (i32.add (local.get $x) (i32.const 13)) (i32.add (local.get $y) (i32.const 13))
      (i32.const 0x0A) (i32.const 0x0F)))
    (if (local.get $checked)
      (then
        ;; Six 2px strokes: down-right to the elbow, then up-right.
        (block $done (loop $tick
          (br_if $done (i32.ge_s (local.get $i) (i32.const 6)))
          (drop (call $host_gdi_fill_rect (local.get $hdc)
            (i32.add (local.get $x) (i32.add (local.get $i) (i32.const 3)))
            (i32.add (local.get $y)
              (select (i32.add (local.get $i) (i32.const 4))
                      (i32.sub (i32.const 10) (local.get $i))
                      (i32.lt_s (local.get $i) (i32.const 3))))
            (i32.add (local.get $x) (i32.add (local.get $i) (i32.const 4)))
            (i32.add (local.get $y)
              (select (i32.add (local.get $i) (i32.const 6))
                      (i32.sub (i32.const 12) (local.get $i))
                      (i32.lt_s (local.get $i) (i32.const 3))))
            (i32.const 0x30014)))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $tick))))))

  ;; Complete LVIS_* state for one item. Selection, focus, cut/drop highlight,
  ;; overlay index and state-image index all belong to the item; +32 in the
  ;; control record is only the most recent selection mark.
  (func $lv_item_state_addr (param $sw i32) (param $item i32) (result i32)
    (i32.add
      (call $g2w (call $lv_cells_ptr (local.get $sw)))
      (i32.add (i32.mul (local.get $item) (i32.const 44)) (i32.const 40))))

  (func $lv_find_item_with_state (param $sw i32) (param $after i32) (param $mask i32) (result i32)
    (local $i i32) (local $count i32)
    (local.set $i (i32.add (local.get $after) (i32.const 1)))
    (if (i32.lt_s (local.get $i) (i32.const 0))
      (then (local.set $i (i32.const 0))))
    (local.set $count (call $lv_item_count (local.get $sw)))
    (block $done (loop $items
      (br_if $done (i32.ge_s (local.get $i) (local.get $count)))
      (if (i32.eq
            (i32.and
              (i32.load (call $lv_item_state_addr (local.get $sw) (local.get $i)))
              (local.get $mask))
            (local.get $mask))
        (then (return (local.get $i))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $items)))
    (i32.const -1))

  (func $lv_selected_count (param $sw i32) (result i32)
    (local $i i32) (local $count i32) (local $selected i32)
    (local.set $count (call $lv_item_count (local.get $sw)))
    (block $done (loop $items
      (br_if $done (i32.ge_s (local.get $i) (local.get $count)))
      (if (i32.and
            (i32.load (call $lv_item_state_addr (local.get $sw) (local.get $i)))
            (i32.const 0x0002))
        (then (local.set $selected (i32.add (local.get $selected) (i32.const 1)))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $items)))
    (local.get $selected))

  (func $lv_refresh_selection_mark (param $sw i32)
    (local $mark i32)
    (local.set $mark (call $lv_selected (local.get $sw)))
    (if (i32.and
          (i32.and (i32.ge_s (local.get $mark) (i32.const 0))
                   (i32.lt_s (local.get $mark) (call $lv_item_count (local.get $sw))))
          (i32.ne
            (i32.and
              (i32.load (call $lv_item_state_addr (local.get $sw) (local.get $mark)))
              (i32.const 0x0002))
            (i32.const 0)))
      (then (return)))
    (call $lv_set_selected (local.get $sw)
      (call $lv_find_item_with_state (local.get $sw) (i32.const -1) (i32.const 0x0002))))

  (func $lv_ensure_item_capacity (param $sw i32) (param $want i32)
    (local $cap i32) (local $new_cap i32) (local $new_bytes i32)
    (local $old_buf i32) (local $new_buf i32) (local $count i32)
    (local.set $cap (call $lv_item_cap (local.get $sw)))
    (if (i32.le_u (local.get $want) (local.get $cap))
      (then (return)))
    (local.set $new_cap (local.get $cap))
    (if (i32.eqz (local.get $new_cap))
      (then (local.set $new_cap (i32.const 16))))
    (block $grown (loop $grow
      (br_if $grown (i32.le_u (local.get $want) (local.get $new_cap)))
      (local.set $new_cap (i32.mul (local.get $new_cap) (i32.const 2)))
      (br $grow)))
    (local.set $new_bytes (i32.mul (local.get $new_cap) (i32.const 44)))
    (local.set $new_buf (call $heap_alloc (local.get $new_bytes)))
    (call $zero_memory (call $g2w (local.get $new_buf)) (local.get $new_bytes))
    (local.set $old_buf (call $lv_cells_ptr (local.get $sw)))
    (local.set $count (call $lv_item_count (local.get $sw)))
    (if (local.get $old_buf)
      (then
        (if (local.get $count)
          (then
            (call $memcpy (call $g2w (local.get $new_buf))
                          (call $g2w (local.get $old_buf))
                          (i32.mul (local.get $count) (i32.const 44)))))))
    (call $heap_free (local.get $old_buf))
    (call $lv_set_item_cap (local.get $sw) (local.get $new_cap))
    (call $lv_set_cells_ptr (local.get $sw) (local.get $new_buf)))

  (func $lv_ensure_col_capacity (param $sw i32) (param $want i32)
    (local $cap i32) (local $new_cap i32) (local $new_bytes i32)
    (local $old_widths i32) (local $old_texts i32)
    (local $new_widths i32) (local $new_texts i32) (local $count i32)
    (local.set $cap (call $lv_col_cap (local.get $sw)))
    (if (i32.le_u (local.get $want) (local.get $cap))
      (then (return)))
    (local.set $new_cap (local.get $cap))
    (if (i32.eqz (local.get $new_cap))
      (then (local.set $new_cap (i32.const 4))))
    (block $grown (loop $grow
      (br_if $grown (i32.le_u (local.get $want) (local.get $new_cap)))
      (local.set $new_cap (i32.mul (local.get $new_cap) (i32.const 2)))
      (br $grow)))
    (local.set $new_bytes (i32.mul (local.get $new_cap) (i32.const 4)))
    (local.set $new_widths (call $heap_alloc (local.get $new_bytes)))
    (local.set $new_texts (call $heap_alloc (local.get $new_bytes)))
    (call $zero_memory (call $g2w (local.get $new_widths)) (local.get $new_bytes))
    (call $zero_memory (call $g2w (local.get $new_texts)) (local.get $new_bytes))
    (local.set $old_widths (call $lv_col_widths_ptr (local.get $sw)))
    (local.set $old_texts (call $lv_col_texts_ptr (local.get $sw)))
    (local.set $count (call $lv_col_count (local.get $sw)))
    (if (local.get $old_widths)
      (then
        (if (local.get $count)
          (then
            (call $memcpy (call $g2w (local.get $new_widths))
                          (call $g2w (local.get $old_widths))
                          (i32.mul (local.get $count) (i32.const 4)))))))
    (if (local.get $old_texts)
      (then
        (if (local.get $count)
          (then
            (call $memcpy (call $g2w (local.get $new_texts))
                          (call $g2w (local.get $old_texts))
                          (i32.mul (local.get $count) (i32.const 4)))))))
    (call $heap_free (local.get $old_widths))
    (call $heap_free (local.get $old_texts))
    (call $lv_set_col_cap (local.get $sw) (local.get $new_cap))
    (call $lv_set_col_widths_ptr (local.get $sw) (local.get $new_widths))
    (call $lv_set_col_texts_ptr (local.get $sw) (local.get $new_texts)))

  (func $lv_set_cell_text (param $sw i32) (param $item i32) (param $sub i32) (param $src_g i32)
    (local $cell i32) (local $old i32) (local $copy_g i32)
    (if (i32.or
          (i32.or (i32.lt_s (local.get $item) (i32.const 0))
                  (i32.ge_s (local.get $item) (call $lv_item_count (local.get $sw))))
          (i32.or (i32.lt_s (local.get $sub) (i32.const 0))
                  (i32.ge_s (local.get $sub) (i32.const 8))))
      (then (return)))
    (local.set $cell (call $lv_cell_addr (local.get $sw) (local.get $item) (local.get $sub)))
    (local.set $old (i32.load (local.get $cell)))
    (if (local.get $old)
      (then (call $heap_free (local.get $old))))
    (i32.store (local.get $cell) (i32.const 0))
    (if (i32.or (i32.eqz (local.get $src_g)) (i32.eq (local.get $src_g) (i32.const -1)))
      (then (return)))
    (local.set $copy_g (call $guest_strdup (local.get $src_g)))
    (i32.store (local.get $cell) (local.get $copy_g)))

  (func $lv_set_col_text (param $sw i32) (param $idx i32) (param $src_g i32)
    (local $cell i32) (local $old i32) (local $copy_g i32)
    (if (i32.or (i32.lt_s (local.get $idx) (i32.const 0))
                (i32.ge_s (local.get $idx) (call $lv_col_count (local.get $sw))))
      (then (return)))
    (if (i32.eqz (call $lv_col_texts_ptr (local.get $sw)))
      (then (return)))
    (local.set $cell
      (i32.add (call $g2w (call $lv_col_texts_ptr (local.get $sw)))
               (i32.mul (local.get $idx) (i32.const 4))))
    (local.set $old (i32.load (local.get $cell)))
    (if (local.get $old)
      (then (call $heap_free (local.get $old))))
    (i32.store (local.get $cell) (i32.const 0))
    (if (i32.or (i32.eqz (local.get $src_g)) (i32.eq (local.get $src_g) (i32.const -1)))
      (then (return)))
    (local.set $copy_g (call $guest_strdup (local.get $src_g)))
    (i32.store (local.get $cell) (local.get $copy_g)))

  (func $lv_copy_cell_text
    (param $sw i32) (param $item i32) (param $sub i32) (param $dest_g i32) (param $max i32) (result i32)
    (local $src_g i32) (local $src_w i32) (local $dest_w i32) (local $len i32)
    (if (i32.or
          (i32.or (i32.le_u (local.get $max) (i32.const 0))
                  (i32.eqz (local.get $dest_g)))
          (i32.or (i32.lt_s (local.get $item) (i32.const 0))
                  (i32.ge_s (local.get $item) (call $lv_item_count (local.get $sw)))))
      (then (return (i32.const 0))))
    (if (i32.or (i32.lt_s (local.get $sub) (i32.const 0))
                (i32.ge_s (local.get $sub) (i32.const 8)))
      (then (return (i32.const 0))))
    (local.set $dest_w (call $g2w (local.get $dest_g)))
    (local.set $src_g (i32.load (call $lv_cell_addr (local.get $sw) (local.get $item) (local.get $sub))))
    (if (i32.eqz (local.get $src_g))
      (then
        (i32.store8 (local.get $dest_w) (i32.const 0))
        (return (i32.const 0))))
    (local.set $src_w (call $g2w (local.get $src_g)))
    (local.set $len (call $strlen (local.get $src_w)))
    (if (i32.ge_u (local.get $len) (local.get $max))
      (then (local.set $len (i32.sub (local.get $max) (i32.const 1)))))
    (if (local.get $len)
      (then (call $memcpy (local.get $dest_w) (local.get $src_w) (local.get $len))))
    (i32.store8 (i32.add (local.get $dest_w) (local.get $len)) (i32.const 0))
    (local.get $len))

  (func $lv_clear_items (param $hwnd i32) (param $sw i32)
    (local $count i32) (local $i i32) (local $sub i32) (local $cell i32) (local $ptr i32)
    (local.set $count (call $lv_item_count (local.get $sw)))
    (local.set $i (i32.const 0))
    (block $done (loop $items
      (br_if $done (i32.ge_u (local.get $i) (local.get $count)))
      (local.set $sub (i32.const 0))
      (block $subs_done (loop $subs
        (br_if $subs_done (i32.ge_u (local.get $sub) (i32.const 8)))
        (local.set $cell (call $lv_cell_addr (local.get $sw) (local.get $i) (local.get $sub)))
        (local.set $ptr (i32.load (local.get $cell)))
        (if (local.get $ptr) (then (call $heap_free (local.get $ptr))))
        (i32.store (local.get $cell) (i32.const 0))
        (local.set $sub (i32.add (local.get $sub) (i32.const 1)))
        (br $subs)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $items)))
    (call $lv_set_item_count (local.get $sw) (i32.const 0))
    (call $lv_set_selected (local.get $sw) (i32.const -1))
    (drop (call $lv_scroll_to_for_h
      (local.get $hwnd) (local.get $sw) (call $ctrl_get_h (local.get $hwnd)) (i32.const 0))))

  (func $lv_free_row_text (param $sw i32) (param $idx i32)
    (local $sub i32) (local $cell i32) (local $ptr i32)
    (if (i32.or (i32.lt_s (local.get $idx) (i32.const 0))
                (i32.ge_s (local.get $idx) (call $lv_item_count (local.get $sw))))
      (then (return)))
    (local.set $sub (i32.const 0))
    (block $done (loop $subs
      (br_if $done (i32.ge_u (local.get $sub) (i32.const 8)))
      (local.set $cell (call $lv_cell_addr (local.get $sw) (local.get $idx) (local.get $sub)))
      (local.set $ptr (i32.load (local.get $cell)))
      (if (local.get $ptr) (then (call $heap_free (local.get $ptr))))
      (i32.store (local.get $cell) (i32.const 0))
      (local.set $sub (i32.add (local.get $sub) (i32.const 1)))
      (br $subs))))

  (func $lv_delete_item (param $hwnd i32) (param $sw i32) (param $idx i32) (result i32)
    (local $count i32) (local $tail i32) (local $selected i32) (local $h i32)
    (local.set $count (call $lv_item_count (local.get $sw)))
    (if (i32.or (i32.lt_s (local.get $idx) (i32.const 0))
                (i32.ge_s (local.get $idx) (local.get $count)))
      (then (return (i32.const 0))))
    (local.set $selected (call $lv_selected (local.get $sw)))
    (call $lv_free_row_text (local.get $sw) (local.get $idx))
    (local.set $tail (i32.sub (i32.sub (local.get $count) (local.get $idx)) (i32.const 1)))
    (if (i32.gt_s (local.get $tail) (i32.const 0))
      (then
        (call $memcpy
          (call $lv_cell_addr (local.get $sw) (local.get $idx) (i32.const 0))
          (call $lv_cell_addr (local.get $sw) (i32.add (local.get $idx) (i32.const 1)) (i32.const 0))
          (i32.mul (local.get $tail) (i32.const 44)))))
    (call $zero_memory
      (call $lv_cell_addr (local.get $sw) (i32.sub (local.get $count) (i32.const 1)) (i32.const 0))
      (i32.const 44))
    (call $lv_set_item_count (local.get $sw) (i32.sub (local.get $count) (i32.const 1)))
    (if (i32.gt_s (local.get $selected) (local.get $idx))
      (then (call $lv_set_selected (local.get $sw) (i32.sub (local.get $selected) (i32.const 1)))))
    (if (i32.eq (local.get $selected) (local.get $idx))
      (then
        (call $lv_set_selected (local.get $sw) (i32.const -1))
        (call $lv_refresh_selection_mark (local.get $sw))))
    (local.set $h (call $ctrl_get_h (local.get $hwnd)))
    (drop (call $lv_scroll_to_for_h
      (local.get $hwnd) (local.get $sw) (local.get $h) (call $lv_top_index (local.get $sw))))
    (call $paint_flag_set_inv (local.get $hwnd))
    (i32.const 1))

  (func $lv_clear_columns (param $sw i32)
    (local $count i32) (local $i i32) (local $texts_w i32) (local $ptr i32)
    (local.set $count (call $lv_col_count (local.get $sw)))
    (if (i32.eqz (call $lv_col_texts_ptr (local.get $sw)))
      (then
        (call $lv_set_col_count (local.get $sw) (i32.const 0))
        (return)))
    (local.set $texts_w (call $g2w (call $lv_col_texts_ptr (local.get $sw))))
    (local.set $i (i32.const 0))
    (block $done (loop $cols
      (br_if $done (i32.ge_u (local.get $i) (local.get $count)))
      (local.set $ptr (i32.load (i32.add (local.get $texts_w) (i32.mul (local.get $i) (i32.const 4)))))
      (if (local.get $ptr) (then (call $heap_free (local.get $ptr))))
      (i32.store (i32.add (local.get $texts_w) (i32.mul (local.get $i) (i32.const 4))) (i32.const 0))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $cols)))
    (call $lv_set_col_count (local.get $sw) (i32.const 0)))

  (func $lv_delete_column (param $hwnd i32) (param $sw i32) (param $idx i32) (result i32)
    (local $col_count i32) (local $row_count i32) (local $i i32) (local $sub i32)
    (local $widths_w i32) (local $texts_w i32) (local $ptr i32)
    (local.set $col_count (call $lv_col_count (local.get $sw)))
    (if (i32.or (i32.lt_s (local.get $idx) (i32.const 0))
                (i32.ge_s (local.get $idx) (local.get $col_count)))
      (then (return (i32.const 0))))
    (local.set $widths_w (call $g2w (call $lv_col_widths_ptr (local.get $sw))))
    (local.set $texts_w (call $g2w (call $lv_col_texts_ptr (local.get $sw))))
    (local.set $ptr (i32.load (i32.add (local.get $texts_w) (i32.mul (local.get $idx) (i32.const 4)))))
    (if (local.get $ptr) (then (call $heap_free (local.get $ptr))))
    ;; Close the hole at $idx: columns (idx, col_count) move down one slot. The
    ;; ranges overlap with the destination BELOW the source, which memory.copy
    ;; handles because it is specified as memmove -- one $memcpy per array. The
    ;; guard above bounds $idx to [0, col_count), so the length is never
    ;; negative and is zero exactly when $idx is the last column.
    (call $memcpy
      (i32.add (local.get $widths_w) (i32.mul (local.get $idx) (i32.const 4)))
      (i32.add (local.get $widths_w) (i32.mul (i32.add (local.get $idx) (i32.const 1)) (i32.const 4)))
      (i32.mul (i32.sub (i32.sub (local.get $col_count) (local.get $idx)) (i32.const 1)) (i32.const 4)))
    (call $memcpy
      (i32.add (local.get $texts_w) (i32.mul (local.get $idx) (i32.const 4)))
      (i32.add (local.get $texts_w) (i32.mul (i32.add (local.get $idx) (i32.const 1)) (i32.const 4)))
      (i32.mul (i32.sub (i32.sub (local.get $col_count) (local.get $idx)) (i32.const 1)) (i32.const 4)))
    (i32.store
      (i32.add (local.get $widths_w) (i32.mul (i32.sub (local.get $col_count) (i32.const 1)) (i32.const 4)))
      (i32.const 0))
    (i32.store
      (i32.add (local.get $texts_w) (i32.mul (i32.sub (local.get $col_count) (i32.const 1)) (i32.const 4)))
      (i32.const 0))
    (if (i32.lt_s (local.get $idx) (i32.const 8))
      (then
        (local.set $row_count (call $lv_item_count (local.get $sw)))
        (local.set $i (i32.const 0))
        (block $rows_done (loop $rows
          (br_if $rows_done (i32.ge_s (local.get $i) (local.get $row_count)))
          (local.set $ptr (i32.load (call $lv_cell_addr (local.get $sw) (local.get $i) (local.get $idx))))
          (if (local.get $ptr) (then (call $heap_free (local.get $ptr))))
          (local.set $sub (local.get $idx))
          (block $subs_done (loop $subs
            (br_if $subs_done (i32.ge_s (local.get $sub) (i32.const 7)))
            (i32.store
              (call $lv_cell_addr (local.get $sw) (local.get $i) (local.get $sub))
              (i32.load (call $lv_cell_addr (local.get $sw) (local.get $i) (i32.add (local.get $sub) (i32.const 1)))))
            (local.set $sub (i32.add (local.get $sub) (i32.const 1)))
            (br $subs)))
          (i32.store (call $lv_cell_addr (local.get $sw) (local.get $i) (i32.const 7)) (i32.const 0))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $rows)))))
    (call $lv_set_col_count (local.get $sw) (i32.sub (local.get $col_count) (i32.const 1)))
    (call $paint_flag_set_inv (local.get $hwnd))
    (i32.const 1))

  (func $lv_scroll_to_for_h (param $hwnd i32) (param $sw i32) (param $h i32) (param $row i32) (result i32)
    (local $max i32)
    (local.set $max (call $lv_max_scroll_for_h (local.get $sw) (local.get $h)))
    (if (i32.lt_s (local.get $row) (i32.const 0))
      (then (local.set $row (i32.const 0))))
    (if (i32.gt_s (local.get $row) (local.get $max))
      (then (local.set $row (local.get $max))))
    (call $lv_set_top_index (local.get $sw) (local.get $row))
    (call $scroll_publish_vertical_info
      (local.get $hwnd) (local.get $row)
      (call $lv_item_count (local.get $sw))
      (call $lv_visible_rows_for_h (local.get $sw) (local.get $h)))
    (local.get $row))

  (func $lv_scroll_by (param $hwnd i32) (param $delta i32) (result i32)
    (local $state i32) (local $sw i32) (local $sz i32) (local $h i32)
    (local $old_top i32) (local $new_top i32)
    (local.set $state (call $wnd_get_state_ptr (local.get $hwnd)))
    (if (i32.eqz (local.get $state)) (then (return (i32.const 0))))
    (local.set $sw (call $g2w (local.get $state)))
    (local.set $sz (call $ctrl_get_wh_packed (local.get $hwnd)))
    (local.set $h (i32.shr_u (local.get $sz) (i32.const 16)))
    (local.set $old_top (call $lv_top_index (local.get $sw)))
    (local.set $new_top
      (call $lv_scroll_to_for_h
        (local.get $hwnd) (local.get $sw) (local.get $h)
        (i32.add (local.get $old_top) (local.get $delta))))
    (if (i32.ne (local.get $new_top) (local.get $old_top))
      (then (call $paint_flag_set_inv (local.get $hwnd))))
    (local.get $new_top))

  (func $lv_notify_simple (param $hwnd i32) (param $code i32)
    (local $parent i32) (local $notify_g i32) (local $notify_w i32)
    (local.set $parent (call $wnd_get_parent (local.get $hwnd)))
    (if (i32.eqz (local.get $parent)) (then (return)))
    (local.set $notify_g (call $heap_alloc (i32.const 12)))
    (if (i32.eqz (local.get $notify_g)) (then (return)))
    (local.set $notify_w (call $g2w (local.get $notify_g)))
    (i32.store          (local.get $notify_w) (local.get $hwnd))
    (i32.store offset=4 (local.get $notify_w) (call $ctrl_table_get_id (local.get $hwnd)))
    (i32.store offset=8 (local.get $notify_w) (local.get $code))
    (global.set $lv_debug_notify_count (i32.add (global.get $lv_debug_notify_count) (i32.const 1)))
    (global.set $lv_debug_notify_code (local.get $code))
    (global.set $lv_debug_notify_item (i32.const -1))
    (global.set $lv_debug_notify_old_state (i32.const 0))
    (global.set $lv_debug_notify_new_state (i32.const 0))
    (drop (call $wnd_send_message
      (local.get $parent) (i32.const 0x004E)
      (call $ctrl_table_get_id (local.get $hwnd))
      (local.get $notify_g)))
    (call $heap_free (local.get $notify_g)))

  (func $lv_notify_item_state
    (param $hwnd i32) (param $item i32) (param $old_state i32) (param $new_state i32) (param $code i32) (result i32)
    (local $parent i32) (local $notify_g i32) (local $notify_w i32) (local $ret i32)
    (local.set $parent (call $wnd_get_parent (local.get $hwnd)))
    (if (i32.eqz (local.get $parent)) (then (return (i32.const 0))))
    (local.set $notify_g (call $heap_alloc (i32.const 44)))
    (if (i32.eqz (local.get $notify_g)) (then (return (i32.const 0))))
    (local.set $notify_w (call $g2w (local.get $notify_g)))
    (call $zero_memory (local.get $notify_w) (i32.const 44))
    (i32.store          (local.get $notify_w) (local.get $hwnd))
    (i32.store offset=4 (local.get $notify_w) (call $ctrl_table_get_id (local.get $hwnd)))
    (i32.store offset=8 (local.get $notify_w) (local.get $code))
    (i32.store offset=12 (local.get $notify_w) (local.get $item))
    (i32.store offset=16 (local.get $notify_w) (i32.const 0))
    (i32.store offset=20 (local.get $notify_w) (local.get $new_state))
    (i32.store offset=24 (local.get $notify_w) (local.get $old_state))
    (i32.store offset=28 (local.get $notify_w) (i32.const 0x0008)) ;; LVIF_STATE
    (global.set $lv_debug_notify_count (i32.add (global.get $lv_debug_notify_count) (i32.const 1)))
    (global.set $lv_debug_notify_code (local.get $code))
    (global.set $lv_debug_notify_item (local.get $item))
    (global.set $lv_debug_notify_old_state (local.get $old_state))
    (global.set $lv_debug_notify_new_state (local.get $new_state))
    (local.set $ret (call $wnd_send_message
      (local.get $parent) (i32.const 0x004E)
      (call $ctrl_table_get_id (local.get $hwnd))
      (local.get $notify_g)))
    (call $heap_free (local.get $notify_g))
    (local.get $ret))

  ;; Apply one LVITEM.state/stateMask pair. The record at +40 is authoritative;
  ;; the control-level selection mark merely remembers the most recently
  ;; selected row. Win98 enforces one focused item, and LVS_SINGLESEL enforces
  ;; one selected item, by clearing the old row as part of the same operation.
  ;; Broadcast callers can request LVN_ITEMCHANGING even for an unchanged row,
  ;; which is what Win98 comctl32 does while walking a normal multi-select list.
  (func $lv_change_item_state
    (param $hwnd i32) (param $sw i32) (param $idx i32)
    (param $state i32) (param $mask i32)
    (param $exclusive_selection i32) (param $notify_unchanged i32) (result i32)
    (local $old_state i32) (local $new_state i32) (local $unique_mask i32)
    (local $i i32) (local $other_state i32) (local $other_new i32)
    (if (i32.or (i32.lt_s (local.get $idx) (i32.const 0))
                (i32.ge_s (local.get $idx) (call $lv_item_count (local.get $sw))))
      (then (return (i32.const 0))))
    (local.set $old_state
      (i32.load (call $lv_item_state_addr (local.get $sw) (local.get $idx))))
    (local.set $new_state
      (i32.or
        (i32.and (local.get $old_state) (i32.xor (local.get $mask) (i32.const -1)))
        (i32.and (local.get $state) (local.get $mask))))

    ;; Ask the parent about the requested row before disturbing any row whose
    ;; unique focus/selection would have to be cleared for it.
    (if (i32.or (local.get $notify_unchanged)
                (i32.ne (local.get $old_state) (local.get $new_state)))
      (then
        (if (call $lv_notify_item_state
              (local.get $hwnd) (local.get $idx)
              (i32.and (local.get $old_state) (local.get $mask))
              (i32.and (local.get $new_state) (local.get $mask))
              (i32.const -100)) ;; LVN_ITEMCHANGINGA
          (then (return (i32.const 0))))))

    (local.set $unique_mask (i32.const 0))
    (if (i32.and (local.get $state)
          (i32.and (local.get $mask) (i32.const 0x0001))) ;; LVIS_FOCUSED
      (then (local.set $unique_mask (i32.or (local.get $unique_mask) (i32.const 0x0001)))))
    (if (i32.and
          (i32.ne
            (i32.and (local.get $state)
                     (i32.and (local.get $mask) (i32.const 0x0002)))
            (i32.const 0))
          (i32.or
            (local.get $exclusive_selection)
            (i32.ne (i32.and (call $wnd_get_style (local.get $hwnd)) (i32.const 0x0004))
                    (i32.const 0)))) ;; LVS_SINGLESEL
      (then (local.set $unique_mask (i32.or (local.get $unique_mask) (i32.const 0x0002)))))

    ;; Clear unique bits on every other row. Notify only rows that really lose
    ;; state; native comctl32 does not fabricate ITEMCHANGED for no-op rows.
    (if (local.get $unique_mask)
      (then
        (local.set $i (i32.const 0))
        (block $unique_done (loop $unique_rows
          (br_if $unique_done (i32.ge_s (local.get $i) (call $lv_item_count (local.get $sw))))
          (if (i32.ne (local.get $i) (local.get $idx))
            (then
              (local.set $other_state
                (i32.load (call $lv_item_state_addr (local.get $sw) (local.get $i))))
              (local.set $other_new
                (i32.and (local.get $other_state)
                         (i32.xor (local.get $unique_mask) (i32.const -1))))
              (if (i32.ne (local.get $other_state) (local.get $other_new))
                (then
                  (if (call $lv_notify_item_state
                        (local.get $hwnd) (local.get $i)
                        (i32.and (local.get $other_state) (local.get $unique_mask))
                        (i32.const 0) (i32.const -100))
                    (then (return (i32.const 0))))
                  (i32.store
                    (call $lv_item_state_addr (local.get $sw) (local.get $i))
                    (local.get $other_new))
                  (drop (call $lv_notify_item_state
                    (local.get $hwnd) (local.get $i)
                    (i32.and (local.get $other_state) (local.get $unique_mask))
                    (i32.const 0) (i32.const -101)))))))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $unique_rows)))))

    (if (i32.ne (local.get $old_state) (local.get $new_state))
      (then
        (i32.store (call $lv_item_state_addr (local.get $sw) (local.get $idx))
          (local.get $new_state))
        (drop (call $lv_notify_item_state
          (local.get $hwnd) (local.get $idx)
          (i32.and (local.get $old_state) (local.get $mask))
          (i32.and (local.get $new_state) (local.get $mask))
          (i32.const -101))))) ;; LVN_ITEMCHANGEDA

    (if (i32.and (local.get $mask) (i32.const 0x0002))
      (then
        (if (i32.and (local.get $state) (i32.const 0x0002))
          (then (call $lv_set_selected (local.get $sw) (local.get $idx)))
          (else (call $lv_refresh_selection_mark (local.get $sw))))))
    (i32.const 1))

  (func $lv_select_item (param $hwnd i32) (param $sw i32) (param $idx i32) (result i32)
    (if (i32.and
          (i32.ne (local.get $idx) (i32.const -1))
          (i32.or (i32.lt_s (local.get $idx) (i32.const 0))
                  (i32.ge_s (local.get $idx) (call $lv_item_count (local.get $sw)))))
      (then (return (i32.const 0))))
    (if (i32.eq (local.get $idx) (i32.const -1))
      (then
        (block $clear_done (loop $clear_selected
          (local.set $idx
            (call $lv_find_item_with_state (local.get $sw) (i32.const -1) (i32.const 0x0002)))
          (br_if $clear_done (i32.lt_s (local.get $idx) (i32.const 0)))
          (if (i32.eqz (call $lv_change_item_state
                (local.get $hwnd) (local.get $sw) (local.get $idx)
                (i32.const 0) (i32.const 0x0002) (i32.const 0) (i32.const 0)))
            (then (return (i32.const 0))))
          (br $clear_selected)))
        (call $lv_set_selected (local.get $sw) (i32.const -1))
        (return (i32.const 1))))
    (call $lv_change_item_state
      (local.get $hwnd) (local.get $sw) (local.get $idx)
      (i32.const 0x0002) (i32.const 0x0002) (i32.const 1) (i32.const 0)))

  (func $lv_paint_report_icon
    (param $hdc i32) (param $sw i32) (param $row i32) (param $x i32) (param $y i32) (result i32)
    (local $img_list i32) (local $img_idx i32) (local $img_sw i32)
    (local $img_cx i32) (local $img_cy i32) (local $img_count i32) (local $img_bmp i32)
    (local $img_bmp_w i32) (local $img_bmp_h i32) (local $img_src_x i32)
    (local $img_draw_w i32) (local $img_draw_h i32) (local $img_dst_y i32)
    (local $img_memdc i32) (local $ret i32)
    (local.set $img_list (call $lv_image_list (local.get $sw)))
    (if (i32.eqz (local.get $img_list)) (then (return (i32.const 0))))
    (local.set $img_idx (i32.load (call $lv_item_image_addr (local.get $sw) (local.get $row))))
    (if (i32.lt_s (local.get $img_idx) (i32.const 0)) (then (return (i32.const 0))))
    (local.set $img_sw (call $g2w (local.get $img_list)))
    (local.set $img_cx (i32.load (local.get $img_sw)))
    (local.set $img_cy (i32.load offset=4 (local.get $img_sw)))
    (local.set $img_count (i32.load offset=12 (local.get $img_sw)))
    (local.set $img_bmp (i32.load offset=16 (local.get $img_sw)))
    (if (i32.or
          (i32.or (i32.le_s (local.get $img_cx) (i32.const 0))
                  (i32.le_s (local.get $img_cy) (i32.const 0)))
          (i32.or (i32.le_s (local.get $img_count) (local.get $img_idx))
                  (i32.eqz (local.get $img_bmp))))
      (then (return (i32.const 0))))
    (local.set $img_bmp_w (call $host_gdi_get_object_w (local.get $img_bmp)))
    (local.set $img_bmp_h (call $host_gdi_get_object_h (local.get $img_bmp)))
    (local.set $img_src_x (i32.mul (local.get $img_idx) (local.get $img_cx)))
    (if (i32.or
          (i32.gt_s (i32.add (local.get $img_src_x) (local.get $img_cx)) (local.get $img_bmp_w))
          (i32.gt_s (local.get $img_cy) (local.get $img_bmp_h)))
      (then (return (i32.const 0))))
    (local.set $img_draw_w (local.get $img_cx))
    (if (i32.gt_s (local.get $img_draw_w) (i32.const 16))
      (then (local.set $img_draw_w (i32.const 16))))
    (local.set $img_draw_h (local.get $img_cy))
    (if (i32.gt_s (local.get $img_draw_h) (i32.const 16))
      (then (local.set $img_draw_h (i32.const 16))))
    (local.set $img_dst_y
      (i32.add (local.get $y)
        (i32.div_s (i32.sub (i32.const 16) (local.get $img_draw_h)) (i32.const 2))))
    (local.set $img_memdc (call $host_gdi_create_compat_dc (local.get $hdc)))
    (if (i32.eqz (local.get $img_memdc)) (then (return (i32.const 0))))
    (drop (call $host_gdi_select_object (local.get $img_memdc) (local.get $img_bmp)))
    (local.set $ret
      (call $host_gdi_transparent_blt
        (local.get $hdc)
        (i32.add (local.get $x) (i32.const 4)) (local.get $img_dst_y)
        (local.get $img_draw_w) (local.get $img_draw_h)
        (local.get $img_memdc)
        (local.get $img_src_x) (i32.const 0)
        (i32.load offset=20 (local.get $img_sw))))
    (drop (call $host_gdi_delete_dc (local.get $img_memdc)))
    (local.get $ret))

  (func $lv_paint_normal_icon
    (param $hdc i32) (param $sw i32) (param $row i32) (param $x i32) (param $y i32) (result i32)
    (local $img_list i32) (local $img_idx i32) (local $img_sw i32)
    (local $img_cx i32) (local $img_cy i32) (local $img_count i32) (local $img_bmp i32)
    (local $img_bmp_w i32) (local $img_bmp_h i32) (local $img_src_x i32)
    (local $draw_w i32) (local $draw_h i32) (local $dst_x i32) (local $dst_y i32)
    (local $memdc i32) (local $image_dc i32) (local $mask_dc i32)
    (local $stock_himl i32) (local $ret i32)
    (local.set $img_list (call $lv_normal_image_list (local.get $sw)))
    (if (i32.eqz (local.get $img_list))
      (then (local.set $img_list (call $lv_image_list (local.get $sw)))))
    (if (i32.eqz (local.get $img_list)) (then (return (i32.const 0))))
    (local.set $img_idx (i32.load (call $lv_item_image_addr (local.get $sw) (local.get $row))))
    (if (i32.lt_s (local.get $img_idx) (i32.const 0)) (then (return (i32.const 0))))
    (local.set $img_sw (call $g2w (local.get $img_list)))
    (local.set $stock_himl
      (i32.eq (i32.load (local.get $img_sw)) (i32.const 0x4C4D4948))) ;; "HIML"
    (if (local.get $stock_himl)
      (then
        ;; Authentic Win98 COMCTL32 image-list object. The stock DLL keeps
        ;; ready-to-blit colour/mask DCs in the object, as TreeView already
        ;; consumes, rather than our bounded bitmap-strip wrapper.
        (local.set $img_count (i32.load offset=4 (local.get $img_sw)))
        (local.set $img_cx (i32.load offset=16 (local.get $img_sw)))
        (local.set $img_cy (i32.load offset=20 (local.get $img_sw)))
        (local.set $image_dc (i32.load offset=56 (local.get $img_sw)))
        (local.set $mask_dc (i32.load offset=60 (local.get $img_sw))))
      (else
        (local.set $img_cx (i32.load (local.get $img_sw)))
        (local.set $img_cy (i32.load offset=4 (local.get $img_sw)))
        (local.set $img_count (i32.load offset=12 (local.get $img_sw)))
        (local.set $img_bmp (i32.load offset=16 (local.get $img_sw)))))
    (if (i32.or
          (i32.or (i32.le_s (local.get $img_cx) (i32.const 0))
                  (i32.or (i32.le_s (local.get $img_cy) (i32.const 0))
                          (i32.gt_s (local.get $img_cx) (i32.const 256))))
          (i32.or (i32.le_s (local.get $img_count) (local.get $img_idx))
                  (i32.and (i32.eqz (local.get $image_dc))
                           (i32.eqz (local.get $img_bmp)))))
      (then (return (i32.const 0))))
    (local.set $img_src_x (i32.mul (local.get $img_idx) (local.get $img_cx)))
    (if (local.get $img_bmp)
      (then
        (local.set $img_bmp_w (call $host_gdi_get_object_w (local.get $img_bmp)))
        (local.set $img_bmp_h (call $host_gdi_get_object_h (local.get $img_bmp)))
        (if (i32.or
              (i32.gt_s (i32.add (local.get $img_src_x) (local.get $img_cx)) (local.get $img_bmp_w))
              (i32.gt_s (local.get $img_cy) (local.get $img_bmp_h)))
          (then (return (i32.const 0))))))
    (local.set $draw_w (local.get $img_cx))
    (if (i32.gt_s (local.get $draw_w) (i32.const 32))
      (then (local.set $draw_w (i32.const 32))))
    (local.set $draw_h (local.get $img_cy))
    (if (i32.gt_s (local.get $draw_h) (i32.const 32))
      (then (local.set $draw_h (i32.const 32))))
    (local.set $dst_x (i32.add (local.get $x)
      (i32.div_s (i32.sub (i32.const 32) (local.get $draw_w)) (i32.const 2))))
    (local.set $dst_y (i32.add (local.get $y)
      (i32.div_s (i32.sub (i32.const 32) (local.get $draw_h)) (i32.const 2))))
    (if (local.get $image_dc)
      (then
        (if (local.get $mask_dc)
          (then
            (drop (call $host_gdi_bitblt
              (local.get $hdc) (local.get $dst_x) (local.get $dst_y)
              (local.get $draw_w) (local.get $draw_h)
              (local.get $mask_dc) (local.get $img_src_x) (i32.const 0)
              (i32.const 0x008800C6))) ;; SRCAND
            (local.set $ret (call $host_gdi_bitblt
              (local.get $hdc) (local.get $dst_x) (local.get $dst_y)
              (local.get $draw_w) (local.get $draw_h)
              (local.get $image_dc) (local.get $img_src_x) (i32.const 0)
              (i32.const 0x00EE0086)))) ;; SRCPAINT
          (else
            (local.set $ret (call $host_gdi_bitblt
              (local.get $hdc) (local.get $dst_x) (local.get $dst_y)
              (local.get $draw_w) (local.get $draw_h)
              (local.get $image_dc) (local.get $img_src_x) (i32.const 0)
              (i32.const 0x00CC0020)))))) ;; SRCCOPY
      (else
        (local.set $memdc (call $host_gdi_create_compat_dc (local.get $hdc)))
        (if (i32.eqz (local.get $memdc)) (then (return (i32.const 0))))
        (drop (call $host_gdi_select_object (local.get $memdc) (local.get $img_bmp)))
        (local.set $ret (call $host_gdi_transparent_blt
          (local.get $hdc) (local.get $dst_x) (local.get $dst_y)
          (local.get $draw_w) (local.get $draw_h)
          (local.get $memdc) (local.get $img_src_x) (i32.const 0)
          (i32.load offset=20 (local.get $img_sw))))
        (drop (call $host_gdi_delete_dc (local.get $memdc)))))
    (local.get $ret))

  ;; Resolve LPSTR_TEXTCALLBACKA/I_IMAGECALLBACK while the item is inserted.
  ;; The stock desktop DefView uses both callbacks: it owns the PIDLs and lets
  ;; SysListView32 ask for the visible names and system-image-list indices.
  ;; Retain private values exactly as the TreeView callback path does so later
  ;; paints never depend on the parent's temporary NMLVDISPINFO buffer.
  (func $lv_resolve_insert_callbacks
      (param $hwnd i32) (param $sw i32) (param $item i32)
      (param $want_text i32) (param $want_image i32)
    (local $parent i32) (local $notify_g i32) (local $notify_w i32)
    (local $mask i32) (local $text_g i32)
    (if (i32.eqz (i32.or (local.get $want_text) (local.get $want_image)))
      (then (return)))
    (local.set $parent (call $wnd_get_parent (local.get $hwnd)))
    (if (i32.eqz (local.get $parent)) (then (return)))
    ;; NMLVDISPINFOA (NMHDR + LVITEMA = 52 bytes), followed by MAX_PATH.
    (local.set $notify_g (call $heap_alloc (i32.const 312)))
    (if (i32.eqz (local.get $notify_g)) (then (return)))
    (local.set $notify_w (call $g2w (local.get $notify_g)))
    (call $zero_memory (local.get $notify_w) (i32.const 312))
    (local.set $mask (i32.const 0x0004)) ;; LVIF_PARAM
    (if (local.get $want_text)
      (then (local.set $mask (i32.or (local.get $mask) (i32.const 0x0001)))))
    (if (local.get $want_image)
      (then (local.set $mask (i32.or (local.get $mask) (i32.const 0x0002)))))
    ;; NMHDR.
    (i32.store          (local.get $notify_w) (local.get $hwnd))
    (i32.store offset=4 (local.get $notify_w) (call $ctrl_table_get_id (local.get $hwnd)))
    (i32.store offset=8 (local.get $notify_w) (i32.const -150)) ;; LVN_GETDISPINFOA
    ;; LVITEMA at +12.
    (i32.store offset=12 (local.get $notify_w) (local.get $mask))
    (i32.store offset=16 (local.get $notify_w) (local.get $item))
    (i32.store offset=20 (local.get $notify_w) (i32.const 0))
    (i32.store offset=24 (local.get $notify_w)
      (i32.load (call $lv_item_state_addr (local.get $sw) (local.get $item))))
    (i32.store offset=32 (local.get $notify_w)
      (i32.add (local.get $notify_g) (i32.const 52)))
    (i32.store offset=36 (local.get $notify_w) (i32.const 260))
    (i32.store offset=40 (local.get $notify_w) (i32.const -1))
    (i32.store offset=44 (local.get $notify_w)
      (i32.load (call $lv_item_param_addr (local.get $sw) (local.get $item))))
    (drop (call $wnd_send_message
      (local.get $parent) (i32.const 0x004E)
      (call $ctrl_table_get_id (local.get $hwnd)) (local.get $notify_g)))
    (if (local.get $want_text)
      (then
        (local.set $text_g (i32.load offset=32 (local.get $notify_w)))
        (if (i32.and
              (i32.ne (local.get $text_g) (i32.const 0))
              (i32.lt_u (local.get $text_g) (i32.const 0xFFFF0000)))
          (then (call $lv_set_cell_text
            (local.get $sw) (local.get $item) (i32.const 0) (local.get $text_g))))))
    (if (local.get $want_image)
      (then (i32.store
        (call $lv_item_image_addr (local.get $sw) (local.get $item))
        (i32.load offset=40 (local.get $notify_w)))))
    (call $heap_free (local.get $notify_g)))

  ;; Does this LVM_* message change what the control looks like?
  ;;
  ;; A real SysListView32 invalidates itself whenever its content, columns
  ;; or colours change; ours only ever painted when something else happened
  ;; to invalidate it. sndvol32 fills its "Show the following volume
  ;; controls" list from WM_INITDIALOG, after the dialog's one paint pass,
  ;; so the list stayed empty for the life of the window. Enumerated rather
  ;; than range-tested on purpose: the LVM_GET* messages outnumber these and
  ;; repainting on a query would be a repaint per redraw.
  (func $lv_msg_repaints (param $msg i32) (result i32)
    (i32.or
      (i32.or
        (i32.or
          (i32.or (i32.eq (local.get $msg) (i32.const 0x1001))  ;; SETBKCOLOR
                  (i32.eq (local.get $msg) (i32.const 0x1003))) ;; SETIMAGELIST
          (i32.or (i32.eq (local.get $msg) (i32.const 0x1006))  ;; SETITEMA
                  (i32.eq (local.get $msg) (i32.const 0x1007)))) ;; INSERTITEMA
        (i32.or
          (i32.or (i32.eq (local.get $msg) (i32.const 0x1008))  ;; DELETEITEM
                  (i32.eq (local.get $msg) (i32.const 0x1009))) ;; DELETEALLITEMS
          (i32.or (i32.eq (local.get $msg) (i32.const 0x100F))  ;; SETITEMPOSITION
                  (i32.eq (local.get $msg) (i32.const 0x1013))))) ;; ENSUREVISIBLE
      (i32.or
        (i32.or
          (i32.or (i32.eq (local.get $msg) (i32.const 0x101A))  ;; SETCOLUMNA
                  (i32.eq (local.get $msg) (i32.const 0x101B))) ;; INSERTCOLUMNA
          (i32.or (i32.eq (local.get $msg) (i32.const 0x101C))  ;; DELETECOLUMN
                  (i32.eq (local.get $msg) (i32.const 0x101E)))) ;; SETCOLUMNWIDTH
        (i32.or
          (i32.or (i32.eq (local.get $msg) (i32.const 0x1024))  ;; SETTEXTCOLOR
                  (i32.eq (local.get $msg) (i32.const 0x1026))) ;; SETTEXTBKCOLOR
          (i32.or
            (i32.or (i32.eq (local.get $msg) (i32.const 0x102B))  ;; SETITEMSTATE
                    (i32.eq (local.get $msg) (i32.const 0x102E))) ;; SETITEMTEXTA
            (i32.or (i32.eq (local.get $msg) (i32.const 0x1030))  ;; SORTITEMS
                    (i32.eq (local.get $msg) (i32.const 0x1036)))))))) ;; SETEXTENDEDLISTVIEWSTYLE

  (func $listview_wndproc (param $hwnd i32) (param $msg i32) (param $wParam i32) (param $lParam i32) (result i32)
    (local $state i32) (local $sw i32) (local $cs_w i32)
    (local $hdc i32) (local $sz i32) (local $w i32) (local $h i32)
    (local $mask i32) (local $idx i32) (local $sub i32) (local $count i32)
    (local $lvi_w i32) (local $col_w i32) (local $width i32) (local $ptr i32)
    (local $i i32) (local $src i32) (local $dst i32) (local $old i32)
    (local $top i32) (local $visible i32) (local $max i32) (local $hit i32)
    (local $x i32) (local $y i32) (local $row i32) (local $new_top i32)
    (local $header_h i32) (local $content_right i32) (local $draw_row i32)
    (local $cell_g i32) (local $cell_w i32) (local $text_len i32) (local $icon_brush i32)
    (local $bk_brush i32)
    (local $col_count i32) (local $col_x i32) (local $col_idx i32)
    (local $widths_w i32) (local $texts_w i32) (local $pressed_part i32)
    (local $delta i32) (local $code i32)
    (local $indent i32) (local $icon_x i32)

    (local.set $state (call $wnd_get_state_ptr (local.get $hwnd)))

    ;; WM_CREATE
    (if (i32.eq (local.get $msg) (i32.const 0x0001))
      (then
        (local.set $cs_w (call $g2w (local.get $lParam)))
        (local.set $state (call $heap_alloc (i32.const 76)))
        (local.set $sw (call $g2w (local.get $state)))
        (call $zero_memory (local.get $sw) (i32.const 76))
        (call $lv_set_selected (local.get $sw) (i32.const -1))
        ;; CREATESTRUCT.hMenu is not copied in: it is already CONTROL_TABLE+4.
        ;; Nothing ever read the copy that used to be stored here.
        (call $lv_set_bk_color (local.get $sw) (i32.const 0x00FFFFFF))
        (call $lv_set_text_color (local.get $sw) (i32.const 0x00000000))
        (call $lv_set_text_bk_color (local.get $sw) (i32.const 0x00FFFFFF))
        (call $wnd_set_state_ptr (local.get $hwnd) (local.get $state))
        (return (i32.const 0))))

    ;; WM_DESTROY
    (if (i32.eq (local.get $msg) (i32.const 0x0002))
      (then
        (if (local.get $state)
          (then
            (local.set $sw (call $g2w (local.get $state)))
            (call $lv_clear_items (local.get $hwnd) (local.get $sw))
            (call $lv_clear_columns (local.get $sw))
            (call $heap_free (call $lv_cells_ptr (local.get $sw)))
            (call $heap_free (call $lv_col_widths_ptr (local.get $sw)))
            (call $heap_free (call $lv_col_texts_ptr (local.get $sw)))
            (call $heap_free (local.get $state))
            (call $wnd_set_state_ptr (local.get $hwnd) (i32.const 0))))
        (return (i32.const 0))))

    (if (i32.eqz (local.get $state)) (then (return (i32.const 0))))
    (local.set $sw (call $g2w (local.get $state)))

    (if (call $lv_msg_repaints (local.get $msg))
      (then (call $invalidate_hwnd (local.get $hwnd))))

    ;; LVM_GETIMAGELIST / LVM_SETIMAGELIST. Keep normal and small image lists
    ;; separate: report rows use LVSIL_SMALL while desktop LVS_ICON uses the
    ;; authentic 32x32 LVSIL_NORMAL strip.
    (if (i32.eq (local.get $msg) (i32.const 0x1002))
      (then
        (if (i32.eqz (local.get $wParam))
          (then (return (call $lv_normal_image_list (local.get $sw)))))
        (if (i32.eq (local.get $wParam) (i32.const 2))
          (then (return (call $lv_state_image_list (local.get $sw)))))
        (return (call $lv_image_list (local.get $sw)))))
    (if (i32.eq (local.get $msg) (i32.const 0x1003))
      (then
        ;; LVSIL_NORMAL (0).
        (if (i32.eqz (local.get $wParam))
          (then
            (local.set $old (call $lv_normal_image_list (local.get $sw)))
            (call $lv_set_normal_image_list (local.get $sw) (local.get $lParam))
            (return (local.get $old))))
        ;; LVSIL_STATE (2) is how a pre-XP app asks for check boxes: it hands
        ;; over a two-image list and then sets each item's state-image index.
        ;; Keep it apart from the small-icon list -- what it selects is not an
        ;; icon to draw but a check box to compose, and only its presence
        ;; matters to the painter.
        (if (i32.eq (local.get $wParam) (i32.const 2))
          (then
            (local.set $old (call $lv_state_image_list (local.get $sw)))
            (call $lv_set_state_image_list (local.get $sw) (local.get $lParam))
            (return (local.get $old))))
        (local.set $old (call $lv_image_list (local.get $sw)))
        (call $lv_set_image_list (local.get $sw) (local.get $lParam))
        (return (local.get $old))))

    ;; LVM_GETITEMCOUNT
    (if (i32.eq (local.get $msg) (i32.const 0x1004))
      (then (return (call $lv_item_count (local.get $sw)))))

    ;; LVM_GETSTRINGWIDTHA
    (if (i32.eq (local.get $msg) (i32.const 0x1011))
      (then
        (if (i32.eqz (local.get $lParam)) (then (return (i32.const 0))))
        (return (i32.add
          (i32.mul (call $strlen (call $g2w (local.get $lParam))) (i32.const 6))
          (i32.const 8)))))

    ;; LVM_GETITEMPOSITION / LVM_SETITEMPOSITION
    (if (i32.eq (local.get $msg) (i32.const 0x1010))
      (then
        (if (i32.eqz (local.get $lParam)) (then (return (i32.const 0))))
        (local.set $idx (local.get $wParam))
        (if (i32.or (i32.lt_s (local.get $idx) (i32.const 0))
                    (i32.ge_s (local.get $idx) (call $lv_item_count (local.get $sw))))
          (then (return (i32.const 0))))
        (local.set $ptr (call $g2w (local.get $lParam)))
        (i32.store (local.get $ptr) (i32.const 0))
        (i32.store offset=4 (local.get $ptr)
          (i32.add (call $lv_header_h (local.get $sw))
                   (i32.mul (i32.sub (local.get $idx) (call $lv_top_index (local.get $sw))) (i32.const 16))))
        (return (i32.const 1))))
    (if (i32.eq (local.get $msg) (i32.const 0x100F))
      (then
        ;; Report mode owns row layout; accept the message as a compatibility
        ;; no-op so apps that cache icon positions can continue.
        (call $paint_flag_set_inv (local.get $hwnd))
        (return (i32.const 1))))

    ;; LVM_FINDITEMA
    (if (i32.eq (local.get $msg) (i32.const 0x100D))
      (then
        (if (i32.eqz (local.get $lParam)) (then (return (i32.const -1))))
        (local.set $ptr (call $g2w (local.get $lParam)))
        (local.set $mask (i32.load (local.get $ptr)))
        (local.set $idx (i32.add (local.get $wParam) (i32.const 1)))
        (if (i32.lt_s (local.get $idx) (i32.const 0))
          (then (local.set $idx (i32.const 0))))
        (block $find_done (loop $find
          (br_if $find_done (i32.ge_s (local.get $idx) (call $lv_item_count (local.get $sw))))
          (if (i32.and (local.get $mask) (i32.const 0x0002)) ;; LVFI_STRING
            (then
              (if (call $lv_cell_text_matches
                    (i32.load (call $lv_cell_addr (local.get $sw) (local.get $idx) (i32.const 0)))
                    (i32.load offset=4 (local.get $ptr))
                    (i32.and (local.get $mask) (i32.const 0x0008)))
                (then (return (local.get $idx))))))
          (if (i32.and (local.get $mask) (i32.const 0x0001)) ;; LVFI_PARAM
            (then
              (if (i32.eq (i32.load (call $lv_item_param_addr (local.get $sw) (local.get $idx)))
                          (i32.load offset=8 (local.get $ptr)))
                (then (return (local.get $idx))))))
          (local.set $idx (i32.add (local.get $idx) (i32.const 1)))
          (br $find)))
        (return (i32.const -1))))

    ;; LVM_GETORIGIN / LVM_GETVIEWRECT / LVM_GETITEMSPACING
    (if (i32.eq (local.get $msg) (i32.const 0x1029))
      (then
        (if (i32.eqz (local.get $lParam)) (then (return (i32.const 0))))
        (local.set $ptr (call $g2w (local.get $lParam)))
        (i32.store (local.get $ptr) (i32.const 0))
        (i32.store offset=4 (local.get $ptr)
          (i32.sub (i32.const 0) (i32.mul (call $lv_top_index (local.get $sw)) (i32.const 16))))
        (return (i32.const 1))))
    (if (i32.eq (local.get $msg) (i32.const 0x1022))
      (then
        (if (i32.eqz (local.get $lParam)) (then (return (i32.const 0))))
        (local.set $ptr (call $g2w (local.get $lParam)))
        (i32.store (local.get $ptr) (i32.const 0))
        (i32.store offset=4 (local.get $ptr) (i32.const 0))
        (i32.store offset=8 (local.get $ptr) (call $lv_report_total_width (local.get $sw)))
        (i32.store offset=12 (local.get $ptr)
          (i32.add (call $lv_header_h (local.get $sw))
                   (i32.mul (call $lv_item_count (local.get $sw)) (i32.const 16))))
        (return (i32.const 1))))
    (if (i32.eq (local.get $msg) (i32.const 0x1033))
      (then
        (return (i32.or (i32.const 120) (i32.shl (i32.const 16) (i32.const 16))))))

    ;; LVM_UPDATE / LVM_REDRAWITEMS. The WAT control repaints as one surface;
    ;; accept these range invalidation hints and schedule a repaint.
    (if (i32.or (i32.eq (local.get $msg) (i32.const 0x102A))
                (i32.eq (local.get $msg) (i32.const 0x1015)))
      (then
        (call $paint_flag_set_inv (local.get $hwnd))
        (return (i32.const 1))))

    ;; LVM_DELETEITEM / LVM_DELETEALLITEMS
    (if (i32.eq (local.get $msg) (i32.const 0x1008))
      (then
        (return (call $lv_delete_item (local.get $hwnd) (local.get $sw) (local.get $wParam)))))
    (if (i32.eq (local.get $msg) (i32.const 0x1009))
      (then
        (call $lv_clear_items (local.get $hwnd) (local.get $sw))
        (call $paint_flag_set_inv (local.get $hwnd))
        (return (i32.const 1))))

    ;; LVM_SETITEMCOUNT
    (if (i32.eq (local.get $msg) (i32.const 0x102F))
      (then
        (if (i32.lt_s (local.get $wParam) (i32.const 0))
          (then (local.set $wParam (i32.const 0))))
        (local.set $count (call $lv_item_count (local.get $sw)))
        (if (i32.lt_s (local.get $wParam) (local.get $count))
          (then
            (local.set $i (local.get $wParam))
            (block $done (loop $items
              (br_if $done (i32.ge_u (local.get $i) (local.get $count)))
              (local.set $sub (i32.const 0))
              (block $subs_done (loop $subs
                (br_if $subs_done (i32.ge_u (local.get $sub) (i32.const 8)))
                (local.set $ptr (i32.load (call $lv_cell_addr (local.get $sw) (local.get $i) (local.get $sub))))
                (if (local.get $ptr) (then (call $heap_free (local.get $ptr))))
                (i32.store (call $lv_cell_addr (local.get $sw) (local.get $i) (local.get $sub)) (i32.const 0))
                (local.set $sub (i32.add (local.get $sub) (i32.const 1)))
                (br $subs)))
              (local.set $i (i32.add (local.get $i) (i32.const 1)))
              (br $items)))))
        (if (i32.gt_s (local.get $wParam) (local.get $count))
          (then
            (call $lv_ensure_item_capacity (local.get $sw) (local.get $wParam))
            (local.set $i (local.get $count))
            (block $done2 (loop $clear_new
              (br_if $done2 (i32.ge_u (local.get $i) (local.get $wParam)))
              (call $zero_memory (call $lv_cell_addr (local.get $sw) (local.get $i) (i32.const 0)) (i32.const 44))
              (i32.store (call $lv_item_image_addr (local.get $sw) (local.get $i)) (i32.const -1))
              (local.set $i (i32.add (local.get $i) (i32.const 1)))
              (br $clear_new)))))
        (call $lv_set_item_count (local.get $sw) (local.get $wParam))
        (if (i32.ge_s (call $lv_selected (local.get $sw)) (local.get $wParam))
          (then (call $lv_set_selected (local.get $sw) (i32.const -1))))
        (drop (call $lv_scroll_to_for_h
          (local.get $hwnd)
          (local.get $sw)
          (call $ctrl_get_h (local.get $hwnd))
          (call $lv_top_index (local.get $sw))))
        (call $paint_flag_set_inv (local.get $hwnd))
        (return (i32.const 1))))

    ;; LVM_INSERTCOLUMNA
    (if (i32.eq (local.get $msg) (i32.const 0x101B))
      (then
        (if (i32.eqz (local.get $lParam)) (then (return (i32.const -1))))
        (local.set $idx (local.get $wParam))
        (local.set $count (call $lv_col_count (local.get $sw)))
        (if (i32.lt_s (local.get $idx) (i32.const 0)) (then (local.set $idx (i32.const 0))))
        (if (i32.gt_s (local.get $idx) (local.get $count)) (then (local.set $idx (local.get $count))))
        (call $lv_ensure_col_capacity (local.get $sw) (i32.add (local.get $count) (i32.const 1)))
        (local.set $widths_w (call $g2w (call $lv_col_widths_ptr (local.get $sw))))
        (local.set $texts_w (call $g2w (call $lv_col_texts_ptr (local.get $sw))))
        ;; Open a hole at $idx: columns [idx, count) move up one slot. The loop
        ;; walked high-to-low for the overlap, which is memmove of the whole run
        ;; for a destination above the source -- one $memcpy per parallel array.
        ;; $idx is clamped to [0, count] above, so the length is never negative.
        (call $memcpy
          (i32.add (local.get $widths_w) (i32.mul (i32.add (local.get $idx) (i32.const 1)) (i32.const 4)))
          (i32.add (local.get $widths_w) (i32.mul (local.get $idx) (i32.const 4)))
          (i32.mul (i32.sub (local.get $count) (local.get $idx)) (i32.const 4)))
        (call $memcpy
          (i32.add (local.get $texts_w) (i32.mul (i32.add (local.get $idx) (i32.const 1)) (i32.const 4)))
          (i32.add (local.get $texts_w) (i32.mul (local.get $idx) (i32.const 4)))
          (i32.mul (i32.sub (local.get $count) (local.get $idx)) (i32.const 4)))
        (local.set $col_w (call $g2w (local.get $lParam)))
        (local.set $mask (i32.load (local.get $col_w)))
        (local.set $width (i32.const 80))
        (if (i32.and (local.get $mask) (i32.const 0x0002))
          (then (local.set $width (i32.load offset=8 (local.get $col_w)))))
        (if (i32.le_s (local.get $width) (i32.const 0))
          (then (local.set $width (i32.const 80))))
        (i32.store (i32.add (local.get $widths_w) (i32.mul (local.get $idx) (i32.const 4))) (local.get $width))
        (i32.store (i32.add (local.get $texts_w) (i32.mul (local.get $idx) (i32.const 4))) (i32.const 0))
        (if (i32.and (local.get $mask) (i32.const 0x0004))
          (then
            (local.set $ptr (i32.load offset=12 (local.get $col_w)))
            (if (local.get $ptr)
              (then
                (if (i32.ne (local.get $ptr) (i32.const -1))
                  (then
                    (local.set $old (call $wat_str_to_heap (call $g2w (local.get $ptr)) (call $strlen (call $g2w (local.get $ptr)))))
                    (i32.store (i32.add (local.get $texts_w) (i32.mul (local.get $idx) (i32.const 4))) (local.get $old))))))))
        (call $lv_set_col_count (local.get $sw) (i32.add (local.get $count) (i32.const 1)))
        (call $paint_flag_set_inv (local.get $hwnd))
        (return (local.get $idx))))

    ;; LVM_DELETECOLUMN
    (if (i32.eq (local.get $msg) (i32.const 0x101C))
      (then
        (return (call $lv_delete_column (local.get $hwnd) (local.get $sw) (local.get $wParam)))))

    ;; LVM_GETCOLUMNA / LVM_SETCOLUMNA
    (if (i32.eq (local.get $msg) (i32.const 0x1019))
      (then
        (if (i32.eqz (local.get $lParam)) (then (return (i32.const 0))))
        (local.set $idx (local.get $wParam))
        (if (i32.or (i32.lt_s (local.get $idx) (i32.const 0))
                    (i32.ge_s (local.get $idx) (call $lv_col_count (local.get $sw))))
          (then (return (i32.const 0))))
        (local.set $col_w (call $g2w (local.get $lParam)))
        (local.set $mask (i32.load (local.get $col_w)))
        (if (i32.and (local.get $mask) (i32.const 0x0001))
          (then (i32.store offset=4 (local.get $col_w) (i32.const 0))))
        (if (i32.and (local.get $mask) (i32.const 0x0002))
          (then (i32.store offset=8 (local.get $col_w)
            (call $lv_report_col_width (local.get $sw) (local.get $idx)))))
        (if (i32.and (local.get $mask) (i32.const 0x0004))
          (then
            (local.set $dst (i32.load offset=12 (local.get $col_w)))
            (local.set $max (i32.load offset=16 (local.get $col_w)))
            (if (i32.and (i32.ne (local.get $dst) (i32.const 0))
                         (i32.gt_s (local.get $max) (i32.const 0)))
              (then
                (local.set $dst (call $g2w (local.get $dst)))
                (local.set $ptr
                  (i32.load
                    (i32.add (call $g2w (call $lv_col_texts_ptr (local.get $sw)))
                             (i32.mul (local.get $idx) (i32.const 4)))))
                (if (local.get $ptr)
                  (then
                    (local.set $src (call $g2w (local.get $ptr)))
                    (local.set $text_len (call $strlen (local.get $src)))
                    (if (i32.ge_u (local.get $text_len) (local.get $max))
                      (then (local.set $text_len (i32.sub (local.get $max) (i32.const 1)))))
                    (if (local.get $text_len)
                      (then (call $memcpy (local.get $dst) (local.get $src) (local.get $text_len))))
                    (i32.store8 (i32.add (local.get $dst) (local.get $text_len)) (i32.const 0)))
                  (else
                    (i32.store8 (local.get $dst) (i32.const 0))))))))
        (if (i32.and (local.get $mask) (i32.const 0x0008))
          (then (i32.store offset=20 (local.get $col_w) (local.get $idx))))
        (return (i32.const 1))))
    (if (i32.eq (local.get $msg) (i32.const 0x101A))
      (then
        (if (i32.eqz (local.get $lParam)) (then (return (i32.const 0))))
        (local.set $idx (local.get $wParam))
        (if (i32.or (i32.lt_s (local.get $idx) (i32.const 0))
                    (i32.ge_s (local.get $idx) (call $lv_col_count (local.get $sw))))
          (then (return (i32.const 0))))
        (local.set $col_w (call $g2w (local.get $lParam)))
        (local.set $mask (i32.load (local.get $col_w)))
        (if (i32.and (local.get $mask) (i32.const 0x0002))
          (then
            (local.set $width (i32.load offset=8 (local.get $col_w)))
            (if (i32.le_s (local.get $width) (i32.const 0))
              (then (local.set $width (i32.const 80))))
            (i32.store
              (i32.add (call $g2w (call $lv_col_widths_ptr (local.get $sw)))
                       (i32.mul (local.get $idx) (i32.const 4)))
              (local.get $width))))
        (if (i32.and (local.get $mask) (i32.const 0x0004))
          (then
            (call $lv_set_col_text (local.get $sw) (local.get $idx) (i32.load offset=12 (local.get $col_w)))))
        (call $paint_flag_set_inv (local.get $hwnd))
        (return (i32.const 1))))

    ;; LVM_GETCOLUMNWIDTH / LVM_SETCOLUMNWIDTH
    (if (i32.eq (local.get $msg) (i32.const 0x101D))
      (then
        (local.set $idx (local.get $wParam))
        (if (i32.or (i32.lt_s (local.get $idx) (i32.const 0))
                    (i32.ge_s (local.get $idx) (call $lv_col_count (local.get $sw))))
          (then (return (i32.const 0))))
        (return (i32.load (i32.add (call $g2w (call $lv_col_widths_ptr (local.get $sw))) (i32.mul (local.get $idx) (i32.const 4)))))))
    (if (i32.eq (local.get $msg) (i32.const 0x101E))
      (then
        (local.set $idx (local.get $wParam))
        (if (i32.or (i32.lt_s (local.get $idx) (i32.const 0))
                    (i32.ge_s (local.get $idx) (call $lv_col_count (local.get $sw))))
          (then (return (i32.const 0))))
        (local.set $width (local.get $lParam))
        (if (i32.le_s (local.get $width) (i32.const 0)) (then (local.set $width (i32.const 80))))
        (i32.store (i32.add (call $g2w (call $lv_col_widths_ptr (local.get $sw))) (i32.mul (local.get $idx) (i32.const 4))) (local.get $width))
        (call $paint_flag_set_inv (local.get $hwnd))
        (return (i32.const 1))))

    ;; LVM_GETHEADER plus a bounded pseudo-Header message surface. Returning
    ;; the ListView hwnd lets apps that only query/send HDM_* messages proceed
    ;; without a real child SysHeader32 window yet.
    (if (i32.eq (local.get $msg) (i32.const 0x101F))
      (then
        (if (i32.gt_s (call $lv_col_count (local.get $sw)) (i32.const 0))
          (then (return (local.get $hwnd))))
        (return (i32.const 0))))
    ;; HDM_GETITEMCOUNT
    (if (i32.eq (local.get $msg) (i32.const 0x1200))
      (then (return (call $lv_col_count (local.get $sw)))))
    ;; HDM_GETITEMA
    (if (i32.eq (local.get $msg) (i32.const 0x1203))
      (then
        (if (i32.eqz (local.get $lParam)) (then (return (i32.const 0))))
        (local.set $idx (local.get $wParam))
        (if (i32.or (i32.lt_s (local.get $idx) (i32.const 0))
                    (i32.ge_s (local.get $idx) (call $lv_col_count (local.get $sw))))
          (then (return (i32.const 0))))
        (local.set $ptr (call $g2w (local.get $lParam)))
        (local.set $mask (i32.load (local.get $ptr)))
        (if (i32.and (local.get $mask) (i32.const 0x0001))
          (then (i32.store offset=4 (local.get $ptr)
            (call $lv_report_col_width (local.get $sw) (local.get $idx)))))
        (if (i32.and (local.get $mask) (i32.const 0x0002))
          (then
            (local.set $dst (i32.load offset=8 (local.get $ptr)))
            (local.set $max (i32.load offset=16 (local.get $ptr)))
            (if (i32.and (i32.ne (local.get $dst) (i32.const 0))
                         (i32.gt_s (local.get $max) (i32.const 0)))
              (then
                (local.set $dst (call $g2w (local.get $dst)))
                (local.set $src
                  (i32.load
                    (i32.add (call $g2w (call $lv_col_texts_ptr (local.get $sw)))
                             (i32.mul (local.get $idx) (i32.const 4)))))
                (if (local.get $src)
                  (then
                    (local.set $src (call $g2w (local.get $src)))
                    (local.set $text_len (call $strlen (local.get $src)))
                    (if (i32.ge_u (local.get $text_len) (local.get $max))
                      (then (local.set $text_len (i32.sub (local.get $max) (i32.const 1)))))
                    (if (local.get $text_len)
                      (then (call $memcpy (local.get $dst) (local.get $src) (local.get $text_len))))
                    (i32.store8 (i32.add (local.get $dst) (local.get $text_len)) (i32.const 0)))
                  (else
                    (i32.store8 (local.get $dst) (i32.const 0))))))))
        (if (i32.and (local.get $mask) (i32.const 0x0004))
          (then (i32.store offset=20 (local.get $ptr) (i32.const 0))))
        (if (i32.and (local.get $mask) (i32.const 0x0080))
          (then (i32.store offset=32 (local.get $ptr) (local.get $idx))))
        (return (i32.const 1))))
    ;; HDM_SETITEMA. Update the same bounded report-column backing state used
    ;; by LVM_SETCOLUMNA. Header reordering is still identity-only.
    (if (i32.eq (local.get $msg) (i32.const 0x1204))
      (then
        (if (i32.eqz (local.get $lParam)) (then (return (i32.const 0))))
        (local.set $idx (local.get $wParam))
        (if (i32.or (i32.lt_s (local.get $idx) (i32.const 0))
                    (i32.ge_s (local.get $idx) (call $lv_col_count (local.get $sw))))
          (then (return (i32.const 0))))
        (local.set $ptr (call $g2w (local.get $lParam)))
        (local.set $mask (i32.load (local.get $ptr)))
        (if (i32.and (local.get $mask) (i32.const 0x0080))
          (then
            (if (i32.ne (i32.load offset=32 (local.get $ptr)) (local.get $idx))
              (then (return (i32.const 0))))))
        (if (i32.and (local.get $mask) (i32.const 0x0001))
          (then
            (local.set $width (i32.load offset=4 (local.get $ptr)))
            (if (i32.le_s (local.get $width) (i32.const 0))
              (then (local.set $width (i32.const 80))))
            (i32.store
              (i32.add (call $g2w (call $lv_col_widths_ptr (local.get $sw)))
                       (i32.mul (local.get $idx) (i32.const 4)))
              (local.get $width))))
        (if (i32.and (local.get $mask) (i32.const 0x0002))
          (then
            (call $lv_set_col_text (local.get $sw) (local.get $idx) (i32.load offset=8 (local.get $ptr)))))
        (call $paint_flag_set_inv (local.get $hwnd))
        (return (i32.const 1))))
    ;; HDM_LAYOUT
    (if (i32.eq (local.get $msg) (i32.const 0x1205))
      (then
        (if (i32.eqz (local.get $lParam)) (then (return (i32.const 0))))
        (local.set $ptr (call $g2w (local.get $lParam)))
        (local.set $src (i32.load (local.get $ptr))) ;; RECT*
        (local.set $dst (i32.load offset=4 (local.get $ptr))) ;; WINDOWPOS*
        (if (i32.eqz (local.get $dst)) (then (return (i32.const 0))))
        (local.set $header_h (call $lv_header_h (local.get $sw)))
        (if (i32.eqz (local.get $header_h)) (then (local.set $header_h (i32.const 18))))
        (if (local.get $src)
          (then
            (local.set $src (call $g2w (local.get $src)))
            (local.set $x (i32.load (local.get $src)))
            (local.set $y (i32.load offset=4 (local.get $src)))
            (local.set $width (i32.sub (i32.load offset=8 (local.get $src)) (local.get $x)))
            (i32.store offset=4 (local.get $src) (i32.add (local.get $y) (local.get $header_h))))
          (else
            (local.set $x (i32.const 0))
            (local.set $y (i32.const 0))
            (local.set $width (call $ctrl_get_w (local.get $hwnd)))))
        (local.set $dst (call $g2w (local.get $dst)))
        (i32.store          (local.get $dst) (local.get $hwnd))
        (i32.store offset=4 (local.get $dst) (i32.const 0))
        (i32.store offset=8 (local.get $dst) (local.get $x))
        (i32.store offset=12 (local.get $dst) (local.get $y))
        (i32.store offset=16 (local.get $dst) (local.get $width))
        (i32.store offset=20 (local.get $dst) (local.get $header_h))
        (i32.store offset=24 (local.get $dst) (i32.const 0x0014)) ;; SWP_NOZORDER | SWP_NOACTIVATE
        (return (i32.const 1))))
    ;; HDM_ORDERTOINDEX / HDM_GETORDERARRAY / HDM_SETORDERARRAY. The pseudo
    ;; header exposes only identity order until real header reordering lands.
    (if (i32.eq (local.get $msg) (i32.const 0x120F))
      (then
        (if (i32.or (i32.lt_s (local.get $wParam) (i32.const 0))
                    (i32.ge_s (local.get $wParam) (call $lv_col_count (local.get $sw))))
          (then (return (i32.const -1))))
        (return (local.get $wParam))))
    (if (i32.eq (local.get $msg) (i32.const 0x1211))
      (then
        (local.set $count (call $lv_col_count (local.get $sw)))
        (if (i32.or (i32.eqz (local.get $lParam))
                    (i32.lt_u (local.get $wParam) (local.get $count)))
          (then (return (i32.const 0))))
        (local.set $ptr (call $g2w (local.get $lParam)))
        (local.set $i (i32.const 0))
        (block $order_get_done (loop $order_get
          (br_if $order_get_done (i32.ge_u (local.get $i) (local.get $count)))
          (i32.store (i32.add (local.get $ptr) (i32.mul (local.get $i) (i32.const 4))) (local.get $i))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $order_get)))
        (return (i32.const 1))))
    (if (i32.eq (local.get $msg) (i32.const 0x1212))
      (then
        (local.set $count (call $lv_col_count (local.get $sw)))
        (if (i32.or (i32.eqz (local.get $lParam))
                    (i32.lt_u (local.get $wParam) (local.get $count)))
          (then (return (i32.const 0))))
        (local.set $ptr (call $g2w (local.get $lParam)))
        (local.set $i (i32.const 0))
        (block $order_set_done (loop $order_set
          (br_if $order_set_done (i32.ge_u (local.get $i) (local.get $count)))
          (if (i32.ne (i32.load (i32.add (local.get $ptr) (i32.mul (local.get $i) (i32.const 4)))) (local.get $i))
            (then (return (i32.const 0))))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $order_set)))
        (return (i32.const 1))))
    ;; HDM_HITTEST
    (if (i32.eq (local.get $msg) (i32.const 0x1206))
      (then
        (if (i32.eqz (local.get $lParam)) (then (return (i32.const -1))))
        (local.set $ptr (call $g2w (local.get $lParam)))
        (local.set $x (i32.load (local.get $ptr)))
        (local.set $y (i32.load offset=4 (local.get $ptr)))
        (local.set $header_h (call $lv_header_h (local.get $sw)))
        (if (i32.or (i32.lt_s (local.get $y) (i32.const 0))
                    (i32.ge_s (local.get $y) (local.get $header_h)))
          (then
            (i32.store offset=8 (local.get $ptr) (i32.const 0x0001))
            (i32.store offset=12 (local.get $ptr) (i32.const -1))
            (return (i32.const -1))))
        (local.set $col_idx (i32.const 0))
        (local.set $col_x (i32.const 0))
        (block $hd_hit_done (loop $hd_hit_cols
          (br_if $hd_hit_done (i32.ge_s (local.get $col_idx) (call $lv_col_count (local.get $sw))))
          (local.set $width (call $lv_report_col_width (local.get $sw) (local.get $col_idx)))
          (if (i32.and
                (i32.ge_s (local.get $x) (local.get $col_x))
                (i32.lt_s (local.get $x) (i32.add (local.get $col_x) (local.get $width))))
            (then
              (i32.store offset=8 (local.get $ptr) (i32.const 0x0002))
              (i32.store offset=12 (local.get $ptr) (local.get $col_idx))
              (return (local.get $col_idx))))
          (local.set $col_x (i32.add (local.get $col_x) (local.get $width)))
          (local.set $col_idx (i32.add (local.get $col_idx) (i32.const 1)))
          (br $hd_hit_cols)))
        (i32.store offset=8 (local.get $ptr) (i32.const 0x0001))
        (i32.store offset=12 (local.get $ptr) (i32.const -1))
        (return (i32.const -1))))
    ;; HDM_GETITEMRECT
    (if (i32.eq (local.get $msg) (i32.const 0x1207))
      (then
        (if (i32.eqz (local.get $lParam)) (then (return (i32.const 0))))
        (local.set $idx (local.get $wParam))
        (if (i32.or (i32.lt_s (local.get $idx) (i32.const 0))
                    (i32.ge_s (local.get $idx) (call $lv_col_count (local.get $sw))))
          (then (return (i32.const 0))))
        (local.set $ptr (call $g2w (local.get $lParam)))
        (local.set $col_x (call $lv_report_col_left (local.get $sw) (local.get $idx)))
        (local.set $width (call $lv_report_col_width (local.get $sw) (local.get $idx)))
        (i32.store (local.get $ptr) (local.get $col_x))
        (i32.store offset=4 (local.get $ptr) (i32.const 0))
        (i32.store offset=8 (local.get $ptr) (i32.add (local.get $col_x) (local.get $width)))
        (i32.store offset=12 (local.get $ptr) (call $lv_header_h (local.get $sw)))
        (return (i32.const 1))))

    ;; LVM_INSERTITEMA
    (if (i32.eq (local.get $msg) (i32.const 0x1007))
      (then
        (if (i32.eqz (local.get $lParam)) (then (return (i32.const -1))))
        (local.set $lvi_w (call $g2w (local.get $lParam)))
        (local.set $mask (i32.load (local.get $lvi_w)))
        (local.set $idx (i32.load offset=4 (local.get $lvi_w)))
        (local.set $count (call $lv_item_count (local.get $sw)))
        (if (i32.lt_s (local.get $idx) (i32.const 0)) (then (local.set $idx (i32.const 0))))
        (if (i32.gt_s (local.get $idx) (local.get $count)) (then (local.set $idx (local.get $count))))
        (call $lv_ensure_item_capacity (local.get $sw) (i32.add (local.get $count) (i32.const 1)))
        ;; Open a hole at $idx: records [idx, count) move up one 44-byte slot.
        ;; The loop copied one record at a time from the top for the overlap,
        ;; and $lv_cell_addr is linear in $item, so the whole run is one
        ;; memmove -- the mirror of the single $memcpy in $lv_delete_item.
        (call $memcpy
          (call $lv_cell_addr (local.get $sw) (i32.add (local.get $idx) (i32.const 1)) (i32.const 0))
          (call $lv_cell_addr (local.get $sw) (local.get $idx) (i32.const 0))
          (i32.mul (i32.sub (local.get $count) (local.get $idx)) (i32.const 44)))
        (call $zero_memory (call $lv_cell_addr (local.get $sw) (local.get $idx) (i32.const 0)) (i32.const 44))
        (i32.store (call $lv_item_image_addr (local.get $sw) (local.get $idx)) (i32.const -1))
        ;; The record shift also moves per-item state. Keep the control-level
        ;; selection mark attached to the same logical row.
        (local.set $old (call $lv_selected (local.get $sw)))
        (if (i32.ge_s (local.get $old) (local.get $idx))
          (then (call $lv_set_selected (local.get $sw)
            (i32.add (local.get $old) (i32.const 1)))))
        (call $lv_set_item_count (local.get $sw) (i32.add (local.get $count) (i32.const 1)))
        (if (i32.and (local.get $mask) (i32.const 0x0001))
          (then
            (local.set $sub (i32.load offset=8 (local.get $lvi_w)))
            (call $lv_set_cell_text (local.get $sw) (local.get $idx) (local.get $sub) (i32.load offset=20 (local.get $lvi_w)))))
        (if (i32.and (local.get $mask) (i32.const 0x0002))
          (then
            (i32.store
              (call $lv_item_image_addr (local.get $sw) (local.get $idx))
              (i32.load offset=28 (local.get $lvi_w)))))
        (if (i32.and (local.get $mask) (i32.const 0x0004))
          (then
            (i32.store
              (call $lv_item_param_addr (local.get $sw) (local.get $idx))
              (i32.load offset=32 (local.get $lvi_w)))))
        (if (i32.and (local.get $mask) (i32.const 0x0008))
          (then
            (drop (call $lv_change_item_state
              (local.get $hwnd) (local.get $sw) (local.get $idx)
              (i32.load offset=12 (local.get $lvi_w))
              (i32.load offset=16 (local.get $lvi_w))
              (i32.const 0) (i32.const 0)))))
        (call $lv_resolve_insert_callbacks
          (local.get $hwnd) (local.get $sw) (local.get $idx)
          (i32.and
            (i32.ne (i32.and (local.get $mask) (i32.const 0x0001)) (i32.const 0))
            (i32.eq (i32.load offset=20 (local.get $lvi_w)) (i32.const -1)))
          (i32.and
            (i32.ne (i32.and (local.get $mask) (i32.const 0x0002)) (i32.const 0))
            (i32.eq (i32.load offset=28 (local.get $lvi_w)) (i32.const -1))))
        (call $paint_flag_set_inv (local.get $hwnd))
        (return (local.get $idx))))

    ;; LVM_SETITEMA / LVM_SETITEMTEXTA
    (if (i32.or (i32.eq (local.get $msg) (i32.const 0x1006))
                (i32.eq (local.get $msg) (i32.const 0x102E)))
      (then
        (if (i32.eqz (local.get $lParam)) (then (return (i32.const 0))))
        (local.set $lvi_w (call $g2w (local.get $lParam)))
        (local.set $idx
          (select (i32.load offset=4 (local.get $lvi_w)) (local.get $wParam)
                  (i32.eq (local.get $msg) (i32.const 0x1006))))
        (local.set $sub (i32.load offset=8 (local.get $lvi_w)))
        (if (i32.or (i32.lt_s (local.get $idx) (i32.const 0))
                    (i32.ge_s (local.get $idx) (call $lv_item_count (local.get $sw))))
          (then (return (i32.const 0))))
        (if (i32.or (i32.eq (local.get $msg) (i32.const 0x102E))
                    (i32.and (i32.load (local.get $lvi_w)) (i32.const 0x0001)))
          (then (call $lv_set_cell_text (local.get $sw) (local.get $idx) (local.get $sub) (i32.load offset=20 (local.get $lvi_w)))))
        (if (i32.and (i32.load (local.get $lvi_w)) (i32.const 0x0002))
          (then
            (i32.store
              (call $lv_item_image_addr (local.get $sw) (local.get $idx))
              (i32.load offset=28 (local.get $lvi_w)))))
        (if (i32.and (i32.load (local.get $lvi_w)) (i32.const 0x0004))
          (then
            (i32.store
              (call $lv_item_param_addr (local.get $sw) (local.get $idx))
              (i32.load offset=32 (local.get $lvi_w)))))
        (if (i32.and (i32.load (local.get $lvi_w)) (i32.const 0x0008))
          (then
            (if (i32.eqz (call $lv_change_item_state
                  (local.get $hwnd) (local.get $sw) (local.get $idx)
                  (i32.load offset=12 (local.get $lvi_w))
                  (i32.load offset=16 (local.get $lvi_w))
                  (i32.const 0) (i32.const 0)))
              (then (return (i32.const 0))))))
        ;; DefView commonly inserts the PIDL/lParam first and assigns
        ;; LPSTR_TEXTCALLBACKA/I_IMAGECALLBACK with a later LVM_SETITEMA.
        ;; Resolve that form too; handling only INSERTITEM left stock desktop
        ;; rows permanently anonymous even though their private PIDLs existed.
        (call $lv_resolve_insert_callbacks
          (local.get $hwnd) (local.get $sw) (local.get $idx)
          (i32.and
            (i32.or
              (i32.eq (local.get $msg) (i32.const 0x102E))
              (i32.ne (i32.and (i32.load (local.get $lvi_w)) (i32.const 0x0001)) (i32.const 0)))
            (i32.eq (i32.load offset=20 (local.get $lvi_w)) (i32.const -1)))
          (i32.and
            (i32.eq (local.get $msg) (i32.const 0x1006))
            (i32.and
              (i32.ne (i32.and (i32.load (local.get $lvi_w)) (i32.const 0x0002)) (i32.const 0))
              (i32.eq (i32.load offset=28 (local.get $lvi_w)) (i32.const -1)))))
        (call $paint_flag_set_inv (local.get $hwnd))
        (return (i32.const 1))))

    ;; LVM_GETITEMTEXTA / LVM_GETITEMA
    (if (i32.or (i32.eq (local.get $msg) (i32.const 0x102D))
                (i32.eq (local.get $msg) (i32.const 0x1005)))
      (then
        (if (i32.eqz (local.get $lParam)) (then (return (i32.const 0))))
        (local.set $lvi_w (call $g2w (local.get $lParam)))
        (local.set $idx
          (select (i32.load offset=4 (local.get $lvi_w)) (local.get $wParam)
                  (i32.eq (local.get $msg) (i32.const 0x1005))))
        (local.set $sub (i32.load offset=8 (local.get $lvi_w)))
        (if (i32.or (i32.lt_s (local.get $idx) (i32.const 0))
                    (i32.ge_s (local.get $idx) (call $lv_item_count (local.get $sw))))
          (then (return (i32.const 0))))
        (if (i32.eq (local.get $msg) (i32.const 0x1005))
          (then
            (if (i32.and (i32.load (local.get $lvi_w)) (i32.const 0x0002))
              (then
                (i32.store offset=28 (local.get $lvi_w)
                  (i32.load (call $lv_item_image_addr (local.get $sw) (local.get $idx))))))
            (if (i32.and (i32.load (local.get $lvi_w)) (i32.const 0x0004))
              (then
                (i32.store offset=32 (local.get $lvi_w)
                  (i32.load (call $lv_item_param_addr (local.get $sw) (local.get $idx))))))
            (if (i32.and (i32.load (local.get $lvi_w)) (i32.const 0x0008))
              (then
                (i32.store offset=12 (local.get $lvi_w)
                  (i32.and
                    (i32.load (call $lv_item_state_addr (local.get $sw) (local.get $idx)))
                    (i32.load offset=16 (local.get $lvi_w))))))
            (if (i32.and (i32.load (local.get $lvi_w)) (i32.const 0x0001))
              (then
                (drop (call $lv_copy_cell_text
                  (local.get $sw) (local.get $idx) (local.get $sub)
                  (i32.load offset=20 (local.get $lvi_w))
                  (i32.load offset=24 (local.get $lvi_w))))))
            ;; LVM_GETITEM returns BOOL, not the copied text length.
            (return (i32.const 1))))
        (return (call $lv_copy_cell_text
          (local.get $sw) (local.get $idx) (local.get $sub)
          (i32.load offset=20 (local.get $lvi_w))
          (i32.load offset=24 (local.get $lvi_w))))))

    ;; LVM_SETITEMSTATE / LVM_GETITEMSTATE / LVM_GETSELECTEDCOUNT / LVM_GETNEXTITEM
    (if (i32.eq (local.get $msg) (i32.const 0x102B))
      (then
        (if (i32.eqz (local.get $lParam)) (then (return (i32.const 0))))
        (local.set $idx (local.get $wParam))
        (local.set $lvi_w (call $g2w (local.get $lParam)))
        (local.set $mask (i32.load offset=16 (local.get $lvi_w)))
        (local.set $old (i32.load offset=12 (local.get $lvi_w)))
        ;; Win98 applies index -1 to every item, except when the requested
        ;; state cannot be shared: focus is unique, and LVS_SINGLESEL cannot
        ;; select all. Those two requests fail atomically.
        (if (i32.eq (local.get $idx) (i32.const -1))
          (then
            (if (i32.and
                  (i32.and (local.get $old) (local.get $mask))
                  (i32.const 0x0001)) ;; LVIS_FOCUSED
              (then (return (i32.const 0))))
            (if (i32.and
                  (i32.ne
                    (i32.and (i32.and (local.get $old) (local.get $mask)) (i32.const 0x0002))
                    (i32.const 0))
                  (i32.ne
                    (i32.and (call $wnd_get_style (local.get $hwnd)) (i32.const 0x0004))
                    (i32.const 0))) ;; LVS_SINGLESEL
              (then (return (i32.const 0))))
            ;; Win98's single-select clear visits only its selected row.
            (if (i32.and
                  (i32.and
                    (i32.eqz (i32.and (local.get $old) (i32.const 0x0002)))
                    (i32.ne (i32.and (local.get $mask) (i32.const 0x0002)) (i32.const 0)))
                  (i32.ne
                    (i32.and (call $wnd_get_style (local.get $hwnd)) (i32.const 0x0004))
                    (i32.const 0)))
              (then
                (local.set $i
                  (call $lv_find_item_with_state
                    (local.get $sw) (i32.const -1) (i32.const 0x0002)))
                (if (i32.ge_s (local.get $i) (i32.const 0))
                  (then
                    (if (i32.eqz (call $lv_change_item_state
                          (local.get $hwnd) (local.get $sw) (local.get $i)
                          (local.get $old) (local.get $mask)
                          (i32.const 0) (i32.const 0)))
                      (then (return (i32.const 0))))))
                (call $paint_flag_set_inv (local.get $hwnd))
                (return (i32.const 1))))
            (local.set $i (i32.const 0))
            (block $broadcast_done (loop $broadcast_items
              (br_if $broadcast_done
                (i32.ge_s (local.get $i) (call $lv_item_count (local.get $sw))))
              (if (i32.eqz (call $lv_change_item_state
                    (local.get $hwnd) (local.get $sw) (local.get $i)
                    (local.get $old) (local.get $mask)
                    (i32.const 0) (i32.const 1)))
                (then (return (i32.const 0))))
              (local.set $i (i32.add (local.get $i) (i32.const 1)))
              (br $broadcast_items)))
            (call $paint_flag_set_inv (local.get $hwnd))
            (return (i32.const 1))))
        (if (i32.or (i32.lt_s (local.get $idx) (i32.const 0))
                    (i32.ge_s (local.get $idx) (call $lv_item_count (local.get $sw))))
          (then (return (i32.const 0))))
        (if (i32.eqz (call $lv_change_item_state
              (local.get $hwnd) (local.get $sw) (local.get $idx)
              (local.get $old) (local.get $mask)
              (i32.const 0) (i32.const 0)))
          (then (return (i32.const 0))))
        (call $paint_flag_set_inv (local.get $hwnd))
        (return (i32.const 1))))
    (if (i32.eq (local.get $msg) (i32.const 0x102C))
      (then
        (if (i32.or (i32.lt_s (local.get $wParam) (i32.const 0))
                    (i32.ge_s (local.get $wParam) (call $lv_item_count (local.get $sw))))
          (then (return (i32.const 0))))
        (return (i32.and
          (i32.load (call $lv_item_state_addr (local.get $sw) (local.get $wParam)))
          (local.get $lParam)))))
    (if (i32.eq (local.get $msg) (i32.const 0x1032))
      (then (return (call $lv_selected_count (local.get $sw)))))
    (if (i32.eq (local.get $msg) (i32.const 0x100C))
      (then
        (local.set $idx (i32.add (local.get $wParam) (i32.const 1)))
        (local.set $mask (i32.and (local.get $lParam) (i32.const 0x000F)))
        (if (local.get $mask)
          (then (return (call $lv_find_item_with_state
            (local.get $sw) (local.get $wParam) (local.get $mask)))))
        (if (i32.lt_s (local.get $idx) (call $lv_item_count (local.get $sw)))
          (then (return (local.get $idx))))
        (return (i32.const -1))))

    ;; LVM_GETITEMRECT
    (if (i32.eq (local.get $msg) (i32.const 0x100E))
      (then
        (if (i32.eqz (local.get $lParam)) (then (return (i32.const 0))))
        (local.set $idx (local.get $wParam))
        (if (i32.or (i32.lt_s (local.get $idx) (i32.const 0))
                    (i32.ge_s (local.get $idx) (call $lv_item_count (local.get $sw))))
          (then (return (i32.const 0))))
        (local.set $ptr (call $g2w (local.get $lParam)))
        (local.set $code (i32.load (local.get $ptr)))
        (local.set $sz (call $ctrl_get_wh_packed (local.get $hwnd)))
        (local.set $w (i32.and (local.get $sz) (i32.const 0xFFFF)))
        (local.set $h (i32.shr_u (local.get $sz) (i32.const 16)))
        (local.set $header_h (call $lv_header_h (local.get $sw)))
        (local.set $content_right (call $lv_content_right_for_size (local.get $sw) (local.get $w) (local.get $h)))
        (local.set $y
          (i32.add (local.get $header_h)
            (i32.mul
              (i32.sub (local.get $idx) (call $lv_top_index (local.get $sw)))
              (i32.const 16))))
        (local.set $col_w (call $lv_report_col_width (local.get $sw) (i32.const 0)))
        (if (i32.le_s (local.get $col_w) (i32.const 0))
          (then (local.set $col_w (local.get $content_right))))
        (if (i32.or (i32.eq (local.get $code) (i32.const 1))
                    (i32.eq (local.get $code) (i32.const 2)))
          (then
            (i32.store (local.get $ptr)
              (select (i32.const 4) (i32.const 0)
                      (i32.gt_s (local.get $content_right) (i32.const 4))))
            (i32.store offset=8 (local.get $ptr)
              (select (local.get $col_w) (local.get $content_right)
                      (i32.lt_s (local.get $col_w) (local.get $content_right)))))
          (else
            (i32.store (local.get $ptr) (i32.const 0))
            (i32.store offset=8 (local.get $ptr) (local.get $content_right))))
        (i32.store offset=4 (local.get $ptr) (local.get $y))
        (i32.store offset=12 (local.get $ptr) (i32.add (local.get $y) (i32.const 16)))
        (return (i32.const 1))))

    ;; LVM_GETSUBITEMRECT
    (if (i32.eq (local.get $msg) (i32.const 0x1038))
      (then
        (if (i32.eqz (local.get $lParam)) (then (return (i32.const 0))))
        (local.set $idx (local.get $wParam))
        (if (i32.or (i32.lt_s (local.get $idx) (i32.const 0))
                    (i32.ge_s (local.get $idx) (call $lv_item_count (local.get $sw))))
          (then (return (i32.const 0))))
        (local.set $ptr (call $g2w (local.get $lParam)))
        (local.set $code (i32.load (local.get $ptr)))
        (local.set $sub (i32.load offset=4 (local.get $ptr)))
        (local.set $col_w (call $lv_report_col_width (local.get $sw) (local.get $sub)))
        (if (i32.le_s (local.get $col_w) (i32.const 0))
          (then (return (i32.const 0))))
        (local.set $col_x (call $lv_report_col_left (local.get $sw) (local.get $sub)))
        (local.set $header_h (call $lv_header_h (local.get $sw)))
        (local.set $y
          (i32.add (local.get $header_h)
            (i32.mul
              (i32.sub (local.get $idx) (call $lv_top_index (local.get $sw)))
              (i32.const 16))))
        (if (i32.or (i32.eq (local.get $code) (i32.const 1))
                    (i32.eq (local.get $code) (i32.const 2)))
          (then
            (i32.store (local.get $ptr) (i32.add (local.get $col_x) (i32.const 4))))
          (else
            (i32.store (local.get $ptr) (local.get $col_x))))
        (i32.store offset=4 (local.get $ptr) (local.get $y))
        (i32.store offset=8 (local.get $ptr) (i32.add (local.get $col_x) (local.get $col_w)))
        (i32.store offset=12 (local.get $ptr) (i32.add (local.get $y) (i32.const 16)))
        (return (i32.const 1))))

    ;; LVM_GETTOPINDEX / LVM_GETCOUNTPERPAGE / LVM_ENSUREVISIBLE / LVM_SCROLL
    (if (i32.eq (local.get $msg) (i32.const 0x1027))
      (then (return (call $lv_top_index (local.get $sw)))))
    (if (i32.eq (local.get $msg) (i32.const 0x1028))
      (then
        (return (call $lv_visible_rows_for_h
          (local.get $sw)
          (call $ctrl_get_h (local.get $hwnd))))))
    (if (i32.eq (local.get $msg) (i32.const 0x1013))
      (then
        (local.set $idx (local.get $wParam))
        (if (i32.lt_s (local.get $idx) (i32.const 0)) (then (return (i32.const 0))))
        (if (i32.ge_s (local.get $idx) (call $lv_item_count (local.get $sw))) (then (return (i32.const 0))))
        (local.set $sz (call $ctrl_get_wh_packed (local.get $hwnd)))
        (local.set $h (i32.shr_u (local.get $sz) (i32.const 16)))
        (local.set $top (call $lv_top_index (local.get $sw)))
        (local.set $visible (call $lv_visible_rows_for_h (local.get $sw) (local.get $h)))
        (if (i32.lt_s (local.get $idx) (local.get $top))
          (then (drop (call $lv_scroll_to_for_h
            (local.get $hwnd) (local.get $sw) (local.get $h) (local.get $idx)))))
        (if (i32.ge_s (local.get $idx) (i32.add (local.get $top) (local.get $visible)))
          (then
            (drop (call $lv_scroll_to_for_h
              (local.get $hwnd) (local.get $sw) (local.get $h)
              (i32.sub (i32.add (local.get $idx) (i32.const 1)) (local.get $visible))))))
        (call $paint_flag_set_inv (local.get $hwnd))
        (return (i32.const 1))))
    (if (i32.eq (local.get $msg) (i32.const 0x1014))
      (then
        (local.set $delta (i32.div_s (local.get $lParam) (i32.const 16)))
        (if (i32.and (i32.eqz (local.get $delta)) (i32.ne (local.get $lParam) (i32.const 0)))
          (then (local.set $delta (select (i32.const 1) (i32.const -1) (i32.gt_s (local.get $lParam) (i32.const 0))))))
        (drop (call $lv_scroll_by (local.get $hwnd) (local.get $delta)))
        (return (i32.const 1))))

    ;; LVM_HITTEST
    (if (i32.eq (local.get $msg) (i32.const 0x1012))
      (then
        (if (i32.eqz (local.get $lParam)) (then (return (i32.const -1))))
        (local.set $ptr (call $g2w (local.get $lParam)))
        (local.set $x (i32.load (local.get $ptr)))
        (local.set $y (i32.load offset=4 (local.get $ptr)))
        (local.set $header_h (call $lv_header_h (local.get $sw)))
        (local.set $row
          (i32.add (call $lv_top_index (local.get $sw))
            (i32.div_s (i32.sub (local.get $y) (local.get $header_h)) (i32.const 16))))
        (if (i32.or
              (i32.lt_s (local.get $y) (local.get $header_h))
              (i32.or (i32.lt_s (local.get $row) (i32.const 0))
                      (i32.ge_s (local.get $row) (call $lv_item_count (local.get $sw)))))
          (then
            (i32.store offset=8 (local.get $ptr) (i32.const 0))
            (i32.store offset=12 (local.get $ptr) (i32.const -1))
            (i32.store offset=16 (local.get $ptr) (i32.const 0))
            (return (i32.const -1))))
        (local.set $sub (i32.const 0))
        (local.set $col_count (call $lv_col_count (local.get $sw)))
        (if (i32.eqz (local.get $col_count))
          (then (local.set $col_count (i32.const 1))))
        (local.set $col_x (i32.const 0))
        (local.set $col_idx (i32.const 0))
        (block $hit_col_done (loop $hit_cols
          (br_if $hit_col_done (i32.ge_u (local.get $col_idx) (local.get $col_count)))
          (local.set $width (call $lv_report_col_width (local.get $sw) (local.get $col_idx)))
          (if (i32.le_s (local.get $width) (i32.const 0))
            (then (local.set $width (i32.const 120))))
          (if (i32.and
                (i32.ge_s (local.get $x) (local.get $col_x))
                (i32.lt_s (local.get $x) (i32.add (local.get $col_x) (local.get $width))))
            (then
              (local.set $sub (local.get $col_idx))
              (br $hit_col_done)))
          (local.set $col_x (i32.add (local.get $col_x) (local.get $width)))
          (local.set $col_idx (i32.add (local.get $col_idx) (i32.const 1)))
          (br $hit_cols)))
        (i32.store offset=8 (local.get $ptr) (i32.const 0x0004))
        (i32.store offset=12 (local.get $ptr) (local.get $row))
        (i32.store offset=16 (local.get $ptr) (local.get $sub))
        (return (local.get $row))))

    ;; WM_MOUSEWHEEL
    (if (i32.eq (local.get $msg) (i32.const 0x020A))
      (then
        (local.set $delta
          (i32.div_s
            (i32.sub (i32.const 0) (i32.shr_s (local.get $wParam) (i32.const 16)))
            (i32.const 40)))
        (drop (call $lv_scroll_by (local.get $hwnd) (local.get $delta)))
        (return (i32.const 0))))

    ;; WM_VSCROLL
    (if (i32.eq (local.get $msg) (i32.const 0x0115))
      (then
        (local.set $code (i32.and (local.get $wParam) (i32.const 0xFFFF)))
        (if (i32.eq (local.get $code) (i32.const 0))
          (then (drop (call $lv_scroll_by (local.get $hwnd) (i32.const -1)))))
        (if (i32.eq (local.get $code) (i32.const 1))
          (then (drop (call $lv_scroll_by (local.get $hwnd) (i32.const 1)))))
        (if (i32.or (i32.eq (local.get $code) (i32.const 2))
                    (i32.eq (local.get $code) (i32.const 3)))
          (then
            (local.set $h (call $ctrl_get_h (local.get $hwnd)))
            (local.set $delta (call $lv_visible_rows_for_h (local.get $sw) (local.get $h)))
            (if (i32.eq (local.get $code) (i32.const 2))
              (then (local.set $delta (i32.sub (i32.const 0) (local.get $delta)))))
            (drop (call $lv_scroll_by (local.get $hwnd) (local.get $delta)))))
        (if (i32.or (i32.eq (local.get $code) (i32.const 4))
                    (i32.eq (local.get $code) (i32.const 5)))
          (then
            (local.set $h (call $ctrl_get_h (local.get $hwnd)))
            (drop (call $lv_scroll_to_for_h
              (local.get $hwnd) (local.get $sw) (local.get $h)
              (i32.shr_s (local.get $wParam) (i32.const 16))))
            (call $paint_flag_set_inv (local.get $hwnd))))
        (if (i32.eq (local.get $code) (i32.const 6))
          (then (drop (call $lv_scroll_by (local.get $hwnd) (i32.sub (i32.const 0) (call $lv_top_index (local.get $sw)))))))
        (if (i32.eq (local.get $code) (i32.const 7))
          (then
            (local.set $h (call $ctrl_get_h (local.get $hwnd)))
            (drop (call $lv_scroll_by
              (local.get $hwnd)
              (i32.sub (call $lv_max_scroll_for_h (local.get $sw) (local.get $h)) (call $lv_top_index (local.get $sw)))))))
        (return (i32.const 0))))

    ;; Shared scrollbar mouse handling.
    (if (i32.and
          (i32.eq (local.get $msg) (i32.const 0x0202))
          (i32.eq (global.get $sb_pressed_hwnd) (local.get $hwnd)))
      (then
        (global.set $sb_pressed_hwnd (i32.const 0))
        (global.set $sb_pressed_part (i32.const 0))
        (if (i32.eq (global.get $capture_hwnd) (local.get $hwnd))
          (then (global.set $capture_hwnd (i32.const 0))))
        (call $paint_flag_set_inv (local.get $hwnd))
        (return (i32.const 1))))

    (if (i32.eq (local.get $msg) (i32.const 0x0202))
      (then
        (local.set $y (i32.shr_s (local.get $lParam) (i32.const 16)))
        (local.set $header_h (call $lv_header_h (local.get $sw)))
        (if (i32.lt_s (local.get $y) (local.get $header_h))
          (then (return (i32.const 0))))
        (local.set $row
          (i32.add (call $lv_top_index (local.get $sw))
            (i32.div_s (i32.sub (local.get $y) (local.get $header_h)) (i32.const 16))))
        (if (i32.and (i32.ge_s (local.get $row) (i32.const 0))
                     (i32.lt_s (local.get $row) (call $lv_item_count (local.get $sw))))
          (then
            (call $lv_notify_simple (local.get $hwnd) (i32.const -2))))
        (return (i32.const 0))))

    (if (i32.eq (local.get $msg) (i32.const 0x0200))
      (then
        (if (i32.and
              (i32.eq (global.get $sb_pressed_hwnd) (local.get $hwnd))
              (i32.eq (global.get $sb_pressed_part) (i32.const 5)))
          (then
            (local.set $sz (call $ctrl_get_wh_packed (local.get $hwnd)))
            (local.set $h (i32.shr_u (local.get $sz) (i32.const 16)))
            (local.set $max (call $lv_max_scroll_for_h (local.get $sw) (local.get $h)))
            (if (i32.gt_s (local.get $max) (i32.const 0))
              (then
                (local.set $y (i32.shr_s (local.get $lParam) (i32.const 16)))
                (local.set $new_top
                  (call $scrollbar_drag_pos
                    (local.get $h) (local.get $y)
                    (call $lv_drag_anchor_y (local.get $sw))
                    (call $lv_drag_anchor_top (local.get $sw))
                    (i32.const 0) (local.get $max)))
                (if (i32.ne (local.get $new_top) (call $lv_top_index (local.get $sw)))
                  (then
                    (drop (call $lv_scroll_to_for_h
                      (local.get $hwnd) (local.get $sw) (local.get $h) (local.get $new_top)))
                    (call $paint_flag_set_inv (local.get $hwnd))))))
            (return (i32.const 1))))
        (return (i32.const 0))))

    (if (i32.eq (local.get $msg) (i32.const 0x0201))
      (then
        (local.set $x (i32.and (local.get $lParam) (i32.const 0xFFFF)))
        (local.set $y (i32.shr_s (local.get $lParam) (i32.const 16)))
        (local.set $sz (call $ctrl_get_wh_packed (local.get $hwnd)))
        (local.set $w (i32.and (local.get $sz) (i32.const 0xFFFF)))
        (local.set $h (i32.shr_u (local.get $sz) (i32.const 16)))
        (local.set $max (call $lv_max_scroll_for_h (local.get $sw) (local.get $h)))
        (if (i32.and
              (i32.gt_s (local.get $max) (i32.const 0))
              (i32.and (i32.gt_s (local.get $w) (i32.const 16))
                       (i32.ge_s (local.get $x) (i32.sub (local.get $w) (i32.const 16)))))
          (then
            (local.set $hit (call $scroll_arrow_filter_hit
              (local.get $hwnd) (i32.const 1)
              (call $scrollbar_hit_part
                (local.get $h) (local.get $y)
                (call $lv_top_index (local.get $sw)) (i32.const 0) (local.get $max))))
            (if (local.get $hit)
              (then
                (global.set $sb_pressed_hwnd (local.get $hwnd))
                (global.set $sb_pressed_part (local.get $hit))
                (local.set $visible (call $lv_visible_rows_for_h (local.get $sw) (local.get $h)))
                (if (i32.eq (local.get $hit) (i32.const 1))
                  (then (drop (call $lv_scroll_by (local.get $hwnd) (i32.const -1)))))
                (if (i32.eq (local.get $hit) (i32.const 2))
                  (then (drop (call $lv_scroll_by (local.get $hwnd) (i32.const 1)))))
                (if (i32.eq (local.get $hit) (i32.const 3))
                  (then (drop (call $lv_scroll_by
                    (local.get $hwnd) (i32.sub (i32.const 0) (local.get $visible))))))
                (if (i32.eq (local.get $hit) (i32.const 4))
                  (then (drop (call $lv_scroll_by (local.get $hwnd) (local.get $visible)))))
                (if (i32.eq (local.get $hit) (i32.const 5))
                  (then
                    (call $lv_set_drag_anchor_y (local.get $sw) (local.get $y))
                    (call $lv_set_drag_anchor_top (local.get $sw) (call $lv_top_index (local.get $sw)))
                    (global.set $capture_hwnd (local.get $hwnd))))
                (call $paint_flag_set_inv (local.get $hwnd))
                (return (i32.const 1))))))
        (local.set $header_h (call $lv_header_h (local.get $sw)))
        (if (i32.lt_s (local.get $y) (local.get $header_h))
          (then (return (i32.const 0))))
        (local.set $row
          (i32.add (call $lv_top_index (local.get $sw))
            (i32.div_s (i32.sub (local.get $y) (local.get $header_h)) (i32.const 16))))
        (if (i32.and (i32.ge_s (local.get $row) (i32.const 0))
                     (i32.lt_s (local.get $row) (call $lv_item_count (local.get $sw))))
          (then
            (if (i32.eqz (call $lv_select_item (local.get $hwnd) (local.get $sw) (local.get $row)))
              (then (return (i32.const 0))))
            (call $paint_flag_set_inv (local.get $hwnd))
            (return (i32.const 1))))
        (return (i32.const 0))))

    ;; LVM_SETEXTENDEDLISTVIEWSTYLE / LVM_GETEXTENDEDLISTVIEWSTYLE
    (if (i32.eq (local.get $msg) (i32.const 0x1036))
      (then
        (local.set $old (call $lv_ex_style (local.get $sw)))
        (if (local.get $wParam)
          (then
            (call $lv_set_ex_style (local.get $sw)
              (i32.or (i32.and (local.get $old) (i32.xor (local.get $wParam) (i32.const -1)))
                      (i32.and (local.get $lParam) (local.get $wParam)))))
          (else
            (call $lv_set_ex_style (local.get $sw) (local.get $lParam))))
        (return (local.get $old))))
    (if (i32.eq (local.get $msg) (i32.const 0x1037))
      (then (return (call $lv_ex_style (local.get $sw)))))

    ;; LVM_GET/SETBKCOLOR, LVM_GET/SETTEXTCOLOR, LVM_GET/SETTEXTBKCOLOR.
    ;; Store caller-provided COLORREF values exactly so CLR_NONE round-trips.
    (if (i32.eq (local.get $msg) (i32.const 0x1000))
      (then (return (call $lv_bk_color (local.get $sw)))))
    (if (i32.eq (local.get $msg) (i32.const 0x1001))
      (then
        (local.set $old (call $lv_bk_color (local.get $sw)))
        (call $lv_set_bk_color (local.get $sw) (local.get $lParam))
        (call $paint_flag_set_inv (local.get $hwnd))
        (return (local.get $old))))
    (if (i32.eq (local.get $msg) (i32.const 0x1023))
      (then (return (call $lv_text_color (local.get $sw)))))
    (if (i32.eq (local.get $msg) (i32.const 0x1024))
      (then
        (local.set $old (call $lv_text_color (local.get $sw)))
        (call $lv_set_text_color (local.get $sw) (local.get $lParam))
        (call $paint_flag_set_inv (local.get $hwnd))
        (return (local.get $old))))
    (if (i32.eq (local.get $msg) (i32.const 0x1025))
      (then (return (call $lv_text_bk_color (local.get $sw)))))
    (if (i32.eq (local.get $msg) (i32.const 0x1026))
      (then
        (local.set $old (call $lv_text_bk_color (local.get $sw)))
        (call $lv_set_text_bk_color (local.get $sw) (local.get $lParam))
        (call $paint_flag_set_inv (local.get $hwnd))
        (return (local.get $old))))

    ;; WM_ERASEBKGND
    (if (i32.eq (local.get $msg) (i32.const 0x0014))
      (then (return (call $host_erase_background (local.get $hwnd) (i32.const 0)))))

    ;; WM_PAINT
    (if (i32.eq (local.get $msg) (i32.const 0x000F))
      (then
        (local.set $hdc (i32.add (local.get $hwnd) (i32.const 0x40000)))
        (local.set $sz (call $ctrl_get_wh_packed (local.get $hwnd)))
        (local.set $w (i32.and (local.get $sz) (i32.const 0xFFFF)))
        (local.set $h (i32.shr_u (local.get $sz) (i32.const 16)))
        (if (i32.or (i32.le_s (local.get $w) (i32.const 0))
                    (i32.le_s (local.get $h) (i32.const 0)))
          (then (return (i32.const 0))))
        (local.set $max (call $lv_max_scroll_for_h (local.get $sw) (local.get $h)))
        (if (i32.and (i32.gt_s (local.get $max) (i32.const 0))
                     (i32.le_s (local.get $w) (i32.const 16)))
          (then (local.set $max (i32.const 0))))
        (if (i32.gt_s (local.get $max) (i32.const 0))
          (then
            (drop (call $lv_scroll_to_for_h
              (local.get $hwnd) (local.get $sw) (local.get $h) (call $lv_top_index (local.get $sw)))))
          (else
            (drop (call $lv_scroll_to_for_h
              (local.get $hwnd) (local.get $sw) (local.get $h) (i32.const 0)))))
        (local.set $top (call $lv_top_index (local.get $sw)))
        (local.set $header_h (call $lv_header_h (local.get $sw)))
        (local.set $content_right (local.get $w))
        (if (i32.gt_s (local.get $max) (i32.const 0))
          (then (local.set $content_right (i32.sub (local.get $w) (i32.const 16)))))
        (local.set $bk_brush (i32.const 0))
        (if (i32.ne (call $lv_bk_color (local.get $sw)) (i32.const -1))
          (then
            (local.set $bk_brush
              (call $host_gdi_create_solid_brush
                (i32.and (call $lv_bk_color (local.get $sw)) (i32.const 0x00FFFFFF))))))
        ;; CLR_NONE is meaningful for icon views: the shell's desktop has
        ;; already painted wallpaper/COLOR_DESKTOP into the shared surface.
        ;; Report views keep their historical white fallback.
        (if (i32.or
              (i32.eq (i32.and (call $wnd_get_style (local.get $hwnd)) (i32.const 3)) (i32.const 1))
              (i32.ne (call $lv_bk_color (local.get $sw)) (i32.const -1)))
          (then
            (drop (call $host_gdi_fill_rect (local.get $hdc)
              (i32.const 0) (i32.const 0)
              (local.get $w) (local.get $h)
              (select (local.get $bk_brush) (i32.const 0x30010)
                (i32.ne (local.get $bk_brush) (i32.const 0)))))))
        (if (local.get $bk_brush)
          (then (drop (call $host_gdi_delete_object (local.get $bk_brush)))))
        (drop (call $host_gdi_select_object (local.get $hdc) (i32.const 0x30021)))
        (drop (call $host_gdi_set_bk_mode (local.get $hdc) (i32.const 1)))
        (drop (call $host_gdi_set_text_color (local.get $hdc)
          (i32.and (call $lv_text_color (local.get $sw)) (i32.const 0x00FFFFFF))))

        ;; LVS_ICON/LVS_SMALLICON/LVS_LIST. The desktop is LVS_ICON with
        ;; LVS_ALIGNLEFT|LVS_AUTOARRANGE: arrange 75x70 cells down the left,
        ;; draw the normal image list, and center the callback-resolved label.
        ;; Non-report modes intentionally do not expose report columns/header.
        (if (i32.ne
              (i32.and (call $wnd_get_style (local.get $hwnd)) (i32.const 3))
              (i32.const 1))
          (then
            (local.set $visible (i32.div_u (local.get $h) (i32.const 70)))
            (if (i32.eqz (local.get $visible))
              (then (local.set $visible (i32.const 1))))
            (local.set $i (i32.const 0))
            (block $icon_items_done (loop $icon_items
              (br_if $icon_items_done
                (i32.ge_u (local.get $i) (call $lv_item_count (local.get $sw))))
              ;; Callback data may not be available during insertion while
              ;; DefView is still constructing its PIDL array. Common controls
              ;; ask again when a row is displayed, so retry unresolved text
              ;; or image fields at the paint boundary.
              (call $lv_resolve_insert_callbacks
                (local.get $hwnd) (local.get $sw) (local.get $i)
                (i32.eqz
                  (i32.load (call $lv_cell_addr
                    (local.get $sw) (local.get $i) (i32.const 0))))
                (i32.eq
                  (i32.load (call $lv_item_image_addr (local.get $sw) (local.get $i)))
                  (i32.const -1)))
              (if (i32.and (call $wnd_get_style (local.get $hwnd)) (i32.const 0x0800))
                (then
                  (local.set $x (i32.add (i32.const 8)
                    (i32.mul (i32.div_u (local.get $i) (local.get $visible)) (i32.const 75))))
                  (local.set $y (i32.add (i32.const 8)
                    (i32.mul (i32.rem_u (local.get $i) (local.get $visible)) (i32.const 70)))))
                (else
                  (local.set $width (i32.div_u (local.get $w) (i32.const 75)))
                  (if (i32.eqz (local.get $width)) (then (local.set $width (i32.const 1))))
                  (local.set $x (i32.add (i32.const 8)
                    (i32.mul (i32.rem_u (local.get $i) (local.get $width)) (i32.const 75))))
                  (local.set $y (i32.add (i32.const 8)
                    (i32.mul (i32.div_u (local.get $i) (local.get $width)) (i32.const 70))))))
              (drop (call $lv_paint_normal_icon
                (local.get $hdc) (local.get $sw) (local.get $i)
                (i32.add (local.get $x) (i32.const 20)) (local.get $y)))
              (local.set $cell_g
                (i32.load (call $lv_cell_addr (local.get $sw) (local.get $i) (i32.const 0))))
              (if (local.get $cell_g)
                (then
                  (local.set $cell_w (call $g2w (local.get $cell_g)))
                  (local.set $text_len (call $strlen (local.get $cell_w)))
                  (if (local.get $text_len)
                    (then
                      (drop (call $host_gdi_draw_text
                        (local.get $hdc) (local.get $cell_w) (local.get $text_len)
                        (call $paint_rect
                          (local.get $x) (i32.add (local.get $y) (i32.const 36))
                          (i32.add (local.get $x) (i32.const 72))
                          (i32.add (local.get $y) (i32.const 69)))
                        (i32.const 0x0811) (i32.const 0))))))) ;; CENTER|WORDBREAK|NOPREFIX
              (local.set $i (i32.add (local.get $i) (i32.const 1)))
              (br $icon_items)))
            (return (i32.const 0))))

        ;; Header.
        (local.set $col_count (call $lv_col_count (local.get $sw)))
        (if (i32.gt_s (local.get $col_count) (i32.const 0))
          (then
            (drop (call $host_gdi_fill_rect (local.get $hdc)
                    (i32.const 0) (i32.const 0)
                    (local.get $content_right) (local.get $header_h)
                    (i32.const 0x30011)))
            (local.set $widths_w (call $g2w (call $lv_col_widths_ptr (local.get $sw))))
            (local.set $texts_w (call $g2w (call $lv_col_texts_ptr (local.get $sw))))
            (local.set $col_x (i32.const 0))
            (local.set $col_idx (i32.const 0))
            (block $header_done (loop $header_cols
              (br_if $header_done (i32.or
                (i32.ge_u (local.get $col_idx) (local.get $col_count))
                (i32.ge_s (local.get $col_x) (local.get $content_right))))
              (local.set $width (i32.load (i32.add (local.get $widths_w) (i32.mul (local.get $col_idx) (i32.const 4)))))
              (if (i32.le_s (local.get $width) (i32.const 0))
                (then (local.set $width (i32.const 80))))
              (drop (call $host_gdi_draw_edge (local.get $hdc)
                      (local.get $col_x) (i32.const 0)
                      (select (i32.add (local.get $col_x) (local.get $width)) (local.get $content_right)
                              (i32.lt_s (i32.add (local.get $col_x) (local.get $width)) (local.get $content_right)))
                      (local.get $header_h)
                      (i32.const 0x05) (i32.const 0x0F)))
              (local.set $cell_g (i32.load (i32.add (local.get $texts_w) (i32.mul (local.get $col_idx) (i32.const 4)))))
              (if (local.get $cell_g)
                (then
                  (local.set $cell_w (call $g2w (local.get $cell_g)))
                  (local.set $text_len (call $strlen (local.get $cell_w)))
                  (drop (call $host_gdi_text_out (local.get $hdc)
                    (i32.add (local.get $col_x) (i32.const 4)) (i32.const 3)
                    (local.get $cell_w) (local.get $text_len) (i32.const 0)))))
              (local.set $col_x (i32.add (local.get $col_x) (local.get $width)))
              (local.set $col_idx (i32.add (local.get $col_idx) (i32.const 1)))
              (br $header_cols)))))

        ;; Rows.
        (if (call $lv_image_list (local.get $sw))
          (then
            (local.set $icon_brush
              (call $host_gdi_create_solid_brush (i32.const 0x00800000)))))
        (local.set $draw_row (i32.const 0))
        (local.set $visible (call $lv_visible_rows_for_h (local.get $sw) (local.get $h)))
        (block $rows_done (loop $rows
          (br_if $rows_done (i32.ge_u (local.get $draw_row) (local.get $visible)))
          (local.set $row (i32.add (local.get $top) (local.get $draw_row)))
          (br_if $rows_done (i32.ge_u (local.get $row) (call $lv_item_count (local.get $sw))))
          (local.set $y (i32.add (local.get $header_h) (i32.mul (local.get $draw_row) (i32.const 16))))
          (if (i32.lt_s (local.get $y) (local.get $h))
            (then
              (if (i32.and
                    (i32.load (call $lv_item_state_addr (local.get $sw) (local.get $row)))
                    (i32.const 0x0002))
                (then
                  (drop (call $host_gdi_fill_rect (local.get $hdc)
                          (i32.const 0) (local.get $y)
                          (local.get $content_right) (select (i32.add (local.get $y) (i32.const 16)) (local.get $h)
                            (i32.lt_s (i32.add (local.get $y) (i32.const 16)) (local.get $h)))
                          (i32.const 14)))
                  (drop (call $host_gdi_set_text_color (local.get $hdc) (i32.const 0x00FFFFFF)))
                  (drop (call $host_gdi_set_bk_color (local.get $hdc) (i32.const 0x00800000)))
                  (drop (call $host_gdi_set_bk_mode (local.get $hdc) (i32.const 2))))
                (else
                  (drop (call $host_gdi_set_text_color
                    (local.get $hdc)
                    (i32.and (call $lv_text_color (local.get $sw)) (i32.const 0x00FFFFFF))))
                  (if (i32.eq (call $lv_text_bk_color (local.get $sw)) (i32.const -1))
                    (then
                      (drop (call $host_gdi_set_bk_mode (local.get $hdc) (i32.const 1))))
                    (else
                      (drop (call $host_gdi_set_bk_color
                        (local.get $hdc)
                        (i32.and (call $lv_text_bk_color (local.get $sw)) (i32.const 0x00FFFFFF))))
                      (drop (call $host_gdi_set_bk_mode (local.get $hdc) (i32.const 2)))))))
              (local.set $col_count (call $lv_col_count (local.get $sw)))
              (if (i32.eqz (local.get $col_count))
                (then (local.set $col_count (i32.const 1))))
              (local.set $col_x (i32.const 0))
              (local.set $col_idx (i32.const 0))
              (block $row_cols_done (loop $row_cols
                (br_if $row_cols_done (i32.or
                  (i32.ge_u (local.get $col_idx) (local.get $col_count))
                  (i32.ge_s (local.get $col_x) (local.get $content_right))))
                (local.set $width (i32.const 120))
                (if (i32.gt_s (call $lv_col_count (local.get $sw)) (i32.const 0))
                  (then
                    (local.set $widths_w (call $g2w (call $lv_col_widths_ptr (local.get $sw))))
                    (local.set $width (i32.load (i32.add (local.get $widths_w) (i32.mul (local.get $col_idx) (i32.const 4)))))))
                (if (i32.le_s (local.get $width) (i32.const 0))
                  (then (local.set $width (i32.const 80))))
                (local.set $cell_g (i32.load (call $lv_cell_addr (local.get $sw) (local.get $row) (local.get $col_idx))))
                (if (local.get $cell_g)
                  (then
                    (local.set $cell_w (call $g2w (local.get $cell_g)))
                    (local.set $text_len (call $strlen (local.get $cell_w)))
                    ;; Column 0 carries the check box (LVSIL_STATE) and then the
                    ;; small icon, each claiming 17px, and the text starts after
                    ;; whichever of them are present.
                    (local.set $indent (i32.const 4))
                    ;; A row with a state-image index gets a check box, which is
                    ;; what that index selects out of an LVSIL_STATE list. The
                    ;; list itself is not consulted: sndvol32 hands us a NULL
                    ;; one and then sets indices anyway, and the images every
                    ;; caller means are comctl32's own two check boxes.
                    (if (i32.and (i32.eqz (local.get $col_idx))
                          (i32.ne (i32.and
                                    (i32.load (call $lv_item_state_addr (local.get $sw) (local.get $row)))
                                    (i32.const 0xF000))
                                  (i32.const 0)))
                      (then
                        (call $paint_check_box (local.get $hdc)
                          (i32.add (local.get $col_x) (i32.const 3))
                          (i32.add (local.get $y) (i32.const 1))
                          ;; Index 2 is the checked box, 1 the empty one.
                          (i32.eq (i32.and
                                    (i32.load (call $lv_item_state_addr (local.get $sw) (local.get $row)))
                                    (i32.const 0xF000))
                                  (i32.const 0x2000)))
                        (local.set $indent (i32.add (local.get $indent) (i32.const 17)))))
                    (local.set $icon_x
                      (i32.add (local.get $col_x) (i32.sub (local.get $indent) (i32.const 4))))
                    (if (i32.eqz (local.get $col_idx))
                      (then
                        (if (call $lv_image_list (local.get $sw))
                          (then
                            (if (i32.eqz (call $lv_paint_report_icon
                                  (local.get $hdc) (local.get $sw) (local.get $row)
                                  (local.get $icon_x) (local.get $y)))
                              (then
                                ;; Fallback registry/document glyph: outlined page
                                ;; with the blue Win98 registry mark inside.
                                (drop (call $host_gdi_fill_rect (local.get $hdc)
                                  (i32.add (local.get $icon_x) (i32.const 4)) (i32.add (local.get $y) (i32.const 2))
                                  (i32.add (local.get $icon_x) (i32.const 16)) (i32.add (local.get $y) (i32.const 15))
                                  (i32.const 0x30014)))
                                (drop (call $host_gdi_fill_rect (local.get $hdc)
                                  (i32.add (local.get $icon_x) (i32.const 5)) (i32.add (local.get $y) (i32.const 3))
                                  (i32.add (local.get $icon_x) (i32.const 15)) (i32.add (local.get $y) (i32.const 14))
                                  (i32.const 0x30010)))
                                (drop (call $host_gdi_fill_rect (local.get $hdc)
                                  (i32.add (local.get $icon_x) (i32.const 7)) (i32.add (local.get $y) (i32.const 6))
                                  (i32.add (local.get $icon_x) (i32.const 13)) (i32.add (local.get $y) (i32.const 11))
                                  (local.get $icon_brush)))))
                        (local.set $indent (i32.add (local.get $indent) (i32.const 17)))))))
                    (drop (call $host_gdi_text_out (local.get $hdc)
                      (i32.add (local.get $col_x) (local.get $indent))
                      (i32.add (local.get $y) (i32.const 2))
                      (local.get $cell_w) (local.get $text_len) (i32.const 0)))))
                (local.set $col_x (i32.add (local.get $col_x) (local.get $width)))
                (local.set $col_idx (i32.add (local.get $col_idx) (i32.const 1)))
                (br $row_cols)))
              (drop (call $host_gdi_set_text_color (local.get $hdc) (i32.const 0x00000000)))
              (drop (call $host_gdi_set_bk_color (local.get $hdc) (i32.const 0x00FFFFFF)))
              (drop (call $host_gdi_set_bk_mode (local.get $hdc) (i32.const 1)))))
          (local.set $draw_row (i32.add (local.get $draw_row) (i32.const 1)))
          (br $rows)))
        (if (local.get $icon_brush)
          (then (drop (call $host_gdi_delete_object (local.get $icon_brush)))))

        (if (i32.gt_s (local.get $max) (i32.const 0))
          (then
            (local.set $pressed_part
              (select (global.get $sb_pressed_part) (i32.const 0)
                      (i32.eq (global.get $sb_pressed_hwnd) (local.get $hwnd))))
            (call $paint_vscrollbar_rect (local.get $hdc)
              (i32.sub (local.get $w) (i32.const 16)) (i32.const 0)
              (i32.const 16) (local.get $h)
              (local.get $top) (local.get $max) (local.get $pressed_part)
              (call $scroll_arrow_mask (local.get $hwnd) (i32.const 1)))))
        (if (i32.and (call $ctrl_get_ex_style (local.get $hwnd)) (i32.const 0x200))
          (then
            (drop (call $host_gdi_draw_edge (local.get $hdc)
                    (i32.const 0) (i32.const 0)
                    (local.get $w) (local.get $h)
                    (i32.const 0x0A) (i32.const 0x0F)))))
        (return (i32.const 0))))

    (i32.const 0))

  ;; ---- Toolbar WndProc ----
  ;;
  ;; Minimal ToolbarWindow32 common-control default proc. WordPad subclasses
  ;; this child with MFC's CToolBar proc, then chains TB_* messages to the
  ;; previous wndproc through CallWindowProcA. Returning a real button count and
  ;; button geometry is enough for MFC's WM_SIZEPARENT layout to allocate a
  ;; visible toolbar instead of collapsing it to its border height.
  ;;
  ;; ToolbarState (80 bytes):
  ;; +0 button_count, +4 button_w, +8 button_h, +12 bitmap_w, +16 bitmap_h,
  ;; +20 rows, +24 tbutton_struct_size, +28 bitmap_count,
  ;; +32 buttons_guest (20-byte TBBUTTON snapshots), +36 capacity,
  ;; +40 pressed_index, +44 hwnd, +48 bitmap_handle,
  ;; +52 image_list, +56 hot_image_list, +60 disabled_image_list,
  ;; +64 style, +68 extended_style, +72 padding packed, +76 hot_index.

  (func $toolbar_ensure_state (param $hwnd i32) (result i32)
    (local $state i32) (local $sw ptr<ToolbarState>) (local $created i32)
    (local.set $state (call $wnd_get_state_ptr (local.get $hwnd)))
    (if (i32.eqz (local.get $state))
      (then
        (local.set $state (call $heap_alloc (i32.const 80)))
        (local.set $created (i32.const 1))))
    (local.set $sw (cast ptr<ToolbarState> (call $g2w (local.get $state))))
    (if (local.get $created)
      (then
        (call $zero_memory (local.get $sw) (i32.const 80))
        (store.field.memarg ToolbarState button_w (local.get $sw) (i32.const 23)) ;; default dxButton
        (store.field.memarg ToolbarState button_h (local.get $sw) (i32.const 22)) ;; default dyButton
        (store.field.memarg ToolbarState bitmap_w (local.get $sw) (i32.const 16)) ;; default dxBitmap
        (store.field.memarg ToolbarState bitmap_h (local.get $sw) (i32.const 15)) ;; default dyBitmap
        (store.field.memarg ToolbarState rows (local.get $sw) (i32.const 1))  ;; one row
        (store.field.memarg ToolbarState tbutton_struct_size (local.get $sw) (i32.const 20)) ;; sizeof(TBBUTTON)
        (store.field.memarg ToolbarState pressed_index (local.get $sw) (i32.const -1))
        (store.field.memarg ToolbarState hot_index (local.get $sw) (i32.const -1))
        (call $wnd_set_state_ptr (local.get $hwnd) (local.get $state))))
    (store.field.memarg ToolbarState hwnd (local.get $sw) (local.get $hwnd))
    (local.get $state))

  (func $toolbar_button_ptr (param $sw ptr<ToolbarState>) (param $idx i32) (result i32)
    (i32.add
      (call $g2w (load.field.memarg ToolbarState buttons_guest (local.get $sw)))
      (i32.mul (local.get $idx) (i32.const 20))))

  (func $toolbar_memmove_right (param $src i32) (param $n i32) (param $shift i32)
    ;; Move n bytes from src to src+shift. The hand loop copied backward for
    ;; overlap safety, which is memmove — memory.copy is specified as memmove,
    ;; so it replaces the loop exactly, shift>0 or not.
    (if (i32.or (i32.eqz (local.get $n)) (i32.eqz (local.get $shift)))
      (then (return)))
    (memory.copy
      (i32.add (local.get $src) (local.get $shift))
      (local.get $src)
      (local.get $n)))

  (func $toolbar_child_combo_raw_width_by_cmd
    (param $toolbar_hwnd i32) (param $cmd i32) (result i32)
    (local $slot i32) (local $ch i32) (local $wh i32)
    (local.set $slot (i32.const 0))
    (block $done (loop $scan
      (local.set $slot (call $wnd_next_child_slot (local.get $toolbar_hwnd) (local.get $slot)))
      (br_if $done (i32.lt_s (local.get $slot) (i32.const 0)))
      (local.set $ch (call $wnd_slot_hwnd (local.get $slot)))
      (if (i32.and
            (i32.eq (call $ctrl_table_get_class (local.get $ch)) (i32.const 5))
            (i32.eq (call $ctrl_table_get_id (local.get $ch)) (local.get $cmd)))
        (then
          (local.set $wh (call $ctrl_get_wh_packed (local.get $ch)))
          (return (i32.and (local.get $wh) (i32.const 0xFFFF)))))
      (local.set $slot (i32.add (local.get $slot) (i32.const 1)))
      (br $scan)))
    (i32.const 0))

  ;; Shared item sizing. Negotiation must use raw sibling widths, so the
  ;; caller explicitly chooses whether embedded combo widths are constrained.
  (func $toolbar_button_width_core (param $sw ptr<ToolbarState>) (param $idx i32)
    (param $constrain i32) (result i32)
    (local $count i32) (local $rec i32) (local $width i32) (local $combo_width i32)
    (local.set $width (load.field.memarg ToolbarState button_w (local.get $sw)))
    (if (i32.le_s (local.get $width) (i32.const 0))
      (then (local.set $width (i32.const 23))))
    (local.set $count (load.field ToolbarState button_count (local.get $sw)))
    (if (i32.or
          (i32.eqz (load.field.memarg ToolbarState buttons_guest (local.get $sw)))
          (i32.ge_u (local.get $idx) (local.get $count)))
      (then (return (local.get $width))))
    (local.set $rec (call $toolbar_button_ptr (local.get $sw) (local.get $idx)))
    ;; TBSTYLE_SEP uses iBitmap as its width unless a matching embedded combo
    ;; supplies the width. Both modes share the same fallback bounds.
    (if (i32.and (i32.load8_u offset=9 (local.get $rec)) (i32.const 0x01))
      (then
        (local.set $combo_width
          (if (result i32) (local.get $constrain)
            (then (call $toolbar_child_combo_width_by_cmd
              (local.get $sw) (i32.load offset=4 (local.get $rec))))
            (else (call $toolbar_child_combo_raw_width_by_cmd
              (load.field.memarg ToolbarState hwnd (local.get $sw))
              (i32.load offset=4 (local.get $rec))))))
        (if (i32.gt_s (local.get $combo_width) (i32.const 0))
          (then (return (local.get $combo_width))))
        (local.set $width (i32.load (local.get $rec)))
        (if (i32.or
              (i32.lt_s (local.get $width) (i32.const 4))
              (i32.gt_s (local.get $width) (i32.const 512)))
          (then (local.set $width (i32.const 8))))))
    (local.get $width))

  ;; Unconstrained sizing breaks the large-combo negotiation's recursion.
  (func $toolbar_button_raw_width (param $sw ptr<ToolbarState>) (param $idx i32) (result i32)
    (call $toolbar_button_width_core (local.get $sw) (local.get $idx) (i32.const 0)))

  (func $toolbar_child_combo_width_by_cmd (param $sw ptr<ToolbarState>) (param $cmd i32) (result i32)
    (local $toolbar_hwnd i32) (local $combo_width i32)
    (local $parent i32) (local $parent_w i32) (local $cap i32)
    (local $i i32) (local $count i32) (local $rec i32) (local $fixed_width i32)
    (local.set $toolbar_hwnd (load.field.memarg ToolbarState hwnd (local.get $sw)))
    (if (i32.eqz (local.get $toolbar_hwnd)) (then (return (i32.const 0))))
    (local.set $combo_width
      (call $toolbar_child_combo_raw_width_by_cmd
        (local.get $toolbar_hwnd) (local.get $cmd)))
    ;; Some MFC toolbars create a wide combo before the containing control bar
    ;; receives its final narrow width. Native common controls negotiate the
    ;; embedded item against its sibling TBBUTTON widths. Do the same for large
    ;; toolbar-hosted combos, leaving small combos and wide windows unchanged.
    (if (i32.gt_s (local.get $combo_width) (i32.const 160))
      (then
        (local.set $parent (call $wnd_get_parent (local.get $toolbar_hwnd)))
        (if (local.get $parent)
          (then
            (local.set $parent_w (call $wnd_client_w_for_clip (local.get $parent)))))
        (if (i32.gt_s (local.get $parent_w) (i32.const 0))
          (then
            ;; Layout starts at x=2. Sum every raw sibling width, skipping only
            ;; this combo's separator slot, so the last button remains in bounds.
            (local.set $fixed_width (i32.const 2))
            (local.set $count (load.field ToolbarState button_count (local.get $sw)))
            (local.set $i (i32.const 0))
            (block $widths_done (loop $widths
              (br_if $widths_done (i32.ge_u (local.get $i) (local.get $count)))
              (local.set $rec (call $toolbar_button_ptr (local.get $sw) (local.get $i)))
              (if (i32.eqz
                    (i32.and
                      (i32.and (i32.load8_u offset=9 (local.get $rec)) (i32.const 0x01))
                      (i32.eq (i32.load offset=4 (local.get $rec)) (local.get $cmd))))
                (then
                  (local.set $fixed_width
                    (i32.add
                      (local.get $fixed_width)
                      (call $toolbar_button_raw_width (local.get $sw) (local.get $i))))))
              (local.set $i (i32.add (local.get $i) (i32.const 1)))
              (br $widths)))
            (local.set $cap (i32.sub (local.get $parent_w) (local.get $fixed_width)))
            (if (i32.lt_s (local.get $cap) (i32.const 80))
              (then (local.set $cap (i32.const 80))))
            (if (i32.gt_s (local.get $combo_width) (local.get $cap))
              (then (local.set $combo_width (local.get $cap))))))))
    (local.get $combo_width))

  (func $toolbar_ensure_capacity (param $sw ptr<ToolbarState>) (param $want i32) (result i32)
    (local $cap i32) (local $new_cap i32) (local $new_items i32)
    (local.set $cap (load.field.memarg ToolbarState capacity (local.get $sw)))
    (if (i32.le_u (local.get $want) (local.get $cap))
      (then (return (i32.const 1))))
    (local.set $new_cap (local.get $cap))
    (if (i32.eqz (local.get $new_cap))
      (then (local.set $new_cap (i32.const 8))))
    (block $done (loop $grow
      (br_if $done (i32.ge_u (local.get $new_cap) (local.get $want)))
      (local.set $new_cap (i32.mul (local.get $new_cap) (i32.const 2)))
      (br $grow)))
    (local.set $new_items
      (call $heap_realloc
        (load.field.memarg ToolbarState buttons_guest (local.get $sw))
        (i32.mul (local.get $new_cap) (i32.const 20))
        (i32.const 0x40)))
    (if (i32.eqz (local.get $new_items))
      (then (return (i32.const 0))))
    (store.field.memarg ToolbarState buttons_guest (local.get $sw) (local.get $new_items))
    (store.field.memarg ToolbarState capacity (local.get $sw) (local.get $new_cap))
    (i32.const 1))

  (func $toolbar_init_button (param $dst i32) (param $idx i32)
    (call $zero_memory (local.get $dst) (i32.const 20))
    (i32.store        (local.get $dst) (local.get $idx)) ;; iBitmap fallback
    (i32.store8 offset=8 (local.get $dst) (i32.const 4)) ;; TBSTATE_ENABLED
    (i32.store8 offset=9 (local.get $dst) (i32.const 0))) ;; TBSTYLE_BUTTON

  (func $toolbar_copy_button_in
    (param $dst i32) (param $src_guest i32) (param $src_size i32) (param $idx i32)
    (local $src i32) (local $copy i32)
    (call $toolbar_init_button (local.get $dst) (local.get $idx))
    (if (i32.eqz (local.get $src_guest)) (then (return)))
    (local.set $copy (local.get $src_size))
    (if (i32.gt_u (local.get $copy) (i32.const 20))
      (then (local.set $copy (i32.const 20))))
    (if (i32.eqz (local.get $copy)) (then (return)))
    (local.set $src (call $g2w (local.get $src_guest)))
    (call $memcpy (local.get $dst) (local.get $src) (local.get $copy)))

  (func $toolbar_find_command_index (param $sw ptr<ToolbarState>) (param $cmd i32) (result i32)
    (local $i i32) (local $count i32) (local $rec i32)
    (if (i32.eqz (load.field.memarg ToolbarState buttons_guest (local.get $sw)))
      (then (return (i32.const -1))))
    (local.set $count (load.field ToolbarState button_count (local.get $sw)))
    (local.set $i (i32.const 0))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (local.get $count)))
      (local.set $rec (call $toolbar_button_ptr (local.get $sw) (local.get $i)))
      (if (i32.eq (i32.load offset=4 (local.get $rec)) (local.get $cmd))
        (then (return (local.get $i))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (i32.const -1))

  (func $toolbar_button_width (param $sw ptr<ToolbarState>) (param $idx i32) (result i32)
    (call $toolbar_button_width_core (local.get $sw) (local.get $idx) (i32.const 1)))

  (func $toolbar_layout_width (param $sw ptr<ToolbarState>) (result i32)
    (local $hwnd i32) (local $parent i32) (local $wh i32) (local $w i32) (local $parent_w i32)
    (local.set $hwnd (load.field.memarg ToolbarState hwnd (local.get $sw)))
    (if (local.get $hwnd)
      (then
        (local.set $wh (call $ctrl_get_wh_packed (local.get $hwnd)))
        (local.set $w (i32.and (local.get $wh) (i32.const 0xFFFF)))
        (local.set $parent (call $wnd_get_parent (local.get $hwnd)))
        (if (local.get $parent)
          (then
            (local.set $parent_w (call $wnd_client_w_for_clip (local.get $parent)))))
        (if (i32.gt_s (local.get $parent_w) (i32.const 0))
          (then
            (if (i32.or
                  (i32.le_s (local.get $w) (i32.const 0))
                  (i32.gt_s (local.get $w) (i32.add (local.get $parent_w) (i32.const 8))))
              (then (local.set $w (local.get $parent_w))))))))
    (if (i32.le_s (local.get $w) (i32.const 0))
      (then (local.set $w (i32.const 160))))
    (local.get $w))

  (func $toolbar_button_rect (param $sw ptr<ToolbarState>) (param $idx i32) (param $rect i32) (result i32)
    (local $i i32) (local $count i32) (local $left i32) (local $top i32)
    (local $bw i32) (local $bh i32) (local $limit i32)
    (local.set $count (load.field ToolbarState button_count (local.get $sw)))
    (if (i32.or
          (i32.eqz (local.get $rect))
          (i32.ge_u (local.get $idx) (local.get $count)))
      (then (return (i32.const 0))))
    (local.set $bh (load.field.memarg ToolbarState button_h (local.get $sw)))
    (if (i32.le_s (local.get $bh) (i32.const 0))
      (then (local.set $bh (i32.const 22))))
    (local.set $limit (call $toolbar_layout_width (local.get $sw)))
    (if (i32.lt_s (local.get $limit) (i32.const 24))
      (then (local.set $limit (i32.const 24))))
    (local.set $left (i32.const 2))
    (local.set $top (i32.const 2))
    (local.set $i (i32.const 0))
    (block $done (loop $sum
      (br_if $done (i32.ge_u (local.get $i) (local.get $count)))
      (local.set $bw (call $toolbar_button_width (local.get $sw) (local.get $i)))
      (if (i32.and
            (i32.gt_s (local.get $left) (i32.const 2))
            (i32.gt_s (i32.add (local.get $left) (local.get $bw)) (local.get $limit)))
        (then
          (local.set $left (i32.const 2))
          (local.set $top (i32.add (local.get $top) (i32.add (local.get $bh) (i32.const 2))))))
      (if (i32.eq (local.get $i) (local.get $idx))
        (then
          (i32.store        (local.get $rect) (local.get $left))
          (i32.store offset=4  (local.get $rect) (local.get $top))
          (i32.store offset=8  (local.get $rect) (i32.add (local.get $left) (local.get $bw)))
          (i32.store offset=12 (local.get $rect) (i32.add (local.get $top) (local.get $bh)))
          (return (i32.const 1))))
      (local.set $left (i32.add (local.get $left) (local.get $bw)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $sum)))
    (i32.const 0))

  (func $toolbar_calc_rows (param $sw ptr<ToolbarState>) (result i32)
    (local $i i32) (local $count i32) (local $left i32) (local $bw i32)
    (local $limit i32) (local $rows i32)
    (local.set $count (load.field ToolbarState button_count (local.get $sw)))
    (local.set $limit (call $toolbar_layout_width (local.get $sw)))
    (if (i32.lt_s (local.get $limit) (i32.const 24))
      (then (local.set $limit (i32.const 24))))
    (local.set $left (i32.const 2))
    (local.set $rows (i32.const 1))
    (local.set $i (i32.const 0))
    (block $done (loop $sum
      (br_if $done (i32.ge_u (local.get $i) (local.get $count)))
      (local.set $bw (call $toolbar_button_width (local.get $sw) (local.get $i)))
      (if (i32.and
            (i32.gt_s (local.get $left) (i32.const 2))
            (i32.gt_s (i32.add (local.get $left) (local.get $bw)) (local.get $limit)))
        (then
          (local.set $left (i32.const 2))
          (local.set $rows (i32.add (local.get $rows) (i32.const 1)))))
      (local.set $left (i32.add (local.get $left) (local.get $bw)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $sum)))
    (local.get $rows))

  ;; Re-lay-out a combobox's own children after the control itself is resized.
  ;; MFC creates a toolbar combo at its template width -- WordPad's is 288 --
  ;; and the toolbar then moves it to the button rect, 110 wide. Nothing
  ;; resized the inner edit and listbox, so a 268-wide edit stayed sitting
  ;; across the 110-wide control: it covered the drop arrow (which is why the
  ;; box appeared to have none) and it swallowed clicks meant for the field.
  ;; The geometry is the same arithmetic WM_CREATE uses.
  ;; How much of a combobox's window rect may claim a click.
  ;;
  ;; Our combobox is created at its full dropped height -- WordPad's font box is
  ;; 110x200 -- with the list as an inner child that is shown and hidden. So its
  ;; window rect covers a large part of the frame even while the list is closed,
  ;; and anything that hit-tests by window rect swallows clicks belonging to
  ;; whatever is drawn over that area. A menu popup is drawn over exactly that
  ;; area: WordPad's File menu drops at 7,40 180x284 and the font combo occupies
  ;; 6,74 110x200 underneath it, so making comboboxes hit-testable outside
  ;; dialogs stopped every menu item from responding. Closed, a combobox owns
  ;; its field and nothing more.
  (func $combobox_hit_h (param $hwnd i32) (param $full_h i32) (result i32)
    (local $state_g i32) (local $state_w ptr<ComboBoxState>)
    (if (i32.eq (global.get $combo_open_hwnd) (local.get $hwnd))
      (then (return (local.get $full_h))))
    (local.set $state_g (call $wnd_get_state_ptr (local.get $hwnd)))
    (if (local.get $state_g)
      (then
        (local.set $state_w (cast ptr<ComboBoxState> (call $g2w (local.get $state_g))))
        (if (load.field.memarg ComboBoxState variant (local.get $state_w))
          (then (return (local.get $full_h))))))
    (if (i32.gt_s (local.get $full_h) (i32.const 21))
      (then (return (i32.const 21))))
    (local.get $full_h))

  (func $combobox_relayout_children (param $hwnd i32)
    (local $state_g i32) (local $state_w i32) (local $w i32) (local $h i32)
    (local $field_h i32) (local $edit i32) (local $lb i32)
    (local.set $state_g (call $wnd_get_state_ptr (local.get $hwnd)))
    (if (i32.eqz (local.get $state_g)) (then (return)))
    (local.set $state_w (call $g2w (local.get $state_g)))
    (local.set $field_h (i32.const 21))
    (local.set $w (i32.and (call $ctrl_get_wh_packed (local.get $hwnd)) (i32.const 0xFFFF)))
    (local.set $h (i32.shr_u (call $ctrl_get_wh_packed (local.get $hwnd)) (i32.const 16)))
    (if (i32.le_s (local.get $w) (i32.const 24)) (then (return)))
    (local.set $edit (load.field.memarg ComboBoxState edit_hwnd (local.get $state_w)))
    (if (local.get $edit)
      (then
        (call $host_move_window (local.get $edit) (i32.const 2) (i32.const 2)
          (i32.sub (local.get $w) (i32.const 20))
          (i32.sub (local.get $field_h) (i32.const 4)) (i32.const 0))
        (call $ctrl_geom_sync (local.get $edit) (i32.const 2) (i32.const 2)
          (i32.sub (local.get $w) (i32.const 20))
          (i32.sub (local.get $field_h) (i32.const 4)) (i32.const 0))))
    (local.set $lb (load.field.memarg ComboBoxState lb_hwnd (local.get $state_w)))
    (if (local.get $lb)
      (then
        (local.set $h (i32.sub (local.get $h) (local.get $field_h)))
        (if (i32.lt_s (local.get $h) (i32.const 32)) (then (local.set $h (i32.const 64))))
        (call $host_move_window (local.get $lb) (i32.const 0) (local.get $field_h)
          (local.get $w) (local.get $h) (i32.const 0))
        (call $ctrl_geom_sync (local.get $lb) (i32.const 0) (local.get $field_h)
          (local.get $w) (local.get $h) (i32.const 0))))
    ;; The field was painted at the old width -- the drop arrow sits at
    ;; w - 18, so a resize leaves it drawn off in the wrong place, or off the
    ;; control entirely. Ask for a repaint at the new size.
    (call $paint_flag_set_inv (local.get $hwnd))
    (if (local.get $edit) (then (call $paint_flag_set_inv (local.get $edit)))))

  (func $toolbar_sync_child_combos (param $sw ptr<ToolbarState>)
    (local $toolbar_hwnd i32) (local $slot i32) (local $ch i32) (local $child_id i32)
    (local $i i32) (local $count i32) (local $rec i32)
    (local $left i32) (local $top i32) (local $right i32) (local $brect i32)
    (local.set $toolbar_hwnd (load.field.memarg ToolbarState hwnd (local.get $sw)))
    (if (i32.eqz (local.get $toolbar_hwnd)) (then (return)))
    (if (i32.eqz (load.field.memarg ToolbarState buttons_guest (local.get $sw))) (then (return)))
    (local.set $count (load.field ToolbarState button_count (local.get $sw)))
    (local.set $slot (i32.const 0))
    (block $children_done (loop $children
      (local.set $slot
        (call $wnd_next_child_slot (local.get $toolbar_hwnd) (local.get $slot)))
      (br_if $children_done (i32.lt_s (local.get $slot) (i32.const 0)))
      (local.set $ch (call $wnd_slot_hwnd (local.get $slot)))
      (if (i32.eq (call $ctrl_table_get_class (local.get $ch)) (i32.const 5))
        (then
          (local.set $child_id (call $ctrl_table_get_id (local.get $ch)))
          (local.set $i (i32.const 0))
          (block $matched (loop $buttons
            (br_if $matched (i32.ge_u (local.get $i) (local.get $count)))
            (local.set $rec (call $toolbar_button_ptr (local.get $sw) (local.get $i)))
            (local.set $brect (call $paint_scratch_take))
            (if (i32.and
                  (i32.and
                    (i32.and (i32.load8_u offset=9 (local.get $rec)) (i32.const 0x01))
                    (i32.eq (i32.load offset=4 (local.get $rec)) (local.get $child_id)))
                  (call $toolbar_button_rect (local.get $sw) (local.get $i) (local.get $brect)))
              (then
                (local.set $left (load.field PaintRect left (local.get $brect)))
                (local.set $top (load.field.memarg PaintRect top (local.get $brect)))
                (local.set $right (load.field.memarg PaintRect right (local.get $brect)))
                (call $host_move_window
                  (local.get $ch)
                  (local.get $left)
                  (local.get $top)
                  (i32.sub (local.get $right) (local.get $left))
                  (i32.const 200)
                  (i32.const 0))
                (call $ctrl_geom_sync
                  (local.get $ch)
                  (local.get $left)
                  (local.get $top)
                  (i32.sub (local.get $right) (local.get $left))
                  (i32.const 200)
                  (i32.const 0))
                (call $defwndproc_do_nccalcsize (local.get $ch))
                (call $combobox_relayout_children (local.get $ch))
                (br $matched)))
            (local.set $i (i32.add (local.get $i) (i32.const 1)))
            (br $buttons)))))
      (local.set $slot (i32.add (local.get $slot) (i32.const 1)))
      (br $children))))

  (func $toolbar_update_state_bit
    (param $sw i32) (param $cmd i32) (param $mask i32) (param $on i32) (result i32)
    (local $idx i32) (local $rec i32) (local $state i32)
    (local.set $idx (call $toolbar_find_command_index (local.get $sw) (local.get $cmd)))
    (if (i32.lt_s (local.get $idx) (i32.const 0))
      (then (return (i32.const 0))))
    (local.set $rec (call $toolbar_button_ptr (local.get $sw) (local.get $idx)))
    (local.set $state (i32.load8_u offset=8 (local.get $rec)))
    (if (i32.and (local.get $on) (i32.const 0xFFFF))
      (then
        (local.set $state (i32.or (local.get $state) (local.get $mask))))
      (else
        (local.set $state
          (i32.and (local.get $state) (i32.xor (local.get $mask) (i32.const -1))))))
    (i32.store8 offset=8 (local.get $rec) (local.get $state))
    (i32.const 1))

  (func $toolbar_hit_test (param $sw ptr<ToolbarState>) (param $x i32) (param $y i32) (result i32)
    (local $idx i32) (local $left i32) (local $top i32) (local $right i32) (local $bottom i32)
    (local $rec i32) (local $brect i32)
    (if (i32.or (i32.lt_s (local.get $x) (i32.const 2))
                (i32.lt_s (local.get $y) (i32.const 2)))
      (then (return (i32.const -1))))
    (local.set $idx (i32.const 0))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $idx) (load.field ToolbarState button_count (local.get $sw))))
      (local.set $brect (call $paint_scratch_take))
      (if (i32.eqz (call $toolbar_button_rect (local.get $sw) (local.get $idx) (local.get $brect)))
        (then (return (i32.const -1))))
      (local.set $left (load.field PaintRect left (local.get $brect)))
      (local.set $top (load.field.memarg PaintRect top (local.get $brect)))
      (local.set $right (load.field.memarg PaintRect right (local.get $brect)))
      (local.set $bottom (load.field.memarg PaintRect bottom (local.get $brect)))
      (if (i32.and
            (i32.and
              (i32.ge_s (local.get $x) (local.get $left))
              (i32.lt_s (local.get $x) (local.get $right)))
            (i32.and
              (i32.ge_s (local.get $y) (local.get $top))
              (i32.lt_s (local.get $y) (local.get $bottom))))
        (then
          (if (load.field.memarg ToolbarState buttons_guest (local.get $sw))
            (then
              (local.set $rec (call $toolbar_button_ptr (local.get $sw) (local.get $idx)))
              (if (i32.or
                    (i32.and (i32.load8_u offset=8 (local.get $rec)) (i32.const 0x08))
                    (i32.and (i32.load8_u offset=9 (local.get $rec)) (i32.const 0x01)))
                (then (return (i32.const -1))))))
          (return (local.get $idx))))
      (local.set $idx (i32.add (local.get $idx) (i32.const 1)))
      (br $scan)))
    (i32.const -1))

  ;; Image-list handles in this runtime are guest pointers to the bounded
  ;; 24-byte ImageList record created by ImageList_Create/LoadImage. Toolbar
  ;; messages are also used by probes that pass opaque sentinel handles, so
  ;; validate both the translated address and record geometry before painting.
  (func $toolbar_imagelist_ptr (param $himl i32) (result i32)
    (local $wa i32) (local $cx i32) (local $cy i32)
    (if (i32.eqz (local.get $himl)) (then (return (i32.const 0))))
    (if (i32.lt_u (local.get $himl) (global.get $image_base))
      (then (return (i32.const 0))))
    (local.set $wa (call $g2w (local.get $himl)))
    (if (i32.gt_u
          (local.get $wa)
          (i32.sub (i32.shl (memory.size) (i32.const 16)) (i32.const 24)))
      (then (return (i32.const 0))))
    (local.set $cx (i32.load (local.get $wa)))
    (local.set $cy (i32.load offset=4 (local.get $wa)))
    (if (i32.or
          (i32.or (i32.le_s (local.get $cx) (i32.const 0))
                  (i32.gt_s (local.get $cx) (i32.const 256)))
          (i32.or (i32.le_s (local.get $cy) (i32.const 0))
                  (i32.gt_s (local.get $cy) (i32.const 256))))
      (then (return (i32.const 0))))
    (local.get $wa))

  (func $toolbar_repaint_now (param $hwnd i32)
    ;; Queue the common-control repaint through USER instead of drawing it
    ;; synchronously during layout. A direct child draw can be overwritten by
    ;; a still-dirty application-owned control-bar ancestor; the paint pump
    ;; orders that ancestor first and then drains this native child.
    (call $paint_flag_set_inv (local.get $hwnd)))

  (func $toolbar_autosize (param $hwnd i32)
    (local $idx i32) (local $state i32) (local $sw ptr<ToolbarState>) (local $parent i32)
    (local $xy i32) (local $wh i32) (local $x i32) (local $y i32)
    (local $w i32) (local $h i32) (local $parent_w i32) (local $rows i32) (local $bh i32)
    (local.set $idx (call $wnd_table_find (local.get $hwnd)))
    (if (i32.eq (local.get $idx) (i32.const -1)) (then (return)))
    (local.set $state (call $toolbar_ensure_state (local.get $hwnd)))
    (local.set $sw (cast ptr<ToolbarState> (call $g2w (local.get $state))))
    (local.set $xy (call $ctrl_get_xy_packed (local.get $hwnd)))
    (local.set $wh (call $ctrl_get_wh_packed (local.get $hwnd)))
    (local.set $x (i32.shr_s (i32.shl (local.get $xy) (i32.const 16)) (i32.const 16)))
    (local.set $y (i32.shr_s (local.get $xy) (i32.const 16)))
    (local.set $w (i32.and (local.get $wh) (i32.const 0xFFFF)))
    (local.set $h (i32.shr_u (local.get $wh) (i32.const 16)))
    (if (i32.le_s (local.get $w) (i32.const 0))
      (then
        (local.set $parent (call $wnd_get_parent (local.get $hwnd)))
        (if (local.get $parent)
          (then (local.set $w (call $wnd_client_w_for_clip (local.get $parent)))))))
    (if (i32.le_s (local.get $w) (i32.const 0)) (then (local.set $w (i32.const 160))))
    ;; MFC control bars can cache the toolbar's ideal button span, then move
    ;; the child with SWP_NOSIZE. Keep the real child surface bounded by the
    ;; containing bar so oversized formatting toolbars do not allocate/dump as
    ;; multi-screen-wide children while still letting button positions extend
    ;; within the clipped parent.
    (local.set $parent (call $wnd_get_parent (local.get $hwnd)))
    (if (local.get $parent)
      (then
        (local.set $parent_w (call $wnd_client_w_for_clip (local.get $parent)))
        (if (i32.and
              (i32.gt_s (local.get $parent_w) (i32.const 0))
              (i32.gt_s (local.get $w) (i32.add (local.get $parent_w) (i32.const 8))))
          (then (local.set $w (local.get $parent_w))))))
    (local.set $rows (call $toolbar_calc_rows (local.get $sw)))
    (if (i32.lt_s (local.get $rows) (i32.const 1))
      (then (local.set $rows (i32.const 1))))
    (store.field.memarg ToolbarState rows (local.get $sw) (local.get $rows))
    (local.set $bh (load.field.memarg ToolbarState button_h (local.get $sw)))
    (if (i32.le_s (local.get $bh) (i32.const 0))
      (then (local.set $bh (i32.const 22))))
    (local.set $h
      (i32.add
        (i32.add
          (i32.mul (local.get $rows) (local.get $bh))
          (i32.mul (i32.sub (local.get $rows) (i32.const 1)) (i32.const 2)))
        (i32.const 6)))
    (if (i32.lt_s (local.get $h) (i32.const 24)) (then (local.set $h (i32.const 24))))
    (call $host_move_window (local.get $hwnd) (local.get $x) (local.get $y) (local.get $w) (local.get $h) (i32.const 0))
    (call $ctrl_geom_set (local.get $idx) (local.get $x) (local.get $y) (local.get $w) (local.get $h))
    (call $defwndproc_do_nccalcsize (local.get $hwnd))
    (call $toolbar_sync_child_combos (local.get $sw))
    (call $paint_flag_set_inv (local.get $hwnd))
    (call $toolbar_repaint_now (local.get $hwnd)))

  (func $toolbar_wndproc (param $hwnd i32) (param $msg i32) (param $wParam i32) (param $lParam i32) (result i32)
    (local $state i32) (local $sw ptr<ToolbarState>) (local $hdc i32)
    (local $sz i32) (local $w i32) (local $h i32)
    (local $count i32) (local $i i32) (local $left i32) (local $top i32)
    (local $bw i32) (local $bh i32) (local $old i32) (local $rect i32)
    (local $src i32) (local $dst i32) (local $copy i32) (local $idx i32)
    (local $rec i32) (local $cmd i32) (local $parent i32)
    (local $x i32) (local $y i32) (local $state_byte i32) (local $hit i32)
    (local $bmp i32) (local $bmp_w i32) (local $bmp_h i32)
    (local $bmp_draw_w i32) (local $bmp_draw_h i32) (local $bmp_src_x i32)
    (local $bmp_dst_x i32) (local $bmp_dst_y i32) (local $memdc i32)
    (local $drawn i32) (local $image_list i32) (local $image_sw i32)
    (local $mask_color i32) (local $use_disabled_effect i32) (local $is_hot i32)
    (local $brect i32)

    (local.set $state
      (if (result i32) (i32.eq (local.get $msg) (i32.const 0x0002))
        (then (call $wnd_get_state_ptr (local.get $hwnd)))
        (else (call $toolbar_ensure_state (local.get $hwnd)))))
    (if (local.get $state)
      (then (local.set $sw (cast ptr<ToolbarState> (call $g2w (local.get $state))))))

    ;; WM_DESTROY
    (if (i32.eq (local.get $msg) (i32.const 0x0002))
      (then
        (if (local.get $state)
          (then
            (if (load.field.memarg ToolbarState buttons_guest (local.get $sw))
              (then (call $heap_free (load.field.memarg ToolbarState buttons_guest (local.get $sw)))))
            (call $heap_free (local.get $state))
            (call $wnd_set_state_ptr (local.get $hwnd) (i32.const 0))))
        (return (i32.const 0))))

    ;; WM_CREATE
    (if (i32.eq (local.get $msg) (i32.const 0x0001))
      (then
        (call $toolbar_autosize (local.get $hwnd))
        (return (i32.const 0))))

    ;; WM_ERASEBKGND
    (if (i32.eq (local.get $msg) (i32.const 0x0014))
      (then
        (drop (call $host_erase_background (local.get $hwnd) (i32.const 16)))
        (return (i32.const 1))))

    ;; TB_BUTTONSTRUCTSIZE (WM_USER+30): remember caller's TBBUTTON size.
    (if (i32.eq (local.get $msg) (i32.const 0x041E))
      (then
        (if (local.get $wParam)
          (then (store.field.memarg ToolbarState tbutton_struct_size (local.get $sw) (local.get $wParam))))
        (return (i32.const 1))))

    ;; TB_ADDBITMAP (WM_USER+19): remember the caller's bitmap strip and
    ;; return the first allocated bitmap index.
    (if (i32.eq (local.get $msg) (i32.const 0x0413))
      (then
        (local.set $old (load.field.memarg ToolbarState bitmap_count (local.get $sw)))
        (local.set $bmp (i32.const 0))
        (if (local.get $lParam)
          (then
            (local.set $src (call $g2w (local.get $lParam)))
            (if (i32.eqz (i32.load (local.get $src)))
              (then
                ;; hInst == NULL: nID is already an HBITMAP.
                (local.set $bmp (i32.load offset=4 (local.get $src))))
              (else
                ;; hInst == HINST_COMMCTRL (-1) names a built-in common-control
                ;; strip; other non-NULL hInst values name app/DLL resources.
                (local.set $cmd (i32.load offset=4 (local.get $src)))
                (if (i32.le_u (local.get $cmd) (i32.const 0xFFFF))
                  (then
                    (local.set $cmd (i32.and (local.get $cmd) (i32.const 0xFFFF)))))
                (local.set $bmp
                  (call $host_gdi_load_bitmap
                    (i32.load (local.get $src))
                    (local.get $cmd)))))))
        (if (local.get $bmp)
          (then
            (local.set $bmp_w (call $host_gdi_get_object_w (local.get $bmp)))
            (if (i32.gt_s (local.get $bmp_w) (i32.const 0))
              (then
                ;; Bounded toolbar model: one strip per toolbar. Keep the
                ;; first valid strip so returned iBitmap bases keep indexing
                ;; into the original image list.
                (if (i32.eqz (load.field.memarg ToolbarState bitmap_handle (local.get $sw)))
                  (then (store.field.memarg ToolbarState bitmap_handle (local.get $sw) (local.get $bmp))))))))
        (store.field.memarg ToolbarState bitmap_count (local.get $sw)
          (i32.add (local.get $old) (local.get $wParam)))
        (call $toolbar_repaint_now (local.get $hwnd))
        (return (local.get $old))))

    ;; TB_ADDBUTTONSA / TB_ADDBUTTONSW: TBBUTTON itself contains no encoded
    ;; text, so both messages share the same record-copy path. Media Player 32
    ;; uses the Unicode message even for image-only buttons.
    (if (i32.or
          (i32.eq (local.get $msg) (i32.const 0x0414))
          (i32.eq (local.get $msg) (i32.const 0x0444)))
      (then
        (if (i32.gt_u (local.get $wParam) (i32.const 0))
          (then
            (local.set $count (load.field ToolbarState button_count (local.get $sw)))
            (if (i32.eqz
                  (call $toolbar_ensure_capacity
                    (local.get $sw)
                    (i32.add (local.get $count) (local.get $wParam))))
              (then (return (i32.const 0))))
            (local.set $i (i32.const 0))
            (block $done (loop $copy_buttons
              (br_if $done (i32.ge_u (local.get $i) (local.get $wParam)))
              (local.set $dst
                (call $toolbar_button_ptr
                  (local.get $sw)
                  (i32.add (local.get $count) (local.get $i))))
              (local.set $src (i32.const 0))
              (if (local.get $lParam)
                (then
                  (local.set $src
                    (i32.add
                      (local.get $lParam)
                      (i32.mul (local.get $i) (load.field.memarg ToolbarState tbutton_struct_size (local.get $sw)))))))
              (call $toolbar_copy_button_in
                (local.get $dst)
                (local.get $src)
                (load.field.memarg ToolbarState tbutton_struct_size (local.get $sw))
                (i32.add (local.get $count) (local.get $i)))
              (local.set $i (i32.add (local.get $i) (i32.const 1)))
              (br $copy_buttons)))
            (store.field ToolbarState button_count (local.get $sw)
              (i32.add (local.get $count) (local.get $wParam)))))
        (call $toolbar_autosize (local.get $hwnd))
        (return (i32.const 1))))

    ;; TB_INSERTBUTTONA/W: insert one TBBUTTON at wParam. TBBUTTON itself is
    ;; encoding-neutral; only optional text pointers differ, which this control
    ;; does not dereference while copying the record.
    (if (i32.or
          (i32.eq (local.get $msg) (i32.const 0x0415))
          (i32.eq (local.get $msg) (i32.const 0x0443)))
      (then
        (local.set $count (load.field ToolbarState button_count (local.get $sw)))
        (local.set $idx (local.get $wParam))
        (if (i32.gt_u (local.get $idx) (local.get $count))
          (then (local.set $idx (local.get $count))))
        (if (i32.eqz
              (call $toolbar_ensure_capacity
                (local.get $sw)
                (i32.add (local.get $count) (i32.const 1))))
          (then (return (i32.const 0))))
        (local.set $dst (call $toolbar_button_ptr (local.get $sw) (local.get $idx)))
        (if (i32.lt_u (local.get $idx) (local.get $count))
          (then
            (call $toolbar_memmove_right
              (local.get $dst)
              (i32.mul (i32.sub (local.get $count) (local.get $idx)) (i32.const 20))
              (i32.const 20))))
        (call $toolbar_copy_button_in
          (local.get $dst)
          (local.get $lParam)
          (load.field.memarg ToolbarState tbutton_struct_size (local.get $sw))
          (local.get $idx))
        (store.field ToolbarState button_count (local.get $sw) (i32.add (local.get $count) (i32.const 1)))
        (call $toolbar_autosize (local.get $hwnd))
        (return (i32.const 1))))

    ;; TB_DELETEBUTTON (WM_USER+22): remove button by index.
    (if (i32.eq (local.get $msg) (i32.const 0x0416))
      (then
        (local.set $count (load.field ToolbarState button_count (local.get $sw)))
        (if (i32.ge_u (local.get $wParam) (local.get $count))
          (then (return (i32.const 0))))
        (local.set $dst (call $toolbar_button_ptr (local.get $sw) (local.get $wParam)))
        (if (i32.lt_u (i32.add (local.get $wParam) (i32.const 1)) (local.get $count))
          (then
            (call $memcpy
              (local.get $dst)
              (i32.add (local.get $dst) (i32.const 20))
              (i32.mul
                (i32.sub (i32.sub (local.get $count) (local.get $wParam)) (i32.const 1))
                (i32.const 20)))))
        (store.field ToolbarState button_count (local.get $sw) (i32.sub (local.get $count) (i32.const 1)))
        (if (i32.eq (load.field.memarg ToolbarState pressed_index (local.get $sw)) (local.get $wParam))
          (then (store.field.memarg ToolbarState pressed_index (local.get $sw) (i32.const -1))))
        (call $toolbar_autosize (local.get $hwnd))
        (return (i32.const 1))))

    ;; TB_GETBUTTON (WM_USER+23): copy the stored TBBUTTON by index.
    (if (i32.eq (local.get $msg) (i32.const 0x0417))
      (then
        (if (i32.or
              (i32.eqz (local.get $lParam))
              (i32.ge_u (local.get $wParam) (load.field ToolbarState button_count (local.get $sw))))
          (then (return (i32.const 0))))
        (local.set $rect (call $g2w (local.get $lParam)))
        (local.set $copy (load.field.memarg ToolbarState tbutton_struct_size (local.get $sw)))
        (if (i32.gt_u (local.get $copy) (i32.const 20))
          (then (local.set $copy (i32.const 20))))
        (if (i32.eqz (local.get $copy))
          (then (return (i32.const 0))))
        (if (load.field.memarg ToolbarState buttons_guest (local.get $sw))
          (then
            (call $memcpy
              (local.get $rect)
              (call $toolbar_button_ptr (local.get $sw) (local.get $wParam))
              (local.get $copy)))
          (else
            (call $toolbar_init_button (local.get $rect) (local.get $wParam))))
        (return (i32.const 1))))

    ;; TB_GETRECT (WM_USER+51): command ID -> RECT.
    (if (i32.eq (local.get $msg) (i32.const 0x0433))
      (then
        (if (i32.eqz (local.get $lParam)) (then (return (i32.const 0))))
        (local.set $idx (call $toolbar_find_command_index (local.get $sw) (local.get $wParam)))
        (if (i32.lt_s (local.get $idx) (i32.const 0)) (then (return (i32.const 0))))
        (local.set $rect (call $g2w (local.get $lParam)))
        (return (call $toolbar_button_rect (local.get $sw) (local.get $idx) (local.get $rect)))))

    ;; TB_GETBITMAP / TB_GETBUTTONTEXTA. The bounded toolbar stores command
    ;; records but not string tables, so text lookup is an empty successful
    ;; copy when a buffer is supplied.
    (if (i32.eq (local.get $msg) (i32.const 0x042C))
      (then
        (local.set $idx (call $toolbar_find_command_index (local.get $sw) (local.get $wParam)))
        (if (i32.lt_s (local.get $idx) (i32.const 0)) (then (return (i32.const -1))))
        (local.set $rec (call $toolbar_button_ptr (local.get $sw) (local.get $idx)))
        (return (i32.load (local.get $rec)))))
    (if (i32.eq (local.get $msg) (i32.const 0x042D))
      (then
        (if (local.get $lParam)
          (then (i32.store8 (call $g2w (local.get $lParam)) (i32.const 0))))
        (return (i32.const 0))))

    ;; TB_BUTTONCOUNT (WM_USER+24), TB_GETROWS (WM_USER+40).
    (if (i32.eq (local.get $msg) (i32.const 0x0418))
      (then (return (load.field ToolbarState button_count (local.get $sw)))))
    (if (i32.eq (local.get $msg) (i32.const 0x0428))
      (then (return (load.field.memarg ToolbarState rows (local.get $sw)))))
    ;; TB_COMMANDTOINDEX (WM_USER+25): map command ID to button index.
    (if (i32.eq (local.get $msg) (i32.const 0x0419))
      (then (return (call $toolbar_find_command_index (local.get $sw) (local.get $wParam)))))

    ;; TB_GETITEMRECT (WM_USER+29): lParam -> RECT for button index wParam.
    (if (i32.eq (local.get $msg) (i32.const 0x041D))
      (then
        (if (i32.or
              (i32.eqz (local.get $lParam))
              (i32.ge_u (local.get $wParam) (load.field ToolbarState button_count (local.get $sw))))
          (then (return (i32.const 0))))
        (local.set $rect (call $g2w (local.get $lParam)))
        (local.set $hit (call $toolbar_button_rect
          (local.get $sw)
          (local.get $wParam)
          (local.get $rect)))
        (return (local.get $hit))))

    ;; TB_SETBUTTONSIZE / TB_SETBITMAPSIZE / TB_AUTOSIZE.
    (if (i32.eq (local.get $msg) (i32.const 0x041F))
      (then
        (local.set $bw (i32.and (local.get $lParam) (i32.const 0xFFFF)))
        (local.set $bh (i32.shr_u (local.get $lParam) (i32.const 16)))
        (if (i32.gt_u (local.get $bw) (i32.const 0)) (then (store.field.memarg ToolbarState button_w (local.get $sw) (local.get $bw))))
        (if (i32.gt_u (local.get $bh) (i32.const 0)) (then (store.field.memarg ToolbarState button_h (local.get $sw) (local.get $bh))))
        (call $toolbar_autosize (local.get $hwnd))
        (return (i32.const 1))))
    (if (i32.eq (local.get $msg) (i32.const 0x0420))
      (then
        (local.set $bw (i32.and (local.get $lParam) (i32.const 0xFFFF)))
        (local.set $bh (i32.shr_u (local.get $lParam) (i32.const 16)))
        (if (i32.gt_u (local.get $bw) (i32.const 0)) (then (store.field.memarg ToolbarState bitmap_w (local.get $sw) (local.get $bw))))
        (if (i32.gt_u (local.get $bh) (i32.const 0)) (then (store.field.memarg ToolbarState bitmap_h (local.get $sw) (local.get $bh))))
        (return (i32.const 1))))
    (if (i32.eq (local.get $msg) (i32.const 0x0421))
      (then
        (call $toolbar_autosize (local.get $hwnd))
        (return (i32.const 0))))

    ;; TB_GETBUTTONSIZE (WM_USER+58), TB_SETROWS (WM_USER+39).
    (if (i32.eq (local.get $msg) (i32.const 0x043A))
      (then
        (return
          (i32.or
            (i32.and (load.field.memarg ToolbarState button_w (local.get $sw)) (i32.const 0xFFFF))
            (i32.shl (load.field.memarg ToolbarState button_h (local.get $sw)) (i32.const 16))))))
    (if (i32.eq (local.get $msg) (i32.const 0x0427))
      (then
        (if (i32.gt_u (i32.and (local.get $wParam) (i32.const 0xFFFF)) (i32.const 0))
          (then (store.field.memarg ToolbarState rows (local.get $sw) (i32.and (local.get $wParam) (i32.const 0xFFFF)))))
        (call $toolbar_autosize (local.get $hwnd))
        (return (i32.const 0))))

    ;; TB_SETIMAGELIST / TB_GETIMAGELIST and hot/disabled variants.
    (if (i32.eq (local.get $msg) (i32.const 0x0430))
      (then
        (local.set $old (load.field.memarg ToolbarState image_list (local.get $sw)))
        (store.field.memarg ToolbarState image_list (local.get $sw) (local.get $lParam))
        (call $toolbar_repaint_now (local.get $hwnd))
        (return (local.get $old))))
    (if (i32.eq (local.get $msg) (i32.const 0x0431))
      (then (return (load.field.memarg ToolbarState image_list (local.get $sw)))))
    (if (i32.eq (local.get $msg) (i32.const 0x0434))
      (then
        (local.set $old (load.field.memarg ToolbarState hot_image_list (local.get $sw)))
        (store.field.memarg ToolbarState hot_image_list (local.get $sw) (local.get $lParam))
        (call $toolbar_repaint_now (local.get $hwnd))
        (return (local.get $old))))
    (if (i32.eq (local.get $msg) (i32.const 0x0435))
      (then (return (load.field.memarg ToolbarState hot_image_list (local.get $sw)))))
    (if (i32.eq (local.get $msg) (i32.const 0x0436))
      (then
        (local.set $old (load.field.memarg ToolbarState disabled_image_list (local.get $sw)))
        (store.field.memarg ToolbarState disabled_image_list (local.get $sw) (local.get $lParam))
        (call $toolbar_repaint_now (local.get $hwnd))
        (return (local.get $old))))
    (if (i32.eq (local.get $msg) (i32.const 0x0437))
      (then (return (load.field.memarg ToolbarState disabled_image_list (local.get $sw)))))

    ;; TB_GETHOTITEM / TB_SETHOTITEM. The hot item is an index, not a command
    ;; id. Return the previous index exactly as the common-control contract
    ;; requires and repaint so flat toolbar edges/image lists switch at once.
    (if (i32.eq (local.get $msg) (i32.const 0x0447))
      (then (return (load.field.memarg ToolbarState hot_index (local.get $sw)))))
    (if (i32.eq (local.get $msg) (i32.const 0x0448))
      (then
        (local.set $old (load.field.memarg ToolbarState hot_index (local.get $sw)))
        (local.set $idx (local.get $wParam))
        (if (i32.and
              (i32.ne (local.get $idx) (i32.const -1))
              (i32.ge_u (local.get $idx) (load.field ToolbarState button_count (local.get $sw))))
          (then (local.set $idx (i32.const -1))))
        (store.field.memarg ToolbarState hot_index (local.get $sw) (local.get $idx))
        (if (i32.ne (local.get $idx) (local.get $old))
          (then (call $toolbar_repaint_now (local.get $hwnd))))
        (return (local.get $old))))

    ;; TB_SETSTYLE / TB_GETSTYLE / TB_SETEXTENDEDSTYLE / TB_GETEXTENDEDSTYLE.
    (if (i32.eq (local.get $msg) (i32.const 0x0438))
      (then
        (store.field.memarg ToolbarState style (local.get $sw) (local.get $lParam))
        (call $paint_flag_set_inv (local.get $hwnd))
        (return (i32.const 0))))
    (if (i32.eq (local.get $msg) (i32.const 0x0439))
      (then (return (load.field.memarg ToolbarState style (local.get $sw)))))
    (if (i32.eq (local.get $msg) (i32.const 0x0454))
      (then
        (local.set $old (load.field.memarg ToolbarState extended_style (local.get $sw)))
        (if (local.get $wParam)
          (then
            (store.field.memarg ToolbarState extended_style (local.get $sw)
              (i32.or (i32.and (local.get $old) (i32.xor (local.get $wParam) (i32.const -1)))
                      (i32.and (local.get $lParam) (local.get $wParam)))))
          (else
            (store.field.memarg ToolbarState extended_style (local.get $sw) (local.get $lParam))))
        (return (local.get $old))))
    (if (i32.eq (local.get $msg) (i32.const 0x0455))
      (then (return (load.field.memarg ToolbarState extended_style (local.get $sw)))))

    ;; TB_SETPADDING / TB_GETPADDING.
    (if (i32.eq (local.get $msg) (i32.const 0x0457))
      (then
        (local.set $old (load.field.memarg ToolbarState padding_packed (local.get $sw)))
        (store.field.memarg ToolbarState padding_packed (local.get $sw) (local.get $lParam))
        (return (local.get $old))))
    (if (i32.eq (local.get $msg) (i32.const 0x0456))
      (then (return (load.field.memarg ToolbarState padding_packed (local.get $sw)))))

    ;; Basic state/probe messages by command ID.
    (if (i32.or
          (i32.or (i32.eq (local.get $msg) (i32.const 0x0409)) ;; TB_ISBUTTONENABLED
                  (i32.eq (local.get $msg) (i32.const 0x040A))) ;; TB_ISBUTTONCHECKED
          (i32.or
            (i32.or (i32.eq (local.get $msg) (i32.const 0x040B)) ;; TB_ISBUTTONPRESSED
                    (i32.eq (local.get $msg) (i32.const 0x040C))) ;; TB_ISBUTTONHIDDEN
            (i32.or (i32.eq (local.get $msg) (i32.const 0x040D)) ;; TB_ISBUTTONINDETERMINATE
                    (i32.eq (local.get $msg) (i32.const 0x0412))))) ;; TB_GETSTATE
      (then
        (local.set $idx (call $toolbar_find_command_index (local.get $sw) (local.get $wParam)))
        (if (i32.lt_s (local.get $idx) (i32.const 0))
          (then
            (if (i32.eq (local.get $msg) (i32.const 0x0412))
              (then (return (i32.const -1))))
            (return (i32.const 0))))
        (local.set $rec (call $toolbar_button_ptr (local.get $sw) (local.get $idx)))
        (local.set $state_byte (i32.load8_u offset=8 (local.get $rec)))
        (if (i32.eq (local.get $msg) (i32.const 0x0412))
          (then (return (local.get $state_byte))))
        (if (i32.eq (local.get $msg) (i32.const 0x0409))
          (then (return (select (i32.const 1) (i32.const 0)
            (i32.ne (i32.and (local.get $state_byte) (i32.const 0x04)) (i32.const 0))))))
        (if (i32.eq (local.get $msg) (i32.const 0x040A))
          (then (return (select (i32.const 1) (i32.const 0)
            (i32.ne (i32.and (local.get $state_byte) (i32.const 0x01)) (i32.const 0))))))
        (if (i32.eq (local.get $msg) (i32.const 0x040B))
          (then (return (select (i32.const 1) (i32.const 0)
            (i32.ne (i32.and (local.get $state_byte) (i32.const 0x02)) (i32.const 0))))))
        (if (i32.eq (local.get $msg) (i32.const 0x040C))
          (then (return (select (i32.const 1) (i32.const 0)
            (i32.ne (i32.and (local.get $state_byte) (i32.const 0x08)) (i32.const 0))))))
        (return (select (i32.const 1) (i32.const 0)
          (i32.ne (i32.and (local.get $state_byte) (i32.const 0x10)) (i32.const 0))))))

    ;; TB_ENABLEBUTTON / TB_CHECKBUTTON / TB_PRESSBUTTON /
    ;; TB_HIDEBUTTON / TB_INDETERMINATE.
    (if (i32.or
          (i32.or (i32.eq (local.get $msg) (i32.const 0x0401))
                  (i32.eq (local.get $msg) (i32.const 0x0402)))
          (i32.or
            (i32.or (i32.eq (local.get $msg) (i32.const 0x0403))
                    (i32.eq (local.get $msg) (i32.const 0x0404)))
            (i32.eq (local.get $msg) (i32.const 0x0405))))
      (then
        (local.set $state_byte (i32.const 0x04))
        (if (i32.eq (local.get $msg) (i32.const 0x0402)) (then (local.set $state_byte (i32.const 0x01))))
        (if (i32.eq (local.get $msg) (i32.const 0x0403)) (then (local.set $state_byte (i32.const 0x02))))
        (if (i32.eq (local.get $msg) (i32.const 0x0404)) (then (local.set $state_byte (i32.const 0x08))))
        (if (i32.eq (local.get $msg) (i32.const 0x0405)) (then (local.set $state_byte (i32.const 0x10))))
        (drop (call $toolbar_update_state_bit
          (local.get $sw)
          (local.get $wParam)
          (local.get $state_byte)
          (local.get $lParam)))
        (call $paint_flag_set_inv (local.get $hwnd))
        (call $toolbar_repaint_now (local.get $hwnd))
        (return (i32.const 1))))

    ;; TB_SETSTATE (WM_USER+17): replace fsState for command ID.
    (if (i32.eq (local.get $msg) (i32.const 0x0411))
      (then
        (local.set $idx (call $toolbar_find_command_index (local.get $sw) (local.get $wParam)))
        (if (i32.lt_s (local.get $idx) (i32.const 0))
          (then (return (i32.const 0))))
        (local.set $rec (call $toolbar_button_ptr (local.get $sw) (local.get $idx)))
        (i32.store8 offset=8 (local.get $rec) (local.get $lParam))
        (call $paint_flag_set_inv (local.get $hwnd))
        (call $toolbar_repaint_now (local.get $hwnd))
        (return (i32.const 1))))

    ;; TB_HITTEST (WM_USER+69): lParam points to a POINT in toolbar coords.
    (if (i32.eq (local.get $msg) (i32.const 0x0445))
      (then
        (if (i32.eqz (local.get $lParam)) (then (return (i32.const -1))))
        (local.set $rect (call $g2w (local.get $lParam)))
        (return
          (call $toolbar_hit_test
            (local.get $sw)
            (i32.load (local.get $rect))
            (i32.load offset=4 (local.get $rect))))))

    ;; WM_MOUSEMOVE / WM_MOUSELEAVE maintain the hot index used by flat edges
    ;; and the optional hot image list. Disabled buttons do not become hot.
    (if (i32.eq (local.get $msg) (i32.const 0x0200))
      (then
        (local.set $x (i32.shr_s (i32.shl (local.get $lParam) (i32.const 16)) (i32.const 16)))
        (local.set $y (i32.shr_s (local.get $lParam) (i32.const 16)))
        (local.set $hit (call $toolbar_hit_test (local.get $sw) (local.get $x) (local.get $y)))
        (if (i32.ge_s (local.get $hit) (i32.const 0))
          (then
            (local.set $rec (call $toolbar_button_ptr (local.get $sw) (local.get $hit)))
            (if (i32.eqz (i32.and (i32.load8_u offset=8 (local.get $rec)) (i32.const 0x04)))
              (then (local.set $hit (i32.const -1))))))
        (if (i32.ne (local.get $hit) (load.field.memarg ToolbarState hot_index (local.get $sw)))
          (then
            (store.field.memarg ToolbarState hot_index (local.get $sw) (local.get $hit))
            (call $toolbar_repaint_now (local.get $hwnd))))
        (return (i32.const 0))))
    (if (i32.eq (local.get $msg) (i32.const 0x02A3))
      (then
        (if (i32.ne (load.field.memarg ToolbarState hot_index (local.get $sw)) (i32.const -1))
          (then
            (store.field.memarg ToolbarState hot_index (local.get $sw) (i32.const -1))
            (call $toolbar_repaint_now (local.get $hwnd))))
        (return (i32.const 0))))

    ;; WM_LBUTTONDOWN: remember the pressed button by hit-tested index.
    (if (i32.eq (local.get $msg) (i32.const 0x0201))
      (then
        (local.set $x (i32.shr_s (i32.shl (local.get $lParam) (i32.const 16)) (i32.const 16)))
        (local.set $y (i32.shr_s (local.get $lParam) (i32.const 16)))
        (local.set $hit (call $toolbar_hit_test (local.get $sw) (local.get $x) (local.get $y)))
        (store.field.memarg ToolbarState pressed_index (local.get $sw) (local.get $hit))
        (if (i32.ge_s (local.get $hit) (i32.const 0))
          (then
            (local.set $rec (call $toolbar_button_ptr (local.get $sw) (local.get $hit)))
            (if (i32.eqz (i32.and (i32.load8_u offset=8 (local.get $rec)) (i32.const 0x04)))
              (then
                (store.field.memarg ToolbarState pressed_index (local.get $sw) (i32.const -1))
                (return (i32.const 0))))
            (i32.store8 offset=8 (local.get $rec)
              (i32.or (i32.load8_u offset=8 (local.get $rec)) (i32.const 0x02)))
            (global.set $capture_hwnd (local.get $hwnd))
            (call $paint_flag_set_inv (local.get $hwnd))
            (call $toolbar_repaint_now (local.get $hwnd))))
        (return (i32.const 0))))

    ;; WM_LBUTTONUP: clear pressed state and send WM_COMMAND(idCommand, hwnd).
    (if (i32.eq (local.get $msg) (i32.const 0x0202))
      (then
        (local.set $x (i32.shr_s (i32.shl (local.get $lParam) (i32.const 16)) (i32.const 16)))
        (local.set $y (i32.shr_s (local.get $lParam) (i32.const 16)))
        (local.set $hit (call $toolbar_hit_test (local.get $sw) (local.get $x) (local.get $y)))
        (local.set $idx (load.field.memarg ToolbarState pressed_index (local.get $sw)))
        (store.field.memarg ToolbarState pressed_index (local.get $sw) (i32.const -1))
        (if (i32.eq (global.get $capture_hwnd) (local.get $hwnd))
          (then (global.set $capture_hwnd (i32.const 0))))
        (if (i32.ge_s (local.get $idx) (i32.const 0))
          (then
            (local.set $rec (call $toolbar_button_ptr (local.get $sw) (local.get $idx)))
            (i32.store8 offset=8 (local.get $rec)
              (i32.and (i32.load8_u offset=8 (local.get $rec)) (i32.const 0xFD)))
            (call $paint_flag_set_inv (local.get $hwnd))
            (call $toolbar_repaint_now (local.get $hwnd))
            (if (i32.and
                  (i32.eq (local.get $idx) (local.get $hit))
                  (i32.and
                    (i32.ne (i32.load offset=4 (local.get $rec)) (i32.const 0))
                    (i32.ne (i32.and (i32.load8_u offset=8 (local.get $rec)) (i32.const 0x04)) (i32.const 0))))
              (then
                (local.set $parent (call $wnd_get_parent (local.get $hwnd)))
                (if (local.get $parent)
                  (then
                    (drop (call $wnd_send_message
                      (local.get $parent)
                      (i32.const 0x0111)
                      (i32.and (i32.load offset=4 (local.get $rec)) (i32.const 0xFFFF))
                      (local.get $hwnd)))))))))
        (return (i32.const 0))))

    ;; WM_PAINT
    (if (i32.eq (local.get $msg) (i32.const 0x000F))
      (then
        (local.set $hdc (i32.add (local.get $hwnd) (i32.const 0x40000)))
        ;; Native toolbar paints start with a fresh BeginPaint-style clip.
        ;; Synthetic hwnd+0x40000 DCs can retain an empty clip from prior MFC
        ;; control-bar drawing, erasing the row while clipping every button.
        (drop (call $host_gdi_select_clip_rgn (local.get $hdc) (i32.const 0)))
        (call $dc_apply_client_clip (local.get $hdc) (local.get $hwnd))
        (local.set $sz (call $ctrl_get_wh_packed (local.get $hwnd)))
        (local.set $w (i32.and (local.get $sz) (i32.const 0xFFFF)))
        (local.set $h (i32.shr_u (local.get $sz) (i32.const 16)))
        (if (i32.and (i32.gt_s (local.get $w) (i32.const 0))
                     (i32.gt_s (local.get $h) (i32.const 0)))
          (then
            (drop (call $host_gdi_fill_rect (local.get $hdc)
                    (i32.const 0) (i32.const 0)
                    (local.get $w) (local.get $h)
                    (i32.const 0x30011))) ;; COLOR_BTNFACE approximation.
            (drop (call $host_gdi_draw_edge (local.get $hdc)
                    (i32.const 0) (i32.const 0)
                    (local.get $w) (local.get $h)
                    (i32.const 0x04) (i32.const 0x08))) ;; BDR_RAISEDINNER | BF_BOTTOM
            (local.set $count (load.field ToolbarState button_count (local.get $sw)))
            (local.set $bh (load.field.memarg ToolbarState button_h (local.get $sw)))
            (if (i32.lt_s (local.get $count) (i32.const 1))
              (then (local.set $count (i32.const 1))))
            (local.set $i (i32.const 0))
            (block $done (loop $buttons
              (br_if $done (i32.ge_u (local.get $i) (local.get $count)))
              (local.set $brect (call $paint_scratch_take))
              (if (i32.eqz (call $toolbar_button_rect (local.get $sw) (local.get $i) (local.get $brect)))
                (then (br $done)))
              (local.set $left (load.field PaintRect left (local.get $brect)))
              (local.set $top (load.field.memarg PaintRect top (local.get $brect)))
              (local.set $bw (i32.sub
                (load.field.memarg PaintRect right (local.get $brect))
                (local.get $left)))
              (local.set $bh (i32.sub
                (load.field.memarg PaintRect bottom (local.get $brect))
                (local.get $top)))
              (br_if $done (i32.ge_s (local.get $top) (i32.sub (local.get $h) (i32.const 2))))
              (local.set $state_byte (i32.const 4))
              (if (load.field.memarg ToolbarState buttons_guest (local.get $sw))
                (then
                  (local.set $rec (call $toolbar_button_ptr (local.get $sw) (local.get $i)))
                  (local.set $state_byte (i32.load8_u offset=8 (local.get $rec)))))
              (local.set $hit
                (i32.ne
                  (i32.and (local.get $state_byte) (i32.const 0x03)) ;; CHECKED | PRESSED
                  (i32.const 0)))
              (local.set $is_hot
                (i32.eq (local.get $i) (load.field.memarg ToolbarState hot_index (local.get $sw))))
              (if (i32.and (local.get $state_byte) (i32.const 0x08))
                (then
                  (local.set $i (i32.add (local.get $i) (i32.const 1)))
                  (br $buttons)))
              (if (i32.and
                    (i32.and (i32.ne (load.field.memarg ToolbarState buttons_guest (local.get $sw)) (i32.const 0))
                      (i32.ne (local.get $rec) (i32.const 0)))
                    (i32.and (i32.load8_u offset=9 (local.get $rec)) (i32.const 0x01)))
                (then
                  (if (i32.gt_s (local.get $bw) (i32.const 8))
                    (then
                      (drop (call $host_gdi_draw_edge (local.get $hdc)
                        (i32.add (local.get $left) (i32.const 3))
                        (i32.add (local.get $top) (i32.const 3))
                        (i32.add (local.get $left) (i32.const 5))
                        (i32.sub (i32.add (local.get $top) (local.get $bh)) (i32.const 3))
                        (i32.const 0x0A)
                        (i32.const 0x04)))))
                  (local.set $i (i32.add (local.get $i) (i32.const 1)))
                  (br $buttons)))
              ;; TBSTYLE_FLAT keeps idle/disabled button faces borderless.
              ;; The Win98 common control raises a flat button while it is hot
              ;; and sinks it while pressed/checked.
              (if (i32.or
                    (i32.or (local.get $hit) (local.get $is_hot))
                    (i32.eqz (i32.and (call $wnd_get_style (local.get $hwnd)) (i32.const 0x0800))))
                (then
                  (drop (call $host_gdi_draw_edge (local.get $hdc)
                          (local.get $left) (local.get $top)
                          (i32.add (local.get $left) (local.get $bw))
                          (i32.add (local.get $top) (local.get $bh))
                          (select (i32.const 0x0A) (i32.const 0x05) (local.get $hit))
                          (i32.const 0x0F))))) ;; EDGE_RAISED/SUNKEN | BF_RECT
              (local.set $drawn (i32.const 0))
              (local.set $bmp (load.field.memarg ToolbarState bitmap_handle (local.get $sw)))
              (local.set $bmp_draw_w (load.field.memarg ToolbarState bitmap_w (local.get $sw)))
              (local.set $bmp_draw_h (load.field.memarg ToolbarState bitmap_h (local.get $sw)))
              (local.set $mask_color (i32.const 0x00C0C0C0))
              (local.set $use_disabled_effect
                (i32.eqz (i32.and (local.get $state_byte) (i32.const 0x04))))
              ;; Prefer a state-specific image list, then the normal image
              ;; list, then the legacy TB_ADDBITMAP strip. A disabled image
              ;; list already contains its intended pixels and must not be
              ;; embossed a second time.
              (local.set $image_list (i32.const 0))
              (if (local.get $use_disabled_effect)
                (then (local.set $image_list (load.field.memarg ToolbarState disabled_image_list (local.get $sw))))
                (else
                  (if (local.get $is_hot)
                    (then (local.set $image_list (load.field.memarg ToolbarState hot_image_list (local.get $sw)))))))
              (local.set $image_sw
                (call $toolbar_imagelist_ptr (local.get $image_list)))
              (if (i32.eqz (local.get $image_sw))
                (then
                  (local.set $image_list (load.field.memarg ToolbarState image_list (local.get $sw)))
                  (local.set $image_sw
                    (call $toolbar_imagelist_ptr (local.get $image_list)))))
              (if (local.get $image_sw)
                (then
                  (local.set $bmp (i32.load offset=16 (local.get $image_sw)))
                  (local.set $bmp_draw_w (i32.load (local.get $image_sw)))
                  (local.set $bmp_draw_h (i32.load offset=4 (local.get $image_sw)))
                  (local.set $mask_color (i32.load offset=20 (local.get $image_sw)))
                  (if (i32.ne
                        (local.get $image_list)
                        (load.field.memarg ToolbarState image_list (local.get $sw)))
                    (then (local.set $use_disabled_effect (i32.const 0))))))
              (if (i32.and
                    (i32.and
                      (i32.ne (load.field.memarg ToolbarState buttons_guest (local.get $sw)) (i32.const 0))
                      (i32.ne (local.get $rec) (i32.const 0)))
                    (i32.and
                      (i32.ge_s (i32.load (local.get $rec)) (i32.const 0))
                      (i32.ne (local.get $bmp) (i32.const 0))))
                (then
                  (local.set $bmp_w (call $host_gdi_get_object_w (local.get $bmp)))
                  (local.set $bmp_h (call $host_gdi_get_object_h (local.get $bmp)))
                  (if (i32.le_s (local.get $bmp_draw_w) (i32.const 0))
                    (then (local.set $bmp_draw_w (i32.const 16))))
                  (if (i32.le_s (local.get $bmp_draw_h) (i32.const 0))
                    (then (local.set $bmp_draw_h (i32.const 16))))
                  (local.set $bmp_src_x
                    (i32.mul (i32.load (local.get $rec)) (local.get $bmp_draw_w)))
                  (if (i32.and
                        (i32.and
                          (i32.gt_s (local.get $bmp_w) (i32.const 0))
                          (i32.gt_s (local.get $bmp_h) (i32.const 0)))
                        (i32.and
                          (i32.le_s (i32.add (local.get $bmp_src_x) (local.get $bmp_draw_w)) (local.get $bmp_w))
                          (i32.le_s (local.get $bmp_draw_h) (local.get $bmp_h))))
                    (then
                      (local.set $bmp_dst_x
                        (i32.add
                          (i32.add
                            (local.get $left)
                            (i32.div_s
                              (i32.sub (local.get $bw) (local.get $bmp_draw_w))
                              (i32.const 2)))
                          (local.get $hit)))
                      (local.set $bmp_dst_y
                        (i32.add
                          (i32.add
                            (local.get $top)
                            (i32.div_s
                              (i32.sub (local.get $bh) (local.get $bmp_draw_h))
                              (i32.const 2)))
                          (local.get $hit)))
                      (local.set $memdc (call $host_gdi_create_compat_dc (local.get $hdc)))
                      (if (local.get $memdc)
                        (then
                          (drop (call $host_gdi_select_object (local.get $memdc) (local.get $bmp)))
                          (local.set $drawn
                            (if (result i32)
                              (i32.eqz (local.get $use_disabled_effect))
                              (then
                                (call $host_gdi_transparent_blt
                                  (local.get $hdc)
                                  (local.get $bmp_dst_x) (local.get $bmp_dst_y)
                                  (local.get $bmp_draw_w) (local.get $bmp_draw_h)
                                  (local.get $memdc)
                                  (local.get $bmp_src_x) (i32.const 0)
                                  (local.get $mask_color)))
                              (else
                                (call $host_gdi_disabled_blt
                                  (local.get $hdc)
                                  (local.get $bmp_dst_x) (local.get $bmp_dst_y)
                                  (local.get $bmp_draw_w) (local.get $bmp_draw_h)
                                  (local.get $memdc)
                                  (local.get $bmp_src_x) (i32.const 0)
                                  (local.get $mask_color)))))
                          (drop (call $host_gdi_delete_dc (local.get $memdc)))))))))
              (if (i32.eqz (local.get $drawn))
                (then
                  ;; Fallback glyph: a small dark mark inside each button, so
                  ;; screenshots still distinguish toolbar buttons from a plain
                  ;; gray band when no app bitmap strip is available.
                  (drop (call $host_gdi_fill_rect (local.get $hdc)
                          (i32.add (i32.add (local.get $left) (i32.const 8)) (local.get $hit))
                          (i32.add (i32.add (local.get $top) (i32.const 7)) (local.get $hit))
                          (i32.add (i32.add (local.get $left) (i32.const 15)) (local.get $hit))
                          (i32.add (i32.add (local.get $top) (i32.const 14)) (local.get $hit))
                          (i32.const 0x30012)))))
              (local.set $i (i32.add (local.get $i) (i32.const 1)))
              (br $buttons)))))
        (return (i32.const 0))))

    (i32.const 0))

  ;; ---- Tooltip WndProc ----
  ;;
  ;; Stateful tooltips_class32 subset. State layout:
  ;; +0 items_guest (array of 48-byte TOOLINFOA snapshots)
  ;; +4 count, +8 capacity, +12 active flag, +16 current index
  ;; +20 bk color, +24 text color, +28 max tip width, +32 autopop delay
  ;; +36 initial delay, +40 reshow delay, +44 margin l/t/r/b.
  (func $tooltip_item_ptr (param $sw ptr<TooltipState>) (param $idx i32) (result i32)
    (i32.add (call $g2w (load.field TooltipState items_guest (local.get $sw)))
             (i32.mul (local.get $idx) (i32.const 48))))

  (func $tooltip_find_tool (param $sw ptr<TooltipState>) (param $tool_hwnd i32) (param $tool_id i32) (result i32)
    (local $i i32) (local $count i32) (local $rec i32)
    (local.set $count (load.field.memarg TooltipState count (local.get $sw)))
    (local.set $i (i32.const 0))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (local.get $count)))
      (local.set $rec (call $tooltip_item_ptr (local.get $sw) (local.get $i)))
      (if (i32.and
            (i32.eq (i32.load offset=8 (local.get $rec)) (local.get $tool_hwnd))
            (i32.eq (i32.load offset=12 (local.get $rec)) (local.get $tool_id)))
        (then (return (local.get $i))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (i32.const -1))

  (func $tooltip_hit_test (param $sw ptr<TooltipState>) (param $tool_hwnd i32) (param $x i32) (param $y i32) (result i32)
    (local $i i32) (local $count i32) (local $rec i32)
    (local.set $count (load.field.memarg TooltipState count (local.get $sw)))
    (local.set $i (i32.const 0))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (local.get $count)))
      (local.set $rec (call $tooltip_item_ptr (local.get $sw) (local.get $i)))
      (if (i32.and
            (i32.eq (i32.load offset=8 (local.get $rec)) (local.get $tool_hwnd))
            (i32.and
              (i32.ge_s (local.get $x) (i32.load offset=16 (local.get $rec)))
              (i32.and
                (i32.lt_s (local.get $x) (i32.load offset=24 (local.get $rec)))
                (i32.and
                  (i32.ge_s (local.get $y) (i32.load offset=20 (local.get $rec)))
                  (i32.lt_s (local.get $y) (i32.load offset=28 (local.get $rec)))))))
        (then (return (local.get $i))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (i32.const -1))

  (func $tooltip_copy_in (param $dst i32) (param $src_guest i32)
    (local $src i32) (local $size i32)
    (local.set $src (call $g2w (local.get $src_guest)))
    (call $zero_memory (local.get $dst) (i32.const 48))
    (if (i32.eqz (local.get $src_guest)) (then (return)))
    (local.set $size (i32.load (local.get $src)))
    (if (i32.gt_u (local.get $size) (i32.const 48)) (then (local.set $size (i32.const 48))))
    (if (i32.lt_u (local.get $size) (i32.const 40)) (then (local.set $size (i32.const 40))))
    (call $memcpy (local.get $dst) (local.get $src) (local.get $size)))

  (func $tooltip_wndproc (param $hwnd i32) (param $msg i32) (param $wParam i32) (param $lParam i32) (result i32)
    (local $state i32) (local $sw ptr<TooltipState>) (local $items i32) (local $new_items i32)
    (local $count i32) (local $cap i32) (local $idx i32) (local $rec i32)
    (local $src i32) (local $dst i32) (local $text_src i32) (local $text_dst i32)
    (local $len i32) (local $ti i32) (local $x i32) (local $y i32) (local $old i32)
    (local $created i32)

    (local.set $state (call $wnd_get_state_ptr (local.get $hwnd)))
    (if (i32.eqz (local.get $state))
      (then
        (local.set $state (call $heap_alloc (i32.const 64)))
        (local.set $created (i32.const 1))))
    (local.set $sw (cast ptr<TooltipState> (call $g2w (local.get $state))))
    (if (local.get $created)
      (then
        (call $zero_memory (local.get $sw) (i32.const 64))
        (local.set $items (call $heap_alloc (i32.mul (i32.const 4) (i32.const 48))))
        (call $zero_memory (call $g2w (local.get $items)) (i32.mul (i32.const 4) (i32.const 48)))
        (store.field TooltipState items_guest (local.get $sw) (local.get $items))
        (store.field.memarg TooltipState capacity (local.get $sw) (i32.const 4))
        (store.field.memarg TooltipState active (local.get $sw) (i32.const 1))
        (store.field.memarg TooltipState current_index (local.get $sw) (i32.const -1))
        (store.field.memarg TooltipState bk_color (local.get $sw) (i32.const 0x00FFFFE1))
        (store.field.memarg TooltipState text_color (local.get $sw) (i32.const 0x00000000))
        (store.field.memarg TooltipState max_tip_width (local.get $sw) (i32.const -1))
        (store.field.memarg TooltipState autopop_delay (local.get $sw) (i32.const 5000))
        (store.field.memarg TooltipState initial_delay (local.get $sw) (i32.const 500))
        (store.field.memarg TooltipState reshow_delay (local.get $sw) (i32.const 100))
        (call $wnd_set_state_ptr (local.get $hwnd) (local.get $state))))

    ;; WM_CREATE
    (if (i32.eq (local.get $msg) (i32.const 0x0001)) (then (return (i32.const 0))))
    ;; WM_DESTROY
    (if (i32.eq (local.get $msg) (i32.const 0x0002))
      (then
        (call $heap_free (load.field TooltipState items_guest (local.get $sw)))
        (call $heap_free (local.get $state))
        (call $wnd_set_state_ptr (local.get $hwnd) (i32.const 0))
        (return (i32.const 0))))

    ;; TTM_ACTIVATE
    (if (i32.eq (local.get $msg) (i32.const 0x0401))
      (then
        (store.field.memarg TooltipState active (local.get $sw) (select (i32.const 1) (i32.const 0) (i32.ne (local.get $wParam) (i32.const 0))))
        (return (i32.const 0))))

    ;; TTM_SETDELAYTIME / TTM_GETDELAYTIME
    (if (i32.eq (local.get $msg) (i32.const 0x0403))
      (then
        (if (i32.eq (local.get $wParam) (i32.const 1)) (then (store.field.memarg TooltipState reshow_delay (local.get $sw) (local.get $lParam))))
        (if (i32.eq (local.get $wParam) (i32.const 2)) (then (store.field.memarg TooltipState autopop_delay (local.get $sw) (local.get $lParam))))
        (if (i32.eq (local.get $wParam) (i32.const 3)) (then (store.field.memarg TooltipState initial_delay (local.get $sw) (local.get $lParam))))
        (if (i32.eq (local.get $wParam) (i32.const 0))
          (then
            (store.field.memarg TooltipState initial_delay (local.get $sw) (local.get $lParam))
            (store.field.memarg TooltipState reshow_delay (local.get $sw) (i32.div_s (local.get $lParam) (i32.const 5)))
            (store.field.memarg TooltipState autopop_delay (local.get $sw) (i32.mul (local.get $lParam) (i32.const 10)))))
        (return (i32.const 0))))
    (if (i32.eq (local.get $msg) (i32.const 0x0415))
      (then
        (if (i32.eq (local.get $wParam) (i32.const 1)) (then (return (load.field.memarg TooltipState reshow_delay (local.get $sw)))))
        (if (i32.eq (local.get $wParam) (i32.const 2)) (then (return (load.field.memarg TooltipState autopop_delay (local.get $sw)))))
        (if (i32.eq (local.get $wParam) (i32.const 3)) (then (return (load.field.memarg TooltipState initial_delay (local.get $sw)))))
        (return (load.field.memarg TooltipState initial_delay (local.get $sw)))))

    ;; TTM_ADDTOOLA
    (if (i32.eq (local.get $msg) (i32.const 0x0404))
      (then
        (if (i32.eqz (local.get $lParam)) (then (return (i32.const 0))))
        (local.set $src (call $g2w (local.get $lParam)))
        (local.set $idx (call $tooltip_find_tool (local.get $sw)
          (i32.load offset=8 (local.get $src)) (i32.load offset=12 (local.get $src))))
        (if (i32.ge_s (local.get $idx) (i32.const 0))
          (then
            (call $tooltip_copy_in (call $tooltip_item_ptr (local.get $sw) (local.get $idx)) (local.get $lParam))
            (return (i32.const 1))))
        (local.set $count (load.field.memarg TooltipState count (local.get $sw)))
        (local.set $cap (load.field.memarg TooltipState capacity (local.get $sw)))
        (if (i32.ge_u (local.get $count) (local.get $cap))
          (then
            (local.set $new_items (call $heap_alloc (i32.mul (i32.mul (local.get $cap) (i32.const 2)) (i32.const 48))))
            (call $zero_memory (call $g2w (local.get $new_items)) (i32.mul (i32.mul (local.get $cap) (i32.const 2)) (i32.const 48)))
            (call $memcpy (call $g2w (local.get $new_items)) (call $g2w (load.field TooltipState items_guest (local.get $sw))) (i32.mul (local.get $count) (i32.const 48)))
            (call $heap_free (load.field TooltipState items_guest (local.get $sw)))
            (store.field TooltipState items_guest (local.get $sw) (local.get $new_items))
            (store.field.memarg TooltipState capacity (local.get $sw) (i32.mul (local.get $cap) (i32.const 2)))))
        (call $tooltip_copy_in (call $tooltip_item_ptr (local.get $sw) (local.get $count)) (local.get $lParam))
        (store.field.memarg TooltipState count (local.get $sw) (i32.add (local.get $count) (i32.const 1)))
        (if (i32.lt_s (load.field.memarg TooltipState current_index (local.get $sw)) (i32.const 0))
          (then (store.field.memarg TooltipState current_index (local.get $sw) (local.get $count))))
        (return (i32.const 1))))

    ;; TTM_DELTOOLA
    (if (i32.eq (local.get $msg) (i32.const 0x0405))
      (then
        (if (i32.eqz (local.get $lParam)) (then (return (i32.const 0))))
        (local.set $src (call $g2w (local.get $lParam)))
        (local.set $idx (call $tooltip_find_tool (local.get $sw)
          (i32.load offset=8 (local.get $src)) (i32.load offset=12 (local.get $src))))
        (if (i32.lt_s (local.get $idx) (i32.const 0)) (then (return (i32.const 0))))
        (local.set $count (load.field.memarg TooltipState count (local.get $sw)))
        (local.set $rec (call $tooltip_item_ptr (local.get $sw) (local.get $idx)))
        (if (i32.lt_u (i32.add (local.get $idx) (i32.const 1)) (local.get $count))
          (then
            (call $memcpy (local.get $rec)
              (i32.add (local.get $rec) (i32.const 48))
              (i32.mul (i32.sub (i32.sub (local.get $count) (local.get $idx)) (i32.const 1)) (i32.const 48)))))
        (store.field.memarg TooltipState count (local.get $sw) (i32.sub (local.get $count) (i32.const 1)))
        (if (i32.ge_s (load.field.memarg TooltipState current_index (local.get $sw)) (i32.sub (local.get $count) (i32.const 1)))
          (then (store.field.memarg TooltipState current_index (local.get $sw) (i32.sub (load.field.memarg TooltipState count (local.get $sw)) (i32.const 1)))))
        (return (i32.const 1))))

    ;; TTM_NEWTOOLRECTA / TTM_SETTOOLINFOA / TTM_UPDATETIPTEXTA
    (if (i32.or (i32.eq (local.get $msg) (i32.const 0x0406))
                (i32.or (i32.eq (local.get $msg) (i32.const 0x0409))
                        (i32.eq (local.get $msg) (i32.const 0x040C))))
      (then
        (if (i32.eqz (local.get $lParam)) (then (return (i32.const 0))))
        (local.set $src (call $g2w (local.get $lParam)))
        (local.set $idx (call $tooltip_find_tool (local.get $sw)
          (i32.load offset=8 (local.get $src)) (i32.load offset=12 (local.get $src))))
        (if (i32.lt_s (local.get $idx) (i32.const 0)) (then (return (i32.const 0))))
        (local.set $rec (call $tooltip_item_ptr (local.get $sw) (local.get $idx)))
        (if (i32.eq (local.get $msg) (i32.const 0x0406))
          (then (call $memcpy (i32.add (local.get $rec) (i32.const 16)) (i32.add (local.get $src) (i32.const 16)) (i32.const 16)))
          (else
            (if (i32.eq (local.get $msg) (i32.const 0x040C))
              (then (i32.store offset=36 (local.get $rec) (i32.load offset=36 (local.get $src))))
              (else (call $tooltip_copy_in (local.get $rec) (local.get $lParam))))))
        (return (i32.const 1))))

    ;; TTM_GETTOOLINFOA / TTM_ENUMTOOLSA / TTM_GETCURRENTTOOLA
    (if (i32.or (i32.eq (local.get $msg) (i32.const 0x0408))
                (i32.or (i32.eq (local.get $msg) (i32.const 0x040E))
                        (i32.eq (local.get $msg) (i32.const 0x040F))))
      (then
        (if (i32.eqz (local.get $lParam)) (then (return (i32.const 0))))
        (local.set $dst (call $g2w (local.get $lParam)))
        (if (i32.eq (local.get $msg) (i32.const 0x040E))
          (then (local.set $idx (local.get $wParam)))
          (else
            (if (i32.eq (local.get $msg) (i32.const 0x040F))
              (then (local.set $idx (load.field.memarg TooltipState current_index (local.get $sw))))
              (else
                (local.set $idx (call $tooltip_find_tool (local.get $sw)
                  (i32.load offset=8 (local.get $dst)) (i32.load offset=12 (local.get $dst))))))))
        (if (i32.or (i32.lt_s (local.get $idx) (i32.const 0))
                    (i32.ge_u (local.get $idx) (load.field.memarg TooltipState count (local.get $sw))))
          (then (return (i32.const 0))))
        (call $memcpy (local.get $dst) (call $tooltip_item_ptr (local.get $sw) (local.get $idx)) (i32.const 48))
        (return (i32.const 1))))

    ;; TTM_GETTEXTA
    (if (i32.eq (local.get $msg) (i32.const 0x040B))
      (then
        (if (i32.eqz (local.get $lParam)) (then (return (i32.const 0))))
        (local.set $ti (call $g2w (local.get $lParam)))
        (local.set $idx (call $tooltip_find_tool (local.get $sw)
          (i32.load offset=8 (local.get $ti)) (i32.load offset=12 (local.get $ti))))
        (if (i32.lt_s (local.get $idx) (i32.const 0)) (then (return (i32.const 0))))
        (local.set $rec (call $tooltip_item_ptr (local.get $sw) (local.get $idx)))
        (local.set $text_dst (call $g2w (i32.load offset=36 (local.get $ti))))
        (local.set $text_src (call $g2w (i32.load offset=36 (local.get $rec))))
        (if (i32.and
              (i32.ne (local.get $text_dst) (i32.const 0))
              (i32.ne (local.get $text_src) (i32.const 0)))
          (then
            (local.set $len (call $strlen (local.get $text_src)))
            (if (i32.gt_u (local.get $len) (i32.const 255)) (then (local.set $len (i32.const 255))))
            (call $memcpy (local.get $text_dst) (local.get $text_src) (local.get $len))
            (i32.store8 (i32.add (local.get $text_dst) (local.get $len)) (i32.const 0))))
        (return (i32.const 1))))

    ;; TTM_GETTOOLCOUNT
    (if (i32.eq (local.get $msg) (i32.const 0x040D))
      (then (return (load.field.memarg TooltipState count (local.get $sw)))))

    ;; TTM_HITTESTA. TTHITTESTINFOA: hwnd(+0), pt(+4,+8), ti(+12).
    (if (i32.eq (local.get $msg) (i32.const 0x040A))
      (then
        (if (i32.eqz (local.get $lParam)) (then (return (i32.const 0))))
        (local.set $src (call $g2w (local.get $lParam)))
        (local.set $idx (call $tooltip_hit_test (local.get $sw)
          (i32.load (local.get $src)) (i32.load offset=4 (local.get $src)) (i32.load offset=8 (local.get $src))))
        (if (i32.lt_s (local.get $idx) (i32.const 0)) (then (return (i32.const 0))))
        (call $memcpy (i32.add (local.get $src) (i32.const 12))
          (call $tooltip_item_ptr (local.get $sw) (local.get $idx)) (i32.const 48))
        (return (i32.const 1))))

    ;; TTM_RELAYEVENT. MSG: hwnd,msg,wParam,lParam,time,pt.x,pt.y.
    (if (i32.eq (local.get $msg) (i32.const 0x0407))
      (then
        (if (i32.eqz (local.get $lParam)) (then (return (i32.const 0))))
        (local.set $src (call $g2w (local.get $lParam)))
        (local.set $x (i32.shr_s (i32.shl (i32.load offset=12 (local.get $src)) (i32.const 16)) (i32.const 16)))
        (local.set $y (i32.shr_s (i32.load offset=12 (local.get $src)) (i32.const 16)))
        (local.set $idx (call $tooltip_hit_test (local.get $sw)
          (i32.load (local.get $src)) (local.get $x) (local.get $y)))
        (store.field.memarg TooltipState current_index (local.get $sw) (local.get $idx))
        (return (i32.const 0))))

    ;; TTM_WINDOWFROMPOINT: return current matched hwnd if available.
    (if (i32.eq (local.get $msg) (i32.const 0x0410))
      (then
        (local.set $idx (load.field.memarg TooltipState current_index (local.get $sw)))
        (if (i32.or (i32.lt_s (local.get $idx) (i32.const 0))
                    (i32.ge_u (local.get $idx) (load.field.memarg TooltipState count (local.get $sw))))
          (then (return (i32.const 0))))
        (return (i32.load offset=8 (call $tooltip_item_ptr (local.get $sw) (local.get $idx))))))

    ;; TTM_TRACKACTIVATE / TTM_POP / TTM_UPDATE
    (if (i32.or (i32.eq (local.get $msg) (i32.const 0x0411))
                (i32.or (i32.eq (local.get $msg) (i32.const 0x041C))
                        (i32.eq (local.get $msg) (i32.const 0x041D))))
      (then (return (i32.const 1))))
    ;; TTM_TRACKPOSITION
    (if (i32.eq (local.get $msg) (i32.const 0x0412)) (then (return (i32.const 0))))

    ;; Colors / max width / margin.
    (if (i32.eq (local.get $msg) (i32.const 0x0413)) (then (store.field.memarg TooltipState bk_color (local.get $sw) (local.get $wParam)) (return (i32.const 0))))
    (if (i32.eq (local.get $msg) (i32.const 0x0414)) (then (store.field.memarg TooltipState text_color (local.get $sw) (local.get $wParam)) (return (i32.const 0))))
    (if (i32.eq (local.get $msg) (i32.const 0x0416)) (then (return (load.field.memarg TooltipState bk_color (local.get $sw)))))
    (if (i32.eq (local.get $msg) (i32.const 0x0417)) (then (return (load.field.memarg TooltipState text_color (local.get $sw)))))
    (if (i32.eq (local.get $msg) (i32.const 0x0418))
      (then
        (local.set $old (load.field.memarg TooltipState max_tip_width (local.get $sw)))
        (store.field.memarg TooltipState max_tip_width (local.get $sw) (local.get $lParam))
        (return (local.get $old))))
    (if (i32.eq (local.get $msg) (i32.const 0x0419)) (then (return (load.field.memarg TooltipState max_tip_width (local.get $sw)))))
    (if (i32.eq (local.get $msg) (i32.const 0x041A))
      (then
        (if (local.get $lParam) (then (call $memcpy (i32.add (local.get $sw) (i32.const 44)) (call $g2w (local.get $lParam)) (i32.const 16))))
        (return (i32.const 0))))
    (if (i32.eq (local.get $msg) (i32.const 0x041B))
      (then
        (if (local.get $lParam) (then (call $memcpy (call $g2w (local.get $lParam)) (i32.add (local.get $sw) (i32.const 44)) (i32.const 16))))
        (return (i32.const 0))))

    (i32.const 0))

  ;; ---- TrackBar / Slider WndProc ----
  ;;
  ;; Minimal common-control trackbar for Funpack dialogs. State:
  ;; +0 min, +4 max, +8 pos, +12 line, +16 page, +20 thumb length.
  (func $trackbar_wndproc (param $hwnd i32) (param $msg i32) (param $wParam i32) (param $lParam i32) (result i32)
    (local $state i32) (local $sw i32) (local $min i32) (local $max i32) (local $pos i32)
    (local $old i32) (local $hdc i32) (local $sz i32) (local $w i32) (local $h i32)
    (local $style i32) (local $vert i32) (local $range i32) (local $track_len i32)
    (local $thumb_len i32) (local $thumb_pos i32) (local $cx i32) (local $cy i32)
    (local $coord i32) (local $long_dim i32) (local $parent i32) (local $scroll_msg i32)
    (local $i i32)

    (local.set $state (call $wnd_get_state_ptr (local.get $hwnd)))
    (if (i32.eqz (local.get $state))
      (then
        (local.set $state (call $heap_alloc (i32.const 24)))
        (local.set $sw (call $g2w (local.get $state)))
        (call $trk_state_init (local.get $sw))
        (call $wnd_set_state_ptr (local.get $hwnd) (local.get $state))))
    (local.set $sw (call $g2w (local.get $state)))

    ;; WM_CREATE
    (if (i32.eq (local.get $msg) (i32.const 0x0001))
      (then (return (i32.const 0))))
    ;; WM_DESTROY
    (if (i32.eq (local.get $msg) (i32.const 0x0002))
      (then
        (call $heap_free (local.get $state))
        (call $wnd_set_state_ptr (local.get $hwnd) (i32.const 0))
        (return (i32.const 0))))

    ;; TBM_GETPOS / TBM_GETRANGEMIN / TBM_GETRANGEMAX
    (if (i32.eq (local.get $msg) (i32.const 0x0400))
      (then (return (call $trk_pos (local.get $sw)))))
    (if (i32.eq (local.get $msg) (i32.const 0x0401))
      (then (return (call $trk_min (local.get $sw)))))
    (if (i32.eq (local.get $msg) (i32.const 0x0402))
      (then (return (call $trk_max (local.get $sw)))))
    ;; TBM_SETPOS(fRedraw, pos)
    (if (i32.eq (local.get $msg) (i32.const 0x0405))
      (then
        (call $trk_set_pos (local.get $sw)
          (call $trk_clamp (local.get $sw) (local.get $lParam)))
        (if (local.get $wParam) (then (call $invalidate_hwnd (local.get $hwnd))))
        (return (i32.const 0))))
    ;; TBM_SETRANGE(fRedraw, MAKELONG(min,max))
    (if (i32.eq (local.get $msg) (i32.const 0x0406))
      (then
        (local.set $min (i32.shr_s (i32.shl (local.get $lParam) (i32.const 16)) (i32.const 16)))
        (local.set $max (i32.shr_s (local.get $lParam) (i32.const 16)))
        (if (i32.le_s (local.get $max) (local.get $min))
          (then (local.set $max (i32.add (local.get $min) (i32.const 1)))))
        (call $trk_set_min (local.get $sw) (local.get $min))
        (call $trk_set_max (local.get $sw) (local.get $max))
        (call $trk_set_pos (local.get $sw)
          (call $trk_clamp (local.get $sw) (call $trk_pos (local.get $sw))))
        (if (local.get $wParam) (then (call $invalidate_hwnd (local.get $hwnd))))
        (return (i32.const 0))))
    ;; TBM_SETRANGEMIN / TBM_SETRANGEMAX
    (if (i32.eq (local.get $msg) (i32.const 0x0407))
      (then
        (call $trk_set_min (local.get $sw) (local.get $lParam))
        (if (local.get $wParam) (then (call $invalidate_hwnd (local.get $hwnd))))
        (return (i32.const 0))))
    (if (i32.eq (local.get $msg) (i32.const 0x0408))
      (then
        (call $trk_set_max (local.get $sw) (local.get $lParam))
        (if (local.get $wParam) (then (call $invalidate_hwnd (local.get $hwnd))))
        (return (i32.const 0))))
    ;; TBM_SETPAGESIZE / GETPAGESIZE / SETLINESIZE / GETLINESIZE
    (if (i32.eq (local.get $msg) (i32.const 0x0415))
      (then
        (local.set $old (call $trk_page (local.get $sw)))
        (call $trk_set_page (local.get $sw) (local.get $lParam))
        (return (local.get $old))))
    (if (i32.eq (local.get $msg) (i32.const 0x0416))
      (then (return (call $trk_page (local.get $sw)))))
    (if (i32.eq (local.get $msg) (i32.const 0x0417))
      (then
        (local.set $old (call $trk_line (local.get $sw)))
        (call $trk_set_line (local.get $sw) (local.get $lParam))
        (return (local.get $old))))
    (if (i32.eq (local.get $msg) (i32.const 0x0418))
      (then (return (call $trk_line (local.get $sw)))))
    ;; TBM_SETTHUMBLENGTH / GETTHUMBLENGTH
    (if (i32.eq (local.get $msg) (i32.const 0x041B))
      (then
        (call $trk_set_thumb_len (local.get $sw) (local.get $wParam))
        (call $invalidate_hwnd (local.get $hwnd))
        (return (i32.const 0))))
    (if (i32.eq (local.get $msg) (i32.const 0x041C))
      (then (return (call $trk_thumb_len (local.get $sw)))))

    ;; Mouse tracking. Native trackbars capture the thumb and synchronously
    ;; notify their parent with WM_HSCROLL/WM_VSCROLL while it moves.
    (if (i32.or
          (i32.eq (local.get $msg) (i32.const 0x0201))
          (i32.and (i32.eq (local.get $msg) (i32.const 0x0200))
                   (i32.eq (global.get $capture_hwnd) (local.get $hwnd))))
      (then
        (local.set $sz (call $ctrl_get_wh_packed (local.get $hwnd)))
        (local.set $w (i32.and (local.get $sz) (i32.const 0xffff)))
        (local.set $h (i32.shr_u (local.get $sz) (i32.const 16)))
        (local.set $style (call $wnd_get_style (local.get $hwnd)))
        (local.set $vert (i32.and (local.get $style) (i32.const 0x0002)))
        (local.set $long_dim (select (local.get $h) (local.get $w) (local.get $vert)))
        (local.set $coord
          (select
            (i32.shr_s (local.get $lParam) (i32.const 16))
            (i32.shr_s (i32.shl (local.get $lParam) (i32.const 16)) (i32.const 16))
            (local.get $vert)))
        (local.set $thumb_len (call $trk_thumb_len (local.get $sw)))
        (if (i32.lt_s (local.get $thumb_len) (i32.const 8))
          (then (local.set $thumb_len (i32.const 8))))
        (local.set $track_len (i32.sub (local.get $long_dim) (local.get $thumb_len)))
        (if (i32.lt_s (local.get $track_len) (i32.const 1))
          (then (local.set $track_len (i32.const 1))))
        (local.set $coord (i32.sub (local.get $coord) (i32.div_s (local.get $thumb_len) (i32.const 2))))
        (if (i32.lt_s (local.get $coord) (i32.const 0)) (then (local.set $coord (i32.const 0))))
        (if (i32.gt_s (local.get $coord) (local.get $track_len)) (then (local.set $coord (local.get $track_len))))
        (local.set $min (call $trk_min (local.get $sw)))
        (local.set $max (call $trk_max (local.get $sw)))
        (local.set $range (i32.sub (local.get $max) (local.get $min)))
        (if (i32.le_s (local.get $range) (i32.const 0)) (then (local.set $range (i32.const 1))))
        (local.set $pos
          (i32.add (local.get $min)
            (i32.div_s (i32.mul (local.get $coord) (local.get $range)) (local.get $track_len))))
        (call $trk_set_pos (local.get $sw) (local.get $pos))
        (if (i32.eq (local.get $msg) (i32.const 0x0201))
          (then (global.set $capture_hwnd (local.get $hwnd))))
        (call $invalidate_hwnd (local.get $hwnd))
        (local.set $parent (call $wnd_get_parent (local.get $hwnd)))
        (local.set $scroll_msg (select (i32.const 0x0115) (i32.const 0x0114) (local.get $vert)))
        (drop (call $wnd_send_message
          (local.get $parent) (local.get $scroll_msg)
          (i32.or (i32.const 5) (i32.shl (i32.and (local.get $pos) (i32.const 0xffff)) (i32.const 16)))
          (local.get $hwnd)))
        (return (i32.const 0))))

    (if (i32.eq (local.get $msg) (i32.const 0x0202))
      (then
        (if (i32.eq (global.get $capture_hwnd) (local.get $hwnd))
          (then
            (global.set $capture_hwnd (i32.const 0))
            (local.set $pos (call $trk_pos (local.get $sw)))
            (local.set $vert (i32.and (call $wnd_get_style (local.get $hwnd)) (i32.const 0x0002)))
            (local.set $scroll_msg (select (i32.const 0x0115) (i32.const 0x0114) (local.get $vert)))
            (local.set $parent (call $wnd_get_parent (local.get $hwnd)))
            (drop (call $wnd_send_message
              (local.get $parent) (local.get $scroll_msg)
              (i32.or (i32.const 4) (i32.shl (i32.and (local.get $pos) (i32.const 0xffff)) (i32.const 16)))
              (local.get $hwnd)))
            (drop (call $wnd_send_message
              (local.get $parent) (local.get $scroll_msg) (i32.const 8) (local.get $hwnd)))))
        (return (i32.const 0))))

    ;; WM_PAINT
    (if (i32.eq (local.get $msg) (i32.const 0x000F))
      (then
        (local.set $hdc (i32.add (local.get $hwnd) (i32.const 0x40000)))
        (local.set $sz (call $ctrl_get_wh_packed (local.get $hwnd)))
        (local.set $w (i32.and (local.get $sz) (i32.const 0xFFFF)))
        (local.set $h (i32.shr_u (local.get $sz) (i32.const 16)))
        (local.set $style (call $wnd_get_style (local.get $hwnd)))
        (local.set $vert (i32.and (local.get $style) (i32.const 0x0002)))
        (drop (call $host_gdi_fill_rect (local.get $hdc)
                (i32.const 0) (i32.const 0) (local.get $w) (local.get $h)
                (i32.const 0x30011))) ;; LTGRAY_BRUSH / COLOR_BTNFACE.
        (local.set $min (call $trk_min (local.get $sw)))
        (local.set $max (call $trk_max (local.get $sw)))
        (local.set $pos (call $trk_pos (local.get $sw)))
        (local.set $range (i32.sub (local.get $max) (local.get $min)))
        (if (i32.le_s (local.get $range) (i32.const 0)) (then (local.set $range (i32.const 1))))
        (local.set $thumb_len (call $trk_thumb_len (local.get $sw)))
        (if (i32.lt_s (local.get $thumb_len) (i32.const 8)) (then (local.set $thumb_len (i32.const 8))))
        (if (local.get $vert)
          (then
            (local.set $track_len (i32.sub (local.get $h) (local.get $thumb_len)))
            (if (i32.lt_s (local.get $track_len) (i32.const 1)) (then (local.set $track_len (i32.const 1))))
            (local.set $thumb_pos
              (i32.div_s
                (i32.mul (i32.sub (local.get $pos) (local.get $min)) (local.get $track_len))
                (local.get $range)))
            (local.set $cx (i32.div_s (local.get $w) (i32.const 2)))
            (drop (call $host_gdi_draw_edge (local.get $hdc)
                    (i32.sub (local.get $cx) (i32.const 2)) (i32.const 4)
                    (i32.add (local.get $cx) (i32.const 2)) (i32.sub (local.get $h) (i32.const 4))
                    (i32.const 0x0A) (i32.const 0x0F)))
            ;; Vertical Win9x mixer faders show evenly spaced tick marks on
            ;; both sides of the groove unless TBS_NOTICKS is requested.
            (if (i32.eqz (i32.and (local.get $style) (i32.const 0x0010)))
              (then
                (drop (call $host_gdi_fill_rect (local.get $hdc)
                        (i32.const 2) (i32.const 4) (i32.const 5) (i32.const 5)
                        (i32.const 0x30014)))
                (drop (call $host_gdi_fill_rect (local.get $hdc)
                        (i32.sub (local.get $w) (i32.const 5)) (i32.const 4)
                        (i32.sub (local.get $w) (i32.const 2)) (i32.const 5)
                        (i32.const 0x30014)))
                (drop (call $host_gdi_fill_rect (local.get $hdc)
                        (i32.const 2) (i32.div_u (local.get $h) (i32.const 2))
                        (i32.const 5) (i32.add (i32.div_u (local.get $h) (i32.const 2)) (i32.const 1))
                        (i32.const 0x30014)))
                (drop (call $host_gdi_fill_rect (local.get $hdc)
                        (i32.sub (local.get $w) (i32.const 5)) (i32.div_u (local.get $h) (i32.const 2))
                        (i32.sub (local.get $w) (i32.const 2))
                        (i32.add (i32.div_u (local.get $h) (i32.const 2)) (i32.const 1))
                        (i32.const 0x30014)))
                (drop (call $host_gdi_fill_rect (local.get $hdc)
                        (i32.const 2) (i32.sub (local.get $h) (i32.const 5))
                        (i32.const 5) (i32.sub (local.get $h) (i32.const 4))
                        (i32.const 0x30014)))
                (drop (call $host_gdi_fill_rect (local.get $hdc)
                        (i32.sub (local.get $w) (i32.const 5)) (i32.sub (local.get $h) (i32.const 5))
                        (i32.sub (local.get $w) (i32.const 2)) (i32.sub (local.get $h) (i32.const 4))
                        (i32.const 0x30014)))))
            (drop (call $host_gdi_fill_rect (local.get $hdc)
                    (i32.sub (local.get $cx) (i32.const 8)) (local.get $thumb_pos)
                    (i32.add (local.get $cx) (i32.const 8)) (i32.add (local.get $thumb_pos) (local.get $thumb_len))
                    (i32.const 0x30011)))
            (drop (call $host_gdi_draw_edge (local.get $hdc)
                    (i32.sub (local.get $cx) (i32.const 8)) (local.get $thumb_pos)
                    (i32.add (local.get $cx) (i32.const 8)) (i32.add (local.get $thumb_pos) (local.get $thumb_len))
                    (i32.const 0x05) (i32.const 0x0F))))
          (else
            (local.set $track_len (i32.sub (local.get $w) (local.get $thumb_len)))
            (if (i32.lt_s (local.get $track_len) (i32.const 1)) (then (local.set $track_len (i32.const 1))))
            (local.set $thumb_pos
              (i32.div_s
                (i32.mul (i32.sub (local.get $pos) (local.get $min)) (local.get $track_len))
                (local.get $range)))
            (local.set $cy (i32.div_s (local.get $h) (i32.const 2)))
            (drop (call $host_gdi_draw_edge (local.get $hdc)
                    (i32.const 4) (i32.sub (local.get $cy) (i32.const 2))
                    (i32.sub (local.get $w) (i32.const 4)) (i32.add (local.get $cy) (i32.const 2))
                    (i32.const 0x0A) (i32.const 0x0F)))
            ;; TBS_AUTOTICKS is the horizontal default. The Win98 control
            ;; chooses a readable interval as the range grows; ten divisions
            ;; reproduce that automatic density for Media Player's time line.
            (if (i32.eqz (i32.and (local.get $style) (i32.const 0x0010)))
              (then
                (local.set $i (i32.const 0))
                (block $ticks_done (loop $ticks
                  (br_if $ticks_done (i32.gt_u (local.get $i) (i32.const 10)))
                  (local.set $cx
                    (i32.add (i32.const 4)
                      (i32.div_u
                        (i32.mul (i32.sub (local.get $w) (i32.const 8)) (local.get $i))
                        (i32.const 10))))
                  (drop (call $host_gdi_fill_rect (local.get $hdc)
                    (local.get $cx) (i32.add (local.get $cy) (i32.const 9))
                    (i32.add (local.get $cx) (i32.const 1))
                    (i32.add (local.get $cy) (i32.const 11))
                    (i32.const 0x30014)))
                  (local.set $i (i32.add (local.get $i) (i32.const 1)))
                  (br $ticks)))))
            (drop (call $host_gdi_fill_rect (local.get $hdc)
                    (local.get $thumb_pos) (i32.sub (local.get $cy) (i32.const 8))
                    (i32.add (local.get $thumb_pos) (local.get $thumb_len)) (i32.add (local.get $cy) (i32.const 8))
                    (i32.const 0x30011)))
            (drop (call $host_gdi_draw_edge (local.get $hdc)
                    (local.get $thumb_pos) (i32.sub (local.get $cy) (i32.const 8))
                    (i32.add (local.get $thumb_pos) (local.get $thumb_len)) (i32.add (local.get $cy) (i32.const 8))
                    (i32.const 0x05) (i32.const 0x0F)))))
        (return (i32.const 0))))
    (i32.const 0))

  ;; Case-insensitive memcmp of $n bytes at WASM-linear $a / $b. Returns 1
  ;; if equal (treating ASCII A-Z and a-z as equivalent), 0 otherwise.
  ;; Used by LB_FINDSTRING / LB_FINDSTRINGEXACT.
  (func $listbox_strncmpi (param $a i32) (param $b i32) (param $n i32) (result i32)
    (local $ca i32) (local $cb i32)
    (block $done (loop $lp
      (br_if $done (i32.eqz (local.get $n)))
      (local.set $ca (i32.load8_u (local.get $a)))
      (local.set $cb (i32.load8_u (local.get $b)))
      (if (i32.and (i32.ge_u (local.get $ca) (i32.const 0x41))
                   (i32.le_u (local.get $ca) (i32.const 0x5A)))
        (then (local.set $ca (i32.or (local.get $ca) (i32.const 0x20)))))
      (if (i32.and (i32.ge_u (local.get $cb) (i32.const 0x41))
                   (i32.le_u (local.get $cb) (i32.const 0x5A)))
        (then (local.set $cb (i32.or (local.get $cb) (i32.const 0x20)))))
      (if (i32.ne (local.get $ca) (local.get $cb))
        (then (return (i32.const 0))))
      (local.set $a (i32.add (local.get $a) (i32.const 1)))
      (local.set $b (i32.add (local.get $b) (i32.const 1)))
      (local.set $n (i32.sub (local.get $n) (i32.const 1)))
      (br $lp)))
    (i32.const 1))

  ;; An owner-draw listbox gets its row height from the owner, not from us:
  ;; USER sends WM_MEASUREITEM and the owner fills in itemHeight. HyperTerminal
  ;; asks for a 32px row so a full icon fits; against our fixed 16 it drew each
  ;; icon 8px above the row it belonged to and the list came out empty-looking.
  ;;
  ;; MEASUREITEMSTRUCT: +0 CtlType, +4 CtlID, +8 itemID, +12 itemWidth,
  ;; +16 itemHeight, +20 itemData. We ask once, for item 0, which is exactly
  ;; right for LBS_OWNERDRAWFIXED; a VARIABLE listbox gets item 0's height for
  ;; every row, which is still far closer than ignoring the owner entirely.
  (func $lb_measure_item (param $hwnd i32) (param $sw i32) (result i32)
    (local $mis i32) (local $misw i32) (local $h i32)
    (local.set $mis (call $heap_alloc (i32.const 24)))
    (local.set $misw (call $g2w (local.get $mis)))
    (i32.store           (local.get $misw) (i32.const 2))   ;; ODT_LISTBOX
    (i32.store offset=4  (local.get $misw) (call $ctrl_table_get_id (local.get $hwnd)))
    (i32.store offset=8  (local.get $misw) (i32.const 0))
    (i32.store offset=12 (local.get $misw) (i32.const 0))
    (i32.store offset=16 (local.get $misw) (i32.const 16))
    (i32.store offset=20 (local.get $misw) (i32.const 0))
    (drop (call $wnd_send_message
            (call $wnd_get_parent (local.get $hwnd))
            (i32.const 0x002C)
            (call $ctrl_table_get_id (local.get $hwnd))
            (local.get $mis)))
    (local.set $h (i32.load offset=16 (local.get $misw)))
    (call $heap_free (local.get $mis))
    ;; An owner that ignores the message leaves our 16 in place; one that
    ;; answers with nonsense must not divide the row loop by zero.
    (if (i32.or (i32.lt_s (local.get $h) (i32.const 1))
                (i32.gt_s (local.get $h) (i32.const 255)))
      (then (local.set $h (i32.const 16))))
    (local.get $h))

  ;; An LBS_OWNERDRAW* listbox draws none of its own rows: USER hands each
  ;; visible item to the owner as WM_DRAWITEM and the owner paints it. Without
  ;; this we fell through to $host_gdi_text_out on the item string, which for
  ;; such a listbox is not a label at all -- HyperTerminal's icon picker stores
  ;; "Hilgraeve is Great !!!" in every slot and paints the icon from itemData,
  ;; so the dialog came up with the same joke string repeated down the list.
  ;;
  ;; Modelled on $btn_send_drawitem: DRAWITEMSTRUCT is 48 bytes on the heap,
  ;; sent synchronously, then freed. The rect is in the listbox's own client
  ;; coordinates, which is what the child DC (hwnd + 0x40000) is already based
  ;; on, so no translation is needed.
  (func $lb_send_drawitem
      (param $hwnd i32) (param $sw i32) (param $idx i32)
      (param $row_y i32) (param $w i32) (param $row_h i32) (param $selected i32)
    (local $dis i32) (local $disw i32) (local $hdc i32) (local $data i32)
    (local.set $hdc (i32.add (local.get $hwnd) (i32.const 0x40000)))
    ;; itemData is whatever LB_SETITEMDATA stored; a listbox that was never
    ;; given any keeps the field zero rather than reading off the null array.
    (if (call $lb_data_ptr (local.get $sw))
      (then
        (local.set $data
          (i32.load (i32.add (call $g2w (call $lb_data_ptr (local.get $sw)))
                             (i32.mul (local.get $idx) (i32.const 4)))))))
    (local.set $dis (call $heap_alloc (i32.const 48)))
    (local.set $disw (call $g2w (local.get $dis)))
    (i32.store           (local.get $disw) (i32.const 2))    ;; ODT_LISTBOX
    (i32.store offset=4  (local.get $disw) (call $ctrl_table_get_id (local.get $hwnd)))
    (i32.store offset=8  (local.get $disw) (local.get $idx))
    (i32.store offset=12 (local.get $disw) (i32.const 1))     ;; ODA_DRAWENTIRE
    (i32.store offset=16 (local.get $disw)
      (select (i32.const 0x0001) (i32.const 0) (local.get $selected)))
    (i32.store offset=20 (local.get $disw) (local.get $hwnd))
    (i32.store offset=24 (local.get $disw) (local.get $hdc))
    (i32.store offset=28 (local.get $disw) (i32.const 2))
    (i32.store offset=32 (local.get $disw) (local.get $row_y))
    (i32.store offset=36 (local.get $disw) (local.get $w))
    (i32.store offset=40 (local.get $disw) (i32.add (local.get $row_y) (local.get $row_h)))
    (i32.store offset=44 (local.get $disw) (local.get $data))
    (drop (call $wnd_send_message
            (call $wnd_get_parent (local.get $hwnd))
            (i32.const 0x002B)
            (call $ctrl_table_get_id (local.get $hwnd))
            (local.get $dis)))
    (call $heap_free (local.get $dis)))

  ;; ============================================================
  ;; ListBox WndProc  (control class 4)
  ;; ============================================================
  ;;
  ;; ListBoxState (52 bytes, allocated in WM_CREATE)
  ;;   +0   items_buf_ptr    guest ptr to flat NUL-separated string buffer
  ;;                         ("item1\0item2\0item3\0", or 0 if empty)
  ;;   +4   items_used       bytes in items_buf actually used (incl. NULs)
  ;;   +8   items_cap        bytes allocated for items_buf
  ;;   +12  count            number of items
  ;;   +16  cur_sel          current selection (-1 = none)
  ;;   +20  top_index        first visible row (vertical scroll)
  ;;   +24  drag_anchor_y
  ;;   +28  drag_anchor_top
  ;;   +32  data_buf_ptr     guest ptr to u32[] parallel item-data array (LB_SETITEMDATA)
  ;;   +36  data_cap         capacity of data array, in u32 slots
  ;;   +40  sel_buf_ptr      guest ptr to u8[] multi-selection flags
  ;;   +44  sel_cap          capacity of selection array, in bytes
  ;;   +48  item_h           owner-draw row height, 0 = default
  ;; The control id is NOT in the record: $ctrl_table_get_id($hwnd).
  ;;
  ;; Items are stored as concatenated NUL-terminated strings. LB_ADDSTRING
  ;; appends; LB_RESETCONTENT zeros count + items_used (keeps the buffer for
  ;; reuse). LB_GETTEXT walks NULs to find item N. There's no per-item index
  ;; array — for the workloads we care about (file dialogs, font picker)
  ;; the count is small enough that linear walks are cheap.
  ;;
  ;; Click → set cur_sel + post WM_COMMAND (HIWORD=LBN_SELCHANGE=1, LOWORD=ctrl_id).
  ;; Double-click → post WM_COMMAND (HIWORD=LBN_DBLCLK=2). Item height = 16px.
  ;;
  ;; Drawing is done by the renderer (lib/renderer.js _drawWatChildren) via
  ;; the listbox_get_* exports. WM_PAINT here is a no-op (the WAT control
  ;; pipeline doesn't go through WM_PAINT — drawing is GDI-bypass).
  (func $listbox_wndproc (param $hwnd i32) (param $msg i32) (param $wParam i32) (param $lParam i32) (result i32)
    (local $state i32) (local $sw i32) (local $cs_w i32)
    (local $items i32) (local $items_w i32) (local $used i32) (local $cap i32)
    (local $count i32) (local $idx i32) (local $i i32) (local $p i32)
    (local $src_g i32) (local $src_w i32) (local $slen i32)
    (local $need i32) (local $new_buf i32) (local $new_w i32)
    (local $dest_g i32) (local $dest_w i32) (local $max i32)
    (local $row i32) (local $parent i32) (local $notif i32) (local $sz i32)
    (local $w i32) (local $h i32) (local $hdc i32) (local $sel i32)
    (local $top i32) (local $visible i32) (local $row_y i32) (local $row_h i32)
    (local $brush i32)
    (local $find_handle i32) (local $fd_g i32) (local $fd_w i32) (local $attrs i32)
    (local $last i32) (local $tmp_g i32) (local $tmp_w i32)
    (local $ownerdraw i32) (local $code i32) (local $delta i32)

    (local.set $state (call $wnd_get_state_ptr (local.get $hwnd)))

    ;; ---------- WM_SETFOCUS (0x0007) / WM_KILLFOCUS (0x0008) ----------
    ;; LBN_SETFOCUS(4) / LBN_KILLFOCUS(5) to the parent. A combobox's dropdown
    ;; list is one of these, and its parent combo turns the pair back into
    ;; CBN_SETFOCUS/CBN_KILLFOCUS — the notification WordPad's format bar
    ;; applies the picked font on.
    (if (i32.or (i32.eq (local.get $msg) (i32.const 0x0007))
                (i32.eq (local.get $msg) (i32.const 0x0008)))
      (then
        (if (i32.eq (local.get $msg) (i32.const 0x0007))
          (then (global.set $focus_hwnd (local.get $hwnd)))
          (else
            (if (i32.eq (global.get $focus_hwnd) (local.get $hwnd))
              (then (global.set $focus_hwnd (i32.const 0))))))
        (if (local.get $state)
          (then
            (local.set $sw (call $g2w (local.get $state)))
            (local.set $parent (call $wnd_get_parent (local.get $hwnd)))
            (if (local.get $parent)
              (then (drop (call $wnd_send_message (local.get $parent) (i32.const 0x0111)
                      (i32.or (i32.and (call $ctrl_table_get_id (local.get $hwnd)) (i32.const 0xFFFF))
                              (i32.shl (select (i32.const 4) (i32.const 5)
                                         (i32.eq (local.get $msg) (i32.const 0x0007)))
                                       (i32.const 16)))
                      (local.get $hwnd)))))))
        (call $invalidate_hwnd (local.get $hwnd))
        (return (i32.const 0))))

    ;; ---------- WM_CREATE (0x0001) ----------
    (if (i32.eq (local.get $msg) (i32.const 0x0001))
      (then
        (local.set $cs_w (call $g2w (local.get $lParam)))
        (local.set $state (call $heap_alloc (i32.const 52)))
        (local.set $sw (call $g2w (local.get $state)))
        (call $lb_set_item_h (local.get $sw) (i32.const 0))
        (call $lb_set_items_ptr (local.get $sw) (i32.const 0))
        (call $lb_set_items_used (local.get $sw) (i32.const 0))
        (call $lb_set_items_cap (local.get $sw) (i32.const 0))
        (call $lb_set_count (local.get $sw) (i32.const 0))
        (call $lb_set_cur_sel (local.get $sw) (i32.const -1))
        (call $lb_set_top_index (local.get $sw) (i32.const 0))
        ;; CREATESTRUCT.hMenu is not copied in: it is already CONTROL_TABLE+4.
        (call $lb_set_drag_anchor_y (local.get $sw) (i32.const 0))
        (call $lb_set_drag_anchor_top (local.get $sw) (i32.const 0))
        (call $lb_set_data_ptr (local.get $sw) (i32.const 0))
        (call $lb_set_data_cap (local.get $sw) (i32.const 0))
        (call $lb_set_sel_ptr (local.get $sw) (i32.const 0))
        (call $lb_set_sel_cap (local.get $sw) (i32.const 0))
        (call $wnd_set_state_ptr (local.get $hwnd) (local.get $state))
        (return (i32.const 0))))

    ;; ---------- WM_DESTROY (0x0002) ----------
    (if (i32.eq (local.get $msg) (i32.const 0x0002))
      (then
        (if (local.get $state)
          (then
            (local.set $sw (call $g2w (local.get $state)))
            (call $heap_free (call $lb_items_ptr (local.get $sw)))
            (call $heap_free (call $lb_data_ptr (local.get $sw)))
            (call $heap_free (call $lb_sel_ptr (local.get $sw)))
            (call $heap_free (local.get $state))
            (call $wnd_set_state_ptr (local.get $hwnd) (i32.const 0))))
        (return (i32.const 0))))

    (if (i32.eqz (local.get $state)) (then (return (i32.const 0))))
    (local.set $sw (call $g2w (local.get $state)))

    ;; ---------- LB_ADDSTRING (0x0180) ----------
    ;; Without LBS_HASSTRINGS, owner-draw lists receive item data rather than text.
    (if (i32.eq (local.get $msg) (i32.const 0x0180))
      (then
        (local.set $ownerdraw (i32.and (i32.ne (i32.and (call $wnd_get_style (local.get $hwnd)) (i32.const 0x0030)) (i32.const 0)) (i32.eqz (i32.and (call $wnd_get_style (local.get $hwnd)) (i32.const 0x0040))))) (local.set $slen (i32.const 0))
        (if (i32.eqz (local.get $ownerdraw)) (then (local.set $src_g (local.get $lParam))
          (if (i32.eqz (local.get $src_g)) (then (return (i32.const -1))))
          (local.set $src_w (call $g2w (local.get $src_g)))
          (local.set $slen (call $strlen (local.get $src_w)))))
        (local.set $used (call $lb_items_used (local.get $sw)))
        (local.set $cap  (call $lb_items_cap (local.get $sw)))
        (local.set $need (i32.add (local.get $used) (i32.add (local.get $slen) (i32.const 1))))
        ;; Grow buffer if needed: alloc max(256, need*2), copy old, free old.
        (if (i32.gt_u (local.get $need) (local.get $cap))
          (then
            (local.set $cap (i32.mul (local.get $need) (i32.const 2)))
            (if (i32.lt_u (local.get $cap) (i32.const 256))
              (then (local.set $cap (i32.const 256))))
            (local.set $new_buf (call $heap_alloc (local.get $cap)))
            (local.set $new_w (call $g2w (local.get $new_buf)))
            (if (local.get $used)
              (then (call $memcpy (local.get $new_w)
                                  (call $g2w (call $lb_items_ptr (local.get $sw)))
                                  (local.get $used))))
            (call $heap_free (call $lb_items_ptr (local.get $sw)))
            (call $lb_set_items_ptr (local.get $sw) (local.get $new_buf))
            (call $lb_set_items_cap (local.get $sw) (local.get $cap))))
        ;; Append the new string + NUL at items[used].
        (local.set $items_w (call $g2w (call $lb_items_ptr (local.get $sw))))
        (call $memcpy (i32.add (local.get $items_w) (local.get $used))
                      (local.get $src_w) (local.get $slen))
        (i32.store8 (i32.add (i32.add (local.get $items_w) (local.get $used)) (local.get $slen))
                    (i32.const 0))
        (local.set $count (call $lb_count (local.get $sw)))
        (call $lb_set_items_used (local.get $sw)
          (i32.add (local.get $used) (i32.add (local.get $slen) (i32.const 1))))
        (call $lb_set_count (local.get $sw) (i32.add (local.get $count) (i32.const 1)))
        ;; Grow parallel data array; no-string owner-draw items start with lParam.
        (local.set $cap (call $lb_data_cap (local.get $sw)))
        (if (i32.ge_u (local.get $count) (local.get $cap))
          (then
            (local.set $cap (i32.mul (i32.add (local.get $count) (i32.const 1)) (i32.const 2)))
            (if (i32.lt_u (local.get $cap) (i32.const 16))
              (then (local.set $cap (i32.const 16))))
            (local.set $new_buf (call $heap_alloc (i32.mul (local.get $cap) (i32.const 4))))
            (local.set $new_w (call $g2w (local.get $new_buf)))
            (if (local.get $count)
              (then (call $memcpy (local.get $new_w)
                                  (call $g2w (call $lb_data_ptr (local.get $sw)))
                                  (i32.mul (local.get $count) (i32.const 4)))))
            (call $heap_free (call $lb_data_ptr (local.get $sw)))
            (call $lb_set_data_ptr (local.get $sw) (local.get $new_buf))
            (call $lb_set_data_cap (local.get $sw) (local.get $cap))))
        (i32.store
          (i32.add (call $g2w (call $lb_data_ptr (local.get $sw)))
                   (i32.mul (local.get $count) (i32.const 4)))
          (select (local.get $lParam) (i32.const 0) (local.get $ownerdraw)))
        ;; Grow the byte-per-row multi-selection array in parallel.
        (local.set $cap (call $lb_sel_cap (local.get $sw)))
        (if (i32.ge_u (local.get $count) (local.get $cap))
          (then
            (local.set $cap (i32.mul (i32.add (local.get $count) (i32.const 1)) (i32.const 2)))
            (if (i32.lt_u (local.get $cap) (i32.const 16))
              (then (local.set $cap (i32.const 16))))
            (local.set $new_buf (call $heap_alloc (local.get $cap)))
            (local.set $new_w (call $g2w (local.get $new_buf)))
            (if (local.get $count)
              (then (call $memcpy (local.get $new_w)
                                  (call $g2w (call $lb_sel_ptr (local.get $sw)))
                                  (local.get $count))))
            (call $heap_free (call $lb_sel_ptr (local.get $sw)))
            (call $lb_set_sel_ptr (local.get $sw) (local.get $new_buf))
            (call $lb_set_sel_cap (local.get $sw) (local.get $cap))))
        (i32.store8
          (i32.add (call $g2w (call $lb_sel_ptr (local.get $sw))) (local.get $count))
          (i32.const 0))
        (call $invalidate_hwnd (local.get $hwnd))
        (return (local.get $count))))  ;; index of newly inserted item

    ;; ---------- LB_RESETCONTENT (0x0184) ----------
    (if (i32.eq (local.get $msg) (i32.const 0x0184))
      (then
        (call $lb_set_items_used (local.get $sw) (i32.const 0))
        (call $lb_set_count (local.get $sw) (i32.const 0))
        (call $lb_set_cur_sel (local.get $sw) (i32.const -1))
        (call $lb_set_top_index (local.get $sw) (i32.const 0))
        (local.set $p (call $g2w (call $lb_sel_ptr (local.get $sw))))
        (local.set $i (i32.const 0))
        (block $reset_sel_done (loop $reset_sel
          (br_if $reset_sel_done (i32.ge_u (local.get $i) (call $lb_sel_cap (local.get $sw))))
          (i32.store8 (i32.add (local.get $p) (local.get $i)) (i32.const 0))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $reset_sel)))
        (call $invalidate_hwnd (local.get $hwnd))
        (return (i32.const 0))))

    ;; ---------- LB_DIR (0x018D) ----------
    ;; wParam = DDL_* attribute flags, lParam = wildcard path. Adds matching
    ;; files to the listbox and, when DDL_DIRECTORY is set, matching
    ;; directories too. Returns the last inserted index or LB_ERR(-1).
    (if (i32.eq (local.get $msg) (i32.const 0x018D))
      (then
        (if (i32.eqz (local.get $lParam)) (then (return (i32.const -1))))
        (local.set $fd_g (call $heap_alloc (i32.const 320)))
        (local.set $fd_w (call $g2w (local.get $fd_g)))
        (local.set $tmp_g (call $heap_alloc (i32.const 280)))
        (local.set $tmp_w (call $g2w (local.get $tmp_g)))
        (local.set $last (i32.const -1))
        (local.set $find_handle (call $host_fs_find_first_file
          (call $g2w (local.get $lParam)) (local.get $fd_g) (i32.const 0)))
        (if (i32.eq (local.get $find_handle) (i32.const -1))
          (then
            (call $heap_free (local.get $tmp_g))
            (call $heap_free (local.get $fd_g))
            (return (i32.const -1))))
        (block $lbdir_done (loop $lbdir_loop
          (local.set $attrs (i32.load (local.get $fd_w)))
          (if (i32.or
                (i32.eqz (i32.and (local.get $attrs) (i32.const 0x10)))
                (i32.and (local.get $wParam) (i32.const 0x10)))
            (then
              (local.set $slen (call $strlen (i32.add (local.get $fd_w) (i32.const 44))))
              (call $memcpy (local.get $tmp_w)
                            (i32.add (local.get $fd_w) (i32.const 44))
                            (local.get $slen))
              (i32.store8 (i32.add (local.get $tmp_w) (local.get $slen)) (i32.const 0))
              (local.set $last (call $listbox_wndproc (local.get $hwnd)
                (i32.const 0x0180) (i32.const 0)
                (local.get $tmp_g)))))
          (br_if $lbdir_done (i32.eqz (call $host_fs_find_next_file
                                        (local.get $find_handle)
                                        (local.get $fd_g)
                                        (i32.const 0))))
          (br $lbdir_loop)))
        (drop (call $host_fs_find_close (local.get $find_handle)))
        (call $heap_free (local.get $tmp_g))
        (call $heap_free (local.get $fd_g))
        (return (local.get $last))))

    ;; ---------- LB_GETCOUNT (0x018B) ----------
    (if (i32.eq (local.get $msg) (i32.const 0x018B))
      (then (return (call $lb_count (local.get $sw)))))

    ;; ---------- LB_GETCURSEL (0x0188) ----------
    (if (i32.eq (local.get $msg) (i32.const 0x0188))
      (then (return (call $lb_cur_sel (local.get $sw)))))

    ;; ---------- LB_SETSEL (0x0185) / LB_GETSEL (0x0187) ----------
    (if (i32.eq (local.get $msg) (i32.const 0x0185))
      (then
        (local.set $idx (local.get $lParam))
        (local.set $count (call $lb_count (local.get $sw)))
        (if (i32.eq (local.get $idx) (i32.const -1))
          (then
            (local.set $i (i32.const 0))
            (block $set_all_done (loop $set_all
              (br_if $set_all_done (i32.ge_u (local.get $i) (local.get $count)))
              (i32.store8
                (i32.add (call $g2w (call $lb_sel_ptr (local.get $sw))) (local.get $i))
                (i32.ne (local.get $wParam) (i32.const 0)))
              (local.set $i (i32.add (local.get $i) (i32.const 1)))
              (br $set_all))))
          (else
            (if (i32.or (i32.lt_s (local.get $idx) (i32.const 0))
                        (i32.ge_s (local.get $idx) (local.get $count)))
              (then (return (i32.const -1))))
            (i32.store8
              (i32.add (call $g2w (call $lb_sel_ptr (local.get $sw))) (local.get $idx))
              (i32.ne (local.get $wParam) (i32.const 0)))))
        (call $invalidate_hwnd (local.get $hwnd))
        (return (i32.const 0))))

    (if (i32.eq (local.get $msg) (i32.const 0x0187))
      (then
        (local.set $idx (local.get $wParam))
        (local.set $count (call $lb_count (local.get $sw)))
        (if (i32.or (i32.lt_s (local.get $idx) (i32.const 0))
                    (i32.ge_s (local.get $idx) (local.get $count)))
          (then (return (i32.const -1))))
        (if (call $lb_sel_ptr (local.get $sw))
          (then (return (i32.load8_u
            (i32.add (call $g2w (call $lb_sel_ptr (local.get $sw))) (local.get $idx))))))
        (return (i32.eq (local.get $idx) (call $lb_cur_sel (local.get $sw))))))

    ;; ---------- LB_GETSELCOUNT (0x0190) / LB_GETSELITEMS (0x0191) ----------
    (if (i32.or (i32.eq (local.get $msg) (i32.const 0x0190))
                (i32.eq (local.get $msg) (i32.const 0x0191)))
      (then
        (local.set $count (call $lb_count (local.get $sw)))
        (local.set $i (i32.const 0))
        (local.set $sel (i32.const 0))
        (if (i32.eq (local.get $msg) (i32.const 0x0191))
          (then (local.set $dest_w (call $g2w (local.get $lParam)))))
        (block $get_sels_done (loop $get_sels
          (br_if $get_sels_done (i32.ge_u (local.get $i) (local.get $count)))
          (if (i32.load8_u
                (i32.add (call $g2w (call $lb_sel_ptr (local.get $sw))) (local.get $i)))
            (then
              (if (i32.eq (local.get $msg) (i32.const 0x0191))
                (then
                  (br_if $get_sels_done (i32.ge_u (local.get $sel) (local.get $wParam)))
                  (i32.store
                    (i32.add (local.get $dest_w) (i32.mul (local.get $sel) (i32.const 4)))
                    (local.get $i))))
              (local.set $sel (i32.add (local.get $sel) (i32.const 1)))))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $get_sels)))
        (return (local.get $sel))))

    ;; ---------- LB_GETITEMHEIGHT (0x01A1) ----------
    ;; The Win98 default 16px row, or whatever an owner-draw listbox's owner
    ;; asked for in WM_MEASUREITEM.
    (if (i32.eq (local.get $msg) (i32.const 0x01A1))
      (then (return (call $lb_row_height (local.get $sw)))))

    ;; ---------- LB_GETITEMRECT (0x0198) ----------
    ;; Return the row bounds in listbox client coordinates. Rows scrolled
    ;; above the viewport intentionally have negative top/bottom values.
    (if (i32.eq (local.get $msg) (i32.const 0x0198))
      (then
        (local.set $idx (local.get $wParam))
        (local.set $count (call $lb_count (local.get $sw)))
        (if (i32.or
              (i32.or (i32.lt_s (local.get $idx) (i32.const 0))
                      (i32.ge_s (local.get $idx) (local.get $count)))
              (i32.eqz (local.get $lParam)))
          (then (return (i32.const -1))))
        (local.set $row_h (call $lb_row_height (local.get $sw)))
        (local.set $row_y
          (i32.mul
            (i32.sub (local.get $idx) (call $lb_top_index (local.get $sw)))
            (local.get $row_h)))
        (local.set $w
          (i32.and (call $ctrl_get_wh_packed (local.get $hwnd))
                   (i32.const 0xFFFF)))
        (local.set $dest_w (call $g2w (local.get $lParam)))
        (i32.store           (local.get $dest_w) (i32.const 0))
        (i32.store offset=4  (local.get $dest_w) (local.get $row_y))
        (i32.store offset=8  (local.get $dest_w) (local.get $w))
        (i32.store offset=12 (local.get $dest_w)
          (i32.add (local.get $row_y) (local.get $row_h)))
        (return (i32.const 0))))

    ;; ---------- LB_ITEMFROMPOINT (0x01A9) ----------
    ;; LOWORD is the nearest item; HIWORD reports whether the point lies
    ;; outside the listbox client area. This remains distinct from whether the
    ;; point lies below the final populated row.
    (if (i32.eq (local.get $msg) (i32.const 0x01A9))
      (then
        (local.set $count (call $lb_count (local.get $sw)))
        (if (i32.eqz (local.get $count))
          (then (return (i32.const 0x0000FFFF))))
        (local.set $w (i32.extend16_s (local.get $lParam)))
        (local.set $h
          (i32.extend16_s
            (i32.shr_u (local.get $lParam) (i32.const 16))))
        (local.set $sz (call $ctrl_get_wh_packed (local.get $hwnd)))
        (local.set $code
          (i32.or
            (i32.or (i32.lt_s (local.get $w) (i32.const 0))
                    (i32.lt_s (local.get $h) (i32.const 0)))
            (i32.or
              (i32.ge_s (local.get $w)
                (i32.and (local.get $sz) (i32.const 0xFFFF)))
              (i32.ge_s (local.get $h)
                (i32.shr_u (local.get $sz) (i32.const 16))))))
        (local.set $row_h (call $lb_row_height (local.get $sw)))
        (local.set $idx (call $lb_top_index (local.get $sw)))
        (if (i32.gt_s (local.get $h) (i32.const 0))
          (then
            (local.set $idx
              (i32.add (local.get $idx)
                (i32.div_s (local.get $h) (local.get $row_h))))))
        (if (i32.lt_s (local.get $idx) (i32.const 0))
          (then (local.set $idx (i32.const 0))))
        (if (i32.ge_s (local.get $idx) (local.get $count))
          (then (local.set $idx (i32.sub (local.get $count) (i32.const 1)))))
        (return
          (i32.or
            (i32.and (local.get $idx) (i32.const 0xFFFF))
            (i32.shl (local.get $code) (i32.const 16))))))

    ;; ---------- LB_SETCURSEL (0x0186) ----------
    ;; wParam = index (-1 to clear). Clamp to count-1 if out of range.
    (if (i32.eq (local.get $msg) (i32.const 0x0186))
      (then
        (local.set $idx (local.get $wParam))
        (local.set $count (call $lb_count (local.get $sw)))
        (if (i32.ge_s (local.get $idx) (local.get $count))
          (then (local.set $idx (i32.const -1))))
        (call $lb_set_cur_sel (local.get $sw) (local.get $idx))
        ;; Programmatic selection follows USER: make the selected row visible.
        (if (i32.ge_s (local.get $idx) (i32.const 0))
          (then
            (local.set $top (call $lb_top_index (local.get $sw)))
            (local.set $visible (call $listbox_visible_rows (local.get $hwnd) (local.get $sw)))
            (if (i32.lt_s (local.get $idx) (local.get $top))
              (then (drop (call $listbox_scroll_to
                (local.get $hwnd) (local.get $sw) (local.get $idx))))
              (else
                (if (i32.ge_s (local.get $idx) (i32.add (local.get $top) (local.get $visible)))
                  (then (drop (call $listbox_scroll_to
                    (local.get $hwnd) (local.get $sw)
                    (i32.sub (i32.add (local.get $idx) (i32.const 1)) (local.get $visible))))))))))
        (local.set $i (i32.const 0))
        (block $setcur_clear_done (loop $setcur_clear
          (br_if $setcur_clear_done (i32.ge_u (local.get $i) (local.get $count)))
          (i32.store8 (i32.add (call $g2w (call $lb_sel_ptr (local.get $sw))) (local.get $i))
            (i32.eq (local.get $i) (local.get $idx)))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $setcur_clear)))
        (call $invalidate_hwnd (local.get $hwnd))
        (return (local.get $idx))))

    ;; ---------- LB_GETTEXT (0x0189) ----------
    ;; wParam = index, lParam = guest dest buffer. Returns chars copied (excl NUL),
    ;; or LB_ERR(-1) if index out of range.
    (if (i32.eq (local.get $msg) (i32.const 0x0189))
      (then
        (local.set $idx (local.get $wParam))
        (local.set $count (call $lb_count (local.get $sw)))
        (if (i32.or (i32.lt_s (local.get $idx) (i32.const 0))
                    (i32.ge_s (local.get $idx) (local.get $count)))
          (then (return (i32.const -1))))
        ;; Walk NUL-separated buffer to item $idx.
        (local.set $items_w (call $g2w (call $lb_items_ptr (local.get $sw))))
        (local.set $p (local.get $items_w))
        (local.set $i (i32.const 0))
        (block $found (loop $skip
          (br_if $found (i32.eq (local.get $i) (local.get $idx)))
          (local.set $p (i32.add (local.get $p)
                          (i32.add (call $strlen (local.get $p)) (i32.const 1))))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $skip)))
        (local.set $slen (call $strlen (local.get $p)))
        (local.set $dest_w (call $g2w (local.get $lParam)))
        (call $memcpy (local.get $dest_w) (local.get $p) (local.get $slen))
        (i32.store8 (i32.add (local.get $dest_w) (local.get $slen)) (i32.const 0))
        (return (local.get $slen))))

    ;; ---------- LB_GETTEXTLEN (0x018A) ----------
    (if (i32.eq (local.get $msg) (i32.const 0x018A))
      (then
        (local.set $idx (local.get $wParam))
        (local.set $count (call $lb_count (local.get $sw)))
        (if (i32.or (i32.lt_s (local.get $idx) (i32.const 0))
                    (i32.ge_s (local.get $idx) (local.get $count)))
          (then (return (i32.const -1))))
        (local.set $items_w (call $g2w (call $lb_items_ptr (local.get $sw))))
        (local.set $p (local.get $items_w))
        (local.set $i (i32.const 0))
        (block $found2 (loop $skip2
          (br_if $found2 (i32.eq (local.get $i) (local.get $idx)))
          (local.set $p (i32.add (local.get $p)
                          (i32.add (call $strlen (local.get $p)) (i32.const 1))))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $skip2)))
        (return (call $strlen (local.get $p)))))

    ;; ---------- WM_LBUTTONDOWN (0x0201) / WM_LBUTTONDBLCLK (0x0203) ----------
    ;; lParam = MAKELPARAM(x, y) within the listbox client. Compute row =
    ;; top_index + y/item-height. Blank client rows do not select an item.
    ;; with notification = LBN_SELCHANGE (single click) or LBN_DBLCLK (dbl).
    (if (i32.or (i32.eq (local.get $msg) (i32.const 0x0201))
                (i32.eq (local.get $msg) (i32.const 0x0203)))
      (then
        (local.set $count (call $lb_count (local.get $sw)))
        ;; --- visible WS_VSCROLL strip hit-test (arrows only) ---
        ;; If the click lands in the right-edge 16px scrollbar strip, adjust
        ;; top_index and short-circuit before the row-select path.
        (if (call $listbox_vscroll_visible (local.get $hwnd) (local.get $sw))
          (then
            (local.set $sz (call $ctrl_get_wh_packed (local.get $hwnd)))
            (local.set $w (i32.and (local.get $sz) (i32.const 0xFFFF)))
            (local.set $h (i32.shr_u (local.get $sz) (i32.const 16)))
            (local.set $row (i32.shr_s (i32.shl (local.get $lParam) (i32.const 16)) (i32.const 16)))
            (local.set $row_y (i32.shr_s (local.get $lParam) (i32.const 16)))
            (if (i32.ge_s (local.get $row) (i32.sub (local.get $w) (i32.const 16)))
              (then
                ;; visible rows based on strip-reduced client
                (local.set $visible (i32.div_u (i32.sub (local.get $h) (i32.const 4)) (call $lb_row_height (local.get $sw))))
                (local.set $top (call $lb_top_index (local.get $sw)))
                (local.set $max (i32.sub (local.get $count) (local.get $visible)))
                (if (i32.lt_s (local.get $max) (i32.const 0))
                  (then (local.set $max (i32.const 0))))
                ;; A disabled arrow still owns its rectangle; consume the
                ;; click without turning it into a page hit or a row select.
                (if (i32.and
                      (i32.lt_s (local.get $row_y) (i32.const 16))
                      (i32.ne (i32.and
                        (call $scroll_arrow_mask (local.get $hwnd) (i32.const 1))
                        (i32.const 1)) (i32.const 0)))
                  (then (return (i32.const 0))))
                (if (i32.and
                      (i32.ge_s (local.get $row_y)
                        (i32.sub (local.get $h) (i32.const 16)))
                      (i32.ne (i32.and
                        (call $scroll_arrow_mask (local.get $hwnd) (i32.const 1))
                        (i32.const 2)) (i32.const 0)))
                  (then (return (i32.const 0))))
                (if (i32.lt_s (local.get $row_y) (i32.const 16))
                  (then ;; up arrow
                    (if (i32.gt_s (local.get $top) (i32.const 0))
                      (then (call $lb_set_top_index (local.get $sw)
                              (i32.sub (local.get $top) (i32.const 1)))))
                    (global.set $sb_pressed_hwnd (local.get $hwnd))
                    (global.set $sb_pressed_part (i32.const 1)))
                  (else (if (i32.ge_s (local.get $row_y) (i32.sub (local.get $h) (i32.const 16)))
                    (then ;; down arrow
                      (if (i32.lt_s (local.get $top) (local.get $max))
                        (then (call $lb_set_top_index (local.get $sw)
                                (i32.add (local.get $top) (i32.const 1)))))
                      (global.set $sb_pressed_hwnd (local.get $hwnd))
                      (global.set $sb_pressed_part (i32.const 2)))
                    (else ;; track click — page or thumb-drag start
                      (if (i32.gt_s (local.get $max) (i32.const 0))
                        (then
                          (if (i32.eq
                                (call $listbox_page_hit
                                  (local.get $hwnd) (local.get $sw)
                                  (local.get $row_y) (local.get $h)
                                  (local.get $top) (local.get $max)
                                  (local.get $visible))
                                (i32.const 3))
                            (then
                              ;; Thumb hit — take mouse capture so WM_MOUSEMOVE
                              ;; and WM_LBUTTONUP are routed to this listbox
                              ;; even when the cursor leaves it. sb_pressed
                              ;; drives the thumb-pressed paint visual.
                              (global.set $capture_hwnd (local.get $hwnd))
                              (global.set $sb_pressed_hwnd (local.get $hwnd))
                              (global.set $sb_pressed_part (i32.const 5))))))))))
                (drop (call $wnd_send_message
                  (local.get $hwnd) (i32.const 0x000F) (i32.const 0) (i32.const 0)))
                (call $invalidate_hwnd (local.get $hwnd))
                (return (i32.const 0))))))
        (if (i32.eqz (local.get $count)) (then (return (i32.const 0))))
        ;; Signed y from the high word; ignore points outside populated rows.
        (local.set $row_y (i32.shr_s (local.get $lParam) (i32.const 16)))
        (if (i32.lt_s (local.get $row_y) (i32.const 0)) (then (return (i32.const 0))))
        (local.set $row (i32.div_s (local.get $row_y) (call $lb_row_height (local.get $sw))))
        (local.set $row (i32.add (local.get $row) (call $lb_top_index (local.get $sw))))
        (if (i32.ge_s (local.get $row) (local.get $count))
          (then (return (i32.const 0))))
        (if (i32.and (call $wnd_get_style (local.get $hwnd)) (i32.const 0x00000800))
          (then
            ;; LBS_EXTENDEDSEL: Ctrl toggles a row; Shift selects the range
            ;; from the previous caret; an unmodified click replaces all.
            (local.set $sel (call $lb_cur_sel (local.get $sw)))
            (if (i32.and (local.get $wParam) (i32.const 0x0008)) ;; MK_CONTROL
              (then
                (i32.store8
                  (i32.add (call $g2w (call $lb_sel_ptr (local.get $sw))) (local.get $row))
                  (i32.eqz (i32.load8_u
                    (i32.add (call $g2w (call $lb_sel_ptr (local.get $sw))) (local.get $row))))))
              (else
                (local.set $i (i32.const 0))
                (block $click_sel_done (loop $click_sel
                  (br_if $click_sel_done (i32.ge_u (local.get $i) (local.get $count)))
                  (if (i32.and (local.get $wParam) (i32.const 0x0004)) ;; MK_SHIFT
                    (then
                      (i32.store8
                        (i32.add (call $g2w (call $lb_sel_ptr (local.get $sw))) (local.get $i))
                        (i32.or
                          (i32.and (i32.ge_s (local.get $i) (local.get $sel))
                                   (i32.le_s (local.get $i) (local.get $row)))
                          (i32.and (i32.ge_s (local.get $i) (local.get $row))
                                   (i32.le_s (local.get $i) (local.get $sel))))))
                    (else
                      (i32.store8
                        (i32.add (call $g2w (call $lb_sel_ptr (local.get $sw))) (local.get $i))
                        (i32.eq (local.get $i) (local.get $row)))))
                  (local.set $i (i32.add (local.get $i) (i32.const 1)))
                  (br $click_sel))))))
          (else
            (local.set $i (i32.const 0))
            (block $click_single_done (loop $click_single
              (br_if $click_single_done (i32.ge_u (local.get $i) (local.get $count)))
              (i32.store8
                (i32.add (call $g2w (call $lb_sel_ptr (local.get $sw))) (local.get $i))
                (i32.eq (local.get $i) (local.get $row)))
              (local.set $i (i32.add (local.get $i) (i32.const 1)))
              (br $click_single)))))
        (call $lb_set_cur_sel (local.get $sw) (local.get $row))
        ;; Post WM_COMMAND to parent: HIWORD = notification, LOWORD = ctrl_id.
        (local.set $notif (i32.const 1))  ;; LBN_SELCHANGE
        (if (i32.eq (local.get $msg) (i32.const 0x0203))
          (then (local.set $notif (i32.const 2))))  ;; LBN_DBLCLK
        (local.set $parent (call $wnd_get_parent (local.get $hwnd)))
        (if (local.get $parent)
          (then
            (drop (call $wnd_send_message (local.get $parent) (i32.const 0x0111)
                    (i32.or (call $ctrl_table_get_id (local.get $hwnd))
                            (i32.shl (local.get $notif) (i32.const 16)))
                    (local.get $hwnd)))))
        (call $invalidate_hwnd (local.get $hwnd))
        (return (i32.const 0))))

    ;; ---------- WM_LBUTTONUP (0x0202) — release scrollbar press ----------
    (if (i32.eq (local.get $msg) (i32.const 0x0202))
      (then
        (if (i32.eq (global.get $sb_pressed_hwnd) (local.get $hwnd))
          (then
            (global.set $sb_pressed_hwnd (i32.const 0))
            (global.set $sb_pressed_part (i32.const 0))
            (call $invalidate_hwnd (local.get $hwnd))))
        ;; Release mouse capture if we owned it (thumb drag). Harmless if
        ;; another hwnd holds capture — we only clear our own.
        (if (i32.eq (global.get $capture_hwnd) (local.get $hwnd))
          (then (global.set $capture_hwnd (i32.const 0))))
        (return (i32.const 0))))

    ;; ---------- WM_MOUSEMOVE (0x0200) — thumb drag ----------
    ;; Active only when this hwnd owns sb_pressed with part=5 (thumb).
    ;; Recomputes top from anchor_top + delta_y mapped to [0,max] using
    ;; the same arrow=16 / track=h-32 geometry as $paint_vscrollbar_rect.
    (if (i32.eq (local.get $msg) (i32.const 0x0200))
      (then
        (if (i32.and (i32.eq (global.get $sb_pressed_hwnd) (local.get $hwnd))
                     (i32.eq (global.get $sb_pressed_part) (i32.const 5)))
          (then
            (local.set $sz (call $ctrl_get_wh_packed (local.get $hwnd)))
            (local.set $h (i32.shr_u (local.get $sz) (i32.const 16)))
            (local.set $row_y (i32.shr_s (local.get $lParam) (i32.const 16)))
            (local.set $count (call $lb_count (local.get $sw)))
            (local.set $visible (i32.div_u (i32.sub (local.get $h) (i32.const 4)) (call $lb_row_height (local.get $sw))))
            (local.set $max (i32.sub (local.get $count) (local.get $visible)))
            (if (i32.lt_s (local.get $max) (i32.const 0))
              (then (local.set $max (i32.const 0))))
            (if (i32.gt_s (local.get $max) (i32.const 0))
              (then
                (call $listbox_drag_to (local.get $hwnd) (local.get $sw)
                  (local.get $row_y) (local.get $h) (local.get $max))
                (call $invalidate_hwnd (local.get $hwnd))))))
        (return (i32.const 0))))

    ;; ---------- WM_KEYDOWN (0x0100) ----------
    ;; VK_UP/DOWN/HOME/END/PRIOR/NEXT navigate the listbox; each fires
    ;; LBN_SELCHANGE to the parent. Used by the combobox popup to drive
    ;; the inner listbox via keyboard.
    (if (i32.eq (local.get $msg) (i32.const 0x0100))
      (then
        (local.set $count (call $lb_count (local.get $sw)))
        (if (i32.eqz (local.get $count)) (then (return (i32.const 0))))
        (local.set $sel (call $lb_cur_sel (local.get $sw)))
        ;; Compute visible rows for PGUP/PGDN
        (local.set $sz (call $ctrl_get_wh_packed (local.get $hwnd)))
        (local.set $h (i32.shr_u (local.get $sz) (i32.const 16)))
        (local.set $visible (i32.div_u (i32.sub (local.get $h) (i32.const 4)) (call $lb_row_height (local.get $sw))))
        (if (i32.lt_s (local.get $visible) (i32.const 1))
          (then (local.set $visible (i32.const 1))))
        (local.set $row (local.get $sel))
        (if (i32.eq (local.get $wParam) (i32.const 0x24)) ;; VK_HOME
          (then (local.set $row (i32.const 0)))
          (else (if (i32.eq (local.get $wParam) (i32.const 0x23)) ;; VK_END
            (then (local.set $row (i32.sub (local.get $count) (i32.const 1))))
            (else (if (i32.eq (local.get $wParam) (i32.const 0x28)) ;; VK_DOWN
              (then
                (if (i32.lt_s (local.get $row) (i32.const 0))
                  (then (local.set $row (i32.const 0)))
                  (else
                    (local.set $row (i32.add (local.get $row) (i32.const 1)))
                    (if (i32.ge_s (local.get $row) (local.get $count))
                      (then (local.set $row (i32.sub (local.get $count) (i32.const 1))))))))
              (else (if (i32.eq (local.get $wParam) (i32.const 0x26)) ;; VK_UP
                (then
                  (if (i32.le_s (local.get $row) (i32.const 0))
                    (then (local.set $row (i32.const 0)))
                    (else (local.set $row (i32.sub (local.get $row) (i32.const 1))))))
                (else (if (i32.eq (local.get $wParam) (i32.const 0x21)) ;; VK_PRIOR
                  (then
                    (if (i32.lt_s (local.get $row) (i32.const 0))
                      (then (local.set $row (i32.const 0)))
                      (else
                        (local.set $row (i32.sub (local.get $row) (local.get $visible)))
                        (if (i32.lt_s (local.get $row) (i32.const 0))
                          (then (local.set $row (i32.const 0)))))))
                  (else (if (i32.eq (local.get $wParam) (i32.const 0x22)) ;; VK_NEXT
                    (then
                      (if (i32.lt_s (local.get $row) (i32.const 0))
                        (then (local.set $row (i32.const 0)))
                        (else
                          (local.set $row (i32.add (local.get $row) (local.get $visible)))
                          (if (i32.ge_s (local.get $row) (local.get $count))
                            (then (local.set $row (i32.sub (local.get $count) (i32.const 1))))))))
                    (else (return (i32.const 0))))))))))))))
        (call $lb_set_cur_sel (local.get $sw) (local.get $row))
        (local.set $i (i32.const 0))
        (block $key_sel_done (loop $key_sel
          (br_if $key_sel_done (i32.ge_u (local.get $i) (local.get $count)))
          (i32.store8
            (i32.add (call $g2w (call $lb_sel_ptr (local.get $sw))) (local.get $i))
            (i32.eq (local.get $i) (local.get $row)))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $key_sel)))
        ;; Adjust top_index so $row stays visible.
        (local.set $top (call $lb_top_index (local.get $sw)))
        (if (i32.lt_s (local.get $row) (local.get $top))
          (then (call $lb_set_top_index (local.get $sw) (local.get $row)))
          (else
            (if (i32.ge_s (local.get $row) (i32.add (local.get $top) (local.get $visible)))
              (then (call $lb_set_top_index (local.get $sw)
                      (i32.add (i32.sub (local.get $row) (local.get $visible)) (i32.const 1)))))))
        (local.set $parent (call $wnd_get_parent (local.get $hwnd)))
        (if (local.get $parent)
          (then (drop (call $wnd_send_message (local.get $parent) (i32.const 0x0111)
                  (i32.or (call $ctrl_table_get_id (local.get $hwnd))
                          (i32.shl (i32.const 1) (i32.const 16)))  ;; LBN_SELCHANGE
                  (local.get $hwnd)))))
        (call $invalidate_hwnd (local.get $hwnd))
        (return (i32.const 0))))

    ;; ---------- LB_INSERTSTRING (0x0181) — wParam=index, lParam=string ptr ----------
    ;; -1 (or any index past the end) means "append" — LB_ADDSTRING semantics.
    ;; A real mid-list insert matters beyond sorted listboxes: an app that keeps
    ;; a parallel array of its own records indexes both by row, so appending a
    ;; string the caller asked to insert at N silently shifts every row past N
    ;; out of step with that array. Task Manager does exactly this (its rows
    ;; pair with a comctl32 DSA), and End Task then acted on the wrong window.
    ;;
    ;; Strategy: let LB_ADDSTRING do the appending and all three buffer grows,
    ;; then rotate that last item down into place.
    (if (i32.eq (local.get $msg) (i32.const 0x0181))
      (then
        (local.set $idx (local.get $wParam))
        (local.set $count (call $lb_count (local.get $sw)))
        (if (i32.or (i32.lt_s (local.get $idx) (i32.const 0))
                    (i32.ge_s (local.get $idx) (local.get $count)))
          (then (return (call $listbox_wndproc (local.get $hwnd)
                          (i32.const 0x0180) (i32.const 0) (local.get $lParam)))))
        (if (i32.lt_s (call $listbox_wndproc (local.get $hwnd)
                        (i32.const 0x0180) (i32.const 0) (local.get $lParam))
                      (i32.const 0))
          (then (return (i32.const -1))))
        (local.set $items_w (call $g2w (call $lb_items_ptr (local.get $sw))))
        (local.set $used (call $lb_items_used (local.get $sw)))
        ;; Byte offset of item $idx, then of the item just appended.
        (local.set $p (local.get $items_w))
        (local.set $i (i32.const 0))
        (block $ins_at (loop $ins_skip
          (br_if $ins_at (i32.eq (local.get $i) (local.get $idx)))
          (local.set $p (i32.add (local.get $p)
                          (i32.add (call $strlen (local.get $p)) (i32.const 1))))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $ins_skip)))
        (local.set $dest_g (i32.sub (local.get $p) (local.get $items_w)))
        (local.set $tmp_w (local.get $p))
        (block $ins_last (loop $ins_walk
          (br_if $ins_last (i32.ge_s (local.get $i) (local.get $count)))
          (local.set $tmp_w (i32.add (local.get $tmp_w)
                              (i32.add (call $strlen (local.get $tmp_w)) (i32.const 1))))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $ins_walk)))
        (local.set $last (i32.sub (local.get $tmp_w) (local.get $items_w)))
        (local.set $slen (i32.sub (local.get $used) (local.get $last)))
        ;; Park the appended string, open the gap, drop it in. memory.copy is
        ;; memmove-like, so the overlapping shift up is safe.
        (local.set $tmp_g (call $heap_alloc (local.get $slen)))
        (memory.copy (call $g2w (local.get $tmp_g))
                     (i32.add (local.get $items_w) (local.get $last))
                     (local.get $slen))
        (memory.copy (i32.add (local.get $items_w)
                       (i32.add (local.get $dest_g) (local.get $slen)))
                     (i32.add (local.get $items_w) (local.get $dest_g))
                     (i32.sub (local.get $last) (local.get $dest_g)))
        (memory.copy (i32.add (local.get $items_w) (local.get $dest_g))
                     (call $g2w (local.get $tmp_g))
                     (local.get $slen))
        (call $heap_free (local.get $tmp_g))
        ;; Rotate the parallel item-data array the same way. LB_ADDSTRING
        ;; zeroed the appended slot, so $idx ends up with a fresh 0.
        (if (call $lb_data_ptr (local.get $sw))
          (then
            (local.set $dest_w (call $g2w (call $lb_data_ptr (local.get $sw))))
            (local.set $sz (i32.load
              (i32.add (local.get $dest_w) (i32.mul (local.get $count) (i32.const 4)))))
            (memory.copy
              (i32.add (local.get $dest_w)
                (i32.mul (i32.add (local.get $idx) (i32.const 1)) (i32.const 4)))
              (i32.add (local.get $dest_w) (i32.mul (local.get $idx) (i32.const 4)))
              (i32.mul (i32.sub (local.get $count) (local.get $idx)) (i32.const 4)))
            (i32.store (i32.add (local.get $dest_w) (i32.mul (local.get $idx) (i32.const 4)))
              (local.get $sz))))
        ;; And the byte-per-row multi-selection flags.
        (if (call $lb_sel_ptr (local.get $sw))
          (then
            (local.set $dest_w (call $g2w (call $lb_sel_ptr (local.get $sw))))
            (local.set $sz (i32.load8_u
              (i32.add (local.get $dest_w) (local.get $count))))
            (memory.copy
              (i32.add (local.get $dest_w) (i32.add (local.get $idx) (i32.const 1)))
              (i32.add (local.get $dest_w) (local.get $idx))
              (i32.sub (local.get $count) (local.get $idx)))
            (i32.store8 (i32.add (local.get $dest_w) (local.get $idx)) (local.get $sz))))
        ;; A selection at or after the insert point moves down a row.
        (local.set $sel (call $lb_cur_sel (local.get $sw)))
        (if (i32.ge_s (local.get $sel) (local.get $idx))
          (then (call $lb_set_cur_sel (local.get $sw)
                  (i32.add (local.get $sel) (i32.const 1)))))
        (call $invalidate_hwnd (local.get $hwnd))
        (return (local.get $idx))))

    ;; ---------- LB_DELETESTRING (0x0182) ----------
    ;; wParam = index. Removes the item; returns new count, or LB_ERR(-1).
    (if (i32.eq (local.get $msg) (i32.const 0x0182))
      (then
        (local.set $idx (local.get $wParam))
        (local.set $count (call $lb_count (local.get $sw)))
        (if (i32.or (i32.lt_s (local.get $idx) (i32.const 0))
                    (i32.ge_s (local.get $idx) (local.get $count)))
          (then (return (i32.const -1))))
        (local.set $items_w (call $g2w (call $lb_items_ptr (local.get $sw))))
        (local.set $p (local.get $items_w))
        (local.set $i (i32.const 0))
        (block $delfound (loop $delskip
          (br_if $delfound (i32.eq (local.get $i) (local.get $idx)))
          (local.set $p (i32.add (local.get $p)
                          (i32.add (call $strlen (local.get $p)) (i32.const 1))))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $delskip)))
        (local.set $slen (i32.add (call $strlen (local.get $p)) (i32.const 1)))
        ;; Shift tail down by $slen bytes
        (local.set $used (call $lb_items_used (local.get $sw)))
        (local.set $i (i32.sub (local.get $p) (local.get $items_w)))
        (call $memcpy (local.get $p)
                      (i32.add (local.get $p) (local.get $slen))
                      (i32.sub (local.get $used) (i32.add (local.get $i) (local.get $slen))))
        (call $lb_set_items_used (local.get $sw) (i32.sub (local.get $used) (local.get $slen)))
        (call $lb_set_count (local.get $sw) (i32.sub (local.get $count) (i32.const 1)))
        ;; Shift parallel data array down by one slot at $idx.
        (if (call $lb_data_ptr (local.get $sw))
          (then
            (local.set $dest_w
              (i32.add (call $g2w (call $lb_data_ptr (local.get $sw)))
                       (i32.mul (local.get $idx) (i32.const 4))))
            (call $memcpy (local.get $dest_w)
                          (i32.add (local.get $dest_w) (i32.const 4))
                          (i32.mul (i32.sub (i32.sub (local.get $count) (local.get $idx))
                                            (i32.const 1))
                                   (i32.const 4)))))
        ;; Shift parallel multi-selection flags down by one row.
        (if (call $lb_sel_ptr (local.get $sw))
          (then
            (local.set $dest_w
              (i32.add (call $g2w (call $lb_sel_ptr (local.get $sw))) (local.get $idx)))
            (call $memcpy (local.get $dest_w)
                          (i32.add (local.get $dest_w) (i32.const 1))
                          (i32.sub (i32.sub (local.get $count) (local.get $idx)) (i32.const 1)))
            (i32.store8
              (i32.add (call $g2w (call $lb_sel_ptr (local.get $sw)))
                       (i32.sub (local.get $count) (i32.const 1)))
              (i32.const 0))))
        ;; Adjust cur_sel if affected
        (local.set $sel (call $lb_cur_sel (local.get $sw)))
        (if (i32.eq (local.get $sel) (local.get $idx))
          (then (call $lb_set_cur_sel (local.get $sw) (i32.const -1)))
          (else (if (i32.gt_s (local.get $sel) (local.get $idx))
            (then (call $lb_set_cur_sel (local.get $sw) (i32.sub (local.get $sel) (i32.const 1)))))))
        (call $invalidate_hwnd (local.get $hwnd))
        (return (i32.sub (local.get $count) (i32.const 1)))))

    ;; ---------- LB_GETITEMDATA (0x0199) / LB_SETITEMDATA (0x019A) ----------
    ;; wParam = index. SETITEMDATA's lParam is the new u32. Out-of-range → -1.
    (if (i32.or (i32.eq (local.get $msg) (i32.const 0x0199))
                (i32.eq (local.get $msg) (i32.const 0x019A)))
      (then
        (local.set $idx (local.get $wParam))
        (local.set $count (call $lb_count (local.get $sw)))
        (if (i32.or (i32.lt_s (local.get $idx) (i32.const 0))
                    (i32.ge_s (local.get $idx) (local.get $count)))
          (then (return (i32.const -1))))
        (if (i32.eqz (call $lb_data_ptr (local.get $sw)))
          (then (return (i32.const 0))))
        (local.set $dest_w
          (i32.add (call $g2w (call $lb_data_ptr (local.get $sw)))
                   (i32.mul (local.get $idx) (i32.const 4))))
        (if (i32.eq (local.get $msg) (i32.const 0x019A))
          (then
            (i32.store (local.get $dest_w) (local.get $lParam))
            (return (i32.const 0))))
        (return (i32.load (local.get $dest_w)))))

    ;; ---------- LB_FINDSTRING (0x018F) / LB_FINDSTRINGEXACT (0x01A2) ----------
    ;; Text lists compare strings; no-string owner-draw lists compare item data.
    (if (i32.or (i32.eq (local.get $msg) (i32.const 0x018F))
                (i32.eq (local.get $msg) (i32.const 0x01A2)))
      (then
        (local.set $count (call $lb_count (local.get $sw)))
        (if (i32.eqz (local.get $count)) (then (return (i32.const -1))))
        (local.set $ownerdraw (i32.and (i32.ne (i32.and (call $wnd_get_style (local.get $hwnd)) (i32.const 0x0030)) (i32.const 0)) (i32.eqz (i32.and (call $wnd_get_style (local.get $hwnd)) (i32.const 0x0040)))))
        (if (i32.eqz (local.get $ownerdraw)) (then
          (if (i32.eqz (local.get $lParam)) (then (return (i32.const -1))))
          (local.set $src_w (call $g2w (local.get $lParam)))
          (local.set $slen (call $strlen (local.get $src_w)))))
        (local.set $idx (local.get $wParam))
        (if (i32.lt_s (local.get $idx) (i32.const 0))
          (then (local.set $idx (i32.sub (local.get $count) (i32.const 1)))))
        (local.set $items_w (call $g2w (call $lb_items_ptr (local.get $sw))))
        (local.set $i (i32.const 0))
        (block $fsdone (loop $fsloop
          (br_if $fsdone (i32.ge_s (local.get $i) (local.get $count)))
          (local.set $idx (i32.add (local.get $idx) (i32.const 1)))
          (if (i32.ge_s (local.get $idx) (local.get $count))
            (then (local.set $idx (i32.const 0))))
          (if (local.get $ownerdraw) (then
            (if (i32.eq (i32.load (i32.add (call $g2w (call $lb_data_ptr (local.get $sw)))
                                           (i32.mul (local.get $idx) (i32.const 4)))) (local.get $lParam))
              (then (return (local.get $idx))))
            (local.set $i (i32.add (local.get $i) (i32.const 1))) (br $fsloop)))
          (local.set $p (local.get $items_w))
          (local.set $row (i32.const 0))
          (block $fsskip (loop $fssk
            (br_if $fsskip (i32.eq (local.get $row) (local.get $idx)))
            (local.set $p (i32.add (local.get $p)
                            (i32.add (call $strlen (local.get $p)) (i32.const 1))))
            (local.set $row (i32.add (local.get $row) (i32.const 1)))
            (br $fssk)))
          (local.set $row_y (call $strlen (local.get $p))) ;; reuse $row_y as item-len
          (if (i32.eq (local.get $msg) (i32.const 0x01A2))
            (then (if (i32.ne (local.get $row_y) (local.get $slen))
                    (then (local.set $i (i32.add (local.get $i) (i32.const 1))) (br $fsloop))))
            (else (if (i32.lt_u (local.get $row_y) (local.get $slen))
                    (then (local.set $i (i32.add (local.get $i) (i32.const 1))) (br $fsloop)))))
          (if (call $listbox_strncmpi (local.get $p) (local.get $src_w) (local.get $slen))
            (then (return (local.get $idx))))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $fsloop)))
        (return (i32.const -1))))

    ;; ---------- LB_SELECTSTRING (0x018C) ----------
    ;; FINDSTRING + SETCURSEL. Returns selected index or LB_ERR.
    (if (i32.eq (local.get $msg) (i32.const 0x018C))
      (then
        (local.set $idx (call $listbox_wndproc (local.get $hwnd)
                          (i32.const 0x018F) (local.get $wParam) (local.get $lParam)))
        (if (i32.lt_s (local.get $idx) (i32.const 0)) (then (return (i32.const -1))))
        (drop (call $listbox_wndproc (local.get $hwnd)
                (i32.const 0x0186) (local.get $idx) (i32.const 0)))
        (return (local.get $idx))))

    ;; ---------- LB_GETTOPINDEX (0x018E) / LB_SETTOPINDEX (0x0197) ----------
    (if (i32.eq (local.get $msg) (i32.const 0x018E))
      (then (return (call $lb_top_index (local.get $sw)))))
    (if (i32.eq (local.get $msg) (i32.const 0x0197))
      (then
        (drop (call $listbox_scroll_to
          (local.get $hwnd) (local.get $sw) (local.get $wParam)))
        (return (i32.const 0))))

    ;; ---------- WM_MOUSEWHEEL (0x020A) ----------
    ;; Three rows per 120-unit wheel notch, matching the sibling controls.
    (if (i32.eq (local.get $msg) (i32.const 0x020A))
      (then
        (local.set $delta
          (i32.div_s
            (i32.sub (i32.const 0) (i32.shr_s (local.get $wParam) (i32.const 16)))
            (i32.const 40)))
        (drop (call $listbox_scroll_to
          (local.get $hwnd) (local.get $sw)
          (i32.add (call $lb_top_index (local.get $sw)) (local.get $delta))))
        (return (i32.const 0))))

    ;; ---------- WM_VSCROLL (0x0115) ----------
    (if (i32.eq (local.get $msg) (i32.const 0x0115))
      (then
        (local.set $code (i32.and (local.get $wParam) (i32.const 0xFFFF)))
        (local.set $top (call $lb_top_index (local.get $sw)))
        (local.set $visible (call $listbox_visible_rows (local.get $hwnd) (local.get $sw)))
        (local.set $idx (local.get $top))
        (if (i32.eq (local.get $code) (i32.const 0)) ;; SB_LINEUP
          (then (local.set $idx (i32.sub (local.get $top) (i32.const 1)))))
        (if (i32.eq (local.get $code) (i32.const 1)) ;; SB_LINEDOWN
          (then (local.set $idx (i32.add (local.get $top) (i32.const 1)))))
        (if (i32.eq (local.get $code) (i32.const 2)) ;; SB_PAGEUP
          (then (local.set $idx (i32.sub (local.get $top) (local.get $visible)))))
        (if (i32.eq (local.get $code) (i32.const 3)) ;; SB_PAGEDOWN
          (then (local.set $idx (i32.add (local.get $top) (local.get $visible)))))
        (if (i32.or (i32.eq (local.get $code) (i32.const 4)) ;; SB_THUMBPOSITION
                    (i32.eq (local.get $code) (i32.const 5))) ;; SB_THUMBTRACK
          (then (local.set $idx (i32.shr_u (local.get $wParam) (i32.const 16)))))
        (if (i32.eq (local.get $code) (i32.const 6)) ;; SB_TOP
          (then (local.set $idx (i32.const 0))))
        (if (i32.eq (local.get $code) (i32.const 7)) ;; SB_BOTTOM
          (then (local.set $idx (call $lb_count (local.get $sw)))))
        (drop (call $listbox_scroll_to
          (local.get $hwnd) (local.get $sw) (local.get $idx)))
        (return (i32.const 0))))

    ;; ---------- WM_PAINT (0x000F) ----------
    ;; Draw inset frame, white interior, and visible item rows. Selected
    ;; item is rendered with the system highlight (blue background +
    ;; white text). Item height is fixed at 16 px. If WS_VSCROLL is set,
    ;; a 16px scrollbar strip is reserved at the right edge.
    (if (i32.eq (local.get $msg) (i32.const 0x000F))
      (then
        ;; Skip paint when not WS_VISIBLE — combobox dropdowns rely on this:
        ;; their inner listbox child is invisible until $combobox_open_dropdown
        ;; sets WS_VISIBLE. Without this guard, LB_ADDSTRING's invalidate path
        ;; would paint the invisible dropped-area onto the parent every time
        ;; the combobox is populated.
        (if (i32.eqz (i32.and (call $wnd_get_style (local.get $hwnd)) (i32.const 0x10000000)))
          (then (return (i32.const 0))))
        (local.set $hdc (i32.add (local.get $hwnd) (i32.const 0x40000)))
        (local.set $sz (call $ctrl_get_wh_packed (local.get $hwnd)))
        (local.set $w (i32.and (local.get $sz) (i32.const 0xFFFF)))
        (local.set $h (i32.shr_u (local.get $sz) (i32.const 16)))
        (drop (call $host_gdi_select_object (local.get $hdc) (i32.const 0x30021)))
        (drop (call $host_gdi_set_bk_mode (local.get $hdc) (i32.const 1)))
        ;; Reserve the right strip only while USER would make it visible.
        (if (call $listbox_vscroll_visible (local.get $hwnd) (local.get $sw))
          (then (local.set $w (i32.sub (local.get $w) (i32.const 16)))))
        ;; White interior + sunken edge (content rect only).
        (drop (call $host_gdi_fill_rect (local.get $hdc)
                (i32.const 0) (i32.const 0) (local.get $w) (local.get $h)
                (i32.const 0x30010)))
        (drop (call $host_gdi_draw_edge (local.get $hdc)
                (i32.const 0) (i32.const 0) (local.get $w) (local.get $h)
                (i32.const 0x0A) (i32.const 0x0F)))
        (local.set $count (call $lb_count (local.get $sw)))
        (local.set $sel   (call $lb_cur_sel (local.get $sw)))
        (local.set $top   (call $lb_top_index (local.get $sw)))
        ;; LBS_OWNERDRAWFIXED (0x0010) / LBS_OWNERDRAWVARIABLE (0x0020).
        (local.set $ownerdraw
          (i32.ne (i32.and (call $wnd_get_style (local.get $hwnd)) (i32.const 0x0030))
                  (i32.const 0)))
        ;; Measure once, on the first paint: by now the owner's dlgproc is
        ;; installed, which it need not be while the control is being created.
        (if (i32.and (local.get $ownerdraw) (i32.eqz (call $lb_item_h (local.get $sw))))
          (then (call $lb_set_item_h (local.get $sw)
                  (call $lb_measure_item (local.get $hwnd) (local.get $sw)))))
        (local.set $row_h (call $lb_row_height (local.get $sw)))
        (local.set $visible (i32.div_u (i32.sub (local.get $h) (i32.const 4)) (local.get $row_h)))
        ;; Walk to the first visible item.
        (local.set $items_w (call $g2w (call $lb_items_ptr (local.get $sw))))
        (local.set $p (local.get $items_w))
        (local.set $i (i32.const 0))
        (block $skip_done (loop $skip
          (br_if $skip_done (i32.ge_u (local.get $i) (local.get $top)))
          (br_if $skip_done (i32.ge_u (local.get $i) (local.get $count)))
          (local.set $p (i32.add (local.get $p)
                          (i32.add (call $strlen (local.get $p)) (i32.const 1))))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $skip)))
        ;; Render visible rows.
        (local.set $row (i32.const 0))
        (block $rows_done (loop $rows
          (br_if $rows_done (i32.ge_u (local.get $row) (local.get $visible)))
          (local.set $idx (i32.add (local.get $top) (local.get $row)))
          (br_if $rows_done (i32.ge_u (local.get $idx) (local.get $count)))
          (local.set $row_y (i32.add (i32.const 2) (i32.mul (local.get $row) (local.get $row_h))))
          (local.set $slen (call $strlen (local.get $p)))
          (if (local.get $ownerdraw)
            (then
              (call $lb_send_drawitem (local.get $hwnd) (local.get $sw) (local.get $idx)
                (local.get $row_y) (local.get $w) (local.get $row_h)
                (i32.load8_u (i32.add (call $g2w (call $lb_sel_ptr (local.get $sw)))
                                      (local.get $idx))))
              ;; The owner owns the whole row; skip our own text/highlight pass.
              (local.set $p (i32.add (local.get $p) (i32.add (local.get $slen) (i32.const 1))))
              (local.set $row (i32.add (local.get $row) (i32.const 1)))
              (br $rows)))
          (if (i32.load8_u
                (i32.add (call $g2w (call $lb_sel_ptr (local.get $sw))) (local.get $idx)))
            (then
              ;; Highlight bar (system blue) + white text. We use a fresh
              ;; solid brush each time so we don't depend on COLOR_HIGHLIGHT
              ;; being mapped in the stock-brush table.
              (local.set $brush (call $host_gdi_create_solid_brush (i32.const 0x00800000)))
              (drop (call $host_gdi_fill_rect (local.get $hdc)
                      (i32.const 2) (local.get $row_y)
                      (i32.sub (local.get $w) (i32.const 2))
                      (i32.add (local.get $row_y) (local.get $row_h))
                      (local.get $brush)))
              (drop (call $host_gdi_delete_object (local.get $brush)))
              (drop (call $host_gdi_set_text_color (local.get $hdc) (i32.const 0x00FFFFFF)))
              (if (local.get $slen)
                (then (drop (call $host_gdi_text_out (local.get $hdc)
                              (i32.const 4) (i32.add (local.get $row_y) (i32.const 2))
                              (local.get $p) (local.get $slen) (i32.const 0)))))
              (drop (call $host_gdi_set_text_color (local.get $hdc) (i32.const 0x00000000))))
            (else
              (if (local.get $slen)
                (then (drop (call $host_gdi_text_out (local.get $hdc)
                              (i32.const 4) (i32.add (local.get $row_y) (i32.const 2))
                              (local.get $p) (local.get $slen) (i32.const 0)))))))
          (local.set $p (i32.add (local.get $p) (i32.add (local.get $slen) (i32.const 1))))
          (local.set $row (i32.add (local.get $row) (i32.const 1)))
          (br $rows)))
        ;; Visible WS_VSCROLL strip. $w here is already reduced; full width is via sz.
        (if (call $listbox_vscroll_visible (local.get $hwnd) (local.get $sw))
          (then
            (local.set $visible (i32.div_u (i32.sub (local.get $h) (i32.const 4)) (call $lb_row_height (local.get $sw))))
            (local.set $max (i32.sub (local.get $count) (local.get $visible)))
            (if (i32.lt_s (local.get $max) (i32.const 0))
              (then (local.set $max (i32.const 0))))
            (call $paint_vscrollbar_rect (local.get $hdc)
              (local.get $w) (i32.const 0) (i32.const 16) (local.get $h)
              (call $lb_top_index (local.get $sw)) (local.get $max)
              (select (global.get $sb_pressed_part) (i32.const 0)
                      (i32.eq (global.get $sb_pressed_hwnd) (local.get $hwnd)))
              (call $scroll_arrow_mask (local.get $hwnd) (i32.const 1)))))
        (return (i32.const 0))))

    ;; Default
    (i32.const 0)
  )

  ;; ============================================================
  ;; ComboBox WndProc  (control class 5)
  ;; ============================================================
  ;;
  ;; Real combobox: item storage delegates to an inner listbox child (class 4).
  ;; The listbox is created at WM_CREATE sized to fill (0, FIELD_H, w, h-FIELD_H)
  ;; — using the cy budget from the dialog template, which always reserves
  ;; enough height for the dropped state. Toggling the dropdown shows/hides
  ;; the listbox (via WS_VISIBLE).
  ;;
  ;; CBS_* variants (style & 0x3):
  ;;   1=CBS_SIMPLE       listbox is always WS_VISIBLE
  ;;   2=CBS_DROPDOWN     listbox toggled by click/F4/Alt+Down; field is editable
  ;;   3=CBS_DROPDOWNLIST listbox toggled, field shows selection (read-only)
  ;;
  ;; ComboBoxState (40 bytes, allocated in WM_CREATE)
  ;;   +0   text_buf_ptr   guest ptr to selected/typed item text
  ;;   +4   text_len
  ;;   +8   style          full window style
  ;;   +12  cur_sel        mirror of listbox cur_sel; -1 = none
  ;;   +16  lb_hwnd        inner listbox hwnd
  ;;   +20  popup_hwnd     reserved for future WS_POPUP escape (0 today)
  ;;   +24  edit_hwnd      CBS_DROPDOWN inner edit child; 0 for SIMPLE/DROPDOWNLIST
  ;;   +28  is_dropped     0/1 — CB_GETDROPPEDSTATE
  ;;   +32  variant        1=SIMPLE 2=DROPDOWN 3=DROPDOWNLIST
  ;;   +36  suppress_edit_notify — combo-originated edit WM_SETTEXT nesting
  ;; The control id is NOT in the record: $ctrl_table_get_id($hwnd).
  ;;
  ;; FIELD_H = 21 px; arrow box = 16 px wide on right edge.

  ;; ============================================================
  ;; ComboBox dropdown popup shell — class 9, WS_POPUP top-level.
  ;; Hosts the inner listbox child for CBS_DROPDOWN/DROPDOWNLIST.
  ;; Owns no state of its own; userdata stores the owner combobox hwnd
  ;; so messages can be forwarded back. Outside-click dismissal happens
  ;; here (combobox SetCapture's the popup). Inside clicks fall through
  ;; to the listbox child via normal hit-testing.
  ;;
  ;;   userdata = owner combo hwnd
  ;; ============================================================
  (func $combo_popup_wndproc (param $hwnd i32) (param $msg i32) (param $wParam i32) (param $lParam i32) (result i32)
    (local $owner i32) (local $rect i32) (local $w i32) (local $h i32)
    (local $mx i32) (local $my i32) (local $sw i32) (local $lb i32)
    (local.set $owner (call $wnd_get_userdata (local.get $hwnd)))
    ;; WM_LBUTTONDOWN / WM_LBUTTONUP / WM_MOUSEMOVE / WM_LBUTTONDBLCLK:
    ;; outside-rect → ask owner combo to close as cancel; inside → forward
    ;; to inner listbox child (which lives at popup-local (0,0), so lParam
    ;; passes through unchanged). The listbox isn't a renderer-known
    ;; window, so the renderer can't deep-hit-test it — forwarding here
    ;; makes click-to-select work for CBS_DROPDOWNLIST popups.
    (if (i32.or
          (i32.or (i32.eq (local.get $msg) (i32.const 0x0201))   ;; WM_LBUTTONDOWN
                  (i32.eq (local.get $msg) (i32.const 0x0202)))  ;; WM_LBUTTONUP
          (i32.or (i32.eq (local.get $msg) (i32.const 0x0200))   ;; WM_MOUSEMOVE
                  (i32.eq (local.get $msg) (i32.const 0x0203)))) ;; WM_LBUTTONDBLCLK
      (then
        (local.set $mx (i32.shr_s (i32.shl (local.get $lParam) (i32.const 16)) (i32.const 16)))
        (local.set $my (i32.shr_s (local.get $lParam) (i32.const 16)))
        (local.set $rect (call $paint_scratch_take))
        (call $host_get_window_rect (local.get $hwnd) (local.get $rect))
        (local.set $w (i32.sub (load.field.memarg PaintRect right (local.get $rect))
                                (load.field PaintRect left (local.get $rect))))
        (local.set $h (i32.sub (load.field.memarg PaintRect bottom (local.get $rect))
                                (load.field.memarg PaintRect top (local.get $rect))))
        (if (i32.or
              (i32.or (i32.lt_s (local.get $mx) (i32.const 0))
                      (i32.lt_s (local.get $my) (i32.const 0)))
              (i32.or (i32.ge_s (local.get $mx) (local.get $w))
                      (i32.ge_s (local.get $my) (local.get $h))))
          (then
            ;; Outside rect: only LBUTTONDOWN dismisses the dropdown.
            ;; (UP/MOVE outside should be ignored, not trigger close.)
            (if (i32.eq (local.get $msg) (i32.const 0x0201))
              (then
                (if (local.get $owner)
                  (then (call $combobox_close_dropdown (local.get $owner) (i32.const 0))))))
            (return (i32.const 0))))
        ;; Inside: forward to listbox child (state offset +20).
        (if (local.get $owner)
          (then
            (local.set $sw (call $wnd_get_state_ptr (local.get $owner)))
            (if (local.get $sw)
              (then
                (local.set $lb (call $cb_lb_hwnd (call $g2w (local.get $sw))))
                (if (local.get $lb)
                  (then (drop (call $wnd_send_message (local.get $lb)
                                (local.get $msg) (local.get $wParam) (local.get $lParam)))))))))
        (return (i32.const 0))))
    ;; WM_COMMAND from inner listbox child — forward to owner combo so its
    ;; existing LBN_SELCHANGE / LBN_DBLCLK handling fires.
    (if (i32.eq (local.get $msg) (i32.const 0x0111))
      (then
        (if (local.get $owner)
          (then (return (call $wnd_send_message (local.get $owner)
                              (local.get $msg) (local.get $wParam) (local.get $lParam)))))
        (return (i32.const 0))))
    ;; WM_KEYDOWN: forward to owner combo (it already handles VK_ESC/RETURN/UP/DOWN).
    (if (i32.eq (local.get $msg) (i32.const 0x0100))
      (then
        (if (local.get $owner)
          (then (return (call $wnd_send_message (local.get $owner)
                              (local.get $msg) (local.get $wParam) (local.get $lParam)))))
        (return (i32.const 0))))
    ;; WM_CAPTURECHANGED (0x0215): popup lost capture → close as cancel.
    (if (i32.eq (local.get $msg) (i32.const 0x0215))
      (then
        (if (local.get $owner)
          (then (call $combobox_close_dropdown (local.get $owner) (i32.const 0))))
        (return (i32.const 0))))
    ;; All others: DefWindowProc (return 0).
    (i32.const 0)
  )

  ;; Allocate + register a WS_POPUP top-level dropdown shell owned by the
  ;; given combobox. Returns the popup hwnd. Created hidden — caller (or
  ;; $combobox_open_dropdown) ShowWindows it later. Userdata stores the
  ;; owner combo hwnd so $combo_popup_wndproc can forward messages back.
  (func $combo_create_popup (param $combo i32) (param $w i32) (param $h i32) (result i32)
    (local $popup i32) (local $slot i32)
    (local.set $popup (global.get $next_hwnd))
    (global.set $next_hwnd (i32.add (global.get $next_hwnd) (i32.const 1)))
    ;; Register a JS-side window record (no chrome — kind bit 2 = isPopup).
    (call $host_register_dialog_frame
      (local.get $popup) (local.get $combo)
      (i32.const 0)              ;; no title
      (local.get $w) (local.get $h)
      (i32.const 4))             ;; kind = 4 (isPopup)
    (call $wnd_table_set (local.get $popup) (global.get $WNDPROC_CTRL_NATIVE))
    ;; A dropdown list is a popup owned by the combo, not its child. Keeping
    ;; it in the child tree makes EnumChildWindows(dialog, ...) recurse into
    ;; USER's implementation detail. CD Player enumerates its dialog controls
    ;; into an ID-indexed array; the synthetic list ID then aliases button
    ;; 1000 and replaces the Play HWND after it was found correctly.
    (call $wnd_set_owner (local.get $popup) (local.get $combo))
    ;; WS_POPUP — explicitly hidden until open_dropdown shows it.
    (drop (call $wnd_set_style (local.get $popup) (i32.const 0x80000000)))
    (local.set $slot (call $wnd_table_find (local.get $popup)))
    (call $ctrl_table_set (local.get $slot) (i32.const 9) (i32.const 0))
    (drop (call $wnd_set_userdata (local.get $popup) (local.get $combo)))
    (local.get $popup))

  ;; Helper: open the dropdown (show inner listbox, fire CBN_DROPDOWN, set
  ;; capture so outside clicks dismiss). Idempotent.
  ;;
  ;; CBS_DROPDOWN/CBS_DROPDOWNLIST (variants 2/3): the listbox is migrated
  ;; under the pre-allocated WS_POPUP shell (offset=24) and the shell is
  ;; positioned in screen coords directly below the combo's field, then shown
  ;; via host_move_window(SWP_SHOWWINDOW). This lets the dropdown extend past
  ;; the parent dialog's clip rect — a real top-level window.
  (func $combobox_open_dropdown (param $hwnd i32)
    (local $state i32) (local $sw i32) (local $lb i32) (local $style i32) (local $parent i32)
    (local $popup i32) (local $rect i32) (local $lb_wh i32) (local $lb_w i32) (local $lb_h i32)
    (local.set $state (call $wnd_get_state_ptr (local.get $hwnd)))
    (if (i32.eqz (local.get $state)) (then (return)))
    (local.set $sw (call $g2w (local.get $state)))
    (if (call $cb_is_dropped (local.get $sw)) (then (return)))  ;; already dropped
    ;; Another combo already dropped on the same dialog? Close it (cancel) before
    ;; opening this one — Win32 only allows one expanded combo dropdown at a time.
    (if (i32.and
          (i32.ne (global.get $combo_open_hwnd) (i32.const 0))
          (i32.ne (global.get $combo_open_hwnd) (local.get $hwnd)))
      (then (call $combobox_close_dropdown (global.get $combo_open_hwnd) (i32.const 0))))
    (local.set $lb (call $cb_lb_hwnd (local.get $sw)))
    (if (i32.eqz (local.get $lb)) (then (return)))
    (local.set $popup (call $cb_popup_hwnd (local.get $sw)))
    ;; Dropdown variants with a pre-allocated popup: migrate listbox under popup,
    ;; position popup at combo screen pos + (0, FIELD_H), show it.
    (if (i32.and
          (i32.ne (call $cb_variant (local.get $sw)) (i32.const 1))
          (i32.ne (local.get $popup) (i32.const 0)))
      (then
        (local.set $lb_wh (call $ctrl_get_wh_packed (local.get $lb)))
        (local.set $lb_w (i32.and (local.get $lb_wh) (i32.const 0xFFFF)))
        (local.set $lb_h (i32.shr_u (local.get $lb_wh) (i32.const 16)))
        ;; Reparent listbox under popup (WAT side + renderer side).
        (call $wnd_set_parent (local.get $lb) (local.get $popup))
        (call $host_set_parent (local.get $lb) (local.get $popup))
        ;; Listbox is now top-left of popup interior.
        (call $ctrl_geom_set (call $wnd_table_find (local.get $lb))
          (i32.const 0) (i32.const 0) (local.get $lb_w) (local.get $lb_h))
        ;; Position popup directly below combo's field area in screen coords.
        (local.set $rect (call $paint_scratch_take))
        (call $host_get_window_rect (local.get $hwnd) (local.get $rect))
        (call $host_move_window (local.get $popup)
          (load.field PaintRect left (local.get $rect))           ;; left
          (i32.add (load.field.memarg PaintRect top (local.get $rect)) (i32.const 21)) ;; top + FIELD_H
          (local.get $lb_w) (local.get $lb_h)
          (i32.const 0x40))                               ;; SWP_SHOWWINDOW
        ;; host_move_window updates renderer geometry/visibility, while USER
        ;; effective-visibility checks read the WAT style. Keep both sides in
        ;; sync so the reparented listbox is eligible for WM_PAINT.
        (drop (call $wnd_set_style (local.get $popup)
          (i32.or (call $wnd_get_style (local.get $popup)) (i32.const 0x10000000))))))
    (local.set $style (call $wnd_get_style (local.get $lb)))
    (drop (call $wnd_set_style (local.get $lb) (i32.or (local.get $style) (i32.const 0x10000000))))
    (call $cb_set_is_dropped (local.get $sw) (i32.const 1))
    (global.set $combo_open_hwnd (local.get $hwnd))
    ;; Capture: prefer the popup so DOWN+UP both flow through
    ;; $combo_popup_wndproc, which forwards inside-rect events to the inner
    ;; listbox. Without this, UP gets routed via capture to the combo and
    ;; misses the listbox entirely. Falls back to combo for variants without
    ;; a popup shell (CBS_SIMPLE).
    (if (local.get $popup)
      (then  (global.set $capture_hwnd (local.get $popup)))
      (else  (global.set $capture_hwnd (local.get $hwnd))))
    ;; CBN_DROPDOWN(7) → parent
    (local.set $parent (call $wnd_get_parent (local.get $hwnd)))
    (if (local.get $parent)
      (then (drop (call $wnd_send_message (local.get $parent) (i32.const 0x0111)
              (i32.or (i32.and (call $ctrl_table_get_id (local.get $hwnd)) (i32.const 0xFFFF))
                      (i32.shl (i32.const 7) (i32.const 16)))
              (local.get $hwnd)))))
    (call $invalidate_hwnd (local.get $hwnd))
    (call $invalidate_hwnd (local.get $lb)))

  ;; Helper: close the dropdown. $accept=1 fires CBN_SELENDOK; 0 → CBN_SELENDCANCEL.
  ;; Always fires CBN_CLOSEUP. Releases capture.
  (func $combobox_close_dropdown (param $hwnd i32) (param $accept i32)
    (local $state i32) (local $sw i32) (local $lb i32) (local $style i32)
    (local $parent i32) (local $ctrl_id i32) (local $notif i32)
    (local $popup i32) (local $lb_wh i32) (local $lb_w i32) (local $lb_h i32)
    (local.set $state (call $wnd_get_state_ptr (local.get $hwnd)))
    (if (i32.eqz (local.get $state)) (then (return)))
    (local.set $sw (call $g2w (local.get $state)))
    (if (i32.eqz (call $cb_is_dropped (local.get $sw))) (then (return)))  ;; not dropped
    (local.set $lb (call $cb_lb_hwnd (local.get $sw)))
    (local.set $popup (call $cb_popup_hwnd (local.get $sw)))
    ;; Dropdown variant with popup: reparent listbox back under combo, restore its
    ;; original geom (y=FIELD_H), and hide popup via SWP_HIDEWINDOW. Symmetric
    ;; with $combobox_open_dropdown.
    (if (i32.and
          (i32.ne (call $cb_variant (local.get $sw)) (i32.const 1))
          (i32.and (i32.ne (local.get $popup) (i32.const 0))
                   (i32.ne (local.get $lb) (i32.const 0))))
      (then
        (local.set $lb_wh (call $ctrl_get_wh_packed (local.get $lb)))
        (local.set $lb_w (i32.and (local.get $lb_wh) (i32.const 0xFFFF)))
        (local.set $lb_h (i32.shr_u (local.get $lb_wh) (i32.const 16)))
        (call $wnd_set_parent (local.get $lb) (local.get $hwnd))
        (call $host_set_parent (local.get $lb) (local.get $hwnd))
        (call $ctrl_geom_set (call $wnd_table_find (local.get $lb))
          (i32.const 0) (i32.const 21) (local.get $lb_w) (local.get $lb_h))
        (call $host_move_window (local.get $popup)
          (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)
          (i32.const 0x83))                               ;; SWP_NOMOVE|SWP_NOSIZE|SWP_HIDEWINDOW
        (drop (call $wnd_set_style (local.get $popup)
          (i32.and (call $wnd_get_style (local.get $popup)) (i32.const 0xEFFFFFFF))))))
    ;; Hide listbox (CBS_SIMPLE keeps it visible — variant=1 means "always open")
    (if (i32.ne (call $cb_variant (local.get $sw)) (i32.const 1))
      (then
        (if (local.get $lb)
          (then
            (local.set $style (call $wnd_get_style (local.get $lb)))
            (drop (call $wnd_set_style (local.get $lb)
                    (i32.and (local.get $style) (i32.const 0xEFFFFFFF))))))))
    (call $cb_set_is_dropped (local.get $sw) (i32.const 0))
    (if (i32.eq (global.get $combo_open_hwnd) (local.get $hwnd))
      (then (global.set $combo_open_hwnd (i32.const 0))))
    (if (i32.or (i32.eq (global.get $capture_hwnd) (local.get $hwnd))
                (i32.and (i32.ne (local.get $popup) (i32.const 0))
                         (i32.eq (global.get $capture_hwnd) (local.get $popup))))
      (then (global.set $capture_hwnd (i32.const 0))))
    (local.set $parent (call $wnd_get_parent (local.get $hwnd)))
    (local.set $ctrl_id (i32.and (call $ctrl_table_get_id (local.get $hwnd)) (i32.const 0xFFFF)))
    (if (local.get $parent)
      (then
        ;; CBN_SELENDOK(9) or CBN_SELENDCANCEL(10) — POSTED, not sent.
        ;; Real Win32 sends these synchronously, but doing so here means
        ;; the row-pick click (which already runs nested under JS-driven
        ;; $wnd_send_message into our popup wndproc) recursively reenters
        ;; the dialog wndproc one frame deep. In pinball.exe specifically,
        ;; the dialog wndproc returns through a stack-pop sequence that
        ;; depends on x86 callee-save state established by its outer
        ;; PeekMessage caller — when reentered nested, the saved ESI on
        ;; the dialog's stack frame is the recursive-run scratch (0),
        ;; and after the wndproc's pop esi the outer pump calls esi=0
        ;; (EIP=0 freeze). Posting defers the notification to the next
        ;; PeekMessage iteration, where the dialog wndproc runs as a
        ;; first-class dispatch instead of nested-reentry.
        (local.set $notif (select (i32.const 9) (i32.const 10) (local.get $accept)))
        (drop (call $post_queue_push (local.get $parent) (i32.const 0x0111)
                (i32.or (local.get $ctrl_id) (i32.shl (local.get $notif) (i32.const 16)))
                (local.get $hwnd)))
        ;; CBN_CLOSEUP(8) — also posted for the same reason.
        (drop (call $post_queue_push (local.get $parent) (i32.const 0x0111)
                (i32.or (local.get $ctrl_id) (i32.shl (i32.const 8) (i32.const 16)))
                (local.get $hwnd)))))
    (call $invalidate_hwnd (local.get $hwnd))
    ;; The inner listbox was painted into the parent's back-canvas while
    ;; visible; hiding it via WS_VISIBLE removal stops future paints but
    ;; leaves stale dropdown pixels on the canvas. Repaint the parent
    ;; (dialog) AND every sibling so the gray background reappears under
    ;; the dropdown area and other controls (labels, buttons, other combos)
    ;; aren't left as gaps. The renderer doesn't cascade parent → children
    ;; on its own — child paint flags are tracked per-slot.
    (if (local.get $parent)
      (then
        (call $invalidate_hwnd (local.get $parent))
        (call $combobox_invalidate_siblings (local.get $parent) (local.get $hwnd)))))

  ;; Mark every direct child of $parent (including $hwnd, harmless) as
  ;; needing WM_PAINT, so closing a dropdown doesn't leave the dialog's
  ;; other controls unpainted after the parent's background re-erase.
  (func $combobox_invalidate_siblings (param $parent i32) (param $hwnd i32)
    (local $slot i32) (local $ch i32)
    (local.set $slot (i32.const 0))
    (block $done (loop $walk
      (local.set $slot (call $wnd_next_child_slot (local.get $parent) (local.get $slot)))
      (br_if $done (i32.eq (local.get $slot) (i32.const -1)))
      (local.set $ch (call $wnd_slot_hwnd (local.get $slot)))
      (if (local.get $ch)
        (then (call $paint_flag_set_inv (local.get $ch))))
      (local.set $slot (i32.add (local.get $slot) (i32.const 1)))
      (br $walk))))

  ;; Helper: copy the inner listbox's selected item text into combobox text_buf.
  ;; Called after CB_SETCURSEL or LBN_SELCHANGE so WM_GETTEXT returns the right thing.
  ;; CBS_DROPDOWN has a real inner EDIT, which owns the visible field text, so
  ;; keep that child synchronized with the same selection as well.
  (func $combobox_sync_text (param $sw i32)
    (local $lb i32) (local $sel i32) (local $buf_g i32) (local $slen i32)
    (local.set $lb (call $cb_lb_hwnd (local.get $sw)))
    (if (i32.eqz (local.get $lb)) (then (return)))
    (local.set $sel (call $wnd_send_message (local.get $lb) (i32.const 0x0188) (i32.const 0) (i32.const 0)))
    (call $cb_set_cur_sel (local.get $sw) (local.get $sel))
    ;; Free old text_buf
    (call $heap_free (call $cb_text_ptr (local.get $sw)))
    (call $cb_set_text_ptr (local.get $sw) (i32.const 0))
    (call $cb_set_text_len (local.get $sw) (i32.const 0))
    (if (i32.lt_s (local.get $sel) (i32.const 0))
      (then
        (if (i32.and
              (i32.eq (call $cb_variant (local.get $sw)) (i32.const 2))
              (i32.ne (call $cb_edit_hwnd (local.get $sw)) (i32.const 0)))
          (then
            (call $cb_set_suppress_edit_notify (local.get $sw) (i32.const 1))
            (drop (call $wnd_send_message
              (call $cb_edit_hwnd (local.get $sw))
              (i32.const 0x000C) (i32.const 0) (i32.const 0)))
            (call $cb_set_suppress_edit_notify (local.get $sw) (i32.const 0))))
        (return)))
    ;; Get LB_GETTEXTLEN, alloc buf, LB_GETTEXT into it, store.
    (local.set $slen (call $wnd_send_message (local.get $lb) (i32.const 0x018A) (local.get $sel) (i32.const 0)))
    (if (i32.lt_s (local.get $slen) (i32.const 0)) (then (return)))
    (local.set $buf_g (call $heap_alloc (i32.add (local.get $slen) (i32.const 1))))
    (drop (call $wnd_send_message (local.get $lb) (i32.const 0x0189) (local.get $sel) (local.get $buf_g)))
    (call $cb_set_text_ptr (local.get $sw) (local.get $buf_g))
    (call $cb_set_text_len (local.get $sw) (local.get $slen))
    (if (i32.and
          (i32.eq (call $cb_variant (local.get $sw)) (i32.const 2))
          (i32.ne (call $cb_edit_hwnd (local.get $sw)) (i32.const 0)))
      (then
        (call $cb_set_suppress_edit_notify (local.get $sw) (i32.const 1))
        (drop (call $wnd_send_message
          (call $cb_edit_hwnd (local.get $sw))
          (i32.const 0x000C) (i32.const 0) (local.get $buf_g)))
        (call $cb_set_suppress_edit_notify (local.get $sw) (i32.const 0)))))

  (func $combobox_wndproc (param $hwnd i32) (param $msg i32) (param $wParam i32) (param $lParam i32) (result i32)
    (local $state i32) (local $state_w i32) (local $cs_w i32)
    (local $hdc i32) (local $sz i32) (local $w i32) (local $h i32)
    (local $name_ptr i32) (local $text_len i32)
    (local $idx i32) (local $slen i32) (local $count i32)
    (local $arrow_x i32) (local $variant i32) (local $lb i32)
    (local $style i32) (local $cy i32) (local $cmd i32) (local $notif i32)
    (local $parent i32) (local $ctrl_id i32) (local $field_h i32)
    (local $px i32) (local $py i32)
    (local $scan_slot i32) (local $sibling_hwnd i32)
    (local $combo_max_x i32) (local $sibling_right i32)
    (local $paint_state_w ptr<ControlTextState>) (local $edit_text_w ptr<ControlTextState>)
    (local $paint_state_g i32)
    (local $prev_lb i32) (local $prev_edit i32) (local $prev_popup i32)

    (local.set $field_h (i32.const 21))
    (local.set $state (call $wnd_get_state_ptr (local.get $hwnd)))

    ;; ---------- WM_CREATE ----------
    (if (i32.eq (local.get $msg) (i32.const 0x0001))
      (then
        (local.set $cs_w (call $g2w (local.get $lParam)))
        (local.set $name_ptr (i32.load offset=36 (local.get $cs_w)))
        (local.set $style (i32.load offset=32 (local.get $cs_w)))
        (local.set $variant (i32.and (local.get $style) (i32.const 0x3)))
        (if (i32.eqz (local.get $variant)) (then (local.set $variant (i32.const 3))))
        ;; A toolbar-hosted combo can be sent WM_CREATE a second time (MFC
        ;; creates it 288 wide, then the toolbar lays it out again). The old
        ;; state block is still on $hwnd here, so carry its children across:
        ;; creating a second inner EDIT left the first one orphaned at the
        ;; original width, painting white over the drop arrow it no longer
        ;; had room for.
        (if (local.get $state)
          (then
            (local.set $prev_lb
              (call $cb_lb_hwnd (call $g2w (local.get $state))))
            (local.set $prev_popup
              (call $cb_popup_hwnd (call $g2w (local.get $state))))
            (local.set $prev_edit
              (call $cb_edit_hwnd (call $g2w (local.get $state))))))
        (local.set $state (call $heap_alloc (i32.const 40)))
        (local.set $state_w (call $g2w (local.get $state)))
        (call $cb_set_text_ptr (local.get $state_w) (i32.const 0))
        (call $cb_set_text_len (local.get $state_w) (i32.const 0))
        (call $cb_set_style (local.get $state_w) (local.get $style))
        ;; CREATESTRUCT.hMenu is not copied in: it is already CONTROL_TABLE+4.
        ;; Readers mask it to 16 bits at the point of use, where the WM_COMMAND
        ;; wParam packing needs that, rather than truncating the stored id.
        (call $cb_set_cur_sel (local.get $state_w) (i32.const -1))
        (call $cb_set_lb_hwnd (local.get $state_w) (local.get $prev_lb))
        (call $cb_set_popup_hwnd (local.get $state_w) (local.get $prev_popup))
        (call $cb_set_edit_hwnd (local.get $state_w) (local.get $prev_edit))
        (call $cb_set_is_dropped (local.get $state_w) (i32.const 0))
        (call $cb_set_variant (local.get $state_w) (local.get $variant))
        (call $cb_set_suppress_edit_notify (local.get $state_w) (i32.const 0))
        (if (local.get $name_ptr)
          (then
            (local.set $text_len (call $strlen (call $g2w (local.get $name_ptr))))
            (call $cb_set_text_ptr (local.get $state_w)
              (call $ctrl_text_dup (local.get $name_ptr) (local.get $text_len)))
            (call $cb_set_text_len (local.get $state_w) (local.get $text_len))))
        (call $wnd_set_state_ptr (local.get $hwnd) (local.get $state))
        ;; Create inner listbox child filling the dropped area. Geometry from
        ;; CREATESTRUCT: cx at +20, cy at +16. Listbox is at (0, FIELD_H, cx, cy-FIELD_H).
        ;; CBS_SIMPLE keeps it always visible; others start hidden.
        (local.set $w (i32.load offset=20 (local.get $cs_w)))
        (local.set $cy (i32.load offset=16 (local.get $cs_w)))
        (local.set $h (i32.sub (local.get $cy) (local.get $field_h)))
        (if (i32.lt_s (local.get $h) (i32.const 32))
          (then (local.set $h (i32.const 64)))) ;; minimum sensible dropdown
        ;; Listbox style: WS_CHILD(0x40000000) | WS_VSCROLL(0x00200000) | WS_BORDER(0x00800000)
        ;; + WS_VISIBLE(0x10000000) only for CBS_SIMPLE.
        (local.set $style (i32.const 0x40A00000))
        (if (i32.eq (local.get $variant) (i32.const 1))
          (then (local.set $style (i32.or (local.get $style) (i32.const 0x10000000)))))
        (if (local.get $prev_lb)
          (then (local.set $lb (local.get $prev_lb)))
          (else
        (local.set $lb (call $ctrl_create_child (local.get $hwnd) (i32.const 4)
                          (i32.const 1000) ;; synthetic ctrl_id for inner listbox
                          (i32.const 0)
                          (select (i32.const 0) (local.get $field_h) (i32.eq (local.get $variant) (i32.const 1)))
                          (local.get $w)
                          (select (local.get $cy) (local.get $h) (i32.eq (local.get $variant) (i32.const 1)))
                          (local.get $style) (i32.const 0)))))
        (call $cb_set_lb_hwnd (local.get $state_w) (local.get $lb))
        ;; CBS_SIMPLE: always-dropped state.
        (if (i32.eq (local.get $variant) (i32.const 1))
          (then (call $cb_set_is_dropped (local.get $state_w) (i32.const 1))))
        ;; CBS_DROPDOWN (variant=2): create EDIT child filling the field
        ;; area minus the arrow box (18px wide on right). Style: WS_CHILD |
        ;; WS_VISIBLE | ES_AUTOHSCROLL(0x80). Field width = w - 18 to leave
        ;; room for the arrow.
        (if (i32.and (i32.eq (local.get $variant) (i32.const 2))
                     (i32.eqz (local.get $prev_edit)))
          (then
            (call $cb_set_edit_hwnd (local.get $state_w)
              (call $ctrl_create_child (local.get $hwnd) (i32.const 2)
                (i32.const 1001) ;; synthetic ctrl_id for inner edit
                (i32.const 2) (i32.const 2)
                (i32.sub (local.get $w) (i32.const 20))
                (i32.sub (local.get $field_h) (i32.const 4))
                (i32.const 0x50000080)  ;; WS_CHILD|WS_VISIBLE|ES_AUTOHSCROLL
                (i32.load offset=36 (local.get $cs_w)))))) ;; pass initial title
        ;; Dropdown variants (2/3): pre-allocate a WS_POPUP shell sized to the
        ;; listbox area. Hidden until $combobox_open_dropdown shows it. Put the
        ;; listbox under that popup immediately so it never appears among the
        ;; dialog's EnumChildWindows descendants before the first drop.
        (if (i32.and (i32.ne (local.get $variant) (i32.const 1))
                     (i32.eqz (local.get $prev_popup)))
          (then
            (call $cb_set_popup_hwnd (local.get $state_w)
              (call $combo_create_popup (local.get $hwnd) (local.get $w) (local.get $h)))
            (call $wnd_set_parent
              (local.get $lb) (call $cb_popup_hwnd (local.get $state_w)))
            (call $host_set_parent
              (local.get $lb) (call $cb_popup_hwnd (local.get $state_w)))
            (call $ctrl_geom_set (call $wnd_table_find (local.get $lb))
              (i32.const 0) (i32.const 0) (local.get $w) (local.get $h))))
        ;; MFC toolbar-hosted combo boxes are often created at (0,0) and then
        ;; left for common-control layout to position. Keep additional direct
        ;; COMBOBOX children of the same ToolbarWindow32 from covering the
        ;; first combo field when no explicit move has arrived yet.
        (local.set $parent (call $wnd_get_parent (local.get $hwnd)))
        (if (i32.and
              (i32.and
                (i32.eq (call $ctrl_table_get_class (local.get $parent)) (i32.const 21))
                (i32.eq (call $ctrl_get_x_s (local.get $hwnd)) (i32.const 0)))
              (i32.eq (call $ctrl_get_y_s (local.get $hwnd)) (i32.const 0)))
          (then
            (local.set $scan_slot (i32.const 0))
            (local.set $combo_max_x (i32.const 0))
            (block $combo_scan_done (loop $combo_scan
              (local.set $scan_slot
                (call $wnd_next_child_slot (local.get $parent) (local.get $scan_slot)))
              (br_if $combo_scan_done (i32.lt_s (local.get $scan_slot) (i32.const 0)))
              (local.set $sibling_hwnd (call $wnd_slot_hwnd (local.get $scan_slot)))
              (if (i32.and
                    (i32.ne (local.get $sibling_hwnd) (local.get $hwnd))
                    (i32.eq (call $ctrl_table_get_class (local.get $sibling_hwnd)) (i32.const 5)))
                (then
                  (local.set $sibling_right
                    (i32.add
                      (i32.add
                        (call $ctrl_get_x_s (local.get $sibling_hwnd))
                        (i32.and
                          (call $ctrl_get_wh_packed (local.get $sibling_hwnd))
                          (i32.const 0xFFFF)))
                      (i32.const 4)))
                  (if (i32.gt_s (local.get $sibling_right) (local.get $combo_max_x))
                    (then (local.set $combo_max_x (local.get $sibling_right))))))
              (local.set $scan_slot (i32.add (local.get $scan_slot) (i32.const 1)))
              (br $combo_scan)))
            (if (i32.gt_s (local.get $combo_max_x) (i32.const 0))
              (then
                (call $host_move_window
                  (local.get $hwnd)
                  (local.get $combo_max_x)
                  (i32.const 0)
                  (local.get $w)
                  (local.get $cy)
                  (i32.const 0))
                (call $ctrl_geom_sync
                  (local.get $hwnd)
                  (local.get $combo_max_x)
                  (i32.const 0)
                  (local.get $w)
                  (local.get $field_h)
                  (i32.const 0))
                (call $defwndproc_do_nccalcsize (local.get $hwnd))))))
        (return (i32.const 0))))

    ;; ---------- WM_DESTROY ----------
    (if (i32.eq (local.get $msg) (i32.const 0x0002))
      (then
        (if (local.get $state)
          (then
            (local.set $state_w (call $g2w (local.get $state)))
            ;; A dropdown's listbox belongs to the top-level popup from
            ;; creation until the first close reparents it to the combo.  The
            ;; dialog's child walk therefore cannot assume it already removed
            ;; that listbox.  Destroy the owned popup as a real window subtree:
            ;; this reaches a never-opened listbox, sends the normal destroy
            ;; messages, and removes both guest and renderer window records.
            (if (call $cb_popup_hwnd (local.get $state_w))
              (then (call $wnd_destroy_recursive
                (call $cb_popup_hwnd (local.get $state_w)))))
            (call $heap_free (call $cb_text_ptr (local.get $state_w)))
            (call $heap_free (local.get $state))
            (call $wnd_set_state_ptr (local.get $hwnd) (i32.const 0))))
        (if (i32.eq (global.get $combo_open_hwnd) (local.get $hwnd))
          (then (global.set $combo_open_hwnd (i32.const 0))))
        (return (i32.const 0))))

    (if (i32.eqz (local.get $state)) (then (return (i32.const 0))))
    (local.set $state_w (call $g2w (local.get $state)))
    (local.set $variant (call $cb_variant (local.get $state_w)))
    (local.set $lb      (call $cb_lb_hwnd (local.get $state_w)))

    ;; ---------- WM_SETTEXT ----------
    ;; CBS_DROPDOWN (variant=2): forward to inner edit; the edit owns the text.
    (if (i32.eq (local.get $msg) (i32.const 0x000C))
      (then
        (if (i32.eq (local.get $variant) (i32.const 2))
          (then
            ;; WordPad converts RichEdit 2.0's empty-document 32767-twip
            ;; sentinel to literal point-size text "1638.5". Normalize that
            ;; exact value only in its toolbar size combo (control id 166).
            (if (i32.and
                  (i32.eq (i32.and (call $ctrl_table_get_id (local.get $hwnd)) (i32.const 0xFFFF)) (i32.const 166))
                  (i32.and
                    (i32.eq (call $strlen (call $g2w (local.get $lParam))) (i32.const 6))
                    (i32.and
                      (i32.eq (i32.load (call $g2w (local.get $lParam))) (i32.const 0x38333631))
                      (i32.eq (i32.load16_u offset=4 (call $g2w (local.get $lParam))) (i32.const 0x352E)))))
              (then
                (local.set $name_ptr (call $heap_alloc (i32.const 3)))
                (i32.store16 (call $g2w (local.get $name_ptr)) (i32.const 0x3031))
                (i32.store8 offset=2 (call $g2w (local.get $name_ptr)) (i32.const 0))
                (call $cb_set_suppress_edit_notify (local.get $state_w) (i32.const 1))
                (local.set $idx (call $wnd_send_message
                  (call $cb_edit_hwnd (local.get $state_w))
                  (i32.const 0x000C) (local.get $wParam) (local.get $name_ptr)))
                (call $cb_set_suppress_edit_notify (local.get $state_w) (i32.const 0))
                (call $heap_free (local.get $name_ptr))
                (return (local.get $idx))))
            (call $cb_set_suppress_edit_notify (local.get $state_w) (i32.const 1))
            (local.set $idx (call $wnd_send_message
              (call $cb_edit_hwnd (local.get $state_w))
              (i32.const 0x000C) (local.get $wParam) (local.get $lParam)))
            (call $cb_set_suppress_edit_notify (local.get $state_w) (i32.const 0))
            (return (local.get $idx))))
        (call $heap_free (call $cb_text_ptr (local.get $state_w)))
        (call $cb_set_text_ptr (local.get $state_w) (i32.const 0))
        (call $cb_set_text_len (local.get $state_w) (i32.const 0))
        (if (local.get $lParam)
          (then
            (local.set $text_len (call $strlen (call $g2w (local.get $lParam))))
            (call $cb_set_text_ptr (local.get $state_w)
              (call $ctrl_text_dup (local.get $lParam) (local.get $text_len)))
            (call $cb_set_text_len (local.get $state_w) (local.get $text_len))))
        (call $invalidate_hwnd (local.get $hwnd))
        (if (call $wnd_is_effectively_visible (local.get $hwnd))
          (then
            (drop (call $edit_wndproc
              (local.get $hwnd) (i32.const 0x000F)
              (i32.const 0) (i32.const 0)))
            (call $update_clear_hwnd (local.get $hwnd))
            (call $paint_flag_clear_hwnd (local.get $hwnd))))
        (return (i32.const 1))))

    ;; ---------- WM_GETTEXT ----------
    (if (i32.eq (local.get $msg) (i32.const 0x000D))
      (then
        (if (i32.eq (local.get $variant) (i32.const 2))
          (then (return (call $wnd_send_message
                          (call $cb_edit_hwnd (local.get $state_w))
                          (i32.const 0x000D) (local.get $wParam) (local.get $lParam)))))
        (if (i32.eqz (local.get $wParam)) (then (return (i32.const 0))))
        (local.set $text_len (call $cb_text_len (local.get $state_w)))
        (if (i32.ge_u (local.get $text_len) (local.get $wParam))
          (then (local.set $text_len (i32.sub (local.get $wParam) (i32.const 1)))))
        (if (call $cb_text_ptr (local.get $state_w))
          (then (if (local.get $text_len)
                  (then (call $memcpy (call $g2w (local.get $lParam))
                                      (call $g2w (call $cb_text_ptr (local.get $state_w)))
                                      (local.get $text_len))))))
        (i32.store8 (i32.add (call $g2w (local.get $lParam)) (local.get $text_len)) (i32.const 0))
        (return (local.get $text_len))))

    ;; ---------- WM_GETTEXTLENGTH ----------
    (if (i32.eq (local.get $msg) (i32.const 0x000E))
      (then
        (if (i32.eq (local.get $variant) (i32.const 2))
          (then (return (call $wnd_send_message
                          (call $cb_edit_hwnd (local.get $state_w))
                          (i32.const 0x000E) (i32.const 0) (i32.const 0)))))
        (return (call $cb_text_len (local.get $state_w)))))

    ;; ---------- WM_SETFOCUS (0x0007) — fire CBN_SETFOCUS(3) ----------
    (if (i32.eq (local.get $msg) (i32.const 0x0007))
      (then
        (global.set $focus_hwnd (local.get $hwnd))
        (local.set $parent (call $wnd_get_parent (local.get $hwnd)))
        (if (local.get $parent)
          (then (drop (call $wnd_send_message (local.get $parent) (i32.const 0x0111)
                  (i32.or (i32.and (call $ctrl_table_get_id (local.get $hwnd)) (i32.const 0xFFFF))
                          (i32.shl (i32.const 3) (i32.const 16)))
                  (local.get $hwnd)))))
        (return (i32.const 0))))

    ;; ---------- WM_KILLFOCUS (0x0008) — close dropdown + fire CBN_KILLFOCUS(4) ----------
    (if (i32.eq (local.get $msg) (i32.const 0x0008))
      (then
        (if (call $cb_is_dropped (local.get $state_w))
          (then (call $combobox_close_dropdown (local.get $hwnd) (i32.const 0))))
        (if (i32.eq (global.get $focus_hwnd) (local.get $hwnd))
          (then (global.set $focus_hwnd (i32.const 0))))
        (local.set $parent (call $wnd_get_parent (local.get $hwnd)))
        (if (local.get $parent)
          (then (drop (call $wnd_send_message (local.get $parent) (i32.const 0x0111)
                  (i32.or (i32.and (call $ctrl_table_get_id (local.get $hwnd)) (i32.const 0xFFFF))
                          (i32.shl (i32.const 4) (i32.const 16)))
                  (local.get $hwnd)))))
        (return (i32.const 0))))

    ;; ---------- CB_RESETCONTENT (0x014B) ----------
    (if (i32.eq (local.get $msg) (i32.const 0x014B))
      (then
        (if (local.get $lb)
          (then (drop (call $wnd_send_message (local.get $lb) (i32.const 0x0184) (i32.const 0) (i32.const 0)))))
        (call $cb_set_cur_sel (local.get $state_w) (i32.const -1))
        (call $heap_free (call $cb_text_ptr (local.get $state_w)))
        (call $cb_set_text_ptr (local.get $state_w) (i32.const 0))
        (call $cb_set_text_len (local.get $state_w) (i32.const 0))
        (if (i32.and
              (i32.eq (local.get $variant) (i32.const 2))
              (i32.ne (call $cb_edit_hwnd (local.get $state_w)) (i32.const 0)))
          (then (drop (call $wnd_send_message
            (call $cb_edit_hwnd (local.get $state_w))
            (i32.const 0x000C) (i32.const 0) (i32.const 0)))))
        (call $invalidate_hwnd (local.get $hwnd))
        (return (i32.const 0))))

    ;; ---------- CB_GETCOUNT (0x0146) — forward to listbox LB_GETCOUNT (0x018B) ----------
    (if (i32.eq (local.get $msg) (i32.const 0x0146))
      (then (return (call $wnd_send_message (local.get $lb) (i32.const 0x018B) (i32.const 0) (i32.const 0)))))

    ;; ---------- CB_GETCURSEL (0x0147) ----------
    (if (i32.eq (local.get $msg) (i32.const 0x0147))
      (then (return (call $cb_cur_sel (local.get $state_w)))))

    ;; ---------- CB_ADDSTRING (0x0143) → LB_ADDSTRING (0x0180) ----------
    (if (i32.eq (local.get $msg) (i32.const 0x0143))
      (then (return (call $wnd_send_message (local.get $lb) (i32.const 0x0180) (i32.const 0) (local.get $lParam)))))

    ;; ---------- CB_INSERTSTRING (0x014A) → LB_INSERTSTRING (0x0181) ----------
    (if (i32.eq (local.get $msg) (i32.const 0x014A))
      (then (return (call $wnd_send_message (local.get $lb) (i32.const 0x0181) (local.get $wParam) (local.get $lParam)))))

    ;; ---------- CB_DELETESTRING (0x0144) → LB_DELETESTRING (0x0182) ----------
    (if (i32.eq (local.get $msg) (i32.const 0x0144))
      (then (return (call $wnd_send_message (local.get $lb) (i32.const 0x0182) (local.get $wParam) (i32.const 0)))))

    ;; ---------- CB_FINDSTRING (0x014C) / CB_FINDSTRINGEXACT (0x0158) ----------
    (if (i32.eq (local.get $msg) (i32.const 0x014C))
      (then (return (call $wnd_send_message (local.get $lb) (i32.const 0x018F) (local.get $wParam) (local.get $lParam)))))
    (if (i32.eq (local.get $msg) (i32.const 0x0158))
      (then (return (call $wnd_send_message (local.get $lb) (i32.const 0x01A2) (local.get $wParam) (local.get $lParam)))))

    ;; ---------- CB_SELECTSTRING (0x014D) ----------
    (if (i32.eq (local.get $msg) (i32.const 0x014D))
      (then
        (local.set $idx (call $wnd_send_message (local.get $lb) (i32.const 0x018C) (local.get $wParam) (local.get $lParam)))
        (if (i32.ge_s (local.get $idx) (i32.const 0))
          (then (call $combobox_sync_text (local.get $state_w))
                (call $invalidate_hwnd (local.get $hwnd))))
        (return (local.get $idx))))

    ;; ---------- CB_GETLBTEXT (0x0148) → LB_GETTEXT (0x0189) ----------
    (if (i32.eq (local.get $msg) (i32.const 0x0148))
      (then (return (call $wnd_send_message (local.get $lb) (i32.const 0x0189) (local.get $wParam) (local.get $lParam)))))

    ;; ---------- CB_GETLBTEXTLEN (0x0149) → LB_GETTEXTLEN (0x018A) ----------
    (if (i32.eq (local.get $msg) (i32.const 0x0149))
      (then (return (call $wnd_send_message (local.get $lb) (i32.const 0x018A) (local.get $wParam) (i32.const 0)))))

    ;; ---------- CB_SETCURSEL (0x014E) → LB_SETCURSEL + sync text ----------
    (if (i32.eq (local.get $msg) (i32.const 0x014E))
      (then
        (drop (call $wnd_send_message (local.get $lb) (i32.const 0x0186) (local.get $wParam) (i32.const 0)))
        (call $combobox_sync_text (local.get $state_w))
        (call $invalidate_hwnd (local.get $hwnd))
        (return (local.get $wParam))))

    ;; ---------- CB_GETDROPPEDSTATE (0x0157) ----------
    (if (i32.eq (local.get $msg) (i32.const 0x0157))
      (then (return (call $cb_is_dropped (local.get $state_w)))))

    ;; ---------- CB_SHOWDROPDOWN (0x014F) ----------
    (if (i32.eq (local.get $msg) (i32.const 0x014F))
      (then
        (if (local.get $wParam)
          (then (call $combobox_open_dropdown (local.get $hwnd)))
          (else (call $combobox_close_dropdown (local.get $hwnd) (i32.const 0))))
        (return (i32.const 1))))

    ;; ---------- CB_GETDROPPEDCONTROLRECT (0x0152) ----------
    ;; lParam = guest RECT* (filled with screen coords of dropped popup area).
    ;; Our dropdown is in-rect: report the listbox's rect translated to screen coords.
    ;; For simplicity, compute (0, FIELD_H, w, full_h) in window-local coords; caller
    ;; can translate via ClientToScreen. (Real Win32 returns screen coords; many apps
    ;; only check w/h though.)
    (if (i32.eq (local.get $msg) (i32.const 0x0152))
      (then
        (if (i32.eqz (local.get $lParam)) (then (return (i32.const 0))))
        (local.set $sz (call $ctrl_get_wh_packed (local.get $hwnd)))
        (local.set $w (i32.and (local.get $sz) (i32.const 0xFFFF)))
        (local.set $h (i32.shr_u (local.get $sz) (i32.const 16)))
        (i32.store          (call $g2w (local.get $lParam)) (i32.const 0))
        (i32.store offset=4 (call $g2w (local.get $lParam)) (local.get $field_h))
        (i32.store offset=8 (call $g2w (local.get $lParam)) (local.get $w))
        (i32.store offset=12 (call $g2w (local.get $lParam)) (local.get $h))
        (return (i32.const 1))))

    ;; ---------- CB_LIMITTEXT (0x0141) → EM_SETLIMITTEXT (0x00C5) ----------
    ;; Only meaningful for CBS_DROPDOWN; CBS_DROPDOWNLIST/SIMPLE return TRUE no-op.
    (if (i32.eq (local.get $msg) (i32.const 0x0141))
      (then
        (if (i32.eq (local.get $variant) (i32.const 2))
          (then (drop (call $wnd_send_message
                        (call $cb_edit_hwnd (local.get $state_w))
                        (i32.const 0x00C5) (local.get $wParam) (i32.const 0)))))
        (return (i32.const 1))))

    ;; ---------- CB_GETEDITSEL (0x0140) → EM_GETSEL (0x00B0) ----------
    (if (i32.eq (local.get $msg) (i32.const 0x0140))
      (then
        (if (i32.eq (local.get $variant) (i32.const 2))
          (then (return (call $wnd_send_message
                          (call $cb_edit_hwnd (local.get $state_w))
                          (i32.const 0x00B0) (local.get $wParam) (local.get $lParam)))))
        (return (i32.const 0))))

    ;; ---------- CB_SETEDITSEL (0x0142) → EM_SETSEL (0x00B1) ----------
    ;; Win32: lParam packs (start | end<<16); EM_SETSEL takes wParam=start, lParam=end.
    (if (i32.eq (local.get $msg) (i32.const 0x0142))
      (then
        (if (i32.eq (local.get $variant) (i32.const 2))
          (then (return (call $wnd_send_message
                          (call $cb_edit_hwnd (local.get $state_w))
                          (i32.const 0x00B1)
                          (i32.and (local.get $lParam) (i32.const 0xFFFF))
                          (i32.shr_u (local.get $lParam) (i32.const 16))))))
        (return (i32.const 0))))

    ;; ---------- CB_SETEXTENDEDUI / CB_GETEXTENDEDUI ----------
    ;; Stash in a high bit of the stored style word — see $cb_set_extended_ui.
    (if (i32.eq (local.get $msg) (i32.const 0x0155))
      (then
        (call $cb_set_extended_ui (local.get $state_w) (local.get $wParam))
        (return (i32.const 0))))
    (if (i32.eq (local.get $msg) (i32.const 0x0156))
      (then (return (call $cb_extended_ui (local.get $state_w)))))

    ;; ---------- CB_GETITEMDATA (0x0150) → LB_GETITEMDATA (0x0199) ----------
    (if (i32.eq (local.get $msg) (i32.const 0x0150))
      (then (return (call $wnd_send_message (local.get $lb) (i32.const 0x0199) (local.get $wParam) (i32.const 0)))))
    ;; ---------- CB_SETITEMDATA (0x0151) → LB_SETITEMDATA (0x019A) ----------
    (if (i32.eq (local.get $msg) (i32.const 0x0151))
      (then (return (call $wnd_send_message (local.get $lb) (i32.const 0x019A) (local.get $wParam) (local.get $lParam)))))

    ;; ---------- CB_SETITEMHEIGHT / CB_GETITEMHEIGHT ----------
    ;; WordPad's MFC toolbar combo setup adjusts the editable field/item
    ;; height once the CComboBox wrapper is attached. We keep a fixed Win98-ish
    ;; field height for now, but report success/height so setup can continue.
    (if (i32.eq (local.get $msg) (i32.const 0x0153))
      (then (return (i32.const 0))))
    (if (i32.eq (local.get $msg) (i32.const 0x0154))
      (then
        (return
          (select
            (local.get $field_h)
            (i32.const 16)
            (i32.eq (local.get $wParam) (i32.const -1))))))

    ;; ---------- CB_DIR / ownerdraw paths ----------
    ;; Fail-fast (memory: feedback_fail_fast_stubs).
    (if (i32.eq (local.get $msg) (i32.const 0x0145))   ;; CB_DIR
      (then (call $crash_unimplemented (i32.const 0x100))))

    ;; ---------- WM_LBUTTONDOWN (0x0201) — toggle dropdown ----------
    ;; While dropped with capture, lParam is in our window-local coords. We
    ;; only swallow clicks on the field; clicks below FIELD_H land on the
    ;; child listbox via z-order routing (or, when dropped with capture,
    ;; we route them to the listbox manually).
    (if (i32.eq (local.get $msg) (i32.const 0x0201))
      (then
        (local.set $px (i32.shr_s (i32.shl (local.get $lParam) (i32.const 16)) (i32.const 16)))
        (local.set $py (i32.shr_s (local.get $lParam) (i32.const 16)))
        (local.set $sz (call $ctrl_get_wh_packed (local.get $hwnd)))
        (local.set $w (i32.and (local.get $sz) (i32.const 0xFFFF)))
        ;; If dropped, click below field area → forward to listbox in lb-local coords.
        (if (call $cb_is_dropped (local.get $state_w))
          (then
            (if (i32.ge_s (local.get $py) (local.get $field_h))
              (then
                (if (i32.and
                      (i32.ge_s (local.get $px) (i32.const 0))
                      (i32.lt_s (local.get $px) (local.get $w)))
                  (then
                    (drop (call $wnd_send_message (local.get $lb) (i32.const 0x0201)
                            (local.get $wParam)
                            (i32.or (i32.and (local.get $px) (i32.const 0xFFFF))
                                    (i32.shl (i32.sub (local.get $py) (local.get $field_h)) (i32.const 16)))))
                    ;; Real Windows: clicking an item in the dropdown selects it
                    ;; AND closes the dropdown (accept). The listbox already
                    ;; updated cur_sel and fired LBN_SELCHANGE; close as accept.
                    ;; CBS_SIMPLE (variant=1) keeps its always-visible listbox
                    ;; embedded — close_dropdown is a no-op for it.
                    (if (i32.ne (local.get $variant) (i32.const 1))
                      (then (call $combobox_close_dropdown (local.get $hwnd) (i32.const 1))))
                    (return (i32.const 0)))
                  (else
                    ;; Click outside field, outside listbox → cancel-close.
                    (call $combobox_close_dropdown (local.get $hwnd) (i32.const 0))
                    (return (i32.const 0)))))))
          (else
            ;; Not dropped: any click on the field opens the dropdown (CBS_DROPDOWNLIST/
            ;; CBS_DROPDOWN). CBS_SIMPLE has no toggle behavior.
            (if (i32.ne (local.get $variant) (i32.const 1))
              (then
                (call $combobox_open_dropdown (local.get $hwnd))
                (return (i32.const 0))))))
        ;; Toggle when click hits field area while already dropped (closes via outside-test
        ;; above; but if click is INSIDE field, toggle close as cancel).
        (if (call $cb_is_dropped (local.get $state_w))
          (then (call $combobox_close_dropdown (local.get $hwnd) (i32.const 0))))
        (return (i32.const 0))))

    ;; ---------- WM_LBUTTONUP — when dropped with capture, route to listbox ----------
    (if (i32.eq (local.get $msg) (i32.const 0x0202))
      (then
        (if (call $cb_is_dropped (local.get $state_w))
          (then
            (local.set $py (i32.shr_s (local.get $lParam) (i32.const 16)))
            (if (i32.ge_s (local.get $py) (local.get $field_h))
              (then
                (local.set $px (i32.shr_s (i32.shl (local.get $lParam) (i32.const 16)) (i32.const 16)))
                (drop (call $wnd_send_message (local.get $lb) (i32.const 0x0202)
                        (local.get $wParam)
                        (i32.or (i32.and (local.get $px) (i32.const 0xFFFF))
                                (i32.shl (i32.sub (local.get $py) (local.get $field_h)) (i32.const 16)))))))))
        (return (i32.const 0))))

    ;; ---------- WM_KEYDOWN (0x0100) ----------
    ;; F4 (0x73) or Alt+Down (we approximate by VK_F4 since we don't have
    ;; modifier key state cleanly here): toggle dropdown.
    ;; Esc (0x1B): cancel-close. Enter (0x0D): accept-close (if dropped).
    ;; Arrow/PgUp/PgDn/Home/End: forward to listbox (which fires LBN_SELCHANGE
    ;; back to us via WM_COMMAND, where we'll sync_text + relay CBN_SELCHANGE).
    (if (i32.eq (local.get $msg) (i32.const 0x0100))
      (then
        (if (i32.eq (local.get $wParam) (i32.const 0x73))  ;; VK_F4
          (then
            (if (call $cb_is_dropped (local.get $state_w))
              (then (call $combobox_close_dropdown (local.get $hwnd) (i32.const 1)))
              (else (call $combobox_open_dropdown  (local.get $hwnd))))
            (return (i32.const 0))))
        (if (i32.eq (local.get $wParam) (i32.const 0x1B))  ;; VK_ESCAPE
          (then
            (if (call $cb_is_dropped (local.get $state_w))
              (then (call $combobox_close_dropdown (local.get $hwnd) (i32.const 0))))
            (return (i32.const 0))))
        ;; VK_TAB: dismiss dropdown (cancel) so focus-change leaves no stranded
        ;; popup. Real dialog tabstop navigation isn't wired up here, but at
        ;; least the dropdown shouldn't linger.
        (if (i32.eq (local.get $wParam) (i32.const 0x09))  ;; VK_TAB
          (then
            (if (call $cb_is_dropped (local.get $state_w))
              (then (call $combobox_close_dropdown (local.get $hwnd) (i32.const 0))))))
        (if (i32.eq (local.get $wParam) (i32.const 0x0D))  ;; VK_RETURN
          (then
            (if (call $cb_is_dropped (local.get $state_w))
              (then (call $combobox_close_dropdown (local.get $hwnd) (i32.const 1))))
            (return (i32.const 0))))
        ;; Navigation keys → forward to listbox.
        (if (i32.or
              (i32.or (i32.eq (local.get $wParam) (i32.const 0x28))   ;; VK_DOWN
                      (i32.eq (local.get $wParam) (i32.const 0x26)))  ;; VK_UP
              (i32.or
                (i32.or (i32.eq (local.get $wParam) (i32.const 0x24))  ;; VK_HOME
                        (i32.eq (local.get $wParam) (i32.const 0x23))) ;; VK_END
                (i32.or (i32.eq (local.get $wParam) (i32.const 0x21))  ;; VK_PRIOR
                        (i32.eq (local.get $wParam) (i32.const 0x22))))) ;; VK_NEXT
          (then
            ;; Suppress click-driven close: keyboard nav fires LBN_SELCHANGE
            ;; via the listbox synchronously, but we don't want that to close
            ;; the dropdown.
            (global.set $combo_kbd_nav_active (i32.const 1))
            (drop (call $wnd_send_message (local.get $lb) (i32.const 0x0100)
                    (local.get $wParam) (local.get $lParam)))
            (global.set $combo_kbd_nav_active (i32.const 0))
            (return (i32.const 0))))
        (return (i32.const 0))))

    ;; ---------- WM_COMMAND (0x0111) from inner listbox or edit ----------
    ;; Listbox: LBN_SELCHANGE/LBN_DBLCLK → sync_text + relay CBN_SELCHANGE.
    ;; Edit (variant=2 only): EN_CHANGE(0x0300) → CBN_EDITCHANGE(5);
    ;;                        EN_UPDATE(0x0400) → CBN_EDITUPDATE(6);
    ;;                        EN_SETFOCUS(0x0100) → CBN_SETFOCUS(3);
    ;;                        EN_KILLFOCUS(0x0200) → CBN_KILLFOCUS(4).
    ;; The focus pair matters as much as the selection ones: a CBS_DROPDOWN
    ;; combo never holds the focus itself, its edit child does, so a combo
    ;; that only fired CBN_SETFOCUS/CBN_KILLFOCUS from its own WM_SETFOCUS/
    ;; WM_KILLFOCUS never fired them at all. WordPad's format bar applies the
    ;; picked font on CBN_KILLFOCUS of the font-name combo (it has no
    ;; CBN_SELCHANGE/CBN_SELENDOK handler), so picking a font from the toolbar
    ;; changed the combo's own text and nothing else.
    ;; Focus moving between the combo's own parts (field ↔ dropdown list) is
    ;; not a focus loss for the combo, so it must not relay CBN_KILLFOCUS.
    (if (i32.eq (local.get $msg) (i32.const 0x0111))
      (then
        ;; Edit notification path
        (if (i32.and (i32.eq (local.get $variant) (i32.const 2))
                     (i32.eq (local.get $lParam)
                             (call $cb_edit_hwnd (local.get $state_w))))
          (then
            (local.set $notif (i32.shr_u (local.get $wParam) (i32.const 16)))
            (local.set $cmd (i32.const 0))  ;; CBN_* code
            (if (i32.eq (local.get $notif) (i32.const 0x0300))  ;; EN_CHANGE
              (then (local.set $cmd (i32.const 5))))           ;; CBN_EDITCHANGE
            (if (i32.eq (local.get $notif) (i32.const 0x0400))  ;; EN_UPDATE
              (then (local.set $cmd (i32.const 6))))           ;; CBN_EDITUPDATE
            (if (i32.eq (local.get $notif) (i32.const 0x0100))  ;; EN_SETFOCUS
              (then (local.set $cmd (i32.const 3))))           ;; CBN_SETFOCUS
            (if (i32.eq (local.get $notif) (i32.const 0x0200))  ;; EN_KILLFOCUS
              (then
                ;; $focus_hwnd already names the incoming window: SetFocus
                ;; updates it before the outgoing WM_KILLFOCUS is delivered.
                (if (i32.eqz (i32.or
                      (i32.eq (global.get $focus_hwnd) (local.get $hwnd))
                      (i32.or
                        (i32.eq (global.get $focus_hwnd)
                                (call $cb_edit_hwnd (local.get $state_w)))
                        (i32.eq (global.get $focus_hwnd) (local.get $lb)))))
                  (then (local.set $cmd (i32.const 4))))))    ;; CBN_KILLFOCUS
            ;; CBN_EDITUPDATE/CBN_EDITCHANGE describe user edits. A combo's
            ;; own WM_SETTEXT/selection synchronization changes the inner EDIT
            ;; too, but must not recursively notify its parent as user input.
            (if (i32.and
                  (call $cb_suppress_edit_notify (local.get $state_w))
                  (i32.or (i32.eq (local.get $cmd) (i32.const 5))
                          (i32.eq (local.get $cmd) (i32.const 6))))
              (then (return (i32.const 0))))
            (if (local.get $cmd)
              (then
                (local.set $parent (call $wnd_get_parent (local.get $hwnd)))
                (local.set $ctrl_id (i32.and (call $ctrl_table_get_id (local.get $hwnd)) (i32.const 0xFFFF)))
                (if (local.get $parent)
                  (then
                    ;; Every relayed edit notification is posted. They originate
                    ;; inside the edit child's own message dispatch, and their
                    ;; parent handlers may run guest callbacks that must own the
                    ;; main pump. Inno's skinned setup, for example, changes a
                    ;; combo during InitializeWizard; synchronously invoking its
                    ;; CBN_EDITCHANGE handler recursively enters Pascal Script.
                    (drop (call $post_queue_push
                      (local.get $parent) (i32.const 0x0111)
                      (i32.or (local.get $ctrl_id)
                              (i32.shl (local.get $cmd) (i32.const 16)))
                      (local.get $hwnd)))))))
            (return (i32.const 0))))
        (if (i32.eq (local.get $lParam) (local.get $lb))
          (then
            (local.set $notif (i32.shr_u (local.get $wParam) (i32.const 16)))
            ;; LBN_SETFOCUS(4)/LBN_KILLFOCUS(5) from the dropdown list are the
            ;; combo's own focus changes: clicking the field focuses the list,
            ;; and the app that then takes the focus back (WordPad's format bar
            ;; puts it on the view) is what ends the combo's edit.
            (if (i32.or (i32.eq (local.get $notif) (i32.const 4))
                        (i32.eq (local.get $notif) (i32.const 5)))
              (then
                (local.set $cmd (i32.const 0))
                (if (i32.eq (local.get $notif) (i32.const 4))
                  (then (local.set $cmd (i32.const 3)))          ;; CBN_SETFOCUS
                  (else
                    ;; Focus moving inside the combo (list ↔ field) is not a
                    ;; focus loss for the combo itself.
                    (if (i32.eqz (i32.or
                          (i32.eq (global.get $focus_hwnd) (local.get $hwnd))
                          (i32.or
                            (i32.eq (global.get $focus_hwnd)
                                    (call $cb_edit_hwnd (local.get $state_w)))
                            (i32.eq (global.get $focus_hwnd) (local.get $lb)))))
                      (then (local.set $cmd (i32.const 4))))))   ;; CBN_KILLFOCUS
                (if (local.get $cmd)
                  (then
                    (local.set $parent (call $wnd_get_parent (local.get $hwnd)))
                    (local.set $ctrl_id (i32.and (call $ctrl_table_get_id (local.get $hwnd)) (i32.const 0xFFFF)))
                    (if (local.get $parent)
                      (then (drop (call $post_queue_push (local.get $parent) (i32.const 0x0111)
                              (i32.or (local.get $ctrl_id) (i32.shl (local.get $cmd) (i32.const 16)))
                              (local.get $hwnd)))))))
                (return (i32.const 0))))
            ;; LBN_SELCHANGE(1) or LBN_DBLCLK(2) → sync text + relay CBN_SELCHANGE
            (if (i32.or (i32.eq (local.get $notif) (i32.const 1))
                        (i32.eq (local.get $notif) (i32.const 2)))
              (then
                (call $combobox_sync_text (local.get $state_w))
                (local.set $parent (call $wnd_get_parent (local.get $hwnd)))
                (local.set $ctrl_id (i32.and (call $ctrl_table_get_id (local.get $hwnd)) (i32.const 0xFFFF)))
                ;; CBN_SELCHANGE(1) → parent dialog. POSTED for the same
                ;; reentrancy reason as CBN_SELENDOK below (close_dropdown).
                (if (local.get $parent)
                  (then (drop (call $post_queue_push (local.get $parent) (i32.const 0x0111)
                          (i32.or (local.get $ctrl_id) (i32.shl (i32.const 1) (i32.const 16)))
                          (local.get $hwnd)))))
                (call $invalidate_hwnd (local.get $hwnd))
                ;; Click-driven LBN_SELCHANGE/LBN_DBLCLK while dropped →
                ;; accept-close. Keyboard nav suppresses this via
                ;; $combo_kbd_nav_active so VK_DOWN/UP can scroll the listbox
                ;; without dismissing the dropdown. CBS_SIMPLE (variant=1)
                ;; has no dropdown to close.
                (if (i32.and
                      (i32.ne (call $cb_is_dropped (local.get $state_w)) (i32.const 0))
                      (i32.eqz (global.get $combo_kbd_nav_active)))
                  (then
                    (if (i32.ne (local.get $variant) (i32.const 1))
                      (then (call $combobox_close_dropdown (local.get $hwnd) (i32.const 1))))))
                (return (i32.const 0))))))
        (return (i32.const 0))))

    ;; ---------- WM_PAINT ----------
    (if (i32.eq (local.get $msg) (i32.const 0x000F))
      (then
        (local.set $hdc (i32.add (local.get $hwnd) (i32.const 0x40000)))
        (local.set $sz (call $ctrl_get_wh_packed (local.get $hwnd)))
        (local.set $w (i32.and (local.get $sz) (i32.const 0xFFFF)))
        (local.set $h (local.get $field_h))
        ;; Skip field paint for CBS_SIMPLE — entire window is the listbox.
        (if (i32.ne (local.get $variant) (i32.const 1))
          (then
            ;; Toolbar-hosted CBS_DROPDOWN inner EDIT children are not
            ;; independently composited, so paint the field here for both
            ;; editable and read-only dropdown variants.
            (drop (call $host_gdi_fill_rect (local.get $hdc)
                    (i32.const 0) (i32.const 0)
                    (local.get $w) (local.get $h)
                    (i32.const 0x30010)))  ;; WHITE_BRUSH
            (drop (call $host_gdi_draw_edge (local.get $hdc)
                    (i32.const 0) (i32.const 0)
                    (local.get $w) (local.get $h)
                    (i32.const 0x0A) (i32.const 0x0F)))  ;; EDGE_SUNKEN | BF_RECT
            (local.set $arrow_x (i32.sub (local.get $w) (i32.const 18)))
            (drop (call $host_gdi_fill_rect (local.get $hdc)
                    (local.get $arrow_x) (i32.const 2)
                    (i32.sub (local.get $w) (i32.const 2))
                    (i32.sub (local.get $h) (i32.const 2))
                    (i32.const 0x30011)))  ;; LTGRAY_BRUSH
            ;; Arrow box edge: pressed (sunken) when dropped, raised when closed.
            (drop (call $host_gdi_draw_edge (local.get $hdc)
                    (local.get $arrow_x) (i32.const 2)
                    (i32.sub (local.get $w) (i32.const 2))
                    (i32.sub (local.get $h) (i32.const 2))
                    (select (i32.const 0x0A) (i32.const 0x05) (call $cb_is_dropped (local.get $state_w)))
                    (i32.const 0x0F)))
            ;; Triangle ▼
            (drop (call $host_gdi_fill_rect (local.get $hdc)
                    (i32.add (local.get $arrow_x) (i32.const 4)) (i32.const 9)
                    (i32.add (local.get $arrow_x) (i32.const 11)) (i32.const 10)
                    (i32.const 0x30014)))
            (drop (call $host_gdi_fill_rect (local.get $hdc)
                    (i32.add (local.get $arrow_x) (i32.const 5)) (i32.const 10)
                    (i32.add (local.get $arrow_x) (i32.const 10)) (i32.const 11)
                    (i32.const 0x30014)))
            (drop (call $host_gdi_fill_rect (local.get $hdc)
                    (i32.add (local.get $arrow_x) (i32.const 6)) (i32.const 11)
                    (i32.add (local.get $arrow_x) (i32.const 9)) (i32.const 12)
                    (i32.const 0x30014)))
            (drop (call $host_gdi_fill_rect (local.get $hdc)
                    (i32.add (local.get $arrow_x) (i32.const 7)) (i32.const 12)
                    (i32.add (local.get $arrow_x) (i32.const 8)) (i32.const 13)
                    (i32.const 0x30014)))
            (drop (call $host_gdi_select_object (local.get $hdc) (i32.const 0x30021)))
            (drop (call $host_gdi_set_bk_mode (local.get $hdc) (i32.const 1)))
            ;; CBS_DROPDOWN delegates text ownership to its inner EDIT. Paint
            ;; from that same state so WM_PAINT agrees with WM_GETTEXT.
            (local.set $paint_state_w (cast ptr<ControlTextState> (local.get $state_w)))
            (if (i32.eq (local.get $variant) (i32.const 2))
              (then
                (local.set $paint_state_g
                  (call $wnd_get_state_ptr (call $cb_edit_hwnd (local.get $state_w))))
                (if (local.get $paint_state_g)
                  (then
                    (local.set $edit_text_w (cast ptr<ControlTextState>
                      (call $g2w (local.get $paint_state_g))))
                    (local.set $paint_state_w (local.get $edit_text_w))))))
            (if (i32.and
                  (i32.ne (local.get $paint_state_w) (i32.const 0))
                  (i32.ne (load.field ControlTextState text_buf_ptr (local.get $paint_state_w)) (i32.const 0)))
              (then
                (drop (call $host_gdi_draw_text (local.get $hdc)
                        (call $g2w (load.field ControlTextState text_buf_ptr (local.get $paint_state_w)))
                        (load.field.memarg ControlTextState text_len (local.get $paint_state_w))
                        (call $paint_rect (i32.const 4) (i32.const 2)
                                          (i32.sub (local.get $arrow_x) (i32.const 2))
                                          (i32.sub (local.get $h) (i32.const 2)))
                        (i32.const 0x24) (i32.const 0)))))))
        (return (i32.const 0))))

    ;; Default
    (i32.const 0)
  )

  ;; ============================================================
  ;; Edit WndProc
  ;; ============================================================
  ;; Status: STEP 4 — dormant. No path delivers WM_CREATE to an EDIT
  ;; class hwnd today; the new code is unreachable until STEP 5 wires
  ;; WAT-side dialog creation through $create_findreplace_dialog.
  ;;
  ;; EditState (32 bytes, allocated in WM_CREATE)
  ;;   +0   text_buf_ptr   guest ptr (NUL-terminated)
  ;;   +4   text_len       chars (excluding NUL)
  ;;   +8   text_cap       allocated capacity (excluding NUL slot)
  ;;   +12  cursor         char position
  ;;   +16  sel_anchor     selection anchor (== cursor → no selection)
  ;;   +20  scroll_top     reserved for multi-line (0 in single-line)
  ;;   +24  flags          bit0=multiline bit1=password bit2=readonly bit3=focused
  ;;                       bit4=dragging selection bit5=caret visible
  ;;   +28  max_length     0 = unlimited
  ;;   +32  font           HFONT from WM_SETFONT (0 = default GUI font)
  ;;   +36  scroll_x       horizontal scroll offset in pixels (WS_HSCROLL)

  ;; Word wrap is on when the edit has WS_VSCROLL and cannot scroll sideways:
  ;; no ES_AUTOHSCROLL, and no WS_HSCROLL either. USER32 implies the style bit
  ;; from the scrollbar on a multiline edit ("if (WS_HSCROLL) style |=
  ;; ES_AUTOHSCROLL"), which is why Win98 Notepad opens *unwrapped* — it asks
  ;; for both bars and no ES_AUTO* at all, and Word Wrap is it recreating the
  ;; edit without WS_HSCROLL. Reading only ES_AUTOHSCROLL wrapped it from the
  ;; start, against the real control.
  ;;
  ;; The two halves have to agree: a wrapped edit has nothing to scroll
  ;; horizontally over and its paint path draws no bottom strip, so it must not
  ;; reserve one either. Where they disagreed the control left a 16px band it
  ;; never painted into, showing whatever the parent last erased there.
  (func $edit_wraps (param $hwnd i32) (result i32)
    (local $style i32)
    (local.set $style (call $wnd_get_style (local.get $hwnd)))
    (i32.and
      (i32.ne (i32.and (local.get $style) (i32.const 0x00200000)) (i32.const 0))
      (i32.eqz (i32.and (local.get $style) (i32.const 0x00100080)))))

  ;; WS_HSCROLL that actually costs the client 16px at the bottom: the style
  ;; bit, minus the wrapped case above. Every place that reserves the strip
  ;; must agree with the painter, or the caret and the hit-test measure a
  ;; viewport a different height from the one on screen.
  (func $edit_hscroll_reserved (param $hwnd i32) (result i32)
    (i32.and
      (i32.ne
        (i32.and (call $wnd_get_style (local.get $hwnd)) (i32.const 0x00100000))
        (i32.const 0))
      (i32.eqz (call $edit_wraps (local.get $hwnd)))))

  ;; Keep the caret inside the viewport, which is what USER's EM_SCROLLCARET
  ;; does and what every EDIT operation that moves the caret ends with. Without
  ;; it, typing past the last visible line keeps editing text nobody can see:
  ;; the buffer grows, the caret advances, and the window still shows line 1.
  ;; Returns 1 when the viewport moved, so callers can tell a scroll from a
  ;; plain edit if they ever need to.
  (func $edit_scroll_caret_into_view (param $hwnd i32) (result i32)
    (local $state i32) (local $state_w i32) (local $style i32)
    (local $sz i32) (local $w i32) (local $h i32)
    (local $visible i32) (local $line i32) (local $top i32)
    (local $total i32) (local $max i32)
    (local.set $state (call $wnd_get_state_ptr (local.get $hwnd)))
    (if (i32.eqz (local.get $state)) (then (return (i32.const 0))))
    (local.set $state_w (call $g2w (local.get $state)))
    (local.set $style (call $wnd_get_style (local.get $hwnd)))
    ;; ES_MULTILINE only: a single-line edit scrolls horizontally, and that is
    ;; handled by the painter's own left-clamp.
    (if (i32.eqz (i32.and (local.get $style) (i32.const 0x00000004)))
      (then (return (i32.const 0))))
    (local.set $sz (call $ctrl_get_wh_packed (local.get $hwnd)))
    (local.set $w (i32.and (local.get $sz) (i32.const 0xFFFF)))
    (local.set $h (i32.shr_u (local.get $sz) (i32.const 16)))
    (if (i32.and (local.get $style) (i32.const 0x00200000)) ;; WS_VSCROLL
      (then
        (if (i32.gt_u (local.get $w) (i32.const 16))
          (then (local.set $w (i32.sub (local.get $w) (i32.const 16)))))))
    (if (call $edit_hscroll_reserved (local.get $hwnd))
      (then
        (if (i32.gt_u (local.get $h) (i32.const 16))
          (then (local.set $h (i32.sub (local.get $h) (i32.const 16)))))))
    ;; Same viewport arithmetic the wheel handler and the painter use.
    (local.set $visible (i32.div_u (i32.sub (local.get $h) (i32.const 8)) (i32.const 16)))
    (if (i32.eqz (local.get $visible)) (then (local.set $visible (i32.const 1))))
    (if (call $edit_wraps (local.get $hwnd))
      (then
        ;; Wrapped: visual lines, so a wrapped paragraph counts for each row.
        (local.set $total (call $edit_layout_build (local.get $state_w)
          (i32.add (local.get $hwnd) (i32.const 0x40000)) (local.get $w)))
        (local.set $line (call $edit_layout_line_for_char (local.get $total)
          (load.field.memarg EditState cursor (local.get $state_w)))))
      (else
        (local.set $total (i32.add
          (call $edit_line_from_char (local.get $state_w)
            (load.field.memarg EditState text_len (local.get $state_w)))
          (i32.const 1)))
        (local.set $line (call $edit_line_from_char (local.get $state_w)
          (load.field.memarg EditState cursor (local.get $state_w))))))
    (local.set $top (load.field.memarg EditState scroll_top (local.get $state_w)))
    (if (i32.lt_s (local.get $line) (local.get $top))
      (then (local.set $top (local.get $line))))
    (if (i32.ge_s (local.get $line) (i32.add (local.get $top) (local.get $visible)))
      (then (local.set $top (i32.add (i32.sub (local.get $line) (local.get $visible))
                                     (i32.const 1)))))
    (local.set $max (i32.sub (local.get $total) (local.get $visible)))
    (if (i32.lt_s (local.get $max) (i32.const 0)) (then (local.set $max (i32.const 0))))
    (if (i32.gt_s (local.get $top) (local.get $max)) (then (local.set $top (local.get $max))))
    (if (i32.lt_s (local.get $top) (i32.const 0)) (then (local.set $top (i32.const 0))))
    (call $edit_publish_scroll_info (local.get $hwnd)
      (local.get $top) (local.get $total) (local.get $visible))
    (if (i32.eq (local.get $top) (load.field.memarg EditState scroll_top (local.get $state_w)))
      (then (return (i32.const 0))))
    (store.field.memarg EditState scroll_top (local.get $state_w) (local.get $top))
    (i32.const 1))

  ;; Publish the viewport into the window's scrollbar state, which is what an
  ;; EDIT does with SetScrollInfo after every change. $defwndproc_ncpaint
  ;; paints the strip straight out of SCROLL_TABLE, so without this the thumb
  ;; sits at the top of the track no matter where the text is scrolled to --
  ;; and a click on that stale thumb gets classified as a page, not a drag.
  (func $edit_publish_scroll_info (param $hwnd i32)
        (param $pos i32) (param $total i32) (param $visible i32)
    (local $slot i32) (local $base i32) (local $aux i32)
    (local.set $slot (call $wnd_table_find (local.get $hwnd)))
    (if (i32.lt_s (local.get $slot) (i32.const 0)) (then (return)))
    (local.set $base (call $scroll_record_addr (local.get $slot)))
    (local.set $aux (call $scroll_aux_addr (local.get $slot)))
    (if (i32.lt_s (local.get $total) (i32.const 1)) (then (local.set $total (i32.const 1))))
    (if (i32.lt_s (local.get $visible) (i32.const 1)) (then (local.set $visible (i32.const 1))))
    (i32.store offset=12 (local.get $base) (local.get $pos))
    (i32.store offset=16 (local.get $base) (i32.const 0))
    (i32.store offset=20 (local.get $base) (i32.sub (local.get $total) (i32.const 1)))
    (i32.store offset=8 (local.get $aux) (local.get $visible)))

  ;; Total lines and visible rows for a multiline edit, packed visible<<16 |
  ;; total. The wheel handler, the scrollbar click, the thumb drag and the
  ;; painter each computed this inline, and any drift between the four showed
  ;; up as a scrollbar that scrolled somewhere the text was not. It runs per
  ;; input event, not per pixel, so sharing it costs nothing measurable.
  (func $edit_view_metrics (param $hwnd i32) (param $state_w ptr<EditState>) (result i32)
    (local $style i32) (local $sz i32) (local $w i32) (local $h i32)
    (local $total i32) (local $visible i32)
    (local.set $style (call $wnd_get_style (local.get $hwnd)))
    (local.set $sz (call $ctrl_get_wh_packed (local.get $hwnd)))
    (local.set $w (i32.and (local.get $sz) (i32.const 0xFFFF)))
    (local.set $h (i32.shr_u (local.get $sz) (i32.const 16)))
    (if (i32.and (local.get $style) (i32.const 0x00200000)) ;; WS_VSCROLL
      (then
        (if (i32.gt_u (local.get $w) (i32.const 16))
          (then (local.set $w (i32.sub (local.get $w) (i32.const 16)))))))
    (if (call $edit_hscroll_reserved (local.get $hwnd))
      (then
        (if (i32.gt_u (local.get $h) (i32.const 16))
          (then (local.set $h (i32.sub (local.get $h) (i32.const 16)))))))
    (local.set $visible (i32.div_u
      (select (i32.sub (local.get $h) (i32.const 8)) (i32.const 1)
              (i32.gt_u (local.get $h) (i32.const 8)))
      (i32.const 16)))
    (if (i32.eqz (local.get $visible)) (then (local.set $visible (i32.const 1))))
    (if (call $edit_wraps (local.get $hwnd))
      (then (local.set $total (call $edit_layout_build (local.get $state_w)
        (i32.add (local.get $hwnd) (i32.const 0x40000)) (local.get $w))))
      (else (local.set $total (i32.add
        (call $edit_line_from_char (local.get $state_w)
          (load.field.memarg EditState text_len (local.get $state_w)))
        (i32.const 1)))))
    (if (i32.lt_s (local.get $total) (i32.const 1)) (then (local.set $total (i32.const 1))))
    (i32.or (i32.and (local.get $total) (i32.const 0xFFFF))
            (i32.shl (local.get $visible) (i32.const 16))))

  ;; Clamp and store a new first-visible line, publishing it to the scrollbar.
  ;; Returns 1 when the viewport actually moved.
  (func $edit_scroll_to (param $hwnd i32) (param $state_w ptr<EditState>) (param $top i32)
        (param $total i32) (param $visible i32) (result i32)
    (local $max i32)
    (local.set $max (i32.sub (local.get $total) (local.get $visible)))
    (if (i32.lt_s (local.get $max) (i32.const 0)) (then (local.set $max (i32.const 0))))
    (if (i32.gt_s (local.get $top) (local.get $max)) (then (local.set $top (local.get $max))))
    (if (i32.lt_s (local.get $top) (i32.const 0)) (then (local.set $top (i32.const 0))))
    (call $edit_publish_scroll_info (local.get $hwnd)
      (local.get $top) (local.get $total) (local.get $visible))
    (if (i32.eq (local.get $top) (load.field.memarg EditState scroll_top (local.get $state_w)))
      (then (return (i32.const 0))))
    (store.field.memarg EditState scroll_top (local.get $state_w) (local.get $top))
    (i32.const 1))

  ;; Drop-in for $invalidate_hwnd at the sites where the user moved the caret.
  (func $edit_invalidate_caret (param $hwnd i32)
    (drop (call $edit_scroll_caret_into_view (local.get $hwnd)))
    (call $invalidate_hwnd (local.get $hwnd)))

  ;; A real EDIT does not own a caret of its own: on WM_SETFOCUS it calls
  ;; CreateCaret + SetCaretPos + ShowCaret and USER draws and blinks it. Doing
  ;; the same here means one caret mechanism instead of two -- the compositor
  ;; blinks it, GetCaretPos answers about it, and the page can tell that
  ;; keystrokes have somewhere to land (which is what raises a phone keyboard)
  ;; without knowing anything about this control.
  (func $edit_reset_caret_timer (param $hwnd i32) (param $state_w ptr<EditState>)
    (global.set $tick_count (call $host_get_ticks))
    (store.field.memarg EditState flags (local.get $state_w)
      (i32.or (load.field.memarg EditState flags (local.get $state_w)) (i32.const 0x20)))
    (global.set $caret_hwnd (local.get $hwnd))
    (global.set $caret_w (i32.const 2))
    (global.set $caret_h (i32.const 15))
    (global.set $caret_visible (i32.const 1)))

  ;; WM_KILLFOCUS: DestroyCaret. The page reads this as "text no longer has
  ;; anywhere to land", which is what takes a phone's keyboard back down.
  (func $edit_stop_caret_timer (param $hwnd i32) (param $state_w ptr<EditState>)
    (drop (call $timer_kill (local.get $hwnd) (i32.const 0xCA47)))
    (store.field.memarg EditState flags (local.get $state_w)
      (i32.and (load.field.memarg EditState flags (local.get $state_w)) (i32.const 0xFFFFFFDF)))
    (if (i32.eq (global.get $caret_hwnd) (local.get $hwnd))
      (then
        (global.set $caret_visible (i32.const 0))
        (global.set $caret_hwnd (i32.const 0)))))

  ;; Right-shift n bytes by 1 (memmove src→src+1). Reverse copy so overlap is safe.
  (func $edit_memmove_right (param $src i32) (param $n i32)
    ;; Backward byte copy of n bytes to src+1 — memmove, hence memory.copy.
    (memory.copy (i32.add (local.get $src) (i32.const 1))
                 (local.get $src)
                 (local.get $n))
  )

  ;; Ensure EditState has capacity for at least $need_cap chars (excl NUL).
  (func $edit_ensure_cap (param $state_w ptr<EditState>) (param $need_cap i32)
    (local $cap i32) (local $new_cap i32) (local $old_buf i32) (local $new_buf i32) (local $len i32)
    (local.set $cap (load.field.memarg EditState text_cap (local.get $state_w)))
    (if (i32.le_u (local.get $need_cap) (local.get $cap)) (then (return)))
    (local.set $new_cap (i32.shl (local.get $cap) (i32.const 1)))
    (if (i32.lt_u (local.get $new_cap) (local.get $need_cap))
      (then (local.set $new_cap (local.get $need_cap))))
    (if (i32.lt_u (local.get $new_cap) (i32.const 32))
      (then (local.set $new_cap (i32.const 32))))
    (local.set $new_buf (call $heap_alloc (i32.add (local.get $new_cap) (i32.const 1))))
    (local.set $old_buf (load.field EditState text_buf_ptr (local.get $state_w)))
    (local.set $len (load.field.memarg EditState text_len (local.get $state_w)))
    (if (local.get $old_buf)
      (then (if (local.get $len)
              (then (call $memcpy (call $g2w (local.get $new_buf))
                                  (call $g2w (local.get $old_buf))
                                  (local.get $len))))))
    (i32.store8 (i32.add (call $g2w (local.get $new_buf)) (local.get $len)) (i32.const 0))
    (if (local.get $old_buf) (then (call $heap_free (local.get $old_buf))))
    (store.field EditState text_buf_ptr (local.get $state_w) (local.get $new_buf))
    (store.field.memarg EditState text_cap (local.get $state_w) (local.get $new_cap))
  )

  (func $edit_sel_lo (param $state_w ptr<EditState>) (result i32)
    (local $a i32) (local $b i32)
    (local.set $a (load.field.memarg EditState cursor (local.get $state_w)))
    (local.set $b (load.field.memarg EditState sel_anchor (local.get $state_w)))
    (select (local.get $a) (local.get $b) (i32.lt_u (local.get $a) (local.get $b))))

  (func $edit_sel_hi (param $state_w ptr<EditState>) (result i32)
    (local $a i32) (local $b i32)
    (local.set $a (load.field.memarg EditState cursor (local.get $state_w)))
    (local.set $b (load.field.memarg EditState sel_anchor (local.get $state_w)))
    (select (local.get $a) (local.get $b) (i32.gt_u (local.get $a) (local.get $b))))

  ;; Delete characters in [lo..hi). Updates text_len, cursor, sel_anchor → lo.
  (func $edit_delete_range (param $state_w ptr<EditState>) (param $lo i32) (param $hi i32)
    (local $buf_w i32) (local $len i32) (local $tail i32)
    (if (i32.ge_u (local.get $lo) (local.get $hi)) (then (return)))
    (local.set $len (load.field.memarg EditState text_len (local.get $state_w)))
    (if (i32.gt_u (local.get $hi) (local.get $len)) (then (local.set $hi (local.get $len))))
    (local.set $buf_w (call $g2w (load.field EditState text_buf_ptr (local.get $state_w))))
    (local.set $tail (i32.sub (local.get $len) (local.get $hi)))
    (if (local.get $tail)
      (then (call $memcpy
              (i32.add (local.get $buf_w) (local.get $lo))
              (i32.add (local.get $buf_w) (local.get $hi))
              (local.get $tail))))
    (local.set $len (i32.sub (local.get $len) (i32.sub (local.get $hi) (local.get $lo))))
    (store.field.memarg EditState text_len (local.get $state_w) (local.get $len))
    (i32.store8 (i32.add (local.get $buf_w) (local.get $len)) (i32.const 0))
    (store.field.memarg EditState cursor (local.get $state_w) (local.get $lo))
    (store.field.memarg EditState sel_anchor (local.get $state_w) (local.get $lo))
  )

  ;; Insert one byte at cursor (delete selection first).
  (func $edit_insert_char (param $state_w ptr<EditState>) (param $ch i32)
    (local $lo i32) (local $hi i32) (local $cur i32) (local $len i32) (local $buf_w i32) (local $tail i32) (local $maxlen i32)
    (local.set $lo (call $edit_sel_lo (local.get $state_w)))
    (local.set $hi (call $edit_sel_hi (local.get $state_w)))
    (if (i32.ne (local.get $lo) (local.get $hi))
      (then (call $edit_delete_range (local.get $state_w) (local.get $lo) (local.get $hi))))
    (local.set $len (load.field.memarg EditState text_len (local.get $state_w)))
    (local.set $maxlen (load.field.memarg EditState max_length (local.get $state_w)))
    (if (local.get $maxlen)
      (then (if (i32.ge_u (local.get $len) (local.get $maxlen))
              (then (return)))))
    (call $edit_ensure_cap (local.get $state_w) (i32.add (local.get $len) (i32.const 1)))
    (local.set $cur (load.field.memarg EditState cursor (local.get $state_w)))
    (local.set $buf_w (call $g2w (load.field EditState text_buf_ptr (local.get $state_w))))
    (local.set $tail (i32.sub (local.get $len) (local.get $cur)))
    (if (local.get $tail)
      (then (call $edit_memmove_right
              (i32.add (local.get $buf_w) (local.get $cur))
              (local.get $tail))))
    (i32.store8 (i32.add (local.get $buf_w) (local.get $cur)) (local.get $ch))
    (local.set $cur (i32.add (local.get $cur) (i32.const 1)))
    (local.set $len (i32.add (local.get $len) (i32.const 1)))
    (store.field.memarg EditState text_len (local.get $state_w) (local.get $len))
    (store.field.memarg EditState cursor (local.get $state_w) (local.get $cur))
    (store.field.memarg EditState sel_anchor (local.get $state_w) (local.get $cur))
    (i32.store8 (i32.add (local.get $buf_w) (local.get $len)) (i32.const 0))
  )

  ;; Insert $n bytes from guest-ptr $src at cursor (delete selection first).
  ;; Used by WM_PASTE / Ctrl+V to bulk-insert clipboard text in one pass
  ;; (avoids per-char memmove storms on large pastes).
  (func $edit_insert_bytes (param $state_w ptr<EditState>) (param $src_g i32) (param $n i32)
    (local $lo i32) (local $hi i32) (local $cur i32) (local $len i32) (local $buf_w i32) (local $tail i32) (local $maxlen i32) (local $src_w i32) (local $room i32)
    (if (i32.eqz (local.get $n)) (then (return)))
    (local.set $lo (call $edit_sel_lo (local.get $state_w)))
    (local.set $hi (call $edit_sel_hi (local.get $state_w)))
    (if (i32.ne (local.get $lo) (local.get $hi))
      (then (call $edit_delete_range (local.get $state_w) (local.get $lo) (local.get $hi))))
    (local.set $len (load.field.memarg EditState text_len (local.get $state_w)))
    (local.set $maxlen (load.field.memarg EditState max_length (local.get $state_w)))
    (if (local.get $maxlen)
      (then
        (local.set $room (i32.sub (local.get $maxlen) (local.get $len)))
        (if (i32.lt_s (local.get $room) (i32.const 0)) (then (local.set $room (i32.const 0))))
        (if (i32.gt_u (local.get $n) (local.get $room))
          (then (local.set $n (local.get $room))))))
    (if (i32.eqz (local.get $n)) (then (return)))
    (call $edit_ensure_cap (local.get $state_w) (i32.add (local.get $len) (local.get $n)))
    (local.set $cur (load.field.memarg EditState cursor (local.get $state_w)))
    (local.set $buf_w (call $g2w (load.field EditState text_buf_ptr (local.get $state_w))))
    ;; Shift tail right by $n bytes. The old reverse byte loop is memmove for a
    ;; destination above the source, so memory.copy does it in one op.
    (local.set $tail (i32.sub (local.get $len) (local.get $cur)))
    (if (local.get $tail)
      (then
        (memory.copy
          (i32.add (local.get $buf_w) (i32.add (local.get $cur) (local.get $n)))
          (i32.add (local.get $buf_w) (local.get $cur))
          (local.get $tail))))
    (local.set $src_w (call $g2w (local.get $src_g)))
    (call $memcpy
      (i32.add (local.get $buf_w) (local.get $cur))
      (local.get $src_w)
      (local.get $n))
    (local.set $cur (i32.add (local.get $cur) (local.get $n)))
    (local.set $len (i32.add (local.get $len) (local.get $n)))
    (store.field.memarg EditState text_len (local.get $state_w) (local.get $len))
    (store.field.memarg EditState cursor (local.get $state_w) (local.get $cur))
    (store.field.memarg EditState sel_anchor (local.get $state_w) (local.get $cur))
    (i32.store8 (i32.add (local.get $buf_w) (local.get $len)) (i32.const 0))
  )

  ;; Copy [lo..hi) from edit to the global clipboard, reallocating to fit.
  ;; No-op when lo >= hi (empty selection — leaves clipboard untouched so
  ;; Ctrl+C on nothing doesn't wipe a prior copy).
  (func $edit_copy_range (param $state_w ptr<EditState>) (param $lo i32) (param $hi i32)
    (local $len i32) (local $src_g i32) (local $dst_g i32) (local $cap i32) (local $need i32)
    (if (i32.ge_u (local.get $lo) (local.get $hi)) (then (return)))
    (local.set $len (i32.sub (local.get $hi) (local.get $lo)))
    (local.set $need (i32.add (local.get $len) (i32.const 1)))
    (local.set $src_g (load.field EditState text_buf_ptr (local.get $state_w)))
    (if (i32.eqz (local.get $src_g)) (then (return)))
    ;; Grow capacity if needed (round up to multiple of 64).
    (if (i32.gt_u (local.get $need) (global.get $clipboard_cap))
      (then
        (if (global.get $clipboard_ptr)
          (then (call $heap_free (global.get $clipboard_ptr))
                (global.set $clipboard_ptr (i32.const 0))))
        (local.set $cap (i32.and (i32.add (local.get $need) (i32.const 63)) (i32.const -64)))
        (global.set $clipboard_ptr (call $heap_alloc (local.get $cap)))
        (global.set $clipboard_cap (local.get $cap))))
    (local.set $dst_g (global.get $clipboard_ptr))
    (if (i32.eqz (local.get $dst_g)) (then (return)))
    (call $memcpy
      (call $g2w (local.get $dst_g))
      (i32.add (call $g2w (local.get $src_g)) (local.get $lo))
      (local.get $len))
    (i32.store8 (i32.add (call $g2w (local.get $dst_g)) (local.get $len)) (i32.const 0))
    (global.set $clipboard_len (local.get $len))
    (call $richedit_clipboard_clear_format)
    (call $clipboard_clear_rtf_data)
  )

  ;; Convert click (x,y) in edit client coords to a char offset.
  ;; Uses $host_measure_text to binary-ish-search the column within a line.
  ;; y-based line pick clamps to last line; x-based col picks the half-char
  ;; the click falls into (standard Win32 caret behavior).
  ;; Width in pixels of the widest line, which is what an unwrapped EDIT
  ;; scrolls horizontally over. Measuring every line with $host_measure_text
  ;; would mean one GDI text measurement per line on every paint, so the
  ;; longest line is picked by character count first and only that one is
  ;; measured. Notepad's default Fixedsys is fixed-pitch, where that is exact;
  ;; with a proportional font it is an approximation of which line is widest.
  (func $edit_doc_width (param $state_w ptr<EditState>) (param $hdc i32) (result i32)
    (local $buf_g i32) (local $text_len i32) (local $pos i32) (local $len i32)
    (local $best_start i32) (local $best_len i32) (local $w i32)
    (local.set $buf_g (load.field EditState text_buf_ptr (local.get $state_w)))
    (if (i32.eqz (local.get $buf_g)) (then (return (i32.const 0))))
    (local.set $text_len (load.field.memarg EditState text_len (local.get $state_w)))
    (local.set $pos (i32.const 0))
    (block $done (loop $scan
      (br_if $done (i32.gt_u (local.get $pos) (local.get $text_len)))
      (local.set $len (call $edit_line_len (local.get $state_w) (local.get $pos)))
      (if (i32.gt_u (local.get $len) (local.get $best_len))
        (then
          (local.set $best_len (local.get $len))
          (local.set $best_start (local.get $pos))))
      (local.set $pos (i32.add (i32.add (local.get $pos) (local.get $len)) (i32.const 1)))
      (br $scan)))
    (if (i32.eqz (local.get $best_len)) (then (return (i32.const 0))))
    (local.set $w (call $host_measure_text (local.get $hdc)
      (i32.add (call $g2w (local.get $buf_g)) (local.get $best_start))
      (local.get $best_len) (i32.const 0)))
    (if (i32.eqz (local.get $w))
      (then (local.set $w (i32.mul (local.get $best_len) (i32.const 8)))))
    (local.get $w))

  ;; Largest horizontal scroll offset for an unwrapped edit whose content area
  ;; is $view_w wide. The 8 covers the 4px text margin on each side.
  (func $edit_max_hscroll (param $state_w i32) (param $hdc i32) (param $view_w i32) (result i32)
    (local $max i32)
    (local.set $max (i32.sub
      (i32.add (call $edit_doc_width (local.get $state_w) (local.get $hdc)) (i32.const 8))
      (local.get $view_w)))
    (if (i32.lt_s (local.get $max) (i32.const 0)) (then (local.set $max (i32.const 0))))
    (local.get $max))

  ;; Clamp and store scroll_x. Returns 1 when the viewport actually moved.
  (func $edit_hscroll_to (param $state_w ptr<EditState>) (param $x i32) (param $max i32) (result i32)
    (if (i32.gt_s (local.get $x) (local.get $max)) (then (local.set $x (local.get $max))))
    (if (i32.lt_s (local.get $x) (i32.const 0)) (then (local.set $x (i32.const 0))))
    (if (i32.eq (local.get $x) (load.field.memarg EditState scroll_x (local.get $state_w)))
      (then (return (i32.const 0))))
    (store.field.memarg EditState scroll_x (local.get $state_w) (local.get $x))
    (i32.const 1))

  (func $edit_xy_to_offset (param $state_w ptr<EditState>) (param $hdc i32) (param $x i32) (param $y i32) (result i32)
    (local $line_num i32) (local $line_start i32) (local $line_len i32)
    (local $text_len i32) (local $buf_g i32) (local $line_w i32)
    (local $i i32) (local $w i32) (local $prev_w i32) (local $mid i32)
    (local $total_lines i32)
    (local.set $text_len (load.field.memarg EditState text_len (local.get $state_w)))
    (local.set $buf_g (load.field EditState text_buf_ptr (local.get $state_w)))
    (if (i32.eqz (local.get $buf_g)) (then (return (i32.const 0))))
    ;; Subtract 4px text margin, add the horizontal scroll offset so a click
    ;; lands on the character under the cursor rather than the one that would
    ;; be there if the view were scrolled home, clamp x>=0, y>=0.
    (local.set $x (i32.sub (local.get $x) (i32.const 4)))
    (local.set $x (i32.add (local.get $x) (load.field.memarg EditState scroll_x (local.get $state_w))))
    (if (i32.lt_s (local.get $x) (i32.const 0)) (then (local.set $x (i32.const 0))))
    (local.set $y (i32.sub (local.get $y) (i32.const 4)))
    (if (i32.lt_s (local.get $y) (i32.const 0)) (then (local.set $y (i32.const 0))))
    (local.set $line_num (i32.div_s (local.get $y) (i32.const 16)))
    (local.set $line_num (i32.add (local.get $line_num) (load.field.memarg EditState scroll_top (local.get $state_w))))
    ;; Clamp to last line: total_lines = edit_line_from_char(text_len) + 1
    (local.set $total_lines (i32.add
      (call $edit_line_from_char (local.get $state_w) (local.get $text_len))
      (i32.const 1)))
    (if (i32.ge_u (local.get $line_num) (local.get $total_lines))
      (then (local.set $line_num (i32.sub (local.get $total_lines) (i32.const 1)))))
    (local.set $line_start (call $edit_line_index (local.get $state_w) (local.get $line_num)))
    (local.set $line_len (call $edit_line_len (local.get $state_w) (local.get $line_start)))
    (local.set $line_w (i32.add (call $g2w (local.get $buf_g)) (local.get $line_start)))
    (local.set $prev_w (i32.const 0))
    (local.set $i (i32.const 0))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (local.get $line_len)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (local.set $w (call $host_measure_text
        (local.get $hdc) (local.get $line_w) (local.get $i) (i32.const 0)))
      (local.set $mid (i32.shr_s (i32.add (local.get $prev_w) (local.get $w)) (i32.const 1)))
      (if (i32.gt_s (local.get $mid) (local.get $x))
        (then (return (i32.add (local.get $line_start) (i32.sub (local.get $i) (i32.const 1))))))
      (local.set $prev_w (local.get $w))
      (br $scan)))
    (i32.add (local.get $line_start) (local.get $line_len)))

  (func $edit_layout_store (param $idx i32) (param $start i32) (param $len i32)
    (local $p i32)
    (if (i32.ge_u (local.get $idx) (global.get $EDIT_LAYOUT_MAX)) (then (return)))
    (local.set $p (i32.add (global.get $EDIT_LAYOUT_SCRATCH)
                    (i32.mul (local.get $idx) (i32.const 8))))
    (i32.store (local.get $p) (local.get $start))
    (i32.store offset=4 (local.get $p) (local.get $len)))

  (func $edit_layout_start (param $idx i32) (result i32)
    (i32.load (i32.add (global.get $EDIT_LAYOUT_SCRATCH)
              (i32.mul (local.get $idx) (i32.const 8)))))

  (func $edit_layout_len (param $idx i32) (result i32)
    (i32.load offset=4 (i32.add (global.get $EDIT_LAYOUT_SCRATCH)
                       (i32.mul (local.get $idx) (i32.const 8)))))

  ;; Build the visual-line table used by wrapped multiline edits. This is the
  ;; WAT-side equivalent of USER32 EDIT's internal line layout: explicit CR/LF
  ;; breaks plus simple word wrapping against the edit client width.
  (func $edit_layout_build (param $state_w ptr<EditState>) (param $hdc i32) (param $text_w i32) (result i32)
    (local $buf_g i32) (local $buf_w i32) (local $text_len i32)
    (local $count i32) (local $line_start i32) (local $pos i32)
    (local $ch i32) (local $next_ch i32) (local $max_w i32)
    (local $candidate_len i32) (local $width i32)
    (local $last_space i32) (local $break_len i32) (local $next_start i32)

    (local.set $buf_g (load.field EditState text_buf_ptr (local.get $state_w)))
    (local.set $text_len (load.field.memarg EditState text_len (local.get $state_w)))
    (if (i32.eqz (local.get $buf_g))
      (then
        (call $edit_layout_store (i32.const 0) (i32.const 0) (i32.const 0))
        (return (i32.const 1))))
    (local.set $buf_w (call $g2w (local.get $buf_g)))
    (local.set $max_w (i32.sub (local.get $text_w) (i32.const 8)))
    (if (i32.lt_s (local.get $max_w) (i32.const 8))
      (then (local.set $max_w (i32.const 8))))
    (local.set $line_start (i32.const 0))
    (local.set $count (i32.const 0))

    (block $done (loop $outer
      (br_if $done (i32.ge_u (local.get $count) (global.get $EDIT_LAYOUT_MAX)))
      (if (i32.gt_u (local.get $line_start) (local.get $text_len))
        (then (br $done)))

      (local.set $pos (local.get $line_start))
      (local.set $last_space (i32.const -1))
      (block $line_done (loop $scan
        (br_if $line_done (i32.ge_u (local.get $pos) (local.get $text_len)))
        (local.set $ch (i32.load8_u (i32.add (local.get $buf_w) (local.get $pos))))
        (if (i32.or (i32.eq (local.get $ch) (i32.const 10))
                    (i32.eq (local.get $ch) (i32.const 13)))
          (then
            (local.set $break_len (i32.sub (local.get $pos) (local.get $line_start)))
            (call $edit_layout_store (local.get $count) (local.get $line_start) (local.get $break_len))
            (local.set $count (i32.add (local.get $count) (i32.const 1)))
            (local.set $next_start (i32.add (local.get $pos) (i32.const 1)))
            (if (i32.and
                  (i32.eq (local.get $ch) (i32.const 13))
                  (i32.lt_u (local.get $next_start) (local.get $text_len)))
              (then
                (local.set $next_ch (i32.load8_u (i32.add (local.get $buf_w) (local.get $next_start))))
                (if (i32.eq (local.get $next_ch) (i32.const 10))
                  (then (local.set $next_start (i32.add (local.get $next_start) (i32.const 1)))))))
            (local.set $line_start (local.get $next_start))
            (br $line_done)))
        (if (i32.eq (local.get $ch) (i32.const 32))
          (then (local.set $last_space (local.get $pos))))
        (local.set $candidate_len (i32.add (i32.sub (local.get $pos) (local.get $line_start)) (i32.const 1)))
        (local.set $width (call $host_measure_text
          (local.get $hdc)
          (i32.add (local.get $buf_w) (local.get $line_start))
          (local.get $candidate_len) (i32.const 0)))
        (if (i32.and (i32.gt_s (local.get $width) (local.get $max_w))
                     (i32.gt_u (local.get $candidate_len) (i32.const 1)))
          (then
            (if (i32.and (i32.ge_s (local.get $last_space) (local.get $line_start))
                         (i32.gt_u (local.get $last_space) (local.get $line_start)))
              (then
                (local.set $break_len (i32.sub (local.get $last_space) (local.get $line_start)))
                (local.set $next_start (i32.add (local.get $last_space) (i32.const 1))))
              (else
                (local.set $break_len (i32.sub (local.get $pos) (local.get $line_start)))
                (local.set $next_start (local.get $pos))))
            (call $edit_layout_store (local.get $count) (local.get $line_start) (local.get $break_len))
            (local.set $count (i32.add (local.get $count) (i32.const 1)))
            (local.set $line_start (local.get $next_start))
            (br $line_done)))
        (local.set $pos (i32.add (local.get $pos) (i32.const 1)))
        (br $scan)))

      (if (i32.ge_u (local.get $pos) (local.get $text_len))
        (then
          (call $edit_layout_store
            (local.get $count)
            (local.get $line_start)
            (i32.sub (local.get $text_len) (local.get $line_start)))
          (local.set $count (i32.add (local.get $count) (i32.const 1)))
          (br $done)))
      (br $outer)))
    (if (i32.eqz (local.get $count))
      (then
        (call $edit_layout_store (i32.const 0) (i32.const 0) (i32.const 0))
        (return (i32.const 1))))
    (local.get $count))

  (func $edit_layout_line_for_char (param $line_count i32) (param $cur i32) (result i32)
    (local $i i32) (local $s i32) (local $e i32)
    (local.set $i (i32.const 0))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (local.get $line_count)))
      (local.set $s (call $edit_layout_start (local.get $i)))
      (local.set $e (i32.add (local.get $s) (call $edit_layout_len (local.get $i))))
      (if (i32.and (i32.ge_u (local.get $cur) (local.get $s))
                   (i32.le_u (local.get $cur) (local.get $e)))
        (then (return (local.get $i))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (select (i32.sub (local.get $line_count) (i32.const 1)) (i32.const 0)
            (i32.gt_u (local.get $line_count) (i32.const 0))))

  (func $edit_layout_xy_to_offset
        (param $state_w ptr<EditState>) (param $hdc i32) (param $text_w i32) (param $x i32) (param $y i32) (result i32)
    (local $line_count i32) (local $line_num i32) (local $line_start i32) (local $line_len i32)
    (local $buf_w i32) (local $i i32) (local $w i32) (local $prev_w i32) (local $mid i32)
    (local.set $line_count (call $edit_layout_build (local.get $state_w) (local.get $hdc) (local.get $text_w)))
    (local.set $x (i32.sub (local.get $x) (i32.const 4)))
    (if (i32.lt_s (local.get $x) (i32.const 0)) (then (local.set $x (i32.const 0))))
    (local.set $y (i32.sub (local.get $y) (i32.const 4)))
    (if (i32.lt_s (local.get $y) (i32.const 0)) (then (local.set $y (i32.const 0))))
    (local.set $line_num (i32.add
      (i32.div_s (local.get $y) (i32.const 16))
      (load.field.memarg EditState scroll_top (local.get $state_w))))
    (if (i32.ge_u (local.get $line_num) (local.get $line_count))
      (then (local.set $line_num (i32.sub (local.get $line_count) (i32.const 1)))))
    (local.set $line_start (call $edit_layout_start (local.get $line_num)))
    (local.set $line_len (call $edit_layout_len (local.get $line_num)))
    (local.set $buf_w (call $g2w (load.field EditState text_buf_ptr (local.get $state_w))))
    (local.set $prev_w (i32.const 0))
    (local.set $i (i32.const 0))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (local.get $line_len)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (local.set $w (call $host_measure_text
        (local.get $hdc) (i32.add (local.get $buf_w) (local.get $line_start))
        (local.get $i) (i32.const 0)))
      (if (i32.eqz (local.get $w))
        (then (local.set $w (i32.mul (local.get $i) (i32.const 8)))))
      (local.set $mid (i32.shr_s (i32.add (local.get $prev_w) (local.get $w)) (i32.const 1)))
      (if (i32.gt_s (local.get $mid) (local.get $x))
        (then (return (i32.add (local.get $line_start) (i32.sub (local.get $i) (i32.const 1))))))
      (local.set $prev_w (local.get $w))
      (br $scan)))
    (i32.add (local.get $line_start) (local.get $line_len)))

  ;; Word-boundary classification: 1 if $ch is part of a word (alnum/underscore),
  ;; else 0. Matches Win32 default word break for ASCII.
  (func $edit_is_word_char (param $ch i32) (result i32)
    (if (i32.eq (local.get $ch) (i32.const 0x5F)) (then (return (i32.const 1))))  ;; _
    (if (i32.and (i32.ge_u (local.get $ch) (i32.const 0x30))
                 (i32.le_u (local.get $ch) (i32.const 0x39)))
      (then (return (i32.const 1))))  ;; 0-9
    (if (i32.and (i32.ge_u (local.get $ch) (i32.const 0x41))
                 (i32.le_u (local.get $ch) (i32.const 0x5A)))
      (then (return (i32.const 1))))  ;; A-Z
    (if (i32.and (i32.ge_u (local.get $ch) (i32.const 0x61))
                 (i32.le_u (local.get $ch) (i32.const 0x7A)))
      (then (return (i32.const 1))))  ;; a-z
    (i32.const 0))

  (func $edit_word_start (param $state_w ptr<EditState>) (param $pos i32) (result i32)
    (local $buf_w i32) (local $ch i32)
    (local.set $buf_w (load.field EditState text_buf_ptr (local.get $state_w)))
    (if (i32.eqz (local.get $buf_w)) (then (return (local.get $pos))))
    (local.set $buf_w (call $g2w (local.get $buf_w)))
    (block $done (loop $scan
      (br_if $done (i32.le_s (local.get $pos) (i32.const 0)))
      (local.set $ch (i32.load8_u (i32.add (local.get $buf_w) (i32.sub (local.get $pos) (i32.const 1)))))
      (br_if $done (i32.eqz (call $edit_is_word_char (local.get $ch))))
      (local.set $pos (i32.sub (local.get $pos) (i32.const 1)))
      (br $scan)))
    (local.get $pos))

  (func $edit_word_end (param $state_w ptr<EditState>) (param $pos i32) (result i32)
    (local $buf_w i32) (local $text_len i32) (local $ch i32)
    (local.set $buf_w (load.field EditState text_buf_ptr (local.get $state_w)))
    (if (i32.eqz (local.get $buf_w)) (then (return (local.get $pos))))
    (local.set $buf_w (call $g2w (local.get $buf_w)))
    (local.set $text_len (load.field.memarg EditState text_len (local.get $state_w)))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $pos) (local.get $text_len)))
      (local.set $ch (i32.load8_u (i32.add (local.get $buf_w) (local.get $pos))))
      (br_if $done (i32.eqz (call $edit_is_word_char (local.get $ch))))
      (local.set $pos (i32.add (local.get $pos) (i32.const 1)))
      (br $scan)))
    (local.get $pos))

  ;; True if VK_SHIFT/VK_CONTROL are physically down (uses host async state).
  (func $edit_shift_down (result i32)
    (i32.and (call $host_get_async_key_state (i32.const 0x10)) (i32.const 0x8000)))
  (func $edit_ctrl_down (result i32)
    (i32.and (call $host_get_async_key_state (i32.const 0x11)) (i32.const 0x8000)))

  (func $edit_notify (param $hwnd i32) (param $code i32)
    (local $parent i32) (local $id i32)
    (local.set $parent (call $wnd_get_parent (local.get $hwnd)))
    (if (local.get $parent)
      (then
        (local.set $id (call $ctrl_table_get_id (local.get $hwnd)))
        (drop (call $wnd_send_message
          (local.get $parent)
          (i32.const 0x0111)  ;; WM_COMMAND
          (i32.or (i32.and (local.get $id) (i32.const 0xFFFF))
                  (i32.shl (local.get $code) (i32.const 16)))
          (local.get $hwnd))))))

  (func $edit_notify_change (param $hwnd i32)
    ;; A standard multiline EDIT sends EN_UPDATE immediately before repaint,
    ;; followed by EN_CHANGE once its text has changed. Paint consumes the
    ;; update notification to refresh the text object that is later committed.
    (call $edit_notify (local.get $hwnd) (i32.const 0x0400)) ;; EN_UPDATE
    (call $edit_notify (local.get $hwnd) (i32.const 0x0300))) ;; EN_CHANGE

  ;; Invoke an EDITSTREAM callback synchronously.  The callback is the Win32
  ;; `DWORD CALLBACK(cookie, buffer, capacity, bytes_read)` shape and therefore
  ;; pops its four arguments.  EM_STREAMIN is itself reached from inside a
  ;; guest SendMessage call, so preserve the interrupted x86 context around the
  ;; bounded nested interpreter run just as $wnd_send_message_inner does.
  (func $edit_stream_call
    (param $callback i32) (param $cookie i32) (param $buffer i32)
    (param $capacity i32) (param $bytes_read i32) (result i32)
    (local $old_eip i32) (local $old_esp i32) (local $old_eax i32)
    (local $old_ecx i32) (local $old_edx i32) (local $old_ebx i32)
    (local $old_esi i32) (local $old_edi i32) (local $old_ebp i32)
    (local $old_handler_set_eip i32) (local $old_steps i32)
    (local $old_yield_reason i32) (local $old_yield_flag i32)
    (local $result i32) (local $rounds i32)
    (if (i32.eqz (local.get $callback)) (then (return (i32.const 1))))
    (local.set $old_eip (global.get $eip))
    (local.set $old_esp (i32.load offset=16 (global.get $reg_base)))
    (local.set $old_eax (i32.load offset=0 (global.get $reg_base)))
    (local.set $old_ecx (i32.load offset=4 (global.get $reg_base)))
    (local.set $old_edx (i32.load offset=8 (global.get $reg_base)))
    (local.set $old_ebx (i32.load offset=12 (global.get $reg_base)))
    (local.set $old_esi (i32.load offset=24 (global.get $reg_base)))
    (local.set $old_edi (i32.load offset=28 (global.get $reg_base)))
    (local.set $old_ebp (i32.load offset=20 (global.get $reg_base)))
    (local.set $old_handler_set_eip (global.get $handler_set_eip))
    (local.set $old_steps (global.get $steps))
    (local.set $old_yield_reason (global.get $yield_reason))
    (local.set $old_yield_flag (global.get $yield_flag))
    ;; Push right-to-left: pcb, cb, buffer, cookie, return thunk.
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (local.get $bytes_read))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (local.get $capacity))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (local.get $buffer))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (local.get $cookie))
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 4)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (global.get $sync_msg_ret_thunk))
    (global.set $eip (local.get $callback))
    (global.set $steps (i32.const 0))
    (global.set $yield_reason (i32.const 0))
    (global.set $yield_flag (i32.const 0))
    (global.set $sync_msg_depth (i32.add (global.get $sync_msg_depth) (i32.const 1)))
    (block $done (loop $run_callback
      (call $run (i32.const 1000000))
      (br_if $done (i32.eqz (global.get $eip)))
      (local.set $rounds (i32.add (local.get $rounds) (i32.const 1)))
      (br_if $done (i32.ge_u (local.get $rounds) (i32.const 64)))
      (br $run_callback)))
    (global.set $sync_msg_depth (i32.sub (global.get $sync_msg_depth) (i32.const 1)))
    (local.set $result
      (select (i32.load offset=0 (global.get $reg_base)) (i32.const 1) (i32.eqz (global.get $eip))))
    (global.set $eip (local.get $old_eip))
    (i32.store offset=16 (global.get $reg_base) (local.get $old_esp))
    (i32.store offset=0 (global.get $reg_base) (local.get $old_eax))
    (i32.store offset=4 (global.get $reg_base) (local.get $old_ecx))
    (i32.store offset=8 (global.get $reg_base) (local.get $old_edx))
    (i32.store offset=12 (global.get $reg_base) (local.get $old_ebx))
    (i32.store offset=24 (global.get $reg_base) (local.get $old_esi))
    (i32.store offset=28 (global.get $reg_base) (local.get $old_edi))
    (i32.store offset=20 (global.get $reg_base) (local.get $old_ebp))
    (global.set $handler_set_eip (local.get $old_handler_set_eip))
    (global.set $steps (local.get $old_steps))
    (global.set $yield_reason (local.get $old_yield_reason))
    (global.set $yield_flag (local.get $old_yield_flag))
    (local.get $result))

  (func $edit_hex_nibble (param $ch i32) (result i32)
    (if (i32.and (i32.ge_u (local.get $ch) (i32.const 0x30))
                 (i32.le_u (local.get $ch) (i32.const 0x39)))
      (then (return (i32.sub (local.get $ch) (i32.const 0x30)))))
    (local.set $ch (call $tolower (local.get $ch)))
    (if (i32.and (i32.ge_u (local.get $ch) (i32.const 0x61))
                 (i32.le_u (local.get $ch) (i32.const 0x66)))
      (then (return (i32.add (i32.sub (local.get $ch) (i32.const 0x61)) (i32.const 10)))))
    (i32.const 0))

  ;; Project the streamed bytes into the plain-text EditState used by the WAT
  ;; control.  RichEdit normally owns the RTF parser; this bounded projection
  ;; keeps visible text, paragraph/tab breaks and ANSI hex escapes while
  ;; discarding formatting and destination groups (font/color tables, pictures,
  ;; metadata).  The output cannot be larger than the input.
  (func $edit_stream_project
    (param $state_w ptr<EditState>) (param $raw_g i32) (param $raw_len i32)
    (param $is_rtf i32) (result i32)
    (local $src i32) (local $dst i32) (local $i i32) (local $out i32)
    (local $ch i32) (local $depth i32) (local $skip_depth i32)
    (local $group_start i32) (local $hash i32) (local $word_start i32)
    (local $hi i32) (local $lo i32)
    (call $edit_ensure_cap (local.get $state_w) (local.get $raw_len))
    (local.set $src (call $g2w (local.get $raw_g)))
    (local.set $dst (call $g2w (load.field EditState text_buf_ptr (local.get $state_w))))
    (if (i32.eqz (local.get $is_rtf))
      (then
        (if (local.get $raw_len)
          (then (call $memcpy (local.get $dst) (local.get $src) (local.get $raw_len))))
        (local.set $out (local.get $raw_len)))
      (else
        (local.set $i (i32.const 0))
        (local.set $out (i32.const 0))
        (block $done (loop $scan
          (br_if $done (i32.ge_u (local.get $i) (local.get $raw_len)))
          (local.set $ch (i32.load8_u (i32.add (local.get $src) (local.get $i))))
          (if (i32.eq (local.get $ch) (i32.const 0x7B)) ;; {
            (then
              (local.set $depth (i32.add (local.get $depth) (i32.const 1)))
              (local.set $group_start (i32.const 1))
              (local.set $i (i32.add (local.get $i) (i32.const 1)))
              (br $scan)))
          (if (i32.eq (local.get $ch) (i32.const 0x7D)) ;; }
            (then
              (if (i32.eq (local.get $skip_depth) (local.get $depth))
                (then (local.set $skip_depth (i32.const 0))))
              (if (local.get $depth)
                (then (local.set $depth (i32.sub (local.get $depth) (i32.const 1)))))
              (local.set $group_start (i32.const 0))
              (local.set $i (i32.add (local.get $i) (i32.const 1)))
              (br $scan)))
          (if (i32.eq (local.get $ch) (i32.const 0x5C)) ;; backslash
            (then
              (local.set $i (i32.add (local.get $i) (i32.const 1)))
              (br_if $done (i32.ge_u (local.get $i) (local.get $raw_len)))
              (local.set $ch (i32.load8_u (i32.add (local.get $src) (local.get $i))))
              ;; ANSI hex escape: \'hh.
              (if (i32.eq (local.get $ch) (i32.const 0x27))
                (then
                  (if (i32.lt_u (i32.add (local.get $i) (i32.const 2)) (local.get $raw_len))
                    (then
                      (local.set $hi (call $edit_hex_nibble
                        (i32.load8_u (i32.add (local.get $src) (i32.add (local.get $i) (i32.const 1))))))
                      (local.set $lo (call $edit_hex_nibble
                        (i32.load8_u (i32.add (local.get $src) (i32.add (local.get $i) (i32.const 2))))))
                      (if (i32.eqz (local.get $skip_depth))
                        (then
                          (i32.store8 (i32.add (local.get $dst) (local.get $out))
                            (i32.or (i32.shl (local.get $hi) (i32.const 4)) (local.get $lo)))
                          (local.set $out (i32.add (local.get $out) (i32.const 1)))))
                      (local.set $i (i32.add (local.get $i) (i32.const 3)))
                      (local.set $group_start (i32.const 0))
                      (br $scan)))))
              ;; Escaped literal or control symbol.
              (if (i32.or
                    (i32.or (i32.eq (local.get $ch) (i32.const 0x5C))
                            (i32.eq (local.get $ch) (i32.const 0x7B)))
                    (i32.eq (local.get $ch) (i32.const 0x7D)))
                (then
                  (if (i32.eqz (local.get $skip_depth))
                    (then
                      (i32.store8 (i32.add (local.get $dst) (local.get $out)) (local.get $ch))
                      (local.set $out (i32.add (local.get $out) (i32.const 1)))))
                  (local.set $i (i32.add (local.get $i) (i32.const 1)))
                  (local.set $group_start (i32.const 0))
                  (br $scan)))
              (if (i32.eq (local.get $ch) (i32.const 0x2A)) ;; \* destination marker
                (then
                  (if (local.get $group_start) (then (local.set $skip_depth (local.get $depth))))
                  (local.set $i (i32.add (local.get $i) (i32.const 1)))
                  (br $scan)))
              (if (i32.or (i32.eq (local.get $ch) (i32.const 0x7E))
                          (i32.eq (local.get $ch) (i32.const 0x5F)))
                (then
                  (if (i32.eqz (local.get $skip_depth))
                    (then
                      (i32.store8 (i32.add (local.get $dst) (local.get $out))
                        (select (i32.const 0x2D) (i32.const 0x20)
                          (i32.eq (local.get $ch) (i32.const 0x5F))))
                      (local.set $out (i32.add (local.get $out) (i32.const 1)))))
                  (local.set $i (i32.add (local.get $i) (i32.const 1)))
                  (local.set $group_start (i32.const 0))
                  (br $scan)))
              ;; Control word hash (lowercase FNV-1a), then discard its
              ;; optional signed numeric parameter and one delimiter space.
              (local.set $hash (i32.const 0x811C9DC5))
              (local.set $word_start (local.get $i))
              (block $word_done (loop $word
                (br_if $word_done (i32.ge_u (local.get $i) (local.get $raw_len)))
                (local.set $ch (call $tolower
                  (i32.load8_u (i32.add (local.get $src) (local.get $i)))))
                (br_if $word_done
                  (i32.or (i32.lt_u (local.get $ch) (i32.const 0x61))
                          (i32.gt_u (local.get $ch) (i32.const 0x7A))))
                (local.set $hash
                  (i32.mul (i32.xor (local.get $hash) (local.get $ch)) (i32.const 0x01000193)))
                (local.set $i (i32.add (local.get $i) (i32.const 1)))
                (br $word)))
              (if (i32.lt_u (local.get $word_start) (local.get $i))
                (then
                  (if (i32.and (i32.lt_u (local.get $i) (local.get $raw_len))
                               (i32.eq (i32.load8_u (i32.add (local.get $src) (local.get $i))) (i32.const 0x2D)))
                    (then (local.set $i (i32.add (local.get $i) (i32.const 1)))))
                  (block $number_done (loop $number
                    (br_if $number_done (i32.ge_u (local.get $i) (local.get $raw_len)))
                    (local.set $ch (i32.load8_u (i32.add (local.get $src) (local.get $i))))
                    (br_if $number_done
                      (i32.or (i32.lt_u (local.get $ch) (i32.const 0x30))
                              (i32.gt_u (local.get $ch) (i32.const 0x39))))
                    (local.set $i (i32.add (local.get $i) (i32.const 1)))
                    (br $number)))
                  (if (i32.and (i32.lt_u (local.get $i) (local.get $raw_len))
                               (i32.eq (i32.load8_u (i32.add (local.get $src) (local.get $i))) (i32.const 0x20)))
                    (then (local.set $i (i32.add (local.get $i) (i32.const 1)))))))
              ;; Destination groups whose payload is not document text.
              (if (i32.and (local.get $group_start)
                    (i32.or
                      (i32.or (i32.eq (local.get $hash) (i32.const 0xB3049312)) ;; fonttbl
                              (i32.eq (local.get $hash) (i32.const 0xB5E90F1A))) ;; colortbl
                      (i32.or
                        (i32.or (i32.eq (local.get $hash) (i32.const 0x752FF961)) ;; stylesheet
                                (i32.eq (local.get $hash) (i32.const 0x0FB40705))) ;; info
                        (i32.or
                          (i32.or (i32.eq (local.get $hash) (i32.const 0x09420595)) ;; pict
                                  (i32.eq (local.get $hash) (i32.const 0xB8C60CBA))) ;; object
                          (i32.eq (local.get $hash) (i32.const 0x6EEC35C2)))))) ;; generator
                (then (local.set $skip_depth (local.get $depth))))
              (if (i32.eqz (local.get $skip_depth))
                (then
                  (if (i32.or (i32.eq (local.get $hash) (i32.const 0x63560E68)) ;; par
                              (i32.eq (local.get $hash) (i32.const 0x17DB1627))) ;; line
                    (then
                      (i32.store8 (i32.add (local.get $dst) (local.get $out)) (i32.const 0x0A))
                      (local.set $out (i32.add (local.get $out) (i32.const 1)))))
                  (if (i32.eq (local.get $hash) (i32.const 0x98F72E4C)) ;; tab
                    (then
                      (i32.store8 (i32.add (local.get $dst) (local.get $out)) (i32.const 0x09))
                      (local.set $out (i32.add (local.get $out) (i32.const 1)))))
                  (if (i32.or (i32.eq (local.get $hash) (i32.const 0xCCB67FB5)) ;; ldblquote
                              (i32.eq (local.get $hash) (i32.const 0xB352B75F))) ;; rdblquote
                    (then
                      (i32.store8 (i32.add (local.get $dst) (local.get $out)) (i32.const 0x22))
                      (local.set $out (i32.add (local.get $out) (i32.const 1)))))))
              (local.set $group_start (i32.const 0))
              (br $scan)))
          ;; Source newlines merely format the RTF itself.
          (if (i32.or (i32.eq (local.get $ch) (i32.const 0x0D))
                      (i32.eq (local.get $ch) (i32.const 0x0A)))
            (then
              (local.set $i (i32.add (local.get $i) (i32.const 1)))
              (br $scan)))
          (if (i32.eqz (local.get $skip_depth))
            (then
              (i32.store8 (i32.add (local.get $dst) (local.get $out)) (local.get $ch))
              (local.set $out (i32.add (local.get $out) (i32.const 1)))))
          (local.set $group_start (i32.const 0))
          (local.set $i (i32.add (local.get $i) (i32.const 1)))
          (br $scan)))))
    (i32.store8 (i32.add (local.get $dst) (local.get $out)) (i32.const 0))
    (store.field.memarg EditState text_len (local.get $state_w) (local.get $out))
    (store.field.memarg EditState cursor (local.get $state_w) (local.get $out))
    (store.field.memarg EditState sel_anchor (local.get $state_w) (local.get $out))
    (local.get $out))

  ;; Read a documented EDITSTREAM through its callback.  The 64K ceiling is
  ;; the same bound the old host-side fallback used and exceeds the Win9x
  ;; RichEdit default text limit; it also keeps a malicious callback bounded.
  (func $edit_stream_read
    (param $state_w i32) (param $stream_g i32) (param $flags i32) (result i32)
    (local $stream_w i32) (local $cookie i32) (local $callback i32)
    (local $raw i32) (local $pcb i32) (local $len i32) (local $capacity i32)
    (local $got i32) (local $error i32)
    (local.set $stream_w (call $g2w (local.get $stream_g)))
    (local.set $cookie (i32.load (local.get $stream_w)))
    (local.set $callback (i32.load offset=8 (local.get $stream_w)))
    ;; Compatibility with the older installer shim, whose cookie is directly
    ;; the source string and whose callback slot is zero.
    (if (i32.eqz (local.get $callback))
      (then
        (if (i32.eqz (local.get $cookie)) (then (return (i32.const 0))))
        (local.set $len (call $strlen (call $g2w (local.get $cookie))))
        (return (call $edit_stream_project
          (local.get $state_w) (local.get $cookie) (local.get $len)
          (i32.ne (i32.and (local.get $flags) (i32.const 2)) (i32.const 0))))))
    (local.set $raw (call $heap_alloc (i32.const 65540)))
    (if (i32.eqz (local.get $raw))
      (then
        (i32.store offset=4 (local.get $stream_w) (i32.const 8))
        (return (i32.const 0))))
    (local.set $pcb (i32.add (local.get $raw) (i32.const 65536)))
    (block $done (loop $read
      (br_if $done (i32.ge_u (local.get $len) (i32.const 65535)))
      (local.set $capacity
        (select (i32.const 4096) (i32.sub (i32.const 65535) (local.get $len))
          (i32.gt_u (i32.sub (i32.const 65535) (local.get $len)) (i32.const 4096))))
      (call $gs32 (local.get $pcb) (i32.const 0))
      (local.set $error (call $edit_stream_call
        (local.get $callback) (local.get $cookie)
        (i32.add (local.get $raw) (local.get $len))
        (local.get $capacity) (local.get $pcb)))
      (local.set $got (call $gl32 (local.get $pcb)))
      (if (i32.gt_u (local.get $got) (local.get $capacity))
        (then (local.set $got (local.get $capacity))))
      (local.set $len (i32.add (local.get $len) (local.get $got)))
      (br_if $done (i32.or (i32.ne (local.get $error) (i32.const 0))
                           (i32.eqz (local.get $got))))
      (br $read)))
    (i32.store offset=4 (local.get $stream_w) (local.get $error))
    (local.set $len (call $edit_stream_project
      (local.get $state_w) (local.get $raw) (local.get $len)
      (i32.ne (i32.and (local.get $flags) (i32.const 2)) (i32.const 0))))
    (call $heap_free (local.get $raw))
    (local.get $len))

  (func $edit_wndproc (param $hwnd i32) (param $msg i32) (param $wParam i32) (param $lParam i32) (result i32)
    (local $state i32) (local $state_w i32) (local $cs_w i32)
    (local $name_ptr i32) (local $text_len i32) (local $hdc i32)
    (local $sz i32) (local $w i32) (local $h i32) (local $buf i32)
    (local $cur i32) (local $px i32) (local $lo i32) (local $hi i32)
    (local $vk i32) (local $flags i32)
    (local $sel_lo i32) (local $sel_hi i32) (local $a i32) (local $b i32)
    (local $line_end i32) (local $pre_w i32) (local $sel_w i32)
    (local $line_y i32) (local $line_buf_w i32) (local $brush i32)
    (local $full_w i32) (local $total_lines i32) (local $visible_lines i32) (local $max_scroll i32)
    (local $full_h i32) (local $tx i32) (local $max_hscroll i32)
    (local $cx i32) (local $cy i32)

    (local.set $state (call $wnd_get_state_ptr (local.get $hwnd)))

    ;; ---------- WM_CREATE (0x0001) ----------
    (if (i32.eq (local.get $msg) (i32.const 0x0001))
      (then
        ;; EditState additionally keeps the font installed by WM_SETFONT at
        ;; +32.  Paint replaces this font whenever its floating Fonts palette
        ;; changes, and queries it back with WM_GETFONT for text metrics.
        ;; +36 is the horizontal scroll offset in pixels, used by unwrapped
        ;; WS_HSCROLL edits (Notepad with Word Wrap off).
        (local.set $state (call $heap_alloc (i32.const 40)))
        (local.set $state_w (call $g2w (local.get $state)))
        (store.field EditState text_buf_ptr (local.get $state_w) (i32.const 0))
        (store.field.memarg EditState text_len (local.get $state_w) (i32.const 0))
        (store.field.memarg EditState text_cap (local.get $state_w) (i32.const 0))
        (store.field.memarg EditState cursor (local.get $state_w) (i32.const 0))
        (store.field.memarg EditState sel_anchor (local.get $state_w) (i32.const 0))
        (store.field.memarg EditState scroll_top (local.get $state_w) (i32.const 0))
        (store.field.memarg EditState flags (local.get $state_w) (i32.const 0))
        ;; Plain EDIT keeps the existing unlimited internal default. Both
        ;; Win9x RichEdit generations start at the documented 32,767-character
        ;; input limit until the application explicitly changes it.
        (store.field.memarg EditState max_length (local.get $state_w)
          (select (i32.const 32767) (i32.const 0)
            (i32.or
              (i32.eq (call $ctrl_table_get_class (local.get $hwnd)) (i32.const 24))
              (i32.eq (call $ctrl_table_get_class (local.get $hwnd)) (i32.const 25)))))
        (store.field.memarg EditState font (local.get $state_w) (i32.const 0))
        (store.field.memarg EditState scroll_x (local.get $state_w) (i32.const 0))
        ;; Copy initial text from CREATESTRUCT if provided (lParam may be 0
        ;; when WM_CREATE is delivered via pending_child_create from GetMessageA)
        (if (local.get $lParam)
          (then
            (local.set $cs_w (call $g2w (local.get $lParam)))
            (local.set $name_ptr (i32.load offset=36 (local.get $cs_w)))
            (if (local.get $name_ptr)
              (then
                (local.set $text_len (call $strlen (call $g2w (local.get $name_ptr))))
                (call $edit_ensure_cap (local.get $state_w) (local.get $text_len))
                (if (local.get $text_len)
                  (then (call $memcpy (call $g2w (load.field EditState text_buf_ptr (local.get $state_w)))
                                      (call $g2w (local.get $name_ptr))
                                      (local.get $text_len))))
                (store.field.memarg EditState text_len (local.get $state_w) (local.get $text_len))
                (store.field.memarg EditState cursor (local.get $state_w) (local.get $text_len))
                (store.field.memarg EditState sel_anchor (local.get $state_w) (local.get $text_len))
                (if (load.field EditState text_buf_ptr (local.get $state_w))
                  (then (i32.store8 (i32.add (call $g2w (load.field EditState text_buf_ptr (local.get $state_w))) (local.get $text_len))
                                    (i32.const 0))))))))
        ;; Set flags from window style: ES_MULTILINE(0x04)→bit0, ES_PASSWORD(0x20)→bit1, ES_READONLY(0x800)→bit2
        (local.set $flags (call $wnd_get_style (local.get $hwnd)))
        (if (i32.and (local.get $flags) (i32.const 0x04))
          (then (store.field.memarg EditState flags (local.get $state_w)
            (i32.or (load.field.memarg EditState flags (local.get $state_w)) (i32.const 0x01)))))
        (if (i32.and (local.get $flags) (i32.const 0x0020))
          (then (store.field.memarg EditState flags (local.get $state_w)
            (i32.or (load.field.memarg EditState flags (local.get $state_w)) (i32.const 0x02)))))
        (if (i32.and (local.get $flags) (i32.const 0x0800))
          (then (store.field.memarg EditState flags (local.get $state_w)
            (i32.or (load.field.memarg EditState flags (local.get $state_w)) (i32.const 0x04)))))
        (call $wnd_set_state_ptr (local.get $hwnd) (local.get $state))
        (return (i32.const 0))))

    ;; ---------- WM_SETFONT (0x0030) / WM_GETFONT (0x0031) ----------
    ;; MFC's CWnd::SetFont sends these through the application's EDIT
    ;; subclass. Keep the handle in native EditState so Paint's font toolbar
    ;; can both retrieve it for metrics and use it during control painting.
    (if (i32.eq (local.get $msg) (i32.const 0x0030))
      (then
        (if (local.get $state)
          (then
            (store.field.memarg EditState font (call $g2w (local.get $state)) (local.get $wParam))
            (if (local.get $lParam)
              (then (call $invalidate_hwnd (local.get $hwnd))))))
        (return (i32.const 0))))
    (if (i32.eq (local.get $msg) (i32.const 0x0031))
      (then
        (if (local.get $state)
          (then (return (load.field.memarg EditState font (call $g2w (local.get $state))))))
        (return (i32.const 0))))

    ;; ---------- WM_DESTROY (0x0002) ----------
    (if (i32.eq (local.get $msg) (i32.const 0x0002))
      (then
        (if (local.get $state)
          (then
            (drop (call $timer_kill (local.get $hwnd) (i32.const 0xCA47)))
            (local.set $state_w (call $g2w (local.get $state)))
            (if (load.field EditState text_buf_ptr (local.get $state_w))
              (then (call $heap_free (load.field EditState text_buf_ptr (local.get $state_w)))))
            (call $heap_free (local.get $state))
            (call $wnd_set_state_ptr (local.get $hwnd) (i32.const 0))))
        (if (i32.eq (global.get $focus_hwnd) (local.get $hwnd))
          (then (global.set $focus_hwnd (i32.const 0))))
        (return (i32.const 0))))

    ;; ---------- WM_SETCURSOR (0x0020) ----------
    ;; Show the I-beam over the edit client area (HTCLIENT=1) — but not over
    ;; the scrollbar strips. $defwndproc_do_nccalcsize does not carve those out
    ;; of a WAT-native control's client rect (the control measures and paints
    ;; them itself), so every pixel of the bar still hit-tests as HTCLIENT and
    ;; would otherwise get the text cursor.
    (if (i32.eq (local.get $msg) (i32.const 0x0020))
      (then
        (if (i32.eq (i32.and (local.get $lParam) (i32.const 0xFFFF)) (i32.const 1))
          (then
            (local.set $a (call $host_get_mouse_position))
            (local.set $cx (i32.sub (i32.and (local.get $a) (i32.const 0xFFFF))
                                   (call $wnd_client_screen_x (local.get $hwnd))))
            (local.set $cy (i32.sub (i32.and (i32.shr_u (local.get $a) (i32.const 16)) (i32.const 0xFFFF))
                                   (call $wnd_client_screen_y (local.get $hwnd))))
            (local.set $b (call $ctrl_get_wh_packed (local.get $hwnd)))
            (if (i32.or
                  (i32.and
                    (i32.ne (i32.and (call $wnd_get_style (local.get $hwnd)) (i32.const 0x00200000)) (i32.const 0))
                    (i32.ge_s (local.get $cx)
                      (i32.sub (i32.and (local.get $b) (i32.const 0xFFFF)) (i32.const 16))))
                  (i32.and
                    (call $edit_hscroll_reserved (local.get $hwnd))
                    (i32.ge_s (local.get $cy)
                      (i32.sub (i32.shr_u (local.get $b) (i32.const 16)) (i32.const 16)))))
              (then
                (drop (call $set_cursor_internal (i32.const 0x67F00))) ;; IDC_ARROW
                (return (i32.const 1))))
            (drop (call $set_cursor_internal (i32.const 0x67F01))) ;; IDC_IBEAM
            (return (i32.const 1))))
        (return (i32.const 0))))

    ;; ---------- WM_SETTEXT (0x000C) ----------
    (if (i32.eq (local.get $msg) (i32.const 0x000C))
      (then
        (if (i32.eqz (local.get $state)) (then (return (i32.const 0))))
        (local.set $state_w (call $g2w (local.get $state)))
        (store.field.memarg EditState text_len (local.get $state_w) (i32.const 0))
        (store.field.memarg EditState cursor (local.get $state_w) (i32.const 0))
        (store.field.memarg EditState sel_anchor (local.get $state_w) (i32.const 0))
        (if (local.get $lParam)
          (then
            (local.set $text_len
              (if (result i32) (call $wnd_unicode_get (local.get $hwnd))
                (then (call $strlen_w (call $g2w (local.get $lParam))))
                (else (call $strlen (call $g2w (local.get $lParam))))))
            (call $edit_ensure_cap (local.get $state_w) (local.get $text_len))
            (if (local.get $text_len)
              (then
                (if (call $wnd_unicode_get (local.get $hwnd))
                  (then
                    (drop (call $wide_to_ansi
                      (local.get $lParam) (load.field EditState text_buf_ptr (local.get $state_w))
                      (i32.add (local.get $text_len) (i32.const 1)))))
                  (else
                    (call $memcpy (call $g2w (load.field EditState text_buf_ptr (local.get $state_w)))
                                  (call $g2w (local.get $lParam))
                                  (local.get $text_len))))))
            (store.field.memarg EditState text_len (local.get $state_w) (local.get $text_len))
            (store.field.memarg EditState cursor (local.get $state_w) (local.get $text_len))
            (store.field.memarg EditState sel_anchor (local.get $state_w) (local.get $text_len))
            (if (load.field EditState text_buf_ptr (local.get $state_w))
              (then (i32.store8 (i32.add (call $g2w (load.field EditState text_buf_ptr (local.get $state_w))) (local.get $text_len))
                                (i32.const 0))))))
        (if (i32.and (load.field.memarg EditState flags (local.get $state_w)) (i32.const 0x08))
          (then
            (call $edit_reset_caret_timer (local.get $hwnd) (local.get $state_w))))
        (call $edit_notify_change (local.get $hwnd))
        (call $invalidate_hwnd (local.get $hwnd))
        (return (i32.const 1))))

    ;; ---------- WM_GETTEXT (0x000D) ----------
    (if (i32.eq (local.get $msg) (i32.const 0x000D))
      (then
        (if (i32.eqz (local.get $state)) (then (return (i32.const 0))))
        (if (i32.eqz (local.get $wParam)) (then (return (i32.const 0))))
        (local.set $state_w (call $g2w (local.get $state)))
        (local.set $text_len (load.field.memarg EditState text_len (local.get $state_w)))
        (if (i32.ge_u (local.get $text_len) (local.get $wParam))
          (then (local.set $text_len (i32.sub (local.get $wParam) (i32.const 1)))))
        (if (load.field EditState text_buf_ptr (local.get $state_w))
          (then
            (if (call $wnd_unicode_get (local.get $hwnd))
              (then
                (drop (call $ansi_to_wide
                  (load.field EditState text_buf_ptr (local.get $state_w)) (local.get $lParam)
                  (i32.add (local.get $text_len) (i32.const 1)))))
              (else
                (if (local.get $text_len)
                  (then (call $memcpy (call $g2w (local.get $lParam))
                                      (call $g2w (load.field EditState text_buf_ptr (local.get $state_w)))
                                      (local.get $text_len))))))))
        (if (call $wnd_unicode_get (local.get $hwnd))
          (then
            (call $gs16
              (i32.add (local.get $lParam) (i32.shl (local.get $text_len) (i32.const 1)))
              (i32.const 0)))
          (else
            (i32.store8 (i32.add (call $g2w (local.get $lParam)) (local.get $text_len)) (i32.const 0))))
        (return (local.get $text_len))))

    ;; ---------- WM_GETTEXTLENGTH (0x000E) ----------
    (if (i32.eq (local.get $msg) (i32.const 0x000E))
      (then
        (if (local.get $state)
          (then (return (load.field.memarg EditState text_len (call $g2w (local.get $state))))))
        (return (i32.const 0))))

    ;; ---------- EM_STREAMIN (0x0449) ----------
    ;; RichEdit accepts either the documented callback-backed EDITSTREAM or the
    ;; older direct-cookie compatibility shape used by a few installers.
    (if (i32.eq (local.get $msg) (i32.const 0x0449))
      (then
        (if (i32.eqz (local.get $state)) (then (return (i32.const 0))))
        (if (i32.eqz (local.get $lParam)) (then (return (i32.const 0))))
        (local.set $state_w (call $g2w (local.get $state)))
        (store.field.memarg EditState text_len (local.get $state_w) (i32.const 0))
        (store.field.memarg EditState cursor (local.get $state_w) (i32.const 0))
        (store.field.memarg EditState sel_anchor (local.get $state_w) (i32.const 0))
        (local.set $text_len (call $edit_stream_read
          (local.get $state_w) (local.get $lParam) (local.get $wParam)))
        (call $invalidate_hwnd (local.get $hwnd))
        (if (call $wnd_is_effectively_visible (local.get $hwnd))
          (then
            (drop (call $edit_wndproc
              (local.get $hwnd) (i32.const 0x000F)
              (i32.const 0) (i32.const 0)))
            (call $update_clear_hwnd (local.get $hwnd))
            (call $paint_flag_clear_hwnd (local.get $hwnd))))
        (return (load.field.memarg EditState text_len (local.get $state_w)))))

    ;; ---------- WM_SETFOCUS (0x0007) ----------
    (if (i32.eq (local.get $msg) (i32.const 0x0007))
      (then
        (global.set $focus_hwnd (local.get $hwnd))
        (if (local.get $state)
          (then
            (local.set $state_w (call $g2w (local.get $state)))
            (store.field.memarg EditState flags (local.get $state_w)
              (i32.or (load.field.memarg EditState flags (local.get $state_w)) (i32.const 0x08)))
            (call $edit_reset_caret_timer (local.get $hwnd) (local.get $state_w))))
        (call $edit_notify (local.get $hwnd) (i32.const 0x0100)) ;; EN_SETFOCUS
        (call $invalidate_hwnd (local.get $hwnd))
        (return (i32.const 0))))

    ;; ---------- WM_KILLFOCUS (0x0008) ----------
    (if (i32.eq (local.get $msg) (i32.const 0x0008))
      (then
        (if (i32.eq (global.get $focus_hwnd) (local.get $hwnd))
          (then (global.set $focus_hwnd (i32.const 0))))
        (if (local.get $state)
          (then
            (local.set $state_w (call $g2w (local.get $state)))
            (call $edit_stop_caret_timer (local.get $hwnd) (local.get $state_w))
            (store.field.memarg EditState flags (local.get $state_w)
              (i32.and (load.field.memarg EditState flags (local.get $state_w)) (i32.const 0xFFFFFFF7)))))
        (call $edit_notify (local.get $hwnd) (i32.const 0x0200)) ;; EN_KILLFOCUS
        (call $invalidate_hwnd (local.get $hwnd))
        (return (i32.const 0))))

    ;; ---------- WM_SIZE (0x0005) ----------
    ;; Wrapped multiline edits derive max_scroll from current control geometry.
    ;; Clamp immediately on resize so EM_GETFIRSTVISIBLELINE cannot expose a
    ;; stale top line after a window/control grows wider or taller.
    (if (i32.eq (local.get $msg) (i32.const 0x0005))
      (then
        (if (i32.eqz (local.get $state)) (then (return (i32.const 0))))
        (local.set $state_w (call $g2w (local.get $state)))
        (if (i32.eqz (i32.and (call $wnd_get_style (local.get $hwnd)) (i32.const 0x00000004)))
          (then (return (i32.const 0))))
        ;; $edit_view_metrics is the one place that knows a WS_HSCROLL edit
        ;; loses 16px of height to its own scrollbar. This site used to
        ;; re-derive the viewport inline and omit exactly that, so a horizontal
        ;; scrollbar bought the control one extra "visible" line it does not have.
        (local.set $sz (call $edit_view_metrics (local.get $hwnd) (local.get $state_w)))
        (local.set $total_lines (i32.and (local.get $sz) (i32.const 0xFFFF)))
        (local.set $visible_lines (i32.shr_u (local.get $sz) (i32.const 16)))
        (local.set $max_scroll (i32.sub (local.get $total_lines) (local.get $visible_lines)))
        (if (i32.lt_s (local.get $max_scroll) (i32.const 0))
          (then (local.set $max_scroll (i32.const 0))))
        (if (i32.gt_s (load.field.memarg EditState scroll_top (local.get $state_w)) (local.get $max_scroll))
          (then (store.field.memarg EditState scroll_top (local.get $state_w) (local.get $max_scroll))))
        (call $invalidate_hwnd (local.get $hwnd))
        (return (i32.const 0))))

    ;; ---------- WM_TIMER (0x0113) ----------
    ;; Swallowed. 0xCA47 was this control's private caret-blink timer, back when
    ;; it drew and blinked a caret of its own; USER owns the caret now and
    ;; nothing sets that timer any more.
    (if (i32.eq (local.get $msg) (i32.const 0x0113))
      (then (return (i32.const 0))))

    ;; ---------- WM_CHAR (0x0102) ----------
    (if (i32.eq (local.get $msg) (i32.const 0x0102))
      (then
        (if (i32.eqz (local.get $state)) (then (return (i32.const 0))))
        (local.set $state_w (call $g2w (local.get $state)))
        (if (i32.and (load.field.memarg EditState flags (local.get $state_w)) (i32.const 0x04))
          (then (return (i32.const 0))))
        ;; VK_BACK = 0x08 — backspace
        (if (i32.eq (local.get $wParam) (i32.const 0x08))
          (then
            (local.set $lo (call $edit_sel_lo (local.get $state_w)))
            (local.set $hi (call $edit_sel_hi (local.get $state_w)))
            (if (i32.ne (local.get $lo) (local.get $hi))
              (then (call $edit_delete_range (local.get $state_w) (local.get $lo) (local.get $hi)))
              (else
                (if (local.get $lo)
                  (then (call $edit_delete_range (local.get $state_w)
                          (i32.sub (local.get $lo) (i32.const 1))
                          (local.get $lo))))))
            (call $edit_reset_caret_timer (local.get $hwnd) (local.get $state_w))
            (call $edit_notify_change (local.get $hwnd))
            (call $edit_invalidate_caret (local.get $hwnd))
            (return (i32.const 0))))
        ;; CR (0x0D) — Enter key: insert newline only for multiline edits (bit 0 of flags)
        (if (i32.eq (local.get $wParam) (i32.const 0x0D))
          (then
            (if (i32.and (load.field.memarg EditState flags (local.get $state_w)) (i32.const 0x01))
              (then
                (call $edit_insert_char (local.get $state_w) (i32.const 0x0A))
                (store.field.memarg EditState flags (local.get $state_w)
                  (i32.or (load.field.memarg EditState flags (local.get $state_w)) (i32.const 0x08)))
                (call $edit_reset_caret_timer (local.get $hwnd) (local.get $state_w))
                (call $edit_notify_change (local.get $hwnd))
                (call $edit_invalidate_caret (local.get $hwnd))))
            (return (i32.const 0))))
        (if (i32.lt_u (local.get $wParam) (i32.const 0x20))
          (then (return (i32.const 0))))
        (call $edit_insert_char (local.get $state_w) (local.get $wParam))
        (store.field.memarg EditState flags (local.get $state_w)
          (i32.or (load.field.memarg EditState flags (local.get $state_w)) (i32.const 0x08)))
        (call $edit_reset_caret_timer (local.get $hwnd) (local.get $state_w))
        (call $edit_notify_change (local.get $hwnd))
        (call $edit_invalidate_caret (local.get $hwnd))
        (return (i32.const 0))))

    ;; ---------- WM_KEYDOWN (0x0100) ----------
    ;; Keyboard navigation + editing. Shift-held keeps sel_anchor so arrows
    ;; extend the selection; plain arrows collapse. Ctrl+A/C/X/V handle
    ;; select-all / copy / cut / paste. Ctrl+Left/Right jump word boundaries;
    ;; Ctrl+Home/End jump to start/end of text. $a = shift_down, $b = ctrl_down
    ;; (high bit of host_get_async_key_state, read once at top).
    (if (i32.eq (local.get $msg) (i32.const 0x0100))
      (then
        (if (i32.eqz (local.get $state)) (then (return (i32.const 0))))
        (local.set $state_w (call $g2w (local.get $state)))
        (local.set $vk (local.get $wParam))
        (local.set $cur (load.field.memarg EditState cursor (local.get $state_w)))
        (local.set $text_len (load.field.memarg EditState text_len (local.get $state_w)))
        (local.set $a (call $edit_shift_down))
        (local.set $b (call $edit_ctrl_down))
        ;; ---- Ctrl combos ----
        (if (local.get $b)
          (then
            ;; Ctrl+A (0x41) — select all
            (if (i32.eq (local.get $vk) (i32.const 0x41))
              (then
                (store.field.memarg EditState sel_anchor (local.get $state_w) (i32.const 0))
                (store.field.memarg EditState cursor (local.get $state_w) (local.get $text_len))
                (call $edit_invalidate_caret (local.get $hwnd))
                (return (i32.const 0))))
            ;; Ctrl+C (0x43) — copy
            (if (i32.eq (local.get $vk) (i32.const 0x43))
              (then
                (call $edit_copy_range (local.get $state_w)
                  (call $edit_sel_lo (local.get $state_w))
                  (call $edit_sel_hi (local.get $state_w)))
                (return (i32.const 0))))
            ;; Ctrl+X (0x58) — cut (read-only blocks deletion but copy still fires)
            (if (i32.eq (local.get $vk) (i32.const 0x58))
              (then
                (local.set $lo (call $edit_sel_lo (local.get $state_w)))
                (local.set $hi (call $edit_sel_hi (local.get $state_w)))
                (call $edit_copy_range (local.get $state_w) (local.get $lo) (local.get $hi))
                (if (i32.eqz (i32.and (load.field.memarg EditState flags (local.get $state_w)) (i32.const 0x04)))
                  (then
                    (call $edit_delete_range (local.get $state_w) (local.get $lo) (local.get $hi))
                    (call $edit_notify_change (local.get $hwnd))
                    (call $edit_invalidate_caret (local.get $hwnd))))
                (return (i32.const 0))))
            ;; Ctrl+V (0x56) — paste
            (if (i32.eq (local.get $vk) (i32.const 0x56))
              (then
                (if (i32.eqz (i32.and (load.field.memarg EditState flags (local.get $state_w)) (i32.const 0x04)))
                  (then
                    (if (global.get $clipboard_len)
                      (then (call $edit_insert_bytes (local.get $state_w)
                              (global.get $clipboard_ptr) (global.get $clipboard_len))
                            (call $edit_notify_change (local.get $hwnd))))
                    (call $edit_invalidate_caret (local.get $hwnd))))
                (return (i32.const 0))))))
        ;; VK_LEFT 0x25
        (if (i32.eq (local.get $vk) (i32.const 0x25))
          (then
            (if (local.get $cur)
              (then
                (if (local.get $b)
                  (then (local.set $cur (call $edit_word_start (local.get $state_w)
                          (i32.sub (local.get $cur) (i32.const 1)))))
                  (else (local.set $cur (i32.sub (local.get $cur) (i32.const 1)))))
                (store.field.memarg EditState cursor (local.get $state_w) (local.get $cur))
                (if (i32.eqz (local.get $a))
                  (then (store.field.memarg EditState sel_anchor (local.get $state_w) (local.get $cur))))
                (call $edit_invalidate_caret (local.get $hwnd))))
            (return (i32.const 0))))
        ;; VK_RIGHT 0x27
        (if (i32.eq (local.get $vk) (i32.const 0x27))
          (then
            (if (i32.lt_u (local.get $cur) (local.get $text_len))
              (then
                (if (local.get $b)
                  (then (local.set $cur (call $edit_word_end (local.get $state_w)
                          (i32.add (local.get $cur) (i32.const 1)))))
                  (else (local.set $cur (i32.add (local.get $cur) (i32.const 1)))))
                (store.field.memarg EditState cursor (local.get $state_w) (local.get $cur))
                (if (i32.eqz (local.get $a))
                  (then (store.field.memarg EditState sel_anchor (local.get $state_w) (local.get $cur))))
                (call $edit_invalidate_caret (local.get $hwnd))))
            (return (i32.const 0))))
        ;; VK_HOME 0x24 — start of line (or start of text with Ctrl)
        (if (i32.eq (local.get $vk) (i32.const 0x24))
          (then
            (if (local.get $b)
              (then (local.set $cur (i32.const 0)))
              (else (local.set $cur (call $edit_line_start (local.get $state_w) (local.get $cur)))))
            (store.field.memarg EditState cursor (local.get $state_w) (local.get $cur))
            (if (i32.eqz (local.get $a))
              (then (store.field.memarg EditState sel_anchor (local.get $state_w) (local.get $cur))))
            (call $edit_invalidate_caret (local.get $hwnd))
            (return (i32.const 0))))
        ;; VK_END 0x23 — end of line (or end of text with Ctrl)
        (if (i32.eq (local.get $vk) (i32.const 0x23))
          (then
            (if (local.get $b)
              (then (local.set $cur (local.get $text_len)))
              (else
                (local.set $lo (call $edit_line_start (local.get $state_w) (local.get $cur)))
                (local.set $cur (i32.add (local.get $lo)
                  (call $edit_line_len (local.get $state_w) (local.get $lo))))))
            (store.field.memarg EditState cursor (local.get $state_w) (local.get $cur))
            (if (i32.eqz (local.get $a))
              (then (store.field.memarg EditState sel_anchor (local.get $state_w) (local.get $cur))))
            (call $edit_invalidate_caret (local.get $hwnd))
            (return (i32.const 0))))
        ;; VK_BACK 0x08 — backspace. Browsers don't fire keypress for VK_BACK,
        ;; so WM_CHAR 0x08 never arrives for WAT-native edits; handle it here.
        (if (i32.eq (local.get $vk) (i32.const 0x08))
          (then
            (if (i32.and (load.field.memarg EditState flags (local.get $state_w)) (i32.const 0x04))
              (then (return (i32.const 0))))
            (local.set $lo (call $edit_sel_lo (local.get $state_w)))
            (local.set $hi (call $edit_sel_hi (local.get $state_w)))
            (if (i32.ne (local.get $lo) (local.get $hi))
              (then (call $edit_delete_range (local.get $state_w) (local.get $lo) (local.get $hi)))
              (else
                (if (local.get $cur)
                  (then (call $edit_delete_range (local.get $state_w)
                          (i32.sub (local.get $cur) (i32.const 1))
                          (local.get $cur))))))
            (call $edit_notify_change (local.get $hwnd))
            (call $edit_invalidate_caret (local.get $hwnd))
            (return (i32.const 0))))
        ;; VK_DELETE 0x2E
        (if (i32.eq (local.get $vk) (i32.const 0x2E))
          (then
            (if (i32.and (load.field.memarg EditState flags (local.get $state_w)) (i32.const 0x04))
              (then (return (i32.const 0))))
            (local.set $lo (call $edit_sel_lo (local.get $state_w)))
            (local.set $hi (call $edit_sel_hi (local.get $state_w)))
            (if (i32.ne (local.get $lo) (local.get $hi))
              (then (call $edit_delete_range (local.get $state_w) (local.get $lo) (local.get $hi)))
              (else
                (if (i32.lt_u (local.get $cur) (local.get $text_len))
                  (then (call $edit_delete_range (local.get $state_w)
                          (local.get $cur)
                          (i32.add (local.get $cur) (i32.const 1)))))))
            (call $edit_notify_change (local.get $hwnd))
            (call $edit_invalidate_caret (local.get $hwnd))
            (return (i32.const 0))))
        ;; VK_UP 0x26
        (if (i32.eq (local.get $vk) (i32.const 0x26))
          (then
            (local.set $lo (call $edit_line_start (local.get $state_w) (local.get $cur)))
            (if (local.get $lo)  ;; not on first line
              (then
                ;; col = cur - line_start
                (local.set $hi (i32.sub (local.get $cur) (local.get $lo)))
                ;; find start of previous line
                (local.set $lo (call $edit_line_start (local.get $state_w) (i32.sub (local.get $lo) (i32.const 1))))
                ;; prev line length
                (local.set $px (call $edit_line_len (local.get $state_w) (local.get $lo)))
                ;; clamp col to prev line length
                (if (i32.gt_u (local.get $hi) (local.get $px))
                  (then (local.set $hi (local.get $px))))
                (local.set $cur (i32.add (local.get $lo) (local.get $hi)))
                (store.field.memarg EditState cursor (local.get $state_w) (local.get $cur))
                (if (i32.eqz (local.get $a))
                  (then (store.field.memarg EditState sel_anchor (local.get $state_w) (local.get $cur))))
                (call $edit_invalidate_caret (local.get $hwnd))))
            (return (i32.const 0))))
        ;; VK_DOWN 0x28
        (if (i32.eq (local.get $vk) (i32.const 0x28))
          (then
            ;; col = cur - line_start
            (local.set $lo (call $edit_line_start (local.get $state_w) (local.get $cur)))
            (local.set $hi (i32.sub (local.get $cur) (local.get $lo)))
            ;; find end of current line (next \n or text_len)
            (local.set $px (i32.add (local.get $lo) (call $edit_line_len (local.get $state_w) (local.get $lo))))
            (if (i32.lt_u (local.get $px) (local.get $text_len))
              (then
                ;; next line starts after the \n
                (local.set $lo (i32.add (local.get $px) (i32.const 1)))
                ;; next line length
                (local.set $px (call $edit_line_len (local.get $state_w) (local.get $lo)))
                ;; clamp col
                (if (i32.gt_u (local.get $hi) (local.get $px))
                  (then (local.set $hi (local.get $px))))
                (local.set $cur (i32.add (local.get $lo) (local.get $hi)))
                (store.field.memarg EditState cursor (local.get $state_w) (local.get $cur))
                (if (i32.eqz (local.get $a))
                  (then (store.field.memarg EditState sel_anchor (local.get $state_w) (local.get $cur))))
                (call $edit_invalidate_caret (local.get $hwnd))))
            (return (i32.const 0))))
        (return (i32.const 0))))

    ;; ---------- WM_LBUTTONDOWN (0x0201) / WM_LBUTTONDBLCLK (0x0203) ----------
    ;; Click: hit-test via $edit_xy_to_offset, move cursor there. Shift-held
    ;; keeps the anchor (extends selection); plain click collapses both.
    ;; Double-click selects the word under the cursor. lParam = x | y<<16.
    (if (i32.or (i32.eq (local.get $msg) (i32.const 0x0201))
                (i32.eq (local.get $msg) (i32.const 0x0203)))
      (then
        ;; Focus transfer: mirror SetFocus's WM_KILLFOCUS to the previous
        ;; focus window. Without this, the old edit keeps its 0x08 focus
        ;; flag and keeps drawing a caret after the user clicks another
        ;; control. WAT-native wndprocs dispatch synchronously; x86 ones
        ;; fall back to the post queue (matches $handle_SetFocus).
        (if (i32.and (i32.ne (global.get $focus_hwnd) (local.get $hwnd))
                     (i32.ne (global.get $focus_hwnd) (i32.const 0)))
          (then
            (if (i32.ge_u (call $wnd_table_get (global.get $focus_hwnd))
                          (i32.const 0xFFFF0000))
              (then (drop (call $wat_wndproc_dispatch
                      (global.get $focus_hwnd) (i32.const 0x0008)
                      (local.get $hwnd) (i32.const 0))))
              (else (drop (call $post_queue_push
                      (global.get $focus_hwnd) (i32.const 0x0008)
                      (local.get $hwnd) (i32.const 0)))))))
        (global.set $focus_hwnd (local.get $hwnd))
        ;; Grab mouse capture so the renderer routes WM_MOUSEMOVE here
        ;; with MK_LBUTTON while the user drags — needed for selection
        ;; extension. Released on WM_LBUTTONUP below.
        (global.set $capture_hwnd (local.get $hwnd))
        (if (i32.eqz (local.get $state)) (then (return (i32.const 0))))
        (local.set $state_w (call $g2w (local.get $state)))
        ;; Mark focused + drag-tracking bit 4 (0x10).
        (store.field.memarg EditState flags (local.get $state_w)
          (i32.or (load.field.memarg EditState flags (local.get $state_w)) (i32.const 0x18)))
        (call $edit_reset_caret_timer (local.get $hwnd) (local.get $state_w))
	        (local.set $hdc (i32.add (local.get $hwnd) (i32.const 0x40000)))
	        (local.set $w (i32.shr_s (i32.shl (local.get $lParam) (i32.const 16)) (i32.const 16)))
	        (local.set $h (i32.shr_s (local.get $lParam) (i32.const 16)))
	        ;; Inside the horizontal strip. Checked before the vertical one and
	        ;; before the text hit-test, since the bottom-right corner belongs
	        ;; to neither scrollbar and a press in the strip is not a caret
	        ;; placement. Parts: 3 = left arrow held, 4 = right arrow held,
	        ;; 6 = thumb drag (the vertical thumb owns 5).
	        (if (call $edit_hscroll_reserved (local.get $hwnd))
	          (then
	            (local.set $sz (call $ctrl_get_wh_packed (local.get $hwnd)))
	            (local.set $full_w (i32.and (local.get $sz) (i32.const 0xFFFF)))
	            (local.set $full_h (i32.shr_u (local.get $sz) (i32.const 16)))
	            (local.set $line_buf_w (local.get $full_w))
	            (if (i32.and (call $wnd_get_style (local.get $hwnd)) (i32.const 0x00200000))
	              (then (local.set $line_buf_w (i32.sub (local.get $full_w) (i32.const 16)))))
	            (if (i32.and
	                  (i32.ge_s (local.get $h) (i32.sub (local.get $full_h) (i32.const 16)))
	                  (i32.lt_s (local.get $w) (local.get $line_buf_w)))
	              (then
	                (local.set $max_hscroll (call $edit_max_hscroll
	                  (local.get $state_w) (local.get $hdc) (local.get $line_buf_w)))
	                (local.set $lo (load.field.memarg EditState scroll_x (local.get $state_w)))
	                (local.set $b (call $scroll_arrow_filter_hit
	                  (local.get $hwnd) (i32.const 0)
	                  (call $sb_page_hit_part
	                    (local.get $line_buf_w) (local.get $w) (local.get $lo)
	                    (i32.const 0)
	                    (i32.sub (i32.add (local.get $max_hscroll) (local.get $line_buf_w))
	                             (i32.const 1))
	                    (local.get $line_buf_w))))
	                ;; One arrow click is one average character wide; a page is
	                ;; the visible width, matching what USER does with a
	                ;; proportional font.
	                (if (i32.eq (local.get $b) (i32.const 1))
	                  (then (drop (call $edit_hscroll_to (local.get $state_w)
	                    (i32.sub (local.get $lo) (i32.const 8)) (local.get $max_hscroll)))
	                    (global.set $sb_pressed_hwnd (local.get $hwnd))
	                    (global.set $sb_pressed_part (i32.const 3))))
	                (if (i32.eq (local.get $b) (i32.const 2))
	                  (then (drop (call $edit_hscroll_to (local.get $state_w)
	                    (i32.add (local.get $lo) (i32.const 8)) (local.get $max_hscroll)))
	                    (global.set $sb_pressed_hwnd (local.get $hwnd))
	                    (global.set $sb_pressed_part (i32.const 4))))
	                (if (i32.eq (local.get $b) (i32.const 3))
	                  (then (drop (call $edit_hscroll_to (local.get $state_w)
	                    (i32.sub (local.get $lo) (local.get $line_buf_w))
	                    (local.get $max_hscroll)))))
	                (if (i32.eq (local.get $b) (i32.const 4))
	                  (then (drop (call $edit_hscroll_to (local.get $state_w)
	                    (i32.add (local.get $lo) (local.get $line_buf_w))
	                    (local.get $max_hscroll)))))
	                (if (i32.eq (local.get $b) (i32.const 5))
	                  (then
	                    (global.set $edit_sb_drag_anchor_y (local.get $w))
	                    (global.set $edit_sb_drag_anchor_top (local.get $lo))
	                    (global.set $sb_pressed_hwnd (local.get $hwnd))
	                    (global.set $sb_pressed_part (i32.const 6))))
	                ;; Not the start of a text selection.
	                (store.field.memarg EditState flags (local.get $state_w)
	                  (i32.and (load.field.memarg EditState flags (local.get $state_w)) (i32.const 0xFFFFFFEF)))
	                (call $invalidate_hwnd (local.get $hwnd))
	                (return (i32.const 0))))))
	        (if (i32.and (call $wnd_get_style (local.get $hwnd)) (i32.const 0x00200000))
	          (then
	            (local.set $sz (call $ctrl_get_wh_packed (local.get $hwnd)))
	            (local.set $full_w (i32.and (local.get $sz) (i32.const 0xFFFF)))
	            (local.set $line_y (i32.shr_u (local.get $sz) (i32.const 16)))
	            ;; The vertical strip stops above the horizontal one, so its
	            ;; track is that much shorter when both are present.
	            (if (call $edit_hscroll_reserved (local.get $hwnd))
	              (then (local.set $line_y (i32.sub (local.get $line_y) (i32.const 16)))))
	            ;; Inside the vertical strip: classify with the same geometry
	            ;; $defwndproc_paint_standard_scrollbar painted it with, so a
	            ;; press on the thumb the user can see starts a drag rather than
	            ;; a page. This used to be a fourth private copy of the thumb
	            ;; arithmetic, which sized the thumb at 16px while the painter
	            ;; sized it by nPage -- so most of the visible thumb paged.
	            (if (i32.ge_s (local.get $w) (i32.sub (local.get $full_w) (i32.const 16)))
	              (then
	                (local.set $a (call $edit_view_metrics (local.get $hwnd) (local.get $state_w)))
	                (local.set $total_lines (i32.and (local.get $a) (i32.const 0xFFFF)))
	                (local.set $visible_lines (i32.shr_u (local.get $a) (i32.const 16)))
	                (local.set $lo (load.field.memarg EditState scroll_top (local.get $state_w)))
	                (local.set $b (call $scroll_arrow_filter_hit
	                  (local.get $hwnd) (i32.const 1)
	                  (call $sb_page_hit_part
	                    (local.get $line_y) (local.get $h) (local.get $lo)
	                    (i32.const 0) (i32.sub (local.get $total_lines) (i32.const 1))
	                    (local.get $visible_lines))))
	                (if (i32.eq (local.get $b) (i32.const 1))
	                  (then (drop (call $edit_scroll_to (local.get $hwnd) (local.get $state_w)
	                    (i32.sub (local.get $lo) (i32.const 1))
	                    (local.get $total_lines) (local.get $visible_lines)))))
	                (if (i32.eq (local.get $b) (i32.const 2))
	                  (then (drop (call $edit_scroll_to (local.get $hwnd) (local.get $state_w)
	                    (i32.add (local.get $lo) (i32.const 1))
	                    (local.get $total_lines) (local.get $visible_lines)))))
	                (if (i32.eq (local.get $b) (i32.const 3))
	                  (then (drop (call $edit_scroll_to (local.get $hwnd) (local.get $state_w)
	                    (i32.sub (local.get $lo) (local.get $visible_lines))
	                    (local.get $total_lines) (local.get $visible_lines)))))
	                (if (i32.eq (local.get $b) (i32.const 4))
	                  (then (drop (call $edit_scroll_to (local.get $hwnd) (local.get $state_w)
	                    (i32.add (local.get $lo) (local.get $visible_lines))
	                    (local.get $total_lines) (local.get $visible_lines)))))
	                (if (i32.eq (local.get $b) (i32.const 5))
	                  (then
	                    (global.set $edit_sb_drag_anchor_y (local.get $h))
	                    (global.set $edit_sb_drag_anchor_top (local.get $lo))))
	                (if (local.get $b)
	                  (then
	                    (global.set $sb_pressed_hwnd (local.get $hwnd))
	                    (global.set $sb_pressed_part (local.get $b))))
	                ;; A press on the scrollbar is not the start of a text
	                ;; selection. WM_LBUTTONDOWN arms tracking bit 0x10 before it
	                ;; knows where the click landed, so clear it here or every
	                ;; following WM_MOUSEMOVE extends a selection while the user
	                ;; is only dragging the thumb.
	                (store.field.memarg EditState flags (local.get $state_w)
	                  (i32.and (load.field.memarg EditState flags (local.get $state_w)) (i32.const 0xFFFFFFEF)))
	                (drop (call $wnd_send_message
	                  (local.get $hwnd) (i32.const 0x000F) (i32.const 0) (i32.const 0)))
	                (call $invalidate_hwnd (local.get $hwnd))
	                (return (i32.const 0))))))
	        (if (call $edit_wraps (local.get $hwnd))
	          (then
	            (local.set $sz (call $ctrl_get_wh_packed (local.get $hwnd)))
	            (local.set $cur (call $edit_layout_xy_to_offset
	              (local.get $state_w) (local.get $hdc)
	              (i32.sub (i32.and (local.get $sz) (i32.const 0xFFFF)) (i32.const 16))
	              (local.get $w) (local.get $h))))
	          (else
	            (local.set $cur (call $edit_xy_to_offset
	              (local.get $state_w) (local.get $hdc) (local.get $w) (local.get $h)))))
        (if (i32.eq (local.get $msg) (i32.const 0x0203))
          (then
            ;; Double-click: select word spanning $cur
            (local.set $lo (call $edit_word_start (local.get $state_w) (local.get $cur)))
            (local.set $hi (call $edit_word_end (local.get $state_w) (local.get $cur)))
            (store.field.memarg EditState sel_anchor (local.get $state_w) (local.get $lo))
            (store.field.memarg EditState cursor (local.get $state_w) (local.get $hi)))
          (else
            (store.field.memarg EditState cursor (local.get $state_w) (local.get $cur))
            ;; Only collapse anchor when Shift is NOT held (extends existing selection).
            (if (i32.eqz (call $edit_shift_down))
              (then (store.field.memarg EditState sel_anchor (local.get $state_w) (local.get $cur))))))
        (call $invalidate_hwnd (local.get $hwnd))
        (return (i32.const 0))))

    ;; ---------- WM_MOUSEMOVE (0x0200) ----------
    ;; Extend selection while the left button is held (tracking bit 0x10
    ;; set by LBUTTONDOWN). MK_LBUTTON in wParam confirms the button is
    ;; actually down — guards against stray moves after a button-up we
    ;; didn't see.
    (if (i32.eq (local.get $msg) (i32.const 0x0200))
      (then
	        (if (i32.eqz (local.get $state)) (then (return (i32.const 0))))
	        (local.set $state_w (call $g2w (local.get $state)))
	        ;; Horizontal thumb drag (part 6): same shared geometry as the
	        ;; strip painter, in pixels rather than lines.
	        (if (i32.and (i32.eq (global.get $sb_pressed_hwnd) (local.get $hwnd))
	                     (i32.eq (global.get $sb_pressed_part) (i32.const 6)))
	          (then
	            (if (i32.eqz (i32.and (local.get $wParam) (i32.const 0x0001)))
	              (then
	                (global.set $sb_pressed_hwnd (i32.const 0))
	                (global.set $sb_pressed_part (i32.const 0))
	                (if (i32.eq (global.get $capture_hwnd) (local.get $hwnd))
	                  (then (global.set $capture_hwnd (i32.const 0))))
	                (return (i32.const 0))))
	            (local.set $hdc (i32.add (local.get $hwnd) (i32.const 0x40000)))
	            (local.set $sz (call $ctrl_get_wh_packed (local.get $hwnd)))
	            (local.set $line_buf_w (i32.and (local.get $sz) (i32.const 0xFFFF)))
	            (if (i32.and (call $wnd_get_style (local.get $hwnd)) (i32.const 0x00200000))
	              (then (local.set $line_buf_w (i32.sub (local.get $line_buf_w) (i32.const 16)))))
	            (local.set $w (i32.shr_s (i32.shl (local.get $lParam) (i32.const 16)) (i32.const 16)))
	            (local.set $max_hscroll (call $edit_max_hscroll
	              (local.get $state_w) (local.get $hdc) (local.get $line_buf_w)))
	            (drop (call $edit_hscroll_to (local.get $state_w)
	              (call $sb_page_drag_pos
	                (local.get $line_buf_w) (local.get $w)
	                (global.get $edit_sb_drag_anchor_y) (global.get $edit_sb_drag_anchor_top)
	                (i32.const 0)
	                (i32.sub (i32.add (local.get $max_hscroll) (local.get $line_buf_w))
	                         (i32.const 1))
	                (local.get $line_buf_w))
	              (local.get $max_hscroll)))
	            (call $invalidate_hwnd (local.get $hwnd))
	            (return (i32.const 0))))
	        (if (i32.and (i32.eq (global.get $sb_pressed_hwnd) (local.get $hwnd))
	                     (i32.eq (global.get $sb_pressed_part) (i32.const 5)))
	          (then
	            (if (i32.eqz (i32.and (local.get $wParam) (i32.const 0x0001)))
	              (then
	                (global.set $sb_pressed_hwnd (i32.const 0))
	                (global.set $sb_pressed_part (i32.const 0))
	                (if (i32.eq (global.get $capture_hwnd) (local.get $hwnd))
	                  (then (global.set $capture_hwnd (i32.const 0))))
	                (return (i32.const 0))))
	            ;; Thumb drag through the shared geometry, so the thumb tracks
	            ;; the pointer instead of the private 16px thumb this used to
	            ;; assume while the painter drew one sized by nPage.
	            (local.set $sz (call $ctrl_get_wh_packed (local.get $hwnd)))
	            (local.set $line_y (i32.shr_u (local.get $sz) (i32.const 16)))
	            (local.set $h (i32.shr_s (local.get $lParam) (i32.const 16)))
	            (local.set $a (call $edit_view_metrics (local.get $hwnd) (local.get $state_w)))
	            (local.set $total_lines (i32.and (local.get $a) (i32.const 0xFFFF)))
	            (local.set $visible_lines (i32.shr_u (local.get $a) (i32.const 16)))
	            (drop (call $edit_scroll_to (local.get $hwnd) (local.get $state_w)
	              (call $sb_page_drag_pos
	                (local.get $line_y) (local.get $h)
	                (global.get $edit_sb_drag_anchor_y) (global.get $edit_sb_drag_anchor_top)
	                (i32.const 0) (i32.sub (local.get $total_lines) (i32.const 1))
	                (local.get $visible_lines))
	              (local.get $total_lines) (local.get $visible_lines)))
	            (call $invalidate_hwnd (local.get $hwnd))
	            (return (i32.const 0))))
	        (local.set $flags (load.field.memarg EditState flags (local.get $state_w)))
        (if (i32.eqz (i32.and (local.get $flags) (i32.const 0x10)))
          (then (return (i32.const 0))))
        (if (i32.eqz (i32.and (local.get $wParam) (i32.const 0x0001)))
          (then
            ;; Lost the button without a WM_LBUTTONUP — clear drag flag.
            (store.field.memarg EditState flags (local.get $state_w)
              (i32.and (local.get $flags) (i32.const 0xFFFFFFEF)))
            (return (i32.const 0))))
        (local.set $hdc (i32.add (local.get $hwnd) (i32.const 0x40000)))
        (local.set $w (i32.shr_s (i32.shl (local.get $lParam) (i32.const 16)) (i32.const 16)))
        (local.set $h (i32.shr_s (local.get $lParam) (i32.const 16)))
        (if (call $edit_wraps (local.get $hwnd))
          (then
            (local.set $sz (call $ctrl_get_wh_packed (local.get $hwnd)))
            (local.set $cur (call $edit_layout_xy_to_offset
              (local.get $state_w) (local.get $hdc)
              (i32.sub (i32.and (local.get $sz) (i32.const 0xFFFF)) (i32.const 16))
              (local.get $w) (local.get $h))))
          (else
            (local.set $cur (call $edit_xy_to_offset
              (local.get $state_w) (local.get $hdc) (local.get $w) (local.get $h)))))
        (if (i32.ne (local.get $cur) (load.field.memarg EditState cursor (local.get $state_w)))
          (then
            (store.field.memarg EditState cursor (local.get $state_w) (local.get $cur))
            (call $invalidate_hwnd (local.get $hwnd))))
        (return (i32.const 0))))

    ;; ---------- WM_LBUTTONUP (0x0202) ----------
    (if (i32.eq (local.get $msg) (i32.const 0x0202))
      (then
	        (if (local.get $state)
	          (then
	            (local.set $state_w (call $g2w (local.get $state)))
	            (store.field.memarg EditState flags (local.get $state_w)
	              (i32.and (load.field.memarg EditState flags (local.get $state_w)) (i32.const 0xFFFFFFEF)))))
	        (if (i32.eq (global.get $sb_pressed_hwnd) (local.get $hwnd))
	          (then
	            (global.set $sb_pressed_hwnd (i32.const 0))
	            (global.set $sb_pressed_part (i32.const 0))
	            (call $invalidate_hwnd (local.get $hwnd))))
	        ;; Release capture grabbed on WM_LBUTTONDOWN.
        (if (i32.eq (global.get $capture_hwnd) (local.get $hwnd))
          (then (global.set $capture_hwnd (i32.const 0))))
        (return (i32.const 0))))

    ;; ---------- WM_PAINT (0x000F) ----------
    (if (i32.eq (local.get $msg) (i32.const 0x000F))
      (then
        (if (i32.eqz (local.get $state)) (then (return (i32.const 0))))
        (local.set $state_w (call $g2w (local.get $state)))
        ;; Native EDIT painting has the same publication boundary as
        ;; BeginPaint/EndPaint. In Worker mode a slice may end after the white
        ;; fill and before TextOut; keep those pixels private until this whole
        ;; control paint is complete.
        (call $host_paint_begin (local.get $hwnd))
        ;; Paint commits a text object by asking its EDIT to render into the
        ;; picture memory DC via SendMessage(WM_PAINT, hdc, 0). Honor that
        ;; Win9x control convention; ordinary paints still use the window DC.
        (local.set $hdc
          (select (local.get $wParam)
                  (i32.add (local.get $hwnd) (i32.const 0x40000))
                  (i32.ne (local.get $wParam) (i32.const 0))))
        ;; Native control paints don't call BeginPaint, so establish the
        ;; child-client clip explicitly before drawing wrapped/scrolling text.
        ;; Preserve an explicitly supplied DC's clip and viewport: its caller
        ;; owns both and may have translated them into a backing bitmap.
        (if (i32.eqz (local.get $wParam))
          (then
            (drop (call $host_gdi_select_clip_rgn (local.get $hdc) (i32.const 0)))
            (call $dc_apply_client_clip (local.get $hdc) (local.get $hwnd))))
        ;; ctrl_get_wh_packed reads CONTROL_GEOM (works for WAT-only children
        ;; that have no JS-side window record).
        (local.set $sz (call $ctrl_get_wh_packed (local.get $hwnd)))
        (local.set $w (i32.and (local.get $sz) (i32.const 0xFFFF)))
        (local.set $h (i32.shr_u (local.get $sz) (i32.const 16)))
        (local.set $full_w (local.get $w))
        (local.set $full_h (local.get $h))
        ;; Reserve the right strip for multiline edits created with WS_VSCROLL.
        (if (i32.and (call $wnd_get_style (local.get $hwnd)) (i32.const 0x00200000))
          (then
            (if (i32.gt_u (local.get $w) (i32.const 16))
              (then (local.set $w (i32.sub (local.get $w) (i32.const 16)))))))
        ;; And the bottom strip for WS_HSCROLL. Without this the last row of
        ;; text and its caret are drawn underneath the horizontal scrollbar,
        ;; which only became visible once the caret could reach the last row.
        ;; A wrapped edit keeps the full height: it draws no horizontal strip,
        ;; so reserving one leaves a band nothing in this paint ever covers.
        (if (call $edit_hscroll_reserved (local.get $hwnd))
          (then
            (if (i32.gt_u (local.get $h) (i32.const 16))
              (then (local.set $h (i32.sub (local.get $h) (i32.const 16)))))))
        ;; Text origin: the 4px left margin, moved left by the horizontal
        ;; scroll offset. A wrapped edit has nothing to scroll horizontally
        ;; over, so its offset is forced home rather than left stale from
        ;; before the app turned word wrap on.
        (if (call $edit_wraps (local.get $hwnd))
          (then (store.field.memarg EditState scroll_x (local.get $state_w) (i32.const 0))))
        (local.set $tx (i32.sub (i32.const 4)
          (load.field.memarg EditState scroll_x (local.get $state_w))))
        ;; Use the font installed with WM_SETFONT, falling back to the default
        ;; GUI font. Paint relies on this when committing its text object into
        ;; the picture memory DC.
        (drop (call $host_gdi_select_object
          (local.get $hdc)
          (select
            (load.field.memarg EditState font (local.get $state_w))
            (i32.const 0x30021)
            (i32.ne (load.field.memarg EditState font (local.get $state_w)) (i32.const 0)))))
        (drop (call $host_gdi_set_bk_mode (local.get $hdc) (i32.const 1)))
        ;; 1) White background (WHITE_BRUSH stock obj 0 = 0x30010)
        (drop (call $host_gdi_fill_rect (local.get $hdc)
                (i32.const 0) (i32.const 0) (local.get $w) (local.get $h)
                (i32.const 0x30010)))
        ;; 2) Sunken edge: BDR_SUNKENOUTER(0x02)|BDR_SUNKENINNER(0x08) = 0x0A; BF_RECT = 0x0F
        (if (i32.eqz (local.get $wParam))
          (then
            (drop (call $host_gdi_draw_edge (local.get $hdc)
                    (i32.const 0) (i32.const 0) (local.get $w) (local.get $h)
                    (i32.const 0x0A) (i32.const 0x0F)))))
        ;; 3) Text — draw line by line, splitting on \n. Each line is split
        ;; into up to three segments (pre-sel / sel / post-sel) so selected
        ;; text renders white-on-blue while unselected text stays black.
        (local.set $buf (load.field EditState text_buf_ptr (local.get $state_w)))
        (local.set $text_len (load.field.memarg EditState text_len (local.get $state_w)))
        (local.set $sel_lo (call $edit_sel_lo (local.get $state_w)))
        (local.set $sel_hi (call $edit_sel_hi (local.get $state_w)))
        ;; Multiline edits with a vertical scrollbar and no ES_AUTOHSCROLL
        ;; behave like RichEdit license viewers: word-wrap text inside the
        ;; client rect.
        (if (i32.and
              (i32.ne (local.get $buf) (i32.const 0))
              (call $edit_wraps (local.get $hwnd)))
          (then
            (local.set $total_lines
              (call $edit_layout_build
                (local.get $state_w) (local.get $hdc) (local.get $w)))
            (local.set $visible_lines (i32.div_u
              (select (i32.sub (local.get $h) (i32.const 8)) (i32.const 1)
                      (i32.gt_u (local.get $h) (i32.const 8)))
              (i32.const 16)))
            (if (i32.eqz (local.get $visible_lines))
              (then (local.set $visible_lines (i32.const 1))))
            (local.set $max_scroll (i32.sub (local.get $total_lines) (local.get $visible_lines)))
            (if (i32.lt_s (local.get $max_scroll) (i32.const 0))
              (then (local.set $max_scroll (i32.const 0))))
            (if (i32.gt_s (load.field.memarg EditState scroll_top (local.get $state_w)) (local.get $max_scroll))
              (then (store.field.memarg EditState scroll_top (local.get $state_w) (local.get $max_scroll))))
            (local.set $lo (load.field.memarg EditState scroll_top (local.get $state_w)))
            (local.set $line_y (i32.const 4))
            (block $wrapped_done (loop $wrapped_loop
              (br_if $wrapped_done (i32.ge_u (local.get $lo) (local.get $total_lines)))
              (br_if $wrapped_done (i32.ge_s (local.get $line_y) (local.get $h)))
              (local.set $line_buf_w (call $edit_layout_start (local.get $lo)))
              (local.set $hi (call $edit_layout_len (local.get $lo)))
              (local.set $line_end (i32.add (local.get $line_buf_w) (local.get $hi)))
              (local.set $a (i32.const 0))
              (local.set $b (i32.const 0))
              (if (i32.and (i32.lt_u (local.get $sel_lo) (local.get $sel_hi))
                           (i32.and (i32.le_u (local.get $sel_lo) (local.get $line_end))
                                    (i32.ge_u (local.get $sel_hi) (local.get $line_buf_w))))
                (then
                  (local.set $a (local.get $sel_lo))
                  (if (i32.lt_u (local.get $a) (local.get $line_buf_w))
                    (then (local.set $a (local.get $line_buf_w))))
                  (local.set $a (i32.sub (local.get $a) (local.get $line_buf_w)))
                  (local.set $b (local.get $sel_hi))
                  (if (i32.gt_u (local.get $b) (local.get $line_end))
                    (then (local.set $b (local.get $line_end))))
                  (local.set $b (i32.sub (local.get $b) (local.get $line_buf_w)))))
              (local.set $line_buf_w (i32.add (call $g2w (local.get $buf)) (local.get $line_buf_w)))
              (if (i32.lt_u (local.get $a) (local.get $b))
                (then
                  (local.set $pre_w (i32.const 0))
                  (if (local.get $a)
                    (then (local.set $pre_w
                      (call $host_measure_text (local.get $hdc) (local.get $line_buf_w)
                        (local.get $a) (i32.const 0)))))
                  (local.set $sel_w (i32.sub
                    (call $host_measure_text (local.get $hdc) (local.get $line_buf_w)
                      (local.get $b) (i32.const 0))
                    (local.get $pre_w)))
                  (if (i32.eqz (local.get $sel_w))
                    (then (local.set $sel_w (i32.mul (i32.sub (local.get $b) (local.get $a)) (i32.const 8)))))
                  (local.set $brush (call $host_gdi_create_solid_brush (i32.const 0x00800000)))
                  (drop (call $host_gdi_fill_rect (local.get $hdc)
                          (i32.add (local.get $pre_w) (i32.const 4))
                          (i32.sub (local.get $line_y) (i32.const 2))
                          (i32.add (i32.add (local.get $pre_w) (local.get $sel_w)) (i32.const 4))
                          (i32.add (local.get $line_y) (i32.const 13))
                          (local.get $brush)))
                  (drop (call $host_gdi_delete_object (local.get $brush)))
                  (if (local.get $a)
                    (then (drop (call $host_gdi_text_out
                      (local.get $hdc) (i32.const 4) (local.get $line_y)
                      (local.get $line_buf_w) (local.get $a) (i32.const 0)))))
                  (drop (call $host_gdi_set_text_color (local.get $hdc) (i32.const 0x00FFFFFF)))
                  (drop (call $host_gdi_text_out
                    (local.get $hdc) (i32.add (local.get $pre_w) (i32.const 4)) (local.get $line_y)
                    (i32.add (local.get $line_buf_w) (local.get $a))
                    (i32.sub (local.get $b) (local.get $a)) (i32.const 0)))
                  (drop (call $host_gdi_set_text_color (local.get $hdc) (i32.const 0x00000000)))
                  (if (i32.lt_u (local.get $b) (local.get $hi))
                    (then (drop (call $host_gdi_text_out
                      (local.get $hdc)
                      (i32.add (i32.add (local.get $pre_w) (local.get $sel_w)) (i32.const 4))
                      (local.get $line_y)
                      (i32.add (local.get $line_buf_w) (local.get $b))
                      (i32.sub (local.get $hi) (local.get $b)) (i32.const 0))))))
                (else
                  (if (local.get $hi)
                    (then (drop (call $host_gdi_text_out
                      (local.get $hdc) (i32.const 4) (local.get $line_y)
                      (local.get $line_buf_w) (local.get $hi) (i32.const 0)))))))
              (local.set $lo (i32.add (local.get $lo) (i32.const 1)))
              (local.set $line_y (i32.add (local.get $line_y) (i32.const 16)))
              (br $wrapped_loop)))

            (local.set $flags (load.field.memarg EditState flags (local.get $state_w)))
            (if (i32.eq
                  (i32.and (local.get $flags) (i32.const 0x28))
                  (i32.const 0x28))
              (then
                (local.set $cur (load.field.memarg EditState cursor (local.get $state_w)))
                (local.set $lo (call $edit_layout_line_for_char (local.get $total_lines) (local.get $cur)))
                (local.set $a (i32.sub (local.get $lo) (load.field.memarg EditState scroll_top (local.get $state_w))))
                (local.set $hi (i32.mul (local.get $a) (i32.const 16)))
                (local.set $px (i32.const 0))
                (local.set $line_end (call $edit_layout_start (local.get $lo)))
                (if (i32.gt_u (local.get $cur) (local.get $line_end))
                  (then
                    (local.set $px (call $host_measure_text
                      (local.get $hdc)
                      (i32.add (call $g2w (local.get $buf)) (local.get $line_end))
                      (i32.sub (local.get $cur) (local.get $line_end))
                      (i32.const 0)))))
                (if (i32.and (i32.eqz (local.get $px)) (i32.gt_u (local.get $cur) (local.get $line_end)))
                  (then
                    (local.set $px
                      (i32.mul (i32.sub (local.get $cur) (local.get $line_end)) (i32.const 8)))))
                (if (i32.and
                      (i32.ge_s (local.get $a) (i32.const 0))
                      (i32.lt_s (local.get $hi) (local.get $h)))
                  (then
                    (drop (call $host_gdi_fill_rect (local.get $hdc)
                            (i32.add (local.get $px) (i32.const 4))
                            (i32.add (local.get $hi) (i32.const 2))
                            (i32.add (local.get $px) (i32.const 6))
                            (i32.add (local.get $hi) (i32.const 17))
                            (i32.const 0x30014)))))))
            (if (i32.and (call $wnd_get_style (local.get $hwnd)) (i32.const 0x00200000))
              (then
                (call $defwndproc_paint_standard_scrollbar (local.get $hdc)
                  (i32.sub (local.get $full_w) (i32.const 16)) (i32.const 0)
                  (i32.const 16) (local.get $h) (i32.const 1)
                  (load.field.memarg EditState scroll_top (local.get $state_w))
                  (i32.const 0) (i32.sub (local.get $total_lines) (i32.const 1))
                  (local.get $visible_lines)
                  (select (global.get $sb_pressed_part) (i32.const 0)
                          (i32.eq (global.get $sb_pressed_hwnd) (local.get $hwnd)))
                  (call $scroll_arrow_mask (local.get $hwnd) (i32.const 1)))))
            ;; Refresh non-client chrome after the edit reaches its final
            ;; size. Notepad does not send another WM_NCPAINT after sizing its
            ;; child, and client clipping intentionally excludes these strips.
            (if (i32.and
                  (i32.eqz (local.get $wParam))
                  (i32.ne
                    (i32.and (call $wnd_get_style (local.get $hwnd)) (i32.const 0x00300000))
                    (i32.const 0)))
              (then (call $defwndproc_do_ncpaint (local.get $hwnd))))
            (call $host_paint_end (local.get $hwnd))
            (return (i32.const 0))))
        (if (local.get $buf)
          (then
            ;; Start at the scroll_top line (multi-line scroll). scroll_top is
            ;; 0 for single-line and by default for multi-line.
            (local.set $lo (call $edit_line_index (local.get $state_w)
                             (load.field.memarg EditState scroll_top (local.get $state_w))))
            (local.set $line_y (i32.const 4))
            (block $lines_done (loop $line_loop
              (br_if $lines_done (i32.gt_u (local.get $lo) (local.get $text_len)))
              (local.set $hi (call $edit_line_len (local.get $state_w) (local.get $lo)))
              (local.set $line_end (i32.add (local.get $lo) (local.get $hi)))
              (local.set $line_buf_w (i32.add (call $g2w (local.get $buf)) (local.get $lo)))
              ;; Selection intersection within this line (relative to line start).
              (local.set $a (i32.const 0))
              (local.set $b (i32.const 0))
              (if (i32.and (i32.lt_u (local.get $sel_lo) (local.get $sel_hi))
                           (i32.and (i32.le_u (local.get $sel_lo) (local.get $line_end))
                                    (i32.ge_u (local.get $sel_hi) (local.get $lo))))
                (then
                  (local.set $a (local.get $sel_lo))
                  (if (i32.lt_u (local.get $a) (local.get $lo)) (then (local.set $a (local.get $lo))))
                  (local.set $a (i32.sub (local.get $a) (local.get $lo)))
                  (local.set $b (local.get $sel_hi))
                  (if (i32.gt_u (local.get $b) (local.get $line_end)) (then (local.set $b (local.get $line_end))))
                  (local.set $b (i32.sub (local.get $b) (local.get $lo)))))
              (if (i32.lt_u (local.get $a) (local.get $b))
                (then
                  ;; Highlight rect: measure widths up to $a and up to $b.
                  (local.set $pre_w (i32.const 0))
                  (if (local.get $a)
                    (then (local.set $pre_w (call $host_measure_text
                            (local.get $hdc) (local.get $line_buf_w)
                            (local.get $a) (i32.const 0)))))
                  (local.set $sel_w (i32.sub
                    (call $host_measure_text (local.get $hdc) (local.get $line_buf_w)
                      (local.get $b) (i32.const 0))
                    (local.get $pre_w)))
                  ;; If sel extends past the \n (to the next line), pad to right edge.
                  (if (i32.gt_u (local.get $sel_hi) (local.get $line_end))
                    (then (local.set $sel_w (i32.sub (local.get $w)
                            (i32.add (local.get $pre_w) (local.get $tx))))))
                  (local.set $brush (call $host_gdi_create_solid_brush (i32.const 0x00800000)))
	                  (drop (call $host_gdi_fill_rect (local.get $hdc)
	                          (i32.add (local.get $pre_w) (local.get $tx))
	                          (i32.sub (local.get $line_y) (i32.const 2))
	                          (i32.add (i32.add (local.get $pre_w) (local.get $sel_w)) (local.get $tx))
	                          (i32.add (local.get $line_y) (i32.const 13))
	                          (local.get $brush)))
                  (drop (call $host_gdi_delete_object (local.get $brush)))
                  ;; pre-sel text (black)
                  (if (local.get $a)
                    (then (drop (call $host_gdi_text_out (local.get $hdc)
                                  (local.get $tx) (local.get $line_y)
                                  (local.get $line_buf_w) (local.get $a) (i32.const 0)))))
                  ;; selected text (white)
                  (drop (call $host_gdi_set_text_color (local.get $hdc) (i32.const 0x00FFFFFF)))
                  (drop (call $host_gdi_text_out (local.get $hdc)
                          (i32.add (local.get $pre_w) (local.get $tx)) (local.get $line_y)
                          (i32.add (local.get $line_buf_w) (local.get $a))
                          (i32.sub (local.get $b) (local.get $a)) (i32.const 0)))
                  (drop (call $host_gdi_set_text_color (local.get $hdc) (i32.const 0x00000000)))
                  ;; post-sel text (black)
                  (if (i32.lt_u (local.get $b) (local.get $hi))
                    (then (drop (call $host_gdi_text_out (local.get $hdc)
                                  (i32.add (i32.add (local.get $pre_w) (local.get $sel_w)) (local.get $tx))
                                  (local.get $line_y)
                                  (i32.add (local.get $line_buf_w) (local.get $b))
                                  (i32.sub (local.get $hi) (local.get $b)) (i32.const 0))))))
                (else
                  (if (local.get $hi)
                    (then (drop (call $host_gdi_text_out (local.get $hdc)
                                  (local.get $tx) (local.get $line_y)
                                  (local.get $line_buf_w) (local.get $hi) (i32.const 0)))))))
              (local.set $lo (i32.add (local.get $line_end) (i32.const 1)))
              (local.set $line_y (i32.add (local.get $line_y) (i32.const 16)))
              (br $line_loop)))))
        ;; 4) Caret position (only if focused — bit 3 of flags). This is
        ;; SetCaretPos, not a draw: the compositor paints and blinks the USER
        ;; caret, exactly as USER does for a real EDIT. Drawing it here as well
        ;; would put two carets in the control, on two blink clocks.
        (local.set $flags (load.field.memarg EditState flags (local.get $state_w)))
        (if (i32.eq
              (i32.and (local.get $flags) (i32.const 0x08))
              (i32.const 0x08))
          (then
            (local.set $cur (load.field.memarg EditState cursor (local.get $state_w)))
            ;; Find which line the cursor is on and the offset within that line.
            ;; Subtract scroll_top so the caret tracks the visible viewport.
            (local.set $lo (call $edit_line_start (local.get $state_w) (local.get $cur)))
            (local.set $a (i32.sub
                            (call $edit_line_from_char (local.get $state_w) (local.get $cur))
                            (load.field.memarg EditState scroll_top (local.get $state_w))))
            (local.set $hi (i32.mul (local.get $a) (i32.const 16)))
            (local.set $px (i32.const 0))
            (if (i32.and (i32.ne (local.get $buf) (i32.const 0)) (i32.gt_u (local.get $cur) (local.get $lo)))
              (then (local.set $px (call $host_measure_text (local.get $hdc)
                                        (i32.add (call $g2w (local.get $buf)) (local.get $lo))
                                        (i32.sub (local.get $cur) (local.get $lo))
                                        (i32.const 0)))))
            (if (i32.and (i32.eqz (local.get $px)) (i32.gt_u (local.get $cur) (local.get $lo)))
              (then (local.set $px
                (i32.mul (i32.sub (local.get $cur) (local.get $lo)) (i32.const 8)))))
            (if (i32.and
                  (i32.ge_s (local.get $a) (i32.const 0))
                  (i32.const 1))
              (then
            (global.set $caret_hwnd (local.get $hwnd))
            (global.set $caret_x (i32.add (local.get $px) (local.get $tx)))
            (global.set $caret_y (i32.add (local.get $hi) (i32.const 2)))
            (global.set $caret_w (i32.const 2))
            (global.set $caret_h (i32.const 15))
            (global.set $caret_visible (i32.const 1))))))
        ;; 5) Optional vertical scrollbar strip. Scrolling state is line-based.
        (if (i32.and (call $wnd_get_style (local.get $hwnd)) (i32.const 0x00200000))
          (then
            (local.set $total_lines
              (i32.add (call $edit_line_from_char (local.get $state_w) (local.get $text_len))
                       (i32.const 1)))
            (local.set $visible_lines (i32.div_u
              (select (i32.sub (local.get $h) (i32.const 8)) (i32.const 1)
                      (i32.gt_u (local.get $h) (i32.const 8)))
              (i32.const 16)))
            (if (i32.eqz (local.get $visible_lines))
              (then (local.set $visible_lines (i32.const 1))))
            (local.set $max_scroll (i32.sub (local.get $total_lines) (local.get $visible_lines)))
            (if (i32.lt_s (local.get $max_scroll) (i32.const 0))
              (then (local.set $max_scroll (i32.const 0))))
            ;; Through the SCROLLINFO painter, which is the same page model
            ;; $sb_page_hit_part and $sb_page_drag_pos classify clicks with.
            ;; Painting it with the older range model instead sized and placed
            ;; the thumb differently from the geometry the drag code assumed,
            ;; so dragging the thumb moved the text further than the pointer.
            (call $defwndproc_paint_standard_scrollbar (local.get $hdc)
              (i32.sub (local.get $full_w) (i32.const 16)) (i32.const 0)
              (i32.const 16) (local.get $h) (i32.const 1)
              (load.field.memarg EditState scroll_top (local.get $state_w))
              (i32.const 0) (i32.sub (local.get $total_lines) (i32.const 1))
              (local.get $visible_lines)
              (select (global.get $sb_pressed_part) (i32.const 0)
                      (i32.eq (global.get $sb_pressed_hwnd) (local.get $hwnd)))
              (call $scroll_arrow_mask (local.get $hwnd) (i32.const 1)))))
        ;; 6) Optional horizontal scrollbar strip. Scrolling state is in
        ;; pixels, since an unwrapped line is measured, not counted. Same
        ;; predicate the prologue reserved the band with, so the strip is
        ;; drawn exactly when the room for it was taken.
        (if (call $edit_hscroll_reserved (local.get $hwnd))
          (then
            (local.set $max_hscroll (call $edit_max_hscroll
              (local.get $state_w) (local.get $hdc) (local.get $w)))
            ;; Text shrinking (or the window growing) can leave the stored
            ;; offset past the new end of the document.
            (drop (call $edit_hscroll_to (local.get $state_w)
              (load.field.memarg EditState scroll_x (local.get $state_w)) (local.get $max_hscroll)))
            ;; Same page model as the vertical strip, with pixels for units:
            ;; the document is max_hscroll + one visible width wide, and the
            ;; page is that visible width.
            (call $defwndproc_paint_standard_scrollbar (local.get $hdc)
              (i32.const 0) (i32.sub (local.get $full_h) (i32.const 16))
              (local.get $w) (i32.const 16) (i32.const 0)
              (load.field.memarg EditState scroll_x (local.get $state_w))
              (i32.const 0)
              (i32.sub (i32.add (local.get $max_hscroll) (local.get $w)) (i32.const 1))
              (local.get $w)
              (select (global.get $sb_pressed_part) (i32.const 0)
                      (i32.eq (global.get $sb_pressed_hwnd) (local.get $hwnd)))
              (call $scroll_arrow_mask (local.get $hwnd) (i32.const 0)))
            ;; The dead square where the two strips meet is scrollbar-grey,
            ;; not white: it belongs to neither track.
            (if (i32.and (call $wnd_get_style (local.get $hwnd)) (i32.const 0x00200000))
              (then (drop (call $host_gdi_fill_rect (local.get $hdc)
                (i32.sub (local.get $full_w) (i32.const 16))
                (i32.sub (local.get $full_h) (i32.const 16))
                (local.get $full_w) (local.get $full_h)
                (i32.const 0x30011)))))))
        (if (i32.and
              (i32.eqz (local.get $wParam))
              (i32.ne
                (i32.and (call $wnd_get_style (local.get $hwnd)) (i32.const 0x00300000))
                (i32.const 0)))
          (then (call $defwndproc_do_ncpaint (local.get $hwnd))))
        (call $host_paint_end (local.get $hwnd))
        (return (i32.const 0))))

    ;; ---------- EM_SETLIMITTEXT / EM_LIMITTEXT (0x00C5) ----------
    ;; wParam = max chars (0 → unlimited; semantics differ across versions —
    ;; we treat 0 as unlimited as the Win9x docs state). No return value.
    (if (i32.eq (local.get $msg) (i32.const 0x00C5))
      (then
        (if (i32.eqz (local.get $state)) (then (return (i32.const 0))))
        (local.set $text_len (local.get $wParam))
        ;; For both RichEdit generations, zero selects the documented 64,000
        ;; compatibility limit. Plain EDIT retains the emulator's unlimited
        ;; zero sentinel.
        (if (i32.and
              (i32.eqz (local.get $text_len))
              (i32.or
                (i32.eq (call $ctrl_table_get_class (local.get $hwnd)) (i32.const 24))
                (i32.eq (call $ctrl_table_get_class (local.get $hwnd)) (i32.const 25))))
          (then (local.set $text_len (i32.const 64000))))
        (store.field.memarg EditState max_length (call $g2w (local.get $state)) (local.get $text_len))
        (return (i32.const 0))))

    ;; ---------- EM_GETLIMITTEXT (0x00D5) ----------
    (if (i32.eq (local.get $msg) (i32.const 0x00D5))
      (then
        (if (i32.eqz (local.get $state)) (then (return (i32.const 0))))
        (return (load.field.memarg EditState max_length (call $g2w (local.get $state))))))

    ;; ---------- RichEdit 2.0+ extended range/limit messages ----------
    ;; RichEdit 1.0 intentionally leaves these unsupported and continues to
    ;; expose EM_GETSEL/EM_SETSEL/EM_LIMITTEXT, which are shared with EDIT.
    (if (i32.and
          (i32.eq (call $ctrl_table_get_class (local.get $hwnd)) (i32.const 25))
          (i32.eq (local.get $msg) (i32.const 0x0434))) ;; EM_EXGETSEL
      (then
        (if (i32.or (i32.eqz (local.get $state)) (i32.eqz (local.get $lParam)))
          (then (return (i32.const 0))))
        (local.set $state_w (call $g2w (local.get $state)))
        (call $gs32 (local.get $lParam) (call $edit_sel_lo (local.get $state_w)))
        (call $gs32 (i32.add (local.get $lParam) (i32.const 4))
          (call $edit_sel_hi (local.get $state_w)))
        (return (i32.const 0))))

    (if (i32.and
          (i32.eq (call $ctrl_table_get_class (local.get $hwnd)) (i32.const 25))
          (i32.eq (local.get $msg) (i32.const 0x0435))) ;; EM_EXLIMITTEXT
      (then
        (if (i32.eqz (local.get $state)) (then (return (i32.const 0))))
        (local.set $text_len (local.get $lParam))
        (if (i32.eqz (local.get $text_len))
          (then (local.set $text_len (i32.const 64000))))
        (store.field.memarg EditState max_length (call $g2w (local.get $state)) (local.get $text_len))
        (return (i32.const 0))))

    (if (i32.and
          (i32.eq (call $ctrl_table_get_class (local.get $hwnd)) (i32.const 25))
          (i32.eq (local.get $msg) (i32.const 0x0437))) ;; EM_EXSETSEL
      (then
        (if (i32.or (i32.eqz (local.get $state)) (i32.eqz (local.get $lParam)))
          (then (return (i32.const 0))))
        (local.set $state_w (call $g2w (local.get $state)))
        (local.set $text_len (load.field.memarg EditState text_len (local.get $state_w)))
        (local.set $lo (call $gl32 (local.get $lParam)))
        (local.set $hi (call $gl32 (i32.add (local.get $lParam) (i32.const 4))))
        (if (i32.eq (local.get $lo) (i32.const -1))
          (then (local.set $lo (local.get $text_len))))
        (if (i32.eq (local.get $hi) (i32.const -1))
          (then (local.set $hi (local.get $text_len))))
        (if (i32.gt_u (local.get $lo) (local.get $text_len))
          (then (local.set $lo (local.get $text_len))))
        (if (i32.gt_u (local.get $hi) (local.get $text_len))
          (then (local.set $hi (local.get $text_len))))
        (store.field.memarg EditState sel_anchor (local.get $state_w) (local.get $lo))
        (store.field.memarg EditState cursor (local.get $state_w) (local.get $hi))
        (call $invalidate_hwnd (local.get $hwnd))
        (return (local.get $hi))))

    ;; ---------- EM_GETSEL (0x00B0) ----------
    (if (i32.eq (local.get $msg) (i32.const 0x00B0))
      (then
        (if (i32.eqz (local.get $state)) (then (return (i32.const 0))))
        (local.set $state_w (call $g2w (local.get $state)))
        (local.set $lo (call $edit_sel_lo (local.get $state_w)))
        (local.set $hi (call $edit_sel_hi (local.get $state_w)))
        (if (local.get $wParam)
          (then (call $gs32 (local.get $wParam) (local.get $lo))))
        (if (local.get $lParam)
          (then (call $gs32 (local.get $lParam) (local.get $hi))))
        (return (i32.or (i32.and (local.get $lo) (i32.const 0xFFFF))
                        (i32.shl (local.get $hi) (i32.const 16))))))

    ;; ---------- WM_COPY (0x0301) ----------
    (if (i32.eq (local.get $msg) (i32.const 0x0301))
      (then
        (if (i32.eqz (local.get $state)) (then (return (i32.const 0))))
        (local.set $state_w (call $g2w (local.get $state)))
        (call $edit_copy_range (local.get $state_w)
          (call $edit_sel_lo (local.get $state_w))
          (call $edit_sel_hi (local.get $state_w)))
        (return (i32.const 0))))

    ;; ---------- WM_CUT (0x0300) ----------
    (if (i32.eq (local.get $msg) (i32.const 0x0300))
      (then
        (if (i32.eqz (local.get $state)) (then (return (i32.const 0))))
        (local.set $state_w (call $g2w (local.get $state)))
        (local.set $lo (call $edit_sel_lo (local.get $state_w)))
        (local.set $hi (call $edit_sel_hi (local.get $state_w)))
        (call $edit_copy_range (local.get $state_w) (local.get $lo) (local.get $hi))
        (if (i32.eqz (i32.and (load.field.memarg EditState flags (local.get $state_w)) (i32.const 0x04)))
          (then
            (call $edit_delete_range (local.get $state_w) (local.get $lo) (local.get $hi))
            (call $edit_notify_change (local.get $hwnd))
            (call $invalidate_hwnd (local.get $hwnd))))
        (return (i32.const 0))))

    ;; ---------- WM_PASTE (0x0302) ----------
    (if (i32.eq (local.get $msg) (i32.const 0x0302))
      (then
        (if (i32.eqz (local.get $state)) (then (return (i32.const 0))))
        (local.set $state_w (call $g2w (local.get $state)))
        (if (i32.and (load.field.memarg EditState flags (local.get $state_w)) (i32.const 0x04))
          (then (return (i32.const 0))))
        (if (global.get $clipboard_len)
          (then (call $edit_insert_bytes (local.get $state_w)
                  (global.get $clipboard_ptr) (global.get $clipboard_len))
                (call $edit_notify_change (local.get $hwnd))))
        (call $invalidate_hwnd (local.get $hwnd))
        (return (i32.const 0))))

    ;; ---------- WM_CLEAR (0x0303) — delete selection without copying ----------
    (if (i32.eq (local.get $msg) (i32.const 0x0303))
      (then
        (if (i32.eqz (local.get $state)) (then (return (i32.const 0))))
        (local.set $state_w (call $g2w (local.get $state)))
        (if (i32.and (load.field.memarg EditState flags (local.get $state_w)) (i32.const 0x04))
          (then (return (i32.const 0))))
        (local.set $lo (call $edit_sel_lo (local.get $state_w)))
        (local.set $hi (call $edit_sel_hi (local.get $state_w)))
        (if (i32.ne (local.get $lo) (local.get $hi))
          (then
            (call $edit_delete_range (local.get $state_w) (local.get $lo) (local.get $hi))
            (call $edit_notify_change (local.get $hwnd))
            (call $invalidate_hwnd (local.get $hwnd))))
        (return (i32.const 0))))

    ;; ---------- EM_SETSEL (0x00B1) ----------
    (if (i32.eq (local.get $msg) (i32.const 0x00B1))
      (then
        (if (i32.eqz (local.get $state)) (then (return (i32.const 0))))
        (local.set $state_w (call $g2w (local.get $state)))
        (local.set $text_len (load.field.memarg EditState text_len (local.get $state_w)))
        ;; wParam = start, lParam = end (-1 = end of text)
        (local.set $lo (local.get $wParam))
        (local.set $hi (local.get $lParam))
        ;; EM_SETSEL(-1, 0) removes the current selection. Paint uses this
        ;; immediately before rendering the edit into its backing bitmap.
        (if (i32.eq (local.get $lo) (i32.const -1))
          (then
            (store.field.memarg EditState sel_anchor (local.get $state_w) (local.get $text_len))
            (store.field.memarg EditState cursor (local.get $state_w) (local.get $text_len))
            (call $invalidate_hwnd (local.get $hwnd))
            (return (i32.const 0))))
        (if (i32.eq (local.get $hi) (i32.const -1))
          (then (local.set $hi (local.get $text_len))))
        (if (i32.gt_u (local.get $lo) (local.get $text_len))
          (then (local.set $lo (local.get $text_len))))
        (if (i32.gt_u (local.get $hi) (local.get $text_len))
          (then (local.set $hi (local.get $text_len))))
        (store.field.memarg EditState sel_anchor (local.get $state_w) (local.get $lo))  ;; sel_anchor = start
        (store.field.memarg EditState cursor (local.get $state_w) (local.get $hi))  ;; cursor = end
        (call $invalidate_hwnd (local.get $hwnd))
        (return (i32.const 0))))

    ;; ---------- EM_REPLACESEL (0x00C2) ----------
    (if (i32.eq (local.get $msg) (i32.const 0x00C2))
      (then
        (if (i32.eqz (local.get $state)) (then (return (i32.const 0))))
        (local.set $state_w (call $g2w (local.get $state)))
        ;; Delete current selection
        (local.set $lo (call $edit_sel_lo (local.get $state_w)))
        (local.set $hi (call $edit_sel_hi (local.get $state_w)))
        (if (i32.ne (local.get $lo) (local.get $hi))
          (then (call $edit_delete_range (local.get $state_w) (local.get $lo) (local.get $hi))))
        ;; Insert replacement text char by char
        (if (local.get $lParam)
          (then
            (local.set $buf (call $g2w (local.get $lParam)))
            (block $done (loop $ins
              (local.set $vk (i32.load8_u (local.get $buf)))
              (br_if $done (i32.eqz (local.get $vk)))
              (call $edit_insert_char (local.get $state_w) (local.get $vk))
              (local.set $buf (i32.add (local.get $buf) (i32.const 1)))
              (br $ins)))))
        (store.field.memarg EditState flags (local.get $state_w)
          (i32.or (load.field.memarg EditState flags (local.get $state_w)) (i32.const 0x08)))
        (call $edit_reset_caret_timer (local.get $hwnd) (local.get $state_w))
        (call $edit_notify_change (local.get $hwnd))
        (call $invalidate_hwnd (local.get $hwnd))
        (return (i32.const 0))))

    ;; ---------- EM_LINEFROMCHAR (0x00C9) ----------
    ;; wParam = char index (-1 = cursor). Returns 0-based line number.
    (if (i32.eq (local.get $msg) (i32.const 0x00C9))
      (then
        (if (i32.eqz (local.get $state)) (then (return (i32.const 0))))
        (local.set $state_w (call $g2w (local.get $state)))
        (local.set $cur (local.get $wParam))
        (if (i32.eq (local.get $cur) (i32.const -1))
          (then (local.set $cur (load.field.memarg EditState cursor (local.get $state_w)))))
        (return (call $edit_line_from_char (local.get $state_w) (local.get $cur)))))

    ;; ---------- EM_LINEINDEX (0x00BB) ----------
    ;; wParam = line number (-1 = current line). Returns char index of line start.
    (if (i32.eq (local.get $msg) (i32.const 0x00BB))
      (then
        (if (i32.eqz (local.get $state)) (then (return (i32.const 0))))
        (local.set $state_w (call $g2w (local.get $state)))
        (local.set $lo (local.get $wParam))
        (if (i32.eq (local.get $lo) (i32.const -1))
          (then (local.set $lo (call $edit_line_from_char (local.get $state_w)
                                 (load.field.memarg EditState cursor (local.get $state_w))))))
        (return (call $edit_line_index (local.get $state_w) (local.get $lo)))))

    ;; ---------- EM_GETLINECOUNT (0x00BA) ----------
    ;; Display lines, not paragraphs: on a wrapped multiline edit Windows
    ;; counts every visual row, which is also the unit EM_GETFIRSTVISIBLELINE
    ;; and the scrollbar already speak here. Counting hard breaks instead made
    ;; the two disagree -- Winamp's license viewer reports 24 lines for a text
    ;; its own scrollbar walks past row 80.
    (if (i32.eq (local.get $msg) (i32.const 0x00BA))
      (then
        (if (i32.eqz (local.get $state)) (then (return (i32.const 1))))
        (local.set $state_w (call $g2w (local.get $state)))
        (if (call $edit_wraps (local.get $hwnd))
          (then (return (i32.and
                  (call $edit_view_metrics (local.get $hwnd) (local.get $state_w))
                  (i32.const 0xFFFF)))))
        (return (i32.add (call $edit_line_from_char (local.get $state_w)
                           (load.field.memarg EditState text_len (local.get $state_w)))
                         (i32.const 1)))))

    ;; ---------- EM_LINELENGTH (0x00C1) ----------
    ;; wParam = char index. Returns length of line containing that char.
    (if (i32.eq (local.get $msg) (i32.const 0x00C1))
      (then
        (if (i32.eqz (local.get $state)) (then (return (i32.const 0))))
        (local.set $state_w (call $g2w (local.get $state)))
        (local.set $lo (call $edit_line_start (local.get $state_w) (local.get $wParam)))
        (return (call $edit_line_len (local.get $state_w) (local.get $lo)))))

    ;; ---------- EM_SCROLLCARET (0x00B7) ----------
    ;; The EM_SETSEL + EM_SCROLLCARET pair is how an app (notepad's Find, for
    ;; one) brings a selection into view, so this has to do the scrolling that
    ;; EM_SETSEL deliberately does not.
    (if (i32.eq (local.get $msg) (i32.const 0x00B7))
      (then
        (if (call $edit_scroll_caret_into_view (local.get $hwnd))
          (then (call $invalidate_hwnd (local.get $hwnd))))
        (return (i32.const 0))))

    ;; ---------- EM_GETFIRSTVISIBLELINE (0x00CE) ----------
    (if (i32.eq (local.get $msg) (i32.const 0x00CE))
      (then
        (if (i32.eqz (local.get $state)) (then (return (i32.const 0))))
        (return (load.field.memarg EditState scroll_top (call $g2w (local.get $state))))))

    ;; ---------- WM_MOUSEWHEEL (0x020A) ----------
    ;; wParam hi-word = signed wheel delta (120 per notch, positive = scroll up).
    ;; Only multi-line edits (flags bit 0) scroll; otherwise no-op.
    (if (i32.eq (local.get $msg) (i32.const 0x020A))
      (then
        (if (i32.eqz (local.get $state)) (then (return (i32.const 0))))
        (local.set $state_w (call $g2w (local.get $state)))
        (if (i32.eqz (i32.and (call $wnd_get_style (local.get $hwnd)) (i32.const 0x00000004)))
          (then (return (i32.const 0))))
        ;; lines_delta = -delta_raw / 40  (120/3 = 40 → 3 lines per notch)
        (local.set $vk (i32.div_s
                         (i32.sub (i32.const 0)
                           (i32.shr_s (local.get $wParam) (i32.const 16)))
                         (i32.const 40)))
        ;; Through the shared viewport metrics. This used to be a private copy
        ;; that measured visible lines against the full control height, so on
        ;; an edit with a horizontal strip it believed one more line fitted
        ;; than the painter drew -- and the wheel stopped one line short of the
        ;; end of the document while the thumb still had track left.
        (local.set $a (call $edit_view_metrics (local.get $hwnd) (local.get $state_w)))
        (local.set $b (i32.and (local.get $a) (i32.const 0xFFFF)))      ;; total lines
        (local.set $a (i32.shr_u (local.get $a) (i32.const 16)))        ;; visible lines
        (if (call $edit_scroll_to (local.get $hwnd) (local.get $state_w)
              (i32.add (load.field.memarg EditState scroll_top (local.get $state_w)) (local.get $vk))
              (local.get $b) (local.get $a))
          (then (call $invalidate_hwnd (local.get $hwnd))))
        (return (i32.const 0))))

    ;; Default
    (i32.const 0)
  )

  ;; ---- Multiline edit helpers ----
  ;; Find start of line containing char at $pos. Scans backward for \n.
  (func $edit_line_start (param $state_w ptr<EditState>) (param $pos i32) (result i32)
    (local $buf_w i32) (local $i i32)
    (local.set $buf_w (load.field EditState text_buf_ptr (local.get $state_w)))
    (if (i32.eqz (local.get $buf_w)) (then (return (i32.const 0))))
    (local.set $buf_w (call $g2w (local.get $buf_w)))
    (local.set $i (local.get $pos))
    (block $done (loop $scan
      (br_if $done (i32.le_s (local.get $i) (i32.const 0)))
      (if (i32.eq (i32.load8_u (i32.add (local.get $buf_w) (i32.sub (local.get $i) (i32.const 1))))
                  (i32.const 0x0A))
        (then (return (local.get $i))))
      (local.set $i (i32.sub (local.get $i) (i32.const 1)))
      (br $scan)))
    (i32.const 0))

  ;; Length of line starting at $line_start (chars until \n or end of text).
  (func $edit_line_len (param $state_w ptr<EditState>) (param $line_start i32) (result i32)
    (local $buf_w i32) (local $text_len i32) (local $i i32)
    (local.set $buf_w (load.field EditState text_buf_ptr (local.get $state_w)))
    (if (i32.eqz (local.get $buf_w)) (then (return (i32.const 0))))
    (local.set $buf_w (call $g2w (local.get $buf_w)))
    (local.set $text_len (load.field.memarg EditState text_len (local.get $state_w)))
    (local.set $i (local.get $line_start))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (local.get $text_len)))
      (br_if $done (i32.eq (i32.load8_u (i32.add (local.get $buf_w) (local.get $i)))
                           (i32.const 0x0A)))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (i32.sub (local.get $i) (local.get $line_start)))

  ;; Return 0-based line number containing char at $pos.
  (func $edit_line_from_char (param $state_w ptr<EditState>) (param $pos i32) (result i32)
    (local $buf_w i32) (local $i i32) (local $line i32)
    (local.set $buf_w (load.field EditState text_buf_ptr (local.get $state_w)))
    (if (i32.eqz (local.get $buf_w)) (then (return (i32.const 0))))
    (local.set $buf_w (call $g2w (local.get $buf_w)))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (local.get $pos)))
      (if (i32.eq (i32.load8_u (i32.add (local.get $buf_w) (local.get $i))) (i32.const 0x0A))
        (then (local.set $line (i32.add (local.get $line) (i32.const 1)))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (local.get $line))

  ;; Return char index of the first character on line $line_num (0-based).
  (func $edit_line_index (param $state_w ptr<EditState>) (param $line_num i32) (result i32)
    (local $buf_w i32) (local $text_len i32) (local $i i32) (local $line i32)
    (local.set $buf_w (load.field EditState text_buf_ptr (local.get $state_w)))
    (if (i32.eqz (local.get $buf_w)) (then (return (i32.const 0))))
    (local.set $buf_w (call $g2w (local.get $buf_w)))
    (local.set $text_len (load.field.memarg EditState text_len (local.get $state_w)))
    (if (i32.eqz (local.get $line_num)) (then (return (i32.const 0))))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (local.get $text_len)))
      (if (i32.eq (i32.load8_u (i32.add (local.get $buf_w) (local.get $i))) (i32.const 0x0A))
        (then
          (local.set $line (i32.add (local.get $line) (i32.const 1)))
          (if (i32.eq (local.get $line) (local.get $line_num))
            (then (return (i32.add (local.get $i) (i32.const 1)))))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan)))
    (local.get $text_len))
