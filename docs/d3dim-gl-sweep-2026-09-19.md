# D3DIM: WebGL executor vs the WAT software rasterizer, 2026-09-19

First corpus-wide comparison of `lib/d3dim-gpu.js` against the software D3DIM
path, run with `tools/d3dim-mode-sweep.js` on the Mac (`caffeinate -d -u`,
headless GL in Node — no browser). Sixteen DX2-7 apps, three runs each plus a
control:

| arm | flags | what it is |
|---|---|---|
| `sw` | none | what the app shows today |
| `glsw` | `--headless-gl` | a GL context exists, WAT still rasterizes |
| `glgpu` | `--headless-gl --d3dim-gpu` | the executor draws |
| control | none | `sw` again, for the null band |

**The executor's verdict is `glsw` vs `glgpu`.** That split is not pedantry: on
dx_twist the GL run differs from software by **71.9% of pixels while the
executor reported `draws=0`**, so every one of those pixels belongs to asking
for a GL context and none to the executor. A two-arm sweep charges it to the
wrong arm and reports a rendering catastrophe that does not exist.

## Results

| app | verdict | executor diff | GL-context diff | null band | GL draws | fallbacks |
|---|---|---|---|---|---|---|
| dx_boids | IDENTICAL | 0% | 0% | 0% | 211 | 650 |
| dx_flip3dtl | IDENTICAL | 0% | 0% | 0% | 666 | 0 |
| mw3 | IDENTICAL | 0% | 0% | 0% | 26 | 0 |
| gta2_demo | **DIFFERENT** | **0.7223%** | 0% | 0% | 72373 | 0 |
| dx_twist | NODRAW-DIFF | 71.9118% | 71.9111% | 0.0322% | 0 | 0 |
| dx_tunnel | NODRAW-DIFF | 0.0163% | 0.0153% | 0.0098% | 0 | 0 |
| dx_globe, dx_viewer, mcm, jazz2_demo, heroes3_demo, darkstone_demo, spider, pocket_tanks, captain_claw_demo, aoe2 | NODRAW | 0% | 0% (spider 5.78%, = its own null band) | 0% | 0 | 0 |

Budgets: 800 batches/25s for the DX samples and MCM, 6000/45s for the games,
4000/35s for the rest.

## What it says

**Where the executor ran, it agrees.** Three apps drew through it and came back
pixel-identical, including MechWarrior 3, and no app crashed only on the GL arm.

**GTA2 is the one real disagreement** — 72,373 draws, zero fallbacks, 0.72% of
pixels, against a null band of 0%, with the changed box at `300,255 133x218`:
the main menu's PLAY/OPTIONS/QUIT text. It is the only app in the corpus that
puts a five-figure draw count through the executor, so it is also the only one
whose agreement is worth much — and that is the next thing to look at.

**Eleven of sixteen apps never drew a triangle.** A headless startup slice
reaches a 2D menu, not gameplay; most of these need input to get into a 3D
scene. `NODRAW` is reported as its own verdict rather than folded into
IDENTICAL for exactly that reason: it is absence of coverage, not evidence of
agreement. Extending this sweep means giving each app a deterministic route to
its first 3D frame (the `test-mw3-gameplay.js` pattern), not a longer budget.

**`--headless-gl` alone changes what dx_twist shows.** 71.9% of pixels, against
a 0.03% null band, with no executor involved. That is a finding about the
headless GL path, filed here because this sweep is where it turned up.

## Running it

```
node tools/d3dim-mode-sweep.js --all --control --md=/tmp/sweep.md
node tools/d3dim-mode-sweep.js --apps=gta2_demo --batches=6000 --seconds=45 --control
```

Captures land in `build/d3dim-mode-sweep/<app>-{sw,glsw,glgpu,sw2}.png`, so any
row can be re-diffed by hand with `tools/png-diff.js --out=`.
