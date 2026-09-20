# Over 1000 Games for Windows (Nodtronics, 2001) — the titles that came up blank

A 2001 shareware CD, mostly 16-bit NE. The corpus is **local-only** under the
Nodtronics EULA — nothing here may be published or deployed.

This note covers the seven titles a registry sweep scored as "launches but does
not draw", because five of them were not one problem and the sweep's verdict was
wrong about three of them for three different reasons.

## Verdicts

| id | exe | 2026-09-20 |
|---|---|---|
| `board-scrabout` | SCRABOUT.EXE | draws — two fixes, below |
| `board-3dshere` | SPHEJONG.EXE | draws — needed USER.82 `InvertRect` |
| `strategy-jiggler` | JIGGLER.EXE | menu works, game area **open** — below |
| `board-wingong` | MOREJONG.EXE | draws — longer budget |
| `strategy-klotski` | KLOTSKI.EXE | plays — the blank capture was a fluke |
| `cards-sokoban` | SOKOBAN.EXE | **open** — VB3, "execution entered zeros" |
| `arcade-clxwrk` | CLOCKWRX.EXE | **open** — imports from `DISPLAY` |

## The sweep's verdict is not evidence

Three of the seven were photographed too early or under load, not broken:

- **A MoraffWare loader needs tens of thousands of batches.** `strategy-jiggler`
  and `board-wingong` are blank at 6,000 batches and draw at a 40-second budget.
  `tools/iso-title-sweep.js` defaults to 8,000 batches / 25s, which is under the
  bar for this publisher's whole catalogue.
- **A `--png` capture can come back fully transparent on a loaded box.**
  `strategy-klotski` produced a 100%-transparent PNG in one sweep run and a
  correct 203-colour picture from the same command line afterwards. *Fully
  transparent* (nothing composited) and *flat desktop teal* (composited, no
  window) are different failures — `node tools/png-inspect.js stats` separates
  them and the byte count does not.
- **Two of the "blanks" were early crashes**, which the sweep cannot tell apart
  from a blank because both end with a teal PNG.

## Moraff's Jiggler

Three things stand between a cold start and a game, and only the first is the
app being coy.

**1. The "Critical Note:" box.** An `MB_OKCANCEL` message box greets every
launch and says the menu only appears when you point at the upper-left corner
of the screen. `IDCANCEL` is the "never show this again" answer, so the
headless route is `--input=40000:dlg-cmd:2`.

**2. Its menu lives on a borderless WS_POPUP dialog.** `LoadMenu` resolves the
named `MAINMENU` resource, `menu_load` installs six bar items, and the app then
`SetParent`s the 1305x42 menu strip onto the game window. Fixed 2026-09-20
(`7aa1b93c`): `SetParent` was marking any reparented window `isChild` (which
costs it the bar outright), `drawWindow` painted a bar only for a *bordered*
window, and `handleMouseDown` dropped the click because a menu bar is outside
the client rect of a dialog with a parent. Regressions:
`test/test-set-parent-keeps-popup-toplevel.js` and
`test/test-menu-bar-borderless-dialog-click.js`.

The two `$win16_trace` markers added with that fix are the ones to reach for on
any "the menu is empty" report: `0xCA16A9E4` is every NE resource lookup with
its result, `0xCA16A9E3` is `menu_load`'s outcome stage (4 = resource not
found, 6 = parsed zero bar items, 7 = installed, with the bar count). They say
in one line whether the resource or the parse is the problem — here it was
neither.

Reaching a game, with the menu geometry as of that commit:

```
node test/run.js --exe=<dir>/JIGGLER.EXE --vfs-include='*.BKG,*.TIF,*.ID' \
  --quiet-api --no-close --max-batches=90000 \
  --input=40000:dlg-cmd:2,50000:mousemove:2:2,60000:click:110:8,\
62000:click:130:30,65000:click:300:30
```

`&Start New Game` (id 104) is a *bar* item, not a popup — clicking it at
`40,8` posts `WM_COMMAND 104` directly. The sized games are under
Play -> New Memory Jigsaw Game -> 4x4..20x20 (ids 5004..5020). `--input=…
menu-dump:bar` prints the whole open tree, and `node tools/ne-dump.js … --menus`
prints it statically.

**3. The game area is still black (open).** After a game starts, the app runs
real work with no Win32/Win16 calls at all and 50,000 `gdi_surface_upload`s —
every one of them inside `500,300 96x96`, which is a corner widget, not the
board. It reads `CATHEDRA.BKG` through the VFS and decodes it with `LEAD50.DLL`
(a LEAD Technologies Win16 imaging library it loads as module 13), so that
decode is the next thing to look at. `--trace-gdi` is the fastest way back to
this state: a healthy board would upload the whole client area.

## Klotski

Its "blank" attract screen is a LineTo/Rectangle animation — 563,000 `LineTo`
calls in 40 seconds, which is also why it only turns over ~450 batches/s. The
menu bar opens on a click at `35,50`, and `--input=8000:post-cmd:300`
("Level &1") starts a game: 32.38% of the pixels inside `24,72 472x265` change.

## ScrabOut

Two independent problems, in this order.

**1. The dictionary is shipped compressed.** The CD carries `DICTNARY.DA_` and
`DICTNARY.ID_` (SZDD) and the installer expands them. Mounting the raw CD
directory gives the app `DICTNARY.DAT` but no `DICTNARY.IDX`, and it answers
with `FatalAppExit(0, NULL)` — no message, so the run just exits 1 and the
next instruction fetch goes through a NULL far pointer. `--trace-win16` names
it in one line (`KERNEL.74 OPENFILE … -> AX=0xFFFF`, then `KERNEL.137
FATALAPPEXIT`), and `--trace-fs` names the file:

```
node tools/szdd.js <dir>/DICTNARY.ID_ <dir>/DICTNARY.IDX
```

This is an install-time asset, not an emulator gap.

**2. `GetPrivateProfileInt` lost a `0x8000` default.** ScrabOut keeps its window
rectangle in an INI and asks for Left/Top/Width/Height with `CW_USEDEFAULT`
(`0x8000` in Win16) as the default. The Win16 shim read `nDefault` through
`$win16_coord` — the helper that exists to turn the *window coordinate* `0x8000`
into the 32-bit sentinel `0x80000000` — and the WORD these calls return masked
that back to 0. So the app created its main window `0,0 0x0`, visible and
painting into nothing: a teal desktop at every budget.

Fixed 2026-09-20 (`18a63715`); `nDefault` is a UINT and is read as a plain word.
Window is now `20,20 480x321`. Regression: `test/test-win16-profile-int-default.js`.

The tell was in the trace and nowhere else: the four `GETPRIVATEPROFILEINT`
calls carrying `0x00008000` each returned `AX=0x00000000`, while the very next
one with a default of `1` returned `1`.

## SphereJongg

Ran ~42,000 batches and stopped with a bare `unreachable`. The last log line is
`[win16] USER.82 INVERTRECT` — the format `test/run.js` prints for the *Win16
unimplemented-API* marker, which reads exactly like an ordinary trace line, so
the stop looked like an emulator crash. The dispatch had USER.81 `FillRect` and
USER.83 `FrameRect` and nothing between them.

Implemented 2026-09-20 (`8f061f96`). Runs a full 45s with no crash; capture went
from no PNG at all to 659 KB / 100,397 colours. Regression:
`test/test-win16-invert-rect.js`.

## Sokoban (open)

VB3 (`VBRUN300.DLL`). Crashes at batch 72 inside `$decode_block` with marker
`0xCA002E20` — "execution entered zeros" — at guest `0x002fec83`, which is an
unmapped run of nulls. The last Win16 calls before it are ordinary
(`GetSystemMetrics`, `GetObject`, `LocalAlloc`), so nothing names itself. Same
marker class as the RollerCoaster Tycoon display-mode crash documented in
`lib/app-profiles.js`: the guest transfers control to an address it should never
have computed, so the interesting question is which earlier write produced the
bad pointer, not what the decoder did with it.

```
node test/run.js --exe=<dir>/SOKOBAN.EXE --vfs-include='*' \
  --win16-lib=<dir>/VBRUN300.DLL --max-batches=400 --no-close --trace-win16
```

**2026-09-20: it is a stack pivot through DI, not a decoder problem.** The
marker payload is `0xCA002E20`, faulting EIP `0x002fec83`, previous EIP
`0x002f5204` — same 64KB segment (selector `0x107`), so this is a *near*
transfer inside one VBRUN300 segment, not a bad far call. `0x2f5204` is three
instructions:

```
8b e7   mov sp, di
9d      popf
c3      ret
```

a longjmp-style pivot the segment's code `call`s outright (`0x2f4c1f:
e8 e2 05`). It is reached from several callers and only one of them is fatal:

| hit | prev_eip | DI |
|---|---|---|
| #2 | `0x2f4f0f` | `0x3ef8` — a real stack offset, returns fine |
| #3 | `0x2f4c1f` | `0x01e8` — pivots SP into unmapped memory, `ret` lands at `0xec83` |

So the corrupt value is **DI at the call**, and the decoder is only reporting
where a garbage return address led. The surrounding code is the Microsoft
floating-point emulator shipped inside VBRUN300 — `9b 36 dd 1c` (`fwait; ss:
fstp qword [si]`), a `2e ff a7 …` CS-relative jump table, `ff e1` — so the
next question is which earlier call fails to preserve DI across that segment's
x87 paths. Reproduce the table above with:

```
node test/run.js --exe=<dir>/SOKOBAN.EXE --vfs-include='*' \
  --win16-lib=<dir>/VBRUN300.DLL --max-batches=400 --no-close --quiet-api \
  --trace-at=0x002f5204
```

Ruled out: the target is not a missing relocation (the whole region from
`0x2fec60` on is zeros at batch 71, i.e. past the segment's real content), and
it is not a far-call selector problem.

## ClockWerx (open)

16-bit, and the loader says it first:

```
[win16] loaded MAC2WIN as module 13
[win16] loaded WING as module 14
[win16] DISPLAY: no DLL found, imports from it will stop the task
```

It imports from `DISPLAY` — the Windows display *driver* — and dies at batch 1
with `EIP=0`, `EAX=0x4C01` and 16-bit selectors still in the registers. This is
a driver surface we do not have, not a missing USER/GDI entry point. Its CD
directory is already fully expanded apart from `AAA._`, `DVA.38_` and
`WINGPAL.WN_`, so the SZDD trick above does not apply.
