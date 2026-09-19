# Caesar III demo

## Payload

The playable payload is produced by the original Sierra/Impressions demo
installer chain documented in `sources.md`:

```text
caesar3.exe (ZipMagic wrapper)
  -> setup.exe (Win16 bootstrap)
  -> _ins5176._mp (InstallShield engine)
  -> installed/c3.exe + SMACKW32.DLL + 112 data/audio files
```

The launcher mounts that installed tree through the `caesar3_demo` manifest.
It does not substitute files extracted outside the installer workflow.

## Name entry

The demo copies `The new governor` into its 32-byte player-name buffer at
`0x57eb3c`. Its capture initializer at `0x49f7b7` computes length 16 but leaves
the capture cursor at zero with overwrite mode enabled. The first five typed
characters therefore produced `Codexew governor`.

`lib/app-profiles.js` verifies the original instruction bytes at `0x41607d`
before replacing only that default-name copy with a bounded 32-byte clear. The
patch applies to the loaded image, not the installer-produced file on disk. A
different `c3.exe` is rejected by the expected-byte check.

## Gameplay gate

`test/test-caesar3-gameplay.js` launches one headless CLI process with frozen
stdio control and the CLI's own `--max-seconds=90` bound. It drives:

```text
title -> Start new game -> type Codex -> Continue
      -> Assignment 1 briefing -> To the city -> live city
```

Mouse presses retain separate down/up execution slices because Caesar samples
button state from its frame loop. The test asserts that the live name buffer is
exactly `Codex`, captures the name screen, then verifies the final 800x600 city
by its terrain/control-panel regions. Set `CAESAR3_NAME_SCREENSHOT` and
`CAESAR3_SCREENSHOT` to retain both PNGs.

## Hot loops (handler-hist, 2026-09-19)

`node test/run.js --app=caesar3_demo --no-build --quiet-api --max-batches=900
--batch-size=100000 --handler-hist --handler-hist-thread=0,0,0
--handler-hist-start=300 --handler-hist-stop=900 --hist-json=F --no-close`
writes three windows; `tools/loop-class-share.js F --exe=...c3.exe` attributes
each hot block to the loop containing it.

| VA | window 300-500 | window 500-700 | what it is |
|---|---|---|---|
| `exe+0x49e9ca` | **27.96%** | not in top | indexed byte `memcpy`, `i` spilled to `[ebp-0x4]`, bound `[ebp+0x10]`, src `[ebp+0x8]`, dst `[ebp+0xc]` |
| `exe+0x417204` | 7.86% | **45.98%** | per-frame logic, no load/store/advance shape |
| `exe+0x4a3ebc` | 29.56% | — | |
| `exe+0x40f407` | 6.15% | — | inside the `0x40f6d9` RLE sprite ladder already folded by `RLE_RUN` H424 |

**The two windows disagree strongly about where the time goes**, so quote a VA
with its window or not at all. Both windows are dominated by loops the current
self-loop matcher cannot see (~59% and ~88% of block entries) — see §22 of
[loop-idiom-superops-design.md](../loop-idiom-superops-design.md). Windows at
batches 500 and 700 came back byte-identical, which is the determinism holding,
not a sampling error.
