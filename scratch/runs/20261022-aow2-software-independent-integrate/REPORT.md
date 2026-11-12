# ACCEPT — AoW2 historical software compositor evidence

Independent review, 2026-10-22, worker session
`01a162c7-fa15-7352-a55d-60b38ceea507`. Candidate
`cb6b881088ec2dda58c9c0177feb95b81a169980` is accepted for the initial
Inioch's Legacy tower scene reached by Scenario → Single → Start → dismiss
Julia. **220 selected game-layer compositor submissions / 25.131145 seconds =
8.754077858 submissions/s.** This is neither logical game FPS nor display
refresh. Integration records historical evidence, not qualification of main.

## Independent checks

`review.py` is a read-only, repeatable audit. `raw-checks.json` records its
successful output. It independently checks sizes/hashes, archive copies,
sample/event relationships, provenance and closure rather than accepting
the candidate's summary booleans. `controls.json` retains the rerun of the
existing verifier and both driver syntax checks.

- All **104 seals** match. The archive is **6,305,282 bytes**, SHA-256
  `ff023d5ccfefed47b06c177250429b7487e265c1425453d4814c5ee4be396a67`.
  All **59** regular archive members equal the exposed raw files. Expanded
  regular-file size is **7,669,750 bytes**; the archive was read in place.
- Gate: **45 events**, seven samples, `235333.53000000003` →
  `240360.00500000012` ms, **5.026475000000093 seconds**. Full: **220 events**,
  27 samples, `240590.64500000002` → `265721.79000000004` ms,
  **25.131145000000018 seconds**, count 0 → 220. The gate ends before the
  full start. At every sample, counts equal the number of preceding events;
  timestamps, increasing event sequences, copied-before-submitted ordering,
  interval bounds, owner validity and sink geometry pass independent checks.
- The source/module is historical `c26252c4a95babe583ade1d1c6e2da0c050be45c`
  with module SHA-256
  `f644bbb26edc077239dac17b8b2cfda482aafd9eb44af4c4776d4fe153d5a1a7`,
  **1,878,971 bytes**. The canonical archive hash
  `3e308c0012e996070a01c1f77d6f399e9aaf7adb2d2620b27af018a80d29e248`
  was recomputed and its module read without extraction. All **5,625**
  canonical source/supplement blobs were rehashed; tracked manifest entries
  match the canonical commit's tree. Historical and canonical
  `ce4ce4f95eacaedff1b3e386f3ce3ae5d85bd16c` src/lib/tools/host/index/lock
  object identities match. All **154** runtime/module pins match the existing
  donor, and each tracked runtime source pin matches historical Git bytes.
- All **1,064** original fixture/manifest files and **29** fonts were freshly
  hashed in place. The manifest's **1,059** lazy companion paths, sizes and
  guest paths match the actual extracted tree plus EXE/three registered BPLs.
  Original EXE is **5,748,736 bytes**, SHA-256
  `a10590e5dbd013d154b00ea53e66670f4e74d38ab33adb2523f0a662af8f89f7`.
- Source/fixture/font pins plus six support files (including stdole2.tlb)
  account for all **1,253** unique pre/postrun remote pins. The attach driver
  was transferred separately; its transfer hash matches its Git bytes.
  Both remote pin receipts and all **4,434** distinct runner pin records are
  retained. All **580** successfully requested paths are covered by the pin
  map. This review verifies local original/donor bytes and sealed remote
  records; it does not claim a fresh hash of the stopped box's filesystem.

## Attribution and actual control coverage

The attach driver selects exactly one registered app and renderer, with a live
guest Worker and Worker thread backend, software renderer, GPU flag false,
HWND **65538**, visible/nonminimized **1024×768 OffscreenCanvas** overlay and
integer write sequence. It connects to the existing browser, does not navigate
or launch, installs the observer separately for gate/full, validates the gate
before proceeding, restores wrappers and disconnects. The ordinary driver
contains optional actions, but the actual command log contains only state,
shots, four ordinary canvas clicks and quit: no registered-route restart or
host-shadow measure action. Its pointer down/up uses browser input, and no
guest state mutation is in the exercised route. Browser wall time is
**286.183 seconds**, exit 0, page-error list empty.

I read the observer, raw validator, both test implementations, attach/input
drivers, matching historical loader/fallback source and renderer copy path.
Historical host-imports writes the overlay pixels before advancing writeSeq
and scheduling repaint. The renderer copies that layer into the exclusive
source; the nearest filter copies the source into its display canvas. The
observer calls the original draw operation first, attributes the selected
canvas's sequence, and accepts it only after a successful plain-nearest
filter.present with an actual matching source-to-sink draw. Repeated sequence
values do not increment; overwritten intermediate uploads are not recovered.
It instruments both ordinary and OffscreenCanvas context prototypes.

Both existing suites were rerun successfully. Inspecting assertions establishes
coverage for repeated sequence exclusion, skipped overwritten uploads, raw
presents without selected copies, no-op early returns, hidden display/opacity,
copy exceptions, canonical owner replacement, wrong installation dimensions,
wrapper replacement/restoration, filtered/direct paths and separate offscreen
prototypes. The validator's positive fixture and **11** mutations reject invalid
counts/rate, observer errors, invalid owner flag, absent sink, sample deltas,
repeated event sequence, out-of-interval events, raw-Flip event kind, zero
duration and reversed timestamps. These are small simulated contracts, not an
exhaustive browser or game compatibility suite. For example, the validator
trusts truthy sink/valid fields rather than revalidating CSS geometry; this
review independently inspects actual sink geometry and ownership records.
No claim of full owner/visibility permutations follows from the suite labels.

I directly inspected `raw/run/worker-full-before.png` and
`raw/run/worker-full-after.png`. Both show the world, terrain, central tower
and lower UI without Julia's introductory panel; tower pixels differ. The
browser is **800×600**, resized by attachment from routing's 1200×900. Sink
rect is `(10,226,460,336)`, source 1024×768 drawn into `(6,0,448,336)`.
Every raw event has that draw geometry, completed visible filter.present,
screen-present sink, visible document, block display and opacity 1. This is
visible compositor submission evidence; neither unique pixel counts nor
physical scanout nor an army-movement retest is established.

## Preserved caveats

The prelaunch npm install initially walked to the served root from an empty
runtime directory. The byte gate caught changed package/lock files before any
guest launch; the recorded correction stages runner dependencies under
runtime and restores both served files. The failure and corrected receipts
remain intact. There is one recorded browser/game run.

Native oleaut32/ole32/comctl32/shell32 fallback warnings, 404s and missing icon
remain in the raw console. Two Miles/mss32 Worker threads exit with EIP zero,
including `worker 2 stopped`. Visible rendering continued; their audio or
broader correctness consequences are unknown. GetOverlappedResult and
ActivateKeyboardLayout remain unsupported/unexercised imports in the static
inventory. Matching loader source preserves names and routes unresolved IDs
to a host diagnostic and unreachable on invocation; absence of those names or
an unimplemented diagnostic from this console does not establish complete API
coverage. The predecessor's static gate was superseded by the coordinator,
not silently repaired. No Windows, audio, full-game, other scene/backend,
current-main or release qualification is accepted.

The candidate report's RUNNING box statement is its historical handoff.
Coordinator closeout records `bx_y5a3vk8g` snapshot-stopped at
2026-10-22T04:00:29.317Z, operation `stop_35ef523ac0d5cc7b`; original expiry
was 05:33:29.742Z. This task allocates no runtime, performs no lifecycle action,
and hands lifecycle ownership back to the coordinator with the box stopped
per the supplied closeout, without an independent runtime API query.

## Integration and allocation

Actual SSH (existing dedicated key, strict pinned known-hosts) and HTTPS
`https://github.com/vgrichina/wine-assembly.git` refs both resolved main to
`efa26a12b0f1284b8558189d14c0e9c2213d5e11` and candidate task to
`cb6b881088ec2dda58c9c0177feb95b81a169980` on independent review. Candidate
adds only its run evidence and two capture/observer drivers. This review adds
only this directory. Main is preserved through normal ancestry/non-force
integration; exact final commits and remote verification are appended to the
root messageboard after push, avoiding a self-referential commit in this file.

Before checkout, Git object type/exact candidate availability was verified and
focused logical checkout measured **20,647,846 bytes**. Free space immediately
before first writes was **7,918,620,672 bytes**, above mandatory **2,982,150,144**;
16 MiB incremental reserve plus checkout fits the **64 MiB total task cap**.
Initial focused allocation was **21,638,146 bytes**. Subsequent writes were
admitted against the same floor; final measured allocation is recorded on the
board. Existing archives and Git object alternates were read in place. No
archive expansion, build, packaging, engine edits or shared Git config changes.

Live process **157495**, child of this task's fresh launcher process **157493**,
exposes `codex exec --profile wine-worker -c model_auto_compact_token_limit=200000
-c model_auto_compact_token_limit_scope="total" -m gpt-6.1-sol
-c model_reasoning_effort="medium"`. This confirms actual running launch
parameters, beyond config parsing. Session metadata independently confirms
the model/session ID; token metadata exposes the 475,000 model context window,
but no separate active compaction threshold field or observed threshold
crossing. The latter runtime introspection is absent; it is not claimed.

No delegation/refill, public deployment, compute, root WIP/index/config/TODOS/
STATUS changes, other games/fleet work or held timer-thread work occurred.
