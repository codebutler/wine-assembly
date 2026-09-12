# Warcraft III: Reign of Chaos — Demo

App id `warcraft3_demo` (`lib/apps.js`), install tree at
`test/binaries/candidates/warcraft3-demo/`. Provenance is in
`test/candidate-corpus/manifest.json`.

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
coordinates *are* guest coordinates. Labels render near-black; read them with
`node tools/png-crop.js FILE --rect=X,Y,W,H --scale=3 --out=…` rather than by
eye on the full frame.

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
