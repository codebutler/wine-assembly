# DX5 SDK `boids.exe` — 33,423 draws, one-colour frame

`test/binaries/dx-sdk/bin/boids.exe`, image base `0x400000`. A DirectDraw +
Direct3D Immediate Mode **v2** sample: flocking birds over a wireframe ground
grid.

Status in `test-all-exes`: **WARN — BLANK (1 colour, 100%)**. This note records
why, because the symptom reads convincingly like a dead rasterizer and is not
one.

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

Next step is to find which libm call returns 0 (or a domain error) where real
Win98 returns a nonzero: `sin`/`cos` around the FOV, or whatever feeds
`far−near`. `--trace-fpu` shows no `ZE` at all, so the infinities are not coming
from a plain divide-by-zero in our FPU.

## Not the same bug as its neighbours

`dx_flip3dtl` (black + a yellow text overlay, 115,686 GPU draws) may share this;
unverified. `dx_globe` and `dx_viewer` are a different, known failure —
`D3DRMERR_BADFILE` on `sphere3.x`/`camera.x`, the `.x` loader asset gap.

The 2026-09-19 D3DIM/GL sweep scored `dx_boids` **IDENTICAL, 0% diff** between
the GPU and software backends. That is two blank frames agreeing, not coverage;
see `docs/d3d-backend-coverage.md`.
