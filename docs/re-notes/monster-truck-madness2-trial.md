# Monster Truck Madness 2 Trial (Terminal Reality / Microsoft, 1998)

App `monster_truck_madness2_trial` (candidate `monster-truck-madness2-trial`,
localOnly; plays in the software renderer). `Monsterx.exe` is a statically linked MFC 4.0 MDI app
(`AfxFrameOrView40s`, `AfxMDIFrame40s` classes). Its UI frames are
`CMDIChildWnd`s whose views are `CFormView`s, created as dialogs.

## Licence

`eula.txt` in the package is the Microsoft trial EULA. It allows
non-commercial redistribution of complete copies, with the EULA attached; the
grant is the same as Midtown Madness Trial's.

## Install layout

archive.org `MonsterTruckMadness2_1020`, `MtM2trial.zip` (SHA-1 `d12c783a…`).
It holds `MtM2trial.EXE`, a self-extractor that `7z x` unpacks directly into
`Monsterx.exe`, the `.pod` archives, `Monsterx.ini`, `eula.txt`, the help
files and four renderer DLLs:

| DLL | Renderer | Imports |
|---|---|---|
| `Trid3d.dll` | Direct3D | DDRAW (static import of the exe) |
| `Triglide.dll` | 3dfx Glide | glide2x.dll |
| `Trirend.dll` | Rendition Vérité | redline.dll, verite.dll |
| `Trinec.dll` | PowerVR | sgl.dll |

`Monsterx.ini` `[Graphics]` defaults to `useDirect3D=0` and
`rendererDLLPath=C:\METAL2X\triglide.dll`, which selects the software
renderer.

## Startup sequence (headless, `--batch-size=50000`)

1. A MessageBox-style dialog says the display has "more than 256 colors". OK
   continues (`keydown:13` at batch 40); Cancel exits.
2. The frame `0x10001` and the MDI client open, then MDI child 1 `0x10003`
   with form view `0x10004`. After OK, child 2 `0x1000b` gets form view
   `0x1000c`.
3. The shell screen ("Trial Version", menus Race/View/Options/Help) appears
   by about b120 (magenta before 16668e502, see below). Left idle, it auto-starts the attract demo, "Farm Road
   29": "Loading terrain database" at about b540, frames from about b1100.
4. **Software renderer = DISPDIB mode 13h** (works since ad1b472f5). After
   "Loading additional graphics" it creates a `DisplayDibWindow` (our
   `src/09d5-dispdib.wat`), sends `WM_COPYDATA{dwData=0x400, cbData=0x428}`
   (a top-down 320x-200 8bpp BITMAPINFO plus palette; 0x5439a0, again at
   0x4200db/0x4207c2 for palette changes), then `0x403`, and tests both with
   `test eax,eax / jnz` into "Unable to start DisplayDIB Mode" (0 =
   DISPLAYDIB_NOERROR, e51182ad3). It then `SetFocus`es that window and
   writes each frame **straight to linear 0xA0000** with no API call:
   `rep movsd` of width x height from the back buffer `[0xaad3a0]` (a DIB
   section) at 0x543cba; a 320x400 mode would take the Mode X path at
   0x5a1450 (`out 0x3C4` map mask, page flip by `xor [0x657aa4], 0x8000`),
   which nothing implements. 0x543154 probes `[0xA0000]` under SEH first;
   `[0x9a2adc]` = "DISPDIB mode on", `[0x646cd8]` = the display HWND.
   `0x402` (DDM_CLOSE) is sent on exit (0x54515b).
5. **Options → Graphics…** (Alt+O, R) probes the renderer DLLs. `Trinec.dll`
   (sgl.dll) and `Trirend.dll` (redline.dll) now fail to load with
   ERROR_MOD_NOT_FOUND, as on Windows (058a8d830); `Triglide.dll` loads.

## Reaching a race (headless)

```
--input=40:keydown:13,42:keyup:13,330:mousedown:565:465,333:mouseup:565:465,
        560:mousedown:565:465,563:mouseup:565:465,850:mousedown:457:306,853:mouseup:457:306
```

OK on the 256-colour box → the shell's bottom-right start button (Driver
Check-In) → GO → OK on "Before You Begin" → the race draws from about b1700:
in-cab view, HUD, minimap. Evidence:
`scratch/runs/20261011T0535Z-monster_truck_madness2_trial-dispdib-race-claude1863`.

**The truck drives** (registered 8de759fae; evidence
`scratch/runs/20261011T0625Z-monster_truck_madness2_trial-gameplay-claude1863`).
Add `1700:keydown:38` to hold Up. It is slow to get going at the headless
clock: the speedometer is still near zero at b2600 and well up by b2850, and
the "Back" gap to the leader shrinks from 1:03.87 to 0:35.37 by b3450. A
2026-10-11 note here that it "does not drive" was a run that stopped too
early. How the controls actually work:

- No input API is polled in the race. Keys arrive as WM_KEYDOWN/WM_KEYUP and
  the app's `PreTranslateMessage` (0x4276e0, via thunk 0x406244; app vtable
  0x606bb8) handles them before dispatch, writing a byte per **scan code**
  into the key table at `0x722e50` (`--watch=0x722e98` = accelerate, scan
  0x48, goes to 1 at the first keydown, EIP 0x4045e3). So lParam's scan-code
  byte must be right; the VK is not what it reads.
- `Monsterx.ini [Keys]` maps scan codes plus VKs (`keyAccelerate=72` / `_VK=38`,
  brake 80/40, right 77/39, left 75/37); `[Control] joystickActive=0`.
- The only DirectInput use is `IDirectInput_EnumDevices(DIDEVTYPE_JOYSTICK,
  DIEDFL_FORCEFEEDBACK)` at startup; joysticks via `joyGetDevCapsA`.
- "Before You Begin" shows "Your controls are set to" with a blank device
  name although `[0x63e240]` (control type) is 0, i.e. "Keyboard"
  (0x475160 switches on it and `SetWindowText`s the static at `+0x320`). So
  that blank is a dialog-text rendering issue, not missing controls. Open.

## The pink shell (fixed 2026-10-11, 16668e502)

Every shell bitmap is a DIB section the game remaps onto a palette it builds
(0x56f270 sets the palette up; GetDIBColorTable, then nearest-colour against
the palette, then SetDIBColorTable). The loop's bound is
`CPalette::GetEntryCount` = `GetObject(hpal, 2, &w)` (called from 0x56f45d),
and we answered 0, so the remapped table was stack garbage. GetObject on a
palette now writes the WORD count.

## The empty view list (fixed 2026-10-11, f54d8df3d)

The crash right after the 256-colour prompt was `CObject::IsKindOf(NULL)`
(`0x5d7a12`, called from `0x545080`). `0x545080` walks the views of the
document stored at `[app+0xc0]` (app object `0x749a38`):

- the document is `0x01056314`, vtable `0x60c310`;
- `GetFirstViewPosition` is `+0x64` → `0x5e22bc`, which reads the view list
  head at `+0x2c`;
- `GetNextView` is `+0x68` → `0x5e22c0`.

The views never registered because our CreateDialog CBT path skipped
`WM_CREATE`, and `CFormView::OnCreate` is where `AddView` happens.

Other addresses:

- `CMDIChildWnd::Create` returns from `WM_MDICREATE` at `0x5f176d`.
- The view `CCreateContext` is at `0x074ffe34`: view class `0x644a78`,
  document `0x01056314`, template `0x010408cc`.
- `[app+0xc0]` is stored at `0x542713` in InitInstance, called through
  `0x42cac6`.

Breakpoints after an indirect call (for example `0x5450af`) do not fire,
because they are not block entries. Use `--count` on branch targets and
`--watch` with `--watch-start-batch`.
