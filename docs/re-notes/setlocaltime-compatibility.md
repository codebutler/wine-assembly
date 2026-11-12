# SetLocalTime virtual calendar

Source task based on main `9c522d88962456badb51409a7180d7d41e87463a`.
Original Mad Bomber evidence is retained by the LockFile task in
`scratch/runs/20261019-madbomber-original-remote-v2`: its packed CRT resolves
LockFile/UnlockFile, then fails to resolve SetLocalTime and returns FALSE from
its initializer. This change does not establish an original-game pass.

SetLocalTime already has immutable API id 627. Its fail-fast handler is now
implemented, and the explicit kernel32 export manifest adds emulator ordinal
593 without changing any existing ordinal or API id. The generated PE export
body is regenerated. Dispatch and hash generators leave their mirrors unchanged.

The handler gathers a read-only 16-byte guest SYSTEMTIME, releases its span,
returns BOOL, and pops one stdcall argument. Invalid/null input returns FALSE
and ERROR_INVALID_PARAMETER (87); success preserves LastError. Day of week is
ignored. Calendar fields are validated before changing state, including month
length, leap years, milliseconds and supported years 1601..30827.

The existing wall_clock import gains mode 4; its signature does not change.
A process-owned calendar object holds an offset from the existing late-bound
calendar policy. GetLocalTime, GetSystemTime, FILETIME, current timezone bias,
CRT consumers of those APIs, and CMOS sample that object. Cooperative workers
share it; real workers use the existing synchronous import broker. Other guest
processes remain isolated. No operating-system clock call is made. get_ticks,
real_time_ms, RDTSC and elapsed-time/audio timing policies are unchanged.

Microsoft specifies conversion using the bias at the current time, including
the current DST setting. Setting across a DST boundary can therefore require a
second call. This is intentionally different from resolving the target local
date's own timezone offset. See [SetLocalTime](https://learn.microsoft.com/en-us/windows/win32/api/sysinfoapi/nf-sysinfoapi-setlocaltime)
and [Local Time](https://learn.microsoft.com/en-us/windows/win32/sysinfo/local-time).
This is guest-only virtual time with no Windows privilege/token model or host
SE_SYSTEMTIME_NAME authorization; it does not implement SetSystemTime or
SetTimeZoneInformation. Existing host timezone rules remain the zone policy.

Validation: `node test/test-set-local-time.js` and `node test/test-cmos-rtc.js`
pass without a build, guest or OS Worker. The new host suite covers invalid
inputs with unchanged clock, leap day/century, time progression, FILETIME,
fractional timezone, DST two-call behavior, isolated processes, cooperative
workers, production browser context reconstruction and unchanged elapsed clocks.

Prepared controls, **not yet executed**:

- `node test/test-set-local-time-native.js --wasm=PATH --sha256=HASH`: exact
  production module, authentic x86 API dispatch/GetProcAddress by name and
  ordinal, BOOL/LastError/stdcall, calendar getters, NULL/invalid dates,
  noncontiguous two-page input and repeated gathered-span release. No compiler
  or test-only wasm exports. Run against both normal tail and compat modules.
- `node test/test-set-local-time-worker.js`: actual OS Worker synchronous RPC
  setter/getter with main-thread and CMOS visibility. No guest or implicit build.

A normal build and these controls require coordinator runtime allocation.
Original Mad Bomber validation must then use the original executable/CRT and
an independently reviewed bounded run. No public deployment is authorized.

## Additional dated branch findings

These historical observations supplement the current facts above; they do not establish a new current-main runtime result.

## Granted qualification result, 2026-10-19 02:58 UTC

Tested production module hashes:

- tail: `b2fdf52732a3046c1b26468a335a6a9b32ea16fcda5d4f111977306be9729541`
  (1,874,305 bytes)
- compat: `7f2c7b478bf325bdf028314db3ab8c45c650ef3c1bf393c538a6976d1be5cab4`
  (1,876,878 bytes)

Sixteen evidence files plus both exact modules were recovered through the
documented Boat Files API into local
`scratch/runs/20261019-setlocaltime-controls-1/`. All artifact and module hashes
verified against remote records. Recovery archive: 1,618,074 bytes, SHA-256
`925b9b8a2b64de70def1e53b1d8093dc83790dd3fbaf8a1d7a3b29e850419c75`.
`qualification.json`, `recovery-postflight.json`, `artifact-manifest.json`,
and `local-recovery.json` retain identities and verification; `build/` retains
both modules. Logs were inspected. These are API controls, not a run of a
registered original-game candidate, so no unrelated dashboard capture is attached.

Runtime is released. Original Mad Bomber remains untested with this candidate;
no game, visual, input, audio or performance qualification is implied.

## Original Mad Bomber candidate prepared, 03:02 UTC

Remote manifest `/home/user/setlocaltime-madbomber-prepared-1/manifest.json`:
SHA-256 `31e428d8ff3ccda41c631957c5b7c1cde137ef06cd4163ea8e204836f0b0d6e9`.
Transfer inventory SHA-256:
`5733c84810d781f8468a0f4609626d5d15d729500066e6be460a9c8865d79793`.
All 3,405 pins verified; aggregate bytes 24,386,671 of 33,554,432; sampled free
space 48,321,077,248 bytes. The qualified-build identity deliberately replaces
the earlier `97c67d7a` module; its prior provenance remains in the transfer record.
Both JSON files were recovered/hashverified locally in
`scratch/runs/20261019-madbomber-setlocaltime-prepared-1/` through Files API
(archive 186,676 bytes, SHA-256
`2de5b54fa9839212d5453ee7875734e542bfa03b73a989d92d6670f4e226d10f`).

## First original attempt: host boot failure, 03:04 UTC

Granted exact candidate command ran once as `cmd_wtalwxonqj8f`, controller
36354, from 03:04:44.310 to 03:04:44.903 UTC. It exited 1 before guest execution:
`test/run.js:2841` could not read `test/binaries/tlbs/stdole2.tlb`. The original
staging preserved originals/fonts but omitted this unconditional host boot asset.
No SetLocalTime caller, game, PNG or input result was reached. The 806-byte log
contains the missing-file error. Terminal reason was null, group absent, minimum
free space 48,315,715,584 bytes; this was not a disk/log/time guard stop.

## Shared complete boot audit and second preparation, 03:08 UTC

The Dungeon task's shared `runner-boot-assets.js` and negative controls were
reused byte-for-byte from `b2693558ae7995a2fb9654d4b9411e2c469ef070`.
Helper/check hashes: `8e189911881213529f454797ce480e2e1a999181113358fdf5d7fc0862d8d9a2`
and `819b0b0388792a5a330827ca023a6766d009936556dd75c11723ada2f6a6aa35`.
They verify the three boot source producers against the qualified commit, then
derive and verify 27 assets (692,498 bytes): stdole2, substitutions, five bitmap
fonts, and twenty subset font files. Missing typelib/bitmap/subset and changed
manifest/producer controls passed locally and remotely against source `504d6f773`.

New controller SHA-256:
`c7053f7928958fa2456876ad34716d6ab3563d28248e8b34e0c8932d4d278006`.
New manifest `/home/user/setlocaltime-madbomber-prepared-2/manifest.json`:
`eecae46e6bff0adb0936d41df5179d75a0d439f1e2d5a8b8c0b7380d53fa2125`.
All 3,408 pins verified; aggregate remains 24,386,671 bytes. Prior preparation
and failed original evidence remain preserved. The new manifest and derived
boot proof were recovered/hashverified in local
`scratch/runs/20261019-madbomber-setlocaltime-prepared-2/` (archive SHA-256
`37c985076790b3e3a1ba2defae7bd01e2e69f7b6019eec1fc57366a950e3ffbe`).

No second original run occurred at this preparation checkpoint.

## Original consumer progression, 03:14 UTC

After Dungeon's authoritative release, the coordinator's conditional grant
activated for exactly prepared-2. Command `cmd_wue9qxm647mo` ran once from
03:14:09.585 to 03:14:11.760 UTC and exited 1. The original packed msvcr70
initializer at guest `0x007b8450` now returns 1, and API #312 resolves
SetLocalTime to `0x00db9a34`. This establishes original startup progression;
there is no traced SetLocalTime invocation or gameplay qualification.

The next blocker is original SDL.dll's packed import initializer at guest
`0x00b5a130`, which returns 0. Final API #565 resolves `waveOutGetErrorTextA`
to zero, returning to `0x00b5a275`. SDL load base `0x00b23000` and original
base `0x10000000` map this to original VA `0x10037275`. Static disassembly of
the authentic 86,016-byte SDL.dll, SHA-256
`55eced17cf8a9b7acc671cc307503de847a3c36fdafafe14cee7917433cfe410`, shows
`or eax,eax; jz 0x10037280`; the taken branch executes `popad; xor eax,eax;
ret 0xc`. A successful lookup stores EAX into the import slot and continues.
Thus this missing export directly causes DllMain FALSE, not a speculative
conclusion based solely on the last log line.

No screenshot was produced and no input was sent. Log 246,851 bytes; no guard
reason, minimum free space 48,309,321,728 bytes. Independent postflight
`cmd_ayosxx1tvxer` proves controller 41941, child 42007 and its group absent,
lease absent, all 3,408 pins unchanged. Eight artifacts recovered/hashverified
to local `scratch/runs/20261019-madbomber-setlocaltime-2/`; archive 213,331 bytes,
SHA-256 `940bdd1ed69f02d489944c97a56afc3a59831d3a40cac235e0f055d9d71c2785`.
Army received the authoritative release. No further original run occurred.
