# Tony Hawk's Pro Skater 2 demo

Saved Telegram request #55 asks for the demo/shareware version. The pinned
Windows demo is `Files/Demo/thps2.exe` from
[Archive](https://archive.org/details/pro-skater-2): 28,785,118 bytes,
SHA-1 `8fbb8860ce20ca5c7c94a1ec93bd04738afc6699`.
This is a local compatibility fixture; no redistribution grant is recorded.

## Original installer

This is a Wise self-extracting installer, not a directly playable executable.
Local 7-Zip/unar extraction failed. Run the installer in the emulator and export
its VFS instead. On build `001a3ad70`, WASM SHA-256
`61823d147dfe6ceb3e5820bac14917a7891d5a6df519d886fa0c0d4d14b982d7`,
the following replay reaches file copying:

```sh
node test/run.js --exe=scratch/preserve-wip-20261012/thps2.exe \
  --threads --max-batches=1000000 --max-seconds=300 \
  --quiet-api --quiet-blocks \
  --input=7000:click:368:383,16000:click:291:317,18000:click:368:383,20000:click:368:383,22000:click:368:383,24000:click:368:383,26000:click:368:383 \
  --png=scratch/runs/20261013-thps2-installer/full-install.png \
  --save-vfs=scratch/runs/20261013-thps2-installer/full-vfs \
  --reg-export=scratch/runs/20261013-thps2-installer/full-registry.json
```

The pages are Welcome, License Agreement (select I Agree), Minimum System
Requirements, Destination, Program Manager Group, and Start Installation.
Default destination is `C:\Program Files\Activision\THPS2`. The installed game
executable is `thawk2.exe`; payloads include `binkw32.dll`, `ltix30.dat`, and
`Demo.pkr`. Do not use a partial `~glh*.tmp` archive as the installed PKR.

Evidence is in `scratch/runs/20261013-thps2-installer/`. The screenshots
`next-later.png`, `path.png`, `destination.png`, `install.png`,
`install-confirm.png`, and `extracted.png` were visually reviewed. The last is
only a copying-progress screen: the 45-second limit stopped that attempt before
installation completed. These screenshots do not establish game playability.

The extended run completed in 112.345 seconds / 154513 batches and displayed
“Installation Complete” (`full-install.png`, visually reviewed). The installed
`demo.pkr` is 34,272,358 bytes. All eight installed files have pinned SHA-256
hashes in `tools/install-thps2-demo.js`; a second fresh installation reproduced
them in `scratch/runs/thps2-install-pfgm44/`. No executable patches or registry
overrides are needed to launch the game.

## Reproduce and launch

```sh
node tools/fetch-candidate-corpus.js --id=thps2-demo
# For an already downloaded installer/fixture:
node tools/fetch-candidate-corpus.js --id=thps2-demo --prepare
```

The helper runs the original installer, checks its completion text and every
payload hash, then publishes `test/binaries/candidates/thps2-demo/game/`.
It preserves installer logs, screenshots and VFS exports under `scratch/runs/`.
An existing output tree is reused only if its payload hashes match; differing
files are preserved and cause an error. The fetcher creates the browser manifest.

Local browser route: `/?debug&app=thps2_demo`. The game and its bundled Bink DLL
are registered in `lib/apps.js` as a local candidate, not a public release app.

## Reviewed gameplay, 2026-10-13

`scratch/runs/20261013-thps2-gameplay/` contains the registered Chrome/WebGL
launch at 1000x750, using the cooperative fallback (the local server was not
cross-origin isolated). After 20 seconds, hold Enter for 400 ms at each of four
steps, waiting eight seconds between steps and twenty after the fourth. The
route is Main Menu → Single Session → Tony Hawk → Marseille → loading/Play.
Hold Up+Space for 1.8 seconds, release, wait 2.5 seconds, then hold Left for
1.8 seconds and wait 2.5 seconds. `jump.png` shows the active skating session
at 1:58; `turn.png` shows a changed skater/camera position beside the fence at
1:53. Space also dismisses Play, so this run does not separately prove an ollie.

The menu, skater, level, and active 3D skating screenshots were visually reviewed.
The browser reports a WebGL error-limit warning despite visible rendering;
retain it in `errors.json` rather than claiming a clean console. No runtime trap
was observed. Audio, physical mobile controls, Safari, scoring and a full
two-minute session remain unqualified.

Validation: fresh installer replay and all eight payload hashes pass; fetcher
`--prepare` and `test/test-debug-dropdown-manifests.js` pass. The broader
`test/test-cli-candidate-corpus.js --id=thps2-demo --dry-run` stops on an existing
Baldur's Gate source-pin assertion before testing THPS2 (it expects the old ISO,
while committed main already uses the Silver Edition ZIP). This is unrelated
to the new candidate. The direct CLI launch independently reaches the main menu.
