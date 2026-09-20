# SimCity 2000 Win95 Demo (`simdemo.exe`)

Registry id `simcity2000_demo`, local-only (`test/binaries/candidates/simcity-2000-demo/installed/`).
Maxis/MFC, MDI frame + one MDI child. Loads at the usual `0x400000`, so a
runtime EIP is the original VA unchanged.

Reaching the city headlessly:

```
node test/run.js --no-build --app=simcity2000_demo --max-batches=60000 \
  --max-seconds=60 --no-close --quiet-api \
  --input=25:dlg-cmd:1,2000:mousedown:215:93,2050:mouseup:215:93 --png=/tmp/sc2k.png
```

`25:dlg-cmd:1` answers the startup "Video Warning" box; the click at 215,93 is
the "Load Demo City" button on the launcher window. A few thousand batches
later a demo notice ("I will now demonstrate some of the Disasters") appears
over a live, simulating map.

## Functions identified

| VA | What it is |
|---|---|
| `0x00478c77` | startup display check — `GetDeviceCaps` RASTERCAPS/BITSPIXEL/PLANES, then the Video Warning |
| `0x004a87af` | registry-backed settings read (`RegQueryValueEx` through `[0x4d7760]`) |
| `0x0049b7ab` | matching settings write |
| `0x004a4977` | MFC MRU scan: walk an HMENU for a command id in `0xE130..0xE13F` |

## "You're not running in 256 colors" is correct, and one-shot

`0x00478c77` reads `GetDeviceCaps(hdc, 12)` BITSPIXEL into EDI, `(hdc, 14)`
PLANES into EBX and `(hdc, 38)` RASTERCAPS masked with `RC_PALETTE` (0x100).
We report 32 / 1 / 15033 — a true-colour display, which is what the emulator
actually presents — so the `cmp edi, 8` at `0x478cde` fails and the warning
path runs. It is not a failure path: the code at `0x478cff` reads
`HKCU\Software\Maxis\SimCity 2000 Win95 Demo\Windows\Last Color Depth`, warns
only when the stored depth differs from the current one, and writes the
current depth back. So the box appears once per fresh registry and never
again, exactly as it would on real hardware after a resolution change.
Nothing about the game is degraded by it; the animations it mentions are
palette animations a 32bpp display has no equivalent for.

## "Load Demo City" used to hang: detached HMENU (fixed)

`0x004a4977` is MFC's scan for the MRU id block:

```
esi = GetMenuItemCount(hMenu) - 1
if (!count) return
loop: edi = GetSubMenu(hMenu, esi)
      if (edi) for (ebp = 0; ebp < GetMenuItemCount(edi); ebp++)
                   if (0xE130 <= GetMenuItemID(edi, ebp) <= 0xE13F) return found
      eax = esi; esi--; if (eax) goto loop
```

`hMenu` is `0x00BE0003` — MFC's `CMultiDocTemplate::m_hMenuShared`, loaded by
`LoadMenuA(0x400000, 3)` and *never attached to a window*. Our menu model kept
every blob in `MENU_DATA_TABLE[slot]` and resolved a handle by finding the
window that owns it, so `GetMenuItemCount` answered -1 for this one. `-1 - 1`
is -2, `test eax, eax` is nonzero, and the loop counts down through four
billion iterations.

Measured before the fix (`--handler-hist --handler-hist-thread=0 --handler-hist-start=2060`):
the three blocks `0x004a4993` / `0x004a499e` / `0x004a49ce` take **21,333,15x
entries each, 31.17% apiece — 93% of all work in the run**, with 23M Win32
calls against ~5 per batch before the click. `[sync] ABANDONED wndproc
hwnd=0x1003c msg=0x222 ... after 64 rounds` in the same log is the same event
seen from the other side: `$wnd_send_message` gave the MDI child's
WM_MDIACTIVATE 64 × 1,000,000 steps and gave up.

Fixed in `src/09c5-menu.wat` by materializing an unattached `LoadMenu` handle
as an ordinary dynamic (MNUD) menu built from its RT_MENU template, cached by
resource id (`$menu_detached_handle`). Afterwards: 711k API calls and 60,000
batches in 14.8s where the same route was 23M calls and 134k batches in 71s,
and the map draws. Covered by `test/test-detached-menu-handle.js`.
