# Original Mad Bomber after MIDI integration — 2026-10-20

Original Mad Bomber reaches its main menu, then the One Player playfield through
ordinary Enter input. Ordinary mouse movement changes the bucket position.
SDL_mixer initialization now succeeds. No new API blocker was observed in this
bounded validation. Bomb drops, catching/scoring, sustained gameplay, audio and
browser execution and FPS remain unqualified.

## Identities and closure

Production candidate: `14792a36a6cf1aa21f17f64615d5932d07e8d94f`.
Integrated main: `bcb203c47680ed5733ad1f4b5b6a042e48e711eb`.
Actual remote checkout: `6b96535d00442d4581b65d54e04abc31ae65febe`
at `/home/user/midi-remote-only-qualified-20261020-1447/source`.
Module SHA-256:
`11aee57cb158ffd734534b97aef9c36e3152aec660c8371d609a771e4eee9a5f`.
The existing module was reused; no build or native MIDI suite was repeated.

All 6,915 candidate Git blobs matched before and after execution. The native MIDI
qualification fixture was added after that candidate. The fixture's actual
hash is recorded in `input/postflight.json`. The candidate-to-integrated-main
delta consists only of three notes, a COM test and that MIDI fixture; production
source is identical. Source manifest lists the exact blob identities.

Independent review corrected the preflight summary's 6,914 count: its script
subtracted one for the fixture exception, but that path is absent from the
candidate tree and all 6,915 manifest rows were checked. Original receipts are
preserved unchanged.

The complete prior closure matched: 140 original release files, original
support msvcrt.dll and 27 boot assets, 168 SHA-256 pins in `closure.json`.
No support file was missing or copied, and no replacement DLL was invented.

| File | SHA-256 |
| --- | --- |
| madbomber.exe | `72ad26d11ddabf72c668b69eda0c7c1daa634f5cade631303ba4e05eb5f5cc09` |
| SDL.dll | `55eced17cf8a9b7acc671cc307503de847a3c36fdafafe14cee7917433cfe410` |
| SDL_mixer.dll | `e48583f82cd4a503e6ed9097da51399b05e4c5b92e66566e3b180321c6647165` |
| msvcrt.dll | `887eb5ce93edb7192ca3e9220f07f9ca0f94db02af5862ebcbdfcb852db99fd1` |

## Execution and reviewed images

Runtime `bx_6czhvg6m`, Linux x64, Node 24.18.1 / V8
13.6.233.17-node.50. CLI headless renderer, cooperative scheduling
(`--no-threads`), real ticks/calendar, 640×480. Exact argument vectors and
timestamps are in the two launch receipts.

Two distinct bounded 10-second processes were used in this one validation:

1. Startup probe, ending 15:22:50 UTC: exit 0, 735,785 log bytes.
   `final.png` visibly shows the Mad Bomber title and One Player menu.
2. Input follow-through, ending 15:23:58 UTC: exit 0, 403,288 log bytes.
   Enter down/up at 3/3.15 seconds opens the playfield. Mouse movement at
   5/7 seconds to (180,400)/(460,400) enters the ordinary renderer input path.
   `input/sample-5s.png` and `input/sample-9s.png` were visually inspected:
   brick playfield, bomber, score 0 and three buckets; buckets move from the
   left edge to the right-hand input position. The 5-second capture precedes
   its mouse command, as recorded in the log. No bomb/scoring claim follows.

Both processes end through the CLI wall-clock bound, without guard termination;
both process groups are absent. There was no speculative production fix.
The startup probe expired before input, hence the separately recorded
follow-through rather than an assertion of unperformed input.

SDL.dll DllMain at `0x00b5a130` and SDL_mixer.dll DllMain at `0x00a21b60`
return 1. GetProcAddress #707 resolves `midiStreamStop` to `0x07504ca0`
(caller return `0x00a21cb9`), where the prior run resolved zero and rejected
SDL_mixer attachment. Asset/music reads and the playfield follow. This is
startup/input progression, not acoustic evidence.

## Evidence and recovery

Self-contained observations and identity manifests:
`scratch/runs/20261020-madbomber-after-midi-original/`.
`launch.json`, `terminal.json`, `output.log`, menu PNGs and the corresponding
`input/` files distinguish the two processes. Controllers and API command
receipts, source/closure manifests, postflight, recovery hashes, final
SHA256SUMS and result metadata are retained. The input controller initially
wrote its metadata into the remote parent directory; those latest records were
recovered into local `input/`. The already recovered first-run metadata remains
unchanged locally. This transport detail does not alter either execution.

Heavy source/assets/module remain remote and are not duplicated locally.
For recovery after the runtime TTL, reconstruct the exact candidate from Git,
apply the fixture-only revision if needed, and use the canonical build recipe
and engine/dependency pins from the existing MIDI qualification evidence.
Original assets and boot support recovery is retained in
`20261020-madbomber-native-qualification/original-assets.tar.gz`,
`original-closure-required.json`, `prepare-original.py`, and its recovered
closure manifest. Compare all pins before reuse; a rebuilt module must match
the recorded identity before calling it this tested module.

Fresh remote main before report publication was
`c918629780ca97b871886e417fc46a800ab3203b`; its only change after the tested
integration is `docs/gl-d3d-corpus-status.md`. This report is based on that main,
with no main merge. Runtime lease released 15:25:02 UTC, sandbox left running
for the separate asset owner. No shared HEAD/index/config, laptop ownership,
automated-review hold, public deployment or other worker was changed.
