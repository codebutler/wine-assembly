# Fuji Golf (Win16 WEP3)

App `wep16_fujigolf`, `test/binaries/wep16/WEP3/FUJIGOLF.EXE`, with
`FUJIGOLF.DAT` mounted beside it. See the historical native comparison in
[win16-v86-audit.md](../win16-v86-audit.md).

## 2026-09-20: separate startup harness failure from clubhouse geometry

The previous WEP3 gate failed to find player-name edit ID 100. A screenshot
at its clubhouse checkpoint instead shows the game's legitimate first-run
prompt asking to copy `C:\FUJIGOLF.DAT` to `C:\WINDOWS\FUJIGOLF.DAT`.
The test had not accepted it. HWND 0x10001 is that message box, not the
player dialog; no missing edit-control implementation is established.

Accepting the prompt at batch 20 opens the maximized clubhouse. Its Start
New Round button is ID 4, parent HWND 0x1000b in this run, child position
(113,331), size 187x19. Its visible screen center is around (210,382), not
the old test's (220,409). Clicking it opens the player dialog, accepts
`Codex` in edit 100, and OK reaches the rendered first tee. The course
screenshot was visually inspected, including golfer, course overview,
clubs and shot controls.

The corrected gate accepts the copy prompt and uses `ctrl-click:4`, which
resolves the real control independently of layout. It retains the strict
maximized-caption and native scene-depth checks, and checks the course
transition before those geometry checks. **The gate remains red**, now for
the actual scene-height problem: saturated content bounds **360x291**,
against the retained height requirement >310. The historical native scene
is 368x326. Do not lower the threshold or call Fuji Golf fully fixed.

Runtime code is unchanged by this investigation. The next investigation is
the guest's clubhouse layout/bitmap sizing (including the synchronous
maximize size and client dimensions), not the name-entry dialog or painting
callbacks. The current clubhouse is maximized, but its scene remains short.

Evidence, all in `/private/tmp/`:

- `wa-fuji-repro.log`, `wa-fuji-clubhouse.png`: original failure and prompt.
- `wa-fuji-first-run.log`, `wa-fuji-ready.png`: prompt accepted, clubhouse
  and actual button geometry; old click still misses.
- `wa-fuji-round.log`, `wa-fuji-course2.png`: corrected physical click,
  successful name entry and first tee.
- `wa-fuji-corrected-gate.log`: corrected control-ID recipe reaches the
  unchanged scene-depth assertion.

```sh
WINE_ASSEMBLY_WASM=build/wine-assembly.wasm node test/test-win16-wep3-gameplay.js fujigolf
```
