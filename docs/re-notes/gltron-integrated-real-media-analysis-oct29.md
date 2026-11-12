# GLTron integrated original-media static acceptance, 2026-10-29

Historical source last updated, 2026-10-29. Runtime and implementation claims below describe that dated source; see current app notes and source for subsequent changes.

Functional result: PASS for the exact production analysis API and actual CLI at
`00f76bfc8bfa5b99a778014cc0e89f3700f65393`. This closes the original-media
static-analysis gap left by fixture-based integrated acceptance. It does not
qualify runtime, dynamic LoadLibrary closure, gameplay, crash recovery, or
concurrent-reader publication atomicity.

The tested production file is `tools/recovery/gltron-original-win32-recovery-oct28.py`,
18,887 bytes, SHA-256
`aa7d8c7668a6ea466f2099bb1966d8f725ed660c47fcf961826e35f9c19be53d`. The original 3,658,814-byte archive SHA-256 is
`8956abae4e4fe6ebc45b97d58c9254789e0a1457d11c58e4dbb90aead45a3eb3`. All 92 retained extracted files were copied into the owned task directory and
verified against the pinned inventory hashes. No download, extraction,
installer, guest, browser, build, or Boat operation occurred.

The unmodified API `analyze(archive)` and CLI
`python3 -B tools/recovery/gltron-original-win32-recovery-oct28.py analyze ARCHIVE`
each independently replaced a deliberately marked prior inventory/closure pair. They used the real installed `/usr/bin/objdump -p` for all 11 PE modules, with no
verification, tool, or publication substitution. Both produced the exact retained
inventory (92 files, 4,968,893 extracted bytes) and closure (11 modules, no
unresolved static imports), including identical serialized output hashes:

Both successful calls removed their `.analysis-pair-*` staging directories. Publication paths are adjacent to the supplied archive, not in the repository. Static objdump logs remain under the owned payload's `static/` directory.

Reproducer and retention:

- Owned task root: `gltron-integrated-real-media-analysis-oct29`.
- Pinned dispatch and admission: the task-named dispatch JSON and
  `real-media-three-oct29-admission.json` in the host `scratch/usage-watch/`.
- Committed recipe files: `docs/recipes/gltron-integrated-real-media-analysis-oct29/`. `setup.py` records containment, exact empty mount parsing and Node startup,
  initializes only the owned sparse Git repository, and copies pinned media. It intentionally rejects an already initialized repository; it is a fresh-task
  recovery recipe, not an instruction to rerun setup over retained evidence.
- After authorized staging, the tested sequence is `python3 -B accept.py` from
  the task root with its colocated `supervisor.py`. It runs API, actual CLI,
  output comparison, and the single failure control in that order. The committed
  copies are byte-identical to those tested at the task root. The acceptance
  script itself is `test/gltron-integrated-real-media-analysis-oct29.py`.
- Canonical handoff: `evidence/receipt.json`, with input pins, per-operation
  admissions and stdout/stderr, checkpoints, publication, and cleanup bindings. Retained acceptance JSON copies accompany the committed recipe.

Procedural exception: some initial read-only policy/source inspection tool
responses exceeded the requested 8192-byte terminal bound and were truncated by
the tool. This is retained as an inspection-output incident, not represented as
a clean all-controls acceptance. Production analysis captures and resource
admissions passed; no production-source counterexample or runtime claim arose.
