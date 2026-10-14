# Descent: FreeSpace - The Great War (demo)

Volition / Interplay, 1998. Four-mission demo (training + campaign start).
Registered as `freespace_demo`.

## Fixture and install (headless)

- Source: `test/binaries/win98-games-a-d/Descent-Freespace-sdemo10-SW-Glide.exe`,
  a WinZip SFX around an InstallShield 5 Disk1 (16-bit `SETUP.EXE`).
- `7z x` it; run `SETUP.EXE` with `--vfs-include='*' --tick-ms-per-batch=5
  --capture-launch=cap` (at 200 ms/batch the 16-bit launcher's splash timer
  quits before `_INST32I.EX_` is expanded) -> `_ins0576._mp`.
- Run that from the capture (`--exe-guest-path`, `--vfs-tree=cap`, frozen
  `--control`), Next x4, step to "Setup Complete", with
  `--save-vfs-prefix='c:\games'`: 6 files + `data\`, 39 MB, in
  `C:\Games\FreeSpaceDemo`. Kept at `Descent-Freespace demo-SW/installed`;
  `node tools/gen-win98-games-a-d-manifests.js` writes its manifest.
- `fs.exe` is the game (DDRAW, DINPUT, MSACM32...); `freespace.exe` is the
  launcher/configurator.

## What it needed (2026-10-06)

1. **acmGetVersion** (bc86ea02): not an API before; the import trapped.
2. **Monotonic QueryPerformanceCounter** (64355808): its timer
   (`exe+0x438cf0`) resets its base whenever QPC goes backwards; ours could,
   across guest threads (per-instance sub-ms counter), so the frame limiter
   at `exe+0x411980` computed a negative elapsed time and slept 31.9M ms in
   flight. Now one process-wide count.

It warns "Could not properly initialize the Microsoft ADPCM codec" (no ACM
codecs are installed here) and offers to continue: `dlg-cmd:6` (Yes).

## Route (CLI, default clock)

`--input=60000:dlg-cmd:6`, then at ~200K batches type a callsign (VIPER)
and Enter -> main hall; click the ready-room door (380,310) -> Training
Mission 01 briefing; COMMIT (595,440) -> in flight. The directive "Target
Instructor - Press T": T targets the GTF Apollo instructor (target box,
target panel, directive cleared).

Evidence: `scratch/runs/20261006-freespace-demo-target`.

## Open

Audio (missing MS-ADPCM ACM codec), FPS, browser route.

**ACM drivers (2026-10-11, w5; Telegram #39).** Startup's sound setup:
1. `acmGetVersion`.
2. `acmDriverEnum(..., fdwEnum=ACM_DRIVERENUMF_DISABLED)`, with `acmDriverDetailsA` for each driver.
3. `acmDriverPriority(MS-ADPCM hadid, 0, 0)`. This is a no-op call; it was unimplemented and crashed the page after dc7e8454d added the ADPCM codecs.
4. `acmStreamOpen` through the MS-ADPCM driver handle, with `fdwOpen=NONREALTIME`. The source is MS-ADPCM, mono, 22050 Hz, 512-byte blocks; the destination is **8-bit** mono PCM at 22050 Hz.
5. `acmStreamSize` and `acmStreamConvert` follow.

What changed:
- `acmDriverPriority` is implemented with shared enable/priority state (`$ACM_DRIVER_STATE`).
- The ADPCM codecs now also decode to 8-bit PCM. Before that, step 4 returned ACMERR_NOTPOSSIBLE.

The game now reaches Choose Pilot with its ADPCM streams converting.

**Mission launch "Illegal subsystem type" (2026-10-11, w5).** Once FreeSpace found ADPCM codecs, COMMIT ended in `Error: Illegal subsystem type. File: Ship\AiCode.cpp Line: 8931` over a noise-filled view. The route flew on Oct 6 (0bf7f395) and on dc7e8454d^, when no codec existed.

Bisecting is not useful here: every commit from dc7e8454d up to d33ffec74 crashes earlier, at the missing acmDriverPriority. dc7e8454d with d33ffec74 cherry-picked fails identically to main, with the same API count.

How the fault was found:
- `--break-api=MessageBoxA` gives the caller `0x4a312d`. Disassembly shows a subsystem loop with `type = [esi+0x4c]`, valid 1..10.
- A dump at the assert shows ESI's record (`0x937bdc`) full of ADPCM-looking nibbles.
- `--watch=0x937bdc --watch-js-only --watch-log` keeps the timing unchanged and shows the record overwritten at batch 1424. That is a 0x8D659-byte ReadFile into 0x8c391c from thread 3, the voice streamer.

The streamer (T2) loops `acmStreamSize(has, N, &src, DESTINATION)` → `mmioRead(src)` → `acmStreamConvert`. At a stream's tail N=1792 is less than one 2024-byte block. We returned ACMERR_NOTPOSSIBLE without writing `*pdwOutputBytes`, and FreeSpace ignores the error and read the stale stack value.

msacm32 (and Wine) clear the output before asking the driver, so `acmStreamSize` now does too. With that the mission flies with voice streams on, and T targets the instructor.

Evidence:
- `scratch/runs/20261011T1200Z-freespace_demo-mission-regression-w5` (diagnosis);
- `scratch/runs/20261011T1240Z-freespace_demo-flight-w5` (fixed).

Note for timing: `--watch` without `--watch-js-only` arms a per-block WAT watchpoint, and that moved this crash away. Sample in JS when timing matters.
