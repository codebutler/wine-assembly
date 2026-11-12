# AoW2 ordinary-scene software compositor qualification

Assignment `AOW2-RENDERING-COVERAGE-20261009` succeeds narrowly: **220 selected
game-layer compositor submissions / 25.131145 seconds = 8.754077858 submissions/s**.
The scene is the initial Inioch's Legacy tower, stationary after dismissing
Julia's introductory panel. The world, tower animation, terrain and lower UI
are visible in the directly reviewed before/after captures. Army movement was
already qualified historically and was not repeated here.

This is neither logical game FPS nor monitor refresh. No presents-per-frame
conversion is applied. Repeated pixel content is not compared; distinct layer
uploads that reach the visible compositor sink are counted. No audio, Windows,
full-game, other scene, other backend, current-main or release qualification.

## Exact tested closure

Tested historical source: `c26252c4a95babe583ade1d1c6e2da0c050be45c`.
Shipping module: `f644bbb26edc077239dac17b8b2cfda482aafd9eb44af4c4776d4fe153d5a1a7`,
1,878,971 bytes. The preserved canonical archive is SHA-256
`3e308c0012e996070a01c1f77d6f399e9aaf7adb2d2620b27af018a80d29e248` at the
mm-timer-qualified-integrate-oct22 checkout. Its accepted source/module closure
and historical c262 equivalence were inventoried in predecessor commit
`6573b18f8d8024ff5903da0deca02eaf5a50c7d6`; `module-inventory.json` preserves that
receipt. This task reused it, with fresh byte verification of all 154 served
runtime/module pins. No build or engine changes occurred. Task base is main
`efa26a12b0f1284b8558189d14c0e9c2213d5e11`; it is not the tested engine.

All 1,064 original extracted fixture/manifest files and all 29 font files
(including five stock FONs, scalable substitutions and UI fonts) were freshly
hashed offline against the predecessor's validated inventories. The manifest
contains 1,059 lazy companions; the EXE and three registered BPLs are separate.
Original EXE SHA-256 is
`a10590e5dbd013d154b00ea53e66670f4e74d38ab33adb2523f0a662af8f89f7`, 5,748,736 bytes.
The original extracted tree was streamed directly through Boat exec; no local
asset archive, download, alternate game fixture, installer run or cold restore.
`stdole2.tlb` is staged. Before browser launch, all **1,253** source/module,
fixture, support and driver pins passed remote byte verification. The same
pins and **4,434** runner dependency files passed again after browser shutdown.
Transfer archives and receipts are hashed. API table and renderer/browser
source belong to the matching historical closure.

Puppeteer was absent on the assigned box. Installing `puppeteer@24.16.0` with
scripts/browser download disabled initially let npm walk from an empty
`runtime/` directory to the served root package. The prelaunch byte gate caught
changes to package.json/package-lock.json. The one concrete staging correction
moved runner dependencies into runtime/ and restored both served files exactly.
The failed receipt and corrected passing receipt are retained. No guest had
launched, no enforced denial was bypassed, and no engine repair was performed.
There was **one browser/game run**, with no navigation restart or second launch.

## Unknown imports and runtime diagnostic

The coordinator explicitly superseded the predecessor's complete-import
prerequisite. `prior-source-gate.json` is the historical failed static gate,
not this task's result. `dependency-audit.json` retains the original full
inventory, including unexercised designer/database packages.

VCL50 and Ml42ND50 each statically import `GetOverlappedResult` and
`ActivateKeyboardLayout`; neither has an established handler/native fallback
in this closure. `loader-semantics.json` records the existing source behavior:
named imports retain their name RVA and lookup result; an out-of-range ID
reaches `handle_fallback`, emits host crash context and executes `unreachable`.
The imports alone therefore do not establish a startup failure.

The ordinary route completed without any unimplemented-API diagnostic or
page exception. Neither of those two names appears in the retained runtime
console; they remain unexercised imports, not newly implemented APIs. There is
no blanket API-call trace and no claim of complete API compatibility.

Authentic native `oleaut32`, `ole32`, `comctl32`, and `shell32` are not staged.
The loader's optional-native fallback warnings and browser 404 diagnostics are
retained. Built-in handler resolution is distinct from supplying those native
DLLs. The console also contains a missing manifest icon warning and two Miles
thread EIP-zero exits, one with a `slice failed: worker 2 stopped` message;
these did not prevent the observed world or measurement. Their broader
semantics/audio impact are not qualified. The original package's developer
`aow2Log.txt` is never treated as evidence from this run.

## Ordinary route and measurement attribution

Registered URL: `?app=age_of_wonders2_demo&debug&threads&d3d-renderer=software`.
Chrome `151.0.7922.108`, Node `v24.18.1`, guest memory 512 MiB, main guest and
guest threads in Workers, GPU flag false, software legacy renderer endpoint.
Normal trusted pointer down/up routed Scenario → Single → Start, then dismissed
Julia's panel. `raw/run/commands.json`, scene state captures and console preserve
the actual inputs. Historical coordinates were checked against current images.
No guest-memory/EIP/API patches or synthetic guest state were used.

`tools/aow2-gameplay-browser.js` adapts the prior ordinary-input driver.
`tools/aow2-worker-measure.js` attaches to the same running browser and measures
the browser renderer, without treating a host CPU shadow as an emitting guest.
It reuses the unchanged accepted compositor observer and raw validator. This
task supplies the AoW2-specific attribution and scene evidence; Arcanum's
qualification is not transferred to AoW2.

Unique app/renderer owner: HWND **65538**, visible, not minimized; overlay
**1024×768 OffscreenCanvas**, integer write sequence. Actual copy seams include
CanvasRenderingContext2D and OffscreenCanvasRenderingContext2D. Positive events
show selected-layer copies reaching a completed visible `filter.present` into
`screen-present`, document visible, opacity 1. The independent attachment's
default Puppeteer viewport resized the page from the routing viewport 1200×900
to **800×600 before the gate**. This is the measured browser geometry: sink rect
`(10,226,460,336)`, letterboxed source draw into `(6,0,448,336)`. The guest layer
remained 1024×768. No claim is made for the larger routing viewport's rate.

The five-second gate passed first: **45 events / 5.026475 seconds**, seven raw
samples, no observer errors. The full interval then produced **220 events**,
27 samples, no observer errors. Raw performance timestamps are
`240590.64500000002` → `265721.79000000004` ms; count 0 → 220. All samples have
valid owner/geometry and a visible sink. All events have increasing selected
write sequences and occur inside the interval. The gate end precedes the full
start. Independent Python arithmetic and the JS validator reproduce the rate.

Observer contracts exercise wrong/changed owner, hidden sinks, no-op presents,
raw calls without copies, repeated/overwritten uploads, invalid geometry,
throws and wrapper restoration. The raw-validator suite passes its positive
case and all 11 rejection controls. Both drivers pass syntax checks. Runtime
source/module bytes were unmodified throughout. The historical viewport
clipping and cooperative-vblank fixes were not reimplemented or reviewed.

## Evidence, recovery and handoff

`evidence.tar.gz`: 6,305,282 bytes, SHA-256
`ff023d5ccfefed47b06c177250429b7487e265c1425453d4814c5ee4be396a67`.
It contains the complete run, raw console, screenshots, samples, commands,
browser/flags/CPU identity, source pins, runner lockfile/pins and cleanup.
`raw/` exposes every archive file; `verify.py` checks archive equality, seals,
raw timing/counts and both rejection suites. `captures/` retains routing review
images. Reviewed measurement images are `raw/run/worker-full-before.png` and
`raw/run/worker-full-after.png`; the gate-before capture was also directly read.
`runtime-diagnostics.json` retains the warnings and unsupported-fault search.

Run `python3 scratch/runs/20261022-aow2-import-reachability-measure/verify.py`
from this task checkout. Recover the runtime by verifying the pinned historical
source/module from the named local donor, the original existing fixture and
font manifests, and the retained remote runner. No recipe authorizes another
browser or box lifecycle action. Remote task source/assets remain at
`/home/user/aow2-software`; the local original fixture remains in place.

Browser wall interval: 2026-10-22 03:50:26.032 → 03:55:12.215 UTC,
**286.183 seconds**, below the immutable 1,200-second guard. Chrome exited 0;
browser/server driver exited 0. PIDs 34620 and 34628 are absent, no Chrome uses
the owned profile, the observer process completed, and the owned server closed.
Postrun source and dependency verification passed; remote free space is
48,497,971,200 bytes. No public hosting/deploy or other boxes were used.

Assigned box **bx_y5a3vk8g remains RUNNING**, API state idle/health ok.
Expiry **2026-10-22T05:33:29.742Z**; coordinator owns the **05:23 UTC** shutdown
checkpoint. Handoff precedes 05:13 UTC. No stop/delete/resume action was taken.
Local checkout/new objects/evidence stay within 64 MiB and the mandatory
2,982,150,144-byte free-space floor. No main merge, protected root edits,
delegation, additional worker, replacement task or refill. Task ends here.
