# Winamp wVis popup routing

## Binary and guest path

`test/binaries/plugins/candidates/vis_w.dll`, preferred image base
`0x10000000`, SHA-256
`45505bb5e232c5f28b2ef0223ecf2c2103e4800a0c02276c0c6fbf6638bcd7c6`.
Addresses below are original image VAs, not relocated runtime addresses.

The window procedure compares its message with `WM_RBUTTONUP` (0x205) at
`0x10002a9f`, branching at `0x10002aa5` to `0x1000302b`. That arm gets
GWL_USERDATA, reads the instance from offset 8, loads menu resource 101,
gets the cursor position and updates check marks from plugin state.
It calls `GetSubMenu(menu, 0)` at `0x1000321e`, `TrackPopupMenu` at
`0x1000322b`, then `DestroyMenu` at `0x1000322e`.

Relevant USER32 IAT slots:

| Original VA | Import |
| --- | --- |
| 0x1000f2fc | LoadMenuA |
| 0x1000f308 | GetSubMenu |
| 0x1000f30c | GetCursorPos |
| 0x1000f310 | CheckMenuItem |
| 0x1000f318 | TrackPopupMenu |
| 0x1000f31c | DestroyMenu |

Use `tools/pe-imports.js --dll=USER32.DLL`, `tools/find_bytes.js --imm32=0x205`,
and `tools/disasm_fn.js` at the instruction-aligned addresses above. This
is evidence from the shipped guest DLL, not Wine source.

## Browser experiment, 2026-09-21

The existing `test/test-winamp-visualization-web.js` regression passes after
`a72cd571`: Preferences → wVis → Start/Stop/Start → playback → right-click →
Rendering Options hover. Baseline log:
`/private/tmp/wa-wvis-menu-baseline.log` (terminal exit 0).

Disabling only `_openWorkerContextMenu` in the isolated browser test copy
still opens the guest popup and exposes Rendering Options, but the old
fixed hover at y=228 fails the submenu assertion. Log:
`/private/tmp/wa-wvis-menu-no-helper.log` (terminal exit 1). The screenshot
shows a different popup anchor; do not interpret this as failure to deliver
WM_RBUTTONUP or failure to create the popup.

Follow-ups at y=257 still fail (terminal exit 1):
`/private/tmp/wa-wvis-menu-native-hover.log` and
`/private/tmp/wa-wvis-menu-hit-probe-json.log`. The latter uses the existing
profile tool's `eval:` step, with `JSON.stringify` because the tool converts
eval results to strings. The preserved result is
`/private/tmp/wa-wvis-native-menu-result.json`. Direct exports report:

```text
owner                 98305
dropdown x/y/width    149 / 204 / 180
child flags           [2,1,1,1,1,1,1,1,1,1,1,1]
hit-test (215,257)     -1
hover (215,257)        -1
```

These are internal blob flags: bit 0 means separator, bit 1 means grayed,
bit 2 checked, bit 3 popup. Child 2 has the correct label "Rendering Options"
but flag 1: the hit test deliberately rejects it as a separator. Every item
after the title is similarly flagged. This rules out coordinates or browser
mousemove routing as a sufficient explanation: calling the WAT hit test
directly at an interior point also fails. It does **not** yet establish which
parser/mutation/ownership path produced those flags. Trace API names were
added, but the retained console events contained no menu API entries; do not
present the static call sequence above as a captured runtime API trace.

Next diagnostic: compare the raw resource and the first installed menu blob
with its later state, then isolate the write that first turns a labelled
popup into a separator. Preserve this failure as a regression before deleting
the renderer helper. No runtime behavior was changed in this investigation.

There is also a separate lifetime gap: our TrackPopupMenu handlers return
immediately after opening the popup, allowing the guest's subsequent
DestroyMenu to run before selection. Microsoft's
[TrackPopupMenu contract](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-trackpopupmenu)
and [menu-loop example](https://devblogs.microsoft.com/oldnewthing/20050307-00/?p=36263)
describe selection tracking before return. That source-level gap is not yet
proven to cause the observed flags; do not fix it by silently ignoring menu
destruction, and do not claim a native Win98 measurement from modern docs.

The renderer workaround discovers the plugin by window title and DLL export
name, opens resource 101 itself, manually synchronizes allocator globals,
and consumes the real button-up. It therefore bypasses the guest's own menu
setup/check-state path. The replacement must preserve guest delivery and
submenu usability, not merely draw a lookalike resource menu.
