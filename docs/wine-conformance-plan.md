# Plan: Wine Conformance Suite as Fidelity North Star

## Problem

wine-assembly improves mostly by whack-a-mole: pick an app → hit an unimplemented API or wrong semantic → fix → promote smoke. That loop is excellent at *finding* the real bug (fail-fast stubs, `--trace-*`, app e2e), but weak at:

1. **Knowing distance** — how much Win32 surface is still wrong or missing, independent of the last EXE tried.
2. **Choosing leverage** — which API gaps unlock the most Win98 apps, before an app complains.
3. **Guarding semantics** — soft stubs and “runs + paints” smoke can hide empty or wrong behavior.

The project already has a strong *product* regression harness (unit / e2e / smoke). It does not have a *Win32 fidelity* scoreboard.

## Goals

1. **Full inventory** — every Wine DLL crosstest EXE + every named subtest is known and periodically runnable, producing pass/fail/crash/skip counts so we always know “how far.”
2. **Curated focus** — a Win98-app-compat-weighted subset is the day-to-day North Star; PRs and theme work are judged against focus progress, not raw global %.
3. **Corpus-linked prioritization** — focus membership and ordering are driven by what `test/binaries/**` actually import, not by Wine’s internal completeness goals.
4. **Honest scoring** — stdout is captured; soft-success stubs do not count as PASS; out-of-scope NT surface is explicitly SKIP, not FAIL-noise.

## Non-goals

- Matching Wine’s full pass rate on current Windows / NT APIs.
- Replacing app e2e or `test-all-exes.js` smoke — those remain the *product* North Star.
- Vendoring Wine DLL *implementations* (wrong architecture: POSIX host vs in-WASM Win32).
- Making `CreateProcess` / multi-process / debugger work just so process-heavy Wine tests pass (unless a focus app needs it).
- Pixel-golden Wine GUI tests as CI gates (same font/layout reasons we avoid golden PNGs for notepad dialogs).

## North Star model (two meters)

| Meter | What it answers | Judged by |
|-------|-----------------|-----------|
| **Product** | Do curated Win98 apps boot, paint, and stay playable? | Existing `run-all` e2e + `test-all-exes.js` |
| **Fidelity** | How correct is our Win32/kernel/user/gdi surface? | Wine crosstest scoreboard |

Day-to-day engineering follows **focus fidelity** first when picking API themes; product meters remain the merge/release gate for app-facing changes.

```
                    ┌─────────────────────────────┐
                    │  Full Wine crosstest matrix │  ← distance / honesty
                    │  (manifest.json, all EXEs)  │
                    └──────────────┬──────────────┘
                                   │ filter
                    ┌──────────────▼──────────────┐
                    │  focus.json (Win98-weighted)│  ← active North Star
                    └──────────────┬──────────────┘
                                   │ prioritize with
                    ┌──────────────▼──────────────┐
                    │  API demand census          │
                    │  (binaries × stub quality)  │
                    └─────────────────────────────┘
```

---

## Wine test shape (what we are importing)

Wine does **not** ship one monolithic behavioral oracle. It ships:

1. **Per-DLL test EXEs** — `kernel32_test.exe`, `user32_test.exe`, `gdi32_test.exe`, …  
   Built from `dlls/<dll>/tests/*.c`. Each EXE has many **named subtests** (one per `.c`), invoked as:

   ```bash
   kernel32_test.exe atom
   kernel32_test.exe heap
   user32_test.exe class
   ```

2. **Aggregator** — `programs/winetest` embeds those EXEs and runs them in batch for WineHQ submission. We do **not** need `winetest.exe` as the harness; we run per-DLL EXEs ourselves.

3. **crosstest** — `make crosstest` (MinGW) produces **native 32-bit PE** test EXEs that run on real Windows. Those are the artifacts wine-assembly can load.

Relevant upstream layout:

- Sources: `https://github.com/wine-mirror/wine` → `dlls/*/tests/`
- Framework: `include/wine/test.h` (`ok()`, `START_TEST`, `--list`)
- License: **LGPL-2.1+** on test sources; redistributing prebuilt test EXEs is the default approach for this repo.

---

## Architecture

### Directory layout

```text
test/wine/
  README.md                 # how to refresh binaries, run tiers, read results
  manifest.json             # complete inventory: dll → exe → [subtests]
  focus.json                # curated Win98-compat subset (ordered)
  skip.json                 # explicit out-of-scope reasons
  binaries/                 # *.exe (git-lfs or download script; see Binary storage)
  results/                  # gitignored last-run JSON + markdown summary
  allowlist-crash.json      # optional: known crash stubs still expected in focus

tools/
  wine-tests-fetch.js       # download or build+copy crosstest EXEs; regenerate manifest
  wine-tests-run.js         # run matrix; parse stdout; emit results
  api-demand-census.js      # binaries IAT × handler quality → ranked API backlog
  wine-tests-curate.js      # suggest focus.json updates from census + last results
```

### Manifest schema (`manifest.json`)

```json
{
  "wineCommit": "abc123…",
  "wineVersion": "optional tag",
  "generatedAt": "ISO-8601",
  "tests": [
    {
      "dll": "kernel32",
      "exe": "binaries/kernel32_test.exe",
      "subtest": "atom",
      "source": "dlls/kernel32/tests/atom.c"
    }
  ]
}
```

Every `(dll, subtest)` pair appears exactly once. `--list` output from each EXE is the source of truth at fetch time; `source` is best-effort from Wine tree mapping.

### Focus schema (`focus.json`)

```json
{
  "version": 1,
  "goal": "Win98 app compat fidelity",
  "entries": [
    {
      "dll": "kernel32",
      "subtest": "atom",
      "priority": 1,
      "why": "Global/local atoms used by many Win98 GUIs; self-contained"
    },
    {
      "dll": "user32",
      "subtest": "class",
      "priority": 1,
      "why": "RegisterClass/GetClassInfo path; notepad/calc/wep"
    }
  ]
}
```

### Skip schema (`skip.json`)

```json
{
  "entries": [
    {
      "dll": "kernel32",
      "subtest": "process",
      "reason": "CreateProcess self-reexec; multi-process out of browser scope"
    },
    {
      "dll": "kernel32",
      "subtest": "actctx",
      "reason": "SxS activation context; post-Win98"
    },
    {
      "dll": "kernel32",
      "subtest": "debugger",
      "reason": "Debug APIs not in product surface"
    }
  ]
}
```

Skip wins over focus if both list the same subtest (misconfiguration → warn).

### Result schema (per run)

```json
{
  "ranAt": "ISO-8601",
  "gitSha": "…",
  "wineCommit": "…",
  "tier": "focus|all|dll:kernel32",
  "summary": { "pass": 0, "fail": 0, "crash": 0, "timeout": 0, "skip": 0, "noStdout": 0 },
  "results": [
    {
      "dll": "kernel32",
      "subtest": "atom",
      "status": "FAIL",
      "ok": 120,
      "failures": 3,
      "todos": 0,
      "firstFailure": "atom.c:42: …",
      "unimplementedApi": null,
      "elapsedMs": 800,
      "inFocus": true
    }
  ]
}
```

Statuses:

| Status | Meaning |
|--------|---------|
| `PASS` | Process exits cleanly; zero `Test failed:`; stdout captured |
| `FAIL` | One or more `Test failed:` (or non-zero failure count in Wine summary) |
| `CRASH` | `UNIMPLEMENTED API`, `unreachable`, `RuntimeError`, SEH death |
| `TIMEOUT` | Exceeded instruction/batch or wall budget |
| `SKIP` | Listed in `skip.json`, or Wine self-skipped entire subtest |
| `NO_STDOUT` | Ran but produced no parseable Wine output (harness bug or silent stub) |

---

## Prerequisite: guest stdout capture

**Blocker today:** `$handle_WriteFile` on std handles (1/2/3) reports bytes written and **discards** the buffer. Wine’s `ok()` / `trace()` paths use CRT → `WriteFile`/`WriteConsole` on stdout. Without capture, the scoreboard cannot see `Test failed:`.

### Required work (Phase 0)

1. **Mirror console writes to the host**  
   In `$handle_WriteFile` (std handles) and `$handle_WriteConsoleA/W`, call a new host import e.g. `host_console_write(ptr, len)` that appends UTF-8/ANSI text to a buffer and optionally `process.stdout.write` under the test harness.

2. **Expose the buffer to `test/run.js` / `wine-tests-run.js`**  
   Either stream live via the import, or flush on exit / on `OutputDebugString`-style boundaries. Prefer live streaming so timeouts still leave partial logs.

3. **Verify with a tiny PE**  
   Before importing Wine: a hello-world console EXE (or existing tool) that `printf`s a marker must appear in harness logs.

4. **Do not change GUI-app silence by default in the browser**  
   Host import can no-op or rate-limit in the web shell; CLI/`test/run.js` always captures.

### Soft-stub honesty (Phase 0 companion)

- Keep Win32 fail-fast (`$crash_unimplemented`) as the default for new holes.
- Audit soft-success stubs that Wine focus tests will hit (`CreateProcess` returns 0 is OK if tests FAIL assertions; `WinExec` returning 33 must not make a focus test PASS incorrectly — document or fail-fast if needed).
- `NO_STDOUT` is treated as harness failure in CI for focus tier, not as PASS.

---

## Acquiring Wine test binaries

### Build pipeline (recommended source of truth)

On a Linux builder with MinGW32 + Wine source:

```bash
git clone https://github.com/wine-mirror/wine.git
cd wine && ./configure --enable-win64=no   # details may vary by Wine version
# or configure appropriately for 32-bit crosstest
make -C dlls/kernel32/tests crosstest
make -C dlls/user32/tests crosstest
# … prioritized DLLs first, then the rest
```

`tools/wine-tests-fetch.js` should:

1. Pin a **Wine commit SHA** in `manifest.json`.
2. Either  
   - **A.** Download a release artifact we publish (CI job builds crosstests and uploads a tarball), or  
   - **B.** Invoke a documented Docker/script build and copy `*_crosstest.exe` → `test/wine/binaries/<dll>_test.exe`.
3. Run each EXE with `--list` under a real Windows box, under Wine, or (once stdout works) under wine-assembly if `--list` is simple enough — prefer running `--list` on Wine/Windows during fetch for reliability.
4. Rewrite `manifest.json`.

### Binary storage

Options (pick one in Phase 1):

| Option | When |
|--------|------|
| **Git LFS** under `test/wine/binaries/` | Binaries are moderate size; team already uses LFS |
| **Download script + gitignore binaries** | Keep repo lean; CI cache restores tarball by Wine SHA |
| **Subset in-repo, rest downloaded** | Focus EXEs in-repo for `test:quick`-adjacent runs; full matrix fetched for `test:wine:all` |

Recommendation: **focus EXE set in-repo or small tarball; full matrix downloaded by SHA** so clones stay usable offline for the North Star subset.

### DLL priority for first import

Import order (build/fetch), not focus order:

1. `kernel32`, `user32`, `gdi32`, `advapi32`
2. `comctl32`, `comdlg32`, `shell32`, `version`, `winmm`
3. `ddraw`, `dinput`, `dsound` (later; product-relevant for games)
4. Everything else for scoreboard completeness (ntdll, msvcrt, …) — run as `all` tier only

---

## Harness: `tools/wine-tests-run.js`

### Invocation

```bash
node tools/wine-tests-run.js --tier=focus
node tools/wine-tests-run.js --tier=all
node tools/wine-tests-run.js --dll=kernel32
node tools/wine-tests-run.js --dll=kernel32 --subtest=atom
node tools/wine-tests-run.js --tier=focus --update-baseline   # optional later
```

### Execution model

For each selected `(exe, subtest)`:

1. Launch via existing `test/run.js` machinery (or shared library extract) with:
   - console subsystem PE support
   - stdout capture enabled
   - generous but finite `--max-batches` / wall timeout
   - `--no-close` only if needed; prefer natural `ExitProcess`
2. Parse stdout for Wine patterns:
   - `Test failed:` lines → FAIL detail
   - summary lines from `test.h` (`%u tests executed…`)
   - `UNIMPLEMENTED API:` → CRASH + api name
3. Classify status; append to `results/`.
4. Emit human summary:

   ```text
   FOCUS  pass=12 fail=40 crash=8 skip=5 timeout=1
   ALL    pass=30 fail=200 crash=800 skip=400 …
   Top focus failures:
     user32/msg     42 fails  (first: msg.c:1200 …)
     gdi32/bitmap   CRASH     BitBlt …
   ```

### Integration with `run-all.sh`

Add tiers (names indicative):

| Tier | npm script | Contents |
|------|------------|----------|
| `wine-focus` | `test:wine` | `focus.json` only — pre-merge fidelity gate once green enough |
| `wine-all` | `test:wine:all` | full manifest — nightly / manual |
| existing `quick` / `e2e` / `smoke` | unchanged | product gates |

Do **not** put `wine-all` into default `npm test` until runtime cost is known. Start with `test:wine` as optional, then CI-nightly.

### Orphan product tests (parallel hygiene)

While building Wine tiers, fold the ~34 orphaned `test/test-*.js` files into `run-all.sh` (`e2e` or a new `e2e-slow` tier). Separate from Wine, but stops losing product regressions.

---

## API demand census (priority engine)

`tools/api-demand-census.js`:

1. Walk `test/binaries/**/*.{exe,dll}` (and VFS-staged app deps as available).
2. Use `tools/pe-imports.js` (or shared parser) to collect imported module/function names.
3. Join to handler quality:
   - **real** — non-trivial `$handle_*` body
   - **crash** — calls `$crash_unimplemented`
   - **soft** — returns success/0/`S_OK` with stub comment / known soft list
   - **missing** — imported name not in `api_table.json`
4. Emit ranked table:

   ```text
   API                        apps  quality   wine-subtests (hint)
   GetOpenFileNameA           40    real      comdlg32/filedlg
   GlobalAddAtomA             22    crash     kernel32/atom
   … 
   ```

5. `wine-tests-curate.js` reads census + last Wine results → proposes `focus.json` additions (human merges).

Handler quality detection: static scan of `src/09*.wat` for `$handle_Name` calling `$crash_unimplemented` as sole path; maintain a small manual `soft-stubs.json` for intentional soft DX/COM stubs.

---

## Focus curation policy (Win98 app compat)

### Include when

- Subtest stresses APIs with high **app demand** in the census, or
- Subtest is foundational for Win98 desktop apps (window class, messages, GDI bitmaps/text, heap/file/ini/registry, modules/resources), and
- Subtest is mostly **in-process** (no CreateProcess self-reexec, no multi-desktop stress), and
- Failures teach semantics we intend to implement (last-error, NULL buffers, odd flags).

### Exclude / skip when

- Requires real child processes, debuggers, NT-only APIs, SxS actctx, fibers-as-primary, modern `HeapSetInformation` contracts we will not match.
- Pure Wine-todo archaeology on Win10 APIs unused by the corpus.
- GUI tests that only validate pixel layout against modern Wine metrics.

### Initial focus seed (Phase 2 starting set)

Subject to revision after first `wine-all` run + census:

**kernel32:** `atom`, `heap` (basic paths; allowlist modern failures), `sync`, `thread` (subset expectations), `module`, `resource`, `profile`, `path`, `file` (VFS-shaped cases), `format_msg`, `environ`, `codepage`, `time`  
**user32:** `class`, `win`, `msg` (subset), `resource`, `clipboard` (if apps need it)  
**gdi32:** `bitmap`, `brush`, `pen`, `font`, `dc`, `metafile` (only if demand)  
**advapi:** `registry`  
**comdlg32 / comctl32 / shell32:** add as soon as EXEs fetch cleanly and census shows demand  

Exact subtest names must match `--list` output after fetch (Wine renames occasionally).

### Promotion / demotion rules

- **Promote to focus** when census rank is high and the subtest is no longer skip-worthy.
- **Demote from focus** when three consecutive `all` runs show only NT-skew failures and zero corpus imports touch those APIs.
- **Never delete from manifest** — demote to skip or leave as non-focus FAIL for distance.

---

## Phased rollout

### Phase 0 — Harness prerequisites (unblocks everything)

- [ ] Implement `host_console_write` + wire `WriteFile`/`WriteConsole` std paths
- [ ] Capture stdout in `test/run.js` (flag e.g. `--capture-console`)
- [ ] Smoke a minimal console `printf` PE end-to-end
- [ ] Document soft-stub vs fail-fast policy for fidelity scoring
- [ ] (Parallel) Wire orphaned product `test-*.js` into `run-all` tiers

**Exit criteria:** marker string from guest `printf` appears in Node logs.

### Phase 1 — Skeleton + first EXEs

- [ ] Create `test/wine/{manifest,focus,skip}.json` scaffolding
- [ ] `tools/wine-tests-fetch.js` for at least `kernel32` + `user32` + `gdi32` crosstests (pin Wine SHA)
- [ ] `tools/wine-tests-run.js --dll=kernel32 --subtest=atom` works
- [ ] Results JSON + console summary
- [ ] `npm run test:wine` → `--tier=focus` (focus may be 1–3 subtests initially)

**Exit criteria:** one focus subtest produces `PASS` or `FAIL` (not `NO_STDOUT` / not harness crash).

### Phase 2 — Focus North Star

- [ ] Expand binaries to advapi/comctl/comdlg/shell32/winmm as available
- [ ] Land initial `focus.json` seed; populate `skip.json` for process/debugger/actctx/…
- [ ] `tools/api-demand-census.js` v1 + checked-in sample report under `test/wine/results/census-sample.md` (or regenerate in CI artifacts)
- [ ] `wine-tests-curate.js` suggestions (manual apply)
- [ ] README: how to interpret FOCUS vs ALL meters

**Exit criteria:** focus list ≥15 subtests; census ranks top APIs; weekly (or per-milestone) focus summary is meaningful.

### Phase 3 — Full distance scoreboard

- [ ] Fetch/build remaining DLL test EXEs for `tier=all`
- [ ] Nightly (or manual) `test:wine:all` artifact: markdown + JSON
- [ ] Optional: simple HTML or markdown badge in `apps/` or `README` — “Wine focus: N/M · all: A/B” (only if maintained)
- [ ] CI: `test:wine` on PRs once focus is stable enough not to be pure noise; `test:wine:all` scheduled

**Exit criteria:** any contributor can answer “how far?” from the latest `all` artifact without running an app.

### Phase 4 — Feedback into implementation themes

- [ ] Theme selection ritual: pick top focus FAILs ∩ census crash/soft stubs → implement as a block (not one API from one app)
- [ ] When a focus subtest goes PASS, add a tiny product-side regression only if an app previously depended on the bug (avoid duplicate coverage)
- [ ] Revisit soft DX stubs with the same pattern later (`ddraw` tests as a separate focus track)

**Exit criteria:** two completed themes driven by focus+census rather than a single app crash.

---

## CI / developer workflow

### Local

```bash
npm run test:quick          # unchanged — unit
npm run test:wine           # focus fidelity
npm run test:wine:all       # full matrix (slow)
node tools/api-demand-census.js
node tools/wine-tests-curate.js   # prints suggested focus edits
```

### CI (when ready)

1. **PR:** `test:quick` + (eventually) `test:wine` if duration & flake allow.  
2. **Nightly:** `test:wine:all` + census + publish artifacts.  
3. Binaries restored from cache keyed by `manifest.json` → `wineCommit`.

### Flake policy

- Wine tests that call `GetTickCount` / timing / screen metrics: mark flaky in manifest metadata or skip.
- Instruction-budget flakes: raise budget per subtest in manifest overrides, don’t globally unbounded-run.
- Record `todo_wine`-style expected failures only if we intentionally match Wine’s wrongness — default is **match Windows semantics**, not Wine bugs. (If a Wine test assertion is known wrong on Win98, skip or note `win98-skew`.)

---

## Success metrics

| Horizon | Metric |
|---------|--------|
| Phase 0 done | Console capture works |
| Phase 1 done | ≥1 Wine subtest classified PASS/FAIL honestly |
| Phase 2 done | Focus pass count tracked; census drives ≥1 focus edit |
| Ongoing | Focus PASS rate trends up without product smoke regressing |
| Anti-metric | Global `all` PASS rate is **informational**; do not gate releases on it |
| Cultural | Theme PRs cite `focus.json` entries + census rank in the description |

---

## Risks and mitigations

| Risk | Mitigation |
|------|------------|
| Scoreboard optimizes for Wine/NT, not Win98 apps | Dual meters; focus+census filter; skip.json |
| Soft stubs create false PASS | Status rules; audit; fail-fast default |
| Stdout still incomplete (CRT paths) | Phase 0 console PE; also hook `WriteConsole*` |
| Binary size / legal questions | Prefer tarball+SHA; LGPL notice in `test/wine/README.md`; no Wine DLL code vendored |
| Suite too slow | focus vs all tiers; per-subtest budgets; don’t block `npm test` on all |
| Wine upstream churn | Pin commit SHA; refresh consciously |
| Assertions Win98-skewed (NT error codes) | `win98-skew` skip reason; accept multiple error codes only when Windows versions disagree and Win98 is documented |
| Duplicate effort vs app e2e | Focus on API semantics e2e doesn’t cover; don’t rewrite notepad tests as Wine |

---

## Relationship to existing tooling

| Existing | Role after this plan |
|----------|----------------------|
| `test/run.js` | Execution engine; gains `--capture-console` |
| `test/run-all.sh` | Remains product aggregator; gains optional wine tier hooks or stays separate npm scripts |
| `test/test-all-exes.js` | Product smoke matrix — unchanged role |
| `tools/pe-imports.js` | Building block for census |
| `src/api_table.json` | Dispatch metadata; not a status DB — status inferred from WAT + soft-stub list |
| `apps/*.md` | Per-app journals; link to focus themes when an app unblocks |
| Fail-fast `$crash_unimplemented` | Kept; feeds CRASH status + census |

---

## Open decisions (resolve during Phase 0–1)

1. **Binary storage:** LFS vs download-by-SHA tarball vs hybrid.  
2. **MinGW/Wine build host:** project CI image vs developer-only publish step.  
3. When does `test:wine` become a PR gate — after N focus subtests PASS, or after flake budget is known?  
4. Do we ever run Wine tests in the browser desktop, or CLI-only? (Recommendation: **CLI-only**.)  
5. LGPL notice placement and whether focus EXEs are redistributed in the berrry.app deploy (Recommendation: **test-only, not deployed**).

---

## Appendix A — Example focus seed (illustrative)

Final names must match Wine `--list` after pin:

```json
{
  "version": 1,
  "goal": "Win98 app compat fidelity",
  "entries": [
    { "dll": "kernel32", "subtest": "atom", "priority": 1, "why": "atoms; self-contained" },
    { "dll": "kernel32", "subtest": "profile", "priority": 1, "why": "win.ini / GetPrivateProfile*" },
    { "dll": "kernel32", "subtest": "resource", "priority": 1, "why": "PE resources" },
    { "dll": "kernel32", "subtest": "module", "priority": 1, "why": "GetModuleHandle/GetProcAddress" },
    { "dll": "kernel32", "subtest": "sync", "priority": 2, "why": "mutex/event/critsec" },
    { "dll": "kernel32", "subtest": "file", "priority": 2, "why": "CreateFile/ReadFile/VFS" },
    { "dll": "kernel32", "subtest": "path", "priority": 2, "why": "SearchPath/GetFullPathName" },
    { "dll": "kernel32", "subtest": "heap", "priority": 2, "why": "HeapAlloc family" },
    { "dll": "kernel32", "subtest": "codepage", "priority": 2, "why": "MultiByte/Wide conversions" },
    { "dll": "user32", "subtest": "class", "priority": 1, "why": "RegisterClass*" },
    { "dll": "user32", "subtest": "win", "priority": 1, "why": "CreateWindow/ShowWindow" },
    { "dll": "user32", "subtest": "msg", "priority": 2, "why": "message queue semantics" },
    { "dll": "gdi32", "subtest": "bitmap", "priority": 1, "why": "DIB/bitmap path" },
    { "dll": "gdi32", "subtest": "dc", "priority": 2, "why": "GetDC/SelectObject" },
    { "dll": "advapi32", "subtest": "registry", "priority": 1, "why": "Reg* used across apps" }
  ]
}
```

## Appendix B — Worked example (atom)

1. Phase 0: stdout capture lands.  
2. Fetch `kernel32_test.exe` at pinned SHA.  
3. `node tools/wine-tests-run.js --dll=kernel32 --subtest=atom`  
4. Likely `CRASH` or `FAIL` on `GlobalAddAtomA` / last-error behavior.  
5. Census shows N apps import atom APIs → stays priority 1 in focus.  
6. Implement real atom table in WAT (or fix last-error).  
7. Re-run until `PASS` (or FAIL only on documented win98-skew cases moved to skip).  
8. Product smoke unchanged; optionally no new app e2e if no app regressed.

---

## Summary

Copy **all** Wine crosstest subtests into a manifest for an honest distance meter; curate **focus.json** for Win98 app-compat work; drive focus order with an **API demand census**. Phase 0 is stdout capture — without it the suite is silent. Product e2e/smoke stay the release North Star; Wine focus becomes the fidelity North Star that ends whack-a-mole prioritization.
