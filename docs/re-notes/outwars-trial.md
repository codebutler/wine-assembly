# Outwars — trial (`outwars_trial`)

SingleTrac / Microsoft, 1998, Direct3D (DirectX 5), Watcom-compiled (register
calling convention). Candidate `outwars-trial` (archive.org `Outwars_1020`,
`owtrial.zip` → `owtrial.exe`, a WinZip self-extractor that 7z unpacks into
`installed/`: `owtrial.exe`, `owres.dll` (resource strings), `QMIXER.DLL`
(QSound mixer), data folders). Reaches in-mission gameplay with movement.
Evidence: `scratch/runs/20261011T0605Z-outwars-w6`.

## Running it

```sh
DISPLAY=:0 node test/run.js --app=outwars_trial --no-build --quiet-api --quiet-blocks \
  --no-close --stuck-after=0 --headless-gl --max-batches=71000 --input=...
```

`QMIXER.DLL` must load as the real DLL (the registry seeds it; with a bare
`--exe` pass `--dll-seed=.../QMIXER.DLL`), otherwise its exports fall to WAT
stubs and the game dies on `QSWaveMixInitEx`. Default clock (200 ms/batch).

| batch | input | screen |
|---|---|---|
| ~4045 | — | (before dc7e8454d: "Outwars Audio Compression Error: ACM is not installed", Enter dismissed it; gone now) |
| ~4700 | — | "Outwars CD Audio Error: Another program has the CDAUDIO device locked" (MB_RETRYCANCEL) |
| 4800 | **Escape** (Cancel = play without music; Enter = Retry loops) | |
| ~9000 | — | TRIAL VERSION title |
| ~20000 | — | main menu (Solo Campaign / Single Mission / Group Maneuvers / Options / Exit) |
| 20500 | click (113,228) SINGLE MISSION | mission list (ia01, anub02) |
| 27000 | Enter | briefing "Single Mission - Exercise 1" |
| 37000 | click (95,291) CONTINUE | loadout (Weapons … Launch, Briefing) |
| 45000 | click (113,364) LAUNCH | mission loads |
| ~56000 | — | in mission: marine on a platform, HUD |
| hold Up (VK 38) | — | marine moves to the platform edge; radar changes |

## Identified code (owtrial.exe, image base 0x400000)

- 0x4d89ea: top-level init → 0x48b500 (game run) → 0x48d704 → 0x4cdecc (cleanup)
  → window-rect save → shutdown.
- 0x48b55a: `0x4ed84c` graphics init; non-zero → exit path 0x48ba4e.
- 0x4ed84c: DirectDrawEnumerateA(callback 0x4f219c); fails with 0x887600de if
  no driver was accepted (flag 0x136402c).
- 0x4f219c enumeration callback: DirectDrawCreate(guid) → QI IID_IDirectDraw2 →
  `IDirectDraw::Release`, and **continues only if that Release returns 0**
  (0x4f2219); then GetCaps on IDirectDraw2. Needed per-interface DirectDraw
  reference counts (36dfe2bb3); before that the game silently exited after
  creating its window.
- 0x5017xx: generic error reporter; message text from owres.dll string table,
  table of {caption, text, flags} at 0x52e0b0.

## Audio

QMIXER loads `msacm32` and resolves acmFormatSuggest/acmStream*. Since
dc7e8454d the ACM has the MS-ADPCM and IMA ADPCM codecs of a stock Win98
(decode to 16-bit PCM in WAT), so `acmFormatSuggest(ADPCM → PCM)` and
`acmStreamOpen` succeed and the "ACM is not installed" box is gone. Measured
2026-10-11 (boat, main 8373af6cd, route to the main menu): 2 streams, 18
`acmStreamConvert`, 3 `IDirectSoundBuffer_Play` and ~20k `Lock` (QMixer
streams into DirectSound; `--audio-out` records waveOut only, so it stays
empty). The first converted block (512-byte mono MS-ADPCM -> 2024 bytes) is
real signal: min -32172, max 32356, RMS 21388. Evidence
`scratch/runs/20261011T0740Z-outwars-acm-adpcm-w4`. The CD-audio box comes from
`mciSendCommandA(MCI_OPEN, type cdaudio)` failing; Cancel continues.
