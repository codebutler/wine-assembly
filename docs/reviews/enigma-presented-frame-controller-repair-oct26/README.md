# Enigma presented-menu controller repair

Candidate evidence base: `4cc1a8899b16567f9b2f678b7cf988b859a37a95`.
This branch adds a reusable controller and an offline regression fixture. No
game, module, capture helper or runner was patched. No build/guest/native/browser,
box contact, service, deployment, acquisition or main integration occurred.

The original controller failed before input: `before framebuffer differs from
inspected menu; no click`. Its direct `getImageData` hash was
`3630e065eb7b4540fbab11dbfd2619e8500f211b9c404380a1867fdc44b77c0c`.
Both original final/predecessor PNGs instead had SHA256
`8ffead1b04adbe5fac8d82c5a374375f5883898b29e87962d72c3c3e26da18d5`,
640x480, RGBA SHA256
`a44ee9b285f41ab7ac824d47703d06a81cf85b126b77cb6b93ae0b285207f587`.
The unchanged inherited predecessor PNG is reused directly by the fixture.
The retained original controller/first failure and original committed recipes
remain immutable. Input/runtime were untested, not failed.

## Boundary and transaction

The pinned runner's canonical `png` action calls `canvasToPng`, which calls
`presentForRead`, then `dxPresentHook`: present DirectDraw, repaint/composite,
serialize. Control `eval` runs inside `new Function`, so it cannot call the
private hooks. A direct-canvas read after a guessed delay is not a valid oracle.

The new controller requires an exclusive, frozen, idle runner with zero step
credits and no recording. It checks the menu title, arms a temporary repaint
observer, requests canonical PNG to a fresh absolute output path, then reads
that exact file via control eval. It checks PNG and canvas640x480 dimensions,
batch/path/byte acknowledgements, the exact inspected PNG hash, and344,212
within both the framebuffer and inspected Start Game bounds269,194–417,232.
The repaint observer must see exactly one call through the canonical hook;
missing hooks fail even when the existing canvas already matches the menu.
The observer is restored in a finally block, and cleanup must succeed before
one ordinary `click:344:212` is queued. There are no sleeps, steps or input
between readback and click. Runner click dispatches one mouse-down/up pair.
The returned receipt means queued, not delivered or accepted by the game.

Exact PNG byte equality is deliberately strict: a different lossless encoding
also rejects. This avoids assuming raw canvas equals canonical image and binds
the gate to the accepted helper/encoding configuration. The canonical helper
SHA256 is `9dae92170fbf4ef5acf0a2b0be43b93d3b3a7c8ec86f227df708d3b65d67cb4b`;
its unchanged exact bytes and runner excerpts/hashes are retained in the fixture.
The original single-frame capture profile allows one PNG. A future assignment
must explicitly budget this pre-click PNG and any post-click capture instead
of silently reusing that profile for two frames.

## Offline acceptance

From the sparse task checkout:

```sh
/home/user/.nvm/versions/node/v24.18.1/bin/node --max-old-space-size=192 test/test-enigma-presented-menu-controller.cjs
```

The same command contains the before reproducer (one legacy failure, no click)
and after acceptance:24/24 checks,20 fail-closed controls, two positive scenarios
each clicking exactly once. Tests prove runner-private hooks are inaccessible,
canonical present/repaint/serialize/write/readback/click order, lazy/eager menu
acceptance, changed-pixel and wrong-size rejection, missing-hook rejection even
with matching pixels, transport/eval/file errors, batch/path/byte/frozen checks,
changed title, existing output and one-shot replay rejection. No guest executes.

Mocks execute byte-exact pinned runner boundary functions and implement a
dependency-free canvas/filesystem/PNG fixture. Matching pixels serialize the
original inspected PNG bytes; changed pixels use a real RGBA8 PNG encoder.
This is controller/boundary testing, not native canvas or codec integration.
Source checkpoint records exact excerpt lines, byte counts and hashes.

## Reuse in a separately authorized guest assignment

```js
const {createController} = require('./tools/enigma-presented-menu-controller.cjs');
// ask(command) performs bounded HTTP POST /ctl and returns {ok,value}; it
// throws on HTTP/JSON/read failure. Keep one exclusive control client.
const clickOnce = createController(ask, '/owned/fresh-preclick-menu.png');
const receipt = await clickOnce(); // only when frozen at inspected menu
// A later authorized step delivers the queued click; inspect its outcome.
```

The module never launches, steps or stops a guest. Future acceptance still must
deliver the input and inspect Start Game/level selection/gameplay using original
game/module evidence. The retained module SHA256 is
`8fac39936b6df2418ad86cab118cef19a65a727f649fbc14c412b37818904686`.
Historical static-unpack overlays remain diagnostic, not untouched-original
qualification. No box assigned here; coordinator retains lifecycle ownership.
`bx_xfbwmcty` was not contacted/resumed; user reports STOP requested19:07UTC.

Resource/startup/configuration/source/test receipts and incidents accompany this
report. Git DATA512MiB applies only to Git children; Node DATA/AS are unlimited,
heap192MiB is not a process RSS cap. No package was installed. The empty actual
mount argv was parsed with the exact pinned canonical parser (no mounted files,
including comma-bearing files). The shared root ref digest receipt was reused;
no full ref listing or main mutation was performed.
