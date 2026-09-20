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
| `strategy-jiggler` | JIGGLER.EXE | draws — only ever needed a longer budget |
| `board-wingong` | MOREJONG.EXE | draws — longer budget |
| `strategy-klotski` | KLOTSKI.EXE | draws — the blank capture was a fluke |
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
node test/run.js --exe=<dir>/SOKOBAN.EXE --vfs-include='*' --max-batches=400 \
  --no-close --trace-win16
```

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
