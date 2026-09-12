# Sid Meier's SimGolf Demo

## Source and preparation

The local fixture comes from `https://archive.org/details/Simgolfdemo`.
Archive.org's `simgolfdemo.exe` is 41,170,929 bytes with SHA-1
`81b72aea22cb147979cb3068588cab8b024f8cea`. It is an InstallShield
self-extracting cabinet containing `Disk1/data1.cab` and `Disk1/data2.cab`.

`test/candidate-corpus/manifest.json` extracts the `Program Executable` and
`Program Files` groups with `unshield`, then merges them into
`test/binaries/candidates/simgolf-demo-installer/installed/`. The complete
installed view has 1,763 files totaling 65,166,518 bytes (62.1 MiB). Its six
EXE/DLL binaries total 4,722,342 bytes; the remaining 1,757 data files total
60,444,176 bytes. Keep it local: the bundled
EULA says no part of the software may be copied without Electronic Arts'
prior written consent, so this fixture must not be committed or deployed.

Recreate it with:

```bash
node tools/fetch-candidate-corpus.js --id=simgolf-demo-installer --force
```

## Runtime

`golf.exe` imports game code from `Terrain.dll` and Bink video support from
`binkw32.dll`; the remaining local runtime graph uses `jgl.dll`, `sound.dll`,
and `Mss32.dll`. All five must be explicit DLL seeds. The game opens its PCX,
FLC, WAV, and configuration assets relative to the executable, so the launcher
mounts the complete prepared tree at `C:\` through the generated local browser
manifest.

The tested CLI form is:

```bash
node test/run.js --app=simgolf_demo --quiet-api --quiet-blocks \
  --max-batches=1000000 --batch-size=50000 --max-seconds=30 \
  --png=/tmp/simgolf.png
```

On the committed `fbccf19d` baseline this loads all five DLLs, creates a
640x480 window titled `Sid Meier's Next Game`, starts the Miles sound thread,
and renders the SimGolf demo loading screen without a crash. The first load is
CPU-heavy because the game preloads a large part of its 1,762-file asset tree;
a 30-second headless run reached the loading screen but not the main menu.

`Terrain.dll` imports OpenGL 1.1 client arrays. The compatibility frontend
supports its measured `glEnableClientState`/pointer/`glArrayElement` path plus
the remaining imported scalar and vector aliases. A threaded WebGL browser run
against the local server remained running for 45 seconds with no runtime crash;
the earlier `glEnableClientState` and `glTexParameteri` traps no longer occur.

The initial gameplay view was black for two independent presentation reasons.
SimGolf creates its OpenGL context before its ordinary GDI interface surface;
the later GDI attachment used to discard the live GPU layer. It also uses a
single-buffered context and ends frames with `glFlush`, never `SwapBuffers`.
The renderer now retains a `kind: 'gpu'` layer across that GDI attachment, and
`glFlush` publishes the WebGL front buffer. A browser capture after 60 seconds
showed the textured course and water, with the GPU layer at presentation
sequence 20 and WebGL error 0 instead of an unchanged black sequence-0 canvas.
Terrain.dll calls `glFlush` up to three times while assembling one visible
update. Copying and repainting on every call exposed intermediate course passes
during scrolling and repeatedly stalled the page. Browser publication is now
coalesced to one animation-frame callback; all GL commands still flush
immediately, while the compositor snapshots the latest completed front buffer.
A controlled browser edge-hover produced clean before/after course captures,
and a comparable run reduced compositor publications from 23 to 13.

Miles Sound System keeps two DirectSound ring voices looping during gameplay.
Those voices were audible initially, then the browser idle watcher suspended
the AudioContext because only waveOut and CD activity counted as active audio.
Looping DirectSound voice IDs now keep the audio session hot until `Stop`.
Unlock refreshes also replace the acquired Web Audio source at its current
wrapped loop offset instead of mutating an already-started `AudioBuffer`, which
browsers do not provide as a streaming contract. The old and new sources meet
at one scheduled audio-clock boundary, keeping the DirectSound cursor stable
without replaying stale mixer data. A final browser run retained
`AudioContext.state === "running"` at 87.7 seconds with two looping voices and
two live sources.

The glitch that remained after all of that was not a streaming problem at all.
Miles does not service this ring through `Unlock`: a headless run reaches the
loading screen having issued exactly **one** `Lock`/`Unlock` pair, and the
browser voice counters show the refresh path firing a handful of times against
20-30 plays. What Miles actually does, two or three times a second, is
`Stop` / `SetCurrentPosition` / `Play(DSBPLAY_LOOPING)`. The host built the
looping `AudioBuffer` out of `len - startOff` bytes — the tail after the
cursor — and `GetCurrentPosition` then reported a cursor modulo that tail.
Miles set its next position from that reading, so the tail collapsed on
itself: a captured op timeline showed `startOff` going 65511, 65524, 65535,
65535 … on a 65536-byte ring, i.e. a 25-byte, then 12-byte, then **1-byte**
buffer of 22 kHz PCM looped at full volume. That single sample is the reported
glitch.

A looping DirectSound buffer is a ring: the cursor starts at `startOff` and
wraps through the whole buffer. `playRing` now decodes the entire ring for a
looping play and starts the source at `startOff` seconds in (`playStart` stays
the instant byte 0 would have sounded, so the tap and the cursor keep one
origin), and `getPos` wraps `(startByte + played) % ringBytes`. A one-shot
still plays only `startOff..end`. After the fix the same probe shows the voice
playing all 65536 bytes (0.743 s at 22050/2/16) with live content in the ring,
and the guest's own `startOff` values spread across the whole buffer (12701,
60817, 4371, 34553) instead of pinned at the last byte — the feedback loop is
gone. `test/test-directsound-ring-wrap.js` pins both halves.

Rendering remains CPU-bound. A clean five-second page sample during gameplay
observed 130 animation callbacks (about 26 fps), with a 38.6 ms mean interval,
166.7 ms maximum, and 35 intervals over 33 ms. An API trace explains the main
cost: one sample contained 15,312 `glArrayElement` and `glTexCoord2fv` calls and
5,245 separate `glBegin`/`glEnd` triangle spans. The command stream keeps those
calls off the browser thread, but Terrain.dll still emits thousands of tiny
independent primitives. Improving this needs measured cross-span batching; it
is not an asset-loading or audio throttle problem.

## The interface was buried under the OpenGL layer

SimGolf draws its terrain through OpenGL and its whole interface — club
header, money/mood/score strip, the control pod, the intro dialog, tutorial
text — with GDI into the *same* window. There is only one window: a browser
probe over `sharedRenderer.windows` returns a single hwnd (0x10001) whose
`_gpuFrameLayer` is the GL context's presentation canvas.

The renderer published that canvas as a layer the compositor painted *after*
the window's GDI back canvas, unconditionally, at every draw site. That order
is correct for DirectDraw and Direct3D — a present there is a whole-surface
flip, and the exclusive-fullscreen path keys off `_dxFrameLayer` — but it is
wrong for a single-buffered GL context, which shares the window's device
context: the app's GL output and the GDI it draws next compose in **time**
order. Everything the app drew after `glFlush` was painted over.

The measurement that names it: with the merge disabled in-page
(`sharedRenderer.mergeGpuLayerIntoBackCanvas = () => false`) an 85-second run
shows terrain and *no* interface at all; with it enabled the same run shows
the club header, the strip, the pod and the intro dialog composited over the
GL frame, with no hand keying.

`renderer.mergeGpuLayerIntoBackCanvas(hwnd)` now stamps the flushed front
buffer into the window's own back canvas, `_overlayFrameLayer(win)` withholds
a merged GL layer from every composite site, and `gl-compat`'s
`flushFrontBuffer` does the publish synchronously with the guest's flush while
still coalescing the *screen repaint* to one animation frame (the codex
flicker fix). Pinned by `test/test-opengl-gdi-composite-order.js`.

Still open, and separate from the ordering: GL presents stall. A 250 ms
sampler over one run has the context appear at 51 s, climb from writeSeq 1 to
41 between 58 s and 69 s (about 3.6 presents/second) and then stop entirely,
leaving whatever partial pass the buffer held — which is why the terrain area
is largely black in a late screenshot while the interface is correct. The
control run with the merge disabled is partial in the same way, so this is not
the compositing change.

## The black L-shape and the misplaced interface: the display mode was discarded

The screenshot that looked "mostly black with the UI floating on it" was two
symptoms of one cause. The window was 940x734 while the guest had called
`glViewport(0, 0, 800, 600)`, so GL rendered into the bottom-left 800x600 of a
larger drawable and the remainder stayed cleared — a black L along the right
edge and across the top. The row census matched exactly: 80 of 94 sampled
columns carried content (800/940) and 13 of 74 sampled rows were empty
(134/734). The interface was not misplaced at all; it was laid out for 800x600
inside a 940x734 window.

`$change_display_settings_core` in `src/09a3-handlers-audio.wat` answered
DISP_CHANGE_SUCCESSFUL and threw the resolution away — its own comment said
"The mode itself is not honoured". It now requires
`dmFields & (DM_PELSWIDTH|DM_PELSHEIGHT)`, reads width/height at +108/+112 and
bpp at +104, rejects anything outside 64..8192 with DISP_CHANGE_BADMODE,
publishes the mode through the DirectDraw-shared
`$dx_display_{w,h,bpp,mode}_set` state, then resizes `$main_hwnd` with
`$host_move_window`, recomputes the client rect and posts WM_DISPLAYCHANGE /
WM_MOVE / WM_SIZE. After that the window, the client rect, the GL canvas and
the viewport all read 800x600 and the interface lands where it was designed
to: club sign top-left, title centred, gauges top-right, control pod in the
bottom-left corner.

Resizing the drawable reallocates and clears the framebuffer, and SimGolf
redraws on demand, so the switch also calls `$invalidate_hwnd` on the target —
without it the course stayed black because nothing asked for a repaint.

`test-caesar3-fullscreen-metrics` and `test-pinball-fullscreen-menu` fail
around this code, but they fail with the dmFields mask set to an impossible
value too, so they are not this change.

## Why the course was black on screen while the GL buffer was 55% non-black

Both numbers were true at the same instant: `_gpuFrameLayer.canvas` measured
2716 non-black cells of 4800 while the window's back canvas measured 512 — the
interface and nothing else.

A top-level window's back canvas is not a surface. It is a *derived cache* of
WAT-owned canonical DIB bits (`canvas._waCanonicalPresentation`), and every
`_waFlushCanonicalSurface` re-uploads the guest's pixels over whatever the
canvas holds. The first version of the merge drew the GL front buffer onto the
canvas with `drawImage`, so it survived exactly until SimGolf's next GDI paint
dirtied that region — which, with an on-demand redraw of the interface, is
constantly.

The merge now writes through `GdiSurface.writeRgbaRect` into the canonical
storage itself. A flush then reproduces the GL frame rather than erasing it,
and guest GDI issued afterwards overwrites the same bytes — which is precisely
the single-buffered GL/GDI time ordering we wanted, expressed in the surface
that actually owns the pixels. The canvas-drawing path stays as a fallback for
windows with no canonical presentation. Pinned by the second half of
`test/test-opengl-gdi-composite-order.js`.

### …but the canonical write was not the whole answer

With the merge writing canonical bits, the course is *still* black on screen at
87 s and 107 s. A 51-second in-page timeline (probe `evalfile:` step hooking
both `mergeGpuLayerIntoBackCanvas` and the window surface's `markDirty`) says
why, and it is not a compositing question at all:

- **zero merge calls in 51 seconds** — the GL side never publishes again;
- the layer canvas holds a constant 2410 non-black cells of 4800, i.e. one
  stale frame that never changes;
- the guest marks the **whole** `0,0,800,600` client dirty about 3.3 times a
  second, forever.

So SimGolf is repainting its entire client with GDI several times a second and
contributing no GL frames at all. Nothing could have kept a GL frame on screen
under that: a full-client canonical upload every 300 ms overwrites whatever the
last merge wrote, and correctly so — that is what the guest asked for. The
remaining bug is that the GL stream stops, which is the "GL presents stall"
observation from the previous section, now measured from the other end.

### What SimGolf's OpenGL usage actually is

An in-page census of every opcode reaching `lib/gl-compat.js`'s bridge (hooking
`OpenGLHostBridge.prototype.call`; `--trace-api` cannot see this, because the
guest main thread runs in a Worker and brokers GL to the page) over 90 seconds:

```
   4440  packed draw (GLCommandStream.PACKED_DRAW_OPCODE)
   3013  glBindTexture      482  glTexImage2D      482  glGenTextures
   1896  glTexParameteri    474  glTexEnvi          34  glLoadIdentity
     32  glFlush             32  glPushMatrix/glPopMatrix/glRotatef/glTranslatef
      1  wglCreateContext     1  wglMakeCurrent      1  glViewport   1  glOrtho
  11056  TOTAL
```

Every one of them lands in seconds 31–36 of the run. The totals are identical
when read at 60 s and again at 90 s: **after second 36 the guest issues no GL
call of any kind**. There is no `glClear` in the census at all, and only 32
frames were ever flushed.

That is a normal single-buffered OpenGL app: upload the course textures, draw
the course once, and then leave it there — the front buffer *is* the window, so
the pixels persist and only the interface needs redrawing. Which makes the
3.3 Hz full-client `markDirty(0,0,800,600)` on our side the anomaly, not the
missing GL frames. `tools/gl-opcode-names.js` names these opcodes from the same
`CALLS` table the bridge dispatches on.

### Ruling out the background erase

`$host_erase_background` fills the *whole* client with the class brush and
`$dc_apply_client_erase_clip` clips to the whole client rather than to the
update region, which looked like an exact match for a 3.3 Hz full-client black
write. It is not: `--trace=erase` over a 70-second browser run records **one**
erase in total (`hwnd=0x10001 brush=0x30014`). Whatever repaints the course
area, it is the application's own drawing, not USER's background fill.

(The whole-client erase clip is still wrong against Win32 — the WM_ERASEBKGND
DC is clipped to the update region there, so a small invalidation should erase
a small rectangle. It is simply not this bug.)

A marker test pins how aggressive that drawing is: stamping a 200x150 magenta
block into the canonical bits where the course belongs and sampling the same
8x8 patch every 200 ms gives magenta at t=1 ms and **solid black at t=201 ms**,
every time. The guest actively writes black over the course area several times
a second.

### The course is rendered into a DIB, not into the window

`--trace-api=BitBlt,StretchBlt` over a 90-second browser run (without
`--threads`, so the guest main thread stays on the page where API tracing can
see it) shows one steady pipeline, every surface 800x600:

```
 149  StretchBlt(0x0031000a <- 0x0031000b)     ;; base layer up
 161  StretchBlt(0x00310007 <- 0x0031000a)     ;; composed
 161  BitBlt    (0x00310001 <- 0x00310007)     ;; onto the window DC
```

SimGolf composes its whole frame through two intermediate memory DCs and blits
the result over the entire client. `0x0031000b` is the deepest source in the
chain — the layer everything else is built on, and the natural home for the
course.

That is the Win98 `PFD_DRAW_TO_BITMAP` pattern: create the GL context on a
memory DC holding a DIB section, let GL render the course into those bits, then
blit the DIB around with ordinary GDI. It explains every measurement at once —
why GL renders 32 frames and stops (the course only needs redrawing when the
view changes; the DIB is blitted from thereafter), why the app rewrites the
full client 3.3 times a second, and why the course is black (we never wrote the
DIB).

`src/09a8b-handlers-opengl.wat` is where it goes wrong. For `wglCreateContext`
and `wglMakeCurrent` it reads the owning HWND out of the DC and, when there
isn't one — precisely the memory-DC case — substitutes `$main_hwnd`:

```wat
(local.set $aux (i32.and
  (call $gdi_dc_get_field (local.get $arg0) (i32.const 92) (i32.const 0))
  (i32.const 0x7FFFFFFF)))
(if (i32.eqz (local.get $aux))
  (then (local.set $aux (global.get $main_hwnd))))
```

So a bitmap-target context is treated as a window-target one: its output is
published as a window layer, and the DIB the application actually blits from is
never written.

### A bitmap has no host presentation until somebody asks for one

The first attempt at the fix tagged the bitmap's *surface id* (`+40` in the
48-byte `GdiBitmap` record) and had `lib/gl-compat.js` look it up in the host's
`_gdiSurfacePresentations` map. That map came back empty every time, so
`createBitmapContext` returned 0, `wglCreateContext` failed, and SimGolf quit
during startup — a strictly worse outcome than the black course.

The reason is structural rather than accidental. `host_gdi_surface_create` — the
only thing that puts an entry in that map — has exactly four call sites in the
whole tree:

```
src/10e-gdi-metafile.wat:315     an EMF playback target
src/10f-gdi-dc.wat:1441          a top-level window's canonical surface
src/10f-gdi-dc.wat:1540          $gdi_dx_dc_bind, a DirectDraw surface DC
```

An ordinary `CreateDIBSection` bitmap is not among them. The WAT rasterizer
draws into the record's own bits and never needs a host-side twin, so a memory
DC's DIB is invisible to JavaScript by design; `+40` stays 0 for its whole life
and `host_gdi_surface_upload` calls naming that bitmap are no-ops.

So the WGL handler has to *create* the presentation before it can name the
bitmap as a drawable — 12 fields straight out of the record, with the bitmap
handle as the id (the convention `gdi_surface_upload` already uses for bitmaps
at 10a:764), then `+40` written back so `DeleteObject` retires the host surface
with the bitmap. Only then does `aux` get the `0x80000000` tag. A record that
fails `$gdi_bitmap_record_valid`, or a create the host refuses, still falls back
to `$main_hwnd`: a wrong drawable draws in the wrong place, but a refused
context makes the game exit.

### The remaining black wedge is geometry the guest never submits

With the bitmap target wired up the course renders, but a straight-edged black
triangle stays in the upper right. Three measurements, all in the browser under
`--threads --gpu`:

1. **A magenta pre-clear of the drawable.** A temporary `?glclear` hook painted
   the WebGL drawable magenta at `wglCreateContext`, before the guest ever drew.
   The wedge came back *magenta*, not black — so nothing rasterizes there. It
   also showed the same magenta between individual terrain tiles wherever the
   burst had not finished, which is what the "triangular notches beside each
   pond" were.
2. **A screen-space census of every batch the frontend rasterizes.** A `?glprobe`
   hook transformed each `_drawGeometry` batch by the live modelview×projection
   and accumulated a 40×30 occupancy grid of the 800×600 client. Every cell is
   covered except a triangle in the upper right whose edge has slope 0.5 — the
   isometric axis. Nothing we drop: `_drawGeometry` is never called for it.
3. **A 180-second draw-count series.** `draws` goes 8231 → 8677 between t=5s and
   t=180s, i.e. about one batch per `glFlush` — the steady-state interface draw.
   The terrain burst is over and the wedge is not being filled in later.

So this is not a lost batch, a dropped primitive or a publish that erases the
guest's own pixels. **The guest culls it.** The wedge is the part of the client
outside the map-space rectangle SimGolf decided was visible, and its image on
screen is a diamond whose edge crosses our 800×600 client.

Two hypotheses tried and rejected:

- *We overwrite guest GDI content there.* True in general and **the cause of a
  separate, larger bug** — see the next section — but not the cause of the
  wedge: publishing only the pixels GL rasterized leaves the wedge black, so
  there is no guest content underneath *it*. The measurement that first said
  "we erase 12–196 pixels a frame, never the ~43600 the wedge covers" was
  survivor bias: the *first* publish had already destroyed the GDI content, and
  SimGolf redraws on demand, so from then on the before/after sampler compared
  two black rectangles and reported `bothBlack` 43632 for the whole window.
- *The terrain burst is cut off.* The burst is genuinely slow — at 60s one run
  had covered half the client and another all of it but the wedge — but it does
  finish, and the wedge survives it.

The remaining question was a guest-side one — what does SimGolf compute its
visible map rectangle from — and the answer is: from a hard-coded table, and we
feed it the right row.

## The world rectangle is a per-resolution constant, and 800x600 is in the table

`Terrain.dll+0x8cf7` sets the projection for the 3D pass, and before it does it
picks the size of the world it will show from three literal pairs keyed on the
client size it was given:

| client | world extent |
|---|---|
| 800x600 (`0x320 x 0x258`) | 1767.8 x 1325.7 |
| 1024x768 | 1809.5 x 1357.6 |
| 1280x1024 | 1740.6 x 1392.5 |

then applies the zoom step (`x4`, `x2` or `x1` for zoom modes 1, 2 and 4) and
calls `glOrtho(-w/2, w/2, h/2, -h/2, 5000, -5000)`. A live trace of the guest's
matrix calls from page load reads

```
glViewport 0 0 800 600      (canvas 800x600)
glMatrixMode GL_PROJECTION; glLoadIdentity
glOrtho -883.9 883.9 -662.8 662.8 5000 -5000
```

which is the 800x600 row at zoom 1, against a drawable we sized 800x600. So the
guest is looking at exactly the world rectangle it was designed to, we hand it
the client size it expects, and it simply submits no tiles past the edge of its
map — the wedge is off-map, and its boundary moves across the client as the
demo's camera scrolls. It is not a value of ours.

## What the wedge investigation did find: we were erasing the game's own GDI

SimGolf's picture is **two renderers sharing one bitmap**. `Terrain.dll` imports
45 GL entry points and `glClear` is not among them — it never clears, because
with `PFD_DRAW_TO_BITMAP` the DIB it renders into already holds a picture.
`jgl.dll` is the other half: `CreateDIBSection`, `CreateCompatibleDC`, `BitBlt`,
`StretchBlt`, `TextOutA`, and it draws the trees, the golfers, their name plates
and the 2D layer straight onto that same bitmap.

Our WebGL drawable is a surface of our own, so `_publishToBitmap` wrote the
*whole* canvas into the DIB and everything jgl had put there went with it. The
proof is a one-line change to the publish — keep the DIB's pixel wherever GL
rasterized nothing — photographed at the same 60 s mark:

- before: bare terrain, no trees, no golfers, no labels
- after: a full course, ponds, tree lines, a golfer and a "Gary Golf" name plate

The fix in the tree is not that heuristic. `WebGLBackend.seedColorBuffer` paints
the DIB into the colour buffer as a full-screen textured quad (saving and
restoring every capability, `depthMask` and viewport it touches), and
`_seedFromBitmap` runs it on the first primitive after each present, so the
emulated drawable starts each frame holding what the bitmap holds — which is
what a driver rendering directly into that bitmap would find.

### What the seed/publish census measured

A temporary in-page counter (since removed) sampled every 16th pixel of the
800x600 drawable — 30000 samples — at each seed and each publish, and recorded
how many primitives had been drawn since the previous present. Two regimes:

| phase | seed non-black | publish non-black | draws |
|---|---|---|---|
| active render, ~58-64 s | 0, then N | N (peak 23484 = 78%) | 1455, 529, 464, 395 … |
| steady state, 98 s on | 11357 | 11357 | 1 |

Read it as a pair of frames per guest frame: the guest wipes the DIB, we seed
from the wiped bitmap, GL draws the course and publishes 78% coverage; the
immediately following batch seeds from *that* (`seed 8047` after
`publish 8047`) and publishes a touched-up frame. So the read-back round trip
is lossless — the bitmap keeps our frame — and the guest's own wipe at the top
of each frame is its business, not ours. In steady state one draw per frame
recycles the same 11357 samples indefinitely, which is the round trip proving
itself over hundreds of frames.

The other half of the fix is in `_publishContext`: when `needsSeed` is still
set nothing has rasterized since the last present, so our copy of the drawable
is older than the bitmap the application has been drawing on with GDI in the
meantime. Publishing it would undo that GDI and there is nothing new in it to
write, so the publish is skipped.

## Resolution

At 70 s the demo renders its attract-mode course in full: the isometric
terrain with fairways, bunkers and ponds, tree lines, the "Gary Golf" golfer
and his name plate, the "Click on the big Build Course button" prompt, the
money / mood / par readouts and the interface pod. The black area outside the
course diamond is the off-map region documented above — the guest submits no
geometry there.

### Driving the interface pod headlessly

```sh
node tools/web-input-probe.js --app=simgolf_demo --threads --gpu \
  --ready=180000 --query='?debug' \
  --steps="wait:75000;shot:/tmp/ui-0.png;click:42,475;wait:4000;shot:/tmp/ui-1.png;\
click:116,500;wait:4000;shot:/tmp/ui-2.png;click:175,538;wait:4000;shot:/tmp/ui-3.png"
```

Mouse coordinates are guest coordinates. `42,475` is the big **Build Course**
button at the top of the pod: it lights yellow, the demo switches to build mode
with "First we need to build a tee.", and the terrain palette unrolls along the
bottom of the client with all sixteen tiles drawn and labelled — Tees, Fairway,
Green, Firm fairway, Sand trap, Deep rough, Rough, Waste bunker, Pot bunker,
Brush, Stream, Rocks, Water, Pine tree, Tree, Palm tree. `175,538` opens the
**People** pod: its icon cluster expands and a scrollable roster panel with live
scroll arrows appears (empty, because the new course has no golfers yet). The
menu layer is jgl's GDI on the shared DIB, so this is also the end-to-end check
that the seeding round trip does not eat the interface.

## What is actually slow: jgl's per-pixel blitter, not Terrain's GL

The earlier section blamed the GL command volume ("15,312 `glArrayElement`
… thousands of tiny independent primitives"). A handler/hot-block histogram
taken *in the browser* says otherwise, and it is the first profile of this app
that measures where guest instructions go rather than what reaches the bridge.

`--handler-hist` only exists in `test/run.js`, and SimGolf cannot run there at
all: `lib/gl-compat.js` needs a `document`, so `wglCreateContext` returns 0
headless and the game exits during startup. The counters are plain wasm
exports, though, so the page can read them:

```sh
node tools/profile-web-frames.js --app=simgolf_demo --headful --warmup=240 \
  --seconds=20 --query='?debug&perf' \
  --after-launch="$(cat tools/page-probes/arm-handler-hist.js)" \
  --report-eval="$(cat tools/page-probes/read-handler-hist.js)"
# then paste the report-eval line into hist.json
node tools/browser-handler-hist.js hist.json --top=18 --blocks=20
```

`arm-handler-hist.js` is a `setTimeout` that calls `reset_handler_hist()` +
`set_handler_hist_enabled(1)` on `runningApps[0].wine.instance.exports`;
`read-handler-hist.js` walks `get_handler_hist_base/_slots` and
`get_hot_block_hist_base/_count` and ships the pairs plus `wine.moduleBases` out
as JSON. `tools/browser-handler-hist.js` names the handlers from
`src/02-thread-table.wat` and attributes each block to `module+0xVA`. Counts
are load-immune, which matters here: this box was at load average 200.

A 30-second gameplay window:

```
ops 141,509,825   block entries 36,518,090   3.88 ops/block   distinct blocks 1612

jgl.dll          26,756,290  (73.3% of all block entries)
golf.exe          7,708,705  (21.1%)
```

**3.88 ops per block** is the headline. Diablo's menu runs 282. Nearly all of
the interpreter's time here is block transfer and dispatch, not the ops
themselves — and the reason is visible in the top blocks, five of which are one
loop:

| block | hits | what it is |
|---|---|---|
| `jgl+0x100153a5` | 5,987,331 | `cmp byte [esi],0xff` / `jnb` — source colour-key test |
| `jgl+0x1001546b` | 5,987,331 | `inc esi` / `inc ebx` / `add edi,2` / `dec edx` / `jnz` — the advance |
| `jgl+0x100153ae` | 3,483,668 | `cmp byte [ebx],0xff` / `jnb` — alpha-map key test |
| `jgl+0x100153b7` | 3,282,372 | `mov al,[ebx]` / `cmp al,0` / `jz` — opaque shortcut |
| `jgl+0x10015462` | 3,097,620 | `mov ax,[ecx+eax*2]` / `mov [edi],ax` — palette copy |
| `jgl+0x100153c5` | 184,752 | the actual RGB555 blend |

That is one function — `jgl+0x10015361`, an 8bpp-indexed → RGB555 sprite blit
with a separate per-pixel alpha map. Per pixel it costs **five block entries and
~12 threaded ops**, and the blend arithmetic those blocks exist to guard runs on
**3% of pixels** (184,752 of 5,987,331): 2.5M pixels are transparent, 3.1M are
opaque palette copies. The second blitter, `jgl+0x10016ea8` (colour-key plus a
`0xf8` shadow-table case), adds another 13% of block entries with the same
shape. `golf.exe+0x42c2d0` — a 50x50 tile-grid accessor that bounds-checks both
coordinates before a word load — is third at ~505k calls.

So the profile is a software sprite engine executed one pixel at a time, and
the GL side is not in the top 40 blocks at all. `tools/match-loops.js` declines
both loops as **`multi-branch`** (151 of jgl.dll's 844 self-loops decline that
way), which is precisely the class Design A cannot lower: the two sentinel
tests split each pixel into four or five basic blocks. A fold that recognised
"load byte, test against one or two sentinels, LUT to a word, store, advance
two streams" — a colour-keyed `LUT_RUN` with an early-out — is the one change
this app's profile actually asks for.

## Threads vs cooperative

Both arms headful, 240s warmup, 20s sample, same build. The box was busy and
its load moved between arms (15-19 vs 44), so **the guest-side numbers below
are not a clean ratio**; the structural difference is what holds.

| | `--threads` (guest in a Worker) | cooperative (guest on the main thread) |
|---|---|---|
| page rAF | 60.0 fps, p99 18.5ms, 0 frames over 33ms | 14.7 fps, p99 300ms, 88 frames over 100ms |
| long tasks | none | 87, mean 199ms, 86% of the sample blocked |
| `throttledPct` | 0% | 91% |
| guest presents | 4.55/s | 3.14/s |
| blocks/s | 2.0M | 1.21M |
| phase split | `guest 0% / threads 99% / paint 0%` | `main 13.1s / workers 0.04s` |

Cooperative mode runs a 100,000-step slice on the main thread, so each slice
*is* a long task and the page cannot paint through it — that part is
architectural and load-independent. Worker mode does not make the emulator
faster in any deep sense (both arms are interpreter-bound in the same jgl
loops); it moves the work off the thread that has to composite.

## Why the sound stutters

`--trace-api=IDirectSoundBuffer_*` over one ~250-second cooperative run:

```
  96 IDirectSoundBuffer_Play      (dwFlags=1, DSBPLAY_LOOPING, one buffer 0x07f4e010)
  94 IDirectSoundBuffer_Stop
  12 IDirectSoundBuffer_Lock
  12 IDirectSoundBuffer_Unlock
```

Miles restarts the looping voice about **0.4 times a second** of real time but
refills its ring only **12 times in four minutes**. The ring is 65,536 bytes at
22 kHz/16-bit/stereo — 0.74 s of audio — so the device consumes the whole ring
roughly every second while new mixed content arrives every ~20 s. What a
listener hears is the same three quarters of a second repeating, with a
discontinuity at each `Stop`/`Play` restart (`playRing` builds a fresh
`AudioBufferSource` there).

This is not a bug in `lib/host-audio.js`'s ring handling — that path was fixed
earlier in this file and the cursor arithmetic is right. It is the same
throughput finding from the audio side: the Miles mixer runs in guest time at
roughly a twenty-fifth of the machine it was written for, and audio is the one
consumer that runs at real time no matter how slow the guest is. Nothing in
the host can paper over it; making the blitter loops cheaper is what would
also fix the sound.

## Measured browser frame rate: ~2-3 fps of gameplay, in BOTH backends

Headful Chrome against `tools/dev-server.js --isolate --port=8123`, one
20-second sample after the loader, `?debug&perf` so `WinePerf.snapshot()`
carries phase attribution. `tools/profile-web-frames.js` grew a `--threads`
flag for this (it sets the page's `wine-assembly.threads` key between the
`localStorage.clear()` and the reload, serves COOP/COEP from its own static
server, and prints the backend that actually came up — worker startup can fail
and fall back, and a threads run that quietly measured the cooperative
scheduler is worse than no run).

| | cooperative | cooperative | worker threads | worker threads |
|---|---|---|---|---|
| loadavg during | 92 | 33 | 83 | 36 |
| **guest fps** (app's own presents) | **2.05** | **2.69** | **1.85** | **2.58** |
| page fps (compositor) | 24.7 | 16.8 | 60.0 | 59.4 |
| blocks/s | 2.73M | 1.32M | 1.89M | 1.12M |
| frame interval p50 / p90 (ms) | 17 / 149 | 17 / 251 | 17 / 18 | 17 / 17.5 |
| long tasks in 20s | 58 | 72 | 3 | 1 |
| main thread blocked | 66% | 81% | 0% | 0% |
| throttled | 99% | 98% | 0% | 0% |

**The game runs at two to three frames per second, and threads do not change
that.** What threads change is who waits: cooperatively the guest slice runs on
the main thread, so 66-81% of wall clock is inside a task the browser cannot
interrupt and the page composites at 17-25fps with a 250ms p90; on the Worker
backend the page is a clean 60fps with one long task in twenty seconds. The
emulated machine advances at the same speed either way — `guestFps` and
`blocks/s` are the same within the noise of this box, and `blocks/s` is
actually *lower* in the threads runs. A smooth 60fps page showing a 2fps game
is the outcome; `PRESENT/s`, application fps and page fps are three different
measurements and only the first two describe SimGolf.

Every one of these is flagged BUSY by the profiler (loadavg 33-104 across the
four runs), so read them as a floor. The ratio between backends is the robust
part; the absolute fps is not.

### Threads mode renders no terrain

The first threads run reported a flat 60fps and "the screen never changed",
which reads like a guest that never reached gameplay. It is not. Filming it
(`--film`) shows SimGolf **does** reach the interface — the title, the
`Christmas Pines MC / March 2001` course plaque, the control cluster — with the
entire course area **black**. The only pixels changing in that arm were the
perf HUD's own 300x152 box at (629,12), which is why the change probe read
idle. The cooperative film at the same point shows the course: water, shore,
trees and an animating swimmer.

So the worker backend is not slower on this app, it is **wrong** on it, and no
frame-rate comparison between the two is meaningful beyond the table above.
Untested hypothesis worth one session: SimGolf renders through the GL path,
`lib/gl-compat.js` needs a `document` and lives on the main thread, so a guest
main thread inside a Worker has to broker every GL call back — the terrain is
what would disappear first if that brokering drops commands.

### What the fold in docs/loop-idiom-superops-design.md §19.1 would mean here

2.0-2.7 fps now; the measured 2.8-3.4x puts it at **6-8 fps**. That is not
playable, but it is the difference between a slideshow and something that
animates, and it is the same factor that would let the Miles mixer keep its
0.74s ring fed. Nothing else measured on this app is worth more.
