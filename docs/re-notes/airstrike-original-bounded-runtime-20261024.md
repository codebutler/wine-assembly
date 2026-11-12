# Original Airstrike pre6a bounded runtime assignment — 2026-10-24

Historical source last updated, 2026-10-24. Runtime and implementation claims below describe that dated source; see current app notes and source for subsequent changes.

**BLOCKED before guest startup: the required pinned PNG codec is absent.**
At 01:52:20 UTC the assigned box's ordinary Node process returned exit 2,
`MODULE_NOT_FOUND`, `Cannot find module 'pngjs/package.json'`. The complete Boat
API terminal receipt is adjacent `codec-probe.raw.json`; exact execution argv is
`codec-command.json`. This is a prerequisite failure, not an Airstrike import,
opcode, asset, API or gameplay failure. No original EXE, wasm Module/Instance,
guest input, screenshot, native arena, browser or game watchdog was executed.

The original objective remains unqualified. No claim of original startup,
rendering, gameplay, current-main qualification, or a fatal path through any of
the five static API warnings follows. Downloads, package installs, guessed API
stubs, renderer substitutions and source builds were not used to cross this
blocker. The initial box probe also found no skia-canvas/canvas packages; the
shipping raster path specifically requires pngjs.

## Executed blocker and exact identities

The historical runner `test/run.js` unconditionally attempts the ordinary
`lib/canvas-compat` renderer load; that delegates to `lib/raster-canvas.js`,
whose line 20 requires `pngjs`. A missing module is caught as renderer load
failure by the runner, rather than supplying a working screenshot renderer. The historical lockfile pins pngjs **7.0.0**, integrity
`sha512-LKWqWJRhstyYo9pGvgor/ivk2w94eSjE3RGVuzLGlr3NmD8bf7RcYGze1mNdEHRP6TRP6rMuDHk5t44hnTRyow==`. The first API probe reported `pngjs MISSING`; the second, diagnostic-only probe
preserves the exact error code, message and Node search paths. Neither launches
the runner. The latter is the retained minimal executed trace, with
`launcherFailed:false`, `oomKilled:false`, `timedOut:false`, empty stderr, and
no truncation. Default Node package resolution failed; this does not establish
that no retained package exists anywhere on either host.

## Recovery and lifecycle handback

`inspect.py` is a read-only offline inventory/identity verifier. It does not
compile, instantiate, install, download or launch the game. `recovery.py` only
prints the prospective argv and required admission checkpoints; it cannot run
the command. The sparse historical donor is not directly runnable until its
manifest is materialized in an authorized new runtime destination. Binary
recovery uses the retained locations in the manifests; Git does not back up
those ignored bytes. Preserve the previously accepted original/zlib recovery
reports rather than repeating archive acquisition.

The prospective command uses explicit `--no-build --wasm`, the exact eight DLLs,
`--vfs-include=airstrikerc --vfs-include=data/**/*`, CWD `C:\`,
`--no-threads --memory-mb=512 --max-seconds=60 --max-batches=200000`. Original configuration remains windowed 800x600, alpha2, sound1, one human,
relative datapath `data`. There was no input schedule execution. Any future
assignment must observe startup before ordinary Enter/movement/fire and use
matched keyup with meaningfully separated before/during/after captures.
