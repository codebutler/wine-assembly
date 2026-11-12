# Enigma accepted-guards diagnostic startup, 2026-10-24

Historical source last updated, 2026-10-24. Runtime and implementation claims below describe that dated source; see current app notes and source for subsequent changes.

One authentic-unpacked Enigma startup stopped at its first requested PNG capture, batch **30000**, with `AssertionError [ERR_ASSERTION]: capture byte limit`. The terminal capture receipt is durable, reports `artifactAccepted:false`, and survives complete supervisor cleanup. The supervisor and its shell return **1**; the shell `&&` dependent is absent. No PNG was written. This is a concrete capture-guard blocker, not frame/menu/gameplay or packed-original acceptance. No second guest ran.

The accepted terminal guard stopped continuation: neither the previous later batch44896 regular-expression exception nor `[input] png FAILED` continuation appears. The accepted FindFirst implementation was installed, but this attempt does not independently demonstrate the later literal-plus path because capture denial stops earlier. Its exact-revision independent acceptance is reused.

## Observations and limits

The raw48354-byte output is below131072. Exactly16 API records were retained. The first is GetProcAddress(IsProcessorFeaturePresent), followed by LoadLibraryA(DDRAW.DLL) and LoadLibraryA(shfolder.dll); all16 records are in `api-traces.json`. FindFirst observes compat.lua, startup.lua, zero-byte enigma_conf.lua, models-32.lua, sound-defaults.lua, models-2d.lua, models.lua and level/index/schema paths. These are filename/metadata observations, not proof of a particular Lua entry/cache branch. Lua dynamic-loader entry, cache branch, final counter totals and rendered menu remain unknown. No new missing guest API is established. Ordinary `[FS]` read logging is absent; other diagnostics are retained.

Guest execution:12:16:19.574–12:16:26.640UTC; supervisor elapsed7.031739595seconds. The actual child exited1 before stop needed a signal: TERMfalse, KILLfalse, reaped[], remainingGroupfalse. Original stop() still polls/waits/reaps through its complete production path; subsequent `/proc` inventory finds no task Node process. No fake cleanup, return replacement or test-only exit was appended. The CLI propagated the intended exit1, so the conservative local wrapper also stopped and preserved its full response as `first-rejection.json`. Routine bookkeeping copied that unchanged response to `guest-supervisor-api.json`; no guest command was retried. The original wrapper exception and this correction remain retained.

## Configuration and identity

Immutable donor/main35a4a4e59fb2c76f9590b456ef7873e14271862a at `repo`. Fresh git init, explicit NONCONE sparse paths and read-only object alternates; root tracked/index/refs and donors stay unchanged. Trusted Git SSH uses the assigned dedicated key, BatchMode, IdentitiesOnly and exact known-hosts file with StrictHostKeyChecking=yes. Actual filename-bearing argv passed the canonical parser before checkout; remote tree validation enumerated/hashed2460 intended files, including comma-name enumeration (none present). Supported `--vfs-tree`, no comma-split per-file mounts. `--no-build` is explicit.

Preload order is **FTQ then original capture**. Actual env in `launch-command.json`: MAELSTROM_CAPTURE_INSTALL=1, ENIGMA_RUNNER_ROOT and ENIGMA_FINDFIRST_RUNNER_ROOT point to the historical runner; ENIGMA_TERMINAL_CAPTURE_INSTALL=1, ENIGMA_CAPTURE_PATH points to the original capture.cjs, and ENIGMA_TERMINAL_RECEIPT points to guest/capture-terminal.json. WINE_RUN_EXTRA_ARGS and WINE_REGION_MAP are removed by the original supervisor. No console suppression, API fabrication, clock/input/batch changes, dependency acquisition or build occurs.

| Input | SHA256 |
| --- | --- |
| canonical run.js, Git d8cd8c54c8d63c107696f1e4ef7a1e229dcadc1e | 4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809 |
| original capture.cjs | 6d64a146f2daf8b598dbf13e3c13f890dbc783d8f5286aacba6d343758d22079 |
| original complete supervisor | 73be15954cedc19340779ff6bda2397cb94927ca702d2baebdccd5e763cf7b73 |
| accepted terminal transform | f34e2b9fca0cafe2304f9231d9c5e759ddce66c01cf8c5b5dae15bc4edea5ee6 |
| accepted FindFirst adapter | c7d43b204bae560d421d11d326b336737b5f0d14b0cb271971b57b63d0aa16ed |
| accepted filesystem | 542ecac68e15882d9f5455e89c2c92198d3e3042b53b599b29706a6668fcb3b1 |
| quietFS adapter | cc9bb22fb39058b581883f836724f7a62eaf8dfbe2d2e42f3cd765f3abd8741e |
| complete staging manifest | 4ccbdd4e9bab80a88bf9565f813681c5369e4b16ef5dcd34291b87c361a793fe |
| historical WASM | 8fac39936b6df2418ad86cab118cef19a65a727f649fbc14c412b37818904686 |

Fresh real dependency preamble, pngjs7.0.0,28 font files, ordinary UID1000 writes and synthetic pixel-preserving capture preflight passed. This synthetic preflight is not real-frame acceptance. Fixed shared512MiB arena, Nodeheap512MiB, CPU90/wall60, original runner55seconds, max10000000batches, fixed640x480, firstPNG30000, original16 APIrecords and four counter PCs are unchanged. Accepted full-tail and actual Module._compile FTQ/TFQ composition receipts were reused rather than rerun.
