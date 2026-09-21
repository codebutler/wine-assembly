# DX5 SDK `boids.exe` — 33,423 draws, one-colour frame

`test/binaries/dx-sdk/bin/boids.exe`, image base `0x400000`. A DirectDraw +
Direct3D Immediate Mode **v2** sample: flocking birds over a wireframe ground
grid.

**RESOLVED 2026-09-21 — it renders.** 1 colour → 223, wireframe terrain in
perspective with the flock above it. The bug was ours and it was in the x87:
`FSIN`/`FCOS`/`FSINCOS`/`FPTAN` never wrote **C2**. Jump to
[the root cause](#root-cause-fsinfcos-never-cleared-c2); everything above it is
the (correct) investigation that led there, kept because each step rules
something out.

Status was **WARN — BLANK (1 colour, 100%)**. This note records why, because
the symptom reads convincingly like a dead rasterizer and is not one.

## The frame is blank because the guest's own projection matrix is ±infinity

The app builds its projection at `0x00420720` and hands it to
`IDirect3DDevice2::SetTransform(D3DTRANSFORMSTATE_PROJECTION)`. Dumped at
batch 70:

```
node test/run.js --exe=test/binaries/dx-sdk/bin/boids.exe \
  --max-batches=80 --batch-size=100000 --max-seconds=60 --no-close \
  --quiet-api --quiet-blocks --input=70:dump-mem:0x00420720:64
```

```
0x00420720  00 00 80 ff  00 00 00 00  00 00 00 00  00 00 00 00
0x00420730  00 00 00 00  00 00 80 ff  00 00 00 00  00 00 00 00
0x00420740  00 00 00 00  00 00 00 00  00 00 80 ff  00 00 80 ff
0x00420750  00 00 00 00  00 00 00 00  00 00 80 7f  00 00 00 00
```

`0xff800000` is −∞ and `0x7f800000` is +∞, so `_11`, `_22`, `_33`, `_34` and
`_43` are all infinite. Every vertex therefore projects to infinity and nothing
can land inside the viewport. **The matrix is written by guest code**, so this
is an input we feed it, not a bug in our transform or our rasterizer.

Shape of the SDK's `D3DUtil_SetProjectionMatrix`: `_11`/`_22` are
`cos(fov/2)/sin(fov/2)` (×aspect for `_11`) and `_33 = far/(far−near)`. All of
them infinite at once means `sin(fov/2)` came back 0 **and** `far−near` came
back 0 — one shared upstream zero, not three independent ones.

## Everything else in the pipeline is healthy — don't re-check it

Measured over a 300-batch run (`--max-batches=300 --batch-size=100000`):

| call | count |
|---|---|
| `IDirect3DDevice2_DrawIndexedPrimitive` | 33,423 |
| `IDirect3DDevice2_SetTransform` | 21,946 |
| `IDirect3DDevice2_SetRenderState` | 13,956 |
| `IDirect3DDevice2_SetLightState` | 7,977 |
| `IDirect3DMaterial3_SetMaterial` | 6,492 |
| `IDirect3DViewport3_Clear` / `BeginScene` | 499 |
| `IDirectDrawSurface_Flip` | 498 |

- **Vertex data is correct.** `0x004200c0` holds `D3DLVERTEX`s with sane model
  coordinates — `(−25, 0, 35)`, `(−15, 0, 35)`, `(−5, 0, 25)`, colour
  `0xff004c7f`. That is the ground grid, drawn as `D3DPT_LINESTRIP` (primType 3)
  of `D3DVT_LVERTEX` (vtxType 2).
- **The render target is bound.** There is no `CreateDevice` and no
  `SetRenderTarget` in the trace: the device is made the D3D2 way, by
  `IDirectDrawSurface::QueryInterface` for a device IID, which
  `09a8-handlers-directx.wat` routes into `$d3dim_create_device` with the
  surface as RT. `GetRenderTarget` at `#244` returns a surface the app then
  successfully QIs at `#245`, which proves `DxObject.misc0` was seeded.
- **All three transforms are set** — VIEW (2), PROJECTION (3), WORLD (1).
- **Clear reaches the surfaces.** `--dx-surfaces` shows slots 4/5/6 (primary,
  back, offscreen, 640×480 16bpp) all at exactly one colour `#000c18`, and
  slots 12/13 (256×256 textures) holding **92 colours** — so texture upload
  works too.

## Lead: 42,117 x87 invalid-operation raises

```
node test/run.js --exe=... --trace-fpu   # 42,117 lines
[fpu] raise IE at 0x0041623c   (every one of them)
```

`0x0041623c` is `fld m80real [0x41e620]` + `fistp` inside the CRT helper at
`0x00416230`, called from `0x0041699a` and `0x004169b9`. That helper *raises FP
exceptions on purpose* — it is how MSVC's `_control87`/`_statusfp` family
reports status — so the raises are not themselves the bug. What is suspicious is
the **volume**: 42k deliberate raises means the app's math library is taking an
error path tens of thousands of times, which is consistent with the shared
upstream zero above.

`--trace-fpu` shows no `ZE` at all, so the infinities are not coming from a
plain divide-by-zero in our FPU. They come from the CRT taking an error path.

## Root cause: FSIN/FCOS never cleared C2

The builder is `0x00407c1b`. It is **not** the SDK's
`D3DUtil_SetProjectionMatrix`: it stores `cos(fov/2)` straight into `_11`.

```
00407c24  fld dword [ebp+0x14]        ; fov
00407c27  fmul qword [0x41c020]       ; * 0.5
00407c33  call 0x414eca               ; cos  -> [ebp-0xc]  -> _11
00407c4d  call 0x414ec0               ; sin  -> [ebp-0x8]
```

`0x414ec0` is `mov edx,0x41e592 ; jmp 0x416125`, and `0x41e592` is a descriptor
beginning with the Pascal string `"\x03sin"`; `0x414eca` is the same with
`"\x03cos"` at `0x41e5b2`. Both funnel into the classifier at `0x00418a70`:

```
00418a9d  fxam
00418aa6  fnstsw qword [ebp-0xa0]     ; DD /7, m2byte
00418ab4  mov cl, [ebp-0x9f]          ; status high byte
00418aba  shl cl,1 / sar cl,1 / rol cl,1
00418ac2  and al, 0xf                 ; index = C3 | C0<<1 | C1<<2 | C2<<3
00418ac4  xlat                        ; class table at 0x41f10d
00418ad5  jmp [ebx]                   ; descriptor+0x10 + class
```

Class table `08 04 08 08 08 04 08 08 00 04 0c 08 00 04 0c 08`. A positive
normal indexes 8 → `0x00` → the first handler, `0x00415f1a`:

```
00415f1a  fsin
00415f1d  fnstsw ax
00415f20  sahf
00415f21  jp 0x415f2f                 ; taken when C2 is set
00415f23  ret
```

**`SAHF` takes PF from `AH` bit 2, which is C2.** Real `FSIN` clears C2 when
`|ST(0)| < 2^63` and sets it otherwise; that is how the CRT asks "did you need
argument reduction?". Our `FSIN`, `FCOS`, `FSINCOS` and `FPTAN` never wrote C2
at all — and C2 is **sticky**, so it still held the `1` that the `FXAM` two
instructions earlier had set for a normal number. Every in-range argument took
the reduction path and came back infinite.

Fixed in `src/06-fpu.wat` with `$fpu_trig_c2`: clear C2 and compute when
`|ST(0)| < 2^63`, otherwise set C2 and leave the stack untouched (NaN counts as
in range). `FPREM`/`FPREM1` already did this; the trig ops were the gap.
Regression cases in `test/test-x86-ops.js` run `FXAM` first **on purpose**,
because that is what makes C2 dirty — without it the bug is invisible.

`dx_flip3dtl` had the same root cause and now draws its textured rotating
Windows 95 cube (77 colours).

This is not a boids-specific bug: it is every guest that reaches x87 trig
through an MSVC or Borland CRT, which is the usual way.

## Not the same bug as its neighbours

`dx_flip3dtl` did share it and is fixed too (see above). `dx_globe` and
`dx_viewer` are a different, known failure —
`D3DRMERR_BADFILE` on `sphere3.x`/`camera.x`, the `.x` loader asset gap.

The 2026-09-19 D3DIM/GL sweep scored `dx_boids` **IDENTICAL, 0% diff** between
the GPU and software backends. That is two blank frames agreeing, not coverage;
see `docs/d3d-backend-coverage.md`.
