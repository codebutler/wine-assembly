# Independent legacy texture-capability acceptance — 2026-10-23

Verdict: **REJECT unconditional capability-truthfulness acceptance** of
`547460d4dfb6966b72cc28c04efac22a809d784f` against exact parent
`5406777ecbcef9cf9b03b40d592d722bb0086de0`. The proposed removal of demonstrated
overclaims is supported, but the retained mask is not a complete description of
implemented API operation support. No production repair or main integration was
performed. This report does not identify a newly introduced rendering defect.

The concrete counterexample is legal stage-0 SELECTARG1 with COLORARG1 and
ALPHAARG1 set to DIFFUSE (0), and ARG2 set to TEXTURE (2), with a bound texture.
The actual WAT setter stores these values and the actual WAT loader returns them.
The actual WAT GPU descriptor and JavaScript lowering nevertheless select
TEXTURE (2) for both argument-1 channels. With the fixture's distinct operands,
the requested selection is `0x8060a0e0`, while the lowered selection is
`0xa0c08040`. Both candidate and exact baseline fail the independent assertion
that the lowered argument must equal the stored argument. This is a pre-existing
production limitation, not a regression caused by this single constant change.

The producer oracle checks TEXTURE/DIFFUSE as a fixed pair. It never sets the
argument states before claiming that SELECTARG1/2/MODULATE are proven. Its nine
RGB/alpha combinations establish operation selection for that fixed pair;
they cannot establish general argument-state semantics. The report already
limits execution to selected paths, but a device capability bit has no such
fixed-operand qualification. Consequently passing those fixtures does not
justify the stronger claim that the remaining mask truthfully describes all
implemented functionality. `argument-reproducer.js` is the executable rejecting
reproducer; `argument-candidate.json` and `argument-baseline.json` retain the
actual state and lowering results. No expanded repair assignment was taken.

Independent review confirms these narrower positive findings:

- The source delta is one production constant plus comments. Operation values
  1–10 map to capability bits 0–9: DISABLE, SELECTARG1, SELECTARG2, MODULATE,
  MODULATE2X, MODULATE4X, ADD, ADDSIGNED, ADDSIGNED2X, SUBTRACT. Thus `0xE`
  retains only SELECTARG1/2/MODULATE. The mask is a capability mask, not an enum.
- The actual software combiner independently selects RGB and alpha from its
  texture/diffuse parameters for operations 2/3; other operations multiply.
  Independent arithmetic uses direct integer division, not the production
  shift/add optimization. 67,057 checks cover independent RGB/alpha selection
  and all 65,536 byte products, using the documented floor-division contract.
- The actual descriptor/lowering preserves the nine supported operation pairs
  and the fixed TEXTURE/DIFFUSE operands. Three independent mutations—color
  operands reversed, alpha operands reversed, alpha operation crosswired to
  color—are rejected. Five independent wrong masks (0, 6, 15, 30, 1023) are
  rejected. These are additional to the producer's five rejecting mutations.
- COLOROP=DISABLE with each of ALPHAOP=SELECTARG1/2/MODULATE still resolves a
  bound texture, reaches both textured software recording sinks, and lowers to
  GPU MODULATE. This confirms a real outer-stage disabling defect; it is not
  merely an unsupported value in the inner combiner. Alpha-only DISABLE with
  enabled color is undefined and is not used as evidence of missing support.
- The producer's nine RGB/alpha pairs, seven distinguishing unsupported cases,
  and five mutations pass on the candidate. Exact baseline executes the
  behavior checks then fails specifically at the expected mask assertion.
  Existing GPU batching and points tests pass. This establishes no new change
  to the sampled rendering behavior, not universal caller compatibility after
  changing capability discovery.
- Executing both real descriptor writers produces 236-byte images differing
  only at offsets 180 and 181. All 232 bytes outside the capability DWORD are
  identical; stage limits remain at 184/186. The D3D7 descriptor has no dwSize.
  Its line/triangle D3DPRIMCAPS begin at 4/60 and are 56 bytes each. The older
  sized D3DDEVICEDESC is a different structure: its DX6 texture-operation field
  is at 244, with WORD limits at 248/250. Its actual writers are unchanged and
  do not explicitly populate that operation field; the 252-byte writer zeros
  it. Do not infer that the older API structure lacks the field merely because
  this implementation does not populate it. D3DPRIMCAPS texture-blend bits are
  another field and are unchanged.

Primary references consulted on 2026-10-23:

- Microsoft's [legacy capability header](https://raw.githubusercontent.com/microsoft/win32metadata/main/generation/WinSDK/RecompiledIdlHeaders/um/d3dcaps.h)
  establishes operation bits and both descriptor layouts. Offsets above are
  independently derived with 4-byte DWORD/float, 2-byte WORD, and 16-byte GUID.
- Microsoft's [operation semantics](https://learn.microsoft.com/en-us/windows/win32/direct3d9/d3dtextureop)
  define argument selection, multiplication and stage disabling; its
  [stage-state definitions](https://learn.microsoft.com/en-us/windows/win32/direct3d9/d3dtexturestagestatetype)
  distinguish operation from argument state. The same argument-state mapping
  is directly present in the legacy production WAT setter/addressing code.
- The [legacy extended-capability reference](https://learn.microsoft.com/en-us/windows-hardware/drivers/ddi/d3dhal/ns-d3dhal-_d3dhal_d3dextendedcaps)
  describes capability bits as operation-support assertions.
- The [required Direct3D 9 capabilities policy](https://learn.microsoft.com/en-us/windows-hardware/drivers/display/required-direct3d-9-capabilities)
  explicitly requires DISABLE, MODULATE and SELECTARG1/2 for its D3DCAPS9 level
  9_1 scope. Removing DISABLE does not meet that policy and does not implement
  stage disabling. That document is not a D3D7 conformance specification; I do
  not invent a D3D7 mandatory-bit rule from it or use it as the rejection's sole
  basis. Legacy full API conformance is not established here.

Before execution, independent identity checks verified candidate/parent Git
identity; every compiler's absolute path, exact Git blob, full SHA-256 and byte
count; and every retained excerpt's exact source bytes, offsets and line ranges
on both revisions. A fresh manifest-only extraction matched production-form
order and assembled identity: 32,939 bytes, SHA-256
`f05616f67b30f52efec42aeeeb17f66278af5a59790d9e3045cada42d3c4d48a`.
The authentic compiler creates only 64 KiB fixtures. The independent probes
reuse verified fixture plumbing, then supply different arithmetic oracles,
control mutations, full descriptor differential, valid DISABLE configurations,
and the legal argument-state counterexample. They do not just replay counters.

Evidence and runnable helpers are adjacent in
`legacy-texture-caps-independent-accept-20261023/`. Recovery inputs remain in
`/tmp/legacy-texture-caps-independent-accept-oct23` and the released checkout
`/tmp/legacy-texture-operation-caps-oct23/repo`. Run helpers with Node's exact
`--max-old-space-size=256`; the probes accept REVIEW_DIR or REPRO_RECEIPT,
and the baseline additionally uses LEGACY_CAPS_CORE pointing to the retained
baseline-core.wat. Recovery commands are in `recovery.txt` and execution.jsonl.
The original producer report/evidence/test remain unchanged.

Resource accounting is independent, using the supplied review prelaunch SQLite
baseline. It counts all retained old and new private files, both launcher output
directories, both task session files, positive cumulative SQLite/WAL/SHM growth,
and an outside-files allowance. No shrink/checkpoint/deletion credit is taken.
Initial complete manifest and projection precede dependent tests; private peak
16,000,000 bytes, future growth 16,777,216 and reserve 8,388,608 are inside the
67,108,864 allocation. Admission also projects host free >=2,982,150,144, enforces
24 MiB/file and aggregate 524,288-byte capture. Final measurements and seals
are retained adjacent; later publication measurements remain in the private
directory rather than recursively snapshotting themselves.

Execution-process qualification has an explicit exception: the first two
instruction/guard inspection commands ran before this task's streaming wrapper;
the first tool truncated its displayed output. They were not compliant with
the requested all-substantive-command prebuffer capture rule. Their output and
subsequent direct reads/web output are conservatively charged by the 196,608-byte
direct/bootstrap allowance, but that does not retroactively repair the missing
streaming protection. This review therefore does not certify pristine capture
compliance. All subsequent substantive child commands use the owned guard with
CPU/wall 60 seconds, per-file bound, TERM/5-second/KILL handling and verified
group cleanup. Node requires 256 MiB heap and MemAvailable >=805,306,368.
The actual 32-byte rejection control passed with absent sentinel. No guard
limits were relaxed, no resource-denied operation was retried unchanged.

Routine owned mistakes are retained honestly: manifest-only was first invoked
without its required output environment variable, then corrected; the first
independent arithmetic probe assumed round-to-nearest rather than production's
explicit floor contract, and its original source/failure are retained alongside
the corrected floor-division test. A board watcher initially remained in the
bounded claim shell; it was explicitly terminated before its deadline, and the
guard verified cleanup. One short inspection overlapped that watcher wrapper;
there was no nested guard or repeated main-integration work. Subsequent commands
were serialized. These corrections did not change production or producer tests.

Qualification is source/small-fixture only: no full COM, 512 MiB native guest,
real WebGL pixels, full compiler/build.sh/native suites, gameplay or missing
operation implementation is accepted. No packages, workers, boxes or runtime
were used. Box ID/state/expiry N/A; coordinator owns lifecycle, prior boxes stay
stopped. Shared-main integration and the original native fixture/module directory
were untouched. Shadow Man 128 MiB approval and Airstrike/Penguin runtime403
holds are unchanged. Publication is only the independent task branch; no merge,
force-push, or root tracked tree/index/ref modification is authorized here.
