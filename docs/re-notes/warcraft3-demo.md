# Warcraft III: Reign of Chaos — Demo

App id `warcraft3_demo` (`lib/apps.js`), install tree at
`test/binaries/candidates/warcraft3-demo/`. Provenance is in
`test/candidate-corpus/manifest.json`.

## Ordinary browser software control, 8 October 2026

Fresh guest OpenGL **software** execution on the accepted reference
`f62ab3c9` / module `4dc5ac2c` reaches the original Prologue, selects Thrall
(Level 1 Far Seer, 500/500 health, 285/285 mana), and obeys two opposing
ordinary right-click move orders. Worker reviewed selection, move, return and
settled final images against fixed hut, stone circle and rocks. Both live host
and owning render Worker report `api: gl, backend: software`; pinned software
context creation returns before WebGL creation. Chrome SwiftShader alone is
not this proof. Coordinator review/integration is pending; no current-main
build, FPS, audio, combat or completion claim.

Run `scratch/runs/20261008T0400Z-warcraft3-software-runtime` retains all 542
pins, twelve original media paths, ordinary trusted input receipts and 28
screenshots. Original menu coordinates match the reviewed WebGL route:
Single Player (594,327), ABC, Create (228,391), Select (226,542), Campaign
(593,365), Prologue (473,373). Separate hover and five-second DOWN/UP are
used, with actual image review before each action; first clicks can merely
highlight. Chapter PRESS ANY KEY is visible at 04:07:01.117. Space held for
2000 ms gives an immediate black transition; next capture already shows the
gameplay HUD, so no Escape is sent into that HUD. Filenames do not determine
scene identity. Select Thrall (255,524) with a reviewed second click, then
right-click (375,430) and (220,480); fixed camera landmarks establish actual
displacement, retained at 04:14:30.715. Pointer Lock is false before absolute
input. No guest-state write or engine repair.

Fresh no-env boat `bx_mw27w2n4`, immutable 240/900/90-second transfer/browser/
cleanup budgets. Ordinary quit at 04:14:42.001 precedes 04:15:55 deadline;
Chrome exit 0, no pending streams, independent PID/socket/pin checks pass,
63 files retrieved/hash checked before prefix removal at 04:14:43.577.
[Exact identity, helper contracts, route deviations and lifecycle handoff](../../ops/handoffs/warcraft3-software-20261008.md).

## Shape of the program

| Module | Original base | Role |
|---|---|---|
| `War3Demo.exe` | `0x00400000` | launcher, window/GL setup — **and the import provider for `Game.dll`** (460 ordinal imports resolve back into the EXE) |
| `Game.dll` | `0x6f000000` | the engine: all 50 `OPENGL32.dll` imports live here |
| `Storm.dll` | `0x15000000` | Blizzard's MPQ/util library |
| `Mss32.dll` | `0x21100000` | Miles Sound System |
| `ijl15.dll` | — | Intel JPEG library |

Assets are `war3.mpq` plus `Maps/(4)Deadlock.w3m` and the Miles redists under
`redist/miles/`.

**Run it with `-opengl -window`.** The DirectX path wants `d3d8`, which the
emulator does not have, so the registry entry pins the GL command line.

## How to run it

`node test/run.js` cannot drive this app at all: it needs a GL context, and
`lib/gl-compat.js createContext` requires a `document`. Node has no WebGL, and
`npm install gl` (headless-gl) does not build here. The scripted harness is
**headless Chrome with software WebGL**:

```bash
node tools/profile-web-frames.js --app=warcraft3_demo --seconds=35 --swiftshader \
  --query='?debug' --screenshot=/tmp/wc3.png \
  --report-eval='document.getElementById("log").textContent.slice(-700)'
```

`--swiftshader` (added for this app) swaps headless Chrome's `--disable-gpu` for
`--enable-unsafe-swiftshader --use-gl=angle --use-angle=swiftshader`. Frame
pacing then measures the software rasterizer, so use it for functional runs, not
for numbers about how the game feels.

`--before-load` takes the script **source**, not a path — pass it as
`--before-load="$(cat probe.js)"`. A path is eval'd as an expression and fails
silently inside the harness's try/catch, leaving every probe global undefined.
It is how the GL traffic was measured without
adding a trace flag: wrap `GLCommandStream.Encoder.prototype.call` for an opcode
census, or `OpenGLCompat.OpenGLHostBridge.prototype.{createContext,makeCurrent,
deleteContext}` for the WGL lifecycle, and read the result back through
`--report-eval`.

### The menu walk, in guest pixels

The window is 940x700 and the GL drawable now matches it, so screenshot
coordinates *are* guest coordinates. That is not an assumption any more:
`sharedRenderer._exclusiveTransform` reads
`{srcX:0,srcY:0,srcW:940,srcH:700,dstX:0,dstY:0,dstW:940,dstH:700}` with the
canvas at 940x700, i.e. identity, so a film pixel maps to a guest coordinate
with no arithmetic. (`--query='?debug'` is what gives the film clip
`{x:10,y:162,width:940,height:700}`; with any other query the clip is wrong
and every coordinate read off the picture is off by that offset.)

**Read the labels with `--gain`, and stop navigating by panel art.** The text
is drawn near-black (`#00000e`), which is invisible on a full frame and easy to
mistake for "no text", but it is *there* and one flag lifts it:

```
node tools/png-crop.js FRAME --rect=650,110,290,560 --scale=2 --gain=14 --out=panel.png
```

That renders the Single Player panel as plain black-on-blue and the whole menu
becomes readable. This is not a nicety: four separate walks in this session
clicked 805,425 believing it was Campaign — it is Custom Game, the fourth row —
and burned about an hour each on the interstitial that follows. One `--gain`
crop of any menu frame settles which row is which in seconds.

| Screen | Control | Guest x,y |
|---|---|---|
| Main menu | Single Player | 805,165 |
| Single Player Profiles | new-profile edit (already focused) | 135,253 |
| Single Player Profiles | Create | 298,253 |
| Single Player Profiles | profile list, first row | 190,330 |
| Single Player Profiles | Delete | 90,460 |
| Single Player Profiles | Select | 298,460 |
| Single Player | Campaign | 805,218 |
| Single Player | Load Saved Game | 805,287 |
| Single Player | View Replay | 805,357 |
| Single Player | Custom Game | 805,425 |
| Single Player | back (bottom plate) | 805,600 |
| Campaign | Prologue: Exodus of the Horde | 750,230 |
| Campaign | Human / Undead / Orc (all "Not Available In Demo") | 750,300 / 370 / 440 |
| Campaign | Difficulty dropdown ("Normal") | 240,581 |
| Campaign | Back | 795,663 |

The Campaign screen is the one place the demo says out loud what it is: at
`--gain=6` the four campaign rows under Prologue all read **"Not Available In
Demo"**, so Prologue is the only mission in the build and there is no other
route into a map.

**Custom Game opens a full-screen black panel first** — logo, two gameplay
screenshots, and one `OK` button at 470,610 — which appears on the very next
filmed frame after the click. That is the demo's own interstitial. Its body
text is **not drawn at all**: at `--gain=14` the panel is exactly `#000000`,
unlike the menu labels, which are drawn and merely dark. Two different
symptoms, so do not assume one cause.

**Campaign runs the emulator out of virtual-map records.** Clicking it clears
the menu panel, runs for ~35s and then puts up the game's *own* box, "This
application has encountered a critical error". Three runs named three different
sources — `FileCache.cpp:490`, `CControl.cpp:813`, `Object: .PAVCListBoxItem@@`
— and the disassembly of Game.dll `0x6f443f10` plus the eight
`push 0x6f54ad78` sites says all three are one failure: the allocation shape is
`push <source-file>, push <size>, call 0x6f408276` (a `jmp [0x6f4ec32c]` thunk
into Storm's SMemAlloc) followed by `test eax,eax`, so the file and line in the
box name the *caller* of the allocator, not the fault.

Measured with a host-side sampler on `VIRTUAL_MAP_STATE` (run T, 2026-09-11):
live map records climb 113 (2s) → 1874 (41s) → 1956 (101s) → **2048 (181s)**,
after which every cursor freezes and the box follows. At that moment the
backing pool holds **36.3MB of 316MB** and the reserve cursor is at
`0x40eb0000`, nowhere near `VIRTUAL_ALLOC_MIN`. So the guest is not out of
memory at all — it ran out of *records*, at the `MAX_VIRTUAL_MAPS` bound in
`src/10-helpers.wat`. Storm asks the OS for its arena in thousands of small
pieces (~18KB average) and nothing coalesces them, because only the map that
owns the backing bump can be extended in place.

**Do not read the map count as a memory figure**, and do not read the file name
in the box as the failing subsystem; both have sent this investigation down the
wrong path once already. Earlier notes here claimed the campaign was a *data*
gap on the theory that `war3.mpq` carries no campaign maps. That was wrong:
extracting `(listfile)` lists `Maps\Campaign\Demo01.w3m` … `Demo05.w3m`. The
earlier miss was a hash-table probe against guessed stock map names.

A profile is **required** — the Single Player menu is not reachable until one
exists. The new-profile edit box already carries the caret when the screen
appears, so no click is needed before typing; `Create` then `Select` (not
`Delete`, the left button) gets past it. None of this trapped on an
unimplemented API, so the IMM32 work in gap 7 covered the whole text path.

Hold every click for seconds, not milliseconds — under SwiftShader the guest
can take that long to sample the button. `$S/run-e.sh` is the whole walk in one
`--guest-script`.

## State: the campaign loads

**2026-09-11, later.** Campaign → Prologue: Exodus of the Horde now reaches
**Chapter One: Chasing Visions** — the parchment chapter map with the red X on
Lordaeron and a LOADING bar that advances steadily (film the bar and diff the
strip at 230,610 480x26 against the last frame: the difference shrinks
monotonically, which is how "slow" was told apart from "stuck"). Under
SwiftShader on a loaded box the bar takes minutes, so budget `--seconds=800`,
not 200.

Two emulator bounds had to go first, and neither was a memory shortage:

1. **`MAX_VIRTUAL_MAPS` 2048 → 8192** (`src/01-header.wat`, with
   `VIRTUAL_MAP_TABLE` 0x8000 → 0x20000). Storm asks for its arena in thousands
   of ~18KB pieces; the record count hit 2048 at 181s with 36MB of the 316MB
   pool spent, and every allocation after that returned NULL.
2. **The reserve cursor had to become reclaimable.** `$virtual_reserve_down` was
   a one-way bump: WC3's load churns reserve/release at ~5MB/s of address space
   and walked it from `0x50000000` to `VIRTUAL_ALLOC_MIN` in six minutes, with
   74MB of 316MB in use. `$virtual_reserve_reclaim_locked` now raises the shared
   cursor back to the lowest range still owned on every MEM_RELEASE. It needed a
   table of uncommitted reservations (`VIRTUAL_RESERVE_TABLE`, count at
   `VIRTUAL_MAP_STATE+16`) because a MEM_RESERVE with no commit has no map
   record — **WC3 reserves a range, commits parts of it, and holds ~950 such
   reservations at once**, so the first cut of this (remember one floor, clear it
   when a commit covers it) reclaimed exactly nothing. Measured after:
   `maps=5034 used=73.2MB holes=15075 res=935 vtop=0x37570000` at 510s, against
   `vtop=0x10000000` and a crash box before.

3. **The best-fit pass had to stop being O(records²).** With both bounds gone the
   load stopped crashing and started *freezing*: run AC went silent at 516s with
   `maps` flat at 5030 and the hole counter climbing ~120 every 2s, i.e. ~60
   release/commit pairs a second. `virtual_map_commit_locked` re-derived the free
   extents from `VIRTUAL_MAP_TABLE` on every commit — candidate boundaries
   crossed with every record — so at 5000 records that is ~25M record pairs per
   commit and ~1.5 G iterations a second, more than a core has. Free extents are
   tracked directly now (`VIRTUAL_HOLE_TABLE`, count at `VIRTUAL_MAP_STATE+12`,
   coalescing insert and best-fit take in `src/10-helpers.wat`); the placement
   policy is unchanged, only the cost. The coalescing is what makes it cheap in
   practice as well as in theory: the listed-hole count sits at **0-15** through
   the whole load instead of the 15075 the old counter reached, because adjacent
   extents merge back into the wilderness as fast as they are freed.

With all three in, the LOADING bar **completes**: at 330s the briefing screen is
up — the parchment map, "Chapter One: Chasing Visions", "Somewhere in the Arathi
Highlands, Thrall, the young", and `PRESS ANY KEY TO CONTINUE` — and stays
byte-identical from f033 (340s) to f047 (480s), so the load is finished rather
than merely slow. Peak state at that point: `maps=5845 used=86.9MB holes=3
res=1019 vtop=0x31e40000`.

### Next blocker: dismissing the briefing calls through a dead pointer

Clicking `PRESS ANY KEY TO CONTINUE` (guest 470,626) **is** accepted — the
click's WM_LBUTTONDOWN goes in and the guest never delivers the matching
WM_LBUTTONUP, because it stops in between. What stops it is EIP going to zero:

```
--- Program exited --- last block 0x00418bf2, before it 0x00418be0
    eax=0x00000000 ecx=0x445a00b0 edx=0x074ff690 esi=0x00000004
```

`0x418be0` is War3Demo.exe's export #482 (`Hm`), imported by Game.dll as
ordinal 482 and called from 117 sites, so the caller is not identifiable
statically. It is a two-instruction virtual dispatch:

```
00418be0  push ebp / mov ebp,esp / test ecx,ecx / jnz 0x418bf2  ; null `this` guarded
00418bf2  mov eax,[ecx] / push esi / mov esi,[ebp+8] / push esi / push edx
00418bfa  call [eax+0x28]                                        ; slot 10
```

`this` is non-zero, so the guard passes, but `[ecx]` reads **0** — the object's
vtable pointer. `ecx` is `0x44xx00b0`: inside the sparse `VirtualAlloc` arena,
above the reserve cursor, and the high half moves run to run while the low
`0x00b0` does not, so it is a real allocation's `+0xb0`, not a constant. An
unmapped guest read returns 0 through the NULL sentinel, so "the object was
freed" and "the object is there and zeroed" look identical from the registers;
`scratchpad/deadprobe.js` classifies the address against
`VIRTUAL_MAP_TABLE`/`VIRTUAL_RESERVE_TABLE` to tell them apart. Note the
allocator reclaim landed in the same session, so address-space **reuse** is new
behaviour and is the first thing to rule in or out here.

Keys are not the way in: six WM_KEYDOWN taps of VK_SPACE changed nothing on
that screen (run AE), and our `TranslateMessage` posts no WM_CHAR, so `key:`
actions now send the character too. The click is what the screen answers.

What released it, measured with `--trace-api=VirtualFree` (whose browser trace
now also prints `ret=`, the return address off the guest stack, so a call site
can be named at all): exactly one `VirtualFree(0x44510000, 0, MEM_RELEASE)`
from `ret=0x1502220a` in Storm. That is **Storm's own heap purge** at
`0x150221a0` — 256 iterations over a per-bucket list at `0x150481c0`, releasing
every node whose in-use count at `[node+0x14]` is zero and whose size at
`[node+4]` is below `0x80000000`. So Storm believed the page was empty. The
page had been a live 4KB record from 214s to 254s (`deadprobe.js` keeps a
first/last-seen history of every record base for exactly this question), and
the fatal use came ~90s after the release. The open question is therefore
upstream of the allocator: why the in-use count reached zero with an object
still in the page.

Reproduced across three runs, and the address moves with allocation order:
runs AN/AO named `ecx=0x445100b0`, run AQ `ecx=0x444f00b0`. Every run says the
same three things — the covering record was 4KB, it was live for roughly the
same 40s window in the middle of the load, and at death the address is
`UNMAPPED` with the nearest live records tens of KB either side, i.e. it was
never re-handed to anyone. That last point is what **exonerates the allocator**:
a reclaim bug would show the page handed to a second owner, not left empty.

**The gated leak experiment.** `set_virtual_leak_small_releases(N)` (export,
default 0, no product caller) turns a `MEM_RELEASE` of a region ≤ N bytes into
a no-op that still reports success. It is a diagnostic, not a fix — it hands
the guest memory it gave back — but it is the cheap decisive test of "is this
one use-after-free the only thing between the briefing screen and gameplay",
because the stale read then returns the object's old bytes the way it usually
would on real Windows. The cost bound is small: the whole run makes ~2475
`VirtualFree` calls, so leaking every small one is ≈10MB of the 316MB pool.
Arm it from `deadprobe.js` (`globalThis.__leakSmall`), not `--after-launch`:
the latter fires before the wasm instance necessarily exists and the setter
call is then silently lost.

### What the dangling pointer actually is: a destroyed `OsNet::NETCONN`

Measured 2026-09-12, and this replaces the guesswork above about the allocator.
`scratchpad/deadprobe.js` now walks the registry the crashing code walks —
game.dll `0x6f5c8694` is the head of a list (next `+8`, key `+0xc`), and the
branch that dies picks the node whose key matches, checks `[node+0xe8] == 6`
and dispatches through `[[node+0x100]+0x38]`. Sampling those fields every two
seconds gives the whole life of the object, and it is the same story in five
runs (the addresses move with allocation order, nothing else does):

```
[list] 202s net=1 node=0x439f00b0 state=4 owner=0x43a100b0 target=0x439b00b0 BACKED
[list] 210s net=1 node=0x439f00b0 state=6 owner=0x43a100b0 target=0x439b00b0 BACKED
[list] 258s net=0 node=0x439f00b0 state=6 owner=0x43a100b0 target=0x439b00b0 UNMAPPED
[list] target 0x439b00b0 went UNMAPPED.
       alive bytes=[d8 56 44 00 ff ff ff ff 34 01 e2 43 ...]
       bytes now  =[a4 56 44 00 ff ff ff ff 00 00 00 00 ...]
```

**The object was destructed, not lost.** Its vtable word goes from `0x4456d8`
to `0x4456a4` — the base-class vtable — and its members are zeroed, which is
what a C++ destructor does on the way out. So the allocator is exonerated
twice over: the page is never re-handed to anyone, and the guest itself ran the
destructor. The bytes are readable after the record is gone because the probe
remembers the backing address while the record still exists.

**Who destroyed it.** A new passive facility answers this: hit-counter slot 0
now also records `$dbg_prev_eip` and four return addresses walked off EBP at
the moment it fires (`get_hit0_first_caller` / `get_hit0_frame(1..4)` in
`13-exports.wat`). A vtable call has no static caller at all — `xrefs.js`
returns nothing for the deleting destructor — so this is the only way to name
the edge. Armed at War3Demo.exe `0x413a06`:

```
dtor hits=2  frames=0x00412a6e 0x0089a362 0x0091358f 0x008d6be5
             (= exe 0x412a6e, game.dll 0x6f339362 / 0x6f3b258f / 0x6f375be5)
```

Reading that chain outward:

- exe `0x4139a0` walks a list at `[edi+0x70]` and calls each element's deleting
  destructor then a Storm free tagged with the RTTI string at `0x44c15c` —
  `.?AVNETCONN@OsNet@@`. These are **network connection objects**.
- exe `0x412a58`-ish is `OsNetDestroy(flags)`: `dec [0x454c0c]`, and only when
  that per-subsystem refcount reaches **zero** does it call `0x4139a0`.
- game.dll reaches it through exe ordinal 4 (`0x401490`), from `0x6f339320`.
- game.dll `0x6f3b2520` is where the decision is made. It builds the path
  `…\Save\WorldEdit\Campaigns.w3v` (strings `0x6f5824b4` + `0x6f57f764`), calls
  **exe ordinal 359** (`0x411080` — `GetFileAttributes`, return 0 if `-1` or if
  `FILE_ATTRIBUTE_DIRECTORY`), and on **0** calls `0x6f3b2880`, which is the
  frame that ends in the teardown.

`tools/pe-exports.js` is new and is what turns `pe-imports.js`'s "ordinal 359"
into an address; Game.dll binds all ~300 of its calls into War3Demo.exe by
ordinal, so nothing else can name them.

**The refcount never reaches 2.** The probe prints `net=` (that same
`0x454c0c`, and the exe loads at its image base so the runtime address is the
VA): it is 0 for the whole menu, 1 from the moment the campaign session is
created, and 0 at the teardown. So this is one balanced init/destroy pair, not
a lost `AddRef` — which is why patching the allocator cannot help.

**The leak diagnostic is a dead end for this, and here is why, so nobody
repeats it.** `set_virtual_leak_small_releases(N)` and the narrower
`set_virtual_leak_release_caller(RET)` keep a released region mapped so the
stale read returns the old bytes. Blanket leaking crashes the *load* earlier
than the bug it was meant to test (`MDLGENOBJECT`, then
`NTempest::C3Vector`), because `$virtual_map_commit_locked` will happily split
a request against a still-listed record and hand one guest range two backings —
Storm re-commits a base three operations after releasing it (measured with the
new `tools/vmem-reuse.js`: `op#219 0x4f660000` freed at `op#216`, both from
`storm+0x20328`). Commit now ends a leak for real before touching the range,
which fixes that, and the target does stay `BACKED` past the teardown — but the
object is still a *destructed* one with zeroed members, so calling its slot 10
is no better than reading zero. **The object must not be destroyed at all; a
diagnostic that keeps its corpse readable cannot reach gameplay.**

Keys are not a way around it either: `key:32` (WM_KEYDOWN + WM_CHAR, which our
`TranslateMessage` now produces) dies at exactly the same `0x418bf2` with the
same dangling `ecx`, so the click and the key take one path.

Next question, and it is a guest-logic one: `0x6f3b2880` is reached because
there is no `Save\WorldEdit\Campaigns.w3v` — and a fresh install has none, so
this branch runs on real hardware too. Either the game gets there in a state
where the session refcount is higher, or something earlier in our load already
ended the mission. Its first two guards (`0x6f334120`, `0x6f3333e0`, both
"nonzero ⇒ skip everything") are where to look next.

**Custom Game is not a way around it.** The demo's interstitial (logo, two
screenshots, one OK button at 470,614) is a dead end: clicking OK returns to
the Single Player menu rather than opening a map list. Campaign is the only
route to gameplay in this build.

## State: the menu navigates

**2026-09-11.** The 3D menu scene, the logo and the panel frames draw at the
window's real size, and the menu *walks*: a click at the measured pixel for
Single Player (guest 805,165, held 4s) reaches the **Single Player Profiles**
screen — new-profile edit box already carrying the caret, profile list, and
the two panel buttons at the bottom. Two fixes got it there, both below in
"Emulator gaps": the GL drawable now follows the window (6), and the rest of
the IMM32 surface Game.dll imports is implemented (7) — that one was a hard
trap, `[unimplemented: ImmGetOpenStatus]`, the moment the menu changed screen.

Menu *text* is drawn but near-black; see the CORRECTION section below. It is a
colour bug on one pass of the glyph/drop-shadow pair, not missing geometry,
and it does not block navigation as long as the coordinates come from the
panel art rather than from reading a label.

### What the missing text is NOT

Measured, so nobody redoes it:

- **Not a missing GL entry point.** All 50 `OPENGL32` imports are implemented,
  and `wglGetProcAddress` is asked for **nothing** in a 35s run, so no extension
  path is involved.
- **Not a texture-format problem.** Every upload is `format=GL_RGBA`,
  `type=GL_UNSIGNED_BYTE`; the internal formats vary (`RGB5`, `RGBA4`,
  `RGB5_A1`, `RGBA8`) but WebGL 1 *requires* internalFormat == format, so
  ignoring the guest's internal format is correct, not lossy.
- **Not a wrap-mode problem.** WC3 uses `GL_CLAMP` (invalid in WebGL) 96 times;
  `texParameter` already maps it to `CLAMP_TO_EDGE`.
- **Not `GL_QUADS`.** `normalizeImmediate` lowers quads, quad strips, fans,
  strips and polygons to independent triangles.
- **Not WebGL rejecting anything.** `gl.getError()` sampled at every present
  across a full run: zero errors.
- **Not GDI.** Zero `CreateFont*`/`TextOut*`/`CreateDIBSection` calls — WC3
  rasterizes its own glyphs, so the text is GL geometry.
- **Not "never submitted".** A `_drawGeometry` histogram shows **110 draws of
  1-6 vertices** per run, all textured, alpha-tested, blended, vertex colour
  white `(1,1,1,1)`. That is what glyph quads look like. The geometry reaches
  the backend.

So it is a **shading/state** bug, not a missing feature.

### Ruled out: lighting and material

A previous note here guessed that the text quads were shaded by the *material*
because `GL_LIGHTING` was on and `GL_COLOR_MATERIAL` off. **That is wrong and is
recorded here so nobody re-runs it.** A probe that identifies the glyph atlas by
its 256x256 `glTexSubImage2D` uploads and then dumps the full shading state of
every draw that *binds that texture* reports, on all ten sampled text draws:

```
lighting: false      colorMaterial: true    alphaTest: true (GEQUAL 0.0157)
blend:    true       texMode: GL_MODULATE   material: ambient/diffuse all 1,1,1,1
```

None of that is wrong. Lighting is not involved in the text path at all.

### The atlas is not empty

Also measured, because "the glyphs were never rasterized" is the other cheap
explanation. `fonts\frizqt__.ttf` (62,316 bytes) is in `war3.mpq`, and eight
256x256 `glTexSubImage2D` uploads grow the count of non-zero-alpha texels
421 -> 520 -> 488 -> 602 -> 1007 -> 1199 -> 1330 -> 1471, with anti-aliased alpha
ramps (18, 19, 22, 28, 59, 85, 109, 124, 142, 161, 170). A max-pooled ASCII
thumbnail shows glyphs packed into the top two rows of the 256x256 sheet. The
font really is rasterized into a texture.

### CORRECTION (after the drawable fix): the text is not missing, it is black

With the GL drawable finally the size of the window (gap 6 below), the menu
renders whole and the button labels **are on screen** — "Single Player" is
legible on the top plate. They are rendered in near-black instead of gold:

```
node tools/png-crop.js  frame.png --rect=680,140,250,60 --scale=3 --out=btn1.png
node tools/png-stats.js frame.png --region=680,140,250,60   # the top button plate
  #00000e a=255  4579 px  30.53%     <- "Single Player", legible and near-black
  #040505 a=255   640 px   4.27%
node tools/png-stats.js frame.png --region=820,670,120,30   # "1.01 DEMO"
  #ffffff a=255   118 px   3.28%     <- same font path, drawn pure white
```

So the font atlas, the glyph quads, the blend and the alpha test are all
working, and "no text at all" was partly the clipped drawable hiding the half
of the menu that had the *white* text in it. What is left is a colour problem
on one of the two passes, not a missing-geometry problem. The note below is
kept because the alpha-0 measurement on the first vertex is still a real
reading — but it now has to explain glyphs that are **visible**, which alpha 0
cannot.

**The two measurements fit together, and the fit names the bug.** The draws come
in pairs, glyph + drop shadow, and *eight of ten* carried alpha 0 — not ten of
ten. So the surviving near-black glyphs are the **drop-shadow** pass, which sets
its colour explicitly (opaque black), and the missing gold is the **glyph** pass,
which does not: it relies on the engine's current colour, and that is the scratch
at `0x6f5b1df8` which is zero-init BSS and reads `0x00000000` — transparent
black — unless `0x6f0c0f80` has run. Which is exactly the lead below, now with a
picture that predicts it rather than one that contradicts it. The measurement to
take is still a runtime hit count on `0x6f0c0f80`, and
`tools/profile-web-frames.js --count=game.dll+0x6f0c0f80` can now take it.

### Open: the text quads carry vertex alpha 0

The live signal. The same probe records the first vertex of each atlas-bound
draw; the draws come in pairs (glyph + drop shadow) and eight of ten carry
**alpha 0** in the vertex colour:

```
[1,1,1,1] [1,1,1,1] [0,0,0,0] [1,1,1,0] [0,0,0,0] [1,1,1,0] ...
```

Under `GL_MODULATE` the fragment alpha is `texture.a * vertexColor.a = 0`, and
the alpha test is `GEQUAL 0.0157`, so **every glyph fragment is discarded**.
That is exactly "the quads are drawn and nothing is visible". Several of those
same draws also carry degenerate texture coordinates (`uv0 = uv1 = 0,0`), so two
per-vertex attributes are wrong together, which points at the client-array read
path rather than at a state bug.

Ground truth from `Game.dll`, so the guest's side of the contract is not in
question. The batched array draw at `0x6f0c1977` is:

```
glVertexPointer  (3, GL_FLOAT,         36, base+0x00)
glNormalPointer  (   GL_FLOAT,         36, base+0x0c)
glColorPointer   (4, GL_UNSIGNED_BYTE, 36, base+0x18)
glTexCoordPointer(2, GL_FLOAT,         36, base+0x1c)
glEnableClientState(GL_NORMAL_ARRAY); glEnableClientState(GL_COLOR_ARRAY)
glEnable(GL_COLOR_MATERIAL)
glDrawElements(mode from table 0x6f55e184, count, GL_UNSIGNED_SHORT, indices)
```

so the vertex is 36 bytes, `pos[3f] | normal[3f] | colour[4ub] | uv[2f]`, and
alpha is byte 3 of the colour. The second colour path (`0x6f0c1290`) packs a
separate tightly-strided (`stride 0`) colour array and byte-swizzles each source
dword to R,G,B,A before drawing, so alpha is byte 3 there too. Our argument
order and our `stride || size*bytes` default both match.

**Our reader is not the bug.** `test/test-opengl-wc3-interleaved-arrays.js`
replays exactly that layout through `GLCommandStream.Encoder` in Node -- stride
36, colour as normalized unsigned bytes at +0x18, uv at +0x1c, indices out of
order -- and every position, colour (alpha included), texcoord and normal
arrives at the backend intact. The same test pins the state rule that decides
whether text can be visible at all: with `GL_COLOR_ARRAY` disabled the vertices
must take the GL default opaque white, not the colour left over from the
previous indexed draw. Both pass, so the encoder is cleared by measurement.

That leaves the upstream answer: the guest really does have alpha 0 in those
arrays. The engine's "no colour array supplied" default is a 4-byte scratch at
`0x6f5b1df8` -- zero-init BSS -- set to `0xFFFFFFFF` by the one-instruction
function at `0x6f0c0f80`, which is reachable only through the function-pointer
table at `0x6f5469f0`. If that entry never fires under emulation, every
default-coloured batch is transparent black, which is exactly the `[0,0,0,0]`
draws. Next step is a runtime hit count on `0x6f0c0f80`, not more GL work.

## Harness notes

- `tools/profile-web-frames.js --film=DIR[:everySec]` (added for this app)
  writes a numbered PNG of the emulator canvas every few seconds across the
  whole run, so one run shows a menu transition instead of a single
  end-of-run screenshot. `node tools/filmstrip.js --dir=DIR --open` tiles them
  into one contact sheet. An in-page `setInterval` cannot do this job -- the
  emulator's step chain starves it, and a run filmed that way returned one
  frame out of fifty.
- `--count=game.dll+0xVA[,...]` (added for this app) arms the emulator's own
  native hit counters from the page and prints `Hit counts:` at exit — the
  `--count` flag `test/run.js` has always had, made reachable for a guest that
  **only** runs in a browser. Anything on the GL path is in that category:
  `lib/gl-compat.js`'s `createContext` needs a `document`, so `node test/run.js`
  cannot run this app at all and "is this function ever reached?" had no
  answer. Module bases come from the PE loader's own DLL table
  (`get_dll_table`/`get_dll_count`), not from `wine.moduleMap`, which only
  holds what went through `LoadLibrary` and so never has a statically imported
  DLL; the resolved runtime address and the image's original base are both
  printed, so a relocated module is visible rather than silently off.
- `--guest-click=X:Y@atSec[:holdSec]` — the hold is the second half. A press is
  only as long as the *guest's* clock makes it, and under `--swiftshader` on a
  loaded box the emulated machine can take seconds per frame; a game that
  samples the button once a frame never sees a 400ms press that went down and
  up between two samples. The default is still 400ms.
- `--guest-script=ACTION,ACTION,...` (added for this app) is the one ordered
  walk: `click:X:Y@delaySec[:holdSec]`, `type:TEXT@delaySec[:secPerChar]`,
  `key:0xVK@delaySec[:holdSec]`, each delay measured from the end of the
  previous action. `--guest-click` and `--guest-key` cannot express a menu
  walk between them — each is its own loop, so the *last* click of a walk
  always fires before the *first* keystroke, and a profile screen needs
  click, then type, then click. `type:` sends WM_KEYDOWN, **WM_CHAR** and
  WM_KEYUP per character: an engine with its own edit box (WC3 has one) takes
  the character off WM_CHAR, and a virtual-key code is not a character.
  `key:` now sends the character too (`key:VK[/CHAR]`, CHAR defaulting to VK,
  which is already right for space, Return and the letter/digit keys) for the
  same reason and one more: **our `TranslateMessage` does not synthesize
  WM_CHAR.** `$handle_TranslateMessage` (`src/09a5-handlers-window.wat`)
  returns the documented boolean and posts nothing, so the WM_CHAR a real
  USER would derive from the app's own pump can only come from the host —
  `renderer.handleKeyPress` queues it. A `key:` action without it delivers a
  down/up pair a "press any key" screen may never see.
- `node tools/png-crop.js FILE --rect=X,Y,W,H --gain=N` (added for this app)
  multiplies each channel before writing, so text drawn near-black on black is
  legible instead of invisible. It saturates rather than wrapping, so a lifted
  crop answers "is anything written here at all" and `png-stats.js --region`
  still answers "what colour exactly". It is how the black panel behind Custom
  Game was shown to be **pure** `#000000` — no text was drawn there, as
  opposed to the menu labels, which are drawn and merely dark.
- **Check `uptime` before believing any run.** At load 78 the guest never left
  its loader in 99 seconds and the film is 33 frames of empty desktop. Runs
  that reach the menu were taken at load 5-15.

## Emulator gaps this app found

Each of these was a real bug, found by measurement rather than by reading:

1. **`MAX_SYNC_OBJECTS = 512` was exhausted.** `War3Demo.exe` deliberately
   pre-creates 2048 events at `0x00402000`; past 512 every `CreateEventA` and
   the 1.2M following `CreateMutexA` calls returned 0. Raised to 4096 across
   `$SYNC_TABLE`, `lib/thread-manager.js` and `lib/guest-rpc.js` — the three
   must stay in step.
2. **SEH disposition 0 was fatal.** Miles raises `MS_VC_EXCEPTION`
   (`0x406D1388`) to name a thread; its filter returns
   `ExceptionContinueExecution`, and the `CACA000E` continuation thunk only
   handled `ContinueSearch`, so the app died in `ExitProcess(0x406DDF88)`.
   `$handle_RaiseException` now records `$delphi_resume_eip`/`_esp` before its
   stdcall cleanup and the thunk resumes there.
3. **No I/O completion ports.** Implemented for real (`$IOCP_TABLE`, 8 ports ×
   256 entries) in `src/09a7-handlers-dispatch.wat`, with
   `GetQueuedCompletionStatus` parking through the standard blocking-API
   pattern (`$iocp_block`).
4. **Missing GL/WGL entry points**: `wglSwapLayerBuffers`,
   `glDisableClientState`, then `glTexCoordPointer`, `glColorPointer`,
   `glDrawElements`, `glGetIntegerv`, `glReadBuffer`. `glDrawElements` is
   compiled into an immediate-mode span by `GLCommandStream.Encoder` so the
   guest's client pointers are read at call time.
5. **`SetPixelFormat` refused its second call** — the one that mattered. This
   was the blocker behind "runs but shows nothing": WC3 runs its whole GL setup
   *twice* on window `0x10001`, the second time for the resolution it settled
   on. Our implementation failed any repeat call, so the second
   `wglCreateContext` never happened and 18,682 `glDrawElements` per run went
   into a context the guest had already destroyed. Windows refuses a *change*
   of pixel format, not a repeat of the same one; `$gdi_pixel_format_set` now
   matches.
6. **The GL drawable never followed the window.** `lib/gl-compat.js`'s
   `createContext` sized the canvas from the window's client rect once and
   nothing resized it ever again, so an app that resizes its own window
   afterwards draws into a surface the size the window used to be. WC3 does
   exactly that — the startup sequence above is `ctx1 ; SW_MINIMIZE ;
   SW_MAXIMIZE ; ctx2`, and the maximize takes the client area to the whole
   desktop. Measured: `glCanvas [800,600]` while the guest's own
   `glViewport` was `0,0,940,734`. **A viewport larger than the drawable is
   clipped, not scaled**, so what reached the screen was the corner of a menu
   laid out in 940×734 — the logo, the version string and the lower half of
   the button column were simply outside the surface. It also invalidated
   every coordinate measured off a screenshot, which is what four filmed
   menu-click runs were really failing on. Fixed by
   `OpenGLHostBridge._syncDrawableSize()`, called *after* each present
   (`resetRenderTargets` reallocates the attachments, so doing it mid-frame
   discards the frame the guest just drew); a failed reallocation keeps the
   old surface and the next frame retries.
   `test/test-opengl-drawable-follows-window.js` covers it browser-free.
7. **The rest of IMM32.** With the menu finally clickable, Single Player traps
   on `[unimplemented: ImmGetOpenStatus]` — the screen has a text field, and
   `Game.dll` imports eight IMM32 entry points to set it up (`pe-imports.js
   Game.dll --dll=imm32`). Three existed; the other five plus
   `ImmGetCandidateListA` are now implemented as the documented results for the
   NULL context this no-IME machine's `ImmGetContext` already returns.
   `ImmGetCompositionStringA` returns `IMM_ERROR_GENERAL` (-2) and not 0 — its
   return is a byte *count*, so 0 would claim an empty composition string and a
   valid buffer — and `ImmGetConversionStatus` deliberately leaves its two
   output DWORDs untouched, which is what a failing call does on Windows.
8. **A suspended `AudioContext` deadlocked the whole guest.** For a stretch of
   2026-09-12 WC3 stopped loading at all in the browser: five consecutive runs
   produced identical blank frames and the page probe went quiet about 8s in.
   It was not the allocator, not the heap guards and not a source regression —
   all three were measured out. `--cpu-profile` and `--report-eval` report
   nothing here, because both need a CDP page evaluate and the main thread is
   blocked; a `console.log` heartbeat started before the freeze keeps printing,
   and that is what found it.

   The main guest thread sat at a fixed EIP for the whole run —
   `mss32.dll@0x00dcb000 (orig 0x21100000)` makes it **Mss32 `0x21113484`**:

   ```
   2111347f  e8 1c ec ff ff   call 0x211120a0      ; hand the buffer to waveOutWrite
   21113484  8b 4d 14         mov ecx, [ebp+0x14]
   21113487  f6 41 10 01      test [ecx+0x10], 0x1 ; WAVEHDR.dwFlags & WHDR_DONE
   2111348b  74 f7            jz short 0x21113484
   ```

   `ecx` was a live, mapped `WAVEHDR` whose `dwFlags` read `0x12`
   (`WHDR_PREPARED | WHDR_INQUEUE`), so this is Miles spinning on a submitted
   buffer — with its mixer mutex held, which is why every other guest thread
   was parked too (the Miles worker at `0x21101590` waits
   `WaitForMultipleObjects(2, {shutdownEvent, mutex}, FALSE, INFINITE)` and the
   mutex slot read owner=1, recursion=2).

   The completion never came: `wave_out_schedule_done` in `lib/host-audio.js`
   polls `getPos` against the AudioContext clock, and the probe caught the
   context going **`suspended` with `currentTime` frozen at 0.006** after 4
   bytes were submitted, one timer pending, forever. Headless Chrome is not
   launched with `--autoplay-policy=no-user-gesture-required`, and a real page
   the user has not gestured at yet does exactly the same thing. The poll now
   paces the completion off the wall clock whenever `ac.state !== 'running'`:
   nothing is audible either way, and Windows always returns the buffer. A
   guest-requested `waveOutPause` still holds it, which is correct.

   Generalizable: **a host-side completion that only ever fires off a clock the
   host may stop is a hang, not a dropped sample.** Any API whose guest caller
   spins rather than waits needs a wall-clock floor.

## The startup sequence to compare against

From `--trace-api=wglCreateContext,wglDeleteContext,wglMakeCurrent,
CreateWindowExA,DestroyWindow,GetDC,ReleaseDC,SetPixelFormat,ChoosePixelFormat,
DescribePixelFormat,ShowWindow`, a healthy run is:

```
CreateWindowExA -> 0x10001 ; ShowWindow ; GetDC ; ChoosePixelFormat ;
DescribePixelFormat ; SetPixelFormat ; wglCreateContext ; wglMakeCurrent(ctx)
  ... lights/fog/clear/present/finish, two frames ...
CreateWindowExA -> 0x10002 ; ShowWindow ; wglMakeCurrent(0) ; wglDeleteContext ;
ShowWindow(0x10001, SW_MINIMIZE) ; DestroyWindow(0x10002) ;
ShowWindow(0x10001, SW_MAXIMIZE) ; GetDC ; ChoosePixelFormat ;
DescribePixelFormat ; SetPixelFormat ; wglCreateContext   <-- the second one
```

If that second `wglCreateContext` is absent, the game renders into nothing and
the screen never changes while the GL opcode census still shows tens of
thousands of draws. That divergence is the signature to look for.

## Ruled out

- **Not a decoder or asset problem.** `war3.mpq` loads, textures upload
  (`glTexImage2D` streams right after the first context dies), and the draw
  stream is well-formed the whole time.
- **`wglGetProcAddress` returning 0 is not the blocker.** The game asks, gets
  nothing, and proceeds on the fixed-function path.

## The near-black menu text: it is the guest's own colour, not our pipeline

Measured 2026-09-12 with three browser probes over the main menu (all
`--headful`, real GPU; headless without `--swiftshader` renders nothing at all).

Every string in the menu arrives at `FixedFunctionGL.enqueuePacked` as **two
draws over the same font atlas**, back to back, one pixel apart:

```
n=156 v=9204 box=-73,-17,74,-1  col[0,0,0,1]                    bound=61
n=156 v=9204 box=-74,-16,73,0   col[1,1,1,1  1,0.8125,0.0625,1] bound=61
```

`1, 0.8125, 0.0625` is WC3's UI gold (#FFD010). Both draws carry byte-identical
state: alpha test `GEQUAL 0.0157`, blend `SRC_ALPHA / ONE_MINUS_SRC_ALPHA`,
texenv `MODULATE`, lighting off, depth test `GL_ALWAYS` with the **depth mask
off** — so depth cannot reject the later pass. Texture 61 is a 256x256 atlas
created empty and filled by `glTexSubImage2D` with **white** texels
(`maxRGBA 255/255/255/255`), so `MODULATE` by gold is gold.

Two forcing experiments settle what is actually on screen. Both hook
`enqueuePacked` and key off "every vertex colour is exactly (0,0,0,\*)":

| experiment | result |
|---|---|
| drop every all-black draw | the menu labels **vanish entirely** |
| repaint every all-black draw gold | a clean, correct **gold menu**, readable at `--gain=1` |

So the black geometry *is* the text that reaches the screen, the gold pass
contributes nothing visible anywhere, and our raster path renders the glyphs
perfectly the moment the colour is right. The remaining question is where
game.dll gets black from — and, secondarily, where the gold pass lands
(object-space boxes being equal says nothing; only the composed
`PROJECTION * MODELVIEW` does, and `glLoadMatrixf` between the passes flushes
the batch and can set a different one).

### Ruled out for the text, with the measurement that killed each

- **The default vertex colour.** game.dll's BSS scratch `0x6f5b1df8` — the
  4-byte cell `0x6f0c1646` redirects the colour pointer to when the caller
  supplies no colour array — already reads `0xFFFFFFFF` on the first sample.
  A probe poking it to white every 200ms performed **0 pokes**. (And Game.dll
  imports no `glColor*` at all, so every colour comes through
  `glColorPointer`; our own no-array default is `[1,1,1,1]`,
  `lib/gl-command-stream.js:321`.)
- **Texture format.** Every upload is `format=GL_RGBA / GL_UNSIGNED_BYTE`.
  `internalFormat` varies over `GL_RGB4/RGBA2/RGBA4/RGB5_A1`, all of which
  `_textureFormat` correctly collapses to RGBA. The `GL_INTENSITY (0x8049)` /
  `GL_LUMINANCE_ALPHA (0x190A)` hole in that four-way mapping is real but this
  app never hits it.
- **Depth rejection.** `GL_ALWAYS`, depth mask 0, on both passes.
- **A missing second pass.** Both are submitted; the census counts them.
- **Batching losing state.** Every non-packed GL call flushes `pendingDraw`
  first (`lib/gl-compat.js:1118`), so only consecutive packed draws merge.

## The campaign reaches PRESS ANY KEY — the map load does not stall

Measured 2026-09-12, `--headful`, walk

```
click 805,165 (Single Player) -> type "Hero" -> Create 298,253 ->
row 190,330 -> Select 298,460 -> Campaign 805,220 ->
Prologue: Exodus of the Horde 750,230 -> wait
```

At 561s the film shows the briefing fully rendered: the parchment world map,
the Horde crest, the red X on Lordaeron, "Chapter One / Chasing Visions /
Somewhere in the Arathi Highlands, Thrall, the young", and a full bar reading
**PRESS ANY KEY TO CONTINUE**. Text on that screen renders correctly at
`--gain=1`, so the black-text bug is specific to the menu font path.

Corrections to earlier notes in this file:

- **The load does not stall at ~2%/85%.** Runs that appeared to stall were too
  short. The load takes roughly 1900 guest frames after the Prologue click.
- **A click landing mid-load kills the guest.** runCF scripted its
  "PRESS ANY KEY" click by frame count and it fired at 440s while the bar was
  at ~85%; film frames go from 1,005,330 bytes to 5,377 (flat desktop teal) in
  one 5s step. The same walk without that click survived to the finished
  briefing. Pace the press off the briefing, not off a guess.
- **The VFS is not the blocker.** With
  `--trace-api=CreateFileA,GetFileAttributesA,CreateDirectoryA,WriteFile,DeleteFileA`
  and `window.__waTraceApiDetails = true` (there is no CLI flag for the
  argument decoding; without it host.js prints raw pointers), the guest
  successfully creates `C:\Save`, `C:\Save\Profile1`, writes
  `Campaigns.w3p` four times, and `CreateFileA`s
  `C:\Save\Profile1\Campaigns.w3v` with `CREATE_ALWAYS`. Every file call the
  documented `0x6f3b2880` SaveCampaigns teardown chain depends on goes through.

## Custom Game is blocked in the demo — it is not a second route to gameplay

Measured 2026-09-12 (runCQ, `--headful`). The idea was to skip the campaign
briefing entirely: a melee map loaded from **Single Player → Custom Game** never
shows a "press any key" screen, so it never touches the dismiss path below.

It does not work. Clicking Custom Game at `805,425` puts up a modal
immediately — two bordered gameplay screenshots above a single button — and
nothing else happens for the next two minutes. The button reads **OK**, which
is only legible after `node tools/png-crop.js … --gain=9`; at `--gain=2.5` the
label is invisible and the panel reads convincingly as a *loading screen* with
a progress bar stuck near zero. Two frames 95s apart differ by 19% of pixels
with a max channel delta of 36 — that is the animated grass in the background
border, not a bar filling.

So the demo gates Custom Game, and the campaign Prologue is the only door.
Worth knowing for the next person who has the same idea, and worth knowing that
**a WC3 dialog with unreadable text looks exactly like a stalled loading
screen**: lift the gain before concluding anything is loading.

## The subsystem refcount at `0x454c0c`, and why the briefing dismiss found a freed object

`War3Demo.exe` keeps a set of per-subsystem refcounts and a paired
init/shutdown pair that take a bitmask in `bl`:

| what | address | shape |
|---|---|---|
| init | `0x412880` | per bit: `inc` the count, and on the 0→1 edge call that subsystem's init (`0x413440` for bit `0x1`) |
| shutdown | `0x412a58` | per bit: `dec` the count, and on the 1→0 edge call that subsystem's teardown (`0x4139a0` for bit `0x1`) |
| bit `0x1` count | `0x454c0c` | `inc` at `0x4128bd`, `dec` at `0x412a5b` — the only two writers in the image |
| bit `0x10` count | `0x454c14` | teardown `0x413ab0` |
| bit `0x20` count | `0x454c18` | teardown `0x413de0` |
| bit `0x8` count | `0x454c08` | teardown `0x413930`, then `0x413900`, then `[0x455000] = 0` |

`0x455000` is the object those teardowns are called on; `xrefs.js` finds 30
references to it and exactly two stores, the constructor at `0x412892` and the
`mov dword [0x455000], 0` at `0x412a99`.

The count reaches **exactly 1** in a real run, so one unbalanced shutdown call
is enough to run the teardown and free everything under it.

The dismiss handler itself is at `0x418be0`:

```
00418be0  push ebp / mov ebp, esp
00418be3  test ecx, ecx
00418be5  jnz short 0x418bf2
00418be7  push 0x57 / call 0x442fac      ; the null case is handled
00418bf2  mov eax, [ecx]                 ; <- dies here
00418bf4  push esi / mov esi, [ebp+8] / push esi / push edx
00418bfa  call [eax+0x28]
```

It null-checks `ecx` first, so the crash is **not** a null `this` — it is a
stale non-null pointer. `find_fn.js` puts the entry at `0x418be0` and
`xrefs.js` finds no direct callers, so it is reached through a stored function
pointer.

### Two corrections to the earlier reading of this crash

- **There is no networking in this app.** A full 500s run with `--relay='.'`
  logged **zero** calls matching `wsa|socket|recv|send|connect|bind|listen|gethost|inet_`.
  Naming `0x444c00b0` an `OsNet::NETCONN` was a guess and should not be
  repeated; `0x454c0c` is a subsystem refcount, nothing more.
- **The probe was pressing the keys.** `scratchpad/deadprobe.js` fires up to six
  space presses of its own the moment the watched node reaches state 6. In
  runCO those fired at 254s–269s, while the profile and campaign menus were up
  and four minutes before the briefing existed. The refcount went 1→0 at 336s
  and the scripted press only arrived at 468s. A run whose probe types into the
  game cannot tell "the app does this" from "we did this", so runCO does not
  establish that the guest frees this object on its own. Re-run with the
  auto-press disabled before trusting the use-after-free.

### The pointer's whole life, as measured

```
242s  node appears, state 4, target 0x444c00b0 mapped, vtable 0x004456d8
254s  probe auto-press #1; state is now 6
336s  refcount 0x454c0c goes 1 -> 0
338s  target page UNMAPPED; first bytes were [d8 56 44 00 ff ff ff ff ...]
      and are now [0c 00 00 00 b4 00 bc 3c ...] — a freelist header
468s  scripted space press; 0x418bf2 calls through it, eip goes to 0
```

## The menu font is drawn twice, and only the shadow pass has texture coordinates

`Game.dll`'s `OPENGL32.dll` import list settles how this app draws anything —
50 entries, and **not one immediate-mode entry point**. No `glBegin`, no
`glVertex*`, no `glColor*`, no `glTexCoord*`. It draws with `glVertexPointer`,
`glColorPointer`, `glTexCoordPointer`, `glNormalPointer` and `glDrawElements`,
and `wglGetProcAddress` returns 0 in our layer (`lib/gl-compat.js:1111`), so it
has no multitexture or other extension path either.

Every vertex attribute in this app therefore comes through
`Encoder._arrayElement` (`lib/gl-command-stream.js:449`), which writes
`state.texCoord` **only** when `GL_TEXTURE_COORD_ARRAY` is enabled and a pointer
is set. Otherwise the vertex keeps the current `texCoord`, which for an app
that never calls `glTexCoord2f` is the initial `[0, 0]`.

That matters, because the two passes over font atlas 61 do not read alike:

```
[xf] tex61 col0,0,0,1 n78  cull=off winding=ccw  obj(-46,-16,0) w=1 ndc(0.61,0.5,0) uv(0,0.06) | obj(42,-1,0) uv(0.3,0)
[xf] tex61 col1,1,1,1 n78  cull=off winding=ccw  obj(-47,-15,0) w=1 ndc(0.61,0.5,0) uv(0,0)    | obj(41,0,0)  uv(0,0)
```

Same atlas, same 78 vertices, one pixel apart, both `w=1` with NDC on screen and
face culling off — so neither transform nor culling loses the second pass. But
the black pass carries real glyph-cell coordinates and the white one reads
`(0,0)` at both ends. `(0,0)` is the atlas corner, which in a font sheet is
empty, and the alpha test in force is `GEQUAL 0.0157` — an all-transparent
sample is discarded for every fragment. That is exactly what "submitted,
transformed correctly, on screen, contributing nothing" looks like.

It also inverts the reading in the section above one more time: the black pass
is the **shadow**, the white pass is the **text**, and the menu has been drawing
only its drop shadow all along. The earlier note that repainting the black pass
gold produced a correct-looking gold menu (runCM) is still true, but it is a
coincidence of WC3's text being gold — it recoloured the shadow, not the text.

Two vertices per draw is not a measurement, though: a quad strip can start and
end on a cell corner. `scratchpad/uvcensus.js` reads every vertex of every
tex61 draw and reports the u/v range and how many sit exactly on `(0,0)`; run
it before writing a fix.

### CORRECTION: the use-after-free is real, and the probe was not causing it

The section above says to re-run with deadprobe's auto-press disabled before
trusting the crash. That run is runCS (2026-09-12, `--headful`,
`scratchpad/deadprobe-noauto.js`, zero `[auto]` lines in the whole log), and it
reproduces everything with **no key pressed at all** until the scripted one:

```
222s  node appears, state 4, target 0x444800b0 mapped, vtable 0x004456d8
232s  state 4 -> 6            <- happens on its own; the presses did not cause it
299s  [vt] vtable 0x004456d8 -> 0 at eip 0x00402330
300s  refcount 0x454c0c goes 1 -> 0, target UNMAPPED, alive bytes
      [d8 56 44 00 ff ff ff ff 34 01 8f 44 cb fe 70 bb]
426s  scripted space press; 0x418bf2 calls through it, eip goes to 0
```

runCO did the same thing on a different address (`0x444c00b0`, teardown at
336s), so the addresses move run to run but the sequence does not. **The
teardown is app-driven and deterministic.** The auto-press was still worth
removing — a probe that types into the game cannot be used as evidence — but it
was not the cause, and state 6 is simply the node's normal progression.

The `[vt]` eip is worth reading this time. `0x00402330` is inside `0x004022df`,
which ends:

```
0040231b  test esi, esi
0040231f  shr esi, 0x15
00402322  mov ecx, [0x44f91c+esi*4]     ; heap handle table, indexed by addr>>21
0040232a  call [0x444108]               ; the deallocator
```

so the poll caught the free itself, not the decision to free. (In runCO the same
poll landed on a matrix multiply at `0x6f05b550` — it samples every 100ms and
reports where the guest happens to be, so treat its eip as a hint, never as the
instruction that did the store.)

### Where to look next: the teardown's own call stack

Neither the init nor the shutdown can be found statically — `xrefs.js` and
`find-refs.js` both return **zero** references to either, code or data, so both
are reached through computed pointers.

At runtime it is one armed counter. In the shutdown,

```
00412a56  test bl, 0x1
00412a59  jz short 0x412a6e
00412a5b  dec [0x454c0c]
00412a61  jnz short 0x412a6e      ; still referenced -> nothing happens
00412a63  mov ecx, [0x455000]     ; <- reached ONLY when it hit zero
00412a69  call 0x4139a0           ;    the teardown that frees the object
```

`0x412a63` is the fall-through of a conditional jump, so it is a genuine block
entry and `set_count` will match it, and it fires only on the fatal transition —
never on a balanced release. **It must be slot 0**: `src/13-exports.wat` records
`hit0_first_caller`, `hit0_last_ebp` and the four-deep EBP frame walk for slot 0
and no other. `scratchpad/shutprobe.js` arms exactly that from the page
(`set_count` / `get_count` / `get_hit0_frame` are plain exports, so a browser-only
app can use the same counters `--count` uses in `run.js`).

The count peaks at exactly 1, so one lost init is enough to make a balanced
shutdown fatal — read the frames against the campaign→briefing transition.

## SOLVED: the freed object is a worker-pool failure, and the pool failed because we ran out of thread slots

The whole chain, measured end to end. Nothing in it is inferred.

```
ThreadManager._maxWorkerThreads = 7        (lib/thread-manager.js)
  -> the 8th concurrent CreateThread returns 0
       "[ThreadManager] CreateThread failed: no decoded-cache slot"
  -> MSVCRT _beginthreadex returns 0       (import 10 of MSVCRT.dll, IAT 0x444260)
  -> 0x413c65  jz 0x413d72                 the exe abandons the worker pool
  -> 0x413c10 returns 0
  -> 0x4135e5  jnz 0x4135ef not taken      0x413580 returns 0
  -> 0x41292f  jz 0x412972                 the bit-0x20 subsystem init rolls back
  -> 0x412a5b  dec [0x454c0c] hits 0
  -> 0x4139a0                              the object is freed
  -> 0x418bf2  mov eax,[ecx] / call [eax+0x28]   briefing dismiss, eip = 0
```

`runCW` counted both ends of it in one sample: **two** `no decoded-cache slot`
refusals and **two** rollbacks at `0x412972`, exactly 1:1, with no other
refusal and no other rollback in the run.

### What the earlier `CreateIoCompletionPort` reading got wrong

The previous pass followed `0x413580` only as far as its first failure arm and
concluded the I/O completion port at `0x4126f0` was returning zero. It is not.
`scratchpad/iocpprobe.js` armed the function entry and its success block and
reported `iocp-entry=2 iocp-ok=2` — the port is created, `[esi+0x618]` is
non-zero, and `0x413580` walks straight past that check:

```
004135c4  mov eax, [esi+0x618]      ; non-zero, so
004135da  jz 0x4135ef               ; not taken
004135dc  mov ecx, esi
004135de  call 0x413c10             ; <- THIS is what returns 0
004135e5  jnz 0x4135ef              ; not taken -> return 0
```

`CreateIoCompletionPort` was a real gap and is really implemented now
(`src/09a7-handlers-dispatch.wat`, an eight-slot port table with a genuine
queue), but it was never this crash. The lesson is the same one this file keeps
re-learning: **disassemble the whole function before naming its failure arm.**

### Why 15 worker slots and not 8

Warcraft III does not create threads one at a time. It keeps five alive
(one Storm, one MSS audio, three CRT) and then asks for **five more at once**
before any of them runs, so the peak is ten live workers:

```
createThread#9  -> 0xe100b  live[1..5 active] pending[6,7,8]
createThread#10 -> 0x0      live[1..5 active] pending[6,7,8,9]   <- refused
```

`src/00-regions.wat` now splits the three per-thread arenas non-uniformly
instead of striding them evenly, because the main thread decodes the whole
program and a worker decodes the one routine it was spawned for:

| arena | main | each of 15 workers | region size |
|---|---|---|---|
| `$THREAD_CACHE_BASE` | 15MB | 1MB | 30MB, unchanged |
| `$PAGE_INDEX_ARENA` | 128 slots (1MB) | 16 slots (128KB) | 8MB → 2.875MB |
| `$PAGE_DIR_BASE` | 1024 entries | 256 entries | 128KB → 76KB |

So the main thread's decoded-code partition nearly quadruples (3.9MB → 15MB)
while the map as a whole shrinks — sixteen equal shares would have cut main to
1.9MB to buy fifteen workers a partition each they cannot begin to fill.
`$init_thread` in `src/13-exports.wat` is the only code that knows the shape;
`$PAGE_INDEX_SLOTS`, `$PAGE_DIR_ENTRIES` and `$PAGE_DIR_MASK` became
per-instance mutable globals it sets, and the globals' declared defaults are
the main thread's values.

With the fix, the same startup reports `rollback=0 teardown-1to0=0 init-ok=2`
where it previously reported `rollback=2 teardown-1to0=2`.

## SOLVED: the map load then stalled, because the file half of the completion port was refused

The worker-slot fix bought the campaign briefing, and the briefing then sat
still. Three runs of the same walk produced byte-identical film: runCY's
LOADING bar unchanged from 290s to 1340s, runCZ's `f030-311s.png` and
`f036-371s.png` the same md5 and the same 1006154 bytes, narration frozen
mid-sentence at "Somewhere in the Arathi Highlands, Thrall, the young".

**The main thread was not grinding, it was waiting.** Of the 99 main-EIP
samples taken from 300s on in runCZ, 89 landed on `0x00403440`:

```
00403440  push ebp / mov ebp,esp
00403443  mov eax,[ebp+0x8]        ; dwMilliseconds
00403446  mov ecx,[ecx]            ; this->handle
0040344a  call [0x00444104]        ; KERNEL32 IAT +0x6c = import 27 = WaitForSingleObject
00403451  ret 0x4
```

a one-line `CEvent::Wait` wrapper. Its seven call sites include two that pass
`6a ff` — `push -1`, i.e. INFINITE.

The corrected thread census (runDA) named the rest of the deadlock. **Do not
read `thread.eip`/`thread.lastEip` in cooperative mode**: those exist only in
the worker backend, and a probe that falls through to `thread.startAddr`
prints eight threads "frozen" at msvcrt's `_beginthreadex` thunk `0x12167c5`
for three hundred seconds while saying nothing at all. A cooperative thread
record owns its own wasm instance; ask that instance.

```
main            0x403440 y1      WaitForSingleObject, INFINITE
T3              0x403440 y1      the same wrapper
T2 T4 T7 T10    y1               blocked on events
T5              0x4034cb y1      WaitForMultipleObjects (IAT 0x444114)
T8 T9           0x7500300 y0     thunk 0x300/8 = index 96, and War3Demo.exe's
                                 import 96 is GetQueuedCompletionStatus
T6              exited@0x418511
iocp  p0{0x1c0c0000 head=0 tail=0 count=0}      for the entire run
```

Two threads blocked forever on a port that never received anything, everyone
else blocked on events those two would have set.

**The cause.** Warcraft III's asynchronous file layer binds each open file to
the job port and submits overlapped requests against it:

```
00418514  mov eax,[esi+0x6c]       ; the FILE handle
00418517  push 0 / push esi / push edx / push eax
00418522  call [0x00444214]        ; CreateIoCompletionPort(file, port, key, 0)
...
004185f7  mov ecx,[esi+0x6c]
00418603  call [0x00444184]        ; WriteFile(h, buf, len, NULL, lpOverlapped)
0041860d  call [0x00444130]        ; GetLastError
00418613  cmp eax,0x3e5            ; == 997, ERROR_IO_PENDING
```

`$handle_CreateIoCompletionPort` refused exactly that association with
`$crash_unimplemented`, on the reasoning that a silent success would be an
unexplained hang. In a cooperative worker a trap is caught by ThreadManager,
logged and the thread marked exited — so the refusal *was* the unexplained
hang, one thread quieter.

**The fix** (`src/09a7-handlers-dispatch.wat`, `src/09a-handlers.wat`)
implements the association instead. A 64-entry table `{fileHandle, portSlot+1,
completionKey}` lives in the tail of `$IOCP_TABLE`, after the eight headers
(128 bytes) and the eight 256-entry queues (24576 bytes), at offset 24704.
`ReadFile`/`WriteFile` with an `lpOverlapped` on a bound handle become
*positioned* I/O — `fs_read_file_at` for the read, an explicit seek-and-restore
for the write, since there is no `fs_write_file_at` bridge — that does not move
the file pointer, fills `OVERLAPPED.Internal`/`InternalHigh`, queues the
completion, and returns FALSE with `ERROR_IO_PENDING`. Our file I/O is
synchronous, so the completion is already in the queue when the guest checks
`GetLastError`; the guest cannot tell that from a very fast device.
`CloseHandle` drops the binding so a reused handle number cannot inherit a dead
file's completion key. An `lpOverlapped` on a handle bound to no port stays
synchronous, which is what Win32 does for a file opened without
`FILE_FLAG_OVERLAPPED`.

`test/test-wat-iocp-overlapped.js` replays the four calls against a VFS file
directly, because the only binary in the corpus that takes this path is five
minutes of walking into a GL campaign briefing away.

**Measured before and after, same walk:**

| | before (runDA/runCY/runCZ) | after (runDB) |
|---|---|---|
| port | `head=0 tail=0 count=0` all run | `head=4 tail=4 count=0` |
| threads | T6 `exited@0x418511` | no exits |
| briefing film | byte-identical for 1000s+ | every frame different |
| bar at 400s | LOADING, ~20% | **PRESS ANY KEY TO CONTINUE** |

## SOLVED: the blank menu buttons, and the deferred `glGetIntegerv` behind them

Two separate bugs stacked here, and the second one only became visible once the
first was fixed.

### 1. The single-unit path clears unit 0's texture coordinates

`game.dll` draws every menu string twice over one font atlas — a black shadow
pass and a coloured fill pass. Between them it calls its per-unit helper at
`0x6f0c1330` twice, once with `(unit 0, pointer)` and once with `(unit 1, NULL)`;
`tools/find-refs.js` shows the two call sites as `push 0; push 0; call` and
`push 0; push 1; call`, unconditional. The helper reads its own texture-unit
count from `[this+0xac]`:

```
6f0c1333  mov ecx, [ecx+0xac]
6f0c1349  cmp ecx, 1 / jbe 0x6f0c1364     ; maxUnits<=1 skips glClientActiveTextureARB
6f0c1385  push 0x8078 / call [...]        ; glEnableClientState
6f0c1396  push 0x8078 / call [...]        ; glDisableClientState
```

With one unit the unit-1 call skips `glClientActiveTextureARB` and issues a
plain `glDisableClientState(GL_TEXTURE_COORD_ARRAY)` — which takes unit 0's
array with it. A UV census (`scratchpad/uvcensus.js`) caught it exactly:

```
[uv] tex61 col0,0,0,1 n78 u[0.002,0.322] v[0,0.059] zerouv=0/78    <- shadow
[uv] tex61 col1,1,1,1 n78 u[0,0]         v[0,0]     zerouv=78/78   <- fill
```

The fill pass sampled the empty corner of the atlas and `glAlphaFunc(GEQUAL,
0.0157)` discarded every fragment, so only the shadow survived — at
`tools/png-crop.js --gain=6` the buttons read "Single Player" and "Battle.net"
in pure black on dark blue.

The fix is to give the frontend two real texture units: `GL_ARB_multitexture` in
`GL_EXTENSIONS`, a `wglGetProcAddress` that hands back real dispatch thunks
(`src/09a8b-handlers-opengl.wat`, opcode **50** — 49 is `wglDeleteContext`, and
getting that wrong makes the guest call a null pointer at `game.dll+0xc1e4d`),
`glActiveTextureARB` / `glClientActiveTextureARB` / `glMultiTexCoord2fARB`, and
a 14-float vertex with per-unit client arrays, bindings, enables, environments
and matrix stacks.

`game.dll` resolves 34 extension entry points but only ever *calls* three of
them — `glActiveTextureARB` (`[0x6f5b1c1c]`), `glClientActiveTextureARB`
(`[0x6f5b1c0c]`) and `glUnlockArraysEXT` — so the NULLs the other 31 get back
are harmless.

### 2. `glGetIntegerv` was buffered, so the renderer believed it had zero units

That fix alone made the labels appear **and the entire rest of the scene draw
untextured**: flat green/cyan/grey polygons, blown-out white, glyphs as solid
gold bars.

`game.dll` has exactly one `glEnable(GL_TEXTURE_2D)` site (`0x6f0bb654`) and one
`glDisable` site (`0x6f0bb632`), both inside the texture-stage setup function at
`0x6f0bb5c0`. A host-side census of `OpenGLHostBridge.call` showed neither
firing — `glEnable` arrived 175,000 times in two minutes and not once with
`0x0DE1`. The emulator's own hit counters, armed from `--before-load` on one
block entry per branch, said why:

| block | meaning | hits |
|---|---|---|
| `0x6f0bb5c0` | stage setup entry | 103855 |
| `0x6f0bb610` | per-stage loop head | **0** |
| `0x6f0bb6b2` | "unit count is zero" skip | 61563 |

`[this+0xac]` was zero. It is written once, at `0x6f0b8a16`:

```
6f0b8a16  mov eax, [0x6f5b1bb0]      ; the GL_MAX_TEXTURE_UNITS_ARB answer
6f0b8a1b  cmp eax, 2 / jb ...        ; clamp to 2
6f0b8a28  mov [esi+0xac], eax
```

and `0x6f5b1bb0` is filled by `glGetIntegerv(0x84E2, &global)` at `0x6f0bbebf`,
a handful of instructions earlier. Reading the global at the end of a run gave
**2** — the query was answered correctly, just *late*: opcode 103 was not in
`BARRIERS` in `lib/gl-command-stream.js`, so the call was appended to the
command batch and the guest ran on. The copy read the zero that was there
before, the renderer concluded it had no texture units, and it never configured
a texture stage again.

**This is a pre-existing bug in the command stream, not a multitexture one.**
Any guest that reads back a `glGetIntegerv` answer on the next instruction has
been getting stale memory; Warcraft III is simply the first app in the corpus
that does. One line fixes it, and `test/test-opengl-command-stream.js` now pins
it.

### Result

`runDI/f002-090s.png`: the main menu reads **Single Player / Battle.net / Local
Area Network / Options / Credits / Quit** over a fully textured rain-lit scene.

**Reproduce:**

```bash
node tools/profile-web-frames.js --app=warcraft3_demo --seconds=90 \
  --headful --query='?debug' --warmup=60 --film=/tmp/wc3:30
```

**Probes worth keeping in mind for the next one of these:** a bridge-level
opcode histogram says which entry points the guest actually reaches (and the
Encoder-only opcodes — `glBegin`/`glVertex*`, the client-array calls,
`glClientActiveTextureARB`, `glMultiTexCoord2fARB` — will never appear there by
design); and `set_count`/`get_count` armed from `--before-load` are the only way
to ask a *browser-only* app which branch it took, since `--count` lives in
`test/run.js` and nothing on the OpenGL path can run headless.

## The map screen is a LOADING screen for most of its life, and ESC quits the app

Measured 2026-09-13 across four `--headful` runs (runGP6-runGP9) of the same
menu walk, all trying to get past the briefing to gameplay. Two readings in
this file's earlier sections were wrong, and both wrong readings came from
treating the Chapter One screen as a single thing.

**It is a loading screen first and a prompt second.** runGP7's film has
`f037-570s.png` showing the parchment map with the bar about a third across
reading **LOADING**; the same run's `f075-1140s.png` is the identical screen
with the bar full and reading **PRESS ANY KEY TO CONTINUE**. So a key pressed
anywhere in that window is not being dropped by a flaky input path — the game
is not waiting for one. The load duration is not stable either: runGP2
finished it by ~560s and runGP7 took past 1100s on the same walk, so **no
scheduled press time is reliable**, and the earlier conclusion that "the key
path to that screen is flaky, it worked in runGP2 and failed in runGP3/runGP5"
was a misreading of that variance. Press repeatedly at a wide cadence instead,
or pace the press off the picture.

**ESC on that screen backs out, and enough of them quit the program.**
runGP8 alternated SPACE and ESC every 60s. Its log's last input before
`--- Program exited ---` is the third ESC, fired at guest ~600s while the bar
was still filling. The film corroborates it independently: the clip is 940x702
while the app owns the screen and 940x736 once the desktop is showing, and
every frame from `f045-690s.png` on is 940x736 with the `+ Add a game...`
button in the corner. **That frame-size change is a free app-death detector**
for any scripted run — check it before reading a run as a hang.

SPACE is not destructive here: three of them fired in the same run and did
nothing bad. So drive this screen with SPACE only, and do not add ESC "to skip
the cinematic" — that is what killed three runs.

**Allocation pressure over the same window, for the record.** runGP7 sampled
every 2s for 1300s with `tools/page-probes/arm-memory-series.js`:
**0 allocation failures**, verified by the in-page counter rather than by the
absence of a log line (`profile-web-frames` only surfaces `--relay` matches, so
grepping for `[heap] OOM` without asking for it proves nothing). wasm flat at
its 512 MB floor, JS heap slope 4.9 MB/min = inside noise, DIB arena free pages
constant at 15739. The sparse arena cursor rose as often as it fell — e.g.
`0x3c752000 -> 0x4a7fb000 -> 0x39270000` in three consecutive samples — with a
low-water mark of `0x32990000`, so the arena is churning address space and not
accumulating it. **No evidence for `bigMemory: true` on this app.**

**A run dying with Puppeteer's `Attempted to use detached Frame` is the box,
not the app.** runGP9 hit it 170s in at a load average of 115 (another agent's
90-minute B&W2 probe). Check `uptime` before reading anything into it.

## The campaign load, measured headless (2026-09-14)

**`node test/run.js` drives this app now.** The claim a few sections up — "it
needs a GL context, and nothing on the OpenGL path can run headless" — is no
longer true: `lib/headless-gl.js` (`@node-3d/webgl` + `@node-3d/glfw`, both
Node-API so no per-ABI rebuild) gives `lib/gl-compat.js` a real native context
with no browser at all. The full 3D main menu is up in ~45s at 640x480,
renderer `Apple M1`:

```sh
node test/run.js --app=warcraft3_demo --headless-gl --quiet-api --quiet-blocks \
  --control=8124 --max-seconds=5400 --max-batches=999999999 --no-close
```

`--quiet-blocks` is not optional. `test/run.js:9067` prints a full register
dump for every batch whose EIP differs from the last one's; an unflagged run
wrote 114,891 of those lines, and that is blocking I/O on the guest's thread.

### Driving the menu (this cost an hour; do not re-derive it)

Two rules, both discovered the hard way, neither guessable:

1. **A button needs a real hover transition, then a fast press.** Send one
   `ctl mousemove` somewhere else, then one to the target, as *separate* ctl
   invocations — the guest must see the hover change. Then send the press as
   one burst: `printf 'mousedown:X:Y\nmouseup:X:Y\n' | node tools/ctl.js -s :PORT pipe`.
   Putting the move in the same pipe is too fast for the hover to register;
   putting a `sleep 3` between down and up is **168 guest-seconds** at the
   default 200ms/batch and the UI discards the press as a stale drag. Both
   failure modes look identical from outside: nothing happens.
2. **The keyboard is DirectInput only.** `ctl type` and `ctl key` send window
   messages and do nothing on any WC3 screen. `ctl cmd di-keydown:VK` +
   `di-keyup:VK` types. That is how the profile name goes in and how Enter
   commits it — the `Create` button itself never answered a click.

Menu centres at 640x480: Single Player 546,113 · Battle.net 546,161 · LAN
546,208 · Options 546,255 · Credits 546,302 · Quit 546,412. Then: profile name
field 92,173, `Create` 203,173 (use Enter instead), right panel Campaign
546,150, and on the campaign screen **the clickable is the bullet glyph at
435,152, not the "Exodus of the Horde" text** — clicks on the label do nothing.

### What the load is actually doing

Instrument a live run with no restart: `ctl eval 'exports.reset_handler_hist();
exports.set_handler_hist_enabled(1)'`, let a window elapse, then read it with
`tools/ctl-probes/read-handler-hist.js` (the `--control` twin of the page probe;
the page version reaches `runningApps[0].wine`, which does not exist here, and
`moduleBases` is not in a `new Function` body's scope, so name the addresses
from the run's own `DLL:` header lines).

**It computes the whole way. It never waits.** `yieldReason` is 0 across the
entire load, EIP churns across every module, and the batch rate swings 90–700/s.
There is no `WaitForSingleObject` park in this and no emulator stall.

It is **phase-structured**, and each phase has a different owner:

| window | ops/block | biggest owner |
|---|---|---|
| first ~4 min | 8.47 | **`ijl15.dll` — 40.3% of all block entries**, from the top-40 blocks alone |
| later | 5.09 | `Game.dll+0x6f0deb60`, one 2-block loop, 18.1% |
| later still | 4.69 | same loop 13.7%, `Storm.dll+0x15020d02` 6.9%, msvcrt 4.6% |

`ijl15.dll` is the **Intel JPEG Library** — WC3's BLP textures carry JPEG
payloads, and the map load decodes them. The handler mix under it is
`mov_r_r` / `compute_ea_sib` / `shift_r` / `add_r_i32` / `imul_r_r_i`, i.e. IDCT
and Huffman. It has exactly **six exports** (`ijlGetLibVersion`, `ijlInit`,
`ijlFree`, `ijlRead`, `ijlWrite`, `ijlErrorStr`), so the single largest cost in
the load sits behind one interceptable call, `ijlRead` at `0x600333d0`. That is
the obvious lever and nothing has been built for it yet.

> **Sized since, and it is smaller than this reads.** An 11-window census of
> the whole load ("The map load has NO hot loop", below) puts ijl15 at
> **29.41%** weighted, not the ~40% quoted from a single early window. It is
> still the largest single lever, but it caps the load at about **1.4x**.

`Game.dll+0x6f0deb60` is a linear first-free-slot scan, entry `0x6f0deb40`:

```
mov ecx,[edi+0x30]        ; count
mov edx,[edi+0x34] / add edx,0x14   ; array base + flag field
0x6f0deb60: test [edx],1 / jz found ; slot in use?
            inc eax / add edx,0x18  ; 24-byte records
            cmp eax,ecx / jb 0x6f0deb60
            ; fell through: grow-and-append via call 0x6f0df290
```

**It is NOT the O(n²) it looks like** — that was the first hypothesis here and
it is wrong. Measured over two windows as a share of block entries (load-immune,
unlike iterations/second on a box whose load average moved 6.8 → 11.9): 13.7%
then 9.6%. The scan is steady ~10–14% of the work, not runaway.

### The loading bar does not decelerate; it has plateaus

The bar trough spans x≈150–492 at y≈427. Right edge against wall seconds from
the click:

```
t+20 189 · t+40 224 · t+61 233 · t+81 233 · t+101 259 · t+121 260
t+162 270 · t+203 292 · t+243 327 · t+283 367 · t+324 369 · t+659 381
```

1.55 px/s, then 0.44, then back up to 0.94, then a long flat stretch — so an
early reading of "it is decelerating, something is quadratic" is an artifact of
where the samples land. Take the whole curve before concluding anything from a
pair of points.

The first 63 seconds after the click are a **100% black screen** (one distinct
colour) before the parchment map appears; that is part of the load, not a hang.

### So why is it slow

Guest work at interpreter speed, with nothing pathological in between. The
ops/block figures — 4.7 to 8.5 — say this is block-transfer-bound, not
op-bound: tiny blocks, so the per-block cost dominates, which is exactly the
regime the fold/region work targets. The two app-specific levers, in order of
size, are a host-side `ijlRead` and cheaper block transfer. Neither is a bug.

### The silent tail is not quadratic either (measured 2026-09-14)

After the loading bar stops at ~96% the screen is byte-identical for minutes
(`png-diff` f040 vs f045: 0 of 307200 pixels) while the guest keeps computing —
36.6% of block entries in Game.dll, concentrated in the FPU-heavy cluster
`Game.dll+0x6f0b6885..0x6f0b68a6` plus `0x6f0c12d0`. Disassembled from its entry
`0x6f0b6875`, it walks the pointer array at `[esi+0x564]` backwards accumulating
`(2 or 4) * [obj+0x18] * [obj+0x14]` into `[esi+0x68]` — width x height x
bytes-per-pixel over a texture/surface list, ~36% of the slots NULL — then
`fild word [ebp-8] / fmul dword [0x6f4ee4e4] / call 0x6f4278fc`.

The obvious hypothesis is that this total is recomputed over a list that keeps
growing, i.e. quadratic in texture count. **It is not.** Live counters on the
loop body (`0x617885`) and its exit (`0x6178a9`) at this run's load base:

```
node tools/ctl.js -s :8124 eval 'exports.clear_counts(); exports.set_count(0,0x617885); exports.set_count(1,0x6178a9)'
```

Three cumulative reads, minutes apart:

| body | exits | avg trip |
|---|---|---|
| 2,911,896 | 1,586 | 1836.0 |
| 5,071,032 | 2,762 | 1836.0 |
| 13,738,788 | 7,483 | 1836.0 |

Flat to one decimal across a 4.7x increase in calls, so the incremental average
between any two samples is also 1836. The list is a **fixed ~1836-entry array**
and each call is constant work; the tail is simply a great many calls to it. As
with the `0x6f0deb60` scan earlier in this file, the shape that reads as O(n^2)
in a disassembly measured out linear — which is the third time in this
investigation. Disassembly proposes; counters decide.

## The load does not end at the chapter card (2026-09-14)

The loading bar reaching ~96% and the screen freezing is **not** a hang: the map
screen eventually swaps to the Chapter One card with `PRESS ANY KEY TO
CONTINUE`. Total from the Prologue click to that card on this box, at 640x480
headless: ~40 minutes.

Getting past it, and what is behind it:

| step | how | result |
|---|---|---|
| dismiss the chapter card | hover `mousemove 320,428`, then `mousedown`/`mouseup` in one `ctl pipe` burst | in-engine cinematic letterbox (ornate bars top and bottom) |
| skip the cinematic | `cmd di-keydown:27` / `di-keyup:27` (Esc) | **no effect** |
| open the menu | `cmd di-keydown:121` (F10) | **no effect** |

`ctl mousemove` needs the comma form `mousemove 320,428`; `mousemove 320 428`
is rejected with `need coordinates as X,Y` and no hover happens, so the click
that follows is silently discarded. That is the same failure mode as the two
input rules above and looks identical from outside.

### Behind the letterbox it is still loading, not rendering

Two captures ~2 minutes and ~80,000 batches apart are **byte-identical** (0 of
307200 pixels), while the guest keeps running (batch 546k -> 625k). The
letterbox frame is drawn and the area between the bars is pure black.

A 60-second handler/block sample there:

```
ops 829,667,044   block entries 83,752,886   distinct blocks 12,945
9.9 ops/block
```

12,945 distinct blocks and a top block at only 3.5% is a broad working set --
an engine doing real work, not a spin loop. And the top block names what the
work is. `Game.dll+0x6f05ee72` sits inside the function at `0x6f05ee50`:

```
6f05ee50  push ebp / mov ebp,esp / sub esp,8
6f05ee56  cmp edx,4 ; jb 0x6f05ef68        ; tail for < 4 bytes
6f05ee5e  mov esi,[eax] / not esi          ; crc = ~seed
6f05ee6c  shr edx,2                        ; 4 bytes per iteration
6f05ee72  movzx eax,word [ecx+2] ...       ; load 8 bytes as four words
6f05ee97  mov esi,[0x6f4eee08+edx*4]       ; table lookup
```

and `0x6f4eee08` is the standard CRC-32 (IEEE) table -- `00000000 77073096
ee0e612c 990951ba`. So this is a table-driven CRC32 unrolled four bytes per
iteration. Its blocks (`0x6f05ee72`, `0x6f05eff2`, `0x6f05eff5`, `0x6f05f000`)
are **6.95% of all block entries** from the top-40 alone.

CRC32 over asset bytes at this point in a Blizzard title is MPQ/asset integrity
checking. The conclusion is that dismissing the chapter card starts a *second*
load phase, with the cinematic letterbox already on screen, and the black is
"the scene has not been built yet" rather than a dead renderer.

That makes two host-side interception candidates on this app, both pure
functions over a byte range with a fixed ABI:

- `ijl15.dll!ijlRead` at orig `0x600333d0` -- ~40% of the first load phase
  (**29.41% weighted over the whole load**; see the 11-window census below)
- `Game.dll+0x6f05ee50` CRC32 -- ~7% of the post-card phase

Neither is a bug; both are guest work an emulator can do natively instead.

### CORRECTION: phase 2 is a steady-state loop, not progress

The "second load phase" reading above was based on one histogram window. A
second window, **13 minutes later**, is the same window:

| | window 1 | window 2 (+13 min) |
|---|---|---|
| ops | 829,667,044 | 877,865,592 |
| block entries | 83,752,886 | 89,148,816 |
| distinct blocks | 12,945 | 12,770 |
| top block | `0x6f05ee72` 3.49% | `0x6f05ee72` 3.43% |
| 2nd/3rd | `0x6f462568` / `0x6f462533` | same |

Same blocks, same ranking, same shares, and the screen is byte-identical across
the whole interval (three captures, 0 of 307200 pixels). Work that is *making
progress* moves through different code as it moves through different asset
types. This does not. **It is a loop, not a load**, and the earlier "the black
is an unbuilt scene" conclusion is withdrawn.

What the loop is doing is a running frame loop. `0x6f462547` is a dirty-bitmask
sweep:

```
6f462533  mov edx,[edi+0x98] / mov ebx,[edx+eax*4]   ; word i of a flag array
6f46253e  jz 0x6f462568                              ; skip empty words
6f462545  test bl,1 / jz ... / call 0x6f461ae0        ; per set bit, index (i<<5)+bit
6f462555  shr ebx,1 / inc esi / jnz 0x6f462545
6f462562  mov [ecx+eax*4],ebx                        ; clear the word
6f46256e  jb 0x6f462533                              ; next word
```

-- "service every pending item, then clear the flags", which is a per-frame
update pass, not an asset loader. So the engine is ticking and presenting
nothing new.

The CRC32 at 6.95% is real and still the largest single named cost here, but it
is now better read as work inside a repeating tick than as one-shot integrity
checking.

**Open question, not yet measured:** what the cinematic is waiting for. The
leading candidate is audio -- WC3 campaign cinematics are trigger-scripted and
gated on voice-line playback position, and a sound that never reports progress
would hold the trigger forever while the frame loop keeps running exactly like
this. Time is not a candidate: at 200 ms/batch the headless clock runs *ahead*
of wall time, so a timer wait would complete early, not late.

Status after ~73 minutes of run: main menu -> profile -> campaign -> Prologue ->
(40 min) chapter card -> cinematic letterbox -> here. Non-cinematic gameplay
with the console visible has still not been reached.

## CORRECTION (2026-09-14): `test/run.js --headless-gl` drives this app, and reaches the menu in 60s

"How to run it" above says `node test/run.js` cannot drive this app at all,
because `lib/gl-compat.js createContext` needs a `document` and `npm install gl`
does not build here. **That is no longer true.** `--headless-gl` (test/run.js:856,
`lib/headless-gl`, backed by `@node-3d/webgl`) gives the OpenGL bridge a real
drawable factory, and the app reaches its full main menu — Single Player /
Battle.net / Local Area Network / Options / Credits / Quit, artwork, "1.01 DEMO" —
inside a single 60-second run:

```bash
node test/run.js --app=warcraft3_demo --no-threads --headless-gl --quiet-api \
  --max-seconds=60 --max-batches=99999999 --png=/tmp/wc3.png --no-close
```

CLAUDE.md's claim that "anything on the OpenGL path can never reach
`test/run.js`" is stale for the same reason, and so is the advice to reach for
`tools/browser-handler-hist.js` for this app: `--handler-hist` works directly now.

### The "unable to initialize DirectX" modal is a `wglCreateContext` failure

Without `--headless-gl` the app puts up

> Warcraft III was unable to initialize DirectX. Please ensure you have DirectX
> 8.1 or newer installed...

and the message is misleading. **No DirectX call fails.** `--trace-api` has d3d8
succeeding well before it:

```
#7921 LoadLibraryA("d3d8.dll")
#7922 GetProcAddress("Direct3DCreate8")
#7923 Direct3DCreate8(0x78)
#7924 IDirect3D8_GetAdapterIdentifier(...)        <- fine
#7925 IDirect3D8_Release(...)
```

What actually fails is the GL probe the `-opengl` command line asks for:

```
#8146 GetDeviceCaps(hdc, 12)      => 32
#8147 ChoosePixelFormat(hdc, ...)
#8148 DescribePixelFormat(hdc, 1, 0x28, ...)
#8149 SetPixelFormat(hdc, 1, ...)
#8150 wglCreateContext(hdc)       <- returns 0 with no drawable factory
#8151+ ReleaseDC -> SetDeviceGammaRamp -> DestroyWindow
       -> ChangeDisplaySettingsExA(NULL) -> ShowWindow(HIDE)
       -> UnregisterClassA               ... the probe window is torn down
#8248 MessageBoxA  ret=0x0040c93f
```

So the modal names the wrong subsystem, and chasing DirectX from it is a dead
end. `wglCreateContext` returning 0 is the whole cause.

### Anything measured without `--headless-gl` measured the stall, not the game

Both scheduler modes hit the modal and then go nowhere, and they stop at the
*same* place — **8,248 API calls** — so an API census cannot tell them apart:

| run | MessageBox | API calls | batches |
|---|---|---|---|
| `--no-threads`, no GL | 1 | 8,248 | 534,330 in 40s (spinning) |
| `--threads`, no GL | 1 | 8,248 | 89 in 1.1s (stopped) |
| `--no-threads --headless-gl` | **0** | **688,601** | 38,443 in 40s |

Cooperative burning 534,330 batches without the API count moving past 8,248 is
the tell: it is not loading anything, it is spinning behind a modal. Any
cooperative-vs-worker comparison on this app from a non-`--headless-gl` run is
comparing two flavours of that stall and should be discarded.

### The hot-block profile, confirmed in a configuration that actually runs

60s, `--no-threads --headless-gl --handler-hist --handler-hist-thread=0`,
29,826 distinct blocks:

```
0x005f9b96  3,425,488  2.77%  ┐ Game.dll +0x98b96..  the LALR/FDF parser
0x005f9ba6  2,237,126  1.81%  │
0x005f9b5f  2,222,690  1.80%  │
0x005f9b43  2,222,689  1.80%  ┘ <- exactly the 2,222,689 parser tokens
0x00cadce9  2,582,847  2.09%  ┐ Storm.dll +0x33ce9..  string upcase + hash
0x00cadd02  2,582,847  2.09%  │
0x00cadce0  2,582,537  2.09%  ┘
0x00cad8a0  2,465,080  1.99%
```

`0x005f9b43`'s hit count matching the independently-counted token total is the
check that the parser reading is right.

### Caveat the harness reports about itself

```
[gl] warning: 2 simultaneous GL contexts, but @node-3d/webgl shares one state
     machine between them; interleaved draws will fight
```

The menu renders correctly regardless, but a later scene drawing wrong is a
suspect here before it is a guest bug.

### Worker mode also reaches the menu, and is ~1.9x slower doing it

Same build, same 40s budget, `--headless-gl` on both:

| mode | MessageBox | API calls | batches | wall |
|---|---|---|---|---|
| `--no-threads` | 0 | 688,601 | 38,443 | 40.0s |
| `--threads` | 0 | 395,607 | 24,478 | 43.7s |

So worker mode is genuinely slower here — but **not** for any of the three
reasons that look obvious, all of which were measured and are false:

- **Not spin loops.** `[spin-park] clock 0 trips` — `$clock_spin_step`
  (`src/01-header.wat`, `$spin_park_k`=8) is mode-independent and WC3's threads
  are `yield=1` event waits, so it never parks.
- **Not RPC round trips.** `--rpc-census` on the threads run: T1 66 sync / 464
  local, T2 30 sync / 489 local, 96 brokered imports total across the run. A
  blocking import costs a `postMessage` plus an `Atomics.wait`, but there are
  not enough of them to matter.
- **Not a DirectX divergence.** The modal appears in cooperative mode too; it
  was never a threads-only symptom.

The cause is still open. Note that a *batch* count is not a work unit here
(see CLAUDE.md on `--batch-size`), so the honest statement is the API-call
ratio at fixed wall time, not "24,478 vs 38,443 batches".

### The browser is slow, not hung

A `?debug` browser run shows "12 threads in workers" and a grey canvas for a
long while before the menu appears. That is **expected**, on both counts:

- 12 workers is this app's own shape, not a leak — see "Why 15 worker slots and
  not 8" above: WC3 keeps 5 threads alive (1 Storm, 1 MSS, 3 CRT) and then asks
  for 5 more at once, peaking around 10 live.
- The grey is startup, and it does finish — confirmed by hand, the menu loads
  if you wait. The CLI reaches the same menu in under 60s; the browser is the
  same work through the Worker backend.

The often-quoted "40 minutes" figure is the **campaign map load**, not startup.
Reaching the main menu is a sub-minute operation.

### Dead lever: the `USECPU` knob in ijl15 is never read

`ijl15.dll` carries the string `USECPU` at `0x600584e0` (`.data1`), referenced
once from a data table at `0x60050084`, and the DLL imports
`GetEnvironmentVariableA`. That reads like a documented Intel JPEG Library
tuning knob you could set to pick a wider SIMD path — worth a look, given
ijl15 is 40.3% of block entries through the first ~4 minutes of the load.

It is not reachable. A 60s `--headless-gl` load traced with
`--trace-api=GetEnvironmentVariableA` makes **eight** calls, and every one of
them is the CRT's own probe:

```
[API #152]    GetEnvironmentVariableA(lpName="__MSVCRT_HEAP_SELECT", ...) => 0
[API #364055] GetEnvironmentVariableA(lpName="__MSVCRT_HEAP_SELECT", ...) => 0
   ... 8 calls, all __MSVCRT_HEAP_SELECT, all returning 0
```

`USECPU` is never asked for, through the environment or otherwise — ijl15
imports no registry API at all, so there is no registry path either. Seeding
it by any mechanism would change nothing, and an A/B against it would measure
noise. If someone wants the string to matter, the job is to find what reads
that data table, not to set a variable.

Two related corrections for anyone reading older notes or session logs:

- **A per-app registry seed already exists.** `startupRegistry:` in
  `lib/apps.js`, applied by both hosts — `lib/browser-shell.js:799` and
  `test/run.js:4564`. Captain Claw and Funtris use it. There is no gap to fill.
- **A per-app environment seed does not**, but `test/run.js` already has
  `--env=NAME=VALUE` plus `setEnvironmentVariable` in `lib/process-boot.js`,
  so wiring one is small — it is just not worth doing for this app, on this
  evidence.

The real lever in this phase remains `ijl15.dll!ijlRead` at orig `0x600333d0`:
six exports, one interceptable call, ~40% of the first load phase — but
**29.41% weighted across the whole load**, per the 11-window census below.

### CORRECTION: the campaign no longer dies at 2048 virtual-map records

The section above says clicking Campaign "runs the emulator out of virtual-map
records" — live records climbing to 2048 at ~181s, then the game's own
"critical error" box. **That bound has been raised**:

```wat
;; src/01-header.wat:2458
(global $MAX_VIRTUAL_MAPS i32 (i32.const 8192))
```

It was 2048 when that measurement was taken (2026-09-11). Best-fit backing-hole
reuse landed since as well (`5f6d8c5b`). The browser now reaches the campaign's
loading screen — "Chapter One: Chasing Visions", progress bar advancing, HUD
reporting 2.2M blocks/s — so the record exhaustion is no longer what ends the
load. Re-measure before quoting the 181s figure or the 2048 ceiling again.

### WRONG, superseded: "Driving the menu headlessly needs DirectInput, not clicks"

> **This section's conclusion is false and is kept only as a record of the
> error.** The menu drives fine with ordinary absolute clicks; see "CORRECTION:
> the menu DOES drive headlessly" immediately below for the working walk and
> the trace that settles it (198 `GetCursorPos`, zero DirectInput calls). Only
> the first paragraph here — the 640x480 rescaling — is still true.

The click table above was taken in a browser at a larger resolution; headless
the menu renders at 640x480, so every coordinate in it needs rescaling (Single
Player is at ~546,113, not 805,165).

More importantly, **absolute clicks do not drive this menu at all.** Measured
over a `--control` session against a live main menu: `renderer.handleMouseDown`
/ `handleMouseUp` at the button, held 1.5s, changes nothing; a DirectInput
button press through `renderer._queueDirectInputMouseButton` at the same spot
changes nothing; and `renderer.handleRelativeMouseMove(226,-127)` delivered in
16 steps draws no visible cursor in the captured frame. The game tracks its own
pointer from relative deltas and samples the button through DirectInput, so a
headless walk needs `relmousemove` + `di-mousedown`/`di-mouseup`
(`test/run.js` supports all three as `--input` kinds) calibrated against what
the game thinks its cursor position is — which the PNG capture does not show.

There is no WC3 driver script in the repo; the notes' original walk was done by
hand in a browser. Anyone wanting a histogram series over the *map load* needs
to build that walk first, or drive the browser by hand — `tools/ctl-hist-series.js`
(which samples a live `--control` session into the several windows
`tools/hot-loop-census.js` wants) is ready and waiting on it.

### CORRECTION: the menu DOES drive headlessly — the working walk

The section immediately above ("Driving the menu headlessly needs DirectInput,
not clicks", committed in b6ba59dd) is **wrong**, and this supersedes it. The
menu drives fine from `test/run.js` with ordinary `--input` mouse events. What
misled me is recorded below, because the same trap is easy to re-enter.

**What the menu actually reads.** Traced over a 75s `--headless-gl` load with
`--trace-api` filtered to every cursor/DirectInput entry point:

```
201  ClipCursor
198  GetCursorPos
  0  IDirectInputDevice_GetDeviceState / GetDeviceData / Acquire / SetProperty
  0  GetAsyncKeyState / GetKeyState
```

So it is **absolute cursor position plus window messages** — `GetCursorPos`
reads `renderer._mouseX/_mouseY` (lib/renderer-input.js:546) — and there is no
DirectInput in the menu at all. Driving it through
`renderer._queueDirectInputMouseButton` or `handleRelativeMouseMove`, as the
superseded section describes, moves nothing because nothing is listening.

**Pace by batch, not by wall clock.** The other half of the earlier failure was
sending a press and scheduling its release with a 1.5s `setTimeout`. The guest
samples the button per *batch*, and batch rate swings enormously with phase —
measured this session between 362/s in the working load and >4,000/s while
spinning behind the DirectX modal. A wall-clock release straddles the sample.
`--input=BATCH:...` is paced in the guest's own unit and is the primitive to
use.

**The walk, at the headless 640x480 layout** (the click table earlier in this
file is from a browser at a larger size; scale it by ~0.68 or use these):

| step | coords | what it reaches |
|---|---|---|
| Single Player | 546,113 | Single Player Profiles |
| type a name | `keypress:65,66,67` | edit is already focused, no click first |
| Create | 203,173 | profile appears in the list |
| profile row 1 | 130,225 | selects it |
| Select | 203,314 | Single Player menu |
| Campaign | 546,149 | Campaign screen |
| Prologue: Exodus of the Horde | 505,157 | map load begins (screen goes black) |

Verified end to end. As one command, with `B:png:PATH` snapshots between steps
so a mis-aimed click is visible rather than silent:

```bash
node test/run.js --app=warcraft3_demo --no-threads --headless-gl --quiet-api \
  --input="40000:mousemove:546:113,44000:mousedown:546:113,48000:mouseup:546:113,\
54000:keypress:65,54800:keypress:66,55600:keypress:67,\
59000:mousemove:203:173,61000:mousedown:203:173,64000:mouseup:203:173,\
70000:mousemove:130:225,72000:mousedown:130:225,75000:mouseup:130:225,\
78000:mousemove:203:314,80000:mousedown:203:314,83000:mouseup:203:314,\
90000:mousemove:546:149,92000:mousedown:546:149,95000:mouseup:546:149,\
104000:mousemove:505:157,106000:mousedown:505:157,109000:mouseup:505:157" \
  --max-seconds=420 --max-batches=99999999 --no-close
```

Two cautions. Hold each press for a few thousand batches and move the pointer
onto the control first — the hover highlight in a `B:png` capture is the cheap
confirmation that `GetCursorPos` is reading your position before you trust the
click. And the batch numbers above are calibrated for ~400 batches/s; on a
quieter box the walk fires earlier than the menu exists, so re-check the
snapshots rather than assuming the schedule still lands.

**`--headless-gl` is not reliable when the box is busy.** A working run logs
*two* GL contexts:

```
[gl] headless WebGL enabled (@node-3d/webgl)
[gl] warning: 2 simultaneous GL contexts, but @node-3d/webgl shares one state
     machine between them; interleaved draws will fight
```

A run that logs only the first line has lost the guest's `wglCreateContext`,
and comes up with the "unable to initialize DirectX" modal and a batch rate
several times too high — the spin signature. One identical command failed this
way with three other `run.js` processes on the machine and succeeded on retry.
**Check for the second `[gl]` line before believing any WC3 measurement.**

### CORRECTION: `--headless-gl` fails because the SCREEN SLEPT, not because the box is busy

The paragraph just above blames a busy box for the intermittent
`--headless-gl` failure. That was a guess, and it is wrong. Measured:

```
[gl] context creation FAILED (800x600, 0 already live):
     No suitable display found for a new GLFW Window.
```

**`0 already live`** — so it is not contention between two contexts, and the
concurrent `run.js` processes had nothing to do with it. Asking GLFW directly:

```
glfw.init()          => true      <-- init SUCCEEDS, so nothing looks wrong
glfw.getMonitors()   => []        <-- zero displays
glfw.getPrimaryMonitor() => null
```

On macOS the display list **goes empty when the screen sleeps**, and
`glfwInit()` keeps returning true, so there is no failure anywhere near the
cause. `pmset -g assertions` showed `PreventUserIdleDisplaySleep 0` — nothing
was holding the screen on, and every failed run here was simply a run that
started after the Mac had idled. Wake the screen and the same command comes
straight back with `1 display(s)` and the healthy two-context line.

**The fix when running unattended:**

```bash
caffeinate -d node test/run.js --app=warcraft3_demo --headless-gl ...
```

`caffeinate -d` holds the *display* awake; plain `caffeinate` only blocks
system sleep and does not help. Note the box already runs a plain `caffeinate`
for other agents' sweeps, which is why system sleep was never the symptom.

Two diagnostics now make this self-reporting instead of a puzzle:

- `lib/headless-gl.js` logs the context-creation failure with its real reason
  and the live-context count, instead of swallowing it into `loadError` and
  returning null. Silently returning null is what produced the misleading
  chain: `wglCreateContext` → 0, guest takes its no-3D-hardware path, and the
  first visible symptom is an app-level DirectX message box a hundred lines
  later at several times the normal batch rate.
- The `--headless-gl` startup line now reports the display count
  (`headless WebGL enabled (@node-3d/webgl), 1 display(s)`) and refuses up
  front with `UNUSABLE: ... GLFW sees ZERO displays` when there are none.

So the check before believing a WC3 measurement is the **startup line**, which
now answers it directly; the "2 simultaneous GL contexts" warning remains a
good second confirmation that the guest's own context was created.

## The map load has NO hot loop — 11 windows say so

The reusable method, and this measurement written up in full, is
[docs/long-load-census-method.md](../long-load-census-method.md).

The first real multi-window census of the campaign map load, and it settles the
question the `ijlRead` interception idea rests on. Collected with the headless
walk above plus `--control=8124`, sampled by `tools/ctl-hist-series.js`
(11 windows, 45s each, 15s gaps — 11 minutes of the load) and read by
`tools/hot-loop-census.js`:

```
  window  ops/blk distinct    ijl15     Game    Storm   msvcrt
   t+45s    10.29    26970      6.5     25.7     25.0        -
  t+105s     7.31     9152     72.3        -        -        -
  t+165s     6.90     8741        -     32.3      5.0        -
  t+226s     6.27    15521      2.0     12.0     12.7      6.7
  t+286s     6.51    15390     47.8      7.5        -        -
  t+346s     6.10    11064     27.0      4.9      7.0      5.9
  t+406s     5.13    10433      0.3     26.8     12.4      9.7
  t+466s     4.87     6516        -     24.4     14.6      9.7
  t+526s     6.39    10654     41.5      5.0      3.9      1.8
  t+586s     4.91     9148        -     20.6     16.5      9.9
  t+647s     7.32    17483     35.0        -      8.6      3.6

11 windows   2.9G ops   405M block entries   7.10 ops/block overall
weighted over the whole series: ijl15 29.41%, Game 14.31%, Storm 7.97%
```

**The census verdict, verbatim:**

```
NO region holds >=5% of block entries in every window.
Nothing here is a safe fold target on this evidence.
```

Three things follow.

**1. ijl15 is a PHASE, not a hot loop.** Its share per window runs
`6.5, 72.3, ~0, 2.0, 47.8, 27.0, 0.3, ~0, 41.5, ~0, 35.0` — it alternates hard
with Game.dll, which is the shape of a pipeline: decode a JPEG, consume it,
decode the next. The earlier "≈40% ijl15" in this file came from one early
window and is not the number. The *weighted* share over 11 minutes is
**29.41%**, which is what an `ijlRead` interception is worth as an upper bound
— still the single biggest lever here, but by Amdahl it caps the whole load at
about **1.4x**, not the 1.7x a 40% share implies, and only if the interception
is free.

**2. No single loop is worth folding.** The largest mean share of any region is
5.9% (`Game.dll+0x6f0deb60`, two blocks) and it is 0.0% in six of eleven
windows. Every region with a big number has a correspondingly big spread — the
top rows are 19.2pp, 14.3pp, 13.6pp, 16.0pp. These are scenes.

**3. This is exactly the error the census tool was built to prevent, and it
would have been made again.** Reading window 1 alone nominates
`Game.dll+0x6f4a4220..6f4a42f0` (13 blocks) as a fold target at **19.9%**. It
is **0.0% in all ten other windows.** One window is not evidence.

The reusable command, end to end:

```bash
caffeinate -d node test/run.js --app=warcraft3_demo --no-threads --headless-gl \
  --quiet-api --control=8124 --input="<the walk above>" \
  --max-seconds=1500 --max-batches=99999999 --no-close > /tmp/wc3.log 2>&1 &
# once the Prologue click lands and the screen goes black:
node tools/ctl-hist-series.js --port=8124 --log=/tmp/wc3.log \
  --window=45 --gap=15 --count=11 --out=/tmp/wc3-series.ndjson
node tools/hot-loop-census.js /tmp/wc3-series.ndjson --top=14
```

`hot-loop-census.js` reads the series file directly since 4c819b18.

**What this does NOT say.** Shares of block entries are load-immune and
comparable window to window, which is why they are the unit here — but they
are not time. `ops/block` falls steadily across the series (10.29 → 4.87), so
later windows retire cheaper blocks, and a share of entries is not a share of
wall clock. Nothing above should be quoted as a speedup.

## GAMEPLAY REACHED (2026-09-28), and a replayable route into it

The Prologue now plays: HUD, Thrall selectable (Level 1 Far Seer, 500/500),
move orders obeyed. Recorded by stepping a frozen CLI session with
`tools/ctl.js` and logging each action at the batch it was sent. The whole walk
is the `wc3g` game in `tools/uop-game-ab.js`, which replays it as `--input`:

```sh
node test/run.js --app=warcraft3_demo --no-threads --headless-gl   # or --gl-renderer=software
  --batch-size=20000 --max-batches=21530 --no-close --input=<wc3g's list>
```

| batch | state |
|---|---|
| 2000 | main menu (640x480 layout: Single Player 546,113) |
| 2300-2820 | profile `ABC`: keypress 65/66/67, Create 203,173, row 130,225, Select 203,314 |
| 3050 | Campaign 546,149 -> campaign screen by ~3550 |
| 3650 | Prologue **bullet** 433,156 -> map load |
| ~15950 | Chapter One card, PRESS ANY KEY |
| 16530 | `keydown:32` (a click on the bar does NOT dismiss it) -> in-engine cinematic |
| 18350 | `keydown:27` skips the cinematic -> gameplay HUD by 19170 |
| 19170+ | select Thrall 230,300; `rclick` 385,125 / 520,260 / 150,230 |

The map load that took ~40 minutes on 2026-09-14 now takes about 12,000 batches
at `--batch-size=20000`, 2-3 minutes of wall clock. The replay reproduces the
interactive recording's final frame to 0 pixels (same renderer), and it is
deterministic across renderers in guest terms: the micro-op tier's counters
are identical under software GL and `--headless-gl`.

**Headless GL needs an AWAKE display, not just a kept-awake one.**
`caffeinate -d` stops the display from sleeping but does not wake one that
already has. `caffeinate -u -t 3` (a simulated user-activity assertion) wakes
it, and `caffeinate -dimu` holds it for the run. Check for `1 display(s)` in the
`[gl]` line. With zero displays both arms reach the "unable to initialize
DirectX" modal, run at spin speed and compare as IDENTICAL, which reads as a
pass.

Software GL draws a large grey wedge across the left of the opening cinematic
(filmed at batch 18350). It does not block anything and was not investigated.

**SOLVED (2026-09-28): the wedge was our glDrawElements reading indices past a
guest page end.** Not the software rasterizer: `--headless-gl` drew the same
wedge at the same place (dark and bark-streaked there, flat grey under
software -- the texture coordinates were garbage too). `--trace-gl
--trace-gl-verts` (new: every vertex of each packed draw) over batches
18000..18120 found one draw per frame, a 612-vertex cliff mesh (`tex=0x3ce`,
and its second pass `0x471`), whose vertices are sane up to v367 and garbage
from v368 on: `(-1.70141e+38, -1.70141e+38, -1.74145e+38)`, `(6.5e-43,
7.3e28, 0.79)`, normals read as positions. Index 368 is byte 736 of a u16 index
array -- the page end. `$gl_state_intercept` op 102 did `$g2w` on the index
pointer once and walked that wasm pointer through all `count` indices, and
`$gl_array_addr` translated only each vertex's first byte; Game.dll's buffers
live in sparse VirtualAlloc pages that are not adjacent in wasm memory, so
everything past the boundary was read out of unrelated memory. Both GL
backends consume the same packed stream, which is why both showed it.

Fixed in `src/09a8e-gl-state.wat`: indices and every array component are
translated per element (`$gl_array_read`/`_or_zero` take guest addresses now),
and `src/09a8c-gl-encoder.wat` `$gl_copy_from_guest` gathers copied pointer
arguments (matrices, light/fog vectors, `glCallLists`) that cross a page.
Regression: `test/test-opengl-sparse-page-arrays.js` (fails on the old code
with `-3.7e28` for a straddling vertex). After the fix the cinematic frame is
clean in both renderers and no traced vertex exceeds 1e10.

Same bug class, not fixed: borrowed texture uploads (`glTexImage2D`/
`glTexSubImage2D`) are still read as one contiguous span from one translation
in `lib/gl-compat.js` `_pointerBytes`, and the small `glColor*v`/`glNormal3fv`
/`glVertex*v` readers in `09a8e` read up to 16 bytes off one `$g2w`.

About 500 block decodes per batch run during gameplay (1.2M across 19170..21530)
in both uop arms, with 97% of all decode work in storms. That is worth a
`--trace-code-writes` look on its own.

## Decode storms were the emulator's code cache, not guest SMC (2026-09-28)

The ~500 decodes/batch in gameplay had **no guest cause**. `--trace-code-writes`
over the whole route: **0** retiring guest writes. What it did show — 818K
blocks retired "by an overlapping publish", top pairs Storm `0x00cad89b <-
0x00cad8a0` (Storm+0x3389b, a `nop; lea esp,[esp]` alignment pad falling into
a loop head) and Game.dll `0x005e7353 <- 0x005e735b` — is the ordinary cost of
re-decoding pages that had been thrown away: the outer entry and the loop head
share bytes, so rebuilding one retires the other. The pages were being thrown
away by three emulator mechanisms, found in this order:

1. **Chain-epoch wrap flushed the whole cache.** `$chain_bump` (04-cache.wat)
   runs on every retire, page drop and chunk free; its 13-bit epoch wrapped
   every 8192 bumps and requested a full `$thread_arena_flush_if_safe` — even
   though block chaining is OFF by default and no slot held an epoch. 736 full
   clears over the route, 154 of them in the 2360 gameplay batches (one every
   ~15). Fix: `$chain_slots_live`, set by `$chain_patch`, cleared by the flush;
   with it 0 the wrap just restarts at 1. Clears 736 -> 30. Decodes barely moved
   (1.113M -> 1.117M in gameplay), because the clears were a symptom of (2)/(3).
2. **Page-index arena too small.** 128 index slots on the main thread; gameplay
   executes ~450 distinct code pages. `$page_index_alloc`'s clock walk evicted
   a live page on almost every page miss: 549K "index arena full" evictions.
3. **Page directory aliasing.** PAGE_DIR is direct-mapped on page number with
   1024 entries, so pages 4MB apart share a slot (Game.dll at 0x561000,
   Storm 0xc7a000, msvcrt 0x1213000...): 585K collision evictions.

`test/run.js` now prints `cache: page evictions by cause: index arena full N |
directory slot collision M` — that split is what made (2)/(3) visible, since
`cache_evicts` had lumped them together.

Fix for (2)/(3): main-thread index slots 128 -> 512 (`PAGE_INDEX_ARENA`
0x33C000 -> 0x69C000), directory 1024 -> 4096 entries (`PAGE_DIR_BASE` 0x26000
-> 0x3E000), and a **second-chance** bit at PAGE_DIR +24 (set on create and on
`$page_enter`, cleared as the clock passes) so eviction skips recently entered
pages. Worker sizes unchanged. Measured arms, same route, uop off:

| build | gameplay decodes (19170..21530) | whole-route decodes | full clears | guest ms/batch gameplay |
|---|---|---|---|---|
| before | 1,113,408 | 6,262,093 | 736 | 5.86 |
| epoch fix only | 1,116,801 | 6,177,622 | 30 | (noise) |
| + 384 slots / 4096 dir | 247,127 | 652,761 | 0 | 4.39 |
| + 384 / 4096 / second chance | 192,847 | 503,666 | 0 | 3.53 |
| + 512 / 4096 (plain clock) | 60,572 | 185,846 | 0 | 3.77 |
| **shipped: 512 / 4096 / second chance** | **35,512** | **125,618** | **0** | **2.43** |

Gameplay decodes -97% (472/batch -> 15/batch); gameplay guest-slice time
5.86 -> 2.43 ms/batch and the whole route's guest time 175.8s -> 102.7s
(wall-clock, loaded box, same order of runs — read the decode column as the
durable number). The final frame is the same scene (HUD, Thrall selected,
500/500) but not pixel-identical: cache layout changes which fall-throughs are
free, which moves the block-budget clock, so animation phase differs — the same
8.6% difference appears between the baseline and the epoch-only build.

Still open: 11.6K index-full evictions remain over the route (mostly the map
load); Storm+0x3389b/0x338a0's pad-into-loop-head pair still re-decodes each
other when either is rebuilt (a `$fuse_stop`-like "stop at an existing entry"
already exists for the forward direction in `$decode_block`; the backward
direction — a head published INTO an existing outer block — retires the outer
one by design, see `$page_publish`).

## x87 fold under `--threads`: FPU_UNIMPL in the Miles MP3 thread (2026-09-28)

`?debug&uop&x87-fold` with Worker threads trapped within a minute:
`UNIMPLEMENTED API: FPU_UNIMPL` at `Mp3dec.asi+0x68ca` (orig VA `0x26f068ca`,
straight-line IMDCT butterfly `fld/fchs/fmul/fadd/fxch/fstp`), ESP in tid 4's
stack (Mss32 thread entry `0xecc590`). Fold off: clean. Cooperative CLI with
the fold: clean. So the trigger was parallel decoding, not the x87 code.

Cause: `$OP_INDEX` -- the decoder's op-start list for the block just emitted,
which every loop matcher and x87 fuser reads right after `$te` fills it -- was
one fixed region shared by every instance. Two Workers decoding at once
overwrite each other's list between `$te` and the fuser, so thread A's island
fuser (`$x87_island_fuse_block`) walks thread B's record pointers, rewrites a
handler word in B's thread-cache partition, and packs a run count that spans
records from two unrelated blocks. H451 then feeds a non-x87 record to
`$fpu_exec_reg`, which traps. The island is simply the fuser most willing to
match garbage (any 3+ H188/189/190 in a row); every other matcher had the same
race and mostly declined.

Fix: `$OP_INDEX_REGION` is tid-strided (16 x 8KB); `$OP_INDEX` is a
per-instance global that `$init_thread` points at `tid * $OP_INDEX_SLICE`.
Regression: `test/test-op-index-per-thread.js` (two instances on one memory;
fails on the old layout with "thread B's decode must not rewrite thread A's
OP_INDEX"). After the fix the browser repro ran 120 s, screen live in 112/121
probes, no FPU_UNIMPL.

Still shared and still racy in worker mode, not fixed: `$BX_RG_BASE` (block
executor region builder, only with `--block-exec`) and `$PAGE_OVFL_MEMO`
(a heuristic memo; a lost update costs a decision, not correctness).

## Software GL drew nothing, 2026-10-06: a second SetPixelFormat was refused

The GLD3D sweep found `--gl-renderer=software` black from boot: 2.85M
`glLightfv`, 413 texture uploads, 2677 presents, zero `glDrawElements`. The
context creator at Game.dll `0x6f0bc180` (runtime `0x61d180`) does GetDC,
DescribePixelFormat, SetPixelFormat, and calls `wglCreateContext` only if
SetPixelFormat returned TRUE. WC3 sets format 1, creates and deletes a probe
context, destroys its BlockingWindow, then sets format 1 again on the same
window for the real context. `$gdi_pixel_format_set` refused any second set,
so no real context was ever made. Setting the format a window already has
succeeds on Windows and in Wine (only a different format is refused): fixed in
`579ee802`, and the main menu renders on software GL again by batch 2000.
Evidence `scratch/runs/20261006T030624Z-warcraft3_demo-swgl-regress`.

## Original Prologue browser preparation, October 8

The September 28 CLI controlled gameplay above remains historical evidence;
the October 6 WebGL menu result does not supersede it or establish fresh browser
control. Prepared ordinary browser harness `tools/warcraft3-prologue/` uses
accepted source/host `f62ab3c9` and module `4dc5ac2c`, retaining SetPixelFormat
`579ee802` and sparse-page GL reads `604f0fd14`. No new build is needed.

All 12 registered media paths are present in the shared fixture tree, including
War3Demo.exe SHA `4bfa825510527235c2a14f7682dba1d4b339664f312f85206f01206e98d8000a`,
Game.dll SHA `286823c37a1083e91f07d040e46a9df7af4c4952e01fcbba460589bd4e297654`,
Storm.dll SHA `99974ea6dab31eff68a6c22d259dd6d8abcab0b2947417b3b41ebf01ab366e61`,
and war3.mpq SHA `9e19d7ffb65054e4bdd3add7e26d70e16f063cdc20fa5b57639f3b9b7a196f9c`.
The isolated worktree lacks private fixtures; preparation hardlinks originals
from the shared fixture tree and authenticates the immutable baseline closure.
A broken historical `Warcraft` symlink is outside the registered route.

Prepared run `20261008T0135Z-warcraft3-prologue-ready` passes 542 SHA pins,
542 HTTP HEADs, eight full GET hashes, range and drain checks. This is source
and local HTTP readiness, not browser execution. The input harness requires
personally reviewed actual state before every ordinary ABC/Create/Select,
Campaign/Prologue, chapter Space, cinematic Escape, Thrall/right-click action.
It checks live host AND owning renderer `api: gl` WebGL endpoints; neutral D3D
endpoint proof is rejected. FPS/audio are unknown. Budget and serialized
runtime conditions are in the [handoff](../../ops/handoffs/warcraft3-prologue-20261008.md).


### Fresh ordinary WebGL navigation reached Campaign, October 8

Run `20261008T0134Z-warcraft3-prologue-runtime` used the unchanged accepted
`f62ab3c9` / `4dc5ac2c` closure on temporary bx_qms4q3z7. The original demo
renders and ordinary trusted inputs reach Single Player Profiles, visibly type
ABC, create/highlight that profile, Select, and reach Campaign with Prologue
visible. Fourteen reviewed captures and live host AND owning `api: gl` WebGL
endpoints are retained. Pointer Lock was false in every scene. The former
October 3 inability to type a profile is not reproduced on this reference.

Actual screenshot targets at this viewport were 594,327 (Single Player),
228,391 (Create), 226,542 (Select), 593,365 (Campaign). A first 750 ms click
remained at main-menu hover; a later five-second click reached Profiles.
Create similarly responded only in a later capture after another reviewed
click. Select/Campaign used separate reviewed hover before five-second holds.
This records ordinary input response; the precise first-click cause is unknown.
The GPU backing canvas's zero DOM rectangle is not valid target geometry.

The original 600-second deadline stopped the run after Campaign, before any
Prologue bullet/map/chapter/cinematic/Thrall input. **Fresh Prologue gameplay
is not qualified.** September 28 gameplay is retained historical evidence.
Next queue a fresh <=600-second ordinary route with these reviewed hover/hold
steps and the majority of time reserved for actual map loading and controls.
No engine patch, rebuild or optimization is justified by this route cap.

354 actual served hashes (261 full, 93 range) match the source pins; actual
full WASM response is `4dc5ac2c`. Original 12 registered paths remain present
and unmodified. FPS/audio are unknown. Deadline cleanup at 01:45:38.601 closed
Chrome with exit 0 and streams 0; independent PIDs/socket/pins checked, all
34 actual attempt files downloaded, prefix removed at 01:46:29.223 within the
90-second cleanup budget. Shell auth/stdole2 probes were strictly refused and
retained. See the [handoff](../../ops/handoffs/warcraft3-prologue-20261008.md)
for exact source/media identity, cleanup receipts and transient local disk-floor
violation; no original media or evidence was deleted.

## Fresh original Prologue unit movement (2026-10-08)

Run `20261008T0156Z-warcraft3-campaign-world-runtime` advances beyond the
previous Campaign-only result on the same unchanged `f62ab3c9` reference and
actual served module `4dc5ac2c`. The reviewed `b17bb614d` browser helper is
unchanged. Original media, source and archives were reused through hardlinks;
all 542 pins and 788 served full/range hashes match.

Ordinary ABC/Create/Select/Campaign followed by the actual Prologue bullet at
page (473,373) reaches Chapter One: Chasing Visions. The chapter subsequently
says PRESS ANY KEY TO CONTINUE. Space enters the visible cinematic; Escape
leads to the gameplay HUD. The first Thrall click at (255,524) shows his hover
label; the next selects him with Level 1 Far Seer, health 500/500, mana 285/285.
Right-click (375,430) moves him from the lower path to below the stone circle;
right-click (220,480) moves him back left/down. Compare `thrall-selected.png`,
`move-order.png`, `move-return.png` and the settled `gameplay-final.png`:
the hut, circle, rocks and camera remain fixed. Worker reviewed these actual
screenshots. Coordinator review/integration is pending at worker exit.

Matching host AND owning OpenGL WebGL endpoints and Pointer Lock false are
retained with every state; trusted ordinary inputs and host right DOWN/UP
receipts are recorded. No guest-state or clock changes, engine fix, rebuild,
native run or performance benchmark was made. FPS/audio/combat/completion and
whole-game compatibility remain unmeasured. Ordinary quit at 02:15:53.697
closed Chrome with exit 0 before the original 02:17:36.858 deadline; all 67
actual files were SHA-checked, independent PID/socket/pin checks passed, and
the scoped remote prefix was removed at 02:16:07.994. Root owns the adopted
temporary box. The [scoped handoff](../../ops/handoffs/warcraft3-campaign-world-20261008.md)
records exact screenshot/source identities, strict shell probe refusals,
resource checks, and a preparation receipt hardlink mistake restored exactly
against both prior sealed indices. No further phase follows in budget mode.

## Control route and frame counter qualified (2026-10-10)

The `wc3g` replay still reaches Prologue gameplay on main (bc3505ce6): Thrall
selects (portrait, Level 1 Far Seer 500/500, command card) and walks all three
right-click move orders. Deterministic: the HUD and final frames are
byte-identical across three runs, with and without tracing. Evidence:
`scratch/runs/20261010T0330Z-warcraft3-demo-control-frames`.

**Frame counter.** `--present-distinct` counts GL presents (kind `gpu`, from
`gl-compat _publishContext`). Over batches 19170-21530 it counted 54, and
`--trace-gl=gpuPresent` over the same window traced exactly 54
`gpuPresent(0x310002)`: one GL context, one present per guest `SwapBuffers`.
`--frame-stats`'s flush series fires **twice** per frame here (the present and
the window blit, 0-1 batches apart), so take one per pair before reading
intervals (`wc3-frames.js` in the evidence directory does).

**What a frame costs.** p50 43 batches of 20,000 blocks between frames (~860k
guest blocks per gameplay frame), p90 66, max 85. The route runs at the default
200 ms/batch tick, so "presents per guest-second" (0.1) is a tick artifact, not
a frame rate. The boat CLI (4 vCPU, software GL) produced 2.9-3.4 frames per
wall-second; browser FPS is not measured.

**Fresh boats cannot fetch this demo:** `fetch-candidate-corpus
--id=warcraft3-demo` downloads `W3Demo.exe` and then fails `7z exit 2` with no
`unar`. Ship the local install tree, and `test/binaries/dlls` too: without the
real `msvcrt.dll` the game traps on `_clearfp`.

## Browser gameplay profiling: cooperative versus Workers (2026-10-19)

Evidence: `scratch/runs/20261019-wc3-profile`. Two sequential 60-second
profiles reach the original Prologue HUD, select Thrall, move him toward the
stone circle and return him to the starting path. Timings cover the selected,
stationary unit in the animated gameplay world, after live warmup; they do not
cover combat. Both final images and move-order evidence were reviewed.

| Measured gameplay presentation | No threads / cooperative | Workers |
|---|---:|---:|
| GPU presents in 60 seconds | 1253 | 848 |
| Guest GPU presents per wall-second | 20.88 | 14.13 |
| Inter-present median | 45.81 ms | 67.47 ms |
| Inter-present p95 | 63.87 ms | 99.88 ms |
| Six consecutive 10-second rates | 19.9–21.4 | 13.2–15.0 |
| Page rAF rate | 60.0/s | 60.0/s |
| Main-thread long tasks over 50 ms | 0 | 0 |
| Host one-minute load, before → after | 5.23 → 5.45 | 7.54 → 12.76 |

Workers presented 32.3% fewer frames in these observations. This is a
**preliminary comparison, not an isolated causal speedup measurement**:
the machine was shared and busy, each mode has one profiled window, and
profiling twelve Workers adds different overhead from profiling one page.
Some host load is the emulator itself; the load increase cannot simply be
attributed to unrelated jobs. Ten-second subdivisions are not independent
repetitions. `gpu` presents are the guest metric; 60 Hz page composition is
not 60 Hz Warcraft gameplay. No audio, Safari, mobile or completion claim.

Both use headful Chrome 155.0.8059.80 on Apple M1, hardware ANGLE Metal,
native 800×600 guest canvas, 1280×900 page viewport, WebGL, uop tier and
default slice 100000. Both origins serve COOP/COEP and report isolation true.
Cooperative has no guest Worker; the other reports backend `worker`, an
actual guest-main Worker, ten additional guest Workers and the owning WebGL
render Worker. The toolbar wraps differently with the Worker status label;
the guest backing resolution remains 800×600. The complete source snapshot
predates the concurrent final-display gamma changes and lazy-audit changes.
It was rebuilt in `/private/tmp/wc3-profile-20261019`, not in the root tree:
WASM SHA-256 `4eb9264e9326b95f5e1922a2bd2b62e0558dba00205d85c307ea2eb47d7863bc`,
layout `eb58be38f5ebb837`. `identity.json` records source hashes and original
commit; `combined.wat` is retained for exact profile symbol resolution.

The cooperative page spends 82.7% of sampled non-idle time in WASM. Its top
self-time entries are `$uop_fast` 13.2%, `$x87_island_fast` 5.2%,
`$branch_end_at` 4.5%, `$g2w_slow` 4.2%, and `$th_load32_rop` 4.0%.
`$gl_finish_immediate` is 1.9% and `$gl_state_array_element` 1.5%; page
`drawImage` totals only 118 ms over 60 seconds. Guest execution is the main
observed cost, rather than final canvas copying.

Worker profiling identifies additional scheduling/transport work worth
investigating: page `postMessage` accounts for 10.0 seconds of samples and
`worker.onmessage` 6.7 seconds. Two other guest-Worker profiles each spend
roughly 16.5 seconds in non-idle samples, dominated by message sending and
dispatch, with little WASM execution. The first/main guest Worker records
10.8 seconds in `waitForResponse`; that function blocks in `Atomics.wait`,
so the harness's “busy” label must **not** be read as actual CPU consumption.
The render Worker records 7.6 seconds of non-idle samples, chiefly GL uniform
setup and drawing. These profiles support examining redundant worker
slice/status messaging and synchronous RPC waits before a rendering rewrite;
they do not by themselves prove which change would improve throughput.

Navigation used the existing `ctl.js` hub and frozen-step workflow, with
native-coordinate screenshots before inputs. `preparation.json` records
the route and commands; `run.sh` reproduces the gated profiling harness.
Initial setup failures were a stale local WASM/mirror pair and a snapshot
missing the root `binaries -> test/binaries` symlink, which caused the real
CRT lookup to fail and fall onto `_clearfp`. A matched build and the original
fixture route resolved both, without implementing a new CRT stub.

**Frozen-resume clock edge case:** if stepped guest time exceeds
`performance.now()`, `setFrozen(false)` computes a negative `wallStartMs`.
The live tick path treats that valid negative origin as uninitialized and
resets it to now. The guest clock then remains at its prior maximum, yielding
zero presents while scheduler ticks continue. This was observed in both
arms, not counted as performance. Waiting until wall time exceeded the
stepped time and using ordinary `frozen on` / `frozen off` rebased a positive
origin and restored clock/frame progress. No clock fields or guest memory
were edited. Future runs should fix that generic origin-sentinel issue or
avoid stepping guest time ahead of wall time; do not interpret the resulting
paused screen as a WC3 deadlock. No runtime optimization was made here.

### Cooperative profile attribution follow-up (2026-10-19)

Reclassified the same saved 60-second profile against its own `combined.wat`,
not the current build. Analysis is in
`scratch/runs/20261019-wc3-coop-deep/profile-breakdown.json`; these are sample
shares, not independently measured speedups. Non-overlapping stack attribution
assigns 50.51% to main guest execution excluding GL, 24.57% to cooperative
background guest execution, 16.98% to GL encoding/frontend, and 7.94% elsewhere.
Tail calls can erase callers, so these stacks do not identify guest PCs.

A concrete GL candidate is repeated translation of the encoder's own scratch
vertices: `$g2w_slow` under `$gl_append_vertex4` and `$gl_finish_immediate`
accounts for 739.851 + 736.834 ms, or 2.45% of total sampled time. The existing
`$gl_alloc_affine` verifies contiguous backing, and `$gl_immediate_wa` retains
its mapped address, but append/copy still translate each field separately.
Reusing that verified mapped base for internal scratch packing is a bounded
candidate; arbitrary guest client arrays must retain sparse-safe translation.
No optimization or speedup is claimed yet.

Background execution also deserves attribution: 2191 ms of
`$x87_island_fast` self samples descend from cooperative `runSlice`, versus
844 ms from main execution. Per-thread timing through the existing
`__waProfileThreadRun` hook is needed before assigning this to audio or game
logic. JS uniform handling is another smaller candidate (`setUniform` 1.20%,
`_applyUniforms` about 1.08%); final window composition is only 0.69%.

The fresh follow-up navigation did **not** produce a valid gameplay timing.
Frozen status reported about 1,174,278 ms before resume and 88,400 ms after;
later inspection found audio-thread waitStartedAt around 1,174,273 while
the live scheduling clock was only 365,735. `clock-mismatch.json` preserves
the subsequent paused state. Do not merge this run with the original CPU
profile. The final reviewed image reached the briefing's PRESS ANY KEY
prompt, not gameplay; the harness gate timed out and sampled the deliberately
frozen page with zero guest presents, then closed its browser. A static map
image alone was not evidence of a game deadlock.

Preparation counters also distinguish low-work import retries from zero work:
threads 8/9 repeatedly returned yield 9 at `0x07500300`, retiring two blocks
per call. These are retry slices, not zero-block slices. Counts from loading
are diagnostic evidence only and do not establish gameplay throughput.

### 2026-10-19 Worker scheduling census (diagnostic, not another FPS result)

Evidence: `scratch/runs/20261019-wc3-threads-deep/loading-census.json` and
`loading-census.png`; commands in `run.sh`, `sample.js`, and
`control-commands.ndjson`. Separate fixture `/private/tmp/wc3-threads-deep-20261019`
copies the earlier matched profile build (WASM SHA256
`4eb9264e9326b95f5e1922a2bd2b62e0558dba00205d85c307ea2eb47d7863bc`).
Runtime code unchanged; census wraps message dispatch and Atomics.wait and
uses built-in `?rpc-census`. Browser Chrome155, Worker backend, COI enabled.

Guest threads/slots8 and9 accumulated692,821 and692,964 yield9 returns,
respectively. Their **entire** accumulated slice wall times were only1,278.34
and1,256.36ms. Thus roughly1.386 million blocking-import retry slices did
almost no guest work. This is cumulative preparation evidence, not a rate
measured during gameplay. **Correction:** yield9 is not specific to critical
sections. The later live check found CS address/owner/park EIP all zero for
T8/T9, with EIP0x07500300. As already identified above in the IOCP investigation,
this is War3Demo import96, GetQueuedCompletionStatus. These are IOCP consumers,
not demonstrated lock contenders; the earlier CS attribution was incorrect.

The exact snapshot `lib/thread-manager.js:2327` handles every yield9 with
`await thread.link.callExport('clear_yield')`, then leaves the thread eligible
for the next scheduler round. Every retry therefore entails a slice request
and reply plus an additional clear_yield request/reply. This provides a
specific source explanation for the earlier profile's message-heavy Workers.
Next candidate for these IOCP waits: bounded retry pacing or host-round gating
instead of immediate free-run redispatch. An actual CS waiter can separately
use ownership checks, but only after verifying its current EIP matches the
reported CS park EIP: console and IOCP waits also use yield9. These proposals
are not measured speedups.

The five-second census separately identifies slot4, start0xecc590, as audio:
699 slices,1,244,926 blocks,464.07ms slice wall,624 asynchronous voice ring
submissions. Its measured Atomics.wait time for wait_single/set_event was
about110ms; blocked elapsed time must not be reported as CPU. Slot11,
start0xee7690, made302 seven-block wait iterations (40.53ms slice wall).

Fresh preparation did not produce another valid gameplay sample. The census
image is the chapter/map screen; main is parked on infinite wait handle
234882057, while background audio continues. Frozen-to-live clock readings
also regressed during preparation. Zero presents here are **not** gameplay
FPS or proof of a deadlock. The earlier20.88 versus14.13 presents/s comparison
remains the only gameplay comparison and retains its unequal-load/single-run
limitations. No runtime optimization, merge, or deployment was performed.

### Worker import retry and frozen-clock fixes (2026-10-19)

The fix separates the two meanings of yield9. An actual critical-section
frame is qualified by its current EIP matching the reported `csParkEip`;
only then can an aligned, in-bounds shared owner word keep it parked. A
changed owner permits a retry, with acquisition still checked by WAT. Missing,
packed, or stale diagnostics retain the retry path rather than blocking an
unrelated API.

The WC3 IOCP consumers take that generic path: retry no sooner than one host
millisecond later, instead of immediately chaining free-running Worker RPCs.
The scheduler's idle bound and nested callback pumps honor the deadline;
`clear_yield` is deferred until the retry, and an in-progress preparation guard
prevents duplicate clears/slices. Guest handler logic still determines queue
completion and timeout. This pacing uses the host clock, not frozen guest
time, so agent stepping cannot strand the retry.

Separately, frozen mode now latches already-observed audio/deadline time and
stops the continuous guest clock as well as batch ticks. Resume preserves the
same epoch. Zero/negative wall origins are valid; null denotes an uninitialized
origin. Deterministic regression tests cover stepping ahead of wall time,
startup-clock scaling, pending deadlines, retry races, and stale CS records.

Acceptance evidence: `scratch/runs/20261019-wc3-fix-verified`. Reviewed original
Prologue HUD, Thrall selection, movement toward the circle, and return to the
starting position. Chrome155/Apple M1 hardware WebGL, actual Worker backend,
800x600 guest, one browser. Thirty seconds after movement produced 705 GPU
presents (23.49/s), p95 interval59.17ms, no observed main-thread long tasks.
This is a gameplay observation, **not a controlled speedup comparison** against
the earlier profiled run. T8/T9 added4371/4369 slices across the surrounding
measurement/report interval, with about30.5/30.1ms guest slice wall time, and
their CS diagnostics remained zero. Audio thread4 still did substantial work.

The live freeze check held guestMs10017 through a1.5-second wall pause and
resume, then advanced to11020 after another second. Focused scheduler/clock
tests pass. The broader browser checks passed Notepad/Calc/Win16/Rodent2000/
Winamp execution and input. Its two COM-loader failures reproduce in the
untouched baseline; `test-thread-manager.js:570` also fails on that baseline.
The root build now passes all gates after reviewing the changed host-file
callback-lifetime inventory (including the earlier renderer gamma change).
Root WASM and mirror both use layouteb58be38f5ebb837; rebuilt WASM SHA256
4eb9264e9326b95f5e1922a2bd2b62e0558dba00205d85c307ea2eb47d7863bc
matches the acceptance fixture byte for byte, replacing the stalef008dcdb
artifact that caused the original launch failure. No deployment.

Earlier fix validation folders retain their limits: `20261019-wc3-fix` reached
the cinematic, not gameplay, while `20261019-wc3-fix-gameplay` timed out at
briefing because direct renderer keyboard calls targeted HWND0. The final
driver uses `agent-remote.runCommands`, the same DOM-event path as `ctl.js`,
and waits for the visible gameplay HUD before moving and sampling.

### Queued GL transport and mapped scratch candidates (2026-10-19)

The next Worker bottleneck is architectural: each native GL stream flush
parks its producer until the page broker and render Worker have replayed it.
The producer cannot prepare the next frame while that rendering runs.

The candidate retains synchronous local/cooperative rendering, but lets the
Worker producer resume after the page takes an immutable copy of eligible
GL commands. Admission and replay remain ordered across owners, with at most
two owned buffers of 2 MiB each. The next submission waits for space.
Only reviewed scalar commands, copied matrices, and packed vertex records
qualify. Queries, context operations, borrowed pointers, bitmap contexts,
software rendering, and unknown commands retain synchronous completion.
`?gl-sync` disables early acknowledgment for comparison with the same code.

Early SwapBuffers/glFlush acknowledgment also requires a known current
top-level drawable and the existing shared pre-GDI ownership flag. The flag
is set before releasing the producer. The actual pre-GDI host import drains
earlier GL work, resolves canonical pixels, and clears ownership within the
ordered admission queue; later submissions cannot lose their ownership flag
to an older readback. Frames retain the original window identity and captured
WAT client dimensions, so destroyed/reused HWNDs reject stale frames and a
later resize does not change an older batch's drawable. Context ownership is
replaced from the render Worker's complete authoritative owner map. Async
errors remain sticky; teardown drains accepted work before endpoint retirement.

Focused protocol tests cover buffer reuse, embedded vertices, bounded queue
pressure, cross-owner query ordering, borrowed/software fallbacks, failures,
teardown, context deletion, stale HWNDs, and captured geometry. The real
`createHostImports`/`Win98Renderer` integration test verifies delayed red GL
terrain followed by green GDI pixels through the actual pre-GDI import.
The separate existing WAT Worker test stops before GL assertions because its
harness does not handle the `beep_process_begin` startup RPC; this is not
evidence of a rendering regression.

The independent encoder candidate uses the already verified affine
`gl_immediate_wa` allocation for internal vertex append/copy. Arbitrary guest
arrays keep sparse-safe translation. Full isolated build gates, the complete
encoder byte-oracle suite, and sparse-array tests pass. On ARM64, inspected
SpiderMonkey 155 Ion append/copy code shrank from 1208/288 to 744/156 bytes;
V8 15.4.49 TurboFan from 6144/1408 to 4608/448 bytes. Internal copy now uses
direct loads/stores, and append removes nineteen per-vertex translation calls.
Candidate WASM SHA256 is
`a55ff0505fb749d3e5597c424d5fc10ef6df41319cdf7f4025285408d0b5632f`.
Reviewed build/test/native evidence is retained in
`scratch/runs/20261019-wc3-gl-scratch`.
These are code-generation and correctness results, not an FPS claim.
Gameplay comparisons remain required before declaring either candidate faster.

### Concurrent completion queue and GL admission (2026-10-20)

The actual shared-WASM IOCP stress test demonstrated a queue race: two
consumers received 385 completions from 256 posts, with 129 duplicates and
an underflowed count. The serial control delivered 256 unique completions.
Queue headers, associations, creation and closure now use the existing
owner-aware lock in the unused IOCP region tail. Dequeue snapshots the packet
before releasing the lock and writing guest outputs. Completion publication
checks a slot generation after guest writes, preventing a reentrant close and
reuse from receiving an old completion. Concurrent creation, producers,
consumers, wraparound, timeout, and close/reuse regression tests pass.
Reviewed proof and fixed-build evidence:
`scratch/runs/20261020-wc3-iocp-race`. This proves a correctness fix, not
that this race caused a particular loading stall or a measured FPS improvement.

The first gameplay queue comparison admitted zero owned batches and therefore
did not measure asynchronous rendering. Live command inspection found copied
light/material/fog vectors missing from the admission whitelist. These now
require matching pointer arguments and exact copied payload lengths. The
sample also shows a `glFinish` after each frame, which remains an explicit
completion barrier. Roughly 22 small borrowed texture uploads per frame also
force synchronous flushes. A live follow-up captured 16x16 RGBA unsigned-byte
uploads, motivating a separate bounded texture-copy candidate.

The bounded copy candidate captures only `glTexSubImage2D` RGBA/BGRA
unsigned-byte updates up to 64 KiB whose rows need no padding for any
supported alignment (even width, or a single row). Other layouts and larger
uploads remain borrowed. The existing sparse-safe copy path owns the pixels
at call time; the host validates the corresponding captured pointer and
extent before asynchronous admission. Tests verify 22 uploads submit once at
the explicit finish barrier, source mutation cannot change the captured
pixels, and sparse-page crossings preserve bytes. Encoder parity, protocol,
sparse-array tests and the full build pass. Reviewed ARM64 V8/SpiderMonkey
code shows the added bounded predicate, without a new translation path.
Evidence: `scratch/runs/20261020-wc3-small-texture-snapshots`.
The combined IOCP/scratch/texture WASM is
`ee91eb437aa0405dffb5d1cb53904d8ac275f346c110f3de92635d5acaa43665`.

Sequential Chrome gameplay runs of this same build, using the original
Prologue select/move/return route and three unprofiled 25-second samples:

| Mode | Sample 1 | Sample 2 | Sample 3 |
| --- | ---: | ---: | ---: |
| Threads, queued GL | 23.92 FPS | 29.56 FPS | 29.20 FPS |
| Cooperative | 20.64 FPS | 23.76 FPS | 23.07 FPS |

Only one test browser ran at a time. Both modes reached gameplay and visibly
selected and moved Thrall. Threaded submissions fell from approximately
25 per guest frame in the prior candidate to 2.1; one batch per frame was
owned asynchronously and queue depth stayed at two. Threads were faster in
these local samples, but the host was busy (final load approximately 4.03
for threads, 5.48–5.60 for coop), so this is not a controlled causal speedup
measurement or a guarantee for other scenes/devices. The earlier paired
queued/synchronous comparison alone was mixed and establishes no reliable
speedup. Evidence:
`scratch/runs/20261020-wc3-texture-threads`,
`scratch/runs/20261020-wc3-texture-coop`, and
`scratch/runs/20261020-wc3-iocp-async`.

The root local build now byte-matches the tested `ee91eb43` WASM with layout
`eb58be38f5ebb837`. The local server serves the real 278581-byte
`binaries/dlls/msvcrt.dll`; a fixture without that directory reproduces the
reported `_clearfp` failure. Restore the fixture assets rather than adding
a silent CRT stub.

### Committed-build profiling and retry coalescing (2026-10-20)

The 30-second Worker capture of `829f2ae3f` is retained in
`scratch/runs/20261020-wc3-committed-worker-profile`. Main-worker self samples
are dominated by interpreter execution: `uop_fast` 3657 ms, `branch_end_at`
1652 ms, and `th_load32_rop` 1430 ms. Its 4597 ms in `waitForResponse` is
blocked elapsed time, not CPU consumption. The page and render Worker were
approximately 87% idle. Profiling overhead and a busy host make the recorded
20.89 guest presents/s unsuitable as an unprofiled performance comparison.

Due yield-9 retries previously issued a separate `clear_yield` export request
before every slice. The retry flag now travels with the slice. The Worker
checks it after incoming-send guards and only clears a live yield 9. If the
live yield changed to another nonzero wait, it reports the current state
without executing guest code, resuming the wait, or consuming sleep flags.
A skipped callback-owned slice retains its original retry metadata. Other
wait, render and query protocols are unchanged. Scheduler/protocol, API
batching, vblank and callback-census tests pass; evidence is in
`scratch/runs/20261020-wc3-retry-slice`.

Sequential 30-second unprofiled gameplay samples measured 25.49 FPS for the
control and 25.79 FPS for the candidate, with approximately 53.3 ms p95
presentation intervals in both. These single windows had unequal busy-host
load, so there is no reliable FPS improvement claim. The confirmed transport
change is 8960 -> 1 separate clear requests and 36689 -> 27674 total requests,
while slice counts were similar (22103 -> 22124). Selection and movement
were visually reviewed. Runs:
`scratch/runs/20261020-wc3-cache-cause` and
`scratch/runs/20261020-wc3-retry-coalesce`.

The control's expanded cache snapshot failed because `readExports` coerces
results to uint32 and one getter returned i64. The candidate uses 31 verified
i32 getters and asserts main/audio counter availability before timing. Its
audio thread recorded 59597 evictions, all from page-index capacity, zero
directory collisions, and 1392253 decoded-block stores. It made no guest
code-write invalidation calls; the 120765 retirement count includes code
publication/descriptor replacement and must not be called self-modification.
Main recorded 573 capacity evictions and 1105 directory collisions. A future
worker-index capacity experiment should therefore preserve main's existing
512 slots, rather than using the existing worker-heavy split that shrinks it.

### Expanded worker indexes (2026-10-20)

WC3 opts into page-index layout 2 through `expandedWorkerCodeCache`. Main
retains 512 indexes. Each worker retains its original 16 indexes and uses
144 KiB at the tail of its own code partition for another 16. Its compiled
code limit drops from 768 to 624 KiB; the allocator's existing 16 KiB reserve
still applies. The memory map, thread count and other apps' defaults do not
change. Existing worker-heavy layout 1 remains available for Hype.

Sequential 30-second Prologue gameplay captures:

| Audio-worker counter | 16 indexes | 32 indexes |
| --- | ---: | ---: |
| Index-capacity evictions | 39,652 | 4,462 |
| Decoded-block stores | 995,709 | 140,979 |
| Stores per million page hits + misses | 27,100 | 4,107 |
| Full cache clears | 0 | 1 |
| Unpublished blocks | 58 | 144 |

The normalized redecoding count fell about 85%. Main's normalized stores
were similar, 432 versus 429. This is a capacity tradeoff, not elimination
of all cache pressure: the candidate incurred one full clear and more
unpublished blocks. Sampled FPS was 6.90 versus 10.53, but host load fell
from approximately 113–130 to 15–13 between runs, so those rates establish
no causal FPS improvement. Selection, movement and final gameplay were
visually reviewed; subjective audio quality was not verified.

Evidence: `scratch/runs/20261020-wc3-cache32-control`,
`scratch/runs/20261020-wc3-cache32-candidate`, and
`scratch/runs/20261020-wc3-cache32-native`. Candidate WASM:
`c15f6f7a199a2bc09dae6376cd7091e6e60eefc779081df8cae47bd810e70b1d`.
Full build and real-WASM allocator tests pass, covering all 15 worker
owners, both index segments, sentinel isolation, free-list reuse, clock
eviction, spill and instance reuse. Matching ARM64 Ion/TurboFan inspection
shows a register-only selection branch in fresh index allocation and
unchanged dispatch structure; no x86-64 measurement was made.

The CLI honors the app default; `--no-expanded-worker-code-cache` restores
the ordinary layout, and `--expanded-worker-code-cache` forces layout 2.
An explicit `--worker-heavy-code-cache` overrides WC3's default with layout 1;
if both positive flags are supplied, expanded wins.

The final app-config path also passed cooperative Prologue gameplay in
`scratch/runs/20261020-wc3-cache32-coop`: 32.36 FPS over 30 seconds, with
audio-worker arena size asserted before timing. Audio recorded 2,298,609
page hits and zero misses, decoded stores, index evictions or full clears
during that window. The threaded candidate executed many more audio page
lookups (34,142,673 hits), so the two audio workloads are not interchangeable.
Without audio production/consumption measurements, that difference does
not establish either threaded busy-waiting or cooperative starvation.

A final threaded run through the real app-config path, after host load
subsided, measured 26.80 FPS (p95 47.42 ms), versus the preceding cooperative
32.36 FPS (p95 39.66 ms). Load was approximately 6.17→4.96 for threads and
7.84→6.03 for coop; these remain single sequential windows, not a controlled
speedup measurement. Threads were still slower in this comparison. Audio
recorded 4,966 capacity evictions, 154,121 decoded stores, and one full clear.
Evidence: `scratch/runs/20261020-wc3-cache32-threads-final`.

Next, measure audio work per output second: T4 execution and scheduling
delay together with active voices, AudioContext state, cursor advancement
and ring-update bytes. The cooperative scheduler has a 4 ms background
budget when audio is active; threaded scheduling has no equivalent cap.
Neither cache lookups nor that policy alone establishes excess mixing or
starvation. Preserve audio behavior while investigating the remaining gap.

### Matching audio workloads before comparing schedulers (2026-10-20)

The follow-up captures `20261020-wc3-audio-output-threads` and
`20261020-wc3-audio-output-coop-retry` instrument the existing voice manager,
worklet progress and per-thread execution hooks on `80fc118a4`/`c15f6f7a`.
Both modes used two 44100 Hz stereo 16-bit AudioWorklet rings. Over about
20 seconds, each ring consumed 3,536,384 bytes in threads and 3,538,944
bytes in coop, matching elapsed audio time. The 136704-byte music ring had
changing nonzero PCM in all 82 samples in each run; the 65536-byte ring was
silent and had no refresh calls. Subjective audio quality was not checked.

Music refresh counts were 2486 threaded versus 2484 cooperative, and T4
retired 54.069 million versus 53.933 million blocks. The previous large
audio-work disparity was therefore not reproduced. The older cooperative
capture had no voice/output diagnostics and must not be assumed silent,
starved, or equivalent to these captures. A buffer refresh's length is the
whole ring extent, not newly produced PCM bytes; no production-throughput
claim can be derived by multiplying refresh count by ring length.

T4 slice elapsed time was 7.241 seconds threaded and 5.264 seconds coop,
with 1399 versus 5936 slices. Threaded elapsed time can include synchronous
RPC waits; it is not a CPU-time comparison. Observed FPS was 17.94 versus
14.50, reversing the prior ordering under different busy-host conditions.
These remain diagnostic samples, not a controlled speedup benchmark.
There is no evidence here supporting an audio pacing or quantum change.
Future comparisons should verify active music, advancing worklet progress,
ring refreshes and changing PCM before treating workloads as equivalent.

The first cooperative attempt (`20261020-wc3-audio-output-coop`) failed
profile creation before timing. Its screenshot shows the entered name and
an empty profile list. The retry verifies profile creation before Select;
the failed attempt is retained as a harness error, not a gameplay failure.

The following isolated-fixture capture, `20261020-wc3-rpc-timing-retry`,
times each synchronous `waitForResponse` by import name and labels CPU
profiles with the actual worker slot. The main and audio diagnostic
snapshots are asserted before timing. An initial attempt queried a retired
worker and failed before sampling; that harness error is retained in
`20261020-wc3-rpc-timing`. The timing instrumentation was removed from the
fixture after capture; tracked runtime files were never changed.

Over the approximately 20-second window:

| Worker | Synchronous wait | Calls | Elapsed time |
| --- | --- | ---: | ---: |
| Main 0 | GL batch | 1008 | 3266.2 ms |
| Main 0 | All synchronous imports/batches | — | 3611.5 ms |
| Audio 4 | wait_single | 3571 | 172.8 ms |
| Audio 4 | set_event | 1985 | 138.2 ms |

Audio retired 53.4 million blocks, made 2483 music-ring refreshes and
maintained real-time worklet progress. Its total slice elapsed time was
5.548 seconds in this capture, so the earlier 7.241-second measurement
does not establish a stable two-second threaded penalty. Only 0.311
seconds here were spent inside measured synchronous RPC waits. This
does not support changing audio scheduling to address the main bottleneck.

About 90% of main's measured synchronous wait time was GL submission and
completion. Earlier command inspection already established a `glFinish`
after each frame; keep that explicit completion barrier. Profiled main
interpreter self samples remain largest in `uop_fast` (2627 ms),
`branch_end_at` (1167 ms) and `th_load32_rop` (1001 ms). Render-worker
non-idle samples total about 2.65 seconds, with uniform setup and draw
replay prominent. Next targets are rendering submission/replay cost and
main interpreter execution, not speculative audio throttling. Sampled
`waitForResponse` time includes blocked elapsed time, not active CPU.

### Earlier GL dispatch experiment (2026-10-20)

The next pair traces host receipt, opcode counts, render-worker dispatch,
renderer replay start/end and producer release. Evidence is in
`20261020-wc3-gl-dispatch-control` and `20261020-wc3-gl-dispatch-512k`.
Both use the same Prologue select/move/return route, active music, one Chrome
browser at a time and no CPU profiler. Control is the `c15f6f7a` WASM.

The encoder normally accumulates up to 2 MiB or an explicit barrier. WC3's
typical frame fits: about 1.7 MiB arrives with `gpuPresent`, followed almost
immediately by a separate 36-byte `glFinish`. The median frame has one draw
batch and one finish batch. Thus asynchronous admission alone does not give
useful overlap: median renderer replay starts 0.185 ms *after* the host
receives the finish request. About 89% of captured draw records are in
presentation batches. The backend really calls WebGL `gl.finish()`.

The isolated experiment retains 2 MiB storage and all explicit barriers,
but submits existing records before a new generic record would cross
512 KiB, and submits completed packed draws at that watermark after
software consumption. Generic records must not be flushed indiscriminately
after encoding: doing so could consume query/context return values before
the existing barrier reads them. Large individual packed draws may still
exceed the soft watermark. Existing immutable batch ownership and bounded
two-buffer admission are unchanged.

| Per-frame median | Control | 512 KiB dispatch |
| --- | ---: | ---: |
| Batches | 2 | 5 |
| First renderer replay before finish receipt | -0.185 ms | 15.958 ms |
| Finish request to producer release | 4.400 ms | 1.157 ms |
| All host submission waits | 5.390 ms | 2.185 ms |
| Renderer replay elapsed, summed | 3.955 ms | 5.405 ms |

Earlier dispatch therefore establishes substantial overlap without weakening
`glFinish`. These are host/renderer JavaScript timestamps, not GPU execution
timestamps. WebGL draw submission occurs during replay; GPU scheduling was
not measured. Summed replay elapsed is not isolated CPU time.

Observed presentation rate was 27.93 versus 26.49 FPS over 20 seconds.
Host load was unequal (control approximately 4.74 to 4.89, candidate 5.31
to 4.98), and tracing adds overhead. This pair establishes no FPS benefit;
do not infer that smaller batches improve throughput merely because finish
waits shrink. Audio work remained comparable: 53.916 versus 53.857 million
blocks, with 2482 versus 2486 music refreshes. Both gameplay images were
reviewed. Renderer replay flushes pending geometry at every batch boundary,
so extra dispatches also change where geometry can be combined; that and
concurrent CPU contention remain follow-up hypotheses, not measured causes.

Focused real-WASM context, generic ownership/query, client-array and primitive
tests passed, as did shared-render queue/fence tests after removing browser
timing instrumentation (its `performance` reference is absent in the test VM).
Exact batch-grouping pressure parity was not claimed for the changed grouping.
The experimental source, module, trace and native captures are retained in
the run folder. No production runtime change is selected from this pair.

## Shared GL packet slots (2026-10-20)

The next implementation keeps the original 2 MiB dispatch boundaries and
encodes into three WASM-resident slots. The host leases published slots until
renderer replay has flushed retained geometry; its existing two-pending limit
protects rotation. This removes command-stream snapshot and Worker clone copies
without relaxing queries, borrowed-input barriers or `glFinish`.

Sequential Chrome 155 threaded Prologue captures are preserved in
`20261020-wc3-packets-copy` and `20261020-wc3-packets-shared`. Both use module
`cd3b43cf9718fd63b3ca56d54e0b3e112acd0f8dfb997dd21cdbc58f19b73ce6`.
The copied control uses `?gl-copy`; shared publication uses offset descriptors
into process memory. Exact source identities are recorded per run.

| Measurement | Copied | Shared slots |
| --- | ---: | ---: |
| 20-second presentation rate | 25.85/s | 27.03/s |
| p95 presentation interval | 53.22 ms | 48.78 ms |
| Whole-launch copied batches | 3,469 | 0 |
| Whole-launch copied bytes | 4,230,062,784 | 0 |
| Whole-launch leased batches | 0 | 3,304 |
| Audio-thread blocks during sample | 53,006,349 | 53,914,529 |
| Music refreshes during sample | 2,480 | 2,483 |

Both final images show Prologue gameplay and the Thrall HUD. Whole-launch
counters include navigation and warmup, so they are not timed-window bandwidth.
Host load differed (copied 5.73→6.04, shared 4.96→4.97); one pair establishes
copy removal and functional rendering, not a causal FPS improvement or parity
with cooperative mode. Matching ARM64 V8 TurboFan and SpiderMonkey Ion native
listings are reviewed in `20261020-wc3-shared-packets-native`: init frames grow
16 bytes in both engines and Ion flush grows 16 bytes. No x86-64 claim.

### Earlier dispatch with shared slots (2026-10-20)

Retested the same 512 KiB watermark on top of the shared packet pool. Control
is `fccc344c7` / module `cd3b43cf…`; candidate module is
`5812db90568d7f7569751296ab43ae21cd0df1b18fd180ca72f7d41a04c2510d`.
The experiment changes only generic pre-record crossing and completed packed
draw submission after software consumption. Storage remains three 2 MiB slots;
queries and explicit `glFinish` retain their barriers.

Sequential, fresh headful Chrome runs used the same Prologue select/move/return
route and 30-second samples, with no concurrent test browser or CPU profiler.
Actual downloaded module hashes match each recorded variant. All final gameplay
images were reviewed. Evidence is in `20261020-wc3-pool-dispatch-` folders
`control-a`, `512k`, `control-b`, and `native`.

| Measurement | Control A | 512 KiB | Control B |
| --- | ---: | ---: | ---: |
| Presentation rate | 19.30/s | 26.72/s | 23.66/s |
| p95 presentation interval | 67.54 ms | 69.00 ms | 75.32 ms |
| Submitted batches during sample | 1,252 | 4,106 | 1,517 |
| Batch-copy bytes | 0 | 0 | 0 |
| Audio-thread blocks | 77,963,888 | 77,604,934 | 77,608,674 |
| Music refreshes | 3,721 | 3,721 | 3,725 |
| Music bytes consumed | 5,298,688 | 5,297,664 | 5,304,320 |
| Host load before → after | 10.68→8.89 | 7.37→8.11 | 4.96→4.79 |

Every music sample was nonzero (122/122 per run). The candidate's higher FPS
therefore does not come from omitted audio work, but host load remains unequal.
Its 13% lead over the better control is smaller than the controls' 23% spread;
these samples do not establish a repeatable causal gain. Smaller batches also
increase submissions per presented frame from about 2.1 to 5.1. Timing the
first GPU submission/finish overlap was not repeated in this experiment.

Generic ownership/query, primitive and triple-pool tests pass. Matching ARM64
Ion/TurboFan captures show added integer threshold checks; V8 packed-finish
grows from 736 to 1,024 bytes and its local frame from 48 to 64 bytes. No new
FP-state or translation helper was introduced. The isolated full-build command
stopped at stale fixture census metadata; explicit concatenation and compilation
passed with unchanged layout `eb58be38f5ebb837`. This is an experimental module,
not a newly approved production build. Exact sources, logs and native captures
are retained. The fixture was restored afterward.

Keep the existing dispatch default. Before selecting this candidate, repeat on
a quieter host until controls are stable; evaluate submission/geometry flush
overhead separately from buffer-copy removal. No threaded-versus-cooperative
performance claim is made from this comparison.

### 1 MiB dispatch and measured execution overlap (2026-10-20)

Compared shared-pool 2 MiB control `cd3b43cf…`, 1 MiB candidate
`c650a6b1774c820d432fc340e291c8f75000e35e00aa3726745c846d59fdb431`,
and the previous 512 KiB candidate `5812db90…`. Storage remains three 2 MiB
slots; only the dispatch watermark changes. Sequential fresh Chrome 155
threaded runs use the same Prologue select/move/return route, 30-second samples,
and identical fixture-only timing instrumentation. One test browser at a time.

| Measurement | 2 MiB | 1 MiB | 512 KiB |
| --- | ---: | ---: | ---: |
| Presentation rate | 26.02/s | 27.93/s | 18.60/s |
| p95 presentation interval | 57.71 ms | 46.87 ms | 75.75 ms |
| Median batches/frame | 2 | 3 | 5 |
| Median first WebGL draw lead before guest finish RPC | -0.15 ms | 10.19 ms | 21.04 ms |
| Median guest finish RPC wait | 4.66 ms | 2.89 ms | 1.65 ms |
| Median total GL submission wait/frame | 5.19 ms | 3.46 ms | 2.77 ms |
| Median replay time/frame, excluding WebGL finish | 4.37 ms | 4.73 ms | 8.65 ms |
| Main/replay overlap during sample | 0.51 ms | 1,812.11 ms | 3,842.79 ms |
| Fraction of replay overlapping non-blocked main execution | 0.013% | 42.03% | 77.25% |
| Conservative clock-only overlap bounds | 0.22–9.94 ms | 1,796.82–1,829.44 ms | 3,764.22–3,932.17 ms |
| Host load before → after | 4.91→6.75 | 4.96→5.55 | 6.19→6.31 |

Overlap is the intersection of render-worker `bridge.replay` wall intervals
with actual main-worker `ex.run` intervals, after subtracting the union of JS
RPC and Atomics waits. WebGL `finish` call time is excluded from the replay
denominator. Worker clock ping bounds before/after sampling calibrate epoch
timestamps; relative uncertainty is 0.055/0.057/0.065 ms. Interval arithmetic
self-tests and an independent agent review passed. All host batches associate
with main RPC records, and no trace buffer overflowed. The first draw lead is
a separate measurement; it alone does not demonstrate overlap.

These are wall-time overlap measurements, not CPU cycles or GPU execution.
OS descheduling, lock spin, WASM-internal waits and driver blocking can remain.
Replay excludes descriptor setup and post-replay bookkeeping. Individual draw
intervals were not retained. Frame association assumes this single main GL
stream. Tracing adds overhead, and the host was busy: 512 KiB's higher overlap
coincides with much more replay wall time per frame and lower FPS. This does
not establish that the watermark alone caused the regression. 1 MiB is the
better candidate for a repeated, stable-control comparison; production keeps
the existing default until that evidence exists.

All final screenshots show intact Thrall Prologue gameplay. Downloaded WASM
hashes match the intended variants, batch-copy bytes are zero, and audio work
is comparable: 77.62/77.64/77.48 million audio-thread blocks,
3,724/3,722/3,724 music refreshes, and 5,304,320/5,301,760/5,305,344 consumed
music bytes. All 122 music samples per run are nonzero.

Reviewed captures: `20261020-wc3-overlap-{2m,1m,512k}`. Timing source snapshots,
analyzer and measurement review: `20261020-wc3-overlap-tools`. Matching ARM64
Ion/TurboFan and generic/primitive/pool tests for 1 MiB are reviewed in
`20261020-wc3-1m-overlap-native`; the packed V8 frame grows 48→64 bytes as in
the 512 KiB variant, while Ion frames remain unchanged. No x86-64 claim.
Experimental concat/compile passed with unchanged layout; the known stale
fixture census prevents treating this as a full production build. Fixture
runtime instrumentation, encoder and build were restored after capture.

### Repeated software/WebGL CPU and three-thread overlap (2026-10-21 UTC)

Eight fresh, sequential 30-second Prologue gameplay captures compare the same
1 MiB and 512 KiB experimental modules above. Order: GL 1 MiB, GL 512 KiB,
software 1 MiB, software 512 KiB, software 512 KiB, software 1 MiB,
GL 512 KiB, GL 1 MiB. Only one test browser runs at a time. Each successful
capture executes the select/move/return route and retains matching module
hashes, backend checks, screenshots, audio diagnostics and raw timelines.
Software checkpoint references differ from WebGL; three text-mask failures
and one highlighted-but-unactivated Campaign click are retained separately,
with no timing sample. Software-specific references and a longer Campaign
click resolve the harness failures. Final gameplay images were reviewed.

| Backend / watermark / repeat | FPS | Renderer CPU/frame | Main CPU/frame | Main/render overlap | Main/audio overlap |
| --- | ---: | ---: | ---: | ---: | ---: |
| WebGL / 1 MiB / A | 33.76 | 4.21 ms | 25.39 ms | 41.6% | 87.9% |
| WebGL / 512 KiB / A | 27.52 | 5.69 ms | 30.25 ms | 76.3% | 86.4% |
| Software / 1 MiB / A | 7.13 | 102.67 ms | 40.80 ms | 21.8% | 42.6% |
| Software / 512 KiB / A | 7.66 | 101.96 ms | 38.97 ms | 20.8% | 42.5% |
| Software / 512 KiB / B | 7.23 | 103.48 ms | 40.10 ms | 20.9% | 42.4% |
| Software / 1 MiB / B | 7.03 | 104.25 ms | 41.17 ms | 21.3% | 40.9% |
| WebGL / 512 KiB / B | 29.19 | 5.35 ms | 29.14 ms | 76.3% | 87.3% |
| WebGL / 1 MiB / B | 27.79 | 4.99 ms | 29.00 ms | 42.1% | 83.9% |

Overlap still means calibrated, nonblocked **wall** intervals, not exact CPU
execution overlap. Main/render percentages use renderer replay as denominator;
main/audio percentages use audio-worker nonblocked execution as denominator.
Audio/render overlap is 12.0–17.6% of renderer time for WebGL 1 MiB,
30.3–30.7% for WebGL 512 KiB, and 13.2–17.9% for software. All three lanes
and clock uncertainty bounds are retained in `analysis-repeat.json`.

CPU measurements are separate Chrome `RunTask.tdur` totals for the correctly
identified worker thread, divided by presented frames. Unique performance
marks and their returned epoch timestamps align Chrome events to the capture
window; only complete tasks inside conservative bounds count. Missing/invalid
durations and boundary tasks are excluded explicitly, not treated as zero.
Valid CPU durations cover 99.88–100% of complete renderer task wall time.
Renderer CPU/task-wall ratios are 88.1–97.7% for WebGL and 96.4–97.4% for
software. Independent review found no meaningful missing render-task time.
Thread CPU includes renderer task bookkeeping; unlike replay wall time it
excludes descheduling, but still depends on core assignment/frequency and
contention. It cannot locate exact simultaneous CPU execution within tasks.

The WebGL workload remains about 382 draw calls/frame for both watermarks.
The old near-doubling of replay wall time does not reproduce as doubled CPU
work: 512 KiB costs 5.35–5.69 ms/frame versus 4.21–4.99 at 1 MiB here. More
overlap is repeatable, but FPS ordering reverses between the two pairs. Thus
neither a stable FPS winner nor a batching-only cause for all CPU differences
is established; host load remains unequal. Keep the production default.

Software is a different queue: `?gl-renderer=software` enables WAT rasterization
and offloads snapshots through legacy `D3DCommandStream` RECORD_GL packets.
That encoder has its own 2 MiB slots and 75%-full/idle-consumer submission
policy. The experimental GL watermark does not resize that raster queue;
software generic GL batches remain synchronous. Timing only `gl-batch` would
miss most software work, so this capture unions GL and legacy replay spans.
Actual software exports report enabled=1, increasing presents, nonzero front,
and zero unsupported texture uploads; WebGL has enabled=0 and actual WebGL
draw calls. Software issues about 406–407 legacy commands/frame and spends
102–104 ms of CPU/frame on its render worker. Its bottleneck is rasterization,
not a large hidden scheduler delay. Optimize that path independently of the
WebGL dispatch watermark.

Audio remains active: 122/122 nonzero music samples in every capture,
5.298–5.306 MB consumed per sample window, and 75.87–78.48 million audio-thread
blocks. These checks rule out omitted audio, not all scheduling differences.
No new runtime optimization or native variant was introduced. Reused native
evidence is the preceding 1 MiB/512 KiB ARM64 Ion/TurboFan comparison.

Evidence: `20261021-wc3-repeat-` folders `gl-1m-a`, `gl-512k-a`,
`sw-1m-a-verified`, `sw-512k-a-retry`, `sw-512k-b`, `sw-1m-b`, `gl-512k-b`,
`gl-1m-b`. Harness failures use `sw-1m-a`, `sw-1m-a-retry`,
`sw-1m-a-retry2`, `sw-512k-a`. Instrumentation, analyzers, aggregate JSON and
measurement review are in `20261021-wc3-render-repeat-tools`. Matching
800×600 software/WebGL captures were opened in Preview for visual comparison.
Fixture runtime/build restored after capture; production and unrelated
brightness work remain unchanged.

### Six additional 60-second WebGL captures (2026-10-21 UTC)

Retested the existing native-reviewed modules with the preceding three-worker
clock/CPU instrumentation and fresh Prologue route. Order is 2 MiB, 1 MiB,
512 KiB, 512 KiB, 1 MiB, 2 MiB; one browser at a time. Each timed window is
60 seconds. All six final gameplay images were reviewed and actual downloaded
WASM/backend checks pass. No new runtime variant was introduced.

| Watermark / repeat | FPS | First / second half FPS | Renderer CPU/frame | Main CPU/frame | Main/render overlap |
| --- | ---: | ---: | ---: | ---: | ---: |
| 2 MiB / A | 32.83 | 32.26 / 33.39 | 3.98 ms | 24.82 ms | ~0% |
| 1 MiB / A | 27.05 | 24.67 / 29.43 | 5.15 ms | 29.34 ms | 42.7% |
| 512 KiB / A | 31.19 | 30.73 / 31.66 | 5.12 ms | 27.65 ms | 76.4% |
| 512 KiB / B | 28.53 | 27.87 / 29.20 | 5.57 ms | 29.44 ms | 76.2% |
| 1 MiB / B | 30.35 | 29.30 / 31.40 | 4.72 ms | 27.16 ms | 42.0% |
| 2 MiB / B | 24.98 | 27.76 / 22.20 | 4.83 ms | 29.87 ms | ~0% |

The unchanged control spans 24.98–32.83 FPS, a 31% high/low spread, larger
than the candidate differences. Closing control host load rose 3.59→9.19;
its second half drops to 22.20 FPS. In the first 1 MiB run, load rose
4.46→7.28 while FPS increased between halves, so load averages alone do not
explain individual frame times. These are noisy session measurements, not a
causal FPS ranking or independent per-frame statistical trials. Keep the
production 2 MiB default. The repeatable finding is earlier dispatch and
nonblocked wall overlap, not improved throughput. CPU time remains sensitive
to core assignment/frequency and contention; there is no new attribution of
the CPU differences to one batching mechanism.

Draw counts are 379.4–380.0/frame. Audio-thread work is 151.50–152.27 million
blocks, music consumption 10.596–10.605 MB, and every run has 242/242 nonzero
music samples. Valid renderer thread CPU covers 99.88–99.98% of complete task
wall time. The prior clock bounds, boundary-task exclusions and distinction
between wall overlap, thread CPU and GPU execution still apply.

Evidence: `20261021-wc3-confirm-{2m-a,1m-a,512k-a,512k-b,1m-b,2m-b}`;
capture tools, source snapshots and aggregate metrics are retained in
`20261021-wc3-webgl-confirm-tools`. No capture failure in this series. Fixture
runtime/build restored after testing. A useful next isolation experiment is
fixed-command replay with different packet boundaries, followed by a quiet
gameplay control/candidate comparison; more noisy whole-game averages alone
will not identify the source of the extra CPU time.

### Common submission queue FPS comparison (2026-10-21)

Compared parent `d0220545a` against queue refactor `485e2c9f8` in the isolated
fixture. All captured runtime identities match except the four intended files:
`render-worker.js`, `gl-render-host.js`, `glide-host.js`, and
`d3d-command-stream.js`. Both use unchanged production WASM `cd3b43cf…`, the
2 MiB GL watermark and existing software batching. No new interpreter/native
variant. Fresh Chrome profiles, one browser at a time, identical Prologue menu
route, HUD checks and Thrall select/move/return input. The timed scene is the
animated opening area with Thrall standing, not a large battle or an identical
recorded command stream. No overlap tracing or CPU sampling was enabled;
lightweight audio checks and the existing presentation/liveness hooks remain.

The initial four WebGL captures used 60-second windows: old 24.76/27.13 FPS,
new 26.50/32.98. The first control's host load rose 5.89→18.53 and its halves
were 28.93/20.60 FPS. Inspection after the user's warm-up question confirmed
`--warmup=2` runs **before** the navigation driver. Although loading/cinematics
were excluded and the movement route provided roughly 15 seconds of gameplay,
there was no dedicated steady-state settling period. These exploratory samples
remain separate from the corrected series below.

Corrected protocol: verify gameplay and complete movement, then wait **60 seconds
uncounted**, then measure **180 seconds**, retaining six 30-second windows.
Run old/new/new/old sequentially for WebGL, then the same order for software.
FPS counts host game-frame presentation callbacks using `performance.now()`;
it is not the page's approximately 60 Hz requestAnimationFrame rate, GPU
execution duration, or proof of distinct monitor scanouts. The presentation
source tag `gpu` also names native-software output through this compositor;
backend selection is independently checked with producer exports.

| Backend / queue / repeat | FPS | First / second 90s FPS | Present interval p95 |
| --- | ---: | --- | ---: |
| WebGL / old / A | 27.50 | 27.92 / 27.08 | 46.78 ms |
| WebGL / new / A | 28.77 | 28.88 / 28.67 | 44.32 ms |
| WebGL / new / B | 29.64 | 28.14 / 31.13 | 45.03 ms |
| WebGL / old / B | 33.69 | 33.74 / 33.63 | 37.74 ms |
| Software / old / A | 7.64 | 7.54 / 7.74 | 137.62 ms |
| Software / new / A | 7.47 | 7.28 / 7.65 | 137.92 ms |
| Software / new / B | 7.67 | 7.65 / 7.68 | 138.25 ms |
| Software / old / B | 7.74 | 7.76 / 7.72 | 139.20 ms |

WebGL descriptive means are 30.595 old versus 29.205 new (−4.54%). This is
not an established regression: unchanged controls differ by 22.5%, and pairwise
direction reverses. Candidate B's six windows are 28.73, 28.20, 27.50, 27.03,
33.03, 33.33 FPS, followed by a steady 33.69 FPS old control. Longer settling
does not eliminate between-session performance shifts or this within-session
step. Load averages do not explain all variation: the fast closing control
starts at 3.53 and ends at 8.97. No causal FPS gain is demonstrated.

Software descriptive means are 7.69 old versus 7.57 new (−1.56%). Both pairs
are slightly lower with the new queue, but run ranges overlap and the candidate's
own spread is 2.7%. A small software slowdown remains possible; two fresh
sessions per variant are insufficient to establish it. Do not report either
an FPS improvement or proven equivalence. Software host load stays roughly
2.3–2.65. A quieter controlled replay would be more useful for isolating queue
overhead than repeatedly averaging this whole game scene.

All eight long samples have 722/722 nonzero music checks and approximately
31.76 MB of music consumed. WebGL audio-thread work is 437.76–438.50 million
blocks; software is 353.77–362.59 million, so software audio workload is not
perfectly matched even with equal audible progress. Actual fetched WASM hashes,
source manifests, native-software enablement/presents/front/unsupported-texture
checks, live canvas checks, and final scene/HUD images were reviewed. No capture
failed. Frames/windows are correlated observations, not independent repeats.

Evidence: `20261021-wc3-queue-gl-{before,after}-{a,b}` for the short series;
`20261021-wc3-queue-long-{gl,sw}-{before,after}-{a,b}` for the corrected series.
Drivers, analyzers, per-window results and full source snapshots accompany the
runs; aggregate tools are in `20261021-wc3-queue-fps-tools` and
`20261021-wc3-queue-long-tools`. Fixture queue sources restored to the root's
current files after capture; all test browsers closed. No further runtime
change, push or deployment follows from these measurements.

### Active unit movement / dispatch threshold (2026-10-21 UTC)

Accepted common queue commit `485e2c9f8` as the fixed cleanup baseline, then
varied only the WebGL soft dispatch threshold. Storage remains three 2 MiB
slots; completion fences and queue machinery are unchanged. Reused exact
native-reviewed artifacts: production `cd3b43cf…` (2 MiB), `c650a6b1…`
(1 MiB, `20261020-wc3-1m-overlap-native`), and `5812db90…` (512 KiB,
`20261020-wc3-pool-dispatch-native`). No new native optimization variant.

Fresh threaded Chrome sessions, sequentially and one browser at a time:
2 MiB / 1 MiB / 512 KiB / 512 KiB / 1 MiB / 2 MiB. Verify the Prologue HUD,
select/move/return Thrall, settle for 60 seconds, then count guest presentation
callbacks for 180 seconds. **During** that measurement, issue 30 right-click
orders at six-second intervals, cycling four nearby destinations. Seven
world-canvas captures at approximately 3/9/15/21/63/123/171 seconds show the
route; red-unit centroid checks agree across runs, and manual review confirms
movement and intact final HUDs. Command scheduling deviations are below 500 ms.
This is fixed-camera single-unit movement, not an army battle or a deterministic
graphics-command replay. Page rAF remains around 60 Hz and is not the FPS metric.

| Threshold / repeat | FPS | First / second 90s | Present interval p95 | Submissions/frame | Load before / after |
| --- | ---: | --- | ---: | ---: | --- |
| 2 MiB / A | 29.30 | 28.43 / 30.18 | 46.12 ms | 2.107 | 4.27 / 4.48 |
| 1 MiB / A | 28.56 | 27.77 / 29.36 | 47.82 ms | 3.110 | 5.27 / 4.98 |
| 512 KiB / A retry | 38.02 | 37.91 / 38.12 | 33.69 ms | 5.084 | 3.19 / 2.20 |
| 512 KiB / B retry | 32.47 | 32.53 / 32.41 | 42.00 ms | 5.098 | 6.43 / 4.26 |
| 1 MiB / B | 29.78 | 29.38 / 30.18 | 46.60 ms | 3.106 | 5.72 / 5.50 |
| 2 MiB / B | 28.13 | 27.30 / 28.97 | 50.36 ms | 2.112 | 5.09 / 5.31 |

Descriptive means: 28.715 / 29.170 / 35.245 FPS for 2 MiB / 1 MiB /
512 KiB. Both successful 512 KiB runs exceed both controls; it is the strongest
candidate in this series. The descriptive mean difference is +22.7% versus
2 MiB, but not an established general speedup: the fastest session has much
lower host load, the two 512 KiB sessions differ by 17.1%, there are only two
successful independent sessions per setting, and earlier shorter/instrumented
tests did not establish this ranking. Keep the production default at 2 MiB
pending broader/quiet-host validation; prioritize 512 KiB for that validation.
1 MiB has no clear advantage here. This pass has no CPU/overlap tracing and
does not measure GPU start time. The threshold controls submission to the
renderer worker, not a GPU scheduling guarantee.

Payload volume stays about 1.586 MiB/frame across settings while submissions
rise from approximately 2.1 to 3.1 to 5.1/frame. Largest packets are 1,726,928 /
1,057,164 / 531,592 bytes respectively; soft thresholds may be exceeded by a
completed packed record. Actual fetched module hashes and WebGL enablement
were checked. Runtime JS/harness source hashes match across all six sessions;
only the WASM identity differs. Every sample has 722/722 nonzero music checks,
31.781–31.789 MB consumed, and 443.93–444.80 million audio-thread blocks.
Six 30-second FPS windows and raw presentation timestamps are retained.

Two failed attempts remain visible in the evidence: `512k-a` did not advance
the main-menu click to the profile list (timeout screenshot reviewed), and
`512k-b` failed before briefing with a detached-frame error (no final capture;
underlying cause unknown). Neither contributed an FPS sample. Each was retried
once in a fresh browser; successful retries are identified explicitly above.

Evidence: `20261021-wc3-active-{2m-a,1m-a,512k-a-retry,512k-b-retry,1m-b,2m-b}`
plus the two failed folders. Drivers, source snapshots, movement checks, raw
metrics and aggregate tools are in those bundles and
`20261021-wc3-active-threshold-tools`. All six successful bundles and both
failures reviewed/published; evidence checker has only the preexisting Zuma
outside-path error, with no missing/invalid records. Fixture restored to root
runtime and production WASM after testing; test browsers closed. No production
threshold change or deployment.

### Promote 512 KiB default (2026-10-21)

User chose to adopt the active-movement candidate. The production GL encoder
now uses the same 512 KiB soft threshold with unchanged 2 MiB storage and
explicit barriers. Full build passes and its WASM SHA-256 is exactly
`5812db90568d7f7569751296ab43ae21cd0df1b18fd180ca72f7d41a04c2510d`, matching
the measured and ARM64 V8/SpiderMonkey native-reviewed candidate above.
The full encoder parity suite passes; pressure cases now compare complete
ordered records independently of packet boundaries and check early dispatch.
Shared-worker protocol and lifecycle tests pass. This is a default selection
based on the recorded workload, not a claim of a general 22.7% speedup.
