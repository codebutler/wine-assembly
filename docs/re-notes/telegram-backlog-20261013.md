# Telegram saved requests, 2026-10-13

`Saved #N` confirms inbox persistence, not execution or a substantive reply.
Boat's Claude consumer cursor was 49 and the Codex cursor was 2. Neither is
an authoritative record of unanswered requests: standalone replies can bypass
consumer state. Keep open work in TODOS and retain delivery receipts separately.

## Replies delivered

- #45-47: mobile-controls collage from
  `scratch/runs/20261011T1830Z-mobile-controls-montage-orch/`.
  Telegram message 1246. Visually reviewed; includes menus as well as gameplay.
- #51-52: Nocturne `20261012T1046Z-nocturne-touch-prepared/action.png`.
  Telegram message 1247. Reviewed muzzle flash and touch controls; existing run
  verifies emulated touch movement/fire. Pending development fixes, not public
  deployment or physical-device/audio/FPS qualification.
- #48-49 already have a Boat task for the FIFA Street link. The source post
  identifies GameCube/PS2/Xbox versions. That task proposes a Windows FIFA demo;
  it must not be represented as a Windows FIFA Street port.
- #50 and #53-56: source findings and status sent as Telegram message 1248.
  Boat task creation was verified before sending; installation/gameplay remains
  open for all three new demos. This closes the unanswered-message gap, not the
  underlying compatibility work.

Delivery receipts are append-only in Boat's
`scratch/telegram/backlog-responses-20261013.jsonl`. No other agent's cursor was
advanced. A response about a game source does not close its gameplay task.

## Verified sources for open requests

All three packages were downloaded to the laptop's ignored
`scratch/preserve-wip-20261012/` and SHA-1 checked against Archive metadata.
These are local compatibility fixtures; no redistribution permission established.

| Saved | Game | Source and file | Bytes | SHA-1 |
| --- | --- | --- | ---: | --- |
| #50 | Neverwinter Nights demo | [Archive](https://archive.org/details/Neverwinternights001), `NWNDemo.zip` | 408857829 | `fd71deea70c7a4d6b6677893b0fed4738b4f5a0a` |
| #55 | Tony Hawk's Pro Skater 2 demo | [Archive](https://archive.org/details/pro-skater-2), `Files/Demo/thps2.exe` | 28785118 | `8fbb8860ce20ca5c7c94a1ec93bd04738afc6699` |
| #56 | Warhammer 40,000: Chaos Gate demo | [Archive](https://archive.org/details/Warhammer40000ChaosGateDemo), `Warhammer40000ChaosGateDemo.zip` | 36267944 | `7704f0d0f52db8ca0d3073488ea8d355b32dbe74` |

#56's [linked post](https://x.com/oldyzach/status/2109694334539038875)
identifies Chaos Gate (1998, Windows). The Archive demo is a single tactical
mission. NWN's ZIP contains InstallShield Disk1 data1/data2 CABs, setup and readme.
Chaos Gate's ZIP contains InstallShield CABs/setup and `Chaos_Demo.txt`.
THPS2's executable is not directly readable by local p7zip 17.04; investigate its
installer format instead of treating it as a prepared game directory.

Next for each: extract/install, identify executable and imports, add a reproducible
local-only candidate recipe, run through ordinary launch into player-controlled
gameplay, review screenshots and record actual blockers. No gameplay was run for
these three requests during inbox triage. Boat has roughly 200 MB free, below its
2 GB runtime floor; use a workspace with sufficient space without deleting WIP.

Boat task IDs: `TG50-NEVERWINTER-NIGHTS-DEMO-20261013`,
`TG55-THPS2-DEMO-20261013`, `TG56-CHAOS-GATE-DEMO-20261013`.

## Subsequent local launch investigation

These attempts follow the inbox triage above; none establishes gameplay.

- Neverwinter Nights: unpack `NWNDemo.zip`, then use `unshield` on
  `NWNDemo/Demo/Disk1/data1.cab` (InstallShield 6, not the IS5 extractor).
  Flatten group `HD0` into the game root; copy `Data`, `TexturePacks`, `Music`,
  `Movies`, `Miles`, and `LocalVault` to their lowercase directory names,
  `Ambiant` to `ambient`, and retain `override`, `scripttemplates`, and `nwm`.
  Launch `nwmain.exe` with `--threads --vfs-include='**/*'`. The threaded
  launch reaches the unimplemented `glGenLists` API at batch 31905. The earlier
  nonthreaded spin is not the relevant blocker. Evidence:
  `scratch/runs/20261013-nwn-first-launch/run-threads.log`.
- Chaos Gate: unpack the ZIP and run `tools/is5-extract.js` on its `data1.cab`.
  The game tree contains `WH40KDemo.exe`, `SMACKW32.DLL`, and WinG DLLs.
  Launch `WH40KDemo.exe` with `--threads --vfs-include='**/*'`.
  It reaches unimplemented `WinGRecommendDIBFormat` at batch 9739. Evidence:
  `scratch/runs/20261013-chaos-first-launch/run.log`.
- THPS2: the executable is a Wise installer. Its original setup runs inside
  the emulator; no host archive extractor is needed. See
  [THPS2 investigation](thps2-demo.md) for the input replay and installation
  evidence.
