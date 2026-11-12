# Airstrike sustained ordinary play — 2026-10-27

Historical source last updated, 2026-10-27. Runtime and implementation claims below describe that dated source; see current app notes and source for subsequent changes.

**Partial result: sustained play observed; complete acceptance not met.** One original Airstrike session ran115.011s inside the runner (115.596s including cleanup), without a trap. Escape / six Down presses / Enter did not establish normal Quit: the log explicitly ends with `[max-seconds] stopping after 115s`, with the guest still active. Exit0 is clean harness termination, not game-exit evidence. No second guest session, production repair, build or synthetic game state was attempted.

Three original800×600 desktop captures at approximately20/50/85s show separated active gameplay scenes. Ordinary acceleration, short Left/Right holds and later period/fire holds were acknowledged through the production stdin route. Earlier frames show blue-plane sprites, projectiles and combat effects. The late human plane is partly clipped at the right edge. The Console covers the upper-left scene despite an ordinary minimize click. The fourth, final PNG uses the runner's direct DX surface route (slot6), without Console overlay; it still depicts the game. **Complete unobscured late human-plane firing and normal Quit remain open.** All four original images were inspected with `view_image`; observations and exact hashes are in adjacent `screenshot-review.json` and `validation.json`. No audio or performance claim is made.

## Exact historical identity

Original config remained windowed800×600, alpha2, sound1, one human. All81 original EXE/config/data files, eight authentic providers, fonts and retained pngjs7 were preserved. `--vfs-tree=/home/user/airstrike-sustained-oct27/game`, guest CWD `C:\\`, was checked with the exact runner's `getArgs` parser and canonical `expandIncludePatterns`, enumerating all89 intended game/provider files. This game tree has no comma-bearing filenames; tree enumeration preserves names without splitting individual filenames.

## Actual execution and acceptance boundary

Full argv is in `guest-process.json`; all37 serial commands/acknowledgements are in `input-events.json`. Node `/home/user/.nvm/versions/node/v24.22.1/bin/node`, v24.22.1; oldspace512MiB; observing preload; `--no-build`; exact `--wasm`; `--no-threads`; fixed512MiB shared arena; `--max-seconds=115`; `--max-batches=1000000`; batch20000; tick5ms; `--control-stdin`; `--no-close`. No control-channel quit or automatic WM_CLOSE is represented as normal Quit.

Ordinary Enter down/up at5s; minimize/game clicks7/8s; acceleration9–89s; short turns10/30/65s; fire12–25/38–55/72–89s; captures20/50/85s; releases89s; Escape91s; six Down pairs92–94.12s; Enter95s. Every command received a successful acknowledgement. Delivery does not establish the intended menu selection. Console/window focus is an investigation lead, not an established root cause.

The exact Node startup check used identical executable, heap/preload flags, explicit PATH/HOME/LANG/TZ and child limits. CPU140s, per-file4MiB; DATA and address-space unlimited. The observing preload verified291 imports, region stamp `9a3bc9149d58209c`, and the shared512MiB arena, recording successful instantiation before guest execution. It changed no guest memory, provider or emulator behavior.
