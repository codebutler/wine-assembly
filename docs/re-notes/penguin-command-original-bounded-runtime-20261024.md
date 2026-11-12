# Penguin Command 1.6.11 original runtime prerequisite blocker — 2026-10-24

Historical source last updated, 2026-10-24. Runtime and implementation claims below describe that dated source; see current app notes and source for subsequent changes.

**BLOCKED before guest execution: required `pngjs` is unavailable.** The executed
Node resolution probes returned `MODULE_NOT_FOUND` on assigned box `bx_8rahkrrz`
and in the checked existing local package locations. The historical matching
runner's `lib/raster-canvas.js` directly imports `pngjs`; `canvas-compat.js`
directly loads that renderer. Without this codec, the harness cannot provide
the requested screenshots and pointer input. No package installation, download,
replacement renderer or guessed stub was attempted. No guest failure or gameplay
qualification follows from this host prerequisite failure.

Evidence is adjacent in `penguin-command-original-bounded-runtime-20261024/`:
`local-codec-probe.json`, `remote-codec-probe.json`, `codec-pin.json`, exact
runner/renderer identities, `remote-resource-probe.json`, `box-state.json`,
`execution-terminal.json`, and the measured resource manifest `admission.json`. The API response transcription is explicitly identified; original tool history
is retained in worker session
`/home/user/.codex/sessions/2026/10/24/rollout-2026-10-24T01-48-13-01a16b98-1d38-76b3-97e9-21872f68ace1.jsonl`.

## Exact inputs and scope

The existing accepted original closure `98257ee06ff0e68900025f20ab1453379e34b6ed`
is reused. No acquisition, extraction or repeated PE/dependency acceptance occurred. Original executable: 107008 bytes, SHA256
`14d6e430c26c44c94ef5c176eca2f66edd82dd66fd155d29a5596e3d6e170fc1`. Retained directory:
`/home/user/wine-assembly-penguin-command-retained-closure-oct23/docs/re-notes/penguin-command-retained-closure-20261023/original/penguin-command-1.6.11`. The 32768-byte wrapper was neither selected nor executed. Standing CRT:
`/home/user/wine-assembly/test/binaries/dlls/msvcrt.dll`, 278581 bytes, SHA256
`887eb5ce93edb7192ca3e9220f07f9ca0f94db02af5862ebcbdfcb852db99fd1`. All six bundled DLLs and all 83 PNG/JPG graphics have exact retained paths,
byte lengths and SHA256 values in the manifest. Optional sound files were not staged.

## Recovery and lifecycle handback

`launch-original.sh` preserves the accepted launch recipe;
it refuses execution without explicit qualified-module, harness and empty evidence
paths. It is a recovery recipe, not executed guest argv or permission to retry. Retained binary recovery stays in the original accepted closure report; original
archive/extracted bytes remain ignored and local, not in this commit.
