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
| `strategy-jiggler` | JIGGLER.EXE | plays — three menu fixes plus named FindResource |
| `board-wingong` | MOREJONG.EXE | draws — longer budget |
| `strategy-klotski` | KLOTSKI.EXE | plays — the blank capture was a fluke |
| `cards-sokoban` | SOKOBAN.EXE | **open** — VB3, "execution entered zeros" |
| `arcade-clxwrk` | CLOCKWRX.EXE | **open** — imports from `DISPLAY` |

The five commercial titles, tracked separately: SimCity 2000 and MicroMan run,
Exile II reaches its title screen after a three-stage install (below), Pitfall
plays its attract demo now that DISPDIB answers, and Bad Toys 3D is the one
still blocked (WinG as a *file*, then `USER.308 DefDlgProc`).

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

**3. `FindResource` refused every resource named by string.** That is what
made the game area black. JIGGLER keeps its whole picture and sound set in
custom NE resource types — `node tools/ne-dump.js JIGGLER.EXE --all` shows 52
`"WAVE"` and 10 `"TEXT"` entries, all with *string* names — and
`$win16_FindResource` bailed out whenever the name argument was a far pointer
rather than a `MAKEINTRESOURCE` integer, so all of them came back NULL. The
consequences read nothing like the cause:

```
KERNEL.60 FINDRESOURCE(…) -> AX=0x0000      x20, every one of them
KERNEL.62 LOCKRESOURCE(0) -> DX:AX = 0:0
<module 13>.2 (0x37:0x8dd0, 0, 0, 0)        L_InitBitmap with a 0x0x0 image
GDI.51 CREATECOMPATIBLEBITMAP(hdc, 0, 0)
GDI.45 SELECTOBJECT(0x111, 0)               a NULL bitmap in the memory DC
GDI.35 STRETCHBLT(… wSrc=0, hSrc=0 …)       x10000, over the board
```

A working load looks the same with numbers in it: `<module 13>.2(pBitmap,
620, 440, 24)` and then 13 `STRETCHDIBITS` of 35 scanlines each.

Fixed 2026-09-20. The by-name machinery already existed in the NE walker
(`$win16_find_resource_ex` takes a `name_wa`) and only `FindResource` did not
use it. The wrinkle is that `FindResource` returns a *handle* and every later
call works from that handle alone, by which time the caller's string may be
gone — so the scan now records the matched NAMEINFO id word in
`$win16_res_found_id`, the descriptor carries it (a fourth word; the stride
went 12 -> 16), and `$win16_find_resource_rid` re-finds that exact entry for
LoadResource/LockResource/SizeofResource/AccessResource. A named entry's id
word has bit 15 clear and an integer id always has it set, so the two can
never be confused. Regression: the SOL block in `test/test-win16-exec.js`.

The board now draws: 18,785 colours at the route below, wood-grain tile backs
and the working clock widget, against 196 colours and a black rectangle
before.

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

**2026-09-20, correcting the above: DI is not the corrupt value.** Hit #1 and
hit #3 in that table have the *same* `DI = 0x01e8` and only one of them is
fatal, so DI cannot be what distinguishes them — and `0x2f5204` is not the
pivot either. The pivot `8b e7 9d c3` (`mov sp,di; popf; ret`) is at
**`0x2f5200`**, four bytes earlier; `0x2f5204` is a separate entry point that
shares the tail of the same routine:

```
2f5204  59              pop cx              ; return address
2f5205  36 89 1e 72 02  ss: mov [0x0272], bx
2f520a  5b              pop bx              ; the index, from the caller's push
2f520b  8b c3           mov ax, bx
2f520d  03 db           add bx, bx
2f520f  2e ff a7 5a 51  jmp word cs:[bx+0x515a]
```

So the fault is a **jump-table dispatch with an out-of-range index**, and the
whole chain is now visible:

| | working hit | fatal hit |
|---|---|---|
| caller | `0x2f4f0f` | `0x2f4c1f` |
| popped index | `0x0002` | `0x0078` |
| `bx` after doubling | `0x0004` | `0x00f0` |
| entry read | `cs:0x515e` | `cs:0x524a` = `0xec83` |

`0xec83` is not a bad pointer into a segment we failed to fill: **no VBRUN300
segment is that large.** The module's 101 segments top out at `alloc=0x9d5a`
(`node tools/ne-dump.js VBRUN300.DLL --segments`), so offset `0xec83` does not
exist anywhere in it, and the zeros at `0x2fec60`+ are simply the unused tail
of the 64KB selector stride. The word at `cs:0x524a` is `83 ec`, the first two
bytes of a `sub sp,0x0a` in the *handler bodies* that follow the table — the
index ran off the end of the table and read code.

Where `0x78` comes from is settled too, with a watchpoint on the stack slot the
dispatcher pops:

```
node test/run.js --exe=<dir>/SOKOBAN.EXE --vfs-include='*' \
  --win16-lib=<dir>/VBRUN300.DLL --max-batches=4000 --no-close --quiet-api \
  --watch-word=0x001170ca --watch-log --watch-value=0x0078
```

It is written by `push ax` at **`0x2f3ffe`** (`50`, immediately followed by
`6a 02`, `push 2`), on the threaded path that then runs `es: lodsw; jmp ax` at
`0x2f4001` — the FP library's own address-stream interpreter. So two words go
on the stack, a `2` and a computed value, and by the time the dispatcher runs
the `2` is gone, the return address `0x4c22` sits in its slot, and the
dispatcher pops the *other* one as its index.

**The bug is therefore a stack imbalance of exactly one word on the path from
`jmp ax` to the call at `0x2f4c1f`, not a corrupt register.** The next step is
to find which routine on that threaded path returns without popping the word it
was given — the candidates are the x87 sequences in this segment (`9b 36 d9 1c`
= `fwait; ss: fstp dword [si]` at `0x2f51f4`, and the `sub sp,0x0a; mov di,sp;
fwait; ss: fstp qword [di]` bodies at `0x2f5240`+), because those are the only
places where our emulation, rather than the guest's own code, decides what the
stack looks like on the way out. Note this is the coprocessor-*present* path of
the MS floating-point library, which is the right one for us to be on: the NE
loader deliberately leaves OSFIXUP (type 3) records alone
(`src/08c-ne-loader.wat:384`), so those really are x87 instructions and not
emulator call sites.

One named suspect to check first, because it is ours and it is stack-neutral
by construction: `$th_int` (`src/05c-seg16-ops.wat:650`) services `INT 21h` and
answers every other vector by setting CF and resuming, pushing nothing. The MS
floating-point library's vectors are `INT 34h`–`3Eh`, and a real one pushes
three words that an `IRET` on the far side takes back off. If any path in this
segment still reaches an `IRET` — or a handler written to be entered by an
INT — the word counts on the two sides do not match, and one word is exactly
the discrepancy measured above. Confirm or eliminate that before hunting a
missing `pop` in the guest's own code.

## MicroMan (`ARCADE/MICROMAN`)

16-bit NE, and it needs nothing: `--max-batches=40000` off the CD directory
draws the full game — menu bar, tiled level, sprite and the status strip.

## Pitfall (`ARCADE/PITFALL`, open)

32-bit PE. It greets you with "Pitfall must be played in 256 color mode for
optimum performance." (`MB_ICONERROR`, OK only), and then asks for
**DISPDIB.DLL** — the Video for Windows full-screen DIB driver — through
`LoadModule`, a KERNEL32 API we did not implement, so the run ended in
`FATAL: implement this API`.

`LoadModule` is implemented as of 2026-09-20 and answers what Windows answers
for a module that is not on the machine: 2, `ERROR_FILE_NOT_FOUND`. Pitfall
turns that into its own diagnostic —

```
[MessageBox] "Pitfall": "Bad or missing dispdib.dll - error 2"
```

— and exits. So it has no GDI fallback: reaching gameplay needs a DISPDIB
surface, the same shape as the MPR/TAPI/spooler fragments (a small WAT-native
module behind `DisplayDib`/`DisplayDibWindow`, presenting a 320x200 8bpp DIB
full screen). The one copy of the real DLL in this tree,
`test/binaries/candidates/civilization-2-win16/cd/VFW_INST/DISPDIB.DL_`, is
**KWAJ**-compressed, not SZDD, so `tools/szdd.js` cannot expand it — and it is
a 16-bit DLL besides, which a 32-bit caller cannot load without thunks we do
not have. Implementing the surface is the route, not finding the file.

### What Pitfall actually wants from DISPDIB

Read statically from `PITFALL.EXE` on 2026-09-20, so the API list below is what
the loader really does, not what the DISPDIB documentation describes. The
loader is the function at **`0x0044104e`**:

1. `GetSystemDirectoryA(buf, 260)`, then appends the literal `\DISPDIB.DLL`
   from `0x0046df38` — so the path it tests is
   `C:\WINDOWS\SYSTEM\DISPDIB.DLL`, not a bare name.
2. `LoadModule(path, &block)` at `0x00441055`. `cmp eax,0x20 / jl` — anything
   below 32 is the failure that produces "Bad or missing dispdib.dll - error 2".
3. `CreateWindowExA(0, "DisplayDibWindow", …, WS_POPUP, 0, 0, cx, cy, …)` at
   `0x004410e1`, sized from two `GetSystemMetrics` calls. **`DisplayDibWindow`
   at `0x0046df24` is a window class, not an exported function** — the whole
   surface is driven through that window, which is why no `GetProcAddress`
   appears anywhere in the trace. The HWND is kept at `0x0046c3a0`.
4. `SendMessageA(hwnd, WM_COPYDATA, 0, &cds)` at `0x00441175`, with
   `dwData = 0x400`, `cbData = 0x428` and `lpData` pointing at a
   `BITMAPINFOHEADER` filled in at `0x0044111d`: `biSize=0x28`,
   `biWidth=320`, `biHeight=200`, `biPlanes=1`, `biBitCount=8`. `0x428` is
   `0x28 + 0x400`, i.e. the header plus 256 `RGBQUAD`s — so this one message
   carries both the mode and the palette.

The HWND at `0x0046c3a0` is read in exactly three places, so the whole
protocol Pitfall uses is three sends:

| site | send | meaning |
|---|---|---|
| `0x00441175` | `WM_COPYDATA`, `dwData=0x400` | set 320x200x8 + palette |
| `0x0044123d` | `0x403` | start |
| `0x00441442` | `0x404` | stop |

**What is still unknown is how a frame of pixels gets there**, and it is not
answerable statically — no fourth send exists, so the bits either come back as
a pointer from one of these sends or go through an ordinary GDI call on that
window. The flag at `0x0046c3dc` ("DISPDIB is available", set at `0x00441181`)
is *not* the answer: its three readers are all in the dialog code at
`0x0044072c`, choosing a control layout.

### The surface, and what the runtime then said

Built 2026-09-20 as `src/09d5-dispdib.wat`: `$handle_LoadModule` answers a
module handle for any path whose basename is `dispdib.dll`, `CreateWindowExA`
claims the class name `DisplayDibWindow` onto a new WAT-native wndproc marker
(`0xFFFF0005`), and that wndproc implements the three sends above over a small
`$DISPDIB_STATE` record. Every *other* private message traps by name, which was
the point: the fourth send, if there is one, would say so rather than be
guessed at.

**There is no fourth send.** Pitfall runs the whole handshake — LoadModule,
`CreateWindowExA(… "DisplayDibWindow" … 640x480 WS_POPUP)`, one `WM_COPYDATA`
with `dwData=0x400` — and never touches that HWND again, over 200,000
batches. Nothing trapped. It then **plays in its own window**: the title
screen with its File/Help menu, and `File > New Game` (`post-cmd:40036`) runs
the 2600-style attract demo, drawn with ordinary GDI into the 320x224 client
area and a status strip underneath.

So DISPDIB here is a *capability probe with a mode attached*, not the path the
pixels take. The 0x403/0x404 pair is the full-screen switch, which a headless
run never asks for; the flag at `0x0046c3dc` choosing a control layout is
consistent with that reading. Reaching gameplay needed the surface to exist
and answer, not to display anything.

```
node test/run.js --exe=/Volumes/1000GAMES/ARCADE/PITFALL/PITFALL.EXE \
  --vfs-include='*' --quiet-api --max-batches=200000 --max-seconds=50 \
  --no-close --input=3000:dlg-cmd:1,20000:post-cmd:40036 --png=pitfall.png
```

(`3000:dlg-cmd:1` is the OK on the 256-colour notice; without it the run parks
on the modal at batch 14.)

Two things this does not fix. A program that *stats* `DISPDIB.DLL` rather than
loading it still finds nothing there — the same gap Bad Toys 3D hits with
`wing.dll`, and the reason that one needs a file and not a module answer. And
a full-screen 320x200 presentation is still unimplemented: the wndproc records
the mode and the running flag, and the first program to actually start the
display will trap on whatever it sends next.

There is no fallback path to find, either: Pitfall exits when the module is
missing rather than degrading to GDI. Regression:
`test/test-dispdib-window.js`.

## Exile II: Crystal Souls (`ADV/EXILE`)

Reaches its title screen as of 2026-09-20. Getting there is a **three-stage**
run, because nothing on the CD is the game: `INSTALL.EXE` is a bootstrapper,
the installer it starts is a second program, and only that one writes the game.

```bash
# 1. the bootstrapper: unpacks IRDATA.DAT + IRSETUP.EXE into C:\WINDOWS and
#    WinExec's the second, which --capture-launch snapshots instead of losing
node test/run.js --exe=/Volumes/1000GAMES/ADV/EXILE/INSTALL.EXE \
  --vfs-include='*' --quiet-api --no-close --max-batches=30000 \
  --capture-launch=/tmp/exile-stage2

# 2. the real installer. --exe-guest-path is load-bearing: IRSETUP finds its
#    configuration next to its own module, and without it the module reads as
#    C:\IRSETUP.EXE and the config lookup goes to C:\IRDATA.DAT, which is not
#    where stage 1 put it -- "Could not load the configuration file."
node test/run.js --exe=/tmp/exile-stage2/windows/irsetup.exe \
  --exe-guest-path='C:\WINDOWS\IRSETUP.EXE' --args='C:' \
  --vfs-tree=/tmp/exile-stage2 --cwd='C:\' --overlay-dir=/tmp/exile-overlay \
  --quiet-api --no-close --max-batches=120000 --input='3000:click:281:349'

# 3. the game, out of the overlay the installer wrote
node tools/overlay-export.js /tmp/exile-overlay --out=/tmp/exile2 --prefix='c:\exile2'
node test/run.js --exe=/tmp/exile2/exile2.exe --vfs-tree=/tmp/exile2 \
  --quiet-api --no-close --max-batches=200000 --input='6000:click:480:427'
```

Stage 2 installs 37 files (6.8 MB) into `C:\EXILE2`. Stage 3 draws the welcome
text, and one click on "On with the game..." reaches the title screen with the
animated map panel and the five-item menu.

Four emulator gaps were in the way, and the first is the interesting one:

- **`GDI.76` was wired to `SetBitmapBits` and is `GetBkMode`.** The real GDI
  export table (`src/win16-ordinals.generated.json`, which the `--trace-win16`
  decoder already prints from) says 74 `GETBITMAPBITS`, 76 `GETBKMODE`, 106
  `SETBITMAPBITS`. IRSetup's painter reads the background mode back while
  drawing its text, so the bitmap path ran instead and fed a stack word to
  `$win16_h32`, which correctly refused a handle it never handed out. **The
  generated ordinal map is ground truth for this kind of bug** — a wrong
  ordinal looks exactly like an unimplemented one until the two are compared.
- `USER.181 SetSysColors` did not exist in either bitness. It does now, backed
  by `USER_SYS_COLORS`, a 32-slot override table `GetSysColor` reads ahead of
  the stock palette (`test/test-set-sys-colors.js`). The 16-bit form is not the
  32-bit one: its index array is 16-bit and its value array 32-bit, so the
  Win16 entry walks the pair itself rather than forwarding.
- `GDI.373 SetSystemPaletteUse` and `GDI.60 CreatePatternBrush` needed only
  their Win16 wrappers; both Win32 handlers were already there.

Two things to know before the next installer:

- `--capture-launch=DIR` plus `--vfs-tree=DIR` is the two-stage bootstrapper
  route, and `--overlay-dir=DIR` plus `tools/overlay-export.js` is how the
  *installed* tree comes back out as ordinary files.
- Stage 3 runs at ~138 batches/s, two orders of magnitude below a typical app.
  The title screen animates, so that is drawing cost, not a hang.

## Bad Toys 3D (`3D/BT3D19`, open)

16-bit NE `INSTALL.EXE`, and it never gets as far as unpacking anything:

```
[MessageBox] "BAD TOYS 3D Setup": "WinG is not installed,
```

The check is a file test, not a load. `--trace-fs` shows
`GetSystemDirectory` then `OpenFile` on `C:\WINDOWS\SYSTEM\wing.dll`, and the
message box follows the miss immediately — no `LoadLibrary`, no
`GetProcAddress`. The CD carries the WinG redistributable in `BT3D19/WING/`
(the Microsoft ACME `MSSETUP.EXE` kit: `WING.DL_`, `WING32.DL_`,
`WINGDIB.DR_`, `DVA.38_`, `WING.MST`), so on real hardware you run that first.

Mounting any file at that path with
`--vfs-mount=<host file>=c:\windows\system\wing.dll` gets past it — the
installer then builds its main window and a 7-control dialog and stops at the
**next** gap, `USER.308 DefDlgProc`, which we do not have in 16-bit form.

That one is not a small wrapper. `$handle_DefDlgProcA` reaches dialog default
processing through `$dialog_default_proc`, which calls `$wnd_send_message` —
the 32-bit synchronous sender — and can also tail-dispatch a stored proc by
writing `$eip` over a 32-bit frame. Neither is right for a Pascal caller, so a
truthful `USER.308` wants the Win16 far-continuation path rather than a
forward. As of 2026-09-20 that area is claimed on the message board by another
agent (Win16 windowpos/defproc, far continuation), so this is blocked on
coordination and not on knowledge.

Two things to settle before that matters, in this order:

1. **WinG itself.** Eight entry points — `WinGCreateDC`,
   `WinGRecommendDIBFormat`, `WinGCreateBitmap`, `WinGGetDIBPointer`,
   `WinGGet/SetDIBColorTable`, `WinGBitBlt`, `WinGStretchBlt` — all of which
   sit on DIB machinery `10a-gdi-bitmap.wat` and `10g-gdi-raster.wat` already
   have. The shape to copy is `09d1-mpr.wat`/`09d2-tapi.wat`: a WAT-native
   module answered for by name, plus whatever makes a file test at
   `c:\windows\system\wing.dll` succeed, since that test is what the installer
   actually performs.
2. **Which entry points `BT3D.EXE` needs.** Unknown, because the exe is inside
   `DATA.TCF`/`BT3D.TCF` and only the installer unpacks them. Get past
   `USER.308` with the mounted-stub trick first and dump the installed exe's
   imports; do not size the WinG work from the API list before then.

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
