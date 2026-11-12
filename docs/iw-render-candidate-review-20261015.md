# Invisible War renderer candidate review — 15 October 2026

Review base: `343befcb182f3582a3214df5636c49f1176b435e` (includes the
`e86bf1640` production changes). This branch is a held adaptation, not an
integration or a runtime qualification. No build, GPU, browser, guest, or Boat
operation was run. Cross-process transport and shared task ledgers are untouched.

## Finding and bounded correction

Do not cherry-pick `1d5243e237ddb27837ee4a3c1c0aa281006468ec` unchanged.
`lib/d3d9-fixed.js` terminates the cascade when `colorArg1 === 2` and texture
zero is absent, including when COLOROP is SELECTARG2. Initial diffuse RGB then
remains the final visible RGB. The held candidate sees the nominal independent
arguments and replaces that initial diffuse with zero anyway. With RGB mask 7,
SELECTARG1(TEXTURE), SELECTARG2(TFACTOR) with ARG1=TEXTURE, and
MODULATE(TEXTURE,TFACTOR) all become black rather than preserving diffuse.
With a position-only vertex shader it can additionally hide a genuinely live
missing-color linkage error. This is not merely a dead-alpha optimization.

The adaptation retains both original backend changes and adds one exclusion
matching the compiler's exact missing-ARG1-texture termination rule. It does
not invent a texture result or relax the compiler's validation. A subsequent
change to cascade termination must update this exclusion and the regression.

## Discard, alpha, depth, and stencil review

The colorless candidate `7b89c446c0b1a81ec88b271282cec70d78a25138` has no
additional source correctness blocker found under its conservative guards:

- Replacement is after real fixed-function/shader compilation. It applies only
  to fixed pixel programs with color mask zero and excludes alpha test, color
  key, outline coverage and fog. Current fixed pixel lowering has only alpha
  test and sampled stage-zero key discard; it does not write fragment depth.
  Projected-coordinate invalidity sanitizes a sample, without discarding.
- The replacement fragment program neither discards nor changes depth. Existing
  depth comparison/write, stencil fail/depth-fail/pass and masks remain in the
  backend's unchanged state setup and draw path. These are source observations;
  actual coverage and stencil results require WebGL verification.
- Fixed alpha test is emitted from `draw.fixedFunction`; the production D3D9
  host mirrors its render-state alpha test there. The separate `draw.state`
  wrapper applies to guest pixel shaders, which both optimizations exclude.
  This patch does not redefine inconsistent diagnostic-only state snapshots.

The RGB candidate retains the original no-alpha-test, no-specular, one-stage,
CURRENT-result, alpha-masked, alpha-op-disabled and independent-input guards.
Supported source-alpha blend factors 5, 6 and 11 are excluded in either blend
slot whenever blending is enabled. Source/destination-color factors only
consume the RGB being preserved. No separate-alpha blend path exists in this
backend. Unsupported blend factors still fail the unchanged later validation.
TEXTURE/TFACTOR/CONSTANT alpha-replicate/complement modifiers remain independent
of diffuse. Key discard is safe to retain for this rewrite because it consumes
sample alpha, not initial current alpha; the entire texture sample and discard
remain in the source. Unlike the colorless replacement, the RGB rewrite does
not replace the fragment program or strip uniforms/metadata.

## Evidence and remaining gate

Run `node tools/check-iw-render-candidates.js` from this worktree. It runs the
real current fixed-function compiler and extracts the exact transformation
blocks from this branch and the historical commit using `git show`. It fails
if either block is absent. It uses no GL mock, fabricated framebuffer, or
success-returning implementation stub. The historical commit must be available
in the repository; absence is an error, not a skipped check.

Result: **27 source checks passed**, including reproduction of all three
historical missing-texture cases and corrected diffuse retention; independent
stage rewrites; both source/destination source-alpha blend guards; live diffuse,
current, specular and temporary arguments; alpha-test preservation; multistage
retention; key sampling/discard preservation at masks zero and seven; and
programmed-pixel/outline/fog exclusion. The missing-texture regression checks
the entire real generated GLSL body is diffuse-to-output identity before
showing the historical transformation changes its initialization to zero.
`node --check lib/d3d9-backend.js` and `git diff --check` also passed.

This source test does not execute GLSL, link varyings, rasterize fragments, or
measure performance. The original WebGL1/2 stencil/RGB candidate regressions
must be rebased without losing current tests and expanded with a VS supplying
nonzero diffuse RGB for the missing-texture cases before integration. Retain
positive/negative alpha tests and keyed/non-keyed stencil fail/depth-fail/pass,
masked RGB blend factors, and visible missing-varying rejection. Runtime
authorization and current-build qualification remain separate. Invisible War
gameplay/transport stays held; this review makes no new gameplay claim.

## Prepared browser regression follow-up

`test/test-d3d9-stencil-web.js` now contains the actual WebGL1/2 test adaptation,
without running it. Current-main's original stencil test block is preserved
byte-for-byte, checked by the source tool. Both original candidate additions
are retained, with named observations for new cases and a requested-version
check. The explicit shader fixture outputs nonzero diffuse RGB 64/128/192 and
texture coordinates from separate constant registers. Missing-texture
SELECTARG1/SELECTARG2/MODULATE must preserve those RGB values with mask 7;
the same draws with a position-only shader must reject live missing color
linkage. Both checks discriminate against historical `1d5243e`.

Source-alpha factors 5/6/11 cover both blend slots. Alpha-test and color-key
fixtures each have surviving and discarded controls for stencil fail,
depth-fail and pass. A subsequent same-depth LESS probe checks whether depth
remained clear or was written; only a surviving pass may write depth. Thus a
no-op or always-discarding draw cannot satisfy the control matrix. GPU results
will include per-version observations and GL errors rather than a bare pass.

Preparation validation: **30 source checks pass**, browser test syntax and
diff checks pass. Actual shader compilation confirms oD0=c0 and oT0=c1;
an initial ad-hoc source assertion expected direct assignment, failed on the
compiler's intermediate temporaries, and was corrected to verify that actual
dataflow. This was a source-check issue, not a renderer/GPU result. No browser,
GPU, build or sandbox execution occurred. Run the prepared browser regression
only after the runtime grant; this follow-up does not remove the integration hold.

After an explicit runtime grant, in the exact candidate checkout with its
existing Puppeteer dependency available and `CHROME` set to the verified
absolute browser executable, the bounded command is:

```sh
timeout --signal=TERM --kill-after=10s 90s node test/test-d3d9-stencil-web.js
```

Record the checkout commit, browser version, actual requested/observed WebGL
versions, both JSON result records, exit status and GL errors. A timeout is
inconclusive, never a pass. This renderer-only test does not need a WAT build
and must not start a guest. No browser path or dependency availability has
been verified by this source-only preparation.

For a discriminating mutation in a separate disposable checkout, delete only
`&& !(firstFixedStage.colorArg1 === 2 && !draw.textures?.[0])` from the adapted
backend. The three named missing-texture RGB observations must fail (zero RGB
instead of 64/128/192); the three corresponding live-color linkage rejection
observations should also fail because the mutated program no longer reads
diffuse. The source regression fails immediately on the same mutation. Do not
modify or weaken the oracle to accept those results. The browser harness stops
after the first failing version's assertion, with that version's complete
observation record in its failure output; the unchanged candidate must pass
both versions. Mutation runtime is not yet authorized or executed.

## Runtime gate completed (supersedes preparation-only status above)

Root ran exact candidate14dd0c539 on bx_9ef2wdsw after CMR3 released the sole runtime slot. Chrome151.0.7922.108 passed77 checks in each actual WebGL1/2 context with zero GL errors. Removing only the missing-texture termination guard in a separate disposable copy failed all three RGB retention and three live-color linkage observations as expected; no oracle was weakened. Candidate source remained clean, and postflight found no browser survivors. The reported ANGLE Intel/Mesa renderer string is recorded, not treated as proof of physical GPU execution.

The four renderer/compiler library files on current main before integration were identical to the review baseline, and the integrated source suite passed30 checks. This clears the renderer integration gate only: IW transport, actual game correctness, device coverage and performance remain unqualified. Exact observations and negative controls are in [the runtime receipt](iw-render-gpu-result-20261015.json); raw logs and hashes are retained in scratch/runs/20261015-iw-render-gpu.
