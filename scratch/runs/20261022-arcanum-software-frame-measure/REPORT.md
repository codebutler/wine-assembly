# Arcanum software crash-site presentation measurement

**Qualified: 691 selected-layer compositor submissions / 25.40109 seconds =
27.203557 submissions/s**, in the original demo's ordinary free-roam crash-site
scene. This closes the corrected software observer gap on the explicitly tested
historical accepted source below. It does not qualify current main's engine.

This is an instrumented visible compositor submission rate, not logical game
frames, unique pixel frames, physical display refresh, Windows parity, audio
quality or full-game completion. No presents/4 conversion was used. The historical
four-BltFast-per-EndScene ratio was scene-specific and is not a conversion for
this compositor metric.

## Exact identity

- Task base: `849e57e73d44c6d160f5db06367481547444c203`.
- **Tested source:** `c26252c4a95babe583ade1d1c6e2da0c050be45c`.
- Canonical build source: `ce4ce4f95eacaedff1b3e386f3ce3ae5d85bd16c`.
  `src`, `lib`, `tools`, `host.js`, `index.html`, and lockfile identities match
  between those revisions (`module-inventory.json`). No compilation was run.
- Actual browser-served shipping Wasm:
  `f644bbb26edc077239dac17b8b2cfda482aafd9eb44af4c4776d4fe153d5a1a7`,
  1,878,971 bytes. Recovered from the accepted canonical qualification archive
  `3e308c0012e996070a01c1f77d6f399e9aaf7adb2d2620b27af018a80d29e248`.
  Newer source was never paired with that older module.
- Original installed fixture: all **36 installed files plus browser manifest**,
  268,229,946 bytes; complete manifest set equality and individual SHA-256 pins
  in `assets.json`. Original Bink/Miles DLL exports and all 362 named startup
  imports checked in `dependency-audit.json` and retained objdump output.
  OLE32/SHELL32 warnings use existing named API handlers; no native CRT is
  imported by this registered startup closure. No media download or restoration.
- Headed Chrome **151.0.7922.108**, Node **v24.18.1**, Puppeteer **25.7.0**,
  Linux Ryzen 9 9950X. Software D3D / Canvas2D, GPU flag false, cooperative,
  no guest Worker, fixed 536,870,912-byte memory. Browser viewport 900×720;
  selected game 800×600 copied to 560×420 inside the 560×488 visible sink.
  Browser flags include `--no-sandbox` and `--enable-unsafe-swiftshader`; complete
  actual Chrome arguments/CPU identity are in `raw/run/identity.json`.
  Chrome's underlying GPU-compositor device was not separately queried;
  the game backend is verified software, not a claim of hardware GPU performance.
- Final pre/post checks: **226 file pins and 2,253 runner dependency pins**.
  `src/api_table.json`, shipping exports, stock/scalable fonts, and authentic
  native dependencies are included. Runner installation skipped scripts/browser
  download. Source and asset archives streamed directly through Boat exec;
  no local corpus copy or oversized local archive.

## Route and observer evidence

Ordinary registered software URL → Single Player → New Game → Pick Character
→ Next → Escape through the quest movie → Continue → three gnome responses
→ free roam. The response “Rest in peace, my gnomish friend” closed dialogue.
The later nearby NPC speech cleared before measurement. No guest memory, saved
state, EIP or API result was forced. This task did not repeat a movement
qualification; before/after images establish the measured scene.

Pointer capture initially produced a large trusted movement jump. The route
corrected it using ordinary relative motion and reviewed cursor screenshots.
All commands and trusted events are retained. Large-motion recenter events can
end with zero delta; this was not treated as successful targeting without a
visible cursor check. Small relative steps reached the actual menu controls.

The existing corrected observer was unchanged. Its two actual context
prototypes were `CanvasRenderingContext2D` and
`OffscreenCanvasRenderingContext2D`; selected owner was the sole Arcanum instance,
visible `arcanum.exe` HWND **65537**, DirectDraw overlay **OffscreenCanvas**.
The selected renderer belonged to exactly one running app.

Before the full interval, a **5.124655-second gate** emitted **120** attributable
events with seven valid samples and zero errors. The driver saved owner/layer
attribution and rejected invalid samples before enabling the full measurement.

Full raw interval (`software-measurement-samples.json`):

| Item | Start | End |
|---|---:|---:|
| Browser `performance.now()` ms | 757238.9450000001 | 782640.0349999999 |
| Accepted compositor count | 0 | 691 |
| Selected layer write sequence | 30983 | 32624 |

All **27 samples** are valid with visible `screen-present` sink. All **691
events** record a successful selected-layer copy chain followed by completed
plain-nearest filter presentation, no CRT effects or dedither. Each records
copy/submission timestamps, write sequence, draw arguments and sink geometry.
Observer errors and browser page errors are empty. Uploaded writes that never
reach the sink, repeats, hidden copies, no-op presents, raw Flip calls and RAF
are excluded. The 1,641 write-sequence advance is deliberately not the count.

Both measurement images were directly inspected: crash wreck/fire, corpse,
standing characters and normal HUD, no dialogue or menu. The two software runs
do not constitute a software/WebGL performance comparison: the historical
WebGL measurement used different source and timing.

## One configuration retest and validation

The first browser attempt **did not execute the guest**: staging omitted five
mandatory stock FON files. The launch UI reported the exact 404s. Initial
preflight was insufficient to check this browser-only dependency; that error
and the first run are preserved, not presented as an engine regression.
The one allowed configuration retest added the five existing generated fonts,
accepted-revision scalable font subsets and UI font, then checked 226 pins
before launch. No source repair, build, third launch or instrumentation retest.

First browser: 02:53:52.424–02:54:38.878 UTC, 46.454 s, Chrome exit 0.
Retest: 02:55:31.065–03:09:07.649 UTC, 816.584 s, Chrome/driver exit 0,
before its immutable 03:15:31.065 deadline. Both use the same assigned box.

Tests: accepted presentation-counter contracts (including OffscreenCanvas,
hidden/no-op/wrong-copy/repeat/overwrite/exception/replacement/restoration),
new raw-sample positive case and **11 rejection controls**, driver syntax,
remote export/dependency checks, archive seals and raw-sample replay. No
production code changed. Optional icon/build-info/favicon 404s, any autoplay
warnings and the two emulated-library discovery warnings remain in raw logs.

## Evidence and runtime handoff

`evidence.tar.gz`: **9,243,446 bytes**, SHA-256
`7bcc5c85dc733fb4c085e5fb45bc311fd75d567a2f620b07851d63282659bdd1`.
Contains both complete browser sessions, all raw screenshots/commands/logs,
identities, preflight/dependency manifests, cleanup, package lock and handoff.
Main-host retrieval verified the archive hash; `raw/` exposes its text evidence,
and `captures/` preserves reviewed route and measurement images. `seals.json`
seals the main-host artifacts. Original game binaries are not committed.

**Leave `bx_4sszn2zj` RUNNING.** Coordinator owns snapshot-stop, with checkpoint
04:34 UTC and expiry **2026-10-22T04:44:42.620Z**. At 03:09:55 UTC the box was
exec-healthy, 48,179,146,752 bytes free, all four driver/Chrome PIDs absent and
the task HTTP server closed. `/home/user/arcanum-software` retains matching
source, module, assets, dependencies, both sessions and `HANDOFF.txt`.
No lifecycle action, new box, public hosting, deployment, main merge, workers,
delegation or queue refill. Ownership returns to the coordinator; task stops.
