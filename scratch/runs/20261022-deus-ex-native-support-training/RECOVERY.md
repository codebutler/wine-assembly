# Recover this bounded runtime evidence

Read `REPORT.md`, `necessary-closure.json`, `prior-source-mapping.json`,
`prior-assets.json`, `prior-source-manifest.json` and `prior-module.json` first.
All paths/hashes refer to accepted source c26252c4, the original registered
demo, and shipping module f644bbb2. No compilation is needed.

The same running assigned box retains `/home/user/deus-ex-training`, including
the full previously staged game, accepted runner, qualified Wasm, and the one
new native support file `test/binaries/dlls/msvcrt.dll`. Do not repackage the
game or load the optional Explorer shell dependency chain. Three generic
warnings are expected: their complete game imports use the existing accepted
WAT handlers, as documented in `existing-emulated-handlers.json`.

For a separately authorized replay, use `verify-remote-readonly.py` through
Boat exec to verify all 192 source/support files, 112 assets and module. Check
the staged MSVCRT against the pin in `necessary-closure.json`. `audit.py` and
`graph.js` reconstruct host-side checks using accepted source and existing
read-only local assets. `stage-native.py` shows the five-chunk, hash-checked
transfer; do not rerun it unnecessarily when the remote hash already matches.
The provenance document is a receipt, not an instruction to download anything.

`launch.sh` is the exact historical normal command. Its evidence directory was
`native-support-evidence`; select a fresh directory before any authorized replay
so these original artifacts are preserved. Drive `control.py` as recorded in
`input-log.jsonl`: step 3000, Escape, step 200, three Down holds (4 steps each,
4-step release gaps), Enter hold 4, release, step 600. Inspect Training before
holding Up 150, releasing, stepping 4, and capturing. The actual extra settled
interval was 400 steps, followed by a normal control quit. No retest was used.

`fetch.py` retrieves bounded raw files through Boat exec and verifies hashes.
`native-support-evidence.tar.gz` contains the original remote PNGs/logs/launch
script/timestamps/exit/closeout. Its hash is in REPORT.md and seals.json.
No ignored game or system binaries are embedded in the committed evidence.

The process is stopped; **the box is not**. Coordinator owns lifecycle and
shutdown. This recipe grants no new runtime or lifecycle authorization.
