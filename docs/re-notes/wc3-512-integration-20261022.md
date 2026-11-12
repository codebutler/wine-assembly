# WC3 512 KiB integration (2026-10-22 UTC)

Merged local WC3 work through `cb1953038` with remote main `bf99a4285` in an
isolated checkout, preserving the root's pending brightness and unrelated edits.
The only textual merge conflict was the callback ownership census. Retained
both review histories and sealed hashes of the combined sources; ownership
remains pending. Reviewed the merged host initialization/cache option, Worker
retry guard, immutable GL packet transport and ordered readback paths. The
browser-shell delta from remote main only forwards `expandedWorkerCodeCache`
before initialization; it adds no callback or context restoration boundary.

Remote Node broker initialization now touches every RPC slot. Updated the
shared-GL broker test's mock buffer to include `RPC_MAX_SLOTS` rather than four
slots. This changes test capacity, not runtime behavior.

Validation: full build and full WAT GL encoder parity pass, including 512 KiB
pressure dispatch and ordered records. ThreadManager, Worker scheduler (58
checks), concurrent Worker IOCP, page-index layouts, shared GL protocol,
renderer lifecycle, software GL producer, Glide and legacy readiness pass.
The combined build has layout `7714899180ab402f`; it includes remote changes
and is not the byte-identical isolated benchmark artifact. No new FPS or native
performance claim is made for the integration. The root dev server remains on
the previously measured local 512 KiB build, separate from this checkout.
