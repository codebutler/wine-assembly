# Original Penguin Command 1.6.11 execution, 2026-10-24

Historical source last updated, 2026-10-24. Runtime and implementation claims below describe that dated source; see current app notes and source for subsequent changes.

**BLOCKED by the executed output guard; ordinary gameplay is unverified.**
The real original EXE started, all seven native providers loaded and returned
success from DllMain, and an SDL window acquired the title “Penguin Command”. The inspected 640×480 exit frame has a black client area. It establishes neither
the menu nor playability. No ordinary input was sent, and no menu, aim, fire,
projectile, enemy, score or wave response was observed.

## Executed blocker

At `2026-10-24T02:14:00.383Z`, API command `cmd_rstynxdxceqw` launched the bounded
supervisor on exclusively assigned `bx_9nngcsvf`. The guest log grew past the
supervisor’s 524,288-byte captured-output threshold because this historical
runner prints per-batch EIP/register progress by default. The observed retained
file is **554,504 bytes**, including orderly shutdown output; the polling guard
is not a byte-exact truncating writer. The supervisor sent TERM and recorded
exit 0, elapsed 1.26752 seconds, no KILL, no additional reaped children and no
remaining process group. The runner reported 761 API calls and 4,666 batches
over 0.721 seconds. Exit 0 is not an acceptance result.

The first scheduled control snapshot/capture was at four seconds and was never
sent: `run/input-events.json` is the actual empty list. No genuine guest trap,
unimplemented API, import failure or guest asset failure was observed in the
retained log. Static WINMM warnings were not treated as failure. Execution stopped
at the guard rejection; there was no retry or speculative guest repair.

## Exact inputs and preflight

The original EXE is 107,008 bytes, SHA-256
`14d6e430c26c44c94ef5c176eca2f66edd82dd66fd155d29a5596e3d6e170fc1`;
the wrapper was not used. Standing MSVCRT is 278,581 bytes, SHA-256
`887eb5ce93edb7192ca3e9220f07f9ca0f94db02af5862ebcbdfcb852db99fd1`. All seven explicit providers and all 83 original PNG/JPG graphics are bound by
path, byte length and full SHA-256 in adjacent `admission.json`. The ordinary
flags were `--windowed --nosound`, guest EXE `C:\penguin-command.exe`, CWD `C:\`. SDL_mixer remained loaded. Original closure acceptance `98257ee06ff0e68900025f20ab1453379e34b6ed`
was reused without another archive/dependency audit.

The retained pngjs **7.0.0** package came from
`/home/user/wine-assembly/scratch/usage-watch/shadow-man-codec-recovery-oct22/node_modules/pngjs`. All 23 receipt-bound files, 63,864 bytes, were rehashed and staged unchanged at
`runner/node_modules/pngjs`; receipt paths have their leading `runner/` stripped
when reading the standing retention. Both the local 2×2 and remote 1×1 PNG
encode/decode controls passed pixel equality. Remote ordinary module resolution
and production rasterCanvas/renderer loading passed. No skia decodeImage profile
or headlessGL route was selected; original game decoding uses its bundled DLLs.

All 125 supplied historical manifest files were read through exact `git show`
with `GIT_NO_LAZY_FETCH=1` and matched their sealed hashes. Two omissions in
that supplied manifest were corrected from the same canonical Git donor:

* The explicit-WASM runtime branch requires `tools/region-layout-hash.js`:
  8,031 bytes were added before startup.
* A first **pre-guest** CLI startup stopped on missing
  `fonts/subset/LiberationSans-Regular.ttf`. The runner calls
  `fontMounts(substitutions, {subset:true})`, whereas the supplied manifest
  contained full fonts. All 20 distinct derived subset paths (617,924 bytes)
  were then staged from exact canonical Git bytes. The original failure,
  command, empty inputs and clean process receipt remain under
  `preguest-missing-fonts/`; its API command was `cmd_kzf2b7jiunzx`.

This was a routine runtime-data manifest correction, with no harness or guest
source change. The superseded first preflight receipt remains as
`preflight-incomplete-font-data.json`. The corrected preflight explicitly loads
the renderer and reads every derived font mount. It verifies **287 files,
15,719,953 bytes**, all 83 game graphics and the exact full module hash. The accepted full-module ABI contract is reused by that exact hash, including
291 imports and shared memory 8192..32768 pages. The inert module layout stamp
and exact historical JS mirror both match `9a3bc9149d58209c`. Actual native
instantiation and DLL initialization subsequently succeeded in the game run;
this is not an independent all-signatures ABI reacceptance.

## Recovery and evidence

Adjacent preparation, transfer, correction, preflight and supervisor scripts
preserve the executed recipe and all input hashes. They have fixed one-task
destinations. `executed-supervise.py.gz` retains the byte-exact supervisor;
the readable `.py` copy only removes trailing whitespace, with both identities
in `supervisor-formatting.json`. The original collection seal binds the archive’s
decompressed bytes. Do not replay these scripts over retained evidence. Add `--quiet-blocks` to the recorded argv without relaxing guards;
then inspect menu/game frames and send ordinary inputs only if actually reached. No new execution was performed to test that proposal.

There is no Penguin candidate in this exact main’s candidate corpus, so these
captures stay with the investigation and are not attached to another app. `results.json` is published last as investigation metadata, not a dashboard
candidate/gameplay acceptance. `validation.json` records local syntax, retained
hash and evidence checks. No runtime/gameplay success is inferred from those
host-only checks.
